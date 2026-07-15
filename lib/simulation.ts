/**
 * Training → Practice: AI engine for the project simulation "game".
 *
 * Drives a sandbox construction project the user plays through as a chosen role
 * (superintendent / project manager / accounting) on a chosen project type
 * (multifamily, education, data center, …). Three responsibilities:
 *
 *   1. generateProjectSetup() — invent a realistic project (name, location,
 *      contract value, duration) when a game is created.
 *   2. simulateDay()         — advance one in-game day: produce a narrative
 *      summary, a set of events (including problems like a sub slipping behind
 *      or a safety violation), and the required actions the player must complete
 *      for their role (daily logs, PCOs, RFIs, emails, etc.).
 *   3. gradeAction()         — grade a single submitted action and return points
 *      plus written feedback.
 *   4. generateScoreReport() — at a scoring boundary, review how the player did
 *      over the covered span of days.
 *
 * All AI calls use Gemini 2.5 Flash with structured output, mirroring the other
 * AI features in the codebase (lib/looking-ahead.ts, lib/todo-recommendations.ts).
 */

import { GoogleGenAI, Type } from "@google/genai";
import { randomUUID } from "crypto";
import {
  ROLES,
  PROJECT_TYPES,
  ROLE_ACTION_TYPES,
  EVENT_SEVERITIES,
  roleLabel,
  projectTypeLabel,
  type SimRole,
  type ScoringFrequency,
  type EventSeverity,
} from "@/lib/simulation-constants";

export {
  ROLES,
  PROJECT_TYPES,
  ROLE_ACTION_TYPES,
  EVENT_SEVERITIES,
  type SimRole,
  type ScoringFrequency,
  type EventSeverity,
};

export type SimEvent = {
  id: string;
  type: string;
  severity: EventSeverity;
  title: string;
  description: string;
};

export type RequiredAction = {
  id: string;
  action_type: string;
  title: string;
  description: string;
  points: number;
};

export type SimDay = {
  day_number: number;
  sim_date: string;
  weather: string;
  summary: string;
  events: SimEvent[];
  required_actions: RequiredAction[];
};

export type ProjectSetup = {
  project_name: string;
  project_overview: string;
  location: string;
  contract_value: number;
  total_days: number;
};

function ai(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY missing");
  return new GoogleGenAI({ apiKey });
}

/** Add `days` calendar days to an ISO date string, returning YYYY-MM-DD. */
export function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split("T")[0];
}

// ───────────────────────────── Project setup ─────────────────────────────

export async function generateProjectSetup(
  role: SimRole,
  projectType: string,
): Promise<ProjectSetup> {
  const systemInstruction = `You are a construction industry simulation designer. Invent a realistic, specific commercial construction project for a training simulation. Make it feel real: a believable project name, a US city/state, a plausible total contract value, and a realistic construction duration measured in WORKING days. Keep the duration between 20 and 60 working days so the simulation is playable. The overview should be 2-3 sentences describing the scope, key trades involved, and current stage at kickoff.`;

  const userPrompt = `Project type: ${projectTypeLabel(projectType)}
The player will run this project as: ${roleLabel(role)}.
Generate the project setup.`;

  const result = await ai().models.generateContent({
    model: "gemini-2.5-flash",
    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          project_name: { type: Type.STRING },
          project_overview: { type: Type.STRING },
          location: { type: Type.STRING },
          contract_value: { type: Type.NUMBER },
          total_days: { type: Type.INTEGER },
        },
        required: ["project_name", "project_overview", "location", "contract_value", "total_days"],
      },
    },
  });

  const parsed = JSON.parse((result.text ?? "").trim() || "{}");
  const total = Math.max(20, Math.min(60, Math.round(Number(parsed.total_days) || 30)));
  return {
    project_name: String(parsed.project_name || `${projectTypeLabel(projectType)} Project`).slice(0, 160),
    project_overview: String(parsed.project_overview || "").slice(0, 1200),
    location: String(parsed.location || "").slice(0, 120),
    contract_value: Math.max(0, Number(parsed.contract_value) || 0),
    total_days: total,
  };
}

// ───────────────────────────── Day simulation ─────────────────────────────

type GameContext = {
  role: SimRole;
  project_type: string;
  project_name: string;
  project_overview: string;
  location: string;
  contract_value: number;
  total_days: number;
};

type HistoryItem = {
  day_number: number;
  summary: string;
  open_events: string[];
};

