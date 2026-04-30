import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getSession } from "@/lib/auth";
import { templateNameToCategoryAndType } from "@/lib/permission-templates";
import {
  applyPermissionTemplate,
  clearProjectToolPermissions,
} from "@/lib/apply-permission-template";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; contactId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId, contactId } = await params;
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("directory_contacts")
    .select("*")
    .eq("id", contactId)
    .eq("project_id", projectId)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; contactId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId, contactId } = await params;
  const body = await req.json();

  const allowed = ["first_name", "last_name", "email", "phone", "company", "permission", "group_name", "notes", "job_title", "address"];
  const update: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) update[key] = body[key] || null;
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("directory_contacts")
    .update(update)
    .eq("id", contactId)
    .eq("project_id", projectId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // If the permission template changed and we can resolve a user account
  // for this contact (matched by email on this project), translate the
  // template into concrete project_tool_permissions rows. Templates only
  // apply to user-type contacts (companies/groups have no user account).
  if ("permission" in body && data?.type === "user" && data?.email) {
    const { data: project } = await supabase
      .from("projects")
      .select("company_id")
      .eq("id", projectId)
      .single();

    const { data: user } = await supabase
      .from("users")
      .select("id")
      .eq("email", data.email)
      .maybeSingle();

    if (project?.company_id && user?.id) {
      const mapped = templateNameToCategoryAndType(data.permission);
      if (mapped) {
        await applyPermissionTemplate(supabase, {
          companyId: project.company_id,
          projectId,
          userId: user.id,
          category: mapped.category,
          userType: mapped.userType,
          updatedBy: session.id,
        });
      } else {
        // Template was cleared — drop any per-tool overrides for this user.
        await clearProjectToolPermissions(supabase, projectId, user.id);
      }
    }
  }

  return NextResponse.json(data);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; contactId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId, contactId } = await params;
  const supabase = getSupabase();

  const { error } = await supabase
    .from("directory_contacts")
    .delete()
    .eq("id", contactId)
    .eq("project_id", projectId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
