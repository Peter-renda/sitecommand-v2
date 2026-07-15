import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getSession } from "@/lib/auth";
import { addUserToDirectory } from "@/lib/directory";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await getSession();
  const isOrgAdmin = session.company_role === "super_admin" || session.company_role === "admin";
  if (!session || !isOrgAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId } = await params;
  const supabase = getSupabase();

  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, status")
    .eq("company_id", session.company_id)
    .is("archived_at", null)
    .order("created_at", { ascending: false });

  const { data: memberProjects } = await supabase
    .from("project_memberships")
    .select("project_id")
    .eq("user_id", userId);

  const accessSet = new Set((memberProjects || []).map((pm: { project_id: string }) => pm.project_id));

  return NextResponse.json({
    projects: (projects || []).map((p: { id: string; name: string; status: string }) => ({
      ...p,
      hasAccess: accessSet.has(p.id),
    })),
  });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await getSession();
  const isOrgAdmin = session?.company_role === "super_admin" || session?.company_role === "admin";
  if (!session || !isOrgAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId } = await params;
  const { projectIds } = await req.json();
  const supabase = getSupabase();

  // Verify the target user is a member of the admin's company (check org_members,
  // not users.company_id, because invited users keep their primary company_id)
  const { data: membership } = await supabase
    .from("org_members")
    .select("id")
    .eq("user_id", userId)
    .eq("org_id", session.company_id)
    .maybeSingle();

  if (!membership) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { data: companyProjects } = await supabase
    .from("projects")
    .select("id, archived_at")
    .eq("company_id", session.company_id);

  const activeCompanyProjectIds = (companyProjects || [])
    .filter((p: { archived_at: string | null }) => !p.archived_at)
    .map((p: { id: string }) => p.id);

  if (activeCompanyProjectIds.length > 0) {
    // Only clear memberships for active projects; leave any pre-existing
    // memberships on archived projects untouched (archive itself removes them).
    await supabase
      .from("project_memberships")
      .delete()
      .eq("user_id", userId)
      .in("project_id", activeCompanyProjectIds);
  }

  const activeIdSet = new Set(activeCompanyProjectIds);
  const validProjectIds = (projectIds || []).filter((pid: string) => activeIdSet.has(pid));

  if (validProjectIds.length > 0) {
    await supabase
      .from("project_memberships")
      .insert(
        validProjectIds.map((pid: string) => ({
          project_id: pid,
          user_id: userId,
          company_id: session.company_id,
          role: "member",
          permission: "write",
          invited_by: session.id,
        }))
      );

    // Sync the user into each project's directory so they appear immediately
    await Promise.all(
      validProjectIds.map((pid: string) => addUserToDirectory(supabase, pid, userId))
    );
  }

  return NextResponse.json({ success: true });
}
