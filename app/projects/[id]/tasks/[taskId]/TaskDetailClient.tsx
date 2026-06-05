"use client";

import { useState, useEffect, useRef } from "react";
import ProjectNav from "@/components/ProjectNav";

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

const STATUS_COLORS: Record<string, string> = {
  initiated: "bg-blue-50 text-blue-700",
  "in progress": "bg-amber-50 text-amber-700",
  "ready for review": "bg-purple-50 text-purple-700",
  closed: "bg-green-50 text-green-700",
  void: "bg-gray-100 text-gray-500",
};


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

export default function TaskDetailClient({
  projectId,
  taskId,
  role,
  username,
}: {
  projectId: string;
  taskId: string;
  role: string;
  username: string;
}) {
  const [task, setTask] = useState<Task | null>(null);
  const [directory, setDirectory] = useState<DirectoryContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [status, setStatus] = useState("open");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [description, setDescription] = useState("");
  const [distributionList, setDistributionList] = useState<DistributionContact[]>([]);
  const [assignees, setAssignees] = useState<DistributionContact[]>([]);
  const [isPrivate, setIsPrivate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`/api/projects/${projectId}/tasks/${taskId}`),
      fetch(`/api/projects/${projectId}/directory`),
    ]).then(async ([taskRes, directoryRes]) => {
      if (!taskRes.ok) { setNotFound(true); setLoading(false); return; }
      const taskData = await taskRes.json();
      const directoryData = directoryRes.ok ? await directoryRes.json() : [];
      setTask(taskData);
      setDirectory(Array.isArray(directoryData) ? directoryData : []);
      setStatus(taskData.status ?? "initiated");
      setTitle(taskData.title ?? "");
      setCategory(taskData.category ?? "");
      setDueDate(taskData.due_date ?? "");
      setDescription(taskData.description ?? "");
      setDistributionList(taskData.distribution_list ?? []);
      setAssignees(taskData.assignees ?? []);
      setIsPrivate(Boolean(taskData.is_private));
      setLoading(false);
    });
  }, [projectId, taskId]);

  function resetEditState(source: Task) {
    setStatus(source.status ?? "initiated");
    setTitle(source.title ?? "");
    setCategory(source.category ?? "");
    setDueDate(source.due_date ?? "");
    setDescription(source.description ?? "");
    setDistributionList(source.distribution_list ?? []);
    setAssignees(source.assignees ?? []);
    setIsPrivate(Boolean(source.is_private));
  }

  async function handleSave() {
    if (!task) return;
    setSaving(true);
    const res = await fetch(`/api/projects/${projectId}/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        status,
        category: category || null,
        due_date: dueDate || null,
        description: description.trim() || null,
        distribution_list: distributionList,
        assignees,
        is_private: isPrivate,
      }),
    });
    if (res.ok) {
      const updated = await res.json();
      setTask(updated);
      resetEditState(updated);
      setIsEditing(false);
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!task) return;
    await fetch(`/api/projects/${projectId}/tasks/${task.id}`, { method: "DELETE" });
    window.location.href = `/projects/${projectId}/tasks`;
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      {/* Header */}
      <header className="bg-[#F9FAFB] border-b border-black/[0.06] px-6 h-14 flex items-center justify-between">
        <a href="/dashboard" className="text-sm font-semibold text-gray-900 hover:text-gray-600 transition-colors">
          SiteCommand
        </a>
        <div className="flex items-center gap-5">
          <span className="text-sm text-gray-400">{username}</span>
          <button onClick={handleLogout} className="text-sm text-gray-400 hover:text-gray-900 transition-colors">Logout</button>
        </div>
      </header>

      <ProjectNav projectId={projectId} />

      <main className="max-w-4xl mx-auto px-6 py-8">
        {loading ? (
          <p className="text-sm text-gray-400">Loading...</p>
        ) : notFound ? (
          <p className="text-sm text-gray-500">Task not found.</p>
        ) : task ? (
          <>
            {/* Back link + actions */}
            <div className="flex items-center justify-between mb-6">
              <a
                href={`/projects/${projectId}/tasks`}
                className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                All Tasks
              </a>
              <div className="flex items-center gap-2">
                {isEditing ? (
                  <>
                    <button
                      onClick={() => {
                        resetEditState(task);
                        setIsEditing(false);
                      }}
                      className="px-3 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      className="px-3 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-md hover:bg-red-50 transition-colors"
                    >
                      Delete
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-md hover:bg-gray-700 transition-colors disabled:opacity-50"
                    >
                      {saving ? "Saving..." : "Save Changes"}
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-md hover:bg-gray-700 transition-colors"
                  >
                    Edit
                  </button>
                )}
              </div>
            </div>

            {/* Task header */}
            <div className="mb-6">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Task #{task.task_number}</p>
              {isEditing ? (
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-md text-2xl font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
                />
              ) : (
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="font-display text-[24px] leading-tight text-[color:var(--ink)]">{task.title}</h1>
                  {isPrivate && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-xs font-medium">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 11c.828 0 1.5-.672 1.5-1.5S12.828 8 12 8s-1.5.672-1.5 1.5S11.172 11 12 11zm6-4V6a6 6 0 10-12 0v1a2 2 0 00-2 2v9a2 2 0 002 2h12a2 2 0 002-2V9a2 2 0 00-2-2z" />
                      </svg>
                      Private
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* Left column */}
              <div className="lg:col-span-2 space-y-5">
                {/* Meta */}
                <div className="bg-white border border-gray-100 rounded-xl p-5 space-y-3">
                  <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Info</h2>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Status</span>
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[status] ?? "bg-gray-100 text-gray-500"}`}>
                        {status}
                      </span>
                    </div>
                    {(assignees ?? []).length > 0 && (
                      <div className="flex flex-col gap-1">
                        <span className="text-gray-400">Assignees</span>
                        <div className="flex flex-wrap gap-1">
                          {assignees.map((a) => (
                            <span key={a.id} className="px-2 py-0.5 bg-gray-100 text-xs text-gray-700 rounded-full">{a.name}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {dueDate && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">Due</span>
                        <span className="text-gray-700 font-medium">
                          {new Date(dueDate + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-gray-400">Created</span>
                      <span className="text-gray-700">
                        {new Date(task.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Editable fields */}
                <div className="bg-white border border-gray-100 rounded-xl p-5">
                  <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Details</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1.5">Status</label>
                      <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                        disabled={!isEditing}
                        className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed"
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1.5">Category</label>
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        disabled={!isEditing}
                        className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed"
                      >
                        <option value="">Select category</option>
                        {CATEGORIES.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1.5">Due Date</label>
                      <input
                        type="date"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        disabled={!isEditing}
                        className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed"
                      />
                    </div>
                  </div>
                  <div className="mt-4">
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Assignees</label>
                    {isEditing ? (
                      <DistributionPicker directory={directory} selected={assignees} onChange={setAssignees} />
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {(assignees ?? []).length > 0
                          ? assignees.map((a) => (
                              <span key={a.id} className="px-2.5 py-1 bg-gray-100 text-xs text-gray-700 rounded-full">{a.name}</span>
                            ))
                          : <p className="text-sm text-gray-500">—</p>}
                      </div>
                    )}
                  </div>
                  {isEditing && (
                    <div className="mt-4">
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
                  )}
                </div>

                {/* Description */}
                <div className="bg-white border border-gray-100 rounded-xl p-5">
                  <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Description</h2>
                  {isEditing ? (
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
                    />
                  ) : (
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{description || "—"}</p>
                  )}
                </div>

                {/* Distribution list */}
                <div className="bg-white border border-gray-100 rounded-xl p-5">
                  <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Distribution List</h2>
                  {isEditing ? (
                    <DistributionPicker directory={directory} selected={distributionList} onChange={setDistributionList} />
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {(distributionList ?? []).length > 0
                        ? distributionList.map((d) => (
                            <span key={d.id} className="px-2.5 py-1 bg-gray-100 text-xs text-gray-700 rounded-full">{d.name}</span>
                          ))
                        : <p className="text-sm text-gray-500">—</p>}
                    </div>
                  )}
                </div>
              </div>

              {/* Right column: photo */}
              <div className="space-y-5">

                {/* Attachment */}
                {task.photo_url && (() => {
                  const url = task.photo_url;
                  const cleanPath = url.split("?")[0].toLowerCase();
                  const isImage = /\.(png|jpe?g|gif|webp|svg|bmp|avif|heic|heif)$/.test(cleanPath);
                  const filename = decodeURIComponent(cleanPath.split("/").pop() ?? "attachment");
                  return (
                    <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
                      {isImage ? (
                        <a href={url} target="_blank" rel="noreferrer">
                          <img src={url} alt="Task attachment" className="w-full h-44 object-cover" />
                        </a>
                      ) : (
                        <a
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors"
                        >
                          <svg className="w-8 h-8 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                          </svg>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Attachment</p>
                            <p className="text-sm text-gray-700 truncate">{filename}</p>
                          </div>
                        </a>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          </>
        ) : null}
      </main>

      {/* Delete confirm */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl w-full max-w-sm shadow-xl p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-2">Delete Task</h2>
            <p className="text-sm text-gray-500 mb-6">
              Are you sure you want to delete <span className="font-medium text-gray-800">Task #{task?.task_number}</span>? This cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
