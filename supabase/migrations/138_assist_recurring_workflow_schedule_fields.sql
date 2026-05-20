ALTER TABLE assist_recurring_workflows
  ADD COLUMN IF NOT EXISTS run_day_of_week TEXT,
  ADD COLUMN IF NOT EXISTS run_hour_et INTEGER;

UPDATE assist_recurring_workflows
SET
  run_day_of_week = COALESCE(run_day_of_week, 'monday'),
  run_hour_et = COALESCE(run_hour_et, 6);

ALTER TABLE assist_recurring_workflows
  ALTER COLUMN run_day_of_week SET NOT NULL,
  ALTER COLUMN run_hour_et SET NOT NULL;

ALTER TABLE assist_recurring_workflows
  ADD CONSTRAINT assist_recurring_workflows_run_day_of_week_check
    CHECK (run_day_of_week IN ('sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'));

ALTER TABLE assist_recurring_workflows
  ADD CONSTRAINT assist_recurring_workflows_run_hour_et_check
    CHECK (run_hour_et >= 0 AND run_hour_et <= 23);
