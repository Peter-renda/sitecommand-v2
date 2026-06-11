-- 161_invitations_allowed_sections.sql
--
-- Fixes external-invitee access scoping: the invite-external endpoint accepts
-- an allowed_sections list (which tools the collaborator may see), but the
-- invitations table had nowhere to store it, so the accept route always created
-- the project membership with allowed_sections = NULL (= access to ALL
-- sections). Persisting the list on the invitation lets the accept route carry
-- it onto project_memberships.allowed_sections (migration 031), which the
-- subcontractor portal and lib/project-access.ts already enforce.

ALTER TABLE invitations
  ADD COLUMN IF NOT EXISTS allowed_sections TEXT[] DEFAULT NULL;

COMMENT ON COLUMN invitations.allowed_sections IS
  'Tool sections the external invitee may access. NULL = all sections. Copied to project_memberships.allowed_sections on accept.';

NOTIFY pgrst, 'reload schema';
