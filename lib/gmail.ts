import { getSupabase } from "./supabase";
import type { ThreadMessage } from "./email-types";
import { isInvalidGrant, reconnectRequiredError } from "./email-errors";

const GMAIL_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

export const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
].join(" ");

export interface GmailMessage {
  id: string;
  subject: string;
  bodyPreview: string;
  conversationId: string; // Gmail threadId
  isRead: boolean;
  hasAttachments: boolean;
  receivedDateTime: string;
  from: { emailAddress: { name: string; address: string } };
  toRecipients: { emailAddress: { name: string; address: string } }[];
}

/** Returns a valid Gmail access token, refreshing if within 5 min of expiry. */
export async function getValidGmailToken(userId: string): Promise<string> {
  const supabase = getSupabase();
  const { data: conn } = await supabase
    .from("user_email_connections")
    .select("access_token, refresh_token, token_expires_at")
    .eq("user_id", userId)
    .eq("provider", "gmail")
    .single();

  if (!conn || !conn.refresh_token) throw new Error("No Gmail connection found");

  const expiresAt = new Date(conn.token_expires_at).getTime();
  const nowPlus5m = Date.now() + 5 * 60 * 1000;

  if (expiresAt > nowPlus5m) return conn.access_token;

  // Refresh
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
    // invalid_grant means the refresh token is permanently dead (revoked,
    // password change, inactivity, or a Testing-mode OAuth app's 7-day
    // expiry). Flag it so callers can prompt the user to reconnect instead
    // of surfacing a raw error / silently showing an empty inbox.
    if (isInvalidGrant(body)) throw reconnectRequiredError("gmail");
    throw new Error(`Gmail token refresh failed: ${body}`);
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
    .eq("provider", "gmail");

  return json.access_token;
}

