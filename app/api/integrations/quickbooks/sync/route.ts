/**
 * POST /api/integrations/quickbooks/sync
 *
 * Triggers a manual sync of a SiteCommand record to QuickBooks Online.
 *
 * Supported recordType values:
 *   "commitments"     – Create Bill (subcontract) or PurchaseOrder
 *   "prime_contracts" – Create Invoice (AR)
 *   "ap_invoice"      – Push AP Bill from commitment SOV billed amounts
 *   "ar_invoice"      – Push AR Invoice from prime contract SOV this-period amounts
 *
 * On success the record's erp_status is set to 'synced'; on failure it reverts
 * to 'not_synced'. A row is always written to erp_sync_logs with integration='quickbooks'.
 *
 * Body: { recordType: string, recordId: string }
 * Auth: any authenticated company member.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";
import {
  getQBOAppCredentials,
  getQBOCompanyCredentials,
  isQBOConfigured,
  lookupDirectoryPartyDetails,
  syncCommitmentToQBO,
  syncPrimeContractToQBO,
  syncAPInvoiceToQBO,
  syncARInvoiceToQBO,
  type QBOEntityFinancials,
  type QBOResult,
} from "@/lib/quickbooks";

const VALID_TYPES = ["commitments", "prime_contracts", "ap_invoice", "ar_invoice"] as const;
type RecordType = (typeof VALID_TYPES)[number];

/** Project context passed to the sync payloads (class job costing + DocNumber prefix). */
async function getProjectContext(
  supabase: ReturnType<typeof getSupabase>,
  projectId: string
): Promise<{ name: string | null; number: string | null; qboCustomerId: string | null }> {
  const { data } = await supabase
    .from("projects")
    .select("name, project_number, qbo_customer_id")
    .eq("id", projectId)
    .single();
  return { name: data?.name ?? null, number: data?.project_number ?? null, qboCustomerId: data?.qbo_customer_id ?? null };
}

/** Maps QBO financial feedback onto update columns with the given prefix. */
function financialsColumns(
  prefix: "qbo" | "qbo_ap_invoice" | "qbo_ar_invoice",
  fin?: QBOEntityFinancials
): Record<string, unknown> {
  if (!fin) return {};
  return {
    [`${prefix}_total_amount`]: fin.totalAmount,
    [`${prefix}_balance`]: fin.balance,
    [`${prefix}_payment_status`]: fin.paymentStatus ?? fin.docStatus?.toLowerCase() ?? null,
    qbo_payments_refreshed_at: new Date().toISOString(),
  };
}

/**
 * Distinguishes "row genuinely absent" (PGRST116: zero rows for .single()) from
 * a failed query (e.g. a column missing because a migration wasn't applied).
 * Masking DB errors as 404 "not found" makes schema drift undiagnosable.
 */
