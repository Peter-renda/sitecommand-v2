"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Doc = {
  id: string;
  title: string;
  jurisdiction: string | null;
  docType: "link" | "file";
  url: string | null;
  filename: string | null;
  source: "manual" | "ai";
  status: "suggested" | "approved" | "ignored";
  notes: string | null;
  createdAt: string;
};

const JURISDICTIONS = ["City", "County", "State", "Other"];

const INPUT_CLASS =
  "h-10 w-full rounded-md border border-black/10 bg-[color:var(--surface-sunken)] px-3 text-sm text-[color:var(--ink)] placeholder:text-gray-400 focus:border-[color:var(--ink)] focus:outline-none focus:ring-1 focus:ring-[color:var(--ink)]";

function JurisdictionBadge({ value }: { value: string | null }) {
  if (!value) return null;
  return (
    <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
      {value}
    </span>
  );
}

export default function BuildingCodeSection({
  projectId,
  isAdmin,
}: {
  projectId: string;
  isAdmin: boolean;
}) {
  const [approved, setApproved] = useState<Doc[]>([]);
  const [suggested, setSuggested] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [finding, setFinding] = useState(false);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  // Add-document form
  const [addMode, setAddMode] = useState<"link" | "file">("link");
  const [newTitle, setNewTitle] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newJurisdiction, setNewJurisdiction] = useState("");
  const [adding, setAdding] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/building-code`);
    if (res.ok) {
      const d = await res.json();
      setApproved(d.approved ?? []);
      setSuggested(d.suggested ?? []);
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function handleFind() {
    setFinding(true);
    setError("");
    try {
      const res = await fetch(`/api/projects/${projectId}/building-code/suggest`, { method: "POST" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(d.error || "Could not search for building code.");
      } else {
        setSuggested(d.suggested ?? []);
        if ((d.created ?? 0) === 0 && (d.suggested ?? []).length === 0) {
          setError("No new building code references were found for this jurisdiction.");
        }
      }
    } catch {
      setError("Could not search for building code.");
    }
    setFinding(false);
  }

  async function actOnSuggestion(id: string, action: "approve" | "ignore") {
    setBusyId(id);
    const res = await fetch(`/api/projects/${projectId}/building-code/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setBusyId(null);
    if (res.ok) await load();
  }

  async function saveRename(id: string) {
    const title = editTitle.trim();
    if (!title) return;
    setBusyId(id);
    const res = await fetch(`/api/projects/${projectId}/building-code/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    setBusyId(null);
    setEditingId(null);
    if (res.ok) await load();
  }

  async function handleDelete(id: string) {
    if (!confirm("Remove this building code document?")) return;
    setBusyId(id);
    const res = await fetch(`/api/projects/${projectId}/building-code/${id}`, { method: "DELETE" });
    setBusyId(null);
    if (res.ok) await load();
  }

  async function handleAdd() {
    setError("");
    const title = newTitle.trim();
    if (!title) {
      setError("Give the document a name.");
      return;
    }
    setAdding(true);
    try {
      if (addMode === "link") {
        const url = newUrl.trim();
        if (!url) {
          setError("Enter a URL for the link.");
          setAdding(false);
          return;
        }
        const res = await fetch(`/api/projects/${projectId}/building-code`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, url, jurisdiction: newJurisdiction, docType: "link" }),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          setError(d.error || "Could not add link.");
          setAdding(false);
          return;
        }
      } else {
        const file = fileInputRef.current?.files?.[0];
        if (!file) {
          setError("Choose a PDF to upload.");
          setAdding(false);
          return;
        }
        const urlRes = await fetch(
          `/api/projects/${projectId}/building-code/upload-url?filename=${encodeURIComponent(file.name)}`,
        );
        if (!urlRes.ok) {
          setError("Could not start the upload.");
          setAdding(false);
          return;
        }
        const { signedUrl, storagePath } = await urlRes.json();
        const putRes = await fetch(signedUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type || "application/pdf" },
          body: file,
        });
        if (!putRes.ok) {
          setError("Upload failed.");
          setAdding(false);
          return;
        }
        const res = await fetch(`/api/projects/${projectId}/building-code`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            jurisdiction: newJurisdiction,
            docType: "file",
            storagePath,
            filename: file.name,
          }),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          setError(d.error || "Could not save the document.");
          setAdding(false);
          return;
        }
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
      setNewTitle("");
      setNewUrl("");
      setNewJurisdiction("");
      await load();
    } catch {
      setError("Something went wrong.");
    }
    setAdding(false);
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-600">
        Building code references for this project&apos;s jurisdiction — city and county code, plus any supplemental
        documents. Approved documents are available to the Assist tools so all code lives in one place.
      </p>

      {error ? <p className="text-xs text-red-600">{error}</p> : null}

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : (
        <>
          {isAdmin ? (
            <div className="flex items-center gap-3">
              <button type="button" onClick={handleFind} disabled={finding} className="btn-secondary">
                {finding ? "Searching the web…" : "Find building code with AI"}
              </button>
              <span className="text-xs text-gray-500">Uses Gemini web search for your city &amp; county code.</span>
            </div>
          ) : null}

          {/* AI suggestions awaiting review */}
          {suggested.length > 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4">
              <h3 className="mb-3 text-sm font-semibold text-gray-900">Suggested by AI — review</h3>
              <div className="space-y-3">
                {suggested.map((d) => (
                  <div key={d.id} className="rounded-md border border-amber-200 bg-white p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <JurisdictionBadge value={d.jurisdiction} />
                          <span className="truncate text-sm font-medium text-gray-900">{d.title}</span>
                        </div>
                        {d.url ? (
                          <a
                            href={d.url}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-0.5 block truncate text-xs text-[color:var(--brand-700)] underline"
                          >
                            {d.url}
                          </a>
                        ) : null}
                        {d.notes ? <p className="mt-1 text-xs text-gray-500">{d.notes}</p> : null}
                      </div>
                      {isAdmin ? (
                        <div className="flex shrink-0 items-center gap-2">
                          <button
                            type="button"
                            onClick={() => actOnSuggestion(d.id, "approve")}
                            disabled={busyId === d.id}
                            className="rounded bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => actOnSuggestion(d.id, "ignore")}
                            disabled={busyId === d.id}
                            className="rounded px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                          >
                            Ignore
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Approved documents */}
          <div>
            <h3 className="mb-3 text-sm font-semibold text-gray-900">Documents</h3>
            {approved.length === 0 ? (
              <p className="text-sm text-gray-500">No building code documents yet.</p>
            ) : (
              <div className="space-y-2">
                {approved.map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center justify-between gap-3 rounded-md bg-gray-50 px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      {editingId === d.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            className={INPUT_CLASS}
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => saveRename(d.id)}
                            disabled={busyId === d.id}
                            className="rounded bg-[color:var(--ink)] px-2 py-1 text-xs text-white"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="rounded px-2 py-1 text-xs text-gray-600"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <JurisdictionBadge value={d.jurisdiction} />
                          {d.url ? (
                            <a
                              href={d.url}
                              target="_blank"
                              rel="noreferrer"
                              className="truncate text-sm font-medium text-[color:var(--brand-700)] underline"
                            >
                              {d.title}
                            </a>
                          ) : (
                            <span className="truncate text-sm font-medium text-gray-900">{d.title}</span>
                          )}
                          <span className="shrink-0 text-xs text-gray-400">
                            {d.docType === "file" ? "PDF" : "Link"}
                            {d.source === "ai" ? " · AI" : ""}
                          </span>
                        </div>
                      )}
                    </div>
                    {isAdmin && editingId !== d.id ? (
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(d.id);
                            setEditTitle(d.title);
                          }}
                          className="rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
                        >
                          Rename
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(d.id)}
                          disabled={busyId === d.id}
                          className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add a document */}
          {isAdmin ? (
            <div className="rounded-lg border border-gray-200 p-4">
              <div className="mb-3 flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-900">Add a document</span>
                <div className="ml-2 flex rounded-md border border-gray-200 p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setAddMode("link")}
                    className={`rounded px-2 py-1 ${addMode === "link" ? "bg-gray-900 text-white" : "text-gray-600"}`}
                  >
                    Link
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddMode("file")}
                    className={`rounded px-2 py-1 ${addMode === "file" ? "bg-gray-900 text-white" : "text-gray-600"}`}
                  >
                    Upload PDF
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <input
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="Document name (e.g. City of Raleigh Building Code)"
                    className={INPUT_CLASS}
                  />
                </div>
                {addMode === "link" ? (
                  <div className="col-span-2">
                    <input
                      value={newUrl}
                      onChange={(e) => setNewUrl(e.target.value)}
                      placeholder="https://…"
                      className={INPUT_CLASS}
                    />
                  </div>
                ) : (
                  <div className="col-span-2">
                    <input ref={fileInputRef} type="file" accept="application/pdf" className="text-sm" />
                  </div>
                )}
                <div>
                  <select
                    value={newJurisdiction}
                    onChange={(e) => setNewJurisdiction(e.target.value)}
                    className={INPUT_CLASS}
                  >
                    <option value="">Jurisdiction (optional)</option>
                    {JURISDICTIONS.map((j) => (
                      <option key={j} value={j}>
                        {j}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center">
                  <button type="button" onClick={handleAdd} disabled={adding} className="btn-primary">
                    {adding ? "Adding…" : "Add document"}
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
