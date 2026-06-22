/**
 * Training → Guides.
 *
 * GET  /api/training/guides — list the company's guide documents (the Table of
 *      Contents) plus the current user's own assignments. Any member of the
 *      company can view; `canManage` is true only for Company Super Admins.
 * POST /api/training/guides — register a newly-uploaded guide document. Super
 *      Admin only. Body: { title, description?, storagePath, filename, fileType? }.
 *      The file must already have been PUT to the signed URL from
 *      GET /api/training/guides/upload-url.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";

const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour
const BUCKET = "training-guides";

function isSuperAdmin(session: { company_role?: string | null }): boolean {
  return session.company_role === "super_admin";
}

type GuideRow = {
  id: string;
  title: string;
  description: string | null;
  storage_path: string;
  filename: string;
  file_type: string | null;
  sort_order: number;
  created_at: string;
};

async function signGuideUrl(
  supabase: ReturnType<typeof getSupabase>,
  storagePath: string,
): Promise<string | null> {
  const { data } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
  return data?.signedUrl ?? null;
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.company_id) {
    return NextResponse.json({ guides: [], myAssignments: [], canManage: false });
  }

  const supabase = getSupabase();
  const canManage = isSuperAdmin(session);

  const { data: guideRows, error } = await supabase
    .from("training_guides")
    .select("id, title, description, storage_path, filename, file_type, sort_order, created_at")
    .eq("company_id", session.company_id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (guideRows ?? []) as GuideRow[];
  const guideIds = rows.map((r) => r.id);

  // Manager view: how many people each guide is assigned to.
  const assignmentCounts = new Map<string, number>();
  if (canManage && guideIds.length > 0) {
    const { data: counts } = await supabase
      .from("training_guide_assignments")
      .select("guide_id")
      .in("guide_id", guideIds);
    for (const row of counts ?? []) {
      assignmentCounts.set(row.guide_id, (assignmentCounts.get(row.guide_id) ?? 0) + 1);
    }
  }

  const guides = await Promise.all(
    rows.map(async (r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      filename: r.filename,
      fileType: r.file_type,
      sortOrder: r.sort_order,
      createdAt: r.created_at,
      url: await signGuideUrl(supabase, r.storage_path),
      assignmentCount: canManage ? assignmentCounts.get(r.id) ?? 0 : undefined,
    })),
  );

  // The current user's own assignments (the employee view), newest due first.
  const { data: assignmentRows } = await supabase
    .from("training_guide_assignments")
    .select(
      "id, guide_id, due_date, status, completed_at, created_at, training_guides(id, title, description, storage_path, filename, file_type)",
    )
    .eq("user_id", session.id)
    .order("created_at", { ascending: false });

  const myAssignments = await Promise.all(
    (assignmentRows ?? []).map(async (row: Record<string, unknown>) => {
      const guide = row.training_guides as
        | {
            id: string;
            title: string;
            description: string | null;
            storage_path: string;
            filename: string;
            file_type: string | null;
          }
        | null;
      return {
        id: row.id as string,
        guideId: row.guide_id as string,
        title: guide?.title ?? "Guide",
        description: guide?.description ?? null,
        filename: guide?.filename ?? null,
        fileType: guide?.file_type ?? null,
        dueDate: (row.due_date as string | null) ?? null,
        status: (row.status as string) ?? "assigned",
        completedAt: (row.completed_at as string | null) ?? null,
        url: guide?.storage_path ? await signGuideUrl(supabase, guide.storage_path) : null,
      };
    }),
  );

  return NextResponse.json({ guides, myAssignments, canManage });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || !isSuperAdmin(session) || !session.company_id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    title?: unknown;
    description?: unknown;
    storagePath?: unknown;
    filename?: unknown;
    fileType?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON body" }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const storagePath = typeof body.storagePath === "string" ? body.storagePath : "";
  const filename = typeof body.filename === "string" ? body.filename : "";
  const fileType = typeof body.fileType === "string" ? body.fileType : "";

  if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 });
  if (!storagePath) return NextResponse.json({ error: "storagePath is required" }, { status: 400 });
  // Guard against path traversal: uploads must live under this company's prefix.
  if (!storagePath.startsWith(`${session.company_id}/`)) {
    return NextResponse.json({ error: "Invalid storagePath" }, { status: 400 });
  }

  const supabase = getSupabase();

  // Append new guides to the end of the Table of Contents.
  const { data: last } = await supabase
    .from("training_guides")
    .select("sort_order")
    .eq("company_id", session.company_id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextSort = (last?.sort_order ?? 0) + 1;

  const { data, error } = await supabase
    .from("training_guides")
    .insert({
      company_id: session.company_id,
      title,
      description: description || null,
      storage_path: storagePath,
      filename: filename || "guide.pdf",
      file_type: fileType || null,
      sort_order: nextSort,
      created_by: session.id,
    })
    .select("id, title, description, storage_path, filename, file_type, sort_order, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const row = data as GuideRow;
  return NextResponse.json({
    guide: {
      id: row.id,
      title: row.title,
      description: row.description,
      filename: row.filename,
      fileType: row.file_type,
      sortOrder: row.sort_order,
      createdAt: row.created_at,
      url: await signGuideUrl(supabase, row.storage_path),
      assignmentCount: 0,
    },
  });
}
