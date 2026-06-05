"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import ProjectNav from "@/components/ProjectNav";

// ── Types ─────────────────────────────────────────────────────────────────────

type Attendee = { id: string; name: string; email: string | null };

type AgendaItem = {
  id: string;
  title: string;
  status: "open" | "in_progress" | "closed";
  notes: string;
};

type AgendaCategory = {
  id: string;
  name: string;
  collapsed: boolean;
  items: AgendaItem[];
};

type Meeting = {
  id: string;
  meeting_number: number;
  title: string;
  series: string | null;
  overview: string | null;
  date: string | null;
  end_date: string | null;
  location: string | null;
  status: string;
  agenda_items_count: number;
  template: string | null;
  is_locked: boolean;
  is_private: boolean;
  is_draft: boolean;
  meeting_link: string | null;
  timezone: string | null;
  start_time: string | null;
  end_time: string | null;
  attendees: Attendee[];
  notes: string | null;
  attachments: { name: string; url: string }[];
  agenda: AgendaCategory[];
  deleted_at: string | null;
  created_at: string;
};

type DirContact = {
  id: string;
  type: string;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  group_name: string | null;
  email: string | null;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function contactDisplayName(c: DirContact): string {
  return [c.first_name, c.last_name].filter(Boolean).join(" ") || c.email || "Unnamed";
}

function formatDate(d: string | null): string {
  if (!d) return "--";
  return new Date(d).toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "numeric" });
}

