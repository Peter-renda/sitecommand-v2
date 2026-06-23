/**
 * GET  /api/training/guides/[guideId]/assignments — who this guide is assigned
 *      to (Super Admin only): each employee, their due date, and status.
 * POST /api/training/guides/[guideId]/assignments — assign the guide to one or
 *      more employees with a due date. Super Admin only.
 *      Body: { userIds: string[], dueDate?: string (YYYY-MM-DD) }.
 *      Re-assigning an employee refreshes the due date and resets status.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";
import { sendGuideAssignmentEmail } from "@/lib/email";

function isSuperAdmin(session: { company_role?: string | null }): boolean {
  return session.company_role === "super_admin";
}

type AssignmentRow = {
  id: string;
  user_id: string;
  due_date: string | null;
  status: string;
  completed_at: string | null;
  created_at: string;
  users: { id: string; username: string; email: string } | null;
};

// Load the guide only if it belongs to the caller's company.
async function loadGuide(
  supabase: ReturnType<typeof getSupabase>,
  guideId: string,
  companyId: string,
) {
  const { data } = await supabase
    .from("training_guides")
    .select("id, title")
    .eq("id", guideId)
    .eq("company_id", companyId)
    .maybeSingle();
  return data;
}

function serializeAssignment(row: AssignmentRow) {
  return {
    id: row.id,
    userId: row.user_id,
    username: row.users?.username ?? "",
    email: row.users?.email ?? "",
    dueDate: row.due_date,
    status: row.status,
    completedAt: row.completed_at,
    createdAt: row.created_at,
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ guideId: string }> },
) {
  const session = await getSession();
  if (!session || !isSuperAdmin(session) || !session.company_id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { guideId } = await params;
  const supabase = getSupabase();

  if (!(await loadGuide(supabase, guideId, session.company_id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("training_guide_assignments")
    .select("id, user_id, due_date, status, completed_at, created_at, users(id, username, email)")
    .eq("guide_id", guideId)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const assignments = ((data ?? []) as unknown as AssignmentRow[]).map(serializeAssignment);
  return NextResponse.json({ assignments });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ guideId: string }> },
) {
  const session = await getSession();
  if (!session || !isSuperAdmin(session) || !session.company_id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { guideId } = await params;

  let body: { userIds?: unknown; dueDate?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON body" }, { status: 400 });
  }

  const requestedIds = Array.isArray(body.userIds)
    ? Array.from(new Set(body.userIds.filter((u): u is string => typeof u === "string" && !!u)))
    : [];
  if (requestedIds.length === 0) {
    return NextResponse.json({ error: "Select at least one employee" }, { status: 400 });
  }

  // Accept a YYYY-MM-DD due date, or null when left blank.
  let dueDate: string | null = null;
  if (typeof body.dueDate === "string" && body.dueDate.trim()) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.dueDate.trim())) {
      return NextResponse.json({ error: "Invalid due date" }, { status: 400 });
    }
    dueDate = body.dueDate.trim();
  }

  const supabase = getSupabase();

  const guide = await loadGuide(supabase, guideId, session.company_id);
  if (!guide) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Only allow assigning to employees who belong to this company.
  const { data: members } = await supabase
    .from("org_members")
    .select("user_id")
    .eq("org_id", session.company_id)
    .in("user_id", requestedIds);
  const validIds = (members ?? []).map((m) => m.user_id);
  if (validIds.length === 0) {
    return NextResponse.json({ error: "No valid employees selected" }, { status: 400 });
  }

  const nowIso = new Date().toISOString();
  const rows = validIds.map((userId) => ({
    guide_id: guideId,
    user_id: userId,
    assigned_by: session.id,
    due_date: dueDate,
    status: "assigned",
    completed_at: null,
    created_at: nowIso,
  }));

  // Upsert so re-assigning an employee refreshes the due date and re-opens it.
  const { error } = await supabase
    .from("training_guide_assignments")
    .upsert(rows, { onConflict: "guide_id,user_id" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Notify the assigned employees by email (fire-and-forget; non-fatal).
  try {
    const { data: notifyUsers } = await supabase
      .from("users")
      .select("id, email, username")
      .in("id", validIds);
    const guidesUrl = process.env.NEXT_PUBLIC_APP_URL
      ? `${process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/training/guides`
      : "/training/guides";
    const assignedBy =
      [session.email, session.username].filter(Boolean).join(" / ") || "A SiteCommand admin";
    const guideTitle = (guide.title as string | null) || "Company guide";
    await Promise.all(
      (notifyUsers ?? [])
        .filter((u) => typeof u.email === "string" && u.email.includes("@"))
        .map((u) =>
          sendGuideAssignmentEmail({
            to: u.email as string,
            recipientName: (u.username as string | null) || undefined,
            guideTitle,
            assignedBy,
            dueDate,
            guidesUrl,
          }).catch(() => {}),
        ),
    );
  } catch {
    // Non-fatal — assignments are persisted regardless of email delivery.
  }

  // Return the refreshed assignment list for the guide.
  const { data } = await supabase
    .from("training_guide_assignments")
    .select("id, user_id, due_date, status, completed_at, created_at, users(id, username, email)")
    .eq("guide_id", guideId)
    .order("created_at", { ascending: true });

  const assignments = ((data ?? []) as unknown as AssignmentRow[]).map(serializeAssignment);
  return NextResponse.json({ assignments, assigned: validIds.length });
}
