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

const QBO_BASE = "https://quickbooks.api.intuit.com/v3/company";
const QBO_TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
const QBO_MINOR_VERSION = "65";

// ── Credential types ──────────────────────────────────────────────────────────

export type QBOAppCredentials = {
  clientId: string | null;
  clientSecret: string | null;
};

export type QBOCompanyCredentials = {
  realmId: string | null;
  accessToken: string | null;
  refreshToken: string | null;
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
  const keys = ["QBO_REALM_ID", "QBO_ACCESS_TOKEN", "QBO_REFRESH_TOKEN"] as const;

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
    };
  } catch {
    return { realmId: null, accessToken: null, refreshToken: null };
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

// ── API call helper ───────────────────────────────────────────────────────────

export type QBOResult =
  | { ok: true; id: string; syncToken?: string; rawResponse: string }
  | { ok: false; error: string; rawResponse: string };

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
  const url = `${QBO_BASE}/${realmId}/${path}?minorversion=${QBO_MINOR_VERSION}`;

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
      `query?query=${query}&minorversion=${QBO_MINOR_VERSION}`.replace(`?query=`, "query?query="),
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
      `query?query=${query}&minorversion=${QBO_MINOR_VERSION}`.replace(`?query=`, "query?query="),
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
};

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
  const amount = Number(commitment.original_contract_amount.toFixed(2));
  const entity = commitment.type === "subcontract" ? "bill" : "purchaseorder";

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
      const basePayload: Record<string, unknown> = {
        VendorRef: { name: commitment.contract_company },
        TxnDate: today,
        DocNumber: String(commitment.number),
        PrivateNote: commitment.title,
        Line: [
          {
            DetailType: "AccountBasedExpenseLineDetail",
            Amount: amount,
            Description: commitment.title,
            AccountBasedExpenseLineDetail: {
              AccountRef: { name: "Accounts Payable (A/P)" },
            },
          },
        ],
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
      return { ok: true, id, syncToken: newSyncToken, rawResponse: rawText.slice(0, 8000) };

    } else {
      const basePayload: Record<string, unknown> = {
        VendorRef: { name: commitment.contract_company },
        TxnDate: today,
        DocNumber: String(commitment.number),
        PrivateNote: commitment.title,
        Line: [
          {
            DetailType: "ItemBasedExpenseLineDetail",
            Amount: amount,
            Description: commitment.title,
            ItemBasedExpenseLineDetail: {
              ItemRef: { name: "Services" },
              Qty: 1,
              UnitPrice: amount,
            },
          },
        ],
      };
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
      return { ok: true, id, syncToken: newSyncToken, rawResponse: rawText.slice(0, 8000) };
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

  // For updates, fetch the latest SyncToken from QBO
  let syncToken: string | null = null;
  if (existingQboId) {
    syncToken = await fetchQBOSyncToken(companyId, appCreds, companyCreds, "invoice", existingQboId);
    if (syncToken === null) existingQboId = null; // record gone on QBO side → recreate
  }

  try {
    const basePayload: Record<string, unknown> = {
      CustomerRef: { name: contract.owner_client },
      TxnDate: contract.start_date ?? today,
      DueDate: contract.estimated_completion_date ?? undefined,
      DocNumber: String(contract.contract_number),
      PrivateNote: privateNote,
      CustomerMemo: { value: contract.description || contract.title },
      Line: [
        {
          DetailType: "SalesItemLineDetail",
          Amount: revisedAmount,
          Description: contract.title,
          SalesItemLineDetail: {
            ItemRef: { name: "Services" },
            Qty: 1,
            UnitPrice: revisedAmount,
          },
        },
      ],
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
    return { ok: true, id, syncToken: newSyncToken, rawResponse: rawText.slice(0, 8000) };
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
  lineItems: { description: string; amount: number }[];
};

export async function syncAPInvoiceToQBO(
  companyId: string,
  appCreds: QBOAppCredentials,
  companyCreds: QBOCompanyCredentials,
  invoice: QBOAPInvoicePayload,
  existingQboId?: string | null
): Promise<QBOResult> {
  const today = new Date().toISOString().slice(0, 10);

  let syncToken: string | null = null;
  if (existingQboId) {
    syncToken = await fetchQBOSyncToken(companyId, appCreds, companyCreds, "bill", existingQboId);
    if (syncToken === null) existingQboId = null;
  }

  try {
    const basePayload: Record<string, unknown> = {
      VendorRef: { name: invoice.vendorName },
      TxnDate: today,
      DocNumber: String(invoice.commitmentNumber),
      PrivateNote: invoice.description,
      Line: invoice.lineItems.map((li) => ({
        DetailType: "AccountBasedExpenseLineDetail",
        Amount: Number(li.amount.toFixed(2)),
        Description: li.description,
        AccountBasedExpenseLineDetail: {
          AccountRef: { name: "Accounts Payable (A/P)" },
        },
      })),
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
    return { ok: true, id, syncToken: newSyncToken, rawResponse: rawText.slice(0, 8000) };
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
  lineItems: { description: string; amount: number }[];
};

export async function syncARInvoiceToQBO(
  companyId: string,
  appCreds: QBOAppCredentials,
  companyCreds: QBOCompanyCredentials,
  invoice: QBOARInvoicePayload,
  existingQboId?: string | null
): Promise<QBOResult> {
  const today = new Date().toISOString().slice(0, 10);

  let syncToken: string | null = null;
  if (existingQboId) {
    syncToken = await fetchQBOSyncToken(companyId, appCreds, companyCreds, "invoice", existingQboId);
    if (syncToken === null) existingQboId = null;
  }

  try {
    const basePayload: Record<string, unknown> = {
      CustomerRef: { name: invoice.customerName },
      TxnDate: today,
      DocNumber: String(invoice.contractNumber),
      PrivateNote: invoice.description,
      Line: invoice.lineItems.map((li) => ({
        DetailType: "SalesItemLineDetail",
        Amount: Number(li.amount.toFixed(2)),
        Description: li.description,
        SalesItemLineDetail: {
          ItemRef: { name: "Services" },
          Qty: 1,
          UnitPrice: Number(li.amount.toFixed(2)),
        },
      })),
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
    return { ok: true, id, syncToken: newSyncToken, rawResponse: rawText.slice(0, 8000) };
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
