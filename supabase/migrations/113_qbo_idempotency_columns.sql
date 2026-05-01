-- 113_qbo_idempotency_columns.sql
--
-- Adds tracking columns so QBO sync can be re-run safely (update vs create)
-- and so the cron job can detect "dirty" rows that need re-sync.
--
-- Tracked QBO references:
--   commitments        : qbo_id, qbo_sync_token, last_synced_at         -- the Bill or PurchaseOrder
--                        qbo_ap_invoice_id, qbo_ap_invoice_synced_at   -- the AP Bill from SOV
--   prime_contracts    : qbo_id, qbo_sync_token, last_synced_at         -- the AR Invoice
--                        qbo_ar_invoice_id, qbo_ar_invoice_synced_at   -- the AR Invoice from SOV
--
-- Also backfills updated_at on commitments and commitment_sov_items so the
-- cron can compare row freshness to last_synced_at.

-- ── commitments: idempotency + freshness ─────────────────────────────────────
ALTER TABLE commitments ADD COLUMN IF NOT EXISTS qbo_id                    TEXT;
ALTER TABLE commitments ADD COLUMN IF NOT EXISTS qbo_sync_token            TEXT;
ALTER TABLE commitments ADD COLUMN IF NOT EXISTS last_synced_at            TIMESTAMPTZ;
ALTER TABLE commitments ADD COLUMN IF NOT EXISTS qbo_ap_invoice_id         TEXT;
ALTER TABLE commitments ADD COLUMN IF NOT EXISTS qbo_ap_invoice_sync_token TEXT;
ALTER TABLE commitments ADD COLUMN IF NOT EXISTS qbo_ap_invoice_synced_at  TIMESTAMPTZ;
ALTER TABLE commitments ADD COLUMN IF NOT EXISTS updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- ── commitment_sov_items: freshness ──────────────────────────────────────────
ALTER TABLE commitment_sov_items ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- ── prime_contracts: idempotency ─────────────────────────────────────────────
ALTER TABLE prime_contracts ADD COLUMN IF NOT EXISTS qbo_id                    TEXT;
ALTER TABLE prime_contracts ADD COLUMN IF NOT EXISTS qbo_sync_token            TEXT;
ALTER TABLE prime_contracts ADD COLUMN IF NOT EXISTS last_synced_at            TIMESTAMPTZ;
ALTER TABLE prime_contracts ADD COLUMN IF NOT EXISTS qbo_ar_invoice_id         TEXT;
ALTER TABLE prime_contracts ADD COLUMN IF NOT EXISTS qbo_ar_invoice_sync_token TEXT;
ALTER TABLE prime_contracts ADD COLUMN IF NOT EXISTS qbo_ar_invoice_synced_at  TIMESTAMPTZ;
-- prime_contracts.updated_at and prime_contract_sov_items.updated_at already exist (059_prime_contracts.sql)

-- ── updated_at triggers (only added where missing) ───────────────────────────
CREATE OR REPLACE FUNCTION set_commitments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_commitments_updated_at ON commitments;
CREATE TRIGGER trg_commitments_updated_at
BEFORE UPDATE ON commitments
FOR EACH ROW
EXECUTE FUNCTION set_commitments_updated_at();

CREATE OR REPLACE FUNCTION set_commitment_sov_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_commitment_sov_items_updated_at ON commitment_sov_items;
CREATE TRIGGER trg_commitment_sov_items_updated_at
BEFORE UPDATE ON commitment_sov_items
FOR EACH ROW
EXECUTE FUNCTION set_commitment_sov_items_updated_at();

-- ── Indexes for cron lookups ─────────────────────────────────────────────────
-- Cron walks all companies' dirty rows: filter by company_id (via project), then
-- compare updated_at vs last_synced_at. Partial index keeps the touched set small.
CREATE INDEX IF NOT EXISTS commitments_qbo_dirty_idx
  ON commitments (project_id, updated_at)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS prime_contracts_qbo_dirty_idx
  ON prime_contracts (project_id, updated_at)
  WHERE deleted_at IS NULL;

NOTIFY pgrst, 'reload schema';
