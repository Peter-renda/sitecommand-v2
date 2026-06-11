/**
 * QuickBooks Online (QBO) API client.
 *
 * QBO uses OAuth 2.0 with short-lived access tokens (1 hr) and long-lived
 * refresh tokens (100 days). Every API call is a JSON REST request to the
 * company-scoped base URL.
 *
 * Credentials lookup order (most → least specific):
 *   1. company_integrations (company admin sets their own Intuit app credentials)
 *   2. platform_settings    (site admin sets a shared Intuit app for all companies)
 *   3. Environment variables
 *
 *   Company-level tokens set automatically via OAuth callback:
 *     QBO_REALM_ID, QBO_ACCESS_TOKEN, QBO_REFRESH_TOKEN
 */

import { getSupabase } from "@/lib/supabase";

const QBO_API_BASE_PRODUCTION = "https://quickbooks.api.intuit.com/v3/company";
const QBO_API_BASE_SANDBOX    = "https://sandbox-quickbooks.api.intuit.com/v3/company";
const QBO_TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
const QBO_MINOR_VERSION = "65";

export type QBOEnvironment = "sandbox" | "production";

/** Normalizes an environment value; defaults to production. */
function resolveQBOEnvironment(value?: string | null): QBOEnvironment {
  return (value ?? "").trim().toLowerCase() === "sandbox" ? "sandbox" : "production";
}

/**
 * Resolves the accounting-API base for a company's environment. The OAuth
 * authorize/token URLs are identical across environments — only this REST base
 * (and the key set) differs: sandbox keys + sandbox base for test companies,
 * production keys + production base for real companies. `QBO_API_BASE` overrides
 * everything when explicitly set.
 */
function qboApiBase(environment: QBOEnvironment): string {
  const explicit = process.env.QBO_API_BASE?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  return environment === "sandbox" ? QBO_API_BASE_SANDBOX : QBO_API_BASE_PRODUCTION;
}

/** Path Intuit redirects back to after OAuth authorization. */
export const QBO_CALLBACK_PATH = "/api/integrations/quickbooks/callback";

/** Cookie carrying the OAuth state nonce between /connect and /callback (CSRF guard). */
export const QBO_OAUTH_STATE_COOKIE = "qbo_oauth_state";

/**
 * Resolves the app's canonical origin for browser-facing redirects.
 * Prefers NEXT_PUBLIC_APP_URL so post-OAuth redirects land on the domain the
 * user's session cookie lives on (request-derived origins behind Vercel's
 * proxy can resolve to a per-deployment *.vercel.app host where the user is
 * logged out). Falls back to x-forwarded-* request headers.
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
 * Resolves the OAuth redirect_uri sent to Intuit.
 *
 * Intuit aborts the whole authorization with a generic "…didn't connect"
 * error page when redirect_uri does not EXACTLY match a URI registered on the
 * app in the Intuit Developer portal (scheme, host, path, trailing slash).
 * Deriving the origin from the incoming request is fragile behind Vercel's
 * proxy — the protocol can resolve to http and the host can be a per-deployment
 * *.vercel.app domain — so we pin it to a stable, configured value:
 *
 *   1. INTUIT_REDIRECT_URI        – exact override; set to match the portal verbatim
 *   2. NEXT_PUBLIC_APP_URL + path – the app's canonical origin (used elsewhere for links)
 *   3. request-derived origin     – last resort; honors x-forwarded-* and assumes https off-localhost
 *
 * The authorize call and the token exchange MUST use the same value, so both
 * routes call this helper.
 */
export function getIntuitRedirectUri(req: Request): string {
  const explicit = process.env.INTUIT_REDIRECT_URI?.trim();
  if (explicit) return explicit;
  return `${getAppOrigin(req)}${QBO_CALLBACK_PATH}`;
}

// ── Credential types ──────────────────────────────────────────────────────────

export type QBOAppCredentials = {
  clientId: string | null;
  clientSecret: string | null;
};

export type QBOCompanyCredentials = {
  realmId: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  environment: QBOEnvironment;
};

// ── Credential helpers ────────────────────────────────────────────────────────

/**
 * Loads QBO app credentials. Company-level credentials take precedence over
 * platform-level ones, allowing each company to register their own Intuit app
 * without requiring site admin involvement.
 *
 * Lookup order: company_integrations → platform_settings → env vars
 */
export async function getQBOAppCredentials(companyId?: string): Promise<QBOAppCredentials> {
  try {
    const supabase = getSupabase();

    // Check company-level credentials first
    if (companyId) {
      const { data: companyData } = await supabase
        .from("company_integrations")
        .select("key, value")
        .eq("company_id", companyId)
        .in("key", ["QBO_CLIENT_ID", "QBO_CLIENT_SECRET"]);

      const companyMap: Record<string, string> = {};
      for (const row of companyData ?? []) companyMap[row.key] = row.value;

      if (companyMap.QBO_CLIENT_ID && companyMap.QBO_CLIENT_SECRET) {
        return {
          clientId:     companyMap.QBO_CLIENT_ID,
          clientSecret: companyMap.QBO_CLIENT_SECRET,
        };
      }
    }

    // Fall back to platform-level credentials
    const { data: platformData } = await supabase
      .from("platform_settings")
      .select("key, value")
      .in("key", ["QBO_CLIENT_ID", "QBO_CLIENT_SECRET"]);

    const platformMap: Record<string, string> = {};
    for (const row of platformData ?? []) platformMap[row.key] = row.value;

    return {
      clientId:     platformMap.QBO_CLIENT_ID     ?? process.env.QBO_CLIENT_ID     ?? null,
      clientSecret: platformMap.QBO_CLIENT_SECRET ?? process.env.QBO_CLIENT_SECRET ?? null,
    };
  } catch {
    return {
      clientId:     process.env.QBO_CLIENT_ID     ?? null,
      clientSecret: process.env.QBO_CLIENT_SECRET ?? null,
    };
  }
}

/**
 * Loads per-company QBO tokens from company_integrations.
 */
export async function getQBOCompanyCredentials(
  companyId: string
): Promise<QBOCompanyCredentials> {
  const keys = ["QBO_REALM_ID", "QBO_ACCESS_TOKEN", "QBO_REFRESH_TOKEN", "QBO_ENVIRONMENT"] as const;

  try {
    const supabase = getSupabase();
    const { data } = await supabase
      .from("company_integrations")
      .select("key, value")
      .eq("company_id", companyId)
      .in("key", keys);

    const map: Record<string, string> = {};
    for (const row of data ?? []) map[row.key] = row.value;

    return {
      realmId:      map.QBO_REALM_ID      ?? null,
      accessToken:  map.QBO_ACCESS_TOKEN  ?? null,
      refreshToken: map.QBO_REFRESH_TOKEN ?? null,
      // Per-company QBO_ENVIRONMENT row wins; falls back to the QBO_ENVIRONMENT env var, else production.
      environment:  resolveQBOEnvironment(map.QBO_ENVIRONMENT ?? process.env.QBO_ENVIRONMENT),
    };
  } catch {
    return {
      realmId: null, accessToken: null, refreshToken: null,
      environment: resolveQBOEnvironment(process.env.QBO_ENVIRONMENT),
    };
  }
}

export function isQBOConfigured(creds: QBOCompanyCredentials): boolean {
  return !!(creds.realmId && creds.accessToken && creds.refreshToken);
}

// ── Token refresh ─────────────────────────────────────────────────────────────

type TokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
};

/**
 * Exchanges a refresh token for a new access token and persists the updated
 * tokens back to company_integrations.
 */
export async function refreshQBOTokens(
  companyId: string,
  appCreds: QBOAppCredentials,
  refreshToken: string
): Promise<{ accessToken: string; refreshToken: string } | null> {
  if (!appCreds.clientId || !appCreds.clientSecret) return null;

  const basicAuth = Buffer.from(
    `${appCreds.clientId}:${appCreds.clientSecret}`
  ).toString("base64");

  try {
    const res = await fetch(QBO_TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }).toString(),
    });

    if (!res.ok) return null;

    const json = (await res.json()) as TokenResponse;
    const { access_token, refresh_token } = json;

    // Persist fresh tokens
    const supabase = getSupabase();
    const now = new Date().toISOString();
    await supabase.from("company_integrations").upsert(
      [
        { company_id: companyId, key: "QBO_ACCESS_TOKEN",  value: access_token,  updated_at: now },
        { company_id: companyId, key: "QBO_REFRESH_TOKEN", value: refresh_token, updated_at: now },
      ],
      { onConflict: "company_id,key" }
    );

    return { accessToken: access_token, refreshToken: refresh_token };
  } catch {
    return null;
  }
}

