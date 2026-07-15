import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";

// Built-in disciplines that always exist regardless of project. These map a
// short code (stored in project_drawings.category) to a display label. Custom
// disciplines created by users are stored by label in
// project_drawing_disciplines and write their label directly to category.
const BUILTIN_LABELS = new Set([
  "Architectural", "Civil", "Electrical", "Mechanical", "Plumbing",
  "Structural", "Landscape", "General", "Telecommunications", "Fire Protection",
]);

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("project_drawing_disciplines")
    .select("id, label, created_at")
    .eq("project_id", projectId)
    .order("label", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ disciplines: data ?? [] });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;
  const supabase = getSupabase();

  const body = await req.json();
  const label = (body.label ?? "").toString().trim();
  if (!label) return NextResponse.json({ error: "Discipline name is required" }, { status: 400 });

  // Don't create a custom discipline that duplicates a built-in (case-insensitive).
  for (const builtin of BUILTIN_LABELS) {
    if (builtin.toLowerCase() === label.toLowerCase()) {
      return NextResponse.json({ discipline: { label: builtin } });
    }
  }

  const { data, error } = await supabase
    .from("project_drawing_disciplines")
    .insert({ project_id: projectId, label, created_by: session.id })
    .select("id, label, created_at")
    .single();

  if (error) {
    // Unique violation — the discipline already exists for this project. Return it.
    if (error.code === "23505") {
      const { data: existing } = await supabase
        .from("project_drawing_disciplines")
        .select("id, label, created_at")
        .eq("project_id", projectId)
        .ilike("label", label)
        .single();
      if (existing) return NextResponse.json({ discipline: existing });
      return NextResponse.json({ error: "A discipline with that name already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ discipline: data });
}
