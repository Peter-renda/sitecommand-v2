/**
 * PATCH /api/projects/[id]/todo-recommendations/[recId]
 *
 * Act on a single AI to-do recommendation. Body: { action }.
 *   - "accept"            : create a real task from the recommendation and mark
 *                           it accepted (returns the new task).
 *   - "ignore"            : dismiss permanently.
 *   - "snooze" + "snooze" : resurface later. snooze ∈ "1d" | "1w" | "2w".
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { canAccessProject } from "@/lib/project-access";
import { getSupabase } from "@/lib/supabase";

const SNOOZE_DAYS: Record<string, number> = { "1d": 1, "1w": 7, "2w": 14 };

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; recId: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId, recId } = await params;
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

  const { data: rec, error: recErr } = await supabase
    .from("project_todo_recommendations")
    .select("*")
    .eq("id", recId)
    .eq("project_id", projectId)
    .single();

  if (recErr || !rec) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (rec.status !== "pending") {
    return NextResponse.json({ error: "Recommendation already acted on" }, { status: 409 });
  }

  const nowIso = new Date().toISOString();

  if (body.action === "snooze") {
    const days = SNOOZE_DAYS[body.snooze ?? ""];
    if (!days) return NextResponse.json({ error: "Invalid snooze duration" }, { status: 400 });
    const until = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await supabase
      .from("project_todo_recommendations")
      .update({ snoozed_until: until, updated_at: nowIso })
      .eq("id", recId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, snoozedUntil: until });
  }

  if (body.action === "ignore") {
    const { error } = await supabase
      .from("project_todo_recommendations")
      .update({ status: "ignored", acted_by: session.id, acted_at: nowIso, updated_at: nowIso })
      .eq("id", recId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "accept") {
    // Next task number for this project.
    const { data: maxRow } = await supabase
      .from("tasks")
      .select("task_number")
      .eq("project_id", projectId)
      .order("task_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    const taskNumber = (maxRow?.task_number ?? 0) + 1;

    const { data: task, error: taskErr } = await supabase
      .from("tasks")
      .insert({
        project_id: projectId,
        task_number: taskNumber,
        title: rec.title,
        status: "initiated",
        category: rec.category || null,
        description: rec.rationale || null,
        distribution_list: [],
        assignees: [],
        due_date: rec.suggested_due_date || null,
        is_private: false,
        created_by: session.id,
      })
      .select()
      .single();

    if (taskErr) return NextResponse.json({ error: taskErr.message }, { status: 500 });

    const { error: updErr } = await supabase
      .from("project_todo_recommendations")
      .update({
        status: "accepted",
        accepted_task_id: task!.id,
        acted_by: session.id,
        acted_at: nowIso,
        updated_at: nowIso,
      })
      .eq("id", recId);
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

    return NextResponse.json({ ok: true, task });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
