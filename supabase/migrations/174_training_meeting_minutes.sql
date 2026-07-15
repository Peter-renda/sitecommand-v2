-- Training sandbox: persisted meeting minutes + effectiveness scoring.
--
-- Interactive text meetings (lib/training-meetings.ts) carry hidden
-- "checkpoints" — planted tests the trainee is expected to catch (e.g. the
-- owner agreement requires the first slab pour within 30 days of NTP). When a
-- meeting adjourns, the transcript is scored against those checkpoints and
-- formal minutes are generated; both persist here, one row per
-- (project, meeting). Reopening the meeting hyperlink after completion shows
-- the saved minutes, and the phase Job Review links to them.

CREATE TABLE IF NOT EXISTS training_meeting_minutes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  -- Meeting definition id from lib/training-meetings.ts (e.g.
  -- "pm-day1-bid-review"). Not a foreign key — meetings are static content.
  meeting_id   TEXT NOT NULL,
  -- Denormalized for listing without re-resolving the content module.
  title        TEXT NOT NULL DEFAULT '',
  day          INTEGER NOT NULL DEFAULT 0,
  -- Formal minutes: { summary, decisions: [], actionItems: [] }.
  minutes      JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Per-checkpoint scoring: [{ id, title, caught, note }].
  checkpoints  JSONB NOT NULL DEFAULT '[]'::jsonb,
  score_caught INTEGER NOT NULL DEFAULT 0,
  score_total  INTEGER NOT NULL DEFAULT 0,
  -- Full transcript snapshot [{ speaker, text }] so minutes survive across
  -- browsers (the live meeting state only lives in localStorage).
  transcript   JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, meeting_id)
);

CREATE INDEX IF NOT EXISTS idx_training_meeting_minutes_project
  ON training_meeting_minutes(project_id);