export async function simulateDay(
  game: GameContext,
  dayNumber: number,
  simDate: string,
  history: HistoryItem[],
): Promise<SimDay> {
  const role = game.role;
  const phasePct = Math.round((dayNumber / Math.max(1, game.total_days)) * 100);
  const actionMenu = ROLE_ACTION_TYPES[role].map((a) => a.value).join(", ");

  const historyText =
    history.length > 0
      ? history
          .slice(-7)
          .map(
            (h) =>
              `Day ${h.day_number}: ${h.summary}${h.open_events.length ? `\n  Still open: ${h.open_events.join("; ")}` : ""}`,
          )
          .join("\n")
      : "(this is the first day on the job)";

  const systemInstruction = `You are the simulation engine for a construction project management training game. The player is the ${roleLabel(role)} on a ${projectTypeLabel(game.project_type)} project. Each turn you simulate ONE working day on the jobsite and return:

1. A "summary": a vivid 3-6 sentence narrative recap of what happened on site today — crews, progress, deliveries, weather impacts, conversations, and any problems that came up. Write it like a seasoned super's end-of-day rundown.
2. "events": 2-5 discrete things that occurred today. Each has a severity:
   - info     : routine progress, no action needed
   - minor    : small issue worth noting
   - major    : a real problem (sub behind schedule, failed inspection, RFI needed, material delay, budget overrun)
   - critical : urgent (safety violation/incident, stop-work, major design conflict)
   Across the whole project, regularly introduce realistic PROBLEMS the player must respond to: subcontractors running behind schedule, safety violations, weather delays, failed inspections, material/long-lead delays, design conflicts, change conditions, and budget/billing issues.
3. "required_actions": the things THIS role must do today to properly run the project, given today's events. Draw action_type from: ${actionMenu}. Each required action has a clear title, a description of what's expected, and a points value (5-20 based on importance). Most days have 1-4 required actions. A clean day might have just a routine daily log; a bad day will have several.

Tailor everything to the ${roleLabel(role)} role:
- superintendent: field operations — daily logs, manpower, safety, quality, inspections, schedule on the ground, RFIs to the PM.
- project_manager: the office — RFIs, submittals, PCOs/change orders, owner and subcontractor communication, schedule, buyout.
- accounting: the money — pay applications, owner billing, invoice review, budgets, lien waivers, cost coding.

Rules:
- The project is ${phasePct}% through its timeline (day ${dayNumber} of ${game.total_days}). Reflect the right stage of work (early = mobilization/sitework/foundations, middle = structure/MEP rough-in, late = finishes/commissioning/closeout/punch).
- Be consistent with prior days. If a problem was left open, it may escalate or get resolved.
- Keep it realistic and specific (real trades, real materials, real dollar amounts, real inspection types). Never break character or mention that this is AI-generated.`;

  const userPrompt = `PROJECT: ${game.project_name} — ${projectTypeLabel(game.project_type)} in ${game.location}
Contract value: $${Math.round(game.contract_value).toLocaleString()}
Total duration: ${game.total_days} working days
Overview: ${game.project_overview}

RECENT DAYS:
${historyText}

Simulate DAY ${dayNumber} (calendar date ${simDate}). Return the day's weather, summary, events, and required actions for the ${roleLabel(role)}.`;

  const result = await ai().models.generateContent({
    model: "gemini-2.5-flash",
    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          weather: { type: Type.STRING },
          summary: { type: Type.STRING },
          events: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                type: { type: Type.STRING },
                severity: { type: Type.STRING, enum: [...EVENT_SEVERITIES] },
                title: { type: Type.STRING },
                description: { type: Type.STRING },
              },
              required: ["severity", "title", "description"],
            },
          },
          required_actions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                action_type: { type: Type.STRING },
                title: { type: Type.STRING },
                description: { type: Type.STRING },
                points: { type: Type.INTEGER },
              },
              required: ["action_type", "title", "description", "points"],
            },
          },
        },
        required: ["weather", "summary", "events", "required_actions"],
      },
    },
  });

  const parsed = JSON.parse((result.text ?? "").trim() || "{}");

  const events: SimEvent[] = (Array.isArray(parsed.events) ? parsed.events : []).map(
    (e: Record<string, unknown>) => ({
      id: randomUUID(),
      type: String(e.type || "event").slice(0, 40),
      severity: (EVENT_SEVERITIES as readonly string[]).includes(String(e.severity))
        ? (e.severity as EventSeverity)
        : "info",
      title: String(e.title || "").slice(0, 200),
      description: String(e.description || "").slice(0, 1000),
    }),
  );

  const required_actions: RequiredAction[] = (
    Array.isArray(parsed.required_actions) ? parsed.required_actions : []
  ).map((a: Record<string, unknown>) => ({
    id: randomUUID(),
    action_type: String(a.action_type || "note").slice(0, 40),
    title: String(a.title || "").slice(0, 200),
    description: String(a.description || "").slice(0, 1000),
    points: Math.max(1, Math.min(25, Math.round(Number(a.points) || 10))),
  }));

  return {
    day_number: dayNumber,
    sim_date: simDate,
    weather: String(parsed.weather || "").slice(0, 80),
    summary: String(parsed.summary || "").slice(0, 2000),
    events,
    required_actions,
  };
}

