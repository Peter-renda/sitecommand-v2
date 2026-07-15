"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getTrainingSchedule } from "@/lib/training-schedule";
import { TRAINING_MEETINGS } from "@/lib/training-meetings";
import type { SimRole } from "@/lib/simulation-constants";

// ───────────────────────────── Types ─────────────────────────────

type Highlight = { kind: string; text: string };
type Resolution = { index: number; task: string; category: string; resolution: string };

/** Saved-minutes summary for a meeting held during this phase. */
type MeetingMinutesSummary = {
  meetingId: string;
  title: string;
  day: number;
  scoreCaught: number;
  scoreTotal: number;
  completedAt: string;
};

/** A scheduled task plus its position (so we can match localStorage checks). */
type PosTask = {
  day: number;
  idx: number;
  task: string;
  category: string;
  collaborators: string;
  deliverable: string;
};

// ───────────────────────────── localStorage helpers ─────────────────────────────

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore unavailable storage */
  }
}

// ───────────────────────────── Styling ─────────────────────────────

const HIGHLIGHT_STYLES: Record<string, { label: string; cls: string; icon: string }> = {
  praise: { label: "Strength", cls: "bg-emerald-50 border-emerald-200 text-emerald-800", icon: "✓" },
  tip: { label: "Coaching", cls: "bg-blue-50 border-blue-200 text-blue-800", icon: "→" },
  warning: { label: "Watch", cls: "bg-amber-50 border-amber-200 text-amber-800", icon: "!" },
  missed_submittal: { label: "Missed submittal", cls: "bg-red-50 border-red-200 text-red-800", icon: "▲" },
  missed_rfi: { label: "Missed RFI", cls: "bg-red-50 border-red-200 text-red-800", icon: "▲" },
};

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

// ───────────────────────────── Component ─────────────────────────────

