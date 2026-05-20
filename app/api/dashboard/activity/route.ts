import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabase();

  // 1. Get accessible project IDs (same logic as GET /api/projects)
  let projects: { id: string; name: string }[] = [];

  if (session.company_id) {
    const { data } = await supabase
      .from("projects")
      .select("id, name")
      .eq("company_id", session.company_id);
    projects = data || [];
  } else {
    const { data: memberships } = await supabase
      .from("project_memberships")
      .select("project_id")
      .eq("user_id", session.id);

    if (memberships && memberships.length > 0) {
      const projectIds = memberships.map((m: { project_id: string }) => m.project_id);
      const { data } = await supabase
        .from("projects")
        .select("id, name")
        .in("id", projectIds);
      projects = data || [];
    }
  }

  if (projects.length === 0) {
    return NextResponse.json([]);
  }

  const projectIds = projects.map((p) => p.id);
  const projectMap = new Map(projects.map((p) => [p.id, p.name]));

  type ActivityItem = {
    id: string;
    type: "rfi" | "submittal" | "document" | "daily_log" | "task" | "drawing" | "quick_note" | "photo" | "transmittal";
    title: string;
    project_id: string;
    project_name: string;
    created_at: string;
    changed_at: string;
    href: string;
  };

  const allItems: ActivityItem[] = [];

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // 2. Query each table for items within the last 30 days
  // RFIs
  try {
    const { data } = await supabase
      .from("rfis")
      .select("id, rfi_number, subject, project_id, created_at, updated_at")
      .in("project_id", projectIds)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(200);

    if (data) {
      for (const row of data) {
        allItems.push({
          id: row.id,
          type: "rfi",
          title: `RFI #${row.rfi_number}: ${row.subject}`,
          project_id: row.project_id,
          project_name: projectMap.get(row.project_id) ?? "",
          created_at: row.created_at,
          changed_at: row.updated_at || row.created_at,
          href: `/projects/${row.project_id}/rfis/${row.id}`,
        });
      }
    }
  } catch {}

  // Submittals
  try {
    const { data } = await supabase
      .from("submittals")
      .select("id, submittal_number, title, project_id, created_at, updated_at")
      .in("project_id", projectIds)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(200);

    if (data) {
      for (const row of data) {
        allItems.push({
          id: row.id,
          type: "submittal",
          title: `Submittal #${row.submittal_number}: ${row.title}`,
          project_id: row.project_id,
          project_name: projectMap.get(row.project_id) ?? "",
          created_at: row.created_at,
          changed_at: row.updated_at || row.created_at,
          href: `/projects/${row.project_id}/submittals/${row.id}`,
        });
      }
    }
  } catch {}

  // Documents (type = 'file')
  try {
    const { data } = await supabase
      .from("documents")
      .select("id, name, project_id, created_at, updated_at")
      .in("project_id", projectIds)
      .eq("type", "file")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(200);

    if (data) {
      for (const row of data) {
        allItems.push({
          id: row.id,
          type: "document",
          title: row.name,
          project_id: row.project_id,
          project_name: projectMap.get(row.project_id) ?? "",
          created_at: row.created_at,
          changed_at: row.updated_at || row.created_at,
          href: `/projects/${row.project_id}/documents`,
        });
      }
    }
  } catch {}

  // Daily Logs
  try {
    const { data } = await supabase
      .from("daily_logs")
      .select("id, log_date, project_id, created_at, updated_at")
      .in("project_id", projectIds)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(200);

    if (data) {
      for (const row of data) {
        allItems.push({
          id: row.id,
          type: "daily_log",
          title: `Daily Log: ${row.log_date}`,
          project_id: row.project_id,
          project_name: projectMap.get(row.project_id) ?? "",
          created_at: row.created_at,
          changed_at: row.updated_at || row.created_at,
          href: `/projects/${row.project_id}/daily-log?date=${encodeURIComponent(row.log_date)}`,
        });
      }
    }
  } catch {}

  // Tasks
  try {
    const { data } = await supabase
      .from("tasks")
      .select("id, title, project_id, created_at, updated_at")
      .in("project_id", projectIds)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(200);

    if (data) {
      for (const row of data) {
        allItems.push({
          id: row.id,
          type: "task",
          title: `Task: ${row.title}`,
          project_id: row.project_id,
          project_name: projectMap.get(row.project_id) ?? "",
          created_at: row.created_at,
          changed_at: row.updated_at || row.created_at,
          href: `/projects/${row.project_id}/tasks/${row.id}`,
        });
      }
    }
  } catch {}

  // Drawings (skip if table doesn't exist)
  try {
    const { data } = await supabase
      .from("drawings")
      .select("id, name, project_id, created_at, updated_at")
      .in("project_id", projectIds)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(200);

    if (data) {
      for (const row of data) {
        allItems.push({
          id: row.id,
          type: "drawing",
          title: `Drawing: ${row.name}`,
          project_id: row.project_id,
          project_name: projectMap.get(row.project_id) ?? "",
          created_at: row.created_at,
          changed_at: row.updated_at || row.created_at,
          href: `/projects/${row.project_id}/drawings`,
        });
      }
    }
  } catch {}

  // Quick Notes
  try {
    const { data } = await supabase
      .from("quick_notes")
      .select("id, title, content, project_id, created_at, updated_at")
      .in("project_id", projectIds)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(200);

    if (data) {
      for (const row of data) {
        allItems.push({
          id: row.id,
          type: "quick_note",
          title: row.title || row.content?.slice(0, 80) || "Quick note",
          project_id: row.project_id,
          project_name: projectMap.get(row.project_id) ?? "",
          created_at: row.created_at,
          changed_at: row.updated_at || row.created_at,
          href: `/projects/${row.project_id}/quick-notes`,
        });
      }
    }
  } catch {}

  // Photos
  try {
    const { data } = await supabase
      .from("photos")
      .select("id, caption, project_id, created_at, updated_at")
      .in("project_id", projectIds)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(200);

    if (data) {
      for (const row of data) {
        allItems.push({
          id: row.id,
          type: "photo",
          title: row.caption || "Photo uploaded",
          project_id: row.project_id,
          project_name: projectMap.get(row.project_id) ?? "",
          created_at: row.created_at,
          changed_at: row.updated_at || row.created_at,
          href: `/projects/${row.project_id}/photos`,
        });
      }
    }
  } catch {}

  // Transmittals
  try {
    const { data } = await supabase
      .from("transmittals")
      .select("id, subject, project_id, created_at, updated_at")
      .in("project_id", projectIds)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(200);

    if (data) {
      for (const row of data) {
        allItems.push({
          id: row.id,
          type: "transmittal",
          title: row.subject || "Transmittal updated",
          project_id: row.project_id,
          project_name: projectMap.get(row.project_id) ?? "",
          created_at: row.created_at,
          changed_at: row.updated_at || row.created_at,
          href: `/projects/${row.project_id}/transmittals/${row.id}`,
        });
      }
    }
  } catch {}

  // 3. Merge and sort by changed_at desc — return all within 30 days
  allItems.sort(
    (a, b) => new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime()
  );

  return NextResponse.json(allItems);
}
