import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { canAccessProject } from "@/lib/project-access";
import { getSupabase } from "@/lib/supabase";

const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour

type DocRow = {
  id: string;
  title: string;
  jurisdiction: string | null;
  doc_type: "link" | "file";
  url: string | null;
  storage_path: string | null;
  filename: string | null;
  source: "manual" | "ai";
  status: "suggested" | "approved" | "ignored";
  notes: string | null;
  created_at: string;
};

function isSuperAdmin(session: { company_role?: string | null }): boolean {
  return session.company_role === "super_admin";
}

// Build the client-facing shape, resolving a fresh signed URL for file documents.
async function serializeDoc(
  supabase: ReturnType<typeof getSupabase>,
  row: DocRow,
): Promise<{
  id: string;
  title: string;
  jurisdiction: string | null;
  docType: "link" | "file";
  url: string | null;
  filename: string | null;
  source: "manual" | "ai";
  status: "suggested" | "approved" | "ignored";
  notes: string | null;
  createdAt: string;
}> {
  let url = row.url;
  if (row.doc_type === "file" && row.storage_path) {
    const { data } = await supabase.storage
      .from("project-drawings")
      .createSignedUrl(row.storage_path, SIGNED_URL_TTL_SECONDS);
    url = data?.signedUrl ?? null;
  }
  return {
    id: row.id,
    title: row.title,
    jurisdiction: row.jurisdiction,
    docType: row.doc_type,
    url,
    filename: row.filename,
    source: row.source,
    status: row.status,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;
  if (!(await canAccessProject(projectId, session))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("project_building_code_documents")
    .select("id, title, jurisdiction, doc_type, url, storage_path, filename, source, status, notes, created_at")
    .eq("project_id", projectId)
    .in("status", ["suggested", "approved"])
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []) as DocRow[];
  const documents = await Promise.all(rows.map((r) => serializeDoc(supabase, r)));

  return NextResponse.json({
    approved: documents.filter((d) => d.status === "approved"),
    suggested: documents.filter((d) => d.status === "suggested"),
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session || !isSuperAdmin(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: projectId } = await params;

  let body: {
    title?: unknown;
    jurisdiction?: unknown;
    docType?: unknown;
    url?: unknown;
    storagePath?: unknown;
    filename?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON body" }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const jurisdiction = typeof body.jurisdiction === "string" ? body.jurisdiction.trim() : "";
  const docType = body.docType === "file" ? "file" : "link";

  if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 });

  const insert: Record<string, unknown> = {
    project_id: projectId,
    title,
    jurisdiction: jurisdiction || null,
    doc_type: docType,
    source: "manual",
    status: "approved",
    created_by: session.id,
  };

  if (docType === "link") {
    const url = typeof body.url === "string" ? body.url.trim() : "";
    if (!url) return NextResponse.json({ error: "URL is required for a link" }, { status: 400 });
    insert.url = url;
  } else {
    const storagePath = typeof body.storagePath === "string" ? body.storagePath : "";
    const filename = typeof body.filename === "string" ? body.filename : "";
    if (!storagePath) return NextResponse.json({ error: "storagePath is required for a file" }, { status: 400 });
    // Guard against path traversal: uploads must live under this project's prefix.
    if (!storagePath.startsWith(`${projectId}/_building-code/`)) {
      return NextResponse.json({ error: "Invalid storagePath" }, { status: 400 });
    }
    insert.storage_path = storagePath;
    insert.filename = filename || "document.pdf";
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("project_building_code_documents")
    .insert(insert)
    .select("id, title, jurisdiction, doc_type, url, storage_path, filename, source, status, notes, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const document = await serializeDoc(supabase, data as DocRow);
  return NextResponse.json({ document });
}
