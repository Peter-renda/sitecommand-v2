# QuickBooks Online Integration — Setup & User Guide

This guide walks you through connecting SiteCommand to QuickBooks Online (QBO) — first
against an **Intuit sandbox** (test) company, then against your **real (production)**
QuickBooks company — and explains exactly what data flows from SiteCommand to QBO and
from QBO back into SiteCommand.

> Companion docs:
> - [`quickbooks-online-integration.md`](./quickbooks-online-integration.md) — operational/runtime reference (env vars, cron, idempotency internals)
> - [`quickbooks-online-data-mapping.md`](./quickbooks-online-data-mapping.md) — field-by-field data crosswalk

---

## 1. What the integration does

SiteCommand pushes your project financial records into QuickBooks Online so accounting
never re-keys contract data. The connection is **per SiteCommand company** — one QBO
company file (realm) per SiteCommand company — and uses Intuit's OAuth 2.0, so no
QuickBooks passwords are ever stored in SiteCommand.

### SiteCommand → QuickBooks (push)

| SiteCommand record | What triggers it | QBO record created/updated |
|---|---|---|
| **Subcontract** (Commitments tool) | "Sync to QuickBooks" button on the commitment, or the daily auto-sync | **Bill** (A/P) — one line per SOV item, vendor auto-created from the Contract Company |
| **Purchase Order** (Commitments tool) | Same | **Purchase Order** (non-posting) — one line per SOV item |
| **Prime Contract** | "Sync to QuickBooks" button on the contract, or the daily auto-sync | **Invoice** (A/R) — one line per SOV item, customer auto-created from the Owner/Client |
| **AP billing** (commitment SOV *Billed to Date* amounts) | Sync API / daily auto-sync | **Bill** (A/P) with optional retainage withholding line |
| **AR billing** (prime contract SOV *Work Completed This Period*) | Sync API / daily auto-sync | **Invoice** (A/R) with optional retainage withholding line |

Along the way SiteCommand also **creates master records in QBO when they don't exist**:

- **Vendors** — from the commitment's Contract Company name
- **Customers** — from the prime contract's Owner/Client name
- **Service Items** — the default posting item (e.g. "Services") and a "Retainage" item
- **Classes** — when your budget-code map assigns classes (skipped if class tracking is off)

Re-syncing the same record **updates the existing QBO transaction in place** (it will not
create duplicates). If the record was deleted inside QBO, the next sync recreates it.

### QuickBooks → SiteCommand (pull)

The integration is intentionally accounting-master-friendly: SiteCommand never modifies
your chart of accounts and never deletes anything in QBO. What comes back:

| From QBO | Into SiteCommand | Endpoint |
|---|---|---|
| **Vendor list** (active vendors) | Available to the app for vendor selection/matching | `GET /api/integrations/quickbooks/vendors` |
| **Customer list** (active customers) | Available to the app for customer selection/matching | `GET /api/integrations/quickbooks/customers` |
| **QBO transaction IDs + SyncTokens** | Stored on each synced commitment / prime contract (`qbo_id`, `qbo_sync_token`, `last_synced_at`) so future syncs update instead of duplicate | automatic, on every sync |
| **Account / Item / Class lookups** | Resolved live during each sync (your chart of accounts is read, never written except for auto-created Items/Classes) | automatic, during sync |
| **Sync results & errors** | Written to the sync log per record (`erp_sync_logs`), viewable via `GET /api/integrations/quickbooks/logs?recordType=…&recordId=…` | automatic |

There is **no continuous pull** of QBO transactions (bills/invoices created directly in
QBO are not imported into SiteCommand).

---

## 2. Prerequisites

1. **A QuickBooks Online company** — for production; sandbox testing uses a free Intuit
   sandbox company instead.
