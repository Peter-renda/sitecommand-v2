/**
 * Autodesk BuildingConnected integration helpers.
 *
 * BuildingConnected is part of Autodesk Platform Services (APS, formerly Forge),
 * so it authenticates against the same APS app (client id / secret) that the BIM
 * viewer already uses — see lib/platform-settings.ts::getApsCredentials. The BIM
 * viewer uses a 2-legged (client-credentials) token; BuildingConnected needs a
 * 3-legged (user-authorized) token because it reads a user's bids/opportunities.
 *
 * The 3-legged tokens are stored per-company in `company_integrations` (the same
 * generic key/value table used by QuickBooks/Xero/Sage). App credentials stay at
 * the platform level via getApsCredentials.
 */

import { getSupabase } from "@/lib/supabase";
import { getApsCredentials } from "@/lib/platform-settings";

// ── Endpoints ─────────────────────────────────────────────────────────────────
export const APS_AUTHORIZE_URL =
  "https://developer.api.autodesk.com/authentication/v2/authorize";
export const APS_TOKEN_URL =
  "https://developer.api.autodesk.com/authentication/v2/token";
export const BC_API_BASE =
  "https://developer.api.autodesk.com/construction/buildingconnected/v2";

export const BC_CALLBACK_PATH = "/api/integrations/buildingconnected/callback";
export const BC_OAUTH_STATE_COOKIE = "bc_oauth_state";

// `offline_access` is REQUIRED by APS Authentication v2 to receive a refresh
// token; `data:read data:write` covers the BuildingConnected REST resources.
const DEFAULT_BC_SCOPES = "data:read data:write offline_access";
export function getBuildingConnectedScopes(): string {
  return process.env.APS_BC_SCOPES?.trim() || DEFAULT_BC_SCOPES;
}

// ── company_integrations storage keys ─────────────────────────────────────────
export const BC_KEYS = {
  accessToken: "APS_BC_ACCESS_TOKEN",
  refreshToken: "APS_BC_REFRESH_TOKEN",
  expiresAt: "APS_BC_EXPIRES_AT",
  userName: "APS_BC_USER_NAME",
  userEmail: "APS_BC_USER_EMAIL",
  connectedAt: "APS_BC_CONNECTED_AT",
  connectedBy: "APS_BC_CONNECTED_BY",
} as const;

export const BC_CONNECTION_KEYS = Object.values(BC_KEYS);

// ── App credentials (shared with the BIM viewer's APS app) ────────────────────
export type ApsAppCredentials = { clientId: string | null; clientSecret: string | null };

export async function getBuildingConnectedAppCredentials(): Promise<ApsAppCredentials> {
  return getApsCredentials();
}

export function isBuildingConnectedAppConfigured(creds: ApsAppCredentials): boolean {
  return Boolean(creds.clientId && creds.clientSecret);
}

// ── Origin / redirect helpers (mirrors lib/quickbooks.ts) ─────────────────────
/**
 * Resolves the app's canonical origin for browser-facing redirects. Prefers
 * NEXT_PUBLIC_APP_URL so the user lands back on the domain their session cookie
 * lives on (request-derived origins behind Vercel's proxy can resolve to a
 * per-deployment *.vercel.app host where the user is logged out).
 */
export function getAppOrigin(req: Request): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (appUrl) return appUrl.replace(/\/+$/, "");

  const fwdHost = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = fwdHost || req.headers.get("host") || new URL(req.url).host;
  const fwdProto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const isLocal = host.startsWith("localhost") || host.startsWith("127.0.0.1");
  const proto = fwdProto || (isLocal ? "http" : "https");
  return `${proto}://${host}`;
}

/**
 * Resolves the OAuth redirect_uri sent to Autodesk. APS aborts authorization
 * when redirect_uri doesn't EXACTLY match a Callback URL registered on the app,
 * so we pin it to a stable, configured value rather than deriving it per-request:
 *   1. APS_BC_REDIRECT_URI       – exact override; set to match the APS portal
 *   2. NEXT_PUBLIC_APP_URL + path – the app's canonical origin
 *   3. request-derived origin     – last resort
 */
