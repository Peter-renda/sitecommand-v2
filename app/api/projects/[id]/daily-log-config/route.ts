import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";
import { canAccessProject } from "@/lib/project-access";

type Params = { params: Promise<{ id: string }> };

type SectionConfig = {
  hidden?: string[];
  custom?: { key: string; label: string }[];
};

const SECTION_KEYS = new Set([
  "manpower",
  "inspections",
  "deliveries",
  "visitors",
  "safety_violations",
  "accidents",
  "delays",
  "note_entries",
  "weather_observations",
]);

function sanitizeConfig(raw: unknown): Record<string, SectionConfig> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, SectionConfig> = {};
  for (const [section, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!SECTION_KEYS.has(section) || !value || typeof value !== "object") continue;
    const v = value as { hidden?: unknown; custom?: unknown };
    const hidden = Array.isArray(v.hidden)
      ? v.hidden.filter((h): h is string => typeof h === "string").slice(0, 50)
      : [];
    const custom = Array.isArray(v.custom)
      ? v.custom
          .filter(
            (c): c is { key: string; label: string } =>
              !!c && typeof c === "object" &&
              typeof (c as { key?: unknown }).key === "string" &&
              typeof (c as { label?: unknown }).label === "string" &&
              !!(c as { label: string }).label.trim()
          )
          .map((c) => ({ key: c.key, label: c.label.trim().slice(0, 80) }))
          .slice(0, 20)
      : [];
    if (hidden.length > 0 || custom.length > 0) out[section] = { hidden, custom };
  }
  return out;
}

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;
  if (!(await canAccessProject(projectId, session))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("daily_log_field_configs")
    .select("config")
    .eq("project_id", projectId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ config: data?.config ?? {} });
}

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Only company super admins may configure daily log columns.
  if (session.company_role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: projectId } = await params;
  const supabase = getSupabase();

  // The project must belong to the super admin's company.
  const { data: project } = await supabase
    .from("projects")
    .select("company_id")
    .eq("id", projectId)
    .single();
  if (!project || project.company_id !== session.company_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const config = sanitizeConfig((body as { config?: unknown }).config);

  const { error } = await supabase
    .from("daily_log_field_configs")
    .upsert(
      { project_id: projectId, config, updated_by: session.id, updated_at: new Date().toISOString() },
      { onConflict: "project_id" }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ config });
}
