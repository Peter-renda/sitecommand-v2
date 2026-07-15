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
  const url = new URL(req.url);
  const filename = url.searchParams.get("filename") ?? "attachment";
  const divisionCode = (url.searchParams.get("divisionCode") ?? "").trim();

  if (!divisionCode) {
    return NextResponse.json({ error: "divisionCode is required" }, { status: 400 });
  }

  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const safeDivision = divisionCode.replace(/[^a-zA-Z0-9_-]/g, "_");
  const storagePath = `${projectId}/_scope-attachments/${safeDivision}/${Date.now()}-${safeFilename}`;

  const supabase = getSupabase();
  const { data, error } = await supabase.storage
    .from("project-drawings")
    .createSignedUploadUrl(storagePath);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ signedUrl: data.signedUrl, storagePath });
}