export function getBuildingConnectedRedirectUri(req: Request): string {
  const explicit = process.env.APS_BC_REDIRECT_URI?.trim();
  if (explicit) return explicit;
  return `${getAppOrigin(req)}${BC_CALLBACK_PATH}`;
}

// ── Connection state ──────────────────────────────────────────────────────────
export type BuildingConnectedConnection = {
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: string | null;
  userName: string | null;
  userEmail: string | null;
  connectedAt: string | null;
};

export async function getBuildingConnectedConnection(
  companyId: string
): Promise<BuildingConnectedConnection> {
  try {
    const supabase = getSupabase();
    const { data } = await supabase
      .from("company_integrations")
      .select("key, value")
      .eq("company_id", companyId)
      .in("key", BC_CONNECTION_KEYS);

    const map: Record<string, string> = {};
    for (const row of data ?? []) map[row.key] = row.value;

    return {
      accessToken: map[BC_KEYS.accessToken] ?? null,
      refreshToken: map[BC_KEYS.refreshToken] ?? null,
      expiresAt: map[BC_KEYS.expiresAt] ?? null,
      userName: map[BC_KEYS.userName] ?? null,
      userEmail: map[BC_KEYS.userEmail] ?? null,
      connectedAt: map[BC_KEYS.connectedAt] ?? null,
    };
  } catch {
    return {
      accessToken: null,
      refreshToken: null,
      expiresAt: null,
      userName: null,
      userEmail: null,
      connectedAt: null,
    };
  }
}

export function isBuildingConnectedConnected(conn: BuildingConnectedConnection): boolean {
  return Boolean(conn.refreshToken || conn.accessToken);
}

// ── Token persistence ─────────────────────────────────────────────────────────
type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
};

/**
 * Upserts the access token (+ derived expiry) and, when present, the refresh
 * token and the connected-user metadata. Never writes null values — the
 * company_integrations.value column is NOT NULL.
 */
export async function persistBuildingConnectedTokens(
  companyId: string,
  tokens: TokenResponse,
  extra?: {
    userName?: string | null;
    userEmail?: string | null;
    connectedBy?: string | null;
    markConnectedAt?: boolean;
  }
): Promise<void> {
  const supabase = getSupabase();
  const now = new Date();
  const nowIso = now.toISOString();
  const expiresAt = new Date(now.getTime() + (tokens.expires_in ?? 3600) * 1000).toISOString();

  const rows: { company_id: string; key: string; value: string; updated_at: string }[] = [
    { company_id: companyId, key: BC_KEYS.accessToken, value: tokens.access_token, updated_at: nowIso },
    { company_id: companyId, key: BC_KEYS.expiresAt, value: expiresAt, updated_at: nowIso },
  ];
  if (tokens.refresh_token) {
    rows.push({ company_id: companyId, key: BC_KEYS.refreshToken, value: tokens.refresh_token, updated_at: nowIso });
  }
  if (extra?.userName) rows.push({ company_id: companyId, key: BC_KEYS.userName, value: extra.userName, updated_at: nowIso });
  if (extra?.userEmail) rows.push({ company_id: companyId, key: BC_KEYS.userEmail, value: extra.userEmail, updated_at: nowIso });
  if (extra?.connectedBy) rows.push({ company_id: companyId, key: BC_KEYS.connectedBy, value: extra.connectedBy, updated_at: nowIso });
  if (extra?.markConnectedAt) rows.push({ company_id: companyId, key: BC_KEYS.connectedAt, value: nowIso, updated_at: nowIso });

  await supabase.from("company_integrations").upsert(rows, { onConflict: "company_id,key" });
}

// ── Token exchange / refresh ──────────────────────────────────────────────────
function basicAuth(clientId: string, clientSecret: string): string {
  return Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
}

function parseTokenError(status: number, rawText: string): string {
  let reason = `HTTP ${status}`;
  try {
    const j = JSON.parse(rawText) as { error?: string; error_description?: string };
    reason = j.error_description || j.error || reason;
  } catch {
    /* non-JSON body */
  }
  return reason;
}

