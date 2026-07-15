ALTER TABLE assist_recurring_workflows
  ADD COLUMN IF NOT EXISTS run_minute_et INTEGER;

UPDATE assist_recurring_workflows
SET run_minute_et = COALESCE(run_minute_et, 0);

ALTER TABLE assist_recurring_workflows
  ALTER COLUMN run_minute_et SET NOT NULL;

ALTER TABLE assist_recurring_workflows
  ADD CONSTRAINT assist_recurring_workflows_run_minute_et_check
    CHECK (run_minute_et >= 0 AND run_minute_et <= 59);
