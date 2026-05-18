import { getSession } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";
import { redirect, notFound } from "next/navigation";
import { isCompanyAdmin } from "@/lib/project-access";
import { companyRoleDefaultLevel, type PermissionLevel } from "@/lib/permission-templates";
import MemberToolAccessClient from "./MemberToolAccessClient";

export default async function MemberDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!isCompanyAdmin(session.company_role)) redirect("/dashboard");
  if (!session.company_id) redirect("/dashboard");

  const { userId } = await params;
  const supabase = getSupabase();

  const { data: membership } = await supabase
    .from("org_members")
    .select("role, tool_levels, users(id, username, email)")
    .eq("user_id", userId)
    .eq("org_id", session.company_id)
    .maybeSingle();

  if (!membership) notFound();

  const user = membership.users as { id: string; username: string; email: string } | null;
  if (!user) notFound();

  const isSuperAdmin = session.company_role === "super_admin";
  const toolLevels = (membership.tool_levels ?? {}) as Record<string, PermissionLevel>;
  const defaultLevel = companyRoleDefaultLevel(membership.role);

  return (
    <MemberToolAccessClient
      member={{
        id: user.id,
        username: user.username,
        email: user.email,
        company_role: membership.role,
      }}
      initialToolLevels={toolLevels}
      defaultLevel={defaultLevel}
      isSuperAdmin={isSuperAdmin}
      currentUserId={session.id}
    />
  );
}
