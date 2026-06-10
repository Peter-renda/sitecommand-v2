/**
 * Offline integration check for the QuickBooks Online client (lib/quickbooks.ts).
 *
 * Run: npx tsx scripts/qbo-integration-check.ts
 *
 * Verifies, with a mocked fetch (no Intuit credentials or network needed):
 *   1. Sandbox vs production API base routing + minorversion handling
 *   2. Automatic token refresh + retry on 401 (and token persistence)
 *   3. syncCommitmentToQBO create flow (vendor resolution → account → Bill payload)
 *   4. Idempotent update flow (SyncToken re-fetch → sparse update)
 *   5. AR invoice with per-line retainage withholding
 *   6. getIntuitRedirectUri resolution precedence
 *
 * Exits non-zero on the first failed assertion.
 */

import assert from "node:assert/strict";

// Fake Supabase env so getSupabase() works; its REST calls hit the fetch mock.
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fake-supabase.local";
process.env.SUPABASE_SERVICE_ROLE_KEY = "fake-service-key";
delete process.env.QBO_API_BASE;
delete process.env.QBO_ENVIRONMENT;
delete process.env.QBO_AP_EXPENSE_ACCOUNT;
delete process.env.QBO_DEFAULT_ITEM;
delete process.env.QBO_BUDGET_CODE_MAP;
delete process.env.QBO_RETAINAGE_RECEIVABLE_ACCOUNT;
delete process.env.QBO_RETAINAGE_PAYABLE_ACCOUNT;
delete process.env.INTUIT_REDIRECT_URI;
delete process.env.NEXT_PUBLIC_APP_URL;

type RecordedCall = { url: string; method: string; body: string };
const calls: RecordedCall[] = [];

// Mutable scenario knobs the router consults.
const scenario = {
  vendorExists: false,
  failFirstQboCallWith401: false,
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url =
    typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  const method = init?.method ?? (input instanceof Request ? input.method : "GET");
  let body = "";
  if (init?.body) body = String(init.body);
  else if (input instanceof Request) body = await input.clone().text().catch(() => "");
  calls.push({ url, method, body });

  // ── Supabase REST (config reads return no rows; writes succeed) ────────────
  if (url.startsWith("https://fake-supabase.local/")) {
    if (method === "GET") return json(200, []);
    return json(201, []);
  }

  // ── Intuit OAuth token refresh ──────────────────────────────────────────────
  if (url.startsWith("https://oauth.platform.intuit.com/")) {
    return json(200, {
      access_token: "new-access-token",
      refresh_token: "new-refresh-token",
      expires_in: 3600,
    });
  }

  // ── QBO accounting API ──────────────────────────────────────────────────────
  if (url.includes("quickbooks.api.intuit.com/v3/company/")) {
    const auth = (init?.headers as Record<string, string>)?.Authorization ?? "";
    if (scenario.failFirstQboCallWith401 && !auth.includes("new-access-token")) {
      return json(401, { Fault: { Error: [{ Message: "AuthenticationFailed" }] } });
    }

    const u = new URL(url);
    const path = u.pathname; // /v3/company/<realm>/<entity>[/<id>]

    if (path.endsWith("/query")) {
      const q = u.searchParams.get("query") ?? "";
      if (q.includes("FROM Vendor")) {
        return scenario.vendorExists
          ? json(200, { QueryResponse: { Vendor: [{ Id: "71", DisplayName: "Acme Concrete" }] } })
          : json(200, { QueryResponse: {} });
      }
      if (q.includes("FROM Customer")) {
        return json(200, { QueryResponse: { Customer: [{ Id: "55", DisplayName: "Owner LLC" }] } });
      }
      if (q.includes("FROM Account") && q.includes("Cost of Goods Sold")) {
        return json(200, { QueryResponse: { Account: [{ Id: "80" }] } });
      }
      if (q.includes("FROM Account") && q.includes("Name = 'Retainage Receivable'")) {
        return json(200, { QueryResponse: { Account: [{ Id: "90" }] } });
      }
      if (q.includes("FROM Account") && q.includes("'Income'")) {
        return json(200, { QueryResponse: { Account: [{ Id: "85" }] } });
      }
      if (q.includes("FROM Item") && q.includes("'Retainage'")) {
        return json(200, { QueryResponse: { Item: [{ Id: "10" }] } });
      }
      if (q.includes("FROM Item")) {
        return json(200, { QueryResponse: { Item: [{ Id: "9" }] } });
      }
      return json(200, { QueryResponse: {} });
    }

    if (path.endsWith("/vendor") && method === "POST") {
      return json(200, { Vendor: { Id: "72", DisplayName: JSON.parse(body).DisplayName } });
    }
    if (/\/bill\/\d+$/.test(path) && method === "GET") {
      return json(200, { Bill: { Id: path.split("/").pop(), SyncToken: "4" } });
    }
    if (path.endsWith("/bill") && method === "POST") {
      const isUpdate = u.searchParams.get("operation") === "update";
      return json(200, { Bill: { Id: isUpdate ? JSON.parse(body).Id : "201", SyncToken: isUpdate ? "5" : "0" } });
    }
    if (/\/invoice\/\d+$/.test(path) && method === "GET") {
      return json(200, { Invoice: { Id: path.split("/").pop(), SyncToken: "2" } });
    }
    if (path.endsWith("/invoice") && method === "POST") {
      return json(200, { Invoice: { Id: "301", SyncToken: "0" } });
    }
    if (path.endsWith("/purchaseorder") && method === "POST") {
      return json(200, { PurchaseOrder: { Id: "401", SyncToken: "0" } });
    }
    return json(404, { Fault: { Error: [{ Message: `Unhandled mock path ${path}` }] } });
  }

  return realFetch(input as RequestInfo, init);
}) as typeof fetch;

