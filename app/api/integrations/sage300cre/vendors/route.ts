/**
 * GET /api/integrations/sage300cre/vendors
 *
 * Returns the list of vendors from the company's connected Sage 300 CRE account
 * (via Agave). Used to populate vendor pickers so commitment contract_company
 * values match a real Sage 300 CRE vendor (Agave resolves writes by name).
 *
 * Response: { vendors: Array<{ id: string; name: string }> }
 *
 * Auth: any authenticated company member.
 */

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  getSage300CreAppCredentials,
  getSage300CreCompanyCredentials,
  isSage300CreConnected,
  fetchSage300CreVendors,
} from "@/lib/sage300cre";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.company_id) {
    return NextResponse.json({ error: "No company associated with this account" }, { status: 422 });
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

  const result = await fetchSage300CreVendors(app, company);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  return NextResponse.json({ vendors: result.parties });
}
