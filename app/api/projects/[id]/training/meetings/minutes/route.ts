/**
 * All saved meeting minutes for a training sandbox.
 *
 * GET /api/projects/[id]/training/meetings/minutes → { minutes: [...] } — one
 * entry per completed meeting (meetingId, title, day, score), used by the
 * phase Job Review to hyperlink the minutes of that phase's meetings.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";
import { canAccessProject } from "@/lib/project-access";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;

  if (!(await canAccessProject(projectId, session))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = getSupabase();
  const { data: project } = await supabase
    .from("projects")
    .select("is_training")
    .eq("id", projectId)
    .maybeSingle();

  if (!project || !project.is_training) {
    return NextResponse.json({ error: "Not a training project" }, { status: 404 });
  }

  const { data } = await supabase
    .from("training_meeting_minutes")
    .select("meeting_id, title, day, score_caught, score_total, completed_at")
    .eq("project_id", projectId)
    .order("day", { ascending: true });

  return NextResponse.json({
    minutes: (data ?? []).map((row) => ({
      meetingId: row.meeting_id,
      title: row.title,
      day: row.day,
      scoreCaught: row.score_caught,
      scoreTotal: row.score_total,
      completedAt: row.completed_at,
    })),
  });
}
