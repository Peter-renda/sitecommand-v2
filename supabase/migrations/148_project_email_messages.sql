-- Stored copies of the individual messages within a linked email thread.
-- Previously message bodies were only ever fetched live from the viewer's
-- own Outlook/Gmail connection. Persisting them here means:
--   * threads stay readable even when no one with a live connection is viewing,
--   * replies sent later are captured, and
--   * SiteCommand Assist can read the full email text as project context.

CREATE TABLE IF NOT EXISTS project_email_messages (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id             UUID NOT NULL REFERENCES project_email_threads(id) ON DELETE CASCADE,
  project_id            UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  -- The provider's own message id (Graph message id / Gmail message id).
  provider_message_id   TEXT NOT NULL,
  -- RFC822 Message-ID header, when available.
  message_id_header     TEXT,
  from_name             TEXT NOT NULL DEFAULT '',
  from_address          TEXT NOT NULL DEFAULT '',
  -- to/cc shape: [{ name, address }]
  to_recipients         JSONB NOT NULL DEFAULT '[]'::jsonb,
  cc_recipients         JSONB NOT NULL DEFAULT '[]'::jsonb,
  subject               TEXT NOT NULL DEFAULT '',
  sent_at               TIMESTAMPTZ,
  -- Plain-text body (HTML stripped when only HTML was available).
  body_text             TEXT NOT NULL DEFAULT '',
  -- Original HTML body, preserved for faithful rendering.
  body_html             TEXT NOT NULL DEFAULT '',
  snippet               TEXT NOT NULL DEFAULT '',
  synced_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (thread_id, provider_message_id)
);

CREATE INDEX IF NOT EXISTS idx_project_email_messages_thread
  ON project_email_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_project_email_messages_project
  ON project_email_messages(project_id);
