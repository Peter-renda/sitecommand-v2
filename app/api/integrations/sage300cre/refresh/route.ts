/**
 * POST /api/integrations/sage300cre/refresh
 *
 * Pulls current accounting status FROM Sage 300 CRE (via Agave) for a record
 * that was previously synced: document totals, amount paid, remaining balance,
 * and the source status string. This is the read-back half of the integration —
 * payments entered in Sage become visible in SiteCommand without re-pushing.
 *
 * Body: { recordType: "commitments" | "prime_contracts", recordId: string }
 * Auth: any authenticated company member (the company must have connected Sage 300 CRE).
 *
 * Refreshes, when the corresponding sage300cre id exists:
 *   commitments     – the header Purchase Order (status only — POs are
 *                     non-posting) and the AP Invoice from SOV billed amounts
 *   prime_contracts – the header AR Invoice and the AR Invoice from SOV
 *                     this-period amounts
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";
import {
  getSage300CreAppCredentials,
  getSage300CreCompanyCredentials,
  isSage300CreConnected,
  fetchSage300CreRecordFinancials,
} from "@/lib/sage300cre";

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
  if (recordType !== "commitments" && recordType !== "prime_contracts") {
    return NextResponse.json({ error: "Invalid recordType. Must be commitments or prime_contracts" }, { status: 400 });
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
  const now = new Date().toISOString();

  if (recordType === "commitments") {
    const { data: commitment } = await supabase
      .from("commitments")
      .select("id, sage300cre_id, sage300cre_ap_invoice_id")
      .eq("id", recordId)
      .is("deleted_at", null)
      .single();
    if (!commitment) return NextResponse.json({ error: "Commitment not found" }, { status: 404 });
    if (!commitment.sage300cre_id && !commitment.sage300cre_ap_invoice_id) {
      return NextResponse.json({ error: "This commitment has not been synced to Sage 300 CRE yet." }, { status: 422 });
    }

    const [header, apInvoice] = await Promise.all([
      commitment.sage300cre_id
        ? fetchSage300CreRecordFinancials(app, company, "purchase-orders", commitment.sage300cre_id)
        : null,
      commitment.sage300cre_ap_invoice_id
        ? fetchSage300CreRecordFinancials(app, company, "ap-invoices", commitment.sage300cre_ap_invoice_id)
        : null,
    ]);

    const update: Record<string, unknown> = { sage300cre_payments_refreshed_at: now };
    if (header) update.sage300cre_status = header.status;
    if (apInvoice) {
      update.sage300cre_ap_invoice_total_amount = apInvoice.totalAmount;
      update.sage300cre_ap_invoice_amount_paid = apInvoice.amountPaid;
      update.sage300cre_ap_invoice_balance = apInvoice.balance;
      update.sage300cre_ap_invoice_status = apInvoice.status;
    }
    await supabase.from("commitments").update(update).eq("id", recordId);
    return NextResponse.json({ ok: true, refreshedAt: now, header, apInvoice });
  }

  const { data: contract } = await supabase
    .from("prime_contracts")
    .select("id, sage300cre_id, sage300cre_ar_invoice_id")
    .eq("id", recordId)
    .is("deleted_at", null)
    .single();
  if (!contract) return NextResponse.json({ error: "Prime contract not found" }, { status: 404 });
  if (!contract.sage300cre_id && !contract.sage300cre_ar_invoice_id) {
    return NextResponse.json({ error: "This prime contract has not been synced to Sage 300 CRE yet." }, { status: 422 });
  }

  const [header, arInvoice] = await Promise.all([
    contract.sage300cre_id
      ? fetchSage300CreRecordFinancials(app, company, "ar-invoices", contract.sage300cre_id)
      : null,
    contract.sage300cre_ar_invoice_id
      ? fetchSage300CreRecordFinancials(app, company, "ar-invoices", contract.sage300cre_ar_invoice_id)
      : null,
  ]);

  const update: Record<string, unknown> = { sage300cre_payments_refreshed_at: now };
  if (header) {
    update.sage300cre_total_amount = header.totalAmount;
    update.sage300cre_amount_paid = header.amountPaid;
    update.sage300cre_balance = header.balance;
    update.sage300cre_status = header.status;
  }
  if (arInvoice) {
    update.sage300cre_ar_invoice_total_amount = arInvoice.totalAmount;
    update.sage300cre_ar_invoice_amount_paid = arInvoice.amountPaid;
    update.sage300cre_ar_invoice_balance = arInvoice.balance;
    update.sage300cre_ar_invoice_status = arInvoice.status;
  }
  await supabase.from("prime_contracts").update(update).eq("id", recordId);
  return NextResponse.json({ ok: true, refreshedAt: now, header, arInvoice });
}