2. **An Intuit Developer account & app** — free at [developer.intuit.com](https://developer.intuit.com):
   - Sign in → **My Hub → App Dashboard → Create an app** (or use an existing one).
   - Choose **QuickBooks Online and Payments** and select the
     `com.intuit.quickbooks.accounting` scope.
   - Every Intuit app has **two key sets**: **Development** keys (work only with sandbox
     companies) and **Production** keys (work only with real companies). You'll use one or
     the other depending on the environment you're connecting.
3. **SiteCommand role** — you must be a **Company Super Admin** (or Site Admin) to open
   **Settings → Integrations** and connect QuickBooks.
4. **Database migrations applied** — the QBO sync depends on two migrations beyond the
   base financial tables; make sure both have been run against the deployment's Supabase
   database (both are idempotent — safe to re-run in the SQL editor):
   - `supabase/migrations/065_quickbooks_xero_integrations.sql` — adds the `integration`
     column to `erp_sync_logs`.
   - `supabase/migrations/113_qbo_idempotency_columns.sql` — adds `qbo_id`,
     `qbo_sync_token`, `last_synced_at` (+ AP/AR invoice variants) to `commitments` and
     `prime_contracts`. **Without this, "Sync to QuickBooks" fails on every record**
   (the record query references these columns), and even if it posted, re-syncs would
   duplicate transactions instead of updating them.

### The redirect URI (read this — it's the #1 cause of failures)

Intuit only redirects back to URLs registered on your app, and the match is
**byte-for-byte exact** (scheme, host, path, trailing slash). In the Intuit Developer
portal, under your app's **Keys & credentials** page, add this Redirect URI:

```
https://<your-sitecommand-domain>/api/integrations/quickbooks/callback
```

The exact value your deployment will use is shown at the bottom of the QuickBooks card on
**Settings → Integrations** — copy it from there. Register it under the **same key set**
you're using (Development URIs for sandbox, Production URIs for production). If it's
missing or differs by even a trailing slash, Intuit shows a generic *"…didn't connect.
Please try again later"* page.

> Local development: register `http://localhost:3000/api/integrations/quickbooks/callback`
> under the **Development** keys (Intuit allows `http` only for localhost).

---

## 3. Setup A — Sandbox (test before you touch real books)

Use this to validate the full flow end-to-end with zero risk to your real accounting.

1. **Get a sandbox company.** In the Intuit Developer portal go to **My Hub → Sandbox**.
   Intuit auto-provisions a "Sandbox Company_US_1" with realistic demo data. You can add
   more if needed.
2. **Copy your Development keys.** App Dashboard → your app → **Keys & credentials** →
   **Development** tab → copy the Client ID and Client Secret.
3. **Register the redirect URI** under the **Development** tab's Redirect URIs list (see
   §2 above).
4. **In SiteCommand** go to **Settings → Integrations → QuickBooks Online**:
   1. Paste the **Development** Client ID and Client Secret.
   2. Set **Environment** to **Sandbox (Intuit test company)**.
   3. Click **Save credentials**.
   4. Click **Connect QuickBooks Online**. You'll land on Intuit's consent screen — sign
      in with your **developer account**, pick the **sandbox company**, and click
      **Connect**.
   5. You're redirected back; the card now shows **Connected** with a blue **Sandbox**
      badge.
5. **Push a test record.** Open any project → **Commitments** → open a subcontract or PO →
   click **Sync to QuickBooks** in the header. (Same button exists on Prime Contracts.)
6. **Verify in the sandbox.** From the Developer portal's Sandbox page click your sandbox
   company to open its QuickBooks UI:
   - Subcontract → **Expenses → Bills** (look for the Bill whose No. matches your
     commitment number, with one line per SOV item).
   - Purchase Order → **Expenses → Purchase Orders**.
   - Prime Contract → **Sales → Invoices**.
   - The Vendor/Customer will have been auto-created if it didn't exist.
7. **Re-sync after an edit** and confirm the same QBO record updates (no duplicate).

When you're satisfied, move to production (next section).

## 4. Setup B — Production (your real QuickBooks company)

1. **Get production keys.** In the Intuit portal, the **Production** tab of Keys &
   credentials is unlocked after you complete Intuit's brief app questionnaire
   (app name, EULA/privacy URLs, category). Complete it, then copy the **Production**
   Client ID and Secret.
