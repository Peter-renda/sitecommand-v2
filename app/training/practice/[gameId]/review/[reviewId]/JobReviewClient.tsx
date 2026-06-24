"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { actionTypeLabel } from "@/lib/simulation-constants";

// ───────────────────────────── Types ─────────────────────────────

type Highlight = { kind: string; text: string };

type Review = {
  id: string;
  review_number: number;
  from_day: number;
  to_day: number;
  from_week: number;
  to_week: number;
  is_final: boolean;
  status: "open" | "acknowledged";
  generated: boolean;
  score: number;
  max_score: number;
  grade: string;
  review: string;
  highlights: Highlight[];
  resolutions: { required_action_id: string; action_type: string; title: string; resolution: string }[];
  completed_count: number;
  missed_count: number;
  catch_up_count: number;
  acknowledged_at: string | null;
};

type CompletedTask = {
  required_action_id: string;
  day_number: number;
  week: number;
  action_type: string;
  title: string;
  score: number;
  max_score: number;
  feedback: string;
  auto_completed: boolean;
};

type MissedTask = {
  required_action_id: string;
  day_number: number;
  week: number;
  action_type: string;
  title: string;
  description: string;
  points: number;
};

type ProactiveTask = {
  day_number: number;
  week: number;
  action_type: string;
  title: string;
  score: number;
  max_score: number;
  feedback: string;
};

type Tasks = {
  completed: CompletedTask[];
  missed: MissedTask[];
  proactive: ProactiveTask[];
  earned: number;
  possible: number;
};

type GameInfo = {
  id: string;
  role_label: string;
  project_type_label: string;
  project_name: string;
  location: string;
  total_days: number;
  status: string;
};

type CaughtUp = { action_type: string; title: string; resolution: string };

// ───────────────────────────── Helpers ─────────────────────────────

function pct(earned: number, possible: number): number {
  return possible > 0 ? Math.round((earned / possible) * 100) : 0;
}

function gradeColor(grade: string): string {
  if (grade.startsWith("A")) return "text-emerald-600";
  if (grade.startsWith("B")) return "text-blue-600";
  if (grade.startsWith("C")) return "text-amber-600";
  return "text-red-600";
}

const HIGHLIGHT_STYLES: Record<string, { label: string; cls: string; icon: string }> = {
  praise: { label: "Strength", cls: "bg-emerald-50 border-emerald-200 text-emerald-800", icon: "✓" },
  tip: { label: "Coaching", cls: "bg-blue-50 border-blue-200 text-blue-800", icon: "→" },
  warning: { label: "Watch", cls: "bg-amber-50 border-amber-200 text-amber-800", icon: "!" },
  missed_submittal: { label: "Missed submittal", cls: "bg-red-50 border-red-200 text-red-800", icon: "▲" },
  missed_rfi: { label: "Missed RFI", cls: "bg-red-50 border-red-200 text-red-800", icon: "▲" },
};

function periodTitle(r: Review): string {
  if (r.is_final && r.review_number > 1) return "Final Project Review";
  const span = r.from_week === r.to_week ? `Week ${r.from_week}` : `Weeks ${r.from_week}–${r.to_week}`;
  return `4-Week Job Review · ${span}`;
}

// ───────────────────────────── Component ─────────────────────────────

