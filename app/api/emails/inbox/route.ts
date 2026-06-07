/**
 * GET /api/emails/inbox?provider=gmail|outlook
 *
 * Fetches inbox messages from the specified provider.
 * Handles token refresh transparently.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getValidToken, fetchInboxMessages } from "@/lib/microsoft-graph";
import { getValidGmailToken, fetchGmailMessages } from "@/lib/gmail";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const provider = searchParams.get("provider") ?? "outlook";

  try {
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
    if (message.includes("No Gmail connection found") || message.includes("No Outlook connection found")) {
      return NextResponse.json({ error: "not_connected" }, { status: 403 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
