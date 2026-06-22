import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { canAccessProject } from "@/lib/project-access";
import { getSupabase } from "@/lib/supabase";
import { getCompanyBestPracticesText } from "@/lib/company-best-practices";
import { GoogleGenAI, Type } from "@google/genai";

export const maxDuration = 300;

type Row = Record<string, unknown>;
type Supa = ReturnType<typeof getSupabase>;

const PER_TABLE_LIMIT = 100;
const MAX_VALUE_CHARS = 1500;
// Safety cap on total bytes uploaded to Gemini per question.
const MAX_PDF_BYTES_TOTAL = 500 * 1024 * 1024;
const UPLOAD_CONCURRENCY = 5;

const TABLES: Array<{ label: string; table: string; idCol?: string }> = [
  { label: "RFIs", table: "rfis" },
  { label: "RFI Responses", table: "rfi_responses" },
  { label: "Submittals", table: "submittals" },
  { label: "Submittal Responses", table: "submittal_responses" },
  { label: "Submittal Packages", table: "submittal_packages" },
  { label: "Daily Logs", table: "daily_logs" },
  { label: "Meetings", table: "meetings" },
  { label: "Tasks", table: "tasks" },
  { label: "Prime Contracts", table: "prime_contracts" },
  { label: "Budget Line Items", table: "budget_line_items" },
  { label: "Commitments", table: "commitments" },
  { label: "Scope of Work", table: "scope_items" },
  { label: "Change Orders", table: "change_orders" },
  { label: "Change Events", table: "change_events" },
  { label: "Change Event RFQs", table: "change_event_rfqs" },
  { label: "Project Schedules", table: "project_schedules" },
  { label: "Specifications", table: "project_specifications" },
  { label: "Photos", table: "project_photos" },
  { label: "Drawing Uploads", table: "drawing_uploads" },
  { label: "Drawing Pages", table: "project_drawings" },
  { label: "Punch List", table: "punch_list_items" },
  { label: "Transaction Orders", table: "project_transaction_orders" },
  { label: "Transmittals", table: "transmittals" },
  { label: "Timesheets", table: "timesheets" },
  { label: "Timesheet Entries", table: "timesheet_entries" },
  { label: "Permit Applications", table: "project_permit_applications" },
  { label: "Quick Notes", table: "quick_notes" },
  { label: "Bid Packages", table: "bid_packages" },
  { label: "Bids", table: "bids" },
  { label: "Preconstruction Milestones", table: "preconstruction_milestones" },
  { label: "Estimate Items", table: "estimate_items" },
  { label: "Directory Contacts", table: "directory_contacts" },
];

const SKIP_KEYS = new Set([
  "id",
  "project_id",
  "company_id",
  "created_by",
  "updated_by",
  "user_id",
  "uploaded_by_id",
  "storage_path",
  "source_storage_path",
  "final_storage_path",
  "invoice_storage_path",
  "graph_conversation_id",
  "url",
  "file_url",
  "page_image_path",
]);

const SUPPORTED_DOC_MIME_PREFIXES = ["image/", "text/"];
const SUPPORTED_DOC_MIME_EXACT = new Set([
  "application/pdf",
  "application/json",
]);

function isSupportedMime(mime: string | null | undefined): boolean {
  if (!mime) return false;
  if (SUPPORTED_DOC_MIME_EXACT.has(mime)) return true;
  return SUPPORTED_DOC_MIME_PREFIXES.some((p) => mime.startsWith(p));
}

