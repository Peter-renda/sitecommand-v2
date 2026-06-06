-- Per-user Outlook / Microsoft 365 OAuth connections.
-- One row per user per provider (currently only 'outlook').
-- Tokens are stored in plain text; encrypt at the application layer if
-- your compliance requirements demand it.

CREATE TABLE IF NOT EXISTS user_email_connections (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider              TEXT NOT NULL DEFAULT 'outlook',
  ms_user_email         TEXT,
  ms_user_display_name  TEXT,
  access_token          TEXT NOT NULL,
  refresh_token         TEXT NOT NULL,
  token_expires_at      TIMESTAMPTZ NOT NULL,
  sync_mode             TEXT NOT NULL DEFAULT 'manual',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_user_email_connections_user
  ON user_email_connections(user_id);
