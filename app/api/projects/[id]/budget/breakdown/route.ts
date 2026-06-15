import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getSession } from "@/lib/auth";

// Drill-down breakdown for a single budget column + cost code. Returns the
// source records (commitments, change orders, …) that make up the value shown
// in the budget table, each hyperlinked back to the originating record. The
// client renders these in a No. | Description | Source | Amount table and ties
// the listed amounts back to the displayed cell value with a balancing row.

type BreakdownRow = {
  description: string;
  source_label: string | null;
  source_href: string | null;
  amount: number;
};

type BreakdownGroup = {
  label: string;
  rows: BreakdownRow[];
};

type ChangeOrderRow = {
  id: string;
  number: string;
  title: string;
  status: string;
  amount: number | string | null;
  budget_codes?: string[] | null;
  schedule_of_values?: { budget_code?: string | null; description?: string | null; amount?: number | string | null }[] | null;
  source_change_event_ids?: string[] | null;
};

type CommitmentRow = {
  id: string;
  type: "subcontract" | "purchase_order";
  number: number;
  title: string;
  status: string;
};

type SovItemRow = {
  commitment_id: string;
  description: string;
  amount: number | string | null;
};

const COLUMNS = new Set([
  "approved_cos",
  "pending_budget_changes",
  "committed_costs",
  "pending_cost_changes",
  "job_to_date_costs",
]);

// Mirror the in-flight statuses the budget GET route folds into Pending Budget
// Changes; everything else (approved/void/rejected/no-charge) is excluded.
const PENDING_CO_STATUSES = new Set([
  "draft",
  "pending - in review",
  "pending - not pricing",
  "pending - not proceeding",
  "pending - pricing",
  "pending - proceeding",
  "pending - revised",
]);

