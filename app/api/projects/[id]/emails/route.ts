/**
 * GET  /api/projects/[id]/emails  — list email threads linked to this project
 * POST /api/projects/[id]/emails  — link a Graph conversation thread to this project
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("project_email_threads")
    .select("*")
    .eq("project_id", projectId)
    .order("linked_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;
  const body = await req.json();
  const {
    graphConversationId,
    subject,
    participants,
    latestMessagePreview,
    latestReceivedAt,
    messageCount,
  } = body;

  if (!graphConversationId) {
    return NextResponse.json({ error: "graphConversationId is required" }, { status: 400 });
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("project_email_threads")
    .upsert(
      [
        {
          project_id: projectId,
          graph_conversation_id: graphConversationId,
          subject: subject ?? "(no subject)",
          participants: participants ?? [],
          latest_message_preview: latestMessagePreview ?? "",
          latest_received_at: latestReceivedAt ?? null,
          message_count: messageCount ?? 1,
          linked_by: session.id,
          linked_at: new Date().toISOString(),
        },
      ],
      { onConflict: "project_id,graph_conversation_id" }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
