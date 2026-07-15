-- Training sandbox: "last saved" checkpoint timestamp.
--
-- Every tool in a sandbox already persists its records per-action, so this isn't
-- where the actual data lives — it's the Google-Docs-style "All changes saved"
-- checkpoint the training UI shows. It's bumped by the sandbox auto-save
-- heartbeat (and the manual "Save progress" button), and surfaced as
-- "Last saved …" on the Training → Practice list.

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS training_last_saved_at TIMESTAMPTZ;
