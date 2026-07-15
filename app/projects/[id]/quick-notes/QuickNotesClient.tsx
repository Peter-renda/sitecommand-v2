"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ProjectNav from "@/components/ProjectNav";
import { Pill } from "@/components/design-system/Primitives";

type Note = {
  id: string;
  title: string;
  content: string;
  updatedAt: string;
  // When set, the note lives in Recycling rather than the active notebook.
  deletedAt: string | null;
};

type View = "notebook" | "recycling";

type DirectoryContact = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  company: string | null;
  type: string;
};

// Resolved email-connection status for the active user (null = not yet loaded,
// "loading" = request in flight).
type EmailConn =
  | { connected: boolean; provider?: string; email?: string }
  | "loading"
  | null;

const FONT_SIZES = [
  { label: "Small", value: "2" },
  { label: "Normal", value: "3" },
  { label: "Large", value: "4" },
  { label: "XL", value: "5" },
] as const;

function createNote(seed = ""): Note {
  return {
    id: crypto.randomUUID(),
    title: seed || "Untitled note",
    content: "",
    updatedAt: new Date().toISOString(),
    deletedAt: null,
  };
}

function prettyDate(value: string): string {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function safeFilename(value: string): string {
  return (
    value
      .trim()
      .replace(/[^a-z0-9\-_ ]/gi, "")
      .replace(/\s+/g, "-")
      .slice(0, 80) || "note"
  );
}

// Builds the default HTML email body: a greeting addressed to the recipient,
// the note's content, and the sender's signature. Both Gmail and Outlook send
// the body as HTML, and the note content is already HTML, so we compose HTML.
function buildEmailBody(noteHtml: string, recipientFirstName: string, senderName: string): string {
  const name = recipientFirstName.trim() || "there";
  const greeting = `<p>Hi ${escapeHtml(name)},</p>`;
  const spacer = "<p><br /></p>";
  const content = noteHtml && noteHtml.trim() ? noteHtml : "<p></p>";
  const signature = `<p>Best regards,<br />${escapeHtml(senderName.trim())}</p>`;
  return `${greeting}${spacer}${content}${spacer}${signature}`;
}

export default function QuickNotesClient({
  projectId,
  userName,
}: {
  projectId: string;
  userName: string;
}) {
  const storageKey = useMemo(() => `quick-notes:${projectId}`, [projectId]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [view, setView] = useState<View>("notebook");
  const [loaded, setLoaded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [fontSize, setFontSize] = useState<(typeof FONT_SIZES)[number]["value"]>("3");
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [audioMessage, setAudioMessage] = useState("");

  // Convert-to-email modal state
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailConn, setEmailConn] = useState<EmailConn>(null);
  const [contacts, setContacts] = useState<DirectoryContact[]>([]);
  const [emailTo, setEmailTo] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [sending, setSending] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailSuccess, setEmailSuccess] = useState(false);

  const editorRef = useRef<HTMLDivElement>(null);
  const emailEditorRef = useRef<HTMLDivElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  // True once the user has hand-edited the email body, so we stop
  // auto-regenerating the greeting when the recipient changes.
  const emailBodyTouched = useRef(false);

  const activeNotes = useMemo(() => notes.filter((n) => !n.deletedAt), [notes]);
  const recycledNotes = useMemo(() => notes.filter((n) => n.deletedAt), [notes]);
  const visibleNotes = view === "notebook" ? activeNotes : recycledNotes;
  const isRecycling = view === "recycling";

  const activeNote = notes.find((n) => n.id === activeId) ?? null;
  const activeContent = activeNote?.content ?? "";
  const canEdit = isEditing && !isRecycling;

  // Unique directory emails (with a display label) for the recipient autofill.
  const contactEmailOptions = useMemo(() => {
    const seen = new Set<string>();
    const out: { email: string; label: string }[] = [];
    for (const c of contacts) {
      const email = (c.email ?? "").trim();
      if (!email) continue;
      const key = email.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const name = [c.first_name, c.last_name].filter(Boolean).join(" ").trim();
      const label = [name, c.company].filter(Boolean).join(" — ");
      out.push({ email, label: label || email });
    }
    return out.sort((a, b) => a.label.localeCompare(b.label));
  }, [contacts]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) {
        const starter = createNote("New note");
        setNotes([starter]);
        setActiveId(starter.id);
      } else {
        const parsed = JSON.parse(raw) as Note[];
        const safe = (Array.isArray(parsed) ? parsed : []).map((n) => ({
          ...n,
          deletedAt: n.deletedAt ?? null,
        }));
        if (safe.length === 0) {
          const starter = createNote("New note");
          setNotes([starter]);
          setActiveId(starter.id);
        } else {
          setNotes(safe);
          const firstActive = safe.find((n) => !n.deletedAt);
          setActiveId((firstActive ?? safe[0]).id);
        }
      }
    } finally {
      setLoaded(true);
    }
  }, [storageKey]);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(storageKey, JSON.stringify(notes));
  }, [notes, storageKey, loaded]);

  useEffect(() => {
    if (!editorRef.current || !activeId) return;
    if (editorRef.current.innerHTML !== activeContent) {
      editorRef.current.innerHTML = activeContent;
    }
  }, [activeId, activeContent]);

  useEffect(() => {
    return () => {
      recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
      recorderRef.current = null;
    };
  }, []);

  function switchView(next: View) {
    setView(next);
    setIsEditing(false);
    setAudioMessage("");
    const list = notes.filter((n) => (next === "notebook" ? !n.deletedAt : !!n.deletedAt));
    setActiveId(list[0]?.id ?? null);
  }

  function createNewNote() {
    const next = createNote(`Note ${activeNotes.length + 1}`);
    setView("notebook");
    setNotes((prev) => [next, ...prev]);
    setActiveId(next.id);
    setIsEditing(true);
  }

  // Soft-delete: send the active note to Recycling instead of removing it.
  function moveToRecycling() {
    if (!activeId) return;
    const now = new Date().toISOString();
    const nextActive = activeNotes.find((n) => n.id !== activeId);
    setNotes((prev) =>
      prev.map((n) =>
        n.id === activeId ? { ...n, deletedAt: now, updatedAt: now } : n
      )
    );
    setActiveId(nextActive?.id ?? null);
    setIsEditing(false);
  }

  function restoreNote(id: string) {
    const nextRecycled = recycledNotes.find((n) => n.id !== id);
    setNotes((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, deletedAt: null, updatedAt: new Date().toISOString() } : n
      )
    );
    setActiveId(nextRecycled?.id ?? null);
  }

  function deleteForever(id: string) {
    if (!window.confirm("Permanently delete this note? This cannot be undone.")) return;
    const nextRecycled = recycledNotes.find((n) => n.id !== id);
    setNotes((prev) => prev.filter((n) => n.id !== id));
    setActiveId(nextRecycled?.id ?? null);
  }

  function exportToWord() {
    if (!activeNote) return;
    const title = activeNote.title || "Untitled note";
    const bodyHtml = activeNote.content?.trim() || "<p></p>";
    const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head>
<body><h1>${escapeHtml(title)}</h1>${bodyHtml}</body>
</html>`;
    const blob = new Blob([html], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${safeFilename(title)}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // Look up a directory contact by email (case-insensitive) so we can address
  // the greeting to them by name.
  function contactByEmail(email: string): DirectoryContact | undefined {
    const e = email.trim().toLowerCase();
    if (!e) return undefined;
    return contacts.find((c) => (c.email ?? "").trim().toLowerCase() === e);
  }

  function openEmailModal() {
    if (!activeNote) return;
    setEmailError(null);
    setEmailSuccess(false);
    setEmailTo("");
    setEmailSubject(activeNote.title || "Untitled note");
    emailBodyTouched.current = false;
    setEmailBody(buildEmailBody(activeNote.content, "", userName));
    setShowEmailModal(true);

    // Resolve email-connection status (cached after first load).
    setEmailConn((prev) => (prev && prev !== "loading" ? prev : "loading"));
    fetch("/api/emails/connection")
      .then((r) => r.json())
      .then((data) => {
        const active = data?.outlook?.connected
          ? { connected: true, provider: "outlook", email: data.outlook.email }
          : data?.gmail?.connected
          ? { connected: true, provider: "gmail", email: data.gmail.email }
          : { connected: false };
        setEmailConn(active);
      })
      .catch(() => setEmailConn({ connected: false }));

    // Load the project directory once for recipient autofill.
    if (contacts.length === 0) {
      fetch(`/api/projects/${projectId}/directory`)
        .then((r) => r.json())
        .then((data) => setContacts(Array.isArray(data) ? data : []))
        .catch(() => setContacts([]));
    }
  }

  function closeEmailModal() {
    if (sending) return;
    setShowEmailModal(false);
  }

  // The editor only mounts once we've confirmed an email connection, so seed
  // its content when it becomes ready (not merely when the modal opens).
  const emailEditorReady =
    showEmailModal && emailConn !== null && emailConn !== "loading" && emailConn.connected;

  useEffect(() => {
    if (emailEditorReady && emailEditorRef.current) {
      emailEditorRef.current.innerHTML = emailBody;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emailEditorReady]);

  function handleEmailToChange(value: string) {
    setEmailTo(value);
    // Re-address the greeting to the matched contact until the user edits the body.
    if (!emailBodyTouched.current && activeNote) {
      const firstName = contactByEmail(value)?.first_name?.trim() || "";
      const body = buildEmailBody(activeNote.content, firstName, userName);
      setEmailBody(body);
      if (emailEditorRef.current) emailEditorRef.current.innerHTML = body;
    }
  }

  function handleEmailBodyInput() {
    emailBodyTouched.current = true;
    setEmailBody(emailEditorRef.current?.innerHTML ?? "");
  }

  async function sendEmail() {
    if (!emailTo.trim() || !emailSubject.trim() || sending) return;
    setSending(true);
    setEmailError(null);
    try {
      const res = await fetch("/api/emails/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: emailTo.trim(),
          subject: emailSubject.trim(),
          body: emailBody,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setEmailError(data.error ?? "Failed to send. Please try again.");
      } else {
        setEmailSuccess(true);
        setTimeout(() => setShowEmailModal(false), 1500);
      }
    } catch {
      setEmailError("Network error. Please try again.");
    } finally {
      setSending(false);
    }
  }

  function updateActive(patch: Partial<Note>) {
    if (!activeId) return;
    setNotes((prev) =>
      prev.map((n) =>
        n.id === activeId
          ? { ...n, ...patch, updatedAt: new Date().toISOString() }
          : n
      )
    );
  }

  function runCommand(command: string, value?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    updateActive({ content: editorRef.current?.innerHTML ?? "" });
  }

  async function toggleRecording() {
    setAudioMessage("");

    if (recording && recorderRef.current) {
      recorderRef.current.stop();
      setRecording(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        recorder.stream.getTracks().forEach((t) => t.stop());

        if (blob.size === 0) {
          setAudioMessage("No audio captured.");
          return;
        }

        setTranscribing(true);
        try {
          const formData = new FormData();
          formData.append("audio", blob, "quick-note-audio.webm");

          const res = await fetch("/api/integrations/elevenlabs/transcribe", {
            method: "POST",
            body: formData,
          });

          const data = await res.json();
          if (!res.ok) {
            setAudioMessage(data.error || "Transcription failed.");
            return;
          }

          const transcript = (data.text ?? "").trim();
          if (!transcript) {
            setAudioMessage("No transcript text returned.");
            return;
          }

          const existing = editorRef.current?.innerHTML?.trim() ?? "";
          const spacer = existing ? "<p><br /></p>" : "";
          const nextContent = `${existing}${spacer}<p>${transcript}</p>`;
          if (editorRef.current) editorRef.current.innerHTML = nextContent;
          updateActive({ content: nextContent });
          setAudioMessage("");
        } catch {
          setAudioMessage("Transcription failed.");
        } finally {
          setTranscribing(false);
        }
      };

      recorder.start();
      setRecording(true);
      setAudioMessage("Recording… click again to stop.");
    } catch {
      setAudioMessage("Microphone access was denied.");
    }
  }

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <ProjectNav projectId={projectId} />

      <main className="mx-auto max-w-[1400px] px-4 py-6">
        <div className="sec-row mb-6">
          <div>
            <h1 className="h2-warm">Quick notes</h1>
            <p className="sub mt-1.5">
              <em>A working notebook for this project</em>
              <span className="sep">·</span>
              {isRecycling ? (
                <>
                  <span className="num" style={{ color: "var(--brand-500)" }}>{recycledNotes.length}</span> in recycling
                </>
              ) : (
                <>
                  <span className="num" style={{ color: "var(--brand-500)" }}>{activeNotes.length}</span> {activeNotes.length === 1 ? "note" : "notes"}
                </>
              )}
              {activeNote && (
                <>
                  <span className="sep">·</span>
                  <em>last touched</em>{" "}
                  <span className="num">{prettyDate(activeNote.updatedAt)}</span>
                </>
              )}
            </p>
          </div>
          <button type="button" onClick={createNewNote} className="btn-primary">
            New note
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
          <aside className="card h-[calc(100vh-150px)] overflow-hidden flex flex-col">
            <div className="card-pad pb-3 border-b border-[color:var(--border-base)]">
              <div className="flex items-center gap-1 rounded-lg bg-[color:var(--surface-sunken)] p-1">
                <button
                  type="button"
                  onClick={() => switchView("notebook")}
                  className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition flex items-center justify-center gap-1.5 ${
                    !isRecycling
                      ? "bg-white text-[color:var(--ink)] shadow-sm"
                      : "text-[color:var(--ink-soft)] hover:text-[color:var(--ink)]"
                  }`}
                >
                  Notebook
                  <span className="num text-[color:var(--ink-soft)]">{activeNotes.length}</span>
                </button>
                <button
                  type="button"
                  onClick={() => switchView("recycling")}
                  className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition flex items-center justify-center gap-1.5 ${
                    isRecycling
                      ? "bg-white text-[color:var(--ink)] shadow-sm"
                      : "text-[color:var(--ink-soft)] hover:text-[color:var(--ink)]"
                  }`}
                >
                  Recycling
                  <span className="num text-[color:var(--ink-soft)]">{recycledNotes.length}</span>
                </button>
              </div>
            </div>

            <div className="overflow-y-auto p-2 space-y-1">
              {visibleNotes.length === 0 ? (
                <p className="px-2 py-4 text-sm text-[color:var(--ink-soft)] italic">
                  {isRecycling ? "Recycling is empty." : "No notes yet."}
                </p>
              ) : (
                visibleNotes.map((note, i) => (
                  <button
                    key={note.id}
                    type="button"
                    onClick={() => { setActiveId(note.id); setIsEditing(false); }}
                    className={`w-full text-left px-3 py-2.5 rounded-lg border transition flex items-baseline gap-2.5 ${
                      note.id === activeId
                        ? "bg-[color:var(--surface-sunken)] border-[color:var(--brand-500)]"
                        : "bg-white border-transparent hover:bg-[color:var(--surface-sunken)]"
                    }`}
                  >
                    <span
                      className={`idx-italic shrink-0 ${
                        note.id === activeId ? "status-open" : "status-draft"
                      }`}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="min-w-0">
                      <span className="block font-display text-[15px] leading-tight text-[color:var(--ink)] truncate">{note.title || "Untitled note"}</span>
                      <span className="block mono-label mt-1.5 text-[color:var(--ink-soft)]">
                        {isRecycling
                          ? `Recycled ${prettyDate(note.deletedAt as string)}`
                          : `Updated ${prettyDate(note.updatedAt)}`}
                      </span>
                    </span>
                  </button>
                ))
              )}
            </div>
          </aside>

          <section className="card h-[calc(100vh-150px)] flex flex-col">
            {!activeNote ? (
              <p className="card-pad text-sm text-[color:var(--ink-soft)] italic">
                {isRecycling ? "Nothing in recycling." : "Select a note to start editing."}
              </p>
            ) : (
              <div className="flex flex-col flex-1 card-pad overflow-hidden">
                <div className="flex items-baseline justify-between gap-2 pb-3">
                  <h2 className="h3-warm">
                    {isRecycling ? "Recycled note" : isEditing ? "Editing note" : "Note"}
                  </h2>
                  <Pill className={isRecycling ? "pill-post" : isEditing ? "pill-warn" : "pill-open"}>
                    {isRecycling ? "Recycled" : isEditing ? "Editing" : "Viewing"}
                  </Pill>
                </div>
                <div className="flex flex-wrap items-center gap-2 pb-3 border-b border-[color:var(--border-base)]">
                  {isRecycling ? (
                    <>
                      <button
                        type="button"
                        onClick={() => restoreNote(activeNote.id)}
                        className="btn-primary"
                      >
                        Restore
                      </button>
                      <button
                        type="button"
                        onClick={exportToWord}
                        className="btn-secondary"
                      >
                        Export to Word
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteForever(activeNote.id)}
                        className="ml-auto px-3 py-1.5 rounded-md border border-[color:var(--border-base)] text-sm font-medium text-red-600 hover:bg-red-50 transition"
                      >
                        Delete permanently
                      </button>
                    </>
                  ) : isEditing ? (
                    <>
                      <button
                        type="button"
                        onClick={() => runCommand("bold")}
                        className="px-2.5 py-1.5 border border-[color:var(--border-base)] rounded-md text-sm font-semibold text-[color:var(--ink)] hover:bg-[color:var(--surface-sunken)] transition"
                      >
                        B
                      </button>
                      <button
                        type="button"
                        onClick={() => runCommand("underline")}
                        className="px-2.5 py-1.5 border border-[color:var(--border-base)] rounded-md text-sm underline text-[color:var(--ink)] hover:bg-[color:var(--surface-sunken)] transition"
                      >
                        U
                      </button>
                      <button
                        type="button"
                        onClick={() => runCommand("insertUnorderedList")}
                        className="px-2.5 py-1.5 border border-[color:var(--border-base)] rounded-md text-sm text-[color:var(--ink)] hover:bg-[color:var(--surface-sunken)] transition"
                      >
                        • List
                      </button>

                      <select
                        value={fontSize}
                        onChange={(e) => {
                          const value = e.target.value as (typeof FONT_SIZES)[number]["value"];
                          setFontSize(value);
                          runCommand("fontSize", value);
                        }}
                        className="px-2.5 py-1.5 border border-[color:var(--border-base)] rounded-md text-sm bg-white text-[color:var(--ink)]"
                      >
                        {FONT_SIZES.map((size) => (
                          <option key={size.value} value={size.value}>
                            {size.label}
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={toggleRecording}
                        disabled={transcribing}
                        className="btn-secondary disabled:opacity-50"
                      >
                        {recording ? "Stop recording" : "Record"}
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsEditing(false)}
                        className="btn-primary ml-auto"
                      >
                        Save
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => setIsEditing(true)}
                        className="btn-primary"
                      >
                        Edit
                      </button>
                      <div className="ml-auto flex items-center gap-2">
                        <button
                          type="button"
                          onClick={exportToWord}
                          className="btn-secondary"
                        >
                          Export to Word
                        </button>
                        <button
                          type="button"
                          onClick={openEmailModal}
                          className="btn-secondary"
                        >
                          Convert to Email
                        </button>
                        <button
                          type="button"
                          onClick={moveToRecycling}
                          className="btn-secondary"
                        >
                          Move to Recycling
                        </button>
                      </div>
                    </>
                  )}
                </div>

                <input
                  type="text"
                  value={activeNote.title}
                  onChange={(e) => updateActive({ title: e.target.value })}
                  readOnly={!canEdit}
                  className={`mt-3 px-3 py-2 border rounded-md font-display text-[20px] text-[color:var(--ink)] focus:outline-none ${
                    canEdit
                      ? "border-[color:var(--border-base)] focus:ring-2 focus:ring-[color:var(--brand-500)]"
                      : "border-transparent bg-[color:var(--surface-sunken)] cursor-default"
                  }`}
                  placeholder="Note title"
                />

                <div
                  ref={editorRef}
                  contentEditable={canEdit}
                  suppressContentEditableWarning
                  onInput={() => canEdit && updateActive({ content: editorRef.current?.innerHTML ?? "" })}
                  className={`mt-3 flex-1 border rounded-md p-3 text-sm text-[color:var(--ink)] overflow-y-auto ${
                    canEdit
                      ? "border-[color:var(--border-base)] focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-500)]"
                      : "border-transparent bg-[color:var(--surface-sunken)] cursor-default"
                  }`}
                  style={{ lineHeight: 1.6 }}
                />

                {audioMessage && !isRecycling && (
                  <p className="mono-label mt-2 text-[color:var(--ink-soft)]">{audioMessage}</p>
                )}
              </div>
            )}
          </section>
        </div>
      </main>

      {/* ── Convert to Email Modal ── */}
      {showEmailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={closeEmailModal} />
          <div className="relative card shadow-2xl w-full max-w-lg flex flex-col max-h-[88vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[color:var(--border-base)]">
              <h2 className="h3-warm !mb-0">Convert note to email</h2>
              <button
                type="button"
                onClick={closeEmailModal}
                disabled={sending}
                className="text-[color:var(--ink-soft)] hover:text-[color:var(--ink)] disabled:opacity-40"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {emailConn === "loading" || emailConn === null ? (
              <div className="px-5 py-10 text-center text-sm text-[color:var(--ink-soft)] flex items-center justify-center gap-2.5">
                <span className="inline-block w-3.5 h-3.5 border-2 border-gray-300 border-t-gray-500 rounded-full animate-spin" />
                Checking your email connection…
              </div>
            ) : !emailConn.connected ? (
              <div className="px-5 py-8 text-center">
                <p className="text-sm text-[color:var(--ink)] font-medium">No email account connected</p>
                <p className="text-xs text-[color:var(--ink-soft)] mt-1.5 mb-4">
                  Connect Outlook or Gmail to send notes as email.
                </p>
                <div className="flex items-center justify-center gap-2">
                  <a
                    href={`/api/auth/outlook/connect?projectId=${projectId}`}
                    className="px-3 py-1.5 text-xs font-medium bg-[#0078D4] text-white rounded hover:opacity-90 transition-opacity"
                  >
                    Connect Outlook
                  </a>
                  <a
                    href={`/api/auth/gmail/connect?projectId=${projectId}`}
                    className="px-3 py-1.5 text-xs font-medium bg-[#EA4335] text-white rounded hover:opacity-90 transition-opacity"
                  >
                    Connect Gmail
                  </a>
                </div>
              </div>
            ) : (
              <>
                <div className="px-5 py-5 space-y-4 overflow-y-auto">
                  <div>
                    <label className="block mono-label text-[color:var(--ink-soft)] mb-1">To</label>
                    <input
                      type="email"
                      list="quick-note-email-contacts"
                      value={emailTo}
                      onChange={(e) => handleEmailToChange(e.target.value)}
                      placeholder="recipient@example.com"
                      className="w-full border border-[color:var(--border-base)] rounded-md px-3 py-2 text-sm text-[color:var(--ink)] focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-500)]"
                    />
                    <datalist id="quick-note-email-contacts">
                      {contactEmailOptions.map((c) => (
                        <option key={c.email} value={c.email}>
                          {c.label}
                        </option>
                      ))}
                    </datalist>
                  </div>

                  <div>
                    <label className="block mono-label text-[color:var(--ink-soft)] mb-1">Subject</label>
                    <input
                      type="text"
                      value={emailSubject}
                      onChange={(e) => setEmailSubject(e.target.value)}
                      placeholder="Subject line"
                      className="w-full border border-[color:var(--border-base)] rounded-md px-3 py-2 text-sm text-[color:var(--ink)] focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-500)]"
                    />
                  </div>

                  <div>
                    <label className="block mono-label text-[color:var(--ink-soft)] mb-1">Message</label>
                    <div
                      ref={emailEditorRef}
                      contentEditable
                      suppressContentEditableWarning
                      onInput={handleEmailBodyInput}
                      className="min-h-[180px] max-h-[300px] overflow-y-auto border border-[color:var(--border-base)] rounded-md p-3 text-sm text-[color:var(--ink)] focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-500)]"
                      style={{ lineHeight: 1.6 }}
                    />
                  </div>

                  {emailError && (
                    <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                      {emailError}
                    </p>
                  )}
                  {emailSuccess && (
                    <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2">
                      Email sent successfully!
                    </p>
                  )}
                </div>

                {/* Footer */}
                <div className="px-5 py-4 border-t border-[color:var(--border-base)] flex items-center justify-between gap-3">
                  {emailConn.email ? (
                    <span className="mono-label text-[color:var(--ink-soft)] truncate">
                      From: <strong>{emailConn.email}</strong>
                    </span>
                  ) : (
                    <span />
                  )}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={closeEmailModal}
                      disabled={sending}
                      className="btn-quiet disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={sendEmail}
                      disabled={sending || emailSuccess || !emailTo.trim() || !emailSubject.trim()}
                      className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {sending ? "Sending…" : "Send Email"}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