function isMissingScheduleOfValuesColumn(message?: string) {
  const text = String(message || "").toLowerCase();
  return text.includes("schedule_of_values") && text.includes("change_orders");
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;
  const supabase = getSupabase();

  const { searchParams } = new URL(req.url);
  const costCode = (searchParams.get("costCode") || "").trim();
  const column = (searchParams.get("column") || "").trim();

  if (!costCode) return NextResponse.json({ error: "costCode is required" }, { status: 400 });
  if (!COLUMNS.has(column)) {
    return NextResponse.json({ error: "Unknown or unsupported column" }, { status: 400 });
  }

  // ERP-sourced actuals have no per-record breakdown — the client renders the
  // value as a single "ERP Job to Date Costs" line.
  if (column === "job_to_date_costs") {
    return NextResponse.json({ cost_code: costCode, column, groups: [] });
  }

  const groups: BreakdownGroup[] = [];

  if (column === "approved_cos" || column === "pending_budget_changes") {
    const wantApproved = column === "approved_cos";
    const rows = await changeOrderRows(supabase, projectId, costCode, wantApproved);
    if (rows.length > 0) groups.push({ label: "Change Orders", rows });
    return NextResponse.json({ cost_code: costCode, column, groups });
  }

  // committed_costs / pending_cost_changes → commitment SOV lines, optionally
  // joined with approved commitment change orders for committed_costs.
  const wantApprovedCommitments = column === "committed_costs";

  const { data: sovRows, error: sovError } = await supabase
    .from("commitment_sov_items")
    .select("commitment_id, description, amount")
    .eq("project_id", projectId)
    .eq("budget_code", costCode)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (sovError) return NextResponse.json({ error: sovError.message }, { status: 500 });

  const commitmentIds = Array.from(
    new Set((sovRows || []).map((r: { commitment_id: string }) => r.commitment_id).filter(Boolean))
  );

  let commitments: CommitmentRow[] = [];
  if (commitmentIds.length > 0) {
    const statusFilter = wantApprovedCommitments ? ["approved"] : ["draft"];
    const { data, error } = await supabase
      .from("commitments")
      .select("id, type, number, title, status")
      .eq("project_id", projectId)
      .is("deleted_at", null)
      .in("status", statusFilter)
      .in("id", commitmentIds)
      .order("number", { ascending: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    commitments = (data || []) as CommitmentRow[];
  }

  const commitmentMap = new Map(commitments.map((c) => [c.id, c]));
  const subcontractRows: BreakdownRow[] = [];
  const poRows: BreakdownRow[] = [];

  for (const line of (sovRows || []) as SovItemRow[]) {
    const commitment = commitmentMap.get(line.commitment_id);
    if (!commitment) continue;
    const amount = Number(line.amount || 0);
    if (!amount) continue;
    const row: BreakdownRow = {
      description: String(line.description || "").trim() || commitment.title || "Commitment line",
      source_label: `#${commitment.number} - ${commitment.title || "Untitled"}`,
      source_href: `/projects/${projectId}/commitments/${commitment.id}`,
      amount,
    };
    if (commitment.type === "purchase_order") poRows.push(row);
    else subcontractRows.push(row);
  }

  const pendingSuffix = wantApprovedCommitments ? "" : " (Pending)";
  if (subcontractRows.length > 0) groups.push({ label: `Subcontracts${pendingSuffix}`, rows: subcontractRows });
  if (poRows.length > 0) groups.push({ label: `Purchase Orders${pendingSuffix}`, rows: poRows });

  if (wantApprovedCommitments) {
    const coRows = await changeOrderRows(supabase, projectId, costCode, true);
    if (coRows.length > 0) groups.push({ label: "Commitment Change Orders", rows: coRows });
  }

  return NextResponse.json({ cost_code: costCode, column, groups });
}

// Builds breakdown rows from commitment-type change orders whose SOV lines (or
// legacy budget_codes) match the cost code, matching the budget GET route's
// approved/pending split. Source labels surface any linked change events so the
// row reads like "CO #001 - CE #001 Rock blasting".
async function changeOrderRows(
  supabase: ReturnType<typeof getSupabase>,
  projectId: string,
  costCode: string,
  wantApproved: boolean
): Promise<BreakdownRow[]> {
  const primary = await supabase
    .from("change_orders")
    .select("id, number, title, status, amount, budget_codes, schedule_of_values, source_change_event_ids")
    .eq("project_id", projectId)
    .eq("type", "commitment")
    .is("deleted_at", null)
    .order("number", { ascending: true });

  let data = primary.data as ChangeOrderRow[] | null;
  let error = primary.error;

  if (isMissingScheduleOfValuesColumn(error?.message)) {
    const fallback = await supabase
      .from("change_orders")
      .select("id, number, title, status, amount, budget_codes, source_change_event_ids")
      .eq("project_id", projectId)
      .eq("type", "commitment")
      .is("deleted_at", null)
      .order("number", { ascending: true });
    data = fallback.data as ChangeOrderRow[] | null;
    error = fallback.error;
  }

  if (error || !data) return [];

  const orders = data;
  const matched = orders.filter((co) => {
    const normalized = String(co.status || "").trim().toLowerCase();
    if (wantApproved ? normalized !== "approved" : !PENDING_CO_STATUSES.has(normalized)) return false;
    const sovLines = Array.isArray(co.schedule_of_values) ? co.schedule_of_values : [];
    const sovMatch = sovLines.some((l) => String(l?.budget_code || "").trim() === costCode && Number(l?.amount || 0));
    const legacyMatch = Array.isArray(co.budget_codes) && co.budget_codes.some((c) => String(c || "").trim() === costCode);
    return sovMatch || legacyMatch;
  });

  // Resolve linked change events for richer source labels.
  const ceIds = Array.from(
    new Set(matched.flatMap((co) => (Array.isArray(co.source_change_event_ids) ? co.source_change_event_ids : [])))
  );
  const ceMap = new Map<string, { number: number; title: string }>();
  if (ceIds.length > 0) {
    const { data: ceData } = await supabase
      .from("change_events")
      .select("id, number, title")
      .eq("project_id", projectId)
      .in("id", ceIds);
    for (const ce of ceData || []) {
      ceMap.set(ce.id, { number: ce.number, title: ce.title || "" });
    }
  }

  const rows: BreakdownRow[] = [];
  for (const co of matched) {
    const ceParts = (Array.isArray(co.source_change_event_ids) ? co.source_change_event_ids : [])
      .map((id) => ceMap.get(id))
      .filter(Boolean)
      .map((ce) => `CE #${String(ce!.number).padStart(3, "0")}${ce!.title ? ` ${ce!.title}` : ""}`);
    const sourceLabel = [`CO #${co.number}`, ...ceParts].join(" - ") || `CO #${co.number}`;
    const sourceHref = `/projects/${projectId}/change-orders/${co.id}`;

    const sovLines = (Array.isArray(co.schedule_of_values) ? co.schedule_of_values : []).filter(
      (l) => String(l?.budget_code || "").trim() === costCode && Number(l?.amount || 0)
    );

    if (sovLines.length > 0) {
      for (const line of sovLines) {
        rows.push({
          description: String(line.description || "").trim() || co.title || "Change order line",
          source_label: sourceLabel,
          source_href: sourceHref,
          amount: Number(line.amount || 0),
        });
      }
    } else {
      // Legacy budget_codes match — attribute the full change order amount.
      rows.push({
        description: co.title || "Change Order",
        source_label: sourceLabel,
        source_href: sourceHref,
        amount: Number(co.amount || 0),
      });
    }
  }

  return rows;
}
