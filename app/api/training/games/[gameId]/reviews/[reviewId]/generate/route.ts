/**
 * POST /api/training/games/[gameId]/reviews/[reviewId]/generate
 *
 * Lazily produces the AI content for an open Job Review: the narrative review,
 * structured highlights (incl. explicit missed-submittal / missed-RFI callouts),
 * and a per-missed-task catch-up "resolution" used later when the player closes
 * out the review. Re-runnable while the review is still open (reflects the
 * player's latest completions); once acknowledged the content is frozen.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";
import { generateJobReview } from "@/lib/simulation";
import { loadOwnedGameAndReview, loadReviewTasks, toGameContext } from "@/lib/simulation-review";

export const maxDuration = 120;

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

  const { game, review } = owned;
  if (review.status !== "open") {
    // Already acknowledged → content is frozen; just hand it back.
    const tasks = await loadReviewTasks(supabase, gameId, review.from_day, review.to_day);
    return NextResponse.json({ review, tasks });
  }
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: "AI service not configured" }, { status: 503 });
  }

  const tasks = await loadReviewTasks(supabase, gameId, review.from_day, review.to_day);

  let result;
  try {
    result = await generateJobReview(
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
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate review" },
      { status: 500 },
    );
  }

  const { data: updated, error } = await supabase
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

  if (error || !updated) {
    return NextResponse.json({ error: error?.message ?? "Failed to save review" }, { status: 500 });
  }

  return NextResponse.json({ review: updated, tasks });
}
