ALTER TABLE project_specifications
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_project_specifications_project_deleted
  ON project_specifications(project_id, deleted_at);

CREATE TABLE IF NOT EXISTS project_spec_divisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  number TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id, number)
);

CREATE INDEX IF NOT EXISTS idx_project_spec_divisions_project
  ON project_spec_divisions(project_id);
