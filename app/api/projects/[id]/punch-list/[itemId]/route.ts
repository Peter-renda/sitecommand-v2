import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getSession } from "@/lib/auth";
import { canViewPunchListItem } from "@/lib/punch-list-access";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId, itemId } = await params;
  const recycleBin = req.nextUrl.searchParams.get("recycle_bin") === "true";
  const supabase = getSupabase();

  let query = supabase
    .from("punch_list_items")
    .select("*")
    .eq("id", itemId)
    .eq("project_id", projectId);

  if (recycleBin) {
    query = query.eq("is_deleted", true);
  } else {
    query = query.eq("is_deleted", false);
  }

  const { data, error } = await query.single();

  if (error || !data) return NextResponse.json({ error: "Item not found" }, { status: 404 });
  if (!canViewPunchListItem(data, session.id)) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }
  return NextResponse.json(data);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId, itemId } = await params;
  const body = await req.json();

  const allowed = [
    "item_number", "title", "status", "punch_item_manager_id", "type", "assignees",
    "due_date", "final_approver_id", "distribution_list", "location",
    "priority", "trade", "reference", "schedule_impact", "cost_impact",
    "cost_codes", "private", "description", "attachments",
    "report_fields",
  ];
  const update: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) update[key] = body[key] ?? null;
  }

  if ("title" in update) {
    const trimmedTitle = (update.title ?? "").toString().trim();
    if (!trimmedTitle) return NextResponse.json({ error: "Title is required." }, { status: 400 });
    update.title = trimmedTitle;
  }
  if ("item_number" in update) {
    const parsed = Number(update.item_number);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return NextResponse.json({ error: "Number is required and must be a whole number." }, { status: 400 });
    }
    update.item_number = parsed;
  }
  if ("punch_item_manager_id" in update && !update.punch_item_manager_id) {
    return NextResponse.json({ error: "Punch item manager is required." }, { status: 400 });
  }
  if ("final_approver_id" in update && !update.final_approver_id) {
    return NextResponse.json({ error: "Final approver is required." }, { status: 400 });
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("punch_list_items")
    .update(update)
    .eq("id", itemId)
    .eq("project_id", projectId)
    .eq("is_deleted", false)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId, itemId } = await params;
  const supabase = getSupabase();

  const { error } = await supabase
    .from("punch_list_items")
    .update({
      is_deleted: true,
      deleted_at: new Date().toISOString(),
      deleted_by: session.id,
    })
    .eq("id", itemId)
    .eq("project_id", projectId)
    .eq("is_deleted", false);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
