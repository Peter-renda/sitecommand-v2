import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { canAccessProject } from "@/lib/project-access";
import { getSupabase } from "@/lib/supabase";
import { TOOL_NAME_TO_SLUG } from "@/lib/permission-templates";

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

  // Fetch company-level enabled_features, org membership tool allowlist, and
  // explicit project-level "none" tool permissions for this user in parallel.
  const [{ data: company }, { data: membership }, { data: projectToolRows }] = await Promise.all([
    supabase
      .from("companies")
      .select("enabled_features")
      .eq("id", project.company_id)
      .single(),
    supabase
      .from("org_members")
      .select("allowed_tools")
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
  const userAllowed: string[] | null = membership?.allowed_tools ?? null;

  // Compute effective features:
  //   null + null → null (all enabled)
  //   null + array → user's list
  //   array + null → company's list
  //   array + array → intersection
  let effective: string[] | null;
  if (companyFeatures === null && userAllowed === null) {
    effective = null;
  } else if (companyFeatures === null) {
    effective = userAllowed;
  } else if (userAllowed === null) {
    effective = companyFeatures;
  } else {
    effective = companyFeatures.filter((f) => userAllowed.includes(f));
  }

  const deniedByProject = new Set(
    (projectToolRows ?? []).map((row) => TOOL_NAME_TO_SLUG[row.tool] ?? row.tool).filter(Boolean)
  );

  // If company/org allowlists are unrestricted, only project-level "none" rows apply.
  // We can't represent "all except a few" with null, so expand from the canonical
  // allowlist source when needed.
  if (effective === null && deniedByProject.size > 0) {
    const allKnownSlugs = Array.from(new Set(Object.values(TOOL_NAME_TO_SLUG))).filter(Boolean);
    effective = allKnownSlugs.filter((slug) => !deniedByProject.has(slug));
  } else if (effective) {
    effective = effective.filter((slug) => !deniedByProject.has(slug));
  }

  return NextResponse.json({ enabled_features: effective });
}
