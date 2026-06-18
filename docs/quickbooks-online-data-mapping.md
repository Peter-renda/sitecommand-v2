# QuickBooks Online — Data-Mapping & Schema Alignment Specification

**Status:** Living specification
**Scope:** SiteCommand ⇄ QuickBooks Online (QBO) / Intuit Enterprise Suite accounting API (v3, `minorversion=65`)
**Companion docs:** [`quickbooks-online-integration.md`](./quickbooks-online-integration.md) (operational/runtime guide)

This document is the authoritative field-by-field map between SiteCommand's financial
schema and the QuickBooks Online object model. It defines what is mapped today, the
exact transform for each field, the QBO-required-field matrix, and the prioritized
gaps that must be closed for "all necessary fields" to flow correctly.

> Legend for the **Status** column in every table:
> ✅ mapped today · ⚠️ mapped but needs correction · ❌ gap (not mapped) · 🔭 future/out-of-scope

> **Implemented (P0):** All `VendorRef` / `CustomerRef` resolve to a QBO **Id** (`value`),
> creating the master record when it doesn't exist (**G2**). Bill expense lines post to a
> **real expense/COGS account** and PO/Invoice lines to a **real Item** — never to
> `Accounts Payable (A/P)` (**G4**). A foundational URL bug in `callQBO` (a stray `?` broke
> every query and `?operation=update`) was also fixed.
>
> **Implemented (P1):** Header and invoice transactions now carry the **full Schedule of
> Values** — one QBO line per SOV item with qty/unit preserved when consistent (**G13**);
> each line's **budget code** maps to an Account/Class/Item via `QBO_BUDGET_CODE_MAP`,
> falling back to defaults when unmapped (**G5**); transactions use **real document dates**
> instead of today (**G9**); and **retainage** is withheld as a negative line on AP/AR
> invoices when the retainage account is configured (**G10**). The ⚠️ rows below for these
> are now ✅; they are kept for history.
>
> New config keys: `QBO_AP_EXPENSE_ACCOUNT`, `QBO_DEFAULT_ITEM`, `QBO_BUDGET_CODE_MAP`
> (JSON), `QBO_RETAINAGE_RECEIVABLE_ACCOUNT`, `QBO_RETAINAGE_PAYABLE_ACCOUNT` (per-company
> in `company_integrations`, or env; accounts/items auto-detected/created where safe).
>
> **Implemented (P1/P2 round 2 — "finish mapping"):**
> - **G2 (rest):** auto-created Vendors/Customers are now **enriched** with the matching
>   directory contact's company name, email, phone, fax, website, and address
>   (`lookupDirectoryPartyDetails` → `buildPartyPayload`).
> - **G3:** every transaction line falls back to a **Class named after the project**
>   (auto-created best-effort; realms without class tracking are unaffected). Disable
>   with `QBO_PROJECT_TRACKING=none`.
> - **G6:** `payment_terms` resolves to a QBO **Term** (`SalesTermRef`) when an active
>   Term with that exact name exists; otherwise the text is kept in `PrivateNote`.
> - **G7:** `QBO_DOC_NUMBER_PREFIX=project` prefixes `DocNumber` with the project number
>   (`{project_number}-{number}`, truncated to QBO's 21-char cap); any other value is a
>   literal prefix; unset keeps the bare number.
> - **G8:** the lump-sum fallback line on commitments now posts the **revised** amount
>   (original + approved COs) — consistent with prime contracts.
> - **G10 (rest):** AR invoices bill **stored materials** as a dedicated
>   "Materials presently stored" line.
> - **G11:** void/terminated records clean up their QBO docs: subcontract **Bill →
>   delete**, purchase order → **POStatus=Closed**, prime contract **Invoice → void**;
>   never-synced void records are skipped without touching QBO.
> - **G12:** PO `ship_to` → `ShipAddr` (Line1–Line5), `delivery_date` → `DueDate`,
>   `ship_via`/`bill_to` → `PrivateNote`.
> - **Accounting feedback (new, see §11):** every sync response's `TotalAmt`/`Balance`
>   (and PO `POStatus`) is parsed and stored back on the SiteCommand record, with a
>   manual refresh endpoint and a daily cron refresh pass.
>
> **Implemented (round 3 — change orders, project pinning, two-way pull):**
> - **CO (was P2):** approved **change orders** now sync as their own QBO document —
>   CCO on a subcontract → **Bill**, CCO on a purchase order → **PurchaseOrder**, PCCO →
>   **Invoice** (`syncChangeOrderToQBO`, `DocNumber` `CO-{number}`). Own idempotency +
>   feedback columns (migration `164`). See §4.6.
> - **Project pinning (G3 rest):** each project can be pinned to an explicit QBO
>   **Project** (or Customer:Job / Customer) via Project Admin → ERP Integration
>   (`projects.qbo_customer_id`, migration `163`), so job-cost scoping no longer depends
>   on a brittle name match.
> - **Budget-code map → Items (G5 rest):** `QBO_BUDGET_CODE_MAP` entries may now carry an
>   `item` (the GC-standard one-Item-per-cost-code pattern) in addition to `account`/`class`,
>   editable in-app on Settings → Integrations.
> - **Two-way pull (read direction, see §12):** **Resync with ERP** pulls job-to-date
>   (actual) costs back into each budget line's **Job to Date Costs** column, matched by
>   budget code. Items-based path (paid Bill item lines scoped to the pinned QBO
>   Project/Customer) and a legacy account-based path (P&L scoped to the project Class)
>   coexist per-code. Exactly one ERP (QBO **or** Sage 300 CRE) may be connected.

---

## 1. Tenancy & connection model

| SiteCommand concept | QBO concept | Relationship | Notes |
|---|---|---|---|
| `companies.id` (a SiteCommand company) | **Realm** (`realmId`) | 1 ↔ 1 | One QBO company file per SiteCommand company. Stored as `company_integrations.QBO_REALM_ID`. |
| Company super_admin / site_admin | Intuit OAuth user | n/a | Only these roles can run the OAuth connect flow. |
| App credentials (`QBO_CLIENT_ID` / `QBO_CLIENT_SECRET`) | Intuit app keys | per-company or platform | Resolution order: `company_integrations` → `platform_settings` → env. |
| OAuth tokens (`QBO_ACCESS_TOKEN` / `QBO_REFRESH_TOKEN`) | OAuth 2.0 bearer + refresh | per-company | Access token ~1 hr, refresh token ~100 days; auto-refreshed on `401`. |

### 1.1 Redirect URI (critical for connecting)

Intuit aborts the entire authorization with a generic *"…didn't connect. Please try
again later, or contact customer support"* page when the `redirect_uri` sent on the
authorize call does **not exactly match** a redirect URI registered on the app in the
Intuit Developer portal (scheme, host, path, and trailing slash all included).

The redirect URI is resolved by `getIntuitRedirectUri()` in `lib/quickbooks.ts`:

1. `INTUIT_REDIRECT_URI` — explicit override; **set this to match the portal verbatim**.
2. `NEXT_PUBLIC_APP_URL` + `/api/integrations/quickbooks/callback`.
3. Request-derived origin (honors `x-forwarded-proto` / `x-forwarded-host`, assumes
   `https` off-localhost) — last resort only.

The **same** value is used for the authorize call and the token exchange (Intuit
requires them to be identical). The value must be a real URL that routes to the
SiteCommand callback handler.

Required OAuth scope: `com.intuit.quickbooks.accounting` (override with
`INTUIT_OAUTH_SCOPES` for enterprise tenants that need more).

---

## 2. Entity crosswalk

| SiteCommand record | Trigger / source | QBO entity | Posting? | Sync fn (`lib/quickbooks.ts`) |
|---|---|---|---|---|
| `commitments` (`type='subcontract'`) | contract header | **Bill** | Posting (A/P) | `syncCommitmentToQBO` |
| `commitments` (`type='purchase_order'`) | contract header | **PurchaseOrder** | Non-posting | `syncCommitmentToQBO` |
| `prime_contracts` | contract header | **Invoice** (A/R) | Posting (A/R) | `syncPrimeContractToQBO` |
| `commitment_sov_items` (billed-to-date) | SOV billing | **Bill** | Posting (A/P) | `syncAPInvoiceToQBO` |
| `prime_contract_sov_items` (this-period) | SOV billing | **Invoice** (A/R) | Posting (A/R) | `syncARInvoiceToQBO` |
| `directory_contacts` (Subcontractor / vendor) | name ref | **Vendor** | master data | `fetchQBOVendors` (read-only today) |
| `directory_contacts` (Owner/Client) | name ref | **Customer** | master data | `fetchQBOCustomers` (read-only today) |
| `projects` | — | **Project** / **Customer:Job** (pinned) or **Class** (per-line) | master data | ✅ pinned via `qbo_customer_id`; Class fallback (see §3.2 / §12) |
| `budget_line_items.cost_code` / SOV `budget_code` | — | **Item** (preferred) / **Account** / **Class** | master data | ✅ via `QBO_BUDGET_CODE_MAP` (see §3.3) |
| `change_orders` (approved CCO / PCCO) | CO header + SOV | **Bill** / **PurchaseOrder** / **Invoice** | posting (CCO Bill = A/P, PCCO Invoice = A/R) | ✅ `syncChangeOrderToQBO` (see §4.6) |

> **Conceptual-alignment note (decision required):** A subcontract is a *commitment*,
> not yet a payable. Mapping the subcontract **header** to a **Bill** (`syncCommitmentToQBO`)
> *and* its billed-to-date SOV to another **Bill** (`syncAPInvoiceToQBO`) double-books the
> liability. Industry-standard alignment is: subcontract/PO header → **PurchaseOrder**
> (non-posting commitment); the subcontractor's actual invoice → **Bill** (posting). See
> §7 item G1.

---

## 3. Reference / master-data mapping

### 3.1 Vendor (from `directory_contacts`, the contract `contract_company`)

| SiteCommand field | QBO `Vendor` field | Type | Transform | Status | Notes |
|---|---|---|---|---|---|
| `commitments.contract_company` | `DisplayName` | string≤500 | resolve→Id, else create | ⚠️ | Today passed as `VendorRef.name` only; **must resolve to `VendorRef.value` (Id)** — see §7 G2. |
| `directory_contacts.company` | `CompanyName` | string | direct | ❌ | |
| `directory_contacts.email` | `PrimaryEmailAddr.Address` | string | direct | ❌ | |
| `directory_contacts.phone` / `business_phone` | `PrimaryPhone.FreeFormNumber` | string | direct | ❌ | |
| `directory_contacts.business_fax` | `Fax.FreeFormNumber` | string | direct | ❌ | |
| `directory_contacts.website` | `WebAddr.URI` | string | direct | ❌ | |
| `directory_contacts.{city,state,zip,country}` | `BillAddr.{City,CountrySubDivisionCode,PostalCode,Country}` | address | direct | ❌ | |
| `directory_contacts.license_number` | `TaxIdentifier` (or custom) | string | direct | ❌ | Confirm field; not a true tax id. |
| `directory_contacts.entity_type` | `Vendor1099` (bool) | bool | derive | ❌ | 1099 vendor flag if entity is an individual/contractor. |

### 3.2 Customer (from `prime_contracts.owner_client`)

| SiteCommand field | QBO `Customer` field | Type | Transform | Status | Notes |
|---|---|---|---|---|---|
| `prime_contracts.owner_client` | `DisplayName` | string≤500 | resolve→Id, else create | ⚠️ | Today `CustomerRef.name` only; **must resolve to `CustomerRef.value`** — §7 G2. |
| (owner directory contact) email/phone/address | `PrimaryEmailAddr` / `PrimaryPhone` / `BillAddr` | — | direct | ❌ | Owner is a free-text string today, not linked to a directory contact. |
| `projects.qbo_customer_id` (+ `…_name`) | **Project** / Customer:Job / Customer **Id** | pinned | exact id | ✅ | Pinned in Project Admin → ERP Integration (migration `163`); used by the job-cost pull to scope reports (§12). Falls back to a Projects-first name lookup (`findCustomerIdByName`) when unset. |
| `projects.name` (for posting) | per-line `ClassRef` named after the project | derive | direct | ✅ | Class fallback on every transaction line (`QBO_PROJECT_TRACKING=none` disables) — §7 G3. Customer:Job posting remains future. |

### 3.3 Account / Item / Class / Terms (chart-of-accounts dependent — needs customer config)

| SiteCommand source | QBO target | Status | Notes |
|---|---|---|---|
| Subcontract Bill expense line | `AccountBasedExpenseLineDetail.AccountRef` → an **expense/COGS account** | ✅ | Resolved by `findExpenseAccountId` (`QBO_AP_EXPENSE_ACCOUNT` or first active COGS/Expense). No longer `A/P`. |
| PO / SOV line item | `ItemBasedExpenseLineDetail.ItemRef` → **Item** | ✅ | Resolved/created by `findOrCreateItemId` (`QBO_DEFAULT_ITEM`, default "Services"). |
| SOV `budget_code` / budget `cost_code` (WBS) | `ItemRef` (preferred) / `AccountRef` / `ClassRef` | ✅ | Per-realm `QBO_BUDGET_CODE_MAP` (`{ "<code>": { item?, account?, class? } }`), resolved by `resolveCodeRefs`; editable in-app on Settings → Integrations. One **Item** per code is the GC-standard pattern and also drives the job-cost pull (§12). Unmapped codes fall back to the transaction default. |
| `commitments.payment_terms` | `SalesTermRef` (+ derived `DueDate`) | ❌ | Map free-text terms to a QBO Term Id — §7 G6. |

---

## 4. Field-level mappings (transaction headers + lines)

### 4.1 Commitment (subcontract) → **Bill** — `syncCommitmentToQBO`

| SiteCommand (`commitments`) | QBO `Bill` field | Transform | Status | Notes |
|---|---|---|---|---|
| `contract_company` | `VendorRef` | name→**Id** (resolve) | ⚠️ | §3.1 / G2. |
| `number` | `DocNumber` | `String(number)` | ✅ | Collision risk across projects in one realm — G7. |
| `title` | `PrivateNote` | direct | ✅ | |
| `original_contract_amount` | `Line[0].Amount` | `toFixed(2)` | ⚠️ | Excludes approved COs (prime sync *includes* them — inconsistent, G8). |
| — | `Line[0].DetailType` | const `AccountBasedExpenseLineDetail` | ✅ | |
| `title` | `Line[0].Description` | direct | ✅ | |
| (hard-coded) | `Line[0]…AccountRef` | const `"Accounts Payable (A/P)"` | ⚠️ | **Invalid** debit account — G4. |
| (now) | `TxnDate` | `today` | ⚠️ | Should be `start_date` / `contract_date` — G9. |
| `payment_terms` | `SalesTermRef` / `DueDate` | map | ❌ | G6. |
| `default_retainage` | retainage line / memo | derive | ❌ | G10. |
| `status` (`void`/`terminated`) | void/delete Bill | derive | ❌ | G11. |

### 4.2 Commitment (purchase_order) → **PurchaseOrder** — `syncCommitmentToQBO`

| SiteCommand (`commitments`) | QBO `PurchaseOrder` field | Transform | Status | Notes |
|---|---|---|---|---|
| `contract_company` | `VendorRef` | name→**Id** | ⚠️ | G2. |
| `number` | `DocNumber` | `String(number)` | ✅ | G7. |
| `title` | `PrivateNote` + `Line[0].Description` | direct | ✅ | |
| `original_contract_amount` | `Line[0].Amount` / `…UnitPrice` (Qty 1) | `toFixed(2)` | ✅ | |
| (hard-coded) | `Line[0]…ItemRef` | const `"Services"` | ⚠️ | Item must exist — G4. |
| `ship_to` | `ShipAddr` | parse | ❌ | PO supports ship-to — G12. |
| `ship_via` | `ShipMethodRef` / memo | map | ❌ | G12. |
| `bill_to` | `ShipTo` / memo | map | ❌ | G12. |
| `contract_date` / `issued_on_date` | `TxnDate` | direct | ⚠️ | Currently `today` — G9. |
| `delivery_date` | `DueDate` | direct | ❌ | |
| `status` (`void`) | `POStatus=Closed` / delete | derive | ❌ | G11. |

### 4.3 Prime contract → **Invoice (A/R)** — `syncPrimeContractToQBO`

| SiteCommand (`prime_contracts`) | QBO `Invoice` field | Transform | Status | Notes |
|---|---|---|---|---|
| `owner_client` | `CustomerRef` | name→**Id** | ⚠️ | G2. |
| `contract_number` | `DocNumber` | `String(...)` | ✅ | |
| `start_date` | `TxnDate` | `?? today` | ✅ | |
| `estimated_completion_date` | `DueDate` | omit when null | ✅ | |
| `original_contract_amount` + `approved_change_orders` | `Line[0].Amount` / `…UnitPrice` | sum, `toFixed(2)` | ✅ | "Revised" amount; note G8 inconsistency vs commitments. |
| `title` | `Line[0].Description` | direct | ✅ | |
| `description` `\|\|` `title` | `CustomerMemo.value` | direct | ✅ | |
| `description`, `contractor`, `architect_engineer`, `default_retainage`, `executed`, `status` | `PrivateNote` | multi-line join | ✅ | Free-text only; not structured. |
| (hard-coded) | `Line[0]…ItemRef` | const `"Services"` | ⚠️ | Item must exist — G4. |
| `default_retainage` | retainage line to "Retainage Receivable" | derive | ❌ | Currently memo only — G10. |
| `contractor` / `architect_engineer` | n/a (no native field) | memo | ✅ | Acceptable as memo. |

### 4.4 AP invoice (commitment SOV billed-to-date) → **Bill** — `syncAPInvoiceToQBO`

| SiteCommand source | QBO `Bill` field | Transform | Status | Notes |
|---|---|---|---|---|
| `commitments.contract_company` | `VendorRef` | name→**Id** | ⚠️ | G2. |
| `commitments.number` | `DocNumber` | `String(...)` | ✅ | |
| `commitments.title` | `PrivateNote` | direct | ✅ | |
| `commitment_sov_items.description` | `Line[n].Description` | `?? title` | ✅ | One line per item with `billed_to_date > 0`. |
| `commitment_sov_items.billed_to_date` | `Line[n].Amount` | `Number(...)` | ✅ | |
| (hard-coded) | `Line[n]…AccountRef` | const `"Accounts Payable (A/P)"` | ⚠️ | Invalid debit account — G4. |
| `commitment_sov_items.budget_code` | `…AccountRef` / `…ClassRef` | map | ❌ | Cost coding dropped — G5. |
| `commitment_sov_items.qty` / `uom` / `unit_cost` | (item line) `Qty` / `UnitPrice` | direct | ❌ | Only `amount` is sent — G13. |
| (now) | `TxnDate` | `today` | ⚠️ | Should be invoice/period date — G9. |

### 4.5 AR invoice (prime SOV this-period) → **Invoice (A/R)** — `syncARInvoiceToQBO`

| SiteCommand source | QBO `Invoice` field | Transform | Status | Notes |
|---|---|---|---|---|
| `prime_contracts.owner_client` | `CustomerRef` | name→**Id** | ⚠️ | G2. |
| `prime_contracts.contract_number` | `DocNumber` | `String(...)` | ✅ | |
| `prime_contracts.title` | `PrivateNote` | direct | ✅ | |
| `prime_contract_sov_items.description` | `Line[n].Description` | `?? title` | ✅ | One line per item with `work_completed_this_period > 0`. |
| `prime_contract_sov_items.work_completed_this_period` | `Line[n].Amount` / `…UnitPrice` (Qty 1) | `Number(...)` | ✅ | |
| (hard-coded) | `Line[n]…ItemRef` | const `"Services"` | ⚠️ | G4. |
| `prime_contract_sov_items.budget_code` | `…ClassRef` / `ItemRef` | map | ❌ | G5. |
| `prime_contract_sov_items.{materials_stored,retainage_amount,retainage_pct}` | retainage / stored-materials lines | derive | ❌ | AIA G-703 columns dropped — G10. |
| (now) | `TxnDate` | `today` | ⚠️ | Should be billing-period date — G9. |

### 4.6 Change order → **Bill / PurchaseOrder / Invoice** — `syncChangeOrderToQBO`

A change order syncs as a single QBO document whose entity follows its parent:
**CCO on a subcontract → Bill**, **CCO on a purchase order → PurchaseOrder**, **PCCO →
Invoice** (`parentType` resolved in the sync route from the CO's `type` / parent
commitment). Voided/terminated COs delete the Bill, close the PO (`POStatus=Closed`),
or void the Invoice, exactly like the parent records (§7 G11).

| SiteCommand (`change_orders`) | QBO field | Transform | Status | Notes |
|---|---|---|---|---|
| `contract_company` | `VendorRef` (CCO) / `CustomerRef` (PCCO) | name→**Id** (resolve/create) | ✅ | Same `findOrCreate*Id` + directory enrichment as the parent. Blank → `422 validation`. |
| `number` | `DocNumber` | `CO-{number}` (project prefix replaces `CO` when configured); 21-char cap | ✅ | Distinguishes COs from the parent doc in the QBO transaction list (G7). |
| `title` + `description` | `PrivateNote` | newline join | ✅ | PCCO also sets `CustomerMemo = title`. |
| `schedule_of_values[]` | `Line[n]` | one line per SOV item; budget code → `Item`/`Account`/`Class` via `resolveCodeRefs` | ✅ | Falls back to a single lump-sum line (`amount`) when the CO has no SOV. |
| `amount` | `Line[0].Amount` (fallback) | `toFixed(2)` | ✅ | Used only for the lump-sum fallback line. |
| `date_initiated` | `TxnDate` | `?? today` | ✅ | |
| `due_date` | `DueDate` | omit when null | ✅ | |
| (project) | per-line `ClassRef` | project-named Class | ✅ | Same project-tracking fallback as §3.2. |
| `status` (`void`/`terminated`) | delete Bill / close PO / void Invoice | derive | ✅ | Never-synced void COs are skipped. |

> The daily cron only auto-pushes **Approved** COs that are dirty (`status = 'Approved'`
> and `updated_at > qbo_synced_at`); the manual **Sync** route can push a CO on demand. The
> CO amount is **not** also folded into the parent contract's revised total in QBO — the CO
> is its own posting document, so the two together equal the revised contract value without
> double-counting.

---

## 5. Identifiers, idempotency & sync-state columns

| SiteCommand column | Purpose | QBO counterpart |
|---|---|---|
| `commitments.qbo_id` / `prime_contracts.qbo_id` | header Bill/PO/Invoice Id | `Bill.Id` / `PurchaseOrder.Id` / `Invoice.Id` |
| `…qbo_sync_token` | optimistic-lock token | `SyncToken` (always re-fetched before update) |
| `commitments.qbo_ap_invoice_id` + `…sync_token` + `…synced_at` | SOV-billing Bill | `Bill.Id` |
| `prime_contracts.qbo_ar_invoice_id` + `…sync_token` + `…synced_at` | SOV-billing Invoice | `Invoice.Id` |
| `change_orders.qbo_id` / `…qbo_sync_token` / `…qbo_synced_at` | CO Bill/PO/Invoice Id (migration `164`) | `Bill.Id` / `PurchaseOrder.Id` / `Invoice.Id` |
| `projects.qbo_customer_id` / `…qbo_customer_name` | pinned QBO Project/Customer (migration `163`) | `Customer.Id` (incl. `IsProject`) |
| `…last_synced_at`, `…updated_at` (CO: `qbo_synced_at`) | dirty detection for cron | — |
| `erp_status` (`not_synced`/`pending`/`synced`) | UI sync badge | — |
| `erp_sync_logs` (`integration='quickbooks'`) | per-attempt audit (`result`, `sage_key`=qbo id, `error_message`, `raw_response`) | — |

**Update protocol:** when a `qbo_id` exists the sync does `GET {entity}/{id}` to read the
current `SyncToken`, then `POST {entity}?operation=update` with `sparse:true`. A missing
record (deleted in QBO) falls back to create. This is correct and should be preserved.

---

## 6. Data types, formats, precision & transforms

| Concern | Rule |
|---|---|
| Money | SiteCommand `NUMERIC(15,2)` → QBO decimal; always `Number(x.toFixed(2))`. |
| Quantities | SiteCommand `NUMERIC(15,4)` → QBO `Qty` decimal (QBO accepts ≤5 dp). |
| Dates | `DATE` → `YYYY-MM-DD` (QBO date type). Never send `null` date keys — omit them. |
| Strings | `DocNumber` ≤ 21 chars; `PrivateNote`/`CustomerMemo` long text OK. |
| Refs | `*Ref` objects take `{ value: "<Id>" }` (preferred) or `{ name: "<DisplayName>" }`. **Prefer `value`.** |
| Currency | No `CurrencyRef` sent → assumes realm home currency. Multi-currency = future. |
| Tax | No `TxnTaxDetail` / `TaxCodeRef` sent → amounts treated as tax-exclusive/none. |
| Rounding | Header lump-sum lines must equal the sum of detail lines to avoid QBO total mismatch. |

---

## 7. Gaps & recommended enhancements ("all necessary fields")

Prioritized. **P0 = blocks correct posting; P1 = completeness/accuracy; P2 = nice-to-have.**

| ID | Pri | Gap | Recommendation |
|---|---|---|---|
| **G2** | ✅ done | ~~Vendor/Customer sent as `*Ref.name` only; errors when the display name doesn't exactly match.~~ | **Implemented:** `findOrCreateVendorId`/`findOrCreateCustomerId` resolve `DisplayName → Id` and auto-create when absent; all transactions post `*Ref.value`. Auto-created records are **enriched** with the directory contact's company name / email / phone / fax / website / address (`lookupDirectoryPartyDetails`). |
| **G4** | ✅ done | ~~Bill line `AccountRef = "Accounts Payable (A/P)"` invalid; `ItemRef = "Services"` assumed.~~ | **Implemented:** `findExpenseAccountId` posts Bills to a configured (`QBO_AP_EXPENSE_ACCOUNT`) or auto-detected COGS/Expense account; `findOrCreateItemId` resolves/creates the PO/Invoice Item (`QBO_DEFAULT_ITEM`, default "Services"). Sync fails fast with a clear message if no valid account/item can be found. |
| **G1** | P1 | Subcontract header → Bill *and* SOV billed-to-date → Bill double-books the liability. | Map subcontract/PO header → **PurchaseOrder** (commitment, non-posting); map the actual invoice/SOV billing → **Bill** (payable). Decision needed before changing posting behavior. |
| **G5** | ✅ done | ~~`budget_code` / `cost_code` (WBS) not mapped → no job costing.~~ | **Implemented:** `resolveCodeRefs` maps each SOV line's budget code → `ItemRef` (preferred, GC-standard) / `AccountRef` / `ClassRef` via the `QBO_BUDGET_CODE_MAP` JSON (Class auto-created best-effort), now editable in-app on Settings → Integrations. Unmapped codes fall back to the transaction default. The same map drives the job-cost **pull** (§12). *Remaining:* populate the map for each realm (chart-of-accounts data). |
| **G13** | ✅ done | ~~Header sync sends one lump-sum line; SOV `qty/uom/unit_cost` dropped.~~ | **Implemented:** `buildBillLine`/`buildItemLine` emit one QBO line per SOV item; `Qty`/`UnitPrice` preserved when `qty*unitCost ≈ amount`. Falls back to a single lump-sum line when the SOV is empty. |
| **G9** | ✅ done | ~~`TxnDate = today` ignores real document dates.~~ | **Implemented:** subcontract Bill `TxnDate=start_date` + `DueDate=estimated_completion`; PO `TxnDate=issued_on_date\|\|contract_date` + `DueDate=delivery_date`; prime Invoice already used `start_date`/`estimated_completion_date`. |
| **G10** | ✅ done | ~~Retainage only in `PrivateNote`.~~ | **Implemented:** AR invoices withhold per-line retainage as a negative "Retainage" item line; AP bills withhold `billed × default_retainage%` as a negative account line (config-gated on the retainage accounts). **Stored materials** now bill as a dedicated "Materials presently stored" line. |
| **G3** | ✅ done | ~~Project not mapped → costs/revenue not job-tracked.~~ | **Implemented (Class strategy + explicit pin):** every posting line falls back to a Class named after the project (auto-created best-effort; omitted in realms without class tracking; disable with `QBO_PROJECT_TRACKING=none`). For the read-direction pull, the project is pinned to an explicit QBO **Project**/Customer (`projects.qbo_customer_id`, migration `163`). Customer:Job *posting* remains a future option. |
| **G8** | ✅ done | ~~Commitments post original; prime posts revised. Inconsistent.~~ | **Implemented:** both post **revised** (original + approved COs) on the lump-sum fallback; SOV totals govern when an SOV exists. |
| **G11** | ✅ done | ~~`status` (`void`/`terminated`) doesn't void the QBO doc.~~ | **Implemented:** subcontract Bill → `operation=delete` (QBO Bills can't be voided), PO → `POStatus=Closed`, prime Invoice → `operation=void`. Local refs cleared on delete; never-synced void records are skipped. |
| **G6** | ✅ done | ~~`payment_terms` unmapped.~~ | **Implemented:** exact-name match to an active QBO **Term** → `SalesTermRef` on Bill/PO (QBO derives `DueDate` from the Term). Unmatched terms are preserved in `PrivateNote`. No auto-create. |
| **G7** | ✅ done | ~~`DocNumber` can collide across projects in one realm.~~ | **Implemented (opt-in):** `QBO_DOC_NUMBER_PREFIX=project` → `{project_number}-{number}`; any other value is a literal prefix. 21-char cap enforced. |
| **G12** | ✅ done | ~~PO `ship_to`/`ship_via`/`bill_to` unmapped.~~ | **Implemented:** `ship_to` → `ShipAddr` Line1–Line5; `ship_via`/`bill_to` → `PrivateNote` (no reliable structured QBO fields). |
| **CO** | ✅ done | ~~`change_orders` (`erp_status` exists) never pushed to QBO.~~ | **Implemented:** `syncChangeOrderToQBO` posts each approved CO as its own Bill (subcontract CCO) / PurchaseOrder (PO CCO) / Invoice (PCCO) with full SOV + budget-code refs and void/close handling; idempotency + feedback columns in migration `164`. See §4.6. |
| **CUR/TAX** | P2 | No currency/tax handling. | Add `CurrencyRef` and `TxnTaxDetail`/`TaxCodeRef` for multi-currency / taxable realms. |
| **ATT** | P2 | Attachments not synced. | Optionally push PDFs via the QBO `Attachable` API. |

