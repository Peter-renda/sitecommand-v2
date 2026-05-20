import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import PermitApplicationsClient from "./PermitApplicationsClient";

export default async function PermitApplicationsPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;
  return <PermitApplicationsClient projectId={id} role={session.role} username={session.username} />;
}
