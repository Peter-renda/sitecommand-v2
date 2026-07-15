-- Permit Applications
--
-- Stores completed (AI-assisted, user-approved) permit application PDFs
-- per project. A user uploads a blank permit application form and gives
-- it a title; Gemini scans the form for fillable fields and proposes
-- values from project data; the user reviews/edits the values; and on
-- approval the filled PDF is saved here and listed under
-- "Completed Permit Applications".
--
-- Files live in the existing `project-drawings` Supabase bucket under
-- `{projectId}/_permit-completed/...`, so no new bucket setup is required.

CREATE TABLE IF NOT EXISTS project_permit_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  source_filename TEXT,
  final_filename TEXT NOT NULL,
  final_storage_path TEXT NOT NULL,
  fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_permit_applications_project
  ON project_permit_applications(project_id);
