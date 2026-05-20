"use client";
import { useRef, useState } from "react";
import ProjectNav from "@/components/ProjectNav";

type PermitFields = {
  projectName: string;
  projectAddress: string;
  applicantName: string;
  applicantEmail: string;
  scopeSummary: string;
};

const EMPTY_FIELDS: PermitFields = {
  projectName: "",
  projectAddress: "",
  applicantName: "",
  applicantEmail: "",
  scopeSummary: "",
};

export default function PermitApplicationsClient({ projectId, role, username }: { projectId: string; role: string; username: string }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [readyToReview, setReadyToReview] = useState(false);
  const [fields, setFields] = useState<PermitFields>(EMPTY_FIELDS);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }

  async function handleFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;

    setUploadedFile(file);
    setLoading(true);

    try {
      const [projectRes, tasksRes, rfisRes] = await Promise.all([
        fetch(`/api/projects/${projectId}`),
        fetch(`/api/projects/${projectId}/tasks`),
        fetch(`/api/projects/${projectId}/rfis`),
      ]);
      const project = projectRes.ok ? await projectRes.json() : {};
      const tasks = tasksRes.ok ? await tasksRes.json() : [];
      const rfis = rfisRes.ok ? await rfisRes.json() : [];

      setFields({
        projectName: project?.name ?? "",
        projectAddress: project?.address ?? "",
        applicantName: username,
        applicantEmail: project?.contactEmail ?? "",
        scopeSummary: `Auto-generated from project records: ${Array.isArray(tasks) ? tasks.length : 0} tasks and ${Array.isArray(rfis) ? rfis.length : 0} RFIs reviewed.`,
      });
      setReadyToReview(true);
    } finally {
      setLoading(false);
    }
  }

  async function handleApproveAndGenerate() {
    const { default: jsPDF } = await import("jspdf");
    const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });

    doc.setFontSize(18);
    doc.text("Permit Application", 56, 64);
    doc.setFontSize(11);
    doc.text(`Source template: ${uploadedFile?.name ?? "Uploaded PDF"}`, 56, 90);

    const lines: [string, string][] = [
      ["Project Name", fields.projectName],
      ["Project Address", fields.projectAddress],
      ["Applicant Name", fields.applicantName],
      ["Applicant Email", fields.applicantEmail],
      ["Scope Summary", fields.scopeSummary],
    ];

    let y = 130;
    for (const [label, value] of lines) {
      doc.setFont(undefined, "bold");
      doc.text(`${label}:`, 56, y);
      doc.setFont(undefined, "normal");
      const wrapped = doc.splitTextToSize(value || "-", 460);
      doc.text(wrapped, 180, y);
      y += 24 + (wrapped.length - 1) * 12;
    }

    doc.save("permit-application-filled.pdf");
  }

  return (
    <div className="min-h-screen bg-[#FAFAF7] flex flex-col">
      <header className="bg-[#FAFAF7] border-b border-black/[0.06] px-6 h-14 flex items-center justify-between shrink-0">
        <div className="font-semibold text-sm">SiteCommand</div>
        <button onClick={handleLogout} className="text-xs text-black/60 hover:text-black">Logout</button>
      </header>
      <ProjectNav projectId={projectId} role={role} username={username} />
      <main className="max-w-3xl w-full mx-auto px-6 py-8">
        <h1 className="text-2xl font-semibold">Permit Applications</h1>
        <p className="text-sm text-black/60 mt-2">Upload a permit application PDF. We will scan project data to prefill fields, let you edit, and then save a completed PDF after approval.</p>

        <input ref={fileInputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={handleFileSelected} />
        <button onClick={() => fileInputRef.current?.click()} className="mt-6 rounded-md bg-black text-white px-4 py-2 text-sm font-medium hover:bg-black/90">Upload Permit Application</button>

        {loading && <p className="mt-4 text-sm">Searching project records and preparing application fields…</p>}

        {readyToReview && (
          <div className="mt-8 rounded-lg border border-black/10 bg-white p-5 space-y-4">
            <h2 className="text-lg font-medium">Review & Edit Fields</h2>
            {([
              ["projectName", "Project Name"],
              ["projectAddress", "Project Address"],
              ["applicantName", "Applicant Name"],
              ["applicantEmail", "Applicant Email"],
              ["scopeSummary", "Scope Summary"],
            ] as const).map(([key, label]) => (
              <label key={key} className="block text-sm">
                <span className="block text-black/70 mb-1">{label}</span>
                {key === "scopeSummary" ? (
                  <textarea value={fields[key]} onChange={(e) => setFields((prev) => ({ ...prev, [key]: e.target.value }))} rows={4} className="w-full rounded-md border border-black/15 px-3 py-2" />
                ) : (
                  <input value={fields[key]} onChange={(e) => setFields((prev) => ({ ...prev, [key]: e.target.value }))} className="w-full rounded-md border border-black/15 px-3 py-2" />
                )}
              </label>
            ))}
            <button onClick={handleApproveAndGenerate} className="rounded-md bg-emerald-600 text-white px-4 py-2 text-sm font-medium hover:bg-emerald-700">Approve & Save Permit Application</button>
          </div>
        )}
      </main>
    </div>
  );
}
