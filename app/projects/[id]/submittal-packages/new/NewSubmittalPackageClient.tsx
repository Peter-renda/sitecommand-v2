"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import ProjectNav from "@/components/ProjectNav";
import { CreateSubmittalModal } from "../../submittals/SubmittalsClient";

// ── Types ─────────────────────────────────────────────────────────────────────

type Specification = { id: string; name: string; code: string | null };

type DirectoryContact = {
  id: string;
  type: string;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  group_name: string | null;
  email: string | null;
};

type SubmittalRow = {
  id: string;
  submittal_number: number;
  revision: string | null;
  title: string;
  specification_id: string | null;
  submittal_type: string | null;
  status: string;
  responsible_contractor_id: string | null;
  received_from_id: string | null;
  final_due_date: string | null;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function contactDisplayName(c: DirectoryContact): string {
  if (c.type === "company") return c.company ?? "Unnamed Company";
  if (c.type === "distribution_group") return c.group_name ?? "Unnamed Group";
  return [c.first_name, c.last_name].filter(Boolean).join(" ") || "Unnamed";
}

function getContactName(directory: DirectoryContact[], id: string | null): string {
  if (!id) return "—";
  const c = directory.find((x) => x.id === id);
  return c ? contactDisplayName(c) : "—";
}

function getSpecSection(specifications: Specification[], id: string | null): string {
  if (!id) return "—";
  const s = specifications.find((x) => x.id === id);
  if (!s) return "—";
  return s.code ? `${s.code} – ${s.name}` : s.name;
}

function formatDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d + "T12:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  open: "Open",
  approved: "Approved",
  approved_as_noted: "Approved as Noted",
  rejected: "Rejected",
  revise_and_resubmit: "Revise & Resubmit",
  closed: "Closed",
  pending_review: "Pending Review",
  for_the_record: "For the Record",
  make_corrections: "Make Corrections",
  no_exceptions_taken: "No Exceptions Taken",
  not_reviewed: "Not Reviewed",
  note_markings: "Note Markings",
  resubmitted: "Resubmitted",
  revise_and_resubmit_2: "Revise and Resubmit",
};

// ── Rich Text Editor ──────────────────────────────────────────────────────────

type RteCommand =
  | "bold"
  | "italic"
  | "underline"
  | "strikeThrough"
  | "justifyLeft"
  | "justifyCenter"
  | "justifyRight"
  | "insertUnorderedList"
  | "insertOrderedList"
  | "outdent"
  | "indent"
  | "undo"
  | "redo";

