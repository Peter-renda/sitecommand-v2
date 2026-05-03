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
  created_at: string;
};

const PERMISSIONS = PERMISSION_TEMPLATE_ORDER;

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

type DistributionGroupFormData = { group_name: string; email: string; notes: string };

function DistributionGroupModal({
  initial,
  onConfirm,
  onCancel,
}: {
  initial?: Partial<DistributionGroupFormData>;
  onConfirm: (data: DistributionGroupFormData) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<DistributionGroupFormData>({
    group_name: initial?.group_name ?? "",
    email: initial?.email ?? "",
    notes: initial?.notes ?? "",
  });

  function set(field: keyof DistributionGroupFormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.group_name.trim()) return;
    onConfirm(form);
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">{initial ? "Edit Distribution Group" : "Add Distribution Group"}</h2>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Group Name <span className="text-red-500">*</span></label>
            <input type="text" value={form.group_name} onChange={(e) => set("group_name", e.target.value)} required
              className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              placeholder="e.g. Project Managers" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Group Email</label>
            <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              placeholder="group@example.com" />
            <p className="text-xs text-gray-400 mt-1">Optional shared address for the group.</p>
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
              className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-md hover:bg-gray-700 transition-colors">{initial ? "Save Changes" : "Add Group"}</button>
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

  // Invite state
  const [invitingId, setInvitingId] = useState<string | null>(null);
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set());

  // Add menu dropdown
  const [showAddMenu, setShowAddMenu] = useState(false);
  const addMenuRef = useRef<HTMLDivElement>(null);

  // Active tab
  const [activeTab, setActiveTab] = useState<"all" | "companies">("all");

  // Sort direction for company name column
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  useEffect(() => { loadContacts(); }, [projectId]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) setShowAddMenu(false);
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
      body: JSON.stringify({ type: "distribution_group", group_name: data.group_name, email: data.email, notes: data.notes }),
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
    <div className="min-h-screen bg-gray-50">
      {/* App header */}
      <header className="bg-white border-b border-gray-100 px-6 h-14 flex items-center justify-between">
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
        {/* Toolbar */}
        <div className="mb-4 flex items-end justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <h1 className="font-display text-[32px] leading-[1.05] tracking-[-0.012em] text-[color:var(--ink)]">Directory</h1>
            {totalCount > 0 && (
              <p className="sec-sub mt-1.5">
                <span className="serif-italic text-[color:var(--brand-700)]">Across this project</span>
                <span className="sep">·</span>
                <span className="num" style={{ color: "var(--brand-500)" }}>{totalCount}</span> contacts
                <span className="sep">·</span>
                <span className="num">{companyEntries.length}</span> companies
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 mb-4">
          {/* Search */}
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search"
              className="pl-9 pr-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 w-56 bg-white"
            />
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Add button */}
          <div ref={addMenuRef} className="relative">
            <button
              onClick={() => setShowAddMenu((o) => !o)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded hover:bg-gray-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add
              <svg className={`w-4 h-4 transition-transform ${showAddMenu ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showAddMenu && (
              <div className="absolute right-0 mt-1 w-64 bg-white border border-gray-100 rounded-lg shadow-lg py-1 z-20">
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

        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-4">
          <button
            onClick={() => setActiveTab("all")}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${activeTab === "all" ? "border-gray-900 text-gray-900" : "border-transparent text-gray-500 hover:text-gray-700"}`}
          >
            All
          </button>
          <button
            onClick={() => setActiveTab("companies")}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${activeTab === "companies" ? "border-gray-900 text-gray-900" : "border-transparent text-gray-500 hover:text-gray-700"}`}
          >
            Companies
          </button>
        </div>

        {/* Count row */}
        {!loading && totalCount > 0 && (
          <p className="text-xs text-gray-500 mb-3">
            Displaying 1 – {activeTab === "companies" ? companyEntries.length : totalCount} of {activeTab === "companies" ? companyEntries.length : totalCount}
          </p>
        )}

        {/* Table */}
        {loading ? (
          <p className="text-sm text-gray-400 py-8">Loading…</p>
        ) : (activeTab === "all" ? totalCount === 0 : companyEntries.length === 0) ? (
          <div className="bg-white border border-dashed border-gray-200 rounded-xl py-16 text-center">
            <svg className="w-10 h-10 text-gray-200 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
            <p className="text-sm text-gray-400">{activeTab === "companies" ? `No companies${q ? " matching your search" : " yet"}` : `No contacts${q ? " matching your search" : " yet"}`}</p>
            {!q && <p className="text-xs text-gray-300 mt-1">Use the Add button to create your first contact</p>}
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="w-8 px-3 py-2.5">
                    {activeTab === "all" && allGroupKeys.length > 0 && (
                      <button
                        onClick={toggleAllGroups}
                        title={allGroupsCollapsed ? "Expand all" : "Collapse all"}
                        className="text-gray-400 hover:text-gray-700 transition-colors"
                      >
                        <svg className={`w-4 h-4 transition-transform ${allGroupsCollapsed ? "-rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    )}
                  </th>
                  <th className="w-8 px-1 py-2.5">
                    <input
                      ref={headerCheckboxRef}
                      type="checkbox"
                      className="rounded border-gray-300 cursor-pointer"
                      checked={allSelected}
                      onChange={() => {
                        if (allSelected) {
                          setSelectedContacts(new Set());
                        } else {
                          setSelectedContacts(new Set(allSelectableIds));
                        }
                      }}
                    />
                  </th>
                  <th className="px-3 py-2.5 text-left">
                    <button
                      onClick={() => setSortDir((d) => d === "asc" ? "desc" : "asc")}
                      className="flex items-center gap-1 text-xs font-semibold text-gray-600 uppercase tracking-wide hover:text-gray-900 transition-colors"
                    >
                      Name
                      <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        {sortDir === "asc" ? (
                          <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
                        ) : (
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17 8V20m0 0l4-4m-4 4l-4-4M7 20V8m0 0L3 12m4-4l4 4" />
                        )}
                      </svg>
                    </button>
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Job Title</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Email / Phone / Fax</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Address</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Company</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Permission Template</th>
                  <th className="w-28 px-3 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">

                {/* Companies tab: flat list of company-type entries, sorted alphabetically */}
                {activeTab === "companies" && sortedCompanyEntries.map((ce) => (
                  <tr key={ce.id} className="hover:bg-blue-50/30 transition-colors border-b border-gray-100 last:border-b-0">
                    <td className="px-3 py-3" />
                    <td className="px-1 py-3">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300 cursor-pointer"
                        checked={selectedContacts.has(ce.id)}
                        onChange={() => toggleSelectContact(ce.id)}
                      />
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2.5">
                        <button onClick={() => setEditTarget(ce)} className="shrink-0 px-2 py-0.5 text-xs border border-gray-300 rounded text-gray-600 hover:bg-gray-50 transition-colors">Edit</button>
                        <button onClick={() => openContactDetail(ce.id)} className="font-medium text-gray-900 text-sm hover:text-blue-700 hover:underline transition-colors">{displayName(ce)}</button>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-500"><span className="text-gray-300">—</span></td>
                    <td className="px-3 py-3">
                      <div className="space-y-0.5">
                        {ce.email && <div className="text-xs text-gray-600"><a href={`mailto:${ce.email}`} className="hover:text-gray-900 hover:underline transition-colors">{ce.email}</a></div>}
                        {ce.phone && <div className="text-xs text-gray-500">{ce.phone}</div>}
                        {!ce.email && !ce.phone && <span className="text-gray-300 text-xs">—</span>}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-500 max-w-[160px]">{ce.address || <span className="text-gray-300">—</span>}</td>
                    <td className="px-3 py-3 text-sm text-gray-500"><span className="text-gray-300">—</span></td>
                    <td className="px-3 py-3 text-sm text-gray-500"><span className="text-gray-300">—</span></td>
                    <td className="px-3 py-3">
                      <button
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (openMenuId === ce.id) { setOpenMenuId(null); setMenuPos(null); return; }
                          const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                          setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
                          setOpenMenuId(ce.id);
                        }}
                        className="p-1 text-gray-400 hover:text-gray-700 rounded hover:bg-gray-100 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}

                {/* All tab: Company groups */}
                {activeTab === "all" && companyNamesOrdered.map((companyName) => {
                  const companyEntry = companyEntries.find((ce) => ce.company === companyName);
                  const members = users.filter((u) => u.company === companyName);
                  const collapsed = collapsedGroups.has(companyName);
                  const isEmpty = members.length === 0;

                  const groupIds = [
                    ...(companyEntry ? [companyEntry.id] : []),
                    ...members.map(m => m.id),
                  ];
                  const groupAllSelected = groupIds.length > 0 && groupIds.every(id => selectedContacts.has(id));

                  return [
                    // Company group header row
                    <tr key={`group-${companyName}`} className="bg-gray-50 border-b border-gray-200">
                      <td className="px-3 py-2">
                        <button onClick={() => toggleGroup(companyName)}
                          className="text-gray-400 hover:text-gray-700 transition-colors">
                          <svg className={`w-4 h-4 transition-transform ${collapsed ? "-rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      </td>
                      <td className="px-1 py-2">
                        <input
                          type="checkbox"
                          className="rounded border-gray-300 cursor-pointer"
                          checked={groupAllSelected}
                          onChange={() => toggleSelectGroup(groupIds)}
                        />
                      </td>
                      <td colSpan={7} className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openContactDetail(companyEntry?.id ?? "")}
                            disabled={!companyEntry}
                            className="text-sm font-semibold text-blue-600 hover:text-blue-800 hover:underline transition-colors disabled:text-gray-500 disabled:no-underline"
                          >
                            {companyName}
                          </button>
                          {!isEmpty && (
                            <span className="text-xs text-gray-400">({members.length})</span>
                          )}
                          {companyEntry && (
                            <div className="flex items-center gap-1 ml-1">
                              {companyEntry.phone && (
                                <span className="text-xs text-gray-400">{companyEntry.phone}</span>
                              )}
                            </div>
                          )}
                          {companyEntry && (
                            <button
                              onMouseDown={(e) => e.stopPropagation()}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (openMenuId === companyEntry.id) { setOpenMenuId(null); setMenuPos(null); return; }
                                const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                                setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
                                setOpenMenuId(companyEntry.id);
                              }}
                              className="ml-auto p-1 text-gray-300 hover:text-gray-600 rounded hover:bg-gray-100 transition-colors"
                            >
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                <circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>,

                    // Member rows
                    ...(!collapsed ? members.map((c) => (
                      <PersonRow
                        key={c.id}
                        c={c}
                        displayName={displayName(c)}
                        invitingId={invitingId}
                        invitedIds={invitedIds}
                        openMenuId={openMenuId}
                        onInvite={handleSendInvite}
                        onMenuOpen={(id, rect) => {
                          setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
                          setOpenMenuId(id);
                        }}
                        onMenuClose={() => { setOpenMenuId(null); setMenuPos(null); }}
                        onEdit={(contact) => openContactDetail(contact.id)}
                        indent
                        selected={selectedContacts.has(c.id)}
                        onToggleSelect={toggleSelectContact}
                      />
                    )) : []),
                  ];
                })}

                {/* Users with no company */}
                {activeTab === "all" && usersNoCompany.length > 0 && (
                  <>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <td className="px-3 py-2">
                        <button onClick={() => toggleGroup("__no_company__")} className="text-gray-400 hover:text-gray-700 transition-colors">
                          <svg className={`w-4 h-4 transition-transform ${collapsedGroups.has("__no_company__") ? "-rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      </td>
                      <td className="px-1 py-2">
                        <input
                          type="checkbox"
                          className="rounded border-gray-300 cursor-pointer"
                          checked={usersNoCompany.length > 0 && usersNoCompany.every(u => selectedContacts.has(u.id))}
                          onChange={() => toggleSelectGroup(usersNoCompany.map(u => u.id))}
                        />
                      </td>
                      <td colSpan={7} className="px-3 py-2">
                        <span className="text-sm font-semibold text-gray-500">No Company</span>
                        <span className="text-xs text-gray-400 ml-2">({usersNoCompany.length})</span>
                      </td>
                    </tr>
                    {!collapsedGroups.has("__no_company__") && usersNoCompany.map((c) => (
                      <PersonRow
                        key={c.id}
                        c={c}
                        displayName={displayName(c)}
                        invitingId={invitingId}
                        invitedIds={invitedIds}
                        openMenuId={openMenuId}
                        onInvite={handleSendInvite}
                        onMenuOpen={(id, rect) => {
                          setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
                          setOpenMenuId(id);
                        }}
                        onMenuClose={() => { setOpenMenuId(null); setMenuPos(null); }}
                        onEdit={(contact) => openContactDetail(contact.id)}
                        indent={false}
                        selected={selectedContacts.has(c.id)}
                        onToggleSelect={toggleSelectContact}
                      />
                    ))}
                  </>
                )}

                {/* Distribution groups */}
                {activeTab === "all" && groups.length > 0 && (
                  <>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <td colSpan={9} className="px-3 py-2">
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Distribution Groups</span>
                      </td>
                    </tr>
                    {groups.map((c) => (
                      <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-3 py-3" />
                        <td className="px-1 py-3">
                          <input
                            type="checkbox"
                            className="rounded border-gray-300 cursor-pointer"
                            checked={selectedContacts.has(c.id)}
                            onChange={() => toggleSelectContact(c.id)}
                          />
                        </td>
                        <td className="px-3 py-3 font-medium text-gray-900">{c.group_name}</td>
                        <td className="px-3 py-3 text-gray-500" />
                        <td className="px-3 py-3">
                          {c.email && <a href={`mailto:${c.email}`} className="text-gray-600 hover:text-gray-900 text-xs transition-colors">{c.email}</a>}
                        </td>
                        <td className="px-3 py-3 text-gray-500" />
                        <td className="px-3 py-3 text-gray-500" />
                        <td className="px-3 py-3" />
                        <td className="px-3 py-3">
                          <button
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (openMenuId === c.id) { setOpenMenuId(null); setMenuPos(null); return; }
                              const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                              setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
                              setOpenMenuId(c.id);
                            }}
                            className="p-1 text-gray-400 hover:text-gray-700 rounded hover:bg-gray-100 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                              <circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </>
                )}
              </tbody>
            </table>
          </div>
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
        <DistributionGroupModal onConfirm={handleAddDistributionGroup} onCancel={() => setShowGroupModal(false)} />
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
          initial={{ group_name: editTarget.group_name ?? "", email: editTarget.email ?? "", notes: editTarget.notes ?? "" }}
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
