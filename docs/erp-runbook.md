# ERP Integration Runbook

**Audience:** Support / on-call engineers responding to ERP sync failures.
**Scope:** QuickBooks Online (QBO) and Sage 300 CRE (via Agave).
**Companion docs:** [`erp-integration-spec.md`](./erp-integration-spec.md) · [`erp-onboarding-playbook.md`](./erp-onboarding-playbook.md) · [`erp-data-mapping-charts.md`](./erp-data-mapping-charts.md)

Each scenario below has **Symptom · Root Cause · Diagnosis · Resolution · Prevention**. Use Ctrl-F on the scenario IDs (`QBO-01`, `SAGE-05`, `SHARED-03`, …).

---

## 1. Quick Reference — Sync Status Indicators

| Where | Indicator | Meaning |
|---|---|---|
| Commitment / prime contract detail header | **erp_status** badge: `not_synced` | Never pushed. |
| | `pending` | Edited since last sync (dirty); cron will pick it up. |
| | `synced` | Header successfully pushed; `qbo_id`/`sage300cre_id` set. |
| Accounting section | `qbo_payment_status` / `sage300cre_status` | `paid` / `partially_paid` / `unpaid` (QBO posting docs); `open` / `closed` (QBO PO); raw Sage status string. |
| Sync button result toast | HTTP **422** | User-actionable (missing vendor/customer, missing SOV amounts, not connected). |
| | HTTP **502** | ERP-side fault (QBO Fault / Agave error). |
| | HTTP **500** | SiteCommand/DB error — usually a missing migration. |
| | HTTP **404** | Record not found locally. |

**HTTP status convention:** `422` = fix the data/config in SiteCommand. `502` = the ERP rejected it (read the embedded fault). `500` = our bug / missing column. Always read the message body — it is written to be actionable.

---

## 2. How to Read Sync Logs

Every sync attempt (manual, cron, or budget pull) writes one row to **`erp_sync_logs`**.

| Column | Meaning |
|---|---|
| `record_type` | `commitments` / `prime_contracts` / `ap_invoice` / `ar_invoice` / `budget_job_to_date` |
| `record_id` | Local UUID (the commitment / prime contract / project id) |
| `integration` | `quickbooks` / `sage300cre` |
| `result` | `success` / `error` |
| `sage_key` | The ERP document Id returned on success (Bill/PO/Invoice/AR-AP id) |
| `error_message` | Full error string on failure |
| `raw_response` | Raw ERP response body, truncated to 8 KB |
| `synced_at` | Timestamp (`now()` default) |

**In-app:** `GET /api/integrations/quickbooks/logs?recordType=…&recordId=…` and the Sage equivalent return the 10 most recent rows for a record.

**Most recent error for a record:**

```sql
select result, error_message, left(raw_response, 1000) as raw, synced_at
from erp_sync_logs
where record_type = 'commitments' and record_id = '<uuid>'
order by synced_at desc
limit 5;
```

---

## 3. QBO Failure Scenarios

### QBO-01 — Connect fails: `error=qbo_other_erp_connected`

- **Symptom:** Clicking *Connect QuickBooks* bounces back to Settings with `?error=qbo_other_erp_connected`.
- **Root cause:** Sage 300 CRE is already connected for this company. Only one ERP is allowed (mutual exclusion).
- **Diagnosis:** Check `GET /api/integrations/erp/status` → `connected` will be `sage300cre` or `multiple`. Or query:
  ```sql
  select key from company_integrations
  where company_id = '<uuid>' and key in ('QBO_REALM_ID','SAGE300CRE_ACCOUNT_TOKEN');
  ```
- **Resolution:** Disconnect Sage first (**Settings → Integrations → Sage 300 CRE → Disconnect**), then connect QBO.
- **Prevention:** Decide on one ERP per company during onboarding; document the choice.

### QBO-02 — Connect fails: `error=qbo_invalid_state` (CSRF mismatch)

- **Symptom:** OAuth returns to Settings with `?error=qbo_invalid_state`.
- **Root cause:** The `qbo_oauth_state` cookie nonce didn't match the `state` returned by Intuit. The cookie has a **600-second (10-min) TTL** — most often the user sat on the Intuit consent screen too long, or cookies were blocked/cleared, or they started the flow in one browser and finished in another.
- **Diagnosis:** Ask how long they took and whether they switched browsers/devices. Confirm third-party cookies aren't blocked for the app domain.
- **Resolution:** Retry the connect flow and complete it within 10 minutes in the same browser session.
- **Prevention:** Tell users to have their Intuit credentials ready before clicking Connect.

