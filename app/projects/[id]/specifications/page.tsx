import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import SpecificationsClient from "./SpecificationsClient";

export default async function SpecificationsPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;
  return <SpecificationsClient projectId={id} username={session.username} />;
}
