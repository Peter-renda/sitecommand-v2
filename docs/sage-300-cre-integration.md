# Sage 300 CRE Integration (via Agave)

SiteCommand syncs commitments and prime contracts to **Sage 300 CRE**
(Construction & Real Estate, formerly Timberline). Sage 300 CRE is an
on-premise Windows accounting system with **no native cloud REST API**, so —
unlike the QuickBooks Online, Xero, and Sage Intacct integrations, which call a
vendor cloud API directly — SiteCommand reaches Sage 300 CRE through
[**Agave**](https://www.agaveapi.com), a unified connector that runs a small
agent on the customer's Sage server and exposes a normalized cloud REST API.

```
SiteCommand (Vercel)  ──HTTPS──▶  Agave Unified API  ──on-prem agent──▶  Sage 300 CRE
```

> **Not the linked SDK.** The `SageNADev/Sage300-SDK` repository is the *Sage 300
> (Accpac) Web SDK* — a toolkit for building web UI screens **inside** Sage 300,
> a different product from Sage 300 CRE, and it exposes no external data API. It
> cannot be called from a cloud app. Agave is the connectivity layer for the
> real on-premise Sage 300 CRE product.

---

## Authentication model (Agave)

| Credential | Scope | Where it's stored | Header sent to Agave |
|---|---|---|---|
| **Client ID** | SiteCommand's Agave app | `company_integrations` → `platform_settings` → env (`SAGE300CRE_CLIENT_ID`) | `Client-Id` |
| **Client Secret** | SiteCommand's Agave app | same precedence (`SAGE300CRE_CLIENT_SECRET`) | `Client-Secret` |
| **Account Token** | One company's connected Sage 300 CRE | `company_integrations` (`SAGE300CRE_ACCOUNT_TOKEN`) | `Account-Token` |
| API version | constant | `lib/sage300cre.ts` | `API-Version: 2021-11-21` |

App credentials resolve company → platform → env (mirroring `lib/quickbooks.ts`),
so a company can register its own Agave app, or the site admin can configure a
shared one under **Settings → Integrations → Sage 300 CRE — Agave App
Credentials**. The Account Token is always per-company.

## Connecting (Agave Link)

Settings → Integrations → **Sage 300 CRE** (Company Super Admin):

1. **Step 1 — Agave app credentials.** Enter the Agave **Client ID** and
   **Client Secret** and save.
2. **Step 2 — Connect.** Click **Generate Agave Link token**
   (`POST /api/integrations/sage300cre/connect` → Agave `POST /link/token/create`).
   Open [Agave Link](https://docs.agaveapi.com/agave-link/quickstart) with that
   token, authenticate the on-premise Sage 300 CRE connector, and choose **Sage
   300 CRE** as the source system. Paste the **public token** Agave returns and
   click **Complete connection**
   (`POST /api/integrations/sage300cre/exchange` → Agave `POST /link/token/exchange`),
   which stores the durable Account Token.
   - **Fallback:** if you already hold an Account Token, expand *"Or paste an
     Account Token directly"* and save it.
3. **Disconnect** clears the stored Account Token (`POST /api/integrations/sage300cre/disconnect`);
   app credentials are kept so you can reconnect.

## What syncs

| SiteCommand record | Agave resource | Endpoint |
|---|---|---|
| Commitment (subcontract or PO) | Purchase Order | `POST/PUT /purchase-orders` |
| Commitment SOV billed-to-date | AP Invoice | `POST/PUT /ap-invoices` |
| Prime contract | AR Invoice | `POST/PUT /ar-invoices` |
| Prime contract SOV this-period | AR Invoice | `POST/PUT /ar-invoices` |

- **Vendors/customers are resolved by name** against the Sage 300 CRE company
  (`GET /vendors`, `GET /customers`). Sage 300 CRE is the system of record for
  parties, so a sync **fails with a clear message** if the vendor/customer does
  not already exist there — SiteCommand never auto-creates GL parties.
- **Job costing.** The SiteCommand project resolves to a Sage 300 CRE **job**
  (`GET /jobs`, matched by project number first, then project name) and SOV
  budget codes resolve to Sage **cost codes** (`GET /cost-codes`, exact code
  match then name). When resolved, the header and every line item carry
  `job_id` / `cost_code_id`; unresolved values are simply omitted (the budget
  code stays readable in the line description either way:
  `"03-100 — Footings"`). Like parties, jobs and cost codes are never
  auto-created — Sage is the system of record.
- **Line detail.** When a line's `qty × unit cost` is consistent with its
  amount, the line item also carries `quantity`, `unit_cost`, and
  `unit_of_measure`.
- **Dates & amounts.** Purchase orders post the **revised** amount (original +
  approved COs) with `due_date` from the delivery date (or estimated
  completion); AR invoices for prime contracts carry `due_date` from the
  estimated completion date.
- **Retention.** AP invoices send `retention_amount` (billed × the
  commitment's default retainage %); AR invoices roll per-line retainage up to
  the header `retention_amount`.
- **AR support is connector-dependent.** Agave's construction surface is
  AP-centric; if the configured Sage 300 CRE connector doesn't expose
  `/ar-invoices`, prime-contract/AR syncs surface the Agave error in the logs
  (the AP/commitment side is the primary, always-supported path).

## Sync surfaces

- **Manual:** a **Sync to Sage 300 CRE** button on the commitment and prime
  contract detail headers → `POST /api/integrations/sage300cre/sync`
  with `{ recordType: "commitments" | "prime_contracts" | "ap_invoice" | "ar_invoice", recordId }`.
- **Cron:** `GET /api/cron/sage300cre-sync`, daily at 18:00 UTC
  (`vercel.json`), `CRON_SECRET`-gated. Pushes "dirty" rows — those whose
  `updated_at` is newer than `sage300cre_synced_at`, or never synced — capped at
  25 per type per company.

## Idempotency

Migration `160_sage300cre_idempotency_columns.sql` adds:

- `commitments.sage300cre_id`, `sage300cre_synced_at`,
  `sage300cre_ap_invoice_id`, `sage300cre_ap_invoice_synced_at`
- `prime_contracts.sage300cre_id`, `sage300cre_synced_at`,
  `sage300cre_ar_invoice_id`, `sage300cre_ar_invoice_synced_at`

These live alongside the `qbo_*` columns so the same record can sync to
QuickBooks Online and Sage 300 CRE independently. Unlike QBO there is no
`*_sync_token` — Agave updates are `PUT /{resource}/{id}`. When an update returns
**404** (the record was deleted on the Sage side), the sync falls back to a
create so the record is rebuilt rather than lost.

## Accounting feedback (read direction)

Migration `161_erp_accounting_feedback_columns.sql` adds columns that hold what
Sage 300 CRE reports about each synced document:

- `commitments.sage300cre_vendor_id`, `sage300cre_status` (header PO status —
  POs are non-posting so no amounts), and
  `sage300cre_ap_invoice_total_amount` / `_amount_paid` / `_balance` / `_status`
  for the AP invoice.
- `prime_contracts.sage300cre_customer_id`,
  `sage300cre_total_amount` / `_amount_paid` / `_balance` / `_status` for the
  header AR invoice, and the same quartet under `sage300cre_ar_invoice_*` for
  the SOV-billing invoice.
- `…sage300cre_payments_refreshed_at` — last time the feedback was read.

The fields stay current three ways: every push sync parses the Agave response
(`amount` / `amount_paid` / `balance` / `status`, accepting both bare and
`data`-wrapped shapes); `POST /api/integrations/sage300cre/refresh`
`{ recordType, recordId }` re-reads on demand (the **Refresh payment status**
button in the Accounting section of the detail pages); and the daily cron walks
up to 25 synced records per table per company (stalest first) so payments
entered in Sage surface within a day.

## Pull direction: job-to-date costs → Budget

The integration is two-way for budget actuals. The Budget tool's **Resync with
ERP** button (`POST /api/integrations/erp/resync-budget`) pulls **job-to-date
(actual) costs** out of Sage 300 CRE and writes them into each budget line's
**Job to Date Costs** column, matched by budget code.

- Sage 300 CRE is a true job-cost system, so the pull resolves the project to a
  Sage **job** (`resolveSage300CreJobId`), reads that job's **cost codes**
  (`GET /cost-codes?job_id=…`), and pulls each code's **actual** amount. The
  actual-cost field name is connector-dependent, so several keys are probed
  (`actual_cost`, `actual_amount`, `cost_to_date`, …); when the connector exposes
  none, nothing is written and a warning is returned.
- Sage cost codes are matched to SiteCommand budget codes by code, then by name.
- A company may connect **only one** ERP (Sage 300 CRE **or** QuickBooks).
  Connecting Sage 300 CRE is blocked while QuickBooks is connected, and vice versa.

## Logs

Every attempt is written to `erp_sync_logs` with `integration = 'sage300cre'`.
Per-record history: `GET /api/integrations/sage300cre/logs?recordType=…&recordId=…`.
The budget pull logs as `record_type = 'budget_job_to_date'`.

## Environment variables (optional)

| Var | Purpose | Default |
|---|---|---|
| `SAGE300CRE_CLIENT_ID` / `SAGE300CRE_CLIENT_SECRET` | Fallback Agave app credentials | — |
| `SAGE300CRE_ACCOUNT_TOKEN` | Fallback account token (single-tenant/dev) | — |
| `AGAVE_API_BASE` | Override the Agave REST base | `https://api.agaveapi.com` |
| `AGAVE_API_VERSION` | Override the Agave `API-Version` header | `2021-11-21` |
| `CRON_SECRET` | Secures the daily cron | — |

## Verification

Offline check (mocked fetch — no Agave credentials or network needed):

```
npx tsx scripts/sage300cre-integration-check.ts
```

It asserts the required Agave headers + base URL, the Link create/exchange flow,
vendor resolution and the "vendor not found" guard, the Purchase Order create
payload, idempotent `PUT` updates with 404 → recreate fallback, and the AR
invoice revised-amount mapping. Run it after touching `lib/sage300cre.ts`.
