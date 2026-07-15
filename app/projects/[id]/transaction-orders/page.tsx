import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import TransactionOrdersClient from "./TransactionOrdersClient";
import { isProjectSuperAdmin } from "@/lib/project-access";

export default async function TransactionOrdersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;
  // Assigning an invoice to another project is reserved for Company Super
  // Admins (not all tool-admins), so the control is hidden for everyone else.
  const canAssign = await isProjectSuperAdmin(id, session);

  return (
    <TransactionOrdersClient
      projectId={id}
      username={session.username}
      userId={session.id}
      canAssign={canAssign}
    />
  );
}
