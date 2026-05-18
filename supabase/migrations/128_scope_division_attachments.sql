-- Per-division file attachments for the Scope of Work tool. Each row
-- represents a PDF or Word document attached to a single CSI division on a
-- project. The extracted plain-text body is stored alongside the file so
-- the UI can render an in-line, expandable read-along view without needing
-- to re-parse the document on every load.
CREATE TABLE IF NOT EXISTS scope_division_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  division_code TEXT NOT NULL,
  filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  extracted_text TEXT,
  uploaded_by UUID REFERENCES users(id),
  uploaded_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scope_division_attachments_project
  ON scope_division_attachments(project_id);

CREATE INDEX IF NOT EXISTS idx_scope_division_attachments_division
  ON scope_division_attachments(project_id, division_code);
