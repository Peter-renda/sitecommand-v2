import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import SingleToolReportBuilderClient from "../new/SingleToolReportBuilderClient";

export default async function ViewSingleToolReportPage({
  params,
}: {
  params: Promise<{ id: string; reportId: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id, reportId } = await params;
  return (
    <SingleToolReportBuilderClient
      projectId={id}
      currentUserName={session.username}
      currentUserEmail={session.email}
      reportId={reportId}
    />
  );
}
