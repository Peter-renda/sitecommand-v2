-- Inbox emails a user has declined to link to a project from the Emails page
-- "New Emails" triage box. Dismissals are per (project, user, conversation)
-- because each user's inbox is their own: declining a thread hides it only for
-- that user on that project. A conversation appears as a triage card only when
-- it is neither linked to the project nor present in this table.

CREATE TABLE IF NOT EXISTS project_email_triage_dismissals (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id             UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id                UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  graph_conversation_id  TEXT NOT NULL,
  dismissed_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, user_id, graph_conversation_id)
);

CREATE INDEX IF NOT EXISTS idx_email_triage_dismissals_project_user
  ON project_email_triage_dismissals(project_id, user_id);
