"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import ProjectNav from "@/components/ProjectNav";

// ── Constants ─────────────────────────────────────────────────────────────────

const TIMEZONES = [
  { label: "(GMT-08:00) Pacific Time (US & Canada)", value: "America/Los_Angeles" },
  { label: "(GMT-07:00) Mountain Time (US & Canada)", value: "America/Denver" },
  { label: "(GMT-06:00) Central Time (US & Canada)", value: "America/Chicago" },
  { label: "(GMT-05:00) Eastern Time (US & Canada)", value: "America/New_York" },
  { label: "(GMT-04:00) Atlantic Time (Canada)", value: "America/Halifax" },
  { label: "(GMT+00:00) UTC", value: "UTC" },
];

function generateTimeOptions(): { label: string; value: string }[] {
  const options: { label: string; value: string }[] = [];
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 30]) {
      const ampm = h < 12 ? "AM" : "PM";
      const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
      const label = `${hour12}:${m === 0 ? "00" : "30"} ${ampm}`;
      const value = `${String(h).padStart(2, "0")}:${m === 0 ? "00" : "30"}`;
      options.push({ label, value });
    }
  }
  return options;
}

const TIME_OPTIONS = generateTimeOptions();

// ── Attendee types ────────────────────────────────────────────────────────────

type DirContact = {
  id: string;
  type: string;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  group_name: string | null;
  email: string | null;
};

type Attendee = { id: string; name: string; email: string | null };

function contactDisplayName(c: DirContact): string {
  if (c.type === "company") return c.company ?? "Unnamed Company";
  if (c.type === "distribution_group") return c.group_name ?? "Unnamed Group";
  return [c.first_name, c.last_name].filter(Boolean).join(" ") || "Unnamed";
}

// ── Attendee Picker ───────────────────────────────────────────────────────────

