import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId, attachmentId } = await params;
  const supabase = getSupabase();

  const { data: row } = await supabase
    .from("scope_division_attachments")
    .select("storage_path")
    .eq("id", attachmentId)
    .eq("project_id", projectId)
    .maybeSingle();

  const { error } = await supabase
    .from("scope_division_attachments")
    .delete()
    .eq("id", attachmentId)
    .eq("project_id", projectId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (row?.storage_path) {
    void supabase.storage.from("project-drawings").remove([row.storage_path]);
  }

  return NextResponse.json({ success: true });
}
