/**
 * Shared generator for AI "To Do" recommendations on the Tasks page.
 *
 * Builds a focused snapshot of a project's recent signals (emails, schedule
 * position, open RFIs/submittals and their lead times, meetings, daily logs,
 * existing tasks) and asks Gemini to propose actionable to-do items the team
 * should be working on next. New items are deduped against everything already
 * suggested for the project (any status) so the daily cron never repeats a
 * recommendation the user has already seen, accepted, or ignored.
 *
 * Used by both the daily cron (`/api/cron/todo-recommendations`) and the manual
 * "Refresh recommendations" action (`POST /api/projects/[id]/todo-recommendations`).
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

// Don't let the To Do section grow unbounded. We stop generating once a project
// already has this many actionable (pending, non-snoozed) recommendations, and
// never insert more than MAX_NEW_PER_RUN at a time.
const MAX_ACTIVE_RECOMMENDATIONS = 12;
const MAX_NEW_PER_RUN = 6;

const TASK_CATEGORIES = [
  "Administrative",
  "Closeout",
  "Contract",
  "Design",
  "Miscellaneous",
  "Construction",
];

// Tables serialized generically into the project context. Kept lean for speed
// since this runs across every active project on a daily cron.
const TABLES: Array<{ label: string; table: string }> = [
  { label: "Open RFIs", table: "rfis" },
  { label: "Submittals", table: "submittals" },
  { label: "Submittal Packages", table: "submittal_packages" },
  { label: "Meetings", table: "meetings" },
  { label: "Daily Logs", table: "daily_logs" },
  { label: "Project Schedules", table: "project_schedules" },
  { label: "Change Events", table: "change_events" },
  { label: "Change Orders", table: "change_orders" },
  { label: "Commitments", table: "commitments" },
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

/** Normalized slug of a title, used to dedupe across daily runs. */
export function dedupeKey(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

type ProposedItem = {
  title: string;
  rationale: string;
  source: string;
  category: string | null;
  priority: "high" | "medium" | "low";
  suggestedDueDate: string | null;
};

export type GenerateResult = {
  ok: boolean;
  created: number;
  skipped: number;
  reason?: string;
};

/**
 * Generate and persist new To Do recommendations for a single project.
 * Safe to call repeatedly: it dedupes against existing recommendations and
 * caps how many active items a project can accumulate.
 */
export async function generateTodoRecommendations(
  supabase: Supa,
  projectId: string,
): Promise<GenerateResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { ok: false, created: 0, skipped: 0, reason: "GEMINI_API_KEY missing" };

  const nowIso = new Date().toISOString();

  // How many actionable items are already showing? If we're at the cap, skip.
  const { data: existing } = await supabase
    .from("project_todo_recommendations")
    .select("dedupe_key, status, snoozed_until, title")
    .eq("project_id", projectId);

  const existingRows = existing ?? [];
  const existingKeys = new Set(existingRows.map((r) => r.dedupe_key as string));
  const activeCount = existingRows.filter(
    (r) => r.status === "pending" && (!r.snoozed_until || (r.snoozed_until as string) <= nowIso),
  ).length;

  if (activeCount >= MAX_ACTIVE_RECOMMENDATIONS) {
    return { ok: true, created: 0, skipped: 0, reason: "at active cap" };
  }

  const { data: project } = await supabase
    .from("projects")
    .select("name, project_type, address, status, start_date, end_date, company_id")
    .eq("id", projectId)
    .single();

  const [emailText, tableRows, tasks, bestPractices] = await Promise.all([
    collectEmailContext(supabase, projectId),
    Promise.all(TABLES.map(async (t) => ({ label: t.label, rows: await fetchTable(supabase, t.table, projectId) }))),
    fetchTable(supabase, "tasks", projectId),
    getCompanyBestPracticesText(supabase, (project?.company_id as string | null) ?? null),
  ]);

  const tableContext = buildTableContext(tableRows);
  const emailBlock = emailText ? `### Emails\n${emailText}\n` : "";
  const bestPracticesBlock = bestPractices ? `${bestPractices}\n\n` : "";

  // Existing tasks + prior recommendations so the model doesn't duplicate work.
  const existingTaskTitles = tasks
    .filter((t) => t.status !== "closed" && t.status !== "void")
    .map((t) => `- ${stringify(t.title) ?? ""}`)
    .filter((s) => s.trim() !== "-")
    .join("\n");
  const priorRecTitles = existingRows
    .map((r) => `- ${r.title as string} (${r.status})`)
    .join("\n");

  const hasSignal = Boolean(emailText || tableContext.trim());
  if (!hasSignal && tasks.length === 0) {
    return { ok: true, created: 0, skipped: 0, reason: "no project signal" };
  }

  const today = new Date().toISOString().split("T")[0];
  const projectHeader = project
    ? `Project: ${project.name ?? "Unknown"}${project.project_type ? ` (${project.project_type})` : ""}${project.address ? ` — ${project.address}` : ""}` +
      `${project.status ? ` — Status: ${project.status}` : ""}` +
      `${project.start_date ? ` — Start: ${project.start_date}` : ""}${project.end_date ? ` — End: ${project.end_date}` : ""}`
    : `Project ID: ${projectId}`;

  const remainingSlots = Math.min(MAX_NEW_PER_RUN, MAX_ACTIVE_RECOMMENDATIONS - activeCount);

  const systemInstruction = `You are SiteCommand's project foreman assistant. Each morning you review a construction project's recent activity and propose a short list of concrete "to do" items the team should act on next.

How to reason:
- Read the recent EMAILS for explicit or implied action items, commitments, deadlines, and requests directed at the team.
- Use where the project sits in its SCHEDULE together with typical construction lead times. If something needs to be ordered, submitted, or approved now to stay on schedule (e.g. long-lead material procurement, submittals that must be approved before fabrication, inspections to book ahead), surface it.
- Apply the COMPANY BEST PRACTICES & STANDARDS as authoritative policy. When a standard sets a deadline or lead time (e.g. "all buyout within 90 days of contract", "electrical submittals within 30 days of contract"), create the corresponding to-do and set "suggestedDueDate" by computing it from the applicable contract/record date (e.g. buyout due = subcontract execution date + 90 days). Cite the standard and the date you derived from in the rationale. Only do this when the relevant record exists in the project data and the work isn't already done.
- Pull from open RFIs, submittals, change events/orders, meetings, daily logs, and punch list items for follow-ups that are overdue or about to become blocking.
- Prefer specific, time-sensitive, actionable items over generic advice.

Hard rules:
- Today's date is ${today}.
- Propose at most ${remainingSlots} items. Fewer is better — only include genuinely useful, distinct items.
- Do NOT duplicate anything already in EXISTING TASKS or PREVIOUSLY SUGGESTED. If everything actionable is already covered, return an empty list.
- Ground each item in the provided data. Do not invent records, people, dates, or facts. The "rationale" must explain what signal it came from (cite the email sender/subject, RFI number, schedule item, etc.) and any lead-time reasoning.
- "category" must be one of: ${TASK_CATEGORIES.join(", ")} — or null if none fits.
- "suggestedDueDate" must be YYYY-MM-DD and on/after today, or null.
- "source" is a short label (≤ 4 words) for the grounding signal, e.g. "Email from GC", "Submittal lead time", "Schedule".`;

  const userPrompt = `${projectHeader}
Today: ${today}

${bestPracticesBlock}=== RECENT PROJECT DATA ===
${tableContext || "(no records)"}
${emailBlock}
=== EXISTING TASKS (do not duplicate) ===
${existingTaskTitles || "(none)"}

=== PREVIOUSLY SUGGESTED (do not repeat) ===
${priorRecTitles || "(none)"}

Propose the to-do items now.`;

  const ai = new GoogleGenAI({ apiKey });
  let parsed: { items?: ProposedItem[] };
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
                  title: { type: Type.STRING },
                  rationale: { type: Type.STRING },
                  source: { type: Type.STRING },
                  category: { type: Type.STRING, nullable: true },
                  priority: { type: Type.STRING, enum: ["high", "medium", "low"] },
                  suggestedDueDate: { type: Type.STRING, nullable: true },
                },
                required: ["title", "rationale", "source", "priority"],
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
    const title = (item.title ?? "").trim();
    if (!title) { skipped++; continue; }

    const key = dedupeKey(title);
    if (!key || existingKeys.has(key) || seenThisRun.has(key)) { skipped++; continue; }
    seenThisRun.add(key);

    const category =
      item.category && TASK_CATEGORIES.includes(item.category) ? item.category : null;
    const priority = ["high", "medium", "low"].includes(item.priority) ? item.priority : "medium";
    const due =
      typeof item.suggestedDueDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item.suggestedDueDate)
        ? item.suggestedDueDate
        : null;

    const { error } = await supabase.from("project_todo_recommendations").insert({
      project_id: projectId,
      title,
      rationale: (item.rationale ?? "").trim().slice(0, 2000),
      source: (item.source ?? "").trim().slice(0, 60),
      category,
      priority,
      suggested_due_date: due,
      status: "pending",
      dedupe_key: key,
      generated_at: nowIso,
    });
    if (error) { skipped++; continue; }
    created++;
  }

  return { ok: true, created, skipped };
}
