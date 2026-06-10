/**
 * GET /api/integrations/quickbooks/connect
 *
 * Initiates the Intuit OAuth 2.0 authorization flow for QBO-compatible
 * accounting tenants (QuickBooks Online and Intuit Enterprise Suite).
 * Redirects the user to Intuit authorization; after approval Intuit redirects
 * to /api/integrations/quickbooks/callback.
 *
 * CSRF: a random nonce is embedded in the OAuth `state` parameter and mirrored
 * in a short-lived httpOnly cookie; the callback rejects any response whose
 * state nonce doesn't match the cookie.
 *
 * Auth: company super_admin or site_admin.
 */

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getSession } from "@/lib/auth";
import {
  getQBOAppCredentials,
  getIntuitRedirectUri,
  getAppOrigin,
  QBO_OAUTH_STATE_COOKIE,
} from "@/lib/quickbooks";

const QBO_AUTH_URL = "https://appcenter.intuit.com/connect/oauth2";
const INTUIT_ACCOUNTING_SCOPE = "com.intuit.quickbooks.accounting";
const SCOPES = process.env.INTUIT_OAUTH_SCOPES?.trim() || INTUIT_ACCOUNTING_SCOPE;

export async function GET(req: NextRequest) {
  const settingsUrl = `${getAppOrigin(req)}/settings/integrations`;

  const session = await getSession();
  if (!session) return NextResponse.redirect(`${settingsUrl}?error=qbo_unauthorized`);
  if (session.company_role !== "super_admin" && session.role !== "site_admin") {
    return NextResponse.redirect(`${settingsUrl}?error=qbo_forbidden`);
  }
  if (!session.company_id) {
    return NextResponse.redirect(`${settingsUrl}?error=qbo_no_company`);
  }

  const appCreds = await getQBOAppCredentials(session.company_id);
  if (!appCreds.clientId) {
    return NextResponse.redirect(`${settingsUrl}?error=qbo_not_configured`);
  }

  // Pinned to a stable value (env-driven) so it matches the URI registered in
  // the Intuit Developer portal — a mismatch is what triggers Intuit's generic
  // "…didn't connect" error page. Must be identical to the value the callback
  // uses for the token exchange.
  const redirectUri = getIntuitRedirectUri(req);

  // Encode company_id + a CSRF nonce in state so the callback can associate
  // tokens with the right company and verify the flow started here.
  const nonce = randomUUID();
  const state = Buffer.from(
    JSON.stringify({ companyId: session.company_id, nonce })
  ).toString("base64url");

  const params = new URLSearchParams({
    client_id: appCreds.clientId,
    response_type: "code",
    scope: SCOPES,
    redirect_uri: redirectUri,
    state,
  });

  const res = NextResponse.redirect(`${QBO_AUTH_URL}?${params.toString()}`);
  res.cookies.set(QBO_OAUTH_STATE_COOKIE, nonce, {
    httpOnly: true,
    sameSite: "lax", // sent on Intuit's top-level redirect back to the callback
    secure: process.env.NODE_ENV === "production",
    maxAge: 600, // 10 minutes — plenty for the consent screen
    path: "/",
  });
  return res;
}
