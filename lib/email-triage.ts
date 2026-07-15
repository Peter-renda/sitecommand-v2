/**
 * AI suggestion engine for the Emails page "New Emails" triage box.
 *
 * Given the text of an inbox email thread, this looks at the project's open
 * records (RFIs, submittals, existing tasks) and asks Gemini to propose
 * executable actions the user can tick while linking the email to the project:
 *   - "rfi_comment" : add the email as a response/comment on a specific RFI
 *   - "create_task" : create a project task from an action item in the email
 *
 * Suggestions are advisory — execution happens in
 * `POST /api/projects/[id]/emails/triage/link`, which re-validates every
 * action against the project before writing anything.
 */

import { GoogleGenAI, Type } from "@google/genai";
import type { getSupabase } from "@/lib/supabase";

type Supa = ReturnType<typeof getSupabase>;

export type TriageSuggestion = {
  /** Client-side key — also echoed back in link results. */
  id: string;
  type: "rfi_comment" | "create_task";
  /** Short checkbox label, e.g. `Add to RFI #4 — Window head detail`. */
  label: string;
  /** One-sentence grounding for why this action is suggested. */
  reason: string;
  // rfi_comment
  rfiId?: string;
  rfiNumber?: number;
  // create_task
  taskTitle?: string;
  taskDescription?: string;
  taskDueDate?: string | null;
};

const MAX_SUGGESTIONS = 4;
const MAX_EMAIL_CHARS = 8000;
const PER_TABLE_LIMIT = 50;

type RfiRow = { id: string; rfi_number: number; subject: string | null; question: string | null; status: string };

function clip(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + "…" : text;
}

/**
 * Proposes triage actions for one email. Returns an empty list when the AI is
 * not configured, the email has no actionable content, or the request fails —
 * the triage card degrades to a plain link/decline card in all of those cases.
 */
