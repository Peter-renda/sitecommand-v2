"use client";

import { useState, useEffect, useRef } from "react";
import ProjectNav from "@/components/ProjectNav";
import EmptyState from "@/app/components/EmptyState";
import { SkeletonTable } from "@/app/components/Skeleton";

type Meeting = {
  id: string;
  meeting_number: number;
  title: string;
  series: string | null;
  overview: string | null;
  date: string | null;
  end_date: string | null;
  location: string | null;
  status: string;
  agenda_items_count: number;
  template: string | null;
  is_locked: boolean;
  deleted_at: string | null;
  created_at: string;
};

const STATUS_LABELS: Record<string, string> = {
  scheduled: "Scheduled",
  awaiting_minutes: "Awaiting Minutes",
  minutes_approved: "Minutes Approved",
  cancelled: "Cancelled",
};

const STATUS_COLORS: Record<string, string> = {
  scheduled: "bg-blue-50 text-blue-700",
  awaiting_minutes: "bg-red-50 text-red-600",
  minutes_approved: "bg-green-50 text-green-700",
  cancelled: "bg-gray-100 text-gray-500",
};

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short",
  });
}

function formatDateRange(start: string | null, end: string | null): string {
  if (!start) return "—";
  const startStr = formatDateTime(start);
  if (!end) return startStr;
  const endDate = new Date(end);
  const endTime = endDate.toLocaleString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short",
  });
  return `${startStr} - ${endTime}`;
}

// ── Grip dots icon ────────────────────────────────────────────────────────────

