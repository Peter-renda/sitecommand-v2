import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import ZoningAnalysisClient from "./ZoningAnalysisClient";

export default async function ZoningAnalysisPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await params;
  return <ZoningAnalysisClient projectId={id} />;
}
