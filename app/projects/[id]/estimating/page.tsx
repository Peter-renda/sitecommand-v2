import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import UnderConstructionNotice from "../components/UnderConstructionNotice";

export default async function EstimatingPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  await params;
  return <UnderConstructionNotice title="Estimating" />;
}
