"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ROLES,
  PROJECT_TYPES,
  ROLE_ACTION_TYPES,
  roleLabel,
  projectTypeLabel,
  actionTypeLabel,
  type SimRole,
  type ScoringFrequency,
} from "@/lib/simulation-constants";

// ───────────────────────────── Types ─────────────────────────────

type SimEvent = {
  id: string;
  type: string;
  severity: "info" | "minor" | "major" | "critical";
  title: string;
  description: string;
};

type RequiredAction = {
  id: string;
  action_type: string;
  title: string;
  description: string;
  points: number;
};

type Day = {
  id: string;
  day_number: number;
  sim_date: string;
  weather: string;
  summary: string;
  events: SimEvent[];
  required_actions: RequiredAction[];
  generated_at: string;
};

type Action = {
  id: string;
  day_id: string;
  day_number: number;
  required_action_id: string | null;
  action_type: string;
  title: string;
  content: string;
  score: number;
  max_score: number;
  feedback: string;
  auto_completed?: boolean;
  created_at: string;
};

type JobReview = {
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
  completed_count: number;
  missed_count: number;
  catch_up_count: number;
  created_at: string;
  acknowledged_at: string | null;
};

type ScoreReport = {
  id: string;
  period_kind: string;
  label: string;
  from_day: number;
  to_day: number;
  score: number;
  max_score: number;
  grade: string;
  review: string;
  created_at: string;
};

type Game = {
  id: string;
  role: SimRole;
  project_type: string;
  project_name: string;
  project_overview: string;
  location: string;
  contract_value: number;
  total_days: number;
  current_day: number;
  scoring_frequency: ScoringFrequency;
  days_per_advance: number;
  status: string;
  score: number;
  max_score: number;
};

type GameState = {
  game: Game;
  days: Day[];
  actions: Action[];
  reports: ScoreReport[];
  jobReviews: JobReview[];
};

// ───────────────────────────── Helpers ─────────────────────────────

const SEVERITY_STYLES: Record<string, string> = {
  info: "bg-gray-100 text-gray-600 border-gray-200",
  minor: "bg-amber-50 text-amber-700 border-amber-200",
  major: "bg-orange-100 text-orange-800 border-orange-300",
  critical: "bg-red-100 text-red-800 border-red-300",
};

function money(n: number): string {
  return "$" + Math.round(n).toLocaleString();
}

function pct(earned: number, possible: number): number {
  return possible > 0 ? Math.round((earned / possible) * 100) : 0;
}

function gradeColor(grade: string): string {
  if (grade.startsWith("A")) return "text-emerald-600";
  if (grade.startsWith("B")) return "text-blue-600";
  if (grade.startsWith("C")) return "text-amber-600";
  return "text-red-600";
}

/** 5 working days per week → the week a 1-indexed working day belongs to. */
function weekOfDay(day: number): number {
  return Math.max(1, Math.ceil(day / 5));
}

function reviewUrl(gameId: string, reviewId: string): string {
  return `/training/practice/${gameId}/review/${reviewId}`;
}

function weekSpanLabel(r: JobReview): string {
  return r.from_week === r.to_week ? `Week ${r.from_week}` : `Weeks ${r.from_week}–${r.to_week}`;
}

// ───────────────────────────── Component ─────────────────────────────

export default function PracticeClient({ username }: { username: string }) {
  const [games, setGames] = useState<Game[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const loadGames = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await fetch("/api/training/games");
      const data = await res.json();
      setGames(data.games ?? []);
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    loadGames();
  }, [loadGames]);

  if (selectedId) {
    return (
      <GameView
        gameId={selectedId}
        onBack={() => {
          setSelectedId(null);
          loadGames();
        }}
      />
    );
  }

  return (
    <Hub
      username={username}
      games={games}
      loading={loadingList}
      onOpen={(id) => setSelectedId(id)}
      onCreated={(id) => setSelectedId(id)}
      reload={loadGames}
    />
  );
}

