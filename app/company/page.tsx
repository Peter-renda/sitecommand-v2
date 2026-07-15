import { getSession } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";
import { redirect } from "next/navigation";
import { isCompanyAdmin } from "@/lib/project-access";
import CompanyClient from "./CompanyClient";

type OrgMemberRow = {
  role: string;
  users: { id: string; username: string; email: string; created_at: string } | null;
};

export default async function CompanyPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  // Both super_admin and admin can access the team management page
  if (!isCompanyAdmin(session.company_role)) redirect("/dashboard");

  if (!session.company_id) redirect("/dashboard");

  const supabase = getSupabase();

  const { data: company } = await supabase
    .from("companies")
    .select("id, name, subscription_plan, subscription_status, seat_limit, billing_owner_id")
    .eq("id", session.company_id)
    .single();

  const { data: memberRows } = await supabase
    .from("org_members")
    .select("role, users(id, username, email, created_at)")
    .eq("org_id", session.company_id)
    .order("created_at", { ascending: true });

  const members = ((memberRows ?? []) as OrgMemberRow[]).map((row) => {
    const u = row.users;
    return { id: u?.id, username: u?.username, email: u?.email, created_at: u?.created_at, company_role: row.role };
  }).filter((m) => m.id);

  const { data: invites } = await supabase
    .from("invitations")
    .select("id, email, invited_role, created_at, expires_at")
    .eq("company_id", session.company_id)
    .eq("invitation_type", "internal")
    .is("accepted_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });

  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, status, created_at, archived_at")
    .eq("company_id", session.company_id)
    .order("created_at", { ascending: false });

  const isSuperAdmin = session.company_role === "super_admin";

  return (
    <CompanyClient
      company={company ?? null}
      members={(members ?? []) as { id: string; username: string; email: string; company_role: string; created_at: string }[]}
      invites={(invites ?? []) as { id: string; email: string; invited_role: string; created_at: string; expires_at: string }[]}
      projects={(projects ?? []) as { id: string; name: string; status: string | null; created_at: string; archived_at: string | null }[]}
      currentUserId={session.id}
      isSuperAdmin={isSuperAdmin}
    />
  );
}
