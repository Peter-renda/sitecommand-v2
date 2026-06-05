"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import ProjectNav from "@/components/ProjectNav";

type DirectoryContact = {
  id: string;
  type: string;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  group_name: string | null;
  email: string | null;
};

type DirContact = { id: string; name: string; email: string | null };

type FormatDoc = { id: string; label: string; date: string };

type TransmittalItem = {
  id: string;
  format: string;
  description: string;   // saved display text
  linkedDocId: string;   // ID of linked doc (or "")
  date: string;
  copies: string;
};

// ─── Format list (matches screenshot) ────────────────────────────────────────
const ITEM_FORMATS = [
  "Commitment Contract",
  "Communication",
  "Document",
  "Other",
  "Plans",
  "Potential Change Order",
  "Prime Contract",
  "Prints",
  "Punch List Item",
  "Purchase Order Contract",
  "RFI",
  "Samples",
  "Shop Drawings",
  "Submittal Log",
  "Submittal Package",
];

const DELIVERY_METHODS = ["Attached", "Under Separate Cover"];

const SUBMITTED_FOR_OPTIONS = [
  { key: "approval", label: "Approval" },
  { key: "your_use", label: "Your Use" },
  { key: "as_requested", label: "As Requested" },
  { key: "review_and_comment", label: "Review and Comment" },
  { key: "further_processing", label: "Further Processing" },
];

const ACTION_AS_NOTED_OPTIONS = [
  { key: "out_for_signature", label: "Out for Signature" },
  { key: "approved_as_submitted", label: "Approved as Submitted" },
  { key: "approved_as_noted", label: "Approved as Noted" },
  { key: "submit", label: "Submit" },
  { key: "resubmitted", label: "Resubmitted" },
  { key: "returned", label: "Returned" },
  { key: "returned_for_corrections", label: "Returned for Corrections" },
  { key: "resubmit", label: "Resubmit" },
  { key: "due_by", label: "Due By", hasDate: true },
  { key: "received", label: "Received" },
  { key: "received_as_noted", label: "Received as Noted" },
  { key: "sent_date", label: "Sent date", hasDate: true },
];

// ─── Format → API endpoint config ────────────────────────────────────────────
type FormatConfig = {
  endpoint: string;
  getLabel: (i: Record<string, unknown>) => string;
  getDate: (i: Record<string, unknown>) => string;
  // special: "drawings" returns { drawings, uploads } not an array
  extractList?: (data: unknown) => Record<string, unknown>[];
} | null;

