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
  type Sage300CreResult,
} from "@/lib/sage300cre";

const MAX_COMMITMENTS_PER_COMPANY = 25;
const MAX_PRIME_CONTRACTS_PER_COMPANY = 25;
const MAX_AP_INVOICES_PER_COMPANY = 25;
const MAX_AR_INVOICES_PER_COMPANY = 25;

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
      .select("id")
      .eq("company_id", companyId);

    const projectIds = (projects ?? []).map((p: { id: string }) => p.id);
    if (projectIds.length === 0) continue;

    // ── 3. Dirty commitments ─────────────────────────────────────────────────
    const { data: commitmentCandidates } = await supabase
      .from("commitments")
      .select("id, type, number, title, contract_company, original_contract_amount, status, project_id, sage300cre_id, sage300cre_synced_at, updated_at, start_date, estimated_completion, contract_date, issued_on_date, delivery_date, sage300cre_ap_invoice_id, sage300cre_ap_invoice_synced_at")
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
      const result = await syncCommitmentToSage300Cre(
        app, company, { ...commitment, sovLines }, commitment.sage300cre_id
      );

      const update: Record<string, unknown> = { erp_status: result.ok ? "synced" : "not_synced" };
      if (result.ok) {
        update.sage300cre_id = result.id;
        update.sage300cre_synced_at = new Date().toISOString();
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
      .select("id, contract_number, title, owner_client, contractor, architect_engineer, description, original_contract_amount, approved_change_orders, default_retainage, status, executed, start_date, estimated_completion_date, sage300cre_id, sage300cre_synced_at, updated_at, sage300cre_ar_invoice_id, sage300cre_ar_invoice_synced_at")
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
      const result = await syncPrimeContractToSage300Cre(
        app, company, { ...contract, sovLines }, contract.sage300cre_id
      );

      const update: Record<string, unknown> = { erp_status: result.ok ? "synced" : "not_synced" };
      if (result.ok) {
        update.sage300cre_id = result.id;
        update.sage300cre_synced_at = new Date().toISOString();
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
          existingApId
        );

        if (result.ok) {
          await supabase
            .from("commitments")
            .update({
              sage300cre_ap_invoice_id: result.id,
              sage300cre_ap_invoice_synced_at: new Date().toISOString(),
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
          .select("budget_code, description, work_completed_this_period, updated_at")
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
          existingArId
        );

        if (result.ok) {
          await supabase
            .from("prime_contracts")
            .update({
              sage300cre_ar_invoice_id: result.id,
              sage300cre_ar_invoice_synced_at: new Date().toISOString(),
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
  }

  return NextResponse.json({
    message: "Sage 300 CRE sync cron completed",
    ranAt: new Date().toISOString(),
    ...summary,
    errors: summary.errors.length > 0 ? summary.errors.slice(0, 50) : undefined,
  });
}
