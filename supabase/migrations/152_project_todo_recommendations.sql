-- AI-generated "To Do" recommendations for the Tasks page.
--
-- A daily cron (4am) asks the LLM to suggest to-do items per project based on
-- recent emails, where the project sits in its schedule (lead times), and other
-- project signals. Each recommendation can be accepted (which spawns a real
-- task), ignored, or snoozed to resurface 1 day / 1 week / 2 weeks later.

CREATE TABLE IF NOT EXISTS project_todo_recommendations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

  title            TEXT NOT NULL,
  -- Rationale: why this is recommended (lead-time reasoning, the email/meeting
  -- it came from, schedule position, etc.).
  rationale        TEXT NOT NULL DEFAULT '',
  -- Short human label for what the suggestion is grounded in
  -- (e.g. "Email from GC", "Submittal lead time", "Schedule").
  source           TEXT NOT NULL DEFAULT '',
  category         TEXT,
  priority         TEXT NOT NULL DEFAULT 'medium'
                     CHECK (priority IN ('high', 'medium', 'low')),
  suggested_due_date DATE,

  -- pending  : currently actionable (visible in the To Do section)
  -- accepted : converted into a task (see accepted_task_id)
  -- ignored  : dismissed by the user (never resurfaces)
  status           TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'accepted', 'ignored')),
  -- When set in the future, a pending recommendation is hidden until this time
  -- ("remind me later"). Cleared (null) means show immediately.
  snoozed_until    TIMESTAMPTZ,

  -- Normalized slug of the title used to avoid re-suggesting the same item on
  -- subsequent daily runs (unique per project across all statuses).
  dedupe_key       TEXT NOT NULL,

  accepted_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  acted_by         UUID REFERENCES users(id) ON DELETE SET NULL,
  acted_at         TIMESTAMPTZ,

  generated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (project_id, dedupe_key)
);

CREATE INDEX IF NOT EXISTS idx_project_todo_recommendations_active
  ON project_todo_recommendations(project_id, status, snoozed_until);
