"use client";

import { useState, useEffect, useRef, ChangeEvent } from "react";
import ProjectNav from "@/components/ProjectNav";
import { useRouter } from "next/navigation";

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
  approver_name_id: string | null;
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
  workflow_steps: {
    step: number;
    person_id: string | null;
    required?: boolean;
    role: string;
    due_date: string | null;
    sent_date?: string | null;
    returned_date?: string | null;
    response?: string | null;
    comments?: string | null;
    attachments?: { name: string; url: string }[];
  }[];
  related_items: { type: string; title: string; href?: string | null; notes?: string | null }[];
  distributed_at: string | null;
  closed_at: string | null;
  created_by: string | null;
  created_at: string;
};

type EditableSubmittalFields = Pick<
  Submittal,
  "title" | "revision" | "submittal_type" | "status" | "submit_by" | "issue_date" | "cost_code" | "linked_drawings" | "description"
>;
type RelatedItemInstance = { id: string; label: string };
type RelatedItemTypeConfig = {
  endpoint?: string;
  query?: string;
  buildLabel?: (row: Record<string, unknown>) => string;
};
type ChangeHistoryEntry = {
  id: string;
  action: string;
  from_value: string | null;
  to_value: string | null;
  changed_by_name: string | null;
  changed_by_company: string | null;
  created_at: string;
};
type ExportOption = {
  id: string;
  label: string;
  url: string | null;
  source: "cover" | "attachment" | "response_attachment";
};

function pickString(row: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim().length > 0) return value;
    if (typeof value === "number") return String(value);
  }
  return null;
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  pending_review: "Pending Review",
  approved: "Approved",
  rejected: "Rejected",
  revise_and_resubmit: "Revise & Resubmit",
  revise_and_resubmit_2: "Revise & Resubmit 2",
  closed: "Closed",
  open: "Open",
  approved_as_noted: "Approved as Noted",
  for_the_record: "For the Record",
  make_corrections: "Make Corrections",
  no_exceptions_taken: "No Exceptions Taken",
  not_reviewed: "Not Reviewed",
  note_markings: "Note Markings",
  resubmitted: "Resubmitted",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-amber-50 text-amber-700",
  pending_review: "bg-blue-50 text-blue-700",
  approved: "bg-green-50 text-green-700",
  rejected: "bg-red-50 text-red-700",
  revise_and_resubmit: "bg-orange-50 text-orange-700",
  revise_and_resubmit_2: "bg-orange-50 text-orange-700",
  closed: "bg-gray-100 text-gray-600",
  open: "bg-blue-50 text-blue-700",
  approved_as_noted: "bg-green-50 text-green-700",
};

function contactDisplayName(c: DirectoryContact): string {
  if (c.type === "company") return c.company ?? "Unnamed Company";
  if (c.type === "distribution_group") return c.group_name ?? "Unnamed Group";
  return [c.first_name, c.last_name].filter(Boolean).join(" ") || "Unnamed";
}

function contactWithCompany(c: DirectoryContact): string {
  const name = contactDisplayName(c);
  if (c.company && c.type !== "company") return `${name} (${c.company})`;
  return name;
}

function getContactById(directory: DirectoryContact[], id: string | null): DirectoryContact | null {
  if (!id) return null;
  return directory.find((x) => x.id === id) ?? null;
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

function formatDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "numeric" });
}

function ChevronDown({ open }: { open: boolean }) {
  return (
    <svg
      className={`w-5 h-5 text-gray-500 transition-transform flex-shrink-0 ${open ? "" : "-rotate-90"}`}
      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  );
}

const DIST_SHOW_LIMIT = 4;
const RELATED_ITEM_OPTIONS = [
  { value: "change_event", label: "Change Event" },
  { value: "drawing", label: "Drawing" },
  { value: "meeting", label: "Meeting" },
  { value: "punch_item", label: "Punch Item" },
  { value: "rfi", label: "RFI" },
  { value: "submittals", label: "Submittal" },
  { value: "submittal_package", label: "Submittal Package" },
  { value: "task_item", label: "Task Item" },
  { value: "transmittals", label: "Transmittal" },
] as const;

