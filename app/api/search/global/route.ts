import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getSession } from "@/lib/auth";

type SearchResult = {
  id: string;
  type: "project" | "rfi" | "submittal" | "document" | "task" | "drawing";
  title: string;
  subtitle: string;
  href: string;
};

const PER_TYPE_LIMIT = 25;
const TOTAL_LIMIT = 50;

function escapeIlike(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = (req.nextUrl.searchParams.get("q") || "").trim();
  if (q.length < 1) return NextResponse.json([]);

  const supabase = getSupabase();
  const isOrgAdmin =
    session.company_role === "super_admin" || session.company_role === "admin";

  // Resolve accessible projects (same rules as GET /api/projects)
  let projectsList: { id: string; name: string; description: string | null; address: string | null; status: string | null; project_number: string | null }[] = [];

  if (session.company_id && isOrgAdmin) {
    const { data } = await supabase
      .from("projects")
      .select("id, name, description, address, status, project_number")
      .eq("company_id", session.company_id);
    projectsList = data || [];
  } else {
    const { data: memberships } = await supabase
      .from("project_memberships")
      .select("project_id")
      .eq("user_id", session.id);

    if (memberships && memberships.length > 0) {
      const projectIds = memberships.map((m: { project_id: string }) => m.project_id);
      let pq = supabase
        .from("projects")
        .select("id, name, description, address, status, project_number")
        .in("id", projectIds);
      if (session.company_id) pq = pq.eq("company_id", session.company_id);
      const { data } = await pq;
      projectsList = data || [];
    }
  }

  if (projectsList.length === 0) return NextResponse.json([]);

  const projectIds = projectsList.map((p) => p.id);
  const projectMap = new Map(projectsList.map((p) => [p.id, p.name]));
  const needle = escapeIlike(q);
  const pattern = `%${needle}%`;

  const results: SearchResult[] = [];

  // Projects — filter locally across all the fields surfaced in the legacy in-memory search
  const ql = q.toLowerCase();
  for (const p of projectsList) {
    const haystack = [p.name, p.description, p.address, p.status, p.project_number]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (haystack.includes(ql)) {
      results.push({
        id: `project-${p.id}`,
        type: "project",
        title: p.name,
        subtitle: `Project • ${p.status || "No status"}`,
        href: `/projects/${p.id}`,
      });
    }
    if (results.length >= PER_TYPE_LIMIT) break;
  }

  async function safeRun<T>(builder: PromiseLike<{ data: T[] | null }>): Promise<T[]> {
    try {
      const { data } = await builder;
      return data || [];
    } catch {
      return [];
    }
  }

  const asInt = /^\d+$/.test(q) ? Number(q) : null;

  const rfiQuery = (() => {
    const base = supabase
      .from("rfis")
      .select("id, rfi_number, subject, project_id")
      .in("project_id", projectIds);
    const filtered = asInt !== null
      ? base.or(`subject.ilike.${pattern},rfi_number.eq.${asInt}`)
      : base.ilike("subject", pattern);
    return filtered.order("created_at", { ascending: false }).limit(PER_TYPE_LIMIT);
  })();

  const submittalQuery = (() => {
    const base = supabase
      .from("submittals")
      .select("id, submittal_number, title, project_id")
      .in("project_id", projectIds);
    const filtered = asInt !== null
      ? base.or(`title.ilike.${pattern},submittal_number.eq.${asInt}`)
      : base.ilike("title", pattern);
    return filtered.order("created_at", { ascending: false }).limit(PER_TYPE_LIMIT);
  })();

  // Run all per-table searches in parallel
  const [rfis, submittals, documents, tasks, drawings] = await Promise.all([
    safeRun<{ id: string; rfi_number: string | number; subject: string; project_id: string }>(rfiQuery),
    safeRun<{ id: string; submittal_number: string | number; title: string; project_id: string }>(submittalQuery),
    safeRun<{ id: string; name: string; project_id: string }>(
      supabase
        .from("documents")
        .select("id, name, project_id")
        .in("project_id", projectIds)
        .eq("type", "file")
        .ilike("name", pattern)
        .order("created_at", { ascending: false })
        .limit(PER_TYPE_LIMIT)
    ),
    safeRun<{ id: string; title: string; status: string | null; project_id: string }>(
      supabase
        .from("tasks")
        .select("id, title, status, project_id")
        .in("project_id", projectIds)
        .ilike("title", pattern)
        .order("created_at", { ascending: false })
        .limit(PER_TYPE_LIMIT)
    ),
    safeRun<{ id: string; name: string; project_id: string }>(
      supabase
        .from("drawings")
        .select("id, name, project_id")
        .in("project_id", projectIds)
        .ilike("name", pattern)
        .order("created_at", { ascending: false })
        .limit(PER_TYPE_LIMIT)
    ),
  ]);

  for (const r of rfis) {
    results.push({
      id: `rfi-${r.id}`,
      type: "rfi",
      title: `RFI #${r.rfi_number}: ${r.subject}`,
      subtitle: `RFI • ${projectMap.get(r.project_id) ?? ""}`,
      href: `/projects/${r.project_id}/rfis/${r.id}`,
    });
  }

  for (const s of submittals) {
    results.push({
      id: `submittal-${s.id}`,
      type: "submittal",
      title: `Submittal #${s.submittal_number}: ${s.title}`,
      subtitle: `Submittal • ${projectMap.get(s.project_id) ?? ""}`,
      href: `/projects/${s.project_id}/submittals/${s.id}`,
    });
  }

  for (const d of documents) {
    results.push({
      id: `document-${d.id}`,
      type: "document",
      title: d.name,
      subtitle: `Document • ${projectMap.get(d.project_id) ?? ""}`,
      href: `/projects/${d.project_id}/documents`,
    });
  }

  for (const t of tasks) {
    results.push({
      id: `task-${t.id}`,
      type: "task",
      title: t.title,
      subtitle: `Task • ${projectMap.get(t.project_id) ?? ""}${t.status ? ` • ${t.status}` : ""}`,
      href: `/projects/${t.project_id}/tasks/${t.id}`,
    });
  }

  for (const dr of drawings) {
    results.push({
      id: `drawing-${dr.id}`,
      type: "drawing",
      title: `Drawing: ${dr.name}`,
      subtitle: `Drawing • ${projectMap.get(dr.project_id) ?? ""}`,
      href: `/projects/${dr.project_id}/drawings`,
    });
  }

  return NextResponse.json(results.slice(0, TOTAL_LIMIT));
}
