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

  const allowed = ["first_name", "last_name", "email", "phone", "company", "permission", "group_name", "notes", "job_title", "address", "abbreviated_name", "dba", "business_phone", "business_fax", "website", "city", "country", "state", "zip", "project_roles", "tags_keywords", "license_number", "labor_union", "entity_type", "primary_contact", "authorized_bidder", "union_member", "small_business", "prevailing_wage", "african_american_business", "asian_american_business", "hispanic_business", "native_american_business", "women_business", "disadvantaged_business", "hub_zone", "minority_business_enterprise", "sdvosb", "business_8a", "affirmative_action", "certified_business_enterprise", "prequalified", "trades", "cost_codes", "bidder_comment", "bidder_rating", "member_contact_ids", "report_fields"];
  const update: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key === "member_contact_ids") {
      if (key in body) update[key] = Array.isArray(body[key]) ? body[key] : [];
    } else if (key in body) {
      update[key] = body[key] === "" ? null : body[key];
    }
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
