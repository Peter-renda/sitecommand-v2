"use client";

import { useState, useEffect, useRef } from "react";
import ProjectNav from "@/components/ProjectNav";

// ── Types ─────────────────────────────────────────────────────────────────────

type Milestone = {
  id: string;
  project_id: string;
  title: string;
  category: string;
  status: string;
  due_date: string | null;
  assigned_to: string | null;
  notes: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { value: "permits", label: "Permits" },
  { value: "design", label: "Design" },
  { value: "entitlements", label: "Entitlements" },
  { value: "subcontracts", label: "Subcontracts" },
  { value: "financing", label: "Financing" },
  { value: "general", label: "General" },
];

const STATUSES = ["not_started", "in_progress", "complete", "blocked"] as const;

const STATUS_NEXT: Record<string, string> = {
  not_started: "in_progress",
  in_progress: "complete",
  complete: "not_started",
  blocked: "not_started",
};

const STATUS_PILL: Record<string, string> = {
  not_started: "pill-warn",
  in_progress: "pill-open",
  complete: "pill-post",
  blocked: "pill-alert",
};

const STATUS_LABELS: Record<string, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  complete: "Complete",
  blocked: "Blocked",
};

const DEFAULT_MILESTONES: { title: string; category: string }[] = [
  // Permits
  { title: "Submit Building Permit Application", category: "permits" },
  { title: "Receive Building Permit", category: "permits" },
  { title: "Submit Grading Permit", category: "permits" },
  { title: "Receive Grading Permit", category: "permits" },
  // Design
  { title: "Schematic Design Complete", category: "design" },
  { title: "Design Development Complete", category: "design" },
  { title: "Construction Documents 50%", category: "design" },
  { title: "Construction Documents 100%", category: "design" },
  { title: "Architect Sign-off", category: "design" },
  // Entitlements
  { title: "Planning Commission Approval", category: "entitlements" },
  { title: "Environmental Review Complete", category: "entitlements" },
  { title: "Zoning Variance (if needed)", category: "entitlements" },
  // Subcontracts
  { title: "Subcontractor Bid Packages Issued", category: "subcontracts" },
  { title: "Bids Received & Leveled", category: "subcontracts" },
  { title: "Subcontracts Awarded", category: "subcontracts" },
  // Financing
  { title: "Construction Loan Approved", category: "financing" },
  { title: "Equity Committed", category: "financing" },
  { title: "Initial Draw Processed", category: "financing" },
];

// ── Add Milestone Modal ───────────────────────────────────────────────────────

function AddMilestoneModal({
  onConfirm,
  onCancel,
}: {
  onConfirm: (data: {
    title: string;
    category: string;
    due_date: string;
    assigned_to: string;
    notes: string;
  }) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("general");
  const [dueDate, setDueDate] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [notes, setNotes] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    onConfirm({ title, category, due_date: dueDate, assigned_to: assignedTo, notes });
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4 py-6 overflow-y-auto">
      <div className="bg-white rounded-xl w-full max-w-md shadow-xl my-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/[0.06]">
          <h2 className="font-display text-[20px] leading-tight text-[color:var(--ink)]">Add Milestone</h2>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              placeholder="Milestone title"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Assigned To</label>
              <input
                type="text"
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                placeholder="Name"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
              placeholder="Optional notes..."
            />
          </div>

          <div className="flex gap-3 justify-end pt-1">
            <button type="button" onClick={onCancel} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Add Milestone
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Notes Tooltip ─────────────────────────────────────────────────────────────

function NotesPopover({ notes }: { notes: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen((o) => !o)}
        className="text-gray-400 hover:text-gray-600 transition-colors"
        title="View notes"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-6 z-30 w-56 bg-white border border-gray-200 rounded-lg shadow-lg p-3">
          <p className="text-xs text-gray-700 whitespace-pre-wrap">{notes}</p>
        </div>
      )}
    </div>
  );
}

// ── Inline Editable Cell ──────────────────────────────────────────────────────

function InlineText({
  value,
  placeholder,
  onSave,
  className,
}: {
  value: string;
  placeholder?: string;
  onSave: (v: string) => void;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  function commit() {
    setEditing(false);
    if (draft.trim() !== value) onSave(draft.trim());
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") { setDraft(value); setEditing(false); }
        }}
        className="w-full px-1 py-0.5 text-sm border border-blue-400 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
      />
    );
  }

  return (
    <span
      onClick={() => { setDraft(value); setEditing(true); }}
      className={`cursor-text hover:bg-[color:var(--surface-sunken)] rounded px-1 py-0.5 -mx-1 ${className ?? ""}`}
      title="Click to edit"
    >
      {value || <span className="text-gray-300">{placeholder ?? "—"}</span>}
    </span>
  );
}

