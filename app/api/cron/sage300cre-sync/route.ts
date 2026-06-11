/**
 * GET /api/cron/sage300cre-sync
 *
 * Background sync job. Iterates over every company that has connected Sage 300
 * CRE (via Agave) and pushes any "dirty" records (rows whose updated_at is newer
 * than sage300cre_synced_at, or that have never been synced) to Sage 300 CRE.
 *
 * Idempotency is provided by the underlying sync functions in lib/sage300cre.ts:
 * each pass either creates a new Agave record or updates the existing one in
 * place using the stored sage300cre_id.
 *
 * Auth: Bearer token matching CRON_SECRET (set automatically by Vercel Cron).
 * Schedule: once daily at 18:00 UTC (configured in vercel.json) — staggered an
 * hour after the QuickBooks sync so the two don't contend.
 *
 * Hard caps per run keep the function under Vercel's serverless timeout.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import {
  getSage300CreAppCredentials,
  getSage300CreCompanyCredentials,
  isSage300CreConnected,
  syncCommitmentToSage300Cre,
  syncPrimeContractToSage300Cre,
  syncAPInvoiceToSage300Cre,
  syncARInvoiceToSage300Cre,
  fetchSage300CreRecordFinancials,
  type Sage300CreFinancials,
  type Sage300CreResult,
} from "@/lib/sage300cre";

const MAX_COMMITMENTS_PER_COMPANY = 25;
const MAX_PRIME_CONTRACTS_PER_COMPANY = 25;
const MAX_AP_INVOICES_PER_COMPANY = 25;
const MAX_AR_INVOICES_PER_COMPANY = 25;
const MAX_PAYMENT_REFRESHES_PER_COMPANY = 25;

/**
 * Maps Agave financial feedback onto update columns with the given prefix.
 * The commitment header PO is non-posting, so only its status column exists
 * (includeAmounts=false); the AP/AR invoices and the prime-contract header
 * invoice also carry total / paid / balance.
 */
function financialsColumns(
  prefix: "sage300cre_ap_invoice" | "sage300cre_ar_invoice" | "sage300cre",
  fin: Sage300CreFinancials | undefined | null,
  includeAmounts: boolean
): Record<string, unknown> {
  if (!fin) return {};
  const cols: Record<string, unknown> = {
    [`${prefix}_status`]: fin.status,
    sage300cre_payments_refreshed_at: new Date().toISOString(),
  };
  if (includeAmounts) {
    cols[`${prefix}_total_amount`] = fin.totalAmount;
    cols[`${prefix}_amount_paid`] = fin.amountPaid;
    cols[`${prefix}_balance`] = fin.balance;
  }
  return cols;
}

type SupabaseClient = ReturnType<typeof getSupabase>;

