import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; drawingId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId, drawingId } = await params;
  const supabase = getSupabase();

  const body = await req.json();
  const { drawing_no, title, revision, drawing_date, received_date, category, report_fields } = body;

  const { data, error } = await supabase
    .from("project_drawings")
    .update({
      drawing_no: drawing_no ?? null,
      title: title ?? null,
      revision: revision ?? null,
      drawing_date: drawing_date || null,
      received_date: received_date || null,
      category: category ?? null,
      ...(report_fields !== undefined ? { report_fields } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", drawingId)
    .eq("project_id", projectId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; drawingId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId, drawingId } = await params;
  const supabase = getSupabase();

  // Get the drawing to find its upload_id and per-page storage path
  const { data: drawing, error: fetchError } = await supabase
    .from("project_drawings")
    .select("upload_id, storage_path")
    .eq("id", drawingId)
    .eq("project_id", projectId)
    .single();

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });

  const { upload_id: uploadId, storage_path: pageStoragePath } = drawing;

  // Delete the drawing page row
  const { error: deleteError } = await supabase
    .from("project_drawings")
    .delete()
    .eq("id", drawingId)
    .eq("project_id", projectId);

  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });

  // Remove the per-page PDF from storage (if it has its own file)
  if (pageStoragePath) {
    await supabase.storage.from("project-drawings").remove([pageStoragePath]);
  }

  // If this was the last page, clean up the upload record too
  const { count } = await supabase
    .from("project_drawings")
    .select("id", { count: "exact", head: true })
    .eq("upload_id", uploadId);

  if (count === 0) {
    const { data: upload } = await supabase
      .from("drawing_uploads")
      .select("storage_path")
      .eq("id", uploadId)
      .single();

    if (upload?.storage_path) {
      await supabase.storage.from("project-drawings").remove([upload.storage_path]);
    }

    await supabase.from("drawing_uploads").delete().eq("id", uploadId);
  }

  return NextResponse.json({ ok: true });
}
