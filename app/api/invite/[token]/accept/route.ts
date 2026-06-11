import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase";
import { createToken } from "@/lib/auth";
import { addUserToDirectory } from "@/lib/directory";
import { templateNameToCategoryAndType } from "@/lib/permission-templates";
import { applyPermissionTemplate } from "@/lib/apply-permission-template";

/**
 * Looks up the directory contact for (project, email) and applies its
 * permission template (if set) to the newly granted user. Silently no-ops
 * when no matching contact, no template, or no owning company.
 */
async function applyDirectoryTemplateForInvite(
  supabase: SupabaseClient,
  projectId: string,
  companyId: string,
  email: string,
  userId: string
) {
  const { data: contact } = await supabase
    .from("directory_contacts")
    .select("permission")
    .eq("project_id", projectId)
    .eq("type", "user")
    .ilike("email", email)
    .maybeSingle();

  const mapped = templateNameToCategoryAndType(contact?.permission);
  if (!mapped) return;

  await applyPermissionTemplate(supabase, {
    companyId,
    projectId,
    userId,
    category: mapped.category,
    userType: mapped.userType,
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { firstName, lastName, password, existingAccount } = await req.json();
  const username = `${firstName ?? ""} ${lastName ?? ""}`.trim();

  if (!password) {
    return NextResponse.json({ error: "Password is required" }, { status: 400 });
  }
  if (!existingAccount && (!firstName || !lastName)) {
    return NextResponse.json({ error: "First and last name are required" }, { status: 400 });
  }

  const supabase = getSupabase();

  const { data: invite } = await supabase
    .from("invitations")
    .select(`
      id, email, company_id, accepted_at, expires_at,
      invitation_type, project_id, project_role, invited_role, allowed_sections,
      companies(name, seat_limit)
    `)
    .eq("token", token)
    .single();

  if (!invite) {
    return NextResponse.json({ error: "Invalid invitation" }, { status: 404 });
  }

  if (invite.accepted_at) {
    return NextResponse.json({ error: "Invitation already used" }, { status: 410 });
  }

  if (new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ error: "Invitation has expired" }, { status: 410 });
  }

  const company = invite.companies as unknown as {
    name: string;
    seat_limit: number;
  } | null;

  if (!company) {
    return NextResponse.json({ error: "Company not found" }, { status: 403 });
  }

  const isExternal = invite.invitation_type === "external";

  // Internal invites consume a seat
  if (!isExternal) {
    const { count: memberCount } = await supabase
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("company_id", invite.company_id);

    if (company.seat_limit > 0 && (memberCount ?? 0) >= company.seat_limit) {
      return NextResponse.json({ error: "Seat limit reached" }, { status: 403 });
    }
  }

  // ── Existing account: log in and grant access ──────────────────────────────
  if (existingAccount) {
    const { data: user } = await supabase
      .from("users")
      .select("id, username, email, role, company_id, company_role, user_type, password_hash")
      .eq("email", invite.email)
      .maybeSingle();

    if (!user) {
      return NextResponse.json({ error: "No account found for this email" }, { status: 404 });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
    }

    // Grant project access. For external invites, any allowed_sections list on
    // the invitation scopes which tools the collaborator may see (NULL = all).
    if (invite.project_id) {
      const projectRole = invite.project_role ?? "external_viewer";
      await supabase.from("project_memberships").upsert(
        {
          project_id: invite.project_id,
          user_id: user.id,
          company_id: invite.company_id,
          role: projectRole,
          permission: projectRole === "external_viewer" ? "read_only" : "write",
          allowed_sections: isExternal ? (invite.allowed_sections ?? null) : null,
        },
        { onConflict: "project_id,user_id" }
      );
      await addUserToDirectory(supabase, invite.project_id, user.id);
      await applyDirectoryTemplateForInvite(
        supabase,
        invite.project_id,
        invite.company_id,
        invite.email,
        user.id
      );
    }

    // For internal invites: ensure the user is in org_members for the invited company
    let effectiveCompanyId = user.company_id;
    let effectiveCompanyRole = user.company_role;
    if (!isExternal) {
      const assignedRole = invite.invited_role ?? "member";
      const normalizedRole = ["super_admin", "admin"].includes(assignedRole) ? assignedRole : "member";
      await supabase.from("org_members").upsert(
        { user_id: user.id, org_id: invite.company_id, role: normalizedRole },
        { onConflict: "user_id,org_id" }
      );
      // If the user had no company yet, bind them to this company in the users table
      if (!user.company_id) {
        await supabase
          .from("users")
          .update({ company_id: invite.company_id, company_role: normalizedRole, company: company.name })
          .eq("id", user.id);
      }
      effectiveCompanyId = invite.company_id;
      effectiveCompanyRole = normalizedRole;
    }

    await supabase.from("invitations").update({ accepted_at: new Date().toISOString() }).eq("id", invite.id);

    const jwtToken = await createToken({
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      company_id: effectiveCompanyId,
      company_role: effectiveCompanyRole,
      user_type: user.user_type,
    });

    const redirect = isExternal ? "/subcontractor" : "/dashboard";
    const res = NextResponse.json({ redirect });
    res.cookies.set("token", jwtToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });
    return res;
  }

  // ── New account: check uniqueness then create ────────────────────────────────
  const { data: existingUser } = await supabase
    .from("users")
    .select("id")
    .or(`email.eq.${invite.email},username.eq.${username}`)
    .maybeSingle();

  if (existingUser) {
    return NextResponse.json({ error: "Email or username already taken" }, { status: 409 });
  }

  const password_hash = await bcrypt.hash(password, 10);

  if (isExternal) {
    // ---------------------------------------------------------------
    // External collaborator (subcontractor) flow
    //   - No company affiliation: company_id = null, company_role = null
    //   - user_type = 'external'
    //   - A project_memberships row scopes them to one project only
    // ---------------------------------------------------------------
    const { data: newUser, error } = await supabase
      .from("users")
      .insert({
        username,
        first_name: firstName,
        last_name: lastName,
        email: invite.email,
        password_hash,
        role: "user",
        company_id: null,
        company_role: null,
        user_type: "external",
      })
      .select("id")
      .single();

    if (error || !newUser) {
      return NextResponse.json({ error: "Failed to create account" }, { status: 500 });
    }

    // Grant scoped read access to exactly the invited project. Any
    // allowed_sections list on the invitation restricts which tools the
    // collaborator may see (NULL = all sections).
    if (invite.project_id) {
      const projectRole = invite.project_role ?? "external_viewer";
      await supabase.from("project_memberships").insert({
        project_id: invite.project_id,
        user_id: newUser.id,
        company_id: invite.company_id,
        role: projectRole,
        permission: projectRole === "external_viewer" ? "read_only" : "write",
        allowed_sections: invite.allowed_sections ?? null,
      });
      await addUserToDirectory(supabase, invite.project_id, newUser.id);
      await applyDirectoryTemplateForInvite(
        supabase,
        invite.project_id,
        invite.company_id,
        invite.email,
        newUser.id
      );
    }

    await supabase
      .from("invitations")
      .update({ accepted_at: new Date().toISOString() })
      .eq("id", invite.id);

    const jwtToken = await createToken({
      id: newUser.id,
      email: invite.email,
      username,
      role: "user",
      company_id: null,
      company_role: null,
      user_type: "external",
    });

    // External users land on the dedicated subcontractor portal
    const res = NextResponse.json({ redirect: "/subcontractor" });
    res.cookies.set("token", jwtToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });
    return res;
  }

  // ---------------------------------------------------------------
  // Internal (company member) flow
  //   Uses invited_role from the invitation so super_admins can
  //   invite new admins as well as regular members.
  // ---------------------------------------------------------------
  const assignedRole: string = invite.invited_role ?? "member";

  const { data: newUser, error } = await supabase
    .from("users")
    .insert({
      username,
      first_name: firstName,
      last_name: lastName,
      email: invite.email,
      password_hash,
      company: company.name,
      role: "user",
      company_id: invite.company_id,
      company_role: assignedRole,
      user_type: "internal",
    })
    .select("id")
    .single();

  if (error || !newUser) {
    return NextResponse.json({ error: "Failed to create account" }, { status: 500 });
  }

  // Mark invitation as accepted
  await supabase
    .from("invitations")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", invite.id);

  // Add to org_members so the new user appears in the normalised table
  await supabase.from("org_members").insert({
    user_id: newUser.id,
    org_id: invite.company_id,
    role: ["super_admin", "admin"].includes(assignedRole) ? assignedRole : "member",
  });

  // If the invitation was scoped to a specific project, add the user to it.
  // Admins bypass project-level checks, so only members need an explicit row.
  if (invite.project_id && assignedRole === "member") {
    await supabase.from("project_memberships").upsert(
      {
        project_id: invite.project_id,
        user_id: newUser.id,
        company_id: invite.company_id,
        role: "member",
        permission: "write",
        invited_by: null,
      },
      { onConflict: "project_id,user_id" }
    );
    await addUserToDirectory(supabase, invite.project_id, newUser.id);
    // Internal members get the company.member template applied so the
    // Super Admin's Permission Templates configuration drives their access.
    await applyPermissionTemplate(supabase, {
      companyId: invite.company_id,
      projectId: invite.project_id,
      userId: newUser.id,
      category: "company",
      userType: "member",
    });
  }

  const jwtToken = await createToken({
    id: newUser.id,
    email: invite.email,
    username,
    role: "user",
    company_id: invite.company_id,
    company_role: assignedRole,
    user_type: "internal",
  });

  const res = NextResponse.json({ redirect: "/dashboard" });
  res.cookies.set("token", jwtToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });

  return res;
}