---

## 8. QBO required-field matrix (create)

| QBO entity | Required on create | Provided today? |
|---|---|---|
| `Bill` | `VendorRef`, ≥1 `Line` with `DetailType` + `Amount` + detail | ✅ Vendor by Id; valid expense account (G2/G4 done). |
| `PurchaseOrder` | `VendorRef`, ≥1 `Line` (`ItemBasedExpenseLineDetail` needs valid `ItemRef`) | ✅ Vendor by Id; resolved Item (G2/G4 done). |
| `Invoice` | `CustomerRef`, ≥1 `Line` (`SalesItemLineDetail` needs valid `ItemRef`) | ✅ Customer by Id; resolved Item (G2/G4 done). |
| `Vendor` | `DisplayName` (unique) | ✅ created on demand (G2). |
| `Customer` | `DisplayName` (unique) | ✅ created on demand (G2). |

---

## 9. Validation & error handling

- Pre-flight: AP sync requires ≥1 SOV line with `billed_to_date > 0`; AR sync requires
  ≥1 line with `work_completed_this_period > 0` (else `422`).
- QBO faults are parsed from `Fault.Error[0].Detail|Message` (`extractQBOError`).
- Each attempt writes `erp_sync_logs` with the raw response (first 8 KB).
- **Recommended additions:** validate `*Ref` Ids and the default account/item against the
  realm at connect time; surface the QBO fault detail in the UI; fail fast with a clear
  message when the default expense account/item is unset (G4).

