/**
 * Meeting minutes + effectiveness scoring for training-sandbox meetings.
 *
 * When an interactive text meeting (lib/training-meetings.ts) adjourns, the
 * transcript is turned into formal minutes (summary, decisions, action items)
 * and scored against the meeting's hidden checkpoints — the planted "tests"
 * the PM was expected to catch (e.g. the 30-day slab-pour milestone). Both are
 * persisted to training_meeting_minutes (migration 174) by the minutes API
 * route so the meeting hyperlink and the phase Job Review can reopen them.
 *
 * Gemini does the writing/scoring; without GEMINI_API_KEY (or on any failure)
 * a deterministic fallback assembles serviceable minutes and scores each
 * checkpoint by keyword match against the PM's turns.
 */

import { GoogleGenAI, Type } from "@google/genai";
import {
  bidTabText,
  type TrainingMeeting,
  type MeetingTurn,
} from "@/lib/training-meetings";

export type CheckpointResult = {
  id: string;
  title: string;
  expectation: string;
  caught: boolean;
  /** One sentence on how the PM handled (or missed) it. */
  note: string;
};

export type MinutesContent = {
  summary: string;
  decisions: string[];
  actionItems: string[];
};

export type GeneratedMinutes = {
  minutes: MinutesContent;
  checkpoints: CheckpointResult[];
  scoreCaught: number;
  scoreTotal: number;
};

const MAX_TURN_CHARS = 2000;

function clip(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + "…" : text;
}

/** Keyword heuristic used when Gemini is unavailable. */
function keywordScore(meeting: TrainingMeeting, transcript: MeetingTurn[]): CheckpointResult[] {
  const pmText = transcript
    .filter((t) => t.speaker === "user")
    .map((t) => t.text.toLowerCase())
    .join("\n");
  return meeting.checkpoints.map((c) => {
    const caught = c.keywords.some((k) => pmText.includes(k.toLowerCase()));
    return {
      id: c.id,
      title: c.title,
      expectation: c.expectation,
      caught,
      note: caught
        ? "The PM addressed this during the meeting."
        : "The PM did not address this during the meeting.",
    };
  });
}

/** Deterministic minutes used when Gemini is unavailable. */
function fallbackMinutes(meeting: TrainingMeeting, transcript: MeetingTurn[]): MinutesContent {
  const pmTurns = transcript.filter((t) => t.speaker === "user");
  return {
    summary:
      `The ${meeting.title} meeting was held with ${meeting.speakers
        .map((s) => `${s.name} (${s.title})`)
        .join(", ")} and the project manager. ` +
      `The team worked through the full agenda: ${meeting.agenda.map((a) => a.title.toLowerCase()).join("; ")}. ` +
      `The PM contributed ${pmTurns.length} response${pmTurns.length === 1 ? "" : "s"} and the meeting adjourned with the ${meeting.deliverable.toLowerCase()} agreed.`,
    decisions: pmTurns.slice(-3).map((t) => clip(t.text, 240)),
    actionItems: meeting.agenda[meeting.agenda.length - 1].points.slice(0, 4),
  };
}

function normalizeResult(
  meeting: TrainingMeeting,
  raw: { id?: string; caught?: boolean; note?: string }[],
): CheckpointResult[] | null {
  const results: CheckpointResult[] = [];
  for (const c of meeting.checkpoints) {
    const hit = raw.find((r) => r.id === c.id);
    if (!hit) return null; // model skipped a checkpoint — fall back entirely
    results.push({
      id: c.id,
      title: c.title,
      expectation: c.expectation,
      caught: !!hit.caught,
      note: clip((hit.note ?? "").trim(), 400) || (hit.caught ? "Caught." : "Missed."),
    });
  }
  return results;
}

/**
 * Generates minutes + checkpoint scoring for a completed meeting. Never
 * throws — degrades to the deterministic fallback.
 */
