import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import ProjectNav from "../components/ProjectNav";

// ── Types ─────────────────────────────────────────────────────────────────────

type ProviderConn = { connected: boolean; email?: string; displayName?: string };
type Connections = { outlook: ProviderConn; gmail: ProviderConn };

type EmailMessage = {
  id: string;
  subject: string;
  bodyPreview: string;
  conversationId: string;
  isRead: boolean;
  hasAttachments: boolean;
  receivedDateTime: string;
  from: { emailAddress: { name: string; address: string } };
};

type LinkedThread = {
  id: string;
  graph_conversation_id: string;
  subject: string;
  participants: { name: string; email: string }[];
  latest_message_preview: string;
  latest_received_at: string | null;
  message_count: number;
  linked_at: string;
};

type DraftForm = { to: string; subject: string; body: string };
type Provider = "gmail" | "outlook";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days === 0) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (days === 1) return "Yesterday";
  if (days < 7) return d.toLocaleDateString([], { weekday: "short" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase();
  return (
    <span className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold flex items-center justify-center">
      {initials || "?"}
    </span>
  );
}

function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 4000);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div className="fixed bottom-6 right-6 z-50 bg-gray-900 text-white text-sm px-4 py-2.5 rounded-lg shadow-lg">
      {message}
    </div>
  );
}

