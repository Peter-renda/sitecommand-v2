-- Training sandbox delete: make invitations.project_id cascade.
--
-- Every other table that references projects(id) is declared ON DELETE CASCADE,
-- so deleting a project tears its data down with it. The lone exception is
-- invitations.project_id (added in migration 030 without a cascade rule). If a
-- sandbox ever has an invitation pointing at it — e.g. the trainee invited a sub
-- or collaborator while running the job — a hard DELETE of the project raises a
-- foreign-key violation and the sandbox can't be removed, so it reappears in the
-- Training → Practice list. Re-create the FK with ON DELETE CASCADE so deleting a
-- project (training or real) also clears its dangling invitations.

-- Drop whatever FK currently constrains invitations.project_id (its name is the
-- Postgres default, invitations_project_id_fkey, but introspect to be safe so we
-- never leave a second, non-cascading constraint behind).
DO $$
DECLARE
  con text;
BEGIN
  FOR con IN
    SELECT tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    WHERE tc.table_name = 'invitations'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'project_id'
  LOOP
    EXECUTE format('ALTER TABLE invitations DROP CONSTRAINT %I', con);
  END LOOP;
END $$;

ALTER TABLE invitations
  ADD CONSTRAINT invitations_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
