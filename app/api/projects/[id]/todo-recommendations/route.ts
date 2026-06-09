/**
 * GET  /api/projects/[id]/todo-recommendations
 *   List actionable (pending, not-currently-snoozed) AI to-do recommendations.
 *
 * POST /api/projects/[id]/todo-recommendations
 *   Manually trigger a fresh generation pass (same logic the daily 4am cron
 *   runs), then return the updated active list. Lets a user pull recommendations
 *   on demand instead of waiting for the next morning.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { canAccessProject } from "@/lib/project-access";
import { getSupabase } from "@/lib/supabase";
import { generateTodoRecommendations } from "@/lib/todo-recommendations";

export const maxDuration = 120;

const PRIORITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };

async function listActive(projectId: string) {
  const supabase = getSupabase();
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("project_todo_recommendations")
    .select("id, title, rationale, source, category, priority, suggested_due_date, status, snoozed_until, generated_at")
    .eq("project_id", projectId)
    .eq("status", "pending")
    .or(`snoozed_until.is.null,snoozed_until.lte.${nowIso}`)
    .order("generated_at", { ascending: false });

  if (error) throw new Error(error.message);
  // High → medium → low, then newest first within a priority.
  return (data ?? []).sort(
    (a, b) => (PRIORITY_RANK[a.priority] ?? 1) - (PRIORITY_RANK[b.priority] ?? 1),
  );
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;
  if (!(await canAccessProject(projectId, session))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    return NextResponse.json(await listActive(projectId));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;
  if (!(await canAccessProject(projectId, session))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = getSupabase();
  const result = await generateTodoRecommendations(supabase, projectId);
  if (!result.ok && result.reason === "GEMINI_API_KEY missing") {
    return NextResponse.json({ error: "AI service not configured" }, { status: 503 });
  }

  try {
    return NextResponse.json({ ...result, recommendations: await listActive(projectId) });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
