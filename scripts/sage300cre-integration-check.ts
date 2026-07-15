/**
 * Offline integration check for the Sage 300 CRE (Agave) client (lib/sage300cre.ts).
 *
 * Run: npx tsx scripts/sage300cre-integration-check.ts
 *
 * Verifies, with a mocked fetch (no Agave credentials or network needed):
 *   1. Required Agave headers + base URL on data calls
 *   2. Link token create + public-token exchange
 *   3. Vendor resolution by name and the "vendor not found" guard
 *   4. Commitment → Purchase Order create payload (vendor by id, per-SOV lines,
 *      job + cost-code resolution, quantity detail, due date)
 *   5. Idempotent update (PUT /{resource}/{id}) and 404 → recreate fallback
 *   6. Prime contract → AR Invoice create (customer resolved by name, due date)
 *   7. AP invoice with retention + financial feedback (amount paid / balance / status)
 *   8. AR invoice retention rollup from per-line retainage
 *
 * Exits non-zero on the first failed assertion.
 */

import assert from "node:assert/strict";

// Fake Supabase env so getSupabase() works if touched; pure sync fns take creds directly.
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fake-supabase.local";
process.env.SUPABASE_SERVICE_ROLE_KEY = "fake-service-key";
delete process.env.AGAVE_API_BASE;
delete process.env.AGAVE_API_VERSION;

type RecordedCall = { url: string; method: string; body: string; headers: Record<string, string> };
const calls: RecordedCall[] = [];

const scenario = {
  vendorExists: true,
  poUpdateReturns404: false,
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
  const method = init?.method ?? "GET";
  const headers = (init?.headers as Record<string, string>) ?? {};
  const body = init?.body ? String(init.body) : "";
  calls.push({ url, method, body, headers });

  if (url.startsWith("https://fake-supabase.local/")) {
    return method === "GET" ? json(200, []) : json(201, []);
  }

  if (url.startsWith("https://api.agaveapi.com/")) {
    const path = url.replace("https://api.agaveapi.com/", "");

    if (path === "link/token/create" && method === "POST") {
      return json(200, { link_token: "link-abc" });
    }
    if (path === "link/token/exchange" && method === "POST") {
      return json(200, { account_token: "acct-xyz" });
    }
    if (path.startsWith("vendors") && method === "GET") {
      return json(200, { data: scenario.vendorExists ? [{ id: "V1", name: "Acme Concrete" }] : [] });
    }
    if (path.startsWith("customers") && method === "GET") {
      return json(200, { data: [{ id: "C1", name: "Owner LLC" }] });
    }
    if (path.startsWith("jobs") && method === "GET") {
      return json(200, { data: [{ id: "J1", name: "Riverside Plaza", number: "P-100" }] });
    }
    if (path.startsWith("cost-codes") && method === "GET") {
      return json(200, {
        data: [
          { id: "CC1", code: "03-100", name: "Footings", actual_cost: 42000 },
          { id: "CC2", code: "03-200", name: "Slabs", actual_cost: 18500 },
        ],
      });
    }
    if (path === "purchase-orders" && method === "POST") {
      return json(201, { id: "PO-100", status: "Open" });
    }
    if (/^purchase-orders\/.+/.test(path) && method === "PUT") {
      return scenario.poUpdateReturns404 ? json(404, { message: "not found" }) : json(200, { id: path.split("/").pop() });
    }
    if (path === "ar-invoices" && method === "POST") {
      return json(201, { id: "AR-200", amount: 1050000, amount_paid: 0, balance: 1050000, status: "Open" });
    }
    if (path === "ap-invoices" && method === "POST") {
      return json(201, { id: "AP-300", amount: 75000, amount_paid: 25000, balance: 50000, status: "Open" });
    }
    return json(404, { message: `Unhandled mock path ${path}` });
  }

  return realFetch(input as RequestInfo, init);
}) as typeof fetch;

function agaveCalls(): RecordedCall[] {
  return calls.filter((c) => c.url.startsWith("https://api.agaveapi.com/"));
}

