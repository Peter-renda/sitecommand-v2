import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import EmailsClient from "./EmailsClient";

export default async function EmailsPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;
  return <EmailsClient projectId={id} />;
}
