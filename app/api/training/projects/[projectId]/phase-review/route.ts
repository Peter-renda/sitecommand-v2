/**
 * POST /api/training/projects/[projectId]/phase-review
 *
 * Generate the milestone Job Review for a completed phase of a SiteCommand
 * Training sandbox. Task completion is tracked client-side (localStorage in the
 * Day panel), so the client sends which scheduled tasks were completed vs.
 * missed; this route adds project context and returns the AI narrative,
 * highlights, and per-missed-task catch-up resolutions. Stateless — nothing is
 * persisted (the sandbox is a personal practice environment).
 *
 * Owner-only and training-flagged-projects-only.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";
import { generatePhaseReview, type PhaseTask } from "@/lib/training-review";
import type { SimRole } from "@/lib/simulation-constants";

export const maxDuration = 120;

const VALID_ROLES = new Set(["superintendent", "project_manager", "accounting"]);

function cleanTasks(input: unknown): PhaseTask[] {
  if (!Array.isArray(input)) return [];
  return input.slice(0, 60).map((t) => {
    const o = (t ?? {}) as Record<string, unknown>;
    return {
      task: String(o.task || "").slice(0, 500),
      category: String(o.category || "").slice(0, 60),
      collaborators: String(o.collaborators || "").slice(0, 200),
      deliverable: String(o.deliverable || "").slice(0, 300),
    };
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId } = await params;
  const supabase = getSupabase();

  const { data: project } = await supabase
    .from("projects")
    .select("id, is_training, training_owner_id, training_role, training_project_type, name")
    .eq("id", projectId)
    .maybeSingle();

  if (!project || !project.is_training) {
    return NextResponse.json({ error: "Sandbox project not found" }, { status: 404 });
  }
  if (project.training_owner_id !== session.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { phase?: string; day?: unknown; completed?: unknown; missed?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const phase = String(body.phase || "").slice(0, 120).trim();
  if (!phase) return NextResponse.json({ error: "Phase is required" }, { status: 400 });

  const day = Number.isInteger(Number(body.day)) ? Number(body.day) : 0;

  const completed = cleanTasks(body.completed);
  const missed = cleanTasks(body.missed);
  if (completed.length + missed.length === 0) {
    return NextResponse.json({ error: "No tasks to review" }, { status: 400 });
  }

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: "AI service not configured" }, { status: 503 });
  }

  const role = (VALID_ROLES.has(project.training_role) ? project.training_role : "project_manager") as SimRole;

  let result;
  try {
    result = await generatePhaseReview(
      {
        role,
        projectType: project.training_project_type || "",
        projectName: project.name || "Training Project",
        phase,
      },
      completed,
      missed,
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate review" },
      { status: 500 },
    );
  }

  // Persist the review so it can be listed under the sandbox (Training →
  // Practice) and reopened later, in any browser. Upsert by (project, phase);
  // closed_out is intentionally omitted so re-generating never clears a phase the
  // trainee already closed out. Best-effort and isolated — the trainee still gets
  // the review on the response even if the save hiccups.
  try {
    await supabase.from("training_phase_reviews").upsert(
      {
        project_id: projectId,
        phase,
        day,
        review: result.review,
        highlights: result.highlights,
        resolutions: result.resolutions,
        completed,
        missed,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "project_id,phase" },
    );
  } catch (e) {
    console.error("Failed to persist training phase review:", e);
  }

  return NextResponse.json(result);
}
