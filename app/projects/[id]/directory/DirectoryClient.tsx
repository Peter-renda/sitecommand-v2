"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import ProjectNav from "@/components/ProjectNav";
import { Brand } from "@/components/design-system/Primitives";
import { PERMISSION_TEMPLATE_ORDER } from "@/lib/permission-templates";

// ── Types ─────────────────────────────────────────────────────────────────────

type ContactType = "user" | "company" | "distribution_group";

type Contact = {
  id: string;
  type: ContactType;
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
  member_contact_ids: string[] | null;
  created_at: string;
};

const PERMISSIONS = PERMISSION_TEMPLATE_ORDER;

// ── Export helpers ────────────────────────────────────────────────────────────

function contactDisplayName(c: Contact): string {
  if (c.type === "company") return c.company ?? "Unnamed Company";
  if (c.type === "distribution_group") return c.group_name ?? "Unnamed Group";
  const parts = [c.first_name, c.last_name].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : "Unnamed";
}

function contactTypeLabel(t: ContactType): string {
  if (t === "user") return "Person";
  if (t === "company") return "Company";
  return "Distribution Group";
}

function exportDirectoryCSV(items: Contact[]) {
  const headers = ["Name", "Type", "Email", "Phone", "Company", "Job Title", "Permission", "Address"];
  const rows = items.map((c) => [
    contactDisplayName(c),
    contactTypeLabel(c.type),
    c.email ?? "",
    c.phone ?? "",
    c.company ?? "",
    c.job_title ?? "",
    c.permission ?? "",
    c.address ?? "",
  ]);
  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "directory.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function exportDirectoryPDF(items: Contact[]) {
  const rows = items
    .map((c) => `<tr>
      <td>${escapeHtml(contactDisplayName(c))}</td>
      <td>${escapeHtml(contactTypeLabel(c.type))}</td>
      <td>${escapeHtml(c.email ?? "")}</td>
      <td>${escapeHtml(c.phone ?? "")}</td>
      <td>${escapeHtml(c.company ?? "")}</td>
      <td>${escapeHtml(c.job_title ?? "")}</td>
      <td>${escapeHtml(c.permission ?? "")}</td>
    </tr>`)
    .join("");

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Directory</title>
    <style>
      body { font-family: Arial, sans-serif; font-size: 10px; padding: 20px; }
      h1 { font-size: 14px; margin-bottom: 12px; }
      table { width: 100%; border-collapse: collapse; }
      th { background: #f3f4f6; text-align: left; padding: 5px 6px; font-size: 9px;
           text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280;
           border-bottom: 1px solid #e5e7eb; }
      td { padding: 5px 6px; border-bottom: 1px solid #f3f4f6; vertical-align: top; }
      tr:last-child td { border-bottom: none; }
      @media print { body { padding: 0; } }
    </style></head><body>
    <h1>Directory</h1>
    <table>
      <thead>
        <tr>
          <th>Name</th><th>Type</th><th>Email</th><th>Phone</th>
          <th>Company</th><th>Job Title</th><th>Permission</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    </body></html>`;

  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;left:-9999px;top:-9999px;width:0;height:0;border:0;";
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) { document.body.removeChild(iframe); return; }
  doc.open();
  doc.write(html);
  doc.close();
  setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => document.body.removeChild(iframe), 500);
  }, 300);
}

// ── Avatar ────────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  "bg-slate-500",
  "bg-blue-500",
  "bg-violet-500",
  "bg-rose-500",
  "bg-amber-500",
  "bg-teal-500",
  "bg-emerald-500",
  "bg-cyan-500",
];

function getInitials(first: string | null, last: string | null): string {
  const f = (first ?? "").trim()[0] ?? "";
  const l = (last ?? "").trim()[0] ?? "";
  return (f + l).toUpperCase() || "?";
}

function avatarColor(initials: string): string {
  const code = (initials.charCodeAt(0) || 0) + (initials.charCodeAt(1) || 0);
  return AVATAR_COLORS[code % AVATAR_COLORS.length];
}

// Deterministic warm avatar tint (av-1 … av-5) from any string.
function warmTint(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return (Math.abs(hash) % 5) + 1;
}

function Avatar({ first, last }: { first: string | null; last: string | null }) {
  const initials = getInitials(first, last);
  const color = avatarColor(initials);
  return (
    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-white text-xs font-semibold shrink-0 ${color}`}>
      {initials}
    </span>
  );
}

// ── Modals ────────────────────────────────────────────────────────────────────

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

