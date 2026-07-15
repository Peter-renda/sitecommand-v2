-- Email conversation threads manually linked to a project.
-- graph_conversation_id is Microsoft Graph's immutable conversation ID
-- that groups all replies in a thread together.

CREATE TABLE IF NOT EXISTS project_email_threads (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id               UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  graph_conversation_id    TEXT NOT NULL,
  subject                  TEXT NOT NULL DEFAULT '',
  participants             JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- participants shape: [{ name, email }]
  latest_message_preview   TEXT NOT NULL DEFAULT '',
  latest_received_at       TIMESTAMPTZ,
  message_count            INT NOT NULL DEFAULT 1,
  linked_by                UUID REFERENCES users(id),
  linked_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, graph_conversation_id)
);

CREATE INDEX IF NOT EXISTS idx_project_email_threads_project
  ON project_email_threads(project_id);
