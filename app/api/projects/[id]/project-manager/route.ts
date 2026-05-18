import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";
import { getToolLevel } from "@/lib/tool-permissions";

// Returns the directory contacts assigned to the "Project Manager" role
// on this project, used to autofill the Assign Invoice modal.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;

  // Limit to people who can act on TOs for this project so we don't
  // leak PM identity to unrelated viewers.
  const level = await getToolLevel(session, projectId, "transaction-orders");
  if (level !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = getSupabase();
  const { data: project, error } = await supabase
    .from("projects")
    .select("project_roles")
    .eq("id", projectId)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const roles = (project?.project_roles ?? {}) as Record<string, string[]>;
  const pmContactIds: string[] = Array.isArray(roles["Project Manager"])
    ? roles["Project Manager"]
    : [];

  if (pmContactIds.length === 0) {
    return NextResponse.json({ projectManagers: [] });
  }

  const { data: contacts } = await supabase
    .from("directory_contacts")
    .select("id, first_name, last_name, company, group_name, email, type")
    .in("id", pmContactIds);

  const projectManagers = (contacts ?? []).map((c) => {
    const name =
      c.type === "company"
        ? c.company || ""
        : c.type === "group" || c.type === "distribution_group"
        ? c.group_name || ""
        : [c.first_name, c.last_name].filter(Boolean).join(" ").trim();
    return {
      contactId: c.id,
      name: name || c.email || "",
      email: c.email || "",
    };
  });

  return NextResponse.json({ projectManagers });
}
