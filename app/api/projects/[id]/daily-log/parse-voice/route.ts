import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { canAccessProject } from "@/lib/project-access";
import { GoogleGenAI, Type } from "@google/genai";

export const maxDuration = 60;

const WEATHER_CONDITIONS = [
  "Clear", "Partly Cloudy", "Cloudy", "Light Rain",
  "Heavy Rain", "Snow", "Fog", "Windy", "Other",
];
const SKY_OPTIONS = ["Clear", "Partly Cloudy", "Cloudy", "Overcast", "Fog"];
const DELAY_TYPES = [
  "Weather", "Labor", "Material", "Equipment",
  "Design", "Owner", "Subcontractor", "Other",
];

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;
  const hasAccess = await canAccessProject(projectId, session);
  if (!hasAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "AI service not configured" }, { status: 503 });

  let body: { transcript?: string; companySuggestions?: string[]; logDate?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const transcript = (body.transcript ?? "").trim();
  if (!transcript) return NextResponse.json({ error: "Transcript is required" }, { status: 400 });

  const companySuggestions = Array.isArray(body.companySuggestions)
    ? body.companySuggestions.filter((c): c is string => typeof c === "string").slice(0, 200)
    : [];

  const systemInstruction = `You convert a construction project manager's spoken daily-log narration into structured entries that will be reviewed and saved into a daily log form.

You will be given:
- The raw transcript.
- A list of known company names that exist in the project directory (use the closest match when the speaker mentions a company; only fall back to the spoken name if no reasonable match exists).
- The supported daily log sections and the allowed dropdown values.

Rules:
- Only fill fields you have evidence for in the transcript. Leave anything unstated as empty string "".
- Times must be 24-hour "HH:MM". If only a rough hour is mentioned ("around 2pm"), use "14:00".
- Numbers (workers, hours) must be plain numerics as strings, e.g. "6" or "8".
- For "weather.conditions" pick the closest value from the allowed list, or "".
- For "delays[].delay_type" pick the closest value from the allowed list, or "".
- For company fields, prefer an exact match from the provided companySuggestions list; otherwise use the closest match by lowercase substring comparison; otherwise return the spoken name verbatim.
- Do NOT invent entries that were not mentioned. An empty section is fine.
- "comments" should be a short faithful paraphrase of what was said about that entry, not the entire transcript.
- Set "note_entries[].is_issue" = true only when the speaker explicitly flags a problem, issue, blocker, or concern.`;

  const userPrompt = `Transcript:
"""
${transcript}
"""

Known company names (use these when matching):
${companySuggestions.length ? companySuggestions.map((c) => `- ${c}`).join("\n") : "(none)"}

Allowed weather conditions: ${WEATHER_CONDITIONS.join(", ")}
Allowed delay types: ${DELAY_TYPES.join(", ")}
Allowed sky options: ${SKY_OPTIONS.join(", ")}

Return a JSON object that captures every entry the speaker mentioned.`;

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
            weather: {
              type: Type.OBJECT,
              properties: {
                conditions: { type: Type.STRING },
                temperature: { type: Type.STRING },
                wind: { type: Type.STRING },
                humidity: { type: Type.STRING },
              },
            },
            manpower: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  company: { type: Type.STRING },
                  workers: { type: Type.STRING },
                  hours: { type: Type.STRING },
                  location: { type: Type.STRING },
                  cost_code: { type: Type.STRING },
                  comments: { type: Type.STRING },
                },
              },
            },
            inspections: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  start_time: { type: Type.STRING },
                  end_time: { type: Type.STRING },
                  inspection_type: { type: Type.STRING },
                  inspecting_entity: { type: Type.STRING },
                  inspector_name: { type: Type.STRING },
                  location: { type: Type.STRING },
                  inspection_area: { type: Type.STRING },
                  comments: { type: Type.STRING },
                },
              },
            },
            deliveries: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  time: { type: Type.STRING },
                  delivery_from: { type: Type.STRING },
                  tracking_number: { type: Type.STRING },
                  contents: { type: Type.STRING },
                  comments: { type: Type.STRING },
                },
              },
            },
            visitors: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  visitor: { type: Type.STRING },
                  start_time: { type: Type.STRING },
                  end_time: { type: Type.STRING },
                  comments: { type: Type.STRING },
                },
              },
            },
            safety_violations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  time: { type: Type.STRING },
                  subject: { type: Type.STRING },
                  safety_notice: { type: Type.STRING },
                  issued_to: { type: Type.STRING },
                  compliance_due: { type: Type.STRING },
                  comments: { type: Type.STRING },
                },
              },
            },
            accidents: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  time: { type: Type.STRING },
                  party_involved: { type: Type.STRING },
                  company_involved: { type: Type.STRING },
                  comments: { type: Type.STRING },
                },
              },
            },
            delays: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  delay_type: { type: Type.STRING },
                  start_time: { type: Type.STRING },
                  end_time: { type: Type.STRING },
                  location: { type: Type.STRING },
                  comments: { type: Type.STRING },
                },
              },
            },
            note_entries: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  is_issue: { type: Type.BOOLEAN },
                  location: { type: Type.STRING },
                  comments: { type: Type.STRING },
                },
              },
            },
          },
        },
      },
    });

    const raw = (result.text ?? "").trim();
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: "AI returned an unparseable response" }, { status: 502 });
    }

    return NextResponse.json({ transcript, parsed });
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI request failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
