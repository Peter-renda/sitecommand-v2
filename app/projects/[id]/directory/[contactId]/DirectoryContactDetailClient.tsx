"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ProjectNav from "@/components/ProjectNav";
import { Brand, Eyebrow } from "@/components/design-system/Primitives";

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

const BIDDER_FLAGS = [["authorized_bidder", "Authorized Bidder"], ["union_member", "Union Member"], ["small_business", "Small Business (SBE)"], ["prevailing_wage", "Prevailing Wage"], ["african_american_business", "African American Business (AABE)"], ["asian_american_business", "Asian American Business (ABE)"], ["hispanic_business", "Hispanic Business (HBE)"], ["native_american_business", "Native American Business (NABE)"], ["women_business", "Women's Business (WBE)"], ["disadvantaged_business", "Disadvantaged Business (DBE)"], ["hub_zone", "HUB Zone"], ["minority_business_enterprise", "Minority Business Enterprise (MBE)"], ["sdvosb", "SDVOSB"], ["business_8a", "8a Business Enterprise"], ["affirmative_action", "Affirmative Action"], ["certified_business_enterprise", "Certified Business Enterprise (CBE)"], ["prequalified", "Prequalified"]] as const;

function levelLabel(level: PermissionLevel): string { if (level === "read_only") return "Read Only"; if (level === "standard") return "Standard"; if (level === "admin") return "Admin"; return "None"; }