function stringify(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (trimmed.length > MAX_VALUE_CHARS) return trimmed.slice(0, MAX_VALUE_CHARS) + "…";
    return trimmed;
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value) || typeof value === "object") {
    try {
      const json = JSON.stringify(value);
      if (json === "{}" || json === "[]" || json === "null") return null;
      if (json.length > MAX_VALUE_CHARS) return json.slice(0, MAX_VALUE_CHARS) + "…";
      return json;
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

async function fetchTable(
  supabase: Supa,
  table: string,
  projectId: string,
  idCol = "project_id",
): Promise<Row[]> {
  try {
    const { data, error } = await supabase.from(table).select("*").eq(idCol, projectId).limit(PER_TABLE_LIMIT);
    if (error) return [];
    return (data ?? []) as Row[];
  } catch {
    return [];
  }
}

function buildContext(blocks: Array<{ label: string; rows: Row[] }>): string {
  const parts: string[] = [];
  for (const { label, rows } of blocks) {
    if (!rows.length) continue;
    parts.push(`### ${label} (${rows.length} record${rows.length === 1 ? "" : "s"})`);
    rows.forEach((row, i) => {
      const body = serializeRow(row);
      if (!body) return;
      parts.push(`- Record ${i + 1}:\n${body}`);
    });
    parts.push("");
  }
  return parts.join("\n");
}

// Email bodies are full prose, so they get a much higher per-value budget than
// the generic table serializer (which caps every field at MAX_VALUE_CHARS).
const MAX_EMAIL_BODY_CHARS = 4000;
const MAX_EMAIL_BLOCK_CHARS = 200_000;

type EmailContext = { text: string; threadCount: number; messageCount: number };

// Emails are stored across two tables (threads + their messages) and the
// message text matters far more than any single field would survive the generic
// 1500-char cap, so they get a dedicated, fuller context block.
async function collectEmailContext(supabase: Supa, projectId: string): Promise<EmailContext> {
  const { data: threads } = await supabase
    .from("project_email_threads")
    .select("id, subject, participants, latest_received_at")
    .eq("project_id", projectId)
    .order("latest_received_at", { ascending: false })
    .limit(PER_TABLE_LIMIT);

  const threadRows = (threads ?? []) as Row[];
  if (!threadRows.length) return { text: "", threadCount: 0, messageCount: 0 };

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

  let messageCount = 0;
  const parts: string[] = [];
  for (const t of threadRows) {
    const msgs = byThread.get(t.id as string) ?? [];
    const participants = Array.isArray(t.participants)
      ? (t.participants as unknown[]).map(String).filter(Boolean).join(", ")
      : "";
    parts.push(`#### Thread: ${t.subject || "(no subject)"}`);
    if (participants) parts.push(`Participants: ${participants}`);
    if (!msgs.length) {
      // Thread linked but messages not yet synced (e.g. linked before storage,
      // never re-opened). Note it so Assist doesn't assume the thread is empty.
      parts.push("(message bodies not yet synced for this thread)");
    }
    for (const m of msgs) {
      messageCount += 1;
      const sender = [m.from_name, m.from_address ? `<${m.from_address}>` : ""]
        .filter(Boolean)
        .join(" ")
        .trim();
      const when = m.sent_at ? String(m.sent_at) : "";
      const bodyRaw = ((m.body_text as string) || (m.snippet as string) || "").trim();
      const body = bodyRaw.length > MAX_EMAIL_BODY_CHARS
        ? bodyRaw.slice(0, MAX_EMAIL_BODY_CHARS) + "…"
        : bodyRaw;
      parts.push(`- From ${sender || "(unknown)"}${when ? ` on ${when}` : ""}:\n${body || "(empty)"}`);
    }
    parts.push("");
    if (parts.join("\n").length > MAX_EMAIL_BLOCK_CHARS) break;
  }

  let text = parts.join("\n");
  if (text.length > MAX_EMAIL_BLOCK_CHARS) text = text.slice(0, MAX_EMAIL_BLOCK_CHARS) + "\n…(emails truncated)";

  return { text, threadCount: threadRows.length, messageCount };
}

type Candidate = {
  bucket: string;
  storagePath: string;
  filename: string;
  mimeType: string;
  description: string;
};

// Extract a Supabase storage path from a public URL like
// https://<host>/storage/v1/object/public/<bucket>/<path>
function pathFromPublicUrl(url: string, bucket: string): string | null {
  const marker = `/storage/v1/object/public/${bucket}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return decodeURIComponent(url.slice(idx + marker.length));
}

async function collectDrawingPdfs(supabase: Supa, projectId: string): Promise<Candidate[]> {
  const { data } = await supabase
    .from("drawing_uploads")
    .select("filename, storage_path, uploaded_at")
    .eq("project_id", projectId)
    .order("uploaded_at", { ascending: false });
  return (data ?? [])
    .filter((row) => (row as Row).storage_path)
    .map((row) => ({
      bucket: "project-drawings",
      storagePath: (row as Row).storage_path as string,
      filename: ((row as Row).filename as string | null) ?? "drawing.pdf",
      mimeType: "application/pdf",
      description: "Drawing Set",
    }));
}

async function collectSpecBook(supabase: Supa, projectId: string): Promise<Candidate[]> {
  const { data } = await supabase
    .from("project_spec_books")
    .select("filename, storage_path")
    .eq("project_id", projectId)
    .maybeSingle();
  if (!data?.storage_path) return [];
  return [{
    bucket: "project-drawings",
    storagePath: data.storage_path as string,
    filename: (data.filename as string | null) ?? "spec-book.pdf",
    mimeType: "application/pdf",
    description: "Specification Book",
  }];
}

async function collectRfiAttachments(supabase: Supa, projectId: string): Promise<Candidate[]> {
  const { data } = await supabase
    .from("rfis")
    .select("id, rfi_number, subject, attachments")
    .eq("project_id", projectId);
  const out: Candidate[] = [];
  for (const rfi of (data ?? []) as Row[]) {
    const atts = Array.isArray(rfi.attachments) ? (rfi.attachments as Array<{ name?: string; url?: string }>) : [];
    for (const att of atts) {
      if (!att?.url || !att?.name) continue;
      if (!att.name.toLowerCase().endsWith(".pdf")) continue;
      const path = pathFromPublicUrl(att.url, "rfi-attachments");
      if (!path) continue;
      const number = rfi.rfi_number ?? rfi.id;
      out.push({
        bucket: "rfi-attachments",
        storagePath: path,
        filename: att.name,
        mimeType: "application/pdf",
        description: `RFI #${number}${rfi.subject ? ` — ${rfi.subject}` : ""} (Attachment)`,
      });
    }
  }
  return out;
}

