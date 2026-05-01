import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; contactId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId, contactId } = await params;
  const supabase = getSupabase();

  const { data: companyContact, error: companyError } = await supabase
    .from("directory_contacts")
    .select("id,company")
    .eq("id", contactId)
    .eq("project_id", projectId)
    .single();

  if (companyError || !companyContact) return NextResponse.json({ error: "Contact not found" }, { status: 404 });

  const companyName = String(companyContact.company || "").trim();
  if (!companyName) return NextResponse.json({ onProject: [], portfolio: [] });

  const { data: project } = await supabase.from("projects").select("company_id").eq("id", projectId).single();
  if (!project?.company_id) return NextResponse.json({ onProject: [], portfolio: [] });

  const { data: contacts, error } = await supabase
    .from("directory_contacts")
    .select("id,project_id,first_name,last_name,email,company")
    .eq("type", "user")
    .eq("company", companyName);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const projectIds = Array.from(new Set((contacts ?? []).map((c) => c.project_id).filter(Boolean)));
  const { data: projects } = await supabase.from("projects").select("id,company_id").in("id", projectIds);
  const projectCompany = new Map((projects ?? []).map((p) => [p.id, p.company_id]));

  const samePortfolio = (contacts ?? []).filter((c) => projectCompany.get(c.project_id) === project.company_id);

  return NextResponse.json({
    onProject: samePortfolio.filter((c) => c.project_id === projectId),
    portfolio: samePortfolio.filter((c) => c.project_id !== projectId),
  });
}
