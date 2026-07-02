"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { SimRole } from "@/lib/simulation-constants";
import {
  getTrainingSchedule,
  getRecurringCadence,
  getScheduledDay,
  resolveDayIndex,
  firstScheduledDay,
  lastScheduledDay,
  clampTrainingDay,
  phaseForDay,
  type TrainingDay,
  type RecurringCadenceGroup,
  type RecurringFrequency,
} from "@/lib/training-schedule";
import { INBOX_SENDERS, inboxEmailsForDay } from "@/lib/training-inbox";
import { getLesson } from "@/lib/training-lessons";

/**
 * Day-by-day task panel shown in a training sandbox. It surfaces the tasks
 * scheduled for the trainee's current in-sim day (from projects.training_day),
 * lets them check tasks off (per project + day, in localStorage), and advances
 * one day at a time with a "Complete Day" button (which persists the new
 * training_day server-side).
 *
 * The trainee always moves to the very next calendar day — even on days with no
 * scheduled task batch, which render as a quiet "no new tasks today" day. Task
 * batches and phase changes land on specific days (e.g. Day 1-7 of
 * pre-construction, then Day 14 foundations, Day 28 framing, …); the days in
 * between keep the current phase context and the recurring cadence.
 *
 * A collapsible "Recurring Cadence" section below the day's tasks surfaces the
 * standing Daily / Weekly / Bi-weekly / Monthly responsibilities.
 *
 * Day 1 also surfaces the role-specific company onboarding PDF.
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

  // Phases already closed out in a Job Review (written by the review tab; synced
  // here via the cross-tab `storage` event).
  const [reviewedRaw] = useLocalStorageString(`sc-training-reviews-${projectId}`);
  const reviewedPhases = useMemo<Set<string>>(() => {
    try {
      const arr = reviewedRaw ? (JSON.parse(reviewedRaw) as string[]) : [];
      return new Set(Array.isArray(arr) ? arr : []);
    } catch {
      return new Set();
    }
  }, [reviewedRaw]);

  // Popup shown the moment a phase is finished.
  const [reviewPopup, setReviewPopup] = useState<{ day: number; phase: string } | null>(null);
  const openReview = useCallback(
    (day: number) => {
      window.open(`/training/review?project=${projectId}&day=${day}`, "_blank", "noopener");
    },
    [projectId],
  );

  // Generate + persist the just-finished phase's Job Review in the background, so
  // it shows up as a saved review on the Training → Practice list even when the
  // trainee dismisses the popup instead of opening the review now. The split of
  // completed vs. missed tasks is read from the same localStorage checks the Day
  // panel writes. Idempotent server-side (upsert by project+phase), so later
  // opening the review re-saves harmlessly.
  const persistPhaseReview = useCallback(
    (phaseName: string, repDay: number) => {
      const completed: { task: string; category: string; collaborators: string; deliverable: string }[] = [];
      const missed: typeof completed = [];
      for (const d of schedule) {
        if (d.phase !== phaseName) continue;
        d.tasks.forEach((t, idx) => {
          const entry = {
            task: t.task,
            category: t.category,
            collaborators: t.collaborators,
            deliverable: t.deliverable,
          };
          (checks[`${d.day}-${idx}`] ? completed : missed).push(entry);
        });
      }
      if (completed.length + missed.length === 0) return;
      void fetch(`/api/training/projects/${projectId}/phase-review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phase: phaseName, day: repDay, completed, missed }),
      }).catch(() => {
        /* best-effort — the review still generates + persists when opened */
      });
    },
    [schedule, checks, projectId],
  );

  const [currentDay, setCurrentDay] = useState(() => clampTrainingDay(schedule, initialDay));
  const [advancing, setAdvancing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Broadcast the active day so the Coach narrator (a sibling in the project
  // layout) can surface the right message — on mount and on each advance.
  useEffect(() => {
    if (schedule.length === 0) return;
    writeString(`sc-training-active-day-${projectId}`, String(currentDay));
  }, [currentDay, schedule.length, projectId]);

  // Reconcile against the authoritative training_day on mount, with a no-store
  // fetch, so the saved day always wins on reopen — even if the server-rendered
  // initialDay was served stale by any cache. Only ever bumps *forward* to the
  // server's value: a legitimate in-session advance (which already persisted)
  // is never pulled back, and a stale low initialDay can never strand the
  // trainee on Day 1.
  const reconciledRef = useRef(false);
  useEffect(() => {
    if (reconciledRef.current || schedule.length === 0) return;
    reconciledRef.current = true;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/training/projects/${projectId}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        const serverDay = clampTrainingDay(schedule, Number(data.training_day) || 0);
        if (!cancelled) setCurrentDay((prev) => (serverDay > prev ? serverDay : prev));
      } catch {
        /* keep the server-rendered value */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, schedule]);

  // No schedule for this role yet — render nothing.
  if (schedule.length === 0) return null;

  const firstDay = firstScheduledDay(schedule);
  const lastDay = lastScheduledDay(schedule);
  // The task batch landing on exactly this day (null on the many in-between
  // days, which render as a quiet "no new tasks today" day).
  const taskEntry: TrainingDay | null = getScheduledDay(schedule, currentDay);
  // The phase/period context in effect (sticks to the most recent batch).
  const contextEntry: TrainingDay = schedule[resolveDayIndex(schedule, currentDay)];
  const tasks = taskEntry?.tasks ?? [];
  // Lessons recommended for this day's task batch, resolved to real lessons
  // (unknown ids are silently dropped so a curriculum rename can't crash the panel).
  const recommendedLessons = (taskEntry?.lessonIds ?? [])
    .map((id) => getLesson(id))
    .filter((l): l is NonNullable<ReturnType<typeof getLesson>> => !!l);
  const hasNextDay = currentDay < lastDay;
  const onboarding = ONBOARDING_BY_ROLE[role];
  const isFirstDay = currentDay === firstDay;
  const currentPhase = contextEntry.phase;

  const doneCount = tasks.reduce(
    (n, _t, i) => n + (checks[`${currentDay}-${i}`] ? 1 : 0),
    0,
  );

  // Inbound emails (owner / vendors / accounting) that landed today — delivered
  // server-side by the day-advance PATCH; this hint points the trainee at them.
  const todaysMail = inboxEmailsForDay(currentDay);
  const mailSenders = Array.from(
    new Set(
      todaysMail
        .map((m) => {
          const s = INBOX_SENDERS[m.senderKey];
          return s ? (s.internal ? "Accounting" : s.company) : "";
        })
        .filter(Boolean),
    ),
  ).join(", ");

  // Advancing to tomorrow crosses into a new phase → today wraps a phase, so its
  // Job Review is due.
  const nextPhase = hasNextDay ? phaseForDay(schedule, currentDay + 1) : currentPhase;
  const finishesPhase = hasNextDay && nextPhase !== currentPhase;
  // A prior phase was completed but hasn't been reviewed yet (persists across
  // reloads / dismissing the popup). The representative day is that phase's most
  // recent scheduled batch as of yesterday.
  const priorPhase = currentDay > firstDay ? phaseForDay(schedule, currentDay - 1) : currentPhase;
  const pendingReview =
    currentDay > firstDay && priorPhase !== currentPhase && !reviewedPhases.has(priorPhase)
      ? { day: schedule[resolveDayIndex(schedule, currentDay - 1)].day, phase: priorPhase }
      : null;
  // On the final day, its review is the project closeout review.
  const finalReviewDue = !hasNextDay && !reviewedPhases.has(currentPhase);

  async function completeDay() {
    if (!hasNextDay) return;
    setAdvancing(true);
    setError(null);
    const next = currentDay + 1;
    try {
      const res = await fetch(`/api/training/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ training_day: next }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to advance to the next day");
      }
      const completedPhase = currentPhase;
      const repDay = contextEntry.day;
      setCurrentDay(next);
      if (finishesPhase) {
        // Save the review now (background) so it's listed under the sandbox even
        // if the trainee picks "Later" on the popup below.
        persistPhaseReview(completedPhase, repDay);
        setReviewPopup({ day: repDay, phase: completedPhase });
      }
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
        title={`Open Day ${currentDay} tasks`}
        aria-label={`Open Day ${currentDay} tasks`}
        className="fixed right-0 top-1/2 z-40 -translate-y-1/2 flex flex-col items-center gap-1.5 rounded-l-lg bg-amber-500 py-3 pl-2 pr-1.5 text-white shadow-lg transition-colors hover:bg-amber-600"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        <span className="text-xs font-semibold tracking-wide [writing-mode:vertical-rl]">
          Day {currentDay}
        </span>
      </button>
    );
  }

  return (
    <>
      {reviewPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-xl">
            <div className="mb-2 text-3xl">📋</div>
            <h2 className="text-lg font-semibold text-gray-900">
              You wrapped up {reviewPopup.phase}
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Time for your Job Review — see how you ran this phase, what slipped, and close it out
              to catch up on anything you missed.
            </p>
            <div className="mt-5 flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  openReview(reviewPopup.day);
                  setReviewPopup(null);
                }}
                className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800"
              >
                Review your project
              </button>
              <button
                type="button"
                onClick={() => setReviewPopup(null)}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
              >
                Later
              </button>
            </div>
          </div>
        </div>
      )}
      <aside className="fixed right-0 top-1/2 z-40 flex max-h-[78vh] w-80 max-w-[calc(100vw-1.5rem)] -translate-y-1/2 flex-col overflow-hidden rounded-l-xl border border-amber-200 bg-white shadow-2xl">
      <header className="flex items-center justify-between rounded-tl-xl bg-amber-500 px-4 py-2.5 text-white">
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
          <span className="text-sm font-semibold">Day {currentDay}</span>
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

      {/* Phase / period context */}
      <div className="border-b border-gray-100 px-4 py-2.5">
        <p className="text-sm font-semibold text-gray-900">{currentPhase}</p>
        <p className="text-xs text-gray-500">
          {contextEntry.timeframe}
          {" · "}
          {taskEntry ? `${doneCount}/${tasks.length} tasks done` : "No new tasks today"}
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {pendingReview && (
          <button
            type="button"
            onClick={() => openReview(pendingReview.day)}
            className="mb-4 block w-full rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2.5 text-left transition-colors hover:bg-indigo-100"
          >
            <p className="text-xs font-semibold text-indigo-900">
              📋 Job Review ready — {pendingReview.phase}
            </p>
            <p className="mt-0.5 text-[11px] text-indigo-700">
              Review how you ran that phase, then close it out to catch up. →
            </p>
          </button>
        )}

        {todaysMail.length > 0 && (
          <a
            href={`/projects/${projectId}/emails`}
            className="mb-4 block rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 transition-colors hover:bg-blue-100"
          >
            <p className="text-xs font-semibold text-blue-900">
              📬 {todaysMail.length === 1 ? "New email" : `${todaysMail.length} new emails`} in your
              inbox
            </p>
            <p className="mt-0.5 text-[11px] text-blue-700">From {mailSenders} — open Emails →</p>
          </a>
        )}

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
          {isFirstDay ? "Day 1 tasks" : taskEntry ? "Today's tasks" : "Today"}
        </p>
        {taskEntry ? (
          <ul className="space-y-3">
            {tasks.map((t, i) => {
              const checked = !!checks[`${currentDay}-${i}`];
              return (
                <li key={i} className="flex items-start gap-2">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={checked}
                    onClick={() => toggleCheck(currentDay, i)}
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
        ) : (
          <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-4 text-center">
            <p className="text-sm text-gray-600">No new tasks scheduled for today.</p>
            <p className="mt-1 text-[11px] text-gray-400">
              Stay on top of your open items and the recurring cadence below, then move to the next
              day.
            </p>
          </div>
        )}

        {recommendedLessons.length > 0 && (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5">
            <p className="text-xs font-semibold text-emerald-900">📖 Recommended lessons</p>
            <p className="mt-0.5 text-[11px] text-emerald-700">
              Background reading for today&apos;s tasks — opens in Training → Lessons.
            </p>
            <ul className="mt-1.5 space-y-1">
              {recommendedLessons.map((l) => (
                <li key={l.id}>
                  <a
                    href={`/training/lessons?lesson=${l.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[13px] font-medium leading-snug text-emerald-800 hover:text-emerald-950 hover:underline"
                  >
                    {l.title}
                    <span className="ml-1 text-[11px] font-normal text-emerald-600">
                      · {l.minutes} min ↗
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

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
        {hasNextDay ? (
          <>
            <button
              type="button"
              onClick={completeDay}
              disabled={advancing}
              className="w-full rounded-md bg-amber-500 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-600 disabled:opacity-50"
            >
              {advancing ? "Advancing…" : `Complete Day ${currentDay} →`}
            </button>
            <p className="mt-1.5 text-center text-[11px] text-gray-400">
              Next: Day {currentDay + 1}
              {finishesPhase ? ` — ${nextPhase} begins` : ""}
            </p>
          </>
        ) : finalReviewDue ? (
          <>
            <button
              type="button"
              onClick={() => openReview(contextEntry.day)}
              className="w-full rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
            >
              Review your project →
            </button>
            <p className="mt-1.5 text-center text-[11px] text-gray-400">
              Close out the final phase to wrap up the job.
            </p>
          </>
        ) : (
          <div className="rounded-md bg-green-50 px-3 py-2 text-center text-sm font-medium text-green-700">
            🎉 Project complete — job finished
          </div>
        )}
      </div>
      </aside>
    </>
  );
}
