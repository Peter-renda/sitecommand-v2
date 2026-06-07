"use client";

import { useState, useEffect, useCallback } from "react";
import ProjectNav from "@/components/ProjectNav";
import { SkeletonTable } from "@/app/components/Skeleton";

type EmailProvider = "outlook" | "gmail";

type ProviderInfo = {
  connected: boolean;
  email?: string;
  displayName?: string;
};

type Connections = {
  outlook: ProviderInfo;
  gmail: ProviderInfo;
};

type InboxMessage = {
  id: string;
  subject: string;
  bodyPreview: string;
  conversationId: string;
  isRead: boolean;
  receivedDateTime: string;
  from: { emailAddress: { name: string; address: string } };
  toRecipients: { emailAddress: { name: string; address: string } }[];
};

type LinkedThread = {
  id: string;
  graph_conversation_id: string;
  subject: string;
  participants: string[];
  latest_message_preview: string;
  latest_received_at: string | null;
  message_count: number;
  linked_at: string;
};

const PROVIDER_LABEL: Record<EmailProvider, string> = {
  outlook: "Outlook",
  gmail: "Gmail",
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function getActiveProvider(conns: Connections): { provider: EmailProvider; info: ProviderInfo } | null {
  if (conns.outlook.connected) return { provider: "outlook", info: conns.outlook };
  if (conns.gmail.connected) return { provider: "gmail", info: conns.gmail };
  return null;
}

export default function EmailsClient({ projectId }: { projectId: string }) {
  const [connections, setConnections] = useState<Connections | null>(null);
  const [threads, setThreads] = useState<LinkedThread[]>([]);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [unlinking, setUnlinking] = useState<string | null>(null);

  // Link modal state
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [inbox, setInbox] = useState<InboxMessage[]>([]);
  const [loadingInbox, setLoadingInbox] = useState(false);
  const [selectedConvIds, setSelectedConvIds] = useState<Set<string>>(new Set());
  const [linking, setLinking] = useState(false);
  const [search, setSearch] = useState("");

  // Compose modal state
  const [showCompose, setShowCompose] = useState(false);
  const [composeTo, setComposeTo] = useState("");
  const [composeCc, setComposeCc] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState(false);

  const loadThreads = useCallback(() => {
    setLoadingThreads(true);
    fetch(`/api/projects/${projectId}/emails`)
      .then((r) => r.json())
      .then((data) => setThreads(Array.isArray(data) ? data : []))
      .catch(() => setThreads([]))
      .finally(() => setLoadingThreads(false));
  }, [projectId]);

  useEffect(() => {
    fetch("/api/emails/connection")
      .then((r) => r.json())
      .then((data: Connections) => setConnections(data))
      .catch(() => setConnections({ outlook: { connected: false }, gmail: { connected: false } }));
    loadThreads();
  }, [loadThreads]);

  const openLinkModal = () => {
    setShowLinkModal(true);
    setSelectedConvIds(new Set());
    setSearch("");
    if (inbox.length === 0) {
      setLoadingInbox(true);
      fetch("/api/emails/inbox")
        .then((r) => r.json())
        .then((data) => setInbox(data.messages ?? []))
        .catch(() => setInbox([]))
        .finally(() => setLoadingInbox(false));
    }
  };

  // Deduplicate by conversationId, keeping the most recent message per thread
  const deduplicatedInbox: InboxMessage[] = Object.values(
    inbox.reduce<Record<string, InboxMessage>>((acc, msg) => {
      const existing = acc[msg.conversationId];
      if (!existing || new Date(msg.receivedDateTime) > new Date(existing.receivedDateTime)) {
        acc[msg.conversationId] = msg;
      }
      return acc;
    }, {})
  );

  const linkedConvIds = new Set(threads.map((t) => t.graph_conversation_id));

  const filteredInbox = deduplicatedInbox.filter(
    (m) =>
      !linkedConvIds.has(m.conversationId) &&
      (search === "" ||
        (m.subject || "").toLowerCase().includes(search.toLowerCase()) ||
        m.from.emailAddress.address.toLowerCase().includes(search.toLowerCase()) ||
        m.from.emailAddress.name.toLowerCase().includes(search.toLowerCase()))
  );

  const toggleSelect = (convId: string) => {
    setSelectedConvIds((prev) => {
      const next = new Set(prev);
      if (next.has(convId)) next.delete(convId);
      else next.add(convId);
      return next;
    });
  };

  const allSelected = filteredInbox.length > 0 && selectedConvIds.size === filteredInbox.length;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedConvIds(new Set());
    } else {
      setSelectedConvIds(new Set(filteredInbox.map((m) => m.conversationId)));
    }
  };

  const linkSelected = async () => {
    if (selectedConvIds.size === 0 || linking) return;
    setLinking(true);

    const toLink = deduplicatedInbox.filter((m) => selectedConvIds.has(m.conversationId));

    await Promise.all(
      toLink.map((msg) =>
        fetch(`/api/projects/${projectId}/emails`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            graphConversationId: msg.conversationId,
            subject: msg.subject || "(no subject)",
            participants: [
              msg.from.emailAddress.address,
              ...msg.toRecipients.map((r) => r.emailAddress.address),
            ].filter(Boolean),
            latestMessagePreview: msg.bodyPreview,
            latestReceivedAt: msg.receivedDateTime,
            messageCount: 1,
          }),
        })
      )
    );

    setLinking(false);
    setShowLinkModal(false);
    setSelectedConvIds(new Set());
    loadThreads();
  };

  const unlinkThread = async (threadId: string) => {
    setUnlinking(threadId);
    await fetch(`/api/projects/${projectId}/emails/${threadId}`, { method: "DELETE" });
    setUnlinking(null);
    setThreads((prev) => prev.filter((t) => t.id !== threadId));
  };

  const disconnect = async (provider: EmailProvider) => {
    if (!confirm(`Disconnect your ${PROVIDER_LABEL[provider]} account?`)) return;
    await fetch(`/api/emails/connection?provider=${provider}`, { method: "DELETE" });
    setConnections((prev) =>
      prev ? { ...prev, [provider]: { connected: false } } : null
    );
  };

  const openCompose = () => {
    setSendError(null);
    setSendSuccess(false);
    setShowCompose(true);
  };

  const closeCompose = () => {
    if (sending) return;
    setShowCompose(false);
    setComposeTo("");
    setComposeCc("");
    setComposeSubject("");
    setComposeBody("");
    setSendError(null);
    setSendSuccess(false);
  };

  const sendEmail = async () => {
    if (!composeTo.trim() || !composeSubject.trim() || sending) return;
    setSending(true);
    setSendError(null);
    try {
      const res = await fetch("/api/emails/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: composeTo.trim(),
          subject: composeSubject.trim(),
          body: composeBody,
          cc: composeCc.trim()
            ? composeCc.split(",").map((s) => s.trim()).filter(Boolean)
            : [],
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setSendError(data.error ?? "Failed to send. Please try again.");
      } else {
        setSendSuccess(true);
        setTimeout(closeCompose, 1500);
      }
    } catch {
      setSendError("Network error. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const active = connections ? getActiveProvider(connections) : null;

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <ProjectNav projectId={projectId} />

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Emails</h1>
            <p className="text-sm text-gray-500 mt-1">Email threads linked to this project</p>
          </div>
          {active && (
            <div className="flex items-center gap-2">
              <button
                onClick={openCompose}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                Compose
              </button>
              <button
                onClick={openLinkModal}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-gray-900 text-white rounded-md hover:bg-gray-700 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                Link Emails to Project
              </button>
            </div>
          )}
        </div>

        {/* Connection banner */}
        {connections !== null && (
          <div
            className={`mb-6 px-4 py-3 rounded-lg border text-sm flex items-center justify-between gap-4 ${
              active
                ? "bg-green-50 border-green-200 text-green-800"
                : "bg-amber-50 border-amber-200 text-amber-800"
            }`}
          >
            {active ? (
              <>
                <span>
                  Connected to{" "}
                  <strong>{PROVIDER_LABEL[active.provider]}</strong> as{" "}
                  <strong>{active.info.email}</strong>
                </span>
                <button
                  onClick={() => disconnect(active.provider)}
                  className="text-xs underline shrink-0 hover:opacity-80"
                >
                  Disconnect
                </button>
              </>
            ) : (
              <>
                <span>Connect an email account to link threads to this project.</span>
                <span className="flex items-center gap-2 shrink-0">
                  <a
                    href={`/api/auth/outlook/connect?projectId=${projectId}`}
                    className="px-3 py-1.5 text-xs font-medium bg-[#0078D4] text-white rounded hover:opacity-90 transition-opacity"
                  >
                    Connect Outlook
                  </a>
                  <a
                    href={`/api/auth/google/connect?projectId=${projectId}`}
                    className="px-3 py-1.5 text-xs font-medium bg-[#EA4335] text-white rounded hover:opacity-90 transition-opacity"
                  >
                    Connect Gmail
                  </a>
                </span>
              </>
            )}
          </div>
        )}

        {/* Thread table */}
        {loadingThreads ? (
          <SkeletonTable rows={5} cols={4} />
        ) : threads.length === 0 ? (
          <div className="py-20 text-center bg-white border border-gray-200 rounded-xl">
            <svg
              className="w-10 h-10 text-gray-300 mx-auto mb-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
              />
            </svg>
            <p className="text-sm font-medium text-gray-500 mb-1">No email threads linked yet</p>
            <p className="text-xs text-gray-400">
              {active
                ? 'Click "Link Emails to Project" to attach conversations to this project.'
                : "Connect an Outlook or Gmail account to get started."}
            </p>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left">Subject</th>
                  <th className="px-4 py-3 text-left">Participants</th>
                  <th className="px-4 py-3 text-left">Latest Message</th>
                  <th className="px-4 py-3 text-left">Linked</th>
                  <th className="px-4 py-3 w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {threads.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900 truncate max-w-xs">{t.subject}</div>
                      <div className="text-xs text-gray-400 truncate max-w-xs mt-0.5">
                        {t.latest_message_preview}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 max-w-[180px]">
                      <div className="truncate">
                        {t.participants.slice(0, 2).join(", ")}
                        {t.participants.length > 2 && ` +${t.participants.length - 2}`}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{formatDate(t.latest_received_at)}</td>
                    <td className="px-4 py-3 text-xs text-gray-400">{timeAgo(t.linked_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => unlinkThread(t.id)}
                        disabled={unlinking === t.id}
                        title="Unlink thread"
                        className="text-gray-300 hover:text-red-500 transition-colors disabled:opacity-50"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* ── Link Emails Modal ── */}
      {showLinkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => !linking && setShowLinkModal(false)}
          />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[80vh]">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Link Emails to Project</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Select emails to link. All messages in the same thread will be linked together.
                </p>
              </div>
              <button
                onClick={() => setShowLinkModal(false)}
                disabled={linking}
                className="text-gray-400 hover:text-gray-600 disabled:opacity-40"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Search */}
            <div className="px-6 py-3 border-b border-gray-100 shrink-0">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by subject or sender…"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>

            {/* Select-all row */}
            {!loadingInbox && filteredInbox.length > 0 && (
              <div className="px-6 py-2.5 border-b border-gray-100 bg-gray-50 shrink-0 flex items-center gap-3">
                <input
                  id="select-all"
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 rounded border-gray-300 text-gray-900 accent-gray-900"
                />
                <label htmlFor="select-all" className="text-xs text-gray-500 cursor-pointer select-none">
                  {allSelected ? "Deselect all" : `Select all (${filteredInbox.length})`}
                </label>
              </div>
            )}

            {/* Email list */}
            <div className="flex-1 overflow-y-auto">
              {loadingInbox ? (
                <div className="px-6 py-12 text-center text-sm text-gray-400">Loading inbox…</div>
              ) : filteredInbox.length === 0 ? (
                <div className="px-6 py-12 text-center text-sm text-gray-400">
                  {inbox.length === 0 ? "No messages found in inbox." : "No matching messages."}
                </div>
              ) : (
                filteredInbox.map((msg) => {
                  const selected = selectedConvIds.has(msg.conversationId);
                  return (
                    <label
                      key={msg.conversationId}
                      className={`flex items-start gap-3 px-6 py-3 border-b border-gray-100 cursor-pointer transition-colors ${
                        selected ? "bg-blue-50 hover:bg-blue-50" : "hover:bg-gray-50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleSelect(msg.conversationId)}
                        className="mt-0.5 w-4 h-4 rounded border-gray-300 accent-gray-900 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div
                          className={`text-sm truncate ${
                            msg.isRead ? "text-gray-600" : "font-semibold text-gray-900"
                          }`}
                        >
                          {msg.subject || "(no subject)"}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5 truncate">
                          {msg.from.emailAddress.name || msg.from.emailAddress.address}
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5 truncate">{msg.bodyPreview}</div>
                      </div>
                      <span className="text-xs text-gray-400 shrink-0 mt-0.5">
                        {formatDate(msg.receivedDateTime)}
                      </span>
                    </label>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-200 shrink-0 flex items-center justify-between gap-4">
              <span className="text-xs text-gray-500">
                {selectedConvIds.size > 0
                  ? `${selectedConvIds.size} thread${selectedConvIds.size !== 1 ? "s" : ""} selected`
                  : "Select emails above to link them"}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowLinkModal(false)}
                  disabled={linking}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={linkSelected}
                  disabled={selectedConvIds.size === 0 || linking}
                  className="px-4 py-2 text-sm font-medium bg-gray-900 text-white rounded-md hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {linking
                    ? "Linking…"
                    : `Link${selectedConvIds.size > 0 ? ` ${selectedConvIds.size}` : ""} Selected`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Compose Email Modal ── */}
      {showCompose && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={closeCompose}
          />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-base font-semibold text-gray-900">Compose Email</h2>
              <button
                onClick={closeCompose}
                disabled={sending}
                className="text-gray-400 hover:text-gray-600 disabled:opacity-40"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Fields */}
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">To</label>
                <input
                  type="email"
                  value={composeTo}
                  onChange={(e) => setComposeTo(e.target.value)}
                  placeholder="recipient@example.com"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  CC{" "}
                  <span className="text-gray-400 font-normal">(optional — comma-separated)</span>
                </label>
                <input
                  type="text"
                  value={composeCc}
                  onChange={(e) => setComposeCc(e.target.value)}
                  placeholder="cc@example.com, another@example.com"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Subject</label>
                <input
                  type="text"
                  value={composeSubject}
                  onChange={(e) => setComposeSubject(e.target.value)}
                  placeholder="Subject line"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Message</label>
                <textarea
                  value={composeBody}
                  onChange={(e) => setComposeBody(e.target.value)}
                  placeholder="Write your message…"
                  rows={7}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
                />
              </div>

              {sendError && (
                <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {sendError}
                </p>
              )}
              {sendSuccess && (
                <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                  Email sent successfully!
                </p>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between gap-4">
              {active && (
                <span className="text-xs text-gray-400 truncate">
                  From: <strong>{active.info.email}</strong>
                </span>
              )}
              <div className="flex items-center gap-2 ml-auto shrink-0">
                <button
                  onClick={closeCompose}
                  disabled={sending}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={sendEmail}
                  disabled={sending || !composeTo.trim() || !composeSubject.trim() || sendSuccess}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-gray-900 text-white rounded-md hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {sending ? (
                    "Sending…"
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                      Send
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
