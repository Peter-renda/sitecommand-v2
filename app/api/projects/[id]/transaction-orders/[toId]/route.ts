import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; toId: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId, toId } = await params;
  const supabase = getSupabase();

  const { data: row, error: loadErr } = await supabase
    .from("project_transaction_orders")
    .select("final_storage_path, source_storage_path")
    .eq("id", toId)
    .eq("project_id", projectId)
    .maybeSingle();
  if (loadErr) return NextResponse.json({ error: loadErr.message }, { status: 500 });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { error: delErr } = await supabase
    .from("project_transaction_orders")
    .delete()
    .eq("id", toId)
    .eq("project_id", projectId);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  const toRemove: string[] = [];
  if (row.final_storage_path) toRemove.push(row.final_storage_path);
  if (row.source_storage_path) toRemove.push(row.source_storage_path);
  if (toRemove.length > 0) {
    void supabase.storage.from("project-drawings").remove(toRemove);
  }

  return NextResponse.json({ ok: true });
}