async function collectSubmittalAttachments(supabase: Supa, projectId: string): Promise<Candidate[]> {
  const { data } = await supabase
    .from("submittals")
    .select("id, number, title, attachments")
    .eq("project_id", projectId);
  const out: Candidate[] = [];
  for (const sub of (data ?? []) as Row[]) {
    const atts = Array.isArray(sub.attachments) ? (sub.attachments as Array<{ name?: string; url?: string }>) : [];
    for (const att of atts) {
      if (!att?.url || !att?.name) continue;
      if (!att.name.toLowerCase().endsWith(".pdf")) continue;
      const path = pathFromPublicUrl(att.url, "submittal-attachments");
      if (!path) continue;
      const number = sub.number ?? sub.id;
      out.push({
        bucket: "submittal-attachments",
        storagePath: path,
        filename: att.name,
        mimeType: "application/pdf",
        description: `Submittal #${number}${sub.title ? ` — ${sub.title}` : ""} (Attachment)`,
      });
    }
  }
  return out;
}

// Building code references live under Admin → Building Code. Only approved
// documents are surfaced: uploaded PDFs become attachable files, while saved
// links are listed as a text block Assist can cite.
async function collectBuildingCode(
  supabase: Supa,
  projectId: string,
): Promise<{ files: Candidate[]; text: string }> {
  const { data } = await supabase
    .from("project_building_code_documents")
    .select("title, jurisdiction, doc_type, url, storage_path, filename, notes")
    .eq("project_id", projectId)
    .eq("status", "approved");

  const rows = (data ?? []) as Row[];
  const files: Candidate[] = [];
  const linkLines: string[] = [];

  for (const row of rows) {
    const title = (row.title as string | null) ?? "Building Code";
    const jurisdiction = (row.jurisdiction as string | null) ?? "";
    const label = jurisdiction ? `${title} (${jurisdiction})` : title;
    if (row.doc_type === "file" && row.storage_path) {
      files.push({
        bucket: "project-drawings",
        storagePath: row.storage_path as string,
        filename: (row.filename as string | null) ?? "building-code.pdf",
        mimeType: "application/pdf",
        description: `Building Code — ${label}`,
      });
    } else if (row.doc_type === "link" && row.url) {
      const notes = (row.notes as string | null)?.trim();
      linkLines.push(`- ${label}: ${row.url}${notes ? ` — ${notes}` : ""}`);
    }
  }

  const text = linkLines.length
    ? `### Building Code References (${linkLines.length} link${linkLines.length === 1 ? "" : "s"})\n${linkLines.join("\n")}\n`
    : "";

  return { files, text };
}

