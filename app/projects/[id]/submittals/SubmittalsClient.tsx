"use client";

import { useState, useEffect, useRef, ChangeEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ProjectNav from "@/components/ProjectNav";

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

type Submittal = {
  id: string;
  submittal_number: number;
  revision: string | null;
  title: string;
  specification_id: string | null;
  submittal_type: string | null;
  status: string;
  responsible_contractor_id: string | null;
  received_from_id: string | null;
  submittal_manager_id: string | null;
  submit_by: string | null;
  received_date: string | null;
  issue_date: string | null;
  final_due_date: string | null;
  cost_code: string | null;
  linked_drawings: string | null;
  distribution_list: DirContact[];
  ball_in_court_id: string | null;
  lead_time: number | null;
  required_on_site_date: string | null;
  private: boolean;
  description: string | null;
  attachments: { name: string; url: string }[];
  distributed_at?: string | null;
  workflow_steps?: {
    step: number;
    person_id: string | null;
    role: string;
    sent_date?: string | null;
    returned_date?: string | null;
    response?: string | null;
  }[];
  location?: string | null;
  schedule_task?: string | null;
  created_by: string | null;
  created_at: string;
};

type SubmittalPackage = {
  id: string;
  package_number: number;
  title: string;
  specification_id: string | null;
  description: string | null;
  submittal_count: number;
  distributed_count: number;
  created_at: string;
};


const SUBMITTAL_TYPES = [
  "Document",
  "Other",
  "Pay Request",
  "Payroll",
  "Plans",
  "Prints",
  "Product Information",
  "Product Manual",
  "Sample",
  "Shop Drawing",
  "Specification",
];
const STATUSES = [
  "closed", "draft", "open", "approved", "approved_as_noted", "for_the_record",
  "make_corrections", "no_exceptions_taken", "not_reviewed", "note_markings",
  "rejected", "resubmitted", "revise_and_resubmit", "revise_and_resubmit_2",
];
const STATUS_LABELS: Record<string, string> = {
  closed: "Closed",
  draft: "Draft",
  open: "Open",
  approved: "Approved",
  approved_as_noted: "Approved as noted",
  for_the_record: "For the Record",
  make_corrections: "Make corrections",
  no_exceptions_taken: "No exceptions taken",
  not_reviewed: "Not Reviewed/No Action Taken",
  note_markings: "Note Markings",
  rejected: "Rejected",
  resubmitted: "Resubmitted",
  revise_and_resubmit: "Revise & Resubmit",
  revise_and_resubmit_2: "Revise and Resubmit",
};
const STATUS_PILL: Record<string, string> = {
  closed: "pill-coc",
  draft: "pill-warn",
  open: "pill-info",
  approved: "pill-coc",
  approved_as_noted: "pill-coc",
  for_the_record: "pill-post",
  make_corrections: "pill-open",
  no_exceptions_taken: "pill-coc",
  not_reviewed: "pill-post",
  note_markings: "pill-warn",
  rejected: "pill-danger",
  resubmitted: "pill-info",
  revise_and_resubmit: "pill-open",
  revise_and_resubmit_2: "pill-open",
};
function contactDisplayName(c: DirectoryContact): string {
  if (c.type === "company") return c.company ?? "Unnamed Company";
  if (c.type === "distribution_group") return c.group_name ?? "Unnamed Group";
  return [c.first_name, c.last_name].filter(Boolean).join(" ") || "Unnamed";
}

function formatDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}


