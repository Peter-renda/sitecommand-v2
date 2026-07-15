# Intuit accounting integration (QBO + Intuit Enterprise Suite)

This integration is **manual push sync** (not automatic continuous sync). You connect an Intuit accounting tenant once, then push records from SiteCommand as needed.

It supports both **QuickBooks Online (QBO)** and **Intuit Enterprise Suite (IES)** tenants that expose the Intuit accounting APIs.

## What currently syncs

`POST /api/integrations/quickbooks/sync` supports these record types:

- `commitments` → creates a **QBO Bill** (subcontract) or **Purchase Order**
- `prime_contracts` → creates a **QBO AR Invoice**
- `ap_invoice` → creates a **QBO Bill** from commitment SOV billed-to-date amounts
- `ar_invoice` → creates a **QBO AR Invoice** from prime contract SOV current-period amounts

For the full field-by-field crosswalk between SiteCommand and the QBO object model
(and the prioritized list of mapping gaps), see
[`quickbooks-online-data-mapping.md`](./quickbooks-online-data-mapping.md).

### Pull direction: job-to-date costs → Budget

The integration is two-way for budget actuals. The Budget tool's **Resync with ERP**
button (`POST /api/integrations/erp/resync-budget`) pulls **job-to-date (actual)
costs** out of QuickBooks and writes them into each budget line's **Job to Date
Costs** column, matched by budget code. Two paths coexist (per-code, decided by
the budget code map):

- **Items-based (recommended, GC-standard)** — one QBO **Item** (Product/Service)
  per budget code, e.g. `02-310.C`. The pull resolves the project to a QBO
  **Customer (or Customer:Job)**, reads `reports/ProfitAndLossDetail` scoped to
  that customer with `item_name` surfaced, and sums each Item's amount.
  Mirrors how most construction QBO files are structured: a flat CoA + Items as
  cost codes + Customer:Job as project.
- **Account-based (legacy)** — budget code maps to a QBO **Account**. The pull
  reads a P&L summary scoped to the project's **Class**, sums each Account, and
  attributes back. Use only when your CoA carries a separate account per cost
  code.

Per-code: if the map entry sets `item`, the code is pulled via the Items path; if
it sets only `account`, via the Account path. Shared targets (one Item or Account
mapped to >1 code) are skipped as ambiguous. Both paths can run in the same
resync. A company may connect **only one** ERP (QuickBooks **or** Sage 300 CRE).

## Setup (company super admin)

1. Go to **Settings → Integrations → QuickBooks Online**.
2. Enter your Intuit app credentials (`QBO_CLIENT_ID`, `QBO_CLIENT_SECRET`), pick the
   **Environment** (Production or Sandbox), and save.
3. Click **Connect QuickBooks** to run OAuth.
4. On successful callback, SiteCommand stores:
   - `QBO_REALM_ID`
   - `QBO_ACCESS_TOKEN`
   - `QBO_REFRESH_TOKEN`

For the full step-by-step walkthrough (Intuit portal, sandbox provisioning, production
keys, troubleshooting), see
[`quickbooks-online-setup-guide.md`](./quickbooks-online-setup-guide.md).

**Disconnect**: the settings card has a **Disconnect** button →
`POST /api/integrations/quickbooks/disconnect` (super admin only). It best-effort revokes
the grant with Intuit's token-revoke endpoint, then deletes the realm + token rows.
Client ID/Secret and the environment selection are kept for easy reconnect.

**OAuth CSRF protection**: `/connect` stores a random nonce in a 10-minute httpOnly
cookie (`qbo_oauth_state`) and embeds the same nonce in the OAuth `state` parameter;
`/callback` rejects any response whose state nonce doesn't match the cookie
(`qbo_invalid_state`). Post-OAuth redirects resolve the settings-page origin via
`getAppOrigin()` (prefers `NEXT_PUBLIC_APP_URL`) so users land on the canonical domain
where their session cookie lives.

### Redirect URI (the #1 cause of "didn't connect")

Intuit shows a generic *"…didn't connect. Please try again later, or contact customer
support"* page when the `redirect_uri` does **not exactly match** a URI registered on the
app in the Intuit Developer portal. Matching rules:

- Scheme + host + path + trailing slash must be byte-for-byte identical.
- The URI must be registered under the **same key set** (Development vs Production) as the
  Client ID/Secret in use. Development keys connect only to **sandbox** companies;
  production keys connect to real companies.
- The registered URI must be a real URL that routes to this app's callback handler.

SiteCommand resolves the redirect URI via `getIntuitRedirectUri()` in `lib/quickbooks.ts`,
in this order:

1. `INTUIT_REDIRECT_URI` — explicit override. **Set this in the deployment env to the exact
   value registered in the portal** (e.g. `https://<your-app-domain>/api/integrations/quickbooks/callback`).
