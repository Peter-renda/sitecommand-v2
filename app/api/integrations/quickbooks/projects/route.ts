/**
 * GET /api/integrations/quickbooks/projects
 *
 * Lists active QBO Projects + Customers (with Customer:Job sub-customers) for
 * the per-project picker on Project Admin → ERP Integration. Each option is
 * tagged with its kind (`project` | `subcustomer` | `customer`) so the UI can
 * badge them, and Projects sort first as the recommended GC choice.
 *
 * Auth: company super_admin or site_admin (the same gate that edits project
 * admin fields).
 */

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  getQBOAppCredentials,
  getQBOCompanyCredentials,
  isQBOConfigured,
  fetchQBOProjectsAndCustomers,
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
      { error: "QuickBooks Online is not connected. Connect first, then load projects." },
      { status: 422 }
    );
  }

  const result = await fetchQBOProjectsAndCustomers(session.company_id, appCreds, companyCreds);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 });
  return NextResponse.json({ options: result.options });
}
