import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getSession } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  const isOrgAdmin =
    session?.company_role === "admin" || session?.company_role === "super_admin";
  if (!session || !isOrgAdmin || !session.company_id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const supabase = getSupabase();

  const { data: project, error: fetchError } = await supabase
    .from("projects")
    .select("id, company_id, archived_at")
    .eq("id", id)
    .single();

  if (fetchError || !project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  if (project.company_id !== session.company_id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (project.archived_at) {
    return NextResponse.json({ error: "Project is already archived" }, { status: 400 });
  }

  const { data: updated, error: updateError } = await supabase
    .from("projects")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  // Remove project-level access for everyone who had it. Data remains intact;
  // company admins/super-admins retain access via company_id ownership.
  await supabase.from("project_memberships").delete().eq("project_id", id);

  await logActivity(supabase, {
    projectId: id,
    userId: session.id,
    type: "project_archived",
    description: "Project archived",
  });

  return NextResponse.json(updated);
}
