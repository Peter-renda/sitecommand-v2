import { getSupabase } from "./supabase";

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";
const TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token";

export interface GraphMessage {
  id: string;
  subject: string;
  bodyPreview: string;
  conversationId: string;
  isRead: boolean;
  hasAttachments: boolean;
  receivedDateTime: string;
  from: { emailAddress: { name: string; address: string } };
  toRecipients: { emailAddress: { name: string; address: string } }[];
}

/**
 * Returns a valid access token for the given user, refreshing if it will
 * expire within the next 5 minutes. Throws if no connection exists.
 */
export async function getValidToken(userId: string): Promise<string> {
  const supabase = getSupabase();
  const { data: conn } = await supabase
    .from("user_email_connections")
    .select("access_token, refresh_token, token_expires_at")
    .eq("user_id", userId)
    .eq("provider", "outlook")
    .single();

  if (!conn) throw new Error("No Outlook connection found");

  const expiresAt = new Date(conn.token_expires_at).getTime();
  const nowPlus5m = Date.now() + 5 * 60 * 1000;

  if (expiresAt > nowPlus5m) return conn.access_token;

  // Token is stale — refresh it
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: process.env.MICROSOFT_CLIENT_ID!,
      client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
      refresh_token: conn.refresh_token,
      scope: "Mail.Read Mail.ReadWrite offline_access User.Read",
    }).toString(),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Token refresh failed: ${body}`);
  }

  const json = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };

  const newExpiry = new Date(Date.now() + json.expires_in * 1000).toISOString();

  await supabase
    .from("user_email_connections")
    .update({
      access_token: json.access_token,
      refresh_token: json.refresh_token ?? conn.refresh_token,
      token_expires_at: newExpiry,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("provider", "outlook");

  return json.access_token;
}

/**
 * Fetches the 50 most recent inbox messages for the authenticated user.
 */
export async function fetchInboxMessages(accessToken: string): Promise<GraphMessage[]> {
  const select = "id,subject,bodyPreview,conversationId,isRead,hasAttachments,receivedDateTime,from,toRecipients";
  const url = `${GRAPH_BASE}/me/messages?$top=50&$orderby=receivedDateTime desc&$select=${select}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Graph inbox fetch failed: ${res.status} ${body}`);
  }

  const json = await res.json();
  return (json.value ?? []) as GraphMessage[];
}

/**
 * Creates a draft message in the user's Outlook Drafts folder.
 * Returns the Graph message id of the new draft.
 */
export async function createOutlookDraft(
  accessToken: string,
  opts: { to: { email: string; name?: string }; subject: string; body: string }
): Promise<{ id: string }> {
  const res = await fetch(`${GRAPH_BASE}/me/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      subject: opts.subject,
      body: { contentType: "HTML", content: opts.body },
      toRecipients: [
        {
          emailAddress: {
            address: opts.to.email,
            name: opts.to.name ?? opts.to.email,
          },
        },
      ],
      isDraft: true,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Graph create draft failed: ${res.status} ${body}`);
  }

  return res.json();
}
