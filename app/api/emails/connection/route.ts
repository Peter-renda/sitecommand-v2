/**
 * GET  /api/emails/connection  — returns connection status for both gmail and outlook
 * DELETE /api/emails/connection?provider=gmail|outlook — disconnects one provider
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";
import { getActiveEmailConnection } from "@/lib/email-connection";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabase();
  const { data } = await supabase
    .from("user_email_connections")
    .select("provider, ms_user_email, ms_user_display_name, sync_mode, created_at")
    .eq("user_id", session.id)
    .in("provider", ["outlook", "gmail"]);

  const byProvider = Object.fromEntries((data ?? []).map((row) => [row.provider, row]));

  const shape = (row: (typeof byProvider)[string] | undefined) =>
    row
      ? { connected: true, email: row.ms_user_email, displayName: row.ms_user_display_name }
      : { connected: false };

  return NextResponse.json({
    outlook: shape(byProvider.outlook),
    gmail: shape(byProvider.gmail),
  });
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const provider = searchParams.get("provider");
  if (provider !== "outlook" && provider !== "gmail") {
    return NextResponse.json({ error: "provider must be outlook or gmail" }, { status: 400 });
  }

  const supabase = getSupabase();
  await supabase
    .from("user_email_connections")
    .delete()
    .eq("user_id", session.id)
    .eq("provider", provider);

  return NextResponse.json({ disconnected: provider });
}
