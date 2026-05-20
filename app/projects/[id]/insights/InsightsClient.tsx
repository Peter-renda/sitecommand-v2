"use client";

import { useState, useEffect } from "react";
import ProjectNav from "@/components/ProjectNav";

type StatCard = {
  label: string;
  total: number;
  breakdown: { label: string; count: number; color: string }[];
  href: string;
};

type LessonAlert = {
  discipline: string;
  row: Record<string, unknown>;
};

const DISCIPLINES = [
  { label: "Architectural", prefixes: ["a"], keywords: ["arch", "floor plan", "ceiling", "elevation", "partition"] },
  { label: "Structural", prefixes: ["s"], keywords: ["struct", "beam", "column", "foundation", "steel", "concrete"] },
  { label: "Mechanical", prefixes: ["m"], keywords: ["mech", "hvac", "duct", "air handling"] },
  { label: "Electrical", prefixes: ["e"], keywords: ["elec", "lighting", "power", "panel", "conduit"] },
  { label: "Plumbing", prefixes: ["p"], keywords: ["plumb", "pipe", "drain", "sanitary"] },
  { label: "Civil", prefixes: ["c"], keywords: ["civil", "site", "grade", "paving", "storm"] },
  { label: "Fire Protection", prefixes: ["fp"], keywords: ["fire", "sprinkler"] },
];

function detectDisciplines(filenames: string[]): string[] {
  const found = new Set<string>();
  for (const filename of filenames) {
    const lower = filename.toLowerCase();
    for (const disc of DISCIPLINES) {
      if (disc.prefixes.some((p) => new RegExp(`^${p}\\d`).test(lower.replace(/[^a-z0-9]/g, "")) || lower.startsWith(p + "-") || lower.startsWith(p + "_"))) {
        found.add(disc.label);
      }
      if (disc.keywords.some((kw) => lower.includes(kw))) {
        found.add(disc.label);
      }
    }
  }
  return [...found];
}

function matchesAnyDiscipline(row: Record<string, unknown>, disciplines: string[]): string | null {
  const rowText = Object.values(row).join(" ").toLowerCase();
  for (const disc of DISCIPLINES) {
    if (!disciplines.includes(disc.label)) continue;
    if (disc.keywords.some((kw) => rowText.includes(kw))) {
      return disc.label;
    }
  }
  return null;
}

function countByStatus<T>(items: T[], field: keyof T, statuses: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const s of statuses) counts[s] = 0;
  for (const item of items) {
    const val = String(item[field] ?? "");
    if (val in counts) counts[val]++;
    else counts[val] = (counts[val] ?? 0) + 1;
  }
  return counts;
}

