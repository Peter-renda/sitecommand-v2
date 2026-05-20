"use client";

import { useState, useEffect, useRef, ChangeEvent } from "react";
import ProjectNav from "@/components/ProjectNav";
import EmptyState from "@/app/components/EmptyState";
import { SkeletonTable } from "@/app/components/Skeleton";
import { Brand } from "@/components/design-system/Primitives";

type DistributionContact = { id: string; name: string; email: string | null };

type Task = {
  id: string;
  task_number: number;
  title: string;
  status: string;
  category: string | null;
  description: string | null;
  photo_url: string | null;
  distribution_list: DistributionContact[];
  assignees: DistributionContact[];
  due_date: string | null;
  is_private: boolean;
  created_at: string;
};

type DirectoryContact = {
  id: string;
  type: string;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  group_name: string | null;
  email: string | null;
};

const STATUSES = ["initiated", "in progress", "ready for review", "closed", "void"];
const CATEGORIES = ["Administrative", "Closeout", "Contract", "Design", "Miscellaneous", "Construction"];

const STATUS_PILL: Record<string, string> = {
  initiated: "pill-open",
  "in progress": "pill-warn",
  "ready for review": "pill-open",
  closed: "pill-post",
  void: "pill-post",
};

// Maps a task status to an idx-italic status modifier (open / answered / closed / draft).
const STATUS_IDX: Record<string, string> = {
  initiated: "open",
  "in progress": "open",
  "ready for review": "answered",
  closed: "closed",
  void: "draft",
};

function TaskStatusPill({ status }: { status: string }) {
  const cls = STATUS_PILL[status] ?? "pill-post";
  return <span className={`pill ${cls} capitalize`}>{status}</span>;
}


// ── Assignee Picker ───────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  "bg-slate-600", "bg-blue-600", "bg-violet-600",
  "bg-rose-600", "bg-amber-600", "bg-teal-600", "bg-emerald-600",
];

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
}

function avatarBg(name: string): string {
  const code = name.charCodeAt(0) + (name.charCodeAt(1) || 0);
  return AVATAR_COLORS[code % AVATAR_COLORS.length];
}

