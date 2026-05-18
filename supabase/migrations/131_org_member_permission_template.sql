-- ============================================================
-- Migration 131: Permission template on org_members
-- ============================================================
-- Stores which permission template a company user is on so the
-- member detail page can show their template name (or "Custom"
-- when their tool_levels diverge from the template baseline) and
-- switch them between templates. NULL means follow their role.
-- ============================================================

ALTER TABLE org_members
  ADD COLUMN IF NOT EXISTS permission_template TEXT DEFAULT NULL;

COMMENT ON COLUMN org_members.permission_template IS
  'Name of the company permission template the user is currently on (user_type from company_permission_templates). NULL means use their role default.';

-- Backfill from role so the UI has a starting baseline.
UPDATE org_members
SET permission_template = role
WHERE permission_template IS NULL;
