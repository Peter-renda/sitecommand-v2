/**
 * Training sandbox — render a phase "Job Review" to a stored PDF.
 *
 * The interactive review lives at /training/review; this builds a faithful,
 * printable PDF of the same content (narrative, highlights, completed and
 * missed/auto-completed tasks with catch-up resolutions) so the Training →
 * Practice list can link to "Open PDF" in a new tab. The bytes are uploaded to
 * the existing project-drawings bucket and the path is recorded on the review
 * row so the file can be re-served via a fresh signed URL later.
 *
 * pdf-lib only (no headless browser) — pure server-side text layout.
 */

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { SupabaseClient } from "@supabase/supabase-js";

export const PHASE_REVIEW_BUCKET = "project-drawings";

export type PhaseReviewTask = {
  task: string;
  category: string;
  collaborators?: string;
  deliverable?: string;
};

export type PhaseReviewHighlightLite = { kind: string; text: string };
export type PhaseReviewResolutionLite = {
  index: number;
  task: string;
  category: string;
  resolution: string;
};

export type PhaseReviewPdfData = {
  projectName: string;
  phase: string;
  review: string;
  highlights: PhaseReviewHighlightLite[];
  resolutions: PhaseReviewResolutionLite[];
  completed: PhaseReviewTask[];
  missed: PhaseReviewTask[];
  closedOut: boolean;
};

const HIGHLIGHT_LABEL: Record<string, string> = {
  praise: "Strength",
  tip: "Coaching",
  warning: "Watch",
  missed_submittal: "Missed submittal",
  missed_rfi: "Missed RFI",
};

// StandardFonts (Helvetica) are WinAnsi-encoded and choke on smart quotes,
// em dashes, bullets, checkmarks, etc. Normalize the common ones to ASCII and
// drop anything still outside the printable range so drawing never throws.
function sanitize(s: string): string {
  return String(s ?? "")
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/[•●▪‣]/g, "-")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "");
}

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 54;
const CONTENT_W = PAGE_W - MARGIN * 2;

