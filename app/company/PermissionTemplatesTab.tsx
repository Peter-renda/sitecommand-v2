"use client";

import { useEffect, useState } from "react";
import {
  COMPANY_USER_TYPES,
  INVITEE_USER_TYPES,
  PERMISSION_LEVELS,
  PERMISSION_LEVEL_LABEL,
  TEMPLATE_TOOLS,
  type PermissionLevel,
  type TemplateCategory,
  type TemplateUserType,
} from "@/lib/permission-templates";

export default function PermissionTemplatesTab({ canEdit }: { canEdit: boolean }) {
  const [category, setCategory] = useState<TemplateCategory>("company");
  const [userType, setUserType] = useState<TemplateUserType>("super_admin");
  const [levels, setLevels] = useState<Record<string, PermissionLevel>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTypeName, setNewTypeName] = useState("");

  function handleCategoryChange(next: TemplateCategory) {
    setCategory(next);
    setUserType(next === "company" ? "super_admin" : "subcontractor");
  }

  // Load template whenever (category, user type) changes.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setSaved(false);

    fetch(`/api/company/permission-templates?category=${category}&type=${userType}`)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error || "Failed to load");
        return r.json();
      })
      .then((data) => {
        if (cancelled) return;
        setLevels(data.levels || {});
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [category, userType]);

  const userTypeOptions = category === "company" ? COMPANY_USER_TYPES : INVITEE_USER_TYPES;
  const createOptionValue = "__create_new_template__";

  function setLevel(tool: string, level: PermissionLevel) {
    setSaved(false);
    setLevels((prev) => ({ ...prev, [tool]: level }));
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    setSaved(false);

    const res = await fetch("/api/company/permission-templates", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category, user_type: userType, levels }),
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

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl border border-gray-100 px-6 py-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-1">Permission Templates</h2>
        <p className="text-xs text-gray-400 mb-5">
          Set default tool permissions applied to new users by category and user type.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => handleCategoryChange(e.target.value as TemplateCategory)}
              className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900"
            >
              <option value="company">Company</option>
              <option value="invitee">Invitee</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">User Type</label>
            <select
              value={userType}
              onChange={(e) => {
                if (e.target.value === createOptionValue) {
                  setShowCreateModal(true);
                  return;
                }
                setUserType(e.target.value as TemplateUserType);
              }}
              className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900"
            >
              {userTypeOptions.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
              {!userTypeOptions.some((t) => t.value === userType) && (
                <option value={userType}>{userType.replace(/_/g, " ")}</option>
              )}
              <option value={createOptionValue}>Create new template</option>
            </select>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-gray-400 py-6 text-center">Loading template…</p>
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

        {showCreateModal && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center px-4">
            <div className="w-full max-w-xl bg-white rounded-xl border border-gray-200 shadow-xl p-5">
              <h3 className="text-base font-semibold text-gray-900">Create New Template</h3>
              <p className="mt-1 text-xs text-gray-500">Enter a user type name and save permission levels for each tool.</p>

              <label className="block text-xs font-medium text-gray-700 mt-4 mb-1">User Type Name</label>
              <input
                value={newTypeName}
                onChange={(e) => setNewTypeName(e.target.value)}
                placeholder="Ex: Estimator"
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />

              <div className="mt-5 flex items-center justify-end gap-2">
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewTypeName("");
                  }}
                  className="px-3 py-2 text-sm border border-gray-200 rounded-md"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    const normalized = newTypeName.trim().toLowerCase().replace(/\s+/g, "_");
                    if (!normalized) {
                      setError("Please enter a user type name");
                      return;
                    }
                    setUserType(normalized);
                    setLevels(Object.fromEntries(TEMPLATE_TOOLS.map((tool) => [tool, "none"])) as Record<string, PermissionLevel>);
                    setShowCreateModal(false);
                    setNewTypeName("");
                  }}
                  className="px-3 py-2 text-sm bg-gray-900 text-white rounded-md"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        )}

        {canEdit && (
          <div className="mt-5 flex items-center justify-end gap-3">
            {error && <p className="text-xs text-red-600">{error}</p>}
            {saved && <p className="text-xs text-green-600">Saved</p>}
            <button
              onClick={handleSave}
              disabled={saving || loading}
              className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save template"}
            </button>
          </div>
        )}
        {!canEdit && (
          <p className="mt-4 text-xs text-gray-400">
            Only the company Super Admin can change permission templates.
          </p>
        )}
      </div>
    </div>
  );
}
