import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { canAccessProject } from "@/lib/project-access";
import { getSupabase } from "@/lib/supabase";

function isTableMissing(errorMessage: string | null | undefined) {
  if (!errorMessage) return false;
  const n = errorMessage.toLowerCase();
  return n.includes("project_assist_history") && (n.includes("schema cache") || n.includes("does not exist"));
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;
  const hasAccess = await canAccessProject(projectId, session);
  if (!hasAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("project_assist_history")
    .select("id, question, answer, stats, source_documents, created_at, created_by")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    if (isTableMissing(error.message)) return NextResponse.json({ history: [] });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ history: data ?? [] });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;
  const hasAccess = await canAccessProject(projectId, session);
  if (!hasAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { question?: unknown; answer?: unknown; stats?: unknown; sourceDocuments?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON body" }, { status: 400 });
  }

  const question = typeof body.question === "string" ? body.question.trim() : "";
  const answer = typeof body.answer === "string" ? body.answer.trim() : "";
  if (!question) return NextResponse.json({ error: "question is required" }, { status: 400 });
  if (!answer) return NextResponse.json({ error: "answer is required" }, { status: 400 });

  const supabase = getSupabase();
  const { data: inserted, error } = await supabase
    .from("project_assist_history")
    .insert({
      project_id: projectId,
      created_by: session.id,
      question,
      answer,
      stats: body.stats ?? null,
      source_documents: body.sourceDocuments ?? null,
    })
    .select("id, question, answer, stats, source_documents, created_at, created_by")
    .single();

  if (error) {
    if (isTableMissing(error.message)) return NextResponse.json({ item: null });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ item: inserted });
}