export default function TrainingReviewClient({
  projectId,
  role,
  projectName,
  phase,
  day,
}: {
  projectId: string;
  role: SimRole;
  projectName: string;
  phase: string;
  day: number;
}) {
  // Every scheduled task that belongs to this phase, with its day + index so we
  // can read/write the Day panel's localStorage checks.
  const phaseTasks = useMemo<PosTask[]>(() => {
    const out: PosTask[] = [];
    for (const d of getTrainingSchedule(role)) {
      if (d.phase !== phase) continue;
      d.tasks.forEach((t, idx) =>
        out.push({ day: d.day, idx, task: t.task, category: t.category, collaborators: t.collaborators, deliverable: t.deliverable }),
      );
    }
    return out;
  }, [role, phase]);

  // Meetings scheduled during this phase (by day), and their saved minutes.
  const phaseMeetings = useMemo(() => {
    const phaseDays = new Set(
      getTrainingSchedule(role)
        .filter((d) => d.phase === phase)
        .map((d) => d.day),
    );
    return TRAINING_MEETINGS.filter((m) => m.role === role && phaseDays.has(m.day));
  }, [role, phase]);
  const [meetingMinutes, setMeetingMinutes] = useState<MeetingMinutesSummary[]>([]);

  useEffect(() => {
    if (phaseMeetings.length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/training/meetings/minutes`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setMeetingMinutes(data.minutes ?? []);
      } catch {
        /* the section just shows meetings without minutes */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, phaseMeetings.length]);

  const tasksKey = `sc-training-tasks-${projectId}`;
  const reviewsKey = `sc-training-reviews-${projectId}`;

  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [review, setReview] = useState("");
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [resolutions, setResolutions] = useState<Resolution[]>([]);
  const [completed, setCompleted] = useState<PosTask[]>([]);
  const [missed, setMissed] = useState<PosTask[]>([]);
  const [closedOut, setClosedOut] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // Map a saved task (server snapshot — no position) back to its scheduled
    // position so the lists render and close-out can tick the right boxes.
    // Falls back to this phase's representative day with idx -1 (a harmless,
    // non-matching key) if the task text no longer lines up with the schedule.
    function toPos(list: Omit<PosTask, "day" | "idx">[]): PosTask[] {
      const used = new Set<number>();
      return list.map((t) => {
        const hit = phaseTasks.findIndex(
          (p, i) => !used.has(i) && p.task === t.task && p.category === t.category,
        );
        if (hit >= 0) {
          used.add(hit);
          return phaseTasks[hit];
        }
        return { day, idx: -1, ...t };
      });
    }

    async function run() {
      const reviewed = readJSON<string[]>(reviewsKey, []);

      // 1. Server is the source of truth: a saved review survives reloads and
      //    opens from the Training → Practice list, in any browser.
      try {
        const res = await fetch(`/api/training/projects/${projectId}/reviews`, {
          cache: "no-store",
        });
        if (res.ok) {
          const data = await res.json();
          const saved = (data.reviews ?? []).find(
            (r: { phase?: string }) => r.phase === phase,
          );
          if (saved && !cancelled) {
            setReview(saved.review ?? "");
            setHighlights(saved.highlights ?? []);
            setResolutions(saved.resolutions ?? []);
            setCompleted(toPos(saved.completed ?? []));
            setMissed(toPos(saved.missed ?? []));
            setClosedOut(!!saved.closed_out || reviewed.includes(phase));
            setStatus("ready");
            return;
          }
        }
      } catch {
        /* fall through to generate */
      }
      if (cancelled) return;

      // 2. No saved review yet — split this phase's tasks into completed vs
      //    missed from the Day panel's stored check state, then ask the model.
      //    The POST persists the result so it's there next time.
      const checks = readJSON<Record<string, boolean>>(tasksKey, {});
      const comp: PosTask[] = [];
      const miss: PosTask[] = [];
      for (const t of phaseTasks) {
        (checks[`${t.day}-${t.idx}`] ? comp : miss).push(t);
      }
      if (!cancelled) {
        setCompleted(comp);
        setMissed(miss);
      }

      const strip = (t: PosTask) => ({
        task: t.task,
        category: t.category,
        collaborators: t.collaborators,
        deliverable: t.deliverable,
      });

      try {
        const res = await fetch(`/api/training/projects/${projectId}/phase-review`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phase, day, completed: comp.map(strip), missed: miss.map(strip) }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to generate review");
        if (cancelled) return;
        setReview(data.review ?? "");
        setHighlights(data.highlights ?? []);
        setResolutions(data.resolutions ?? []);
        setClosedOut(reviewed.includes(phase));
        setStatus("ready");
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to generate review");
        setStatus("error");
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [projectId, phase, day, phaseTasks, tasksKey, reviewsKey]);

  const closeOut = useCallback(async () => {
    setClosing(true);
    // Auto-complete every missed task by checking it off in the same store the
    // Day panel reads — the project tab picks this up via the `storage` event.
    const checks = readJSON<Record<string, boolean>>(tasksKey, {});
    for (const t of missed) checks[`${t.day}-${t.idx}`] = true;
    writeJSON(tasksKey, checks);

    const reviewed = readJSON<string[]>(reviewsKey, []);
    if (!reviewed.includes(phase)) reviewed.push(phase);
    writeJSON(reviewsKey, reviewed);

    // Persist the close-out so it sticks across reloads and other browsers (the
    // localStorage writes above only sync the Day panel in this browser).
    try {
      await fetch(`/api/training/projects/${projectId}/reviews`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phase, closedOut: true }),
      });
    } catch {
      /* local catch-up already applied; non-fatal */
    }

    setClosedOut(true);
    setClosing(false);
  }, [missed, phase, projectId, tasksKey, reviewsKey]);

  function returnToProject() {
    window.close();
    window.location.href = `/projects/${projectId}`;
  }

  const total = completed.length + missed.length;
  const donePct = total > 0 ? Math.round((completed.length / total) * 100) : 100;

  return (
    <div className="max-w-3xl">
      {/* Header */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 sm:p-6 mb-5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
          Phase Job Review
        </p>
        <h1 className="text-xl font-semibold text-gray-900 mt-0.5">{phase}</h1>
        <p className="text-sm text-gray-500 mt-0.5">{projectName}</p>
        <div className="mt-3 flex items-center gap-4 text-sm">
          <span className="text-emerald-600 font-medium">{completed.length} completed</span>
          <span className="text-red-600 font-medium">{missed.length} missed</span>
          <span className="text-gray-400">{donePct}% done</span>
        </div>
      </div>

      {status === "loading" && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 mb-5">
          <p className="text-sm text-gray-400">Reviewing how you ran this phase…</p>
        </div>
      )}

      {status === "error" && (
        <>
          <div className="rounded-xl border border-red-200 bg-red-50 p-5 mb-5">
            <p className="text-sm text-red-700">{error}</p>
            <button
              onClick={returnToProject}
              className="mt-3 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Back to project
            </button>
          </div>
          {/* The saved meeting minutes stay reachable even when the AI review
              couldn't be generated. */}
          <MeetingMinutesSection
            projectId={projectId}
            phaseMeetings={phaseMeetings}
            meetingMinutes={meetingMinutes}
          />
        </>
      )}

      {status === "ready" && (
        <>
          {/* Catch-up confirmation */}
          {closedOut && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 mb-5">
              <p className="text-sm font-semibold text-emerald-900">
                ✓ Review closed out — you&apos;re caught back up.
              </p>
              {missed.length > 0 ? (
                <>
                  <p className="text-sm text-emerald-800 mt-1">
                    {missed.length} missed {missed.length === 1 ? "task was" : "tasks were"}{" "}
                    auto-completed to keep the project on track:
                  </p>
                  <ul className="mt-3 space-y-2">
                    {missed.map((t, i) => {
                      const r = resolutions.find((x) => x.index === i);
                      return (
                        <li
                          key={`${t.day}-${t.idx}`}
                          className="text-sm text-emerald-900 bg-white/70 border border-emerald-200 rounded-lg px-3 py-2"
                        >
                          <span className="font-medium">{t.category}:</span>{" "}
                          {r?.resolution ?? `${t.deliverable} was handled to keep the project on track.`}
                        </li>
                      );
                    })}
                  </ul>
                </>
              ) : (
                <p className="text-sm text-emerald-800 mt-1">
                  Nothing was missed this phase — nice work staying on top of it.
                </p>
              )}
              <button
                onClick={returnToProject}
                className="mt-4 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 transition-colors"
              >
                Return to project
              </button>
            </div>
          )}

          {/* AI narrative */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 sm:p-6 mb-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-2">Performance review</h2>
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
              {review || "No review available."}
            </p>
            {highlights.length > 0 && (
              <div className="mt-4 space-y-2">
                {highlights.map((h, i) => {
                  const s = HIGHLIGHT_STYLES[h.kind] ?? HIGHLIGHT_STYLES.tip;
                  return (
                    <div key={i} className={`rounded-lg border px-3 py-2 text-sm flex items-start gap-2 ${s.cls}`}>
                      <span className="font-semibold shrink-0">{s.icon}</span>
                      <span>
                        <span className="font-semibold">{s.label}.</span> {h.text}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Meetings held this phase — hyperlink to the saved minutes + score */}
          <MeetingMinutesSection
            projectId={projectId}
            phaseMeetings={phaseMeetings}
            meetingMinutes={meetingMinutes}
          />

          {/* Completed */}
          <div className="mb-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-2">
              Completed tasks <span className="text-gray-400 font-normal">({completed.length})</span>
            </h2>
            {completed.length > 0 ? (
              <div className="space-y-2">
                {completed.map((t) => (
                  <TaskRow key={`${t.day}-${t.idx}`} t={t} tone="done" />
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">You didn&apos;t check off any tasks this phase.</p>
            )}
          </div>

          {/* Missed */}
          {missed.length > 0 && (
            <div className="mb-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-2">
                {closedOut ? "Auto-completed" : "Missed"} tasks{" "}
                <span className="text-gray-400 font-normal">({missed.length})</span>
              </h2>
              <div className="space-y-2">
                {missed.map((t) => (
                  <TaskRow key={`${t.day}-${t.idx}`} t={t} tone={closedOut ? "auto" : "missed"} />
                ))}
              </div>
              {!closedOut && (
                <p className="text-xs text-gray-400 mt-2">
                  These will be auto-completed when you close out the review so the project stays on track.
                </p>
              )}
            </div>
          )}

          {/* Close-out / footer */}
          {!closedOut && (
            <div className="flex items-center gap-3 border-t border-gray-100 pt-5">
              <button
                onClick={closeOut}
                disabled={closing}
                className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 transition-colors"
              >
                {closing ? "Catching you up…" : "Close out review & catch up"}
              </button>
              <button
                onClick={returnToProject}
                className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
              >
                Review later
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function MeetingMinutesSection({
  projectId,
  phaseMeetings,
  meetingMinutes,
}: {
  projectId: string;
  phaseMeetings: { id: string; title: string; day: number }[];
  meetingMinutes: MeetingMinutesSummary[];
}) {
  if (phaseMeetings.length === 0) return null;
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 sm:p-6 mb-5">
      <h2 className="text-sm font-semibold text-gray-900 mb-2">Meeting minutes</h2>
      <div className="space-y-2">
        {phaseMeetings.map((m) => {
          const saved = meetingMinutes.find((mm) => mm.meetingId === m.id);
          const pct =
            saved && saved.scoreTotal > 0
              ? Math.round((saved.scoreCaught / saved.scoreTotal) * 100)
              : 0;
          return (
            <div
              key={m.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-100 bg-gray-50/60 px-3 py-2"
            >
              <div className="min-w-0">
                <a
                  href={`/training/meeting?project=${projectId}&meeting=${m.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                >
                  {m.title}
                  <span className="ml-1 text-[11px] font-normal text-gray-400">
                    · Day {m.day} {saved ? "· open minutes ↗" : "· join meeting ↗"}
                  </span>
                </a>
              </div>
              {saved ? (
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    pct >= 80
                      ? "bg-emerald-100 text-emerald-800"
                      : pct >= 50
                        ? "bg-amber-100 text-amber-800"
                        : "bg-red-100 text-red-700"
                  }`}
                >
                  {saved.scoreCaught}/{saved.scoreTotal} caught
                </span>
              ) : (
                <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500">
                  not held
                </span>
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-gray-400">
        Each meeting contained planted issues to catch — the score shows how many you spotted.
      </p>
    </div>
  );
}

function TaskRow({ t, tone }: { t: PosTask; tone: "done" | "missed" | "auto" }) {
  const border =
    tone === "done"
      ? "border-emerald-200 bg-emerald-50/40"
      : tone === "auto"
        ? "border-amber-200 bg-amber-50/40"
        : "border-red-200 bg-red-50/40";
  const mark = tone === "done" ? "✓" : tone === "auto" ? "↺" : "✕";
  const markColor = tone === "done" ? "text-emerald-600" : tone === "auto" ? "text-amber-600" : "text-red-500";

  return (
    <div className={`rounded-lg border p-3 ${border}`}>
      <div className="flex items-start gap-2">
        <span className={`mt-0.5 shrink-0 ${markColor}`}>{mark}</span>
        <div className="min-w-0">
          <p className="text-sm text-gray-800 leading-snug">{t.task}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${categoryClass(t.category)}`}>
              {t.category}
            </span>
            <span className="text-[11px] text-gray-400">{t.collaborators}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
