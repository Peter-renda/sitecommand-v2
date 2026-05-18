import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { canAccessProject } from "@/lib/project-access";
import { getSupabase } from "@/lib/supabase";
import {
  TOOL_NAME_TO_SLUG,
  companyRoleDefaultLevel,
  effectiveCompanyMemberLevel,
} from "@/lib/permission-templates";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;

  // Verify the user can access this project
  const hasAccess = await canAccessProject(projectId, session);
  if (!hasAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getSupabase();

  // Get the project's company_id, then fetch enabled_features
  const { data: project } = await supabase
    .from("projects")
    .select("company_id")
    .eq("id", projectId)
    .single();

  if (!project?.company_id) {
    // No company attached — return all features enabled
    return NextResponse.json({ enabled_features: null });
  }

  // Fetch company-level enabled_features, the org member's tool_levels
  // override (per-tool company-wide), and explicit project-level "none" rows
  // for this user in parallel.
  const [{ data: company }, { data: membership }, { data: projectToolRows }] = await Promise.all([
    supabase
      .from("companies")
      .select("enabled_features")
      .eq("id", project.company_id)
      .single(),
    supabase
      .from("org_members")
      .select("role, tool_levels")
      .eq("user_id", session.id)
      .eq("org_id", project.company_id)
      .maybeSingle(),
    supabase
      .from("project_tool_permissions")
      .select("tool, level")
      .eq("project_id", projectId)
      .eq("user_id", session.id)
      .eq("level", "none"),
  ]);

  const companyFeatures: string[] | null = company?.enabled_features ?? null;
  const toolLevels = (membership?.tool_levels ?? null) as Record<string, string> | null;
  const companyRole = membership?.role ?? null;
  const roleDefault = companyRoleDefaultLevel(companyRole);

  // A tool is hidden from nav when the company-wide effective level is "none".
  // If there are no overrides and the role default is something other than "none",
  // nothing is hidden by the company-user layer.
  const hiddenByUser = new Set<string>();
  if (toolLevels) {
    for (const slug of Object.keys(toolLevels)) {
      if (effectiveCompanyMemberLevel(toolLevels, companyRole, slug) === "none") {
        hiddenByUser.add(slug);
      }
    }
  }

  const baseAllowed: string[] | null = companyFeatures;

  // Start from the company allowlist (or "all known" if unrestricted).
  let effective: string[];
  if (baseAllowed === null) {
    effective = Array.from(new Set(Object.values(TOOL_NAME_TO_SLUG))).filter(Boolean);
  } else {
    effective = [...baseAllowed];
  }

  // Drop tools hidden by the user's per-tool overrides.
  if (hiddenByUser.size > 0) {
    effective = effective.filter((slug) => !hiddenByUser.has(slug));
  } else if (roleDefault === "none") {
    // Role default "none" means everything is hidden unless explicitly set above.
    effective = effective.filter(
      (slug) => toolLevels && slug in toolLevels && !hiddenByUser.has(slug)
    );
  }

  // Drop tools explicitly set to "none" at the project level.
  const deniedByProject = new Set(
    (projectToolRows ?? []).map((row) => TOOL_NAME_TO_SLUG[row.tool] ?? row.tool).filter(Boolean)
  );
  if (deniedByProject.size > 0) {
    effective = effective.filter((slug) => !deniedByProject.has(slug));
  }

  // If the company allowlist was originally null AND nothing else trimmed, preserve
  // the historical "null = unrestricted" response so downstream code can treat it as a no-op.
  const noTrim =
    baseAllowed === null && hiddenByUser.size === 0 && deniedByProject.size === 0 && roleDefault !== "none";

  return NextResponse.json({ enabled_features: noTrim ? null : effective });
}