function fetchFailure(
  label: string,
  fetchErr: { code?: string; message?: string } | null,
  row: unknown
): NextResponse | null {
  if (fetchErr && fetchErr.code !== "PGRST116") {
    return NextResponse.json(
      { error: `Failed to load ${label}: ${fetchErr.message ?? "database error"}. If this mentions a missing column, apply supabase/migrations/113_qbo_idempotency_columns.sql.` },
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
  result: QBOResult
) {
  await supabase.from("erp_sync_logs").insert({
    record_type: recordType,
    record_id: recordId,
    integration: "quickbooks",
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

  const [appCreds, companyCreds] = await Promise.all([
    getQBOAppCredentials(session.company_id),
    getQBOCompanyCredentials(session.company_id),
  ]);

  if (!isQBOConfigured(companyCreds)) {
    return NextResponse.json(
      { error: "QuickBooks Online is not connected. Connect in Settings → Integrations." },
      { status: 422 }
    );
  }

  const supabase = getSupabase();

  // ── commitments ─────────────────────────────────────────────────────────────
  if (recordType === "commitments") {
    const { data: commitment, error: fetchErr } = await supabase
      .from("commitments")
      .select("id, type, number, title, contract_company, original_contract_amount, approved_change_orders, status, project_id, qbo_id, start_date, estimated_completion, contract_date, issued_on_date, delivery_date, payment_terms, ship_to, ship_via, bill_to")
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

    const [project, vendorDetails] = await Promise.all([
      getProjectContext(supabase, commitment.project_id),
      lookupDirectoryPartyDetails(commitment.project_id, commitment.contract_company),
    ]);

    await supabase.from("commitments").update({ erp_status: "pending" }).eq("id", recordId);

    const result = await syncCommitmentToQBO(
      session.company_id, appCreds, companyCreds,
      { ...commitment, sovLines, project_name: project.name, project_number: project.number, qbo_customer_id: project.qboCustomerId, vendorDetails },
      commitment.qbo_id
    );

    const update: Record<string, unknown> = { erp_status: result.ok ? "synced" : "not_synced" };
    if (result.ok) {
      update.last_synced_at = new Date().toISOString();
      if (result.action === "deleted" || result.action === "skipped") {
        // Void/terminated: the QBO doc is gone (or never existed) — clear refs.
        update.qbo_id = null;
        update.qbo_sync_token = null;
        update.erp_status = "not_synced";
        update.qbo_total_amount = null;
        update.qbo_balance = null;
        update.qbo_payment_status = null;
      } else {
        update.qbo_id = result.id;
        update.qbo_sync_token = result.syncToken ?? null;
        if (result.vendorId) update.qbo_vendor_id = result.vendorId;
        Object.assign(update, financialsColumns("qbo", result.financials));
      }
    }

    await Promise.all([
      supabase.from("commitments").update(update).eq("id", recordId),
      writeLog(supabase, "commitments", recordId, result),
    ]);

    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.validation ? 422 : 502 });
    return NextResponse.json({ ok: true, qboId: result.id, erp_status: update.erp_status });
  }

  // ── prime_contracts ─────────────────────────────────────────────────────────
  if (recordType === "prime_contracts") {
    const { data: contract, error: fetchErr } = await supabase
      .from("prime_contracts")
      .select("id, project_id, contract_number, title, owner_client, contractor, architect_engineer, description, original_contract_amount, approved_change_orders, default_retainage, status, executed, start_date, estimated_completion_date, qbo_id")
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

    const [project, customerDetails] = await Promise.all([
      getProjectContext(supabase, contract.project_id),
      lookupDirectoryPartyDetails(contract.project_id, contract.owner_client),
    ]);

    await supabase.from("prime_contracts").update({ erp_status: "pending" }).eq("id", recordId);

    const result = await syncPrimeContractToQBO(
      session.company_id, appCreds, companyCreds,
      { ...contract, sovLines, project_name: project.name, project_number: project.number, customerDetails },
      contract.qbo_id
    );

    const update: Record<string, unknown> = { erp_status: result.ok ? "synced" : "not_synced" };
    if (result.ok) {
      update.last_synced_at = new Date().toISOString();
      if (result.action === "deleted" || result.action === "skipped") {
        update.qbo_id = null;
        update.qbo_sync_token = null;
        update.erp_status = "not_synced";
        update.qbo_total_amount = null;
        update.qbo_balance = null;
        update.qbo_payment_status = null;
      } else {
        update.qbo_id = result.id;
        update.qbo_sync_token = result.syncToken ?? null;
        if (result.customerId) update.qbo_customer_id = result.customerId;
        Object.assign(update, financialsColumns("qbo", result.financials));
      }
    }

    await Promise.all([
      supabase.from("prime_contracts").update(update).eq("id", recordId),
      writeLog(supabase, "prime_contracts", recordId, result),
    ]);

    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.validation ? 422 : 502 });
    return NextResponse.json({ ok: true, qboId: result.id, erp_status: update.erp_status });
  }

  // ── ap_invoice ───────────────────────────────────────────────────────────────
  if (recordType === "ap_invoice") {
    const { data: commitment, error: fetchErr } = await supabase
      .from("commitments")
      .select("id, project_id, number, title, contract_company, qbo_ap_invoice_id, default_retainage")
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

    const [project, vendorDetails] = await Promise.all([
      getProjectContext(supabase, commitment.project_id),
      lookupDirectoryPartyDetails(commitment.project_id, commitment.contract_company),
    ]);

    const result = await syncAPInvoiceToQBO(
      session.company_id, appCreds, companyCreds,
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
        retainagePct: Number(commitment.default_retainage) || 0,
        projectName: project.name,
        projectNumber: project.number,
        qboCustomerId: project.qboCustomerId,
        vendorDetails,
      },
      commitment.qbo_ap_invoice_id
    );

    if (result.ok) {
      await supabase
        .from("commitments")
        .update({
          qbo_ap_invoice_id: result.id,
          qbo_ap_invoice_sync_token: result.syncToken ?? null,
          qbo_ap_invoice_synced_at: new Date().toISOString(),
          ...(result.vendorId ? { qbo_vendor_id: result.vendorId } : {}),
          ...financialsColumns("qbo_ap_invoice", result.financials),
        })
        .eq("id", recordId);
    }

    await writeLog(supabase, "ap_invoice", recordId, result);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.validation ? 422 : 502 });
    return NextResponse.json({ ok: true, qboId: result.id });
  }

  // ── ar_invoice ───────────────────────────────────────────────────────────────
  if (recordType === "ar_invoice") {
    const { data: contract, error: fetchErr } = await supabase
      .from("prime_contracts")
      .select("id, project_id, contract_number, title, owner_client, qbo_ar_invoice_id")
      .eq("id", recordId)
      .is("deleted_at", null)
      .single();

    const failure = fetchFailure("prime contract", fetchErr, contract);
    if (failure) return failure;

    const { data: sovItems } = await supabase
      .from("prime_contract_sov_items")
      .select("budget_code, description, work_completed_this_period, materials_stored, retainage_pct")
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

    const [project, customerDetails] = await Promise.all([
      getProjectContext(supabase, contract.project_id),
      lookupDirectoryPartyDetails(contract.project_id, contract.owner_client),
    ]);

    const result = await syncARInvoiceToQBO(
      session.company_id, appCreds, companyCreds,
      {
        contractId: contract.id,
        contractNumber: contract.contract_number,
        customerName: contract.owner_client,
        description: contract.title,
        lineItems: sovItems.map((item) => {
          const amount = Number(item.work_completed_this_period);
          const pct = Number(item.retainage_pct) || 0;
          return {
            budgetCode: item.budget_code ?? "",
            description: item.description || contract.title,
            amount,
            retainageAmount: pct > 0 ? Number(((amount * pct) / 100).toFixed(2)) : 0,
            materialsStored: Number(item.materials_stored) || 0,
          };
        }),
        projectName: project.name,
        projectNumber: project.number,
        customerDetails,
      },
      contract.qbo_ar_invoice_id
    );

    if (result.ok) {
      await supabase
        .from("prime_contracts")
        .update({
          qbo_ar_invoice_id: result.id,
          qbo_ar_invoice_sync_token: result.syncToken ?? null,
          qbo_ar_invoice_synced_at: new Date().toISOString(),
          ...(result.customerId ? { qbo_customer_id: result.customerId } : {}),
          ...financialsColumns("qbo_ar_invoice", result.financials),
        })
        .eq("id", recordId);
    }

    await writeLog(supabase, "ar_invoice", recordId, result);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.validation ? 422 : 502 });
    return NextResponse.json({ ok: true, qboId: result.id });
  }

  return NextResponse.json({ error: "Unhandled recordType" }, { status: 500 });
}
