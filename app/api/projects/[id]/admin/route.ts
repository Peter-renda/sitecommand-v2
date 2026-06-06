import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getSession } from "@/lib/auth";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("projects")
    .select("id, name, description, address, zip_code, status, project_number, sector, work_scope, city, state, county, start_date, actual_start_date, completion_date, projected_finish_date, warranty_start_date, warranty_end_date, erp_sync, erp_job_cost_sync, prevent_overbilling, non_commitment_costs, test_project, sage_300_id")
    .eq("id", id)
    .single();

  if (error || !data) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  const canEdit = session?.company_role === "admin" || session?.company_role === "super_admin";
  if (!session || !canEdit) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();

  const allowed = [
    "name", "description", "project_number", "status", "sector", "work_scope",
    "address", "city", "state", "zip_code", "county",
    "start_date", "actual_start_date", "completion_date",
    "projected_finish_date", "warranty_start_date", "warranty_end_date",
    "erp_sync", "erp_job_cost_sync", "prevent_overbilling",
    "non_commitment_costs", "test_project", "sage_300_id",
  ];

  const update: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) {
      const value = body[key];
      // Preserve boolean false; for other fields normalize empty strings to null.
      update[key] = typeof value === "boolean" ? value : value || null;
    }
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("projects")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
