-- Discipline category extracted from the title block (e.g. "A" for Architectural,
-- "C" for Civil, "E" for Electrical, "M" for Mechanical, "P" for Plumbing,
-- "S" for Structural, "L" for Landscape, "G" for General, "T" for Telecommunications,
-- "FP" for Fire Protection). Falls back to the prefix inferred from drawing_no when null.
ALTER TABLE project_drawings ADD COLUMN IF NOT EXISTS category TEXT;
