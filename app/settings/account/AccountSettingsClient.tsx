"use client";

import { useState, useEffect } from "react";
import { CheckCircle } from "lucide-react";

export default function AccountSettingsClient({
  username,
  email,
}: {
  username: string;
  email: string;
}) {
  const [tab, setTab] = useState<"password" | "phone">("password");

  // Password fields
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Phone field
  const [phone, setPhone] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fetch("/api/user/profile")
      .then((r) => r.json())
      .then((data) => setPhone(data.phone ?? ""))
      .catch(() => {});
  }, []);

  function switchTab(t: typeof tab) {
    setTab(t);
    setError("");
    setSuccess("");
  }

  async function handleSavePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) { setError("New passwords do not match"); return; }
    if (newPassword.length < 6) { setError("Password must be at least 6 characters"); return; }
    setSaving(true); setError(""); setSuccess("");
    const res = await fetch("/api/user/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data.error ?? "Failed to update password"); return; }
    setSuccess("Password updated successfully");
    setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
  }

  async function handleSavePhone(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(""); setSuccess("");
    const res = await fetch("/api/user/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data.error ?? "Failed to update phone"); return; }
    setSuccess("Phone number updated");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-[28px] leading-tight text-[color:var(--ink)]">Account</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your login credentials and contact info.</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        {/* User info strip */}
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-100 rounded-t-xl">
          <p className="text-xs text-gray-500">
            <span className="font-medium text-gray-700">Username:</span> {username}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            <span className="font-medium text-gray-700">Email:</span> {email}
          </p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 px-6">
          <button
            onClick={() => switchTab("password")}
            className={`py-3 text-xs font-medium mr-5 border-b-2 transition-colors ${
              tab === "password" ? "border-gray-900 text-gray-900" : "border-transparent text-gray-400 hover:text-gray-700"
            }`}
          >
            Change Password
          </button>
          <button
            onClick={() => switchTab("phone")}
            className={`py-3 text-xs font-medium border-b-2 transition-colors ${
              tab === "phone" ? "border-gray-900 text-gray-900" : "border-transparent text-gray-400 hover:text-gray-700"
            }`}
          >
            Phone Number
          </button>
        </div>

        <div className="px-6 py-5">
          {tab === "password" && (
            <form onSubmit={handleSavePassword} className="space-y-4 max-w-sm">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Current Password</label>
                <input
                  type="password" required value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">New Password</label>
                <input
                  type="password" required value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Confirm New Password</label>
                <input
                  type="password" required value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                  className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>
              {error && <p className="text-xs text-red-600">{error}</p>}
              {success && (
                <p className="flex items-center gap-1.5 text-xs text-green-600">
                  <CheckCircle className="w-3.5 h-3.5" /> {success}
                </p>
              )}
              <button
                type="submit" disabled={saving}
                className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-700 disabled:opacity-50 transition-colors"
              >
                {saving ? "Saving..." : "Update Password"}
              </button>
            </form>
          )}

          {tab === "phone" && (
            <form onSubmit={handleSavePhone} className="space-y-4 max-w-sm">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Phone Number</label>
                <input
                  type="tel" value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. (555) 123-4567"
                  className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>
              {error && <p className="text-xs text-red-600">{error}</p>}
              {success && (
                <p className="flex items-center gap-1.5 text-xs text-green-600">
                  <CheckCircle className="w-3.5 h-3.5" /> {success}
                </p>
              )}
              <button
                type="submit" disabled={saving}
                className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-700 disabled:opacity-50 transition-colors"
              >
                {saving ? "Saving..." : "Save Phone Number"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
