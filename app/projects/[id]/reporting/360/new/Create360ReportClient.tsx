"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ProjectNav from "@/components/ProjectNav";

// ─── Column catalog ──────────────────────────────────────────────────────────
// Categories shown in the Configure Columns popout. The "source" maps to the
// primary entity fetched from a project API — selecting any column under that
// category populates one row per record of that entity.

type FieldDef = { key: string; label: string; format?: "currency" | "date" | "text" };

type CategoryDef = {
  label: string;
  source: string; // entity slug (commitments, change-events, ...)
  fields: FieldDef[];
};

const FINANCIALS_CATEGORIES: CategoryDef[] = [
  {
    label: "Budget Code",
    source: "budget-codes",
    fields: [
      { key: "code", label: "Code" },
      { key: "description", label: "Description" },
      { key: "cost_type", label: "Cost Type" },
      { key: "active", label: "Active" },
    ],
  },
  {
    label: "Budget Line Item",
    source: "budget-line-items",
    fields: [
      { key: "cost_code", label: "Cost Code" },
      { key: "description", label: "Description" },
      { key: "original_budget", label: "Original Budget", format: "currency" },
      { key: "revised_budget", label: "Revised Budget", format: "currency" },
      { key: "committed_costs", label: "Committed Costs", format: "currency" },
      { key: "variance", label: "Variance", format: "currency" },
    ],
  },
  {
    label: "Budget Modification",
    source: "budget-modifications",
    fields: [
      { key: "number", label: "#" },
      { key: "title", label: "Title" },
      { key: "status", label: "Status" },
      { key: "amount", label: "Amount", format: "currency" },
      { key: "created_at", label: "Created", format: "date" },
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
    label: "Company (Vendor)",
    source: "companies",
    fields: [
      { key: "name", label: "Name" },
      { key: "trade", label: "Trade" },
      { key: "city", label: "City" },
      { key: "state", label: "State" },
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

const CATEGORIES_BY_TAB: Record<string, CategoryDef[]> = {
  Financials: FINANCIALS_CATEGORIES,
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
}: {
  projectId: string;
  category: string;
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
      const rows = rowsBySource[source] ?? [];
      return { source, cols, rows };
    });
  }, [activeSources, selectedColumns, rowsBySource]);

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
              onClick={() => router.push(`/projects/${projectId}/reporting`)}
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
            <div className="px-4 py-2 border-b border-gray-100 bg-gray-50 flex items-center gap-2 text-sm text-gray-600">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              <span>Filters</span>
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
                  {groupedDisplay.map(({ source, cols, rows }) => {
                    const sourceLabel = categories.find((c) => c.source === source)?.label ?? source;
                    const isLoading = loadingSources.has(source);
                    const loaded = rowsBySource[source] !== undefined;
                    return (
                      <div key={source} className="border border-gray-200 rounded-md overflow-hidden">
                        <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-700 flex items-center justify-between">
                          <span>{sourceLabel}</span>
                          <span className="text-gray-400 font-normal">
                            {isLoading ? "Loading…" : loaded ? `${rows.length} record${rows.length === 1 ? "" : "s"}` : "Not loaded"}
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
          {openPanel === "filters" && <SimplePanel title="Filters" body="Filters appear here once configured." />}
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
                  {cat.label}
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
      sov_accounting_method: c.sov_accounting_method,
      original_contract_amount: c.original_contract_amount,
      approved_change_orders: c.approved_change_orders,
      pending_change_orders: c.pending_change_orders,
      erp_status: c.erp_status,
    }));
  }

  if (source === "change-events") {
    const res = await fetch(`/api/projects/${projectId}/reports?type=change-events`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  }

  if (source === "commitment-change-orders") {
    const res = await fetch(`/api/projects/${projectId}/reports?type=commitment-change-orders`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  }

  if (source === "budget-line-items") {
    const res = await fetch(`/api/projects/${projectId}/reports?type=budget-summary`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  }

  // Unknown / not-yet-backed source — render an empty table.
  return [];
}
