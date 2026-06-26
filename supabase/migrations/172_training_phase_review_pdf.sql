-- Training sandbox: persist a PDF rendition of each phase "Job Review".
--
-- Phase Job Reviews (training_phase_reviews) are surfaced when a trainee expands
-- a sandbox on Training → Practice. They now carry a hyperlink that opens the
-- review as a PDF in a new tab. The PDF is rendered once (when the review is
-- generated or first opened), stored in the project-drawings bucket under
-- {projectId}/_phase-reviews/, and re-served via a fresh signed URL on later
-- visits. This column points at that stored file.

ALTER TABLE training_phase_reviews
  ADD COLUMN IF NOT EXISTS pdf_storage_path TEXT;
