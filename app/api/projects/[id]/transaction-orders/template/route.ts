import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";

const SIGNED_URL_TTL_SECONDS = 60 * 60;
const DEFAULT_TEMPLATE_URL = "/transaction-orders/Fillable_Transaction_Order_template.pdf";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;
  const supabase = getSupabase();

  const { data: row, error } = await supabase
    .from("project_transaction_order_templates")
    .select("id, filename, storage_path, uploaded_at")
    .eq("project_id", projectId)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (!row) {
    return NextResponse.json({
      template: {
        isDefault: true,
        filename: "Fillable_Transaction_Order_template.pdf",
        url: DEFAULT_TEMPLATE_URL,
        uploadedAt: null,
      },
    });
  }

  const { data: urlData } = await supabase.storage
    .from("transaction-orders")
    .createSignedUrl(row.storage_path, SIGNED_URL_TTL_SECONDS);

  return NextResponse.json({
    template: {
      id: row.id,
      isDefault: false,
      filename: row.filename,
      url: urlData?.signedUrl ?? null,
      uploadedAt: row.uploaded_at,
    },
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;

  let body: { storagePath?: unknown; filename?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON body" }, { status: 400 });
  }

  const storagePath = typeof body.storagePath === "string" ? body.storagePath : "";
  const filename = typeof body.filename === "string" ? body.filename : "";
  if (!storagePath || !filename) {
    return NextResponse.json({ error: "storagePath and filename are required" }, { status: 400 });
  }
  if (!storagePath.startsWith(`${projectId}/_template/`)) {
    return NextResponse.json({ error: "Invalid storagePath" }, { status: 400 });
  }

  const supabase = getSupabase();

  const { data: existing } = await supabase
    .from("project_transaction_order_templates")
    .select("storage_path")
    .eq("project_id", projectId)
    .maybeSingle();
  if (existing?.storage_path && existing.storage_path !== storagePath) {
    void supabase.storage.from("transaction-orders").remove([existing.storage_path]);
  }

  const { data: upserted, error: upsertError } = await supabase
    .from("project_transaction_order_templates")
    .upsert(
      {
        project_id: projectId,
        filename,
        storage_path: storagePath,
        uploaded_at: new Date().toISOString(),
        uploaded_by: session.id,
      },
      { onConflict: "project_id" },
    )
    .select("id, filename, uploaded_at")
    .single();

  if (upsertError) return NextResponse.json({ error: upsertError.message }, { status: 500 });

  return NextResponse.json({
    template: {
      id: upserted.id,
      isDefault: false,
      filename: upserted.filename,
      uploadedAt: upserted.uploaded_at,
    },
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;
  const supabase = getSupabase();

  const { data: existing } = await supabase
    .from("project_transaction_order_templates")
    .select("storage_path")
    .eq("project_id", projectId)
    .maybeSingle();

  const { error: delErr } = await supabase
    .from("project_transaction_order_templates")
    .delete()
    .eq("project_id", projectId);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  if (existing?.storage_path) {
    void supabase.storage.from("transaction-orders").remove([existing.storage_path]);
  }

  return NextResponse.json({ ok: true });
}
