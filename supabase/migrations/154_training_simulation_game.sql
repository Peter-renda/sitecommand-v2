-- Training → Practice: the project simulation "game".
--
-- A logged-in user can start a simulated construction project, pick their role
-- (superintendent, project manager, accounting) and a project type (multifamily,
-- education, data center, etc.), then play through the project one (or up to
-- seven) simulated day(s) at a time. Each simulated day produces a narrative
-- summary, a set of events (some of which are problems like a sub running behind
-- or a safety violation), and a list of required actions the user must complete
-- to run the project (daily logs, PCOs, RFIs, emails, etc.). The user's
-- submitted actions are graded by AI and contribute to a running score. Scoring
-- can be reviewed weekly, monthly, or only at the end of the project.

-- One row per simulation a user starts.
CREATE TABLE IF NOT EXISTS simulation_games (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- The role the player is running the project as.
  role               TEXT NOT NULL
                       CHECK (role IN ('superintendent', 'project_manager', 'accounting')),
  -- The type of project being simulated (multifamily, education, data_center, …).
  project_type       TEXT NOT NULL,

  -- AI-generated project identity / setup.
  project_name       TEXT NOT NULL DEFAULT '',
  project_overview   TEXT NOT NULL DEFAULT '',
  location           TEXT NOT NULL DEFAULT '',
  contract_value     NUMERIC NOT NULL DEFAULT 0,
  -- Total working days the simulated project runs for.
  total_days         INTEGER NOT NULL DEFAULT 30,
  -- Calendar date day 1 of the project maps to.
  start_date         DATE NOT NULL DEFAULT CURRENT_DATE,

  -- How many days have been simulated so far (0 = not started).
  current_day        INTEGER NOT NULL DEFAULT 0,

  -- When to surface a score report: every week, every month, or only at the end.
  scoring_frequency  TEXT NOT NULL DEFAULT 'weekly'
                       CHECK (scoring_frequency IN ('weekly', 'monthly', 'project_end')),
  -- How many simulated days a single "Advance" steps through (1–7).
  days_per_advance   INTEGER NOT NULL DEFAULT 1
                       CHECK (days_per_advance BETWEEN 1 AND 7),

  -- active = in progress, completed = reached total_days, abandoned = user deleted.
  status             TEXT NOT NULL DEFAULT 'active'
                       CHECK (status IN ('active', 'completed', 'abandoned')),

  -- Running score earned vs. the maximum points offered on required actions.
  score              NUMERIC NOT NULL DEFAULT 0,
  max_score          NUMERIC NOT NULL DEFAULT 0,

  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_simulation_games_user
  ON simulation_games(user_id, status, updated_at DESC);

-- One row per simulated day of a game.
CREATE TABLE IF NOT EXISTS simulation_days (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id            UUID NOT NULL REFERENCES simulation_games(id) ON DELETE CASCADE,

  day_number         INTEGER NOT NULL,
  -- In-game calendar date for this day.
  sim_date           DATE NOT NULL,
  weather            TEXT NOT NULL DEFAULT '',

  -- Narrative recap of everything that happened on the site this day.
  summary            TEXT NOT NULL DEFAULT '',
  -- [{ id, type, severity, title, description }] — what occurred, incl. problems.
  events             JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- [{ id, action_type, title, description, points }] — what the user must do.
  required_actions   JSONB NOT NULL DEFAULT '[]'::jsonb,

  generated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (game_id, day_number)
);

CREATE INDEX IF NOT EXISTS idx_simulation_days_game
  ON simulation_days(game_id, day_number);

-- One row per action the user submits in response to a day's required actions
-- (or proactively). Each is graded by AI.
CREATE TABLE IF NOT EXISTS simulation_actions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id            UUID NOT NULL REFERENCES simulation_games(id) ON DELETE CASCADE,
  day_id             UUID REFERENCES simulation_days(id) ON DELETE CASCADE,
  day_number         INTEGER NOT NULL DEFAULT 0,

  -- The required action this addresses (matches required_actions[].id), or null
  -- if the user took a proactive action that wasn't explicitly required.
  required_action_id TEXT,
  -- daily_log, pco, rfi, email, safety_report, schedule_update, invoice, …
  action_type        TEXT NOT NULL DEFAULT 'note',
  title              TEXT NOT NULL DEFAULT '',
  -- The user's submitted content.
  content            TEXT NOT NULL DEFAULT '',

  -- AI grading.
  score              NUMERIC NOT NULL DEFAULT 0,
  max_score          NUMERIC NOT NULL DEFAULT 0,
  feedback           TEXT NOT NULL DEFAULT '',

  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_simulation_actions_game
  ON simulation_actions(game_id, day_number);

-- A score "report" generated at a scoring boundary (weekly / monthly / project
-- end) summarizing how the user did over the covered span of days.
CREATE TABLE IF NOT EXISTS simulation_score_reports (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id            UUID NOT NULL REFERENCES simulation_games(id) ON DELETE CASCADE,

  -- weekly | monthly | project_end
  period_kind        TEXT NOT NULL DEFAULT 'weekly',
  label              TEXT NOT NULL DEFAULT '',
  from_day           INTEGER NOT NULL DEFAULT 1,
  to_day             INTEGER NOT NULL DEFAULT 1,

  score              NUMERIC NOT NULL DEFAULT 0,
  max_score          NUMERIC NOT NULL DEFAULT 0,
  -- Letter grade or rating derived from the percentage.
  grade              TEXT NOT NULL DEFAULT '',
  -- AI narrative review of the period: what went well, what was missed.
  review             TEXT NOT NULL DEFAULT '',

  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (game_id, to_day)
);

CREATE INDEX IF NOT EXISTS idx_simulation_score_reports_game
  ON simulation_score_reports(game_id, to_day);
