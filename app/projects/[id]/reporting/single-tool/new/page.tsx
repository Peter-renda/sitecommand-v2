import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import SingleToolReportBuilderClient from "./SingleToolReportBuilderClient";

export default async function NewSingleToolReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;
  return (
    <SingleToolReportBuilderClient
      projectId={id}
      currentUserName={session.username}
      currentUserEmail={session.email}
    />
  );
}
