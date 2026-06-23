import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { canAccessProject } from "@/lib/project-access";
import { getSupabase } from "@/lib/supabase";
import AssistWidget from "@/components/AssistWidget";
import TrainingBanner from "./components/TrainingBanner";
import TrainingDayOnePanel from "./components/TrainingDayOnePanel";
import type { SimRole } from "@/lib/simulation-constants";

function isTrainingRole(role: string | null): role is SimRole {
  return role === "superintendent" || role === "project_manager" || role === "accounting";
}

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;

  // Demo users may navigate into projects they created client-side (sessionStorage only).
  // Those projects don't exist in the database, so we skip the DB access check for demo
  // accounts and trust the client-side interceptor to handle data correctly.
  let isTraining = false;
  let trainingRole: string | null = null;
  let trainingSavedAt: string | null = null;
  if (session.user_type !== "demo") {
    const hasAccess = await canAccessProject(id, session);
    if (!hasAccess) redirect("/dashboard");

    // Sandbox projects get a persistent "SiteCommand Training" banner (with the
    // auto-save / Save progress controls) so it's always clear this is a practice
    // environment, not a real project.
    const { data: project } = await getSupabase()
      .from("projects")
      .select("is_training, training_role, training_last_saved_at")
      .eq("id", id)
      .maybeSingle();
    isTraining = !!project?.is_training;
    trainingRole = project?.training_role ?? null;
    trainingSavedAt = project?.training_last_saved_at ?? null;
  }

  return (
    <>
      {isTraining && <TrainingBanner projectId={id} initialSavedAt={trainingSavedAt} />}
      {children}
      <AssistWidget projectId={id} />
      {isTraining && isTrainingRole(trainingRole) && <TrainingDayOnePanel projectId={id} role={trainingRole} />}
    </>
  );
}
