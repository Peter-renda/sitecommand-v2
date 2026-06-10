-- Generic store for "source-less" 360-report entities.
--
-- Several 360-report categories (Owner/Subcontractor Invoices, Payments,
-- Employees, Labor Allocations, Production Quantities, ERP Job Costs, Invoice
-- Compliance, Monitored Resources, and the CO line-item/markup/PCO breakdowns)
-- had no underlying table in SiteCommand. Rather than add ~20 sparse tables,
-- every such record lives here, discriminated by `entity` (the report source
-- slug), with all of its fields in `report_fields` JSONB. These are surfaced on
-- the Report Records management page and resolved into 360-report columns.

CREATE TABLE IF NOT EXISTS report_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  entity TEXT NOT NULL,                       -- report source slug, e.g. 'owner-invoices'
  report_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS report_records_project_entity_idx
  ON report_records(project_id, entity, created_at);
