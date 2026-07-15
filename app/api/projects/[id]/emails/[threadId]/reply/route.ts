/**
 * POST /api/projects/[id]/emails/[threadId]/reply
 *
 * Sends an HTML reply (or reply-all) within a linked email thread from the
 * user's connected account.
 * Body: { to: string, subject: string, body: string (HTML), cc?: string[],
 *         replyAll?: boolean, latestMessageId?: string, inReplyTo?: string }
 *
 * Training sandboxes have no live mailbox, so a reply there is stored locally and
 * the counterparty's response is synthesized — realistically via Gemini
 * (lib/training-email-reply.ts), falling back to the canned reply in
 * lib/training-emails.ts when the AI is unavailable.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";
import { sendActiveReply } from "@/lib/email-connection";
import { getStoredThreadMessages, htmlToText } from "@/lib/email-messages";
import { buildCounterpartyReply, firstNameOf } from "@/lib/training-emails";
import {
  generateTrainingCounterpartyReply,
  lookupTrainingCounterparty,
} from "@/lib/training-email-reply";
import { projectTypeLabel } from "@/lib/simulation-constants";
import type { ThreadMessage } from "@/lib/email-types";
import type { SupabaseClient } from "@supabase/supabase-js";

// Gemini reply synthesis can take a while on long threads.
export const maxDuration = 60;

type Trainee = { id: string; email: string; username: string };

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; threadId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId, threadId } = await params;
  const supabase = getSupabase();

  const { data: row } = await supabase
    .from("project_email_threads")
    .select("graph_conversation_id, subject")
    .eq("id", threadId)
    .eq("project_id", projectId)
    .single();

  if (!row) return NextResponse.json({ error: "Thread not found" }, { status: 404 });

  const body = await req.json();
  const { to, subject, body: replyBody, cc, replyAll, latestMessageId, inReplyTo } = body as {
    to?: string;
    subject?: string;
    body?: string;
    cc?: string[];
    replyAll?: boolean;
    latestMessageId?: string;
    inReplyTo?: string;
  };

  if (!replyBody?.trim()) {
    return NextResponse.json({ error: "Reply body is required" }, { status: 400 });
  }

  // Training sandbox: no mailbox to send through. Store the reply locally and let
  // the counterparty answer.
  const { data: project } = await supabase
    .from("projects")
    .select("is_training, name, training_project_type")
    .eq("id", projectId)
    .maybeSingle();
  if (project?.is_training) {
    return handleTrainingReply(supabase, {
      projectId,
      projectName: project.name ?? "Training project",
      projectType: project.training_project_type
        ? projectTypeLabel(project.training_project_type)
        : null,
      threadId,
      threadSubject: row.subject ?? "",
      session,
      replyBody,
      to: to ?? "",
    });
  }

  try {
    await sendActiveReply(session.id, {
      conversationId: row.graph_conversation_id,
      to: (to ?? "").trim(),
      subject: subject ?? row.subject ?? "",
      html: replyBody,
      cc: Array.isArray(cc) ? cc.filter(Boolean) : [],
      replyAll: !!replyAll,
      latestMessageId,
      inReplyTo,
    });
    return NextResponse.json({ sent: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("No email connection found")) {
      return NextResponse.json({ error: "No email account connected." }, { status: 403 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Stores the trainee's reply in a sandbox thread, then synthesizes the
 * counterparty's response with Gemini (grounded in who the counterparty is and
 * the thread so far). The first time a counterparty answers in a thread — i.e.
 * the "slow" sub finally replying after being chased — the tone is apologetic.
 * When the AI is unavailable, falls back to the canned reply.
 */
