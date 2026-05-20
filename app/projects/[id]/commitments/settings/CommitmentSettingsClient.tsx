"use client";

import { useEffect, useState } from "react";
import ProjectNav from "@/components/ProjectNav";

type ToolLevel = "none" | "read_only" | "standard" | "admin";

type PermissionRow = {
  user_id: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  project_role: string;
  default_level: ToolLevel;
  level: ToolLevel;
  overridden: boolean;
};

const LEVEL_OPTIONS: { value: ToolLevel; label: string }[] = [
  { value: "none", label: "None" },
  { value: "read_only", label: "Read Only" },
  { value: "standard", label: "Standard" },
  { value: "admin", label: "Admin" },
];

function displayName(r: PermissionRow) {
  const full = [r.first_name, r.last_name].filter(Boolean).join(" ");
  return full || r.username || r.email || r.user_id;
}

export default function CommitmentSettingsClient({
  projectId,
  username,
}: {
  projectId: string;
  role: string;
  username: string;
}) {
  const [alwaysEditable, setAlwaysEditable] = useState(false);
  const [ssovByDefault, setSsovByDefault] = useState(false);
  const [enableFinancialMarkup, setEnableFinancialMarkup] = useState(false);
  const [changeOrderTiers, setChangeOrderTiers] = useState(1);
  const [allowStandardUsersCreateCcos, setAllowStandardUsersCreateCcos] = useState(false);
  const [allowStandardUsersCreatePcos, setAllowStandardUsersCreatePcos] = useState(false);
  const [enableFieldInitiatedCos, setEnableFieldInitiatedCos] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string>("");

  const [permissions, setPermissions] = useState<PermissionRow[]>([]);
  const [permsAllowed, setPermsAllowed] = useState(true);
  const [permsLoading, setPermsLoading] = useState(true);
  const [savingUser, setSavingUser] = useState<string>("");

  useEffect(() => {
    fetch(`/api/projects/${projectId}/commitment-settings`)
      .then((r) => r.json())
      .then((data) => {
        setAlwaysEditable(!!data?.enable_always_editable_sov);
        setSsovByDefault(!!data?.enable_ssov_by_default);
        setEnableFinancialMarkup(!!data?.enable_financial_markup);
        setChangeOrderTiers(data?.number_of_change_order_tiers ?? 1);
        setAllowStandardUsersCreateCcos(!!data?.allow_standard_users_create_ccos);
        setAllowStandardUsersCreatePcos(!!data?.allow_standard_users_create_pcos);
        setEnableFieldInitiatedCos(!!data?.enable_field_initiated_change_orders);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    fetch(`/api/projects/${projectId}/commitments/permissions`)
      .then(async (r) => {
        if (r.status === 403) {
          setPermsAllowed(false);
          setPermsLoading(false);
          return;
        }
        const data = await r.json();
        setPermissions(Array.isArray(data) ? data : []);
        setPermsLoading(false);
      })
      .catch(() => setPermsLoading(false));
  }, [projectId]);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/commitment-settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enable_always_editable_sov: alwaysEditable,
          enable_ssov_by_default: ssovByDefault,
          enable_financial_markup: enableFinancialMarkup,
          number_of_change_order_tiers: changeOrderTiers,
          allow_standard_users_create_ccos: allowStandardUsersCreateCcos,
          allow_standard_users_create_pcos: allowStandardUsersCreatePcos,
          enable_field_initiated_change_orders: enableFieldInitiatedCos,
        }),
      });
      if (res.ok) setSavedAt(new Date().toLocaleTimeString());
    } finally {
      setSaving(false);
    }
  }

  async function updateLevel(row: PermissionRow, nextLevel: ToolLevel) {
    setSavingUser(row.user_id);
    const overrideValue = nextLevel === row.default_level ? null : nextLevel;
    try {
      const res = await fetch(`/api/projects/${projectId}/commitments/permissions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: row.user_id, level: overrideValue }),
      });
      if (res.ok) {
        setPermissions((prev) =>
          prev.map((p) =>
            p.user_id === row.user_id
              ? { ...p, level: nextLevel, overridden: overrideValue !== null }
              : p
          )
        );
      }
    } finally {
      setSavingUser("");
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAF7] flex items-center justify-center">
        <p className="text-sm text-gray-400">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAF7]">
      <header className="bg-[#FAFAF7] border-b border-black/[0.06] px-6 h-14 flex items-center justify-between">
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
            href={`/projects/${projectId}/commitments`}
            className="text-sm text-gray-400 hover:text-gray-700"
          >
            ← Commitments
          </a>
          <span className="text-gray-200">/</span>
          <h1 className="font-display text-[18px] leading-tight text-[color:var(--ink)]">Advanced Settings</h1>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="px-4 py-1.5 text-sm font-medium text-white bg-gray-900 rounded hover:bg-gray-700 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>

      <div className="max-w-3xl mx-auto px-8 py-8">
        <div className="py-6 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Contract Configuration</h2>
          <div className="space-y-4">
            <label className="block text-sm text-gray-700">
              <span className="font-medium">Number of Commitment Change Order Tiers</span>
              <select
                value={changeOrderTiers}
                onChange={(e) => {
                  const next = Number(e.target.value) || 1;
                  setChangeOrderTiers(next);
                  if (next === 1) {
                    setAllowStandardUsersCreatePcos(false);
                    setEnableFieldInitiatedCos(false);
                  } else {
                    setAllowStandardUsersCreateCcos(false);
                  }
                }}
                className="mt-1 block w-56 border border-gray-300 rounded px-2 py-1.5 text-sm"
              >
                <option value={1}>1 Tier</option>
                <option value={2}>2 Tier</option>
                <option value={3}>3 Tier</option>
              </select>
              <span className="block text-xs text-gray-500 mt-1">
                Set this before creating change orders. 1-tier supports direct CCOs. 2- and 3-tier workflows require potential change orders.
              </span>
            </label>

            {changeOrderTiers === 1 ? (
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowStandardUsersCreateCcos}
                  onChange={(e) => setAllowStandardUsersCreateCcos(e.target.checked)}
                  className="w-4 h-4 mt-0.5 rounded border-gray-300 text-gray-900"
                />
                <span className="text-sm text-gray-700">
                  Allow Standard Level Users to Create CCOs
                </span>
              </label>
            ) : (
              <>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowStandardUsersCreatePcos}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setAllowStandardUsersCreatePcos(checked);
                      if (!checked) setEnableFieldInitiatedCos(false);
                    }}
                    className="w-4 h-4 mt-0.5 rounded border-gray-300 text-gray-900"
                  />
                  <span className="text-sm text-gray-700">
                    Allow Standard Level Users to Create PCOs
                  </span>
                </label>

                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enableFieldInitiatedCos}
                    disabled={!allowStandardUsersCreatePcos}
                    onChange={(e) => setEnableFieldInitiatedCos(e.target.checked)}
                    className="w-4 h-4 mt-0.5 rounded border-gray-300 text-gray-900 disabled:opacity-50"
                  />
                  <span className="text-sm text-gray-700">
                    Enable Field-Initiated Change Orders
                    <span className="block text-xs text-gray-500 mt-0.5">
                      Lets collaborators submit commitment change requests without direct access to the Change Events tool.
                    </span>
                  </span>
                </label>
              </>
            )}
          </div>
        </div>

        <div className="py-6 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Schedule of Values</h2>
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={alwaysEditable}
              onChange={(e) => setAlwaysEditable(e.target.checked)}
              className="w-4 h-4 mt-0.5 rounded border-gray-300 text-gray-900"
            />
            <span className="text-sm text-gray-700">
              Enable Always Editable Schedule of Values
              <span className="block text-xs text-gray-500 mt-0.5">
                When turned on, users with edit permission can modify a commitment&apos;s SOV in any
                status. When off, SOVs can only be edited while the commitment is in Draft.
              </span>
            </span>
          </label>
        </div>

        <div className="py-6 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Default Contract Settings</h2>
          <div className="space-y-4">
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={ssovByDefault}
                onChange={(e) => setSsovByDefault(e.target.checked)}
                className="w-4 h-4 mt-0.5 rounded border-gray-300 text-gray-900"
              />
              <span className="text-sm text-gray-700">
                Enable Subcontractor SOV by Default
                <span className="block text-xs text-gray-500 mt-0.5">
                  When turned on, the Subcontractor SOV tab is enabled by default on all new purchase orders and subcontracts. Only applies to contracts using the Amount Based accounting method. Individual contracts can still be configured separately.
                </span>
              </span>
            </label>
          </div>
          {savedAt && <p className="mt-3 text-[11px] text-green-600">Saved at {savedAt}</p>}
        </div>

        <div className="py-6 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Financial Markup</h2>
          <p className="text-xs text-gray-500 mb-3">
            When enabled, users with Admin access can enable financial markup per commitment and add markup rules to change orders on that commitment.
          </p>
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={enableFinancialMarkup}
              onChange={(e) => setEnableFinancialMarkup(e.target.checked)}
              className="w-4 h-4 mt-0.5 rounded border-gray-300 text-gray-900"
            />
            <span className="text-sm text-gray-700">
              Enable Financial Markup on Commitment Change Orders
              <span className="block text-xs text-gray-500 mt-0.5">
                Unlocks the Financial Markup toggle on individual commitments. After applying markup to a change order, that change order cannot be added to a subcontractor invoice.
              </span>
            </span>
          </label>
        </div>

        <div className="py-6">
          <h2 className="text-base font-semibold text-gray-900 mb-1">Tool Permissions</h2>
          <p className="text-xs text-gray-500 mb-4">
            Per-user level for the Commitments tool. Each user inherits a level from their
            project role; set an override to promote or restrict them.
          </p>

          {!permsAllowed ? (
            <p className="text-sm text-gray-500">
              You need Admin on the Commitments tool to manage permissions.
            </p>
          ) : permsLoading ? (
            <p className="text-sm text-gray-400">Loading…</p>
          ) : permissions.length === 0 ? (
            <p className="text-sm text-gray-500">No members on this project yet.</p>
          ) : (
            <div className="border border-gray-200 rounded">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr className="text-left text-xs font-medium text-gray-600 uppercase">
                    <th className="px-3 py-2">User</th>
                    <th className="px-3 py-2">Project Role</th>
                    <th className="px-3 py-2">Commitments Level</th>
                    <th className="px-3 py-2 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {permissions.map((row) => (
                    <tr key={row.user_id} className="border-b border-gray-100 last:border-0">
                      <td className="px-3 py-2">
                        <div className="text-gray-900">{displayName(row)}</div>
                        <div className="text-xs text-gray-500">{row.email}</div>
                      </td>
                      <td className="px-3 py-2 text-gray-700">{row.project_role}</td>
                      <td className="px-3 py-2">
                        <select
                          value={row.level}
                          onChange={(e) => updateLevel(row, e.target.value as ToolLevel)}
                          disabled={savingUser === row.user_id}
                          className="text-sm border border-gray-300 rounded px-2 py-1"
                        >
                          {LEVEL_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                              {o.value === row.default_level ? " (default)" : ""}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        {row.overridden && (
                          <span className="text-[10px] text-orange-600 uppercase tracking-wide">
                            override
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
