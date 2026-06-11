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

// ── Job + cost-code lookups (Sage 300 CRE job costing) ──────────────────────

export type Sage300CreJob = { id: string; name: string; number: string };

export type Sage300CreJobResult =
  | { ok: true; jobs: Sage300CreJob[] }
  | { ok: false; error: string };

/** Reads a page of jobs from the connected Sage 300 CRE company. */
export async function fetchSage300CreJobs(
  app: Sage300CreAppCredentials,
  company: Sage300CreCompanyCredentials
): Promise<Sage300CreJobResult> {
  const { status, json, rawText } = await callAgave(app, company, "GET", "jobs?page_size=500");
  if (status < 200 || status >= 300) {
    return { ok: false, error: extractAgaveError(json, rawText) };
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (json as any)?.data ?? [];
  const jobs: Sage300CreJob[] = (Array.isArray(rows) ? rows : [rows])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((r: any) => r?.id)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((r: any) => ({
      id: String(r.id),
      name: String(r.name ?? r.id),
      number: String(r.number ?? ""),
    }));
  return { ok: true, jobs };
}

/**
 * Resolves the SiteCommand project to a Sage 300 CRE job id, matching the
 * project number first (the stable accounting key), then the project name.
 * Best-effort: returns null when nothing matches — the job is the customer's
 * to create in Sage, so lines simply post without job costing until it exists.
 */
export async function resolveSage300CreJobId(
  app: Sage300CreAppCredentials,
  company: Sage300CreCompanyCredentials,
  projectNumber?: string | null,
  projectName?: string | null
): Promise<string | null> {
  const num = (projectNumber ?? "").trim().toLowerCase();
  const name = (projectName ?? "").trim().toLowerCase();
  if (!num && !name) return null;
  const result = await fetchSage300CreJobs(app, company);
  if (!result.ok) return null;
  if (num) {
    const match = result.jobs.find((j) => j.number.trim().toLowerCase() === num);
    if (match) return match.id;
  }
  if (name) {
    const match = result.jobs.find((j) => j.name.trim().toLowerCase() === name);
    if (match) return match.id;
  }
  return null;
}

export type Sage300CreCostCode = { id: string; code: string; name: string };

export type Sage300CreCostCodeResult =
  | { ok: true; costCodes: Sage300CreCostCode[] }
  | { ok: false; error: string };

/** Reads cost codes (optionally scoped to a job) from Sage 300 CRE. */
export async function fetchSage300CreCostCodes(
  app: Sage300CreAppCredentials,
  company: Sage300CreCompanyCredentials,
  jobId?: string | null
): Promise<Sage300CreCostCodeResult> {
  const path = jobId
    ? `cost-codes?page_size=500&job_id=${encodeURIComponent(jobId)}`
    : "cost-codes?page_size=500";
  const { status, json, rawText } = await callAgave(app, company, "GET", path);
  if (status < 200 || status >= 300) {
    return { ok: false, error: extractAgaveError(json, rawText) };
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (json as any)?.data ?? [];
  const costCodes: Sage300CreCostCode[] = (Array.isArray(rows) ? rows : [rows])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((r: any) => r?.id)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((r: any) => ({
      id: String(r.id),
      code: String(r.code ?? ""),
      name: String(r.name ?? ""),
    }));
  return { ok: true, costCodes };
}

/**
 * Resolves the SOV budget codes in use to Agave cost-code ids with one list
 * call (exact code match first, then name, case-insensitive). Unmatched codes
 * are omitted — their lines still carry the code in the description.
 */
async function resolveCostCodeIds(
  app: Sage300CreAppCredentials,
  company: Sage300CreCompanyCredentials,
  budgetCodes: string[],
  jobId?: string | null
): Promise<Record<string, string>> {
  const wanted = Array.from(new Set(budgetCodes.map((c) => (c ?? "").trim()).filter(Boolean)));
  if (wanted.length === 0) return {};
  const result = await fetchSage300CreCostCodes(app, company, jobId);
  if (!result.ok) return {};
  const out: Record<string, string> = {};
  for (const code of wanted) {
    const lower = code.toLowerCase();
    const match =
      result.costCodes.find((cc) => cc.code.trim().toLowerCase() === lower) ??
      result.costCodes.find((cc) => cc.name.trim().toLowerCase() === lower);
    if (match) out[code] = match.id;
  }
  return out;
}

// ── Shared line-item shaping ────────────────────────────────────────────────

export type Sage300CreSovLine = {
  budgetCode: string;
  description: string;
  amount: number;
  qty?: number;
  uom?: string;
  unitCost?: number;
  retainageAmount?: number; // withheld on this line (AR billing) → header retention_amount
};

function roundMoney(n: number): number {
  return Number((Number.isFinite(n) ? n : 0).toFixed(2));
}

/**
 * One Agave line item per SOV line. The budget code is folded into the
 * description (always readable in Sage), and when resolvable the line also
 * carries the structured job costing refs (`job_id` / `cost_code_id`) plus
 * quantity detail when qty × unit cost is consistent with the amount.
 */
function toLineItem(
  line: Sage300CreSovLine,
  jobId?: string | null,
  costCodeId?: string | null
): Record<string, unknown> {
  const description = line.budgetCode
    ? `${line.budgetCode} — ${line.description}`
    : line.description;
  const item: Record<string, unknown> = { description, amount: roundMoney(line.amount) };
  if (line.qty && line.qty > 0 && line.unitCost && line.unitCost > 0
      && Math.abs(line.qty * line.unitCost - line.amount) < 0.01) {
    item.quantity = line.qty;
    item.unit_cost = roundMoney(line.unitCost);
    if (line.uom) item.unit_of_measure = line.uom;
  }
  if (jobId) item.job_id = jobId;
  if (costCodeId) item.cost_code_id = costCodeId;
  return item;
}

// ── Create / update helper ──────────────────────────────────────────────────

/**
 * Accounting feedback parsed from an Agave record: the totals as Sage computed
 * them, the amount paid, the remaining balance, and the source status string.
 */
export type Sage300CreFinancials = {
  totalAmount: number | null;
  amountPaid: number | null;
  balance: number | null;
  status: string | null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractAgaveFinancials(row: any): Sage300CreFinancials {
  const num = (v: unknown): number | null =>
    v == null || v === "" || Number.isNaN(Number(v)) ? null : Number(v);
  const totalAmount = num(row?.amount) ?? num(row?.total_amount);
  const amountPaid = num(row?.amount_paid);
  const balance =
    num(row?.balance) ?? num(row?.amount_due) ??
    (totalAmount != null && amountPaid != null ? roundMoney(totalAmount - amountPaid) : null);
  return {
    totalAmount,
    amountPaid,
    balance,
    status: row?.status != null ? String(row.status) : null,
  };
}

export type Sage300CreResult =
  | {
      ok: true;
      id: string;
      rawResponse: string;
      financials?: Sage300CreFinancials;
      vendorId?: string;
      customerId?: string;
    }
  | { ok: false; error: string; rawResponse: string };

/**
 * Re-reads an Agave record and returns its current financials (amount, amount
 * paid, balance, status). Used by the refresh endpoint and the cron's
 * payment-status pass so payments entered in Sage 300 CRE flow back to
 * SiteCommand. Returns null when the record can't be read.
 */
export async function fetchSage300CreRecordFinancials(
  app: Sage300CreAppCredentials,
  company: Sage300CreCompanyCredentials,
  resource: "purchase-orders" | "ap-invoices" | "ar-invoices",
  id: string
): Promise<Sage300CreFinancials | null> {
  const { status, json } = await callAgave(app, company, "GET", `${resource}/${id}`);
  if (status < 200 || status >= 300) return null;
  // Agave wraps single objects in `data` on some connectors; accept both shapes.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row = (json as any)?.data ?? json;
  if (!row) return null;
  return extractAgaveFinancials(row);
}

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
      const row = (json as any)?.data ?? json;
      const id = String(row?.id ?? "");
      if (!id) {
        return { ok: false, error: `Agave returned no id for ${resource}`, rawResponse: rawText.slice(0, 8000) };
      }
      return { ok: true, id, financials: extractAgaveFinancials(row), rawResponse: rawText.slice(0, 8000) };
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
      const row = (json as any)?.data ?? json;
      const id = String(row?.id ?? existingId);
      return { ok: true, id, financials: extractAgaveFinancials(row), rawResponse: rawText.slice(0, 8000) };
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
  // Approved change orders — header amount posts the revised value when present.
  approved_change_orders?: number | null;
  status: string;
  project_id: string;
  start_date?: string | null;
  estimated_completion?: string | null;
  contract_date?: string | null;
  issued_on_date?: string | null;
  delivery_date?: string | null;
  // Project context — resolved to a Sage 300 CRE job for job costing.
  project_number?: string | null;
  project_name?: string | null;
  sovLines?: Sage300CreSovLine[];
};

/**
 * Pushes a commitment (subcontract or purchase order) to Sage 300 CRE as an
 * Agave Purchase Order. The vendor must already exist in Sage 300 CRE. When the
 * project matches a Sage job, the header and every line carry the job id, and
 * SOV budget codes that match Sage cost codes carry the cost-code id.
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

  const jobId = await resolveSage300CreJobId(app, company, commitment.project_number, commitment.project_name);
  const sovLines = commitment.sovLines ?? [];
  const costCodeIds = sovLines.length
    ? await resolveCostCodeIds(app, company, sovLines.map((l) => l.budgetCode), jobId)
    : {};

  const revisedAmount = roundMoney(
    commitment.original_contract_amount + (commitment.approved_change_orders ?? 0)
  );
  const lines = sovLines.length
    ? sovLines.map((l) => toLineItem(l, jobId, costCodeIds[(l.budgetCode ?? "").trim()]))
    : [toLineItem({ budgetCode: "", description: commitment.title, amount: revisedAmount }, jobId)];

  const body: Record<string, unknown> = {
    vendor: vendorId,
    number: String(commitment.number),
    description: commitment.title,
    issued_date: commitment.issued_on_date || commitment.contract_date || commitment.start_date || today,
    amount: revisedAmount,
    line_items: lines,
  };
  const dueDate = commitment.delivery_date || commitment.estimated_completion;
  if (dueDate) body.due_date = dueDate;
  if (jobId) body.job_id = jobId;

  const result = await upsertAgave(app, company, "purchase-orders", body, existingId);
  return result.ok ? { ...result, vendorId } : result;
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
  // Project context — resolved to a Sage 300 CRE job for job costing.
  project_number?: string | null;
  project_name?: string | null;
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

  const jobId = await resolveSage300CreJobId(app, company, contract.project_number, contract.project_name);
  const sovLines = contract.sovLines ?? [];
  const costCodeIds = sovLines.length
    ? await resolveCostCodeIds(app, company, sovLines.map((l) => l.budgetCode), jobId)
    : {};

  const revisedAmount = roundMoney(
    contract.original_contract_amount + (contract.approved_change_orders ?? 0)
  );
  const lines = sovLines.length
    ? sovLines.map((l) => toLineItem(l, jobId, costCodeIds[(l.budgetCode ?? "").trim()]))
    : [toLineItem({ budgetCode: "", description: contract.title, amount: revisedAmount }, jobId)];

  const body: Record<string, unknown> = {
    customer: customerId,
    number: String(contract.contract_number),
    description: contract.description || contract.title,
    issued_date: contract.start_date || today,
    amount: revisedAmount,
    line_items: lines,
  };
  if (contract.estimated_completion_date) body.due_date = contract.estimated_completion_date;
  if (jobId) body.job_id = jobId;

  const result = await upsertAgave(app, company, "ar-invoices", body, existingId);
  return result.ok ? { ...result, customerId } : result;
}

// ── AP Invoice sync (subcontractor pay application) ─────────────────────────

export type Sage300CreAPInvoicePayload = {
  commitmentId: string;
  commitmentNumber: number;
  vendorName: string;
  description: string;
  lineItems: Sage300CreSovLine[];
  retainagePct?: number; // % withheld → header retention_amount
  // Project context — resolved to a Sage 300 CRE job for job costing.
  projectNumber?: string | null;
  projectName?: string | null;
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

  const jobId = await resolveSage300CreJobId(app, company, invoice.projectNumber, invoice.projectName);
  const costCodeIds = await resolveCostCodeIds(app, company, invoice.lineItems.map((l) => l.budgetCode), jobId);

  const grossAmount = roundMoney(invoice.lineItems.reduce((s, l) => s + l.amount, 0));
  const body: Record<string, unknown> = {
    vendor: vendorId,
    number: String(invoice.commitmentNumber),
    description: invoice.description,
    issued_date: today,
    amount: grossAmount,
    line_items: invoice.lineItems.map((l) => toLineItem(l, jobId, costCodeIds[(l.budgetCode ?? "").trim()])),
  };
  if (jobId) body.job_id = jobId;
  const pct = invoice.retainagePct ?? 0;
  if (pct > 0) {
    const retention = roundMoney((grossAmount * pct) / 100);
    if (retention > 0) body.retention_amount = retention;
  }

  const result = await upsertAgave(app, company, "ap-invoices", body, existingId);
  return result.ok ? { ...result, vendorId } : result;
}

// ── AR Invoice sync (owner pay application) ─────────────────────────────────

export type Sage300CreARInvoicePayload = {
  contractId: string;
  contractNumber: number;
  customerName: string;
  description: string;
  lineItems: Sage300CreSovLine[]; // per-line retainageAmount rolls up to header retention_amount
  // Project context — resolved to a Sage 300 CRE job for job costing.
  projectNumber?: string | null;
  projectName?: string | null;
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

  const jobId = await resolveSage300CreJobId(app, company, invoice.projectNumber, invoice.projectName);
  const costCodeIds = await resolveCostCodeIds(app, company, invoice.lineItems.map((l) => l.budgetCode), jobId);

  const body: Record<string, unknown> = {
    customer: customerId,
    number: String(invoice.contractNumber),
    description: invoice.description,
    issued_date: today,
    amount: roundMoney(invoice.lineItems.reduce((s, l) => s + l.amount, 0)),
    line_items: invoice.lineItems.map((l) => toLineItem(l, jobId, costCodeIds[(l.budgetCode ?? "").trim()])),
  };
  if (jobId) body.job_id = jobId;
  const totalRetainage = roundMoney(invoice.lineItems.reduce((s, l) => s + (l.retainageAmount ?? 0), 0));
  if (totalRetainage > 0) body.retention_amount = totalRetainage;

  const result = await upsertAgave(app, company, "ar-invoices", body, existingId);
  return result.ok ? { ...result, customerId } : result;
}
