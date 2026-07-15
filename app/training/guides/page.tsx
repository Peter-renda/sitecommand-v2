import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import GuidesClient from "./GuidesClient";

export default async function GuidesPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <GuidesClient
      canManage={session.company_role === "super_admin"}
      hasCompany={Boolean(session.company_id)}
    />
  );
}
