import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;
  const filename = new URL(req.url).searchParams.get("filename") ?? "specification-book.pdf";
  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  // Persistent spec book PDFs live under _spec-book/ in the project-drawings
  // bucket, which already has the 250 MB file_size_limit needed for large
  // specification PDFs (migration 124).
  const storagePath = `${projectId}/_spec-book/${Date.now()}-${safeFilename}`;

  const supabase = getSupabase();
  const { data, error } = await supabase.storage
    .from("project-drawings")
    .createSignedUploadUrl(storagePath);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ signedUrl: data.signedUrl, storagePath });
}
