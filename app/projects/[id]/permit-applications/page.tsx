import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import PermitApplicationsClient from "./PermitApplicationsClient";
import { getToolLevel } from "@/lib/tool-permissions";

export default async function PermitApplicationsPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;
  const toolLevel = await getToolLevel(session, id, "permit-applications");
  if (toolLevel === "none") redirect(`/projects/${id}`);

  return (
    <PermitApplicationsClient projectId={id} userId={session.id} toolLevel={toolLevel} />
  );
}