### QBO-03 — Connect fails: `error=qbo_token_exchange_failed`

- **Symptom:** Returns with `?error=qbo_token_exchange_failed&reason=…`.
- **Root cause:** Intuit rejected the authorization-code → token exchange. The single most common reason is a **redirect URI mismatch** — the `redirect_uri` sent must byte-for-byte match a URI registered on the Intuit app (scheme, host, path, trailing slash).
- **Diagnosis:** Read the `reason=` param (Intuit's `error_description`). Compare the app's registered redirect URI against the value SiteCommand computes — the settings GET returns it as the derived field `QBO_REDIRECT_URI`. Resolution order is `INTUIT_REDIRECT_URI` → `NEXT_PUBLIC_APP_URL + /api/integrations/quickbooks/callback` → request-derived.
- **Resolution:** Set `INTUIT_REDIRECT_URI` (or fix `NEXT_PUBLIC_APP_URL`) so it exactly equals the portal value, **or** add the computed URI to the Intuit app. Reconnect.
- **Prevention:** Pin `INTUIT_REDIRECT_URI` explicitly in production; never rely on request-derived.

### QBO-04 — Connect fails: `error=qbo_not_configured`

- **Symptom:** `?error=qbo_not_configured` immediately, before reaching Intuit.
- **Root cause:** No `QBO_CLIENT_ID` resolved (`company_integrations` → `platform_settings` → env all empty).
- **Diagnosis:**
  ```sql
  select key from company_integrations
  where company_id = '<uuid>' and key in ('QBO_CLIENT_ID','QBO_CLIENT_SECRET');
  ```
  Also check `platform_settings` and env.
- **Resolution:** Enter the Intuit app Client ID + Secret in **Settings → Integrations → QuickBooks Online** (or platform settings for a shared app), then connect.
- **Prevention:** Provision app credentials as the first onboarding step.

### QBO-05 — Sync fails: "No Contract Company" / "No Owner/Client" (422)

- **Symptom:** Sync toast shows `This commitment has no Contract Company, and QuickBooks requires a vendor on every Bill/Purchase Order…` or the prime-contract equivalent (`…no Owner/Client…requires a customer on every Invoice…`). HTTP 422, `validation: true`.
- **Root cause:** QBO requires a `VendorRef` on Bills/POs and a `CustomerRef` on Invoices. The source record has a blank party field.
- **Diagnosis:**
  ```sql
  select id, number, contract_company from commitments where id = '<uuid>';
  -- or
  select id, contract_number, owner_client from prime_contracts where id = '<uuid>';
  ```
- **Resolution:** Edit the record, set **Contract Company** (commitment) or **Owner/Client** (prime contract), re-sync.
- **Prevention:** Run the Data Readiness checklist before go-live; require these fields in the UI.

### QBO-06 — Sync fails: "No QBO expense account found"

- **Symptom:** `No QBO expense account found. Set QBO_AP_EXPENSE_ACCOUNT to a valid expense or COGS account.` (subcontract/AP Bill).
- **Root cause:** `findExpenseAccountId` couldn't resolve a configured account and the realm has **no active COGS/Expense account** to auto-detect (typical of a brand-new/empty QBO company).
- **Diagnosis:** In QBO, confirm the Chart of Accounts has at least one active account of type *Expense* or *Cost of Goods Sold*. Check whether `QBO_AP_EXPENSE_ACCOUNT` is set and matches an account name exactly.
- **Resolution:** Create an Expense/COGS account in QBO (or set `QBO_AP_EXPENSE_ACCOUNT` to an existing one by exact name), then re-sync.
- **Prevention:** Verify the CoA during onboarding; set `QBO_AP_EXPENSE_ACCOUNT` explicitly.

### QBO-07 — Sync fails: "Could not resolve or create QBO vendor/customer"

- **Symptom:** `Could not resolve or create QBO vendor "<name>": <detail>` (or customer). HTTP 502.
- **Root cause:** `findOrCreateVendorId`/`findOrCreateCustomerId` query `DisplayName = '<name>'` then attempt a create, and QBO rejected the create. Common reasons embedded in `<detail>`: duplicate name differing only by case/whitespace, name >500 chars, or a QBO **"Duplicate Name Exists Error"** where the name exists but is **inactive**.
- **Diagnosis:** Read `<detail>` (it's QBO's own fault message). In QBO, search Vendors/Customers (including inactive) for the name. Note `escapeQBOString` doubles single quotes, so apostrophes are handled — but leading/trailing spaces are not.
- **Resolution:** Reactivate the existing QBO party, or rename the SiteCommand `contract_company`/`owner_client` to match an active record exactly, then re-sync. If it was an inactive duplicate, reactivate it in QBO.
- **Prevention:** Keep directory contact names aligned with QBO master records.

### QBO-08 — Sync fails: generic QBO Fault (Intuit API error)

- **Symptom:** 502 with a message pulled from the QBO Fault (`extractQBOError` → `Fault.Error[0].Detail` → `.Message` → `message` → raw text → `Unknown QuickBooks error`).
- **Root cause:** Anything QBO rejects: validation, business rules, throttling.
- **Diagnosis:** Read `error_message` and `raw_response` in `erp_sync_logs`. Match the Detail against Intuit's error catalog. Watch for **throttle** ("Request limit exceeded") during large cron runs.
- **Resolution:** Fix per the Fault. For throttling, retry later (cron caps at 25/type/company per run, so it self-throttles). For business-rule rejections, correct the source data.
- **Prevention:** Keep records clean; rely on cron's caps rather than mass manual syncs.

### QBO-09 — Intermittent 401 Unauthorized (access-token expiry)

- **Symptom:** Occasional auth failures that succeed on retry; usually invisible to users.
- **Root cause:** QBO access tokens live ~1 hour. `callQBO` auto-refreshes once on 401 (via `refreshQBOTokens`) and persists the new tokens. A true failure means the **retry also failed**.
- **Diagnosis:** Look for repeated 401s in `raw_response`. If the refresh itself failed, the refresh token is the problem → see **QBO-10**.
- **Resolution:** Usually self-heals. If persistent, reconnect to mint fresh tokens.
- **Prevention:** None needed — auto-refresh is by design.

### QBO-10 — Refresh token expired (~100-day limit, silent auth failure)

- **Symptom:** All syncs for a company start failing auth; refresh retry doesn't recover. No proactive alert fires.
- **Root cause:** QBO refresh tokens expire after ~100 days of non-use. Once expired, `refreshQBOTokens` returns `null` and every `callQBO` fails.
- **Diagnosis:**
  ```sql
  select key, updated_at from company_integrations
  where company_id = '<uuid>' and key in ('QBO_ACCESS_TOKEN','QBO_REFRESH_TOKEN');
  ```
  A `QBO_REFRESH_TOKEN` untouched for ~100 days is the tell. Logs show auth failures that don't recover after refresh.
- **Resolution:** Have a Super Admin **reconnect** QuickBooks (re-runs OAuth, resets the 100-day clock).
- **Prevention:** The daily cron touching the realm normally keeps tokens fresh. Watch for companies whose cron has been failing for weeks (e.g., disconnected then forgotten).

### QBO-11 — DocNumber collision (duplicate document error)

- **Symptom:** 502 QBO Fault citing a **duplicate DocNumber**.
- **Root cause:** QBO enforces `DocNumber` uniqueness per entity type per realm. Two SiteCommand projects in the same realm can produce the same commitment/contract number.
- **Diagnosis:** Read the Fault. Check whether `QBO_DOC_NUMBER_PREFIX` is set:
  ```sql
  select value from company_integrations where company_id='<uuid>' and key='QBO_DOC_NUMBER_PREFIX';
  ```
- **Resolution:** Set `QBO_DOC_NUMBER_PREFIX=project` → DocNumbers become `{project_number}-{number}` (21-char cap via `buildQBODocNumber`). Re-sync the colliding records.
- **Prevention:** Enable the project prefix at onboarding for any realm hosting multiple projects.

### QBO-12 — Budget Code Map misconfigured (lines post to wrong account/item)

- **Symptom:** Costs land in the wrong QBO account/item, or all lines fall back to the default expense account/item.
- **Root cause:** `QBO_BUDGET_CODE_MAP` is empty, doesn't include the line's budget code, or maps it to the wrong target. Unmapped codes fall back to the transaction default.
- **Diagnosis:**
  ```sql
  select value from company_integrations where company_id='<uuid>' and key='QBO_BUDGET_CODE_MAP';
  ```
  Confirm each budget code on the SOV has a map entry with the correct `item` (preferred) or `account`. Remember **item wins over account** when both are set.
- **Resolution:** Fix the map in **Settings → Integrations → QuickBooks → Budget code map** (validated on save). Re-sync.
- **Prevention:** Build the full map before first sync; keep it updated as cost codes are added.

### QBO-13 — Budget job-to-date pull returns nothing (Resync with ERP: 0 updated)

- **Symptom:** "Resync with ERP" reports `updated: 0` and a `warning`.
- **Root cause (read the warning):**
  - `No QuickBooks budget-code mappings are configured…` → empty map.
  - `No QuickBooks Project or Customer matching '…' was found…` → project doesn't resolve to a QBO Customer/Project (items path).
  - `QuickBooks did not return item-level detail for this project…` → costs on that Customer:Job aren't coded via **Items**.
  - `No QuickBooks Class matching this project was found…` → account-based path, no Class for the project.
- **Diagnosis:** Inspect the `warning` in the response and the `erp_sync_logs` row (`record_type='budget_job_to_date'`). Verify `projects.qbo_customer_id` is pinned; verify budget codes are mapped to Items.
- **Resolution:**
  - Pin the QBO Project/Customer in **Project Admin → ERP Integration** (`projects.qbo_customer_id`).
  - Map budget codes to **Items** (items-based path is the GC standard).
  - For account-based, ensure the project's Class exists (auto-created by push; class name = project name).
- **Prevention:** Use items-based mapping and pin the Customer/Project during onboarding.

### QBO-14 — QBO Project/Customer picker doesn't find the right project

- **Symptom:** In Project Admin, the QBO Customer dropdown is missing the expected project, or the pull matches the wrong one.
- **Root cause:** `fetchQBOProjectsAndCustomers` lists active customers with `IsProject`/`ParentRef`, sorting Projects → sub-customers → plain Customers. `findCustomerIdByName` (fallback when no override) does a 3-pass match: `IsProject=true` exact → plain Customer exact → `DisplayName LIKE '%:<name>'` sub-customer.
- **Diagnosis:** Hit `GET /api/integrations/quickbooks/projects` and inspect `options[]` (`kind`, `parentName`). Confirm the QBO project is **active**.
- **Resolution:** Pin the correct option explicitly (sets `projects.qbo_customer_id`) so the pull stops depending on name matching.
- **Prevention:** Always pin the override rather than relying on name match.

### QBO-15 — Cron not running (records never auto-sync)

- **Symptom:** `erp_status` stays `pending`; no new `erp_sync_logs` rows around 17:00 UTC.
- **Root cause:** Cron not invoked, or `CRON_SECRET` mismatch, or no company has `QBO_REALM_ID`.
- **Diagnosis:**
  ```sql
  select max(synced_at) from erp_sync_logs where integration='quickbooks';
  select count(*) from company_integrations where key='QBO_REALM_ID';
  ```
  Confirm the Vercel cron for `/api/cron/quickbooks-sync` is scheduled (17:00 UTC) and the request carries the correct `CRON_SECRET`.
- **Resolution:** Fix the schedule / secret. Companies are detected via `company_integrations WHERE key='QBO_REALM_ID'`; a disconnected company won't sync (expected).
- **Prevention:** Monitor the daily cron; alert if `max(synced_at)` for an integration is >36 h old.

### QBO-16 — Payment status stale (shows "synced" but balance is wrong)

- **Symptom:** Detail page shows an old balance/payment status though QBO has newer payments.
- **Root cause:** Feedback is refreshed by (a) each push, (b) the manual **Refresh payment status** button, and (c) the cron's payment-refresh pass (25 stalest by `qbo_payments_refreshed_at` per table per company per day). Payments made entirely inside QBO only surface via (b)/(c).
- **Diagnosis:**
  ```sql
  select qbo_payment_status, qbo_balance, qbo_payments_refreshed_at
  from commitments where id='<uuid>';
  ```
- **Resolution:** Click **Refresh payment status** for an immediate read (`POST /api/integrations/quickbooks/refresh`), or wait for the daily pass.
- **Prevention:** Set expectations: QBO-side payments reconcile within ~24 h automatically.

### QBO-17 — Void/terminated commitment still shows as open Bill in QBO

- **Symptom:** A voided/terminated record still appears live in QBO.
- **Root cause:** Dead-status handling (`isDeadStatus` = `void`/`terminated`) only fires when the record is **re-synced** after the status change. Subcontract → Bill **delete**; PO → `POStatus=Closed`; prime Invoice → **void**. A never-synced void record is **skipped** (nothing to clean up).
- **Diagnosis:** Check the record's `status` and whether `qbo_id` is still set; check `erp_sync_logs` for an action of `deleted`/`closed`/`voided`/`skipped`.
- **Resolution:** Trigger a sync on the record (manual or wait for cron). On success the QBO doc is deleted/closed/voided and `qbo_id` is cleared.
- **Prevention:** None — the cleanup is automatic on the next sync after the status change.

---

## 4. Sage 300 CRE Failure Scenarios

### SAGE-01 — Connect fails: "QuickBooks Online is already connected"

- **Symptom:** 422 on Sage connect: `QuickBooks Online is already connected. Only one ERP integration may be connected at a time — disconnect QuickBooks in Settings → Integrations first.`
- **Root cause:** Mutual exclusion — `isQBOConfigured` is true.
- **Diagnosis:** `GET /api/integrations/erp/status`, or query for `QBO_REALM_ID`.
- **Resolution:** Disconnect QBO, then connect Sage.
- **Prevention:** One ERP per company.

### SAGE-02 — Connect fails: "Add your Agave Client ID and Client Secret first"

- **Symptom:** 422 on connect with that message; no Agave Link token generated.
- **Root cause:** Agave app credentials not configured (`isSage300CreAppConfigured` false).
- **Diagnosis:**
  ```sql
  select key from company_integrations
  where company_id='<uuid>' and key in ('SAGE300CRE_CLIENT_ID','SAGE300CRE_CLIENT_SECRET');
  ```
- **Resolution:** Enter the Agave **Client ID** and **Client Secret** (Step 1), save, then connect.
- **Prevention:** Provision Agave app creds first.

### SAGE-03 — Agave Link token creation fails

- **Symptom:** *Generate Agave Link token* errors out.
- **Root cause:** `createLinkToken` → Agave `POST /link/token/create` rejected the request — bad/expired Agave app creds, or Agave-side outage. `callAgave` returns `{ status: 0, rawText: "Failed to reach Agave: …" }` on a network failure.
- **Diagnosis:** Read the returned Agave error (`extractAgaveError`: `message` → `error` → `detail` → raw → `Unknown Agave error`). Verify the Client-Id/Client-Secret headers are valid in the Agave dashboard.
- **Resolution:** Correct the Agave app credentials; retry. If `status: 0`, it's connectivity to Agave — check network/Agave status.
- **Prevention:** Validate Agave app creds in the Agave dashboard before onboarding.

### SAGE-04 — Exchange fails: publicToken expired or already used

- **Symptom:** *Complete connection* fails; no `SAGE300CRE_ACCOUNT_TOKEN` stored.
- **Root cause:** `exchangePublicToken` → Agave `POST /link/token/exchange` rejected the `public_token` (single-use, short-lived).
- **Diagnosis:** Read the Agave error in the response. Confirm the public token was freshly produced by the Agave Link flow and not reused.
- **Resolution:** Re-run Agave Link to get a new public token, paste it, complete the exchange promptly. (Fallback: paste an Account Token directly if one is already held.)
- **Prevention:** Complete connect → exchange in one sitting.

### SAGE-05 — Sync fails: "Vendor not found in Sage 300 CRE"

- **Symptom:** 502: `Vendor "<name>" was not found in Sage 300 CRE. Create the vendor in Sage 300 CRE first, then re-sync.`
- **Root cause:** `resolvePartyId` does a **case-insensitive exact-name** match against `GET /vendors` and **never auto-creates** — Sage is the system of record.
- **Diagnosis:** Compare `commitments.contract_company` to the vendor name in Sage. Check `GET /api/integrations/sage300cre/vendors` for the exact spelling.
- **Resolution:** Create the vendor in Sage (or align the SiteCommand `contract_company` to the existing Sage name), then re-sync.
- **Prevention:** Reconcile vendor lists between Sage and SiteCommand during onboarding.

### SAGE-06 — Sync fails: "Customer not found in Sage 300 CRE"

- **Symptom:** 502: `Customer "<name>" was not found in Sage 300 CRE. Create the customer in Sage 300 CRE first, then re-sync.`
- **Root cause:** Same as SAGE-05 for `GET /customers` (prime contract `owner_client`).
- **Diagnosis:** Compare `prime_contracts.owner_client` to Sage customers.
- **Resolution:** Create/align the customer in Sage, re-sync.
- **Prevention:** Reconcile customer lists at onboarding.

### SAGE-07 — AR invoice sync fails: connector doesn't support /ar-invoices

- **Symptom:** Prime-contract / AR syncs error; AP/commitment syncs work fine.
- **Root cause:** Agave's construction surface is AP-centric. The customer's Sage connector may not expose `/ar-invoices`. The error is captured (not catastrophic) in `erp_sync_logs`.
- **Diagnosis:** Check `erp_sync_logs` for `record_type IN ('prime_contracts','ar_invoice')` with the Agave error about an unsupported resource.
- **Resolution:** Confirm AR support with Agave for that connector. If unsupported, treat the AP/commitment path as the supported integration and handle AR billing in Sage directly.
- **Prevention:** Set expectations at onboarding: AR is connector-dependent; AP is always supported.

### SAGE-08 — Job costing not appearing in Sage (job_id / cost_code_id missing)

- **Symptom:** Records sync but lines lack job/cost-code attribution in Sage.
- **Root cause:** `resolveSage300CreJobId` (project number → name) or `resolveCostCodeIds` (exact code → name) found no match, so those ids are **omitted from the payload** — this is **not an error**; the budget code stays in the line description (`"03-100 — Footings"`).
- **Diagnosis:** Check `GET /jobs` for a job matching the project number/name; check `GET /cost-codes?job_id=…` for the SOV budget codes. Inspect the sent payload in `raw_response`.
- **Resolution:** Create/align the Sage **job** (match project number or name) and **cost codes** (match budget codes), re-sync.
- **Prevention:** Set up the Sage job and cost codes before syncing; align numbering with SiteCommand.

### SAGE-09 — Budget job-to-date pull returns nothing

- **Symptom:** "Resync with ERP" reports `updated: 0` with a warning.
- **Root cause (read the warning):**
  - `No Sage 300 CRE job matching this project's number or name was found…` → job not resolved.
  - `Sage 300 CRE returned no job-to-date cost amounts…` → the connector exposes no actual-cost field. `readActualCost` probes `actual_cost`, `actual_amount`, `actual_total`, `actual_costs`, `cost_to_date`, `job_to_date_cost`, `jtd_cost`, `actual` (and `amounts`/`balances` sub-objects).
- **Diagnosis:** Inspect the response `warning` and `erp_sync_logs` (`record_type='budget_job_to_date'`). Confirm the project resolves to a Sage job and that the connector returns actuals.
- **Resolution:** Align the Sage job; confirm with Agave which actual-cost field the connector exposes (may need a connector-specific field).
- **Prevention:** Validate the actuals field during onboarding with a test pull.

### SAGE-10 — 404 on update (record deleted in Sage)

- **Symptom:** A previously-synced record re-creates in Sage instead of updating.
- **Root cause:** Sage has no SyncToken; `upsertAgave` does `PUT /{resource}/{id}` and, on **404**, falls back to a **create**. The record was deleted on the Sage side.
- **Diagnosis:** Check `erp_sync_logs` for a 404 followed by a successful create; confirm the old id no longer exists in Sage.
- **Resolution:** Usually self-heals (rebuilds the record). If the fallback create then fails (e.g., vendor no longer exists), resolve that underlying error (see SAGE-05/06).
- **Prevention:** Avoid deleting synced records directly in Sage; void/close instead.

### SAGE-11 — Agave agent disconnected (on-prem connectivity)

- **Symptom:** All Sage syncs fail with auth/connectivity errors despite valid app creds + account token.
- **Root cause:** The on-premise Agave agent on the customer's Sage server is offline/unauthenticated; Agave returns 401/403 (connector offline) or `callAgave` returns `status: 0` (`"Failed to reach Agave: …"`).
- **Diagnosis:** Read `error_message`/`raw_response`. A `status: 0` means SiteCommand couldn't even reach Agave; a 401/403 with a connector-offline message means Agave can't reach Sage.
- **Resolution:** Have the customer's IT confirm the Agave agent/service is running and re-authenticate the connector in Agave. Then re-sync.
- **Prevention:** Monitor the Agave connector health; document the on-prem dependency for the customer's IT.

### SAGE-12 — Cron payment refresh not updating Sage status

- **Symptom:** `sage300cre_status` / balances stale.
- **Root cause:** Feedback refreshes via push, the manual button, or the cron pass (25 stalest by `sage300cre_payments_refreshed_at` per table per company). PO headers are **non-posting** (`includeAmounts: false`) — they carry **status only**, no totals/balances.
- **Diagnosis:**
  ```sql
  select sage300cre_status, sage300cre_payments_refreshed_at from commitments where id='<uuid>';
  ```
  For commitment headers, absence of amounts is expected (PO is non-posting); amounts live on `sage300cre_ap_invoice_*`.
- **Resolution:** Click **Refresh payment status**, or wait for the 18:00 UTC cron. Verify the Sage cron is scheduled and `CRON_SECRET` matches.
- **Prevention:** Same cron monitoring as QBO-15.

---

## 5. Shared Failure Scenarios

### SHARED-01 — "Both QuickBooks and Sage 300 CRE are connected"

- **Symptom:** Budget resync returns 422: `Both QuickBooks and Sage 300 CRE are connected. Only one ERP integration may be connected at a time — disconnect one in Settings → Integrations.`
- **Root cause:** A pre-existing dual-connection state (both `QBO_REALM_ID` and `SAGE300CRE_ACCOUNT_TOKEN` present) — possible if connected before the mutual-exclusion guard, or via direct DB edits.
- **Diagnosis:**
  ```sql
  select key from company_integrations
  where company_id='<uuid>' and key in ('QBO_REALM_ID','SAGE300CRE_ACCOUNT_TOKEN');
  ```
- **Resolution:** Disconnect the ERP the customer is **not** using (Settings → Integrations). Confirm `GET /api/integrations/erp/status` → `connected` is a single value.
- **Prevention:** The connect guards prevent new dual states; don't bypass them with manual DB writes.

### SHARED-02 — Budget resync fails 500 (missing migration)

- **Symptom:** 500: `Failed to load project: <error>. If this mentions a missing column, apply supabase/migrations/163_project_qbo_customer_mapping.sql.`
- **Root cause:** The resync route selects `projects.qbo_customer_id`; migration **163** hasn't been applied.
- **Diagnosis:**
  ```sql
  select column_name from information_schema.columns
  where table_name='projects' and column_name in ('qbo_customer_id','qbo_customer_name');
  ```
- **Resolution:** Apply `supabase/migrations/163_project_qbo_customer_mapping.sql`.
- **Prevention:** Keep migrations in lockstep with deploys. Related: sync routes reference **113** (QBO) / **160** (Sage) idempotency columns and **161** (feedback) — a missing-column 500 from a sync route names the file to apply.

### SHARED-03 — Dirty records not picked up by cron (`updated_at` not advancing)

- **Symptom:** Edited records never re-sync via cron; `erp_status` doesn't return to `pending`.
- **Root cause:** Dirty detection compares `updated_at > last_synced_at` (QBO) / `> sage300cre_synced_at` (Sage). If a write path bypasses the `updated_at` trigger (e.g., a raw SQL update that doesn't set it), the row never looks dirty. Also note the cron fetches only `cap × 4 = 100` oldest-`updated_at` candidates then filters to 25 — a huge backlog drains slowly.
- **Diagnosis:**
  ```sql
  select id, updated_at, last_synced_at from commitments
  where id='<uuid>';   -- updated_at should be > last_synced_at if dirty
  select count(*) from commitments
  where company_id_via_project... and (last_synced_at is null or updated_at > last_synced_at);
  ```
- **Resolution:** Force a manual sync for the specific record. For backlogs >25/type, let successive daily runs drain it, or run the cron manually with a valid `CRON_SECRET` a few times.
- **Prevention:** Always mutate records through the app (triggers maintain `updated_at`); avoid raw DB writes.

### SHARED-04 — Records synced but accounting feedback columns are null

- **Symptom:** `qbo_total_amount` / `sage300cre_*` feedback columns are null though `qbo_id`/`sage300cre_id` is set.
- **Root cause:** Migration **161** not applied, **or** the ERP response didn't include parseable financials (QBO `extractFinancials` reads `TotalAmt`/`Balance`/`POStatus`; Sage `extractAgaveFinancials` reads `amount`/`amount_paid`/`balance`/`status`). Sage PO headers are non-posting → status only by design.
- **Diagnosis:**
  ```sql
  select column_name from information_schema.columns
  where table_name='commitments' and column_name='qbo_total_amount';
  ```
  If the column exists, check `raw_response` in `erp_sync_logs` for the financial fields.
- **Resolution:** Apply migration 161 if missing. Otherwise click **Refresh payment status** to re-read. For Sage POs, null amounts are expected (look at `sage300cre_ap_invoice_*`).
- **Prevention:** Verify migrations; expect status-only feedback on non-posting docs.

### SHARED-05 — Manual sync succeeds but cron never re-syncs the same record

- **Symptom:** After a manual push, the record is never touched again by cron.
- **Root cause:** This is **correct** behavior — the manual sync set `last_synced_at`/`sage300cre_synced_at` to "now", so the record is no longer dirty (`updated_at` is not newer). The cron only pushes dirty rows.
- **Diagnosis:** Confirm `updated_at <= last_synced_at`. If the user expects re-sync, they must edit the record (advancing `updated_at`) or use the **Refresh payment status** button for feedback.
- **Resolution:** No fix needed. To force a re-push, edit the record or trigger a manual sync.
- **Prevention:** Educate users: cron pushes *changes*; feedback refresh is a separate pass.

---

## 6. Escalation Paths

1. **Reproduce & capture.** Pull the last 5 `erp_sync_logs` rows for the record (query in §2). Note HTTP status, `error_message`, `raw_response`.
2. **Classify by status:** 422 → data/config (resolve with the customer). 502 → ERP-side (read the embedded fault). 500 → engineering (likely migration/code).
3. **Run the offline check** to rule out a code regression:
   - QBO: `npx tsx scripts/qbo-integration-check.ts`
   - Sage: `npx tsx scripts/sage300cre-integration-check.ts`
4. **QBO-side faults** that aren't data issues (throttling, platform errors): escalate to Intuit with the `realmId` and the Fault `Detail`.
5. **Sage/Agave-side faults** (connector offline, unsupported resource, missing actuals field): escalate to Agave with the connector id and the Agave error; loop in the customer's IT for on-prem agent issues.
6. **Suspected code bug** (consistent 500, wrong mapping despite correct config): file an engineering ticket with the log rows, the record id, and the `raw_response`. Reference `lib/quickbooks.ts` / `lib/sage300cre.ts` and the relevant migration.

---

## 7. Diagnostic Queries

**Is this company connected, and to which ERP?**
```sql
select key, updated_at from company_integrations
where company_id = '<company-uuid>'
  and key in ('QBO_REALM_ID','QBO_ACCESS_TOKEN','QBO_REFRESH_TOKEN',
              'SAGE300CRE_ACCOUNT_TOKEN','SAGE300CRE_CLIENT_ID');
```

**Posting config in effect (QBO):**
```sql
select key, value from company_integrations
where company_id='<company-uuid>'
  and key in ('QBO_ENVIRONMENT','QBO_AP_EXPENSE_ACCOUNT','QBO_DEFAULT_ITEM',
              'QBO_RETAINAGE_PAYABLE_ACCOUNT','QBO_RETAINAGE_RECEIVABLE_ACCOUNT',
              'QBO_PROJECT_TRACKING','QBO_DOC_NUMBER_PREFIX','QBO_BUDGET_CODE_MAP');
```

**Recent failures across a company (join through projects):**
```sql
select l.record_type, l.record_id, l.integration, l.error_message, l.synced_at
from erp_sync_logs l
where l.result = 'error'
  and l.synced_at > now() - interval '7 days'
order by l.synced_at desc
limit 50;
```

**Dirty commitments awaiting sync (QBO):**
```sql
select id, number, status, updated_at, last_synced_at, erp_status
from commitments
where last_synced_at is null or updated_at > last_synced_at
order by updated_at asc;
```

**Stalest payment-feedback rows (what the cron refresh pass will pick next, QBO):**
```sql
select id, qbo_id, qbo_payment_status, qbo_payments_refreshed_at
from commitments
where qbo_id is not null
order by qbo_payments_refreshed_at asc nulls first
limit 25;
```

**Confirm required migrations are applied:**
```sql
select table_name, column_name from information_schema.columns
where (table_name='commitments'     and column_name in ('qbo_id','sage300cre_id','qbo_total_amount'))
   or (table_name='prime_contracts' and column_name in ('qbo_id','sage300cre_id','qbo_total_amount'))
   or (table_name='projects'        and column_name in ('qbo_customer_id'))
order by table_name, column_name;
```

**Was a void/terminate cleaned up in the ERP?**
```sql
select record_type, record_id, result, error_message, synced_at
from erp_sync_logs
where record_id = '<uuid>'
order by synced_at desc
limit 10;   -- look for the deleted/closed/voided/skipped action in raw_response
```
