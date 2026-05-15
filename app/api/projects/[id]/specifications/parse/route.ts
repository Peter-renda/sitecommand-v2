import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { GoogleGenAI } from "@google/genai";
import { loadPdfjs } from "@/lib/pdfjs-server";

type ParsedSection = {
  number: string;
  division: string;
  title: string;
  startPage: number;
  endPage: number;
  pageCount: number;
};

const SECTION_REGEX = /\bsection\s+(\d{6}(?:\.\d+)?|\d{2}\s?\d{2}\s?\d{2})\b/i;
const DIVISION_REGEX = /^(\d{2})/;

function parseSectionsHeuristically(pageHeads: Array<{ page: number; text: string }>): ParsedSection[] {
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

export async function POST(_req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await _req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (!file.name.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: "Only PDF files are accepted" }, { status: 400 });
  }

  try {
    const pdfjs = await loadPdfjs();
    const bytes = new Uint8Array(await file.arrayBuffer());
    const pdf = await pdfjs.getDocument({ data: bytes, useWorkerFetch: false, isEvalSupported: false, useSystemFonts: true }).promise;

    const pageHeads: Array<{ page: number; text: string }> = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const lines = content.items
        .map((item: unknown) => ((item as { str?: string }).str ?? "").trim())
        .filter(Boolean)
        .slice(0, 30);

      pageHeads.push({ page: i, text: lines.join(" ").slice(0, 500) });
    }

    let parsedSections = parseSectionsHeuristically(pageHeads);

    // Optional Gemini refinement when configured: helps when text extraction is noisy.
    if (process.env.GEMINI_API_KEY && pageHeads.length > 0) {
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
        if (Array.isArray(aiSections) && aiSections.length > 0) parsedSections = aiSections as ParsedSection[];
      } catch {
        // fall back to heuristic parse silently
      }
    }

    return NextResponse.json({
      fileName: file.name,
      totalPages: pdf.numPages,
      sections: parsedSections,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to parse PDF";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
