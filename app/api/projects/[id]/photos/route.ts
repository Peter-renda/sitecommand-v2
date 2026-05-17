import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;
  const albumId = new URL(req.url).searchParams.get("album_id");
  const supabase = getSupabase();

  let query = supabase
    .from("project_photos")
    .select("*, location:project_locations(id,name,path)")
    .eq("project_id", projectId)
    .order("uploaded_at", { ascending: false });

  if (albumId) query = query.eq("album_id", albumId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;
  const supabase = getSupabase();

  const formData = await req.formData();
  const files = formData.getAll("file") as File[];
  if (!files.length) return NextResponse.json({ error: "No files provided" }, { status: 400 });

  const takenAtRaw = formData.get("taken_at");
  const takenAt = typeof takenAtRaw === "string" && takenAtRaw ? takenAtRaw : null;

  const created: unknown[] = [];

  for (const file of files) {
    const timestamp = Date.now();
    const uniqueId = crypto.randomUUID().slice(0, 8);
    const safeFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `${projectId}/photos/${timestamp}-${uniqueId}-${safeFilename}`;

    const { error: uploadError } = await supabase.storage
      .from("project-photos")
      .upload(storagePath, file, { upsert: false });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data: { publicUrl } } = supabase.storage
      .from("project-photos")
      .getPublicUrl(storagePath);

    const { data, error } = await supabase
      .from("project_photos")
      .insert({
        project_id: projectId,
        storage_path: storagePath,
        url: publicUrl,
        filename: file.name,
        uploaded_by_id: session.id,
        uploaded_by_name: session.username,
        taken_at: takenAt,
      })
      .select("*, location:project_locations(id,name,path)")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    created.push(data);
  }

  return NextResponse.json(created);
}
