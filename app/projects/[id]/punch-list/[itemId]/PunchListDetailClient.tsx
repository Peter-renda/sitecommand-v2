"use client";

import { useState, useEffect, useRef } from "react";
import ProjectNav from "@/components/ProjectNav";
import ReportFieldsSection, { type ReportFieldValues } from "@/components/ReportFieldsSection";
import { PUNCH_ITEM_REPORT_FIELDS } from "@/lib/report-fields";

type DirContact = { id: string; name: string; email: string | null };
type DirectoryContact = {
  id: string;
  type: string;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  group_name: string | null;
  email: string | null;
};

type PunchListItem = {
  id: string;
  item_number: number;
  title: string;
  status: string;
  punch_item_manager_id: string | null;
  type: string | null;
  assignees: DirContact[];
  due_date: string | null;
  final_approver_id: string | null;
  distribution_list: DirContact[];
  location: string | null;
  priority: string | null;
  trade: string | null;
  reference: string | null;
  schedule_impact: string | null;
  cost_impact: string | null;
  cost_codes: string | null;
  private: boolean;
  description: string | null;
  attachments: { name: string; url: string }[];
  created_by: string | null;
  created_at: string;
};


type EditFormState = {
  title: string;
  status: string;
  priority: string;
  location: string;
  due_date: string;
  description: string;
};

const STATUS_LABELS: Record<string, string> = { open: "Open", in_progress: "In Progress", closed: "Closed" };
const STATUS_COLORS: Record<string, string> = {
  open: "bg-blue-50 text-blue-700",
  in_progress: "bg-amber-50 text-amber-700",
  closed: "bg-gray-100 text-gray-600",
};
const PRIORITY_COLORS: Record<string, string> = {
  Low: "bg-gray-50 text-gray-600",
  Medium: "bg-yellow-50 text-yellow-700",
  High: "bg-red-50 text-red-700",
};

function contactDisplayName(c: DirectoryContact): string {
  if (c.type === "company") return c.company ?? "Unnamed Company";
  if (c.type === "distribution_group") return c.group_name ?? "Unnamed Group";
  return [c.first_name, c.last_name].filter(Boolean).join(" ") || "Unnamed";
}

function getContactNameById(directory: DirectoryContact[], id: string | null): string {
  if (!id) return "—";
  const c = directory.find((x) => x.id === id);
  return c ? contactDisplayName(c) : "—";
}

function formatDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-6">
      <h2 className="text-sm font-semibold text-gray-900 mb-4 pb-3 border-b border-gray-100">{title}</h2>
      {children}
    </div>
  );
}

