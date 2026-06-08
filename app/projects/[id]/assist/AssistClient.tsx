"use client";

import { useEffect, useRef, useState } from "react";
import ProjectNav from "@/components/ProjectNav";

type SourceDocument = { filename: string; url: string; description?: string };

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  stats?: { recordCount: number; toolsSearched: number; filesAttached: number; filesCited: number };
  sourceDocuments?: SourceDocument[];
};

type HistoryItem = {
  id: string;
  question: string;
  answer: string;
  stats?: { recordCount: number; toolsSearched: number; filesAttached: number; filesCited: number } | null;
  source_documents?: SourceDocument[] | null;
  created_at: string;
};

type Frequency = "daily" | "weekly" | "monthly";
type Weekday = "sunday" | "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday";

type WorkflowReport = {
  id: string;
  fileName: string;
  fileUrl: string;
  fileType: "pdf" | "excel";
  createdAt: string;
};

type RecurringWorkflow = {
  id: string;
  name: string;
  prompt: string;
  frequency: Frequency;
  runDayOfWeek: Weekday | null;
  runDayOfMonth: number | null;
  runHourEt: number | null;
  runMinuteEt: number | null;
  recipients: string[];
  active: boolean;
  createdAt: string;
  lastRunAt: string | null;
  reports?: WorkflowReport[];
};

