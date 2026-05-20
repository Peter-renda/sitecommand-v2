"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import ProjectNav from "@/components/ProjectNav";
import AppHeader from "@/app/components/AppHeader";
import { ChevronDown, FileText, Lock, XCircle, Search, SlidersHorizontal, X, Settings2 } from "lucide-react";

type ChangeOrder = {
  id: string;
  contract_name: string;
  number: string;
  revision: number;
  title: string;
  date_initiated: string | null;
  contract_company: string | null;
  designated_reviewer: string | null;
  due_date: string | null;
  review_date: string | null;
  status: string;
  amount: number;
  has_attachments: boolean;
  is_locked: boolean;
  executed: boolean;
  prime_contract_change_order: string | null;
  approved_at?: string | null;
  type?: "prime" | "commitment";
};

type DirectoryContact = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

function fmt(val: number) {
  return val.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
}

function fmtDate(d: string | null) {
  if (!d) return "";
  const dt = new Date(d);
  return `${(dt.getMonth() + 1).toString().padStart(2, "0")}/${dt.getDate().toString().padStart(2, "0")}/${dt.getFullYear().toString().slice(2)}`;
}

type Tab = "prime" | "commitment";

const STATUS_OPTIONS = ["Draft", "Pending - In Review", "Pending - Revised", "Pending - Pricing", "Pending - Not Pricing", "Pending - Proceeding", "Pending - Not Proceeding", "Approved", "Rejected", "Void"];
const EXECUTED_OPTIONS = ["Yes", "No"];

