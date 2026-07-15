BEGIN;

ALTER TABLE project_photos
  ADD COLUMN IF NOT EXISTS trades TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS location_id UUID NULL REFERENCES project_locations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS taken_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_project_photos_location_id ON project_photos(location_id);

COMMIT;
