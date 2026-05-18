import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getSession } from "@/lib/auth";
import { isCompanyAdmin } from "@/lib/project-access";
import { ALL_TOOL_SLUGS } from "@/lib/tool-sections";
import {
  PERMISSION_LEVELS,
  companyRoleDefaultLevel,
  isPermissionLevel,
  type PermissionLevel,
} from "@/lib/permission-templates";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await getSession();
  if (!session || !isCompanyAdmin(session.company_role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId } = await params;
  const supabase = getSupabase();

  const { data: membership } = await supabase
    .from("org_members")
    .select("tool_levels, role, users(id, username, email)")
    .eq("user_id", userId)
    .eq("org_id", session.company_id)
    .maybeSingle();

  if (!membership) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({
    toolLevels: (membership.tool_levels ?? {}) as Record<string, PermissionLevel>,
    defaultLevel: companyRoleDefaultLevel(membership.role),
    role: membership.role,
    user: membership.users,
  });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await getSession();
  if (!session || !isCompanyAdmin(session.company_role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId } = await params;
  const body = (await req.json()) as { toolLevels?: Record<string, string> | null };
  const toolLevelsInput = body.toolLevels ?? null;

  if (toolLevelsInput !== null) {
    if (typeof toolLevelsInput !== "object" || Array.isArray(toolLevelsInput)) {
      return NextResponse.json({ error: "toolLevels must be an object or null" }, { status: 400 });
    }
    for (const [slug, level] of Object.entries(toolLevelsInput)) {
      if (!ALL_TOOL_SLUGS.includes(slug)) {
        return NextResponse.json({ error: `Unknown tool slug: ${slug}` }, { status: 400 });
      }
      if (!isPermissionLevel(level)) {
        return NextResponse.json(
          { error: `Invalid level for ${slug}: must be one of ${PERMISSION_LEVELS.join(", ")}` },
          { status: 400 }
        );
      }
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

  // Drop entries that match the role default to keep the stored object minimal.
  const roleDefault = companyRoleDefaultLevel(membership.role);
  let normalized: Record<string, PermissionLevel> | null = null;
  if (toolLevelsInput) {
    const trimmed: Record<string, PermissionLevel> = {};
    for (const [slug, level] of Object.entries(toolLevelsInput)) {
      if ((level as PermissionLevel) !== roleDefault) {
        trimmed[slug] = level as PermissionLevel;
      }
    }
    normalized = Object.keys(trimmed).length > 0 ? trimmed : null;
  }

  await supabase
    .from("org_members")
    .update({ tool_levels: normalized })
    .eq("user_id", userId)
    .eq("org_id", session.company_id);

  return NextResponse.json({ success: true });
}
