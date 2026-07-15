import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";
import {
  fillTransactionOrder,
  loadDefaultTemplate,
  type ExtractedFields,
} from "@/lib/transaction-order-processor";

export const runtime = "nodejs";
export const maxDuration = 60;

// Re-fills a TO packet using caller-supplied field values instead of running
// Gemini extraction. Used when the user edits fields in the review modal.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;
  const supabase = getSupabase();

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (file.type && file.type !== "application/pdf") {
    return NextResponse.json({ error: "Only PDF files are supported" }, { status: 400 });
  }

  const fields: ExtractedFields = {
    vendor: String(formData.get("vendor") ?? "").trim(),
    amount: String(formData.get("amount") ?? "").trim(),
    scope: String(formData.get("scope") ?? "").trim(),
    pi_code: String(formData.get("piCode") ?? "").trim(),
    cost_code: String(formData.get("costCode") ?? "").trim(),
  };

  const sourceBuffer = Buffer.from(await file.arrayBuffer());

  let templateBytes: Buffer;
  const { data: tmplRow } = await supabase
    .from("project_transaction_order_templates")
    .select("storage_path")
    .eq("project_id", projectId)
    .maybeSingle();

  if (tmplRow?.storage_path) {
    const { data: tmplBlob, error: tmplErr } = await supabase.storage
      .from("project-drawings")
      .download(tmplRow.storage_path);
    if (tmplErr || !tmplBlob) {
      return NextResponse.json(
        { error: tmplErr?.message ?? "Could not download project TO template" },
        { status: 500 },
      );
    }
    templateBytes = Buffer.from(await tmplBlob.arrayBuffer());
  } else {
    templateBytes = await loadDefaultTemplate();
  }

  let result;
  try {
    result = await fillTransactionOrder(templateBytes, sourceBuffer, fields);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to build TO packet";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const headers = new Headers();
  headers.set("Content-Type", "application/pdf");
  headers.set("X-TO-Vendor", encodeURIComponent(result.fields.vendor || ""));
  headers.set("X-TO-Amount", encodeURIComponent(result.fields.amount || ""));
  headers.set("X-TO-Scope", encodeURIComponent(result.fields.scope || ""));
  headers.set("X-TO-Pi-Code", encodeURIComponent(result.fields.pi_code || ""));
  headers.set("X-TO-Cost-Code", encodeURIComponent(result.fields.cost_code || ""));
  headers.set("X-TO-Date", encodeURIComponent(result.date));
  headers.set("X-TO-Source-Filename", encodeURIComponent(file.name));

  const slug = (result.fields.vendor || "Transaction_Order").replace(/[^A-Za-z0-9]+/g, "_");
  const dateForName = result.date.replace(/\//g, "-");
  const downloadName = `TO_${slug}_${dateForName}.pdf`;
  headers.set("Content-Disposition", `attachment; filename="${downloadName}"`);
  headers.set("X-TO-Filename", encodeURIComponent(downloadName));

  return new Response(result.pdfBytes as unknown as BodyInit, { status: 200, headers });
}
