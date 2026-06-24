"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ROLES,
  PROJECT_TYPES,
  roleLabel,
  projectTypeLabel,
  type SimRole,
} from "@/lib/simulation-constants";

/**
 * Training → Practice: launcher for "SiteCommand Training" sandbox projects.
 *
 * The user picks a role and a project type, then launches a real, sandboxed
 * SiteCommand project that opens in a new tab. From there they run the whole
 * project with the actual tools. (The old text-based, day-by-day grading game —
 * with its scoring frequency and speed settings — has been replaced by this
 * hands-on sandbox.)
 */

// The launcher currently offers a single project type. Kept as a filtered list
// (rather than hardcoded) so more types can be re-introduced later without
// reworking the control — PROJECT_TYPES stays the source of truth for labels.
const OFFERED_TYPES = PROJECT_TYPES.filter((p) => p.value === "higher_ed");
const DEFAULT_TYPE = OFFERED_TYPES[0]?.value ?? "higher_ed";
const TRAINING_MODES = [
  { value: "guided", label: "Guided", disabled: false },
  { value: "unguided", label: "Unguided", disabled: true },
] as const;
const DEFAULT_MODE = "guided";

// Only the Project Manager experience is seeded today (directory + handoff
// email + Day-1 flow). Superintendent and Project Accounting aren't wired up
// yet, so their role cards render but are disabled with a "coming soon" hint.
const AVAILABLE_ROLES = new Set<SimRole>(["project_manager"]);

type TrainingProject = {
  id: string;
  name: string;
  status: string;
  training_role: SimRole | null;
  training_project_type: string | null;
  training_day: number;
  training_last_saved_at: string | null;
  created_at: string;
};

