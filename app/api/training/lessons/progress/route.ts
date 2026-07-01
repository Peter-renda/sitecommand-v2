/**
 * Training → Lessons: per-user completion tracking.
 *
 * Lesson content is static (lib/training-lessons.ts) — this route only
 * persists which lesson ids the current user has marked complete.
 *
 * GET  — { completedIds: string[] } for the current user.
 * POST — body { lessonId, completed }. Upserts (completed: true) or deletes
 *        (completed: false) the row, then returns the refreshed list.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("training_lesson_progress")
    .select("lesson_id")
    .eq("user_id", session.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    completedIds: (data ?? []).map((r: { lesson_id: string }) => r.lesson_id),
  });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { lessonId?: unknown; completed?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON body" }, { status: 400 });
  }

  const lessonId = typeof body.lessonId === "string" ? body.lessonId.trim() : "";
  const completed = body.completed !== false;
  if (!lessonId) return NextResponse.json({ error: "lessonId is required" }, { status: 400 });

  const supabase = getSupabase();

  if (completed) {
    const { error } = await supabase
      .from("training_lesson_progress")
      .upsert(
        { user_id: session.id, lesson_id: lessonId, completed_at: new Date().toISOString() },
        { onConflict: "user_id,lesson_id" },
      );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await supabase
      .from("training_lesson_progress")
      .delete()
      .eq("user_id", session.id)
      .eq("lesson_id", lessonId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data, error: listError } = await supabase
    .from("training_lesson_progress")
    .select("lesson_id")
    .eq("user_id", session.id);

  if (listError) return NextResponse.json({ error: listError.message }, { status: 500 });

  return NextResponse.json({
    completedIds: (data ?? []).map((r: { lesson_id: string }) => r.lesson_id),
  });
}
