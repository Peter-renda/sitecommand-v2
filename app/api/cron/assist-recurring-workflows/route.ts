import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { getSupabase } from "@/lib/supabase";

const DAY_MS = 24 * 60 * 60 * 1000;

// Wall-clock parts of an instant, expressed in US Eastern time.
function etParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const m: Record<string, string> = {};
  for (const p of parts) m[p.type] = p.value;
  const hour = Number(m.hour) === 24 ? 0 : Number(m.hour);
  return {
    weekday: (m.weekday || "").toLowerCase(), // "mon", "tue", ...
    year: Number(m.year),
    month: Number(m.month),
    day: Number(m.day),
    hour,
    minute: Number(m.minute),
    second: Number(m.second),
  };
}

// Eastern offset (ms) at a given instant: (ET wall clock read as UTC) - actual UTC.
// Negative (e.g. -4h for EDT, -5h for EST).
function etOffsetMs(date: Date): number {
  const p = etParts(date);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - date.getTime();
}

// The UTC instant for the start (midnight) of the given Eastern calendar day,
// accounting for whichever offset (EST/EDT) is in effect.
function startOfEtDay(year: number, month: number, day: number): Date {
  const wall = Date.UTC(year, month - 1, day, 0, 0, 0);
  let utc = wall - etOffsetMs(new Date(wall));
  utc = wall - etOffsetMs(new Date(utc)); // refine once for the DST-transition edge
  return new Date(utc);
}

// The most recent Eastern calendar day (<= now) this workflow was scheduled for,
// represented as that day's midnight ET instant — or null if none applies.
//
// We schedule at day granularity because Vercel Hobby crons run only once per day
// at an imprecise time, so the chosen run hour can't be honored precisely. Matching
// on the calendar day keeps weekly workflows on their chosen weekday and monthly on
// their chosen date regardless of when in the day the cron actually fires.
function mostRecentOccurrence(
  now: Date,
  frequency: string,
  runDayOfWeek: string,
  runDate: string,
): Date | null {
  if (frequency === "daily") {
    const np = etParts(now);
    return startOfEtDay(np.year, np.month, np.day);
  }

  if (frequency === "weekly") {
    const target = runDayOfWeek.slice(0, 3);
    for (let back = 0; back < 8; back++) {
      const p = etParts(new Date(now.getTime() - back * DAY_MS));
      if (p.weekday === target) return startOfEtDay(p.year, p.month, p.day);
    }
    return null;
  }

  if (frequency === "monthly") {
    const dom = Number(runDate); // runDate now carries the raw day-of-month integer as a string
    if (!Number.isInteger(dom) || dom < 1 || dom > 31) return null;
    const np = etParts(now);
    for (let back = 0; back < 13; back++) {
      let year = np.year;
      let month = np.month - back;
      while (month < 1) { month += 12; year -= 1; }
      const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
      const effectiveDay = Math.min(dom, daysInMonth); // clamp to last day of short months
      const occ = startOfEtDay(year, month, effectiveDay);
      if (occ.getTime() <= now.getTime()) return occ;
    }
    return null;
  }

  return null;
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "GEMINI_API_KEY missing" }, { status: 503 });

  const supabase = getSupabase();
  const now = new Date();

  const { data, error } = await supabase
    .from("assist_recurring_workflows")
    .select("id, project_id, name, prompt, frequency, run_day_of_week, run_day_of_month, last_run_at, active")
    .eq("active", true);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // A workflow is due when its most recent scheduled day has arrived and it has not
  // already been run for that day. Comparing against last_run_at dedupes runs and lets
  // a once-daily cron catch up no matter when it fires.
  const due = (data ?? []).filter((w) => {
    const occ = mostRecentOccurrence(
      now,
      String(w.frequency ?? "daily"),
      String(w.run_day_of_week ?? "").toLowerCase(),
      String(w.run_day_of_month ?? ""),
    );
    if (!occ) return false;
    const lastRun = w.last_run_at ? new Date(w.last_run_at).getTime() : 0;
    return lastRun < occ.getTime();
  });

  const ai = new GoogleGenAI({ apiKey });
  let created = 0;
  for (const w of due) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ role: "user", parts: [{ text: String(w.prompt ?? "") }] }],
      });
      const text = (response.text ?? "").trim() || "No output generated.";
      const safeName = String(w.name ?? "Recurring Workflow").replace(/[^a-z0-9\- ]/gi, "").trim() || "Recurring Workflow";
      const fileName = `${safeName} - ${new Date().toISOString()}.md`;
      const fileUrl = `data:text/markdown;charset=utf-8,${encodeURIComponent(text)}`;
      const { error: insertErr } = await supabase.from("assist_recurring_workflow_reports").insert({
        workflow_id: w.id,
        project_id: w.project_id,
        file_name: fileName,
        file_url: fileUrl,
        file_type: "pdf",
      });
      if (!insertErr) created++;
      await supabase.from("assist_recurring_workflows").update({ last_run_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", w.id);
    } catch {
      // keep cron running for other workflows
    }
  }

  return NextResponse.json({ ok: true, candidates: (data ?? []).length, due: due.length, created });
}
