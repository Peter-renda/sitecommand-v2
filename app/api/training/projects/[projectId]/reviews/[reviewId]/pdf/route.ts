/**
 * GET /api/training/projects/[projectId]/reviews/[reviewId]/pdf
 *
 * Serve a phase "Job Review" as a PDF (opened in a new tab from the Training →
 * Practice list). If the review already has a stored PDF, redirect to a fresh
 * signed URL for it; otherwise render the PDF from the saved review data, store
 * it for next time, then redirect. This is what makes "open the review as a PDF"
 * persist the file so it can be re-opened later.
 *
 * Owner-only and training-flagged-projects-only.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";
import {
  storePhaseReviewPdf,
  PHASE_REVIEW_BUCKET,
  type PhaseReviewPdfData,
} from "@/lib/training-review-pdf";

export const maxDuration = 60;

const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string; reviewId: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId, reviewId } = await params;
  const supabase = getSupabase();

  const { data: project } = await supabase
    .from("projects")
    .select("id, is_training, training_owner_id, name")
    .eq("id", projectId)
    .maybeSingle();

  if (!project || !project.is_training) {
    return NextResponse.json({ error: "Sandbox project not found" }, { status: 404 });
  }
  if (project.training_owner_id !== session.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: review } = await supabase
    .from("training_phase_reviews")
    .select("id, phase, review, highlights, resolutions, completed, missed, closed_out, pdf_storage_path")
    .eq("id", reviewId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (!review) {
    return NextResponse.json({ error: "Review not found" }, { status: 404 });
  }

  let storagePath = review.pdf_storage_path as string | null;

  // Generate-and-store on first open (or if a prior render failed).
  if (!storagePath) {
    const data: PhaseReviewPdfData = {
      projectName: project.name || "Training Project",
      phase: review.phase || "Phase",
      review: review.review || "",
      highlights: Array.isArray(review.highlights) ? review.highlights : [],
      resolutions: Array.isArray(review.resolutions) ? review.resolutions : [],
      completed: Array.isArray(review.completed) ? review.completed : [],
      missed: Array.isArray(review.missed) ? review.missed : [],
      closedOut: !!review.closed_out,
    };
    storagePath = await storePhaseReviewPdf(supabase, projectId, review.id, data);
  }

  if (!storagePath) {
    return NextResponse.json({ error: "Could not render the review PDF." }, { status: 500 });
  }

  const { data: signed, error: signError } = await supabase.storage
    .from(PHASE_REVIEW_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);

  if (signError || !signed?.signedUrl) {
    return NextResponse.json({ error: "Could not open the review PDF." }, { status: 500 });
  }

  return NextResponse.redirect(signed.signedUrl);
}
