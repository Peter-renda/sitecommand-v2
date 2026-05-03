"use client";

import { useState, useEffect } from "react";
import { Copy, Check, Trash2, Plus, X, Eye, EyeOff, ToggleLeft, ToggleRight } from "lucide-react";

type ApiKey = {
  id: string;
  name: string;
  key_prefix: string;
  last_used_at: string | null;
  created_at: string;
};

type Webhook = {
  id: string;
  name: string;
  url: string;
  events: string[];
  is_active: boolean;
  notify_email: string | null;
  created_at: string;
};

const ALL_EVENTS = [
  { value: "project.created", label: "project.created", desc: "A new project is created" },
  { value: "project.updated", label: "project.updated", desc: "A project is updated" },
  { value: "rfi.created", label: "rfi.created", desc: "A new RFI is submitted" },
  { value: "rfi.updated", label: "rfi.updated", desc: "An RFI is updated" },
  { value: "submittal.created", label: "submittal.created", desc: "A new submittal is created" },
  { value: "document.uploaded", label: "document.uploaded", desc: "A document is uploaded" },
  { value: "daily_log.created", label: "daily_log.created", desc: "A daily log entry is created" },
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function SecretRevealBox({ value, label }: { value: string; label: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
      <p className="text-xs font-medium text-amber-800 mb-2">
        {label} — this will only be shown once. Copy it now.
      </p>
      <div className="flex items-center gap-2">
        <code className="flex-1 font-mono text-xs bg-white border border-amber-200 rounded px-2.5 py-1.5 text-gray-800 break-all">
          {show ? value : value.slice(0, 12) + "••••••••••••••••••••••••"}
        </code>
        <button
          onClick={() => setShow((v) => !v)}
          className="shrink-0 text-gray-400 hover:text-gray-700"
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
        <CopyButton text={value} />
      </div>
    </div>
  );
}

// ─── API Keys Tab ─────────────────────────────────────────────────────────────

export function ApiKeysTab() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function loadKeys() {
    setLoading(true);
    const res = await fetch("/api/developer/keys");
    if (res.ok) setKeys(await res.json());
    setLoading(false);
  }

  useEffect(() => { loadKeys(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError("");
    const res = await fetch("/api/developer/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newKeyName }),
    });
    const data = await res.json();
    setCreating(false);
    if (!res.ok) { setError(data.error); return; }
    setCreatedKey(data.key);
    setKeys((prev) => [{ id: data.id, name: data.name, key_prefix: data.key_prefix, last_used_at: null, created_at: data.created_at }, ...prev]);
  }

  async function handleRevoke(keyId: string) {
    if (!confirm("Revoke this API key? Any integrations using it will stop working immediately.")) return;
    const res = await fetch(`/api/developer/keys/${keyId}`, { method: "DELETE" });
    if (res.ok) setKeys((prev) => prev.filter((k) => k.id !== keyId));
  }

  function closeModal() {
    setShowModal(false);
    setNewKeyName("");
    setCreatedKey(null);
    setError("");
  }

  function formatDate(d: string | null) {
    if (!d) return "Never";
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">API Keys</h2>
          <p className="text-xs text-gray-500 mt-0.5">Use API keys to authenticate programmatic access to your company data.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-gray-900 text-white text-xs font-medium rounded-md hover:bg-gray-700 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Create API Key
        </button>
      </div>

      {loading ? (
        <div className="text-xs text-gray-400 py-8 text-center">Loading...</div>
      ) : keys.length === 0 ? (
        <div className="border border-dashed border-gray-200 rounded-xl py-10 text-center">
          <p className="text-sm text-gray-400">No API keys yet</p>
          <p className="text-xs text-gray-400 mt-1">Create one to get started with the API.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-4 py-3">Name</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-4 py-3">Key Prefix</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-4 py-3">Last Used</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-4 py-3">Created</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {keys.map((key) => (
                <tr key={key.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{key.name}</td>
                  <td className="px-4 py-3">
                    <code className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-700">{key.key_prefix}...</code>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{formatDate(key.last_used_at)}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{formatDate(key.created_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleRevoke(key.id)}
                      className="text-xs text-red-500 hover:text-red-700 font-medium transition-colors"
                    >
                      Revoke
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900">Create API Key</h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-6 py-5">
              {!createdKey ? (
                <form onSubmit={handleCreate} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Key Name</label>
                    <input
                      type="text"
                      required
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                      placeholder="e.g. Production Integration"
                      className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                    />
                    <p className="text-xs text-gray-400 mt-1">Give this key a descriptive name so you can identify it later.</p>
                  </div>
                  {error && <p className="text-xs text-red-600">{error}</p>}
                  <div className="flex gap-3 pt-1">
                    <button type="button" onClick={closeModal} className="flex-1 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50">
                      Cancel
                    </button>
                    <button type="submit" disabled={creating} className="flex-1 py-2 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-700 disabled:opacity-50">
                      {creating ? "Creating..." : "Create Key"}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-gray-700">Your API key has been created successfully.</p>
                  <SecretRevealBox value={createdKey} label="API Key" />
                  <button
                    onClick={closeModal}
                    className="w-full py-2 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-700"
                  >
                    Done
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Webhooks Tab ─────────────────────────────────────────────────────────────

export function WebhooksTab() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [notifyEmail, setNotifyEmail] = useState("");
  const [creating, setCreating] = useState(false);
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function loadWebhooks() {
    setLoading(true);
    const res = await fetch("/api/developer/webhooks");
    if (res.ok) setWebhooks(await res.json());
    setLoading(false);
  }

  useEffect(() => { loadWebhooks(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError("");
    const res = await fetch("/api/developer/webhooks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, url, events: selectedEvents, notify_email: notifyEmail || null }),
    });
    const data = await res.json();
    setCreating(false);
    if (!res.ok) { setError(data.error); return; }
    setCreatedSecret(data.secret);
    setWebhooks((prev) => [{
      id: data.id,
      name: data.name,
      url: data.url,
      events: data.events,
      is_active: data.is_active,
      notify_email: notifyEmail || null,
      created_at: data.created_at,
    }, ...prev]);
  }

  async function handleToggle(webhookId: string, is_active: boolean) {
    const res = await fetch(`/api/developer/webhooks/${webhookId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active }),
    });
    if (res.ok) {
      const updated = await res.json();
      setWebhooks((prev) => prev.map((w) => w.id === webhookId ? { ...w, is_active: updated.is_active } : w));
    }
  }

  async function handleDelete(webhookId: string) {
    if (!confirm("Delete this webhook? Events will no longer be sent to it.")) return;
    const res = await fetch(`/api/developer/webhooks/${webhookId}`, { method: "DELETE" });
    if (res.ok) setWebhooks((prev) => prev.filter((w) => w.id !== webhookId));
  }

  function toggleEvent(event: string) {
    setSelectedEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    );
  }

  function closeModal() {
    setShowModal(false);
    setName("");
    setUrl("");
    setSelectedEvents([]);
    setNotifyEmail("");
    setCreatedSecret(null);
    setError("");
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Webhooks</h2>
          <p className="text-xs text-gray-500 mt-0.5">Receive real-time HTTP notifications when events happen in your projects.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-gray-900 text-white text-xs font-medium rounded-md hover:bg-gray-700 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Webhook
        </button>
      </div>

      {loading ? (
        <div className="text-xs text-gray-400 py-8 text-center">Loading...</div>
      ) : webhooks.length === 0 ? (
        <div className="border border-dashed border-gray-200 rounded-xl py-10 text-center">
          <p className="text-sm text-gray-400">No webhooks configured</p>
          <p className="text-xs text-gray-400 mt-1">Add a webhook to receive event notifications.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {webhooks.map((wh) => (
            <div key={wh.id} className="bg-white border border-gray-200 rounded-xl px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-gray-900">{wh.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${wh.is_active ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {wh.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 font-mono truncate mb-2">{wh.url}</p>
                  <div className="flex flex-wrap gap-1">
                    {wh.events.map((ev) => (
                      <span key={ev} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-mono">
                        {ev}
                      </span>
                    ))}
                  </div>
                  {wh.notify_email && (
                    <p className="text-xs text-gray-400 mt-1.5">
                      Email notifications → <span className="text-gray-600">{wh.notify_email}</span>
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleToggle(wh.id, !wh.is_active)}
                    className="text-gray-400 hover:text-gray-700 transition-colors"
                    title={wh.is_active ? "Deactivate" : "Activate"}
                  >
                    {wh.is_active
                      ? <ToggleRight className="w-5 h-5 text-orange-500" />
                      : <ToggleLeft className="w-5 h-5" />
                    }
                  </button>
                  <button
                    onClick={() => handleDelete(wh.id)}
                    className="text-gray-400 hover:text-red-600 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4 py-8">
          <div className="bg-white rounded-xl w-full max-w-md shadow-xl flex flex-col max-h-full">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
              <h3 className="text-sm font-semibold text-gray-900">Add Webhook</h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-6 py-5 overflow-y-auto">
              {!createdSecret ? (
                <form onSubmit={handleCreate} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Name</label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Slack Notifications"
                      className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Endpoint URL</label>
                    <input
                      type="url"
                      required
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="https://your-server.com/webhook"
                      className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-2">Events to Subscribe</label>
                    <div className="space-y-2">
                      {ALL_EVENTS.map((ev) => (
                        <label key={ev.value} className="flex items-start gap-2.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedEvents.includes(ev.value)}
                            onChange={() => toggleEvent(ev.value)}
                            className="mt-0.5 accent-gray-900"
                          />
                          <div>
                            <code className="text-xs font-mono text-gray-800">{ev.label}</code>
                            <p className="text-xs text-gray-400">{ev.desc}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Email Notifications <span className="text-gray-400 font-normal">(optional)</span>
                    </label>
                    <input
                      type="email"
                      value={notifyEmail}
                      onChange={(e) => setNotifyEmail(e.target.value)}
                      placeholder="alerts@yourcompany.com"
                      className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                    />
                    <p className="text-xs text-gray-400 mt-1">Also send an email when this webhook fires.</p>
                  </div>
                  {error && <p className="text-xs text-red-600">{error}</p>}
                  <div className="flex gap-3 pt-1">
                    <button type="button" onClick={closeModal} className="flex-1 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50">
                      Cancel
                    </button>
                    <button type="submit" disabled={creating || selectedEvents.length === 0} className="flex-1 py-2 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-700 disabled:opacity-50">
                      {creating ? "Creating..." : "Create Webhook"}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-gray-700">Webhook created successfully.</p>
                  <SecretRevealBox value={createdSecret} label="Signing Secret" />
                  <p className="text-xs text-gray-500">Use this secret to verify that webhook payloads are from SiteCommand by checking the <code className="font-mono bg-gray-100 px-1 py-0.5 rounded">X-SiteCommand-Signature</code> header.</p>
                  <button
                    onClick={closeModal}
                    className="w-full py-2 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-700"
                  >
                    Done
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Documentation Tab ────────────────────────────────────────────────────────

export function DocumentationTab() {
  return (
    <div className="space-y-8">
      {/* Authentication */}
      <div>
        <h2 className="text-sm font-semibold text-gray-900 mb-1">Authentication</h2>
        <p className="text-xs text-gray-500 mb-3">
          Pass your API key as a Bearer token in the <code className="font-mono bg-gray-100 px-1 py-0.5 rounded text-gray-700">Authorization</code> header with every request.
        </p>
        <div className="bg-gray-900 rounded-lg px-4 py-3 relative">
          <pre className="font-mono text-xs text-green-300 whitespace-pre-wrap leading-relaxed">{`curl -H "Authorization: Bearer sc_live_..." \\
  https://yourapp.com/api/v1/projects`}</pre>
          <div className="absolute top-2.5 right-2.5">
            <CopyButton text={`curl -H "Authorization: Bearer sc_live_..." \\\n  https://yourapp.com/api/v1/projects`} />
          </div>
        </div>
      </div>

      {/* Endpoints */}
      <div>
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Endpoints</h2>
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-4 py-3">Method</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-4 py-3">Endpoint</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-4 py-3">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {[
                { method: "GET", path: "/api/v1/projects", desc: "List all projects for your company" },
                { method: "GET", path: "/api/v1/projects/:id", desc: "Get details for a single project" },
                { method: "GET", path: "/api/v1/projects/:id/rfis", desc: "List all RFIs for a project" },
              ].map((row) => (
                <tr key={row.path} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <span className="text-xs font-mono font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{row.method}</span>
                  </td>
                  <td className="px-4 py-3">
                    <code className="font-mono text-xs text-gray-800">{row.path}</code>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{row.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Webhook Events */}
      <div>
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Webhook Events</h2>
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-4 py-3">Event</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-4 py-3">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {ALL_EVENTS.map((ev) => (
                <tr key={ev.value} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <code className="font-mono text-xs text-gray-800">{ev.label}</code>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{ev.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Rate Limits */}
      <div>
        <h2 className="text-sm font-semibold text-gray-900 mb-1">Rate Limits</h2>
        <p className="text-xs text-gray-500">
          The API allows <span className="font-medium text-gray-700">1,000 requests per hour</span> per API key. Exceeding this limit will result in a <code className="font-mono bg-gray-100 px-1 py-0.5 rounded">429 Too Many Requests</code> response.
        </p>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

type Tab = "keys" | "webhooks" | "docs";

export default function DeveloperSettingsClient() {
  const [activeTab, setActiveTab] = useState<Tab>("keys");

  const tabs: { id: Tab; label: string }[] = [
    { id: "keys", label: "API Keys" },
    { id: "webhooks", label: "Webhooks" },
    { id: "docs", label: "Documentation" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-4 sm:px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="/dashboard" className="text-sm font-semibold text-gray-900 hover:text-gray-700 transition-colors">
            SiteCommand
          </a>
          <span className="text-gray-300">/</span>
          <span className="text-sm text-gray-500">Developer Settings</span>
        </div>
        <a href="/dashboard" className="text-xs text-gray-400 hover:text-gray-700 transition-colors">
          Back to Dashboard
        </a>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <h1 className="font-display text-[28px] leading-tight text-[color:var(--ink)]">Developer Settings</h1>
          <p className="text-sm text-gray-500 mt-1">Manage API keys and webhooks for integrating with SiteCommand.</p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors mr-1 ${
                activeTab === tab.id
                  ? "border-orange-500 text-gray-900"
                  : "border-transparent text-gray-400 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          {activeTab === "keys" && <ApiKeysTab />}
          {activeTab === "webhooks" && <WebhooksTab />}
          {activeTab === "docs" && <DocumentationTab />}
        </div>
      </main>
    </div>
  );
}
