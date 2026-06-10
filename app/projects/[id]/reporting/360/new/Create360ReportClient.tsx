"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ProjectNav from "@/components/ProjectNav";
import { REPORT_RECORD_SLUGS } from "@/lib/report-record-fields";
import { loadSavedReports, saveReport, type StoredReport } from "../../saved-reports-store";
import {
  FiltersPanel,
  FILTER_MODE_LABELS,
  applyFiltersForSource,
  distinctColumnValues,
  type FilterCategory,
  type ReportFilter,
} from "../../report-filters";

// ─── Column catalog ──────────────────────────────────────────────────────────
// Categories shown in the Configure Columns popout. The "source" maps to the
// primary entity fetched from a project API — selecting any column under that
// category populates one row per record of that entity.

type FieldDef = { key: string; label: string; format?: "currency" | "date" | "text" | "number" };

type CategoryDef = {
  label: string;
  source: string; // entity slug (commitments, change-events, ...)
  fields: FieldDef[];
  legacy?: boolean;
};

// Helper that turns a human label into a snake_case field key while preserving
// the distinction between currency ($) and percent (%) suffixes commonly used
// in financial fields.
function f(label: string, format?: FieldDef["format"]): FieldDef {
  const key = label
    .toLowerCase()
    .replace(/\$/g, " dollar ")
    .replace(/%/g, " percent ")
    .replace(/#/g, " num ")
    .replace(/['"”“’‘()&]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return format ? { key, label, format } : { key, label };
}

const FINANCIALS_CATEGORIES: CategoryDef[] = [
  {
    label: "Budget Code",
    source: "budget-codes",
    fields: [
      { key: "attribute_1_line_items", label: "Attribute 1 Line Items" },
      { key: "attribute_1_name", label: "Attribute 1 Name" },
      { key: "attribute_2_line_items", label: "Attribute 2 Line Items" },
      { key: "attribute_2_name", label: "Attribute 2 Name" },
      { key: "attribute_3_line_items", label: "Attribute 3 Line Items" },
      { key: "attribute_3_name", label: "Attribute 3 Name" },
      { key: "budget_code", label: "Budget Code" },
      { key: "budget_code_description", label: "Budget Code Description" },
      { key: "budget_code_status", label: "Budget Code Status" },
      { key: "cost_code", label: "Cost Code" },
      { key: "cost_code_description", label: "Cost Code Description" },
      { key: "cost_code_tier_1", label: "Cost Code Tier 1" },
      { key: "cost_code_tier_1_description", label: "Cost Code Tier 1 Description" },
      { key: "cost_code_tier_2", label: "Cost Code Tier 2" },
      { key: "cost_code_tier_2_description", label: "Cost Code Tier 2 Description" },
      { key: "cost_type", label: "Cost Type" },
      { key: "cost_type_description", label: "Cost Type Description" },
      { key: "count", label: "Count", format: "number" },
      { key: "id", label: "ID", format: "number" },
    ],
  },
  {
    label: "Budget Line Item",
    source: "budget-line-items",
    fields: [
      { key: "budget_calculation_strategy", label: "Budget Calculation Strategy" },
      { key: "count", label: "Count", format: "number" },
      { key: "currency_code", label: "Currency Code" },
      { key: "date_created", label: "Date Created", format: "date" },
      { key: "date_updated", label: "Date Updated", format: "date" },
      { key: "id", label: "ID", format: "number" },
      { key: "notes", label: "Notes" },
      { key: "original_budget_amount", label: "Original Budget Amount", format: "currency" },
      { key: "original_budgeted_hours", label: "Original Budgeted Hours", format: "number" },
      { key: "unit_cost", label: "Unit Cost", format: "currency" },
      { key: "unit_of_measure", label: "Unit Of Measure" },
      { key: "unit_quantity", label: "Unit Quantity", format: "number" },
    ],
  },
  {
    label: "Budget Modification",
    source: "budget-modifications",
    fields: [
      { key: "budget_modification_type", label: "Budget Modification Type" },
      { key: "count", label: "Count", format: "number" },
      { key: "created_by", label: "Created By" },
      { key: "currency_code", label: "Currency Code" },
      { key: "date_created", label: "Date Created", format: "date" },
      { key: "date_updated", label: "Date Updated", format: "date" },
      { key: "id", label: "ID" },
      { key: "notes", label: "Notes" },
      { key: "transfer_amount", label: "Transfer Amount", format: "currency" },
    ],
  },
  {
    label: "Change Event",
    source: "change-events",
    fields: [
      { key: "number", label: "#" },
      { key: "title", label: "Title" },
      { key: "status", label: "Status" },
      { key: "scope", label: "Scope" },
      { key: "rom_amount", label: "ROM Amount", format: "currency" },
      { key: "created_at", label: "Created", format: "date" },
    ],
  },
  {
    label: "Change Event Line Item",
    source: "change-event-line-items",
    fields: [
      { key: "budget_code", label: "Budget Code" },
      { key: "description", label: "Description" },
      { key: "amount", label: "Amount", format: "currency" },
      { key: "vendor", label: "Vendor" },
    ],
  },
  {
    label: "Commitment",
    source: "commitments",
    fields: [
      { key: "number", label: "#" },
      { key: "type", label: "Type" },
      { key: "contract_company", label: "Company" },
      { key: "title", label: "Title" },
      { key: "status", label: "Status" },
      { key: "sov_accounting_method", label: "Accounting Method" },
      { key: "original_contract_amount", label: "Original Amount", format: "currency" },
      { key: "approved_change_orders", label: "Approved COs", format: "currency" },
      { key: "pending_change_orders", label: "Pending COs", format: "currency" },
      { key: "erp_status", label: "ERP Status" },
    ],
  },
  {
    label: "Commitment Change Order",
    source: "commitment-change-orders",
    fields: [
      { key: "number", label: "#" },
      { key: "title", label: "Title" },
      { key: "status", label: "Status" },
      { key: "contract_company", label: "Company" },
      { key: "contract_name", label: "Contract" },
      { key: "amount", label: "Amount", format: "currency" },
      { key: "change_reason", label: "Change Reason" },
      { key: "due_date", label: "Due Date", format: "date" },
    ],
  },
  {
    label: "Commitment Change Order Line Item",
    source: "commitment-change-order-line-items",
    fields: [
      { key: "budget_code", label: "Budget Code" },
      { key: "description", label: "Description" },
      { key: "amount", label: "Amount", format: "currency" },
    ],
  },
  {
    label: "Commitment Change Order Markup",
    source: "commitment-change-order-markup",
    fields: [
      { key: "label", label: "Markup" },
      { key: "type", label: "Type" },
      { key: "rate", label: "Rate" },
      { key: "amount", label: "Amount", format: "currency" },
    ],
  },
  {
    label: "Commitment Line Item",
    source: "commitment-line-items",
    fields: [
      { key: "budget_code", label: "Budget Code" },
      { key: "description", label: "Description" },
      { key: "amount", label: "Amount", format: "currency" },
      { key: "billed_to_date", label: "Billed to Date", format: "currency" },
    ],
  },
  {
    label: "ERP Job Costs Summary",
    source: "erp-job-costs",
    fields: [
      { key: "cost_code", label: "Cost Code" },
      { key: "job_to_date", label: "Job to Date", format: "currency" },
      { key: "direct_costs", label: "Direct Costs", format: "currency" },
      { key: "synced_at", label: "Synced", format: "date" },
    ],
  },
  {
    label: "Invoice Compliance",
    source: "invoice-compliance",
    fields: [
      { key: "invoice_number", label: "Invoice #" },
      { key: "compliant", label: "Compliant" },
      { key: "missing_items", label: "Missing Items" },
    ],
  },
  {
    label: "Monitored Resource",
    source: "monitored-resources",
    fields: [
      { key: "name", label: "Name" },
      { key: "type", label: "Type" },
      { key: "status", label: "Status" },
    ],
  },
  {
    label: "Owner Invoice",
    source: "owner-invoices",
    fields: [
      { key: "number", label: "#" },
      { key: "status", label: "Status" },
      { key: "billing_period", label: "Billing Period" },
      { key: "amount", label: "Amount", format: "currency" },
    ],
  },
  {
    label: "Owner Invoice Line Item",
    source: "owner-invoice-line-items",
    fields: [
      { key: "budget_code", label: "Budget Code" },
      { key: "description", label: "Description" },
      { key: "amount", label: "Amount", format: "currency" },
    ],
  },
  {
    label: "Payment Issued",
    source: "payments-issued",
    fields: [
      { key: "number", label: "#" },
      { key: "vendor", label: "Vendor" },
      { key: "amount", label: "Amount", format: "currency" },
      { key: "paid_on", label: "Paid On", format: "date" },
    ],
  },
  {
    label: "Payment Received",
    source: "payments-received",
    fields: [
      { key: "number", label: "#" },
      { key: "from", label: "From" },
      { key: "amount", label: "Amount", format: "currency" },
      { key: "received_on", label: "Received On", format: "date" },
    ],
  },
  {
    label: "Prime Contract",
    source: "prime-contracts",
    fields: [
      { key: "number", label: "#" },
      { key: "title", label: "Title" },
      { key: "status", label: "Status" },
      { key: "amount", label: "Amount", format: "currency" },
    ],
  },
  {
    label: "Prime Contract Change Order",
    source: "prime-contract-change-orders",
    fields: [
      { key: "number", label: "#" },
      { key: "title", label: "Title" },
      { key: "status", label: "Status" },
      { key: "amount", label: "Amount", format: "currency" },
    ],
  },
  {
    label: "Prime Contract Change Order Line Item",
    source: "prime-contract-change-order-line-items",
    fields: [
      { key: "budget_code", label: "Budget Code" },
      { key: "description", label: "Description" },
      { key: "amount", label: "Amount", format: "currency" },
    ],
  },
  {
    label: "Prime Contract Change Order Markup",
    source: "prime-contract-change-order-markup",
    fields: [
      { key: "label", label: "Markup" },
      { key: "type", label: "Type" },
      { key: "amount", label: "Amount", format: "currency" },
    ],
  },
];

const PROJECT_FIELDS: FieldDef[] = [
  { key: "signer_2_info", label: "2nd Signer Information" },
  { key: "signer_4_info", label: "4th Signer Information" },
  { key: "accounting_project_number", label: "Accounting Project Number" },
  { key: "actual_completion_date", label: "Actual Completion Date", format: "date" },
  { key: "actual_start_date", label: "Actual Start Date", format: "date" },
  { key: "address", label: "Address" },
  { key: "architect_engineer", label: "Architect/Engineer" },
  { key: "assistant_estimator", label: "Assistant Estimator" },
  { key: "assistant_project_manager", label: "Assistant Project Manager" },
  { key: "assistant_superintendent", label: "Assistant Superintendent" },
  { key: "bid_type", label: "Bid Type" },
  { key: "budget_lock_status", label: "Budget Lock Status" },
  { key: "budget_number", label: "Budget Number" },
  { key: "cda", label: "CDA" },
  { key: "city", label: "City" },
  { key: "code", label: "Code" },
  { key: "completion_date", label: "Completion Date", format: "date" },
  { key: "count", label: "Count", format: "number" },
  { key: "country", label: "Country" },
  { key: "country_code", label: "Country Code" },
  { key: "county", label: "County" },
  { key: "created_by", label: "Created By" },
  { key: "currency_code", label: "Currency Code" },
  { key: "date_created", label: "Date Created", format: "date" },
  { key: "default_tax_code", label: "Default Tax Code" },
  { key: "delivery_method", label: "Delivery Method" },
  { key: "departments", label: "Departments" },
  { key: "description", label: "Description" },
  { key: "designated_market_area", label: "Designated Market Area" },
  { key: "erp_latest_status", label: "ERP Latest Status" },
  { key: "erp_updated_at", label: "ERP Updated At", format: "date" },
  { key: "erp_user_name", label: "ERP User Name" },
  { key: "estimated_budget", label: "Estimated Budget", format: "currency" },
  { key: "executive", label: "Executive" },
  { key: "exhibit_l_clarifications_exclusions", label: "Exhibit L - Hamel's Clarifications and Exclusions" },
  { key: "external_origin_data", label: "External Origin Data" },
  { key: "external_origin_id", label: "External Origin ID" },
  { key: "fax", label: "Fax" },
  { key: "flag", label: "Flag" },
  { key: "habc", label: "HABC" },
  { key: "hud", label: "HUD" },
  { key: "id", label: "ID" },
  { key: "is_active", label: "Is Active" },
  { key: "is_test_project", label: "Is Test Project" },
  { key: "language", label: "Language" },
  { key: "latitude", label: "Latitude" },
  { key: "lender", label: "Lender" },
  { key: "longitude", label: "Longitude" },
  { key: "name", label: "Name" },
  { key: "notes", label: "Notes" },
  { key: "number", label: "Number" },
  { key: "office_name", label: "Office Name" },
  { key: "owner", label: "Owner" },
  { key: "owner_contact", label: "Owner Contact" },
  { key: "owner_type", label: "Owner Type" },
  { key: "parent_job_name", label: "Parent Job Name" },
  { key: "phone", label: "Phone" },
  { key: "drawing_list", label: "Please paste this project's drawing list here" },
  { key: "priority", label: "Priority" },
  { key: "program", label: "Program" },
  { key: "project_engineer", label: "Project Engineer" },
  { key: "project_manager", label: "Project Manager" },
  { key: "project_to_company_exchange_rate", label: "Project To Company Exchange Rate", format: "number" },
  { key: "projected_finish_date", label: "Projected Finish Date", format: "date" },
  { key: "region", label: "Region" },
  { key: "schedule_last_updated", label: "Schedule Last Updated", format: "date" },
  { key: "schedule_percent_complete", label: "Schedule Percent Complete", format: "number" },
  { key: "sector", label: "Sector" },
  { key: "senior_estimator", label: "Senior Estimator" },
  { key: "show_2nd_signature", label: "Show 2nd Signature" },
  { key: "show_4th_signature", label: "Show 4th Signature" },
  { key: "square_footage", label: "Square Footage", format: "number" },
  { key: "stage_name", label: "Stage Name" },
  { key: "stage_tier", label: "Stage Tier" },
  { key: "start_date", label: "Start Date", format: "date" },
  { key: "state", label: "State" },
  { key: "store_number", label: "Store Number" },
  { key: "superintendent", label: "Superintendent" },
  { key: "synced_with_accounting", label: "Synced With Accounting" },
  { key: "additional_insureds", label: "The following entities are to be shown as additional insureds" },
  { key: "timezone", label: "Timezone" },
  { key: "total_value", label: "Total Value", format: "currency" },
  { key: "type", label: "Type" },
  { key: "wage_decision", label: "Wage Decision" },
  { key: "wage_decision_date", label: "Wage Decision Date", format: "date" },
  { key: "warranty_end_date", label: "Warranty End Date", format: "date" },
  { key: "warranty_start_date", label: "Warranty Start Date", format: "date" },
  { key: "work_scope", label: "Work Scope" },
  { key: "zip", label: "Zip" },
];

const PROJECT_ROLES_FIELDS: FieldDef[] = [
  { key: "contact_name", label: "Contact Name" },
  { key: "contact_type", label: "Contact Type" },
  { key: "count", label: "Count", format: "number" },
  { key: "date_updated", label: "Date Updated", format: "date" },
  { key: "employee_id", label: "Employee ID" },
  { key: "group", label: "Group" },
  { key: "id", label: "ID" },
  { key: "role_name", label: "Role Name" },
];

const PROJECT_EXECUTION_CATEGORIES: CategoryDef[] = [
  {
    label: "Change Event",
    source: "change-events",
    fields: [
      { key: "change_reason", label: "Change Reason" },
      { key: "count", label: "Count", format: "number" },
      { key: "created_by", label: "Created By" },
      { key: "date_created", label: "Date Created", format: "date" },
      { key: "date_updated", label: "Date Updated", format: "date" },
      { key: "description", label: "Description" },
      { key: "id", label: "ID" },
      { key: "number", label: "Number" },
      { key: "origin_type", label: "Origin Type" },
      { key: "scope", label: "Scope" },
      { key: "status", label: "Status" },
      { key: "title", label: "Title" },
      { key: "type", label: "Type" },
    ],
  },
  {
    label: "Change Event Line Item",
    source: "change-event-line-items",
    fields: [
      { key: "budget_days_in_stage", label: "Budget Days In Stage", format: "number" },
      { key: "budget_rom", label: "Budget ROM", format: "currency" },
      { key: "budget_stage", label: "Budget Stage" },
      { key: "budget_stage_in_status_since", label: "Budget Stage In Status Since", format: "date" },
      { key: "budget_stage_status", label: "Budget Stage Status" },
      { key: "contract", label: "Contract" },
      { key: "cost_days_in_stage", label: "Cost Days In Stage", format: "number" },
      { key: "cost_rom", label: "Cost ROM", format: "currency" },
      { key: "cost_rom_quantity", label: "Cost ROM Quantity", format: "number" },
      { key: "cost_rom_unit_cost", label: "Cost ROM Unit Cost", format: "currency" },
      { key: "cost_stage", label: "Cost Stage" },
      { key: "cost_stage_in_status_since", label: "Cost Stage In Status Since", format: "date" },
      { key: "cost_stage_status", label: "Cost Stage Status" },
      { key: "count", label: "Count", format: "number" },
      { key: "date_created", label: "Date Created", format: "date" },
      { key: "date_updated", label: "Date Updated", format: "date" },
      { key: "description", label: "Description" },
      { key: "id", label: "ID" },
      { key: "latest_cost", label: "Latest Cost", format: "currency" },
      { key: "latest_cost_source", label: "Latest Cost Source" },
      { key: "latest_price", label: "Latest Price", format: "currency" },
      { key: "latest_price_source", label: "Latest Price Source" },
      { key: "line_aging", label: "Line Aging", format: "number" },
      { key: "line_item_type", label: "Line Item Type" },
      { key: "non_committed_cost", label: "Non-Committed Cost", format: "currency" },
      { key: "proposed_vendor_name", label: "Proposed Vendor Name" },
      { key: "revenue_days_in_stage", label: "Revenue Days In Stage", format: "number" },
      { key: "revenue_rom", label: "Revenue ROM", format: "currency" },
      { key: "revenue_rom_quantity", label: "Revenue ROM Quantity", format: "number" },
      { key: "revenue_rom_unit_cost", label: "Revenue ROM Unit Cost", format: "currency" },
      { key: "revenue_stage", label: "Revenue Stage" },
      { key: "revenue_stage_in_status_since", label: "Revenue Stage In Status Since", format: "date" },
      { key: "revenue_stage_status", label: "Revenue Stage Status" },
      { key: "unit_of_measure", label: "Unit Of Measure" },
      { key: "vendor_name", label: "Vendor Name" },
    ],
  },
  {
    label: "Commitment",
    source: "commitments",
    fields: [
      { key: "completed_section_3_certificate", label: "- Completed Section 3 Opportunities Plan & Program Certificate" },
      { key: "actual_completion_date", label: "Actual Completion Date", format: "date" },
      { key: "approval_letter_date", label: "Approval Letter Date", format: "date" },
      { key: "approved_change_orders", label: "Approved Change Orders", format: "currency" },
      { key: "approved_date", label: "Approved Date", format: "date" },
      { key: "assigned_to", label: "Assigned To" },
      { key: "bill_to", label: "Bill To" },
      { key: "bond_amount", label: "Bond Amount", format: "currency" },
      { key: "cbe_certification_number", label: "CBE Certification #" },
      { key: "certificate_of_insurance_exhibit_f", label: "Certificate of Insurance with language from Exhibit F" },
      { key: "comments_count", label: "Comments Count", format: "number" },
      { key: "completed_first_source_agreement_exhibit_p", label: "Completed First Source Agreement, per Exhibit P" },
      { key: "completed_form_1413_exhibit_m", label: "Completed Form 1413, provided as attachment Exhibit M" },
      { key: "completed_subcontractor_affidavit_exhibit_h", label: "Completed Subcontractor Affidavit, included as Exhibit H" },
      { key: "completed_w9_form", label: "Completed W-9 Form" },
      { key: "certified_payroll_contact_info", label: "Contact information for person responsible for completing certified payroll and/or affirmative action documents" },
      { key: "contract_date", label: "Contract Date", format: "date" },
      { key: "copy_of_state_business_license", label: "Copy of State Business License" },
      { key: "count", label: "Count", format: "number" },
      { key: "created_by", label: "Created By" },
      { key: "currency_code", label: "Currency Code" },
      { key: "date_created", label: "Date Created", format: "date" },
      { key: "date_updated", label: "Date Updated", format: "date" },
      { key: "default_accounting_method", label: "Default Accounting Method" },
      { key: "default_retainage", label: "Default Retainage", format: "number" },
      { key: "delivery_date", label: "Delivery Date", format: "date" },
      { key: "description", label: "Description" },
      { key: "draft_change_orders", label: "Draft Change Orders", format: "currency" },
      { key: "enable_comments", label: "Enable Comments" },
      { key: "enable_completed_work_retainage", label: "Enable Completed Work Retainage" },
      { key: "enable_financial_markups", label: "Enable Financial Markups" },
      { key: "enable_invoices", label: "Enable Invoices" },
      { key: "enable_payments", label: "Enable Payments" },
      { key: "enable_sliding_scale_retention", label: "Enable Sliding Scale Retention" },
      { key: "enable_stored_material_retainage", label: "Enable Stored Material Retainage" },
      { key: "enable_subcontractor_sov", label: "Enable Subcontractor SOV" },
      { key: "erp_latest_status", label: "ERP Latest Status" },
      { key: "erp_updated_at", label: "ERP Updated At", format: "date" },
      { key: "erp_user_name", label: "ERP User Name" },
      { key: "estimated_completion_date", label: "Estimated Completion Date", format: "date" },
      { key: "exclusions", label: "Exclusions" },
      { key: "executed", label: "Executed" },
      { key: "execution_date", label: "Execution Date", format: "date" },
      { key: "exhibit_m_wage_scale", label: "Exhibit “M” Wage Scale Requirements" },
      { key: "exhibit_n1_section_3", label: "Exhibit “N-1” Section 3 Requirements" },
      { key: "exhibit_n2_dc_section_3", label: "Exhibit “N-2” District of Columbia Section 3 Requirements" },
      { key: "exhibit_o1_mbe", label: "Exhibit “O-1” MBE Requirements" },
      { key: "exhibit_o2_cbe_sbe", label: "Exhibit “O-2” CBE/SBE Requirements" },
      { key: "exhibit_p1_first_source_hours_worked", label: "Exhibit “P-1” First Source Requirements (Hours Worked)" },
      { key: "exhibit_p2_first_source_hiring", label: "Exhibit “P-2” First Source Requirements (Hiring)" },
      { key: "exhibit_a_scope_of_work", label: "Exhibit A Scope of Work" },
      { key: "global_insurance_compliance", label: "Global Insurance Compliance" },
      { key: "id", label: "ID" },
      { key: "inclusions", label: "Inclusions" },
      { key: "invoice_contacts", label: "Invoice Contacts" },
      { key: "invoiced", label: "Invoiced", format: "currency" },
      { key: "issued_on_date", label: "Issued On Date", format: "date" },
      { key: "letter_of_intent_date", label: "Letter Of Intent Date", format: "date" },
      { key: "level_of_detail_change_orders", label: "Level Of Detail to Display Change Orders" },
      { key: "current_employees_list_section_3", label: "List of all current employees, for Section 3 tracking purposes" },
      { key: "mbe_certification_number", label: "MBE Certification #" },
      { key: "number", label: "Number" },
      { key: "original_contract_amount", label: "Original Contract Amount", format: "currency" },
      { key: "payment_terms", label: "Payment Terms" },
      { key: "payments_issued", label: "Payments Issued", format: "currency" },
      { key: "pending_change_orders", label: "Pending Change Orders", format: "currency" },
      { key: "pending_revised_contract_amount", label: "Pending Revised Contract Amount", format: "currency" },
      { key: "percent_paid", label: "Percent Paid", format: "number" },
      { key: "private", label: "Private" },
      { key: "project_insurance_compliance", label: "Project Insurance Compliance" },
      { key: "remaining_balance", label: "Remaining Balance", format: "currency" },
      { key: "returned_date", label: "Returned Date", format: "date" },
      { key: "revised_contract_amount", label: "Revised Contract Amount", format: "currency" },
      { key: "ship_to", label: "Ship To" },
      { key: "ship_via", label: "Ship Via" },
      { key: "show_cost_code_on_pdf", label: "Show Cost Code on PDF" },
      { key: "show_cover_letter", label: "Show Cover Letter" },
      { key: "show_executed_cover_letter", label: "Show Executed Cover Letter" },
      { key: "sign_with_docusign", label: "Sign With DocuSign" },
      { key: "signed_contract_received_date", label: "Signed Contract Received Date", format: "date" },
      { key: "start_date", label: "Start Date", format: "date" },
      { key: "status", label: "Status" },
      { key: "subcontract_cover_letter", label: "Subcontract Cover Letter-please choose one" },
      { key: "subcontract_type", label: "Subcontract Type (please choose one)" },
      { key: "subcontractor_contact", label: "Subcontractor Contact" },
      { key: "subcontractor_sov_status", label: "Subcontractor SOV Status" },
      { key: "submittals_within_14_days", label: "Submittals to be submitted within 14 days of this subcontract" },
      { key: "synced_with_accounting", label: "Synced With Accounting" },
      { key: "taxable_amount", label: "Taxable Amount", format: "currency" },
      { key: "title", label: "Title" },
      { key: "total_estimated_tax", label: "Total Estimated Tax", format: "currency" },
      { key: "trades", label: "Trades" },
      { key: "type", label: "Type" },
      { key: "view_sov_items", label: "View SOV Items" },
    ],
  },
  {
    label: "Commitment Line Item",
    source: "commitment-line-items",
    fields: [
      { key: "amount", label: "Amount", format: "currency" },
      { key: "approved_amount", label: "Approved Amount", format: "currency" },
      { key: "complete_amount", label: "Complete Amount", format: "currency" },
      { key: "count", label: "Count", format: "number" },
      { key: "currency_code", label: "Currency Code" },
      { key: "date_created", label: "Date Created", format: "date" },
      { key: "date_updated", label: "Date Updated", format: "date" },
      { key: "description", label: "Description" },
      { key: "draft_amount", label: "Draft Amount", format: "currency" },
      { key: "estimated_tax", label: "Estimated Tax", format: "currency" },
      { key: "id", label: "ID" },
      { key: "number", label: "Number" },
      { key: "out_for_signature_amount", label: "Out for Signature Amount", format: "currency" },
      { key: "quantity", label: "Quantity", format: "number" },
      { key: "synced_with_accounting", label: "Synced With Accounting" },
      { key: "tax_code", label: "Tax Code" },
      { key: "tax_codes", label: "Tax Codes" },
      { key: "unit_cost", label: "Unit Cost", format: "currency" },
      { key: "unit_of_measure", label: "Unit Of Measure" },
    ],
  },
  {
    label: "Daily Log Accident",
    source: "daily-log-accidents",
    fields: [
      { key: "area", label: "Area" },
      { key: "attachment_count", label: "Attachment Count", format: "number" },
      { key: "comments", label: "Comments" },
      { key: "company_vendor_name", label: "Company (Vendor) Name" },
      { key: "company_involved", label: "Company Involved" },
      { key: "count", label: "Count", format: "number" },
      { key: "created_by", label: "Created By" },
      { key: "date", label: "Date", format: "date" },
      { key: "date_created", label: "Date Created", format: "date" },
      { key: "date_updated", label: "Date Updated", format: "date" },
      { key: "id", label: "ID" },
      { key: "party_involved", label: "Party Involved" },
      { key: "position", label: "Position" },
      { key: "status", label: "Status" },
      { key: "time", label: "Time" },
    ],
  },
  {
    label: "Daily Log Completion",
    source: "daily-log-completions",
    fields: [
      { key: "completable", label: "Completable" },
      { key: "completed", label: "Completed" },
      { key: "completed_by", label: "Completed By" },
      { key: "completed_date", label: "Completed Date", format: "date" },
      { key: "count", label: "Count", format: "number" },
      { key: "date_updated", label: "Date Updated", format: "date" },
      { key: "day_of_week", label: "Day Of Week" },
      { key: "distributable", label: "Distributable" },
      { key: "distributed", label: "Distributed" },
      { key: "distributed_by", label: "Distributed By" },
      { key: "distributed_date", label: "Distributed Date", format: "date" },
      { key: "id", label: "ID" },
      { key: "log_date", label: "Log Date", format: "date" },
      { key: "missing_day", label: "Missing Day" },
    ],
  },
  {
    label: "Daily Log Construction Report",
    source: "daily-log-construction-reports",
    fields: [
      { key: "apprentice_hours", label: "Apprentice Hours", format: "number" },
      { key: "area", label: "Area" },
      { key: "attachment_count", label: "Attachment Count", format: "number" },
      { key: "comments", label: "Comments" },
      { key: "company_vendor_name", label: "Company (Vendor) Name" },
      { key: "count", label: "Count", format: "number" },
      { key: "created_by", label: "Created By" },
      { key: "date", label: "Date", format: "date" },
      { key: "date_created", label: "Date Created", format: "date" },
      { key: "date_updated", label: "Date Updated", format: "date" },
      { key: "first_year_apprentice_hours", label: "First Year Apprentice Hours", format: "number" },
      { key: "foreman_hours", label: "Foreman Hours", format: "number" },
      { key: "id", label: "ID" },
      { key: "journeyman_hours", label: "Journeyman Hours", format: "number" },
      { key: "local_resident_city_hours", label: "Local Resident (City) Hours", format: "number" },
      { key: "local_resident_county_hours", label: "Local Resident (County) Hours", format: "number" },
      { key: "minority_hours", label: "Minority Hours", format: "number" },
      { key: "num_apprentice_workers", label: "Number Of Apprentice Workers", format: "number" },
      { key: "num_foreman_workers", label: "Number Of Foreman Workers", format: "number" },
      { key: "num_journeyman_workers", label: "Number Of Journeyman Workers", format: "number" },
      { key: "num_other_workers", label: "Number Of Other Workers", format: "number" },
      { key: "other_hours", label: "Other Hours", format: "number" },
      { key: "position", label: "Position" },
      { key: "status", label: "Status" },
      { key: "trade", label: "Trade" },
      { key: "veteran_hours", label: "Veteran Hours", format: "number" },
      { key: "women_hours", label: "Women Hours", format: "number" },
    ],
  },
  {
    label: "Daily Log Delay",
    source: "daily-log-delays",
    fields: [
      { key: "area", label: "Area" },
      { key: "attachment_count", label: "Attachment Count", format: "number" },
      { key: "comments", label: "Comments" },
      { key: "company_vendor_name", label: "Company (Vendor) Name" },
      { key: "count", label: "Count", format: "number" },
      { key: "created_by", label: "Created By" },
      { key: "date", label: "Date", format: "date" },
      { key: "date_created", label: "Date Created", format: "date" },
      { key: "date_updated", label: "Date Updated", format: "date" },
      { key: "delay_type", label: "Delay Type" },
      { key: "duration_hours", label: "Duration (Hours)", format: "number" },
      { key: "end_time", label: "End Time" },
      { key: "id", label: "ID" },
      { key: "position", label: "Position" },
      { key: "start_time", label: "Start Time" },
      { key: "status", label: "Status" },
    ],
  },
  {
    label: "Daily Log Delivery",
    source: "daily-log-deliveries",
    fields: [
      { key: "area", label: "Area" },
      { key: "attachment_count", label: "Attachment Count", format: "number" },
      { key: "comments", label: "Comments" },
      { key: "company_vendor_name", label: "Company (Vendor) Name" },
      { key: "contents", label: "Contents" },
      { key: "count", label: "Count", format: "number" },
      { key: "created_by", label: "Created By" },
      { key: "date", label: "Date", format: "date" },
      { key: "date_created", label: "Date Created", format: "date" },
      { key: "date_updated", label: "Date Updated", format: "date" },
      { key: "delivery_from", label: "Delivery From" },
      { key: "id", label: "ID" },
      { key: "position", label: "Position" },
      { key: "status", label: "Status" },
      { key: "time", label: "Time" },
      { key: "tracking_number", label: "Tracking Number" },
    ],
  },
  {
    label: "Daily Log Dumpster",
    source: "daily-log-dumpsters",
    fields: [
      { key: "area", label: "Area" },
      { key: "attachment_count", label: "Attachment Count", format: "number" },
      { key: "comments", label: "Comments" },
      { key: "company_vendor_name", label: "Company (Vendor) Name" },
      { key: "count", label: "Count", format: "number" },
      { key: "created_by", label: "Created By" },
      { key: "date", label: "Date", format: "date" },
      { key: "date_created", label: "Date Created", format: "date" },
      { key: "date_updated", label: "Date Updated", format: "date" },
      { key: "id", label: "ID" },
      { key: "position", label: "Position" },
      { key: "quantity_delivered", label: "Quantity Delivered", format: "number" },
      { key: "quantity_removed", label: "Quantity Removed", format: "number" },
      { key: "status", label: "Status" },
    ],
  },
  {
    label: "Daily Log Equipment",
    source: "daily-log-equipment",
    fields: [
      { key: "area", label: "Area" },
      { key: "attachment_count", label: "Attachment Count", format: "number" },
      { key: "comments", label: "Comments" },
      { key: "company_vendor_name", label: "Company (Vendor) Name" },
      { key: "cost_code", label: "Cost Code" },
      { key: "count", label: "Count", format: "number" },
      { key: "created_by", label: "Created By" },
      { key: "date", label: "Date", format: "date" },
      { key: "date_created", label: "Date Created", format: "date" },
      { key: "date_updated", label: "Date Updated", format: "date" },
      { key: "equipment", label: "Equipment" },
      { key: "equipment_id", label: "Equipment ID" },
      { key: "hours_idle", label: "Hours Idle", format: "number" },
      { key: "hours_operating", label: "Hours Operating", format: "number" },
      { key: "id", label: "ID" },
      { key: "inspected", label: "Inspected" },
      { key: "inspection_time", label: "Inspection Time" },
      { key: "name", label: "Name" },
      { key: "position", label: "Position" },
      { key: "status", label: "Status" },
    ],
  },
  {
    label: "Daily Log Inspection",
    source: "daily-log-inspections",
    fields: [
      { key: "attachment_count", label: "Attachment Count", format: "number" },
      { key: "comments", label: "Comments" },
      { key: "company_vendor_name", label: "Company (Vendor) Name" },
      { key: "count", label: "Count", format: "number" },
      { key: "created_by", label: "Created By" },
      { key: "date", label: "Date", format: "date" },
      { key: "date_created", label: "Date Created", format: "date" },
      { key: "date_updated", label: "Date Updated", format: "date" },
      { key: "end", label: "End" },
      { key: "id", label: "ID" },
      { key: "inspecting_entity", label: "Inspecting Entity" },
      { key: "inspection_area", label: "Inspection Area" },
      { key: "inspection_type", label: "Inspection Type" },
      { key: "inspector_name", label: "Inspector Name" },
      { key: "position", label: "Position" },
      { key: "start", label: "Start" },
      { key: "status", label: "Status" },
    ],
  },
  {
    label: "Daily Log Manpower",
    source: "daily-log-manpower",
    fields: [
      { key: "area", label: "Area" },
      { key: "attachment_count", label: "Attachment Count", format: "number" },
      { key: "comments", label: "Comments" },
      { key: "company_vendor_name", label: "Company (Vendor) Name" },
      { key: "cost_code", label: "Cost Code" },
      { key: "count", label: "Count", format: "number" },
      { key: "created_by", label: "Created By" },
      { key: "date", label: "Date", format: "date" },
      { key: "date_created", label: "Date Created", format: "date" },
      { key: "date_updated", label: "Date Updated", format: "date" },
      { key: "employee_name", label: "Employee Name" },
      { key: "hours", label: "Hours", format: "number" },
      { key: "id", label: "ID" },
      { key: "position", label: "Position" },
      { key: "status", label: "Status" },
      { key: "total_hours", label: "Total Hours", format: "number" },
      { key: "trade", label: "Trade" },
      { key: "workers", label: "Workers", format: "number" },
    ],
  },
  {
    label: "Daily Log Note",
    source: "daily-log-notes",
    fields: [
      { key: "area", label: "Area" },
      { key: "attachment_count", label: "Attachment Count", format: "number" },
      { key: "comment", label: "Comment" },
      { key: "company_vendor_name", label: "Company (Vendor) Name" },
      { key: "count", label: "Count", format: "number" },
      { key: "created_by", label: "Created By" },
      { key: "date", label: "Date", format: "date" },
      { key: "date_created", label: "Date Created", format: "date" },
      { key: "date_updated", label: "Date Updated", format: "date" },
      { key: "id", label: "ID" },
      { key: "is_issue", label: "Is Issue" },
      { key: "position", label: "Position" },
      { key: "status", label: "Status" },
    ],
  },
  {
    label: "Daily Log Observed Weather Condition",
    source: "daily-log-weather",
    fields: [
      { key: "area", label: "Area" },
      { key: "attachment_count", label: "Attachment Count", format: "number" },
      { key: "average", label: "Average" },
      { key: "calamity", label: "Calamity" },
      { key: "comments", label: "Comments" },
      { key: "company_vendor_name", label: "Company (Vendor) Name" },
      { key: "count", label: "Count", format: "number" },
      { key: "created_by", label: "Created By" },
      { key: "date", label: "Date", format: "date" },
      { key: "date_created", label: "Date Created", format: "date" },
      { key: "date_updated", label: "Date Updated", format: "date" },
      { key: "ground_sea", label: "Ground/Sea" },
      { key: "id", label: "ID" },
      { key: "is_weather_delay", label: "Is Weather Delay" },
      { key: "measured_dew_point", label: "Measured Dew Point", format: "number" },
      { key: "measured_humidity_average", label: "Measured Humidity Average", format: "number" },
      { key: "measured_humidity_high", label: "Measured Humidity High", format: "number" },
      { key: "measured_humidity_low", label: "Measured Humidity Low", format: "number" },
      { key: "measured_precipitation_since_midnight", label: "Measured Precipitation Since Midnight", format: "number" },
      { key: "measured_temperature_average", label: "Measured Temperature Average", format: "number" },
      { key: "measured_temperature_high", label: "Measured Temperature High", format: "number" },
      { key: "measured_temperature_low", label: "Measured Temperature Low", format: "number" },
      { key: "measured_wind_speed_average", label: "Measured Wind Speed Average", format: "number" },
      { key: "measured_wind_speed_gust", label: "Measured Wind Speed Gust", format: "number" },
      { key: "measured_wind_speed_max", label: "Measured Wind Speed Max", format: "number" },
      { key: "precipitation", label: "Precipitation" },
      { key: "sky", label: "Sky" },
      { key: "temperature", label: "Temperature" },
      { key: "wind", label: "Wind" },
    ],
  },
  {
    label: "Daily Log Phone Call",
    source: "daily-log-phone-calls",
    fields: [
      { key: "area", label: "Area" },
      { key: "attachment_count", label: "Attachment Count", format: "number" },
      { key: "call_from", label: "Call From" },
      { key: "call_to", label: "Call To" },
      { key: "comments", label: "Comments" },
      { key: "company_vendor_name", label: "Company (Vendor) Name" },
      { key: "count", label: "Count", format: "number" },
      { key: "created_by", label: "Created By" },
      { key: "date", label: "Date", format: "date" },
      { key: "date_created", label: "Date Created", format: "date" },
      { key: "date_updated", label: "Date Updated", format: "date" },
      { key: "end", label: "End" },
      { key: "id", label: "ID" },
      { key: "position", label: "Position" },
      { key: "start", label: "Start" },
      { key: "status", label: "Status" },
    ],
  },
  {
    label: "Daily Log Plan Revision",
    source: "daily-log-plan-revisions",
    fields: [
      { key: "area", label: "Area" },
      { key: "attachment_count", label: "Attachment Count", format: "number" },
      { key: "category", label: "Category" },
      { key: "comments", label: "Comments" },
      { key: "company_vendor_name", label: "Company (Vendor) Name" },
      { key: "count", label: "Count", format: "number" },
      { key: "created_by", label: "Created By" },
      { key: "date", label: "Date", format: "date" },
      { key: "date_created", label: "Date Created", format: "date" },
      { key: "date_updated", label: "Date Updated", format: "date" },
      { key: "id", label: "ID" },
      { key: "plan_number", label: "Plan Number" },
      { key: "position", label: "Position" },
      { key: "revision", label: "Revision" },
      { key: "status", label: "Status" },
      { key: "title", label: "Title" },
    ],
  },
  {
    label: "Daily Log Productivity",
    source: "daily-log-productivity",
    fields: [
      { key: "area", label: "Area" },
      { key: "attachment_count", label: "Attachment Count", format: "number" },
      { key: "comments", label: "Comments" },
      { key: "company_vendor_name", label: "Company (Vendor) Name" },
      { key: "count", label: "Count", format: "number" },
      { key: "created_by", label: "Created By" },
      { key: "date", label: "Date", format: "date" },
      { key: "date_created", label: "Date Created", format: "date" },
      { key: "date_updated", label: "Date Updated", format: "date" },
      { key: "id", label: "ID" },
      { key: "position", label: "Position" },
      { key: "previously_delivered", label: "Previously Delivered", format: "number" },
      { key: "previously_put_in_place", label: "Previously Put in Place", format: "number" },
      { key: "quantity_delivered", label: "Quantity Delivered", format: "number" },
      { key: "quantity_put_in_place", label: "Quantity Put in Place", format: "number" },
      { key: "status", label: "Status" },
    ],
  },
  {
    label: "Daily Log Quantity",
    source: "daily-log-quantities",
    fields: [
      { key: "area", label: "Area" },
      { key: "attachment_count", label: "Attachment Count", format: "number" },
      { key: "comments", label: "Comments" },
      { key: "company_vendor_name", label: "Company (Vendor) Name" },
      { key: "cost_code", label: "Cost Code" },
      { key: "count", label: "Count", format: "number" },
      { key: "created_by", label: "Created By" },
      { key: "date", label: "Date", format: "date" },
      { key: "date_created", label: "Date Created", format: "date" },
      { key: "date_updated", label: "Date Updated", format: "date" },
      { key: "id", label: "ID" },
      { key: "position", label: "Position" },
      { key: "quantity", label: "Quantity", format: "number" },
      { key: "status", label: "Status" },
      { key: "unit", label: "Unit" },
    ],
  },
  {
    label: "Daily Log Safety Violation",
    source: "daily-log-safety-violations",
    fields: [
      { key: "area", label: "Area" },
      { key: "attachment_count", label: "Attachment Count", format: "number" },
      { key: "comments", label: "Comments" },
      { key: "company_vendor_name", label: "Company (Vendor) Name" },
      { key: "compliance_due_date", label: "Compliance Due Date", format: "date" },
      { key: "count", label: "Count", format: "number" },
      { key: "created_by", label: "Created By" },
      { key: "date", label: "Date", format: "date" },
      { key: "date_created", label: "Date Created", format: "date" },
      { key: "date_updated", label: "Date Updated", format: "date" },
      { key: "id", label: "ID" },
      { key: "issued_to", label: "Issued To" },
      { key: "position", label: "Position" },
      { key: "safety_notice", label: "Safety Notice" },
      { key: "status", label: "Status" },
      { key: "subject", label: "Subject" },
      { key: "time", label: "Time" },
    ],
  },
  {
    label: "Daily Log Scheduled Work",
    source: "daily-log-scheduled-work",
    fields: [
      { key: "area", label: "Area" },
      { key: "comments", label: "Comments" },
      { key: "company_vendor_name", label: "Company (Vendor) Name" },
      { key: "count", label: "Count", format: "number" },
      { key: "created_by", label: "Created By" },
      { key: "date", label: "Date", format: "date" },
      { key: "hourly_rate", label: "Hourly Rate", format: "currency" },
      { key: "hours", label: "Hours", format: "number" },
      { key: "id", label: "ID" },
      { key: "position", label: "Position" },
      { key: "reimbursable", label: "Reimbursable" },
      { key: "resource_name", label: "Resource Name" },
      { key: "showed", label: "Showed" },
      { key: "status", label: "Status" },
      { key: "tasks", label: "Tasks" },
      { key: "workers", label: "Workers", format: "number" },
    ],
  },
  {
    label: "Daily Log Scheduled Work Task",
    source: "daily-log-scheduled-work-tasks",
    fields: [
      { key: "attachment_count", label: "Attachment Count", format: "number" },
      { key: "count", label: "Count", format: "number" },
      { key: "date_updated", label: "Date Updated", format: "date" },
      { key: "id", label: "ID" },
      { key: "task_name", label: "Task Name" },
      { key: "task_percentage", label: "Task Percentage", format: "number" },
      { key: "task_row_number", label: "Task Row Number", format: "number" },
    ],
  },
  {
    label: "Daily Log Visitor",
    source: "daily-log-visitors",
    fields: [
      { key: "area", label: "Area" },
      { key: "attachment_count", label: "Attachment Count", format: "number" },
      { key: "comments", label: "Comments" },
      { key: "company_vendor_name", label: "Company (Vendor) Name" },
      { key: "count", label: "Count", format: "number" },
      { key: "created_by", label: "Created By" },
      { key: "date", label: "Date", format: "date" },
      { key: "date_created", label: "Date Created", format: "date" },
      { key: "date_updated", label: "Date Updated", format: "date" },
      { key: "end", label: "End" },
      { key: "id", label: "ID" },
      { key: "position", label: "Position" },
      { key: "start", label: "Start" },
      { key: "status", label: "Status" },
      { key: "visitor", label: "Visitor" },
    ],
  },
  {
    label: "Daily Log Waste",
    source: "daily-log-waste",
    fields: [
      { key: "approximate_quantity", label: "Approximate Quantity", format: "number" },
      { key: "area", label: "Area" },
      { key: "attachment_count", label: "Attachment Count", format: "number" },
      { key: "comments", label: "Comments" },
      { key: "count", label: "Count", format: "number" },
      { key: "created_by", label: "Created By" },
      { key: "date", label: "Date", format: "date" },
      { key: "date_created", label: "Date Created", format: "date" },
      { key: "date_updated", label: "Date Updated", format: "date" },
      { key: "disposal_location", label: "Disposal Location" },
      { key: "disposed_by", label: "Disposed By" },
      { key: "id", label: "ID" },
      { key: "material", label: "Material" },
      { key: "method_of_disposal", label: "Method Of Disposal" },
      { key: "position", label: "Position" },
      { key: "status", label: "Status" },
      { key: "time", label: "Time" },
    ],
  },
  {
    label: "Drawing",
    source: "drawings",
    fields: [
      { key: "area", label: "Area" },
      { key: "area_description", label: "Area Description" },
      { key: "confirmed_by", label: "Confirmed By" },
      { key: "confirmed_date", label: "Confirmed Date", format: "date" },
      { key: "count", label: "Count", format: "number" },
      { key: "created_by", label: "Created By" },
      { key: "current_revision", label: "Current Revision" },
      { key: "date_published", label: "Date Published", format: "date" },
      { key: "date_updated", label: "Date Updated", format: "date" },
      { key: "default_drawing_date", label: "Default Drawing Date", format: "date" },
      { key: "default_received_date", label: "Default Received Date", format: "date" },
      { key: "discipline", label: "Discipline" },
      { key: "has_markup", label: "Has Markup" },
      { key: "id", label: "ID" },
      { key: "is_connected_drawing", label: "Is Connected Drawing" },
      { key: "number", label: "Number" },
      { key: "obsolete", label: "Obsolete" },
      { key: "position", label: "Position" },
      { key: "published_by", label: "Published By" },
      { key: "revision", label: "Revision" },
      { key: "set", label: "Set" },
      { key: "set_date", label: "Set Date", format: "date" },
      { key: "sketch_count", label: "Sketch Count", format: "number" },
      { key: "status", label: "Status" },
      { key: "title", label: "Title" },
    ],
  },
  {
    label: "Drawing Markup Link",
    source: "drawing-markup-links",
    fields: [
      { key: "count", label: "Count", format: "number" },
      { key: "created_by", label: "Created By" },
      { key: "date_created", label: "Date Created", format: "date" },
      { key: "date_updated", label: "Date Updated", format: "date" },
      { key: "id", label: "ID" },
      { key: "tool_type", label: "Tool Type" },
      { key: "type", label: "Type" },
    ],
  },
  {
    label: "External RFI",
    source: "external-rfis",
    fields: [
      { key: "count", label: "Count", format: "number" },
      { key: "created_by", label: "Created By" },
      { key: "date_closed", label: "Date Closed", format: "date" },
      { key: "date_created", label: "Date Created", format: "date" },
      { key: "date_initiated", label: "Date Initiated", format: "date" },
      { key: "date_updated", label: "Date Updated", format: "date" },
      { key: "due_date", label: "Due Date", format: "date" },
      { key: "id", label: "ID" },
      { key: "is_disconnected", label: "Is Disconnected" },
      { key: "number", label: "Number" },
      { key: "private", label: "Private" },
      { key: "question", label: "Question" },
      { key: "rfi_manager", label: "RFI Manager" },
      { key: "subject", label: "Subject" },
      { key: "sync_status", label: "Sync Status" },
    ],
  },
  {
    label: "External RFI Response",
    source: "external-rfi-responses",
    fields: [
      { key: "count", label: "Count", format: "number" },
      { key: "created_by", label: "Created By" },
      { key: "date_created", label: "Date Created", format: "date" },
      { key: "date_updated", label: "Date Updated", format: "date" },
      { key: "id", label: "ID" },
      { key: "official", label: "Official" },
      { key: "response", label: "Response" },
    ],
  },
  {
    label: "Folder/Document",
    source: "documents",
    fields: [
      { key: "checked_out_by", label: "Checked Out By" },
      { key: "checked_out_until", label: "Checked Out Until", format: "date" },
      { key: "comment", label: "Comment" },
      { key: "count", label: "Count", format: "number" },
      { key: "created_by", label: "Created By" },
      { key: "date_created", label: "Date Created", format: "date" },
      { key: "date_updated", label: "Date Updated", format: "date" },
      { key: "description", label: "Description" },
      { key: "file_size_bytes", label: "File Size (Bytes)", format: "number" },
      { key: "id", label: "ID" },
      { key: "is_current", label: "Is Current" },
      { key: "is_folder", label: "Is Folder" },
      { key: "latest_version_name", label: "Latest Version Name" },
      { key: "name", label: "Name" },
      { key: "name_with_path", label: "Name With Path" },
      { key: "private", label: "Private" },
      { key: "tags", label: "Tags" },
      { key: "version", label: "Version", format: "number" },
    ],
  },
  {
    label: "Folder/Document Watcher",
    source: "document-watchers",
    fields: [
      { key: "count", label: "Count", format: "number" },
      { key: "date_created", label: "Date Created", format: "date" },
      { key: "id", label: "ID" },
      { key: "name", label: "Name" },
    ],
  },
  {
    label: "Locations",
    source: "locations",
    fields: [
      { key: "count", label: "Count", format: "number" },
      { key: "full_name", label: "Full Name" },
      { key: "id", label: "ID" },
      { key: "level_1_name", label: "Level 1 Name" },
      { key: "level_2_name", label: "Level 2 Name" },
      { key: "level_3_name", label: "Level 3 Name" },
      { key: "level_4_name", label: "Level 4 Name" },
      { key: "level_5_name", label: "Level 5 Name" },
    ],
  },
  {
    label: "Meeting",
    source: "meetings",
    fields: [
      { key: "attachment_count", label: "Attachment Count", format: "number" },
      { key: "attendees", label: "Attendees" },
      { key: "attendees_absent_count", label: "Attendees Absent Count", format: "number" },
      { key: "attendees_attended_count", label: "Attendees Attended Count", format: "number" },
      { key: "attendees_invited_count", label: "Attendees Invited Count", format: "number" },
      { key: "count", label: "Count", format: "number" },
      { key: "created_by", label: "Created By" },
      { key: "created_date", label: "Created Date", format: "date" },
      { key: "date", label: "Date", format: "date" },
      { key: "date_updated", label: "Date Updated", format: "date" },
      { key: "distributed_by", label: "Distributed By" },
      { key: "distributed_date", label: "Distributed Date", format: "date" },
      { key: "draft_meeting", label: "Draft Meeting" },
      { key: "finish_time", label: "Finish Time" },
      { key: "id", label: "ID" },
      { key: "item_count", label: "Item Count", format: "number" },
      { key: "last_distributed_event", label: "Last Distributed Event" },
      { key: "location", label: "Location" },
      { key: "mode", label: "Mode" },
      { key: "name", label: "Name" },
      { key: "number", label: "Number" },
      { key: "overview", label: "Overview" },
      { key: "private", label: "Private" },
      { key: "series", label: "Series" },
      { key: "start_time", label: "Start Time" },
      { key: "template", label: "Template" },
      { key: "timezone", label: "Timezone" },
    ],
  },
  {
    label: "Meeting Attendee",
    source: "meeting-attendees",
    fields: [
      { key: "absent", label: "Absent" },
      { key: "company_vendor_name", label: "Company (Vendor) Name" },
      { key: "conference", label: "Conference" },
      { key: "count", label: "Count", format: "number" },
      { key: "for_distribution_only", label: "For Distribution Only" },
      { key: "id", label: "ID" },
      { key: "minutes_approval_requested", label: "Minutes Approval Requested" },
      { key: "minutes_approved", label: "Minutes Approved" },
      { key: "minutes_comments", label: "Minutes Comments" },
      { key: "person", label: "Person" },
      { key: "present", label: "Present" },
    ],
  },
  {
    label: "Meeting Item",
    source: "meeting-items",
    fields: [
      { key: "agenda_item_number", label: "Agenda/Item Number" },
      { key: "assignees", label: "Assignees" },
      { key: "category", label: "Category" },
      { key: "cost_code", label: "Cost Code" },
      { key: "count", label: "Count", format: "number" },
      { key: "created_by", label: "Created By" },
      { key: "current_topic", label: "Current Topic" },
      { key: "date_closed", label: "Date Closed", format: "date" },
      { key: "date_created", label: "Date Created", format: "date" },
      { key: "date_updated", label: "Date Updated", format: "date" },
      { key: "description", label: "Description" },
      { key: "due_date", label: "Due Date", format: "date" },
      { key: "id", label: "ID" },
      { key: "minutes", label: "Minutes" },
      { key: "priority", label: "Priority" },
      { key: "status", label: "Status" },
      { key: "title", label: "Title" },
    ],
  },
  {
    label: "Meeting Item Assignee",
    source: "meeting-item-assignees",
    fields: [
      { key: "company_vendor_name", label: "Company (Vendor) Name" },
      { key: "count", label: "Count", format: "number" },
      { key: "id", label: "ID" },
      { key: "name", label: "Name" },
    ],
  },
  {
    label: "Photo",
    source: "photos",
    fields: [
      { key: "album", label: "Album" },
      { key: "comment_count", label: "Comment Count", format: "number" },
      { key: "count", label: "Count", format: "number" },
      { key: "date_created", label: "Date Created", format: "date" },
      { key: "date_updated", label: "Date Updated", format: "date" },
      { key: "description", label: "Description" },
      { key: "filename", label: "Filename" },
      { key: "gps_latitude", label: "GPS Latitude" },
      { key: "gps_longitude", label: "GPS Longitude" },
      { key: "height", label: "Height", format: "number" },
      { key: "id", label: "ID" },
      { key: "origin_type", label: "Origin Type" },
      { key: "private", label: "Private" },
      { key: "starred", label: "Starred" },
      { key: "taken_on", label: "Taken On", format: "date" },
      { key: "uploader_name", label: "Uploader Name" },
      { key: "width", label: "Width", format: "number" },
    ],
  },
  { label: "Project", source: "project", fields: PROJECT_FIELDS },
  { label: "Project Roles", source: "project-roles", fields: PROJECT_ROLES_FIELDS },
  {
    label: "Punch Item",
    source: "punch-items",
    fields: [
      { key: "assignees", label: "Assignees" },
      { key: "attachment_count", label: "Attachment Count", format: "number" },
      { key: "ball_in_court", label: "Ball in Court" },
      { key: "closed_by", label: "Closed By" },
      { key: "cost_code", label: "Cost Code" },
      { key: "cost_impact", label: "Cost Impact" },
      { key: "cost_impact_amount", label: "Cost Impact Amount", format: "currency" },
      { key: "count", label: "Count", format: "number" },
      { key: "created_by", label: "Created By" },
      { key: "date_closed", label: "Date Closed", format: "date" },
      { key: "date_created", label: "Date Created", format: "date" },
      { key: "date_updated", label: "Date Updated", format: "date" },
      { key: "description", label: "Description" },
      { key: "distribution_members", label: "Distribution Members" },
      { key: "due_date", label: "Due Date", format: "date" },
      { key: "email_sent", label: "Email Sent" },
      { key: "final_approver", label: "Final Approver" },
      { key: "has_resolved_responses", label: "Has Resolved Responses" },
      { key: "has_unresolved_responses", label: "Has Unresolved Responses" },
      { key: "id", label: "ID" },
      { key: "number", label: "Number" },
      { key: "overdue", label: "Overdue" },
      { key: "priority", label: "Priority" },
      { key: "private", label: "Private" },
      { key: "punch_item_manager", label: "Punch Item Manager" },
      { key: "reference", label: "Reference" },
      { key: "schedule_impact", label: "Schedule Impact" },
      { key: "schedule_impact_days", label: "Schedule Impact Days", format: "number" },
      { key: "status", label: "Status" },
      { key: "title", label: "Title" },
      { key: "trade", label: "Trade" },
      { key: "type", label: "Type" },
    ],
  },
  {
    label: "Punch Item Activity",
    source: "punch-item-activity",
    fields: [
      { key: "attachments_count", label: "Attachments Count", format: "number" },
      { key: "comment", label: "Comment" },
      { key: "count", label: "Count", format: "number" },
      { key: "created_by_id", label: "Created By ID" },
      { key: "created_by_login", label: "Created By Login" },
      { key: "created_by_name", label: "Created By Name" },
      { key: "date_created", label: "Date Created", format: "date" },
      { key: "date_updated", label: "Date Updated", format: "date" },
      { key: "id", label: "ID" },
      { key: "status", label: "Status" },
    ],
  },
  {
    label: "Punch Item Assignee",
    source: "punch-item-assignees",
    fields: [
      { key: "comment", label: "Comment" },
      { key: "company_vendor_name", label: "Company (Vendor) Name" },
      { key: "count", label: "Count", format: "number" },
      { key: "date_created", label: "Date Created", format: "date" },
      { key: "date_notified", label: "Date Notified", format: "date" },
      { key: "date_ready_for_review", label: "Date Ready for Review", format: "date" },
      { key: "date_updated", label: "Date Updated", format: "date" },
      { key: "date_work_not_accepted", label: "Date Work Not Accepted", format: "date" },
      { key: "id", label: "ID" },
      { key: "name", label: "Name" },
      { key: "response", label: "Response" },
      { key: "response_date", label: "Response Date", format: "date" },
    ],
  },
  {
    label: "Punch Item Ball in Court",
    source: "punch-item-ball-in-court",
    fields: [
      { key: "ball_in_court_role", label: "Ball In Court Role" },
      { key: "count", label: "Count", format: "number" },
      { key: "date_created", label: "Date Created", format: "date" },
      { key: "date_updated", label: "Date Updated", format: "date" },
      { key: "id", label: "ID" },
      { key: "name", label: "Name" },
    ],
  },
  {
    label: "Punch Item Distribution Member",
    source: "punch-item-distribution-members",
    fields: [
      { key: "count", label: "Count", format: "number" },
      { key: "id", label: "ID" },
      { key: "name", label: "Name" },
    ],
  },
  {
    label: "RFI",
    source: "rfis",
    fields: [
      { key: "assignees", label: "Assignees" },
      { key: "attachment_count", label: "Attachment Count", format: "number" },
      { key: "ball_in_court", label: "Ball In Court" },
      { key: "company_vendor_name", label: "Company (Vendor) Name" },
      { key: "cost_code", label: "Cost Code" },
      { key: "cost_impact", label: "Cost Impact" },
      { key: "cost_impact_value", label: "Cost Impact Value", format: "currency" },
      { key: "count", label: "Count", format: "number" },
      { key: "created_by", label: "Created By" },
      { key: "current_revision", label: "Current Revision" },
      { key: "date_closed", label: "Date Closed", format: "date" },
      { key: "date_created", label: "Date Created", format: "date" },
      { key: "date_initiated", label: "Date Initiated", format: "date" },
      { key: "drawing_number", label: "Drawing Number" },
      { key: "due_date", label: "Due Date", format: "date" },
      { key: "due_date_variance_days", label: "Due Date Variance (Days)", format: "number" },
      { key: "id", label: "ID" },
      { key: "number", label: "Number" },
      { key: "overdue", label: "Overdue" },
      { key: "predicted_outlier", label: "Predicted Outlier" },
      { key: "predicted_outlier_reason", label: "Predicted Outlier Reason" },
      { key: "predicted_primary_assignee_company", label: "Predicted Primary Assignee Company" },
      { key: "predicted_primary_assignee_last_official_response_date", label: "Predicted Primary Assignee Last Official Response Date", format: "date" },
      { key: "predicted_primary_assignee_last_response_date", label: "Predicted Primary Assignee Last Response Date", format: "date" },
      { key: "predicted_primary_assignee_response_days", label: "Predicted Primary Assignee Response Days", format: "number" },
      { key: "predicted_topic", label: "Predicted Topic" },
      { key: "prefix", label: "Prefix" },
      { key: "private", label: "Private" },
      { key: "project_timeline_percentage", label: "Project Timeline Percentage", format: "number" },
      { key: "question", label: "Question" },
      { key: "question_created_at", label: "Question Created At", format: "date" },
      { key: "received_from", label: "Received From" },
      { key: "reference", label: "Reference" },
      { key: "responsible_contractor", label: "Responsible Contractor" },
      { key: "revision", label: "Revision" },
      { key: "rfi_manager", label: "RFI Manager" },
      { key: "schedule_impact", label: "Schedule Impact" },
      { key: "schedule_impact_value", label: "Schedule Impact Value", format: "number" },
      { key: "stage", label: "Stage" },
      { key: "status", label: "Status" },
      { key: "sub_job", label: "Sub Job" },
      { key: "subject", label: "Subject" },
    ],
  },
  {
    label: "RFI Assignee",
    source: "rfi-assignees",
    fields: [
      { key: "assignee_company_name", label: "Assignee Company Name" },
      { key: "assignee_name", label: "Assignee Name" },
      { key: "count", label: "Count", format: "number" },
      { key: "forwarded_by", label: "Forwarded By" },
      { key: "id", label: "ID" },
      { key: "response_required", label: "Response Required" },
    ],
  },
  {
    label: "RFI Ball in Court",
    source: "rfi-ball-in-court",
    fields: [
      { key: "ball_in_court_role", label: "Ball In Court Role" },
      { key: "company_vendor_name", label: "Company (Vendor) Name" },
      { key: "count", label: "Count", format: "number" },
      { key: "date_created", label: "Date Created", format: "date" },
      { key: "date_updated", label: "Date Updated", format: "date" },
      { key: "id", label: "ID" },
      { key: "name", label: "Name" },
      { key: "response_required", label: "Response Required" },
    ],
  },
  {
    label: "RFI Distribution List",
    source: "rfi-distribution-list",
    fields: [
      { key: "count", label: "Count", format: "number" },
      { key: "id", label: "ID" },
      { key: "name", label: "Name" },
    ],
  },
  {
    label: "RFI Response",
    source: "rfi-responses",
    fields: [
      { key: "count", label: "Count", format: "number" },
      { key: "created_by", label: "Created By" },
      { key: "date_created", label: "Date Created", format: "date" },
      { key: "date_updated", label: "Date Updated", format: "date" },
      { key: "id", label: "ID" },
      { key: "is_most_recent", label: "Is Most Recent" },
      { key: "official", label: "Official" },
      { key: "response", label: "Response" },
    ],
  },
  {
    label: "Schedule Calendar Item",
    source: "schedule-calendar-items",
    legacy: true,
    fields: [
      { key: "assignee_name", label: "Assignee Name" },
      { key: "count", label: "Count", format: "number" },
      { key: "created_by", label: "Created By" },
      { key: "date_updated", label: "Date Updated", format: "date" },
      { key: "description", label: "Description" },
      { key: "finish_date", label: "Finish Date", format: "date" },
      { key: "id", label: "ID" },
      { key: "percent_complete", label: "Percent Complete", format: "number" },
      { key: "private", label: "Private" },
      { key: "start_date", label: "Start Date", format: "date" },
      { key: "title", label: "Title" },
    ],
  },
  {
    label: "Schedule Lookahead",
    source: "schedule-lookaheads",
    legacy: true,
    fields: [
      { key: "count", label: "Count", format: "number" },
      { key: "created_by", label: "Created By" },
      { key: "date_created", label: "Date Created", format: "date" },
      { key: "date_updated", label: "Date Updated", format: "date" },
      { key: "duration_weeks", label: "Duration (Weeks)", format: "number" },
      { key: "end_date", label: "End Date", format: "date" },
      { key: "id", label: "ID" },
      { key: "name", label: "Name" },
      { key: "start_date", label: "Start Date", format: "date" },
    ],
  },
  {
    label: "Schedule Lookahead Task",
    source: "schedule-lookahead-tasks",
    legacy: true,
    fields: [
      { key: "assignees", label: "Assignees" },
      { key: "companies", label: "Companies" },
      { key: "count", label: "Count", format: "number" },
      { key: "created_by", label: "Created By" },
      { key: "date_created", label: "Date Created", format: "date" },
      { key: "date_updated", label: "Date Updated", format: "date" },
      { key: "duration", label: "Duration" },
      { key: "finish_date", label: "Finish Date", format: "date" },
      { key: "full_outline_path", label: "Full Outline Path" },
      { key: "id", label: "ID" },
      { key: "notes", label: "Notes" },
      { key: "parent_task_name", label: "Parent Task Name" },
      { key: "resources", label: "Resources" },
      { key: "start_date", label: "Start Date", format: "date" },
      { key: "task_id", label: "Task ID" },
      { key: "task_name", label: "Task Name" },
    ],
  },
  {
    label: "Schedule Task",
    source: "schedule-tasks",
    legacy: true,
    fields: [
      { key: "activity_id", label: "Activity ID" },
      { key: "actual_finish_date", label: "Actual Finish Date", format: "date" },
      { key: "actual_start_date", label: "Actual Start Date", format: "date" },
      { key: "baseline_finish_date", label: "Baseline Finish Date", format: "date" },
      { key: "baseline_start_date", label: "Baseline Start Date", format: "date" },
      { key: "count", label: "Count", format: "number" },
      { key: "created_by", label: "Created By" },
      { key: "critical_path", label: "Critical Path" },
      { key: "date_created", label: "Date Created", format: "date" },
      { key: "date_updated", label: "Date Updated", format: "date" },
      { key: "duration", label: "Duration" },
      { key: "finish_date", label: "Finish Date", format: "date" },
      { key: "finish_variance", label: "Finish Variance" },
      { key: "full_outline_path", label: "Full Outline Path" },
      { key: "id", label: "ID" },
      { key: "is_subtask", label: "Is Subtask" },
      { key: "is_summary_task", label: "Is Summary Task" },
      { key: "milestone", label: "Milestone" },
      { key: "name", label: "Name" },
      { key: "notes", label: "Notes" },
      { key: "percent_complete", label: "Percent Complete", format: "number" },
      { key: "predecessor", label: "Predecessor" },
      { key: "resources", label: "Resources" },
      { key: "start_date", label: "Start Date", format: "date" },
      { key: "start_variance", label: "Start Variance" },
      { key: "successor", label: "Successor" },
      { key: "summary_task_name", label: "Summary Task Name" },
      { key: "task_id", label: "Task ID" },
      { key: "wbs", label: "WBS" },
    ],
  },
  {
    label: "Schedule Task Change",
    source: "schedule-task-changes",
    legacy: true,
    fields: [
      { key: "change_date", label: "Change Date", format: "date" },
      { key: "count", label: "Count", format: "number" },
      { key: "id", label: "ID" },
      { key: "new_duration", label: "New Duration" },
      { key: "new_finish_date", label: "New Finish Date", format: "date" },
      { key: "new_name", label: "New Name" },
      { key: "new_percent_complete", label: "New Percent Complete", format: "number" },
      { key: "new_start_date", label: "New Start Date", format: "date" },
      { key: "old_duration", label: "Old Duration" },
      { key: "old_finish_date", label: "Old Finish Date", format: "date" },
      { key: "old_name", label: "Old Name" },
      { key: "old_percent_complete", label: "Old Percent Complete", format: "number" },
      { key: "old_start_date", label: "Old Start Date", format: "date" },
      { key: "reason", label: "Reason" },
    ],
  },
  {
    label: "Schedule Task Request",
    source: "schedule-task-requests",
    legacy: true,
    fields: [
      { key: "count", label: "Count", format: "number" },
      { key: "created_by", label: "Created By" },
      { key: "date_created", label: "Date Created", format: "date" },
      { key: "finish_date", label: "Finish Date", format: "date" },
      { key: "id", label: "ID" },
      { key: "notes", label: "Notes" },
      { key: "other_change", label: "Other Change" },
      { key: "percent_complete", label: "Percent Complete", format: "number" },
      { key: "reason", label: "Reason" },
      { key: "start_date", label: "Start Date", format: "date" },
      { key: "status", label: "Status" },
    ],
  },
  {
    label: "Specification Section",
    source: "specification-sections",
    fields: [
      { key: "area", label: "Area" },
      { key: "area_description", label: "Area Description" },
      { key: "count", label: "Count", format: "number" },
      { key: "current_revision", label: "Current Revision" },
      { key: "date_created", label: "Date Created", format: "date" },
      { key: "date_updated", label: "Date Updated", format: "date" },
      { key: "description", label: "Description" },
      { key: "id", label: "ID" },
      { key: "issued_date", label: "Issued Date", format: "date" },
      { key: "number", label: "Number" },
      { key: "obsolete", label: "Obsolete" },
      { key: "received_date", label: "Received Date", format: "date" },
      { key: "revision", label: "Revision" },
    ],
  },
  {
    label: "Submittal",
    source: "submittals",
    fields: [
      { key: "actual_delivery_date", label: "Actual Delivery Date", format: "date" },
      { key: "anticipated_delivery_date", label: "Anticipated Delivery Date", format: "date" },
      { key: "approver_name", label: "Approver Name" },
      { key: "approvers", label: "Approvers" },
      { key: "attachment_count", label: "Attachment Count", format: "number" },
      { key: "ball_in_court", label: "Ball In Court" },
      { key: "ball_in_court_role", label: "Ball In Court Role" },
      { key: "confirmed_delivery_date", label: "Confirmed Delivery Date", format: "date" },
      { key: "cost_code", label: "Cost Code" },
      { key: "count", label: "Count", format: "number" },
      { key: "created_by", label: "Created By" },
      { key: "current_revision", label: "Current Revision" },
      { key: "date_closed", label: "Date Closed", format: "date" },
      { key: "date_created", label: "Date Created", format: "date" },
      { key: "description", label: "Description" },
      { key: "design_team_review_time", label: "Design Team Review Time" },
      { key: "distributed_date", label: "Distributed Date", format: "date" },
      { key: "distribution_list", label: "Distribution List" },
      { key: "final_due_date", label: "Final Due Date", format: "date" },
      { key: "id", label: "ID" },
      { key: "internal_review_time", label: "Internal Review Time" },
      { key: "issue_date", label: "Issue Date", format: "date" },
      { key: "lead_time", label: "Lead Time" },
      { key: "number", label: "Number" },
      { key: "overdue", label: "Overdue" },
      { key: "owners_manual", label: "Owner's manual" },
      { key: "package", label: "Package" },
      { key: "package_notes", label: "Package Notes" },
      { key: "paused", label: "Paused" },
      { key: "planned_internal_review_completed_date", label: "Planned Internal Review Completed Date", format: "date" },
      { key: "planned_return_date", label: "Planned Return Date", format: "date" },
      { key: "planned_submit_by_date", label: "Planned Submit By Date", format: "date" },
      { key: "private", label: "Private" },
      { key: "received_date", label: "Received Date", format: "date" },
      { key: "received_from", label: "Received From" },
      { key: "required_on_site_date", label: "Required On-Site Date", format: "date" },
      { key: "responsible_contractor", label: "Responsible Contractor" },
      { key: "revision", label: "Revision" },
      { key: "spec_area", label: "Spec Area" },
      { key: "status", label: "Status" },
      { key: "status_category", label: "Status Category" },
      { key: "sub_job", label: "Sub Job" },
      { key: "submit_by_date", label: "Submit By Date", format: "date" },
      { key: "submittal_manager", label: "Submittal Manager" },
      { key: "title", label: "Title" },
      { key: "type", label: "Type" },
    ],
  },
  {
    label: "Submittal Approver",
    source: "submittal-approvers",
    fields: [
      { key: "attachment_count", label: "Attachment Count", format: "number" },
      { key: "comments", label: "Comments" },
      { key: "company_vendor_name", label: "Company (Vendor) Name" },
      { key: "count", label: "Count", format: "number" },
      { key: "days_to_respond", label: "Days to Respond", format: "number" },
      { key: "due_date", label: "Due Date", format: "date" },
      { key: "id", label: "ID" },
      { key: "is_final", label: "Is Final" },
      { key: "name", label: "Name" },
      { key: "overdue", label: "Overdue" },
      { key: "predicted_outlier", label: "Predicted Outlier" },
      { key: "predicted_outlier_reason", label: "Predicted Outlier Reason" },
      { key: "previous_due_date", label: "Previous Due Date", format: "date" },
      { key: "previous_returned_date", label: "Previous Returned Date", format: "date" },
      { key: "previous_sent_date", label: "Previous Sent Date", format: "date" },
      { key: "remaining_calendar_days", label: "Remaining Calendar Days", format: "number" },
      { key: "remaining_working_days", label: "Remaining Working Days", format: "number" },
      { key: "response", label: "Response" },
      { key: "response_required", label: "Response Required" },
      { key: "returned_date", label: "Returned Date", format: "date" },
      { key: "role", label: "Role" },
      { key: "sent_date", label: "Sent Date", format: "date" },
      { key: "step", label: "Step", format: "number" },
      { key: "variance_at_end", label: "Variance At End" },
    ],
  },
  {
    label: "Submittal Ball In Court",
    source: "submittal-ball-in-court",
    fields: [
      { key: "company_vendor_name", label: "Company (Vendor) Name" },
      { key: "count", label: "Count", format: "number" },
      { key: "due_date", label: "Due Date", format: "date" },
      { key: "duration", label: "Duration" },
      { key: "id", label: "ID" },
      { key: "name", label: "Name" },
      { key: "overdue", label: "Overdue" },
      { key: "remaining_calendar_days", label: "Remaining Calendar Days", format: "number" },
      { key: "remaining_working_days", label: "Remaining Working Days", format: "number" },
      { key: "response_required", label: "Response Required" },
      { key: "role", label: "Role" },
      { key: "sent_date", label: "Sent Date", format: "date" },
    ],
  },
  {
    label: "Submittal Distribution List",
    source: "submittal-distribution-list",
    fields: [
      { key: "count", label: "Count", format: "number" },
      { key: "id", label: "ID" },
      { key: "name", label: "Name" },
    ],
  },
  {
    label: "Task",
    source: "tasks",
    fields: [
      { key: "assignees", label: "Assignees" },
      { key: "attachment_count", label: "Attachment Count", format: "number" },
      { key: "category", label: "Category" },
      { key: "count", label: "Count", format: "number" },
      { key: "created_by", label: "Created By" },
      { key: "date_closed", label: "Date Closed", format: "date" },
      { key: "date_created", label: "Date Created", format: "date" },
      { key: "date_in_progress", label: "Date In Progress", format: "date" },
      { key: "date_initiated", label: "Date Initiated", format: "date" },
      { key: "date_notified", label: "Date Notified", format: "date" },
      { key: "date_ready_for_review", label: "Date Ready For Review", format: "date" },
      { key: "date_updated", label: "Date Updated", format: "date" },
      { key: "date_voided", label: "Date Voided", format: "date" },
      { key: "description", label: "Description" },
      { key: "due_date", label: "Due Date", format: "date" },
      { key: "id", label: "ID" },
      { key: "is_origin", label: "Is Origin" },
      { key: "number", label: "Number" },
      { key: "private", label: "Private" },
      { key: "status", label: "Status" },
      { key: "title", label: "Title" },
    ],
  },
  {
    label: "Task Activity",
    source: "task-activity",
    fields: [
      { key: "attachment_count", label: "Attachment Count", format: "number" },
      { key: "comment", label: "Comment" },
      { key: "count", label: "Count", format: "number" },
      { key: "created_by", label: "Created By" },
      { key: "date_created", label: "Date Created", format: "date" },
      { key: "date_updated", label: "Date Updated", format: "date" },
      { key: "id", label: "ID" },
      { key: "status", label: "Status" },
    ],
  },
  {
    label: "Task Assignee",
    source: "task-assignees",
    fields: [
      { key: "assignee_company_name", label: "Assignee Company Name" },
      { key: "count", label: "Count", format: "number" },
      { key: "date_notified", label: "Date Notified", format: "date" },
      { key: "id", label: "ID" },
      { key: "name", label: "Name" },
    ],
  },
  {
    label: "Task Distribution Member",
    source: "task-distribution-members",
    fields: [
      { key: "count", label: "Count", format: "number" },
      { key: "id", label: "ID" },
      { key: "name", label: "Name" },
    ],
  },
  {
    label: "Timecard Entry",
    source: "timecard-entries",
    fields: [
      { key: "abbreviated_time_type", label: "Abbreviated Time Type" },
      { key: "approval_date", label: "Approval Date", format: "date" },
      { key: "approved_by", label: "Approved By" },
      { key: "billable", label: "Billable" },
      { key: "class_code", label: "Class Code" },
      { key: "classification", label: "Classification" },
      { key: "clock_in_gps_onsite", label: "Clock In GPS Onsite" },
      { key: "clock_in_time", label: "Clock In Time" },
      { key: "clock_out_gps_onsite", label: "Clock Out GPS Onsite" },
      { key: "clock_out_time", label: "Clock Out Time" },
      { key: "completed_by", label: "Completed By" },
      { key: "count", label: "Count", format: "number" },
      { key: "created_by", label: "Created By" },
      { key: "date", label: "Date", format: "date" },
      { key: "date_created", label: "Date Created", format: "date" },
      { key: "date_updated", label: "Date Updated", format: "date" },
      { key: "description", label: "Description" },
      { key: "employee_name", label: "Employee Name" },
      { key: "hours", label: "Hours", format: "number" },
      { key: "id", label: "ID" },
      { key: "location", label: "Location" },
      { key: "lunch_clock_in_gps_onsite", label: "Lunch Clock In GPS Onsite" },
      { key: "lunch_clock_out_gps_onsite", label: "Lunch Clock Out GPS Onsite" },
      { key: "lunch_start_time", label: "Lunch Start Time" },
      { key: "lunch_stop_time", label: "Lunch Stop Time" },
      { key: "lunch_time_hours", label: "Lunch Time (Hours)", format: "number" },
      { key: "lunch_time_minutes", label: "Lunch Time (Minutes)", format: "number" },
      { key: "reviewed_by", label: "Reviewed By" },
      { key: "signature_text", label: "Signature Text" },
      { key: "signed", label: "Signed" },
      { key: "signee", label: "Signee" },
      { key: "start_time", label: "Start Time" },
      { key: "status", label: "Status" },
      { key: "stop_time", label: "Stop Time" },
      { key: "time_type", label: "Time Type" },
    ],
  },
];


const DIRECTORY_AND_PORTFOLIO_CATEGORIES: CategoryDef[] = [
  {
    label: "Company (Vendor)",
    source: "companies",
    fields: [
      { key: "business_8a", label: "8a Business Enterprise" },
      { key: "abbreviated_name", label: "Abbreviated Name" },
      { key: "accepted_terms_and_conditions", label: "Accepted Terms And Conditions" },
      { key: "address", label: "Address" },
      { key: "affirmative_action", label: "Affirmative Action" },
      { key: "african_american_business", label: "African American Business" },
      { key: "asian_american_business", label: "Asian American Business" },
      { key: "authorized_bidder", label: "Authorized Bidder" },
      { key: "business_fax", label: "Business Fax" },
      { key: "business_phone", label: "Business Phone" },
      { key: "certified_business_enterprise", label: "Certified Business Enterprise" },
      { key: "city", label: "City" },
      { key: "company_rating_avg", label: "Company Rating (Avg)", format: "number" },
      { key: "cost_codes", label: "Cost Codes" },
      { key: "count", label: "Count", format: "number" },
      { key: "country", label: "Country" },
      { key: "country_code", label: "Country Code" },
      { key: "date_created", label: "Date Created", format: "date" },
      { key: "date_updated", label: "Date Updated", format: "date" },
      { key: "disadvantaged_business", label: "Disadvantaged Business" },
      { key: "email_address", label: "Email Address" },
      { key: "entity_identifier", label: "Entity Identifier" },
      { key: "entity_type", label: "Entity Type" },
      { key: "erp_latest_status", label: "ERP Latest Status" },
      { key: "erp_updated_at", label: "ERP Updated At", format: "date" },
      { key: "hispanic_business", label: "Hispanic Business" },
      { key: "historically_underutilized_business", label: "Historically Underutlized Business" },
      { key: "id", label: "ID" },
      { key: "invoice_contact_email_address", label: "Invoice Contact Email Address" },
      { key: "invoice_contact_full_name", label: "Invoice Contact Full Name" },
      { key: "is_active", label: "Is Active" },
      { key: "labor_union", label: "Labor Union" },
      { key: "license_number", label: "License Number" },
      { key: "minority_business_enterprise", label: "Minority Business Enterpirse" },
      { key: "name", label: "Name" },
      { key: "native_american_business", label: "Native American Business" },
      { key: "prequalified", label: "Prequalified" },
      { key: "prevailing_wage", label: "Prevailing Wage" },
      { key: "primary_contact_email_address", label: "Primary Contact Email Address" },
      { key: "primary_contact_fax_number", label: "Primary Contact Fax Number" },
      { key: "primary_contact_first_name", label: "Primary Contact First Name" },
      { key: "primary_contact_job_title", label: "Primary Contact Job Title" },
      { key: "primary_contact_last_name", label: "Primary Contact Last Name" },
      { key: "primary_contact_mobile_phone", label: "Primary Contact Mobile Phone" },
      { key: "primary_contact_name", label: "Primary Contact Name" },
      { key: "primary_contact_vendor_name", label: "Primary Contact Vendor Name" },
      { key: "service_disabled_veteran_owned_small_business", label: "Service Disabled Veteran Owned Small Business" },
      { key: "small_business", label: "Small Business" },
      { key: "state", label: "State" },
      { key: "tags_keywords", label: "Tags/Keywords" },
      { key: "trades", label: "Trades" },
      { key: "union_member", label: "Union Member" },
      { key: "website", label: "Website" },
      { key: "womens_business", label: "Womens Business" },
      { key: "zip", label: "Zip" },
    ],
  },
  { label: "Project", source: "project", fields: PROJECT_FIELDS },
  {
    label: "Project Distribution Group",
    source: "project-distribution-groups",
    fields: [
      { key: "count", label: "Count", format: "number" },
      { key: "description", label: "Description" },
      { key: "id", label: "ID" },
      { key: "name", label: "Name" },
    ],
  },
  { label: "Project Roles", source: "project-roles", fields: PROJECT_ROLES_FIELDS },
];

const RESOURCE_MANAGEMENT_CATEGORIES: CategoryDef[] = [
  {
    label: "Actual Production Quantity",
    source: "actual-production-quantities",
    fields: [
      f("Count"),
      f("Created By"),
      f("Date", "date"),
      f("Date Created", "date"),
      f("Date Updated", "date"),
      f("ID"),
      f("Note"),
      f("Unit Of Measure"),
      f("Units Installed"),
    ],
  },
  {
    label: "Budget Change Production Quantity",
    source: "budget-change-production-quantities",
    fields: [
      f("Comment"),
      f("Count"),
      f("Date Created", "date"),
      f("Date Updated", "date"),
      f("Description"),
      f("ID"),
      f("Quantity"),
      f("Unit Of Measure"),
    ],
  },
  {
    label: "Budget Code",
    source: "budget-codes",
    fields: [
      f("Attribute 1 Line Items"),
      f("Attribute 1 Name"),
      f("Attribute 2 Line Items"),
      f("Attribute 2 Name"),
      f("Attribute 3 Line Items"),
      f("Attribute 3 Name"),
      f("Budget Code"),
      f("Budget Code Description"),
      f("Budget Code Status"),
      f("Cost Code"),
      f("Cost Code Description"),
      f("Cost Code Tier 1"),
      f("Cost Code Tier 1 Description"),
      f("Cost Code Tier 2"),
      f("Cost Code Tier 2 Description"),
      f("Cost Type"),
      f("Cost Type Description"),
      f("Count"),
      f("ID"),
    ],
  },
  {
    label: "Budget Line Item",
    source: "budget-line-items",
    fields: [
      f("Budget Calculation Strategy"),
      f("Count"),
      f("Currency Code"),
      f("Date Created", "date"),
      f("Date Updated", "date"),
      f("ID"),
      f("Notes"),
      f("Original Budget Amount", "currency"),
      f("Original Budgeted Hours"),
      f("Unit Cost", "currency"),
      f("Unit Of Measure"),
      f("Unit Quantity"),
    ],
  },
  {
    label: "Budgeted Production Quantity",
    source: "budgeted-production-quantities",
    fields: [
      f("Count"),
      f("Created By"),
      f("Date Created", "date"),
      f("Date Updated", "date"),
      f("ID"),
      f("Quantity"),
      f("Unit Of Measure"),
    ],
  },
  {
    label: "Change Event",
    source: "change-events",
    fields: [
      f("Change Reason"),
      f("Count"),
      f("Created By"),
      f("Date Created", "date"),
      f("Date Updated", "date"),
      f("Description"),
      f("ID"),
      f("Number"),
      f("Origin Type"),
      f("Scope"),
      f("Status"),
      f("Title"),
      f("Type"),
    ],
  },
  {
    label: "Change Event Line Item",
    source: "change-event-line-items",
    fields: [
      f("Budget Days In Stage"),
      f("Budget ROM", "currency"),
      f("Budget Stage"),
      f("Budget Stage In Status Since", "date"),
      f("Budget Stage Status"),
      f("Contract"),
      f("Cost Days In Stage"),
      f("Cost ROM", "currency"),
      f("Cost ROM Quantity"),
      f("Cost ROM Unit Cost", "currency"),
      f("Cost Stage"),
      f("Cost Stage In Status Since", "date"),
      f("Cost Stage Status"),
      f("Count"),
      f("Date Created", "date"),
      f("Date Updated", "date"),
      f("Description"),
      f("ID"),
      f("Latest Cost", "currency"),
      f("Latest Cost Source"),
      f("Latest Price", "currency"),
      f("Latest Price Source"),
      f("Line Aging"),
      f("Line Item Type"),
      f("Non-Committed Cost", "currency"),
      f("Proposed Vendor Name"),
      f("Revenue Days In Stage"),
      f("Revenue ROM", "currency"),
      f("Revenue ROM Quantity"),
      f("Revenue ROM Unit Cost", "currency"),
      f("Revenue Stage"),
      f("Revenue Stage In Status Since", "date"),
      f("Revenue Stage Status"),
      f("Unit Of Measure"),
      f("Vendor Name"),
    ],
  },
  {
    label: "Change Event Production Quantity",
    source: "change-event-production-quantities",
    fields: [
      f("Count"),
      f("Date Created", "date"),
      f("Date Updated", "date"),
      f("Description"),
      f("ID"),
      f("Quantity"),
      f("Unit Of Measure"),
    ],
  },
  {
    label: "Commitment",
    source: "commitments",
    fields: [
      f("Completed Section 3 Opportunities Plan & Program Certificate"),
      f("Actual Completion Date", "date"),
      f("Approval Letter Date", "date"),
      f("Approved Change Orders", "currency"),
      f("Approved Date", "date"),
      f("Assigned To"),
      f("Bill To"),
      f("Bond Amount", "currency"),
      f("CBE Certification #"),
      f("Certificate of Insurance with language from Exhibit F"),
      f("Comments Count"),
      f("Completed First Source Agreement, per Exhibit P"),
      f("Completed Form 1413, provided as attachment Exhibit M"),
      f("Completed Subcontractor Affidavit, included as Exhibit H"),
      f("Completed W-9 Form"),
      f("Contact information for person responsible for completing certified payroll and/or affirmative action documents"),
      f("Contract Date", "date"),
      f("Copy of State Business License"),
      f("Count"),
      f("Created By"),
      f("Currency Code"),
      f("Date Created", "date"),
      f("Date Updated", "date"),
      f("Default Accounting Method"),
      f("Default Retainage"),
      f("Delivery Date", "date"),
      f("Description"),
      f("Draft Change Orders", "currency"),
      f("Enable Comments"),
      f("Enable Completed Work Retainage"),
      f("Enable Financial Markups"),
      f("Enable Invoices"),
      f("Enable Payments"),
      f("Enable Sliding Scale Retention"),
      f("Enable Stored Material Retainage"),
      f("Enable Subcontractor SOV"),
      f("ERP Latest Status"),
      f("ERP Updated At", "date"),
      f("ERP User Name"),
      f("Estimated Completion Date", "date"),
      f("Exclusions"),
      f("Executed"),
      f("Execution Date", "date"),
      f("Exhibit “M” Wage Scale Requirements"),
      f("Exhibit “N-1” Section 3 Requirements"),
      f("Exhibit “N-2” District of Columbia Section 3 Requirements"),
      f("Exhibit “O-1” MBE Requirements"),
      f("Exhibit “O-2” CBE/SBE Requirements"),
      f("Exhibit “P-1” First Source Requirements (Hours Worked)"),
      f("Exhibit “P-2” First Source Requirements (Hiring)"),
      f("Exhibit A Scope of Work"),
      f("Global Insurance Compliance"),
      f("ID"),
      f("Inclusions"),
      f("Invoice Contacts"),
      f("Invoiced", "currency"),
      f("Issued On Date", "date"),
      f("Letter Of Intent Date", "date"),
      f("Level Of Detail to Display Change Orders"),
      f("List of all current employees, for Section 3 tracking purposes"),
      f("MBE Certification #"),
      f("Number"),
      f("Original Contract Amount", "currency"),
      f("Payment Terms"),
      f("Payments Issued", "currency"),
      f("Pending Change Orders", "currency"),
      f("Pending Revised Contract Amount", "currency"),
      f("Percent Paid"),
      f("Private"),
      f("Project Insurance Compliance"),
      f("Remaining Balance", "currency"),
      f("Returned Date", "date"),
      f("Revised Contract Amount", "currency"),
      f("Ship To"),
      f("Ship Via"),
      f("Show Cost Code on PDF"),
      f("Show Cover Letter"),
      f("Show Executed Cover Letter"),
      f("Sign With DocuSign"),
      f("Signed Contract Received Date", "date"),
      f("Start Date", "date"),
      f("Status"),
      f("Subcontract Cover Letter-please choose one"),
      f("Subcontract Type (please choose one)"),
      f("Subcontractor Contact"),
      f("Subcontractor SOV Status"),
      f("Submittals to be submitted within 14 days of this subcontract"),
      f("Synced With Accounting"),
      f("Taxable Amount", "currency"),
      f("Title"),
      f("Total Estimated Tax", "currency"),
      f("Trades"),
      f("Type"),
      f("View SOV Items"),
    ],
  },
  {
    label: "Commitment Change Order",
    source: "commitment-change-orders",
    fields: [
      f("Amount", "currency"),
      f("Amount (Including Markup)", "currency"),
      f("Approved Date", "date"),
      f("Assigned to Current Workflow Step"),
      f("Change Reason"),
      f("Count"),
      f("Created By"),
      f("Currency Code"),
      f("Current Workflow Response"),
      f("Current Workflow Step"),
      f("Current Workflow Step Due Date", "date"),
      f("Date Created", "date"),
      f("Date Updated", "date"),
      f("Description"),
      f("Designated Reviewer"),
      f("Due Date", "date"),
      f("ERP Latest Status"),
      f("ERP Updated At", "date"),
      f("ERP User Name"),
      f("Executed"),
      f("ID"),
      f("Invoiced Date", "date"),
      f("Number"),
      f("Paid Date", "date"),
      f("Private"),
      f("Review Date", "date"),
      f("Review Notes"),
      f("Reviewer"),
      f("Revision"),
      f("Schedule Impact (Days)"),
      f("Sign With DocuSign"),
      f("Signed Change Order Received Date", "date"),
      f("Status"),
      f("Synced With Accounting"),
      f("Taxable Amount", "currency"),
      f("Title"),
      f("Total Estimated Tax", "currency"),
      f("Workflow Assignment Duration (Days)"),
    ],
  },
  {
    label: "Commitment Change Order Line Item",
    source: "commitment-change-order-line-items",
    fields: [
      f("Amount", "currency"),
      f("Amount (Including Markup)", "currency"),
      f("Approved Amount", "currency"),
      f("Approved Amount (Including Markup)", "currency"),
      f("Count"),
      f("Currency Code"),
      f("Date Created", "date"),
      f("Date Updated", "date"),
      f("Description"),
      f("Draft Amount", "currency"),
      f("Draft Amount (Including Markup)", "currency"),
      f("Estimated Tax", "currency"),
      f("ID"),
      f("No Charge Amount", "currency"),
      f("No Charge Amount (Including Markup)", "currency"),
      f("Number"),
      f("Pending All Amount", "currency"),
      f("Pending All Amount (Including Markup)", "currency"),
      f("Pending In Review Amount", "currency"),
      f("Pending In Review Amount (Including Markup)", "currency"),
      f("Pending Not Pricing Amount", "currency"),
      f("Pending Not Pricing Amount (Including Markup)", "currency"),
      f("Pending Not Proceeding Amount", "currency"),
      f("Pending Not Proceeding Amount (Including Markup)", "currency"),
      f("Pending Pricing Amount", "currency"),
      f("Pending Pricing Amount (Including Markup)", "currency"),
      f("Pending Proceeding Amount", "currency"),
      f("Pending Proceeding Amount (Including Markup)", "currency"),
      f("Pending Revised Amount", "currency"),
      f("Pending Revised Amount (Including Markup)", "currency"),
      f("Quantity"),
      f("Rejected Amount", "currency"),
      f("Rejected Amount (Including Markup)", "currency"),
      f("Tax Code"),
      f("Tax Codes"),
      f("Unit Cost", "currency"),
      f("Unit of Measure"),
      f("Void Amount", "currency"),
      f("Void Amount (Including Markup)", "currency"),
    ],
  },
  {
    label: "Commitment Change Order Markup",
    source: "commitment-change-order-markup",
    fields: [
      f("Count"),
      f("Date Created", "date"),
      f("Date Updated", "date"),
      f("ID"),
      f("Markup Name"),
      f("Markup Type"),
      f("Number"),
      f("Percentage"),
    ],
  },
  {
    label: "Commitment Line Item",
    source: "commitment-line-items",
    fields: [
      f("Amount", "currency"),
      f("Approved Amount", "currency"),
      f("Complete Amount", "currency"),
      f("Count"),
      f("Currency Code"),
      f("Date Created", "date"),
      f("Date Updated", "date"),
      f("Description"),
      f("Draft Amount", "currency"),
      f("Estimated Tax", "currency"),
      f("ID"),
      f("Number"),
      f("Out for Signature Amount", "currency"),
      f("Quantity"),
      f("Synced With Accounting"),
      f("Tax Code"),
      f("Tax Codes"),
      f("Unit Cost", "currency"),
      f("Unit Of Measure"),
    ],
  },
  {
    label: "Company (Vendor)",
    source: "companies",
    fields: [
      f("8a Business Enterprise"),
      f("Abbreviated Name"),
      f("Accepted Terms And Conditions"),
      f("Address"),
      f("Affirmative Action"),
      f("African American Business"),
      f("Asian American Business"),
      f("Authorized Bidder"),
      f("Business Fax"),
      f("Business Phone"),
      f("Certified Business Enterprise"),
      f("City"),
      f("Company Rating (Avg)"),
      f("Cost Codes"),
      f("Count"),
      f("Country"),
      f("Country Code"),
      f("Date Created", "date"),
      f("Date Updated", "date"),
      f("Disadvantaged Business"),
      f("Email Address"),
      f("Entity Identifier"),
      f("Entity Type"),
      f("ERP Latest Status"),
      f("ERP Updated At", "date"),
      f("Hispanic Business"),
      f("Historically Underutlized Business"),
      f("ID"),
      f("Invoice Contact Email Address"),
      f("Invoice Contact Full Name"),
      f("Is Active"),
      f("Labor Union"),
      f("License Number"),
      f("Minority Business Enterpirse"),
      f("Name"),
      f("Native American Business"),
      f("Prequalified"),
      f("Prevailing Wage"),
      f("Primary Contact Email Address"),
      f("Primary Contact Fax Number"),
      f("Primary Contact First Name"),
      f("Primary Contact Job Title"),
      f("Primary Contact Last Name"),
      f("Primary Contact Mobile Phone"),
      f("Primary Contact Name"),
      f("Primary Contact Vendor Name"),
      f("Service Disabled Veteran Owned Small Business"),
      f("Small Business"),
      f("State"),
      f("Tags/Keywords"),
      f("Trades"),
      f("Union Member"),
      f("Website"),
      f("Womens Business"),
      f("Zip"),
    ],
  },
  {
    label: "Employee",
    source: "employees",
    fields: [
      f("Company Employee ID"),
      f("Company Name"),
      f("Count"),
      f("Date Created", "date"),
      f("Date Updated", "date"),
      f("First Name"),
      f("Full Name"),
      f("ID"),
      f("Is Active"),
      f("Job Title"),
      f("Last Name"),
      f("Tags/Keywords"),
    ],
  },
  {
    label: "Labor Allocation",
    source: "labor-allocations",
    fields: [
      f("Count"),
      f("Created By"),
      f("Date", "date"),
      f("Date Created", "date"),
      f("Date Updated", "date"),
      f("Hours"),
      f("ID"),
    ],
  },
  {
    label: "Owner Invoice",
    source: "owner-invoices",
    fields: [
      f("Architect"),
      f("Assigned to Current Workflow Step"),
      f("Attachments Count"),
      f("Balance To Finish (Including Retainage)", "currency"),
      f("Billing Date", "date"),
      f("Billing Period End Date", "date"),
      f("Billing Period Start Date", "date"),
      f("Contract Sum To Date", "currency"),
      f("Count"),
      f("Currency Code"),
      f("Current Payment Due", "currency"),
      f("Current Workflow Response"),
      f("Current Workflow Step"),
      f("Current Workflow Step Due Date", "date"),
      f("Date Created", "date"),
      f("Date Updated", "date"),
      f("ERP Latest Status"),
      f("ERP Updated At", "date"),
      f("ERP User Name"),
      f("Gross Amount", "currency"),
      f("Gross Amount plus Tax", "currency"),
      f("ID"),
      f("Is Last"),
      f("Less Previous Certificates For Payment", "currency"),
      f("Materials Presently Stored", "currency"),
      f("Net Amount", "currency"),
      f("Net Amount plus Tax", "currency"),
      f("Net Changes By Change Order", "currency"),
      f("Number"),
      f("Paid Amount", "currency"),
      f("Percent Complete"),
      f("Period End", "date"),
      f("Period Start", "date"),
      f("Position"),
      f("Retainage Of Completed Work (%)"),
      f("Retainage of Completed Work ($)", "currency"),
      f("Retainage Of Stored Material (%)"),
      f("Retainage Of Stored Material ($)", "currency"),
      f("Status"),
      f("Synced With Accounting"),
      f("Tax applicable to this payment", "currency"),
      f("Tax Total", "currency"),
      f("Taxable Amount", "currency"),
      f("Total Changes Approved - Additions", "currency"),
      f("Total Changes Approved - Deductions", "currency"),
      f("Total Changes Approved In Previous Months By Owner/Client - Additions", "currency"),
      f("Total Changes Approved In Previous Months By Owner/Client - Deductions", "currency"),
      f("Total Changes Approved This Month - Additions", "currency"),
      f("Total Changes Approved This Month - Deductions", "currency"),
      f("Total Completed And Stored To Date", "currency"),
      f("Total Earned Less Retainage", "currency"),
      f("Total Retainage", "currency"),
      f("Workflow Assignment Duration (Days)"),
    ],
  },
  {
    label: "Owner Invoice Line Item",
    source: "owner-invoice-line-items",
    fields: [
      f("Balance To Finish", "currency"),
      f("Count"),
      f("Currency Code"),
      f("Date Created", "date"),
      f("Date Updated", "date"),
      f("Description Of Work"),
      f("Gross Amount", "currency"),
      f("Gross Amount plus Tax", "currency"),
      f("ID"),
      f("Item Number"),
      f("Line Item Type"),
      f("Materials Presently Stored", "currency"),
      f("Materials Presently Stored Quantity"),
      f("Materials Retainage This Period (%)"),
      f("Materials Retainage This Period ($)", "currency"),
      f("Materials Retainage To Date (%)"),
      f("Materials Retainage To Date ($)", "currency"),
      f("Materials Stored From Previous", "currency"),
      f("Net Amount", "currency"),
      f("Net Amount plus Tax", "currency"),
      f("New Materials", "currency"),
      f("New Materials Retainage", "currency"),
      f("New Materials Stored Quantity"),
      f("Previous Materials Retainage"),
      f("Previous Materials Retainage ($)", "currency"),
      f("Previous Materials Stored", "currency"),
      f("Previous Materials Stored Quantity"),
      f("Previous Total Retainage ($)", "currency"),
      f("Previous Work Retainage ($)", "currency"),
      f("Quantity"),
      f("Scheduled Value", "currency"),
      f("Scheduled Value Quantity"),
      f("Tax Amount", "currency"),
      f("Tax Codes"),
      f("Total Completed And Stored Materials To Date (%)"),
      f("Total Completed And Stored Materials To Date ($)", "currency"),
      f("Total Completed and Stored To Date Quantity"),
      f("Total Completed Stored", "currency"),
      f("Total Retainage To Date ($)", "currency"),
      f("Total Work Retainage ($)", "currency"),
      f("Unit Of Measure"),
      f("Unit Price", "currency"),
      f("Work Completed From Previous Application (%)"),
      f("Work Completed From Previous Application ($)", "currency"),
      f("Work Completed From Previous Application Quantity"),
      f("Work Completed Retainage Percent"),
      f("Work Completed This Period (%)"),
      f("Work Completed This Period ($)", "currency"),
      f("Work Completed This Period Quantity"),
      f("Work Retainage Released This Period ($)", "currency"),
      f("Work Retainage This Period", "currency"),
      f("Work Retainage This Period (%)"),
      f("Work Retainage This Period ($)", "currency"),
    ],
  },
  {
    label: "Prime Contract",
    source: "prime-contracts",
    fields: [
      f("Actual Completion Date", "date"),
      f("Allow These Users To See Sov Items"),
      f("Approval Letter Date", "date"),
      f("Approved Change Orders", "currency"),
      f("Approved Date", "date"),
      f("Architect/Engineer"),
      f("Assigned to Current Workflow Step"),
      f("Comments Count"),
      f("Contract Date", "date"),
      f("Contract Termination Date", "date"),
      f("Contractor"),
      f("Count"),
      f("Created By"),
      f("Currency Code"),
      f("Current Workflow Response"),
      f("Current Workflow Step"),
      f("Current Workflow Step Due Date", "date"),
      f("Date Created", "date"),
      f("Date Updated", "date"),
      f("Default Accounting Method"),
      f("Default Retainage"),
      f("Description"),
      f("Draft Change Orders", "currency"),
      f("Enable Comments"),
      f("Enable Completed Work Retainage"),
      f("Enable Financial Markups"),
      f("Enable Invoices"),
      f("Enable Payments"),
      f("Enable Stored Material Retainage"),
      f("ERP Latest Status"),
      f("ERP Updated At", "date"),
      f("ERP User Name"),
      f("Estimated Completion Date", "date"),
      f("Exclusions"),
      f("Executed"),
      f("Execution Date", "date"),
      f("ID"),
      f("Inclusions"),
      f("Invoiced", "currency"),
      f("Issued On Date", "date"),
      f("Letter Of Intent Date", "date"),
      f("Level Of Detail To Display Change Orders"),
      f("Number"),
      f("Original Contract Amount", "currency"),
      f("Owner/Client"),
      f("Payments Received", "currency"),
      f("Pending Change Orders", "currency"),
      f("Pending Revised Contract Amount", "currency"),
      f("Percentage Paid"),
      f("Private"),
      f("Remaining Balance", "currency"),
      f("Returned Date", "date"),
      f("Revised Contract Amount", "currency"),
      f("Show Cost Code on PDF"),
      f("Signature Required"),
      f("Signed Contract Received Date", "date"),
      f("Start Date", "date"),
      f("Status"),
      f("Substantial Completion Date", "date"),
      f("Synced With Accounting"),
      f("Taxable Amount", "currency"),
      f("Title"),
      f("Total Estimated Tax", "currency"),
      f("Workflow Assignment Duration (Days)"),
    ],
  },
  {
    label: "Prime Contract Change Order",
    source: "prime-contract-change-orders",
    fields: [
      f("Amount", "currency"),
      f("Amount (Including Markup)", "currency"),
      f("Approved Date", "date"),
      f("Assigned to Current Workflow Step"),
      f("Count"),
      f("Created By"),
      f("Currency Code"),
      f("Current Workflow Response"),
      f("Current Workflow Step"),
      f("Current Workflow Step Due Date", "date"),
      f("Date Created", "date"),
      f("Date Reviewed", "date"),
      f("Date Updated", "date"),
      f("Description"),
      f("Designated Reviewer"),
      f("Due Date", "date"),
      f("ERP Latest Status"),
      f("ERP Updated At", "date"),
      f("ERP User Name"),
      f("Executed"),
      f("ID"),
      f("Invoiced Date", "date"),
      f("New Date of Substantial Completion", "date"),
      f("Number"),
      f("Paid Date", "date"),
      f("Private"),
      f("Project Executive or Project Manager Signer"),
      f("Review Notes"),
      f("Reviewer"),
      f("Revised Substantial Completion Date", "date"),
      f("Revision"),
      f("Schedule Impact (Days)"),
      f("Signature Required"),
      f("Signed Change Order Received Date", "date"),
      f("Status"),
      f("Synced With Accounting"),
      f("Taxable Amount", "currency"),
      f("Title"),
      f("Total Estimated Tax", "currency"),
      f("Workflow Assignment Duration (Days)"),
    ],
  },
  {
    label: "Prime Contract Change Order Line Item",
    source: "prime-contract-change-order-line-items",
    fields: [
      f("Amount", "currency"),
      f("Approved Amount", "currency"),
      f("Approved Changes To Hours Budgeted"),
      f("Count"),
      f("Currency Code"),
      f("Date Created", "date"),
      f("Date Updated", "date"),
      f("Description"),
      f("Draft Amount", "currency"),
      f("Estimated Tax", "currency"),
      f("ID"),
      f("Line Type"),
      f("No Charge Amount", "currency"),
      f("Number"),
      f("Pending All Amount", "currency"),
      f("Pending In Review Amount", "currency"),
      f("Pending Not Pricing Amount", "currency"),
      f("Pending Not Proceeding Amount", "currency"),
      f("Pending Pricing Amount", "currency"),
      f("Pending Proceeding Amount", "currency"),
      f("Pending Revised Amount", "currency"),
      f("Quantity"),
      f("Rejected Amount", "currency"),
      f("Tax Code"),
      f("Tax Codes"),
      f("Unit Cost", "currency"),
      f("Unit Of Measure"),
      f("Void Amount", "currency"),
    ],
  },
  {
    label: "Prime Contract Change Order Markup",
    source: "prime-contract-change-order-markup",
    fields: [
      f("Count"),
      f("Date Created", "date"),
      f("Date Updated", "date"),
      f("ID"),
      f("Markup Type"),
      f("Name"),
      f("Percentage"),
      f("Sequence Number"),
    ],
  },
  {
    label: "Prime Contract Change Order Production Quantity",
    source: "prime-contract-change-order-production-quantities",
    fields: [
      f("Approved Changes to Budgeted Quantities"),
      f("Count"),
      f("Date Created", "date"),
      f("Date Updated", "date"),
      f("Description"),
      f("ID"),
      f("Quantity"),
      f("Unit Of Measure"),
    ],
  },
  {
    label: "Prime Contract Line Item",
    source: "prime-contract-line-items",
    fields: [
      f("Amount", "currency"),
      f("Count"),
      f("Currency Code"),
      f("Date Created", "date"),
      f("Date Updated", "date"),
      f("Description"),
      f("Estimated Tax", "currency"),
      f("ID"),
      f("Number"),
      f("Quantity"),
      f("Tax Code"),
      f("Tax Codes"),
      f("Unit Cost", "currency"),
      f("Unit Of Measure"),
    ],
  },
  {
    label: "Prime Contract Potential Change Order",
    source: "prime-contract-potential-change-orders",
    fields: [
      f("Amount", "currency"),
      f("Amount (Including Markup)", "currency"),
      f("Approved Date", "date"),
      f("Assigned to Current Workflow Step"),
      f("Change Reason"),
      f("Count"),
      f("Created By"),
      f("Currency Code"),
      f("Current Workflow Response"),
      f("Current Workflow Step"),
      f("Current Workflow Step Due Date", "date"),
      f("Date Created", "date"),
      f("Description"),
      f("Executed"),
      f("Field Change"),
      f("ID"),
      f("Number"),
      f("Paid Date", "date"),
      f("Paid In Full"),
      f("Private"),
      f("Reference"),
      f("Request Received From"),
      f("Revision"),
      f("Schedule Impact (Days)"),
      f("Signed Change Order Received Date", "date"),
      f("Status"),
      f("Taxable Amount", "currency"),
      f("Title"),
      f("Total Estimated Tax", "currency"),
      f("Workflow Assignment Duration (Days)"),
    ],
  },
  {
    label: "Project",
    source: "project",
    fields: [
      f("2nd Signer Information"),
      f("4th Signer Information"),
      f("Accounting Project Number"),
      f("Actual Completion Date", "date"),
      f("Actual Start Date", "date"),
      f("Address"),
      f("Architect/Engineer"),
      f("Assistant Estimator"),
      f("Assistant Project Manager"),
      f("Assistant Superintendent"),
      f("Bid Type"),
      f("Budget Lock Status"),
      f("Budget Number"),
      f("CDA"),
      f("City"),
      f("Code"),
      f("Completion Date", "date"),
      f("Count"),
      f("Country"),
      f("Country Code"),
      f("County"),
      f("Created By"),
      f("Currency Code"),
      f("Date Created", "date"),
      f("Default Tax Code"),
      f("Delivery Method"),
      f("Departments"),
      f("Description"),
      f("Designated Market Area"),
      f("ERP Latest Status"),
      f("ERP Updated At", "date"),
      f("ERP User Name"),
      f("Estimated Budget", "currency"),
      f("Executive"),
      f("Exhibit L - Hamel's Clarifications and Exclusions"),
      f("External Origin Data"),
      f("External Origin ID"),
      f("Fax"),
      f("Flag"),
      f("HABC"),
      f("HUD"),
      f("ID"),
      f("Is Active"),
      f("Is Test Project"),
      f("Language"),
      f("Latitude"),
      f("Lender"),
      f("Longitude"),
      f("Name"),
      f("Notes"),
      f("Number"),
      f("Office Name"),
      f("Owner"),
      f("Owner Contact"),
      f("Owner Type"),
      f("Parent Job Name"),
      f("Phone"),
      f("Please paste this project's drawing list here"),
      f("Priority"),
      f("Program"),
      f("Project Engineer"),
      f("Project Manager"),
      f("Project To Company Exchange Rate"),
      f("Projected Finish Date", "date"),
      f("Region"),
      f("Schedule Last Updated", "date"),
      f("Schedule Percent Complete"),
      f("Sector"),
      f("Senior Estimator"),
      f("Show 2nd Signature"),
      f("Show 4th Signature"),
      f("Square Footage"),
      f("Stage Name"),
      f("Stage Tier"),
      f("Start Date", "date"),
      f("State"),
      f("Store Number"),
      f("Superintendent"),
      f("Synced With Accounting"),
      f("The following entities are to be shown as additional insureds"),
      f("Timezone"),
      f("Total Value", "currency"),
      f("Type"),
      f("Wage Decision"),
      f("Wage Decision Date", "date"),
      f("Warranty End Date", "date"),
      f("Warranty Start Date", "date"),
      f("Work Scope"),
      f("Zip"),
    ],
  },
  {
    label: "Project Roles",
    source: "project-roles",
    fields: [
      f("Contact Name"),
      f("Contact Type"),
      f("Count"),
      f("Date Updated", "date"),
      f("Employee ID"),
      f("Group"),
      f("ID"),
      f("Role Name"),
    ],
  },
  {
    label: "Subcontractor Invoice",
    source: "subcontractor-invoices",
    fields: [
      f("Assigned to Current Workflow Step"),
      f("Attachments Count"),
      f("Balance To Finish", "currency"),
      f("Billing Date", "date"),
      f("Billing Period End", "date"),
      f("Billing Period Start", "date"),
      f("Billing Type"),
      f("Contract Sum To Date", "currency"),
      f("Count"),
      f("Created By"),
      f("Currency Code"),
      f("Current Payment Due", "currency"),
      f("Current Workflow Response"),
      f("Current Workflow Step"),
      f("Current Workflow Step Due Date", "date"),
      f("Date Created", "date"),
      f("Date Updated", "date"),
      f("Early Pay Fee Amount", "currency"),
      f("Early Pay Rate"),
      f("Early Pay Status"),
      f("ERP Latest Status"),
      f("ERP Updated At", "date"),
      f("ERP User Name"),
      f("Gross Amount", "currency"),
      f("Gross Amount plus Tax", "currency"),
      f("ID"),
      f("Invoice End Date", "date"),
      f("Invoice Start Date", "date"),
      f("Is Last"),
      f("Less Previous Certificates for Payment", "currency"),
      f("Missed Payment Due Date", "date"),
      f("Net Amount", "currency"),
      f("Net Amount plus Tax", "currency"),
      f("Net Changes By Change Order", "currency"),
      f("Number"),
      f("Original Payment Due", "currency"),
      f("Overall Comments"),
      f("Paid Amount", "currency"),
      f("Payment Date", "date"),
      f("Payment Due Date", "date"),
      f("Payment Status"),
      f("Payments Count"),
      f("Percent Complete"),
      f("Position"),
      f("Retainage Of Completed Work (%)"),
      f("Retainage Of Completed Work ($)", "currency"),
      f("Retainage Of Stored Material (%)"),
      f("Retainage Of Stored Material ($)", "currency"),
      f("Status"),
      f("Submitted Date", "date"),
      f("Synced With Accounting"),
      f("Tax Total", "currency"),
      f("Taxable Amount", "currency"),
      f("Total Changes Approved Additions", "currency"),
      f("Total Changes Approved Deductions", "currency"),
      f("Total Changes Approved In Previous Months By Owner/Client Additions", "currency"),
      f("Total Changes Approved In Previous Months By Owner/Client Deductions", "currency"),
      f("Total Changes Approved This Month Additions", "currency"),
      f("Total Changes Approved This Month Deductions", "currency"),
      f("Total Completed And Stored To Date", "currency"),
      f("Total Contract Amount", "currency"),
      f("Total Earned Less Retainage", "currency"),
      f("Total Payments Amount", "currency"),
      f("Total Proposed Amount", "currency"),
      f("Total Retainage", "currency"),
      f("Total Tax", "currency"),
      f("Workflow Assignment Duration (Days)"),
    ],
  },
  {
    label: "Subcontractor Invoice Line Item",
    source: "subcontractor-invoice-line-items",
    fields: [
      f("Balance To Finish", "currency"),
      f("Comment (Status Reason)"),
      f("Count"),
      f("Currency Code"),
      f("Date Created", "date"),
      f("Date Updated", "date"),
      f("Description of Work"),
      f("Gross Amount", "currency"),
      f("Gross Amount plus Tax", "currency"),
      f("ID"),
      f("Line Item Type"),
      f("Materials Presently Stored", "currency"),
      f("Materials Presently Stored Quantity"),
      f("Materials Previously Stored Quantity"),
      f("Materials Retainage From Previous Application", "currency"),
      f("Materials Retainage This Period ($)", "currency"),
      f("Net Amount", "currency"),
      f("Net Amount plus Tax", "currency"),
      f("New Materials Quantity"),
      f("New Materials Retainage", "currency"),
      f("New Materials Stored", "currency"),
      f("New Quantity"),
      f("Previous Materials Retainage", "currency"),
      f("Previous Materials Stored", "currency"),
      f("Previous Quantity"),
      f("Proposed Amount", "currency"),
      f("Retainage Work ($)", "currency"),
      f("Scheduled Value", "currency"),
      f("Scheduled Value Quantity"),
      f("Status"),
      f("Tax Amount", "currency"),
      f("Tax Codes"),
      f("Total Completed & Stored to Date (%)"),
      f("Total Completed & Stored to Date ($)", "currency"),
      f("Total Completed & Stored To Date ($) from Previous", "currency"),
      f("Total Completed & Stored to Date Quantity"),
      f("Total Materials Retainage", "currency"),
      f("Total Materials Retainage (%)"),
      f("Total Retainage", "currency"),
      f("Total Retainage From Previous Application", "currency"),
      f("Total Retainage Held This Period", "currency"),
      f("Total Retainage Released", "currency"),
      f("Unit Price", "currency"),
      f("Work Completed From Previous Application", "currency"),
      f("Work Completed From Previous Application (%)"),
      f("Work Completed This Period", "currency"),
      f("Work Completed this Period (%)"),
      f("Work Retainage From Previous Application", "currency"),
      f("Work Retainage This Period (%)"),
      f("Work Retainage This Period ($)", "currency"),
    ],
  },
  {
    label: "Timecard Entry",
    source: "timecard-entries",
    fields: [
      f("Abbreviated Time Type"),
      f("Approval Date", "date"),
      f("Approved By"),
      f("Billable"),
      f("Class Code"),
      f("Classification"),
      f("Clock In GPS Onsite"),
      f("Clock In Time", "date"),
      f("Clock Out GPS Onsite"),
      f("Clock Out Time", "date"),
      f("Completed By"),
      f("Count"),
      f("Created By"),
      f("Date", "date"),
      f("Date Created", "date"),
      f("Date Updated", "date"),
      f("Description"),
      f("Employee Name"),
      f("Hours"),
      f("ID"),
      f("Location"),
      f("Lunch Clock In GPS Onsite"),
      f("Lunch Clock Out GPS Onsite"),
      f("Lunch Start Time", "date"),
      f("Lunch Stop Time", "date"),
      f("Lunch Time (Hours)"),
      f("Lunch Time (Minutes)"),
      f("Reviewed By"),
      f("Signature Text"),
      f("Signed"),
      f("Signee"),
      f("Start Time", "date"),
      f("Status"),
      f("Stop Time", "date"),
      f("Time Type"),
    ],
  },
];

const CATEGORIES_BY_TAB: Record<string, CategoryDef[]> = {
  "Directory & Portfolio": DIRECTORY_AND_PORTFOLIO_CATEGORIES,
  Financials: FINANCIALS_CATEGORIES,
  "Project Execution": PROJECT_EXECUTION_CATEGORIES,
  "Resource Management": RESOURCE_MANAGEMENT_CATEGORIES,
};

type SelectedColumn = {
  id: string; // `${categoryLabel}::${fieldKey}`
  categoryLabel: string;
  source: string;
  fieldKey: string;
  fieldLabel: string;
  format?: FieldDef["format"];
};

type Row = Record<string, unknown>;

// ─── Component ───────────────────────────────────────────────────────────────

export default function Create360ReportClient({
  projectId,
  category,
  reportId,
}: {
  projectId: string;
  category: string;
  reportId?: string;
}) {
  const router = useRouter();
  const today = new Date();
  const defaultName = `Untitled Report - ${(today.getMonth() + 1).toString().padStart(2, "0")}/${today
    .getDate()
    .toString()
    .padStart(2, "0")}/${today.getFullYear()}`;

  const [reportName, setReportName] = useState(defaultName);
  const [description, setDescription] = useState("");
  const [activeTab, setActiveTab] = useState(category);
  const [tabs] = useState<string[]>([category]);
  const [existingReportMeta, setExistingReportMeta] = useState<{
    createdAt: string;
    createdBy: string;
    sharedWith: string[];
  } | null>(null);

  // Right-side panel selection
  type PanelKey = "columns" | "filters" | "calculations" | "visuals" | "info" | null;
  const [openPanel, setOpenPanel] = useState<PanelKey>("columns");

  // Selected columns (in display order)
  const [selectedColumns, setSelectedColumns] = useState<SelectedColumn[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [columnSearch, setColumnSearch] = useState("");
  const [loadDataManually, setLoadDataManually] = useState(true);

  // Data state per source
  const [rowsBySource, setRowsBySource] = useState<Record<string, Row[]>>({});
  const [loadingSources, setLoadingSources] = useState<Set<string>>(new Set());
  const [errorMessage, setErrorMessage] = useState("");

  // Filters (scoped per source/field)
  const [filters, setFilters] = useState<ReportFilter[]>([]);

  const categories = CATEGORIES_BY_TAB[activeTab] ?? FINANCIALS_CATEGORIES;

  const filteredCategories = useMemo(() => {
    const q = columnSearch.trim().toLowerCase();
    if (!q) return categories;
    return categories
      .map((cat) => ({
        ...cat,
        fields: cat.fields.filter(
          (f) => f.label.toLowerCase().includes(q) || cat.label.toLowerCase().includes(q)
        ),
      }))
      .filter((cat) => cat.fields.length > 0 || cat.label.toLowerCase().includes(q));
  }, [categories, columnSearch]);

  function toggleCategory(label: string) {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  function isColumnSelected(categoryLabel: string, fieldKey: string) {
    return selectedColumns.some((c) => c.categoryLabel === categoryLabel && c.fieldKey === fieldKey);
  }

  function toggleColumn(cat: CategoryDef, field: FieldDef) {
    const id = `${cat.label}::${field.key}`;
    setSelectedColumns((prev) => {
      const exists = prev.some((c) => c.id === id);
      if (exists) return prev.filter((c) => c.id !== id);
      return [
        ...prev,
        {
          id,
          categoryLabel: cat.label,
          source: cat.source,
          fieldKey: field.key,
          fieldLabel: field.label,
          format: field.format,
        },
      ];
    });
  }

  // Distinct primary sources currently in use
  const activeSources = useMemo(() => {
    const set = new Set<string>();
    selectedColumns.forEach((c) => set.add(c.source));
    return Array.from(set);
  }, [selectedColumns]);

  // Categories available to filter on = the categories the report pulls columns
  // from. Each exposes all of its fields as sub-categories.
  const filterCategories = useMemo<FilterCategory[]>(() => {
    return activeSources
      .map((source) => {
        const cat = categories.find((c) => c.source === source);
        if (!cat) return null;
        return {
          label: cat.label,
          source: cat.source,
          fields: cat.fields.map((f) => ({ key: f.key, label: f.label })),
        };
      })
      .filter((c): c is FilterCategory => c !== null);
  }, [activeSources, categories]);

  function suggestionsFor(filter: ReportFilter): string[] {
    const rows = rowsBySource[filter.source] ?? [];
    return distinctColumnValues(
      rows.map((r) => {
        const v = r[filter.columnKey];
        return v === null || v === undefined ? "" : String(v);
      }),
    );
  }

  // Drop filters whose source is no longer part of the report.
  useEffect(() => {
    setFilters((prev) => {
      const next = prev.filter((f) => activeSources.includes(f.source));
      return next.length === prev.length ? prev : next;
    });
  }, [activeSources]);

  async function fetchSource(source: string) {
    setLoadingSources((prev) => new Set(prev).add(source));
    try {
      const data = await loadSource(projectId, source);
      setRowsBySource((prev) => ({ ...prev, [source]: data }));
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoadingSources((prev) => {
        const next = new Set(prev);
        next.delete(source);
        return next;
      });
    }
  }

  async function loadAllData() {
    setErrorMessage("");
    await Promise.all(activeSources.map((s) => fetchSource(s)));
  }

  // Hydrate from an existing saved report when editing.
  useEffect(() => {
    if (!reportId) return;
    const existing = loadSavedReports(projectId).find((r) => r.id === reportId);
    if (!existing) return;
    setReportName(existing.name);
    setDescription(existing.description ?? "");
    if (existing.category) setActiveTab(existing.category);
    if (existing.selectedColumns) {
      setSelectedColumns(
        existing.selectedColumns.map((c) => ({
          id: c.id,
          categoryLabel: c.categoryLabel,
          source: c.source,
          fieldKey: c.fieldKey,
          fieldLabel: c.fieldLabel,
          format: c.format,
        })),
      );
      setExpandedCategories(new Set(existing.selectedColumns.map((c) => c.categoryLabel)));
    }
    if (Array.isArray(existing.filters)) {
      setFilters(existing.filters as unknown as ReportFilter[]);
    }
    setExistingReportMeta({
      createdAt: existing.createdAt,
      createdBy: existing.createdBy,
      sharedWith: existing.sharedWith ?? [],
    });
  }, [projectId, reportId]);

  // Auto-load when toggle is off
  useEffect(() => {
    if (loadDataManually) return;
    if (activeSources.length === 0) return;
    // Fetch any source we haven't already loaded
    activeSources.forEach((source) => {
      if (!rowsBySource[source] && !loadingSources.has(source)) {
        void fetchSource(source);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadDataManually, activeSources]);

  // Build rows for display. When multiple sources are active, render each
  // source as its own block. With a single source, show a single table.
  const groupedDisplay = useMemo(() => {
    return activeSources.map((source) => {
      const cols = selectedColumns.filter((c) => c.source === source);
      const allRows = rowsBySource[source] ?? [];
      const rows = applyFiltersForSource(allRows, filters, source);
      return { source, cols, rows, totalRows: allRows.length };
    });
  }, [activeSources, selectedColumns, rowsBySource, filters]);

  const canSave = reportName.trim().length > 0 && selectedColumns.length > 0;
  const isLoadingAny = loadingSources.size > 0;

  return (
    <div>
      <ProjectNav projectId={projectId} />
      <div className="px-6 py-4 max-w-full">
        <div className="text-xs text-gray-500 mb-2">
          <Link href={`/projects/${projectId}/reporting`} className="text-blue-600 hover:underline">
            Reports
          </Link>
          <span className="mx-1">/</span>
          <span className="text-gray-700">{reportName}</span>
        </div>

        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex-1 min-w-0">
            <input
              value={reportName}
              onChange={(e) => setReportName(e.target.value)}
              className="text-2xl font-semibold text-gray-900 w-full bg-transparent border-0 focus:outline-none focus:bg-gray-50 px-1 -mx-1 rounded"
              placeholder="Untitled Report"
            />
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter Description"
              className="mt-1 text-sm text-gray-500 w-full bg-transparent border-0 focus:outline-none focus:bg-gray-50 px-1 -mx-1 rounded"
            />
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => router.push(`/projects/${projectId}/reporting`)}
              className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-md"
            >
              Cancel
            </button>
            <button
              disabled={!canSave}
              onClick={() => {
                const now = new Date().toISOString();
                const totalRecords = Object.values(rowsBySource).reduce((sum, r) => sum + r.length, 0);
                const stored: StoredReport = {
                  id: reportId ?? crypto.randomUUID(),
                  name: reportName.trim() || defaultName,
                  reportType: "360 Report",
                  description: description.trim() || `${activeTab} 360 Report`,
                  createdBy: existingReportMeta?.createdBy ?? "Me",
                  createdAt: existingReportMeta?.createdAt ?? now,
                  updatedAt: now,
                  sharedWith: existingReportMeta?.sharedWith ?? [],
                  category: activeTab,
                  selectedColumns: selectedColumns.map((c) => ({
                    id: c.id,
                    categoryLabel: c.categoryLabel,
                    source: c.source,
                    fieldKey: c.fieldKey,
                    fieldLabel: c.fieldLabel,
                    format: c.format,
                  })),
                  filters: filters as unknown as Record<string, unknown>[],
                  lastRunRecordCount: totalRecords,
                };
                saveReport(projectId, stored);
                router.push(`/projects/${projectId}/reporting`);
              }}
              className="px-5 py-2 text-sm font-medium bg-orange-500 text-white rounded-md hover:bg-orange-600 disabled:bg-orange-200 disabled:cursor-not-allowed"
            >
              Save
            </button>
          </div>
        </div>

        {/* Tabs row */}
        <div className="flex items-center gap-1 border-b border-gray-200 mb-0">
          <button
            type="button"
            className="px-2 py-2 text-gray-400 hover:text-gray-700"
            title="Add tab"
          >
            +
          </button>
          <button type="button" className="px-2 py-2 text-gray-400 hover:text-gray-700" title="Tab list">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${
                activeTab === t ? "border-gray-900 text-gray-900" : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {t}
              <span className="ml-1 text-gray-400">⋮</span>
            </button>
          ))}
        </div>

        {/* Main body: bordered area with right-side icon rail and slide-out panel */}
        <div className="flex gap-0 mt-3">
          <div className="flex-1 bg-white border border-gray-200 rounded-l-md min-h-[600px] flex flex-col">
            {/* Filters bar */}
            <div className="px-4 py-2 border-b border-gray-100 bg-gray-50 flex items-center gap-2 text-sm text-gray-600 flex-wrap">
              <button
                type="button"
                onClick={() => setOpenPanel("filters")}
                className="flex items-center gap-2 hover:text-gray-900"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                <span>Filters</span>
              </button>
              {filters.length === 0 ? (
                <span className="text-gray-400 text-xs">None</span>
              ) : (
                filters.map((f) => (
                  <span
                    key={f.id}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-xs"
                  >
                    <span className="font-medium">{f.fieldLabel}</span>
                    {f.values.length > 0 && (
                      <span className="text-blue-500">
                        {FILTER_MODE_LABELS[f.mode]} {f.values.map((v) => (v === "" ? "(None)" : v)).join(", ")}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => setFilters((prev) => prev.filter((x) => x.id !== f.id))}
                      className="hover:text-blue-900"
                      aria-label={`Remove ${f.fieldLabel} filter`}
                    >
                      ×
                    </button>
                  </span>
                ))
              )}
            </div>

            {/* Body */}
            <div className="flex-1 overflow-auto">
              {errorMessage && (
                <div className="m-4 px-4 py-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded">
                  {errorMessage}
                </div>
              )}

              {selectedColumns.length === 0 ? (
                <EmptyState />
              ) : (
                <div className="p-4 space-y-6">
                  {groupedDisplay.map(({ source, cols, rows, totalRows }) => {
                    const sourceLabel = categories.find((c) => c.source === source)?.label ?? source;
                    const isLoading = loadingSources.has(source);
                    const loaded = rowsBySource[source] !== undefined;
                    const isFiltered = rows.length !== totalRows;
                    return (
                      <div key={source} className="border border-gray-200 rounded-md overflow-hidden">
                        <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-700 flex items-center justify-between">
                          <span>{sourceLabel}</span>
                          <span className="text-gray-400 font-normal">
                            {isLoading
                              ? "Loading…"
                              : loaded
                                ? isFiltered
                                  ? `${rows.length} of ${totalRows} record${totalRows === 1 ? "" : "s"}`
                                  : `${rows.length} record${rows.length === 1 ? "" : "s"}`
                                : "Not loaded"}
                          </span>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead className="bg-gray-50">
                              <tr>
                                {cols.map((col) => (
                                  <th key={col.id} className="px-3 py-2 text-left font-medium text-gray-600 border-b border-gray-200 whitespace-nowrap">
                                    {col.fieldLabel}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {!loaded ? (
                                <tr>
                                  <td colSpan={cols.length} className="px-3 py-6 text-center text-gray-400">
                                    {loadDataManually ? "Click Load Data to fetch records." : "Loading…"}
                                  </td>
                                </tr>
                              ) : rows.length === 0 ? (
                                <tr>
                                  <td colSpan={cols.length} className="px-3 py-6 text-center text-gray-400">
                                    No data
                                  </td>
                                </tr>
                              ) : (
                                rows.map((row, idx) => (
                                  <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                                    {cols.map((col) => (
                                      <td key={col.id} className="px-3 py-2 text-gray-700 whitespace-nowrap">
                                        {formatCell(row[col.fieldKey], col.format)}
                                      </td>
                                    ))}
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right side: icon rail + slide-out panel */}
          {openPanel === "columns" && (
            <ConfigureColumnsPanel
              categories={filteredCategories}
              expanded={expandedCategories}
              onToggleCategory={toggleCategory}
              search={columnSearch}
              onSearch={setColumnSearch}
              isSelected={isColumnSelected}
              onToggleColumn={toggleColumn}
              loadDataManually={loadDataManually}
              onLoadDataManuallyChange={setLoadDataManually}
              onLoadData={loadAllData}
              canLoad={activeSources.length > 0 && !isLoadingAny}
            />
          )}
          {openPanel === "filters" && (
            <div className="w-72 bg-white border-t border-b border-gray-200 flex flex-col">
              <div className="px-4 py-3 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-900">Filters</h3>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  Filter the report by any field on the categories you&rsquo;ve added columns from.
                </p>
              </div>
              <div className="p-4 overflow-y-auto">
                <FiltersPanel
                  categories={filterCategories}
                  filters={filters}
                  suggestionsFor={suggestionsFor}
                  onChange={setFilters}
                  emptyHint="Add columns to the report first, then filter on them here."
                />
              </div>
            </div>
          )}
          {openPanel === "calculations" && (
            <SimplePanel title="Calculated Columns" body="Build calculations from existing columns." />
          )}
          {openPanel === "visuals" && <SimplePanel title="Visuals" body="Choose a visual type for this report." />}
          {openPanel === "info" && <SimplePanel title="Report Info" body="Metadata and details about this report." />}

          <IconRail openPanel={openPanel} onSelect={(k) => setOpenPanel((cur) => (cur === k ? null : k))} />
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="h-[500px] flex flex-col items-center justify-center text-center px-6">
      <div className="relative w-32 h-32 mb-4">
        <div className="absolute inset-0 bg-blue-100 rounded-lg transform translate-x-2 translate-y-2" />
        <div className="absolute inset-0 bg-white border border-gray-300 rounded-lg flex items-center justify-center">
          <svg className="w-12 h-12 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </div>
      </div>
      <h3 className="text-base font-semibold text-gray-900 mb-1">Configure Report</h3>
      <p className="text-xs text-gray-500 max-w-xs">
        Choose the data you want to display in your report and click the &quot;Load Data&quot; button to review your selection.
      </p>
    </div>
  );
}

function IconRail({
  openPanel,
  onSelect,
}: {
  openPanel: string | null;
  onSelect: (k: "columns" | "filters" | "calculations" | "visuals" | "info") => void;
}) {
  const items: { key: "columns" | "filters" | "calculations" | "visuals" | "info"; icon: React.ReactNode; title: string }[] = [
    {
      key: "columns",
      title: "Columns",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4h4v16H4zM10 4h4v16h-4zM16 4h4v16h-4z" />
        </svg>
      ),
    },
    {
      key: "filters",
      title: "Filters",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h18M6 12h12M10 19h4" />
        </svg>
      ),
    },
    {
      key: "calculations",
      title: "Calculated Columns",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <rect x="5" y="3" width="14" height="18" rx="2" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6M9 11h2M13 11h2M9 15h2M13 15h2M9 19h2M13 19h2" />
        </svg>
      ),
    },
    {
      key: "visuals",
      title: "Visuals",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
        </svg>
      ),
    },
    {
      key: "info",
      title: "Info",
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="bg-white border border-gray-200 rounded-r-md flex flex-col py-2">
      {items.map((it) => (
        <button
          key={it.key}
          type="button"
          onClick={() => onSelect(it.key)}
          title={it.title}
          className={`px-3 py-3 ${openPanel === it.key ? "bg-blue-50 text-blue-700 border-l-2 border-blue-600" : "text-gray-700 hover:bg-gray-50"}`}
        >
          {it.icon}
        </button>
      ))}
    </div>
  );
}

function ConfigureColumnsPanel({
  categories,
  expanded,
  onToggleCategory,
  search,
  onSearch,
  isSelected,
  onToggleColumn,
  loadDataManually,
  onLoadDataManuallyChange,
  onLoadData,
  canLoad,
}: {
  categories: CategoryDef[];
  expanded: Set<string>;
  onToggleCategory: (label: string) => void;
  search: string;
  onSearch: (v: string) => void;
  isSelected: (cat: string, key: string) => boolean;
  onToggleColumn: (cat: CategoryDef, field: FieldDef) => void;
  loadDataManually: boolean;
  onLoadDataManuallyChange: (v: boolean) => void;
  onLoadData: () => void;
  canLoad: boolean;
}) {
  return (
    <div className="w-72 bg-white border-t border-b border-gray-200 flex flex-col">
      <div className="px-4 py-3 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-900">Configure Columns</h3>
        <p className="text-xs text-gray-500 mt-1">
          Configure columns and filters for your report and click &quot;Load Data&quot; to review.
        </p>
      </div>
      <div className="px-3 py-2 border-b border-gray-100">
        <div className="relative">
          <input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search Columns"
            className="w-full pl-3 pr-8 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
          <svg className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 110-16 8 8 0 010 16z" />
          </svg>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {categories.map((cat) => {
          const isOpen = expanded.has(cat.label);
          return (
            <div key={cat.label} className="border-b border-gray-100">
              <button
                type="button"
                onClick={() => onToggleCategory(cat.label)}
                className="w-full px-3 py-2 flex items-center justify-between text-left text-sm text-gray-800 hover:bg-gray-50"
              >
                <span className="flex items-center gap-2">
                  <svg
                    className={`w-3 h-3 text-gray-500 transition-transform ${isOpen ? "rotate-90" : ""}`}
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M6 4l8 6-8 6V4z" />
                  </svg>
                  <span>{cat.label}</span>
                  {cat.legacy && (
                    <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 border border-gray-200 uppercase tracking-wide">
                      Legacy
                    </span>
                  )}
                </span>
              </button>
              {isOpen && (
                <div className="px-3 pb-2 bg-gray-50/50">
                  {cat.fields.map((field) => {
                    const checked = isSelected(cat.label, field.key);
                    return (
                      <label
                        key={field.key}
                        className="flex items-center gap-2 py-1 text-xs text-gray-700 cursor-pointer pl-5"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => onToggleColumn(cat, field)}
                          className="w-3.5 h-3.5 rounded border-gray-300"
                        />
                        {field.label}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="px-3 py-2 border-t border-gray-100 bg-white">
        <label className="flex items-center gap-2 text-xs text-gray-700 mb-2">
          <span
            role="switch"
            aria-checked={loadDataManually}
            onClick={() => onLoadDataManuallyChange(!loadDataManually)}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${
              loadDataManually ? "bg-blue-600" : "bg-gray-300"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                loadDataManually ? "translate-x-4" : "translate-x-1"
              }`}
            />
          </span>
          <span>Load Data Manually</span>
          <svg className="w-3.5 h-3.5 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
          </svg>
        </label>
        <button
          type="button"
          disabled={!canLoad}
          onClick={onLoadData}
          className="w-full py-1.5 text-sm font-medium bg-orange-500 text-white rounded-md hover:bg-orange-600 disabled:bg-orange-200 disabled:cursor-not-allowed"
        >
          Load Data
        </button>
      </div>
    </div>
  );
}

function SimplePanel({ title, body }: { title: string; body: string }) {
  return (
    <div className="w-72 bg-white border-t border-b border-gray-200 flex flex-col">
      <div className="px-4 py-3 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      </div>
      <div className="p-4 text-xs text-gray-500">{body}</div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCell(value: unknown, format?: FieldDef["format"]) {
  if (value === null || value === undefined || value === "") return "—";
  if (format === "currency") {
    const n = typeof value === "number" ? value : parseFloat(String(value));
    if (Number.isNaN(n)) return String(value);
    return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
  }
  if (format === "date") {
    const d = new Date(String(value));
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString();
  }
  if (format === "number") {
    const n = typeof value === "number" ? value : parseFloat(String(value));
    if (Number.isNaN(n)) return String(value);
    return n.toLocaleString("en-US");
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

async function loadSource(projectId: string, source: string): Promise<Row[]> {
  // Map data sources to existing project APIs. Sources that don't yet have a
  // backing endpoint return empty arrays so the table still renders.
  if (source === "commitments") {
    const res = await fetch(`/api/projects/${projectId}/commitments`);
    if (!res.ok) throw new Error(`Failed to load commitments`);
    const data = await res.json();
    const items: Row[] = Array.isArray(data) ? data : data.items ?? [];
    return items.map((c: Row) => ({
      // New report-backed fields (stored in report_fields JSONB) come first so
      // explicitly-mapped columns below win on any key collision.
      ...((c.report_fields as Row) ?? {}),
      number: c.number,
      type: c.type,
      contract_company: c.contract_company,
      title: c.title,
      status: c.status,
      executed: c.executed,
      sov_accounting_method: c.sov_accounting_method,
      original_contract_amount: c.original_contract_amount,
      approved_change_orders: c.approved_change_orders,
      pending_change_orders: c.pending_change_orders,
      delivery_date: c.delivery_date,
      signed_po_received_date: c.signed_po_received_date,
      erp_status: c.erp_status,
      created_at: c.created_at,
      // Aliases so the catalog's Procore-style field keys also resolve.
      date_created: c.created_at,
      date_updated: c.updated_at,
      contract_date: c.contract_date,
      start_date: c.start_date,
      estimated_completion_date: c.estimated_completion,
      actual_completion_date: c.actual_completion,
      signed_contract_received_date: c.signed_contract_received,
      issued_on_date: c.issued_on_date,
      default_retainage: c.default_retainage,
      bond_amount: c.bond_amount,
      inclusions: c.inclusions,
      exclusions: c.exclusions,
      private: c.is_private,
      enable_subcontractor_sov: c.ssov_enabled,
      enable_financial_markups: c.financial_markup_enabled,
      subcontractor_contact: c.subcontractor_contact,
      subcontractor_sov_status: c.ssov_status,
      trades: c.trades,
      bill_to: c.bill_to,
      ship_to: c.ship_to,
      ship_via: c.ship_via,
      payment_terms: c.payment_terms,
      assigned_to: c.assigned_to,
      invoiced: c.invoiced,
      payments_issued: c.payments_issued,
      sign_with_docusign: c.sign_docusign,
    }));
  }

  if (source === "commitment-line-items") {
    const res = await fetch(`/api/projects/${projectId}/commitments`);
    if (!res.ok) return [];
    const data = await res.json();
    const items: Row[] = Array.isArray(data) ? data : data.items ?? [];
    const rows: Row[] = [];
    for (const c of items) {
      const sov = Array.isArray(c.schedule_of_values) ? c.schedule_of_values : [];
      for (const line of sov as Row[]) {
        rows.push({
          commitment_number: c.number,
          budget_code: line.budget_code,
          description: line.description,
          quantity: line.quantity ?? line.qty,
          uom: line.uom,
          unit_cost: line.unit_cost,
          amount: line.amount,
          billed_to_date: line.billed_to_date,
          amount_remaining: line.amount_remaining,
        });
      }
    }
    return rows;
  }

  if (source === "budget-codes") {
    const res = await fetch(`/api/projects/${projectId}/budget`);
    if (!res.ok) throw new Error("Failed to load budget");
    const data = await res.json();
    const items: Row[] = Array.isArray(data) ? data : [];
    // De-dupe by cost_code so each unique budget code appears once.
    const seen = new Set<string>();
    const rows: Row[] = [];
    for (const it of items) {
      const code = String(it.cost_code ?? "").trim();
      if (!code || seen.has(code)) continue;
      seen.add(code);
      rows.push({
        code,
        description: it.description ?? "",
        cost_type: it.cost_type ?? "",
        active: it.is_active === false ? false : true,
      });
    }
    return rows;
  }

  if (source === "budget-line-items") {
    const res = await fetch(`/api/projects/${projectId}/budget`);
    if (!res.ok) throw new Error("Failed to load budget");
    const data = await res.json();
    const items: Row[] = Array.isArray(data) ? data : [];
    return items.map((it: Row) => {
      const original = Number(it.original_budget_amount ?? 0);
      const approvedCos = Number(it.approved_cos ?? 0);
      const modifications = Number(it.budget_modifications ?? 0);
      const committed = Number(it.committed_costs ?? 0);
      const revised = original + approvedCos + modifications;
      return {
        cost_code: it.cost_code ?? "",
        description: it.description ?? "",
        original_budget: original,
        revised_budget: revised,
        committed_costs: committed,
        variance: revised - committed,
      };
    });
  }

  if (source === "budget-modifications") {
    const res = await fetch(`/api/projects/${projectId}/budget/modifications`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  }

  if (source === "change-events" || source === "change-event-line-items") {
    const res = await fetch(`/api/projects/${projectId}/change-events`);
    if (!res.ok) return [];
    const data = await res.json();
    const events: Row[] = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
    if (source === "change-events") {
      return events.map((ev) => ({
        number: ev.number,
        title: ev.title,
        status: ev.status,
        type: ev.type,
        scope: ev.scope,
        change_reason: ev.change_reason,
        origin: ev.origin,
        rom_amount: ev.rom_amount,
        description: ev.description,
        created_at: ev.created_at,
        updated_at: ev.updated_at,
      }));
    }
    const rows: Row[] = [];
    for (const ev of events) {
      const lines = Array.isArray(ev.line_items) ? ev.line_items : [];
      for (const line of lines as Row[]) {
        rows.push({
          change_event_number: ev.number,
          budget_code: line.budget_code,
          description: line.description,
          vendor: line.vendor,
          quantity: line.quantity ?? line.unit_qty,
          uom: line.uom,
          rom_unit_cost: line.rom_unit_cost ?? line.unit_cost,
          rom_amount: line.rom_amount ?? line.amount,
          actual_unit_cost: line.actual_unit_cost,
          actual_amount: line.actual_amount,
        });
      }
    }
    return rows;
  }

  if (source === "commitment-change-orders" || source === "prime-contract-change-orders") {
    const type = source === "prime-contract-change-orders" ? "prime" : "commitment";
    const res = await fetch(`/api/projects/${projectId}/change-orders?type=${type}`);
    if (!res.ok) return [];
    const data = await res.json();
    const items: Row[] = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
    return items.map((co: Row) => ({
      // report_fields-backed columns first, then explicit/aliased keys.
      ...((co.report_fields as Row) ?? {}),
      ...co,
      number: co.number,
      title: co.title,
      status: co.status,
      amount: co.amount,
      change_reason: co.change_reason,
      contract_company: co.contract_company,
      contract_name: co.contract_name,
      due_date: co.due_date,
      description: co.description,
      designated_reviewer: co.designated_reviewer,
      reviewer: co.reviewer,
      review_date: co.review_date,
      revision: co.revision,
      executed: co.executed,
      private: co.is_private,
      date_created: co.created_at,
      date_updated: co.updated_at,
      approved_date: co.approved_at,
      invoiced_date: co.invoiced_date,
      paid_date: co.paid_date,
      schedule_impact_days: co.schedule_impact,
      signed_change_order_received_date: co.signed_change_order_received_date,
    }));
  }

  if (source === "prime-contracts") {
    const res = await fetch(`/api/projects/${projectId}/prime-contracts`);
    if (!res.ok) return [];
    const data = await res.json();
    const items: Row[] = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
    return items.map((pc: Row) => ({
      ...((pc.report_fields as Row) ?? {}),
      number: pc.contract_number,
      title: pc.title,
      status: pc.status,
      owner_client: pc.owner_client,
      contractor: pc.contractor,
      architect_engineer: pc.architect_engineer,
      description: pc.description,
      inclusions: pc.inclusions,
      exclusions: pc.exclusions,
      executed: pc.executed,
      private: pc.is_private,
      default_retainage: pc.default_retainage,
      original_contract_amount: pc.original_contract_amount,
      approved_change_orders: pc.approved_change_orders,
      pending_change_orders: pc.pending_change_orders,
      draft_change_orders: pc.draft_change_orders,
      revised_contract_amount:
        Number(pc.original_contract_amount ?? 0) + Number(pc.approved_change_orders ?? 0),
      invoiced: pc.invoiced,
      payments_received: pc.payments_received,
      start_date: pc.start_date,
      estimated_completion_date: pc.estimated_completion_date,
      actual_completion_date: pc.actual_completion_date,
      signed_contract_received_date: pc.signed_contract_received_date,
      contract_termination_date: pc.contract_termination_date,
      date_created: pc.created_at,
      date_updated: pc.updated_at,
      erp_latest_status: pc.erp_status,
    }));
  }

  // ── Directory & Portfolio ────────────────────────────────────────────────
  if (source === "companies") {
    const res = await fetch(`/api/projects/${projectId}/directory`);
    if (!res.ok) return [];
    const contacts: Row[] = await res.json();
    return (contacts ?? [])
      .filter((c) => c.type === "company")
      .map((c) => ({
        ...((c.report_fields as Row) ?? {}),
        id: c.id,
        name: c.company ?? `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim(),
        abbreviated_name: c.abbreviated_name,
        address: c.address,
        business_phone: c.business_phone,
        business_fax: c.business_fax,
        website: c.website,
        city: c.city,
        state: c.state,
        country: c.country,
        zip: c.zip,
        entity_type: c.entity_type,
        license_number: c.license_number,
        labor_union: c.labor_union,
        tags_keywords: c.tags_keywords,
        trades: c.trades,
        cost_codes: c.cost_codes,
        primary_contact_name: c.primary_contact,
        primary_contact_first_name: c.first_name,
        primary_contact_last_name: c.last_name,
        primary_contact_email_address: c.email,
        primary_contact_mobile_phone: c.phone,
        primary_contact_job_title: c.job_title,
        email_address: c.email,
        authorized_bidder: c.authorized_bidder,
        union_member: c.union_member,
        small_business: c.small_business,
        prevailing_wage: c.prevailing_wage,
        affirmative_action: c.affirmative_action,
        african_american_business: c.african_american_business,
        asian_american_business: c.asian_american_business,
        hispanic_business: c.hispanic_business,
        native_american_business: c.native_american_business,
        womens_business: c.women_business,
        disadvantaged_business: c.disadvantaged_business,
        historically_underutilized_business: c.hub_zone,
        minority_business_enterprise: c.minority_business_enterprise,
        service_disabled_veteran_owned_small_business: c.sdvosb,
        business_8a: c.business_8a,
        certified_business_enterprise: c.certified_business_enterprise,
        prequalified: c.prequalified,
        company_rating_avg: c.bidder_rating,
        is_active: true,
        date_created: c.created_at,
      }));
  }

  if (source === "project") {
    const res = await fetch(`/api/projects/${projectId}`);
    if (!res.ok) return [];
    const p = (await res.json()) as Row;
    if (!p || typeof p !== "object") return [];
    return [{
      ...((p.report_fields as Row) ?? {}),
      id: p.id,
      name: p.name,
      number: p.project_number,
      code: p.project_number,
      work_scope: p.work_scope,
      description: p.description,
      address: p.address,
      city: p.city,
      state: p.state,
      county: p.county,
      zip: p.zip_code,
      stage_name: p.stage,
      type: p.sector,
      sector: p.sector,
      actual_start_date: p.actual_start_date,
      start_date: p.start_date ?? p.actual_start_date,
      actual_completion_date: p.completion_date,
      completion_date: p.completion_date,
      projected_finish_date: p.projected_finish_date,
      warranty_start_date: p.warranty_start_date,
      warranty_end_date: p.warranty_end_date,
      total_value: p.value,
      estimated_budget: p.value,
      erp_latest_status: p.erp_status,
      accounting_project_number: p.sage_job_key,
      date_created: p.created_at,
      is_active: p.archived_at ? false : true,
    }];
  }

  if (source === "project-distribution-groups") {
    const res = await fetch(`/api/projects/${projectId}/directory`);
    if (!res.ok) return [];
    const contacts: Row[] = await res.json();
    return (contacts ?? [])
      .filter((c) => c.type === "distribution_group")
      .map((c) => ({
        id: c.id,
        name: c.group_name,
        description: c.notes,
      }));
  }

  if (source === "project-roles") {
    const [projectRes, dirRes] = await Promise.all([
      fetch(`/api/projects/${projectId}`),
      fetch(`/api/projects/${projectId}/directory`),
    ]);
    if (!projectRes.ok) return [];
    const p = (await projectRes.json()) as Row;
    const contacts: Row[] = dirRes.ok ? await dirRes.json() : [];
    const contactsById = new Map<string, Row>();
    for (const c of contacts) contactsById.set(String(c.id), c);
    const roles = (p?.project_roles ?? {}) as Record<string, unknown>;
    const rows: Row[] = [];
    for (const [role, members] of Object.entries(roles)) {
      const list = Array.isArray(members) ? (members as Row[]) : [];
      for (const m of list) {
        const contact = m.id ? contactsById.get(String(m.id)) : undefined;
        const contactFullName = contact?.first_name || contact?.last_name
          ? `${contact?.first_name ?? ""} ${contact?.last_name ?? ""}`.trim()
          : null;
        rows.push({
          id: m.id,
          role_name: role,
          contact_name: m.name ?? contactFullName ?? m.username ?? m.id,
          contact_type: contact?.type ?? "user",
          group: contact?.group_name ?? m.company,
          date_updated: contact?.created_at,
        });
      }
    }
    return rows;
  }

  // RFI family — single parent fetch, multiple flattenings
  if (source === "rfis" || source === "rfi-assignees" || source === "rfi-distribution-list" || source === "rfi-ball-in-court") {
    const res = await fetch(`/api/projects/${projectId}/rfis`);
    if (!res.ok) return [];
    const rfis: Row[] = await res.json();
    if (source === "rfis") {
      return (rfis ?? []).map((r) => ({
        ...((r.report_fields as Row) ?? {}),
        rfi_number: r.rfi_number,
        number: r.rfi_number,
        subject: r.subject,
        status: r.status,
        rfi_stage: r.rfi_stage,
        stage: r.rfi_stage,
        due_date: r.due_date,
        date_created: r.created_at,
        rfi_manager: r.rfi_manager_name ?? r.rfi_manager_id,
        received_from: r.received_from_name ?? r.received_from_id,
        specification: r.specification_name ?? r.specification_id,
        drawing_number: r.drawing_number,
        cost_code: r.cost_code,
        schedule_impact: r.schedule_impact,
        cost_impact: r.cost_impact,
        private: r.private,
        created_at: r.created_at,
      }));
    }
    const rows: Row[] = [];
    for (const r of rfis ?? []) {
      if (source === "rfi-assignees") {
        const list = Array.isArray(r.assignees) ? (r.assignees as Row[]) : [];
        for (const m of list) rows.push({ rfi_number: r.rfi_number, assignee_name: m.name ?? m.id, company: m.company, email: m.email });
      } else if (source === "rfi-distribution-list") {
        const list = Array.isArray(r.distribution_list) ? (r.distribution_list as Row[]) : [];
        for (const m of list) rows.push({ rfi_number: r.rfi_number, member_name: m.name ?? m.id, company: m.company, email: m.email });
      } else {
        // rfi-ball-in-court
        if (r.ball_in_court_id || r.ball_in_court_name) {
          rows.push({
            rfi_number: r.rfi_number,
            holder_name: r.ball_in_court_name ?? r.ball_in_court_id,
            company: r.ball_in_court_company,
            assigned_at: r.ball_in_court_assigned_at ?? r.updated_at ?? r.created_at,
          });
        }
      }
    }
    return rows;
  }

  // Submittal family
  if (source === "submittals" || source === "submittal-approvers" || source === "submittal-ball-in-court" || source === "submittal-distribution-list") {
    const res = await fetch(`/api/projects/${projectId}/submittals`);
    if (!res.ok) return [];
    const subs: Row[] = await res.json();
    if (source === "submittals") {
      return (subs ?? []).map((s) => ({
        ...((s.report_fields as Row) ?? {}),
        submittal_number: s.submittal_number,
        number: s.submittal_number,
        revision: s.revision,
        title: s.title,
        submittal_type: s.submittal_type,
        type: s.submittal_type,
        status: s.status,
        date_created: s.created_at,
        description: s.description,
        ball_in_court: s.ball_in_court_name ?? s.ball_in_court_id,
        specification: s.specification_name ?? s.specification_id,
        responsible_contractor: s.responsible_contractor_name ?? s.responsible_contractor_id,
        received_from: s.received_from_name ?? s.received_from_id,
        submittal_manager: s.submittal_manager_name ?? s.submittal_manager_id,
        submit_by: s.submit_by,
        received_date: s.received_date,
        issue_date: s.issue_date,
        final_due_date: s.final_due_date,
        required_on_site_date: s.required_on_site_date,
        lead_time: s.lead_time,
        cost_code: s.cost_code,
        private: s.private,
      }));
    }
    const rows: Row[] = [];
    for (const s of subs ?? []) {
      if (source === "submittal-approvers") {
        const steps = Array.isArray(s.workflow_steps) ? (s.workflow_steps as Row[]) : [];
        for (const step of steps) {
          rows.push({
            submittal_number: s.submittal_number,
            approver_name: step.approver_name ?? step.name ?? step.approver_id,
            company: step.company,
            response: step.response ?? step.status,
            due_date: step.due_date,
            responded_at: step.responded_at,
          });
        }
      } else if (source === "submittal-distribution-list") {
        const list = Array.isArray(s.distribution_list) ? (s.distribution_list as Row[]) : [];
        for (const m of list) rows.push({ submittal_number: s.submittal_number, member_name: m.name ?? m.id, company: m.company, email: m.email });
      } else {
        if (s.ball_in_court_id || s.ball_in_court_name) {
          rows.push({
            submittal_number: s.submittal_number,
            holder_name: s.ball_in_court_name ?? s.ball_in_court_id,
            company: s.ball_in_court_company,
            assigned_at: s.distributed_at ?? s.updated_at ?? s.created_at,
          });
        }
      }
    }
    return rows;
  }

  // Punch family
  if (source === "punch-items" || source === "punch-item-assignees" || source === "punch-item-ball-in-court" || source === "punch-item-distribution-members") {
    const res = await fetch(`/api/projects/${projectId}/punch-list`);
    if (!res.ok) return [];
    const items: Row[] = await res.json();
    if (source === "punch-items") {
      return (items ?? []).map((p) => ({
        ...((p.report_fields as Row) ?? {}),
        item_number: p.item_number,
        number: p.item_number,
        title: p.title,
        status: p.status,
        type: p.type,
        priority: p.priority,
        trade: p.trade,
        location: p.location,
        due_date: p.due_date,
        schedule_impact: p.schedule_impact,
        cost_impact: p.cost_impact,
        cost_code: p.cost_codes,
        reference: p.reference,
        description: p.description,
        ball_in_court: p.ball_in_court,
        punch_item_manager: p.punch_item_manager_name ?? p.punch_item_manager_id,
        final_approver: p.final_approver_name ?? p.final_approver_id,
        private: p.private,
        created_at: p.created_at,
        date_created: p.created_at,
      }));
    }
    const rows: Row[] = [];
    for (const p of items ?? []) {
      if (source === "punch-item-assignees") {
        const list = Array.isArray(p.assignees) ? (p.assignees as Row[]) : [];
        for (const m of list) rows.push({ item_number: p.item_number, assignee_name: m.name ?? m.id, company: m.company, email: m.email });
      } else if (source === "punch-item-distribution-members") {
        const list = Array.isArray(p.distribution_list) ? (p.distribution_list as Row[]) : [];
        for (const m of list) rows.push({ item_number: p.item_number, member_name: m.name ?? m.id, company: m.company, email: m.email });
      } else {
        const holderId = p.final_approver_id ?? p.punch_item_manager_id;
        if (holderId) {
          rows.push({
            item_number: p.item_number,
            holder_name: p.final_approver_name ?? p.punch_item_manager_name ?? holderId,
            company: p.final_approver_company,
            assigned_at: p.created_at,
          });
        }
      }
    }
    return rows;
  }

  // Task family
  if (source === "tasks" || source === "task-assignees" || source === "task-distribution-members") {
    const res = await fetch(`/api/projects/${projectId}/tasks`);
    if (!res.ok) return [];
    const items: Row[] = await res.json();
    if (source === "tasks") {
      return (items ?? []).map((t) => ({
        ...((t.report_fields as Row) ?? {}),
        task_number: t.task_number,
        number: t.task_number,
        title: t.title,
        status: t.status,
        category: t.category,
        description: t.description,
        due_date: t.due_date,
        private: t.is_private,
        created_by: t.created_by_name ?? t.created_by,
        created_at: t.created_at,
        date_created: t.created_at,
      }));
    }
    const rows: Row[] = [];
    for (const t of items ?? []) {
      if (source === "task-assignees") {
        const list = Array.isArray(t.assignees) ? (t.assignees as Row[]) : [];
        for (const m of list) rows.push({ task_number: t.task_number, assignee_name: m.name ?? m.id, company: m.company, email: m.email });
      } else {
        const list = Array.isArray(t.distribution_list) ? (t.distribution_list as Row[]) : [];
        for (const m of list) rows.push({ task_number: t.task_number, member_name: m.name ?? m.id, company: m.company, email: m.email });
      }
    }
    return rows;
  }

  // Meetings
  if (source === "meetings" || source === "meeting-attendees") {
    const res = await fetch(`/api/projects/${projectId}/meetings`);
    if (!res.ok) return [];
    const items: Row[] = await res.json();
    if (source === "meetings") {
      return (items ?? []).map((m) => ({
        ...((m.report_fields as Row) ?? {}),
        meeting_number: m.meeting_number,
        number: m.meeting_number,
        title: m.title,
        name: m.title,
        series: m.series,
        date: m.date,
        end_date: m.end_date,
        location: m.location,
        status: m.status,
        overview: m.overview,
        start_time: m.start_time,
        finish_time: m.end_time,
        timezone: m.timezone,
        private: m.is_private,
        is_private: m.is_private,
        draft_meeting: m.is_draft,
        created_by: m.created_by_name ?? m.created_by,
        created_date: m.created_at,
      }));
    }
    const rows: Row[] = [];
    for (const m of items ?? []) {
      const list = Array.isArray(m.attendees) ? (m.attendees as Row[]) : [];
      for (const a of list) {
        rows.push({
          meeting_number: m.meeting_number,
          attendee_name: a.name ?? a.id,
          company: a.company,
          email: a.email,
          attended: a.attended,
        });
      }
    }
    return rows;
  }

  // Drawings
  if (source === "drawings") {
    const res = await fetch(`/api/projects/${projectId}/drawings`);
    if (!res.ok) return [];
    const data = await res.json();
    const drawings: Row[] = Array.isArray(data?.drawings) ? data.drawings : Array.isArray(data) ? data : [];
    return drawings.map((d) => ({
      ...((d.report_fields as Row) ?? {}),
      drawing_no: d.drawing_no,
      number: d.drawing_no,
      title: d.title,
      revision: d.revision,
      current_revision: d.revision,
      discipline: d.discipline ?? d.category,
      drawing_set: d.drawing_set ?? d.set_name,
      set: d.drawing_set ?? d.set_name,
      drawing_date: d.drawing_date,
      received_date: d.received_date,
      page_number: d.page_number,
      position: d.page_number,
      updated_at: d.updated_at,
      date_updated: d.updated_at,
    }));
  }

  // Documents
  if (source === "documents") {
    const res = await fetch(`/api/projects/${projectId}/documents`);
    if (!res.ok) return [];
    const data: Row[] = await res.json();
    return (data ?? []).map((d) => ({
      ...((d.report_fields as Row) ?? {}),
      name: d.name,
      type: d.type,
      is_folder: d.type === "folder",
      mime_type: d.mime_type,
      size: d.size,
      file_size_bytes: d.size,
      parent_name: d.parent_name ?? d.parent_id,
      name_with_path: d.name_with_path ?? d.name,
      private: d.is_private,
      created_by: d.created_by_name ?? d.created_by,
      created_at: d.created_at,
      date_created: d.created_at,
      date_updated: d.updated_at,
    }));
  }

  // Photos
  if (source === "photos") {
    const res = await fetch(`/api/projects/${projectId}/photos`);
    if (!res.ok) return [];
    const data: Row[] = await res.json();
    return (data ?? []).map((p) => ({
      filename: p.filename,
      caption: p.caption,
      album: p.album_name ?? p.album_id,
      location: p.location,
      uploaded_by_name: p.uploaded_by_name,
      uploaded_at: p.uploaded_at,
    }));
  }

  // Locations
  if (source === "locations") {
    const res = await fetch(`/api/projects/${projectId}/locations`);
    if (!res.ok) return [];
    const data: Row[] = await res.json();
    return (data ?? []).map((l) => ({
      name: l.name,
      path: l.path,
      parent_name: l.parent_name ?? l.parent_id,
      created_by: l.created_by_name ?? l.created_by,
      created_at: l.created_at,
      updated_at: l.updated_at,
    }));
  }

  // Specifications
  if (source === "specification-sections") {
    const res = await fetch(`/api/projects/${projectId}/specifications`);
    if (!res.ok) return [];
    const data: Row[] = await res.json();
    return (data ?? [])
      .filter((s) => !s.deleted_at)
      .map((s) => ({
        code: s.code,
        name: s.name,
        division: s.division ?? s.division_name,
        set_name: s.set_name,
        revision: s.revision,
        created_at: s.created_at,
      }));
  }

  // Daily Log subtypes — single parent fetch, then flatten the JSONB array per source
  const dailyLogMap: Record<string, { field: string; map: (entry: Row, log: Row) => Row }> = {
    "daily-log-accidents": {
      field: "accidents",
      map: (e, l) => ({
        log_date: l.log_date,
        time: e.time,
        person_involved: e.party_involved,
        company: e.company_involved,
        location: "",
        description: e.comments,
        severity: "",
        reported_by: l.created_by_name ?? l.created_by,
        created_at: l.created_at,
      }),
    },
    "daily-log-delays": {
      field: "delays",
      map: (e, l) => ({
        log_date: l.log_date,
        delay_type: e.delay_type,
        start_time: e.start_time,
        end_time: e.end_time,
        duration_hours: e.duration_hours,
        location: e.location,
        description: e.comments,
        created_by: l.created_by_name ?? l.created_by,
      }),
    },
    "daily-log-deliveries": {
      field: "deliveries",
      map: (e, l) => ({
        log_date: l.log_date,
        time: e.time,
        delivered_by: e.delivery_from,
        tracking_number: e.tracking_number,
        contents: e.contents,
        received_by: l.created_by_name ?? l.created_by,
        notes: e.comments,
      }),
    },
    "daily-log-inspections": {
      field: "inspections",
      map: (e, l) => ({
        log_date: l.log_date,
        inspection_type: e.inspection_type,
        inspector: e.inspector_name,
        company: e.inspecting_entity,
        location: e.location,
        inspection_area: e.inspection_area,
        result: e.result ?? e.status,
        notes: e.comments,
      }),
    },
    "daily-log-manpower": {
      field: "manpower",
      map: (e, l) => ({
        log_date: l.log_date,
        company: e.company,
        trade: e.trade,
        worker_count: e.workers,
        hours_per_worker: e.hours,
        location: e.location,
        cost_code: e.cost_code,
        notes: e.comments,
      }),
    },
    "daily-log-notes": {
      field: "note_entries",
      map: (e, l) => ({
        log_date: l.log_date,
        note: e.comments,
        category: e.is_issue ? "Issue" : "Note",
        location: e.location,
        created_by: l.created_by_name ?? l.created_by,
      }),
    },
    "daily-log-weather": {
      field: "weather_observations",
      map: (e, l) => ({
        log_date: l.log_date,
        time_of_day: e.time_observed,
        conditions: e.sky,
        temperature: e.temperature,
        wind: e.wind,
        humidity: e.humidity,
        precipitation: e.avg_precipitation ?? e.calamity,
      }),
    },
    "daily-log-safety-violations": {
      field: "safety_violations",
      map: (e, l) => ({
        log_date: l.log_date,
        time: e.time,
        violation_type: e.subject,
        person_involved: e.issued_to,
        company: "",
        location: "",
        description: e.safety_notice,
        action_taken: e.comments,
        compliance_due: e.compliance_due,
      }),
    },
    "daily-log-visitors": {
      field: "visitors",
      map: (e, l) => ({
        log_date: l.log_date,
        visitor_name: e.visitor,
        company: "",
        purpose: e.comments,
        arrival_time: e.start_time,
        departure_time: e.end_time,
      }),
    },
  };

  if (dailyLogMap[source]) {
    const res = await fetch(`/api/projects/${projectId}/daily-log`);
    if (!res.ok) return [];
    const logs: Row[] = await res.json();
    const { field, map } = dailyLogMap[source];
    const rows: Row[] = [];
    for (const log of logs ?? []) {
      const entries = Array.isArray(log[field]) ? (log[field] as Row[]) : [];
      for (const entry of entries) rows.push(map(entry, log));
    }
    return rows;
  }

  // Timecard entries — flatten timesheets.entries
  if (source === "timecard-entries") {
    const res = await fetch(`/api/projects/${projectId}/timesheets`);
    if (!res.ok) return [];
    const sheets: Row[] = await res.json();
    const rows: Row[] = [];
    for (const sheet of sheets ?? []) {
      const entries = Array.isArray(sheet.entries) ? (sheet.entries as Row[]) : [];
      for (const e of entries) {
        rows.push({
          work_date: sheet.work_date,
          resource_name: e.resource_name,
          resource_type: e.resource_type,
          start_time: e.start_time,
          stop_time: e.stop_time,
          lunch_minutes: e.lunch_minutes,
          total_hours: e.total_hours,
          time_type: e.time_type,
          billable: e.billable,
          cost_code: e.cost_code,
          cost_type: e.cost_type,
          location_path: e.location_path,
          description: e.description,
          status: e.status,
        });
      }
    }
    return rows;
  }

  // Source-less report entities backed by the generic report_records table.
  if (REPORT_RECORD_SLUGS.includes(source)) {
    const res = await fetch(`/api/projects/${projectId}/report-records?entity=${encodeURIComponent(source)}`);
    if (!res.ok) return [];
    const records: Row[] = await res.json();
    return (records ?? []).map((r) => ({
      ...((r.report_fields as Row) ?? {}),
      id: r.id,
      date_created: r.created_at,
      date_updated: r.updated_at,
    }));
  }

  // Unknown / not-yet-backed source — render an empty table.
  return [];
}