function qboCalls(): RecordedCall[] {
  return calls.filter((c) => c.url.includes("quickbooks.api.intuit.com"));
}

async function main() {
  const {
    callQBO,
    syncCommitmentToQBO,
    syncARInvoiceToQBO,
    getIntuitRedirectUri,
  } = await import("../lib/quickbooks");

  const appCreds = { clientId: "test-client-id", clientSecret: "test-client-secret" };
  const prodCreds = {
    realmId: "9341450000000",
    accessToken: "prod-access-token",
    refreshToken: "prod-refresh-token",
    environment: "production" as const,
  };
  const sandboxCreds = { ...prodCreds, environment: "sandbox" as const, accessToken: "sb-access-token" };

  let passed = 0;
  function pass(name: string) {
    passed++;
    console.log(`  ✓ ${name}`);
  }

  // ── 1. Environment routing + minorversion ────────────────────────────────────
  console.log("\n[1] API base routing");
  calls.length = 0;
  await callQBO("co-1", appCreds, prodCreds, "GET", "bill/201");
  assert.match(
    calls[0].url,
    /^https:\/\/quickbooks\.api\.intuit\.com\/v3\/company\/9341450000000\/bill\/201\?minorversion=65$/,
    `production URL wrong: ${calls[0].url}`
  );
  pass("production environment routes to quickbooks.api.intuit.com with ?minorversion");

  calls.length = 0;
  await callQBO("co-1", appCreds, sandboxCreds, "GET", "query?query=SELECT%20Id%20FROM%20Vendor");
  assert.ok(
    calls[0].url.startsWith("https://sandbox-quickbooks.api.intuit.com/v3/company/9341450000000/query?query="),
    `sandbox URL wrong: ${calls[0].url}`
  );
  assert.ok(calls[0].url.endsWith("&minorversion=65"), "existing query string must use & separator");
  pass("sandbox environment routes to sandbox-quickbooks.api.intuit.com with &minorversion");

  // ── 2. 401 → refresh → retry ────────────────────────────────────────────────
  console.log("\n[2] Token refresh on 401");
  calls.length = 0;
  scenario.failFirstQboCallWith401 = true;
  const refreshed = await callQBO("co-1", appCreds, prodCreds, "GET", "bill/201");
  scenario.failFirstQboCallWith401 = false;

  assert.equal(refreshed.status, 200, "retry after refresh should succeed");
  const tokenCall = calls.find((c) => c.url.startsWith("https://oauth.platform.intuit.com/"));
  assert.ok(tokenCall, "refresh token call must be made");
  assert.ok(tokenCall!.body.includes("grant_type=refresh_token"), "must use refresh_token grant");
  assert.ok(
    tokenCall!.body.includes(`refresh_token=${encodeURIComponent("prod-refresh-token")}`),
    "must send stored refresh token"
  );
  const persistCall = calls.find(
    (c) => c.url.includes("fake-supabase.local") && c.method === "POST" && c.body.includes("new-access-token")
  );
  assert.ok(persistCall, "refreshed tokens must be persisted to company_integrations");
  assert.equal(qboCalls().length, 2, "QBO endpoint should be called exactly twice (fail + retry)");
  pass("401 triggers refresh-token grant, persists new tokens, and retries once");

  // ── 3. Commitment (subcontract) create → Bill ───────────────────────────────
  console.log("\n[3] Subcontract → Bill create");
  calls.length = 0;
  scenario.vendorExists = false;
  const createResult = await syncCommitmentToQBO("co-1", appCreds, prodCreds, {
    id: "c-1",
    type: "subcontract",
    number: 14,
    title: "Concrete package",
    contract_company: "Acme Concrete",
    original_contract_amount: 125000.456,
    status: "approved",
    project_id: "p-1",
    start_date: "2026-05-01",
    estimated_completion: "2026-09-30",
    sovLines: [
      { budgetCode: "03-100", description: "Footings", amount: 75000 },
      { budgetCode: "03-200", description: "Slabs", amount: 50000 },
    ],
  });

  assert.ok(createResult.ok, `sync failed: ${!createResult.ok ? createResult.error : ""}`);
  assert.equal(createResult.ok && createResult.id, "201");

  const vendorCreate = calls.find((c) => c.url.includes("/vendor?") && c.method === "POST");
  assert.ok(vendorCreate, "missing vendor should be created");
  assert.equal(JSON.parse(vendorCreate!.body).DisplayName, "Acme Concrete");

  const billCreate = calls.find((c) => /\/bill\?minorversion/.test(c.url) && c.method === "POST");
  assert.ok(billCreate, "bill create must be POSTed");
  const billPayload = JSON.parse(billCreate!.body);
  assert.equal(billPayload.VendorRef.value, "72", "VendorRef must post by Id (value), not name");
  assert.equal(billPayload.DocNumber, "14");
  assert.equal(billPayload.TxnDate, "2026-05-01", "Bill TxnDate must use commitment start date");
  assert.equal(billPayload.DueDate, "2026-09-30", "Bill DueDate must use estimated completion");
  assert.equal(billPayload.Line.length, 2, "one QBO line per SOV item");
  assert.equal(billPayload.Line[0].DetailType, "AccountBasedExpenseLineDetail");
  assert.equal(billPayload.Line[0].AccountBasedExpenseLineDetail.AccountRef.value, "80", "expense line must debit detected COGS account");
  assert.equal(billPayload.Line[0].Description, "03-100 — Footings", "line description carries budget code");
  assert.equal(billPayload.Id, undefined, "create payload must not carry Id");
  pass("creates Vendor on demand and posts Bill with per-SOV-line detail and real dates");

  // ── 4. Idempotent update with fresh SyncToken ───────────────────────────────
  console.log("\n[4] Idempotent update");
  calls.length = 0;
  scenario.vendorExists = true;
  const updateResult = await syncCommitmentToQBO(
    "co-1", appCreds, prodCreds,
    {
      id: "c-1", type: "subcontract", number: 14, title: "Concrete package",
      contract_company: "Acme Concrete", original_contract_amount: 130000,
      status: "approved", project_id: "p-1",
    },
    "201" // existing QBO Bill id
  );
  assert.ok(updateResult.ok, `update failed: ${!updateResult.ok ? updateResult.error : ""}`);

  const syncTokenFetch = calls.find((c) => /\/bill\/201\?minorversion/.test(c.url) && c.method === "GET");
  assert.ok(syncTokenFetch, "must GET the bill to fetch latest SyncToken before updating");
  const billUpdate = calls.find((c) => c.url.includes("/bill?operation=update"));
  assert.ok(billUpdate, "must POST bill?operation=update");
  const updatePayload = JSON.parse(billUpdate!.body);
  assert.equal(updatePayload.Id, "201");
  assert.equal(updatePayload.SyncToken, "4", "update must carry the freshly fetched SyncToken");
  assert.equal(updatePayload.sparse, true);
  const vendorCreates = calls.filter((c) => c.url.includes("/vendor?") && c.method === "POST");
  assert.equal(vendorCreates.length, 0, "existing vendor must be reused, not duplicated");
  pass("update path re-fetches SyncToken, posts sparse update, reuses existing vendor");

  // ── 5. AR invoice with retainage ────────────────────────────────────────────
  console.log("\n[5] AR invoice with retainage");
  process.env.QBO_RETAINAGE_RECEIVABLE_ACCOUNT = "Retainage Receivable";
  calls.length = 0;
  const arResult = await syncARInvoiceToQBO("co-1", appCreds, prodCreds, {
    contractId: "pc-1",
    contractNumber: 3,
    customerName: "Owner LLC",
    description: "Pay app #2",
    lineItems: [
      { budgetCode: "01-000", description: "GC work", amount: 40000, retainageAmount: 4000 },
    ],
  });
  delete process.env.QBO_RETAINAGE_RECEIVABLE_ACCOUNT;

  assert.ok(arResult.ok, `AR sync failed: ${!arResult.ok ? arResult.error : ""}`);
  const invoiceCreate = calls.find((c) => /\/invoice\?minorversion/.test(c.url) && c.method === "POST");
  assert.ok(invoiceCreate, "invoice must be POSTed");
  const invPayload = JSON.parse(invoiceCreate!.body);
  assert.equal(invPayload.CustomerRef.value, "55", "CustomerRef must post by Id");
  assert.equal(invPayload.Line.length, 2, "billing line + retainage line");
  assert.equal(invPayload.Line[0].DetailType, "SalesItemLineDetail");
  assert.equal(invPayload.Line[1].Amount, -4000, "retainage withheld as negative line");
  assert.equal(invPayload.Line[1].SalesItemLineDetail.ItemRef.value, "10", "retainage line uses Retainage item");
  pass("AR invoice posts sales lines by Item Id and withholds retainage as a negative line");

  // ── 6. Redirect URI precedence ──────────────────────────────────────────────
  console.log("\n[6] Redirect URI resolution");
  const mkReq = (host: string, proto?: string) =>
    new Request(`https://internal.invalid/api/integrations/quickbooks/connect`, {
      headers: { "x-forwarded-host": host, ...(proto ? { "x-forwarded-proto": proto } : {}) },
    });

  process.env.INTUIT_REDIRECT_URI = "https://app.example.com/api/integrations/quickbooks/callback";
  process.env.NEXT_PUBLIC_APP_URL = "https://other.example.com";
  assert.equal(
    getIntuitRedirectUri(mkReq("ignored.example.com")),
    "https://app.example.com/api/integrations/quickbooks/callback"
  );
  delete process.env.INTUIT_REDIRECT_URI;
  assert.equal(
    getIntuitRedirectUri(mkReq("ignored.example.com")),
    "https://other.example.com/api/integrations/quickbooks/callback"
  );
  delete process.env.NEXT_PUBLIC_APP_URL;
  assert.equal(
    getIntuitRedirectUri(mkReq("fwd.example.com", "https")),
    "https://fwd.example.com/api/integrations/quickbooks/callback"
  );
  pass("INTUIT_REDIRECT_URI > NEXT_PUBLIC_APP_URL > x-forwarded-* precedence holds");

  console.log(`\nAll ${passed} QBO integration checks passed.`);
}

main().catch((err) => {
  console.error("\n✗ QBO integration check FAILED:");
  console.error(err);
  process.exit(1);
});
