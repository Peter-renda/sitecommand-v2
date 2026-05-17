-- One stored specification book PDF per project. New uploads replace the
-- existing row so the "Open Specification Book" action always points at the
-- most recent upload.
CREATE TABLE IF NOT EXISTS project_spec_books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  total_pages INTEGER,
  uploaded_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_spec_books_project
  ON project_spec_books(project_id);
