import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import PreconstructionConnect from "./PreconstructionConnect";

export default async function PreconstructionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await params;
  return <PreconstructionConnect projectId={id} username={session.username} />;
}