2. `NEXT_PUBLIC_APP_URL` + `/api/integrations/quickbooks/callback`.
3. Request-derived origin (honors `x-forwarded-*`) — last resort; avoid relying on this in
   production because Vercel proxying can yield the wrong scheme/host.

When the callback fails, the settings page now shows Intuit's own reason (e.g.
`invalid_grant`) appended to the error message.

## Testing against the QuickBooks sandbox

The OAuth authorize/token URLs are identical for sandbox and production — only the REST
API base and the **key set** differ. SiteCommand selects the base from the company's
environment:

| Setting | Effect |
|---|---|
| **Environment** selector on Settings → Integrations (stored as a per-company `QBO_ENVIRONMENT` row in `company_integrations`) | `sandbox` routes API calls to `https://sandbox-quickbooks.api.intuit.com` |
| `QBO_ENVIRONMENT` env var | Fallback when the company has no row; unset / `production` routes to `https://quickbooks.api.intuit.com` (default) |
| `QBO_API_BASE=<url>` | Explicit override of the REST base (wins over `QBO_ENVIRONMENT`) |

To test end-to-end against a sandbox company:

1. **Intuit Developer portal** → your app → use the **Development** keys (sandbox), and add
   the redirect URI under the **Development** "Redirect URIs" list. The exact value the
   server will send is displayed on the QuickBooks card (returned as `QBO_REDIRECT_URI`
   by `GET /api/settings/company-integrations?integration=quickbooks`).
2. Make sure you have a **sandbox company** (Developer portal → *Sandbox* → it provisions one
   automatically; or add another).
3. **In SiteCommand** (Settings → Integrations → QuickBooks Online): enter the
   **Development** Client ID/Secret, set **Environment = Sandbox**, and save. Locally the
   callback is usually `http://localhost:3000/api/integrations/quickbooks/callback`
   (set `INTUIT_REDIRECT_URI` or `NEXT_PUBLIC_APP_URL` if the auto-detected origin is wrong).
4. **Connect** from Settings → Integrations → QuickBooks; pick the sandbox company on the
   Intuit consent screen. The card shows **Connected** plus a **Sandbox** badge.
5. **Trigger a sync** via any of:
   - the **Sync to QuickBooks** button in the header of a commitment or prime contract
     detail page,
   - the cron endpoint `GET /api/cron/quickbooks-sync` (locally, with `CRON_SECRET` unset, you
     can just open it in the browser; deployed, send `Authorization: Bearer $CRON_SECRET`), or
   - a direct `POST /api/integrations/quickbooks/sync` with `{ recordType, recordId }` while
     logged in.
6. **Verify** in the sandbox company UI (sign in at the Intuit sandbox) that the Bill /
   Purchase Order / Invoice and any auto-created Vendor/Customer appear, and check the
   `erp_sync_logs` rows (`integration='quickbooks'`) or `/api/integrations/quickbooks/logs`.

When done, point the same company at production: **Disconnect**, swap in the
**Production** keys, set **Environment = Production**, save, and reconnect.

### Offline integration check (no credentials needed)

`npx tsx scripts/qbo-integration-check.ts` exercises `lib/quickbooks.ts` against a mocked
Intuit API and asserts: sandbox/production base-URL routing + `minorversion` handling,
401 → token-refresh → retry (with token persistence), the full subcontract→Bill create
flow (vendor auto-create, COGS account detection, per-SOV-line payload, document dates),
the idempotent update path (SyncToken re-fetch, `sparse` update, vendor reuse), AR
retainage lines, and `getIntuitRedirectUri` precedence. Run it after any change to the
QBO client.

## How to use it

1. Create or update a commitment / prime contract / SOV billing data in SiteCommand.
2. Trigger sync from the UI action that calls `/api/integrations/quickbooks/sync`.
3. SiteCommand writes each sync attempt to `erp_sync_logs` with `integration='quickbooks'`.
4. Check per-record logs at `/api/integrations/quickbooks/logs?recordType=<type>&recordId=<id>`.

## Billing-related notes

- AP invoice sync requires at least one commitment SOV line with `billed_to_date > 0`.
- AR invoice sync requires at least one prime contract SOV line with `work_completed_this_period > 0`.
- If these values are missing, sync returns `422` with a validation message.

## Token handling

- Access token expiration is handled automatically.
- On a `401` from QBO, SiteCommand refreshes token once using the stored refresh token and retries.

## Automatic sync (daily on Vercel Hobby)

In addition to manual triggers, a background cron job at
`/api/cron/quickbooks-sync` runs once daily at **17:00 UTC** on Vercel Hobby (configured in `vercel.json`)
and pushes any "dirty" records to QBO for every company that has connected
QuickBooks. Dirty means:

- `commitments` / `prime_contracts` whose `updated_at > last_synced_at` (or
  never synced).
- AP/AR invoices whose underlying SOV item updated after the last invoice push
  (`commitment_sov_items.updated_at > commitments.qbo_ap_invoice_synced_at`,
  same pattern for AR).

### Idempotency

