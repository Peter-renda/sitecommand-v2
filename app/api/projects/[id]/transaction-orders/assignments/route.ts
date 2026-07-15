import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";
import { getToolLevel } from "@/lib/tool-permissions";
import { isProjectSuperAdmin } from "@/lib/project-access";
import { sendInvoiceAssignmentEmail } from "@/lib/email";

const SIGNED_URL_TTL_SECONDS = 60 * 60;

type Recipient = {
  contactId: string | null;
  userId: string | null;
  email: string;
  name: string;
  role: string;
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;

  // Anyone with at least read_only on the tool may view the assignment
  // list (so PMs and other recipients can see what was assigned to
  // them). Stricter mutations are gated below.
  const level = await getToolLevel(session, projectId, "transaction-orders");
  if (level === "none") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("transaction_order_assignments")
    .select(
      "id, invoice_filename, invoice_storage_path, notes, recipients, status, created_at, completed_at, assigned_by",
    )
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = data ?? [];

  const assignerIds = Array.from(
    new Set(rows.map((r) => r.assigned_by).filter((v): v is string => !!v)),
  );
  const assignerMap = new Map<string, string>();
  if (assignerIds.length > 0) {
    const { data: assigners } = await supabase
      .from("users")
      .select("id, username, first_name, last_name, email")
      .in("id", assignerIds);
    for (const u of assigners ?? []) {
      const name = [u.first_name, u.last_name].filter(Boolean).join(" ").trim();
      assignerMap.set(u.id, name || u.username || u.email || "");
    }
  }

  const assignments = await Promise.all(
    rows.map(async (row) => {
      const { data: urlData } = await supabase.storage
        .from("project-drawings")
        .createSignedUrl(row.invoice_storage_path, SIGNED_URL_TTL_SECONDS);
      return {
        id: row.id,
        invoiceFilename: row.invoice_filename,
        url: urlData?.signedUrl ?? null,
        notes: row.notes,
        recipients: Array.isArray(row.recipients) ? (row.recipients as Recipient[]) : [],
        status: row.status,
        createdAt: row.created_at,
        completedAt: row.completed_at,
        assignedBy: row.assigned_by ? assignerMap.get(row.assigned_by) ?? "" : "",
      };
    }),
  );

  return NextResponse.json({ assignments });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;

  // Assigning an invoice is reserved for Company Super Admins.
  if (!(await isProjectSuperAdmin(projectId, session))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: {
    storagePath?: unknown;
    filename?: unknown;
    notes?: unknown;
    recipients?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON body" }, { status: 400 });
  }

  const filename = typeof body.filename === "string" ? body.filename : "";
  const storagePath = typeof body.storagePath === "string" ? body.storagePath : "";
  if (!filename || !storagePath) {
    return NextResponse.json(
      { error: "filename and storagePath are required" },
      { status: 400 },
    );
  }
  if (!storagePath.startsWith(`${projectId}/_assignments/`)) {
    return NextResponse.json({ error: "Invalid storagePath" }, { status: 400 });
  }

  const notes = typeof body.notes === "string" ? body.notes.trim() : "";

  const rawRecipients = Array.isArray(body.recipients) ? body.recipients : [];
  const recipients: Recipient[] = [];
  for (const r of rawRecipients) {
    if (!r || typeof r !== "object") continue;
    const rec = r as {
      contactId?: unknown;
      userId?: unknown;
      email?: unknown;
      name?: unknown;
      role?: unknown;
    };
    const email = typeof rec.email === "string" ? rec.email.trim().toLowerCase() : "";
    if (!email) continue;
    recipients.push({
      contactId: typeof rec.contactId === "string" ? rec.contactId : null,
      userId: typeof rec.userId === "string" ? rec.userId : null,
      email,
      name: typeof rec.name === "string" ? rec.name.trim() : "",
      role: typeof rec.role === "string" ? rec.role.trim() : "",
    });
  }
  if (recipients.length === 0) {
    return NextResponse.json(
      { error: "At least one recipient is required" },
      { status: 400 },
    );
  }

  const supabase = getSupabase();

  // Backfill userId for any recipient whose email matches a known user.
  const emailsMissingUser = recipients
    .filter((r) => !r.userId)
    .map((r) => r.email);
  if (emailsMissingUser.length > 0) {
    const { data: usersByEmail } = await supabase
      .from("users")
      .select("id, email")
      .in("email", emailsMissingUser);
    const map = new Map<string, string>(
      (usersByEmail ?? []).map((u: { id: string; email: string }) => [u.email.toLowerCase(), u.id]),
    );
    for (const r of recipients) {
      if (!r.userId) {
        const uid = map.get(r.email);
        if (uid) r.userId = uid;
      }
    }
  }

  const { data: inserted, error: insertError } = await supabase
    .from("transaction_order_assignments")
    .insert({
      project_id: projectId,
      assigned_by: session.id,
      invoice_filename: filename,
      invoice_storage_path: storagePath,
      notes: notes || null,
      recipients,
    })
    .select("id")
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // Fire-and-forget email notification.
  try {
    const { data: project } = await supabase
      .from("projects")
      .select("name")
      .eq("id", projectId)
      .single();
    const projectName = project?.name || "your project";
    const projectUrl =
      process.env.NEXT_PUBLIC_APP_URL
        ? `${process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/projects/${projectId}/transaction-orders`
        : `/projects/${projectId}/transaction-orders`;

    await sendInvoiceAssignmentEmail({
      to: recipients.map((r) => r.email),
      projectName,
      invoiceFilename: filename,
      notes,
      projectUrl,
      assignedBy:
        [session.email, session.username].filter(Boolean).join(" / ") ||
        "A SiteCommand admin",
    });
  } catch {
    // Non-fatal — the assignment is still persisted and visible.
  }

  return NextResponse.json({ id: inserted.id });
}
