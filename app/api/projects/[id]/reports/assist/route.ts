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

  const systemInstruction = `You are SiteCommand Assist, an AI assistant that converts a user's plain-language request into a complete, ready-to-run single-tool report definition.

You will be given a catalog of available report types. Each type has a stable "value" identifier, a human label, the construction tool it lives under, a short description, and a list of available columns (each with a "key" and "label").

Your task:
1. Pick the SINGLE report type whose data best matches the user's request.
2. Pick the subset of that report type's columns that directly answer the request. Prefer fewer, more relevant columns. Always include any column the user explicitly mentioned (e.g. "created by", "comments", "company", "hours"). Order the "columns" array in the natural left-to-right reading order for the report (identifier/date first, then descriptive fields, then numeric/measure fields).
3. Decide how the report should be sorted by default. Set "sortByKey" to the column key that best answers the user's intent (typically a date for time-series, or a measure for ranking). Set "sortDirection" to "asc" or "desc" — pick "desc" for "latest", "top", "highest", "most recent"; pick "asc" for chronological or alphabetical orderings. If no sort is clearly useful, omit both.
4. Decide whether the report should be grouped. If the user's request implies grouping ("by company", "per status", "per type", "broken out by category") or the natural read of the data is grouped (status, type, location, assignee, company, role), set "groupByKey" to that column key. Otherwise omit it. The grouped column must also appear in "columns".
5. If the user's request implies a derived metric that is NOT a raw column (for example "delay duration in days from hours", "cost per hour", "variance between two dates", "percent complete"), propose one or two "calculatedColumns". Each calculated column has:
   - "name": short label (max 40 chars)
   - "output": one of "number" | "currency" | "percent" | "date-variance"
   - "leftSource": a column "key" from the chosen report, OR the literal string "constant"
   - "operator": one of "+", "-", "*", "/"
   - "rightSource": a column "key", OR "constant"
   - "leftConstant" / "rightConstant": numeric values, ONLY when the matching source is "constant"
   - "decimals": integer 0-4 (use 0 for "date-variance")
   - "rounding": true to round, false to truncate
   If no calculation is needed, return an empty array.
6. Generate a short report name (max 60 chars) describing the report.
7. Generate a one-sentence description (max 160 chars) explaining what the report shows.

Constraints:
- "reportType" MUST be exactly one of the provided "value" strings.
- "columns" MUST be a non-empty list of column "key" strings that exist in the chosen report's columns list.
- "sortByKey", when present, MUST be one of the chosen report's column keys (NOT a calculated column).
- "groupByKey", when present, MUST be one of the chosen report's column keys AND MUST also be included in "columns".
- "calculatedColumns" sources MUST be either column "key" strings from the chosen report or the literal "constant".
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
            sortByKey: { type: Type.STRING },
            sortDirection: { type: Type.STRING },
            groupByKey: { type: Type.STRING },
            calculatedColumns: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  output: { type: Type.STRING },
                  leftSource: { type: Type.STRING },
                  operator: { type: Type.STRING },
                  rightSource: { type: Type.STRING },
                  leftConstant: { type: Type.NUMBER },
                  rightConstant: { type: Type.NUMBER },
                  decimals: { type: Type.INTEGER },
                  rounding: { type: Type.BOOLEAN },
                },
                required: ["name", "output", "leftSource", "operator", "rightSource"],
              },
            },
            name: { type: Type.STRING },
            description: { type: Type.STRING },
            reasoning: { type: Type.STRING },
          },
          required: ["reportType", "columns", "name", "description"],
        },
      },
    });

    const raw = (result.text ?? "").trim();
    type AssistCalcCol = {
      name?: unknown;
      output?: unknown;
      leftSource?: unknown;
      operator?: unknown;
      rightSource?: unknown;
      leftConstant?: unknown;
      rightConstant?: unknown;
      decimals?: unknown;
      rounding?: unknown;
    };
    let parsed: {
      reportType?: string;
      columns?: string[];
      sortByKey?: string;
      sortDirection?: string;
      groupByKey?: string;
      calculatedColumns?: AssistCalcCol[];
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

    const sortByKey =
      typeof parsed.sortByKey === "string" && validKeys.has(parsed.sortByKey) ? parsed.sortByKey : undefined;
    const sortDirection: "asc" | "desc" | undefined =
      parsed.sortDirection === "desc" ? "desc" : parsed.sortDirection === "asc" ? "asc" : undefined;
    const finalColumnSet = new Set(finalColumns);
    const groupByKey =
      typeof parsed.groupByKey === "string" &&
      validKeys.has(parsed.groupByKey) &&
      finalColumnSet.has(parsed.groupByKey)
        ? parsed.groupByKey
        : undefined;

    const calcOutputs = new Set(["number", "currency", "percent", "date-variance"]);
    const calcOps = new Set(["+", "-", "*", "/"]);
    const rawCalcs = Array.isArray(parsed.calculatedColumns) ? parsed.calculatedColumns : [];
    const calculatedColumns = rawCalcs
      .map((c) => {
        const name = typeof c.name === "string" ? c.name.trim().slice(0, 80) : "";
        const output = typeof c.output === "string" && calcOutputs.has(c.output) ? c.output : "number";
        const operator = typeof c.operator === "string" && calcOps.has(c.operator) ? c.operator : "+";
        const leftSource =
          typeof c.leftSource === "string" && (c.leftSource === "constant" || validKeys.has(c.leftSource))
            ? c.leftSource
            : "constant";
        const rightSource =
          typeof c.rightSource === "string" && (c.rightSource === "constant" || validKeys.has(c.rightSource))
            ? c.rightSource
            : "constant";
        if (!name) return null;
        return {
          name,
          output,
          leftSource,
          operator,
          rightSource,
          leftConstant: typeof c.leftConstant === "number" ? c.leftConstant : undefined,
          rightConstant: typeof c.rightConstant === "number" ? c.rightConstant : undefined,
          decimals:
            output === "date-variance"
              ? 0
              : typeof c.decimals === "number" && Number.isFinite(c.decimals)
                ? Math.max(0, Math.min(4, Math.round(c.decimals)))
                : 2,
          rounding: typeof c.rounding === "boolean" ? c.rounding : true,
        };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null);

    return NextResponse.json({
      reportType,
      columns: finalColumns,
      sortByKey,
      sortDirection,
      groupByKey,
      calculatedColumns,
      name,
      description,
      reasoning: typeof parsed.reasoning === "string" ? parsed.reasoning : "",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI request failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
