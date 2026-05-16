import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { getSession } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";

type ExtractedPage = {
  page: number;
  title: string;
  sheet_number: string;
  category: string;
  revision: string;
  date: string;
};

const SYSTEM_INSTRUCTION = `You extract title-block metadata from architectural / engineering drawing PDFs.

The title block is almost always in the bottom-right corner of each sheet. Look there first.

For each page, return these fields:
- title: the sheet title / page title (e.g. "FIRST FLOOR PLAN", "ELECTRICAL RISER DIAGRAM"). Use Title Case.
- sheet_number: the sheet / drawing number printed on the title block (e.g. "A-101", "E2.01", "C-3"). Preserve original formatting.
- category: a single-letter (or two-letter) discipline code derived from the sheet number prefix or content. Use:
  A=Architectural, C=Civil, E=Electrical, M=Mechanical, P=Plumbing, S=Structural,
  L=Landscape, G=General, T=Telecommunications, FP=Fire Protection. Use G when unclear.
- revision: the latest revision number / letter in the revision block (just the value, e.g. "2" or "B"). Empty string if none.
- date: the drawing / issue date in ISO format YYYY-MM-DD. Empty string if not found.

Rules:
- Return ONLY a JSON array, one object per page, in page order.
- Use empty string "" for any field you cannot read with confidence — never invent values.
- Do not include markdown fences, commentary, or any text outside the JSON.`;

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; uploadId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "AI service not configured" }, { status: 503 });

  const { id: projectId, uploadId } = await params;
  const supabase = getSupabase();

  const { data: upload, error: uploadErr } = await supabase
    .from("drawing_uploads")
    .select("id, project_id, storage_path, filename, page_count")
    .eq("id", uploadId)
    .eq("project_id", projectId)
    .single();

  if (uploadErr || !upload) {
    return NextResponse.json({ error: uploadErr?.message ?? "Upload not found" }, { status: 404 });
  }

  const { data: pages, error: pagesErr } = await supabase
    .from("project_drawings")
    .select("id, page_number")
    .eq("upload_id", uploadId)
    .order("page_number");

  if (pagesErr) return NextResponse.json({ error: pagesErr.message }, { status: 500 });
  if (!pages || pages.length === 0) {
    return NextResponse.json({ results: [] });
  }

  const { data: pdfBlob, error: dlErr } = await supabase.storage
    .from("project-drawings")
    .download(upload.storage_path);

  if (dlErr || !pdfBlob) {
    return NextResponse.json({ error: dlErr?.message ?? "Could not download PDF" }, { status: 500 });
  }

  const ai = new GoogleGenAI({ apiKey });

  let fileUri: string;
  let fileMime: string;
  try {
    const uploaded = await ai.files.upload({
      file: pdfBlob,
      config: { mimeType: "application/pdf", displayName: upload.filename },
    });
    if (!uploaded.uri || !uploaded.mimeType) throw new Error("Gemini upload returned no URI");
    fileUri = uploaded.uri;
    fileMime = uploaded.mimeType;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Gemini upload failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  const userPrompt = `This PDF has ${pages.length} page(s). Return a JSON array with one object per page (in order, page 1 first) using this exact shape:
[{"page":1,"title":"","sheet_number":"","category":"","revision":"","date":""}, ...]`;

  let extracted: ExtractedPage[] = [];
  try {
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            { text: userPrompt },
            { fileData: { mimeType: fileMime, fileUri } },
          ],
        },
      ],
      config: { systemInstruction: SYSTEM_INSTRUCTION },
    });

    const raw = (result.text ?? "")
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "");

    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      extracted = parsed as ExtractedPage[];
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Gemini extraction failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  const byPage = new Map<number, ExtractedPage>();
  for (const item of extracted) {
    if (typeof item?.page === "number") byPage.set(item.page, item);
  }

  const results = pages.map((p) => {
    const m = byPage.get(p.page_number);
    return {
      drawing_id: p.id,
      page_number: p.page_number,
      title: m?.title ?? "",
      sheet_number: m?.sheet_number ?? "",
      category: m?.category ?? "",
      revision: m?.revision ?? "",
      date: m?.date ?? "",
    };
  });

  return NextResponse.json({ results });
}
