"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ApiKeysTab, WebhooksTab, DocumentationTab } from "@/app/settings/developer/DeveloperSettingsClient";
import IntegrationsClient from "@/app/settings/integrations/IntegrationsClient";
import PermissionTemplatesTab from "./PermissionTemplatesTab";

type Member = {
  id: string;
  username: string;
  email: string;
  company_role: string;
  created_at: string;
};

type Invite = {
  id: string;
  email: string;
  invited_role: string;
  created_at: string;
  expires_at: string;
};

type Company = {
  id: string;
  name: string;
  subscription_plan: string | null;
  subscription_status: string;
  seat_limit: number;
  billing_owner_id: string | null;
} | null;

type Project = {
  id: string;
  name: string;
  status: string | null;
  created_at: string;
  archived_at: string | null;
};

function templateBadgeClass(role: string) {
  if (role === "super_admin") return "bg-amber-50 text-amber-700";
  if (role === "admin") return "bg-gray-100 text-gray-700";
  return "bg-gray-50 text-gray-400";
}

function templateLabel(role: string) {
  if (role === "super_admin") return "Super Admin";
  if (role === "admin") return "Admin";
  return "User";
}

export default function CompanyClient({
  company,
  members: initialMembers,
  invites: initialInvites,
  projects,
  currentUserId,
  isSuperAdmin,
}: {
  company: Company;
  members: Member[];
  invites: Invite[];
  projects: Project[];
  currentUserId: string;
  isSuperAdmin: boolean;
}) {
  const [projectList, setProjectList] = useState<Project[]>(projects);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [archiveConfirm, setArchiveConfirm] = useState<Project | null>(null);
  const [archiving, setArchiving] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!openMenuId) return;
    function onDocClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [openMenuId]);

  async function handleArchive(project: Project) {
    setArchiving(true);
    const res = await fetch(`/api/projects/${project.id}/archive`, { method: "POST" });
    setArchiving(false);
    if (res.ok) {
      const updated = await res.json();
      setProjectList((prev) =>
        prev.map((p) => (p.id === project.id ? { ...p, archived_at: updated.archived_at } : p))
      );
      setArchiveConfirm(null);
    }
  }

  const activeProjects = projectList.filter((p) => !p.archived_at);
  const archivedProjects = projectList.filter((p) => p.archived_at);

  const router = useRouter();
  const [activeTab, setActiveTab] = useState<
    "team" | "projects" | "permission-templates" | "integrations" | "developer"
  >("team");
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [invites, setInvites] = useState<Invite[]>(initialInvites);

  // Add user modal
  const [showAddUser, setShowAddUser] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"member" | "admin">("member");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState("");

  // Revoke invite confirmation
  const [revokeConfirmId, setRevokeConfirmId] = useState<string | null>(null);

  // Remove member confirmation
  const [removeConfirmMember, setRemoveConfirmMember] = useState<Member | null>(null);

  // Role change confirmation
  type RoleChange = { member: Member; newRole: "admin" | "member" };
  const [roleChangeConfirm, setRoleChangeConfirm] = useState<RoleChange | null>(null);
  const [changingRole, setChangingRole] = useState(false);


  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviting(true);
    setInviteError("");

    const res = await fetch("/api/company/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: inviteEmail, invited_role: inviteRole }),
    });

    const data = await res.json();
    setInviting(false);

    if (!res.ok) {
      setInviteError(data.error || "Failed to send invitation");
      return;
    }

    setInviteEmail("");
    setInviteRole("member");
    setShowAddUser(false);

    const res2 = await fetch("/api/company/invites");
    if (res2.ok) setInvites(await res2.json());
  }

  async function handleRevokeInvite(id: string) {
    const res = await fetch(`/api/company/invites/${id}`, { method: "DELETE" });
    if (res.ok) setInvites((prev) => prev.filter((i) => i.id !== id));
  }

  async function handleRemoveMember(userId: string) {
    const res = await fetch(`/api/company/members/${userId}`, { method: "DELETE" });
    if (res.ok) {
      setMembers((prev) => prev.filter((m) => m.id !== userId));
    }
    setRemoveConfirmMember(null);
  }

  async function handleRoleChange(member: Member, newRole: "admin" | "member") {
    setChangingRole(true);
    const res = await fetch(`/api/company/members/${member.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    if (res.ok) {
      setMembers((prev) =>
        prev.map((m) => (m.id === member.id ? { ...m, company_role: newRole } : m))
      );
    }
    setChangingRole(false);
    setRoleChangeConfirm(null);
  }

const seatCount = members.length;
  const seatLimit = company?.seat_limit ?? 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-4 sm:px-6 h-14 flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-900">SiteCommand</span>
        <a href="/dashboard" className="text-sm text-gray-400 hover:text-gray-900 transition-colors">
          ← Dashboard
        </a>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <div className="mb-8">
          <h1 className="font-display text-[28px] leading-tight text-[color:var(--ink)]">{company?.name ?? "Company"}</h1>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <span className="text-sm text-gray-500 capitalize">
              {company?.subscription_plan ?? "No plan"} plan
            </span>
            <span className="text-gray-300">·</span>
            <span className="text-sm text-gray-500">
              {seatCount} / {seatLimit > 0 ? seatLimit : "∞"} seats used
            </span>
            {/* Billing link — only visible to the Super Admin */}
            {isSuperAdmin && (
              <>
                <span className="text-gray-300">·</span>
                <a
                  href="/pricing"
                  className="text-sm text-amber-600 hover:text-amber-800 font-medium transition-colors"
                >
                  {company?.subscription_plan ? "Manage billing" : "Upgrade plan"}
                </a>
              </>
            )}
          </div>
          {isSuperAdmin && (
            <p className="text-xs text-gray-400 mt-2">
              You are the Super Admin and control billing for this organisation.
            </p>
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-6">
          {(["team", "projects", "permission-templates", "integrations", "developer"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors mr-1 ${
                activeTab === tab
                  ? "border-orange-500 text-gray-900"
                  : "border-transparent text-gray-400 hover:text-gray-700"
              }`}
            >
              {tab === "team"
                ? "Company"
                : tab === "projects"
                  ? "Projects"
                  : tab === "permission-templates"
                    ? "Permission Templates"
                    : tab === "integrations"
                      ? "Integrations"
                      : "Developer"}
            </button>
          ))}
        </div>

        {activeTab === "permission-templates" && (
          <PermissionTemplatesTab canEdit={isSuperAdmin} />
        )}

        {activeTab === "integrations" && (
          <div className="space-y-6">
            <IntegrationsClient isSiteAdmin={false} />
          </div>
        )}

        {activeTab === "developer" && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <ApiKeysTab />
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <WebhooksTab />
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <DocumentationTab />
            </div>
          </div>
        )}

        {activeTab === "team" && <>

        {/* User Management */}
        <div className="bg-white rounded-xl border border-gray-100 px-6 py-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900">User Management</h2>
            <button
              onClick={() => {
                setShowAddUser(true);
                setInviteError("");
                setInviteEmail("");
                setInviteRole("member");
              }}
              className="px-3 py-1.5 bg-gray-900 text-white text-xs font-medium rounded-md hover:bg-gray-700 transition-colors"
            >
              + Add User
            </button>
          </div>

          {members.length === 0 ? (
            <p className="text-sm text-gray-400">No users yet.</p>
          ) : (
            <div className="space-y-1">
              {members.map((member) => {
                const isSuperAdminMember = member.company_role === "super_admin";
                const isCurrentUser = member.id === currentUserId;
                const canRemove =
                  !isCurrentUser &&
                  !isSuperAdminMember &&
                  (isSuperAdmin || member.company_role === "member");
                const canToggleRole = isSuperAdmin && !isSuperAdminMember && !isCurrentUser;
                const newRole = member.company_role === "admin" ? "member" : "admin";

                return (
                  <div
                    key={member.id}
                    className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => router.push(`/company/members/${member.id}`)}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-900">{member.username}</p>
                        <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${templateBadgeClass(member.company_role)}`}>
                          {templateLabel(member.company_role)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400">{member.email}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      {canToggleRole && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setRoleChangeConfirm({ member, newRole });
                          }}
                          className="text-xs text-gray-400 hover:text-gray-700 transition-colors"
                        >
                          Assign {templateLabel(newRole)} template
                        </button>
                      )}
                      {canRemove && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setRemoveConfirmMember(member);
                          }}
                          className="text-xs text-red-500 hover:text-red-700 transition-colors"
                        >
                          Remove
                        </button>
                      )}
                      <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pending invitations */}
          {invites.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-50">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
                Pending invitations
              </p>
              <div className="space-y-1">
                {invites.map((invite) => (
                  <div key={invite.id} className="flex items-center justify-between py-2 px-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-gray-500">{invite.email}</p>
                        <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${templateBadgeClass(invite.invited_role)}`}>
                          {templateLabel(invite.invited_role)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-300">
                        Expires{" "}
                        {new Date(invite.expires_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                    {revokeConfirmId === invite.id ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">Revoke invite?</span>
                        <button
                          onClick={() => { handleRevokeInvite(invite.id); setRevokeConfirmId(null); }}
                          className="text-xs text-red-500 font-medium hover:text-red-700 transition-colors"
                        >
                          Yes, revoke
                        </button>
                        <button
                          onClick={() => setRevokeConfirmId(null)}
                          className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setRevokeConfirmId(invite.id)}
                        className="text-xs text-red-400 hover:text-red-600 transition-colors"
                      >
                        Revoke
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* About Site Command */}
        <div className="bg-white rounded-xl border border-gray-100 px-6 py-5 mt-6 last:mb-0">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">About Site Command</h2>
          <p className="text-sm font-medium text-gray-700 mb-3">
            Construction is hard enough. Your software shouldn&apos;t be.
          </p>
          <div className="space-y-3 text-sm text-gray-500 leading-relaxed">
            <p>
              Site Command was built by people who understand the frustration of bloated, overpriced
              platforms that promise the world and deliver a headache. We watched contractors spend
              more time fighting their software than managing their projects — and we decided to
              build something better.
            </p>
            <p>
              Site Command is a modern construction management platform designed for the way real
              teams work. From daily logs and RFIs to document control, submittals, and project
              scheduling, everything you need is in one place — intuitive, fast, and actually useful
              in the field.
            </p>
            <p>
              We&apos;re not trying to be everything to everyone. We&apos;re focused on giving
              contractors, project managers, and field teams a tool that respects their time, keeps
              projects moving, and doesn&apos;t require a three-week onboarding just to get started.
            </p>
            <p className="font-medium text-gray-700">
              Built for the builder. Priced fairly. Designed to last.
            </p>
            <p>
              Whether you&apos;re running a single crew or managing a multi-project portfolio, Site
              Command gives you the visibility and control you need — without the complexity you
              don&apos;t.
            </p>
          </div>
        </div>

        </>}

        {activeTab === "projects" && (
          <div className="bg-white rounded-xl border border-gray-100 px-6 py-5">
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-gray-900">Projects</h2>
              <p className="text-xs text-gray-400 mt-1">
                {activeProjects.length} total project{activeProjects.length === 1 ? "" : "s"}
              </p>
            </div>

            {activeProjects.length === 0 ? (
              <p className="text-sm text-gray-400 mb-4">No projects yet.</p>
            ) : (
              <div className="space-y-1 mb-5">
                {activeProjects.map((project) => (
                  <div
                    key={project.id}
                    className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <a href={`/projects/${project.id}`} className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{project.name}</p>
                      <p className="text-xs text-gray-400 capitalize truncate">
                        {project.status || "No status"}
                      </p>
                    </a>
                    <div className="flex items-center gap-1 shrink-0">
                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuId(openMenuId === project.id ? null : project.id);
                          }}
                          aria-label="Project actions"
                          className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <circle cx="5" cy="12" r="2" />
                            <circle cx="12" cy="12" r="2" />
                            <circle cx="19" cy="12" r="2" />
                          </svg>
                        </button>
                        {openMenuId === project.id && (
                          <div
                            ref={menuRef}
                            className="absolute right-0 top-full mt-1 w-44 bg-white border border-gray-200 rounded-md shadow-lg z-10 py-1"
                          >
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenMenuId(null);
                                setArchiveConfirm(project);
                              }}
                              className="w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                              Archive Project
                            </button>
                          </div>
                        )}
                      </div>
                      <a href={`/projects/${project.id}`} aria-label="Open project">
                        <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <a
              href="/dashboard"
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-900 text-white text-xs font-medium rounded-md hover:bg-gray-700 transition-colors"
            >
              + New Project
            </a>

            {archivedProjects.length > 0 && (
              <div className="mt-8 pt-6 border-t border-gray-100">
                <div className="mb-4">
                  <h2 className="text-sm font-semibold text-gray-900">Complete Projects</h2>
                  <p className="text-xs text-gray-400 mt-1">
                    {archivedProjects.length} archived project{archivedProjects.length === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="space-y-1">
                  {archivedProjects.map((project) => (
                    <a
                      key={project.id}
                      href={`/projects/${project.id}`}
                      className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-500 truncate">{project.name}</p>
                        <p className="text-xs text-gray-400 truncate">
                          Archived{project.archived_at ? ` ${new Date(project.archived_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : ""}
                        </p>
                      </div>
                      <svg className="w-4 h-4 text-gray-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

      </main>

      {/* Add User Modal */}
      {showAddUser && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-1">Add a user</h2>
            <p className="text-sm text-gray-500 mb-4">
              We&apos;ll send them an invite link to create their account.
            </p>
            <form onSubmit={handleInvite} className="space-y-3">
              <input
                type="email"
                required
                autoFocus
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="colleague@company.com"
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
              {/* Permission template — admins can only invite Users; super_admin can invite Admins too */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Permission Template</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as "member" | "admin")}
                  className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900"
                >
                  <option value="member">User — standard access, can invite subcontractors</option>
                  {isSuperAdmin && (
                    <option value="admin">Admin — manage users and invite subcontractors (no billing)</option>
                  )}
                </select>
              </div>
              {inviteError && <p className="text-xs text-red-600">{inviteError}</p>}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAddUser(false)}
                  className="flex-1 py-2 border border-gray-200 text-sm text-gray-600 rounded-md hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviting}
                  className="flex-1 py-2 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-700 transition-colors disabled:opacity-50"
                >
                  {inviting ? "Sending..." : "Send invite"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Remove User Confirmation Modal */}
      {removeConfirmMember && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-1">Remove user?</h2>
            <p className="text-sm text-gray-500 mb-5">
              <span className="font-medium text-gray-700">{removeConfirmMember.username}</span> will
              lose access to all projects and be removed from the company. This cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setRemoveConfirmMember(null)}
                className="flex-1 py-2 border border-gray-200 text-sm text-gray-600 rounded-md hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRemoveMember(removeConfirmMember.id)}
                className="flex-1 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 transition-colors"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Archive Project Confirmation Modal */}
      {archiveConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-1">Archive project?</h2>
            <p className="text-sm text-gray-500 mb-5">
              <span className="font-medium text-gray-700">{archiveConfirm.name}</span> will be moved
              to Complete Projects and removed from everyone who had access. All project data is
              retained.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setArchiveConfirm(null)}
                disabled={archiving}
                className="flex-1 py-2 border border-gray-200 text-sm text-gray-600 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleArchive(archiveConfirm)}
                disabled={archiving}
                className="flex-1 py-2 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                {archiving ? "Archiving..." : "Archive"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Permission Template Change Confirmation Modal */}
      {roleChangeConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-1">Change permission template?</h2>
            <p className="text-sm text-gray-500 mb-5">
              Change{" "}
              <span className="font-medium text-gray-700">{roleChangeConfirm.member.username}</span>{" "}
              from the{" "}
              <span className="font-medium text-gray-700">
                {templateLabel(roleChangeConfirm.member.company_role)}
              </span>{" "}
              template to the{" "}
              <span className="font-medium text-gray-700">
                {templateLabel(roleChangeConfirm.newRole)}
              </span>{" "}
              template?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setRoleChangeConfirm(null)}
                disabled={changingRole}
                className="flex-1 py-2 border border-gray-200 text-sm text-gray-600 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRoleChange(roleChangeConfirm.member, roleChangeConfirm.newRole)}
                disabled={changingRole}
                className="flex-1 py-2 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                {changingRole ? "Saving..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
