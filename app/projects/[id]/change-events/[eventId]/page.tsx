import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { checkProjectAccess } from "@/lib/permissions";
import ChangeEventDetailClient from "./ChangeEventDetailClient";

export default async function ChangeEventDetailPage({
  params,
}: {
  params: Promise<{ id: string; eventId: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id: projectId, eventId } = await params;

  let canWrite = false;
  try {
    const { permission } = await checkProjectAccess(session.id, projectId);
    canWrite = permission === "write";
  } catch {
    redirect("/login");
  }

  return <ChangeEventDetailClient projectId={projectId} eventId={eventId} canWrite={canWrite} username={session.username} />;
}
