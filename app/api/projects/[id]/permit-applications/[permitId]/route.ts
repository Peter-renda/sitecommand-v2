import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";
import { getToolLevel } from "@/lib/tool-permissions";

// Deletes a completed permit application. Allowed for a Permit Applications
// admin or the user who created the record.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; permitId: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId, permitId } = await params;
  const supabase = getSupabase();

  const { data: row, error: loadError } = await supabase
    .from("project_permit_applications")
    .select("final_storage_path, created_by")
    .eq("id", permitId)
    .eq("project_id", projectId)
    .maybeSingle();
  if (loadError) return NextResponse.json({ error: loadError.message }, { status: 500 });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const level = await getToolLevel(session, projectId, "permit-applications");
  const isCreator = row.created_by === session.id;
  if (level !== "admin" && !isCreator) {
    return NextResponse.json(
      { error: "Only an admin or the creator can delete this permit application." },
      { status: 403 },
    );
  }

  const { error: deleteError } = await supabase
    .from("project_permit_applications")
    .delete()
    .eq("id", permitId)
    .eq("project_id", projectId);
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });

  if (row.final_storage_path) {
    void supabase.storage.from("project-drawings").remove([row.final_storage_path]);
  }

  return NextResponse.json({ ok: true });
}
