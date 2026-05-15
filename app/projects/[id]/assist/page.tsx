import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import AssistClient from "./AssistClient";

export default async function AssistPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;
  return <AssistClient projectId={id} />;
}
