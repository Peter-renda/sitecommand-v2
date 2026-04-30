import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import CreatePrimeContractClient from "./CreatePrimeContractClient";

export default async function CreatePrimeContractPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;
  return <CreatePrimeContractClient projectId={id} username={session.username} />;
}
