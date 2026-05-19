import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getSession } from "@/lib/auth";
import { canViewTask } from "../route";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId, taskId } = await params;
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", taskId)
    .eq("project_id", projectId)
    .single();

  if (error || !data) return NextResponse.json({ error: "Task not found" }, { status: 404 });
  if (!canViewTask(data, session)) return NextResponse.json({ error: "Task not found" }, { status: 404 });
  return NextResponse.json(data);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId, taskId } = await params;
  const body = await req.json();

  const update: Record<string, unknown> = {};
  if (body.title !== undefined) update.title = typeof body.title === "string" ? body.title : null;
  if (body.status !== undefined) update.status = body.status;
  if (body.category !== undefined) update.category = body.category;
  if (body.due_date !== undefined) update.due_date = body.due_date;
  if (body.description !== undefined) update.description = body.description;
  if (body.distribution_list !== undefined) update.distribution_list = body.distribution_list;
  if (body.assignees !== undefined) update.assignees = body.assignees;
  if (body.is_private !== undefined) update.is_private = Boolean(body.is_private);

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("tasks")
    .update(update)
    .eq("id", taskId)
    .eq("project_id", projectId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId, taskId } = await params;
  const supabase = getSupabase();

  // Remove photo from storage if exists
  const { data: task } = await supabase.from("tasks").select("photo_url").eq("id", taskId).single();
  if (task?.photo_url) {
    const path = task.photo_url.split("/task-photos/")[1]?.split("?")[0];
    if (path) await supabase.storage.from("task-photos").remove([decodeURIComponent(path)]);
  }

  const { error } = await supabase.from("tasks").delete().eq("id", taskId).eq("project_id", projectId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