export async function exchangeBuildingConnectedCode(
  creds: { clientId: string; clientSecret: string },
  code: string,
  redirectUri: string
): Promise<{ ok: true; tokens: TokenResponse } | { ok: false; error: string }> {
  try {
    const res = await fetch(APS_TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth(creds.clientId, creds.clientSecret)}`,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }).toString(),
    });
    const text = await res.text();
    if (!res.ok) return { ok: false, error: parseTokenError(res.status, text) };
    return { ok: true, tokens: JSON.parse(text) as TokenResponse };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "token exchange failed" };
  }
}

export async function refreshBuildingConnectedToken(
  companyId: string,
  creds: { clientId: string; clientSecret: string },
  refreshToken: string
): Promise<{ ok: true; accessToken: string } | { ok: false; error: string }> {
  try {
    const res = await fetch(APS_TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth(creds.clientId, creds.clientSecret)}`,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        scope: getBuildingConnectedScopes(),
      }).toString(),
    });
    const text = await res.text();
    if (!res.ok) return { ok: false, error: parseTokenError(res.status, text) };

    const tokens = JSON.parse(text) as TokenResponse;
    await persistBuildingConnectedTokens(companyId, tokens);
    return { ok: true, accessToken: tokens.access_token };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "token refresh failed" };
  }
}

/**
 * Returns a usable access token for the company, transparently refreshing it
 * when it has expired (or is within 60s of expiring). Returns null when the
 * company isn't connected or the refresh fails. Intended for routes that call
 * the BuildingConnected REST API on the company's behalf.
 */
export async function getValidBuildingConnectedAccessToken(
  companyId: string
): Promise<string | null> {
  const conn = await getBuildingConnectedConnection(companyId);
  if (!isBuildingConnectedConnected(conn)) return null;

  const stillValid =
    conn.accessToken &&
    conn.expiresAt &&
    new Date(conn.expiresAt).getTime() - Date.now() > 60_000;
  if (stillValid) return conn.accessToken;

  if (!conn.refreshToken) return conn.accessToken; // no refresh token; best effort
  const appCreds = await getBuildingConnectedAppCredentials();
  if (!appCreds.clientId || !appCreds.clientSecret) return conn.accessToken;

  const refreshed = await refreshBuildingConnectedToken(
    companyId,
    { clientId: appCreds.clientId, clientSecret: appCreds.clientSecret },
    conn.refreshToken
  );
  return refreshed.ok ? refreshed.accessToken : null;
}

// ── BuildingConnected user profile ────────────────────────────────────────────
/**
 * Reads the authorizing user's BuildingConnected profile. Doubles as a token
 * validity check and lets the UI show who the company is connected as. Parsed
 * defensively because BuildingConnected's user shape varies by tenant.
 */
export async function fetchBuildingConnectedUser(
  accessToken: string
): Promise<{ name: string | null; email: string | null } | null> {
  try {
    const res = await fetch(`${BC_API_BASE}/users/me`, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    });
    if (!res.ok) return null;

    const u = (await res.json()) as Record<string, unknown>;
    const nameObj = (u.name ?? {}) as Record<string, unknown>;
    const first = (nameObj.first ?? u.firstName ?? "") as string;
    const last = (nameObj.last ?? u.lastName ?? "") as string;
    const display =
      [first, last].filter(Boolean).join(" ").trim() ||
      (typeof u.name === "string" ? (u.name as string) : "") ||
      null;
    const email = ((u.email ?? u.emailAddress) as string) ?? null;
    return { name: display, email };
  } catch {
    return null;
  }
}

// ── Disconnect ────────────────────────────────────────────────────────────────
export async function disconnectBuildingConnected(companyId: string): Promise<void> {
  const supabase = getSupabase();
  await supabase
    .from("company_integrations")
    .delete()
    .eq("company_id", companyId)
    .in("key", BC_CONNECTION_KEYS);
}
