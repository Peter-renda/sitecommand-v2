# ERP Data Mapping Charts

Visual reference for all field-level data flows between SiteCommand and its two ERP integrations.

> Legend: **→** push (SiteCommand → ERP) · **←** pull (ERP → SiteCommand) · ✅ mapped · ⚠️ mapped with caveats · ❌ gap/not mapped · 🔭 future

---

## QuickBooks Online (QBO)

### Entity Crosswalk

```
SiteCommand                         Direction    QBO Entity
──────────────────────────────────  ─────────    ──────────────────────────
commitments (type='subcontract')    ──────────→  Bill  (Accounts Payable)
commitments (type='purchase_order') ──────────→  PurchaseOrder  (non-posting)
prime_contracts                     ──────────→  Invoice  (Accounts Receivable)
commitment SOV billed-to-date       ──────────→  Bill  (AP invoice)
prime contract SOV this-period      ──────────→  Invoice  (AR invoice)
directory_contacts (vendor)         ──── ←→ ───  Vendor  (master data)
directory_contacts (owner/client)   ──── ←→ ───  Customer  (master data)
budget_line_items.job_to_date_costs ←─────────── P&L Report / Cost Codes
```

---

### Push Maps (SiteCommand → QBO)

#### Subcontract → Bill

| SiteCommand Field | QBO Bill Field | Transform | Status |
|---|---|---|---|
| `commitments.contract_company` | `VendorRef.value` (Id) | Resolve by name, auto-create if absent | ✅ |
| `commitments.number` | `DocNumber` | String; optional project-number prefix (21-char cap) | ✅ |
| `commitments.title` | `PrivateNote` | Direct | ✅ |
| `commitments.start_date` | `TxnDate` | YYYY-MM-DD | ✅ |
| `commitments.estimated_completion_date` | `DueDate` | YYYY-MM-DD, omit if null | ✅ |
| `commitments.payment_terms` | `SalesTermRef` | Exact-name match to active QBO Term; unmatched → `PrivateNote` | ✅ |
| SOV line `description` | `Line[n].Description` | One line per SOV item | ✅ |
| SOV line `billed_to_date` | `Line[n].Amount` | `Number(toFixed(2))` | ✅ |
| SOV line `qty` / `unit_cost` | `Line[n].Qty` / `UnitPrice` | Only when `qty × unit_cost ≈ amount` | ✅ |
| SOV line `budget_code` | `Line[n].AccountRef` / `ClassRef` / `ItemRef` | Via `QBO_BUDGET_CODE_MAP`; falls back to defaults | ✅ |
| Project name | `Line[n].ClassRef` | Auto-created Class per project | ✅ |
| `commitments.default_retainage` | Negative retainage line → `QBO_RETAINAGE_PAYABLE_ACCOUNT` | `billed × retainage%` | ✅ |
| `status = 'void'/'terminated'` | Bill → **delete** | QBO Bills cannot be voided; deletion clears `qbo_id` | ✅ |
| (revised amount = original + approved COs) | Lump-sum fallback `Line[0].Amount` | Used when SOV is empty | ✅ |
| `change_orders` | — | Not synced | 🔭 |
| Tax / currency | — | Not synced | 🔭 |

---

#### Purchase Order → PurchaseOrder

| SiteCommand Field | QBO PurchaseOrder Field | Transform | Status |
|---|---|---|---|
| `commitments.contract_company` | `VendorRef.value` | Resolve / auto-create | ✅ |
| `commitments.number` | `DocNumber` | String; optional prefix | ✅ |
| `commitments.title` | `PrivateNote` + `Line[0].Description` | Direct | ✅ |
| `commitments.issued_on_date` \|\| `contract_date` | `TxnDate` | YYYY-MM-DD | ✅ |
| `commitments.delivery_date` | `DueDate` | YYYY-MM-DD | ✅ |
| `commitments.ship_to` | `ShipAddr` (Line1–Line5) | Parsed address | ✅ |
| `commitments.ship_via` | `PrivateNote` | Appended | ✅ |
| `commitments.bill_to` | `PrivateNote` | Appended | ✅ |
| `commitments.payment_terms` | `SalesTermRef` | Exact-name match | ✅ |
| SOV line `description` | `Line[n].Description` | One line per SOV item | ✅ |
| SOV line amount | `Line[n].Amount` / `UnitPrice` (Qty 1) | `toFixed(2)` | ✅ |
| SOV line `budget_code` | `Line[n].ItemRef` / `ClassRef` | Via `QBO_BUDGET_CODE_MAP` | ✅ |
| Project name | `Line[n].ClassRef` | Auto-created Class | ✅ |
| `status = 'void'` | `POStatus = Closed` | Does not delete | ✅ |
| (revised amount) | Lump-sum fallback | When SOV is empty | ✅ |

