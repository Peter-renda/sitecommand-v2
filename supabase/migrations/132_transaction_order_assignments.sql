-- Transaction Order Assignments
--
-- Lets a Transaction Orders admin route an invoice PDF to another
-- project's Project Manager (and additional directory contacts) so it
-- shows up on their dashboard open-items list and on the target
-- project's Transaction Orders page, where they can convert it into a
-- completed Transaction Order.
--
-- Files live in the existing `project-drawings` bucket under
-- `{targetProjectId}/_assignments/...`.

CREATE TABLE IF NOT EXISTS transaction_order_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES users(id),
  invoice_filename TEXT NOT NULL,
  invoice_storage_path TEXT NOT NULL,
  notes TEXT,
  recipients JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- recipients shape: [{ contactId, userId | null, email, name, role }]
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_transaction_order_assignments_project
  ON transaction_order_assignments(project_id);

CREATE INDEX IF NOT EXISTS idx_transaction_order_assignments_status
  ON transaction_order_assignments(status);
