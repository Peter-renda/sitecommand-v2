/**
 * GET /api/integrations/quickbooks/customers
 *
 * Returns the list of active customers from QuickBooks Online so they can be
 * selected when creating a prime contract.
 *
 * Auth: any authenticated company member.
 */

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  getQBOAppCredentials,
  getQBOCompanyCredentials,
  isQBOConfigured,
  fetchQBOCustomers,
} from "@/lib/quickbooks";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.company_id) {
    return NextResponse.json({ error: "No company associated with this account" }, { status: 422 });
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

  const result = await fetchQBOCustomers(session.company_id, appCreds, companyCreds);

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 });
  return NextResponse.json({ customers: result.customers });
}
