/**
 * POST /api/integrations/quickbooks/disconnect
 *
 * Disconnects the company's QuickBooks Online connection: best-effort revokes
 * the OAuth grant with Intuit, then deletes the stored realm + tokens from
 * company_integrations. App credentials (Client ID/Secret) and the environment
 * setting are kept so the company can reconnect without re-entering them.
 *
 * Use cases: switching between sandbox and production companies, rotating a
 * compromised grant, or pointing at a different QBO company file.
 *
 * Auth: company super_admin or site_admin.
 */

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";
import {
  getQBOAppCredentials,
  getQBOCompanyCredentials,
  revokeQBOToken,
} from "@/lib/quickbooks";

const CONNECTION_KEYS = ["QBO_REALM_ID", "QBO_ACCESS_TOKEN", "QBO_REFRESH_TOKEN"];

export async function POST() {
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

  // Revoking the refresh token invalidates the whole grant on Intuit's side.
  // Best-effort: a failure here (already revoked, network) shouldn't block
  // clearing our local connection state.
  let revoked = false;
  if (companyCreds.refreshToken) {
    revoked = await revokeQBOToken(appCreds, companyCreds.refreshToken);
  }

  const supabase = getSupabase();
  const { error } = await supabase
    .from("company_integrations")
    .delete()
    .eq("company_id", session.company_id)
    .in("key", CONNECTION_KEYS);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, revoked });
}
