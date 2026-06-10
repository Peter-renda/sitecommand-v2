/**
 * Sage 300 CRE (Construction & Real Estate) integration via the Agave unified API.
 *
 * Sage 300 CRE (formerly Timberline) is an on-premise Windows accounting system
 * with no native cloud REST API. We reach it through Agave (https://agaveapi.com),
 * a unified connector that runs an on-premise agent on the customer's server and
 * exposes a normalized cloud REST API. SiteCommand talks only to Agave; Agave
 * talks to the customer's Sage 300 CRE install.
 *
 * Auth model (Agave):
 *   - Client-Id + Client-Secret → identify SiteCommand's Agave app ("app credentials").
 *   - Account-Token             → identifies ONE company's connected Sage 300 CRE
 *                                 instance, obtained via the Agave Link flow.
 *   - API-Version header pins the Agave schema version.
 *
 * Credential lookup order (most → least specific), mirroring lib/quickbooks.ts:
 *   App creds (Client-Id/Secret): company_integrations → platform_settings → env
 *   Account token:                company_integrations (per company)
 *
 * Record mapping (Sage 300 CRE via Agave):
 *   commitment (subcontract|PO) → Purchase Order  POST/PUT /purchase-orders
 *   ap_invoice (sub pay app)    → AP Invoice       POST/PUT /ap-invoices
 *   prime_contract              → AR Invoice       POST/PUT /ar-invoices  (connector-dependent)
 *   ar_invoice (owner pay app)  → AR Invoice       POST/PUT /ar-invoices  (connector-dependent)
 *
 * Idempotency: the Agave object id is stored back on the local row
 * (sage300cre_id / sage300cre_ap_invoice_id / sage300cre_ar_invoice_id). Updates
 * PUT by that id; a 404 (record deleted on the source) falls back to a create.
 *
 * Field names on the write payloads follow Agave's unified accounting schema. The
 * vendor/customer must already exist in Sage 300 CRE — Agave is asked to resolve
 * them by name (the ERP, not the PM tool, is the system of record for parties).
 */

import { getSupabase } from "@/lib/supabase";

// Base + version are overridable for testing / future schema bumps.
const AGAVE_API_BASE =
  process.env.AGAVE_API_BASE?.trim().replace(/\/+$/, "") || "https://api.agaveapi.com";
const AGAVE_API_VERSION = process.env.AGAVE_API_VERSION?.trim() || "2021-11-21";

/** Source-system slug the customer selects in the Agave Link UI. */
export const SAGE300CRE_SOURCE_SYSTEM = "sage-300-cre";

// ── Credential types ────────────────────────────────────────────────────────

export type Sage300CreAppCredentials = {
  clientId: string | null;
  clientSecret: string | null;
};

export type Sage300CreCompanyCredentials = {
  accountToken: string | null;
};

// ── Credential helpers ──────────────────────────────────────────────────────

/**
 * Loads Agave app credentials. Company-level credentials take precedence over
 * platform-level ones, so a company can register its own Agave app without site
 * admin involvement.
 *
 * Lookup order: company_integrations → platform_settings → env vars
 */
export async function getSage300CreAppCredentials(
  companyId?: string
): Promise<Sage300CreAppCredentials> {
  try {
    const supabase = getSupabase();

    if (companyId) {
      const { data: companyData } = await supabase
        .from("company_integrations")
        .select("key, value")
        .eq("company_id", companyId)
        .in("key", ["SAGE300CRE_CLIENT_ID", "SAGE300CRE_CLIENT_SECRET"]);

      const companyMap: Record<string, string> = {};
      for (const row of companyData ?? []) companyMap[row.key] = row.value;

      if (companyMap.SAGE300CRE_CLIENT_ID && companyMap.SAGE300CRE_CLIENT_SECRET) {
        return {
          clientId: companyMap.SAGE300CRE_CLIENT_ID,
          clientSecret: companyMap.SAGE300CRE_CLIENT_SECRET,
        };
      }
    }

    const { data: platformData } = await supabase
      .from("platform_settings")
      .select("key, value")
      .in("key", ["SAGE300CRE_CLIENT_ID", "SAGE300CRE_CLIENT_SECRET"]);

    const platformMap: Record<string, string> = {};
    for (const row of platformData ?? []) platformMap[row.key] = row.value;

    return {
      clientId:
        platformMap.SAGE300CRE_CLIENT_ID ?? process.env.SAGE300CRE_CLIENT_ID ?? null,
      clientSecret:
        platformMap.SAGE300CRE_CLIENT_SECRET ?? process.env.SAGE300CRE_CLIENT_SECRET ?? null,
    };
  } catch {
    return {
      clientId: process.env.SAGE300CRE_CLIENT_ID ?? null,
      clientSecret: process.env.SAGE300CRE_CLIENT_SECRET ?? null,
    };
  }
}

