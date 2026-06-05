"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ProjectNav from "@/components/ProjectNav";
import { deleteSavedReport, loadSavedReports, saveReport, type StoredReport } from "./saved-reports-store";
import { REPORT_TYPES, type ReportDef } from "./report-types";

// ─── Types ───────────────────────────────────────────────────────────────────

type VisualType = "table" | "bar" | "horizontal-bar" | "line" | "donut" | "stacked-bar" | "scorecard";

type VisualConfig = {
  visualType: VisualType;
  xAxisKey?: string;
  yAxisKey?: string;
  secondaryMeasureKey?: string;
  sortByKey?: string;
  sortDirection?: "asc" | "desc";
  showLegend?: boolean;
  showValueLabels?: boolean;
  showPoints?: boolean;
  maxBars?: number;
  useDualAxis?: boolean;
  decimalPlaces?: number;
  displayUnits?: "none" | "thousands" | "millions";
  selectedColumnKeys?: string[];
  groupByKey?: string;
};

type TemplateLaunchConfig = {
  visualConfig: VisualConfig;
  autoRun?: boolean;
  showConfiguration?: boolean;
};

type VisualCard = {
  id: string;
  title: string;
  description?: string;
  config: VisualConfig;
};

type FilterMode =
  | "matches"
  | "not_matches"
  | "contains"
  | "not_contains"
  | "starts_with"
  | "ends_with";

type ReportFilter = {
  id: string;
  columnKey: string;
  mode: FilterMode;
  values: string[];
};

const FILTER_MODES: { value: FilterMode; label: string }[] = [
  { value: "matches", label: "Matches" },
  { value: "not_matches", label: "Does not match" },
  { value: "contains", label: "Contains text" },
  { value: "not_contains", label: "Does not contain text" },
  { value: "starts_with", label: "Starts with" },
  { value: "ends_with", label: "Ends with" },
];

type SavedReport = {
  id: string;
  name: string;
  reportType: string;
  templateValue?: string;
  description: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  sharedWith: string[];
  sourceReportId?: string;
  calculatedColumns?: CalculatedColumn[];
  visualConfig?: VisualConfig;
  visualCards?: VisualCard[];
  filters?: ReportFilter[];
  lastRunRecordCount?: number;
  distributionCount?: number;
  lastDistributedAt?: string;
  promotedToCompanyAt?: string;
  promotedBy?: string;
  hasSingleToolTabs?: boolean;
};

type CalculatedColumnType = "basic" | "date-variance";
type CalculatedOutput = "number" | "currency" | "percent" | "date-variance";

type CalculatedColumn = {
  id: string;
  name: string;
  description?: string;
  type: CalculatedColumnType;
  output: CalculatedOutput;
  leftSource: string;
  operator: "+" | "-" | "*" | "/";
  rightSource: string;
  leftConstant?: number;
  rightConstant?: number;
  decimals: number;
  rounding: boolean;
};

type DashboardVisual = {
  id: string;
  reportId: string;
  reportName: string;
  title: string;
  metricLabel: string;
  metricValue: string;
  visualType: VisualType;
  summary?: string;
};

type SavedDashboard = {
  id: string;
  name: string;
  visualIds: string[];
  isPublished: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  sharedWith: string[];
};

type SnapshotSchedule = "one-time" | "daily" | "weekly" | "monthly";
type AggregateFunction = "none" | "count" | "sum" | "min" | "max" | "avg";


const GROUPS = Array.from(new Set(REPORT_TYPES.map((r) => r.group)));


function getTemplateLaunchConfig(reportDef: ReportDef): TemplateLaunchConfig {
  const allColumnKeys = reportDef.columns.map((column) => column.key);

  const groupByKeyByTemplate: Record<string, string> = {
    "daily-delays": "delay_type",
    "daily-manpower": "company",
    "daily-weather": "sky",
    "daily-safety": "issued_to",
    "daily-accidents": "company_involved",
    "daily-inspections": "inspection_type",
    "daily-deliveries": "delivery_from",
    "daily-visitors": "visitor",
    "daily-notes": "is_issue",
    "commitments-summary": "contract_company",
    "change-events": "status",
    "commitment-change-orders": "status",
    "budget-summary": "cost_code",
    rfis: "status",
    submittals: "status",
    tasks: "status",
    "punch-list": "status",
  };

  const sortByKeyByTemplate: Record<string, string> = {
    "daily-delays": "log_date",
    "daily-manpower": "log_date",
    "daily-weather": "log_date",
    "daily-safety": "log_date",
    "daily-accidents": "log_date",
    "daily-inspections": "log_date",
    "daily-deliveries": "log_date",
    "daily-visitors": "log_date",
    "daily-notes": "log_date",
    "commitments-summary": "contract_company",
    "change-events": "created_at",
    "commitment-change-orders": "number",
    "budget-summary": "cost_code",
    rfis: "due_date",
    submittals: "submit_by",
    tasks: "created_at",
    "punch-list": "due_date",
  };

  const measureKeyByTemplate: Record<string, string> = {
    "daily-delays": "duration_hours",
    "daily-manpower": "workers",
    "commitments-summary": "original_contract_amount",
    "commitment-change-orders": "amount",
    "budget-summary": "variance",
  };

  const groupByKey = groupByKeyByTemplate[reportDef.value];
  const sortByKey = sortByKeyByTemplate[reportDef.value];

  return {
    autoRun: true,
    showConfiguration: true,
    visualConfig: {
      visualType: "table",
      selectedColumnKeys: allColumnKeys,
      groupByKey: groupByKey && allColumnKeys.includes(groupByKey) ? groupByKey : undefined,
      sortByKey: sortByKey && allColumnKeys.includes(sortByKey) ? sortByKey : undefined,
      sortDirection: reportDef.hasDateRange ? "desc" : "asc",
      yAxisKey: measureKeyByTemplate[reportDef.value],
      showLegend: true,
      showValueLabels: false,
      showPoints: false,
      maxBars: 10,
      useDualAxis: false,
      decimalPlaces: 2,
      displayUnits: "none",
    },
  };
}

// ─── Report sections (left-side tree on the Reports tab) ──────────────────────

type SectionId =
  | "my-reports"
  | "assigned-reports"
  | "popular-templates"
  | "canned-erp"
  | "canned-project"
  | "canned-financial"
  | "canned-schedule"
  | "canned-daily-log";

type SectionKind = "my-reports" | "assigned-reports" | "templates";

type ReportSection = {
  id: SectionId;
  title: string;
  description: string;
  kind: SectionKind;
  templateValues?: string[];
};

const POPULAR_TEMPLATE_VALUES = REPORT_TYPES.map((r) => r.value);
const CANNED_ERP_VALUES = ["commitments-summary", "budget-summary"];
const CANNED_PROJECT_VALUES = ["rfis", "submittals", "tasks", "punch-list"];
const CANNED_FINANCIAL_VALUES = [
  "commitments-summary",
  "change-events",
  "commitment-change-orders",
  "budget-summary",
];
const CANNED_SCHEDULE_VALUES: string[] = [];
const CANNED_DAILY_LOG_VALUES = REPORT_TYPES.filter((r) => r.group === "Daily Log").map((r) => r.value);

const REPORT_SECTIONS: ReportSection[] = [
  {
    id: "my-reports",
    title: "My Reports",
    description:
      "Custom reports you've made or were shared with you and any Assigned Reports you've customized. These are only viewable to you.",
    kind: "my-reports",
  },
  {
    id: "assigned-reports",
    title: "Assigned Reports",
    description:
      "Reports assigned to you by the company. Data in Assigned Reports is relative to projects and permissions.",
    kind: "assigned-reports",
  },
  {
    id: "popular-templates",
    title: "Popular Templates",
    description:
      "A selection of the most used Templates across Site Command. Templates are customizable, industry-standard reports provided by Site Command. Data shown in reports is relative to projects and permissions.",
    kind: "templates",
    templateValues: POPULAR_TEMPLATE_VALUES,
  },
  {
    id: "canned-erp",
    title: "Canned ERP Reports",
    description:
      "Non-customizable reports provided by Site Command. Data shown in reports is relative to projects and permissions.",
    kind: "templates",
    templateValues: CANNED_ERP_VALUES,
  },
  {
    id: "canned-project",
    title: "Canned Project Reports",
    description:
      "Non-customizable reports provided by Site Command. Data shown in reports is relative to projects and permissions.",
    kind: "templates",
    templateValues: CANNED_PROJECT_VALUES,
  },
  {
    id: "canned-financial",
    title: "Canned Financial Reports",
    description:
      "Non-customizable reports provided by Site Command. Data shown in reports is relative to projects and permissions.",
    kind: "templates",
    templateValues: CANNED_FINANCIAL_VALUES,
  },
  {
    id: "canned-schedule",
    title: "Canned Schedule Reports",
    description:
      "Non-customizable reports provided by Site Command. Data shown in reports is relative to projects and permissions.",
    kind: "templates",
    templateValues: CANNED_SCHEDULE_VALUES,
  },
  {
    id: "canned-daily-log",
    title: "Canned Daily Log Reports",
    description:
      "Non-customizable reports provided by Site Command. Data shown in reports is relative to projects and permissions.",
    kind: "templates",
    templateValues: CANNED_DAILY_LOG_VALUES,
  },
];
const VIEWER_OPTIONS = ["Company Admins", "Project Managers", "Field Team", "Executives"];
const VISUAL_TYPE_OPTIONS: { value: VisualType; label: string; description: string }[] = [
  { value: "table", label: "Tabular Report", description: "Detailed row and column output for audits and exports." },
  { value: "bar", label: "Bar Chart", description: "Compare values across categories." },
  { value: "horizontal-bar", label: "Horizontal Bar Chart", description: "Compare categories with long labels." },
  { value: "line", label: "Line Chart", description: "Trend values over time or sequence." },
  { value: "donut", label: "Donut Chart", description: "Show proportion-of-total by category." },
  { value: "stacked-bar", label: "Stacked Bar Chart", description: "Compare totals with part-to-whole composition." },
  { value: "scorecard", label: "Scorecard", description: "Highlight a single KPI for dashboard headers." },
];
const NUMERIC_COLUMN_HINTS = [
  "amount",
  "cost",
  "price",
  "qty",
  "quantity",
  "hours",
  "count",
  "total",
  "variance",
  "duration",
  "rate",
  "percent",
  "score",
  "days",
  "value",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "numeric" });
}

function formatCell(key: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (key === "log_date" || key === "created_at")
    return new Date(value as string).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  if (key === "is_issue") return value ? "Issue" : "Note";
  if (key === "delay") return value ? "Yes" : "No";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function toNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toDayNumber(value: unknown): number {
  const ms = new Date(String(value)).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function roundWithPrecision(value: number, decimals: number, rounding: boolean): number {
  const factor = 10 ** Math.max(0, decimals);
  const scaled = value * factor;
  const adjusted = rounding ? Math.round(scaled) : Math.trunc(scaled);
  return adjusted / factor;
}

function applyCalculatedColumns(rows: Record<string, unknown>[], columns: CalculatedColumn[]): Record<string, unknown>[] {
  if (columns.length === 0) return rows;

  return rows.map((row) => {
    const nextRow = { ...row };
    for (const col of columns) {
      const leftRaw = col.leftSource === "constant" ? col.leftConstant ?? 0 : row[col.leftSource];
      const rightRaw = col.rightSource === "constant" ? col.rightConstant ?? 0 : row[col.rightSource];

      let result = 0;
      if (col.type === "date-variance" || col.output === "date-variance") {
        result = Math.floor((toDayNumber(leftRaw) - toDayNumber(rightRaw)) / (1000 * 60 * 60 * 24));
      } else {
        const left = toNumber(leftRaw);
        const right = toNumber(rightRaw);
        if (col.operator === "+") result = left + right;
        if (col.operator === "-") result = left - right;
        if (col.operator === "*") result = left * right;
        if (col.operator === "/") result = right === 0 ? 0 : left / right;
      }

      const numeric = roundWithPrecision(result, col.decimals, col.rounding);
      nextRow[col.id] = numeric;
    }
    return nextRow;
  });
}

function calculateAggregate(rows: Record<string, unknown>[], key: string, fn: AggregateFunction): string {
  if (fn === "none") return "";
  if (fn === "count") return String(rows.length);
  const numeric = rows.map((row) => toNumber(row[key]));
  if (numeric.length === 0) return "0";
  if (fn === "sum") return String(numeric.reduce((sum, value) => sum + value, 0));
  if (fn === "min") return String(Math.min(...numeric));
  if (fn === "max") return String(Math.max(...numeric));
  if (fn === "avg") return String(roundWithPrecision(numeric.reduce((sum, value) => sum + value, 0) / numeric.length, 2, true));
  return "";
}

function getAggregateFunctionsForColumn(key: string): AggregateFunction[] {
  const normalized = key.toLowerCase();
  const isNumeric = NUMERIC_COLUMN_HINTS.some((hint) => normalized.includes(hint));
  return isNumeric ? ["count", "sum", "min", "max", "avg"] : ["count"];
}

function applyReportFilters(
  rows: Record<string, unknown>[],
  filters: ReportFilter[],
): Record<string, unknown>[] {
  const active = filters.filter((f) => f.columnKey && f.values.length > 0);
  if (active.length === 0) return rows;
  return rows.filter((row) =>
    active.every((f) => {
      const cell = row[f.columnKey];
      const raw = cell === null || cell === undefined ? "" : String(cell);
      const lower = raw.toLowerCase();
      switch (f.mode) {
        case "matches":
          return f.values.some((fv) => raw === fv);
        case "not_matches":
          return f.values.every((fv) => raw !== fv);
        case "contains":
          return f.values.some((fv) => lower.includes(fv.toLowerCase()));
        case "not_contains":
          return f.values.every((fv) => !lower.includes(fv.toLowerCase()));
        case "starts_with":
          return f.values.some((fv) => lower.startsWith(fv.toLowerCase()));
        case "ends_with":
          return f.values.some((fv) => lower.endsWith(fv.toLowerCase()));
        default:
          return true;
      }
    }),
  );
}

function distinctColumnValues(rows: Record<string, unknown>[], columnKey: string): string[] {
  const set = new Set<string>();
  for (const r of rows) {
    const v = r[columnKey];
    set.add(v === null || v === undefined ? "" : String(v));
  }
  return Array.from(set).sort((a, b) => {
    if (a === "" && b !== "") return -1;
    if (b === "" && a !== "") return 1;
    return a.localeCompare(b, undefined, { numeric: true });
  });
}

function toCSV(columns: { key: string; label: string }[], rows: Record<string, unknown>[]): string {
  const header = columns.map((c) => `"${c.label}"`).join(",");
  const body = rows
    .map((row) => columns.map((c) => `"${formatCell(c.key, row[c.key]).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  return `${header}\n${body}`;
}

function downloadCSV(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function downloadXLSX(filename: string, columns: { key: string; label: string }[], rows: Record<string, unknown>[]) {
  const xlsx = await import("xlsx");
  const exportRows = rows.map((row) =>
    Object.fromEntries(columns.map((col) => [col.label, formatCell(col.key, row[col.key])]))
  );
  const wb = xlsx.utils.book_new();
  const ws = xlsx.utils.json_to_sheet(exportRows);
  xlsx.utils.book_append_sheet(wb, ws, "Report");
  xlsx.writeFile(wb, filename);
}

function makeVisualFromReport(report: SavedReport): DashboardVisual {
  const visualType = report.visualConfig?.visualType ?? "table";
  const selectedXAxis = report.visualConfig?.xAxisKey ? `X: ${report.visualConfig.xAxisKey}` : "";
  const selectedYAxis = report.visualConfig?.yAxisKey ? `Y: ${report.visualConfig.yAxisKey}` : "";
  return {
    id: `visual-${report.id}`,
    reportId: report.id,
    reportName: report.name,
    title: `${report.name} · Snapshot`,
    metricLabel: "Last Updated",
    metricValue: fmtDate(report.updatedAt),
    visualType,
    summary: [selectedXAxis, selectedYAxis].filter(Boolean).join(" · ") || undefined,
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TypeBadge({ group }: { group: string }) {
  const label =
    group === "Daily Log"
      ? "Daily Log Report"
      : group === "Financial Management"
      ? "Financial Report"
      : "Single Tool Report";
  const cls =
    group === "Financial Management"
      ? "border-emerald-200 text-emerald-700 bg-emerald-50"
      : "border-gray-300 text-gray-600";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs whitespace-nowrap ${cls}`}>
      {label}
    </span>
  );
}

function SavedTypeBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded border border-gray-300 text-xs text-gray-600 whitespace-nowrap">
      {label}
    </span>
  );
}