Every sync function in `lib/quickbooks.ts` accepts an optional `existingQboId`.
When present, the function does a QBO `GET` to retrieve the latest `SyncToken`
and then a `POST ?operation=update` with `sparse: true`. When absent it does a
plain `POST` to create. The returned QBO ID and SyncToken are persisted on the
SiteCommand row (`qbo_id`, `qbo_sync_token`, `last_synced_at`), so the next pass
updates in place rather than creating a duplicate.

If the QBO record was deleted on Intuit's side, the sync falls back to creating
a fresh record.

### Auth & safety caps

- The cron endpoint requires `Authorization: Bearer ${CRON_SECRET}`. Vercel Cron
  passes this header automatically when `CRON_SECRET` is set as an environment
  variable in the Vercel project.
- Each run processes at most 25 records per type per company (commitments,
  prime contracts, AP invoices, AR invoices) — enough to keep us under both
  Vercel's serverless timeout and Intuit's 500-req/min/realm rate limit. A
  large backlog drains across multiple daily cycles on Hobby plans (or faster on higher plans).

### Vercel plan note

Sub-hourly cron schedules require Vercel **Pro** or higher. On the Hobby plan
use a once-daily cron expression in `vercel.json` (as configured here).

## Reference resolution & posting config

When creating transactions, SiteCommand resolves every QBO reference to an **Id**
(`Ref.value`) rather than posting by name — names that don't exactly match an existing
record silently fail. Vendors and Customers are created on demand from the contract
company / owner name when they don't already exist.

Bill expense lines post to a real expense/COGS account and PO/Invoice lines to a real
Item (never to `Accounts Payable (A/P)`). The targets are configurable per company via
`company_integrations` keys (or the matching env vars), and auto-detected when unset:

| Key | Purpose | Default when unset |
|---|---|---|
| `QBO_AP_EXPENSE_ACCOUNT` | Account name to debit on Bills (AP) | first active **Cost of Goods Sold**, then **Expense**, account in the realm |
| `QBO_DEFAULT_ITEM` | Item name for PO / Invoice lines | `Services` (created as a Service item wired to the first active Income account if missing) |
| `QBO_BUDGET_CODE_MAP` | JSON map of SOV budget code → QBO refs | `{}` — unmapped codes fall back to the defaults above |
| `QBO_RETAINAGE_RECEIVABLE_ACCOUNT` | Account behind the AR "Retainage" item | unset → no retainage line on invoices |
| `QBO_RETAINAGE_PAYABLE_ACCOUNT` | Account for AP retainage withholding | unset → no retainage line on bills |

If no valid account/item can be resolved, the sync fails fast with a clear message
instead of posting an invalid transaction.

### Schedule of Values, dates & retainage

- **Line detail** — commitment Bills/POs and prime Invoices post one QBO line per SOV item
  (description prefixed with the budget code; `Qty`/`UnitPrice` preserved when they
  reconcile to the line amount). A commitment with no SOV lines falls back to a single
  lump-sum line.
- **Budget-code mapping** — each line's budget code is looked up in `QBO_BUDGET_CODE_MAP`:
  ```json
  { "01-100": { "account": "Job Materials", "class": "Phase 1", "item": "Materials" } }
  ```
  Any of `account` / `class` / `item` may be set; the Class is auto-created when missing
  (skipped silently if class tracking is off). Unmapped codes use the transaction defaults.
- **Document dates** — subcontract Bills use the commitment start/estimated-completion
  dates, POs use the issued/contract date, prime Invoices use the contract start/estimated
  dates — rather than the sync date.
- **Retainage** — AR invoices withhold `work-completed × retainage %` per line and AP bills
  withhold `billed × default retainage %`, each as a single negative line, **only** when the
  matching retainage account key above is set.

## Current limitations

- Transaction sync is **push-only** from SiteCommand to QBO. The reverse direction is
  limited to read-only lookups: active Vendor/Customer lists
  (`GET /api/integrations/quickbooks/vendors` / `/customers`) and the QBO IDs/SyncTokens
  stored back on synced records. Bills/invoices entered directly in QBO are not imported.
- Auto-created Vendors/Customers carry only a `DisplayName`; address/email/phone
  enrichment from the directory is a planned follow-up (see data-mapping spec G2).
- Budget-code → Account/Class/Item mapping works but is **config-driven**: it only takes
  effect for codes listed in `QBO_BUDGET_CODE_MAP` (spec G5).
- Projects are not yet mapped to a QBO Customer:Job/Class, and change orders are not pushed
  (spec G3 / CO).


## Enterprise Suite compatibility

- OAuth uses Intuit accounting scopes and the same token exchange flow used by QBO.
- API calls target Intuit's `v3/company/{realmId}` accounting endpoints, which are shared by QBO-compatible accounting tenants.
- Optional: set `INTUIT_OAUTH_SCOPES` if your Intuit app requires additional scopes in your enterprise environment.