## 10. Open decisions (need product/accounting sign-off)

1. **G1** — subcontract = `PurchaseOrder` (commitment) or `Bill` (payable)?
2. ~~**G8** — header amount = original or revised?~~ **Decided: revised** (original +
   approved COs) for both commitments and prime contracts.
3. **Config to populate per realm** — the *mechanisms* for G4/G5/G10 ship, but each realm
   must supply its own chart-of-accounts values: `QBO_AP_EXPENSE_ACCOUNT`,
   `QBO_DEFAULT_ITEM`, the `QBO_BUDGET_CODE_MAP` (budget code → account/class/item), and the
   retainage accounts. Until set, the integration uses safe auto-detected/default targets and
   omits retainage.
4. ~~**G3** — job costing via Customer:Job vs Class.~~ **Decided: Class** (project-named
   Class fallback per line; `QBO_PROJECT_TRACKING=none` to disable). Customer:Job can be
   layered later without schema changes.
5. ~~Push vs two-way sync.~~ Push remains the write direction; **accounting feedback now
   flows back** (totals / balances / payment status — see §11) and **job-to-date actual
   costs are pulled into the budget** (see §12). Full two-way *record* sync (creating
   SiteCommand records from QBO-originated documents) is still out of scope.

## 11. Accounting feedback pulled back from QBO (read direction)

