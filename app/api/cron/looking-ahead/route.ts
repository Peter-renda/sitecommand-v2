/**
 * Daily cron — generate AI "Looking Ahead" briefing notes for every active
 * project.
 *
 * Scheduled for the early morning (see vercel.json) so a fresh set of
 * things-to-know is waiting when the team logs on. For each active project we
 * build a snapshot of where the work stands (plans, specs, contracts, emails,
 * schedule, RFIs, submittals, daily logs) and ask the LLM what facts the crew
 * should keep top of mind. Generation dedupes against prior notes, so running
 * daily is safe.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { generateLookingAheadNotes } from "@/lib/looking-ahead";

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
      const result = await generateLookingAheadNotes(supabase, p.id as string);
      created += result.created;
      processed++;
    } catch {
      // Keep the cron running for the remaining projects.
    }
  }

  return NextResponse.json({ ok: true, projects: projects.length, processed, created });
}
