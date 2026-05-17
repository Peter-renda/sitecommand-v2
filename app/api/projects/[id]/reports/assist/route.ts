import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { canAccessProject } from "@/lib/project-access";
import { GoogleGenAI, Type } from "@google/genai";
import { REPORT_TYPES } from "@/app/projects/[id]/reporting/report-types";

export const maxDuration = 60;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;
  const hasAccess = await canAccessProject(projectId, session);
  if (!hasAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "AI service not configured" }, { status: 503 });

  let body: { prompt?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const prompt = (body.prompt ?? "").trim();
  if (!prompt) return NextResponse.json({ error: "Prompt is required" }, { status: 400 });

  const manifest = REPORT_TYPES.map((r) => ({
    value: r.value,
    label: r.label,
    group: r.group,
    description: r.description,
    columns: r.columns.map((c) => ({ key: c.key, label: c.label })),
  }));

  const validValues = REPORT_TYPES.map((r) => r.value);

  const systemInstruction = `You are SiteCommand Assist, an AI assistant that converts a user's plain-language request into a single-tool report definition.

You will be given a catalog of available report types. Each type has a stable "value" identifier, a human label, the construction tool it lives under, a short description, and a list of available columns (each with a "key" and "label").

Your task:
1. Pick the SINGLE report type whose data best matches the user's request.
2. Pick the subset of that report type's columns that directly answer the request. Prefer fewer, more relevant columns. Always include any column the user explicitly mentioned (e.g. "created by", "comments", "company", "hours").
3. Generate a short report name (max 60 chars) describing the report.
4. Generate a one-sentence description (max 160 chars) explaining what the report shows.

Constraints:
- "reportType" MUST be exactly one of the provided "value" strings.
- "columns" MUST be a non-empty list of column "key" strings that exist in the chosen report's columns list.
- Do not invent columns or report types.`;

  const userPrompt = `Available report types (JSON):
${JSON.stringify(manifest, null, 2)}

User request:
"""
${prompt}
"""

Return JSON describing the best single-tool report and its columns.`;

  try {
    const genai = new GoogleGenAI({ apiKey });
    const result = await genai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            reportType: { type: Type.STRING },
            columns: { type: Type.ARRAY, items: { type: Type.STRING } },
            name: { type: Type.STRING },
            description: { type: Type.STRING },
            reasoning: { type: Type.STRING },
          },
          required: ["reportType", "columns", "name", "description"],
        },
      },
    });

    const raw = (result.text ?? "").trim();
    let parsed: {
      reportType?: string;
      columns?: string[];
      name?: string;
      description?: string;
      reasoning?: string;
    };
    try {
      parsed = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: "AI returned an unparseable response" }, { status: 502 });
    }

    const reportType = typeof parsed.reportType === "string" ? parsed.reportType : "";
    if (!validValues.includes(reportType)) {
      return NextResponse.json(
        { error: `AI selected an unknown report type: "${reportType}"` },
        { status: 502 },
      );
    }

    const def = REPORT_TYPES.find((r) => r.value === reportType)!;
    const validKeys = new Set(def.columns.map((c) => c.key));
    const requestedCols = Array.isArray(parsed.columns) ? parsed.columns : [];
    const columns = requestedCols.filter((k): k is string => typeof k === "string" && validKeys.has(k));

    // Fallback: if AI returned nothing valid, default to the full column list so the report is usable.
    const finalColumns = columns.length > 0 ? columns : def.columns.map((c) => c.key);

    const name =
      typeof parsed.name === "string" && parsed.name.trim()
        ? parsed.name.trim().slice(0, 80)
        : def.label;
    const description =
      typeof parsed.description === "string" && parsed.description.trim()
        ? parsed.description.trim().slice(0, 200)
        : def.description;

    return NextResponse.json({
      reportType,
      columns: finalColumns,
      name,
      description,
      reasoning: typeof parsed.reasoning === "string" ? parsed.reasoning : "",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI request failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