// ───────────────────────────── Grading ─────────────────────────────

export async function gradeAction(
  game: GameContext,
  dayContext: { day_number: number; summary: string },
  required: { action_type: string; title: string; description: string; points: number } | null,
  submission: { action_type: string; title: string; content: string },
): Promise<{ score: number; max_score: number; feedback: string }> {
  const maxScore = required?.points ?? 8;

  const systemInstruction = `You are a senior construction mentor grading a trainee playing the ${roleLabel(
    game.role,
  )} on a ${projectTypeLabel(game.project_type)} project. They have submitted a "${submission.action_type}".

Grade the submission on a scale of 0 to ${maxScore} points based on:
- Completeness: did they capture what a real ${roleLabel(game.role)} would document/do?
- Correctness: is the content accurate and appropriate for the situation?
- Professionalism: clear, specific, properly formatted for the document type.

Be a fair but rigorous grader. A thorough, professional response earns full marks; a vague one-liner earns partial credit; an empty or off-topic response earns little or none. Always return constructive "feedback" (2-4 sentences): what they did well and exactly what a stronger submission would have included. Be encouraging but specific.`;

  const requiredText = required
    ? `REQUIRED ACTION: ${required.title} (${required.action_type})\nWhat was expected: ${required.description}\nMax points: ${maxScore}`
    : `This was a proactive ${submission.action_type} not explicitly required today. Grade it on its own merits out of ${maxScore} points.`;

  const userPrompt = `PROJECT: ${game.project_name} (${projectTypeLabel(game.project_type)})
DAY ${dayContext.day_number} CONTEXT: ${dayContext.summary}

${requiredText}

THE TRAINEE'S SUBMISSION
Title: ${submission.title || "(none)"}
Type: ${submission.action_type}
Content:
"""
${submission.content || "(blank)"}
"""

Grade it now.`;

  const result = await ai().models.generateContent({
    model: "gemini-2.5-flash",
    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          score: { type: Type.NUMBER },
          feedback: { type: Type.STRING },
        },
        required: ["score", "feedback"],
      },
    },
  });

  const parsed = JSON.parse((result.text ?? "").trim() || "{}");
  const score = Math.max(0, Math.min(maxScore, Number(parsed.score) || 0));
  return {
    score: Math.round(score * 10) / 10,
    max_score: maxScore,
    feedback: String(parsed.feedback || "").slice(0, 1500),
  };
}

// ───────────────────────────── Score report ─────────────────────────────

export function letterGrade(pct: number): string {
  if (pct >= 93) return "A";
  if (pct >= 90) return "A-";
  if (pct >= 87) return "B+";
  if (pct >= 83) return "B";
  if (pct >= 80) return "B-";
  if (pct >= 77) return "C+";
  if (pct >= 73) return "C";
  if (pct >= 70) return "C-";
  if (pct >= 60) return "D";
  return "F";
}

export async function generateScoreReport(
  game: GameContext,
  periodKind: ScoringFrequency,
  fromDay: number,
  toDay: number,
  stats: {
    earned: number;
    possible: number;
    requiredCount: number;
    completedCount: number;
    actions: { day_number: number; action_type: string; title: string; score: number; max_score: number }[];
  },
): Promise<{ grade: string; review: string; score: number; max_score: number }> {
  const pct = stats.possible > 0 ? (stats.earned / stats.possible) * 100 : 0;
  const grade = letterGrade(pct);

  const systemInstruction = `You are a construction executive reviewing how a ${roleLabel(
    game.role,
  )} trainee performed on a ${projectTypeLabel(
    game.project_type,
  )} project over a stretch of days. Write a concise performance review (3-5 sentences): call out what they handled well, where points were lost, and one or two concrete things to focus on next. Be direct, constructive, and specific to the role. Do not invent actions they didn't take.`;

  const periodLabel =
    periodKind === "project_end" ? "the entire project" : `days ${fromDay}–${toDay}`;
  const actionsText =
    stats.actions.length > 0
      ? stats.actions
          .map((a) => `- Day ${a.day_number}: ${a.title} (${a.action_type}) — ${a.score}/${a.max_score}`)
          .join("\n")
      : "(no actions were submitted this period)";

  const userPrompt = `PROJECT: ${game.project_name} (${projectTypeLabel(game.project_type)})
Reviewing ${periodLabel} for the ${roleLabel(game.role)}.

Points earned: ${Math.round(stats.earned * 10) / 10} of ${stats.possible} (${Math.round(pct)}%) → grade ${grade}
Required actions this period: ${stats.requiredCount}, completed: ${stats.completedCount}

Submitted actions:
${actionsText}

Write the performance review.`;

  let review = "";
  try {
    const result = await ai().models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: { review: { type: Type.STRING } },
          required: ["review"],
        },
      },
    });
    const parsed = JSON.parse((result.text ?? "").trim() || "{}");
    review = String(parsed.review || "").slice(0, 2000);
  } catch {
    review = "Score report generated. Keep up the steady work and stay on top of the required actions each day.";
  }

  return { grade, review, score: stats.earned, max_score: stats.possible };
}

