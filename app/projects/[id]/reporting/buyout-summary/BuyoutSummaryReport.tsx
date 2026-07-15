"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import ProjectNav from "@/components/ProjectNav";
import AppHeader from "@/app/components/AppHeader";

// ── Types ─────────────────────────────────────────────────────────────────────

type BuyoutRow = {
  budget_line_item_id: string;
  cost_code: string;
  description: string;
  cost_type: string;
  original_budget_amount: number;
  budget_modifications: number;
  approved_cos: number;
  revised_budget: number;
  commitment_id: string | null;
  commitment_number: number | null;
  commitment_type: string | null;
  contract_company: string | null;
  original_commitment_costs: number | null;
  approved_commitment_cos: number | null;
  revised_commitment_costs: number | null;
  uncommitted_costs: number;
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

function fmtOrBlank(n: number | null): string {
  if (n === null) return "";
  return fmt(n);
}

function buildCSV(rows: BuyoutRow[]): string {
  const headers = [
    "Cost Code",
    "Description",
    "Cost Type",
    "Original Budget",
    "Budget Modifications",
    "Approved COs",
    "Revised Budget",
    "Commitment #",
    "Contract Company",
    "Original Commitment Costs",
    "Approved COs (Commitment)",
    "Revised Commitment Costs",
    "Uncommitted Costs",
  ];
  const dataRows = rows.map((r) => [
    r.cost_code,
    r.description,
    r.cost_type,
    fmt(r.original_budget_amount),
    fmt(r.budget_modifications),
    fmt(r.approved_cos),
    fmt(r.revised_budget),
    r.commitment_number ?? "",
    r.contract_company ?? "",
    fmtOrBlank(r.original_commitment_costs),
    fmtOrBlank(r.approved_commitment_cos),
    fmtOrBlank(r.revised_commitment_costs),
    fmt(r.uncommitted_costs),
  ]);
  return [headers, ...dataRows]
    .map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
    )
    .join("\n");
}

// ── Column header component ───────────────────────────────────────────────────

