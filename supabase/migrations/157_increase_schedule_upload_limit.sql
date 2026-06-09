-- Ensure the project-schedules storage bucket exists and accepts large
-- MS Project XML exports. Big schedules export to 30-50 MB of XML, which
-- previously failed because the file was routed through the Vercel function
-- (hard 4.5 MB request-body limit). Schedule uploads now go straight to
-- Storage via a signed URL (see app/api/projects/[id]/schedule/upload-url),
-- so the bucket needs a matching size limit. Mirrors the 250 MB limit used by
-- project-drawings (migration 124).
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('project-schedules', 'project-schedules', false, 262144000)  -- 250 * 1024 * 1024
ON CONFLICT (id) DO UPDATE SET file_size_limit = 262144000;
