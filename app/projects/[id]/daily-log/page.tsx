import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import DailyLogClient from "./DailyLogClient";

export default async function DailyLogPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;
  return (
    <DailyLogClient
      projectId={id}
      role={session.role}
      username={session.username}
      companyRole={session.company_role ?? ""}
    />
  );
}
