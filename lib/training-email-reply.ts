/**
 * Gemini-generated counterparty replies for "SiteCommand Training" sandboxes.
 *
 * Sandbox emails never touch a real mailbox — when the trainee emails one of
 * the fake people in the project Directory (or follows up in a seeded thread),
 * the counterparty's response is synthesized here. The generator grounds the
 * reply in who the counterparty is (directory company/title, sub-roster trade
 * and bid), the project, and the full thread so far, so responses read like a
 * real construction correspondent rather than a canned acknowledgement.
 *
 * Degrades gracefully: with no GEMINI_API_KEY (or on any API failure) it
 * returns null and callers fall back to the canned reply in
 * lib/training-emails.ts.
 */

import { GoogleGenAI, Type } from "@google/genai";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ThreadMessage } from "@/lib/email-types";
import { messagePlainText } from "@/lib/email-messages";
import { TRAINING_SUBS, subEmailFor, firstNameOf } from "@/lib/training-emails";

const MAX_HISTORY_MESSAGES = 12;
const MAX_MESSAGE_CHARS = 2500;

export type TrainingCounterparty = {
  name: string;
  email: string;
  company?: string;
  jobTitle?: string;
  phone?: string;
};

function clip(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + "…" : text;
}

/** Escape text for safe interpolation into the stored HTML body. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Plain reply text (blank-line paragraphs) → simple stored HTML. */
function textToHtml(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((p) => `<p>${escapeHtml(p.trim()).replace(/\n/g, "<br/>")}</p>`)
    .filter((p) => p !== "<p></p>")
    .join("\n\n");
}

/**
 * Resolves what the sandbox knows about a counterparty: their Directory
 * contact (company, title, phone) and, when they're one of the seeded
 * subcontractors, their trade and bid number.
 */
export async function lookupTrainingCounterparty(
  supabase: SupabaseClient,
  projectId: string,
  email: string,
): Promise<TrainingCounterparty | null> {
  const addr = email.trim().toLowerCase();
  if (!addr) return null;

  const { data } = await supabase
    .from("directory_contacts")
    .select("first_name, last_name, email, company, job_title, phone")
    .eq("project_id", projectId)
    .ilike("email", addr)
    .maybeSingle();

  if (!data) return null;
  return {
    name: [data.first_name, data.last_name].filter(Boolean).join(" ").trim() || addr,
    email: (data.email as string) || addr,
    company: (data.company as string) || undefined,
    jobTitle: (data.job_title as string) || undefined,
    phone: (data.phone as string) || undefined,
  };
}

/**
 * Generates the counterparty's reply for a sandbox email thread. Returns null
 * when Gemini is not configured or the request fails — callers fall back to
 * the canned reply.
 */
export async function generateTrainingCounterpartyReply(opts: {
  /** Project name + type for grounding (e.g. "Training: Data Center"). */
  projectName: string;
  projectType?: string | null;
  counterparty: TrainingCounterparty;
  /** The trainee (PM) the counterparty is writing back to. */
  traineeName: string;
  traineeEmail: string;
  threadSubject: string;
  /** Full thread so far, oldest first, INCLUDING the trainee's latest message. */
  history: ThreadMessage[];
  /**
   * True when the counterparty went quiet and is only now answering after
   * being chased (the "slow sub" scenario) — the reply should open with an
   * apology for the delay.
   */
  lateFirstResponse: boolean;
}): Promise<{ html: string; text: string } | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const { counterparty, traineeName, traineeEmail } = opts;
  const pmFirst = firstNameOf(traineeName, "there");

  // Seeded-sub enrichment: trade + bid so the reply can talk real numbers.
  const sub = TRAINING_SUBS.find(
    (s) => subEmailFor(s).toLowerCase() === counterparty.email.toLowerCase(),
  );

  const meAddr = traineeEmail.toLowerCase();
  const transcript = opts.history
    .slice(-MAX_HISTORY_MESSAGES)
    .map((m) => {
      const who =
        m.from.address.toLowerCase() === meAddr
          ? `${traineeName} (the project manager — the person you are replying to)`
          : m.from.name || m.from.address;
      return `--- From: ${who}${m.date ? ` | ${m.date}` : ""} ---\n${clip(messagePlainText(m), MAX_MESSAGE_CHARS)}`;
    })
    .join("\n\n");

  const personaLines = [
    `Name: ${counterparty.name}`,
    counterparty.jobTitle ? `Role/title: ${counterparty.jobTitle}` : null,
    counterparty.company ? `Company: ${counterparty.company}` : null,
    sub ? `Trade/scope on this project: ${sub.trade}` : null,
    sub ? `Your firm's lump-sum bid for that scope: $${sub.bid.toLocaleString("en-US")}` : null,
    counterparty.phone ? `Phone: ${counterparty.phone}` : null,
  ].filter(Boolean);

  const systemInstruction = `You are role-playing a construction industry professional inside a project-management training simulation. The trainee is a general contractor's project manager; you are one of their project contacts. Write the email reply your character would realistically send.

YOUR CHARACTER:
${personaLines.join("\n")}

PROJECT: ${opts.projectName}${opts.projectType ? ` (${opts.projectType})` : ""}

Rules:
- Reply as ${counterparty.name} writing to ${pmFirst}. Stay fully in character; never mention being an AI, a simulation, or training.
- Write a realistic, useful business email: answer what was asked, give plausible specifics (pricing, lead times, dates, scope notes) consistent with your role and anything already stated in the thread. Stay consistent with facts already in the conversation; invent reasonable detail only where none exists.
- Keep it concise — 2 to 5 short paragraphs, plain text (blank line between paragraphs, no markdown, no subject line).
- Open with a natural greeting (e.g. "Hi ${pmFirst},") and sign off with your first name${counterparty.company ? " and company" : ""}.
- Match the tone of a busy ${counterparty.jobTitle || "industry professional"}: professional, direct, occasionally informal.${
    opts.lateFirstResponse
      ? `\n- You went quiet and are only now answering after the PM chased you — open with a brief apology for the slow response before getting to substance.`
      : ""
  }`;

  const userPrompt = `=== EMAIL THREAD (oldest first) ===
Subject: ${opts.threadSubject || "(no subject)"}

${transcript || "(no prior messages)"}

Write ${counterparty.name}'s reply to the latest message now.`;

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
            reply: {
              type: Type.STRING,
              description: "The plain-text body of the reply email, paragraphs separated by blank lines.",
            },
          },
          required: ["reply"],
        },
      },
    });
    const parsed = JSON.parse((result.text ?? "").trim() || "{}") as { reply?: string };
    const text = (parsed.reply ?? "").trim();
    if (!text) return null;
    return { html: textToHtml(text), text };
  } catch {
    return null;
  }
}
