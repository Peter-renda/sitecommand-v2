import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import ReportingClient from "./ReportingClient";

export default async function ReportingPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;
  return <ReportingClient projectId={id} currentUserName={session.username || session.email || "You"} />;
}
