import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { GoogleGenAI } from "@google/genai";

function parseModelError(err: unknown): { message: string; shouldFallback: boolean } {
  const record = err && typeof err === "object" ? (err as Record<string, unknown>) : null;
  const nested = record?.error && typeof record.error === "object" ? (record.error as Record<string, unknown>) : null;
  const code = nested?.code ?? record?.code;
  const status = String(nested?.status ?? record?.status ?? "").toUpperCase();
  const rawMessage =
    typeof nested?.message === "string"
      ? nested.message
      : typeof record?.message === "string"
        ? record.message
        : err instanceof Error
          ? err.message
          : JSON.stringify(err);
  const message = rawMessage || "AI parsing failed";
  const lower = message.toLowerCase();
  const shouldFallback =
    code === 404 ||
    status.includes("NOT_FOUND") ||
    lower.includes("not_found") ||
    lower.includes("no longer available") ||
    lower.includes("model not found");
  return { message, shouldFallback };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await params;

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  // Extract text from PDF using pdfjs-dist (server-side, no worker)
  const arrayBuffer = await file.arrayBuffer();
  let pdfText = "";

  try {
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = "";
    const pdf = await pdfjs
      .getDocument({ data: new Uint8Array(arrayBuffer), useWorkerFetch: false, isEvalSupported: false, useSystemFonts: true })
      .promise;
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      pdfText +=
        content.items
          .map((item: unknown) => (item as { str?: string }).str ?? "")
          .join(" ") + "\n";
    }
  } catch {
    return NextResponse.json({ error: "Failed to extract text from PDF" }, { status: 400 });
  }

  if (!pdfText.trim()) {
    return NextResponse.json({ error: "No readable text found in PDF" }, { status: 400 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "AI service not configured" }, { status: 503 });

  try {
    const genai = new GoogleGenAI({ apiKey });

    const prompt = `Extract prime contract information from the following document text and return a JSON object.

Valid status values (pick the closest match or null): Draft, Out for Bid, Out for Signature, Approved, Complete, Terminated

Return ONLY a valid JSON object — no markdown, no explanation — with exactly these fields (use null for any field not found):
{
  "contract_number": string or null,
  "title": string or null,
  "owner_client": string or null,
  "contractor": string or null,
  "architect_engineer": string or null,
  "status": string or null,
  "executed": boolean or null,
  "default_retainage": number or null,
  "original_contract_amount": number or null,
  "description": string or null,
  "inclusions": string or null,
  "exclusions": string or null,
  "start_date": "YYYY-MM-DD" or null,
  "estimated_completion_date": "YYYY-MM-DD" or null,
  "actual_completion_date": "YYYY-MM-DD" or null,
  "signed_contract_received_date": "YYYY-MM-DD" or null,
  "contract_termination_date": "YYYY-MM-DD" or null
}

Document text:
${pdfText.slice(0, 10000)}`;

    const result = await genai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    // Strip markdown code fences if present
    let text = (result.text ?? "").trim();
    text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");

    const fields = JSON.parse(text);
    return NextResponse.json({ fields });
  } catch {
    return NextResponse.json({ error: "Failed to parse contract fields from PDF" }, { status: 500 });
  }
}
