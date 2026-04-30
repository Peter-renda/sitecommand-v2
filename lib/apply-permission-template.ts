import type { SupabaseClient } from "@supabase/supabase-js";
import {
  TEMPLATE_TOOLS,
  TOOL_NAME_TO_SLUG,
  defaultLevelFor,
  isPermissionLevel,
  type PermissionLevel,
  type TemplateCategory,
  type TemplateUserType,
} from "@/lib/permission-templates";

/**
 * Resolves the effective per-tool permission template for a (company,
 * category, user_type), overlaying stored overrides on built-in defaults.
 * Returns a map of tool slug → level.
 */
export async function resolveTemplateLevels(
  supabase: SupabaseClient,
  companyId: string,
  category: TemplateCategory,
  userType: TemplateUserType
): Promise<Record<string, PermissionLevel>> {
  const { data: rows } = await supabase
    .from("company_permission_templates")
    .select("tool, level")
    .eq("company_id", companyId)
    .eq("user_category", category)
    .eq("user_type", userType);

  const overrides = new Map<string, PermissionLevel>();
  for (const row of rows ?? []) {
    if (isPermissionLevel(row.level)) overrides.set(row.tool, row.level);
  }

  const bySlug: Record<string, PermissionLevel> = {};
  for (const tool of TEMPLATE_TOOLS) {
    const slug = TOOL_NAME_TO_SLUG[tool];
    if (!slug) continue;
    bySlug[slug] = overrides.get(tool) ?? defaultLevelFor(category, userType, tool);
  }
  return bySlug;
}

/**
 * Writes per-tool permission rows into project_tool_permissions for a user
 * on a project, sourced from the company's permission template for the
 * given (category, user_type). Existing rows for that user/project are
 * replaced so removing the template (passing empty levels) clears overrides.
 */
export async function applyPermissionTemplate(
  supabase: SupabaseClient,
  args: {
    companyId: string;
    projectId: string;
    userId: string;
    category: TemplateCategory;
    userType: TemplateUserType;
    updatedBy?: string | null;
  }
): Promise<void> {
  const levelsBySlug = await resolveTemplateLevels(
    supabase,
    args.companyId,
    args.category,
    args.userType
  );

  const now = new Date().toISOString();
  const rows = Object.entries(levelsBySlug).map(([tool, level]) => ({
    project_id: args.projectId,
    user_id: args.userId,
    tool,
    level,
    updated_by: args.updatedBy ?? null,
    updated_at: now,
  }));

  if (rows.length === 0) return;

  await supabase
    .from("project_tool_permissions")
    .upsert(rows, { onConflict: "project_id,user_id,tool" });
}

/** Removes any per-tool overrides for a user on a project (e.g. when the
 *  permission template is cleared from their directory contact). */
export async function clearProjectToolPermissions(
  supabase: SupabaseClient,
  projectId: string,
  userId: string
): Promise<void> {
  await supabase
    .from("project_tool_permissions")
    .delete()
    .eq("project_id", projectId)
    .eq("user_id", userId);
}
