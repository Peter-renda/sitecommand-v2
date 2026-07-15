import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { canAccessProject } from "@/lib/project-access";
import { getSupabase } from "@/lib/supabase";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; historyId: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId, historyId } = await params;
  const hasAccess = await canAccessProject(projectId, session);
  if (!hasAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getSupabase();
  const { error } = await supabase
    .from("project_assist_history")
    .delete()
    .eq("id", historyId)
    .eq("project_id", projectId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