export async function buildPhaseReviewPdf(data: PhaseReviewPdfData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let page: PDFPage = pdf.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  const ensure = (needed: number) => {
    if (y - needed < MARGIN) {
      page = pdf.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
    }
  };

  const wrap = (text: string, f: PDFFont, size: number, maxW: number): string[] => {
    const words = text.replace(/\s+/g, " ").trim().split(" ");
    const lines: string[] = [];
    let line = "";
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (f.widthOfTextAtSize(test, size) > maxW && line) {
        lines.push(line);
        line = w;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines.length ? lines : [""];
  };

  const para = (
    text: string,
    opts: { font?: PDFFont; size?: number; color?: ReturnType<typeof rgb>; gap?: number; indent?: number } = {},
  ) => {
    const f = opts.font ?? font;
    const size = opts.size ?? 11;
    const color = opts.color ?? rgb(0.13, 0.13, 0.15);
    const indent = opts.indent ?? 0;
    const lineH = size * 1.38;
    for (const ln of wrap(sanitize(text), f, size, CONTENT_W - indent)) {
      ensure(lineH);
      page.drawText(ln, { x: MARGIN + indent, y: y - size, size, font: f, color });
      y -= lineH;
    }
    if (opts.gap) y -= opts.gap;
  };

  const rule = (gap = 10) => {
    ensure(gap + 2);
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: PAGE_W - MARGIN, y },
      thickness: 0.75,
      color: rgb(0.85, 0.85, 0.88),
    });
    y -= gap;
  };

  const sectionHeading = (text: string) => {
    y -= 6;
    para(text, { font: bold, size: 13, color: rgb(0.1, 0.1, 0.12), gap: 4 });
  };

  // ── Header ────────────────────────────────────────────────────────────────
  para("PHASE JOB REVIEW", { font: bold, size: 9, color: rgb(0.5, 0.5, 0.55), gap: 2 });
  para(data.phase, { font: bold, size: 20, color: rgb(0.08, 0.08, 0.1), gap: 1 });
  para(data.projectName, { size: 11, color: rgb(0.45, 0.45, 0.5), gap: 4 });

  const total = data.completed.length + data.missed.length;
  const donePct = total > 0 ? Math.round((data.completed.length / total) * 100) : 100;
  para(
    `${data.completed.length} completed   |   ${data.missed.length} missed   |   ${donePct}% done`,
    { size: 11, color: rgb(0.3, 0.3, 0.35), gap: 6 },
  );

  if (data.closedOut) {
    para("Review closed out - the missed items below were caught back up to keep the project on track.", {
      font: bold,
      size: 10.5,
      color: rgb(0.06, 0.5, 0.32),
      gap: 4,
    });
  }
  rule(12);

  // ── Performance review ──────────────────────────────────────────────────────
  sectionHeading("Performance review");
  para(data.review || "No review available.", { gap: 6 });

  if (data.highlights.length > 0) {
    for (const h of data.highlights) {
      const label = HIGHLIGHT_LABEL[h.kind] ?? "Note";
      // Draw the bold label, then the text wrapped beneath it.
      para(`${label}:`, { font: bold, size: 10.5, color: rgb(0.2, 0.2, 0.24), gap: 0, indent: 0 });
      para(h.text, { size: 10.5, color: rgb(0.25, 0.25, 0.3), gap: 4, indent: 12 });
    }
    y -= 2;
  }
  rule(12);

  // ── Completed tasks ─────────────────────────────────────────────────────────
  sectionHeading(`Completed tasks (${data.completed.length})`);
  if (data.completed.length > 0) {
    for (const t of data.completed) {
      para(`[${t.category}] ${t.task}`, { size: 10.5, gap: t.collaborators ? 0 : 4 });
      if (t.collaborators) {
        para(t.collaborators, { size: 9, color: rgb(0.5, 0.5, 0.55), gap: 4, indent: 12 });
      }
    }
  } else {
    para("No tasks were checked off this phase.", { size: 10.5, color: rgb(0.5, 0.5, 0.55), gap: 4 });
  }

  // ── Missed / auto-completed tasks ───────────────────────────────────────────
  if (data.missed.length > 0) {
    y -= 6;
    sectionHeading(
      `${data.closedOut ? "Auto-completed" : "Missed"} tasks (${data.missed.length})`,
    );
    data.missed.forEach((t, i) => {
      para(`[${t.category}] ${t.task}`, { size: 10.5, gap: 0 });
      const res = data.resolutions.find((r) => r.index === i)?.resolution;
      if (data.closedOut && res) {
        para(`Caught up: ${res}`, { size: 9.5, color: rgb(0.06, 0.45, 0.3), gap: 4, indent: 12 });
      } else {
        para(t.deliverable ? `Deliverable: ${t.deliverable}` : "", {
          size: 9,
          color: rgb(0.5, 0.5, 0.55),
          gap: 4,
          indent: 12,
        });
      }
    });
  }

  return pdf.save();
}

/** Stable storage path for a phase review PDF (one per project + phase). */
export function phaseReviewPdfPath(projectId: string, phase: string): string {
  const slug =
    sanitize(phase)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 60) || "phase";
  return `${projectId}/_phase-reviews/${slug}.pdf`;
}

/**
 * Build the PDF, upload it (overwriting any prior rendition for this phase), and
 * record the storage path on the review row. Best-effort: returns the path on
 * success, or null if anything fails (callers treat a null as "no PDF yet").
 */
export async function storePhaseReviewPdf(
  supabase: SupabaseClient,
  projectId: string,
  reviewId: string,
  data: PhaseReviewPdfData,
): Promise<string | null> {
  try {
    const bytes = await buildPhaseReviewPdf(data);
    const path = phaseReviewPdfPath(projectId, data.phase);
    const { error: uploadError } = await supabase.storage
      .from(PHASE_REVIEW_BUCKET)
      .upload(path, Buffer.from(bytes), { contentType: "application/pdf", upsert: true });
    if (uploadError) {
      console.error("Failed to upload phase review PDF:", uploadError.message);
      return null;
    }
    const { error: updateError } = await supabase
      .from("training_phase_reviews")
      .update({ pdf_storage_path: path })
      .eq("id", reviewId);
    if (updateError) console.error("Failed to record phase review PDF path:", updateError.message);
    return path;
  } catch (e) {
    console.error("Failed to build phase review PDF:", e);
    return null;
  }
}