// ───────────────────────────── Job review (every 4 weeks) ─────────────────────────────

export type JobReviewHighlight = {
  kind: "praise" | "warning" | "missed_submittal" | "missed_rfi" | "tip";
  text: string;
};

export type JobReviewResolution = {
  required_action_id: string;
  action_type: string;
  title: string;
  resolution: string;
};

type CompletedTask = {
  day_number: number;
  week: number;
  action_type: string;
  title: string;
  score: number;
  max_score: number;
};

type MissedTask = {
  required_action_id: string;
  day_number: number;
  week: number;
  action_type: string;
  title: string;
  description: string;
  points: number;
};

/** Action types that represent time-sensitive submittal work. */
const SUBMITTAL_TYPES = new Set(["submittal_review", "submittal"]);
/** Action types that represent asking/answering RFIs. */
const RFI_TYPES = new Set(["rfi"]);

/**
 * Generate the every-four-weeks Job Review for a span of the project. Returns a
 * letter grade, a narrative review that explicitly calls out missed submittals
 * and missed RFIs, structured highlights, and — for every missed required task —
 * a short "resolution" describing how the office quietly caught the project up
 * (submittal approved, scheduling email sent/received, etc.). The resolutions
 * become the auto-completed action content when the player closes out the review.
 */
export async function generateJobReview(
  game: GameContext,
  period: {
    reviewNumber: number;
    fromDay: number;
    toDay: number;
    fromWeek: number;
    toWeek: number;
    isFinal: boolean;
  },
  stats: { earned: number; possible: number; completed: CompletedTask[]; missed: MissedTask[] },
): Promise<{
  grade: string;
  review: string;
  highlights: JobReviewHighlight[];
  resolutions: JobReviewResolution[];
}> {
  const pct = stats.possible > 0 ? (stats.earned / stats.possible) * 100 : 100;
  const grade = letterGrade(pct);

  const missedSubmittals = stats.missed.filter((m) => SUBMITTAL_TYPES.has(m.action_type));
  const missedRfis = stats.missed.filter((m) => RFI_TYPES.has(m.action_type));

  const periodLabel = period.isFinal
    ? `the final stretch (weeks ${period.fromWeek}–${period.toWeek})`
    : `weeks ${period.fromWeek}–${period.toWeek}`;

  const systemInstruction = `You are a construction project executive sitting down with a ${roleLabel(
    game.role,
  )} trainee for their milestone Job Review covering ${periodLabel} of a ${projectTypeLabel(
    game.project_type,
  )} project. Produce:

1. "review": a direct, specific 4-7 sentence performance review of this stretch. Lead with what they handled well, then be candid about what slipped. You MUST explicitly call it out when:
   - submittals were not reviewed/approved on time (this delays fabrication and procurement), and/or
   - an important RFI was never asked when the job clearly needed one (this risks rework or a schedule hit).
   Tie misses to real consequences a ${roleLabel(game.role)} would face. Never break character.
2. "highlights": 3-6 short structured callouts. Each has a "kind":
   - praise            : something they did well
   - warning           : a general risk or slippage
   - missed_submittal  : a submittal that wasn't handled in time
   - missed_rfi        : an important RFI that was never asked
   - tip               : one concrete thing to do better next stretch
   Keep each "text" to one sentence.
3. "resolutions": for EACH missed task listed below (referenced by its missedNum), one or two sentences describing how the back office quietly caught the project up so work can continue — written as real construction activity (e.g. "Submittal 09 91 00 was reviewed and returned Approved as Noted; transmittal logged to the painting sub." or "RFI 022 was issued to the architect and a response was received confirming the revised header detail, then forwarded to the field to keep the schedule."). Reference fabricated but believable submittal numbers, RFI numbers, names, and scheduling emails. Return exactly one resolution per missedNum.`;

  const completedText =
    stats.completed.length > 0
      ? stats.completed
          .map(
            (c) =>
              `- Day ${c.day_number} (wk ${c.week}): ${c.title} [${c.action_type}] — scored ${c.score}/${c.max_score}`,
          )
          .join("\n")
      : "(none completed this period)";

  const missedText =
    stats.missed.length > 0
      ? stats.missed
          .map(
            (m, i) =>
              `Missed ${i + 1} | type=${m.action_type} | worth ${m.points} pts | "${m.title}" — ${m.description}`,
          )
          .join("\n")
      : "(nothing was missed this period)";

  const userPrompt = `PROJECT: ${game.project_name} (${projectTypeLabel(game.project_type)}) in ${game.location}
Reviewing ${periodLabel} for the ${roleLabel(game.role)}.
Period score: ${Math.round(stats.earned * 10) / 10} of ${stats.possible} (${Math.round(pct)}%) → grade ${grade}
Submittal tasks missed: ${missedSubmittals.length}. Important RFI tasks missed: ${missedRfis.length}.

COMPLETED TASKS:
${completedText}

MISSED TASKS (write one resolution per missedNum):
${missedText}

Write the review, highlights, and resolutions now.`;

  let review = "";
  let highlights: JobReviewHighlight[] = [];
  let resolutions: JobReviewResolution[] = [];

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
                  kind: {
                    type: Type.STRING,
                    enum: ["praise", "warning", "missed_submittal", "missed_rfi", "tip"],
                  },
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
        kind: (["praise", "warning", "missed_submittal", "missed_rfi", "tip"].includes(String(h.kind))
          ? h.kind
          : "tip") as JobReviewHighlight["kind"],
        text: String(h.text || "").slice(0, 400),
      }))
      .filter((h: JobReviewHighlight) => h.text)
      .slice(0, 8);

    const byNum = new Map<number, string>();
    for (const r of Array.isArray(parsed.resolutions) ? parsed.resolutions : []) {
      const n = Math.round(Number((r as Record<string, unknown>).missedNum) || 0);
      const text = String((r as Record<string, unknown>).resolution || "").slice(0, 600);
      if (n >= 1 && n <= stats.missed.length && text) byNum.set(n, text);
    }
    resolutions = stats.missed.map((m, i) => ({
      required_action_id: m.required_action_id,
      action_type: m.action_type,
      title: m.title,
      resolution: byNum.get(i + 1) || fallbackResolution(m),
    }));
  } catch {
    review =
      "Milestone review generated. Keep submittals and RFIs moving on time, and stay ahead of the schedule into the next stretch.";
    highlights = [];
    resolutions = stats.missed.map((m) => ({
      required_action_id: m.required_action_id,
      action_type: m.action_type,
      title: m.title,
      resolution: fallbackResolution(m),
    }));
  }

  // Guarantee the headline misses surface even if the model's prose buried them.
  const ensured: JobReviewHighlight[] = [];
  if (missedSubmittals.length && !highlights.some((h) => h.kind === "missed_submittal")) {
    ensured.push({
      kind: "missed_submittal",
      text: `${missedSubmittals.length} submittal ${
        missedSubmittals.length === 1 ? "review was" : "reviews were"
      } not turned around in time this period — that puts fabrication and procurement at risk.`,
    });
  }
  if (missedRfis.length && !highlights.some((h) => h.kind === "missed_rfi")) {
    ensured.push({
      kind: "missed_rfi",
      text: `${missedRfis.length} RFI ${
        missedRfis.length === 1 ? "was" : "were"
      } never asked when the job needed it — unresolved questions like these lead to rework.`,
    });
  }
  highlights = [...ensured, ...highlights];

  return { grade, review, highlights, resolutions };
}

/** Templated catch-up note used when the AI omits a resolution for a missed task. */
function fallbackResolution(m: { action_type: string; title: string }): string {
  switch (m.action_type) {
    case "submittal_review":
    case "submittal":
      return `${m.title} was reviewed and returned Approved as Noted, and the transmittal was logged so fabrication can proceed.`;
    case "rfi":
      return `${m.title} was issued to the design team and a response was received and forwarded to the field.`;
    case "email":
      return `${m.title} was sent and a confirming reply was received so the schedule stays aligned.`;
    case "pay_application":
    case "billing":
      return `${m.title} was prepared, reconciled, and submitted for the period.`;
    case "daily_log":
      return `${m.title} was reconstructed from field notes and filed for the record.`;
    default:
      return `${m.title} was handled by the back office and closed out to keep the project on track.`;
  }
}
