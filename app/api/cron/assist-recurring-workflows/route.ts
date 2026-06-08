import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { getSupabase } from "@/lib/supabase";

function nowInEasternParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "long",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(date);
  return {
    weekday: (parts.find((p) => p.type === "weekday")?.value || "").toLowerCase(),
    day: Number(parts.find((p) => p.type === "day")?.value ?? "-1"),
    hour: Number(parts.find((p) => p.type === "hour")?.value ?? "-1"),
    minute: Number(parts.find((p) => p.type === "minute")?.value ?? "-1"),
  };
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "GEMINI_API_KEY missing" }, { status: 503 });

  const supabase = getSupabase();
  const { weekday, day, hour, minute } = nowInEasternParts();
  const { data, error } = await supabase
    .from("assist_recurring_workflows")
    .select("id, project_id, name, prompt, frequency, run_day_of_week, run_date, run_hour_et, run_minute_et, active")
    .eq("active", true)
    .eq("run_hour_et", hour)
    .eq("run_minute_et", minute);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Of the workflows scheduled for this hour/minute, keep the ones due today
  // based on their frequency: daily (every day), weekly (matching weekday),
  // or monthly (matching the day-of-month from run_date).
  const due = (data ?? []).filter((w) => {
    const freq = String(w.frequency ?? "daily");
    if (freq === "weekly") return String(w.run_day_of_week ?? "").toLowerCase() === weekday;
    if (freq === "monthly") {
      const m = /^\d{4}-\d{2}-(\d{2})/.exec(String(w.run_date ?? ""));
      return m ? Number(m[1]) === day : false;
    }
    return freq === "daily";
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

  return NextResponse.json({ ok: true, matched: due.length, created, weekdayEt: weekday, dayEt: day, hourEt: hour, minuteEt: minute });
}
