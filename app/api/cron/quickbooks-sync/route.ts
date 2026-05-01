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
 * Schedule: every 5 minutes (configured in vercel.json).
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
  syncCommitmentToQBO,
  syncPrimeContractToQBO,
  syncAPInvoiceToQBO,
  syncARInvoiceToQBO,
  type QBOResult,
} from "@/lib/quickbooks";

// Per-run safety caps. Tuned conservatively — if a backlog builds up, multiple
// 5-minute runs will work it down. QBO's published limit is ~500 req/min per
// realm; we stay well under that even if every record needs a GET+POST pair.
const MAX_COMMITMENTS_PER_COMPANY    = 25;
const MAX_PRIME_CONTRACTS_PER_COMPANY = 25;
const MAX_AP_INVOICES_PER_COMPANY     = 25;
const MAX_AR_INVOICES_PER_COMPANY     = 25;

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
      .select("id")
      .eq("company_id", companyId);

    const projectIds = (projects ?? []).map((p: { id: string }) => p.id);
    if (projectIds.length === 0) continue;

    // ── 3. Dirty commitments ─────────────────────────────────────────────────
    // "Dirty" = never synced (last_synced_at IS NULL) OR updated since last sync.
    // Postgrest can't express "col > col" in a filter, so we fetch a candidate
    // set and apply the comparison in JS. Hard cap keeps the candidate set small.
    const { data: commitmentCandidates } = await supabase
      .from("commitments")
      .select("id, type, number, title, contract_company, original_contract_amount, status, project_id, qbo_id, last_synced_at, updated_at")
      .in("project_id", projectIds)
      .is("deleted_at", null)
      .order("updated_at", { ascending: true })
      .limit(MAX_COMMITMENTS_PER_COMPANY * 4);

    const dirtyCommitments = (commitmentCandidates ?? [])
      .filter((c) => !c.last_synced_at || new Date(c.updated_at) > new Date(c.last_synced_at))
      .slice(0, MAX_COMMITMENTS_PER_COMPANY);

    for (const commitment of dirtyCommitments) {
      const result = await syncCommitmentToQBO(
        companyId, appCreds, companyCreds, commitment, commitment.qbo_id
      );

      const update: Record<string, unknown> = { erp_status: result.ok ? "synced" : "not_synced" };
      if (result.ok) {
        update.qbo_id = result.id;
        update.qbo_sync_token = result.syncToken ?? null;
        update.last_synced_at = new Date().toISOString();
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
      .select("id, contract_number, title, owner_client, contractor, architect_engineer, description, original_contract_amount, approved_change_orders, default_retainage, status, executed, start_date, estimated_completion_date, qbo_id, last_synced_at, updated_at")
      .in("project_id", projectIds)
      .is("deleted_at", null)
      .order("updated_at", { ascending: true })
      .limit(MAX_PRIME_CONTRACTS_PER_COMPANY * 4);

    const dirtyContracts = (contractCandidates ?? [])
      .filter((c) => !c.last_synced_at || new Date(c.updated_at) > new Date(c.last_synced_at))
      .slice(0, MAX_PRIME_CONTRACTS_PER_COMPANY);

    for (const contract of dirtyContracts) {
      const result = await syncPrimeContractToQBO(
        companyId, appCreds, companyCreds, contract, contract.qbo_id
      );

      const update: Record<string, unknown> = { erp_status: result.ok ? "synced" : "not_synced" };
      if (result.ok) {
        update.qbo_id = result.id;
        update.qbo_sync_token = result.syncToken ?? null;
        update.last_synced_at = new Date().toISOString();
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
          .select("description, billed_to_date, updated_at")
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
        const result = await syncAPInvoiceToQBO(
          companyId, appCreds, companyCreds,
          {
            commitmentId: commitment.id,
            commitmentNumber: commitment.number,
            vendorName: commitment.contract_company,
            description: commitment.title,
            lineItems: sovItems.map((item) => ({
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
              qbo_ap_invoice_id: result.id,
              qbo_ap_invoice_sync_token: result.syncToken ?? null,
              qbo_ap_invoice_synced_at: new Date().toISOString(),
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
          .select("description, work_completed_this_period, updated_at")
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
        const result = await syncARInvoiceToQBO(
          companyId, appCreds, companyCreds,
          {
            contractId: contract.id,
            contractNumber: contract.contract_number,
            customerName: contract.owner_client,
            description: contract.title,
            lineItems: sovItems.map((item) => ({
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
              qbo_ar_invoice_id: result.id,
              qbo_ar_invoice_sync_token: result.syncToken ?? null,
              qbo_ar_invoice_synced_at: new Date().toISOString(),
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
    message: "QuickBooks Online sync cron completed",
    ranAt: new Date().toISOString(),
    ...summary,
    errors: summary.errors.length > 0 ? summary.errors.slice(0, 50) : undefined,
  });
}
