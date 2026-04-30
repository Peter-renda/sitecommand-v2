import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import PrimeContractDetailClient from "./PrimeContractDetailClient";

export default async function PrimeContractDetailPage({
  params,
}: {
  params: Promise<{ id: string; contractId: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id, contractId } = await params;

  return (
    <PrimeContractDetailClient
      projectId={id}
      contractId={contractId}
      role={(session as any).role ?? "member"}
      username={session.username}
    />
  );
}
