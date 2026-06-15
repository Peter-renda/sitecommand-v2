/**
 * GET /api/integrations/quickbooks/accounts
 *
 * Lists active expense / COGS / other-expense accounts from the company's
 * connected QBO realm. Backs the QBO Account picker in the Budget Code Map
 * editor on Settings → Integrations so users select a real account name (which
 * must match QBO exactly) rather than typing it.
 *
 * Auth: company super_admin or site_admin (matches the rest of the QBO setup).
 */

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  getQBOAppCredentials,
  getQBOCompanyCredentials,
  isQBOConfigured,
  fetchQBOAccounts,
} from "@/lib/quickbooks";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.company_role !== "super_admin" && session.role !== "site_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!session.company_id) {
    return NextResponse.json({ error: "No company associated with this account" }, { status: 422 });
  }

  const [appCreds, companyCreds] = await Promise.all([
    getQBOAppCredentials(session.company_id),
    getQBOCompanyCredentials(session.company_id),
  ]);

  if (!isQBOConfigured(companyCreds)) {
    return NextResponse.json(
      { error: "QuickBooks Online is not connected. Connect first, then load accounts." },
      { status: 422 }
    );
  }

  const result = await fetchQBOAccounts(session.company_id, appCreds, companyCreds);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }
  return NextResponse.json({ accounts: result.accounts });
}
