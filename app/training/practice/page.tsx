import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import PracticeClient from "./PracticeClient";

export default async function PracticePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return <PracticeClient username={session.username} />;
}
