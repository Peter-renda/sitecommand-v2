/**
 * Training sandbox — phase milestone "Job Review".
 *
 * SiteCommand Training sandboxes run a real project through phased periods (see
 * lib/training-schedule.ts). At the end of each phase the trainee gets a Job
 * Review: an AI read on the tasks they completed vs. missed across that phase,
 * with explicit callouts when submittals weren't handled in time or an important
 * RFI was never asked. When the review is closed out, the missed tasks are
 * auto-completed (submittals approved, scheduling emails sent/received, etc.) so
 * the project stays on track — the per-missed-task "resolution" text produced
 * here is what's shown as the catch-up.
 *
 * Mirrors the structured-output Gemini pattern used by lib/simulation.ts.
 */

import { GoogleGenAI, Type } from "@google/genai";
import { roleLabel, projectTypeLabel, type SimRole } from "@/lib/simulation-constants";

export type PhaseTask = {
  task: string;
  category: string;
  collaborators: string;
  deliverable: string;
};

export type PhaseReviewHighlight = {
  kind: "praise" | "warning" | "missed_submittal" | "missed_rfi" | "tip";
  text: string;
};

export type PhaseReviewResolution = {
  /** Index into the `missed` array passed in — lets the client map back to the
   *  exact schedule task (day + idx) to auto-complete. */
  index: number;
  task: string;
  category: string;
  resolution: string;
};

export type PhaseReviewContext = {
  role: SimRole;
  projectType: string;
  projectName: string;
  phase: string;
};

const HIGHLIGHT_KINDS = ["praise", "warning", "missed_submittal", "missed_rfi", "tip"] as const;

/** Categories whose missed tasks are the time-sensitive ones to flag loudly. */
const SUBMITTAL_CATEGORIES = new Set(["Submittals"]);
const RFI_CATEGORIES = new Set(["RFI"]);

function ai(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY missing");
  return new GoogleGenAI({ apiKey });
}

/**
 * Generate the phase Job Review: a narrative, structured highlights, and a
 * per-missed-task catch-up resolution. Falls back to templated resolutions if
 * the model misses any.
 */
