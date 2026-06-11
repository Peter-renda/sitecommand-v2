/**
 * GET /api/cron/quickbooks-sync
 *
 * Background sync job. Iterates over every company that has connected
 * QuickBooks Online and pushes any "dirty" records (rows whose updated_at is
 * newer than last_synced_at, or that have never been synced) to QBO.
 *
 * Idempotency is provided by the underlying sync functions in lib/quickbooks.ts:
 * each pass either creates a new QBO record or updates the existing one in
 * place using the stored qbo_id.
 *
 * Auth: Bearer token matching CRON_SECRET (set automatically by Vercel Cron
 * when the env var is configured).
 *
 * Schedule: once daily at 17:00 UTC (configured in vercel.json).
 *
 * Hard caps per run keep the function under Vercel's serverless timeout and
 * well below QBO's 500-req/min/realm rate limit.
 */

import { NextRequest, NextResponse } from "next/server";
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
  fetchQBOEntityFinancials,
  type QBOEntityFinancials,
  type QBOResult,
} from "@/lib/quickbooks";

// Per-run safety caps. Tuned conservatively — if a backlog builds up,
// successive daily runs will work it down. QBO's published limit is ~500 req/min
// per realm; we stay well under that even if every record needs a GET+POST pair.
const MAX_COMMITMENTS_PER_COMPANY    = 25;
const MAX_PRIME_CONTRACTS_PER_COMPANY = 25;
const MAX_AP_INVOICES_PER_COMPANY     = 25;
const MAX_AR_INVOICES_PER_COMPANY     = 25;
const MAX_PAYMENT_REFRESHES_PER_COMPANY = 25;

/** Maps QBO financial feedback onto update columns with the given prefix. */
function financialsColumns(
  prefix: "qbo" | "qbo_ap_invoice" | "qbo_ar_invoice",
  fin?: QBOEntityFinancials | null
): Record<string, unknown> {
  if (!fin) return {};
  return {
    [`${prefix}_total_amount`]: fin.totalAmount,
    [`${prefix}_balance`]: fin.balance,
    [`${prefix}_payment_status`]: fin.paymentStatus ?? fin.docStatus?.toLowerCase() ?? null,
    qbo_payments_refreshed_at: new Date().toISOString(),
  };
}

type SupabaseClient = ReturnType<typeof getSupabase>;