async function writeLog(
  supabase: SupabaseClient,
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

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabase();

  // ── 1. Find every company that has connected Sage 300 CRE ──────────────────
  const { data: tokenRows, error: tokenErr } = await supabase
    .from("company_integrations")
    .select("company_id")
    .eq("key", "SAGE300CRE_ACCOUNT_TOKEN");

  if (tokenErr) {
    return NextResponse.json({ error: tokenErr.message }, { status: 500 });
  }

  const companyIds = Array.from(
    new Set((tokenRows ?? []).map((r: { company_id: string }) => r.company_id))
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
    const [app, company] = await Promise.all([
      getSage300CreAppCredentials(companyId),
      getSage300CreCompanyCredentials(companyId),
    ]);

    if (!isSage300CreConnected(app, company)) continue;
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
    const { data: commitmentCandidates } = await supabase
      .from("commitments")
      .select("id, type, number, title, contract_company, original_contract_amount, approved_change_orders, default_retainage, status, project_id, sage300cre_id, sage300cre_synced_at, updated_at, start_date, estimated_completion, contract_date, issued_on_date, delivery_date, sage300cre_ap_invoice_id, sage300cre_ap_invoice_synced_at")
      .in("project_id", projectIds)
      .is("deleted_at", null)
      .order("updated_at", { ascending: true })
      .limit(MAX_COMMITMENTS_PER_COMPANY * 4);

    const dirtyCommitments = (commitmentCandidates ?? [])
      .filter((c) => !c.sage300cre_synced_at || new Date(c.updated_at) > new Date(c.sage300cre_synced_at))
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
      const result = await syncCommitmentToSage300Cre(
        app, company,
        { ...commitment, sovLines, project_name: project.name, project_number: project.number },
        commitment.sage300cre_id
      );

      const update: Record<string, unknown> = { erp_status: result.ok ? "synced" : "not_synced" };
      if (result.ok) {
        update.sage300cre_id = result.id;
        update.sage300cre_synced_at = new Date().toISOString();
        if (result.vendorId) update.sage300cre_vendor_id = result.vendorId;
        Object.assign(update, financialsColumns("sage300cre", result.financials, false));
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
      .select("id, project_id, contract_number, title, owner_client, contractor, architect_engineer, description, original_contract_amount, approved_change_orders, default_retainage, status, executed, start_date, estimated_completion_date, sage300cre_id, sage300cre_synced_at, updated_at, sage300cre_ar_invoice_id, sage300cre_ar_invoice_synced_at")
      .in("project_id", projectIds)
      .is("deleted_at", null)
      .order("updated_at", { ascending: true })
      .limit(MAX_PRIME_CONTRACTS_PER_COMPANY * 4);

    const dirtyContracts = (contractCandidates ?? [])
      .filter((c) => !c.sage300cre_synced_at || new Date(c.updated_at) > new Date(c.sage300cre_synced_at))
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
      const result = await syncPrimeContractToSage300Cre(
        app, company,
        { ...contract, sovLines, project_name: project.name, project_number: project.number },
        contract.sage300cre_id
      );

      const update: Record<string, unknown> = { erp_status: result.ok ? "synced" : "not_synced" };
      if (result.ok) {
        update.sage300cre_id = result.id;
        update.sage300cre_synced_at = new Date().toISOString();
        if (result.customerId) update.sage300cre_customer_id = result.customerId;
        Object.assign(update, financialsColumns("sage300cre", result.financials, true));
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

        const lastSyncedAt = (commitment as { sage300cre_ap_invoice_synced_at?: string }).sage300cre_ap_invoice_synced_at;
        if (lastSyncedAt) {
          const maxSovUpdate = sovItems
            .map((s) => new Date(s.updated_at).getTime())
            .reduce((a, b) => Math.max(a, b), 0);
          if (maxSovUpdate <= new Date(lastSyncedAt).getTime()) continue;
        }

        const existingApId = (commitment as { sage300cre_ap_invoice_id?: string }).sage300cre_ap_invoice_id;
        const apProject = projectCtx(commitment.project_id);
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
            retainagePct: Number((commitment as { default_retainage?: number }).default_retainage) || 0,
            projectName: apProject.name,
            projectNumber: apProject.number,
          },
          existingApId
        );

        if (result.ok) {
          await supabase
            .from("commitments")
            .update({
              sage300cre_ap_invoice_id: result.id,
              sage300cre_ap_invoice_synced_at: new Date().toISOString(),
              ...(result.vendorId ? { sage300cre_vendor_id: result.vendorId } : {}),
              ...financialsColumns("sage300cre_ap_invoice", result.financials, true),
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
          .select("budget_code, description, work_completed_this_period, retainage_pct, updated_at")
          .eq("prime_contract_id", contractId)
          .eq("is_group_header", false)
          .gt("work_completed_this_period", 0)
          .order("sort_order", { ascending: true });

        if (!sovItems || sovItems.length === 0) continue;

        const lastSyncedAt = (contract as { sage300cre_ar_invoice_synced_at?: string }).sage300cre_ar_invoice_synced_at;
        if (lastSyncedAt) {
          const maxSovUpdate = sovItems
            .map((s) => new Date(s.updated_at).getTime())
            .reduce((a, b) => Math.max(a, b), 0);
          if (maxSovUpdate <= new Date(lastSyncedAt).getTime()) continue;
        }

        const existingArId = (contract as { sage300cre_ar_invoice_id?: string }).sage300cre_ar_invoice_id;
        const arProject = projectCtx(contract.project_id);
        const result = await syncARInvoiceToSage300Cre(
          app, company,
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
              };
            }),
            projectName: arProject.name,
            projectNumber: arProject.number,
          },
          existingArId
        );

        if (result.ok) {
          await supabase
            .from("prime_contracts")
            .update({
              sage300cre_ar_invoice_id: result.id,
              sage300cre_ar_invoice_synced_at: new Date().toISOString(),
              ...(result.customerId ? { sage300cre_customer_id: result.customerId } : {}),
              ...financialsColumns("sage300cre_ar_invoice", result.financials, true),
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
    // Payments entered entirely inside Sage never touch updated_at here, so the
    // dirty filters above won't see them. Walk the stalest synced records
    // (oldest sage300cre_payments_refreshed_at first) and re-read financials.
    const { data: payCommitments } = await supabase
      .from("commitments")
      .select("id, sage300cre_id, sage300cre_ap_invoice_id")
      .in("project_id", projectIds)
      .is("deleted_at", null)
      .or("sage300cre_id.not.is.null,sage300cre_ap_invoice_id.not.is.null")
      .order("sage300cre_payments_refreshed_at", { ascending: true, nullsFirst: true })
      .limit(MAX_PAYMENT_REFRESHES_PER_COMPANY);

    for (const c of payCommitments ?? []) {
      const update: Record<string, unknown> = { sage300cre_payments_refreshed_at: new Date().toISOString() };
      if (c.sage300cre_id) {
        const fin = await fetchSage300CreRecordFinancials(app, company, "purchase-orders", c.sage300cre_id);
        Object.assign(update, financialsColumns("sage300cre", fin, false));
      }
      if (c.sage300cre_ap_invoice_id) {
        const fin = await fetchSage300CreRecordFinancials(app, company, "ap-invoices", c.sage300cre_ap_invoice_id);
        Object.assign(update, financialsColumns("sage300cre_ap_invoice", fin, true));
      }
      await supabase.from("commitments").update(update).eq("id", c.id);
      summary.paymentsRefreshed++;
    }

    const { data: payContracts } = await supabase
      .from("prime_contracts")
      .select("id, sage300cre_id, sage300cre_ar_invoice_id")
      .in("project_id", projectIds)
      .is("deleted_at", null)
      .or("sage300cre_id.not.is.null,sage300cre_ar_invoice_id.not.is.null")
      .order("sage300cre_payments_refreshed_at", { ascending: true, nullsFirst: true })
      .limit(MAX_PAYMENT_REFRESHES_PER_COMPANY);

    for (const pc of payContracts ?? []) {
      const update: Record<string, unknown> = { sage300cre_payments_refreshed_at: new Date().toISOString() };
      if (pc.sage300cre_id) {
        const fin = await fetchSage300CreRecordFinancials(app, company, "ar-invoices", pc.sage300cre_id);
        Object.assign(update, financialsColumns("sage300cre", fin, true));
      }
      if (pc.sage300cre_ar_invoice_id) {
        const fin = await fetchSage300CreRecordFinancials(app, company, "ar-invoices", pc.sage300cre_ar_invoice_id);
        Object.assign(update, financialsColumns("sage300cre_ar_invoice", fin, true));
      }
      await supabase.from("prime_contracts").update(update).eq("id", pc.id);
      summary.paymentsRefreshed++;
    }
  }

  return NextResponse.json({
    message: "Sage 300 CRE sync cron completed",
    ranAt: new Date().toISOString(),
    ...summary,
    errors: summary.errors.length > 0 ? summary.errors.slice(0, 50) : undefined,
  });
}
