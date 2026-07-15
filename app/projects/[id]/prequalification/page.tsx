import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import PrequalificationClient from "./PrequalificationClient";
import UnderConstructionPopup from "@/app/components/UnderConstructionPopup";

export default async function PrequalificationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;
  return (
    <>
      <PrequalificationClient projectId={id} role={session.role} username={session.username} />
      <UnderConstructionPopup featureName="Prequalification" />
    </>
  );
}
