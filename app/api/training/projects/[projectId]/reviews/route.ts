/**
 * Training sandbox — saved phase Job Reviews.
 *
 * GET   /api/training/projects/[projectId]/reviews — list the persisted phase
 *       reviews for a sandbox (newest schedule day first). Used by the Training →
 *       Practice list (expand a sandbox to see its reviews) and by the review
 *       page to load a saved review as the source of truth.
 * PATCH /api/training/projects/[projectId]/reviews — mark a phase review closed
 *       out (the trainee caught up the missed tasks). Body: { phase, closedOut }.
 *
 * Both are owner-only and training-flagged-projects-only.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";
import { storePhaseReviewPdf } from "@/lib/training-review-pdf";
import type { SupabaseClient } from "@supabase/supabase-js";

// Confirms the project exists, is a training sandbox, and is owned by the caller.
// Returns the NextResponse to send on failure, or null when the caller is allowed.
async function guard(
  supabase: SupabaseClient,
  projectId: string,
  sessionId: string,
): Promise<NextResponse | null> {
  const { data: project } = await supabase
    .from("projects")
    .select("id, is_training, training_owner_id")
    .eq("id", projectId)
    .maybeSingle();

  if (!project || !project.is_training) {
    return NextResponse.json({ error: "Sandbox project not found" }, { status: 404 });
  }
  if (project.training_owner_id !== sessionId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId } = await params;
  const supabase = getSupabase();

  const denied = await guard(supabase, projectId, session.id);
  if (denied) return denied;

  const { data, error } = await supabase
    .from("training_phase_reviews")
    .select("id, phase, day, review, highlights, resolutions, completed, missed, closed_out, updated_at")
    .eq("project_id", projectId)
    .order("day", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ reviews: data ?? [] });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId } = await params;
  const supabase = getSupabase();

  const denied = await guard(supabase, projectId, session.id);
  if (denied) return denied;

  let body: { phase?: string; closedOut?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const phase = String(body.phase || "").slice(0, 120).trim();
  if (!phase) return NextResponse.json({ error: "Phase is required" }, { status: 400 });

  const closedOut = body.closedOut !== false;

  const { data: updated, error } = await supabase
    .from("training_phase_reviews")
    .update({ closed_out: closedOut, updated_at: new Date().toISOString() })
    .eq("project_id", projectId)
    .eq("phase", phase)
    .select("id, phase, review, highlights, resolutions, completed, missed, closed_out")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Re-render the stored PDF so it reflects the caught-up (auto-completed) state.
  // Best-effort — the close-out itself already succeeded above.
  if (updated?.id) {
    const { data: project } = await supabase
      .from("projects")
      .select("name")
      .eq("id", projectId)
      .maybeSingle();
    await storePhaseReviewPdf(supabase, projectId, updated.id, {
      projectName: project?.name || "Training Project",
      phase: updated.phase || phase,
      review: updated.review || "",
      highlights: Array.isArray(updated.highlights) ? updated.highlights : [],
      resolutions: Array.isArray(updated.resolutions) ? updated.resolutions : [],
      completed: Array.isArray(updated.completed) ? updated.completed : [],
      missed: Array.isArray(updated.missed) ? updated.missed : [],
      closedOut: !!updated.closed_out,
    });
  }

  return NextResponse.json({ ok: true });
}
