/**
 * POST /api/emails/send
 *
 * Sends an email from the user's connected account (Gmail or Outlook).
 * Body: { to: string, subject: string, body: string, cc?: string[] }
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { sendActiveEmail } from "@/lib/email-connection";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { to, subject, body: emailBody, cc } = body as {
    to?: string;
    subject?: string;
    body?: string;
    cc?: string[];
  };

  if (!to?.trim()) return NextResponse.json({ error: "'to' is required" }, { status: 400 });
  if (!subject?.trim()) return NextResponse.json({ error: "'subject' is required" }, { status: 400 });

  try {
    await sendActiveEmail(session.id, {
      to: to.trim(),
      subject: subject.trim(),
      body: emailBody ?? "",
      cc: Array.isArray(cc) ? cc.filter(Boolean) : [],
    });
    return NextResponse.json({ sent: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("No email connection found")) {
      return NextResponse.json({ error: "No email account connected." }, { status: 403 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
