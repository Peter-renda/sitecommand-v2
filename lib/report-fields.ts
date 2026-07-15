// Field catalogs for the new 360-report-backed fields.
//
// Each entry is stored in the owning record's `report_fields` JSONB column and
// surfaced as a column in 360 Reports. Fields are rendered in the violet
// "Report Fields" section of the relevant edit page unless marked `dbOnly`
// (stored and reportable, but not shown in forms).

import type { ReportFieldDef } from "@/components/ReportFieldsSection";

// ── Project (Admin page) ─────────────────────────────────────────────────────
export const PROJECT_REPORT_FIELDS: ReportFieldDef[] = [
  // Staff / roles
  { key: "architect_engineer", label: "Architect/Engineer" },
  { key: "executive", label: "Executive" },
  { key: "project_manager", label: "Project Manager" },
  { key: "project_engineer", label: "Project Engineer" },
  { key: "superintendent", label: "Superintendent" },
  { key: "assistant_project_manager", label: "Assistant Project Manager" },
  { key: "assistant_superintendent", label: "Assistant Superintendent" },
  { key: "senior_estimator", label: "Senior Estimator" },
  { key: "assistant_estimator", label: "Assistant Estimator" },
  // Classification
  { key: "bid_type", label: "Bid Type" },
  { key: "delivery_method", label: "Delivery Method" },
  { key: "owner_type", label: "Owner Type" },
  { key: "priority", label: "Priority" },
  { key: "program", label: "Program" },
  { key: "region", label: "Region" },
  { key: "designated_market_area", label: "Designated Market Area" },
  { key: "departments", label: "Departments" },
  { key: "office_name", label: "Office Name" },
  { key: "stage_tier", label: "Stage Tier" },
  { key: "flag", label: "Flag" },
  { key: "language", label: "Language" },
  { key: "timezone", label: "Timezone" },
  { key: "store_number", label: "Store Number" },
  { key: "parent_job_name", label: "Parent Job Name" },
  { key: "square_footage", label: "Square Footage", type: "number" },
  // Contacts / parties
  { key: "owner", label: "Owner" },
  { key: "owner_contact", label: "Owner Contact" },
  { key: "lender", label: "Lender" },
  { key: "phone", label: "Phone" },
  { key: "fax", label: "Fax" },
  // Location extras
  { key: "country", label: "Country" },
  { key: "country_code", label: "Country Code" },
  { key: "latitude", label: "Latitude", type: "number" },
  { key: "longitude", label: "Longitude", type: "number" },
  // Financial / accounting
  { key: "budget_number", label: "Budget Number" },
  { key: "currency_code", label: "Currency Code" },
  { key: "default_tax_code", label: "Default Tax Code" },
  { key: "project_to_company_exchange_rate", label: "Project To Company Exchange Rate", type: "number" },
  // Compliance / signatures
  { key: "cda", label: "CDA" },
  { key: "habc", label: "HABC", type: "boolean" },
  { key: "hud", label: "HUD", type: "boolean" },
  { key: "wage_decision", label: "Wage Decision" },
  { key: "wage_decision_date", label: "Wage Decision Date", type: "date" },
  { key: "show_2nd_signature", label: "Show 2nd Signature", type: "boolean" },
  { key: "show_4th_signature", label: "Show 4th Signature", type: "boolean" },
  { key: "signer_2_info", label: "2nd Signer Information" },
  { key: "signer_4_info", label: "4th Signer Information" },
  // Long-form
  { key: "notes", label: "Notes", type: "textarea" },
  { key: "exhibit_l_clarifications_exclusions", label: "Exhibit L - Clarifications and Exclusions", type: "textarea" },
  { key: "additional_insureds", label: "Additional Insureds", type: "textarea" },
  // Stored only (reportable, no form input)
  { key: "created_by", label: "Created By", dbOnly: true },
  { key: "drawing_list", label: "Drawing List", dbOnly: true },
  { key: "external_origin_data", label: "External Origin Data", dbOnly: true },
  { key: "external_origin_id", label: "External Origin ID", dbOnly: true },
  { key: "erp_updated_at", label: "ERP Updated At", type: "date", dbOnly: true },
  { key: "erp_user_name", label: "ERP User Name", dbOnly: true },
  { key: "schedule_last_updated", label: "Schedule Last Updated", type: "date", dbOnly: true },
  { key: "schedule_percent_complete", label: "Schedule Percent Complete", type: "number", dbOnly: true },
];

