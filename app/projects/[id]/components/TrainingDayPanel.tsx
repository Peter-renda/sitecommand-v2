"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import type { SimRole } from "@/lib/simulation-constants";
import {
  getTrainingSchedule,
  resolveDayIndex,
  type TrainingDay,
} from "@/lib/training-schedule";

/**
 * Day-by-day task panel shown in a training sandbox. It surfaces the tasks
 * scheduled for the trainee's current in-sim day (from projects.training_day),
 * lets them check tasks off (per project + day, in localStorage), and advances
 * to the next scheduled day with a "Complete day" button (which persists the new
 * training_day server-side). Days are not contiguous — e.g. Day 7 → Day 14.
 *
 * Day 1 also surfaces the role-specific company onboarding PDF the trainee needs
 * before starting.
 */

const ONBOARDING_BY_ROLE: Record<SimRole, { label: string; href: string }> = {
  superintendent: {
    label: "Superintendent Company Onboarding",
    href: "/training/onboarding/superintendent",
  },
  project_manager: {
    label: "Project Manager Company Onboarding",
    href: "/training/onboarding/project_manager",
  },
  accounting: {
    label: "Project Accounting Company Onboarding",
    href: "/training/onboarding/accounting",
  },
};

// Fired in-document when localStorage-backed values change (the native "storage"
// event only fires in *other* tabs), so useSyncExternalStore re-reads values.
const CHANGE_EVENT = "sc-training-day-change";

