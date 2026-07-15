import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";
import { getTrainingMeeting } from "@/lib/training-meetings";
import TrainingMeetingClient from "./TrainingMeetingClient";

/**
 * Interactive text meeting for a SiteCommand Training sandbox. Opened in a new
 * tab from the Day panel's hyperlinked meeting task. The fake attendees talk in
 * turn and the trainee (the PM) responds via text whenever the floor is handed
 * to them; see lib/training-meetings.ts for the meeting definitions and the
 * API route under /api/projects/[id]/training/meetings for turn generation.
 */
export default async function TrainingMeetingPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string; meeting?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { project: projectId, meeting: meetingId } = await searchParams;
  if (!projectId || !meetingId) redirect("/training/practice");

  const meeting = getTrainingMeeting(meetingId);
  if (!meeting) redirect("/training/practice");

  const { data: project } = await getSupabase()
    .from("projects")
    .select("id, is_training, training_owner_id, training_role, name")
    .eq("id", projectId)
    .maybeSingle();

  // Owner-only, training-flagged sandboxes only, matching the meeting's role.
  if (!project || !project.is_training || project.training_owner_id !== session.id) {
    redirect("/training/practice");
  }
  if (project.training_role !== meeting.role) redirect(`/projects/${projectId}`);

  return (
    <TrainingMeetingClient
      projectId={project.id}
      meetingId={meeting.id}
      projectName={project.name ?? "Training Project"}
    />
  );
}