export default function JobReviewClient({ gameId, reviewId }: { gameId: string; reviewId: string }) {
  const [review, setReview] = useState<Review | null>(null);
  const [tasks, setTasks] = useState<Tasks | null>(null);
  const [game, setGame] = useState<GameInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [closing, setClosing] = useState(false);
  const [caughtUp, setCaughtUp] = useState<CaughtUp[] | null>(null);

  const base = `/api/training/games/${gameId}/reviews/${reviewId}`;

  const generate = useCallback(async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`${base}/generate`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate review");
      setReview(data.review);
      if (data.tasks) setTasks(data.tasks);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate review");
    } finally {
      setGenerating(false);
    }
  }, [base]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(base);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load review");
      setReview(data.review);
      setTasks(data.tasks);
      setGame(data.game);
      if (data.review?.status === "open" && !data.review?.generated) {
        await generate();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load review");
    } finally {
      setLoading(false);
    }
  }, [base, generate]);

  useEffect(() => {
    load();
  }, [load]);

  async function closeOut() {
    if (!review) return;
    setClosing(true);
    setError(null);
    try {
      const res = await fetch(`${base}/acknowledge`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to close out review");
      setReview(data.review);
      setCaughtUp(data.caughtUp ?? []);
      // Refresh the breakdown so missed tasks now show as auto-completed.
      const refreshed = await fetch(base);
      if (refreshed.ok) {
        const rd = await refreshed.json();
        setTasks(rd.tasks);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to close out review");
    } finally {
      setClosing(false);
    }
  }

  function returnToSim() {
    // Opened in a new tab from the simulator → try to close it; otherwise route back.
    window.close();
    window.location.href = "/training/practice";
  }

  if (loading) {
    return (
      <div className="max-w-3xl">
        <p className="text-sm text-gray-400">Loading your review…</p>
      </div>
    );
  }

  if (error && !review) {
    return (
      <div className="max-w-3xl">
        <p className="text-sm text-red-600">{error}</p>
        <Link href="/training/practice" className="text-sm text-gray-500 hover:text-gray-900 mt-3 inline-block">
          ← Back to simulation
        </Link>
      </div>
    );
  }

  if (!review) return null;

  const acknowledged = review.status === "acknowledged";
  const generatingContent = generating || (review.status === "open" && !review.generated);

  return (
    <div className="max-w-3xl">
      {/* Header */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 sm:p-6 mb-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
              {periodTitle(review)}
            </p>
            <h1 className="text-xl font-semibold text-gray-900 mt-0.5">
              {game?.project_name ?? "Project Review"}
            </h1>
            {game && (
              <p className="text-sm text-gray-500 mt-0.5">
                {game.project_type_label} · {game.location} · run as {game.role_label}
              </p>
            )}
            <p className="text-xs text-gray-400 mt-1">
              Covers days {review.from_day}–{review.to_day} of {game?.total_days ?? "?"}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className={`text-3xl font-semibold ${gradeColor(review.grade || "")}`}>
              {review.grade || "—"}
            </p>
            <p className="text-xs text-gray-400">
              {Math.round(review.score)}/{review.max_score} pts · {pct(review.score, review.max_score)}%
            </p>
          </div>
        </div>
      </div>

      {/* Catch-up confirmation (after close-out) */}
      {caughtUp && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 mb-5">
          <p className="text-sm font-semibold text-emerald-900">
            ✓ Review closed out — you&apos;re caught back up.
          </p>
          {caughtUp.length > 0 ? (
            <>
              <p className="text-sm text-emerald-800 mt-1">
                {caughtUp.length} missed {caughtUp.length === 1 ? "task was" : "tasks were"}{" "}
                auto-completed to keep the project on track:
              </p>
              <ul className="mt-3 space-y-2">
                {caughtUp.map((c, i) => (
                  <li key={i} className="text-sm text-emerald-900 bg-white/70 border border-emerald-200 rounded-lg px-3 py-2">
                    <span className="font-medium">{actionTypeLabel(c.action_type)}:</span> {c.resolution}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-sm text-emerald-800 mt-1">
              Nothing was missed this period — nice work staying on top of it.
            </p>
          )}
          <button
            onClick={returnToSim}
            className="mt-4 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 transition-colors"
          >
            Return to simulation
          </button>
        </div>
      )}

      {/* AI narrative review */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 sm:p-6 mb-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-2">Performance review</h2>
        {generatingContent ? (
          <p className="text-sm text-gray-400">Reviewing your project…</p>
        ) : (
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
            {review.review || "No review available."}
          </p>
        )}

        {review.highlights?.length > 0 && (
          <div className="mt-4 space-y-2">
            {review.highlights.map((h, i) => {
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

      {/* Completed tasks */}
      <div className="mb-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-2">
          Completed tasks{" "}
          <span className="text-gray-400 font-normal">({tasks?.completed.length ?? 0})</span>
        </h2>
        {tasks && tasks.completed.length > 0 ? (
          <div className="space-y-2">
            {tasks.completed.map((t) => (
              <div
                key={t.required_action_id}
                className={`rounded-lg border p-3 ${
                  t.auto_completed ? "border-amber-200 bg-amber-50/40" : "border-emerald-200 bg-emerald-50/40"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={t.auto_completed ? "text-amber-600" : "text-emerald-600"}>
                      {t.auto_completed ? "↺" : "✓"}
                    </span>
                    <span className="text-sm font-medium text-gray-900 truncate">{t.title}</span>
                    <span className="text-[10px] uppercase tracking-wide text-gray-400 bg-white border border-gray-200 rounded px-1.5 py-0.5 shrink-0">
                      {actionTypeLabel(t.action_type)}
                    </span>
                    <span className="text-[10px] text-gray-400 shrink-0">Wk {t.week}</span>
                    {t.auto_completed && (
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-700 bg-amber-100 border border-amber-200 rounded px-1.5 py-0.5 shrink-0">
                        Auto
                      </span>
                    )}
                  </div>
                  <span className="text-sm font-semibold text-gray-700 shrink-0">
                    {t.score}/{t.max_score}
                  </span>
                </div>
                {t.feedback && <p className="text-xs text-gray-600 mt-2 italic">“{t.feedback}”</p>}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400">No required tasks were completed this period.</p>
        )}
      </div>

      {/* Missed tasks */}
      {tasks && tasks.missed.length > 0 && (
        <div className="mb-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-2">
            Missed tasks <span className="text-gray-400 font-normal">({tasks.missed.length})</span>
          </h2>
          <div className="space-y-2">
            {tasks.missed.map((t) => (
              <div key={t.required_action_id} className="rounded-lg border border-red-200 bg-red-50/40 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-red-500">✕</span>
                    <span className="text-sm font-medium text-gray-900 truncate">{t.title}</span>
                    <span className="text-[10px] uppercase tracking-wide text-gray-400 bg-white border border-gray-200 rounded px-1.5 py-0.5 shrink-0">
                      {actionTypeLabel(t.action_type)}
                    </span>
                    <span className="text-[10px] text-gray-400 shrink-0">Wk {t.week}</span>
                  </div>
                  <span className="text-sm font-semibold text-red-600 shrink-0">0/{t.points}</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">{t.description}</p>
              </div>
            ))}
          </div>
          {!acknowledged && (
            <p className="text-xs text-gray-400 mt-2">
              These will be auto-completed when you close out the review so the project stays on track.
            </p>
          )}
        </div>
      )}

      {/* Proactive extras */}
      {tasks && tasks.proactive.length > 0 && (
        <div className="mb-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-2">
            Extra actions you took{" "}
            <span className="text-gray-400 font-normal">({tasks.proactive.length})</span>
          </h2>
          <div className="space-y-2">
            {tasks.proactive.map((t, i) => (
              <div key={i} className="rounded-lg border border-gray-200 bg-gray-50/50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-medium text-gray-900 truncate">
                      {t.title || actionTypeLabel(t.action_type)}
                    </span>
                    <span className="text-[10px] uppercase tracking-wide text-gray-400 bg-white border border-gray-200 rounded px-1.5 py-0.5 shrink-0">
                      {actionTypeLabel(t.action_type)}
                    </span>
                  </div>
                  <span className="text-sm font-semibold text-gray-700 shrink-0">
                    {t.score}/{t.max_score}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      {/* Close-out / footer actions */}
      {!caughtUp && (
        <div className="flex items-center gap-3 border-t border-gray-100 pt-5">
          {acknowledged ? (
            <>
              <span className="text-sm text-gray-500">
                This review was closed out
                {review.catch_up_count > 0
                  ? ` — ${review.catch_up_count} task${review.catch_up_count === 1 ? "" : "s"} were auto-completed.`
                  : "."}
              </span>
              <Link
                href="/training/practice"
                className="ml-auto rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Back to simulation
              </Link>
            </>
          ) : (
            <>
              <button
                onClick={closeOut}
                disabled={closing || generatingContent}
                className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 transition-colors"
              >
                {closing ? "Catching you up…" : "Close out review & catch up"}
              </button>
              <Link
                href="/training/practice"
                className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
              >
                Review later
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}
