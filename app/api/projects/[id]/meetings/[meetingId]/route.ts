import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getSession } from "@/lib/auth";

type Params = { params: Promise<{ id: string; meetingId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId, meetingId } = await params;
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("meetings")
    .select("*")
    .eq("id", meetingId)
    .eq("project_id", projectId)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId, meetingId } = await params;
  const supabase = getSupabase();

  const body = await req.json();

  // Only allow safe fields to be patched
  const allowed = [
    "title", "series", "overview", "date", "end_date", "location", "status",
    "template", "meeting_link", "timezone", "start_time", "end_time",
    "is_private", "is_draft", "attendees", "notes", "agenda", "is_locked",
    "report_fields",
  ];
  const patch: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) patch[key] = body[key];
  }

  const { data, error } = await supabase
    .from("meetings")
    .update(patch)
    .eq("id", meetingId)
    .eq("project_id", projectId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
