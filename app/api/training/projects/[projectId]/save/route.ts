/**
 * Training sandbox auto-save / "Save progress" checkpoint.
 *
 * POST /api/training/projects/[projectId]/save — records a "last saved at"
 * checkpoint on a sandbox the current user owns. The sandbox's tool data already
 * persists per-action; this is the Google-Docs-style heartbeat that powers the
 * "All changes saved" indicator and the manual Save progress button. Owner-only
 * and training-projects-only. Also accepts navigator.sendBeacon on tab close
 * (no JSON body required).
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";

export async function POST(
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

  const savedAt = new Date().toISOString();
  const { error } = await supabase
    .from("projects")
    .update({ training_last_saved_at: savedAt })
    .eq("id", projectId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ savedAt });
}
