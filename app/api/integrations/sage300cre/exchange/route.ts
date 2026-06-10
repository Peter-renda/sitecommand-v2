/**
 * POST /api/integrations/sage300cre/exchange
 *
 * Step 2 of the Agave Link flow: exchanges the public token returned by Agave
 * Link for a durable Account Token, then persists it to company_integrations as
 * SAGE300CRE_ACCOUNT_TOKEN. Once stored, the company is "connected" and the sync
 * surfaces become available.
 *
 * Body: { publicToken: string }
 * Auth: company super_admin or site_admin.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";
import {
  getSage300CreAppCredentials,
  isSage300CreAppConfigured,
  exchangePublicToken,
} from "@/lib/sage300cre";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.company_role !== "super_admin" && session.role !== "site_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!session.company_id) {
    return NextResponse.json({ error: "No company associated with this account" }, { status: 422 });
  }

  const body = await req.json().catch(() => ({}));
  const publicToken = typeof body.publicToken === "string" ? body.publicToken.trim() : "";
  if (!publicToken) {
    return NextResponse.json({ error: "publicToken is required" }, { status: 400 });
  }

  const app = await getSage300CreAppCredentials(session.company_id);
  if (!isSage300CreAppConfigured(app)) {
    return NextResponse.json(
      { error: "Agave app credentials are missing. Save your Client ID and Secret, then reconnect." },
      { status: 422 }
    );
  }

  const result = await exchangePublicToken(app, publicToken);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  const supabase = getSupabase();
  const { error } = await supabase.from("company_integrations").upsert(
    {
      company_id: session.company_id,
      key: "SAGE300CRE_ACCOUNT_TOKEN",
      value: result.accountToken,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "company_id,key" }
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
