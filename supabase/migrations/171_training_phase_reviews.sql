-- Training sandbox: persisted phase "Job Reviews".
--
-- Each SiteCommand Training sandbox runs a project through phased periods (see
-- lib/training-schedule.ts). At the end of a phase the trainee gets a milestone
-- Job Review (AI narrative + highlights + per-missed-task catch-up). These used
-- to be generated on the fly and cached only in the browser's localStorage, so
-- they couldn't be listed or reopened reliably. Persist them here, one row per
-- (project, phase), so the Training → Practice list can expand a sandbox and link
-- to each of its saved reviews.

CREATE TABLE IF NOT EXISTS training_phase_reviews (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  -- The schedule phase this review covers (e.g. "Buyout & Preconstruction").
  phase       TEXT NOT NULL,
  -- A representative schedule day for the phase, used to build the review link
  -- (/training/review?project=…&day=…) back from the list.
  day         INTEGER NOT NULL DEFAULT 0,
  -- AI narrative + structured callouts + per-missed-task resolutions.
  review      TEXT  NOT NULL DEFAULT '',
  highlights  JSONB NOT NULL DEFAULT '[]'::jsonb,
  resolutions JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Snapshot of the tasks split at review time.
  completed   JSONB NOT NULL DEFAULT '[]'::jsonb,
  missed      JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Set once the trainee closes out the review (missed tasks auto-caught-up).
  closed_out  BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, phase)
);

CREATE INDEX IF NOT EXISTS idx_training_phase_reviews_project
  ON training_phase_reviews(project_id);