function RichTextEditor({
  value,
  onChange,
  minHeight = "100px",
}: {
  value: string;
  onChange: (v: string) => void;
  minHeight?: string;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const isFocused = useRef(false);

  useEffect(() => {
    if (editorRef.current && !isFocused.current) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  function exec(cmd: RteCommand) {
    editorRef.current?.focus();
    document.execCommand(cmd, false);
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  }

  function handleInput() {
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  }

  const btnCls =
    "p-1 rounded hover:bg-gray-100 text-gray-600 hover:text-gray-900 transition-colors";
  const divider = <div className="w-px h-4 bg-gray-200 mx-0.5" />;

  return (
    <div className="border border-gray-300 rounded overflow-hidden">
      <div className="flex items-center flex-wrap gap-0.5 px-2 py-1.5 border-b border-gray-200 bg-gray-50">
        <button type="button" onClick={() => exec("bold")} className={btnCls} title="Bold">
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M15.6 10.79c.97-.67 1.65-1.77 1.65-2.79 0-2.26-1.75-4-4-4H7v14h7.04c2.09 0 3.71-1.7 3.71-3.79 0-1.52-.86-2.82-2.15-3.42zM10 6.5h3c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-3v-3zm3.5 9H10v-3h3.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5z" />
          </svg>
        </button>
        <button type="button" onClick={() => exec("italic")} className={btnCls} title="Italic">
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M10 4v3h2.21l-3.42 8H6v3h8v-3h-2.21l3.42-8H18V4h-8z" />
          </svg>
        </button>
        <button type="button" onClick={() => exec("underline")} className={btnCls} title="Underline">
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 17c3.31 0 6-2.69 6-6V3h-2.5v8c0 1.93-1.57 3.5-3.5 3.5S8.5 12.93 8.5 11V3H6v8c0 3.31 2.69 6 6 6zm-7 2v2h14v-2H5z" />
          </svg>
        </button>
        <button type="button" onClick={() => exec("strikeThrough")} className={btnCls} title="Strikethrough">
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M10 19h4v-3h-4v3zM5 4v3h5v3h4V7h5V4H5zM3 14h18v-2H3v2z" />
          </svg>
        </button>
        {divider}
        <button type="button" onClick={() => exec("justifyLeft")} className={btnCls} title="Align left">
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M15 15H3v2h12v-2zm0-8H3v2h12V7zM3 13h18v-2H3v2zm0 8h18v-2H3v2zM3 3v2h18V3H3z" />
          </svg>
        </button>
        <button type="button" onClick={() => exec("justifyCenter")} className={btnCls} title="Align center">
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M7 15v2h10v-2H7zm-4 6h18v-2H3v2zm0-8h18v-2H3v2zm4-6v2h10V7H7zM3 3v2h18V3H3z" />
          </svg>
        </button>
        <button type="button" onClick={() => exec("justifyRight")} className={btnCls} title="Align right">
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M3 21h18v-2H3v2zm6-4h12v-2H9v2zm-6-4h18v-2H3v2zm6-4h12V7H9v2zM3 3v2h18V3H3z" />
          </svg>
        </button>
        {divider}
        <button type="button" onClick={() => exec("insertUnorderedList")} className={btnCls} title="Bullet list">
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M4 10.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5zm0-6c-.83 0-1.5.67-1.5 1.5S3.17 7.5 4 7.5 5.5 6.83 5.5 6 4.83 4.5 4 4.5zm0 12c-.83 0-1.5.68-1.5 1.5s.68 1.5 1.5 1.5 1.5-.68 1.5-1.5-.67-1.5-1.5-1.5zM7 19h14v-2H7v2zm0-6h14v-2H7v2zm0-8v2h14V5H7z" />
          </svg>
        </button>
        <button type="button" onClick={() => exec("insertOrderedList")} className={btnCls} title="Numbered list">
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M2 17h2v.5H3v1h1v.5H2v1h3v-4H2v1zm1-9h1V4H2v1h1v3zm-1 3h1.8L2 13.1v.9h3v-1H3.2L5 10.9V10H2v1zm5-6v2h14V5H7zm0 14h14v-2H7v2zm0-6h14v-2H7v2z" />
          </svg>
        </button>
        {divider}
        <button type="button" onClick={() => exec("outdent")} className={btnCls} title="Outdent">
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M11 17h10v-2H11v2zm-8-5l4 4V8l-4 4zm0 9h18v-2H3v2zM3 3v2h18V3H3zm8 6h10V7H11v2zm0 4h10v-2H11v2z" />
          </svg>
        </button>
        <button type="button" onClick={() => exec("indent")} className={btnCls} title="Indent">
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M3 21h18v-2H3v2zM3 8v8l4-4-4-4zm8 9h10v-2H11v2zM3 3v2h18V3H3zm8 6h10V7H11v2zm0 4h10v-2H11v2z" />
          </svg>
        </button>
        {divider}
        <span className="text-xs text-gray-400 px-1 border border-gray-200 rounded py-0.5 select-none">
          12pt
        </span>
        {divider}
        <button type="button" onClick={() => exec("undo")} className={btnCls} title="Undo">
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z" />
          </svg>
        </button>
        <button type="button" onClick={() => exec("redo")} className={btnCls} title="Redo">
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M18.4 10.6C16.55 8.99 14.15 8 11.5 8c-4.65 0-8.58 3.03-9.96 7.22L3.9 16c1.05-3.19 4.05-5.5 7.6-5.5 1.95 0 3.73.72 5.12 1.88L13 16h9V7l-3.6 3.6z" />
          </svg>
        </button>
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onFocus={() => { isFocused.current = true; }}
        onBlur={() => { isFocused.current = false; }}
        className="px-3 py-2 text-sm text-gray-900 focus:outline-none"
        style={{ minHeight }}
      />
    </div>
  );
}

// ── Add Existing Submittal Modal ──────────────────────────────────────────────

function AddExistingSubmittalModal({
  projectId,
  alreadyAdded,
  onAdd,
  onClose,
}: {
  projectId: string;
  alreadyAdded: Set<string>;
  onAdd: (submittal: SubmittalRow) => void;
  onClose: () => void;
}) {
  const [submittals, setSubmittals] = useState<SubmittalRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/submittals`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setSubmittals(data);
      })
      .finally(() => setLoading(false));
  }, [projectId]);

  const filtered = submittals.filter(
    (s) =>
      !alreadyAdded.has(s.id) &&
      s.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-xl w-full max-w-lg shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Add Existing Submittal</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-6 py-4">
          <input
            type="text"
            placeholder="Search submittals..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-gray-900 mb-3"
            autoFocus
          />
          {loading ? (
            <p className="text-sm text-gray-400 py-4 text-center">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">
              {submittals.length === 0
                ? "No submittals found for this project."
                : "No matching submittals."}
            </p>
          ) : (
            <ul className="max-h-72 overflow-y-auto divide-y divide-gray-100">
              {filtered.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => { onAdd(s); onClose(); }}
                    className="w-full text-left px-2 py-2.5 hover:bg-gray-50 transition-colors rounded"
                  >
                    <span className="text-xs font-medium text-gray-500 mr-2">
                      #{s.submittal_number}
                    </span>
                    <span className="text-sm text-gray-800">{s.title}</span>
                    {s.submittal_type && (
                      <span className="ml-2 text-xs text-gray-400">{s.submittal_type}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function NewSubmittalPackageClient({
  projectId,
  username,
}: {
  projectId: string;
  username: string;
}) {
  const router = useRouter();

  // Form state
  const [title, setTitle] = useState("");
  const [specificationId, setSpecificationId] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Submittals in package
  const [submittals, setSubmittals] = useState<SubmittalRow[]>([]);
  const [nextSubmittalNumber, setNextSubmittalNumber] = useState(1);
  const [showCreateSubmittal, setShowCreateSubmittal] = useState(false);
  const [showAddExisting, setShowAddExisting] = useState(false);

  // Data
  const [specifications, setSpecifications] = useState<Specification[]>([]);
  const [directory, setDirectory] = useState<DirectoryContact[]>([]);

  // UI state
  const [saving, setSaving] = useState(false);
  const [creatingSubmittal, setCreatingSubmittal] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      fetch(`/api/projects/${projectId}/specifications`).then((r) => r.json()),
      fetch(`/api/projects/${projectId}/directory`).then((r) => r.json()),
    ]).then(([specs, dir]) => {
      if (Array.isArray(specs)) setSpecifications(specs);
      if (Array.isArray(dir)) setDirectory(dir);
    });

    fetch(`/api/projects/${projectId}/submittals`)
      .then((r) => r.json())
      .then((rows: SubmittalRow[]) => {
        if (!Array.isArray(rows) || rows.length === 0) {
          setNextSubmittalNumber(1);
          return;
        }
        setNextSubmittalNumber(Math.max(...rows.map((s) => s.submittal_number)) + 1);
      })
      .catch(() => setNextSubmittalNumber(1));
  }, [projectId]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  function handleFileDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const dropped = Array.from(e.dataTransfer.files);
    if (dropped.length) setAttachmentFiles((prev) => [...prev, ...dropped]);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    if (selected.length) setAttachmentFiles((prev) => [...prev, ...selected]);
    e.target.value = "";
  }

  async function handleSave() {
    if (!title.trim()) { setError("Title is required."); return; }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/projects/${projectId}/submittal-packages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          specification_id: specificationId,
          description: description || null,
          attachments: [],
          submittal_ids: submittals.map((s) => s.id),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to create package.");
        return;
      }
      router.push(`/projects/${projectId}/submittals`);
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateSubmittal(data: Record<string, unknown>, sendEmails: boolean) {
    setCreatingSubmittal(true);
    const { attachmentFiles, ...rest } = data;
    const res = await fetch(`/api/projects/${projectId}/submittals`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rest),
    });
    if (res.ok) {
      const newSubmittal = await res.json();
      const files = Array.isArray(attachmentFiles) ? attachmentFiles.filter((f): f is File => f instanceof File) : [];
      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);
        const attRes = await fetch(`/api/projects/${projectId}/submittals/${newSubmittal.id}/attachment`, {
          method: "POST",
          body: formData,
        });
        if (attRes.ok) {
          const updated = await attRes.json();
          newSubmittal.attachments = updated.attachments ?? [];
        }
      }
      setSubmittals((prev) => [...prev, newSubmittal]);
      setNextSubmittalNumber((n) => n + 1);
      if (sendEmails) {
        await fetch(`/api/projects/${projectId}/submittals/${newSubmittal.id}/notify`, {
          method: "POST",
        });
      }
    }
    setCreatingSubmittal(false);
    setShowCreateSubmittal(false);
  }

  const addedIds = new Set(submittals.map((s) => s.id));

  const thCls =
    "px-3 py-2 text-left text-xs font-semibold text-gray-500 bg-gray-50 border-b border-gray-200 whitespace-nowrap";

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col">
      {/* Top header */}
      <header className="bg-[#F9FAFB] border-b border-black/[0.06] px-6 h-14 flex items-center justify-between shrink-0">
        <a
          href="/dashboard"
          className="text-sm font-semibold text-gray-900 hover:text-gray-600 transition-colors"
        >
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

      {/* Page content */}
      <div className="flex-1 overflow-y-auto pb-24">
        <div className="max-w-6xl mx-auto px-8 py-6">
          {/* Breadcrumb + title */}
          <div className="mb-6">
            <nav className="flex items-center gap-1.5 text-sm mb-2">
              <a
                href={`/projects/${projectId}/submittals`}
                className="text-gray-500 hover:text-gray-800 transition-colors"
              >
                Submittals
              </a>
              <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 20 20" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
              <span className="text-gray-800 font-medium">New Submittal Package</span>
            </nav>
            <h1 className="font-display text-[24px] leading-tight text-[color:var(--ink)]">New Submittal Package</h1>
          </div>

          {error && (
            <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
              {error}
            </div>
          )}

          {/* General Information */}
          <div className="bg-white border border-gray-200 rounded-xl mb-5">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900">General Information</h2>
            </div>
            <div className="px-6 py-5 space-y-5">
              {/* Title */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-gray-900"
                />
              </div>

              {/* Specification + Number */}
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Specification
                  </label>
                  <select
                    value={specificationId ?? ""}
                    onChange={(e) => setSpecificationId(e.target.value || null)}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-gray-900 bg-white"
                  >
                    <option value="">Select a Specification</option>
                    {specifications.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.code ? `${s.code} – ${s.name}` : s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="w-32">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value="1"
                    readOnly
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm bg-gray-50 text-gray-500 cursor-default focus:outline-none"
                  />
                </div>
              </div>

              {/* Description + Attachments */}
              <div className="flex gap-5">
                <div className="flex-1 min-w-0">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <RichTextEditor
                    value={description}
                    onChange={setDescription}
                    minHeight="120px"
                  />
                </div>
                <div className="w-64 shrink-0">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Package Attachments
                  </label>
                  <div
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleFileDrop}
                    className={`border-2 border-dashed rounded-lg flex flex-col items-center justify-center py-8 px-4 text-center transition-colors ${
                      dragOver ? "border-orange-400 bg-orange-50" : "border-gray-200 bg-gray-50"
                    }`}
                    style={{ minHeight: "140px" }}
                  >
                    <svg
                      className="w-10 h-10 text-gray-300 mb-3"
                      fill="none"
                      viewBox="0 0 48 48"
                      stroke="currentColor"
                      strokeWidth={1.5}
                    >
                      <rect x="6" y="6" width="36" height="36" rx="4" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M24 16v16M16 24h16" />
                    </svg>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-1.5 text-sm border border-gray-300 rounded bg-white hover:bg-gray-50 transition-colors text-gray-700"
                    >
                      Attach Files
                    </button>
                    <p className="text-xs text-gray-400 mt-2">or Drag &amp; Drop</p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      className="hidden"
                      onChange={handleFileChange}
                    />
                  </div>
                  {attachmentFiles.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {attachmentFiles.map((f) => (
                        <li
                          key={f.name}
                          className="flex items-center justify-between text-xs text-gray-600 bg-gray-50 px-3 py-1.5 rounded"
                        >
                          <span className="truncate">{f.name}</span>
                          <button
                            type="button"
                            onClick={() =>
                              setAttachmentFiles((prev) =>
                                prev.filter((x) => x.name !== f.name)
                              )
                            }
                            className="ml-2 text-gray-400 hover:text-red-500 transition-colors"
                          >
                            ✕
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Submittals in this Package */}
          <div className="bg-white border border-gray-200 rounded-xl">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">Submittals in this Package</h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateSubmittal(true)}
                  className="px-3 py-1.5 text-xs font-medium text-gray-700 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                >
                  Create Submittal
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddExisting(true)}
                  className="px-3 py-1.5 text-xs font-medium text-gray-700 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                >
                  Add Existing Submittal
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className={thCls}>Spec Section</th>
                    <th className={thCls}>No.</th>
                    <th className={thCls}>Rev.</th>
                    <th className={thCls}>Responsible Contractor</th>
                    <th className={thCls}>Received From</th>
                    <th className={thCls}>Title</th>
                    <th className={thCls}>Type</th>
                    <th className={thCls}>Status</th>
                    <th className={thCls}>Final Due Date</th>
                    <th className={thCls}></th>
                  </tr>
                </thead>
                <tbody>
                  {submittals.length === 0 ? (
                    <tr>
                      <td colSpan={10}>
                        <div className="py-16 flex flex-col items-center justify-center text-center">
                          {/* Box/package icon */}
                          <svg
                            className="w-16 h-16 mb-4"
                            viewBox="0 0 80 80"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <rect x="10" y="28" width="60" height="42" rx="4" fill="#E5E7EB" />
                            <rect x="18" y="36" width="44" height="26" rx="2" fill="white" stroke="#D1D5DB" strokeWidth="1.5" />
                            <rect x="26" y="44" width="28" height="10" rx="1.5" fill="#F97316" opacity="0.7" />
                            <path d="M10 28 L40 10 L70 28" stroke="#D1D5DB" strokeWidth="2" fill="#F3F4F6" />
                            <circle cx="58" cy="18" r="6" fill="#60A5FA" opacity="0.8" />
                            <path d="M56 18 L58 20 L62 16" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          <p className="text-sm font-semibold text-gray-700 mb-1">
                            Add Submittals to Get Started
                          </p>
                          <p className="text-xs text-gray-400 max-w-xs">
                            Start building your submittal package by creating a new submittal or adding an existing one.
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    submittals.map((s) => (
                      <tr key={s.id} className="border-t border-gray-100 hover:bg-gray-50">
                        <td className="px-3 py-2.5 text-xs text-gray-600">
                          {getSpecSection(specifications, s.specification_id)}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-gray-600">
                          {s.submittal_number}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-gray-600">
                          {s.revision ?? "—"}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-gray-600">
                          {getContactName(directory, s.responsible_contractor_id)}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-gray-600">
                          {getContactName(directory, s.received_from_id)}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-gray-800 font-medium">
                          {s.title}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-gray-600">
                          {s.submittal_type ?? "—"}
                        </td>
                        <td className="px-3 py-2.5 text-xs">
                          <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                            {STATUS_LABELS[s.status] ?? s.status}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-gray-600">
                          {formatDate(s.final_due_date)}
                        </td>
                        <td className="px-3 py-2.5 text-xs">
                          <button
                            type="button"
                            onClick={() =>
                              setSubmittals((prev) => prev.filter((x) => x.id !== s.id))
                            }
                            className="text-gray-400 hover:text-red-500 transition-colors"
                            title="Remove from package"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-8 py-4 flex items-center justify-between z-10">
        <p className="text-xs text-gray-400">
          <span className="text-red-500">*</span> Required field
        </p>
        <div className="flex items-center gap-3">
          <a
            href={`/projects/${projectId}/submittals`}
            className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
          >
            Cancel
          </a>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 text-sm font-medium text-white bg-gray-900 rounded hover:bg-gray-700 transition-colors disabled:opacity-60"
          >
            {saving ? "Saving…" : "Create Package"}
          </button>
        </div>
      </div>

      {/* Modals */}
      {showCreateSubmittal && (
        <CreateSubmittalModal
          projectId={projectId}
          nextNumber={nextSubmittalNumber}
          directory={directory}
          specifications={specifications}
          packages={[]}
          onConfirm={handleCreateSubmittal}
          onCancel={() => !creatingSubmittal && setShowCreateSubmittal(false)}
          onSpecCreated={(spec) => setSpecifications((prev) => [...prev, spec])}
        />
      )}
      {showAddExisting && (
        <AddExistingSubmittalModal
          projectId={projectId}
          alreadyAdded={addedIds}
          onAdd={(s) => setSubmittals((prev) => [...prev, s])}
          onClose={() => setShowAddExisting(false)}
        />
      )}
    </div>
  );
}
