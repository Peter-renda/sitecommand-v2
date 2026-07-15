import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getSession } from "@/lib/auth";
import { requireToolLevel } from "@/lib/tool-permissions";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; commitmentId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId, commitmentId } = await params;
  const denied = await requireToolLevel(session, projectId, "commitments", "read_only");
  if (denied) return denied;

  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("commitments")
    .select("*")
    .eq("id", commitmentId)
    .eq("project_id", projectId)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

const TRACKED_FIELDS = [
  "contract_company", "title", "status", "executed", "default_retainage",
  "original_contract_amount", "approved_change_orders", "pending_change_orders", "draft_amount",
  "ssov_enabled", "is_private", "sov_view_allowed", "sov_accounting_method",
  "financial_markup_enabled", "erp_status",
  "start_date", "estimated_completion", "actual_completion", "signed_contract_received",
  "contract_date", "delivery_date", "signed_po_received_date", "issued_on_date",
  "inclusions", "exclusions", "description",
];

const RICH_TEXT_FIELDS = new Set(["description", "inclusions", "exclusions", "exhibit_a_scope"]);

const FIELD_LABELS: Record<string, string> = {
  contract_company: "Contract Company",
  title: "Title",
  status: "Status",
  executed: "Executed",
  default_retainage: "Default Retainage",
  original_contract_amount: "Original Contract Amount",
  approved_change_orders: "Approved Change Orders",
  pending_change_orders: "Pending Change Orders",
  draft_amount: "Draft Amount",
  ssov_enabled: "Subcontractor SOV",
  is_private: "Private",
  sov_view_allowed: "Allow Non-Admin SOV View",
  sov_accounting_method: "Accounting Method",
  financial_markup_enabled: "Financial Markup",
  erp_status: "ERP Status",
  start_date: "Start Date",
  estimated_completion: "Estimated Completion",
  actual_completion: "Actual Completion",
  signed_contract_received: "Signed Contract Received",
  contract_date: "Contract Date",
  delivery_date: "Delivery Date",
  signed_po_received_date: "Signed PO Received",
  issued_on_date: "Issued On",
  inclusions: "Inclusions",
  exclusions: "Exclusions",
  description: "Description",
};

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; commitmentId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId, commitmentId } = await params;
  const denied = await requireToolLevel(session, projectId, "commitments", "admin");
  if (denied) return denied;

  const supabase = getSupabase();
  const body = await req.json();

  const allowed = [
    "type",
    "contract_company",
    "title",
    "erp_status",
    "status",
    "executed",
    "default_retainage",
    "assigned_to",
    "bill_to",
    "payment_terms",
    "ship_to",
    "ship_via",
    "description",
    "delivery_date",
    "signed_po_received_date",
    "is_private",
    "sov_view_allowed",
    "ssov_enabled",
    "original_contract_amount",
    "approved_change_orders",
    "pending_change_orders",
    "draft_amount",
    "subcontract_cover_letter",
    "bond_amount",
    "exhibit_a_scope",
    "trades",
    "subcontractor_contact",
    "subcontract_type",
    "show_cover_letter",
    "show_executed_cover_letter",
    "sov_accounting_method",
    "sort_order",
    "deleted_at",
    // Subcontract-specific dates
    "start_date",
    "estimated_completion",
    "actual_completion",
    "signed_contract_received",
    // Subcontract scope
    "inclusions",
    "exclusions",
    // PO-specific dates
    "contract_date",
    "issued_on_date",
    // DocuSign / markup
    "sign_docusign",
    "financial_markup_enabled",
    // 360 Report-backed fields
    "report_fields",
  ];
  // ssov_status is intentionally excluded — transitions go through the
  // dedicated /ssov/notify, /ssov/submit and /ssov/revise endpoints.

  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  // Fetch current state for change history comparison (skip for restore/sort-only updates)
  let currentCommitment: Record<string, unknown> | null = null;
  const isRestoringDelete = "deleted_at" in updates && updates.deleted_at === null;
  if (!isRestoringDelete) {
    const { data: curr } = await supabase
      .from("commitments")
      .select("*")
      .eq("id", commitmentId)
      .eq("project_id", projectId)
      .single();
    currentCommitment = curr as Record<string, unknown> | null;
  }

  // When the SSOV tab is toggled, keep ssov_status consistent with it.
  if ("ssov_enabled" in updates) {
    if (!currentCommitment) {
      const { data: curr } = await supabase
        .from("commitments")
        .select("ssov_enabled, ssov_status")
        .eq("id", commitmentId)
        .eq("project_id", projectId)
        .single();
      currentCommitment = curr as Record<string, unknown> | null;
    }

    if (updates.ssov_enabled === true && currentCommitment && !currentCommitment.ssov_enabled) {
      updates.ssov_status = "draft";
    }
    if (updates.ssov_enabled === false) {
      updates.ssov_status = "";
      updates.ssov_notified_at = null;
      updates.ssov_submitted_at = null;
    }
  }

  const { data, error } = await supabase
    .from("commitments")
    .update(updates)
    .eq("id", commitmentId)
    .eq("project_id", projectId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Record change history
  if (currentCommitment && !("deleted_at" in updates)) {
    const historyEntries: {
      commitment_id: string;
      project_id: string;
      changed_by: string;
      changed_by_name: string;
      action: string;
      field_name: string;
      from_value: string | null;
      to_value: string | null;
    }[] = [];

    for (const field of TRACKED_FIELDS) {
      if (!(field in updates)) continue;
      const oldVal = currentCommitment[field];
      const newVal = updates[field];
      if (String(oldVal ?? "") === String(newVal ?? "")) continue;

      const isRich = RICH_TEXT_FIELDS.has(field);
      historyEntries.push({
        commitment_id: commitmentId,
        project_id: projectId,
        changed_by: session.id,
        changed_by_name: session.username,
        action: `Updated ${FIELD_LABELS[field] ?? field}`,
        field_name: field,
        from_value: isRich ? null : String(oldVal ?? ""),
        to_value: isRich ? null : String(newVal ?? ""),
      });
    }

    if (historyEntries.length > 0) {
      await supabase.from("commitment_change_history").insert(historyEntries);
    }
  }

  return NextResponse.json(data);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; commitmentId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId, commitmentId } = await params;
  const denied = await requireToolLevel(session, projectId, "commitments", "admin");
  if (denied) return denied;

  const supabase = getSupabase();

  // Soft delete
  const { error } = await supabase
    .from("commitments")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", commitmentId)
    .eq("project_id", projectId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
