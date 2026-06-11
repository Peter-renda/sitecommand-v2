/**
 * POST /api/projects/[id]/emails/triage/link
 *
 * Links an inbox conversation to the project (same upsert as
 * POST /api/projects/[id]/emails) and executes the triage actions the user
 * ticked on the card:
 *   - rfi_comment : adds the email text as a response on the chosen RFI
 *   - create_task : creates a project task from the email's action item
 *
 * Every action is re-validated against the project here — the AI suggestions
 * are advisory only. Action failures don't roll back the link; each result is
 * reported back so the UI can surface partial failures.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";
import { canAccessProject } from "@/lib/project-access";
import { fetchActiveThread } from "@/lib/email-connection";
import { persistThreadMessages, messagePlainText } from "@/lib/email-messages";
import { logRFIChange } from "@/lib/rfi-history";
import type { ThreadMessage } from "@/lib/email-types";

export const maxDuration = 60;

const MAX_ACTIONS = 6;
const MAX_COMMENT_BODY_CHARS = 2000;

type TriageActionInput = {
  id?: string;
  type?: string;
  rfiId?: string;
  taskTitle?: string;
  taskDescription?: string;
  taskDueDate?: string | null;
};

type ActionResult = { id: string; ok: boolean; error?: string };

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

  let body: {
    conversationId?: string;
    subject?: string;
    fromName?: string;
    fromAddress?: string;
    participants?: string[];
    latestMessagePreview?: string;
    latestReceivedAt?: string | null;
    messageCount?: number;
    actions?: TriageActionInput[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.conversationId) {
    return NextResponse.json({ error: "conversationId is required" }, { status: 400 });
  }

  const supabase = getSupabase();
  const subject = body.subject || "(no subject)";

  // 1) Link the thread (idempotent upsert, mirrors POST /emails).
  const { data: thread, error: linkError } = await supabase
    .from("project_email_threads")
    .upsert(
      [
        {
          project_id: projectId,
          graph_conversation_id: body.conversationId,
          subject,
          participants: body.participants ?? [],
          latest_message_preview: body.latestMessagePreview ?? "",
          latest_received_at: body.latestReceivedAt ?? null,
          message_count: body.messageCount ?? 1,
          linked_by: session.id,
          linked_at: new Date().toISOString(),
        },
      ],
      { onConflict: "project_id,graph_conversation_id" }
    )
    .select()
    .single();

  if (linkError) return NextResponse.json({ error: linkError.message }, { status: 500 });

  // 2) Best-effort: store the full message chain (also gives the actions a
  //    richer email body to quote than the short inbox preview).
  let messages: ThreadMessage[] = [];
  try {
    const fetched = await fetchActiveThread(session.id, body.conversationId);
    messages = fetched.messages;
    if (thread?.id) {
      await persistThreadMessages(supabase, { threadId: thread.id as string, projectId, messages });
    }
  } catch {
    // messages will be captured the next time the thread is viewed
  }

  // The latest substantive message is what gets quoted into RFI comments.
  const latest = messages.length ? messages[messages.length - 1] : null;
  const latestText = latest ? messagePlainText(latest) || latest.snippet : "";
  const quotedBody = (latestText || body.latestMessagePreview || "").trim();
  const fromLine =
    [body.fromName, body.fromAddress ? `<${body.fromAddress}>` : ""].filter(Boolean).join(" ") ||
    (latest ? [latest.from.name, latest.from.address ? `<${latest.from.address}>` : ""].filter(Boolean).join(" ") : "");

  // 3) Execute ticked actions sequentially (task numbering must not race).
  const actions = (Array.isArray(body.actions) ? body.actions : []).slice(0, MAX_ACTIONS);
  const results: ActionResult[] = [];

  let nextTaskNumber: number | null = null;

  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];
    const actionId = action.id || `action-${i}`;

    if (action.type === "rfi_comment") {
      if (!action.rfiId) {
        results.push({ id: actionId, ok: false, error: "Missing RFI" });
        continue;
      }
      const { data: rfi } = await supabase
        .from("rfis")
        .select("id, rfi_number")
        .eq("id", action.rfiId)
        .eq("project_id", projectId)
        .single();
      if (!rfi) {
        results.push({ id: actionId, ok: false, error: "RFI not found on this project" });
        continue;
      }

      const commentBody =
        `Linked email${fromLine ? ` from ${fromLine}` : ""}: "${subject}"\n\n` +
        (quotedBody
          ? quotedBody.length > MAX_COMMENT_BODY_CHARS
            ? quotedBody.slice(0, MAX_COMMENT_BODY_CHARS) + "…"
            : quotedBody
          : "(see linked email thread on the project Emails page)");

      const { error: respError } = await supabase
        .from("rfi_responses")
        .insert({ rfi_id: rfi.id, body: commentBody, created_by: session.id });

      if (respError) {
        results.push({ id: actionId, ok: false, error: respError.message });
        continue;
      }
      await logRFIChange(supabase, session, rfi.id, projectId, "Added Response from linked email", null, commentBody);
      results.push({ id: actionId, ok: true });
    } else if (action.type === "create_task") {
      const title = (action.taskTitle ?? "").trim();
      if (!title) {
        results.push({ id: actionId, ok: false, error: "Missing task title" });
        continue;
      }

      let taskNumber = nextTaskNumber;
      if (taskNumber === null) {
        const { data: maxRow } = await supabase
          .from("tasks")
          .select("task_number")
          .eq("project_id", projectId)
          .order("task_number", { ascending: false })
          .limit(1)
          .maybeSingle();
        taskNumber = (maxRow?.task_number ?? 0) + 1;
      }

      const due =
        typeof action.taskDueDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(action.taskDueDate)
          ? action.taskDueDate
          : null;
      const description =
        (action.taskDescription ?? "").trim() ||
        `From linked email${fromLine ? ` from ${fromLine}` : ""}: "${subject}"`;

      const { error: taskError } = await supabase.from("tasks").insert({
        project_id: projectId,
        task_number: taskNumber,
        title: title.slice(0, 200),
        status: "initiated",
        category: null,
        description: description.slice(0, 2000),
        distribution_list: [],
        assignees: [],
        due_date: due,
        is_private: false,
        created_by: session.id,
      });

      if (taskError) {
        results.push({ id: actionId, ok: false, error: taskError.message });
        continue;
      }
      nextTaskNumber = taskNumber + 1;
      results.push({ id: actionId, ok: true });
    } else {
      results.push({ id: actionId, ok: false, error: "Unknown action type" });
    }
  }

  return NextResponse.json({ thread, results });
}
