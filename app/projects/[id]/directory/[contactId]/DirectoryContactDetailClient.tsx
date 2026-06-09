"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ProjectNav from "@/components/ProjectNav";
import { Brand } from "@/components/design-system/Primitives";
import { PERMISSION_TEMPLATES, type PermissionLevel } from "@/lib/permission-templates";
import ReportFieldsSection, { type ReportFieldValues } from "@/components/ReportFieldsSection";
import { COMPANY_REPORT_FIELDS } from "@/lib/report-fields";

type Contact = {
  id: string;
  type: "user" | "company" | "distribution_group";
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  permission: string | null;
  group_name: string | null;
  notes: string | null;
  job_title: string | null;
  address: string | null;
  [key: string]: unknown;
};

type UserFormData = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  company: string;
  job_title: string;
  address: string;
  permission: string;
};

const BIDDER_FLAGS = [["authorized_bidder", "Authorized Bidder"], ["union_member", "Union Member"], ["small_business", "Small Business (SBE)"], ["prevailing_wage", "Prevailing Wage"], ["african_american_business", "African American Business (AABE)"], ["asian_american_business", "Asian American Business (ABE)"], ["hispanic_business", "Hispanic Business (HBE)"], ["native_american_business", "Native American Business (NABE)"], ["women_business", "Women's Business (WBE)"], ["disadvantaged_business", "Disadvantaged Business (DBE)"], ["hub_zone", "HUB Zone"], ["minority_business_enterprise", "Minority Business Enterprise (MBE)"], ["sdvosb", "SDVOSB"], ["business_8a", "8a Business Enterprise"], ["affirmative_action", "Affirmative Action"], ["certified_business_enterprise", "Certified Business Enterprise (CBE)"], ["prequalified", "Prequalified"]] as const;

function levelLabel(level: PermissionLevel): string {
  if (level === "read_only") return "Read Only";
  if (level === "standard") return "Standard";
  if (level === "admin") return "Admin";
  return "None";
}

