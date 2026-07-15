/**
 * POST /api/projects/[id]/emails/triage/decline
 *
 * Records that the caller declined to link an inbox conversation to this
 * project. Declined conversations never reappear in this user's triage deck
 * for this project (they can still be linked manually via the
 * "Link Emails to Project" modal).
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";
import { canAccessProject } from "@/lib/project-access";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;
  if (!(await canAccessProject(projectId, session))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { conversationId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.conversationId) {
    return NextResponse.json({ error: "conversationId is required" }, { status: 400 });
  }

  const supabase = getSupabase();
  const { error } = await supabase.from("project_email_triage_dismissals").upsert(
    [
      {
        project_id: projectId,
        user_id: session.id,
        graph_conversation_id: body.conversationId,
        dismissed_at: new Date().toISOString(),
      },
    ],
    { onConflict: "project_id,user_id,graph_conversation_id" }
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
