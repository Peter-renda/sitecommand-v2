/**
 * GET /api/projects/[id]/emails/triage
 *
 * Lists the caller's inbox conversations that are candidates for the
 * "New Emails" triage box on the project Emails page: threads from their
 * connected Outlook/Gmail account that are neither already linked to this
 * project nor previously declined by this user for this project.
 *
 * Returns { connected: false, messages: [] } when the user has no email
 * connection so the UI can hide the box without treating it as an error.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";
import { canAccessProject } from "@/lib/project-access";
import { getActiveEmailConnection, fetchActiveInbox } from "@/lib/email-connection";
import { isReconnectRequired } from "@/lib/email-errors";
import type { GraphMessage } from "@/lib/microsoft-graph";

// Newest-first cap so the card deck stays manageable on mailboxes with a
// large backlog of never-triaged threads.
const TRIAGE_LIMIT = 30;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;
  if (!(await canAccessProject(projectId, session))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const connection = await getActiveEmailConnection(session.id);
  if (!connection) return NextResponse.json({ connected: false, messages: [] });

  let inbox: GraphMessage[];
  try {
    inbox = await fetchActiveInbox(session.id);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    // No connection, or a revoked/expired token: hide the triage deck rather
    // than erroring. The connection's reconnect prompt is surfaced elsewhere
    // (the Link Emails modal) where it's actionable.
    if (message.includes("connection found") || isReconnectRequired(message)) {
      return NextResponse.json({ connected: false, messages: [] });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const supabase = getSupabase();
  const [linkedRes, dismissedRes] = await Promise.all([
    supabase
      .from("project_email_threads")
      .select("graph_conversation_id")
      .eq("project_id", projectId),
    supabase
      .from("project_email_triage_dismissals")
      .select("graph_conversation_id")
      .eq("project_id", projectId)
      .eq("user_id", session.id),
  ]);

  const excluded = new Set<string>([
    ...(linkedRes.data ?? []).map((r) => r.graph_conversation_id as string),
    ...(dismissedRes.data ?? []).map((r) => r.graph_conversation_id as string),
  ]);

  // One card per conversation: keep the most recent message of each thread.
  const byConversation = new Map<string, GraphMessage>();
  for (const msg of inbox) {
    if (!msg.conversationId || excluded.has(msg.conversationId)) continue;
    const existing = byConversation.get(msg.conversationId);
    if (!existing || new Date(msg.receivedDateTime) > new Date(existing.receivedDateTime)) {
      byConversation.set(msg.conversationId, msg);
    }
  }

  const messages = [...byConversation.values()]
    .sort((a, b) => new Date(b.receivedDateTime).getTime() - new Date(a.receivedDateTime).getTime())
    .slice(0, TRIAGE_LIMIT);

  return NextResponse.json({ connected: true, messages });
}
