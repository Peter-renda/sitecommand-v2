-- Assist Recurring Workflow — Document Type
--
-- Lets a recurring workflow specify the output document format for its
-- generated reports. Supported values: 'pdf' (default) and 'word'.

ALTER TABLE assist_recurring_workflows
  ADD COLUMN IF NOT EXISTS document_type TEXT NOT NULL DEFAULT 'pdf'
  CHECK (document_type IN ('pdf', 'word'));

COMMENT ON COLUMN assist_recurring_workflows.document_type IS
  'Output document format for generated reports: pdf (default) or word.';

-- The reports table records the actual artifact type. Allow ''word'' alongside
-- the existing ''pdf'' / ''excel'' values.
ALTER TABLE assist_recurring_workflow_reports
  DROP CONSTRAINT IF EXISTS assist_recurring_workflow_reports_file_type_check;

ALTER TABLE assist_recurring_workflow_reports
  ADD CONSTRAINT assist_recurring_workflow_reports_file_type_check
  CHECK (file_type IN ('pdf', 'excel', 'word'));
