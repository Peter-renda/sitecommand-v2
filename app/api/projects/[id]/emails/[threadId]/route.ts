/**
 * DELETE /api/projects/[id]/emails/[threadId]
 *
 * Unlinks an email thread from a project.
 * Only removes the DB row — no Graph API calls; the email is unaffected.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; threadId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId, threadId } = await params;
  const supabase = getSupabase();

  const { error } = await supabase
    .from("project_email_threads")
    .delete()
    .eq("id", threadId)
    .eq("project_id", projectId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: true });
}
