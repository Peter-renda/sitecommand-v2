/**
 * Interactive text meeting for a "SiteCommand Training" sandbox.
 *
 * POST /api/projects/[id]/training/meetings/[meetingId] — body
 * { transcript: [{ speaker, text }], agendaIndex } → the attendees' next turns:
 * { turns: [{ speaker, text }], agendaIndex, done }.
 *
 * An empty transcript returns the meeting's deterministic opening (no LLM
 * call). After that, each PM message gets the attendees' continuation from
 * Gemini, grounded in the personas, the agenda, and the bid-tab facts defined
 * in lib/training-meetings.ts. The attendees stick to the agenda; if the PM
 * asks something off-script they answer the aside in character and steer back.
 *
 * Degrades gracefully: with no GEMINI_API_KEY (or on any API failure) a canned
 * facilitator turn advances the agenda one item per PM message, so the meeting
 * still runs end to end.
 */

import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";
import { getSession } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";
import { canAccessProject } from "@/lib/project-access";
import { projectTypeLabel } from "@/lib/simulation-constants";
import {
  getTrainingMeeting,
  bidTabText,
  type TrainingMeeting,
  type MeetingTurn,
} from "@/lib/training-meetings";
import { firstNameOf } from "@/lib/training-emails";

export const maxDuration = 60;

const MAX_TRANSCRIPT_TURNS = 60;
const MAX_TURN_CHARS = 2000;

function clip(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + "…" : text;
}

/** Validate/normalize the transcript coming from the client. */
function normalizeTranscript(meeting: TrainingMeeting, raw: unknown): MeetingTurn[] {
  if (!Array.isArray(raw)) return [];
  const validKeys = new Set(["user", ...meeting.speakers.map((s) => s.key)]);
  return raw
    .filter(
      (t): t is { speaker: string; text: string } =>
        !!t &&
        typeof t === "object" &&
        typeof (t as { speaker?: unknown }).speaker === "string" &&
        typeof (t as { text?: unknown }).text === "string" &&
        validKeys.has((t as { speaker: string }).speaker),
    )
    .slice(-MAX_TRANSCRIPT_TURNS)
    .map((t) => ({ speaker: t.speaker, text: clip(t.text.trim(), MAX_TURN_CHARS) }))
    .filter((t) => t.text.length > 0);
}

/**
 * Canned continuation used when Gemini is unavailable: the facilitator presents
 * the next agenda item's points and hands back to the PM; past the last item
 * the meeting wraps.
 */
function fallbackTurns(
  meeting: TrainingMeeting,
  agendaIndex: number,
): { turns: MeetingTurn[]; agendaIndex: number; done: boolean } {
  const facilitator = meeting.speakers[0];
  const next = agendaIndex + 1;
  if (next >= meeting.agenda.length) {
    return {
      turns: [
        {
          speaker: facilitator.key,
          text: `Good — I think that covers the agenda. To recap: ${meeting.agenda[meeting.agenda.length - 1].points[0]} We'll get the ${meeting.deliverable.toLowerCase()} written up and distributed today. Thanks everyone — meeting adjourned.`,
        },
      ],
      agendaIndex: meeting.agenda.length - 1,
      done: true,
    };
  }
  const item = meeting.agenda[next];
  // Surface any planted checkpoint clues that belong to this agenda item and
  // aren't already carried by the item's points (the hidden tests still need
  // to reach the trainee when Gemini is unavailable).
  const plantedLines = meeting.checkpoints
    .filter((c) => c.plantAgendaIndex === next && c.fallbackLine)
    .map((c) => c.fallbackLine as string);
  return {
    turns: [
      {
        speaker: facilitator.key,
        text: `Noted. Let's move to the next item — ${item.title.toLowerCase()}. ${item.points.join(" ")}${
          plantedLines.length > 0 ? ` ${plantedLines.join(" ")}` : ""
        } What are your thoughts?`,
      },
    ],
    agendaIndex: next,
    done: false,
  };
}

