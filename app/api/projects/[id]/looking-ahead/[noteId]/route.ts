/**
 * PATCH /api/projects/[id]/looking-ahead/[noteId]
 *
 * Act on a single AI "Looking Ahead" briefing note. Body: { action }.
 *   - "pin"               : keep the note pinned at the top.
 *   - "unpin"             : remove the pin.
 *   - "dismiss"           : hide the note permanently.
 *   - "snooze" + "snooze" : resurface later. snooze ∈ "1d" | "1w" | "2w".
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { canAccessProject } from "@/lib/project-access";
import { getSupabase } from "@/lib/supabase";

const SNOOZE_DAYS: Record<string, number> = { "1d": 1, "1w": 7, "2w": 14 };

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId, noteId } = await params;
  if (!(await canAccessProject(projectId, session))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { action?: string; snooze?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const supabase = getSupabase();

  const { data: note, error: noteErr } = await supabase
    .from("project_looking_ahead_notes")
    .select("*")
    .eq("id", noteId)
    .eq("project_id", projectId)
    .single();

  if (noteErr || !note) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (note.status !== "pending") {
    return NextResponse.json({ error: "Note already dismissed" }, { status: 409 });
  }

  const nowIso = new Date().toISOString();

  if (body.action === "pin" || body.action === "unpin") {
    const { error } = await supabase
      .from("project_looking_ahead_notes")
      .update({ pinned: body.action === "pin", updated_at: nowIso })
      .eq("id", noteId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, pinned: body.action === "pin" });
  }

  if (body.action === "snooze") {
    const days = SNOOZE_DAYS[body.snooze ?? ""];
    if (!days) return NextResponse.json({ error: "Invalid snooze duration" }, { status: 400 });
    const until = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await supabase
      .from("project_looking_ahead_notes")
      .update({ snoozed_until: until, updated_at: nowIso })
      .eq("id", noteId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, snoozedUntil: until });
  }

  if (body.action === "dismiss") {
    const { error } = await supabase
      .from("project_looking_ahead_notes")
      .update({ status: "dismissed", acted_by: session.id, acted_at: nowIso, updated_at: nowIso })
      .eq("id", noteId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
