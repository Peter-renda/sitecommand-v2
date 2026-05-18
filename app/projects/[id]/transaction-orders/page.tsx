import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import TransactionOrdersClient from "./TransactionOrdersClient";

export default async function TransactionOrdersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;
  return (
    <TransactionOrdersClient
      projectId={id}
      username={session.username}
    />
  );
}
