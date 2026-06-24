"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import type { SimRole } from "@/lib/simulation-constants";
import {
  getTrainingSchedule,
  getRecurringCadence,
  resolveDayIndex,
  type TrainingDay,
  type RecurringCadenceGroup,
  type RecurringFrequency,
} from "@/lib/training-schedule";

/**
 * Day-by-day task panel shown in a training sandbox. It surfaces the tasks
 * scheduled for the trainee's current in-sim week/period (from
 * projects.training_day), lets them check tasks off (per project + day, in
 * localStorage), and advances to the next period with a "Complete" button
 * (which persists the new training_day server-side). Periods are not
 * contiguous — e.g. Week 6 → Week 8 → Month 2 etc.
 *
 * A collapsible "Recurring Cadence" section below the day's tasks surfaces the
 * standing Daily / Weekly / Bi-weekly / Monthly responsibilities.
 *
 * Day 1 / Week 1 also surfaces the role-specific company onboarding PDF.
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
  Safety: "bg-red-50 text-red-700",
  Reporting: "bg-yellow-50 text-yellow-700",
};

function categoryClass(category: string): string {
  return CATEGORY_STYLES[category] ?? "bg-gray-100 text-gray-700";
}

const FREQ_STYLES: Record<RecurringFrequency, string> = {
  Daily: "text-red-600",
  Weekly: "text-blue-600",
  "Bi-weekly": "text-violet-600",
  Monthly: "text-green-600",
};

function RecurringSection({
  cadence,
  isOpen,
  onToggle,
}: {
  cadence: RecurringCadenceGroup[];
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="mt-4 border-t border-gray-100 pt-3">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between text-left"
      >
        <span className="text-xs font-medium text-gray-500">Recurring Cadence</span>
        <svg
          className={`h-3.5 w-3.5 shrink-0 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="mt-3 space-y-4">
          {cadence.map((group) => (
            <div key={group.frequency}>
              <p
                className={`mb-1.5 text-[10px] font-semibold uppercase tracking-wider ${FREQ_STYLES[group.frequency]}`}
              >
                {group.frequency}
              </p>
              <ul className="space-y-2">
                {group.tasks.map((t, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-300" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-snug text-gray-700">{t.task}</p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${categoryClass(t.category)}`}
                        >
                          {t.category}
                        </span>
                        <span className="text-[11px] text-gray-400">{t.collaborators}</span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
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
  const cadence = useMemo(() => getRecurringCadence(role), [role]);

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

  // Onboarding-read flag (first day only).
  const [onboardingRead, setOnboardingRead] = useLocalStorageString(
    `sc-training-day1-onboarding-read-${projectId}`,
  );

  // Recurring cadence open/closed.
  const [recurringOpenRaw, setRecurringOpenRaw] = useLocalStorageString(
    `sc-training-recurring-open-${projectId}`,
  );
  const isRecurringOpen = recurringOpenRaw === "1";
  const toggleRecurring = useCallback(
    () => setRecurringOpenRaw(isRecurringOpen ? "0" : "1"),
    [isRecurringOpen, setRecurringOpenRaw],
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
        throw new Error(data.error || "Failed to advance to the next period");
      }
      setCurrentIndex((i) => i + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to advance to the next period");
    } finally {
      setAdvancing(false);
    }
  }

  if (isCollapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed("0")}
        title={`Open ${current.timeframe} tasks`}
        aria-label={`Open ${current.timeframe} tasks`}
        className="fixed right-0 top-1/2 z-40 -translate-y-1/2 flex flex-col items-center gap-1.5 rounded-l-lg bg-amber-500 py-3 pl-2 pr-1.5 text-white shadow-lg transition-colors hover:bg-amber-600"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        <span className="text-xs font-semibold tracking-wide [writing-mode:vertical-rl]">
          {current.timeframe}
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
          <span className="text-sm font-semibold">{current.timeframe}</span>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed("1")}
          title="Collapse"
          aria-label="Collapse the task panel"
          className="rounded p-0.5 text-amber-50 transition-colors hover:bg-amber-600 hover:text-white"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </header>

      {/* Period context */}
      <div className="border-b border-gray-100 px-4 py-2.5">
        <p className="text-sm font-semibold text-gray-900">{current.phase}</p>
        <p className="text-xs text-gray-500">
          {doneCount}/{current.tasks.length} tasks done
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
          {isFirstDay ? "This week's tasks" : "Tasks"}
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

        {cadence.length > 0 && (
          <RecurringSection
            cadence={cadence}
            isOpen={isRecurringOpen}
            onToggle={toggleRecurring}
          />
        )}
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
              {advancing ? "Advancing…" : `Complete ${current.timeframe} →`}
            </button>
            <p className="mt-1.5 text-center text-[11px] text-gray-400">
              Next: {nextDay.timeframe} — {nextDay.phase}
            </p>
          </>
        ) : (
          <div className="rounded-md bg-green-50 px-3 py-2 text-center text-sm font-medium text-green-700">
            🎉 Project complete — all periods finished
          </div>
        )}
      </div>
    </aside>
  );
}
