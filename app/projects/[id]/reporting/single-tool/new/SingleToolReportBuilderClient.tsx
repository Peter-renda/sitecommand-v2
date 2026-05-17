"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ProjectNav from "@/components/ProjectNav";
import { saveReport } from "../../saved-reports-store";

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
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function SingleToolReportBuilderClient({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [reportName, setReportName] = useState("");
  const [reportDescription, setReportDescription] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);

  const [tabs, setTabs] = useState<ReportTab[]>([
    { id: crypto.randomUUID(), name: "Tab 1", dataSetId: null, selectedColumns: [] },
  ]);
  const [activeTabId, setActiveTabId] = useState<string>(() => tabs[0]?.id ?? "");
  const [expandedCategoryIds, setExpandedCategoryIds] = useState<Set<string>>(new Set());
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);

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
          ? { ...t, dataSetId: ds.id, name: ds.label, selectedColumns: [] }
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

  const canCreate = reportName.trim().length > 0 && tabs.some((t) => t.dataSetId && t.selectedColumns.length > 0);

  function handleCreate() {
    if (!canCreate) return;
    const firstWithData = tabs.find((t) => t.dataSetId);
    const ds = firstWithData ? allDataSets.find((d) => d.id === firstWithData.dataSetId) ?? null : null;
    const now = new Date().toISOString();
    saveReport(projectId, {
      id: crypto.randomUUID(),
      name: reportName.trim(),
      reportType: "Single Tool Report",
      description: reportDescription.trim() || (ds ? `Single tool report on ${ds.label}.` : "Single tool report."),
      createdBy: "Me",
      createdAt: now,
      updatedAt: now,
      sharedWith: [],
      lastRunRecordCount: 0,
    });
    router.push(`/projects/${projectId}/reporting`);
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
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
                  <h1 className="text-2xl font-semibold text-gray-900">
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
            <DataSetBuilder
              dataSet={activeDataSet}
              selectedColumns={activeTab?.selectedColumns ?? []}
              onDrop={handleColumnDrop}
              onRemove={removeColumn}
              onReorder={reorderColumn}
            />
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
                    t.id === activeTab.id ? { ...t, dataSetId: null, selectedColumns: [] } : t
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
  onDrop,
  onRemove,
  onReorder,
}: {
  dataSet: DataSet;
  selectedColumns: string[];
  onDrop: (col: string) => void;
  onRemove: (col: string) => void;
  onReorder: (from: number, to: number) => void;
}) {
  const [dropActive, setDropActive] = useState(false);
  const [reorderFromIndex, setReorderFromIndex] = useState<number | null>(null);

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
          const col = e.dataTransfer.getData("text/plain");
          if (col) onDrop(col);
        }}
        className={`rounded-lg border-2 border-dashed p-6 transition-colors ${
          dropActive ? "border-orange-500 bg-orange-50" : "border-gray-300 bg-white"
        }`}
      >
        {selectedColumns.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-sm text-gray-600 font-medium">Drag columns here from the right panel</p>
            <p className="text-xs text-gray-400 mt-1">
              Selected columns will become the columns of this tab&apos;s report.
            </p>
          </div>
        ) : (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">
              Selected Columns ({selectedColumns.length})
            </p>
            <ul className="space-y-2">
              {selectedColumns.map((col, i) => (
                <li
                  key={col}
                  draggable
                  onDragStart={() => setReorderFromIndex(i)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                  }}
                  onDrop={(e) => {
                    const dragged = e.dataTransfer.getData("text/plain");
                    if (dragged && !selectedColumns.includes(dragged)) {
                      onDrop(dragged);
                      setReorderFromIndex(null);
                      return;
                    }
                    if (reorderFromIndex !== null && reorderFromIndex !== i) {
                      onReorder(reorderFromIndex, i);
                    }
                    setReorderFromIndex(null);
                  }}
                  className="flex items-center gap-2 border border-gray-200 rounded px-3 py-2 bg-white"
                >
                  <DragHandle />
                  <span className="text-sm text-gray-800 flex-1">{col}</span>
                  <button
                    onClick={() => onRemove(col)}
                    className="text-xs text-gray-400 hover:text-red-600"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {selectedColumns.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          <div className="px-4 py-2 border-b border-gray-100 text-xs text-gray-500">
            Preview · {dataSet.label}
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {selectedColumns.map((c) => (
                  <th key={c} className="px-3 py-2 text-left text-xs font-semibold text-gray-500">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={selectedColumns.length} className="px-3 py-6 text-center text-xs text-gray-400">
                  No data yet. Save and run the report to see records.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
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
