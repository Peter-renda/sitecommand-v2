/**
 * GET /api/integrations/quickbooks/callback
 *
 * Handles the OAuth 2.0 callback from Intuit after the user authorizes access.
 * Exchanges the authorization code for access + refresh tokens, stores them in
 * company_integrations, and redirects back to the integrations settings page.
 *
 * Auth: the state parameter carries the companyId plus a CSRF nonce that must
 * match the httpOnly cookie set by /connect.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import {
  getQBOAppCredentials,
  getIntuitRedirectUri,
  getAppOrigin,
  QBO_OAUTH_STATE_COOKIE,
} from "@/lib/quickbooks";

const QBO_TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code     = searchParams.get("code");
  const realmId  = searchParams.get("realmId");
  const stateB64 = searchParams.get("state");
  const error    = searchParams.get("error");

  const settingsUrl = `${getAppOrigin(req)}/settings/integrations`;

  // Every exit clears the one-time state cookie.
  function redirect(to: string) {
    const res = NextResponse.redirect(to);
    res.cookies.delete(QBO_OAUTH_STATE_COOKIE);
    return res;
  }

  if (error) {
    // Surface Intuit's own reason (e.g. access_denied) when present.
    const reason = searchParams.get("error_description") || error;
    return redirect(`${settingsUrl}?error=qbo_denied&reason=${encodeURIComponent(reason)}`);
  }

  if (!code || !realmId || !stateB64) {
    return redirect(`${settingsUrl}?error=qbo_invalid_callback`);
  }

  // Decode state to get company_id and verify the CSRF nonce against the
  // cookie set when the flow started.
  let companyId: string;
  try {
    const parsed = JSON.parse(Buffer.from(stateB64, "base64url").toString("utf-8"));
    companyId = parsed.companyId;
    if (!companyId) throw new Error("missing companyId");
    const cookieNonce = req.cookies.get(QBO_OAUTH_STATE_COOKIE)?.value;
    if (!parsed.nonce || !cookieNonce || parsed.nonce !== cookieNonce) {
      throw new Error("state nonce mismatch");
    }
  } catch {
    return redirect(`${settingsUrl}?error=qbo_invalid_state`);
  }

  const appCreds = await getQBOAppCredentials(companyId);
  if (!appCreds.clientId || !appCreds.clientSecret) {
    return redirect(`${settingsUrl}?error=qbo_missing_app_creds`);
  }

  // Must be byte-for-byte identical to the redirect_uri used on the authorize
  // call in /connect, or Intuit rejects the token exchange.
  const redirectUri = getIntuitRedirectUri(req);
  const basicAuth = Buffer.from(`${appCreds.clientId}:${appCreds.clientSecret}`).toString("base64");

  // Exchange code for tokens
  let accessToken: string;
  let refreshToken: string;
  try {
    const res = await fetch(QBO_TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }).toString(),
    });

    const rawText = await res.text();

    if (!res.ok) {
      // Intuit returns { error, error_description } here (e.g. invalid_grant when
      // the redirect_uri doesn't match the authorize call). Pass it through.
      let reason = `HTTP ${res.status}`;
      try {
        const errJson = JSON.parse(rawText) as { error?: string; error_description?: string };
        reason = errJson.error_description || errJson.error || reason;
      } catch { /* non-JSON body */ }
      return redirect(
        `${settingsUrl}?error=qbo_token_exchange_failed&reason=${encodeURIComponent(reason)}`
      );
    }

    const json = JSON.parse(rawText) as { access_token: string; refresh_token: string };
    accessToken  = json.access_token;
    refreshToken = json.refresh_token;
  } catch {
    return redirect(`${settingsUrl}?error=qbo_token_exchange_failed`);
  }

  // Persist tokens + realmId to company_integrations
  const supabase = getSupabase();
  const now = new Date().toISOString();
  await supabase.from("company_integrations").upsert(
    [
      { company_id: companyId, key: "QBO_REALM_ID",      value: realmId,       updated_at: now },
      { company_id: companyId, key: "QBO_ACCESS_TOKEN",  value: accessToken,   updated_at: now },
      { company_id: companyId, key: "QBO_REFRESH_TOKEN", value: refreshToken,  updated_at: now },
    ],
    { onConflict: "company_id,key" }
  );

  return redirect(`${settingsUrl}?connected=quickbooks`);
}
