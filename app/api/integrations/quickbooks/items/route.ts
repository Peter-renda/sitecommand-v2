/**
 * GET /api/integrations/quickbooks/items
 *
 * Lists active Products & Services from the connected QBO realm. Backs the
 * QBO Item picker in the Budget Code Map editor — Items-based mapping is the
 * GC-standard QBO pattern (one Item per budget code, e.g. "02-310.C").
 *
 * Auth: company super_admin or site_admin.
 */

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  getQBOAppCredentials,
  getQBOCompanyCredentials,
  isQBOConfigured,
  fetchQBOItems,
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
      { error: "QuickBooks Online is not connected. Connect first, then load items." },
      { status: 422 }
    );
  }

  const result = await fetchQBOItems(session.company_id, appCreds, companyCreds);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }
  return NextResponse.json({ items: result.items });
}
