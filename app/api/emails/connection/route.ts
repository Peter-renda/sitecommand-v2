/**
 * GET  /api/emails/connection  — check whether the current user has Outlook connected
 * DELETE /api/emails/connection — disconnect (removes tokens and all thread links)
 */

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabase();
  const { data } = await supabase
    .from("user_email_connections")
    .select("ms_user_email, ms_user_display_name, sync_mode, created_at")
    .eq("user_id", session.id)
    .eq("provider", "outlook")
    .single();

  if (!data) return NextResponse.json({ connected: false });

  return NextResponse.json({
    connected: true,
    email: data.ms_user_email,
    displayName: data.ms_user_display_name,
    syncMode: data.sync_mode,
  });
}

export async function DELETE() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabase();
  await supabase
    .from("user_email_connections")
    .delete()
    .eq("user_id", session.id)
    .eq("provider", "outlook");

  return NextResponse.json({ disconnected: true });
}