// ── Commitment (Edit Commitment page) ────────────────────────────────────────
export const COMMITMENT_REPORT_FIELDS: ReportFieldDef[] = [
  // Dates
  { key: "approval_letter_date", label: "Approval Letter Date", type: "date" },
  { key: "approved_date", label: "Approved Date", type: "date" },
  { key: "execution_date", label: "Execution Date", type: "date" },
  { key: "letter_of_intent_date", label: "Letter Of Intent Date", type: "date" },
  { key: "returned_date", label: "Returned Date", type: "date" },
  // Financial
  { key: "currency_code", label: "Currency Code" },
  { key: "taxable_amount", label: "Taxable Amount", type: "currency" },
  { key: "total_estimated_tax", label: "Total Estimated Tax", type: "currency" },
  // Certifications
  { key: "cbe_certification_number", label: "CBE Certification #" },
  { key: "mbe_certification_number", label: "MBE Certification #" },
  { key: "global_insurance_compliance", label: "Global Insurance Compliance" },
  { key: "project_insurance_compliance", label: "Project Insurance Compliance" },
  { key: "level_of_detail_change_orders", label: "Level Of Detail to Display Change Orders" },
  // Feature toggles
  { key: "enable_comments", label: "Enable Comments", type: "boolean" },
  { key: "enable_invoices", label: "Enable Invoices", type: "boolean" },
  { key: "enable_payments", label: "Enable Payments", type: "boolean" },
  { key: "enable_completed_work_retainage", label: "Enable Completed Work Retainage", type: "boolean" },
  { key: "enable_stored_material_retainage", label: "Enable Stored Material Retainage", type: "boolean" },
  { key: "enable_sliding_scale_retention", label: "Enable Sliding Scale Retention", type: "boolean" },
  { key: "show_cost_code_on_pdf", label: "Show Cost Code on PDF", type: "boolean" },
  // Compliance document checklist
  { key: "completed_w9_form", label: "Completed W-9 Form", type: "boolean" },
  { key: "copy_of_state_business_license", label: "Copy of State Business License", type: "boolean" },
  { key: "certificate_of_insurance_exhibit_f", label: "Certificate of Insurance (Exhibit F)", type: "boolean" },
  { key: "completed_form_1413_exhibit_m", label: "Completed Form 1413 (Exhibit M)", type: "boolean" },
  { key: "completed_subcontractor_affidavit_exhibit_h", label: "Subcontractor Affidavit (Exhibit H)", type: "boolean" },
  { key: "completed_first_source_agreement_exhibit_p", label: "First Source Agreement (Exhibit P)", type: "boolean" },
  { key: "completed_section_3_certificate", label: "Section 3 Opportunities Plan & Program Certificate", type: "boolean" },
  // Exhibit requirement flags
  { key: "exhibit_m_wage_scale", label: "Exhibit “M” Wage Scale Requirements", type: "boolean" },
  { key: "exhibit_n1_section_3", label: "Exhibit “N-1” Section 3 Requirements", type: "boolean" },
  { key: "exhibit_n2_dc_section_3", label: "Exhibit “N-2” DC Section 3 Requirements", type: "boolean" },
  { key: "exhibit_o1_mbe", label: "Exhibit “O-1” MBE Requirements", type: "boolean" },
  { key: "exhibit_o2_cbe_sbe", label: "Exhibit “O-2” CBE/SBE Requirements", type: "boolean" },
  { key: "exhibit_p1_first_source_hours_worked", label: "Exhibit “P-1” First Source (Hours Worked)", type: "boolean" },
  { key: "exhibit_p2_first_source_hiring", label: "Exhibit “P-2” First Source (Hiring)", type: "boolean" },
  // Long-form
  { key: "certified_payroll_contact_info", label: "Certified Payroll / Affirmative Action Contact", type: "textarea" },
  { key: "current_employees_list_section_3", label: "Current Employees (Section 3 Tracking)", type: "textarea" },
  { key: "submittals_within_14_days", label: "Submittals Due Within 14 Days of Subcontract", type: "textarea" },
  // Stored only
  { key: "comments_count", label: "Comments Count", type: "number", dbOnly: true },
  { key: "created_by", label: "Created By", dbOnly: true },
  { key: "erp_updated_at", label: "ERP Updated At", type: "date", dbOnly: true },
  { key: "erp_user_name", label: "ERP User Name", dbOnly: true },
];