export async function suggestEmailTriageActions(
  supabase: Supa,
  projectId: string,
  email: { subject: string; from: string; receivedAt?: string; text: string },
): Promise<TriageSuggestion[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return [];

  const [rfisRes, submittalsRes, tasksRes] = await Promise.all([
    supabase
      .from("rfis")
      .select("id, rfi_number, subject, question, status")
      .eq("project_id", projectId)
      .order("rfi_number", { ascending: false })
      .limit(PER_TABLE_LIMIT),
    supabase
      .from("submittals")
      .select("submittal_number, title, status, submittal_type")
      .eq("project_id", projectId)
      .order("submittal_number", { ascending: false })
      .limit(PER_TABLE_LIMIT),
    supabase
      .from("tasks")
      .select("task_number, title, status")
      .eq("project_id", projectId)
      .order("task_number", { ascending: false })
      .limit(PER_TABLE_LIMIT),
  ]);

  const rfis = (rfisRes.data ?? []) as RfiRow[];
  const rfiByNumber = new Map(rfis.map((r) => [r.rfi_number, r]));

  const rfiContext = rfis
    .map((r) => `- RFI #${r.rfi_number} [${r.status}] ${r.subject ?? "(no subject)"}${r.question ? ` — Q: ${clip(r.question, 300)}` : ""}`)
    .join("\n");
  const submittalContext = (submittalsRes.data ?? [])
    .map((s) => `- Submittal #${s.submittal_number} [${s.status}] ${s.title}${s.submittal_type ? ` (${s.submittal_type})` : ""}`)
    .join("\n");
  const taskContext = (tasksRes.data ?? [])
    .filter((t) => t.status !== "closed" && t.status !== "void")
    .map((t) => `- Task #${t.task_number} [${t.status}] ${t.title}`)
    .join("\n");

  const today = new Date().toISOString().split("T")[0];

  const systemInstruction = `You are SiteCommand's email triage assistant for a construction project. A user is reviewing an inbox email before linking it to the project. Propose the concrete follow-up actions SiteCommand can run automatically when the user links the email.

Available action types:
- "rfi_comment": the email contains information directly relevant to one of the project's RFIs (an answer, clarification, schedule/cost impact, or follow-up). Set rfiNumber to that RFI's number. The email text will be added as a comment on the RFI.
- "create_task": the email asks the team to do something or implies a clear, discrete action item. Provide taskTitle (imperative, ≤ 90 chars), taskDescription (1–3 sentences of context from the email), and taskDueDate (YYYY-MM-DD, only when the email states or strongly implies a deadline on/after ${today}; otherwise null).

Hard rules:
- Propose at most ${MAX_SUGGESTIONS} actions. Most emails warrant zero or one — only suggest actions clearly grounded in the email text. If nothing applies, return an empty list.
- Only reference RFI numbers that appear in the PROJECT RFIS list. Prefer open RFIs; never suggest commenting on a closed RFI unless the email explicitly reopens the topic.
- Do not suggest a task that duplicates an EXISTING TASK.
- "label" is the short checkbox text shown to the user, e.g. 'Add to RFI #4 — Window head detail' or 'Create task "Order roof curbs"'.
- "reason" is one short sentence citing what in the email grounds the action.
- Never invent records, people, dates, or facts.`;

  const userPrompt = `=== EMAIL BEING REVIEWED ===
From: ${email.from || "(unknown)"}
Subject: ${email.subject || "(no subject)"}
${email.receivedAt ? `Received: ${email.receivedAt}\n` : ""}
${clip(email.text || "(no body)", MAX_EMAIL_CHARS)}

=== PROJECT RFIS ===
${rfiContext || "(none)"}

=== PROJECT SUBMITTALS (context only) ===
${submittalContext || "(none)"}

=== EXISTING TASKS (do not duplicate) ===
${taskContext || "(none)"}

Propose the actions now.`;

  type RawAction = {
    type: string;
    rfiNumber: number | null;
    label: string;
    reason: string;
    taskTitle: string | null;
    taskDescription: string | null;
    taskDueDate: string | null;
  };

  let parsed: { actions?: RawAction[] };
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
            actions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  type: { type: Type.STRING, enum: ["rfi_comment", "create_task"] },
                  rfiNumber: { type: Type.NUMBER, nullable: true },
                  label: { type: Type.STRING },
                  reason: { type: Type.STRING },
                  taskTitle: { type: Type.STRING, nullable: true },
                  taskDescription: { type: Type.STRING, nullable: true },
                  taskDueDate: { type: Type.STRING, nullable: true },
                },
                required: ["type", "label", "reason"],
              },
            },
          },
          required: ["actions"],
        },
      },
    });
    parsed = JSON.parse((result.text ?? "").trim() || "{}");
  } catch {
    return [];
  }

  const suggestions: TriageSuggestion[] = [];
  const seenRfiIds = new Set<string>();

  for (const raw of Array.isArray(parsed.actions) ? parsed.actions : []) {
    if (suggestions.length >= MAX_SUGGESTIONS) break;
    const label = (raw.label ?? "").trim();
    const reason = (raw.reason ?? "").trim();
    if (!label) continue;

    if (raw.type === "rfi_comment") {
      const rfi = typeof raw.rfiNumber === "number" ? rfiByNumber.get(raw.rfiNumber) : undefined;
      if (!rfi || seenRfiIds.has(rfi.id)) continue;
      seenRfiIds.add(rfi.id);
      suggestions.push({
        id: `rfi-${rfi.id}`,
        type: "rfi_comment",
        label: label || `Add to RFI #${rfi.rfi_number} — ${rfi.subject ?? ""}`,
        reason,
        rfiId: rfi.id,
        rfiNumber: rfi.rfi_number,
      });
    } else if (raw.type === "create_task") {
      const taskTitle = (raw.taskTitle ?? "").trim();
      if (!taskTitle) continue;
      const due =
        typeof raw.taskDueDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.taskDueDate)
          ? raw.taskDueDate
          : null;
      suggestions.push({
        id: `task-${suggestions.length}-${taskTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}`,
        type: "create_task",
        label,
        reason,
        taskTitle: taskTitle.slice(0, 200),
        taskDescription: (raw.taskDescription ?? "").trim().slice(0, 2000) || undefined,
        taskDueDate: due,
      });
    }
  }

  return suggestions;
}
