/**
 * POST /api/training/games/[gameId]/advance
 *
 * Advance the simulation by up to `days_per_advance` simulated days (the
 * "speed up" setting, 1–7 days per turn). For each new day we ask the AI engine
 * to produce the day's weather, narrative summary, events (including problems),
 * and the required actions for the player's role. After simulating, we:
 *   - recompute the game's running score,
 *   - generate any score reports whose period just completed (weekly / monthly),
 *   - mark the game completed and write a final project_end report once the last
 *     day is reached.
 *
 * Returns the freshly simulated days plus any new score reports.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";
import {
  simulateDay,
  generateScoreReport,
  addDays,
  type SimRole,
  type ScoringFrequency,
  type RequiredAction,
} from "@/lib/simulation";

export const maxDuration = 300;

const PERIOD_LEN: Record<ScoringFrequency, number> = {
  weekly: 5, // working days in a week
  monthly: 20, // working days in a month
  project_end: Number.MAX_SAFE_INTEGER,
};

type GameRow = {
  id: string;
  user_id: string;
  role: SimRole;
  project_type: string;
  project_name: string;
  project_overview: string;
  location: string;
  contract_value: number;
  total_days: number;
  start_date: string;
  current_day: number;
  scoring_frequency: ScoringFrequency;
  days_per_advance: number;
  status: string;
};

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ gameId: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { gameId } = await params;
  const supabase = getSupabase();

  const { data: game } = (await supabase
    .from("simulation_games")
    .select("*")
    .eq("id", gameId)
    .eq("user_id", session.id)
    .single()) as { data: GameRow | null };

  if (!game) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (game.status !== "active") {
    return NextResponse.json({ error: "This project is already complete." }, { status: 409 });
  }
  if (game.current_day >= game.total_days) {
    return NextResponse.json({ error: "No days remaining." }, { status: 409 });
  }

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: "AI service not configured" }, { status: 503 });
  }

  // Recent days for narrative continuity.
  const { data: priorDays } = await supabase
    .from("simulation_days")
    .select("day_number, summary, events")
    .eq("game_id", gameId)
    .order("day_number", { ascending: true });

  const history = (priorDays ?? []).map((d) => ({
    day_number: d.day_number as number,
    summary: (d.summary as string) || "",
    open_events: (Array.isArray(d.events) ? d.events : [])
      .filter((e: { severity?: string }) => e.severity === "major" || e.severity === "critical")
      .map((e: { title?: string }) => e.title || "")
      .filter(Boolean),
  }));

  const gameCtx = {
    role: game.role,
    project_type: game.project_type,
    project_name: game.project_name,
    project_overview: game.project_overview,
    location: game.location,
    contract_value: game.contract_value,
    total_days: game.total_days,
  };

  const remaining = game.total_days - game.current_day;
  const toSimulate = Math.min(game.days_per_advance, remaining);
  const newDays: unknown[] = [];

  for (let i = 0; i < toSimulate; i++) {
    const dayNumber = game.current_day + 1 + i;
    // start_date is day 1; each subsequent day is the next weekday.
    const simDate = addDays(game.start_date, weekdayOffset(dayNumber - 1));

    let simDay;
    try {
      simDay = await simulateDay(gameCtx, dayNumber, simDate, history);
    } catch (err) {
      // If at least one day succeeded, persist progress and report partial success.
      if (newDays.length === 0) {
        const msg = err instanceof Error ? err.message : "Simulation failed";
        return NextResponse.json({ error: msg }, { status: 500 });
      }
      break;
    }

    const { data: inserted } = await supabase
      .from("simulation_days")
      .insert({
        game_id: gameId,
        day_number: simDay.day_number,
        sim_date: simDay.sim_date,
        weather: simDay.weather,
        summary: simDay.summary,
        events: simDay.events,
        required_actions: simDay.required_actions,
      })
      .select("id, day_number, sim_date, weather, summary, events, required_actions, generated_at")
      .single();

    if (inserted) newDays.push(inserted);

    history.push({
      day_number: simDay.day_number,
      summary: simDay.summary,
      open_events: simDay.events
        .filter((e) => e.severity === "major" || e.severity === "critical")
        .map((e) => e.title),
    });
  }

  const newCurrentDay = game.current_day + newDays.length;
  const completed = newCurrentDay >= game.total_days;

  // Recompute running score across everything simulated so far.
  const { earned, possible } = await computeScore(supabase, gameId, 1, newCurrentDay);

  await supabase
    .from("simulation_games")
    .update({
      current_day: newCurrentDay,
      score: earned,
      max_score: possible,
      status: completed ? "completed" : "active",
      updated_at: new Date().toISOString(),
    })
    .eq("id", gameId);

  // Generate any score reports whose period just completed.
  const newReports = await maybeGenerateReports(
    supabase,
    gameCtx,
    gameId,
    game.scoring_frequency,
    game.current_day,
    newCurrentDay,
    completed,
  );

  // Open a Job Review for any newly-completed 4-week block (and the final tail).
  const pendingReviews = await ensureJobReviews(
    supabase,
    gameId,
    game.total_days,
    newCurrentDay,
    completed,
  );

  return NextResponse.json({
    days: newDays,
    reports: newReports,
    pendingReviews,
    currentDay: newCurrentDay,
    completed,
    score: earned,
    maxScore: possible,
    simulated: newDays.length,
  });
}

const BLOCK_DAYS = 20; // 4 working weeks
const WEEK_DAYS = 5;

/**
 * Ensure a `simulation_job_reviews` row exists for every 4-week block that has
 * become reviewable. A block is reviewable once all of its days are simulated;
 * on project completion the final (possibly partial) block is reviewable too.
 * The row is created "open" and ungenerated — its AI content is produced lazily
 * when the player opens the Job Review page. Returns the rows newly created on
 * this advance so the client can pop the "review your project" prompt.
 */
