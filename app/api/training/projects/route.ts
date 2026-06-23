/**
 * Training → Practice: "SiteCommand Training" sandbox projects.
 *
 * GET  /api/training/projects — list the sandbox projects the current user has
 *                               launched.
 * POST /api/training/projects — launch a new sandbox. Body: { role, projectType }.
 *                               Creates a real (but training-flagged) project and
 *                               makes the launching user its project admin so the
 *                               whole SiteCommand workspace is usable in the new
 *                               tab. No content is seeded yet — directory, emails,
 *                               plans and specs are filled in later.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";
import {
  ROLES,
  PROJECT_TYPES,
  projectTypeLabel,
  trainingProjectName,
  type SimRole,
} from "@/lib/simulation-constants";
import { seedTrainingProjectManager } from "@/lib/training-seed";

const VALID_ROLES = new Set(ROLES.map((r) => r.value));
const VALID_TYPES = new Set(PROJECT_TYPES.map((p) => p.value));

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("projects")
    .select("id, name, status, training_role, training_project_type, training_day, training_last_saved_at, created_at")
    .eq("is_training", true)
    .eq("training_owner_id", session.id)
    .is("archived_at", null)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ projects: data ?? [] });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { role?: string; projectType?: string };
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

  const supabase = getSupabase();

  // A plain, descriptive sandbox identity. Realistic content (name, value,
  // directory, emails, plans/specs) gets seeded in a later iteration; for now the
  // user lands in an empty-but-real project workspace they can run.
  const typeLabel = projectTypeLabel(projectType);
  const startDate = new Date().toISOString().split("T")[0];
  const { data: project, error } = await supabase
    .from("projects")
    .insert({
      name: trainingProjectName(projectType),
      description: `Sandbox training project for running a ${typeLabel.toLowerCase()} job end to end.`,
      sector: typeLabel,
      status: "active",
      value: 0,
      start_date: startDate,
      company_id: session.company_id ?? null,
      is_training: true,
      training_role: role,
      training_project_type: projectType,
      training_owner_id: session.id,
      training_day: 0,
      training_last_saved_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error || !project) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to create sandbox project" },
      { status: 500 },
    );
  }

  // Make the launching user a project admin so every tool in the sandbox is
  // fully usable, regardless of their company role (covers external/no-company
  // users too, whose access otherwise depends solely on this membership row).
  const { error: memberError } = await supabase.from("project_memberships").insert({
    project_id: project.id,
    user_id: session.id,
    company_id: session.company_id ?? null,
    role: "project_admin",
    invited_by: session.id,
  });

  if (memberError) {
    // Roll back the orphaned project so the user can retry cleanly.
    await supabase.from("projects").delete().eq("id", project.id);
    return NextResponse.json(
      { error: `Failed to set up sandbox access: ${memberError.message}` },
      { status: 500 },
    );
  }

  // Project Managers land in a project that already feels live: the GC's team is
  // in the Directory and a Day-1 handoff email from the preconstruction manager
  // is waiting on the Emails tab. Awaited so the content is in place before the
  // client opens the sandbox, but non-fatal — a seed hiccup shouldn't block the
  // launch.
  if (role === "project_manager") {
    try {
      await seedTrainingProjectManager(supabase, {
        projectId: project.id,
        ownerUserId: session.id,
        projectType,
        startDate,
        companyId: session.company_id ?? null,
      });
    } catch (e) {
      console.error("Failed to seed PM training content:", e);
    }
  }

  return NextResponse.json({ id: project.id });
}