// ── Company / Vendor (Directory) ─────────────────────────────────────────────
export const COMPANY_REPORT_FIELDS: ReportFieldDef[] = [
  { key: "entity_identifier", label: "Entity Identifier" },
  { key: "country_code", label: "Country Code" },
  { key: "invoice_contact_full_name", label: "Invoice Contact Full Name" },
  { key: "invoice_contact_email_address", label: "Invoice Contact Email Address" },
  { key: "primary_contact_fax_number", label: "Primary Contact Fax Number" },
  { key: "accepted_terms_and_conditions", label: "Accepted Terms And Conditions", type: "boolean" },
  { key: "erp_latest_status", label: "ERP Latest Status", dbOnly: true },
  { key: "erp_updated_at", label: "ERP Updated At", type: "date", dbOnly: true },
];

// ── RFI ──────────────────────────────────────────────────────────────────────
export const RFI_REPORT_FIELDS: ReportFieldDef[] = [
  { key: "company_vendor_name", label: "Company (Vendor) Name" },
  { key: "cost_impact_value", label: "Cost Impact Value", type: "currency" },
  { key: "schedule_impact_value", label: "Schedule Impact Value (Days)", type: "number" },
  { key: "reference", label: "Reference" },
  { key: "prefix", label: "Prefix" },
  { key: "revision", label: "Revision" },
  { key: "current_revision", label: "Current Revision" },
  { key: "date_closed", label: "Date Closed", type: "date" },
  // Stored only (analytics-style fields)
  { key: "predicted_outlier", label: "Predicted Outlier", dbOnly: true },
  { key: "predicted_outlier_reason", label: "Predicted Outlier Reason", dbOnly: true },
  { key: "predicted_topic", label: "Predicted Topic", dbOnly: true },
  { key: "predicted_primary_assignee_company", label: "Predicted Primary Assignee Company", dbOnly: true },
  { key: "predicted_primary_assignee_response_days", label: "Predicted Primary Assignee Response Days", type: "number", dbOnly: true },
  { key: "predicted_primary_assignee_last_response_date", label: "Predicted Primary Assignee Last Response Date", type: "date", dbOnly: true },
  { key: "predicted_primary_assignee_last_official_response_date", label: "Predicted Primary Assignee Last Official Response Date", type: "date", dbOnly: true },
  { key: "project_timeline_percentage", label: "Project Timeline Percentage", type: "number", dbOnly: true },
];

// ── Submittal ────────────────────────────────────────────────────────────────
export const SUBMITTAL_REPORT_FIELDS: ReportFieldDef[] = [
  { key: "anticipated_delivery_date", label: "Anticipated Delivery Date", type: "date" },
  { key: "ball_in_court_role", label: "Ball In Court Role" },
  { key: "package", label: "Package" },
  { key: "spec_area", label: "Spec Area" },
  { key: "status_category", label: "Status Category" },
  { key: "sub_job", label: "Sub Job" },
  { key: "paused", label: "Paused", type: "boolean" },
];

// ── Punch Item ───────────────────────────────────────────────────────────────
export const PUNCH_ITEM_REPORT_FIELDS: ReportFieldDef[] = [
  { key: "cost_impact_amount", label: "Cost Impact Amount", type: "currency" },
  { key: "schedule_impact_days", label: "Schedule Impact Days", type: "number" },
  { key: "closed_by", label: "Closed By" },
  { key: "date_closed", label: "Date Closed", type: "date" },
  { key: "email_sent", label: "Email Sent", type: "boolean", dbOnly: true },
  { key: "has_resolved_responses", label: "Has Resolved Responses", type: "boolean", dbOnly: true },
  { key: "has_unresolved_responses", label: "Has Unresolved Responses", type: "boolean", dbOnly: true },
];