export async function generateMeetingMinutes(opts: {
  meeting: TrainingMeeting;
  transcript: MeetingTurn[];
  projectName: string;
  traineeName: string;
}): Promise<GeneratedMinutes> {
  const { meeting, transcript } = opts;

  const fallback = (): GeneratedMinutes => {
    const checkpoints = keywordScore(meeting, transcript);
    return {
      minutes: fallbackMinutes(meeting, transcript),
      checkpoints,
      scoreCaught: checkpoints.filter((c) => c.caught).length,
      scoreTotal: checkpoints.length,
    };
  };

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return fallback();

  const transcriptBlock = transcript
    .map((t) => {
      const who =
        t.speaker === "user"
          ? `${opts.traineeName || "PM"} (the project manager — the person being scored)`
          : meeting.speakers.find((s) => s.key === t.speaker)?.name ?? t.speaker;
      return `${who}: ${clip(t.text, MAX_TURN_CHARS)}`;
    })
    .join("\n\n");

  const checkpointBlock = meeting.checkpoints
    .map((c) => `- id "${c.id}": ${c.title}. Caught means: ${c.expectation}`)
    .join("\n");

  const systemInstruction = `You are the minute-taker for a general contractor's "${meeting.title}" meeting on the project "${opts.projectName}". Attendees: ${meeting.speakers
    .map((s) => `${s.name} (${s.title})`)
    .join(", ")}, plus the project manager. Produce two things from the transcript:

1. FORMAL MINUTES — a concise summary paragraph (3-6 sentences), the concrete decisions made (one per line, e.g. short-list picks by trade), and the action items with owners where stated.

2. CHECKPOINT SCORING — the meeting contained planted tests the PM was expected to catch. For each checkpoint decide, strictly from the transcript, whether the PM caught it (raised it, acted on it, or made the safe call it points at). Give a one-sentence note quoting or paraphrasing the PM's handling — or stating what they missed.

CHECKPOINTS:
${checkpointBlock}

BID TAB (reference facts):
${bidTabText()}

Rules:
- Score only on what the PM actually said. Attendees mentioning a risk does not count as the PM catching it.
- Be fair but strict: a vague "sounds good" after the team's recommendation is weaker than the PM naming the risk — but accepting a recommendation that resolves the risk still counts as caught.
- Return every checkpoint id exactly once.`;

  const userPrompt = `=== MEETING TRANSCRIPT (oldest first) ===
${transcriptBlock}

Produce the minutes and checkpoint scoring now.`;

  try {
    const ai = new GoogleGenAI({ apiKey });
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING, description: "Minutes summary paragraph." },
            decisions: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Concrete decisions made, one per entry.",
            },
            actionItems: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Action items, with owners where stated.",
            },
            checkpoints: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: {
                    type: Type.STRING,
                    enum: meeting.checkpoints.map((c) => c.id),
                  },
                  caught: { type: Type.BOOLEAN },
                  note: { type: Type.STRING },
                },
                required: ["id", "caught", "note"],
              },
            },
          },
          required: ["summary", "decisions", "actionItems", "checkpoints"],
        },
      },
    });

    const parsed = JSON.parse((result.text ?? "").trim() || "{}") as {
      summary?: string;
      decisions?: string[];
      actionItems?: string[];
      checkpoints?: { id?: string; caught?: boolean; note?: string }[];
    };
    const summary = (parsed.summary ?? "").trim();
    const checkpoints = normalizeResult(meeting, parsed.checkpoints ?? []);
    if (!summary || !checkpoints) return fallback();

    return {
      minutes: {
        summary: clip(summary, 3000),
        decisions: (parsed.decisions ?? []).map((d) => clip(String(d), 400)).slice(0, 15),
        actionItems: (parsed.actionItems ?? []).map((a) => clip(String(a), 400)).slice(0, 15),
      },
      checkpoints,
      scoreCaught: checkpoints.filter((c) => c.caught).length,
      scoreTotal: checkpoints.length,
    };
  } catch {
    return fallback();
  }
}
