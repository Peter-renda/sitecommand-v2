import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { canAccessProject } from "@/lib/project-access";
import ReportRecordsClient from "./ReportRecordsClient";

export default async function ReportRecordsPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;
  if (!(await canAccessProject(id, session))) redirect(`/projects/${id}`);

  return <ReportRecordsClient projectId={id} />;
}
