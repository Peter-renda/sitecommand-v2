"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ProjectNav from "@/components/ProjectNav";
import ReportFieldsSection, { type ReportFieldValues } from "@/components/ReportFieldsSection";
import { RFI_REPORT_FIELDS } from "@/lib/report-fields";

type DirContact = { id: string; name: string; email: string | null };
type DirectoryContact = {
  id: string;
  type: string;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  group_name: string | null;
  email: string | null;
};
type Specification = { id: string; name: string; code: string | null };
type Drawing = { id: string; drawing_no: string | null; title: string | null };

type RFI = {
  id: string;
  rfi_number: number;
  subject: string | null;
  question: string | null;
  due_date: string | null;
  status: "open" | "closed" | "draft";
  rfi_manager_id: string | null;
  received_from_id: string | null;
  assignees: DirContact[];
  distribution_list: DirContact[];
  responsible_contractor_id: string | null;
  specification_id: string | null;
  drawing_number: string | null;
  created_by: string | null;
};

function contactDisplayName(c: DirectoryContact): string {
  if (c.type === "company") return c.company ?? "Unnamed Company";
  if (c.type === "distribution_group") return c.group_name ?? "Unnamed Group";
  return [c.first_name, c.last_name].filter(Boolean).join(" ") || "Unnamed";
}

