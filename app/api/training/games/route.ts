/**
 * Training → Practice simulation games.
 *
 * GET  /api/training/games        — list the current user's games.
 * POST /api/training/games         — start a new game. Body: { role, projectType,
 *                                     scoringFrequency?, daysPerAdvance? }.
 *                                     Generates the simulated project setup via AI.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";
import {
  generateProjectSetup,
  ROLES,
  PROJECT_TYPES,
  type SimRole,
  type ScoringFrequency,
} from "@/lib/simulation";

export const maxDuration = 120;

const VALID_ROLES = new Set(ROLES.map((r) => r.value));
const VALID_TYPES = new Set(PROJECT_TYPES.map((p) => p.value));
const VALID_FREQ = new Set(["weekly", "monthly", "project_end"]);

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("simulation_games")
    .select(
      "id, role, project_type, project_name, location, contract_value, total_days, current_day, scoring_frequency, days_per_advance, status, score, max_score, created_at, updated_at",
    )
    .eq("user_id", session.id)
    .neq("status", "abandoned")
    .order("updated_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ games: data ?? [] });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    role?: string;
    projectType?: string;
    scoringFrequency?: string;
    daysPerAdvance?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const role = body.role as SimRole;
  const projectType = body.projectType ?? "";
  if (!VALID_ROLES.has(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }
  if (!VALID_TYPES.has(projectType)) {
    return NextResponse.json({ error: "Invalid project type" }, { status: 400 });
  }

  const scoringFrequency = (
    VALID_FREQ.has(body.scoringFrequency ?? "") ? body.scoringFrequency : "weekly"
  ) as ScoringFrequency;
  const daysPerAdvance = Math.max(1, Math.min(7, Math.round(Number(body.daysPerAdvance) || 1)));

  let setup;
  try {
    setup = await generateProjectSetup(role, projectType);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to generate project";
    const status = msg.includes("GEMINI_API_KEY") ? 503 : 500;
    return NextResponse.json(
      { error: status === 503 ? "AI service not configured" : msg },
      { status },
    );
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("simulation_games")
    .insert({
      user_id: session.id,
      role,
      project_type: projectType,
      project_name: setup.project_name,
      project_overview: setup.project_overview,
      location: setup.location,
      contract_value: setup.contract_value,
      total_days: setup.total_days,
      start_date: new Date().toISOString().split("T")[0],
      current_day: 0,
      scoring_frequency: scoringFrequency,
      days_per_advance: daysPerAdvance,
      status: "active",
    })
    .select("id")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Failed to create game" }, { status: 500 });
  }

  return NextResponse.json({ id: data.id });
}
