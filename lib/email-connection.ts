import { getSupabase } from "./supabase";
import { getValidToken, fetchInboxMessages, createOutlookDraft, type GraphMessage } from "./microsoft-graph";
import { getValidGmailToken, fetchGmailInbox, createGmailDraft } from "./gmail";

export type EmailProvider = "outlook" | "gmail";

export interface EmailConnection {
  provider: EmailProvider;
  email: string;
  displayName: string;
  syncMode: string;
}

/**
 * Resolves the user's active email connection. A user can connect either
 * Outlook or Gmail (or both); the most recently updated connection wins.
 * Returns null when the user has no email connection.
 */
export async function getActiveEmailConnection(userId: string): Promise<EmailConnection | null> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from("user_email_connections")
    .select("provider, ms_user_email, ms_user_display_name, sync_mode")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  return {
    provider: (data.provider as EmailProvider) ?? "outlook",
    email: data.ms_user_email ?? "",
    displayName: data.ms_user_display_name ?? "",
    syncMode: data.sync_mode ?? "manual",
  };
}

/** Fetches the inbox for whichever provider the user has connected. */
export async function fetchActiveInbox(userId: string): Promise<GraphMessage[]> {
  const conn = await getActiveEmailConnection(userId);
  if (!conn) throw new Error("No email connection found");

  if (conn.provider === "gmail") {
    const token = await getValidGmailToken(userId);
    return fetchGmailInbox(token);
  }
  const token = await getValidToken(userId);
  return fetchInboxMessages(token);
}

/** Creates a draft using whichever provider the user has connected. */
export async function createActiveDraft(
  userId: string,
  opts: { to: { email: string; name?: string }; subject: string; body: string }
): Promise<{ id: string }> {
  const conn = await getActiveEmailConnection(userId);
  if (!conn) throw new Error("No email connection found");

  if (conn.provider === "gmail") {
    const token = await getValidGmailToken(userId);
    return createGmailDraft(token, opts);
  }
  const token = await getValidToken(userId);
  return createOutlookDraft(token, opts);
}