export default function DirectoryContactDetailClient({ projectId, username, initialContact }: { projectId: string; username: string; initialContact: Contact }) {
  const router = useRouter();
  const isCompany = initialContact.type === "company";
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [userForm, setUserForm] = useState<UserFormData>({
    first_name: initialContact.first_name ?? "",
    last_name: initialContact.last_name ?? "",
    email: initialContact.email ?? "",
    phone: initialContact.phone ?? "",
    company: initialContact.company ?? "",
    job_title: initialContact.job_title ?? "",
    address: initialContact.address ?? "",
    permission: initialContact.permission ?? "",
  });

  const [companyTab, setCompanyTab] = useState<"general" | "users" | "bidder">("general");
  const [companyForm, setCompanyForm] = useState<Record<string, unknown>>({ ...initialContact });
  const [companyUsers, setCompanyUsers] = useState<{ onProject: Array<{ id: string; first_name: string | null; last_name: string | null; email: string | null }>; portfolio: Array<{ id: string; first_name: string | null; last_name: string | null; email: string | null }> }>({ onProject: [], portfolio: [] });

  const permissionRows = useMemo(() => {
    if (!userForm.permission || !(userForm.permission in PERMISSION_TEMPLATES)) return [];
    return PERMISSION_TEMPLATES[userForm.permission as keyof typeof PERMISSION_TEMPLATES];
  }, [userForm.permission]);

  useEffect(() => {
    if (!isCompany) return;
    fetch(`/api/projects/${projectId}/directory/${initialContact.id}/company-users`)
      .then((r) => r.json())
      .then((data) => setCompanyUsers({ onProject: data?.onProject ?? [], portfolio: data?.portfolio ?? [] }))
      .catch(() => {});
  }, [isCompany, projectId, initialContact.id]);

  function setUserField(field: keyof UserFormData, value: string) {
    setSaved(false);
    setUserForm((prev) => ({ ...prev, [field]: value }));
  }

  function setCompanyField(field: string, value: string | boolean) {
    setSaved(false);
    setCompanyForm((prev) => ({ ...prev, [field]: value }));
  }

  async function save(payload: unknown) {
    setSaving(true);
    const res = await fetch(`/api/projects/${projectId}/directory/${initialContact.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (res.ok) {
      router.push(`/projects/${projectId}/directory`);
    }
  }

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
    <header className="bg-[#F9FAFB] border-b border-black/[0.06] px-6 h-14 flex items-center justify-between"><a href="/dashboard" className="hover:opacity-80 transition-opacity"><Brand /></a><div className="flex items-center gap-5"><span className="text-sm text-gray-400">{username}</span><button onClick={() => router.push(`/projects/${projectId}/directory`)} className="text-sm text-gray-400 hover:text-gray-900">Back to Directory</button></div></header>
    <ProjectNav projectId={projectId} />
    <main className="max-w-screen-xl mx-auto px-6 py-6 space-y-5">
        <div className="rounded-xl border border-[var(--border-base)] bg-white p-4">
          <h1 className="font-display text-[28px] leading-tight text-[color:var(--ink)] mt-2">{isCompany ? (String(companyForm.company || "Company Details")) : "Contact Details"}</h1>
        </div>

        {!isCompany ? (
          <>
            <form onSubmit={(e) => { e.preventDefault(); save(userForm); }} className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs text-gray-500 mb-1">First Name</label><input value={userForm.first_name} onChange={(e) => setUserField("first_name", e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" /></div>
                <div><label className="block text-xs text-gray-500 mb-1">Last Name</label><input value={userForm.last_name} onChange={(e) => setUserField("last_name", e.target.value)} required className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs text-gray-500 mb-1">Email</label><input value={userForm.email} type="email" onChange={(e) => setUserField("email", e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" /></div>
                <div><label className="block text-xs text-gray-500 mb-1">Phone</label><input value={userForm.phone} onChange={(e) => setUserField("phone", e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs text-gray-500 mb-1">Company</label><input value={userForm.company} onChange={(e) => setUserField("company", e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" /></div>
                <div><label className="block text-xs text-gray-500 mb-1">Job Title</label><input value={userForm.job_title} onChange={(e) => setUserField("job_title", e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs text-gray-500 mb-1">Address</label><input value={userForm.address} onChange={(e) => setUserField("address", e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" /></div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Permission Template</label>
                  <select value={userForm.permission} onChange={(e) => setUserField("permission", e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm bg-white">
                    <option value="">— None —</option>
                    {Object.keys(PERMISSION_TEMPLATES).map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex items-center justify-end gap-3">
                {saved && <span className="text-xs text-green-600">Saved</span>}
                <button disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-md hover:bg-gray-700 disabled:opacity-60">{saving ? "Saving..." : "Save"}</button>
              </div>
            </form>

            <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200 text-sm font-semibold text-gray-900">Permissions</div>
              {permissionRows.length === 0 ? (
                <p className="px-4 py-4 text-sm text-gray-400">Select a permission template to view tool permissions.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Name</th>
                      <th className="px-3 py-2 text-center text-xs font-semibold text-gray-600">None</th>
                      <th className="px-3 py-2 text-center text-xs font-semibold text-gray-600">Read Only</th>
                      <th className="px-3 py-2 text-center text-xs font-semibold text-gray-600">Standard</th>
                      <th className="px-3 py-2 text-center text-xs font-semibold text-gray-600">Admin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {permissionRows.map((row) => (
                      <Fragment key={row.tool}>
                        <tr className="border-b border-gray-100">
                          <td className="px-3 py-2 text-sm text-gray-800">{row.tool}</td>
                          {(["none", "read_only", "standard", "admin"] as PermissionLevel[]).map((level) => (
                            <td key={level} className="px-3 py-2 text-center"><input type="radio" readOnly checked={row.level === level} aria-label={`${row.tool} ${levelLabel(level)}`} /></td>
                          ))}
                        </tr>
                        {row.granularPermissions?.length ? (
                          <tr className="border-b border-gray-100 bg-gray-50"><td colSpan={5} className="px-3 py-2 text-xs text-gray-600">Granular Permissions: {row.granularPermissions.join(" · ")}</td></tr>
                        ) : null}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          </>
        ) : (
          <div className="bg-white border rounded-xl p-4">
            <div className="flex gap-2 border-b pb-3 mb-4">
              {[ ["general", "General"], ["users", "Users"], ["bidder", "Bidder Info"] ].map(([k, l]) => (
                <button key={k} onClick={() => setCompanyTab(k as "general" | "users" | "bidder")} className={`px-3 py-1.5 text-sm rounded-md ${companyTab === k ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-700"}`}>{l}</button>
              ))}
            </div>

            {companyTab === "general" && <div className="grid grid-cols-2 gap-3">{[["company", "Name"], ["abbreviated_name", "Abbreviated Name"], ["dba", "DBA"], ["business_phone", "Business Phone"], ["business_fax", "Business Fax"], ["email", "Email"], ["website", "Website"], ["phone", "Phone"], ["address", "Address"], ["city", "City"], ["country", "Country"], ["state", "State"], ["zip", "Zip"], ["project_roles", "Project Roles"], ["tags_keywords", "Tags/Keywords"], ["license_number", "License Number"], ["labor_union", "Labor Union"], ["entity_type", "Entity Type"], ["primary_contact", "Primary Contact"]].map(([k, l]) => <div key={k}><label className="block text-xs text-gray-500 mb-1">{l}</label><input className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" value={String(companyForm[k] ?? "")} onChange={(e) => setCompanyField(k, e.target.value)} /></div>)}<div className="col-span-2"><ReportFieldsSection title="Report Fields" description="Extra company attributes surfaced as columns in 360 Reports." fields={COMPANY_REPORT_FIELDS} values={(companyForm.report_fields as ReportFieldValues) ?? {}} onChange={(key, value) => setCompanyForm((prev) => ({ ...prev, report_fields: { ...((prev.report_fields as ReportFieldValues) ?? {}), [key]: value } }))} columns={2} /></div></div>}
            {companyTab === "users" && <div className="space-y-6 text-sm"><section><h3 className="font-semibold mb-2">Users on this project</h3><table className="w-full"><tbody>{companyUsers.onProject.map((u) => <tr key={u.id} className="border-t"><td className="py-2">{u.first_name} {u.last_name}</td><td>{u.email}</td></tr>)}</tbody></table></section><section><h3 className="font-semibold mb-2">Users in company portfolio (other projects)</h3><table className="w-full"><tbody>{companyUsers.portfolio.map((u) => <tr key={u.id} className="border-t"><td className="py-2">{u.first_name} {u.last_name}</td><td>{u.email}</td></tr>)}</tbody></table></section></div>}
            {companyTab === "bidder" && <div className="space-y-4"><div className="grid grid-cols-2 gap-3">{BIDDER_FLAGS.map(([k, l]) => <label key={k} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(companyForm[k])} onChange={(e) => setCompanyField(k, e.target.checked)} />{l}</label>)}</div><div className="grid grid-cols-2 gap-3"><div><label className="block text-xs text-gray-500 mb-1">Trades</label><input className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" value={String(companyForm.trades ?? "")} onChange={(e) => setCompanyField("trades", e.target.value)} /></div><div><label className="block text-xs text-gray-500 mb-1">Cost Codes</label><input className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" value={String(companyForm.cost_codes ?? "")} onChange={(e) => setCompanyField("cost_codes", e.target.value)} /></div></div><div><label className="block text-xs text-gray-500 mb-1">Comment</label><textarea className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" value={String(companyForm.bidder_comment ?? "")} onChange={(e) => setCompanyField("bidder_comment", e.target.value)} /></div></div>}
            <div className="flex justify-end mt-4 gap-3">{saved && <span className="text-xs text-green-600">Saved</span>}<button onClick={() => save(companyForm)} disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-md">{saving ? "Saving..." : "Save"}</button></div>
          </div>
        )}
      </main>
    </div>
  );
}
