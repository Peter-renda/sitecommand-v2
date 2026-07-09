import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import SitePlanClient from "./SitePlanClient";

export default async function SitePlanPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await params;
  return <SitePlanClient projectId={id} />;
}
