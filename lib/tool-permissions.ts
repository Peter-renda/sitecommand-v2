import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getProjectRole, isCompanyAdmin } from "@/lib/project-access";
import { isPermissionLevel } from "@/lib/permission-templates";

export type ToolLevel = "none" | "read_only" | "standard" | "admin";

const RANK: Record<ToolLevel, number> = {
  none: 0,
  read_only: 1,
  standard: 2,
  admin: 3,
};

type Session = {
  id: string;
  email?: string;
  role: string;
  company_id: string | null;
  company_role: string | null;
};

export function levelMeets(level: ToolLevel, required: ToolLevel): boolean {
  return RANK[level] >= RANK[required];
}

/**
 * Resolves a user's effective level for a tool on a project.
 *
 * Order of precedence:
 *  1. Super Admin on the owning company       -> admin (always)
 *  2. Explicit row in project_tool_permissions -> use it
 *  3. Per-user override on org_members.tool_levels (company-wide)
 *  4. Company Admin shortcut on owning company -> admin
 *  5. Role-based default:
 *     - project_admin         -> admin
 *     - member                -> standard
 *     - external_viewer       -> read_only
 *  6. No project access       -> none
 */
export async function getToolLevel(
  session: Session,
  projectId: string,
  tool: string
): Promise<ToolLevel> {
  const supabase = getSupabase();

  const isOwnerCompanyAdmin = isCompanyAdmin(session.company_role) && !!session.company_id;
  let ownsProject = false;
  if (isOwnerCompanyAdmin) {
    const { data: project } = await supabase
      .from("projects")
      .select("company_id")
      .eq("id", projectId)
      .single();
    ownsProject = project?.company_id === session.company_id;
    // Super Admins are never restricted; short-circuit.
    if (ownsProject && session.company_role === "super_admin") return "admin";
  }

  const { data: explicit } = await supabase
    .from("project_tool_permissions")
    .select("level")
    .eq("project_id", projectId)
    .eq("user_id", session.id)
    .eq("tool", tool)
    .maybeSingle();

  if (explicit?.level) return explicit.level as ToolLevel;

  if (session.company_id) {
    const { data: membership } = await supabase
      .from("org_members")
      .select("tool_levels")
      .eq("user_id", session.id)
      .eq("org_id", session.company_id)
      .maybeSingle();
    const overrides = (membership?.tool_levels ?? null) as Record<string, string> | null;
    if (overrides && tool in overrides && isPermissionLevel(overrides[tool])) {
      return overrides[tool] as ToolLevel;
    }
  }

  if (ownsProject) return "admin";

  const role = await getProjectRole(projectId, session);
  if (role === "project_admin") return "admin";
  if (role === "member") return "standard";
  if (role === "external_viewer") return "read_only";
  return "none";
}

/**
 * Returns an error response if the session does not meet the required
 * level on the tool, otherwise returns null. Callers short-circuit on
 * a non-null result.
 */
export async function requireToolLevel(
  session: Session,
  projectId: string,
  tool: string,
  required: ToolLevel
): Promise<NextResponse | null> {
  const level = await getToolLevel(session, projectId, tool);
  if (!levelMeets(level, required)) {
    return NextResponse.json(
      { error: `Insufficient ${tool} permission (${required} required).` },
      { status: 403 }
    );
  }
  return null;
}

/**
 * True if the session belongs to the Invoice Contact named on the
 * commitment — i.e. the user's email matches the directory_contacts
 * row whose display name equals commitment.subcontractor_contact.
 *
 * Commitments store the invoice contact as a display-name string, not
 * an FK to a user, so we resolve by scanning project directory contacts
 * and matching on email.
 */
export async function isInvoiceContactForCommitment(
  session: Session,
  projectId: string,
  commitmentId: string
): Promise<boolean> {
  if (!session.email) return false;
  const supabase = getSupabase();

  const { data: commitment } = await supabase
    .from("commitments")
    .select("subcontractor_contact")
    .eq("id", commitmentId)
    .eq("project_id", projectId)
    .single();

  if (!commitment?.subcontractor_contact) return false;

  const { data: contacts } = await supabase
    .from("directory_contacts")
    .select("type, first_name, last_name, company, group_name, email")
    .eq("project_id", projectId);

  const sessionEmail = session.email.toLowerCase();
  const match = (contacts || []).find((c) => {
    const name =
      c.type === "company"
        ? c.company || ""
        : c.type === "group" || c.type === "distribution_group"
        ? c.group_name || ""
        : [c.first_name, c.last_name].filter(Boolean).join(" ");
    return (
      name === commitment.subcontractor_contact &&
      (c.email || "").toLowerCase() === sessionEmail
    );
  });

  return !!match;
}

/**
 * Returns null if the session may write to the Subcontractor SOV on
 * the given commitment, or a 403 otherwise.
 *
 * Rule: Admin on Commitments, OR the session is the Invoice Contact on
 * this commitment and has at least Read Only on Commitments.
 */
export async function requireSsovWriter(
  session: Session,
  projectId: string,
  commitmentId: string
): Promise<NextResponse | null> {
  const level = await getToolLevel(session, projectId, "commitments");
  if (level === "admin") return null;
  if (levelMeets(level, "read_only")) {
    const isInvoice = await isInvoiceContactForCommitment(session, projectId, commitmentId);
    if (isInvoice) return null;
  }
  return NextResponse.json(
    {
      error:
        "Only Commitments admins or the assigned Invoice Contact may edit the Subcontractor SOV.",
    },
    { status: 403 }
  );
}
