"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// ───────────────────────────── Types ─────────────────────────────

type Guide = {
  id: string;
  title: string;
  description: string | null;
  filename: string | null;
  fileType: string | null;
  sortOrder: number;
  createdAt: string;
  url: string | null;
  assignmentCount?: number;
};

type MyAssignment = {
  id: string;
  guideId: string;
  title: string;
  description: string | null;
  filename: string | null;
  fileType: string | null;
  dueDate: string | null;
  status: string;
  completedAt: string | null;
  url: string | null;
};

type Member = { id: string; username: string; email: string; company_role: string };

type Assignment = {
  id: string;
  userId: string;
  username: string;
  email: string;
  dueDate: string | null;
  status: string;
  completedAt: string | null;
  createdAt: string;
};

// ───────────────────────────── Helpers ─────────────────────────────

const INPUT_CLASS =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10";

function fileLabel(fileType: string | null, filename: string | null): string {
  const t = (fileType || "").toLowerCase();
  const name = (filename || "").toLowerCase();
  if (t.includes("pdf") || name.endsWith(".pdf")) return "PDF";
  if (t.includes("word") || name.endsWith(".doc") || name.endsWith(".docx")) return "Word";
  if (t.includes("presentation") || name.endsWith(".ppt") || name.endsWith(".pptx")) return "Slides";
  if (t.includes("sheet") || name.endsWith(".xls") || name.endsWith(".xlsx")) return "Sheet";
  if (t.startsWith("image/")) return "Image";
  return "Doc";
}

