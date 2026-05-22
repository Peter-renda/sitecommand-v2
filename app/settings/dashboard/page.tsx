import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import DashboardSettingsClient from "./DashboardSettingsClient";

export default async function DashboardSettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return <DashboardSettingsClient />;
}
