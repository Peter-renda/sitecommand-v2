import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

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

export async function POST(_req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await _req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (!file.name.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: "Only PDF files are accepted" }, { status: 400 });
  }

  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "";
  const bytes = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data: bytes, useWorkerFetch: false, isEvalSupported: false, useSystemFonts: true }).promise;

  const parsedSections: ParsedSection[] = [];
  let active: ParsedSection | null = null;

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const lines = content.items
      .map((item: unknown) => ((item as { str?: string }).str ?? "").trim())
      .filter(Boolean)
      .slice(0, 30);

    const pageHead = lines.join(" ");
    const match = pageHead.match(SECTION_REGEX);
    if (match) {
      const normalizedNumber = match[1].replace(/\s+/g, "");
      const division = normalizedNumber.match(DIVISION_REGEX)?.[1] ?? "00";
      const titleCandidate = lines.find((line) => /section\s+\d/i.test(line)) ?? `Section ${normalizedNumber}`;
      if (active) {
        active.endPage = i - 1;
        active.pageCount = active.endPage - active.startPage + 1;
        parsedSections.push(active);
      }
      active = {
        number: normalizedNumber,
        division,
        title: titleCandidate,
        startPage: i,
        endPage: i,
        pageCount: 1,
      };
      continue;
    }

    if (!active && i === 1) {
      active = {
        number: "UNCLASSIFIED",
        division: "00",
        title: "Unclassified specification pages",
        startPage: 1,
        endPage: 1,
        pageCount: 1,
      };
      continue;
    }

    if (active) active.endPage = i;
  }

  if (active) {
    active.pageCount = active.endPage - active.startPage + 1;
    parsedSections.push(active);
  }

  return NextResponse.json({
    fileName: file.name,
    totalPages: pdf.numPages,
    sections: parsedSections,
  });
}
