-- Per-company permission templates by user category and user type.
--
-- Lets a Company Super Admin define default tool-level permission templates
-- that apply when a new user is added to the company (or invited as an
-- external collaborator).
--
-- Two user categories are supported:
--   - 'company'  -> super_admin / admin / member
--   - 'invitee'  -> subcontractor / architect_engineer / owner_client
--
-- Each (company, category, user_type, tool) row stores one of the four
-- standard tool levels: none / read_only / standard / admin.

CREATE TABLE IF NOT EXISTS company_permission_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_category TEXT NOT NULL CHECK (user_category IN ('company', 'invitee')),
  user_type TEXT NOT NULL CHECK (user_type IN (
    'super_admin', 'admin', 'member',
    'subcontractor', 'architect_engineer', 'owner_client'
  )),
  tool TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('none', 'read_only', 'standard', 'admin')),
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, user_category, user_type, tool)
);

CREATE INDEX IF NOT EXISTS idx_company_permission_templates_lookup
  ON company_permission_templates (company_id, user_category, user_type);
