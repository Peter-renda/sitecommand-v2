import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";
import { isProjectSuperAdmin } from "@/lib/project-access";

// Signed PUT URL for the invoice PDF that's about to be assigned to
// this project's PM. Lives under `{projectId}/_assignments/...`.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;

  // Assigning an invoice is reserved for Company Super Admins.
  if (!(await isProjectSuperAdmin(projectId, session))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const filename = new URL(req.url).searchParams.get("filename") ?? "invoice.pdf";
  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `${projectId}/_assignments/${Date.now()}-${safeFilename}`;

  const supabase = getSupabase();
  const { data, error } = await supabase.storage
    .from("project-drawings")
    .createSignedUploadUrl(storagePath);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ signedUrl: data.signedUrl, storagePath });
}
