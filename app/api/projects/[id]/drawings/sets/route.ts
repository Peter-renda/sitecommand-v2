import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";

const VALID_REV_MODES = new Set(["none", "first_decimal", "first_underscore", "last_underscore"]);

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("drawing_sets")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ sets: data ?? [] });
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
  const name = (body.name ?? "").toString().trim();
  if (!name) return NextResponse.json({ error: "Set name is required" }, { status: 400 });

  const revMode = typeof body.drawing_no_rev_mode === "string" && VALID_REV_MODES.has(body.drawing_no_rev_mode)
    ? body.drawing_no_rev_mode
    : "none";

  const { data, error } = await supabase
    .from("drawing_sets")
    .insert({
      project_id: projectId,
      name,
      default_drawing_date: body.default_drawing_date || null,
      default_received_date: body.default_received_date || null,
      default_revision: body.default_revision || null,
      drawing_no_rev_mode: revMode,
      get_number_from_filename: !!body.get_number_from_filename,
      drawing_language: body.drawing_language || "en",
      created_by: session.id,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "A set with that name already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}
