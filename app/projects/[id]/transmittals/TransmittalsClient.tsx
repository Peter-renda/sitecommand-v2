"use client";

import { useState, useEffect } from "react";
import ProjectNav from "@/components/ProjectNav";

type DirContact = { id: string; name: string; email: string | null };
type DirectoryContact = {
  id: string;
  type: string;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  group_name: string | null;
  email: string | null;
};

type TransmittalItem = {
  format: string;
  description: string;
  date: string;
  copies: string;
};

type Transmittal = {
  id: string;
  transmittal_number: number;
  subject: string | null;
  to_id: string | null;
  cc_contacts: DirContact[];
  sent_via: string | null;
  private: boolean;
  submitted_for: string[];
  action_as_noted: string[];
  due_by: string | null;
  sent_date: string | null;
  items: TransmittalItem[];
  comments: string | null;
  created_by: string | null;
  created_at: string;
};

function contactDisplayName(c: DirectoryContact): string {
  if (c.type === "company") return c.company ?? "Unnamed Company";
  if (c.type === "distribution_group") return c.group_name ?? "Unnamed Group";
  return [c.first_name, c.last_name].filter(Boolean).join(" ") || "Unnamed";
}

function formatDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function getContactNameById(directory: DirectoryContact[], id: string | null): string {
  if (!id) return "—";
  const c = directory.find((x) => x.id === id);
  return c ? contactDisplayName(c) : "—";
}

// Transmittal hand/document icon matching the screenshot
function TransmittalIcon() {
  return (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="18" y="12" width="36" height="44" rx="3" stroke="#f97316" strokeWidth="2.5" fill="none" />
      <line x1="26" y1="24" x2="46" y2="24" stroke="#f97316" strokeWidth="2" strokeLinecap="round" />
      <line x1="26" y1="31" x2="46" y2="31" stroke="#f97316" strokeWidth="2" strokeLinecap="round" />
      <line x1="26" y1="38" x2="38" y2="38" stroke="#f97316" strokeWidth="2" strokeLinecap="round" />
      <path d="M28 56 C28 53 32 52 36 54 C38 50 44 50 46 53 C48 51 52 51 52 54 L52 68 Q52 70 50 70 L30 70 Q28 70 28 68 Z" stroke="#f97316" strokeWidth="2" fill="none" strokeLinejoin="round" />
      <circle cx="60" cy="22" r="3" fill="#f97316" opacity="0.3" />
      <circle cx="16" cy="50" r="2" fill="#f97316" opacity="0.3" />
      <circle cx="64" cy="55" r="2" fill="#f97316" opacity="0.2" />
    </svg>
  );
}

