/**
 * POST /api/integrations/sage300cre/disconnect
 *
 * Disconnects the company's Sage 300 CRE connection by deleting the stored Agave
 * Account Token from company_integrations. The Agave app credentials (Client
 * ID/Secret) are kept so the company can reconnect without re-entering them.
 *
 * Use cases: pointing at a different Sage 300 CRE company, rotating a connection,
 * or stopping sync.
 *
 * Auth: company super_admin or site_admin.
 */

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.company_role !== "super_admin" && session.role !== "site_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!session.company_id) {
    return NextResponse.json({ error: "No company associated with this account" }, { status: 422 });
  }

  const supabase = getSupabase();
  const { error } = await supabase
    .from("company_integrations")
    .delete()
    .eq("company_id", session.company_id)
    .eq("key", "SAGE300CRE_ACCOUNT_TOKEN");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
