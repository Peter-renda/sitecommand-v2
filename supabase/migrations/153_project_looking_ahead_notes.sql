-- AI-generated "Looking Ahead" briefing notes for the Assist page.
--
-- A daily cron studies where a project sits (plans, specs, contracts,
-- commitments, emails, schedule, RFIs, submittals, daily logs, etc.) and writes
-- a short list of things-to-know / things-to-remember the team should keep in
-- mind given the current stage of work. Unlike the Tasks "To Do" section (which
-- proposes actionable tasks), these are informational facts to commit to memory
-- — e.g. "Per the supplier's May 3 email, structure C15 is ~2 weeks late" or
-- "Stormwater plans show 1,240 LF of RCP on site".
--
-- Each note can be pinned (kept visible), dismissed (hidden permanently), or
-- snoozed to resurface 1 day / 1 week / 2 weeks later.

CREATE TABLE IF NOT EXISTS project_looking_ahead_notes (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

  -- Short statement of the thing to know/remember.
  headline         TEXT NOT NULL,
  -- Supporting specifics: the quantity, date, who said what, where it came from.
  detail           TEXT NOT NULL DEFAULT '',
  -- Short human label for what the note is grounded in
  -- (e.g. "Supplier email", "Stormwater plans", "Schedule", "Submittal log").
  source           TEXT NOT NULL DEFAULT '',
  category         TEXT,
  priority         TEXT NOT NULL DEFAULT 'medium'
                     CHECK (priority IN ('high', 'medium', 'low')),

  -- pending   : currently shown in the Looking Ahead section
  -- dismissed : hidden by the user (never resurfaces)
  status           TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'dismissed')),
  -- Pinned notes stay at the top and are kept even as fresh notes are generated.
  pinned           BOOLEAN NOT NULL DEFAULT false,
  -- When set in the future, a pending note is hidden until this time
  -- ("remind me later"). Null means show immediately.
  snoozed_until    TIMESTAMPTZ,

  -- Normalized slug of the headline used to avoid re-surfacing the same note on
  -- subsequent daily runs (unique per project across all statuses).
  dedupe_key       TEXT NOT NULL,

  acted_by         UUID REFERENCES users(id) ON DELETE SET NULL,
  acted_at         TIMESTAMPTZ,

  generated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (project_id, dedupe_key)
);

CREATE INDEX IF NOT EXISTS idx_project_looking_ahead_notes_active
  ON project_looking_ahead_notes(project_id, status, snoozed_until);
