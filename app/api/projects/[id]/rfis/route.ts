import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getSession } from "@/lib/auth";
import { canAccessProject } from "@/lib/project-access";
import { requireToolLevel } from "@/lib/tool-permissions";
import { dispatchWebhookEvent } from "@/lib/webhook-dispatch";
import { logRFIChange } from "@/lib/rfi-history";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;
  const recycleBin = _req.nextUrl.searchParams.get("recycle_bin") === "true";

  if (!(await canAccessProject(projectId, session))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = getSupabase();

  const query = supabase
    .from("rfis")
    .select("*")
    .eq("project_id", projectId)
    .order("rfi_number", { ascending: true });

  if (recycleBin) query.eq("is_deleted", true);
  else query.or("is_deleted.is.null,is_deleted.eq.false");

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;

  const denied = await requireToolLevel(session, projectId, "rfis", "admin");
  if (denied) return denied;

  const supabase = getSupabase();

  const { data: maxRow } = await supabase
    .from("rfis")
    .select("rfi_number")
    .eq("project_id", projectId)
    .eq("is_deleted", false)
    .order("rfi_number", { ascending: false })
    .limit(1)
    .single();

  const autoNumber = (maxRow?.rfi_number ?? 0) + 1;

  const body = await req.json();
  const customNumber = typeof body.rfi_number === "number" && Number.isInteger(body.rfi_number) && body.rfi_number > 0 ? body.rfi_number : null;
  const nextNumber = customNumber ?? autoNumber;

  const subject = (body.subject ?? "").toString().slice(0, 200);
  const {
    question,
    due_date,
    status,
    rfi_manager_id,
    received_from_id,
    assignees,
    distribution_list,
    responsible_contractor_id,
    specification_id,
    drawing_number,
    schedule_impact,
    cost_impact,
    cost_code,
    sub_job,
    rfi_stage,
    private: isPrivate,
    attachments,
  } = body;

  const finalStatus = status === "open" ? "open" : "draft";
  const assigneesList = Array.isArray(assignees) ? (assignees as { id?: string }[]) : [];
  const firstAssigneeId = assigneesList.find((a) => a?.id)?.id ?? null;
  const ballInCourtId = finalStatus === "open" ? firstAssigneeId : null;

  const { data, error } = await supabase
    .from("rfis")
    .insert({
      project_id: projectId,
      rfi_number: nextNumber,
      subject: subject || null,
      question: question || null,
      due_date: due_date || null,
      status: finalStatus,
      rfi_manager_id: rfi_manager_id || null,
      received_from_id: received_from_id || null,
      assignees: assignees ?? [],
      distribution_list: distribution_list ?? [],
      responsible_contractor_id: responsible_contractor_id || null,
      specification_id: specification_id || null,
      drawing_number: drawing_number || null,
      schedule_impact: schedule_impact || null,
      cost_impact: cost_impact || null,
      cost_code: cost_code || null,
      sub_job: sub_job || null,
      rfi_stage: rfi_stage || null,
      private: isPrivate ?? false,
      attachments: attachments ?? [],
      created_by: session.id,
      ball_in_court_id: ballInCourtId,
      ball_in_court_set_at: ballInCourtId ? new Date().toISOString() : null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logRFIChange(supabase, session, data.id, projectId, "Created RFI", null, `RFI #${data.rfi_number}`);

  const contactIds = [data.rfi_manager_id, data.received_from_id, data.responsible_contractor_id].filter(Boolean) as string[];
  const [contactsRes, specsRes] = await Promise.all([
    contactIds.length > 0
      ? supabase.from("directory_contacts").select("id, first_name, last_name").in("id", contactIds)
      : Promise.resolve({ data: [] as { id: string; first_name: string | null; last_name: string | null }[] }),
    data.specification_id
      ? supabase.from("specifications").select("id, name, code").eq("id", data.specification_id).single()
      : Promise.resolve({ data: null as { id: string; name: string | null; code: string | null } | null }),
  ]);

  const contactNameById = (id: string | null): string => {
    if (!id) return "";
    const c = (contactsRes.data ?? []).find((x) => x.id === id);
    if (!c) return id;
    const name = [c.first_name, c.last_name].filter(Boolean).join(" ").trim();
    return name || id;
  };

  const spec = specsRes.data;
  const specLabel = spec ? (spec.code ? `${spec.name ?? spec.id} (${spec.code})` : (spec.name ?? spec.id)) : "";

  const historyRows: Array<{ action: string; toValue: string }> = [
    { action: "RFI Number", toValue: String(data.rfi_number ?? "") },
    { action: "Subject", toValue: String(data.subject ?? "") },
    { action: "Question", toValue: typeof data.question === "string" && data.question.trim() ? "Updated" : "" },
    { action: "Due Date", toValue: String(data.due_date ?? "") },
    { action: "Status", toValue: String(data.status ?? "") },
    { action: "RFI Manager", toValue: contactNameById(data.rfi_manager_id ?? null) },
    { action: "Received From", toValue: contactNameById(data.received_from_id ?? null) },
    { action: "Responsible Contractor", toValue: contactNameById(data.responsible_contractor_id ?? null) },
    { action: "Specification", toValue: specLabel },
    { action: "Drawing Number", toValue: String(data.drawing_number ?? "") },
    { action: "Schedule Impact", toValue: String(data.schedule_impact ?? "") },
    { action: "Cost Impact", toValue: String(data.cost_impact ?? "") },
    { action: "Cost Code", toValue: String(data.cost_code ?? "") },
    { action: "Sub Job", toValue: String(data.sub_job ?? "") },
    { action: "RFI Stage", toValue: String(data.rfi_stage ?? "") },
    { action: "Private", toValue: data.private ? "Yes" : "No" },
  ];

  await Promise.allSettled([
    ...historyRows.map((row) => logRFIChange(supabase, session, data.id, projectId, row.action, "", row.toValue)),
    ...((Array.isArray(data.assignees) ? data.assignees : []) as { id?: string | null; name?: string | null }[]).map((m) =>
      logRFIChange(supabase, session, data.id, projectId, "Added Assignee", "", m?.name?.trim() || m?.id?.trim() || "Unknown")
    ),
    ...((Array.isArray(data.distribution_list) ? data.distribution_list : []) as { id?: string | null; name?: string | null }[]).map((m) =>
      logRFIChange(supabase, session, data.id, projectId, "Added Distribution Member", "", m?.name?.trim() || m?.id?.trim() || "Unknown")
    ),
    ...((Array.isArray(data.attachments) ? data.attachments : []) as { name?: string }[]).map((a) =>
      logRFIChange(supabase, session, data.id, projectId, "Attachment Added", "", a.name ?? "Attachment")
    ),
  ]);

  if (session.company_id) {
    dispatchWebhookEvent(session.company_id, "rfi.created", {
      id: data.id,
      rfi_number: data.rfi_number,
      subject: data.subject,
      project_id: projectId,
    }).catch(() => {});
  }

  return NextResponse.json(data);
}
