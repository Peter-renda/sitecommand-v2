import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import BudgetModificationsReport from "./BudgetModificationsReport";

export default async function BudgetModificationsReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;
  return <BudgetModificationsReport projectId={id} username={session.username} />;
}
