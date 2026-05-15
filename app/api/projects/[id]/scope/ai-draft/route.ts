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
  const message = rawMessage || "AI generation failed";
  const lower = message.toLowerCase();
  const shouldFallback =
    code === 404 ||
    status.includes("NOT_FOUND") ||
    lower.includes("not_found") ||
    lower.includes("no longer available") ||
    lower.includes("model not found");
  return { message, shouldFallback };
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await params; // consume params

  const body = await req.json();
  const { divisionCode, divisionName, sectionName, projectName, projectType } = body;

  if (!divisionCode || !divisionName) {
    return NextResponse.json({ error: "Division code and name are required" }, { status: 400 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "AI service not configured" }, { status: 503 });
  }

  try {
    const genai = new GoogleGenAI({ apiKey });

    const sectionPart = sectionName ? ` — Section: ${sectionName}` : "";
    const projectPart = projectName ? ` for the project "${projectName}"` : "";
    const typePart = projectType ? ` (project type: ${projectType})` : "";

    const prompt = `Write a professional Scope of Work paragraph for a construction project${projectPart}${typePart}.

CSI MasterFormat Division: ${divisionCode} – ${divisionName}${sectionPart}

Requirements:
- Write 3 to 5 sentences
- Be specific, professional, and use standard construction industry language
- Describe what work is included, quality standards, and any key requirements
- Do not use bullet points or headers — write in paragraph form only
- Do not include any preamble like "Here is a scope..." — just provide the scope text directly`;

    const result = await genai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });
    const text = (result.text ?? "").trim();

    return NextResponse.json({ text });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "AI generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
