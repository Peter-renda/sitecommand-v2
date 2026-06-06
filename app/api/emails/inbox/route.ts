/**
 * GET /api/emails/inbox
 *
 * Fetches the 50 most recent messages from the user's Outlook inbox via
 * Microsoft Graph. Handles token refresh transparently.
 *
 * Returns { messages: GraphMessage[] } on success.
 * Returns { error: "not_connected", status: 403 } when no connection exists.
 */

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getValidToken, fetchInboxMessages } from "@/lib/microsoft-graph";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const accessToken = await getValidToken(session.id);
    const messages = await fetchInboxMessages(accessToken);
    return NextResponse.json({ messages });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === "No Outlook connection found") {
      return NextResponse.json({ error: "not_connected" }, { status: 403 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