async function generateTurns(opts: {
  meeting: TrainingMeeting;
  transcript: MeetingTurn[];
  agendaIndex: number;
  projectName: string;
  projectType: string | null;
  traineeName: string;
}): Promise<{ turns: MeetingTurn[]; agendaIndex: number; done: boolean } | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const { meeting, transcript } = opts;
  const pmFirst = firstNameOf(opts.traineeName, "the PM");
  const speakerKeys = meeting.speakers.map((s) => s.key);

  const personaBlock = meeting.speakers
    .map((s) => `- key "${s.key}": ${s.name}, ${s.title}. ${s.style}`)
    .join("\n");

  const agendaBlock = meeting.agenda
    .map(
      (item, i) =>
        `${i + 1}. ${item.title}\n${item.points.map((p) => `   - ${p}`).join("\n")}`,
    )
    .join("\n");

  // Hidden tests: the attendees must surface each clue naturally (per its
  // plant instruction) but never resolve it for the PM — the trainee is
  // scored afterward on which ones they caught.
  const checkpointBlock = meeting.checkpoints
    .map((c, i) => `${i + 1}. (during agenda item ${c.plantAgendaIndex + 1}) ${c.plant}`)
    .join("\n");

  const transcriptBlock = transcript
    .map((t) => {
      const who =
        t.speaker === "user"
          ? `${opts.traineeName || "PM"} (the project manager — the trainee)`
          : meeting.speakers.find((s) => s.key === t.speaker)?.name ?? t.speaker;
      return `${who}: ${t.text}`;
    })
    .join("\n\n");

  const systemInstruction = `You are role-playing a general contractor's preconstruction team inside a project-management training simulation, in a live meeting titled "${meeting.title}" on the project "${opts.projectName}"${opts.projectType ? ` (${projectTypeLabel(opts.projectType)})` : ""}. The trainee is the project manager, ${pmFirst} — they just spoke, and you produce the attendees' next turns.

ATTENDEES YOU SPEAK FOR (never speak for the PM):
${personaBlock}

MEETING OBJECTIVE: ${meeting.objective}
DELIVERABLE: ${meeting.deliverable}

AGENDA (follow in order; you are currently on item ${opts.agendaIndex + 1}):
${agendaBlock}

BID TAB — the facts everyone works from (stay consistent with these numbers; invent plausible detail only where none exists):
${bidTabText()}

HIDDEN TESTS — the PM is being evaluated on whether they catch these. Surface each clue naturally at its agenda item, exactly as instructed; NEVER resolve one for the PM, never hint that it's a test, and never volunteer the fix unless the PM raises it first:
${checkpointBlock}

RULES:
- Return 1 to 3 short turns, each attributed to one attendee key. Vary who speaks based on who would naturally answer (Rachel for numbers, Marcus for strategy/risk, David to run the meeting).
- Each turn is 1-3 sentences of natural spoken meeting dialogue — no markdown, no stage directions, no email formatting.
- ALWAYS end your last turn by handing the floor to ${pmFirst} with a question or a request for a decision — unless the meeting is finished (done=true), in which case the facilitator closes with a brief recap of the short-list and action items.
- Stick to the agenda. Work through the current item; advance agendaIndex only when the item has been covered AND the PM has had a chance to weigh in. Do not skip items.
- If the PM says something off-agenda, have the right attendee answer the aside briefly, in character, then steer back to the current agenda item in the same response.
- If the PM makes a short-list call the team disagrees with (e.g. picking a flagged low bidder), push back once with the specific risk — but the PM owns the final decision; record it and move on.
- Stay fully in character; never mention being an AI, a simulation, or training.
- Set done=true only after the final agenda item (action items & award targets) is wrapped and the PM has confirmed next steps.`;

  const userPrompt = `=== MEETING TRANSCRIPT SO FAR (oldest first) ===
${transcriptBlock || "(meeting just started)"}

Produce the attendees' next turns now.`;

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
            turns: {
              type: Type.ARRAY,
              description: "The attendees' next 1-3 spoken turns, in order.",
              items: {
                type: Type.OBJECT,
                properties: {
                  speaker: {
                    type: Type.STRING,
                    enum: speakerKeys,
                    description: "The attendee key speaking this turn.",
                  },
                  text: { type: Type.STRING, description: "What they say, plain spoken text." },
                },
                required: ["speaker", "text"],
              },
            },
            agendaIndex: {
              type: Type.INTEGER,
              description: `0-based index of the agenda item in play after these turns (0-${meeting.agenda.length - 1}).`,
            },
            done: {
              type: Type.BOOLEAN,
              description: "True only when the meeting is finished and adjourned.",
            },
          },
          required: ["turns", "agendaIndex", "done"],
        },
      },
    });

    const parsed = JSON.parse((result.text ?? "").trim() || "{}") as {
      turns?: { speaker?: string; text?: string }[];
      agendaIndex?: number;
      done?: boolean;
    };
    const validKeys = new Set(speakerKeys);
    const turns = (parsed.turns ?? [])
      .filter((t) => typeof t.speaker === "string" && validKeys.has(t.speaker))
      .map((t) => ({ speaker: t.speaker as string, text: clip((t.text ?? "").trim(), MAX_TURN_CHARS) }))
      .filter((t) => t.text.length > 0)
      .slice(0, 4);
    if (turns.length === 0) return null;

    // The agenda only ever moves forward, bounded to the real item range.
    const rawIdx = Number(parsed.agendaIndex);
    const agendaIndex = Math.min(
      meeting.agenda.length - 1,
      Math.max(opts.agendaIndex, Number.isFinite(rawIdx) ? Math.trunc(rawIdx) : opts.agendaIndex),
    );
    return { turns, agendaIndex, done: !!parsed.done };
  } catch {
    return null;
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; meetingId: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId, meetingId } = await params;

  if (!(await canAccessProject(projectId, session))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const meeting = getTrainingMeeting(meetingId);
  if (!meeting) return NextResponse.json({ error: "Unknown meeting" }, { status: 404 });

  const supabase = getSupabase();
  const { data: project } = await supabase
    .from("projects")
    .select("is_training, training_role, training_project_type, name")
    .eq("id", projectId)
    .maybeSingle();

  if (!project || !project.is_training) {
    return NextResponse.json({ error: "Not a training project" }, { status: 404 });
  }
  if (project.training_role !== meeting.role) {
    return NextResponse.json({ error: "Meeting not available for this role" }, { status: 404 });
  }

  let body: { transcript?: unknown; agendaIndex?: unknown };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const transcript = normalizeTranscript(meeting, body.transcript);
  const rawIdx = Number(body.agendaIndex);
  const agendaIndex = Math.min(
    meeting.agenda.length - 1,
    Math.max(0, Number.isFinite(rawIdx) ? Math.trunc(rawIdx) : 0),
  );

  // Fresh meeting → serve the deterministic opening, no LLM call.
  if (transcript.length === 0) {
    return NextResponse.json({ turns: meeting.opening, agendaIndex: 0, done: false });
  }

  // The PM must have spoken last for the attendees to continue.
  if (transcript[transcript.length - 1].speaker !== "user") {
    return NextResponse.json({ error: "It's the PM's turn to speak" }, { status: 400 });
  }

  // Trainee name for grounding.
  const { data: user } = await supabase
    .from("users")
    .select("first_name, last_name, username")
    .eq("id", session.id)
    .maybeSingle();
  const traineeName =
    [user?.first_name, user?.last_name].filter(Boolean).join(" ").trim() ||
    user?.username ||
    "";

  const generated = await generateTurns({
    meeting,
    transcript,
    agendaIndex,
    projectName: project.name ?? "Training Project",
    projectType: project.training_project_type,
    traineeName,
  });

  return NextResponse.json(generated ?? fallbackTurns(meeting, agendaIndex));
}
