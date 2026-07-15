/**
 * GET /api/integrations/sage300cre/logs?recordType=commitments&recordId=<uuid>
 *
 * Returns the 10 most recent Sage 300 CRE sync log entries for a specific record.
 *
 * Auth: any authenticated user.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const recordType = searchParams.get("recordType");
  const recordId = searchParams.get("recordId");

  if (!recordType || !recordId) {
    return NextResponse.json({ error: "recordType and recordId are required" }, { status: 400 });
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("erp_sync_logs")
    .select("id, result, sage_key, error_message, synced_at, integration")
    .eq("record_type", recordType)
    .eq("record_id", recordId)
    .eq("integration", "sage300cre")
    .order("synced_at", { ascending: false })
    .limit(10);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data ?? []);
}
