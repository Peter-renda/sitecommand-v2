/**
 * Training → Practice: manage a "SiteCommand Training" sandbox project.
 *
 * GET    /api/training/projects/[projectId] — read the sandbox's authoritative
 *        in-sim day (training_day). The Day panel reconciles against this on
 *        mount so a stale server-render can never strand the trainee on Day 1.
 * PATCH  /api/training/projects/[projectId] — advance the in-sim day
 *        (training_day) as the trainee completes each day in the Day panel, or
 *        recover an archived sandbox ({ action: "recover" }).
 * DELETE /api/training/projects/[projectId] — "delete" a sandbox the current
 *        user launched. By default this ARCHIVES it (a soft delete: sets
 *        archived_at) so it can be recovered later; pass ?permanent=true to hard
 *        delete it for good (cascades to all of its project data).
 *
 * All operations are owner-only and training-flagged-projects-only (never a real
 * project).
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";

// Always read live — progress must never be served from a cache.
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId } = await params;
  const supabase = getSupabase();

  const { data: project } = await supabase
    .from("projects")
    .select("id, is_training, training_owner_id, training_day, training_last_saved_at")
    .eq("id", projectId)
    .maybeSingle();

  if (!project || !project.is_training) {
    return NextResponse.json({ error: "Sandbox project not found" }, { status: 404 });
  }
  if (project.training_owner_id !== session.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({
    training_day: project.training_day ?? 0,
    training_last_saved_at: project.training_last_saved_at ?? null,
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { training_day?: unknown; action?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
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

  // Recover an archived sandbox: clear archived_at so it returns to the active
  // "Your training projects" list. Bump the save checkpoint for a fresh indicator.
  // .select() the row back and confirm archived_at really cleared, so a write that
  // silently affected zero rows surfaces as an error instead of a false success.
  if (body.action === "recover") {
    const { data: row, error } = await supabase
      .from("projects")
      .update({ archived_at: null, training_last_saved_at: new Date().toISOString() })
      .eq("id", projectId)
      .select("id, archived_at")
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!row || row.archived_at !== null) {
      return NextResponse.json({ error: "Failed to recover sandbox" }, { status: 500 });
    }
    return NextResponse.json({ ok: true, recovered: true });
  }

  const trainingDay = Number(body.training_day);
  if (!Number.isInteger(trainingDay) || trainingDay < 0 || trainingDay > 1000) {
    return NextResponse.json({ error: "Invalid training_day" }, { status: 400 });
  }

  // Bump the save checkpoint too so the "All changes saved" indicator reflects
  // the day change. .select() back the persisted value so a write that silently
  // affected zero rows surfaces as an error instead of a false success (the same
  // hardening the DELETE handler uses) — this is what guarantees progress is
  // actually saved, not just optimistically advanced in the UI.
  const { data: saved, error } = await supabase
    .from("projects")
    .update({ training_day: trainingDay, training_last_saved_at: new Date().toISOString() })
    .eq("id", projectId)
    .select("training_day")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!saved) {
    return NextResponse.json({ error: "Failed to save day progress" }, { status: 500 });
  }

  return NextResponse.json({ training_day: saved.training_day });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId } = await params;
  const permanent = new URL(req.url).searchParams.get("permanent") === "true";
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

  // Default delete is a SOFT delete: archive the sandbox so it moves to the
  // "Archived projects" list and can be recovered. This is a plain UPDATE, so —
  // unlike a hard DELETE — it can never be blocked by a non-cascading foreign key
  // and the sandbox reliably stays gone from the active list until recovered.
  // .select() the row back and confirm archived_at is actually set, so a write
  // that silently affected zero rows surfaces as an error instead of a false
  // success (which would let the sandbox "reappear" on the next list load).
  if (!permanent) {
    const { data: row, error } = await supabase
      .from("projects")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", projectId)
      .select("id, archived_at")
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!row || !row.archived_at) {
      return NextResponse.json({ error: "Failed to archive sandbox" }, { status: 500 });
    }
    return NextResponse.json({ ok: true, archived: true });
  }

  // Permanent delete (from the Archived projects view). Clear the one FK to
  // projects(id) that historically wasn't declared ON DELETE CASCADE
  // (invitations.project_id — migration 170 fixes it, but a database that hasn't
  // run 170 yet would block the hard delete below). Doing it explicitly here makes
  // delete work regardless of whether migration 170 has been applied. Best-effort:
  // ignore the result.
  await supabase.from("invitations").delete().eq("project_id", projectId);

  // .select() so we can confirm a row was actually removed. Without it a delete
  // that affected zero rows (e.g. blocked by a policy, or already gone) still
  // returns error=null and we'd report a false success.
  const { data: deleted, error } = await supabase
    .from("projects")
    .delete()
    .eq("id", projectId)
    .select("id");

  if (!error && deleted && deleted.length > 0) {
    return NextResponse.json({ ok: true });
  }

  // The hard delete couldn't remove the row — most likely a child row in a table
  // that references projects without ON DELETE CASCADE. Rather than leave the
  // sandbox in limbo, keep it archived (the list query filters archived_at IS
  // NULL, so it stays out of the active list).
  const { error: archiveError } = await supabase
    .from("projects")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", projectId)
    .is("archived_at", null);

  if (!archiveError) {
    return NextResponse.json({ ok: true, archived: true });
  }

  return NextResponse.json(
    { error: error?.message || archiveError.message || "The sandbox could not be deleted." },
    { status: 500 },
  );
}
