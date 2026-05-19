"use client";

import { useState, useEffect, useMemo, useRef, ChangeEvent } from "react";
import ProjectNav from "@/components/ProjectNav";
import EmptyState from "@/app/components/EmptyState";
import { SkeletonTable } from "@/app/components/Skeleton";
import { useSearchParams } from "next/navigation";

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
type BudgetItem = { id: string; cost_code: string; description: string };

const RFI_STAGE_OPTIONS = ["Bidding", "Pre-Construction", "Course of Construction", "Warranty", "Post-Construction"] as const;
const IMPACT_OPTIONS = ["Yes", "Yes (Unknown)", "No", "TBD", "N/A"] as const;
const RFI_STATUS_FILTER_OPTIONS = ["Open", "Draft", "Closed", "Closed - Revised", "Closed - Draft"] as const;

type MemberRow = {
  user_id: string;
  users: { id: string; username: string | null; first_name: string | null; last_name: string | null; company_id: string | null } | null;
};

type RFIFilters = {
  status: string;
  responsibleContractorId: string;
  receivedFromId: string;
  assigneeId: string;
  rfiManagerId: string;
  ballInCourtId: string;
  overdue: boolean;
  location: string;
  costCode: string;
  rfiStage: string;
  createdById: string;
  createdByCompany: string;
};

function emptyRFIFilters(): RFIFilters {
  return {
    status: "",
    responsibleContractorId: "",
    receivedFromId: "",
    assigneeId: "",
    rfiManagerId: "",
    ballInCourtId: "",
    overdue: false,
    location: "",
    costCode: "",
    rfiStage: "",
    createdById: "",
    createdByCompany: "",
  };
}

function activeFilterCount(f: RFIFilters): number {
  let n = 0;
  if (f.status) n++;
  if (f.responsibleContractorId) n++;
  if (f.receivedFromId) n++;
  if (f.assigneeId) n++;
  if (f.rfiManagerId) n++;
  if (f.ballInCourtId) n++;
  if (f.overdue) n++;
  if (f.location) n++;
  if (f.costCode) n++;
  if (f.rfiStage) n++;
  if (f.createdById) n++;
  if (f.createdByCompany) n++;
  return n;
}

type RFI = {
  id: string;
  rfi_number: number;
  subject: string | null;
  question: string | null;
  due_date: string | null;
  status: string;
  rfi_manager_id: string | null;
  received_from_id: string | null;
  assignees: DirContact[];
  distribution_list: DirContact[];
  responsible_contractor_id: string | null;
  specification_id: string | null;
  drawing_number: string | null;
  schedule_impact: string | null;
  cost_impact: string | null;
  cost_code: string | null;
  sub_job: string | null;
  rfi_stage: string | null;
  private: boolean;
  attachments: { name: string; url: string }[];
  ball_in_court_id: string | null;
  official_response_id: string | null;
  created_by: string | null;
  created_at: string;
};

type RFIResponse = {
  id: string;
  body: string;
  created_by_name: string | null;
  created_at: string;
};


