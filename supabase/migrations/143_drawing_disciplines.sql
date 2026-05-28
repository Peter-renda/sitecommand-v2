-- Custom Drawing Disciplines
--
-- The drawings "Discipline" field (stored on project_drawings.category) was
-- previously limited to a fixed list of built-in codes (A=Architectural,
-- C=Civil, E=Electrical, M=Mechanical, P=Plumbing, S=Structural,
-- L=Landscape, G=General, T=Telecommunications, FP=Fire Protection).
--
-- Users can now type a brand-new discipline in the Upload Drawings review
-- panel (and the edit panel). Custom disciplines are stored per project in
-- this table by their display label, and the label itself is written to
-- project_drawings.category for any drawing assigned to it. Built-in
-- disciplines continue to store their short code in category.

CREATE TABLE IF NOT EXISTS project_drawing_disciplines (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  label       TEXT NOT NULL,
  created_by  UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, label)
);

CREATE INDEX IF NOT EXISTS idx_project_drawing_disciplines_project
  ON project_drawing_disciplines(project_id);
