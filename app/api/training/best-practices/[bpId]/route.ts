/**
 * PATCH  /api/training/best-practices/[bpId] — edit title/content, or reorder
 *        ({ move: "up" | "down" }). Super Admin only.
 * DELETE /api/training/best-practices/[bpId] — remove an entry. Super Admin only.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";

function isSuperAdmin(session: { company_role?: string | null }): boolean {
  return session.company_role === "super_admin";
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ bpId: string }> },
) {
  const session = await getSession();
  if (!session || !isSuperAdmin(session) || !session.company_id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { bpId } = await params;

  let body: { title?: unknown; content?: unknown; move?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON body" }, { status: 400 });
  }

  const supabase = getSupabase();

  // Confirm the entry belongs to the caller's company.
  const { data: entry } = await supabase
    .from("training_best_practices")
    .select("id, sort_order")
    .eq("id", bpId)
    .eq("company_id", session.company_id)
    .maybeSingle();
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Reorder: swap sort_order with the adjacent entry.
  if (body.move === "up" || body.move === "down") {
    const neighborQuery =
      body.move === "up"
        ? supabase
            .from("training_best_practices")
            .select("id, sort_order")
            .eq("company_id", session.company_id)
            .lt("sort_order", entry.sort_order)
            .order("sort_order", { ascending: false })
        : supabase
            .from("training_best_practices")
            .select("id, sort_order")
            .eq("company_id", session.company_id)
            .gt("sort_order", entry.sort_order)
            .order("sort_order", { ascending: true });

    const { data: neighbor } = await neighborQuery.limit(1).maybeSingle();
    if (neighbor) {
      await supabase
        .from("training_best_practices")
        .update({ sort_order: neighbor.sort_order, updated_at: new Date().toISOString() })
        .eq("id", entry.id);
      await supabase
        .from("training_best_practices")
        .update({ sort_order: entry.sort_order, updated_at: new Date().toISOString() })
        .eq("id", neighbor.id);
    }
    return NextResponse.json({ ok: true });
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.title === "string" && body.title.trim()) update.title = body.title.trim();
  if (typeof body.content === "string") update.content = body.content.trim();

  const { data, error } = await supabase
    .from("training_best_practices")
    .update(update)
    .eq("id", bpId)
    .eq("company_id", session.company_id)
    .select("id, title, content, sort_order, created_at, updated_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    bestPractice: {
      id: data.id,
      title: data.title,
      content: data.content,
      sortOrder: data.sort_order,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    },
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ bpId: string }> },
) {
  const session = await getSession();
  if (!session || !isSuperAdmin(session) || !session.company_id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { bpId } = await params;
  const supabase = getSupabase();

  const { error } = await supabase
    .from("training_best_practices")
    .delete()
    .eq("id", bpId)
    .eq("company_id", session.company_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
