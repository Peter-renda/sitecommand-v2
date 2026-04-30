import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { checkProjectAccess } from "@/lib/permissions";
import ChangeEventsClient from "./ChangeEventsClient";

export default async function ChangeEventsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;

  let canWrite = false;
  try {
    const { permission } = await checkProjectAccess(session.id, id);
    canWrite = permission === "write";
  } catch {
    redirect("/login");
  }

  return <ChangeEventsClient projectId={id} canWrite={canWrite} username={session.username} />;
}
