import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";
import { requireToolLevel } from "@/lib/tool-permissions";

const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour

// Lists the completed permit applications for a project, each with a fresh
// signed URL to open the filled PDF.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;

  const denied = await requireToolLevel(session, projectId, "permit-applications", "read_only");
  if (denied) return denied;

  const supabase = getSupabase();
  const { data: rows, error } = await supabase
    .from("project_permit_applications")
    .select(
      "id, title, source_filename, final_filename, final_storage_path, created_at, created_by",
    )
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const permitApplications = await Promise.all(
    (rows ?? []).map(async (row) => {
      const { data: urlData } = await supabase.storage
        .from("project-drawings")
        .createSignedUrl(row.final_storage_path, SIGNED_URL_TTL_SECONDS);
      return {
        id: row.id,
        title: row.title,
        sourceFilename: row.source_filename,
        filename: row.final_filename,
        url: urlData?.signedUrl ?? null,
        createdAt: row.created_at,
        createdBy: row.created_by,
      };
    }),
  );

  return NextResponse.json({ permitApplications });
}
