/**
 * A single Training → Practice simulation game.
 *
 * GET    /api/training/games/[gameId]  — full game state: the game, all simulated
 *                                         days, submitted actions, and score reports.
 * PATCH  /api/training/games/[gameId]  — update settings { scoringFrequency?,
 *                                         daysPerAdvance? } or { status: "abandoned" }.
 * DELETE /api/training/games/[gameId]  — abandon (soft-delete) the game.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";

const VALID_FREQ = new Set(["weekly", "monthly", "project_end"]);

async function loadOwnedGame(gameId: string, userId: string) {
  const supabase = getSupabase();
  const { data } = await supabase
    .from("simulation_games")
    .select("*")
    .eq("id", gameId)
    .eq("user_id", userId)
    .single();
  return data;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ gameId: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { gameId } = await params;
  const game = await loadOwnedGame(gameId, session.id);
  if (!game) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const supabase = getSupabase();
  const [{ data: days }, { data: actions }, { data: reports }] = await Promise.all([
    supabase
      .from("simulation_days")
      .select("id, day_number, sim_date, weather, summary, events, required_actions, generated_at")
      .eq("game_id", gameId)
      .order("day_number", { ascending: true }),
    supabase
      .from("simulation_actions")
      .select("id, day_id, day_number, required_action_id, action_type, title, content, score, max_score, feedback, created_at")
      .eq("game_id", gameId)
      .order("created_at", { ascending: true }),
    supabase
      .from("simulation_score_reports")
      .select("id, period_kind, label, from_day, to_day, score, max_score, grade, review, created_at")
      .eq("game_id", gameId)
      .order("to_day", { ascending: true }),
  ]);

  return NextResponse.json({
    game,
    days: days ?? [],
    actions: actions ?? [],
    reports: reports ?? [],
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ gameId: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { gameId } = await params;
  const game = await loadOwnedGame(gameId, session.id);
  if (!game) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: { scoringFrequency?: string; daysPerAdvance?: number; status?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.scoringFrequency !== undefined) {
    if (!VALID_FREQ.has(body.scoringFrequency)) {
      return NextResponse.json({ error: "Invalid scoring frequency" }, { status: 400 });
    }
    update.scoring_frequency = body.scoringFrequency;
  }
  if (body.daysPerAdvance !== undefined) {
    update.days_per_advance = Math.max(1, Math.min(7, Math.round(Number(body.daysPerAdvance) || 1)));
  }
  if (body.status !== undefined) {
    if (!["active", "abandoned"].includes(body.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    update.status = body.status;
  }

  const supabase = getSupabase();
  const { error } = await supabase.from("simulation_games").update(update).eq("id", gameId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ gameId: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { gameId } = await params;
  const game = await loadOwnedGame(gameId, session.id);
  if (!game) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const supabase = getSupabase();
  const { error } = await supabase
    .from("simulation_games")
    .update({ status: "abandoned", updated_at: new Date().toISOString() })
    .eq("id", gameId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
