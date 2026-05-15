"use client";

import { useEffect, useRef, useState } from "react";
import ProjectNav from "@/components/ProjectNav";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  stats?: { recordCount: number; toolsSearched: number; drawingPdfsAttached: number };
};

const SUGGESTIONS = [
  "Summarize all open RFIs that mention roof flashing",
  "What's the latest status of the change events on this project?",
  "Are there any submittals waiting on the architect?",
  "What did the most recent daily log say about weather delays?",
  "Show me all commitments that are still in Draft",
];

export default function AssistClient({ projectId }: { projectId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

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

  return (
    <div className="min-h-screen bg-[#f3f4f6]">
      <ProjectNav projectId={projectId} />

      <main className="mx-auto max-w-[900px] px-4 py-6">
        <div className="mb-4 rounded-xl border border-[var(--border-base)] bg-white p-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-display text-[28px] leading-tight text-[color:var(--ink)]">Assist</h1>
              <p className="mt-1 text-sm text-gray-600">
                Ask anything about this project. Assist searches across RFIs, submittals, daily logs, meetings,
                tasks, contracts, budget, commitments, change orders/events, schedules, specs, photos, and the
                most recent drawing PDFs.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white flex flex-col h-[calc(100vh-220px)]">
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="text-center py-10">
                <p className="text-gray-700 font-medium mb-3">What would you like to know about this project?</p>
                <div className="flex flex-col gap-2 max-w-[560px] mx-auto">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => ask(s)}
                      className="text-left text-sm px-3 py-2 rounded-md border border-gray-200 hover:border-gray-400 hover:bg-gray-50 text-gray-700"
                    >
                      {s}
                    </button>
                  ))}
                </div>
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
                  {m.stats && (
                    <div className="mt-2 pt-2 border-t border-gray-200 text-[11px] text-gray-500">
                      Searched {m.stats.recordCount} records across {m.stats.toolsSearched} tools
                      {m.stats.drawingPdfsAttached > 0
                        ? ` · ${m.stats.drawingPdfsAttached} drawing PDF${m.stats.drawingPdfsAttached === 1 ? "" : "s"} read`
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
      </main>
    </div>
  );
}
