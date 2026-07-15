"use client";

import { useEffect, useState } from "react";
import { CheckCircle } from "lucide-react";
import {
  DEFAULT_DASHBOARD_PREFS,
  DashboardPreferences,
  OPEN_ITEM_TYPES,
  OPEN_ITEM_TYPE_LABELS,
  loadDashboardPreferences,
  saveDashboardPreferences,
} from "@/lib/dashboard-preferences";

// This page and the dashboard walkthrough are two views over the same
// preferences (lib/dashboard-preferences). Every question asked in the
// walkthrough appears here and vice versa, and both persist to the same store.
export default function DashboardSettingsClient() {
  const [prefs, setPrefs] = useState<DashboardPreferences>(DEFAULT_DASHBOARD_PREFS);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");

  useEffect(() => {
    setPrefs(loadDashboardPreferences());
    // Stay in sync if the walkthrough (or another tab) changes preferences.
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<DashboardPreferences>).detail;
      if (detail) setPrefs(detail);
    };
    window.addEventListener("dashboard-prefs-changed", handler);
    return () => window.removeEventListener("dashboard-prefs-changed", handler);
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSuccess("");
    saveDashboardPreferences(prefs);
    await new Promise((r) => setTimeout(r, 250));
    setSaving(false);
    setSuccess("Dashboard settings saved");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-[28px] leading-tight text-[color:var(--ink)]">Dashboard Settings</h1>
          <p className="text-sm text-gray-500 mt-1">Customize what appears on your dashboard.</p>
        </div>
        <a
          href="/dashboard?walkthrough=1"
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#2563EB] hover:bg-[#B5450A] text-white text-sm font-semibold rounded-md shadow-sm transition-colors"
        >
          <span aria-hidden>▶</span> Start Walkthrough
        </a>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-6 py-5 border-b border-gray-100">
            <h2 className="text-sm font-medium text-gray-900">Items that need your attention</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Pick which record types should count as open items on your dashboard.
            </p>
          </div>
          <div className="px-6 py-5 space-y-3">
            {OPEN_ITEM_TYPES.map((t) => (
              <label key={t} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={prefs.attentionTypes[t]}
                  onChange={() =>
                    setPrefs((p) => ({
                      ...p,
                      attentionTypes: { ...p.attentionTypes, [t]: !p.attentionTypes[t] },
                    }))
                  }
                  className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                />
                <span className="text-sm text-gray-700">{OPEN_ITEM_TYPE_LABELS[t]}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-6 py-5 border-b border-gray-100">
            <h2 className="text-sm font-medium text-gray-900">&ldquo;While you were away&rdquo; section</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Hide this section if you don&rsquo;t want a feed of recent updates on your portfolio dashboard.
            </p>
          </div>
          <div className="px-6 py-5">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={prefs.showWhileAway}
                onChange={() => setPrefs((p) => ({ ...p, showWhileAway: !p.showWhileAway }))}
                className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
              />
              <span className="text-sm text-gray-700">Show &ldquo;While you were away&rdquo;</span>
            </label>
            <p className="text-xs text-gray-400 mt-1 ml-7">Recent activity since your last login</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-6 py-5 border-b border-gray-100">
            <h2 className="text-sm font-medium text-gray-900">Portfolio snapshot — total value</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Hide the total portfolio value on the focus card if you don&rsquo;t want it visible to people glancing at
              your screen.
            </p>
          </div>
          <div className="px-6 py-5">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={prefs.showPortfolioTotal}
                onChange={() => setPrefs((p) => ({ ...p, showPortfolioTotal: !p.showPortfolioTotal }))}
                className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
              />
              <span className="text-sm text-gray-700">Show total portfolio value</span>
            </label>
            <p className="text-xs text-gray-400 mt-1 ml-7">Top-right of the focus card</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving..." : "Save"}
          </button>
          {success && (
            <p className="flex items-center gap-1.5 text-xs text-green-600">
              <CheckCircle className="w-3.5 h-3.5" /> {success}
            </p>
          )}
        </div>
      </form>
    </div>
  );
}
