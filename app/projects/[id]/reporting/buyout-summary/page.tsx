import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import BuyoutSummaryReport from "./BuyoutSummaryReport";

export default async function BuyoutSummaryReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;
  return <BuyoutSummaryReport projectId={id} username={session.username} />;
}
