"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ProjectNav from "@/components/ProjectNav";
import { loadSavedReports, saveReport } from "../../saved-reports-store";
import {
  FiltersPanel,
  FILTER_MODE_LABELS,
  distinctColumnValues,
  rowPassesFilters,
  type FilterCategory,
  type ReportFilter,
} from "../../report-filters";

// ─── Catalog ─────────────────────────────────────────────────────────────────

type DataSet = {
  id: string;
  label: string;
  columns: string[];
};

type Category = {
  id: string;
  label: string;
  dataSet?: DataSet;
  subDataSets?: DataSet[];
};

const COMMON_RECORD_COLUMNS = [
  "Date",
  "Created By",
  "Created At",
  "Comments",
  "Attachments",
  "Attachments Count",
  "Location",
  "Cost Code",
  "Status",
];

const PROJECT_ROLE_COLUMNS = [
  "Architect/Engineer",
  "Assistant Estimator",
  "Assistant Project Manager",
  "Assistant Superintendent",
  "CDA",
  "Executive",
  "Project Manager",
  "Superintendent",
  "Owner",
];

const DAILY_LOG_DATA_SETS: DataSet[] = [
  {
    id: "daily-construction-report-log",
    label: "Daily Construction Report Log",
    columns: ["Date", "Created By", "Notes", "Weather Summary", "Attachments", "Attachments Count", "Comments"],
  },
  {
    id: "phone-calls-log",
    label: "Phone Calls Log",
    columns: ["Date", "Time", "Caller", "Receiver", "Company", "Subject", "Comments", "Created By"],
  },
  {
    id: "notes-log",
    label: "Notes Log",
    columns: ["Date", "Is Issue", "Location", "Comments", "Created By", "Attachments Count"],
  },
  {
    id: "delays-log",
    label: "Delays Log",
    columns: ["Date", "Delay Type", "Start Time", "End Time", "Duration (hrs)", "Location", "Comments", "Created By"],
  },
  {
    id: "dumpster-log",
    label: "Dumpster Log",
    columns: ["Date", "Vendor", "Size", "Quantity", "Pickup Time", "Location", "Comments"],
  },
  {
    id: "quantities-log",
    label: "Quantities Log",
    columns: ["Date", "Cost Code", "Description", "Quantity", "UOM", "Location", "Comments"],
  },
  {
    id: "timecards-log",
    label: "Timecards Log",
    columns: ["Date", "Worker", "Company", "Cost Code", "Hours", "Overtime", "Comments"],
  },
  {
    id: "manpower-log",
    label: "Manpower Log",
    columns: [
      ...PROJECT_ROLE_COLUMNS,
      "Attachments",
      "Attachments Count",
      "Comments",
      "Company",
      "Cost Code",
      "Created By",
      "Date",
      "Hours",
      "Location",
      "Trade",
      "Workers",
    ],
  },
  {
    id: "visitors-log",
    label: "Visitors Log",
    columns: ["Date", "Visitor", "Company", "Start Time", "End Time", "Comments", "Created By"],
  },
  {
    id: "equipment-log",
    label: "Equipment Log",
    columns: ["Date", "Equipment Type", "Vendor", "Hours Used", "Operator", "Location", "Comments"],
  },
  {
    id: "accidents-log",
    label: "Accidents Log",
    columns: ["Date", "Time", "Party Involved", "Company Involved", "Severity", "Comments", "Created By"],
  },
  {
    id: "productivity-log",
    label: "Productivity Log",
    columns: ["Date", "Cost Code", "Planned Quantity", "Installed Quantity", "Hours", "Comments"],
  },
  {
    id: "observed-weather-conditions-log",
    label: "Observed Weather Conditions Log",
    columns: ["Date", "Time Observed", "Sky", "Temperature", "Wind", "Precipitation", "Ground/Sea", "Calamity", "Comments"],
  },
  {
    id: "inspections-log",
    label: "Inspections Log",
    columns: ["Date", "Inspection Type", "Inspecting Entity", "Inspector", "Start Time", "End Time", "Location", "Inspection Area", "Comments"],
  },
  {
    id: "deliveries-log",
    label: "Deliveries Log",
    columns: ["Date", "Time", "Delivery From", "Tracking Number", "Contents", "Received By", "Comments"],
  },
  {
    id: "daily-log-completion",
    label: "Daily Log Completion",
    columns: ["Date", "Completed By", "Completed At", "Status", "Comments"],
  },
  {
    id: "waste-log",
    label: "Waste Log",
    columns: ["Date", "Waste Type", "Quantity", "UOM", "Hauler", "Disposal Site", "Comments"],
  },
  {
    id: "safety-violations-log",
    label: "Safety Violations Log",
    columns: ["Date", "Time", "Subject", "Safety Notice", "Issued To", "Compliance Due", "Comments", "Created By"],
  },
];

const CHANGE_MANAGEMENT_DATA_SETS: DataSet[] = [
  {
    id: "change-events",
    label: "Change Events",
    columns: ["Number", "Title", "Status", "Scope", "Change Reason", "ROM Amount", "Created By", "Created At"],
  },
  {
    id: "change-event-line-items",
    label: "Change Event Line Items",
    columns: ["Change Event", "Budget Code", "Description", "Vendor", "Amount", "Cost Type"],
  },
  {
    id: "prime-contract-change-orders",
    label: "Prime Contract Change Orders",
    columns: ["Number", "Title", "Status", "Contract", "Amount", "Change Reason", "Due Date"],
  },
  {
    id: "commitment-change-orders",
    label: "Commitment Change Orders",
    columns: ["Number", "Title", "Status", "Company", "Contract", "Amount", "Change Reason", "Due Date"],
  },
];

