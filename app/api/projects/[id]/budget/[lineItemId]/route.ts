import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getSession } from "@/lib/auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; lineItemId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId, lineItemId } = await params;
  const supabase = getSupabase();
  const body = await req.json();

  const allowed = [
    "cost_code",
    "cost_type",
    "description",
    "manual_calculation",
    "unit_qty",
    "unit_of_measure",
    "unit_cost",
    "original_budget_amount",
    "budget_modifications",
    "approved_cos",
    "pending_budget_changes",
    "committed_costs",
    "job_to_date_costs",
    "commitments_invoiced",
    "pending_cost_changes",
    "start_date",
    "end_date",
    "curve",
    "sort_order",
    "is_partial_line_item",
    "is_gst_line_item",
    "report_fields",
  ];

  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  const normalizedCode = String(updates.cost_code ?? "").trim();
  const normalizedType = String(updates.cost_type ?? "").trim();
  if (!normalizedCode) {
    return NextResponse.json({ error: "Cost code is required" }, { status: 400 });
  }
  if (!normalizedType) {
    return NextResponse.json({ error: "Cost type is required" }, { status: 400 });
  }
  updates.cost_code = normalizedCode;
  updates.cost_type = normalizedType;

  const { data: existing, error: existingError } = await supabase
    .from("budget_line_items")
    .select("id")
    .eq("project_id", projectId)
    .eq("cost_code", normalizedCode)
    .eq("cost_type", normalizedType)
    .neq("id", lineItemId)
    .limit(1);
  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 });
  if ((existing || []).length > 0) {
    return NextResponse.json(
      { error: "A budget line item already exists for this Cost Code and Cost Type." },
      { status: 409 }
    );
  }

  const { data, error } = await supabase
    .from("budget_line_items")
    .update(updates)
    .eq("id", lineItemId)
    .eq("project_id", projectId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; lineItemId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId, lineItemId } = await params;
  const supabase = getSupabase();

  const { error } = await supabase
    .from("budget_line_items")
    .delete()
    .eq("id", lineItemId)
    .eq("project_id", projectId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
