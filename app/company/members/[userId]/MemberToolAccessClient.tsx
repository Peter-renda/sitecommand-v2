"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { TOOL_SECTIONS } from "@/lib/tool-sections";
import {
  PERMISSION_LEVELS,
  PERMISSION_LEVEL_LABEL,
  type PermissionLevel,
} from "@/lib/permission-templates";

type Member = {
  id: string;
  username: string;
  email: string;
  company_role: string;
};

function templateBadgeClass(role: string) {
  if (role === "super_admin") return "bg-amber-50 text-amber-700";
  if (role === "admin") return "bg-gray-100 text-gray-700";
  return "bg-gray-50 text-gray-400";
}

function templateLabel(role: string) {
  if (role === "super_admin") return "Super Admin";
  if (role === "admin") return "Admin";
  return "User";
}

export default function MemberToolAccessClient({
  member,
  initialToolLevels,
  defaultLevel,
  isSuperAdmin,
  currentUserId,
}: {
  member: Member;
  initialToolLevels: Record<string, PermissionLevel>;
  defaultLevel: PermissionLevel;
  isSuperAdmin: boolean;
  currentUserId: string;
}) {
  const router = useRouter();
  const isSuperAdminMember = member.company_role === "super_admin";

  const [toolLevels, setToolLevels] =
    useState<Record<string, PermissionLevel>>(initialToolLevels);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  // Project access
  type ProjectRow = { id: string; name: string; status: string; hasAccess: boolean };
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [confirmProject, setConfirmProject] = useState<ProjectRow | null>(null);
  const [projectSaving, setProjectSaving] = useState(false);
  const [projectError, setProjectError] = useState("");

  useEffect(() => {
    fetch(`/api/company/members/${member.id}/projects`)
      .then((r) => r.json())
      .then((d) => setProjects(d.projects || []))
      .catch(() => setProjectError("Failed to load projects"))
      .finally(() => setProjectsLoading(false));
  }, [member.id]);

  async function applyProjectAccess(updated: ProjectRow[]) {
    setProjectSaving(true);
    setProjectError("");
    const ids = updated.filter((p) => p.hasAccess).map((p) => p.id);
    const res = await fetch(`/api/company/members/${member.id}/projects`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectIds: ids }),
    });
    setProjectSaving(false);
    if (!res.ok) {
      setProjectError("Failed to update project access");
      return;
    }
    setProjects(updated);
  }

  async function handleConfirmAdd() {
    if (!confirmProject) return;
    const updated = projects.map((p) =>
      p.id === confirmProject.id ? { ...p, hasAccess: true } : p
    );
    await applyProjectAccess(updated);
    setConfirmProject(null);
  }

  async function handleRemoveProject(projectId: string) {
    const updated = projects.map((p) =>
      p.id === projectId ? { ...p, hasAccess: false } : p
    );
    await applyProjectAccess(updated);
  }

  const canEdit =
    (isSuperAdmin || member.company_role === "member") &&
    !isSuperAdminMember &&
    member.id !== currentUserId;

  function levelFor(slug: string): PermissionLevel {
    return toolLevels[slug] ?? defaultLevel;
  }

  function setLevel(slug: string, level: PermissionLevel) {
    setSaved(false);
    setToolLevels((prev) => ({ ...prev, [slug]: level }));
  }

  function resetSection(slugs: string[]) {
    setSaved(false);
    setToolLevels((prev) => {
      const next = { ...prev };
      for (const slug of slugs) delete next[slug];
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    setSaved(false);

    const res = await fetch(`/api/company/members/${member.id}/tools`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toolLevels }),
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to save");
      return;
    }

    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  function levelBadgeClass(level: PermissionLevel): string {
    if (level === "none") return "text-gray-400";
    if (level === "read_only") return "text-gray-600";
    if (level === "standard") return "text-gray-900";
    return "text-gray-900 font-medium";
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-4 sm:px-6 h-14 flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-900">SiteCommand</span>
        <button
          onClick={() => router.push("/company")}
          className="text-sm text-gray-400 hover:text-gray-900 transition-colors"
        >
          ← Company
        </button>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {/* User info */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-1">
            <h1 className="font-display text-[24px] leading-tight text-[color:var(--ink)]">{member.username}</h1>
            <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${templateBadgeClass(member.company_role)}`}>
              {templateLabel(member.company_role)}
            </span>
          </div>
          <p className="text-sm text-gray-400">{member.email}</p>
        </div>

        {/* Project Access */}
        {!isSuperAdminMember && (
          <div className="bg-white rounded-xl border border-gray-100 px-6 py-5 mb-4">
            <h2 className="text-sm font-semibold text-gray-900 mb-1">Project Access</h2>
            <p className="text-xs text-gray-400 mb-5">
              {canEdit
                ? "Manage which projects this user can access."
                : "This user's project access is shown below."}
            </p>

            {projectsLoading ? (
              <p className="text-sm text-gray-400 py-2">Loading projects…</p>
            ) : projects.length === 0 ? (
              <p className="text-sm text-gray-400 py-2">No projects found.</p>
            ) : (
              <div className="space-y-0.5">
                {projects.map((project) => (
                  <div
                    key={project.id}
                    className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm text-gray-900 truncate">{project.name}</span>
                      <span
                        className={`shrink-0 text-xs font-medium px-1.5 py-0.5 rounded ${
                          project.status === "active"
                            ? "bg-green-50 text-green-700"
                            : project.status === "draft"
                            ? "bg-gray-100 text-gray-500"
                            : "bg-orange-50 text-orange-600"
                        }`}
                      >
                        {project.status}
                      </span>
                    </div>

                    {canEdit ? (
                      project.hasAccess ? (
                        <button
                          onClick={() => handleRemoveProject(project.id)}
                          disabled={projectSaving}
                          className="shrink-0 text-xs text-gray-400 hover:text-red-600 transition-colors disabled:opacity-40"
                        >
                          Remove
                        </button>
                      ) : (
                        <button
                          onClick={() => setConfirmProject(project)}
                          disabled={projectSaving}
                          className="shrink-0 text-xs font-medium text-orange-500 hover:text-orange-700 transition-colors disabled:opacity-40"
                        >
                          + Add
                        </button>
                      )
                    ) : (
                      <span className={`shrink-0 text-xs ${project.hasAccess ? "text-gray-500" : "text-gray-300"}`}>
                        {project.hasAccess ? "Has access" : "No access"}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {projectError && (
              <p className="text-xs text-red-600 mt-3">{projectError}</p>
            )}
          </div>
        )}

        {/* Tool Access */}
        <div className="bg-white rounded-xl border border-gray-100 px-6 py-5">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-sm font-semibold text-gray-900">Tool Access</h2>
            {isSuperAdminMember && (
              <span className="text-xs text-gray-400">Super Admins have full access</span>
            )}
          </div>
          {!isSuperAdminMember && (
            <p className="text-xs text-gray-400 mb-5">
              {canEdit
                ? `Set a permission level per tool. Unset tools use the ${PERMISSION_LEVEL_LABEL[defaultLevel]} default for this role.`
                : "You don't have permission to change this user's tool access."}
            </p>
          )}

          {isSuperAdminMember ? (
            <p className="text-sm text-gray-500 py-4 text-center">
              Super Admins always have access to all tools.
            </p>
          ) : (
            <div className="space-y-6">
              {TOOL_SECTIONS.map((section) => {
                const slugs = section.items.map((i) => i.slug);
                const hasOverrides = slugs.some((s) => s in toolLevels);

                return (
                  <div key={section.label}>
                    {/* Section header */}
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        {section.label}
                      </span>
                      {canEdit && hasOverrides && (
                        <button
                          onClick={() => resetSection(slugs)}
                          className="text-xs font-medium text-gray-400 hover:text-gray-700 transition-colors"
                        >
                          Reset to default
                        </button>
                      )}
                    </div>

                    {/* Individual tool rows */}
                    <div className="space-y-0.5">
                      {section.items.map((tool) => {
                        const level = levelFor(tool.slug);
                        const isOverride = tool.slug in toolLevels;
                        return (
                          <div
                            key={tool.slug}
                            className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={`text-sm ${level === "none" ? "text-gray-400" : "text-gray-900"}`}>
                                {tool.name}
                              </span>
                              {!isOverride && level !== "none" && (
                                <span className="text-[10px] uppercase tracking-wide text-gray-300">
                                  default
                                </span>
                              )}
                            </div>
                            {canEdit ? (
                              <select
                                value={level}
                                onChange={(e) => setLevel(tool.slug, e.target.value as PermissionLevel)}
                                className="text-sm border border-gray-200 rounded-md px-2 py-1 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-200"
                              >
                                {PERMISSION_LEVELS.map((opt) => (
                                  <option key={opt} value={opt}>
                                    {PERMISSION_LEVEL_LABEL[opt]}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className={`text-sm ${levelBadgeClass(level)}`}>
                                {PERMISSION_LEVEL_LABEL[level]}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Save button */}
        {canEdit && !isSuperAdminMember && (
          <div className="mt-5 flex items-center justify-end gap-3">
            {error && <p className="text-xs text-red-600">{error}</p>}
            {saved && <p className="text-xs text-green-600">Saved</p>}
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>
        )}
      </main>

      {/* Add-to-project confirmation modal */}
      {confirmProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm px-6 py-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Add to project?</h3>
            <p className="text-sm text-gray-500 mb-6">
              Add <span className="font-medium text-gray-900">{member.username}</span> to{" "}
              <span className="font-medium text-gray-900">{confirmProject.name}</span>? They will
              gain full member access to this project.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmProject(null)}
                disabled={projectSaving}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmAdd}
                disabled={projectSaving}
                className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                {projectSaving ? "Adding…" : "Add to project"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
