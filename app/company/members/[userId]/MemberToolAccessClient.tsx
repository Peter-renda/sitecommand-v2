"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  PERMISSION_LEVELS,
  PERMISSION_LEVEL_LABEL,
  TEMPLATE_TOOLS,
  type PermissionLevel,
} from "@/lib/permission-templates";

type Member = {
  id: string;
  username: string;
  email: string;
  company_role: string;
};

type TemplateOption = { value: string; label: string; builtin: boolean };

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
  isSuperAdmin,
  currentUserId,
}: {
  member: Member;
  isSuperAdmin: boolean;
  currentUserId: string;
}) {
  const router = useRouter();
  const isSuperAdminMember = member.company_role === "super_admin";

  const [availableTemplates, setAvailableTemplates] = useState<TemplateOption[]>([]);
  const [currentTemplate, setCurrentTemplate] = useState<string>("");
  const [templateLevels, setTemplateLevels] = useState<Record<string, PermissionLevel>>({});
  const [levels, setLevels] = useState<Record<string, PermissionLevel>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");

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

  // Initial load: templates, current template, levels
  useEffect(() => {
    if (isSuperAdminMember) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError("");
    fetch(`/api/company/members/${member.id}/tools`)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Failed to load");
        return r.json();
      })
      .then((data) => {
        if (cancelled) return;
        setAvailableTemplates(data.availableTemplates || []);
        setCurrentTemplate(data.currentTemplate || "");
        setTemplateLevels(data.templateLevels || {});
        setLevels(data.levels || {});
      })
      .catch((e) => {
        if (!cancelled) setLoadError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [member.id, isSuperAdminMember]);

  const canEdit =
    (isSuperAdmin || member.company_role === "member") &&
    !isSuperAdminMember &&
    member.id !== currentUserId;

  const isCustom = useMemo(() => {
    if (!templateLevels || Object.keys(templateLevels).length === 0) return false;
    for (const tool of TEMPLATE_TOOLS) {
      if (levels[tool] !== templateLevels[tool]) return true;
    }
    return false;
  }, [levels, templateLevels]);

  const currentTemplateLabel = useMemo(() => {
    const opt = availableTemplates.find((t) => t.value === currentTemplate);
    return opt ? opt.label : currentTemplate;
  }, [availableTemplates, currentTemplate]);

  async function handleTemplateChange(nextTemplate: string) {
    if (nextTemplate === currentTemplate) return;
    setSaved(false);
    setError("");
    // Load the new template's baseline levels and replace the matrix with them.
    try {
      const res = await fetch(
        `/api/company/permission-templates?category=company&type=${encodeURIComponent(nextTemplate)}`
      );
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Failed to load template");
      const data = await res.json();
      const newLevels = (data.levels || {}) as Record<string, PermissionLevel>;
      setCurrentTemplate(nextTemplate);
      setTemplateLevels(newLevels);
      setLevels({ ...newLevels });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to switch template");
    }
  }

  function setLevel(tool: string, level: PermissionLevel) {
    setSaved(false);
    setLevels((prev) => ({ ...prev, [tool]: level }));
  }

  function resetToTemplate() {
    setSaved(false);
    setLevels({ ...templateLevels });
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    setSaved(false);

    const res = await fetch(`/api/company/members/${member.id}/tools`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ template: currentTemplate, levels }),
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
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-gray-900">Tool Access</h2>
              {!isSuperAdminMember && !loading && (
                <span
                  className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                    isCustom ? "bg-orange-50 text-orange-700" : "bg-gray-100 text-gray-700"
                  }`}
                  title={
                    isCustom
                      ? `Customized from the ${currentTemplateLabel} template`
                      : `On the ${currentTemplateLabel} template`
                  }
                >
                  {isCustom ? "Custom" : currentTemplateLabel}
                </span>
              )}
            </div>
            {isSuperAdminMember && (
              <span className="text-xs text-gray-400">Super Admins have full access</span>
            )}
          </div>
          {!isSuperAdminMember && (
            <p className="text-xs text-gray-400 mb-5">
              {canEdit
                ? "Choose a permission template, then adjust any tool individually. Saving will persist the customized levels."
                : "You don't have permission to change this user's tool access."}
            </p>
          )}

          {isSuperAdminMember ? (
            <p className="text-sm text-gray-500 py-4 text-center">
              Super Admins always have access to all tools.
            </p>
          ) : (
            <>
              {/* Template selector */}
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Permission Template
                </label>
                <select
                  value={currentTemplate}
                  onChange={(e) => handleTemplateChange(e.target.value)}
                  disabled={!canEdit || loading}
                  className="w-full sm:w-1/2 px-3 py-2 border border-gray-200 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:bg-gray-50 disabled:text-gray-500"
                >
                  {availableTemplates.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                  {currentTemplate && !availableTemplates.some((t) => t.value === currentTemplate) && (
                    <option value={currentTemplate}>{currentTemplate}</option>
                  )}
                </select>
                {canEdit && isCustom && (
                  <button
                    onClick={resetToTemplate}
                    className="ml-3 text-xs font-medium text-gray-400 hover:text-gray-700 transition-colors"
                  >
                    Reset to template
                  </button>
                )}
              </div>

              {loading ? (
                <p className="text-sm text-gray-400 py-6 text-center">Loading…</p>
              ) : loadError ? (
                <p className="text-sm text-red-600 py-6 text-center">{loadError}</p>
              ) : (
                <div className="border border-gray-100 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-xs font-medium text-gray-500">
                        <th className="text-left px-3 py-2 w-1/3">Tool</th>
                        {PERMISSION_LEVELS.map((lvl) => (
                          <th key={lvl} className="text-center px-3 py-2">
                            {PERMISSION_LEVEL_LABEL[lvl]}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {TEMPLATE_TOOLS.map((tool, i) => {
                        const current = levels[tool] ?? "none";
                        return (
                          <tr
                            key={tool}
                            className={i % 2 === 0 ? "bg-white" : "bg-gray-50/40"}
                          >
                            <td className="px-3 py-2 text-gray-900">{tool}</td>
                            {PERMISSION_LEVELS.map((lvl) => (
                              <td key={lvl} className="text-center px-3 py-2">
                                <input
                                  type="radio"
                                  name={`tool-${tool}`}
                                  checked={current === lvl}
                                  disabled={!canEdit}
                                  onChange={() => setLevel(tool, lvl)}
                                  className="cursor-pointer accent-orange-500 disabled:cursor-not-allowed"
                                />
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>

        {/* Save button */}
        {canEdit && !isSuperAdminMember && (
          <div className="mt-5 flex items-center justify-end gap-3">
            {error && <p className="text-xs text-red-600">{error}</p>}
            {saved && <p className="text-xs text-green-600">Saved</p>}
            <button
              onClick={handleSave}
              disabled={saving || loading}
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