---

#### Prime Contract → Invoice (A/R)

| SiteCommand Field | QBO Invoice Field | Transform | Status |
|---|---|---|---|
| `prime_contracts.owner_client` | `CustomerRef.value` | Resolve / auto-create | ✅ |
| `prime_contracts.contract_number` | `DocNumber` | String | ✅ |
| `prime_contracts.start_date` | `TxnDate` | YYYY-MM-DD | ✅ |
| `prime_contracts.estimated_completion_date` | `DueDate` | Omit if null | ✅ |
| `prime_contracts.title` | `Line[0].Description` | Direct | ✅ |
| `prime_contracts.description` \|\| `title` | `CustomerMemo.value` | Direct | ✅ |
| `prime_contracts.description`, `contractor`, `architect_engineer`, `default_retainage`, `executed`, `status` | `PrivateNote` | Multi-line, free-text | ✅ |
| original amount + approved COs | `Line[0].Amount` / `UnitPrice` (Qty 1) | Revised total | ✅ |
| SOV line `budget_code` | `Line[n].ItemRef` / `ClassRef` | Via `QBO_BUDGET_CODE_MAP` | ✅ |
| Project name | `Line[n].ClassRef` | Auto-created Class | ✅ |
| `prime_contracts.default_retainage` | Negative retainage line → `QBO_RETAINAGE_RECEIVABLE_ACCOUNT` | Per-line retainage withheld | ✅ |
| SOV `materials_stored` | "Materials presently stored" line | Dedicated line | ✅ |
| `status = 'void'` | Invoice → **void** | QBO void operation | ✅ |

---

#### AP Invoice (Commitment SOV billed-to-date) → Bill

| SiteCommand Field | QBO Bill Field | Transform | Status |
|---|---|---|---|
| `commitments.contract_company` | `VendorRef.value` | Resolve / auto-create | ✅ |
| `commitments.number` | `DocNumber` | String | ✅ |
| `commitments.title` | `PrivateNote` | Direct | ✅ |
| SOV `description` | `Line[n].Description` | Lines where `billed_to_date > 0` | ✅ |
| SOV `billed_to_date` | `Line[n].Amount` | `Number(...)` | ✅ |
| SOV `qty` / `uom` / `unit_cost` | `Qty` / `UnitPrice` / `UOM` | When `qty × unit_cost ≈ amount` | ✅ |
| SOV `budget_code` | `AccountRef` / `ClassRef` | Via `QBO_BUDGET_CODE_MAP` | ✅ |
| `commitments.default_retainage` | Negative retainage line | `billed × retainage%` | ✅ |

---

#### AR Invoice (Prime SOV this-period) → Invoice (A/R)

| SiteCommand Field | QBO Invoice Field | Transform | Status |
|---|---|---|---|
| `prime_contracts.owner_client` | `CustomerRef.value` | Resolve / auto-create | ✅ |
| `prime_contracts.contract_number` | `DocNumber` | String | ✅ |
| `prime_contracts.title` | `PrivateNote` | Direct | ✅ |
| SOV `description` | `Line[n].Description` | Lines where `work_completed_this_period > 0` | ✅ |
| SOV `work_completed_this_period` | `Line[n].Amount` / `UnitPrice` (Qty 1) | `Number(...)` | ✅ |
| SOV `budget_code` | `ClassRef` / `ItemRef` | Via `QBO_BUDGET_CODE_MAP` | ✅ |
| SOV retainage per line | Rolled-up negative retainage line | Per-line retainage withheld | ✅ |

---

### Pull Map (QBO → SiteCommand)