// ── Task ─────────────────────────────────────────────────────────────────────
export const TASK_REPORT_FIELDS: ReportFieldDef[] = [
  { key: "date_in_progress", label: "Date In Progress", type: "date" },
  { key: "date_ready_for_review", label: "Date Ready For Review", type: "date" },
  { key: "date_closed", label: "Date Closed", type: "date" },
  { key: "date_voided", label: "Date Voided", type: "date" },
  { key: "date_notified", label: "Date Notified", type: "date", dbOnly: true },
  { key: "is_origin", label: "Is Origin", type: "boolean", dbOnly: true },
];

// ── Meeting ──────────────────────────────────────────────────────────────────
export const MEETING_REPORT_FIELDS: ReportFieldDef[] = [
  { key: "mode", label: "Mode" },
  { key: "distributed_by", label: "Distributed By" },
  { key: "distributed_date", label: "Distributed Date", type: "date" },
  { key: "last_distributed_event", label: "Last Distributed Event", dbOnly: true },
];

// ── Drawing ──────────────────────────────────────────────────────────────────
export const DRAWING_REPORT_FIELDS: ReportFieldDef[] = [
  { key: "area", label: "Area" },
  { key: "area_description", label: "Area Description" },
  { key: "status", label: "Status" },
  { key: "obsolete", label: "Obsolete", type: "boolean" },
  { key: "confirmed_by", label: "Confirmed By" },
  { key: "confirmed_date", label: "Confirmed Date", type: "date" },
  { key: "date_published", label: "Date Published", type: "date" },
  { key: "set_date", label: "Set Date", type: "date" },
  { key: "is_connected_drawing", label: "Is Connected Drawing", type: "boolean", dbOnly: true },
  { key: "sketch_count", label: "Sketch Count", type: "number", dbOnly: true },
];

// ── Folder/Document ──────────────────────────────────────────────────────────
export const DOCUMENT_REPORT_FIELDS: ReportFieldDef[] = [
  { key: "description", label: "Description" },
  { key: "comment", label: "Comment" },
  { key: "tags", label: "Tags" },
  { key: "version", label: "Version", type: "number" },
  { key: "checked_out_by", label: "Checked Out By", dbOnly: true },
  { key: "checked_out_until", label: "Checked Out Until", type: "date", dbOnly: true },
  { key: "latest_version_name", label: "Latest Version Name", dbOnly: true },
];

// ── Photo (stored only — photo metadata is managed by upload flows) ──────────
export const PHOTO_REPORT_FIELDS: ReportFieldDef[] = [
  { key: "description", label: "Description", dbOnly: true },
  { key: "gps_latitude", label: "GPS Latitude", dbOnly: true },
  { key: "gps_longitude", label: "GPS Longitude", dbOnly: true },
  { key: "origin_type", label: "Origin Type", dbOnly: true },
  { key: "private", label: "Private", type: "boolean", dbOnly: true },
  { key: "starred", label: "Starred", type: "boolean", dbOnly: true },
  { key: "height", label: "Height", type: "number", dbOnly: true },
  { key: "width", label: "Width", type: "number", dbOnly: true },
  { key: "comment_count", label: "Comment Count", type: "number", dbOnly: true },
];

// ── Specification Section (stored only — specs are parsed from the book) ─────
export const SPECIFICATION_REPORT_FIELDS: ReportFieldDef[] = [
  { key: "area", label: "Area", dbOnly: true },
  { key: "area_description", label: "Area Description", dbOnly: true },
  { key: "current_revision", label: "Current Revision", dbOnly: true },
  { key: "revision", label: "Revision", dbOnly: true },
  { key: "issued_date", label: "Issued Date", type: "date", dbOnly: true },
  { key: "received_date", label: "Received Date", type: "date", dbOnly: true },
  { key: "obsolete", label: "Obsolete", type: "boolean", dbOnly: true },
];

