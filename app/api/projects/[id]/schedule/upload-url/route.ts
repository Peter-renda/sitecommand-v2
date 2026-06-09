import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";

// Issues a signed PUT URL so the client can upload the schedule XML directly
// to Supabase Storage, bypassing Vercel's 4.5 MB serverless request-body limit
// (large MS Project exports can run 30-50 MB).
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;
  const filename = new URL(req.url).searchParams.get("filename") ?? "schedule.xml";
  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  // Unique path per upload so a signed-URL PUT never collides with an existing
  // object; the previous file is cleaned up when the new metadata is registered.
  const storagePath = `${projectId}/${Date.now()}-${safeFilename}`;

  const supabase = getSupabase();
  const { data, error } = await supabase.storage
    .from("project-schedules")
    .createSignedUploadUrl(storagePath);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ signedUrl: data.signedUrl, storagePath });
}
