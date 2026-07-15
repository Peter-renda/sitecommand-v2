import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getSession } from "@/lib/auth";
import { isCompanyAdmin } from "@/lib/project-access";
import {
  COMPANY_USER_TYPES,
  TEMPLATE_TOOLS,
  TOOL_NAME_TO_SLUG,
  companyRoleDefaultLevel,
  defaultLevelFor,
  isPermissionLevel,
  type PermissionLevel,
} from "@/lib/permission-templates";

type TemplateOption = { value: string; label: string; builtin: boolean };

async function loadTemplateLevels(
  supabase: ReturnType<typeof getSupabase>,
  companyId: string,
  templateName: string
): Promise<Record<string, PermissionLevel>> {
  const { data: rows } = await supabase
    .from("company_permission_templates")
    .select("tool, level")
    .eq("company_id", companyId)
    .eq("user_category", "company")
    .eq("user_type", templateName);

  const overrides = new Map<string, PermissionLevel>();
  for (const row of rows ?? []) {
    if (isPermissionLevel(row.level)) overrides.set(row.tool, row.level);
  }

  const levels: Record<string, PermissionLevel> = {};
  for (const tool of TEMPLATE_TOOLS) {
    levels[tool] =
      overrides.get(tool) ?? defaultLevelFor("company", templateName, tool);
  }
  return levels;
}

async function listAvailableTemplates(
  supabase: ReturnType<typeof getSupabase>,
  companyId: string
): Promise<TemplateOption[]> {
  const builtin: TemplateOption[] = COMPANY_USER_TYPES.map((t) => ({
    value: t.value,
    label: t.label,
    builtin: true,
  }));

  const { data } = await supabase
    .from("company_permission_templates")
    .select("user_type")
    .eq("company_id", companyId)
    .eq("user_category", "company");

  const seen = new Set(builtin.map((t) => t.value));
  const custom: TemplateOption[] = [];
  for (const row of data ?? []) {
    const v = String(row.user_type ?? "").trim();
    if (!v || seen.has(v)) continue;
    seen.add(v);
    custom.push({ value: v, label: v, builtin: false });
  }
  custom.sort((a, b) => a.label.localeCompare(b.label));
  return [...builtin, ...custom];
}

function effectiveLevelsFromOverrides(
  templateLevels: Record<string, PermissionLevel>,
  toolLevelsBySlug: Record<string, PermissionLevel> | null
): Record<string, PermissionLevel> {
  const effective: Record<string, PermissionLevel> = {};
  for (const tool of TEMPLATE_TOOLS) {
    const slug = TOOL_NAME_TO_SLUG[tool];
    if (slug && toolLevelsBySlug && slug in toolLevelsBySlug) {
      effective[tool] = toolLevelsBySlug[slug];
    } else {
      effective[tool] = templateLevels[tool];
    }
  }
  return effective;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await getSession();
  if (!session || !session.company_id || !isCompanyAdmin(session.company_role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId } = await params;
  const supabase = getSupabase();

  const { data: membership } = await supabase
    .from("org_members")
    .select("tool_levels, role, permission_template, users(id, username, email)")
    .eq("user_id", userId)
    .eq("org_id", session.company_id)
    .maybeSingle();

  if (!membership) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const templates = await listAvailableTemplates(supabase, session.company_id);
  const currentTemplate = (membership.permission_template ?? membership.role) as string;

  // If the stored template name isn't in the available list (orphaned custom),
  // surface it so the dropdown still reflects it.
  if (currentTemplate && !templates.some((t) => t.value === currentTemplate)) {
    templates.push({ value: currentTemplate, label: currentTemplate, builtin: false });
  }

  const templateLevels = await loadTemplateLevels(supabase, session.company_id, currentTemplate);
  const overrides = (membership.tool_levels ?? null) as Record<string, PermissionLevel> | null;
  const effective = effectiveLevelsFromOverrides(templateLevels, overrides);

  return NextResponse.json({
    user: membership.users,
    role: membership.role,
    defaultLevel: companyRoleDefaultLevel(membership.role),
    availableTemplates: templates,
    currentTemplate,
    templateLevels,
    levels: effective,
  });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await getSession();
  if (!session || !session.company_id || !isCompanyAdmin(session.company_role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId } = await params;
  const body = (await req.json()) as {
    template?: string | null;
    levels?: Record<string, string>;
  };

  const template = (body.template ?? "").trim();
  if (!template) {
    return NextResponse.json({ error: "template is required" }, { status: 400 });
  }
  if (!body.levels || typeof body.levels !== "object") {
    return NextResponse.json({ error: "levels is required" }, { status: 400 });
  }
  for (const tool of TEMPLATE_TOOLS) {
    const lvl = body.levels[tool];
    if (!isPermissionLevel(lvl)) {
      return NextResponse.json({ error: `Invalid level for ${tool}` }, { status: 400 });
    }
  }

  const supabase = getSupabase();

  const { data: membership } = await supabase
    .from("org_members")
    .select("id, role")
    .eq("user_id", userId)
    .eq("org_id", session.company_id)
    .maybeSingle();

  if (!membership) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (membership.role === "super_admin") {
    return NextResponse.json(
      { error: "Cannot restrict tool access for the account owner" },
      { status: 403 }
    );
  }

  // Persist the full effective per-tool level map keyed by slug, so that
  // tool gating (getToolLevel) and nav visibility (features route) can read
  // directly without recomputing the template overlay.
  const toolLevelsBySlug: Record<string, PermissionLevel> = {};
  for (const tool of TEMPLATE_TOOLS) {
    const slug = TOOL_NAME_TO_SLUG[tool];
    if (!slug) continue;
    toolLevelsBySlug[slug] = body.levels[tool] as PermissionLevel;
  }

  await supabase
    .from("org_members")
    .update({
      permission_template: template,
      tool_levels: toolLevelsBySlug,
    })
    .eq("user_id", userId)
    .eq("org_id", session.company_id);

  return NextResponse.json({ success: true });
}
