/**
 * POST /api/projects/[id]/emails/compose
 *
 * Training sandboxes only — sends a new email to one of the fake people in the
 * project Directory. Nothing touches a real mailbox: the message is stored as a
 * new local thread (project_email_threads + project_email_messages) and the
 * recipient's response is synthesized with Gemini (lib/training-email-reply.ts),
 * falling back to a canned acknowledgement when the AI is unavailable.
 *
 * Body: { to: string, subject: string, body: string (HTML) }
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";
import { canAccessProject } from "@/lib/project-access";
import { htmlToText } from "@/lib/email-messages";
import { buildCounterpartyReply, firstNameOf } from "@/lib/training-emails";
import { projectTypeLabel } from "@/lib/simulation-constants";
import {
  generateTrainingCounterpartyReply,
  lookupTrainingCounterparty,
} from "@/lib/training-email-reply";
import type { ThreadMessage } from "@/lib/email-types";

// Gemini reply synthesis can take a while.
export const maxDuration = 60;

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

  const supabase = getSupabase();
  const { data: project } = await supabase
    .from("projects")
    .select("is_training, name, training_project_type")
    .eq("id", projectId)
    .maybeSingle();
  if (!project?.is_training) {
    return NextResponse.json(
      { error: "Simulated email is only available on training projects." },
      { status: 400 }
    );
  }

  const body = await req.json();
  const { to, subject, body: emailBody } = body as {
    to?: string;
    subject?: string;
    body?: string;
  };

  if (!to?.trim() || !subject?.trim()) {
    return NextResponse.json({ error: "to and subject are required" }, { status: 400 });
  }
  if (!emailBody || htmlToText(emailBody).trim() === "") {
    return NextResponse.json({ error: "Message body is required" }, { status: 400 });
  }

  // The recipient must be one of the sandbox's Directory contacts — those are
  // the fake people who can "answer" mail in the simulation.
  const counterparty = await lookupTrainingCounterparty(supabase, projectId, to);
  if (!counterparty) {
    return NextResponse.json(
      { error: "Recipient must be a project Directory contact with an email address." },
      { status: 400 }
    );
  }

  // Trainee display name for a clean "from".
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

  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const bodyText = htmlToText(emailBody);
  const cleanSubject = subject.trim();

  // New local thread — the deterministic training- prefix keeps it in the same
  // namespace as the seeded sandbox threads.
  const { data: thread, error: threadError } = await supabase
    .from("project_email_threads")
    .insert({
      project_id: projectId,
      graph_conversation_id: `training-compose-${nowMs}-${Math.random().toString(36).slice(2, 8)}`,
      subject: cleanSubject,
      participants: [meName, counterparty.name],
      latest_message_preview: bodyText.slice(0, 280),
      latest_received_at: nowIso,
      message_count: 1,
      linked_by: session.id,
      linked_at: nowIso,
    })
    .select()
    .single();

  if (threadError || !thread?.id) {
    return NextResponse.json(
      { error: threadError?.message ?? "Failed to create thread" },
      { status: 500 }
    );
  }

  const traineeMessage: ThreadMessage = {
    id: `training-compose-out-${nowMs}`,
    from: { name: meName, address: session.email || "" },
    to: [{ name: counterparty.name, address: counterparty.email }],
    cc: [],
    date: nowIso,
    subject: cleanSubject,
    bodyHtml: emailBody,
    bodyText,
    snippet: bodyText.slice(0, 200),
  };

  // The recipient answers right away (a fresh inbound email, so no apology).
  const generated = await generateTrainingCounterpartyReply({
    projectName: project.name ?? "Training project",
    projectType: project.training_project_type
      ? projectTypeLabel(project.training_project_type)
      : null,
    counterparty,
    traineeName: meName,
    traineeEmail: session.email || "",
    threadSubject: cleanSubject,
    history: [traineeMessage],
    lateFirstResponse: false,
  });
  const { html: respHtml, text: respText } =
    generated ??
    buildCounterpartyReply({
      firstResponse: false,
      counterpartyName: counterparty.name,
      pmFirst,
    });

  const respMs = nowMs + 1000;
  const respIso = new Date(respMs).toISOString();
  const reSubject = cleanSubject.toLowerCase().startsWith("re:")
    ? cleanSubject
    : `Re: ${cleanSubject}`;

  const { error: messagesError } = await supabase.from("project_email_messages").insert([
    {
      thread_id: thread.id,
      project_id: projectId,
      provider_message_id: traineeMessage.id,
      from_name: meName,
      from_address: session.email || "",
      to_recipients: [{ name: counterparty.name, address: counterparty.email }],
      cc_recipients: [],
      subject: cleanSubject,
      sent_at: nowIso,
      body_text: bodyText,
      body_html: emailBody,
      snippet: bodyText.slice(0, 200),
      synced_at: nowIso,
    },
    {
      thread_id: thread.id,
      project_id: projectId,
      provider_message_id: `training-compose-resp-${respMs}`,
      from_name: counterparty.name,
      from_address: counterparty.email,
      to_recipients: [{ name: meName, address: session.email || "" }],
      cc_recipients: [],
      subject: reSubject,
      sent_at: respIso,
      body_text: respText,
      body_html: respHtml,
      snippet: respText.slice(0, 200),
      synced_at: respIso,
    },
  ]);
  if (messagesError) {
    return NextResponse.json({ error: messagesError.message }, { status: 500 });
  }

  await supabase
    .from("project_email_threads")
    .update({
      message_count: 2,
      latest_message_preview: respText.slice(0, 280),
      latest_received_at: respIso,
    })
    .eq("id", thread.id);

  return NextResponse.json({ sent: true, thread });
}