function InlineDate({
  value,
  onSave,
}: {
  value: string | null;
  onSave: (v: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function commit() {
    setEditing(false);
    const newVal = draft || null;
    if (newVal !== value) onSave(newVal);
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="date"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") { setDraft(value ?? ""); setEditing(false); }
        }}
        className="px-1 py-0.5 text-xs border border-blue-400 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
      />
    );
  }

  return (
    <span
      onClick={() => { setDraft(value ?? ""); setEditing(true); }}
      className="cursor-text hover:bg-[color:var(--surface-sunken)] rounded px-1 py-0.5 -mx-1 text-xs text-gray-500"
      title="Click to edit"
    >
      {value
        ? new Date(value + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
        : <span className="text-gray-300">—</span>}
    </span>
  );
}

// ── Milestone Row ─────────────────────────────────────────────────────────────

const IDX_STATUS: Record<string, string> = {
  not_started: "draft",
  in_progress: "open",
  complete: "answered",
  blocked: "open",
};

function MilestoneRow({
  milestone,
  index,
  projectId,
  onUpdate,
  onDelete,
}: {
  milestone: Milestone;
  index: number;
  projectId: string;
  onUpdate: (updated: Milestone) => void;
  onDelete: (id: string) => void;
}) {
  const [saving, setSaving] = useState(false);

  async function patch(fields: Partial<Milestone>) {
    setSaving(true);
    const res = await fetch(`/api/projects/${projectId}/preconstruction/${milestone.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    });
    if (res.ok) {
      const updated = await res.json();
      onUpdate(updated);
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!confirm("Delete this milestone?")) return;
    const res = await fetch(`/api/projects/${projectId}/preconstruction/${milestone.id}`, {
      method: "DELETE",
    });
    if (res.ok) onDelete(milestone.id);
  }

  function cycleStatus() {
    patch({ status: STATUS_NEXT[milestone.status] ?? "not_started" });
  }

  return (
    <tr className={`border-b border-black/[0.05] hover:bg-[color:var(--surface-sunken)] transition-colors last:border-b-0 ${saving ? "opacity-60" : ""}`}>
      {/* Checkbox / status toggle */}
      <td className="px-4 py-3 w-10">
        <button
          onClick={cycleStatus}
          className="flex items-center justify-center w-5 h-5 rounded border-2 transition-colors focus:outline-none"
          style={{
            borderColor: milestone.status === "complete" ? "#16a34a" : milestone.status === "blocked" ? "#dc2626" : milestone.status === "in_progress" ? "#2563eb" : "#d1d5db",
            backgroundColor: milestone.status === "complete" ? "#16a34a" : "transparent",
          }}
          title={`Status: ${STATUS_LABELS[milestone.status]} — click to cycle`}
        >
          {milestone.status === "complete" && (
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
          {milestone.status === "blocked" && (
            <svg className="w-3 h-3 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
          {milestone.status === "in_progress" && (
            <div className="w-2 h-2 rounded-full bg-blue-500" />
          )}
        </button>
      </td>

      {/* Index */}
      <td className="px-2 py-3 w-10">
        <span className={`idx-italic ${IDX_STATUS[milestone.status] ?? "draft"}`}>
          {String(index + 1).padStart(2, "0")}
        </span>
      </td>

      {/* Title */}
      <td className="px-4 py-3">
        <InlineText
          value={milestone.title}
          placeholder="Untitled milestone"
          onSave={(v) => { if (v) patch({ title: v }); }}
          className="text-sm font-medium text-[color:var(--ink)]"
        />
      </td>

      {/* Status badge */}
      <td className="px-4 py-3 w-32">
        <span className={`pill ${STATUS_PILL[milestone.status] ?? "pill-warn"}`}>
          {STATUS_LABELS[milestone.status] ?? milestone.status}
        </span>
      </td>

      {/* Due date */}
      <td className="px-4 py-3 w-36">
        <InlineDate
          value={milestone.due_date}
          onSave={(v) => patch({ due_date: v ?? undefined })}
        />
      </td>

      {/* Assigned to */}
      <td className="px-4 py-3 w-36">
        <InlineText
          value={milestone.assigned_to ?? ""}
          placeholder="Assign..."
          onSave={(v) => patch({ assigned_to: v || null })}
          className="text-sm text-gray-600"
        />
      </td>

      {/* Notes */}
      <td className="px-4 py-3 w-12 text-center">
        {milestone.notes ? (
          <NotesPopover notes={milestone.notes} />
        ) : (
          <span className="text-gray-200">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
            </svg>
          </span>
        )}
      </td>

      {/* Delete */}
      <td className="px-4 py-3 w-10">
        <button
          onClick={handleDelete}
          className="text-gray-300 hover:text-red-500 transition-colors"
          title="Delete milestone"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </td>
    </tr>
  );
}

// ── Category Section ──────────────────────────────────────────────────────────

function CategorySection({
  category,
  label,
  milestones,
  projectId,
  onUpdate,
  onDelete,
}: {
  category: string;
  label: string;
  milestones: Milestone[];
  projectId: string;
  onUpdate: (updated: Milestone) => void;
  onDelete: (id: string) => void;
}) {
  const completeCount = milestones.filter((m) => m.status === "complete").length;

  return (
    <div className="mb-8">
      {/* Category header */}
      <div className="flex items-baseline gap-3 mb-2.5">
        <h3 className="h3-warm flex-1">{label}</h3>
        <span className="text-xs text-gray-400">
          <span className="num text-[color:var(--ink)]">{completeCount}</span> of{" "}
          <span className="num text-[color:var(--ink)]">{milestones.length}</span> complete
        </span>
      </div>

      {/* Rows */}
      <div className="bg-white border border-black/[0.06] rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-black/[0.06]">
              <th className="px-4 py-2 w-10" />
              <th className="px-2 py-2 w-10 mono-label text-left">#</th>
              <th className="px-4 py-2 mono-label text-left">Milestone</th>
              <th className="px-4 py-2 w-32 mono-label text-left">Status</th>
              <th className="px-4 py-2 w-36 mono-label text-left">Due Date</th>
              <th className="px-4 py-2 w-36 mono-label text-left">Assigned To</th>
              <th className="px-4 py-2 w-12 mono-label text-center">Notes</th>
              <th className="px-4 py-2 w-10" />
            </tr>
          </thead>
          <tbody>
            {milestones.map((m, i) => (
              <MilestoneRow
                key={m.id}
                milestone={m}
                index={i}
                projectId={projectId}
                onUpdate={onUpdate}
                onDelete={onDelete}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function PreconstructionClient({
  projectId,
  role,
  username,
}: {
  projectId: string;
  role: string;
  username: string;
}) {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [loadingTemplate, setLoadingTemplate] = useState(false);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/preconstruction`)
      .then((r) => r.json())
      .then((data) => {
        setMilestones(Array.isArray(data) ? data : []);
        setLoading(false);
      });
  }, [projectId]);

  // Stats
  const total = milestones.length;
  const complete = milestones.filter((m) => m.status === "complete").length;
  const inProgress = milestones.filter((m) => m.status === "in_progress").length;
  const blocked = milestones.filter((m) => m.status === "blocked").length;
  const pct = total > 0 ? Math.round((complete / total) * 100) : 0;

  // Group by category
  const byCategory = CATEGORIES.map((cat) => ({
    ...cat,
    milestones: milestones.filter((m) => m.category === cat.value),
  })).filter((g) => g.milestones.length > 0);

  async function handleAdd(data: {
    title: string;
    category: string;
    due_date: string;
    assigned_to: string;
    notes: string;
  }) {
    setShowAdd(false);
    const res = await fetch(`/api/projects/${projectId}/preconstruction`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: data.title,
        category: data.category,
        due_date: data.due_date || null,
        assigned_to: data.assigned_to || null,
        notes: data.notes || null,
        sort_order: milestones.length,
      }),
    });
    if (res.ok) {
      const created: Milestone = await res.json();
      setMilestones((prev) => [...prev, created]);
    }
  }

  async function handleLoadTemplate() {
    setLoadingTemplate(true);
    const created: Milestone[] = [];
    for (let i = 0; i < DEFAULT_MILESTONES.length; i++) {
      const m = DEFAULT_MILESTONES[i];
      const res = await fetch(`/api/projects/${projectId}/preconstruction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: m.title, category: m.category, sort_order: i }),
      });
      if (res.ok) created.push(await res.json());
    }
    setMilestones(created);
    setLoadingTemplate(false);
  }

  function handleUpdate(updated: Milestone) {
    setMilestones((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
  }

  function handleDelete(id: string) {
    setMilestones((prev) => prev.filter((m) => m.id !== id));
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      {/* Top header bar */}
      <header className="bg-[#F9FAFB] border-b border-black/[0.06] px-6 h-14 flex items-center justify-between">
        <a href="/dashboard" className="text-sm font-semibold text-gray-900 hover:text-gray-600 transition-colors">
          SiteCommand
        </a>
        <div className="flex items-center gap-5">
          <span className="text-sm text-gray-400">{username}</span>
          <button
            onClick={handleLogout}
            className="text-sm text-gray-400 hover:text-gray-900 transition-colors"
          >
            Logout
          </button>
        </div>
      </header>

      <ProjectNav projectId={projectId} />

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Page header */}
        <div className="flex items-end justify-between mb-6 gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-[32px] leading-[1.05] tracking-[-0.012em] text-[color:var(--ink)]">Preconstruction</h1>
            {!loading && total > 0 && (
              <p className="sec-sub mt-1.5">
                <span className="serif-italic text-[color:var(--brand-700)]">Milestones tracked before breaking ground</span>
                <span className="sep">·</span>
                <span className="num" style={{ color: "var(--brand-500)" }}>{complete}</span> complete
                <span className="sep">·</span>
                <span className="num">{inProgress}</span> in progress
                <span className="sep">·</span>
                <span className="num">{total}</span> total
              </p>
            )}
            {/* Progress bar */}
            <div className="flex items-center gap-3 mt-3 max-w-sm">
              <div className="flex-1 h-2 bg-[color:var(--surface-sunken)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-sm whitespace-nowrap">
                <span className="num text-[color:var(--ink)]">{pct}%</span>{" "}
                <span className="text-gray-400">complete</span>
              </span>
            </div>
          </div>
          <button onClick={() => setShowAdd(true)} className="btn-primary shrink-0">
            Add Milestone
          </button>
        </div>

        {/* Summary stat strip */}
        {!loading && total > 0 && (
          <div className="stats mb-8">
            <div className="stat">
              <div className="lbl">Total Milestones</div>
              <div className="val">{total}</div>
              <div className="delta">{pct}% complete</div>
            </div>
            <div className="stat calm">
              <div className="lbl">Complete</div>
              <div className="val">{complete}</div>
              <div className="delta">of {total} milestones</div>
            </div>
            <div className="stat">
              <div className="lbl">In Progress</div>
              <div className="val">{inProgress}</div>
              <div className="delta">actively underway</div>
            </div>
            <div className={`stat${blocked > 0 ? " alert" : ""}`}>
              <div className="lbl">Blocked</div>
              <div className="val">{blocked}</div>
              <div className="delta">{blocked > 0 ? "needs attention" : "none blocked"}</div>
            </div>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white border border-black/[0.06] rounded-xl p-4 animate-pulse">
                <div className="h-4 bg-[color:var(--surface-sunken)] rounded w-32 mb-3" />
                <div className="space-y-2">
                  {[1, 2, 3].map((j) => (
                    <div key={j} className="h-10 bg-[color:var(--surface-sunken)] rounded" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : milestones.length === 0 ? (
          <div className="bg-white border border-dashed border-black/[0.12] rounded-xl px-6 py-16 flex flex-col items-center text-center">
            <svg
              className="w-12 h-12 text-gray-200 mb-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.25}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
              />
            </svg>
            <h3 className="font-display text-[20px] leading-tight text-[color:var(--ink)] mb-1">No milestones yet</h3>
            <p className="text-sm text-gray-400 mb-6 max-w-xs">
              Start from scratch or load the standard preconstruction template.
            </p>
            <button
              onClick={handleLoadTemplate}
              disabled={loadingTemplate}
              className="btn-secondary inline-flex items-center gap-2 disabled:opacity-50"
            >
              {loadingTemplate ? (
                <>
                  <svg className="w-4 h-4 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Loading template...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Load Default Template
                </>
              )}
            </button>
          </div>
        ) : (
          <>
            {byCategory.map(({ value, label, milestones: catMilestones }) => (
              <CategorySection
                key={value}
                category={value}
                label={label}
                milestones={catMilestones}
                projectId={projectId}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
              />
            ))}
            {/* Milestones with unknown / future categories */}
            {milestones.filter((m) => !CATEGORIES.find((c) => c.value === m.category)).length > 0 && (
              <CategorySection
                key="other"
                category="other"
                label="Other"
                milestones={milestones.filter((m) => !CATEGORIES.find((c) => c.value === m.category))}
                projectId={projectId}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
              />
            )}
          </>
        )}
      </main>

      {/* Add modal */}
      {showAdd && (
        <AddMilestoneModal
          onConfirm={handleAdd}
          onCancel={() => setShowAdd(false)}
        />
      )}
    </div>
  );
}
