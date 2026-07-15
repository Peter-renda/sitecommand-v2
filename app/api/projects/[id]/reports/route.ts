import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;
  const supabase = getSupabase();
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const startDate = searchParams.get("start");
  const endDate = searchParams.get("end");
  const actorEmail = searchParams.get("actor_email");
  const eventType = searchParams.get("event_type");

  if (!type) return NextResponse.json({ error: "Missing type" }, { status: 400 });

  // Daily log subtypes — fetch logs then flatten JSONB array
  const dailyLogTypes = [
    "daily-delays",
    "daily-manpower",
    "daily-weather",
    "daily-safety",
    "daily-accidents",
    "daily-inspections",
    "daily-deliveries",
    "daily-visitors",
    "daily-notes",
  ];

  if (dailyLogTypes.includes(type)) {
    let query = supabase
      .from("daily_logs")
      .select("log_date, delays, manpower, weather_observations, safety_violations, accidents, inspections, deliveries, visitors, note_entries")
      .eq("project_id", projectId)
      .order("log_date", { ascending: false });

    if (startDate) query = query.gte("log_date", startDate);
    if (endDate) query = query.lte("log_date", endDate);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const fieldMap: Record<string, string> = {
      "daily-delays": "delays",
      "daily-manpower": "manpower",
      "daily-weather": "weather_observations",
      "daily-safety": "safety_violations",
      "daily-accidents": "accidents",
      "daily-inspections": "inspections",
      "daily-deliveries": "deliveries",
      "daily-visitors": "visitors",
      "daily-notes": "note_entries",
    };

    const field = fieldMap[type];
    const rows: Record<string, unknown>[] = [];
    for (const log of data ?? []) {
      const entries = (log[field as keyof typeof log] as Record<string, unknown>[] | null) ?? [];
      for (const entry of entries) {
        rows.push({ log_date: log.log_date, ...entry });
      }
    }

    return NextResponse.json(rows);
  }

  // Table-based report types
  if (type === "rfis") {
    const { data, error } = await supabase
      .from("rfis")
      .select("rfi_number, subject, status, due_date, created_at")
      .eq("project_id", projectId)
      .order("rfi_number", { ascending: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data ?? []);
  }

  if (type === "submittals") {
    const { data, error } = await supabase
      .from("submittals")
      .select("submittal_number, title, status, submittal_type, submit_by, received_date, issue_date, cost_code")
      .eq("project_id", projectId)
      .order("submittal_number", { ascending: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data ?? []);
  }

  if (type === "tasks") {
    const { data, error } = await supabase
      .from("tasks")
      .select("task_number, title, status, category, created_at")
      .eq("project_id", projectId)
      .order("task_number", { ascending: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data ?? []);
  }

  if (type === "punch-list") {
    const { data, error } = await supabase
      .from("punch_list_items")
      .select("item_number, title, status, type, trade, priority, due_date, location")
      .eq("project_id", projectId)
      .order("item_number", { ascending: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data ?? []);
  }

  if (type === "user-activity") {
    let query = supabase
      .from("activity_log")
      .select("id, type, description, created_at, project_id, user:users(email)")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });

    if (startDate) query = query.gte("created_at", `${startDate}T00:00:00.000Z`);
    if (endDate) query = query.lte("created_at", `${endDate}T23:59:59.999Z`);
    if (eventType) query = query.ilike("type", `%${eventType}%`);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const rows = (data ?? [])
      .map((row) => {
        const eventTypeValue = row.type ?? "";
        const toolName = eventTypeValue.includes(".") ? eventTypeValue.split(".")[0] : eventTypeValue;
        const actorEmailValue =
          row.user && typeof row.user === "object" && "email" in row.user ? (row.user.email as string | null) : null;
        return {
          created_at: row.created_at,
          actor_email: actorEmailValue ?? "System",
          event_type: eventTypeValue,
          tool_name: toolName,
          description: row.description,
          project_name: "Current Project",
          object_id: row.id,
        };
      })
      .filter((row) => (actorEmail ? row.actor_email.toLowerCase().includes(actorEmail.toLowerCase()) : true));

    return NextResponse.json(rows);
  }

  if (type === "commitments-summary") {
    const { data: commitments, error: cmtError } = await supabase
      .from("commitments")
      .select(
        "id, number, type, contract_company, title, status, sov_accounting_method, original_contract_amount, erp_status"
      )
      .eq("project_id", projectId)
      .is("deleted_at", null)
      .order("number", { ascending: true });
    if (cmtError) return NextResponse.json({ error: cmtError.message }, { status: 500 });

    const { data: cos } = await supabase
      .from("change_orders")
      .select("commitment_id, status, amount")
      .eq("project_id", projectId)
      .eq("type", "commitment")
      .is("deleted_at", null);

    const pendingStatuses = new Set([
      "draft",
      "pending - in review",
      "pending - not pricing",
      "pending - not proceeding",
      "pending - pricing",
      "pending - proceeding",
      "pending - revised",
    ]);

    const agg = new Map<string, { pending: number; approved: number }>();
    for (const co of cos || []) {
      if (!co.commitment_id) continue;
      const normalized = String(co.status ?? "").trim().toLowerCase();
      const amount = Number(co.amount ?? 0);
      const curr = agg.get(co.commitment_id) ?? { pending: 0, approved: 0 };
      if (pendingStatuses.has(normalized)) curr.pending += amount;
      if (normalized === "approved") curr.approved += amount;
      agg.set(co.commitment_id, curr);
    }

    const rows = (commitments ?? []).map((c) => {
      const totals = agg.get(c.id) ?? { pending: 0, approved: 0 };
      return {
        number: c.number,
        type: c.type,
        contract_company: c.contract_company,
        title: c.title,
        status: c.status,
        sov_accounting_method: c.sov_accounting_method,
        original_contract_amount: Number(c.original_contract_amount ?? 0),
        approved_change_orders: totals.approved,
        pending_change_orders: totals.pending,
        erp_status: c.erp_status,
      };
    });

    return NextResponse.json(rows);
  }

  if (type === "change-events") {
    const { data, error } = await supabase
      .from("change_events")
      .select("number, title, status, scope, rom_amount, created_at")
      .eq("project_id", projectId)
      .is("deleted_at", null)
      .order("number", { ascending: false });
    if (error) return NextResponse.json([]);
    return NextResponse.json(data ?? []);
  }

  if (type === "commitment-change-orders") {
    const { data: cos, error } = await supabase
      .from("change_orders")
      .select("number, title, status, contract_company, commitment_id, amount, change_reason, due_date")
      .eq("project_id", projectId)
      .eq("type", "commitment")
      .is("deleted_at", null)
      .order("number", { ascending: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const commitmentIds = Array.from(
      new Set((cos ?? []).map((c) => c.commitment_id).filter(Boolean))
    );
    const nameMap = new Map<string, string>();
    if (commitmentIds.length > 0) {
      const { data: commitments } = await supabase
        .from("commitments")
        .select("id, title")
        .in("id", commitmentIds);
      for (const c of commitments ?? []) nameMap.set(c.id, c.title ?? "");
    }

    const rows = (cos ?? []).map((c) => ({
      number: c.number,
      title: c.title,
      status: c.status,
      contract_company: c.contract_company,
      contract_name: c.commitment_id ? nameMap.get(c.commitment_id) ?? "" : "",
      amount: Number(c.amount ?? 0),
      change_reason: c.change_reason,
      due_date: c.due_date,
    }));
    return NextResponse.json(rows);
  }

  if (type === "budget-summary") {
    const { data: lineItems, error: liError } = await supabase
      .from("budget_line_items")
      .select("id, cost_code, description, original_budget_amount, sort_order")
      .eq("project_id", projectId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (liError) return NextResponse.json({ error: liError.message }, { status: 500 });

    const { data: sovItems } = await supabase
      .from("commitment_sov_items")
      .select("budget_code, amount")
      .eq("project_id", projectId);

    const committedByCode = new Map<string, number>();
    for (const row of sovItems ?? []) {
      if (!row.budget_code) continue;
      committedByCode.set(
        row.budget_code,
        (committedByCode.get(row.budget_code) ?? 0) + Number(row.amount ?? 0)
      );
    }

    const rows = (lineItems ?? []).map((li) => {
      const original = Number(li.original_budget_amount ?? 0);
      const committed = committedByCode.get(li.cost_code ?? "") ?? 0;
      return {
        cost_code: li.cost_code,
        description: li.description,
        original_budget: original,
        committed_costs: committed,
        variance: original - committed,
      };
    });
    return NextResponse.json(rows);
  }

  return NextResponse.json({ error: "Unknown report type" }, { status: 400 });
}
