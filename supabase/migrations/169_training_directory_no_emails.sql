-- Training sandbox directories: drop the seeded GC team's email addresses.
--
-- PM training sandboxes seed the general contractor's internal team into the
-- project Directory (preconstruction manager, estimator, president, VP, project
-- executive, superintendent, assistant superintendent). Those reference contacts
-- were originally given fabricated `first.last@<company>.com` emails; we no
-- longer want fake addresses in the training directory, so the seed now creates
-- them with no email. This backfills existing sandboxes to match.
--
-- Scoped to training projects and to the seven seeded job titles so it never
-- touches the launcher's own synced directory contact (which has no job_title
-- and carries their real email — nulling it would make the directory-sync logic
-- re-insert a duplicate).

UPDATE directory_contacts
SET email = NULL
WHERE email IS NOT NULL
  AND job_title IN (
    'Preconstruction Manager',
    'Estimator',
    'President',
    'Vice President',
    'Project Executive',
    'Superintendent',
    'Assistant Superintendent'
  )
  AND project_id IN (SELECT id FROM projects WHERE is_training = true);