export default function ChangeOrdersClient({
  projectId,
  username,
}: {
  projectId: string;
  role: string;
  username: string;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("prime");
  const [orders, setOrders] = useState<ChangeOrder[]>([]);
  const [directoryContacts, setDirectoryContacts] = useState<DirectoryContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterOpen, setFilterOpen] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [exportPccoOpen, setExportPccoOpen] = useState(false);
  const [sortKey, setSortKey] = useState<"number" | "amount" | "date_initiated" | "approved_at">("number");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const exportRef = useRef<HTMLDivElement>(null);

  // Filter state
  const [filterStatus, setFilterStatus] = useState<string[]>([]);
  const [filterExecuted, setFilterExecuted] = useState<string[]>([]);
  const [filterSigner, setFilterSigner] = useState<string[]>([]);
  const [statusDropOpen, setStatusDropOpen] = useState(false);
  const [executedDropOpen, setExecutedDropOpen] = useState(false);
  const [signerDropOpen, setSignerDropOpen] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/projects/${projectId}/change-orders?type=${activeTab}`)
      .then((r) => r.json())
      .then((data) => {
        setOrders(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [projectId, activeTab]);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/directory`)
      .then((r) => r.json())
      .then((data) => setDirectoryContacts(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [projectId]);

  // Close export dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportPccoOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function getContactNameByEmail(email: string | null) {
    const normalized = String(email || "").trim().toLowerCase();
    if (!normalized) return "";
    const contact = directoryContacts.find((c) => String(c.email || "").trim().toLowerCase() === normalized);
    if (!contact) return email || "";
    const fullName = [contact.first_name, contact.last_name].filter(Boolean).join(" ").trim();
    return fullName || contact.email || "";
  }

  const signerNames = Array.from(
    new Set(orders.map((o) => o.designated_reviewer).filter(Boolean) as string[])
  ).map((email) => getContactNameByEmail(email));

  const filtered = orders.filter((o) => {
    const q = searchQuery.toLowerCase();
    if (q && !o.number?.toLowerCase().includes(q) && !o.title?.toLowerCase().includes(q) && !o.contract_name?.toLowerCase().includes(q)) return false;
    if (filterStatus.length > 0 && !filterStatus.includes(o.status)) return false;
    if (filterExecuted.length > 0) {
      const execVal = o.executed ? "Yes" : "No";
      if (!filterExecuted.includes(execVal)) return false;
    }
    if (filterSigner.length > 0) {
      const name = getContactNameByEmail(o.designated_reviewer);
      if (!filterSigner.includes(name)) return false;
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortKey === "amount") {
      return sortDir === "asc" ? (a.amount ?? 0) - (b.amount ?? 0) : (b.amount ?? 0) - (a.amount ?? 0);
    }
    if (sortKey === "date_initiated" || sortKey === "approved_at") {
      const aTime = a[sortKey] ? new Date(String(a[sortKey])).getTime() : 0;
      const bTime = b[sortKey] ? new Date(String(b[sortKey])).getTime() : 0;
      return sortDir === "asc" ? aTime - bTime : bTime - aTime;
    }
    const aNum = parseInt(a.number, 10) || 0;
    const bNum = parseInt(b.number, 10) || 0;
    return sortDir === "asc" ? aNum - bNum : bNum - aNum;
  });

  const approvedOrderMap = new Map<string, number>();
  sorted
    .filter((o) => String(o.status || "").trim().toLowerCase() === "approved" && !!o.approved_at)
    .sort((a, b) => new Date(String(a.approved_at)).getTime() - new Date(String(b.approved_at)).getTime())
    .forEach((o, idx) => approvedOrderMap.set(o.id, idx + 1));

  const total = sorted.reduce((s, o) => s + (o.amount ?? 0), 0);
  const pendingReviewStatuses = new Set([
    "Pending - In Review",
    "Pending - Revised",
    "Pending - Pricing",
    "Pending - Not Pricing",
    "Pending - Proceeding",
    "Pending - Not Proceeding",
  ]);

  async function updateStatus(orderId: string, status: string) {
    setUpdatingId(orderId);
    try {
      const res = await fetch(`/api/projects/${projectId}/change-orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          review_date: new Date().toISOString().slice(0, 10),
        }),
      });
      if (res.ok) {
        setOrders((curr) => curr.map((o) => (o.id === orderId ? { ...o, status, review_date: new Date().toISOString().slice(0, 10) } : o)));
      }
    } finally {
      setUpdatingId(null);
    }
  }

  async function deleteOrder(order: ChangeOrder) {
    if (String(order.status || "").trim().toLowerCase() === "approved") {
      window.alert("Approved change orders cannot be deleted.");
      return;
    }
    const confirmed = window.confirm("Are you sure you want to delete this change order?");
    if (!confirmed) return;
    const res = await fetch(`/api/projects/${projectId}/change-orders/${order.id}`, { method: "DELETE" });
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      window.alert(payload.error || "Failed to delete change order.");
      return;
    }
    setOrders((curr) => curr.filter((o) => o.id !== order.id));
  }

  function clearAllFilters() {
    setFilterStatus([]);
    setFilterExecuted([]);
    setFilterSigner([]);
  }

  function toggleArrayItem(arr: string[], item: string): string[] {
    return arr.includes(item) ? arr.filter((v) => v !== item) : [...arr, item];
  }

  const activeFilterCount = filterStatus.length + filterExecuted.length + filterSigner.length;

  function toggleSort(key: "number" | "amount" | "date_initiated" | "approved_at") {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir(key === "number" ? "desc" : "asc");
  }

  function exportListAsCsv() {
    const headers = [
      "Number",
      "Revision",
      "Title",
      "Status",
      "Executed",
      "Amount",
      "Date Initiated",
      "Due Date",
      "Review Date",
      "Approved On",
      "Approval Order",
      "Designated Reviewer",
      "PCO",
    ];
    const rows = sorted.map((o) => [
      o.number,
      String(o.revision ?? 0),
      o.title ?? "",
      o.status ?? "",
      o.executed ? "Yes" : "No",
      String(o.amount ?? 0),
      o.date_initiated ?? "",
      o.due_date ?? "",
      o.review_date ?? "",
      o.approved_at ?? "",
      approvedOrderMap.get(o.id) ? String(approvedOrderMap.get(o.id)) : "",
      getContactNameByEmail(o.designated_reviewer),
      o.prime_contract_change_order && o.prime_contract_change_order !== "none" ? o.prime_contract_change_order : "",
    ]);
    const csvBody = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csvBody], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${activeTab}-change-orders.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setExportPccoOpen(false);
  }

  function exportListAsPdf() {
    const title = activeTab === "prime" ? "Prime Contract Change Orders" : "Commitment Change Orders";
    const rowsHtml = sorted
      .map(
        (o) => `<tr>
        <td>${o.number}</td>
        <td>${o.revision}</td>
        <td>${o.title || ""}</td>
        <td>${o.status}</td>
        <td>${o.executed ? "Yes" : "No"}</td>
        <td style="text-align:right">${fmt(o.amount ?? 0)}</td>
        <td>${fmtDate(o.approved_at ?? null)}</td>
        <td>${approvedOrderMap.get(o.id) ?? ""}</td>
      </tr>`
      )
      .join("");
    const win = window.open("", "_blank", "width=1200,height=800");
    if (!win) return;
    win.document.write(`
      <html><head><title>${title}</title><style>
        body{font-family:Arial,sans-serif;padding:24px}
        table{width:100%;border-collapse:collapse;font-size:12px}
        th,td{border:1px solid #ddd;padding:6px;vertical-align:top}
        th{background:#f7f7f7;text-align:left}
      </style></head><body>
      <h2>${title}</h2>
      <p>Total records: ${sorted.length} • Total amount: ${fmt(total)}</p>
      <table>
        <thead><tr><th>#</th><th>Rev</th><th>Title</th><th>Status</th><th>Executed</th><th>Amount</th><th>Approved On</th><th>Approval Order</th></tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
      </body></html>
    `);
    win.document.close();
    win.focus();
    win.print();
    setExportPccoOpen(false);
  }

  return (
    <div className="min-h-screen bg-[#FAFAF7] flex flex-col">
      <AppHeader username={username} />
      <ProjectNav projectId={projectId} />

      {/* Page header */}
      <div className="flex items-end justify-between px-6 pt-8 pb-4 bg-[#FAFAF7] gap-4 flex-wrap">
        <div className="min-w-0">
          <h1 className="font-display text-[32px] leading-[1.05] tracking-[-0.012em] text-[color:var(--ink)]">Change Orders</h1>
          {orders.length > 0 && (
            <p className="sec-sub mt-1.5">
              <span className="serif-italic text-[color:var(--brand-700)]">Across this project</span>
              <span className="sep">·</span>
              <span className="num" style={{ color: "var(--brand-500)" }}>{orders.filter((o) => o.status?.toLowerCase().startsWith("pending")).length}</span> pending
              <span className="sep">·</span>
              <span className="num">{orders.filter((o) => o.status?.toLowerCase() === "approved").length}</span> approved
              <span className="sep">·</span>
              <span className="num">{orders.length}</span> total
            </p>
          )}
        </div>
        <button
          onClick={exportListAsCsv}
          className="px-3 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-md bg-white hover:bg-gray-50 transition-colors"
        >
          Export CO Log
        </button>
      </div>

      {/* Tabs + section header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-white shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setActiveTab("prime")}
            className={`text-sm font-medium pb-1 border-b-2 transition-colors ${
              activeTab === "prime" ? "border-gray-900 text-gray-900" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Prime Contract Change Orders
          </button>
          <button
            onClick={() => setActiveTab("commitment")}
            className={`text-sm font-medium pb-1 border-b-2 transition-colors ${
              activeTab === "commitment" ? "border-gray-900 text-gray-900" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Commitment Change Orders
          </button>
        </div>
        <div ref={exportRef} className="relative">
          <button
            onClick={() => setExportPccoOpen((v) => !v)}
            className="flex items-center gap-1 px-3 py-1.5 text-xs border border-gray-300 rounded text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Export PCCOs <ChevronDown className="w-3 h-3" />
          </button>
          {exportPccoOpen && (
            <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded shadow-lg z-10 w-40 py-1">
              <button className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50" onClick={exportListAsPdf}>Export as PDF</button>
              <button className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50" onClick={exportListAsCsv}>Export as CSV</button>
            </div>
          )}
        </div>
      </div>

      {/* Search + filter bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 bg-white shrink-0">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-7 pr-3 py-1.5 text-xs border border-gray-300 rounded w-44 focus:outline-none focus:ring-1 focus:ring-gray-400"
            />
          </div>
          <button
            onClick={() => setFilterOpen((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs border rounded transition-colors ${
              filterOpen || activeFilterCount > 0
                ? "border-blue-400 text-blue-600 bg-blue-50"
                : "border-gray-300 text-gray-700 hover:bg-gray-50"
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Filters
            {activeFilterCount > 0 && (
              <span className="ml-0.5 bg-blue-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <select className="text-xs border border-gray-300 rounded px-2 py-1.5 text-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-400 bg-white">
            <option value="">Select a column to group</option>
            <option value="status">Status</option>
            <option value="executed">Executed</option>
            <option value="designated_reviewer">Designated Reviewer</option>
          </select>
          <button className="flex items-center gap-1 px-3 py-1.5 text-xs border border-gray-300 rounded text-gray-700 hover:bg-gray-50 transition-colors">
            <Settings2 className="w-3.5 h-3.5" />
            Configure
          </button>
        </div>
      </div>

      {/* Main content area with optional filter panel */}
      <div className="flex flex-1 overflow-hidden">
        {/* Filter panel */}
        {filterOpen && (
          <div className="w-72 border-r border-gray-200 bg-white shrink-0 flex flex-col overflow-y-auto">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <span className="text-sm font-semibold text-gray-900">Filters</span>
              <div className="flex items-center gap-3">
                <button
                  onClick={clearAllFilters}
                  className="text-xs text-blue-600 hover:text-blue-800 transition-colors"
                >
                  Clear All Filters
                </button>
                <button onClick={() => setFilterOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="px-4 py-4 flex flex-col gap-5">
              {/* Status filter */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Status</label>
                <div className="relative">
                  <button
                    onClick={() => { setStatusDropOpen((v) => !v); setExecutedDropOpen(false); setSignerDropOpen(false); }}
                    className="w-full flex items-center justify-between px-3 py-2 text-xs border border-gray-300 rounded text-gray-500 hover:bg-gray-50 bg-white"
                  >
                    {filterStatus.length > 0 ? `${filterStatus.length} selected` : "Select Values"}
                    <ChevronDown className="w-3 h-3" />
                  </button>
                  {statusDropOpen && (
                    <div className="absolute left-0 top-full mt-1 w-full bg-white border border-gray-200 rounded shadow-lg z-20 py-1 max-h-48 overflow-y-auto">
                      {STATUS_OPTIONS.map((s) => (
                        <label key={s} className="flex items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={filterStatus.includes(s)}
                            onChange={() => setFilterStatus((prev) => toggleArrayItem(prev, s))}
                            className="w-3 h-3"
                          />
                          {s}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                {filterStatus.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {filterStatus.map((s) => (
                      <span key={s} className="flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                        {s}
                        <button onClick={() => setFilterStatus((prev) => prev.filter((v) => v !== s))}><X className="w-2.5 h-2.5" /></button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Executed filter */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Executed</label>
                <div className="relative">
                  <button
                    onClick={() => { setExecutedDropOpen((v) => !v); setStatusDropOpen(false); setSignerDropOpen(false); }}
                    className="w-full flex items-center justify-between px-3 py-2 text-xs border border-gray-300 rounded text-gray-500 hover:bg-gray-50 bg-white"
                  >
                    {filterExecuted.length > 0 ? `${filterExecuted.length} selected` : "Select Values"}
                    <ChevronDown className="w-3 h-3" />
                  </button>
                  {executedDropOpen && (
                    <div className="absolute left-0 top-full mt-1 w-full bg-white border border-gray-200 rounded shadow-lg z-20 py-1">
                      {EXECUTED_OPTIONS.map((s) => (
                        <label key={s} className="flex items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={filterExecuted.includes(s)}
                            onChange={() => setFilterExecuted((prev) => toggleArrayItem(prev, s))}
                            className="w-3 h-3"
                          />
                          {s}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                {filterExecuted.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {filterExecuted.map((s) => (
                      <span key={s} className="flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                        {s}
                        <button onClick={() => setFilterExecuted((prev) => prev.filter((v) => v !== s))}><X className="w-2.5 h-2.5" /></button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Project Executive or Project Manager Signer filter */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Project Executive or Project Manager Signer</label>
                <div className="relative">
                  <button
                    onClick={() => { setSignerDropOpen((v) => !v); setStatusDropOpen(false); setExecutedDropOpen(false); }}
                    className="w-full flex items-center justify-between px-3 py-2 text-xs border border-gray-300 rounded text-gray-500 hover:bg-gray-50 bg-white"
                  >
                    {filterSigner.length > 0 ? `${filterSigner.length} selected` : "Select Values"}
                    <ChevronDown className="w-3 h-3" />
                  </button>
                  {signerDropOpen && (
                    <div className="absolute left-0 top-full mt-1 w-full bg-white border border-gray-200 rounded shadow-lg z-20 py-1 max-h-48 overflow-y-auto">
                      {signerNames.length === 0 ? (
                        <div className="px-3 py-2 text-xs text-gray-400">No reviewers assigned</div>
                      ) : (
                        signerNames.map((name) => (
                          <label key={name} className="flex items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={filterSigner.includes(name)}
                              onChange={() => setFilterSigner((prev) => toggleArrayItem(prev, name))}
                              className="w-3 h-3"
                            />
                            {name}
                          </label>
                        ))
                      )}
                    </div>
                  )}
                </div>
                {filterSigner.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {filterSigner.map((s) => (
                      <span key={s} className="flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                        {s}
                        <button onClick={() => setFilterSigner((prev) => prev.filter((v) => v !== s))}><X className="w-2.5 h-2.5" /></button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="flex-1 overflow-x-auto">
          {loading ? (
            <div className="text-center py-20 text-gray-400 text-sm">Loading change orders...</div>
          ) : (
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-t border-gray-200 bg-white">
                  <th className="px-3 py-2.5 text-left font-medium text-gray-600 whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <button onClick={() => toggleSort("number")} className="inline-flex items-center gap-1 hover:text-gray-900">
                        Number
                        <svg className={`w-3 h-3 text-gray-400 transition-transform ${sortKey === "number" && sortDir === "asc" ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>
                  </th>
                  <th className="px-3 py-2.5 text-left font-medium text-gray-600">Revision</th>
                  <th className="px-3 py-2.5 text-left font-medium text-gray-600">Title</th>
                  <th className="px-3 py-2.5 text-left font-medium text-gray-600">Status</th>
                  <th className="px-3 py-2.5 text-left font-medium text-gray-600">Executed</th>
                  <th className="px-3 py-2.5 w-8" />
                  <th className="px-3 py-2.5 text-right font-medium text-gray-600">
                    <button onClick={() => toggleSort("amount")} className="inline-flex items-center gap-1 hover:text-gray-900">
                      Amount
                    </button>
                  </th>
                  <th className="px-3 py-2.5 text-left font-medium text-gray-600 whitespace-nowrap">Date Initiated</th>
                  <th className="px-3 py-2.5 text-left font-medium text-gray-600 whitespace-nowrap">
                    <button onClick={() => toggleSort("approved_at")} className="inline-flex items-center gap-1 hover:text-gray-900">
                      Approved On
                    </button>
                  </th>
                  <th className="px-3 py-2.5 text-left font-medium text-gray-600 whitespace-nowrap">Approval Order</th>
                  <th className="px-3 py-2.5 text-left font-medium text-gray-600 whitespace-nowrap">Due Date</th>
                  <th className="px-3 py-2.5 text-left font-medium text-gray-600 whitespace-nowrap">Review Date</th>
                  <th className="px-3 py-2.5 text-left font-medium text-gray-600 whitespace-nowrap">Designated Reviewer</th>
                  <th className="px-3 py-2.5 text-left font-medium text-gray-600">PCO</th>
                  <th className="px-3 py-2.5 w-16" />
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={15} className="text-center py-20 text-gray-400">
                      No change orders found.
                    </td>
                  </tr>
                ) : (
                  sorted.map((order) => (
                    <tr key={order.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="px-3 py-2">
                        <button
                          onClick={() => router.push(`/projects/${projectId}/change-orders/${order.id}`)}
                          className="text-blue-600 hover:underline font-medium"
                        >
                          {order.number}
                        </button>
                      </td>
                      <td className="px-3 py-2 text-gray-700">{order.revision}</td>
                      <td className="px-3 py-2 text-blue-600 hover:underline cursor-pointer max-w-xs">
                        <button
                          onClick={() => router.push(`/projects/${projectId}/change-orders/${order.id}`)}
                          className="text-left"
                        >
                          {order.title}
                        </button>
                      </td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          order.status === "Approved"
                            ? "bg-green-100 text-green-700"
                            : order.status === "Rejected" || order.status === "Void"
                            ? "bg-red-100 text-red-700"
                            : order.status === "Draft"
                            ? "bg-gray-100 text-gray-600"
                            : "bg-yellow-100 text-yellow-700"
                        }`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-gray-700">{order.executed ? "Yes" : "No"}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1">
                          {order.has_attachments && <FileText className="w-3.5 h-3.5 text-gray-400" />}
                          {order.is_locked && <Lock className="w-3.5 h-3.5 text-gray-400" />}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right text-gray-700 whitespace-nowrap">{fmt(order.amount)}</td>
                      <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{fmtDate(order.date_initiated)}</td>
                      <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{fmtDate(order.approved_at ?? null) || <span className="text-gray-400">—</span>}</td>
                      <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{approvedOrderMap.get(order.id) ?? <span className="text-gray-400">—</span>}</td>
                      <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{fmtDate(order.due_date)}</td>
                      <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{fmtDate(order.review_date)}</td>
                      <td className="px-3 py-2 text-gray-700">
                        {order.designated_reviewer
                          ? getContactNameByEmail(order.designated_reviewer)
                          : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-3 py-2 text-gray-700">
                        {order.prime_contract_change_order && order.prime_contract_change_order !== "none"
                          ? order.prime_contract_change_order
                          : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1">
                          {pendingReviewStatuses.has(order.status) &&
                            !!order.designated_reviewer &&
                            order.designated_reviewer.trim().toLowerCase() === username.trim().toLowerCase() && (
                              <>
                                <button
                                  disabled={updatingId === order.id}
                                  onClick={() => updateStatus(order.id, "Approved")}
                                  className="px-2 py-0.5 border border-green-200 text-green-700 rounded hover:bg-green-50 disabled:opacity-50 text-xs"
                                >
                                  Approve
                                </button>
                                <button
                                  disabled={updatingId === order.id}
                                  onClick={() => updateStatus(order.id, "Rejected")}
                                  className="px-2 py-0.5 border border-red-200 text-red-700 rounded hover:bg-red-50 disabled:opacity-50 text-xs"
                                >
                                  Reject
                                </button>
                              </>
                            )}
                          <button
                            onClick={() => deleteOrder(order)}
                            disabled={String(order.status || "").trim().toLowerCase() === "approved"}
                            className="text-gray-300 hover:text-red-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            title={String(order.status || "").trim().toLowerCase() === "approved" ? "Approved change orders cannot be deleted" : "Delete"}
                          >
                            <XCircle className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {filtered.length > 0 && (
                <tfoot>
                  <tr className="border-t border-gray-200 bg-white">
                    <td colSpan={6} className="px-3 py-2 text-right text-xs font-semibold text-gray-700">
                      Total:
                    </td>
                    <td className="px-3 py-2 text-right text-xs font-semibold text-gray-900 whitespace-nowrap">
                      {fmt(total)}
                    </td>
                    <td colSpan={8} />
                  </tr>
                </tfoot>
              )}
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
