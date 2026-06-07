import { getSupabase } from "./supabase";

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

/** Fetches the 25 most recent inbox messages. */
export async function fetchGmailMessages(accessToken: string): Promise<GmailMessage[]> {
  // Step 1: list message IDs
  const listRes = await fetch(
    `${GMAIL_BASE}/messages?maxResults=25&labelIds=INBOX`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!listRes.ok) throw new Error(`Gmail list failed: ${listRes.status}`);
  const list = await listRes.json() as { messages?: { id: string; threadId: string }[] };
  if (!list.messages?.length) return [];

  // Step 2: fetch metadata for each in parallel
  const metadataResults = await Promise.all(
    list.messages.map((m) =>
      fetch(
        `${GMAIL_BASE}/messages/${m.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Date`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      ).then((r) => r.json())
    )
  );

  return metadataResults.map((msg: any) => {
    const headers: { name: string; value: string }[] = msg.payload?.headers ?? [];
    const from = parseHeader(headers, "From");
    const nameMatch = from.match(/^(.*?)\s*<(.+)>$/);
    const fromName = nameMatch ? nameMatch[1].replace(/"/g, "").trim() : from;
    const fromEmail = nameMatch ? nameMatch[2] : from;
    const dateStr = parseHeader(headers, "Date");

    return {
      id: msg.id,
      subject: parseHeader(headers, "Subject") || "(no subject)",
      bodyPreview: msg.snippet ?? "",
      conversationId: msg.threadId,
      isRead: !(msg.labelIds ?? []).includes("UNREAD"),
      hasAttachments: false,
      receivedDateTime: dateStr ? new Date(dateStr).toISOString() : new Date().toISOString(),
      from: { emailAddress: { name: fromName, address: fromEmail } },
      toRecipients: [],
    };
  });
}

/** Sends an email directly through Gmail (requires gmail.compose or gmail.send scope). */
export async function sendGmailEmail(
  accessToken: string,
  opts: { to: string; subject: string; body: string; cc?: string[] }
): Promise<void> {
  const rawParts = [
    `To: ${opts.to}`,
    `Subject: ${opts.subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset=UTF-8`,
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