async function collectDocuments(supabase: Supa, projectId: string): Promise<Candidate[]> {
  const { data } = await supabase
    .from("documents")
    .select("name, storage_path, mime_type")
    .eq("project_id", projectId)
    .eq("type", "file");
  return ((data ?? []) as Row[])
    .filter((d) => d.storage_path && isSupportedMime(d.mime_type as string))
    .map((d) => ({
      bucket: "project-documents",
      storagePath: d.storage_path as string,
      filename: (d.name as string | null) ?? "document",
      mimeType: (d.mime_type as string) || "application/octet-stream",
      description: "Document",
    }));
}

type UploadedFile = Candidate & { fileId: string; geminiUri: string; geminiMime: string };

async function downloadAndUpload(
  supabase: Supa,
  ai: GoogleGenAI,
  candidates: Candidate[],
): Promise<UploadedFile[]> {
  // Download sequentially with shared byte budget.
  const downloaded: Array<Candidate & { blob: Blob }> = [];
  let bytesUsed = 0;
  for (const cand of candidates) {
    try {
      const { data: blob, error } = await supabase.storage.from(cand.bucket).download(cand.storagePath);
      if (error || !blob) continue;
      if (bytesUsed + blob.size > MAX_PDF_BYTES_TOTAL) break;
      bytesUsed += blob.size;
      downloaded.push({ ...cand, blob });
    } catch {
      // skip
    }
  }

  // Upload to Gemini Files API with limited concurrency.
  const out: UploadedFile[] = [];
  for (let i = 0; i < downloaded.length; i += UPLOAD_CONCURRENCY) {
    const batch = downloaded.slice(i, i + UPLOAD_CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (item, idxInBatch) => {
        try {
          const file = await ai.files.upload({
            file: item.blob,
            config: { mimeType: item.mimeType, displayName: item.filename },
          });
          if (!file.uri || !file.mimeType) return null;
          return {
            ...item,
            fileId: `file-${i + idxInBatch + 1}`,
            geminiUri: file.uri,
            geminiMime: file.mimeType,
          };
        } catch {
          return null;
        }
      }),
    );
    for (const r of results) if (r) out.push(r);
  }
  // Renumber sequentially in case some failed.
  return out.map((f, idx) => ({ ...f, fileId: `file-${idx + 1}` }));
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;
  const hasAccess = await canAccessProject(projectId, session);
  if (!hasAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "AI service not configured" }, { status: 503 });

  let body: { question?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const question = (body.question ?? "").trim();
  if (!question) return NextResponse.json({ error: "Question is required" }, { status: 400 });

  const supabase = getSupabase();

  const { data: project } = await supabase
    .from("projects")
    .select("name, project_type, address, status, company_id")
    .eq("id", projectId)
    .single();

  const genai = new GoogleGenAI({ apiKey });

  // Gather candidates from all sources. Drawings + spec book first (typically larger
  // reference docs), then attachments, then general documents.
  const [drawings, specBook, rfiAtts, subAtts, docs, buildingCode, tableRows, emails, bestPractices] = await Promise.all([
    collectDrawingPdfs(supabase, projectId),
    collectSpecBook(supabase, projectId),
    collectRfiAttachments(supabase, projectId),
    collectSubmittalAttachments(supabase, projectId),
    collectDocuments(supabase, projectId),
    collectBuildingCode(supabase, projectId),
    Promise.all(
      TABLES.map(async (t) => ({
        label: t.label,
        rows: await fetchTable(supabase, t.table, projectId, t.idCol),
      })),
    ),
    collectEmailContext(supabase, projectId),
    getCompanyBestPracticesText(supabase, (project?.company_id as string | null) ?? null),
  ]);

  const candidates: Candidate[] = [...specBook, ...drawings, ...buildingCode.files, ...rfiAtts, ...subAtts, ...docs];
  const uploaded = await downloadAndUpload(supabase, genai, candidates);

  const projectHeader = project
    ? `Project: ${project.name ?? "Unknown"}${project.project_type ? ` (${project.project_type})` : ""}${project.address ? ` — ${project.address}` : ""}${project.status ? ` — Status: ${project.status}` : ""}`
    : `Project ID: ${projectId}`;

  const tableRecordCount = tableRows.reduce((sum, b) => sum + b.rows.length, 0);
  const recordCount = tableRecordCount + emails.threadCount;
  const toolsSearched =
    tableRows.filter((b) => b.rows.length).length + (emails.threadCount ? 1 : 0);
  const emailBlock = emails.text
    ? `### Emails (${emails.threadCount} thread${emails.threadCount === 1 ? "" : "s"}, ${emails.messageCount} message${emails.messageCount === 1 ? "" : "s"})\n${emails.text}\n`
    : "";
  const bestPracticesBlock = bestPractices ? `${bestPractices}\n\n` : "";
  const context = `${bestPracticesBlock}${buildContext(tableRows)}${emailBlock}${buildingCode.text}`;
  const manifest = uploaded.length
    ? uploaded.map((f) => `- [${f.fileId}] ${f.description}: ${f.filename}`).join("\n")
    : "(no files attached)";

  const systemInstruction = `You are SiteCommand Assist, an AI assistant embedded inside a construction project management platform. You answer questions by searching across the project's records (RFIs, submittals, daily logs, meetings, tasks, contracts, budgets, commitments, change orders, change events, schedules, specifications, photos, drawings, emails, punch list, transaction orders, transmittals, timesheets, permit applications, quick notes, bid packages, bids, preconstruction milestones, estimates, directory contacts) and any attached files (drawings, spec book, RFI/submittal attachments, project documents).

Rules:
- Ground every answer in the provided project data and attached files. Quote relevant record fields or file content when useful.
- Treat the COMPANY BEST PRACTICES & STANDARDS block (when present) as authoritative company policy. Apply those standards when answering — including deriving target dates from any stated deadlines/lead times against the relevant project records — and cite the standard you applied.
- When you cite a record, reference it by its tool and identifying fields (e.g., "RFI #12 — Subject: Roof flashing detail" or "Daily Log on 2026-04-01").
- If the answer isn't in the data, say so clearly and suggest where the user might add the information.
- Keep responses concise and scannable. Use short paragraphs or bullet lists.
- Do not invent records, numbers, or quotes. If a field is missing, say so.

Response format:
- Return a JSON object with two fields:
  - "answer": your answer as plain text (use newlines and bullet markers, not markdown headings).
  - "citedFileIds": an array of file IDs (e.g., ["file-1", "file-3"]) for ONLY the files you actually used to compose the answer. Do NOT include files you opened but did not draw information from. If you used no files, return an empty array.`;

  const userPrompt = `${projectHeader}

I have indexed ${recordCount} records across ${toolsSearched} tools for this project.${uploaded.length ? ` ${uploaded.length} file${uploaded.length === 1 ? "" : "s"} attached.` : ""}

=== ATTACHED FILES ===
${manifest}

=== PROJECT DATA ===
${context || "(no records found)"}

=== QUESTION ===
${question}`;

  try {
    const parts: Array<{
      text?: string;
      fileData?: { mimeType: string; fileUri: string };
    }> = [{ text: userPrompt }];
    for (const f of uploaded) {
      parts.push({ fileData: { mimeType: f.geminiMime, fileUri: f.geminiUri } });
    }

    const result = await genai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts }],
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            answer: { type: Type.STRING },
            citedFileIds: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ["answer", "citedFileIds"],
        },
      },
    });

    const raw = (result.text ?? "").trim();
    let answer = raw || "(no response)";
    let citedFileIds: string[] = [];
    try {
      const parsed = JSON.parse(raw) as { answer?: string; citedFileIds?: string[] };
      if (typeof parsed.answer === "string" && parsed.answer.trim()) answer = parsed.answer.trim();
      if (Array.isArray(parsed.citedFileIds)) {
        citedFileIds = parsed.citedFileIds.filter((id): id is string => typeof id === "string");
      }
    } catch {
      // Fall back to raw text if JSON parsing fails.
    }

    const citedSet = new Set(citedFileIds);
    const citedFiles = uploaded.filter((f) => citedSet.has(f.fileId));

    const sourceDocuments = (
      await Promise.all(
        citedFiles.map(async (f) => {
          try {
            const { data } = await supabase.storage
              .from(f.bucket)
              .createSignedUrl(f.storagePath, 60 * 60);
            return data?.signedUrl
              ? { filename: f.filename, url: data.signedUrl, description: f.description }
              : null;
          } catch {
            return null;
          }
        }),
      )
    ).filter((d): d is { filename: string; url: string; description: string } => d !== null);

    return NextResponse.json({
      answer,
      stats: {
        recordCount,
        toolsSearched,
        filesAttached: uploaded.length,
        filesCited: sourceDocuments.length,
      },
      sourceDocuments,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI request failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