function MultiContactPicker({
  directory,
  selected,
  onChange,
  placeholder = "Search directory...",
  filterType,
}: {
  directory: DirectoryContact[];
  selected: DirContact[];
  onChange: (v: DirContact[]) => void;
  placeholder?: string;
  filterType?: "user" | "company" | "distribution_group";
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  let list = directory;
  if (filterType) list = list.filter((c) => c.type === filterType);

  const selectedIds = new Set(selected.map((s) => s.id));
  const filtered = list.filter(
    (c) =>
      !selectedIds.has(c.id) &&
      (contactDisplayName(c).toLowerCase().includes(search.toLowerCase()) ||
        (c.email ?? "").toLowerCase().includes(search.toLowerCase()))
  );

  function add(c: DirectoryContact) {
    onChange([...selected, { id: c.id, name: contactDisplayName(c), email: c.email }]);
    setSearch("");
  }

  function remove(id: string) {
    onChange(selected.filter((s) => s.id !== id));
  }

  return (
    <div ref={ref} className="relative">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selected.map((s) => (
            <span key={s.id} className="flex items-center gap-1 pl-2.5 pr-1.5 py-1 bg-gray-100 text-xs text-gray-700 rounded-full">
              {s.name}
              <button type="button" onClick={() => remove(s.id)} className="text-gray-400 hover:text-gray-700 ml-0.5">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        type="text"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
      />
      {open && filtered.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-100 rounded-md shadow-lg max-h-40 overflow-y-auto z-20">
          {filtered.map((c) => (
            <button key={c.id} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => add(c)} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2">
              <span className="font-medium text-gray-900">{contactDisplayName(c)}</span>
              {c.email && <span className="text-gray-400 text-xs">{c.email}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SingleContactPicker({
  directory,
  selectedId,
  onChange,
  placeholder = "Select...",
  filterType,
}: {
  directory: DirectoryContact[];
  selectedId: string | null;
  onChange: (id: string | null) => void;
  placeholder?: string;
  filterType?: "user" | "company" | "distribution_group";
}) {
  let list = directory;
  if (filterType) list = list.filter((c) => c.type === filterType);
  return (
    <select
      value={selectedId ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
      className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
    >
      <option value="">{placeholder}</option>
      {list.map((c) => (
        <option key={c.id} value={c.id}>{contactDisplayName(c)}</option>
      ))}
    </select>
  );
}

type ToolLevel = "none" | "read_only" | "standard" | "admin";

export default function EditRFIClient({ projectId, rfiId, userId, role, toolLevel }: { projectId: string; rfiId: string; userId: string; role: string; toolLevel: ToolLevel }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [rfi, setRfi] = useState<RFI | null>(null);
  const [directory, setDirectory] = useState<DirectoryContact[]>([]);
  const [specifications, setSpecifications] = useState<Specification[]>([]);
  const [drawings, setDrawings] = useState<Drawing[]>([]);

  const [subject, setSubject] = useState("");
  const [question, setQuestion] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState<"open" | "closed" | "draft">("draft");
  const [rfiManagerId, setRfiManagerId] = useState<string | null>(null);
  const [receivedFromId, setReceivedFromId] = useState<string | null>(null);
  const [assignees, setAssignees] = useState<DirContact[]>([]);
  const [distributionList, setDistributionList] = useState<DirContact[]>([]);
  const [responsibleContractorId, setResponsibleContractorId] = useState<string | null>(null);
  const [specificationId, setSpecificationId] = useState<string | null>(null);
  const [drawingNumber, setDrawingNumber] = useState("");
  const [reportFields, setReportFields] = useState<ReportFieldValues>({});

  useEffect(() => {
    Promise.all([
      fetch(`/api/projects/${projectId}/rfis/${rfiId}`).then((r) => r.json()),
      fetch(`/api/projects/${projectId}/directory`).then((r) => r.json()),
      fetch(`/api/projects/${projectId}/specifications`).then((r) => r.json()),
      fetch(`/api/projects/${projectId}/drawings`).then((r) => (r.ok ? r.json() : { drawings: [] })),
    ])
      .then(([rfiData, dirData, specData, drawingsData]) => {
        setRfi(rfiData);
        setDirectory(Array.isArray(dirData) ? dirData : []);
        setSpecifications(Array.isArray(specData) ? specData : []);
        setDrawings(Array.isArray(drawingsData?.drawings) ? drawingsData.drawings : []);

        setSubject(rfiData.subject ?? "");
        setQuestion(rfiData.question ?? "");
        setDueDate(rfiData.due_date ? rfiData.due_date.slice(0, 10) : "");
        setStatus(rfiData.status ?? "draft");
        setRfiManagerId(rfiData.rfi_manager_id ?? null);
        setReceivedFromId(rfiData.received_from_id ?? null);
        setAssignees(Array.isArray(rfiData.assignees) ? rfiData.assignees : []);
        setDistributionList(Array.isArray(rfiData.distribution_list) ? rfiData.distribution_list : []);
        setResponsibleContractorId(rfiData.responsible_contractor_id ?? null);
        setSpecificationId(rfiData.specification_id ?? null);
        setDrawingNumber(rfiData.drawing_number ?? "");
        setReportFields(rfiData.report_fields ?? {});
      })
      .catch(() => setError("Failed to load RFI for editing."))
      .finally(() => setLoading(false));
  }, [projectId, rfiId]);

  const canEdit = useMemo(() => Boolean(rfi && (
    toolLevel === "admin" ||
    toolLevel === "standard" ||
    role === "admin" ||
    role === "super_admin" ||
    (toolLevel === "read_only" && (rfi.created_by === null || rfi.created_by === userId))
  )), [rfi, userId, role, toolLevel]);

  async function handleSave() {
    if (!rfi) return;
    setSaving(true);
    setError(null);

    const res = await fetch(`/api/projects/${projectId}/rfis/${rfiId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subject,
        question,
        due_date: dueDate || null,
        status,
        rfi_manager_id: rfiManagerId,
        received_from_id: receivedFromId,
        assignees,
        distribution_list: distributionList,
        responsible_contractor_id: responsibleContractorId,
        specification_id: specificationId,
        drawing_number: drawingNumber,
        report_fields: reportFields,
      }),
    });

    setSaving(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setError(err.error ?? "Failed to save RFI.");
      return;
    }

    window.location.href = `/projects/${projectId}/rfis/${rfiId}`;
  }

  if (loading) {
    return (
      <>
        <ProjectNav projectId={projectId} role={role} />
        <main className="px-6 py-8">
          <p className="text-sm text-gray-500">Loading RFI…</p>
        </main>
      </>
    );
  }

  if (!rfi) {
    return (
      <>
        <ProjectNav projectId={projectId} role={role} />
        <main className="px-6 py-8">
          <p className="text-sm text-gray-500">RFI not found.</p>
        </main>
      </>
    );
  }

  if (!canEdit) {
    return (
      <>
        <ProjectNav projectId={projectId} role={role} />
        <main className="px-6 py-8">
          <p className="text-sm text-red-600">You don&apos;t have permission to edit this RFI.</p>
          <a href={`/projects/${projectId}/rfis/${rfiId}`} className="inline-block mt-4 text-sm text-gray-700 underline">Back to RFI</a>
        </main>
      </>
    );
  }

  return (
    <>
      <ProjectNav projectId={projectId} role={role} />
      <main className="max-w-5xl mx-auto px-4 md:px-8 py-8">
        <div className="mb-6">
          <h1 className="font-display text-[24px] leading-tight text-[color:var(--ink)]">Edit RFI #{rfi.rfi_number}</h1>
          <p className="text-sm text-gray-500 mt-1">Update and save all RFI fields.</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5 md:p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value as "open" | "closed" | "draft")} className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm">
                <option value="draft">Draft</option>
                <option value="open">Open</option>
                <option value="closed">Closed</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Due Date</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Drawing #</label>
              <select value={drawingNumber} onChange={(e) => setDrawingNumber(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm bg-white">
                <option value="">Select drawing...</option>
                {drawings.filter((d) => d.drawing_no && d.drawing_no.trim()).map((d) => (
                  <option key={d.id} value={d.drawing_no!}>{d.drawing_no}{d.title ? ` — ${d.title}` : ""}</option>
                ))}
                {drawingNumber && !drawings.some((d) => d.drawing_no === drawingNumber) && (
                  <option value={drawingNumber}>{drawingNumber}</option>
                )}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Subject (max 200 characters)</label>
            <input type="text" maxLength={200} value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" />
            <p className="text-xs text-gray-400 mt-0.5">{subject.length}/200</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Question</label>
            <textarea value={question} onChange={(e) => setQuestion(e.target.value)} rows={5} className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm resize-none" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">RFI Manager</label>
              <SingleContactPicker directory={directory} selectedId={rfiManagerId} onChange={setRfiManagerId} filterType="user" placeholder="Select user..." />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Received From</label>
              <SingleContactPicker directory={directory} selectedId={receivedFromId} onChange={setReceivedFromId} filterType="user" placeholder="Select user..." />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Assignees</label>
            <MultiContactPicker directory={directory} selected={assignees} onChange={setAssignees} placeholder="Add assignees..." filterType="user" />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Distribution List</label>
            <MultiContactPicker directory={directory} selected={distributionList} onChange={setDistributionList} placeholder="Add recipients..." filterType="user" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Responsible Contractor</label>
              <SingleContactPicker directory={directory} selectedId={responsibleContractorId} onChange={setResponsibleContractorId} filterType="company" placeholder="Select company..." />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Specification</label>
              <select value={specificationId ?? ""} onChange={(e) => setSpecificationId(e.target.value || null)} className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm bg-white">
                <option value="">Select specification...</option>
                {specifications.map((s) => (
                  <option key={s.id} value={s.id}>{s.code ? `${s.code} — ${s.name}` : s.name}</option>
                ))}
              </select>
            </div>
          </div>

          <ReportFieldsSection
            title="Report Fields"
            description="Extra RFI attributes surfaced as columns in 360 Reports."
            fields={RFI_REPORT_FIELDS}
            values={reportFields}
            onChange={(key, value) => setReportFields((prev) => ({ ...prev, [key]: value }))}
            columns={2}
          />

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex items-center justify-end gap-3 pt-2">
            <a href={`/projects/${projectId}/rfis/${rfiId}`} className="px-4 py-2 text-sm text-gray-700 border border-gray-200 rounded-md hover:bg-gray-50">Cancel</a>
            <button type="button" onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm text-white bg-gray-900 rounded-md hover:bg-gray-700 disabled:opacity-50">
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>
        </div>
      </main>
    </>
  );
}
