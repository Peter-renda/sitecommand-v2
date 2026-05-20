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

type Frequency = "daily" | "weekly" | "monthly";

type RecurringWorkflow = {
  id: string;
  name: string;
  prompt: string;
  frequency: Frequency;
  recipients: string[];
  active: boolean;
  createdAt: string;
  lastRunAt: string | null;
};

const FREQUENCY_LABELS: Record<Frequency, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
};

export default function AssistClient({ projectId }: { projectId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const [workflows, setWorkflows] = useState<RecurringWorkflow[]>([]);
  const [wfName, setWfName] = useState("");
  const [wfPrompt, setWfPrompt] = useState("");
  const [wfFrequency, setWfFrequency] = useState<Frequency>("weekly");
  const [wfRecipients, setWfRecipients] = useState("");
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
    return () => {
      cancelled = true;
    };
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

  async function saveWorkflow(e: React.FormEvent) {
    e.preventDefault();
    setWfError(null);

    const name = wfName.trim();
    const prompt = wfPrompt.trim();
    if (!name) {
      setWfError("Name is required.");
      return;
    }
    if (!prompt) {
      setWfError("Prompt is required.");
      return;
    }

    const recipients = wfRecipients
      .split(/[,\n]/)
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s.length > 0);
    for (const r of recipients) {
      if (!r.includes("@")) {
        setWfError(`"${r}" is not a valid email.`);
        return;
      }
    }

    setWfSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/assist/recurring-workflows`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, prompt, frequency: wfFrequency, recipients }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to save");
      setWorkflows((prev) => [data.workflow as RecurringWorkflow, ...prev]);
      setWfName("");
      setWfPrompt("");
      setWfFrequency("weekly");
      setWfRecipients("");
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
      setWorkflows((prev) =>
        prev.map((w) => (w.id === workflow.id ? { ...w, active: workflow.active } : w)),
      );
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
    <div className="min-h-screen bg-[#FAFAF7]">
      <ProjectNav projectId={projectId} />

      <main className="mx-auto max-w-[900px] px-4 py-6">
        <div className="mb-4 rounded-xl border border-[var(--border-base)] bg-white p-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-display text-[28px] leading-tight text-[color:var(--ink)]">Assist</h1>
              <p className="mt-1 text-sm text-gray-600">
                Ask anything about this project. Assist searches across RFIs, submittals, daily logs, meetings,
                tasks, contracts, budget, commitments, change orders/events, schedules, specs, photos, and any
                attached files (drawings, spec book, RFI/submittal attachments, project documents).
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white flex flex-col h-[calc(100vh-220px)]">
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="text-center py-10">
                <p className="text-gray-700 font-medium">What would you like to know about this project?</p>
              </div>
            )}

            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-lg px-4 py-3 text-sm whitespace-pre-wrap ${
                    m.role === "user"
                      ? "bg-gray-900 text-white"
                      : "bg-gray-50 border border-gray-200 text-gray-900"
                  }`}
                >
                  {m.content}
                  {m.sourceDocuments && m.sourceDocuments.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <div className="text-[11px] font-medium uppercase tracking-wide text-gray-500 mb-1.5">
                        Source documents
                      </div>
                      <ul className="space-y-1">
                        {m.sourceDocuments.map((doc) => (
                          <li key={doc.url}>
                            <a
                              href={doc.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-start gap-1.5 text-xs text-blue-600 hover:text-blue-800 hover:underline"
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
                    <div className="mt-2 pt-2 border-t border-gray-200 text-[11px] text-gray-500">
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
                <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-500">
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

          <div className="border-t border-gray-200 p-3">
            <div className="flex gap-2 items-end">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={2}
                placeholder="Ask anything about this project… (Enter to send, Shift+Enter for new line)"
                disabled={loading}
                className="flex-1 resize-none rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:bg-gray-50"
              />
              <button
                onClick={() => ask(input)}
                disabled={loading || !input.trim()}
                className="px-4 py-2 rounded-md bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Send
              </button>
            </div>
          </div>
        </div>

        <section className="mt-6 rounded-xl border border-gray-200 bg-white p-4">
          <div className="mb-3">
            <h2 className="font-display text-[20px] leading-tight text-[color:var(--ink)]">
              Recurring Workflows
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Save a prompt to run on a recurring schedule. Results are emailed to the listed recipients.
            </p>
          </div>

          <form onSubmit={saveWorkflow} className="space-y-3 border-b border-gray-200 pb-4 mb-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={wfName}
                  onChange={(e) => setWfName(e.target.value)}
                  placeholder="Weekly RFI summary"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Frequency</label>
                <select
                  value={wfFrequency}
                  onChange={(e) => setWfFrequency(e.target.value as Frequency)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Prompt</label>
              <textarea
                value={wfPrompt}
                onChange={(e) => setWfPrompt(e.target.value)}
                rows={3}
                placeholder="Summarize all open RFIs and any submittals waiting on the architect."
                className="w-full resize-none rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Recipients <span className="text-gray-500 font-normal">(comma-separated emails)</span>
              </label>
              <input
                type="text"
                value={wfRecipients}
                onChange={(e) => setWfRecipients(e.target.value)}
                placeholder="pm@example.com, super@example.com"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
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
                      {!w.active && (
                        <span className="inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-[11px] font-medium text-yellow-800">
                          Paused
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-gray-600 whitespace-pre-wrap break-words">{w.prompt}</p>
                    {w.recipients.length > 0 && (
                      <p className="mt-1 text-[11px] text-gray-500">
                        Recipients: {w.recipients.join(", ")}
                      </p>
                    )}
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
        </section>
      </main>
    </div>
  );
}
