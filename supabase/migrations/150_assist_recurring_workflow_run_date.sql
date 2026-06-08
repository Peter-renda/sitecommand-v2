ALTER TABLE assist_recurring_workflows
  ADD COLUMN IF NOT EXISTS run_date DATE;

COMMENT ON COLUMN assist_recurring_workflows.run_date IS
  'For monthly workflows: the chosen date. The day-of-month drives the recurring monthly run.';
