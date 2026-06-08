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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; workflowId: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId, workflowId } = await params;
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
    active?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON body" }, { status: 400 });
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (typeof body.name === "string") {
    const v = body.name.trim();
    if (!v) return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
    updates.name = v;
  }
  if (typeof body.prompt === "string") {
    const v = body.prompt.trim();
    if (!v) return NextResponse.json({ error: "Prompt cannot be empty" }, { status: 400 });
    updates.prompt = v;
  }
  if (typeof body.frequency === "string") {
    const v = body.frequency.trim();
    if (!ALLOWED_FREQUENCIES.has(v)) {
      return NextResponse.json(
        { error: "Frequency must be one of daily, weekly, monthly" },
        { status: 400 },
      );
    }
    updates.frequency = v;
  }
  if (typeof body.runDayOfWeek === "string") {
    const v = body.runDayOfWeek.trim().toLowerCase();
    const validDays = new Set(["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]);
    if (!validDays.has(v)) {
      return NextResponse.json({ error: "Invalid day of week" }, { status: 400 });
    }
    updates.run_day_of_week = v;
  }
  if (body.runDate !== undefined) {
    if (body.runDate === null || body.runDate === "") {
      updates.run_date = null;
    } else if (typeof body.runDate === "string" && isValidDateString(body.runDate.trim())) {
      updates.run_date = body.runDate.trim();
    } else {
      return NextResponse.json({ error: "Invalid date (expected YYYY-MM-DD)" }, { status: 400 });
    }
  }
  if (body.runHourEt !== undefined) {
    const v = typeof body.runHourEt === "number" ? body.runHourEt : Number(body.runHourEt);
    if (!Number.isInteger(v) || v < 0 || v > 23) {
      return NextResponse.json({ error: "Run hour (ET) must be an integer between 0 and 23" }, { status: 400 });
    }
    updates.run_hour_et = v;
  }
  if (body.runMinuteEt !== undefined) {
    const v = typeof body.runMinuteEt === "number" ? body.runMinuteEt : Number(body.runMinuteEt);
    if (!Number.isInteger(v) || v < 0 || v > 59) {
      return NextResponse.json({ error: "Run minute (ET) must be an integer between 0 and 59" }, { status: 400 });
    }
    updates.run_minute_et = v;
  }
  if (Array.isArray(body.recipients)) {
    const recipients: string[] = [];
    for (const r of body.recipients) {
      if (typeof r !== "string") continue;
      const email = r.trim().toLowerCase();
      if (!email || !email.includes("@") || recipients.includes(email)) continue;
      recipients.push(email);
    }
    updates.recipients = recipients;
  }
  if (typeof body.active === "boolean") {
    updates.active = body.active;
  }

  const supabase = getSupabase();
  const { error } = await supabase
    .from("assist_recurring_workflows")
    .update(updates)
    .eq("id", workflowId)
    .eq("project_id", projectId);

  if (error) {
    if (isRecurringWorkflowTableMissing(error.message)) {
      return NextResponse.json(
        {
          error:
            "Recurring workflows are not available yet. Please run the latest database migrations and retry.",
        },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; workflowId: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId, workflowId } = await params;
  const hasAccess = await canAccessProject(projectId, session);
  if (!hasAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getSupabase();
  const { error } = await supabase
    .from("assist_recurring_workflows")
    .delete()
    .eq("id", workflowId)
    .eq("project_id", projectId);

  if (error) {
    if (isRecurringWorkflowTableMissing(error.message)) {
      return NextResponse.json(
        {
          error:
            "Recurring workflows are not available yet. Please run the latest database migrations and retry.",
        },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