Migration `161_erp_accounting_feedback_columns.sql` adds columns that hold what QBO
reports about each synced document, so accounting state is visible inside SiteCommand:

| SiteCommand column | Source | Meaning |
|---|---|---|
| `commitments.qbo_vendor_id` / `prime_contracts.qbo_customer_id` | resolved on sync | The QBO master-record Id actually used. |
| `…qbo_total_amount` | `TotalAmt` | Document total as QBO computed it. |
| `…qbo_balance` | `Balance` | Open (unpaid) balance. |
| `…qbo_payment_status` | derived | `paid` / `partially_paid` / `unpaid` (posting docs); lowercased `POStatus` (`open`/`closed`) for POs. |
| `commitments.qbo_ap_invoice_total_amount` / `_balance` / `_payment_status` | AP Bill | Same trio for the SOV-billing Bill. |
| `prime_contracts.qbo_ar_invoice_total_amount` / `_balance` / `_payment_status` | AR Invoice | Same trio for the SOV-billing Invoice. |
| `…qbo_payments_refreshed_at` | — | Last time the feedback was read. |

How the fields stay current:

1. **Every push sync** parses the create/update response (`extractFinancials`) and stores
   the trio alongside `qbo_id`.
2. **Manual refresh** — `POST /api/integrations/quickbooks/refresh`
   `{ recordType: "commitments" | "prime_contracts", recordId }` re-reads the header doc and
   the AP/AR invoice doc via `fetchQBOEntityFinancials` (surfaced as **Refresh payment
   status** in the Accounting section of the commitment / prime-contract detail pages).
