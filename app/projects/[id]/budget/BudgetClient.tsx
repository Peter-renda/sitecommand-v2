"use client";

import { Fragment, useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import ProjectNav from "@/components/ProjectNav";
import { SkeletonTable } from "@/app/components/Skeleton";
import * as XLSX from "xlsx";

// ── Types ─────────────────────────────────────────────────────────────────────

type BudgetLineItem = {
  id: string;
  project_id: string;
  cost_code: string;
  cost_type: string;
  description: string;
  manual_calculation: boolean;
  unit_qty: number;
  unit_of_measure: string;
  unit_cost: number;
  original_budget_amount: number;
  budget_modifications: number;
  approved_cos: number;
  pending_budget_changes: number;
  committed_costs: number;
  job_to_date_costs: number;
  commitments_invoiced: number;
  pending_cost_changes: number;
  start_date: string | null;
  end_date: string | null;
  curve: string;
  is_partial_line_item?: boolean;
  is_gst_line_item?: boolean;
  sort_order: number;
  created_at: string;
};

type BudgetSnapshot = {
  id: string;
  name: string;
  created_at: string;
  status?: "Draft" | "Under Review" | "Approved" | "Archived";
  snapshot_data?: BudgetLineItem[];
};

type CommitmentSovRow = {
  id: string;
  description: string;
  qty: number;
  uom: string;
  unit_cost: number;
  amount: number;
};

type CommitmentSummary = {
  id: string;
  type: "subcontract" | "purchase_order";
  number: number;
  title: string;
  contract_company: string;
  total_amount: number;
  lines: CommitmentSovRow[];
};

type CommitmentChangeOrderSummary = {
  id: string;
  number: string;
  title: string;
  contract_company: string;
  amount: number;
  commitment_id: string | null;
};

type CommittedCostsDetail = {
  cost_code: string;
  subcontracts: CommitmentSummary[];
  purchase_orders: CommitmentSummary[];
  commitment_change_orders: CommitmentChangeOrderSummary[];
};

type ForecastMethod = "automatic" | "manual" | "lump_sum" | "monitored_resources";

type ForecastEdit = {
  method: ForecastMethod;
  amount: number | null;
  notes: string;
};

type ModificationRow = {
  id: string;
  fromId: string;
  toId: string;
  amount: string;
  notes: string;
};

type BudgetDetailRow = {
  id: string;
  cost_code: string;
  cost_code_tier_1: string;
  cost_code_tier_2: string;
  cost_type: string;
  budget_description: string;
  vendor: string;
  item: string;
  description: string;
  detail_type: string;
  original_budget_amount: number | null;
  budget_modifications: number | null;
  approved_cos: number | null;
  pending_budget_changes: number | null;
  committed_costs: number | null;
  job_to_date_costs: number | null;
  pending_cost_changes: number | null;
  forecast_to_complete: number | null;
};

type GroupByKey = "cost_code_tier_1" | "cost_code_tier_2" | "cost_type" | "vendor" | "detail_type";
type FilterKey = "cost_code" | "cost_type" | "vendor" | "detail_type";

type ForecastingViewTemplate = {
  id: string;
  name: string;
  company_id: string;
  created_at: string;
};

type ForecastGroupByKey = "sub_job" | "cost_code_part_1" | "cost_code_part_2";
type ForecastFilterKey = "cost_code" | "description" | "cost_type" | "sub_job";
type SnapshotVarianceMode = "comparison_and_variance" | "comparison_only" | "variance_only";

// ── Calculated helpers ────────────────────────────────────────────────────────

function calc(item: BudgetLineItem) {
  const revisedBudget =
    item.original_budget_amount + item.budget_modifications + item.approved_cos;
  const projectedBudget = revisedBudget + item.pending_budget_changes;
  const directCosts = item.job_to_date_costs - item.commitments_invoiced;
  const projectedCosts = item.committed_costs + directCosts + item.pending_cost_changes;
  const forecastToComplete = Math.max(0, projectedBudget - projectedCosts);
  const estimatedCostAtCompletion = projectedCosts + forecastToComplete;
  const projectedOverUnder = projectedBudget - estimatedCostAtCompletion;
  return {
    revisedBudget,
    projectedBudget,
    directCosts,
    projectedCosts,
    forecastToComplete,
    estimatedCostAtCompletion,
    projectedOverUnder,
  };
}

function sumItems(items: BudgetLineItem[]) {
  const totals = {
    original_budget_amount: 0,
    budget_modifications: 0,
    approved_cos: 0,
    pending_budget_changes: 0,
    committed_costs: 0,
    job_to_date_costs: 0,
    commitments_invoiced: 0,
    pending_cost_changes: 0,
    revisedBudget: 0,
    projectedBudget: 0,
    directCosts: 0,
    projectedCosts: 0,
    forecastToComplete: 0,
    estimatedCostAtCompletion: 0,
    projectedOverUnder: 0,
  };
  for (const item of items) {
    const c = calc(item);
    totals.original_budget_amount += item.original_budget_amount;
    totals.budget_modifications += item.budget_modifications;
    totals.approved_cos += item.approved_cos;
    totals.pending_budget_changes += item.pending_budget_changes;
    totals.committed_costs += item.committed_costs;
    totals.job_to_date_costs += item.job_to_date_costs;
    totals.commitments_invoiced += item.commitments_invoiced;
    totals.pending_cost_changes += item.pending_cost_changes;
    totals.revisedBudget += c.revisedBudget;
    totals.projectedBudget += c.projectedBudget;
    totals.directCosts += c.directCosts;
    totals.projectedCosts += c.projectedCosts;
    totals.forecastToComplete += c.forecastToComplete;
    totals.estimatedCostAtCompletion += c.estimatedCostAtCompletion;
    totals.projectedOverUnder += c.projectedOverUnder;
  }
  return totals;
}

function fmt(n: number): string {
  const abs = Math.abs(n);
  const formatted = abs.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return n < 0 ? `($${formatted})` : `$${formatted}`;
}

function fmtWithArrow(n: number): string {
  const abs = Math.abs(n);
  const formatted = abs.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const arrow = n >= 0 ? "↑" : "↓";
  return n < 0 ? `${arrow} ($${formatted})` : `${arrow} $${formatted}`;
}

function parseCostCodeTiers(code: string | null | undefined) {
  const raw = (code ?? "").trim();
  if (!raw) return { tier1: "None", tier2: "None" };
  const beforeDot = raw.split(".")[0] ?? raw;
  const tier1 = beforeDot.split("-")[0] ?? beforeDot;
  return {
    tier1: tier1 || "None",
    tier2: beforeDot || "None",
  };
}

function calcWithForecastOverride(item: BudgetLineItem, overrideAmount?: number | null) {
  const base = calc(item);
  if (overrideAmount === undefined || overrideAmount === null) {
    return base;
  }
  const forecastToComplete = Math.max(0, overrideAmount);
  const estimatedCostAtCompletion = base.projectedCosts + forecastToComplete;
  const projectedOverUnder = base.projectedBudget - estimatedCostAtCompletion;
  return {
    ...base,
    forecastToComplete,
    estimatedCostAtCompletion,
    projectedOverUnder,
  };
}

// ── PDF Export ────────────────────────────────────────────────────────────────

function exportPDF(items: BudgetLineItem[], forecastEdits: Record<string, ForecastEdit>) {
  const totals = items.reduce(
    (acc, item) => {
      const edit = forecastEdits[item.id];
      const useOverride = edit && (edit.method === "manual" || edit.method === "lump_sum");
      const c = calcWithForecastOverride(item, useOverride ? edit.amount : null);
      acc.original_budget_amount += item.original_budget_amount;
      acc.budget_modifications += item.budget_modifications;
      acc.approved_cos += item.approved_cos;
      acc.pending_budget_changes += item.pending_budget_changes;
      acc.committed_costs += item.committed_costs;
      acc.job_to_date_costs += item.job_to_date_costs;
      acc.commitments_invoiced += item.commitments_invoiced;
      acc.pending_cost_changes += item.pending_cost_changes;
      acc.revisedBudget += c.revisedBudget;
      acc.projectedBudget += c.projectedBudget;
      acc.directCosts += c.directCosts;
      acc.projectedCosts += c.projectedCosts;
      acc.forecastToComplete += c.forecastToComplete;
      acc.estimatedCostAtCompletion += c.estimatedCostAtCompletion;
      acc.projectedOverUnder += c.projectedOverUnder;
      return acc;
    },
    sumItems([])
  );

  const headerRow = `
    <tr>
      <th>Description</th>
      <th>Original Budget</th>
      <th>Budget Mods</th>
      <th>Approved COs</th>
      <th>Revised Budget</th>
      <th>Pending Budget Changes</th>
      <th>Projected Budget</th>
      <th>Committed Costs</th>
      <th>Direct Costs</th>
      <th>Job to Date</th>
      <th>Pending Cost Changes</th>
      <th>Projected Costs</th>
      <th>Forecast to Complete</th>
      <th>Est. Cost at Completion</th>
      <th>Projected Over/Under</th>
    </tr>`;

  const totalRow = () => {
    return `<tr style="font-weight:bold;background:#f9fafb;">
      <td>Total</td>
      <td>${fmt(totals.original_budget_amount)}</td>
      <td>${fmt(totals.budget_modifications)}</td>
      <td>${fmt(totals.approved_cos)}</td>
      <td>${fmt(totals.revisedBudget)}</td>
      <td>${fmt(totals.pending_budget_changes)}</td>
      <td>${fmt(totals.projectedBudget)}</td>
      <td>${fmt(totals.committed_costs)}</td>
      <td>${fmt(totals.directCosts)}</td>
      <td>${fmt(totals.job_to_date_costs)}</td>
      <td>${fmt(totals.pending_cost_changes)}</td>
      <td>${fmt(totals.projectedCosts)}</td>
      <td>${fmt(totals.forecastToComplete)}</td>
      <td>${fmt(totals.estimatedCostAtCompletion)}</td>
      <td style="color:${totals.projectedOverUnder >= 0 ? "inherit" : "#dc2626"}">${fmt(totals.projectedOverUnder)}</td>
    </tr>`;
  };

  const rows = items
    .map((item) => {
      const edit = forecastEdits[item.id];
      const useOverride = edit && (edit.method === "manual" || edit.method === "lump_sum");
      const c = calcWithForecastOverride(item, useOverride ? edit.amount : null);
      return `<tr>
        <td>
          <strong>${item.cost_code}</strong><br/>
          <span style="color:#6b7280">${item.description}</span>
        </td>
        <td>${fmt(item.original_budget_amount)}</td>
        <td>${fmt(item.budget_modifications)}</td>
        <td>${fmt(item.approved_cos)}</td>
        <td>${fmt(c.revisedBudget)}</td>
        <td>${fmt(item.pending_budget_changes)}</td>
        <td>${fmt(c.projectedBudget)}</td>
        <td>${fmt(item.committed_costs)}</td>
        <td>${fmt(c.directCosts)}</td>
        <td>${fmt(item.job_to_date_costs)}</td>
        <td>${fmt(item.pending_cost_changes)}</td>
        <td>${fmt(c.projectedCosts)}</td>
        <td>${fmt(c.forecastToComplete)}</td>
        <td>${fmt(c.estimatedCostAtCompletion)}</td>
        <td style="color:${c.projectedOverUnder >= 0 ? "inherit" : "#dc2626"}">${fmt(c.projectedOverUnder)}</td>
      </tr>`;
    })
    .join("");

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Budget</title>
    <style>
      body { font-family: Arial, sans-serif; font-size: 9px; padding: 20px; }
      h1 { font-size: 14px; margin-bottom: 12px; }
      table { width: 100%; border-collapse: collapse; }
      th { background: #f3f4f6; text-align: left; padding: 5px 6px; font-size: 8px; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; border-bottom: 1px solid #e5e7eb; }
      td { padding: 5px 6px; border-bottom: 1px solid #f3f4f6; vertical-align: top; }
      tr:last-child td { border-bottom: none; }
      @media print { body { padding: 0; } }
    </style></head><body>
    <h1>Budget</h1>
    <table><thead>${headerRow}</thead><tbody>${totalRow()}${rows}</tbody></table>
    </body></html>`;

  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 300);
}

// ── New Line Item Modal ───────────────────────────────────────────────────────

type LineItemFormData = {
  cost_code: string;
  cost_type: string;
  description: string;
  manual_calculation: boolean;
  unit_qty: string;
  unit_of_measure: string;
  unit_cost: string;
  original_budget_amount: string;
  budget_modifications: string;
  approved_cos: string;
  pending_budget_changes: string;
  committed_costs: string;
  job_to_date_costs: string;
  commitments_invoiced: string;
  pending_cost_changes: string;
  start_date: string;
  end_date: string;
  curve: string;
  is_partial_line_item: boolean;
  is_gst_line_item: boolean;
};

const emptyForm: LineItemFormData = {
  cost_code: "",
  cost_type: "",
  description: "",
  manual_calculation: true,
  unit_qty: "",
  unit_of_measure: "",
  unit_cost: "",
  original_budget_amount: "",
  budget_modifications: "",
  approved_cos: "",
  pending_budget_changes: "",
  committed_costs: "",
  job_to_date_costs: "",
  commitments_invoiced: "",
  pending_cost_changes: "",
  start_date: "",
  end_date: "",
  curve: "Linear",
  is_partial_line_item: false,
  is_gst_line_item: false,
};

function numVal(s: string): number {
  const n = parseFloat(s.replace(/[^0-9.-]/g, ""));
  return isNaN(n) ? 0 : n;
}

function readString(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function readNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return numVal(value);
  return 0;
}

function readBool(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const lower = value.trim().toLowerCase();
    return lower === "true" || lower === "yes" || lower === "1";
  }
  return false;
}

function readDate(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) return value.toISOString().split("T")[0];
  if (typeof value === "number") {
    // Excel 1900 date serial → JS timestamp
    const ms = Math.round((value - 25569) * 86400 * 1000);
    const d = new Date(ms);
    if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const d = new Date(trimmed);
    return isNaN(d.getTime()) ? trimmed : d.toISOString().split("T")[0];
  }
  return null;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      {children}
    </div>
  );
}

function MoneyInput({
  value,
  onChange,
  placeholder,
  disabled = false,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <input
      type="text"
      inputMode="decimal"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder ?? "0.00"}
      disabled={disabled}
      className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed"
    />
  );
}

function LineItemModal({
  initial,
  defaults,
  lockOriginalBudgetAmount = false,
  onConfirm,
  onCancel,
}: {
  initial?: BudgetLineItem;
  defaults?: Partial<LineItemFormData>;
  lockOriginalBudgetAmount?: boolean;
  onConfirm: (data: LineItemFormData) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<LineItemFormData>(
    initial
      ? {
          cost_code: initial.cost_code,
          cost_type: initial.cost_type,
          description: initial.description,
          manual_calculation: Boolean(initial.manual_calculation),
          unit_qty: initial.unit_qty !== 0 ? String(initial.unit_qty) : "",
          unit_of_measure: initial.unit_of_measure || "",
          unit_cost: initial.unit_cost !== 0 ? String(initial.unit_cost) : "",
          original_budget_amount: initial.original_budget_amount !== 0 ? String(initial.original_budget_amount) : "",
          budget_modifications: initial.budget_modifications !== 0 ? String(initial.budget_modifications) : "",
          approved_cos: initial.approved_cos !== 0 ? String(initial.approved_cos) : "",
          pending_budget_changes: initial.pending_budget_changes !== 0 ? String(initial.pending_budget_changes) : "",
          committed_costs: initial.committed_costs !== 0 ? String(initial.committed_costs) : "",
          job_to_date_costs: initial.job_to_date_costs !== 0 ? String(initial.job_to_date_costs) : "",
          commitments_invoiced: initial.commitments_invoiced !== 0 ? String(initial.commitments_invoiced) : "",
          pending_cost_changes: initial.pending_cost_changes !== 0 ? String(initial.pending_cost_changes) : "",
          start_date: initial.start_date || "",
          end_date: initial.end_date || "",
          curve: initial.curve || "Linear",
          is_partial_line_item: Boolean(initial.is_partial_line_item),
          is_gst_line_item: Boolean(initial.is_gst_line_item),
        }
      : { ...emptyForm, ...defaults }
  );

  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  function set(key: keyof LineItemFormData, val: string | boolean) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.cost_code.trim() || !form.cost_type.trim()) return;
    onConfirm(form);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div ref={ref} className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">
            {initial ? "Edit Budget Line Item" : "Add Budget Line Item"}
          </h2>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-700 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Cost Code">
              <input
                type="text"
                value={form.cost_code}
                onChange={(e) => set("cost_code", e.target.value)}
                placeholder="e.g. 01-030.C"
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </Field>
            <Field label="Cost Type">
              <input
                type="text"
                value={form.cost_type}
                onChange={(e) => set("cost_type", e.target.value)}
                placeholder="e.g. Labor or Other"
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Description">
              <input
                type="text"
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="e.g. Workmen's Facility.Contract"
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Manual Calculation">
              <select
                value={form.manual_calculation ? "true" : "false"}
                onChange={(e) => set("manual_calculation", e.target.value === "true")}
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              >
                <option value="true">True (enter Original Budget Amount manually)</option>
                <option value="false">False (calculate from Unit Qty × Unit Cost)</option>
              </select>
            </Field>
            <Field label="Unit of Measure">
              <input
                type="text"
                value={form.unit_of_measure}
                onChange={(e) => set("unit_of_measure", e.target.value)}
                placeholder="e.g. HR, EA, SF"
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </Field>
            <Field label="Budget Unit Qty">
              <MoneyInput value={form.unit_qty} onChange={(v) => set("unit_qty", v)} />
            </Field>
            <Field label="Unit Cost">
              <MoneyInput value={form.unit_cost} onChange={(v) => set("unit_cost", v)} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <label className="flex items-start gap-2 text-xs text-gray-600">
              <input
                type="checkbox"
                checked={form.is_partial_line_item}
                onChange={(e) => set("is_partial_line_item", e.target.checked)}
                className="mt-0.5"
              />
              <span>
                <span className="block font-medium text-gray-700">Partial budget line item</span>
                Adds an unbudgeted line item with $0 original amount for missing budget code combinations.
              </span>
            </label>
            <label className="flex items-start gap-2 text-xs text-gray-600">
              <input
                type="checkbox"
                checked={form.is_gst_line_item}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setForm((prev) => ({
                    ...prev,
                    is_gst_line_item: checked,
                    cost_type: checked ? "Other" : prev.cost_type,
                  }));
                }}
                className="mt-0.5"
              />
              <span>
                <span className="block font-medium text-gray-700">GST line item</span>
                Marks this line for GST tracking and defaults cost type to &quot;Other&quot;.
              </span>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Original Budget Amount">
              <MoneyInput
                value={form.original_budget_amount}
                onChange={(v) => set("original_budget_amount", v)}
                disabled={lockOriginalBudgetAmount || form.is_partial_line_item}
              />
              {(lockOriginalBudgetAmount || form.is_partial_line_item) && (
                <p className="mt-1 text-[11px] text-gray-500">
                  {form.is_partial_line_item
                    ? "Partial budget line items are created with a $0 Original Budget Amount."
                    : "Original Budget Amount is locked for this budget."}
                </p>
              )}
            </Field>
            <Field label="Budget Modifications">
              <MoneyInput value={form.budget_modifications} onChange={(v) => set("budget_modifications", v)} />
            </Field>
            <Field label="Approved Change Orders">
              <MoneyInput value={form.approved_cos} onChange={(v) => set("approved_cos", v)} />
            </Field>
            <Field label="Pending Budget Changes">
              <MoneyInput value={form.pending_budget_changes} onChange={(v) => set("pending_budget_changes", v)} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Committed Costs">
              <MoneyInput value={form.committed_costs} onChange={(v) => set("committed_costs", v)} />
            </Field>
            <Field label="ERP Job to Date Costs">
              <MoneyInput value={form.job_to_date_costs} onChange={(v) => set("job_to_date_costs", v)} />
            </Field>
            <Field label="Commitments Invoiced">
              <MoneyInput value={form.commitments_invoiced} onChange={(v) => set("commitments_invoiced", v)} />
            </Field>
            <Field label="Pending Cost Changes">
              <MoneyInput value={form.pending_cost_changes} onChange={(v) => set("pending_cost_changes", v)} />
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Field label="Start Date">
              <input
                type="date"
                value={form.start_date}
                onChange={(e) => set("start_date", e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </Field>
            <Field label="End Date">
              <input
                type="date"
                value={form.end_date}
                onChange={(e) => set("end_date", e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </Field>
            <Field label="Curve">
              <select
                value={form.curve || "Linear"}
                onChange={(e) => set("curve", e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              >
                <option value="Linear">Linear</option>
                <option value="Bell">Bell</option>
                <option value="Front Loaded">Front Loaded</option>
                <option value="Back Loaded">Back Loaded</option>
                <option value="Manual">Manual</option>
              </select>
            </Field>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-md bg-white hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-md hover:bg-gray-700 transition-colors"
            >
              {initial ? "Save Changes" : "Add Line Item"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Snapshot Modal ────────────────────────────────────────────────────────────

function SnapshotModal({
  onConfirm,
  onCancel,
}: {
  onConfirm: (name: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(
    `Budget Snapshot – ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        <h2 className="text-base font-semibold text-gray-900">Create Budget Snapshot</h2>
        <p className="text-sm text-gray-500">
          Saves a read-only copy of the current budget for historical reference.
        </p>
        <Field label="Snapshot Name">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            autoFocus
          />
        </Field>
        <div className="flex justify-end gap-3 pt-1">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-md bg-white hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => name.trim() && onConfirm(name.trim())}
            className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-md hover:bg-gray-700 transition-colors"
          >
            Create Snapshot
          </button>
        </div>
      </div>
    </div>
  );
}

function BudgetChangeModal({
  items,
  onConfirm,
  onCancel,
}: {
  items: BudgetLineItem[];
  onConfirm: (payload: { itemId: string; amount: number }) => void;
  onCancel: () => void;
}) {
  const [itemId, setItemId] = useState(items[0]?.id ?? "");
  const [amount, setAmount] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!itemId) return;
    onConfirm({ itemId, amount: numVal(amount) });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-2xl">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Create Budget Change</h2>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-700 transition-colors" aria-label="Close">
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Budget Line Item</label>
            <select
              value={itemId}
              onChange={(e) => setItemId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            >
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.cost_code} — {item.description || "No description"}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Budget Change Amount</label>
            <MoneyInput value={amount} onChange={setAmount} />
            <p className="mt-1 text-[11px] text-gray-500">
              This updates the selected line item&apos;s Pending Budget Changes.
            </p>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-md bg-white hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-md hover:bg-gray-700 transition-colors"
            >
              Create Budget Change
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Budget Modification Modal ─────────────────────────────────────────────────

function BudgetModificationModal({
  items,
  onConfirm,
  onCancel,
}: {
  items: BudgetLineItem[];
  onConfirm: (rows: { fromId: string; toId: string; amount: number; notes: string }[]) => void;
  onCancel: () => void;
}) {
  function makeRow(): ModificationRow {
    return { id: Math.random().toString(36).slice(2), fromId: "", toId: "", amount: "", notes: "" };
  }

  const [rows, setRows] = useState<ModificationRow[]>(() => [makeRow(), makeRow(), makeRow(), makeRow()]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onCancel(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  function updateRow(id: string, updates: Partial<ModificationRow>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...updates } : r)));
  }

  function handleSubmit() {
    const validRows = rows
      .filter((r) => r.fromId && r.toId && numVal(r.amount) !== 0)
      .map((r) => ({ fromId: r.fromId, toId: r.toId, amount: numVal(r.amount), notes: r.notes }));
    if (validRows.length === 0) return;
    onConfirm(validRows);
  }

  const selectClass =
    "w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Create Budget Modifications</h2>
          <button onClick={onCancel} className="text-gray-500 hover:text-gray-900 text-xl leading-none" aria-label="Close">
            ×
          </button>
        </div>
        <div className="px-6 py-4">
          <div className="grid grid-cols-[1fr_1fr_160px_1fr_36px] gap-3 mb-2">
            <span className="text-xs font-medium text-gray-600">From</span>
            <span className="text-xs font-medium text-gray-600">To</span>
            <span className="text-xs font-medium text-gray-600">Transfer Amount</span>
            <span className="text-xs font-medium text-gray-600">Notes</span>
            <span />
          </div>
          <div className="space-y-2">
            {rows.map((row) => (
              <div key={row.id} className="grid grid-cols-[1fr_1fr_160px_1fr_36px] gap-3 items-center">
                <select
                  value={row.fromId}
                  onChange={(e) => updateRow(row.id, { fromId: e.target.value })}
                  className={selectClass}
                >
                  <option value="">Select a Line Item</option>
                  {items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.cost_code}{item.description ? ` - ${item.description}` : ""}
                    </option>
                  ))}
                </select>
                <select
                  value={row.toId}
                  onChange={(e) => updateRow(row.id, { toId: e.target.value })}
                  className={selectClass}
                >
                  <option value="">Select a Line Item</option>
                  {items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.cost_code}{item.description ? ` - ${item.description}` : ""}
                    </option>
                  ))}
                </select>
                <MoneyInput value={row.amount} onChange={(v) => updateRow(row.id, { amount: v })} placeholder="$0.00" />
                <input
                  type="text"
                  value={row.notes}
                  onChange={(e) => updateRow(row.id, { notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
                <button
                  type="button"
                  onClick={() => setRows((prev) => prev.filter((r) => r.id !== row.id))}
                  className="flex items-center justify-center w-7 h-7 rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors flex-shrink-0"
                  aria-label="Remove row"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setRows((prev) => [...prev, makeRow()])}
            className="mt-4 text-sm text-blue-600 hover:text-blue-800 transition-colors"
          >
            + Add Line Item
          </button>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="px-4 py-2 text-sm font-medium text-white bg-gray-700 rounded-md hover:bg-gray-800 transition-colors"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}

// ── ERP Resend Confirm Modal ──────────────────────────────────────────────────

function ErpConfirmModal({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        <h2 className="text-base font-semibold text-gray-900">Resend Budget to ERP</h2>
        <p className="text-sm text-gray-500">
          This will push the current budget data to your connected ERP system. Continue?
        </p>
        <div className="flex justify-end gap-3 pt-1">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-md bg-white hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-md hover:bg-gray-700 transition-colors"
          >
            Resend to ERP
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Column header tooltip ─────────────────────────────────────────────────────

type ColTooltip = {
  subtitle?: string;
  kind: "Source Column" | "Calculated Column" | "Standard Column";
  body: React.ReactNode;
};

function ColumnTooltip({ label, tooltip }: { label: string; tooltip: ColTooltip }) {
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  function handleEnter() {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: rect.left });
    }
    setShow(true);
  }

  const tooltipEl = show && pos && mounted
    ? createPortal(
        <div
          className="fixed z-[200] w-64 rounded-lg bg-gray-900 text-white shadow-xl p-3 text-xs pointer-events-none"
          style={{ top: pos.top, left: pos.left }}
        >
          <div className="font-semibold text-sm leading-tight">
            {label}
            {tooltip.subtitle && (
              <span className="text-gray-400 font-normal"> {tooltip.subtitle}</span>
            )}
          </div>
          <div className="text-gray-400 mt-0.5 mb-2">{tooltip.kind}</div>
          <div className="border-t border-gray-700 pt-2 space-y-1 leading-relaxed">
            {tooltip.body}
          </div>
        </div>,
        document.body
      )
    : null;

  return (
    <div
      ref={triggerRef}
      className="inline-block"
      onMouseEnter={handleEnter}
      onMouseLeave={() => setShow(false)}
    >
      <span className="cursor-default select-none">{label}</span>
      {tooltipEl}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function BudgetClient({
  projectId,
  role,
  username,
}: {
  projectId: string;
  role: string;
  username: string;
}) {
  const [items, setItems] = useState<BudgetLineItem[]>([]);
  const [snapshots, setSnapshots] = useState<BudgetSnapshot[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [showLineItemModal, setShowLineItemModal] = useState(false);
  const [lineItemDefaults, setLineItemDefaults] = useState<Partial<LineItemFormData> | undefined>(undefined);
  const [editingItem, setEditingItem] = useState<BudgetLineItem | null>(null);
  const [showSnapshotModal, setShowSnapshotModal] = useState(false);
  const [showBudgetChangeModal, setShowBudgetChangeModal] = useState(false);
  const [showBudgetModificationModal, setShowBudgetModificationModal] = useState(false);
  const [showErpModal, setShowErpModal] = useState(false);
  const [showCommittedCostsModal, setShowCommittedCostsModal] = useState(false);
  const [committedCostsLoading, setCommittedCostsLoading] = useState(false);
  const [committedCostsError, setCommittedCostsError] = useState<string | null>(null);
  const [committedCostsData, setCommittedCostsData] = useState<CommittedCostsDetail | null>(null);
  const [forecastEdits, setForecastEdits] = useState<Record<string, ForecastEdit>>({});
  const [selectedForecastItemId, setSelectedForecastItemId] = useState<string | null>(null);
  const [isBudgetLocked, setIsBudgetLocked] = useState(false);
  const [activeTab, setActiveTab] = useState<"budget" | "budget_details" | "forecasting" | "project_status_snapshot">("budget");
  const [groupBy, setGroupBy] = useState<GroupByKey | null>(null);
  const [selectedBudgetDetailView, setSelectedBudgetDetailView] = useState("Procore Standard Budget");
  const [showGroupMenu, setShowGroupMenu] = useState(false);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [activeFilterKey, setActiveFilterKey] = useState<FilterKey | null>(null);
  const [filterSearch, setFilterSearch] = useState("");
  const [selectedFilters, setSelectedFilters] = useState<Record<FilterKey, string[]>>({
    cost_code: [],
    cost_type: [],
    vendor: [],
    detail_type: [],
  });

  // Forecasting tab state
  const [forecastingViews, setForecastingViews] = useState<ForecastingViewTemplate[]>([]);
  const [selectedForecastingViewId, setSelectedForecastingViewId] = useState<string | null>(null);
  const [showForecastViewMenu, setShowForecastViewMenu] = useState(false);
  const [forecastGroupBy, setForecastGroupBy] = useState<ForecastGroupByKey | null>(null);
  const [showForecastGroupMenu, setShowForecastGroupMenu] = useState(false);
  const [forecastFilterKey, setForecastFilterKey] = useState<ForecastFilterKey | null>(null);
  const [forecastFilterSearch, setForecastFilterSearch] = useState("");
  const [forecastSelectedFilters, setForecastSelectedFilters] = useState<Record<ForecastFilterKey, string[]>>({
    cost_code: [],
    description: [],
    cost_type: [],
    sub_job: [],
  });
  const [showForecastFilterMenu, setShowForecastFilterMenu] = useState(false);
  const [showCreateForecastViewModal, setShowCreateForecastViewModal] = useState(false);
  const [selectedSnapshotIds, setSelectedSnapshotIds] = useState<string[]>([]);
  const [snapshotVarianceMode, setSnapshotVarianceMode] = useState<SnapshotVarianceMode>("comparison_and_variance");

  // Dropdown refs
  const exportRef = useRef<HTMLDivElement>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);
  const createMenuRef = useRef<HTMLDivElement>(null);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const reportsMenuRef = useRef<HTMLDivElement>(null);
  const [showReportsMenu, setShowReportsMenu] = useState(false);
  const groupMenuRef = useRef<HTMLDivElement>(null);
  const filterMenuRef = useRef<HTMLDivElement>(null);
  const forecastViewMenuRef = useRef<HTMLDivElement>(null);
  const forecastGroupMenuRef = useRef<HTMLDivElement>(null);
  const forecastFilterMenuRef = useRef<HTMLDivElement>(null);

  // Row action menu
  const [rowMenuId, setRowMenuId] = useState<string | null>(null);
  const rowMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setShowExportMenu(false);
      if (rowMenuRef.current && !rowMenuRef.current.contains(e.target as Node)) setRowMenuId(null);
      if (createMenuRef.current && !createMenuRef.current.contains(e.target as Node)) setShowCreateMenu(false);
      if (reportsMenuRef.current && !reportsMenuRef.current.contains(e.target as Node)) setShowReportsMenu(false);
      if (groupMenuRef.current && !groupMenuRef.current.contains(e.target as Node)) setShowGroupMenu(false);
      if (filterMenuRef.current && !filterMenuRef.current.contains(e.target as Node)) setShowFilterMenu(false);
      if (forecastViewMenuRef.current && !forecastViewMenuRef.current.contains(e.target as Node)) setShowForecastViewMenu(false);
      if (forecastGroupMenuRef.current && !forecastGroupMenuRef.current.contains(e.target as Node)) setShowForecastGroupMenu(false);
      if (forecastFilterMenuRef.current && !forecastFilterMenuRef.current.contains(e.target as Node)) setShowForecastFilterMenu(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    Promise.all([
      fetch(`/api/projects/${projectId}/budget`).then((r) => r.json()),
      fetch(`/api/projects/${projectId}/budget/snapshots`).then((r) => r.json()),
      fetch(`/api/projects/${projectId}/budget/lock`).then((r) => r.json()),
      fetch(`/api/forecasting-views`).then((r) => r.ok ? r.json() : []).catch(() => []),
    ]).then(([itemsData, snapshotsData, lockData, viewsData]) => {
      setItems(Array.isArray(itemsData) ? itemsData : []);
      setSnapshots(Array.isArray(snapshotsData) ? snapshotsData : []);
      setIsBudgetLocked(lockData?.locked === true);
      const views = Array.isArray(viewsData) ? viewsData : [];
      setForecastingViews(views);
      if (views.length > 0) setSelectedForecastingViewId(views[0].id);
      setLoading(false);
    });
  }, [projectId]);

  async function handleAddLineItem(data: LineItemFormData) {
    const res = await fetch(`/api/projects/${projectId}/budget`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cost_code: data.cost_code,
        cost_type: data.cost_type,
        description: data.description,
        manual_calculation: data.manual_calculation,
        unit_qty: numVal(data.unit_qty),
        unit_of_measure: data.unit_of_measure,
        unit_cost: numVal(data.unit_cost),
        original_budget_amount: data.is_partial_line_item ? 0 : numVal(data.original_budget_amount),
        budget_modifications: numVal(data.budget_modifications),
        approved_cos: numVal(data.approved_cos),
        pending_budget_changes: numVal(data.pending_budget_changes),
        committed_costs: numVal(data.committed_costs),
        job_to_date_costs: numVal(data.job_to_date_costs),
        commitments_invoiced: numVal(data.commitments_invoiced),
        pending_cost_changes: numVal(data.pending_cost_changes),
        start_date: data.start_date || null,
        end_date: data.end_date || null,
        curve: data.curve || "Linear",
        is_partial_line_item: data.is_partial_line_item,
        is_gst_line_item: data.is_gst_line_item,
        sort_order: items.length,
      }),
    });
    if (res.ok) {
      const newItem: BudgetLineItem = await res.json();
      setItems((prev) => [...prev, newItem]);
      setLineItemDefaults(undefined);
      setShowLineItemModal(false);
      return;
    }
    const payload = await res.json().catch(() => null);
    window.alert(payload?.error || "Unable to create budget line item.");
  }

  async function handleEditLineItem(data: LineItemFormData) {
    if (!editingItem) return;
    const res = await fetch(`/api/projects/${projectId}/budget/${editingItem.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cost_code: data.cost_code,
        cost_type: data.cost_type,
        description: data.description,
        manual_calculation: data.manual_calculation,
        unit_qty: numVal(data.unit_qty),
        unit_of_measure: data.unit_of_measure,
        unit_cost: numVal(data.unit_cost),
        original_budget_amount: data.is_partial_line_item
          ? 0
          : isBudgetLocked
          ? editingItem.original_budget_amount
          : numVal(data.original_budget_amount),
        budget_modifications: numVal(data.budget_modifications),
        approved_cos: numVal(data.approved_cos),
        pending_budget_changes: numVal(data.pending_budget_changes),
        committed_costs: numVal(data.committed_costs),
        job_to_date_costs: numVal(data.job_to_date_costs),
        commitments_invoiced: numVal(data.commitments_invoiced),
        pending_cost_changes: numVal(data.pending_cost_changes),
        start_date: data.start_date || null,
        end_date: data.end_date || null,
        curve: data.curve || "Linear",
        is_partial_line_item: data.is_partial_line_item,
        is_gst_line_item: data.is_gst_line_item,
      }),
    });
    if (res.ok) {
      const updated: BudgetLineItem = await res.json();
      setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
      setEditingItem(null);
      return;
    }
    const payload = await res.json().catch(() => null);
    window.alert(payload?.error || "Unable to update budget line item.");
  }

  async function handleLockBudget() {
    if (isBudgetLocked) return;
    const confirmed = window.confirm(
      "Lock budget? Once locked, Original Budget Amount values can no longer be edited."
    );
    if (!confirmed) return;
    const res = await fetch(`/api/projects/${projectId}/budget/lock`, { method: "POST" });
    if (res.ok) setIsBudgetLocked(true);
  }

  async function handleDeleteItem(id: string) {
    const res = await fetch(`/api/projects/${projectId}/budget/${id}`, { method: "DELETE" });
    if (res.ok) setItems((prev) => prev.filter((i) => i.id !== id));
    setRowMenuId(null);
  }

  async function handleCreateSnapshot(name: string) {
    const res = await fetch(`/api/projects/${projectId}/budget/snapshots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, snapshot_data: items }),
    });
    if (res.ok) {
      const snap: BudgetSnapshot = await res.json();
      setSnapshots((prev) => [snap, ...prev]);
    }
    setShowSnapshotModal(false);
  }

  async function handleUpdateSnapshotStatus(
    snapshotId: string,
    status: "Draft" | "Under Review" | "Approved" | "Archived"
  ) {
    const res = await fetch(`/api/projects/${projectId}/budget/snapshots`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ snapshot_id: snapshotId, status }),
    });
    if (!res.ok) return;
    const updated: BudgetSnapshot = await res.json();
    setSnapshots((prev) => prev.map((snap) => (snap.id === updated.id ? { ...snap, ...updated } : snap)));
  }

  function exportSnapshotListCsv() {
    const rows = snapshots.map((snapshot) => ({
      name: snapshot.name,
      status: snapshot.status ?? "Draft",
      created_at: new Date(snapshot.created_at).toISOString(),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Project Status Snapshots");
    XLSX.writeFile(wb, `project-status-snapshots-${projectId}.csv`, { bookType: "csv" });
  }

  function compareSelectedSnapshots() {
    if (selectedSnapshotIds.length !== 2) {
      window.alert("Select exactly two snapshots to analyze variance.");
      return;
    }
  }

  const selectedSnapshotsForVariance = useMemo(() => {
    if (selectedSnapshotIds.length !== 2) return null;
    const [left, right] = selectedSnapshotIds
      .map((id) => snapshots.find((s) => s.id === id))
      .filter(Boolean) as BudgetSnapshot[];
    if (!left || !right) return null;
    return { left, right };
  }, [selectedSnapshotIds, snapshots]);

  const snapshotVarianceRows = useMemo(() => {
    if (!selectedSnapshotsForVariance) return [];
    const { left, right } = selectedSnapshotsForVariance;
    const leftData = Array.isArray(left.snapshot_data) ? left.snapshot_data : [];
    const rightData = Array.isArray(right.snapshot_data) ? right.snapshot_data : [];

    const leftMap = new Map(
      leftData.map((item) => [`${item.cost_code}||${item.cost_type}`, { item, calc: calc(item) }])
    );
    const rightMap = new Map(
      rightData.map((item) => [`${item.cost_code}||${item.cost_type}`, { item, calc: calc(item) }])
    );
    const allKeys = Array.from(new Set([...leftMap.keys(), ...rightMap.keys()])).sort((a, b) => a.localeCompare(b));

    return allKeys.map((key) => {
      const leftEntry = leftMap.get(key);
      const rightEntry = rightMap.get(key);
      const labelItem = rightEntry?.item ?? leftEntry?.item;

      const leftProjectedBudget = leftEntry?.calc.projectedBudget ?? 0;
      const rightProjectedBudget = rightEntry?.calc.projectedBudget ?? 0;
      const leftProjectedCosts = leftEntry?.calc.projectedCosts ?? 0;
      const rightProjectedCosts = rightEntry?.calc.projectedCosts ?? 0;
      const leftProjectedOverUnder = leftEntry?.calc.projectedOverUnder ?? 0;
      const rightProjectedOverUnder = rightEntry?.calc.projectedOverUnder ?? 0;

      return {
        key,
        budgetCode: labelItem ? `${labelItem.cost_code} · ${labelItem.cost_type || "None"}` : key,
        description: labelItem?.description || "—",
        leftProjectedBudget,
        rightProjectedBudget,
        leftProjectedCosts,
        rightProjectedCosts,
        leftProjectedOverUnder,
        rightProjectedOverUnder,
        projectedBudgetVariance: rightProjectedBudget - leftProjectedBudget,
        projectedCostsVariance: rightProjectedCosts - leftProjectedCosts,
        projectedOverUnderVariance: rightProjectedOverUnder - leftProjectedOverUnder,
      };
    });
  }, [selectedSnapshotsForVariance]);

  async function handleCreateBudgetChange(payload: { itemId: string; amount: number }) {
    const targetItem = items.find((item) => item.id === payload.itemId);
    if (!targetItem) return;
    const res = await fetch(`/api/projects/${projectId}/budget/${payload.itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cost_code: targetItem.cost_code,
        cost_type: targetItem.cost_type,
        description: targetItem.description,
        original_budget_amount: targetItem.original_budget_amount,
        budget_modifications: targetItem.budget_modifications,
        approved_cos: targetItem.approved_cos,
        pending_budget_changes: targetItem.pending_budget_changes + payload.amount,
        committed_costs: targetItem.committed_costs,
        job_to_date_costs: targetItem.job_to_date_costs,
        commitments_invoiced: targetItem.commitments_invoiced,
        pending_cost_changes: targetItem.pending_cost_changes,
        is_partial_line_item: targetItem.is_partial_line_item ?? false,
        is_gst_line_item: targetItem.is_gst_line_item ?? false,
      }),
    });
    if (res.ok) {
      const updated: BudgetLineItem = await res.json();
      setItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setShowBudgetChangeModal(false);
    }
  }

  async function handleCreateBudgetModification(
    rows: { fromId: string; toId: string; amount: number; notes: string }[]
  ) {
    // Aggregate net delta per line item so each item is only PATCHed once
    const deltas = new Map<string, number>();
    for (const row of rows) {
      if (!row.fromId || !row.toId || row.amount === 0) continue;
      deltas.set(row.fromId, (deltas.get(row.fromId) ?? 0) - row.amount);
      deltas.set(row.toId, (deltas.get(row.toId) ?? 0) + row.amount);
    }

    const updatedMap = new Map(items.map((i) => [i.id, i]));
    for (const [itemId, delta] of deltas) {
      const item = updatedMap.get(itemId);
      if (!item) continue;
      const res = await fetch(`/api/projects/${projectId}/budget/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cost_code: item.cost_code,
          cost_type: item.cost_type,
          description: item.description,
          original_budget_amount: item.original_budget_amount,
          budget_modifications: item.budget_modifications + delta,
          approved_cos: item.approved_cos,
          pending_budget_changes: item.pending_budget_changes,
          committed_costs: item.committed_costs,
          job_to_date_costs: item.job_to_date_costs,
          commitments_invoiced: item.commitments_invoiced,
          pending_cost_changes: item.pending_cost_changes,
          is_partial_line_item: item.is_partial_line_item ?? false,
          is_gst_line_item: item.is_gst_line_item ?? false,
        }),
      });
      if (res.ok) {
        const updated: BudgetLineItem = await res.json();
        updatedMap.set(updated.id, updated);
      }
    }
    setItems(items.map((i) => updatedMap.get(i.id) ?? i));

    // Save audit records (fire-and-forget; don't block the UI)
    const validRows = rows.filter((r) => r.fromId && r.toId && r.amount !== 0);
    if (validRows.length > 0) {
      fetch(`/api/projects/${projectId}/budget/modifications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: validRows.map((r) => ({
            fromId: r.fromId,
            toId: r.toId,
            fromCostCode: updatedMap.get(r.fromId)?.cost_code ?? "",
            toCostCode: updatedMap.get(r.toId)?.cost_code ?? "",
            amount: r.amount,
            notes: r.notes,
          })),
        }),
      });
    }

    setShowBudgetModificationModal(false);
  }

  function handleErpResend() {
    // Placeholder: integrate with ERP API
    setShowErpModal(false);
  }

  function handleDownloadTemplate() {
    const headers = [
      "Cost Code",
      "Cost Type",
      "Description",
      "Manual Calculation",
      "Unit Qty",
      "Unit of Measure",
      "Unit Cost",
      "Budget Amount",
      "Start Date",
      "End Date",
      "Curve",
    ];
    const sample = [
      "01-100",
      "Labor",
      "Site Preparation",
      "false",
      100,
      "HR",
      75.00,
      "",
      "2024-01-01",
      "2024-03-31",
      "Linear",
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers, sample]);
    // Set column widths for readability
    ws["!cols"] = headers.map(() => ({ wch: 22 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Budget Template");
    XLSX.writeFile(wb, "budget_template.xlsx");
  }

  async function handleImportBudgetFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: "array", cellDates: true });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        window.alert("The selected file has no worksheet.");
        return;
      }
      const sheet = workbook.Sheets[firstSheetName];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      if (rows.length === 0) {
        window.alert("No rows were found in the selected file.");
        return;
      }

      const importedItems = rows
        .map((row) => {
          const costCode = readString(row["Cost Code"] ?? row.cost_code ?? row["cost code"]);
          const costType = readString(row["Cost Type"] ?? row.cost_type ?? row["cost type"]);
          const description = readString(row.Description ?? row.description);
          const manualCalculation = readBool(
            row["Manual Calculation"] ?? row.manual_calculation ?? row["manual calculation"]
          );
          const unitQty = readNumber(row["Unit Qty"] ?? row.unit_qty ?? row["unit qty"]);
          const unitOfMeasure = readString(
            row["Unit of Measure"] ?? row.unit_of_measure ?? row["unit of measure"]
          );
          const unitCost = readNumber(row["Unit Cost"] ?? row.unit_cost ?? row["unit cost"]);
          const budgetAmountRaw = readNumber(
            row["Budget Amount"] ?? row.budget_amount ?? row["budget amount"]
          );

          // If manual_calculation = true, use the provided budget amount directly.
          // If false, calculate from unit_qty × unit_cost.
          const originalBudgetAmount = manualCalculation
            ? budgetAmountRaw
            : unitQty * unitCost;

          return {
            cost_code: costCode,
            cost_type: costType,
            description,
            manual_calculation: manualCalculation,
            unit_qty: unitQty,
            unit_of_measure: unitOfMeasure,
            unit_cost: unitCost,
            original_budget_amount: originalBudgetAmount,
            start_date: readDate(row["Start Date"] ?? row.start_date ?? row["start date"]),
            end_date: readDate(row["End Date"] ?? row.end_date ?? row["end date"]),
            curve: readString(row.Curve ?? row.curve),
          };
        })
        .filter((row) => row.cost_code && row.cost_type);

      if (importedItems.length === 0) {
        window.alert("No valid budget rows found. Include both Cost Code and Cost Type for each row.");
        return;
      }

      const startOrder = items.length;
      const created: BudgetLineItem[] = [];
      for (const [index, row] of importedItems.entries()) {
        const res = await fetch(`/api/projects/${projectId}/budget`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...row, sort_order: startOrder + index }),
        });
        if (res.ok) {
          const newItem: BudgetLineItem = await res.json();
          created.push(newItem);
        }
      }

      if (created.length > 0) {
        setItems((prev) => [...prev, ...created]);
      }
      window.alert(`Imported ${created.length} budget row${created.length === 1 ? "" : "s"}.`);
    } catch (error) {
      console.error("Budget import failed", error);
      window.alert("Failed to import this file. Please verify the format and try again.");
    } finally {
      e.target.value = "";
    }
  }

  async function openCommittedCostsModal(item: BudgetLineItem) {
    setShowCommittedCostsModal(true);
    setCommittedCostsLoading(true);
    setCommittedCostsError(null);
    setCommittedCostsData(null);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/budget/committed-costs?costCode=${encodeURIComponent(item.cost_code)}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load committed costs");
      setCommittedCostsData(data);
    } catch (err) {
      setCommittedCostsError(err instanceof Error ? err.message : "Failed to load committed costs");
    } finally {
      setCommittedCostsLoading(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }

  function getItemCalc(item: BudgetLineItem) {
    const edit = forecastEdits[item.id];
    const useOverride = edit && (edit.method === "manual" || edit.method === "lump_sum");
    return calcWithForecastOverride(item, useOverride ? edit.amount : null);
  }

  const totals = items.reduce(
    (acc, item) => {
      const c = getItemCalc(item);
      acc.unit_qty += item.unit_qty;
      acc.original_budget_amount += item.original_budget_amount;
      acc.budget_modifications += item.budget_modifications;
      acc.approved_cos += item.approved_cos;
      acc.pending_budget_changes += item.pending_budget_changes;
      acc.committed_costs += item.committed_costs;
      acc.job_to_date_costs += item.job_to_date_costs;
      acc.commitments_invoiced += item.commitments_invoiced;
      acc.pending_cost_changes += item.pending_cost_changes;
      acc.revisedBudget += c.revisedBudget;
      acc.projectedBudget += c.projectedBudget;
      acc.directCosts += c.directCosts;
      acc.projectedCosts += c.projectedCosts;
      acc.forecastToComplete += c.forecastToComplete;
      acc.estimatedCostAtCompletion += c.estimatedCostAtCompletion;
      acc.projectedOverUnder += c.projectedOverUnder;
      return acc;
    },
    {
      ...sumItems([]),
      unit_qty: 0,
    }
  );
  const selectedForecastItem = items.find((item) => item.id === selectedForecastItemId) ?? null;
  const selectedForecastEdit = selectedForecastItem
    ? forecastEdits[selectedForecastItem.id] ?? { method: "automatic" as ForecastMethod, amount: null, notes: "" }
    : null;

  function updateForecastEdit(itemId: string, updates: Partial<ForecastEdit>) {
    setForecastEdits((prev) => {
      const current = prev[itemId] ?? { method: "automatic" as ForecastMethod, amount: null, notes: "" };
      return {
        ...prev,
        [itemId]: {
          ...current,
          ...updates,
        },
      };
    });
  }

  const COLS: Array<{
    key: string;
    label: string;
    width: string;
    tooltip?: ColTooltip;
  }> = [
    { key: "description", label: "Description", width: "min-w-[180px]" },
    { key: "unit_qty", label: "Budget Unit Qty", width: "min-w-[110px]" },
    { key: "unit_of_measure", label: "UOM", width: "min-w-[90px]" },
    { key: "unit_cost", label: "Unit Cost", width: "min-w-[100px]" },
    { key: "original_budget_amount", label: "Original Budget Amount", width: "min-w-[130px]" },
    { key: "budget_modifications", label: "Budget Modifications", width: "min-w-[120px]" },
    {
      key: "approved_cos", label: "Approved COs", width: "min-w-[110px]",
      tooltip: {
        subtitle: "(Prime Contract)", kind: "Source Column",
        body: (<><p className="font-medium">Change Orders</p><p className="text-gray-400">Status</p><p className="text-gray-300">• Approved</p></>),
      },
    },
    {
      key: "revised_budget", label: "Revised Budget", width: "min-w-[110px]",
      tooltip: {
        kind: "Calculated Column",
        body: (<><p className="text-gray-300">{"  "}Original Budget Amount</p><p className="text-gray-300">+ Budget Modifications</p><p className="text-gray-300">+ Approved COs</p><div className="border-t border-gray-700 mt-1 pt-1"><p className="font-semibold">= Revised Budget</p></div></>),
      },
    },
    {
      key: "pending_budget_changes", label: "Pending Budget Changes", width: "min-w-[130px]",
      tooltip: {
        subtitle: "(Prime Contract)", kind: "Source Column",
        body: (<><p className="font-medium">Change Orders</p><p className="text-gray-400">Status</p><p className="text-gray-300">• Pending - In Review</p><p className="text-gray-300">• Pending - Not Pricing</p><p className="text-gray-300">• Pending - Not Proceeding</p><p className="text-gray-300">• Pending - Pricing</p><p className="text-gray-300">• Pending - Proceeding</p><p className="text-gray-300">• Pending - Revised</p></>),
      },
    },
    {
      key: "projected_budget", label: "Projected Budget", width: "min-w-[110px]",
      tooltip: {
        kind: "Calculated Column",
        body: (<><p className="text-gray-300">{"  "}Revised Budget</p><p className="text-gray-300">+ Pending Budget Changes</p><div className="border-t border-gray-700 mt-1 pt-1"><p className="font-semibold">= Projected Budget</p></div></>),
      },
    },
    {
      key: "committed_costs", label: "Committed Costs", width: "min-w-[110px]",
      tooltip: {
        subtitle: "(Commitment)", kind: "Source Column",
        body: (<><p className="font-medium">Subcontracts</p><p className="text-gray-400">Status</p><p className="text-gray-300">• Approved</p><p className="text-gray-300">• Complete</p><div className="border-t border-gray-700 my-1.5" /><p className="font-medium">Purchase Order Contracts</p><p className="text-gray-400">Status</p><p className="text-gray-300">• Approved</p><div className="border-t border-gray-700 my-1.5" /><p className="font-medium">Change Orders</p><p className="text-gray-400">Status</p><p className="text-gray-300">• Approved</p></>),
      },
    },
    {
      key: "direct_costs", label: "Direct Costs", width: "min-w-[100px]",
      tooltip: {
        kind: "Calculated Column",
        body: (<><p className="text-gray-300">{"  "}Job to Date Costs</p><p className="text-gray-300">- Commitments Invoiced</p><div className="border-t border-gray-700 mt-1 pt-1"><p className="font-semibold">= Direct Costs</p></div></>),
      },
    },
    {
      key: "job_to_date_costs", label: "Job to Date Costs", width: "min-w-[110px]",
      tooltip: {
        subtitle: "(ERP Job Costs)", kind: "Source Column",
        body: (<><p className="text-gray-300">ERP Job to Date Costs</p></>),
      },
    },
    {
      key: "pending_cost_changes", label: "Pending Cost Changes", width: "min-w-[120px]",
      tooltip: {
        subtitle: "(Commitment)", kind: "Source Column",
        body: (<><p className="font-medium">Subcontracts</p><p className="text-gray-400">Status</p><p className="text-gray-300">• Out For Signature</p><div className="border-t border-gray-700 my-1.5" /><p className="font-medium">Purchase Order Contracts</p><p className="text-gray-400">Status</p><p className="text-gray-300">• Processing</p><p className="text-gray-300">• Submitted</p><p className="text-gray-300">• Partially Received</p><p className="text-gray-300">• Received</p><div className="border-t border-gray-700 my-1.5" /><p className="font-medium">Change Orders</p><p className="text-gray-400">Status</p><p className="text-gray-300">• Pending - In Review</p><p className="text-gray-300">• Pending - Not Pricing</p><p className="text-gray-300">• Pending - Not Proceeding</p><p className="text-gray-300">• Pending - Pricing</p><p className="text-gray-300">• Pending - Proceeding</p><p className="text-gray-300">• Pending - Revised</p></>),
      },
    },
    {
      key: "projected_costs", label: "Projected Costs", width: "min-w-[110px]",
      tooltip: {
        kind: "Calculated Column",
        body: (<><p className="text-gray-300">{"  "}Committed Costs</p><p className="text-gray-300">+ Direct Costs</p><p className="text-gray-300">+ Pending Cost Changes</p><div className="border-t border-gray-700 mt-1 pt-1"><p className="font-semibold">= Projected Costs</p></div></>),
      },
    },
    {
      key: "forecast_to_complete", label: "Forecast To Complete", width: "min-w-[120px]",
      tooltip: {
        kind: "Standard Column",
        body: (<><p className="text-gray-300">{"  "}Projected Budget</p><p className="text-gray-300">- Projected Costs</p><div className="border-t border-gray-700 mt-1 pt-1"><p className="font-semibold">= Forecast To Complete</p></div><p className="text-gray-400 mt-1.5">If negative, column will show 0.</p></>),
      },
    },
    {
      key: "estimated_cost_at_completion", label: "Estimated Cost at Completion", width: "min-w-[140px]",
      tooltip: {
        kind: "Calculated Column",
        body: (<><p className="text-gray-300">{"  "}Projected Costs</p><p className="text-gray-300">+ Forecast To Complete</p><div className="border-t border-gray-700 mt-1 pt-1"><p className="font-semibold">= Estimated Cost at Completion</p></div></>),
      },
    },
    {
      key: "projected_over_under", label: "Projected over Under", width: "min-w-[120px]",
      tooltip: {
        kind: "Calculated Column",
        body: (<><p className="text-gray-300">{"  "}Projected Budget</p><p className="text-gray-300">- Estimated Cost at Completion</p><div className="border-t border-gray-700 mt-1 pt-1"><p className="font-semibold">= Projected over Under</p></div></>),
      },
    },
  ];

  const DETAIL_COLS: Array<{ key: string; label: string; width: string }> = [
    { key: "budget_code", label: "Budget Code", width: "min-w-[210px]" },
    { key: "vendor", label: "Vendor", width: "min-w-[130px]" },
    { key: "item", label: "Item", width: "min-w-[180px]" },
    { key: "description", label: "Description", width: "min-w-[130px]" },
    { key: "detail_type", label: "Detail Type", width: "min-w-[170px]" },
    { key: "original_budget_amount", label: "Original Budget Amount", width: "min-w-[130px]" },
    { key: "budget_modifications", label: "Budget Modifications", width: "min-w-[120px]" },
    { key: "approved_cos", label: "Approved COs", width: "min-w-[110px]" },
    { key: "pending_budget_changes", label: "Pending Budget Changes", width: "min-w-[130px]" },
    { key: "committed_costs", label: "Committed Costs", width: "min-w-[110px]" },
    { key: "job_to_date_costs", label: "Job to Date Costs", width: "min-w-[110px]" },
    { key: "pending_cost_changes", label: "Pending Cost Changes", width: "min-w-[120px]" },
    { key: "forecast_to_complete", label: "Forecast To Complete", width: "min-w-[130px]" },
  ];

  function renderCell(item: BudgetLineItem | null, key: string) {
    if (item === null) {
      // Totals row
      switch (key) {
        case "description": return <span className="font-semibold text-gray-900">Total</span>;
        case "unit_qty": return <span className="font-semibold">{totals.unit_qty.toLocaleString("en-US")}</span>;
        case "unit_of_measure": return <span className="font-semibold">—</span>;
        case "unit_cost": return <span className="font-semibold">—</span>;
        case "original_budget_amount": return <span className="font-semibold">{fmt(totals.original_budget_amount)}</span>;
        case "budget_modifications": return <span className="font-semibold">{fmt(totals.budget_modifications)}</span>;
        case "approved_cos": return <span className="font-semibold">{fmt(totals.approved_cos)}</span>;
        case "revised_budget": return <span className="font-semibold">{fmt(totals.revisedBudget)}</span>;
        case "pending_budget_changes": return <span className="font-semibold">{fmt(totals.pending_budget_changes)}</span>;
        case "projected_budget": return <span className="font-semibold">{fmt(totals.projectedBudget)}</span>;
        case "committed_costs": return <span className="font-semibold">{fmt(totals.committed_costs)}</span>;
        case "direct_costs": return <span className="font-semibold">{fmt(totals.directCosts)}</span>;
        case "job_to_date_costs": return <span className="font-semibold">{fmt(totals.job_to_date_costs)}</span>;
        case "pending_cost_changes": return <span className="font-semibold">{fmt(totals.pending_cost_changes)}</span>;
        case "projected_costs": return <span className="font-semibold">{fmt(totals.projectedCosts)}</span>;
        case "forecast_to_complete": return <span className="font-semibold">{fmt(totals.forecastToComplete)}</span>;
        case "estimated_cost_at_completion": return <span className="font-semibold">{fmt(totals.estimatedCostAtCompletion)}</span>;
        case "projected_over_under": return (
          <span className={`font-semibold ${totals.projectedOverUnder < 0 ? "text-red-600" : ""}`}>
            {fmt(totals.projectedOverUnder)}
          </span>
        );
        default: return null;
      }
    }

    const c = getItemCalc(item!);
    switch (key) {
      case "description":
        return (
          <div>
            <p className="text-xs font-medium text-gray-500">
              {item!.cost_code}
              {item!.cost_type ? ` · ${item!.cost_type}` : ""}
            </p>
            <p className="text-xs text-blue-600 flex items-center gap-1.5">
              <span>{item!.description || "No description"}</span>
              {item!.is_partial_line_item && (
                <span
                  className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-amber-300 bg-amber-50 text-[10px] font-semibold text-amber-700"
                  title="Partial budget line item"
                  aria-label="Partial budget line item"
                >
                  ?
                </span>
              )}
              {item!.is_gst_line_item && (
                <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                  GST
                </span>
              )}
            </p>
          </div>
        );
      case "unit_qty": return item!.unit_qty.toLocaleString("en-US");
      case "unit_of_measure": return item!.unit_of_measure || "—";
      case "unit_cost": return fmt(item!.unit_cost || 0);
      case "original_budget_amount": return <span className="text-blue-600">{fmt(item!.original_budget_amount)}</span>;
      case "budget_modifications": return fmt(item!.budget_modifications);
      case "approved_cos": return fmt(item!.approved_cos);
      case "revised_budget": return fmt(c.revisedBudget);
      case "pending_budget_changes": return fmt(item!.pending_budget_changes);
      case "projected_budget": return fmt(c.projectedBudget);
      case "committed_costs":
        return (
          <button
            type="button"
            onClick={() => openCommittedCostsModal(item)}
            className="text-blue-600 hover:text-blue-800 underline underline-offset-2 decoration-blue-200"
          >
            {fmt(item!.committed_costs)}
          </button>
        );
      case "direct_costs": return fmt(c.directCosts);
      case "job_to_date_costs": return <span className="text-blue-600">{fmt(item!.job_to_date_costs)}</span>;
      case "pending_cost_changes": return fmt(item!.pending_cost_changes);
      case "projected_costs": return fmt(c.projectedCosts);
      case "forecast_to_complete":
        return (
          <button
            type="button"
            onClick={() => setSelectedForecastItemId(item.id)}
            className="text-blue-600 hover:text-blue-800 underline underline-offset-2 decoration-blue-200"
          >
            {fmtWithArrow(c.forecastToComplete)}
          </button>
        );
      case "estimated_cost_at_completion": return fmt(c.estimatedCostAtCompletion);
      case "projected_over_under":
        return (
          <span className={c.projectedOverUnder < 0 ? "text-red-600" : ""}>
            {fmt(c.projectedOverUnder)}
          </span>
        );
      default: return null;
    }
  }

  const budgetDetailRows: BudgetDetailRow[] = items.flatMap((item) => {
    const c = getItemCalc(item);
    const tiers = parseCostCodeTiers(item.cost_code);
    const rows: BudgetDetailRow[] = [];
    const base = {
      cost_code: item.cost_code,
      cost_code_tier_1: tiers.tier1,
      cost_code_tier_2: tiers.tier2,
      cost_type: item.cost_type?.trim() || "None",
      budget_description: item.description,
      vendor: "None",
      description: item.description || "—",
      approved_cos: null,
      pending_budget_changes: null,
      committed_costs: null,
      job_to_date_costs: null,
      pending_cost_changes: null,
      budget_modifications: null,
      original_budget_amount: null,
      forecast_to_complete: null,
    };

    rows.push({
      ...base,
      id: `${item.id}-auto-forecast`,
      item: "—",
      detail_type: "Automatic Forecast",
      forecast_to_complete: c.forecastToComplete,
    });

    rows.push({
      ...base,
      id: `${item.id}-original`,
      item: "Original Budget",
      detail_type: "Original Budget Amount",
      original_budget_amount: item.original_budget_amount,
    });

    if (item.budget_modifications !== 0) {
      rows.push({
        ...base,
        id: `${item.id}-modifications`,
        item: "Budget Modification",
        detail_type: "Budget Modification",
        budget_modifications: item.budget_modifications,
      });
    }

    if (item.approved_cos !== 0) {
      rows.push({
        ...base,
        id: `${item.id}-approved-cos`,
        item: "Prime Contract Change Order",
        detail_type: "Approved CO",
        approved_cos: item.approved_cos,
      });
    }

    if (item.pending_budget_changes !== 0) {
      rows.push({
        ...base,
        id: `${item.id}-pending-budget`,
        item: "Budget Change",
        detail_type: "Pending Budget Change",
        pending_budget_changes: item.pending_budget_changes,
      });
    }

    if (item.committed_costs !== 0) {
      rows.push({
        ...base,
        id: `${item.id}-committed`,
        item: "Commitment",
        detail_type: "Commitment Contract",
        committed_costs: item.committed_costs,
      });
    }

    if (item.job_to_date_costs !== 0) {
      rows.push({
        ...base,
        id: `${item.id}-job-to-date`,
        item: "Direct Cost",
        detail_type: "Direct Cost",
        job_to_date_costs: item.job_to_date_costs,
      });
    }

    if (item.pending_cost_changes !== 0) {
      rows.push({
        ...base,
        id: `${item.id}-pending-cost`,
        item: "Pending Cost Change",
        detail_type: "Pending Cost Change",
        pending_cost_changes: item.pending_cost_changes,
      });
    }

    return rows;
  });

  const filterChoices = useMemo(() => {
    const costCodeMap = new Map<string, string>();
    budgetDetailRows.forEach((row) => {
      const label = row.budget_description
        ? `${row.cost_code} - ${row.budget_description}`
        : row.cost_code;
      costCodeMap.set(row.cost_code || "None", label || "None");
    });
    return {
      cost_code: Array.from(costCodeMap.entries())
        .map(([value, label]) => ({ value, label }))
        .sort((a, b) => a.label.localeCompare(b.label)),
      cost_type: Array.from(new Set(budgetDetailRows.map((row) => row.cost_type || "None")))
        .sort((a, b) => a.localeCompare(b))
        .map((value) => ({ value, label: value })),
      vendor: Array.from(new Set(budgetDetailRows.map((row) => row.vendor || "None")))
        .sort((a, b) => a.localeCompare(b))
        .map((value) => ({ value, label: value })),
      detail_type: Array.from(new Set(budgetDetailRows.map((row) => row.detail_type || "None")))
        .sort((a, b) => a.localeCompare(b))
        .map((value) => ({ value, label: value })),
    };
  }, [budgetDetailRows]);

  const activeFilterOptions = activeFilterKey ? filterChoices[activeFilterKey] : [];
  const searchedFilterOptions = activeFilterOptions.filter((option) =>
    option.label.toLowerCase().includes(filterSearch.toLowerCase())
  );

  const filteredBudgetDetailRows = useMemo(() => {
    return budgetDetailRows.filter((row) => {
      if (
        selectedFilters.cost_code.length > 0 &&
        !selectedFilters.cost_code.includes(row.cost_code || "None")
      ) {
        return false;
      }
      if (
        selectedFilters.cost_type.length > 0 &&
        !selectedFilters.cost_type.includes(row.cost_type || "None")
      ) {
        return false;
      }
      if (selectedFilters.vendor.length > 0 && !selectedFilters.vendor.includes(row.vendor || "None")) {
        return false;
      }
      if (
        selectedFilters.detail_type.length > 0 &&
        !selectedFilters.detail_type.includes(row.detail_type || "None")
      ) {
        return false;
      }
      return true;
    });
  }, [budgetDetailRows, selectedFilters]);

  const groupedBudgetDetailRows = useMemo(() => {
    if (!groupBy) return [];
    const groups = new Map<string, BudgetDetailRow[]>();
    filteredBudgetDetailRows.forEach((row) => {
      const keyValue = row[groupBy] || "None";
      const arr = groups.get(keyValue) ?? [];
      arr.push(row);
      groups.set(keyValue, arr);
    });
    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredBudgetDetailRows, groupBy]);

  const changeHistoryRows = useMemo(() => {
    const itemRows = items.map((item) => ({
      id: `line-item-${item.id}`,
      label: item.cost_code ? `${item.cost_code} · ${item.description || "Budget line item"}` : item.description || "Budget line item",
      type: "Budget line item created",
      date: item.created_at,
    }));

    const snapshotRows = snapshots.map((snapshot) => ({
      id: `snapshot-${snapshot.id}`,
      label: snapshot.name || "Snapshot",
      type: "Project status snapshot saved",
      date: snapshot.created_at,
    }));

    return [...itemRows, ...snapshotRows].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [items, snapshots]);

  function renderDetailCell(row: BudgetDetailRow, key: string) {
    switch (key) {
      case "budget_code":
        return (
          <div>
            <p className="text-gray-900">{row.cost_code || "—"}</p>
            <p className="text-gray-500">{row.budget_description || "—"}</p>
          </div>
        );
      case "vendor":
        return <span>{row.vendor || "—"}</span>;
      case "item":
        return <span>{row.item || "—"}</span>;
      case "description":
        return <span>{row.description || "—"}</span>;
      case "detail_type":
        return <span>{row.detail_type || "—"}</span>;
      case "original_budget_amount":
        return <span>{row.original_budget_amount === null ? "—" : fmt(row.original_budget_amount)}</span>;
      case "budget_modifications":
        return <span>{row.budget_modifications === null ? "—" : fmt(row.budget_modifications)}</span>;
      case "approved_cos":
        return <span>{row.approved_cos === null ? "—" : fmt(row.approved_cos)}</span>;
      case "pending_budget_changes":
        return <span>{row.pending_budget_changes === null ? "—" : fmt(row.pending_budget_changes)}</span>;
      case "committed_costs":
        return <span>{row.committed_costs === null ? "—" : fmt(row.committed_costs)}</span>;
      case "job_to_date_costs":
        return <span>{row.job_to_date_costs === null ? "—" : fmt(row.job_to_date_costs)}</span>;
      case "pending_cost_changes":
        return <span>{row.pending_cost_changes === null ? "—" : fmt(row.pending_cost_changes)}</span>;
      case "forecast_to_complete":
        return <span>{row.forecast_to_complete === null ? "—" : fmt(row.forecast_to_complete)}</span>;
      default:
        return <span className="text-gray-500">—</span>;
    }
  }

  function toggleFilterValue(filterKey: FilterKey, value: string) {
    setSelectedFilters((prev) => {
      const current = prev[filterKey];
      const next = current.includes(value)
        ? current.filter((entry) => entry !== value)
        : [...current, value];
      return { ...prev, [filterKey]: next };
    });
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-6 h-14 flex items-center justify-between">
        <a href="/dashboard" className="text-sm font-semibold text-gray-900 hover:text-gray-600 transition-colors">
          SiteCommand
        </a>
        <div className="flex items-center gap-5">
          <span className="text-sm text-gray-400">{username}</span>
          <button onClick={handleLogout} className="text-sm text-gray-400 hover:text-gray-900 transition-colors">
            Logout
          </button>
        </div>
      </header>

      <ProjectNav projectId={projectId} />

      <main className="px-6 py-8">
        {/* Title + actions */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display text-[28px] leading-tight text-[color:var(--ink)]">Budget</h1>
            {snapshots.length > 0 && (
              <p className="text-xs text-gray-400 mt-0.5">
                {snapshots.length} snapshot{snapshots.length !== 1 ? "s" : ""} saved
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Create dropdown — shown when budget is locked */}
            {isBudgetLocked && (
              <div ref={createMenuRef} className="relative">
                <button
                  onClick={() => setShowCreateMenu((o) => !o)}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-gray-900 rounded-md hover:bg-gray-700 transition-colors"
                >
                  + Create
                  <svg
                    className={`w-3.5 h-3.5 transition-transform ${showCreateMenu ? "rotate-180" : ""}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showCreateMenu && (
                  <div className="absolute left-0 mt-2 w-56 bg-white border border-gray-100 rounded-xl shadow-lg py-1 z-50">
                    <button
                      onClick={() => {
                        setLineItemDefaults(undefined);
                        setShowLineItemModal(true);
                        setShowCreateMenu(false);
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      Budget Line Item
                    </button>
                    <button
                      onClick={() => {
                        setLineItemDefaults({
                          is_gst_line_item: true,
                          cost_type: "Other",
                          description: "GST",
                        });
                        setShowLineItemModal(true);
                        setShowCreateMenu(false);
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      GST Budget Line Item
                    </button>
                    <button
                      onClick={() => { setShowBudgetModificationModal(true); setShowCreateMenu(false); }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      Budget Modification
                    </button>
                    <button
                      onClick={() => { setShowSnapshotModal(true); setShowCreateMenu(false); }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      Snapshot
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Resend to ERP */}
            <button
              onClick={() => setShowErpModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-md bg-white hover:bg-gray-50 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Resend to ERP
            </button>

            {/* Export */}
            <div ref={exportRef} className="relative">
              <button
                onClick={() => setShowExportMenu((o) => !o)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-md bg-white hover:bg-gray-50 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Export
                <svg
                  className={`w-3.5 h-3.5 text-gray-400 transition-transform ${showExportMenu ? "rotate-180" : ""}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showExportMenu && (
                <div className="absolute right-0 mt-2 w-44 bg-white border border-gray-100 rounded-xl shadow-lg py-1 z-50">
                  <button
                    onClick={() => { exportPDF(items, forecastEdits); setShowExportMenu(false); }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
                  >
                    <svg className="w-4 h-4 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                    </svg>
                    Export as PDF
                  </button>
                </div>
              )}
            </div>

            {/* Three-dot reports menu */}
            <div ref={reportsMenuRef} className="relative">
              <button
                onClick={() => setShowReportsMenu((o) => !o)}
                className={`p-2 text-gray-600 border rounded-md transition-colors hover:bg-gray-50 ${showReportsMenu ? "border-gray-400 bg-gray-50" : "border-gray-200 bg-white"}`}
                aria-label="Reports"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4z" />
                </svg>
              </button>
              {showReportsMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-100 rounded-xl shadow-lg py-1 z-50">
                  <div className="group relative">
                    <button className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-between">
                      Budget Reports
                      <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                    <div className="absolute right-full top-0 w-56 bg-white border border-gray-100 rounded-xl shadow-lg py-1 hidden group-hover:block">
                      <a
                        href={`/projects/${projectId}/reporting/budget-modifications`}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        onClick={() => setShowReportsMenu(false)}
                      >
                        Budget Modifications
                      </a>
                      <a
                        href={`/projects/${projectId}/reporting/buyout-summary`}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        onClick={() => setShowReportsMenu(false)}
                      >
                        Buyout Summary Report
                      </a>
                      {["Legacy Budget Detail", "Monitored Resources Report"].map((report) => (
                        <button
                          key={report}
                          onClick={() => setShowReportsMenu(false)}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          {report}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="group relative">
                    <button className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-between">
                      Custom Reports
                      <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                    <div className="absolute right-full top-0 w-56 bg-white border border-gray-100 rounded-xl shadow-lg py-1 hidden group-hover:block">
                      <p className="px-4 py-2 text-sm text-gray-400 italic">No custom reports</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mb-4 border-b border-gray-200">
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => setActiveTab("budget")}
              className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "budget"
                  ? "border-orange-500 text-gray-900"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              Budget
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("budget_details")}
              className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "budget_details"
                  ? "border-orange-500 text-gray-900"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              Budget Details
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("forecasting")}
              className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "forecasting"
                  ? "border-orange-500 text-gray-900"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              Forecasting
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("project_status_snapshot")}
              className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "project_status_snapshot"
                  ? "border-orange-500 text-gray-900"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              Project Status Snapshots
            </button>
          </div>
        </div>

        {activeTab === "budget_details" && (
          <div className="mb-4 flex items-center gap-2">
            <div>
              <label className="block text-[11px] font-medium text-gray-500 mb-1">View</label>
              <select
                value={selectedBudgetDetailView}
                onChange={(e) => setSelectedBudgetDetailView(e.target.value)}
                className="px-3 py-2 text-sm border border-gray-300 rounded-md bg-white"
              >
                <option value="Procore Standard Budget">Procore Standard Budget</option>
                <option value="Procore ERP Budget">Procore ERP Budget</option>
                <option value="Budget Changes">Budget Changes</option>
              </select>
            </div>
            <div ref={groupMenuRef} className="relative">
              <label className="block text-[11px] font-medium text-gray-500 mb-1">Group</label>
              <button
                type="button"
                onClick={() => setShowGroupMenu((v) => !v)}
                className="px-3 py-2 text-sm border border-gray-300 rounded-md bg-white hover:bg-gray-50"
              >
                Group
              </button>
              {showGroupMenu && (
                <div className="absolute left-0 mt-2 w-60 bg-white border border-gray-200 rounded-md shadow-lg z-40">
                  {[
                    { key: "cost_code_tier_1" as GroupByKey, label: "Cost Code Tier 1" },
                    { key: "cost_code_tier_2" as GroupByKey, label: "Cost Code Tier 2" },
                    { key: "cost_type" as GroupByKey, label: "Cost Type" },
                    { key: "vendor" as GroupByKey, label: "Vendor" },
                    { key: "detail_type" as GroupByKey, label: "Detail Type" },
                  ].map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => {
                        setGroupBy(option.key);
                        setShowGroupMenu(false);
                      }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${
                        groupBy === option.key ? "bg-gray-100" : ""
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                  <div className="border-t border-gray-200 p-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setGroupBy(null);
                        setShowGroupMenu(false);
                      }}
                      className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-md"
                    >
                      Reset
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div ref={filterMenuRef} className="relative">
              <label className="block text-[11px] font-medium text-gray-500 mb-1">Filter</label>
              <button
                type="button"
                onClick={() => setShowFilterMenu((v) => !v)}
                className="px-3 py-2 text-sm border border-gray-300 rounded-md bg-white hover:bg-gray-50"
              >
                Filter
              </button>
              {showFilterMenu && (
                <div className="absolute left-0 mt-2 w-56 bg-white border border-gray-200 rounded-md shadow-lg z-40 py-1">
                  {[
                    { key: "cost_code" as FilterKey, label: "Cost Code" },
                    { key: "cost_type" as FilterKey, label: "Cost Type" },
                    { key: "vendor" as FilterKey, label: "Vendor" },
                    { key: "detail_type" as FilterKey, label: "Detail Type" },
                  ].map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => {
                        setActiveFilterKey(option.key);
                        setFilterSearch("");
                        setShowFilterMenu(false);
                      }}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "budget_details" && activeFilterKey && (
          <div className="mb-4 bg-white border border-gray-200 rounded-md p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700 capitalize">
                  {activeFilterKey.replace("_", " ")}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setActiveFilterKey(null);
                    setFilterSearch("");
                  }}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  ×
                </button>
              </div>
              <button
                type="button"
                onClick={() =>
                  setSelectedFilters({
                    cost_code: [],
                    cost_type: [],
                    vendor: [],
                    detail_type: [],
                  })
                }
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Clear all
              </button>
            </div>
            <input
              type="text"
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              placeholder="Search"
              className="w-full mb-2 px-3 py-2 text-sm border border-gray-300 rounded-md"
            />
            <label className="flex items-center gap-2 px-1 py-1 text-sm font-semibold">
              <input
                type="checkbox"
                checked={
                  searchedFilterOptions.length > 0 &&
                  searchedFilterOptions.every((option) =>
                    selectedFilters[activeFilterKey].includes(option.value)
                  )
                }
                onChange={(e) => {
                  const values = searchedFilterOptions.map((option) => option.value);
                  setSelectedFilters((prev) => {
                    const nextSet = new Set(prev[activeFilterKey]);
                    if (e.target.checked) values.forEach((v) => nextSet.add(v));
                    else values.forEach((v) => nextSet.delete(v));
                    return { ...prev, [activeFilterKey]: Array.from(nextSet) };
                  });
                }}
              />
              Select all
            </label>
            <div className="max-h-60 overflow-auto">
              {searchedFilterOptions.map((option) => (
                <label key={option.value} className="flex items-center gap-2 px-1 py-1.5 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedFilters[activeFilterKey].includes(option.value)}
                    onChange={() => toggleFilterValue(activeFilterKey, option.value)}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* ── Forecasting toolbar ──────────────────────────────────────────────── */}
        {activeTab === "forecasting" && (
          <div className="mb-3 flex items-center gap-3 flex-wrap">
            {/* View selector */}
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">View</span>
              <div ref={forecastViewMenuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setShowForecastViewMenu((v) => !v)}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-300 rounded-md bg-white hover:bg-gray-50 min-w-[160px] justify-between"
                >
                  <span className="truncate">
                    {forecastingViews.find((v) => v.id === selectedForecastingViewId)?.name ?? "Select view"}
                  </span>
                  <svg
                    className={`w-3.5 h-3.5 text-gray-400 flex-shrink-0 transition-transform ${showForecastViewMenu ? "rotate-180" : ""}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showForecastViewMenu && (
                  <div className="absolute left-0 mt-1 w-64 bg-white border border-gray-200 rounded-md shadow-lg z-40">
                    {forecastingViews.length === 0 ? (
                      <p className="px-4 py-3 text-sm text-gray-400 italic">No views created yet</p>
                    ) : (
                      forecastingViews.map((view) => (
                        <button
                          key={view.id}
                          type="button"
                          onClick={() => {
                            setSelectedForecastingViewId(view.id);
                            setShowForecastViewMenu(false);
                          }}
                          className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${
                            selectedForecastingViewId === view.id ? "bg-gray-100 font-medium" : ""
                          }`}
                        >
                          {view.name}
                        </button>
                      ))
                    )}
                    <div className="border-t border-gray-200">
                      <button
                        type="button"
                        onClick={() => {
                          setShowForecastViewMenu(false);
                          setShowCreateForecastViewModal(true);
                        }}
                        className="w-full text-left px-4 py-2.5 text-sm text-orange-600 hover:bg-orange-50 font-medium flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                        </svg>
                        Create new forecasting view
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Group By */}
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Group</span>
              <div ref={forecastGroupMenuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setShowForecastGroupMenu((v) => !v)}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-300 rounded-md bg-white hover:bg-gray-50 min-w-[140px] justify-between"
                >
                  <span className="truncate">
                    {forecastGroupBy === "sub_job"
                      ? "Sub Job"
                      : forecastGroupBy === "cost_code_part_1"
                      ? "Cost Code Part 1"
                      : forecastGroupBy === "cost_code_part_2"
                      ? "Cost Code Part 2"
                      : "No grouping"}
                  </span>
                  {forecastGroupBy && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setForecastGroupBy(null);
                      }}
                      className="flex-shrink-0 w-4 h-4 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center text-gray-600 text-xs leading-none"
                      aria-label="Clear group by"
                    >
                      ×
                    </button>
                  )}
                  {!forecastGroupBy && (
                    <svg
                      className={`w-3.5 h-3.5 text-gray-400 flex-shrink-0 transition-transform ${showForecastGroupMenu ? "rotate-180" : ""}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  )}
                </button>
                {showForecastGroupMenu && (
                  <div className="absolute left-0 mt-1 w-52 bg-white border border-gray-200 rounded-md shadow-lg z-40">
                    {[
                      { key: "sub_job" as ForecastGroupByKey, label: "Sub Job" },
                      { key: "cost_code_part_1" as ForecastGroupByKey, label: "Cost Code Part 1" },
                      { key: "cost_code_part_2" as ForecastGroupByKey, label: "Cost Code Part 2" },
                    ].map((option) => (
                      <button
                        key={option.key}
                        type="button"
                        onClick={() => {
                          setForecastGroupBy(option.key);
                          setShowForecastGroupMenu(false);
                        }}
                        className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${
                          forecastGroupBy === option.key ? "bg-gray-100 font-medium" : ""
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                    <div className="border-t border-gray-200 p-2 flex justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          setForecastGroupBy(null);
                          setShowForecastGroupMenu(false);
                        }}
                        className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-md"
                      >
                        Reset
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Filter */}
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Filter</span>
              <div ref={forecastFilterMenuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setShowForecastFilterMenu((v) => !v)}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-300 rounded-md bg-white hover:bg-gray-50"
                >
                  <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
                  </svg>
                  Add Filter
                  {(Object.values(forecastSelectedFilters) as string[][]).some((arr) => arr.length > 0) && (
                    <span className="ml-1 bg-orange-100 text-orange-700 text-xs font-semibold px-1.5 py-0.5 rounded-full">
                      {(Object.values(forecastSelectedFilters) as string[][]).reduce((n, arr) => n + arr.length, 0)}
                    </span>
                  )}
                </button>
                {showForecastFilterMenu && (
                  <div className="absolute left-0 mt-1 w-56 bg-white border border-gray-200 rounded-md shadow-lg z-40 py-1">
                    {[
                      { key: "cost_code" as ForecastFilterKey, label: "Cost Code" },
                      { key: "description" as ForecastFilterKey, label: "Description" },
                      { key: "cost_type" as ForecastFilterKey, label: "Cost Type" },
                      { key: "sub_job" as ForecastFilterKey, label: "Sub Job" },
                    ].map((option) => (
                      <button
                        key={option.key}
                        type="button"
                        onClick={() => {
                          setForecastFilterKey(option.key);
                          setForecastFilterSearch("");
                          setShowForecastFilterMenu(false);
                        }}
                        className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center justify-between ${
                          forecastSelectedFilters[option.key].length > 0 ? "font-medium" : ""
                        }`}
                      >
                        <span>{option.label}</span>
                        {forecastSelectedFilters[option.key].length > 0 && (
                          <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full">
                            {forecastSelectedFilters[option.key].length}
                          </span>
                        )}
                      </button>
                    ))}
                    {(Object.values(forecastSelectedFilters) as string[][]).some((arr) => arr.length > 0) && (
                      <div className="border-t border-gray-200 p-2">
                        <button
                          type="button"
                          onClick={() => {
                            setForecastSelectedFilters({ cost_code: [], description: [], cost_type: [], sub_job: [] });
                            setForecastFilterKey(null);
                            setShowForecastFilterMenu(false);
                          }}
                          className="w-full text-sm text-red-600 hover:text-red-800 text-center py-1"
                        >
                          Clear all filters
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Forecasting active filter panel */}
        {activeTab === "forecasting" && forecastFilterKey && (
          <div className="mb-4 bg-white border border-gray-200 rounded-md p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700 capitalize">
                  {forecastFilterKey.replace(/_/g, " ")}
                </span>
                <button
                  type="button"
                  onClick={() => { setForecastFilterKey(null); setForecastFilterSearch(""); }}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  ×
                </button>
              </div>
              <button
                type="button"
                onClick={() => setForecastSelectedFilters({ cost_code: [], description: [], cost_type: [], sub_job: [] })}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Clear all
              </button>
            </div>
            <input
              type="text"
              value={forecastFilterSearch}
              onChange={(e) => setForecastFilterSearch(e.target.value)}
              placeholder="Search"
              className="w-full mb-2 px-3 py-2 text-sm border border-gray-300 rounded-md"
            />
            {(() => {
              const allValues = items.map((item) => {
                const tiers = parseCostCodeTiers(item.cost_code);
                if (forecastFilterKey === "cost_code") return item.cost_code;
                if (forecastFilterKey === "description") return item.description;
                if (forecastFilterKey === "cost_type") return item.cost_type?.trim() || "None";
                if (forecastFilterKey === "sub_job") return tiers.tier1;
                return "";
              });
              const unique = Array.from(new Set(allValues)).filter((v): v is string => Boolean(v)).sort();
              const filtered = unique.filter((v) =>
                v.toLowerCase().includes(forecastFilterSearch.toLowerCase())
              );
              const allChecked = filtered.length > 0 && filtered.every((v) => forecastSelectedFilters[forecastFilterKey].includes(v));
              return (
                <>
                  <label className="flex items-center gap-2 px-1 py-1 text-sm font-semibold">
                    <input
                      type="checkbox"
                      checked={allChecked}
                      onChange={(e) => {
                        setForecastSelectedFilters((prev) => {
                          const nextSet = new Set(prev[forecastFilterKey!]);
                          if (e.target.checked) filtered.forEach((v) => nextSet.add(v));
                          else filtered.forEach((v) => nextSet.delete(v));
                          return { ...prev, [forecastFilterKey!]: Array.from(nextSet) };
                        });
                      }}
                    />
                    Select all
                  </label>
                  <div className="max-h-60 overflow-auto">
                    {filtered.map((val) => (
                      <label key={val} className="flex items-center gap-2 px-1 py-1.5 text-sm">
                        <input
                          type="checkbox"
                          checked={forecastSelectedFilters[forecastFilterKey].includes(val)}
                          onChange={() =>
                            setForecastSelectedFilters((prev) => {
                              const nextSet = new Set(prev[forecastFilterKey!]);
                              if (nextSet.has(val)) nextSet.delete(val);
                              else nextSet.add(val);
                              return { ...prev, [forecastFilterKey!]: Array.from(nextSet) };
                            })
                          }
                        />
                        <span>{val}</span>
                      </label>
                    ))}
                  </div>
                </>
              );
            })()}
          </div>
        )}

        <div className={`grid grid-cols-1 gap-4 items-start ${!isBudgetLocked ? "xl:grid-cols-[minmax(0,1fr)_280px]" : ""}`}>
          <section>
            {/* Table */}
            {loading ? (
              <SkeletonTable rows={6} cols={8} />
            ) : activeTab === "budget" ? (
              <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
                <div className="overflow-auto max-h-[70vh]">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 z-20">
                      <tr className="border-b border-gray-100 bg-gray-50">
                        {COLS.map((col) => (
                          <th
                            key={col.key}
                            className={`text-left px-3 py-3 font-semibold text-gray-700 whitespace-nowrap bg-gray-50 ${col.width} ${
                              col.key === "description" ? "sticky left-0 z-30" : ""
                            }`}
                          >
                            {col.tooltip ? (
                              <ColumnTooltip label={col.label} tooltip={col.tooltip} />
                            ) : (
                              col.label
                            )}
                          </th>
                        ))}
                        <th className="px-3 py-3 w-10 bg-gray-50" />
                      </tr>
                    </thead>
                    <tbody>
                      {/* Line items */}
                      {items.length === 0 ? (
                        <tr>
                          <td colSpan={COLS.length + 1} className="px-3 py-12 text-center">
                            <p className="text-sm text-gray-400">No budget line items yet</p>
                            <p className="text-xs text-gray-300 mt-1">
                              Use the right panel to create your first budget code.
                            </p>
                          </td>
                        </tr>
                      ) : (
                        items.map((item) => (
                          <tr
                            key={item.id}
                            className="border-b border-gray-50 hover:bg-gray-50 transition-colors last:border-b-0 group"
                          >
                            {COLS.map((col) => (
                              <td
                                key={col.key}
                                className={`px-3 py-3 text-xs whitespace-nowrap ${
                                  col.key === "description" ? "sticky left-0 z-10 bg-white" : ""
                                }`}
                              >
                                {renderCell(item, col.key)}
                              </td>
                            ))}
                            {/* Row action menu */}
                            <td className="px-3 py-3 relative">
                              <div ref={rowMenuId === item.id ? rowMenuRef : undefined}>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setRowMenuId((prev) => (prev === item.id ? null : item.id));
                                  }}
                                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-all"
                                >
                                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                                  </svg>
                                </button>
                                {rowMenuId === item.id && (
                                  <div className="absolute right-0 bottom-8 w-36 bg-white border border-gray-100 rounded-xl shadow-lg py-1 z-30">
                                    <button
                                      onClick={() => { setEditingItem(item); setRowMenuId(null); }}
                                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      onClick={() => handleDeleteItem(item.id)}
                                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                                    >
                                      Delete
                                    </button>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}

                      {/* Totals row */}
                      <tr className="border-t border-gray-200 bg-gray-50 sticky bottom-0 z-20">
                        {COLS.map((col) => (
                          <td
                            key={col.key}
                            className={`px-3 py-3 text-xs whitespace-nowrap bg-gray-50 ${
                              col.key === "description" ? "sticky left-0 z-30" : ""
                            }`}
                          >
                            {renderCell(null, col.key)}
                          </td>
                        ))}
                        <td className="bg-gray-50" />
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            ) : activeTab === "forecasting" ? (() => {
              const FORECAST_COLS = [
                { key: "description", label: "Description", width: "min-w-[200px]" },
                { key: "sub_job", label: "Sub Job", width: "min-w-[100px]" },
                { key: "revised_budget", label: "Revised Budget", width: "min-w-[120px]" },
                { key: "projected_budget", label: "Projected Budget", width: "min-w-[120px]" },
                { key: "projected_costs", label: "Projected Costs", width: "min-w-[120px]" },
                { key: "forecast_to_complete", label: "Forecast to Complete", width: "min-w-[140px]" },
                { key: "estimated_cost_at_completion", label: "Est. Cost at Completion", width: "min-w-[150px]" },
                { key: "projected_over_under", label: "Projected Over/Under", width: "min-w-[140px]" },
              ];

              const filteredForecastItems = items.filter((item) => {
                const tiers = parseCostCodeTiers(item.cost_code);
                if (forecastSelectedFilters.cost_code.length > 0 && !forecastSelectedFilters.cost_code.includes(item.cost_code)) return false;
                if (forecastSelectedFilters.description.length > 0 && !forecastSelectedFilters.description.includes(item.description)) return false;
                if (forecastSelectedFilters.cost_type.length > 0 && !forecastSelectedFilters.cost_type.includes(item.cost_type?.trim() || "None")) return false;
                if (forecastSelectedFilters.sub_job.length > 0 && !forecastSelectedFilters.sub_job.includes(tiers.tier1)) return false;
                return true;
              });

              function getForecastGroupKey(item: BudgetLineItem): string {
                const tiers = parseCostCodeTiers(item.cost_code);
                if (forecastGroupBy === "sub_job") return tiers.tier1;
                if (forecastGroupBy === "cost_code_part_1") return tiers.tier1;
                if (forecastGroupBy === "cost_code_part_2") return tiers.tier2;
                return "";
              }

              const groupedForecastItems: [string, BudgetLineItem[]][] = forecastGroupBy
                ? Array.from(
                    filteredForecastItems.reduce((map, item) => {
                      const key = getForecastGroupKey(item);
                      if (!map.has(key)) map.set(key, []);
                      map.get(key)!.push(item);
                      return map;
                    }, new Map<string, BudgetLineItem[]>())
                  )
                : [];

              const forecastTotals = filteredForecastItems.reduce(
                (acc, item) => {
                  const c = getItemCalc(item);
                  acc.revisedBudget += c.revisedBudget;
                  acc.projectedBudget += c.projectedBudget;
                  acc.projectedCosts += c.projectedCosts;
                  acc.forecastToComplete += c.forecastToComplete;
                  acc.estimatedCostAtCompletion += c.estimatedCostAtCompletion;
                  acc.projectedOverUnder += c.projectedOverUnder;
                  return acc;
                },
                { revisedBudget: 0, projectedBudget: 0, projectedCosts: 0, forecastToComplete: 0, estimatedCostAtCompletion: 0, projectedOverUnder: 0 }
              );

              function renderForecastCell(item: BudgetLineItem | null, key: string) {
                if (item === null) {
                  switch (key) {
                    case "description": return <span className="font-semibold text-gray-900">Total</span>;
                    case "sub_job": return null;
                    case "revised_budget": return <span className="font-semibold">{fmt(forecastTotals.revisedBudget)}</span>;
                    case "projected_budget": return <span className="font-semibold">{fmt(forecastTotals.projectedBudget)}</span>;
                    case "projected_costs": return <span className="font-semibold">{fmt(forecastTotals.projectedCosts)}</span>;
                    case "forecast_to_complete": return <span className="font-semibold">{fmt(forecastTotals.forecastToComplete)}</span>;
                    case "estimated_cost_at_completion": return <span className="font-semibold">{fmt(forecastTotals.estimatedCostAtCompletion)}</span>;
                    case "projected_over_under": return (
                      <span className={`font-semibold ${forecastTotals.projectedOverUnder < 0 ? "text-red-600" : ""}`}>
                        {fmt(forecastTotals.projectedOverUnder)}
                      </span>
                    );
                    default: return null;
                  }
                }
                const tiers = parseCostCodeTiers(item.cost_code);
                const c = getItemCalc(item);
                switch (key) {
                  case "description":
                    return (
                      <div>
                        <p className="text-xs font-medium text-gray-500">{item.cost_code}</p>
                        <p className="text-xs text-blue-600">{item.description}</p>
                      </div>
                    );
                  case "sub_job": return <span className="text-gray-600">{tiers.tier1}</span>;
                  case "revised_budget": return fmt(c.revisedBudget);
                  case "projected_budget": return fmt(c.projectedBudget);
                  case "projected_costs": return fmt(c.projectedCosts);
                  case "forecast_to_complete":
                    return (
                      <button
                        type="button"
                        onClick={() => setSelectedForecastItemId(item.id)}
                        className="text-blue-600 hover:text-blue-800 underline underline-offset-2 decoration-blue-200"
                      >
                        {fmtWithArrow(c.forecastToComplete)}
                      </button>
                    );
                  case "estimated_cost_at_completion": return fmt(c.estimatedCostAtCompletion);
                  case "projected_over_under":
                    return (
                      <span className={c.projectedOverUnder < 0 ? "text-red-600" : ""}>
                        {fmt(c.projectedOverUnder)}
                      </span>
                    );
                  default: return null;
                }
              }

              return (
                <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
                  <div className="overflow-auto max-h-[70vh]">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 z-20">
                        <tr className="border-b border-gray-100 bg-gray-50">
                          {FORECAST_COLS.map((col) => (
                            <th
                              key={col.key}
                              className={`text-left px-3 py-3 font-semibold text-gray-700 whitespace-nowrap bg-gray-50 ${col.width} ${
                                col.key === "description" ? "sticky left-0 z-30" : ""
                              }`}
                            >
                              {col.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredForecastItems.length === 0 ? (
                          <tr>
                            <td colSpan={FORECAST_COLS.length} className="px-3 py-12 text-center text-sm text-gray-400">
                              No line items match the current filters
                            </td>
                          </tr>
                        ) : forecastGroupBy ? (
                          groupedForecastItems.map(([groupName, groupItems]) => (
                            <Fragment key={`fg-${groupName}`}>
                              <tr className="bg-gray-100 border-y border-gray-200">
                                <td colSpan={FORECAST_COLS.length} className="px-3 py-2 text-xs font-semibold text-gray-700">
                                  {groupName}
                                </td>
                              </tr>
                              {groupItems.map((item) => (
                                <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors last:border-b-0">
                                  {FORECAST_COLS.map((col) => (
                                    <td
                                      key={col.key}
                                      className={`px-3 py-3 text-xs whitespace-nowrap ${col.key === "description" ? "sticky left-0 z-10 bg-white" : ""}`}
                                    >
                                      {renderForecastCell(item, col.key)}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </Fragment>
                          ))
                        ) : (
                          filteredForecastItems.map((item) => (
                            <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors last:border-b-0">
                              {FORECAST_COLS.map((col) => (
                                <td
                                  key={col.key}
                                  className={`px-3 py-3 text-xs whitespace-nowrap ${col.key === "description" ? "sticky left-0 z-10 bg-white" : ""}`}
                                >
                                  {renderForecastCell(item, col.key)}
                                </td>
                              ))}
                            </tr>
                          ))
                        )}
                        {/* Totals row */}
                        <tr className="border-t border-gray-200 bg-gray-50 sticky bottom-0 z-20">
                          {FORECAST_COLS.map((col) => (
                            <td
                              key={col.key}
                              className={`px-3 py-3 text-xs whitespace-nowrap bg-gray-50 ${col.key === "description" ? "sticky left-0 z-30" : ""}`}
                            >
                              {renderForecastCell(null, col.key)}
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })() : activeTab === "budget_details" ? (
              <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
                <div className="overflow-auto max-h-[70vh]">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 z-20">
                      <tr className="border-b border-gray-100 bg-gray-50">
                        {DETAIL_COLS.map((col) => (
                          <th
                            key={col.key}
                            className={`text-left px-3 py-3 font-semibold text-gray-700 whitespace-nowrap bg-gray-50 ${col.width}`}
                          >
                            {col.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredBudgetDetailRows.length === 0 ? (
                        <tr>
                          <td colSpan={DETAIL_COLS.length} className="px-3 py-12 text-center text-sm text-gray-400">
                            No budget details available yet
                          </td>
                        </tr>
                      ) : groupBy ? (
                        groupedBudgetDetailRows.map(([groupName, rows]) => (
                          <Fragment key={`group-${groupName}`}>
                            <tr className="bg-gray-100 border-y border-gray-200">
                              <td colSpan={DETAIL_COLS.length} className="px-3 py-2 text-xs font-semibold text-gray-700">
                                {groupName}
                              </td>
                            </tr>
                            {rows.map((row) => (
                              <tr
                                key={row.id}
                                className="border-b border-gray-50 hover:bg-gray-50 transition-colors last:border-b-0"
                              >
                                {DETAIL_COLS.map((col) => (
                                  <td key={col.key} className="px-3 py-3 text-xs whitespace-nowrap">
                                    {renderDetailCell(row, col.key)}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </Fragment>
                        ))
                      ) : (
                        filteredBudgetDetailRows.map((row) => (
                          <tr
                            key={row.id}
                            className="border-b border-gray-50 hover:bg-gray-50 transition-colors last:border-b-0"
                          >
                            {DETAIL_COLS.map((col) => (
                              <td key={col.key} className="px-3 py-3 text-xs whitespace-nowrap">
                                {renderDetailCell(row, col.key)}
                              </td>
                            ))}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : activeTab === "project_status_snapshot" ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={exportSnapshotListCsv}
                    className="px-3 py-2 text-sm border border-gray-300 rounded-md bg-white hover:bg-gray-50"
                  >
                    Export Snapshot List (CSV)
                  </button>
                  <button
                    type="button"
                    disabled={selectedSnapshotIds.length !== 2}
                    onClick={compareSelectedSnapshots}
                    className={`px-3 py-2 text-sm rounded-md ${
                      selectedSnapshotIds.length === 2
                        ? "border border-gray-300 bg-white hover:bg-gray-50"
                        : "border border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed"
                    }`}
                  >
                    Analyze Variance (Select 2)
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white border border-gray-100 rounded-xl p-4">
                    <p className="text-xs uppercase tracking-wider text-gray-500">Projected Budget</p>
                    <p className="text-2xl font-semibold text-gray-900 mt-2">{fmt(totals.projectedBudget)}</p>
                  </div>
                  <div className="bg-white border border-gray-100 rounded-xl p-4">
                    <p className="text-xs uppercase tracking-wider text-gray-500">Estimated Cost at Completion</p>
                    <p className="text-2xl font-semibold text-gray-900 mt-2">{fmt(totals.estimatedCostAtCompletion)}</p>
                  </div>
                  <div className="bg-white border border-gray-100 rounded-xl p-4">
                    <p className="text-xs uppercase tracking-wider text-gray-500">Projected Over/Under</p>
                    <p className={`text-2xl font-semibold mt-2 ${totals.projectedOverUnder < 0 ? "text-red-600" : "text-gray-900"}`}>
                      {fmt(totals.projectedOverUnder)}
                    </p>
                  </div>
                </div>
                <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <h3 className="text-sm font-semibold text-gray-900">Saved Snapshots</h3>
                  </div>
                  {snapshots.length === 0 ? (
                    <p className="px-4 py-8 text-sm text-gray-400">No snapshots saved yet.</p>
                  ) : (
                    <ul className="divide-y divide-gray-100">
                      {snapshots.map((snapshot) => (
                        <li key={snapshot.id} className="px-4 py-3 text-sm flex items-center justify-between gap-4">
                          <label className="inline-flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={selectedSnapshotIds.includes(snapshot.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedSnapshotIds((prev) => [...prev, snapshot.id].slice(-2));
                                } else {
                                  setSelectedSnapshotIds((prev) => prev.filter((id) => id !== snapshot.id));
                                }
                              }}
                            />
                            <span className="text-gray-800">{snapshot.name}</span>
                          </label>
                          <div className="flex items-center gap-2">
                            <select
                              value={snapshot.status ?? "Draft"}
                              onChange={(e) =>
                                handleUpdateSnapshotStatus(
                                  snapshot.id,
                                  e.target.value as "Draft" | "Under Review" | "Approved" | "Archived"
                                )
                              }
                              className="text-xs border border-gray-300 rounded px-2 py-1 bg-white"
                            >
                              <option value="Draft">Draft</option>
                              <option value="Under Review">Under Review</option>
                              <option value="Approved">Approved</option>
                              <option value="Archived">Archived</option>
                            </select>
                            <span className="text-gray-500">{new Date(snapshot.created_at).toLocaleDateString("en-US")}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold text-gray-900">Line Item Variance Analysis</h3>
                    <select
                      value={snapshotVarianceMode}
                      onChange={(e) => setSnapshotVarianceMode(e.target.value as SnapshotVarianceMode)}
                      className="text-xs border border-gray-300 rounded px-2 py-1 bg-white"
                    >
                      <option value="comparison_and_variance">Comparison + Variance</option>
                      <option value="comparison_only">Comparison Only</option>
                      <option value="variance_only">Variance Only</option>
                    </select>
                  </div>
                  {!selectedSnapshotsForVariance ? (
                    <p className="px-4 py-6 text-sm text-gray-500">
                      Select two snapshots above, then click <span className="font-medium">Analyze Variance</span>.
                    </p>
                  ) : (
                    <div className="overflow-auto max-h-[40vh]">
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 z-10 bg-gray-50 border-b border-gray-100">
                          <tr>
                            <th className="text-left px-3 py-2 font-semibold text-gray-700">Budget Code</th>
                            <th className="text-left px-3 py-2 font-semibold text-gray-700">Description</th>
                            {snapshotVarianceMode !== "variance_only" && (
                              <>
                                <th className="text-left px-3 py-2 font-semibold text-gray-700">
                                  {selectedSnapshotsForVariance.left.name} Projected Budget
                                </th>
                                <th className="text-left px-3 py-2 font-semibold text-gray-700">
                                  {selectedSnapshotsForVariance.right.name} Projected Budget
                                </th>
                              </>
                            )}
                            {snapshotVarianceMode !== "comparison_only" && (
                              <th className="text-left px-3 py-2 font-semibold text-gray-700">Projected Budget Δ</th>
                            )}
                            {snapshotVarianceMode !== "comparison_only" && (
                              <th className="text-left px-3 py-2 font-semibold text-gray-700">Projected Costs Δ</th>
                            )}
                            {snapshotVarianceMode !== "comparison_only" && (
                              <th className="text-left px-3 py-2 font-semibold text-gray-700">Projected O/U Δ</th>
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {snapshotVarianceRows.map((row) => (
                            <tr key={row.key} className="border-b border-gray-50">
                              <td className="px-3 py-2 whitespace-nowrap">{row.budgetCode}</td>
                              <td className="px-3 py-2">{row.description}</td>
                              {snapshotVarianceMode !== "variance_only" && (
                                <>
                                  <td className="px-3 py-2 whitespace-nowrap">{fmt(row.leftProjectedBudget)}</td>
                                  <td className="px-3 py-2 whitespace-nowrap">{fmt(row.rightProjectedBudget)}</td>
                                </>
                              )}
                              {snapshotVarianceMode !== "comparison_only" && (
                                <td className={`px-3 py-2 whitespace-nowrap ${row.projectedBudgetVariance < 0 ? "text-red-600" : ""}`}>
                                  {fmt(row.projectedBudgetVariance)}
                                </td>
                              )}
                              {snapshotVarianceMode !== "comparison_only" && (
                                <td className={`px-3 py-2 whitespace-nowrap ${row.projectedCostsVariance < 0 ? "text-red-600" : ""}`}>
                                  {fmt(row.projectedCostsVariance)}
                                </td>
                              )}
                              {snapshotVarianceMode !== "comparison_only" && (
                                <td className={`px-3 py-2 whitespace-nowrap ${row.projectedOverUnderVariance < 0 ? "text-red-600" : ""}`}>
                                  {fmt(row.projectedOverUnderVariance)}
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-900">Budget Change History</h3>
                </div>
                {changeHistoryRows.length === 0 ? (
                  <p className="px-4 py-8 text-sm text-gray-400">No changes yet.</p>
                ) : (
                  <ul className="divide-y divide-gray-100">
                    {changeHistoryRows.map((entry) => (
                      <li key={entry.id} className="px-4 py-3 text-sm">
                        <p className="font-medium text-gray-800">{entry.label}</p>
                        <p className="text-gray-500 mt-0.5">
                          {entry.type} · {new Date(entry.date).toLocaleDateString("en-US")}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </section>

          {!isBudgetLocked && (activeTab === "budget" || activeTab === "budget_details") && (
          <aside className="bg-white border border-gray-100 rounded-xl p-4 space-y-2">
            <button
              onClick={() => {
                setLineItemDefaults(undefined);
                setShowLineItemModal(true);
              }}
              className="w-full px-3 py-2.5 text-sm font-medium text-white bg-gray-900 rounded-md hover:bg-gray-700 transition-colors text-left"
            >
              + Create Budget Line Item
            </button>
            <button
              onClick={() => setShowSnapshotModal(true)}
              className="w-full px-3 py-2.5 text-sm font-medium text-white bg-gray-900 rounded-md hover:bg-gray-700 transition-colors text-left"
            >
              + Create Snapshot
            </button>
            <button
              onClick={handleLockBudget}
              disabled={isBudgetLocked}
              className={`w-full px-3 py-2.5 text-sm font-medium rounded-md transition-colors text-left ${
                isBudgetLocked
                  ? "bg-gray-100 text-gray-500 border border-gray-200 cursor-not-allowed"
                  : "text-white bg-gray-900 hover:bg-gray-700"
              }`}
            >
              {isBudgetLocked ? "Budget Locked" : "Lock Budget"}
            </button>
            <div className="pt-4 space-y-3">
              <a
                href="#"
                onClick={(e) => { e.preventDefault(); handleDownloadTemplate(); }}
                className="block text-sm text-blue-600 hover:text-blue-800 underline underline-offset-2"
              >
                Download Excel Template
              </a>
              <input
                ref={importInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleImportBudgetFile}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => importInputRef.current?.click()}
                className="w-full px-3 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-md bg-white hover:bg-gray-50 transition-colors"
              >
                Import
              </button>
            </div>
          </aside>
          )}
        </div>
      </main>

      {selectedForecastItem && selectedForecastEdit && (
        <section className="fixed bottom-0 left-0 right-0 z-40 border-t border-gray-300 bg-white shadow-[0_-8px_24px_rgba(0,0,0,0.12)]">
          <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-[28px] leading-none font-semibold text-gray-700">
              Forecast To Complete for {selectedForecastItem.cost_code}
            </h3>
            <button
              type="button"
              onClick={() => setSelectedForecastItemId(null)}
              className="text-4xl leading-none text-gray-700 hover:text-black"
              aria-label="Close forecast editor"
            >
              ×
            </button>
          </div>
          <div className="px-5 py-3 max-h-[38vh] overflow-auto">
            <p className="text-lg font-semibold text-gray-900 mb-2">Calculation Method:</p>
            <div className="space-y-0.5 text-base leading-tight">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="forecast-method"
                  checked={selectedForecastEdit.method === "automatic"}
                  onChange={() => updateForecastEdit(selectedForecastItem.id, { method: "automatic", amount: null })}
                />
                <span>
                  Automatic Calculation{" "}
                  <span className="font-semibold">{fmt(calc(selectedForecastItem).forecastToComplete)}</span>
                </span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="forecast-method"
                  checked={selectedForecastEdit.method === "manual"}
                  onChange={() =>
                    updateForecastEdit(selectedForecastItem.id, {
                      method: "manual",
                      amount: selectedForecastEdit.amount ?? calc(selectedForecastItem).forecastToComplete,
                    })
                  }
                />
                <span>Manual Entry</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="forecast-method"
                  checked={selectedForecastEdit.method === "lump_sum"}
                  onChange={() =>
                    updateForecastEdit(selectedForecastItem.id, {
                      method: "lump_sum",
                      amount: selectedForecastEdit.amount ?? calc(selectedForecastItem).forecastToComplete,
                    })
                  }
                />
                <span>Lump Sum Entry</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="forecast-method"
                  checked={selectedForecastEdit.method === "monitored_resources"}
                  onChange={() =>
                    updateForecastEdit(selectedForecastItem.id, { method: "monitored_resources", amount: null })
                  }
                />
                <span>Monitored Resources</span>
              </label>
            </div>

            {(selectedForecastEdit.method === "manual" || selectedForecastEdit.method === "lump_sum") && (
              <div className="mt-3 max-w-sm">
                <label className="block text-lg font-semibold text-gray-900 mb-1">New Forecast Amount:</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={selectedForecastEdit.amount !== null ? String(selectedForecastEdit.amount) : ""}
                  onChange={(e) =>
                    updateForecastEdit(selectedForecastItem.id, { amount: numVal(e.target.value) })
                  }
                  className="w-full border border-gray-300 rounded px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                />
              </div>
            )}

            <div className="mt-3 max-w-md">
              <label className="block text-lg font-semibold text-gray-900 mb-1">Notes:</label>
              <textarea
                value={selectedForecastEdit.notes}
                onChange={(e) => updateForecastEdit(selectedForecastItem.id, { notes: e.target.value })}
                className="w-full h-24 border border-gray-300 rounded px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </section>
      )}

      {/* Modals */}
      {showLineItemModal && (
        <LineItemModal
          defaults={lineItemDefaults}
          onConfirm={handleAddLineItem}
          onCancel={() => {
            setShowLineItemModal(false);
            setLineItemDefaults(undefined);
          }}
        />
      )}
      {editingItem && (
        <LineItemModal
          initial={editingItem}
          lockOriginalBudgetAmount={isBudgetLocked}
          onConfirm={handleEditLineItem}
          onCancel={() => setEditingItem(null)}
        />
      )}
      {showSnapshotModal && (
        <SnapshotModal onConfirm={handleCreateSnapshot} onCancel={() => setShowSnapshotModal(false)} />
      )}
      {showBudgetChangeModal && (
        <BudgetChangeModal
          items={items}
          onConfirm={handleCreateBudgetChange}
          onCancel={() => setShowBudgetChangeModal(false)}
        />
      )}
      {showBudgetModificationModal && (
        <BudgetModificationModal
          items={items}
          onConfirm={handleCreateBudgetModification}
          onCancel={() => setShowBudgetModificationModal(false)}
        />
      )}
      {showErpModal && (
        <ErpConfirmModal onConfirm={handleErpResend} onCancel={() => setShowErpModal(false)} />
      )}
      {showCommittedCostsModal && (
        <CommittedCostsModal
          projectId={projectId}
          loading={committedCostsLoading}
          error={committedCostsError}
          data={committedCostsData}
          onClose={() => {
            setShowCommittedCostsModal(false);
            setCommittedCostsData(null);
            setCommittedCostsError(null);
          }}
        />
      )}
      {showCreateForecastViewModal && (
        <CreateForecastViewModal
          onConfirm={(name) => {
            const newView: ForecastingViewTemplate = {
              id: `view-${Date.now()}`,
              name,
              company_id: "",
              created_at: new Date().toISOString(),
            };
            setForecastingViews((prev) => [...prev, newView]);
            setSelectedForecastingViewId(newView.id);
            setShowCreateForecastViewModal(false);
          }}
          onCancel={() => setShowCreateForecastViewModal(false)}
        />
      )}
    </div>
  );
}

function CommittedCostsModal({
  projectId,
  loading,
  error,
  data,
  onClose,
}: {
  projectId: string;
  loading: boolean;
  error: string | null;
  data: CommittedCostsDetail | null;
  onClose: () => void;
}) {
  const sectionTitleClass = "text-sm font-semibold text-gray-900";
  const sectionCountClass = "text-xs text-gray-500";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-5xl max-h-[90vh] bg-white rounded-xl shadow-xl overflow-hidden">
        <div className="bg-gray-800 text-white px-4 py-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            Committed Costs {data?.cost_code ? `for ${data.cost_code}` : ""}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-white/80 hover:text-white text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="p-4 overflow-auto max-h-[calc(90vh-58px)]">
          {loading && <p className="text-sm text-gray-500">Loading committed cost details…</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}
          {!loading && !error && data && (
            <div className="space-y-6">
              <CommitmentSection
                projectId={projectId}
                title="Approved Subcontracts"
                items={data.subcontracts}
                sectionTitleClass={sectionTitleClass}
                sectionCountClass={sectionCountClass}
              />
              <CommitmentSection
                projectId={projectId}
                title="Approved Purchase Order Contracts"
                items={data.purchase_orders}
                sectionTitleClass={sectionTitleClass}
                sectionCountClass={sectionCountClass}
              />
              <div>
                <div className="flex items-baseline justify-between mb-2">
                  <h3 className={sectionTitleClass}>Approved Commitment Change Orders</h3>
                  <span className={sectionCountClass}>{data.commitment_change_orders.length} items</span>
                </div>
                {data.commitment_change_orders.length === 0 ? (
                  <p className="text-xs text-gray-500">No approved commitment change orders for this cost code.</p>
                ) : (
                  <table className="w-full text-xs border border-gray-200 rounded-lg overflow-hidden">
                    <thead className="bg-gray-50 text-gray-700">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold">Change Order</th>
                        <th className="px-3 py-2 text-left font-semibold">Company</th>
                        <th className="px-3 py-2 text-left font-semibold">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.commitment_change_orders.map((co) => (
                        <tr key={co.id} className="border-t border-gray-100">
                          <td className="px-3 py-2">
                            <Link
                              href={`/projects/${projectId}/change-orders/${co.id}`}
                              className="text-blue-700 hover:text-blue-900 hover:underline"
                            >
                              {co.number} - {co.title || "Untitled"}
                            </Link>
                          </td>
                          <td className="px-3 py-2">{co.contract_company || "—"}</td>
                          <td className="px-3 py-2">{fmt(co.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CommitmentSection({
  projectId,
  title,
  items,
  sectionTitleClass,
  sectionCountClass,
}: {
  projectId: string;
  title: string;
  items: CommitmentSummary[];
  sectionTitleClass: string;
  sectionCountClass: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <h3 className={sectionTitleClass}>{title}</h3>
        <span className={sectionCountClass}>{items.length} items</span>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-gray-500">No matching approved commitments for this cost code.</p>
      ) : (
        <div className="space-y-3">
          {items.map((commitment) => (
            <div key={commitment.id} className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-3 py-2 flex items-center justify-between gap-3 text-xs">
                <div className="min-w-0">
                  <Link
                    href={`/projects/${projectId}/commitments/${commitment.id}`}
                    className="text-blue-700 hover:text-blue-900 hover:underline"
                  >
                    #{commitment.number} - {commitment.title || "Untitled Commitment"}
                  </Link>
                  <p className="text-gray-500 truncate">{commitment.contract_company || "—"}</p>
                </div>
                <div className="font-semibold text-gray-900 whitespace-nowrap">{fmt(commitment.total_amount)}</div>
              </div>
              <table className="w-full text-xs">
                <thead className="bg-white text-gray-700">
                  <tr className="border-t border-gray-200">
                    <th className="px-3 py-2 text-left font-semibold">Description</th>
                    <th className="px-3 py-2 text-left font-semibold">QTY</th>
                    <th className="px-3 py-2 text-left font-semibold">UOM</th>
                    <th className="px-3 py-2 text-left font-semibold">Unit Cost</th>
                    <th className="px-3 py-2 text-left font-semibold">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {commitment.lines.map((line) => (
                    <tr key={line.id} className="border-t border-gray-100">
                      <td className="px-3 py-2">{line.description || "—"}</td>
                      <td className="px-3 py-2">{line.qty}</td>
                      <td className="px-3 py-2">{line.uom || "—"}</td>
                      <td className="px-3 py-2">{fmt(line.unit_cost)}</td>
                      <td className="px-3 py-2">{fmt(line.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CreateForecastViewModal({
  onConfirm,
  onCancel,
}: {
  onConfirm: (name: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-xl overflow-hidden">
        <div className="bg-gray-800 text-white px-4 py-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Create Forecasting View</h2>
          <button
            type="button"
            onClick={onCancel}
            className="text-white/80 hover:text-white text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">View Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Standard Forecast, Owner Report…"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              autoFocus
            />
          </div>
          <p className="text-xs text-gray-500">
            Forecasting views are available to all users at the company level.
          </p>
        </div>
        <div className="px-5 pb-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!name.trim()}
            onClick={() => onConfirm(name.trim())}
            className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Create View
          </button>
        </div>
      </div>
    </div>
  );
}
