import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import ProjectNav from "../components/ProjectNav";

// ── Types ────────────────────────────────────────────────────────────────────

type Connection = {
  connected: boolean;
  email?: string;
  displayName?: string;
};

type InboxMessage = {
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

// ── Helpers ──────────────────────────────────────────────────────────────────

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

// ── Main Component ────────────────────────────────────────────────────────────

export default function Emails() {
  const { id: projectId } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const [conn, setConn] = useState<Connection | null>(null);
  const [loadingConn, setLoadingConn] = useState(true);

  const [activeTab, setActiveTab] = useState<"linked" | "inbox">("linked");

  const [linkedThreads, setLinkedThreads] = useState<LinkedThread[]>([]);
  const [loadingLinked, setLoadingLinked] = useState(false);

  const [inbox, setInbox] = useState<InboxMessage[]>([]);
  const [loadingInbox, setLoadingInbox] = useState(false);
  const [inboxLoaded, setInboxLoaded] = useState(false);
  const [search, setSearch] = useState("");

  const [linkingId, setLinkingId] = useState<string | null>(null);

  const [showDraft, setShowDraft] = useState(false);
  const [draft, setDraft] = useState<DraftForm>({ to: "", subject: "", body: "" });
  const [draftSaving, setDraftSaving] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);

  const [toast, setToast] = useState<string | null>(null);
  const toastKey = useRef(0);

  function showToast(msg: string) {
    toastKey.current += 1;
    setToast(msg);
  }

  // ── Boot: check connection + handle OAuth return ──────────────────────────

  useEffect(() => {
    fetch("/api/emails/connection")
      .then((r) => r.json())
      .then((d) => { setConn(d); setLoadingConn(false); });
  }, []);

  useEffect(() => {
    const param = searchParams.get("connected");
    const err = searchParams.get("error");
    if (param === "outlook") {
      showToast("Outlook connected successfully.");
      setSearchParams({}, { replace: true });
    } else if (err) {
      showToast("Could not connect to Outlook. Please try again.");
      setSearchParams({}, { replace: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Load linked threads ───────────────────────────────────────────────────

  const loadLinked = useCallback(async () => {
    if (!projectId || !conn?.connected) return;
    setLoadingLinked(true);
    const r = await fetch(`/api/projects/${projectId}/emails`);
    const d = await r.json();
    setLinkedThreads(Array.isArray(d) ? d : []);
    setLoadingLinked(false);
  }, [projectId, conn?.connected]);

  useEffect(() => {
    if (activeTab === "linked" && conn?.connected) loadLinked();
  }, [activeTab, conn?.connected, loadLinked]);

  // ── Load inbox (lazy — only on first switch to tab) ───────────────────────

  const loadInbox = useCallback(async () => {
    if (!conn?.connected) return;
    setLoadingInbox(true);
    const r = await fetch("/api/emails/inbox");
    const d = await r.json();
    if (d.error === "not_connected") {
      setConn({ connected: false });
    } else {
      setInbox(d.messages ?? []);
      setInboxLoaded(true);
    }
    setLoadingInbox(false);
  }, [conn?.connected]);

  useEffect(() => {
    if (activeTab === "inbox" && conn?.connected && !inboxLoaded) loadInbox();
  }, [activeTab, conn?.connected, inboxLoaded, loadInbox]);

  // ── Filtered inbox ────────────────────────────────────────────────────────

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

  async function handleDisconnect() {
    if (
      !window.confirm(
        "Disconnect your Outlook account? Linked email threads will remain but you won't be able to browse or add new ones."
      )
    )
      return;
    await fetch("/api/emails/connection", { method: "DELETE" });
    setConn({ connected: false });
    showToast("Outlook disconnected.");
  }

  async function handleLink(msg: InboxMessage) {
    setLinkingId(msg.conversationId);
    await fetch(`/api/projects/${projectId}/emails`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        graphConversationId: msg.conversationId,
        subject: msg.subject,
        participants: [
          {
            name: msg.from.emailAddress.name,
            email: msg.from.emailAddress.address,
          },
        ],
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
    await fetch(`/api/projects/${projectId}/emails/${threadId}`, {
      method: "DELETE",
    });
    setLinkedThreads((prev) => prev.filter((t) => t.id !== threadId));
    showToast("Thread unlinked.");
  }

  async function handleDraftSubmit(e: React.FormEvent) {
    e.preventDefault();
    setDraftSaving(true);
    const r = await fetch(`/api/projects/${projectId}/emails/drafts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: { email: draft.to },
        subject: draft.subject,
        body: draft.body,
      }),
    });
    setDraftSaving(false);
    if (r.ok) {
      setDraftSaved(true);
      setTimeout(() => {
        setShowDraft(false);
        setDraftSaved(false);
        setDraft({ to: "", subject: "", body: "" });
      }, 2500);
    } else {
      showToast("Failed to save draft. Please try again.");
    }
  }

  function closeDraft() {
    setShowDraft(false);
    setDraftSaved(false);
    setDraft({ to: "", subject: "", body: "" });
  }

  // ── Render: loading ───────────────────────────────────────────────────────

  if (loadingConn) {
    return (
      <div className="min-h-screen bg-gray-50">
        <ProjectNav projectId={projectId!} />
        <div className="flex items-center justify-center h-64 text-sm text-gray-400">
          Loading…
        </div>
      </div>
    );
  }

  // ── Render: not connected ─────────────────────────────────────────────────

  if (!conn?.connected) {
    return (
      <div className="min-h-screen bg-gray-50">
        <ProjectNav projectId={projectId!} />
        <div className="max-w-xl mx-auto px-6 py-20 text-center">
          <div className="mx-auto mb-6 w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-blue-500"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25H4.5a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5H4.5a2.25 2.25 0 00-2.25 2.25m19.5 0l-9.75 6.75L2.25 6.75"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Connect your Outlook inbox
          </h2>
          <p className="text-sm text-gray-500 mb-8 max-w-sm mx-auto">
            Link email threads to this project and compose drafts that land in
            your Outlook Drafts folder for review before sending.
          </p>
          <a
            href={`/api/auth/outlook/connect?projectId=${projectId}`}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors"
          >
            <MailIcon className="w-4 h-4" />
            Connect Outlook
          </a>
          <p className="text-xs text-gray-400 mt-4">
            Requires Microsoft 365 or Outlook.com. SiteCommand never sends
            email on your behalf.
          </p>
        </div>
        {toast && (
          <Toast key={toastKey.current} message={toast} onDone={() => setToast(null)} />
        )}
      </div>
    );
  }

  // ── Render: connected ─────────────────────────────────────────────────────

  const linkedConvIds = new Set(linkedThreads.map((t) => t.graph_conversation_id));

  return (
    <div className="min-h-screen bg-gray-50">
      <ProjectNav projectId={projectId!} />

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Emails</h1>
            <p className="text-xs text-gray-400 mt-0.5">{conn.email}</p>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={handleDisconnect}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              Disconnect
            </button>
            <button
              onClick={() => setShowDraft(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 4.5v15m7.5-7.5h-15"
                />
              </svg>
              Compose Draft
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-gray-200 mb-6">
          {(
            [
              {
                key: "linked",
                label: `Linked to Project${linkedThreads.length ? ` (${linkedThreads.length})` : ""}`,
              },
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
          <>
            {loadingLinked ? (
              <p className="text-sm text-gray-400">Loading…</p>
            ) : linkedThreads.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-sm text-gray-500">
                  No email threads linked to this project yet.
                </p>
                <button
                  onClick={() => setActiveTab("inbox")}
                  className="mt-2 text-xs text-blue-600 hover:text-blue-800 transition-colors"
                >
                  Browse your inbox →
                </button>
              </div>
            ) : (
              <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
                {linkedThreads.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-start gap-3 px-5 py-4 hover:bg-gray-50 transition-colors"
                  >
                    <Avatar name={t.participants[0]?.name ?? t.subject} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900 truncate">
                          {t.subject || "(no subject)"}
                        </span>
                        <span className="text-xs text-gray-400 whitespace-nowrap ml-auto">
                          {t.latest_received_at ? fmtDate(t.latest_received_at) : ""}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 truncate mt-0.5">
                        {t.participants.map((p) => p.name || p.email).join(", ")}
                        {t.latest_message_preview
                          ? ` · ${t.latest_message_preview}`
                          : ""}
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
            )}
          </>
        )}

        {/* ── Inbox tab ── */}
        {activeTab === "inbox" && (
          <>
            <div className="mb-4 flex gap-2">
              <input
                type="text"
                placeholder="Filter by subject, sender, or content…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
              <button
                onClick={() => { setInboxLoaded(false); loadInbox(); }}
                className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 transition-colors"
              >
                Refresh
              </button>
            </div>

            {loadingInbox ? (
              <p className="text-sm text-gray-400">Loading inbox…</p>
            ) : filteredInbox.length === 0 ? (
              <p className="text-sm text-gray-400">
                {search ? "No messages match your filter." : "Inbox is empty."}
              </p>
            ) : (
              <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
                {filteredInbox.map((msg) => {
                  const isLinked = linkedConvIds.has(msg.conversationId);
                  return (
                    <div
                      key={msg.id}
                      className="flex items-start gap-3 px-5 py-4 hover:bg-gray-50 transition-colors"
                    >
                      <Avatar name={msg.from.emailAddress.name || msg.from.emailAddress.address} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {!msg.isRead && (
                            <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                          )}
                          <span
                            className={`text-sm truncate ${
                              msg.isRead
                                ? "text-gray-700"
                                : "font-semibold text-gray-900"
                            }`}
                          >
                            {msg.subject || "(no subject)"}
                          </span>
                          <span className="text-xs text-gray-400 whitespace-nowrap ml-auto">
                            {fmtDate(msg.receivedDateTime)}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 truncate mt-0.5">
                          {msg.from.emailAddress.name ||
                            msg.from.emailAddress.address}{" "}
                          · {msg.bodyPreview}
                        </p>
                      </div>
                      <div className="flex-shrink-0 ml-2">
                        {isLinked ? (
                          <span className="text-xs font-medium text-green-600">
                            Linked
                          </span>
                        ) : (
                          <button
                            disabled={linkingId === msg.conversationId}
                            onClick={() => handleLink(msg)}
                            className="text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors disabled:opacity-40"
                          >
                            {linkingId === msg.conversationId
                              ? "Linking…"
                              : "Link"}
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
              <h2 className="text-base font-semibold text-gray-900">
                Compose Draft
              </h2>
              <button
                onClick={closeDraft}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {draftSaved ? (
              <div className="px-6 py-12 text-center">
                <svg
                  className="w-10 h-10 mx-auto text-green-500 mb-3"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <p className="text-sm font-medium text-gray-900">
                  Draft saved to Outlook
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Open Outlook to review and send.
                </p>
              </div>
            ) : (
              <form onSubmit={handleDraftSubmit} className="px-6 py-5 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    To
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="recipient@example.com"
                    value={draft.to}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, to: e.target.value }))
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Subject
                  </label>
                  <input
                    type="text"
                    required
                    value={draft.subject}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, subject: e.target.value }))
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Body
                  </label>
                  <textarea
                    required
                    rows={7}
                    value={draft.body}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, body: e.target.value }))
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
                  />
                </div>
                <p className="text-xs text-gray-400">
                  Saved to your Outlook Drafts folder. SiteCommand does not
                  send email on your behalf.
                </p>
                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={closeDraft}
                    className="flex-1 py-2 border border-gray-200 text-sm text-gray-600 rounded-md hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={draftSaving}
                    className="flex-1 py-2 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-700 transition-colors disabled:opacity-50"
                  >
                    {draftSaving ? "Saving…" : "Save to Drafts"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {toast && (
        <Toast key={toastKey.current} message={toast} onDone={() => setToast(null)} />
      )}
    </div>
  );
}

function MailIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25H4.5a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5H4.5a2.25 2.25 0 00-2.25 2.25m19.5 0l-9.75 6.75L2.25 6.75"
      />
    </svg>
  );
}
