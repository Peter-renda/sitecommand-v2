import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { canAccessProject } from "@/lib/project-access";
import { getSupabase } from "@/lib/supabase";
import { GoogleGenAI } from "@google/genai";

export const maxDuration = 60;

type Row = Record<string, unknown>;

const PER_TABLE_LIMIT = 100;
const MAX_VALUE_CHARS = 1500;
const MAX_PDF_FILES = 3;
const MAX_PDF_BYTES_TOTAL = 15 * 1024 * 1024;

const TABLES: Array<{ label: string; table: string; idCol?: string }> = [
  { label: "RFIs", table: "rfis" },
  { label: "RFI Responses", table: "rfi_responses" },
  { label: "Submittals", table: "submittals" },
  { label: "Submittal Responses", table: "submittal_responses" },
  { label: "Daily Logs", table: "daily_logs" },
  { label: "Meetings", table: "meetings" },
  { label: "Tasks", table: "tasks" },
  { label: "Prime Contracts", table: "prime_contracts" },
  { label: "Budget Line Items", table: "budget_line_items" },
  { label: "Commitments", table: "commitments" },
  { label: "Scope of Work", table: "scope_items" },
  { label: "Change Orders", table: "change_orders" },
  { label: "Change Events", table: "change_events" },
  { label: "Project Schedules", table: "project_schedules" },
  { label: "Specifications", table: "project_specifications" },
  { label: "Photos", table: "project_photos" },
  { label: "Drawing Uploads", table: "drawing_uploads" },
  { label: "Drawing Pages", table: "project_drawings" },
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
  "url",
  "file_url",
  "page_image_path",
]);

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
  supabase: ReturnType<typeof getSupabase>,
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

async function fetchDrawingPdfs(
  supabase: ReturnType<typeof getSupabase>,
  projectId: string,
): Promise<Array<{ filename: string; mimeType: string; data: string }>> {
  const { data: uploads } = await supabase
    .from("drawing_uploads")
    .select("id, filename, storage_path, uploaded_at")
    .eq("project_id", projectId)
    .order("uploaded_at", { ascending: false })
    .limit(MAX_PDF_FILES);

  if (!uploads?.length) return [];

  const out: Array<{ filename: string; mimeType: string; data: string }> = [];
  let bytesUsed = 0;

  for (const upload of uploads) {
    const path = (upload as Row).storage_path as string | undefined;
    const filename = ((upload as Row).filename as string | undefined) ?? "drawing.pdf";
    if (!path) continue;
    try {
      const { data: blob, error } = await supabase.storage.from("project-drawings").download(path);
      if (error || !blob) continue;
      const buf = Buffer.from(await blob.arrayBuffer());
      if (bytesUsed + buf.byteLength > MAX_PDF_BYTES_TOTAL) continue;
      bytesUsed += buf.byteLength;
      out.push({
        filename,
        mimeType: "application/pdf",
        data: buf.toString("base64"),
      });
    } catch {
      // skip
    }
  }
  return out;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;
  const hasAccess = await canAccessProject(projectId, session);
  if (!hasAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "AI service not configured" }, { status: 503 });

  let body: { question?: string; history?: Array<{ role: string; content: string }> };
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
    .select("name, project_type, address, status")
    .eq("id", projectId)
    .single();

  const fetched = await Promise.all(
    TABLES.map(async (t) => ({
      label: t.label,
      rows: await fetchTable(supabase, t.table, projectId, t.idCol),
    })),
  );

  const drawingPdfs = await fetchDrawingPdfs(supabase, projectId);

  const projectHeader = project
    ? `Project: ${project.name ?? "Unknown"}${project.project_type ? ` (${project.project_type})` : ""}${project.address ? ` — ${project.address}` : ""}${project.status ? ` — Status: ${project.status}` : ""}`
    : `Project ID: ${projectId}`;

  const recordCount = fetched.reduce((sum, b) => sum + b.rows.length, 0);
  const context = buildContext(fetched);

  const systemInstruction = `You are SiteCommand Assist, an AI assistant embedded inside a construction project management platform. You answer questions by searching across the project's records (RFIs, submittals, daily logs, meetings, tasks, contracts, budgets, commitments, change orders, change events, schedules, specifications, photos, drawings, and any drawing PDFs attached to this request).

Rules:
- Ground every answer in the provided project data. Quote relevant record fields when useful.
- When you cite a record, reference it by its tool and identifying fields (e.g., "RFI #12 — Subject: Roof flashing detail" or "Daily Log on 2026-04-01").
- If the answer isn't in the data, say so clearly and suggest where the user might add the information (e.g., "I don't see this in the RFIs or specifications — try uploading the spec section to the Specifications tool").
- Keep responses concise and scannable. Use short paragraphs or bullet lists.
- Do not invent records, numbers, or quotes. If a field is missing, say so.
- For questions about drawings or specs, the most recent drawing PDFs may be attached as files — read them to answer.`;

  const userPrompt = `${projectHeader}

I have indexed ${recordCount} records across ${fetched.filter((b) => b.rows.length).length} tools for this project.${drawingPdfs.length ? ` ${drawingPdfs.length} drawing PDF${drawingPdfs.length === 1 ? "" : "s"} attached.` : ""}

=== PROJECT DATA ===
${context || "(no records found)"}

=== QUESTION ===
${question}`;

  try {
    const genai = new GoogleGenAI({ apiKey });

    const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [
      { text: userPrompt },
    ];
    for (const pdf of drawingPdfs) {
      parts.push({ inlineData: { mimeType: pdf.mimeType, data: pdf.data } });
    }

    const result = await genai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ role: "user", parts }],
      config: { systemInstruction },
    });

    const answer = (result.text ?? "").trim();

    return NextResponse.json({
      answer: answer || "(no response)",
      stats: {
        recordCount,
        toolsSearched: fetched.filter((b) => b.rows.length).length,
        drawingPdfsAttached: drawingPdfs.length,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI request failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
