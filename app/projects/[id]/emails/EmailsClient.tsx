"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import ProjectNav from "@/components/ProjectNav";
import { SkeletonTable } from "@/app/components/Skeleton";
import type { ThreadMessage } from "@/lib/email-types";

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

type TriageSuggestion = {
  id: string;
  type: "rfi_comment" | "create_task";
  label: string;
  reason: string;
  rfiId?: string;
  rfiNumber?: number;
  taskTitle?: string;
  taskDescription?: string;
  taskDueDate?: string | null;
};

const PROVIDER_LABEL: Record<EmailProvider, string> = {
  outlook: "Outlook",
  gmail: "Gmail",
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatDateTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
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

/** True when rich-text HTML has no visible content (e.g. "", "<br>", "<div></div>"). */
function htmlIsEmpty(html: string): boolean {
  return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim() === "";
}

function dedupeAddresses(addrs: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of addrs) {
    const a = raw.trim();
    const key = a.toLowerCase();
    if (a && !seen.has(key)) {
      seen.add(key);
      out.push(a);
    }
  }
  return out;
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
  const [inboxError, setInboxError] = useState<
    { message: string; reconnect: boolean; provider?: EmailProvider } | null
  >(null);
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

  // Thread view + reply state
  const [openThreadId, setOpenThreadId] = useState<string | null>(null);
  const [openThreadSubject, setOpenThreadSubject] = useState("");
  const [threadMessages, setThreadMessages] = useState<ThreadMessage[]>([]);
  const [threadAccountEmail, setThreadAccountEmail] = useState("");
  const [loadingThread, setLoadingThread] = useState(false);
  const [threadError, setThreadError] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [sendingMode, setSendingMode] = useState<"reply" | "replyAll" | null>(null);
  const [replyError, setReplyError] = useState<string | null>(null);

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
    setInboxError(null);
    if (inbox.length === 0) {
      setLoadingInbox(true);
      fetch("/api/emails/inbox")
        .then(async (r) => {
          const data = await r.json().catch(() => ({}));
          if (!r.ok) {
            // Surface the real failure instead of collapsing it into an empty
            // inbox (which read as the misleading "No messages found").
            setInboxError({
              message:
                data.error && data.error !== "not_connected"
                  ? data.error
                  : "Couldn't load your inbox. Please try again.",
              reconnect: Boolean(data.reconnect),
              provider: data.provider ?? undefined,
            });
            setInbox([]);
            return;
          }
          setInbox(data.messages ?? []);
        })
        .catch(() =>
          setInboxError({
            message: "Network error loading your inbox. Please try again.",
            reconnect: false,
          })
        )
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

  const loadThreadMessages = useCallback(
    (threadDbId: string) =>
      fetch(`/api/projects/${projectId}/emails/${threadDbId}/messages`).then(async (r) => {
        if (!r.ok) {
          const d = await r.json().catch(() => ({}));
          throw new Error(d.error === "not_connected" ? "Your email account is no longer connected." : d.error || "Failed to load conversation");
        }
        return r.json();
      }),
    [projectId]
  );

  const openThread = (t: LinkedThread) => {
    setOpenThreadId(t.id);
    setOpenThreadSubject(t.subject);
    setThreadMessages([]);
    setThreadAccountEmail("");
    setThreadError(null);
    setReplyBody("");
    setReplyError(null);
    setLoadingThread(true);
    loadThreadMessages(t.id)
      .then((data) => {
        setThreadMessages(data.messages ?? []);
        setThreadAccountEmail(data.accountEmail ?? "");
        if (data.subject) setOpenThreadSubject(data.subject);
      })
      .catch((e: Error) => setThreadError(e.message))
      .finally(() => setLoadingThread(false));
  };

  const closeThread = () => {
    if (sendingReply) return;
    setOpenThreadId(null);
    setThreadMessages([]);
    setReplyBody("");
    setThreadError(null);
    setReplyError(null);
  };

  // Build reply + reply-all targets, relative to the connected account.
  // We base the reply on the most recent message from the other party so the
  // recipient is correct regardless of who sent last.
  const replyInfo = (() => {
    if (threadMessages.length === 0) return null;
    const me = threadAccountEmail.toLowerCase();
    const base =
      [...threadMessages].reverse().find((m) => m.from.address.toLowerCase() !== me) ??
      threadMessages[threadMessages.length - 1];

    const replyTo =
      base.from.address.toLowerCase() === me
        ? base.to[0]?.address ?? ""
        : base.from.address;

    // Reply-all: everyone on From + To (minus me), with original Cc (minus me/dupes).
    const allTo = dedupeAddresses(
      [base.from.address, ...base.to.map((r) => r.address)].filter(
        (a) => a && a.toLowerCase() !== me
      )
    );
    const allCc = dedupeAddresses(
      base.cc
        .map((r) => r.address)
        .filter(
          (a) =>
            a &&
            a.toLowerCase() !== me &&
            !allTo.some((x) => x.toLowerCase() === a.toLowerCase())
        )
    );

    return {
      latestMessageId: base.id,
      inReplyTo: base.messageIdHeader,
      subject: base.subject || openThreadSubject,
      reply: { to: replyTo, cc: [] as string[] },
      replyAll: { to: allTo.join(", "), cc: allCc },
      canReplyAll: allTo.length + allCc.length > 1,
    };
  })();

  const sendReply = async (replyAll: boolean) => {
    if (htmlIsEmpty(replyBody) || sendingReply || !openThreadId || !replyInfo) return;
    setSendingReply(true);
    setSendingMode(replyAll ? "replyAll" : "reply");
    setReplyError(null);
    try {
      const target = replyAll ? replyInfo.replyAll : replyInfo.reply;
      const res = await fetch(`/api/projects/${projectId}/emails/${openThreadId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: target.to,
          cc: target.cc,
          subject: replyInfo.subject,
          body: replyBody,
          replyAll,
          latestMessageId: replyInfo.latestMessageId,
          inReplyTo: replyInfo.inReplyTo,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Failed to send reply.");
      }
      setReplyBody("");
      // Refresh the chain so the new reply shows up.
      const refreshed = await loadThreadMessages(openThreadId).catch(() => null);
      if (refreshed?.messages) setThreadMessages(refreshed.messages);
    } catch (e) {
      setReplyError(e instanceof Error ? e.message : "Failed to send reply.");
    } finally {
      setSendingReply(false);
      setSendingMode(null);
    }
  };

  const active = connections ? getActiveProvider(connections) : null;

  const searchParams = useSearchParams();
  const oauthError = searchParams.get("error");
  const oauthConnected = searchParams.get("connected");

  const oauthErrorMessage: Record<string, string> = {
    gmail_denied: "Gmail connection was cancelled.",
    gmail_token_failed: "Failed to exchange the authorisation code — please try again.",
    gmail_no_refresh_token: "Google did not return a refresh token. Please disconnect and reconnect Gmail.",
    gmail_invalid_state: "Invalid OAuth state — please try connecting again.",
  };

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

        {/* OAuth result notifications */}
        {oauthError && (
          <div className="mb-4 px-4 py-3 rounded-lg border bg-red-50 border-red-200 text-red-800 text-sm">
            {oauthErrorMessage[oauthError] ?? `Gmail connection failed (${oauthError}). Please try again.`}
          </div>
        )}
        {oauthConnected && !oauthError && (
          <div className="mb-4 px-4 py-3 rounded-lg border bg-green-50 border-green-200 text-green-800 text-sm">
            {oauthConnected === "gmail" ? "Gmail" : "Outlook"} account connected successfully.
          </div>
        )}

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
                    href={`/api/auth/gmail/connect?projectId=${projectId}`}
                    className="px-3 py-1.5 text-xs font-medium bg-[#EA4335] text-white rounded hover:opacity-90 transition-opacity"
                  >
                    Connect Gmail
                  </a>
                </span>
              </>
            )}
          </div>
        )}

        {/* New Emails triage deck */}
        {active && (
          <TriageDeck
            projectId={projectId}
            linkedConvIds={linkedConvIds}
            onLinked={loadThreads}
          />
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
                  <tr
                    key={t.id}
                    onClick={() => openThread(t)}
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900 truncate max-w-xs hover:text-blue-600">
                        {t.subject}
                      </div>
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
                        onClick={(e) => {
                          e.stopPropagation();
                          unlinkThread(t.id);
                        }}
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
              ) : inboxError ? (
                <div className="px-6 py-12 text-center">
                  <p className="text-sm text-red-600">{inboxError.message}</p>
                  {inboxError.reconnect && (
                    <a
                      href={`/api/auth/${inboxError.provider ?? active?.provider ?? "gmail"}/connect?projectId=${projectId}`}
                      className="inline-block mt-3 px-3 py-1.5 text-xs font-medium bg-gray-900 text-white rounded hover:bg-gray-700 transition-colors"
                    >
                      Reconnect {PROVIDER_LABEL[inboxError.provider ?? active?.provider ?? "gmail"]}
                    </a>
                  )}
                </div>
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
                <RichTextEditor value={composeBody} onChange={setComposeBody} minHeight="160px" />
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

      {/* ── Thread / Conversation Modal ── */}
      {openThreadId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={closeThread} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[88vh]">
            {/* Header */}
            <div className="flex items-start justify-between px-6 py-4 border-b border-gray-200 shrink-0 gap-4">
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-gray-900 truncate">{openThreadSubject}</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {loadingThread
                    ? "Loading conversation…"
                    : `${threadMessages.length} message${threadMessages.length !== 1 ? "s" : ""} in this thread`}
                </p>
              </div>
              <button
                onClick={closeThread}
                disabled={sendingReply}
                className="text-gray-400 hover:text-gray-600 disabled:opacity-40 shrink-0"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Message chain */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3 bg-gray-50">
              {loadingThread ? (
                <div className="py-12 text-center text-sm text-gray-400">Loading conversation…</div>
              ) : threadError ? (
                <div className="py-12 text-center text-sm text-red-600">{threadError}</div>
              ) : threadMessages.length === 0 ? (
                <div className="py-12 text-center text-sm text-gray-400">No messages found in this thread.</div>
              ) : (
                threadMessages.map((m) => (
                  <div key={m.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                    <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between gap-3">
                      <div className="text-xs min-w-0">
                        <span className="font-medium text-gray-900">
                          {m.from.name || m.from.address}
                        </span>
                        {m.from.name && (
                          <span className="text-gray-400"> &lt;{m.from.address}&gt;</span>
                        )}
                        {m.to.length > 0 && (
                          <span className="text-gray-400 block truncate">
                            to {m.to.map((r) => r.name || r.address).join(", ")}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-400 shrink-0">{formatDateTime(m.date)}</span>
                    </div>
                    <div className="px-4 py-3">
                      <MessageBody msg={m} />
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Reply box */}
            {!loadingThread && !threadError && threadMessages.length > 0 && (
              <div className="border-t border-gray-200 px-6 py-4 shrink-0 space-y-2">
                {replyInfo?.reply.to && (
                  <p className="text-xs text-gray-500">
                    Reply to <strong className="text-gray-700">{replyInfo.reply.to}</strong>
                  </p>
                )}
                <RichTextEditor value={replyBody} onChange={setReplyBody} minHeight="90px" />
                {replyError && (
                  <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    {replyError}
                  </p>
                )}
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-gray-400 truncate">
                    {threadAccountEmail && (
                      <>From: <strong>{threadAccountEmail}</strong></>
                    )}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    {replyInfo?.canReplyAll && (
                      <button
                        onClick={() => sendReply(true)}
                        disabled={sendingReply || htmlIsEmpty(replyBody)}
                        title="Reply to all recipients"
                        className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        {sendingMode === "replyAll" ? "Sending…" : "Reply All"}
                      </button>
                    )}
                    <button
                      onClick={() => sendReply(false)}
                      disabled={sendingReply || htmlIsEmpty(replyBody)}
                      className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-gray-900 text-white rounded-md hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      {sendingMode === "reply" ? (
                        "Sending…"
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                          </svg>
                          Reply
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── New Emails Triage Deck ────────────────────────────────────────────────────
//
// A card deck of inbox emails the user has neither linked to this project nor
// declined. One card shows at a time; AI-suggested actions (e.g. "Add to RFI
// #4", "Create task …") load lazily per card and can be ticked before linking.
// Link/Decline removes the card and the next one pops up.

function TriageDeck({
  projectId,
  linkedConvIds,
  onLinked,
}: {
  projectId: string;
  linkedConvIds: Set<string>;
  onLinked: () => void;
}) {
  const [deck, setDeck] = useState<InboxMessage[] | null>(null);
  const [index, setIndex] = useState(0);
  const [suggestionsByConv, setSuggestionsByConv] = useState<
    Record<string, TriageSuggestion[] | "loading" | "error">
  >({});
  const [checkedByConv, setCheckedByConv] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState<"link" | "decline" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actedCount, setActedCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/projects/${projectId}/emails/triage`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setDeck(data?.connected && Array.isArray(data.messages) ? data.messages : []);
      })
      .catch(() => {
        if (!cancelled) setDeck([]);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  // Threads linked elsewhere (e.g. via the modal) drop out of the deck too.
  const visible = (deck ?? []).filter((m) => !linkedConvIds.has(m.conversationId));
  const safeIndex = visible.length === 0 ? 0 : Math.min(index, visible.length - 1);
  const current: InboxMessage | undefined = visible[safeIndex];
  const suggestions = current ? suggestionsByConv[current.conversationId] : undefined;
  const checked = current ? checkedByConv[current.conversationId] ?? [] : [];

  // Lazily fetch AI suggestions for the card in view (cached per conversation).
  useEffect(() => {
    if (!current) return;
    const convId = current.conversationId;
    if (suggestionsByConv[convId] !== undefined) return;
    setSuggestionsByConv((prev) => ({ ...prev, [convId]: "loading" }));
    fetch(`/api/projects/${projectId}/emails/triage/suggest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversationId: convId,
        subject: current.subject,
        fromName: current.from.emailAddress.name,
        fromAddress: current.from.emailAddress.address,
        preview: current.bodyPreview,
        receivedAt: current.receivedDateTime,
      }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) =>
        setSuggestionsByConv((prev) => ({
          ...prev,
          [convId]: Array.isArray(data?.suggestions) ? data.suggestions : [],
        }))
      )
      .catch(() =>
        setSuggestionsByConv((prev) => ({ ...prev, [convId]: "error" }))
      );
  }, [current, suggestionsByConv, projectId]);

  const toggleAction = (convId: string, suggestionId: string) => {
    setCheckedByConv((prev) => {
      const cur = prev[convId] ?? [];
      return {
        ...prev,
        [convId]: cur.includes(suggestionId)
          ? cur.filter((x) => x !== suggestionId)
          : [...cur, suggestionId],
      };
    });
  };

  const flip = (dir: 1 | -1) => {
    if (visible.length < 2 || busy) return;
    setNotice(null);
    setIndex((safeIndex + dir + visible.length) % visible.length);
  };

  const removeCurrent = () => {
    if (!current) return;
    const convId = current.conversationId;
    setDeck((prev) => (prev ?? []).filter((m) => m.conversationId !== convId));
    setIndex(safeIndex);
    setActedCount((c) => c + 1);
  };

  const decline = async () => {
    if (!current || busy) return;
    setBusy("decline");
    setNotice(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/emails/triage/decline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: current.conversationId }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Failed to decline this email.");
      }
      removeCurrent();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Failed to decline this email.");
    } finally {
      setBusy(null);
    }
  };

  const link = async () => {
    if (!current || busy) return;
    const convId = current.conversationId;
    const actions = Array.isArray(suggestions)
      ? suggestions.filter((s) => checked.includes(s.id))
      : [];
    setBusy("link");
    setNotice(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/emails/triage/link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: convId,
          subject: current.subject || "(no subject)",
          fromName: current.from.emailAddress.name,
          fromAddress: current.from.emailAddress.address,
          participants: [
            current.from.emailAddress.address,
            ...current.toRecipients.map((r) => r.emailAddress.address),
          ].filter(Boolean),
          latestMessagePreview: current.bodyPreview,
          latestReceivedAt: current.receivedDateTime,
          messageCount: 1,
          actions: actions.map((a) => ({
            id: a.id,
            type: a.type,
            rfiId: a.rfiId,
            taskTitle: a.taskTitle,
            taskDescription: a.taskDescription,
            taskDueDate: a.taskDueDate,
          })),
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Failed to link this email.");
      }
      const data = await res.json();
      const failed: { id: string }[] = (data?.results ?? []).filter(
        (r: { ok: boolean }) => !r.ok
      );
      if (failed.length > 0) {
        const labelById = new Map(actions.map((a) => [a.id, a.label]));
        setNotice(
          `Email linked, but ${failed.length} action${failed.length > 1 ? "s" : ""} failed: ${failed
            .map((f) => labelById.get(f.id) ?? "unknown action")
            .join("; ")}`
        );
      }
      removeCurrent();
      onLinked();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Failed to link this email.");
    } finally {
      setBusy(null);
    }
  };

  // Nothing to review and nothing happened this session — stay out of the way.
  if (deck !== null && visible.length === 0 && actedCount === 0 && !notice) return null;

  const checkedCount = Array.isArray(suggestions)
    ? checked.filter((id) => suggestions.some((s) => s.id === id)).length
    : 0;

  return (
    <section className="mb-6">
      <div className="flex items-end justify-between mb-3 gap-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">New Emails</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Review inbox emails you haven&apos;t linked or declined yet. Tick any suggested
            actions, then link — the next email pops up.
          </p>
        </div>
        {visible.length > 0 && (
          <span className="text-xs text-gray-500 shrink-0">
            {safeIndex + 1} of {visible.length}
          </span>
        )}
      </div>

      {notice && (
        <div className="mb-3 px-4 py-2.5 rounded-lg border bg-amber-50 border-amber-200 text-amber-800 text-xs flex items-start justify-between gap-3">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="shrink-0 underline hover:opacity-80">
            Dismiss
          </button>
        </div>
      )}

      {deck === null ? (
        <div className="px-5 py-4 bg-white border border-dashed border-gray-300 rounded-xl text-sm text-gray-400 flex items-center gap-2.5">
          <span className="inline-block w-3.5 h-3.5 border-2 border-gray-300 border-t-gray-500 rounded-full animate-spin" />
          Checking your inbox for new emails…
        </div>
      ) : visible.length === 0 ? (
        <div className="px-5 py-5 bg-white border border-gray-200 rounded-xl text-center text-sm text-gray-500">
          All caught up — no new emails to review.
        </div>
      ) : (
        <div className="relative pb-3">
          {/* Cards peeking out behind the active one to suggest a deck */}
          {visible.length > 2 && (
            <div
              className="absolute inset-x-4 top-4 bottom-0 bg-white border border-gray-200 rounded-xl"
              aria-hidden
            />
          )}
          {visible.length > 1 && (
            <div
              className="absolute inset-x-2 top-2 bottom-1.5 bg-white border border-gray-200 rounded-xl"
              aria-hidden
            />
          )}

          <div
            key={current!.conversationId}
            className="relative bg-white border border-gray-200 rounded-xl shadow-sm animate-scale-in"
          >
            {/* Email */}
            <div className="px-5 pt-4 pb-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3
                    className={`text-sm truncate ${
                      current!.isRead ? "font-medium text-gray-900" : "font-semibold text-gray-900"
                    }`}
                  >
                    {current!.subject || "(no subject)"}
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">
                    {current!.from.emailAddress.name || current!.from.emailAddress.address}
                    {current!.from.emailAddress.name && (
                      <span className="text-gray-400"> &lt;{current!.from.emailAddress.address}&gt;</span>
                    )}
                  </p>
                </div>
                <span className="text-xs text-gray-400 shrink-0">
                  {formatDate(current!.receivedDateTime)}
                </span>
              </div>
              {current!.bodyPreview && (
                <p className="text-sm text-gray-600 mt-3 line-clamp-4 whitespace-pre-wrap">
                  {current!.bodyPreview}
                </p>
              )}
            </div>

            {/* Suggested actions */}
            <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/70">
              <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                Suggested actions
              </p>
              {suggestions === undefined || suggestions === "loading" ? (
                <p className="text-xs text-gray-400 py-1 flex items-center gap-2">
                  <span className="inline-block w-3 h-3 border-2 border-gray-300 border-t-gray-500 rounded-full animate-spin" />
                  Analyzing email…
                </p>
              ) : suggestions === "error" ? (
                <p className="text-xs text-gray-400 py-1">
                  Couldn&apos;t load suggestions — you can still link this email.
                </p>
              ) : suggestions.length === 0 ? (
                <p className="text-xs text-gray-400 py-1">
                  No suggested actions — linking will attach this thread to the project.
                </p>
              ) : (
                <div className="space-y-0.5">
                  {suggestions.map((s) => (
                    <label key={s.id} className="flex items-start gap-2.5 py-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked.includes(s.id)}
                        onChange={() => toggleAction(current!.conversationId, s.id)}
                        disabled={!!busy}
                        className="mt-0.5 w-4 h-4 rounded border-gray-300 accent-gray-900 shrink-0"
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-gray-900">{s.label}</span>
                        {s.reason && (
                          <span className="block text-xs text-gray-500 mt-0.5">{s.reason}</span>
                        )}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-gray-200 flex items-center justify-between gap-3">
              <div className="flex items-center gap-1">
                {visible.length > 1 && (
                  <>
                    <button
                      onClick={() => flip(-1)}
                      disabled={!!busy}
                      title="Previous email"
                      className="p-1.5 rounded-md border border-gray-200 text-gray-400 hover:text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => flip(1)}
                      disabled={!!busy}
                      title="Next email"
                      className="p-1.5 rounded-md border border-gray-200 text-gray-400 hover:text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={decline}
                  disabled={!!busy}
                  className="px-4 py-2 text-sm font-medium border border-gray-300 text-gray-600 rounded-md hover:bg-gray-50 hover:text-gray-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {busy === "decline" ? "Declining…" : "Decline"}
                </button>
                <button
                  onClick={link}
                  disabled={!!busy}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-gray-900 text-white rounded-md hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  {busy === "link"
                    ? "Linking…"
                    : checkedCount > 0
                    ? `Link + ${checkedCount} Action${checkedCount > 1 ? "s" : ""}`
                    : "Link to Project"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/** Renders an email's HTML body inside a sandboxed, auto-sized iframe (no script execution). */
function EmailHtmlBody({ html }: { html: string }) {
  const ref = useRef<HTMLIFrameElement>(null);

  const resize = () => {
    const frame = ref.current;
    if (!frame) return;
    try {
      const doc = frame.contentDocument;
      if (doc?.body) frame.style.height = `${doc.body.scrollHeight + 16}px`;
    } catch {
      /* cross-origin guard — ignore */
    }
  };

  const srcDoc = `<!DOCTYPE html><html><head><meta charset="utf-8"><base target="_blank"><style>body{margin:0;font-family:system-ui,-apple-system,sans-serif;font-size:13px;line-height:1.5;color:#374151;word-wrap:break-word;overflow-wrap:break-word;}img{max-width:100%;height:auto;}a{color:#2563eb;}table{max-width:100%;}</style></head><body>${html}</body></html>`;

  return (
    <iframe
      ref={ref}
      title="email-body"
      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      srcDoc={srcDoc}
      onLoad={resize}
      className="w-full block border-0"
      style={{ minHeight: 40 }}
    />
  );
}

function MessageBody({ msg }: { msg: ThreadMessage }) {
  if (msg.bodyHtml) return <EmailHtmlBody html={msg.bodyHtml} />;
  if (msg.bodyText) {
    return <div className="text-sm text-gray-700 whitespace-pre-wrap break-words">{msg.bodyText}</div>;
  }
  return <div className="text-sm text-gray-400 italic">{msg.snippet || "(no content)"}</div>;
}

// ── Rich Text Editor ──────────────────────────────────────────────────────────

type RteCommand =
  | "bold" | "italic" | "underline" | "strikeThrough"
  | "justifyLeft" | "justifyCenter" | "justifyRight"
  | "insertUnorderedList" | "insertOrderedList"
  | "outdent" | "indent" | "undo" | "redo";

function RichTextEditor({
  value,
  onChange,
  minHeight = "80px",
}: {
  value: string;
  onChange: (v: string) => void;
  minHeight?: string;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const isFocused = useRef(false);

  useEffect(() => {
    if (editorRef.current && !isFocused.current) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  function exec(cmd: RteCommand) {
    editorRef.current?.focus();
    document.execCommand(cmd, false);
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  }

  const btnCls = "p-1 rounded hover:bg-gray-100 text-gray-600 hover:text-gray-900 transition-colors";

  return (
    <div className="border border-gray-300 rounded overflow-hidden">
      <div className="flex items-center flex-wrap gap-0.5 px-2 py-1.5 border-b border-gray-200 bg-gray-50">
        <button type="button" onClick={() => exec("bold")} className={btnCls} title="Bold"><b className="text-xs px-0.5">B</b></button>
        <button type="button" onClick={() => exec("italic")} className={btnCls} title="Italic"><i className="text-xs px-0.5">I</i></button>
        <button type="button" onClick={() => exec("underline")} className={btnCls} title="Underline"><u className="text-xs px-0.5">U</u></button>
        <div className="w-px h-4 bg-gray-200 mx-0.5" />
        <button type="button" onClick={() => exec("insertUnorderedList")} className={btnCls} title="Bullet list">
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M4 10.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5zm0-6c-.83 0-1.5.67-1.5 1.5S3.17 7.5 4 7.5 5.5 6.83 5.5 6 4.83 4.5 4 4.5zm0 12c-.83 0-1.5.68-1.5 1.5s.68 1.5 1.5 1.5 1.5-.68 1.5-1.5-.67-1.5-1.5-1.5zM7 19h14v-2H7v2zm0-6h14v-2H7v2zm0-8v2h14V5H7z" /></svg>
        </button>
        <button type="button" onClick={() => exec("insertOrderedList")} className={btnCls} title="Numbered list">
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M2 17h2v.5H3v1h1v.5H2v1h3v-4H2v1zm1-9h1V4H2v1h1v3zm-1 3h1.8L2 13.1v.9h3v-1H3.2L5 10.9V10H2v1zm5-6v2h14V5H7zm0 14h14v-2H7v2zm0-6h14v-2H7v2z" /></svg>
        </button>
        <div className="w-px h-4 bg-gray-200 mx-0.5" />
        <button type="button" onClick={() => exec("undo")} className={btnCls} title="Undo">
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z" /></svg>
        </button>
        <button type="button" onClick={() => exec("redo")} className={btnCls} title="Redo">
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M18.4 10.6C16.55 8.99 14.15 8 11.5 8c-4.65 0-8.58 3.03-9.96 7.22L3.9 16c1.05-3.19 4.05-5.5 7.6-5.5 1.95 0 3.73.72 5.12 1.88L13 16h9V7l-3.6 3.6z" /></svg>
        </button>
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={() => { if (editorRef.current) onChange(editorRef.current.innerHTML); }}
        onFocus={() => { isFocused.current = true; }}
        onBlur={() => { isFocused.current = false; }}
        className="px-3 py-2 text-sm text-gray-900 focus:outline-none"
        style={{ minHeight }}
      />
    </div>
  );
}
