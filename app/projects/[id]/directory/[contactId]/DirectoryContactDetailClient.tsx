"use client";

import { useEffect, useState } from "react";
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

const BIDDER_FLAGS = [
  ["authorized_bidder", "Authorized Bidder"], ["union_member", "Union Member"], ["small_business", "Small Business (SBE)"], ["prevailing_wage", "Prevailing Wage"],
  ["african_american_business", "African American Business (AABE)"], ["asian_american_business", "Asian American Business (ABE)"], ["hispanic_business", "Hispanic Business (HBE)"],
  ["native_american_business", "Native American Business (NABE)"], ["women_business", "Women's Business (WBE)"], ["disadvantaged_business", "Disadvantaged Business (DBE)"],
  ["hub_zone", "HUB Zone"], ["minority_business_enterprise", "Minority Business Enterprise (MBE)"], ["sdvosb", "SDVOSB"], ["business_8a", "8a Business Enterprise"],
  ["affirmative_action", "Affirmative Action"], ["certified_business_enterprise", "Certified Business Enterprise (CBE)"], ["prequalified", "Prequalified"],
] as const;

export default function DirectoryContactDetailClient({ projectId, username, initialContact }: { projectId: string; username: string; initialContact: Contact }) {
  const router = useRouter();
  const [tab, setTab] = useState<"general"|"users"|"bidder">("general");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({ ...initialContact });
  const [users, setUsers] = useState<{onProject:any[];portfolio:any[]}>({onProject:[], portfolio:[]});

  useEffect(() => {
    fetch(`/api/projects/${projectId}/directory/${initialContact.id}/company-users`).then(r => r.json()).then(setUsers).catch(() => {});
  }, [projectId, initialContact.id]);

  function set(field: string, value: any) { setSaved(false); setForm((p) => ({ ...p, [field]: value })); }
  async function save() {
    setSaving(true);
    const res = await fetch(`/api/projects/${projectId}/directory/${initialContact.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    setSaving(false); if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 2000); }
  }

  const inputClass = "w-full px-3 py-2 border border-gray-200 rounded-md text-sm";
  return <div className="min-h-screen bg-gray-50">
    <header className="bg-white border-b border-gray-100 px-6 h-14 flex items-center justify-between"><a href="/dashboard"><Brand /></a><button onClick={() => router.push(`/projects/${projectId}/directory`)} className="text-sm text-gray-500">Back to Directory</button></header>
    <ProjectNav projectId={projectId} />
    <main className="max-w-screen-xl mx-auto px-6 py-6 space-y-4">
      <div className="rounded-xl border border-[var(--border-base)] bg-white p-4"><Eyebrow quiet>Directory</Eyebrow><h1 className="font-display text-[28px] mt-2">{form.company || `${form.first_name || ""} ${form.last_name || ""}`}</h1><p className="text-sm text-gray-500">{username}</p></div>
      <div className="bg-white border rounded-xl p-4">
        <div className="flex gap-2 border-b pb-3 mb-4">{[["general","General"],["users","Users"],["bidder","Bidder Info"]].map(([k,l]) => <button key={k} onClick={() => setTab(k as any)} className={`px-3 py-1.5 text-sm rounded-md ${tab===k?"bg-gray-900 text-white":"bg-gray-100 text-gray-700"}`}>{l}</button>)}</div>
        {tab==="general" && <div className="grid grid-cols-2 gap-3">{[["company","Name"],["abbreviated_name","Abbreviated Name"],["dba","DBA"],["business_phone","Business Phone"],["business_fax","Business Fax"],["email","Email"],["website","Website"],["phone","Phone"],["address","Address"],["city","City"],["country","Country"],["state","State"],["zip","Zip"],["project_roles","Project Roles"],["tags_keywords","Tags/Keywords"],["license_number","License Number"],["labor_union","Labor Union"],["entity_type","Entity Type"],["primary_contact","Primary Contact"]].map(([k,l]) => <div key={k}><label className="block text-xs text-gray-500 mb-1">{l}</label><input className={inputClass} value={String(form[k] ?? "")} onChange={(e)=>set(k,e.target.value)} /></div>)}</div>}
        {tab==="users" && <div className="space-y-6 text-sm"><section><h3 className="font-semibold mb-2">Users on this project</h3><table className="w-full"><tbody>{users.onProject.map(u=><tr key={u.id} className="border-t"><td className="py-2">{u.first_name} {u.last_name}</td><td>{u.email}</td></tr>)}</tbody></table></section><section><h3 className="font-semibold mb-2">Users in company portfolio (other projects)</h3><table className="w-full"><tbody>{users.portfolio.map(u=><tr key={u.id} className="border-t"><td className="py-2">{u.first_name} {u.last_name}</td><td>{u.email}</td></tr>)}</tbody></table></section></div>}
        {tab==="bidder" && <div className="space-y-4"><div className="grid grid-cols-2 gap-3">{BIDDER_FLAGS.map(([k,l]) => <label key={k} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(form[k])} onChange={(e)=>set(k,e.target.checked)} />{l}</label>)}</div><div className="grid grid-cols-2 gap-3"><div><label className="block text-xs text-gray-500 mb-1">Trades</label><input className={inputClass} value={String(form.trades ?? "")} onChange={(e)=>set("trades",e.target.value)} /></div><div><label className="block text-xs text-gray-500 mb-1">Cost Codes</label><input className={inputClass} value={String(form.cost_codes ?? "")} onChange={(e)=>set("cost_codes",e.target.value)} /></div></div><div><label className="block text-xs text-gray-500 mb-1">Comment</label><textarea className={inputClass} value={String(form.bidder_comment ?? "")} onChange={(e)=>set("bidder_comment",e.target.value)} /></div></div>}
        <div className="flex justify-end mt-4 gap-3">{saved && <span className="text-xs text-green-600">Saved</span>}<button onClick={save} disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-md">{saving?"Saving...":"Save"}</button></div>
      </div>
    </main>
  </div>;
}
