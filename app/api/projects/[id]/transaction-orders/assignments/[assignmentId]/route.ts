import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";
import { getToolLevel } from "@/lib/tool-permissions";

type Params = { params: Promise<{ id: string; assignmentId: string }> };

type Recipient = {
  contactId: string | null;
  userId: string | null;
  email: string;
  name: string;
  role: string;
};

function isAssignedTo(recipients: Recipient[], session: { id: string; email?: string }): boolean {
  const sessionEmail = (session.email || "").trim().toLowerCase();
  return recipients.some(
    (r) => r.userId === session.id || (sessionEmail && r.email === sessionEmail),
  );
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId, assignmentId } = await params;
  const supabase = getSupabase();

  const { data: row, error: fetchError } = await supabase
    .from("transaction_order_assignments")
    .select("id, status, recipients, assigned_by")
    .eq("id", assignmentId)
    .eq("project_id", projectId)
    .maybeSingle();
  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: { status?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON body" }, { status: 400 });
  }
  const nextStatus = typeof body.status === "string" ? body.status : "";
  if (nextStatus !== "open" && nextStatus !== "completed") {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const toolLevel = await getToolLevel(session, projectId, "transaction-orders");
  const recipients: Recipient[] = Array.isArray(row.recipients) ? (row.recipients as Recipient[]) : [];
  const canAct =
    toolLevel === "admin" ||
    row.assigned_by === session.id ||
    isAssignedTo(recipients, session);
  if (!canAct) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error: updateError } = await supabase
    .from("transaction_order_assignments")
    .update({
      status: nextStatus,
      completed_at: nextStatus === "completed" ? new Date().toISOString() : null,
      completed_by: nextStatus === "completed" ? session.id : null,
    })
    .eq("id", assignmentId);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json({ success: true });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId, assignmentId } = await params;
  const supabase = getSupabase();

  const { data: row, error: fetchError } = await supabase
    .from("transaction_order_assignments")
    .select("id, assigned_by, invoice_storage_path")
    .eq("id", assignmentId)
    .eq("project_id", projectId)
    .maybeSingle();
  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const toolLevel = await getToolLevel(session, projectId, "transaction-orders");
  const canDelete = toolLevel === "admin" || row.assigned_by === session.id;
  if (!canDelete) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error: deleteError } = await supabase
    .from("transaction_order_assignments")
    .delete()
    .eq("id", assignmentId);
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });

  if (row.invoice_storage_path) {
    await supabase.storage.from("project-drawings").remove([row.invoice_storage_path]).catch(() => {});
  }

  return NextResponse.json({ success: true });
}
