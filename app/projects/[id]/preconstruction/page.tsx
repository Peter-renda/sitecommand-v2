import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import PreconstructionClient from "./PreconstructionClient";
import UnderConstructionPopup from "@/app/components/UnderConstructionPopup";

export default async function PreconstructionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await params;
  return (
    <>
      <PreconstructionClient projectId={id} role={session.role} username={session.username} />
      <UnderConstructionPopup featureName="Preconstruction" />
    </>
  );
}
