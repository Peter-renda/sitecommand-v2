import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getSession } from "@/lib/auth";
import { canAccessProject } from "@/lib/project-access";
import { REPORT_RECORD_SLUGS } from "@/lib/report-record-fields";

const ALLOWED = new Set(REPORT_RECORD_SLUGS);

// GET /api/projects/[id]/report-records?entity=<slug>
// Lists report records for one entity (or all when entity is omitted).
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;
  if (!(await canAccessProject(projectId, session))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const entity = req.nextUrl.searchParams.get("entity");
  if (entity && !ALLOWED.has(entity)) {
    return NextResponse.json({ error: "Unknown entity" }, { status: 400 });
  }

  const supabase = getSupabase();
  let query = supabase
    .from("report_records")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });
  if (entity) query = query.eq("entity", entity);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// POST /api/projects/[id]/report-records  { entity, report_fields }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;
  if (!(await canAccessProject(projectId, session))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const entity = String(body.entity || "");
  if (!ALLOWED.has(entity)) {
    return NextResponse.json({ error: "Unknown entity" }, { status: 400 });
  }
  const reportFields =
    body.report_fields && typeof body.report_fields === "object" ? body.report_fields : {};

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("report_records")
    .insert({ project_id: projectId, entity, report_fields: reportFields, created_by: session.id })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
