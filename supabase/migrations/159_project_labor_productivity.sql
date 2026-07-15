-- Advanced project-financials capability flag. When enabled, Budget, Change
-- Events, and Change Orders surface labor-productivity behavior together.
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS labor_productivity BOOLEAN DEFAULT false;
