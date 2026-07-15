import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";

function isSuperAdmin(session: { company_role?: string | null }): boolean {
  return session.company_role === "super_admin";
}

// PATCH — rename a document, edit its link/jurisdiction, or act on an AI
// suggestion (approve / ignore). Super Admin or Admin only.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> },
) {
  const session = await getSession();
  if (!session || !isSuperAdmin(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: projectId, docId } = await params;

  let body: { title?: unknown; jurisdiction?: unknown; url?: unknown; action?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON body" }, { status: 400 });
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (typeof body.title === "string" && body.title.trim()) update.title = body.title.trim();
  if (typeof body.jurisdiction === "string") update.jurisdiction = body.jurisdiction.trim() || null;
  if (typeof body.url === "string" && body.url.trim()) update.url = body.url.trim();

  // Approving / ignoring an AI suggestion. Once set, the decision is final.
  if (body.action === "approve") update.status = "approved";
  else if (body.action === "ignore") update.status = "ignored";

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("project_building_code_documents")
    .update(update)
    .eq("id", docId)
    .eq("project_id", projectId)
    .select("id, title, jurisdiction, doc_type, url, storage_path, filename, source, status, notes, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ document: data });
}

// DELETE — remove a document (and its stored file). Super Admin or Admin only.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> },
) {
  const session = await getSession();
  if (!session || !isSuperAdmin(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: projectId, docId } = await params;
  const supabase = getSupabase();

  const { data: existing } = await supabase
    .from("project_building_code_documents")
    .select("storage_path")
    .eq("id", docId)
    .eq("project_id", projectId)
    .maybeSingle();

  const { error } = await supabase
    .from("project_building_code_documents")
    .delete()
    .eq("id", docId)
    .eq("project_id", projectId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (existing?.storage_path) {
    void supabase.storage.from("project-drawings").remove([existing.storage_path]);
  }

  return NextResponse.json({ ok: true });
}