function parseHeader(headers: { name: string; value: string }[], name: string) {
  return headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

function parseEmailAddress(raw: string): { name: string; address: string } {
  const m = raw.match(/^(.*?)\s*<(.+)>$/);
  if (m) return { name: m[1].replace(/"/g, "").trim(), address: m[2].trim() };
  const trimmed = raw.trim();
  return { name: trimmed, address: trimmed };
}

function parseAddressList(raw: string): { emailAddress: { name: string; address: string } }[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((part) => ({ emailAddress: parseEmailAddress(part.trim()) }))
    .filter((r) => r.emailAddress.address);
}

function safeDate(dateStr: string): string {
  const d = dateStr ? new Date(dateStr) : new Date();
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

/** Fetches up to 250 of the most recent messages from Inbox and Sent Mail. */
export async function fetchGmailMessages(accessToken: string): Promise<GmailMessage[]> {
  // Step 1: list message IDs across Inbox + Sent (Gmail search excludes spam/trash by default)
  const listRes = await fetch(
    `${GMAIL_BASE}/messages?maxResults=250&q=${encodeURIComponent("in:inbox OR in:sent")}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!listRes.ok) throw new Error(`Gmail list failed: ${listRes.status}`);
  const list = (await listRes.json()) as { messages?: { id: string; threadId: string }[] };
  if (!list.messages?.length) return [];

  // Step 2: fetch metadata in chunks to stay within Gmail's per-second quota
  const CHUNK = 25;
  const metadataResults: any[] = [];
  for (let i = 0; i < list.messages.length; i += CHUNK) {
    const chunk = list.messages.slice(i, i + CHUNK);
    const metas = await Promise.all(
      chunk.map((m) =>
        fetch(
          `${GMAIL_BASE}/messages/${m.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Date`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        )
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null)
      )
    );
    metadataResults.push(...metas);
  }

  return metadataResults
    .filter((msg: any) => msg && msg.id && msg.threadId)
    .map((msg: any) => {
      const headers: { name: string; value: string }[] = msg.payload?.headers ?? [];
      return {
        id: msg.id,
        subject: parseHeader(headers, "Subject") || "(no subject)",
        bodyPreview: msg.snippet ?? "",
        conversationId: msg.threadId,
        isRead: !(msg.labelIds ?? []).includes("UNREAD"),
        hasAttachments: false,
        receivedDateTime: safeDate(parseHeader(headers, "Date")),
        from: { emailAddress: parseEmailAddress(parseHeader(headers, "From")) },
        toRecipients: parseAddressList(parseHeader(headers, "To")),
      };
    });
}

/** Sends an HTML email directly through Gmail (requires gmail.compose or gmail.send scope). */
export async function sendGmailEmail(
  accessToken: string,
  opts: { to: string; subject: string; body: string; cc?: string[] }
): Promise<void> {
  const rawParts = [
    `To: ${opts.to}`,
    `Subject: ${opts.subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset=UTF-8`,
  ];
  if (opts.cc?.length) rawParts.push(`Cc: ${opts.cc.join(", ")}`);
  rawParts.push("", opts.body);

  const encoded = Buffer.from(rawParts.join("\r\n")).toString("base64url");

  const res = await fetch(`${GMAIL_BASE}/messages/send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw: encoded }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gmail send failed: ${res.status} ${body}`);
  }
}

/** Creates a draft in the user's Gmail Drafts folder. */
export async function createGmailDraft(
  accessToken: string,
  opts: { to: { email: string; name?: string }; subject: string; body: string }
): Promise<{ id: string }> {
  const toHeader = opts.to.name
    ? `"${opts.to.name}" <${opts.to.email}>`
    : opts.to.email;

  const raw = [
    `To: ${toHeader}`,
    `Subject: ${opts.subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset=UTF-8`,
    ``,
    opts.body,
  ].join("\r\n");

  const encoded = Buffer.from(raw).toString("base64url");

  const res = await fetch(`${GMAIL_BASE}/drafts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message: { raw: encoded } }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gmail create draft failed: ${res.status} ${body}`);
  }

  return res.json();
}

function decodeBase64Url(data: string): string {
  try {
    return Buffer.from(data, "base64url").toString("utf-8");
  } catch {
    return "";
  }
}

/** Walks a Gmail MIME payload tree and pulls out the HTML and plain-text bodies. */
function extractGmailBodies(payload: any): { html: string; text: string } {
  let html = "";
  let text = "";
  const walk = (part: any) => {
    if (!part) return;
    const mime = (part.mimeType || "").toLowerCase();
    if (mime === "text/html" && part.body?.data) html += decodeBase64Url(part.body.data);
    else if (mime === "text/plain" && part.body?.data) text += decodeBase64Url(part.body.data);
    if (Array.isArray(part.parts)) part.parts.forEach(walk);
  };
  walk(payload);
  return { html, text };
}

/** Fetches all messages in a Gmail thread (oldest first) with full bodies. */
export async function fetchGmailThread(accessToken: string, threadId: string): Promise<ThreadMessage[]> {
  const res = await fetch(`${GMAIL_BASE}/threads/${threadId}?format=full`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gmail thread fetch failed: ${res.status} ${body}`);
  }
  const data = (await res.json()) as { messages?: any[] };
  return (data.messages ?? []).map((msg) => {
    const headers: { name: string; value: string }[] = msg.payload?.headers ?? [];
    const { html, text } = extractGmailBodies(msg.payload);
    return {
      id: msg.id,
      from: parseEmailAddress(parseHeader(headers, "From")),
      to: parseAddressList(parseHeader(headers, "To")).map((r) => r.emailAddress),
      cc: parseAddressList(parseHeader(headers, "Cc")).map((r) => r.emailAddress),
      date: safeDate(parseHeader(headers, "Date")),
      subject: parseHeader(headers, "Subject") || "(no subject)",
      bodyHtml: html,
      bodyText: text,
      snippet: msg.snippet ?? "",
      messageIdHeader: parseHeader(headers, "Message-ID") || parseHeader(headers, "Message-Id"),
    };
  });
}

/** Sends an HTML reply within an existing Gmail thread. */
export async function sendGmailReply(
  accessToken: string,
  opts: {
    threadId: string;
    to: string;
    cc?: string[];
    subject: string;
    html: string;
    inReplyTo?: string;
  }
): Promise<void> {
  const subject = /^re:/i.test(opts.subject.trim()) ? opts.subject : `Re: ${opts.subject}`;
  const lines = [
    `To: ${opts.to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset=UTF-8`,
  ];
  if (opts.cc?.length) lines.push(`Cc: ${opts.cc.join(", ")}`);
  if (opts.inReplyTo) {
    lines.push(`In-Reply-To: ${opts.inReplyTo}`);
    lines.push(`References: ${opts.inReplyTo}`);
  }
  lines.push("", opts.html);

  const encoded = Buffer.from(lines.join("\r\n")).toString("base64url");
  const res = await fetch(`${GMAIL_BASE}/messages/send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw: encoded, threadId: opts.threadId }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gmail reply failed: ${res.status} ${body}`);
  }
}
