import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { canAccessProject } from "@/lib/project-access";
import { getSupabase } from "@/lib/supabase";

const ALLOWED_FREQUENCIES = new Set(["daily", "weekly", "monthly"]);

function isValidDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function isRecurringWorkflowTableMissing(errorMessage: string | null | undefined) {
  if (!errorMessage) return false;
  const normalized = errorMessage.toLowerCase();
  return (
    normalized.includes("assist_recurring_workflows") &&
    (normalized.includes("schema cache") || normalized.includes("does not exist"))
  );
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;
  const hasAccess = await canAccessProject(projectId, session);
  if (!hasAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("assist_recurring_workflows")
    .select("id, name, prompt, frequency, run_day_of_week, run_date, run_hour_et, run_minute_et, recipients, active, created_at, last_run_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (error) {
    if (isRecurringWorkflowTableMissing(error.message)) {
      return NextResponse.json({ workflows: [] });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const workflowIds = (data ?? []).map((row) => row.id as string);
  const { data: reportRows } = workflowIds.length
    ? await supabase
        .from("assist_recurring_workflow_reports")
        .select("id, workflow_id, file_name, file_url, file_type, created_at")
        .in("workflow_id", workflowIds)
        .order("created_at", { ascending: false })
    : { data: [] as Array<Record<string, unknown>> };

  const reportsByWorkflow = new Map<string, Array<Record<string, unknown>>>();
  for (const report of reportRows ?? []) {
    const workflowId = String(report.workflow_id ?? "");
    if (!workflowId) continue;
    const existing = reportsByWorkflow.get(workflowId) ?? [];
    existing.push(report);
    reportsByWorkflow.set(workflowId, existing);
  }

  const workflows = (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    prompt: row.prompt,
    frequency: row.frequency,
    runDayOfWeek: row.run_day_of_week,
    runDate: row.run_date,
    runHourEt: row.run_hour_et,
    runMinuteEt: row.run_minute_et,
    recipients: Array.isArray(row.recipients) ? (row.recipients as string[]) : [],
    active: row.active,
    createdAt: row.created_at,
    lastRunAt: row.last_run_at,
    reports: (reportsByWorkflow.get(row.id) ?? []).map((report) => ({
      id: report.id,
      fileName: report.file_name,
      fileUrl: report.file_url,
      fileType: report.file_type,
      createdAt: report.created_at,
    })),
  }));

  return NextResponse.json({ workflows });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;
  const hasAccess = await canAccessProject(projectId, session);
  if (!hasAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: {
    name?: unknown;
    prompt?: unknown;
    frequency?: unknown;
    runDayOfWeek?: unknown;
    runDate?: unknown;
    runHourEt?: unknown;
    runMinuteEt?: unknown;
    recipients?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON body" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const frequency = typeof body.frequency === "string" ? body.frequency.trim() : "";
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  if (!prompt) return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
  if (!ALLOWED_FREQUENCIES.has(frequency)) {
    return NextResponse.json(
      { error: "Frequency must be one of daily, weekly, monthly" },
      { status: 400 },
    );
  }
  const runDayOfWeek = typeof body.runDayOfWeek === "string" ? body.runDayOfWeek.trim().toLowerCase() : "";
  const validDays = new Set(["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]);
  if (!validDays.has(runDayOfWeek)) {
    return NextResponse.json({ error: "Day of week is required" }, { status: 400 });
  }
  const runHourEt = typeof body.runHourEt === "number" ? body.runHourEt : Number(body.runHourEt);
  const runMinuteEt = typeof body.runMinuteEt === "number" ? body.runMinuteEt : Number(body.runMinuteEt);
  if (!Number.isInteger(runHourEt) || runHourEt < 0 || runHourEt > 23) {
    return NextResponse.json({ error: "Run hour (ET) must be an integer between 0 and 23" }, { status: 400 });
  }
  if (!Number.isInteger(runMinuteEt) || runMinuteEt < 0 || runMinuteEt > 59) {
    return NextResponse.json({ error: "Run minute (ET) must be an integer between 0 and 59" }, { status: 400 });
  }

  let runDate: string | null = null;
  if (frequency === "monthly") {
    const raw = typeof body.runDate === "string" ? body.runDate.trim() : "";
    if (!isValidDateString(raw)) {
      return NextResponse.json(
        { error: "A valid date (YYYY-MM-DD) is required for monthly workflows" },
        { status: 400 },
      );
    }
    runDate = raw;
  }

  const rawRecipients = Array.isArray(body.recipients) ? body.recipients : [];
  const recipients: string[] = [];
  for (const r of rawRecipients) {
    if (typeof r !== "string") continue;
    const email = r.trim().toLowerCase();
    if (!email) continue;
    if (!email.includes("@")) continue;
    if (recipients.includes(email)) continue;
    recipients.push(email);
  }

  const supabase = getSupabase();
  const { data: inserted, error: insertError } = await supabase
    .from("assist_recurring_workflows")
    .insert({
      project_id: projectId,
      created_by: session.id,
      name,
      prompt,
      frequency,
      run_day_of_week: runDayOfWeek,
      run_date: runDate,
      run_hour_et: runHourEt,
      run_minute_et: runMinuteEt,
      recipients,
    })
    .select("id, name, prompt, frequency, run_day_of_week, run_date, run_hour_et, run_minute_et, recipients, active, created_at, last_run_at")
    .single();

  if (insertError) {
    if (isRecurringWorkflowTableMissing(insertError.message)) {
      return NextResponse.json(
        {
          error:
            "Recurring workflows are not available yet. Please run the latest database migrations and retry.",
        },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({
    workflow: {
      id: inserted.id,
      name: inserted.name,
      prompt: inserted.prompt,
      frequency: inserted.frequency,
      runDayOfWeek: inserted.run_day_of_week,
      runDate: inserted.run_date,
      runHourEt: inserted.run_hour_et,
      runMinuteEt: inserted.run_minute_et,
      recipients: Array.isArray(inserted.recipients) ? (inserted.recipients as string[]) : [],
      active: inserted.active,
      createdAt: inserted.created_at,
      lastRunAt: inserted.last_run_at,
    },
  });
}
