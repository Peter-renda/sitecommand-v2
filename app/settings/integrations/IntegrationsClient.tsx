"use client";

import { useState, useEffect } from "react";
import { Eye, EyeOff, Save, CheckCircle, ExternalLink } from "lucide-react";

// ── Shared components ─────────────────────────────────────────────────────────

function MaskedInput({
  id,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative flex items-center">
      <input
        id={id}
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 pr-10 border border-gray-200 rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-gray-900"
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        className="absolute right-2.5 text-gray-400 hover:text-gray-700"
        tabIndex={-1}
      >
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

function SaveButton({ saving, saved }: { saving: boolean; saved: boolean }) {
  return (
    <button
      type="submit"
      disabled={saving}
      className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-700 disabled:opacity-50 transition-colors"
    >
      {saved ? (
        <>
          <CheckCircle className="w-4 h-4 text-green-400" />
          Saved
        </>
      ) : (
        <>
          <Save className="w-4 h-4" />
          {saving ? "Saving..." : "Save credentials"}
        </>
      )}
    </button>
  );
}

// ── Sage Intacct section (company super_admin) ────────────────────────────────

type SageSettings = {
  SAGE_SENDER_ID: string | null;
  SAGE_SENDER_PASSWORD: string | null;
  SAGE_COMPANY_ID: string | null;
  SAGE_USER_ID: string | null;
  SAGE_USER_PASSWORD: string | null;
};

function SageSection() {
  const [settings, setSettings] = useState<SageSettings>({
    SAGE_SENDER_ID: null,
    SAGE_SENDER_PASSWORD: null,
    SAGE_COMPANY_ID: null,
    SAGE_USER_ID: null,
    SAGE_USER_PASSWORD: null,
  });
  const [form, setForm] = useState({
    SAGE_SENDER_ID: "",
    SAGE_SENDER_PASSWORD: "",
    SAGE_COMPANY_ID: "",
    SAGE_USER_ID: "",
    SAGE_USER_PASSWORD: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/settings/company-integrations")
      .then((r) => r.json())
      .then((data: SageSettings) => {
        setSettings(data);
        setForm({
          SAGE_SENDER_ID: data.SAGE_SENDER_ID ?? "",
          SAGE_SENDER_PASSWORD: data.SAGE_SENDER_PASSWORD ?? "",
          SAGE_COMPANY_ID: data.SAGE_COMPANY_ID ?? "",
          SAGE_USER_ID: data.SAGE_USER_ID ?? "",
          SAGE_USER_PASSWORD: data.SAGE_USER_PASSWORD ?? "",
        });
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(""); setSaved(false);

    const payload: Record<string, string> = {};
    if (form.SAGE_SENDER_ID.trim()) payload.SAGE_SENDER_ID = form.SAGE_SENDER_ID.trim();
    if (form.SAGE_SENDER_PASSWORD.trim()) payload.SAGE_SENDER_PASSWORD = form.SAGE_SENDER_PASSWORD.trim();
    if (form.SAGE_COMPANY_ID.trim()) payload.SAGE_COMPANY_ID = form.SAGE_COMPANY_ID.trim();
    if (form.SAGE_USER_ID.trim()) payload.SAGE_USER_ID = form.SAGE_USER_ID.trim();
    if (form.SAGE_USER_PASSWORD.trim()) payload.SAGE_USER_PASSWORD = form.SAGE_USER_PASSWORD.trim();

    const res = await fetch("/api/settings/company-integrations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) { setError(data.error ?? "Failed to save settings"); return; }

    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    setSettings((prev) => ({ ...prev, ...payload }));
  }

  const configured = !!(
    settings.SAGE_SENDER_ID &&
    settings.SAGE_SENDER_PASSWORD &&
    settings.SAGE_COMPANY_ID &&
    settings.SAGE_USER_ID &&
    settings.SAGE_USER_PASSWORD
  );

  if (loading) return <div className="text-xs text-gray-400 py-8 text-center">Loading...</div>;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Sage Intacct</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Sync prime contracts, subcontracts, and purchase orders to Sage Intacct in real time.
          </p>
        </div>
        <span
          className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ml-4 ${
            configured ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"
          }`}
        >
          {configured ? "Configured" : "Not configured"}
        </span>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="sage-sender-id" className="block text-xs font-medium text-gray-700 mb-1">
              Sender ID
            </label>
            <MaskedInput
              id="sage-sender-id"
              value={form.SAGE_SENDER_ID}
              onChange={(v) => setForm((f) => ({ ...f, SAGE_SENDER_ID: v }))}
              placeholder={settings.SAGE_SENDER_ID ? "••••••••••••••••" : "Sage-issued Sender ID"}
            />
          </div>
          <div>
            <label htmlFor="sage-sender-password" className="block text-xs font-medium text-gray-700 mb-1">
              Sender Password
            </label>
            <MaskedInput
              id="sage-sender-password"
              value={form.SAGE_SENDER_PASSWORD}
              onChange={(v) => setForm((f) => ({ ...f, SAGE_SENDER_PASSWORD: v }))}
              placeholder={settings.SAGE_SENDER_PASSWORD ? "••••••••••••••••" : "Sage-issued Sender Password"}
            />
          </div>
        </div>

        <div>
          <label htmlFor="sage-company-id" className="block text-xs font-medium text-gray-700 mb-1">
            Company ID
          </label>
          <input
            id="sage-company-id"
            type="text"
            value={form.SAGE_COMPANY_ID}
            onChange={(e) => setForm((f) => ({ ...f, SAGE_COMPANY_ID: e.target.value }))}
            placeholder={settings.SAGE_COMPANY_ID ?? "Your Intacct company ID"}
            className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
          <p className="text-xs text-gray-400 mt-1">
            Found under Company &rarr; Company Info in Sage Intacct.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="sage-user-id" className="block text-xs font-medium text-gray-700 mb-1">
              API User ID
            </label>
            <input
              id="sage-user-id"
              type="text"
              value={form.SAGE_USER_ID}
              onChange={(e) => setForm((f) => ({ ...f, SAGE_USER_ID: e.target.value }))}
              placeholder={settings.SAGE_USER_ID ?? "API web services user"}
              className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>
          <div>
            <label htmlFor="sage-user-password" className="block text-xs font-medium text-gray-700 mb-1">
              API User Password
            </label>
            <MaskedInput
              id="sage-user-password"
              value={form.SAGE_USER_PASSWORD}
              onChange={(v) => setForm((f) => ({ ...f, SAGE_USER_PASSWORD: v }))}
              placeholder={settings.SAGE_USER_PASSWORD ? "••••••••••••••••" : "API user password"}
            />
          </div>
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <div className="pt-1">
          <SaveButton saving={saving} saved={saved} />
        </div>
      </form>

      <div className="mt-6 pt-5 border-t border-gray-100">
        <p className="text-xs text-gray-400">
          Create a dedicated Web Services API user in Sage Intacct with minimum permissions (AP &amp; AR
          modules). The Sender ID and Password are issued by Sage — separate from your company login.
        </p>
      </div>
    </div>
  );
}

// ── QuickBooks Online section (company super_admin) ───────────────────────────

const QBO_ERROR_MESSAGES: Record<string, string> = {
  qbo_not_configured:
    "No QuickBooks app credentials found. Enter your Intuit Client ID and Secret below, save, then click Connect.",
  qbo_unauthorized: "You must be logged in to connect QuickBooks.",
  qbo_forbidden:    "Only company admins can connect QuickBooks.",
  qbo_no_company:   "Your account is not associated with a company.",
  qbo_denied:       "QuickBooks authorization was cancelled.",
  qbo_invalid_callback: "Invalid response from QuickBooks. Please try again.",
  qbo_invalid_state: "The authorization request could not be verified (expired or mismatched). Please try connecting again.",
  qbo_missing_app_creds: "QuickBooks app credentials are missing. Save your Client ID and Secret, then reconnect.",
  qbo_token_exchange_failed: "Failed to exchange authorization code. Please try again.",
};

function QuickBooksSection() {
  const [data, setData] = useState<Record<string, string | null>>({});
  const [form, setForm] = useState({ QBO_CLIENT_ID: "", QBO_CLIENT_SECRET: "" });
  const [environment, setEnvironment] = useState<"production" | "sandbox">("production");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const connected = !!(data.QBO_REALM_ID && data.QBO_ACCESS_TOKEN);
  const appConfigured = !!(data.QBO_CLIENT_ID && data.QBO_CLIENT_SECRET);

  useEffect(() => {
    fetch("/api/settings/company-integrations?integration=quickbooks")
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setForm({
          QBO_CLIENT_ID:     d.QBO_CLIENT_ID     ?? "",
          QBO_CLIENT_SECRET: d.QBO_CLIENT_SECRET ?? "",
        });
        setEnvironment(d.QBO_ENVIRONMENT === "sandbox" ? "sandbox" : "production");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const connectedParam = params.get("connected");
    const error = params.get("error");
    const url = new URL(window.location.href);

    if (connectedParam === "quickbooks") {
      setData((prev) => ({ ...prev, QBO_REALM_ID: "connected", QBO_ACCESS_TOKEN: "connected" }));
      url.searchParams.delete("connected");
      window.history.replaceState({}, "", url.toString());
    } else if (error && error.startsWith("qbo_")) {
      const reason = params.get("reason");
      const base = QBO_ERROR_MESSAGES[error] ?? "An error occurred connecting to QuickBooks.";
      setErrorMsg(reason ? `${base} (QuickBooks said: ${reason})` : base);
      url.searchParams.delete("error");
      url.searchParams.delete("reason");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setSaved(false); setErrorMsg("");

    const payload: Record<string, string> = { QBO_ENVIRONMENT: environment };
    if (form.QBO_CLIENT_ID.trim())     payload.QBO_CLIENT_ID     = form.QBO_CLIENT_ID.trim();
    if (form.QBO_CLIENT_SECRET.trim()) payload.QBO_CLIENT_SECRET = form.QBO_CLIENT_SECRET.trim();

    const res = await fetch("/api/settings/company-integrations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await res.json();
    setSaving(false);
    if (!res.ok) { setErrorMsg(result.error ?? "Failed to save"); return; }
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    setData((prev) => ({ ...prev, ...payload }));
  }

  async function handleDisconnect() {
    if (!window.confirm("Disconnect QuickBooks Online? Syncing will stop until you reconnect.")) return;
    setDisconnecting(true); setErrorMsg("");
    try {
      const res = await fetch("/api/integrations/quickbooks/disconnect", { method: "POST" });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) { setErrorMsg(result.error ?? "Failed to disconnect"); return; }
      setData((prev) => ({ ...prev, QBO_REALM_ID: null, QBO_ACCESS_TOKEN: null, QBO_REFRESH_TOKEN: null }));
    } catch {
      setErrorMsg("Network error while disconnecting.");
    } finally {
      setDisconnecting(false);
    }
  }

  if (loading) return <div className="text-xs text-gray-400 py-8 text-center">Loading...</div>;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">QuickBooks Online</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Sync prime contracts, subcontracts, and purchase orders to QuickBooks Online via OAuth.
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 ml-4">
          {environment === "sandbox" && (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-blue-50 text-blue-700">
              Sandbox
            </span>
          )}
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${connected ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>
            {connected ? "Connected" : "Not connected"}
          </span>
        </div>
      </div>

      {/* Step 1 — App credentials */}
      <form onSubmit={handleSave} className="space-y-3 mb-5">
        <p className="text-xs font-medium text-gray-700">
          Step 1 — Intuit app credentials
          <span className="ml-1 font-normal text-gray-400">(from developer.intuit.com)</span>
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="qbo-cid" className="block text-xs font-medium text-gray-700 mb-1">Client ID</label>
            <MaskedInput
              id="qbo-cid"
              value={form.QBO_CLIENT_ID}
              onChange={(v) => setForm((f) => ({ ...f, QBO_CLIENT_ID: v }))}
              placeholder={data.QBO_CLIENT_ID ? "••••••••••••••••" : "Intuit Client ID"}
            />
          </div>
          <div>
            <label htmlFor="qbo-csec" className="block text-xs font-medium text-gray-700 mb-1">Client Secret</label>
            <MaskedInput
              id="qbo-csec"
              value={form.QBO_CLIENT_SECRET}
              onChange={(v) => setForm((f) => ({ ...f, QBO_CLIENT_SECRET: v }))}
              placeholder={data.QBO_CLIENT_SECRET ? "••••••••••••••••" : "Intuit Client Secret"}
            />
          </div>
        </div>
        <div>
          <label htmlFor="qbo-env" className="block text-xs font-medium text-gray-700 mb-1">Environment</label>
          <select
            id="qbo-env"
            value={environment}
            onChange={(e) => setEnvironment(e.target.value === "sandbox" ? "sandbox" : "production")}
            className="w-full max-w-xs px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
          >
            <option value="production">Production (real QuickBooks company)</option>
            <option value="sandbox">Sandbox (Intuit test company)</option>
          </select>
          <p className="text-xs text-gray-400 mt-1">
            Sandbox requires <strong>Development</strong> keys from the Intuit portal; production requires{" "}
            <strong>Production</strong> keys. If you change this after connecting, disconnect and reconnect.
          </p>
        </div>
        {errorMsg && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">{errorMsg}</p>
        )}
        <SaveButton saving={saving} saved={saved} />
      </form>

      {/* Step 2 — OAuth connect */}
      <div className="border-t border-gray-100 pt-5 space-y-3">
        <p className="text-xs font-medium text-gray-700">Step 2 — Authorize with QuickBooks</p>
        {connected ? (
          <div className="flex items-center gap-3">
            <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
            <p className="text-sm text-gray-700">
              QuickBooks Online is connected{environment === "sandbox" ? " (sandbox)" : ""}.
            </p>
          </div>
        ) : (
          <p className="text-xs text-gray-500">
            {appConfigured
              ? "Credentials saved. Click below to authorize SiteCommand with your QuickBooks company."
              : "Save your Client ID and Secret above first, then connect."}
          </p>
        )}
        <div className="flex items-center gap-2">
          <a
            href="/api/integrations/quickbooks/connect"
            aria-disabled={!appConfigured}
            onClick={(e) => { if (!appConfigured) e.preventDefault(); }}
            className={`inline-flex items-center gap-2 px-4 py-2 text-white text-sm font-medium rounded-md transition-colors ${
              appConfigured
                ? "bg-[#2CA01C] hover:bg-[#237d16]"
                : "bg-gray-300 cursor-not-allowed"
            }`}
          >
            <ExternalLink className="w-4 h-4" />
            {connected ? "Reconnect QuickBooks" : "Connect QuickBooks Online"}
          </a>
          {connected && (
            <button
              type="button"
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="px-4 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-md hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              {disconnecting ? "Disconnecting…" : "Disconnect"}
            </button>
          )}
        </div>
      </div>

      <div className="mt-5 pt-4 border-t border-gray-100">
        <p className="text-xs text-gray-400">
          In the Intuit Developer Portal, the redirect URI must <strong>exactly match</strong>{" "}
          (scheme, host, and path) the one below — a mismatch is what causes Intuit&apos;s
          &ldquo;didn&apos;t connect&rdquo; error:
          <br />
          <code className="font-mono bg-gray-100 px-1 rounded">
            {data.QBO_REDIRECT_URI ||
              `${process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") || (typeof window !== "undefined" ? window.location.origin : "")}/api/integrations/quickbooks/callback`}
          </code>
          <br />
          Register it under the same key set (Development vs Production) as the Client ID/Secret you saved above.
          Required scope: <code className="font-mono bg-gray-100 px-1 rounded">com.intuit.quickbooks.accounting</code>.
        </p>
      </div>
    </div>
  );
}

// ── Xero section (company super_admin) ────────────────────────────────────────

const XERO_ERROR_MESSAGES: Record<string, string> = {
  xero_not_configured:
    "No Xero app credentials found. Enter your Xero Client ID and Secret below, save, then click Connect.",
  xero_unauthorized: "You must be logged in to connect Xero.",
  xero_forbidden:    "Only company admins can connect Xero.",
  xero_no_company:   "Your account is not associated with a company.",
  xero_denied:       "Xero authorization was cancelled.",
  xero_invalid_callback: "Invalid response from Xero. Please try again.",
  xero_token_exchange_failed: "Failed to exchange authorization code. Please try again.",
};

function XeroSection() {
  const [data, setData] = useState<Record<string, string | null>>({});
  const [form, setForm] = useState({ XERO_CLIENT_ID: "", XERO_CLIENT_SECRET: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const connected = !!(data.XERO_TENANT_ID && data.XERO_ACCESS_TOKEN);
  const appConfigured = !!(data.XERO_CLIENT_ID && data.XERO_CLIENT_SECRET);

  useEffect(() => {
    fetch("/api/settings/company-integrations?integration=xero")
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setForm({
          XERO_CLIENT_ID:     d.XERO_CLIENT_ID     ?? "",
          XERO_CLIENT_SECRET: d.XERO_CLIENT_SECRET ?? "",
        });
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const connectedParam = params.get("connected");
    const error = params.get("error");
    const url = new URL(window.location.href);

    if (connectedParam === "xero") {
      setData((prev) => ({ ...prev, XERO_TENANT_ID: "connected", XERO_ACCESS_TOKEN: "connected" }));
      url.searchParams.delete("connected");
      window.history.replaceState({}, "", url.toString());
    } else if (error && error.startsWith("xero_")) {
      setErrorMsg(XERO_ERROR_MESSAGES[error] ?? "An error occurred connecting to Xero.");
      url.searchParams.delete("error");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setSaved(false); setErrorMsg("");

    const payload: Record<string, string> = {};
    if (form.XERO_CLIENT_ID.trim())     payload.XERO_CLIENT_ID     = form.XERO_CLIENT_ID.trim();
    if (form.XERO_CLIENT_SECRET.trim()) payload.XERO_CLIENT_SECRET = form.XERO_CLIENT_SECRET.trim();

    const res = await fetch("/api/settings/company-integrations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await res.json();
    setSaving(false);
    if (!res.ok) { setErrorMsg(result.error ?? "Failed to save"); return; }
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    setData((prev) => ({ ...prev, ...payload }));
  }

  if (loading) return <div className="text-xs text-gray-400 py-8 text-center">Loading...</div>;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Xero</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Sync prime contracts, subcontracts, and purchase orders to Xero via OAuth.
          </p>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ml-4 ${connected ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>
          {connected ? "Connected" : "Not connected"}
        </span>
      </div>

      {/* Step 1 — App credentials */}
      <form onSubmit={handleSave} className="space-y-3 mb-5">
        <p className="text-xs font-medium text-gray-700">
          Step 1 — Xero app credentials
          <span className="ml-1 font-normal text-gray-400">(from developer.xero.com)</span>
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="xero-cid" className="block text-xs font-medium text-gray-700 mb-1">Client ID</label>
            <MaskedInput
              id="xero-cid"
              value={form.XERO_CLIENT_ID}
              onChange={(v) => setForm((f) => ({ ...f, XERO_CLIENT_ID: v }))}
              placeholder={data.XERO_CLIENT_ID ? "••••••••••••••••" : "Xero Client ID"}
            />
          </div>
          <div>
            <label htmlFor="xero-csec" className="block text-xs font-medium text-gray-700 mb-1">Client Secret</label>
            <MaskedInput
              id="xero-csec"
              value={form.XERO_CLIENT_SECRET}
              onChange={(v) => setForm((f) => ({ ...f, XERO_CLIENT_SECRET: v }))}
              placeholder={data.XERO_CLIENT_SECRET ? "••••••••••••••••" : "Xero Client Secret"}
            />
          </div>
        </div>
        {errorMsg && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">{errorMsg}</p>
        )}
        <SaveButton saving={saving} saved={saved} />
      </form>

      {/* Step 2 — OAuth connect */}
      <div className="border-t border-gray-100 pt-5 space-y-3">
        <p className="text-xs font-medium text-gray-700">Step 2 — Authorize with Xero</p>
        {connected ? (
          <div className="flex items-center gap-3">
            <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
            <p className="text-sm text-gray-700">Xero is connected.</p>
          </div>
        ) : (
          <p className="text-xs text-gray-500">
            {appConfigured
              ? "Credentials saved. Click below to authorize SiteCommand with your Xero organisation."
              : "Save your Client ID and Secret above first, then connect."}
          </p>
        )}
        <a
          href="/api/integrations/xero/connect"
          aria-disabled={!appConfigured}
          onClick={(e) => { if (!appConfigured) e.preventDefault(); }}
          className={`inline-flex items-center gap-2 px-4 py-2 text-white text-sm font-medium rounded-md transition-colors ${
            appConfigured
              ? "bg-[#13B5EA] hover:bg-[#0ea0d4]"
              : "bg-gray-300 cursor-not-allowed"
          }`}
        >
          <ExternalLink className="w-4 h-4" />
          {connected ? "Reconnect Xero" : "Connect Xero"}
        </a>
      </div>

      <div className="mt-5 pt-4 border-t border-gray-100">
        <p className="text-xs text-gray-400">
          Set the redirect URI in the Xero Developer Centre to{" "}
          <code className="font-mono bg-gray-100 px-1 rounded">{typeof window !== "undefined" ? window.location.origin : ""}/api/integrations/xero/callback</code>.
          Required scopes: <code className="font-mono bg-gray-100 px-1 rounded">offline_access accounting.transactions accounting.contacts</code>.
        </p>
      </div>
    </div>
  );
}

// ── APS section (site_admin only) ─────────────────────────────────────────────

type ApsSettings = {
  APS_CLIENT_ID: string | null;
  APS_CLIENT_SECRET: string | null;
  APS_BUCKET_KEY: string | null;
};

function ApsSection() {
  const [settings, setSettings] = useState<ApsSettings>({
    APS_CLIENT_ID: null,
    APS_CLIENT_SECRET: null,
    APS_BUCKET_KEY: null,
  });
  const [form, setForm] = useState({ APS_CLIENT_ID: "", APS_CLIENT_SECRET: "", APS_BUCKET_KEY: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/platform-settings")
      .then((r) => r.json())
      .then((data: ApsSettings) => {
        setSettings(data);
        setForm({
          APS_CLIENT_ID: data.APS_CLIENT_ID ?? "",
          APS_CLIENT_SECRET: data.APS_CLIENT_SECRET ?? "",
          APS_BUCKET_KEY: data.APS_BUCKET_KEY ?? "",
        });
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(""); setSaved(false);

    const payload: Record<string, string> = {};
    if (form.APS_CLIENT_ID.trim()) payload.APS_CLIENT_ID = form.APS_CLIENT_ID.trim();
    if (form.APS_CLIENT_SECRET.trim()) payload.APS_CLIENT_SECRET = form.APS_CLIENT_SECRET.trim();
    if (form.APS_BUCKET_KEY.trim()) payload.APS_BUCKET_KEY = form.APS_BUCKET_KEY.trim();

    const res = await fetch("/api/admin/platform-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) { setError(data.error ?? "Failed to save settings"); return; }

    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    setSettings((prev) => ({ ...prev, ...payload }));
  }

  const configured = !!(settings.APS_CLIENT_ID && settings.APS_CLIENT_SECRET);

  if (loading) return <div className="text-xs text-gray-400 py-8 text-center">Loading...</div>;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Autodesk Platform Services (APS)</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Required for BIM file uploads and 3D model viewing (.rvt, .dwg, .ifc, and more).
          </p>
        </div>
        <span
          className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ml-4 ${
            configured ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"
          }`}
        >
          {configured ? "Configured" : "Not configured"}
        </span>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label htmlFor="aps-client-id" className="block text-xs font-medium text-gray-700 mb-1">
            Client ID
          </label>
          <MaskedInput
            id="aps-client-id"
            value={form.APS_CLIENT_ID}
            onChange={(v) => setForm((f) => ({ ...f, APS_CLIENT_ID: v }))}
            placeholder={settings.APS_CLIENT_ID ? "••••••••••••••••" : "Enter APS Client ID"}
          />
          <p className="text-xs text-gray-400 mt-1">Found in your Autodesk Developer Portal app settings.</p>
        </div>

        <div>
          <label htmlFor="aps-client-secret" className="block text-xs font-medium text-gray-700 mb-1">
            Client Secret
          </label>
          <MaskedInput
            id="aps-client-secret"
            value={form.APS_CLIENT_SECRET}
            onChange={(v) => setForm((f) => ({ ...f, APS_CLIENT_SECRET: v }))}
            placeholder={settings.APS_CLIENT_SECRET ? "••••••••••••••••" : "Enter APS Client Secret"}
          />
        </div>

        <div>
          <label htmlFor="aps-bucket-key" className="block text-xs font-medium text-gray-700 mb-1">
            Bucket Key <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <input
            id="aps-bucket-key"
            type="text"
            value={form.APS_BUCKET_KEY}
            onChange={(e) => setForm((f) => ({ ...f, APS_BUCKET_KEY: e.target.value }))}
            placeholder={settings.APS_BUCKET_KEY ?? "sitecommand-bim-{auto-generated from Client ID}"}
            className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
          <p className="text-xs text-gray-400 mt-1">Leave blank to auto-generate from Client ID.</p>
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <div className="pt-1">
          <SaveButton saving={saving} saved={saved} />
        </div>
      </form>

      <div className="mt-6 pt-5 border-t border-gray-100">
        <p className="text-xs text-gray-400">
          Credentials are stored in the platform settings database and override any{" "}
          <code className="font-mono bg-gray-100 px-1 py-0.5 rounded">APS_CLIENT_ID</code>
          {" / "}
          <code className="font-mono bg-gray-100 px-1 py-0.5 rounded">APS_CLIENT_SECRET</code>{" "}
          environment variables set on the server.
        </p>
      </div>
    </div>
  );
}

// ── QBO App Credentials section (site_admin only) ────────────────────────────

type QBOAppSettings = {
  QBO_CLIENT_ID: string | null;
  QBO_CLIENT_SECRET: string | null;
};

function QBOAppSection() {
  const [settings, setSettings] = useState<QBOAppSettings>({
    QBO_CLIENT_ID: null,
    QBO_CLIENT_SECRET: null,
  });
  const [form, setForm] = useState({ QBO_CLIENT_ID: "", QBO_CLIENT_SECRET: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/platform-settings")
      .then((r) => r.json())
      .then((data: QBOAppSettings) => {
        setSettings(data);
        setForm({
          QBO_CLIENT_ID: data.QBO_CLIENT_ID ?? "",
          QBO_CLIENT_SECRET: data.QBO_CLIENT_SECRET ?? "",
        });
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(""); setSaved(false);

    const payload: Record<string, string> = {};
    if (form.QBO_CLIENT_ID.trim()) payload.QBO_CLIENT_ID = form.QBO_CLIENT_ID.trim();
    if (form.QBO_CLIENT_SECRET.trim()) payload.QBO_CLIENT_SECRET = form.QBO_CLIENT_SECRET.trim();

    const res = await fetch("/api/admin/platform-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data.error ?? "Failed to save settings"); return; }
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    setSettings((prev) => ({ ...prev, ...payload }));
  }

  const configured = !!(settings.QBO_CLIENT_ID && settings.QBO_CLIENT_SECRET);
  if (loading) return <div className="text-xs text-gray-400 py-8 text-center">Loading...</div>;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">QuickBooks Online — App Credentials</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Platform-level OAuth app credentials. Company admins use these to connect their own QB companies.
          </p>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ml-4 ${configured ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>
          {configured ? "Configured" : "Not configured"}
        </span>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label htmlFor="qbo-client-id" className="block text-xs font-medium text-gray-700 mb-1">Client ID</label>
          <MaskedInput
            id="qbo-client-id"
            value={form.QBO_CLIENT_ID}
            onChange={(v) => setForm((f) => ({ ...f, QBO_CLIENT_ID: v }))}
            placeholder={settings.QBO_CLIENT_ID ? "••••••••••••••••" : "Intuit app Client ID"}
          />
          <p className="text-xs text-gray-400 mt-1">Found in the Intuit Developer Portal under your app.</p>
        </div>
        <div>
          <label htmlFor="qbo-client-secret" className="block text-xs font-medium text-gray-700 mb-1">Client Secret</label>
          <MaskedInput
            id="qbo-client-secret"
            value={form.QBO_CLIENT_SECRET}
            onChange={(v) => setForm((f) => ({ ...f, QBO_CLIENT_SECRET: v }))}
            placeholder={settings.QBO_CLIENT_SECRET ? "••••••••••••••••" : "Intuit app Client Secret"}
          />
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="pt-1"><SaveButton saving={saving} saved={saved} /></div>
      </form>

      <div className="mt-6 pt-5 border-t border-gray-100">
        <p className="text-xs text-gray-400">
          Set the redirect URI in the Intuit Developer Portal to{" "}
          <code className="font-mono bg-gray-100 px-1 py-0.5 rounded">{"{APP_URL}"}/api/integrations/quickbooks/callback</code>.
          Scopes required: <code className="font-mono bg-gray-100 px-1 py-0.5 rounded">com.intuit.quickbooks.accounting</code>.
        </p>
      </div>
    </div>
  );
}

// ── Xero App Credentials section (site_admin only) ────────────────────────────

type XeroAppSettings = {
  XERO_CLIENT_ID: string | null;
  XERO_CLIENT_SECRET: string | null;
};

function XeroAppSection() {
  const [settings, setSettings] = useState<XeroAppSettings>({
    XERO_CLIENT_ID: null,
    XERO_CLIENT_SECRET: null,
  });
  const [form, setForm] = useState({ XERO_CLIENT_ID: "", XERO_CLIENT_SECRET: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/platform-settings")
      .then((r) => r.json())
      .then((data: XeroAppSettings) => {
        setSettings(data);
        setForm({
          XERO_CLIENT_ID: data.XERO_CLIENT_ID ?? "",
          XERO_CLIENT_SECRET: data.XERO_CLIENT_SECRET ?? "",
        });
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(""); setSaved(false);

    const payload: Record<string, string> = {};
    if (form.XERO_CLIENT_ID.trim()) payload.XERO_CLIENT_ID = form.XERO_CLIENT_ID.trim();
    if (form.XERO_CLIENT_SECRET.trim()) payload.XERO_CLIENT_SECRET = form.XERO_CLIENT_SECRET.trim();

    const res = await fetch("/api/admin/platform-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data.error ?? "Failed to save settings"); return; }
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    setSettings((prev) => ({ ...prev, ...payload }));
  }

  const configured = !!(settings.XERO_CLIENT_ID && settings.XERO_CLIENT_SECRET);
  if (loading) return <div className="text-xs text-gray-400 py-8 text-center">Loading...</div>;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Xero — App Credentials</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Platform-level OAuth app credentials. Company admins use these to connect their own Xero organisations.
          </p>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ml-4 ${configured ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>
          {configured ? "Configured" : "Not configured"}
        </span>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label htmlFor="xero-client-id" className="block text-xs font-medium text-gray-700 mb-1">Client ID</label>
          <MaskedInput
            id="xero-client-id"
            value={form.XERO_CLIENT_ID}
            onChange={(v) => setForm((f) => ({ ...f, XERO_CLIENT_ID: v }))}
            placeholder={settings.XERO_CLIENT_ID ? "••••••••••••••••" : "Xero app Client ID"}
          />
          <p className="text-xs text-gray-400 mt-1">Found in the Xero Developer Centre under your app.</p>
        </div>
        <div>
          <label htmlFor="xero-client-secret" className="block text-xs font-medium text-gray-700 mb-1">Client Secret</label>
          <MaskedInput
            id="xero-client-secret"
            value={form.XERO_CLIENT_SECRET}
            onChange={(v) => setForm((f) => ({ ...f, XERO_CLIENT_SECRET: v }))}
            placeholder={settings.XERO_CLIENT_SECRET ? "••••••••••••••••" : "Xero app Client Secret"}
          />
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="pt-1"><SaveButton saving={saving} saved={saved} /></div>
      </form>

      <div className="mt-6 pt-5 border-t border-gray-100">
        <p className="text-xs text-gray-400">
          Set the redirect URI in the Xero Developer Centre to{" "}
          <code className="font-mono bg-gray-100 px-1 py-0.5 rounded">{"{APP_URL}"}/api/integrations/xero/callback</code>.
          Scopes required:{" "}
          <code className="font-mono bg-gray-100 px-1 py-0.5 rounded">offline_access accounting.transactions accounting.contacts</code>.
        </p>
      </div>
    </div>
  );
}

// ── ElevenLabs section (company super_admin) ─────────────────────────────────

function ElevenLabsCompanySection() {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [form, setForm] = useState({ ELEVENLABS_API_KEY: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/settings/company-integrations?integration=elevenlabs")
      .then((r) => r.json())
      .then((data: { ELEVENLABS_API_KEY: string | null }) => {
        setApiKey(data.ELEVENLABS_API_KEY);
        setForm({ ELEVENLABS_API_KEY: data.ELEVENLABS_API_KEY ?? "" });
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(""); setSaved(false);

    const payload: Record<string, string> = {};
    if (form.ELEVENLABS_API_KEY.trim()) payload.ELEVENLABS_API_KEY = form.ELEVENLABS_API_KEY.trim();

    const res = await fetch("/api/settings/company-integrations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) { setError(data.error ?? "Failed to save settings"); return; }

    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    setApiKey(form.ELEVENLABS_API_KEY.trim() || null);
  }

  const configured = !!apiKey;

  if (loading) return <div className="text-xs text-gray-400 py-8 text-center">Loading...</div>;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">ElevenLabs</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Enables audio transcription in Quick Notes via ElevenLabs Speech-to-Text.
          </p>
        </div>
        <span
          className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ml-4 ${
            configured ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"
          }`}
        >
          {configured ? "Configured" : "Not configured"}
        </span>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label htmlFor="elevenlabs-company-api-key" className="block text-xs font-medium text-gray-700 mb-1">
            API Key
          </label>
          <MaskedInput
            id="elevenlabs-company-api-key"
            value={form.ELEVENLABS_API_KEY}
            onChange={(v) => setForm({ ELEVENLABS_API_KEY: v })}
            placeholder={apiKey ? "••••••••••••••••" : "sk_..."}
          />
          <p className="text-xs text-gray-400 mt-1">Found in your ElevenLabs account under Profile → API Keys.</p>
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <div className="pt-1">
          <SaveButton saving={saving} saved={saved} />
        </div>
      </form>
    </div>
  );
}

// ── ElevenLabs section (site_admin only) ─────────────────────────────────────

function ElevenLabsSection() {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [form, setForm] = useState({ ELEVENLABS_API_KEY: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/platform-settings")
      .then((r) => r.json())
      .then((data: { ELEVENLABS_API_KEY: string | null }) => {
        setApiKey(data.ELEVENLABS_API_KEY);
        setForm({ ELEVENLABS_API_KEY: data.ELEVENLABS_API_KEY ?? "" });
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(""); setSaved(false);

    const payload: Record<string, string> = {};
    if (form.ELEVENLABS_API_KEY.trim()) payload.ELEVENLABS_API_KEY = form.ELEVENLABS_API_KEY.trim();

    const res = await fetch("/api/admin/platform-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) { setError(data.error ?? "Failed to save settings"); return; }

    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    setApiKey(form.ELEVENLABS_API_KEY.trim() || null);
  }

  const configured = !!apiKey;

  if (loading) return <div className="text-xs text-gray-400 py-8 text-center">Loading...</div>;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">ElevenLabs</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Enables audio transcription in Quick Notes via ElevenLabs Speech-to-Text.
          </p>
        </div>
        <span
          className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ml-4 ${
            configured ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"
          }`}
        >
          {configured ? "Configured" : "Not configured"}
        </span>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label htmlFor="elevenlabs-api-key" className="block text-xs font-medium text-gray-700 mb-1">
            API Key
          </label>
          <MaskedInput
            id="elevenlabs-api-key"
            value={form.ELEVENLABS_API_KEY}
            onChange={(v) => setForm({ ELEVENLABS_API_KEY: v })}
            placeholder={apiKey ? "••••••••••••••••" : "sk_..."}
          />
          <p className="text-xs text-gray-400 mt-1">Found in your ElevenLabs account under Profile → API Keys.</p>
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <div className="pt-1">
          <SaveButton saving={saving} saved={saved} />
        </div>
      </form>

      <div className="mt-6 pt-5 border-t border-gray-100">
        <p className="text-xs text-gray-400">
          The key is stored in the platform settings database and overrides any{" "}
          <code className="font-mono bg-gray-100 px-1 py-0.5 rounded">ELEVENLABS_API_KEY</code>{" "}
          environment variable set on the server. The{" "}
          <code className="font-mono bg-gray-100 px-1 py-0.5 rounded">scribe_v2</code> model is used
          by default; override with the{" "}
          <code className="font-mono bg-gray-100 px-1 py-0.5 rounded">ELEVENLABS_STT_MODEL_ID</code>{" "}
          environment variable.
        </p>
      </div>
    </div>
  );
}

// ── Page root ─────────────────────────────────────────────────────────────────

export default function IntegrationsClient({ isSiteAdmin }: { isSiteAdmin: boolean }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-[28px] leading-tight text-[color:var(--ink)]">Integrations</h1>
        <p className="text-sm text-gray-500 mt-1">
          {isSiteAdmin
            ? "Configure platform-level third-party service credentials."
            : "Connect your company's accounting system to sync contracts and commitments."}
        </p>
      </div>

      {isSiteAdmin ? (
        <>
          <ApsSection />
          <QBOAppSection />
          <XeroAppSection />
          <ElevenLabsSection />
        </>
      ) : (
        <>
          <SageSection />
          <QuickBooksSection />
          <XeroSection />
          <ElevenLabsCompanySection />
        </>
      )}
    </div>
  );
}
