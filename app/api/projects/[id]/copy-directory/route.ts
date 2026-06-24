import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getSession } from "@/lib/auth";

// Both endpoints are limited to Company Super Admins: copying a directory into a
// project mutates project data, and project settings are super-admin-only.
function isSuperAdmin(session: { company_role?: string | null }): boolean {
  return session.company_role === "super_admin";
}

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/projects/[id]/copy-directory
 * Lists every other project owned by the same company — active and archived —
 * to populate the "Copy Directory From" dropdown on the Project Admin page.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session || !isSuperAdmin(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: projectId } = await params;
  const supabase = getSupabase();

  const { data: current } = await supabase
    .from("projects")
    .select("company_id")
    .eq("id", projectId)
    .single();

  if (!current?.company_id || current.company_id !== session.company_id) {
    return NextResponse.json({ projects: [] });
  }

  const { data, error } = await supabase
    .from("projects")
    .select("id, name, archived_at")
    .eq("company_id", current.company_id)
    .neq("id", projectId)
    // Training sandboxes carry a company_id but are private to the user who
    // launched them — keep them out of the company-wide Copy Directory picker.
    .eq("is_training", false)
    .order("archived_at", { ascending: true, nullsFirst: true })
    .order("name", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    projects: (data ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      archived: !!p.archived_at,
    })),
  });
}

/**
 * POST /api/projects/[id]/copy-directory
 * Copies the directory contacts from a sibling project into this one. Existing
 * contacts are preserved; duplicates (matched by email) are skipped so the
 * action is safe to run more than once.
 *
 * Body: { sourceProjectId: string }
 */
export async function POST(req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session || !isSuperAdmin(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: projectId } = await params;
  const { sourceProjectId } = await req.json().catch(() => ({ sourceProjectId: null }));
  if (!sourceProjectId || sourceProjectId === projectId) {
    return NextResponse.json({ error: "Select a different project to copy from." }, { status: 400 });
  }

  const supabase = getSupabase();

  // Both projects must belong to the caller's company.
  const { data: projectRows } = await supabase
    .from("projects")
    .select("id, company_id")
    .in("id", [projectId, sourceProjectId]);

  const target = (projectRows ?? []).find((p) => p.id === projectId);
  const source = (projectRows ?? []).find((p) => p.id === sourceProjectId);
  if (
    !target ||
    !source ||
    target.company_id !== session.company_id ||
    source.company_id !== session.company_id
  ) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const { data: sourceContacts } = await supabase
    .from("directory_contacts")
    .select("type, first_name, last_name, email, phone, company, permission, group_name, notes, job_title, address")
    .eq("project_id", sourceProjectId);

  if (!sourceContacts?.length) {
    return NextResponse.json({ copied: 0 });
  }

  // Build a de-dupe set from the target's current contacts.
  const { data: existing } = await supabase
    .from("directory_contacts")
    .select("email, type, group_name, first_name, last_name, company")
    .eq("project_id", projectId);

  const signature = (c: {
    email?: string | null;
    type?: string | null;
    group_name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    company?: string | null;
  }) =>
    c.email
      ? `email:${c.email.trim().toLowerCase()}`
      : `sig:${(c.type ?? "").toLowerCase()}|${(c.group_name ?? "").toLowerCase()}|${(c.first_name ?? "").toLowerCase()}|${(c.last_name ?? "").toLowerCase()}|${(c.company ?? "").toLowerCase()}`;

  const seen = new Set((existing ?? []).map(signature));

  const toInsert: Record<string, unknown>[] = [];
  for (const c of sourceContacts) {
    const sig = signature(c);
    if (seen.has(sig)) continue;
    seen.add(sig);
    toInsert.push({
      project_id: projectId,
      type: c.type,
      first_name: c.first_name ?? null,
      last_name: c.last_name ?? null,
      email: c.email ?? null,
      phone: c.phone ?? null,
      company: c.company ?? null,
      permission: c.permission ?? null,
      group_name: c.group_name ?? null,
      notes: c.notes ?? null,
      job_title: c.job_title ?? null,
      address: c.address ?? null,
    });
  }

  if (toInsert.length === 0) {
    return NextResponse.json({ copied: 0 });
  }

  const { error } = await supabase.from("directory_contacts").insert(toInsert);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ copied: toInsert.length });
}
