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

## Setup (company super admin)

1. Go to **Settings → Integrations → QuickBooks Online**.
2. Enter your Intuit app credentials (`QBO_CLIENT_ID`, `QBO_CLIENT_SECRET`) and save.
3. Click **Connect QuickBooks** to run OAuth.
4. On successful callback, SiteCommand stores:
   - `QBO_REALM_ID`
   - `QBO_ACCESS_TOKEN`
   - `QBO_REFRESH_TOKEN`

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

- Sync is **push-only** from SiteCommand to QBO. There is no pull from QBO into
  SiteCommand.
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
