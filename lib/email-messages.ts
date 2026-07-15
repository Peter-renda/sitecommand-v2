/**
 * Persistence helpers for the message bodies inside a linked email thread.
 *
 * Message text used to live only in the user's mailbox (fetched live from
 * Outlook/Gmail per request). These helpers store a copy in
 * `project_email_messages` so threads stay readable without a live connection
 * and so SiteCommand Assist can read the full email text as project context.
 */

import type { getSupabase } from "./supabase";
import type { ThreadMessage } from "./email-types";

type Supa = ReturnType<typeof getSupabase>;

/** Collapse an HTML body down to readable plain text. */
export function htmlToText(html: string): string {
  if (!html) return "";
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<\/(p|div|br|li|tr|h[1-6])>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** The plain-text form of a message, preferring real text over stripped HTML. */
export function messagePlainText(msg: ThreadMessage): string {
  return (msg.bodyText && msg.bodyText.trim()) || htmlToText(msg.bodyHtml);
}

/**
 * Upserts the messages of a thread and refreshes the thread's metadata
 * (message count, latest preview, latest received time). Best-effort: a
 * storage failure here should never break the live email view, so callers
 * typically ignore the boolean result.
 */
export async function persistThreadMessages(
  supabase: Supa,
  opts: { threadId: string; projectId: string; messages: ThreadMessage[] },
): Promise<boolean> {
  const { threadId, projectId, messages } = opts;
  if (!messages.length) return false;

  const rows = messages.map((m) => ({
    thread_id: threadId,
    project_id: projectId,
    provider_message_id: m.id,
    message_id_header: m.messageIdHeader ?? null,
    from_name: m.from?.name ?? "",
    from_address: m.from?.address ?? "",
    to_recipients: m.to ?? [],
    cc_recipients: m.cc ?? [],
    subject: m.subject ?? "",
    sent_at: m.date ?? null,
    body_text: messagePlainText(m),
    body_html: m.bodyHtml ?? "",
    snippet: m.snippet ?? "",
    synced_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from("project_email_messages")
    .upsert(rows, { onConflict: "thread_id,provider_message_id" });
  if (error) return false;

  // Keep the thread summary in sync with what we just stored.
  const latest = messages.reduce((a, b) =>
    new Date(a.date).getTime() >= new Date(b.date).getTime() ? a : b,
  );
  await supabase
    .from("project_email_threads")
    .update({
      message_count: messages.length,
      latest_message_preview: latest.snippet || messagePlainText(latest).slice(0, 280),
      latest_received_at: latest.date ?? null,
    })
    .eq("id", threadId);

  return true;
}

/** Reads stored messages back as ThreadMessages (oldest first). */
export async function getStoredThreadMessages(
  supabase: Supa,
  threadId: string,
): Promise<ThreadMessage[]> {
  const { data } = await supabase
    .from("project_email_messages")
    .select("*")
    .eq("thread_id", threadId)
    .order("sent_at", { ascending: true });

  return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    id: (r.provider_message_id as string) ?? "",
    from: { name: (r.from_name as string) ?? "", address: (r.from_address as string) ?? "" },
    to: (r.to_recipients as ThreadMessage["to"]) ?? [],
    cc: (r.cc_recipients as ThreadMessage["cc"]) ?? [],
    date: (r.sent_at as string) ?? "",
    subject: (r.subject as string) ?? "",
    bodyHtml: (r.body_html as string) ?? "",
    bodyText: (r.body_text as string) ?? "",
    snippet: (r.snippet as string) ?? "",
    messageIdHeader: (r.message_id_header as string) ?? undefined,
  }));
}
