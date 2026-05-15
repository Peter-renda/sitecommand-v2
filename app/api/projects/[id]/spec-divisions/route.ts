import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getSession } from "@/lib/auth";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("project_spec_divisions")
    .select("id, number, description")
    .eq("project_id", projectId)
    .order("number", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  const canEdit = session?.company_role === "admin" || session?.company_role === "super_admin";
  if (!session || !canEdit) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;
  const body = await req.json();
  const { number, description } = body ?? {};
  if (!number || typeof number !== "string" || !number.trim())
    return NextResponse.json({ error: "Number is required" }, { status: 400 });
  if (!description || typeof description !== "string" || !description.trim())
    return NextResponse.json({ error: "Description is required" }, { status: 400 });

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("project_spec_divisions")
    .upsert(
      { project_id: projectId, number: number.trim(), description: description.trim() },
      { onConflict: "project_id,number" }
    )
    .select("id, number, description")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