function GripDots() {
  return (
    <svg className="w-3.5 h-3.5 text-gray-300 shrink-0" viewBox="0 0 12 20" fill="currentColor">
      <circle cx="4" cy="4" r="1.5" />
      <circle cx="8" cy="4" r="1.5" />
      <circle cx="4" cy="10" r="1.5" />
      <circle cx="8" cy="10" r="1.5" />
      <circle cx="4" cy="16" r="1.5" />
      <circle cx="8" cy="16" r="1.5" />
    </svg>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

const PAGE_SIZE_OPTIONS = [10, 25, 50];

export default function MeetingsClient({
  projectId,
  role,
  username,
}: {
  projectId: string;
  role: string;
  username: string;
}) {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"list" | "recycle">("list");
  const [search, setSearch] = useState("");
  const [groupBySeries, setGroupBySeries] = useState(true);
  const [collapsedSeries, setCollapsedSeries] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [showCreateDropdown, setShowCreateDropdown] = useState(false);
  const createDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (createDropdownRef.current && !createDropdownRef.current.contains(e.target as Node)) {
        setShowCreateDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/meetings`)
      .then((r) => r.json())
      .then((data) => {
        setMeetings(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [projectId]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }

  function toggleSeries(name: string) {
    setCollapsedSeries((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  // Filter by tab and search
  const activeMeetings = meetings.filter((m) => {
    if (activeTab === "list") return !m.deleted_at;
    return !!m.deleted_at;
  });

  const filtered = activeMeetings.filter((m) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      m.title.toLowerCase().includes(q) ||
      (m.series ?? "").toLowerCase().includes(q) ||
      (m.overview ?? "").toLowerCase().includes(q) ||
      (m.location ?? "").toLowerCase().includes(q)
    );
  });

  // Paginate
  const totalCount = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  // Group by series
  const seriesGroups: Map<string, Meeting[]> = new Map();
  if (groupBySeries) {
    for (const m of paginated) {
      const key = m.series ?? "(No Series)";
      if (!seriesGroups.has(key)) seriesGroups.set(key, []);
      seriesGroups.get(key)!.push(m);
    }
  }

  const startEntry = totalCount === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const endEntry = Math.min(safePage * pageSize, totalCount);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top nav bar */}
      <header className="bg-white border-b border-gray-100 px-6 h-14 flex items-center justify-between">
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

      <main className="px-6 py-0">
        {/* Page header */}
        <div className="flex items-center justify-between py-4 border-b border-gray-100 bg-white -mx-6 px-6">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <h1 className="font-display text-[28px] leading-tight text-[color:var(--ink)]">Meetings</h1>
          </div>

          {/* Create Meeting button with dropdown */}
          <div ref={createDropdownRef} className="relative">
            <button
              onClick={() => { window.location.href = `/projects/${projectId}/meetings/new`; }}
              className="flex items-center gap-0 text-sm font-medium text-white rounded-md overflow-hidden"
              style={{ backgroundColor: "#d4500a" }}
            >
              <span className="px-4 py-2">+ Create Meeting</span>
              <span
                className="px-2 py-2 border-l border-white/30 hover:bg-black/10 transition-colors"
                onClick={(e) => { e.stopPropagation(); setShowCreateDropdown((o) => !o); }}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </span>
            </button>
            {showCreateDropdown && (
              <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-100 rounded-xl shadow-lg py-1 z-20">
                <button
                  onClick={() => { window.location.href = `/projects/${projectId}/meetings/new`; }}
                  className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Create Meeting
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-0 border-b border-gray-200 bg-white -mx-6 px-6">
          <button
            onClick={() => { setActiveTab("list"); setPage(1); }}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "list"
                ? "border-gray-900 text-gray-900"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Meetings
          </button>
          <button
            onClick={() => { setActiveTab("recycle"); setPage(1); }}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "recycle"
                ? "border-gray-900 text-gray-900"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Recycle Bin
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between py-3 bg-white border-b border-gray-100 -mx-6 px-6">
          {/* Left: search + filters */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search"
                className="pl-8 pr-3 py-1.5 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 w-52"
              />
            </div>
            <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
              </svg>
              Filters
            </button>
          </div>

          {/* Right: group by + configure */}
          <div className="flex items-center gap-2">
            {groupBySeries ? (
              <div className="flex items-center gap-1 px-3 py-1.5 border border-gray-200 rounded-md bg-white text-sm text-gray-700">
                <span>Group by: Series</span>
                <button
                  onClick={() => setGroupBySeries(false)}
                  className="ml-1 text-gray-400 hover:text-gray-700 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                <svg className="w-3.5 h-3.5 text-gray-400 ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            ) : (
              <button
                onClick={() => setGroupBySeries(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-md bg-white text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Group by: Series
                <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            )}
            <button className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-md bg-white text-sm text-gray-700 hover:bg-gray-50 transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
              Configure
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="bg-white border border-gray-100 rounded-b-xl overflow-hidden -mx-6 mt-0">
          {loading ? (
            <SkeletonTable rows={5} cols={8} />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={
                <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.25}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              }
              title={activeTab === "recycle" ? "Recycle bin is empty" : "No meetings yet"}
              description={activeTab === "list" ? "Click + Create Meeting to schedule the first one." : ""}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-max">
                <thead>
                  <tr className="border-b border-gray-100 bg-white">
                    {[
                      { label: "Series", w: "w-36" },
                      { label: "Title", w: "w-48" },
                      { label: "Number", w: "w-20" },
                      { label: "Overview", w: "w-48" },
                      { label: "Date", w: "w-64" },
                      { label: "Location", w: "w-32" },
                      { label: "Status", w: "w-36" },
                      { label: "Agenda Items", w: "w-28" },
                      { label: "Template", w: "w-36" },
                    ].map(({ label, w }) => (
                      <th
                        key={label}
                        className={`text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider ${w}`}
                      >
                        <div className="flex items-center gap-1.5">
                          {label}
                          <GripDots />
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {groupBySeries
                    ? Array.from(seriesGroups.entries()).map(([seriesName, items]) => {
                        const isCollapsed = collapsedSeries.has(seriesName);
                        return (
                          <>
                            {/* Series group header row */}
                            <tr
                              key={`series-${seriesName}`}
                              className="bg-blue-50/60 border-b border-gray-100 cursor-pointer hover:bg-blue-50 transition-colors"
                              onClick={() => toggleSeries(seriesName)}
                            >
                              <td colSpan={9} className="px-4 py-2.5">
                                <div className="flex items-center gap-2">
                                  <svg
                                    className={`w-3.5 h-3.5 text-gray-500 transition-transform shrink-0 ${isCollapsed ? "-rotate-90" : ""}`}
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth={2.5}
                                  >
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                  </svg>
                                  <span className="text-sm font-semibold text-gray-800">{seriesName}</span>
                                  <span className="text-xs text-gray-400 ml-1">({items.length})</span>
                                </div>
                              </td>
                            </tr>
                            {/* Series meeting rows */}
                            {!isCollapsed &&
                              items.map((meeting) => (
                                <MeetingRow key={meeting.id} meeting={meeting} projectId={projectId} />
                              ))}
                          </>
                        );
                      })
                    : paginated.map((meeting) => (
                        <MeetingRow key={meeting.id} meeting={meeting} projectId={projectId} />
                      ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination footer */}
          {!loading && filtered.length > 0 && (
            <div className="flex items-center justify-end gap-4 px-4 py-3 border-t border-gray-100 text-xs text-gray-500">
              <span>
                {startEntry}–{endEntry} of {totalCount}
              </span>
              <div className="flex items-center gap-1.5">
                <span>Page:</span>
                <select
                  value={safePage}
                  onChange={(e) => setPage(Number(e.target.value))}
                  className="border border-gray-200 rounded px-1.5 py-0.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-gray-900"
                >
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={safePage === 1}
                  className="w-6 h-6 flex items-center justify-center rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage === totalPages}
                  className="w-6 h-6 flex items-center justify-center rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

    </div>
  );
}

// ── Meeting table row ─────────────────────────────────────────────────────────

function MeetingRow({ meeting, projectId }: { meeting: Meeting; projectId: string }) {
  return (
    <tr
      className="border-b border-gray-50 hover:bg-gray-50 transition-colors last:border-b-0 cursor-pointer"
      onClick={() => window.location.href = `/projects/${projectId}/meetings/${meeting.id}`}
    >
      {/* Series */}
      <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
        {meeting.series ?? <span className="text-gray-300">—</span>}
      </td>
      {/* Title */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-blue-600 hover:underline">{meeting.title}</span>
          {meeting.is_locked && (
            <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          )}
        </div>
      </td>
      {/* Number */}
      <td className="px-4 py-3 text-sm text-gray-500">{meeting.meeting_number}</td>
      {/* Overview */}
      <td className="px-4 py-3 text-sm text-gray-500 max-w-xs">
        {meeting.overview ? (
          <span className="line-clamp-1">{meeting.overview}</span>
        ) : (
          <span className="text-gray-300">—</span>
        )}
      </td>
      {/* Date */}
      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
        {formatDateRange(meeting.date, meeting.end_date)}
      </td>
      {/* Location */}
      <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
        {meeting.location ?? <span className="text-gray-300">—</span>}
      </td>
      {/* Status */}
      <td className="px-4 py-3">
        <span
          className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[meeting.status] ?? "bg-gray-100 text-gray-500"}`}
        >
          {STATUS_LABELS[meeting.status] ?? meeting.status}
        </span>
      </td>
      {/* Agenda Items */}
      <td className="px-4 py-3 text-sm text-gray-500 text-center">{meeting.agenda_items_count}</td>
      {/* Template */}
      <td className="px-4 py-3 text-sm text-gray-500">
        {meeting.template ?? <span className="text-gray-300">—</span>}
      </td>
    </tr>
  );
}
