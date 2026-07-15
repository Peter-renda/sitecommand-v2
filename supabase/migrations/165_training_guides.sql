-- Training → Guides: company-level guide documents + employee assignments.
--
-- A Company Super Admin uploads guide documents (PDFs, Word docs, etc.) that
-- live under Training → Guides for everyone in the company. As documents are
-- added they form an ordered Table of Contents (driven by `sort_order`) that
-- the whole company can browse and open.
--
-- Super Admins can also assign a guide to specific employees with a due date so
-- new hires / staff have a clear, trackable reading list. Each assignee sees
-- their assigned guides (and due dates) on the Guides page and can mark them
-- complete.
--
-- Access control is enforced in the API routes (the app uses the Supabase
-- service-role key, which bypasses RLS), consistent with the rest of the
-- codebase — so no RLS policies are defined here.

-- Private storage bucket for uploaded guide files. Files are read back through
-- short-lived signed URLs (createSignedUrl), so the bucket stays private.
-- 250 MB limit mirrors project-drawings so large reference PDFs upload directly
-- via a signed PUT URL.
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('training-guides', 'training-guides', false, 262144000)  -- 250 * 1024 * 1024
ON CONFLICT (id) DO NOTHING;

UPDATE storage.buckets
SET file_size_limit = 262144000
WHERE id = 'training-guides';

-- One row per uploaded guide document, scoped to the company.
CREATE TABLE IF NOT EXISTS training_guides (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- User-facing name shown in the Table of Contents.
  title         TEXT NOT NULL,
  -- Optional short summary of what the guide covers.
  description   TEXT,

  -- The uploaded file in the `training-guides` storage bucket.
  storage_path  TEXT NOT NULL,
  filename      TEXT NOT NULL,
  -- MIME type of the upload (application/pdf, …) — used to label the entry.
  file_type     TEXT,

  -- Position in the Table of Contents (ascending). New guides append to the end.
  sort_order    INTEGER NOT NULL DEFAULT 0,

  created_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_training_guides_company
  ON training_guides(company_id, sort_order, created_at);

-- One row per (guide, employee) assignment with a due date.
CREATE TABLE IF NOT EXISTS training_guide_assignments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guide_id      UUID NOT NULL REFERENCES training_guides(id) ON DELETE CASCADE,
  -- The employee the guide is assigned to.
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Who made the assignment (the Super Admin).
  assigned_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  -- When the assignee is expected to have completed the guide (optional).
  due_date      DATE,

  -- assigned = outstanding, completed = the assignee marked it done.
  status        TEXT NOT NULL DEFAULT 'assigned'
                  CHECK (status IN ('assigned', 'completed')),
  completed_at  TIMESTAMPTZ,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- One assignment per employee per guide; re-assigning updates the existing row.
  UNIQUE (guide_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_training_guide_assignments_user
  ON training_guide_assignments(user_id, status);

CREATE INDEX IF NOT EXISTS idx_training_guide_assignments_guide
  ON training_guide_assignments(guide_id);
