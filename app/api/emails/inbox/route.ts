/**
 * GET /api/emails/inbox?provider=gmail|outlook
 *
 * Fetches inbox messages from the active (or specified) provider.
 * When no provider is specified, auto-detects via getActiveEmailConnection.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getValidToken, fetchInboxMessages } from "@/lib/microsoft-graph";
import { getValidGmailToken, fetchGmailMessages } from "@/lib/gmail";
import { getActiveEmailConnection } from "@/lib/email-connection";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const providerParam = searchParams.get("provider");

  try {
    let provider = providerParam;

    if (!provider) {
      const conn = await getActiveEmailConnection(session.id);
      if (!conn) return NextResponse.json({ error: "not_connected" }, { status: 403 });
      provider = conn.provider;
    }

    if (provider === "gmail") {
      const accessToken = await getValidGmailToken(session.id);
      const messages = await fetchGmailMessages(accessToken);
      return NextResponse.json({ messages });
    } else {
      const accessToken = await getValidToken(session.id);
      const messages = await fetchInboxMessages(accessToken);
      return NextResponse.json({ messages });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("No Gmail connection found") || message.includes("No Outlook connection found") || message.includes("No email connection found")) {
      return NextResponse.json({ error: "not_connected" }, { status: 403 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
