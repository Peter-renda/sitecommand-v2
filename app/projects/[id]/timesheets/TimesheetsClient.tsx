"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ProjectNav from "@/components/ProjectNav";
import AppHeader from "@/app/components/AppHeader";

type Quantity = {
  id: string;
  units_installed: number;
  uom: string | null;
  notes: string | null;
};

type TimesheetEntry = {
  id: string;
  resource_name: string;
  resource_type: "employee" | "equipment";
  total_hours: number;
  location_path: string | null;
  cost_code: string | null;
  time_type: string;
  status: string;
  signed_at?: string | null;
  signature_name?: string | null;
  quantity?: Quantity[] | null;
};

type Timesheet = {
  id: string;
  work_date: string;
  status: string;
  notes: string | null;
  entries: TimesheetEntry[];
};

const TIMESHEET_STATUSES = ["draft", "submitted", "reviewed", "approved", "completed"];
const ENTRY_STATUSES = ["draft", "submitted", "reviewed", "approved", "completed"];

const STATUS_PILL: Record<string, string> = {
  draft: "pill-warn",
  submitted: "pill-open",
  reviewed: "pill-open",
  approved: "pill-post",
  completed: "pill-post",
};

function StatusPill({ status }: { status: string }) {
  const cls = STATUS_PILL[status] ?? "pill-post";
  const label = status ? status.charAt(0).toUpperCase() + status.slice(1) : "—";
  return <span className={`pill ${cls}`}>{label}</span>;
}

function toDateInputValue(value: Date) {
  return value.toISOString().slice(0, 10);
}

function formatDate(value: string) {
  if (!value) return "—";
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString();
}