function ProviderLogo({ provider }: { provider: Provider }) {
  if (provider === "gmail") {
    return (
      <svg viewBox="0 0 24 24" className="w-5 h-5" xmlns="http://www.w3.org/2000/svg">
        <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 010 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z" fill="#EA4335"/>
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" xmlns="http://www.w3.org/2000/svg">
      <path d="M23 5.5A2.5 2.5 0 0020.5 3h-17A2.5 2.5 0 001 5.5v13A2.5 2.5 0 003.5 21h17a2.5 2.5 0 002.5-2.5v-13zm-2.5-.5a.5.5 0 01.5.5v.306l-9 6-9-6V5.5a.5.5 0 01.5-.5h17zm.5 14a.5.5 0 01-.5.5h-17a.5.5 0 01-.5-.5V7.906l8.445 5.63a1 1 0 001.11 0L21 7.906V18.5z" fill="#0078D4"/>
    </svg>
  );
}

const PROVIDER_LABEL: Record<Provider, string> = {
  gmail: "Gmail",
  outlook: "Outlook",
};

// ── Main Component ────────────────────────────────────────────────────────────

export default function Emails() {
  const { id: projectId } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const [conns, setConns] = useState<Connections | null>(null);
  const [loadingConns, setLoadingConns] = useState(true);

  // Which provider's inbox is active
  const [activeProvider, setActiveProvider] = useState<Provider>("gmail");
  const [activeTab, setActiveTab] = useState<"linked" | "inbox">("linked");

  const [linkedThreads, setLinkedThreads] = useState<LinkedThread[]>([]);
  const [loadingLinked, setLoadingLinked] = useState(false);

  // Inbox per provider (cached separately)
  const [inboxCache, setInboxCache] = useState<Record<Provider, EmailMessage[]>>({ gmail: [], outlook: [] });
  const [loadingInbox, setLoadingInbox] = useState(false);
  const [inboxLoaded, setInboxLoaded] = useState<Record<Provider, boolean>>({ gmail: false, outlook: false });
  const [search, setSearch] = useState("");

  const [linkingId, setLinkingId] = useState<string | null>(null);

  const [showDraft, setShowDraft] = useState(false);
  const [draftProvider, setDraftProvider] = useState<Provider>("gmail");
  const [draft, setDraft] = useState<DraftForm>({ to: "", subject: "", body: "" });
  const [draftSaving, setDraftSaving] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);

  const [toast, setToast] = useState<string | null>(null);
  const toastKey = useRef(0);

  function showToast(msg: string) {
    toastKey.current += 1;
    setToast(msg);
  }

  const anyConnected = conns ? conns.gmail.connected || conns.outlook.connected : false;

  // ── Boot ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    fetch("/api/emails/connection")
      .then((r) => r.json())
      .then((d: Connections) => {
        setConns(d);
        // Default active provider to whichever is connected
        if (d.gmail.connected) setActiveProvider("gmail");
        else if (d.outlook.connected) setActiveProvider("outlook");
        setLoadingConns(false);
      });
  }, []);

  useEffect(() => {
    const param = searchParams.get("connected");
    const err = searchParams.get("error");
    if (param === "gmail" || param === "outlook") {
      showToast(`${PROVIDER_LABEL[param as Provider]} connected successfully.`);
      setSearchParams({}, { replace: true });
      // Re-fetch connection status
      fetch("/api/emails/connection")
        .then((r) => r.json())
        .then((d: Connections) => setConns(d));
    } else if (err) {
      showToast("Could not connect. Please try again.");
      setSearchParams({}, { replace: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Linked threads ────────────────────────────────────────────────────────

  const loadLinked = useCallback(async () => {
    if (!projectId || !anyConnected) return;
    setLoadingLinked(true);
    const r = await fetch(`/api/projects/${projectId}/emails`);
    const d = await r.json();
    setLinkedThreads(Array.isArray(d) ? d : []);
    setLoadingLinked(false);
  }, [projectId, anyConnected]);

  useEffect(() => {
    if (activeTab === "linked" && anyConnected) loadLinked();
  }, [activeTab, anyConnected, loadLinked]);

  // ── Inbox ─────────────────────────────────────────────────────────────────

  const loadInbox = useCallback(async (provider: Provider) => {
    if (!conns?.[provider].connected) return;
    setLoadingInbox(true);
    const r = await fetch(`/api/emails/inbox?provider=${provider}`);
    const d = await r.json();
    if (d.error === "not_connected") {
      setConns((prev) => prev ? { ...prev, [provider]: { connected: false } } : prev);
    } else {
      setInboxCache((prev) => ({ ...prev, [provider]: d.messages ?? [] }));
      setInboxLoaded((prev) => ({ ...prev, [provider]: true }));
    }
    setLoadingInbox(false);
  }, [conns]);

  useEffect(() => {
    if (activeTab === "inbox" && conns?.[activeProvider].connected && !inboxLoaded[activeProvider]) {
      loadInbox(activeProvider);
    }
  }, [activeTab, activeProvider, conns, inboxLoaded, loadInbox]);

  // When switching provider in inbox tab, load if not cached
  function handleProviderSwitch(p: Provider) {
    setActiveProvider(p);
    setSearch("");
    if (activeTab === "inbox" && conns?.[p].connected && !inboxLoaded[p]) {
      loadInbox(p);
    }
  }

  const inbox = inboxCache[activeProvider];
  const filteredInbox = search.trim()
    ? inbox.filter(
        (m) =>
          m.subject.toLowerCase().includes(search.toLowerCase()) ||
          m.from.emailAddress.name.toLowerCase().includes(search.toLowerCase()) ||
          m.from.emailAddress.address.toLowerCase().includes(search.toLowerCase()) ||
          m.bodyPreview.toLowerCase().includes(search.toLowerCase())
      )
    : inbox;

  // ── Actions ───────────────────────────────────────────────────────────────

  async function handleDisconnect(provider: Provider) {
    if (!window.confirm(`Disconnect ${PROVIDER_LABEL[provider]}? Linked threads will remain.`)) return;
    await fetch(`/api/emails/connection?provider=${provider}`, { method: "DELETE" });
    setConns((prev) => prev ? { ...prev, [provider]: { connected: false } } : prev);
    showToast(`${PROVIDER_LABEL[provider]} disconnected.`);
  }

  async function handleLink(msg: EmailMessage) {
    setLinkingId(msg.conversationId);
    await fetch(`/api/projects/${projectId}/emails`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        graphConversationId: msg.conversationId,
        subject: msg.subject,
        participants: [{ name: msg.from.emailAddress.name, email: msg.from.emailAddress.address }],
        latestMessagePreview: msg.bodyPreview,
        latestReceivedAt: msg.receivedDateTime,
        messageCount: 1,
      }),
    });
    setLinkingId(null);
    showToast("Thread linked to project.");
    loadLinked();
  }

  async function handleUnlink(threadId: string) {
    await fetch(`/api/projects/${projectId}/emails/${threadId}`, { method: "DELETE" });
    setLinkedThreads((prev) => prev.filter((t) => t.id !== threadId));
    showToast("Thread unlinked.");
  }

  async function handleDraftSubmit(e: React.FormEvent) {
    e.preventDefault();
    setDraftSaving(true);
    const r = await fetch(`/api/projects/${projectId}/emails/drafts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: draftProvider, to: { email: draft.to }, subject: draft.subject, body: draft.body }),
    });
    setDraftSaving(false);
    if (r.ok) {
      setDraftSaved(true);
      setTimeout(() => { setShowDraft(false); setDraftSaved(false); setDraft({ to: "", subject: "", body: "" }); }, 2500);
    } else {
      showToast("Failed to save draft. Please try again.");
    }
  }

  function closeDraft() {
    setShowDraft(false);
    setDraftSaved(false);
    setDraft({ to: "", subject: "", body: "" });
  }

  function openDraft() {
    // Default draft provider to whichever is connected (prefer gmail)
    if (conns?.gmail.connected) setDraftProvider("gmail");
    else if (conns?.outlook.connected) setDraftProvider("outlook");
    setShowDraft(true);
  }

  // ── Render: loading ───────────────────────────────────────────────────────

  if (loadingConns) {
    return (
      <div className="min-h-screen bg-gray-50">
        <ProjectNav projectId={projectId!} />
        <div className="flex items-center justify-center h-64 text-sm text-gray-400">Loading…</div>
      </div>
    );
  }

  // ── Render: nothing connected ─────────────────────────────────────────────

  if (!anyConnected) {
    return (
      <div className="min-h-screen bg-gray-50">
        <ProjectNav projectId={projectId!} />
        <div className="max-w-xl mx-auto px-6 py-20 text-center">
          <div className="mx-auto mb-6 w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center">
            <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25H4.5a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5H4.5a2.25 2.25 0 00-2.25 2.25m19.5 0l-9.75 6.75L2.25 6.75" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Connect your inbox</h2>
          <p className="text-sm text-gray-500 mb-8 max-w-sm mx-auto">
            Link email threads to this project and compose drafts that land in your Drafts folder for review before sending.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href={`/api/auth/gmail/connect?projectId=${projectId}`}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-white border border-gray-200 text-gray-800 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
            >
              <ProviderLogo provider="gmail" />
              Connect Gmail
            </a>
            <a
              href={`/api/auth/outlook/connect?projectId=${projectId}`}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-white border border-gray-200 text-gray-800 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
            >
              <ProviderLogo provider="outlook" />
              Connect Outlook
            </a>
          </div>
          <p className="text-xs text-gray-400 mt-4">
            SiteCommand never sends email on your behalf — drafts are saved to your inbox for review.
          </p>
        </div>
        {toast && <Toast key={toastKey.current} message={toast} onDone={() => setToast(null)} />}
      </div>
    );
  }

  // ── Render: connected ─────────────────────────────────────────────────────

  const linkedConvIds = new Set(linkedThreads.map((t) => t.graph_conversation_id));
  const connectedProviders = (["gmail", "outlook"] as Provider[]).filter((p) => conns?.[p].connected);

  return (
    <div className="min-h-screen bg-gray-50">
      <ProjectNav projectId={projectId!} />

      <main className="max-w-6xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Emails</h1>
            <div className="flex items-center gap-3 mt-0.5">
              {connectedProviders.map((p) => (
                <span key={p} className="flex items-center gap-1 text-xs text-gray-400">
                  <ProviderLogo provider={p} />
                  {conns![p].email}
                  <button onClick={() => handleDisconnect(p)} className="ml-1 hover:text-red-400 transition-colors">×</button>
                </span>
              ))}
              {/* Connect additional provider */}
              {!conns?.gmail.connected && (
                <a href={`/api/auth/gmail/connect?projectId=${projectId}`} className="text-xs text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-1">
                  <ProviderLogo provider="gmail" /> Connect Gmail
                </a>
              )}
              {!conns?.outlook.connected && (
                <a href={`/api/auth/outlook/connect?projectId=${projectId}`} className="text-xs text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-1">
                  <ProviderLogo provider="outlook" /> Connect Outlook
                </a>
              )}
            </div>
          </div>
          <button
            onClick={openDraft}
            className="flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Compose Draft
          </button>
        </div>

        {/* Provider switcher (only when both connected and on inbox tab) */}
        {connectedProviders.length > 1 && activeTab === "inbox" && (
          <div className="flex gap-2 mb-4">
            {connectedProviders.map((p) => (
              <button
                key={p}
                onClick={() => handleProviderSwitch(p)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  activeProvider === p
                    ? "bg-gray-900 text-white border-gray-900"
                    : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                }`}
              >
                <ProviderLogo provider={p} />
                {PROVIDER_LABEL[p]}
              </button>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 border-b border-gray-200 mb-6">
          {(
            [
              { key: "linked", label: `Linked to Project${linkedThreads.length ? ` (${linkedThreads.length})` : ""}` },
              { key: "inbox", label: "Inbox" },
            ] as const
          ).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === key
                  ? "border-gray-900 text-gray-900"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── Linked tab ── */}
        {activeTab === "linked" && (
          loadingLinked ? (
            <p className="text-sm text-gray-400">Loading…</p>
          ) : linkedThreads.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-sm text-gray-500">No email threads linked to this project yet.</p>
              <button onClick={() => setActiveTab("inbox")} className="mt-2 text-xs text-blue-600 hover:text-blue-800 transition-colors">
                Browse your inbox →
              </button>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
              {linkedThreads.map((t) => (
                <div key={t.id} className="flex items-start gap-3 px-5 py-4 hover:bg-gray-50 transition-colors">
                  <Avatar name={t.participants[0]?.name ?? t.subject} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900 truncate">{t.subject || "(no subject)"}</span>
                      <span className="text-xs text-gray-400 whitespace-nowrap ml-auto">
                        {t.latest_received_at ? fmtDate(t.latest_received_at) : ""}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 truncate mt-0.5">
                      {t.participants.map((p) => p.name || p.email).join(", ")}
                      {t.latest_message_preview ? ` · ${t.latest_message_preview}` : ""}
                    </p>
                  </div>
                  <button
                    onClick={() => handleUnlink(t.id)}
                    className="flex-shrink-0 text-xs text-gray-400 hover:text-red-500 transition-colors ml-2"
                  >
                    Unlink
                  </button>
                </div>
              ))}
            </div>
          )
        )}

        {/* ── Inbox tab ── */}
        {activeTab === "inbox" && (
          <>
            <div className="mb-4 flex gap-2">
              <input
                type="text"
                placeholder={`Filter ${PROVIDER_LABEL[activeProvider]} inbox…`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
              <button
                onClick={() => { setInboxLoaded((prev) => ({ ...prev, [activeProvider]: false })); loadInbox(activeProvider); }}
                className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 transition-colors"
              >
                Refresh
              </button>
            </div>

            {loadingInbox ? (
              <p className="text-sm text-gray-400">Loading inbox…</p>
            ) : !conns?.[activeProvider].connected ? (
              <div className="text-center py-12">
                <p className="text-sm text-gray-500 mb-3">{PROVIDER_LABEL[activeProvider]} is not connected.</p>
                <a
                  href={`/api/auth/${activeProvider === "gmail" ? "gmail" : "outlook"}/connect?projectId=${projectId}`}
                  className="text-sm text-blue-600 hover:text-blue-800 transition-colors"
                >
                  Connect {PROVIDER_LABEL[activeProvider]} →
                </a>
              </div>
            ) : filteredInbox.length === 0 ? (
              <p className="text-sm text-gray-400">
                {search ? "No messages match your filter." : "Inbox is empty."}
              </p>
            ) : (
              <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
                {filteredInbox.map((msg) => {
                  const isLinked = linkedConvIds.has(msg.conversationId);
                  return (
                    <div key={msg.id} className="flex items-start gap-3 px-5 py-4 hover:bg-gray-50 transition-colors">
                      <Avatar name={msg.from.emailAddress.name || msg.from.emailAddress.address} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {!msg.isRead && <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />}
                          <span className={`text-sm truncate ${msg.isRead ? "text-gray-700" : "font-semibold text-gray-900"}`}>
                            {msg.subject || "(no subject)"}
                          </span>
                          <span className="text-xs text-gray-400 whitespace-nowrap ml-auto">{fmtDate(msg.receivedDateTime)}</span>
                        </div>
                        <p className="text-xs text-gray-500 truncate mt-0.5">
                          {msg.from.emailAddress.name || msg.from.emailAddress.address} · {msg.bodyPreview}
                        </p>
                      </div>
                      <div className="flex-shrink-0 ml-2">
                        {isLinked ? (
                          <span className="text-xs font-medium text-green-600">Linked</span>
                        ) : (
                          <button
                            disabled={linkingId === msg.conversationId}
                            onClick={() => handleLink(msg)}
                            className="text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors disabled:opacity-40"
                          >
                            {linkingId === msg.conversationId ? "Linking…" : "Link"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>

      {/* ── Draft modal ── */}
      {showDraft && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl w-full max-w-lg shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">Compose Draft</h2>
              <button onClick={closeDraft} className="text-gray-400 hover:text-gray-600 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {draftSaved ? (
              <div className="px-6 py-12 text-center">
                <svg className="w-10 h-10 mx-auto text-green-500 mb-3" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm font-medium text-gray-900">Draft saved to {PROVIDER_LABEL[draftProvider]}</p>
                <p className="text-xs text-gray-500 mt-1">Open {PROVIDER_LABEL[draftProvider]} to review and send.</p>
              </div>
            ) : (
              <form onSubmit={handleDraftSubmit} className="px-6 py-5 space-y-4">
                {/* Provider selector */}
                {connectedProviders.length > 1 && (
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Send via</label>
                    <div className="flex gap-2">
                      {connectedProviders.map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setDraftProvider(p)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                            draftProvider === p
                              ? "bg-gray-900 text-white border-gray-900"
                              : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                          }`}
                        >
                          <ProviderLogo provider={p} />
                          {PROVIDER_LABEL[p]}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">To</label>
                  <input
                    type="email"
                    required
                    placeholder="recipient@example.com"
                    value={draft.to}
                    onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Subject</label>
                  <input
                    type="text"
                    required
                    value={draft.subject}
                    onChange={(e) => setDraft((d) => ({ ...d, subject: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Body</label>
                  <textarea
                    required
                    rows={7}
                    value={draft.body}
                    onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
                  />
                </div>
                <p className="text-xs text-gray-400">
                  Saved to {PROVIDER_LABEL[draftProvider]} Drafts. SiteCommand does not send email on your behalf.
                </p>
                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={closeDraft} className="flex-1 py-2 border border-gray-200 text-sm text-gray-600 rounded-md hover:bg-gray-50 transition-colors">
                    Cancel
                  </button>
                  <button type="submit" disabled={draftSaving} className="flex-1 py-2 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-700 transition-colors disabled:opacity-50">
                    {draftSaving ? "Saving…" : "Save to Drafts"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {toast && <Toast key={toastKey.current} message={toast} onDone={() => setToast(null)} />}
    </div>
  );
}