#### QBO P&L Report → Budget Line Items (Job-to-Date Costs)

| QBO Source | SiteCommand Field | Match Key | Method |
|---|---|---|---|
| P&L Detail report rows — by **Item** (recommended) | `budget_line_items.job_to_date_costs` | `QBO_BUDGET_CODE_MAP` entry `item` → budget code | `reports/ProfitAndLossDetail?customer={projectId}` scoped to project Customer / Class |
| P&L Summary report rows — by **Account** (legacy) | `budget_line_items.job_to_date_costs` | `QBO_BUDGET_CODE_MAP` entry `account` → budget code | `reports/ProfitAndLoss?classid={classId}` scoped to project Class |

Per-project QBO Customer/Project override: `projects.qbo_customer_id` (set in Project Admin → ERP Integration).

---

### Accounting Feedback (QBO → SiteCommand, read direction)

| QBO Response Field | SiteCommand Column | Applies To |
|---|---|---|
| `TotalAmt` | `qbo_total_amount` | commitments, prime_contracts |
| `Balance` | `qbo_balance` | commitments, prime_contracts |
| Derived from Balance/Total | `qbo_payment_status` (`paid` / `partially_paid` / `unpaid`) | commitments, prime_contracts |
| `POStatus` (lowercase) | `qbo_payment_status` (`open` / `closed`) | purchase orders |
| Resolved QBO Vendor Id | `commitments.qbo_vendor_id` | commitments |
| Resolved QBO Customer Id | `prime_contracts.qbo_customer_id` | prime_contracts |
| AP Bill `TotalAmt` / `Balance` | `qbo_ap_invoice_total_amount` / `_balance` / `_payment_status` | commitments |
| AR Invoice `TotalAmt` / `Balance` | `qbo_ar_invoice_total_amount` / `_balance` / `_payment_status` | prime_contracts |

---

### Vendor / Customer Auto-Enrichment (on create)

| SiteCommand `directory_contacts` Field | QBO Vendor Field | QBO Customer Field |
|---|---|---|
| `company` | `CompanyName` | `CompanyName` |
| `email` | `PrimaryEmailAddr.Address` | `PrimaryEmailAddr.Address` |
| `phone` / `business_phone` | `PrimaryPhone.FreeFormNumber` | `PrimaryPhone.FreeFormNumber` |
| `business_fax` | `Fax.FreeFormNumber` | `Fax.FreeFormNumber` |
| `website` | `WebAddr.URI` | `WebAddr.URI` |
| `city` / `state` / `zip` / `country` | `BillAddr.{City, CountrySubDivisionCode, PostalCode, Country}` | `BillAddr.{...}` |

---

### Idempotency & Sync State Columns (QBO)

| SiteCommand Column | Purpose |
|---|---|
| `commitments.qbo_id` | QBO Bill / PurchaseOrder Id |
| `commitments.qbo_sync_token` | Optimistic-lock token (re-fetched before every update) |
| `commitments.qbo_ap_invoice_id` + `_sync_token` + `_synced_at` | SOV-billing Bill |
| `prime_contracts.qbo_id` | QBO Invoice Id |
| `prime_contracts.qbo_ar_invoice_id` + `_sync_token` + `_synced_at` | SOV-billing Invoice |
| `…last_synced_at` / `…updated_at` | Dirty-row detection for daily cron |
| `erp_sync_logs` (`integration='quickbooks'`) | Per-attempt audit log |

---
---

## Sage 300 CRE (via Agave)

### Architecture

```
SiteCommand (Vercel)  ──HTTPS──▶  Agave Unified API  ──on-prem agent──▶  Sage 300 CRE (Windows)
```

All communication passes through Agave's normalized REST layer. Sage 300 CRE has no native cloud API.

---

### Entity Crosswalk

```
SiteCommand                          Direction    Agave / Sage 300 CRE Resource
───────────────────────────────────  ─────────    ──────────────────────────────
commitments (subcontract or PO)      ──────────→  Purchase Order  (/purchase-orders)
commitment SOV billed-to-date        ──────────→  AP Invoice  (/ap-invoices)
prime_contracts                      ──────────→  AR Invoice  (/ar-invoices)
prime contract SOV this-period       ──────────→  AR Invoice  (/ar-invoices)
budget_line_items.job_to_date_costs  ←─────────── Job Cost Codes  (/cost-codes?job_id=…)
```

