/**
 * POST /api/projects/[id]/emails/triage/suggest
 *
 * Returns AI-suggested actions for one triage card. Body:
 *   { conversationId, subject?, fromName?, fromAddress?, preview?, receivedAt? }
 *
 * The full thread text is fetched from the caller's own mailbox when possible
 * (better grounding than the short inbox preview); failures fall back to the
 * preview so suggestions still work. An empty suggestion list is a normal
 * response — the card then offers plain link/decline.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";
import { canAccessProject } from "@/lib/project-access";
import { fetchActiveThread } from "@/lib/email-connection";
import { messagePlainText } from "@/lib/email-messages";
import { suggestEmailTriageActions } from "@/lib/email-triage";

export const maxDuration = 60;

const MAX_THREAD_CHARS = 8000;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;
  if (!(await canAccessProject(projectId, session))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: {
    conversationId?: string;
    subject?: string;
    fromName?: string;
    fromAddress?: string;
    preview?: string;
    receivedAt?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.conversationId) {
    return NextResponse.json({ error: "conversationId is required" }, { status: 400 });
  }

  // Best grounding: the full message chain from the user's own mailbox.
  let emailText = "";
  try {
    const { messages } = await fetchActiveThread(session.id, body.conversationId);
    emailText = messages
      .map((m) => {
        const sender = [m.from.name, m.from.address ? `<${m.from.address}>` : ""].filter(Boolean).join(" ");
        return `From ${sender || "(unknown)"} on ${m.date}:\n${messagePlainText(m) || m.snippet || "(empty)"}`;
      })
      .join("\n\n---\n\n")
      .slice(0, MAX_THREAD_CHARS);
  } catch {
    // fall back to the inbox preview below
  }
  if (!emailText) emailText = body.preview ?? "";

  const from = [body.fromName, body.fromAddress ? `<${body.fromAddress}>` : ""]
    .filter(Boolean)
    .join(" ");

  const suggestions = await suggestEmailTriageActions(getSupabase(), projectId, {
    subject: body.subject ?? "",
    from,
    receivedAt: body.receivedAt,
    text: emailText,
  });

  return NextResponse.json({ suggestions });
}