async function handleTrainingReply(
  supabase: SupabaseClient,
  opts: {
    projectId: string;
    projectName: string;
    projectType: string | null;
    threadId: string;
    threadSubject: string;
    session: Trainee;
    replyBody: string;
    to: string;
  },
): Promise<NextResponse> {
  const { projectId, projectName, projectType, threadId, threadSubject, session, replyBody, to } =
    opts;

  const stored = await getStoredThreadMessages(supabase, threadId);
  const meEmail = (session.email || "").toLowerCase();

  // The trainee's own display name (for a clean "from" on their reply + greeting
  // on the response).
  const { data: user } = await supabase
    .from("users")
    .select("first_name, last_name, username")
    .eq("id", session.id)
    .maybeSingle();
  const meName =
    [user?.first_name, user?.last_name].filter(Boolean).join(" ").trim() ||
    user?.username ||
    session.username ||
    "You";
  const pmFirst = firstNameOf(user?.first_name || meName, "there");

  // Counterparty = the most recent message from anyone other than the trainee.
  // None yet → this is their first response (the slow sub), and the recipient
  // comes from the trainee's outreach (or the request `to`).
  const subMsg = [...stored].reverse().find(
    (m) => m.from.address && m.from.address.toLowerCase() !== meEmail,
  );
  const firstResponse = !subMsg;
  let counterpartyName = subMsg?.from.name ?? "";
  let counterpartyAddr = subMsg?.from.address ?? "";
  if (!counterpartyAddr) {
    const outreach = stored.find((m) => (m.to ?? []).length > 0);
    const rcpt = outreach?.to?.[0];
    counterpartyName = rcpt?.name || counterpartyName;
    counterpartyAddr = rcpt?.address || to.trim();
  }

  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const replyText = htmlToText(replyBody);
  const reSubject = threadSubject
    ? threadSubject.toLowerCase().startsWith("re:")
      ? threadSubject
      : `Re: ${threadSubject}`
    : "";

  const rows: Record<string, unknown>[] = [
    {
      thread_id: threadId,
      project_id: projectId,
      provider_message_id: `training-reply-${nowMs}`,
      from_name: meName,
      from_address: session.email || "",
      to_recipients: counterpartyAddr
        ? [{ name: counterpartyName, address: counterpartyAddr }]
        : [],
      cc_recipients: [],
      subject: reSubject || threadSubject,
      sent_at: nowIso,
      body_text: replyText,
      body_html: replyBody,
      snippet: replyText.slice(0, 200),
      synced_at: nowIso,
    },
  ];

  // The counterparty answers (when we know who that is).
  let latest = rows[0];
  if (counterpartyAddr) {
    const respMs = nowMs + 1000;
    const respIso = new Date(respMs).toISOString();

    // Realistic Gemini reply, grounded in the counterparty's directory persona
    // and the whole thread (including the reply the trainee just sent).
    const counterparty = (await lookupTrainingCounterparty(
      supabase,
      projectId,
      counterpartyAddr,
    )) ?? { name: counterpartyName || counterpartyAddr, email: counterpartyAddr };
    if (!counterpartyName) counterpartyName = counterparty.name;
    const traineeMessage: ThreadMessage = {
      id: `training-reply-${nowMs}`,
      from: { name: meName, address: session.email || "" },
      to: [{ name: counterpartyName, address: counterpartyAddr }],
      cc: [],
      date: nowIso,
      subject: reSubject || threadSubject,
      bodyHtml: replyBody,
      bodyText: replyText,
      snippet: replyText.slice(0, 200),
    };
    const generated = await generateTrainingCounterpartyReply({
      projectName,
      projectType,
      counterparty,
      traineeName: meName,
      traineeEmail: session.email || "",
      threadSubject: reSubject || threadSubject,
      history: [...stored, traineeMessage],
      lateFirstResponse: firstResponse,
    });
    const { html, text } =
      generated ?? buildCounterpartyReply({ firstResponse, counterpartyName, pmFirst });
    const respRow: Record<string, unknown> = {
      thread_id: threadId,
      project_id: projectId,
      provider_message_id: `training-resp-${respMs}`,
      from_name: counterpartyName || counterpartyAddr,
      from_address: counterpartyAddr,
      to_recipients: [{ name: meName, address: session.email || "" }],
      cc_recipients: [],
      subject: reSubject || threadSubject,
      sent_at: respIso,
      body_text: text,
      body_html: html,
      snippet: text.slice(0, 200),
      synced_at: respIso,
    };
    rows.push(respRow);
    latest = respRow;
  }

  const { error } = await supabase.from("project_email_messages").insert(rows);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Keep the thread summary in sync with what we just stored.
  await supabase
    .from("project_email_threads")
    .update({
      message_count: stored.length + rows.length,
      latest_message_preview: (latest.snippet as string) || "",
      latest_received_at: latest.sent_at as string,
    })
    .eq("id", threadId);

  return NextResponse.json({ sent: true });
}
