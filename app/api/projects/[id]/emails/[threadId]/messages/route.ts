/**
 * GET /api/projects/[id]/emails/[threadId]/messages
 *
 * Returns the full message chain for a linked email thread, fetched live
 * from the user's connected provider (Gmail or Outlook).
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";
import { fetchActiveThread } from "@/lib/email-connection";
import { persistThreadMessages, getStoredThreadMessages } from "@/lib/email-messages";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; threadId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId, threadId } = await params;
  const supabase = getSupabase();

  // Validate the thread belongs to this project and resolve its conversation id.
  const { data: row } = await supabase
    .from("project_email_threads")
    .select("graph_conversation_id, subject")
    .eq("id", threadId)
    .eq("project_id", projectId)
    .single();

  if (!row) return NextResponse.json({ error: "Thread not found" }, { status: 404 });

  // Training sandbox emails are seeded locally and have no live mailbox behind
  // them, so always serve the stored copy (skip the provider fetch entirely).
  const { data: project } = await supabase
    .from("projects")
    .select("is_training")
    .eq("id", projectId)
    .maybeSingle();
  if (project?.is_training) {
    const stored = await getStoredThreadMessages(supabase, threadId);
    // Report the trainee's own address as the account so the reply composer
    // treats their seeded outreach as "sent by me" and targets the sub.
    return NextResponse.json({
      provider: null,
      accountEmail: session.email ?? null,
      subject: row.subject,
      messages: stored,
      stored: true,
    });
  }

  try {
    const { provider, accountEmail, messages } = await fetchActiveThread(
      session.id,
      row.graph_conversation_id
    );
    // Refresh the stored copy so the thread stays readable (and feeds Assist)
    // even when no one with a live connection is around. Non-fatal.
    await persistThreadMessages(supabase, { threadId, projectId, messages }).catch(() => {});
    return NextResponse.json({ provider, accountEmail, subject: row.subject, messages });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const notConnected =
      message.includes("No Gmail connection found") ||
      message.includes("No Outlook connection found") ||
      message.includes("No email connection found");

    // No live connection — fall back to the stored copy of the thread.
    if (notConnected) {
      const stored = await getStoredThreadMessages(supabase, threadId);
      if (stored.length) {
        return NextResponse.json({
          provider: null,
          accountEmail: null,
          subject: row.subject,
          messages: stored,
          stored: true,
        });
      }
      return NextResponse.json({ error: "not_connected" }, { status: 403 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
