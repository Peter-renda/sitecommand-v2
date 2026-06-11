/**
 * POST /api/integrations/quickbooks/refresh
 *
 * Pulls current accounting status FROM QuickBooks Online for a record that was
 * previously synced: document totals, open balance, and a derived payment
 * status (paid / partially_paid / unpaid). This is the read-back half of the
 * integration — payments applied inside QBO become visible in SiteCommand
 * without re-pushing anything.
 *
 * Body: { recordType: "commitments" | "prime_contracts", recordId: string }
 * Auth: any authenticated company member (the company must have connected QBO).
 *
 * Refreshes, when the corresponding qbo id exists:
 *   commitments     – the header Bill (subcontract) / PurchaseOrder, and the
 *                     AP Bill created from SOV billed-to-date amounts
 *   prime_contracts – the header AR Invoice, and the AR Invoice created from
 *                     SOV this-period amounts
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";
import {
  getQBOAppCredentials,
  getQBOCompanyCredentials,
  isQBOConfigured,
  fetchQBOEntityFinancials,
  type QBOEntityFinancials,
} from "@/lib/quickbooks";

function paymentStatusOf(fin: QBOEntityFinancials): string | null {
  return fin.paymentStatus ?? fin.docStatus?.toLowerCase() ?? null;
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
  if (recordType !== "commitments" && recordType !== "prime_contracts") {
    return NextResponse.json({ error: "Invalid recordType. Must be commitments or prime_contracts" }, { status: 400 });
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
  const now = new Date().toISOString();

  if (recordType === "commitments") {
    const { data: commitment } = await supabase
      .from("commitments")
      .select("id, type, qbo_id, qbo_ap_invoice_id")
      .eq("id", recordId)
      .is("deleted_at", null)
      .single();
    if (!commitment) return NextResponse.json({ error: "Commitment not found" }, { status: 404 });
    if (!commitment.qbo_id && !commitment.qbo_ap_invoice_id) {
      return NextResponse.json({ error: "This commitment has not been synced to QuickBooks yet." }, { status: 422 });
    }

    const headerEntity = commitment.type === "subcontract" ? "bill" : "purchaseorder";
    const [header, apInvoice] = await Promise.all([
      commitment.qbo_id
        ? fetchQBOEntityFinancials(session.company_id, appCreds, companyCreds, headerEntity, commitment.qbo_id)
        : null,
      commitment.qbo_ap_invoice_id
        ? fetchQBOEntityFinancials(session.company_id, appCreds, companyCreds, "bill", commitment.qbo_ap_invoice_id)
        : null,
    ]);

    const update: Record<string, unknown> = { qbo_payments_refreshed_at: now };
    if (header) {
      update.qbo_total_amount = header.totalAmount;
      update.qbo_balance = header.balance;
      update.qbo_payment_status = paymentStatusOf(header);
    }
    if (apInvoice) {
      update.qbo_ap_invoice_total_amount = apInvoice.totalAmount;
      update.qbo_ap_invoice_balance = apInvoice.balance;
      update.qbo_ap_invoice_payment_status = paymentStatusOf(apInvoice);
    }
    await supabase.from("commitments").update(update).eq("id", recordId);
    return NextResponse.json({ ok: true, refreshedAt: now, header, apInvoice });
  }

  const { data: contract } = await supabase
    .from("prime_contracts")
    .select("id, qbo_id, qbo_ar_invoice_id")
    .eq("id", recordId)
    .is("deleted_at", null)
    .single();
  if (!contract) return NextResponse.json({ error: "Prime contract not found" }, { status: 404 });
  if (!contract.qbo_id && !contract.qbo_ar_invoice_id) {
    return NextResponse.json({ error: "This prime contract has not been synced to QuickBooks yet." }, { status: 422 });
  }

  const [header, arInvoice] = await Promise.all([
    contract.qbo_id
      ? fetchQBOEntityFinancials(session.company_id, appCreds, companyCreds, "invoice", contract.qbo_id)
      : null,
    contract.qbo_ar_invoice_id
      ? fetchQBOEntityFinancials(session.company_id, appCreds, companyCreds, "invoice", contract.qbo_ar_invoice_id)
      : null,
  ]);

  const update: Record<string, unknown> = { qbo_payments_refreshed_at: now };
  if (header) {
    update.qbo_total_amount = header.totalAmount;
    update.qbo_balance = header.balance;
    update.qbo_payment_status = paymentStatusOf(header);
  }
  if (arInvoice) {
    update.qbo_ar_invoice_total_amount = arInvoice.totalAmount;
    update.qbo_ar_invoice_balance = arInvoice.balance;
    update.qbo_ar_invoice_payment_status = paymentStatusOf(arInvoice);
  }
  await supabase.from("prime_contracts").update(update).eq("id", recordId);
  return NextResponse.json({ ok: true, refreshedAt: now, header, arInvoice });
}
