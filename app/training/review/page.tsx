import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";
import { getTrainingSchedule, resolveDayIndex } from "@/lib/training-schedule";
import type { SimRole } from "@/lib/simulation-constants";
import TrainingReviewClient from "./TrainingReviewClient";

function isTrainingRole(role: string | null): role is SimRole {
  return role === "superintendent" || role === "project_manager" || role === "accounting";
}

/**
 * Milestone Job Review for a SiteCommand Training sandbox phase. Opened in a new
 * tab from the Day panel when a phase is completed; reads which scheduled tasks
 * were done/missed from the browser's localStorage (the same store the Day panel
 * uses) and walks the trainee through an AI review + catch-up.
 */
export default async function TrainingReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string; day?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { project: projectId, day } = await searchParams;
  if (!projectId) redirect("/training/practice");

  const { data: project } = await getSupabase()
    .from("projects")
    .select("id, is_training, training_owner_id, training_role, training_project_type, name")
    .eq("id", projectId)
    .maybeSingle();

  // Owner-only, training-flagged sandboxes only.
  if (!project || !project.is_training || project.training_owner_id !== session.id) {
    redirect("/training/practice");
  }
  if (!isTrainingRole(project.training_role)) redirect("/training/practice");

  const schedule = getTrainingSchedule(project.training_role);
  const dayNum = Number(day) || 0;
  const idx = resolveDayIndex(schedule, dayNum);
  if (idx < 0) redirect(`/projects/${projectId}`);
  const phase = schedule[idx].phase;

  return (
    <TrainingReviewClient
      projectId={project.id}
      role={project.training_role}
      projectName={project.name ?? "Training Project"}
      phase={phase}
      day={schedule[idx].day}
    />
  );
}