const FREQUENCY_LABELS: Record<Frequency, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
};
const WEEKDAY_OPTIONS: Weekday[] = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function AssistClient({ projectId }: { projectId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);

  const [workflows, setWorkflows] = useState<RecurringWorkflow[]>([]);
  const [wfName, setWfName] = useState("");
  const [wfPrompt, setWfPrompt] = useState("");
  const [wfFrequency, setWfFrequency] = useState<Frequency>("weekly");
  const [wfRecipients, setWfRecipients] = useState("");
  const [selectedWorkflow, setSelectedWorkflow] = useState<RecurringWorkflow | null>(null);
  const [wfRunDayOfWeek, setWfRunDayOfWeek] = useState<Weekday>("monday");
  const [wfRunDayOfMonth, setWfRunDayOfMonth] = useState<number>(1);
  const [wfRunHourEt, setWfRunHourEt] = useState<number>(6);
  const [directoryRecipients, setDirectoryRecipients] = useState<Array<{ id: string; name: string; email: string }>>([]);
  const [wfSaving, setWfSaving] = useState(false);
  const [wfError, setWfError] = useState<string | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/assist/recurring-workflows`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && Array.isArray(data.workflows)) {
          setWorkflows(data.workflows);
        }
      } catch {
        // ignore
      }
    })();
    return () => { cancelled = true; };
  }, [projectId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/assist/history`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && Array.isArray(data.history)) {
          setHistory(data.history);
        }
      } catch {
        // ignore
      }
    })();
    return () => { cancelled = true; };
  }, [projectId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/directory`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && Array.isArray(data)) {
          const options = data
            .map((row: Record<string, unknown>) => {
              const email = typeof row.email === "string" ? row.email.trim().toLowerCase() : "";
              if (!email) return null;
              const first = typeof row.first_name === "string" ? row.first_name.trim() : "";
              const last = typeof row.last_name === "string" ? row.last_name.trim() : "";
              const company = typeof row.company === "string" ? row.company.trim() : "";
              const name = [first, last].filter(Boolean).join(" ") || company || email;
              return { id: String(row.id ?? email), name, email };
            })
            .filter(Boolean) as Array<{ id: string; name: string; email: string }>;
          setDirectoryRecipients(options);
        }
      } catch {
        // ignore
      }
    })();
    return () => { cancelled = true; };
  }, [projectId]);

  async function ask(question: string) {
    const trimmed = question.trim();
    if (!trimmed || loading) return;

    setError(null);
    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch(`/api/projects/${projectId}/assist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Request failed");

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.answer,
          stats: data.stats,
          sourceDocuments: data.sourceDocuments,
        },
      ]);

      // Persist to history (non-fatal)
      try {
        const histRes = await fetch(`/api/projects/${projectId}/assist/history`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: trimmed,
            answer: data.answer,
            stats: data.stats ?? null,
            sourceDocuments: data.sourceDocuments ?? null,
          }),
        });
        if (histRes.ok) {
          const histData = await histRes.json();
          if (histData.item) {
            setHistory((prev) => [histData.item, ...prev]);
          }
        }
      } catch {
        // ignore history persistence failure
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get a response");
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      ask(input);
    }
  }

  async function deleteHistoryItem(historyId: string) {
    setHistory((prev) => prev.filter((h) => h.id !== historyId));
    try {
      await fetch(`/api/projects/${projectId}/assist/history/${historyId}`, { method: "DELETE" });
    } catch {
      // best-effort; item already removed from UI
    }
  }

  async function saveWorkflow(e: React.FormEvent) {
    e.preventDefault();
    setWfError(null);

    const name = wfName.trim();
    const prompt = wfPrompt.trim();
    if (!name) { setWfError("Name is required."); return; }
    if (!prompt) { setWfError("Prompt is required."); return; }

    const recipients = wfRecipients.split(",").map((r) => r.trim().toLowerCase()).filter((s) => s.length > 0);
    for (const r of recipients) {
      if (!r.includes("@")) { setWfError(`"${r}" is not a valid email.`); return; }
    }

    if (wfFrequency === "monthly" && (!Number.isInteger(wfRunDayOfMonth) || wfRunDayOfMonth < 1 || wfRunDayOfMonth > 31)) {
      setWfError("Day of month must be between 1 and 31.");
      return;
    }

    setWfSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/assist/recurring-workflows`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          prompt,
          frequency: wfFrequency,
          recipients,
          runDayOfWeek: wfRunDayOfWeek,
          runDayOfMonth: wfFrequency === "monthly" ? wfRunDayOfMonth : null,
          runHourEt: wfRunHourEt,
          runMinuteEt: 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to save");
      setWorkflows((prev) => [data.workflow as RecurringWorkflow, ...prev]);
      setWfName("");
      setWfPrompt("");
      setWfFrequency("weekly");
      setWfRecipients("");
      setWfRunDayOfWeek("monday");
      setWfRunDayOfMonth(1);
      setWfRunHourEt(6);
    } catch (err) {
      setWfError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setWfSaving(false);
    }
  }

  async function toggleActive(workflow: RecurringWorkflow) {
    const next = !workflow.active;
    setWorkflows((prev) => prev.map((w) => (w.id === workflow.id ? { ...w, active: next } : w)));
    try {
      await fetch(`/api/projects/${projectId}/assist/recurring-workflows/${workflow.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: next }),
      });
    } catch {
      setWorkflows((prev) => prev.map((w) => (w.id === workflow.id ? { ...w, active: workflow.active } : w)));
    }
  }

  async function deleteWorkflow(workflowId: string) {
    if (!confirm("Delete this recurring workflow?")) return;
    const previous = workflows;
    setWorkflows((prev) => prev.filter((w) => w.id !== workflowId));
    try {
      const res = await fetch(
        `/api/projects/${projectId}/assist/recurring-workflows/${workflowId}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error("Delete failed");
    } catch {
      setWorkflows(previous);
    }
  }

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <ProjectNav projectId={projectId} />

      <main className="mx-auto max-w-[900px] px-4 py-8">
        <div className="mb-6">
          <h1 className="font-display text-[32px] leading-[1.05] tracking-[-0.012em] text-[color:var(--ink)]">
            Assist
          </h1>
          <p className="sub mt-1.5">
            <em>Ask anything about this project</em>
            <span className="sep">·</span>
            <span className="num">{history.length}</span> saved
            <span className="sep">·</span>
            <span className="num" style={{ color: "var(--brand-500)" }}>{workflows.filter((w) => w.active).length}</span> active workflows
          </p>
          <p className="mt-2 text-sm text-gray-600">
            Assist searches across RFIs, submittals, daily logs, meetings, tasks, contracts, budget, commitments,
            change orders/events, schedules, specs, photos, and any attached files (drawings, spec book,
            RFI/submittal attachments, project documents).
          </p>
        </div>

        <div className="rounded-xl border border-[color:var(--border-base)] bg-white flex flex-col h-[calc(100vh-260px)]">
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="text-center py-12">
                <p className="font-display text-[20px] leading-tight text-[color:var(--ink)]">
                  What would you like to know about this project?
                </p>
                <p className="mt-1.5 text-sm text-gray-500 serif-italic">
                  Type a question below to begin.
                </p>
              </div>
            )}

            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-lg px-4 py-3 text-sm whitespace-pre-wrap ${
                    m.role === "user"
                      ? "bg-[color:var(--ink)] text-white"
                      : "bg-[color:var(--surface-sunken)] border border-[color:var(--border-base)] text-[color:var(--ink)]"
                  }`}
                >
                  {m.content}
                  {m.sourceDocuments && m.sourceDocuments.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-[color:var(--border-base)]">
                      <div className="mono-label text-[11px] text-gray-500 mb-1.5">
                        Source documents
                      </div>
                      <ul className="space-y-1">
                        {m.sourceDocuments.map((doc) => (
                          <li key={doc.url}>
                            <a
                              href={doc.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-start gap-1.5 text-xs text-[color:var(--brand-700)] hover:text-[color:var(--brand-500)] hover:underline"
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                                className="w-3.5 h-3.5 mt-0.5 flex-shrink-0"
                                aria-hidden="true"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M4 4a2 2 0 0 1 2-2h4.586A2 2 0 0 1 12 2.586L15.414 6A2 2 0 0 1 16 7.414V16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4Zm6 0v3a1 1 0 0 0 1 1h3l-4-4Z"
                                  clipRule="evenodd"
                                />
                              </svg>
                              <span>
                                {doc.filename}
                                {doc.description && (
                                  <span className="text-gray-500"> — {doc.description}</span>
                                )}
                              </span>
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {m.stats && (
                    <div className="mt-2 pt-2 border-t border-[color:var(--border-base)] text-[11px] text-gray-500 tabular-nums">
                      Searched {m.stats.recordCount} records across {m.stats.toolsSearched} tools
                      {m.stats.filesAttached > 0
                        ? ` · ${m.stats.filesCited} of ${m.stats.filesAttached} file${m.stats.filesAttached === 1 ? "" : "s"} cited`
                        : ""}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-[color:var(--surface-sunken)] border border-[color:var(--border-base)] rounded-lg px-4 py-3 text-sm text-gray-500 serif-italic">
                  Searching project data…
                </div>
              </div>
            )}

            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}
          </div>

          <div className="border-t border-[color:var(--border-base)] p-3">
            <div className="flex gap-2 items-end">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={2}
                placeholder="Ask anything about this project… (Enter to send, Shift+Enter for new line)"
                disabled={loading}
                className="flex-1 resize-none rounded-md border border-[color:var(--border-base)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--ink)] disabled:bg-[color:var(--surface-sunken)]"
              />
              <button
                onClick={() => ask(input)}
                disabled={loading || !input.trim()}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Send
              </button>
            </div>
          </div>
        </div>

        {/* History */}
        <div className="mt-10">
          <h2 className="font-display text-[28px] leading-[1.05] tracking-[-0.012em] text-[color:var(--ink)]">
            History
          </h2>
          <p className="sub mt-1">
            <span className="num">{history.length}</span> saved question{history.length !== 1 ? "s" : ""}
          </p>
        </div>

        <div className="card card-pad mt-4">
          {history.length === 0 ? (
            <p className="text-sm text-gray-500">No history yet. Ask a question above to get started.</p>
          ) : (
            <ul className="space-y-2">
              {history.map((item) => {
                const expanded = expandedHistoryId === item.id;
                return (
                  <li key={item.id} className="rounded-md border border-[color:var(--border-base)] overflow-hidden">
                    <div
                      className="flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-[color:var(--surface-sunken)] select-none"
                      onClick={() => setExpandedHistoryId(expanded ? null : item.id)}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className={`w-3.5 h-3.5 flex-shrink-0 text-gray-400 transition-transform ${expanded ? "rotate-90" : ""}`}
                      >
                        <path fillRule="evenodd" d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                      </svg>
                      <span className="flex-1 text-sm font-medium text-[color:var(--ink)] truncate">
                        {item.question}
                      </span>
                      <span className="text-[11px] text-gray-400 flex-shrink-0 tabular-nums">
                        {formatRelativeTime(item.created_at)}
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteHistoryItem(item.id); }}
                        className="flex-shrink-0 text-gray-400 hover:text-red-600 p-0.5 rounded"
                        title="Delete"
                        aria-label="Delete"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                          <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>

                    {expanded && (
                      <div className="border-t border-[color:var(--border-base)] px-3 py-3 bg-[color:var(--surface-sunken)]">
                        <p className="text-sm whitespace-pre-wrap text-[color:var(--ink)]">{item.answer}</p>
                        {item.source_documents && item.source_documents.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-[color:var(--border-base)]">
                            <div className="mono-label text-[11px] text-gray-500 mb-1.5">Source documents</div>
                            <ul className="space-y-1">
                              {item.source_documents.map((doc) => (
                                <li key={doc.url}>
                                  <a
                                    href={doc.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-start gap-1.5 text-xs text-[color:var(--brand-700)] hover:text-[color:var(--brand-500)] hover:underline"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" aria-hidden="true">
                                      <path fillRule="evenodd" d="M4 4a2 2 0 0 1 2-2h4.586A2 2 0 0 1 12 2.586L15.414 6A2 2 0 0 1 16 7.414V16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4Zm6 0v3a1 1 0 0 0 1 1h3l-4-4Z" clipRule="evenodd" />
                                    </svg>
                                    <span>
                                      {doc.filename}
                                      {doc.description && <span className="text-gray-500"> — {doc.description}</span>}
                                    </span>
                                  </a>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {item.stats && (
                          <div className="mt-2 pt-2 border-t border-[color:var(--border-base)] text-[11px] text-gray-500 tabular-nums">
                            Searched {item.stats.recordCount} records across {item.stats.toolsSearched} tools
                            {item.stats.filesAttached > 0
                              ? ` · ${item.stats.filesCited} of ${item.stats.filesAttached} file${item.stats.filesAttached === 1 ? "" : "s"} cited`
                              : ""}
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Recurring Workflows */}
        <div className="mt-10">
          <h2 className="font-display text-[28px] leading-[1.05] tracking-[-0.012em] text-[color:var(--ink)]">
            Recurring Workflows
          </h2>
          <p className="sub mt-1">
            Save a prompt to run on a recurring schedule.
            <span className="sep">·</span>
            <span className="num" style={{ color: "var(--brand-500)" }}>{workflows.filter((w) => w.active).length}</span> active
          </p>
        </div>

        <div className="card card-pad mt-4">
          <form onSubmit={saveWorkflow} className="space-y-3 border-b border-[color:var(--border-base)] pb-5 mb-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="mono-label block text-gray-600 mb-1">Name</label>
                <input
                  type="text"
                  value={wfName}
                  onChange={(e) => setWfName(e.target.value)}
                  placeholder="Weekly RFI summary"
                  className="w-full rounded-md border border-[color:var(--border-base)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--ink)]"
                />
              </div>
              <div>
                <label className="mono-label block text-gray-600 mb-1">Frequency</label>
                <select
                  value={wfFrequency}
                  onChange={(e) => setWfFrequency(e.target.value as Frequency)}
                  className="w-full rounded-md border border-[color:var(--border-base)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--ink)]"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              {wfFrequency === "weekly" && (
                <div>
                  <label className="mono-label block text-gray-600 mb-1">Day of week</label>
                  <select
                    value={wfRunDayOfWeek}
                    onChange={(e) => setWfRunDayOfWeek(e.target.value as Weekday)}
                    className="w-full rounded-md border border-[color:var(--border-base)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--ink)]"
                  >
                    {WEEKDAY_OPTIONS.map((day) => (
                      <option key={day} value={day}>
                        {day[0].toUpperCase() + day.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {wfFrequency === "monthly" && (
                <div>
                  <label className="mono-label block text-gray-600 mb-1">Day of month</label>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={wfRunDayOfMonth}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      if (!isNaN(v)) setWfRunDayOfMonth(Math.min(31, Math.max(1, v)));
                    }}
                    className="w-full rounded-md border border-[color:var(--border-base)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--ink)]"
                  />
                  <p className="mt-1 text-[11px] text-gray-500">Runs on this day each month. If the month is shorter, runs on the last day.</p>
                </div>
              )}
              <div>
                <label className="mono-label block text-gray-600 mb-1">Run time (ET)</label>
                <select
                  value={String(wfRunHourEt)}
                  onChange={(e) => setWfRunHourEt(Number(e.target.value))}
                  className="w-full rounded-md border border-[color:var(--border-base)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--ink)]"
                >
                  {Array.from({ length: 24 }).map((_, h) => (
                    <option key={h} value={h}>
                      {h === 0 ? "12 AM" : h < 12 ? `${h} AM` : h === 12 ? "12 PM" : `${h - 12} PM`}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="mono-label block text-gray-600 mb-1">Prompt</label>
              <textarea
                value={wfPrompt}
                onChange={(e) => setWfPrompt(e.target.value)}
                rows={3}
                placeholder="Summarize all open RFIs and any submittals waiting on the architect."
                className="w-full resize-none rounded-md border border-[color:var(--border-base)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--ink)]"
              />
            </div>

            <div>
              <label className="mono-label block text-gray-600 mb-1">
                Recipients <span className="normal-case tracking-normal text-gray-500">(comma-separated emails)</span>
              </label>
              <input
                type="text"
                value={wfRecipients}
                onChange={(e) => setWfRecipients(e.target.value)}
                placeholder="pm@example.com, super@example.com"
                className="w-full rounded-md border border-[color:var(--border-base)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--ink)]"
              />
            </div>

            {wfError && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {wfError}
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={wfSaving}
                className="px-4 py-2 rounded-md bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {wfSaving ? "Saving…" : "Add Recurring Workflow"}
              </button>
            </div>
          </form>

          {workflows.length === 0 ? (
            <p className="text-sm text-gray-500">No recurring workflows yet.</p>
          ) : (
            <ul className="space-y-3">
              {workflows.map((w) => (
                <li
                  key={w.id}
                  className="rounded-md border border-gray-200 px-3 py-2.5 flex items-start justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-900">{w.name}</span>
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-700">
                        {FREQUENCY_LABELS[w.frequency]}
                      </span>
                      {w.frequency === "weekly" && w.runDayOfWeek && (
                        <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-700">
                          {w.runDayOfWeek[0].toUpperCase() + w.runDayOfWeek.slice(1)}
                        </span>
                      )}
                      {w.frequency === "monthly" && w.runDayOfMonth != null && (
                        <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-700">
                          Day {w.runDayOfMonth}
                        </span>
                      )}
                      {typeof w.runHourEt === "number" && (
                        <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-700">
                          {(w.runHourEt === 0 ? "12" : w.runHourEt <= 12 ? String(w.runHourEt) : String(w.runHourEt - 12)) + " " + (w.runHourEt < 12 ? "AM ET" : "PM ET")}
                        </span>
                      )}
                      {!w.active && (
                        <span className="inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-[11px] font-medium text-yellow-800">
                          Paused
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-gray-600 whitespace-pre-wrap break-words">{w.prompt}</p>

                    <div className="mt-2">
                      <p className="text-[11px] font-medium text-gray-600">Latest reports</p>
                      {w.reports && w.reports.length > 0 ? (
                        <ul className="mt-1 space-y-1">
                          {w.reports.slice(0, 4).map((report) => (
                            <li key={report.id}>
                              <a href={report.fileUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">
                                {report.fileName}
                              </a>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-gray-500 mt-1">No reports yet.</p>
                      )}
                      <a
                        href="#"
                        onClick={(e) => { e.preventDefault(); setSelectedWorkflow(w); }}
                        className="mt-2 inline-block text-xs font-medium text-gray-700 hover:text-gray-900 hover:underline"
                      >
                        See all reports
                      </a>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => toggleActive(w)}
                      className="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-50 text-gray-700"
                    >
                      {w.active ? "Pause" : "Resume"}
                    </button>
                    <button
                      onClick={() => deleteWorkflow(w.id)}
                      className="text-xs px-2 py-1 rounded border border-red-200 text-red-700 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>

      {selectedWorkflow && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setSelectedWorkflow(null)}
        >
          <div className="w-full max-w-2xl rounded-lg bg-white p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">{selectedWorkflow.name} — All Reports</h3>
              <button className="text-sm" onClick={() => setSelectedWorkflow(null)}>Close</button>
            </div>
            <ul className="mt-3 max-h-[60vh] overflow-auto space-y-2">
              {(selectedWorkflow.reports ?? []).map((report) => (
                <li key={report.id}>
                  <a href={report.fileUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">
                    {report.fileName}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