const FORMAT_API_MAP: Record<string, FormatConfig> = {
  "Commitment Contract": {
    endpoint: "commitments",
    getLabel: (i) => `${i.number ?? ""}: ${(i.title as string) || "Untitled"}`.trim().replace(/^:\s*/, ""),
    getDate: (i) => ((i.created_at as string) ?? "").split("T")[0],
  },
  "Communication": null,
  "Document": {
    endpoint: "documents",
    getLabel: (i) => (i.name as string) || "Unnamed",
    getDate: (i) => ((i.created_at as string) ?? "").split("T")[0],
  },
  "Other": null,
  "Plans": {
    endpoint: "drawings",
    getLabel: (i) => (i.filename as string) || "Unnamed",
    getDate: (i) => ((i.uploaded_at as string) ?? "").split("T")[0],
    extractList: (data) => {
      const d = data as { uploads?: Record<string, unknown>[] };
      return Array.isArray(d?.uploads) ? d.uploads : [];
    },
  },
  "Potential Change Order": {
    endpoint: "change-events",
    getLabel: (i) => `${i.number ?? ""}: ${(i.title as string) || "Untitled"}`.trim().replace(/^:\s*/, ""),
    getDate: (i) => ((i.created_at as string) ?? "").split("T")[0],
  },
  "Prime Contract": {
    endpoint: "prime-contracts",
    getLabel: (i) => `${i.contract_number ?? ""}: ${(i.title as string) || "Untitled"}`.trim().replace(/^:\s*/, ""),
    getDate: (i) => ((i.created_at as string) ?? "").split("T")[0],
  },
  "Prints": {
    endpoint: "drawings",
    getLabel: (i) => (i.filename as string) || "Unnamed",
    getDate: (i) => ((i.uploaded_at as string) ?? "").split("T")[0],
    extractList: (data) => {
      const d = data as { uploads?: Record<string, unknown>[] };
      return Array.isArray(d?.uploads) ? d.uploads : [];
    },
  },
  "Punch List Item": {
    endpoint: "punch-list",
    getLabel: (i) => `${i.item_number ?? ""}: ${(i.title as string) || "Untitled"}`.trim().replace(/^:\s*/, ""),
    getDate: (i) => ((i.created_at as string) ?? "").split("T")[0],
  },
  "Purchase Order Contract": {
    endpoint: "commitments",
    getLabel: (i) => `${i.number ?? ""}: ${(i.title as string) || "Untitled"}`.trim().replace(/^:\s*/, ""),
    getDate: (i) => ((i.created_at as string) ?? "").split("T")[0],
  },
  "RFI": {
    endpoint: "rfis",
    getLabel: (i) => `RFI-${i.rfi_number}: ${(i.subject as string) || "Untitled"}`,
    getDate: (i) => ((i.created_at as string) ?? "").split("T")[0],
  },
  "Samples": {
    endpoint: "submittals",
    getLabel: (i) => `${i.submittal_number}: ${(i.title as string) || "Untitled"}`,
    getDate: (i) => ((i.created_at as string) ?? "").split("T")[0],
  },
  "Shop Drawings": {
    endpoint: "submittals",
    getLabel: (i) => `${i.submittal_number}: ${(i.title as string) || "Untitled"}`,
    getDate: (i) => ((i.created_at as string) ?? "").split("T")[0],
  },
  "Submittal Log": {
    endpoint: "submittals",
    getLabel: (i) => `${i.submittal_number}: ${(i.title as string) || "Untitled"}`,
    getDate: (i) => ((i.created_at as string) ?? "").split("T")[0],
  },
  "Submittal Package": {
    endpoint: "submittals",
    getLabel: (i) => `${i.submittal_number}: ${(i.title as string) || "Untitled"}`,
    getDate: (i) => ((i.created_at as string) ?? "").split("T")[0],
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function contactDisplayName(c: DirectoryContact): string {
  if (c.type === "company") return c.company ?? "Unnamed Company";
  if (c.type === "distribution_group") return c.group_name ?? "Unnamed Group";
  return [c.first_name, c.last_name].filter(Boolean).join(" ") || "Unnamed";
}

// ─── Contact pickers (users only) ────────────────────────────────────────────
function SingleUserPicker({
  directory,
  selectedId,
  onChange,
  placeholder = "Select A Person...",
}: {
  directory: DirectoryContact[];
  selectedId: string | null;
  onChange: (id: string | null) => void;
  placeholder?: string;
}) {
  const users = directory.filter((c) => c.type === "user");
  return (
    <select
      value={selectedId ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
      className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white text-gray-700"
    >
      <option value="">{placeholder}</option>
      {users.map((c) => (
        <option key={c.id} value={c.id}>
          {contactDisplayName(c)}
        </option>
      ))}
    </select>
  );
}

function MultiUserPicker({
  directory,
  selected,
  onChange,
  placeholder = "Select A Person...",
}: {
  directory: DirectoryContact[];
  selected: DirContact[];
  onChange: (v: DirContact[]) => void;
  placeholder?: string;
}) {
  const users = directory.filter((c) => c.type === "user");
  const selectedIds = new Set(selected.map((s) => s.id));
  const available = users.filter((c) => !selectedIds.has(c.id));

  function add(id: string) {
    const c = users.find((x) => x.id === id);
    if (!c) return;
    onChange([...selected, { id: c.id, name: contactDisplayName(c), email: c.email }]);
  }
  function remove(id: string) {
    onChange(selected.filter((s) => s.id !== id));
  }

  return (
    <div>
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
      <select
        value=""
        onChange={(e) => { if (e.target.value) add(e.target.value); }}
        className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white text-gray-700"
      >
        <option value="">{placeholder}</option>
        {available.map((c) => (
          <option key={c.id} value={c.id}>{contactDisplayName(c)}</option>
        ))}
      </select>
    </div>
  );
}

// ─── Rich text editor ─────────────────────────────────────────────────────────
function ToolBtn({ children, onClick, title }: { children: React.ReactNode; onClick: () => void; title?: string }) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      className="p-1.5 rounded hover:bg-gray-100 text-gray-600 hover:text-gray-900 transition-colors"
    >
      {children}
    </button>
  );
}

function RichTextEditor({ onChange, placeholder }: { onChange: (v: string) => void; placeholder?: string }) {
  const editorRef = useRef<HTMLDivElement>(null);
  function execCmd(cmd: string) { document.execCommand(cmd, false); editorRef.current?.focus(); }
  return (
    <div className="border border-gray-200 rounded-md overflow-hidden">
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-gray-200 bg-white flex-wrap">
        <ToolBtn onClick={() => execCmd("bold")} title="Bold"><span className="font-bold text-sm">B</span></ToolBtn>
        <ToolBtn onClick={() => execCmd("italic")} title="Italic"><span className="italic text-sm">I</span></ToolBtn>
        <ToolBtn onClick={() => execCmd("underline")} title="Underline"><span className="underline text-sm">U</span></ToolBtn>
        <ToolBtn onClick={() => execCmd("strikeThrough")} title="Strikethrough"><span className="line-through text-sm">S</span></ToolBtn>
        <div className="w-px h-5 bg-gray-200 mx-1" />
        <ToolBtn onClick={() => execCmd("justifyLeft")} title="Align left">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M3 12h12M3 18h18" /></svg>
        </ToolBtn>
        <ToolBtn onClick={() => execCmd("justifyCenter")} title="Center">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M6 12h12M3 18h18" /></svg>
        </ToolBtn>
        <ToolBtn onClick={() => execCmd("justifyRight")} title="Align right">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M9 12h12M3 18h18" /></svg>
        </ToolBtn>
        <div className="w-px h-5 bg-gray-200 mx-1" />
        <ToolBtn onClick={() => execCmd("insertUnorderedList")} title="Bullet list">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>
        </ToolBtn>
        <ToolBtn onClick={() => execCmd("insertOrderedList")} title="Numbered list">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" /></svg>
        </ToolBtn>
        <div className="w-px h-5 bg-gray-200 mx-1" />
        <ToolBtn onClick={() => execCmd("outdent")} title="Outdent">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 12H9m12 0l-4-4m4 4l-4 4M3 5v14" /></svg>
        </ToolBtn>
        <ToolBtn onClick={() => execCmd("indent")} title="Indent">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12h12m6 0l-4-4m4 4l-4 4M3 5v14" /></svg>
        </ToolBtn>
        <div className="w-px h-5 bg-gray-200 mx-1" />
        <ToolBtn onClick={() => execCmd("undo")} title="Undo">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
        </ToolBtn>
        <ToolBtn onClick={() => execCmd("redo")} title="Redo">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 10H11A3 3 0 003 18v2M21 10l-6 6m6-6l-6-6" /></svg>
        </ToolBtn>
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={(e) => onChange(e.currentTarget.innerHTML)}
        data-placeholder={placeholder}
        className="min-h-[120px] px-3 py-2.5 text-sm text-gray-800 focus:outline-none empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400"
      />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function NewTransmittalClient({
  projectId,
  username,
}: {
  projectId: string;
  username: string;
}) {
  const [directory, setDirectory] = useState<DirectoryContact[]>([]);
  const [nextNumber, setNextNumber] = useState<number>(1);
  const [saveAction, setSaveAction] = useState<"create" | "email" | null>(null);

  // Format doc cache: formatName → FormatDoc[]
  const [formatCache, setFormatCache] = useState<Record<string, FormatDoc[]>>({});
  const fetchingRef = useRef<Set<string>>(new Set());

  // Form fields
  const [subject, setSubject] = useState("");
  const [toId, setToId] = useState<string | null>(null);
  const [ccContacts, setCcContacts] = useState<DirContact[]>([]);
  const [sentVia, setSentVia] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [submittedFor, setSubmittedFor] = useState<string[]>([]);
  const [actionAsNoted, setActionAsNoted] = useState<string[]>([]);
  const [dueBy, setDueBy] = useState("");
  const [sentDate, setSentDate] = useState("");
  const [items, setItems] = useState<TransmittalItem[]>([]);
  const [newItemFormat, setNewItemFormat] = useState("");
  const [comments, setComments] = useState("");
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [attachedFileUrl, setAttachedFileUrl] = useState<string>("");

  useEffect(() => {
    Promise.all([
      fetch(`/api/projects/${projectId}/directory`).then((r) => r.json()),
      fetch(`/api/projects/${projectId}/transmittals`).then((r) => r.json()),
    ]).then(([dirData, tData]) => {
      setDirectory(Array.isArray(dirData) ? dirData : []);
      if (Array.isArray(tData) && tData.length > 0) {
        setNextNumber(Math.max(...tData.map((t: { transmittal_number: number }) => t.transmittal_number)) + 1);
      }
    });
  }, [projectId]);

  // Fetch docs for a given format and cache them
  const loadFormatDocs = useCallback(async (format: string) => {
    if (format in formatCache || fetchingRef.current.has(format)) return;
    const config = FORMAT_API_MAP[format];
    if (!config) {
      setFormatCache((prev) => ({ ...prev, [format]: [] }));
      return;
    }
    fetchingRef.current.add(format);
    try {
      const res = await fetch(`/api/projects/${projectId}/${config.endpoint}`);
      if (!res.ok) { setFormatCache((prev) => ({ ...prev, [format]: [] })); return; }
      const data = await res.json();
      const raw: Record<string, unknown>[] = config.extractList
        ? config.extractList(data)
        : Array.isArray(data) ? data : [];
      const docs: FormatDoc[] = raw.map((i) => ({
        id: (i.id as string) ?? String(Math.random()),
        label: config.getLabel(i),
        date: config.getDate(i),
      }));
      setFormatCache((prev) => ({ ...prev, [format]: docs }));
    } finally {
      fetchingRef.current.delete(format);
    }
  }, [projectId, formatCache]);

  // Pre-fetch docs when new item format is selected
  useEffect(() => {
    if (newItemFormat) loadFormatDocs(newItemFormat);
  }, [newItemFormat, loadFormatDocs]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }

  function toggleCheck(arr: string[], key: string, setArr: (v: string[]) => void) {
    setArr(arr.includes(key) ? arr.filter((k) => k !== key) : [...arr, key]);
  }

  function addItem() {
    if (!newItemFormat) return;
    setItems((prev) => [
      ...prev,
      { id: crypto.randomUUID(), format: newItemFormat, description: "", linkedDocId: "", date: "", copies: "1" },
    ]);
    setNewItemFormat("");
  }

  function updateItem(id: string, patch: Partial<TransmittalItem>) {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function handleFormatChange(id: string, format: string) {
    updateItem(id, { format, description: "", linkedDocId: "", date: "" });
    if (format) loadFormatDocs(format);
  }

  function handleDocSelect(itemId: string, docId: string) {
    const format = items.find((i) => i.id === itemId)?.format ?? "";
    const docs = formatCache[format] ?? [];
    const doc = docs.find((d) => d.id === docId);
    if (doc) {
      updateItem(itemId, { linkedDocId: docId, description: doc.label, date: doc.date });
    } else {
      updateItem(itemId, { linkedDocId: "", description: "", date: "" });
    }
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }

  function handleFileChange(file: File | null) {
    if (attachedFileUrl) URL.revokeObjectURL(attachedFileUrl);
    if (!file) {
      setAttachedFile(null);
      setAttachedFileUrl("");
      return;
    }
    setAttachedFile(file);
    setAttachedFileUrl(URL.createObjectURL(file));
  }

  async function handleSave(sendEmail: boolean) {
    setSaveAction(sendEmail ? "email" : "create");
    const res = await fetch(`/api/projects/${projectId}/transmittals`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subject,
        to_id: toId,
        cc_contacts: ccContacts,
        sent_via: sentVia || null,
        private: isPrivate,
        submitted_for: submittedFor,
        action_as_noted: actionAsNoted,
        due_by: dueBy || null,
        sent_date: sentDate || null,
        items: items.map((item) => ({
          format: item.format,
          description: item.description,
          date: item.date,
          copies: item.copies,
        })),
        comments,
        attachments: attachedFile ? [{ name: attachedFile.name }] : [],
        send_email: sendEmail,
      }),
    });
    if (res.ok) {
      const payload = await res.json();
      if (payload?.email_warning) {
        alert(payload.email_warning);
      }
      window.location.href = `/projects/${projectId}/transmittals`;
    } else {
      setSaveAction(null);
    }
  }

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <header className="bg-[#F9FAFB] border-b border-black/[0.06] px-6 h-14 flex items-center justify-between">
        <a href="/dashboard" className="text-sm font-semibold text-gray-900 hover:text-gray-600 transition-colors">
          SiteCommand
        </a>
        <div className="flex items-center gap-5">
          <span className="text-sm text-gray-400">{username}</span>
          <button onClick={handleLogout} className="text-sm text-gray-400 hover:text-gray-900 transition-colors">
            Logout
          </button>
        </div>
      </header>

      <ProjectNav projectId={projectId} />

      <main className="max-w-7xl mx-auto px-6 py-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-4 text-sm">
          <a href={`/projects/${projectId}/transmittals`} className="text-orange-500 hover:text-orange-600 transition-colors">
            Transmittals
          </a>
          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-gray-600">New Transmittal</span>
        </div>

        <h1 className="font-display text-[28px] leading-tight text-[color:var(--ink)] mb-5">New Transmittal</h1>

        {/* Tab */}
        <div className="border-b border-gray-200 mb-6">
          <button className="px-0 pb-2 text-sm font-medium text-gray-900 border-b-2 border-orange-500 -mb-px mr-6">
            General
          </button>
        </div>

        {/* ── GENERAL INFORMATION ─────────────────────────────────────────── */}
        <section className="mb-8">
          <h2 className="text-xs font-semibold text-gray-900 uppercase tracking-wider mb-4">General Information</h2>

          <div className="grid grid-cols-2 gap-x-12 gap-y-5">
            {/* Number | Subject */}
            <div className="flex items-center gap-6">
              <label className="text-sm text-gray-600 w-24 flex-shrink-0">Number:</label>
              <input
                type="text"
                value={nextNumber}
                readOnly
                className="w-32 px-3 py-2 border border-gray-200 rounded-md text-sm bg-gray-50 text-gray-700"
              />
            </div>
            <div className="flex items-center gap-6">
              <label className="text-sm text-gray-600 w-24 flex-shrink-0">Subject:</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>

            {/* To | CC */}
            <div className="flex items-center gap-6">
              <label className="text-sm text-gray-600 w-24 flex-shrink-0">To:</label>
              <div className="flex-1">
                <SingleUserPicker directory={directory} selectedId={toId} onChange={setToId} />
              </div>
            </div>
            <div className="flex items-center gap-6">
              <label className="text-sm text-gray-600 w-24 flex-shrink-0">CC:</label>
              <div className="flex-1">
                <MultiUserPicker directory={directory} selected={ccContacts} onChange={setCcContacts} />
              </div>
            </div>

            {/* Sent Via | Private */}
            <div className="flex items-center gap-6">
              <label className="text-sm text-gray-600 w-24 flex-shrink-0">Sent Via:</label>
              <select
                value={sentVia}
                onChange={(e) => setSentVia(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white text-gray-700"
              >
                <option value="">Select Delivery Method</option>
                {DELIVERY_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-6">
              <label className="text-sm text-gray-600 w-24 flex-shrink-0 flex items-center gap-1.5">
                <span>Private:</span>
                <span
                  title="Private transmittals can only be viewed by the person who created them."
                  className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-gray-400 text-[10px] leading-none text-gray-500 cursor-help"
                >
                  i
                </span>
              </label>
              <input
                type="checkbox"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-400"
              />
            </div>
          </div>

          {/* Submitted For | Action As Noted */}
          <div className="grid grid-cols-2 gap-x-12 mt-5">
            <div className="flex gap-6">
              <label className="text-sm text-gray-600 w-24 flex-shrink-0 pt-0.5">Submitted For:</label>
              <div className="flex flex-col gap-2">
                {SUBMITTED_FOR_OPTIONS.map((opt) => (
                  <label key={opt.key} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={submittedFor.includes(opt.key)}
                      onChange={() => toggleCheck(submittedFor, opt.key, setSubmittedFor)}
                      className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-400"
                    />
                    <span className="text-sm text-gray-700">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-6">
              <label className="text-sm text-gray-600 w-24 flex-shrink-0 pt-0.5">Action As Noted:</label>
              <div className="flex flex-col gap-2">
                {ACTION_AS_NOTED_OPTIONS.map((opt) => (
                  <label key={opt.key} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={actionAsNoted.includes(opt.key)}
                      onChange={() => toggleCheck(actionAsNoted, opt.key, setActionAsNoted)}
                      className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-400"
                    />
                    <span className="text-sm text-gray-700">{opt.label}</span>
                    {opt.hasDate && opt.key === "due_by" && actionAsNoted.includes(opt.key) && (
                      <input
                        type="date"
                        value={dueBy}
                        onChange={(e) => setDueBy(e.target.value)}
                        className="ml-1 px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-orange-400"
                      />
                    )}
                    {opt.hasDate && opt.key === "sent_date" && actionAsNoted.includes(opt.key) && (
                      <input
                        type="date"
                        value={sentDate}
                        onChange={(e) => setSentDate(e.target.value)}
                        className="ml-1 px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-orange-400"
                      />
                    )}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── ITEMS ──────────────────────────────────────────────────────── */}
        <section className="mb-0">
          <h2 className="text-xs font-semibold text-gray-900 uppercase tracking-wider mb-3">Items</h2>
          <div className="border border-gray-200 rounded-md overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-600 w-40">Format</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-600">Description</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-600 w-36">Date</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-600 w-24"># Copies</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const config = FORMAT_API_MAP[item.format];
                  const docs = formatCache[item.format] ?? null;
                  const hasLinked = config !== null && config !== undefined;
                  const isLoading = hasLinked && docs === null;

                  return (
                    <tr key={item.id} className="border-b border-gray-100">
                      {/* Format */}
                      <td className="px-3 py-2">
                        <select
                          value={item.format}
                          onChange={(e) => handleFormatChange(item.id, e.target.value)}
                          className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-orange-400 bg-white"
                        >
                          {ITEM_FORMATS.map((f) => <option key={f} value={f}>{f}</option>)}
                        </select>
                      </td>

                      {/* Description */}
                      <td className="px-3 py-2">
                        {isLoading ? (
                          <div className="h-8 bg-gray-100 rounded animate-pulse" />
                        ) : hasLinked && docs && docs.length > 0 ? (
                          <select
                            value={item.linkedDocId}
                            onChange={(e) => handleDocSelect(item.id, e.target.value)}
                            className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-orange-400 bg-white"
                          >
                            <option value="">Select...</option>
                            {docs.map((d) => (
                              <option key={d.id} value={d.id}>{d.label}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) => updateItem(item.id, { description: e.target.value })}
                            placeholder={hasLinked && docs && docs.length === 0 ? "No items found" : "Description"}
                            className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
                          />
                        )}
                      </td>

                      {/* Date — auto-filled, still editable */}
                      <td className="px-3 py-2">
                        <input
                          type="date"
                          value={item.date}
                          onChange={(e) => updateItem(item.id, { date: e.target.value })}
                          className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
                        />
                      </td>

                      {/* # Copies */}
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min="1"
                          value={item.copies}
                          onChange={(e) => updateItem(item.id, { copies: e.target.value })}
                          className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
                        />
                      </td>

                      {/* Remove */}
                      <td className="px-2 py-2">
                        <button type="button" onClick={() => removeItem(item.id)} className="text-gray-300 hover:text-red-400 transition-colors">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {/* Add new item row */}
                <tr>
                  <td className="px-3 py-2" colSpan={5}>
                    <div className="flex items-center gap-3">
                      <select
                        value={newItemFormat}
                        onChange={(e) => setNewItemFormat(e.target.value)}
                        className="px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-orange-400 bg-white text-gray-700"
                      >
                        <option value="">Select an Item:</option>
                        {ITEM_FORMATS.map((f) => <option key={f} value={f}>{f}</option>)}
                      </select>
                      {newItemFormat && (
                        <button
                          type="button"
                          onClick={addItem}
                          className="px-3 py-1.5 text-xs font-medium text-white bg-gray-900 rounded-md hover:bg-gray-700 transition-colors"
                        >
                          Add
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Orange divider */}
        <div className="h-0.5 bg-orange-400 my-6" />

        {/* ── COMMENTS ────────────────────────────────────────────────────── */}
        <section className="mb-8">
          <h2 className="text-xs font-semibold text-gray-900 uppercase tracking-wider mb-3">Description</h2>
          <textarea
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            placeholder="Add description..."
            rows={5}
            className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
          <div className="mt-3">
            <label className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-md bg-white hover:bg-gray-50 cursor-pointer">
              Attach file
              <input
                type="file"
                className="hidden"
                onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
              />
            </label>
            {attachedFile && attachedFileUrl && (
              <p className="mt-2 text-sm text-gray-700">
                <a href={attachedFileUrl} download={attachedFile.name} className="text-orange-600 hover:text-orange-700 underline">
                  {attachedFile.name}
                </a>
              </p>
            )}
          </div>
        </section>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
          <a
            href={`/projects/${projectId}/transmittals`}
            className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
          >
            Cancel
          </a>
          <button
            type="button"
            onClick={() => handleSave(true)}
            disabled={saveAction !== null}
            className="px-5 py-2 text-sm font-medium text-white bg-gray-900 rounded-md hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            {saveAction === "email" ? "Creating & Emailing..." : "Create and Email"}
          </button>
          <button
            type="button"
            onClick={() => handleSave(false)}
            disabled={saveAction !== null}
            className="px-5 py-2 text-sm font-medium text-white bg-gray-900 rounded-md hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            {saveAction === "create" ? "Creating..." : "Create"}
          </button>
        </div>
      </main>
    </div>
  );
}
