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
  qbo_other_erp_connected: "Sage 300 CRE is already connected. Only one ERP integration may be connected at a time — disconnect Sage 300 CRE first.",
};

type BudgetCodeMapRow = { code: string; account: string; class: string; item: string };

function parseBudgetCodeMap(raw: string | null | undefined): BudgetCodeMapRow[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return [];
    return Object.entries(parsed as Record<string, { account?: string; class?: string; item?: string }>)
      .map(([code, v]) => ({
        code,
        account: v?.account ?? "",
        class: v?.class ?? "",
        item: v?.item ?? "",
      }))
      .sort((a, b) => a.code.localeCompare(b.code));
  } catch {
    return [];
  }
}

function serializeBudgetCodeMap(rows: BudgetCodeMapRow[]): { ok: true; value: string } | { ok: false; error: string } {
  const out: Record<string, { account?: string; class?: string; item?: string }> = {};
  const seen = new Set<string>();
  for (const row of rows) {
    const code = row.code.trim();
    if (!code) continue;
    if (seen.has(code)) return { ok: false, error: `Budget code "${code}" is mapped more than once.` };
    seen.add(code);
    const entry: { account?: string; class?: string; item?: string } = {};
    if (row.account.trim()) entry.account = row.account.trim();
    if (row.class.trim()) entry.class = row.class.trim();
    if (row.item.trim()) entry.item = row.item.trim();
    if (!entry.account && !entry.class && !entry.item) continue;
    // Either Item (preferred) or Account is required for the resync to pull costs.
    // Class alone doesn't drive any cost pull and would be useless.
    if (!entry.item && !entry.account) {
      return { ok: false, error: `"${code}" needs either an Item or an Account (Class alone won't pull costs).` };
    }
    out[code] = entry;
  }
  return { ok: true, value: JSON.stringify(out) };
}

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

  // Budget code map editor state.
  const [mapRows, setMapRows] = useState<BudgetCodeMapRow[]>([]);
  const [mapSaving, setMapSaving] = useState(false);
  const [mapSaved, setMapSaved] = useState(false);
  const [mapError, setMapError] = useState("");
  const [qboAccounts, setQboAccounts] = useState<{ name: string; type: string }[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [accountsError, setAccountsError] = useState("");
  const [qboItems, setQboItems] = useState<{ name: string; type: string }[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemsError, setItemsError] = useState("");

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
        setMapRows(parseBudgetCodeMap(d.QBO_BUDGET_CODE_MAP));
      })
      .finally(() => setLoading(false));
  }, []);

  // Load QBO accounts + items for the pickers once we're connected.
  useEffect(() => {
    if (!connected) return;
    setAccountsLoading(true);
    setAccountsError("");
    fetch("/api/integrations/quickbooks/accounts")
      .then(async (r) => ({ ok: r.ok, body: await r.json().catch(() => ({})) }))
      .then(({ ok, body }) => {
        if (!ok) setAccountsError(body?.error ?? "Failed to load accounts from QuickBooks.");
        else setQboAccounts((body?.accounts ?? []).map((a: { name: string; type: string }) => ({ name: a.name, type: a.type })));
      })
      .catch(() => setAccountsError("Network error while loading QuickBooks accounts."))
      .finally(() => setAccountsLoading(false));

    setItemsLoading(true);
    setItemsError("");
    fetch("/api/integrations/quickbooks/items")
      .then(async (r) => ({ ok: r.ok, body: await r.json().catch(() => ({})) }))
      .then(({ ok, body }) => {
        if (!ok) setItemsError(body?.error ?? "Failed to load items from QuickBooks.");
        else setQboItems((body?.items ?? []).map((i: { name: string; type: string }) => ({ name: i.name, type: i.type })));
      })
      .catch(() => setItemsError("Network error while loading QuickBooks items."))
      .finally(() => setItemsLoading(false));
  }, [connected]);

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

  async function handleSaveMap() {
    setMapSaving(true);
    setMapSaved(false);
    setMapError("");
    const serialized = serializeBudgetCodeMap(mapRows);
    if (!serialized.ok) {
      setMapError(serialized.error);
      setMapSaving(false);
      return;
    }
    try {
      const res = await fetch("/api/settings/company-integrations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        // Send "{}" when cleared so the API still accepts the request (it drops
        // empty trimmed strings, so we send the canonical empty object).
        body: JSON.stringify({ QBO_BUDGET_CODE_MAP: serialized.value || "{}" }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMapError(result?.error ?? "Failed to save the budget code map.");
        return;
      }
      setData((prev) => ({ ...prev, QBO_BUDGET_CODE_MAP: serialized.value }));
      setMapRows(parseBudgetCodeMap(serialized.value));
      setMapSaved(true);
      setTimeout(() => setMapSaved(false), 3000);
    } catch {
      setMapError("Network error while saving the budget code map.");
    } finally {
      setMapSaving(false);
    }
  }

  function addMapRow() {
    setMapRows((prev) => [...prev, { code: "", account: "", class: "", item: "" }]);
  }

  function updateMapRow(index: number, patch: Partial<BudgetCodeMapRow>) {
    setMapRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function removeMapRow(index: number) {
    setMapRows((prev) => prev.filter((_, i) => i !== index));
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

      {/* Step 3 — Budget Code Map */}
      <div className="mt-5 pt-5 border-t border-gray-100">
        <div className="flex items-start justify-between gap-3 mb-1">
          <p className="text-xs font-medium text-gray-700">
            Step 3 — Budget code map
            <span className="ml-1 font-normal text-gray-400">
              (used by <strong>Resync with ERP</strong> on the Budget page)
            </span>
          </p>
        </div>
        <p className="text-xs text-gray-500 mb-3">
          Map each SiteCommand budget code to the matching QuickBooks{" "}
          <strong>Item</strong> (Product/Service) — the GC-standard QBO pattern, one Item per
          (cost code × cost type). <em>Resync with ERP</em> resolves the project to a
          Customer:Job, reads the Profit &amp; Loss Detail for that customer, and writes each
          Item&apos;s total back into the budget line&apos;s Job to Date Costs.
          <br />
          <span className="text-gray-400">
            Use <strong>Account</strong> instead only if your CoA has a separate account per cost
            code (legacy P&amp;L-by-Class pull). <strong>Class</strong> is optional and only used
            when pushing to QBO.
          </span>
        </p>

        {!connected && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-3 py-2 mb-3">
            Connect QuickBooks above before mapping codes — the Item and Account pickers need to
            read from your QBO file.
          </p>
        )}

        {connected && (accountsError || itemsError) && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2 mb-3">
            {itemsError || accountsError}
          </p>
        )}

        <datalist id="qbo-accounts-list">
          {qboAccounts.map((a) => (
            <option key={a.name} value={a.name}>{a.type}</option>
          ))}
        </datalist>
        <datalist id="qbo-items-list">
          {qboItems.map((i) => (
            <option key={i.name} value={i.name}>{i.type}</option>
          ))}
        </datalist>

        {mapRows.length === 0 ? (
          <p className="text-xs text-gray-400 mb-3">No mappings yet.</p>
        ) : (
          <div className="overflow-x-auto mb-3">
            <table className="w-full text-xs border border-gray-200 rounded-md">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="text-left font-medium px-2 py-1.5 border-b border-gray-200 w-[20%]">Budget code</th>
                  <th className="text-left font-medium px-2 py-1.5 border-b border-gray-200 w-[28%]">QBO Item (recommended)</th>
                  <th className="text-left font-medium px-2 py-1.5 border-b border-gray-200 w-[24%]">QBO Account (legacy)</th>
                  <th className="text-left font-medium px-2 py-1.5 border-b border-gray-200 w-[18%]">Class (optional)</th>
                  <th className="w-[10%] border-b border-gray-200" />
                </tr>
              </thead>
              <tbody>
                {mapRows.map((row, i) => (
                  <tr key={i} className="border-b border-gray-100 last:border-b-0">
                    <td className="px-2 py-1.5">
                      <input
                        type="text"
                        value={row.code}
                        onChange={(e) => updateMapRow(i, { code: e.target.value })}
                        placeholder="e.g. 01-030.M"
                        className="w-full px-2 py-1 border border-gray-200 rounded text-xs font-mono focus:outline-none focus:ring-1 focus:ring-gray-900"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="text"
                        list={connected ? "qbo-items-list" : undefined}
                        value={row.item}
                        onChange={(e) => updateMapRow(i, { item: e.target.value })}
                        placeholder={itemsLoading ? "Loading items…" : "01-030.M"}
                        className="w-full px-2 py-1 border border-gray-200 rounded text-xs font-mono focus:outline-none focus:ring-1 focus:ring-gray-900"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="text"
                        list={connected ? "qbo-accounts-list" : undefined}
                        value={row.account}
                        onChange={(e) => updateMapRow(i, { account: e.target.value })}
                        placeholder={accountsLoading ? "Loading…" : "—"}
                        className="w-full px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-gray-900"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="text"
                        value={row.class}
                        onChange={(e) => updateMapRow(i, { class: e.target.value })}
                        placeholder="—"
                        className="w-full px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-gray-900"
                      />
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <button
                        type="button"
                        onClick={() => removeMapRow(i)}
                        className="text-red-600 hover:text-red-800 text-xs"
                        aria-label={`Remove ${row.code || "row"}`}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={addMapRow}
            className="px-3 py-1.5 text-xs font-medium text-gray-700 border border-gray-200 rounded-md bg-white hover:bg-gray-50 transition-colors"
          >
            + Add row
          </button>
          <button
            type="button"
            onClick={handleSaveMap}
            disabled={mapSaving}
            className="flex items-center gap-2 px-4 py-1.5 bg-gray-900 text-white text-xs font-medium rounded-md hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            {mapSaved ? (
              <>
                <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                Saved
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                {mapSaving ? "Saving…" : "Save map"}
              </>
            )}
          </button>
          {mapError && (
            <span className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-1.5">
              {mapError}
            </span>
          )}
        </div>

        <p className="text-xs text-gray-400 mt-3">
          Tip: don&apos;t map two budget codes to the same Item (or the same Account) — the
          resync treats shared targets as ambiguous and skips them. For Items-based pulls, the
          project must also match a QuickBooks Customer or Customer:Job name.
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

// ── Sage 300 CRE section (company super_admin) ────────────────────────────────

function Sage300CreSection() {
  const [data, setData] = useState<Record<string, string | null>>({});
  const [form, setForm] = useState({ SAGE300CRE_CLIENT_ID: "", SAGE300CRE_CLIENT_SECRET: "" });
  const [accountTokenForm, setAccountTokenForm] = useState("");
  const [publicToken, setPublicToken] = useState("");
  const [linkToken, setLinkToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [exchanging, setExchanging] = useState(false);
  const [savingToken, setSavingToken] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState("");

  const connected = !!data.SAGE300CRE_ACCOUNT_TOKEN;
  const appConfigured = !!(data.SAGE300CRE_CLIENT_ID && data.SAGE300CRE_CLIENT_SECRET);

  useEffect(() => {
    fetch("/api/settings/company-integrations?integration=sage300cre")
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setForm({
          SAGE300CRE_CLIENT_ID: d.SAGE300CRE_CLIENT_ID ?? "",
          SAGE300CRE_CLIENT_SECRET: d.SAGE300CRE_CLIENT_SECRET ?? "",
        });
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setSaved(false); setError("");

    const payload: Record<string, string> = {};
    if (form.SAGE300CRE_CLIENT_ID.trim()) payload.SAGE300CRE_CLIENT_ID = form.SAGE300CRE_CLIENT_ID.trim();
    if (form.SAGE300CRE_CLIENT_SECRET.trim()) payload.SAGE300CRE_CLIENT_SECRET = form.SAGE300CRE_CLIENT_SECRET.trim();

    const res = await fetch("/api/settings/company-integrations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await res.json();
    setSaving(false);
    if (!res.ok) { setError(result.error ?? "Failed to save"); return; }
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    setData((prev) => ({ ...prev, ...payload }));
  }

  async function handleGenerateLinkToken() {
    setGenerating(true); setError(""); setLinkToken("");
    try {
      const res = await fetch("/api/integrations/sage300cre/connect", { method: "POST" });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) { setError(result.error ?? "Failed to generate link token"); return; }
      setLinkToken(result.linkToken ?? "");
    } catch {
      setError("Network error while generating the link token.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleExchange() {
    if (!publicToken.trim()) return;
    setExchanging(true); setError("");
    try {
      const res = await fetch("/api/integrations/sage300cre/exchange", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicToken: publicToken.trim() }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) { setError(result.error ?? "Failed to complete connection"); return; }
      setData((prev) => ({ ...prev, SAGE300CRE_ACCOUNT_TOKEN: "connected" }));
      setPublicToken(""); setLinkToken("");
    } catch {
      setError("Network error while completing the connection.");
    } finally {
      setExchanging(false);
    }
  }

  async function handleSaveToken() {
    if (!accountTokenForm.trim()) return;
    setSavingToken(true); setError("");
    try {
      const res = await fetch("/api/settings/company-integrations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ SAGE300CRE_ACCOUNT_TOKEN: accountTokenForm.trim() }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) { setError(result.error ?? "Failed to save token"); return; }
      setData((prev) => ({ ...prev, SAGE300CRE_ACCOUNT_TOKEN: "connected" }));
      setAccountTokenForm("");
    } catch {
      setError("Network error while saving the token.");
    } finally {
      setSavingToken(false);
    }
  }

  async function handleDisconnect() {
    if (!window.confirm("Disconnect Sage 300 CRE? Syncing will stop until you reconnect.")) return;
    setDisconnecting(true); setError("");
    try {
      const res = await fetch("/api/integrations/sage300cre/disconnect", { method: "POST" });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) { setError(result.error ?? "Failed to disconnect"); return; }
      setData((prev) => ({ ...prev, SAGE300CRE_ACCOUNT_TOKEN: null }));
    } catch {
      setError("Network error while disconnecting.");
    } finally {
      setDisconnecting(false);
    }
  }

  if (loading) return <div className="text-xs text-gray-400 py-8 text-center">Loading...</div>;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Sage 300 CRE</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Sync commitments and prime contracts to Sage 300 CRE (Timberline) through the Agave connector.
          </p>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ml-4 ${connected ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>
          {connected ? "Connected" : "Not connected"}
        </span>
      </div>

      {/* Step 1 — Agave app credentials */}
      <form onSubmit={handleSave} className="space-y-3 mb-5">
        <p className="text-xs font-medium text-gray-700">
          Step 1 — Agave app credentials
          <span className="ml-1 font-normal text-gray-400">(from agaveapi.com)</span>
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="s3cre-cid" className="block text-xs font-medium text-gray-700 mb-1">Client ID</label>
            <MaskedInput
              id="s3cre-cid"
              value={form.SAGE300CRE_CLIENT_ID}
              onChange={(v) => setForm((f) => ({ ...f, SAGE300CRE_CLIENT_ID: v }))}
              placeholder={data.SAGE300CRE_CLIENT_ID ? "••••••••••••••••" : "Agave Client ID (UUID)"}
            />
          </div>
          <div>
            <label htmlFor="s3cre-csec" className="block text-xs font-medium text-gray-700 mb-1">Client Secret</label>
            <MaskedInput
              id="s3cre-csec"
              value={form.SAGE300CRE_CLIENT_SECRET}
              onChange={(v) => setForm((f) => ({ ...f, SAGE300CRE_CLIENT_SECRET: v }))}
              placeholder={data.SAGE300CRE_CLIENT_SECRET ? "••••••••••••••••" : "Agave Client Secret"}
            />
          </div>
        </div>
        <SaveButton saving={saving} saved={saved} />
      </form>

      {/* Step 2 — Connect via Agave Link */}
      <div className="border-t border-gray-100 pt-5 space-y-3">
        <p className="text-xs font-medium text-gray-700">Step 2 — Connect Sage 300 CRE</p>

        {connected ? (
          <div className="flex items-center gap-3">
            <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
            <p className="text-sm text-gray-700">Sage 300 CRE is connected.</p>
            <button
              type="button"
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="ml-auto px-4 py-1.5 text-sm font-medium text-red-600 border border-red-200 rounded-md hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              {disconnecting ? "Disconnecting…" : "Disconnect"}
            </button>
          </div>
        ) : (
          <>
            <p className="text-xs text-gray-500">
              {appConfigured
                ? "Generate a Link token, open Agave Link to authenticate your on-premise Sage 300 CRE connector and choose “Sage 300 CRE”, then paste the public token Agave returns."
                : "Save your Agave Client ID and Secret above first, then connect."}
            </p>
            <button
              type="button"
              onClick={handleGenerateLinkToken}
              disabled={!appConfigured || generating}
              className={`inline-flex items-center gap-2 px-4 py-2 text-white text-sm font-medium rounded-md transition-colors ${
                appConfigured ? "bg-[#1f6feb] hover:bg-[#1a5fd0]" : "bg-gray-300 cursor-not-allowed"
              }`}
            >
              <ExternalLink className="w-4 h-4" />
              {generating ? "Generating…" : "Generate Agave Link token"}
            </button>

            {linkToken && (
              <div className="space-y-2">
                <p className="text-xs text-gray-500">Use this Link token with Agave Link:</p>
                <code className="block font-mono text-xs bg-gray-100 px-2 py-1.5 rounded break-all">{linkToken}</code>
                <label htmlFor="s3cre-public" className="block text-xs font-medium text-gray-700 mb-1 pt-1">
                  Public token (from Agave Link)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="s3cre-public"
                    type="text"
                    value={publicToken}
                    onChange={(e) => setPublicToken(e.target.value)}
                    placeholder="public-…"
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                  <button
                    type="button"
                    onClick={handleExchange}
                    disabled={!publicToken.trim() || exchanging}
                    className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-md hover:bg-gray-700 disabled:opacity-50"
                  >
                    {exchanging ? "Connecting…" : "Complete connection"}
                  </button>
                </div>
              </div>
            )}

            {/* Manual fallback — paste an Account Token directly */}
            <details className="pt-1">
              <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                Or paste an Account Token directly
              </summary>
              <div className="flex items-center gap-2 mt-2">
                <MaskedInput
                  id="s3cre-account-token"
                  value={accountTokenForm}
                  onChange={setAccountTokenForm}
                  placeholder="Agave Account Token"
                />
                <button
                  type="button"
                  onClick={handleSaveToken}
                  disabled={!accountTokenForm.trim() || savingToken}
                  className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-md hover:bg-gray-700 disabled:opacity-50 whitespace-nowrap"
                >
                  {savingToken ? "Saving…" : "Save token"}
                </button>
              </div>
            </details>
          </>
        )}

        {error && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">{error}</p>
        )}
      </div>

      <div className="mt-5 pt-4 border-t border-gray-100">
        <p className="text-xs text-gray-400">
          Sage 300 CRE is on-premise; SiteCommand reaches it through{" "}
          <a href="https://www.agaveapi.com" target="_blank" rel="noreferrer" className="underline hover:text-gray-600">Agave</a>,
          which runs a connector on your Sage server. Vendors and customers must already exist in Sage 300 CRE — syncs resolve them by name.
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
            Required for BIM file uploads and 3D model viewing (.rvt, .dwg, .ifc, and more), and for
            the BuildingConnected integration on the Preconstruction page.
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

      <div className="mt-6 pt-5 border-t border-gray-100 space-y-3">
        <p className="text-xs text-gray-400">
          Credentials are stored in the platform settings database and override any{" "}
          <code className="font-mono bg-gray-100 px-1 py-0.5 rounded">APS_CLIENT_ID</code>
          {" / "}
          <code className="font-mono bg-gray-100 px-1 py-0.5 rounded">APS_CLIENT_SECRET</code>{" "}
          environment variables set on the server.
        </p>
        <p className="text-xs text-gray-400">
          To use BuildingConnected, register the following callback URL on your APS app in the{" "}
          <span className="text-gray-500 font-medium">Autodesk Developer Portal</span>{" "}
          (My Apps → Edit → Callback URLs). Also enable the{" "}
          <span className="text-gray-500 font-medium">BuildingConnected API</span> and ensure{" "}
          <code className="font-mono bg-gray-100 px-1 py-0.5 rounded">data:read</code>,{" "}
          <code className="font-mono bg-gray-100 px-1 py-0.5 rounded">data:write</code>, and{" "}
          <code className="font-mono bg-gray-100 px-1 py-0.5 rounded">offline_access</code> scopes
          are permitted:
        </p>
        <code className="block font-mono text-xs bg-gray-100 px-3 py-2 rounded-md text-gray-700 break-all">
          {typeof window !== "undefined" ? window.location.origin : ""}/api/integrations/buildingconnected/callback
        </code>
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

// ── Sage 300 CRE App Credentials section (site_admin only) ────────────────────

type Sage300CreAppSettings = {
  SAGE300CRE_CLIENT_ID: string | null;
  SAGE300CRE_CLIENT_SECRET: string | null;
};

function Sage300CreAppSection() {
  const [settings, setSettings] = useState<Sage300CreAppSettings>({
    SAGE300CRE_CLIENT_ID: null,
    SAGE300CRE_CLIENT_SECRET: null,
  });
  const [form, setForm] = useState({ SAGE300CRE_CLIENT_ID: "", SAGE300CRE_CLIENT_SECRET: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/platform-settings")
      .then((r) => r.json())
      .then((data: Sage300CreAppSettings) => {
        setSettings(data);
        setForm({
          SAGE300CRE_CLIENT_ID: data.SAGE300CRE_CLIENT_ID ?? "",
          SAGE300CRE_CLIENT_SECRET: data.SAGE300CRE_CLIENT_SECRET ?? "",
        });
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(""); setSaved(false);

    const payload: Record<string, string> = {};
    if (form.SAGE300CRE_CLIENT_ID.trim()) payload.SAGE300CRE_CLIENT_ID = form.SAGE300CRE_CLIENT_ID.trim();
    if (form.SAGE300CRE_CLIENT_SECRET.trim()) payload.SAGE300CRE_CLIENT_SECRET = form.SAGE300CRE_CLIENT_SECRET.trim();

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

  const configured = !!(settings.SAGE300CRE_CLIENT_ID && settings.SAGE300CRE_CLIENT_SECRET);
  if (loading) return <div className="text-xs text-gray-400 py-8 text-center">Loading...</div>;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Sage 300 CRE — Agave App Credentials</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Platform-level Agave app credentials. Company admins use these to connect their own Sage 300 CRE instances.
          </p>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ml-4 ${configured ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>
          {configured ? "Configured" : "Not configured"}
        </span>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label htmlFor="s3cre-app-client-id" className="block text-xs font-medium text-gray-700 mb-1">Client ID</label>
          <MaskedInput
            id="s3cre-app-client-id"
            value={form.SAGE300CRE_CLIENT_ID}
            onChange={(v) => setForm((f) => ({ ...f, SAGE300CRE_CLIENT_ID: v }))}
            placeholder={settings.SAGE300CRE_CLIENT_ID ? "••••••••••••••••" : "Agave app Client ID"}
          />
          <p className="text-xs text-gray-400 mt-1">Found in your Agave dashboard under API credentials.</p>
        </div>
        <div>
          <label htmlFor="s3cre-app-client-secret" className="block text-xs font-medium text-gray-700 mb-1">Client Secret</label>
          <MaskedInput
            id="s3cre-app-client-secret"
            value={form.SAGE300CRE_CLIENT_SECRET}
            onChange={(v) => setForm((f) => ({ ...f, SAGE300CRE_CLIENT_SECRET: v }))}
            placeholder={settings.SAGE300CRE_CLIENT_SECRET ? "••••••••••••••••" : "Agave app Client Secret"}
          />
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="pt-1"><SaveButton saving={saving} saved={saved} /></div>
      </form>

      <div className="mt-6 pt-5 border-t border-gray-100">
        <p className="text-xs text-gray-400">
          Stored in platform settings and shared across companies that haven&apos;t set their own. Each company still
          connects its own Sage 300 CRE through Agave Link (producing a per-company Account Token).
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

// ── BuildingConnected section (company super_admin) ───────────────────────────

type BuildingConnectedStatus = {
  configured: boolean;
  connected: boolean;
  canManage: boolean;
  user: { name: string | null; email: string | null } | null;
  connectedAt: string | null;
};

const BC_ERROR_LABELS: Record<string, string> = {
  unauthorized: "Your session expired. Please sign in and try again.",
  forbidden: "Only a Company Super Admin can connect BuildingConnected.",
  no_company: "Your account isn't associated with a company.",
  not_configured:
    "Autodesk Platform Services app credentials aren't set up yet. A site administrator needs to add them first.",
  invalid_callback: "Autodesk returned an unexpected response. Please try again.",
  invalid_state: "The connection request expired or couldn't be verified. Please try again.",
  missing_app_creds: "Autodesk app credentials are missing. Contact your administrator.",
  token_exchange_failed: "Autodesk rejected the connection. Please try again.",
  denied: "The Autodesk authorization was cancelled.",
};

function BuildingConnectedSection() {
  const [status, setStatus] = useState<BuildingConnectedStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const [banner, setBanner] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  async function load() {
    try {
      const res = await fetch("/api/integrations/buildingconnected/status");
      if (res.ok) setStatus(await res.json());
    } catch {
      /* leave status null → generic unavailable state */
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // Surface the ?bc_connected / ?bc_error params from the OAuth round-trip, then
  // strip them so a refresh doesn't replay the banner.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connectedFlag = params.get("bc_connected");
    const errorCode = params.get("bc_error");
    if (connectedFlag) {
      setBanner({ kind: "success", text: "Autodesk BuildingConnected is now connected." });
    } else if (errorCode) {
      const base = BC_ERROR_LABELS[errorCode] || "Could not connect BuildingConnected.";
      const reason = params.get("reason");
      setBanner({ kind: "error", text: reason ? `${base} (${reason})` : base });
    }
    if (connectedFlag || errorCode) {
      const url = new URL(window.location.href);
      ["bc_connected", "bc_error", "reason"].forEach((k) => url.searchParams.delete(k));
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  async function handleDisconnect() {
    if (!window.confirm("Disconnect Autodesk BuildingConnected for your company?")) return;
    setDisconnecting(true);
    try {
      const res = await fetch("/api/integrations/buildingconnected/disconnect", { method: "POST" });
      if (res.ok) {
        setBanner({ kind: "success", text: "Autodesk BuildingConnected disconnected." });
        await load();
      } else {
        const j = await res.json().catch(() => ({}));
        setBanner({ kind: "error", text: j.error || "Could not disconnect. Please try again." });
      }
    } catch {
      setBanner({ kind: "error", text: "Could not disconnect. Please try again." });
    } finally {
      setDisconnecting(false);
    }
  }

  const connected = status?.connected ?? false;
  const configured = status?.configured ?? false;
  const canManage = status?.canManage ?? false;
  const connectHref =
    "/api/integrations/buildingconnected/connect?returnTo=" +
    encodeURIComponent("/settings/integrations");

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Autodesk BuildingConnected</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Bid management and preconstruction. Connects via Autodesk Platform Services (the same APS
            app used by the BIM viewer). Opportunities and bids flow into the Preconstruction tool.
          </p>
        </div>
        <span
          className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ml-4 ${
            connected ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"
          }`}
        >
          {loading ? "…" : connected ? "Connected" : "Not connected"}
        </span>
      </div>

      {banner && (
        <div
          className={`mb-4 flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${
            banner.kind === "success"
              ? "bg-green-50 border-green-100 text-green-800"
              : "bg-red-50 border-red-100 text-red-700"
          }`}
        >
          <span>{banner.text}</span>
          <button
            type="button"
            onClick={() => setBanner(null)}
            className="ml-auto text-xs underline opacity-70 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}

      {loading ? (
        <div className="text-xs text-gray-400 py-2">Checking connection…</div>
      ) : connected ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
            <span>
              Connected
              {status?.user?.name ? (
                <> as <span className="font-medium">{status.user.name}</span></>
              ) : null}
              {status?.user?.email ? (
                <span className="text-gray-400"> ({status.user.email})</span>
              ) : null}
              {status?.connectedAt ? (
                <span className="text-gray-400">
                  {" "}· since {new Date(status.connectedAt).toLocaleDateString()}
                </span>
              ) : null}
            </span>
          </div>
          {canManage ? (
            <div className="flex items-center gap-2">
              <a
                href={connectHref}
                className="inline-flex items-center gap-2 px-4 py-2 text-white text-sm font-medium rounded-md bg-gray-900 hover:bg-black transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                Reconnect
              </a>
              <button
                type="button"
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="px-4 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-md hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                {disconnecting ? "Disconnecting…" : "Disconnect"}
              </button>
            </div>
          ) : (
            <p className="text-xs text-gray-400">Managed by your Company Super Admin.</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-gray-500">
            {!configured
              ? "Autodesk Platform Services app credentials aren't configured yet. A site administrator needs to add APS_CLIENT_ID and APS_CLIENT_SECRET (platform settings) before BuildingConnected can be connected."
              : canManage
                ? "Authorize SiteCommand to read your company's BuildingConnected bids and opportunities."
                : "Only a Company Super Admin can connect BuildingConnected. Ask your admin to enable it."}
          </p>
          <a
            href={connectHref}
            aria-disabled={!configured || !canManage}
            onClick={(e) => {
              if (!configured || !canManage) e.preventDefault();
            }}
            className={`inline-flex items-center gap-2 px-4 py-2 text-white text-sm font-medium rounded-md transition-colors ${
              configured && canManage
                ? "bg-gray-900 hover:bg-black"
                : "bg-gray-300 cursor-not-allowed"
            }`}
          >
            <ExternalLink className="w-4 h-4" />
            Connect BuildingConnected
          </a>
        </div>
      )}

      <div className="mt-5 pt-4 border-t border-gray-100">
        <p className="text-xs text-gray-400">
          Register this callback URL on your APS app in the Autodesk Developer Portal (My Apps →
          Edit → Callback URLs), and enable the BuildingConnected API with{" "}
          <code className="font-mono bg-gray-100 px-1 rounded">data:read</code>,{" "}
          <code className="font-mono bg-gray-100 px-1 rounded">data:write</code>, and{" "}
          <code className="font-mono bg-gray-100 px-1 rounded">offline_access</code> scopes:
          <br />
          <code className="font-mono bg-gray-100 px-1 rounded break-all">
            {(typeof window !== "undefined" ? window.location.origin : "")}
            /api/integrations/buildingconnected/callback
          </code>
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
            : "Connect your company's accounting and preconstruction systems to sync data into SiteCommand."}
        </p>
      </div>

      {isSiteAdmin ? (
        <>
          <ApsSection />
          <QBOAppSection />
          <XeroAppSection />
          <Sage300CreAppSection />
          <ElevenLabsSection />
        </>
      ) : (
        <>
          <SageSection />
          <QuickBooksSection />
          <XeroSection />
          <Sage300CreSection />
          <BuildingConnectedSection />
          <ElevenLabsCompanySection />
        </>
      )}
    </div>
  );
}
