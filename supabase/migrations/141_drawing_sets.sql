-- Drawing Sets
--
-- A "Drawing Set" groups one or more uploaded PDF drawing files (e.g.
-- "Permit Set", "Bid Set", "Construction Documents"). Per Procore's
-- Upload Drawings workflow, every upload is associated with a set and
-- carries upload-time defaults that guide the AI title-block scan and
-- backfill missing values on individual sheets.

CREATE TABLE IF NOT EXISTS drawing_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  default_drawing_date DATE,
  default_received_date DATE,
  default_revision TEXT,
  -- 'none' | 'first_decimal' | 'first_underscore' | 'last_underscore'
  drawing_no_rev_mode TEXT NOT NULL DEFAULT 'none',
  get_number_from_filename BOOLEAN NOT NULL DEFAULT false,
  -- ISO 639-1 language code; "en" by default
  drawing_language TEXT NOT NULL DEFAULT 'en',
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, name)
);

CREATE INDEX IF NOT EXISTS idx_drawing_sets_project ON drawing_sets(project_id);

-- Per-upload snapshot of the settings the user picked in the Upload
-- Drawings modal. Stored on the upload row so the AI scan can read them
-- back when extracting title-block metadata.
ALTER TABLE drawing_uploads
  ADD COLUMN IF NOT EXISTS set_id UUID REFERENCES drawing_sets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS default_drawing_date DATE,
  ADD COLUMN IF NOT EXISTS default_received_date DATE,
  ADD COLUMN IF NOT EXISTS default_revision TEXT,
  ADD COLUMN IF NOT EXISTS drawing_no_rev_mode TEXT DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS get_number_from_filename BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS drawing_language TEXT DEFAULT 'en';

CREATE INDEX IF NOT EXISTS idx_drawing_uploads_set ON drawing_uploads(set_id);
