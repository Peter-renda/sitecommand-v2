"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

type SourceDocument = { filename: string; url: string; description?: string };

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  stats?: { recordCount: number; toolsSearched: number; filesAttached: number; filesCited: number };
  sourceDocuments?: SourceDocument[];
};

const SUGGESTIONS = [
  "Summarize all open RFIs that mention roof flashing",
  "What's the latest status of the change events on this project?",
  "Are there any submittals waiting on the architect?",
  "What did the most recent daily log say about weather delays?",
  "Show me all commitments that are still in Draft",
];

export default function AssistWidget({ projectId }: { projectId: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading, open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  if (pathname?.endsWith(`/projects/${projectId}/assist`)) return null;

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

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open Assist"
        title="Open Assist"
        className="fixed bottom-4 right-4 z-50 flex h-11 w-11 items-center justify-center rounded-full bg-gray-900 text-white shadow-lg hover:bg-gray-800"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
          <path
            fillRule="evenodd"
            d="M10 2a8 8 0 0 0-6.96 11.957L2 18l4.184-1.018A8 8 0 1 0 10 2Zm-3 7a1 1 0 1 1 0 2 1 1 0 0 1 0-2Zm3 0a1 1 0 1 1 0 2 1 1 0 0 1 0-2Zm3 0a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z"
            clipRule="evenodd"
          />
        </svg>
      </button>
    );
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 flex h-[600px] max-h-[calc(100vh-40px)] w-[400px] max-w-[calc(100vw-40px)] flex-col rounded-xl border border-gray-200 bg-white shadow-2xl">
      <div className="flex items-center justify-between rounded-t-xl border-b border-gray-200 bg-gray-900 px-4 py-3">
        <div className="flex items-center gap-2 text-white">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
            <path
              fillRule="evenodd"
              d="M10 2a8 8 0 0 0-6.96 11.957L2 18l4.184-1.018A8 8 0 1 0 10 2Zm-3 7a1 1 0 1 1 0 2 1 1 0 0 1 0-2Zm3 0a1 1 0 1 1 0 2 1 1 0 0 1 0-2Zm3 0a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z"
              clipRule="evenodd"
            />
          </svg>
          <span className="text-sm font-medium">Assist</span>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setMessages([]);
                setError(null);
              }}
              className="rounded px-2 py-1 text-xs text-gray-300 hover:bg-gray-800 hover:text-white"
              title="Clear conversation"
            >
              Clear
            </button>
          )}
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Collapse Assist"
            className="rounded p-1 text-gray-300 hover:bg-gray-800 hover:text-white"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
              <path
                fillRule="evenodd"
                d="M4.293 7.293a1 1 0 0 1 1.414 0L10 11.586l4.293-4.293a1 1 0 1 1 1.414 1.414l-5 5a1 1 0 0 1-1.414 0l-5-5a1 1 0 0 1 0-1.414Z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-3">
        {messages.length === 0 && (
          <div className="py-4">
            <p className="mb-3 text-center text-sm font-medium text-gray-700">
              What would you like to know about this project?
            </p>
            <div className="flex flex-col gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => ask(s)}
                  className="rounded-md border border-gray-200 px-3 py-2 text-left text-xs text-gray-700 hover:border-gray-400 hover:bg-gray-50"
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
              className={`max-w-[90%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${
                m.role === "user"
                  ? "bg-gray-900 text-white"
                  : "border border-gray-200 bg-gray-50 text-gray-900"
              }`}
            >
              {m.content}
              {m.sourceDocuments && m.sourceDocuments.length > 0 && (
                <div className="mt-2 border-t border-gray-200 pt-2">
                  <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-gray-500">
                    Source documents
                  </div>
                  <ul className="space-y-1">
                    {m.sourceDocuments.map((doc) => (
                      <li key={doc.url}>
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-start gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            className="mt-0.5 h-3 w-3 flex-shrink-0"
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
                <div className="mt-2 border-t border-gray-200 pt-1.5 text-[10px] text-gray-500">
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
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500">
              Searching project data…
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}
      </div>

      <div className="border-t border-gray-200 p-2">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={2}
            placeholder="Ask anything about this project…"
            disabled={loading}
            className="flex-1 resize-none rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:bg-gray-50"
          />
          <button
            type="button"
            onClick={() => ask(input)}
            disabled={loading || !input.trim()}
            className="rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