async function ensureJobReviews(
  supabase: Supa,
  gameId: string,
  totalDays: number,
  currentDay: number,
  completed: boolean,
): Promise<unknown[]> {
  const blocks = new Set<number>();
  for (let b = 1; b <= Math.floor(currentDay / BLOCK_DAYS); b++) blocks.add(b);
  if (completed) blocks.add(Math.max(1, Math.ceil(totalDays / BLOCK_DAYS)));
  if (blocks.size === 0) return [];

  const { data: existing } = await supabase
    .from("simulation_job_reviews")
    .select("review_number")
    .eq("game_id", gameId);
  const have = new Set((existing ?? []).map((r) => r.review_number as number));

  const created: unknown[] = [];
  for (const b of [...blocks].sort((x, y) => x - y)) {
    if (have.has(b)) continue;
    const fromDay = (b - 1) * BLOCK_DAYS + 1;
    const toDay = Math.min(b * BLOCK_DAYS, totalDays);
    if (fromDay > toDay) continue;
    const fromWeek = (b - 1) * (BLOCK_DAYS / WEEK_DAYS) + 1;
    const toWeek = Math.ceil(toDay / WEEK_DAYS);
    const isFinal = toDay >= totalDays;

    const { data: row } = await supabase
      .from("simulation_job_reviews")
      .insert({
        game_id: gameId,
        review_number: b,
        from_day: fromDay,
        to_day: toDay,
        from_week: fromWeek,
        to_week: toWeek,
        is_final: isFinal,
        status: "open",
        generated: false,
      })
      .select(
        "id, review_number, from_day, to_day, from_week, to_week, is_final, status, generated, created_at",
      )
      .single();
    if (row) created.push(row);
  }
  return created;
}

/** Working-day offset → calendar offset, skipping weekends. Day index 0 = start. */
function weekdayOffset(workingDayIndex: number): number {
  const weeks = Math.floor(workingDayIndex / 5);
  const rem = workingDayIndex % 5;
  return weeks * 7 + rem;
}

type Supa = ReturnType<typeof getSupabase>;

/**
 * Score a span of days [from, to]:
 *  - each required action contributes its points to "possible"; if completed,
 *    its graded score contributes to "earned".
 *  - each proactive (non-required) action contributes its max_score to "possible"
 *    and its score to "earned".
 */
