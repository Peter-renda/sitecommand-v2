import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import JobReviewClient from "./JobReviewClient";

export default async function JobReviewPage({
  params,
}: {
  params: Promise<{ gameId: string; reviewId: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { gameId, reviewId } = await params;
  return <JobReviewClient gameId={gameId} reviewId={reviewId} />;
}
