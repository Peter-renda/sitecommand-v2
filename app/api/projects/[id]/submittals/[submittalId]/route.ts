import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getSession } from "@/lib/auth";
import { calculateSubmittalSchedule } from "@/lib/submittalSchedule";
import { logSubmittalDiff } from "@/lib/submittal-history";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; submittalId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId, submittalId } = await params;
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("submittals")
    .select("*")
    .eq("id", submittalId)
    .eq("project_id", projectId)
    .eq("is_deleted", false)
    .single();

  if (error || !data) return NextResponse.json({ error: "Submittal not found" }, { status: 404 });
  return NextResponse.json(data);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; submittalId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId, submittalId } = await params;
  const body = await req.json();

  const allowed = [
    "title", "revision", "specification_id", "submittal_type", "status",
    "responsible_contractor_id", "received_from_id", "submittal_manager_id", "approver_name_id",
    "submit_by", "received_date", "issue_date", "final_due_date",
    "cost_code", "linked_drawings", "distribution_list", "ball_in_court_id",
    "lead_time", "design_team_review_time", "internal_review_time", "required_on_site_date", "private", "description", "attachments",
    "planned_return_date", "planned_internal_review_completed_date", "planned_submit_by_date", "submitter_due_date", "approver_due_date",
    "owners_manual", "package_notes", "confirmed_delivery_date", "actual_delivery_date",
    "workflow_steps", "related_items", "closed_at", "closed_by", "distributed_at", "distributed_by",
    "report_fields",
  ];
  const update: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) update[key] = body[key] ?? null;
  }

  const scheduleInput = {
    required_on_site_date: ("required_on_site_date" in body ? body.required_on_site_date : undefined) as string | null | undefined,
    lead_time: ("lead_time" in body ? body.lead_time : undefined) as number | null | undefined,
    design_team_review_time: ("design_team_review_time" in body ? body.design_team_review_time : undefined) as number | null | undefined,
    internal_review_time: ("internal_review_time" in body ? body.internal_review_time : undefined) as number | null | undefined,
  };
  const hasScheduleInput = Object.values(scheduleInput).some((v) => v !== undefined);
  if (hasScheduleInput) {
    Object.assign(update, calculateSubmittalSchedule(scheduleInput));
  }

  const supabase = getSupabase();
  const { data: previous } = await supabase
    .from("submittals")
    .select("*")
    .eq("id", submittalId)
    .eq("project_id", projectId)
    .eq("is_deleted", false)
    .single();

  const { data, error } = await supabase
    .from("submittals")
    .update(update)
    .eq("id", submittalId)
    .eq("project_id", projectId)
    .eq("is_deleted", false)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logSubmittalDiff(
    supabase,
    session,
    submittalId,
    projectId,
    (previous ?? null) as Record<string, unknown> | null,
    data as Record<string, unknown>,
  );
  return NextResponse.json(data);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; submittalId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId, submittalId } = await params;
  const supabase = getSupabase();

  const { data: previous } = await supabase
    .from("submittals")
    .select("*")
    .eq("id", submittalId)
    .eq("project_id", projectId)
    .eq("is_deleted", false)
    .single();

  const { data, error } = await supabase
    .from("submittals")
    .update({ is_deleted: true, deleted_at: new Date().toISOString(), deleted_by: session.id })
    .eq("id", submittalId)
    .eq("project_id", projectId)
    .eq("is_deleted", false)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (data) {
    await logSubmittalDiff(
      supabase,
      session,
      submittalId,
      projectId,
      (previous ?? null) as Record<string, unknown> | null,
      data as Record<string, unknown>,
    );
  }
  return NextResponse.json({ ok: true });
}
