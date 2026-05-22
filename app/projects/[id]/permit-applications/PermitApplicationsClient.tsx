"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import ProjectNav from "@/components/ProjectNav";
import PdfFieldEditor, { type PermitField } from "./PdfFieldEditor";

type CompletedPermit = {
  id: string;
  title: string;
  filename: string;
  sourceFilename: string | null;
  url: string | null;
  createdAt: string;
  createdBy: string | null;
};

type ToolLevel = "none" | "read_only" | "standard" | "admin";

export default function PermitApplicationsClient({
  projectId,
  userId,
  toolLevel,
}: {
  projectId: string;
  userId: string;
  toolLevel: ToolLevel;
}) {
  const canEdit = toolLevel === "standard" || toolLevel === "admin";
  const isAdmin = toolLevel === "admin";

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [fields, setFields] = useState<PermitField[] | null>(null);

  const [approving, setApproving] = useState(false);
  const [approveError, setApproveError] = useState<string | null>(null);

  const [completed, setCompleted] = useState<CompletedPermit[]>([]);
  const [loadingCompleted, setLoadingCompleted] = useState(true);

  const loadCompleted = useCallback(async () => {
    setLoadingCompleted(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/permit-applications`);
      if (res.ok) {
        const data = await res.json();
        setCompleted(Array.isArray(data.permitApplications) ? data.permitApplications : []);
      }
    } finally {
      setLoadingCompleted(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadCompleted();
  }, [loadCompleted]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }

  async function runScan(selected: File) {
    setScanning(true);
    setScanError(null);
    setApproveError(null);
    setFields(null);
    try {
      const formData = new FormData();
      formData.append("file", selected);
      const res = await fetch(`/api/projects/${projectId}/permit-applications/scan`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? `Scan failed (${res.status})`);
      }
      const data = await res.json();
      setFields(Array.isArray(data.fields) ? data.fields : []);
    } catch (err) {
      setScanError(err instanceof Error ? err.message : "Failed to scan permit application");
      setFields(null);
    } finally {
      setScanning(false);
    }
  }

  function handleFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (!selected) return;
    if (selected.type && selected.type !== "application/pdf") {
      setScanError("Please choose a PDF file.");
      return;
    }
    setFile(selected);
    if (!title.trim()) {
      setTitle(selected.name.replace(/\.pdf$/i, ""));
    }
    void runScan(selected);
  }

  function updateField(index: number, value: string) {
    setFields((prev) => (prev ? prev.map((f, i) => (i === index ? { ...f, value } : f)) : prev));
  }

  function resetForm() {
    setFile(null);
    setFields(null);
    setTitle("");
    setScanError(null);
    setApproveError(null);
  }

  async function handleApprove() {
    if (!file || !fields) return;
    if (!title.trim()) {
      setApproveError("Please enter a title before approving.");
      return;
    }
    setApproving(true);
    setApproveError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", title.trim());
      formData.append("fields", JSON.stringify(fields));
      const res = await fetch(`/api/projects/${projectId}/permit-applications/approve`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? `Approval failed (${res.status})`);
      }
      const blob = await res.blob();
      const filename =
        decodeURIComponent(res.headers.get("X-Permit-Filename") ?? "") || "permit-application.pdf";

      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(downloadUrl);

      resetForm();
      await loadCompleted();
    } catch (err) {
      setApproveError(err instanceof Error ? err.message : "Failed to approve permit application");
    } finally {
      setApproving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this completed permit application? The PDF will be removed.")) {
      return;
    }
    const res = await fetch(`/api/projects/${projectId}/permit-applications/${id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setCompleted((prev) => prev.filter((p) => p.id !== id));
    } else {
      const data = await res.json().catch(() => ({}));
      window.alert(data?.error ?? "Failed to delete permit application");
    }
  }

  const filledCount = fields ? fields.filter((f) => f.value.trim()).length : 0;

  return (
    <div className="min-h-screen bg-[#FAFAF7] flex flex-col">
      <header className="bg-[#FAFAF7] border-b border-black/[0.06] px-6 h-14 flex items-center justify-between shrink-0">
        <div className="font-semibold text-sm">SiteCommand</div>
        <button onClick={handleLogout} className="text-xs text-black/60 hover:text-black">
          Logout
        </button>
      </header>
      <ProjectNav projectId={projectId} />

      <main className="max-w-4xl w-full mx-auto px-6 py-8">
        <h1 className="text-2xl font-semibold">Permit Applications</h1>
        <p className="text-sm text-black/60 mt-2">
          Upload a permit application PDF and give it a title. Gemini scans the form for fields
          that need filling and searches this project for the answers. Review and edit what it
          found, then approve to download the completed PDF.
        </p>

        {canEdit ? (
          <section className="mt-6 rounded-lg border border-black/10 bg-white p-5 space-y-4">
            <h2 className="text-lg font-medium">New Permit Application</h2>

            <label className="block text-sm">
              <span className="block text-black/70 mb-1">Title</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. City of Austin Building Permit"
                className="w-full rounded-md border border-black/15 px-3 py-2"
              />
            </label>

            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={handleFileSelected}
            />
            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={scanning}
                className="rounded-md bg-black text-white px-4 py-2 text-sm font-medium hover:bg-black/90 disabled:opacity-50"
              >
                {file ? "Replace Permit Application PDF" : "Upload Permit Application"}
              </button>
              {file && (
                <span className="text-sm text-black/60">
                  {file.name}
                  {!scanning && (
                    <button
                      onClick={resetForm}
                      className="ml-2 text-black/40 hover:text-black underline"
                    >
                      Remove
                    </button>
                  )}
                </span>
              )}
            </div>

            {scanning && (
              <p className="text-sm text-black/70">
                Scanning the permit with Gemini and searching project records…
              </p>
            )}
            {scanError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                {scanError}
              </p>
            )}
          </section>
        ) : (
          <p className="mt-6 text-sm text-black/60 rounded-lg border border-black/10 bg-white p-4">
            You have read-only access to Permit Applications. You can view completed permit
            applications below.
          </p>
        )}

        {fields && file && (
          <section className="mt-6 rounded-lg border border-black/10 bg-white p-5 space-y-4">
            <div>
              <h2 className="text-lg font-medium">Review &amp; Edit on the Form</h2>
              <p className="text-sm text-black/60 mt-1">
                Gemini filled {filledCount} of {fields.length} field
                {fields.length === 1 ? "" : "s"}. Each value sits in a yellow box exactly where it
                will appear on the saved PDF — edit any box directly, then approve.
              </p>
            </div>

            <PdfFieldEditor
              file={file}
              fields={fields}
              onChange={updateField}
              disabled={approving}
            />

            {approveError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                {approveError}
              </p>
            )}

            <button
              onClick={handleApprove}
              disabled={approving}
              className="rounded-md bg-emerald-600 text-white px-4 py-2 text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
            >
              {approving ? "Generating PDF…" : "Approve & Download Permit Application"}
            </button>
          </section>
        )}

        <section className="mt-10">
          <h2 className="text-lg font-medium">Completed Permit Applications</h2>
          {loadingCompleted ? (
            <p className="mt-3 text-sm text-black/50">Loading…</p>
          ) : completed.length === 0 ? (
            <p className="mt-3 text-sm text-black/50">
              No completed permit applications yet.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {completed.map((permit) => (
                <li
                  key={permit.id}
                  className="flex items-center justify-between gap-4 rounded-lg border border-black/10 bg-white px-4 py-3"
                >
                  <div className="min-w-0">
                    {permit.url ? (
                      <a
                        href={permit.url}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-blue-600 hover:underline break-words"
                      >
                        {permit.title}
                      </a>
                    ) : (
                      <span className="font-medium text-black/70 break-words">{permit.title}</span>
                    )}
                    <div className="text-xs text-black/45 mt-0.5">
                      {permit.sourceFilename ? `From ${permit.sourceFilename} · ` : ""}
                      {new Date(permit.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {permit.url ? (
                      <a
                        href={permit.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-black/70 hover:text-black"
                      >
                        Open PDF
                      </a>
                    ) : (
                      <span className="text-sm text-black/30">Link unavailable</span>
                    )}
                    {(isAdmin || permit.createdBy === userId) && (
                      <button
                        onClick={() => handleDelete(permit.id)}
                        className="text-sm text-red-500 hover:text-red-700"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
