import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { checkProjectAccess } from "@/lib/permissions";
import NewChangeEventClient from "./NewChangeEventClient";

export default async function NewChangeEventPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sourceType?: string; sourceId?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;
  const { sourceType, sourceId } = await searchParams;

  try {
    const { permission } = await checkProjectAccess(session.id, id);
    if (permission !== "write") redirect(`/projects/${id}/change-events`);
  } catch {
    redirect("/login");
  }

  return (
    <NewChangeEventClient
      projectId={id}
      sourceType={sourceType ?? ""}
      sourceId={sourceId ?? ""}
      username={session.username}
    />
  );
}
