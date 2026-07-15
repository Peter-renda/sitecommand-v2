/**
 * POST /api/projects/[id]/emails/drafts
 *
 * Creates a draft in the user's Gmail or Outlook Drafts folder.
 * SiteCommand never sends email on the user's behalf.
 *
 * Body: { provider: "gmail"|"outlook", to: { email, name? }, subject, body (HTML) }
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getValidToken, createOutlookDraft } from "@/lib/microsoft-graph";
import { getValidGmailToken, createGmailDraft } from "@/lib/gmail";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await params;

  const body = await req.json();
  const { provider = "outlook", to, subject, body: emailBody } = body;

  if (!to?.email || !subject?.trim() || !emailBody?.trim()) {
    return NextResponse.json(
      { error: "to.email, subject, and body are required" },
      { status: 400 }
    );
  }

  try {
    if (provider === "gmail") {
      const accessToken = await getValidGmailToken(session.id);
      const draft = await createGmailDraft(accessToken, { to, subject, body: emailBody });
      return NextResponse.json({ draftId: draft.id });
    } else {
      const accessToken = await getValidToken(session.id);
      const draft = await createOutlookDraft(accessToken, { to, subject, body: emailBody });
      return NextResponse.json({ draftId: draft.id });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("No Gmail connection found") || message.includes("No Outlook connection found")) {
      return NextResponse.json({ error: "not_connected" }, { status: 403 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