// ───────────────────────────── Hub / setup ─────────────────────────────

function Hub({
  username,
  games,
  loading,
  onOpen,
  onCreated,
  reload,
}: {
  username: string;
  games: Game[];
  loading: boolean;
  onOpen: (id: string) => void;
  onCreated: (id: string) => void;
  reload: () => void;
}) {
  const [role, setRole] = useState<SimRole>("superintendent");
  const [projectType, setProjectType] = useState<string>("multifamily");
  const [scoringFrequency, setScoringFrequency] = useState<ScoringFrequency>("weekly");
  const [daysPerAdvance, setDaysPerAdvance] = useState(1);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/training/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, projectType, scoringFrequency, daysPerAdvance }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start project");
      onCreated(data.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start project");
    } finally {
      setCreating(false);
    }
  }

  const firstName = (username || "there").split(/[\s.@]/)[0];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Project Simulation</h1>
        <p className="mt-1 text-sm text-gray-500 max-w-2xl">
          Run a simulated construction project end to end, {firstName}. Pick your role and a
          project type, then play through it one day at a time — read the daily rundown, handle the
          problems that come up, and file the daily logs, PCOs, RFIs, and emails the job needs.
          Everything you submit is graded and scored.
        </p>
      </div>

      {/* New simulation */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 sm:p-6 mb-8">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Start a new project</h2>

        {/* Role */}
        <label className="block text-xs font-medium text-gray-500 mb-2">Your role</label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
          {ROLES.map((r) => (
            <button
              key={r.value}
              onClick={() => setRole(r.value)}
              className={`text-left rounded-lg border p-3.5 transition-colors ${
                role === r.value
                  ? "border-gray-900 bg-gray-900 text-white"
                  : "border-gray-200 hover:border-gray-300 bg-white"
              }`}
            >
              <p className={`text-sm font-medium ${role === r.value ? "text-white" : "text-gray-900"}`}>
                {r.label}
              </p>
              <p className={`mt-1 text-xs ${role === r.value ? "text-gray-300" : "text-gray-500"}`}>
                {r.blurb}
              </p>
            </button>
          ))}
        </div>

        {/* Project type + settings */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Project type</label>
            <select
              value={projectType}
              onChange={(e) => setProjectType(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
            >
              {PROJECT_TYPES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Scoring</label>
            <select
              value={scoringFrequency}
              onChange={(e) => setScoringFrequency(e.target.value as ScoringFrequency)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
            >
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="project_end">End of project</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              Speed (days per advance)
            </label>
            <select
              value={daysPerAdvance}
              onChange={(e) => setDaysPerAdvance(Number(e.target.value))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
            >
              {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                <option key={n} value={n}>
                  {n} {n === 1 ? "day" : "days"} / advance
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

        <button
          onClick={start}
          disabled={creating}
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 transition-colors"
        >
          {creating ? "Setting up your project…" : "Start project"}
        </button>
      </div>

      {/* Existing games */}
      <div>
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Your projects</h2>
        {loading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : games.length === 0 ? (
          <p className="text-sm text-gray-400">No projects yet. Start one above.</p>
        ) : (
          <div className="space-y-2">
            {games.map((g) => (
              <GameRow key={g.id} game={g} onOpen={() => onOpen(g.id)} reload={reload} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function GameRow({ game, onOpen, reload }: { game: Game; onOpen: () => void; reload: () => void }) {
  const [deleting, setDeleting] = useState(false);
  const progress = Math.round((game.current_day / Math.max(1, game.total_days)) * 100);

  async function remove(e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm(`Delete "${game.project_name}"? This can't be undone.`)) return;
    setDeleting(true);
    try {
      await fetch(`/api/training/games/${game.id}`, { method: "DELETE" });
      reload();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <button
      onClick={onOpen}
      className="w-full text-left rounded-lg border border-gray-200 bg-white p-4 hover:border-gray-300 hover:shadow-sm transition-all flex items-center gap-4"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-gray-900 truncate">{game.project_name}</p>
          {game.status === "completed" && (
            <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5">
              Complete
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-0.5">
          {roleLabel(game.role)} · {projectTypeLabel(game.project_type)} · Day {game.current_day} of{" "}
          {game.total_days}
        </p>
        <div className="mt-2 h-1.5 w-full max-w-xs rounded-full bg-gray-100 overflow-hidden">
          <div className="h-full bg-gray-900" style={{ width: `${progress}%` }} />
        </div>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-semibold text-gray-900">
          {pct(game.score, game.max_score)}%
        </p>
        <p className="text-[11px] text-gray-400">
          {Math.round(game.score)}/{game.max_score} pts
        </p>
      </div>
      <span
        onClick={remove}
        className="shrink-0 text-gray-300 hover:text-red-500 transition-colors p-1"
        title="Delete project"
      >
        {deleting ? "…" : "✕"}
      </span>
    </button>
  );
}

// ───────────────────────────── Game view ─────────────────────────────

function GameView({ gameId, onBack }: { gameId: string; onBack: () => void }) {
  const [state, setState] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(true);
  const [advancing, setAdvancing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [latestReportId, setLatestReportId] = useState<string | null>(null);
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [pendingReview, setPendingReview] = useState<JobReview | null>(null);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const res = await fetch(`/api/training/games/${gameId}`);
        const data = await res.json();
        if (res.ok) setState(data);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [gameId],
  );

  useEffect(() => {
    load();
  }, [load]);

  // Land on (and follow) the latest week as the project advances.
  const currentDay = state?.game.current_day ?? 0;
  useEffect(() => {
    setSelectedWeek(weekOfDay(Math.max(1, currentDay)));
  }, [currentDay]);

  // When the player returns from the Job Review tab, silently refresh so the
  // closed-out review and any auto-completed catch-up tasks show up here.
  const hasOpenReview = (state?.jobReviews ?? []).some((r) => r.status === "open");
  useEffect(() => {
    if (!hasOpenReview) return;
    function onFocus() {
      load(true);
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [hasOpenReview, load]);

  const actionsByRequiredId = useMemo(() => {
    const map = new Map<string, Action>();
    state?.actions.forEach((a) => {
      if (a.required_action_id) map.set(a.required_action_id, a);
    });
    return map;
  }, [state]);

  const actionsByDay = useMemo(() => {
    const map = new Map<number, Action[]>();
    state?.actions.forEach((a) => {
      if (!map.has(a.day_number)) map.set(a.day_number, []);
      map.get(a.day_number)!.push(a);
    });
    return map;
  }, [state]);

  async function advance() {
    if (!state) return;
    setAdvancing(true);
    setError(null);
    try {
      const res = await fetch(`/api/training/games/${gameId}/advance`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to advance");
      const pending: JobReview[] = data.pendingReviews ?? [];
      setState((prev) =>
        prev
          ? {
              ...prev,
              game: {
                ...prev.game,
                current_day: data.currentDay,
                score: data.score,
                max_score: data.maxScore,
                status: data.completed ? "completed" : "active",
              },
              days: [...prev.days, ...(data.days ?? [])],
              reports: [...prev.reports, ...(data.reports ?? [])],
              jobReviews: [...prev.jobReviews, ...pending],
            }
          : prev,
      );
      if (data.reports?.length) {
        setLatestReportId(data.reports[data.reports.length - 1].id);
      }
      // Surface the earliest new 4-week review as a popup.
      if (pending.length) {
        setPendingReview(pending[0]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to advance");
    } finally {
      setAdvancing(false);
    }
  }

  async function updateSetting(patch: { scoringFrequency?: ScoringFrequency; daysPerAdvance?: number }) {
    if (!state) return;
    setState((prev) =>
      prev
        ? {
            ...prev,
            game: {
              ...prev.game,
              ...(patch.scoringFrequency !== undefined ? { scoring_frequency: patch.scoringFrequency } : {}),
              ...(patch.daysPerAdvance !== undefined ? { days_per_advance: patch.daysPerAdvance } : {}),
            },
          }
        : prev,
    );
    await fetch(`/api/training/games/${gameId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
  }

  function onActionSubmitted(action: Action, score: number, maxScore: number) {
    setState((prev) =>
      prev
        ? {
            ...prev,
            actions: [...prev.actions, action],
            game: { ...prev.game, score, max_score: maxScore },
          }
        : prev,
    );
  }

  if (loading || !state) {
    return (
      <div>
        <button onClick={onBack} className="text-sm text-gray-500 hover:text-gray-900 mb-4">
          ← All projects
        </button>
        <p className="text-sm text-gray-400">Loading project…</p>
      </div>
    );
  }

  const { game, days, reports, jobReviews } = state;
  const completed = game.status === "completed";
  const remaining = game.total_days - game.current_day;
  const advanceCount = Math.min(game.days_per_advance, remaining);
  const latestReport = reports.find((r) => r.id === latestReportId);

  // Week model: 5 working days per week. The latest reached week is the only one
  // you can still work in; earlier weeks are locked (view-only). A week also
  // locks once a 4-week review covering it has been closed out.
  const currentWeek = weekOfDay(Math.max(1, game.current_day));
  const totalWeeks = Math.max(1, weekOfDay(game.total_days));
  const acknowledgedThroughWeek = jobReviews
    .filter((r) => r.status === "acknowledged")
    .reduce((mx, r) => Math.max(mx, r.to_week), 0);
  const week = Math.min(Math.max(1, selectedWeek), Math.max(1, currentWeek));
  const weekEditable =
    game.status === "active" && week === currentWeek && week > acknowledgedThroughWeek;
  const weekDays = [...days]
    .filter((d) => weekOfDay(d.day_number) === week)
    .sort((a, b) => a.day_number - b.day_number);
  const openReview = jobReviews.find((r) => r.status === "open") ?? null;

  return (
    <div>
      <button onClick={onBack} className="text-sm text-gray-500 hover:text-gray-900 mb-4">
        ← All projects
      </button>

      {/* Project header */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 sm:p-6 mb-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-semibold text-gray-900">{game.project_name}</h1>
              {completed && (
                <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5">
                  Complete
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-0.5">
              {projectTypeLabel(game.project_type)} · {game.location} · {money(game.contract_value)}
            </p>
            <p className="text-sm text-gray-600 mt-2 max-w-2xl">{game.project_overview}</p>
            <p className="text-xs text-gray-400 mt-2">
              Running this project as <span className="font-medium text-gray-600">{roleLabel(game.role)}</span>
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-3xl font-semibold text-gray-900">{pct(game.score, game.max_score)}%</p>
            <p className="text-xs text-gray-400">
              {Math.round(game.score)}/{game.max_score} pts
            </p>
          </div>
        </div>

        {/* Progress */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
            <span>
              Day {game.current_day} of {game.total_days}
            </span>
            <span>{Math.round((game.current_day / game.total_days) * 100)}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full bg-gray-900 transition-all"
              style={{ width: `${(game.current_day / game.total_days) * 100}%` }}
            />
          </div>
        </div>

        {/* Settings + advance */}
        <div className="mt-5 flex items-end justify-between gap-4 flex-wrap">
          <div className="flex items-end gap-4">
            <div>
              <label className="block text-[11px] font-medium text-gray-500 mb-1">Scoring</label>
              <select
                value={game.scoring_frequency}
                onChange={(e) => updateSetting({ scoringFrequency: e.target.value as ScoringFrequency })}
                className="rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
              >
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="project_end">End of project</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-500 mb-1">Speed</label>
              <select
                value={game.days_per_advance}
                onChange={(e) => updateSetting({ daysPerAdvance: Number(e.target.value) })}
                className="rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
              >
                {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                  <option key={n} value={n}>
                    {n} {n === 1 ? "day" : "days"}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {!completed && (
            <button
              onClick={advance}
              disabled={advancing}
              className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 transition-colors"
            >
              {advancing
                ? `Simulating ${advanceCount} ${advanceCount === 1 ? "day" : "days"}…`
                : game.current_day === 0
                  ? `Start day 1${advanceCount > 1 ? `–${advanceCount}` : ""}`
                  : `Advance ${advanceCount} ${advanceCount === 1 ? "day" : "days"}`}
            </button>
          )}
        </div>
        {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
      </div>

      {/* Open 4-week Job Review banner (persists until closed out) */}
      {openReview && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 mb-5 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-sm font-semibold text-indigo-900">
              📋 Your 4-week Job Review is ready — {weekSpanLabel(openReview)}
            </p>
            <p className="text-xs text-indigo-700 mt-0.5">
              Review how the project went, then close it out to catch up on anything missed.
            </p>
          </div>
          <a
            href={reviewUrl(gameId, openReview.id)}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
          >
            Review your project →
          </a>
        </div>
      )}

      {/* Latest score report callout */}
      {latestReport && <ScoreReportCard report={latestReport} highlight onClose={() => setLatestReportId(null)} />}

      {completed && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 mb-5">
          <p className="text-sm font-medium text-emerald-800">
            🏁 Project complete — final score {pct(game.score, game.max_score)}% (
            {Math.round(game.score)}/{game.max_score} pts).
          </p>
        </div>
      )}

      {/* Job reviews (every 4 weeks) */}
      {jobReviews.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-2">Job reviews</h2>
          <div className="space-y-2">
            {[...jobReviews]
              .sort((a, b) => a.review_number - b.review_number)
              .map((r) => (
                <a
                  key={r.id}
                  href={reviewUrl(gameId, r.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-lg border border-gray-200 bg-white p-3.5 hover:border-gray-300 hover:shadow-sm transition-all"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        {r.is_final && r.review_number > 1
                          ? "Final Project Review"
                          : `4-Week Review · ${weekSpanLabel(r)}`}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {r.status === "acknowledged" ? (
                          <>
                            Closed out · {r.completed_count} completed · {r.catch_up_count} caught up
                          </>
                        ) : (
                          <span className="text-indigo-600 font-medium">Open — review your project</span>
                        )}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      {r.generated && r.grade ? (
                        <span className={`text-lg font-semibold ${gradeColor(r.grade)}`}>{r.grade}</span>
                      ) : (
                        <span className="text-xs text-gray-400">→</span>
                      )}
                    </div>
                  </div>
                </a>
              ))}
          </div>
        </div>
      )}

      {/* Days — one week at a time */}
      {game.current_day === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 p-10 text-center">
          <p className="text-sm text-gray-500">
            Your project is set up. Hit <span className="font-medium">Start day 1</span> to begin the
            first day on site.
          </p>
        </div>
      ) : (
        <div>
          {/* Week navigator */}
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedWeek((w) => Math.max(1, w - 1))}
                disabled={week <= 1}
                className="rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors"
                aria-label="Previous week"
              >
                ←
              </button>
              <div className="text-center min-w-[120px]">
                <p className="text-sm font-semibold text-gray-900">Week {week}</p>
                <p className="text-[11px] text-gray-400">
                  of {totalWeeks} · {weekEditable ? "current" : "locked"}
                </p>
              </div>
              <button
                onClick={() => setSelectedWeek((w) => Math.min(currentWeek, w + 1))}
                disabled={week >= currentWeek}
                className="rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors"
                aria-label="Next week"
              >
                →
              </button>
            </div>
            {!weekEditable && (
              <span className="text-[11px] font-medium text-gray-500 bg-gray-100 border border-gray-200 rounded-full px-2.5 py-1">
                🔒 Viewing only — completed tasks can&apos;t be changed
              </span>
            )}
            {week < currentWeek && (
              <button
                onClick={() => setSelectedWeek(currentWeek)}
                className="text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors"
              >
                Jump to current week →
              </button>
            )}
          </div>

          <div className="space-y-5">
            {weekDays.map((day) => (
              <DayCard
                key={day.id}
                gameId={gameId}
                day={day}
                actionsByRequiredId={actionsByRequiredId}
                proactiveActions={(actionsByDay.get(day.day_number) ?? []).filter((a) => !a.required_action_id)}
                role={game.role}
                readOnly={!weekEditable}
                onSubmitted={onActionSubmitted}
              />
            ))}
          </div>
        </div>
      )}

      {/* Every-4-weeks review popup */}
      {pendingReview && (
        <ReviewPopup
          review={pendingReview}
          gameId={gameId}
          onClose={() => setPendingReview(null)}
        />
      )}
    </div>
  );
}

// ───────────────────────────── Review popup ─────────────────────────────

function ReviewPopup({
  review,
  gameId,
  onClose,
}: {
  review: JobReview;
  gameId: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl border border-gray-200 p-6">
        <div className="text-3xl mb-2">📋</div>
        <h2 className="text-lg font-semibold text-gray-900">
          {review.is_final && review.review_number > 1
            ? "Time for your final project review"
            : "Four weeks down — time for a review"}
        </h2>
        <p className="text-sm text-gray-600 mt-2">
          You&apos;ve wrapped {weekSpanLabel(review)} on the job. Open your Job Review to see how you
          did on every task, what slipped, and close it out to catch up on anything you missed.
        </p>
        <div className="mt-5 flex items-center gap-3">
          <a
            href={reviewUrl(gameId, review.id)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onClose}
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 transition-colors"
          >
            Review your project
          </a>
          <button
            onClick={onClose}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Later
          </button>
        </div>
      </div>
    </div>
  );
}

// ───────────────────────────── Score report card ─────────────────────────────

function ScoreReportCard({
  report,
  highlight,
  onClose,
}: {
  report: ScoreReport;
  highlight?: boolean;
  onClose?: () => void;
}) {
  return (
    <div
      className={`rounded-xl border p-4 mb-3 ${
        highlight ? "border-gray-900 bg-gray-50 shadow-sm" : "border-gray-200 bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-900">{report.label}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {Math.round(report.score)}/{report.max_score} pts · {pct(report.score, report.max_score)}%
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-2xl font-semibold ${gradeColor(report.grade)}`}>{report.grade}</span>
          {onClose && (
            <button onClick={onClose} className="text-gray-300 hover:text-gray-600 text-sm" title="Dismiss">
              ✕
            </button>
          )}
        </div>
      </div>
      {report.review && <p className="text-sm text-gray-600 mt-2">{report.review}</p>}
    </div>
  );
}

// ───────────────────────────── Day card ─────────────────────────────

function DayCard({
  gameId,
  day,
  actionsByRequiredId,
  proactiveActions,
  role,
  readOnly = false,
  onSubmitted,
}: {
  gameId: string;
  day: Day;
  actionsByRequiredId: Map<string, Action>;
  proactiveActions: Action[];
  role: SimRole;
  readOnly?: boolean;
  onSubmitted: (action: Action, score: number, maxScore: number) => void;
}) {
  const [addingProactive, setAddingProactive] = useState(false);

  const dateLabel = new Date(day.sim_date + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const requiredCount = day.required_actions.length;
  const completedCount = day.required_actions.filter((r) => actionsByRequiredId.has(r.id)).length;

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50/60 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-900">Day {day.day_number}</p>
          <p className="text-xs text-gray-500">{dateLabel}</p>
        </div>
        <div className="text-right">
          {day.weather && <p className="text-xs text-gray-500">{day.weather}</p>}
          {requiredCount > 0 && (
            <p
              className={`text-[11px] font-medium ${
                completedCount === requiredCount ? "text-emerald-600" : "text-gray-400"
              }`}
            >
              {completedCount}/{requiredCount} actions done
            </p>
          )}
        </div>
      </div>

      <div className="p-5">
        {/* Summary */}
        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line mb-4">{day.summary}</p>

        {/* Events */}
        {day.events.length > 0 && (
          <div className="space-y-1.5 mb-5">
            {day.events.map((ev) => (
              <div
                key={ev.id}
                className={`rounded-lg border px-3 py-2 text-sm ${SEVERITY_STYLES[ev.severity] ?? SEVERITY_STYLES.info}`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wide opacity-70">
                    {ev.severity}
                  </span>
                  <span className="font-medium">{ev.title}</span>
                </div>
                <p className="mt-0.5 opacity-90">{ev.description}</p>
              </div>
            ))}
          </div>
        )}

        {/* Required actions */}
        {requiredCount > 0 && (
          <div className="mb-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
              Required actions
            </p>
            <div className="space-y-3">
              {day.required_actions.map((req) => (
                <RequiredActionItem
                  key={req.id}
                  gameId={gameId}
                  dayNumber={day.day_number}
                  req={req}
                  existing={actionsByRequiredId.get(req.id) ?? null}
                  readOnly={readOnly}
                  onSubmitted={onSubmitted}
                />
              ))}
            </div>
          </div>
        )}

        {/* Proactive actions taken */}
        {proactiveActions.length > 0 && (
          <div className="mb-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
              Other actions you took
            </p>
            <div className="space-y-2">
              {proactiveActions.map((a) => (
                <SubmittedActionView key={a.id} action={a} />
              ))}
            </div>
          </div>
        )}

        {/* Add proactive action (current week only) */}
        {!readOnly &&
          (addingProactive ? (
            <ActionEditor
              gameId={gameId}
              dayNumber={day.day_number}
              requiredActionId={null}
              role={role}
              onCancel={() => setAddingProactive(false)}
              onSubmitted={(action, score, maxScore) => {
                onSubmitted(action, score, maxScore);
                setAddingProactive(false);
              }}
            />
          ) : (
            <button
              onClick={() => setAddingProactive(true)}
              className="text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors"
            >
              + Take another action
            </button>
          ))}
      </div>
    </div>
  );
}

function RequiredActionItem({
  gameId,
  dayNumber,
  req,
  existing,
  readOnly = false,
  onSubmitted,
}: {
  gameId: string;
  dayNumber: number;
  req: RequiredAction;
  existing: Action | null;
  readOnly?: boolean;
  onSubmitted: (action: Action, score: number, maxScore: number) => void;
}) {
  const [editing, setEditing] = useState(false);

  if (existing) {
    const auto = Boolean(existing.auto_completed);
    return (
      <div
        className={`rounded-lg border p-3 ${
          auto ? "border-amber-200 bg-amber-50/50" : "border-emerald-200 bg-emerald-50/50"
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className={auto ? "text-amber-600" : "text-emerald-600"}>{auto ? "↺" : "✓"}</span>
            <span className="text-sm font-medium text-gray-900 truncate">{req.title}</span>
            <span className="text-[10px] uppercase tracking-wide text-gray-400 bg-white border border-gray-200 rounded px-1.5 py-0.5 shrink-0">
              {actionTypeLabel(req.action_type)}
            </span>
            {auto && (
              <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-700 bg-amber-100 border border-amber-200 rounded px-1.5 py-0.5 shrink-0">
                Auto
              </span>
            )}
          </div>
          <span className={`text-sm font-semibold shrink-0 ${auto ? "text-amber-700" : "text-emerald-700"}`}>
            {existing.score}/{existing.max_score}
          </span>
        </div>
        {existing.feedback && <p className="text-xs text-gray-600 mt-2 italic">“{existing.feedback}”</p>}
      </div>
    );
  }

  // Locked (past/completed) week: an un-actioned required task reads as missed.
  if (readOnly) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50/40 p-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-red-500">✕</span>
            <span className="text-sm font-medium text-gray-900">{req.title}</span>
            <span className="text-[10px] uppercase tracking-wide text-gray-400 bg-white border border-gray-200 rounded px-1.5 py-0.5">
              {actionTypeLabel(req.action_type)}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">Not completed — missed this day.</p>
        </div>
        <span className="text-sm font-semibold text-red-600 shrink-0">0/{req.points}</span>
      </div>
    );
  }

  if (editing) {
    return (
      <ActionEditor
        gameId={gameId}
        dayNumber={dayNumber}
        requiredActionId={req.id}
        presetActionType={req.action_type}
        presetTitle={req.title}
        prompt={req.description}
        points={req.points}
        onCancel={() => setEditing(false)}
        onSubmitted={(action, score, maxScore) => {
          onSubmitted(action, score, maxScore);
          setEditing(false);
        }}
      />
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 p-3 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-gray-900">{req.title}</span>
          <span className="text-[10px] uppercase tracking-wide text-gray-400 bg-gray-50 border border-gray-200 rounded px-1.5 py-0.5">
            {actionTypeLabel(req.action_type)}
          </span>
          <span className="text-[11px] text-gray-400">{req.points} pts</span>
        </div>
        <p className="text-xs text-gray-500 mt-1">{req.description}</p>
      </div>
      <button
        onClick={() => setEditing(true)}
        className="shrink-0 rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
      >
        Complete
      </button>
    </div>
  );
}

function SubmittedActionView({ action }: { action: Action }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-medium text-gray-900 truncate">
            {action.title || actionTypeLabel(action.action_type)}
          </span>
          <span className="text-[10px] uppercase tracking-wide text-gray-400 bg-white border border-gray-200 rounded px-1.5 py-0.5 shrink-0">
            {actionTypeLabel(action.action_type)}
          </span>
        </div>
        <span className="text-sm font-semibold text-gray-700 shrink-0">
          {action.score}/{action.max_score}
        </span>
      </div>
      {action.feedback && <p className="text-xs text-gray-600 mt-2 italic">“{action.feedback}”</p>}
    </div>
  );
}

// ───────────────────────────── Action editor ─────────────────────────────

function ActionEditor({
  gameId,
  dayNumber,
  requiredActionId,
  presetActionType,
  presetTitle,
  prompt,
  points,
  role,
  onCancel,
  onSubmitted,
}: {
  gameId: string;
  dayNumber: number;
  requiredActionId: string | null;
  presetActionType?: string;
  presetTitle?: string;
  prompt?: string;
  points?: number;
  role?: SimRole;
  onCancel: () => void;
  onSubmitted: (action: Action, score: number, maxScore: number) => void;
}) {
  const typeOptions = role ? ROLE_ACTION_TYPES[role] : [];
  const [actionType, setActionType] = useState(presetActionType ?? typeOptions[0]?.value ?? "note");
  const [title, setTitle] = useState(presetTitle ?? "");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!content.trim()) {
      setError("Write your response before submitting.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/training/games/${gameId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dayNumber, requiredActionId, actionType, title, content }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit");
      onSubmitted(data.action, data.score, data.maxScore);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-lg border border-gray-300 bg-white p-3">
      {prompt && (
        <p className="text-xs text-gray-500 mb-2">
          {prompt}
          {points ? <span className="text-gray-400"> · worth {points} pts</span> : null}
        </p>
      )}
      {!requiredActionId && (
        <div className="flex gap-2 mb-2">
          <select
            value={actionType}
            onChange={(e) => setActionType(e.target.value)}
            className="rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
          >
            {typeOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      )}
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title / subject (optional)"
        className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
      />
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={6}
        placeholder={`Write your ${actionTypeLabel(actionType).toLowerCase()} here — be as thorough and professional as you would on a real job.`}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
      />
      {error && <p className="text-xs text-red-600 mt-1.5">{error}</p>}
      <div className="flex items-center gap-2 mt-2">
        <button
          onClick={submit}
          disabled={submitting}
          className="rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-50 transition-colors"
        >
          {submitting ? "Grading…" : "Submit & grade"}
        </button>
        <button
          onClick={onCancel}
          disabled={submitting}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
