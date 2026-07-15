/**
 * Saved minutes for one training-sandbox meeting.
 *
 * GET  /api/projects/[id]/training/meetings/[meetingId]/minutes
 *      → { minutes: SavedMinutes | null } — the persisted minutes row, if the
 *      meeting has been completed.
 *
 * POST /api/projects/[id]/training/meetings/[meetingId]/minutes
 *      body { transcript: [{ speaker, text }] }
 *      → generates formal minutes + checkpoint scoring from the completed
 *      transcript (lib/training-meeting-minutes.ts) and upserts them, one row
 *      per (project, meeting). Called by the meeting client when the meeting
 *      adjourns; re-completing after a restart regenerates.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";
import { canAccessProject } from "@/lib/project-access";
import { getTrainingMeeting, type MeetingTurn } from "@/lib/training-meetings";
import { generateMeetingMinutes } from "@/lib/training-meeting-minutes";

export const maxDuration = 60;

const MAX_TRANSCRIPT_TURNS = 80;
const MAX_TURN_CHARS = 2000;

function rowToPayload(row: Record<string, unknown>) {
  return {
    meetingId: row.meeting_id,
    title: row.title,
    day: row.day,
    minutes: row.minutes,
    checkpoints: row.checkpoints,
    scoreCaught: row.score_caught,
    scoreTotal: row.score_total,
    transcript: row.transcript,
    completedAt: row.completed_at,
  };
}

async function authorize(projectId: string, meetingId: string) {
  const session = await getSession();
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  if (!(await canAccessProject(projectId, session))) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  const meeting = getTrainingMeeting(meetingId);
  if (!meeting) return { error: NextResponse.json({ error: "Unknown meeting" }, { status: 404 }) };

  const supabase = getSupabase();
  const { data: project } = await supabase
    .from("projects")
    .select("is_training, training_role, name")
    .eq("id", projectId)
    .maybeSingle();

  if (!project || !project.is_training) {
    return { error: NextResponse.json({ error: "Not a training project" }, { status: 404 }) };
  }
  if (project.training_role !== meeting.role) {
    return { error: NextResponse.json({ error: "Meeting not available for this role" }, { status: 404 }) };
  }

  return { session, meeting, project, supabase };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; meetingId: string }> },
) {
  const { id: projectId, meetingId } = await params;
  const auth = await authorize(projectId, meetingId);
  if ("error" in auth) return auth.error;

  const { data } = await auth.supabase
    .from("training_meeting_minutes")
    .select("*")
    .eq("project_id", projectId)
    .eq("meeting_id", meetingId)
    .maybeSingle();

  return NextResponse.json({ minutes: data ? rowToPayload(data) : null });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; meetingId: string }> },
) {
  const { id: projectId, meetingId } = await params;
  const auth = await authorize(projectId, meetingId);
  if ("error" in auth) return auth.error;
  const { session, meeting, project, supabase } = auth;

  let body: { transcript?: unknown };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const validKeys = new Set(["user", ...meeting.speakers.map((s) => s.key)]);
  const transcript: MeetingTurn[] = (Array.isArray(body.transcript) ? body.transcript : [])
    .filter(
      (t): t is { speaker: string; text: string } =>
        !!t &&
        typeof t === "object" &&
        typeof (t as { speaker?: unknown }).speaker === "string" &&
        typeof (t as { text?: unknown }).text === "string" &&
        validKeys.has((t as { speaker: string }).speaker),
    )
    .slice(-MAX_TRANSCRIPT_TURNS)
    .map((t) => ({
      speaker: t.speaker,
      text: t.text.trim().slice(0, MAX_TURN_CHARS),
    }))
    .filter((t) => t.text.length > 0);

  if (transcript.length === 0 || !transcript.some((t) => t.speaker === "user")) {
    return NextResponse.json({ error: "A completed transcript is required" }, { status: 400 });
  }

  // Trainee name for grounding the minute-taker.
  const { data: user } = await supabase
    .from("users")
    .select("first_name, last_name, username")
    .eq("id", session.id)
    .maybeSingle();
  const traineeName =
    [user?.first_name, user?.last_name].filter(Boolean).join(" ").trim() ||
    user?.username ||
    "";

  const generated = await generateMeetingMinutes({
    meeting,
    transcript,
    projectName: project.name ?? "Training Project",
    traineeName,
  });

  const { data: saved, error } = await supabase
    .from("training_meeting_minutes")
    .upsert(
      {
        project_id: projectId,
        meeting_id: meeting.id,
        title: meeting.title,
        day: meeting.day,
        minutes: generated.minutes,
        checkpoints: generated.checkpoints,
        score_caught: generated.scoreCaught,
        score_total: generated.scoreTotal,
        transcript,
        created_by: session.id,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "project_id,meeting_id" },
    )
    .select()
    .single();

  if (error || !saved) {
    return NextResponse.json(
      { error: error?.message || "Failed to save minutes" },
      { status: 500 },
    );
  }

  return NextResponse.json({ minutes: rowToPayload(saved) });
}
