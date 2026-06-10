/**
 * Offline integration check for the Sage 300 CRE (Agave) client (lib/sage300cre.ts).
 *
 * Run: npx tsx scripts/sage300cre-integration-check.ts
 *
 * Verifies, with a mocked fetch (no Agave credentials or network needed):
 *   1. Required Agave headers + base URL on data calls
 *   2. Link token create + public-token exchange
 *   3. Vendor resolution by name and the "vendor not found" guard
 *   4. Commitment → Purchase Order create payload (vendor by id, per-SOV lines)
 *   5. Idempotent update (PUT /{resource}/{id}) and 404 → recreate fallback
 *   6. Prime contract → AR Invoice create (customer resolved by name)
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
    if (path === "purchase-orders" && method === "POST") {
      return json(201, { id: "PO-100" });
    }
    if (/^purchase-orders\/.+/.test(path) && method === "PUT") {
      return scenario.poUpdateReturns404 ? json(404, { message: "not found" }) : json(200, { id: path.split("/").pop() });
    }
    if (path === "ar-invoices" && method === "POST") {
      return json(201, { id: "AR-200" });
    }
    if (path === "ap-invoices" && method === "POST") {
      return json(201, { id: "AP-300" });
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
    sovLines: [
      { budgetCode: "03-100", description: "Footings", amount: 75000 },
      { budgetCode: "03-200", description: "Slabs", amount: 50000 },
    ],
  });
  assert.ok(createResult.ok, `commitment sync failed: ${!createResult.ok ? createResult.error : ""}`);
  assert.equal(createResult.ok && createResult.id, "PO-100");

  const vendorLookup = agaveCalls().find((c) => c.url.includes("/vendors") && c.method === "GET");
  assert.ok(vendorLookup, "must look up vendors to resolve the contract company by name");
  assert.equal(vendorLookup!.headers["Account-Token"], "acct-xyz", "data calls must send the Account-Token");

  const poCreate = agaveCalls().find((c) => c.url.endsWith("/purchase-orders") && c.method === "POST");
  assert.ok(poCreate, "purchase order must be POSTed");
  const poBody = JSON.parse(poCreate!.body);
  assert.equal(poBody.vendor, "V1", "vendor must post by resolved Agave id, not name");
  assert.equal(poBody.number, "14");
  assert.equal(poBody.issued_date, "2026-05-01", "issued_date should use the commitment start date when no other date");
  assert.equal(poBody.line_items.length, 2, "one line item per SOV line");
  assert.equal(poBody.line_items[0].description, "03-100 — Footings", "line description carries the budget code");
  assert.equal(poBody.line_items[0].amount, 75000);
  pass("resolves vendor by name and POSTs a purchase order with per-SOV-line detail");

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
  const arCreate = agaveCalls().find((c) => c.url.endsWith("/ar-invoices") && c.method === "POST");
  const arBody = JSON.parse(arCreate!.body);
  assert.equal(arBody.customer, "C1", "AR invoice must resolve the owner to a customer id");
  assert.equal(arBody.amount, 1050000, "AR amount must be original + approved change orders");
  pass("prime contract resolves customer by name and posts a revised-amount AR invoice");

  console.log(`\nAll ${passed} Sage 300 CRE integration checks passed.`);
}

main().catch((err) => {
  console.error("\n✗ Sage 300 CRE integration check FAILED:");
  console.error(err);
  process.exit(1);
});
