import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";

const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;
  const supabase = getSupabase();

  const { data: rows, error } = await supabase
    .from("project_transaction_orders")
    .select(
      "id, vendor, amount, scope, pi_code, cost_code, to_date, source_filename, final_filename, final_storage_path, created_at, created_by",
    )
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const orders = await Promise.all(
    (rows ?? []).map(async (row) => {
      const { data: urlData } = await supabase.storage
        .from("transaction-orders")
        .createSignedUrl(row.final_storage_path, SIGNED_URL_TTL_SECONDS);
      return {
        id: row.id,
        vendor: row.vendor,
        amount: row.amount,
        scope: row.scope,
        piCode: row.pi_code,
        costCode: row.cost_code,
        date: row.to_date,
        sourceFilename: row.source_filename,
        filename: row.final_filename,
        url: urlData?.signedUrl ?? null,
        createdAt: row.created_at,
      };
    }),
  );

  return NextResponse.json({ transactionOrders: orders });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;

  let body: {
    vendor?: unknown;
    amount?: unknown;
    scope?: unknown;
    piCode?: unknown;
    costCode?: unknown;
    date?: unknown;
    sourceFilename?: unknown;
    sourceStoragePath?: unknown;
    filename?: unknown;
    storagePath?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON body" }, { status: 400 });
  }

  const filename = typeof body.filename === "string" ? body.filename : "";
  const storagePath = typeof body.storagePath === "string" ? body.storagePath : "";
  if (!filename || !storagePath) {
    return NextResponse.json(
      { error: "filename and storagePath are required" },
      { status: 400 },
    );
  }
  if (!storagePath.startsWith(`${projectId}/_completed/`)) {
    return NextResponse.json({ error: "Invalid storagePath" }, { status: 400 });
  }

  const amountStr = typeof body.amount === "string" ? body.amount.replace(/[$,]/g, "") : "";
  const amountNum = amountStr ? Number(amountStr) : null;

  const dateStr = typeof body.date === "string" ? body.date : "";
  // dateStr arrives as MM/DD/YYYY from the processor; convert to ISO date for storage.
  let isoDate: string | null = null;
  const m = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) isoDate = `${m[3]}-${m[1]}-${m[2]}`;

  const supabase = getSupabase();
  const { data: inserted, error: insertError } = await supabase
    .from("project_transaction_orders")
    .insert({
      project_id: projectId,
      vendor: typeof body.vendor === "string" ? body.vendor : null,
      amount: amountNum != null && Number.isFinite(amountNum) ? amountNum : null,
      scope: typeof body.scope === "string" ? body.scope : null,
      pi_code: typeof body.piCode === "string" ? body.piCode : null,
      cost_code: typeof body.costCode === "string" ? body.costCode : null,
      to_date: isoDate,
      source_filename: typeof body.sourceFilename === "string" ? body.sourceFilename : null,
      source_storage_path:
        typeof body.sourceStoragePath === "string" ? body.sourceStoragePath : null,
      final_filename: filename,
      final_storage_path: storagePath,
      created_by: session.id,
    })
    .select("id")
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ id: inserted.id });
}
