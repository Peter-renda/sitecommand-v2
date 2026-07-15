/**
 * GET /api/integrations/buildingconnected/connect
 *
 * Initiates the Autodesk Platform Services (APS) 3-legged OAuth flow used by the
 * BuildingConnected API. Redirects the user to Autodesk's authorization screen;
 * after approval APS redirects to /api/integrations/buildingconnected/callback.
 *
 * The BuildingConnected connection is company-level (shared across the company's
 * projects) but the connect/disconnect UI lives on a project's Preconstruction
 * page, so a `returnTo` query param carries the page to land back on.
 *
 * CSRF: a random nonce is embedded in the OAuth `state` and mirrored in a
 * short-lived httpOnly cookie; the callback rejects any mismatch.
 *
 * Auth: company super_admin or site_admin.
 */

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getSession } from "@/lib/auth";
import {
  getBuildingConnectedAppCredentials,
  isBuildingConnectedAppConfigured,
  getBuildingConnectedRedirectUri,
  getBuildingConnectedScopes,
  getAppOrigin,
  APS_AUTHORIZE_URL,
  BC_OAUTH_STATE_COOKIE,
} from "@/lib/buildingconnected";

// Only allow returning to a relative in-app path to avoid open redirects.
function safeReturnTo(raw: string | null): string {
  if (raw && raw.startsWith("/") && !raw.startsWith("//")) return raw;
  return "/dashboard";
}

export async function GET(req: NextRequest) {
  const origin = getAppOrigin(req);
  const returnTo = safeReturnTo(new URL(req.url).searchParams.get("returnTo"));
  const fail = (code: string) => NextResponse.redirect(`${origin}${returnTo}?bc_error=${code}`);

  const session = await getSession();
  if (!session) return fail("unauthorized");
  if (session.company_role !== "super_admin" && session.role !== "site_admin") {
    return fail("forbidden");
  }
  if (!session.company_id) return fail("no_company");

  const appCreds = await getBuildingConnectedAppCredentials();
  if (!isBuildingConnectedAppConfigured(appCreds)) return fail("not_configured");

  const redirectUri = getBuildingConnectedRedirectUri(req);
  const nonce = randomUUID();
  const state = Buffer.from(
    JSON.stringify({ companyId: session.company_id, nonce, returnTo })
  ).toString("base64url");

  const params = new URLSearchParams({
    response_type: "code",
    client_id: appCreds.clientId as string,
    redirect_uri: redirectUri,
    scope: getBuildingConnectedScopes(),
    state,
  });

  const res = NextResponse.redirect(`${APS_AUTHORIZE_URL}?${params.toString()}`);
  res.cookies.set(BC_OAUTH_STATE_COOKIE, nonce, {
    httpOnly: true,
    sameSite: "lax", // sent on Autodesk's top-level redirect back to the callback
    secure: process.env.NODE_ENV === "production",
    maxAge: 600, // 10 minutes — plenty for the consent screen
    path: "/",
  });
  return res;
}