export default function InsightsClient({
  projectId,
  role,
  username,
}: {
  projectId: string;
  role: string;
  username: string;
}) {
  const [loading, setLoading] = useState(true);
  const [cards, setCards] = useState<StatCard[]>([]);
  const [lessonAlerts, setLessonAlerts] = useState<LessonAlert[]>([]);
  const [drawingCount, setDrawingCount] = useState(0);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [tasks, rfis, submittals, punchList, photos, documents, drawingsRes, lessonsRes] = await Promise.all([
          fetch(`/api/projects/${projectId}/tasks`).then((r) => r.json()),
          fetch(`/api/projects/${projectId}/rfis`).then((r) => r.json()),
          fetch(`/api/projects/${projectId}/submittals`).then((r) => r.json()),
          fetch(`/api/projects/${projectId}/punch-list`).then((r) => r.json()),
          fetch(`/api/projects/${projectId}/photos`).then((r) => r.json()),
          fetch(`/api/projects/${projectId}/documents`).then((r) => r.json()),
          fetch(`/api/projects/${projectId}/drawings`).then((r) => r.json()),
          fetch(`/api/company/lessons?projectId=${projectId}`).then((r) => r.json()),
        ]);

        const taskItems = Array.isArray(tasks) ? tasks : [];
        const taskCounts = countByStatus(taskItems, "status", ["open", "in progress", "completed", "closed"]);

        const rfiItems = Array.isArray(rfis) ? rfis : [];
        const rfiCounts = countByStatus(rfiItems, "status", ["open", "draft", "closed"]);

        const submittalItems = Array.isArray(submittals) ? submittals : [];
        const submittalCounts = countByStatus(submittalItems, "status", [
          "draft", "pending_review", "approved", "rejected", "revise_and_resubmit", "closed",
        ]);

        const punchItems = Array.isArray(punchList) ? punchList : [];
        const punchCounts = countByStatus(punchItems, "status", ["open", "in_progress", "closed"]);

        const photoCount = Array.isArray(photos) ? photos.length : (photos?.photos?.length ?? 0);
        const docItems = Array.isArray(documents) ? documents : [];

        // Lessons vs drawings matching
        const drawingUploads: { filename: string }[] = drawingsRes?.uploads ?? [];
        setDrawingCount(drawingUploads.length);

        const lessonRows: Record<string, unknown>[] = Array.isArray(lessonsRes) ? lessonsRes : [];
        const disciplines = detectDisciplines(drawingUploads.map((u) => u.filename));

        const alerts: LessonAlert[] = [];
        for (const row of lessonRows) {
          const match = disciplines.length > 0 ? matchesAnyDiscipline(row, disciplines) : null;
          alerts.push({ discipline: match ?? "General", row });
        }
        setLessonAlerts(alerts);

        setCards([
          {
            label: "Tasks",
            total: taskItems.length,
            href: `/projects/${projectId}/tasks`,
            breakdown: [
              { label: "Open", count: taskCounts["open"] ?? 0, color: "bg-blue-500" },
              { label: "In Progress", count: taskCounts["in progress"] ?? 0, color: "bg-amber-500" },
              { label: "Completed", count: taskCounts["completed"] ?? 0, color: "bg-green-500" },
              { label: "Closed", count: taskCounts["closed"] ?? 0, color: "bg-gray-400" },
            ],
          },
          {
            label: "RFIs",
            total: rfiItems.length,
            href: `/projects/${projectId}/rfis`,
            breakdown: [
              { label: "Open", count: rfiCounts["open"] ?? 0, color: "bg-blue-500" },
              { label: "Draft", count: rfiCounts["draft"] ?? 0, color: "bg-gray-400" },
              { label: "Closed", count: rfiCounts["closed"] ?? 0, color: "bg-green-500" },
            ],
          },
          {
            label: "Submittals",
            total: submittalItems.length,
            href: `/projects/${projectId}/submittals`,
            breakdown: [
              { label: "Draft", count: submittalCounts["draft"] ?? 0, color: "bg-gray-400" },
              { label: "Pending Review", count: submittalCounts["pending_review"] ?? 0, color: "bg-amber-500" },
              { label: "Approved", count: submittalCounts["approved"] ?? 0, color: "bg-green-500" },
              { label: "Rejected", count: submittalCounts["rejected"] ?? 0, color: "bg-red-500" },
              { label: "Revise & Resubmit", count: submittalCounts["revise_and_resubmit"] ?? 0, color: "bg-orange-500" },
              { label: "Closed", count: submittalCounts["closed"] ?? 0, color: "bg-gray-300" },
            ],
          },
          {
            label: "Punch List",
            total: punchItems.length,
            href: `/projects/${projectId}/punch-list`,
            breakdown: [
              { label: "Open", count: punchCounts["open"] ?? 0, color: "bg-blue-500" },
              { label: "In Progress", count: punchCounts["in_progress"] ?? 0, color: "bg-amber-500" },
              { label: "Closed", count: punchCounts["closed"] ?? 0, color: "bg-green-500" },
            ],
          },
          {
            label: "Photos",
            total: photoCount,
            href: `/projects/${projectId}/photos`,
            breakdown: [
              { label: "Total", count: photoCount, color: "bg-indigo-500" },
            ],
          },
          {
            label: "Documents",
            total: docItems.length,
            href: `/projects/${projectId}/documents`,
            breakdown: [
              { label: "Total", count: docItems.length, color: "bg-purple-500" },
            ],
          },
        ]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [projectId]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }

  return (
    <div className="min-h-screen bg-[#FAFAF7] flex flex-col">
      {/* Header */}
      <header className="bg-[#FAFAF7] border-b border-black/[0.06] px-6 h-14 flex items-center justify-between shrink-0">
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

      {/* Body */}
      <div className="flex-1 px-6 py-8 max-w-5xl w-full mx-auto">
        <h1 className="font-display text-[28px] leading-tight text-[color:var(--ink)] mb-1">Insights</h1>
        <p className="text-sm text-gray-400 mb-8">Overview of project activity across all tools.</p>

        {loading ? (
          <div className="flex items-center justify-center h-48">
            <svg className="w-6 h-6 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
          </div>
        ) : (
          <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {cards.map((card) => (
              <a
                key={card.label}
                href={card.href}
                className="bg-white border border-gray-100 rounded-xl p-5 hover:shadow-sm transition-shadow block"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-700">{card.label}</span>
                  <span className="text-2xl font-semibold text-gray-900">{card.total}</span>
                </div>

                {/* Progress bar */}
                {card.total > 0 && card.breakdown.length > 1 && (
                  <div className="flex h-1.5 rounded-full overflow-hidden mb-3 gap-px">
                    {card.breakdown
                      .filter((b) => b.count > 0)
                      .map((b) => (
                        <div
                          key={b.label}
                          className={`${b.color} transition-all`}
                          style={{ width: `${(b.count / card.total) * 100}%` }}
                          title={`${b.label}: ${b.count}`}
                        />
                      ))}
                  </div>
                )}

                {/* Breakdown */}
                <div className="space-y-1.5 mt-3">
                  {card.breakdown
                    .filter((b) => b.count > 0 || card.breakdown.length <= 2)
                    .map((b) => (
                      <div key={b.label} className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${b.color} shrink-0`} />
                          <span className="text-xs text-gray-500">{b.label}</span>
                        </div>
                        <span className="text-xs font-medium text-gray-700">{b.count}</span>
                      </div>
                    ))}
                </div>

                {card.total === 0 && (
                  <p className="text-xs text-gray-300 mt-2">No items yet</p>
                )}
              </a>
            ))}
          </div>

          {/* Lessons Learned Alerts */}
          {lessonAlerts.length > 0 && (
            <div className="mt-10">
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">
                Lessons Learned
              </h2>
              <p className="text-xs text-gray-400 mb-4">
                {drawingCount > 0
                  ? `Based on ${drawingCount} drawing set${drawingCount !== 1 ? "s" : ""} uploaded — ${lessonAlerts.length} relevant lesson${lessonAlerts.length !== 1 ? "s" : ""} found from past projects.`
                  : `${lessonAlerts.length} lesson${lessonAlerts.length !== 1 ? "s" : ""} on file from past projects.`}
              </p>
              <div className="space-y-3">
                {lessonAlerts.map((alert, i) => {
                  const { _source, ...fields } = alert.row;
                  const entries = Object.entries(fields).filter(([, v]) => String(v ?? "").trim() !== "");
                  const [, firstVal] = entries[0] ?? ["Note", "—"];
                  const rest = entries.slice(1, 4);
                  return (
                    <div key={i} className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <p className="text-sm font-medium text-gray-900">{String(firstVal)}</p>
                        <span className="text-xs font-medium px-2 py-0.5 bg-amber-100 text-amber-700 rounded shrink-0">
                          {alert.discipline}
                        </span>
                      </div>
                      {rest.map(([k, v]) => (
                        <p key={k} className="text-xs text-gray-500 mt-1">
                          <span className="font-medium text-gray-600">{k}:</span> {String(v)}
                        </p>
                      ))}
                      <p className="text-xs text-gray-300 mt-2">Source: {String(_source)}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          </>
        )}
      </div>
    </div>
  );
}
