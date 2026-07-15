import { Suspense } from "react";
import { getSession } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";
import { redirect } from "next/navigation";
import EmailsClient from "./EmailsClient";

export default async function EmailsPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;

  // Training sandboxes get a fully simulated inbox — the client never touches
  // the user's real email connection there.
  const { data: project } = await getSupabase()
    .from("projects")
    .select("is_training")
    .eq("id", id)
    .maybeSingle();

  return (
    <Suspense>
      <EmailsClient projectId={id} isTraining={!!project?.is_training} />
    </Suspense>
  );
}
