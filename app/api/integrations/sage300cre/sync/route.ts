/**
 * POST /api/integrations/sage300cre/sync
 *
 * Triggers a manual sync of a SiteCommand record to Sage 300 CRE (via Agave).
 *
 * Supported recordType values:
 *   "commitments"     – Create/update a Purchase Order (subcontract or PO)
 *   "prime_contracts" – Create/update an AR Invoice (contract)
 *   "ap_invoice"      – Push an AP Invoice from commitment SOV billed amounts
 *   "ar_invoice"      – Push an AR Invoice from prime contract SOV this-period amounts
 *
 * On success the record's erp_status is set to 'synced'; on failure it reverts to
 * 'not_synced'. A row is always written to erp_sync_logs with
 * integration='sage300cre'.
 *
 * Body: { recordType: string, recordId: string }
 * Auth: any authenticated company member (the company must have connected Sage 300 CRE).
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";
import {
  getSage300CreAppCredentials,
  getSage300CreCompanyCredentials,
  isSage300CreConnected,
  syncCommitmentToSage300Cre,
  syncPrimeContractToSage300Cre,
  syncAPInvoiceToSage300Cre,
  syncARInvoiceToSage300Cre,
  type Sage300CreResult,
} from "@/lib/sage300cre";

const VALID_TYPES = ["commitments", "prime_contracts", "ap_invoice", "ar_invoice"] as const;
type RecordType = (typeof VALID_TYPES)[number];

/**
 * Distinguishes "row genuinely absent" (PGRST116: zero rows for .single()) from
 * a failed query (e.g. a column missing because a migration wasn't applied).
 */
function fetchFailure(
  label: string,
  fetchErr: { code?: string; message?: string } | null,
  row: unknown
): NextResponse | null {
  if (fetchErr && fetchErr.code !== "PGRST116") {
    return NextResponse.json(
      { error: `Failed to load ${label}: ${fetchErr.message ?? "database error"}. If this mentions a missing column, apply supabase/migrations/160_sage300cre_idempotency_columns.sql.` },
      { status: 500 }
    );
  }
  if (!row) {
    return NextResponse.json({ error: `${label[0].toUpperCase()}${label.slice(1)} not found` }, { status: 404 });
  }
  return null;
}

