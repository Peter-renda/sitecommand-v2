-- Training → Practice: "SiteCommand Training" sandbox projects.
--
-- The project simulation now launches a real, fully-functional SiteCommand
-- project workspace in SANDBOX mode (a "SiteCommand Training" page) instead of
-- the old text-based, day-by-day grading game. The user picks a role and a
-- project type, a sandbox project is created, and it opens in a new browser tab
-- so the user can run the whole project hands-on with the real tools.
--
-- Sandbox projects are ordinary `projects` rows flagged here so they can be:
--   (a) branded as a training sandbox in the project workspace,
--   (b) hidden from the real dashboard / project lists / open-items, and
--   (c) scoped to (and deletable by) the user who launched them.

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS is_training            BOOLEAN NOT NULL DEFAULT false,
  -- The simulation role the user is running the sandbox as
  -- (superintendent | project_manager | accounting).
  ADD COLUMN IF NOT EXISTS training_role          TEXT,
  -- The simulation project type slug (multifamily, education, data_center, …).
  ADD COLUMN IF NOT EXISTS training_project_type  TEXT,
  -- The user who launched the sandbox. They own it; only they see and delete it.
  ADD COLUMN IF NOT EXISTS training_owner_id      UUID REFERENCES users(id) ON DELETE CASCADE,
  -- In-sim "day" counter. Advancing a day will (in a later iteration) deliver a
  -- new batch of fake emails / events into the sandbox inbox. 0 = day one not
  -- yet started.
  ADD COLUMN IF NOT EXISTS training_day           INTEGER NOT NULL DEFAULT 0;

-- Fast lookup of a user's own sandboxes for the Training → Practice list.
CREATE INDEX IF NOT EXISTS idx_projects_training_owner
  ON projects(training_owner_id)
  WHERE is_training;
