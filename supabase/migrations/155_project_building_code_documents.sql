-- Building Code references for a project (Admin → Building Code section).
--
-- Centralizes all of the code documents that apply to a project's jurisdiction
-- (city + county building code, plus any supplemental documents) so they live in
-- one place and can be referenced by the Assist tools.
--
-- Two ways a row gets here:
--   1. AI suggestion — a Gemini web search proposes city/county code links for the
--      project's jurisdiction. These land as status = 'suggested' / source = 'ai'.
--      A Super Admin or Admin then Approves (status = 'approved') or Ignores
--      (status = 'ignored') each one; that decision is final.
--   2. Manual entry — a Super Admin or Admin adds a named link or uploads a named
--      PDF at any time. These are inserted directly as status = 'approved' /
--      source = 'manual'.
--
-- Only 'approved' documents are surfaced to Assist.

CREATE TABLE IF NOT EXISTS project_building_code_documents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

  -- User-facing name for the document (every document can be named).
  title         TEXT NOT NULL,
  -- Which jurisdiction this belongs to: e.g. 'City', 'County', 'State', 'Other'
  -- or a free-form label like "Wake County".
  jurisdiction  TEXT,

  -- 'link' — an external URL to an online code/page.
  -- 'file' — an uploaded PDF stored in the project-drawings bucket.
  doc_type      TEXT NOT NULL DEFAULT 'link'
                  CHECK (doc_type IN ('link', 'file')),
  url           TEXT,           -- external URL (links + AI suggestions)
  storage_path  TEXT,           -- storage key for uploaded files (project-drawings)
  filename      TEXT,           -- original filename for uploaded files

  -- 'manual' — added by a Super Admin / Admin.
  -- 'ai'     — proposed by the Gemini web-search suggestion flow.
  source        TEXT NOT NULL DEFAULT 'manual'
                  CHECK (source IN ('manual', 'ai')),

  -- 'suggested' — AI proposal awaiting review (only ever source = 'ai').
  -- 'approved'  — confirmed; surfaced to Assist and shown as a final document.
  -- 'ignored'   — dismissed AI proposal; kept so it is not re-suggested.
  status        TEXT NOT NULL DEFAULT 'approved'
                  CHECK (status IN ('suggested', 'approved', 'ignored')),

  -- Optional AI rationale / short description of what the document covers.
  notes         TEXT,

  created_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_building_code_documents_project_status
  ON project_building_code_documents(project_id, status);