async function writeLog(
  supabase: SupabaseClient,
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

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabase();

  // ── 1. Find every company that has connected QBO ───────────────────────────
  const { data: realmRows, error: realmErr } = await supabase
    .from("company_integrations")
    .select("company_id")
    .eq("key", "QBO_REALM_ID");

  if (realmErr) {
    return NextResponse.json({ error: realmErr.message }, { status: 500 });
  }

  const companyIds = Array.from(
    new Set((realmRows ?? []).map((r: { company_id: string }) => r.company_id))
  );

  const summary = {
    companiesProcessed: 0,
    commitmentsSynced: 0,
    primeContractsSynced: 0,
    apInvoicesSynced: 0,
    arInvoicesSynced: 0,
    paymentsRefreshed: 0,
    failures: 0,
    errors: [] as string[],
  };

  for (const companyId of companyIds) {
    const [appCreds, companyCreds] = await Promise.all([
      getQBOAppCredentials(companyId),
      getQBOCompanyCredentials(companyId),
    ]);

    if (!isQBOConfigured(companyCreds)) continue;
    summary.companiesProcessed++;

    // ── 2. Find this company's projects ──────────────────────────────────────
    const { data: projects } = await supabase
      .from("projects")
      .select("id, name, project_number")
      .eq("company_id", companyId);

    const projectIds = (projects ?? []).map((p: { id: string }) => p.id);
    if (projectIds.length === 0) continue;
    const projectById = new Map(
      (projects ?? []).map((p: { id: string; name: string | null; project_number: string | null }) => [
        p.id, { name: p.name ?? null, number: p.project_number ?? null },
      ])
    );
    const projectCtx = (projectId: string) => projectById.get(projectId) ?? { name: null, number: null };

    // ── 3. Dirty commitments ─────────────────────────────────────────────────
    // "Dirty" = never synced (last_synced_at IS NULL) OR updated since last sync.
    // Postgrest can't express "col > col" in a filter, so we fetch a candidate
    // set and apply the comparison in JS. Hard cap keeps the candidate set small.
    const { data: commitmentCandidates } = await supabase
      .from("commitments")
      .select("id, type, number, title, contract_company, original_contract_amount, approved_change_orders, status, project_id, qbo_id, last_synced_at, updated_at, start_date, estimated_completion, contract_date, issued_on_date, delivery_date, payment_terms, ship_to, ship_via, bill_to, default_retainage, qbo_ap_invoice_id, qbo_ap_invoice_synced_at")
      .in("project_id", projectIds)
      .is("deleted_at", null)
      .order("updated_at", { ascending: true })
      .limit(MAX_COMMITMENTS_PER_COMPANY * 4);

    const dirtyCommitments = (commitmentCandidates ?? [])
      .filter((c) => !c.last_synced_at || new Date(c.updated_at) > new Date(c.last_synced_at))
      .slice(0, MAX_COMMITMENTS_PER_COMPANY);

    for (const commitment of dirtyCommitments) {
      const { data: sovRows } = await supabase
        .from("commitment_sov_items")
        .select("budget_code, description, amount, qty, uom, unit_cost")
        .eq("commitment_id", commitment.id)
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
      const project = projectCtx(commitment.project_id);
      const vendorDetails = await lookupDirectoryPartyDetails(commitment.project_id, commitment.contract_company);
      const result = await syncCommitmentToQBO(
        companyId, appCreds, companyCreds,
        { ...commitment, sovLines, project_name: project.name, project_number: project.number, vendorDetails },
        commitment.qbo_id
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
          if (result.vendorId) update.qbo_vendor_id = result.vendorId;
          Object.assign(update, financialsColumns("qbo", result.financials));
        }
        summary.commitmentsSynced++;
      } else {
        summary.failures++;
        summary.errors.push(`commitment ${commitment.id}: ${result.error}`);
      }

      await Promise.all([
        supabase.from("commitments").update(update).eq("id", commitment.id),
        writeLog(supabase, "commitments", commitment.id, result),
      ]);
    }

    // ── 4. Dirty prime contracts ─────────────────────────────────────────────
    const { data: contractCandidates } = await supabase
      .from("prime_contracts")
      .select("id, project_id, contract_number, title, owner_client, contractor, architect_engineer, description, original_contract_amount, approved_change_orders, default_retainage, status, executed, start_date, estimated_completion_date, qbo_id, qbo_ar_invoice_id, qbo_ar_invoice_synced_at, last_synced_at, updated_at")
      .in("project_id", projectIds)
      .is("deleted_at", null)
      .order("updated_at", { ascending: true })
      .limit(MAX_PRIME_CONTRACTS_PER_COMPANY * 4);

    const dirtyContracts = (contractCandidates ?? [])
      .filter((c) => !c.last_synced_at || new Date(c.updated_at) > new Date(c.last_synced_at))
      .slice(0, MAX_PRIME_CONTRACTS_PER_COMPANY);

    for (const contract of dirtyContracts) {
      const { data: psovRows } = await supabase
        .from("prime_contract_sov_items")
        .select("budget_code, description, scheduled_value, qty, uom, unit_cost")
        .eq("prime_contract_id", contract.id)
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
      const project = projectCtx(contract.project_id);
      const customerDetails = await lookupDirectoryPartyDetails(contract.project_id, contract.owner_client);
      const result = await syncPrimeContractToQBO(
        companyId, appCreds, companyCreds,
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
        summary.primeContractsSynced++;
      } else {
        summary.failures++;
        summary.errors.push(`prime_contract ${contract.id}: ${result.error}`);
      }

      await Promise.all([
        supabase.from("prime_contracts").update(update).eq("id", contract.id),
        writeLog(supabase, "prime_contracts", contract.id, result),
      ]);
    }

    // ── 5. AP invoices: commitments whose SOV billing changed since last push ─
    // We compare MAX(commitment_sov_items.updated_at) against
    // commitments.qbo_ap_invoice_synced_at. Done per-commitment to keep SQL simple.
    const apCandidateIds = (commitmentCandidates ?? []).map((c) => c.id);
    if (apCandidateIds.length > 0) {
      let apProcessed = 0;
      for (const commitmentId of apCandidateIds) {
        if (apProcessed >= MAX_AP_INVOICES_PER_COMPANY) break;

        const commitment = (commitmentCandidates ?? []).find((c) => c.id === commitmentId);
        if (!commitment) continue;

        const { data: sovItems } = await supabase
          .from("commitment_sov_items")
          .select("budget_code, description, billed_to_date, updated_at")
          .eq("commitment_id", commitmentId)
          .eq("is_group_header", false)
          .gt("billed_to_date", 0)
          .order("sort_order", { ascending: true });

        if (!sovItems || sovItems.length === 0) continue;

        // Skip if AP invoice was synced after the most recent SOV change
        const lastSyncedAt = (commitment as { qbo_ap_invoice_synced_at?: string }).qbo_ap_invoice_synced_at;
        if (lastSyncedAt) {
          const maxSovUpdate = sovItems
            .map((s) => new Date(s.updated_at).getTime())
            .reduce((a, b) => Math.max(a, b), 0);
          if (maxSovUpdate <= new Date(lastSyncedAt).getTime()) continue;
        }

        const existingApId = (commitment as { qbo_ap_invoice_id?: string }).qbo_ap_invoice_id;
        const apProject = projectCtx(commitment.project_id);
        const result = await syncAPInvoiceToQBO(
          companyId, appCreds, companyCreds,
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
            retainagePct: Number((commitment as { default_retainage?: number }).default_retainage) || 0,
            projectName: apProject.name,
            projectNumber: apProject.number,
            vendorDetails: await lookupDirectoryPartyDetails(commitment.project_id, commitment.contract_company),
          },
          existingApId
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
            .eq("id", commitmentId);
          summary.apInvoicesSynced++;
        } else {
          summary.failures++;
          summary.errors.push(`ap_invoice ${commitmentId}: ${result.error}`);
        }

        await writeLog(supabase, "ap_invoice", commitmentId, result);
        apProcessed++;
      }
    }

    // ── 6. AR invoices: prime contracts whose SOV current-period changed ─────
    const arCandidateIds = (contractCandidates ?? []).map((c) => c.id);
    if (arCandidateIds.length > 0) {
      let arProcessed = 0;
      for (const contractId of arCandidateIds) {
        if (arProcessed >= MAX_AR_INVOICES_PER_COMPANY) break;

        const contract = (contractCandidates ?? []).find((c) => c.id === contractId);
        if (!contract) continue;

        const { data: sovItems } = await supabase
          .from("prime_contract_sov_items")
          .select("budget_code, description, work_completed_this_period, materials_stored, retainage_pct, updated_at")
          .eq("prime_contract_id", contractId)
          .eq("is_group_header", false)
          .gt("work_completed_this_period", 0)
          .order("sort_order", { ascending: true });

        if (!sovItems || sovItems.length === 0) continue;

        const lastSyncedAt = (contract as { qbo_ar_invoice_synced_at?: string }).qbo_ar_invoice_synced_at;
        if (lastSyncedAt) {
          const maxSovUpdate = sovItems
            .map((s) => new Date(s.updated_at).getTime())
            .reduce((a, b) => Math.max(a, b), 0);
          if (maxSovUpdate <= new Date(lastSyncedAt).getTime()) continue;
        }

        const existingArId = (contract as { qbo_ar_invoice_id?: string }).qbo_ar_invoice_id;
        const arProject = projectCtx(contract.project_id);
        const result = await syncARInvoiceToQBO(
          companyId, appCreds, companyCreds,
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
            projectName: arProject.name,
            projectNumber: arProject.number,
            customerDetails: await lookupDirectoryPartyDetails(contract.project_id, contract.owner_client),
          },
          existingArId
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
            .eq("id", contractId);
          summary.arInvoicesSynced++;
        } else {
          summary.failures++;
          summary.errors.push(`ar_invoice ${contractId}: ${result.error}`);
        }

        await writeLog(supabase, "ar_invoice", contractId, result);
        arProcessed++;
      }
    }

    // ── 7. Payment-status refresh: pull balances back for synced records ──────
    // Payments applied entirely inside QBO never touch updated_at here, so the
    // dirty filters above won't see them. Walk the stalest synced records
    // (oldest qbo_payments_refreshed_at first) and re-read their financials.
    const { data: payCommitments } = await supabase
      .from("commitments")
      .select("id, type, qbo_id, qbo_ap_invoice_id")
      .in("project_id", projectIds)
      .is("deleted_at", null)
      .or("qbo_id.not.is.null,qbo_ap_invoice_id.not.is.null")
      .order("qbo_payments_refreshed_at", { ascending: true, nullsFirst: true })
      .limit(MAX_PAYMENT_REFRESHES_PER_COMPANY);

    for (const c of payCommitments ?? []) {
      const update: Record<string, unknown> = { qbo_payments_refreshed_at: new Date().toISOString() };
      if (c.qbo_id) {
        const fin = await fetchQBOEntityFinancials(
          companyId, appCreds, companyCreds, c.type === "subcontract" ? "bill" : "purchaseorder", c.qbo_id
        );
        Object.assign(update, financialsColumns("qbo", fin));
      }
      if (c.qbo_ap_invoice_id) {
        const fin = await fetchQBOEntityFinancials(companyId, appCreds, companyCreds, "bill", c.qbo_ap_invoice_id);
        Object.assign(update, financialsColumns("qbo_ap_invoice", fin));
      }
      await supabase.from("commitments").update(update).eq("id", c.id);
      summary.paymentsRefreshed++;
    }

    const { data: payContracts } = await supabase
      .from("prime_contracts")
      .select("id, qbo_id, qbo_ar_invoice_id")
      .in("project_id", projectIds)
      .is("deleted_at", null)
      .or("qbo_id.not.is.null,qbo_ar_invoice_id.not.is.null")
      .order("qbo_payments_refreshed_at", { ascending: true, nullsFirst: true })
      .limit(MAX_PAYMENT_REFRESHES_PER_COMPANY);

    for (const pc of payContracts ?? []) {
      const update: Record<string, unknown> = { qbo_payments_refreshed_at: new Date().toISOString() };
      if (pc.qbo_id) {
        const fin = await fetchQBOEntityFinancials(companyId, appCreds, companyCreds, "invoice", pc.qbo_id);
        Object.assign(update, financialsColumns("qbo", fin));
      }
      if (pc.qbo_ar_invoice_id) {
        const fin = await fetchQBOEntityFinancials(companyId, appCreds, companyCreds, "invoice", pc.qbo_ar_invoice_id);
        Object.assign(update, financialsColumns("qbo_ar_invoice", fin));
      }
      await supabase.from("prime_contracts").update(update).eq("id", pc.id);
      summary.paymentsRefreshed++;
    }
  }

  return NextResponse.json({
    message: "QuickBooks Online sync cron completed",
    ranAt: new Date().toISOString(),
    ...summary,
    errors: summary.errors.length > 0 ? summary.errors.slice(0, 50) : undefined,
  });
}
