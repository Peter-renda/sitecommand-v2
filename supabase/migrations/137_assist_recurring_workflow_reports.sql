-- Assist Recurring Workflow Reports
-- Stores generated report artifacts (PDF/XLSX) for recurring Assist workflows.

CREATE TABLE IF NOT EXISTS assist_recurring_workflow_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES assist_recurring_workflows(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('pdf', 'excel')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assist_recurring_workflow_reports_workflow_created
  ON assist_recurring_workflow_reports(workflow_id, created_at DESC);
