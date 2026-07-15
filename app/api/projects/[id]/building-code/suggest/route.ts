import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";
import { GoogleGenAI } from "@google/genai";

export const maxDuration = 120;

function isSuperAdmin(session: { company_role?: string | null }): boolean {
  return session.company_role === "super_admin";
}

type Suggestion = { title?: string; jurisdiction?: string; url?: string; notes?: string };

// Pull a JSON array out of a model response that may be wrapped in prose or a
// ```json fence (googleSearch grounding can't be combined with JSON response
// mode, so we parse leniently).
function parseSuggestions(text: string): Suggestion[] {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("[");
  const end = candidate.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) return [];
  try {
    const parsed = JSON.parse(candidate.slice(start, end + 1));
    return Array.isArray(parsed) ? (parsed as Suggestion[]) : [];
  } catch {
    return [];
  }
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session || !isSuperAdmin(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "AI service not configured" }, { status: 503 });

  const { id: projectId } = await params;
  const supabase = getSupabase();

  const { data: project } = await supabase
    .from("projects")
    .select("name, address, city, state, county, zip_code")
    .eq("id", projectId)
    .single();

  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const locationParts = [project.address, project.city, project.county ? `${project.county} County` : "", project.state, project.zip_code]
    .map((p) => (typeof p === "string" ? p.trim() : ""))
    .filter(Boolean);
  if (!project.city && !project.county && !project.state) {
    return NextResponse.json(
      { error: "Add the project's city, county, or state under Project Location first." },
      { status: 400 },
    );
  }
  const location = locationParts.join(", ");

  const prompt = `Use Google Search to find the official building code documents and pages that apply to a construction project at this location:

${location}

Find the authoritative, currently-adopted building code references for this jurisdiction, prioritizing:
- The CITY's adopted building code (and the city's building/permitting department code page).
- The COUNTY's adopted building code (and the county's building/permitting department code page).
- The STATE building code that the city/county adopts or amends, if applicable.

Prefer official government (.gov) or recognized code-publisher sources (e.g. UpCodes, ICC, the state/county/city government site). Prefer direct links to the code text or the official code landing page over news articles or blogs. Only include links you actually found via search and are confident are real and relevant. Do not invent URLs.

Return ONLY a JSON array (no prose) of up to 8 objects, each:
{
  "title": "short human name, e.g. 'City of Raleigh Building Code'",
  "jurisdiction": "City" | "County" | "State" | "Other",
  "url": "https://...",
  "notes": "one short sentence on what this covers / which code edition"
}`;

  const ai = new GoogleGenAI({ apiKey });
  let text = "";
  try {
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { tools: [{ googleSearch: {} }] },
    });
    text = (result.text ?? "").trim();
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI request failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const suggestions = parseSuggestions(text)
    .map((s) => ({
      title: typeof s.title === "string" ? s.title.trim() : "",
      jurisdiction: typeof s.jurisdiction === "string" ? s.jurisdiction.trim() : "",
      url: typeof s.url === "string" ? s.url.trim() : "",
      notes: typeof s.notes === "string" ? s.notes.trim() : "",
    }))
    .filter((s) => s.title && /^https?:\/\//i.test(s.url));

  // Dedupe against everything we've ever stored for this project (any status), so
  // approved/ignored links are never re-suggested.
  const { data: existing } = await supabase
    .from("project_building_code_documents")
    .select("url")
    .eq("project_id", projectId);
  const seen = new Set(
    ((existing ?? []) as Array<{ url: string | null }>)
      .map((r) => (r.url ?? "").trim().toLowerCase())
      .filter(Boolean),
  );

  const toInsert = suggestions
    .filter((s) => {
      const key = s.url.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((s) => ({
      project_id: projectId,
      title: s.title,
      jurisdiction: s.jurisdiction || null,
      doc_type: "link",
      url: s.url,
      source: "ai",
      status: "suggested",
      notes: s.notes || null,
      created_by: session.id,
    }));

  if (toInsert.length) {
    const { error } = await supabase.from("project_building_code_documents").insert(toInsert);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Return the full current suggested list so the client can refresh.
  const { data: suggested } = await supabase
    .from("project_building_code_documents")
    .select("id, title, jurisdiction, doc_type, url, filename, source, status, notes, created_at")
    .eq("project_id", projectId)
    .eq("status", "suggested")
    .order("created_at", { ascending: true });

  return NextResponse.json({
    created: toInsert.length,
    suggested: (suggested ?? []).map((r) => ({
      id: r.id,
      title: r.title,
      jurisdiction: r.jurisdiction,
      docType: r.doc_type,
      url: r.url,
      filename: r.filename,
      source: r.source,
      status: r.status,
      notes: r.notes,
      createdAt: r.created_at,
    })),
  });
}
