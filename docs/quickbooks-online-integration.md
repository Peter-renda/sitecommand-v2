# Intuit accounting integration (QBO + Intuit Enterprise Suite)

This integration is **manual push sync** (not automatic continuous sync). You connect an Intuit accounting tenant once, then push records from SiteCommand as needed.

It supports both **QuickBooks Online (QBO)** and **Intuit Enterprise Suite (IES)** tenants that expose the Intuit accounting APIs.

## What currently syncs

`POST /api/integrations/quickbooks/sync` supports these record types:

- `commitments` → creates a **QBO Bill** (subcontract) or **Purchase Order**
- `prime_contracts` → creates a **QBO AR Invoice**
- `ap_invoice` → creates a **QBO Bill** from commitment SOV billed-to-date amounts
- `ar_invoice` → creates a **QBO AR Invoice** from prime contract SOV current-period amounts

## Setup (company super admin)

1. Go to **Settings → Integrations → QuickBooks Online**.
2. Enter your Intuit app credentials (`QBO_CLIENT_ID`, `QBO_CLIENT_SECRET`) and save.
3. Click **Connect QuickBooks** to run OAuth.
4. On successful callback, SiteCommand stores:
   - `QBO_REALM_ID`
   - `QBO_ACCESS_TOKEN`
   - `QBO_REFRESH_TOKEN`

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

## Current limitations

- Sync is currently **push-only** from SiteCommand to QBO.
- There is no background scheduler for automatic recurring sync jobs.
- Mapping is name-based for customer/vendor records when creating transactions.


## Enterprise Suite compatibility

- OAuth uses Intuit accounting scopes and the same token exchange flow used by QBO.
- API calls target Intuit's `v3/company/{realmId}` accounting endpoints, which are shared by QBO-compatible accounting tenants.
- Optional: set `INTUIT_OAUTH_SCOPES` if your Intuit app requires additional scopes in your enterprise environment.
