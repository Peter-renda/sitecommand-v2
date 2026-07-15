import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; photoId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId, photoId } = await params;
  const body = await req.json();
  const supabase = getSupabase();

  const allowed: Record<string, unknown> = {};
  if ("caption" in body) allowed.caption = body.caption;
  if ("album_id" in body) allowed.album_id = body.album_id;
  if ("location_id" in body) allowed.location_id = body.location_id;
  if ("taken_at" in body) allowed.taken_at = body.taken_at;
  if ("trades" in body) {
    allowed.trades = Array.isArray(body.trades)
      ? body.trades.map((t: unknown) => String(t).trim()).filter(Boolean)
      : [];
  }

  const { data, error } = await supabase
    .from("project_photos")
    .update(allowed)
    .eq("id", photoId)
    .eq("project_id", projectId)
    .select("*, location:project_locations(id,name,path)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; photoId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId, photoId } = await params;
  const supabase = getSupabase();

  const { data: photo, error: fetchError } = await supabase
    .from("project_photos")
    .select("storage_path")
    .eq("id", photoId)
    .eq("project_id", projectId)
    .single();

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });

  await supabase.storage.from("project-photos").remove([photo.storage_path]);

  const { error } = await supabase
    .from("project_photos")
    .delete()
    .eq("id", photoId)
    .eq("project_id", projectId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
