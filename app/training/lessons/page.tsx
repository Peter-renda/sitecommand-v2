import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import LessonsClient from "./LessonsClient";

export default async function LessonsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return <LessonsClient />;
}
