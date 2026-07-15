import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import TMTicketsClient from "./TMTicketsClient";
import UnderConstructionPopup from "@/app/components/UnderConstructionPopup";

export default async function TMTicketsPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;
  return (
    <>
      <TMTicketsClient projectId={id} username={session.username} />
      <UnderConstructionPopup featureName="T&M Tickets" />
    </>
  );
}