function exportItemPDF(item: PunchListItem, directory: DirectoryContact[]) {
  const manager = getContactNameById(directory, item.punch_item_manager_id);
  const finalApprover = getContactNameById(directory, item.final_approver_id);
  const assignees = (item.assignees ?? []).map((a) => a.name).join(", ") || "—";
  const distributionList = (item.distribution_list ?? []).map((d) => d.name).join(", ") || "—";

  const fields: Array<[string, string]> = [
    ["Status", STATUS_LABELS[item.status] ?? item.status],
    ["Priority", item.priority ?? "—"],
    ["Type", item.type ?? "—"],
    ["Location", item.location ?? "—"],
    ["Trade", item.trade ?? "—"],
    ["Due Date", formatDate(item.due_date)],
    ["Punch Item Manager", manager],
    ["Final Approver", finalApprover],
    ["Assignees", assignees],
    ["Distribution List", distributionList],
    ["Reference", item.reference ?? "—"],
    ["Schedule Impact", item.schedule_impact ?? "—"],
    ["Cost Impact", item.cost_impact ?? "—"],
    ["Cost Codes", item.cost_codes ?? "—"],
    ["Created", formatDate(item.created_at)],
  ];

  const detailsHtml = fields
    .map(([label, value]) => `<tr><th>${label}</th><td>${String(value).replace(/</g, "&lt;")}</td></tr>`)
    .join("");

  const attachmentsHtml = (item.attachments ?? []).length > 0
    ? `<ul>${item.attachments.map((att) => `<li>${String(att.name).replace(/</g, "&lt;")}</li>`).join("")}</ul>`
    : "<p>No attachments</p>";

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Punch List Item #${item.item_number}</title>
    <style>body{font-family:Arial,sans-serif;font-size:11px;padding:20px;color:#111827;}h1{font-size:18px;margin:0 0 6px;}h2{font-size:13px;margin:20px 0 8px;}p{margin:0 0 8px;}table{width:100%;border-collapse:collapse;}th,td{padding:7px 9px;border-bottom:1px solid #e5e7eb;text-align:left;vertical-align:top;}th{width:180px;background:#f9fafb;font-size:10px;text-transform:uppercase;color:#6b7280;}@media print{body{padding:0;}}</style></head><body>
    <h1>Punch List Item #${item.item_number}</h1>
    <p><strong>${String(item.title).replace(/</g, "&lt;")}</strong></p>
    ${item.description ? `<h2>Description</h2><p>${String(item.description).replace(/</g, "&lt;")}</p>` : ""}
    <h2>Details</h2><table><tbody>${detailsHtml}</tbody></table>
    <h2>Attachments</h2>${attachmentsHtml}
    <script>window.onload=()=>{window.print();}<\/script></body></html>`;

  const win = window.open("", "_blank");
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}

export default function PunchListDetailClient({ projectId, itemId, role, username, userId }: { projectId: string; itemId: string; role: string; username: string; userId: string }) {
  const [item, setItem] = useState<PunchListItem | null>(null);
  const [directory, setDirectory] = useState<DirectoryContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditFormState | null>(null);
  const [editReportFields, setEditReportFields] = useState<ReportFieldValues>({});
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([
      fetch(`/api/projects/${projectId}/punch-list/${itemId}`),
      fetch(`/api/projects/${projectId}/directory`),
    ]).then(async ([itemRes, dirRes]) => {
      if (!itemRes.ok) { setNotFound(true); setLoading(false); return; }
      const [itemData, dirData] = await Promise.all([itemRes.json(), dirRes.json()]);
      setItem(itemData);
      setDirectory(Array.isArray(dirData) ? dirData : []);
      setLoading(false);
    });
  }, [projectId, itemId]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowActions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }

  function openEditModal() {
    if (!item) return;
    setEditForm({
      title: item.title,
      status: item.status,
      priority: item.priority ?? "",
      location: item.location ?? "",
      due_date: item.due_date ?? "",
      description: item.description ?? "",
    });
    setEditReportFields((item as { report_fields?: ReportFieldValues }).report_fields ?? {});
    setFormError(null);
    setShowEditModal(true);
    setShowActions(false);
  }

  async function submitEdit() {
    if (!item || !editForm) return;
    const title = editForm.title.trim();
    if (!title) {
      setFormError("Title is required.");
      return;
    }

    setSaving(true);
    setFormError(null);
    const res = await fetch(`/api/projects/${projectId}/punch-list/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        status: editForm.status,
        priority: editForm.priority || null,
        location: editForm.location || null,
        due_date: editForm.due_date || null,
        description: editForm.description || null,
        report_fields: editReportFields,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setFormError(data.error || "Failed to update punch list item.");
      setSaving(false);
      return;
    }

    const updated: PunchListItem = await res.json();
    setItem(updated);
    setShowEditModal(false);
    setSaving(false);
  }

  async function handleDelete() {
    if (!item) return;
    const confirmed = window.confirm("Move this punch list item to the Recycle Bin?");
    if (!confirmed) return;

    const res = await fetch(`/api/projects/${projectId}/punch-list/${item.id}`, { method: "DELETE" });
    if (!res.ok) {
      window.alert("Failed to delete item.");
      return;
    }
    window.location.href = `/projects/${projectId}/punch-list`;
  }

  async function handleToggleClosed() {
    if (!item) return;
    const nextStatus = item.status === "closed" ? "open" : "closed";

    setSaving(true);
    const res = await fetch(`/api/projects/${projectId}/punch-list/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });

    if (!res.ok) {
      setSaving(false);
      window.alert(`Failed to ${nextStatus === "closed" ? "close" : "reopen"} item.`);
      return;
    }

    const updated: PunchListItem = await res.json();
    setItem(updated);
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F9FAFB]">
        <header className="bg-[#F9FAFB] border-b border-black/[0.06] px-6 h-14 flex items-center justify-between">
          <a href="/dashboard" className="text-[15px] font-semibold text-[color:var(--ink)]">SiteCommand</a>
          <span className="text-sm text-gray-400">{username}</span>
        </header>
        <main className="max-w-4xl mx-auto px-6 py-8"><p className="text-sm text-gray-400">Loading...</p></main>
      </div>
    );
  }

  if (notFound || !item) {
    return (
      <div className="min-h-screen bg-[#F9FAFB]">
        <header className="bg-[#F9FAFB] border-b border-black/[0.06] px-6 h-14 flex items-center justify-between">
          <a href="/dashboard" className="text-[15px] font-semibold text-[color:var(--ink)]">SiteCommand</a>
        </header>
        <main className="max-w-4xl mx-auto px-6 py-8"><p className="text-sm text-gray-500">Item not found.</p></main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <header className="bg-[#F9FAFB] border-b border-black/[0.06] px-6 h-14 flex items-center justify-between">
        <a href="/dashboard" className="text-[15px] font-semibold text-[color:var(--ink)] hover:text-gray-600 transition-colors">SiteCommand</a>
        <div className="flex items-center gap-5">
          <span className="text-sm text-gray-400">{username}</span>
          <button onClick={handleLogout} className="text-sm text-gray-400 hover:text-gray-900 transition-colors">Logout</button>
        </div>
      </header>

      <ProjectNav projectId={projectId} />

      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <a href={`/projects/${projectId}/punch-list`} className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            Punch List
          </a>
          <div className="flex items-center gap-2" ref={menuRef}>
            <button
              type="button"
              onClick={handleToggleClosed}
              disabled={saving}
              className="px-3 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-md bg-white hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {item.status === "closed" ? "Reopen" : "Close"}
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowActions((prev) => !prev)}
                className="inline-flex items-center justify-center p-2 text-gray-500 hover:text-gray-700 border border-gray-200 rounded-md bg-white hover:bg-gray-50"
                aria-label="More actions"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M10 6a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm0 5.5a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm0 5.5a1.5 1.5 0 110-3 1.5 1.5 0 010 3z" /></svg>
              </button>
              {showActions && (
                <div className="absolute right-0 mt-2 w-44 bg-white border border-gray-200 rounded-md shadow-lg z-20 py-1">
                  <button
                    type="button"
                    onClick={() => { exportItemPDF(item, directory); setShowActions(false); }}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Export PDF
                  </button>
                  <button
                    type="button"
                    onClick={openEditModal}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* Header */}
          <div className="bg-white border border-gray-100 rounded-xl p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">
                  Item #{item.item_number}
                  {item.type && <span className="ml-2 text-gray-400">· {item.type}</span>}
                  {item.private && <span className="ml-2 px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded text-xs">Private</span>}
                </p>
                <h1 className="font-display text-[24px] leading-tight text-[color:var(--ink)]">{item.title}</h1>
                {item.location && <p className="text-sm text-gray-500 mt-1">{item.location}</p>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {item.priority && (
                  <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${PRIORITY_COLORS[item.priority] ?? "bg-gray-50 text-gray-600"}`}>{item.priority}</span>
                )}
                <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[item.status] ?? "bg-gray-100 text-gray-600"}`}>
                  {STATUS_LABELS[item.status] ?? item.status}
                </span>
              </div>
            </div>
          </div>

          {/* Description */}
          {item.description && (
            <Section title="Description">
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{item.description}</p>
            </Section>
          )}

          {/* Attachments */}
          <Section title="Attachments">
            {(item.attachments ?? []).length === 0 ? (
              <p className="text-sm text-gray-400">No attachments</p>
            ) : (
              <ul className="space-y-2">
                {item.attachments.map((att, i) => (
                  <li key={i}>
                    <a href={att.url} target="_blank" rel="noopener noreferrer" className="text-sm text-gray-700 hover:text-gray-900 underline flex items-center gap-2">
                      <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                      {att.name}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* General Info */}
          <Section title="General Information">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">Punch Item Manager</dt>
                <dd className="mt-0.5 text-gray-900">{getContactNameById(directory, item.punch_item_manager_id)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">Final Approver</dt>
                <dd className="mt-0.5 text-gray-900">{getContactNameById(directory, item.final_approver_id)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">Trade</dt>
                <dd className="mt-0.5 text-gray-900">{item.trade || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">Due Date</dt>
                <dd className="mt-0.5 text-gray-900">{formatDate(item.due_date)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">Reference</dt>
                <dd className="mt-0.5 text-gray-900">{item.reference || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">Schedule Impact</dt>
                <dd className="mt-0.5 text-gray-900">{item.schedule_impact || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">Cost Impact</dt>
                <dd className="mt-0.5 text-gray-900">{item.cost_impact || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">Cost Codes</dt>
                <dd className="mt-0.5 text-gray-900">{item.cost_codes || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">Created</dt>
                <dd className="mt-0.5 text-gray-900">{formatDate(item.created_at)}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">Assignees</dt>
                <dd className="mt-0.5 text-gray-900">{(item.assignees ?? []).map((a) => a.name).join(", ") || "—"}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">Distribution List</dt>
                <dd className="mt-0.5 text-gray-900">{(item.distribution_list ?? []).map((d) => d.name).join(", ") || "—"}</dd>
              </div>
            </dl>
          </Section>
        </div>
      </main>

      {showEditModal && editForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4 py-6">
          <div className="bg-white rounded-xl w-full max-w-xl shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900">Edit Punch List Item</h2>
              <button type="button" onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Title <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={editForm.title}
                  onChange={(e) => setEditForm((prev) => prev ? { ...prev, title: e.target.value } : prev)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm((prev) => prev ? { ...prev, status: e.target.value } : prev)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
                  >
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Priority</label>
                  <select
                    value={editForm.priority}
                    onChange={(e) => setEditForm((prev) => prev ? { ...prev, priority: e.target.value } : prev)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
                  >
                    <option value="">—</option>
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Location</label>
                  <input
                    type="text"
                    value={editForm.location}
                    onChange={(e) => setEditForm((prev) => prev ? { ...prev, location: e.target.value } : prev)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Due Date</label>
                  <input
                    type="date"
                    value={editForm.due_date}
                    onChange={(e) => setEditForm((prev) => prev ? { ...prev, due_date: e.target.value } : prev)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
                <textarea
                  rows={4}
                  value={editForm.description}
                  onChange={(e) => setEditForm((prev) => prev ? { ...prev, description: e.target.value } : prev)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
                />
              </div>
              <ReportFieldsSection
                title="Report Fields"
                description="Extra punch item attributes surfaced as columns in 360 Reports."
                fields={PUNCH_ITEM_REPORT_FIELDS}
                values={editReportFields}
                onChange={(key, value) => setEditReportFields((prev) => ({ ...prev, [key]: value }))}
                columns={2}
              />
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                {formError && <p className="mr-auto text-sm text-red-600">{formError}</p>}
                <button type="button" onClick={() => setShowEditModal(false)} className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors">Cancel</button>
                <button type="button" onClick={submitEdit} disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-md hover:bg-gray-700 transition-colors disabled:opacity-50">
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