const MEETINGS_DATA_SETS: DataSet[] = [
  {
    id: "meetings",
    label: "Meetings",
    columns: ["Title", "Date", "Location", "Status", "Created By", "Attendees Count"],
  },
  {
    id: "meeting-items",
    label: "Meeting Items",
    columns: ["Meeting", "Category", "Item", "Status", "Assignee", "Due Date", "Comments"],
  },
  {
    id: "meeting-attendees",
    label: "Meeting Attendees",
    columns: ["Meeting", "Attendee", "Company", "Present", "Comments"],
  },
];

const OWNER_INVOICES_DATA_SETS: DataSet[] = [
  {
    id: "owner-invoices",
    label: "Owner Invoices",
    columns: ["Invoice #", "Period", "Contract", "Status", "Amount", "Submitted At", "Approved At"],
  },
  {
    id: "owner-invoice-line-items",
    label: "Owner Invoice Line Items",
    columns: ["Invoice", "Budget Code", "Description", "This Period", "To Date", "Retainage"],
  },
];

const SUBCONTRACTOR_INVOICES_DATA_SETS: DataSet[] = [
  {
    id: "subcontractor-invoices",
    label: "Subcontractor Invoices",
    columns: ["Invoice #", "Period", "Contract", "Company", "Status", "Amount", "Submitted At"],
  },
  {
    id: "subcontractor-invoice-line-items",
    label: "Subcontractor Invoice Line Items",
    columns: ["Invoice", "Budget Code", "Description", "This Period", "To Date", "Retainage"],
  },
];

const SCHEDULE_TASKS_DATA_SETS: DataSet[] = [
  {
    id: "schedule-tasks",
    label: "Schedule Tasks",
    columns: ["UID", "Name", "Start", "Finish", "Duration", "% Complete", "Predecessors", "Resources"],
  },
  {
    id: "schedule-resources",
    label: "Schedule Resources",
    columns: ["Resource", "Type", "Cost Code", "Quantity"],
  },
  {
    id: "schedule-lookahead",
    label: "Schedule Lookahead",
    columns: ["UID", "Name", "Start", "Finish", "Owner", "Trade"],
  },
];

const CATEGORIES: Category[] = [
  { id: "change-management", label: "Change Management", subDataSets: CHANGE_MANAGEMENT_DATA_SETS },
  {
    id: "commitments",
    label: "Commitments",
    dataSet: {
      id: "commitments",
      label: "Commitments",
      columns: [
        "Number",
        "Type",
        "Company",
        "Title",
        "Status",
        "Accounting Method",
        "Original Amount",
        "Approved COs",
        "Pending COs",
        "Revised Amount",
        "ERP Status",
        "Executed",
        "Default Retainage",
        "Start Date",
        "Estimated Completion",
      ],
    },
  },
  {
    id: "correspondence",
    label: "Correspondence",
    dataSet: {
      id: "correspondence",
      label: "Correspondence",
      columns: ["Number", "Subject", "Type", "Status", "From", "To", "Created At", "Closed At"],
    },
  },
  { id: "daily-log", label: "Daily Log", subDataSets: DAILY_LOG_DATA_SETS },
  {
    id: "drawings",
    label: "Drawings",
    dataSet: {
      id: "drawings",
      label: "Drawings",
      columns: ["Number", "Title", "Discipline", "Revision", "Issued Date", "Set", "Uploaded By"],
    },
  },
  { id: "meetings", label: "Meetings", subDataSets: MEETINGS_DATA_SETS },
  { id: "owner-invoices", label: "Owner Invoices", subDataSets: OWNER_INVOICES_DATA_SETS },
  {
    id: "photos",
    label: "Photos",
    dataSet: {
      id: "photos",
      label: "Photos",
      columns: ["Title", "Album", "Taken At", "Uploaded By", "Location", "Trade", "Description"],
    },
  },
  {
    id: "prime-contract",
    label: "Prime Contract",
    dataSet: {
      id: "prime-contract",
      label: "Prime Contract",
      columns: ["Number", "Title", "Status", "Original Amount", "Approved COs", "Revised Amount", "Executed"],
    },
  },
  {
    id: "punch-list",
    label: "Punch List",
    dataSet: {
      id: "punch-list",
      label: "Punch List",
      columns: ["Item #", "Title", "Status", "Type", "Trade", "Priority", "Due Date", "Location", "Assigned To"],
    },
  },
  {
    id: "rfis",
    label: "RFIs",
    dataSet: {
      id: "rfis",
      label: "RFIs",
      columns: ["RFI #", "Subject", "Status", "Ball in Court", "Assignees", "Due Date", "Created At", "Closed At"],
    },
  },
  { id: "schedule-tasks", label: "Schedule Tasks", subDataSets: SCHEDULE_TASKS_DATA_SETS },
  {
    id: "specifications",
    label: "Specifications",
    dataSet: {
      id: "specifications",
      label: "Specifications",
      columns: ["Section", "Title", "Set", "Revision", "Issued Date", "Uploaded By"],
    },
  },
  { id: "subcontractor-invoices", label: "Subcontractor Invoices", subDataSets: SUBCONTRACTOR_INVOICES_DATA_SETS },
  {
    id: "submittals",
    label: "Submittals",
    dataSet: {
      id: "submittals",
      label: "Submittals",
      columns: ["Submittal #", "Title", "Status", "Type", "Submit By", "Received", "Issued", "Cost Code"],
    },
  },
  {
    id: "task-items",
    label: "Task Items",
    dataSet: {
      id: "task-items",
      label: "Task Items",
      columns: ["Task #", "Title", "Status", "Category", "Assignee", "Due Date", "Created At"],
    },
  },
];

// ─── Types ───────────────────────────────────────────────────────────────────

type ReportTab = {
  id: string;
  name: string;
  dataSetId: string | null;
  selectedColumns: string[];
  filters?: ReportFilter[];
};

// Mock data for the builder preview spans this many rows; filters and value
// suggestions operate over the same range so the preview reflects them.
const PREVIEW_ROW_COUNT = 6;

// ─── Component ───────────────────────────────────────────────────────────────

