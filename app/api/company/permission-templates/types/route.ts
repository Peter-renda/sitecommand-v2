import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";
import { isCompanyAdmin } from "@/lib/project-access";
import {
  COMPANY_USER_TYPES,
  INVITEE_USER_TYPES,
  type TemplateCategory,
} from "@/lib/permission-templates";

const BUILTIN_BY_CATEGORY: Record<TemplateCategory, Set<string>> = {
  company: new Set(COMPANY_USER_TYPES.map((t) => t.value)),
  invitee: new Set(INVITEE_USER_TYPES.map((t) => t.value)),
};

/**
 * GET /api/company/permission-templates/types
 *
 * Returns the distinct custom (non-built-in) user_type values that have been
 * stored for this company in company_permission_templates, grouped by category.
 * Used by the Permission Templates UI to repopulate the user-type dropdown
 * with templates the Super Admin previously created.
 */
export async function GET() {
  const session = await getSession();
  if (!session || !session.company_id || !isCompanyAdmin(session.company_role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("company_permission_templates")
    .select("user_category, user_type")
    .eq("company_id", session.company_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const customByCategory: Record<TemplateCategory, string[]> = {
    company: [],
    invitee: [],
  };
  const seen = new Set<string>();
  for (const row of data ?? []) {
    const category = row.user_category as TemplateCategory;
    const userType = row.user_type as string;
    if (category !== "company" && category !== "invitee") continue;
    if (!userType) continue;
    if (BUILTIN_BY_CATEGORY[category].has(userType)) continue;
    const key = `${category}::${userType}`;
    if (seen.has(key)) continue;
    seen.add(key);
    customByCategory[category].push(userType);
  }

  for (const category of Object.keys(customByCategory) as TemplateCategory[]) {
    customByCategory[category].sort();
  }

  return NextResponse.json({ customTypes: customByCategory });
}
