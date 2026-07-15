"use client";

import { useEffect, useState } from "react";
import ProjectNav from "@/components/ProjectNav";

type Commitment = {
  id: string;
  number: number;
  title: string;
  type: string;
  sov_accounting_method: string;
  ssov_enabled: boolean;
  ssov_status: string;
  original_contract_amount: number;
  subcontractor_contact: string;
};

type SovItem = {
  id: string;
  budget_code: string;
  description: string;
  amount: number;
  qty: number;
  unit_cost: number;
  is_group_header: boolean;
};

type SsovLine = {
  _key: string;
  dbId?: string;
  sov_item_id: string;
  budget_code: string;
  description: string;
  amount: string;
  deleted?: boolean;
};

function fmt(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function numVal(s: string): number {
  const n = parseFloat(s.replace(/[^0-9.-]/g, ""));
  return isNaN(n) ? 0 : n;
}

function uid(): string {
  return Math.random().toString(36).slice(2);
}

export default function SsovEditClient({
  projectId,
  commitmentId,
  username,
}: {
  projectId: string;
  commitmentId: string;
  role: string;
  username: string;
}) {
  const [commitment, setCommitment] = useState<Commitment | null>(null);
  const [sovItems, setSovItems] = useState<SovItem[]>([]);
  const [lines, setLines] = useState<SsovLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>("");
  const [importOpen, setImportOpen] = useState(false);
  const [importDelimiter, setImportDelimiter] = useState<"," | ";">(","  );
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importError, setImportError] = useState<string>("");
  const [importSuccess, setImportSuccess] = useState<string>("");
  const removed = useState<string[]>([])[0];

  useEffect(() => {
    Promise.all([
      fetch(`/api/projects/${projectId}/commitments/${commitmentId}`).then((r) => r.json()),
      fetch(`/api/projects/${projectId}/commitments/${commitmentId}/sov`).then((r) => r.json()),
      fetch(`/api/projects/${projectId}/commitments/${commitmentId}/ssov`).then((r) => r.json()),
    ]).then(([c, sov, ssov]) => {
      setCommitment(c);
      setSovItems(Array.isArray(sov) ? sov : []);
      setLines(
        Array.isArray(ssov)
          ? ssov.map((i: { id: string; sov_item_id: string | null; budget_code: string; description: string; amount: number }) => ({
              _key: uid(),
              dbId: i.id,
              sov_item_id: i.sov_item_id ?? "",
              budget_code: i.budget_code,
              description: i.description,
              amount: String(i.amount ?? ""),
            }))
          : []
      );
      setLoading(false);
    });
  }, [projectId, commitmentId]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center">
        <p className="text-sm text-gray-400">Loading…</p>
      </div>
    );
  }
  if (!commitment) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center">
        <p className="text-sm text-gray-500">Commitment not found.</p>
      </div>
    );
  }

  if (!commitment.ssov_enabled) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center px-8">
        <div className="max-w-md text-center">
          <p className="text-sm text-gray-700 mb-2">Subcontractor SOV is not enabled on this commitment.</p>
          <a
            href={`/projects/${projectId}/commitments/${commitmentId}`}
            className="text-sm text-orange-600 hover:underline"
          >
            ← Back to commitment
          </a>
        </div>
      </div>
    );
  }
  if (commitment.sov_accounting_method !== "amount") {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center px-8">
        <div className="max-w-md text-center">
          <p className="text-sm text-gray-700 mb-2">
            The Subcontractor SOV tab is only supported by the Amount Based accounting method.
          </p>
          <a
            href={`/projects/${projectId}/commitments/${commitmentId}`}
            className="text-sm text-orange-600 hover:underline"
          >
            ← Back to commitment
          </a>
        </div>
      </div>
    );
  }

  const status = commitment.ssov_status || "draft";
  const readOnly = status !== "draft" && status !== "revise_resubmit";

  const activeLines = lines.filter((l) => !l.deleted);
  const allocated = activeLines.reduce((s, l) => s + numVal(l.amount), 0);
  const remaining = commitment.original_contract_amount - allocated;
  const canSubmit = Math.round(remaining * 100) === 0 && activeLines.length > 0;

  function addLine() {
    setLines((prev) => [...prev, { _key: uid(), sov_item_id: "", budget_code: "", description: "", amount: "" }]);
  }

  function updateLine(key: string, field: keyof SsovLine, value: string) {
    setLines((prev) =>
      prev.map((l) => {
        if (l._key !== key) return l;
        const next = { ...l, [field]: value };
        // When selecting a parent SOV line, pre-fill budget code / description
        if (field === "sov_item_id" && value) {
          const parent = sovItems.find((s) => s.id === value);
          if (parent) {
            next.budget_code = parent.budget_code;
            next.description = parent.description;
          }
        }
        return next;
      })
    );
  }

  function removeLine(key: string) {
    setLines((prev) => {
      const line = prev.find((l) => l._key === key);
      if (line?.dbId) removed.push(line.dbId);
      return prev.filter((l) => l._key !== key);
    });
  }

  async function saveDraft() {
    setSaving(true);
    setError("");
    try {
      await Promise.all(
        removed.map((id) =>
          fetch(`/api/projects/${projectId}/commitments/${commitmentId}/ssov/${id}`, { method: "DELETE" })
        )
      );
      removed.length = 0;

      await Promise.all(
        activeLines.map((line, idx) => {
          const body = JSON.stringify({
            sov_item_id: line.sov_item_id || null,
            budget_code: line.budget_code,
            description: line.description,
            amount: numVal(line.amount),
            sort_order: idx,
          });
          if (line.dbId) {
            return fetch(`/api/projects/${projectId}/commitments/${commitmentId}/ssov/${line.dbId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body,
            });
          }
          return fetch(`/api/projects/${projectId}/commitments/${commitmentId}/ssov`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body,
          });
        })
      );
    } finally {
      setSaving(false);
    }
  }

  async function submit() {
    await saveDraft();
    const res = await fetch(
      `/api/projects/${projectId}/commitments/${commitmentId}/ssov/submit`,
      { method: "POST" }
    );
    if (!res.ok) {
      const { error: msg } = await res.json().catch(() => ({ error: "Submit failed" }));
      setError(msg || "Submit failed");
      return;
    }
    window.location.href = `/projects/${projectId}/commitments/${commitmentId}`;
  }

  function downloadTemplate() {
    const csv = [
      ["SOV Position Number", "Budget Code", "Description", "Subcontractor SOV Amount"],
      ["1", "01-100", "Mobilization", "5000.00"],
    ]
      .map((row) => row.map((c) => `"${c}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ssov_import_template.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function parseImportCSV(text: string, delimiter: string): SsovLine[] | string {
    const rows = text.trim().split(/\r?\n/).map((r) => {
      const cells: string[] = [];
      let cur = "";
      let inQ = false;
      for (let i = 0; i < r.length; i++) {
        const ch = r[i];
        if (ch === '"' && !inQ) { inQ = true; continue; }
        if (ch === '"' && inQ && r[i + 1] === '"') { cur += '"'; i++; continue; }
        if (ch === '"' && inQ) { inQ = false; continue; }
        if (ch === delimiter && !inQ) { cells.push(cur); cur = ""; continue; }
        cur += ch;
      }
      cells.push(cur);
      return cells;
    });

    if (rows.length < 2) return "CSV must contain a header row and at least one data row.";

    const header = rows[0].map((h) => h.toLowerCase().trim());
    const posIdx = header.findIndex((h) => h.includes("sov position") || h.includes("position number"));
    const amtIdx = header.findIndex((h) => h.includes("subcontractor sov amount") || h.includes("amount"));
    const codeIdx = header.findIndex((h) => h.includes("budget code"));
    const descIdx = header.findIndex((h) => h.includes("description"));

    if (posIdx === -1) return "Required column 'SOV Position Number' not found.";
    if (amtIdx === -1) return "Required column 'Subcontractor SOV Amount' not found.";

    const newLines: SsovLine[] = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row.every((c) => !c.trim())) continue;
      const posNum = parseInt(row[posIdx]);
      const amt = parseFloat(row[amtIdx]?.replace(/[^0-9.-]/g, "") ?? "");
      if (isNaN(posNum) || posNum < 1) return `Row ${i + 1}: 'SOV Position Number' must be a positive integer.`;
      if (isNaN(amt)) return `Row ${i + 1}: 'Subcontractor SOV Amount' must be a number.`;
      const sovMatch = nonHeaderSov[posNum - 1];
      newLines.push({
        _key: uid(),
        sov_item_id: sovMatch?.id ?? "",
        budget_code: codeIdx >= 0 ? (row[codeIdx] ?? "") : (sovMatch?.budget_code ?? ""),
        description: descIdx >= 0 ? (row[descIdx] ?? "") : (sovMatch?.description ?? ""),
        amount: String(amt),
      });
    }
    return newLines;
  }

  async function handleImport() {
    setImportError("");
    setImportSuccess("");
    if (!importFile) { setImportError("Please select a CSV file."); return; }
    const text = await importFile.text();
    const result = parseImportCSV(text, importDelimiter);
    if (typeof result === "string") { setImportError(result); return; }
    setLines(result);
    setImportSuccess(`Imported ${result.length} line${result.length !== 1 ? "s" : ""}.`);
    setImportOpen(false);
    setImportFile(null);
  }

  const nonHeaderSov = sovItems.filter((s) => !s.is_group_header);

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <header className="bg-[#F9FAFB] border-b border-black/[0.06] px-6 h-14 flex items-center justify-between">
        <a href="/dashboard" className="text-sm font-semibold text-gray-900 hover:text-gray-600">
          SiteCommand
        </a>
        <div className="flex items-center gap-5">
          <span className="text-sm text-gray-400">{username}</span>
          <button onClick={handleLogout} className="text-sm text-gray-400 hover:text-gray-900">
            Logout
          </button>
        </div>
      </header>

      <ProjectNav projectId={projectId} />

      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-8 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <a
            href={`/projects/${projectId}/commitments/${commitmentId}`}
            className="text-sm text-gray-400 hover:text-gray-700"
          >
            ← #{commitment.number}
          </a>
          <span className="text-gray-200">/</span>
          <h1 className="font-display text-[18px] leading-tight text-[color:var(--ink)]">Subcontractor SOV</h1>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`/projects/${projectId}/commitments/${commitmentId}`}
            className="px-4 py-1.5 text-sm text-gray-700 border border-gray-300 rounded hover:bg-gray-50"
          >
            Cancel
          </a>
          {!readOnly && (
            <>
              <button
                onClick={saveDraft}
                disabled={saving}
                className="px-4 py-1.5 text-sm text-gray-700 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save"}
              </button>
              <button
                onClick={submit}
                disabled={saving || !canSubmit}
                title={!canSubmit ? "Submit is disabled until Remaining to Allocate is $0.00" : undefined}
                className="px-4 py-1.5 text-sm font-medium text-white bg-gray-900 rounded hover:bg-gray-700 disabled:opacity-60"
              >
                Submit
              </button>
            </>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-8 py-8">
        {readOnly && (
          <div className="mb-4 text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded px-3 py-2">
            This Subcontractor SOV is {status === "under_review" ? "Under Review" : status}. It can't be
            edited until it is returned to Revise &amp; Resubmit.
          </div>
        )}
        {error && (
          <div className="mb-4 text-xs text-red-600 bg-red-50 border border-red-100 rounded px-3 py-2">
            {error}
          </div>
        )}
        {importSuccess && (
          <div className="mb-4 text-xs text-green-700 bg-green-50 border border-green-100 rounded px-3 py-2 flex items-center justify-between">
            <span>{importSuccess}</span>
            <button onClick={() => setImportSuccess("")} className="text-green-500 hover:text-green-700">✕</button>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-gray-50 border border-gray-100 rounded-lg p-4">
            <p className="text-xs font-medium text-gray-500 mb-1">Committed Amount</p>
            <p className="text-base font-semibold text-gray-900 tabular-nums">
              ${fmt(commitment.original_contract_amount)}
            </p>
          </div>
          <div className="bg-gray-50 border border-gray-100 rounded-lg p-4">
            <p className="text-xs font-medium text-gray-500 mb-1">Allocated</p>
            <p className="text-base font-semibold text-gray-900 tabular-nums">${fmt(allocated)}</p>
          </div>
          <div
            className={`border rounded-lg p-4 ${
              Math.round(remaining * 100) === 0
                ? "bg-green-50 border-green-100"
                : "bg-amber-50 border-amber-100"
            }`}
          >
            <p className="text-xs font-medium text-gray-500 mb-1">Remaining to Allocate</p>
            <p className="text-base font-semibold text-gray-900 tabular-nums">${fmt(remaining)}</p>
          </div>
        </div>

        <div className="border border-gray-200 rounded overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-3 py-2 text-left font-medium text-gray-500 w-10">#</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">Parent SOV Line</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">Budget Code</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">Description</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">Amount</th>
                {!readOnly && <th className="px-3 py-2 w-8" />}
              </tr>
            </thead>
            <tbody>
              {activeLines.length === 0 ? (
                <tr>
                  <td colSpan={readOnly ? 5 : 6} className="py-12 text-center">
                    <p className="text-sm text-gray-400 mb-3">No detail lines yet</p>
                    {!readOnly && (
                      <button
                        onClick={addLine}
                        className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded hover:bg-gray-700"
                      >
                        Add Detail Line
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                activeLines.map((line, idx) => (
                  <tr key={line._key} className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50 group">
                    <td className="px-3 py-2 text-gray-400">{idx + 1}</td>
                    <td className="px-3 py-2">
                      {readOnly ? (
                        <span className="text-gray-700">
                          {nonHeaderSov.find((s) => s.id === line.sov_item_id)?.description || "—"}
                        </span>
                      ) : (
                        <select
                          value={line.sov_item_id}
                          onChange={(e) => updateLine(line._key, "sov_item_id", e.target.value)}
                          className="w-full min-w-[180px] border border-gray-200 rounded px-1.5 py-1 bg-white"
                        >
                          <option value="">—</option>
                          {nonHeaderSov.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.budget_code} — {s.description || "Untitled"}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {readOnly ? (
                        <span className="text-gray-700">{line.budget_code || "—"}</span>
                      ) : (
                        <input
                          type="text"
                          value={line.budget_code}
                          onChange={(e) => updateLine(line._key, "budget_code", e.target.value)}
                          className="w-full bg-transparent focus:outline-none"
                        />
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {readOnly ? (
                        <span className="text-gray-700">{line.description || "—"}</span>
                      ) : (
                        <input
                          type="text"
                          value={line.description}
                          onChange={(e) => updateLine(line._key, "description", e.target.value)}
                          className="w-full bg-transparent focus:outline-none"
                        />
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {readOnly ? (
                        <span className="text-gray-900">${fmt(numVal(line.amount))}</span>
                      ) : (
                        <input
                          type="text"
                          inputMode="decimal"
                          value={line.amount}
                          onChange={(e) => updateLine(line._key, "amount", e.target.value)}
                          className="w-24 text-right bg-transparent focus:outline-none"
                        />
                      )}
                    </td>
                    {!readOnly && (
                      <td className="px-3 py-2">
                        <button
                          onClick={() => removeLine(line._key)}
                          className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500"
                        >
                          ✕
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
              <tr className="bg-gray-50 border-t border-gray-200 font-semibold">
                <td colSpan={readOnly ? 4 : 4} className="px-3 py-2 text-right text-gray-700">
                  Allocated
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-gray-900">${fmt(allocated)}</td>
                {!readOnly && <td />}
              </tr>
            </tbody>
          </table>
          {!readOnly && activeLines.length > 0 && (
            <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-t border-gray-200">
              <button
                onClick={addLine}
                className="px-3 py-1.5 text-xs font-medium text-white bg-gray-900 rounded hover:bg-gray-700"
              >
                Add Detail Line
              </button>
              <button
                onClick={() => { setImportError(""); setImportSuccess(""); setImportOpen(true); }}
                className="px-3 py-1.5 text-xs text-gray-600 border border-gray-200 rounded hover:bg-gray-100"
              >
                Import CSV
              </button>
            </div>
          )}
          {!readOnly && activeLines.length === 0 && (
            <div className="px-3 py-2 bg-gray-50 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => { setImportError(""); setImportSuccess(""); setImportOpen(true); }}
                className="px-3 py-1.5 text-xs text-gray-600 border border-gray-200 rounded hover:bg-gray-100"
              >
                Import CSV
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Import CSV Modal */}
      {importOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">Import Subcontractor SOV from CSV</h2>
              <button onClick={() => setImportOpen(false)} className="text-gray-400 hover:text-gray-700">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div>
              <p className="text-xs text-gray-500 mb-2">
                Your CSV must include <strong>SOV Position Number</strong> and{" "}
                <strong>Subcontractor SOV Amount</strong> columns. Download the template to get started.
              </p>
              <button
                onClick={downloadTemplate}
                className="flex items-center gap-1.5 text-xs text-orange-600 hover:text-orange-700 font-medium"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download Template
              </button>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Delimiter</label>
              <div className="flex gap-2">
                {([",", ";"] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => setImportDelimiter(d)}
                    className={`px-3 py-1.5 text-xs rounded border transition-colors ${
                      importDelimiter === d
                        ? "border-gray-900 bg-gray-900 text-white"
                        : "border-gray-200 text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {d === "," ? "Comma (,)" : "Semicolon (;)"}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">CSV File</label>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-gray-600 file:mr-4 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
              />
            </div>

            {importError && (
              <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded px-3 py-2">
                {importError}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setImportOpen(false)}
                className="px-4 py-2 text-sm text-gray-700 border border-gray-200 rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={!importFile}
                className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded hover:bg-gray-700 disabled:opacity-60"
              >
                Import
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
