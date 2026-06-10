-- 160_sage300cre_idempotency_columns.sql
--
-- Adds tracking columns so the Sage 300 CRE (Agave) sync can be re-run safely
-- (update vs create) and the cron job can detect "dirty" rows that need re-sync.
--
-- These live alongside the existing qbo_* idempotency columns (113) so a company
-- can sync the same record to QuickBooks Online and Sage 300 CRE independently.
-- Agave has no SyncToken concept (updates are PUT /{resource}/{id}), so unlike
-- the QBO columns there is no *_sync_token here.
--
-- Tracked Agave references:
--   commitments     : sage300cre_id, sage300cre_synced_at              -- the Purchase Order
--                     sage300cre_ap_invoice_id, sage300cre_ap_invoice_synced_at  -- AP Invoice from SOV
--   prime_contracts : sage300cre_id, sage300cre_synced_at              -- the AR Invoice
--                     sage300cre_ar_invoice_id, sage300cre_ar_invoice_synced_at  -- AR Invoice from SOV
--
-- The updated_at columns, freshness triggers, and dirty-row indexes used by the
-- cron already exist (113_qbo_idempotency_columns.sql), so they are not repeated.

-- ── commitments ──────────────────────────────────────────────────────────────
ALTER TABLE commitments ADD COLUMN IF NOT EXISTS sage300cre_id                   TEXT;
ALTER TABLE commitments ADD COLUMN IF NOT EXISTS sage300cre_synced_at            TIMESTAMPTZ;
ALTER TABLE commitments ADD COLUMN IF NOT EXISTS sage300cre_ap_invoice_id        TEXT;
ALTER TABLE commitments ADD COLUMN IF NOT EXISTS sage300cre_ap_invoice_synced_at TIMESTAMPTZ;

-- ── prime_contracts ──────────────────────────────────────────────────────────
ALTER TABLE prime_contracts ADD COLUMN IF NOT EXISTS sage300cre_id                   TEXT;
ALTER TABLE prime_contracts ADD COLUMN IF NOT EXISTS sage300cre_synced_at            TIMESTAMPTZ;
ALTER TABLE prime_contracts ADD COLUMN IF NOT EXISTS sage300cre_ar_invoice_id        TEXT;
ALTER TABLE prime_contracts ADD COLUMN IF NOT EXISTS sage300cre_ar_invoice_synced_at TIMESTAMPTZ;

NOTIFY pgrst, 'reload schema';
