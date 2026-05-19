ALTER TABLE directory_contacts
  ADD COLUMN IF NOT EXISTS member_contact_ids JSONB NOT NULL DEFAULT '[]'::jsonb;