function readString(key: string): string {
  try {
    return window.localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function writeString(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* ignore unavailable storage */
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function useLocalStorageString(key: string): [string, (next: string) => void] {
  const subscribe = useCallback((onChange: () => void) => {
    window.addEventListener(CHANGE_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(CHANGE_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);
  const getSnapshot = useCallback(() => readString(key), [key]);
  const value = useSyncExternalStore(subscribe, getSnapshot, () => "");
  const setValue = useCallback((next: string) => writeString(key, next), [key]);
  return [value, setValue];
}

const CATEGORY_STYLES: Record<string, string> = {
  Buyout: "bg-purple-50 text-purple-700",
  "Document Review": "bg-slate-100 text-slate-700",
  RFI: "bg-blue-50 text-blue-700",
  Setup: "bg-gray-100 text-gray-700",
  Cost: "bg-emerald-50 text-emerald-700",
  Procurement: "bg-orange-50 text-orange-700",
  Submittals: "bg-cyan-50 text-cyan-700",
  Compliance: "bg-rose-50 text-rose-700",
  "Change Mgmt": "bg-amber-50 text-amber-700",
  Permitting: "bg-lime-50 text-lime-700",
  "Field Ops": "bg-indigo-50 text-indigo-700",
  Meetings: "bg-pink-50 text-pink-700",
  Coordination: "bg-teal-50 text-teal-700",
  Schedule: "bg-violet-50 text-violet-700",
  Quality: "bg-green-50 text-green-700",
  Commissioning: "bg-sky-50 text-sky-700",
  Closeout: "bg-fuchsia-50 text-fuchsia-700",
};

function categoryClass(category: string): string {
  return CATEGORY_STYLES[category] ?? "bg-gray-100 text-gray-700";
}

export default function TrainingDayPanel({
  projectId,
  role,
  initialDay,
}: {
  projectId: string;
  role: SimRole;
  initialDay: number;
}) {
  const schedule = useMemo(() => getTrainingSchedule(role), [role]);

  const [collapsed, setCollapsed] = useLocalStorageString(`sc-training-day-collapsed-${projectId}`);
  const isCollapsed = collapsed === "1";

  // Checked tasks: one JSON map per project, keyed "day-index" → true.
  const [checksRaw, setChecksRaw] = useLocalStorageString(`sc-training-tasks-${projectId}`);
  const checks = useMemo<Record<string, boolean>>(() => {
    try {
      return checksRaw ? JSON.parse(checksRaw) : {};
    } catch {
      return {};
    }
  }, [checksRaw]);
  const toggleCheck = useCallback(
    (day: number, idx: number) => {
      const k = `${day}-${idx}`;
      const next = { ...checks, [k]: !checks[k] };
      setChecksRaw(JSON.stringify(next));
    },
    [checks, setChecksRaw],
  );

  // Onboarding-read flag (Day 1 only).
  const [onboardingRead, setOnboardingRead] = useLocalStorageString(
    `sc-training-day1-onboarding-read-${projectId}`,
  );

  const [currentIndex, setCurrentIndex] = useState(() => resolveDayIndex(schedule, initialDay));
  const [advancing, setAdvancing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // No schedule for this role yet — render nothing.
  if (currentIndex < 0) return null;

  const current: TrainingDay = schedule[currentIndex];
  const nextDay = currentIndex < schedule.length - 1 ? schedule[currentIndex + 1] : null;
  const onboarding = ONBOARDING_BY_ROLE[role];
  const isFirstDay = currentIndex === 0;

  const doneCount = current.tasks.reduce(
    (n, _t, i) => n + (checks[`${current.day}-${i}`] ? 1 : 0),
    0,
  );

  async function completeDay() {
    if (!nextDay) return;
    setAdvancing(true);
    setError(null);
    try {
      const res = await fetch(`/api/training/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ training_day: nextDay.day }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to advance to the next day");
      }
      setCurrentIndex((i) => i + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to advance to the next day");
    } finally {
      setAdvancing(false);
    }
  }

  if (isCollapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed("0")}
        title={`Open Day ${current.day} tasks`}
        aria-label={`Open Day ${current.day} tasks`}
        className="fixed right-0 top-1/2 z-40 -translate-y-1/2 flex flex-col items-center gap-1.5 rounded-l-lg bg-amber-500 py-3 pl-2 pr-1.5 text-white shadow-lg transition-colors hover:bg-amber-600"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        <span className="text-xs font-semibold tracking-wide [writing-mode:vertical-rl]">
          Day {current.day}
        </span>
      </button>
    );
  }

  return (
    <aside className="fixed right-0 top-1/2 z-40 flex max-h-[78vh] w-80 max-w-[calc(100vw-1.5rem)] -translate-y-1/2 flex-col overflow-hidden rounded-l-xl border border-amber-200 bg-white shadow-2xl">
      <header className="flex items-center justify-between rounded-tl-xl bg-amber-500 px-4 py-2.5 text-white">
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
          <span className="text-sm font-semibold">Day {current.day}</span>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed("1")}
          title="Collapse"
          aria-label="Collapse the Day panel"
          className="rounded p-0.5 text-amber-50 transition-colors hover:bg-amber-600 hover:text-white"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </header>

      {/* Day context */}
      <div className="border-b border-gray-100 px-4 py-2.5">
        <p className="text-sm font-semibold text-gray-900">{current.phase}</p>
        <p className="text-xs text-gray-500">
          {current.timeframe} · {doneCount}/{current.tasks.length} done
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {isFirstDay && (
          <div className="mb-4">
            <p className="mb-2 text-xs font-medium text-gray-500">Start here</p>
            <a
              href={onboarding.href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOnboardingRead("1")}
              className="flex items-start gap-2 text-sm"
            >
              <span
                className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border border-gray-300 text-[10px] font-bold text-white data-[checked=true]:border-green-600 data-[checked=true]:bg-green-600"
                data-checked={onboardingRead === "1"}
                aria-hidden="true"
              >
                {onboardingRead === "1" ? "✓" : ""}
              </span>
              <span className="font-medium text-blue-600 hover:text-blue-800 hover:underline">
                {onboarding.label}
                <span className="ml-1.5 text-[11px] font-normal text-gray-400">(PDF)</span>
              </span>
            </a>
          </div>
        )}

        <p className="mb-2 text-xs font-medium text-gray-500">
          {isFirstDay ? "Today's tasks" : "Tasks"}
        </p>
        <ul className="space-y-3">
          {current.tasks.map((t, i) => {
            const checked = !!checks[`${current.day}-${i}`];
            return (
              <li key={i} className="flex items-start gap-2">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={checked}
                  onClick={() => toggleCheck(current.day, i)}
                  className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border border-gray-300 text-[10px] font-bold text-white transition-colors data-[checked=true]:border-green-600 data-[checked=true]:bg-green-600"
                  data-checked={checked}
                >
                  {checked ? "✓" : ""}
                </button>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm leading-snug ${checked ? "text-gray-400 line-through" : "text-gray-800"}`}>
                    {t.task}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${categoryClass(t.category)}`}>
                      {t.category}
                    </span>
                    <span className="text-[11px] text-gray-400">{t.collaborators}</span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-gray-400">
                    <span className="font-medium text-gray-500">Deliverable:</span> {t.deliverable}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Advance control */}
      <div className="border-t border-gray-100 p-3">
        {error && <p className="mb-2 text-xs text-red-600">{error}</p>}
        {nextDay ? (
          <>
            <button
              type="button"
              onClick={completeDay}
              disabled={advancing}
              className="w-full rounded-md bg-amber-500 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-600 disabled:opacity-50"
            >
              {advancing ? "Advancing…" : `Complete Day ${current.day} →`}
            </button>
            <p className="mt-1.5 text-center text-[11px] text-gray-400">
              Next: Day {nextDay.day} — {nextDay.phase}
            </p>
          </>
        ) : (
          <div className="rounded-md bg-green-50 px-3 py-2 text-center text-sm font-medium text-green-700">
            🎉 Project complete — all days finished
          </div>
        )}
      </div>
    </aside>
  );
}
