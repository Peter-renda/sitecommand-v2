import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import Create360ReportClient from "./Create360ReportClient";

export default async function Create360ReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ category?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;
  const { category } = await searchParams;
  return <Create360ReportClient projectId={id} category={category ?? "Financials"} />;
}
