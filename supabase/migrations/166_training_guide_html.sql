-- Training → Guides: store a converted-HTML rendition for Word documents.
--
-- Browsers can't render a .docx inline, so when a Word document is uploaded we
-- convert it to a styled HTML document (via mammoth) and store that alongside
-- the original in the `training-guides` bucket. `content_html_path` points at
-- that rendered HTML; when present, the guide's "open" link serves the HTML so
-- it renders in a new browser tab instead of downloading the .docx.
--
-- Null for PDFs / non-Word uploads (and for Word docs whose conversion failed),
-- which continue to open via the original file.

ALTER TABLE training_guides
  ADD COLUMN IF NOT EXISTS content_html_path TEXT;