2. **Register the redirect URI** under the **Production** Redirect URIs list — the exact
   value shown on SiteCommand's Integrations page. Production URIs must be `https`.
3. **In SiteCommand** go to **Settings → Integrations → QuickBooks Online**:
   1. If you were previously connected to the sandbox, click **Disconnect** first.
   2. Paste the **Production** Client ID and Secret (overwriting the dev keys).
   3. Set **Environment** to **Production (real QuickBooks company)**.
   4. Click **Save credentials**, then **Connect QuickBooks Online**.
   5. Sign in with the Intuit account that **administers your real QuickBooks company**,
      pick the company, and approve.
4. **Confirm posting targets** (recommended before the first real sync — see §6):
   at minimum decide which expense/COGS account Bills should hit. Without configuration,
   SiteCommand auto-detects the first active Cost of Goods Sold (then Expense) account.
5. **Sync one real commitment** and verify it in QuickBooks before relying on the daily
   auto-sync.

> **Platform-hosted alternative:** a SiteCommand Site Admin can store shared app
> credentials platform-wide (Settings → Integrations as site admin → "QuickBooks Online —
> App Credentials"). Companies that haven't saved their own Client ID/Secret automatically
> use the platform app and only need to do Step 3.3–3.5 (Environment → Save → Connect).

---

## 5. Day-to-day use

### Manual sync
- **Commitment** (subcontract / PO): open it → **Sync to QuickBooks** button in the header.
- **Prime contract**: open it → **Sync to QuickBooks** button in the header.
- The record's ERP status chip moves to **Synced** on success; failures show the exact
  QBO error message.

### Automatic daily sync
A background job runs **once a day (17:00 UTC)** and pushes every "dirty" record — any
commitment or prime contract created or edited since its last sync, plus AP/AR invoice
amounts whose SOV billing changed — for every company with QuickBooks connected. No
action needed; manual sync is only for "I want it in QBO now".

### Idempotency (no duplicates)
The first sync stores the QBO transaction ID on the SiteCommand record. Every later sync
fetches QBO's latest SyncToken and **updates that same transaction** (`sparse` update).
Deleting the transaction in QBO causes the next sync to recreate it fresh.

### Sync history
Every attempt (success or failure, with QBO's raw response) is logged. Per-record history:
`GET /api/integrations/quickbooks/logs?recordType=commitments&recordId=<id>`.

---

## 6. Posting configuration (where amounts land in your books)

Defaults work out of the box, but accounting teams usually want explicit control. These
keys are set per company (in `company_integrations`, same table the UI writes) or as
server env vars:

| Key | Controls | Default when unset |
|---|---|---|
| `QBO_AP_EXPENSE_ACCOUNT` | Account name debited on Bills | First active **Cost of Goods Sold** account, else first **Expense** account |
| `QBO_DEFAULT_ITEM` | Item used on PO / Invoice lines | `Services` (auto-created Service item wired to your first Income account) |
| `QBO_BUDGET_CODE_MAP` | JSON map of SOV budget code → QBO Account / Class / Item per line | `{}` — unmapped codes use the defaults above |
| `QBO_RETAINAGE_RECEIVABLE_ACCOUNT` | Account behind the AR "Retainage" withholding line | unset → no retainage line on Invoices |
| `QBO_RETAINAGE_PAYABLE_ACCOUNT` | Account for AP retainage withholding | unset → no retainage line on Bills |

Budget-code map example — job-costs every SOV line by cost code:

```json
{
  "03-100": { "account": "Job Materials", "class": "Phase 1", "item": "Concrete" },
  "16-000": { "account": "Subcontractor Expense" }
}
```

Rules of thumb:
- References are always posted to QBO **by ID**, never by display name, so misspelled
  names fail loudly instead of silently mis-posting.
- Retainage is withheld as a **negative line** (AR: `work completed × line retainage %`;
  AP: `billed × commitment default retainage %`) **only** when the matching account key
  is configured.
- If no valid expense account or item can be resolved, the sync **fails fast with a clear
  error** rather than posting to Accounts Payable or another wrong account.

---

## 7. Switching environments, reconnecting, disconnecting

- **Sandbox → Production** (or vice versa): click **Disconnect**, swap in the other key
  set, flip the **Environment** selector, **Save credentials**, then **Connect** again.
  The environment selector controls which Intuit API base is called — tokens from one
  environment will not work against the other.
- **Reconnect** (same environment): just click **Reconnect QuickBooks** — e.g. to point
  at a different QBO company file or after revoking access inside Intuit.
- **Disconnect**: revokes the OAuth grant with Intuit (best-effort) and deletes the
  stored realm + tokens. Your Client ID/Secret and environment selection are kept so you
  can reconnect without re-entering them. Synced data already in QBO is untouched.

### Token lifetimes (handled automatically)
Intuit access tokens last ~1 hour; refresh tokens ~100 days and roll on every refresh.
SiteCommand refreshes automatically on any 401 and persists the new tokens. The daily
auto-sync keeps the refresh token alive. If a company stops syncing for 100+ days, the
grant expires and a super admin must click **Reconnect**.

---

## 8. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Intuit shows *"…didn't connect. Please try again later"* | Redirect URI not registered, or registered under the wrong key set (Dev vs Prod) | Copy the exact URI from the Integrations card into the portal under the key set matching your Client ID |
| Redirected back with *"Failed to exchange authorization code (invalid_grant)"* | redirect_uri differed between authorize and token calls — usually a proxy/host mismatch | Set `INTUIT_REDIRECT_URI` (or `NEXT_PUBLIC_APP_URL`) in the deployment env to the registered value |
| *"The authorization request could not be verified"* | The connect flow's state cookie expired (>10 min on the consent screen) or the callback was forged/replayed | Click Connect again and complete the consent promptly |
| Sync error *"AuthenticationFailed"* / repeated 401 after working previously | Refresh token expired (100 days idle) or access was revoked inside Intuit | **Reconnect QuickBooks** from Settings → Integrations |
| Sync error *"No QBO expense account found"* | Brand-new QBO file with no expense/COGS accounts, or `QBO_AP_EXPENSE_ACCOUNT` names a non-existent account | Create the account in QBO or fix the configured name |
| Sync fails with *"Commitment not found"* on a record that clearly exists, or *"Failed to load commitment: column … does not exist"* | Migration `113_qbo_idempotency_columns.sql` not applied to the database | Run that migration in the Supabase SQL editor (idempotent), then retry |
| Sandbox connects but API calls fail with 403 | Environment mismatch: Production selected with Development keys (or vice versa) | Make the Environment selector match the key set, then Disconnect + reconnect |
| Vendor/customer appears duplicated in QBO | Contract Company / Owner name spelled differently than the existing QBO record | Match the QBO display name exactly in SiteCommand (resolution is by exact DisplayName) |
| Nothing syncs automatically | Company never finished OAuth, or no records changed since last sync | Check the card shows **Connected**; edit + manually sync one record to verify |

For deeper debugging, every sync writes QBO's raw response to the sync log
(`erp_sync_logs`, `integration='quickbooks'`).

---

## 9. Verifying the integration without credentials

An offline check exercises the real client code (URL routing for sandbox vs production,
401 token-refresh-and-retry, Bill/Invoice payload shapes, idempotent updates, retainage
lines, redirect-URI precedence) against a mocked Intuit API:

```bash
npx tsx scripts/qbo-integration-check.ts
```

All checks must pass before shipping changes to `lib/quickbooks.ts`.

---

## 10. Current limitations

- Push is one-way for transactions: bills/invoices entered directly in QBO are not
  imported into SiteCommand.
- Auto-created Vendors/Customers carry only the display name (no address/email
  enrichment from the Project Directory yet).
- Projects are not yet mapped to QBO Customer:Jobs/Classes automatically (per-line class
  mapping is available via `QBO_BUDGET_CODE_MAP`).
- Change orders are not pushed as separate QBO transactions (the prime-contract invoice
  amount includes approved change orders).
- One QBO realm per SiteCommand company (no multi-entity fan-out).
