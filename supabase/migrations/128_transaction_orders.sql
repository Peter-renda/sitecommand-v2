-- Accounting → Transaction Orders
--
-- Stores completed Transaction Order packets per project (the merged PDF
-- output of the source invoice + filled TO template) and an optional
-- per-project fillable TO template that overrides the default bundled
-- template shipped at /public/transaction-orders/Fillable_Transaction_Order_template.pdf.

CREATE TABLE IF NOT EXISTS project_transaction_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  vendor TEXT,
  amount NUMERIC,
  scope TEXT,
  pi_code TEXT,
  cost_code TEXT,
  to_date DATE,
  source_filename TEXT,
  source_storage_path TEXT,
  final_filename TEXT NOT NULL,
  final_storage_path TEXT NOT NULL,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_transaction_orders_project
  ON project_transaction_orders(project_id);

-- One stored Fillable TO template per project; uploading a new one upserts.
CREATE TABLE IF NOT EXISTS project_transaction_order_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ DEFAULT now(),
  uploaded_by UUID REFERENCES users(id)
);

-- Bucket for TO packets + per-project TO templates. Public=false so files
-- are only reachable via signed URLs.
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('transaction-orders', 'transaction-orders', false, 52428800)  -- 50 MB
ON CONFLICT (id) DO UPDATE SET file_size_limit = EXCLUDED.file_size_limit;
