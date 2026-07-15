import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getSession } from "@/lib/auth";

const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("scope_division_attachments")
    .select("id, division_code, filename, storage_path, file_type, file_size, extracted_text, uploaded_at")
    .eq("project_id", projectId)
    .order("uploaded_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const attachments = await Promise.all(
    (data || []).map(async (row) => {
      const { data: urlData } = await supabase.storage
        .from("project-drawings")
        .createSignedUrl(row.storage_path, SIGNED_URL_TTL_SECONDS);
      return {
        id: row.id,
        divisionCode: row.division_code,
        filename: row.filename,
        fileType: row.file_type,
        fileSize: row.file_size,
        extractedText: row.extracted_text,
        uploadedAt: row.uploaded_at,
        url: urlData?.signedUrl ?? null,
      };
    })
  );

  return NextResponse.json({ attachments });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;

  let body: {
    divisionCode?: unknown;
    filename?: unknown;
    storagePath?: unknown;
    fileType?: unknown;
    fileSize?: unknown;
    extractedText?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON body" }, { status: 400 });
  }

  const divisionCode = typeof body.divisionCode === "string" ? body.divisionCode.trim() : "";
  const filename = typeof body.filename === "string" ? body.filename.trim() : "";
  const storagePath = typeof body.storagePath === "string" ? body.storagePath : "";
  const fileType = typeof body.fileType === "string" ? body.fileType : null;
  const fileSize =
    typeof body.fileSize === "number" && Number.isFinite(body.fileSize)
      ? Math.max(0, Math.floor(body.fileSize))
      : null;
  const extractedText = typeof body.extractedText === "string" ? body.extractedText : "";

  if (!divisionCode || !filename || !storagePath) {
    return NextResponse.json(
      { error: "divisionCode, filename, and storagePath are required" },
      { status: 400 }
    );
  }
  // Storage paths must live under this project's scope-attachments prefix.
  if (!storagePath.startsWith(`${projectId}/_scope-attachments/`)) {
    return NextResponse.json({ error: "Invalid storagePath" }, { status: 400 });
  }

  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("scope_division_attachments")
    .insert({
      project_id: projectId,
      division_code: divisionCode,
      filename,
      storage_path: storagePath,
      file_type: fileType,
      file_size: fileSize,
      extracted_text: extractedText,
      uploaded_by: session.id ?? null,
    })
    .select("id, division_code, filename, storage_path, file_type, file_size, extracted_text, uploaded_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: urlData } = await supabase.storage
    .from("project-drawings")
    .createSignedUrl(data.storage_path, SIGNED_URL_TTL_SECONDS);

  return NextResponse.json({
    attachment: {
      id: data.id,
      divisionCode: data.division_code,
      filename: data.filename,
      fileType: data.file_type,
      fileSize: data.file_size,
      extractedText: data.extracted_text,
      uploadedAt: data.uploaded_at,
      url: urlData?.signedUrl ?? null,
    },
  });
}
