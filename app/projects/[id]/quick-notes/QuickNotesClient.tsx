"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ProjectNav from "@/components/ProjectNav";
import { Pill } from "@/components/design-system/Primitives";

type Note = {
  id: string;
  title: string;
  content: string;
  updatedAt: string;
};

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

export default function QuickNotesClient({ projectId }: { projectId: string }) {
  const storageKey = useMemo(() => `quick-notes:${projectId}`, [projectId]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [fontSize, setFontSize] = useState<(typeof FONT_SIZES)[number]["value"]>("3");
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [audioMessage, setAudioMessage] = useState("");

  const editorRef = useRef<HTMLDivElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const activeNote = notes.find((n) => n.id === activeId) ?? null;
  const activeContent = activeNote?.content ?? "";

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) {
        const starter = createNote("New note");
        setNotes([starter]);
        setActiveId(starter.id);
      } else {
        const parsed = JSON.parse(raw) as Note[];
        const safe = Array.isArray(parsed) ? parsed : [];
        if (safe.length === 0) {
          const starter = createNote("New note");
          setNotes([starter]);
          setActiveId(starter.id);
        } else {
          setNotes(safe);
          setActiveId(safe[0].id);
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

  function createNewNote() {
    const next = createNote(`Note ${notes.length + 1}`);
    setNotes((prev) => [next, ...prev]);
    setActiveId(next.id);
    setIsEditing(true);
  }

  function deleteActiveNote() {
    if (!activeId) return;
    setNotes((prev) => {
      const remaining = prev.filter((n) => n.id !== activeId);
      if (remaining.length === 0) {
        const fallback = createNote("New note");
        setActiveId(fallback.id);
        return [fallback];
      }
      setActiveId(remaining[0].id);
      return remaining;
    });
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
          setAudioMessage("Audio transcribed and added to this note.");
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
              <span className="num" style={{ color: "var(--brand-500)" }}>{notes.length}</span> {notes.length === 1 ? "note" : "notes"}
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
            <div className="card-pad pb-3 border-b border-[color:var(--border-base)] flex items-baseline justify-between gap-2">
              <h2 className="h3-warm">Notebook</h2>
              <span className="num text-[color:var(--ink-soft)]">{notes.length}</span>
            </div>

            <div className="overflow-y-auto p-2 space-y-1">
              {notes.length === 0 ? (
                <p className="px-2 py-4 text-sm text-[color:var(--ink-soft)] italic">No notes yet.</p>
              ) : (
                notes.map((note, i) => (
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
                      <span className="block mono-label mt-1.5 text-[color:var(--ink-soft)]">Updated {prettyDate(note.updatedAt)}</span>
                    </span>
                  </button>
                ))
              )}
            </div>
          </aside>

          <section className="card h-[calc(100vh-150px)] flex flex-col">
            {!activeNote ? (
              <p className="card-pad text-sm text-[color:var(--ink-soft)] italic">Select a note to start editing.</p>
            ) : (
              <div className="flex flex-col flex-1 card-pad overflow-hidden">
                <div className="flex items-baseline justify-between gap-2 pb-3">
                  <h2 className="h3-warm">
                    {isEditing ? "Editing note" : "Note"}
                  </h2>
                  <Pill className={isEditing ? "pill-warn" : "pill-open"}>
                    {isEditing ? "Editing" : "Viewing"}
                  </Pill>
                </div>
                <div className="flex flex-wrap items-center gap-2 pb-3 border-b border-[color:var(--border-base)]">
                  {isEditing ? (
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
                      <button
                        type="button"
                        onClick={deleteActiveNote}
                        className="btn-secondary ml-auto"
                      >
                        Delete note
                      </button>
                    </>
                  )}
                </div>

                <input
                  type="text"
                  value={activeNote.title}
                  onChange={(e) => updateActive({ title: e.target.value })}
                  readOnly={!isEditing}
                  className={`mt-3 px-3 py-2 border rounded-md font-display text-[20px] text-[color:var(--ink)] focus:outline-none ${
                    isEditing
                      ? "border-[color:var(--border-base)] focus:ring-2 focus:ring-[color:var(--brand-500)]"
                      : "border-transparent bg-[color:var(--surface-sunken)] cursor-default"
                  }`}
                  placeholder="Note title"
                />

                <div
                  ref={editorRef}
                  contentEditable={isEditing}
                  suppressContentEditableWarning
                  onInput={() => isEditing && updateActive({ content: editorRef.current?.innerHTML ?? "" })}
                  className={`mt-3 flex-1 border rounded-md p-3 text-sm text-[color:var(--ink)] overflow-y-auto ${
                    isEditing
                      ? "border-[color:var(--border-base)] focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-500)]"
                      : "border-transparent bg-[color:var(--surface-sunken)] cursor-default"
                  }`}
                  style={{ lineHeight: 1.6 }}
                />

                {audioMessage && (
                  <p className="mono-label mt-2 text-[color:var(--ink-soft)]">{audioMessage}</p>
                )}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