function RowMenu({ actions }: { actions: { label: string; onClick: () => void; danger?: boolean }[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <circle cx="10" cy="4" r="1.5" />
          <circle cx="10" cy="10" r="1.5" />
          <circle cx="10" cy="16" r="1.5" />
        </svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-8 z-20 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[160px]">
            {actions.map((action) => (
              <button
                key={action.label}
                onClick={() => {
                  setOpen(false);
                  action.onClick();
                }}
                className={`w-full text-left px-4 py-2 text-sm ${action.danger ? "text-red-600 hover:bg-red-50" : "text-gray-700 hover:bg-gray-50"}`}
              >
                {action.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function SectionHeader({
  title,
  count,
  subtitle,
  open,
  onToggle,
}: {
  title: string;
  count: number;
  subtitle: React.ReactNode;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="mb-2">
      <div className="flex items-center justify-between">
        <button
          onClick={onToggle}
          className="flex items-center gap-2 text-sm font-semibold text-gray-900 hover:text-gray-700 transition-colors"
        >
          <svg
            className={`w-4 h-4 text-gray-500 transition-transform ${open ? "" : "-rotate-90"}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
          {title} <span className="font-normal text-gray-500">({count})</span>
        </button>
      </div>
      {subtitle && <p className="text-xs text-gray-400 mt-0.5 ml-6">{subtitle}</p>}
    </div>
  );
}

function TabButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
        active ? "bg-[color:var(--ink)] text-white" : "bg-white text-gray-700 hover:bg-gray-50"
      }`}
    >
      {label}
    </button>
  );
}

function SectionCard({
  section,
  open,
  onToggle,
  onViewAll,
  search,
  myReports,
  templates,
  onOpenSaved,
  onOpenTemplate,
  onPreviewTemplate,
  onAddVisual,
  onEditReport,
  onShareReport,
  onDistribute,
  onPreviewInDashboard,
  onPromote,
  onCloneReport,
  onDeleteReport,
}: {
  section: ReportSection;
  open: boolean;
  onToggle: () => void;
  onViewAll: () => void;
  search: string;
  myReports: SavedReport[];
  templates: ReportDef[];
  onOpenSaved: (r: SavedReport) => void;
  onOpenTemplate: (r: ReportDef) => void;
  onPreviewTemplate: (r: ReportDef) => void;
  onAddVisual: (r: SavedReport) => void;
  onEditReport: (id: string) => void;
  onShareReport: (id: string) => void;
  onDistribute: (id: string) => void;
  onPreviewInDashboard: (id: string) => void;
  onPromote: (id: string) => void;
  onCloneReport: (r: SavedReport) => void;
  onDeleteReport: (id: string) => void;
}) {
  const q = search.trim().toLowerCase();

  const items = useMemo(() => {
    if (section.kind === "my-reports") return myReports;
    if (section.kind === "assigned-reports") {
      return myReports.filter((r) => r.promotedToCompanyAt);
    }
    const allowed = new Set(section.templateValues ?? []);
    const filtered = templates.filter((t) => allowed.has(t.value));
    if (!q) return filtered;
    return filtered.filter(
      (t) =>
        t.label.toLowerCase().includes(q) ||
        t.group.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q)
    );
  }, [section, myReports, templates, q]);

  const filteredSaved = useMemo(() => {
    if (section.kind === "templates") return [];
    if (!q) return items as SavedReport[];
    return (items as SavedReport[]).filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.reportType.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q)
    );
  }, [items, q, section.kind]);

  const count =
    section.kind === "templates"
      ? (items as ReportDef[]).length
      : filteredSaved.length;

  return (
    <div id={`section-${section.id}`} className="bg-white border hairline rounded-xl">
      <div className="flex items-start justify-between px-4 pt-3 pb-2 gap-4">
        <button
          onClick={onToggle}
          className="flex items-center gap-2 text-left flex-1 min-w-0 group"
        >
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform shrink-0 ${open ? "" : "-rotate-90"}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
          <h3 className="h3-warm group-hover:opacity-80">
            {section.title} <span className="num text-gray-400" style={{ fontFamily: "inherit" }}>({count})</span>
          </h3>
        </button>
        <button
          onClick={onViewAll}
          className="btn-quiet shrink-0"
        >
          View All
        </button>
      </div>
      <p className="px-4 pb-3 pl-10 text-xs text-gray-500">{section.description}</p>

      {open && (
        <div className="border-t hairline">
          {section.kind === "templates" ? (
            (items as ReportDef[]).length === 0 ? (
              <div className="py-8 text-center text-xs text-gray-400">
                {q
                  ? "No templates match your search."
                  : "No reports in this category yet."}
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b hairline bg-[color:var(--surface-sunken)]">
                    <th className="px-4 py-3 text-left mono-label w-64">Report Name</th>
                    <th className="px-4 py-3 text-left mono-label w-44">Report Type</th>
                    <th className="px-4 py-3 text-left mono-label">Description</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {(items as ReportDef[]).map((r, idx) => (
                    <tr
                      key={r.value}
                      className="border-b border-gray-50 last:border-b-0 hover:bg-[color:var(--surface-sunken)] transition-colors cursor-pointer"
                      onClick={() => onOpenTemplate(r)}
                    >
                      <td className="px-4 py-3">
                        <span className="idx-italic mr-2">{String(idx + 1).padStart(2, "0")}</span>
                        <span className="font-medium text-gray-900">{r.label}</span>
                      </td>
                      <td className="px-4 py-3">
                        <TypeBadge group={r.group} />
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 max-w-sm">{r.description}</td>
                      <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                        <RowMenu
                          actions={[
                            { label: "Preview Template", onClick: () => onPreviewTemplate(r) },
                            { label: "Use Template", onClick: () => onOpenTemplate(r) },
                          ]}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : filteredSaved.length === 0 ? (
            <div className="py-8 text-center text-xs text-gray-400">
              {section.kind === "my-reports"
                ? q
                  ? "No saved reports match your search."
                  : "No saved reports yet. Run a template and click “Save Report”."
                : q
                ? "No assigned reports match your search."
                : "No reports have been assigned to you yet."}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b hairline bg-[color:var(--surface-sunken)]">
                  <th className="px-4 py-3 text-left mono-label w-64">Report Name</th>
                  <th className="px-4 py-3 text-left mono-label w-44">Report Type</th>
                  <th className="px-4 py-3 text-left mono-label">Description</th>
                  <th className="px-4 py-3 text-left mono-label w-32">Created By</th>
                  <th className="px-4 py-3 text-left mono-label w-28">Date Created</th>
                  <th className="px-4 py-3 text-left mono-label w-28">Last Modified</th>
                  <th className="px-4 py-3 text-left mono-label w-20">Visuals</th>
                  <th className="px-4 py-3 text-left mono-label w-36">Last Snapshot</th>
                  <th className="px-4 py-3 text-left mono-label w-36">Company Level</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {filteredSaved.map((r, idx) => (
                  <tr
                    key={r.id}
                    className="border-b border-gray-50 last:border-b-0 hover:bg-[color:var(--surface-sunken)] transition-colors cursor-pointer"
                    onClick={() => onOpenSaved(r)}
                  >
                    <td className="px-4 py-3">
                      <span className="idx-italic mr-2">{String(idx + 1).padStart(2, "0")}</span>
                      <span className="font-medium text-gray-900">{r.name}</span>
                    </td>
                    <td className="px-4 py-3">
                      <SavedTypeBadge label={r.reportType} />
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs max-w-xs truncate">{r.description}</td>
                    <td className="px-4 py-3 text-gray-600">{r.createdBy}</td>
                    <td className="px-4 py-3 text-gray-500 tabular-nums">{fmtDate(r.createdAt)}</td>
                    <td className="px-4 py-3 text-gray-500 tabular-nums">{fmtDate(r.updatedAt)}</td>
                    <td className="px-4 py-3 text-gray-500 tabular-nums">{Math.max(1, r.visualCards?.length ?? 0)}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {r.lastDistributedAt ? `${fmtDate(r.lastDistributedAt)} (${r.distributionCount ?? 1})` : "Never"}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {r.promotedToCompanyAt ? (
                        <span className="pill pill-open">Promoted {fmtDate(r.promotedToCompanyAt)}</span>
                      ) : (
                        <span className="text-gray-500">Project Only</span>
                      )}
                    </td>
                    <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                      <RowMenu
                        actions={[
                          { label: "Run Report", onClick: () => onOpenSaved(r) },
                          { label: "Edit (Visuals & Layout)", onClick: () => onOpenSaved(r) },
                          { label: "Add Visual", onClick: () => onAddVisual(r) },
                          { label: "Edit Report", onClick: () => onEditReport(r.id) },
                          { label: "Share Report", onClick: () => onShareReport(r.id) },
                          { label: "Distribute Snapshot", onClick: () => onDistribute(r.id) },
                          { label: "Preview in Dashboard", onClick: () => onPreviewInDashboard(r.id) },
                          { label: "Promote to Company", onClick: () => onPromote(r.id) },
                          { label: "Make a Copy", onClick: () => onCloneReport(r) },
                          { label: "Delete", onClick: () => onDeleteReport(r.id), danger: true },
                        ]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

type PermissionLevel = "none" | "standard" | "admin" | "template";
type PermissionRow = { id: string; name: string; reporting: PermissionLevel; directory: PermissionLevel };

function ReportingSettingsModal({
  rows,
  onClose,
  onSave,
}: {
  rows: PermissionRow[];
  onClose: () => void;
  onSave: (rows: PermissionRow[]) => void;
}) {
  const [draft, setDraft] = useState(rows);

  function setLevel(userId: string, tool: "reporting" | "directory", level: PermissionLevel) {
    setDraft((prev) => prev.map((row) => (row.id === userId ? { ...row, [tool]: level } : row)));
  }

  const iconClass = (active: boolean, color: "green" | "red" | "gray") =>
    `w-7 h-7 rounded-full border flex items-center justify-center text-xs ${active ? (color === "green" ? "bg-emerald-100 border-emerald-300 text-emerald-700" : color === "red" ? "bg-red-100 border-red-300 text-red-700" : "bg-gray-100 border-gray-300 text-gray-600") : "border-gray-200 text-gray-300"}`;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl p-6">
        <h2 className="text-sm font-semibold text-gray-900">Configure Settings · User Permissions for Reports</h2>
        <p className="text-xs text-gray-500 mt-1">Grant access so a green check appears for each tool permission level.</p>
        <div className="mt-3 rounded-md border border-blue-100 bg-blue-50 p-3 text-xs text-blue-900">
          Required to align with Project 360 Reporting setup: Admin on Reporting and Admin on Project Directory.
        </div>
        <div className="mt-4 border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-3 py-2 text-left text-xs text-gray-500">User</th>
                <th className="px-3 py-2 text-left text-xs text-gray-500">360 Reporting</th>
                <th className="px-3 py-2 text-left text-xs text-gray-500">Project Directory</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {draft.map((row) => (
                <tr key={row.id}>
                  <td className="px-3 py-2 text-gray-700">{row.name}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <button onClick={() => setLevel(row.id, "reporting", "admin")} className={iconClass(row.reporting === "admin", "green")}>✓</button>
                      <button onClick={() => setLevel(row.id, "reporting", "none")} className={iconClass(row.reporting === "none", "red")}>✕</button>
                      <button onClick={() => setLevel(row.id, "reporting", "template")} className={iconClass(row.reporting === "template", "gray")}>●</button>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <button onClick={() => setLevel(row.id, "directory", "admin")} className={iconClass(row.directory === "admin", "green")}>✓</button>
                      <button onClick={() => setLevel(row.id, "directory", "none")} className={iconClass(row.directory === "none", "red")}>✕</button>
                      <button onClick={() => setLevel(row.id, "directory", "template")} className={iconClass(row.directory === "template", "gray")}>●</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 py-2 border border-gray-200 rounded-md text-sm text-gray-600">Cancel</button>
          <button onClick={() => onSave(draft)} className="flex-1 py-2 bg-gray-900 text-white rounded-md text-sm">Save Settings</button>
        </div>
      </div>
    </div>
  );
}

// ─── Filters ─────────────────────────────────────────────────────────────────

function AddFilterDropdown({
  categoryLabel,
  columns,
  onSelect,
}: {
  categoryLabel: string;
  columns: { key: string; label: string }[];
  onSelect: (columnKey: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"categories" | "fields">("categories");
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setStep("categories");
        setSearch("");
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const filteredCategories = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [{ label: categoryLabel }];
    return categoryLabel.toLowerCase().includes(q) ? [{ label: categoryLabel }] : [];
  }, [search, categoryLabel]);

  const filteredFields = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return columns;
    return columns.filter((c) => c.label.toLowerCase().includes(q));
  }, [search, columns]);

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          setStep("categories");
          setSearch("");
        }}
        className="w-full flex items-center justify-between px-3 py-2 border border-gray-200 rounded-md text-sm text-gray-500 bg-white hover:border-gray-300"
      >
        Add Filters...
        <span className="text-gray-400">▾</span>
      </button>
      {open && (
        <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-30 max-h-80 overflow-hidden flex flex-col">
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={step === "categories" ? "Search Filters" : "Search Fields"}
                className="w-full pl-2 pr-7 py-1.5 border-2 border-blue-500 rounded text-sm focus:outline-none"
                autoFocus
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
            </div>
          </div>
          <div className="overflow-y-auto">
            {step === "categories" && (
              <>
                {filteredCategories.length === 0 ? (
                  <p className="px-3 py-3 text-xs text-gray-400">No matches.</p>
                ) : (
                  filteredCategories.map((cat) => (
                    <button
                      key={cat.label}
                      type="button"
                      onClick={() => {
                        setStep("fields");
                        setSearch("");
                      }}
                      className="w-full flex items-center justify-between px-3 py-2.5 text-sm text-gray-800 hover:bg-gray-50"
                    >
                      <span>{cat.label}</span>
                      <span className="text-gray-400">›</span>
                    </button>
                  ))
                )}
              </>
            )}
            {step === "fields" && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setStep("categories");
                    setSearch("");
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-500 hover:bg-gray-50 border-b border-gray-100"
                >
                  ‹ Back to filters
                </button>
                <p className="px-3 pt-2 pb-1 text-[11px] uppercase tracking-wide text-gray-400">{categoryLabel}</p>
                {filteredFields.length === 0 ? (
                  <p className="px-3 py-3 text-xs text-gray-400">No matching fields.</p>
                ) : (
                  filteredFields.map((col) => (
                    <button
                      key={col.key}
                      type="button"
                      onClick={() => {
                        onSelect(col.key);
                        setOpen(false);
                        setStep("categories");
                        setSearch("");
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-gray-800 hover:bg-gray-50"
                    >
                      {col.label}
                    </button>
                  ))
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function FilterValuePicker({
  mode,
  values,
  suggestions,
  onChange,
}: {
  mode: FilterMode;
  values: string[];
  suggestions: string[];
  onChange: (values: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isFreeText = mode === "contains" || mode === "not_contains" || mode === "starts_with" || mode === "ends_with";

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const filteredSuggestions = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = suggestions.filter((s) => !values.includes(s));
    if (!q) return base;
    return base.filter((s) => (s === "" ? "(none)" : s.toLowerCase()).includes(q));
  }, [search, suggestions, values]);

  function toggleValue(v: string) {
    if (values.includes(v)) onChange(values.filter((x) => x !== v));
    else onChange([...values, v]);
  }

  function commitFreeText(text: string) {
    const t = text.trim();
    if (!t) return;
    if (values.includes(t)) return;
    onChange([...values, t]);
    setSearch("");
  }

  return (
    <div ref={containerRef} className="relative">
      <div
        onClick={() => setOpen(true)}
        className="w-full min-h-[36px] flex flex-wrap items-center gap-1 px-2 py-1.5 border border-gray-200 rounded-md text-sm bg-white cursor-text"
      >
        {values.map((v) => (
          <span
            key={v}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-600 text-white text-xs"
          >
            {v === "" ? "(None)" : v}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange(values.filter((x) => x !== v));
              }}
              className="hover:text-blue-100"
              aria-label="Remove value"
            >
              ×
            </button>
          </span>
        ))}
        {(open || values.length === 0) && (
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (isFreeText && e.key === "Enter") {
                e.preventDefault();
                commitFreeText(search);
              }
              if (e.key === "Backspace" && !search && values.length > 0) {
                onChange(values.slice(0, -1));
              }
            }}
            onFocus={() => setOpen(true)}
            placeholder={values.length === 0 ? (isFreeText ? "Type a value..." : "Select values...") : ""}
            className="flex-1 min-w-[80px] outline-none text-sm bg-transparent"
          />
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (values.length > 0) onChange([]);
            else setOpen((o) => !o);
          }}
          className="ml-auto text-gray-400 hover:text-gray-700"
          aria-label={values.length > 0 ? "Clear values" : "Toggle dropdown"}
        >
          {values.length > 0 ? "×" : "▾"}
        </button>
      </div>
      {open && (
        <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-30 max-h-64 overflow-y-auto">
          {isFreeText && search.trim() && !values.includes(search.trim()) && (
            <button
              type="button"
              onClick={() => commitFreeText(search)}
              className="w-full text-left px-3 py-2 text-sm text-blue-700 hover:bg-blue-50 border-b border-gray-100"
            >
              Use “{search.trim()}”
            </button>
          )}
          {filteredSuggestions.length === 0 ? (
            <p className="px-3 py-3 text-xs text-gray-400">
              {suggestions.length === 0
                ? "Run the report to see available values."
                : "No matching values."}
            </p>
          ) : (
            filteredSuggestions.map((s) => (
              <button
                key={s || "__empty__"}
                type="button"
                onClick={() => toggleValue(s)}
                className="w-full text-left px-3 py-2 text-sm text-gray-800 hover:bg-gray-50"
              >
                {s === "" ? "(None)" : s}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function FilterRow({
  filter,
  categoryLabel,
  fieldLabel,
  suggestions,
  onUpdate,
  onRemove,
}: {
  filter: ReportFilter;
  categoryLabel: string;
  fieldLabel: string;
  suggestions: string[];
  onUpdate: (patch: Partial<ReportFilter>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="border-t border-gray-100 pt-3 mt-3">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs text-gray-500">{categoryLabel}</p>
        <button
          type="button"
          onClick={onRemove}
          className="text-gray-400 hover:text-red-600"
          aria-label="Remove filter"
        >
          ×
        </button>
      </div>
      <p className="text-sm font-semibold text-gray-900 mb-2">{fieldLabel}</p>
      <select
        value={filter.mode}
        onChange={(e) => onUpdate({ mode: e.target.value as FilterMode })}
        className="w-full mb-2 px-2.5 py-1.5 border border-gray-200 rounded-md text-sm bg-white"
      >
        {FILTER_MODES.map((m) => (
          <option key={m.value} value={m.value}>
            {m.label}
          </option>
        ))}
      </select>
      <FilterValuePicker
        mode={filter.mode}
        values={filter.values}
        suggestions={suggestions}
        onChange={(values) => onUpdate({ values })}
      />
    </div>
  );
}

// ─── Run Report Modal ─────────────────────────────────────────────────────────

function ColumnConfigurationPanel({
  columns,
  selectedColumnKeys,
  calculatedColumns,
  onChange,
}: {
  columns: { key: string; label: string }[];
  selectedColumnKeys: string[];
  calculatedColumns: CalculatedColumn[];
  onChange: (keys: string[]) => void;
}) {
  const allColumnKeys = columns.map((column) => column.key);
  const selectedSet = new Set(selectedColumnKeys.length > 0 ? selectedColumnKeys : allColumnKeys);
  const selectedCount = selectedSet.size;

  function toggleColumn(columnKey: string) {
    const next = new Set(selectedSet);
    if (next.has(columnKey)) {
      if (next.size === 1) return;
      next.delete(columnKey);
    } else {
      next.add(columnKey);
    }
    onChange(allColumnKeys.filter((key) => next.has(key)));
  }

  return (
    <aside className="w-72 shrink-0 border-l border-gray-100 bg-white overflow-y-auto">
      <div className="sticky top-0 bg-white px-4 py-4 border-b border-gray-100 z-10">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Configure Columns</h3>
            <p className="text-[11px] text-gray-500 mt-1">
              {selectedCount} of {columns.length} source columns in use.
            </p>
          </div>
          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
            {selectedCount} checked
          </span>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => onChange(allColumnKeys)}
            className="text-[11px] font-medium text-gray-600 hover:text-gray-900"
          >
            Check all
          </button>
          <span className="text-[11px] text-gray-400">At least one column is required.</span>
        </div>
      </div>
      <div className="px-3 py-3 space-y-1.5">
        {columns.map((column) => (
          <label
            key={column.key}
            className={`flex items-center gap-2 rounded-md px-2.5 py-2 text-xs transition-colors ${
              selectedSet.has(column.key) ? "bg-blue-50 text-gray-900" : "bg-gray-50 text-gray-500 hover:bg-gray-100"
            }`}
          >
            <input
              type="checkbox"
              checked={selectedSet.has(column.key)}
              onChange={() => toggleColumn(column.key)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="min-w-0 flex-1 truncate">{column.label}</span>
          </label>
        ))}
        {calculatedColumns.length > 0 && (
          <div className="pt-3">
            <p className="px-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Custom Columns</p>
            {calculatedColumns.map((column) => (
              <div key={column.id} className="flex items-center gap-2 rounded-md bg-gray-50 px-2.5 py-2 text-xs text-gray-500">
                <input type="checkbox" checked readOnly className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                <span className="min-w-0 flex-1 truncate">{column.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}

function RunReportModal({
  reportDef,
  projectId,
  existingReport,
  initialCalculatedColumns,
  onClose,
  onSave,
  onUpdate,
  fullscreen,
  templateLaunchConfig,
}: {
  reportDef: ReportDef;
  projectId: string;
  existingReport?: SavedReport | null;
  initialCalculatedColumns?: CalculatedColumn[];
  onClose: () => void;
  onSave: (report: SavedReport) => void;
  onUpdate?: (reportId: string, patch: Partial<SavedReport>) => void;
  fullscreen?: boolean;
  templateLaunchConfig?: TemplateLaunchConfig;
}) {
  const today = new Date();
  const [reportName, setReportName] = useState(existingReport?.name ?? reportDef.label);
  const [startDate, setStartDate] = useState(`${today.getFullYear()}-01-01`);
  const [endDate, setEndDate] = useState(today.toISOString().split("T")[0]);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [ran, setRan] = useState(false);
  const [calculatedColumns, setCalculatedColumns] = useState<CalculatedColumn[]>(initialCalculatedColumns ?? []);
  const [newCalcName, setNewCalcName] = useState("");
  const [newCalcDesc, setNewCalcDesc] = useState("");
  const [newCalcType, setNewCalcType] = useState<CalculatedOutput>("number");
  const [newLeftSource, setNewLeftSource] = useState("constant");
  const [newOperator, setNewOperator] = useState<"+" | "-" | "*" | "/">("+");
  const [newRightSource, setNewRightSource] = useState("constant");
  const [newLeftConstant, setNewLeftConstant] = useState("0");
  const [newRightConstant, setNewRightConstant] = useState("0");
  const [newDecimals, setNewDecimals] = useState(2);
  const [newRounding, setNewRounding] = useState(true);
  const [loadDataManually, setLoadDataManually] = useState(true);
  const initialVisualConfig = existingReport?.visualConfig ?? templateLaunchConfig?.visualConfig;
  const [showConfig, setShowConfig] = useState(templateLaunchConfig?.showConfiguration ?? !existingReport);
  const [groupByKey, setGroupByKey] = useState(initialVisualConfig?.groupByKey ?? "");
  const [selectedColumnKeys, setSelectedColumnKeys] = useState<string[]>(
    initialVisualConfig?.selectedColumnKeys ?? [],
  );
  const [visualType, setVisualType] = useState<VisualType>(initialVisualConfig?.visualType ?? "table");
  const [xAxisKey, setXAxisKey] = useState(initialVisualConfig?.xAxisKey ?? "");
  const [yAxisKey, setYAxisKey] = useState(initialVisualConfig?.yAxisKey ?? "");
  const [secondaryMeasureKey, setSecondaryMeasureKey] = useState(initialVisualConfig?.secondaryMeasureKey ?? "");
  const [sortByKey, setSortByKey] = useState(initialVisualConfig?.sortByKey ?? "");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">(initialVisualConfig?.sortDirection ?? "asc");
  const [showLegend, setShowLegend] = useState(initialVisualConfig?.showLegend ?? true);
  const [showValueLabels, setShowValueLabels] = useState(initialVisualConfig?.showValueLabels ?? false);
  const [showPoints, setShowPoints] = useState(initialVisualConfig?.showPoints ?? false);
  const [maxBars, setMaxBars] = useState(initialVisualConfig?.maxBars ?? 10);
  const [useDualAxis, setUseDualAxis] = useState(initialVisualConfig?.useDualAxis ?? false);
  const [decimalPlaces, setDecimalPlaces] = useState(initialVisualConfig?.decimalPlaces ?? 2);
  const [displayUnits, setDisplayUnits] = useState<"none" | "thousands" | "millions">(initialVisualConfig?.displayUnits ?? "none");
  const [actorEmailFilter, setActorEmailFilter] = useState("");
  const [eventTypeFilter, setEventTypeFilter] = useState("");
  const [aggregateByColumn, setAggregateByColumn] = useState<Record<string, AggregateFunction>>({});
  const [filters, setFilters] = useState<ReportFilter[]>(existingReport?.filters ?? []);
  const [allFetchedRows, setAllFetchedRows] = useState<Record<string, unknown>[]>([]);

  const displayColumns = useMemo(() => {
    const base =
      selectedColumnKeys.length > 0
        ? selectedColumnKeys
            .map((key) => reportDef.columns.find((c) => c.key === key))
            .filter((c): c is { key: string; label: string } => c !== undefined)
        : reportDef.columns;
    return [
      ...base,
      ...calculatedColumns.map((c) => ({
        key: c.id,
        label: c.name,
      })),
    ];
  }, [reportDef.columns, calculatedColumns, selectedColumnKeys]);

  async function runReport() {
    setLoading(true);
    setError("");
    setRan(false);
    const params = new URLSearchParams({ type: reportDef.value });
    if (reportDef.hasDateRange) {
      if (startDate) params.set("start", startDate);
      if (endDate) params.set("end", endDate);
    }
    if (reportDef.value === "user-activity") {
      if (actorEmailFilter.trim()) params.set("actor_email", actorEmailFilter.trim());
      if (eventTypeFilter.trim()) params.set("event_type", eventTypeFilter.trim());
    }
    const res = await fetch(`/api/projects/${projectId}/reports?${params}`);
    const data = await res.json();
    setLoading(false);
    setRan(true);
    if (!res.ok) {
      setError(data.error || "Failed to run report");
      setRows([]);
      return;
    }
    const fetched = Array.isArray(data) ? data : [];
    setAllFetchedRows(fetched);
    let sourceRows = applyReportFilters(fetched, filters);
    if (groupByKey) {
      sourceRows = [...sourceRows].sort((a, b) => String(a[groupByKey] ?? "").localeCompare(String(b[groupByKey] ?? "")));
    }
    if (sortByKey) {
      sourceRows = [...sourceRows].sort((a, b) => {
        const av = String(a[sortByKey] ?? "");
        const bv = String(b[sortByKey] ?? "");
        return sortDirection === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      });
    }
    if (maxBars > 0 && visualType !== "table" && sourceRows.length > maxBars) {
      sourceRows = sourceRows.slice(0, maxBars);
    }
    setRows(applyCalculatedColumns(sourceRows, calculatedColumns));
  }

  function handleExport() {
    if (rows.length === 0) return;
    const csv = toCSV(displayColumns, rows);
    downloadCSV(`${reportName.toLowerCase().replace(/\s+/g, "-")}.csv`, csv);
  }

  function handleExportPDF() {
    if (rows.length === 0) return;
    const headerCells = displayColumns.map((c) => `<th>${c.label}</th>`).join("");
    const bodyRows = rows
      .map((row) => `<tr>${displayColumns.map((c) => `<td>${formatCell(c.key, row[c.key])}</td>`).join("")}</tr>`)
      .join("");
    const html = `<!DOCTYPE html><html><head><title>${reportName}</title><style>
      body{font-family:sans-serif;font-size:11px;margin:24px}
      h2{margin:0 0 4px;font-size:14px}
      p{margin:0 0 12px;color:#666;font-size:11px}
      table{width:100%;border-collapse:collapse}
      th,td{border:1px solid #ddd;padding:5px 8px;text-align:left}
      th{background:#f3f4f6;font-weight:600;font-size:10px;text-transform:uppercase}
      tr:nth-child(even){background:#fafafa}
      @media print{body{margin:12px}}
    </style></head><body>
      <h2>${reportName}</h2>
      <p>${reportDef.group} &middot; ${rows.length} record${rows.length === 1 ? "" : "s"}</p>
      <table><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table>
    </body></html>`;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
  }

  function handleSave() {
    const visualConfig: VisualConfig = {
      visualType,
      xAxisKey: xAxisKey || undefined,
      yAxisKey: yAxisKey || undefined,
      secondaryMeasureKey: secondaryMeasureKey || undefined,
      sortByKey: sortByKey || undefined,
      sortDirection,
      showLegend,
      showValueLabels,
      showPoints,
      maxBars,
      useDualAxis,
      decimalPlaces,
      displayUnits,
      selectedColumnKeys: selectedColumnKeys.length > 0 ? selectedColumnKeys : undefined,
      groupByKey: groupByKey || undefined,
    };

    if (existingReport && onUpdate) {
      onUpdate(existingReport.id, {
        name: reportName,
        calculatedColumns,
        visualConfig,
        filters,
        visualCards: existingReport.visualCards?.length
          ? existingReport.visualCards.map((card, idx) => (idx === 0 ? { ...card, title: reportName, config: visualConfig } : card))
          : [{ id: crypto.randomUUID(), title: reportName, description: reportDef.description, config: visualConfig }],
        lastRunRecordCount: rows.length,
        updatedAt: new Date().toISOString(),
      });
      onClose();
      return;
    }

    const reportType = reportDef.group === "Daily Log" ? "Daily Log Report" : "Single Tool Report";
    const saved: SavedReport = {
      id: crypto.randomUUID(),
      name: reportName,
      reportType,
      templateValue: reportDef.value,
      description: reportDef.description,
      createdBy: "Me",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sharedWith: [],
      calculatedColumns,
      visualConfig,
      filters,
      visualCards: [{ id: crypto.randomUUID(), title: reportName, description: reportDef.description, config: visualConfig }],
      lastRunRecordCount: rows.length,
    };
    onSave(saved);
    onClose();
  }

  function addCalculatedColumn() {
    if (!newCalcName.trim()) return;
    const type: CalculatedColumnType = newCalcType === "date-variance" ? "date-variance" : "basic";
    const newCol: CalculatedColumn = {
      id: `calc_${crypto.randomUUID()}`,
      name: newCalcName.trim(),
      description: newCalcDesc.trim() || undefined,
      type,
      output: newCalcType,
      leftSource: newLeftSource,
      operator: newOperator,
      rightSource: newRightSource,
      leftConstant: newLeftSource === "constant" ? toNumber(newLeftConstant) : undefined,
      rightConstant: newRightSource === "constant" ? toNumber(newRightConstant) : undefined,
      decimals: newCalcType === "date-variance" ? 0 : newDecimals,
      rounding: newRounding,
    };
    setCalculatedColumns((prev) => [...prev, newCol]);
    setNewCalcName("");
    setNewCalcDesc("");
  }

  useEffect(() => {
    if (!loadDataManually) {
      void runReport();
    }
    // intentionally driven by report configuration controls
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadDataManually, startDate, endDate, actorEmailFilter, eventTypeFilter, groupByKey, calculatedColumns]);

  // Auto-run on open when viewing an already-saved report so the user lands
  // on the rendered results instead of an empty builder.
  useEffect(() => {
    if (!existingReport && !templateLaunchConfig?.autoRun) return;
    void runReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingReport?.id, templateLaunchConfig?.autoRun]);

  return (
    <div className={fullscreen ? "fixed inset-0 bg-white z-50 flex flex-col overflow-hidden" : "fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4 py-8"}>
      <div className={fullscreen ? "flex flex-col flex-1 overflow-hidden" : "bg-white rounded-xl w-full max-w-4xl shadow-xl flex flex-col max-h-[90vh]"}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div>
            <input
              value={reportName}
              onChange={(e) => setReportName(e.target.value)}
              className="text-sm font-semibold text-gray-900 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-gray-900 focus:outline-none px-0.5 w-64"
              placeholder="Report name..."
            />
            <p className="text-xs text-gray-400 mt-0.5">
              {reportDef.group} · {reportDef.description}
            </p>
          </div>
          <div className="flex items-center gap-2 ml-4 shrink-0">
            <button
              onClick={() => setShowConfig((prev) => !prev)}
              className="px-3 py-1.5 border border-gray-200 text-xs font-medium text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
            >
              {showConfig ? "Hide Configuration" : "Edit Configuration"}
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {!showConfig && (
          <div className="px-6 py-3 border-b border-gray-100 bg-gray-50 shrink-0 flex flex-wrap items-center gap-2">
            {loading && <span className="text-xs text-gray-500">Running report...</span>}
            {ran && !error && rows.length > 0 && (
              <>
                <span className="text-xs text-gray-500 mr-2">
                  {rows.length} {rows.length === 1 ? "record" : "records"}
                </span>
                <button
                  onClick={() => void downloadXLSX(`${reportName.toLowerCase().replace(/\s+/g, "-")}.xlsx`, displayColumns, rows)}
                  className="px-3 py-1.5 border border-gray-200 text-xs font-medium text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                >
                  Export XLSX
                </button>
                <button
                  onClick={handleExport}
                  className="px-3 py-1.5 border border-gray-200 text-xs font-medium text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                >
                  Export CSV
                </button>
                <button
                  onClick={handleExportPDF}
                  className="px-3 py-1.5 border border-gray-200 text-xs font-medium text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                >
                  Export PDF
                </button>
              </>
            )}
          </div>
        )}

        {showConfig && (
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 shrink-0">
          <div className="mb-3 rounded-md border border-gray-200 bg-white p-3">
            <p className="text-xs font-medium text-gray-700 mb-2">Visual Type & Configuration</p>
            <p className="text-[11px] text-gray-500 mb-3">
              Aligns with 360 Reporting visuals: choose a visual tile, map axes/measures, then configure sort and advanced options.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <select value={visualType} onChange={(e) => setVisualType(e.target.value as VisualType)} className="px-2.5 py-1.5 border border-gray-200 rounded text-xs bg-white">
                {VISUAL_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <select value={xAxisKey} onChange={(e) => setXAxisKey(e.target.value)} className="px-2.5 py-1.5 border border-gray-200 rounded text-xs bg-white">
                <option value="">X-Axis / Category (optional)</option>
                {reportDef.columns.map((col) => (
                  <option key={col.key} value={col.key}>
                    {col.label}
                  </option>
                ))}
              </select>
              <select value={yAxisKey} onChange={(e) => setYAxisKey(e.target.value)} className="px-2.5 py-1.5 border border-gray-200 rounded text-xs bg-white">
                <option value="">Y-Axis / Measure (optional)</option>
                {reportDef.columns.map((col) => (
                  <option key={col.key} value={col.key}>
                    {col.label}
                  </option>
                ))}
              </select>
              {(visualType === "line" || visualType === "stacked-bar") && (
                <select
                  value={secondaryMeasureKey}
                  onChange={(e) => setSecondaryMeasureKey(e.target.value)}
                  className="px-2.5 py-1.5 border border-gray-200 rounded text-xs bg-white"
                >
                  <option value="">Secondary Measure (optional)</option>
                  {reportDef.columns.map((col) => (
                    <option key={col.key} value={col.key}>
                      {col.label}
                    </option>
                  ))}
                </select>
              )}
              <select value={sortByKey} onChange={(e) => setSortByKey(e.target.value)} className="px-2.5 py-1.5 border border-gray-200 rounded text-xs bg-white">
                <option value="">Sort By (optional)</option>
                {reportDef.columns.map((col) => (
                  <option key={col.key} value={col.key}>
                    {col.label}
                  </option>
                ))}
              </select>
              <select value={sortDirection} onChange={(e) => setSortDirection(e.target.value as "asc" | "desc")} className="px-2.5 py-1.5 border border-gray-200 rounded text-xs bg-white">
                <option value="asc">Sort: Ascending</option>
                <option value="desc">Sort: Descending</option>
              </select>
              <select value={String(maxBars)} onChange={(e) => setMaxBars(Number(e.target.value))} className="px-2.5 py-1.5 border border-gray-200 rounded text-xs bg-white">
                <option value="10">Max Bars: 10</option>
                <option value="25">Max Bars: 25</option>
                <option value="50">Max Bars: 50</option>
                <option value="100">Max Bars: 100</option>
              </select>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-1.5 text-xs text-gray-600">
                <input type="checkbox" checked={showLegend} onChange={(e) => setShowLegend(e.target.checked)} className="rounded" />
                Show Legend
              </label>
              <label className="inline-flex items-center gap-1.5 text-xs text-gray-600">
                <input type="checkbox" checked={showValueLabels} onChange={(e) => setShowValueLabels(e.target.checked)} className="rounded" />
                Show Value Labels
              </label>
              {visualType === "line" && (
                <label className="inline-flex items-center gap-1.5 text-xs text-gray-600">
                  <input type="checkbox" checked={showPoints} onChange={(e) => setShowPoints(e.target.checked)} className="rounded" />
                  Show Points on Line
                </label>
              )}
              {(visualType === "line" || visualType === "stacked-bar") && (
                <label className="inline-flex items-center gap-1.5 text-xs text-gray-600">
                  <input type="checkbox" checked={useDualAxis} onChange={(e) => setUseDualAxis(e.target.checked)} className="rounded" />
                  Use Dual Axis
                </label>
              )}
              <select value={String(decimalPlaces)} onChange={(e) => setDecimalPlaces(Number(e.target.value))} className="px-2.5 py-1.5 border border-gray-200 rounded text-xs bg-white">
                <option value="0">0 Decimal Places</option>
                <option value="1">1 Decimal Place</option>
                <option value="2">2 Decimal Places</option>
                <option value="3">3 Decimal Places</option>
              </select>
              <select value={displayUnits} onChange={(e) => setDisplayUnits(e.target.value as "none" | "thousands" | "millions")} className="px-2.5 py-1.5 border border-gray-200 rounded text-xs bg-white">
                <option value="none">Display Units: None</option>
                <option value="thousands">Display Units: Thousands</option>
                <option value="millions">Display Units: Millions</option>
              </select>
            </div>
          </div>

          <div className="mb-3 rounded-md border border-gray-200 bg-white p-3">
            <p className="text-sm font-semibold text-gray-900 mb-1">Filters</p>
            <p className="text-[11px] text-gray-500 mb-3">
              Configure columns and filters for your report and click &ldquo;Run Report&rdquo; to review.
            </p>
            <AddFilterDropdown
              categoryLabel={reportDef.label}
              columns={reportDef.columns}
              onSelect={(columnKey) => {
                if (filters.some((f) => f.columnKey === columnKey)) return;
                setFilters((prev) => [
                  ...prev,
                  { id: crypto.randomUUID(), columnKey, mode: "matches", values: [] },
                ]);
              }}
            />
            {filters.length > 0 && (
              <div>
                {filters.map((f) => {
                  const col = reportDef.columns.find((c) => c.key === f.columnKey);
                  if (!col) return null;
                  return (
                    <FilterRow
                      key={f.id}
                      filter={f}
                      categoryLabel={reportDef.label}
                      fieldLabel={col.label}
                      suggestions={distinctColumnValues(allFetchedRows, f.columnKey)}
                      onUpdate={(patch) =>
                        setFilters((prev) =>
                          prev.map((x) => (x.id === f.id ? { ...x, ...patch } : x)),
                        )
                      }
                      onRemove={() => setFilters((prev) => prev.filter((x) => x.id !== f.id))}
                    />
                  );
                })}
              </div>
            )}
          </div>

          <div className="mb-3 rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-[11px] text-blue-900">
            Visible columns are checked in the Configure Columns panel on the right. Uncheck any column to remove it from the report table and exports.
          </div>

          <div className="mb-3 rounded-md border border-gray-200 bg-white p-3">
            <p className="text-xs font-medium text-gray-700 mb-2">Custom Columns (Calculation)</p>
            <p className="text-[11px] text-gray-500 mb-3">
              Calculated columns are saved to this report only and can use source columns or constants.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
              <input
                value={newCalcName}
                onChange={(e) => setNewCalcName(e.target.value)}
                placeholder="Calculation Name"
                className="md:col-span-2 px-2.5 py-1.5 border border-gray-200 rounded text-xs"
              />
              <select
                value={newCalcType}
                onChange={(e) => setNewCalcType(e.target.value as CalculatedOutput)}
                className="px-2.5 py-1.5 border border-gray-200 rounded text-xs bg-white"
              >
                <option value="number">Number</option>
                <option value="currency">Currency</option>
                <option value="percent">Percentage</option>
                <option value="date-variance">Date Variance</option>
              </select>
              <select value={newLeftSource} onChange={(e) => setNewLeftSource(e.target.value)} className="px-2.5 py-1.5 border border-gray-200 rounded text-xs bg-white">
                <option value="constant">Column X: Constant</option>
                {reportDef.columns.map((col) => (
                  <option key={col.key} value={col.key}>
                    Column X: {col.label}
                  </option>
                ))}
              </select>
              <select value={newOperator} onChange={(e) => setNewOperator(e.target.value as "+" | "-" | "*" | "/")} className="px-2.5 py-1.5 border border-gray-200 rounded text-xs bg-white">
                <option value="+">+</option>
                <option value="-">-</option>
                <option value="*">x</option>
                <option value="/">/</option>
              </select>
              <select value={newRightSource} onChange={(e) => setNewRightSource(e.target.value)} className="px-2.5 py-1.5 border border-gray-200 rounded text-xs bg-white">
                <option value="constant">Column Y: Constant</option>
                {reportDef.columns.map((col) => (
                  <option key={col.key} value={col.key}>
                    Column Y: {col.label}
                  </option>
                ))}
              </select>
              {newLeftSource === "constant" && (
                <input value={newLeftConstant} onChange={(e) => setNewLeftConstant(e.target.value)} placeholder="X Constant" className="px-2.5 py-1.5 border border-gray-200 rounded text-xs" />
              )}
              {newRightSource === "constant" && (
                <input value={newRightConstant} onChange={(e) => setNewRightConstant(e.target.value)} placeholder="Y Constant" className="px-2.5 py-1.5 border border-gray-200 rounded text-xs" />
              )}
              {newCalcType !== "date-variance" && (
                <select value={String(newDecimals)} onChange={(e) => setNewDecimals(Number(e.target.value))} className="px-2.5 py-1.5 border border-gray-200 rounded text-xs bg-white">
                  <option value="0">Ones (1)</option>
                  <option value="1">Tenths (1.0)</option>
                  <option value="2">Hundredths (1.00)</option>
                  <option value="3">Thousandths (1.000)</option>
                  <option value="4">Ten Thousandths (1.0000)</option>
                  <option value="5">Hundred Thousandths (1.00000)</option>
                  <option value="6">Millionths (1.000000)</option>
                </select>
              )}
              {newCalcType !== "date-variance" && (
                <label className="inline-flex items-center gap-1.5 text-xs text-gray-600">
                  <input type="checkbox" checked={newRounding} onChange={(e) => setNewRounding(e.target.checked)} className="rounded" />
                  Rounding
                </label>
              )}
              <button onClick={addCalculatedColumn} className="px-3 py-1.5 bg-gray-900 text-white text-xs rounded hover:bg-gray-700">
                + Create Calculation
              </button>
            </div>
            {calculatedColumns.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {calculatedColumns.map((col) => (
                  <span key={col.id} className="inline-flex items-center gap-1 px-2 py-1 rounded border border-gray-200 text-xs text-gray-700">
                    {col.name}
                    <button onClick={() => setCalculatedColumns((prev) => prev.filter((c) => c.id !== col.id))} className="text-gray-400 hover:text-red-600">
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="inline-flex items-center gap-2 text-xs text-gray-600 mr-3">
              <input
                type="checkbox"
                checked={loadDataManually}
                onChange={(e) => setLoadDataManually(e.target.checked)}
                className="rounded"
              />
              Load Data Manually
            </label>
            <p className="text-[11px] text-gray-500 mr-2">Default ON for large datasets. Turn OFF to auto-run when filters/configuration changes.</p>
            {reportDef.hasDateRange && (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="px-3 py-1.5 border border-gray-200 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="px-3 py-1.5 border border-gray-200 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                </div>
              </>
            )}
            {reportDef.value === "user-activity" && (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Actor Email (optional)</label>
                  <input
                    value={actorEmailFilter}
                    onChange={(e) => setActorEmailFilter(e.target.value)}
                    placeholder="name@company.com"
                    className="px-3 py-1.5 border border-gray-200 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Event Type (optional)</label>
                  <input
                    value={eventTypeFilter}
                    onChange={(e) => setEventTypeFilter(e.target.value)}
                    placeholder="created, updated..."
                    className="px-3 py-1.5 border border-gray-200 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                </div>
              </>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Table Group</label>
              <select
                value={groupByKey}
                onChange={(e) => setGroupByKey(e.target.value)}
                className="px-3 py-1.5 border border-gray-200 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900"
              >
                <option value="">No grouping</option>
                {reportDef.columns.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Aggregate (fx)</label>
              <select
                value=""
                onChange={(e) => {
                  const [key, fn] = e.target.value.split(":");
                  if (!key || !fn) return;
                  setAggregateByColumn((prev) => ({ ...prev, [key]: fn as AggregateFunction }));
                  e.currentTarget.value = "";
                }}
                className="px-3 py-1.5 border border-gray-200 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900"
              >
                <option value="">Select column + function</option>
                {displayColumns.map((c) => (
                  <optgroup key={c.key} label={c.label}>
                    {getAggregateFunctionsForColumn(c.key).map((fn) => (
                      <option key={`${c.key}:${fn}`} value={`${c.key}:${fn}`}>
                        {fn === "avg" ? "Average" : fn.charAt(0).toUpperCase() + fn.slice(1)}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <button
              onClick={runReport}
              disabled={loading}
              className="px-4 py-1.5 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-700 transition-colors disabled:opacity-40"
            >
              {loading ? "Running..." : "Run Report"}
            </button>
            {ran && rows.length > 0 && (
              <>
                <button
                  onClick={() => void downloadXLSX(`${reportName.toLowerCase().replace(/\s+/g, "-")}.xlsx`, displayColumns, rows)}
                  className="px-4 py-1.5 border border-gray-200 text-sm font-medium text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                >
                  Export XLSX
                </button>
                <button
                  onClick={handleExport}
                  className="px-4 py-1.5 border border-gray-200 text-sm font-medium text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                >
                  Export CSV
                </button>
                <button
                  onClick={handleExportPDF}
                  className="px-4 py-1.5 border border-gray-200 text-sm font-medium text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                >
                  Export PDF
                </button>
                <button
                  onClick={handleSave}
                  className="px-4 py-1.5 border border-gray-200 text-sm font-medium text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                >
                  {existingReport ? "Update Report" : "Save Report"}
                </button>
              </>
            )}
          </div>
          {Object.entries(aggregateByColumn).length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {Object.entries(aggregateByColumn).map(([key, fn]) => (
                <span key={key} className="inline-flex items-center gap-1 px-2 py-1 rounded border border-gray-200 text-xs text-gray-700">
                  {displayColumns.find((col) => col.key === key)?.label ?? key}: {fn.toUpperCase()}
                  <button
                    onClick={() =>
                      setAggregateByColumn((prev) => {
                        const next = { ...prev };
                        delete next[key];
                        return next;
                      })
                    }
                    className="text-gray-400 hover:text-red-600"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          {reportDef.value === "user-activity" && (
            <p className="text-[11px] text-gray-500 mt-2">
              User Activity dataset uses a single dataset without joins. Export limits: CSV 700,000 rows, XLSX 200,000 rows, PDF 5,000 rows.
            </p>
          )}
        </div>
        )}

        <div className="flex flex-1 min-h-0">
          <div className="overflow-auto flex-1">
            {error && <p className="text-sm text-red-600 px-6 py-4">{error}</p>}
          {ran && !error && rows.length === 0 && (
            <div className="py-16 text-center">
              <p className="text-sm text-gray-400">No records found for the selected criteria.</p>
            </div>
          )}
          {ran && !error && rows.length > 0 && (
            <>
              <div className="px-6 py-2.5 border-b border-gray-100 bg-white sticky top-0">
                <p className="text-xs text-gray-500">
                  {rows.length} {rows.length === 1 ? "record" : "records"}
                </p>
              </div>
              <table className="w-full text-sm">
                <thead className="sticky top-9">
                  <tr className="bg-gray-50 border-b border-gray-100">
                    {displayColumns.map((col) => (
                      <th
                        key={col.key}
                        className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap"
                      >
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {rows.map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50 transition-colors">
                      {displayColumns.map((col) => (
                        <td
                          key={col.key}
                          className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap max-w-xs truncate"
                          title={formatCell(col.key, row[col.key]) === "—" ? undefined : formatCell(col.key, row[col.key])}
                        >
                          {formatCell(col.key, row[col.key])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
                {Object.keys(aggregateByColumn).length > 0 && (
                  <tfoot className="sticky bottom-0 bg-gray-50 border-t border-gray-200">
                    <tr>
                      {displayColumns.map((col) => {
                        const fn = aggregateByColumn[col.key];
                        return (
                          <td key={col.key} className="px-4 py-2 text-xs font-semibold text-gray-700 whitespace-nowrap">
                            {fn && fn !== "none" ? `${fn.toUpperCase()}: ${calculateAggregate(rows, col.key, fn)}` : "—"}
                          </td>
                        );
                      })}
                    </tr>
                  </tfoot>
                )}
              </table>
            </>
          )}
            {!ran && (
              <div className="py-16 text-center">
                <p className="text-sm text-gray-400">
                  Configure the filters above and click <span className="font-medium text-gray-600">Run Report</span> to view results.
                </p>
              </div>
            )}
          </div>
          {showConfig && (
            <ColumnConfigurationPanel
              columns={reportDef.columns}
              selectedColumnKeys={selectedColumnKeys}
              calculatedColumns={calculatedColumns}
              onChange={setSelectedColumnKeys}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function ShareDashboardModal({
  dashboard,
  onClose,
  onShare,
}: {
  dashboard: SavedDashboard;
  onClose: () => void;
  onShare: (viewerGroups: string[]) => void;
}) {
  const [selected, setSelected] = useState<string[]>(dashboard.sharedWith);

  function toggle(group: string) {
    setSelected((prev) => (prev.includes(group) ? prev.filter((g) => g !== group) : [...prev, group]));
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
        <h2 className="text-base font-semibold text-gray-900">Share Dashboard</h2>
        <p className="text-xs text-gray-500 mt-1">
          Dashboards must be published before users with Standard or Read Only access can view them.
        </p>

        <div className="mt-4 p-3 rounded-md border border-amber-200 bg-amber-50 text-xs text-amber-900">
          <p className="font-medium">{dashboard.isPublished ? "Published" : "Not published"}</p>
          <p className="mt-1">
            {dashboard.isPublished
              ? "This dashboard is ready to share. Viewers can open it in Shared Dashboards."
              : "Publish this dashboard first, then share it with project users or distribution groups."}
          </p>
        </div>

        <div className="mt-4 space-y-2">
          {VIEWER_OPTIONS.map((group) => (
            <label key={group} className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={selected.includes(group)} onChange={() => toggle(group)} className="rounded" />
              {group}
            </label>
          ))}
        </div>

        <div className="flex gap-2 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-2 border border-gray-200 text-sm text-gray-600 rounded-md hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            disabled={!dashboard.isPublished}
            onClick={() => {
              onShare(selected);
              onClose();
            }}
            className="flex-1 py-2 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-700 transition-colors disabled:opacity-40"
          >
            Share Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}

function CreateDashboardModal({
  visuals,
  onClose,
  onCreate,
}: {
  visuals: DashboardVisual[];
  onClose: () => void;
  onCreate: (payload: { name: string; visualIds: string[] }) => void;
}) {
  const [name, setName] = useState("Project Dashboard");
  const [selectedVisuals, setSelectedVisuals] = useState<string[]>([]);

  function toggleVisual(id: string) {
    setSelectedVisuals((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]));
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6">
        <h2 className="text-base font-semibold text-gray-900">Create Dashboard</h2>
        <p className="text-xs text-gray-500 mt-1">Select visuals from your report library and save your dashboard.</p>

        <div className="mt-4">
          <label className="block text-xs font-medium text-gray-700 mb-1">Dashboard Title</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
        </div>

        <div className="mt-4 border border-gray-200 rounded-lg max-h-80 overflow-auto">
          {visuals.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-400">Save at least one report to build your visual library.</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {visuals.map((visual) => (
                <label key={visual.id} className="flex items-start gap-3 p-3 hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedVisuals.includes(visual.id)}
                    onChange={() => toggleVisual(visual.id)}
                    className="mt-0.5 rounded"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{visual.title}</p>
                    <p className="text-xs text-gray-500">Source report: {visual.reportName}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {VISUAL_TYPE_OPTIONS.find((option) => option.value === visual.visualType)?.label ?? "Visual"}
                      {visual.summary ? ` · ${visual.summary}` : ""}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-2 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-2 border border-gray-200 text-sm text-gray-600 rounded-md hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            disabled={selectedVisuals.length === 0 || !name.trim()}
            onClick={() => onCreate({ name: name.trim(), visualIds: selectedVisuals })}
            className="flex-1 py-2 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-700 transition-colors disabled:opacity-40"
          >
            Save Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}

function TemplatePreviewModal({
  template,
  onClose,
  onUseTemplate,
}: {
  template: ReportDef;
  onClose: () => void;
  onUseTemplate: (template: ReportDef) => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6">
        <h2 className="text-base font-semibold text-gray-900">{template.label} Template</h2>
        <p className="text-xs text-gray-500 mt-1">{template.description}</p>
        <div className="mt-4">
          <p className="text-xs font-medium text-gray-700 mb-2">Included Columns</p>
          <div className="flex flex-wrap gap-1.5">
            {template.columns.map((col) => (
              <span key={col.key} className="px-2 py-1 rounded border border-gray-200 text-xs text-gray-600">
                {col.label}
              </span>
            ))}
          </div>
        </div>
        <div className="flex gap-2 mt-6">
          <button onClick={onClose} className="flex-1 py-2 border border-gray-200 rounded-md text-sm text-gray-600">
            Cancel
          </button>
          <button
            onClick={() => onUseTemplate(template)}
            className="flex-1 py-2 bg-gray-900 text-white rounded-md text-sm"
          >
            Use Template
          </button>
        </div>
      </div>
    </div>
  );
}

function EditReportModal({
  report,
  onClose,
  onSave,
}: {
  report: SavedReport;
  onClose: () => void;
  onSave: (reportId: string, patch: Partial<SavedReport>) => void;
}) {
  const [name, setName] = useState(report.name);
  const [description, setDescription] = useState(report.description);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
        <h2 className="text-base font-semibold text-gray-900">Edit Report</h2>
        <p className="text-xs text-gray-500 mt-1">Update report name and description. Calculations are preserved.</p>
        <div className="mt-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Report Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" />
          </div>
        </div>
        <div className="flex gap-2 mt-6">
          <button onClick={onClose} className="flex-1 py-2 border border-gray-200 text-sm rounded-md text-gray-600">Cancel</button>
          <button
            onClick={() => onSave(report.id, { name: name.trim() || report.name, description: description.trim(), updatedAt: new Date().toISOString() })}
            className="flex-1 py-2 bg-gray-900 text-white text-sm rounded-md"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

function DistributeSnapshotModal({
  report,
  onClose,
  onSend,
}: {
  report: SavedReport;
  onClose: () => void;
  onSend: (payload: { reportId: string; recipients: string[]; format: "pdf" | "csv" | "xlsx"; schedule: SnapshotSchedule }) => void;
}) {
  const [recipientText, setRecipientText] = useState("");
  const [format, setFormat] = useState<"pdf" | "csv" | "xlsx">("pdf");
  const [schedule, setSchedule] = useState<SnapshotSchedule>("one-time");

  const recipients = recipientText
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-xl p-6">
        <h2 className="text-base font-semibold text-gray-900">Distribute Snapshot</h2>
        <p className="text-xs text-gray-500 mt-1">
          Send a static snapshot of <span className="font-medium">{report.name}</span> to recipients.
        </p>
        <div className="mt-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Recipients (comma-separated emails)</label>
            <input
              value={recipientText}
              onChange={(e) => setRecipientText(e.target.value)}
              placeholder="pm@company.com, exec@company.com"
              className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">File Format</label>
              <select value={format} onChange={(e) => setFormat(e.target.value as "pdf" | "csv" | "xlsx")} className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm bg-white">
                <option value="pdf">PDF</option>
                <option value="csv">CSV</option>
                <option value="xlsx">XLSX</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Schedule</label>
              <select value={schedule} onChange={(e) => setSchedule(e.target.value as SnapshotSchedule)} className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm bg-white">
                <option value="one-time">One Time</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
          </div>
        </div>
        <div className="mt-2 text-[11px] text-gray-500">
          Snapshots send report output as-of send time. Recipients can view without entering the report builder.
        </div>
        <div className="flex gap-2 mt-6">
          <button onClick={onClose} className="flex-1 py-2 border border-gray-200 text-sm rounded-md text-gray-600">Cancel</button>
          <button
            disabled={recipients.length === 0}
            onClick={() => onSend({ reportId: report.id, recipients, format, schedule })}
            className="flex-1 py-2 bg-gray-900 text-white text-sm rounded-md disabled:opacity-40"
          >
            Distribute
          </button>
        </div>
      </div>
    </div>
  );
}

function ShareReportModal({
  report,
  onClose,
  onShare,
}: {
  report: SavedReport;
  onClose: () => void;
  onShare: (reportId: string, sharedWith: string[]) => void;
}) {
  const options = ["Company Admins", "Project Managers", "Field Engineers", "Executives", "External Collaborators"];
  const [selected, setSelected] = useState<string[]>(report.sharedWith);

  function toggle(option: string) {
    setSelected((prev) => (prev.includes(option) ? prev.filter((v) => v !== option) : [...prev, option]));
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
        <h2 className="text-base font-semibold text-gray-900">Share Report</h2>
        <p className="text-xs text-gray-500 mt-1">Choose who can access this report in My Reports.</p>
        <div className="mt-4 space-y-2">
          {options.map((option) => (
            <label key={option} className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={selected.includes(option)} onChange={() => toggle(option)} className="rounded" />
              {option}
            </label>
          ))}
        </div>
        <div className="flex gap-2 mt-6">
          <button onClick={onClose} className="flex-1 py-2 border border-gray-200 rounded-md text-sm text-gray-600">Cancel</button>
          <button onClick={() => onShare(report.id, selected)} className="flex-1 py-2 bg-gray-900 text-white rounded-md text-sm">
            Share
          </button>
        </div>
      </div>
    </div>
  );
}

function PromoteReportModal({
  report,
  onClose,
  onPromote,
}: {
  report: SavedReport;
  onClose: () => void;
  onPromote: (reportId: string) => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-base font-semibold text-gray-900">Promote to Company Level</h2>
        <p className="text-sm text-gray-600 mt-2">
          Promote <span className="font-medium">{report.name}</span> so teams can reuse this report as a company template.
        </p>
        <p className="text-[11px] text-gray-500 mt-2">Only company admins should perform this action.</p>
        <div className="flex gap-2 mt-6">
          <button onClick={onClose} className="flex-1 py-2 border border-gray-200 text-sm rounded-md text-gray-600">Cancel</button>
          <button onClick={() => onPromote(report.id)} className="flex-1 py-2 bg-gray-900 text-white text-sm rounded-md">Promote</button>
        </div>
      </div>
    </div>
  );
}

type AssistCalculatedColumn = {
  name: string;
  output: CalculatedOutput;
  leftSource: string;
  operator: "+" | "-" | "*" | "/";
  rightSource: string;
  leftConstant?: number;
  rightConstant?: number;
  decimals: number;
  rounding: boolean;
};

type AssistRecommendation = {
  reportType: string;
  columns: string[];
  sortByKey?: string;
  sortDirection?: "asc" | "desc";
  groupByKey?: string;
  calculatedColumns: AssistCalculatedColumn[];
  filters: ReportFilter[];
  name: string;
  description: string;
  reasoning?: string;
  def: ReportDef;
};

function AssistReportModal({
  projectId,
  onClose,
  onCreate,
}: {
  projectId: string;
  onClose: () => void;
  onCreate: (rec: AssistRecommendation) => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function suggest() {
    const trimmed = prompt.trim();
    if (!trimmed) {
      setError("Enter a prompt describing the report you want.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/reports/assist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: trimmed }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof payload.error === "string" ? payload.error : "Assist failed to generate a report.");
        return;
      }
      const def = REPORT_TYPES.find((r) => r.value === payload.reportType);
      if (!def) {
        setError("Assist returned an unrecognized report type.");
        return;
      }
      const calcOutputs: CalculatedOutput[] = ["number", "currency", "percent", "date-variance"];
      const rawCalcs: AssistCalculatedColumn[] = Array.isArray(payload.calculatedColumns)
        ? (payload.calculatedColumns as Array<Record<string, unknown>>).flatMap((c) => {
            const name = typeof c.name === "string" ? c.name : "";
            const output = calcOutputs.includes(c.output as CalculatedOutput)
              ? (c.output as CalculatedOutput)
              : "number";
            const operator = ["+", "-", "*", "/"].includes(c.operator as string)
              ? (c.operator as "+" | "-" | "*" | "/")
              : "+";
            const leftSource = typeof c.leftSource === "string" ? c.leftSource : "constant";
            const rightSource = typeof c.rightSource === "string" ? c.rightSource : "constant";
            if (!name) return [];
            return [
              {
                name,
                output,
                leftSource,
                operator,
                rightSource,
                leftConstant: typeof c.leftConstant === "number" ? c.leftConstant : undefined,
                rightConstant: typeof c.rightConstant === "number" ? c.rightConstant : undefined,
                decimals: typeof c.decimals === "number" ? c.decimals : 2,
                rounding: typeof c.rounding === "boolean" ? c.rounding : true,
              },
            ];
          })
        : [];

      const validKeys = new Set(def.columns.map((c) => c.key));
      const validFilterModes: FilterMode[] = [
        "matches",
        "not_matches",
        "contains",
        "not_contains",
        "starts_with",
        "ends_with",
      ];
      const rawFilters: ReportFilter[] = Array.isArray(payload.filters)
        ? (payload.filters as Array<Record<string, unknown>>).flatMap((f) => {
            const columnKey = typeof f.columnKey === "string" && validKeys.has(f.columnKey) ? f.columnKey : "";
            const mode = validFilterModes.includes(f.mode as FilterMode)
              ? (f.mode as FilterMode)
              : "matches";
            const values = Array.isArray(f.values)
              ? (f.values as unknown[])
                  .map((v) => (typeof v === "string" ? v : v == null ? "" : String(v)))
                  .filter((v) => v.length > 0)
              : [];
            if (!columnKey || values.length === 0) return [];
            return [{ id: crypto.randomUUID(), columnKey, mode, values }];
          })
        : [];

      onCreate({
        reportType: payload.reportType,
        columns: Array.isArray(payload.columns) ? payload.columns : [],
        sortByKey: typeof payload.sortByKey === "string" ? payload.sortByKey : undefined,
        sortDirection:
          payload.sortDirection === "desc" ? "desc" : payload.sortDirection === "asc" ? "asc" : undefined,
        groupByKey: typeof payload.groupByKey === "string" ? payload.groupByKey : undefined,
        calculatedColumns: rawCalcs,
        filters: rawFilters,
        name: typeof payload.name === "string" ? payload.name : def.label,
        description: typeof payload.description === "string" ? payload.description : def.description,
        reasoning: typeof payload.reasoning === "string" ? payload.reasoning : "",
        def,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Assist failed to generate a report.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6">
        <h2 className="text-base font-semibold text-gray-900">Get a Custom Report from Assist</h2>
        <p className="text-xs text-gray-500 mt-1">
          Describe the report you want in plain language. Assist (powered by Gemini) will pick the right tool and
          columns and create the report automatically.
        </p>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={4}
          placeholder="Example: Can you generate a report that shows all of the manpower logs and who created them"
          className="mt-4 w-full px-3 py-2 border border-gray-200 rounded-md text-sm"
        />
        <div className="flex gap-2 mt-4">
          <button
            onClick={suggest}
            disabled={loading}
            className="px-4 py-2 bg-gray-900 text-white rounded-md text-sm disabled:opacity-50"
          >
            {loading ? "Generating…" : "Generate Report"}
          </button>
          <button onClick={onClose} className="px-4 py-2 border border-gray-200 text-gray-600 rounded-md text-sm">
            Close
          </button>
        </div>
        {error && (
          <div className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>
        )}
      </div>
    </div>
  );
}

function PreviewInDashboardModal({
  report,
  onClose,
  onCreate,
}: {
  report: SavedReport;
  onClose: () => void;
  onCreate: (dashboardName: string) => void;
}) {
  const [dashboardName, setDashboardName] = useState(`${report.name} Dashboard`);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-xl p-6">
        <h2 className="text-base font-semibold text-gray-900">Preview in Dashboard</h2>
        <p className="text-xs text-gray-500 mt-1">
          Design your dashboard from this report first. You can go back before saving if you change your mind.
        </p>
        <div className="mt-4 rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-900">
          Conversion follows the 360 flow: report → preview in dashboard → modify visuals → save dashboard.
        </div>
        <div className="mt-4">
          <label className="block text-xs font-medium text-gray-700 mb-1">Dashboard Name</label>
          <input
            value={dashboardName}
            onChange={(e) => setDashboardName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm"
          />
        </div>
        <div className="mt-3 rounded border border-gray-200 bg-gray-50 p-3">
          <p className="text-sm font-medium text-gray-900">{report.name}</p>
          <p className="text-xs text-gray-500 mt-1">The saved report snapshot will be added as the first dashboard visual.</p>
        </div>
        <div className="flex gap-2 mt-6">
          <button onClick={onClose} className="flex-1 py-2 border border-gray-200 text-sm rounded-md text-gray-600">
            Go Back
          </button>
          <button
            onClick={() => onCreate(dashboardName)}
            className="flex-1 py-2 bg-gray-900 text-white text-sm rounded-md"
          >
            Save Dashboard Draft
          </button>
        </div>
      </div>
    </div>
  );
}

const REPORT_360_CATEGORIES: { label: string; sources: string[]; isNew?: boolean }[] = [
  {
    label: "Directory & Portfolio",
    isNew: true,
    sources: ["Company", "Project"],
  },
  {
    label: "Financials",
    sources: [
      "Budget",
      "Change Events",
      "Change Orders",
      "Commitments",
      "Company",
      "Finance",
      "Invoices",
      "Pay",
      "Prime Contracts",
      "Project",
    ],
  },
  {
    label: "Project Execution",
    sources: [
      "Change Events",
      "Commitments",
      "Daily Log",
      "Documents",
      "Drawings",
      "Locations",
      "Meetings",
      "Photos",
      "Project",
      "Punch List",
      "RFIs",
      "Schedule",
      "Specifications",
      "Submittals",
      "Tasks",
      "Timesheets",
    ],
  },
  {
    label: "Resource Management",
    sources: [
      "Budget",
      "Change Events",
      "Change Orders",
      "Commitments",
      "Company",
      "Employees",
      "Invoices",
      "Prime Contracts",
      "Project",
      "Timesheets",
    ],
  },
];

function Create360CategoryModal({
  selected,
  onSelect,
  onClose,
  onContinue,
}: {
  selected: string;
  onSelect: (label: string) => void;
  onClose: () => void;
  onContinue: () => void;
}) {
  const [openCategory, setOpenCategory] = useState<string | null>(selected);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl flex flex-col max-h-[90vh]">
        <div className="px-6 py-5 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Create a New 360 Report</h2>
          <p className="text-xs text-gray-500 mt-1">
            Make data-driven decisions easier by using 360 Reports to compile data from multiple tools, even inactive project data, into a single report.
          </p>
        </div>
        <div className="px-6 py-5 flex-1 overflow-y-auto bg-gray-50 space-y-3">
          {REPORT_360_CATEGORIES.map((cat) => {
            const isSelected = selected === cat.label;
            const isOpen = openCategory === cat.label;
            const half = Math.ceil(cat.sources.length / 2);
            const leftCol = cat.sources.slice(0, half);
            const rightCol = cat.sources.slice(half);
            return (
              <div key={cat.label} className="bg-white rounded-lg shadow-sm">
                <button
                  type="button"
                  onClick={() => {
                    onSelect(cat.label);
                    setOpenCategory(isOpen ? null : cat.label);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-4 text-left"
                >
                  <span
                    className={`flex-shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      isSelected ? "border-blue-600" : "border-gray-300"
                    }`}
                  >
                    {isSelected && <span className="w-2 h-2 rounded-full bg-blue-600" />}
                  </span>
                  <span className="flex-1 text-sm font-semibold text-gray-900">{cat.label}</span>
                  {cat.isNew && (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200">
                      New
                    </span>
                  )}
                  <svg
                    className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {isOpen && (
                  <div className="px-10 pb-4 -mt-1">
                    <p className="text-xs text-gray-500 mb-2">
                      Create custom reports with connected data from across all of your {cat.label} tools.
                    </p>
                    <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm text-gray-700">
                      <ul className="list-disc list-inside space-y-1">
                        {leftCol.map((s) => (
                          <li key={s}>{s}</li>
                        ))}
                      </ul>
                      <ul className="list-disc list-inside space-y-1">
                        {rightCol.map((s) => (
                          <li key={s}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-md"
          >
            Cancel
          </button>
          <button
            onClick={onContinue}
            className="px-5 py-2 text-sm font-medium bg-gray-900 text-white rounded-md hover:bg-gray-700"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ReportingClient({
  projectId,
  currentUserName,
}: {
  projectId: string;
  currentUserName?: string;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"reports" | "templates" | "dashboards">("reports");
  const [search, setSearch] = useState("");
  const [myReports, setMyReports] = useState<SavedReport[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<SectionId>("my-reports");
  const [openSectionIds, setOpenSectionIds] = useState<Set<SectionId>>(
    () => new Set<SectionId>(REPORT_SECTIONS.map((s) => s.id))
  );

  const [dashboards, setDashboards] = useState<SavedDashboard[]>([]);
  const [showCreateDashboardModal, setShowCreateDashboardModal] = useState(false);
  const [shareDashboardId, setShareDashboardId] = useState<string | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<ReportDef | null>(null);
  const [showAssistModal, setShowAssistModal] = useState(false);
  const [previewInDashboardReportId, setPreviewInDashboardReportId] = useState<string | null>(null);
  const [editReportId, setEditReportId] = useState<string | null>(null);
  const [distributeReportId, setDistributeReportId] = useState<string | null>(null);
  const [deleteReportId, setDeleteReportId] = useState<string | null>(null);
  const [shareReportId, setShareReportId] = useState<string | null>(null);
  const [promoteReportId, setPromoteReportId] = useState<string | null>(null);
  const [templateDatasetFilter, setTemplateDatasetFilter] = useState("all");
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<PermissionRow[]>([
    { id: "u1", name: "Company Admin", reporting: "admin", directory: "admin" },
    { id: "u2", name: "Project Manager", reporting: "standard", directory: "standard" },
    { id: "u3", name: "Field Engineer", reporting: "none", directory: "standard" },
    { id: "u4", name: "Executive (Template)", reporting: "template", directory: "template" },
  ]);

  const [activeReport, setActiveReport] = useState<ReportDef | null>(null);
  const [activeCalculatedColumns, setActiveCalculatedColumns] = useState<CalculatedColumn[]>([]);
  const [activeSavedReport, setActiveSavedReport] = useState<SavedReport | null>(null);
  const [activeReportFullscreen, setActiveReportFullscreen] = useState(false);
  const [activeTemplateLaunchConfig, setActiveTemplateLaunchConfig] = useState<TemplateLaunchConfig | undefined>();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createType, setCreateType] = useState("");
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const [show360CategoryModal, setShow360CategoryModal] = useState(false);
  const [selected360Category, setSelected360Category] = useState<string>("Directory & Portfolio");

  const visualLibrary = useMemo(() => myReports.map(makeVisualFromReport), [myReports]);

  function openTemplate(def: ReportDef) {
    setActiveReport(def);
    setActiveSavedReport(null);
    setActiveCalculatedColumns([]);
    setActiveReportFullscreen(true);
    setActiveTemplateLaunchConfig(getTemplateLaunchConfig(def));
  }

  function openFromSaved(saved: SavedReport) {
    if (saved.reportType === "360 Report") {
      router.push(`/projects/${projectId}/reporting/360/${saved.id}`);
      return;
    }

    // Reports created via the drag-and-drop Single Tool builder persist their
    // tabs/datasets/columns to localStorage and have no templateValue. Route
    // those back to the builder; template-based "Single Tool Report" saves
    // (including Assist-generated reports) fall through to RunReportModal.
    if (saved.hasSingleToolTabs || (saved.reportType === "Single Tool Report" && !saved.templateValue)) {
      router.push(`/projects/${projectId}/reporting/single-tool/${saved.id}`);
      return;
    }

    // Otherwise it's a template-based saved report — look up the exact
    // template by its stored value or by an exact label prefix match on the
    // saved name. Anything looser was silently swapping templates.
    const def =
      (saved.templateValue ? REPORT_TYPES.find((r) => r.value === saved.templateValue) : undefined) ??
      REPORT_TYPES.find((r) => {
        const expectedType = r.group === "Daily Log" ? "Daily Log Report" : "Single Tool Report";
        return expectedType === saved.reportType && r.label === saved.name.split(" - ")[0];
      });

    if (def) {
      setActiveReport(def);
      setActiveSavedReport(saved);
      setActiveCalculatedColumns(saved.calculatedColumns ?? []);
      setActiveTemplateLaunchConfig(undefined);
      return;
    }

    router.push(`/projects/${projectId}/reporting/360/${saved.id}`);
  }

  function persistSavedReport(report: SavedReport) {
    if (typeof window === "undefined") return;
    saveReport(projectId, {
      id: report.id,
      name: report.name,
      reportType: report.reportType,
      templateValue: report.templateValue,
      description: report.description,
      createdBy: report.createdBy,
      createdAt: report.createdAt,
      updatedAt: report.updatedAt,
      sharedWith: report.sharedWith,
      lastRunRecordCount: report.lastRunRecordCount,
      visualConfig: report.visualConfig as unknown as Record<string, unknown> | undefined,
      calculatedColumns: report.calculatedColumns as unknown as Record<string, unknown>[] | undefined,
      filters: report.filters as unknown as Record<string, unknown>[] | undefined,
    });
  }

  function handleSaveReport(report: SavedReport) {
    setMyReports((prev) => [report, ...prev]);
    persistSavedReport(report);
  }

  function deleteReport(id: string) {
    setMyReports((prev) => prev.filter((r) => r.id !== id));
    deleteSavedReport(projectId, id);
  }

  // Hydrate persisted 360 reports on mount so reports saved from the new
  // builder page appear under "My Reports" immediately.
  useEffect(() => {
    const persisted = loadSavedReports(projectId);
    if (persisted.length === 0) return;
    setMyReports((prev) => {
      const existingIds = new Set(prev.map((r) => r.id));
      const additions: SavedReport[] = persisted
        .filter((p: StoredReport) => !existingIds.has(p.id))
        .map((p: StoredReport) => ({
          id: p.id,
          name: p.name,
          reportType: p.reportType,
          templateValue: p.templateValue,
          description: p.description,
          createdBy: p.createdBy,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
          sharedWith: p.sharedWith ?? [],
          lastRunRecordCount: p.lastRunRecordCount,
          hasSingleToolTabs: (p.singleToolTabs?.length ?? 0) > 0,
          visualConfig: p.visualConfig as unknown as VisualConfig | undefined,
          calculatedColumns: p.calculatedColumns as unknown as CalculatedColumn[] | undefined,
          filters: p.filters as unknown as ReportFilter[] | undefined,
        }));
      return [...additions, ...prev];
    });
  }, [projectId]);

  function updateSavedReport(reportId: string, patch: Partial<SavedReport>) {
    setMyReports((prev) =>
      prev.map((r) => {
        if (r.id !== reportId) return r;
        const next = { ...r, ...patch, updatedAt: new Date().toISOString() };
        persistSavedReport(next);
        return next;
      })
    );
  }

  function distributeSnapshot(payload: { reportId: string; recipients: string[]; format: "pdf" | "csv" | "xlsx"; schedule: SnapshotSchedule }) {
    const now = new Date().toISOString();
    setMyReports((prev) =>
      prev.map((r) =>
        r.id === payload.reportId
          ? { ...r, distributionCount: (r.distributionCount ?? 0) + 1, lastDistributedAt: now, updatedAt: now }
          : r
      )
    );
    setDistributeReportId(null);
  }

  function shareReport(reportId: string, sharedWith: string[]) {
    updateSavedReport(reportId, { sharedWith });
    setShareReportId(null);
  }

  function promoteReport(reportId: string) {
    updateSavedReport(reportId, {
      promotedToCompanyAt: new Date().toISOString(),
      promotedBy: "Company Admin",
    });
    setPromoteReportId(null);
  }

  function cloneReport(report: SavedReport) {
    const now = new Date().toISOString();
    const clone: SavedReport = {
      ...report,
      id: crypto.randomUUID(),
      name: `${report.name}-Copy`,
      createdBy: "Me",
      createdAt: now,
      updatedAt: now,
      sourceReportId: report.id,
      sharedWith: [],
      calculatedColumns: report.calculatedColumns,
    };
    setMyReports((prev) => [clone, ...prev]);
    persistSavedReport(clone);
    setStatusBanner(`Copy created: ${clone.name}`);
  }

  function addVisualToReport(report: SavedReport) {
    if (report.createdBy !== "Me") {
      setStatusBanner("Only the report creator can add new visuals.");
      return;
    }
    if ((report.lastRunRecordCount ?? 0) >= 2500) {
      setStatusBanner("Add Visual is available only for reports under 2,500 records.");
      return;
    }
    const baseConfig = report.visualConfig ?? { visualType: "bar" as VisualType };
    const nextCards = [
      ...(report.visualCards ?? []),
      {
        id: crypto.randomUUID(),
        title: `${report.name} Visual ${(report.visualCards?.length ?? 0) + 1}`,
        description: "Added from report menu",
        config: baseConfig,
      },
    ];
    updateSavedReport(report.id, { visualCards: nextCards });
    setStatusBanner(`Visual added to ${report.name}.`);
  }

  function createDashboard(payload: { name: string; visualIds: string[] }) {
    const now = new Date().toISOString();
    const dashboard: SavedDashboard = {
      id: crypto.randomUUID(),
      name: payload.name,
      visualIds: payload.visualIds,
      isPublished: false,
      createdBy: "Me",
      createdAt: now,
      updatedAt: now,
      sharedWith: [],
    };
    setDashboards((prev) => [dashboard, ...prev]);
    setShowCreateDashboardModal(false);
  }

  function createDashboardFromReport(report: SavedReport, name?: string) {
    const visual = makeVisualFromReport(report);
    const now = new Date().toISOString();
    const dashboard: SavedDashboard = {
      id: crypto.randomUUID(),
      name: name?.trim() || `${report.name} Dashboard`,
      visualIds: [visual.id],
      isPublished: false,
      createdBy: "Me",
      createdAt: now,
      updatedAt: now,
      sharedWith: [],
    };
    setDashboards((prev) => [dashboard, ...prev]);
    setActiveTab("dashboards");
    setPreviewInDashboardReportId(null);
  }

  function updateDashboard(id: string, patch: Partial<SavedDashboard>) {
    setDashboards((prev) =>
      prev.map((d) => (d.id === id ? { ...d, ...patch, updatedAt: new Date().toISOString() } : d))
    );
  }

  function deleteDashboard(id: string) {
    setDashboards((prev) => prev.filter((d) => d.id !== id));
  }

  const filteredTemplates = useMemo(() => {
    const q = search.toLowerCase();
    const scoped = templateDatasetFilter === "all" ? REPORT_TYPES : REPORT_TYPES.filter((r) => r.group === templateDatasetFilter);
    if (!q) return scoped;
    return scoped.filter(
      (r) => r.label.toLowerCase().includes(q) || r.group.toLowerCase().includes(q) || r.description.toLowerCase().includes(q)
    );
  }, [search, templateDatasetFilter]);

  const filteredMyReports = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return myReports;
    return myReports.filter(
      (r) => r.name.toLowerCase().includes(q) || r.reportType.toLowerCase().includes(q) || r.description.toLowerCase().includes(q)
    );
  }, [search, myReports]);

  const groupedTemplates = useMemo(() => {
    return GROUPS.map((g) => ({
      group: g,
      items: filteredTemplates.filter((r) => r.group === g),
    })).filter((g) => g.items.length > 0);
  }, [filteredTemplates]);

  const filteredDashboards = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return dashboards;
    return dashboards.filter((d) => d.name.toLowerCase().includes(q) || d.sharedWith.join(" ").toLowerCase().includes(q));
  }, [dashboards, search]);

  const sharingDashboard = shareDashboardId ? dashboards.find((d) => d.id === shareDashboardId) ?? null : null;
  const editingReport = editReportId ? myReports.find((r) => r.id === editReportId) ?? null : null;
  const distributingReport = distributeReportId ? myReports.find((r) => r.id === distributeReportId) ?? null : null;
  const deletingReport = deleteReportId ? myReports.find((r) => r.id === deleteReportId) ?? null : null;
  const sharingReport = shareReportId ? myReports.find((r) => r.id === shareReportId) ?? null : null;
  const promotingReport = promoteReportId ? myReports.find((r) => r.id === promoteReportId) ?? null : null;
  const previewingReport = previewInDashboardReportId ? myReports.find((r) => r.id === previewInDashboardReportId) ?? null : null;

  useEffect(() => {
    if (!statusBanner) return;
    const timer = setTimeout(() => setStatusBanner(null), 4000);
    return () => clearTimeout(timer);
  }, [statusBanner]);

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <ProjectNav projectId={projectId} />

      <main className="max-w-[1400px] mx-auto px-6 py-8">
        <div className="flex items-end justify-between mb-6 gap-4 flex-wrap">
          <div>
            <h1 className="font-display text-[32px] leading-[1.05] tracking-[-0.012em] text-[color:var(--ink)]">Reporting</h1>
            <p className="sub mt-1.5">
              <em>360 Reporting across this project</em>
              <span className="sep">·</span>
              <span className="num">{myReports.length}</span> {myReports.length === 1 ? "report" : "reports"}
              <span className="sep">·</span>
              <span className="num">{REPORT_TYPES.length}</span> templates
              <span className="sep">·</span>
              <span className="num">{dashboards.length}</span> {dashboards.length === 1 ? "dashboard" : "dashboards"}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowSettingsModal(true)}
              className="btn-secondary"
            >
              Configure Settings
            </button>
            <button
              onClick={() => setShowAssistModal(true)}
              className="btn-secondary"
            >
              Assist
            </button>
            {activeTab !== "dashboards" ? (
              <div className="relative">
                <button
                  onClick={() => setCreateMenuOpen((v) => !v)}
                  className="btn-primary flex items-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  Create
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {createMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setCreateMenuOpen(false)} />
                    <div className="absolute right-0 top-11 z-20 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[280px]">
                      <button
                        onClick={() => {
                          setCreateMenuOpen(false);
                          setSelected360Category("Directory & Portfolio");
                          setShow360CategoryModal(true);
                        }}
                        className="w-full text-left px-4 py-2.5 hover:bg-gray-50"
                      >
                        <p className="text-sm font-semibold text-gray-900">360 Report</p>
                        <p className="text-xs text-gray-500 mt-0.5">Create reports using data across multiple tools or a single tool</p>
                      </button>
                      <button
                        onClick={() => {
                          setCreateMenuOpen(false);
                          router.push(`/projects/${projectId}/reporting/single-tool/new`);
                        }}
                        className="w-full text-left px-4 py-2.5 hover:bg-gray-50"
                      >
                        <p className="text-sm font-semibold text-gray-900">Single Tool Report</p>
                        <p className="text-xs text-gray-500 mt-0.5">Create reports using data from a single tool only</p>
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <button
                onClick={() => setShowCreateDashboardModal(true)}
                className="btn-primary flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Create Dashboard
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 mb-5 flex-wrap">
          <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden bg-white">
            <button onClick={() => setActiveTab("reports")} className={`px-3 py-1.5 text-xs font-semibold transition-colors ${activeTab === "reports" ? "bg-[color:var(--ink)] text-white" : "bg-white text-gray-700 hover:bg-gray-50"}`}>Reports</button>
            <button onClick={() => setActiveTab("templates")} className={`px-3 py-1.5 text-xs font-semibold transition-colors ${activeTab === "templates" ? "bg-[color:var(--ink)] text-white" : "bg-white text-gray-700 hover:bg-gray-50"}`}>All Templates</button>
            <button onClick={() => setActiveTab("dashboards")} className={`px-3 py-1.5 text-xs font-semibold transition-colors ${activeTab === "dashboards" ? "bg-[color:var(--ink)] text-white" : "bg-white text-gray-700 hover:bg-gray-50"}`}>Dashboards</button>
          </div>
          <div className="relative max-w-xs ml-auto">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={activeTab === "reports" ? "Search reports" : activeTab === "templates" ? "Search templates" : "Search dashboards"}
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[color:var(--ink)]"
            />
          </div>
        </div>
        {statusBanner && (
          <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
            {statusBanner}
          </div>
        )}

        {activeTab === "reports" && (
          <div className="flex gap-6 items-start">
            <aside className="w-56 shrink-0">
              <p className="mono-label mb-2 px-1">Report Library</p>
              <nav className="bg-white border hairline rounded-xl overflow-hidden">
                <ul>
                  {REPORT_SECTIONS.map((section) => {
                    const selected = selectedSectionId === section.id;
                    return (
                      <li key={section.id}>
                        <button
                          onClick={() => {
                            setSelectedSectionId(section.id);
                            setOpenSectionIds((prev) => {
                              const next = new Set(prev);
                              next.add(section.id);
                              return next;
                            });
                            if (typeof document !== "undefined") {
                              const el = document.getElementById(`section-${section.id}`);
                              if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                            }
                          }}
                          className={`w-full text-left px-3 py-2 text-sm border-l-2 transition-colors ${
                            selected
                              ? "border-[color:var(--brand-500)] bg-[color:var(--surface-sunken)] text-[color:var(--ink)] font-semibold"
                              : "border-transparent text-gray-600 hover:bg-[color:var(--surface-sunken)]"
                          }`}
                        >
                          {section.title}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </nav>
            </aside>

            <div className="flex-1 min-w-0 space-y-4">
              {REPORT_SECTIONS.map((section) => (
                <SectionCard
                  key={section.id}
                  section={section}
                  open={openSectionIds.has(section.id)}
                  search={search}
                  onToggle={() =>
                    setOpenSectionIds((prev) => {
                      const next = new Set(prev);
                      if (next.has(section.id)) next.delete(section.id);
                      else next.add(section.id);
                      return next;
                    })
                  }
                  onViewAll={() => {
                    setSelectedSectionId(section.id);
                    setOpenSectionIds((prev) => {
                      const next = new Set(prev);
                      next.add(section.id);
                      return next;
                    });
                  }}
                  myReports={filteredMyReports}
                  templates={REPORT_TYPES}
                  onOpenSaved={openFromSaved}
                  onOpenTemplate={openTemplate}
                  onPreviewTemplate={setPreviewTemplate}
                  onAddVisual={addVisualToReport}
                  onEditReport={(id) => setEditReportId(id)}
                  onShareReport={(id) => setShareReportId(id)}
                  onDistribute={(id) => setDistributeReportId(id)}
                  onPreviewInDashboard={(id) => setPreviewInDashboardReportId(id)}
                  onPromote={(id) => setPromoteReportId(id)}
                  onCloneReport={cloneReport}
                  onDeleteReport={(id) => setDeleteReportId(id)}
                />
              ))}
            </div>
          </div>
        )}

        {activeTab === "templates" && (
          <div>
            <div className="mb-4 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-900">
              Templates are customizable, industry-standard reports. Preview a template, then save it as a new report in My Reports.
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500">Filter Data Sets</label>
                <select
                  value={templateDatasetFilter}
                  onChange={(e) => setTemplateDatasetFilter(e.target.value)}
                  className="px-2.5 py-1.5 border border-gray-200 rounded text-xs bg-white"
                >
                  <option value="all">All</option>
                  {GROUPS.map((group) => (
                    <option key={group} value={group}>
                      {group}
                    </option>
                  ))}
                </select>
                <span className="text-xs text-gray-400">{filteredTemplates.length} templates</span>
              </div>
              {groupedTemplates.map(({ group, items }) => (
                <div key={group}>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1.5 px-1">{group}</p>
                  <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 w-64">Report Name</th>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 w-44">Report Type</th>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Description</th>
                          <th className="w-10" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {items.map((r) => (
                          <tr key={r.value} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => openTemplate(r)}>
                            <td className="px-4 py-3 font-medium text-gray-900">{r.label}</td>
                            <td className="px-4 py-3">
                              <TypeBadge group={r.group} />
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-500 max-w-sm">{r.description}</td>
                            <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                              <RowMenu
                                actions={[
                                  { label: "Preview Template", onClick: () => setPreviewTemplate(r) },
                                  { label: "Use Template", onClick: () => openTemplate(r) },
                                ]}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
              {groupedTemplates.length === 0 && (
                <div className="bg-white border border-gray-200 rounded-lg py-10 text-center">
                  <p className="text-sm text-gray-400">No templates match your search.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "dashboards" && (
          <div className="space-y-4">
            <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-900">
              Dashboards are built from visuals created from your custom reports. Publish a dashboard before sharing it with Standard or Read Only users.
            </div>

            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              {filteredDashboards.length === 0 ? (
                <div className="py-12 text-center text-sm text-gray-400">No dashboards yet. Click “Create Dashboard” to start.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Dashboard</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Visuals</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Status</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Shared With</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Updated</th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredDashboards.map((dashboard) => (
                      <tr key={dashboard.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">{dashboard.name}</p>
                          <p className="text-xs text-gray-500">Created by {dashboard.createdBy}</p>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{dashboard.visualIds.length}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 text-xs rounded border ${
                              dashboard.isPublished
                                ? "border-emerald-200 text-emerald-700 bg-emerald-50"
                                : "border-gray-200 text-gray-600 bg-gray-50"
                            }`}
                          >
                            {dashboard.isPublished ? "Published" : "Draft"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600">
                          {dashboard.sharedWith.length === 0 ? "Not shared" : dashboard.sharedWith.join(", ")}
                        </td>
                        <td className="px-4 py-3 text-gray-500">{fmtDate(dashboard.updatedAt)}</td>
                        <td className="px-2 py-3">
                          <RowMenu
                            actions={[
                              {
                                label: dashboard.isPublished ? "Unpublish" : "Publish",
                                onClick: () => updateDashboard(dashboard.id, { isPublished: !dashboard.isPublished }),
                              },
                              { label: "Share", onClick: () => setShareDashboardId(dashboard.id) },
                              { label: "Delete", onClick: () => deleteDashboard(dashboard.id), danger: true },
                            ]}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {filteredDashboards.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredDashboards.map((dashboard) => {
                  const visuals = visualLibrary.filter((v) => dashboard.visualIds.includes(v.id));
                  return (
                    <div key={`${dashboard.id}-preview`} className="bg-white border border-gray-200 rounded-lg p-4">
                      <p className="text-sm font-semibold text-gray-900">{dashboard.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">Dashboard preview</p>
                      <div className="mt-3 space-y-2">
                        {visuals.length === 0 ? (
                          <p className="text-xs text-gray-400">No visuals selected.</p>
                        ) : (
                          visuals.map((visual) => (
                            <div key={visual.id} className="rounded border border-gray-200 bg-gray-50 px-3 py-2">
                              <p className="text-xs font-medium text-gray-700">{visual.title}</p>
                              <p className="text-[11px] text-gray-500 mt-0.5">
                                {VISUAL_TYPE_OPTIONS.find((option) => option.value === visual.visualType)?.label ?? "Visual"}
                                {visual.summary ? ` · ${visual.summary}` : ""}
                              </p>
                              <p className="text-[11px] text-gray-500 mt-0.5">
                                {visual.metricLabel}: {visual.metricValue}
                              </p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {activeReport && (
        <RunReportModal
          reportDef={activeReport}
          projectId={projectId}
          existingReport={activeSavedReport}
          initialCalculatedColumns={activeCalculatedColumns}
          fullscreen={activeReportFullscreen}
          templateLaunchConfig={activeTemplateLaunchConfig}
          onClose={() => {
            setActiveReport(null);
            setActiveSavedReport(null);
            setActiveCalculatedColumns([]);
            setActiveReportFullscreen(false);
            setActiveTemplateLaunchConfig(undefined);
          }}
          onSave={handleSaveReport}
          onUpdate={updateSavedReport}
        />
      )}

      {show360CategoryModal && (
        <Create360CategoryModal
          selected={selected360Category}
          onSelect={setSelected360Category}
          onClose={() => setShow360CategoryModal(false)}
          onContinue={() => {
            setShow360CategoryModal(false);
            router.push(`/projects/${projectId}/reporting/360/new?category=${encodeURIComponent(selected360Category)}`);
          }}
        />
      )}

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-1">Create Report</h2>
            <p className="text-xs text-gray-400 mb-4">Create 360 Report → select dataset (or choose a template from All Templates).</p>
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-700 mb-1">Report Type</label>
              <select
                value={createType}
                onChange={(e) => setCreateType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900"
              >
                <option value="">Select a report...</option>
                {GROUPS.map((group) => (
                  <optgroup key={group} label={group}>
                    {REPORT_TYPES.filter((r) => r.group === group).map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setCreateType("");
                }}
                className="flex-1 py-2 border border-gray-200 text-sm text-gray-600 rounded-md hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                disabled={!createType}
                onClick={() => {
                  const def = REPORT_TYPES.find((r) => r.value === createType);
                  if (def) {
                    setShowCreateModal(false);
                    setCreateType("");
                    setActiveReport(def);
                    setActiveSavedReport(null);
                    setActiveCalculatedColumns([]);
                    setActiveTemplateLaunchConfig(undefined);
                  }
                }}
                className="flex-1 py-2 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-700 transition-colors disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreateDashboardModal && (
        <CreateDashboardModal
          visuals={visualLibrary}
          onClose={() => setShowCreateDashboardModal(false)}
          onCreate={createDashboard}
        />
      )}

      {sharingDashboard && (
        <ShareDashboardModal
          dashboard={sharingDashboard}
          onClose={() => setShareDashboardId(null)}
          onShare={(viewerGroups) => updateDashboard(sharingDashboard.id, { sharedWith: viewerGroups })}
        />
      )}

      {previewTemplate && (
        <TemplatePreviewModal
          template={previewTemplate}
          onClose={() => setPreviewTemplate(null)}
          onUseTemplate={(template) => {
            setPreviewTemplate(null);
            openTemplate(template);
          }}
        />
      )}

      {showAssistModal && (
        <AssistReportModal
          projectId={projectId}
          onClose={() => setShowAssistModal(false)}
          onCreate={(rec) => {
            setShowAssistModal(false);
            const now = new Date().toISOString();
            const isDailyLog = rec.def.group === "Daily Log";
            const calculatedColumns: CalculatedColumn[] = rec.calculatedColumns.map((c) => ({
              id: `calc_${crypto.randomUUID()}`,
              name: c.name,
              type: c.output === "date-variance" ? "date-variance" : "basic",
              output: c.output,
              leftSource: c.leftSource,
              operator: c.operator,
              rightSource: c.rightSource,
              leftConstant: c.leftConstant,
              rightConstant: c.rightConstant,
              decimals: c.decimals,
              rounding: c.rounding,
            }));
            const visualConfig: VisualConfig = {
              visualType: "table",
              sortByKey: rec.sortByKey,
              sortDirection: rec.sortDirection ?? "asc",
              selectedColumnKeys: rec.columns.length > 0 ? rec.columns : undefined,
              groupByKey: rec.groupByKey,
            };
            const stored: StoredReport = {
              id: crypto.randomUUID(),
              name: rec.name,
              reportType: isDailyLog ? "Daily Log Report" : "Single Tool Report",
              templateValue: rec.def.value,
              description: rec.description,
              createdBy: currentUserName || "Assist",
              createdAt: now,
              updatedAt: now,
              sharedWith: [],
              category: rec.def.group,
              selectedColumns: rec.columns.map((key) => {
                const col = rec.def.columns.find((c) => c.key === key);
                return {
                  id: key,
                  categoryLabel: rec.def.group,
                  source: rec.def.label,
                  fieldKey: key,
                  fieldLabel: col?.label ?? key,
                };
              }),
              visualConfig: visualConfig as unknown as Record<string, unknown>,
              calculatedColumns: calculatedColumns as unknown as Record<string, unknown>[],
              filters: rec.filters as unknown as Record<string, unknown>[],
            };
            saveReport(projectId, stored);
            const savedReport: SavedReport = {
              id: stored.id,
              name: stored.name,
              reportType: stored.reportType,
              templateValue: stored.templateValue,
              description: stored.description,
              createdBy: stored.createdBy,
              createdAt: stored.createdAt,
              updatedAt: stored.updatedAt,
              sharedWith: stored.sharedWith,
              calculatedColumns,
              visualConfig,
              filters: rec.filters,
            };
            handleSaveReport(savedReport);
            setActiveReport(rec.def);
            setActiveSavedReport(savedReport);
            setActiveTemplateLaunchConfig(undefined);
            setActiveCalculatedColumns(calculatedColumns);
            setActiveReportFullscreen(true);
            setStatusBanner(`Assist created “${stored.name}”. Review and adjust as needed.`);
          }}
        />
      )}

      {editingReport && (
        <EditReportModal
          report={editingReport}
          onClose={() => setEditReportId(null)}
          onSave={(reportId, patch) => {
            updateSavedReport(reportId, patch);
            setEditReportId(null);
          }}
        />
      )}

      {distributingReport && (
        <DistributeSnapshotModal
          report={distributingReport}
          onClose={() => setDistributeReportId(null)}
          onSend={distributeSnapshot}
        />
      )}

      {sharingReport && (
        <ShareReportModal
          report={sharingReport}
          onClose={() => setShareReportId(null)}
          onShare={shareReport}
        />
      )}

      {promotingReport && (
        <PromoteReportModal
          report={promotingReport}
          onClose={() => setPromoteReportId(null)}
          onPromote={promoteReport}
        />
      )}

      {previewingReport && (
        <PreviewInDashboardModal
          report={previewingReport}
          onClose={() => setPreviewInDashboardReportId(null)}
          onCreate={(dashboardName) => createDashboardFromReport(previewingReport, dashboardName)}
        />
      )}

      {deletingReport && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-base font-semibold text-gray-900">Delete Report</h2>
            <p className="text-sm text-gray-600 mt-2">
              Are you sure you want to permanently delete <span className="font-medium">{deletingReport.name}</span>?
            </p>
            <p className="text-xs text-red-600 mt-1">This action cannot be undone.</p>
            <div className="flex gap-2 mt-6">
              <button onClick={() => setDeleteReportId(null)} className="flex-1 py-2 border border-gray-200 text-sm rounded-md text-gray-600">
                Cancel
              </button>
              <button
                onClick={() => {
                  deleteReport(deletingReport.id);
                  setDeleteReportId(null);
                }}
                className="flex-1 py-2 bg-red-600 text-white text-sm rounded-md"
              >
                Delete Report
              </button>
            </div>
          </div>
        </div>
      )}

      {showSettingsModal && (
        <ReportingSettingsModal
          rows={permissions}
          onClose={() => setShowSettingsModal(false)}
          onSave={(rows) => {
            setPermissions(rows);
            setShowSettingsModal(false);
          }}
        />
      )}
    </div>
  );
}
