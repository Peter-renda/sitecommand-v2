import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import BidManagementClient from "./BidManagementClient";
import UnderConstructionPopup from "@/app/components/UnderConstructionPopup";

export default async function BidManagementPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;
  return (
    <>
      <BidManagementClient projectId={id} role={session.role} userId={session.id} username={session.username} />
      <UnderConstructionPopup featureName="Bid Management" />
    </>
  );
}
