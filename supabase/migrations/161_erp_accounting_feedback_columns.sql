-- 161_erp_accounting_feedback_columns.sql
--
-- Accounting feedback fields pulled BACK from the connected ERPs so project
-- teams can see, inside SiteCommand, what accounting actually recorded:
--
--   * the resolved ERP party id (QBO Vendor/Customer, Agave vendor/customer)
--   * the posted document totals as the ERP computed them
--   * the open balance / amount paid against AP Bills and AR Invoices
--   * a derived payment status (paid / partially_paid / unpaid)
--
-- Populated on every successful push sync (the create/update response carries
-- the live totals) and refreshable on demand via
--   POST /api/integrations/quickbooks/refresh
--   POST /api/integrations/sage300cre/refresh
-- plus a capped daily refresh pass inside each sync cron, so payment activity
-- that happens entirely inside the ERP still flows back without a local edit.
--
-- qbo_payment_status / *_payment_status values: 'paid' | 'partially_paid' |
-- 'unpaid' (posting docs), or the lowercased doc status for non-posting docs
-- (e.g. a QBO PurchaseOrder reports 'open' / 'closed').

-- ── commitments (AP side) ─────────────────────────────────────────────────────
ALTER TABLE commitments ADD COLUMN IF NOT EXISTS qbo_vendor_id                  TEXT;
ALTER TABLE commitments ADD COLUMN IF NOT EXISTS qbo_total_amount               NUMERIC(15,2);
ALTER TABLE commitments ADD COLUMN IF NOT EXISTS qbo_balance                    NUMERIC(15,2);
ALTER TABLE commitments ADD COLUMN IF NOT EXISTS qbo_payment_status             TEXT;
ALTER TABLE commitments ADD COLUMN IF NOT EXISTS qbo_ap_invoice_total_amount    NUMERIC(15,2);
ALTER TABLE commitments ADD COLUMN IF NOT EXISTS qbo_ap_invoice_balance         NUMERIC(15,2);
ALTER TABLE commitments ADD COLUMN IF NOT EXISTS qbo_ap_invoice_payment_status  TEXT;
ALTER TABLE commitments ADD COLUMN IF NOT EXISTS qbo_payments_refreshed_at      TIMESTAMPTZ;

ALTER TABLE commitments ADD COLUMN IF NOT EXISTS sage300cre_vendor_id                  TEXT;
ALTER TABLE commitments ADD COLUMN IF NOT EXISTS sage300cre_status                     TEXT;
ALTER TABLE commitments ADD COLUMN IF NOT EXISTS sage300cre_ap_invoice_total_amount    NUMERIC(15,2);
ALTER TABLE commitments ADD COLUMN IF NOT EXISTS sage300cre_ap_invoice_amount_paid     NUMERIC(15,2);
ALTER TABLE commitments ADD COLUMN IF NOT EXISTS sage300cre_ap_invoice_balance         NUMERIC(15,2);
ALTER TABLE commitments ADD COLUMN IF NOT EXISTS sage300cre_ap_invoice_status          TEXT;
ALTER TABLE commitments ADD COLUMN IF NOT EXISTS sage300cre_payments_refreshed_at      TIMESTAMPTZ;

-- ── prime_contracts (AR side) ─────────────────────────────────────────────────
ALTER TABLE prime_contracts ADD COLUMN IF NOT EXISTS qbo_customer_id                TEXT;
ALTER TABLE prime_contracts ADD COLUMN IF NOT EXISTS qbo_total_amount               NUMERIC(15,2);
ALTER TABLE prime_contracts ADD COLUMN IF NOT EXISTS qbo_balance                    NUMERIC(15,2);
ALTER TABLE prime_contracts ADD COLUMN IF NOT EXISTS qbo_payment_status             TEXT;
ALTER TABLE prime_contracts ADD COLUMN IF NOT EXISTS qbo_ar_invoice_total_amount    NUMERIC(15,2);
ALTER TABLE prime_contracts ADD COLUMN IF NOT EXISTS qbo_ar_invoice_balance         NUMERIC(15,2);
ALTER TABLE prime_contracts ADD COLUMN IF NOT EXISTS qbo_ar_invoice_payment_status  TEXT;
ALTER TABLE prime_contracts ADD COLUMN IF NOT EXISTS qbo_payments_refreshed_at      TIMESTAMPTZ;

ALTER TABLE prime_contracts ADD COLUMN IF NOT EXISTS sage300cre_customer_id                TEXT;
ALTER TABLE prime_contracts ADD COLUMN IF NOT EXISTS sage300cre_total_amount               NUMERIC(15,2);
ALTER TABLE prime_contracts ADD COLUMN IF NOT EXISTS sage300cre_amount_paid                NUMERIC(15,2);
ALTER TABLE prime_contracts ADD COLUMN IF NOT EXISTS sage300cre_balance                    NUMERIC(15,2);
ALTER TABLE prime_contracts ADD COLUMN IF NOT EXISTS sage300cre_status                     TEXT;
ALTER TABLE prime_contracts ADD COLUMN IF NOT EXISTS sage300cre_ar_invoice_total_amount    NUMERIC(15,2);
ALTER TABLE prime_contracts ADD COLUMN IF NOT EXISTS sage300cre_ar_invoice_amount_paid     NUMERIC(15,2);
ALTER TABLE prime_contracts ADD COLUMN IF NOT EXISTS sage300cre_ar_invoice_balance         NUMERIC(15,2);
ALTER TABLE prime_contracts ADD COLUMN IF NOT EXISTS sage300cre_ar_invoice_status          TEXT;
ALTER TABLE prime_contracts ADD COLUMN IF NOT EXISTS sage300cre_payments_refreshed_at      TIMESTAMPTZ;

NOTIFY pgrst, 'reload schema';
