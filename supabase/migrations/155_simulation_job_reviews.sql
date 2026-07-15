-- Training → Practice: the every-four-weeks "Job Review".
--
-- The project simulation runs in working days (5 working days = 1 week). Every
-- four weeks (a 20-working-day block) the player gets a milestone "Job Review":
-- a dedicated page listing every required task across the block — completed and
-- missed — with an AI narrative that calls out what was handled well and what
-- slipped (e.g. submittals not reviewed in time, an important RFI never asked).
-- When the player closes out the review, any still-missed tasks are
-- auto-completed (submittals approved, scheduling emails sent/received, etc.) so
-- the simulated project stays consistent and the player is caught back up.

-- One row per 4-week (or final partial) review block of a game.
CREATE TABLE IF NOT EXISTS simulation_job_reviews (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id          UUID NOT NULL REFERENCES simulation_games(id) ON DELETE CASCADE,

  -- The Nth review of the project (1 = weeks 1–4, 2 = weeks 5–8, …).
  review_number    INTEGER NOT NULL,

  -- Day / week span the review covers (inclusive). A final partial block may be
  -- shorter than 20 days.
  from_day         INTEGER NOT NULL,
  to_day           INTEGER NOT NULL,
  from_week        INTEGER NOT NULL,
  to_week          INTEGER NOT NULL,
  -- True when this review closes out the project (covers the final tail).
  is_final         BOOLEAN NOT NULL DEFAULT false,

  -- open = waiting for the player to review/close out; acknowledged = closed out
  -- and any missed tasks have been auto-completed (catch-up applied).
  status           TEXT NOT NULL DEFAULT 'open'
                     CHECK (status IN ('open', 'acknowledged')),
  -- Whether the AI narrative/highlights/resolutions have been produced yet.
  generated        BOOLEAN NOT NULL DEFAULT false,

  -- Period score: points earned vs. points possible across the block.
  score            NUMERIC NOT NULL DEFAULT 0,
  max_score        NUMERIC NOT NULL DEFAULT 0,
  grade            TEXT NOT NULL DEFAULT '',

  -- AI narrative review of the block.
  review           TEXT NOT NULL DEFAULT '',
  -- Structured callouts: [{ kind: 'praise'|'warning'|'missed_submittal'|
  -- 'missed_rfi'|'tip', text }].
  highlights       JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Per-missed-task catch-up notes: [{ required_action_id, action_type, title,
  -- resolution }] — what gets fabricated to catch the player up on close-out.
  resolutions      JSONB NOT NULL DEFAULT '[]'::jsonb,

  completed_count  INTEGER NOT NULL DEFAULT 0,
  missed_count     INTEGER NOT NULL DEFAULT 0,
  -- How many tasks were auto-completed when the player closed out the review.
  catch_up_count   INTEGER NOT NULL DEFAULT 0,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  generated_at     TIMESTAMPTZ,
  acknowledged_at  TIMESTAMPTZ,

  UNIQUE (game_id, review_number)
);

CREATE INDEX IF NOT EXISTS idx_simulation_job_reviews_game
  ON simulation_job_reviews(game_id, review_number);

-- Mark actions that were auto-filled by a Job Review catch-up rather than
-- submitted by the player, so the UI can distinguish them and scoring can keep
-- them at zero points (the player still "missed" them).
ALTER TABLE simulation_actions
  ADD COLUMN IF NOT EXISTS auto_completed BOOLEAN NOT NULL DEFAULT false;
