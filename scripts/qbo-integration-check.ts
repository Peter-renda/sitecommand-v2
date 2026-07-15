/**
 * Offline integration check for the QuickBooks Online client (lib/quickbooks.ts).
 *
 * Run: npx tsx scripts/qbo-integration-check.ts
 *
 * Verifies, with a mocked fetch (no Intuit credentials or network needed):
 *   1. Sandbox vs production API base routing + minorversion handling
 *   2. Automatic token refresh + retry on 401 (and token persistence)
 *   3. syncCommitmentToQBO create flow (vendor resolution+enrichment → account →
 *      Bill payload with terms, project Class fallback, financial feedback)
 *   4. Idempotent update flow (SyncToken re-fetch → sparse update, revised amount)
 *   5. AR invoice with per-line retainage withholding + stored materials
 *   6. getIntuitRedirectUri resolution precedence
 *   7. Purchase order ship-to / ship-via / delivery-date mapping
 *   8. Void/terminated handling (Bill delete, PO close, skip when never synced)
 *   9. DocNumber project prefix (QBO_DOC_NUMBER_PREFIX)
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
delete process.env.QBO_PROJECT_TRACKING;
delete process.env.QBO_DOC_NUMBER_PREFIX;
delete process.env.INTUIT_REDIRECT_URI;
delete process.env.NEXT_PUBLIC_APP_URL;

type RecordedCall = { url: string; method: string; body: string };
const calls: RecordedCall[] = [];

// Mutable scenario knobs the router consults.
const scenario = {
  vendorExists: false,
  failFirstQboCallWith401: false,
  classExists: false,
  customerExists: false,
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
      if (q.includes("FROM Bill")) {
        return json(200, {
          QueryResponse: {
            Bill: [
              {
                Id: "b-paid-1",
                Balance: 0,
                Line: [
                  { Amount: 20000, ItemBasedExpenseLineDetail: { ItemRef: { value: "i1", name: "02-310.C" }, CustomerRef: { value: "510" } } },
                  { Amount: 768.66, ItemBasedExpenseLineDetail: { ItemRef: { value: "i2", name: "01-030.M" }, CustomerRef: { value: "510" } } },
                ],
              },
              {
                Id: "b-paid-2",
                Balance: 0,
                Line: [
                  { Amount: 15500, ItemBasedExpenseLineDetail: { ItemRef: { value: "i1", name: "02-310.C" }, CustomerRef: { value: "510" } } },
                ],
              },
              {
                Id: "b-unpaid",
                Balance: 100,
                Line: [
                  { Amount: 99999, ItemBasedExpenseLineDetail: { ItemRef: { value: "i1", name: "02-310.C" }, CustomerRef: { value: "510" } } },
                ],
              },
              {
                Id: "b-other-project",
                Balance: 0,
                Line: [
                  { Amount: 12345, ItemBasedExpenseLineDetail: { ItemRef: { value: "i1", name: "02-310.C" }, CustomerRef: { value: "999" } } },
                ],
              },
              {
                Id: "b-pinned-project",
                Balance: 0,
                Line: [
                  { Amount: 777, ItemBasedExpenseLineDetail: { ItemRef: { value: "i1", name: "02-310.C" }, CustomerRef: { value: "PINNED-777" } } },
                ],
              },
            ],
          },
        });
      }
      if (q.includes("FROM Vendor")) {
        return scenario.vendorExists
          ? json(200, { QueryResponse: { Vendor: [{ Id: "71", DisplayName: "Acme Concrete" }] } })
          : json(200, { QueryResponse: {} });
      }
      if (q.includes("FROM Customer")) {
        if (scenario.customerExists) {
          // Projects-first lookup: when the query asks for IsProject=true, return
          // the Project Id (510); otherwise return the plain Customer (501).
          if (q.includes("IsProject = true")) {
            return json(200, { QueryResponse: { Customer: [{ Id: "510", DisplayName: "EH Sitework" }] } });
          }
          return json(200, { QueryResponse: { Customer: [{ Id: "501", DisplayName: "EH Sitework" }] } });
        }
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
      if (q.includes("FROM Term") && q.includes("'Net 30'")) {
        return json(200, { QueryResponse: { Term: [{ Id: "33" }] } });
      }
      if (q.includes("FROM Class")) {
        return scenario.classExists
          ? json(200, { QueryResponse: { Class: [{ Id: "44" }] } })
          : json(200, { QueryResponse: {} }); // no existing class → create
      }
      return json(200, { QueryResponse: {} });
    }

    // Profit & Loss DETAIL report (Items-based job-to-date pull). Includes the
    // item_name column so the pull can sum each Item's transactions for the
    // requested Customer:Job. Section + summary rows are present to verify
    // group subtotals are NOT double-counted.
    if (path.endsWith("/reports/ProfitAndLossDetail") && method === "GET") {
      return json(200, {
        Header: { ReportName: "ProfitAndLossDetail" },
        Columns: {
          Column: [
            { ColTitle: "Date", ColType: "tx_date" },
            { ColTitle: "Name", ColType: "name" },
            { ColTitle: "Memo", ColType: "memo" },
            { ColTitle: "Product/Service", ColType: "item_name" },
            { ColTitle: "Amount", ColType: "Amount" },
          ],
        },
        Rows: {
          Row: [
            {
              type: "Section",
              Header: { ColData: [{ value: "Expenses" }] },
              Rows: {
                Row: [
                  { type: "Data", ColData: [{ value: "2026-05-01" }, { value: "Acme Concrete" }, { value: "Footings" }, { value: "02-310.C", id: "i1" }, { value: "20000.00" }] },
                  { type: "Data", ColData: [{ value: "2026-05-15" }, { value: "Acme Concrete" }, { value: "Slabs" }, { value: "02-310.C", id: "i1" }, { value: "15500.00" }] },
                  { type: "Data", ColData: [{ value: "2026-05-20" }, { value: "Vendor X" }, { value: "Materials" }, { value: "01-030.M", id: "i2" }, { value: "768.66" }] },
                ],
              },
              Summary: { ColData: [{ value: "Total Expenses" }, { value: "" }, { value: "" }, { value: "" }, { value: "36268.66" }] },
            },
          ],
        },
      });
    }

    // Profit & Loss report (job-to-date cost pull). Section + summary present to
    // verify section subtotals are NOT double-counted.
    if (path.endsWith("/reports/ProfitAndLoss") && method === "GET") {
      return json(200, {
        Header: { ReportName: "ProfitAndLoss" },
        Rows: {
          Row: [
            {
              type: "Section",
              Header: { ColData: [{ value: "Expenses" }] },
              Rows: {
                Row: [
                  { type: "Data", ColData: [{ value: "Job Materials", id: "82" }, { value: "30000.00" }] },
                  { type: "Data", ColData: [{ value: "Subcontractors", id: "95" }, { value: "50000.00" }] },
                ],
              },
              Summary: { ColData: [{ value: "Total Expenses" }, { value: "80000.00" }] },
            },
          ],
        },
      });
    }

    if (path.endsWith("/vendor") && method === "POST") {
      return json(200, { Vendor: { Id: "72", DisplayName: JSON.parse(body).DisplayName } });
    }
    if (path.endsWith("/class") && method === "POST") {
      return json(200, { Class: { Id: "44", Name: JSON.parse(body).Name } });
    }
    if (/\/bill\/\d+$/.test(path) && method === "GET") {
      return json(200, { Bill: { Id: path.split("/").pop(), SyncToken: "4" } });
    }
    if (path.endsWith("/bill") && method === "POST") {
      const op = u.searchParams.get("operation");
      if (op === "delete") {
        return json(200, { Bill: { Id: JSON.parse(body).Id, status: "Deleted" } });
      }
      const isUpdate = op === "update";
      return json(200, {
        Bill: { Id: isUpdate ? JSON.parse(body).Id : "201", SyncToken: isUpdate ? "5" : "0", TotalAmt: 125000, Balance: 125000 },
      });
    }
    if (/\/invoice\/\d+$/.test(path) && method === "GET") {
      return json(200, { Invoice: { Id: path.split("/").pop(), SyncToken: "2" } });
    }
    if (path.endsWith("/invoice") && method === "POST") {
      const op = u.searchParams.get("operation");
      if (op === "void") {
        return json(200, { Invoice: { Id: JSON.parse(body).Id, SyncToken: "3", TotalAmt: 0, Balance: 0 } });
      }
      return json(200, { Invoice: { Id: "301", SyncToken: "0", TotalAmt: 40000, Balance: 15000 } });
    }
    if (/\/purchaseorder\/\d+$/.test(path) && method === "GET") {
      return json(200, { PurchaseOrder: { Id: path.split("/").pop(), SyncToken: "1", POStatus: "Open" } });
    }
    if (path.endsWith("/purchaseorder") && method === "POST") {
      const isUpdate = u.searchParams.get("operation") === "update";
      const parsed = body ? JSON.parse(body) : {};
      return json(200, {
        PurchaseOrder: {
          Id: isUpdate ? parsed.Id : "401",
          SyncToken: isUpdate ? "2" : "0",
          POStatus: parsed.POStatus ?? "Open",
          TotalAmt: 5000,
        },
      });
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
    syncPrimeContractToQBO,
    syncARInvoiceToQBO,
    getIntuitRedirectUri,
    fetchQBOJobToDateCosts,
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
    payment_terms: "Net 30",
    project_name: "Riverside Plaza",
    qbo_customer_id: "510",
    vendorDetails: {
      companyName: "Acme Concrete LLC",
      email: "ap@acmeconcrete.com",
      phone: "555-0100",
      addressLine1: "100 Main St",
      city: "Austin",
      state: "TX",
      zip: "78701",
    },
    sovLines: [
      { budgetCode: "03-100", description: "Footings", amount: 75000 },
      { budgetCode: "03-200", description: "Slabs", amount: 50000 },
    ],
  });

  assert.ok(createResult.ok, `sync failed: ${!createResult.ok ? createResult.error : ""}`);
  assert.equal(createResult.ok && createResult.id, "201");

  const vendorCreate = calls.find((c) => c.url.includes("/vendor?") && c.method === "POST");
  assert.ok(vendorCreate, "missing vendor should be created");
  const vendorPayload = JSON.parse(vendorCreate!.body);
  assert.equal(vendorPayload.DisplayName, "Acme Concrete");
  assert.equal(vendorPayload.CompanyName, "Acme Concrete LLC", "vendor create must carry the directory company name");
  assert.equal(vendorPayload.PrimaryEmailAddr.Address, "ap@acmeconcrete.com", "vendor create must carry the directory email");
  assert.equal(vendorPayload.PrimaryPhone.FreeFormNumber, "555-0100", "vendor create must carry the directory phone");
  assert.equal(vendorPayload.BillAddr.City, "Austin", "vendor create must carry the directory address");

  const billCreate = calls.find((c) => /\/bill\?minorversion/.test(c.url) && c.method === "POST");
  assert.ok(billCreate, "bill create must be POSTed");
  const billPayload = JSON.parse(billCreate!.body);
  assert.equal(billPayload.VendorRef.value, "72", "VendorRef must post by Id (value), not name");
  assert.equal(billPayload.DocNumber, "14");
  assert.equal(billPayload.TxnDate, "2026-05-01", "Bill TxnDate must use commitment start date");
  assert.equal(billPayload.DueDate, "2026-09-30", "Bill DueDate must use estimated completion");
  assert.equal(billPayload.SalesTermRef.value, "33", "payment terms must resolve to a QBO Term Id");
  assert.equal(billPayload.Line.length, 2, "one QBO line per SOV item");
  assert.equal(billPayload.Line[0].DetailType, "AccountBasedExpenseLineDetail");
  assert.equal(billPayload.Line[0].AccountBasedExpenseLineDetail.AccountRef.value, "80", "expense line must debit detected COGS account");
  assert.equal(billPayload.Line[0].AccountBasedExpenseLineDetail.ClassRef.value, "44", "lines must fall back to the project Class for job costing");
  assert.equal(billPayload.Line[0].AccountBasedExpenseLineDetail.CustomerRef.value, "510", "bill expense lines must be scoped to the pinned QBO Project/Customer");
  assert.equal(billPayload.Line[0].Description, "03-100 — Footings", "line description carries budget code");
  assert.equal(billPayload.Id, undefined, "create payload must not carry Id");
  assert.ok(createResult.ok && createResult.vendorId === "72", "result must surface the resolved vendor id");
  assert.ok(createResult.ok && createResult.financials?.totalAmount === 125000, "result must parse TotalAmt from the response");
  assert.ok(createResult.ok && createResult.financials?.paymentStatus === "unpaid", "balance == total derives an unpaid status");
  pass("creates enriched Vendor, posts Bill with terms, project Class, SOV detail, and parses financial feedback");

  // ── 3b. Missing Contract Company → actionable validation error ─────────────
  calls.length = 0;
  const noVendor = await syncCommitmentToQBO("co-1", appCreds, prodCreds, {
    id: "c-2", type: "subcontract", number: 15, title: "No company set",
    contract_company: "", original_contract_amount: 100,
    status: "draft", project_id: "p-1",
  });
  assert.equal(noVendor.ok, false, "blank contract company must fail");
  assert.ok(!noVendor.ok && noVendor.validation === true, "must be flagged as a validation failure (422)");
  assert.match(!noVendor.ok ? noVendor.error : "", /Contract Company/, "error must name the missing field");
  assert.equal(qboCalls().length, 0, "validation failure must not call QBO");
  pass("blank Contract Company fails fast with an actionable validation message");

  // ── 4. Idempotent update with fresh SyncToken ───────────────────────────────
  console.log("\n[4] Idempotent update");
  calls.length = 0;
  scenario.vendorExists = true;
  const updateResult = await syncCommitmentToQBO(
    "co-1", appCreds, prodCreds,
    {
      id: "c-1", type: "subcontract", number: 14, title: "Concrete package",
      contract_company: "Acme Concrete", original_contract_amount: 130000,
      approved_change_orders: 5000,
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
  assert.equal(updatePayload.Line[0].Amount, 135000, "lump-sum fallback must post the REVISED amount (original + approved COs)");
  const vendorCreates = calls.filter((c) => c.url.includes("/vendor?") && c.method === "POST");
  assert.equal(vendorCreates.length, 0, "existing vendor must be reused, not duplicated");
  pass("update path re-fetches SyncToken, posts sparse revised-amount update, reuses existing vendor");

  // ── 5. AR invoice with retainage + stored materials ─────────────────────────
  console.log("\n[5] AR invoice with retainage + stored materials");
  process.env.QBO_RETAINAGE_RECEIVABLE_ACCOUNT = "Retainage Receivable";
  calls.length = 0;
  const arResult = await syncARInvoiceToQBO("co-1", appCreds, prodCreds, {
    contractId: "pc-1",
    contractNumber: 3,
    customerName: "Owner LLC",
    description: "Pay app #2",
    lineItems: [
      { budgetCode: "01-000", description: "GC work", amount: 40000, retainageAmount: 4000, materialsStored: 2500 },
    ],
  });
  delete process.env.QBO_RETAINAGE_RECEIVABLE_ACCOUNT;

  assert.ok(arResult.ok, `AR sync failed: ${!arResult.ok ? arResult.error : ""}`);
  const invoiceCreate = calls.find((c) => /\/invoice\?minorversion/.test(c.url) && c.method === "POST");
  assert.ok(invoiceCreate, "invoice must be POSTed");
  const invPayload = JSON.parse(invoiceCreate!.body);
  assert.equal(invPayload.CustomerRef.value, "55", "CustomerRef must post by Id");
  assert.equal(invPayload.Line.length, 3, "billing line + stored materials line + retainage line");
  assert.equal(invPayload.Line[0].DetailType, "SalesItemLineDetail");
  assert.equal(invPayload.Line[1].Amount, 2500, "stored materials billed as its own line");
  assert.equal(invPayload.Line[1].Description, "Materials presently stored");
  assert.equal(invPayload.Line[2].Amount, -4000, "retainage withheld as negative line");
  assert.equal(invPayload.Line[2].SalesItemLineDetail.ItemRef.value, "10", "retainage line uses Retainage item");
  assert.ok(arResult.ok && arResult.financials?.balance === 15000, "result must parse the invoice open Balance");
  assert.ok(arResult.ok && arResult.financials?.paymentStatus === "partially_paid", "balance < total derives partially_paid");
  pass("AR invoice withholds retainage, bills stored materials, and parses payment feedback");

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

  // ── 7. Purchase order ship-to / ship-via / delivery date ────────────────────
  console.log("\n[7] Purchase order shipping detail");
  calls.length = 0;
  scenario.vendorExists = true;
  const poResult = await syncCommitmentToQBO("co-1", appCreds, prodCreds, {
    id: "c-3", type: "purchase_order", number: 21, title: "Rebar order",
    contract_company: "Acme Concrete", original_contract_amount: 5000,
    status: "approved", project_id: "p-1",
    issued_on_date: "2026-06-01",
    delivery_date: "2026-07-15",
    ship_to: "Jobsite Gate 4\n200 River Rd\nAustin, TX 78701",
    ship_via: "Flatbed freight",
    bill_to: "Accounts Payable",
  });
  assert.ok(poResult.ok, `PO sync failed: ${!poResult.ok ? poResult.error : ""}`);
  const poCreate = calls.find((c) => /\/purchaseorder\?minorversion/.test(c.url) && c.method === "POST");
  assert.ok(poCreate, "purchase order must be POSTed");
  const poPayload = JSON.parse(poCreate!.body);
  assert.equal(poPayload.TxnDate, "2026-06-01", "PO TxnDate must use issued-on date");
  assert.equal(poPayload.DueDate, "2026-07-15", "PO DueDate must use delivery date");
  assert.equal(poPayload.ShipAddr.Line1, "Jobsite Gate 4", "ship_to maps to ShipAddr lines");
  assert.equal(poPayload.ShipAddr.Line3, "Austin, TX 78701");
  assert.match(poPayload.PrivateNote, /Ship Via: Flatbed freight/, "ship_via lands in the note");
  assert.match(poPayload.PrivateNote, /Bill To: Accounts Payable/, "bill_to lands in the note");
  pass("PO maps ship-to address, delivery due date, and ship-via/bill-to context");

  // ── 8. Void / terminated handling ────────────────────────────────────────────
  console.log("\n[8] Void / terminated handling");
  calls.length = 0;
  const voidBill = await syncCommitmentToQBO("co-1", appCreds, prodCreds, {
    id: "c-1", type: "subcontract", number: 14, title: "Concrete package",
    contract_company: "Acme Concrete", original_contract_amount: 130000,
    status: "void", project_id: "p-1",
  }, "201");
  assert.ok(voidBill.ok && voidBill.action === "deleted", "void subcontract must delete the QBO Bill");
  const billDelete = calls.find((c) => c.url.includes("/bill?operation=delete"));
  assert.ok(billDelete, "must POST bill?operation=delete");
  assert.equal(JSON.parse(billDelete!.body).Id, "201");

  calls.length = 0;
  const voidPo = await syncCommitmentToQBO("co-1", appCreds, prodCreds, {
    id: "c-3", type: "purchase_order", number: 21, title: "Rebar order",
    contract_company: "Acme Concrete", original_contract_amount: 5000,
    status: "terminated", project_id: "p-1",
  }, "401");
  assert.ok(voidPo.ok && voidPo.action === "closed", "terminated PO must be closed, not deleted");
  const poClose = calls.find((c) => c.url.includes("/purchaseorder?operation=update"));
  assert.ok(poClose, "must POST purchaseorder?operation=update");
  assert.equal(JSON.parse(poClose!.body).POStatus, "Closed");

  calls.length = 0;
  const voidNeverSynced = await syncCommitmentToQBO("co-1", appCreds, prodCreds, {
    id: "c-4", type: "subcontract", number: 30, title: "Cancelled scope",
    contract_company: "Acme Concrete", original_contract_amount: 1000,
    status: "void", project_id: "p-1",
  });
  assert.ok(voidNeverSynced.ok && voidNeverSynced.action === "skipped", "void + never synced must skip");
  assert.equal(qboCalls().length, 0, "skip must not call QBO at all");

  calls.length = 0;
  const voidInvoice = await syncPrimeContractToQBO("co-1", appCreds, prodCreds, {
    id: "pc-1", contract_number: 3, title: "Prime", owner_client: "Owner LLC",
    contractor: "GC", architect_engineer: "AE", description: "Base contract",
    original_contract_amount: 1000000, approved_change_orders: 0, default_retainage: 10,
    status: "Void", executed: false, start_date: null, estimated_completion_date: null,
  }, "301");
  assert.ok(voidInvoice.ok && voidInvoice.action === "voided", "void prime contract must void the AR Invoice");
  const invVoid = calls.find((c) => c.url.includes("/invoice?operation=void"));
  assert.ok(invVoid, "must POST invoice?operation=void");
  pass("void/terminated deletes Bills, closes POs, voids Invoices, and skips never-synced records");

  // ── 9. DocNumber project prefix ──────────────────────────────────────────────
  console.log("\n[9] DocNumber project prefix");
  process.env.QBO_DOC_NUMBER_PREFIX = "project";
  calls.length = 0;
  const prefixed = await syncCommitmentToQBO("co-1", appCreds, prodCreds, {
    id: "c-1", type: "subcontract", number: 14, title: "Concrete package",
    contract_company: "Acme Concrete", original_contract_amount: 130000,
    status: "approved", project_id: "p-1", project_number: "P-100",
  });
  delete process.env.QBO_DOC_NUMBER_PREFIX;
  assert.ok(prefixed.ok, `prefixed sync failed: ${!prefixed.ok ? prefixed.error : ""}`);
  const prefixedBill = calls.find((c) => /\/bill\?minorversion/.test(c.url) && c.method === "POST");
  assert.equal(JSON.parse(prefixedBill!.body).DocNumber, "P-100-14", "QBO_DOC_NUMBER_PREFIX=project prefixes the project number");
  pass("DocNumber carries the project number when QBO_DOC_NUMBER_PREFIX=project");

  // ── 10. Job-to-date cost pull (two-way: QBO → budget) ───────────────────────
  console.log("\n[10] Job-to-date cost pull");
  process.env.QBO_BUDGET_CODE_MAP = JSON.stringify({
    "03-100": { account: "Job Materials" },
    "03-200": { account: "Subcontractors" },
  });
  scenario.classExists = true;
  calls.length = 0;
  const jtd = await fetchQBOJobToDateCosts("co-1", appCreds, prodCreds, {
    projectName: "Riverside Plaza",
    budgetCodes: ["03-100", "03-200", "09-999"],
  });
  scenario.classExists = false;
  delete process.env.QBO_BUDGET_CODE_MAP;

  assert.ok(jtd.ok, `job-to-date pull failed: ${!jtd.ok ? jtd.error : ""}`);
  assert.equal(jtd.ok && jtd.costs["03-100"], 30000, "Job Materials account total maps to budget code 03-100");
  assert.equal(jtd.ok && jtd.costs["03-200"], 50000, "Subcontractors account total maps to budget code 03-200");
  assert.ok(jtd.ok && jtd.costs["09-999"] === undefined, "unmapped budget code must be omitted (not zeroed)");
  const reportCall = calls.find((c) => c.url.includes("/reports/ProfitAndLoss"));
  assert.ok(reportCall, "must request the ProfitAndLoss report");
  assert.match(reportCall!.url, /classid=44/, "P&L must be scoped to the project's Class id");
  pass("pulls job-to-date costs by budget code, scoped to project Class, skipping unmapped codes");

  // ── 11. Items-based job-to-date pull (Customer:Job + paid Bill item lines) ─
  console.log("\n[11] Items-based job-to-date pull");
  process.env.QBO_BUDGET_CODE_MAP = JSON.stringify({
    "02-310.C": { item: "02-310.C" },
    // 01-030.M intentionally has no map entry: the default GC path treats the QBO Product/Service number as the budget code.
    "09-925.L": { item: "09-925.L" }, // mapped but not present in paid Bills
  });
  scenario.customerExists = true;
  calls.length = 0;
  const jtdItems = await fetchQBOJobToDateCosts("co-1", appCreds, prodCreds, {
    projectName: "EH Sitework",
    budgetCodes: ["02-310.C", "01-030.M", "09-925.L"],
  });
  scenario.customerExists = false;
  delete process.env.QBO_BUDGET_CODE_MAP;

  assert.ok(jtdItems.ok, `items-based pull failed: ${!jtdItems.ok ? jtdItems.error : ""}`);
  assert.equal(jtdItems.ok && jtdItems.costs["02-310.C"], 35500, "two posted lines on 02-310.C should sum to 35,500");
  assert.equal(jtdItems.ok && jtdItems.costs["01-030.M"], 768.66, "unmapped code should default to a matching QBO Product/Service number");
  assert.ok(jtdItems.ok && jtdItems.costs["09-925.L"] === undefined, "code mapped to an item with no paid Bill postings is omitted (not zeroed)");
  const customerLookup = calls.find((c) => c.url.includes("FROM%20Customer"));
  assert.ok(customerLookup, "must look up the Customer:Job for the project");
  const billQuery = calls.find((c) => c.url.includes("FROM%20Bill"));
  assert.ok(billQuery, "must query Bills for the items-based paid-cost pull");
  const detailReport = calls.find((c) => c.url.includes("/reports/ProfitAndLossDetail"));
  assert.equal(detailReport, undefined, "items-based paid-cost pull should not rely on ProfitAndLossDetail");
  // The legacy account-based P&L must NOT be called when every code is item-mapped.
  const accountReport = calls.find((c) => /reports\/ProfitAndLoss\?/.test(c.url));
  assert.equal(accountReport, undefined, "items-only mapping should not trigger the account-based P&L");
  pass("items-based pull resolves Customer:Job, sums paid Bill item lines, and aggregates correctly");

  // ── 12. Mixed mapping: some codes by Item, others by Account (legacy) ───────
  console.log("\n[12] Mixed (items + accounts) pull");
  process.env.QBO_BUDGET_CODE_MAP = JSON.stringify({
    "02-310.C": { item: "02-310.C" },         // items path
    "10-100.M": { account: "Job Materials" }, // legacy account path
  });
  scenario.customerExists = true;
  scenario.classExists = true;
  calls.length = 0;
  const jtdMixed = await fetchQBOJobToDateCosts("co-1", appCreds, prodCreds, {
    projectName: "EH Sitework",
    budgetCodes: ["02-310.C", "10-100.M"],
  });
  scenario.customerExists = false;
  scenario.classExists = false;
  delete process.env.QBO_BUDGET_CODE_MAP;

  assert.ok(jtdMixed.ok, `mixed pull failed: ${!jtdMixed.ok ? jtdMixed.error : ""}`);
  assert.equal(jtdMixed.ok && jtdMixed.costs["02-310.C"], 35500, "items-mapped code resolved via paid Bill item lines");
  assert.equal(jtdMixed.ok && jtdMixed.costs["10-100.M"], 30000, "account-mapped code resolved via PnL by Class");
  const detailCall = calls.find((c) => c.url.includes("FROM%20Bill"));
  const summaryCall = calls.find((c) => /reports\/ProfitAndLoss\?/.test(c.url));
  assert.ok(detailCall, "items path still runs");
  assert.ok(summaryCall, "legacy account path still runs in parallel");
  pass("mixed mapping merges item-based and account-based costs in one resync");

  // ── 13. Explicit per-project QBO Customer override bypasses name lookup ────
  console.log("\n[13] Explicit per-project QBO Customer override");
  process.env.QBO_BUDGET_CODE_MAP = JSON.stringify({
    "02-310.C": { item: "02-310.C" },
  });
  // customerExists is FALSE — so any name-based lookup would not match the
  // project. The pinned id below must short-circuit the lookup entirely.
  scenario.customerExists = false;
  calls.length = 0;
  const jtdPinned = await fetchQBOJobToDateCosts("co-1", appCreds, prodCreds, {
    projectName: "Doesn't matter — override is set",
    qboCustomerId: "PINNED-777",
    budgetCodes: ["02-310.C"],
  });
  delete process.env.QBO_BUDGET_CODE_MAP;

  assert.ok(jtdPinned.ok, `pinned-id pull failed: ${!jtdPinned.ok ? jtdPinned.error : ""}`);
  assert.equal(jtdPinned.ok && jtdPinned.costs["02-310.C"], 777, "pinned project id must scope paid Bill item costs to the pinned CustomerRef");
  const noCustomerLookup = calls.find((c) => c.url.includes("FROM%20Customer"));
  assert.equal(noCustomerLookup, undefined, "explicit override must skip the Customer name lookup entirely");
  const pinnedBillQuery = calls.find((c) => c.url.includes("FROM%20Bill"));
  assert.ok(pinnedBillQuery, "must still query Bills");
  assert.equal(calls.some((c) => c.url.includes("/reports/ProfitAndLossDetail")), false, "pinned paid-cost pull should not rely on PnLDetail");
  pass("explicit QBO Customer id pinned on the project skips name lookup and scopes the report directly");

  console.log(`\nAll ${passed} QBO integration checks passed.`);
}

main().catch((err) => {
  console.error("\n✗ QBO integration check FAILED:");
  console.error(err);
  process.exit(1);
});
