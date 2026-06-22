/**
 * GET /api/training/guides/upload-url?filename=…
 *
 * Issues a signed PUT URL for a Super Admin to upload a guide document directly
 * to the private `training-guides` bucket. The returned storagePath is namespaced
 * under the company id and must be passed back to POST /api/training/guides.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";

function isSuperAdmin(session: { company_role?: string | null }): boolean {
  return session.company_role === "super_admin";
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || !isSuperAdmin(session) || !session.company_id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const filename = new URL(req.url).searchParams.get("filename") ?? "guide.pdf";
  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `${session.company_id}/${Date.now()}-${safeFilename}`;

  const supabase = getSupabase();
  const { data, error } = await supabase.storage
    .from("training-guides")
    .createSignedUploadUrl(storagePath);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ signedUrl: data.signedUrl, storagePath });
}
