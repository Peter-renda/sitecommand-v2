import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getSession } from "@/lib/auth";
import { checkProjectAccess } from "@/lib/permissions";
import { logChangeEventHistory } from "@/lib/change-event-history";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;

  try {
    await checkProjectAccess(session.id, projectId);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const supabase = getSupabase();
  const { searchParams } = new URL(req.url);
  const includeDeleted = searchParams.get("recycle_bin") === "true";

  const query = supabase
    .from("change_events")
    .select(`
      *,
      line_items:change_event_line_items(*)
    `)
    .eq("project_id", projectId)
    .order("number", { ascending: false });

  if (includeDeleted) {
    query.not("deleted_at", "is", null);
  } else {
    query.is("deleted_at", null);
  }

  const { data, error } = await query;
  if (error) {
    // Table may not exist yet — return empty array gracefully
    return NextResponse.json([]);
  }
  return NextResponse.json(data || []);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;

  try {
    const { permission } = await checkProjectAccess(session.id, projectId);
    if (permission !== "write") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = getSupabase();
  const body = await req.json();

  // Get next number
  const { data: existing } = await supabase
    .from("change_events")
    .select("number")
    .eq("project_id", projectId)
    .is("deleted_at", null)
    .order("number", { ascending: false })
    .limit(1);

  const nextNumber = existing && existing.length > 0 ? existing[0].number + 1 : 1;

  const { data, error } = await supabase
    .from("change_events")
    .insert({
      project_id: projectId,
      number: nextNumber,
      title: body.title || "",
      status: body.status || "Open",
      origin: body.origin ?? null,
      type: body.type ?? null,
      change_reason: body.change_reason ?? null,
      scope: body.scope ?? null,
      expecting_revenue: body.expecting_revenue ?? false,
      revenue_source: body.revenue_source ?? null,
      prime_contract: body.prime_contract ?? null,
      description: body.description ?? null,
      created_by: session.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Insert line items if provided
  const lineItems = Array.isArray(body.line_items) ? body.line_items : [];
  if (lineItems.length > 0) {
    const { error: liError } = await supabase
      .from("change_event_line_items")
      .insert(
        lineItems.map((li: Record<string, unknown>) => ({
          change_event_id: data.id,
          budget_code: li.budget_code ?? null,
          description: li.description ?? null,
          vendor: li.vendor ?? null,
          contract_number: li.contract_number ?? null,
          unit_of_measure: li.unit_of_measure ?? null,
          rev_unit_qty: li.rev_unit_qty ?? null,
          rev_unit_cost: li.rev_unit_cost ?? null,
          rev_rom: li.rev_rom ?? null,
          cost_unit_qty: li.cost_unit_qty ?? null,
          cost_unit_cost: li.cost_unit_cost ?? null,
          cost_rom: li.cost_rom ?? null,
        }))
      );
    if (liError) return NextResponse.json({ error: liError.message }, { status: 500 });
  }

  await logChangeEventHistory(
    supabase,
    session,
    data.id,
    projectId,
    "This change event was created",
    null,
    `Change Event #${String(data.number).padStart(3, "0")}`
  );

  // Log individual field history entries for fields set at creation
  const fieldLogs: Array<[string, string]> = [];
  if (data.title) fieldLogs.push(["Title", data.title]);
  if (data.status) fieldLogs.push(["Status", data.status]);
  if (data.origin) fieldLogs.push(["Origin", data.origin]);
  if (data.type) fieldLogs.push(["Type", data.type]);
  if (data.change_reason) fieldLogs.push(["Change Reason", data.change_reason]);
  if (data.scope) fieldLogs.push(["Scope", data.scope]);
  fieldLogs.push(["Expecting Revenue", data.expecting_revenue ? "Yes" : "No"]);
  if (data.revenue_source) fieldLogs.push(["Revenue Source", data.revenue_source]);
  if (data.prime_contract) fieldLogs.push(["Prime Contract", data.prime_contract]);

  for (const [action, toValue] of fieldLogs) {
    await logChangeEventHistory(supabase, session, data.id, projectId, action, "(None)", toValue);
  }

  if (lineItems.length > 0) {
    await logChangeEventHistory(
      supabase,
      session,
      data.id,
      projectId,
      "Added change event/line item",
      "(None)",
      `${lineItems.length} line item${lineItems.length === 1 ? "" : "s"} added`
    );
  }

  return NextResponse.json(data);
}
