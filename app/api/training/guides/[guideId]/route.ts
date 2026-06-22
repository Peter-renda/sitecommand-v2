/**
 * PATCH  /api/training/guides/[guideId] — rename / re-describe / reorder a guide
 *        in the Table of Contents. Super Admin only.
 *        Body: { title?, description?, sortOrder?, move?: "up" | "down" }.
 * DELETE /api/training/guides/[guideId] — remove a guide (and its stored file
 *        and assignments). Super Admin only.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";

function isSuperAdmin(session: { company_role?: string | null }): boolean {
  return session.company_role === "super_admin";
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ guideId: string }> },
) {
  const session = await getSession();
  if (!session || !isSuperAdmin(session) || !session.company_id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { guideId } = await params;

  let body: { title?: unknown; description?: unknown; move?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON body" }, { status: 400 });
  }

  const supabase = getSupabase();

  // Confirm the guide belongs to the caller's company before touching it.
  const { data: guide } = await supabase
    .from("training_guides")
    .select("id, sort_order")
    .eq("id", guideId)
    .eq("company_id", session.company_id)
    .maybeSingle();
  if (!guide) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Reordering: swap sort_order with the adjacent guide in the requested
  // direction so the Table of Contents can be hand-ordered.
  if (body.move === "up" || body.move === "down") {
    // Moving up → the guide just above (largest sort_order below this one);
    // moving down → the guide just below (smallest sort_order above this one).
    const neighborQuery =
      body.move === "up"
        ? supabase
            .from("training_guides")
            .select("id, sort_order")
            .eq("company_id", session.company_id)
            .lt("sort_order", guide.sort_order)
            .order("sort_order", { ascending: false })
        : supabase
            .from("training_guides")
            .select("id, sort_order")
            .eq("company_id", session.company_id)
            .gt("sort_order", guide.sort_order)
            .order("sort_order", { ascending: true });

    const { data: neighbor } = await neighborQuery.limit(1).maybeSingle();

    if (neighbor) {
      await supabase
        .from("training_guides")
        .update({ sort_order: neighbor.sort_order, updated_at: new Date().toISOString() })
        .eq("id", guide.id);
      await supabase
        .from("training_guides")
        .update({ sort_order: guide.sort_order, updated_at: new Date().toISOString() })
        .eq("id", neighbor.id);
    }
    return NextResponse.json({ ok: true });
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.title === "string" && body.title.trim()) update.title = body.title.trim();
  if (typeof body.description === "string") update.description = body.description.trim() || null;

  const { data, error } = await supabase
    .from("training_guides")
    .update(update)
    .eq("id", guideId)
    .eq("company_id", session.company_id)
    .select("id, title, description")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ guide: data });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ guideId: string }> },
) {
  const session = await getSession();
  if (!session || !isSuperAdmin(session) || !session.company_id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { guideId } = await params;
  const supabase = getSupabase();

  const { data: existing } = await supabase
    .from("training_guides")
    .select("storage_path")
    .eq("id", guideId)
    .eq("company_id", session.company_id)
    .maybeSingle();
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Assignments cascade via the FK; remove the row, then the stored file.
  const { error } = await supabase
    .from("training_guides")
    .delete()
    .eq("id", guideId)
    .eq("company_id", session.company_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (existing.storage_path) {
    void supabase.storage.from("training-guides").remove([existing.storage_path]);
  }

  return NextResponse.json({ ok: true });
}
