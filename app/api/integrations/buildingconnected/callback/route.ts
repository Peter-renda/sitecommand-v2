/**
 * GET /api/integrations/buildingconnected/callback
 *
 * Handles the APS OAuth callback after the user authorizes BuildingConnected.
 * Exchanges the authorization code for access + refresh tokens, captures the
 * connected user's profile, stores everything in company_integrations, and
 * redirects back to the Preconstruction page carried in `state.returnTo`.
 *
 * Security: the `state` carries companyId + a CSRF nonce that must match the
 * httpOnly cookie set by /connect (mirrors the QuickBooks callback). The flow
 * was already gated to super_admin/site_admin in /connect.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  getBuildingConnectedAppCredentials,
  getBuildingConnectedRedirectUri,
  getAppOrigin,
  exchangeBuildingConnectedCode,
  persistBuildingConnectedTokens,
  fetchBuildingConnectedUser,
  BC_OAUTH_STATE_COOKIE,
} from "@/lib/buildingconnected";

function safeReturnTo(raw: unknown): string {
  if (typeof raw === "string" && raw.startsWith("/") && !raw.startsWith("//")) return raw;
  return "/dashboard";
}

export async function GET(req: NextRequest) {
  const origin = getAppOrigin(req);
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const stateB64 = searchParams.get("state");
  const oauthError = searchParams.get("error");

  // Decode state up front so every exit lands back on the originating page.
  let returnTo = "/dashboard";
  let companyId = "";
  let nonce = "";
  try {
    if (stateB64) {
      const parsed = JSON.parse(Buffer.from(stateB64, "base64url").toString("utf-8"));
      returnTo = safeReturnTo(parsed.returnTo);
      companyId = typeof parsed.companyId === "string" ? parsed.companyId : "";
      nonce = typeof parsed.nonce === "string" ? parsed.nonce : "";
    }
  } catch {
    /* fall through to defaults / invalid_callback */
  }

  // Every exit clears the one-time state cookie.
  function redirect(suffix: string) {
    const res = NextResponse.redirect(`${origin}${returnTo}${suffix}`);
    res.cookies.delete(BC_OAUTH_STATE_COOKIE);
    return res;
  }

  if (oauthError) {
    const reason = searchParams.get("error_description") || oauthError;
    return redirect(`?bc_error=denied&reason=${encodeURIComponent(reason)}`);
  }
  if (!code || !stateB64 || !companyId) {
    return redirect(`?bc_error=invalid_callback`);
  }

  // CSRF: state nonce must match the cookie set by /connect.
  const cookieNonce = req.cookies.get(BC_OAUTH_STATE_COOKIE)?.value;
  if (!nonce || !cookieNonce || nonce !== cookieNonce) {
    return redirect(`?bc_error=invalid_state`);
  }

  const appCreds = await getBuildingConnectedAppCredentials();
  if (!appCreds.clientId || !appCreds.clientSecret) {
    return redirect(`?bc_error=missing_app_creds`);
  }

  // Must be byte-for-byte identical to the redirect_uri used in /connect.
  const redirectUri = getBuildingConnectedRedirectUri(req);
  const exchanged = await exchangeBuildingConnectedCode(
    { clientId: appCreds.clientId, clientSecret: appCreds.clientSecret },
    code,
    redirectUri
  );
  if (!exchanged.ok) {
    return redirect(`?bc_error=token_exchange_failed&reason=${encodeURIComponent(exchanged.error)}`);
  }

  // Validate the token and capture who's connected (best-effort, non-fatal).
  const profile = await fetchBuildingConnectedUser(exchanged.tokens.access_token);
  // Session cookie is SameSite=Lax so it survives the redirect; used only to
  // record who connected — not to gate the flow (the nonce cookie does that).
  const session = await getSession().catch(() => null);

  await persistBuildingConnectedTokens(companyId, exchanged.tokens, {
    userName: profile?.name ?? null,
    userEmail: profile?.email ?? null,
    connectedBy: session?.username ?? null,
    markConnectedAt: true,
  });

  return redirect(`?bc_connected=1`);
}
