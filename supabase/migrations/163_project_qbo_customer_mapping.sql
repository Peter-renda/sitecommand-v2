-- ============================================================
-- Per-project QBO Customer / Project mapping.
--
-- The ERP "Resync with ERP" pull (Items-based path) resolves the SiteCommand
-- project to a QBO record so the ProfitAndLossDetail report can be scoped
-- correctly. Until now this was a name-only auto-match against the QBO
-- Customer:Job hierarchy, which is brittle for two reasons:
--   1. SiteCommand project names rarely match QBO names verbatim.
--   2. QBO "Projects" (the modern construction-tracking entity introduced in
--      QBO Plus/Advanced) is what GC accounting departments actually use, and
--      the auto-match needs to prefer them over plain Customer:Job.
--
-- These columns store the explicit override the user picks in the Project
-- Admin page. When set, the pull uses qbo_customer_id directly and never
-- falls back to name lookup. qbo_customer_name is kept alongside the id so
-- the admin UI can display a friendly label without re-querying QBO.
-- ============================================================

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS qbo_customer_id   TEXT,
  ADD COLUMN IF NOT EXISTS qbo_customer_name TEXT;

NOTIFY pgrst, 'reload schema';