const QBO_REVOKE_URL = "https://developer.api.intuit.com/v2/oauth2/tokens/revoke";

/**
 * Revokes a refresh (or access) token with Intuit, invalidating the whole
 * grant. Best-effort: returns false on any failure so disconnect can proceed
 * to clear local state regardless.
 */
export async function revokeQBOToken(
  appCreds: QBOAppCredentials,
  token: string
): Promise<boolean> {
  if (!appCreds.clientId || !appCreds.clientSecret || !token) return false;
  const basicAuth = Buffer.from(
    `${appCreds.clientId}:${appCreds.clientSecret}`
  ).toString("base64");
  try {
    const res = await fetch(QBO_REVOKE_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ token }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ── API call helper ───────────────────────────────────────────────────────────

/**
 * Accounting feedback parsed from a QBO entity: the totals as QBO computed
 * them, the open balance, and a derived payment status. Posting docs
 * (Bill/Invoice) carry TotalAmt + Balance; a PurchaseOrder is non-posting and
 * reports its POStatus (Open/Closed) via `docStatus` instead.
 */
export type QBOEntityFinancials = {
  totalAmount: number | null;
  balance: number | null;
  paymentStatus: "paid" | "partially_paid" | "unpaid" | null;
  docStatus: string | null;
};

/**
 * What the sync actually did to the QBO document:
 *   synced  – created or updated normally (default when omitted)
 *   deleted – Bill removed because the commitment is void/terminated
 *   closed  – PurchaseOrder POStatus set to Closed (void/terminated)
 *   voided  – Invoice voided (void/terminated prime contract)
 *   skipped – record is void/terminated and was never synced; nothing to do
 */
export type QBOSyncAction = "synced" | "deleted" | "closed" | "voided" | "skipped";

export type QBOResult =
  | {
      ok: true;
      id: string;
      syncToken?: string;
      rawResponse: string;
      action?: QBOSyncAction;
      financials?: QBOEntityFinancials;
      vendorId?: string;
      customerId?: string;
    }
  | { ok: false; error: string; rawResponse: string; validation?: boolean };

function derivePaymentStatus(
  totalAmount: number | null,
  balance: number | null
): "paid" | "partially_paid" | "unpaid" | null {
  if (totalAmount == null || balance == null) return null;
  if (balance <= 0) return "paid";
  if (balance < totalAmount) return "partially_paid";
  return "unpaid";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractFinancials(entity: any): QBOEntityFinancials {
  const totalAmount = entity?.TotalAmt != null ? Number(entity.TotalAmt) : null;
  const balance = entity?.Balance != null ? Number(entity.Balance) : null;
  return {
    totalAmount,
    balance,
    paymentStatus: derivePaymentStatus(totalAmount, balance),
    docStatus: entity?.POStatus != null ? String(entity.POStatus) : null,
  };
}

/**
 * Makes an authenticated JSON request to the QBO REST API. Automatically
 * retries once with a refreshed token if a 401 is returned.
 */
export async function callQBO(
  companyId: string,
  appCreds: QBOAppCredentials,
  companyCreds: QBOCompanyCredentials,
  method: "GET" | "POST",
  path: string,
  body?: unknown
): Promise<{ status: number; json: unknown; rawText: string }> {
  let accessToken = companyCreds.accessToken!;
  const realmId = companyCreds.realmId!;
  // `path` may already carry a query string (e.g. "bill?operation=update" or a
  // "query?query=..." call), so pick the right separator for minorversion.
  const sep = path.includes("?") ? "&" : "?";
  const url = `${qboApiBase(companyCreds.environment)}/${realmId}/${path}${sep}minorversion=${QBO_MINOR_VERSION}`;

  async function attempt(token: string) {
    return fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  let res = await attempt(accessToken);

  // Retry once with refreshed token on 401
  if (res.status === 401 && companyCreds.refreshToken) {
    const refreshed = await refreshQBOTokens(
      companyId,
      appCreds,
      companyCreds.refreshToken
    );
    if (refreshed) {
      accessToken = refreshed.accessToken;
      res = await attempt(accessToken);
    }
  }

  const rawText = await res.text();
  let json: unknown = null;
  try { json = JSON.parse(rawText); } catch { /* non-JSON */ }

  return { status: res.status, json, rawText };
}

// ── Idempotency helpers ───────────────────────────────────────────────────────

/**
 * Fetches the current SyncToken for a QBO entity. QBO requires the latest token
 * on every update — if our cached value is stale it returns an error, so we
 * always re-read before issuing an update.
 *
 * `entity` is the QBO endpoint name in lowercase, e.g. "bill", "purchaseorder",
 * "invoice". Returns null if the read fails (caller should fall back to create
 * or surface the error).
 */
export async function fetchQBOSyncToken(
  companyId: string,
  appCreds: QBOAppCredentials,
  companyCreds: QBOCompanyCredentials,
  entity: "bill" | "purchaseorder" | "invoice",
  qboId: string
): Promise<string | null> {
  try {
    const { status, json } = await callQBO(
      companyId, appCreds, companyCreds, "GET", `${entity}/${qboId}`
    );
    if (status !== 200) return null;
    // QBO wraps the response in a capitalized entity key (Bill / PurchaseOrder / Invoice)
    const entityKey = entity === "purchaseorder" ? "PurchaseOrder" : entity.charAt(0).toUpperCase() + entity.slice(1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const syncToken = (json as any)?.[entityKey]?.SyncToken;
    return syncToken !== undefined && syncToken !== null ? String(syncToken) : null;
  } catch {
    return null;
  }
}

/**
 * Re-reads a QBO entity and returns its current totals / open balance /
 * payment status. Used by the refresh endpoint and the cron's payment-status
 * pass so payments applied entirely inside QBO flow back to SiteCommand.
 * Returns null when the entity can't be read (deleted, no access, transport).
 */
export async function fetchQBOEntityFinancials(
  companyId: string,
  appCreds: QBOAppCredentials,
  companyCreds: QBOCompanyCredentials,
  entity: "bill" | "purchaseorder" | "invoice",
  qboId: string
): Promise<QBOEntityFinancials | null> {
  try {
    const { status, json } = await callQBO(
      companyId, appCreds, companyCreds, "GET", `${entity}/${qboId}`
    );
    if (status !== 200) return null;
    const entityKey = entity === "purchaseorder" ? "PurchaseOrder" : entity.charAt(0).toUpperCase() + entity.slice(1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = (json as any)?.[entityKey];
    if (!row) return null;
    return extractFinancials(row);
  } catch {
    return null;
  }
}

// ── Vendor list ───────────────────────────────────────────────────────────────

export type QBOVendor = { id: string; name: string };

export type QBOVendorResult =
  | { ok: true; vendors: QBOVendor[] }
  | { ok: false; error: string };

export async function fetchQBOVendors(
  companyId: string,
  appCreds: QBOAppCredentials,
  companyCreds: QBOCompanyCredentials
): Promise<QBOVendorResult> {
  try {
    const query = encodeURIComponent("SELECT Id, DisplayName FROM Vendor WHERE Active = true MAXRESULTS 200");
    const { status, json, rawText } = await callQBO(
      companyId, appCreds, companyCreds,
      "GET",
      `query?query=${query}`,
    );

    if (status !== 200) {
      return { ok: false, error: extractQBOError(json, rawText) };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = (json as any)?.QueryResponse?.Vendor ?? [];
    const vendors: QBOVendor[] = (Array.isArray(rows) ? rows : [rows]).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (v: any) => ({ id: String(v.Id), name: String(v.DisplayName ?? v.Id) })
    );
    return { ok: true, vendors };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

// ── Customer list ─────────────────────────────────────────────────────────────

export type QBOCustomer = { id: string; name: string };

export type QBOCustomerResult =
  | { ok: true; customers: QBOCustomer[] }
  | { ok: false; error: string };

export async function fetchQBOCustomers(
  companyId: string,
  appCreds: QBOAppCredentials,
  companyCreds: QBOCompanyCredentials
): Promise<QBOCustomerResult> {
  try {
    const query = encodeURIComponent("SELECT Id, DisplayName FROM Customer WHERE Active = true MAXRESULTS 200");
    const { status, json, rawText } = await callQBO(
      companyId, appCreds, companyCreds,
      "GET",
      `query?query=${query}`,
    );

    if (status !== 200) {
      return { ok: false, error: extractQBOError(json, rawText) };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = (json as any)?.QueryResponse?.Customer ?? [];
    const customers: QBOCustomer[] = (Array.isArray(rows) ? rows : [rows]).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (c: any) => ({ id: String(c.Id), name: String(c.DisplayName ?? c.Id) })
    );
    return { ok: true, customers };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

// ── Reference resolution (P0: post with Ref.value, not Ref.name) ───────────────
//
// QBO *Ref fields resolve most reliably by Id (`value`). Posting by `name`
// silently fails when the display name isn't an exact existing match, so we
// resolve every reference to an Id (creating master records when missing) and a
// Bill's expense line to a *real* expense/COGS account (never A/P).

/** Escapes single quotes for use inside a QBO query string literal. */
function escapeQBOString(value: string): string {
  return value.replace(/'/g, "''");
}

/**
 * Runs a QBO query and returns the named entity rows: [] when none match,
 * null on a transport/HTTP error.
 */
async function queryQBO(
  companyId: string,
  appCreds: QBOAppCredentials,
  companyCreds: QBOCompanyCredentials,
  query: string,
  entityKey: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any[] | null> {
  const { status, json } = await callQBO(
    companyId, appCreds, companyCreds, "GET", `query?query=${encodeURIComponent(query)}`
  );
  if (status !== 200) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (json as any)?.QueryResponse?.[entityKey];
  if (rows == null) return [];
  return Array.isArray(rows) ? rows : [rows];
}

export type QBOPostingConfig = {
  expenseAccountName: string | null;
  itemName: string | null;
  retainageReceivableAccount: string | null; // AR retainage (Invoices)
  retainagePayableAccount: string | null;     // AP retainage (Bills)
  /** "class" (default) job-costs every line to a Class named after the project; "none" disables. */
  projectTracking: "class" | "none";
  /** DocNumber prefix: "project" → use the project number, any other value → literal prefix, unset → bare number. */
  docNumberPrefix: string | null;
};

/** Per-company posting defaults (overridable via company_integrations or env). */
export async function getQBOPostingConfig(companyId: string): Promise<QBOPostingConfig> {
  const keys = [
    "QBO_AP_EXPENSE_ACCOUNT",
    "QBO_DEFAULT_ITEM",
    "QBO_RETAINAGE_RECEIVABLE_ACCOUNT",
    "QBO_RETAINAGE_PAYABLE_ACCOUNT",
    "QBO_PROJECT_TRACKING",
    "QBO_DOC_NUMBER_PREFIX",
  ];
  const resolveTracking = (v?: string | null): "class" | "none" =>
    (v ?? "").trim().toLowerCase() === "none" ? "none" : "class";
  const env: QBOPostingConfig = {
    expenseAccountName:        process.env.QBO_AP_EXPENSE_ACCOUNT          ?? null,
    itemName:                  process.env.QBO_DEFAULT_ITEM               ?? null,
    retainageReceivableAccount: process.env.QBO_RETAINAGE_RECEIVABLE_ACCOUNT ?? null,
    retainagePayableAccount:    process.env.QBO_RETAINAGE_PAYABLE_ACCOUNT    ?? null,
    projectTracking:            resolveTracking(process.env.QBO_PROJECT_TRACKING),
    docNumberPrefix:            process.env.QBO_DOC_NUMBER_PREFIX           ?? null,
  };
  try {
    const supabase = getSupabase();
    const { data } = await supabase
      .from("company_integrations")
      .select("key, value")
      .eq("company_id", companyId)
      .in("key", keys);
    const map: Record<string, string> = {};
    for (const row of data ?? []) map[row.key] = row.value;
    return {
      expenseAccountName:         map.QBO_AP_EXPENSE_ACCOUNT          ?? env.expenseAccountName,
      itemName:                   map.QBO_DEFAULT_ITEM                ?? env.itemName,
      retainageReceivableAccount: map.QBO_RETAINAGE_RECEIVABLE_ACCOUNT ?? env.retainageReceivableAccount,
      retainagePayableAccount:    map.QBO_RETAINAGE_PAYABLE_ACCOUNT    ?? env.retainagePayableAccount,
      projectTracking:            map.QBO_PROJECT_TRACKING !== undefined
                                    ? resolveTracking(map.QBO_PROJECT_TRACKING)
                                    : env.projectTracking,
      docNumberPrefix:            map.QBO_DOC_NUMBER_PREFIX            ?? env.docNumberPrefix,
    };
  } catch {
    return env;
  }
}

/**
 * Builds the QBO DocNumber for a record. With QBO_DOC_NUMBER_PREFIX unset the
 * bare record number is used (legacy behavior — numbers can collide across
 * projects in one realm). Set it to "project" to prefix with the project
 * number, or to any literal string to use that prefix. QBO caps DocNumber at
 * 21 characters.
 */
export function buildQBODocNumber(
  number: number | string,
  projectNumber?: string | null,
  prefix?: string | null
): string {
  const base = String(number);
  const p = (prefix ?? "").trim();
  if (!p) return base.slice(0, 21);
  const lead = p.toLowerCase() === "project" ? (projectNumber ?? "").trim() : p;
  return (lead ? `${lead}-${base}` : base).slice(0, 21);
}

/** Lookup result for master-record resolution: an Id, or the reason it failed. */
export type QBORefLookup = { id: string; error?: undefined } | { id: null; error: string };

/**
 * Contact details used to enrich an auto-created Vendor/Customer so the
 * accounting team gets a usable master record (email/phone/address), not just
 * a bare display name. Sourced from the project's directory contact.
 */
export type QBOPartyDetails = {
  companyName?: string | null;
  email?: string | null;
  phone?: string | null;
  fax?: string | null;
  website?: string | null;
  addressLine1?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  country?: string | null;
};

function buildPartyPayload(displayName: string, details?: QBOPartyDetails | null): Record<string, unknown> {
  const payload: Record<string, unknown> = { DisplayName: displayName };
  if (!details) return payload;
  if (details.companyName) payload.CompanyName = details.companyName;
  if (details.email) payload.PrimaryEmailAddr = { Address: details.email };
  if (details.phone) payload.PrimaryPhone = { FreeFormNumber: details.phone };
  if (details.fax) payload.Fax = { FreeFormNumber: details.fax };
  if (details.website) payload.WebAddr = { URI: details.website };
  if (details.addressLine1 || details.city || details.state || details.zip || details.country) {
    const addr: Record<string, unknown> = {};
    if (details.addressLine1) addr.Line1 = details.addressLine1;
    if (details.city) addr.City = details.city;
    if (details.state) addr.CountrySubDivisionCode = details.state;
    if (details.zip) addr.PostalCode = details.zip;
    if (details.country) addr.Country = details.country;
    payload.BillAddr = addr;
  }
  return payload;
}

/**
 * Looks up the directory contact matching a contract party name on a project
 * and shapes it as QBOPartyDetails. Best-effort: returns null when there is no
 * matching contact, so vendor/customer creation falls back to name-only.
 */
export async function lookupDirectoryPartyDetails(
  projectId: string,
  companyName: string
): Promise<QBOPartyDetails | null> {
  const name = (companyName ?? "").trim();
  if (!name || !projectId) return null;
  try {
    const supabase = getSupabase();
    const { data } = await supabase
      .from("directory_contacts")
      .select("type, company, email, phone, business_phone, business_fax, website, address, city, state, zip, country")
      .eq("project_id", projectId)
      .ilike("company", name)
      .limit(10);
    if (!data || data.length === 0) return null;
    const row = data.find((r) => r.type === "company") ?? data[0];
    return {
      companyName: row.company ?? null,
      email: row.email ?? null,
      phone: row.business_phone || row.phone || null,
      fax: row.business_fax ?? null,
      website: row.website ?? null,
      addressLine1: row.address ?? null,
      city: row.city ?? null,
      state: row.state ?? null,
      zip: row.zip ?? null,
      country: row.country ?? null,
    };
  } catch {
    return null;
  }
}

/** Resolves a Vendor by exact DisplayName → Id, creating one (enriched with any
 *  directory contact details) if absent. */
export async function findOrCreateVendorId(
  companyId: string, appCreds: QBOAppCredentials, companyCreds: QBOCompanyCredentials, displayName: string,
  details?: QBOPartyDetails | null
): Promise<QBORefLookup> {
  const name = (displayName ?? "").trim();
  if (!name) return { id: null, error: "no vendor name provided" };
  const found = await queryQBO(
    companyId, appCreds, companyCreds,
    `SELECT Id FROM Vendor WHERE DisplayName = '${escapeQBOString(name)}'`, "Vendor"
  );
  if (found && found.length > 0) return { id: String(found[0].Id) };
  const { status, json, rawText } = await callQBO(
    companyId, appCreds, companyCreds, "POST", "vendor", buildPartyPayload(name, details)
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const id = status === 200 ? String((json as any)?.Vendor?.Id ?? "") : "";
  if (id) return { id };
  return { id: null, error: extractQBOError(json, rawText) };
}

/** Resolves a Customer by exact DisplayName → Id, creating one (enriched with
 *  any directory contact details) if absent. */
export async function findOrCreateCustomerId(
  companyId: string, appCreds: QBOAppCredentials, companyCreds: QBOCompanyCredentials, displayName: string,
  details?: QBOPartyDetails | null
): Promise<QBORefLookup> {
  const name = (displayName ?? "").trim();
  if (!name) return { id: null, error: "no customer name provided" };
  const found = await queryQBO(
    companyId, appCreds, companyCreds,
    `SELECT Id FROM Customer WHERE DisplayName = '${escapeQBOString(name)}'`, "Customer"
  );
  if (found && found.length > 0) return { id: String(found[0].Id) };
  const { status, json, rawText } = await callQBO(
    companyId, appCreds, companyCreds, "POST", "customer", buildPartyPayload(name, details)
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const id = status === 200 ? String((json as any)?.Customer?.Id ?? "") : "";
  if (id) return { id };
  return { id: null, error: extractQBOError(json, rawText) };
}

/**
 * Resolves a payment-terms string ("Net 30") to a QBO Term Id. No auto-create —
 * Terms drive due-date math, so an unknown value stays as memo text instead.
 */
export async function findTermId(
  companyId: string, appCreds: QBOAppCredentials, companyCreds: QBOCompanyCredentials, termName?: string | null
): Promise<string | null> {
  const name = (termName ?? "").trim();
  if (!name) return null;
  const rows = await queryQBO(
    companyId, appCreds, companyCreds,
    `SELECT Id FROM Term WHERE Name = '${escapeQBOString(name)}' AND Active = true`, "Term"
  );
  return rows && rows.length > 0 ? String(rows[0].Id) : null;
}

/**
 * Resolves the expense/COGS account to debit on a Bill. Uses the configured
 * account name when provided; otherwise auto-detects the first active COGS
 * (then Expense) account. Returns null when none can be found — never A/P.
 */
/** Resolves an Account by exact Name → Id (no auto-create; accounts require a type). */
export async function findAccountIdByName(
  companyId: string, appCreds: QBOAppCredentials, companyCreds: QBOCompanyCredentials, name?: string | null
): Promise<string | null> {
  const n = (name ?? "").trim();
  if (!n) return null;
  const rows = await queryQBO(
    companyId, appCreds, companyCreds,
    `SELECT Id FROM Account WHERE Name = '${escapeQBOString(n)}' AND Active = true`, "Account"
  );
  return rows && rows.length > 0 ? String(rows[0].Id) : null;
}

export async function findExpenseAccountId(
  companyId: string, appCreds: QBOAppCredentials, companyCreds: QBOCompanyCredentials, configuredName?: string | null
): Promise<string | null> {
  const name = (configuredName ?? "").trim();
  if (name) return findAccountIdByName(companyId, appCreds, companyCreds, name);
  for (const acctType of ["Cost of Goods Sold", "Expense"]) {
    const rows = await queryQBO(
      companyId, appCreds, companyCreds,
      `SELECT Id FROM Account WHERE AccountType = '${acctType}' AND Active = true MAXRESULTS 1`, "Account"
    );
    if (rows && rows.length > 0) return String(rows[0].Id);
  }
  return null;
}

/**
 * Resolves an Item by name → Id, creating a Service item (wired to the first
 * active income account) when absent. Returns null on failure.
 */
export async function findOrCreateItemId(
  companyId: string, appCreds: QBOAppCredentials, companyCreds: QBOCompanyCredentials, itemName?: string | null
): Promise<string | null> {
  const name = (itemName ?? "").trim() || "Services";
  const found = await queryQBO(
    companyId, appCreds, companyCreds,
    `SELECT Id FROM Item WHERE Name = '${escapeQBOString(name)}'`, "Item"
  );
  if (found && found.length > 0) return String(found[0].Id);
  const incomeRows = await queryQBO(
    companyId, appCreds, companyCreds,
    `SELECT Id FROM Account WHERE AccountType = 'Income' AND Active = true MAXRESULTS 1`, "Account"
  );
  if (!incomeRows || incomeRows.length === 0) return null;
  const { status, json } = await callQBO(
    companyId, appCreds, companyCreds, "POST", "item",
    { Name: name, Type: "Service", IncomeAccountRef: { value: String(incomeRows[0].Id) } }
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return status === 200 ? (String((json as any)?.Item?.Id ?? "") || null) : null;
}

// ── Schedule-of-Values line mapping (P1: line detail, job costing, retainage) ──
//
// A single normalized SOV line shape feeds every transaction. Each line maps to
// one QBO line; its budget code resolves (via QBO_BUDGET_CODE_MAP) to an
// Account / Class / Item so costs and revenue are tracked by cost code. When a
// code has no mapping the line falls back to the transaction's default
// account/item, so syncing never blocks on an incomplete map.

export type QBOSovLine = {
  budgetCode: string;
  description: string;
  amount: number;        // scheduled value (header sync) or billed amount (invoice sync)
  qty?: number;
  uom?: string;
  unitCost?: number;
  retainageAmount?: number;  // withheld on this line (AR billing)
  materialsStored?: number;  // AIA G-703 stored materials (AR billing)
};

type QBOCodeRef = { accountId?: string; classId?: string; itemId?: string };

function roundMoney(n: number): number {
  return Number((Number.isFinite(n) ? n : 0).toFixed(2));
}

/** Per-company budget-code → QBO ref-name map (JSON in company_integrations or env). */
export async function getQBOBudgetCodeMap(
  companyId: string
): Promise<Record<string, { account?: string; class?: string; item?: string }>> {
  try {
    const supabase = getSupabase();
    const { data } = await supabase
      .from("company_integrations")
      .select("value")
      .eq("company_id", companyId)
      .eq("key", "QBO_BUDGET_CODE_MAP")
      .maybeSingle();
    const raw = (data?.value ?? process.env.QBO_BUDGET_CODE_MAP ?? "").trim();
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * Resolves a Class by exact Name → Id, creating it when absent. Best-effort:
 * returns null (caller omits ClassRef) when class tracking is disabled in the
 * QBO company, so an unconfigured realm never fails the whole sync.
 */
export async function findOrCreateClassId(
  companyId: string, appCreds: QBOAppCredentials, companyCreds: QBOCompanyCredentials, className?: string | null
): Promise<string | null> {
  const name = (className ?? "").trim();
  if (!name) return null;
  const found = await queryQBO(
    companyId, appCreds, companyCreds,
    `SELECT Id FROM Class WHERE Name = '${escapeQBOString(name)}'`, "Class"
  );
  if (found && found.length > 0) return String(found[0].Id);
  const { status, json } = await callQBO(
    companyId, appCreds, companyCreds, "POST", "class", { Name: name }
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return status === 200 ? (String((json as any)?.Class?.Id ?? "") || null) : null;
}

/**
 * Resolves the per-line Account/Class/Item refs for the budget codes in use.
 * Only codes present in `map` are resolved; everything else falls back to
 * transaction defaults at line-build time.
 */
export async function resolveCodeRefs(
  companyId: string, appCreds: QBOAppCredentials, companyCreds: QBOCompanyCredentials,
  codes: string[],
  map: Record<string, { account?: string; class?: string; item?: string }>
): Promise<Record<string, QBOCodeRef>> {
  const out: Record<string, QBOCodeRef> = {};
  const unique = Array.from(new Set(codes.map((c) => (c ?? "").trim()).filter(Boolean)));
  for (const code of unique) {
    const entry = map[code];
    if (!entry) continue;
    const ref: QBOCodeRef = {};
    if (entry.account) { const id = await findAccountIdByName(companyId, appCreds, companyCreds, entry.account); if (id) ref.accountId = id; }
    if (entry.class)   { const id = await findOrCreateClassId(companyId, appCreds, companyCreds, entry.class);   if (id) ref.classId = id; }
    if (entry.item)    { const id = await findOrCreateItemId(companyId, appCreds, companyCreds, entry.item);      if (id) ref.itemId = id; }
    out[code] = ref;
  }
  return out;
}

/**
 * Resolves (creating if needed) a "Retainage" Service item wired to the given
 * retainage account name. Returns null if the account can't be found, so
 * retainage lines are only emitted for realms that have configured the account.
 */
async function findOrCreateRetainageItemId(
  companyId: string, appCreds: QBOAppCredentials, companyCreds: QBOCompanyCredentials, accountName?: string | null
): Promise<string | null> {
  const acctId = await findAccountIdByName(companyId, appCreds, companyCreds, accountName);
  if (!acctId) return null;
  const found = await queryQBO(
    companyId, appCreds, companyCreds,
    `SELECT Id FROM Item WHERE Name = 'Retainage'`, "Item"
  );
  if (found && found.length > 0) return String(found[0].Id);
  const { status, json } = await callQBO(
    companyId, appCreds, companyCreds, "POST", "item",
    { Name: "Retainage", Type: "Service", IncomeAccountRef: { value: acctId } }
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return status === 200 ? (String((json as any)?.Item?.Id ?? "") || null) : null;
}

function lineDescription(line: QBOSovLine): string {
  return line.budgetCode ? `${line.budgetCode} — ${line.description}` : line.description;
}

/** Account-based expense line (Bills). Falls back to the project Class when the
 *  budget-code map doesn't supply one, so every cost line stays job-tracked. */
function buildBillLine(
  line: QBOSovLine, ref: QBOCodeRef, defaultAccountId: string, defaultClassId?: string | null
): Record<string, unknown> {
  const detail: Record<string, unknown> = { AccountRef: { value: ref.accountId ?? defaultAccountId } };
  const classId = ref.classId ?? defaultClassId;
  if (classId) detail.ClassRef = { value: classId };
  return {
    DetailType: "AccountBasedExpenseLineDetail",
    Amount: roundMoney(line.amount),
    Description: lineDescription(line),
    AccountBasedExpenseLineDetail: detail,
  };
}

/** Item-based line (PurchaseOrder) or sales line (Invoice). Preserves qty/unit when consistent. */
function buildItemLine(
  line: QBOSovLine, ref: QBOCodeRef, defaultItemId: string,
  detailType: "ItemBasedExpenseLineDetail" | "SalesItemLineDetail",
  defaultClassId?: string | null
): Record<string, unknown> {
  const amount = roundMoney(line.amount);
  let qty = 1;
  let unitPrice = amount;
  if (line.qty && line.qty > 0 && line.unitCost && line.unitCost > 0
      && Math.abs(line.qty * line.unitCost - line.amount) < 0.01) {
    qty = line.qty;
    unitPrice = roundMoney(line.unitCost);
  }
  const detail: Record<string, unknown> = { ItemRef: { value: ref.itemId ?? defaultItemId }, Qty: qty, UnitPrice: unitPrice };
  const classId = ref.classId ?? defaultClassId;
  if (classId) detail.ClassRef = { value: classId };
  return {
    DetailType: detailType,
    Amount: amount,
    Description: lineDescription(line),
    [detailType]: detail,
  };
}

/**
 * Resolves the project's Class Id for job costing (auto-created best-effort by
 * findOrCreateClassId; realms without class tracking return null and the
 * ClassRef is simply omitted). Gated by QBO_PROJECT_TRACKING ("none" disables).
 */
async function resolveProjectClassId(
  companyId: string, appCreds: QBOAppCredentials, companyCreds: QBOCompanyCredentials,
  config: QBOPostingConfig, projectName?: string | null
): Promise<string | null> {
  if (config.projectTracking === "none") return null;
  const name = (projectName ?? "").trim();
  if (!name) return null;
  return findOrCreateClassId(companyId, appCreds, companyCreds, name);
}

/** Free-form multi-line address → QBO PhysicalAddress (Line1..Line5). */
function parseFreeFormAddress(text?: string | null): Record<string, string> | null {
  const lines = (text ?? "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 5);
  if (lines.length === 0) return null;
  const addr: Record<string, string> = {};
  lines.forEach((l, i) => { addr[`Line${i + 1}`] = l; });
  return addr;
}

// ── Commitment sync ───────────────────────────────────────────────────────────

export type QBOCommitmentPayload = {
  id: string;
  type: "subcontract" | "purchase_order";
  number: number;
  title: string;
  contract_company: string;
  original_contract_amount: number;
  status: string;
  project_id: string;
  // Approved change orders (G8) — lump-sum fallback posts the revised amount.
  approved_change_orders?: number | null;
  // Document dates (P1 G9) — fall back to today when absent.
  start_date?: string | null;
  estimated_completion?: string | null;
  contract_date?: string | null;
  issued_on_date?: string | null;
  delivery_date?: string | null;
  // Terms & shipping (G6 / G12).
  payment_terms?: string | null;
  ship_to?: string | null;
  ship_via?: string | null;
  bill_to?: string | null;
  // Project context (G3 class job costing, G7 DocNumber prefix).
  project_name?: string | null;
  project_number?: string | null;
  // Directory contact details used to enrich an auto-created Vendor (G2).
  vendorDetails?: QBOPartyDetails | null;
  // Schedule of Values (P1 G13) — one QBO line per item when present.
  sovLines?: QBOSovLine[];
};

/** True for statuses that should remove/close the QBO document (G11). */
function isDeadStatus(status?: string | null): boolean {
  const s = (status ?? "").trim().toLowerCase();
  return s === "void" || s === "terminated";
}

/**
 * Creates or updates a Bill (subcontract) / PurchaseOrder in QuickBooks Online.
 *
 * Idempotency: pass `existingQboId` to update an existing record. We always
 * fetch the current SyncToken from QBO before updating (stale tokens are
 * rejected by Intuit). If the existing record can't be found, falls back to
 * creating a new one.
 *
 * The vendor is matched by display name; if QBO can't resolve it the sync
 * still proceeds using the name as a ref.
 */
export async function syncCommitmentToQBO(
  companyId: string,
  appCreds: QBOAppCredentials,
  companyCreds: QBOCompanyCredentials,
  commitment: QBOCommitmentPayload,
  existingQboId?: string | null
): Promise<QBOResult> {
  const today = new Date().toISOString().slice(0, 10);
  // Lump-sum fallback posts the REVISED amount (original + approved COs) so the
  // commitment and prime-contract syncs follow the same rule (G8).
  const amount = Number(
    (commitment.original_contract_amount + (commitment.approved_change_orders ?? 0)).toFixed(2)
  );
  const entity = commitment.type === "subcontract" ? "bill" : "purchaseorder";
  const docLabel = commitment.type === "subcontract" ? "Bill" : "Purchase Order";

  // ── Void / terminated (G11): remove or close the QBO doc instead of re-posting ─
  if (isDeadStatus(commitment.status)) {
    if (!existingQboId) {
      // Never synced — nothing exists in QBO to remove.
      return { ok: true, id: "", action: "skipped", rawResponse: "" };
    }
    try {
      const syncToken = await fetchQBOSyncToken(companyId, appCreds, companyCreds, entity, existingQboId);
      if (syncToken === null) {
        // Already gone on the QBO side.
        return { ok: true, id: "", action: "deleted", rawResponse: "" };
      }
      if (commitment.type === "subcontract") {
        // QBO Bills cannot be voided — delete the document.
        const { status, json, rawText } = await callQBO(
          companyId, appCreds, companyCreds, "POST", "bill?operation=delete",
          { Id: existingQboId, SyncToken: syncToken }
        );
        if (status !== 200) return { ok: false, error: extractQBOError(json, rawText), rawResponse: rawText.slice(0, 8000) };
        return { ok: true, id: "", action: "deleted", rawResponse: rawText.slice(0, 8000) };
      }
      // Purchase orders are closed, not deleted, so the audit trail survives.
      const { status, json, rawText } = await callQBO(
        companyId, appCreds, companyCreds, "POST", "purchaseorder?operation=update",
        { Id: existingQboId, SyncToken: syncToken, sparse: true, POStatus: "Closed" }
      );
      if (status !== 200) return { ok: false, error: extractQBOError(json, rawText), rawResponse: rawText.slice(0, 8000) };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const po = (json as any)?.PurchaseOrder;
      return {
        ok: true, id: existingQboId, action: "closed",
        syncToken: po?.SyncToken !== undefined ? String(po.SyncToken) : undefined,
        financials: po ? extractFinancials(po) : undefined,
        rawResponse: rawText.slice(0, 8000),
      };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Network error", rawResponse: "" };
    }
  }

  // QBO requires a vendor on every Bill / Purchase Order.
  const vendorName = (commitment.contract_company ?? "").trim();
  if (!vendorName) {
    return {
      ok: false, validation: true,
      error: `This commitment has no Contract Company, and QuickBooks requires a vendor on every ${docLabel}. Edit the commitment, set the Contract Company, then sync again.`,
      rawResponse: "",
    };
  }

  // Resolve references to QBO Ids (post by value, not name).
  const vendor = await findOrCreateVendorId(companyId, appCreds, companyCreds, vendorName, commitment.vendorDetails);
  if (!vendor.id) {
    return { ok: false, error: `Could not resolve or create QBO vendor "${vendorName}": ${vendor.error}`, rawResponse: "" };
  }
  const vendorId = vendor.id;
  const config = await getQBOPostingConfig(companyId);
  const docNumber = buildQBODocNumber(commitment.number, commitment.project_number, config.docNumberPrefix);
  const projectClassId = await resolveProjectClassId(companyId, appCreds, companyCreds, config, commitment.project_name);
  const termId = await findTermId(companyId, appCreds, companyCreds, commitment.payment_terms);

  // Resolve per-line cost-code refs (Account/Class/Item) for any mapped codes.
  const sovLines = commitment.sovLines ?? [];
  const codeRefs = sovLines.length
    ? await resolveCodeRefs(companyId, appCreds, companyCreds, sovLines.map((l) => l.budgetCode), await getQBOBudgetCodeMap(companyId))
    : {};
  const refFor = (code: string): QBOCodeRef => codeRefs[(code ?? "").trim()] ?? {};

  // Free-text context QBO has no structured field for (terms kept here too when
  // they don't match a QBO Term, so nothing the PM entered is lost).
  const noteLines = [
    commitment.title,
    !termId && commitment.payment_terms ? `Payment Terms: ${commitment.payment_terms}` : null,
  ];

  // For updates, fetch the latest SyncToken from QBO
  let syncToken: string | null = null;
  if (existingQboId) {
    syncToken = await fetchQBOSyncToken(companyId, appCreds, companyCreds, entity, existingQboId);
    if (syncToken === null) {
      // Record was deleted on QBO side — fall through to create
      existingQboId = null;
    }
  }

  try {
    if (commitment.type === "subcontract") {
      const expenseAccountId = await findExpenseAccountId(companyId, appCreds, companyCreds, config.expenseAccountName);
      if (!expenseAccountId) {
        return { ok: false, error: "No QBO expense account found. Set QBO_AP_EXPENSE_ACCOUNT to a valid expense or COGS account.", rawResponse: "" };
      }
      const lines = sovLines.length
        ? sovLines.map((l) => buildBillLine(l, refFor(l.budgetCode), expenseAccountId, projectClassId))
        : [buildBillLine({ budgetCode: "", description: commitment.title, amount }, {}, expenseAccountId, projectClassId)];
      const basePayload: Record<string, unknown> = {
        VendorRef: { value: vendorId },
        TxnDate: commitment.start_date || today,
        DocNumber: docNumber,
        PrivateNote: noteLines.filter(Boolean).join("\n"),
        Line: lines,
      };
      if (commitment.estimated_completion) basePayload.DueDate = commitment.estimated_completion;
      if (termId) basePayload.SalesTermRef = { value: termId };
      const path = existingQboId ? "bill?operation=update" : "bill";
      const payload = existingQboId
        ? { ...basePayload, Id: existingQboId, SyncToken: syncToken, sparse: true }
        : basePayload;

      const { status, json, rawText } = await callQBO(
        companyId, appCreds, companyCreds, "POST", path, payload
      );

      if (status !== 200) return { ok: false, error: extractQBOError(json, rawText), rawResponse: rawText.slice(0, 8000) };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const bill = (json as any)?.Bill;
      const id = String(bill?.Id ?? "");
      const newSyncToken = bill?.SyncToken !== undefined ? String(bill.SyncToken) : undefined;
      if (!id) return { ok: false, error: "QBO returned no Bill Id", rawResponse: rawText.slice(0, 8000) };
      return {
        ok: true, id, syncToken: newSyncToken, vendorId,
        financials: extractFinancials(bill),
        rawResponse: rawText.slice(0, 8000),
      };

    } else {
      const itemId = await findOrCreateItemId(companyId, appCreds, companyCreds, config.itemName);
      if (!itemId) {
        return { ok: false, error: "Could not resolve or create a QBO item for the purchase order line.", rawResponse: "" };
      }
      const lines = sovLines.length
        ? sovLines.map((l) => buildItemLine(l, refFor(l.budgetCode), itemId, "ItemBasedExpenseLineDetail", projectClassId))
        : [buildItemLine({ budgetCode: "", description: commitment.title, amount }, {}, itemId, "ItemBasedExpenseLineDetail", projectClassId)];
      // Ship Via / Bill To have no structured PurchaseOrder fields — keep them
      // in the note alongside any unmatched payment terms (G12).
      const poNoteLines = [
        ...noteLines,
        commitment.ship_via ? `Ship Via: ${commitment.ship_via}` : null,
        commitment.bill_to ? `Bill To: ${commitment.bill_to}` : null,
      ];
      const basePayload: Record<string, unknown> = {
        VendorRef: { value: vendorId },
        TxnDate: commitment.issued_on_date || commitment.contract_date || today,
        DocNumber: docNumber,
        PrivateNote: poNoteLines.filter(Boolean).join("\n"),
        Line: lines,
      };
      const shipAddr = parseFreeFormAddress(commitment.ship_to);
      if (shipAddr) basePayload.ShipAddr = shipAddr;
      if (commitment.delivery_date) basePayload.DueDate = commitment.delivery_date;
      if (termId) basePayload.SalesTermRef = { value: termId };
      const path = existingQboId ? "purchaseorder?operation=update" : "purchaseorder";
      const payload = existingQboId
        ? { ...basePayload, Id: existingQboId, SyncToken: syncToken, sparse: true }
        : basePayload;

      const { status, json, rawText } = await callQBO(
        companyId, appCreds, companyCreds, "POST", path, payload
      );

      if (status !== 200) return { ok: false, error: extractQBOError(json, rawText), rawResponse: rawText.slice(0, 8000) };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const po = (json as any)?.PurchaseOrder;
      const id = String(po?.Id ?? "");
      const newSyncToken = po?.SyncToken !== undefined ? String(po.SyncToken) : undefined;
      if (!id) return { ok: false, error: "QBO returned no PurchaseOrder Id", rawResponse: rawText.slice(0, 8000) };
      return {
        ok: true, id, syncToken: newSyncToken, vendorId,
        financials: extractFinancials(po),
        rawResponse: rawText.slice(0, 8000),
      };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Network error";
    return { ok: false, error: msg, rawResponse: "" };
  }
}

// ── Prime contract sync ───────────────────────────────────────────────────────

export type QBOPrimeContractPayload = {
  id: string;
  contract_number: number;
  title: string;
  owner_client: string;
  contractor: string;
  architect_engineer: string;
  description: string;
  original_contract_amount: number;
  approved_change_orders: number;
  default_retainage: number;
  status: string;
  executed: boolean;
  start_date: string | null;
  estimated_completion_date: string | null;
  // Project context (G3 class job costing, G7 DocNumber prefix).
  project_name?: string | null;
  project_number?: string | null;
  // Directory contact details used to enrich an auto-created Customer (G2).
  customerDetails?: QBOPartyDetails | null;
  // Schedule of Values (P1 G13) — one QBO line per item when present.
  sovLines?: QBOSovLine[];
};

/**
 * Creates an Invoice in QuickBooks Online representing a prime contract (AR side).
 * Sends revised contract amount (original + approved COs), start/due dates,
 * and a private note containing contractor, architect, retainage, and description.
 */
export async function syncPrimeContractToQBO(
  companyId: string,
  appCreds: QBOAppCredentials,
  companyCreds: QBOCompanyCredentials,
  contract: QBOPrimeContractPayload,
  existingQboId?: string | null
): Promise<QBOResult> {
  const today = new Date().toISOString().slice(0, 10);
  const revisedAmount = Number(
    (contract.original_contract_amount + (contract.approved_change_orders ?? 0)).toFixed(2)
  );

  const privateNote = [
    contract.description,
    contract.contractor         ? `Contractor: ${contract.contractor}`                   : null,
    contract.architect_engineer ? `Architect/Engineer: ${contract.architect_engineer}`   : null,
    contract.default_retainage  ? `Retainage: ${contract.default_retainage}%`            : null,
    contract.executed           ? "Executed: Yes"                                        : "Executed: No",
    `Status: ${contract.status}`,
  ].filter(Boolean).join("\n");

  // ── Void / terminated (G11): void the AR Invoice instead of re-posting ───────
  if (isDeadStatus(contract.status)) {
    if (!existingQboId) {
      return { ok: true, id: "", action: "skipped", rawResponse: "" };
    }
    try {
      const syncToken = await fetchQBOSyncToken(companyId, appCreds, companyCreds, "invoice", existingQboId);
      if (syncToken === null) {
        return { ok: true, id: "", action: "deleted", rawResponse: "" }; // already gone on QBO side
      }
      const { status, json, rawText } = await callQBO(
        companyId, appCreds, companyCreds, "POST", "invoice?operation=void",
        { Id: existingQboId, SyncToken: syncToken }
      );
      if (status !== 200) return { ok: false, error: extractQBOError(json, rawText), rawResponse: rawText.slice(0, 8000) };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const inv = (json as any)?.Invoice;
      return {
        ok: true, id: existingQboId, action: "voided",
        syncToken: inv?.SyncToken !== undefined ? String(inv.SyncToken) : undefined,
        financials: inv ? extractFinancials(inv) : undefined,
        rawResponse: rawText.slice(0, 8000),
      };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Network error", rawResponse: "" };
    }
  }

  // QBO requires a customer on every Invoice.
  const customerName = (contract.owner_client ?? "").trim();
  if (!customerName) {
    return {
      ok: false, validation: true,
      error: "This prime contract has no Owner/Client, and QuickBooks requires a customer on every Invoice. Edit the contract, set the Owner/Client, then sync again.",
      rawResponse: "",
    };
  }

  // Resolve references to QBO Ids (post by value, not name).
  const customer = await findOrCreateCustomerId(companyId, appCreds, companyCreds, customerName, contract.customerDetails);
  if (!customer.id) {
    return { ok: false, error: `Could not resolve or create QBO customer "${customerName}": ${customer.error}`, rawResponse: "" };
  }
  const customerId = customer.id;
  const config = await getQBOPostingConfig(companyId);
  const itemId = await findOrCreateItemId(companyId, appCreds, companyCreds, config.itemName);
  if (!itemId) {
    return { ok: false, error: "Could not resolve or create a QBO item for the invoice line.", rawResponse: "" };
  }
  const docNumber = buildQBODocNumber(contract.contract_number, contract.project_number, config.docNumberPrefix);
  const projectClassId = await resolveProjectClassId(companyId, appCreds, companyCreds, config, contract.project_name);

  // Resolve per-line cost-code refs (Class/Item) for any mapped codes.
  const sovLines = contract.sovLines ?? [];
  const codeRefs = sovLines.length
    ? await resolveCodeRefs(companyId, appCreds, companyCreds, sovLines.map((l) => l.budgetCode), await getQBOBudgetCodeMap(companyId))
    : {};
  const refFor = (code: string): QBOCodeRef => codeRefs[(code ?? "").trim()] ?? {};

  // For updates, fetch the latest SyncToken from QBO
  let syncToken: string | null = null;
  if (existingQboId) {
    syncToken = await fetchQBOSyncToken(companyId, appCreds, companyCreds, "invoice", existingQboId);
    if (syncToken === null) existingQboId = null; // record gone on QBO side → recreate
  }

  try {
    const lines = sovLines.length
      ? sovLines.map((l) => buildItemLine(l, refFor(l.budgetCode), itemId, "SalesItemLineDetail", projectClassId))
      : [buildItemLine({ budgetCode: "", description: contract.title, amount: revisedAmount }, {}, itemId, "SalesItemLineDetail", projectClassId)];
    const basePayload: Record<string, unknown> = {
      CustomerRef: { value: customerId },
      TxnDate: contract.start_date ?? today,
      DueDate: contract.estimated_completion_date ?? undefined,
      DocNumber: docNumber,
      PrivateNote: privateNote,
      CustomerMemo: { value: contract.description || contract.title },
      Line: lines,
    };

    // Remove undefined values so QBO doesn't reject
    if (!basePayload.DueDate) delete basePayload.DueDate;

    const path = existingQboId ? "invoice?operation=update" : "invoice";
    const payload = existingQboId
      ? { ...basePayload, Id: existingQboId, SyncToken: syncToken, sparse: true }
      : basePayload;

    const { status, json, rawText } = await callQBO(
      companyId, appCreds, companyCreds, "POST", path, payload
    );

    if (status !== 200) return { ok: false, error: extractQBOError(json, rawText), rawResponse: rawText.slice(0, 8000) };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const inv = (json as any)?.Invoice;
    const id = String(inv?.Id ?? "");
    const newSyncToken = inv?.SyncToken !== undefined ? String(inv.SyncToken) : undefined;
    if (!id) return { ok: false, error: "QBO returned no Invoice Id", rawResponse: rawText.slice(0, 8000) };
    return {
      ok: true, id, syncToken: newSyncToken, customerId,
      financials: extractFinancials(inv),
      rawResponse: rawText.slice(0, 8000),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Network error";
    return { ok: false, error: msg, rawResponse: "" };
  }
}

// ── AP Invoice sync ───────────────────────────────────────────────────────────

export type QBOAPInvoicePayload = {
  commitmentId: string;
  commitmentNumber: number;
  vendorName: string;
  description: string;
  lineItems: QBOSovLine[];
  retainagePct?: number; // % withheld; emits a negative line when QBO_RETAINAGE_PAYABLE_ACCOUNT is set
  projectName?: string | null;   // class job costing (G3)
  projectNumber?: string | null; // DocNumber prefix (G7)
  vendorDetails?: QBOPartyDetails | null;
};

export async function syncAPInvoiceToQBO(
  companyId: string,
  appCreds: QBOAppCredentials,
  companyCreds: QBOCompanyCredentials,
  invoice: QBOAPInvoicePayload,
  existingQboId?: string | null
): Promise<QBOResult> {
  const today = new Date().toISOString().slice(0, 10);

  // QBO requires a vendor on every Bill.
  const vendorName = (invoice.vendorName ?? "").trim();
  if (!vendorName) {
    return {
      ok: false, validation: true,
      error: "This commitment has no Contract Company, and QuickBooks requires a vendor on every Bill. Edit the commitment, set the Contract Company, then sync again.",
      rawResponse: "",
    };
  }

  // Resolve references to QBO Ids (post by value, not name).
  const vendor = await findOrCreateVendorId(companyId, appCreds, companyCreds, vendorName, invoice.vendorDetails);
  if (!vendor.id) {
    return { ok: false, error: `Could not resolve or create QBO vendor "${vendorName}": ${vendor.error}`, rawResponse: "" };
  }
  const vendorId = vendor.id;
  const config = await getQBOPostingConfig(companyId);
  const expenseAccountId = await findExpenseAccountId(companyId, appCreds, companyCreds, config.expenseAccountName);
  if (!expenseAccountId) {
    return { ok: false, error: "No QBO expense account found. Set QBO_AP_EXPENSE_ACCOUNT to a valid expense or COGS account.", rawResponse: "" };
  }
  const projectClassId = await resolveProjectClassId(companyId, appCreds, companyCreds, config, invoice.projectName);
  const docNumber = buildQBODocNumber(invoice.commitmentNumber, invoice.projectNumber, config.docNumberPrefix);
  const codeRefs = await resolveCodeRefs(companyId, appCreds, companyCreds, invoice.lineItems.map((l) => l.budgetCode), await getQBOBudgetCodeMap(companyId));
  const refFor = (code: string): QBOCodeRef => codeRefs[(code ?? "").trim()] ?? {};

  let syncToken: string | null = null;
  if (existingQboId) {
    syncToken = await fetchQBOSyncToken(companyId, appCreds, companyCreds, "bill", existingQboId);
    if (syncToken === null) existingQboId = null;
  }

  try {
    const lines: Record<string, unknown>[] = invoice.lineItems.map((l) => buildBillLine(l, refFor(l.budgetCode), expenseAccountId, projectClassId));

    // Retainage withheld — negative line to the payable account (best-effort, config-gated).
    const pct = invoice.retainagePct ?? 0;
    if (pct > 0 && config.retainagePayableAccount) {
      const retAcctId = await findAccountIdByName(companyId, appCreds, companyCreds, config.retainagePayableAccount);
      const billed = invoice.lineItems.reduce((s, l) => s + l.amount, 0);
      const retainage = roundMoney((billed * pct) / 100);
      if (retAcctId && retainage > 0) {
        lines.push({
          DetailType: "AccountBasedExpenseLineDetail",
          Amount: -retainage,
          Description: `Retainage withheld (${pct}%)`,
          AccountBasedExpenseLineDetail: { AccountRef: { value: retAcctId } },
        });
      }
    }

    const basePayload: Record<string, unknown> = {
      VendorRef: { value: vendorId },
      TxnDate: today,
      DocNumber: docNumber,
      PrivateNote: invoice.description,
      Line: lines,
    };
    const path = existingQboId ? "bill?operation=update" : "bill";
    const payload = existingQboId
      ? { ...basePayload, Id: existingQboId, SyncToken: syncToken, sparse: true }
      : basePayload;

    const { status, json, rawText } = await callQBO(
      companyId, appCreds, companyCreds, "POST", path, payload
    );

    if (status !== 200) return { ok: false, error: extractQBOError(json, rawText), rawResponse: rawText.slice(0, 8000) };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bill = (json as any)?.Bill;
    const id = String(bill?.Id ?? "");
    const newSyncToken = bill?.SyncToken !== undefined ? String(bill.SyncToken) : undefined;
    if (!id) return { ok: false, error: "QBO returned no Bill Id", rawResponse: rawText.slice(0, 8000) };
    return {
      ok: true, id, syncToken: newSyncToken, vendorId,
      financials: extractFinancials(bill),
      rawResponse: rawText.slice(0, 8000),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Network error";
    return { ok: false, error: msg, rawResponse: "" };
  }
}

// ── AR Invoice sync ───────────────────────────────────────────────────────────

export type QBOARInvoicePayload = {
  contractId: string;
  contractNumber: number;
  customerName: string;
  description: string;
  lineItems: QBOSovLine[]; // per-line retainageAmount emits a negative retainage line; materialsStored adds a stored-materials line
  projectName?: string | null;   // class job costing (G3)
  projectNumber?: string | null; // DocNumber prefix (G7)
  customerDetails?: QBOPartyDetails | null;
};

export async function syncARInvoiceToQBO(
  companyId: string,
  appCreds: QBOAppCredentials,
  companyCreds: QBOCompanyCredentials,
  invoice: QBOARInvoicePayload,
  existingQboId?: string | null
): Promise<QBOResult> {
  const today = new Date().toISOString().slice(0, 10);

  // QBO requires a customer on every Invoice.
  const customerName = (invoice.customerName ?? "").trim();
  if (!customerName) {
    return {
      ok: false, validation: true,
      error: "This prime contract has no Owner/Client, and QuickBooks requires a customer on every Invoice. Edit the contract, set the Owner/Client, then sync again.",
      rawResponse: "",
    };
  }

  // Resolve references to QBO Ids (post by value, not name).
  const customer = await findOrCreateCustomerId(companyId, appCreds, companyCreds, customerName, invoice.customerDetails);
  if (!customer.id) {
    return { ok: false, error: `Could not resolve or create QBO customer "${customerName}": ${customer.error}`, rawResponse: "" };
  }
  const customerId = customer.id;
  const config = await getQBOPostingConfig(companyId);
  const itemId = await findOrCreateItemId(companyId, appCreds, companyCreds, config.itemName);
  if (!itemId) {
    return { ok: false, error: "Could not resolve or create a QBO item for the invoice line.", rawResponse: "" };
  }
  const projectClassId = await resolveProjectClassId(companyId, appCreds, companyCreds, config, invoice.projectName);
  const docNumber = buildQBODocNumber(invoice.contractNumber, invoice.projectNumber, config.docNumberPrefix);
  const codeRefs = await resolveCodeRefs(companyId, appCreds, companyCreds, invoice.lineItems.map((l) => l.budgetCode), await getQBOBudgetCodeMap(companyId));
  const refFor = (code: string): QBOCodeRef => codeRefs[(code ?? "").trim()] ?? {};

  let syncToken: string | null = null;
  if (existingQboId) {
    syncToken = await fetchQBOSyncToken(companyId, appCreds, companyCreds, "invoice", existingQboId);
    if (syncToken === null) existingQboId = null;
  }

  try {
    const lines: Record<string, unknown>[] = invoice.lineItems.map((l) => buildItemLine(l, refFor(l.budgetCode), itemId, "SalesItemLineDetail", projectClassId));

    // Materials presently stored (AIA G-703 column F) — billed alongside work
    // completed as its own line so the owner invoice matches the pay app.
    const totalMaterialsStored = roundMoney(invoice.lineItems.reduce((s, l) => s + (l.materialsStored ?? 0), 0));
    if (totalMaterialsStored > 0) {
      lines.push(buildItemLine(
        { budgetCode: "", description: "Materials presently stored", amount: totalMaterialsStored },
        {}, itemId, "SalesItemLineDetail", projectClassId
      ));
    }

    // Retainage withheld — negative line via a "Retainage" item wired to the
    // receivable account (best-effort, config-gated).
    const totalRetainage = roundMoney(invoice.lineItems.reduce((s, l) => s + (l.retainageAmount ?? 0), 0));
    if (totalRetainage > 0 && config.retainageReceivableAccount) {
      const retItemId = await findOrCreateRetainageItemId(companyId, appCreds, companyCreds, config.retainageReceivableAccount);
      if (retItemId) {
        lines.push({
          DetailType: "SalesItemLineDetail",
          Amount: -totalRetainage,
          Description: "Retainage withheld",
          SalesItemLineDetail: { ItemRef: { value: retItemId }, Qty: 1, UnitPrice: -totalRetainage },
        });
      }
    }

    const basePayload: Record<string, unknown> = {
      CustomerRef: { value: customerId },
      TxnDate: today,
      DocNumber: docNumber,
      PrivateNote: invoice.description,
      Line: lines,
    };
    const path = existingQboId ? "invoice?operation=update" : "invoice";
    const payload = existingQboId
      ? { ...basePayload, Id: existingQboId, SyncToken: syncToken, sparse: true }
      : basePayload;

    const { status, json, rawText } = await callQBO(
      companyId, appCreds, companyCreds, "POST", path, payload
    );

    if (status !== 200) return { ok: false, error: extractQBOError(json, rawText), rawResponse: rawText.slice(0, 8000) };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const inv = (json as any)?.Invoice;
    const id = String(inv?.Id ?? "");
    const newSyncToken = inv?.SyncToken !== undefined ? String(inv.SyncToken) : undefined;
    if (!id) return { ok: false, error: "QBO returned no Invoice Id", rawResponse: rawText.slice(0, 8000) };
    return {
      ok: true, id, syncToken: newSyncToken, customerId,
      financials: extractFinancials(inv),
      rawResponse: rawText.slice(0, 8000),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Network error";
    return { ok: false, error: msg, rawResponse: "" };
  }
}

// ── Error extraction ──────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractQBOError(json: any, rawText: string): string {
  // QBO error shape: { Fault: { Error: [{ Message, Detail }] } }
  const errors = json?.Fault?.Error;
  if (Array.isArray(errors) && errors.length > 0) {
    const first = errors[0];
    return first?.Detail ?? first?.Message ?? "QuickBooks error";
  }
  if (typeof json?.message === "string") return json.message;
  return rawText.slice(0, 500) || "Unknown QuickBooks error";
}