function AssigneePicker({
  directory,
  selected,
  onChange,
}: {
  directory: DirectoryContact[];
  selected: DistributionContact[];
  onChange: (v: DistributionContact[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 50);
  }, [open]);

  const selectedIds = new Set(selected.map((s) => s.id));

  const users = directory.filter((c) => c.type === "user");
  const filtered = users.filter(
    (c) =>
      contactDisplayName(c).toLowerCase().includes(search.toLowerCase()) ||
      (c.email ?? "").toLowerCase().includes(search.toLowerCase())
  );

  function toggle(c: DirectoryContact) {
    const name = contactDisplayName(c);
    if (selectedIds.has(c.id)) {
      onChange(selected.filter((s) => s.id !== c.id));
    } else {
      onChange([...selected, { id: c.id, name, email: c.email }]);
    }
  }

  const label =
    selected.length === 0
      ? "Select Assignees"
      : selected.map((s) => s.name).join(", ");

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2 border border-gray-200 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 text-left"
      >
        <span className={selected.length === 0 ? "text-gray-400" : "text-gray-900 truncate"}>
          {label}
        </span>
        <svg
          className={`w-4 h-4 text-gray-400 shrink-0 ml-2 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Selected chips */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {selected.map((s) => (
            <span key={s.id} className="flex items-center gap-1 pl-2 pr-1.5 py-0.5 bg-gray-100 text-xs text-gray-700 rounded-full">
              {s.name}
              <button
                type="button"
                onClick={() => onChange(selected.filter((x) => x.id !== s.id))}
                className="text-gray-400 hover:text-gray-700 ml-0.5"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Dropdown panel */}
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-30 overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search"
                className="w-full pl-3 pr-8 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>

          {/* List */}
          <div className="max-h-56 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-xs text-gray-400 px-4 py-3">No contacts found</p>
            ) : (
              <>
                <p className="px-4 pt-3 pb-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">Users</p>
                {filtered.map((c) => {
                  const name = contactDisplayName(c);
                  const initials = getInitials(name).toUpperCase();
                  const checked = selectedIds.has(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => toggle(c)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${checked ? "bg-blue-50" : "hover:bg-gray-50"}`}
                    >
                      <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-white text-xs font-semibold shrink-0 ${avatarBg(name)}`}>
                        {initials}
                      </span>
                      <span className="text-sm text-gray-900">{name}</span>
                      {checked && (
                        <svg className="w-4 h-4 text-blue-600 ml-auto shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Distribution Picker ───────────────────────────────────────────────────────

function contactDisplayName(c: DirectoryContact): string {
  if (c.type === "company") return c.company ?? "Unnamed Company";
  if (c.type === "distribution_group") return c.group_name ?? "Unnamed Group";
  return [c.first_name, c.last_name].filter(Boolean).join(" ") || "Unnamed";
}

function DistributionPicker({
  directory,
  selected,
  onChange,
}: {
  directory: DirectoryContact[];
  selected: DistributionContact[];
  onChange: (v: DistributionContact[]) => void;
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const selectedIds = new Set(selected.map((s) => s.id));
  const filtered = directory.filter(
    (c) =>
      c.type === "user" &&
      !selectedIds.has(c.id) &&
      (contactDisplayName(c).toLowerCase().includes(search.toLowerCase()) ||
        (c.email ?? "").toLowerCase().includes(search.toLowerCase()))
  );

  function add(c: DirectoryContact) {
    onChange([...selected, { id: c.id, name: contactDisplayName(c), email: c.email }]);
    setSearch("");
  }

  function remove(id: string) {
    onChange(selected.filter((s) => s.id !== id));
  }

  return (
    <div ref={ref} className="relative">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selected.map((s) => (
            <span key={s.id} className="flex items-center gap-1 pl-2.5 pr-1.5 py-1 bg-gray-100 text-xs text-gray-700 rounded-full">
              {s.name}
              <button type="button" onClick={() => remove(s.id)} className="text-gray-400 hover:text-gray-700 ml-0.5">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        type="text"
        value={search}
        onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="Search directory..."
        className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
      />
      {open && filtered.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-100 rounded-md shadow-lg max-h-40 overflow-y-auto z-20">
          {filtered.map((c) => (
            <button
              key={c.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => add(c)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"
            >
              <span className="font-medium text-gray-900">{contactDisplayName(c)}</span>
              {c.email && <span className="text-gray-400 text-xs">{c.email}</span>}
            </button>
          ))}
        </div>
      )}
      {open && search && filtered.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-100 rounded-md shadow-lg px-3 py-2 z-20">
          <p className="text-xs text-gray-400">No matching contacts</p>
        </div>
      )}
    </div>
  );
}

// ── New Task Modal ────────────────────────────────────────────────────────────

function NewTaskModal({
  nextNumber,
  directory,
  onConfirm,
  onCancel,
}: {
  nextNumber: number;
  directory: DirectoryContact[];
  onConfirm: (data: {
    task_number: number;
    title: string;
    status: string;
    category: string;
    description: string;
    distribution_list: DistributionContact[];
    assignees: DistributionContact[];
    due_date: string;
    is_private: boolean;
    photoFile: File | null;
  }) => void;
  onCancel: () => void;
}) {
  const [taskNumber, setTaskNumber] = useState(nextNumber);
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState("initiated");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [distribution, setDistribution] = useState<DistributionContact[]>([]);
  const [assignees, setAssignees] = useState<DistributionContact[]>([]);
  const [isPrivate, setIsPrivate] = useState(false);
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split("T")[0];
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  function handlePhotoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (ev) => setPhotoPreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setPhotoPreview(null);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    onConfirm({ task_number: taskNumber, title, status, category, description, distribution_list: distribution, assignees, due_date: dueDate, is_private: isPrivate, photoFile });
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4 py-6 overflow-y-auto">
      <div className="bg-white rounded-xl w-full max-w-lg shadow-xl my-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">New Task</h2>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Task number + Title */}
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Task #</label>
              <input
                type="number"
                min={1}
                value={taskNumber}
                onChange={(e) => setTaskNumber(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
            <div className="col-span-3">
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                placeholder="Task title"
                autoFocus
              />
            </div>
          </div>

          {/* Status + Category */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white capitalize"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s} className="capitalize">{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
              >
                <option value="">Select category...</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Due date */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Due Date</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
            />
          </div>

          {/* Assignees */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Assignee(s)</label>
            <AssigneePicker
              directory={directory}
              selected={assignees}
              onChange={setAssignees}
            />
          </div>

          {/* Distribution list */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Distribution List</label>
            <DistributionPicker
              directory={directory}
              selected={distribution}
              onChange={setDistribution}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
              placeholder="Add a description..."
            />
          </div>

          {/* File attachment */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Attachment</label>
            <input
              ref={photoInputRef}
              type="file"
              className="hidden"
              onChange={handlePhotoChange}
            />
            {photoFile ? (
              <div className="relative">
                {photoPreview ? (
                  <img src={photoPreview} alt="Preview" className="w-full h-40 object-cover rounded-lg border border-gray-200" />
                ) : (
                  <div className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg bg-gray-50">
                    <svg className="w-6 h-6 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                    <span className="text-sm text-gray-700 truncate">{photoFile.name}</span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => { setPhotoFile(null); setPhotoPreview(null); if (photoInputRef.current) photoInputRef.current.value = ""; }}
                  className="absolute top-2 right-2 w-6 h-6 bg-white rounded-full shadow flex items-center justify-center text-gray-500 hover:text-gray-900 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                className="w-full flex flex-col items-center justify-center gap-2 py-6 border-2 border-dashed border-gray-200 rounded-lg text-gray-400 hover:border-gray-300 hover:text-gray-500 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
                <span className="text-xs">Click to attach a file</span>
              </button>
            )}
          </div>

          {/* Private toggle */}
          <div>
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
              />
              <span className="text-sm">
                <span className="font-medium text-gray-900">Private</span>
                <span className="block text-xs text-gray-500 mt-0.5">
                  Only make visible to Assignees, Distribution List members, and Task Creator.
                </span>
              </span>
            </label>
          </div>

          <div className="flex gap-3 justify-end pt-1">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-md hover:bg-gray-700 transition-colors"
            >
              Create Task
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Task Detail Modal (view/edit) ─────────────────────────────────────────────

function TaskDetailModal({
  task,
  directory,
  projectId,
  onUpdate,
  onClose,
}: {
  task: Task;
  directory: DirectoryContact[];
  projectId: string;
  onUpdate: (updated: Task) => void;
  onClose: () => void;
}) {
  const [status, setStatus] = useState(task.status);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    const res = await fetch(`/api/projects/${projectId}/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      const updated = await res.json();
      onUpdate({ ...task, status: updated.status });
    }
    setSaving(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4 py-6 overflow-y-auto">
      <div className="bg-white rounded-xl w-full max-w-lg shadow-xl my-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <p className="text-xs text-gray-400 font-medium">Task #{task.task_number}</p>
            <h2 className="text-sm font-semibold text-gray-900 mt-0.5">{task.title}</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Read-only info */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            {task.category && (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">Category</p>
                <p className="text-gray-700">{task.category}</p>
              </div>
            )}
            {task.due_date && (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">Due Date</p>
                <p className="text-gray-700">
                  {new Date(task.due_date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </p>
              </div>
            )}
          </div>

          {task.description && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">Description</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{task.description}</p>
            </div>
          )}

          {(task.distribution_list ?? []).length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">Distribution List</p>
              <p className="text-sm text-gray-700">{task.distribution_list.map((d) => d.name).join(", ")}</p>
            </div>
          )}

          {task.photo_url && (
            <img src={task.photo_url} alt="Task photo" className="w-full h-36 object-cover rounded-lg border border-gray-200" />
          )}

          {/* Status (only editable field) */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-3 justify-end pt-1">
            <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-md hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Export helpers ────────────────────────────────────────────────────────────

function exportCSV(tasks: Task[], projectId: string) {
  const headers = ["Task #", "Title", "Status", "Category", "Due Date", "Distribution", "Description", "Created"];
  const rows = tasks.map((t) => [
    t.task_number,
    t.title,
    t.status,
    t.category ?? "",
    t.due_date ? new Date(t.due_date + "T12:00:00").toLocaleDateString() : "",
    (t.distribution_list ?? []).map((d) => d.name).join("; "),
    (t.description ?? "").replace(/\n/g, " "),
    new Date(t.created_at).toLocaleDateString(),
  ]);

  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `tasks-${projectId}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportPDF(tasks: Task[]) {
  const rows = tasks
    .map(
      (t) => `
      <tr>
        <td>${t.task_number}</td>
        <td>${t.title}</td>
        <td>${t.status}</td>
        <td>${t.category ?? "—"}</td>
        <td>${t.due_date ? new Date(t.due_date + "T12:00:00").toLocaleDateString() : "—"}</td>
        <td>${(t.distribution_list ?? []).map((d) => d.name).join(", ") || "—"}</td>
        <td>${t.description ?? "—"}</td>
        <td>${new Date(t.created_at).toLocaleDateString()}</td>
      </tr>`
    )
    .join("");

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Tasks</title>
    <style>
      body { font-family: Arial, sans-serif; font-size: 11px; padding: 20px; }
      h1 { font-size: 16px; margin-bottom: 16px; }
      table { width: 100%; border-collapse: collapse; }
      th { background: #f3f4f6; text-align: left; padding: 8px 10px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; }
      td { padding: 8px 10px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
      @media print { body { padding: 0; } }
    </style></head><body>
    <h1>Tasks</h1>
    <table>
      <thead><tr><th>#</th><th>Title</th><th>Status</th><th>Category</th><th>Due Date</th><th>Distribution</th><th>Description</th><th>Created</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <script>window.onload = () => { window.print(); }<\/script>
    </body></html>`;

  const win = window.open("", "_blank");
  if (win) { win.document.write(html); win.document.close(); }
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function TasksClient({
  projectId,
  role,
  username,
}: {
  projectId: string;
  role: string;
  username: string;
}) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [directory, setDirectory] = useState<DirectoryContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [sendingTaskId, setSendingTaskId] = useState<string | null>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  // Click-outside for export menu
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setShowExportMenu(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    Promise.all([
      fetch(`/api/projects/${projectId}/tasks`).then((r) => r.json()),
      fetch(`/api/projects/${projectId}/directory`).then((r) => r.json()),
    ]).then(([tasksData, dirData]) => {
      setTasks(Array.isArray(tasksData) ? tasksData : []);
      setDirectory(Array.isArray(dirData) ? dirData : []);
      setLoading(false);
    });
  }, [projectId]);

  const validNums = tasks.map((t) => Number(t.task_number)).filter((n) => Number.isFinite(n));
  const nextNumber = validNums.length > 0 ? Math.max(...validNums) + 1 : 1;

  // Live headline metrics
  const openCount = tasks.filter((t) => t.status === "initiated" || t.status === "in progress").length;
  const reviewCount = tasks.filter((t) => t.status === "ready for review").length;
  const closedCount = tasks.filter((t) => t.status === "closed").length;
  const todayStr = new Date().toISOString().split("T")[0];
  const overdueCount = tasks.filter(
    (t) => t.due_date != null && t.due_date < todayStr && t.status !== "closed" && t.status !== "void"
  ).length;

  async function handleCreate(data: {
    task_number: number;
    title: string;
    status: string;
    category: string;
    description: string;
    distribution_list: DistributionContact[];
    assignees: DistributionContact[];
    due_date: string;
    is_private: boolean;
    photoFile: File | null;
  }) {
    setShowNew(false);
    setCreating(true);

    const res = await fetch(`/api/projects/${projectId}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        task_number: data.task_number,
        title: data.title,
        status: data.status,
        category: data.category || null,
        description: data.description || null,
        distribution_list: data.distribution_list,
        assignees: data.assignees,
        due_date: data.due_date || null,
        is_private: data.is_private,
      }),
    });

    if (res.ok) {
      const newTask: Task = await res.json();
      newTask.distribution_list = data.distribution_list;
      newTask.assignees = data.assignees;

      // Upload photo if provided
      if (data.photoFile) {
        const formData = new FormData();
        formData.append("photo", data.photoFile);
        const photoRes = await fetch(`/api/projects/${projectId}/tasks/${newTask.id}/photo`, {
          method: "POST",
          body: formData,
        });
        if (photoRes.ok) {
          const photoData = await photoRes.json();
          newTask.photo_url = photoData.photo_url;
        }
      }

      setTasks((prev) => [...prev, newTask]);
    }

    setCreating(false);
  }

  async function handleSendTask(taskId: string) {
    setSendingTaskId(taskId);
    await fetch(`/api/projects/${projectId}/tasks/${taskId}/send`, { method: "POST" });
    setSendingTaskId(null);
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }

  return (
    <div className="min-h-screen bg-[#FAFAF7]">
      {/* Header */}
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

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Title + actions */}
        <div className="flex items-end justify-between mb-6 gap-4 flex-wrap">
          <div>
            <h1 className="font-display text-[32px] leading-[1.05] tracking-[-0.012em] text-[color:var(--ink)]">Tasks</h1>
            {!loading && tasks.length > 0 && (
              <p className="sec-sub mt-1.5">
                <span className="serif-italic text-[color:var(--brand-700)]">Field punch list</span>
                <span className="sep">·</span>
                <span className="num" style={{ color: "var(--brand-500)" }}>{openCount}</span> open
                <span className="sep">·</span>
                <span className="num">{overdueCount}</span> overdue
                <span className="sep">·</span>
                <span className="num">{tasks.length}</span> total
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Export dropdown */}
            <div ref={exportRef} className="relative">
              <button
                onClick={() => setShowExportMenu((o) => !o)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-md bg-white hover:bg-gray-50 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Export
                <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform ${showExportMenu ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showExportMenu && (
                <div className="absolute right-0 mt-2 w-44 bg-white border border-gray-100 rounded-xl shadow-lg py-1 z-20">
                  <button
                    onClick={() => { exportPDF(tasks); setShowExportMenu(false); }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
                  >
                    <svg className="w-4 h-4 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                    </svg>
                    Export as PDF
                  </button>
                  <button
                    onClick={() => { exportCSV(tasks, projectId); setShowExportMenu(false); }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
                  >
                    <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5 4a3 3 0 00-3 3v6a3 3 0 003 3h10a3 3 0 003-3V7a3 3 0 00-3-3H5zm-1 9v-1h5v2H5a1 1 0 01-1-1zm7 1h4a1 1 0 001-1v-1h-5v2zm0-4h5V8h-5v2zM9 8H4v2h5V8z" clipRule="evenodd" />
                    </svg>
                    Export as Excel
                  </button>
                </div>
              )}
            </div>

            {/* New Task */}
            <button
              onClick={() => setShowNew(true)}
              disabled={creating}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-[color:var(--ink)] rounded-md hover:bg-black transition-colors disabled:opacity-50"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              {creating ? "Creating..." : "New Task"}
            </button>
          </div>
        </div>

        {/* Stat strip */}
        {!loading && tasks.length > 0 && (
          <div className="stats mb-6">
            <div className="stat">
              <div className="lbl">Open</div>
              <div className="val">{openCount}</div>
              <div className="delta">Initiated &amp; in progress</div>
            </div>
            <div className={`stat${overdueCount > 0 ? " alert" : ""}`}>
              <div className="lbl">Overdue</div>
              <div className="val">{overdueCount}</div>
              <div className="delta">Past due date</div>
            </div>
            <div className="stat warn">
              <div className="lbl">Ready for Review</div>
              <div className="val">{reviewCount}</div>
              <div className="delta">Awaiting sign-off</div>
            </div>
            <div className="stat calm">
              <div className="lbl">Closed</div>
              <div className="val">{closedCount}</div>
              <div className="delta">Completed tasks</div>
            </div>
          </div>
        )}

        {/* Tasks table */}
        {loading ? (
          <SkeletonTable rows={5} cols={6} />
        ) : tasks.length === 0 ? (
          <div className="bg-white border border-dashed border-gray-200 rounded-xl">
            <EmptyState
              icon={
                <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.25}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              }
              title="No tasks yet"
              description="Click New Task to create the first one."
            />
          </div>
        ) : (
          <div className="bg-white border hairline rounded-xl overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead>
                <tr className="border-b hairline bg-[color:var(--surface-sunken)]">
                  <th className="text-left px-4 py-3 mono-label whitespace-nowrap w-16">#</th>
                  <th className="text-left px-4 py-3 mono-label whitespace-nowrap">Title</th>
                  <th className="text-left px-4 py-3 mono-label whitespace-nowrap">Status</th>
                  <th className="text-left px-4 py-3 mono-label whitespace-nowrap">Category</th>
                  <th className="text-left px-4 py-3 mono-label whitespace-nowrap">Assignees</th>
                  <th className="text-left px-4 py-3 mono-label whitespace-nowrap">Distribution</th>
                  <th className="text-left px-4 py-3 mono-label whitespace-nowrap">Due Date</th>
                  <th className="text-left px-4 py-3 mono-label whitespace-nowrap">Created</th>
                  <th className="px-4 py-3 w-28" />
                </tr>
              </thead>
              <tbody>
                {tasks.map((task) => (
                  <tr
                    key={task.id}
                    onClick={() => window.location.href = `/projects/${projectId}/tasks/${task.id}`}
                    className="border-b border-gray-50 hover:bg-[color:var(--surface-sunken)] transition-colors last:border-b-0 cursor-pointer"
                  >
                    <td className="px-4 py-3">
                      <span className={`idx-italic status-${STATUS_IDX[task.status] ?? "draft"}`}>{String(task.task_number).padStart(3, "0")}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium text-[color:var(--ink)]">{task.title}</span>
                      {task.is_private && (
                        <span className="ml-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-[color:var(--brand-100)] text-[color:var(--brand-700)] text-[10px] font-medium align-middle">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 11c.828 0 1.5-.672 1.5-1.5S12.828 8 12 8s-1.5.672-1.5 1.5S11.172 11 12 11zm6-4V6a6 6 0 10-12 0v1a2 2 0 00-2 2v9a2 2 0 002 2h12a2 2 0 002-2V9a2 2 0 00-2-2z" />
                          </svg>
                          Private
                        </span>
                      )}
                      {task.photo_url && (
                        <svg className="inline-block w-3.5 h-3.5 ml-1.5 text-gray-300 -mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <TaskStatusPill status={task.status} />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{task.category || <span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {(task.assignees ?? []).length > 0
                        ? task.assignees.map((a) => a.name).join(", ")
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {(task.distribution_list ?? []).length > 0
                        ? task.distribution_list.map((d) => d.name).join(", ")
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap tabular-nums">
                      {task.due_date ? (
                        <span className={task.due_date < todayStr && task.status !== "closed" && task.status !== "void" ? "text-[color:var(--brand-600)] font-medium" : "text-gray-500"}>
                          {new Date(task.due_date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap tabular-nums">
                      {new Date(task.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleSendTask(task.id)}
                        disabled={sendingTaskId === task.id}
                        className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 whitespace-nowrap"
                      >
                        {sendingTaskId === task.id ? "Sending..." : "Re-send Task"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* Modals */}
      {showNew && (
        <NewTaskModal
          nextNumber={nextNumber}
          directory={directory}
          onConfirm={handleCreate}
          onCancel={() => setShowNew(false)}
        />
      )}
    </div>
  );
}