function UserModal({
  initial,
  companyNames,
  onConfirm,
  onCancel,
}: {
  initial?: Partial<UserFormData>;
  companyNames: string[];
  onConfirm: (data: UserFormData) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<UserFormData>({
    first_name: initial?.first_name ?? "",
    last_name: initial?.last_name ?? "",
    email: initial?.email ?? "",
    phone: initial?.phone ?? "",
    company: initial?.company ?? "",
    job_title: initial?.job_title ?? "",
    address: initial?.address ?? "",
    permission: initial?.permission ?? "",
  });

  function set(field: keyof UserFormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.last_name.trim()) return;
    onConfirm(form);
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-xl w-full max-w-lg shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">{initial ? "Edit Contact" : "Add Person"}</h2>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">First Name</label>
              <input type="text" value={form.first_name} onChange={(e) => set("first_name", e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" placeholder="First name" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Last Name <span className="text-red-500">*</span></label>
              <input type="text" value={form.last_name} onChange={(e) => set("last_name", e.target.value)} required
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" placeholder="Last name" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
            <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" placeholder="email@example.com" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Phone</label>
              <input type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" placeholder="(555) 555-5555" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Job Title</label>
              <input type="text" value={form.job_title} onChange={(e) => set("job_title", e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" placeholder="Project Manager" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Company</label>
              <input type="text" value={form.company} onChange={(e) => set("company", e.target.value)}
                list="company-list"
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" placeholder="Company name" />
              <datalist id="company-list">
                {companyNames.map((n) => <option key={n} value={n} />)}
              </datalist>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Permission Template</label>
              <select value={form.permission} onChange={(e) => set("permission", e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white">
                <option value="">— None —</option>
                {PERMISSIONS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Address</label>
            <input type="text" value={form.address} onChange={(e) => set("address", e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" placeholder="123 Main St, City, ST 00000" />
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-md hover:bg-gray-700 transition-colors">
              {initial ? "Save Changes" : "Save and Invite"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

type CompanyFormData = { company: string; email: string; phone: string; address: string; notes: string };

function CompanyGroupModal({
  initial,
  onConfirm,
  onCancel,
}: {
  initial?: Partial<CompanyFormData>;
  onConfirm: (data: CompanyFormData) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<CompanyFormData>({
    company: initial?.company ?? "",
    email: initial?.email ?? "",
    phone: initial?.phone ?? "",
    address: initial?.address ?? "",
    notes: initial?.notes ?? "",
  });

  function set(field: keyof CompanyFormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.company.trim()) return;
    onConfirm(form);
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">{initial ? "Edit Company" : "Add Company"}</h2>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Company Name <span className="text-red-500">*</span></label>
            <input type="text" value={form.company} onChange={(e) => set("company", e.target.value)} required
              className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
            <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Phone</label>
            <input type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Address</label>
            <input type="text" value={form.address} onChange={(e) => set("address", e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
            <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2}
              className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none" />
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors">Cancel</button>
            <button type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-md hover:bg-gray-700 transition-colors">{initial ? "Save Changes" : "Add Company"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

type DistributionGroupFormData = {
  group_name: string;
  notes: string;
  member_contact_ids: string[];
};

function DistributionGroupModal({
  initial,
  candidateMembers,
  onConfirm,
  onCancel,
}: {
  initial?: Partial<DistributionGroupFormData>;
  candidateMembers: Contact[];
  onConfirm: (data: DistributionGroupFormData) => void;
  onCancel: () => void;
}) {
  const isEdit = Boolean(initial);
  const [form, setForm] = useState<DistributionGroupFormData>({
    group_name: initial?.group_name ?? "",
    notes: initial?.notes ?? "",
    member_contact_ids: initial?.member_contact_ids ?? [],
  });
  const [memberSearch, setMemberSearch] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  function set<K extends keyof DistributionGroupFormData>(field: K, value: DistributionGroupFormData[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  const memberContacts = form.member_contact_ids
    .map((id) => candidateMembers.find((c) => c.id === id))
    .filter((c): c is Contact => Boolean(c));

  const suggestionPool = candidateMembers.filter((c) => !form.member_contact_ids.includes(c.id));
  const q = memberSearch.trim().toLowerCase();
  const suggestions = (q
    ? suggestionPool.filter((c) => {
        const parts = [c.first_name, c.last_name, c.company, c.email].filter(Boolean) as string[];
        return parts.some((p) => p.toLowerCase().includes(q));
      })
    : suggestionPool
  ).slice(0, 20);

  function addMember(id: string) {
    set("member_contact_ids", [...form.member_contact_ids, id]);
    setMemberSearch("");
    setShowSuggestions(false);
  }

  function removeMember(id: string) {
    set("member_contact_ids", form.member_contact_ids.filter((m) => m !== id));
  }

  function removeAll() {
    set("member_contact_ids", []);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.group_name.trim()) return;
    onConfirm(form);
  }

  const groupLabel = form.group_name.trim() || "Group";

  return (
    <div className="fixed inset-0 bg-black/40 flex items-start justify-center z-50 px-4 py-10 overflow-y-auto">
      <div className="bg-white rounded-xl w-full max-w-4xl shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <div className="text-xs text-gray-400 mb-0.5">
              Directory <span className="mx-1">›</span> <span className="text-gray-600">{groupLabel}</span>
            </div>
            <h2 className="text-base font-semibold text-gray-900">{isEdit ? "Edit Distribution Group" : "Add Distribution Group"}</h2>
          </div>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5">
          <div className="divide-y divide-gray-100 border-b border-gray-100">
            <div className="grid grid-cols-[200px_1fr] gap-4 py-3 items-center">
              <label className="text-sm font-medium text-gray-700">Name: <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={form.group_name}
                onChange={(e) => set("group_name", e.target.value)}
                required
                autoFocus
                className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
            <div className="grid grid-cols-[200px_1fr] gap-4 py-3 items-center">
              <label className="text-sm font-medium text-gray-700">Description:</label>
              <input
                type="text"
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
                className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
            <div className="grid grid-cols-[200px_1fr] gap-4 py-3 items-start">
              <label className="text-sm font-medium text-gray-700 pt-2">
                Add User To {groupLabel}:
              </label>
              <div className="relative max-w-md">
                <input
                  type="text"
                  value={memberSearch}
                  onChange={(e) => { setMemberSearch(e.target.value); setShowSuggestions(true); }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                  placeholder="search by first name, last name, or by company"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-64 overflow-y-auto z-10">
                    {suggestions.map((c) => {
                      const name = [c.first_name, c.last_name].filter(Boolean).join(" ") || c.email || "Unnamed";
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onMouseDown={(e) => { e.preventDefault(); addMember(c.id); }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors flex items-center justify-between gap-3"
                        >
                          <span className="flex items-center gap-2">
                            <Avatar first={c.first_name} last={c.last_name} />
                            <span className="text-gray-900">{name}</span>
                          </span>
                          {c.company && <span className="text-xs text-gray-500 truncate">{c.company}</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
                {showSuggestions && q && suggestions.length === 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg px-3 py-2 text-xs text-gray-400 z-10">
                    No matching users in this project directory.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="pt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-gray-700">Members</span>
              {memberContacts.length > 0 && (
                <button
                  type="button"
                  onClick={removeAll}
                  className="text-xs text-red-600 hover:text-red-700 transition-colors flex items-center gap-1"
                >
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                  </svg>
                  Remove All
                </button>
              )}
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-md">
              {memberContacts.length === 0 ? (
                <div className="px-4 py-6 text-center text-xs text-gray-400">No members yet — add users from the project directory above.</div>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {memberContacts.map((c) => {
                    const name = [c.first_name, c.last_name].filter(Boolean).join(" ") || c.email || "Unnamed";
                    return (
                      <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar first={c.first_name} last={c.last_name} />
                          <div className="min-w-0">
                            <div className="text-sm text-gray-900 truncate">{name}</div>
                            <div className="text-xs text-gray-500 truncate">
                              {[c.company, c.email].filter(Boolean).join(" • ") || ""}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeMember(c.id)}
                          className="text-gray-400 hover:text-red-600 transition-colors"
                          aria-label="Remove member"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-5">
            <button type="button" onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors">Cancel</button>
            <button type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-md hover:bg-gray-700 transition-colors">{isEdit ? "Update" : "Add Group"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

type CompanyDirectoryEntry = {
  id: string;
  type: ContactType;
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
  source_project_id: string | null;
  source_project_name: string | null;
};

function BulkAddFromCompanyModal({
  projectId,
  onConfirm,
  onCancel,
}: {
  projectId: string;
  onConfirm: (picked: CompanyDirectoryEntry[]) => void;
  onCancel: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<CompanyDirectoryEntry[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/company/directory?excludeProjectId=${projectId}`);
        if (res.ok && !cancelled) setEntries(await res.json());
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [projectId]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function entryLabel(e: CompanyDirectoryEntry): string {
    if (e.type === "company") return e.company ?? "Unnamed Company";
    if (e.type === "distribution_group") return e.group_name ?? "Unnamed Group";
    return [e.first_name, e.last_name].filter(Boolean).join(" ") || "Unnamed";
  }

  const q = search.toLowerCase().trim();
  const visible = entries.filter((e) => {
    if (!q) return true;
    return [entryLabel(e), e.email, e.company, e.job_title, e.source_project_name]
      .some((v) => v?.toLowerCase().includes(q));
  });

  const allVisibleSelected = visible.length > 0 && visible.every((e) => selected.has(e.id));

  function toggleAllVisible() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        for (const e of visible) next.delete(e.id);
      } else {
        for (const e of visible) next.add(e.id);
      }
      return next;
    });
  }

  function handleImport() {
    const picked = entries.filter((e) => selected.has(e.id));
    if (picked.length === 0) return;
    onConfirm(picked);
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-xl w-full max-w-2xl shadow-xl flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Bulk Add from Company Directory</h2>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="px-6 py-3 border-b border-gray-100 flex items-center gap-3">
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, company, or project"
            className="flex-1 px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
          <span className="text-xs text-gray-400 shrink-0">{selected.size} selected</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="px-6 py-6 text-sm text-gray-400">Loading…</p>
          ) : visible.length === 0 ? (
            <p className="px-6 py-6 text-sm text-gray-400">
              {entries.length === 0
                ? "No contacts found in other company projects, or all contacts are already in this project."
                : "No contacts match your search."}
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr className="border-b border-gray-200">
                  <th className="w-10 px-3 py-2 text-left">
                    <input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible}
                      className="rounded border-gray-300 cursor-pointer" />
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Name</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Email</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Company</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">From Project</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {visible.map((e) => (
                  <tr key={e.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => toggle(e.id)}>
                    <td className="px-3 py-2">
                      <input type="checkbox" checked={selected.has(e.id)} onChange={() => toggle(e.id)}
                        onClick={(ev) => ev.stopPropagation()}
                        className="rounded border-gray-300 cursor-pointer" />
                    </td>
                    <td className="px-3 py-2 text-gray-900">
                      {entryLabel(e)}
                      {e.type === "company" && <span className="ml-2 text-xs text-gray-400">Company</span>}
                      {e.type === "distribution_group" && <span className="ml-2 text-xs text-gray-400">Group</span>}
                    </td>
                    <td className="px-3 py-2 text-gray-500 text-xs">{e.email || <span className="text-gray-300">—</span>}</td>
                    <td className="px-3 py-2 text-gray-500 text-xs">{e.company || <span className="text-gray-300">—</span>}</td>
                    <td className="px-3 py-2 text-gray-400 text-xs">{e.source_project_name || <span className="text-gray-300">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="flex gap-3 justify-end px-6 py-4 border-t border-gray-100">
          <button onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors">Cancel</button>
          <button onClick={handleImport} disabled={selected.size === 0}
            className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-md hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            Add {selected.size > 0 ? selected.size : ""} to Project
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmModal({ name, onConfirm, onCancel }: { name: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-xl w-full max-w-sm shadow-xl p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-2">Remove Contact</h2>
        <p className="text-sm text-gray-500 mb-6">Are you sure you want to remove <strong>{name}</strong>?</p>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors">Cancel</button>
          <button onClick={onConfirm} className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors">Remove</button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function DirectoryClient({
  projectId,
  role,
  username,
}: {
  projectId: string;
  role: string;
  username: string;
}) {
  const router = useRouter();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Modal state
  const [showUserModal, setShowUserModal] = useState(false);
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showBulkAddModal, setShowBulkAddModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Contact | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Contact | null>(null);

  // Collapsed company groups
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // Selected contacts
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const headerCheckboxRef = useRef<HTMLInputElement>(null);

  // Three-dot menu
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);

  function computeMenuPos(rect: DOMRect): { top: number; right: number } {
    const estimatedHeight = 96;
    const gap = 4;
    const viewportH = window.innerHeight;
    const top = rect.bottom + gap + estimatedHeight > viewportH
      ? Math.max(8, rect.top - gap - estimatedHeight)
      : rect.bottom + gap;
    return { top, right: window.innerWidth - rect.right };
  }

  // Invite state
  const [invitingId, setInvitingId] = useState<string | null>(null);
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set());

  // Add menu dropdown
  const [showAddMenu, setShowAddMenu] = useState(false);
  const addMenuRef = useRef<HTMLDivElement>(null);

  // Export menu dropdown
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // Active tab
  const [activeTab, setActiveTab] = useState<"all" | "companies" | "groups">("all");

  // Sort direction for company name column
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  useEffect(() => { loadContacts(); }, [projectId]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) setShowAddMenu(false);
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) setShowExportMenu(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    function handleClick() { setOpenMenuId(null); setMenuPos(null); }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function loadContacts() {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/directory`);
      if (res.ok) setContacts(await res.json());
    } finally {
      setLoading(false);
    }
  }

  function displayName(c: Contact): string {
    if (c.type === "company") return c.company ?? "Unnamed Company";
    if (c.type === "distribution_group") return c.group_name ?? "Unnamed Group";
    const parts = [c.first_name, c.last_name].filter(Boolean);
    return parts.length > 0 ? parts.join(" ") : "Unnamed";
  }


  function openContactDetail(contactId: string) {
    router.push(`/projects/${projectId}/directory/${contactId}`);
  }

  async function handleAddUser(data: UserFormData) {
    setShowUserModal(false);
    const res = await fetch(`/api/projects/${projectId}/directory`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "user", ...data }),
    });
    if (res.ok) {
      const c = await res.json();
      setContacts((prev) => [...prev, c]);
      if (data.email) {
        const contactName = [data.first_name, data.last_name].filter(Boolean).join(" ");
        await fetch(`/api/projects/${projectId}/invite-external`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: data.email, contact_name: contactName, contact_company: data.company ?? null }),
        });
        setInvitedIds((prev) => new Set(prev).add(c.id));
      }
      openContactDetail(c.id);
    }
  }

  async function handleAddCompany(data: CompanyFormData) {
    setShowCompanyModal(false);
    const res = await fetch(`/api/projects/${projectId}/directory`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "company", ...data }),
    });
    if (res.ok) { const c = await res.json(); setContacts((prev) => [...prev, c]); }
  }

  async function handleAddDistributionGroup(data: DistributionGroupFormData) {
    setShowGroupModal(false);
    const res = await fetch(`/api/projects/${projectId}/directory`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "distribution_group",
        group_name: data.group_name,
        notes: data.notes,
        member_contact_ids: data.member_contact_ids,
      }),
    });
    if (res.ok) { const c = await res.json(); setContacts((prev) => [...prev, c]); }
  }

  async function handleBulkAdd(picked: CompanyDirectoryEntry[]) {
    setShowBulkAddModal(false);
    const added: Contact[] = [];
    for (const e of picked) {
      const body: Record<string, unknown> = {
        type: e.type,
        first_name: e.first_name,
        last_name: e.last_name,
        email: e.email,
        phone: e.phone,
        company: e.company,
        permission: e.permission,
        group_name: e.group_name,
        notes: e.notes,
        job_title: e.job_title,
        address: e.address,
      };
      const res = await fetch(`/api/projects/${projectId}/directory`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) added.push(await res.json());
    }
    if (added.length) setContacts((prev) => [...prev, ...added]);
  }

  async function handleEdit(data: UserFormData | CompanyFormData | DistributionGroupFormData) {
    if (!editTarget) return;
    const id = editTarget.id;
    setEditTarget(null);
    const res = await fetch(`/api/projects/${projectId}/directory/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const updated = await res.json();
      setContacts((prev) => prev.map((c) => (c.id === id ? updated : c)));
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    setDeleteTarget(null);
    await fetch(`/api/projects/${projectId}/directory/${id}`, { method: "DELETE" });
    setContacts((prev) => prev.filter((c) => c.id !== id));
  }

  async function handleSendInvite(c: Contact) {
    if (!c.email) return;
    setInvitingId(c.id);
    const res = await fetch(`/api/projects/${projectId}/invite-external`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: c.email, contact_name: displayName(c), contact_company: c.company ?? null }),
    });
    setInvitingId(null);
    if (res.ok) setInvitedIds((prev) => new Set(prev).add(c.id));
    else alert((await res.json()).error || "Failed to send invite");
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }

  function toggleGroup(key: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleAllGroups() {
    const allGroupKeys = [
      ...companyNamesOrdered,
      ...(usersNoCompany.length > 0 ? ["__no_company__"] : []),
    ];
    const allCollapsed = allGroupKeys.length > 0 && allGroupKeys.every(k => collapsedGroups.has(k));
    setCollapsedGroups(allCollapsed ? new Set() : new Set(allGroupKeys));
  }

  function toggleSelectContact(id: string) {
    setSelectedContacts(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectGroup(ids: string[]) {
    const allGroupSelected = ids.length > 0 && ids.every(id => selectedContacts.has(id));
    setSelectedContacts(prev => {
      const next = new Set(prev);
      if (allGroupSelected) { ids.forEach(id => next.delete(id)); }
      else { ids.forEach(id => next.add(id)); }
      return next;
    });
  }

  // ── Filter ──────────────────────────────────────────────────────────────────
  const q = search.toLowerCase().trim();
  const filtered = contacts.filter((c) => {
    if (!q) return true;
    return [displayName(c), c.email, c.phone, c.company, c.job_title, c.address, c.permission]
      .some((v) => v?.toLowerCase().includes(q));
  });

  // ── Group by company ────────────────────────────────────────────────────────
  // Build ordered list: company entries first (as group headers), then users under each company,
  // then users with no company, then distribution groups.

  // Get unique company names from all contacts (company-type entries define the groups;
  // if a user's company doesn't have a company-type entry, still show them under that name)
  const companyEntries = filtered.filter((c) => c.type === "company");
  const users = filtered.filter((c) => c.type === "user");
  const groups = filtered.filter((c) => c.type === "distribution_group");

  // All company names (from company-type entries + inferred from users)
  const companyNamesOrdered: string[] = [];
  const seenCompanies = new Set<string>();

  // First, add companies that have a company-type entry (preserving order)
  for (const ce of companyEntries) {
    const name = ce.company ?? "";
    if (name && !seenCompanies.has(name)) {
      companyNamesOrdered.push(name);
      seenCompanies.add(name);
    }
  }
  // Then, add companies inferred from users (no company-type entry)
  for (const u of users) {
    const name = u.company ?? "";
    if (name && !seenCompanies.has(name)) {
      companyNamesOrdered.push(name);
      seenCompanies.add(name);
    }
  }

  // Sort company names alphabetically
  companyNamesOrdered.sort((a, b) =>
    sortDir === "asc" ? a.localeCompare(b) : b.localeCompare(a)
  );

  // Sorted company entries for the Companies tab
  const sortedCompanyEntries = [...companyEntries].sort((a, b) => {
    const nameA = a.company ?? "";
    const nameB = b.company ?? "";
    return sortDir === "asc" ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
  });

  const usersNoCompany = users.filter((u) => !u.company);
  const totalCount = filtered.length;

  const allGroupKeys = [
    ...companyNamesOrdered,
    ...(usersNoCompany.length > 0 ? ["__no_company__"] : []),
  ];
  const allGroupsCollapsed = allGroupKeys.length > 0 && allGroupKeys.every(k => collapsedGroups.has(k));

  const allSelectableIds = filtered.map(c => c.id);
  const allSelected = allSelectableIds.length > 0 && allSelectableIds.every(id => selectedContacts.has(id));
  const someSelected = allSelectableIds.some(id => selectedContacts.has(id));

  // Sync header checkbox indeterminate state
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = someSelected && !allSelected;
    }
  });

  // All known company name strings (for datalist in modal)
  const allCompanyNames = [...new Set(contacts.filter((c) => c.company).map((c) => c.company as string))];

  const menuContact = contacts.find((c) => c.id === openMenuId) ?? null;

  return (
    <div className="min-h-screen bg-[#FAFAF7]">
      {/* App header */}
      <header className="bg-[#FAFAF7] border-b border-black/[0.06] px-6 h-14 flex items-center justify-between">
        <a href="/dashboard" className="hover:opacity-80 transition-opacity">
          <Brand />
        </a>
        <div className="flex items-center gap-5">
          <span className="text-sm text-gray-400">{username}</span>
          <button onClick={handleLogout} className="text-sm text-gray-400 hover:text-gray-900 transition-colors">Logout</button>
        </div>
      </header>

      <ProjectNav projectId={projectId} />

      <main className="max-w-screen-xl mx-auto px-6 py-6">
        {/* Page header — editorial title + voice line */}
        <div className="sec-row mb-5">
          <div className="min-w-0">
            <h1 className="h2-warm">Directory</h1>
            {totalCount > 0 ? (
              <p className="sub mt-1.5">
                <em>Across this project</em>
                <span className="sep">·</span>
                <span className="num" style={{ color: "var(--brand-500)" }}>{users.length}</span> people
                <span className="sep">·</span>
                <span className="num">{companyEntries.length}</span> companies
                <span className="sep">·</span>
                <span className="num">{groups.length}</span> groups
              </p>
            ) : (
              <p className="sub mt-1.5"><em>Project roster of people, companies &amp; distribution groups</em></p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Export button */}
            <div ref={exportMenuRef} className="relative">
              <button onClick={() => setShowExportMenu((o) => !o)} className="btn-secondary">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
                </svg>
                Export
              </button>
              {showExportMenu && (
                <div className="absolute right-0 mt-1 w-40 bg-white border border-black/[0.08] rounded-lg shadow-lg py-1 z-20">
                  <button
                    onClick={() => { exportDirectoryPDF(filtered); setShowExportMenu(false); }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Export as PDF
                  </button>
                  <button
                    onClick={() => { exportDirectoryCSV(filtered); setShowExportMenu(false); }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Export as CSV
                  </button>
                </div>
              )}
            </div>

            {/* Add button */}
            <div ref={addMenuRef} className="relative">
              <button onClick={() => setShowAddMenu((o) => !o)} className="btn-primary">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Add
              </button>
              {showAddMenu && (
                <div className="absolute right-0 mt-1 w-64 bg-white border border-black/[0.08] rounded-lg shadow-lg py-1 z-20">
                  <button onClick={() => { setShowUserModal(true); setShowAddMenu(false); }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                    Add Person
                  </button>
                  <button onClick={() => { setShowCompanyModal(true); setShowAddMenu(false); }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                    Add Company
                  </button>
                  <button onClick={() => { setShowGroupModal(true); setShowAddMenu(false); }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                    Add Distribution Group
                  </button>
                  <div className="border-t border-gray-100 my-1" />
                  <button onClick={() => { setShowBulkAddModal(true); setShowAddMenu(false); }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                    Bulk Add from Company Directory
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Filter bar — search + segmented tabs */}
        <div className="filters">
          <div className="search">
            <svg className="w-4 h-4 text-gray-400 pointer-events-none shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search people, companies, roles…"
            />
          </div>
          <div className="seg">
            <button className={activeTab === "all" ? "active" : ""} onClick={() => setActiveTab("all")}>People</button>
            <button className={activeTab === "companies" ? "active" : ""} onClick={() => setActiveTab("companies")}>Companies</button>
            <button className={activeTab === "groups" ? "active" : ""} onClick={() => setActiveTab("groups")}>Groups</button>
          </div>
          {activeTab !== "groups" && (
            <button
              onClick={() => setSortDir((d) => d === "asc" ? "desc" : "asc")}
              className="btn-quiet ml-auto"
              title="Toggle name sort"
            >
              Sort: Name {sortDir === "asc" ? "↑" : "↓"}
            </button>
          )}
        </div>

        {/* Bulk selection note */}
        {!loading && selectedContacts.size > 0 && (
          <p className="sub mb-3">
            <span className="num" style={{ color: "var(--brand-500)" }}>{selectedContacts.size}</span> selected
            <span className="sep">·</span>
            <button onClick={() => setSelectedContacts(new Set())} className="btn-quiet">Clear selection</button>
          </p>
        )}

        {/* Content */}
        {loading ? (
          <div className="dir-grid">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="dir-card animate-pulse">
                <div className="head">
                  <div className="w-10 h-10 rounded-full bg-black/[0.06]" />
                  <div className="flex-1">
                    <div className="h-3.5 w-28 bg-black/[0.06] rounded mb-1.5" />
                    <div className="h-2.5 w-20 bg-black/[0.05] rounded" />
                  </div>
                </div>
                <div className="h-2.5 w-32 bg-black/[0.05] rounded mt-3" />
                <div className="h-2.5 w-40 bg-black/[0.05] rounded mt-2" />
              </div>
            ))}
          </div>
        ) : (activeTab === "all" ? users.length + companyEntries.length === 0 : activeTab === "companies" ? companyEntries.length === 0 : groups.length === 0) ? (
          <div className="card card-pad py-16 text-center border-dashed">
            <svg className="w-10 h-10 text-black/[0.12] mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
            <p className="font-display text-lg text-[color:var(--ink)]">
              {activeTab === "companies"
                ? `No companies${q ? " match your search" : " yet"}`
                : activeTab === "groups"
                  ? `No distribution groups${q ? " match your search" : " yet"}`
                  : `No contacts${q ? " match your search" : " yet"}`}
            </p>
            {!q && <p className="text-xs text-gray-400 mt-1">Use the Add button to create your first contact</p>}
          </div>
        ) : activeTab === "all" ? (
          <>
            {companyNamesOrdered.map((companyName) => {
              const companyEntry = companyEntries.find((ce) => ce.company === companyName);
              const members = users.filter((u) => u.company === companyName);
              const collapsed = collapsedGroups.has(companyName);
              const groupIds = [
                ...(companyEntry ? [companyEntry.id] : []),
                ...members.map((m) => m.id),
              ];
              const groupAllSelected = groupIds.length > 0 && groupIds.every((id) => selectedContacts.has(id));

              return (
                <div key={`group-${companyName}`} className="mb-7">
                  <div className="sec-row mb-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <button
                        onClick={() => toggleGroup(companyName)}
                        className="text-gray-400 hover:text-gray-700 transition-colors shrink-0"
                        title={collapsed ? "Expand" : "Collapse"}
                      >
                        <svg className={`w-4 h-4 transition-transform ${collapsed ? "-rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      <input
                        type="checkbox"
                        className="rounded border-gray-300 cursor-pointer shrink-0"
                        checked={groupAllSelected}
                        onChange={() => toggleSelectGroup(groupIds)}
                        aria-label={`Select all in ${companyName}`}
                      />
                      <button
                        onClick={() => companyEntry && openContactDetail(companyEntry.id)}
                        disabled={!companyEntry}
                        className="h3-warm truncate enabled:hover:text-[color:var(--brand-700)] transition-colors disabled:cursor-default"
                      >
                        {companyName}
                      </button>
                      <span className="text-xs text-gray-400 shrink-0">
                        {members.length} {members.length === 1 ? "person" : "people"}
                      </span>
                      {companyEntry?.phone && (
                        <span className="font-mono text-[11px] text-gray-400 shrink-0">{companyEntry.phone}</span>
                      )}
                    </div>
                    {companyEntry && (
                      <button
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (openMenuId === companyEntry.id) { setOpenMenuId(null); setMenuPos(null); return; }
                          const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                          setMenuPos(computeMenuPos(rect));
                          setOpenMenuId(companyEntry.id);
                        }}
                        className="p-1 text-gray-300 hover:text-gray-600 rounded hover:bg-gray-100 transition-colors shrink-0"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" />
                        </svg>
                      </button>
                    )}
                  </div>
                  {!collapsed && (
                    members.length === 0 ? (
                      <p className="text-xs text-gray-400 italic pl-7">No people added to this company yet.</p>
                    ) : (
                      <div className="dir-grid">
                        {members.map((c) => (
                          <PersonCard
                            key={c.id}
                            c={c}
                            displayName={displayName(c)}
                            invitingId={invitingId}
                            openMenuId={openMenuId}
                            onInvite={handleSendInvite}
                            onMenuOpen={(id, rect) => { setMenuPos(computeMenuPos(rect)); setOpenMenuId(id); }}
                            onMenuClose={() => { setOpenMenuId(null); setMenuPos(null); }}
                            onOpen={(contact) => openContactDetail(contact.id)}
                            selected={selectedContacts.has(c.id)}
                            onToggleSelect={toggleSelectContact}
                          />
                        ))}
                      </div>
                    )
                  )}
                </div>
              );
            })}

            {usersNoCompany.length > 0 && (
              <div className="mb-7">
                <div className="sec-row mb-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <button
                      onClick={() => toggleGroup("__no_company__")}
                      className="text-gray-400 hover:text-gray-700 transition-colors shrink-0"
                      title={collapsedGroups.has("__no_company__") ? "Expand" : "Collapse"}
                    >
                      <svg className={`w-4 h-4 transition-transform ${collapsedGroups.has("__no_company__") ? "-rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    <input
                      type="checkbox"
                      className="rounded border-gray-300 cursor-pointer shrink-0"
                      checked={usersNoCompany.length > 0 && usersNoCompany.every((u) => selectedContacts.has(u.id))}
                      onChange={() => toggleSelectGroup(usersNoCompany.map((u) => u.id))}
                      aria-label="Select all unassigned"
                    />
                    <h3 className="h3-warm">No company</h3>
                    <span className="text-xs text-gray-400 shrink-0">
                      {usersNoCompany.length} {usersNoCompany.length === 1 ? "person" : "people"}
                    </span>
                  </div>
                </div>
                {!collapsedGroups.has("__no_company__") && (
                  <div className="dir-grid">
                    {usersNoCompany.map((c) => (
                      <PersonCard
                        key={c.id}
                        c={c}
                        displayName={displayName(c)}
                        invitingId={invitingId}
                        openMenuId={openMenuId}
                        onInvite={handleSendInvite}
                        onMenuOpen={(id, rect) => { setMenuPos(computeMenuPos(rect)); setOpenMenuId(id); }}
                        onMenuClose={() => { setOpenMenuId(null); setMenuPos(null); }}
                        onOpen={(contact) => openContactDetail(contact.id)}
                        selected={selectedContacts.has(c.id)}
                        onToggleSelect={toggleSelectContact}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        ) : activeTab === "companies" ? (
          <>
            <h3 className="h3-warm mb-3">Companies</h3>
            <div className="dir-grid">
              {sortedCompanyEntries.map((ce) => {
                const name = displayName(ce);
                return (
                  <div key={ce.id} className="dir-card">
                    <div className="head">
                      <div
                        className={`av av-${warmTint(name)}`}
                        style={{ width: 40, height: 40, borderRadius: 8, display: "grid", placeItems: "center", fontSize: 15, fontWeight: 600, color: "#fff", fontFamily: "var(--font-display, 'DM Serif Display'), serif", fontStyle: "italic" }}
                      >
                        {(name[0] || "?").toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <button onClick={() => openContactDetail(ce.id)} className="nm hover:text-[color:var(--brand-700)] transition-colors text-left">{name}</button>
                        <div className="role">Company</div>
                      </div>
                      <input
                        type="checkbox"
                        className="rounded border-gray-300 cursor-pointer ml-auto shrink-0"
                        checked={selectedContacts.has(ce.id)}
                        onChange={() => toggleSelectContact(ce.id)}
                        aria-label={`Select ${name}`}
                      />
                    </div>
                    {(ce.email || ce.phone) && (
                      <div className="info">
                        {ce.email && <a href={`mailto:${ce.email}`} className="hover:text-[color:var(--ink)] transition-colors">{ce.email}</a>}
                        {ce.email && ce.phone && <span className="sep"> · </span>}
                        {ce.phone && <span>{ce.phone}</span>}
                      </div>
                    )}
                    {ce.address && <div className="info">{ce.address}</div>}
                    <div className="flex items-center gap-2 mt-3">
                      <button onClick={() => setEditTarget(ce)} className="btn-quiet">Edit</button>
                      <button
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (openMenuId === ce.id) { setOpenMenuId(null); setMenuPos(null); return; }
                          const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                          setMenuPos(computeMenuPos(rect));
                          setOpenMenuId(ce.id);
                        }}
                        className="p-1 text-gray-400 hover:text-gray-700 rounded hover:bg-gray-100 transition-colors ml-auto"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <>
            <h3 className="h3-warm mb-3">Distribution Groups</h3>
            <div className="dir-grid">
              {groups.map((c) => {
                const name = c.group_name ?? "Unnamed Group";
                const count = c.member_contact_ids?.length ?? 0;
                return (
                  <div key={c.id} className="dir-card">
                    <div className="head">
                      <div
                        className={`av av-${warmTint(name)}`}
                        style={{ width: 40, height: 40, borderRadius: 8, display: "grid", placeItems: "center", fontSize: 15, fontWeight: 600, color: "#fff", fontFamily: "var(--font-display, 'DM Serif Display'), serif", fontStyle: "italic" }}
                      >
                        {(name[0] || "?").toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="nm truncate">{name}</div>
                        <div className="role">Distribution Group</div>
                      </div>
                      <input
                        type="checkbox"
                        className="rounded border-gray-300 cursor-pointer ml-auto shrink-0"
                        checked={selectedContacts.has(c.id)}
                        onChange={() => toggleSelectContact(c.id)}
                        aria-label={`Select ${name}`}
                      />
                    </div>
                    <div className="co">{count} {count === 1 ? "member" : "members"}</div>
                    {c.notes && <div className="info">{c.notes}</div>}
                    <div className="flex items-center gap-2 mt-3">
                      <button onClick={() => setEditTarget(c)} className="btn-quiet">Edit</button>
                      <button
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (openMenuId === c.id) { setOpenMenuId(null); setMenuPos(null); return; }
                          const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                          setMenuPos(computeMenuPos(rect));
                          setOpenMenuId(c.id);
                        }}
                        className="p-1 text-gray-400 hover:text-gray-700 rounded hover:bg-gray-100 transition-colors ml-auto"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </main>

      {/* Fixed three-dot dropdown */}
      {openMenuId && menuPos && menuContact && (
        <div
          onMouseDown={(e) => e.stopPropagation()}
          style={{ position: "fixed", top: menuPos.top, right: menuPos.right, zIndex: 9999 }}
          className="w-36 bg-white border border-gray-100 rounded-lg shadow-lg py-1"
        >
          <button
            onMouseDown={(e) => { e.stopPropagation(); if (menuContact.type === "user") { openContactDetail(menuContact.id); } else { setEditTarget(menuContact); } setOpenMenuId(null); setMenuPos(null); }}
            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >Edit</button>
          <div className="border-t border-gray-100 my-1" />
          <button
            onMouseDown={(e) => { e.stopPropagation(); setDeleteTarget(menuContact); setOpenMenuId(null); setMenuPos(null); }}
            className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
          >Remove</button>
        </div>
      )}

      {/* Modals */}
      {showUserModal && (
        <UserModal companyNames={allCompanyNames} onConfirm={handleAddUser} onCancel={() => setShowUserModal(false)} />
      )}
      {showCompanyModal && (
        <CompanyGroupModal onConfirm={handleAddCompany} onCancel={() => setShowCompanyModal(false)} />
      )}
      {showGroupModal && (
        <DistributionGroupModal
          candidateMembers={contacts.filter((c) => c.type === "user")}
          onConfirm={handleAddDistributionGroup}
          onCancel={() => setShowGroupModal(false)}
        />
      )}
      {showBulkAddModal && (
        <BulkAddFromCompanyModal projectId={projectId} onConfirm={handleBulkAdd} onCancel={() => setShowBulkAddModal(false)} />
      )}
      {editTarget?.type === "user" && (
        <UserModal
          initial={{ first_name: editTarget.first_name ?? "", last_name: editTarget.last_name ?? "", email: editTarget.email ?? "", phone: editTarget.phone ?? "", company: editTarget.company ?? "", job_title: editTarget.job_title ?? "", address: editTarget.address ?? "", permission: editTarget.permission ?? "" }}
          companyNames={allCompanyNames}
          onConfirm={handleEdit}
          onCancel={() => setEditTarget(null)}
        />
      )}
      {editTarget?.type === "company" && (
        <CompanyGroupModal
          initial={{ company: editTarget.company ?? "", email: editTarget.email ?? "", phone: editTarget.phone ?? "", address: editTarget.address ?? "", notes: editTarget.notes ?? "" }}
          onConfirm={handleEdit}
          onCancel={() => setEditTarget(null)}
        />
      )}
      {editTarget?.type === "distribution_group" && (
        <DistributionGroupModal
          initial={{
            group_name: editTarget.group_name ?? "",
            notes: editTarget.notes ?? "",
            member_contact_ids: editTarget.member_contact_ids ?? [],
          }}
          candidateMembers={contacts.filter((c) => c.type === "user")}
          onConfirm={handleEdit}
          onCancel={() => setEditTarget(null)}
        />
      )}
      {deleteTarget && (
        <ConfirmModal name={displayName(deleteTarget)} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
      )}
    </div>
  );
}

// ── Person row (extracted to avoid repeating JSX) ─────────────────────────────

function PersonRow({
  c,
  displayName,
  invitingId,
  invitedIds,
  openMenuId,
  onInvite,
  onMenuOpen,
  onMenuClose,
  onEdit,
  indent,
  selected,
  onToggleSelect,
}: {
  c: Contact;
  displayName: string;
  invitingId: string | null;
  invitedIds: Set<string>;
  openMenuId: string | null;
  onInvite: (c: Contact) => void;
  onMenuOpen: (id: string, rect: DOMRect) => void;
  onMenuClose: () => void;
  onEdit: (c: Contact) => void;
  indent: boolean;
  selected: boolean;
  onToggleSelect: (id: string) => void;
}) {
  const alreadyInvited = invitedIds.has(c.id);
  const sending = invitingId === c.id;

  return (
    <tr className="hover:bg-blue-50/30 transition-colors border-b border-gray-100 last:border-b-0">
      {/* Expand spacer */}
      <td className="px-3 py-3" />

      {/* Checkbox */}
      <td className="px-1 py-3">
        <input
          type="checkbox"
          className="rounded border-gray-300 cursor-pointer"
          checked={selected}
          onChange={() => onToggleSelect(c.id)}
        />
      </td>

      {/* Name + avatar */}
      <td className="px-3 py-3">
        <div className={`flex items-center gap-2.5 ${indent ? "pl-4" : ""}`}>
          {/* Edit button */}
          <button
            onClick={() => onEdit(c)}
            className="shrink-0 px-2 py-0.5 text-xs border border-gray-300 rounded text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Edit
          </button>
          <Avatar first={c.first_name} last={c.last_name} />
          <span className="font-medium text-gray-900 text-sm">{displayName}</span>
        </div>
      </td>

      {/* Job title */}
      <td className="px-3 py-3 text-sm text-gray-500">{c.job_title || <span className="text-gray-300">—</span>}</td>

      {/* Email / Phone */}
      <td className="px-3 py-3">
        <div className="space-y-0.5">
          {c.email && (
            <div className="text-xs text-gray-600">
              <a href={`mailto:${c.email}`} className="hover:text-gray-900 hover:underline transition-colors">{c.email}</a>
            </div>
          )}
          {c.phone && <div className="text-xs text-gray-500">{c.phone}</div>}
          {!c.email && !c.phone && <span className="text-gray-300 text-xs">—</span>}
        </div>
      </td>

      {/* Address */}
      <td className="px-3 py-3 text-xs text-gray-500 max-w-[160px]">
        {c.address || <span className="text-gray-300">—</span>}
      </td>

      {/* Company */}
      <td className="px-3 py-3 text-sm text-gray-500">{c.company || <span className="text-gray-300">—</span>}</td>

      {/* Permission */}
      <td className="px-3 py-3 text-sm text-gray-500">{c.permission || <span className="text-gray-300">—</span>}</td>

      {/* Actions */}
      <td className="px-3 py-3">
        <div className="flex items-center gap-1.5 justify-end">
          {c.email && (
            <button
              onClick={() => onInvite(c)}
              disabled={sending}
              className={`px-3 py-1 text-xs font-semibold rounded text-white transition-colors disabled:opacity-60 ${
                alreadyInvited ? "bg-gray-900 hover:bg-gray-700" : "bg-gray-900 hover:bg-gray-700"
              }`}
            >
              {sending ? "Sending…" : "Re-Invite"}
            </button>
          )}
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              if (openMenuId === c.id) { onMenuClose(); return; }
              onMenuOpen(c.id, (e.currentTarget as HTMLButtonElement).getBoundingClientRect());
            }}
            className="p-1 text-gray-400 hover:text-gray-700 rounded hover:bg-gray-100 transition-colors"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" />
            </svg>
          </button>
        </div>
      </td>
    </tr>
  );
}

// ── Person card (grid view) ───────────────────────────────────────────────────

function PersonCard({
  c,
  displayName,
  invitingId,
  openMenuId,
  onInvite,
  onMenuOpen,
  onMenuClose,
  onOpen,
  selected,
  onToggleSelect,
}: {
  c: Contact;
  displayName: string;
  invitingId: string | null;
  openMenuId: string | null;
  onInvite: (c: Contact) => void;
  onMenuOpen: (id: string, rect: DOMRect) => void;
  onMenuClose: () => void;
  onOpen: (c: Contact) => void;
  selected: boolean;
  onToggleSelect: (id: string) => void;
}) {
  const sending = invitingId === c.id;
  const initials = getInitials(c.first_name, c.last_name);
  return (
    <div className="dir-card">
      <div className="head">
        <div
          className={`av av-${warmTint(displayName)}`}
          style={{ width: 40, height: 40, borderRadius: 8, display: "grid", placeItems: "center", fontSize: 15, fontWeight: 600, color: "#fff", fontFamily: "var(--font-display, 'DM Serif Display'), serif", fontStyle: "italic" }}
        >
          {initials}
        </div>
        <div className="min-w-0">
          <button onClick={() => onOpen(c)} className="nm hover:text-[color:var(--brand-700)] transition-colors text-left truncate">{displayName}</button>
          {c.job_title && <div className="role truncate">{c.job_title}</div>}
        </div>
        <input
          type="checkbox"
          className="rounded border-gray-300 cursor-pointer ml-auto shrink-0"
          checked={selected}
          onChange={() => onToggleSelect(c.id)}
          aria-label={`Select ${displayName}`}
        />
      </div>
      {(c.email || c.phone) && (
        <div className="info">
          {c.email && <a href={`mailto:${c.email}`} className="hover:text-[color:var(--ink)] transition-colors">{c.email}</a>}
          {c.email && c.phone && <span className="sep"> · </span>}
          {c.phone && <span>{c.phone}</span>}
        </div>
      )}
      {c.permission && <div className="info">{c.permission}</div>}
      <div className="flex items-center gap-2 mt-3">
        {c.email && (
          <button
            onClick={() => onInvite(c)}
            disabled={sending}
            className="px-3 py-1 text-xs font-semibold rounded text-white bg-gray-900 hover:bg-gray-700 transition-colors disabled:opacity-60"
          >
            {sending ? "Sending…" : "Invite"}
          </button>
        )}
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            if (openMenuId === c.id) { onMenuClose(); return; }
            onMenuOpen(c.id, (e.currentTarget as HTMLButtonElement).getBoundingClientRect());
          }}
          className="p-1 text-gray-400 hover:text-gray-700 rounded hover:bg-gray-100 transition-colors ml-auto"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" />
          </svg>
        </button>
      </div>
    </div>
  );
}
