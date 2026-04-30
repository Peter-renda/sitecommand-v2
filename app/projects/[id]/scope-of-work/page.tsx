import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import ScopeOfWorkClient from "./ScopeOfWorkClient";

export default async function ScopeOfWorkPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;
  return <ScopeOfWorkClient projectId={id} username={session.username} />;
}
