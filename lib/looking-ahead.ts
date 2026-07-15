/**
 * Shared generator for AI "Looking Ahead" briefing notes on the Assist page.
 *
 * Studies where a project currently sits — its plans/drawings, specs, contracts
 * and commitments, recent emails, schedule position, open RFIs/submittals,
 * meetings, daily logs — and asks Gemini to write a short list of things the
 * team should KNOW / REMEMBER right now given the stage of work. These are
 * informational facts to commit to memory (installed quantities, delivery
 * delays a supplier mentioned, design clarifications, contract values, upcoming
 * inspections), NOT action items — actionable to-dos live in the Tasks tool.
 *
 * New notes are deduped against everything already surfaced for the project
 * (any status) so the daily cron never repeats a note the user has already seen,
 * pinned, or dismissed.
 *
 * Used by both the daily cron (`/api/cron/looking-ahead`) and the manual
 * "Refresh" action (`POST /api/projects/[id]/looking-ahead`).
 */

import { GoogleGenAI, Type } from "@google/genai";
import { getSupabase } from "@/lib/supabase";
import { getCompanyBestPracticesText } from "@/lib/company-best-practices";

type Supa = ReturnType<typeof getSupabase>;
type Row = Record<string, unknown>;

const PER_TABLE_LIMIT = 40;
const MAX_VALUE_CHARS = 900;
const MAX_EMAIL_BODY_CHARS = 2500;
const MAX_EMAIL_BLOCK_CHARS = 120_000;

// Keep the Looking Ahead section focused. We stop generating once a project
// already has this many actionable (pending, non-snoozed) notes, and never
// insert more than MAX_NEW_PER_RUN at a time.
const MAX_ACTIVE_NOTES = 10;
const MAX_NEW_PER_RUN = 6;

const NOTE_CATEGORIES = [
  "Schedule",
  "Procurement",
  "Quantities",
  "Design",
  "Contract",
  "Coordination",
  "Inspection",
  "Safety",
  "Closeout",
  "Miscellaneous",
];

// Tables serialized generically into the project context. Kept lean for speed
// since this runs across every active project on a daily cron.
const TABLES: Array<{ label: string; table: string }> = [
  { label: "Drawings / Plans", table: "project_drawings" },
  { label: "Specifications", table: "project_specifications" },
  { label: "Commitments (Contracts)", table: "commitments" },
  { label: "Open RFIs", table: "rfis" },
  { label: "Submittals", table: "submittals" },
  { label: "Submittal Packages", table: "submittal_packages" },
  { label: "Meetings", table: "meetings" },
  { label: "Daily Logs", table: "daily_logs" },
  { label: "Project Schedules", table: "project_schedules" },
  { label: "Change Events", table: "change_events" },
  { label: "Change Orders", table: "change_orders" },
  { label: "Punch List", table: "punch_list_items" },
  { label: "Transmittals", table: "transmittals" },
];

const SKIP_KEYS = new Set([
  "id",
  "project_id",
  "company_id",
  "created_by",
  "updated_by",
  "user_id",
  "storage_path",
  "url",
  "file_url",
  "page_image_path",
  "attachments",
]);

function stringify(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    return trimmed.length > MAX_VALUE_CHARS ? trimmed.slice(0, MAX_VALUE_CHARS) + "…" : trimmed;
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value) || typeof value === "object") {
    try {
      const json = JSON.stringify(value);
      if (json === "{}" || json === "[]" || json === "null") return null;
      return json.length > MAX_VALUE_CHARS ? json.slice(0, MAX_VALUE_CHARS) + "…" : json;
    } catch {
      return null;
    }
  }
  return null;
}

function serializeRow(row: Row): string {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(row)) {
    if (SKIP_KEYS.has(key)) continue;
    const v = stringify(value);
    if (v === null) continue;
    lines.push(`  ${key}: ${v}`);
  }
  return lines.join("\n");
}

async function fetchTable(supabase: Supa, table: string, projectId: string): Promise<Row[]> {
  try {
    const { data, error } = await supabase.from(table).select("*").eq("project_id", projectId).limit(PER_TABLE_LIMIT);
    if (error) return [];
    return (data ?? []) as Row[];
  } catch {
    return [];
  }
}

function buildTableContext(blocks: Array<{ label: string; rows: Row[] }>): string {
  const parts: string[] = [];
  for (const { label, rows } of blocks) {
    if (!rows.length) continue;
    parts.push(`### ${label} (${rows.length})`);
    rows.forEach((row, i) => {
      const body = serializeRow(row);
      if (body) parts.push(`- Record ${i + 1}:\n${body}`);
    });
    parts.push("");
  }
  return parts.join("\n");
}