const STATUSES = ["open", "closed", "draft"];
const COLUMN_KEYS = [
  "subject",
  "rfi_number",
  "status",
  "responsible_contractor",
  "received_from",
  "date_initiated",
  "rfi_manager",
  "assignees",
  "ball_in_court",
  "due_date",
  "closed_date",
  "location",
  "schedule_impact",
  "cost_impact",
  "cost_code",
  "sub_job",
  "rfi_stage",
  "distribution",
  "private",
] as const;
type ColumnKey = typeof COLUMN_KEYS[number];
const COLUMN_LABELS: Record<typeof COLUMN_KEYS[number], string> = {
  subject: "Subject",
  rfi_number: "Number",
  status: "Status",
  responsible_contractor: "Responsible Contractor",
  received_from: "Received From",
  date_initiated: "Date Initiated",
  rfi_manager: "RFI Manager",
  assignees: "Assignees",
  ball_in_court: "Ball In Court",
  due_date: "Due Date",
  closed_date: "Closed Date",
  location: "Location",
  schedule_impact: "Schedule Impact",
  cost_impact: "Cost Impact",
  cost_code: "Cost Code",
  sub_job: "Sub Job",
  rfi_stage: "RFI Stage",
  distribution: "Distribution List",
  private: "Private",
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
      (contactDisplayName(c).toLowerCase().includes(search.toLowerCase()) || (c.email ?? "").toLowerCase().includes(search.toLowerCase()))
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
        onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
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
      {open && search && filtered.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-100 rounded-md shadow-lg px-3 py-2 z-20"><p className="text-xs text-gray-400">No matching contacts</p></div>
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
  const selected = list.find((c) => c.id === selectedId);
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

function CreateRFIModal({
  nextNumber,
  initiatedAt,
  directory,
  specifications,
  budgetItems,
  onConfirm,
  onCancel,
}: {
  nextNumber: number;
  initiatedAt: string;
  directory: DirectoryContact[];
  specifications: Specification[];
  budgetItems: BudgetItem[];
  onConfirm: (data: {
    rfi_number: number;
    subject: string;
    question: string;
    due_date: string;
    status: "open" | "draft";
    rfi_manager_id: string | null;
    received_from_id: string | null;
    assignees: DirContact[];
    distribution_list: DirContact[];
    responsible_contractor_id: string | null;
    specification_id: string | null;
    drawing_number: string;
    schedule_impact: string;
    cost_impact: string;
    cost_code: string;
    sub_job: string;
    rfi_stage: string;
    private: boolean;
    attachmentFiles: File[];
  }) => void;
  onCancel: () => void;
}) {
  const [rfiNumber, setRfiNumber] = useState<number>(nextNumber);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [question, setQuestion] = useState("");
  const [dueDate, setDueDate] = useState(() => {
    const baseline = new Date(initiatedAt);
    if (Number.isNaN(baseline.getTime())) return "";
    baseline.setDate(baseline.getDate() + 14);
    return baseline.toISOString().split("T")[0];
  });
  const [status, setStatus] = useState("open");
  const [rfiManagerId, setRfiManagerId] = useState<string | null>(null);
  const [receivedFromId, setReceivedFromId] = useState<string | null>(null);
  const [assignees, setAssignees] = useState<DirContact[]>([]);
  const [distributionList, setDistributionList] = useState<DirContact[]>([]);
  const [responsibleContractorId, setResponsibleContractorId] = useState<string | null>(null);
  const [specificationId, setSpecificationId] = useState<string | null>(null);
  const [drawingNumber, setDrawingNumber] = useState("");
  const [scheduleImpact, setScheduleImpact] = useState("");
  const [costImpact, setCostImpact] = useState("");
  const [costCode, setCostCode] = useState("");
  const [rfiStage, setRfiStage] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function addFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const incoming = Array.from(files);
    setAttachmentFiles((prev) => {
      const key = (f: File) => `${f.name}__${f.size}__${f.lastModified}`;
      const existing = new Set(prev.map(key));
      return [...prev, ...incoming.filter((f) => !existing.has(key(f)))];
    });
  }
  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    addFiles(e.target.files);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }
  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    addFiles(e.dataTransfer.files);
  }
  function removeFile(index: number) {
    setAttachmentFiles((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4 py-6 overflow-y-auto">
      <div className="bg-white rounded-xl w-full max-w-2xl shadow-xl my-auto max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white">
          <h2 className="text-sm font-semibold text-gray-900">Create RFI</h2>
          <button type="button" onClick={onCancel} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">RFI Number</label>
              <input
                type="number"
                min={1}
                value={rfiNumber}
                onChange={(e) => setRfiNumber(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Date Initiated</label>
              <input
                type="text"
                readOnly
                value={formatDateTime(initiatedAt)}
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm bg-gray-50 text-gray-500 cursor-not-allowed"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Due Date</label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white" />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Subject <span className="text-red-500">*</span> (max 200 characters)</label>
            <input type="text" maxLength={200} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
            <p className="text-xs text-gray-400 mt-0.5">{subject.length}/200</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Question <span className="text-red-500">*</span></label>
            <textarea value={question} onChange={(e) => setQuestion(e.target.value)} rows={4} placeholder="Question..." className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none" />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Attachments</label>
            <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileChange} />
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${dragOver ? "border-gray-400 bg-gray-50" : "border-gray-200 hover:border-gray-300"} ${attachmentFiles.length > 0 ? "bg-gray-50" : ""}`}
            >
              <p className="text-sm text-gray-500">Drag and drop files or click to attach</p>
            </div>
            {attachmentFiles.length > 0 && (
              <ul className="mt-2 space-y-1">
                {attachmentFiles.map((f, i) => (
                  <li key={`${f.name}-${f.lastModified}-${i}`} className="flex items-center justify-between gap-2 px-3 py-1.5 bg-gray-50 border border-gray-100 rounded-md">
                    <span className="text-sm text-gray-700 truncate">{f.name}</span>
                    <button type="button" onClick={() => removeFile(i)} className="text-gray-400 hover:text-gray-700 flex-shrink-0" aria-label={`Remove ${f.name}`}>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white">
                <option value="open">Open</option>
                <option value="closed">Closed</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">RFI Manager</label>
              <SingleContactPicker directory={directory} selectedId={rfiManagerId} onChange={setRfiManagerId} filterType="user" placeholder="Select user..." />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Received From</label>
            <SingleContactPicker directory={directory} selectedId={receivedFromId} onChange={setReceivedFromId} filterType="user" placeholder="Select user..." />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Assignees <span className="text-red-500">*</span></label>
            <MultiContactPicker directory={directory} selected={assignees} onChange={setAssignees} filterType="user" placeholder="Select users..." />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Distribution List</label>
            <MultiContactPicker directory={directory} selected={distributionList} onChange={setDistributionList} filterType="user" placeholder="Select users..." />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Responsible Contractor</label>
            <SingleContactPicker directory={directory} selectedId={responsibleContractorId} onChange={setResponsibleContractorId} filterType="company" placeholder="Select company..." />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Specification</label>
              <select value={specificationId ?? ""} onChange={(e) => setSpecificationId(e.target.value || null)} className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white">
                <option value="">Select specification...</option>
                {specifications.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}{s.code ? ` (${s.code})` : ""}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Drawing Number</label>
              <input type="text" value={drawingNumber} onChange={(e) => setDrawingNumber(e.target.value)} placeholder="Drawing number" className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Schedule Impact</label>
              <select value={scheduleImpact} onChange={(e) => setScheduleImpact(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white">
                <option value="">Select...</option>
                {IMPACT_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Cost Impact</label>
              <select value={costImpact} onChange={(e) => setCostImpact(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white">
                <option value="">Select...</option>
                {IMPACT_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Cost Code</label>
            <select value={costCode} onChange={(e) => setCostCode(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white">
              <option value="">Select cost code...</option>
              {budgetItems.map((b) => (
                <option key={b.id} value={b.cost_code}>{b.cost_code}{b.description ? ` — ${b.description}` : ""}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4 items-end">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">RFI Stage</label>
              <select value={rfiStage} onChange={(e) => setRfiStage(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white">
                <option value="">Select stage...</option>
                {RFI_STAGE_OPTIONS.map((stage) => (
                  <option key={stage} value={stage}>{stage}</option>
                ))}
              </select>
            </div>
            <label className="inline-flex items-center gap-2 pb-2">
              <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} className="rounded border-gray-300 text-gray-900" />
              <span className="text-sm text-gray-700">Mark as private</span>
            </label>
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t border-gray-100">
            {validationError && <p className="text-sm text-red-600 flex-1 self-center">{validationError}</p>}
            <button type="button" onClick={onCancel} className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors">Cancel</button>
            <button type="button" onClick={() => onConfirm({ rfi_number: rfiNumber, subject, question, due_date: dueDate, status: "draft", rfi_manager_id: rfiManagerId, received_from_id: receivedFromId, assignees, distribution_list: distributionList, responsible_contractor_id: responsibleContractorId, specification_id: specificationId, drawing_number: drawingNumber, schedule_impact: scheduleImpact, cost_impact: costImpact, cost_code: costCode, sub_job: "", rfi_stage: rfiStage, private: isPrivate, attachmentFiles })} className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors">Create as Draft</button>
            <button
              type="button"
              onClick={() => {
                if (!subject.trim()) { setValidationError("Subject is required."); return; }
                if (!question.trim()) { setValidationError("Question is required."); return; }
                if (assignees.length === 0) { setValidationError("At least one assignee is required."); return; }
                setValidationError(null);
                onConfirm({ rfi_number: rfiNumber, subject, question, due_date: dueDate, status: "open", rfi_manager_id: rfiManagerId, received_from_id: receivedFromId, assignees, distribution_list: distributionList, responsible_contractor_id: responsibleContractorId, specification_id: specificationId, drawing_number: drawingNumber, schedule_impact: scheduleImpact, cost_impact: costImpact, cost_code: costCode, sub_job: "", rfi_stage: rfiStage, private: isPrivate, attachmentFiles });
              }}
              className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-md hover:bg-gray-700 transition-colors"
            >
              Create as Open
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function getContactNameById(directory: DirectoryContact[], id: string | null): string {
  if (!id) return "—";
  const c = directory.find((x) => x.id === id);
  return c ? contactDisplayName(c) : "—";
}

function formatDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatDateTime(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

const RFI_STATUS_PILL: Record<string, string> = {
  open: "pill-open",
  closed: "pill-post",
  draft: "pill-warn",
};

function RFIStatusPill({ status }: { status: string }) {
  const cls = RFI_STATUS_PILL[status] ?? "pill-post";
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  return <span className={`pill ${cls}`}>{label}</span>;
}

async function exportRFIsPDF(
  projectId: string,
  rfis: RFI[],
  directory: DirectoryContact[],
  specifications: Specification[],
  visibleColumns: readonly string[],
  responseFilter: "all" | "official-only" = "all"
) {
  const { default: jsPDF } = await import("jspdf");

  const responseEntries = await Promise.all(
    rfis.map(async (rfi) => {
      try {
        const res = await fetch(`/api/projects/${projectId}/rfis/${rfi.id}/responses`);
        if (!res.ok) return [rfi.id, []] as const;
        const data = await res.json();
        return [rfi.id, Array.isArray(data) ? (data as RFIResponse[]) : []] as const;
      } catch {
        return [rfi.id, []] as const;
      }
    })
  );

  const responsesByRfi = new Map<string, RFIResponse[]>(responseEntries);
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });
  const margin = 40;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const lineHeight = 13;
  let y = margin;

  const ensureSpace = (minBottomSpace = 30) => {
    if (y > pageHeight - minBottomSpace) {
      doc.addPage();
      y = margin;
    }
  };

  const writeWrapped = (text: string, indent = 0) => {
    const lines = doc.splitTextToSize(text, pageWidth - margin * 2 - indent);
    lines.forEach((line: string) => {
      ensureSpace();
      doc.text(line, margin + indent, y);
      y += lineHeight;
    });
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("RFI Export", margin, y);
  y += 24;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Generated ${new Date().toLocaleString("en-US")}`, margin, y);
  doc.setTextColor(0);
  y += 24;

  for (const rfi of rfis) {
    ensureSpace(120);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(`RFI #${rfi.rfi_number} — ${rfi.subject ?? "Untitled"}`, margin, y);
    y += 18;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    visibleColumns.forEach((key) => {
      let value = "—";
      switch (key) {
        case "rfi_number": value = String(rfi.rfi_number); break;
        case "subject": value = rfi.subject ?? "—"; break;
        case "due_date": value = formatDate(rfi.due_date); break;
        case "status": value = rfi.status; break;
        case "rfi_manager": value = getContactNameById(directory, rfi.rfi_manager_id); break;
        case "received_from": value = getContactNameById(directory, rfi.received_from_id); break;
        case "assignees": value = (rfi.assignees ?? []).map((a) => a.name).join(", ") || "—"; break;
        case "ball_in_court": value = getContactNameById(directory, rfi.ball_in_court_id); break;
        case "distribution": value = (rfi.distribution_list ?? []).map((d) => d.name).join(", ") || "—"; break;
        case "responsible_contractor": value = getContactNameById(directory, rfi.responsible_contractor_id); break;
        case "date_initiated": value = formatDateTime(rfi.created_at); break;
      }
      const label = COLUMN_LABELS[key as typeof COLUMN_KEYS[number]] ?? key;
      writeWrapped(`${label}: ${value}`);
    });

    writeWrapped(`Question: ${rfi.question ?? "—"}`);
    y += 6;

    const responses = responsesByRfi.get(rfi.id) ?? [];
    doc.setFont("helvetica", "bold");
    writeWrapped("Responses:");
    doc.setFont("helvetica", "normal");

    const exportedResponses =
      responseFilter === "official-only"
        ? responses.filter((response) => response.id === rfi.official_response_id)
        : responses;

    if (exportedResponses.length === 0) {
      writeWrapped("No responses.", 10);
    } else {
      exportedResponses.forEach((response, idx) => {
        const officialTag = response.id === rfi.official_response_id ? " (Official)" : "";
        writeWrapped(`${idx + 1}. ${response.created_by_name ?? "Unknown"} — ${formatDateTime(response.created_at)}${officialTag}`, 10);
        writeWrapped(response.body || "—", 20);
        y += 4;
      });
    }

    y += 12;
    ensureSpace(40);
    doc.setDrawColor(230, 230, 230);
    doc.line(margin, y, pageWidth - margin, y);
    y += 16;
  }

  doc.save("rfi_export.pdf");
}

type ToolLevel = "none" | "read_only" | "standard" | "admin";

export default function RFIsClient({ projectId, role, username, userId, toolLevel }: { projectId: string; role: string; username: string; userId: string; toolLevel: ToolLevel }) {
  const isAdmin = toolLevel === "admin";
  const searchParams = useSearchParams();
  const [rfis, setRfis] = useState<RFI[]>([]);
  const [directory, setDirectory] = useState<DirectoryContact[]>([]);
  const [specifications, setSpecifications] = useState<Specification[]>([]);
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<RFIFilters>(emptyRFIFilters());
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [createInitiatedAt, setCreateInitiatedAt] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showColumnConfig, setShowColumnConfig] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [columnOrder, setColumnOrder] = useState<ColumnKey[]>(() => [...COLUMN_KEYS]);
  const [draggedColumn, setDraggedColumn] = useState<ColumnKey | null>(null);
  const [visibleColumns, setVisibleColumns] = useState<ColumnKey[]>(() => [...COLUMN_KEYS]);
  const [selectedRfiIds, setSelectedRfiIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<"items" | "recycle_bin">("items");
  const [bulkStatus, setBulkStatus] = useState<"" | "draft" | "open" | "closed">("");
  const [bulkDueDate, setBulkDueDate] = useState("");
  const [applyingBulk, setApplyingBulk] = useState(false);
  const [rowMenuOpen, setRowMenuOpen] = useState<string | null>(null);
  const rowMenuRef = useRef<HTMLDivElement | null>(null);
  const exportRef = useRef<HTMLDivElement>(null);
  const columnRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setShowExportMenu(false);
      if (columnRef.current && !columnRef.current.contains(e.target as Node)) setShowColumnConfig(false);
      if (rowMenuRef.current && !rowMenuRef.current.contains(e.target as Node)) setRowMenuOpen(null);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/projects/${projectId}/rfis${activeTab === "recycle_bin" ? "?recycle_bin=true" : ""}`).then((r) => r.json()),
      fetch(`/api/projects/${projectId}/directory`).then((r) => r.json()),
      fetch(`/api/projects/${projectId}/specifications`).then((r) => r.json()),
      fetch(`/api/projects/${projectId}/budget`).then((r) => r.json()),
      fetch(`/api/projects/${projectId}/members`).then((r) => (r.ok ? r.json() : [])),
    ]).then(([rfisData, dirData, specData, budgetData, membersData]) => {
      setRfis(Array.isArray(rfisData) ? rfisData : []);
      setDirectory(Array.isArray(dirData) ? dirData : []);
      setSpecifications(Array.isArray(specData) ? specData : []);
      setBudgetItems(Array.isArray(budgetData) ? budgetData : []);
      setMembers(Array.isArray(membersData) ? membersData : []);
      setLoading(false);
    });
  }, [projectId, activeTab]);

  useEffect(() => {
    if (searchParams.get("create") === "1") {
      setCreateInitiatedAt(new Date().toISOString());
      setShowCreate(true);
    }
  }, [searchParams]);

  const validRfiNums = rfis.map((r) => Number(r.rfi_number)).filter(Number.isFinite);
  const nextNumber = validRfiNums.length > 0 ? Math.max(...validRfiNums) + 1 : 1;

  async function handleCreate(data: {
    rfi_number: number;
    subject: string;
    question: string;
    due_date: string;
    status: "open" | "draft";
    rfi_manager_id: string | null;
    received_from_id: string | null;
    assignees: DirContact[];
    distribution_list: DirContact[];
    responsible_contractor_id: string | null;
    specification_id: string | null;
    drawing_number: string;
    schedule_impact: string;
    cost_impact: string;
    cost_code: string;
    sub_job: string;
    rfi_stage: string;
    private: boolean;
    attachmentFiles: File[];
  }) {
    setShowCreate(false);
    setCreating(true);
    setAttachmentError(null);
    const res = await fetch(`/api/projects/${projectId}/rfis`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rfi_number: data.rfi_number,
        subject: data.subject.slice(0, 200),
        question: data.question || null,
        due_date: data.due_date || null,
        status: data.status,
        rfi_manager_id: data.rfi_manager_id,
        received_from_id: data.received_from_id,
        assignees: data.assignees,
        distribution_list: data.distribution_list,
        responsible_contractor_id: data.responsible_contractor_id,
        specification_id: data.specification_id,
        drawing_number: data.drawing_number || null,
        schedule_impact: data.schedule_impact || null,
        cost_impact: data.cost_impact || null,
        cost_code: data.cost_code || null,
        sub_job: data.sub_job || null,
        rfi_stage: data.rfi_stage || null,
        private: data.private ?? false,
        attachments: [],
      }),
    });
    if (res.ok) {
      const newRfi: RFI = await res.json();
      const failed: string[] = [];
      for (const file of data.attachmentFiles) {
        const formData = new FormData();
        formData.append("file", file);
        const attRes = await fetch(`/api/projects/${projectId}/rfis/${newRfi.id}/attachment`, { method: "POST", body: formData });
        if (attRes.ok) {
          const updated = await attRes.json();
          newRfi.attachments = updated.attachments ?? newRfi.attachments;
        } else {
          failed.push(file.name);
        }
      }
      if (failed.length > 0) {
        setAttachmentError(`Failed to upload ${failed.length === 1 ? "attachment" : "attachments"}: ${failed.join(", ")}. Please add ${failed.length === 1 ? "it" : "them"} again from the RFI detail page.`);
      }
      setRfis((prev) => [...prev, newRfi]);
      if (data.status === "open") {
        await fetch(`/api/projects/${projectId}/rfis/${newRfi.id}/notify`, { method: "POST" });
      }
    }
    setCreating(false);
  }

  function canEditRfi(_rfi: RFI): boolean {
    return isAdmin;
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }

  const orderedVisibleColumns = columnOrder.filter((key) => visibleColumns.includes(key));

  function toggleColumn(key: ColumnKey) {
    setVisibleColumns((prev) => {
      if (prev.includes(key)) return prev.filter((k) => k !== key);
      return columnOrder.filter((k) => k === key || prev.includes(k));
    });
  }

  function handleColumnDrop(targetKey: ColumnKey) {
    if (!draggedColumn || draggedColumn === targetKey) return;
    setColumnOrder((prev) => {
      const next = [...prev];
      const from = next.indexOf(draggedColumn);
      const to = next.indexOf(targetKey);
      if (from === -1 || to === -1) return prev;
      next.splice(from, 1);
      next.splice(to, 0, draggedColumn);
      return next;
    });
    setDraggedColumn(null);
  }

  function contactOptionsFor(getId: (r: RFI) => string | null) {
    const seen = new Set<string>();
    const options: { id: string; name: string }[] = [];
    rfis.forEach((r) => {
      const id = getId(r);
      if (!id || seen.has(id)) return;
      seen.add(id);
      const c = directory.find((d) => d.id === id);
      options.push({ id, name: c ? contactDisplayName(c) : "Unknown" });
    });
    return options.sort((a, b) => a.name.localeCompare(b.name));
  }

  const responsibleContractorOptions = useMemo(() => contactOptionsFor((r) => r.responsible_contractor_id), [rfis, directory]);
  const receivedFromOptions = useMemo(() => contactOptionsFor((r) => r.received_from_id), [rfis, directory]);
  const rfiManagerOptions = useMemo(() => contactOptionsFor((r) => r.rfi_manager_id), [rfis, directory]);
  const ballInCourtOptions = useMemo(() => contactOptionsFor((r) => r.ball_in_court_id), [rfis, directory]);

  const assigneeOptions = useMemo(() => {
    const map = new Map<string, string>();
    rfis.forEach((r) => (r.assignees ?? []).forEach((a) => { if (a.id && !map.has(a.id)) map.set(a.id, a.name || "Unknown"); }));
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [rfis]);

  const locationOptions = useMemo(() => {
    const set = new Set<string>();
    rfis.forEach((r) => {
      const loc = (r as RFI & { location?: string | null }).location;
      if (loc) set.add(loc);
    });
    return Array.from(set).sort();
  }, [rfis]);

  const costCodeOptions = useMemo(() => {
    const set = new Set<string>();
    rfis.forEach((r) => { if (r.cost_code) set.add(r.cost_code); });
    return Array.from(set).sort();
  }, [rfis]);

  const rfiStageOptions = useMemo(() => {
    const set = new Set<string>();
    rfis.forEach((r) => { if (r.rfi_stage) set.add(r.rfi_stage); });
    return Array.from(set).sort();
  }, [rfis]);

  const createdByOptions = useMemo(() => {
    const seen = new Set<string>();
    const out: { id: string; name: string }[] = [];
    rfis.forEach((r) => {
      if (!r.created_by || seen.has(r.created_by)) return;
      seen.add(r.created_by);
      const member = members.find((m) => m.user_id === r.created_by);
      const u = member?.users;
      const name = u ? ([u.first_name, u.last_name].filter(Boolean).join(" ").trim() || u.username || "Unknown") : "Unknown";
      out.push({ id: r.created_by, name });
    });
    return out.sort((a, b) => a.name.localeCompare(b.name));
  }, [rfis, members]);

  const createdByCompanyOptions = useMemo(() => {
    const set = new Set<string>();
    rfis.forEach((r) => {
      const company = (r as RFI & { created_by_company?: string | null }).created_by_company;
      if (company) set.add(company);
    });
    return Array.from(set).sort();
  }, [rfis]);

  const todayStr = new Date().toISOString().split("T")[0];
  const filteredRfis = useMemo(() => {
    return rfis.filter((r) => {
      if (filters.status && r.status.toLowerCase() !== filters.status.toLowerCase()) return false;
      if (filters.responsibleContractorId && r.responsible_contractor_id !== filters.responsibleContractorId) return false;
      if (filters.receivedFromId && r.received_from_id !== filters.receivedFromId) return false;
      if (filters.assigneeId && !(r.assignees ?? []).some((a) => a.id === filters.assigneeId)) return false;
      if (filters.rfiManagerId && r.rfi_manager_id !== filters.rfiManagerId) return false;
      if (filters.ballInCourtId && r.ball_in_court_id !== filters.ballInCourtId) return false;
      if (filters.overdue) {
        if (!r.due_date || r.due_date >= todayStr) return false;
        if (r.status === "closed") return false;
      }
      if (filters.location && (r as RFI & { location?: string | null }).location !== filters.location) return false;
      if (filters.costCode && r.cost_code !== filters.costCode) return false;
      if (filters.rfiStage && r.rfi_stage !== filters.rfiStage) return false;
      if (filters.createdById && r.created_by !== filters.createdById) return false;
      if (filters.createdByCompany && (r as RFI & { created_by_company?: string | null }).created_by_company !== filters.createdByCompany) return false;
      return true;
    });
  }, [rfis, filters, todayStr]);

  const filterCount = activeFilterCount(filters);
  const allSelected = filteredRfis.length > 0 && selectedRfiIds.length === filteredRfis.length;

  async function applyBulkUpdate() {
    if (selectedRfiIds.length === 0) return;
    const updates: Record<string, unknown> = {};
    if (bulkStatus) updates.status = bulkStatus;
    if (bulkDueDate) updates.due_date = bulkDueDate;
    if (Object.keys(updates).length === 0) {
      window.alert("Select a status and/or due date before applying bulk edit.");
      return;
    }

    setApplyingBulk(true);
    const res = await fetch(`/api/projects/${projectId}/rfis/bulk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: selectedRfiIds, updates }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      window.alert(err.error ?? "Bulk update failed");
      setApplyingBulk(false);
      return;
    }

    const updated: RFI[] = await res.json();
    const byId = new Map(updated.map((r) => [r.id, r]));
    setRfis((prev) => prev.map((r) => byId.get(r.id) ?? r));
    setSelectedRfiIds([]);
    setBulkStatus("");
    setBulkDueDate("");
    setApplyingBulk(false);
  }

  async function applyRecycleBinAction(action: "delete" | "retrieve", ids = selectedRfiIds) {
    if (ids.length === 0) return;
    const confirmed = window.confirm(
      action === "delete"
        ? `Send ${ids.length} RFI(s) to Recycling Bin?`
        : `Recover ${ids.length} RFI(s) from Recycling Bin and move back to RFIs?`,
    );
    if (!confirmed) return;

    setApplyingBulk(true);
    const res = await fetch(`/api/projects/${projectId}/rfis/bulk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ids,
        updates: { is_deleted: action === "delete" },
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      window.alert(err.error ?? `Failed to ${action} RFIs.`);
      setApplyingBulk(false);
      return;
    }

    setRfis((prev) => prev.filter((rfi) => !ids.includes(rfi.id)));
    setSelectedRfiIds((prev) => prev.filter((id) => !ids.includes(id)));
    setApplyingBulk(false);
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
        {attachmentError && (
          <div className="mb-4 flex items-start gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            <span className="flex-1">{attachmentError}</span>
            <button onClick={() => setAttachmentError(null)} className="text-red-400 hover:text-red-600 flex-shrink-0">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        )}
        <div className="flex items-end justify-between mb-6 gap-4 flex-wrap">
          <div>
            <h1 className="font-display text-[32px] leading-[1.05] tracking-[-0.012em] text-[color:var(--ink)]">Requests for information</h1>
            {!loading && rfis.length > 0 && (
              <p className="sec-sub mt-1.5">
                <span className="serif-italic text-[color:var(--brand-700)]">Across this project</span>
                <span className="sep">·</span>
                <span className="num" style={{ color: "var(--brand-500)" }}>{rfis.filter((r) => r.status === "open").length}</span> open
                <span className="sep">·</span>
                <span className="num">{rfis.filter((r) => r.status === "closed").length}</span> closed
                <span className="sep">·</span>
                <span className="num">{rfis.length}</span> total
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div ref={exportRef} className="relative">
                <button onClick={() => setShowExportMenu((o) => !o)} className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-md bg-white hover:bg-gray-50 transition-colors">
                {exportingPdf ? "Exporting PDF..." : "Export"}
                <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform ${showExportMenu ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
              </button>
              {showExportMenu && (
                <div className="absolute right-0 mt-2 w-44 bg-white border border-gray-100 rounded-xl shadow-lg py-1 z-20">
                  <button
                    disabled={exportingPdf}
                    onClick={async () => {
                      setShowExportMenu(false);
                      setExportingPdf(true);
                      try {
                        await exportRFIsPDF(projectId, rfis, directory, specifications, orderedVisibleColumns, "all");
                      } finally {
                        setExportingPdf(false);
                      }
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    Export all as PDF
                  </button>
                  <button
                    disabled={exportingPdf}
                    onClick={async () => {
                      setShowExportMenu(false);
                      setExportingPdf(true);
                      try {
                        await exportRFIsPDF(projectId, rfis, directory, specifications, orderedVisibleColumns, "official-only");
                      } finally {
                        setExportingPdf(false);
                      }
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    Export official responses (PDF)
                  </button>
                </div>
              )}
            </div>
            {isAdmin && (
              <button
                onClick={() => {
                  setCreateInitiatedAt(new Date().toISOString());
                  setShowCreate(true);
                }}
                disabled={creating || activeTab === "recycle_bin"}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-[color:var(--ink)] rounded-md hover:bg-black transition-colors disabled:opacity-50"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                {creating ? "Creating..." : "New RFI"}
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 mb-4">
          <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden bg-white">
            <button onClick={() => { setActiveTab("items"); setSelectedRfiIds([]); }} className={`px-3 py-1.5 text-xs font-semibold transition-colors ${activeTab === "items" ? "bg-[color:var(--ink)] text-white" : "bg-white text-gray-700 hover:bg-gray-50"}`}>Items</button>
            <button onClick={() => { setActiveTab("recycle_bin"); setSelectedRfiIds([]); }} className={`px-3 py-1.5 text-xs font-semibold transition-colors ${activeTab === "recycle_bin" ? "bg-[color:var(--ink)] text-white" : "bg-white text-gray-700 hover:bg-gray-50"}`}>Recycling Bin</button>
          </div>
          <button
            type="button"
            onClick={() => setShowFilters(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 border border-blue-200 rounded-lg bg-white hover:bg-blue-50 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M7 12h10M10 18h4" />
            </svg>
            All Filters
            {filterCount > 0 && (
              <span className="ml-1 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 text-[10px] font-bold text-white bg-blue-600 rounded-full">{filterCount}</span>
            )}
          </button>
          {filterCount > 0 && (
            <button
              type="button"
              onClick={() => setFilters(emptyRFIFilters())}
              className="text-xs font-medium text-gray-500 hover:text-gray-700"
            >
              Clear all filters
            </button>
          )}
          <div ref={columnRef} className="relative ml-auto">
            <button onClick={() => setShowColumnConfig((o) => !o)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-700 border border-gray-200 rounded-lg bg-white hover:bg-gray-50 transition-colors">
              Configure
              <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform ${showColumnConfig ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
            </button>
            {showColumnConfig && (
              <div className="absolute right-0 mt-2 w-96 bg-white border border-gray-200 rounded-xl shadow-xl z-20 max-h-[80vh] overflow-y-auto">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white">
                  <h3 className="text-base font-semibold text-gray-900">Table Settings</h3>
                  <button type="button" onClick={() => setShowColumnConfig(false)} className="text-gray-400 hover:text-gray-600">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
                <div className="px-6 pt-4 pb-5">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-gray-900">Configure Columns</h4>
                    <button type="button" onClick={() => setVisibleColumns([...columnOrder])} className="text-sm font-medium text-blue-600 hover:text-blue-700">Show All</button>
                  </div>
                  <div className="space-y-1.5">
                    {columnOrder.map((key) => {
                      const on = visibleColumns.includes(key);
                      return (
                        <button
                          key={key}
                          type="button"
                          draggable
                          onDragStart={() => setDraggedColumn(key)}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() => handleColumnDrop(key)}
                          onDragEnd={() => setDraggedColumn(null)}
                          onClick={() => toggleColumn(key)}
                          role="switch"
                          aria-checked={on}
                          className="w-full flex items-center gap-3 px-3 py-2 bg-gray-50 rounded-md hover:bg-gray-100 transition-colors text-left"
                        >
                          <span className="text-gray-400 cursor-grab" aria-hidden>
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 6h.01M8 12h.01M8 18h.01M16 6h.01M16 12h.01M16 18h.01" /></svg>
                          </span>
                          <span className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors ${on ? "bg-blue-500" : "bg-gray-300"}`}>
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${on ? "translate-x-[18px]" : "translate-x-0.5"}`} />
                          </span>
                          <span className="text-sm text-gray-800">{COLUMN_LABELS[key]}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {isAdmin && selectedRfiIds.length > 0 && (
          <div className="mb-4 bg-white border hairline rounded-lg p-3 flex flex-wrap items-end gap-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <div className="pr-3 border-r hairline">
              <p className="mono-label">SELECTED</p>
              <p className="font-display text-lg leading-none text-[color:var(--ink)] tabular-nums">{selectedRfiIds.length}</p>
            </div>
            <div>
              <label className="block mono-label mb-1">STATUS</label>
              <select value={bulkStatus} onChange={(e) => setBulkStatus((e.target.value as "" | "draft" | "open" | "closed"))} disabled={activeTab === "recycle_bin"} className="px-2.5 py-2 border border-gray-200 rounded text-sm bg-white disabled:opacity-50">
                <option value="">No change</option>
                <option value="draft">Draft</option>
                <option value="open">Open</option>
                <option value="closed">Closed</option>
              </select>
            </div>
            <div>
              <label className="block mono-label mb-1">DUE DATE</label>
              <input type="date" value={bulkDueDate} onChange={(e) => setBulkDueDate(e.target.value)} disabled={activeTab === "recycle_bin"} className="px-2.5 py-2 border border-gray-200 rounded text-sm disabled:opacity-50" />
            </div>
            <button onClick={applyBulkUpdate} disabled={applyingBulk || activeTab === "recycle_bin"} className="px-3 py-2 text-sm font-semibold text-white bg-[color:var(--ink)] rounded hover:bg-black disabled:opacity-50">
              {applyingBulk ? "Applying..." : "Apply bulk edit"}
            </button>
            <button onClick={() => applyRecycleBinAction("delete")} disabled={applyingBulk || activeTab === "recycle_bin"} className="px-3 py-2 text-sm font-medium text-red-700 border border-red-200 rounded bg-white hover:bg-red-50 disabled:opacity-50">
              Send to Recycling Bin
            </button>
            <button onClick={() => applyRecycleBinAction("retrieve")} disabled={applyingBulk || activeTab !== "recycle_bin"} className="px-3 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded bg-white hover:bg-gray-50 disabled:opacity-50">
              Retrieve
            </button>
            <button onClick={() => setSelectedRfiIds([])} className="px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded hover:bg-gray-50">Clear</button>
          </div>
        )}

        {loading ? (
          <SkeletonTable rows={5} cols={6} />
        ) : rfis.length === 0 ? (
          <div className="bg-white border border-dashed border-gray-200 rounded-xl">
            <EmptyState
              icon={
                <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.25}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
              title={activeTab === "recycle_bin" ? "Recycling Bin is empty" : "No RFIs yet"}
              description={activeTab === "recycle_bin" ? "Deleted RFIs will appear here." : "Click Create new RFI to add the first one."}
            />
          </div>
        ) : filteredRfis.length === 0 ? (
          <div className="bg-white border border-dashed border-gray-200 rounded-xl p-10 text-center">
            <p className="text-sm text-gray-600">No RFIs match the current filters.</p>
            <button onClick={() => setFilters(emptyRFIFilters())} className="mt-3 text-sm font-medium text-blue-600 hover:text-blue-700">Clear all filters</button>
          </div>
        ) : (
          <div className="bg-white border hairline rounded-xl overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead>
                <tr className="border-b hairline bg-[color:var(--surface-sunken)]">
                  {isAdmin && (
                    <th className="text-left px-4 py-3 w-12">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={(e) => setSelectedRfiIds(e.target.checked ? filteredRfis.map((r) => r.id) : [])}
                        className="rounded border-gray-300"
                      />
                    </th>
                  )}
                  {orderedVisibleColumns.map((key) => (
                    <th key={key} className="text-left px-4 py-3 mono-label whitespace-nowrap">
                      {COLUMN_LABELS[key].toUpperCase()}
                    </th>
                  ))}
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {filteredRfis.map((rfi) => (
                  <tr
                    key={rfi.id}
                    onClick={(e) => { if ((e.target as HTMLElement).closest("button")) return; window.location.href = `/projects/${projectId}/rfis/${rfi.id}`; }}
                    className="border-b border-gray-50 hover:bg-[color:var(--surface-sunken)] transition-colors last:border-b-0 cursor-pointer"
                  >
                    {isAdmin && (
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={selectedRfiIds.includes(rfi.id)}
                            onChange={(e) => {
                              setSelectedRfiIds((prev) => e.target.checked ? [...prev, rfi.id] : prev.filter((id) => id !== rfi.id));
                            }}
                            className="rounded border-gray-300"
                          />
                          {canEditRfi(rfi) ? (
                            <a href={`/projects/${projectId}/rfis/${rfi.id}/edit`} className="inline-flex p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors" title="Edit">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                            </a>
                          ) : null}
                        </div>
                      </td>
                    )}
                    {orderedVisibleColumns.map((key) => {
                      let cell: React.ReactNode = "—";
                      switch (key) {
                        case "rfi_number": cell = <span className={`idx-italic status-${["open","closed","draft"].includes(rfi.status) ? rfi.status : "draft"}`}>{String(rfi.rfi_number).padStart(3, "0")}</span>; break;
                        case "subject": cell = <span className="text-sm text-gray-900 font-medium">{(rfi.subject ?? "").slice(0, 60)}{(rfi.subject ?? "").length > 60 ? "…" : ""}</span>; break;
                        case "due_date": cell = <span className="text-xs text-gray-500 tabular-nums">{formatDate(rfi.due_date)}</span>; break;
                        case "status": cell = <RFIStatusPill status={rfi.status} />; break;
                        case "rfi_manager": cell = getContactNameById(directory, rfi.rfi_manager_id); break;
                        case "received_from": cell = getContactNameById(directory, rfi.received_from_id); break;
                        case "assignees": cell = (rfi.assignees ?? []).map((a) => a.name).join(", ") || "—"; break;
                        case "ball_in_court": cell = getContactNameById(directory, rfi.ball_in_court_id); break;
                        case "distribution": cell = (rfi.distribution_list ?? []).map((d) => d.name).join(", ") || "—"; break;
                        case "responsible_contractor": cell = getContactNameById(directory, rfi.responsible_contractor_id); break;
                        case "date_initiated": cell = <span className="tabular-nums">{formatDateTime(rfi.created_at)}</span>; break;
                        case "schedule_impact": cell = rfi.schedule_impact || "—"; break;
                        case "cost_impact": cell = rfi.cost_impact || "—"; break;
                        case "cost_code": cell = rfi.cost_code || "—"; break;
                        case "sub_job": cell = rfi.sub_job || "—"; break;
                        case "rfi_stage": cell = rfi.rfi_stage || "—"; break;
                        case "private": cell = rfi.private ? "Yes" : "No"; break;
                      }
                      return <td key={key} className="px-4 py-3 text-sm text-gray-600">{cell}</td>;
                    })}
                    <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                      <div
                        ref={rowMenuOpen === rfi.id ? rowMenuRef : null}
                        className="relative flex justify-end"
                      >
                        <button
                          type="button"
                          onClick={() => setRowMenuOpen(rowMenuOpen === rfi.id ? null : rfi.id)}
                          className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                          aria-label="More options"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" /></svg>
                        </button>
                        {rowMenuOpen === rfi.id && (
                          <div className="absolute right-0 top-full mt-1 w-32 bg-white border border-gray-100 rounded-lg shadow-lg py-1 z-20">
                            {activeTab !== "recycle_bin" && (
                              <a
                                href={`/projects/${projectId}/rfis/${rfi.id}/edit`}
                                className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                Edit
                              </a>
                            )}
                            {isAdmin && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setRowMenuOpen(null);
                                  void applyRecycleBinAction(activeTab === "recycle_bin" ? "retrieve" : "delete", [rfi.id]);
                                }}
                                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d={activeTab === "recycle_bin" ? "M4 7h16M10 11v6m4-6v6M6 7l1 12a2 2 0 002 2h6a2 2 0 002-2l1-12M9 7V4h6v3" : "M6 7l1 12a2 2 0 002 2h6a2 2 0 002-2l1-12M9 7V4h6v3M4 7h16"} /></svg>
                                {activeTab === "recycle_bin" ? "Recover RFI" : "Send to Bin"}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {showCreate && (
        <CreateRFIModal
          nextNumber={nextNumber}
          initiatedAt={createInitiatedAt ?? ""}
          directory={directory}
          specifications={specifications}
          budgetItems={budgetItems}
          onConfirm={handleCreate}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {showFilters && (
        <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowFilters(false)} />
          <aside className="relative h-full w-[340px] max-w-full bg-white shadow-xl flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">Filters</h2>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => setFilters(emptyRFIFilters())}
                  className="text-sm font-medium text-gray-500 hover:text-gray-800"
                >
                  Clear All Filters
                </button>
                <button
                  type="button"
                  onClick={() => setShowFilters(false)}
                  className="text-gray-400 hover:text-gray-700"
                  aria-label="Close filters"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              <FilterSelect label="Status" placeholder="Status" value={filters.status} onChange={(v) => setFilters({ ...filters, status: v })} options={RFI_STATUS_FILTER_OPTIONS.map((o) => ({ value: o, label: o }))} />

              <FilterSelect label="Responsible Contractor" placeholder="Responsible Contractor" value={filters.responsibleContractorId} onChange={(v) => setFilters({ ...filters, responsibleContractorId: v })} options={responsibleContractorOptions.map((o) => ({ value: o.id, label: o.name }))} />

              <FilterSelect label="Received From" placeholder="Received From" value={filters.receivedFromId} onChange={(v) => setFilters({ ...filters, receivedFromId: v })} options={receivedFromOptions.map((o) => ({ value: o.id, label: o.name }))} />

              <FilterSelect label="Assignees" placeholder="Assignees" value={filters.assigneeId} onChange={(v) => setFilters({ ...filters, assigneeId: v })} options={assigneeOptions.map((o) => ({ value: o.id, label: o.name }))} />

              <FilterSelect label="RFI Manager" placeholder="RFI Manager" value={filters.rfiManagerId} onChange={(v) => setFilters({ ...filters, rfiManagerId: v })} options={rfiManagerOptions.map((o) => ({ value: o.id, label: o.name }))} />

              <FilterSelect label="Ball In Court" placeholder="Ball In Court" value={filters.ballInCourtId} onChange={(v) => setFilters({ ...filters, ballInCourtId: v })} options={ballInCourtOptions.map((o) => ({ value: o.id, label: o.name }))} />

              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={filters.overdue} onChange={(e) => setFilters({ ...filters, overdue: e.target.checked })} className="rounded border-gray-300" />
                <span className="text-sm text-gray-700">Overdue</span>
              </label>

              <FilterSelect label="Location" placeholder="Locations" value={filters.location} onChange={(v) => setFilters({ ...filters, location: v })} options={locationOptions.map((o) => ({ value: o, label: o }))} />

              <FilterSelect label="Cost Code" placeholder="Cost Code" value={filters.costCode} onChange={(v) => setFilters({ ...filters, costCode: v })} options={costCodeOptions.map((o) => ({ value: o, label: o }))} />

              <FilterSelect label="RFI Stage" placeholder="RFI Stage" value={filters.rfiStage} onChange={(v) => setFilters({ ...filters, rfiStage: v })} options={rfiStageOptions.map((o) => ({ value: o, label: o }))} />

              <FilterSelect label="Created By" placeholder="Created By" value={filters.createdById} onChange={(v) => setFilters({ ...filters, createdById: v })} options={createdByOptions.map((o) => ({ value: o.id, label: o.name }))} />

              <FilterSelect label="Created By (Company)" placeholder="Created By (Company)" value={filters.createdByCompany} onChange={(v) => setFilters({ ...filters, createdByCompany: v })} options={createdByCompanyOptions.map((o) => ({ value: o, label: o }))} />
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  placeholder,
  value,
  onChange,
  options,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-900 mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white text-gray-700"
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}
