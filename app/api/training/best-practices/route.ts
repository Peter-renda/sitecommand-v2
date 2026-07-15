/**
 * Training → Company Guides: Best Practice Templates.
 *
 * GET  /api/training/best-practices — list the company's best-practice entries.
 *      Any member of the company can read; `canManage` is true only for Super Admins.
 * POST /api/training/best-practices — create an entry. Super Admin only.
 *      Body: { title, content? }.
 *
 * These entries are the company's authoritative standards and are also injected
 * into the AI features (Assist, Looking Ahead, To Do) — see
 * `lib/company-best-practices.ts`.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";

function isSuperAdmin(session: { company_role?: string | null }): boolean {
  return session.company_role === "super_admin";
}

type Row = {
  id: string;
  title: string;
  content: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

function serialize(row: Row) {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.company_id) {
    return NextResponse.json({ bestPractices: [], canManage: false });
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("training_best_practices")
    .select("id, title, content, sort_order, created_at, updated_at")
    .eq("company_id", session.company_id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    bestPractices: ((data ?? []) as Row[]).map(serialize),
    canManage: isSuperAdmin(session),
  });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || !isSuperAdmin(session) || !session.company_id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { title?: unknown; content?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON body" }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 });

  const supabase = getSupabase();

  // Append to the end of the list.
  const { data: last } = await supabase
    .from("training_best_practices")
    .select("sort_order")
    .eq("company_id", session.company_id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextSort = (last?.sort_order ?? 0) + 1;

  const { data, error } = await supabase
    .from("training_best_practices")
    .insert({
      company_id: session.company_id,
      title,
      content,
      sort_order: nextSort,
      created_by: session.id,
    })
    .select("id, title, content, sort_order, created_at, updated_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ bestPractice: serialize(data as Row) });
}
