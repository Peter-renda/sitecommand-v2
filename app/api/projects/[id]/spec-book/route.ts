import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";

const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;
  const supabase = getSupabase();

  const { data: book, error } = await supabase
    .from("project_spec_books")
    .select("id, filename, storage_path, total_pages, uploaded_at")
    .eq("project_id", projectId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!book) return NextResponse.json({ specBook: null });

  const { data: urlData, error: urlError } = await supabase.storage
    .from("project-drawings")
    .createSignedUrl(book.storage_path, SIGNED_URL_TTL_SECONDS);

  if (urlError) return NextResponse.json({ error: urlError.message }, { status: 500 });

  return NextResponse.json({
    specBook: {
      id: book.id,
      filename: book.filename,
      totalPages: book.total_pages,
      uploadedAt: book.uploaded_at,
      url: urlData.signedUrl,
    },
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;

  let body: { storagePath?: unknown; filename?: unknown; totalPages?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON body" }, { status: 400 });
  }

  const storagePath = typeof body.storagePath === "string" ? body.storagePath : "";
  const filename = typeof body.filename === "string" ? body.filename : "";
  const totalPages =
    typeof body.totalPages === "number" && Number.isFinite(body.totalPages)
      ? Math.max(0, Math.floor(body.totalPages))
      : null;

  if (!storagePath || !filename) {
    return NextResponse.json({ error: "storagePath and filename are required" }, { status: 400 });
  }
  // Guard against arbitrary path traversal: persistent spec books must live
  // under this project's _spec-book/ prefix issued by upload-url.
  if (!storagePath.startsWith(`${projectId}/_spec-book/`)) {
    return NextResponse.json({ error: "Invalid storagePath" }, { status: 400 });
  }

  const supabase = getSupabase();

  // Replace any prior spec book for this project (storage file + row).
  const { data: existing } = await supabase
    .from("project_spec_books")
    .select("storage_path")
    .eq("project_id", projectId)
    .maybeSingle();

  if (existing?.storage_path && existing.storage_path !== storagePath) {
    void supabase.storage.from("project-drawings").remove([existing.storage_path]);
  }

  const { data: upserted, error: upsertError } = await supabase
    .from("project_spec_books")
    .upsert(
      {
        project_id: projectId,
        filename,
        storage_path: storagePath,
        total_pages: totalPages,
        uploaded_at: new Date().toISOString(),
      },
      { onConflict: "project_id" }
    )
    .select("id, filename, storage_path, total_pages, uploaded_at")
    .single();

  if (upsertError) return NextResponse.json({ error: upsertError.message }, { status: 500 });

  return NextResponse.json({
    specBook: {
      id: upserted.id,
      filename: upserted.filename,
      totalPages: upserted.total_pages,
      uploadedAt: upserted.uploaded_at,
    },
  });
}