const RELATED_ITEM_TYPE_CONFIGS: Record<string, RelatedItemTypeConfig> = {
  change_event: { endpoint: "change-events", buildLabel: (row) => `${pickString(row, ["number"]) ? `CE #${pickString(row, ["number"])}: ` : ""}${pickString(row, ["title"]) ?? "Change Event"}` },
  drawing: { endpoint: "drawings", buildLabel: (row) => pickString(row, ["title", "number", "name"]) ?? "Drawing" },
  meeting: { endpoint: "meetings", buildLabel: (row) => pickString(row, ["title", "subject", "name"]) ?? "Meeting" },
  punch_item: { endpoint: "punch-list", buildLabel: (row) => `${pickString(row, ["number"]) ? `Punch #${pickString(row, ["number"])}: ` : ""}${pickString(row, ["title", "description"]) ?? "Punch Item"}` },
  rfi: { endpoint: "rfis", buildLabel: (row) => `${pickString(row, ["rfi_number", "number"]) ? `RFI #${pickString(row, ["rfi_number", "number"])}: ` : ""}${pickString(row, ["subject", "title"]) ?? "RFI"}` },
  submittal_package: { endpoint: "submittal-packages", buildLabel: (row) => `${pickString(row, ["number"]) ? `Package #${pickString(row, ["number"])}: ` : ""}${pickString(row, ["title", "name"]) ?? "Submittal Package"}` },
  submittals: { endpoint: "submittals", buildLabel: (row) => `${pickString(row, ["submittal_number", "number"]) ? `Submittal #${pickString(row, ["submittal_number", "number"])}: ` : ""}${pickString(row, ["title", "subject"]) ?? "Submittal"}` },
  task_item: { endpoint: "tasks", buildLabel: (row) => pickString(row, ["title", "name", "description"]) ?? "Task Item" },
  transmittals: { endpoint: "transmittals", buildLabel: (row) => `${pickString(row, ["transmittal_number", "number"]) ? `Transmittal #${pickString(row, ["transmittal_number", "number"])}: ` : ""}${pickString(row, ["subject", "title"]) ?? "Transmittal"}` },
};

export default function SubmittalDetailClient({
  projectId,
  submittalId,
  role,
  username,
  userId,
  userEmail,
}: {
  projectId: string;
  submittalId: string;
  role: string;
  username: string;
  userId: string;
  userEmail: string;
}) {
  const router = useRouter();
  const [submittal, setSubmittal] = useState<Submittal | null>(null);
  const [directory, setDirectory] = useState<DirectoryContact[]>([]);
  const [specifications, setSpecifications] = useState<Specification[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [distOpen, setDistOpen] = useState(true);
  const [workflowOpen, setWorkflowOpen] = useState(true);
  const [generalOpen, setGeneralOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<"general" | "related" | "emails" | "history">("general");
  const [showAllRecipients, setShowAllRecipients] = useState(false);

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [responseModal, setResponseModal] = useState<{ personId: string } | null>(null);
  const attachmentInputRef = useRef<HTMLInputElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const exportRef = useRef<HTMLDivElement | null>(null);

  const [menuOpen, setMenuOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [selectedExportIds, setSelectedExportIds] = useState<string[]>([]);
  const [relatedItemType, setRelatedItemType] = useState("change_event");
  const [relatedItemInstanceId, setRelatedItemInstanceId] = useState("");
  const [relatedItemInstances, setRelatedItemInstances] = useState<RelatedItemInstance[]>([]);
  const [loadingRelatedItemInstances, setLoadingRelatedItemInstances] = useState(false);
  const [relatedItemNotes, setRelatedItemNotes] = useState("");
  const [savingRelated, setSavingRelated] = useState(false);
  const [history, setHistory] = useState<ChangeHistoryEntry[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editValues, setEditValues] = useState<EditableSubmittalFields | null>(null);

  function startEdit() {
    if (!submittal) return;
    setEditValues({
      title: submittal.title,
      revision: submittal.revision,
      submittal_type: submittal.submittal_type,
      status: submittal.status,
      submit_by: submittal.submit_by,
      issue_date: submittal.issue_date,
      cost_code: submittal.cost_code,
      linked_drawings: submittal.linked_drawings,
      description: submittal.description,
    });
    setIsEditing(true);
    setMenuOpen(false);
  }

  async function saveEdits() {
    if (!editValues) return;
    setEditSaving(true);
    const res = await fetch(`/api/projects/${projectId}/submittals/${submittalId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editValues),
    });
    const data = await res.json().catch(() => ({}));
    setEditSaving(false);
    if (!res.ok) {
      alert((data as { error?: string }).error || "Failed to save changes");
      return;
    }
    setSubmittal(data as Submittal);
    setIsEditing(false);
    setEditValues(null);
    router.refresh();
  }

  async function runAction(action: string, payload?: Record<string, unknown>) {
    setActionLoading(action);
    const res = await fetch(`/api/projects/${projectId}/submittals/${submittalId}/actions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, payload: payload ?? {} }),
    });
    const data = await res.json();
    setActionLoading(null);
    if (!res.ok) {
      alert(data.error || "Action failed");
      return;
    }
    if (action === "duplicate" || action === "create_revision") {
      router.push(`/projects/${projectId}/submittals/${data.id}`);
      return;
    }
    if (action === "distribute" && data.revision?.id) {
      router.push(`/projects/${projectId}/submittals/${data.revision.id}`);
      return;
    }
    router.refresh();
  }

  async function deleteSubmittal() {
    if (!confirm("Send this submittal to Recycle Bin?")) return;
    setActionLoading("delete");
    const res = await fetch(`/api/projects/${projectId}/submittals/${submittalId}`, { method: "DELETE" });
    setActionLoading(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "Delete failed");
      return;
    }
    router.push(`/projects/${projectId}/submittals`);
  }

  async function submitResponse(personId: string, response: string, comments: string, files: File[]) {
    setActionLoading("edit_response");
    for (const file of files) {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("person_id", personId);
      const upRes = await fetch(`/api/projects/${projectId}/submittals/${submittalId}/response-attachment`, { method: "POST", body: formData });
      if (!upRes.ok) {
        const data = await upRes.json().catch(() => ({}));
        setActionLoading(null);
        alert(data.error || "Attachment upload failed");
        return;
      }
    }
    const res = await fetch(`/api/projects/${projectId}/submittals/${submittalId}/actions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "edit_response",
        payload: {
          person_id: personId,
          response: response.trim() || null,
          comments: comments.trim() || null,
          sent_date: new Date().toISOString().slice(0, 10),
          returned_date: new Date().toISOString().slice(0, 10),
        },
      }),
    });
    const data = await res.json();
    setActionLoading(null);
    if (!res.ok) {
      alert(data.error || "Action failed");
      return;
    }
    setResponseModal(null);
    router.refresh();
  }

  async function uploadGeneralAttachments(fileList: FileList | File[]) {
    const files = Array.from(fileList);
    if (files.length === 0) return;
    setUploadingAttachment(true);
    for (const file of files) {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/projects/${projectId}/submittals/${submittalId}/attachment`, { method: "POST", body: formData });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Attachment upload failed");
        setUploadingAttachment(false);
        return;
      }
      const updated = await res.json();
      setSubmittal((prev) => (prev ? { ...prev, attachments: updated.attachments ?? [] } : prev));
    }
    setUploadingAttachment(false);
  }

  async function forwardForReview() {
    const toPersonId = prompt("Forward to contact ID (from directory):");
    if (!toPersonId) return;
    const comments = prompt("Forward comments (optional):") ?? "";
    await runAction("forward_for_review", {
      to_person_id: toPersonId.trim(),
      actor_contact_id: submittal?.ball_in_court_id ?? null,
      comments: comments.trim() || null,
      sent_date: new Date().toISOString().slice(0, 10),
    });
  }

  async function removeWorkflowPerson(personId: string) {
    if (!confirm("Remove this submitter/approver from the workflow?")) return;
    await runAction("remove_workflow_person", { person_id: personId });
  }

  async function toggleWorkflowStepRequired(stepNumber: number, required: boolean) {
    await runAction("set_workflow_step_required", { step_number: stepNumber, required });
  }

  const exportOptions: ExportOption[] = submittal
    ? [
        { id: "cover", label: "Cover Page", url: null, source: "cover" as const },
        ...(submittal.attachments ?? []).map((attachment, idx) => ({
          id: `attachment-${idx}`,
          label: attachment.name || `Attachment ${idx + 1}`,
          url: attachment.url ?? null,
          source: "attachment" as const,
        })),
        ...((submittal.workflow_steps ?? []).flatMap((step, stepIndex) =>
          (step.attachments ?? []).map((attachment, attachmentIndex) => ({
            id: `response-${stepIndex}-${attachmentIndex}`,
            label: `${attachment.name || `Response Attachment ${attachmentIndex + 1}`} (Workflow Step ${step.step})`,
            url: attachment.url ?? null,
            source: "response_attachment" as const,
          }))
        )),
      ]
    : [];

  function toggleExportOption(optionId: string) {
    setSelectedExportIds((prev) =>
      prev.includes(optionId) ? prev.filter((id) => id !== optionId) : [...prev, optionId]
    );
  }

  async function exportSelectedToPdf() {
    if (!submittal) return;
    const selected = exportOptions.filter((option) => selectedExportIds.includes(option.id));
    if (selected.length === 0) {
      alert("Please select at least one item to export.");
      return;
    }

    setExportingPdf(true);
    try {
      const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
      const mergedPdf = await PDFDocument.create();
      const skippedFiles: string[] = [];

      for (const option of selected) {
        if (option.source === "cover") {
          const page = mergedPdf.addPage([612, 792]);
          const font = await mergedPdf.embedFont(StandardFonts.Helvetica);
          const titleFont = await mergedPdf.embedFont(StandardFonts.HelveticaBold);
          let y = 750;
          page.drawText(`Submittal #${submittal.submittal_number} Rev ${submittal.revision ?? "0"}`, {
            x: 50,
            y,
            size: 20,
            font: titleFont,
            color: rgb(0.1, 0.1, 0.1),
          });
          y -= 32;
          page.drawText(submittal.title, { x: 50, y, size: 14, font: titleFont, color: rgb(0.1, 0.1, 0.1) });
          y -= 28;
          const detailLines = [
            `Status: ${STATUS_LABELS[submittal.status] ?? submittal.status}`,
            `Type: ${submittal.submittal_type ?? "—"}`,
            `Specification: ${getSpecName(specifications, submittal.specification_id)}`,
            `Submit By: ${formatDate(submittal.submit_by)}`,
            `Issue Date: ${formatDate(submittal.issue_date)}`,
            `Final Due Date: ${formatDate(submittal.final_due_date)}`,
            `Required On Site: ${formatDate(submittal.required_on_site_date)}`,
            `Description: ${submittal.description ?? "—"}`,
          ];
          for (const line of detailLines) {
            page.drawText(line, { x: 50, y, size: 11, font, color: rgb(0.2, 0.2, 0.2) });
            y -= 18;
          }
          continue;
        }

        if (!option.url) {
          skippedFiles.push(option.label);
          continue;
        }

        try {
          const response = await fetch(option.url);
          if (!response.ok) throw new Error("Unable to fetch attachment");
          const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
          if (!contentType.includes("pdf") && !option.url.toLowerCase().includes(".pdf")) {
            skippedFiles.push(option.label);
            continue;
          }
          const bytes = await response.arrayBuffer();
          const doc = await PDFDocument.load(bytes);
          const copiedPages = await mergedPdf.copyPages(doc, doc.getPageIndices());
          copiedPages.forEach((copiedPage) => mergedPdf.addPage(copiedPage));
        } catch {
          skippedFiles.push(option.label);
        }
      }

      const fileBytes = await mergedPdf.save();
      const blob = new Blob([fileBytes], { type: "application/pdf" });
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download = `submittal-${submittal.submittal_number}-export.pdf`;
      anchor.click();
      URL.revokeObjectURL(href);
      if (skippedFiles.length > 0) {
        alert(`Export completed. Skipped ${skippedFiles.length} non-PDF/unavailable file(s).`);
      }
      setExportOpen(false);
    } catch {
      alert("Failed to export PDF.");
    } finally {
      setExportingPdf(false);
    }
  }

  useEffect(() => {
    Promise.all([
      fetch(`/api/projects/${projectId}/submittals/${submittalId}`),
      fetch(`/api/projects/${projectId}/directory`),
      fetch(`/api/projects/${projectId}/specifications`),
    ]).then(async ([sRes, dirRes, specRes]) => {
      if (!sRes.ok) { setNotFound(true); setLoading(false); return; }
      const [sData, dirData, specData] = await Promise.all([sRes.json(), dirRes.json(), specRes.json()]);
      setSubmittal(sData);
      setDirectory(Array.isArray(dirData) ? dirData : []);
      setSpecifications(Array.isArray(specData) ? specData : []);
      setLoading(false);
    });
  }, [projectId, submittalId]);

  useEffect(() => {
    if (!submittal) return;
    setSelectedExportIds(["cover"]);
  }, [submittal]);

  const autoEditAppliedRef = useRef(false);
  useEffect(() => {
    if (!submittal || autoEditAppliedRef.current) return;
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("edit") !== "1") return;
    if (submittal.created_by !== userId) return;
    autoEditAppliedRef.current = true;
    setEditValues({
      title: submittal.title,
      revision: submittal.revision,
      submittal_type: submittal.submittal_type,
      status: submittal.status,
      submit_by: submittal.submit_by,
      issue_date: submittal.issue_date,
      cost_code: submittal.cost_code,
      linked_drawings: submittal.linked_drawings,
      description: submittal.description,
    });
    setIsEditing(true);
    params.delete("edit");
    const newSearch = params.toString();
    const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : "") + window.location.hash;
    window.history.replaceState(null, "", newUrl);
  }, [submittal, userId]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (menuRef.current && !menuRef.current.contains(target)) setMenuOpen(false);
      if (exportRef.current && !exportRef.current.contains(target)) setExportOpen(false);
    }
    if (menuOpen || exportOpen) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [menuOpen, exportOpen]);

  async function loadHistory() {
    if (historyLoading || historyLoaded) return;
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/submittals/${submittalId}/history`);
      const data = await res.json().catch(() => []);
      setHistory(Array.isArray(data) ? data : []);
      setHistoryLoaded(true);
    } catch {
      setHistory([]);
      setHistoryLoaded(true);
    } finally {
      setHistoryLoading(false);
    }
  }

  useEffect(() => {
    const config = RELATED_ITEM_TYPE_CONFIGS[relatedItemType];
    if (!config?.endpoint) {
      setRelatedItemInstances([]);
      setRelatedItemInstanceId("");
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingRelatedItemInstances(true);
      try {
        const qs = config.query ? `?${config.query}` : "";
        const res = await fetch(`/api/projects/${projectId}/${config.endpoint}${qs}`);
        const raw = await res.json().catch(() => []);
        if (cancelled) return;
        const rows = Array.isArray(raw) ? raw : [];
        const next = rows
          .map((row) => {
            const obj = (row ?? {}) as Record<string, unknown>;
            const id = pickString(obj, ["id"]);
            if (!id) return null;
            const label = config.buildLabel ? config.buildLabel(obj) : pickString(obj, ["title", "name", "number", "id"]) ?? id;
            return { id, label };
          })
          .filter((item): item is RelatedItemInstance => item !== null);
        setRelatedItemInstances(next);
        setRelatedItemInstanceId("");
      } catch {
        if (!cancelled) {
          setRelatedItemInstances([]);
          setRelatedItemInstanceId("");
        }
      } finally {
        if (!cancelled) setLoadingRelatedItemInstances(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, relatedItemType]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAF7]">
        <header className="bg-[#FAFAF7] border-b border-black/[0.06] px-6 h-14 flex items-center justify-between">
          <a href="/dashboard" className="text-[15px] font-semibold text-[color:var(--ink)]">SiteCommand</a>
          <span className="text-sm text-gray-400">{username}</span>
        </header>
        <main className="max-w-7xl mx-auto px-6 py-8">
          <p className="text-sm text-gray-400">Loading...</p>
        </main>
      </div>
    );
  }

  if (notFound || !submittal) {
    return (
      <div className="min-h-screen bg-[#FAFAF7]">
        <header className="bg-[#FAFAF7] border-b border-black/[0.06] px-6 h-14 flex items-center justify-between">
          <a href="/dashboard" className="text-[15px] font-semibold text-[color:var(--ink)]">SiteCommand</a>
        </header>
        <main className="max-w-7xl mx-auto px-6 py-8">
          <p className="text-sm text-gray-500">Submittal not found.</p>
        </main>
      </div>
    );
  }

  const canEdit = submittal.created_by === userId;
  const distList = submittal.distribution_list ?? [];
  const attachments = submittal.attachments ?? [];
  const visibleRecipients = showAllRecipients ? distList : distList.slice(0, DIST_SHOW_LIMIT);
  const statusLabel = STATUS_LABELS[submittal.status] ?? submittal.status;

  const fromContact = getContactById(directory, submittal.received_from_id);
  const workflowSteps = (submittal.workflow_steps ?? []).slice().sort((a, b) => a.step - b.step);
  const currentUserDirectoryContact =
    directory.find((contact) => contact.type === "user" && contact.email?.toLowerCase() === userEmail.toLowerCase()) ?? null;
  const currentUserWorkflowStep = currentUserDirectoryContact
    ? workflowSteps.find((step) => step.person_id === currentUserDirectoryContact.id) ?? null
    : null;
  const isApproverBallInCourtReviewer =
    Boolean(currentUserWorkflowStep?.person_id) &&
    submittal.ball_in_court_id === currentUserWorkflowStep?.person_id;
  const canRequiredApproverRespond = isApproverBallInCourtReviewer && Boolean(currentUserWorkflowStep?.required);
  const canOptionalApproverSetBallInCourt = isApproverBallInCourtReviewer && !currentUserWorkflowStep?.required;
  const ballInCourtTargets = Array.from(
    new Set(
      [submittal.submittal_manager_id, ...workflowSteps.map((step) => step.person_id)]
        .filter((id): id is string => Boolean(id))
    )
  );

  return (
    <div className="min-h-screen bg-[#FAFAF7]">
      <header className="bg-[#FAFAF7] border-b border-black/[0.06] px-6 h-14 flex items-center justify-between">
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

      {/* Submittal title bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <a
            href={`/projects/${projectId}/submittals`}
            className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-700 transition-colors flex-shrink-0"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            All Submittals
          </a>
          <span className="text-gray-300">/</span>
          <h1 className="font-display text-[18px] leading-tight text-[color:var(--ink)] truncate">
            Submittal #{submittal.submittal_number} Revision {submittal.revision ?? "0"}: {submittal.title}
          </h1>
          {submittal.private && (
            <span className="px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded text-xs flex-shrink-0">Private</span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[submittal.status] ?? "bg-gray-100 text-gray-600"}`}>
            {statusLabel}
          </span>
          {canEdit && (
            <>
              <button onClick={() => runAction("redistribute")} disabled={actionLoading !== null} className="px-3 py-1.5 text-sm font-medium text-white bg-gray-900 rounded hover:bg-gray-700 transition-colors disabled:opacity-50">Redistribute</button>
              <div className="relative" ref={exportRef}>
                <button
                  onClick={() => setExportOpen((v) => !v)}
                  className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded hover:bg-gray-200 transition-colors"
                >
                  Export
                </button>
                {exportOpen && (
                  <div className="absolute right-0 mt-1 w-96 max-h-80 overflow-y-auto bg-white border border-gray-200 rounded-md shadow-lg z-20 p-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Select items to combine into PDF</p>
                    <div className="space-y-2">
                      {exportOptions.map((option) => (
                        <label key={option.id} className="flex items-start gap-2 text-sm text-gray-700">
                          <input
                            type="checkbox"
                            className="mt-0.5"
                            checked={selectedExportIds.includes(option.id)}
                            onChange={() => toggleExportOption(option.id)}
                          />
                          <span>{option.label}</span>
                        </label>
                      ))}
                    </div>
                    <div className="mt-3 flex justify-end gap-2">
                      <button onClick={() => setExportOpen(false)} className="px-2.5 py-1.5 text-xs border border-gray-300 rounded">
                        Cancel
                      </button>
                      <button
                        onClick={exportSelectedToPdf}
                        disabled={exportingPdf}
                        className="px-2.5 py-1.5 text-xs text-white bg-gray-900 rounded disabled:opacity-50"
                      >
                        {exportingPdf ? "Exporting..." : "Export Selected"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
              {!isEditing ? (
                <button onClick={startEdit} className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded hover:bg-gray-200 transition-colors">Edit</button>
              ) : (
                <>
                  <button onClick={saveEdits} disabled={editSaving} className="px-3 py-1.5 text-sm font-medium text-white bg-gray-900 rounded hover:bg-gray-700 transition-colors disabled:opacity-50">{editSaving ? "Saving..." : "Save"}</button>
                  <button onClick={() => { setIsEditing(false); setEditValues(null); }} className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors">Cancel</button>
                </>
              )}
              <div ref={menuRef} className="relative">
                <button
                  onClick={() => setMenuOpen((v) => !v)}
                  className="px-2 py-1.5 text-xl leading-none text-gray-700 hover:text-gray-900"
                  aria-label="More actions"
                >
                  ⋮
                </button>
                {menuOpen && (
                  <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-20 py-1 text-sm">
                    <button onClick={() => runAction("create_revision")} className="w-full text-left px-3 py-2 hover:bg-gray-50">Create Revision</button>
                    <button onClick={() => runAction("redistribute")} className="w-full text-left px-3 py-2 hover:bg-gray-50">Email</button>
                    <button onClick={deleteSubmittal} className="w-full text-left px-3 py-2 text-red-600 hover:bg-red-50">Delete</button>
                    <button onClick={() => router.push(`/projects/${projectId}/submittals`)} className="w-full text-left px-3 py-2 hover:bg-gray-50">Create New Submittal</button>
                    <button onClick={() => runAction("duplicate")} className="w-full text-left px-3 py-2 hover:bg-gray-50">Duplicate Submittal</button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 px-6">
        <nav className="flex gap-0 -mb-px">
          {[
            { key: "general", label: "General" },
            { key: "related", label: `Related Items (${(submittal.related_items ?? []).length})` },
            { key: "emails", label: "Emails" },
            { key: "history", label: `Change History (${history.length})` },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key as "general" | "related" | "emails" | "history");
                if (tab.key === "history") loadHistory();
              }}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? "border-gray-900 text-gray-900"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <main className="max-w-7xl mx-auto px-6 py-6 space-y-4">
        {activeTab === "emails" && (
          <div className="bg-white border border-gray-200 rounded-lg px-6 py-12 text-center">
            <p className="text-sm text-gray-400">Email activity feed is coming soon.</p>
          </div>
        )}

        {activeTab === "history" && (
          <div className="bg-white border border-gray-200 rounded-lg">
            {historyLoading && !historyLoaded ? (
              <p className="px-6 py-8 text-sm text-gray-400">Loading change history…</p>
            ) : history.length === 0 ? (
              <p className="px-6 py-8 text-sm text-gray-400">No change history yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[780px] text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</th>
                      <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">From</th>
                      <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">To</th>
                      <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Changed By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((entry, idx) => (
                      <tr key={entry.id} className={idx < history.length - 1 ? "border-b border-gray-100" : ""}>
                        <td className="px-4 py-2 text-gray-700 whitespace-nowrap">
                          {new Date(entry.created_at).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
                        </td>
                        <td className="px-4 py-2 text-gray-900">{entry.action}</td>
                        <td className="px-4 py-2 text-gray-700">{entry.from_value ?? "—"}</td>
                        <td className="px-4 py-2 text-gray-700">{entry.to_value ?? "—"}</td>
                        <td className="px-4 py-2 text-gray-700">
                          {entry.changed_by_name ?? "Unknown"}
                          {entry.changed_by_company ? <span className="text-gray-500"> • {entry.changed_by_company}</span> : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === "related" && (
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Related Items</h3>
            {(submittal.related_items ?? []).length === 0 ? (
              <p className="text-sm text-gray-500">No related items added.</p>
            ) : (
              <div className="divide-y divide-gray-100 border border-gray-100 rounded-md bg-white">
                {(submittal.related_items ?? []).map((item, idx) => (
                  <div key={`${item.href}-${idx}`} className="flex items-center justify-between gap-3 px-3 py-2">
                    <div>
                      <p className="text-sm text-gray-900">{item.title || "Untitled item"}</p>
                      <p className="text-xs text-gray-500">{item.type || "link"}{item.notes ? ` • ${item.notes}` : ""}</p>
                    </div>
                    <button
                      type="button"
                      className="text-xs text-red-600 hover:text-red-700"
                      onClick={async () => {
                        const next = (submittal.related_items ?? []).filter((_, i) => i !== idx);
                        const res = await fetch(`/api/projects/${projectId}/submittals/${submittalId}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ related_items: next }),
                        });
                        if (res.ok) setSubmittal(await res.json());
                      }}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4 border-t border-gray-100 pt-4">
              <div className="rounded border border-gray-200 bg-gray-50 p-3 space-y-3">
                <label className="block text-xs font-medium text-gray-700">
                  Link Related Items
                  <select
                    value={relatedItemType}
                    onChange={(e) => {
                      setRelatedItemType(e.target.value);
                      setRelatedItemInstanceId("");
                    }}
                    className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm bg-white"
                  >
                    {RELATED_ITEM_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs font-medium text-gray-700">
                  Select Existing
                  <select
                    value={relatedItemInstanceId}
                    onChange={(e) => setRelatedItemInstanceId(e.target.value)}
                    disabled={loadingRelatedItemInstances || relatedItemInstances.length === 0}
                    className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm bg-white disabled:bg-gray-100"
                  >
                    <option value="">{loadingRelatedItemInstances ? "Loading…" : "Select…"}</option>
                    {relatedItemInstances.map((item) => (
                      <option key={item.id} value={item.id}>{item.label}</option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs font-medium text-gray-700">
                  Add Comment
                  <textarea
                    value={relatedItemNotes}
                    onChange={(e) => setRelatedItemNotes(e.target.value)}
                    className="mt-1 min-h-16 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                    placeholder="Add comment..."
                  />
                </label>
              </div>
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  disabled={savingRelated || !relatedItemInstanceId}
                  onClick={async () => {
                    if (!relatedItemInstanceId) return;
                    const selected = relatedItemInstances.find((item) => item.id === relatedItemInstanceId);
                    if (!selected) return;
                    setSavingRelated(true);
                    const next = [...(submittal.related_items ?? []), { type: relatedItemType, title: selected.label, href: `/${relatedItemType}/${selected.id}`, notes: relatedItemNotes.trim() || null }];
                    const res = await fetch(`/api/projects/${projectId}/submittals/${submittalId}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ related_items: next }),
                    });
                    if (res.ok) {
                      const updated = await res.json();
                      setSubmittal(updated);
                      setRelatedItemInstanceId("");
                      setRelatedItemNotes("");
                    }
                    setSavingRelated(false);
                  }}
                  className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
                >
                  {savingRelated ? "Adding..." : "Add Related Item"}
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === "general" && (
          <>
        {/* ── Distribution Summary ───────────────────────────────────────── */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <button
            onClick={() => setDistOpen((v) => !v)}
            className="w-full flex items-center gap-2.5 px-6 py-4 hover:bg-gray-50 transition-colors text-left"
          >
            <ChevronDown open={distOpen} />
            <span className="text-base font-semibold text-gray-900">Distribution Summary</span>
          </button>

          {distOpen && (
            <div className="border-t border-gray-100 px-6 pb-5">
              {/* From / To row */}
              <div className="flex gap-16 py-4">
                <div className="w-56 flex-shrink-0">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">From</p>
                  {fromContact ? (
                    <p className="text-sm text-gray-700">{contactWithCompany(fromContact)}</p>
                  ) : (
                    <p className="text-sm text-gray-400">—</p>
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">To</p>
                  {distList.length === 0 ? (
                    <p className="text-sm text-gray-400">—</p>
                  ) : (
                    <>
                      <div className="space-y-0.5">
                        {visibleRecipients.map((c) => (
                          <p key={c.id} className="text-sm text-blue-600">{c.name}</p>
                        ))}
                      </div>
                      {distList.length > DIST_SHOW_LIMIT && (
                        <button
                          onClick={() => setShowAllRecipients((v) => !v)}
                          className="mt-2 px-3 py-1 text-xs font-medium text-gray-600 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                        >
                          {showAllRecipients ? "Show Less" : "Show More"}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Message + Attachments */}
              <div className="border-t border-gray-100 pt-4 flex gap-16">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-700 mb-1">Message</p>
                  {isEditing ? (
                    <textarea
                      value={editValues?.description ?? ""}
                      onChange={(e) => setEditValues((prev) => ({ ...(prev ?? {}), description: e.target.value || null }))}
                      className="w-full min-h-24 px-3 py-2 text-sm border border-gray-300 rounded-md"
                    />
                  ) : submittal.description ? (
                    <p className="text-sm text-gray-600 whitespace-pre-wrap">{submittal.description}</p>
                  ) : (
                    <p className="text-sm text-gray-400">--</p>
                  )}
                </div>
                <div className="w-56 flex-shrink-0">
                  <p className="text-sm font-medium text-gray-700 mb-1">Attachments</p>
                  <p className="text-sm text-gray-400">--</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Submittal Workflow ─────────────────────────────────────────── */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <button
            onClick={() => setWorkflowOpen((v) => !v)}
            className="w-full flex items-center gap-2.5 px-6 py-4 hover:bg-gray-50 transition-colors text-left"
          >
            <ChevronDown open={workflowOpen} />
            <span className="text-base font-semibold text-gray-900">Submittal Workflow</span>
          </button>

          {workflowOpen && (
            <div className="border-t border-gray-100 overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider w-44">Name</th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider w-24">Sent Date</th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider w-24">Due Date</th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider w-28">Returned Date</th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider w-24">Response</th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider w-24">Comments</th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Attachments</th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider w-20">Version</th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider w-20">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {/* General Information Attachments group */}
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <td colSpan={9} className="px-4 py-2.5">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-semibold text-gray-700">General Information Attachments</span>
                        {canEdit && (
                          <>
                            <input
                              ref={attachmentInputRef}
                              type="file"
                              multiple
                              className="hidden"
                              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                                const list = e.target.files;
                                if (list && list.length > 0) uploadGeneralAttachments(list);
                                e.target.value = "";
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => attachmentInputRef.current?.click()}
                              disabled={uploadingAttachment}
                              className="px-2.5 py-1 text-xs font-medium text-gray-700 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
                            >
                              {uploadingAttachment ? "Uploading..." : "Add Attachment"}
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                  {attachments.length === 0 ? (
                    <tr className="border-b border-gray-100">
                      <td colSpan={9} className="px-4 py-3 text-sm text-gray-400">No attachments</td>
                    </tr>
                  ) : (
                    attachments.map((att, i) => (
                      <tr key={i} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td colSpan={6} />
                        <td className="px-3 py-3">
                          <a
                            href={att.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-600 hover:underline"
                          >
                            {att.name}
                          </a>
                        </td>
                        <td />
                        <td className="px-3 py-3">
                          <a
                            href={att.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            download
                            className="text-gray-400 hover:text-gray-700 transition-colors"
                          >
                            <DownloadIcon />
                          </a>
                        </td>
                      </tr>
                    ))
                  )}

                  {/* #1 round header row */}
                  <tr className="border-b border-gray-200 bg-white">
                    <td className="px-4 py-2.5">
                      <span className="text-sm font-bold text-gray-900">
                        #{submittal.submittal_number}
                      </span>
                    </td>
                    <td colSpan={7} />
                    <td className="px-3 py-2.5 text-right">
                      {canEdit && (
                        <button
                          onClick={() => {
                            const contactId = prompt("Set Ball in Court to contact ID:");
                            if (!contactId) return;
                            runAction("change_ball_in_court", { ball_in_court_id: contactId.trim() });
                          }}
                          className="px-3 py-1 text-xs font-medium text-gray-700 border border-gray-300 rounded hover:bg-gray-50 transition-colors whitespace-nowrap"
                        >
                          Set Ball in Court
                        </button>
                      )}
                    </td>
                  </tr>

                  {workflowSteps.length > 0 ? (
                    workflowSteps.map((step) => {
                      const stepContact = getContactById(directory, step.person_id);
                      const isBallInCourt = submittal.ball_in_court_id && step.person_id === submittal.ball_in_court_id;
                      return (
                        <tr key={`${step.step}-${step.person_id ?? "unassigned"}`} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3">
                            {stepContact ? (
                              <div className="flex items-start gap-1.5">
                                <span className={`${isBallInCourt ? "text-yellow-400" : "text-gray-300"} text-sm leading-none mt-0.5`}>★</span>
                                <div>
                                  <p className="text-sm font-medium text-gray-900 leading-snug">
                                    {contactDisplayName(stepContact)}
                                  </p>
                                  {canEdit && (
                                    <label className="mt-1 inline-flex items-center gap-1.5 text-xs text-gray-500">
                                      <input
                                        type="checkbox"
                                        checked={Boolean(step.required)}
                                        title="Mark required"
                                        onChange={(e) => toggleWorkflowStepRequired(step.step, e.target.checked)}
                                        className="h-3.5 w-3.5 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                                      />
                                      Required
                                    </label>
                                  )}
                                  <p className="text-xs text-gray-500">{step.role}</p>
                                  {stepContact.company && (
                                    <p className="text-xs text-gray-500">{stepContact.company}</p>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <p className="text-sm text-gray-400 italic">Unassigned</p>
                            )}
                          </td>
                          <td className="px-3 py-3 text-sm text-gray-600 whitespace-nowrap">{formatDate(step.sent_date ?? submittal.issue_date)}</td>
                          <td className="px-3 py-3 text-sm text-gray-600 whitespace-nowrap">{formatDate(step.due_date)}</td>
                          <td className="px-3 py-3 text-sm text-gray-600 whitespace-nowrap">{formatDate(step.returned_date)}</td>
                          <td className="px-3 py-3 text-sm text-gray-600">{step.response ?? "—"}</td>
                          <td className="px-3 py-3 text-sm text-gray-600">{step.comments ?? "—"}</td>
                          <td className="px-3 py-3 text-sm text-gray-600">
                            {(step.attachments ?? []).length === 0 ? (
                              <span className="text-gray-400">--</span>
                            ) : (
                              <ul className="space-y-0.5">
                                {(step.attachments ?? []).map((att, ai) => (
                                  <li key={`${att.url}-${ai}`}>
                                    <a href={att.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline break-all">
                                      {att.name}
                                    </a>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            {isBallInCourt ? (
                              <span className="px-2 py-0.5 text-xs font-bold bg-green-100 text-green-700 rounded border border-green-300 uppercase">
                                Current
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400">Step {step.step}</span>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-2">
                              {(canEdit || (canRequiredApproverRespond && step.person_id === currentUserWorkflowStep?.person_id)) && step.person_id && isBallInCourt && (
                                <button
                                  onClick={() => setResponseModal({ personId: step.person_id! })}
                                  className="text-xs text-blue-600 hover:underline"
                                >
                                  Send Response
                                </button>
                              )}
                              {canOptionalApproverSetBallInCourt && step.person_id && isBallInCourt && (
                                <select
                                  value=""
                                  onChange={(e) => {
                                    const nextId = e.target.value;
                                    if (!nextId) return;
                                    runAction("change_ball_in_court", { ball_in_court_id: nextId });
                                  }}
                                  className="px-2 py-1 text-xs border border-gray-300 rounded bg-white text-gray-700"
                                >
                                  <option value="">Set Ball in Court…</option>
                                  {ballInCourtTargets.map((contactId) => (
                                    <option key={contactId} value={contactId}>
                                      {getContactNameById(directory, contactId)}
                                    </option>
                                  ))}
                                </select>
                              )}
                              {canEdit && step.person_id && isBallInCourt && (
                                <button onClick={forwardForReview} className="text-xs text-blue-600 hover:underline">Forward</button>
                              )}
                              {canEdit && step.person_id && (
                                <button
                                  onClick={() => removeWorkflowPerson(step.person_id!)}
                                  className="text-xs text-red-600 hover:underline"
                                >
                                  Remove
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr className="border-b border-gray-100">
                      <td colSpan={9} className="px-4 py-3 text-sm text-gray-400 italic">No workflow steps configured</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── General Information ────────────────────────────────────────── */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <button
            onClick={() => setGeneralOpen((v) => !v)}
            className="w-full flex items-center gap-2.5 px-6 py-4 hover:bg-gray-50 transition-colors text-left"
          >
            <ChevronDown open={generalOpen} />
            <span className="text-base font-semibold text-gray-900">General Information</span>
          </button>

          {generalOpen && (
            <div className="border-t border-gray-100 px-6 pb-6">
              {/* Title */}
              <div className="py-4 border-b border-gray-100">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-0.5">Title</p>
                {isEditing ? (
                  <input
                    value={editValues?.title ?? ""}
                    onChange={(e) => setEditValues((prev) => ({ ...(prev ?? {}), title: e.target.value }))}
                    className="w-full max-w-xl px-3 py-2 text-sm border border-gray-300 rounded-md"
                  />
                ) : (
                  <p className="text-sm text-blue-600 font-medium">{submittal.title}</p>
                )}
              </div>

              {/* 4-column details grid */}
              <dl className="grid grid-cols-4 gap-x-8 gap-y-5 text-sm pt-5">
                <div>
                  <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-0.5">Specification</dt>
                  <dd className="text-gray-700">{getSpecName(specifications, submittal.specification_id)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-0.5">Number &amp; Revision</dt>
                  <dd className="text-gray-700">
                    {isEditing ? (
                      <input
                        value={editValues?.revision ?? ""}
                        onChange={(e) => setEditValues((prev) => ({ ...(prev ?? {}), revision: e.target.value || null }))}
                        className="w-24 px-2 py-1 border border-gray-300 rounded"
                      />
                    ) : (
                      submittal.revision || "—"
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-0.5">Submittal Type</dt>
                  <dd className="text-gray-700">
                    {isEditing ? (
                      <input
                        value={editValues?.submittal_type ?? ""}
                        onChange={(e) => setEditValues((prev) => ({ ...(prev ?? {}), submittal_type: e.target.value || null }))}
                        className="w-full px-2 py-1 border border-gray-300 rounded"
                      />
                    ) : (
                      submittal.submittal_type || "—"
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-0.5">Submittal Package</dt>
                  <dd className="text-gray-700">—</dd>
                </div>

                <div>
                  <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-0.5">Responsible Contractor</dt>
                  <dd className="text-blue-600">{getContactNameById(directory, submittal.responsible_contractor_id)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-0.5">Received From</dt>
                  <dd className="text-blue-600">{getContactNameById(directory, submittal.received_from_id)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-0.5">Submittal Manager</dt>
                  <dd className="text-gray-700">{getContactNameById(directory, submittal.submittal_manager_id)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-0.5">Status</dt>
                  <dd className="text-gray-700">
                    {isEditing ? (
                      <select
                        value={String(editValues?.status ?? submittal.status)}
                        onChange={(e) => setEditValues((prev) => ({ ...(prev ?? {}), status: e.target.value }))}
                        className="w-full px-2 py-1 border border-gray-300 rounded"
                      >
                        {Object.entries(STATUS_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    ) : (
                      statusLabel
                    )}
                  </dd>
                </div>

                <div>
                  <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-0.5">Submit By</dt>
                  <dd className="text-gray-700">
                    {isEditing ? (
                      <input
                        type="date"
                        value={String(editValues?.submit_by ?? "")}
                        onChange={(e) => setEditValues((prev) => ({ ...(prev ?? {}), submit_by: e.target.value || null }))}
                        className="w-full px-2 py-1 border border-gray-300 rounded"
                      />
                    ) : formatDate(submittal.submit_by)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-0.5">Received Date</dt>
                  <dd className="text-gray-700">{formatDate(submittal.received_date)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-0.5">Issue Date</dt>
                  <dd className="text-gray-700">
                    {isEditing ? (
                      <input
                        type="date"
                        value={String(editValues?.issue_date ?? "")}
                        onChange={(e) => setEditValues((prev) => ({ ...(prev ?? {}), issue_date: e.target.value || null }))}
                        className="w-full px-2 py-1 border border-gray-300 rounded"
                      />
                    ) : formatDate(submittal.issue_date)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-0.5">Final Due Date</dt>
                  <dd className="text-gray-700">{formatDate(submittal.final_due_date)}</dd>
                </div>

                <div>
                  <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-0.5">Cost Code</dt>
                  <dd className="text-gray-700">
                    {isEditing ? (
                      <input
                        value={editValues?.cost_code ?? ""}
                        onChange={(e) => setEditValues((prev) => ({ ...(prev ?? {}), cost_code: e.target.value || null }))}
                        className="w-full px-2 py-1 border border-gray-300 rounded"
                      />
                    ) : (
                      submittal.cost_code || "—"
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-0.5">Location</dt>
                  <dd className="text-gray-700">—</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-0.5">Linked Drawings</dt>
                  <dd className="text-gray-700">
                    {isEditing ? (
                      <input
                        value={editValues?.linked_drawings ?? ""}
                        onChange={(e) => setEditValues((prev) => ({ ...(prev ?? {}), linked_drawings: e.target.value || null }))}
                        className="w-full px-2 py-1 border border-gray-300 rounded"
                      />
                    ) : (
                      submittal.linked_drawings || "—"
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-0.5">Distribution List</dt>
                  <dd>
                    {distList.length > 0 ? (
                      <div className="space-y-0.5">
                        {distList.map((d) => (
                          <p key={d.id} className="text-blue-600">{d.name}</p>
                        ))}
                      </div>
                    ) : (
                      <span className="text-gray-700">—</span>
                    )}
                  </dd>
                </div>

                <div>
                  <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-0.5">Ball In Court</dt>
                  <dd className="text-gray-700">{getContactNameById(directory, submittal.ball_in_court_id)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-0.5">Lead Time</dt>
                  <dd className="text-gray-700">{submittal.lead_time != null ? `${submittal.lead_time} days` : "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-0.5">Required On-Site Date</dt>
                  <dd className="text-gray-700">{formatDate(submittal.required_on_site_date)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-0.5">Private</dt>
                  <dd className="text-gray-700">{submittal.private ? "Yes" : "No"}</dd>
                </div>
              </dl>
            </div>
          )}
        </div>
          </>
        )}
      </main>

      {responseModal && (
        <ResponseModal
          personId={responseModal.personId}
          saving={actionLoading === "edit_response"}
          onCancel={() => setResponseModal(null)}
          onSubmit={(response, comments, files) => submitResponse(responseModal.personId, response, comments, files)}
        />
      )}
    </div>
  );
}

function ResponseModal({
  personId,
  saving,
  onCancel,
  onSubmit,
}: {
  personId: string;
  saving: boolean;
  onCancel: () => void;
  onSubmit: (response: string, comments: string, files: File[]) => void;
}) {
  void personId;
  const [response, setResponse] = useState("");
  const [comments, setComments] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const fileRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4 py-6 overflow-y-auto">
      <div className="bg-white rounded-xl w-full max-w-lg shadow-xl my-auto max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Send Response</h2>
          <button type="button" onClick={onCancel} className="text-gray-400 hover:text-gray-600">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Response</label>
            <textarea
              value={response}
              onChange={(e) => setResponse(e.target.value)}
              rows={3}
              placeholder="Enter your response..."
              className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Comments</label>
            <textarea value={comments} onChange={(e) => setComments(e.target.value)} rows={3} className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Attachments</label>
            <input
              ref={fileRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                const list = e.target.files ? Array.from(e.target.files) : [];
                if (list.length > 0) setFiles((prev) => [...prev, ...list]);
                e.target.value = "";
              }}
            />
            <button type="button" onClick={() => fileRef.current?.click()} className="px-3 py-1.5 text-xs font-medium text-gray-700 border border-gray-300 rounded hover:bg-gray-50">
              Add files
            </button>
            {files.length > 0 && (
              <ul className="mt-2 space-y-1">
                {files.map((f, i) => (
                  <li key={`${f.name}-${i}`} className="flex items-center justify-between px-2 py-1 text-xs bg-gray-50 rounded">
                    <span className="truncate text-gray-700">{f.name}</span>
                    <button type="button" onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))} className="text-gray-400 hover:text-gray-700 ml-2">×</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
          <button type="button" onClick={onCancel} disabled={saving} className="px-3 py-1.5 text-sm text-gray-700 border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-50">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSubmit(response, comments, files)}
            disabled={saving}
            className="px-3 py-1.5 text-sm font-medium text-white bg-gray-900 rounded hover:bg-gray-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