/** Loads the per-company Agave account token from company_integrations. */
export async function getSage300CreCompanyCredentials(
  companyId: string
): Promise<Sage300CreCompanyCredentials> {
  try {
    const supabase = getSupabase();
    const { data } = await supabase
      .from("company_integrations")
      .select("key, value")
      .eq("company_id", companyId)
      .eq("key", "SAGE300CRE_ACCOUNT_TOKEN")
      .maybeSingle();

    return { accountToken: data?.value ?? process.env.SAGE300CRE_ACCOUNT_TOKEN ?? null };
  } catch {
    return { accountToken: process.env.SAGE300CRE_ACCOUNT_TOKEN ?? null };
  }
}

/** True when the Agave app (Client-Id/Secret) is configured. */
export function isSage300CreAppConfigured(app: Sage300CreAppCredentials): boolean {
  return !!(app.clientId && app.clientSecret);
}

/** True when the company has both app credentials and a connected account token. */
export function isSage300CreConnected(
  app: Sage300CreAppCredentials,
  company: Sage300CreCompanyCredentials
): boolean {
  return isSage300CreAppConfigured(app) && !!company.accountToken;
}

// ── Low-level Agave call ────────────────────────────────────────────────────

type AgaveResponse = { status: number; json: unknown; rawText: string };

/**
 * Makes an authenticated JSON request to the Agave unified API. `path` is the
 * resource path without a leading slash (e.g. "purchase-orders" or
 * "vendors/123"). The Account-Token header is included when present (it is
 * required for every call except the Link-token endpoints).
 */
