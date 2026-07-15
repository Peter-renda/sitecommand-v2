/**
 * POST /api/training/games/[gameId]/reviews/[reviewId]/acknowledge
 *
 * Close out a Job Review. Every required task in the review's span that the
 * player did NOT complete is auto-completed — a believable catch-up action is
 * filed (submittal approved, scheduling email sent/received, RFI issued and
 * answered, etc.) so the simulated project stays consistent and the player is
 * brought back to where the job should be. Auto-completed tasks are scored 0
 * (the player still missed them) and flagged `auto_completed`.
 *
 * Idempotent: a second call returns the existing close-out without re-filing.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";
import { generateJobReview, type RequiredAction } from "@/lib/simulation";
import { loadOwnedGameAndReview, loadReviewTasks, toGameContext } from "@/lib/simulation-review";

export const maxDuration = 120;

const CATCH_UP_FEEDBACK =
  "Auto-completed during the 4-week Job Review to bring the project back on track. On a real job this would have needed your attention in the moment.";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ gameId: string; reviewId: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { gameId, reviewId } = await params;
  const supabase = getSupabase();

  const owned = await loadOwnedGameAndReview(supabase, gameId, reviewId, session.id);
  if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let { review } = owned;
  const { game } = owned;

  // Already closed out → return the catch-up that was filed, don't re-file.
  if (review.status === "acknowledged") {
    const { data: autoActs } = await supabase
      .from("simulation_actions")
      .select("action_type, title, content")
      .eq("game_id", gameId)
      .eq("auto_completed", true)
      .gte("day_number", review.from_day)
      .lte("day_number", review.to_day);
    return NextResponse.json({
      review,
      caughtUp: (autoActs ?? []).map((a) => ({
        action_type: a.action_type as string,
        title: a.title as string,
        resolution: a.content as string,
      })),
    });
  }

  const tasks = await loadReviewTasks(supabase, gameId, review.from_day, review.to_day);

  // Make sure the AI content (incl. per-missed-task resolutions) exists before
  // we file catch-up actions.
  if (!review.generated && process.env.GEMINI_API_KEY) {
    try {
      const result = await generateJobReview(
        toGameContext(game),
        {
          reviewNumber: review.review_number,
          fromDay: review.from_day,
          toDay: review.to_day,
          fromWeek: review.from_week,
          toWeek: review.to_week,
          isFinal: review.is_final,
        },
        {
          earned: tasks.earned,
          possible: tasks.possible,
          completed: tasks.completed.map((c) => ({
            day_number: c.day_number,
            week: c.week,
            action_type: c.action_type,
            title: c.title,
            score: c.score,
            max_score: c.max_score,
          })),
          missed: tasks.missed.map((m) => ({
            required_action_id: m.required_action_id,
            day_number: m.day_number,
            week: m.week,
            action_type: m.action_type,
            title: m.title,
            description: m.description,
            points: m.points,
          })),
        },
      );
      const { data: gen } = await supabase
        .from("simulation_job_reviews")
        .update({
          generated: true,
          generated_at: new Date().toISOString(),
          score: tasks.earned,
          max_score: tasks.possible,
          grade: result.grade,
          review: result.review,
          highlights: result.highlights,
          resolutions: result.resolutions,
          completed_count: tasks.completed.length,
          missed_count: tasks.missed.length,
        })
        .eq("id", reviewId)
        .eq("status", "open")
        .select("*")
        .single();
      if (gen) review = gen;
    } catch {
      // Fall through with whatever resolutions we have; templated text covers gaps.
    }
  }

  // Atomically claim the close-out so a racing request can't double-file.
  const { data: claimed } = await supabase
    .from("simulation_job_reviews")
    .update({ status: "acknowledged", acknowledged_at: new Date().toISOString() })
    .eq("id", reviewId)
    .eq("status", "open")
    .select("*")
    .single();

  if (!claimed) {
    // Lost the race — someone else closed it out first.
    const { data: latest } = await supabase
      .from("simulation_job_reviews")
      .select("*")
      .eq("id", reviewId)
      .single();
    return NextResponse.json({ review: latest ?? review, caughtUp: [] });
  }
  review = claimed;

  // day_number → day_id, so catch-up actions stay linked to their day.
  const { data: dayRows } = await supabase
    .from("simulation_days")
    .select("id, day_number")
    .eq("game_id", gameId)
    .gte("day_number", review.from_day)
    .lte("day_number", review.to_day);
  const dayIdByNumber = new Map<number, string>();
  for (const d of dayRows ?? []) dayIdByNumber.set(d.day_number as number, d.id as string);

  const resolutionById = new Map<string, string>();
  for (const r of Array.isArray(review.resolutions) ? review.resolutions : []) {
    if (r.required_action_id) resolutionById.set(r.required_action_id, r.resolution);
  }

  const caughtUp: { action_type: string; title: string; resolution: string }[] = [];
  const rowsToInsert = tasks.missed.map((m) => {
    const resolution =
      resolutionById.get(m.required_action_id) ||
      `${m.title} was handled by the back office and closed out so the project stays on schedule.`;
    caughtUp.push({ action_type: m.action_type, title: m.title, resolution });
    return {
      game_id: gameId,
      day_id: dayIdByNumber.get(m.day_number) ?? null,
      day_number: m.day_number,
      required_action_id: m.required_action_id,
      action_type: m.action_type,
      title: m.title,
      content: resolution,
      score: 0,
      max_score: m.points,
      feedback: CATCH_UP_FEEDBACK,
      auto_completed: true,
    };
  });

  if (rowsToInsert.length) {
    await supabase.from("simulation_actions").insert(rowsToInsert);
  }

  // Record how many we caught up, then recompute the game's running score.
  const { data: finalReview } = await supabase
    .from("simulation_job_reviews")
    .update({ catch_up_count: rowsToInsert.length })
    .eq("id", reviewId)
    .select("*")
    .single();

  await recomputeGameScore(supabase, gameId);

  return NextResponse.json({ review: finalReview ?? review, caughtUp });
}

type Supa = ReturnType<typeof getSupabase>;

/** Recompute and persist the game's running earned/possible points. */
async function recomputeGameScore(supabase: Supa, gameId: string): Promise<void> {
  const [{ data: allActions }, { data: allDays }] = await Promise.all([
    supabase
      .from("simulation_actions")
      .select("required_action_id, score, max_score")
      .eq("game_id", gameId),
    supabase.from("simulation_days").select("required_actions").eq("game_id", gameId),
  ]);

  let earned = 0;
  let possible = 0;
  for (const a of allActions ?? []) {
    earned += Number(a.score) || 0;
    if (!a.required_action_id) possible += Number(a.max_score) || 0;
  }
  for (const d of allDays ?? []) {
    const reqs = (Array.isArray(d.required_actions) ? d.required_actions : []) as RequiredAction[];
    for (const r of reqs) possible += Number(r.points) || 0;
  }
  earned = Math.round(earned * 10) / 10;

  await supabase
    .from("simulation_games")
    .update({ score: earned, max_score: possible, updated_at: new Date().toISOString() })
    .eq("id", gameId);
}
