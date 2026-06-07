"use client";

import { useState, useEffect, useCallback } from "react";
import ProjectNav from "@/components/ProjectNav";
import { SkeletonTable } from "@/app/components/Skeleton";
import type { GraphMessage } from "@/lib/microsoft-graph";

type ConnectionInfo = {
  connected: boolean;
  email?: string;
  displayName?: string;
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

export default function EmailsClient({ projectId }: { projectId: string }) {
  const [connection, setConnection] = useState<ConnectionInfo | null>(null);
  const [threads, setThreads] = useState<LinkedThread[]>([]);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [showLinkPanel, setShowLinkPanel] = useState(false);
  const [inbox, setInbox] = useState<GraphMessage[]>([]);
  const [loadingInbox, setLoadingInbox] = useState(false);
  const [linking, setLinking] = useState<string | null>(null);
  const [unlinking, setUnlinking] = useState<string | null>(null);
  const [search, setSearch] = useState("");

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
      .then(setConnection)
      .catch(() => setConnection({ connected: false }));
    loadThreads();
  }, [loadThreads]);

  const openLinkPanel = () => {
    setShowLinkPanel(true);
    if (inbox.length === 0) {
      setLoadingInbox(true);
      fetch("/api/emails/inbox")
        .then((r) => r.json())
        .then((data) => setInbox(data.messages ?? []))
        .catch(() => setInbox([]))
        .finally(() => setLoadingInbox(false));
    }
  };

  const linkThread = async (msg: GraphMessage) => {
    setLinking(msg.conversationId);
    await fetch(`/api/projects/${projectId}/emails`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        graphConversationId: msg.conversationId,
        subject: msg.subject || "(no subject)",
        participants: [
          msg.from.emailAddress.address,
          ...msg.toRecipients.map((r) => r.emailAddress.address),
        ],
        latestMessagePreview: msg.bodyPreview,
        latestReceivedAt: msg.receivedDateTime,
        messageCount: 1,
      }),
    });
    setLinking(null);
    loadThreads();
  };

  const unlinkThread = async (threadId: string) => {
    setUnlinking(threadId);
    await fetch(`/api/projects/${projectId}/emails/${threadId}`, { method: "DELETE" });
    setUnlinking(null);
    setThreads((prev) => prev.filter((t) => t.id !== threadId));
  };

  const disconnect = async () => {
    if (!confirm("Disconnect your Outlook account?")) return;
    await fetch("/api/emails/connection", { method: "DELETE" });
    setConnection({ connected: false });
    setThreads([]);
  };

  const linkedConversationIds = new Set(threads.map((t) => t.graph_conversation_id));
  const filteredInbox = inbox.filter(
    (m) =>
      !linkedConversationIds.has(m.conversationId) &&
      (search === "" ||
        m.subject?.toLowerCase().includes(search.toLowerCase()) ||
        m.from.emailAddress.address.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <ProjectNav projectId={projectId} />

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Page header */}
        <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Emails</h1>
            <p className="text-sm text-gray-500 mt-1">Email threads linked to this project</p>
          </div>
          {connection?.connected && (
            <button
              onClick={openLinkPanel}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-gray-900 text-white rounded-md hover:bg-gray-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Link Email Thread
            </button>
          )}
        </div>

        {/* Outlook connection banner */}
        {connection !== null && (
          <div
            className={`mb-6 px-4 py-3 rounded-lg border text-sm flex items-center justify-between ${
              connection.connected
                ? "bg-green-50 border-green-200 text-green-800"
                : "bg-amber-50 border-amber-200 text-amber-800"
            }`}
          >
            {connection.connected ? (
              <>
                <span>
                  Connected as <strong>{connection.displayName || connection.email}</strong>{" "}
                  ({connection.email})
                </span>
                <button onClick={disconnect} className="text-xs underline ml-4 hover:opacity-80">
                  Disconnect
                </button>
              </>
            ) : (
              <>
                <span>Connect your Outlook account to link email threads to this project.</span>
                <a
                  href={`/api/auth/outlook/connect?projectId=${projectId}`}
                  className="ml-4 px-3 py-1.5 text-xs font-medium bg-amber-800 text-white rounded hover:bg-amber-900 transition-colors"
                >
                  Connect Outlook
                </a>
              </>
            )}
          </div>
        )}

        {/* Thread list */}
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
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
            <p className="text-sm font-medium text-gray-500 mb-1">No email threads linked yet</p>
            <p className="text-xs text-gray-400">
              {connection?.connected
                ? 'Click "Link Email Thread" to attach Outlook conversations to this project.'
                : "Connect your Outlook account to get started."}
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

      {/* Link inbox panel */}
      {showLinkPanel && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowLinkPanel(false)} />
          <div className="relative ml-auto w-[480px] bg-white shadow-xl flex flex-col h-full">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 shrink-0">
              <h2 className="text-sm font-semibold text-gray-900">Link Email Thread from Inbox</h2>
              <button
                onClick={() => setShowLinkPanel(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-4 py-3 border-b border-gray-100 shrink-0">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search subject or sender…"
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
            <div className="flex-1 overflow-y-auto">
              {loadingInbox ? (
                <div className="px-4 py-8 text-center text-sm text-gray-400">Loading inbox…</div>
              ) : filteredInbox.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-gray-400">
                  {inbox.length === 0 ? "No messages in inbox." : "No matching messages."}
                </div>
              ) : (
                filteredInbox.map((msg) => (
                  <div
                    key={msg.id}
                    className="px-4 py-3 border-b border-gray-100 flex items-start justify-between gap-3 hover:bg-gray-50"
                  >
                    <div className="flex-1 min-w-0">
                      <div
                        className={`text-sm truncate ${
                          msg.isRead ? "text-gray-600" : "font-semibold text-gray-900"
                        }`}
                      >
                        {msg.subject || "(no subject)"}
                      </div>
                      <div className="text-xs text-gray-400 truncate mt-0.5">
                        {msg.from.emailAddress.name || msg.from.emailAddress.address}
                      </div>
                      <div className="text-xs text-gray-400 truncate mt-0.5">{msg.bodyPreview}</div>
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-1.5">
                      <span className="text-xs text-gray-400">{formatDate(msg.receivedDateTime)}</span>
                      <button
                        onClick={() => linkThread(msg)}
                        disabled={linking === msg.conversationId}
                        className="px-2.5 py-1 text-xs font-medium bg-gray-900 text-white rounded hover:bg-gray-700 disabled:opacity-50 transition-colors"
                      >
                        {linking === msg.conversationId ? "Linking…" : "Link"}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
