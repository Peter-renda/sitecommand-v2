/**
 * GET /api/emails/inbox
 *
 * Fetches the most recent inbox messages from whichever provider the user has
 * connected (Outlook via Microsoft Graph or Gmail via the Gmail API). Handles
 * token refresh transparently and returns a provider-agnostic message shape.
 *
 * Returns { messages: GraphMessage[] } on success.
 * Returns { error: "not_connected" } with status 403 when no connection exists.
 */

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { fetchActiveInbox } from "@/lib/email-connection";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const messages = await fetchActiveInbox(session.id);
    return NextResponse.json({ messages });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (
      message === "No email connection found" ||
      message === "No Outlook connection found" ||
      message === "No Gmail connection found"
    ) {
      return NextResponse.json({ error: "not_connected" }, { status: 403 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