function safeText(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function safeLocaleCompare(a: unknown, b: unknown, numeric = false): number {
  return safeText(a).localeCompare(safeText(b), undefined, { numeric });
}

function getContactNameById(directory: DirectoryContact[], id: string | null): string {
  if (!id) return "—";
  const c = directory.find((x) => x.id === id);
  return c ? contactDisplayName(c) : "—";
}

function getSpecName(specifications: Specification[], id: string | null): string {
  if (!id) return "—";
  const s = specifications.find((x) => x.id === id);
  return s ? s.name + (s.code ? ` (${s.code})` : "") : "—";
}

function normalizeWorkflowSteps(steps: Submittal["workflow_steps"]): NonNullable<Submittal["workflow_steps"]> {
  if (!Array.isArray(steps)) return [];
  return steps.filter((step): step is NonNullable<Submittal["workflow_steps"]>[number] => Boolean(step && typeof step === "object"));
}

function summarizeApprovers(directory: DirectoryContact[], steps: Submittal["workflow_steps"]): string {
  const approverIds = normalizeWorkflowSteps(steps)
    .filter((step) => step.person_id && step.role?.toLowerCase().includes("approver"))
    .map((step) => step.person_id as string);
  if (approverIds.length === 0) return "—";
  const names = approverIds
    .map((id) => getContactNameById(directory, id))
    .filter((name) => name !== "—");
  if (names.length === 0) return "—";
  return Array.from(new Set(names)).join(", ");
}

function latestWorkflowResponse(steps: Submittal["workflow_steps"]) {
  const withResponse = normalizeWorkflowSteps(steps).filter((step) => step.response || step.sent_date || step.returned_date);
  if (withResponse.length === 0) return null;
  return [...withResponse].sort((a, b) => (b.step ?? 0) - (a.step ?? 0))[0];
}
function MultiContactPicker({
  directory, selected, onChange, placeholder = "Search directory...", filterType,
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
  const selectedIds = new Set(selected.map((s) => s.id));
  const sourceList = filterType ? directory.filter((c) => c.type === filterType) : directory;
  const filtered = sourceList.filter(
    (c) => !selectedIds.has(c.id) &&
      (contactDisplayName(c).toLowerCase().includes(search.toLowerCase()) ||
        (c.email ?? "").toLowerCase().includes(search.toLowerCase()))
  );
  function add(c: DirectoryContact) {
    onChange([...selected, { id: c.id, name: contactDisplayName(c), email: c.email }]);
    setSearch("");
  }
  function remove(id: string) { onChange(selected.filter((s) => s.id !== id)); }
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
      <input type="text" value={search} onChange={(e) => { setSearch(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} placeholder={placeholder} className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
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
      {open && search && filtered.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-100 rounded-md shadow-lg px-3 py-2 z-20"><p className="text-xs text-gray-400">No matching contacts</p></div>
      )}
    </div>
  );
}

function SpecificationPicker({
  projectId, specifications, selectedId, onChange, onSpecCreated,
}: {
  projectId: string;
  specifications: Specification[];
  selectedId: string | null;
  onChange: (id: string | null) => void;
  onSpecCreated: (spec: Specification) => void;
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCode, setNewCode] = useState("");
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setShowCreate(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const selected = specifications.find((s) => s.id === selectedId) ?? null;
  const filtered = specifications.filter((s) => {
    const q = search.toLowerCase();
    return s.name.toLowerCase().includes(q) || (s.code ?? "").toLowerCase().includes(q);
  });

  function specLabel(s: Specification) {
    return s.code ? `${s.code} - ${s.name}` : s.name;
  }

  async function handleCreateSpec() {
    if (!newName.trim()) return;
    setSaving(true);
    const res = await fetch(`/api/projects/${projectId}/specifications`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim(), code: newCode.trim() || null }),
    });
    if (res.ok) {
      const spec: Specification = await res.json();
      onSpecCreated(spec);
      onChange(spec.id);
      setNewName("");
      setNewCode("");
      setShowCreate(false);
      setOpen(false);
      setSearch("");
    }
    setSaving(false);
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => { setOpen((v) => !v); setShowCreate(false); }}
        className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm text-left bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 flex items-center justify-between"
      >
        <span className={selected ? "text-gray-900" : "text-gray-400"}>
          {selected ? specLabel(selected) : "Select specification..."}
        </span>
        <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-30">
          {/* Search */}
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search"
                autoFocus
                className="w-full pl-3 pr-8 py-1.5 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
              <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" /></svg>
            </div>
          </div>

          {/* List */}
          <div className="max-h-48 overflow-y-auto">
            {filtered.length === 0 && (
              <p className="px-3 py-2 text-xs text-gray-400">No specifications found</p>
            )}
            {filtered.map((s) => (
              <button
                key={s.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { onChange(s.id); setOpen(false); setSearch(""); }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${selectedId === s.id ? "font-medium text-gray-900" : "text-gray-700"}`}
              >
                {specLabel(s)}
              </button>
            ))}
          </div>

          {/* Create new */}
          {showCreate ? (
            <div className="border-t border-gray-100 p-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  placeholder="Code (e.g. 02-530)"
                  className="px-2 py-1.5 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Name (required)"
                  className="px-2 py-1.5 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setShowCreate(false)} className="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50">Cancel</button>
                <button type="button" onClick={handleCreateSpec} disabled={saving || !newName.trim()} className="px-3 py-1.5 text-xs font-medium text-white bg-gray-900 rounded-md hover:bg-gray-700 disabled:opacity-50">
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          ) : (
            <div className="border-t border-gray-100 p-2">
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setShowCreate(true)}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-gray-900 rounded-md hover:bg-gray-700 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                Create New Specification
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SingleContactPicker({
  directory, selectedId, onChange, placeholder = "Select...", filterType,
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
    <select value={selectedId ?? ""} onChange={(e) => onChange(e.target.value || null)} className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white">
      <option value="">{placeholder}</option>
      {list.map((c) => <option key={c.id} value={c.id}>{contactDisplayName(c)}</option>)}
    </select>
  );
}

export function CreateSubmittalModal({
  projectId, nextNumber, directory, specifications, packages, initialSpecificationId, onConfirm, onCancel, onSpecCreated,
}: {
  projectId: string;
  nextNumber: number;
  directory: DirectoryContact[];
  specifications: Specification[];
  packages: SubmittalPackage[];
  initialSpecificationId?: string | null;
  onConfirm: (data: Record<string, unknown>, sendEmails: boolean) => void;
  onCancel: () => void;
  onSpecCreated: (spec: Specification) => void;
}) {
  const today = new Date().toISOString().split("T")[0];
  const [title, setTitle] = useState("");
  const [submittalNumber, setSubmittalNumber] = useState(String(nextNumber));
  const [revision, setRevision] = useState("0");
  const [specificationId, setSpecificationId] = useState<string | null>(initialSpecificationId ?? null);
  const [submittalType, setSubmittalType] = useState("");
  const [submittalPackageId, setSubmittalPackageId] = useState<string>("");
  const [status, setStatus] = useState("open");
  const [responsibleContractorId, setResponsibleContractorId] = useState<string | null>(null);
  const [receivedFromId, setReceivedFromId] = useState<string | null>(null);
  const [submittalManagerId, setSubmittalManagerId] = useState<string | null>(null);
  const [submitBy, setSubmitBy] = useState("");
  const [receivedDate, setReceivedDate] = useState("");
  const [issueDate, setIssueDate] = useState(today);
  const [finalDueDate, setFinalDueDate] = useState("");
  const [costCode, setCostCode] = useState("");
  const [linkedDrawings, setLinkedDrawings] = useState("");
  const [distributionList, setDistributionList] = useState<DirContact[]>([]);
  const [ballInCourtId, setBallInCourtId] = useState<string | null>(null);
  const [leadTime, setLeadTime] = useState("");
  const [requiredOnSiteDate, setRequiredOnSiteDate] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [description, setDescription] = useState("");
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  // Additional Submittal Fields
  const [approverNameId, setApproverNameId] = useState<string | null>(null);
  const [ownersManual, setOwnersManual] = useState("");
  const [packageNotes, setPackageNotes] = useState("");
  // Delivery Information
  const [deliveryOpen, setDeliveryOpen] = useState(true);
  const [confirmedDeliveryDate, setConfirmedDeliveryDate] = useState("");
  const [actualDeliveryDate, setActualDeliveryDate] = useState("");
  // Submittal Workflow
  const [workflowOpen, setWorkflowOpen] = useState(true);
  type WorkflowStep = { id: string; personId: string | null; role: string; dueDate: string; required: boolean };
  const [workflowSteps, setWorkflowSteps] = useState<WorkflowStep[]>([
    { id: crypto.randomUUID(), personId: null, role: "Approver", dueDate: "", required: false },
  ]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [budgetCostCodes, setBudgetCostCodes] = useState<{ code: string; description: string }[]>([]);
  const [projectDrawings, setProjectDrawings] = useState<{ number: string; title: string }[]>([]);
  const [drawingPickerOpen, setDrawingPickerOpen] = useState(false);
  const drawingPickerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/budget`)
      .then((r) => r.json())
      .then((data: { cost_code: string; description: string }[]) => {
        if (!Array.isArray(data)) return;
        const seen = new Set<string>();
        const unique = data
          .filter((item) => item.cost_code && !seen.has(item.cost_code) && seen.add(item.cost_code))
          .map((item) => ({ code: item.cost_code, description: item.description }));
        setBudgetCostCodes(unique);
      })
      .catch(() => {});
  }, [projectId]);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/drawings`)
      .then((r) => r.json())
      .then((data: { drawings?: { drawing_no: string | null; title: string | null }[] }) => {
        const rows = Array.isArray(data?.drawings) ? data.drawings : [];
        const seen = new Set<string>();
        const unique = rows
          .map((d) => ({ number: (d.drawing_no ?? "").trim(), title: (d.title ?? "").trim() }))
          .filter((d) => d.number && !seen.has(d.number) && seen.add(d.number))
          .sort((a, b) => safeLocaleCompare(a.number, b.number, true));
        setProjectDrawings(unique);
      })
      .catch(() => {});
  }, [projectId]);

  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      if (drawingPickerRef.current && !drawingPickerRef.current.contains(e.target as Node)) {
        setDrawingPickerOpen(false);
      }
    }
    window.addEventListener("mousedown", onPointerDown);
    return () => window.removeEventListener("mousedown", onPointerDown);
  }, []);

  const linkedDrawingList = linkedDrawings.split(",").map((s) => s.trim()).filter(Boolean);
  function toggleLinkedDrawing(num: string) {
    const current = new Set(linkedDrawingList);
    if (current.has(num)) current.delete(num);
    else current.add(num);
    setLinkedDrawings(Array.from(current).join(", "));
  }

  function buildData() {
    const parsedSubmittalNumber = Number(submittalNumber);
    return {
      title,
      submittal_number: Number.isFinite(parsedSubmittalNumber) ? parsedSubmittalNumber : nextNumber,
      revision,
      specification_id: specificationId,
      submittal_type: submittalType || null,
      status, responsible_contractor_id: responsibleContractorId, received_from_id: receivedFromId,
      submittal_manager_id: submittalManagerId, submit_by: submitBy || null,
      received_date: receivedDate || null, issue_date: issueDate || null,
      final_due_date: finalDueDate || null, cost_code: costCode || null,
      linked_drawings: linkedDrawings || null, distribution_list: distributionList,
      ball_in_court_id: ballInCourtId,
      lead_time: leadTime ? Number(leadTime) : null,
      required_on_site_date: requiredOnSiteDate || null, private: isPrivate,
      description: description || null, attachmentFiles, attachments: [],
      approver_name_id: approverNameId, owners_manual: ownersManual || null, package_notes: packageNotes || null,
      confirmed_delivery_date: confirmedDeliveryDate || null, actual_delivery_date: actualDeliveryDate || null,
      workflow_steps: workflowSteps.map((s, i) => ({ step: i + 1, person_id: s.personId, required: s.required, role: s.role, due_date: s.dueDate || null })),
      submittal_package_id: submittalPackageId || null,
    };
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4 py-6 overflow-y-auto">
      <div className="bg-white rounded-xl w-full max-w-2xl shadow-xl my-auto max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h2 className="text-sm font-semibold text-gray-900">Create Submittal</h2>
          <button type="button" onClick={onCancel} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Title <span className="text-red-500">*</span></label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Submittal title" className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
          </div>

          {/* Number & Revision / Submittal Type */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Number</label>
              <input
                type="number"
                min={1}
                step={1}
                value={submittalNumber}
                onChange={(e) => setSubmittalNumber(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Revision <span className="text-red-500">*</span></label>
              <input type="text" value={revision} onChange={(e) => setRevision(e.target.value)} placeholder="0" className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Submittal Type</label>
              <select value={submittalType} onChange={(e) => setSubmittalType(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white">
                <option value="">Select type...</option>
                {SUBMITTAL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          {/* Specification */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Specification</label>
            <SpecificationPicker
              projectId={projectId}
              specifications={specifications}
              selectedId={specificationId}
              onChange={setSpecificationId}
              onSpecCreated={onSpecCreated}
            />
          </div>

          {/* Submittal Package */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Submittal Package</label>
            <select
              value={submittalPackageId}
              onChange={(e) => setSubmittalPackageId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
            >
              <option value="">None</option>
              {packages.map((p) => (
                <option key={p.id} value={p.id}>
                  #{p.package_number} — {p.title}
                </option>
              ))}
            </select>
          </div>

          {/* Status / Submittal Manager */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Status <span className="text-red-500">*</span></label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white">
                {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Submittal Manager <span className="text-red-500">*</span></label>
              <SingleContactPicker directory={directory} selectedId={submittalManagerId} onChange={setSubmittalManagerId} filterType="user" placeholder="Select..." />
            </div>
          </div>

          {/* Responsible Contractor / Received From */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Responsible Contractor</label>
              <SingleContactPicker directory={directory} selectedId={responsibleContractorId} onChange={setResponsibleContractorId} filterType="company" placeholder="Select company..." />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Received From</label>
              <SingleContactPicker directory={directory} selectedId={receivedFromId} onChange={setReceivedFromId} filterType="user" placeholder="Select..." />
            </div>
          </div>

          {/* Submit By / Received Date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Submit By</label>
              <input type="date" value={submitBy} onChange={(e) => setSubmitBy(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Received Date</label>
              <input type="date" value={receivedDate} onChange={(e) => setReceivedDate(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white" />
            </div>
          </div>

          {/* Issue Date / Final Due Date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Issue Date</label>
              <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Final Due Date</label>
              <input type="date" value={finalDueDate} onChange={(e) => setFinalDueDate(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white" />
            </div>
          </div>

          {/* Cost Code / Linked Drawings */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Cost Code</label>
              {budgetCostCodes.length > 0 ? (
                <select value={costCode} onChange={(e) => setCostCode(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white">
                  <option value="">Select cost code...</option>
                  {budgetCostCodes.map((item) => (
                    <option key={item.code} value={item.code}>
                      {item.code}{item.description ? ` – ${item.description}` : ""}
                    </option>
                  ))}
                </select>
              ) : (
                <input type="text" value={costCode} onChange={(e) => setCostCode(e.target.value)} placeholder="Cost code" className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Linked Drawings</label>
              <div className="relative" ref={drawingPickerRef}>
                <button
                  type="button"
                  onClick={() => setDrawingPickerOpen((o) => !o)}
                  disabled={projectDrawings.length === 0}
                  className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm bg-white text-left flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:bg-gray-50 disabled:text-gray-400"
                >
                  <span className="truncate">
                    {projectDrawings.length === 0
                      ? "No drawings available"
                      : linkedDrawingList.length === 0
                      ? "Select drawings..."
                      : `${linkedDrawingList.length} selected`}
                  </span>
                  <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform ${drawingPickerOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 20 20" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 8l4 4 4-4" />
                  </svg>
                </button>
                {drawingPickerOpen && projectDrawings.length > 0 && (
                  <div className="absolute z-20 mt-1 w-full max-h-56 overflow-auto bg-white border border-gray-200 rounded-md shadow-lg">
                    {projectDrawings.map((d) => {
                      const checked = linkedDrawingList.includes(d.number);
                      return (
                        <label key={d.number} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer">
                          <input type="checkbox" checked={checked} onChange={() => toggleLinkedDrawing(d.number)} className="h-3.5 w-3.5" />
                          <span className="font-mono text-gray-700">{d.number}</span>
                          {d.title && <span className="text-gray-400 truncate">— {d.title}</span>}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
              {linkedDrawingList.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {linkedDrawingList.map((num) => (
                    <span key={num} className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded">
                      {num}
                      <button type="button" onClick={() => toggleLinkedDrawing(num)} className="text-gray-400 hover:text-gray-700">×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Ball In Court */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Ball In Court</label>
            <SingleContactPicker directory={directory} selectedId={ballInCourtId} onChange={setBallInCourtId} filterType="user" placeholder="Select..." />
          </div>

          {/* Lead Time / Required On-Site Date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Lead Time (days)</label>
              <input type="number" min="0" value={leadTime} onChange={(e) => setLeadTime(e.target.value)} placeholder="0" className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Required On-Site Date</label>
              <input type="date" value={requiredOnSiteDate} onChange={(e) => setRequiredOnSiteDate(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white" />
            </div>
          </div>

          {/* Distribution List */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Distribution List</label>
            <MultiContactPicker directory={directory} selected={distributionList} onChange={setDistributionList} filterType="user" placeholder="Search directory..." />
          </div>

          {/* Private */}
          <div className="flex items-center gap-3 py-2 px-3 bg-gray-50 rounded-md">
            <input type="checkbox" id="submittal-private" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} className="rounded border-gray-300 text-gray-900" />
            <label htmlFor="submittal-private" className="text-sm text-gray-700 cursor-pointer">Visible only to admins, workflow, and distribution list members</label>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder="Description..." className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none" />
          </div>

          {/* Attachments */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Attachments</label>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                const list = e.target.files ? Array.from(e.target.files) : [];
                if (list.length > 0) setAttachmentFiles((prev) => [...prev, ...list]);
                e.target.value = "";
              }}
            />
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const list = e.dataTransfer.files ? Array.from(e.dataTransfer.files) : [];
                if (list.length > 0) setAttachmentFiles((prev) => [...prev, ...list]);
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${dragOver ? "border-gray-400 bg-gray-50" : "border-gray-200 hover:border-gray-300"}`}
            >
              <p className="text-sm text-gray-500">Drag and drop files or click to attach</p>
            </div>
            {attachmentFiles.length > 0 && (
              <ul className="mt-2 space-y-1">
                {attachmentFiles.map((f, i) => (
                  <li key={`${f.name}-${i}`} className="flex items-center justify-between px-2 py-1 text-xs bg-gray-50 rounded">
                    <span className="truncate text-gray-700">{f.name}</span>
                    <button
                      type="button"
                      onClick={() => setAttachmentFiles((prev) => prev.filter((_, idx) => idx !== i))}
                      className="text-gray-400 hover:text-gray-700 ml-2"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Additional Submittal Fields */}
          <div className="pt-2">
            <p className="text-xs font-semibold text-gray-700 mb-3">Additional Submittal Fields</p>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Approver Name</label>
                <SingleContactPicker directory={directory} selectedId={approverNameId} onChange={setApproverNameId} filterType="user" placeholder="Select..." />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Owner&apos;s Manual</label>
                <select value={ownersManual} onChange={(e) => setOwnersManual(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white">
                  <option value=""></option>
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                  <option value="N/A">N/A</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Package Notes</label>
                <select value={packageNotes} onChange={(e) => setPackageNotes(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white">
                  <option value=""></option>
                  <option value="Make Corrections Noted">Make Corrections Noted</option>
                  <option value="No Exceptions Taken">No Exceptions Taken</option>
                  <option value="Rejected">Rejected</option>
                  <option value="Revise and Resubmit">Revise and Resubmit</option>
                  <option value="Sub Specified Item">Sub Specified Item</option>
                </select>
              </div>
            </div>
          </div>

          {/* Delivery Information */}
          <div className="border border-gray-100 rounded-lg">
            <button type="button" onClick={() => setDeliveryOpen((o) => !o)} className="w-full flex items-center gap-2 px-4 py-3 text-left">
              <svg className={`w-4 h-4 text-gray-500 transition-transform ${deliveryOpen ? "rotate-0" : "-rotate-90"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
              <span className="text-sm font-semibold text-gray-800">Delivery Information</span>
            </button>
            {deliveryOpen && (
              <div className="px-4 pb-4 grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Confirmed Delivery Date</label>
                  <input type="date" value={confirmedDeliveryDate} onChange={(e) => setConfirmedDeliveryDate(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Actual Delivery Date</label>
                  <input type="date" value={actualDeliveryDate} onChange={(e) => setActualDeliveryDate(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white" />
                </div>
              </div>
            )}
          </div>

          {/* Submittal Workflow */}
          <div className="border border-gray-100 rounded-lg">
            <button type="button" onClick={() => setWorkflowOpen((o) => !o)} className="w-full flex items-center gap-2 px-4 py-3 text-left">
              <svg className={`w-4 h-4 text-gray-500 transition-transform ${workflowOpen ? "rotate-0" : "-rotate-90"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
              <span className="text-sm font-semibold text-gray-800">Submittal Workflow</span>
            </button>
            {workflowOpen && (
              <div className="px-4 pb-4 space-y-3">
                <p className="text-xs text-gray-500">Select from a predefined template or build from scratch</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50 text-gray-500">
                        <th className="w-8 px-2 py-2 text-left font-medium">Step</th>
                        <th className="px-2 py-2 text-left font-medium">Name</th>
                        <th className="px-2 py-2 text-left font-medium">Role</th>
                        <th className="px-2 py-2 text-left font-medium">Due Date</th>
                        <th className="px-2 py-2 text-left font-medium">Required</th>
                        <th className="w-8"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {workflowSteps.map((step, idx) => (
                        <tr key={step.id}>
                          <td className="px-2 py-2 text-gray-500 text-center">{idx + 1}</td>
                          <td className="px-2 py-2">
                            <SingleContactPicker directory={directory} selectedId={step.personId} onChange={(id) => setWorkflowSteps((prev) => prev.map((s) => s.id === step.id ? { ...s, personId: id } : s))} filterType="user" placeholder="Select a Person" />
                          </td>
                          <td className="px-2 py-2">
                            <select value={step.role} onChange={(e) => setWorkflowSteps((prev) => prev.map((s) => s.id === step.id ? { ...s, role: e.target.value } : s))} className="w-full px-2 py-1.5 border border-gray-200 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white">
                              <option>Approver</option>
                              <option>Reviewer</option>
                              <option>Submitter</option>
                              <option>CC</option>
                            </select>
                          </td>
                          <td className="px-2 py-2">
                            <input type="date" value={step.dueDate} onChange={(e) => setWorkflowSteps((prev) => prev.map((s) => s.id === step.id ? { ...s, dueDate: e.target.value } : s))} className="w-full px-2 py-1.5 border border-gray-200 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white" />
                          </td>
                          <td className="px-2 py-2">
                            <label className="inline-flex items-center">
                              <input
                                type="checkbox"
                                checked={step.required}
                                title="Mark required"
                                onChange={(e) => setWorkflowSteps((prev) => prev.map((s) => s.id === step.id ? { ...s, required: e.target.checked } : s))}
                                className="h-3.5 w-3.5 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                              />
                            </label>
                          </td>
                          <td className="px-2 py-2">
                            {workflowSteps.length > 1 && (
                              <button type="button" onClick={() => setWorkflowSteps((prev) => prev.filter((s) => s.id !== step.id))} className="text-gray-400 hover:text-red-500 transition-colors">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button type="button" onClick={() => setWorkflowSteps((prev) => [...prev, { id: crypto.randomUUID(), personId: null, role: "Approver", dueDate: "", required: false }])} className="px-3 py-1.5 text-xs font-medium text-gray-700 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors">
                  Add Step
                </button>
              </div>
            )}
          </div>

          {/* Actions */}
          {(() => {
            const missing: string[] = [];
            if (!title.trim()) missing.push("Title");
            if (!submittalManagerId) missing.push("Submittal Manager");
            const disabled = missing.length > 0;
            const disabledReason = disabled ? `Required: ${missing.join(", ")}` : "";
            return (
              <div className="pt-4 border-t border-gray-100">
                {disabled && (
                  <p className="text-xs text-red-600 mb-2">{disabledReason}</p>
                )}
                <div className="flex gap-3 justify-end">
                  <button type="button" onClick={onCancel} className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors">Cancel</button>
                  <button
                    type="button"
                    onClick={() => onConfirm(buildData(), false)}
                    disabled={disabled}
                    title={disabledReason}
                    className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Create
                  </button>
                  <button
                    type="button"
                    onClick={() => onConfirm(buildData(), true)}
                    disabled={disabled}
                    title={disabledReason}
                    className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-md hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Create and send emails
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

function exportSubmittalsPDF(submittals: Submittal[], directory: DirectoryContact[], specifications: Specification[]) {
  const rows = submittals.map((s) => [
    `${s.submittal_number}${s.revision ? `-${s.revision}` : ""}`,
    s.title,
    s.submittal_type ?? "—",
    STATUS_LABELS[s.status] ?? s.status,
    getSpecName(specifications, s.specification_id),
    getContactNameById(directory, s.submittal_manager_id),
    getContactNameById(directory, s.responsible_contractor_id),
    formatDate(s.submit_by),
    formatDate(s.final_due_date),
  ]);
  const headers = ["#", "Title", "Type", "Status", "Specification", "Manager", "Contractor", "Submit By", "Final Due"];
  const thRow = headers.map((h) => `<th>${h}</th>`).join("");
  const tableRows = rows.map((row) => `<tr>${row.map((cell) => `<td>${String(cell).replace(/</g, "&lt;")}</td>`).join("")}</tr>`).join("");
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Submittals</title>
    <style>body{font-family:Arial,sans-serif;font-size:11px;padding:20px;}h1{font-size:16px;margin-bottom:16px;}table{width:100%;border-collapse:collapse;}th{background:#f3f4f6;text-align:left;padding:8px 10px;font-size:10px;text-transform:uppercase;}td{padding:8px 10px;border-bottom:1px solid #e5e7eb;}@media print{body{padding:0;}}</style></head><body>
    <h1>Submittals</h1><table><thead><tr>${thRow}</tr></thead><tbody>${tableRows}</tbody></table>
    <script>window.onload=()=>{window.print();}<\/script></body></html>`;
  const win = window.open("", "_blank");
  if (win) { win.document.write(html); win.document.close(); }
}

export default function SubmittalsClient({ projectId, role, username, userId, userType }: { projectId: string; role: string; username: string; userId: string; userType: string }) {
  const isExternalViewer = userType === "external";
  const router = useRouter();
  const searchParams = useSearchParams();
  const shouldPromptForSpecs = searchParams.get("createFromSpecs") === "1";
  const shouldOpenCreate = searchParams.get("openCreate") === "1";
  const selectedSpecificationId = searchParams.get("specificationId");
  const [submittals, setSubmittals] = useState<Submittal[]>([]);
  const [packages, setPackages] = useState<SubmittalPackage[]>([]);
  const [directory, setDirectory] = useState<DirectoryContact[]>([]);
  const [specifications, setSpecifications] = useState<Specification[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(shouldOpenCreate);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"items" | "packages" | "recycle_bin" | "spec_sections">("items");
  const [showProceedToSpecificationsModal, setShowProceedToSpecificationsModal] = useState(shouldPromptForSpecs);
  const [prefilledSpecificationId, setPrefilledSpecificationId] = useState<string | null>(selectedSpecificationId);
  const createMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (shouldPromptForSpecs || shouldOpenCreate || selectedSpecificationId) {
      const next = new URLSearchParams(searchParams.toString());
      next.delete("createFromSpecs");
      next.delete("openCreate");
      next.delete("specificationId");
      const query = next.toString();
      window.history.replaceState({}, "", query ? `?${query}` : window.location.pathname);
    }
  }, [searchParams, selectedSpecificationId, shouldOpenCreate, shouldPromptForSpecs]);

  useEffect(() => {
    Promise.all([
      fetch(`/api/projects/${projectId}/submittals${activeTab === "recycle_bin" ? "?recycle_bin=true" : ""}`).then((r) => r.json()),
      fetch(`/api/projects/${projectId}/submittal-packages`).then((r) => r.json()),
      fetch(`/api/projects/${projectId}/directory`).then((r) => r.json()),
      fetch(`/api/projects/${projectId}/specifications`).then((r) => r.json()),
    ]).then(([sData, pData, dirData, specData]) => {
      setSubmittals(Array.isArray(sData) ? sData : []);
      setPackages(Array.isArray(pData) ? pData : []);
      setDirectory(Array.isArray(dirData) ? dirData : []);
      setSpecifications(Array.isArray(specData) ? specData : []);
      setLoading(false);
    });
  }, [projectId, activeTab]);

  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      if (createMenuRef.current && !createMenuRef.current.contains(e.target as Node)) {
        setShowCreateMenu(false);
      }
    }
    window.addEventListener("mousedown", onPointerDown);
    return () => window.removeEventListener("mousedown", onPointerDown);
  }, []);

  const nextNumber = submittals.length > 0 ? Math.max(...submittals.map((s) => s.submittal_number)) + 1 : 1;
  const specSectionRows = Array.from(
    submittals.reduce((acc, submittal) => {
      const key = submittal.specification_id ?? "none";
      const existing = acc.get(key) ?? { key, name: getSpecName(specifications, submittal.specification_id), total: 0, open: 0, closed: 0 };
      existing.total += 1;
      if (submittal.status === "closed") existing.closed += 1;
      else existing.open += 1;
      acc.set(key, existing);
      return acc;
    }, new Map<string, { key: string; name: string; total: number; open: number; closed: number }>())
  ).sort((a, b) => safeLocaleCompare(a.name, b.name));

  async function handleCreate(data: Record<string, unknown>, sendEmails: boolean) {
    setShowCreate(false);
    setShowCreateMenu(false);
    setCreating(true);
    const { attachmentFiles, submittal_package_id, ...rest } = data;
    const res = await fetch(`/api/projects/${projectId}/submittals`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rest),
    });
    if (res.ok) {
      const newSubmittal: Submittal = await res.json();
      const files = Array.isArray(attachmentFiles) ? attachmentFiles.filter((f): f is File => f instanceof File) : [];
      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);
        const attRes = await fetch(`/api/projects/${projectId}/submittals/${newSubmittal.id}/attachment`, { method: "POST", body: formData });
        if (attRes.ok) {
          const updated = await attRes.json();
          newSubmittal.attachments = updated.attachments ?? [];
        }
      }
      if (typeof submittal_package_id === "string" && submittal_package_id) {
        const pkgRes = await fetch(`/api/projects/${projectId}/submittal-packages/${submittal_package_id}/actions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "add_existing", payload: { submittal_ids: [newSubmittal.id] } }),
        });
        if (pkgRes.ok) {
          setPackages((prev) => prev.map((p) => p.id === submittal_package_id ? { ...p, submittal_count: p.submittal_count + 1 } : p));
        }
      }
      setSubmittals((prev) => [...prev, newSubmittal]);
      if (sendEmails) {
        await fetch(`/api/projects/${projectId}/submittals/${newSubmittal.id}/notify`, {
          method: "POST",
        });
      }
    }
    setCreating(false);
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }

  function handleProceedToSpecifications() {
    setShowProceedToSpecificationsModal(false);
    const returnTo = `/projects/${projectId}/submittals?openCreate=1`;
    router.push(`/projects/${projectId}/specifications?generateSubmittal=1&returnTo=${encodeURIComponent(returnTo)}`);
  }

  async function runBulkAction(action: "mark_private" | "mark_public" | "redistribute" | "delete" | "retrieve" | "apply_workflow" | "edit", payload?: Record<string, unknown>) {
    if (selectedIds.length === 0 || bulkLoading) return;
    if (action === "delete" && !confirm(`Send ${selectedIds.length} submittal(s) to Recycle Bin?`)) return;
    if (action === "retrieve" && !confirm(`Retrieve ${selectedIds.length} submittal(s) from Recycle Bin?`)) return;
    setBulkLoading(true);
    const res = await fetch(`/api/projects/${projectId}/submittals/bulk-actions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, submittal_ids: selectedIds, payload: payload ?? {} }),
    });
    setBulkLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "Bulk action failed");
      return;
    }
    const selectedSet = new Set(selectedIds);
    if (action === "delete" || action === "retrieve") {
      setSubmittals((prev) => prev.filter((s) => !selectedSet.has(s.id)));
    } else {
      setSubmittals((prev) =>
        prev.map((s) =>
          selectedSet.has(s.id)
            ? {
                ...s,
                private: action === "mark_private" ? true : action === "mark_public" ? false : s.private,
                distributed_at: action === "redistribute" ? new Date().toISOString() : s.distributed_at,
              }
            : s
        )
      );
    }
    setSelectedIds([]);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-6 h-14 flex items-center justify-between">
        <a href="/dashboard" className="text-sm font-semibold text-gray-900 hover:text-gray-600 transition-colors">SiteCommand</a>
        <div className="flex items-center gap-5">
          <span className="text-sm text-gray-400">{username}</span>
          <button onClick={handleLogout} className="text-sm text-gray-400 hover:text-gray-900 transition-colors">Logout</button>
        </div>
      </header>

      <ProjectNav projectId={projectId} />

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-end justify-between mb-6 gap-4 flex-wrap">
          <div>
            <h1 className="font-display text-[28px] leading-tight text-[color:var(--ink)]">Submittals</h1>
            <div className="mt-3 inline-flex rounded-md border hairline overflow-hidden bg-white">
              <button onClick={() => { setActiveTab("items"); setSelectedIds([]); }} className={`px-3 py-1.5 text-xs font-semibold transition-colors ${activeTab === "items" ? "bg-[color:var(--ink)] text-white" : "bg-white text-gray-700 hover:bg-gray-50"}`}>Items</button>
              <button onClick={() => { setActiveTab("packages"); setSelectedIds([]); }} className={`px-3 py-1.5 text-xs font-semibold transition-colors ${activeTab === "packages" ? "bg-[color:var(--ink)] text-white" : "bg-white text-gray-700 hover:bg-gray-50"}`}>Packages</button>
              <button onClick={() => { setActiveTab("spec_sections"); setSelectedIds([]); }} className={`px-3 py-1.5 text-xs font-semibold transition-colors ${activeTab === "spec_sections" ? "bg-[color:var(--ink)] text-white" : "bg-white text-gray-700 hover:bg-gray-50"}`}>Spec Sections</button>
              <button onClick={() => { setActiveTab("recycle_bin"); setSelectedIds([]); }} className={`px-3 py-1.5 text-xs font-semibold transition-colors ${activeTab === "recycle_bin" ? "bg-[color:var(--ink)] text-white" : "bg-white text-gray-700 hover:bg-gray-50"}`}>Recycle Bin</button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {selectedIds.length > 0 && activeTab !== "packages" && (
              <>
                <span className="mono-label mr-1">{selectedIds.length} SELECTED</span>
                <button onClick={() => runBulkAction("mark_private")} disabled={bulkLoading} className="px-2.5 py-1.5 text-xs font-medium text-gray-700 border border-gray-200 rounded-md bg-white hover:bg-gray-50 disabled:opacity-50">Mark Private</button>
                <button onClick={() => runBulkAction("mark_public")} disabled={bulkLoading} className="px-2.5 py-1.5 text-xs font-medium text-gray-700 border border-gray-200 rounded-md bg-white hover:bg-gray-50 disabled:opacity-50">Mark Public</button>
                <button onClick={() => runBulkAction("redistribute")} disabled={bulkLoading} className="px-2.5 py-1.5 text-xs font-medium text-gray-700 border border-gray-200 rounded-md bg-white hover:bg-gray-50 disabled:opacity-50">Redistribute</button>
                <button onClick={() => runBulkAction("delete")} disabled={bulkLoading || activeTab === "recycle_bin"} className="px-2.5 py-1.5 text-xs font-medium text-red-700 border border-red-200 rounded-md bg-white hover:bg-red-50 disabled:opacity-50">Delete</button>
                <button onClick={() => runBulkAction("retrieve")} disabled={bulkLoading || activeTab !== "recycle_bin"} className="px-2.5 py-1.5 text-xs font-medium text-gray-700 border border-gray-200 rounded-md bg-white hover:bg-gray-50 disabled:opacity-50">Retrieve</button>
                <button onClick={() => { const personId = prompt("First workflow step person/contact ID:"); if (!personId) return; runBulkAction("apply_workflow", { workflow_steps: [{ step: 1, person_id: personId.trim(), role: "Approver", due_date: null }] }); }} disabled={bulkLoading || activeTab === "recycle_bin"} className="px-2.5 py-1.5 text-xs font-medium text-gray-700 border border-gray-200 rounded-md bg-white hover:bg-gray-50 disabled:opacity-50">Apply Workflow</button>
                <button onClick={() => { const managerId = prompt("Bulk edit Submittal Manager contact ID (blank to cancel):"); if (!managerId) return; runBulkAction("edit", { submittal_manager_id: managerId.trim() }); }} disabled={bulkLoading || activeTab === "recycle_bin"} className="px-2.5 py-1.5 text-xs font-medium text-gray-700 border border-gray-200 rounded-md bg-white hover:bg-gray-50 disabled:opacity-50">Bulk Edit</button>
              </>
            )}
            <button onClick={() => exportSubmittalsPDF(submittals, directory, specifications)} disabled={activeTab === "packages"} className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-md bg-white hover:bg-gray-50 transition-colors disabled:opacity-50">
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              Export as PDF
            </button>
            {!isExternalViewer && (
            <div className="relative" ref={createMenuRef}>
              <button
                type="button"
                onClick={() => setShowCreateMenu((o) => !o)}
                disabled={creating || activeTab === "recycle_bin" || activeTab === "packages" || activeTab === "spec_sections"}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-[color:var(--ink)] rounded-md hover:bg-black transition-colors disabled:opacity-50"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                {activeTab !== "items" ? "Create disabled" : creating ? "Creating..." : "New submittal"}
                <svg className={`w-3.5 h-3.5 transition-transform ${showCreateMenu ? "rotate-180" : ""}`} fill="none" viewBox="0 0 20 20" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 8l4 4 4-4" /></svg>
              </button>
              {showCreateMenu && (
                <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-gray-200 rounded-md shadow-lg z-20 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => { setShowCreate(true); setShowCreateMenu(false); }}
                    className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Create Submittal
                  </button>
                  <a
                    href={`/projects/${projectId}/submittal-packages/new`}
                    onClick={() => setShowCreateMenu(false)}
                    className="block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Submittal Package
                  </a>
                  <a
                    href={`/projects/${projectId}/submittals?createFromSpecs=1`}
                    onClick={() => setShowCreateMenu(false)}
                    className="block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Submittals from Specifications
                  </a>
                </div>
              )}
            </div>
            )}
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-gray-400">Loading...</p>
        ) : activeTab === "packages" ? (
          packages.length === 0 ? (
            <div className="bg-white border border-dashed border-gray-200 rounded-xl py-16 text-center">
              <p className="font-display text-xl text-[color:var(--ink)] mb-1">No submittal packages yet</p>
              <p className="text-xs text-gray-400 mt-1">Click New submittal and choose Submittal Package</p>
            </div>
          ) : (
            <div className="bg-white border hairline rounded-xl overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead>
                  <tr className="border-b hairline bg-[color:var(--surface-sunken)]">
                    <th className="text-left px-4 py-3 mono-label whitespace-nowrap">PACKAGE #</th>
                    <th className="text-left px-4 py-3 mono-label whitespace-nowrap">TITLE</th>
                    <th className="text-left px-4 py-3 mono-label whitespace-nowrap">SPEC SECTION</th>
                    <th className="text-left px-4 py-3 mono-label whitespace-nowrap">SUBMITTALS</th>
                    <th className="text-left px-4 py-3 mono-label whitespace-nowrap">DISTRIBUTED</th>
                    <th className="text-left px-4 py-3 mono-label whitespace-nowrap">CREATED</th>
                  </tr>
                </thead>
                <tbody>
                  {packages.map((pkg) => (
                    <tr key={pkg.id} className="border-b border-gray-50 hover:bg-[color:var(--surface-sunken)] cursor-pointer" onClick={() => { window.location.href = `/projects/${projectId}/submittal-packages/${pkg.id}`; }}>
                      <td className="px-4 py-3 text-sm font-mono text-[color:var(--ink)] tabular-nums">#{pkg.package_number}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 font-medium">{pkg.title}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{getSpecName(specifications, pkg.specification_id)}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 tabular-nums">{pkg.submittal_count}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 tabular-nums">{pkg.distributed_count}/{pkg.submittal_count}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 tabular-nums">{new Date(pkg.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : activeTab === "spec_sections" ? (
          specSectionRows.length === 0 ? (
            <div className="bg-white border border-dashed border-gray-200 rounded-xl py-16 text-center">
              <p className="font-display text-xl text-[color:var(--ink)] mb-1">No specification sections yet</p>
            </div>
          ) : (
            <div className="bg-white border hairline rounded-xl overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <thead>
                  <tr className="border-b hairline bg-[color:var(--surface-sunken)]">
                    <th className="text-left px-4 py-3 mono-label whitespace-nowrap">SPEC SECTION</th>
                    <th className="text-left px-4 py-3 mono-label whitespace-nowrap">TOTAL SUBMITTALS</th>
                    <th className="text-left px-4 py-3 mono-label whitespace-nowrap">OPEN</th>
                    <th className="text-left px-4 py-3 mono-label whitespace-nowrap">CLOSED</th>
                  </tr>
                </thead>
                <tbody>
                  {specSectionRows.map((row) => (
                    <tr key={row.key} className="border-b border-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900 font-medium">{row.name}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 tabular-nums">{row.total}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 tabular-nums">{row.open}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 tabular-nums">{row.closed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : submittals.length === 0 ? (
          <div className="bg-white border border-dashed border-gray-200 rounded-xl py-16 text-center">
            <p className="font-display text-xl text-[color:var(--ink)] mb-1">No submittals yet</p>
            <p className="text-xs text-gray-400 mt-1">Click New submittal to add the first one</p>
          </div>
        ) : (
          <div className="bg-white border hairline rounded-xl overflow-x-auto">
            <table className="w-full min-w-[2200px]">
              <thead>
                <tr className="border-b hairline bg-[color:var(--surface-sunken)]">
                  <th className="text-left px-4 py-3 mono-label w-10">
                    <input
                      type="checkbox"
                      checked={submittals.length > 0 && selectedIds.length === submittals.length}
                      onChange={(e) => setSelectedIds(e.target.checked ? submittals.map((s) => s.id) : [])}
                    />
                  </th>
                  <th className="text-left px-4 py-3 mono-label whitespace-nowrap">#</th>
                  <th className="text-left px-4 py-3 mono-label whitespace-nowrap">REV.</th>
                  <th className="text-left px-4 py-3 mono-label whitespace-nowrap">TITLE</th>
                  <th className="text-left px-4 py-3 mono-label whitespace-nowrap">TYPE</th>
                  <th className="text-left px-4 py-3 mono-label whitespace-nowrap">STATUS</th>
                  <th className="text-left px-4 py-3 mono-label whitespace-nowrap">RESPONSIBLE CONTRACTOR</th>
                  <th className="text-left px-4 py-3 mono-label whitespace-nowrap">SUBMIT BY</th>
                  <th className="text-left px-4 py-3 mono-label whitespace-nowrap">RECEIVED FROM</th>
                  <th className="text-left px-4 py-3 mono-label whitespace-nowrap">RECEIVED DATE</th>
                  <th className="text-left px-4 py-3 mono-label whitespace-nowrap">BALL IN COURT</th>
                  <th className="text-left px-4 py-3 mono-label whitespace-nowrap">APPROVERS</th>
                  <th className="text-left px-4 py-3 mono-label whitespace-nowrap">RESPONSE</th>
                  <th className="text-left px-4 py-3 mono-label whitespace-nowrap">SENT DATE</th>
                  <th className="text-left px-4 py-3 mono-label whitespace-nowrap">RETURNED DATE</th>
                  <th className="text-left px-4 py-3 mono-label whitespace-nowrap">FINAL DUE DATE</th>
                  <th className="text-left px-4 py-3 mono-label whitespace-nowrap">DISTRIBUTED DATE</th>
                  <th className="text-left px-4 py-3 mono-label whitespace-nowrap">LOCATION</th>
                  <th className="text-left px-4 py-3 mono-label whitespace-nowrap">CREATED AT</th>
                  <th className="text-left px-4 py-3 mono-label whitespace-nowrap">SCHEDULE TASK</th>
                </tr>
              </thead>
              <tbody>
                {submittals.map((s) => {
                  const latestResponse = latestWorkflowResponse(s.workflow_steps);
                  return (
                  <tr
                    key={s.id}
                    onClick={(e) => { if ((e.target as HTMLElement).closest("button,a")) return; window.location.href = `/projects/${projectId}/submittals/${s.id}`; }}
                    className="border-b border-gray-50 hover:bg-[color:var(--surface-sunken)] transition-colors last:border-b-0 cursor-pointer"
                  >
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(s.id)}
                        onChange={(e) =>
                          setSelectedIds((prev) =>
                            e.target.checked ? [...prev, s.id] : prev.filter((id) => id !== s.id)
                          )
                        }
                        className="mr-2"
                      />
                      <a href={`/projects/${projectId}/submittals/${s.id}`} className="inline-flex p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                      </a>
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-[color:var(--ink)] tabular-nums">#{s.submittal_number}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 tabular-nums">{s.revision ?? "—"}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 font-medium">{s.title}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{s.submittal_type ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`pill ${STATUS_PILL[s.status] ?? "pill-post"}`}>
                        {STATUS_LABELS[s.status] ?? s.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{getContactNameById(directory, s.responsible_contractor_id)}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap tabular-nums">{formatDate(s.submit_by)}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{getContactNameById(directory, s.received_from_id)}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap tabular-nums">{formatDate(s.received_date)}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{getContactNameById(directory, s.ball_in_court_id)}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{summarizeApprovers(directory, s.workflow_steps)}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{latestResponse?.response ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap tabular-nums">{formatDate(latestResponse?.sent_date ?? null)}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap tabular-nums">{formatDate(latestResponse?.returned_date ?? null)}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap tabular-nums">{formatDate(s.final_due_date)}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap tabular-nums">{formatDate(s.distributed_at ? s.distributed_at.slice(0, 10) : null)}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{s.location ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap tabular-nums">{new Date(s.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{s.schedule_task ?? "—"}</td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {showCreate && (
        <CreateSubmittalModal
          projectId={projectId}
          nextNumber={nextNumber}
          directory={directory}
          specifications={specifications}
          packages={packages}
          initialSpecificationId={prefilledSpecificationId}
          onConfirm={handleCreate}
          onCancel={() => { setShowCreate(false); setPrefilledSpecificationId(null); }}
          onSpecCreated={(spec) => setSpecifications((prev) => [...prev, spec].sort((a, b) => safeLocaleCompare(a.name, b.name)))}
        />
      )}

      {showProceedToSpecificationsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-[640px] rounded bg-white shadow-2xl">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <h2 className="text-[30px] font-semibold leading-none text-gray-900">Proceed to Specifications?</h2>
              <button
                type="button"
                onClick={() => setShowProceedToSpecificationsModal(false)}
                className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-6 py-6 text-sm text-gray-600">
              To generate a Submittal Registry, you will need to select Specifications to generate Submittals from. Would you like to proceed to Specifications?
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setShowProceedToSpecificationsModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleProceedToSpecifications}
                className="px-4 py-2 text-sm font-semibold text-white bg-[color:var(--ink)] rounded-md hover:bg-black transition-colors"
              >
                Proceed to Specifications
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
