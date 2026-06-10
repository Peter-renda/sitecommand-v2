/**
 * POST /api/integrations/sage300cre/connect
 *
 * Step 1 of the Agave Link flow: mints a short-lived, single-use Link token that
 * the Settings UI hands to Agave Link, where the company authenticates their
 * on-premise Sage 300 CRE connector and picks "Sage 300 CRE" as the source
 * system. Agave Link then returns a public token, which is sent to
 * /api/integrations/sage300cre/exchange to obtain the durable Account Token.
 *
 * Only the Agave app credentials (Client-Id/Secret) are required here — no
 * account token exists yet. The company_id is used as the Agave reference_id.
 *
 * Auth: company super_admin or site_admin.
 */

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  getSage300CreAppCredentials,
  isSage300CreAppConfigured,
  createLinkToken,
} from "@/lib/sage300cre";

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.company_role !== "super_admin" && session.role !== "site_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!session.company_id) {
    return NextResponse.json({ error: "No company associated with this account" }, { status: 422 });
  }

  const app = await getSage300CreAppCredentials(session.company_id);
  if (!isSage300CreAppConfigured(app)) {
    return NextResponse.json(
      { error: "Add your Agave Client ID and Client Secret first, then connect." },
      { status: 422 }
    );
  }

  const result = await createLinkToken(app, session.company_id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  return NextResponse.json({ linkToken: result.linkToken });
}
