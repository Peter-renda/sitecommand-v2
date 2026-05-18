import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import TransactionOrdersClient from "./TransactionOrdersClient";
import { getToolLevel } from "@/lib/tool-permissions";

export default async function TransactionOrdersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;
  const toolLevel = await getToolLevel(session, id, "transaction-orders");

  return (
    <TransactionOrdersClient
      projectId={id}
      username={session.username}
      userId={session.id}
      canAssign={toolLevel === "admin"}
    />
  );
}