async function writeLog(
  supabase: ReturnType<typeof getSupabase>,
  recordType: string,
  recordId: string,
  result: Sage300CreResult
) {
  await supabase.from("erp_sync_logs").insert({
    record_type: recordType,
    record_id: recordId,
    integration: "sage300cre",
    result: result.ok ? "success" : "error",
    sage_key: result.ok ? result.id : null,
    error_message: result.ok ? null : result.error,
    raw_response: result.rawResponse ?? null,
  });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.company_id) {
    return NextResponse.json({ error: "No company associated with this account" }, { status: 422 });
  }

  const body = await req.json();
  const { recordType, recordId } = body as { recordType: string; recordId: string };

  if (!recordType || !recordId) {
    return NextResponse.json({ error: "recordType and recordId are required" }, { status: 400 });
  }
  if (!VALID_TYPES.includes(recordType as RecordType)) {
    return NextResponse.json(
      { error: `Invalid recordType. Must be one of: ${VALID_TYPES.join(", ")}` },
      { status: 400 }
    );
  }

  const [app, company] = await Promise.all([
    getSage300CreAppCredentials(session.company_id),
    getSage300CreCompanyCredentials(session.company_id),
  ]);

  if (!isSage300CreConnected(app, company)) {
    return NextResponse.json(
      { error: "Sage 300 CRE is not connected. Connect in Settings → Integrations." },
      { status: 422 }
    );
  }

  const supabase = getSupabase();

  // ── commitments ─────────────────────────────────────────────────────────────
  if (recordType === "commitments") {
    const { data: commitment, error: fetchErr } = await supabase
      .from("commitments")
      .select("id, type, number, title, contract_company, original_contract_amount, status, project_id, sage300cre_id, start_date, estimated_completion, contract_date, issued_on_date, delivery_date")
      .eq("id", recordId)
      .is("deleted_at", null)
      .single();

    const failure = fetchFailure("commitment", fetchErr, commitment);
    if (failure) return failure;

    const { data: sovRows } = await supabase
      .from("commitment_sov_items")
      .select("budget_code, description, amount, qty, uom, unit_cost, sort_order")
      .eq("commitment_id", recordId)
      .eq("is_group_header", false)
      .order("sort_order", { ascending: true });
    const sovLines = (sovRows ?? []).map((r) => ({
      budgetCode: r.budget_code ?? "",
      description: r.description || commitment.title,
      amount: Number(r.amount),
      qty: Number(r.qty) || undefined,
      uom: r.uom || undefined,
      unitCost: Number(r.unit_cost) || undefined,
    }));

    await supabase.from("commitments").update({ erp_status: "pending" }).eq("id", recordId);

    const result = await syncCommitmentToSage300Cre(
      app, company, { ...commitment, sovLines }, commitment.sage300cre_id
    );

    const update: Record<string, unknown> = { erp_status: result.ok ? "synced" : "not_synced" };
    if (result.ok) {
      update.sage300cre_id = result.id;
      update.sage300cre_synced_at = new Date().toISOString();
    }

    await Promise.all([
      supabase.from("commitments").update(update).eq("id", recordId),
      writeLog(supabase, "commitments", recordId, result),
    ]);

    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 });
    return NextResponse.json({ ok: true, sage300creId: result.id, erp_status: "synced" });
  }

  // ── prime_contracts ─────────────────────────────────────────────────────────
  if (recordType === "prime_contracts") {
    const { data: contract, error: fetchErr } = await supabase
      .from("prime_contracts")
      .select("id, contract_number, title, owner_client, contractor, architect_engineer, description, original_contract_amount, approved_change_orders, default_retainage, status, executed, start_date, estimated_completion_date, sage300cre_id")
      .eq("id", recordId)
      .single();

    const failure = fetchFailure("prime contract", fetchErr, contract);
    if (failure) return failure;

    const { data: psovRows } = await supabase
      .from("prime_contract_sov_items")
      .select("budget_code, description, scheduled_value, qty, uom, unit_cost, sort_order")
      .eq("prime_contract_id", recordId)
      .eq("is_group_header", false)
      .order("sort_order", { ascending: true });
    const sovLines = (psovRows ?? []).map((r) => ({
      budgetCode: r.budget_code ?? "",
      description: r.description || contract.title,
      amount: Number(r.scheduled_value),
      qty: Number(r.qty) || undefined,
      uom: r.uom || undefined,
      unitCost: Number(r.unit_cost) || undefined,
    }));

    await supabase.from("prime_contracts").update({ erp_status: "pending" }).eq("id", recordId);

    const result = await syncPrimeContractToSage300Cre(
      app, company, { ...contract, sovLines }, contract.sage300cre_id
    );

    const update: Record<string, unknown> = { erp_status: result.ok ? "synced" : "not_synced" };
    if (result.ok) {
      update.sage300cre_id = result.id;
      update.sage300cre_synced_at = new Date().toISOString();
    }

    await Promise.all([
      supabase.from("prime_contracts").update(update).eq("id", recordId),
      writeLog(supabase, "prime_contracts", recordId, result),
    ]);

    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 });
    return NextResponse.json({ ok: true, sage300creId: result.id, erp_status: "synced" });
  }

  // ── ap_invoice ───────────────────────────────────────────────────────────────
  if (recordType === "ap_invoice") {
    const { data: commitment, error: fetchErr } = await supabase
      .from("commitments")
      .select("id, number, title, contract_company, sage300cre_ap_invoice_id")
      .eq("id", recordId)
      .is("deleted_at", null)
      .single();

    const failure = fetchFailure("commitment", fetchErr, commitment);
    if (failure) return failure;

    const { data: sovItems } = await supabase
      .from("commitment_sov_items")
      .select("budget_code, description, billed_to_date")
      .eq("commitment_id", recordId)
      .eq("is_group_header", false)
      .gt("billed_to_date", 0)
      .order("sort_order", { ascending: true });

    if (!sovItems || sovItems.length === 0) {
      return NextResponse.json(
        { error: "No billed amounts found on this commitment's SOV. Enter billed-to-date amounts before syncing." },
        { status: 422 }
      );
    }

    const result = await syncAPInvoiceToSage300Cre(
      app, company,
      {
        commitmentId: commitment.id,
        commitmentNumber: commitment.number,
        vendorName: commitment.contract_company,
        description: commitment.title,
        lineItems: sovItems.map((item) => ({
          budgetCode: item.budget_code ?? "",
          description: item.description || commitment.title,
          amount: Number(item.billed_to_date),
        })),
      },
      commitment.sage300cre_ap_invoice_id
    );

    if (result.ok) {
      await supabase
        .from("commitments")
        .update({
          sage300cre_ap_invoice_id: result.id,
          sage300cre_ap_invoice_synced_at: new Date().toISOString(),
        })
        .eq("id", recordId);
    }

    await writeLog(supabase, "ap_invoice", recordId, result);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 });
    return NextResponse.json({ ok: true, sage300creId: result.id });
  }

  // ── ar_invoice ───────────────────────────────────────────────────────────────
  if (recordType === "ar_invoice") {
    const { data: contract, error: fetchErr } = await supabase
      .from("prime_contracts")
      .select("id, contract_number, title, owner_client, sage300cre_ar_invoice_id")
      .eq("id", recordId)
      .is("deleted_at", null)
      .single();

    const failure = fetchFailure("prime contract", fetchErr, contract);
    if (failure) return failure;

    const { data: sovItems } = await supabase
      .from("prime_contract_sov_items")
      .select("budget_code, description, work_completed_this_period")
      .eq("prime_contract_id", recordId)
      .eq("is_group_header", false)
      .gt("work_completed_this_period", 0)
      .order("sort_order", { ascending: true });

    if (!sovItems || sovItems.length === 0) {
      return NextResponse.json(
        { error: "No 'work completed this period' amounts found on this contract's SOV. Fill in the current-period billing before syncing." },
        { status: 422 }
      );
    }

    const result = await syncARInvoiceToSage300Cre(
      app, company,
      {
        contractId: contract.id,
        contractNumber: contract.contract_number,
        customerName: contract.owner_client,
        description: contract.title,
        lineItems: sovItems.map((item) => ({
          budgetCode: item.budget_code ?? "",
          description: item.description || contract.title,
          amount: Number(item.work_completed_this_period),
        })),
      },
      contract.sage300cre_ar_invoice_id
    );

    if (result.ok) {
      await supabase
        .from("prime_contracts")
        .update({
          sage300cre_ar_invoice_id: result.id,
          sage300cre_ar_invoice_synced_at: new Date().toISOString(),
        })
        .eq("id", recordId);
    }

    await writeLog(supabase, "ar_invoice", recordId, result);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 });
    return NextResponse.json({ ok: true, sage300creId: result.id });
  }

  return NextResponse.json({ error: "Unhandled recordType" }, { status: 500 });
}