export async function generatePhaseReview(
  ctx: PhaseReviewContext,
  completed: PhaseTask[],
  missed: PhaseTask[],
): Promise<{ review: string; highlights: PhaseReviewHighlight[]; resolutions: PhaseReviewResolution[] }> {
  const total = completed.length + missed.length;
  const donePct = total > 0 ? Math.round((completed.length / total) * 100) : 100;

  const missedSubmittals = missed.filter((m) => SUBMITTAL_CATEGORIES.has(m.category));
  const missedRfis = missed.filter((m) => RFI_CATEGORIES.has(m.category));

  const systemInstruction = `You are a construction project executive running a milestone Job Review with a ${roleLabel(
    ctx.role,
  )} trainee at the end of the "${ctx.phase}" phase on a ${projectTypeLabel(
    ctx.projectType,
  )} project. Produce:

1. "review": a direct, specific 4-7 sentence review of how they ran this phase. Lead with what they handled well, then be candid about what slipped. You MUST explicitly call it out when:
   - submittals weren't reviewed/approved in time (this delays fabrication and procurement), and/or
   - an important RFI was never asked when the work clearly needed one (this risks rework or a schedule hit).
   Tie misses to the real consequences a ${roleLabel(ctx.role)} would face on this phase. Never break character.
2. "highlights": 3-6 short structured callouts. Each has a "kind":
   - praise            : something handled well
   - warning           : a general risk or slippage
   - missed_submittal  : a submittal not handled in time
   - missed_rfi        : an important RFI never asked
   - tip               : one concrete thing to do better next phase
   Keep each "text" to one sentence.
3. "resolutions": for EACH missed task below (referenced by its missedNum), one or two sentences describing how the back office quietly caught it up so the job keeps moving — written as real construction activity (e.g. "Submittal 09 91 00 was reviewed and returned Approved as Noted and the transmittal logged to the painting sub." or "RFI 022 was issued to the architect, the response received, and the field updated to hold the schedule."). Use believable fabricated submittal/RFI numbers, names, and scheduling emails. Return exactly one resolution per missedNum.`;

  const completedText =
    completed.length > 0
      ? completed.map((c) => `- [${c.category}] ${c.task} (deliverable: ${c.deliverable})`).join("\n")
      : "(nothing was completed this phase)";

  const missedText =
    missed.length > 0
      ? missed
          .map((m, i) => `Missed ${i + 1} | category=${m.category} | ${m.task} (deliverable: ${m.deliverable})`)
          .join("\n")
      : "(nothing was missed this phase)";

  const userPrompt = `PROJECT: ${ctx.projectName} (${projectTypeLabel(ctx.projectType)})
Phase under review: ${ctx.phase}
Tasks completed: ${completed.length} of ${total} (${donePct}%).
Submittal tasks missed: ${missedSubmittals.length}. RFI tasks missed: ${missedRfis.length}.

COMPLETED TASKS:
${completedText}

MISSED TASKS (write one resolution per missedNum):
${missedText}

Write the review, highlights, and resolutions now.`;

  let review = "";
  let highlights: PhaseReviewHighlight[] = [];
  let resolutionText = new Map<number, string>();

  try {
    const result = await ai().models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            review: { type: Type.STRING },
            highlights: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  kind: { type: Type.STRING, enum: [...HIGHLIGHT_KINDS] },
                  text: { type: Type.STRING },
                },
                required: ["kind", "text"],
              },
            },
            resolutions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  missedNum: { type: Type.INTEGER },
                  resolution: { type: Type.STRING },
                },
                required: ["missedNum", "resolution"],
              },
            },
          },
          required: ["review", "highlights", "resolutions"],
        },
      },
    });

    const parsed = JSON.parse((result.text ?? "").trim() || "{}");
    review = String(parsed.review || "").slice(0, 2500);
    highlights = (Array.isArray(parsed.highlights) ? parsed.highlights : [])
      .map((h: Record<string, unknown>) => ({
        kind: ((HIGHLIGHT_KINDS as readonly string[]).includes(String(h.kind))
          ? h.kind
          : "tip") as PhaseReviewHighlight["kind"],
        text: String(h.text || "").slice(0, 400),
      }))
      .filter((h: PhaseReviewHighlight) => h.text)
      .slice(0, 8);

    for (const r of Array.isArray(parsed.resolutions) ? parsed.resolutions : []) {
      const n = Math.round(Number((r as Record<string, unknown>).missedNum) || 0);
      const text = String((r as Record<string, unknown>).resolution || "").slice(0, 600);
      if (n >= 1 && n <= missed.length && text) resolutionText.set(n, text);
    }
  } catch {
    review =
      "Milestone review generated. Keep submittals and RFIs moving on time and stay ahead of the schedule into the next phase.";
    highlights = [];
    resolutionText = new Map();
  }

  const resolutions: PhaseReviewResolution[] = missed.map((m, i) => ({
    index: i,
    task: m.task,
    category: m.category,
    resolution: resolutionText.get(i + 1) || fallbackResolution(m),
  }));

  // Guarantee the headline misses surface even if the model buried them.
  const ensured: PhaseReviewHighlight[] = [];
  if (missedSubmittals.length && !highlights.some((h) => h.kind === "missed_submittal")) {
    ensured.push({
      kind: "missed_submittal",
      text: `${missedSubmittals.length} submittal ${
        missedSubmittals.length === 1 ? "task was" : "tasks were"
      } not handled this phase — that puts fabrication and procurement at risk.`,
    });
  }
  if (missedRfis.length && !highlights.some((h) => h.kind === "missed_rfi")) {
    ensured.push({
      kind: "missed_rfi",
      text: `${missedRfis.length} RFI ${
        missedRfis.length === 1 ? "task was" : "tasks were"
      } left undone when the work needed answers — open questions like these lead to rework.`,
    });
  }

  return { review, highlights: [...ensured, ...highlights], resolutions };
}

/** Templated catch-up note used when the AI omits a resolution for a missed task. */
function fallbackResolution(m: PhaseTask): string {
  switch (m.category) {
    case "Submittals":
      return `${m.deliverable} was reviewed and returned Approved as Noted, and the transmittal was logged so fabrication can proceed.`;
    case "RFI":
      return `An RFI was issued to the design team, the response received, and the answer forwarded to the field.`;
    case "Procurement":
      return `Purchase orders were released and delivery dates confirmed so the procurement log stays on track.`;
    case "Cost":
      return `The cost item was reconciled and submitted for the period.`;
    case "Meetings":
      return `The meeting was held and minutes were issued to the team.`;
    default:
      return `${m.deliverable} was handled by the back office and closed out to keep the project on schedule.`;
  }
}