export default function SingleToolReportBuilderClient({
  projectId,
  currentUserName,
  currentUserEmail,
  reportId,
}: {
  projectId: string;
  currentUserName: string;
  currentUserEmail: string;
  reportId?: string;
}) {
  const router = useRouter();
  const [reportName, setReportName] = useState("");
  const [reportDescription, setReportDescription] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);

  const [tabs, setTabs] = useState<ReportTab[]>([
    { id: crypto.randomUUID(), name: "Tab 1", dataSetId: null, selectedColumns: [] },
  ]);
  const [activeTabId, setActiveTabId] = useState<string>(() => tabs[0]?.id ?? "");

  useEffect(() => {
    if (!reportId) return;
    const existing = loadSavedReports(projectId).find((r) => r.id === reportId);
    if (!existing) return;
    setReportName(existing.name);
    setReportDescription(existing.description ?? "");
    if (existing.singleToolTabs && existing.singleToolTabs.length > 0) {
      setTabs(
        existing.singleToolTabs.map((t) => ({
          id: t.id,
          name: t.name,
          dataSetId: t.dataSetId,
          selectedColumns: t.selectedColumns,
          filters: (t.filters as unknown as ReportFilter[]) ?? [],
        })),
      );
      setActiveTabId(existing.singleToolTabs[0].id);
    }
  }, [projectId, reportId]);
  const [expandedCategoryIds, setExpandedCategoryIds] = useState<Set<string>>(new Set());
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const activeTab = useMemo(() => tabs.find((t) => t.id === activeTabId) ?? null, [tabs, activeTabId]);

  const allDataSets = useMemo(() => {
    const list: DataSet[] = [];
    for (const c of CATEGORIES) {
      if (c.dataSet) list.push(c.dataSet);
      if (c.subDataSets) list.push(...c.subDataSets);
    }
    return list;
  }, []);

  const activeDataSet = useMemo(
    () => (activeTab?.dataSetId ? allDataSets.find((d) => d.id === activeTab.dataSetId) ?? null : null),
    [activeTab, allDataSets]
  );

  function toggleCategory(id: string) {
    setExpandedCategoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectDataSetForActiveTab(ds: DataSet) {
    if (!activeTab) return;
    setTabs((prev) =>
      prev.map((t) =>
        t.id === activeTab.id
          ? { ...t, dataSetId: ds.id, name: ds.label, selectedColumns: [], filters: [] }
          : t
      )
    );
  }

  function addTab() {
    const newTab: ReportTab = {
      id: crypto.randomUUID(),
      name: `Tab ${tabs.length + 1}`,
      dataSetId: null,
      selectedColumns: [],
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.id);
  }

  function removeTab(id: string) {
    setTabs((prev) => {
      const next = prev.filter((t) => t.id !== id);
      if (next.length === 0) {
        const fresh = { id: crypto.randomUUID(), name: "Tab 1", dataSetId: null, selectedColumns: [] };
        setActiveTabId(fresh.id);
        return [fresh];
      }
      if (id === activeTabId) setActiveTabId(next[0].id);
      return next;
    });
  }

  function handleColumnDrop(column: string) {
    if (!activeTab) return;
    setTabs((prev) =>
      prev.map((t) => {
        if (t.id !== activeTab.id) return t;
        if (t.selectedColumns.includes(column)) return t;
        return { ...t, selectedColumns: [...t.selectedColumns, column] };
      })
    );
  }

  function reorderColumn(from: number, to: number) {
    if (!activeTab) return;
    setTabs((prev) =>
      prev.map((t) => {
        if (t.id !== activeTab.id) return t;
        const cols = [...t.selectedColumns];
        const [moved] = cols.splice(from, 1);
        cols.splice(to, 0, moved);
        return { ...t, selectedColumns: cols };
      })
    );
  }

  function removeColumn(column: string) {
    if (!activeTab) return;
    setTabs((prev) =>
      prev.map((t) =>
        t.id === activeTab.id ? { ...t, selectedColumns: t.selectedColumns.filter((c) => c !== column) } : t
      )
    );
  }

  // ─── Filters (per active tab) ──────────────────────────────────────────────
  const previewName = currentUserName || currentUserEmail;
  const activeFilters = useMemo<ReportFilter[]>(() => activeTab?.filters ?? [], [activeTab]);

  // A single tool report = one data set → one filter category whose
  // sub-categories are its columns.
  const filterCategories = useMemo<FilterCategory[]>(() => {
    if (!activeDataSet) return [];
    return [
      {
        label: activeDataSet.label,
        source: activeDataSet.id,
        fields: activeDataSet.columns.map((col) => ({ key: col, label: col })),
      },
    ];
  }, [activeDataSet]);

  function setActiveTabFilters(next: ReportFilter[]) {
    if (!activeTab) return;
    setTabs((prev) => prev.map((t) => (t.id === activeTab.id ? { ...t, filters: next } : t)));
  }

  function suggestionsForFilter(filter: ReportFilter): string[] {
    return distinctColumnValues(
      Array.from({ length: PREVIEW_ROW_COUNT }, (_, i) => String(mockValueFor(filter.columnKey, i, previewName))),
    );
  }

  // Drop filters whose column is no longer present in the active data set.
  useEffect(() => {
    if (!activeTab || !activeDataSet) return;
    const valid = new Set(activeDataSet.columns);
    const filtered = (activeTab.filters ?? []).filter((f) => valid.has(f.columnKey));
    if (filtered.length !== (activeTab.filters ?? []).length) {
      setActiveTabFilters(filtered);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab?.id, activeDataSet]);

  const canCreate = reportName.trim().length > 0 && tabs.some((t) => t.dataSetId && t.selectedColumns.length > 0);

  function handleCreate() {
    if (!canCreate) return;
    const firstWithData = tabs.find((t) => t.dataSetId);
    const ds = firstWithData ? allDataSets.find((d) => d.id === firstWithData.dataSetId) ?? null : null;
    const now = new Date().toISOString();
    const existing = reportId ? loadSavedReports(projectId).find((r) => r.id === reportId) : null;
    saveReport(projectId, {
      id: reportId ?? crypto.randomUUID(),
      name: reportName.trim(),
      reportType: "Single Tool Report",
      description: reportDescription.trim() || (ds ? `Single tool report on ${ds.label}.` : "Single tool report."),
      createdBy: existing?.createdBy ?? (currentUserName || currentUserEmail),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      sharedWith: existing?.sharedWith ?? [],
      singleToolTabs: tabs,
      lastRunRecordCount: existing?.lastRunRecordCount ?? 0,
    });
    router.push(`/projects/${projectId}/reporting`);
  }

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col">
      <ProjectNav projectId={projectId} />

      <div className="border-b border-gray-200 bg-white px-6 py-3">
        <div className="text-xs text-gray-500">
          <button
            onClick={() => router.push(`/projects/${projectId}/reporting`)}
            className="hover:text-gray-700"
          >
            Reports
          </button>
          <span className="mx-1">›</span>
          <span className="text-gray-700">{reportName.trim() || "Enter Report Name"}</span>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        <main className="flex-1 min-w-0 px-8 py-6 overflow-auto">
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1 min-w-0">
              {editingName ? (
                <input
                  autoFocus
                  value={reportName}
                  onChange={(e) => setReportName(e.target.value)}
                  onBlur={() => setEditingName(false)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === "Escape") setEditingName(false);
                  }}
                  className="text-2xl font-semibold text-gray-900 w-full border-b border-gray-300 focus:outline-none focus:border-gray-900 bg-transparent"
                  placeholder="Enter Report Name"
                />
              ) : (
                <button
                  onClick={() => setEditingName(true)}
                  className="flex items-center gap-2 group text-left"
                >
                  <h1 className="font-display text-[24px] leading-tight text-[color:var(--ink)]">
                    {reportName.trim() || "Enter Report Name"}
                    <span className="text-orange-500 ml-1">*</span>
                  </h1>
                  <PencilIcon />
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-6">
              <button
                onClick={() => router.push(`/projects/${projectId}/reporting`)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!canCreate}
                className={`px-4 py-2 text-sm rounded-md font-medium ${
                  canCreate
                    ? "bg-orange-500 text-white hover:bg-orange-600"
                    : "bg-orange-200 text-white cursor-not-allowed"
                }`}
              >
                Create Report
              </button>
            </div>
          </div>

          <div className="mb-6">
            {editingDescription ? (
              <input
                autoFocus
                value={reportDescription}
                onChange={(e) => setReportDescription(e.target.value)}
                onBlur={() => setEditingDescription(false)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === "Escape") setEditingDescription(false);
                }}
                placeholder="Enter Description"
                className="text-sm text-gray-700 w-full border-b border-gray-200 focus:outline-none focus:border-gray-700 bg-transparent"
              />
            ) : (
              <button
                onClick={() => setEditingDescription(true)}
                className="flex items-center gap-2 text-sm text-gray-700 group"
              >
                {reportDescription.trim() || "Enter Description"}
                <PencilIcon />
              </button>
            )}
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200 mb-6 flex items-center">
            {tabs.map((tab) => {
              const isActive = tab.id === activeTabId;
              return (
                <div
                  key={tab.id}
                  className={`flex items-center gap-2 px-4 py-2 text-sm border-b-2 -mb-px cursor-pointer ${
                    isActive
                      ? "border-orange-500 text-gray-900 font-medium"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                  onClick={() => setActiveTabId(tab.id)}
                >
                  <span>{tab.name}</span>
                  {tabs.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeTab(tab.id);
                      }}
                      className="text-gray-400 hover:text-gray-600"
                      aria-label="Remove tab"
                    >
                      ×
                    </button>
                  )}
                </div>
              );
            })}
            <button
              onClick={addTab}
              className="px-3 py-2 text-sm text-orange-600 hover:text-orange-700 border-b-2 border-transparent"
            >
              + Add a Tab
            </button>
          </div>

          {/* Body */}
          {!activeDataSet ? (
            <EmptyState />
          ) : (
            <>
              {/* Filters */}
              <div className="mb-4 rounded-lg border border-gray-200 bg-white">
                <div className="flex items-center gap-2 px-4 py-2.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setShowFilters((o) => !o)}
                    className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                    </svg>
                    Filters
                    {activeFilters.length > 0 && (
                      <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-orange-500 text-white text-[10px]">
                        {activeFilters.length}
                      </span>
                    )}
                    <svg
                      className={`w-3.5 h-3.5 text-gray-400 transition-transform ${showFilters ? "rotate-180" : ""}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {activeFilters.length === 0 ? (
                    <span className="text-xs text-gray-400">No filters applied</span>
                  ) : (
                    activeFilters.map((f) => (
                      <span
                        key={f.id}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 border border-orange-200 text-xs"
                      >
                        <span className="font-medium">{f.fieldLabel}</span>
                        {f.values.length > 0 && (
                          <span className="text-orange-500">
                            {FILTER_MODE_LABELS[f.mode]} {f.values.map((v) => (v === "" ? "(None)" : v)).join(", ")}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => setActiveTabFilters(activeFilters.filter((x) => x.id !== f.id))}
                          className="hover:text-orange-900"
                          aria-label={`Remove ${f.fieldLabel} filter`}
                        >
                          ×
                        </button>
                      </span>
                    ))
                  )}
                </div>
                {showFilters && (
                  <div className="border-t border-gray-100 px-4 py-3">
                    <div className="max-w-md">
                      <FiltersPanel
                        categories={filterCategories}
                        filters={activeFilters}
                        suggestionsFor={suggestionsForFilter}
                        onChange={setActiveTabFilters}
                        emptyHint="Select a data set to filter its columns."
                      />
                    </div>
                  </div>
                )}
              </div>

              <DataSetBuilder
                dataSet={activeDataSet}
                selectedColumns={activeTab?.selectedColumns ?? []}
                filters={activeFilters}
                onDrop={handleColumnDrop}
                onRemove={removeColumn}
                onReorder={reorderColumn}
                currentUserName={previewName}
              />
            </>
          )}
        </main>

        {/* Right sidebar */}
        <aside className="w-80 shrink-0 border-l border-gray-200 bg-white overflow-y-auto">
          <div className="px-5 py-4 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-gray-900">
                {activeDataSet ? "Available Columns" : "Create a New Report"}
              </h2>
              <InfoIcon />
            </div>
            {activeDataSet ? (
              <p className="text-xs text-gray-500 mt-1">
                Drag any column into the report area to add it. Data set:{" "}
                <span className="font-medium text-gray-700">{activeDataSet.label}</span>
              </p>
            ) : (
              <p className="text-xs text-gray-500 mt-1">
                Select a data set to begin. All tabs in the report must use data sets from the same section.
              </p>
            )}
          </div>

          {activeDataSet ? (
            <ColumnPicker
              dataSet={activeDataSet}
              selectedColumns={activeTab?.selectedColumns ?? []}
              onDragStartColumn={(c) => setDraggedColumn(c)}
              onDragEndColumn={() => setDraggedColumn(null)}
              onAddColumn={handleColumnDrop}
              onChangeDataSet={() => {
                if (!activeTab) return;
                setTabs((prev) =>
                  prev.map((t) =>
                    t.id === activeTab.id ? { ...t, dataSetId: null, selectedColumns: [], filters: [] } : t
                  )
                );
              }}
            />
          ) : (
            <CategoryList
              categories={CATEGORIES}
              expandedIds={expandedCategoryIds}
              onToggle={toggleCategory}
              onSelectDataSet={selectDataSetForActiveTab}
            />
          )}
        </aside>
      </div>

      {draggedColumn && (
        <div className="pointer-events-none fixed top-2 right-2 bg-gray-900 text-white text-xs px-2 py-1 rounded shadow z-50">
          Dragging: {draggedColumn}
        </div>
      )}
    </div>
  );
}

// ─── Sidebar subcomponents ───────────────────────────────────────────────────

function CategoryList({
  categories,
  expandedIds,
  onToggle,
  onSelectDataSet,
}: {
  categories: Category[];
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
  onSelectDataSet: (ds: DataSet) => void;
}) {
  return (
    <ul className="py-2">
      {categories.map((cat) => {
        const isExpandable = !!cat.subDataSets;
        const isExpanded = expandedIds.has(cat.id);
        return (
          <li key={cat.id}>
            <button
              onClick={() => {
                if (isExpandable) {
                  onToggle(cat.id);
                } else if (cat.dataSet) {
                  onSelectDataSet(cat.dataSet);
                }
              }}
              className="w-full flex items-center justify-between px-5 py-2 text-sm text-gray-800 hover:bg-gray-50"
            >
              <span>{cat.label}</span>
              {isExpandable && (
                <svg
                  className={`w-4 h-4 text-gray-500 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              )}
            </button>
            {isExpandable && isExpanded && cat.subDataSets && (
              <ul className="pb-1">
                {cat.subDataSets.map((ds) => (
                  <li key={ds.id}>
                    <button
                      onClick={() => onSelectDataSet(ds)}
                      className="w-full text-left pl-10 pr-5 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      {ds.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function ColumnPicker({
  dataSet,
  selectedColumns,
  onDragStartColumn,
  onDragEndColumn,
  onAddColumn,
  onChangeDataSet,
}: {
  dataSet: DataSet;
  selectedColumns: string[];
  onDragStartColumn: (c: string) => void;
  onDragEndColumn: () => void;
  onAddColumn: (c: string) => void;
  onChangeDataSet: () => void;
}) {
  const [search, setSearch] = useState("");
  const sorted = useMemo(() => [...dataSet.columns].sort((a, b) => a.localeCompare(b)), [dataSet]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((c) => c.toLowerCase().includes(q));
  }, [search, sorted]);

  return (
    <div className="px-5 py-3 space-y-3">
      <button
        onClick={onChangeDataSet}
        className="text-xs text-orange-600 hover:text-orange-700 flex items-center gap-1"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Change Data Set
      </button>
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search columns"
        className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-gray-900"
      />
      <ul className="space-y-2">
        {filtered.map((col) => {
          const used = selectedColumns.includes(col);
          return (
            <li key={col}>
              <div
                draggable={!used}
                onDragStart={(e) => {
                  if (used) {
                    e.preventDefault();
                    return;
                  }
                  e.dataTransfer.setData("text/plain", col);
                  e.dataTransfer.effectAllowed = "copy";
                  onDragStartColumn(col);
                }}
                onDragEnd={onDragEndColumn}
                className={`flex items-center gap-2 border border-gray-200 rounded px-2 py-1.5 bg-white ${
                  used ? "opacity-50" : "cursor-grab active:cursor-grabbing hover:border-gray-400"
                }`}
              >
                <DragHandle />
                <span className="text-sm text-gray-800 flex-1">{col}</span>
                {!used && (
                  <button
                    onClick={() => onAddColumn(col)}
                    className="text-xs text-orange-600 hover:text-orange-700 px-1"
                  >
                    Add
                  </button>
                )}
                {used && <span className="text-[10px] uppercase tracking-wide text-gray-400">Added</span>}
              </div>
            </li>
          );
        })}
        {filtered.length === 0 && (
          <li className="text-xs text-gray-400 text-center py-6">No columns match your search.</li>
        )}
      </ul>
    </div>
  );
}

// ─── Body subcomponents ──────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center text-center py-24">
      <div className="mb-6">
        <svg
          width="160"
          height="120"
          viewBox="0 0 160 120"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect x="20" y="14" width="100" height="80" rx="4" fill="#1f4ed8" />
          <rect x="34" y="28" width="100" height="80" rx="4" fill="#f3f4f6" stroke="#cbd5e1" />
          <rect x="46" y="44" width="60" height="6" fill="#cbd5e1" />
          <rect x="46" y="56" width="40" height="6" fill="#cbd5e1" />
          <rect x="46" y="68" width="50" height="6" fill="#cbd5e1" />
          <circle cx="60" cy="86" r="14" fill="#ea580c" />
          <rect x="58" y="78" width="4" height="16" rx="1" fill="white" />
          <rect x="52" y="84" width="16" height="4" rx="1" fill="white" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-gray-800 max-w-sm">
        Select a Data Set from the right column to begin
      </h3>
      <p className="text-sm text-gray-500 mt-3 max-w-md">
        All tabs in the report must use data sets from the same section. Product Area data sets and Tool data sets cannot be mixed.
      </p>
    </div>
  );
}

function DataSetBuilder({
  dataSet,
  selectedColumns,
  filters,
  onDrop,
  onRemove,
  onReorder,
  currentUserName,
}: {
  dataSet: DataSet;
  selectedColumns: string[];
  filters: ReportFilter[];
  onDrop: (col: string) => void;
  onRemove: (col: string) => void;
  onReorder: (from: number, to: number) => void;
  currentUserName: string;
}) {
  const [dropActive, setDropActive] = useState(false);
  const [reorderFromIndex, setReorderFromIndex] = useState<number | null>(null);
  const [insertIndicator, setInsertIndicator] = useState<number | null>(null);

  // Preview rows, narrowed by any active filters so the builder reflects them.
  const rows = useMemo(
    () =>
      Array.from({ length: PREVIEW_ROW_COUNT }, (_, i) => i).filter((rowIndex) =>
        rowPassesFilters(filters, (colKey) => String(mockValueFor(colKey, rowIndex, currentUserName))),
      ),
    [filters, currentUserName],
  );

  function dropFromEvent(e: React.DragEvent, insertAt?: number) {
    const dragged = e.dataTransfer.getData("text/plain");
    if (!dragged) return;
    if (selectedColumns.includes(dragged)) {
      if (reorderFromIndex !== null && insertAt !== undefined && reorderFromIndex !== insertAt) {
        const target = insertAt > reorderFromIndex ? insertAt - 1 : insertAt;
        onReorder(reorderFromIndex, target);
      }
      return;
    }
    onDrop(dragged);
  }

  if (selectedColumns.length === 0) {
    return (
      <div className="space-y-4">
        <div className="text-xs text-gray-500 flex items-center gap-2">
          <span>Data Set:</span>
          <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 font-medium text-xs">{dataSet.label}</span>
        </div>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "copy";
            setDropActive(true);
          }}
          onDragLeave={() => setDropActive(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDropActive(false);
            dropFromEvent(e);
          }}
          className={`rounded-lg border-2 border-dashed p-10 text-center transition-colors ${
            dropActive ? "border-orange-500 bg-orange-50" : "border-gray-300 bg-white"
          }`}
        >
          <p className="text-sm text-gray-700 font-medium">Drag columns here from the right panel</p>
          <p className="text-xs text-gray-400 mt-1">
            Dropped columns are added to the report with sample data.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="text-xs text-gray-500 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span>Data Set:</span>
          <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 font-medium text-xs">{dataSet.label}</span>
          <span className="text-gray-400">·</span>
          <span>{selectedColumns.length} columns</span>
        </div>
        <span className="text-[11px] text-gray-400">Sample data shown — actual records will populate after the report runs.</span>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
          setDropActive(true);
        }}
        onDragLeave={(e) => {
          if (e.currentTarget === e.target) setDropActive(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDropActive(false);
          setInsertIndicator(null);
          dropFromEvent(e, selectedColumns.length);
        }}
        className={`rounded-lg border bg-white overflow-x-auto transition-colors ${
          dropActive ? "border-orange-400 ring-1 ring-orange-300" : "border-gray-200"
        }`}
      >
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              {selectedColumns.map((col, i) => (
                <th
                  key={col}
                  draggable
                  onDragStart={(e) => {
                    setReorderFromIndex(i);
                    e.dataTransfer.setData("text/plain", col);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onDragEnd={() => {
                    setReorderFromIndex(null);
                    setInsertIndicator(null);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    const rect = e.currentTarget.getBoundingClientRect();
                    const before = e.clientX - rect.left < rect.width / 2;
                    setInsertIndicator(before ? i : i + 1);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const rect = e.currentTarget.getBoundingClientRect();
                    const before = e.clientX - rect.left < rect.width / 2;
                    const insertAt = before ? i : i + 1;
                    setInsertIndicator(null);
                    setDropActive(false);
                    dropFromEvent(e, insertAt);
                  }}
                  className={`group relative px-4 py-2.5 text-left font-medium text-gray-700 whitespace-nowrap select-none cursor-grab active:cursor-grabbing ${
                    insertIndicator === i ? "border-l-2 border-orange-500" : ""
                  } ${insertIndicator === i + 1 && i === selectedColumns.length - 1 ? "border-r-2 border-orange-500" : ""}`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs italic text-gray-400 font-serif">fx</span>
                    <span>{col}</span>
                    <SortArrow />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemove(col);
                      }}
                      className="ml-1 text-gray-300 opacity-0 group-hover:opacity-100 hover:text-red-600"
                      aria-label={`Remove ${col}`}
                    >
                      ×
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={selectedColumns.length} className="px-4 py-8 text-center text-sm text-gray-400">
                  No preview records match the current filters.
                </td>
              </tr>
            ) : (
              rows.map((rowIndex) => (
                <tr key={rowIndex} className="border-b border-gray-100 last:border-0">
                  {selectedColumns.map((col) => (
                    <td key={col} className="px-4 py-3 align-top text-gray-700 max-w-[420px]">
                      {mockValueFor(col, rowIndex, currentUserName)}
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
}

function SortArrow() {
  return (
    <svg className="w-3 h-3 text-gray-400" viewBox="0 0 12 12" fill="currentColor">
      <path d="M6 3 L9 7 L3 7 Z" />
    </svg>
  );
}

// ─── Mock data helpers ───────────────────────────────────────────────────────

const MOCK_PEOPLE = ["James Schuster", "", "", "Maria Chen", "Tom Albright", "Priya Singh", "Jordan Lee"];
const MOCK_COMPANIES = [
  "Michael Baker Engineering,",
  "Sitescapes LLC",
  "Smith & Jennings, Inc.",
  "Smith & Jennings, Inc.",
  "Smith & Jennings, Inc.",
  "Michael Baker Engineering,",
  "Acme Electrical Co.",
];
const MOCK_COMMENTS = [
  "",
  "Took out 4 courses of block around collar where grid needed to be re-laid. Compacted screenings around pipe and re-laid geogrid. Michael Baker ran compaction test and achieved 100% compaction.",
  "Set both risers on structure C17. Finished undercut on footing on retaining wall. Started backfill on footer with surge stone and fabric. First section of undercut was 22' x 14'.",
  "No work too wet from rain    on Thursday the fifth",
  "Excavating for retaining wall and filling in sediment basin on Huntley Street    and filling in last three-quarter section of Luray Drive",
  "Did a proof roll on Hudgens Drive from Huntley Street to    Freeman Mill    proof roll failed ,    did test on Luray Drive material was a little wet recommended drying it out before we do a compaction test, inspecting",
  "Continued formwork on west elevator pit. Rebar inspection scheduled for tomorrow morning.",
];
const MOCK_LOCATIONS = ["Bldg A - L2", "Site Entry", "Retaining Wall", "Luray Drive", "Hudgens Drive", "Pit 3", "Roof Deck"];
const MOCK_COST_CODES = ["03-30-00", "02-41-13", "26-05-19", "31-23-16", "33-41-00", "04-22-00", "07-92-00"];
const MOCK_STATUSES = ["Open", "Closed", "Approved", "Draft", "Pending", "Submitted", "Void"];
const MOCK_TRADES = ["Concrete", "Earthwork", "Steel", "Electrical", "Plumbing", "Masonry", "Roofing"];
const MOCK_DELAY_TYPES = ["Weather", "Material", "Owner", "Inspection", "Labor", "Subcontractor", "Other"];
const MOCK_SUBJECTS = [
  "Slab pour at Level 2",
  "Underground utility coordination",
  "Concrete delivery delay",
  "Anchor bolt layout",
  "RFI 102 follow-up",
  "Punch list walkthrough",
  "Pre-installation meeting",
];

const MOCK_DATES = [
  "2026-03-04",
  "2026-03-05",
  "2026-03-06",
  "2026-03-09",
  "2026-03-10",
  "2026-03-11",
  "2026-03-12",
];

const MOCK_TIMES = ["07:15", "08:30", "10:00", "12:45", "14:20", "15:50", "17:05"];
const MOCK_NUMBERS_SMALL = [4, 6, 12, 3, 8, 10, 2];
const MOCK_NUMBERS_HOURS = [8, 7.5, 9, 4, 10, 6, 8];
const MOCK_AMOUNTS = ["$1,250.00", "$8,420.00", "$320.00", "$15,000.00", "$2,750.00", "$640.00", "$4,180.00"];
const MOCK_DURATIONS = [2, 4, 1.5, 0.5, 3, 2.5, 1];

function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length];
}

function mockValueFor(column: string, rowIndex: number, currentUserName: string): React.ReactNode {
  const c = column.toLowerCase();
  if (c === "created by") {
    return currentUserName;
  }
  if (c === "inspector" || c === "received by" || c === "assignee" || c === "ball in court" || c === "assigned to" || c === "owner" || c === "operator") {
    return pick(MOCK_PEOPLE, rowIndex);
  }
  if (c === "company" || c === "company involved" || c === "vendor" || c === "hauler" || c === "inspecting entity") {
    return pick(MOCK_COMPANIES, rowIndex);
  }
  if (c === "comments" || c === "notes" || c === "description" || c === "weather summary") {
    return pick(MOCK_COMMENTS, rowIndex);
  }
  if (c === "location" || c === "inspection area" || c === "disposal site" || c === "delivery from") {
    return pick(MOCK_LOCATIONS, rowIndex);
  }
  if (c === "cost code" || c === "budget code") {
    return pick(MOCK_COST_CODES, rowIndex);
  }
  if (c === "status" || c === "is issue") {
    return pick(MOCK_STATUSES, rowIndex);
  }
  if (c === "trade" || c === "discipline") {
    return pick(MOCK_TRADES, rowIndex);
  }
  if (c === "delay type" || c === "waste type" || c === "equipment type" || c === "inspection type" || c === "type" || c === "category" || c === "change reason") {
    return pick(MOCK_DELAY_TYPES, rowIndex);
  }
  if (c === "subject" || c === "title" || c === "item" || c === "safety notice") {
    return pick(MOCK_SUBJECTS, rowIndex);
  }
  if (
    c === "date" ||
    c === "created at" ||
    c === "submitted at" ||
    c === "approved at" ||
    c === "closed at" ||
    c === "uploaded at" ||
    c === "issued date" ||
    c === "taken at" ||
    c === "received" ||
    c === "issued" ||
    c === "due date" ||
    c === "completed at" ||
    c === "pickup time" ||
    c === "compliance due" ||
    c === "start" ||
    c === "finish"
  ) {
    return pick(MOCK_DATES, rowIndex);
  }
  if (c === "time" || c === "time observed" || c === "start time" || c === "end time") {
    return pick(MOCK_TIMES, rowIndex);
  }
  if (c === "hours" || c === "hours used" || c === "overtime") {
    return pick(MOCK_NUMBERS_HOURS, rowIndex);
  }
  if (c === "duration" || c === "duration (hrs)") {
    return pick(MOCK_DURATIONS, rowIndex);
  }
  if (c === "workers" || c === "quantity" || c === "size" || c === "planned quantity" || c === "installed quantity" || c === "attendees count" || c === "attachments count" || c === "revision" || c === "uid") {
    return pick(MOCK_NUMBERS_SMALL, rowIndex);
  }
  if (
    c === "amount" ||
    c === "original amount" ||
    c === "revised amount" ||
    c === "approved cos" ||
    c === "pending cos" ||
    c === "rom amount" ||
    c === "this period" ||
    c === "to date" ||
    c === "retainage" ||
    c === "billed to date" ||
    c === "default retainage"
  ) {
    return pick(MOCK_AMOUNTS, rowIndex);
  }
  if (c === "attachments") {
    const n = pick(MOCK_NUMBERS_SMALL, rowIndex);
    return n === 0 ? "" : `${n} file${n === 1 ? "" : "s"}`;
  }
  if (c === "% complete") {
    return `${pick([10, 25, 50, 75, 90, 100, 0], rowIndex)}%`;
  }
  if (c === "uom") {
    return pick(["CY", "EA", "LF", "SF", "TN", "HR", "LB"], rowIndex);
  }
  if (c === "executed" || c === "active" || c === "present") {
    return pick(["Yes", "No", "Yes", "Yes", "No", "Yes", "No"], rowIndex);
  }
  if (c === "scope") {
    return pick(["In Scope", "Out of Scope", "TBD Scope", "In Scope", "In Scope", "Out of Scope", "TBD Scope"], rowIndex);
  }
  if (c === "set") {
    return pick(["Current", "Bid", "IFC", "Permit", "Current", "Current", "IFC"], rowIndex);
  }
  if (c === "section" || c === "number" || c === "rfi #" || c === "submittal #" || c === "task #" || c === "item #" || c === "invoice #") {
    return `${String(100 + rowIndex).padStart(3, "0")}`;
  }
  if (c === "predecessors" || c === "resources" || c === "assignees" || c === "attendee" || c === "set" || c === "discipline") {
    return pick(["FS 12,15", "SS 8", "FF 22", "", "FS 4", "FS 30, FF 33", ""], rowIndex);
  }
  if (c === "tracking number") {
    return pick(["1Z 999 1A1 23 4567 8901", "FX 7720 4488 1023", "", "UPS 1Z 8765 4321", "DHL 9924 1188 7733", "", "USPS 9505 0011 2233"], rowIndex);
  }
  if (c === "contents") {
    return pick(["#5 rebar bundles", "Anchor bolts (200 ct)", "Concrete forms", "PVC fittings", "Glazing crates", "Lighting fixtures", "Roof membrane rolls"], rowIndex);
  }
  if (c === "severity") {
    return pick(["Low", "Medium", "High", "Low", "Low", "Medium", "High"], rowIndex);
  }
  if (c === "priority") {
    return pick(["Low", "Medium", "High", "Urgent", "Medium", "Low", "High"], rowIndex);
  }
  if (c === "sky") {
    return pick(["Sunny", "Partly Cloudy", "Overcast", "Rain", "Clear", "Cloudy", "Snow"], rowIndex);
  }
  if (c === "temperature" || c === "temp") {
    return pick(["72°F", "65°F", "58°F", "81°F", "49°F", "77°F", "55°F"], rowIndex);
  }
  if (c === "wind") {
    return pick(["5 mph NE", "Calm", "12 mph W", "8 mph S", "15 mph NW", "Calm", "6 mph E"], rowIndex);
  }
  if (c === "precipitation" || c === "avg precipitation") {
    return pick(["0.0 in", "0.3 in", "1.2 in", "0.0 in", "0.0 in", "0.1 in", "2.4 in"], rowIndex);
  }
  if (c === "ground/sea" || c === "ground sea") {
    return pick(["Dry", "Damp", "Wet", "Flooded", "Dry", "Damp", "Snow"], rowIndex);
  }
  if (c === "calamity") {
    return pick(["No", "No", "Yes", "No", "No", "Yes", "No"], rowIndex);
  }
  if (c === "from" || c === "to" || c === "caller" || c === "receiver") {
    return pick(MOCK_PEOPLE, rowIndex);
  }
  if (c === "contract" || c === "contract name") {
    return pick(["SC-001 Site Concrete", "SC-014 Glazing", "PO-220 Lighting", "SC-007 Earthwork", "SC-019 Roofing", "PO-115 Steel", "SC-031 Plumbing"], rowIndex);
  }
  if (c === "album") {
    return pick(["Site Progress", "Foundations", "Steel Erection", "Interior Finishes", "Roof", "Sitework", "MEP"], rowIndex);
  }
  if (c === "accounting method") {
    return pick(["Amount Based", "Amount Based", "Unit/Quantity Based", "Amount Based", "Amount Based", "Amount Based", "Unit/Quantity Based"], rowIndex);
  }
  if (c === "erp status") {
    return pick(["Not Synced", "Synced", "Pending", "Synced", "Not Synced", "Synced", "Synced"], rowIndex);
  }
  if (c === "period") {
    return pick(["Mar 2026", "Feb 2026", "Jan 2026", "Mar 2026", "Apr 2026", "Feb 2026", "Mar 2026"], rowIndex);
  }
  return "";
}

// ─── Icons ───────────────────────────────────────────────────────────────────

function PencilIcon() {
  return (
    <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M4 20h4l10-10-4-4L4 16v4z" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
      <path
        fillRule="evenodd"
        d="M18 10A8 8 0 11 2 10a8 8 0 0116 0zm-8-3a1 1 0 100-2 1 1 0 000 2zm-1 4a1 1 0 011-1h.01a1 1 0 011 1v3a1 1 0 11-2 0v-3z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function DragHandle() {
  return (
    <svg className="w-3 h-4 text-gray-400" fill="currentColor" viewBox="0 0 8 12">
      <circle cx="2" cy="2" r="1" />
      <circle cx="6" cy="2" r="1" />
      <circle cx="2" cy="6" r="1" />
      <circle cx="6" cy="6" r="1" />
      <circle cx="2" cy="10" r="1" />
      <circle cx="6" cy="10" r="1" />
    </svg>
  );
}