export default function TimesheetsClient({
  projectId,
  username,
}: {
  projectId: string;
  username: string;
}) {
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState(toDateInputValue(new Date()));
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [selectedTimesheetId, setSelectedTimesheetId] = useState<string | null>(null);
  const [newTimesheetDate, setNewTimesheetDate] = useState(toDateInputValue(new Date()));
  const [copySourceId, setCopySourceId] = useState("");
  const [copyTargetDate, setCopyTargetDate] = useState(toDateInputValue(new Date()));

  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [createMode, setCreateMode] = useState<null | "new" | "copy">(null);
  const createRef = useRef<HTMLDivElement>(null);

  const [quantitiesSheetId, setQuantitiesSheetId] = useState<string | null>(null);
  const [signatureEntry, setSignatureEntry] = useState<TimesheetEntry | null>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (createRef.current && !createRef.current.contains(e.target as Node))
        setShowCreateMenu(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function fetchTimesheets() {
    setIsLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      if (dateFrom) query.set("from", dateFrom);
      if (dateTo) query.set("to", dateTo);
      const res = await fetch(`/api/projects/${projectId}/timesheets?${query.toString()}`);
      if (!res.ok) throw new Error((await res.json()).error || "Failed to load timesheets");
      const data = (await res.json()) as Timesheet[];
      setTimesheets(data || []);
      setSelectedTimesheetId((current) => current ?? data?.[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load timesheets");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void fetchTimesheets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredTimesheets = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return timesheets.filter((sheet) => {
      if (statusFilter !== "all" && sheet.status !== statusFilter) return false;
      if (!keyword) return true;
      const haystack = [
        sheet.work_date,
        sheet.status,
        ...(sheet.entries || []).flatMap((entry) => [entry.resource_name, entry.location_path || "", entry.cost_code || ""]),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(keyword);
    });
  }, [timesheets, statusFilter, search]);

  const selectedTimesheet = useMemo(
    () => filteredTimesheets.find((sheet) => sheet.id === selectedTimesheetId) ?? filteredTimesheets[0] ?? null,
    [filteredTimesheets, selectedTimesheetId],
  );

  const stats = useMemo(() => {
    const entries = filteredTimesheets.flatMap((sheet) => sheet.entries || []);
    const totalHours = entries.reduce((sum, entry) => sum + (entry.total_hours ?? 0), 0);
    const crew = new Set(
      entries.filter((entry) => entry.resource_type === "employee").map((entry) => entry.resource_name),
    ).size;
    const unsigned = entries.filter((entry) => !entry.signed_at).length;
    const pendingReview = filteredTimesheets.filter(
      (sheet) => sheet.status === "draft" || sheet.status === "submitted",
    ).length;
    return { totalHours, crew, unsigned, pendingReview, entryCount: entries.length };
  }, [filteredTimesheets]);

  async function patchTimesheet(timesheetId: string, payload: Record<string, unknown>) {
    const res = await fetch(`/api/projects/${projectId}/timesheets/${timesheetId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to update timesheet");
    setTimesheets((current) => current.map((sheet) => (sheet.id === timesheetId ? data : sheet)));
  }

  async function patchEntry(timesheetId: string, entryId: string, payload: Record<string, unknown>) {
    const res = await fetch(`/api/projects/${projectId}/timesheets/${timesheetId}/entries/${entryId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to update entry");

    setTimesheets((current) =>
      current.map((sheet) =>
        sheet.id !== timesheetId
          ? sheet
          : {
              ...sheet,
              entries: sheet.entries.map((entry) => (entry.id === entryId ? { ...entry, ...data } : entry)),
            },
      ),
    );
  }

  async function createTimesheet(mode: "new" | "copy") {
    try {
      const workDate = mode === "copy" ? copyTargetDate : newTimesheetDate;
      if (!workDate) throw new Error("Pick a work date");
      if (mode === "copy" && !copySourceId) throw new Error("Pick a timesheet to copy from");
      const payload: Record<string, unknown> = { work_date: workDate };
      if (mode === "copy") payload.copy_from_timesheet_id = copySourceId;
      const res = await fetch(`/api/projects/${projectId}/timesheets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create timesheet");
      setTimesheets((current) => [data, ...current]);
      setSelectedTimesheetId(data.id);
      setCopySourceId("");
      setCreateMode(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not create timesheet");
    }
  }

  function exportCsv() {
    const rows: string[][] = [[
      "Work Date",
      "Timesheet Status",
      "Resource",
      "Type",
      "Entry Status",
      "Hours",
      "Location",
      "Cost Code",
      "Time Type",
      "Signed By",
      "Signed At",
      "Units Installed",
      "UOM",
    ]];

    filteredTimesheets.forEach((sheet) => {
      (sheet.entries || []).forEach((entry) => {
        const quantity = entry.quantity?.[0];
        rows.push([
          sheet.work_date,
          sheet.status,
          entry.resource_name,
          entry.resource_type,
          entry.status,
          String(entry.total_hours ?? 0),
          entry.location_path || "",
          entry.cost_code || "",
          entry.time_type,
          entry.signature_name || "",
          entry.signed_at || "",
          String(quantity?.units_installed ?? ""),
          quantity?.uom || "",
        ]);
      });
    });

    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `timesheets-${projectId}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <AppHeader username={username} />
      <ProjectNav projectId={projectId} />

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-4">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-display text-[32px] leading-[1.05] tracking-[-0.012em] text-[color:var(--ink)]">Timesheets</h1>
            {!isLoading && filteredTimesheets.length > 0 && (
              <p className="sub mt-1.5">
                <em>Daily field hours, signed and reviewed</em>
                <span className="sep">·</span>
                <span className="num" style={{ color: "var(--brand-500)" }}>
                  {stats.totalHours.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                </span> hrs
                <span className="sep">·</span>
                <span className="num">{stats.entryCount}</span> entries
                <span className="sep">·</span>
                <span className="num">{filteredTimesheets.length}</span> timesheets
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={exportCsv} className="btn-secondary">
              Export CSV
            </button>
            <div className="relative" ref={createRef}>
              <button
                onClick={() => setShowCreateMenu((open) => !open)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-[color:var(--ink)] rounded-md hover:bg-black transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Create
                <svg
                  className={`w-3.5 h-3.5 transition-transform ${showCreateMenu ? "rotate-180" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showCreateMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-100 rounded-xl shadow-lg py-1 z-20">
                  <button
                    onClick={() => {
                      setNewTimesheetDate(toDateInputValue(new Date()));
                      setCreateMode("new");
                      setShowCreateMenu(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    New Daily Timesheet
                  </button>
                  <button
                    onClick={() => {
                      setCopySourceId("");
                      setCopyTargetDate(toDateInputValue(new Date()));
                      setCreateMode("copy");
                      setShowCreateMenu(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Copy from any date
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {!isLoading && filteredTimesheets.length > 0 && (
          <div className="stats">
            <div className="stat">
              <div className="lbl">Total Hours</div>
              <div className="val">{stats.totalHours.toLocaleString(undefined, { maximumFractionDigits: 1 })}</div>
              <div className="delta">across {filteredTimesheets.length} timesheets</div>
            </div>
            <div className="stat">
              <div className="lbl">Crew on Site</div>
              <div className="val">{stats.crew}</div>
              <div className="delta">{stats.entryCount} resource entries</div>
            </div>
            <div className={`stat ${stats.pendingReview > 0 ? "warn" : "calm"}`}>
              <div className="lbl">Pending Review</div>
              <div className="val">{stats.pendingReview}</div>
              <div className="delta">draft or submitted</div>
            </div>
            <div className={`stat ${stats.unsigned > 0 ? "alert" : "calm"}`}>
              <div className="lbl">Unsigned Entries</div>
              <div className="val">{stats.unsigned}</div>
              <div className="delta">awaiting signature</div>
            </div>
          </div>
        )}

        <div className="card card-pad">
          <div className="grid md:grid-cols-6 gap-2">
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="border hairline rounded-md px-3 py-2 text-sm font-mono tabular-nums" />
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="border hairline rounded-md px-3 py-2 text-sm font-mono tabular-nums" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search employee, location, cost code" className="md:col-span-2 border hairline rounded-md px-3 py-2 text-sm" />
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="border hairline rounded-md px-3 py-2 text-sm">
              <option value="all">All statuses</option>
              {TIMESHEET_STATUSES.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
            <button onClick={() => void fetchTimesheets()} className="btn-primary">Apply Filters</button>
          </div>
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

        <div className="grid lg:grid-cols-[360px_1fr] gap-4">
          <section className="card divide-y divide-[color:var(--hairline,#e7e3da)]">
            <div className="px-4 py-3">
              <p className="mono-label">Daily Timesheets</p>
            </div>
            {isLoading ? (
              <p className="p-4 text-sm text-[color:var(--ink-soft,#6b6557)]">Loading timesheets…</p>
            ) : filteredTimesheets.length === 0 ? (
              <p className="p-4 text-sm text-[color:var(--ink-soft,#6b6557)]">No timesheets match your date range and filters.</p>
            ) : (
              filteredTimesheets.map((sheet, idx) => {
                const sheetHours = (sheet.entries || []).reduce((sum, entry) => sum + (entry.total_hours ?? 0), 0);
                return (
                  <button
                    key={sheet.id}
                    onClick={() => setSelectedTimesheetId(sheet.id)}
                    className={`w-full text-left p-4 transition-colors hover:bg-[color:var(--surface-sunken)] ${selectedTimesheet?.id === sheet.id ? "bg-[color:var(--surface-sunken)]" : ""}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`idx-italic status-${["approved", "completed"].includes(sheet.status) ? "closed" : sheet.status === "draft" ? "draft" : "open"}`}>
                        {String(idx + 1).padStart(2, "0")}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium text-sm text-[color:var(--ink)] font-mono tabular-nums">{formatDate(sheet.work_date)}</p>
                          <StatusPill status={sheet.status} />
                        </div>
                        <p className="text-xs text-[color:var(--ink-soft,#6b6557)] mt-1">
                          <span className="font-mono tabular-nums">{sheet.entries?.length ?? 0}</span> entries
                          <span className="sep">·</span>
                          <span className="font-mono tabular-nums">{sheetHours.toLocaleString(undefined, { maximumFractionDigits: 1 })}</span> hrs
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </section>

          <section className="card card-pad">
            {!selectedTimesheet ? (
              <p className="text-sm text-[color:var(--ink-soft,#6b6557)]">Select a timesheet to view details.</p>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-3 justify-between">
                  <div>
                    <h2 className="font-display text-[22px] leading-tight text-[color:var(--ink)]">{formatDate(selectedTimesheet.work_date)}</h2>
                    <p className="sub mt-1">
                      <em>Review entries, signatures, and quantities</em>
                      <span className="sep">·</span>
                      <span className="num">
                        {(selectedTimesheet.entries || []).reduce((sum, e) => sum + (e.total_hours ?? 0), 0).toLocaleString(undefined, { maximumFractionDigits: 1 })}
                      </span> hrs
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={selectedTimesheet.status}
                      onChange={(e) => void patchTimesheet(selectedTimesheet.id, { status: e.target.value })}
                      className="border hairline rounded-md px-3 py-2 text-sm"
                    >
                      {TIMESHEET_STATUSES.map((status) => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                    <button onClick={() => setQuantitiesSheetId(selectedTimesheet.id)} className="btn-secondary">View Quantities</button>
                    <button onClick={() => void patchTimesheet(selectedTimesheet.id, { status: "reviewed" })} className="btn-quiet">Mark Reviewed</button>
                    <button onClick={() => void patchTimesheet(selectedTimesheet.id, { status: "approved" })} className="btn-primary">Approve</button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b hairline">
                        <th className="text-left px-2 py-2.5 mono-label">Resource</th>
                        <th className="text-left px-2 py-2.5 mono-label">Hours</th>
                        <th className="text-left px-2 py-2.5 mono-label">Location</th>
                        <th className="text-left px-2 py-2.5 mono-label">Cost Code</th>
                        <th className="text-left px-2 py-2.5 mono-label">Status</th>
                        <th className="text-left px-2 py-2.5 mono-label">Signature</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedTimesheet.entries || []).map((entry) => (
                        <tr key={entry.id} className="border-b hairline transition-colors hover:bg-[color:var(--surface-sunken)]">
                          <td className="px-2 py-2.5 text-[color:var(--ink)]">
                            {entry.resource_name}
                            {entry.resource_type === "equipment" && (
                              <span className="ml-1.5 text-xs italic text-[color:var(--ink-soft,#6b6557)]">equipment</span>
                            )}
                          </td>
                          <td className="px-2 py-2.5 font-mono tabular-nums text-[color:var(--ink)]">{entry.total_hours}</td>
                          <td className="px-2 py-2.5 text-[color:var(--ink-soft,#6b6557)]">{entry.location_path || "—"}</td>
                          <td className="px-2 py-2.5 font-mono tabular-nums text-[color:var(--ink-soft,#6b6557)]">{entry.cost_code || "—"}</td>
                          <td className="px-2 py-2.5">
                            <select
                              value={entry.status}
                              onChange={(e) => void patchEntry(selectedTimesheet.id, entry.id, { status: e.target.value })}
                              className="border hairline rounded-md px-2 py-1 text-xs"
                            >
                              {ENTRY_STATUSES.map((status) => (
                                <option key={status} value={status}>{status}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-2 py-2.5">
                            {entry.signed_at ? (
                              <button onClick={() => setSignatureEntry(entry)} className="text-xs font-semibold text-[color:var(--brand-700)] hover:underline">Signed</button>
                            ) : (
                              <span className="text-xs italic text-[color:var(--ink-soft,#6b6557)]">Unsigned</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        </div>
      </main>

      {quantitiesSheetId && (
        <div className="fixed inset-0 bg-gray-900/40 z-40 p-6 flex items-center justify-center">
          <div className="bg-white w-full max-w-3xl rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Installed Quantities</h3>
              <button onClick={() => setQuantitiesSheetId(null)} className="text-sm text-gray-500">Close</button>
            </div>
            <div className="space-y-2 max-h-[65vh] overflow-auto">
              {(timesheets.find((sheet) => sheet.id === quantitiesSheetId)?.entries || []).map((entry) => {
                const quantity = entry.quantity?.[0];
                return (
                  <div key={entry.id} className="border border-gray-200 rounded-lg p-3 text-sm">
                    <p className="font-medium text-gray-900">{entry.resource_name}</p>
                    <p className="text-gray-600">Units: {quantity?.units_installed ?? 0} {quantity?.uom || ""}</p>
                    <p className="text-gray-500">Notes: {quantity?.notes || "—"}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {createMode === "new" && (
        <div className="fixed inset-0 bg-gray-900/40 z-40 p-6 flex items-center justify-center">
          <div className="bg-white w-full max-w-md rounded-xl border border-gray-200 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">New Daily Timesheet</h3>
              <button onClick={() => setCreateMode(null)} className="text-sm text-gray-500">Close</button>
            </div>
            <label className="block text-sm text-gray-700 space-y-1">
              <span>Work date</span>
              <input
                type="date"
                value={newTimesheetDate}
                onChange={(e) => setNewTimesheetDate(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              />
            </label>
            <div className="flex justify-end gap-2">
              <button onClick={() => setCreateMode(null)} className="rounded-md border border-gray-300 px-3 py-2 text-sm">Cancel</button>
              <button onClick={() => void createTimesheet("new")} className="rounded-md bg-gray-900 text-white px-3 py-2 text-sm font-medium">Create</button>
            </div>
          </div>
        </div>
      )}

      {createMode === "copy" && (
        <div className="fixed inset-0 bg-gray-900/40 z-40 p-6 flex items-center justify-center">
          <div className="bg-white w-full max-w-md rounded-xl border border-gray-200 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Copy from any date</h3>
              <button onClick={() => setCreateMode(null)} className="text-sm text-gray-500">Close</button>
            </div>
            <label className="block text-sm text-gray-700 space-y-1">
              <span>Copy from</span>
              <select
                value={copySourceId}
                onChange={(e) => setCopySourceId(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              >
                <option value="">Select a timesheet…</option>
                {timesheets.map((sheet) => (
                  <option key={sheet.id} value={sheet.id}>{formatDate(sheet.work_date)}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm text-gray-700 space-y-1">
              <span>New work date</span>
              <input
                type="date"
                value={copyTargetDate}
                onChange={(e) => setCopyTargetDate(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              />
            </label>
            {timesheets.length === 0 && (
              <p className="text-xs text-gray-500">No existing timesheets are in the current date range. Widen the filters above to find a timesheet to copy.</p>
            )}
            <div className="flex justify-end gap-2">
              <button onClick={() => setCreateMode(null)} className="rounded-md border border-gray-300 px-3 py-2 text-sm">Cancel</button>
              <button
                onClick={() => void createTimesheet("copy")}
                disabled={!copySourceId || !copyTargetDate}
                className="rounded-md bg-gray-900 text-white px-3 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Copy
              </button>
            </div>
          </div>
        </div>
      )}

      {signatureEntry && (
        <div className="fixed inset-0 bg-gray-900/40 z-40 p-6 flex items-center justify-center">
          <div className="bg-white w-full max-w-md rounded-xl border border-gray-200 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Timesheet Entry Signature</h3>
              <button onClick={() => setSignatureEntry(null)} className="text-sm text-gray-500">Close</button>
            </div>
            <p className="text-sm text-gray-700">Signed by: {signatureEntry.signature_name || "Employee"}</p>
            <p className="text-sm text-gray-700">Signed at: {signatureEntry.signed_at ? new Date(signatureEntry.signed_at).toLocaleString() : "—"}</p>
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-2">
              Editing a signed timecard should require re-signing by the employee.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
