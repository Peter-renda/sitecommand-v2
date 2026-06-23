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
  const [role, setRole] = useState<SimRole>("superintendent");
  const [projectType, setProjectType] = useState<string>(DEFAULT_TYPE);
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [projects, setProjects] = useState<TrainingProject[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  const loadProjects = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await fetch("/api/training/projects");
      const data = await res.json();
      setProjects(data.projects ?? []);
    } finally {
      setLoadingList(false);
    }
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
          {ROLES.map((r) => (
            <button
              key={r.value}
              onClick={() => setRole(r.value)}
              className={`text-left rounded-lg border p-3.5 transition-colors ${
                role === r.value
                  ? "border-gray-900 bg-gray-900 text-white"
                  : "border-gray-200 hover:border-gray-300 bg-white"
              }`}
            >
              <p className={`text-sm font-medium ${role === r.value ? "text-white" : "text-gray-900"}`}>
                {r.label}
              </p>
              <p className={`mt-1 text-xs ${role === r.value ? "text-gray-300" : "text-gray-500"}`}>
                {r.blurb}
              </p>
            </button>
          ))}
        </div>

        {/* Project type */}
        <div className="max-w-xs mb-5">
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
              <ProjectRow key={p.id} project={p} reload={loadProjects} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ProjectRow({ project, reload }: { project: TrainingProject; reload: () => void }) {
  const [deleting, setDeleting] = useState(false);

  async function remove(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Delete "${project.name}"? This permanently removes the sandbox and can't be undone.`))
      return;
    setDeleting(true);
    try {
      await fetch(`/api/training/projects/${project.id}`, { method: "DELETE" });
      reload();
    } finally {
      setDeleting(false);
    }
  }

  const meta = [
    project.training_role ? roleLabel(project.training_role) : null,
    project.training_project_type ? projectTypeLabel(project.training_project_type) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <a
      href={`/projects/${project.id}`}
      target="_blank"
      rel="noopener noreferrer"
      className="group w-full text-left rounded-lg border border-gray-200 bg-white p-4 hover:border-gray-300 hover:shadow-sm transition-all flex items-center gap-4"
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
      <span
        onClick={remove}
        className="shrink-0 text-gray-300 hover:text-red-500 transition-colors p-1"
        title="Delete sandbox"
      >
        {deleting ? "…" : "✕"}
      </span>
    </a>
  );
}