function AttendeePicker({
  directory,
  selected,
  onChange,
}: {
  directory: DirContact[];
  selected: Attendee[];
  onChange: (v: Attendee[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const selectedIds = new Set(selected.map((s) => s.id));
  const normalizedSearch = search.trim().toLowerCase();
  const selectedKeySet = new Set(
    selected.map((s) => `${s.name.trim().toLowerCase()}|${(s.email ?? "").trim().toLowerCase()}`)
  );
  const filtered = directory.filter(
    (c) =>
      c.type === "user" &&
      !selectedIds.has(c.id) &&
      (contactDisplayName(c).toLowerCase().includes(normalizedSearch) ||
        (c.email ?? "").toLowerCase().includes(normalizedSearch))
  );

  function add(c: DirContact) {
    onChange([...selected, { id: c.id, name: contactDisplayName(c), email: c.email }]);
    setSearch("");
    inputRef.current?.focus();
  }

  function remove(id: string) {
    onChange(selected.filter((s) => s.id !== id));
  }

  function addCustomAttendee(rawValue: string) {
    const value = rawValue.trim();
    if (!value) return;

    const emailLike = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    const name = emailLike ? value.split("@")[0] : value;
    const email = emailLike ? value : null;
    const duplicateKey = `${name.trim().toLowerCase()}|${(email ?? "").trim().toLowerCase()}`;
    if (selectedKeySet.has(duplicateKey)) {
      setSearch("");
      return;
    }

    onChange([
      ...selected,
      {
        id: `custom-${value.toLowerCase()}-${Math.random().toString(36).slice(2, 8)}`,
        name,
        email,
      },
    ]);
    setSearch("");
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {selected.map((a) => (
            <span
              key={a.id}
              className="flex items-center gap-1.5 pl-3 pr-2 py-1 bg-gray-100 text-sm text-gray-700 rounded-full"
            >
              {a.name}
              {a.email && <span className="text-gray-400 text-xs">({a.email})</span>}
              <button
                type="button"
                onClick={() => remove(a.id)}
                className="text-gray-400 hover:text-gray-700 transition-colors ml-0.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        ref={inputRef}
        type="text"
        value={search}
        onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && search.trim()) {
            e.preventDefault();
            const exactDirectoryMatch = filtered.find((c) => {
              const display = contactDisplayName(c).toLowerCase();
              const email = (c.email ?? "").toLowerCase();
              return display === normalizedSearch || email === normalizedSearch;
            });
            if (exactDirectoryMatch) {
              add(exactDirectoryMatch);
              return;
            }
            addCustomAttendee(search);
          }
        }}
        placeholder="Search for attendees..."
        className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
      />
      {open && (
        <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto z-30">
          {filtered.map((c) => (
            <button
              key={c.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => add(c)}
              className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center gap-2 transition-colors"
            >
              <span className="font-medium text-gray-900">{contactDisplayName(c)}</span>
              {c.email && <span className="text-gray-400 text-xs">{c.email}</span>}
            </button>
          ))}
          {search.trim() && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => addCustomAttendee(search)}
              className="w-full text-left px-4 py-2.5 text-sm border-t border-gray-100 hover:bg-gray-50 transition-colors"
            >
              <span className="text-gray-500">Add attendee: </span>
              <span className="font-medium text-gray-900">{search.trim()}</span>
            </button>
          )}
          {!search.trim() && filtered.length === 0 && (
            <p className="px-4 py-2.5 text-sm text-gray-400">Start typing to search the directory.</p>
          )}
          {search.trim() && filtered.length === 0 && (
            <p className="px-4 py-2.5 text-xs text-gray-400 border-t border-gray-100">
              Press Enter to add someone not in the directory.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Simple Rich Text Toolbar ──────────────────────────────────────────────────

const TOOLBAR_BUTTONS = [
  { cmd: "bold", icon: "B", title: "Bold", className: "font-bold" },
  { cmd: "italic", icon: "I", title: "Italic", className: "italic" },
  { cmd: "underline", icon: "U", title: "Underline", className: "underline" },
  { cmd: "strikeThrough", icon: "S", title: "Strikethrough", className: "line-through" },
];

const ALIGN_BUTTONS = [
  { cmd: "justifyLeft", title: "Align Left", icon: (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h10M4 18h12" />
    </svg>
  )},
  { cmd: "justifyCenter", title: "Align Center", icon: (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M7 12h10M6 18h12" />
    </svg>
  )},
  { cmd: "justifyRight", title: "Align Right", icon: (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M10 12h10M8 18h12" />
    </svg>
  )},
];

function RichTextEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const editorRef = useRef<HTMLDivElement>(null);

  function execCmd(cmd: string) {
    editorRef.current?.focus();
    document.execCommand(cmd, false);
    onChange(editorRef.current?.innerHTML ?? "");
  }

  function handleInput() {
    onChange(editorRef.current?.innerHTML ?? "");
  }

  return (
    <div className="border border-gray-200 rounded-md overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-gray-100 bg-gray-50 flex-wrap">
        {/* Text style buttons */}
        {TOOLBAR_BUTTONS.map((btn) => (
          <button
            key={btn.cmd}
            type="button"
            title={btn.title}
            onMouseDown={(e) => { e.preventDefault(); execCmd(btn.cmd); }}
            className={`px-2 py-1 text-xs text-gray-700 rounded hover:bg-gray-200 transition-colors ${btn.className}`}
          >
            {btn.icon}
          </button>
        ))}

        <span className="w-px h-4 bg-gray-200 mx-1" />

        {/* Alignment */}
        {ALIGN_BUTTONS.map((btn) => (
          <button
            key={btn.cmd}
            type="button"
            title={btn.title}
            onMouseDown={(e) => { e.preventDefault(); execCmd(btn.cmd); }}
            className="px-1.5 py-1 text-gray-600 rounded hover:bg-gray-200 transition-colors"
          >
            {btn.icon}
          </button>
        ))}

        <span className="w-px h-4 bg-gray-200 mx-1" />

        {/* Lists */}
        <button
          type="button"
          title="Bullet List"
          onMouseDown={(e) => { e.preventDefault(); execCmd("insertUnorderedList"); }}
          className="px-1.5 py-1 text-gray-600 rounded hover:bg-gray-200 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
          </svg>
        </button>
        <button
          type="button"
          title="Numbered List"
          onMouseDown={(e) => { e.preventDefault(); execCmd("insertOrderedList"); }}
          className="px-1.5 py-1 text-gray-600 rounded hover:bg-gray-200 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h10M7 16h10M3 8h.01M3 12h.01M3 16h.01" />
          </svg>
        </button>

        <span className="w-px h-4 bg-gray-200 mx-1" />

        {/* Undo/Redo */}
        <button
          type="button"
          title="Undo"
          onMouseDown={(e) => { e.preventDefault(); execCmd("undo"); }}
          className="px-1.5 py-1 text-gray-600 rounded hover:bg-gray-200 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 010 16H3m0-16l4-4M3 10l4 4" />
          </svg>
        </button>
        <button
          type="button"
          title="Redo"
          onMouseDown={(e) => { e.preventDefault(); execCmd("redo"); }}
          className="px-1.5 py-1 text-gray-600 rounded hover:bg-gray-200 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 10H11a8 8 0 000 16h10m0-16l-4-4m4 4l-4 4" />
          </svg>
        </button>
      </div>

      {/* Editor area */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        className="min-h-[160px] px-4 py-3 text-sm text-gray-900 focus:outline-none"
        style={{ lineHeight: "1.6" }}
      />
    </div>
  );
}

// ── Attachment upload area ────────────────────────────────────────────────────

function AttachmentZone({
  files,
  onChange,
}: {
  files: File[];
  onChange: (files: File[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function handleFiles(newFiles: FileList | null) {
    if (!newFiles) return;
    onChange([...files, ...Array.from(newFiles)]);
  }

  function removeFile(i: number) {
    onChange(files.filter((_, idx) => idx !== i));
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
      className={`border-2 border-dashed rounded-md transition-colors ${dragging ? "border-blue-400 bg-blue-50" : "border-gray-200 bg-white"} min-h-[160px] flex flex-col items-center justify-center gap-3 p-4`}
    >
      {files.length === 0 ? (
        <>
          <div className="w-14 h-14 bg-gray-100 rounded-lg flex items-center justify-center">
            <svg className="w-7 h-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M4.5 19.5h15a.75.75 0 00.75-.75V6.75A.75.75 0 0019.5 6h-15a.75.75 0 00-.75.75v12c0 .414.336.75.75.75z" />
            </svg>
          </div>
          <input ref={inputRef} type="file" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors bg-white"
          >
            Attach Files
          </button>
          <p className="text-xs text-gray-400">or Drag &amp; Drop</p>
        </>
      ) : (
        <div className="w-full space-y-2">
          {files.map((f, i) => (
            <div key={i} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-md border border-gray-100">
              <div className="flex items-center gap-2 min-w-0">
                <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                <span className="text-xs text-gray-700 truncate">{f.name}</span>
                <span className="text-xs text-gray-400 shrink-0">{(f.size / 1024).toFixed(0)} KB</span>
              </div>
              <button type="button" onClick={() => removeFile(i)} className="text-gray-400 hover:text-gray-700 ml-2">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
          <input ref={inputRef} type="file" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors mt-1"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add more files
          </button>
        </div>
      )}
    </div>
  );
}

// ── Date input with clear button ──────────────────────────────────────────────

function DateInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative flex items-center">
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 pr-8 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-2 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function NewMeetingClient({
  projectId,
  username,
}: {
  projectId: string;
  username: string;
}) {
  const [meetingNumber, setMeetingNumber] = useState(1);
  const [name, setName] = useState("");
  const [meetingLink, setMeetingLink] = useState("");
  const [location, setLocation] = useState("");
  const [date, setDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });
  const [timezone, setTimezone] = useState("America/New_York");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [isPrivate, setIsPrivate] = useState(true);
  const [isDraft, setIsDraft] = useState(false);
  const [overview, setOverview] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [directory, setDirectory] = useState<DirContact[]>([]);
  const [showAttendees, setShowAttendees] = useState(false);
  const [infoExpanded, setInfoExpanded] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Fetch directory + next meeting number
  useEffect(() => {
    Promise.all([
      fetch(`/api/projects/${projectId}/directory`).then((r) => r.json()),
      fetch(`/api/projects/${projectId}/meetings`, { method: "HEAD" }),
    ]).then(([dirData, headRes]) => {
      setDirectory(Array.isArray(dirData) ? dirData : []);
      const nextNum = headRes.headers.get("x-next-number");
      if (nextNum) setMeetingNumber(Number(nextNum));
    }).catch(() => {});
  }, [projectId]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Meeting Name is required."); return; }
    setError("");
    setSubmitting(true);

    const res = await fetch(`/api/projects/${projectId}/meetings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        meeting_number: meetingNumber,
        title: name,
        meeting_link: meetingLink,
        location,
        date: date || null,
        timezone,
        start_time: startTime || null,
        end_time: endTime || null,
        is_private: isPrivate,
        is_draft: isDraft,
        overview,
        attendees,
        status: isDraft ? "draft" : "scheduled",
      }),
    });

    if (res.ok) {
      const meeting = await res.json();
      const failedUploads: string[] = [];

      for (const file of attachments) {
        const formData = new FormData();
        formData.append("file", file);
        const uploadRes = await fetch(`/api/projects/${projectId}/meetings/${meeting.id}/attachment`, {
          method: "POST",
          body: formData,
        });
        if (!uploadRes.ok) failedUploads.push(file.name);
      }

      if (failedUploads.length > 0) {
        setError(`Meeting created, but failed to upload attachment${failedUploads.length > 1 ? "s" : ""}: ${failedUploads.join(", ")}.`);
        setSubmitting(false);
        return;
      }

      window.location.href = `/projects/${projectId}/meetings/${meeting.id}`;
    } else {
      const err = await res.json();
      setError(err.error ?? "Failed to create meeting.");
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col">
      {/* Top nav bar */}
      <header className="bg-[#F9FAFB] border-b border-black/[0.06] px-6 h-14 flex items-center justify-between shrink-0">
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

      <form onSubmit={handleSubmit} className="flex-1 flex flex-col">
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-6 py-6 space-y-4">
            {/* Breadcrumb */}
            <nav className="flex items-center gap-2 text-sm text-gray-500">
              <a
                href={`/projects/${projectId}/meetings`}
                className="hover:text-gray-900 transition-colors"
              >
                Meetings
              </a>
              <svg className="w-3.5 h-3.5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
              <span className="text-gray-700">Create Meeting</span>
            </nav>

            {/* Page title */}
            <h1 className="font-display text-[24px] leading-tight text-[color:var(--ink)]">New Meeting: No Template</h1>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {/* Meeting Information card */}
            <div className="bg-white border border-gray-200 rounded-lg overflow-visible">
              {/* Section header */}
              <button
                type="button"
                onClick={() => setInfoExpanded((o) => !o)}
                className="w-full flex items-center gap-2 px-6 py-4 border-b border-gray-100 hover:bg-gray-50 transition-colors text-left"
              >
                <svg
                  className={`w-4 h-4 text-gray-500 transition-transform shrink-0 ${infoExpanded ? "" : "-rotate-90"}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
                <span className="font-semibold text-gray-900">Meeting Information</span>
              </button>

              {infoExpanded && (
                <div className="px-6 py-6 space-y-6">
                  {/* Row 1: Number + Name */}
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Number <span className="text-red-500">*</span>
                      </label>
                      <div className="flex items-stretch">
                        <input
                          type="number"
                          value={meetingNumber}
                          onChange={(e) => setMeetingNumber(Number(e.target.value))}
                          min={1}
                          className="flex-1 px-3 py-2 border border-gray-200 rounded-l-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
                        />
                        <div className="flex flex-col border border-l-0 border-gray-200 rounded-r-md overflow-hidden">
                          <button
                            type="button"
                            onClick={() => setMeetingNumber((n) => n + 1)}
                            className="flex-1 px-2 text-gray-500 hover:bg-gray-50 border-b border-gray-200 transition-colors text-xs leading-none flex items-center justify-center"
                          >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => setMeetingNumber((n) => Math.max(1, n - 1))}
                            className="flex-1 px-2 text-gray-500 hover:bg-gray-50 transition-colors text-xs leading-none flex items-center justify-center"
                          >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Enter Meeting Name"
                        className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                      />
                    </div>
                  </div>

                  {/* Row 2: Meeting Link + Location */}
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Meeting Link</label>
                      <input
                        type="url"
                        value={meetingLink}
                        onChange={(e) => setMeetingLink(e.target.value)}
                        placeholder="Enter Meeting Link"
                        className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Location</label>
                      <input
                        type="text"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        placeholder="Enter Meeting Location"
                        className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                      />
                    </div>
                  </div>

                  {/* Row 3: Date + Timezone + Start Time + End Time */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Date</label>
                      <DateInput value={date} onChange={setDate} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Timezone</label>
                      <div className="relative">
                        <select
                          value={timezone}
                          onChange={(e) => setTimezone(e.target.value)}
                          className="w-full px-3 py-2 pr-8 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white appearance-none"
                        >
                          {TIMEZONES.map((tz) => (
                            <option key={tz.value} value={tz.value}>{tz.label}</option>
                          ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center gap-1">
                          {timezone && (
                            <button
                              type="button"
                              className="pointer-events-auto text-gray-400 hover:text-gray-600"
                              onClick={() => setTimezone("America/New_York")}
                            >
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          )}
                          <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Start Time</label>
                      <div className="relative">
                        <select
                          value={startTime}
                          onChange={(e) => setStartTime(e.target.value)}
                          className="w-full px-3 py-2 pr-8 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white appearance-none"
                        >
                          <option value="">Select Meeting Start Time</option>
                          {TIME_OPTIONS.map((t) => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                          ))}
                        </select>
                        <svg className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">End Time</label>
                      <div className="relative">
                        <select
                          value={endTime}
                          onChange={(e) => setEndTime(e.target.value)}
                          className="w-full px-3 py-2 pr-8 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white appearance-none"
                        >
                          <option value="">Select Meeting End Time</option>
                          {TIME_OPTIONS.map((t) => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                          ))}
                        </select>
                        <svg className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* Row 4: Private + Draft checkboxes */}
                  <div className="grid grid-cols-2 gap-6">
                    <label className="flex items-start gap-3 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={isPrivate}
                        onChange={(e) => setIsPrivate(e.target.checked)}
                        className="mt-0.5 w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div>
                        <p className="text-sm font-medium text-gray-900">Private Meeting</p>
                        <p className="text-xs text-gray-500 mt-0.5">Visible only to meeting admins and scheduled attendees</p>
                      </div>
                    </label>
                    <label className="flex items-start gap-3 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={isDraft}
                        onChange={(e) => setIsDraft(e.target.checked)}
                        className="mt-0.5 w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div>
                        <p className="text-sm font-medium text-gray-900">Draft Meeting</p>
                        <p className="text-xs text-gray-500 mt-0.5">Meeting will be in draft state.</p>
                      </div>
                    </label>
                  </div>

                  {/* Row 5: Overview + Attachments */}
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Overview</label>
                      <RichTextEditor value={overview} onChange={setOverview} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Attachments</label>
                      <AttachmentZone files={attachments} onChange={setAttachments} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Attendees section */}
            <div className="bg-white border border-gray-200 rounded-lg overflow-visible">
              <div className="flex items-center justify-between px-6 py-4">
                <div>
                  <h2 className="text-base font-semibold text-gray-900">Attendees</h2>
                  <p className="text-sm text-gray-500 mt-0.5">You can add any attendees you want to schedule for the meeting.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAttendees((o) => !o)}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  Add Attendees
                </button>
              </div>
              {(showAttendees || attendees.length > 0) && (
                <div className="border-t border-gray-100 px-6 py-4">
                  <AttendeePicker
                    directory={directory}
                    selected={attendees}
                    onChange={setAttendees}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sticky footer */}
        <div className="bg-white border-t border-gray-200 px-6 py-4 flex items-center justify-between shrink-0">
          <p className="text-xs text-gray-400">* Required fields</p>
          <div className="flex items-center gap-3">
            <a
              href={`/projects/${projectId}/meetings`}
              className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
            >
              Cancel
            </a>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 text-sm font-medium text-white rounded-md transition-colors disabled:opacity-50"
              style={{ backgroundColor: "#d4500a" }}
            >
              {submitting ? "Creating..." : "Create and Proceed to Agenda"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
