-- Per-project Daily Log column configuration, managed by company super admins.
--
-- config shape (keyed by daily log section):
-- {
--   "manpower": {
--     "hidden": ["cost_code"],                          -- built-in columns to hide
--     "custom": [{ "key": "c_ab12cd34", "label": "Shift" }]  -- extra text columns
--   },
--   ...
-- }
-- Custom values are stored on each entry under entry.custom[key] inside the
-- existing daily_logs JSONB section arrays, so no log schema change is needed.

CREATE TABLE IF NOT EXISTS daily_log_field_configs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
  config     JSONB NOT NULL DEFAULT '{}',
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
