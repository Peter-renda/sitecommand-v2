-- Assist Recurring Workflows
--
-- Stores saved prompts that should run on a recurring schedule against
-- the Assist endpoint for a project. Each workflow has a name, a prompt
-- body, a cadence (daily / weekly / monthly), and a list of recipient
-- emails to receive the generated answer.

CREATE TABLE IF NOT EXISTS assist_recurring_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_by UUID REFERENCES users(id),
  name TEXT NOT NULL,
  prompt TEXT NOT NULL,
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly')),
  recipients JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- recipients shape: ["email1@example.com", "email2@example.com"]
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  last_run_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_assist_recurring_workflows_project
  ON assist_recurring_workflows(project_id);

CREATE INDEX IF NOT EXISTS idx_assist_recurring_workflows_active
  ON assist_recurring_workflows(active);