> **Note:** AR support is connector-dependent. Agave's construction surface is AP-centric. If the customer's Sage connector doesn't expose `/ar-invoices`, prime-contract/AR syncs surface the Agave error in logs; the AP/commitment path is always supported.

---

### Push Maps (SiteCommand → Sage 300 CRE)

#### Commitment (subcontract or PO) → Purchase Order

| SiteCommand Field | Agave PurchaseOrder Field | Transform | Status |
|---|---|---|---|
| `commitments.contract_company` | `vendor_id` | Resolved by name via `GET /vendors`; **fails fast if not found** (no auto-create) | ✅ |
| `commitments.number` | `number` / `doc_number` | Direct | ✅ |
| `commitments.title` | `description` | Direct | ✅ |
| Revised amount (original + approved COs) | `amount` | `toFixed(2)` | ✅ |
| `commitments.delivery_date` \|\| `estimated_completion_date` | `due_date` | YYYY-MM-DD | ✅ |
| Project → Sage job | `job_id` (header + per line) | `GET /jobs` — matched by project number, then project name; omitted if unresolved | ✅ |
| SOV `budget_code` → Sage cost code | `cost_code_id` (per line) | `GET /cost-codes?job_id=…` — matched by code, then name; omitted if unresolved | ✅ |
| SOV `description` | Line `description` | `"{budget_code} — {description}"` fallback if unresolved | ✅ |
| SOV line `qty` × `unit_cost` ≈ `amount` | `quantity` / `unit_cost` / `unit_of_measure` | Only when consistent | ✅ |

---

#### Commitment SOV Billed-to-Date → AP Invoice

| SiteCommand Field | Agave AP Invoice Field | Transform | Status |
|---|---|---|---|
| `commitments.contract_company` | `vendor_id` | Resolved by name; fails fast if not found | ✅ |
| `commitments.number` | `purchase_order_number` | Reference to parent PO | ✅ |
| SOV lines `billed_to_date > 0` | Invoice lines `amount` | `Number(...)` per line | ✅ |
| SOV `budget_code` → Sage cost code | `cost_code_id` per line | Same resolution as PO | ✅ |
| Project → Sage job | `job_id` | Same resolution as PO | ✅ |
| `commitments.default_retainage` | `retention_amount` | `billed × retainage%` | ✅ |
| SOV `qty` / `unit_cost` / `uom` | `quantity` / `unit_cost` / `unit_of_measure` | When `qty × unit_cost ≈ amount` | ✅ |

---

#### Prime Contract → AR Invoice

| SiteCommand Field | Agave AR Invoice Field | Transform | Status |
|---|---|---|---|
| `prime_contracts.owner_client` | `customer_id` | Resolved by name via `GET /customers`; fails fast if not found | ✅ |
| `prime_contracts.contract_number` | `number` | Direct | ✅ |
| `prime_contracts.title` | `description` | Direct | ✅ |
| Revised amount (original + approved COs) | `amount` | `toFixed(2)` | ✅ |
| `prime_contracts.estimated_completion_date` | `due_date` | YYYY-MM-DD | ✅ |
| Project → Sage job | `job_id` | Same resolution as PO | ✅ |
| SOV lines `work_completed_this_period > 0` | Invoice lines `amount` | Per line | ✅ |
| SOV per-line retainage → rolled up | `retention_amount` | Sum of per-line retainage | ✅ |
| AR support | — | Connector-dependent; logs Agave error if unsupported | ⚠️ |

---

### Pull Map (Sage 300 CRE → SiteCommand)

#### Job Cost Codes → Budget Line Items (Job-to-Date Costs)

| Sage 300 CRE Source | SiteCommand Field | Match Key | Notes |
|---|---|---|---|
| Sage job resolved from project | — | Project number first, then project name | `GET /jobs` |
| `GET /cost-codes?job_id=…` → actual cost field | `budget_line_items.job_to_date_costs` | Sage cost code matched to SiteCommand budget `cost_code` by code, then by name | Field name probed: `actual_cost`, `actual_amount`, `cost_to_date`, etc. (connector-dependent) |

