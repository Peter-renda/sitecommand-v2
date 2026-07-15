/**
 * Daily cron — generate AI "To Do" recommendations for every active project.
 *
 * Scheduled for ~4am ET (see vercel.json) so a fresh set of recommended to-do
 * items is waiting when the team logs on. For each active project we build a
 * snapshot of recent signals (emails, schedule position + lead times, open
 * RFIs/submittals, meetings, etc.) and ask the LLM what the crew should tackle
 * next. Generation dedupes against prior suggestions, so running daily is safe.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { generateTodoRecommendations } from "@/lib/todo-recommendations";

export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: "GEMINI_API_KEY missing" }, { status: 503 });
  }

  const supabase = getSupabase();
  const { data: projects, error } = await supabase
    .from("projects")
    .select("id")
    .eq("status", "active");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!projects?.length) return NextResponse.json({ ok: true, projects: 0, created: 0 });

  let created = 0;
  let processed = 0;
  for (const p of projects) {
    try {
      const result = await generateTodoRecommendations(supabase, p.id as string);
      created += result.created;
      processed++;
    } catch {
      // Keep the cron running for the remaining projects.
    }
  }

  return NextResponse.json({ ok: true, projects: projects.length, processed, created });
}
