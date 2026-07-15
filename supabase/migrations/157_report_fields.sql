-- 360 Report-backed fields.
--
-- Adds a generic `report_fields` JSONB column to every entity that 360 Reports
-- draws columns from. New report columns (the ones that previously had no
-- backing data) are stored here and surfaced both on the relevant edit pages
-- (in the violet "Report Fields" section) and as columns in 360 Reports.
--
-- Using a single JSONB column per table keeps the schema flexible: report
-- columns can be added/removed in lib/report-fields.ts without further
-- migrations, while remaining queryable for reporting and export.

ALTER TABLE projects               ADD COLUMN IF NOT EXISTS report_fields JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE commitments            ADD COLUMN IF NOT EXISTS report_fields JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE change_orders          ADD COLUMN IF NOT EXISTS report_fields JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE prime_contracts        ADD COLUMN IF NOT EXISTS report_fields JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE directory_contacts     ADD COLUMN IF NOT EXISTS report_fields JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE rfis                   ADD COLUMN IF NOT EXISTS report_fields JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE submittals             ADD COLUMN IF NOT EXISTS report_fields JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE punch_list_items       ADD COLUMN IF NOT EXISTS report_fields JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE tasks                  ADD COLUMN IF NOT EXISTS report_fields JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE meetings               ADD COLUMN IF NOT EXISTS report_fields JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE project_drawings       ADD COLUMN IF NOT EXISTS report_fields JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE documents              ADD COLUMN IF NOT EXISTS report_fields JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE project_photos         ADD COLUMN IF NOT EXISTS report_fields JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE project_specifications ADD COLUMN IF NOT EXISTS report_fields JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE budget_line_items      ADD COLUMN IF NOT EXISTS report_fields JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE timesheet_entries      ADD COLUMN IF NOT EXISTS report_fields JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE change_event_line_items ADD COLUMN IF NOT EXISTS report_fields JSONB NOT NULL DEFAULT '{}'::jsonb;
