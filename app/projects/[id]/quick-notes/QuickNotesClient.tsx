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
    <div className="min-h-screen bg-[#f3f4f6]">
      <ProjectNav projectId={projectId} />

      <main className="mx-auto max-w-[1400px] px-4 py-6">
        <div className="mb-4 rounded-xl border border-[var(--border-base)] bg-white p-4">
          <div className="mt-2 flex items-center justify-between">
            <h1 className="font-display text-[28px] leading-tight text-[color:var(--ink)]">Quick Notes</h1>
            <Pill className="pill-open">{notes.length} notes</Pill>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
          <aside className="bg-white border border-gray-200 rounded-xl p-3 h-[calc(100vh-120px)] overflow-hidden flex flex-col">
            <button
              type="button"
              onClick={createNewNote}
              className="w-full px-3 py-2 rounded-md bg-gray-900 text-white text-sm font-medium hover:bg-gray-800"
            >
              + New note
            </button>

            <div className="mt-3 overflow-y-auto space-y-2">
              {notes.map((note) => (
                <button
                  key={note.id}
                  type="button"
                  onClick={() => { setActiveId(note.id); setIsEditing(false); }}
                  className={`w-full text-left p-2.5 rounded-md border transition ${
                    note.id === activeId
                      ? "bg-gray-50 border-gray-300"
                      : "bg-white border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <p className="text-sm font-medium text-gray-900 truncate">{note.title || "Untitled note"}</p>
                  <p className="text-xs text-gray-500 mt-1">Updated {prettyDate(note.updatedAt)}</p>
                </button>
              ))}
            </div>
          </aside>

          <section className="bg-white border border-gray-200 rounded-xl p-4 h-[calc(100vh-120px)] flex flex-col">
            {!activeNote ? (
              <p className="text-sm text-gray-500">Select a note to start editing.</p>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2 pb-3 border-b border-gray-200">
                  {isEditing ? (
                    <>
                      <button
                        type="button"
                        onClick={() => runCommand("bold")}
                        className="px-2.5 py-1.5 border border-gray-300 rounded text-sm font-semibold"
                      >
                        B
                      </button>
                      <button
                        type="button"
                        onClick={() => runCommand("underline")}
                        className="px-2.5 py-1.5 border border-gray-300 rounded text-sm underline"
                      >
                        U
                      </button>
                      <button
                        type="button"
                        onClick={() => runCommand("insertUnorderedList")}
                        className="px-2.5 py-1.5 border border-gray-300 rounded text-sm"
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
                        className="px-2.5 py-1.5 border border-gray-300 rounded text-sm"
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
                        className={`px-3 py-1.5 rounded text-sm font-medium ${
                          recording ? "bg-red-600 text-white" : "bg-indigo-600 text-white"
                        } disabled:opacity-50`}
                      >
                        {recording ? "Stop Recording" : "Record with ElevenLabs"}
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsEditing(false)}
                        className="ml-auto px-3 py-1.5 rounded bg-gray-900 text-white text-sm font-medium hover:bg-gray-800"
                      >
                        Save
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => setIsEditing(true)}
                        className="px-3 py-1.5 rounded bg-gray-900 text-white text-sm font-medium hover:bg-gray-800"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={deleteActiveNote}
                        className="ml-auto px-3 py-1.5 rounded border border-gray-300 text-sm text-gray-700 hover:bg-gray-50"
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
                  className={`mt-3 px-3 py-2 border border-gray-200 rounded-md text-sm font-medium focus:outline-none ${
                    isEditing
                      ? "focus:ring-2 focus:ring-gray-900"
                      : "bg-gray-50 cursor-default text-gray-700"
                  }`}
                  placeholder="Note title"
                />

                <div
                  ref={editorRef}
                  contentEditable={isEditing}
                  suppressContentEditableWarning
                  onInput={() => isEditing && updateActive({ content: editorRef.current?.innerHTML ?? "" })}
                  className={`mt-3 flex-1 border border-gray-200 rounded-md p-3 text-sm text-gray-900 overflow-y-auto ${
                    isEditing
                      ? "focus:outline-none focus:ring-2 focus:ring-gray-900"
                      : "bg-gray-50 cursor-default"
                  }`}
                  style={{ lineHeight: 1.6 }}
                />

                <p className="text-xs text-gray-500 mt-2">
                  {audioMessage || "Tip: set ELEVENLABS_API_KEY on the server to enable audio transcription."}
                </p>
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