async function main() {
  const {
    createLinkToken,
    exchangePublicToken,
    syncCommitmentToSage300Cre,
    syncPrimeContractToSage300Cre,
    syncAPInvoiceToSage300Cre,
    syncARInvoiceToSage300Cre,
    fetchSage300CreJobToDateCosts,
  } = await import("../lib/sage300cre");

  const app = { clientId: "client-uuid", clientSecret: "client-secret-40chars" };
  const company = { accountToken: "acct-xyz" };

  let passed = 0;
  function pass(name: string) {
    passed++;
    console.log(`  ✓ ${name}`);
  }

  // ── 1. Link token create + headers ──────────────────────────────────────────
  console.log("\n[1] Link token create");
  calls.length = 0;
  const link = await createLinkToken(app, "company-123");
  assert.ok(link.ok && link.linkToken === "link-abc", "createLinkToken should return the link token");
  const createCall = agaveCalls()[0];
  assert.equal(createCall.url, "https://api.agaveapi.com/link/token/create");
  assert.equal(createCall.headers["API-Version"], "2021-11-21", "API-Version header must be set");
  assert.equal(createCall.headers["Client-Id"], "client-uuid", "Client-Id header must be set");
  assert.equal(createCall.headers["Client-Secret"], "client-secret-40chars", "Client-Secret header must be set");
  assert.equal(createCall.headers["Account-Token"], undefined, "link token call must NOT send an Account-Token");
  assert.equal(JSON.parse(createCall.body).reference_id, "company-123", "reference_id must carry the company id");
  pass("createLinkToken posts to /link/token/create with required headers and reference_id");

  // ── 2. Public token exchange ────────────────────────────────────────────────
  console.log("\n[2] Public token exchange");
  calls.length = 0;
  const exchanged = await exchangePublicToken(app, "public-token-123");
  assert.ok(exchanged.ok && exchanged.accountToken === "acct-xyz", "exchange should return the account token");
  assert.equal(JSON.parse(agaveCalls()[0].body).public_token, "public-token-123", "exchange body carries public_token");
  pass("exchangePublicToken posts to /link/token/exchange and returns account_token");

  // ── 3. Commitment → Purchase Order create ───────────────────────────────────
  console.log("\n[3] Subcontract → Purchase Order create");
  calls.length = 0;
  scenario.vendorExists = true;
  const createResult = await syncCommitmentToSage300Cre(app, company, {
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
    project_number: "P-100",
    project_name: "Riverside Plaza",
    sovLines: [
      { budgetCode: "03-100", description: "Footings", amount: 75000 },
      { budgetCode: "03-200", description: "Slabs", amount: 50000, qty: 100, uom: "CY", unitCost: 500 },
    ],
  });
  assert.ok(createResult.ok, `commitment sync failed: ${!createResult.ok ? createResult.error : ""}`);
  assert.equal(createResult.ok && createResult.id, "PO-100");
  assert.ok(createResult.ok && createResult.vendorId === "V1", "result must surface the resolved vendor id");

  const vendorLookup = agaveCalls().find((c) => c.url.includes("/vendors") && c.method === "GET");
  assert.ok(vendorLookup, "must look up vendors to resolve the contract company by name");
  assert.equal(vendorLookup!.headers["Account-Token"], "acct-xyz", "data calls must send the Account-Token");

  const jobLookup = agaveCalls().find((c) => c.url.includes("/jobs") && c.method === "GET");
  assert.ok(jobLookup, "must look up jobs to resolve the project for job costing");

  const poCreate = agaveCalls().find((c) => c.url.endsWith("/purchase-orders") && c.method === "POST");
  assert.ok(poCreate, "purchase order must be POSTed");
  const poBody = JSON.parse(poCreate!.body);
  assert.equal(poBody.vendor, "V1", "vendor must post by resolved Agave id, not name");
  assert.equal(poBody.number, "14");
  assert.equal(poBody.issued_date, "2026-05-01", "issued_date should use the commitment start date when no other date");
  assert.equal(poBody.due_date, "2026-09-30", "due_date should use estimated completion when no delivery date");
  assert.equal(poBody.job_id, "J1", "header must carry the resolved Sage job id (matched by project number)");
  assert.equal(poBody.line_items.length, 2, "one line item per SOV line");
  assert.equal(poBody.line_items[0].description, "03-100 — Footings", "line description carries the budget code");
  assert.equal(poBody.line_items[0].amount, 75000);
  assert.equal(poBody.line_items[0].cost_code_id, "CC1", "budget code must resolve to the Sage cost-code id");
  assert.equal(poBody.line_items[0].job_id, "J1", "every line carries the job id");
  assert.equal(poBody.line_items[1].quantity, 100, "consistent qty × unit cost emits quantity detail");
  assert.equal(poBody.line_items[1].unit_cost, 500);
  assert.equal(poBody.line_items[1].unit_of_measure, "CY");
  pass("resolves vendor/job/cost codes and POSTs a purchase order with full line detail");

  // ── 4. Idempotent update (PUT) ──────────────────────────────────────────────
  console.log("\n[4] Idempotent update");
  calls.length = 0;
  scenario.poUpdateReturns404 = false;
  const updateResult = await syncCommitmentToSage300Cre(
    app, company,
    { id: "c-1", type: "subcontract", number: 14, title: "Concrete package", contract_company: "Acme Concrete", original_contract_amount: 130000, status: "approved", project_id: "p-1" },
    "PO-100"
  );
  assert.ok(updateResult.ok, `update failed: ${!updateResult.ok ? updateResult.error : ""}`);
  const putCall = agaveCalls().find((c) => c.url.endsWith("/purchase-orders/PO-100") && c.method === "PUT");
  assert.ok(putCall, "existing record must be updated via PUT /purchase-orders/{id}");
  const postOnUpdate = agaveCalls().find((c) => c.url.endsWith("/purchase-orders") && c.method === "POST");
  assert.equal(postOnUpdate, undefined, "a successful PUT must not also POST a duplicate");
  pass("update path PUTs by id and does not create a duplicate");

  // ── 5. 404 on update → recreate ─────────────────────────────────────────────
  console.log("\n[5] Deleted-on-source recreate");
  calls.length = 0;
  scenario.poUpdateReturns404 = true;
  const recreate = await syncCommitmentToSage300Cre(
    app, company,
    { id: "c-1", type: "subcontract", number: 14, title: "Concrete package", contract_company: "Acme Concrete", original_contract_amount: 130000, status: "approved", project_id: "p-1" },
    "PO-deleted"
  );
  scenario.poUpdateReturns404 = false;
  assert.ok(recreate.ok && recreate.id === "PO-100", "404 on PUT should fall back to a create");
  const put404 = agaveCalls().find((c) => c.method === "PUT");
  const recreatePost = agaveCalls().find((c) => c.url.endsWith("/purchase-orders") && c.method === "POST");
  assert.ok(put404 && recreatePost, "must attempt PUT, then POST to recreate after a 404");
  pass("a 404 on update recreates the record via POST");

  // ── 6. Vendor not found guard ───────────────────────────────────────────────
  console.log("\n[6] Vendor-not-found guard");
  calls.length = 0;
  scenario.vendorExists = false;
  const missingVendor = await syncCommitmentToSage300Cre(app, company, {
    id: "c-2", type: "purchase_order", number: 20, title: "Lumber", contract_company: "Unknown Vendor",
    original_contract_amount: 5000, status: "draft", project_id: "p-1",
  });
  scenario.vendorExists = true;
  assert.ok(!missingVendor.ok, "sync must fail when the vendor isn't in Sage 300 CRE");
  assert.match(missingVendor.ok ? "" : missingVendor.error, /was not found in Sage 300 CRE/, "error explains the missing vendor");
  const poAttempted = agaveCalls().find((c) => c.url.endsWith("/purchase-orders") && (c.method === "POST" || c.method === "PUT"));
  assert.equal(poAttempted, undefined, "must not POST a purchase order when the vendor is unresolved");
  pass("missing vendor fails fast with a clear message and no write");

  // ── 7. Prime contract → AR Invoice ──────────────────────────────────────────
  console.log("\n[7] Prime contract → AR Invoice");
  calls.length = 0;
  const arResult = await syncPrimeContractToSage300Cre(app, company, {
    id: "pc-1", contract_number: 3, title: "Prime", owner_client: "Owner LLC", contractor: "GC",
    architect_engineer: "AE", description: "Base contract", original_contract_amount: 1000000,
    approved_change_orders: 50000, default_retainage: 10, status: "approved", executed: true,
    start_date: "2026-01-01", estimated_completion_date: "2026-12-31",
  });
  assert.ok(arResult.ok && arResult.id === "AR-200", `AR sync failed: ${!arResult.ok ? arResult.error : ""}`);
  assert.ok(arResult.ok && arResult.customerId === "C1", "result must surface the resolved customer id");
  const arCreate = agaveCalls().find((c) => c.url.endsWith("/ar-invoices") && c.method === "POST");
  const arBody = JSON.parse(arCreate!.body);
  assert.equal(arBody.customer, "C1", "AR invoice must resolve the owner to a customer id");
  assert.equal(arBody.amount, 1050000, "AR amount must be original + approved change orders");
  assert.equal(arBody.due_date, "2026-12-31", "due_date should use the estimated completion date");
  pass("prime contract resolves customer by name and posts a revised-amount AR invoice");

  // ── 8. AP invoice retention + financial feedback ────────────────────────────
  console.log("\n[8] AP invoice retention + financial feedback");
  calls.length = 0;
  const apResult = await syncAPInvoiceToSage300Cre(app, company, {
    commitmentId: "c-1",
    commitmentNumber: 14,
    vendorName: "Acme Concrete",
    description: "Concrete package",
    retainagePct: 10,
    projectNumber: "P-100",
    lineItems: [
      { budgetCode: "03-100", description: "Footings", amount: 50000 },
      { budgetCode: "03-200", description: "Slabs", amount: 25000 },
    ],
  });
  assert.ok(apResult.ok && apResult.id === "AP-300", `AP sync failed: ${!apResult.ok ? apResult.error : ""}`);
  const apCreate = agaveCalls().find((c) => c.url.endsWith("/ap-invoices") && c.method === "POST");
  const apBody = JSON.parse(apCreate!.body);
  assert.equal(apBody.amount, 75000, "AP amount is the sum of billed lines");
  assert.equal(apBody.retention_amount, 7500, "retention_amount = billed × default retainage %");
  assert.equal(apBody.job_id, "J1", "AP invoice carries the resolved job id");
  assert.equal(apBody.line_items[0].cost_code_id, "CC1", "AP lines carry resolved cost codes");
  assert.ok(apResult.ok && apResult.financials?.amountPaid === 25000, "result must parse amount_paid from the response");
  assert.ok(apResult.ok && apResult.financials?.balance === 50000, "result must parse the open balance");
  assert.ok(apResult.ok && apResult.financials?.status === "Open", "result must parse the source status");
  pass("AP invoice posts retention + job costing and parses payment feedback");

  // ── 9. AR invoice retention rollup ──────────────────────────────────────────
  console.log("\n[9] AR invoice retention rollup");
  calls.length = 0;
  const arInvResult = await syncARInvoiceToSage300Cre(app, company, {
    contractId: "pc-1",
    contractNumber: 3,
    customerName: "Owner LLC",
    description: "Pay app #2",
    lineItems: [
      { budgetCode: "01-000", description: "GC work", amount: 40000, retainageAmount: 4000 },
      { budgetCode: "01-100", description: "Sitework", amount: 10000, retainageAmount: 1000 },
    ],
  });
  assert.ok(arInvResult.ok, `AR invoice sync failed: ${!arInvResult.ok ? arInvResult.error : ""}`);
  const arInvCreate = agaveCalls().find((c) => c.url.endsWith("/ar-invoices") && c.method === "POST");
  const arInvBody = JSON.parse(arInvCreate!.body);
  assert.equal(arInvBody.amount, 50000, "AR invoice amount is the sum of this-period lines");
  assert.equal(arInvBody.retention_amount, 5000, "per-line retainage rolls up to the header retention_amount");
  pass("AR invoice rolls per-line retainage up to retention_amount");

  // ── 10. Job-to-date cost pull (two-way: Sage 300 CRE → budget) ──────────────
  console.log("\n[10] Job-to-date cost pull");
  calls.length = 0;
  const jtd = await fetchSage300CreJobToDateCosts(app, company, {
    projectNumber: "P-100",
    projectName: "Riverside Plaza",
    budgetCodes: ["03-100", "03-200", "99-000"],
  });
  assert.ok(jtd.ok, `job-to-date pull failed: ${!jtd.ok ? jtd.error : ""}`);
  assert.equal(jtd.ok && jtd.costs["03-100"], 42000, "actual_cost on cost code 03-100 maps to its budget code");
  assert.equal(jtd.ok && jtd.costs["03-200"], 18500, "actual_cost on cost code 03-200 maps to its budget code");
  assert.ok(jtd.ok && jtd.costs["99-000"] === undefined, "unmatched budget code must be omitted (not zeroed)");
  const ccLookup = agaveCalls().find((c) => c.url.includes("/cost-codes") && c.url.includes("job_id=J1"));
  assert.ok(ccLookup, "must read cost codes scoped to the resolved job id");
  pass("pulls job-to-date costs by budget code from the project's Sage job, skipping unmatched codes");

  console.log(`\nAll ${passed} Sage 300 CRE integration checks passed.`);
}

main().catch((err) => {
  console.error("\n✗ Sage 300 CRE integration check FAILED:");
  console.error(err);
  process.exit(1);
});