// ── Change Order (commitment + prime CO detail pages) ────────────────────────
export const CHANGE_ORDER_REPORT_FIELDS: ReportFieldDef[] = [
  { key: "review_notes", label: "Review Notes", type: "textarea" },
  { key: "taxable_amount", label: "Taxable Amount", type: "currency" },
  { key: "total_estimated_tax", label: "Total Estimated Tax", type: "currency" },
  { key: "currency_code", label: "Currency Code" },
  { key: "sign_with_docusign", label: "Sign With DocuSign", type: "boolean" },
  { key: "new_date_of_substantial_completion", label: "New Date of Substantial Completion", type: "date" },
  { key: "revised_substantial_completion_date", label: "Revised Substantial Completion Date", type: "date" },
  { key: "signature_required", label: "Signature Required", type: "boolean" },
  // Stored only (workflow engine fields)
  { key: "assigned_to_current_workflow_step", label: "Assigned to Current Workflow Step", dbOnly: true },
  { key: "current_workflow_response", label: "Current Workflow Response", dbOnly: true },
  { key: "current_workflow_step", label: "Current Workflow Step", dbOnly: true },
  { key: "current_workflow_step_due_date", label: "Current Workflow Step Due Date", type: "date", dbOnly: true },
  { key: "workflow_assignment_duration_days", label: "Workflow Assignment Duration (Days)", type: "number", dbOnly: true },
  { key: "created_by", label: "Created By", dbOnly: true },
  { key: "erp_updated_at", label: "ERP Updated At", type: "date", dbOnly: true },
  { key: "erp_user_name", label: "ERP User Name", dbOnly: true },
];

// ── Prime Contract ───────────────────────────────────────────────────────────
export const PRIME_CONTRACT_REPORT_FIELDS: ReportFieldDef[] = [
  { key: "contract_date", label: "Contract Date", type: "date" },
  { key: "approval_letter_date", label: "Approval Letter Date", type: "date" },
  { key: "approved_date", label: "Approved Date", type: "date" },
  { key: "execution_date", label: "Execution Date", type: "date" },
  { key: "issued_on_date", label: "Issued On Date", type: "date" },
  { key: "letter_of_intent_date", label: "Letter Of Intent Date", type: "date" },
  { key: "returned_date", label: "Returned Date", type: "date" },
  { key: "substantial_completion_date", label: "Substantial Completion Date", type: "date" },
  { key: "currency_code", label: "Currency Code" },
  { key: "default_accounting_method", label: "Default Accounting Method" },
  { key: "taxable_amount", label: "Taxable Amount", type: "currency" },
  { key: "total_estimated_tax", label: "Total Estimated Tax", type: "currency" },
  { key: "level_of_detail_to_display_change_orders", label: "Level Of Detail To Display Change Orders" },
  { key: "signature_required", label: "Signature Required", type: "boolean" },
  { key: "show_cost_code_on_pdf", label: "Show Cost Code on PDF", type: "boolean" },
  { key: "enable_comments", label: "Enable Comments", type: "boolean" },
  { key: "enable_invoices", label: "Enable Invoices", type: "boolean" },
  { key: "enable_payments", label: "Enable Payments", type: "boolean" },
  { key: "enable_financial_markups", label: "Enable Financial Markups", type: "boolean" },
  { key: "enable_completed_work_retainage", label: "Enable Completed Work Retainage", type: "boolean" },
  { key: "enable_stored_material_retainage", label: "Enable Stored Material Retainage", type: "boolean" },
  // Stored only
  { key: "comments_count", label: "Comments Count", type: "number", dbOnly: true },
  { key: "created_by", label: "Created By", dbOnly: true },
  { key: "erp_updated_at", label: "ERP Updated At", type: "date", dbOnly: true },
  { key: "erp_user_name", label: "ERP User Name", dbOnly: true },
  { key: "assigned_to_current_workflow_step", label: "Assigned to Current Workflow Step", dbOnly: true },
  { key: "current_workflow_response", label: "Current Workflow Response", dbOnly: true },
  { key: "current_workflow_step", label: "Current Workflow Step", dbOnly: true },
  { key: "current_workflow_step_due_date", label: "Current Workflow Step Due Date", type: "date", dbOnly: true },
  { key: "workflow_assignment_duration_days", label: "Workflow Assignment Duration (Days)", type: "number", dbOnly: true },
];