async function collectEmailContext(supabase: Supa, projectId: string): Promise<string> {
  const { data: threads } = await supabase
    .from("project_email_threads")
    .select("id, subject, participants, latest_received_at")
    .eq("project_id", projectId)
    .order("latest_received_at", { ascending: false })
    .limit(PER_TABLE_LIMIT);

  const threadRows = (threads ?? []) as Row[];
  if (!threadRows.length) return "";

  const { data: messages } = await supabase
    .from("project_email_messages")
    .select("thread_id, from_name, from_address, sent_at, subject, body_text, snippet")
    .in("thread_id", threadRows.map((t) => t.id as string))
    .order("sent_at", { ascending: true });

  const byThread = new Map<string, Row[]>();
  for (const m of (messages ?? []) as Row[]) {
    const tid = m.thread_id as string;
    if (!byThread.has(tid)) byThread.set(tid, []);
    byThread.get(tid)!.push(m);
  }

  const parts: string[] = [];
  for (const t of threadRows) {
    const msgs = byThread.get(t.id as string) ?? [];
    if (!msgs.length) continue;
    parts.push(`#### Thread: ${t.subject || "(no subject)"}`);
    for (const m of msgs) {
      const sender = [m.from_name, m.from_address ? `<${m.from_address}>` : ""].filter(Boolean).join(" ").trim();
      const when = m.sent_at ? String(m.sent_at) : "";
      const raw = ((m.body_text as string) || (m.snippet as string) || "").trim();
      const body = raw.length > MAX_EMAIL_BODY_CHARS ? raw.slice(0, MAX_EMAIL_BODY_CHARS) + "…" : raw;
      parts.push(`- From ${sender || "(unknown)"}${when ? ` on ${when}` : ""}:\n${body || "(empty)"}`);
    }
    parts.push("");
    if (parts.join("\n").length > MAX_EMAIL_BLOCK_CHARS) break;
  }

  let text = parts.join("\n");
  if (text.length > MAX_EMAIL_BLOCK_CHARS) text = text.slice(0, MAX_EMAIL_BLOCK_CHARS) + "\n…(emails truncated)";
  return text;
}

