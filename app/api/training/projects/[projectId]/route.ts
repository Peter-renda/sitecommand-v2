/**
 * Training → Practice: manage a "SiteCommand Training" sandbox project.
 *
 * PATCH  /api/training/projects/[projectId] — advance the in-sim day
 *        (training_day) as the trainee completes each day in the Day panel.
 * DELETE /api/training/projects/[projectId] — permanently removes a sandbox the
 *        current user launched (cascades to all of its project data).
 *
 * Both are owner-only and training-flagged-projects-only (never a real project).
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { training_day?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const trainingDay = Number(body.training_day);
  if (!Number.isInteger(trainingDay) || trainingDay < 0 || trainingDay > 1000) {
    return NextResponse.json({ error: "Invalid training_day" }, { status: 400 });
  }

  const { projectId } = await params;
  const supabase = getSupabase();

  const { data: project } = await supabase
    .from("projects")
    .select("id, is_training, training_owner_id")
    .eq("id", projectId)
    .maybeSingle();

  if (!project || !project.is_training) {
    return NextResponse.json({ error: "Sandbox project not found" }, { status: 404 });
  }
  if (project.training_owner_id !== session.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Bump the save checkpoint too so the "All changes saved" indicator reflects
  // the day change.
  const { error } = await supabase
    .from("projects")
    .update({ training_day: trainingDay, training_last_saved_at: new Date().toISOString() })
    .eq("id", projectId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ training_day: trainingDay });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId } = await params;
  const supabase = getSupabase();

  const { data: project } = await supabase
    .from("projects")
    .select("id, is_training, training_owner_id")
    .eq("id", projectId)
    .maybeSingle();

  if (!project || !project.is_training) {
    return NextResponse.json({ error: "Sandbox project not found" }, { status: 404 });
  }
  if (project.training_owner_id !== session.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // .select() so we can confirm a row was actually removed. Without it a delete
  // that affected zero rows (e.g. blocked by a policy, or already gone) still
  // returns error=null and we'd report a false success — the client would then
  // never drop the row and the button would look broken.
  const { data: deleted, error } = await supabase
    .from("projects")
    .delete()
    .eq("id", projectId)
    .select("id");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!deleted || deleted.length === 0) {
    return NextResponse.json(
      { error: "The sandbox could not be deleted. Please try again." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
