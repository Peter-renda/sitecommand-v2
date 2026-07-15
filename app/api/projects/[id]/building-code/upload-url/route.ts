import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";

function isSuperAdmin(session: { company_role?: string | null }): boolean {
  return session.company_role === "super_admin";
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session || !isSuperAdmin(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: projectId } = await params;
  const filename = new URL(req.url).searchParams.get("filename") ?? "building-code.pdf";
  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  // Building-code PDFs live under _building-code/ in the project-drawings bucket,
  // which already carries the larger file-size limit used for reference docs.
  const storagePath = `${projectId}/_building-code/${Date.now()}-${safeFilename}`;

  const supabase = getSupabase();
  const { data, error } = await supabase.storage
    .from("project-drawings")
    .createSignedUploadUrl(storagePath);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ signedUrl: data.signedUrl, storagePath });
}
