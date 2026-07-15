/**
 * GET  /api/projects/[id]/looking-ahead
 *   List active (pending, not-currently-snoozed) AI "Looking Ahead" briefing
 *   notes — things to know/remember for where the project stands today.
 *
 * POST /api/projects/[id]/looking-ahead
 *   Manually trigger a fresh generation pass (same logic the daily cron runs),
 *   then return the updated active list. Lets a user pull notes on demand instead
 *   of waiting for the next morning.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { canAccessProject } from "@/lib/project-access";
import { getSupabase } from "@/lib/supabase";
import { generateLookingAheadNotes } from "@/lib/looking-ahead";

export const maxDuration = 120;

const PRIORITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };

async function listActive(projectId: string) {
  const supabase = getSupabase();
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("project_looking_ahead_notes")
    .select("id, headline, detail, source, category, priority, status, pinned, snoozed_until, generated_at")
    .eq("project_id", projectId)
    .eq("status", "pending")
    .or(`snoozed_until.is.null,snoozed_until.lte.${nowIso}`)
    .order("generated_at", { ascending: false });

  if (error) throw new Error(error.message);
  // Pinned first, then high → medium → low, then newest first within a priority.
  return (data ?? []).sort((a, b) => {
    if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
    return (PRIORITY_RANK[a.priority] ?? 1) - (PRIORITY_RANK[b.priority] ?? 1);
  });
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
  const result = await generateLookingAheadNotes(supabase, projectId);
  if (!result.ok && result.reason === "GEMINI_API_KEY missing") {
    return NextResponse.json({ error: "AI service not configured" }, { status: 503 });
  }

  try {
    return NextResponse.json({ ...result, notes: await listActive(projectId) });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