export default function TransmittalsClient({
  projectId,
  username,
}: {
  projectId: string;
  role: string;
  username: string;
  userId: string;
}) {
  const [transmittals, setTransmittals] = useState<Transmittal[]>([]);
  const [directory, setDirectory] = useState<DirectoryContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"items" | "recycle_bin">("items");

  useEffect(() => {
    Promise.all([
      fetch(`/api/projects/${projectId}/transmittals`).then((r) => r.json()),
      fetch(`/api/projects/${projectId}/directory`).then((r) => r.json()),
    ]).then(([tData, dirData]) => {
      setTransmittals(Array.isArray(tData) ? tData : []);
      setDirectory(Array.isArray(dirData) ? dirData : []);
      setLoading(false);
    });
  }, [projectId]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }

  const filtered = transmittals.filter((t) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (t.subject ?? "").toLowerCase().includes(q) ||
      String(t.transmittal_number).includes(q) ||
      getContactNameById(directory, t.to_id).toLowerCase().includes(q)
    );
  });

  const now = Date.now();
  const privateCount = transmittals.filter((t) => t.private).length;
  const sentThisMonthCount = transmittals.filter((t) => {
    const ref = t.sent_date ?? t.created_at;
    if (!ref) return false;
    const ts = new Date(ref).getTime();
    return !Number.isNaN(ts) && now - ts <= 30 * 24 * 60 * 60 * 1000 && ts <= now;
  }).length;
  const dueSoonCount = transmittals.filter((t) => {
    if (!t.due_by) return false;
    const ts = new Date(t.due_by + "T12:00:00").getTime();
    if (Number.isNaN(ts)) return false;
    return ts >= now && ts - now <= 7 * 24 * 60 * 60 * 1000;
  }).length;

  function exportCSV() {
    const headers = ["#", "Subject", "To", "Sent Via", "Date"];
    const rows = filtered.map((t) => [
      t.transmittal_number,
      t.subject ?? "",
      getContactNameById(directory, t.to_id),
      t.sent_via ?? "",
      formatDate(t.created_at),
    ]);
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "transmittals.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-[#FAFAF7]">
      <header className="bg-[#FAFAF7] border-b border-black/[0.06] px-6 h-14 flex items-center justify-between">
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

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Page header */}
        <div className="flex items-end justify-between mb-6 gap-4 flex-wrap">
          <div>
            <h1 className="font-display text-[32px] leading-[1.05] tracking-[-0.012em] text-[color:var(--ink)]">Transmittals</h1>
            {!loading && transmittals.length > 0 && (
              <p className="sec-sub mt-1.5">
                <span className="serif-italic text-[color:var(--brand-700)]">A documented record of correspondence</span>
                <span className="sep">·</span>
                <span className="num" style={{ color: "var(--brand-500)" }}>{transmittals.length}</span> issued
                <span className="sep">·</span>
                <span className="num">{privateCount}</span> private
                {filtered.length !== transmittals.length && (
                  <>
                    <span className="sep">·</span>
                    <span className="num">{filtered.length}</span> shown
                  </>
                )}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Export button */}
            <button
              onClick={exportCSV}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-md bg-white hover:bg-gray-50 transition-colors"
            >
              Export
              <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {/* Create button */}
            <a
              href={`/projects/${projectId}/transmittals/new`}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-[color:var(--ink)] rounded-md hover:bg-black transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Create
            </a>
          </div>
        </div>

        {/* Stat strip */}
        {!loading && transmittals.length > 0 && (
          <div className="stats mb-6">
            <div className="stat">
              <div className="lbl">Total Issued</div>
              <div className="val">{transmittals.length}</div>
              <div className="delta">across this project</div>
            </div>
            <div className="stat">
              <div className="lbl">Sent This Month</div>
              <div className="val">{sentThisMonthCount}</div>
              <div className="delta">last 30 days</div>
            </div>
            <div className={`stat${privateCount > 0 ? " warn" : ""}`}>
              <div className="lbl">Private</div>
              <div className="val">{privateCount}</div>
              <div className="delta">restricted visibility</div>
            </div>
            <div className={`stat${dueSoonCount > 0 ? " alert" : ""}`}>
              <div className="lbl">Due Soon</div>
              <div className="val">{dueSoonCount}</div>
              <div className="delta">within 7 days</div>
            </div>
          </div>
        )}

        {/* Tabs + search */}
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden bg-white">
            <button
              onClick={() => setActiveTab("items")}
              className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
                activeTab === "items" ? "bg-[color:var(--ink)] text-white" : "bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              Items
            </button>
            <button
              onClick={() => setActiveTab("recycle_bin")}
              className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
                activeTab === "recycle_bin" ? "bg-[color:var(--ink)] text-white" : "bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              Recycle Bin
            </button>
          </div>
          <div className="relative w-64 ml-auto">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search"
              className="w-full pl-3 pr-8 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
            />
            <svg
              className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
            </svg>
          </div>
        </div>

        {/* Content */}
        {activeTab === "recycle_bin" ? (
          <div className="bg-white border border-dashed hairline rounded-xl flex flex-col items-center justify-center py-24 text-center">
            <svg className="w-12 h-12 text-[color:var(--brand-200)] mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            <p className="font-display text-lg text-[color:var(--ink)] mb-1">Recycle Bin is Empty</p>
            <p className="text-sm text-gray-500 max-w-xs">Deleted transmittals will appear here.</p>
          </div>
        ) : loading ? (
          <div className="bg-white border hairline rounded-xl divide-y divide-[color:var(--surface-sunken)]">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-12 bg-[color:var(--surface-sunken)] animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 && !search ? (
          <div className="bg-white border border-dashed hairline rounded-xl flex flex-col items-center justify-center py-24 text-center">
            <div className="mb-6">
              <TransmittalIcon />
            </div>
            <p className="font-display text-lg text-[color:var(--ink)] mb-1">No Transmittals Found</p>
            <p className="text-sm text-gray-500 max-w-xs">
              Transmittals is where you keep documented records of any correspondence.
            </p>
          </div>
        ) : filtered.length === 0 && search ? (
          <div className="bg-white border border-dashed hairline rounded-xl flex flex-col items-center justify-center py-24 text-center">
            <p className="text-sm text-gray-500">No transmittals match &ldquo;{search}&rdquo;</p>
          </div>
        ) : (
          <div className="bg-white border hairline rounded-xl overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="border-b hairline bg-[color:var(--surface-sunken)]">
                  <th className="text-left px-4 py-3 mono-label whitespace-nowrap">#</th>
                  <th className="text-left px-4 py-3 mono-label whitespace-nowrap">Subject</th>
                  <th className="text-left px-4 py-3 mono-label whitespace-nowrap">To</th>
                  <th className="text-left px-4 py-3 mono-label whitespace-nowrap">Sent Via</th>
                  <th className="text-left px-4 py-3 mono-label whitespace-nowrap">Date</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr
                    key={t.id}
                    className="border-b border-gray-50 hover:bg-[color:var(--surface-sunken)] transition-colors last:border-b-0 cursor-pointer"
                    onClick={() => { window.location.href = `/projects/${projectId}/transmittals/${t.id}`; }}
                  >
                    <td className="px-4 py-3">
                      <span className="idx-italic">{String(t.transmittal_number).padStart(3, "0")}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                      <span className="inline-flex items-center gap-2">
                        {t.subject ?? "—"}
                        {t.private && <span className="pill pill-warn">Private</span>}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{getContactNameById(directory, t.to_id)}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{t.sent_via ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 tabular-nums">{formatDate(t.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
