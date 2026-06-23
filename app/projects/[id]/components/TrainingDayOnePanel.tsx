"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * "Day 1" onboarding panel shown in a Project-Manager training sandbox. It
 * surfaces the reference material the trainee needs to get started as a list of
 * links. The panel collapses to a small tab tucked against the right-hand edge
 * of the screen and remembers that choice per project (localStorage), so it
 * opens automatically when the sandbox is first launched but stays out of the
 * way once dismissed.
 *
 * The links are intentional placeholders for now — the underlying Company
 * Onboarding / Project Overview content isn't populated yet.
 */

const ITEMS = [{ label: "Company Onboarding" }, { label: "Project Overview" }];

// Fired in-document when the collapsed flag changes (the native "storage" event
// only fires in *other* tabs), so useSyncExternalStore re-reads the value.
const CHANGE_EVENT = "sc-training-day1-change";

/**
 * Reads/writes the per-project collapsed flag in localStorage via
 * useSyncExternalStore — SSR-safe (server snapshot defaults to expanded) and
 * without any setState-in-effect.
 */
function useCollapsedFlag(key: string): [boolean, (next: boolean) => void] {
  const subscribe = useCallback((onChange: () => void) => {
    window.addEventListener(CHANGE_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(CHANGE_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const getSnapshot = useCallback(() => {
    try {
      return window.localStorage.getItem(key) === "1";
    } catch {
      return false;
    }
  }, [key]);

  const collapsed = useSyncExternalStore(subscribe, getSnapshot, () => false);

  const setCollapsed = useCallback(
    (next: boolean) => {
      try {
        window.localStorage.setItem(key, next ? "1" : "0");
      } catch {
        /* ignore unavailable storage */
      }
      window.dispatchEvent(new Event(CHANGE_EVENT));
    },
    [key],
  );

  return [collapsed, setCollapsed];
}

export default function TrainingDayOnePanel({ projectId }: { projectId: string }) {
  const [collapsed, setCollapsed] = useCollapsedFlag(`sc-training-day1-collapsed-${projectId}`);

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        title="Open the Day 1 checklist"
        aria-label="Open the Day 1 checklist"
        className="fixed right-0 top-1/2 z-40 -translate-y-1/2 flex flex-col items-center gap-1.5 rounded-l-lg bg-amber-500 py-3 pl-2 pr-1.5 text-white shadow-lg transition-colors hover:bg-amber-600"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        <span className="text-xs font-semibold tracking-wide [writing-mode:vertical-rl]">Day 1</span>
      </button>
    );
  }

  return (
    <aside className="fixed right-0 top-1/2 z-40 w-80 max-w-[calc(100vw-1.5rem)] max-h-[70vh] -translate-y-1/2 overflow-y-auto rounded-l-xl border border-amber-200 bg-white shadow-2xl">
      <header className="flex items-center justify-between rounded-tl-xl bg-amber-500 px-4 py-2.5 text-white">
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
          <span className="text-sm font-semibold">Day 1</span>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          title="Collapse"
          aria-label="Collapse the Day 1 checklist"
          className="rounded p-0.5 text-amber-50 transition-colors hover:bg-amber-600 hover:text-white"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </header>

      <div className="p-4">
        <p className="mb-3 text-xs text-gray-500">
          Welcome to the project. Start with these — you&apos;ll need them to complete your first tasks.
        </p>
        <ol className="list-inside list-decimal space-y-2.5">
          {ITEMS.map((item) => (
            <li key={item.label} className="text-sm text-gray-800">
              <a
                href="#"
                onClick={(e) => e.preventDefault()}
                className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
              >
                {item.label}
              </a>
              <span className="ml-1.5 text-[11px] text-gray-400">(coming soon)</span>
            </li>
          ))}
        </ol>
      </div>
    </aside>
  );
}
