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

function letterGrade(pct: number): string {
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
