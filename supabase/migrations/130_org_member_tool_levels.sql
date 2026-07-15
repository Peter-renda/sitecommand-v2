-- ============================================================
-- Migration 130: Per-tool permission level overrides on org_members
-- ============================================================
-- Replaces the boolean allowed_tools allowlist with a per-tool
-- permission level override. Shape:
--   { "<tool-slug>": "none" | "read_only" | "standard" | "admin" }
--
-- When a slug is absent, the user's role-based default applies
-- (admin/super_admin -> "admin", member -> "standard").
-- NULL means no overrides at all (every tool uses the role default).
-- ============================================================

ALTER TABLE org_members
  ADD COLUMN IF NOT EXISTS tool_levels JSONB DEFAULT NULL;

COMMENT ON COLUMN org_members.tool_levels IS
  'Per-tool permission level override. Object keyed by tool slug with values "none" | "read_only" | "standard" | "admin". Absent slugs fall back to the role default.';

-- Backfill from the prior allowed_tools allowlist: any tool that was
-- explicitly excluded becomes "none". Included tools (and the case where
-- allowed_tools IS NULL) keep the role default, so we record nothing for
-- them.
UPDATE org_members
SET tool_levels = (
  SELECT jsonb_object_agg(slug, 'none')
  FROM unnest(ARRAY[
    'home','reporting','documents','directory','tasks','quick-notes','assist','admin',
    'insights','rfis','submittals','transmittals','punch-list','meetings','schedule','daily-log',
    'photos','drawings','bim','specifications',
    'tm-tickets','timesheets',
    'preconstruction','bid-management','estimating','prequalification',
    'prime-contracts','budget','commitments','scope-of-work','change-orders','change-events',
    'transaction-orders'
  ]) AS slug
  WHERE NOT (slug = ANY(allowed_tools))
)
WHERE allowed_tools IS NOT NULL
  AND tool_levels IS NULL;