async function callAgave(
  app: Sage300CreAppCredentials,
  company: Sage300CreCompanyCredentials,
  method: "GET" | "POST" | "PUT",
  path: string,
  body?: unknown
): Promise<AgaveResponse> {
  const headers: Record<string, string> = {
    "API-Version": AGAVE_API_VERSION,
    "Client-Id": app.clientId ?? "",
    "Client-Secret": app.clientSecret ?? "",
    Accept: "application/json",
  };
  if (company.accountToken) headers["Account-Token"] = company.accountToken;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  try {
    const res = await fetch(`${AGAVE_API_BASE}/${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const rawText = await res.text();
    let json: unknown = null;
    try {
      json = JSON.parse(rawText);
    } catch {
      /* non-JSON body */
    }
    return { status: res.status, json, rawText };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Network error";
    return { status: 0, json: null, rawText: `Failed to reach Agave: ${msg}` };
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractAgaveError(json: any, rawText: string): string {
  // Agave error bodies are typically { message } or { error } / { detail }.
  if (typeof json?.message === "string") return json.message;
  if (typeof json?.error === "string") return json.error;
  if (typeof json?.detail === "string") return json.detail;
  return rawText.slice(0, 500) || "Unknown Agave error";
}

// ── Agave Link (connect) ────────────────────────────────────────────────────

export type LinkTokenResult =
  | { ok: true; linkToken: string }
  | { ok: false; error: string };

/**
 * Creates a short-lived, single-use Link token used to launch Agave Link, where
 * the customer authenticates their on-premise Sage 300 CRE connector. Only the
 * app credentials are required (no account token yet).
 */
export async function createLinkToken(
  app: Sage300CreAppCredentials,
  referenceId: string
): Promise<LinkTokenResult> {
  const { status, json, rawText } = await callAgave(
    app,
    { accountToken: null },
    "POST",
    "link/token/create",
    { reference_id: referenceId }
  );
  if (status < 200 || status >= 300) {
    return { ok: false, error: extractAgaveError(json, rawText) };
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const linkToken = String((json as any)?.link_token ?? "");
  if (!linkToken) return { ok: false, error: "Agave returned no link_token" };
  return { ok: true, linkToken };
}

export type ExchangeResult =
  | { ok: true; accountToken: string }
  | { ok: false; error: string };

/**
 * Exchanges the public token returned by Agave Link for a durable Account Token,
 * which authenticates all subsequent data calls for that company's connection.
 */
export async function exchangePublicToken(
  app: Sage300CreAppCredentials,
  publicToken: string
): Promise<ExchangeResult> {
  const { status, json, rawText } = await callAgave(
    app,
    { accountToken: null },
    "POST",
    "link/token/exchange",
    { public_token: publicToken }
  );
  if (status < 200 || status >= 300) {
    return { ok: false, error: extractAgaveError(json, rawText) };
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const accountToken = String((json as any)?.account_token ?? "");
  if (!accountToken) return { ok: false, error: "Agave returned no account_token" };
  return { ok: true, accountToken };
}

// ── Party (vendor / customer) lookups ───────────────────────────────────────

export type Sage300CreParty = { id: string; name: string };

export type Sage300CrePartyResult =
  | { ok: true; parties: Sage300CreParty[] }
  | { ok: false; error: string };

/**
 * Reads a page of vendors or customers from the connected Sage 300 CRE company.
 * Agave list responses wrap rows in a `data` array.
 */
async function fetchParties(
  app: Sage300CreAppCredentials,
  company: Sage300CreCompanyCredentials,
  resource: "vendors" | "customers"
): Promise<Sage300CrePartyResult> {
  const { status, json, rawText } = await callAgave(
    app,
    company,
    "GET",
    `${resource}?page_size=500`
  );
  if (status < 200 || status >= 300) {
    return { ok: false, error: extractAgaveError(json, rawText) };
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (json as any)?.data ?? [];
  const parties: Sage300CreParty[] = (Array.isArray(rows) ? rows : [rows])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((r: any) => r?.id)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((r: any) => ({ id: String(r.id), name: String(r.name ?? r.id) }));
  return { ok: true, parties };
}

export function fetchSage300CreVendors(
  app: Sage300CreAppCredentials,
  company: Sage300CreCompanyCredentials
): Promise<Sage300CrePartyResult> {
  return fetchParties(app, company, "vendors");
}

export function fetchSage300CreCustomers(
  app: Sage300CreAppCredentials,
  company: Sage300CreCompanyCredentials
): Promise<Sage300CrePartyResult> {
  return fetchParties(app, company, "customers");
}

/**
 * Resolves a vendor/customer name to its Agave id by matching against the
 * source company's list (case-insensitive). Returns null when absent — we never
 * auto-create parties, since Sage 300 CRE is the system of record for them.
 */
async function resolvePartyId(
  app: Sage300CreAppCredentials,
  company: Sage300CreCompanyCredentials,
  resource: "vendors" | "customers",
  name: string
): Promise<string | null> {
  const wanted = (name ?? "").trim().toLowerCase();
  if (!wanted) return null;
  const result = await fetchParties(app, company, resource);
  if (!result.ok) return null;
  const match = result.parties.find((p) => p.name.trim().toLowerCase() === wanted);
  return match ? match.id : null;
}

// ── Shared line-item shaping ────────────────────────────────────────────────

export type Sage300CreSovLine = {
  budgetCode: string;
  description: string;
  amount: number;
  qty?: number;
  uom?: string;
  unitCost?: number;
};

function roundMoney(n: number): number {
  return Number((Number.isFinite(n) ? n : 0).toFixed(2));
}

/** One Agave line item per SOV line; the budget code is folded into the description. */
function toLineItem(line: Sage300CreSovLine): Record<string, unknown> {
  const description = line.budgetCode
    ? `${line.budgetCode} — ${line.description}`
    : line.description;
  return { description, amount: roundMoney(line.amount) };
}

// ── Create / update helper ──────────────────────────────────────────────────

export type Sage300CreResult =
  | { ok: true; id: string; rawResponse: string }
  | { ok: false; error: string; rawResponse: string };

/**
 * Creates (POST) or updates (PUT /{resource}/{id}) an Agave record. When an
 * existing id is supplied but the record is gone on the source (404), falls back
 * to a create so a deleted-on-Sage record is recreated rather than lost.
 */
async function upsertAgave(
  app: Sage300CreAppCredentials,
  company: Sage300CreCompanyCredentials,
  resource: string,
  body: Record<string, unknown>,
  existingId?: string | null
): Promise<Sage300CreResult> {
  async function create(): Promise<Sage300CreResult> {
    const { status, json, rawText } = await callAgave(app, company, "POST", resource, body);
    if (status >= 200 && status < 300) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const id = String((json as any)?.id ?? "");
      if (!id) {
        return { ok: false, error: `Agave returned no id for ${resource}`, rawResponse: rawText.slice(0, 8000) };
      }
      return { ok: true, id, rawResponse: rawText.slice(0, 8000) };
    }
    return { ok: false, error: extractAgaveError(json, rawText), rawResponse: rawText.slice(0, 8000) };
  }

  if (existingId) {
    const { status, json, rawText } = await callAgave(
      app,
      company,
      "PUT",
      `${resource}/${existingId}`,
      body
    );
    if (status === 404) return create(); // deleted on the source → recreate
    if (status >= 200 && status < 300) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const id = String((json as any)?.id ?? existingId);
      return { ok: true, id, rawResponse: rawText.slice(0, 8000) };
    }
    return { ok: false, error: extractAgaveError(json, rawText), rawResponse: rawText.slice(0, 8000) };
  }

  return create();
}

// ── Commitment sync (→ Purchase Order) ──────────────────────────────────────

export type Sage300CreCommitmentPayload = {
  id: string;
  type: "subcontract" | "purchase_order";
  number: number;
  title: string;
  contract_company: string;
  original_contract_amount: number;
  status: string;
  project_id: string;
  start_date?: string | null;
  estimated_completion?: string | null;
  contract_date?: string | null;
  issued_on_date?: string | null;
  delivery_date?: string | null;
  sovLines?: Sage300CreSovLine[];
};

/**
 * Pushes a commitment (subcontract or purchase order) to Sage 300 CRE as an
 * Agave Purchase Order. The vendor must already exist in Sage 300 CRE.
 */
export async function syncCommitmentToSage300Cre(
  app: Sage300CreAppCredentials,
  company: Sage300CreCompanyCredentials,
  commitment: Sage300CreCommitmentPayload,
  existingId?: string | null
): Promise<Sage300CreResult> {
  const today = new Date().toISOString().slice(0, 10);
  const vendorId = await resolvePartyId(app, company, "vendors", commitment.contract_company);
  if (!vendorId) {
    return {
      ok: false,
      error: `Vendor "${commitment.contract_company}" was not found in Sage 300 CRE. Create the vendor in Sage 300 CRE first, then re-sync.`,
      rawResponse: "",
    };
  }

  const lines =
    commitment.sovLines && commitment.sovLines.length
      ? commitment.sovLines.map(toLineItem)
      : [toLineItem({ budgetCode: "", description: commitment.title, amount: commitment.original_contract_amount })];

  const body: Record<string, unknown> = {
    vendor: vendorId,
    number: String(commitment.number),
    description: commitment.title,
    issued_date: commitment.issued_on_date || commitment.contract_date || commitment.start_date || today,
    amount: roundMoney(commitment.original_contract_amount),
    line_items: lines,
  };

  return upsertAgave(app, company, "purchase-orders", body, existingId);
}

// ── Prime contract sync (→ AR Invoice) ──────────────────────────────────────

export type Sage300CrePrimeContractPayload = {
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
  sovLines?: Sage300CreSovLine[];
};

/**
 * Pushes a prime contract to Sage 300 CRE as an Agave AR Invoice (revised
 * amount = original + approved COs). AR support depends on the Sage 300 CRE
 * connector configuration; an unsupported resource surfaces as a logged error.
 */
export async function syncPrimeContractToSage300Cre(
  app: Sage300CreAppCredentials,
  company: Sage300CreCompanyCredentials,
  contract: Sage300CrePrimeContractPayload,
  existingId?: string | null
): Promise<Sage300CreResult> {
  const today = new Date().toISOString().slice(0, 10);
  const customerId = await resolvePartyId(app, company, "customers", contract.owner_client);
  if (!customerId) {
    return {
      ok: false,
      error: `Customer "${contract.owner_client}" was not found in Sage 300 CRE. Create the customer in Sage 300 CRE first, then re-sync.`,
      rawResponse: "",
    };
  }

  const revisedAmount = roundMoney(
    contract.original_contract_amount + (contract.approved_change_orders ?? 0)
  );
  const lines =
    contract.sovLines && contract.sovLines.length
      ? contract.sovLines.map(toLineItem)
      : [toLineItem({ budgetCode: "", description: contract.title, amount: revisedAmount })];

  const body: Record<string, unknown> = {
    customer: customerId,
    number: String(contract.contract_number),
    description: contract.description || contract.title,
    issued_date: contract.start_date || today,
    amount: revisedAmount,
    line_items: lines,
  };

  return upsertAgave(app, company, "ar-invoices", body, existingId);
}

// ── AP Invoice sync (subcontractor pay application) ─────────────────────────

export type Sage300CreAPInvoicePayload = {
  commitmentId: string;
  commitmentNumber: number;
  vendorName: string;
  description: string;
  lineItems: Sage300CreSovLine[];
};

export async function syncAPInvoiceToSage300Cre(
  app: Sage300CreAppCredentials,
  company: Sage300CreCompanyCredentials,
  invoice: Sage300CreAPInvoicePayload,
  existingId?: string | null
): Promise<Sage300CreResult> {
  const today = new Date().toISOString().slice(0, 10);
  const vendorId = await resolvePartyId(app, company, "vendors", invoice.vendorName);
  if (!vendorId) {
    return {
      ok: false,
      error: `Vendor "${invoice.vendorName}" was not found in Sage 300 CRE. Create the vendor in Sage 300 CRE first, then re-sync.`,
      rawResponse: "",
    };
  }

  const body: Record<string, unknown> = {
    vendor: vendorId,
    number: String(invoice.commitmentNumber),
    description: invoice.description,
    issued_date: today,
    amount: roundMoney(invoice.lineItems.reduce((s, l) => s + l.amount, 0)),
    line_items: invoice.lineItems.map(toLineItem),
  };

  return upsertAgave(app, company, "ap-invoices", body, existingId);
}

// ── AR Invoice sync (owner pay application) ─────────────────────────────────

export type Sage300CreARInvoicePayload = {
  contractId: string;
  contractNumber: number;
  customerName: string;
  description: string;
  lineItems: Sage300CreSovLine[];
};

export async function syncARInvoiceToSage300Cre(
  app: Sage300CreAppCredentials,
  company: Sage300CreCompanyCredentials,
  invoice: Sage300CreARInvoicePayload,
  existingId?: string | null
): Promise<Sage300CreResult> {
  const today = new Date().toISOString().slice(0, 10);
  const customerId = await resolvePartyId(app, company, "customers", invoice.customerName);
  if (!customerId) {
    return {
      ok: false,
      error: `Customer "${invoice.customerName}" was not found in Sage 300 CRE. Create the customer in Sage 300 CRE first, then re-sync.`,
      rawResponse: "",
    };
  }

  const body: Record<string, unknown> = {
    customer: customerId,
    number: String(invoice.contractNumber),
    description: invoice.description,
    issued_date: today,
    amount: roundMoney(invoice.lineItems.reduce((s, l) => s + l.amount, 0)),
    line_items: invoice.lineItems.map(toLineItem),
  };

  return upsertAgave(app, company, "ar-invoices", body, existingId);
}
