/**
 * POST /api/integrations/erp/resync-budget
 *
 * Two-way ERP sync (pull direction): reads job-to-date (actual) costs from the
 * company's connected accounting ERP — QuickBooks Online OR Sage 300 CRE — and
 * writes them into each budget line item's "Job to Date Costs" column, matched
 * by budget code (the budget line's cost_code, the same key used everywhere else
 * to join budget ↔ commitments).
 *
 * Exactly one ERP may be connected. If both are connected the request is
 * rejected (the connect routes also block connecting a second ERP); if none is
 * connected the request is rejected with a hint to connect one.
 *
 * Body: { projectId: string }
 * Auth: a member of the company that owns the project (ERP data is company-scoped).
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";
import {
  getQBOAppCredentials,
  getQBOCompanyCredentials,
  isQBOConfigured,
  fetchQBOJobToDateCosts,
} from "@/lib/quickbooks";
import {
  getSage300CreAppCredentials,
  getSage300CreCompanyCredentials,
  isSage300CreConnected,
  fetchSage300CreJobToDateCosts,
} from "@/lib/sage300cre";

type ResyncOutcome =
  | { ok: true; costs: Record<string, number>; warning?: string }
  | { ok: false; error: string };

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.company_id) {
    return NextResponse.json({ error: "No company associated with this account" }, { status: 422 });
  }

  const body = await req.json().catch(() => ({}));
  const projectId = typeof body.projectId === "string" ? body.projectId.trim() : "";
  if (!projectId) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }

  const supabase = getSupabase();

  // ERP data is company-scoped, so the project must belong to the caller's company.
  const { data: project } = await supabase
    .from("projects")
    .select("id, company_id, name, project_number, qbo_customer_id")
    .eq("id", projectId)
    .single();
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  if (project.company_id !== session.company_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // ── Determine the single connected ERP ──────────────────────────────────────
  const [qboCo, sageApp, sageCo] = await Promise.all([
    getQBOCompanyCredentials(session.company_id),
    getSage300CreAppCredentials(session.company_id),
    getSage300CreCompanyCredentials(session.company_id),
  ]);
  const qboConnected = isQBOConfigured(qboCo);
  const sageConnected = isSage300CreConnected(sageApp, sageCo);

  if (qboConnected && sageConnected) {
    return NextResponse.json(
      { error: "Both QuickBooks and Sage 300 CRE are connected. Only one ERP integration may be connected at a time — disconnect one in Settings → Integrations." },
      { status: 422 }
    );
  }
  if (!qboConnected && !sageConnected) {
    return NextResponse.json(
      { error: "No ERP integration is connected. Connect QuickBooks Online or Sage 300 CRE in Settings → Integrations first." },
      { status: 422 }
    );
  }

  // ── Budget codes for this project ───────────────────────────────────────────
  const { data: items, error: itemsError } = await supabase
    .from("budget_line_items")
    .select("id, cost_code")
    .eq("project_id", projectId);
  if (itemsError) {
    return NextResponse.json({ error: `Failed to load budget line items: ${itemsError.message}` }, { status: 500 });
  }
  const budgetCodes = Array.from(
    new Set((items ?? []).map((i) => String(i.cost_code ?? "").trim()).filter(Boolean))
  );

  const erp: "quickbooks" | "sage300cre" = qboConnected ? "quickbooks" : "sage300cre";

  if (budgetCodes.length === 0) {
    return NextResponse.json({ ok: true, erp, matched: 0, updated: 0, message: "No budget line items with a budget code to update." });
  }

  // ── Pull job-to-date costs from the connected ERP ───────────────────────────
  let outcome: ResyncOutcome;
  if (qboConnected) {
    const qboApp = await getQBOAppCredentials(session.company_id);
    outcome = await fetchQBOJobToDateCosts(session.company_id, qboApp, qboCo, {
      projectName: project.name,
      qboCustomerId: project.qbo_customer_id ?? null,
      budgetCodes,
    });
  } else {
    outcome = await fetchSage300CreJobToDateCosts(sageApp, sageCo, {
      projectNumber: project.project_number,
      projectName: project.name,
      budgetCodes,
    });
  }

  if (!outcome.ok) {
    await writeLog(supabase, projectId, erp, false, outcome.error);
    return NextResponse.json({ error: outcome.error }, { status: 502 });
  }

  // ── Write costs into job_to_date_costs, matched by budget code ───────────────
  const costs = outcome.costs;
  const matched = Object.keys(costs).length;
  let updated = 0;
  for (const [code, amount] of Object.entries(costs)) {
    const { data: updatedRows, error: updateError } = await supabase
      .from("budget_line_items")
      .update({ job_to_date_costs: amount })
      .eq("project_id", projectId)
      .eq("cost_code", code)
      .select("id");
    if (updateError) {
      await writeLog(supabase, projectId, erp, false, `Failed updating ${code}: ${updateError.message}`);
      return NextResponse.json({ error: `Failed to update budget line for ${code}: ${updateError.message}` }, { status: 500 });
    }
    updated += (updatedRows ?? []).length;
  }

  await writeLog(supabase, projectId, erp, true, null, `matched ${matched} code(s), updated ${updated} line(s)`);

  return NextResponse.json({
    ok: true,
    erp,
    matched,
    updated,
    ...(outcome.warning ? { warning: outcome.warning } : {}),
  });
}

async function writeLog(
  supabase: ReturnType<typeof getSupabase>,
  projectId: string,
  erp: "quickbooks" | "sage300cre",
  ok: boolean,
  error: string | null,
  detail?: string
) {
  try {
    await supabase.from("erp_sync_logs").insert({
      record_type: "budget_job_to_date",
      record_id: projectId,
      integration: erp,
      result: ok ? "success" : "error",
      error_message: ok ? null : error,
      raw_response: detail ?? null,
    });
  } catch {
    /* logging is best-effort */
  }
}
