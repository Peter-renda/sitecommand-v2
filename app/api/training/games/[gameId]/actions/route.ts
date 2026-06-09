/**
 * POST /api/training/games/[gameId]/actions
 *
 * Submit one action the player took in response to a simulated day (a daily log,
 * PCO, RFI, email, pay application, etc.) — either fulfilling a required action
 * or a proactive one. The submission is graded by AI for completeness and
 * correctness, awarded points, and given written feedback. The game's running
 * score is recomputed.
 *
 * Body: { dayNumber, requiredActionId?, actionType, title?, content }.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";
import { gradeAction, type SimRole, type RequiredAction } from "@/lib/simulation";

export const maxDuration = 120;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ gameId: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { gameId } = await params;
  const supabase = getSupabase();

  const { data: game } = await supabase
    .from("simulation_games")
    .select("id, user_id, role, project_type, project_name, project_overview, location, contract_value, total_days, current_day, status")
    .eq("id", gameId)
    .eq("user_id", session.id)
    .single();

  if (!game) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: {
    dayNumber?: number;
    requiredActionId?: string | null;
    actionType?: string;
    title?: string;
    content?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const dayNumber = Math.round(Number(body.dayNumber) || 0);
  const actionType = (body.actionType || "note").slice(0, 40);
  const title = (body.title || "").slice(0, 200);
  const content = (body.content || "").slice(0, 8000);
  const requiredActionId = body.requiredActionId || null;

  if (!content.trim()) {
    return NextResponse.json({ error: "Content is required" }, { status: 400 });
  }
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: "AI service not configured" }, { status: 503 });
  }

  const { data: day } = await supabase
    .from("simulation_days")
    .select("id, day_number, summary, required_actions")
    .eq("game_id", gameId)
    .eq("day_number", dayNumber)
    .single();

  if (!day) return NextResponse.json({ error: "Day not found" }, { status: 404 });

  // Prevent submitting the same required action twice.
  if (requiredActionId) {
    const { data: dup } = await supabase
      .from("simulation_actions")
      .select("id")
      .eq("game_id", gameId)
      .eq("required_action_id", requiredActionId)
      .limit(1);
    if (dup && dup.length) {
      return NextResponse.json({ error: "You already completed this action." }, { status: 409 });
    }
  }

  const required =
    requiredActionId && Array.isArray(day.required_actions)
      ? (day.required_actions as RequiredAction[]).find((r) => r.id === requiredActionId) ?? null
      : null;

  let graded;
  try {
    graded = await gradeAction(
      {
        role: game.role as SimRole,
        project_type: game.project_type,
        project_name: game.project_name,
        project_overview: game.project_overview,
        location: game.location,
        contract_value: game.contract_value,
        total_days: game.total_days,
      },
      { day_number: day.day_number as number, summary: (day.summary as string) || "" },
      required
        ? {
            action_type: required.action_type,
            title: required.title,
            description: required.description,
            points: required.points,
          }
        : null,
      { action_type: actionType, title, content },
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Grading failed" },
      { status: 500 },
    );
  }

  const { data: inserted, error } = await supabase
    .from("simulation_actions")
    .insert({
      game_id: gameId,
      day_id: day.id,
      day_number: dayNumber,
      required_action_id: requiredActionId,
      action_type: actionType,
      title,
      content,
      score: graded.score,
      max_score: graded.max_score,
      feedback: graded.feedback,
    })
    .select("id, day_id, day_number, required_action_id, action_type, title, content, score, max_score, feedback, created_at")
    .single();

  if (error || !inserted) {
    return NextResponse.json({ error: error?.message ?? "Failed to save action" }, { status: 500 });
  }

  // Recompute running score over the whole game.
  const { data: allActions } = await supabase
    .from("simulation_actions")
    .select("required_action_id, score, max_score")
    .eq("game_id", gameId);
  const { data: allDays } = await supabase
    .from("simulation_days")
    .select("required_actions")
    .eq("game_id", gameId);

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

  return NextResponse.json({ action: inserted, score: earned, maxScore: possible });
}