Triggered by: **Resync with ERP** button in the Budget tool → `POST /api/integrations/erp/resync-budget`.

---

### Accounting Feedback (Sage 300 CRE → SiteCommand, read direction)

| Agave Response Field | SiteCommand Column | Applies To |
|---|---|---|
| `status` | `commitments.sage300cre_status` | Commitment / PO header (non-posting — no amount) |
| Resolved Agave Vendor Id | `commitments.sage300cre_vendor_id` | commitments |
| AP Invoice `amount` | `sage300cre_ap_invoice_total_amount` | commitments |
| AP Invoice `amount_paid` | `sage300cre_ap_invoice_amount_paid` | commitments |
| AP Invoice `balance` | `sage300cre_ap_invoice_balance` | commitments |
| AP Invoice `status` | `sage300cre_ap_invoice_status` | commitments |
| Resolved Agave Customer Id | `prime_contracts.sage300cre_customer_id` | prime_contracts |
| AR Invoice header `amount` | `sage300cre_total_amount` | prime_contracts |
| AR Invoice header `amount_paid` | `sage300cre_amount_paid` | prime_contracts |
| AR Invoice header `balance` | `sage300cre_balance` | prime_contracts |
| AR Invoice header `status` | `sage300cre_status` | prime_contracts |
| SOV-billing AR Invoice `amount` | `sage300cre_ar_invoice_total_amount` | prime_contracts |
| SOV-billing AR Invoice `amount_paid` | `sage300cre_ar_invoice_amount_paid` | prime_contracts |
| SOV-billing AR Invoice `balance` | `sage300cre_ar_invoice_balance` | prime_contracts |
| SOV-billing AR Invoice `status` | `sage300cre_ar_invoice_status` | prime_contracts |

---

### Idempotency & Sync State Columns (Sage 300 CRE)

| SiteCommand Column | Purpose |
|---|---|
| `commitments.sage300cre_id` | Agave Purchase Order Id |
| `commitments.sage300cre_synced_at` | Timestamp of last successful push |
| `commitments.sage300cre_ap_invoice_id` + `_synced_at` | AP Invoice Id |
| `prime_contracts.sage300cre_id` | Agave AR Invoice Id (header) |
| `prime_contracts.sage300cre_synced_at` | Timestamp of last successful push |
| `prime_contracts.sage300cre_ar_invoice_id` + `_synced_at` | SOV-billing AR Invoice Id |
| `…sage300cre_payments_refreshed_at` | Last feedback refresh timestamp |
| `erp_sync_logs` (`integration='sage300cre'`) | Per-attempt audit log |

> **No SyncToken.** Unlike QBO, Agave updates use `PUT /{resource}/{id}`. A 404 on update triggers a fallback create so deleted records are rebuilt rather than lost.

---

### Key Behavioral Differences: QBO vs Sage 300 CRE

| Behavior | QuickBooks Online | Sage 300 CRE |
|---|---|---|
| **Vendor/Customer creation** | Auto-creates if not found, enriched from directory | **Fails fast** — Sage is system of record, no auto-create |
| **Job / Project tracking** | Class named after project (auto-created) | Resolves to existing Sage Job by project number/name |
| **Budget code → cost code** | `QBO_BUDGET_CODE_MAP` (JSON config) → Account/Class/Item | Resolves to existing Sage Cost Code by code/name |
| **Subcontract entity** | Bill (A/P posting) | Purchase Order (non-posting commitment) |
| **AR invoices** | Always supported (Invoice entity) | Connector-dependent; AP path always supported |
| **Sync token / update** | Re-fetch `SyncToken` → `POST ?operation=update` | `PUT /{resource}/{id}` — no token needed |
| **Deleted record on ERP side** | Clears `qbo_id`, recreates on next sync | 404 → fallback to create |
| **Pull direction** | P&L report per Item or Account scoped to project Customer/Class | Job cost codes scoped to resolved Sage Job |
| **Connectivity** | Direct HTTPS to Intuit cloud API | Via Agave on-prem agent → Sage Windows server |
| **Mutual exclusion** | Cannot connect while Sage 300 CRE is connected | Cannot connect while QBO is connected |
