import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import TimesheetsClient from "./TimesheetsClient";
import UnderConstructionPopup from "@/app/components/UnderConstructionPopup";

export default async function TimesheetsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;
  return (
    <>
      <TimesheetsClient projectId={id} username={session.username} />
      <UnderConstructionPopup featureName="Timesheets" />
    </>
  );
}
