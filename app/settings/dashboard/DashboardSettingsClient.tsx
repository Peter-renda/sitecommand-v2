"use client";

import { useState } from "react";
import { CheckCircle } from "lucide-react";

export default function DashboardSettingsClient() {
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSuccess("");
    await new Promise((r) => setTimeout(r, 400));
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
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#D4500A] hover:bg-[#B5450A] text-white text-sm font-semibold rounded-md shadow-sm transition-colors"
        >
          <span aria-hidden>▶</span> Start Walkthrough
        </a>
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-6 py-5 border-b border-gray-100">
          <h2 className="text-sm font-medium text-gray-900">Open Items</h2>
          <p className="text-xs text-gray-500 mt-0.5">Choose which item types appear in your open items list.</p>
        </div>

        <form onSubmit={handleSave}>
          <div className="px-6 py-5 space-y-3">
            {[
              { id: "rfis", label: "RFIs" },
              { id: "submittals", label: "Submittals" },
              { id: "assigned_invoices", label: "Assigned Invoices" },
              { id: "change_events", label: "Change Events" },
            ].map(({ id, label }) => (
              <label key={id} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  defaultChecked
                  className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                />
                <span className="text-sm text-gray-700">{label}</span>
              </label>
            ))}
          </div>

          <div className="px-6 pb-5 flex items-center gap-4">
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
    </div>
  );
}
