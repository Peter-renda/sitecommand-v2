-- Raise file size limit on the project-drawings bucket to 250 MB so that
-- large drawing-set PDFs (often 100+ MB) can be uploaded directly to
-- storage via signed URLs. Without this the Supabase default rejects
-- the PUT with HTTP 400.
UPDATE storage.buckets
SET file_size_limit = 262144000   -- 250 * 1024 * 1024
WHERE id = 'project-drawings';
