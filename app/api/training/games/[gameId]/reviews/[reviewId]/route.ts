/**
 * GET /api/training/games/[gameId]/reviews/[reviewId]
 *
 * Returns a single Job Review (the every-four-weeks milestone) plus the
 * required-task breakdown for its day span: tasks completed (with their graded
 * score + feedback), tasks missed, and any proactive actions taken. The AI
 * narrative is produced lazily via the sibling /generate route, so this read is
 * cheap and never calls the model.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";
import { loadOwnedGameAndReview, loadReviewTasks } from "@/lib/simulation-review";
import { roleLabel, projectTypeLabel } from "@/lib/simulation-constants";

export async function GET(
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
  const tasks = await loadReviewTasks(supabase, gameId, review.from_day, review.to_day);

  return NextResponse.json({
    review,
    tasks,
    game: {
      id: game.id,
      role: game.role,
      role_label: roleLabel(game.role),
      project_type: game.project_type,
      project_type_label: projectTypeLabel(game.project_type),
      project_name: game.project_name,
      location: game.location,
      total_days: game.total_days,
      status: game.status,
    },
  });
}
