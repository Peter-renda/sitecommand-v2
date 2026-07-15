-- ERP idempotency + financial-feedback columns for change_orders.
--
-- Mirrors the pattern used by commitments (migrations 113 / 160 / 161):
-- QBO columns for QuickBooks Online, sage300cre columns for Sage 300 CRE.
-- Both ERPs share the same erp_status column that already exists on the table.
-- A change order syncs as a single ERP document (Bill / PO / Invoice), so
-- there is no secondary "ap_invoice / ar_invoice" tracking split here.

ALTER TABLE change_orders
  -- QuickBooks Online idempotency
  ADD COLUMN IF NOT EXISTS qbo_id               TEXT,
  ADD COLUMN IF NOT EXISTS qbo_sync_token       TEXT,
  ADD COLUMN IF NOT EXISTS qbo_synced_at        TIMESTAMPTZ,

  -- QuickBooks Online accounting feedback
  ADD COLUMN IF NOT EXISTS qbo_total_amount     NUMERIC(15,2),
  ADD COLUMN IF NOT EXISTS qbo_balance          NUMERIC(15,2),
  ADD COLUMN IF NOT EXISTS qbo_payment_status   TEXT,
  ADD COLUMN IF NOT EXISTS qbo_payments_refreshed_at TIMESTAMPTZ,

  -- Sage 300 CRE (via Agave) idempotency
  ADD COLUMN IF NOT EXISTS sage300cre_id        TEXT,
  ADD COLUMN IF NOT EXISTS sage300cre_synced_at TIMESTAMPTZ,

  -- Sage 300 CRE accounting feedback
  ADD COLUMN IF NOT EXISTS sage300cre_status       TEXT,
  ADD COLUMN IF NOT EXISTS sage300cre_total_amount NUMERIC(15,2),
  ADD COLUMN IF NOT EXISTS sage300cre_amount_paid  NUMERIC(15,2),
  ADD COLUMN IF NOT EXISTS sage300cre_balance      NUMERIC(15,2),
  ADD COLUMN IF NOT EXISTS sage300cre_payments_refreshed_at TIMESTAMPTZ;

NOTIFY pgrst, 'reload schema';
