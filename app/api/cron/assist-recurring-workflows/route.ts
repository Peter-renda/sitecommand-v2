import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

function nowInEasternParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "long",
    hour: "numeric",
    hour12: false,
  }).formatToParts(date);
  const weekday = (parts.find((p) => p.type === "weekday")?.value || "").toLowerCase();
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "-1");
  return { weekday, hour };
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabase();
  const { weekday, hour } = nowInEasternParts();
  const { data, error } = await supabase
    .from("assist_recurring_workflows")
    .select("id, project_id, name, prompt, recipients, run_day_of_week, run_hour_et, active")
    .eq("active", true)
    .eq("run_day_of_week", weekday)
    .eq("run_hour_et", hour);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Mark matching workflows as run. (Report generation pipeline can key off this run marker.)
  const ids = (data ?? []).map((w) => w.id as string);
  if (ids.length > 0) {
    await supabase
      .from("assist_recurring_workflows")
      .update({ last_run_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .in("id", ids);
  }

  return NextResponse.json({
    ok: true,
    matched: ids.length,
    weekdayEt: weekday,
    hourEt: hour,
  });
}