async function computeScore(
  supabase: Supa,
  gameId: string,
  fromDay: number,
  toDay: number,
): Promise<{
  earned: number;
  possible: number;
  requiredCount: number;
  completedCount: number;
  actions: { day_number: number; action_type: string; title: string; score: number; max_score: number }[];
}> {
  const { data: days } = await supabase
    .from("simulation_days")
    .select("day_number, required_actions")
    .eq("game_id", gameId)
    .gte("day_number", fromDay)
    .lte("day_number", toDay);

  const { data: actions } = await supabase
    .from("simulation_actions")
    .select("day_number, required_action_id, action_type, title, score, max_score")
    .eq("game_id", gameId)
    .gte("day_number", fromDay)
    .lte("day_number", toDay);

  const acts = actions ?? [];
  const completedReqIds = new Set(
    acts.filter((a) => a.required_action_id).map((a) => a.required_action_id as string),
  );

  let possible = 0;
  let requiredCount = 0;
  for (const d of days ?? []) {
    const reqs = (Array.isArray(d.required_actions) ? d.required_actions : []) as RequiredAction[];
    for (const r of reqs) {
      requiredCount += 1;
      possible += Number(r.points) || 0;
    }
  }

  let earned = 0;
  for (const a of acts) {
    earned += Number(a.score) || 0;
    if (!a.required_action_id) possible += Number(a.max_score) || 0; // proactive extra
  }

  return {
    earned: Math.round(earned * 10) / 10,
    possible,
    requiredCount,
    completedCount: completedReqIds.size,
    actions: acts.map((a) => ({
      day_number: a.day_number as number,
      action_type: a.action_type as string,
      title: a.title as string,
      score: Number(a.score) || 0,
      max_score: Number(a.max_score) || 0,
    })),
  };
}

/** Detect newly-completed scoring periods and write a report for each. */
async function maybeGenerateReports(
  supabase: Supa,
  gameCtx: Parameters<typeof generateScoreReport>[0],
  gameId: string,
  frequency: ScoringFrequency,
  oldDay: number,
  newDay: number,
  completed: boolean,
): Promise<unknown[]> {
  const reports: unknown[] = [];

  // What's the last day already covered by a report?
  const { data: existing } = await supabase
    .from("simulation_score_reports")
    .select("to_day")
    .eq("game_id", gameId)
    .order("to_day", { ascending: false })
    .limit(1);
  let lastTo = existing && existing.length ? (existing[0].to_day as number) : 0;

  const periodLen = PERIOD_LEN[frequency];

  // Periodic reports (weekly / monthly): close out each full period crossed.
  if (frequency !== "project_end") {
    let boundary = (Math.floor(oldDay / periodLen) + 1) * periodLen;
    while (boundary <= newDay) {
      if (boundary > lastTo) {
        const report = await writeReport(
          supabase,
          gameCtx,
          gameId,
          frequency,
          lastTo + 1,
          boundary,
        );
        if (report) {
          reports.push(report);
          lastTo = boundary;
        }
      }
      boundary += periodLen;
    }
  }

  // Final report at project completion (covers any remaining tail of days, and
  // is the only report for project_end scoring).
  if (completed && newDay > lastTo) {
    const report = await writeReport(supabase, gameCtx, gameId, "project_end", lastTo + 1, newDay);
    if (report) reports.push(report);
  }

  return reports;
}

async function writeReport(
  supabase: Supa,
  gameCtx: Parameters<typeof generateScoreReport>[0],
  gameId: string,
  kind: ScoringFrequency,
  fromDay: number,
  toDay: number,
): Promise<unknown | null> {
  const stats = await computeScore(supabase, gameId, fromDay, toDay);
  const result = await generateScoreReport(gameCtx, kind, fromDay, toDay, stats);

  const label =
    kind === "project_end"
      ? "Final Project Review"
      : kind === "monthly"
        ? `Month — Days ${fromDay}–${toDay}`
        : `Week — Days ${fromDay}–${toDay}`;

  const { data, error } = await supabase
    .from("simulation_score_reports")
    .upsert(
      {
        game_id: gameId,
        period_kind: kind,
        label,
        from_day: fromDay,
        to_day: toDay,
        score: result.score,
        max_score: result.max_score,
        grade: result.grade,
        review: result.review,
      },
      { onConflict: "game_id,to_day" },
    )
    .select("id, period_kind, label, from_day, to_day, score, max_score, grade, review, created_at")
    .single();

  if (error) return null;
  return data;
}
