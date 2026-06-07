/**
 * GET    /api/emails/connection  — return the user's active email connection
 *                                   (Outlook or Gmail), if any.
 * DELETE /api/emails/connection  — disconnect. Pass ?provider=outlook|gmail to
 *                                   remove a specific one; otherwise removes all.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";
import { getActiveEmailConnection } from "@/lib/email-connection";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const conn = await getActiveEmailConnection(session.id);
  if (!conn) return NextResponse.json({ connected: false });

  return NextResponse.json({
    connected: true,
    provider: conn.provider,
    email: conn.email,
    displayName: conn.displayName,
    syncMode: conn.syncMode,
  });
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const provider = searchParams.get("provider");

  const supabase = getSupabase();
  let query = supabase.from("user_email_connections").delete().eq("user_id", session.id);
  if (provider === "outlook" || provider === "gmail") {
    query = query.eq("provider", provider);
  }
  await query;

  return NextResponse.json({ disconnected: true });
}
