/**
 * PATCH  /api/training/guides/assignments/[assignmentId] — mark an assignment
 *        complete / re-open it. Allowed for the assignee (their own) or a
 *        Company Super Admin. Body: { status: "assigned" | "completed" }.
 * DELETE /api/training/guides/assignments/[assignmentId] — unassign a guide
 *        from an employee. Super Admin only.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";

function isSuperAdmin(session: { company_role?: string | null }): boolean {
  return session.company_role === "super_admin";
}

type AssignmentWithGuide = {
  id: string;
  user_id: string;
  training_guides: { company_id: string } | null;
};

async function loadAssignment(
  supabase: ReturnType<typeof getSupabase>,
  assignmentId: string,
) {
  const { data } = await supabase
    .from("training_guide_assignments")
    .select("id, user_id, training_guides(company_id)")
    .eq("id", assignmentId)
    .maybeSingle();
  return data as AssignmentWithGuide | null;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ assignmentId: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { assignmentId } = await params;
  const supabase = getSupabase();

  const assignment = await loadAssignment(supabase, assignmentId);
  if (!assignment) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isOwner = assignment.user_id === session.id;
  const isManager =
    isSuperAdmin(session) &&
    !!session.company_id &&
    assignment.training_guides?.company_id === session.company_id;
  if (!isOwner && !isManager) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { status?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON body" }, { status: 400 });
  }

  const status = body.status === "completed" ? "completed" : "assigned";

  const { data, error } = await supabase
    .from("training_guide_assignments")
    .update({
      status,
      completed_at: status === "completed" ? new Date().toISOString() : null,
    })
    .eq("id", assignmentId)
    .select("id, status, completed_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ assignment: data });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ assignmentId: string }> },
) {
  const session = await getSession();
  if (!session || !isSuperAdmin(session) || !session.company_id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { assignmentId } = await params;
  const supabase = getSupabase();

  const assignment = await loadAssignment(supabase, assignmentId);
  if (!assignment) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (assignment.training_guides?.company_id !== session.company_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await supabase
    .from("training_guide_assignments")
    .delete()
    .eq("id", assignmentId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
