import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";
import { requireToolLevel } from "@/lib/tool-permissions";
import { fillPermitApplication, normalizePermitFields } from "@/lib/permit-application-processor";

export const runtime = "nodejs";
export const maxDuration = 60;

// Accepts the original permit PDF plus the user-reviewed field values
// (multipart fields "file", "title", "fields"), fills the PDF, stores the
// completed copy, records it, and streams the filled PDF back so the
// browser can download it.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;

  const denied = await requireToolLevel(session, projectId, "permit-applications", "standard");
  if (denied) return denied;

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const title = String(formData.get("title") ?? "").trim();
  const fieldsRaw = String(formData.get("fields") ?? "[]");

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (file.type && file.type !== "application/pdf") {
    return NextResponse.json({ error: "Only PDF files are supported" }, { status: 400 });
  }
  if (!title) {
    return NextResponse.json({ error: "A title is required" }, { status: 400 });
  }

  let parsedFields: unknown;
  try {
    parsedFields = JSON.parse(fieldsRaw);
  } catch {
    return NextResponse.json({ error: "Invalid fields payload" }, { status: 400 });
  }
  const fields = normalizePermitFields(parsedFields);

  const sourceBuffer = Buffer.from(await file.arrayBuffer());

  let pdfBuffer: Buffer;
  try {
    const pdfBytes = await fillPermitApplication(sourceBuffer, fields, title);
    pdfBuffer = Buffer.from(pdfBytes);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to build the completed permit PDF";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const safeTitle =
    title.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 80) ||
    "permit-application";
  const finalFilename = `${safeTitle}.pdf`;
  const storagePath = `${projectId}/_permit-completed/${Date.now()}-${finalFilename}`;

  const supabase = getSupabase();
  const { error: uploadError } = await supabase.storage
    .from("project-drawings")
    .upload(storagePath, pdfBuffer, { contentType: "application/pdf", upsert: false });
  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: inserted, error: insertError } = await supabase
    .from("project_permit_applications")
    .insert({
      project_id: projectId,
      title,
      source_filename: file.name,
      final_filename: finalFilename,
      final_storage_path: storagePath,
      fields,
      created_by: session.id,
    })
    .select("id")
    .single();

  if (insertError) {
    void supabase.storage.from("project-drawings").remove([storagePath]);
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  const headers = new Headers();
  headers.set("Content-Type", "application/pdf");
  headers.set("Content-Disposition", `attachment; filename="${finalFilename}"`);
  headers.set("X-Permit-Id", inserted.id);
  headers.set("X-Permit-Filename", encodeURIComponent(finalFilename));

  return new Response(pdfBuffer as unknown as BodyInit, { status: 200, headers });
}