function formatTime(t: string | null): string {
  if (!t) return "--";
  const [h, m] = t.split(":").map(Number);
  const ampm = h < 12 ? "AM" : "PM";
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function tzLabel(tz: string | null): string {
  if (!tz) return "--";
  const map: Record<string, string> = {
    "America/Los_Angeles": "(GMT-08:00) Pacific Time (US & Canada)",
    "America/Denver": "(GMT-07:00) Mountain Time (US & Canada)",
    "America/Chicago": "(GMT-06:00) Central Time (US & Canada)",
    "America/New_York": "(GMT-05:00) Eastern Time (US & Canada)",
    "America/Halifax": "(GMT-04:00) Atlantic Time (Canada)",
    "UTC": "(GMT+00:00) UTC",
  };
  return map[tz] ?? tz;
}

const STATUS_LABELS: Record<string, string> = {
  scheduled: "Scheduled",
  awaiting_minutes: "Awaiting Minutes",
  minutes_approved: "Minutes Approved",
  cancelled: "Cancelled",
  draft: "Draft",
};

const STATUS_COLORS: Record<string, string> = {
  scheduled: "bg-blue-50 text-blue-700 border-blue-200",
  awaiting_minutes: "bg-orange-50 text-orange-600 border-orange-200",
  minutes_approved: "bg-green-50 text-green-700 border-green-200",
  cancelled: "bg-gray-100 text-gray-500 border-gray-200",
  draft: "bg-gray-100 text-gray-500 border-gray-200",
};

const ITEM_STATUS_LABELS: Record<string, string> = {
  open: "Open",
  in_progress: "In Progress",
  closed: "Closed",
};

const ITEM_STATUS_COLORS: Record<string, string> = {
  open: "bg-blue-50 text-blue-700",
  in_progress: "bg-amber-50 text-amber-700",
  closed: "bg-gray-100 text-gray-500",
};

function genId(): string {
  return Math.random().toString(36).slice(2, 10);
}

// ── Attendee Picker Dropdown ──────────────────────────────────────────────────

function AttendeePickerDropdown({
  directory,
  selected,
  onAdd,
  onClose,
}: {
  directory: DirContact[];
  selected: Attendee[];
  onAdd: (a: Attendee) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  const selectedIds = new Set(selected.map((s) => s.id));
  const users = directory.filter((c) => c.type === "user");
  const filtered = users.filter(
    (c) =>
      !selectedIds.has(c.id) &&
      (contactDisplayName(c).toLowerCase().includes(search.toLowerCase()) ||
        (c.email ?? "").toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div
      ref={ref}
      className="absolute right-0 top-10 w-72 bg-white border border-gray-200 rounded-lg shadow-xl z-40"
    >
      <div className="p-2 border-b border-gray-100">
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search users..."
          className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
        />
      </div>
      <div className="max-h-60 overflow-y-auto py-1">
        {filtered.length === 0 ? (
          <p className="px-4 py-3 text-sm text-gray-400">
            {users.length === 0 ? "No users in directory" : "No matches found"}
          </p>
        ) : (
          filtered.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                onAdd({ id: c.id, name: contactDisplayName(c), email: c.email });
              }}
              className="w-full text-left px-4 py-2.5 hover:bg-gray-50 transition-colors flex items-center gap-3"
            >
              <span className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-xs font-semibold text-gray-600 shrink-0">
                {contactDisplayName(c).charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{contactDisplayName(c)}</p>
                {c.email && <p className="text-xs text-gray-400 truncate">{c.email}</p>}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

// ── Rich Text Notes Editor ────────────────────────────────────────────────────

function NotesEditor({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const editorRef = useRef<HTMLDivElement>(null);

  function execCmd(cmd: string, val?: string) {
    editorRef.current?.focus();
    document.execCommand(cmd, false, val);
    onChange(editorRef.current?.innerHTML ?? "");
  }

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-gray-100 bg-gray-50 flex-wrap">
        {[
          { cmd: "bold", label: "B", cls: "font-bold", title: "Bold" },
          { cmd: "italic", label: "I", cls: "italic", title: "Italic" },
          { cmd: "underline", label: "U", cls: "underline", title: "Underline" },
          { cmd: "strikeThrough", label: "S", cls: "line-through", title: "Strikethrough" },
        ].map((b) => (
          <button
            key={b.cmd}
            type="button"
            title={b.title}
            onMouseDown={(e) => { e.preventDefault(); execCmd(b.cmd); }}
            className={`px-2 py-1 text-xs text-gray-700 rounded hover:bg-gray-200 transition-colors ${b.cls}`}
          >
            {b.label}
          </button>
        ))}
        <span className="w-px h-4 bg-gray-200 mx-1" />
        <button type="button" title="Bullet List" onMouseDown={(e) => { e.preventDefault(); execCmd("insertUnorderedList"); }}
          className="px-1.5 py-1 text-gray-600 rounded hover:bg-gray-200 transition-colors text-xs">
          • List
        </button>
        <button type="button" title="Numbered List" onMouseDown={(e) => { e.preventDefault(); execCmd("insertOrderedList"); }}
          className="px-1.5 py-1 text-gray-600 rounded hover:bg-gray-200 transition-colors text-xs">
          1. List
        </button>
        <span className="w-px h-4 bg-gray-200 mx-1" />
        <button type="button" title="Undo" onMouseDown={(e) => { e.preventDefault(); execCmd("undo"); }}
          className="px-1.5 py-1 text-gray-600 rounded hover:bg-gray-200 transition-colors text-xs">↩</button>
        <button type="button" title="Redo" onMouseDown={(e) => { e.preventDefault(); execCmd("redo"); }}
          className="px-1.5 py-1 text-gray-600 rounded hover:bg-gray-200 transition-colors text-xs">↪</button>
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={() => onChange(editorRef.current?.innerHTML ?? "")}
        data-placeholder={placeholder ?? "Write notes here..."}
        className="min-h-[140px] px-4 py-3 text-sm text-gray-900 focus:outline-none empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400"
        style={{ lineHeight: "1.6" }}
      />
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function MeetingDetailClient({
  projectId,
  meetingId,
  username,
}: {
  projectId: string;
  meetingId: string;
  username: string;
}) {
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [directory, setDirectory] = useState<DirContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("details");
  const [relatedItems, setRelatedItems] = useState<Array<{ id: string; type: string; label: string; notes: string }>>([]);
  const [relatedType, setRelatedType] = useState("Change Event");
  const [relatedLabel, setRelatedLabel] = useState("");
  const [relatedNotes, setRelatedNotes] = useState("");
  const [creatingChangeEvent, setCreatingChangeEvent] = useState(false);

  // Section collapse state
  const [infoExpanded, setInfoExpanded] = useState(true);
  const [attendeesExpanded, setAttendeesExpanded] = useState(true);
  const [agendaExpanded, setAgendaExpanded] = useState(true);
  const [notesExpanded, setNotesExpanded] = useState(true);

  // Attendees
  const [showAttendeePicker, setShowAttendeePicker] = useState(false);
  const attendeeRef = useRef<HTMLDivElement>(null);

  // Agenda
  const [statusFilter, setStatusFilter] = useState("");
  const [agenda, setAgenda] = useState<AgendaCategory[]>([]);
  const [newItemText, setNewItemText] = useState<Record<string, string>>({});
  const [addingItemIn, setAddingItemIn] = useState<string | null>(null);
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  // Notes
  const [notes, setNotes] = useState("");
  const [saveTimer, setSaveTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  // Load meeting + directory
  useEffect(() => {
    Promise.all([
      fetch(`/api/projects/${projectId}/meetings/${meetingId}`).then((r) => r.json()),
      fetch(`/api/projects/${projectId}/directory`).then((r) => r.json()),
    ]).then(([m, dir]) => {
      if (m && !m.error) {
        setMeeting(m);
        setNotes(m.notes ?? "");
        // Ensure default "Uncategorized Items" category exists
        const ag: AgendaCategory[] = Array.isArray(m.agenda) && m.agenda.length > 0
          ? m.agenda
          : [{ id: genId(), name: "Uncategorized Items", collapsed: false, items: [] }];
        setAgenda(ag);
      }
      setDirectory(Array.isArray(dir) ? dir : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [projectId, meetingId]);

  // Auto-save helper
  function autosave(patch: Record<string, unknown>) {
    if (saveTimer) clearTimeout(saveTimer);
    const t = setTimeout(() => {
      fetch(`/api/projects/${projectId}/meetings/${meetingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
    }, 800);
    setSaveTimer(t);
  }

  // Attendee handlers
  function addAttendee(a: Attendee) {
    if (!meeting) return;
    const updated = [...(meeting.attendees ?? []), a];
    setMeeting({ ...meeting, attendees: updated });
    setShowAttendeePicker(false);
    autosave({ attendees: updated });
  }

  function removeAttendee(id: string) {
    if (!meeting) return;
    const updated = (meeting.attendees ?? []).filter((a) => a.id !== id);
    setMeeting({ ...meeting, attendees: updated });
    autosave({ attendees: updated });
  }

  // Agenda handlers
  function toggleCategory(catId: string) {
    const updated = agenda.map((c) =>
      c.id === catId ? { ...c, collapsed: !c.collapsed } : c
    );
    setAgenda(updated);
    autosave({ agenda: updated });
  }

  function expandAll() {
    const updated = agenda.map((c) => ({ ...c, collapsed: false }));
    setAgenda(updated);
    autosave({ agenda: updated });
  }

  function addCategory() {
    if (!newCategoryName.trim()) return;
    const updated = [
      ...agenda,
      { id: genId(), name: newCategoryName.trim(), collapsed: false, items: [] },
    ];
    setAgenda(updated);
    setNewCategoryName("");
    setAddingCategory(false);
    autosave({ agenda: updated });
  }

  function addItem(catId: string) {
    const text = (newItemText[catId] ?? "").trim();
    if (!text) return;
    const newItem: AgendaItem = { id: genId(), title: text, status: "open", notes: "" };
    const updated = agenda.map((c) =>
      c.id === catId ? { ...c, items: [...c.items, newItem] } : c
    );
    setAgenda(updated);
    setNewItemText((prev) => ({ ...prev, [catId]: "" }));
    setAddingItemIn(null);
    // Update count on meeting
    const total = updated.reduce((sum, c) => sum + c.items.length, 0);
    if (meeting) setMeeting({ ...meeting, agenda_items_count: total });
    autosave({ agenda: updated });
  }

  function updateItemStatus(catId: string, itemId: string, status: AgendaItem["status"]) {
    const updated = agenda.map((c) =>
      c.id === catId
        ? { ...c, items: c.items.map((i) => (i.id === itemId ? { ...i, status } : i)) }
        : c
    );
    setAgenda(updated);
    autosave({ agenda: updated });
  }

  function removeItem(catId: string, itemId: string) {
    const updated = agenda.map((c) =>
      c.id === catId ? { ...c, items: c.items.filter((i) => i.id !== itemId) } : c
    );
    setAgenda(updated);
    autosave({ agenda: updated });
  }

  // Notes auto-save
  function handleNotesChange(v: string) {
    setNotes(v);
    autosave({ notes: v });
  }

  async function handleCreateChangeEvent() {
    if (creatingChangeEvent) return;
    setCreatingChangeEvent(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/meetings/${meetingId}/create-change-event`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.id) {
        throw new Error(typeof data?.error === "string" ? data.error : "Unable to create a change event from this meeting.");
      }
      window.location.href = `/projects/${projectId}/change-events/${data.id}`;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to create a change event from this meeting.";
      window.alert(message);
      setCreatingChangeEvent(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center">
        <div className="text-sm text-gray-400">Loading meeting...</div>
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center">
        <div className="text-sm text-gray-500">Meeting not found.</div>
      </div>
    );
  }

  const statusLabel = STATUS_LABELS[meeting.status] ?? meeting.status;
  const statusColor = STATUS_COLORS[meeting.status] ?? "bg-gray-100 text-gray-500 border-gray-200";

  const filteredAgenda = statusFilter
    ? agenda.map((c) => ({
        ...c,
        items: c.items.filter((i) => i.status === statusFilter),
      }))
    : agenda;

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      {/* Top nav bar */}
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

      <main className="px-6 pb-12">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-gray-500 pt-4 pb-2">
          <a href={`/projects/${projectId}/meetings`} className="hover:text-gray-900 transition-colors">
            Meetings
          </a>
          <svg className="w-3.5 h-3.5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-gray-700 truncate max-w-xs">{meeting.title}</span>
        </nav>

        {/* Page title row */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="font-display text-[24px] leading-tight text-[color:var(--ink)]">
              Meeting Agenda for {meeting.title}
            </h1>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusColor}`}>
              {statusLabel}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              className="px-4 py-2 text-sm font-medium text-white rounded-md transition-colors"
              style={{ backgroundColor: "#d4500a" }}
            >
              Convert to Minutes
            </button>
            <button
              onClick={handleCreateChangeEvent}
              disabled={creatingChangeEvent}
              className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors bg-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {creatingChangeEvent ? "Creating..." : "Create Change Event"}
            </button>
            <button className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors bg-white">
              Export
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-0 border-b border-gray-200 mb-6 bg-white -mx-6 px-6">
          {[
            { key: "details", label: "Meeting Details" },
            { key: "related", label: `Related Items (${relatedItems.length})` },
            { key: "emails", label: "Emails (0)" },
            { key: "history", label: "Change History (0)" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.key
                  ? "border-gray-900 text-gray-900"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "related" && (
          <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
            <h3 className="text-sm font-semibold text-gray-900">Related Items</h3>
            {relatedItems.length === 0 ? (
              <p className="text-sm text-gray-500">No related items yet.</p>
            ) : (
              <ul className="space-y-2">
                {relatedItems.map((item) => (
                  <li key={item.id} className="rounded border border-gray-100 px-3 py-2 text-sm">
                    <div className="font-medium text-gray-900">{item.label}</div>
                    <div className="text-xs text-gray-500">{item.type}</div>
                    {item.notes ? <div className="text-xs text-gray-500 mt-1">{item.notes}</div> : null}
                  </li>
                ))}
              </ul>
            )}
            <div className="rounded border border-gray-200 bg-gray-50 p-3 space-y-3">
              <label className="block text-xs font-medium text-gray-700">
                Link Related Items
                <select
                  value={relatedType}
                  onChange={(e) => {
                    setRelatedType(e.target.value);
                    setRelatedLabel("");
                  }}
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm bg-white"
                >
                  <option>Change Event</option>
                  <option>RFI</option>
                  <option>Submittal</option>
                  <option>Transmittal</option>
                  <option>Punch Item</option>
                </select>
              </label>
              <label className="block text-xs font-medium text-gray-700">
                {`Select the ${relatedType}`}
                <input
                  value={relatedLabel}
                  onChange={(e) => setRelatedLabel(e.target.value)}
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                  placeholder={`Select the ${relatedType}`}
                />
              </label>
              {relatedLabel.trim() && (
                <label className="block text-xs font-medium text-gray-700">
                  Add Comment
                  <textarea
                    value={relatedNotes}
                    onChange={(e) => setRelatedNotes(e.target.value)}
                    className="mt-1 w-full min-h-16 rounded border border-gray-300 px-2 py-1.5 text-sm"
                    placeholder="Add comment..."
                  />
                </label>
              )}
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                disabled={!relatedLabel.trim()}
                onClick={() => {
                  if (!relatedLabel.trim()) return;
                  setRelatedItems((prev) => [...prev, { id: `${Date.now()}`, type: relatedType, label: relatedLabel.trim(), notes: relatedNotes.trim() }]);
                  setRelatedLabel("");
                  setRelatedNotes("");
                }}
                className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
              >
                Add Related Item
              </button>
            </div>
          </div>
        )}

        {activeTab === "details" && <div className="space-y-4 max-w-7xl">
          {/* ── Meeting Information ──────────────────────────────────────── */}
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <button
                type="button"
                onClick={() => setInfoExpanded((o) => !o)}
                className="flex items-center gap-2 text-left"
              >
                <svg
                  className={`w-4 h-4 text-gray-500 transition-transform shrink-0 ${infoExpanded ? "" : "-rotate-90"}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
                <span className="font-semibold text-gray-900">Meeting Information</span>
              </button>
              <a
                href={`/projects/${projectId}/meetings/${meetingId}/edit`}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                Edit
              </a>
            </div>

            {infoExpanded && (
              <div className="px-6 py-5">
                <div className="grid grid-cols-2 gap-x-12 gap-y-5 text-sm">
                  {/* Row 1: Number | Name */}
                  <InfoField label="Number" value={String(meeting.meeting_number)} isLink />
                  <InfoField label="Name" value={meeting.title} isLink />

                  {/* Row 2: Meeting Link | Location */}
                  <InfoField label="Meeting Link" value={meeting.meeting_link} isLink={!!meeting.meeting_link} />
                  <InfoField label="Location" value={meeting.location} />

                  {/* Row 3: Date | Timezone | Start Time | End Time (4-col) */}
                  <div className="col-span-2 grid grid-cols-4 gap-x-8 gap-y-5">
                    <InfoField label="Date" value={formatDate(meeting.date)} />
                    <InfoField label="Timezone" value={tzLabel(meeting.timezone)} isBlue />
                    <InfoField label="Start Time" value={formatTime(meeting.start_time)} />
                    <InfoField label="End Time" value={formatTime(meeting.end_time)} />
                  </div>

                  {/* Row 4: Private | Draft */}
                  <InfoField label="Private Meeting" value={meeting.is_private ? "Yes" : "No"} />
                  <InfoField label="Draft Meeting" value={meeting.is_draft ? "Yes" : "No"} />

                  {/* Row 5: Overview | Attachments */}
                  <InfoField label="Overview" value={meeting.overview} isHtml />
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">Attachments</p>
                    {(meeting.attachments ?? []).length === 0 ? (
                      <p className="text-sm text-gray-400">--</p>
                    ) : (
                      <ul className="space-y-1">
                        {meeting.attachments.map((attachment, index) => (
                          <li key={`${attachment.url}-${index}`}>
                            <a
                              href={attachment.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-blue-600 hover:underline break-all"
                            >
                              {attachment.name}
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Row 6: Notes (full width) */}
                  <div className="col-span-2">
                    <InfoField label="Notes" value={meeting.notes} isHtml />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Attendees ────────────────────────────────────────────────── */}
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <button
                type="button"
                onClick={() => setAttendeesExpanded((o) => !o)}
                className="flex items-center gap-2 text-left"
              >
                <svg
                  className={`w-4 h-4 text-gray-500 transition-transform shrink-0 ${attendeesExpanded ? "" : "-rotate-90"}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
                <span className="font-semibold text-gray-900">Attendees</span>
              </button>
              <div ref={attendeeRef} className="relative">
                <button
                  type="button"
                  onClick={() => setShowAttendeePicker((o) => !o)}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors bg-white"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  Add Attendees
                </button>
                {showAttendeePicker && (
                  <AttendeePickerDropdown
                    directory={directory}
                    selected={meeting.attendees ?? []}
                    onAdd={addAttendee}
                    onClose={() => setShowAttendeePicker(false)}
                  />
                )}
              </div>
            </div>

            {attendeesExpanded && (
              <div className="px-6 py-4">
                {(meeting.attendees ?? []).length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-3">
                    {/* Empty state illustration */}
                    <div className="relative w-20 h-16">
                      <div className="absolute inset-0 bg-gray-200 rounded border-2 border-gray-300" />
                      <div className="absolute top-1 left-1 right-1 h-2 bg-blue-300 rounded-sm" />
                      <div className="absolute top-4 left-1 right-1 bottom-1 bg-white rounded-sm border border-gray-200" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-gray-900">There Are No Attendees to Display Right Now</p>
                      <p className="text-xs text-gray-500 mt-1">
                        Once attendees have been added, you can{" "}
                        <button type="button" onClick={() => setShowAttendeePicker(true)} className="text-blue-600 hover:underline">
                          view them here.
                        </button>
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {meeting.attendees.map((a) => (
                      <div key={a.id} className="flex items-center gap-2 p-2.5 border border-gray-100 rounded-lg bg-gray-50 group">
                        <span className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-xs font-semibold text-gray-600 shrink-0">
                          {a.name.charAt(0).toUpperCase()}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-900 truncate">{a.name}</p>
                          {a.email && <p className="text-xs text-gray-400 truncate">{a.email}</p>}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeAttendee(a.id)}
                          className="text-gray-300 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Agenda ───────────────────────────────────────────────────── */}
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <button
                type="button"
                onClick={() => setAgendaExpanded((o) => !o)}
                className="flex items-center gap-2 text-left"
              >
                <svg
                  className={`w-4 h-4 text-gray-500 transition-transform shrink-0 ${agendaExpanded ? "" : "-rotate-90"}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
                <span className="font-semibold text-gray-900">Agenda</span>
              </button>
              <div className="flex items-center gap-2">
                {/* Status filter */}
                <div className="relative">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="pl-3 pr-7 py-1.5 border border-gray-200 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 appearance-none text-gray-600"
                  >
                    <option value="">Status Filter</option>
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="closed">Closed</option>
                  </select>
                  <svg className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
                <button
                  type="button"
                  onClick={expandAll}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors bg-white"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                  </svg>
                  Expand All
                </button>
                <button
                  type="button"
                  onClick={() => setAddingCategory(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors bg-white"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  Add Category
                </button>
              </div>
            </div>

            {agendaExpanded && (
              <div>
                {/* Add Category input */}
                {addingCategory && (
                  <div className="px-6 py-3 border-b border-gray-100 flex items-center gap-2">
                    <input
                      autoFocus
                      type="text"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") addCategory();
                        if (e.key === "Escape") { setAddingCategory(false); setNewCategoryName(""); }
                      }}
                      placeholder="Category name..."
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                    />
                    <button type="button" onClick={addCategory}
                      className="px-3 py-2 text-sm font-medium text-white bg-gray-900 rounded-md hover:bg-gray-700 transition-colors">
                      Add
                    </button>
                    <button type="button" onClick={() => { setAddingCategory(false); setNewCategoryName(""); }}
                      className="px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors">
                      Cancel
                    </button>
                  </div>
                )}

                {filteredAgenda.map((cat) => (
                  <div key={cat.id} className="border-b border-gray-100 last:border-b-0">
                    {/* Category header */}
                    <div className="flex items-center justify-between px-6 py-3 bg-gray-50 border-b border-gray-100">
                      <button
                        type="button"
                        onClick={() => toggleCategory(cat.id)}
                        className="flex items-center gap-2 text-left"
                      >
                        <svg
                          className={`w-3.5 h-3.5 text-gray-500 transition-transform ${cat.collapsed ? "-rotate-90" : ""}`}
                          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                        <span className="text-sm font-semibold text-gray-800">{cat.name}</span>
                        <span className="text-xs text-gray-400">({cat.items.length})</span>
                      </button>
                      <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 8h16M4 16h16" />
                      </svg>
                    </div>

                    {!cat.collapsed && (
                      <div>
                        {cat.items.length === 0 && addingItemIn !== cat.id ? (
                          <div className="py-8 flex flex-col items-center gap-2">
                            <p className="text-sm font-semibold text-gray-700">There Are No Items to Display</p>
                            <p className="text-xs text-gray-400">Start adding agenda items to this Category.</p>
                          </div>
                        ) : (
                          cat.items.map((item) => (
                            <div key={item.id} className="flex items-center gap-3 px-8 py-3 border-b border-gray-50 hover:bg-gray-50 group">
                              <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ITEM_STATUS_COLORS[item.status]}`}>
                                {ITEM_STATUS_LABELS[item.status]}
                              </span>
                              <span className="flex-1 text-sm text-gray-900">{item.title}</span>
                              <select
                                value={item.status}
                                onChange={(e) => updateItemStatus(cat.id, item.id, e.target.value as AgendaItem["status"])}
                                onClick={(e) => e.stopPropagation()}
                                className="text-xs border border-gray-200 rounded px-2 py-1 bg-white focus:outline-none opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <option value="open">Open</option>
                                <option value="in_progress">In Progress</option>
                                <option value="closed">Closed</option>
                              </select>
                              <button
                                type="button"
                                onClick={() => removeItem(cat.id, item.id)}
                                className="text-gray-300 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          ))
                        )}

                        {/* Add Item */}
                        {addingItemIn === cat.id ? (
                          <div className="px-8 py-3 flex items-center gap-2 border-t border-gray-50">
                            <input
                              autoFocus
                              type="text"
                              value={newItemText[cat.id] ?? ""}
                              onChange={(e) => setNewItemText((prev) => ({ ...prev, [cat.id]: e.target.value }))}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") addItem(cat.id);
                                if (e.key === "Escape") setAddingItemIn(null);
                              }}
                              placeholder="Agenda item title..."
                              className="flex-1 px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                            />
                            <button type="button" onClick={() => addItem(cat.id)}
                              className="px-3 py-1.5 text-sm font-medium text-white bg-gray-900 rounded-md hover:bg-gray-700 transition-colors">
                              Add
                            </button>
                            <button type="button" onClick={() => setAddingItemIn(null)}
                              className="px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors">
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="px-8 py-3 border-t border-gray-50">
                            <button
                              type="button"
                              onClick={() => setAddingItemIn(cat.id)}
                              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                              </svg>
                              Add Item
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Notes ────────────────────────────────────────────────────── */}
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setNotesExpanded((o) => !o)}
              className="w-full flex items-center gap-2 px-6 py-4 border-b border-gray-100 hover:bg-gray-50 transition-colors text-left"
            >
              <svg
                className={`w-4 h-4 text-gray-500 transition-transform shrink-0 ${notesExpanded ? "" : "-rotate-90"}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
              <span className="font-semibold text-gray-900">Notes</span>
              <span className="text-xs text-gray-400 ml-1 font-normal">— auto-saved</span>
            </button>
            {notesExpanded && (
              <div className="px-6 py-5">
                <NotesEditor
                  value={notes}
                  onChange={handleNotesChange}
                  placeholder="Write meeting notes here..."
                />
              </div>
            )}
          </div>
        </div>}
      </main>
    </div>
  );
}

// ── InfoField helper ──────────────────────────────────────────────────────────

function InfoField({
  label,
  value,
  isLink,
  isBlue,
  isHtml,
}: {
  label: string;
  value: string | null | undefined;
  isLink?: boolean;
  isBlue?: boolean;
  isHtml?: boolean;
}) {
  const empty = value == null || value === "" || value === "--";
  return (
    <div>
      <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
      {empty ? (
        <p className="text-sm text-gray-400">--</p>
      ) : isHtml ? (
        <div
          className="text-sm text-gray-900 prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: value! }}
        />
      ) : isBlue ? (
        <p className="text-sm text-blue-600">{value}</p>
      ) : isLink ? (
        <p className="text-sm text-blue-600 hover:underline cursor-pointer">{value}</p>
      ) : (
        <p className="text-sm text-gray-900">{value}</p>
      )}
    </div>
  );
}
