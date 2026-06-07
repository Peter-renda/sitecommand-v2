import { getSupabase } from "./supabase";
import type { GraphMessage } from "./microsoft-graph";

const GMAIL_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

export const GMAIL_SCOPES =
  "https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.compose openid email profile";

/**
 * Returns a valid Google access token for the given user, refreshing if it
 * will expire within the next 5 minutes. Throws if no connection exists.
 */
export async function getValidGmailToken(userId: string): Promise<string> {
  const supabase = getSupabase();
  const { data: conn } = await supabase
    .from("user_email_connections")
    .select("access_token, refresh_token, token_expires_at")
    .eq("user_id", userId)
    .eq("provider", "gmail")
    .single();

  if (!conn) throw new Error("No Gmail connection found");

  const expiresAt = new Date(conn.token_expires_at).getTime();
  const nowPlus5m = Date.now() + 5 * 60 * 1000;

  if (expiresAt > nowPlus5m) return conn.access_token;

  // Token is stale — refresh it
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: conn.refresh_token,
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
      // Google only returns a refresh_token on first consent; keep the old one.
      refresh_token: json.refresh_token ?? conn.refresh_token,
      token_expires_at: newExpiry,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("provider", "gmail");

  return json.access_token;
}

/** Parses an RFC 5322 address header into a name/address pair. */
function parseAddress(raw: string | undefined): { name: string; address: string } {
  if (!raw) return { name: "", address: "" };
  const match = raw.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (match) return { name: match[1].trim(), address: match[2].trim() };
  return { name: "", address: raw.trim() };
}

function parseAddressList(raw: string | undefined): { emailAddress: { name: string; address: string } }[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((part) => parseAddress(part))
    .filter((a) => a.address)
    .map((a) => ({ emailAddress: a }));
}

interface GmailMessageMeta {
  id: string;
  threadId: string;
  snippet?: string;
  internalDate?: string;
  labelIds?: string[];
  payload?: { headers?: { name: string; value: string }[] };
}

function headerValue(meta: GmailMessageMeta, name: string): string | undefined {
  return meta.payload?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value;
}

/**
 * Fetches the most recent inbox messages for the authenticated user and maps
 * them into the same shape used by the Outlook integration so the UI can stay
 * provider-agnostic.
 */
export async function fetchGmailInbox(accessToken: string): Promise<GraphMessage[]> {
  const listRes = await fetch(
    `${GMAIL_BASE}/messages?maxResults=30&labelIds=INBOX`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!listRes.ok) {
    const body = await listRes.text();
    throw new Error(`Gmail list failed: ${listRes.status} ${body}`);
  }

  const list = (await listRes.json()) as { messages?: { id: string; threadId: string }[] };
  const ids = (list.messages ?? []).map((m) => m.id);

  const headers = "metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Date";
  const metas = await Promise.all(
    ids.map(async (id) => {
      const res = await fetch(`${GMAIL_BASE}/messages/${id}?format=metadata&${headers}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) return null;
      return (await res.json()) as GmailMessageMeta;
    })
  );

  return metas
    .filter((m): m is GmailMessageMeta => m !== null)
    .map((m) => {
      const received = m.internalDate
        ? new Date(Number(m.internalDate)).toISOString()
        : new Date().toISOString();
      return {
        id: m.id,
        subject: headerValue(m, "Subject") ?? "",
        bodyPreview: m.snippet ?? "",
        conversationId: m.threadId,
        isRead: !(m.labelIds ?? []).includes("UNREAD"),
        hasAttachments: false,
        receivedDateTime: received,
        from: { emailAddress: parseAddress(headerValue(m, "From")) },
        toRecipients: parseAddressList(headerValue(m, "To")),
      } satisfies GraphMessage;
    });
}

/**
 * Creates a draft message in the user's Gmail Drafts folder.
 * SiteCommand never sends on the user's behalf — the draft appears in Gmail
 * for the user to review and send. Returns the Gmail draft id.
 */
export async function createGmailDraft(
  accessToken: string,
  opts: { to: { email: string; name?: string }; subject: string; body: string }
): Promise<{ id: string }> {
  const toHeader = opts.to.name ? `${opts.to.name} <${opts.to.email}>` : opts.to.email;
  const mime = [
    `To: ${toHeader}`,
    `Subject: ${opts.subject}`,
    "MIME-Version: 1.0",
    'Content-Type: text/html; charset="UTF-8"',
    "",
    opts.body,
  ].join("\r\n");

  const raw = Buffer.from(mime, "utf-8").toString("base64url");

  const res = await fetch(`${GMAIL_BASE}/drafts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message: { raw } }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gmail create draft failed: ${res.status} ${body}`);
  }

  return res.json();
}