function lastSavedLabel(iso: string | null): string {
  if (!iso) return "";
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "Last saved just now";
  const m = Math.round(s / 60);
  if (m < 60) return `Last saved ${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `Last saved ${h} hr ago`;
  return `Last saved ${new Date(iso).toLocaleDateString()}`;
}

export default function PracticeClient({ username }: { username: string }) {
  const [role, setRole] = useState<SimRole>("project_manager");
  const [projectType, setProjectType] = useState<string>(DEFAULT_TYPE);
  const [trainingMode, setTrainingMode] = useState<string>(DEFAULT_MODE);
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [projects, setProjects] = useState<TrainingProject[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  const loadProjects = useCallback(async () => {
    setLoadingList(true);
    try {
      // no-store so a freshly-deleted/launched sandbox is never masked by a
      // cached list response.
      const res = await fetch("/api/training/projects", { cache: "no-store" });
      const data = await res.json();
      setProjects(data.projects ?? []);
    } finally {
      setLoadingList(false);
    }
  }, []);

  // Drop a sandbox from the list the instant its delete is confirmed, so the row
  // disappears immediately without waiting on (or trusting) a reload round-trip.
  const removeProjectFromList = useCallback((id: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== id));
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  async function launch() {
    setLaunching(true);
    setError(null);
    // Open the tab synchronously on click so popup blockers allow it; we point
    // it at the new sandbox once the server has created it.
    const tab = window.open("", "_blank");
    try {
      const res = await fetch("/api/training/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, projectType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to launch training project");
      if (tab) tab.location.href = `/projects/${data.id}`;
      else window.open(`/projects/${data.id}`, "_blank");
      loadProjects();
    } catch (e) {
      tab?.close();
      setError(e instanceof Error ? e.message : "Failed to launch training project");
    } finally {
      setLaunching(false);
    }
  }

  const firstName = (username || "there").split(/[\s.@]/)[0];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Project Simulation</h1>
        <p className="mt-1 text-sm text-gray-500 max-w-2xl">
          Run a simulated construction project end to end, {firstName}. Pick your role and a project
          type, then launch a hands-on <span className="font-medium text-gray-700">SiteCommand
          Training</span> sandbox — a real, private copy of SiteCommand that opens in a new tab.
          Fake emails, plans, and specs come through as you go, so you can practice running the whole
          job.
        </p>
      </div>

      {/* New sandbox */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 sm:p-6 mb-8">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Launch a training project</h2>

        {/* Role */}
        <label className="block text-xs font-medium text-gray-500 mb-2">Your role</label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
          {ROLES.map((r) => {
            const available = AVAILABLE_ROLES.has(r.value);
            const selected = role === r.value;
            return (
              <div key={r.value} className="relative group h-full">
                <button
                  type="button"
                  onClick={() => available && setRole(r.value)}
                  aria-disabled={!available}
                  tabIndex={available ? undefined : -1}
                  className={`w-full h-full text-left rounded-lg border p-3.5 transition-colors ${
                    selected
                      ? "border-gray-900 bg-gray-900 text-white"
                      : available
                        ? "border-gray-200 hover:border-gray-300 bg-white"
                        : "border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed"
                  }`}
                >
                  <p className={`text-sm font-medium ${selected ? "text-white" : "text-gray-900"}`}>
                    {r.label}
                  </p>
                  <p className={`mt-1 text-xs ${selected ? "text-gray-300" : "text-gray-500"}`}>
                    {r.blurb}
                  </p>
                </button>
                {!available && (
                  <div
                    role="tooltip"
                    className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-900 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100"
                  >
                    Coming soon
                    <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Project type and mode */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl mb-5">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Project type</label>
            <select
              value={projectType}
              onChange={(e) => setProjectType(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
            >
              {OFFERED_TYPES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Training mode</label>
            <select
              value={trainingMode}
              onChange={(e) => setTrainingMode(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
            >
              {TRAINING_MODES.map((mode) => (
                <option key={mode.value} value={mode.value} disabled={mode.disabled}>
                  {mode.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {trainingMode === "guided" && (
          <div className="mb-5 max-w-2xl rounded-lg border border-blue-100 bg-blue-50 p-3.5 text-sm text-blue-950">
            <p className="font-medium">Guided training cadence</p>
            <p className="mt-1 text-xs leading-5 text-blue-900/80">
              Each day includes new emails and phone calls, tasks to complete, and end-of-day
              tests. After each week, you&apos;ll receive a score and a list of areas to improve.
            </p>
          </div>
        )}

        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

        <button
          onClick={launch}
          disabled={launching}
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 transition-colors"
        >
          {launching ? "Launching sandbox…" : "Launch training project ↗"}
        </button>
        <p className="mt-2 text-xs text-gray-400">Opens in a new tab.</p>
      </div>

      {/* Existing sandboxes */}
      <div>
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Your training projects</h2>
        {loadingList ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : projects.length === 0 ? (
          <p className="text-sm text-gray-400">No training projects yet. Launch one above.</p>
        ) : (
          <div className="space-y-2">
            {projects.map((p) => (
              <ProjectRow key={p.id} project={p} onDeleted={removeProjectFromList} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ProjectRow({
  project,
  onDeleted,
}: {
  project: TrainingProject;
  onDeleted: (id: string) => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  async function remove() {
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/training/projects/${project.id}`, {
        method: "DELETE",
        cache: "no-store",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to delete training project");
      }
      // Server confirmed the row was removed. Drop it from the list right away
      // (the row unmounts), so we never depend on a reload that could be served
      // a stale, cached copy still containing this project. `deleting` stays set
      // to avoid a state update after unmount.
      onDeleted(project.id);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete training project");
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  const meta = [
    project.training_role ? roleLabel(project.training_role) : null,
    project.training_project_type ? projectTypeLabel(project.training_project_type) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="rounded-lg border border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm transition-all">
      <div className="group flex items-center">
        {/* Expand toggle — outside the anchor so it never triggers navigation */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-label={expanded ? "Hide phase reviews" : "Show phase reviews"}
          title={expanded ? "Hide phase reviews" : "Show phase reviews"}
          className="shrink-0 py-4 pl-3 pr-1 text-gray-400 hover:text-gray-700 transition-colors"
        >
          <svg
            className={`h-4 w-4 transition-transform ${expanded ? "rotate-90" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
        <a
          href={`/projects/${project.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 min-w-0 flex items-center gap-4 py-4 pr-2 pl-1"
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{project.name}</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {[meta, lastSavedLabel(project.training_last_saved_at)].filter(Boolean).join(" · ")}
            </p>
          </div>
          <span className="shrink-0 text-xs font-medium text-gray-500 group-hover:text-gray-900">
            Open ↗
          </span>
        </a>
        {/* Delete button is outside the anchor so clicks never trigger navigation */}
        {confirmDelete ? (
          <div className="shrink-0 flex items-center gap-1.5 px-3">
            <button
              type="button"
              onClick={remove}
              disabled={deleting}
              className="rounded px-2 py-1 text-xs font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {deleting ? "Deleting…" : "Delete"}
            </button>
            <button
              type="button"
              onClick={() => { setConfirmDelete(false); setDeleteError(null); }}
              disabled={deleting}
              className="rounded px-2 py-1 text-xs font-medium text-gray-600 hover:text-gray-900 disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="shrink-0 text-gray-300 hover:text-red-500 transition-colors px-3 py-4"
            title="Delete sandbox"
          >
            ✕
          </button>
        )}
      </div>
      {expanded && <ReviewsPanel projectId={project.id} />}
      {deleteError && (
        <p className="px-4 pb-3 text-xs text-red-600">{deleteError}</p>
      )}
    </div>
  );
}

type SavedReview = {
  id: string;
  phase: string;
  day: number;
  completed: unknown[];
  missed: unknown[];
  closed_out: boolean;
  updated_at: string;
};

/**
 * Expanded under a training project row: the sandbox's saved phase Job Reviews.
 * Each links to the review page in a new tab. Reviews are persisted server-side
 * (training_phase_reviews), so they survive reloads and appear here regardless of
 * which browser generated them.
 */
function ReviewsPanel({ projectId }: { projectId: string }) {
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState<SavedReview[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/training/projects/${projectId}/reviews`, {
          cache: "no-store",
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load reviews");
        if (!cancelled) setReviews(data.reviews ?? []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load reviews");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  return (
    <div className="border-t border-gray-100 px-4 py-3">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
        Phase reviews
      </p>
      {loading ? (
        <p className="text-sm text-gray-400">Loading reviews…</p>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : reviews.length === 0 ? (
        <p className="text-sm text-gray-400">
          No saved reviews yet. A Job Review is saved here each time you complete a phase in the
          sandbox.
        </p>
      ) : (
        <div className="space-y-1.5">
          {reviews.map((r) => {
            const done = Array.isArray(r.completed) ? r.completed.length : 0;
            const miss = Array.isArray(r.missed) ? r.missed.length : 0;
            return (
              <a
                key={r.id}
                href={`/training/review?project=${projectId}&day=${r.day}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-3 rounded-md border border-gray-100 bg-gray-50/60 px-3 py-2 transition-colors hover:border-gray-300 hover:bg-white"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-800">{r.phase}</p>
                  <p className="mt-0.5 text-[11px] text-gray-500">
                    {done} completed · {miss} missed
                  </p>
                </div>
                <span className="flex shrink-0 items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      r.closed_out ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {r.closed_out ? "Closed out" : "Open"}
                  </span>
                  <span className="text-xs font-medium text-gray-400">View →</span>
                </span>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