/** Normalized slug of a headline, used to dedupe across daily runs. */
export function dedupeKey(headline: string): string {
  return headline
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

type ProposedNote = {
  headline: string;
  detail: string;
  source: string;
  category: string | null;
  priority: "high" | "medium" | "low";
};

export type GenerateResult = {
  ok: boolean;
  created: number;
  skipped: number;
  reason?: string;
};

/**
 * Generate and persist new Looking Ahead notes for a single project.
 * Safe to call repeatedly: it dedupes against existing notes and caps how many
 * active notes a project can accumulate.
 */
export async function generateLookingAheadNotes(
  supabase: Supa,
  projectId: string,
): Promise<GenerateResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { ok: false, created: 0, skipped: 0, reason: "GEMINI_API_KEY missing" };

  const nowIso = new Date().toISOString();

  // How many actionable notes are already showing? If we're at the cap, skip.
  const { data: existing } = await supabase
    .from("project_looking_ahead_notes")
    .select("dedupe_key, status, snoozed_until, headline")
    .eq("project_id", projectId);

  const existingRows = existing ?? [];
  const existingKeys = new Set(existingRows.map((r) => r.dedupe_key as string));
  const activeCount = existingRows.filter(
    (r) => r.status === "pending" && (!r.snoozed_until || (r.snoozed_until as string) <= nowIso),
  ).length;

  if (activeCount >= MAX_ACTIVE_NOTES) {
    return { ok: true, created: 0, skipped: 0, reason: "at active cap" };
  }

  const { data: project } = await supabase
    .from("projects")
    .select("name, project_type, address, status, start_date, end_date, company_id")
    .eq("id", projectId)
    .single();

  const [emailText, tableRows, bestPractices] = await Promise.all([
    collectEmailContext(supabase, projectId),
    Promise.all(TABLES.map(async (t) => ({ label: t.label, rows: await fetchTable(supabase, t.table, projectId) }))),
    getCompanyBestPracticesText(supabase, (project?.company_id as string | null) ?? null),
  ]);

  const tableContext = buildTableContext(tableRows);
  const emailBlock = emailText ? `### Emails\n${emailText}\n` : "";
  const bestPracticesBlock = bestPractices ? `${bestPractices}\n\n` : "";

  // Prior notes so the model doesn't repeat itself.
  const priorNoteHeadlines = existingRows
    .map((r) => `- ${r.headline as string} (${r.status})`)
    .join("\n");

  const hasSignal = Boolean(emailText || tableContext.trim());
  if (!hasSignal) {
    return { ok: true, created: 0, skipped: 0, reason: "no project signal" };
  }

  const today = new Date().toISOString().split("T")[0];
  const projectHeader = project
    ? `Project: ${project.name ?? "Unknown"}${project.project_type ? ` (${project.project_type})` : ""}${project.address ? ` — ${project.address}` : ""}` +
      `${project.status ? ` — Status: ${project.status}` : ""}` +
      `${project.start_date ? ` — Start: ${project.start_date}` : ""}${project.end_date ? ` — End: ${project.end_date}` : ""}`
    : `Project ID: ${projectId}`;

  const remainingSlots = Math.min(MAX_NEW_PER_RUN, MAX_ACTIVE_NOTES - activeCount);

  const systemInstruction = `You are SiteCommand's project foreman assistant. Each morning you brief the team with a short list of things to KNOW and REMEMBER given where this construction project currently stands.

These are situational-awareness FACTS to commit to memory — not action items. A good note states a concrete, useful fact and where it came from. Examples of the right shape:
- "The stormwater plans show 1,240 LF of 24\" RCP on site." (source: drawings)
- "Per the supplier's email on May 3, structure C15 will be ~2 weeks late." (source: supplier email)
- "Submittal #042 (light fixtures) is approved as noted — only Type B was rejected." (source: submittal log)
- "The site concrete subcontract (PO-118) is $312,400 with 10% retainage." (source: commitment)

How to reason:
- Look at where the project sits in its SCHEDULE and what scope is active or coming up next, then pull the facts that matter for that stage.
- Study the DRAWINGS/PLANS and SPECIFICATIONS for relevant quantities, materials, and requirements for the work at hand.
- Read recent EMAILS for delivery dates, delays, commitments, and clarifications worth remembering.
- Pull contract/commitment values, RFI answers, submittal dispositions, and daily-log notes (installed quantities, manpower, deliveries) that the team should keep top of mind.
- Apply the COMPANY BEST PRACTICES & STANDARDS as authoritative policy. When a standard sets a deadline or lead time (e.g. "buyout within 90 days of contract", "electrical submittals within 30 days of contract"), surface where this project stands against it as a fact — compute the concrete target date from the applicable contract/record date and note it (e.g. "Per company standard, electrical submittals are due within 30 days of contract; the electrical subcontract was executed 2026-05-01, so the target is 2026-05-31"). State it as a fact to remember, not a task.
- Prefer specific facts with numbers, dates, and names over generic statements.

Hard rules:
- Today's date is ${today}.
- Write at most ${remainingSlots} notes. Fewer is better — only genuinely useful, distinct facts.
- These are things to KNOW, not things to DO. Do not write tasks or recommendations ("call the supplier", "order the pipe"). State the fact instead.
- Do NOT repeat anything in PREVIOUSLY SURFACED. If nothing new is worth noting, return an empty list.
- Ground every note in the provided data. Do not invent records, people, numbers, or dates. The "detail" must include the specifics and "source" must name where it came from.
- "category" must be one of: ${NOTE_CATEGORIES.join(", ")} — or null if none fits.
- "source" is a short label (≤ 4 words), e.g. "Supplier email", "Stormwater plans", "Submittal log", "Subcontract".
- "priority" reflects how important the fact is to remember right now (high/medium/low).`;

  const userPrompt = `${projectHeader}
Today: ${today}

${bestPracticesBlock}=== PROJECT DATA (plans, specs, contracts, schedule, RFIs, submittals, logs) ===
${tableContext || "(no records)"}
${emailBlock}
=== PREVIOUSLY SURFACED (do not repeat) ===
${priorNoteHeadlines || "(none)"}

Write the Looking Ahead notes now.`;

  const ai = new GoogleGenAI({ apiKey });
  let parsed: { items?: ProposedNote[] };
  try {
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  headline: { type: Type.STRING },
                  detail: { type: Type.STRING },
                  source: { type: Type.STRING },
                  category: { type: Type.STRING, nullable: true },
                  priority: { type: Type.STRING, enum: ["high", "medium", "low"] },
                },
                required: ["headline", "detail", "source", "priority"],
              },
            },
          },
          required: ["items"],
        },
      },
    });
    parsed = JSON.parse((result.text ?? "").trim() || "{}");
  } catch {
    return { ok: false, created: 0, skipped: 0, reason: "AI request failed" };
  }

  const items = Array.isArray(parsed.items) ? parsed.items : [];
  if (!items.length) return { ok: true, created: 0, skipped: 0, reason: "no items proposed" };

  let created = 0;
  let skipped = 0;
  const seenThisRun = new Set<string>();

  for (const item of items) {
    if (created >= remainingSlots) break;
    const headline = (item.headline ?? "").trim();
    if (!headline) { skipped++; continue; }

    const key = dedupeKey(headline);
    if (!key || existingKeys.has(key) || seenThisRun.has(key)) { skipped++; continue; }
    seenThisRun.add(key);

    const category =
      item.category && NOTE_CATEGORIES.includes(item.category) ? item.category : null;
    const priority = ["high", "medium", "low"].includes(item.priority) ? item.priority : "medium";

    const { error } = await supabase.from("project_looking_ahead_notes").insert({
      project_id: projectId,
      headline,
      detail: (item.detail ?? "").trim().slice(0, 2000),
      source: (item.source ?? "").trim().slice(0, 60),
      category,
      priority,
      status: "pending",
      dedupe_key: key,
      generated_at: nowIso,
    });
    if (error) { skipped++; continue; }
    created++;
  }

  return { ok: true, created, skipped };
}
