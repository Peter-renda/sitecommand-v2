-- Training → Guides: serve Word documents as plain text (not HTML).
--
-- Supersedes migration 166. Word guides now open as plain, readable text in a
-- new tab rather than a rendered HTML page, so the stored rendition is a
-- text/plain `.txt` file. Rename the pointer column to match its new meaning.
-- (166 added it as `content_html_path`; renaming preserves any existing rows.)

ALTER TABLE training_guides
  RENAME COLUMN content_html_path TO content_text_path;