3. **Cron refresh pass** — the daily `quickbooks-sync` cron walks up to 25 synced
   records per table per company (stalest `qbo_payments_refreshed_at` first) so payments
   applied entirely inside QBO surface within a day without any local edit.

## 12. Job-to-date (actual) costs pulled into the Budget (read direction)

The second read-direction flow. **Resync with ERP** on the Budget tool pulls each budget
line's actual cost from QBO into `budget_line_items.job_to_date_costs`, matched by
**budget code** (`budget_line_items.cost_code` — the same key that joins budget ↔
commitments). Entry point: `fetchQBOJobToDateCosts` in `lib/quickbooks.ts`, driven by
`POST /api/integrations/erp/resync-budget` `{ projectId }`.

**One ERP at a time.** A company may connect **either** QuickBooks Online **or** Sage 300
CRE, not both. The connect routes block a second connection; `resync-budget` returns `422`
when both (legacy) or neither is connected. `GET /api/integrations/erp/status` returns the
single connected ERP so the Budget UI can label/disable the button.

Two pull paths coexist, chosen **per budget code** from its `QBO_BUDGET_CODE_MAP` entry:

| Path | When | How the number is sourced |
|---|---|---|
| **Items-based** (preferred, GC-standard) — `pullByItem` | entry has `item`, **or** the code is unmapped (the QBO Item name/number is assumed to equal the budget code) | Resolves the project to a QBO Customer/Project Id (pinned `projects.qbo_customer_id` first, else `findCustomerIdByName` — Projects-first, then Customer, then `:<name>` sub-customer). Reads all **paid** `Bill`s (`isPaidQBOBill`: `Balance≈0` or a `BillPaymentCheck` `LinkedTxn`), and sums each `ItemBasedExpenseLineDetail.Amount` whose `CustomerRef` matches the project, grouped by `ItemRef`. The Item's total is attributed back to the code that maps to it. |
| **Account-based** (legacy) — `pullByAccount` | entry has only `account` | Reads a `ProfitAndLoss` summary scoped to the project's **Class** (`classid`, resolved read-only via `findClassIdByName`; skipped when `QBO_PROJECT_TRACKING=none`) and sums each leaf account row, attributing each Account total back to its code. |

Both paths run in the same resync when the map mixes item- and account-only codes; their
results merge. A target shared by **more than one** budget code (one Item or Account mapped
to ≥2 codes) is **skipped as ambiguous** rather than mis-attributed. Amounts are `abs()`-
normalized and rounded to cents.

**Outcome & matching.** `resync-budget` updates `job_to_date_costs` for every budget line
whose `cost_code` equals a returned code, and responds `{ ok, erp, matched, updated,
warning? }`. Warnings (no map configured, no matching QBO Project/Customer, no paid Bill
item lines, no project Class) are surfaced to the user but are **not** errors — they leave
existing values untouched. Every run writes an `erp_sync_logs` row
(`record_type='budget_job_to_date'`, `integration='quickbooks'|'sage300cre'`).

> Sage 300 CRE uses native job costing instead of these two paths
> (`fetchSage300CreJobToDateCosts`: resolve the Sage **job**, read its **cost codes**, pull
> each code's actual amount). See `docs/sage-300-cre-integration.md`.
