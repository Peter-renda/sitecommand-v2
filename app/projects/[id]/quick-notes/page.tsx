import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import QuickNotesClient from "./QuickNotesClient";

export default async function QuickNotesPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;
  return <QuickNotesClient projectId={id} userName={session.username} />;
}