// ── Budget Line Item (stored only — budget grid is calculation-driven) ───────
export const BUDGET_LINE_ITEM_REPORT_FIELDS: ReportFieldDef[] = [
  { key: "notes", label: "Notes", dbOnly: true },
  { key: "currency_code", label: "Currency Code", dbOnly: true },
  { key: "original_budgeted_hours", label: "Original Budgeted Hours", type: "number", dbOnly: true },
  { key: "attribute_1_name", label: "Attribute 1 Name", dbOnly: true },
  { key: "attribute_1_line_items", label: "Attribute 1 Line Items", dbOnly: true },
  { key: "attribute_2_name", label: "Attribute 2 Name", dbOnly: true },
  { key: "attribute_2_line_items", label: "Attribute 2 Line Items", dbOnly: true },
  { key: "attribute_3_name", label: "Attribute 3 Name", dbOnly: true },
  { key: "attribute_3_line_items", label: "Attribute 3 Line Items", dbOnly: true },
  { key: "cost_code_tier_1_description", label: "Cost Code Tier 1 Description", dbOnly: true },
  { key: "cost_code_tier_2_description", label: "Cost Code Tier 2 Description", dbOnly: true },
];

// ── Timecard Entry (stored only — timesheet grid is its own editor) ──────────
export const TIMECARD_ENTRY_REPORT_FIELDS: ReportFieldDef[] = [
  { key: "classification", label: "Classification", dbOnly: true },
  { key: "class_code", label: "Class Code", dbOnly: true },
  { key: "approved_by", label: "Approved By", dbOnly: true },
  { key: "reviewed_by", label: "Reviewed By", dbOnly: true },
  { key: "completed_by", label: "Completed By", dbOnly: true },
  { key: "approval_date", label: "Approval Date", type: "date", dbOnly: true },
  { key: "clock_in_gps_onsite", label: "Clock In GPS Onsite", dbOnly: true },
  { key: "clock_out_gps_onsite", label: "Clock Out GPS Onsite", dbOnly: true },
  { key: "lunch_clock_in_gps_onsite", label: "Lunch Clock In GPS Onsite", dbOnly: true },
  { key: "lunch_clock_out_gps_onsite", label: "Lunch Clock Out GPS Onsite", dbOnly: true },
  { key: "lunch_start_time", label: "Lunch Start Time", dbOnly: true },
  { key: "lunch_stop_time", label: "Lunch Stop Time", dbOnly: true },
];

// ── Change Event Line Item (stored only — line grid is its own editor) ───────
export const CHANGE_EVENT_LINE_ITEM_REPORT_FIELDS: ReportFieldDef[] = [
  { key: "budget_rom", label: "Budget ROM", type: "currency", dbOnly: true },
  { key: "budget_stage", label: "Budget Stage", dbOnly: true },
  { key: "budget_stage_status", label: "Budget Stage Status", dbOnly: true },
  { key: "cost_stage", label: "Cost Stage", dbOnly: true },
  { key: "cost_stage_status", label: "Cost Stage Status", dbOnly: true },
  { key: "revenue_stage", label: "Revenue Stage", dbOnly: true },
  { key: "revenue_stage_status", label: "Revenue Stage Status", dbOnly: true },
  { key: "latest_cost", label: "Latest Cost", type: "currency", dbOnly: true },
  { key: "latest_cost_source", label: "Latest Cost Source", dbOnly: true },
  { key: "latest_price", label: "Latest Price", type: "currency", dbOnly: true },
  { key: "latest_price_source", label: "Latest Price Source", dbOnly: true },
  { key: "line_item_type", label: "Line Item Type", dbOnly: true },
  { key: "non_committed_cost", label: "Non-Committed Cost", type: "currency", dbOnly: true },
  { key: "proposed_vendor_name", label: "Proposed Vendor Name", dbOnly: true },
];

/** Build the default values object for a report_fields JSONB payload. */
export function emptyReportFields(fields: ReportFieldDef[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields) out[f.key] = f.type === "boolean" ? false : "";
  return out;
}
