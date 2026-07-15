import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getSession } from "@/lib/auth";
import { sendContractorInviteEmail } from "@/lib/email";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;
  const { contact_id, email, contact_name } = await req.json();

  if (!email) return NextResponse.json({ error: "Email is required" }, { status: 400 });

  const supabase = getSupabase();

  // Get project + owning company name for the email
  const { data: project } = await supabase
    .from("projects")
    .select("name, companies(name)")
    .eq("id", projectId)
    .single();

  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  const company = project.companies as unknown as { name: string } | null;

  // Create invite record
  const { data: invite, error } = await supabase
    .from("contractor_invitations")
    .insert({
      project_id: projectId,
      contact_id: contact_id ?? null,
      email,
      contact_name: contact_name ?? null,
      invited_by: session.id,
    })
    .select("token")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const inviteUrl = `${base}/contractor-invite/${invite.token}`;

  try {
    await sendContractorInviteEmail(email, inviteUrl, project.name, contact_name ?? "", company?.name);
  } catch (e) {
    // Delete the invite if email failed
    await supabase.from("contractor_invitations").delete().eq("token", invite.token);
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