function Th({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 whitespace-normal leading-tight bg-gray-50 border-b border-gray-200 ${className}`}
    >
      {children}
    </th>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function BuyoutSummaryReport({ projectId, username }: { projectId: string; username?: string }) {
  const [rows, setRows] = useState<BuyoutRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showExport, setShowExport] = useState(false);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/reports/buyout-summary`)
      .then((r) => r.json())
      .then((data) => {
        setRows(Array.isArray(data) ? data : []);
        setLoading(false);
      });
  }, [projectId]);

  function exportCSV() {
    const csv = buildCSV(rows);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "buyout-summary.csv";
    a.click();
    URL.revokeObjectURL(url);
    setShowExport(false);
  }

  // Totals row
  const totals = rows.reduce(
    (acc, r) => {
      acc.original_budget_amount += r.original_budget_amount;
      acc.budget_modifications += r.budget_modifications;
      acc.approved_cos += r.approved_cos;
      acc.revised_budget += r.revised_budget;
      acc.original_commitment_costs += r.original_commitment_costs ?? 0;
      acc.approved_commitment_cos += r.approved_commitment_cos ?? 0;
      acc.revised_commitment_costs += r.revised_commitment_costs ?? 0;
      acc.uncommitted_costs += r.uncommitted_costs;
      return acc;
    },
    {
      original_budget_amount: 0,
      budget_modifications: 0,
      approved_cos: 0,
      revised_budget: 0,
      original_commitment_costs: 0,
      approved_commitment_cos: 0,
      revised_commitment_costs: 0,
      uncommitted_costs: 0,
    }
  );

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <AppHeader username={username} />
      <ProjectNav projectId={projectId} />

      <div className="px-6 py-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-sm text-gray-500 mb-4">
          <Link
            href={`/projects/${projectId}/reporting`}
            className="hover:text-gray-700 transition-colors"
          >
            Project Reports
          </Link>
          <svg
            className="w-3.5 h-3.5 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-gray-700 font-medium">Buyout Summary Report</span>
        </div>

        {/* Title + Export */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="font-display text-[28px] leading-tight text-[color:var(--ink)]">Buyout Summary Report</h1>
          </div>

          <div className="relative">
            <button
              onClick={() => setShowExport((o) => !o)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 border border-gray-300 rounded bg-white hover:bg-gray-50 transition-colors"
            >
              Export
              <svg
                className={`w-3.5 h-3.5 text-gray-500 transition-transform ${showExport ? "rotate-180" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showExport && (
              <div className="absolute right-0 mt-1 w-40 bg-white border border-gray-200 rounded shadow-lg py-1 z-20">
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

        <hr className="border-gray-200 mb-5" />

        {/* Table */}
        {loading ? (
          <div className="border border-gray-200 rounded h-40 flex items-center justify-center text-sm text-gray-400">
            Loading…
          </div>
        ) : (
          <div className="border border-gray-200 rounded overflow-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr>
                  <Th className="min-w-[200px] sticky left-0 z-10">Cost Code</Th>
                  <Th className="min-w-[60px]">Cost Type</Th>
                  <Th className="min-w-[110px] text-right">
                    Original<br />Budget
                  </Th>
                  <Th className="min-w-[110px] text-right">
                    Budget<br />Modifications
                  </Th>
                  <Th className="min-w-[100px] text-right">
                    Approved<br />COs
                  </Th>
                  <Th className="min-w-[100px] text-right">
                    Revised<br />Budget
                  </Th>
                  <Th className="min-w-[100px]">Commitment #</Th>
                  <Th className="min-w-[180px]">Contract Company</Th>
                  <Th className="min-w-[110px] text-right">
                    Original<br />Commitment<br />Costs
                  </Th>
                  <Th className="min-w-[90px] text-right">
                    Approved<br />COs
                  </Th>
                  <Th className="min-w-[110px] text-right">
                    Revised<br />Commitment<br />Costs
                  </Th>
                  <Th className="min-w-[110px] text-right">
                    Uncommitted<br />Costs
                  </Th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={12}
                      className="px-4 py-12 text-center text-sm text-gray-400"
                    >
                      No budget line items
                    </td>
                  </tr>
                ) : (
                  <>
                    {rows.map((row, idx) => (
                      <tr
                        key={`${row.budget_line_item_id}-${row.commitment_id ?? "none"}-${idx}`}
                        className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors"
                      >
                        {/* Cost Code + Description */}
                        <td className="px-3 py-2 sticky left-0 bg-white text-gray-700 whitespace-nowrap">
                          {row.cost_code}
                          {row.description ? (
                            <span className="text-gray-400"> – {row.description}</span>
                          ) : null}
                        </td>

                        {/* Cost Type */}
                        <td className="px-3 py-2 text-gray-600">{row.cost_type}</td>

                        {/* Budget columns */}
                        <td className="px-3 py-2 text-right text-gray-700 whitespace-nowrap">
                          {fmt(row.original_budget_amount)}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-700 whitespace-nowrap">
                          {fmt(row.budget_modifications)}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-700 whitespace-nowrap">
                          {fmt(row.approved_cos)}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-700 whitespace-nowrap font-medium">
                          {fmt(row.revised_budget)}
                        </td>

                        {/* Commitment # */}
                        <td className="px-3 py-2 whitespace-nowrap">
                          {row.commitment_number != null ? (
                            <Link
                              href={`/projects/${projectId}/commitments/${row.commitment_id}`}
                              className="text-blue-600 hover:text-blue-800 hover:underline"
                            >
                              {row.commitment_number}
                            </Link>
                          ) : null}
                        </td>

                        {/* Contract Company */}
                        <td className="px-3 py-2 text-gray-700">
                          {row.contract_company ?? ""}
                        </td>

                        {/* Commitment financial columns */}
                        <td className="px-3 py-2 text-right text-gray-700 whitespace-nowrap">
                          {fmtOrBlank(row.original_commitment_costs)}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-700 whitespace-nowrap">
                          {fmtOrBlank(row.approved_commitment_cos)}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-700 whitespace-nowrap">
                          {fmtOrBlank(row.revised_commitment_costs)}
                        </td>

                        {/* Uncommitted */}
                        <td
                          className={`px-3 py-2 text-right whitespace-nowrap ${
                            row.uncommitted_costs < 0 ? "text-red-600" : "text-gray-700"
                          }`}
                        >
                          {fmt(row.uncommitted_costs)}
                        </td>
                      </tr>
                    ))}

                    {/* Totals row */}
                    <tr className="border-t-2 border-gray-300 bg-gray-50 font-semibold">
                      <td className="px-3 py-2 sticky left-0 bg-gray-50 text-gray-900" colSpan={2}>
                        Total
                      </td>
                      <td className="px-3 py-2 text-right text-gray-900 whitespace-nowrap">
                        {fmt(totals.original_budget_amount)}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-900 whitespace-nowrap">
                        {fmt(totals.budget_modifications)}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-900 whitespace-nowrap">
                        {fmt(totals.approved_cos)}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-900 whitespace-nowrap">
                        {fmt(totals.revised_budget)}
                      </td>
                      <td className="px-3 py-2" colSpan={2} />
                      <td className="px-3 py-2 text-right text-gray-900 whitespace-nowrap">
                        {fmt(totals.original_commitment_costs)}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-900 whitespace-nowrap">
                        {fmt(totals.approved_commitment_cos)}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-900 whitespace-nowrap">
                        {fmt(totals.revised_commitment_costs)}
                      </td>
                      <td
                        className={`px-3 py-2 text-right whitespace-nowrap ${
                          totals.uncommitted_costs < 0 ? "text-red-600" : "text-gray-900"
                        }`}
                      >
                        {fmt(totals.uncommitted_costs)}
                      </td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