function formatDate(d: string | null): string {
  if (!d) return "";
  const date = new Date(d.length <= 10 ? `${d}T00:00:00` : d);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function isOverdue(dueDate: string | null, status: string): boolean {
  if (!dueDate || status === "completed") return false;
  const due = new Date(`${dueDate}T23:59:59`);
  return due.getTime() < Date.now();
}

// ───────────────────────────── Component ─────────────────────────────

export default function GuidesClient({
  canManage,
  hasCompany,
}: {
  canManage: boolean;
  hasCompany: boolean;
}) {
  const [guides, setGuides] = useState<Guide[]>([]);
  const [myAssignments, setMyAssignments] = useState<MyAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  // Upload form (managers).
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Inline rename (managers).
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");

  // Assign modal target guide.
  const [assignGuide, setAssignGuide] = useState<Guide | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/training/guides");
      if (res.ok) {
        const d = await res.json();
        setGuides(d.guides ?? []);
        setMyAssignments(d.myAssignments ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleUpload() {
    setError("");
    const title = newTitle.trim();
    const file = fileInputRef.current?.files?.[0];
    if (!title) {
      setError("Give the guide a title.");
      return;
    }
    if (!file) {
      setError("Choose a document to upload.");
      return;
    }
    setUploading(true);
    try {
      const urlRes = await fetch(
        `/api/training/guides/upload-url?filename=${encodeURIComponent(file.name)}`,
      );
      if (!urlRes.ok) {
        setError("Could not start the upload.");
        setUploading(false);
        return;
      }
      const { signedUrl, storagePath } = await urlRes.json();
      const putRes = await fetch(signedUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!putRes.ok) {
        setError("Upload failed.");
        setUploading(false);
        return;
      }
      const res = await fetch("/api/training/guides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: newDesc.trim(),
          storagePath,
          filename: file.name,
          fileType: file.type || "",
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || "Could not save the guide.");
        setUploading(false);
        return;
      }
      setNewTitle("");
      setNewDesc("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      await load();
    } catch {
      setError("Something went wrong during upload.");
    }
    setUploading(false);
  }

  async function saveRename(id: string) {
    const title = editTitle.trim();
    if (!title) return;
    setBusyId(id);
    const res = await fetch(`/api/training/guides/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description: editDesc }),
    });
    setBusyId(null);
    setEditingId(null);
    if (res.ok) await load();
  }

  async function move(id: string, direction: "up" | "down") {
    setBusyId(id);
    const res = await fetch(`/api/training/guides/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ move: direction }),
    });
    setBusyId(null);
    if (res.ok) await load();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this guide? Any assignments will be removed.")) return;
    setBusyId(id);
    const res = await fetch(`/api/training/guides/${id}`, { method: "DELETE" });
    setBusyId(null);
    if (res.ok) await load();
  }

  async function toggleComplete(a: MyAssignment) {
    const nextStatus = a.status === "completed" ? "assigned" : "completed";
    setBusyId(a.id);
    const res = await fetch(`/api/training/guides/assignments/${a.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    setBusyId(null);
    if (res.ok) {
      setMyAssignments((prev) =>
        prev.map((x) =>
          x.id === a.id
            ? { ...x, status: nextStatus, completedAt: nextStatus === "completed" ? new Date().toISOString() : null }
            : x,
        ),
      );
    }
  }

  const outstanding = useMemo(
    () => myAssignments.filter((a) => a.status !== "completed").length,
    [myAssignments],
  );

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Guides</h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-500">
          Company training guides and reference documents.{" "}
          {canManage
            ? "Upload documents below — they're added to the Table of Contents automatically — and assign them to employees with due dates."
            : "Browse the Table of Contents, and complete any guides assigned to you."}
        </p>
      </div>

      {!hasCompany ? (
        <p className="text-sm text-gray-500">
          Guides are available to members of a company. Your account isn&apos;t tied to one.
        </p>
      ) : loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : (
        <div className="space-y-8">
          {/* Assigned to you */}
          {myAssignments.length > 0 && (
            <section>
              <div className="mb-3 flex items-center gap-2">
                <h2 className="text-sm font-semibold text-gray-900">Assigned to you</h2>
                {outstanding > 0 && (
                  <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                    {outstanding} to do
                  </span>
                )}
              </div>
              <div className="space-y-2">
                {myAssignments.map((a) => {
                  const overdue = isOverdue(a.dueDate, a.status);
                  const done = a.status === "completed";
                  return (
                    <div
                      key={a.id}
                      className={`flex items-center justify-between gap-3 rounded-lg border p-3.5 ${
                        done
                          ? "border-gray-200 bg-gray-50"
                          : overdue
                            ? "border-red-200 bg-red-50/50"
                            : "border-gray-200 bg-white"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          {a.url ? (
                            <a
                              href={a.url}
                              target="_blank"
                              rel="noreferrer"
                              className={`truncate text-sm font-medium ${
                                done ? "text-gray-500" : "text-gray-900 hover:underline"
                              }`}
                            >
                              {a.title}
                            </a>
                          ) : (
                            <span className="truncate text-sm font-medium text-gray-900">{a.title}</span>
                          )}
                          <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-500">
                            {fileLabel(a.fileType, a.filename)}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs">
                          {done ? (
                            <span className="text-emerald-600">
                              Completed{a.completedAt ? ` · ${formatDate(a.completedAt)}` : ""}
                            </span>
                          ) : a.dueDate ? (
                            <span className={overdue ? "font-medium text-red-600" : "text-gray-500"}>
                              Due {formatDate(a.dueDate)}
                              {overdue ? " · overdue" : ""}
                            </span>
                          ) : (
                            <span className="text-gray-400">No due date</span>
                          )}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleComplete(a)}
                        disabled={busyId === a.id}
                        className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-medium disabled:opacity-50 ${
                          done
                            ? "border border-gray-200 text-gray-600 hover:bg-gray-100"
                            : "bg-gray-900 text-white hover:bg-gray-800"
                        }`}
                      >
                        {done ? "Reopen" : "Mark complete"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Table of Contents */}
          <section>
            <h2 className="mb-3 text-sm font-semibold text-gray-900">Table of Contents</h2>
            {guides.length === 0 ? (
              <p className="rounded-lg border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-400">
                No guides yet.
                {canManage ? " Upload one below to start the Table of Contents." : ""}
              </p>
            ) : (
              <ol className="overflow-hidden rounded-lg border border-gray-200 bg-white">
                {guides.map((g, idx) => (
                  <li
                    key={g.id}
                    className={`flex items-start gap-3 px-4 py-3 ${
                      idx > 0 ? "border-t border-gray-100" : ""
                    }`}
                  >
                    <span className="mt-0.5 w-6 shrink-0 text-right text-sm tabular-nums text-gray-400">
                      {idx + 1}.
                    </span>
                    <div className="min-w-0 flex-1">
                      {editingId === g.id ? (
                        <div className="space-y-2">
                          <input
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            className={INPUT_CLASS}
                            autoFocus
                          />
                          <input
                            value={editDesc}
                            onChange={(e) => setEditDesc(e.target.value)}
                            placeholder="Description (optional)"
                            className={INPUT_CLASS}
                          />
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => saveRename(g.id)}
                              disabled={busyId === g.id}
                              className="rounded bg-gray-900 px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="rounded px-3 py-1 text-xs text-gray-600 hover:bg-gray-100"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex flex-wrap items-center gap-2">
                            {g.url ? (
                              <a
                                href={g.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-sm font-medium text-gray-900 hover:underline"
                              >
                                {g.title}
                              </a>
                            ) : (
                              <span className="text-sm font-medium text-gray-900">{g.title}</span>
                            )}
                            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-500">
                              {fileLabel(g.fileType, g.filename)}
                            </span>
                            {canManage && (g.assignmentCount ?? 0) > 0 && (
                              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                                Assigned to {g.assignmentCount}
                              </span>
                            )}
                          </div>
                          {g.description && (
                            <p className="mt-0.5 text-xs text-gray-500">{g.description}</p>
                          )}
                        </>
                      )}
                    </div>

                    {canManage && editingId !== g.id && (
                      <div className="flex shrink-0 items-center gap-0.5">
                        <button
                          type="button"
                          title="Move up"
                          onClick={() => move(g.id, "up")}
                          disabled={busyId === g.id || idx === 0}
                          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          title="Move down"
                          onClick={() => move(g.id, "down")}
                          disabled={busyId === g.id || idx === guides.length - 1}
                          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => setAssignGuide(g)}
                          className="rounded px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50"
                        >
                          Assign
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(g.id);
                            setEditTitle(g.title);
                            setEditDesc(g.description ?? "");
                          }}
                          className="rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
                        >
                          Rename
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(g.id)}
                          disabled={busyId === g.id}
                          className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </section>

          {/* Add a guide (managers) */}
          {canManage && (
            <section className="rounded-lg border border-gray-200 p-4 sm:p-5">
              <h2 className="mb-3 text-sm font-semibold text-gray-900">Add a guide</h2>
              {error && <p className="mb-3 text-xs text-red-600">{error}</p>}
              <div className="space-y-3">
                <input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Guide title (e.g. RFI Best Practices)"
                  className={INPUT_CLASS}
                />
                <input
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Short description (optional)"
                  className={INPUT_CLASS}
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,application/pdf"
                  className="block text-sm text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-gray-900 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white hover:file:bg-gray-800"
                />
                <button
                  type="button"
                  onClick={handleUpload}
                  disabled={uploading}
                  className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
                >
                  {uploading ? "Uploading…" : "Upload guide"}
                </button>
              </div>
            </section>
          )}

          {/* Best Practice Templates — company standards that also feed the AI */}
          <BestPracticesSection canManage={canManage} />
        </div>
      )}

      {assignGuide && (
        <AssignModal
          guide={assignGuide}
          onClose={() => setAssignGuide(null)}
          onChanged={load}
        />
      )}
    </div>
  );
}

// ───────────────────────────── Assign modal ─────────────────────────────

function AssignModal({
  guide,
  onClose,
  onChanged,
}: {
  guide: Guide;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [members, setMembers] = useState<Member[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    const [mRes, aRes] = await Promise.all([
      fetch("/api/company/members"),
      fetch(`/api/training/guides/${guide.id}/assignments`),
    ]);
    if (mRes.ok) setMembers(await mRes.json());
    if (aRes.ok) {
      const d = await aRes.json();
      setAssignments(d.assignments ?? []);
    }
    setLoading(false);
  }, [guide.id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const assignedIds = useMemo(() => new Set(assignments.map((a) => a.userId)), [assignments]);
  const unassigned = useMemo(
    () => members.filter((m) => !assignedIds.has(m.id)),
    [members, assignedIds],
  );

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleAssign() {
    setError("");
    if (checked.size === 0) {
      setError("Select at least one employee.");
      return;
    }
    setSaving(true);
    const res = await fetch(`/api/training/guides/${guide.id}/assignments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userIds: Array.from(checked), dueDate }),
    });
    setSaving(false);
    if (res.ok) {
      const d = await res.json();
      setAssignments(d.assignments ?? []);
      setChecked(new Set());
      setDueDate("");
      onChanged();
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error || "Could not assign.");
    }
  }

  async function removeAssignment(id: string) {
    const res = await fetch(`/api/training/guides/assignments/${id}`, { method: "DELETE" });
    if (res.ok) {
      setAssignments((prev) => prev.filter((a) => a.id !== id));
      onChanged();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Assign guide</h3>
            <p className="mt-0.5 text-sm text-gray-500">{guide.title}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 text-gray-400 hover:bg-gray-100">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {loading ? (
          <p className="py-6 text-center text-sm text-gray-400">Loading…</p>
        ) : (
          <div className="space-y-5">
            {/* Current assignees */}
            {assignments.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Currently assigned
                </p>
                <div className="space-y-1.5">
                  {assignments.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center justify-between gap-3 rounded-md bg-gray-50 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm text-gray-900">{a.username || a.email}</p>
                        <p className="text-xs text-gray-500">
                          {a.status === "completed" ? (
                            <span className="text-emerald-600">Completed</span>
                          ) : a.dueDate ? (
                            <span className={isOverdue(a.dueDate, a.status) ? "text-red-600" : ""}>
                              Due {formatDate(a.dueDate)}
                            </span>
                          ) : (
                            "No due date"
                          )}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeAssignment(a.id)}
                        className="shrink-0 rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Assign to more */}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                Assign to employees
              </p>
              {unassigned.length === 0 ? (
                <p className="text-sm text-gray-400">Everyone is already assigned.</p>
              ) : (
                <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-gray-200 p-2">
                  {unassigned.map((m) => (
                    <label
                      key={m.id}
                      className="flex cursor-pointer items-center gap-2.5 rounded px-2 py-1.5 hover:bg-gray-50"
                    >
                      <input
                        type="checkbox"
                        checked={checked.has(m.id)}
                        onChange={() => toggle(m.id)}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-gray-900">{m.username || m.email}</span>
                        {m.username && (
                          <span className="block truncate text-xs text-gray-400">{m.email}</span>
                        )}
                      </span>
                      <span className="shrink-0 text-[11px] uppercase tracking-wide text-gray-400">
                        {m.company_role === "super_admin"
                          ? "Super Admin"
                          : m.company_role === "admin"
                            ? "Admin"
                            : "Member"}
                      </span>
                    </label>
                  ))}
                </div>
              )}

              {unassigned.length > 0 && (
                <div className="mt-3 flex flex-wrap items-end gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-500">Due date</label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAssign}
                    disabled={saving || checked.size === 0}
                    className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
                  >
                    {saving ? "Assigning…" : `Assign${checked.size ? ` (${checked.size})` : ""}`}
                  </button>
                </div>
              )}
              {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ───────────────────────── Best Practice Templates ─────────────────────────

type BestPractice = { id: string; title: string; content: string; sortOrder: number };

// Quick-start topics for the most common process steps. Clicking one pre-fills
// the title so a Super Admin can document that step's standards fast.
const SUGGESTED_TOPICS = [
  "Buyout / Procurement",
  "Submittals",
  "Specifications",
  "RFIs",
  "Schedule",
  "Preconstruction",
  "Closeout",
  "Safety",
  "Quality Control",
  "Change Management",
];

const TEXTAREA_CLASS =
  "w-full min-h-[90px] rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10";

function BestPracticesSection({ canManage }: { canManage: boolean }) {
  const [items, setItems] = useState<BestPractice[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [adding, setAdding] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const contentRef = useRef<HTMLTextAreaElement>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/training/best-practices");
      if (res.ok) {
        const d = await res.json();
        setItems(d.bestPractices ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function add() {
    setError("");
    const title = newTitle.trim();
    if (!title) {
      setError("Give the best practice a title.");
      return;
    }
    setAdding(true);
    const res = await fetch("/api/training/best-practices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, content: newContent }),
    });
    setAdding(false);
    if (res.ok) {
      setNewTitle("");
      setNewContent("");
      setShowAdd(false);
      await load();
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error || "Could not add best practice.");
    }
  }

  async function saveEdit(id: string) {
    const title = editTitle.trim();
    if (!title) return;
    setBusyId(id);
    const res = await fetch(`/api/training/best-practices/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, content: editContent }),
    });
    setBusyId(null);
    setEditingId(null);
    if (res.ok) await load();
  }

  async function move(id: string, direction: "up" | "down") {
    setBusyId(id);
    const res = await fetch(`/api/training/best-practices/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ move: direction }),
    });
    setBusyId(null);
    if (res.ok) await load();
  }

  async function remove(id: string) {
    if (!confirm("Delete this best practice?")) return;
    setBusyId(id);
    const res = await fetch(`/api/training/best-practices/${id}`, { method: "DELETE" });
    setBusyId(null);
    if (res.ok) await load();
  }

  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-gray-900">Best Practice Templates</h2>
        {canManage && !showAdd && (
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800"
          >
            + Add best practice
          </button>
        )}
      </div>
      <p className="mb-3 max-w-2xl text-xs text-gray-500">
        Your company&apos;s standards for each step of the process (Submittals, Specs, Buyout, and
        more). Assist, Looking Ahead, and To Do read these as company policy — e.g. a rule like
        &ldquo;buyout within 90 days of contract&rdquo; lets them surface the dated item for the
        right contract.
      </p>

      {loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : (
        <>
          {/* Add form */}
          {canManage && showAdd && (
            <div className="mb-4 rounded-lg border border-gray-200 p-4">
              {error && <p className="mb-2 text-xs text-red-600">{error}</p>}
              <div className="mb-2 flex flex-wrap gap-1.5">
                {SUGGESTED_TOPICS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      setNewTitle(t);
                      contentRef.current?.focus();
                    }}
                    className="rounded-full border border-gray-200 px-2.5 py-1 text-[11px] text-gray-600 hover:border-gray-400 hover:bg-gray-50"
                  >
                    {t}
                  </button>
                ))}
              </div>
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Step / topic (e.g. Buyout)"
                className={`${INPUT_CLASS} mb-2`}
              />
              <textarea
                ref={contentRef}
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="Standards for this step. E.g. All buyout (subcontracts & POs) must be executed within 90 days of the prime contract. Electrical submittals are due within 30 days of contract execution."
                className={TEXTAREA_CLASS}
              />
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={add}
                  disabled={adding}
                  className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
                >
                  {adding ? "Saving…" : "Save best practice"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAdd(false);
                    setError("");
                  }}
                  className="rounded-md px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {items.length === 0 ? (
            <p className="rounded-lg border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-400">
              No best practices yet.
              {canManage ? " Add your company's standards so the AI features can apply them." : ""}
            </p>
          ) : (
            <div className="space-y-2">
              {items.map((bp, idx) => (
                <div key={bp.id} className="rounded-lg border border-gray-200 bg-white p-4">
                  {editingId === bp.id ? (
                    <div className="space-y-2">
                      <input
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className={INPUT_CLASS}
                        autoFocus
                      />
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className={TEXTAREA_CLASS}
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => saveEdit(bp.id)}
                          disabled={busyId === bp.id}
                          className="rounded bg-gray-900 px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="rounded px-3 py-1 text-xs text-gray-600 hover:bg-gray-100"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-semibold text-gray-900">{bp.title}</h3>
                        {bp.content ? (
                          <p className="mt-1 whitespace-pre-wrap text-sm text-gray-600">{bp.content}</p>
                        ) : (
                          <p className="mt-1 text-xs italic text-gray-400">No standards entered yet.</p>
                        )}
                      </div>
                      {canManage && (
                        <div className="flex shrink-0 items-center gap-0.5">
                          <button
                            type="button"
                            title="Move up"
                            onClick={() => move(bp.id, "up")}
                            disabled={busyId === bp.id || idx === 0}
                            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            title="Move down"
                            onClick={() => move(bp.id, "down")}
                            disabled={busyId === bp.id || idx === items.length - 1}
                            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(bp.id);
                              setEditTitle(bp.title);
                              setEditContent(bp.content);
                            }}
                            className="rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => remove(bp.id)}
                            disabled={busyId === bp.id}
                            className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
