import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { GoogleGenAI } from "@google/genai";
import { loadPdfjs } from "@/lib/pdfjs-server";
import { getSupabase } from "@/lib/supabase";

type ParsedSection = {
  number: string;
  division: string;
  title: string;
  startPage: number;
  endPage: number;
  pageCount: number;
};

type PageHead = { page: number; text: string };

const SECTION_REGEX = /\bsection\s+(\d{6}(?:\.\d+)?|\d{2}\s?\d{2}\s?\d{2})\b/i;
const DIVISION_REGEX = /^(\d{2})/;
const MAX_PAGE_HEADS = 3000;
const MAX_HEAD_TEXT_LENGTH = 500;

function sanitizePageHeads(input: unknown): PageHead[] {
  if (!Array.isArray(input)) return [];
  return input
    .slice(0, MAX_PAGE_HEADS)
    .map((item) => {
      const candidate = item as { page?: unknown; text?: unknown };
      const page = typeof candidate.page === "number" && Number.isFinite(candidate.page) ? Math.max(1, Math.floor(candidate.page)) : 0;
      const text = typeof candidate.text === "string" ? candidate.text.slice(0, MAX_HEAD_TEXT_LENGTH) : "";
      return { page, text };
    })
    .filter((item) => item.page > 0);
}

function parseSectionsHeuristically(pageHeads: PageHead[]): ParsedSection[] {
  const parsedSections: ParsedSection[] = [];
  let active: ParsedSection | null = null;

  for (const { page, text } of pageHeads) {
    const match = text.match(SECTION_REGEX);
    if (match) {
      const normalizedNumber = match[1].replace(/\s+/g, "");
      const division = normalizedNumber.match(DIVISION_REGEX)?.[1] ?? "00";
      if (active) {
        active.endPage = page - 1;
        active.pageCount = active.endPage - active.startPage + 1;
        parsedSections.push(active);
      }
      active = {
        number: normalizedNumber,
        division,
        title: `Section ${normalizedNumber}`,
        startPage: page,
        endPage: page,
        pageCount: 1,
      };
      continue;
    }
    if (!active && page === 1) {
      active = { number: "UNCLASSIFIED", division: "00", title: "Unclassified specification pages", startPage: 1, endPage: 1, pageCount: 1 };
      continue;
    }
    if (active) active.endPage = page;
  }

  if (active) {
    active.pageCount = active.endPage - active.startPage + 1;
    parsedSections.push(active);
  }
  return parsedSections;
}

async function refineSectionsWithGemini(pageHeads: PageHead[], fallbackSections: ParsedSection[]): Promise<ParsedSection[]> {
  if (!process.env.GEMINI_API_KEY || pageHeads.length === 0) return fallbackSections;

  try {
    const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const prompt = `Given page headers from a specification PDF, detect section starts and return JSON array:
[{"number":"010200","division":"01","title":"Section 010200","startPage":1,"endPage":3,"pageCount":3}]
Rules: section number comes from "Section XXXXXX". Keep contiguous pages under last section.
If unknown before first section, use number "UNCLASSIFIED" and division "00". Return JSON only.
Page headers:
${pageHeads.map((p) => `Page ${p.page}: ${p.text}`).join("\n")}`;
    const result = await genai.models.generateContent({ model: "gemini-2.5-flash", contents: prompt });
    const raw = (result.text ?? "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    const aiSections = JSON.parse(raw);
    if (Array.isArray(aiSections) && aiSections.length > 0) return aiSections as ParsedSection[];
  } catch {
    // Fall back to heuristic parsing silently: AI refinement is optional.
  }

  return fallbackSections;
}

async function extractPageHeadsFromStorage(storagePath: string): Promise<{ totalPages: number; pageHeads: PageHead[] }> {
  const supabase = getSupabase();
  const { data: fileBlob, error: downloadError } = await supabase.storage
    .from("project-drawings")
    .download(storagePath);

  if (downloadError || !fileBlob) {
    throw new Error(downloadError?.message ?? "Download failed");
  }

  const pdfjs = await loadPdfjs();
  const bytes = new Uint8Array(await fileBlob.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data: bytes, useWorkerFetch: false, isEvalSupported: false, useSystemFonts: true }).promise;
  const pageHeads: PageHead[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const lines = content.items
      .map((item: unknown) => ((item as { str?: string }).str ?? "").trim())
      .filter(Boolean)
      .slice(0, 30);

    pageHeads.push({ page: i, text: lines.join(" ").slice(0, MAX_HEAD_TEXT_LENGTH) });
  }

  const totalPages = pdf.numPages;
  await pdf.destroy();
  return { totalPages, pageHeads };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;

  let body: { storagePath?: string; filename?: string; pageHeads?: unknown; totalPages?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON body" }, { status: 400 });
  }

  const filename = body?.filename;
  if (!filename) {
    return NextResponse.json({ error: "filename is required" }, { status: 400 });
  }
  if (!filename.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: "Only PDF files are accepted" }, { status: 400 });
  }

  const providedPageHeads = sanitizePageHeads(body.pageHeads);
  let storagePathToCleanUp: string | null = null;

  try {
    let totalPages = typeof body.totalPages === "number" && Number.isFinite(body.totalPages) ? Math.floor(body.totalPages) : providedPageHeads.length;
    let pageHeads = providedPageHeads;

    if (pageHeads.length === 0) {
      const storagePath = body?.storagePath;
      if (!storagePath) {
        return NextResponse.json({ error: "pageHeads are required" }, { status: 400 });
      }
      // Guard against arbitrary path traversal: temp files must live under this
      // project's _spec-parse/ prefix that parse-upload-url issues into.
      if (!storagePath.startsWith(`${projectId}/_spec-parse/`)) {
        return NextResponse.json({ error: "Invalid storagePath" }, { status: 400 });
      }
      storagePathToCleanUp = storagePath;
      const extracted = await extractPageHeadsFromStorage(storagePath);
      totalPages = extracted.totalPages;
      pageHeads = extracted.pageHeads;
    }

    const fallbackSections = parseSectionsHeuristically(pageHeads);
    const parsedSections = await refineSectionsWithGemini(pageHeads, fallbackSections);

    return NextResponse.json({
      fileName: filename,
      totalPages,
      sections: parsedSections,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to parse PDF";
    return NextResponse.json({ error: message }, { status: 400 });
  } finally {
    if (storagePathToCleanUp) {
      void getSupabase().storage.from("project-drawings").remove([storagePathToCleanUp]);
    }
  }
}