export default function DirectoryContactDetailClient({ projectId, username, initialContact }: { projectId: string; username: string; initialContact: Contact }) {
  const router = useRouter();
  const isCompany = initialContact.type === "company";
  const [tab, setTab] = useState<"general"|"users"|"bidder">("general");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({ ...initialContact });
  const [users, setUsers] = useState<{onProject:any[];portfolio:any[]}>({ onProject: [], portfolio: [] });

  const permissionRows = useMemo(() => {
    if (!form.permission || !(form.permission in PERMISSION_TEMPLATES)) return [];
    return PERMISSION_TEMPLATES[form.permission as keyof typeof PERMISSION_TEMPLATES];
  }, [form.permission]);

  useEffect(() => {
    if (!isCompany) return;
    fetch(`/api/projects/${projectId}/directory/${initialContact.id}/company-users`).then((r) => r.json()).then(setUsers).catch(() => {});
  }, [isCompany, projectId, initialContact.id]);

  function set(field: string, value: any) { setSaved(false); setForm((p) => ({ ...p, [field]: value })); }
  async function save() { setSaving(true); const res = await fetch(`/api/projects/${projectId}/directory/${initialContact.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) }); setSaving(false); if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 2000); } }

  return <div className="min-h-screen bg-gray-50">
    <header className="bg-white border-b border-gray-100 px-6 h-14 flex items-center justify-between"><a href="/dashboard" className="hover:opacity-80 transition-opacity"><Brand /></a><div className="flex items-center gap-5"><span className="text-sm text-gray-400">{username}</span><button onClick={() => router.push(`/projects/${projectId}/directory`)} className="text-sm text-gray-400 hover:text-gray-900">Back to Directory</button></div></header>
    <ProjectNav projectId={projectId} />
    <main className="max-w-screen-xl mx-auto px-6 py-6 space-y-5">
      <div className="rounded-xl border border-[var(--border-base)] bg-white p-4"><Eyebrow quiet>Project Workspace</Eyebrow><h1 className="font-display text-[28px] leading-tight text-[color:var(--ink)] mt-2">{isCompany ? (form.company || "Company Details") : "Contact Details"}</h1></div>

      {!isCompany ? (<>
        <form onSubmit={(e) => { e.preventDefault(); save(); }} className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3"><div><label className="block text-xs text-gray-500 mb-1">First Name</label><input value={form.first_name ?? ""} onChange={(e) => set("first_name", e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" /></div><div><label className="block text-xs text-gray-500 mb-1">Last Name</label><input value={form.last_name ?? ""} onChange={(e) => set("last_name", e.target.value)} required className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" /></div></div>
          <div className="grid grid-cols-2 gap-3"><div><label className="block text-xs text-gray-500 mb-1">Email</label><input value={form.email ?? ""} type="email" onChange={(e) => set("email", e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" /></div><div><label className="block text-xs text-gray-500 mb-1">Phone</label><input value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" /></div></div>
          <div className="grid grid-cols-2 gap-3"><div><label className="block text-xs text-gray-500 mb-1">Company</label><input value={form.company ?? ""} onChange={(e) => set("company", e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" /></div><div><label className="block text-xs text-gray-500 mb-1">Job Title</label><input value={form.job_title ?? ""} onChange={(e) => set("job_title", e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" /></div></div>
          <div className="grid grid-cols-2 gap-3"><div><label className="block text-xs text-gray-500 mb-1">Address</label><input value={form.address ?? ""} onChange={(e) => set("address", e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" /></div><div><label className="block text-xs text-gray-500 mb-1">Permission Template</label><select value={form.permission ?? ""} onChange={(e) => set("permission", e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm bg-white"><option value="">— None —</option>{Object.keys(PERMISSION_TEMPLATES).map((p) => <option key={p} value={p}>{p}</option>)}</select></div></div>
          <div className="flex items-center justify-end gap-3">{saved && <span className="text-xs text-green-600">Saved</span>}<button disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-md hover:bg-gray-700 disabled:opacity-60">{saving ? "Saving..." : "Save"}</button></div>
        </form>
        <section className="bg-white border border-gray-200 rounded-xl overflow-hidden"><div className="px-4 py-3 border-b border-gray-200 text-sm font-semibold text-gray-900">Permissions</div>{permissionRows.length === 0 ? <p className="px-4 py-4 text-sm text-gray-400">Select a permission template to view tool permissions.</p> : <table className="w-full text-sm"><thead className="bg-gray-50 border-b border-gray-200"><tr><th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Name</th><th className="px-3 py-2 text-center text-xs font-semibold text-gray-600">None</th><th className="px-3 py-2 text-center text-xs font-semibold text-gray-600">Read Only</th><th className="px-3 py-2 text-center text-xs font-semibold text-gray-600">Standard</th><th className="px-3 py-2 text-center text-xs font-semibold text-gray-600">Admin</th></tr></thead><tbody>{permissionRows.map((row) => <Fragment key={row.tool}><tr className="border-b border-gray-100"><td className="px-3 py-2 text-sm text-gray-800">{row.tool}</td>{(["none", "read_only", "standard", "admin"] as PermissionLevel[]).map((level) => <td key={level} className="px-3 py-2 text-center"><input type="radio" readOnly checked={row.level === level} aria-label={`${row.tool} ${levelLabel(level)}`} /></td>)}</tr>{row.granularPermissions?.length ? <tr className="border-b border-gray-100 bg-gray-50"><td colSpan={5} className="px-3 py-2 text-xs text-gray-600">Granular Permissions: {row.granularPermissions.join(" · ")}</td></tr> : null}</Fragment>)}</tbody></table>}</section>
      </>) : (
        <div className="bg-white border rounded-xl p-4"><div className="flex gap-2 border-b pb-3 mb-4">{[["general", "General"], ["users", "Users"], ["bidder", "Bidder Info"]].map(([k, l]) => <button key={k} onClick={() => setTab(k as any)} className={`px-3 py-1.5 text-sm rounded-md ${tab === k ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-700"}`}>{l}</button>)}</div>{tab === "general" && <div className="grid grid-cols-2 gap-3">{[["company", "Name"], ["abbreviated_name", "Abbreviated Name"], ["dba", "DBA"], ["business_phone", "Business Phone"], ["business_fax", "Business Fax"], ["email", "Email"], ["website", "Website"], ["phone", "Phone"], ["address", "Address"], ["city", "City"], ["country", "Country"], ["state", "State"], ["zip", "Zip"], ["project_roles", "Project Roles"], ["tags_keywords", "Tags/Keywords"], ["license_number", "License Number"], ["labor_union", "Labor Union"], ["entity_type", "Entity Type"], ["primary_contact", "Primary Contact"]].map(([k, l]) => <div key={k}><label className="block text-xs text-gray-500 mb-1">{l}</label><input className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" value={String(form[k] ?? "")} onChange={(e) => set(k, e.target.value)} /></div>)}</div>}{tab === "users" && <div className="space-y-6 text-sm"><section><h3 className="font-semibold mb-2">Users on this project</h3><table className="w-full"><tbody>{users.onProject.map((u) => <tr key={u.id} className="border-t"><td className="py-2">{u.first_name} {u.last_name}</td><td>{u.email}</td></tr>)}</tbody></table></section><section><h3 className="font-semibold mb-2">Users in company portfolio (other projects)</h3><table className="w-full"><tbody>{users.portfolio.map((u) => <tr key={u.id} className="border-t"><td className="py-2">{u.first_name} {u.last_name}</td><td>{u.email}</td></tr>)}</tbody></table></section></div>}{tab === "bidder" && <div className="space-y-4"><div className="grid grid-cols-2 gap-3">{BIDDER_FLAGS.map(([k, l]) => <label key={k} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(form[k])} onChange={(e) => set(k, e.target.checked)} />{l}</label>)}</div><div className="grid grid-cols-2 gap-3"><div><label className="block text-xs text-gray-500 mb-1">Trades</label><input className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" value={String(form.trades ?? "")} onChange={(e) => set("trades", e.target.value)} /></div><div><label className="block text-xs text-gray-500 mb-1">Cost Codes</label><input className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" value={String(form.cost_codes ?? "")} onChange={(e) => set("cost_codes", e.target.value)} /></div></div><div><label className="block text-xs text-gray-500 mb-1">Comment</label><textarea className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" value={String(form.bidder_comment ?? "")} onChange={(e) => set("bidder_comment", e.target.value)} /></div></div>}<div className="flex justify-end mt-4 gap-3">{saved && <span className="text-xs text-green-600">Saved</span>}<button onClick={save} disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-md">{saving ? "Saving..." : "Save"}</button></div></div>
      )}
    </main>
  </div>;
}
