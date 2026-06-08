ALTER TABLE assist_recurring_workflows
  ADD COLUMN IF NOT EXISTS run_day_of_month INTEGER CHECK (run_day_of_month BETWEEN 1 AND 31);

COMMENT ON COLUMN assist_recurring_workflows.run_day_of_month IS
  'For monthly workflows: the day-of-month (1–31) to run. If the chosen day exceeds the month length, runs on the last day of that month.';
