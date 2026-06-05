"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ProjectNav from "@/components/ProjectNav";
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

const PROJECT_EXECUTION_CATEGORIES: CategoryDef[] = [
  {
    label: "Change Event",
    source: "change-events",
    fields: [
      { key: "number", label: "#" },
      { key: "title", label: "Title" },
      { key: "status", label: "Status" },
      { key: "type", label: "Type" },
      { key: "scope", label: "Scope" },
      { key: "change_reason", label: "Change Reason" },
      { key: "origin", label: "Origin" },
      { key: "rom_amount", label: "ROM Amount", format: "currency" },
      { key: "description", label: "Description" },
      { key: "created_at", label: "Created", format: "date" },
      { key: "updated_at", label: "Updated", format: "date" },
    ],
  },
  {
    label: "Change Event Line Item",
    source: "change-event-line-items",
    fields: [
      { key: "change_event_number", label: "Change Event #" },
      { key: "budget_code", label: "Budget Code" },
      { key: "description", label: "Description" },
      { key: "vendor", label: "Vendor" },
      { key: "quantity", label: "Quantity" },
      { key: "uom", label: "UOM" },
      { key: "rom_unit_cost", label: "ROM Unit Cost", format: "currency" },
      { key: "rom_amount", label: "ROM Amount", format: "currency" },
      { key: "actual_unit_cost", label: "Actual Unit Cost", format: "currency" },
      { key: "actual_amount", label: "Actual Amount", format: "currency" },
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
      { key: "executed", label: "Executed" },
      { key: "sov_accounting_method", label: "Accounting Method" },
      { key: "original_contract_amount", label: "Original Amount", format: "currency" },
      { key: "approved_change_orders", label: "Approved COs", format: "currency" },
      { key: "pending_change_orders", label: "Pending COs", format: "currency" },
      { key: "delivery_date", label: "Delivery Date", format: "date" },
      { key: "signed_po_received_date", label: "Signed Date", format: "date" },
      { key: "created_at", label: "Created", format: "date" },
    ],
  },
  {
    label: "Commitment Line Item",
    source: "commitment-line-items",
    fields: [
      { key: "commitment_number", label: "Commitment #" },
      { key: "budget_code", label: "Budget Code" },
      { key: "description", label: "Description" },
      { key: "quantity", label: "Quantity" },
      { key: "uom", label: "UOM" },
      { key: "unit_cost", label: "Unit Cost", format: "currency" },
      { key: "amount", label: "Amount", format: "currency" },
      { key: "billed_to_date", label: "Billed to Date", format: "currency" },
      { key: "amount_remaining", label: "Amount Remaining", format: "currency" },
    ],
  },
  {
    label: "Daily Log Accident",
    source: "daily-log-accidents",
    fields: [
      { key: "log_date", label: "Date", format: "date" },
      { key: "time", label: "Time" },
      { key: "person_involved", label: "Person Involved" },
      { key: "company", label: "Company" },
      { key: "description", label: "Description" },
      { key: "reported_by", label: "Reported By" },
      { key: "created_at", label: "Created", format: "date" },
    ],
  },
  {
    label: "Daily Log Completion",
    source: "daily-log-completions",
    fields: [
      { key: "log_date", label: "Date", format: "date" },
      { key: "trade", label: "Trade" },
      { key: "location", label: "Location" },
      { key: "percent_complete", label: "% Complete" },
      { key: "notes", label: "Notes" },
      { key: "created_by", label: "Created By" },
    ],
  },
  {
    label: "Daily Log Construction Report",
    source: "daily-log-construction-reports",
    fields: [
      { key: "log_date", label: "Date", format: "date" },
      { key: "report_type", label: "Report Type" },
      { key: "summary", label: "Summary" },
      { key: "created_by", label: "Created By" },
      { key: "created_at", label: "Created", format: "date" },
    ],
  },
  {
    label: "Daily Log Delay",
    source: "daily-log-delays",
    fields: [
      { key: "log_date", label: "Date", format: "date" },
      { key: "delay_type", label: "Delay Type" },
      { key: "trade", label: "Trade" },
      { key: "location", label: "Location" },
      { key: "duration_hours", label: "Duration (hrs)" },
      { key: "description", label: "Description" },
      { key: "created_by", label: "Created By" },
    ],
  },
  {
    label: "Daily Log Delivery",
    source: "daily-log-deliveries",
    fields: [
      { key: "log_date", label: "Date", format: "date" },
      { key: "time", label: "Time" },
      { key: "delivered_by", label: "Delivered By" },
      { key: "tracking_number", label: "Tracking #" },
      { key: "contents", label: "Contents" },
      { key: "received_by", label: "Received By" },
      { key: "notes", label: "Notes" },
    ],
  },
  {
    label: "Daily Log Dumpster",
    source: "daily-log-dumpsters",
    fields: [
      { key: "log_date", label: "Date", format: "date" },
      { key: "vendor", label: "Vendor" },
      { key: "size", label: "Size" },
      { key: "location", label: "Location" },
      { key: "action", label: "Action" },
      { key: "notes", label: "Notes" },
    ],
  },
  {
    label: "Daily Log Equipment",
    source: "daily-log-equipment",
    fields: [
      { key: "log_date", label: "Date", format: "date" },
      { key: "equipment_name", label: "Equipment" },
      { key: "hours_used", label: "Hours Used" },
      { key: "hours_idle", label: "Hours Idle" },
      { key: "operator", label: "Operator" },
      { key: "notes", label: "Notes" },
    ],
  },
  {
    label: "Daily Log Inspection",
    source: "daily-log-inspections",
    fields: [
      { key: "log_date", label: "Date", format: "date" },
      { key: "inspection_type", label: "Type" },
      { key: "inspector", label: "Inspector" },
      { key: "company", label: "Company" },
      { key: "location", label: "Location" },
      { key: "inspection_area", label: "Inspection Area" },
      { key: "result", label: "Result" },
      { key: "notes", label: "Notes" },
    ],
  },
  {
    label: "Daily Log Manpower",
    source: "daily-log-manpower",
    fields: [
      { key: "log_date", label: "Date", format: "date" },
      { key: "company", label: "Company" },
      { key: "worker_count", label: "Workers" },
      { key: "hours_per_worker", label: "Hrs/Worker" },
      { key: "location", label: "Location" },
      { key: "cost_code", label: "Cost Code" },
      { key: "notes", label: "Notes" },
    ],
  },
  {
    label: "Daily Log Note",
    source: "daily-log-notes",
    fields: [
      { key: "log_date", label: "Date", format: "date" },
      { key: "note", label: "Note" },
      { key: "category", label: "Category" },
      { key: "location", label: "Location" },
      { key: "created_by", label: "Created By" },
    ],
  },
  {
    label: "Daily Log Observed Weather Condition",
    source: "daily-log-weather",
    fields: [
      { key: "log_date", label: "Date", format: "date" },
      { key: "time_of_day", label: "Time of Day" },
      { key: "conditions", label: "Conditions" },
      { key: "temperature", label: "Temperature" },
      { key: "wind", label: "Wind" },
      { key: "humidity", label: "Humidity" },
      { key: "precipitation", label: "Precipitation" },
    ],
  },
  {
    label: "Daily Log Phone Call",
    source: "daily-log-phone-calls",
    fields: [
      { key: "log_date", label: "Date", format: "date" },
      { key: "caller", label: "Caller" },
      { key: "call_with", label: "Call With" },
      { key: "company", label: "Company" },
      { key: "subject", label: "Subject" },
      { key: "notes", label: "Notes" },
    ],
  },
  {
    label: "Daily Log Plan Revision",
    source: "daily-log-plan-revisions",
    fields: [
      { key: "log_date", label: "Date", format: "date" },
      { key: "drawing_number", label: "Drawing #" },
      { key: "revision", label: "Revision" },
      { key: "description", label: "Description" },
      { key: "received_from", label: "Received From" },
    ],
  },
  {
    label: "Daily Log Productivity",
    source: "daily-log-productivity",
    fields: [
      { key: "log_date", label: "Date", format: "date" },
      { key: "cost_code", label: "Cost Code" },
      { key: "trade", label: "Trade" },
      { key: "quantity_installed", label: "Qty Installed" },
      { key: "uom", label: "UOM" },
      { key: "hours_used", label: "Hours Used" },
      { key: "notes", label: "Notes" },
    ],
  },
  {
    label: "Daily Log Quantity",
    source: "daily-log-quantities",
    fields: [
      { key: "log_date", label: "Date", format: "date" },
      { key: "cost_code", label: "Cost Code" },
      { key: "location", label: "Location" },
      { key: "quantity", label: "Quantity" },
      { key: "uom", label: "UOM" },
      { key: "notes", label: "Notes" },
    ],
  },
  {
    label: "Daily Log Safety Violation",
    source: "daily-log-safety-violations",
    fields: [
      { key: "log_date", label: "Date", format: "date" },
      { key: "time", label: "Time" },
      { key: "violation_type", label: "Violation Type" },
      { key: "person_involved", label: "Person Involved" },
      { key: "description", label: "Safety Notice" },
      { key: "action_taken", label: "Action Taken" },
      { key: "compliance_due", label: "Compliance Due", format: "date" },
    ],
  },
  {
    label: "Daily Log Scheduled Work",
    source: "daily-log-scheduled-work",
    fields: [
      { key: "log_date", label: "Date", format: "date" },
      { key: "schedule_item", label: "Schedule Item" },
      { key: "trade", label: "Trade" },
      { key: "status", label: "Status" },
      { key: "notes", label: "Notes" },
    ],
  },
  {
    label: "Daily Log Scheduled Work Task",
    source: "daily-log-scheduled-work-tasks",
    fields: [
      { key: "log_date", label: "Date", format: "date" },
      { key: "task_name", label: "Task" },
      { key: "assigned_to", label: "Assigned To" },
      { key: "status", label: "Status" },
      { key: "notes", label: "Notes" },
    ],
  },
  {
    label: "Daily Log Visitor",
    source: "daily-log-visitors",
    fields: [
      { key: "log_date", label: "Date", format: "date" },
      { key: "visitor_name", label: "Visitor" },
      { key: "company", label: "Company" },
      { key: "purpose", label: "Purpose" },
      { key: "arrival_time", label: "Arrival" },
      { key: "departure_time", label: "Departure" },
    ],
  },
  {
    label: "Daily Log Waste",
    source: "daily-log-waste",
    fields: [
      { key: "log_date", label: "Date", format: "date" },
      { key: "waste_type", label: "Waste Type" },
      { key: "quantity", label: "Quantity" },
      { key: "uom", label: "UOM" },
      { key: "disposal_method", label: "Disposal Method" },
      { key: "notes", label: "Notes" },
    ],
  },
  {
    label: "Drawing",
    source: "drawings",
    fields: [
      { key: "drawing_no", label: "Drawing #" },
      { key: "title", label: "Title" },
      { key: "revision", label: "Revision" },
      { key: "discipline", label: "Discipline" },
      { key: "drawing_set", label: "Drawing Set" },
      { key: "drawing_date", label: "Drawing Date", format: "date" },
      { key: "received_date", label: "Received", format: "date" },
      { key: "page_number", label: "Page #" },
      { key: "updated_at", label: "Updated", format: "date" },
    ],
  },
  {
    label: "Drawing Markup Link",
    source: "drawing-markup-links",
    fields: [
      { key: "drawing_no", label: "Drawing #" },
      { key: "markup_label", label: "Markup" },
      { key: "linked_type", label: "Linked Type" },
      { key: "linked_record", label: "Linked Record" },
      { key: "created_by", label: "Created By" },
      { key: "created_at", label: "Created", format: "date" },
    ],
  },
  {
    label: "External RFI",
    source: "external-rfis",
    fields: [
      { key: "transmittal_number", label: "Transmittal #" },
      { key: "subject", label: "Subject" },
      { key: "sent_to", label: "Sent To" },
      { key: "sent_via", label: "Sent Via" },
      { key: "sent_date", label: "Sent Date", format: "date" },
      { key: "due_by_date", label: "Due By", format: "date" },
      { key: "status", label: "Status" },
    ],
  },
  {
    label: "External RFI Response",
    source: "external-rfi-responses",
    fields: [
      { key: "transmittal_number", label: "Transmittal #" },
      { key: "responder", label: "Responder" },
      { key: "company", label: "Company" },
      { key: "response", label: "Response" },
      { key: "received_date", label: "Received", format: "date" },
    ],
  },
  {
    label: "Folder/Document",
    source: "documents",
    fields: [
      { key: "name", label: "Name" },
      { key: "type", label: "Type" },
      { key: "mime_type", label: "Mime Type" },
      { key: "size", label: "Size" },
      { key: "parent_name", label: "Parent Folder" },
      { key: "created_by", label: "Created By" },
      { key: "created_at", label: "Created", format: "date" },
    ],
  },
  {
    label: "Folder/Document Watcher",
    source: "document-watchers",
    fields: [
      { key: "document_name", label: "Document" },
      { key: "user_name", label: "Watcher" },
      { key: "user_email", label: "Email" },
      { key: "created_at", label: "Added", format: "date" },
    ],
  },
  {
    label: "Locations",
    source: "locations",
    fields: [
      { key: "name", label: "Name" },
      { key: "path", label: "Path" },
      { key: "parent_name", label: "Parent" },
      { key: "created_by", label: "Created By" },
      { key: "created_at", label: "Created", format: "date" },
      { key: "updated_at", label: "Updated", format: "date" },
    ],
  },
  {
    label: "Meeting",
    source: "meetings",
    fields: [
      { key: "meeting_number", label: "#" },
      { key: "title", label: "Title" },
      { key: "series", label: "Series" },
      { key: "date", label: "Date", format: "date" },
      { key: "end_date", label: "End Date", format: "date" },
      { key: "location", label: "Location" },
      { key: "status", label: "Status" },
      { key: "is_private", label: "Private" },
      { key: "created_by", label: "Created By" },
    ],
  },
  {
    label: "Meeting Attendee",
    source: "meeting-attendees",
    fields: [
      { key: "meeting_number", label: "Meeting #" },
      { key: "attendee_name", label: "Attendee" },
      { key: "company", label: "Company" },
      { key: "email", label: "Email" },
      { key: "attended", label: "Attended" },
    ],
  },
  {
    label: "Meeting Item",
    source: "meeting-items",
    fields: [
      { key: "meeting_number", label: "Meeting #" },
      { key: "item_number", label: "Item #" },
      { key: "title", label: "Title" },
      { key: "status", label: "Status" },
      { key: "due_date", label: "Due Date", format: "date" },
      { key: "notes", label: "Notes" },
    ],
  },
  {
    label: "Meeting Item Assignee",
    source: "meeting-item-assignees",
    fields: [
      { key: "meeting_number", label: "Meeting #" },
      { key: "item_number", label: "Item #" },
      { key: "assignee_name", label: "Assignee" },
      { key: "company", label: "Company" },
      { key: "email", label: "Email" },
    ],
  },
  {
    label: "Photo",
    source: "photos",
    fields: [
      { key: "filename", label: "Filename" },
      { key: "caption", label: "Caption" },
      { key: "album", label: "Album" },
      { key: "location", label: "Location" },
      { key: "uploaded_by_name", label: "Uploaded By" },
      { key: "uploaded_at", label: "Uploaded", format: "date" },
    ],
  },
  {
    label: "Punch Item",
    source: "punch-items",
    fields: [
      { key: "item_number", label: "#" },
      { key: "title", label: "Title" },
      { key: "status", label: "Status" },
      { key: "type", label: "Type" },
      { key: "priority", label: "Priority" },
      { key: "trade", label: "Trade" },
      { key: "location", label: "Location" },
      { key: "due_date", label: "Due Date", format: "date" },
      { key: "schedule_impact", label: "Schedule Impact" },
      { key: "cost_impact", label: "Cost Impact" },
      { key: "private", label: "Private" },
      { key: "created_at", label: "Created", format: "date" },
    ],
  },
  {
    label: "Punch Item Activity",
    source: "punch-item-activity",
    fields: [
      { key: "item_number", label: "Punch #" },
      { key: "action", label: "Action" },
      { key: "from_value", label: "From" },
      { key: "to_value", label: "To" },
      { key: "user_name", label: "User" },
      { key: "created_at", label: "When", format: "date" },
    ],
  },
  {
    label: "Punch Item Assignee",
    source: "punch-item-assignees",
    fields: [
      { key: "item_number", label: "Punch #" },
      { key: "assignee_name", label: "Assignee" },
      { key: "company", label: "Company" },
      { key: "email", label: "Email" },
    ],
  },
  {
    label: "Punch Item Ball in Court",
    source: "punch-item-ball-in-court",
    fields: [
      { key: "item_number", label: "Punch #" },
      { key: "holder_name", label: "Ball in Court" },
      { key: "company", label: "Company" },
      { key: "assigned_at", label: "Assigned", format: "date" },
    ],
  },
  {
    label: "Punch Item Distribution Member",
    source: "punch-item-distribution-members",
    fields: [
      { key: "item_number", label: "Punch #" },
      { key: "member_name", label: "Member" },
      { key: "company", label: "Company" },
      { key: "email", label: "Email" },
    ],
  },
  {
    label: "RFI",
    source: "rfis",
    fields: [
      { key: "rfi_number", label: "#" },
      { key: "subject", label: "Subject" },
      { key: "status", label: "Status" },
      { key: "rfi_stage", label: "Stage" },
      { key: "due_date", label: "Due Date", format: "date" },
      { key: "rfi_manager", label: "RFI Manager" },
      { key: "received_from", label: "Received From" },
      { key: "specification", label: "Specification" },
      { key: "drawing_number", label: "Drawing #" },
      { key: "cost_code", label: "Cost Code" },
      { key: "schedule_impact", label: "Schedule Impact" },
      { key: "cost_impact", label: "Cost Impact" },
      { key: "private", label: "Private" },
      { key: "created_at", label: "Created", format: "date" },
    ],
  },
  {
    label: "RFI Assignee",
    source: "rfi-assignees",
    fields: [
      { key: "rfi_number", label: "RFI #" },
      { key: "assignee_name", label: "Assignee" },
      { key: "company", label: "Company" },
      { key: "email", label: "Email" },
    ],
  },
  {
    label: "RFI Ball in Court",
    source: "rfi-ball-in-court",
    fields: [
      { key: "rfi_number", label: "RFI #" },
      { key: "holder_name", label: "Ball in Court" },
      { key: "company", label: "Company" },
      { key: "assigned_at", label: "Assigned", format: "date" },
    ],
  },
  {
    label: "RFI Distribution List",
    source: "rfi-distribution-list",
    fields: [
      { key: "rfi_number", label: "RFI #" },
      { key: "member_name", label: "Member" },
      { key: "company", label: "Company" },
      { key: "email", label: "Email" },
    ],
  },
  {
    label: "RFI Response",
    source: "rfi-responses",
    fields: [
      { key: "rfi_number", label: "RFI #" },
      { key: "responder", label: "Responder" },
      { key: "company", label: "Company" },
      { key: "response", label: "Response" },
      { key: "official", label: "Official" },
      { key: "created_at", label: "Submitted", format: "date" },
    ],
  },
  {
    label: "Schedule Calendar Item",
    source: "schedule-calendar-items",
    legacy: true,
    fields: [
      { key: "title", label: "Title" },
      { key: "calendar", label: "Calendar" },
      { key: "start_date", label: "Start", format: "date" },
      { key: "end_date", label: "End", format: "date" },
      { key: "notes", label: "Notes" },
    ],
  },
  {
    label: "Schedule Lookahead",
    source: "schedule-lookaheads",
    legacy: true,
    fields: [
      { key: "name", label: "Name" },
      { key: "start_date", label: "Start", format: "date" },
      { key: "end_date", label: "End", format: "date" },
      { key: "created_by", label: "Created By" },
      { key: "created_at", label: "Created", format: "date" },
    ],
  },
  {
    label: "Schedule Lookahead Task",
    source: "schedule-lookahead-tasks",
    legacy: true,
    fields: [
      { key: "lookahead_name", label: "Lookahead" },
      { key: "task_name", label: "Task" },
      { key: "responsible", label: "Responsible" },
      { key: "start_date", label: "Start", format: "date" },
      { key: "finish_date", label: "Finish", format: "date" },
      { key: "percent_complete", label: "% Complete" },
    ],
  },
  {
    label: "Schedule Task",
    source: "schedule-tasks",
    legacy: true,
    fields: [
      { key: "task_id", label: "Task ID" },
      { key: "name", label: "Name" },
      { key: "start_date", label: "Start", format: "date" },
      { key: "finish_date", label: "Finish", format: "date" },
      { key: "duration", label: "Duration" },
      { key: "percent_complete", label: "% Complete" },
      { key: "assigned_to", label: "Assigned To" },
    ],
  },
  {
    label: "Schedule Task Change",
    source: "schedule-task-changes",
    legacy: true,
    fields: [
      { key: "task_id", label: "Task ID" },
      { key: "field", label: "Field" },
      { key: "from_value", label: "From" },
      { key: "to_value", label: "To" },
      { key: "user_name", label: "User" },
      { key: "changed_at", label: "Changed", format: "date" },
    ],
  },
  {
    label: "Schedule Task Request",
    source: "schedule-task-requests",
    legacy: true,
    fields: [
      { key: "task_id", label: "Task ID" },
      { key: "request_type", label: "Request Type" },
      { key: "requested_by", label: "Requested By" },
      { key: "status", label: "Status" },
      { key: "requested_at", label: "Requested", format: "date" },
    ],
  },
  {
    label: "Specification Section",
    source: "specification-sections",
    fields: [
      { key: "code", label: "Code" },
      { key: "name", label: "Name" },
      { key: "division", label: "Division" },
      { key: "set_name", label: "Spec Set" },
      { key: "revision", label: "Revision" },
      { key: "created_at", label: "Created", format: "date" },
    ],
  },
  {
    label: "Submittal",
    source: "submittals",
    fields: [
      { key: "submittal_number", label: "#" },
      { key: "revision", label: "Revision" },
      { key: "title", label: "Title" },
      { key: "submittal_type", label: "Type" },
      { key: "status", label: "Status" },
      { key: "specification", label: "Specification" },
      { key: "responsible_contractor", label: "Responsible Contractor" },
      { key: "received_from", label: "Received From" },
      { key: "submittal_manager", label: "Submittal Manager" },
      { key: "submit_by", label: "Submit By", format: "date" },
      { key: "received_date", label: "Received", format: "date" },
      { key: "issue_date", label: "Issue Date", format: "date" },
      { key: "final_due_date", label: "Final Due", format: "date" },
      { key: "required_on_site_date", label: "Required On-Site", format: "date" },
      { key: "lead_time", label: "Lead Time" },
      { key: "cost_code", label: "Cost Code" },
      { key: "private", label: "Private" },
    ],
  },
  {
    label: "Submittal Approver",
    source: "submittal-approvers",
    fields: [
      { key: "submittal_number", label: "Submittal #" },
      { key: "approver_name", label: "Approver" },
      { key: "company", label: "Company" },
      { key: "response", label: "Response" },
      { key: "due_date", label: "Due Date", format: "date" },
      { key: "responded_at", label: "Responded", format: "date" },
    ],
  },
  {
    label: "Submittal Ball In Court",
    source: "submittal-ball-in-court",
    fields: [
      { key: "submittal_number", label: "Submittal #" },
      { key: "holder_name", label: "Ball in Court" },
      { key: "company", label: "Company" },
      { key: "assigned_at", label: "Assigned", format: "date" },
    ],
  },
  {
    label: "Submittal Distribution List",
    source: "submittal-distribution-list",
    fields: [
      { key: "submittal_number", label: "Submittal #" },
      { key: "member_name", label: "Member" },
      { key: "company", label: "Company" },
      { key: "email", label: "Email" },
    ],
  },
  {
    label: "Task",
    source: "tasks",
    fields: [
      { key: "task_number", label: "#" },
      { key: "title", label: "Title" },
      { key: "status", label: "Status" },
      { key: "category", label: "Category" },
      { key: "description", label: "Description" },
      { key: "created_by", label: "Created By" },
      { key: "created_at", label: "Created", format: "date" },
    ],
  },
  {
    label: "Task Activity",
    source: "task-activity",
    fields: [
      { key: "task_number", label: "Task #" },
      { key: "action", label: "Action" },
      { key: "from_value", label: "From" },
      { key: "to_value", label: "To" },
      { key: "user_name", label: "User" },
      { key: "created_at", label: "When", format: "date" },
    ],
  },
  {
    label: "Task Assignee",
    source: "task-assignees",
    fields: [
      { key: "task_number", label: "Task #" },
      { key: "assignee_name", label: "Assignee" },
      { key: "company", label: "Company" },
      { key: "email", label: "Email" },
    ],
  },
  {
    label: "Task Distribution Member",
    source: "task-distribution-members",
    fields: [
      { key: "task_number", label: "Task #" },
      { key: "member_name", label: "Member" },
      { key: "company", label: "Company" },
      { key: "email", label: "Email" },
    ],
  },
  {
    label: "Timecard Entry",
    source: "timecard-entries",
    fields: [
      { key: "work_date", label: "Work Date", format: "date" },
      { key: "resource_name", label: "Resource" },
      { key: "resource_type", label: "Resource Type" },
      { key: "start_time", label: "Start", format: "date" },
      { key: "stop_time", label: "Stop", format: "date" },
      { key: "lunch_minutes", label: "Lunch (min)" },
      { key: "total_hours", label: "Total Hours" },
      { key: "time_type", label: "Time Type" },
      { key: "billable", label: "Billable" },
      { key: "cost_code", label: "Cost Code" },
      { key: "cost_type", label: "Cost Type" },
      { key: "location_path", label: "Location" },
      { key: "description", label: "Description" },
      { key: "status", label: "Status" },
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
  {
    label: "Project",
    source: "project",
    fields: [
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
    ],
  },
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
  {
    label: "Project Roles",
    source: "project-roles",
    fields: [
      { key: "contact_name", label: "Contact Name" },
      { key: "contact_type", label: "Contact Type" },
      { key: "count", label: "Count", format: "number" },
      { key: "date_updated", label: "Date Updated", format: "date" },
      { key: "employee_id", label: "Employee ID" },
      { key: "group", label: "Group" },
      { key: "id", label: "ID" },
      { key: "role_name", label: "Role Name" },
    ],
  },
];

const CATEGORIES_BY_TAB: Record<string, CategoryDef[]> = {
  "Directory & Portfolio": DIRECTORY_AND_PORTFOLIO_CATEGORIES,
  Financials: FINANCIALS_CATEGORIES,
  "Project Execution": PROJECT_EXECUTION_CATEGORIES,
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

  if (source === "commitment-change-orders") {
    const res = await fetch(`/api/projects/${projectId}/change-orders?type=commitment`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
  }

  // ── Directory & Portfolio ────────────────────────────────────────────────
  if (source === "companies") {
    const res = await fetch(`/api/projects/${projectId}/directory`);
    if (!res.ok) return [];
    const contacts: Row[] = await res.json();
    return (contacts ?? [])
      .filter((c) => c.type === "company")
      .map((c) => ({
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
      id: p.id,
      name: p.name,
      number: p.project_number,
      code: p.project_number,
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
        rfi_number: r.rfi_number,
        subject: r.subject,
        status: r.status,
        rfi_stage: r.rfi_stage,
        due_date: r.due_date,
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
        submittal_number: s.submittal_number,
        revision: s.revision,
        title: s.title,
        submittal_type: s.submittal_type,
        status: s.status,
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
        item_number: p.item_number,
        title: p.title,
        status: p.status,
        type: p.type,
        priority: p.priority,
        trade: p.trade,
        location: p.location,
        due_date: p.due_date,
        schedule_impact: p.schedule_impact,
        cost_impact: p.cost_impact,
        private: p.private,
        created_at: p.created_at,
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
        task_number: t.task_number,
        title: t.title,
        status: t.status,
        category: t.category,
        description: t.description,
        created_by: t.created_by_name ?? t.created_by,
        created_at: t.created_at,
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
        meeting_number: m.meeting_number,
        title: m.title,
        series: m.series,
        date: m.date,
        end_date: m.end_date,
        location: m.location,
        status: m.status,
        is_private: m.is_private,
        created_by: m.created_by_name ?? m.created_by,
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
      drawing_no: d.drawing_no,
      title: d.title,
      revision: d.revision,
      discipline: d.discipline,
      drawing_set: d.drawing_set ?? d.set_name,
      drawing_date: d.drawing_date,
      received_date: d.received_date,
      page_number: d.page_number,
      updated_at: d.updated_at,
    }));
  }

  // Documents
  if (source === "documents") {
    const res = await fetch(`/api/projects/${projectId}/documents`);
    if (!res.ok) return [];
    const data: Row[] = await res.json();
    return (data ?? []).map((d) => ({
      name: d.name,
      type: d.type,
      mime_type: d.mime_type,
      size: d.size,
      parent_name: d.parent_name ?? d.parent_id,
      created_by: d.created_by_name ?? d.created_by,
      created_at: d.created_at,
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

  // Unknown / not-yet-backed source — render an empty table.
  return [];
}
