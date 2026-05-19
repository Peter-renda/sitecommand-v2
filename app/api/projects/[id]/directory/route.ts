import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getSession } from "@/lib/auth";
import { addUserToDirectory } from "@/lib/directory";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;
  const supabase = getSupabase();

  // Sync any project members not yet in directory_contacts
  const { data: memberships } = await supabase
    .from("project_memberships")
    .select("user_id")
    .eq("project_id", projectId);

  if (memberships?.length) {
    await Promise.all(
      memberships.map((m) => addUserToDirectory(supabase, projectId, m.user_id))
    );
  }

  const { data, error } = await supabase
    .from("directory_contacts")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;
  const body = await req.json();
  const { type, first_name, last_name, email, phone, company, permission, group_name, notes, job_title, address, member_contact_ids } = body;

  if (!type) return NextResponse.json({ error: "Type is required" }, { status: 400 });

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("directory_contacts")
    .insert({
      project_id: projectId,
      type,
      first_name: first_name || null,
      last_name: last_name || null,
      email: email || null,
      phone: phone || null,
      company: company || null,
      permission: permission || null,
      group_name: group_name || null,
      notes: notes || null,
      job_title: job_title || null,
      address: address || null,
      member_contact_ids: Array.isArray(member_contact_ids) ? member_contact_ids : [],
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
