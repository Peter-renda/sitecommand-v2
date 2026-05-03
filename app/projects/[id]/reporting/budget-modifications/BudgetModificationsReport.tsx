"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import ProjectNav from "@/components/ProjectNav";
import AppHeader from "@/app/components/AppHeader";

// ── Types ─────────────────────────────────────────────────────────────────────

type ModificationRecord = {
  id: string;
  from_cost_code: string;
  to_cost_code: string;
  amount: number;
  notes: string;
  created_by: string;
  created_at: string;
};

type BudgetLineItem = {
  id: string;
  cost_code: string;
  cost_type: string;
  description: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  const abs = Math.abs(n);
  const formatted = abs.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return n < 0 ? `($${formatted})` : `$${formatted}`;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
}

// ── Main component ────────────────────────────────────────────────────────────

export default function BudgetModificationsReport({ projectId, username }: { projectId: string; username?: string }) {
  const [records, setRecords] = useState<ModificationRecord[]>([]);
  const [lineItems, setLineItems] = useState<BudgetLineItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [costCode, setCostCode] = useState("all");
  const [costType, setCostType] = useState("");

  // Export dropdown
  const [showExport, setShowExport] = useState(false);

  // Unique cost codes and types from line items
  const costCodes = Array.from(new Set(lineItems.map((li) => li.cost_code).filter(Boolean))).sort();
  const costTypes = Array.from(new Set(lineItems.map((li) => li.cost_type).filter(Boolean))).sort();

  const fetchRecords = useCallback(
    async (filters?: { start: string; end: string; costCode: string; costType: string }) => {
      const f = filters ?? { start: startDate, end: endDate, costCode, costType };
      const qs = new URLSearchParams();
      if (f.start) qs.set("start", f.start);
      if (f.end) qs.set("end", f.end);
      if (f.costCode && f.costCode !== "all") qs.set("cost_code", f.costCode);
      if (f.costType) qs.set("cost_type", f.costType);

      const res = await fetch(
        `/api/projects/${projectId}/budget/modifications?${qs.toString()}`
      );
      const data = await res.json();
      setRecords(Array.isArray(data) ? data : []);
    },
    [projectId, startDate, endDate, costCode, costType]
  );

  useEffect(() => {
    Promise.all([
      fetch(`/api/projects/${projectId}/budget/modifications`).then((r) => r.json()),
      fetch(`/api/projects/${projectId}/budget`).then((r) => r.json()),
    ]).then(([modData, itemsData]) => {
      setRecords(Array.isArray(modData) ? modData : []);
      setLineItems(Array.isArray(itemsData) ? itemsData : []);
      setLoading(false);
    });
  }, [projectId]);

  function handleFilter() {
    fetchRecords({ start: startDate, end: endDate, costCode, costType });
  }

  function handleReset() {
    setStartDate("");
    setEndDate("");
    setCostCode("all");
    setCostType("");
    fetchRecords({ start: "", end: "", costCode: "all", costType: "" });
  }

  function exportCSV() {
    const headers = ["Date", "From", "To", "Amount", "User", "Notes"];
    const rows = records.map((r) => [
      fmtDate(r.created_at),
      r.from_cost_code,
      r.to_cost_code,
      fmt(r.amount),
      r.created_by,
      r.notes,
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "budget-modifications.csv";
    a.click();
    URL.revokeObjectURL(url);
    setShowExport(false);
  }

  const inputClass =
    "w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-orange-400";

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader username={username} />
      <ProjectNav projectId={projectId} />

      <div className="flex">
        {/* Main content */}
        <div className="flex-1 px-6 py-6">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 text-sm text-gray-500 mb-4">
            <Link
              href={`/projects/${projectId}/reporting`}
              className="hover:text-gray-700 transition-colors"
            >
              Project Reports
            </Link>
            <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-gray-700 font-medium">Budget Modifications</span>
          </div>

          {/* Title + Export */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="font-display text-[28px] leading-tight text-[color:var(--ink)]">Budget Modifications</h1>
            </div>

            {/* Export dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowExport((o) => !o)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 border border-gray-300 rounded bg-white hover:bg-gray-50 transition-colors"
              >
                Export
                <svg
                  className={`w-3.5 h-3.5 text-gray-500 transition-transform ${showExport ? "rotate-180" : ""}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showExport && (
                <div className="absolute right-0 mt-1 w-36 bg-white border border-gray-200 rounded shadow-lg py-1 z-20">
                  <button
                    onClick={exportCSV}
                    className="w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Export as CSV
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Divider */}
          <hr className="border-gray-300 mb-5" />

          {/* Table */}
          {loading ? (
            <div className="bg-white border border-gray-200 rounded">
              <div className="h-40 flex items-center justify-center text-sm text-gray-400">
                Loading…
              </div>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-100 border-b border-gray-200">
                    <th className="text-left px-4 py-2.5 font-medium text-gray-600 w-36">Date</th>
                    <th className="text-left px-4 py-2.5 font-medium text-gray-600">From</th>
                    <th className="text-left px-4 py-2.5 font-medium text-gray-600">To</th>
                    <th className="text-left px-4 py-2.5 font-medium text-gray-600 w-40">Amount</th>
                    <th className="text-left px-4 py-2.5 font-medium text-gray-600 w-40">User</th>
                    <th className="text-left px-4 py-2.5 font-medium text-gray-600">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {records.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-sm text-orange-500">
                        No Budget Line Item Modifications
                      </td>
                    </tr>
                  ) : (
                    records.map((r) => (
                      <tr key={r.id} className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-2.5 text-gray-700 whitespace-nowrap">{fmtDate(r.created_at)}</td>
                        <td className="px-4 py-2.5 text-gray-700">{r.from_cost_code}</td>
                        <td className="px-4 py-2.5 text-gray-700">{r.to_cost_code}</td>
                        <td className="px-4 py-2.5 text-gray-700 whitespace-nowrap">{fmt(r.amount)}</td>
                        <td className="px-4 py-2.5 text-gray-700">{r.created_by}</td>
                        <td className="px-4 py-2.5 text-gray-500">{r.notes}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right filter panel */}
        <aside className="w-64 flex-shrink-0 bg-gray-100 border-l border-gray-200 px-4 py-6">
          <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500 mb-4">
            Filter Modifications By
          </h2>

          <div className="space-y-4">
            {/* Start Date */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Start Date</label>
              <div className="relative">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            {/* End Date */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">End Date</label>
              <div className="relative">
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            {/* Cost Code */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Cost Code</label>
              <select
                value={costCode}
                onChange={(e) => setCostCode(e.target.value)}
                className={inputClass}
              >
                <option value="all">All</option>
                {costCodes.map((code) => (
                  <option key={code} value={code}>{code}</option>
                ))}
              </select>
            </div>

            {/* Cost Type */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Cost Type</label>
              <select
                value={costType}
                onChange={(e) => setCostType(e.target.value)}
                className={inputClass}
              >
                <option value="">All</option>
                {costTypes.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 mt-6">
            <button
              onClick={handleReset}
              className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              Reset
            </button>
            <button
              onClick={handleFilter}
              className="px-4 py-1.5 text-sm font-medium text-white bg-gray-900 rounded hover:bg-gray-700 transition-colors"
            >
              Filter
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
