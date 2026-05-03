"use client";

import { useEffect, useRef, useState } from "react";
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
  attachments: { name: string; url: string }[];
  created_by: string | null;
  created_at: string;
  ball_in_court_id: string | null;
  official_response_id: string | null;
  related_items: { id: string; type: string; label: string; href?: string | null; notes?: string | null }[];
};

type RFIResponse = {
  id: string;
  body: string;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
  attachments: { name: string; url: string }[];
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

type RelatedItemInstance = { id: string; label: string };
type RelatedItemTypeConfig = {
  endpoint?: string;
  query?: string;
  buildLabel?: (row: Record<string, unknown>) => string;
};

function pickString(row: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim().length > 0) return value;
    if (typeof value === "number") return String(value);
  }
  return null;
}

function contactDisplayName(c: DirectoryContact): string {
  if (c.type === "company") return c.company ?? "Unnamed Company";
  if (c.type === "distribution_group") return c.group_name ?? "Unnamed Group";
  return [c.first_name, c.last_name].filter(Boolean).join(" ") || "Unnamed";
}
function getContactNameById(directory: DirectoryContact[], id: string | null): string {
  if (!id) return "—";
  const c = directory.find((x) => x.id === id);
  return c ? contactDisplayName(c) : "—";
}
function getSpecName(specifications: Specification[], id: string | null): string {
  if (!id) return "—";
  const s = specifications.find((x) => x.id === id);
  return s ? (s.name + (s.code ? ` (${s.code})` : "")) : "—";
}
function formatDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function formatDateTime(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-US", { month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" });
}

const RELATED_ITEM_OPTIONS = [
  { value: "change_event", label: "Change Event" },
  { value: "change_order_request", label: "Change Order Request" },
  { value: "commitment_contract", label: "Commitment Contract" },
  { value: "commitment_contract_change_order", label: "Commitment Contract Change Order" },
  { value: "company", label: "Company" },
  { value: "contact", label: "Contact" },
  { value: "cost_code", label: "Cost Code" },
  { value: "cover_letters", label: "Cover Letters" },
  { value: "drawing", label: "Drawing" },
  { value: "drawing_revision", label: "Drawing Revision" },
  { value: "email", label: "Email" },
  { value: "field_order", label: "Field Order" },
  { value: "image", label: "Image" },
  { value: "location", label: "Location" },
  { value: "meeting", label: "Meeting" },
  { value: "meeting_item", label: "Meeting Item" },
  { value: "owner_invoice", label: "Owner Invoice" },
  { value: "potential_change_order", label: "Potential Change Order" },
  { value: "prime_contract", label: "Prime Contract" },
  { value: "prime_contract_change_order", label: "Prime Contract Change Order" },
  { value: "punch_item", label: "Punch Item" },
  { value: "purchase_order_contract", label: "Purchase Order Contract" },
  { value: "rfi", label: "RFI" },
  { value: "request_for_quote", label: "Request For Quote" },
  { value: "schedule_task", label: "Schedule Task" },
  { value: "specification_section", label: "Specification Section" },
  { value: "specification_section_revision", label: "Specification Section Revision" },
  { value: "subcontractor_invoice", label: "Subcontractor Invoice" },
  { value: "submittal_package", label: "Submittal Package" },
  { value: "submittals", label: "Submittals" },
  { value: "task_item", label: "Task Item" },
  { value: "transmittals", label: "Transmittals" },
] as const;

const DAILY_LOG_RELATED_ITEM_OPTIONS = [
  { value: "accidents_log", label: "Accidents Log" },
  { value: "delays_log", label: "Delays Log" },
  { value: "deliveries_log", label: "Deliveries Log" },
  { value: "inspections_log", label: "Inspections Log" },
  { value: "manpower_log", label: "Manpower Log" },
  { value: "notes_log", label: "Notes Log" },
  { value: "observed_weather_conditions_log", label: "Observed Weather Conditions Log" },
  { value: "safety_violations_log", label: "Safety Violations Log" },
  { value: "visitors_log", label: "Visitors Log" },
] as const;

const ATTACH_FILES_RELATED_ITEM_OPTIONS = [
  { value: "documents", label: "Documents" },
  { value: "drawings", label: "Drawings" },
  { value: "photos", label: "Photos" },
] as const;

const RELATED_ITEM_TYPE_CONFIGS: Record<string, RelatedItemTypeConfig> = {
  change_event: { endpoint: "change-events", buildLabel: (row) => `${pickString(row, ["number"]) ? `CE #${pickString(row, ["number"])}: ` : ""}${pickString(row, ["title"]) ?? "Change Event"}` },
  change_order_request: { endpoint: "change-orders", buildLabel: (row) => `${pickString(row, ["number"]) ? `COR #${pickString(row, ["number"])}: ` : ""}${pickString(row, ["title", "subject"]) ?? "Change Order Request"}` },
  commitment_contract: { endpoint: "commitments", buildLabel: (row) => `${pickString(row, ["number"]) ? `Commitment #${pickString(row, ["number"])}: ` : ""}${pickString(row, ["title", "description"]) ?? "Commitment Contract"}` },
  company: { endpoint: "directory", buildLabel: (row) => pickString(row, ["company", "company_name", "name"]) ?? "Company" },
  contact: { endpoint: "directory", buildLabel: (row) => pickString(row, ["full_name", "name", "first_name", "email"]) ?? "Contact" },
  drawing: { endpoint: "drawings", buildLabel: (row) => pickString(row, ["title", "number", "name"]) ?? "Drawing" },
  meeting: { endpoint: "meetings", buildLabel: (row) => pickString(row, ["title", "subject", "name"]) ?? "Meeting" },
  prime_contract: { endpoint: "prime-contracts", buildLabel: (row) => `${pickString(row, ["number"]) ? `Prime #${pickString(row, ["number"])}: ` : ""}${pickString(row, ["title", "name"]) ?? "Prime Contract"}` },
  punch_item: { endpoint: "punch-list", buildLabel: (row) => `${pickString(row, ["number"]) ? `Punch #${pickString(row, ["number"])}: ` : ""}${pickString(row, ["title", "description"]) ?? "Punch Item"}` },
  rfi: { endpoint: "rfis", buildLabel: (row) => `${pickString(row, ["rfi_number", "number"]) ? `RFI #${pickString(row, ["rfi_number", "number"])}: ` : ""}${pickString(row, ["subject", "title"]) ?? "RFI"}` },
  schedule_task: { endpoint: "schedule", buildLabel: (row) => pickString(row, ["name", "title"]) ?? "Schedule Task" },
  specification_section: { endpoint: "specifications", buildLabel: (row) => pickString(row, ["section_number", "number", "title", "name"]) ?? "Specification Section" },
  submittal_package: { endpoint: "submittal-packages", buildLabel: (row) => `${pickString(row, ["number"]) ? `Package #${pickString(row, ["number"])}: ` : ""}${pickString(row, ["title", "name"]) ?? "Submittal Package"}` },
  submittals: { endpoint: "submittals", buildLabel: (row) => `${pickString(row, ["number"]) ? `Submittal #${pickString(row, ["number"])}: ` : ""}${pickString(row, ["title", "subject"]) ?? "Submittal"}` },
  task_item: { endpoint: "tasks", buildLabel: (row) => pickString(row, ["title", "name", "description"]) ?? "Task Item" },
  documents: { endpoint: "documents", buildLabel: (row) => pickString(row, ["file_name", "name", "title"]) ?? "Document" },
  drawings: { endpoint: "drawings", buildLabel: (row) => pickString(row, ["title", "number", "name"]) ?? "Drawing" },
  photos: { endpoint: "photos", buildLabel: (row) => pickString(row, ["name", "title", "file_name"]) ?? "Photo" },
  accidents_log: { endpoint: "daily-log", query: "category=accidents", buildLabel: (row) => pickString(row, ["title", "summary", "description", "date"]) ?? "Accidents Log" },
  delays_log: { endpoint: "daily-log", query: "category=delays", buildLabel: (row) => pickString(row, ["title", "summary", "description", "date"]) ?? "Delays Log" },
  deliveries_log: { endpoint: "daily-log", query: "category=deliveries", buildLabel: (row) => pickString(row, ["title", "summary", "description", "date"]) ?? "Deliveries Log" },
  inspections_log: { endpoint: "daily-log", query: "category=inspections", buildLabel: (row) => pickString(row, ["title", "summary", "description", "date"]) ?? "Inspections Log" },
  manpower_log: { endpoint: "daily-log", query: "category=manpower", buildLabel: (row) => pickString(row, ["title", "summary", "description", "date"]) ?? "Manpower Log" },
  notes_log: { endpoint: "daily-log", query: "category=notes", buildLabel: (row) => pickString(row, ["title", "summary", "description", "date"]) ?? "Notes Log" },
  observed_weather_conditions_log: { endpoint: "daily-log", query: "category=weather", buildLabel: (row) => pickString(row, ["title", "summary", "description", "date"]) ?? "Observed Weather Conditions Log" },
  safety_violations_log: { endpoint: "daily-log", query: "category=safety", buildLabel: (row) => pickString(row, ["title", "summary", "description", "date"]) ?? "Safety Violations Log" },
  visitors_log: { endpoint: "daily-log", query: "category=visitors", buildLabel: (row) => pickString(row, ["title", "summary", "description", "date"]) ?? "Visitors Log" },
};

function ChevronDown({ open }: { open: boolean }) {
  return (
    <svg className={`w-4 h-4 text-gray-500 transition-transform ${open ? "" : "-rotate-90"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function AttachmentLink({ att }: { att: { name: string; url: string } }) {
  return (
    <div className="space-y-0.5">
      <span className="text-sm text-gray-700 truncate block max-w-[180px]">{att.name}</span>
      <a href={att.url} download={att.name} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800">
        <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        Download
      </a>
    </div>
  );
}

type ToolLevel = "none" | "read_only" | "standard" | "admin";

export default function RFIDetailClient({ projectId, rfiId, username, userId, userEmail, toolLevel }: { projectId: string; rfiId: string; username: string; userId: string; userEmail: string; toolLevel: ToolLevel }) {
  const [rfi, setRfi] = useState<RFI | null>(null);
  const [directory, setDirectory] = useState<DirectoryContact[]>([]);
  const [specifications, setSpecifications] = useState<Specification[]>([]);
  const [responses, setResponses] = useState<RFIResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [requestOpen, setRequestOpen] = useState(true);
  const [responsesOpen, setResponsesOpen] = useState(true);
  const [activeTab, setActiveTab] = useState("general");

  const [responseBody, setResponseBody] = useState("");
  const [responseFile, setResponseFile] = useState<File | null>(null);
  const [submittingResponse, setSubmittingResponse] = useState(false);
  const [responseError, setResponseError] = useState<string | null>(null);
  const [showResponseForm, setShowResponseForm] = useState(false);

  const [closingRFI, setClosingRFI] = useState(false);
  const [returningCourt, setReturningCourt] = useState(false);
  const [history, setHistory] = useState<ChangeHistoryEntry[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [processingAction, setProcessingAction] = useState<"email" | "delete" | null>(null);
  const [savingOfficialResponseId, setSavingOfficialResponseId] = useState<string | null>(null);
  const [deletingResponseId, setDeletingResponseId] = useState<string | null>(null);
  const [relatedItemType, setRelatedItemType] = useState("change_event");
  const [relatedItemInstanceId, setRelatedItemInstanceId] = useState("");
  const [relatedItemInstances, setRelatedItemInstances] = useState<RelatedItemInstance[]>([]);
  const [loadingRelatedItemInstances, setLoadingRelatedItemInstances] = useState(false);
  const [relatedItemNotes, setRelatedItemNotes] = useState("");
  const [savingRelatedItem, setSavingRelatedItem] = useState(false);
  const [relatedItemError, setRelatedItemError] = useState<string | null>(null);
  const [removingRelatedItemId, setRemovingRelatedItemId] = useState<string | null>(null);
  const actionsMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`/api/projects/${projectId}/rfis/${rfiId}`),
      fetch(`/api/projects/${projectId}/directory`),
      fetch(`/api/projects/${projectId}/specifications`),
      fetch(`/api/projects/${projectId}/rfis/${rfiId}/responses`),
    ]).then(async ([rfiRes, dirRes, specRes, respRes]) => {
      if (!rfiRes.ok) { setNotFound(true); setLoading(false); return; }
      const [rfiData, dirData, specData, respData] = await Promise.all([
        rfiRes.json(),
        dirRes.json(),
        specRes.json(),
        respRes.ok ? respRes.json() : [],
      ]);
      setRfi(rfiData);
      setDirectory(Array.isArray(dirData) ? dirData : []);
      setSpecifications(Array.isArray(specData) ? specData : []);
      setResponses(Array.isArray(respData) ? respData : []);
      setLoading(false);
    }).catch(() => {
      setNotFound(true);
      setLoading(false);
    });
  }, [projectId, rfiId]);

  async function loadHistory() {
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/rfis/${rfiId}/history`);
      const data = await res.json();
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
    if (historyLoaded) return;
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, rfiId]);

  useEffect(() => {
    function onDocumentMouseDown(e: MouseEvent) {
      if (actionsMenuRef.current && !actionsMenuRef.current.contains(e.target as Node)) {
        setShowActionsMenu(false);
      }
    }

    document.addEventListener("mousedown", onDocumentMouseDown);
    return () => document.removeEventListener("mousedown", onDocumentMouseDown);
  }, []);

  // Admin on the RFIs tool is the only role permitted to edit, close, delete,
  // mark a response official, delete comments, or create change events from an
  // RFI. Standard users (including assignees) can still respond to the RFI and
  // return ball-in-court, but cannot mutate the record itself.
  //
  // The user who created the RFI is treated as a co-manager on that one record:
  // they keep the same affordances as an admin (Edit / Close / Delete /
  // Mark Official / Delete Response / Related Items / Create Change Event)
  // even if they are not on the admin tier.
  const isAdmin = toolLevel === "admin";
  const isCreator = Boolean(rfi && rfi.created_by && rfi.created_by === userId);
  const canManage = Boolean(rfi && (isAdmin || isCreator));
  const canEdit = canManage;


  const normalizedUserEmail = userEmail.trim().toLowerCase();
  const currentUserDirectoryContactIds = directory
    .filter((contact) => {
      if (contact.id === userId) return true;
      if (!normalizedUserEmail || !contact.email) return false;
      return contact.email.trim().toLowerCase() === normalizedUserEmail;
    })
    .map((contact) => contact.id);

  const currentUserIds = [userId, ...currentUserDirectoryContactIds];
  const effectiveBallInCourtId = rfi?.ball_in_court_id ?? rfi?.rfi_manager_id ?? null;

  const canCurrentUserReturnCourt = effectiveBallInCourtId
    ? currentUserIds.includes(effectiveBallInCourtId)
    : false;

  useEffect(() => {
    const config = RELATED_ITEM_TYPE_CONFIGS[relatedItemType];
    if (!config?.endpoint) {
      queueMicrotask(() => {
        setRelatedItemInstances([]);
        setRelatedItemInstanceId("");
      });
      return;
    }

    queueMicrotask(() => {
      setLoadingRelatedItemInstances(true);
    });
    const url = `/api/projects/${projectId}/${config.endpoint}${config.query ? `?${config.query}` : ""}`;
    fetch(url)
      .then(async (res) => {
        if (!res.ok) return [];
        const payload = await res.json();
        const rows = Array.isArray(payload)
          ? payload
          : (Array.isArray(payload?.items) ? payload.items : []);
        return rows as Record<string, unknown>[];
      })
      .then((rows) => {
        const next = rows
          .map((row) => {
            const rawId = row.id ?? row.uuid ?? row.number;
            if (rawId === null || rawId === undefined) return null;
            const label = config.buildLabel ? config.buildLabel(row) : (pickString(row, ["title", "name", "subject"]) ?? String(rawId));
            return { id: String(rawId), label };
          })
          .filter((item): item is RelatedItemInstance => item !== null);
        setRelatedItemInstances(next);
        setRelatedItemInstanceId("");
      })
      .catch(() => {
        setRelatedItemInstances([]);
        setRelatedItemInstanceId("");
      })
      .finally(() => {
        setLoadingRelatedItemInstances(false);
      });
  }, [projectId, relatedItemType]);

  async function handleCloseRFI() {
    if (!rfi) return;
    setClosingRFI(true);
    const newStatus = rfi.status === "closed" ? "open" : "closed";
    const res = await fetch(`/api/projects/${projectId}/rfis/${rfiId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) setRfi(await res.json());
    setClosingRFI(false);
  }

  async function handleSubmitResponse() {
    if (!responseBody.trim()) return;
    setSubmittingResponse(true);
    setResponseError(null);
    const res = await fetch(`/api/projects/${projectId}/rfis/${rfiId}/responses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: responseBody }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setResponseError(err.error || "Failed to send response.");
      setSubmittingResponse(false);
      return;
    }
    let newResp = await res.json();
    if (responseFile) {
      const fd = new FormData();
      fd.append("file", responseFile);
      const attRes = await fetch(`/api/projects/${projectId}/rfis/${rfiId}/responses/${newResp.id}/attachment`, {
        method: "POST",
        body: fd,
      });
      if (attRes.ok) {
        const attData = await attRes.json();
        newResp = { ...newResp, attachments: attData.attachments ?? [] };
      } else {
        const attErr = await attRes.json().catch(() => ({}));
        setResponseError(`Response saved but attachment failed: ${attErr.error || "upload error"}`);
      }
    }
    setResponses((prev) => [newResp, ...prev]);
    setResponseBody("");
    setResponseFile(null);
    setShowResponseForm(false);
    setSubmittingResponse(false);
  }

  async function handleReturnCourt() {
    if (!rfi) return;

    const currentBallInCourtId = rfi.ball_in_court_id ?? rfi.rfi_manager_id;
    const ballIsWithAssignee = currentBallInCourtId !== null && currentBallInCourtId !== rfi.rfi_manager_id;
    const newBallInCourtId = ballIsWithAssignee ? rfi.rfi_manager_id : ((rfi.assignees ?? [])[0]?.id ?? null);

    if (!newBallInCourtId) {
      window.alert("Unable to return court because no recipient is assigned.");
      return;
    }

    if (!canCurrentUserReturnCourt) {
      window.alert("Only the current ball-in-court user can return court.");
      return;
    }

    setReturningCourt(true);
    const res = await fetch(`/api/projects/${projectId}/rfis/${rfiId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ball_in_court_id: newBallInCourtId }),
    });
    if (res.ok) setRfi(await res.json());
    setReturningCourt(false);
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }

  async function handleEmailRFI() {
    const distributionEmails = (rfi.distribution_list ?? [])
      .map((contact) => contact.email)
      .filter((email): email is string => Boolean(email));

    if (distributionEmails.length === 0) {
      window.alert("This RFI has no distribution list emails.");
      return;
    }

    setProcessingAction("email");
    const res = await fetch(`/api/projects/${projectId}/rfis/${rfiId}/notify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        distribution_emails: distributionEmails,
        rfi_summary: `RFI #${rfi.rfi_number}: ${rfi.subject || "No subject"}`,
      }),
    });
    setProcessingAction(null);
    setShowActionsMenu(false);

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      window.alert(errorData.error || "Failed to send email notification.");
      return;
    }
    window.alert("Email notification queued for the distribution list.");
  }

  async function handleDeleteRFI() {
    if (!canEdit) {
      window.alert("Only an RFI admin or the RFI creator can delete this RFI.");
      return;
    }

    const confirmed = window.confirm("Send this RFI to the Recycling Bin?");
    if (!confirmed) return;

    setProcessingAction("delete");
    const res = await fetch(`/api/projects/${projectId}/rfis/${rfiId}`, { method: "DELETE" });
    setProcessingAction(null);

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      window.alert(errorData.error || "Failed to move the RFI to Recycling Bin.");
      return;
    }

    window.location.href = `/projects/${projectId}/rfis`;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-100 px-6 h-14 flex items-center justify-between">
          <a href="/dashboard" className="text-sm font-semibold text-gray-900">SiteCommand</a>
          <span className="text-sm text-gray-400">{username}</span>
        </header>
        <main className="px-6 py-8"><p className="text-sm text-gray-400">Loading...</p></main>
      </div>
    );
  }

  if (notFound || !rfi) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-100 px-6 h-14 flex items-center justify-between">
          <a href="/dashboard" className="text-sm font-semibold text-gray-900">SiteCommand</a>
        </header>
        <main className="px-6 py-8"><p className="text-sm text-gray-500">RFI not found.</p></main>
      </div>
    );
  }

  const relatedItemsCount = (rfi.related_items ?? []).length;
  const emailsCount = 0;
  const historyCount = history.length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Site header */}
      <header className="bg-white border-b border-gray-100 px-6 h-14 flex items-center justify-between">
        <a href="/dashboard" className="text-sm font-semibold text-gray-900 hover:text-gray-600 transition-colors">SiteCommand</a>
        <div className="flex items-center gap-5">
          <span className="text-sm text-gray-400">{username}</span>
          <button onClick={handleLogout} className="text-sm text-gray-400 hover:text-gray-900 transition-colors">Logout</button>
        </div>
      </header>

      <ProjectNav projectId={projectId} />

      {/* RFI title bar — W2 field-journal styling */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-baseline gap-3 mb-1">
            <span className={`idx-display ${["open","closed","draft"].includes(rfi.status) ? `text-[color:var(--brand-500)]` : ""}`}>
              {String(rfi.rfi_number).padStart(3, "0")}
            </span>
            <span className="font-mono text-[11px] text-gray-400 uppercase tracking-wider">
              RFI{getSpecName(specifications, rfi.specification_id) !== "—" ? ` · ${getSpecName(specifications, rfi.specification_id)}` : ""}
            </span>
          </div>
          <h1 className="font-display text-[24px] leading-[1.15] tracking-[-0.012em] text-[color:var(--ink)] truncate">
            {rfi.subject || "No subject"}
          </h1>
          <div className="h-rule-orange" />
          <p className="text-xs text-gray-500">
            Submitted by{" "}
            <span className="serif-italic text-[color:var(--brand-700)]">
              {getContactNameById(directory, rfi.received_from_id) || "—"}
            </span>{" "}
            · <span className="font-mono">{formatDate(rfi.created_at?.split("T")[0] ?? null)}</span>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {canManage && (
            <a
              href={`/projects/${projectId}/change-events/new?sourceType=rfi&sourceId=${rfi.id}`}
              className="px-3 py-1.5 text-sm font-medium text-white bg-gray-900 rounded hover:bg-gray-700 transition-colors"
            >
              + Create Change Event
            </a>
          )}
          {canManage && (
            <button
              onClick={handleCloseRFI}
              disabled={closingRFI}
              className={`px-3 py-1.5 text-sm font-medium rounded transition-colors disabled:opacity-50 ${rfi.status === "closed" ? "bg-gray-600 text-white hover:bg-gray-700" : "bg-gray-900 text-white hover:bg-gray-700"}`}
            >
              {closingRFI ? "..." : rfi.status === "closed" ? "Reopen RFI" : "Close RFI"}
            </button>
          )}
          {canEdit && (
            <a
              href={`/projects/${projectId}/rfis/${rfi.id}/edit`}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
            >
              Edit
            </a>
          )}
          <a
            href={`/projects/${projectId}/rfis`}
            className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
          >
            All RFIs
          </a>
          <div className="relative" ref={actionsMenuRef}>
            <button
              type="button"
              onClick={() => setShowActionsMenu((v) => !v)}
              className="w-9 h-9 inline-flex items-center justify-center text-gray-600 bg-white border border-blue-600 rounded hover:bg-blue-50 transition-colors"
              aria-haspopup="menu"
              aria-expanded={showActionsMenu}
              aria-label="More actions"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="5" r="1.75" />
                <circle cx="12" cy="12" r="1.75" />
                <circle cx="12" cy="19" r="1.75" />
              </svg>
            </button>

            {showActionsMenu && (
              <div className="absolute right-0 top-10 w-48 bg-white border border-gray-200 rounded-md shadow-lg py-1 z-20">
                {canManage && (
                  <a
                    href={`/projects/${projectId}/rfis/${rfi.id}/edit`}
                    onClick={() => setShowActionsMenu(false)}
                    className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                  >
                    Edit
                  </a>
                )}
                <button
                  type="button"
                  onClick={handleEmailRFI}
                  disabled={processingAction !== null}
                  className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-50"
                >
                  {processingAction === "email" ? "Emailing..." : "Email"}
                </button>
                {canManage && (
                  <a
                    href={`/projects/${projectId}/change-events/new?sourceType=rfi&sourceId=${rfi.id}`}
                    onClick={() => setShowActionsMenu(false)}
                    className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                  >
                    Create Change Event
                  </a>
                )}
                {canManage && (
                  <button
                    type="button"
                    onClick={handleDeleteRFI}
                    disabled={processingAction !== null || !canEdit}
                    className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                  >
                    {processingAction === "delete" ? "Moving..." : "Move to Recycling Bin"}
                  </button>
                )}
                {canManage && (
                  <a
                    href={`/projects/${projectId}/rfis?create=1`}
                    onClick={() => setShowActionsMenu(false)}
                    className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                  >
                    Create RFI
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs — W2 orange-underline */}
      <div className="bg-white px-6">
        <nav className="tabs-w2">
          {[
            { id: "general", label: "General", count: null as number | null },
            { id: "related", label: "Related Items", count: relatedItemsCount },
            { id: "emails", label: "Emails", count: emailsCount },
            { id: "history", label: "Change History", count: historyCount },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                if (tab.id === "history") loadHistory();
              }}
              className={activeTab === tab.id ? "active" : ""}
            >
              {tab.label}
              {tab.count !== null && <span className="count">{tab.count}</span>}
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

        {activeTab === "related" && (
          <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-5">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Related Items</h2>
              <p className="text-xs text-gray-500 mt-1">Link change events, correspondence, instructions, and other items to this RFI.</p>
            </div>

            {(rfi.related_items ?? []).length === 0 ? (
              <p className="text-sm text-gray-400">No related items yet.</p>
            ) : (
              <ul className="space-y-2">
                {(rfi.related_items ?? []).map((item) => (
                  <li key={item.id} className="flex items-center justify-between border border-gray-100 rounded-md px-3 py-2">
                    <div>
                      <p className="text-sm text-gray-900">{item.label}</p>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">{item.type.replaceAll("_", " ")}</p>
                      {item.notes ? <p className="text-xs text-gray-500 mt-1">{item.notes}</p> : null}
                    </div>
                    <div className="flex items-center gap-2">
                      {item.href ? (
                        <a href={item.href} className="text-xs text-blue-600 hover:text-blue-800">Open</a>
                      ) : null}
                      {canManage && (
                        <button
                          type="button"
                          disabled={removingRelatedItemId === item.id}
                          onClick={async () => {
                            if (!rfi) return;
                            setRemovingRelatedItemId(item.id);
                            setRelatedItemError(null);
                            const next = (rfi.related_items ?? []).filter((x) => x.id !== item.id);
                            try {
                              const res = await fetch(`/api/projects/${projectId}/rfis/${rfiId}`, {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ related_items: next }),
                              });
                              if (res.ok) {
                                setRfi(await res.json());
                              } else {
                                const errBody = await res.json().catch(() => ({}));
                                setRelatedItemError(errBody.error || `Failed to remove related item (${res.status}).`);
                              }
                            } catch {
                              setRelatedItemError("Failed to remove related item. Check your connection and try again.");
                            } finally {
                              setRemovingRelatedItemId(null);
                            }
                          }}
                          className="text-xs text-red-600 hover:text-red-700 disabled:opacity-50"
                        >
                          {removingRelatedItemId === item.id ? "Removing…" : "Remove"}
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {canManage && (
            <>
            <div className="pt-3 border-t border-gray-100">
              <div className="rounded border border-gray-200 bg-gray-50 p-3 space-y-3">
                <label className="block text-xs font-medium text-gray-700">
                  Link Related Items
                  <select
                    value={relatedItemType}
                    onChange={(e) => {
                      setRelatedItemType(e.target.value);
                      setRelatedItemInstanceId("");
                    }}
                    className="mt-1 w-full px-3 py-2 border border-gray-200 rounded text-sm bg-white"
                  >
                    {RELATED_ITEM_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                    <optgroup label="Daily Log">
                      {DAILY_LOG_RELATED_ITEM_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </optgroup>
                    <optgroup label="Attach Files">
                      {ATTACH_FILES_RELATED_ITEM_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </optgroup>
                  </select>
                </label>
                <label className="block text-xs font-medium text-gray-700">
                  {`Select the ${RELATED_ITEM_OPTIONS.find((o) => o.value === relatedItemType)?.label ?? "Item"}`}
                  <select
                    value={relatedItemInstanceId}
                    onChange={(e) => setRelatedItemInstanceId(e.target.value)}
                    disabled={loadingRelatedItemInstances || relatedItemInstances.length === 0}
                    className="mt-1 w-full px-3 py-2 border border-gray-200 rounded text-sm disabled:bg-gray-50 disabled:text-gray-400 bg-white"
                  >
                    <option value="">{loadingRelatedItemInstances ? "Loading…" : "Select…"}</option>
                    {relatedItemInstances.map((instance) => (
                      <option key={instance.id} value={instance.id}>
                        {instance.label}
                      </option>
                    ))}
                  </select>
                </label>
                {relatedItemInstanceId && (
                  <label className="block text-xs font-medium text-gray-700">
                    Add Comment
                    <textarea
                      value={relatedItemNotes}
                      onChange={(e) => setRelatedItemNotes(e.target.value)}
                      placeholder="Add comment..."
                      rows={2}
                      className="mt-1 w-full px-3 py-2 border border-gray-200 rounded text-sm bg-white"
                    />
                  </label>
                )}
              </div>
            </div>
            {relatedItemError && (
              <p className="text-xs text-red-600">{relatedItemError}</p>
            )}
            <div className="flex justify-end">
              <button
                type="button"
                disabled={savingRelatedItem || !relatedItemInstanceId}
                onClick={async () => {
                  if (!rfi || !relatedItemInstanceId) return;
                  const selected = relatedItemInstances.find((x) => x.id === relatedItemInstanceId);
                  if (!selected) return;
                  const nextItem = { id: `${Date.now()}`, type: relatedItemType, label: selected.label, notes: relatedItemNotes.trim() || null };
                  const nextRelatedItems = [nextItem, ...(rfi.related_items ?? [])];
                  setSavingRelatedItem(true);
                  setRelatedItemError(null);
                  try {
                    const res = await fetch(`/api/projects/${projectId}/rfis/${rfiId}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ related_items: nextRelatedItems }),
                    });
                    if (res.ok) {
                      const updated = await res.json();
                      setRfi(Array.isArray(updated?.related_items) ? updated : { ...rfi, related_items: nextRelatedItems });
                      setRelatedItemInstanceId("");
                      setRelatedItemNotes("");
                    } else {
                      const errBody = await res.json().catch(() => ({}));
                      setRelatedItemError(errBody.error || `Failed to add related item (${res.status}).`);
                    }
                  } catch {
                    setRelatedItemError("Failed to add related item. Check your connection and try again.");
                  } finally {
                    setSavingRelatedItem(false);
                  }
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded hover:bg-gray-700 disabled:opacity-50"
              >
                {savingRelatedItem ? "Adding…" : "Add Related Item"}
              </button>
            </div>
            </>
            )}
          </div>
        )}

        {activeTab === "history" && (
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            {historyLoading && !historyLoaded ? (
              <p className="px-6 py-8 text-sm text-gray-400">Loading...</p>
            ) : history.length === 0 ? (
              <p className="px-6 py-8 text-sm text-gray-400">No change history yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-44">Date</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-48">Action By</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-56">Changed</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-48">From</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">To</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((entry, idx) => (
                    <tr key={entry.id} className={idx < history.length - 1 ? "border-b border-gray-100" : ""}>
                      <td className="px-4 py-4 text-xs text-gray-500 align-top whitespace-nowrap">
                        {formatDateTime(entry.created_at)}
                      </td>
                      <td className="px-4 py-4 align-top">
                        {entry.changed_by_name ? (
                          <span className="text-sm text-blue-600">
                            {entry.changed_by_name}
                            {entry.changed_by_company ? ` (${entry.changed_by_company})` : ""}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-700 align-top">{entry.action}</td>
                      <td className="px-4 py-4 text-sm text-gray-500 align-top">{entry.from_value ?? "(None)"}</td>
                      <td className="px-4 py-4 text-sm text-gray-700 align-top whitespace-pre-wrap">{entry.to_value ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === "general" && (
          <>
            {/* Request card */}
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <button
                onClick={() => setRequestOpen((v) => !v)}
                className="w-full flex items-center gap-2 px-6 py-3 border-b border-gray-200 hover:bg-gray-50 transition-colors text-left"
              >
                <ChevronDown open={requestOpen} />
                <span className="text-sm font-semibold text-gray-900">Request</span>
              </button>

              {requestOpen && (
                <div className="px-6 py-4 space-y-3">
                  {/* Subject row */}
                  <div className="flex items-baseline gap-6">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider w-24 flex-shrink-0">Subject</span>
                    <span className="text-sm text-gray-900">{rfi.subject || "—"}</span>
                  </div>

                  <div className="border-t border-gray-100" />

                  {/* Question + Attachments row */}
                  <div className="flex gap-6">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider w-24 flex-shrink-0 pt-0.5">Question</span>
                    <p className="flex-1 text-sm text-gray-700 whitespace-pre-wrap">{rfi.question || "—"}</p>
                    <div className="w-52 flex-shrink-0">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Attachments</p>
                      {(rfi.attachments ?? []).length === 0 ? (
                        <p className="text-sm text-gray-400">—</p>
                      ) : (
                        <ul className="space-y-1.5">
                          {rfi.attachments.map((att, i) => <li key={i}><AttachmentLink att={att} /></li>)}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Responses card */}
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200">
                <button
                  onClick={() => setResponsesOpen((v) => !v)}
                  className="flex items-center gap-2 hover:text-gray-600 transition-colors"
                >
                  <ChevronDown open={responsesOpen} />
                  <span className="text-sm font-semibold text-gray-900">Responses</span>
                </button>
                <button
                  onClick={() => { setShowResponseForm((v) => !v); setResponsesOpen(true); }}
                  className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-900 text-white hover:bg-gray-700 transition-colors"
                  title="Add response"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>

              {responsesOpen && (
                <>
                  {/* Add response form */}
                  {showResponseForm && (
                    <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                      <label className="block text-xs font-medium text-gray-500 mb-1">Response</label>
                      <textarea
                        value={responseBody}
                        onChange={(e) => setResponseBody(e.target.value)}
                        rows={3}
                        placeholder="Write your response..."
                        className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none bg-white"
                      />
                      <div className="mt-2">
                        <label className="block text-xs font-medium text-gray-500 mb-1">Attachment (optional)</label>
                        <input
                          type="file"
                          onChange={(e) => setResponseFile(e.target.files?.[0] ?? null)}
                          className="text-sm text-gray-600 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
                        />
                      </div>
                      {responseError && <p className="text-xs text-red-600 mt-2">{responseError}</p>}
                      <div className="flex items-center gap-2 mt-3">
                        <button
                          onClick={handleSubmitResponse}
                          disabled={submittingResponse || !responseBody.trim()}
                          className="px-4 py-1.5 text-sm font-medium text-white bg-gray-900 rounded hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {submittingResponse ? "Sending..." : "Send response"}
                        </button>
                        <button
                          onClick={() => { setShowResponseForm(false); setResponseBody(""); setResponseFile(null); setResponseError(null); }}
                          className="px-4 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Response rows */}
                  {responses.length === 0 && !showResponseForm && (
                    <p className="px-6 py-6 text-sm text-gray-400">No responses yet.</p>
                  )}
                  {responses.map((resp, idx) => (
                    <div
                      key={resp.id}
                      className={`grid grid-cols-[200px_1fr_220px_130px_40px] gap-4 px-6 py-4 items-start ${idx < responses.length - 1 ? "border-b border-gray-100" : ""}`}
                    >
                      {/* Author + date */}
                      <div>
                        <p className="text-sm font-semibold text-gray-900 leading-snug">{resp.created_by_name || "—"}{rfi.official_response_id === resp.id ? <span className="ml-2 text-[10px] uppercase tracking-wide text-green-700 bg-green-100 px-1.5 py-0.5 rounded">Official</span> : null}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{formatDateTime(resp.created_at)}</p>
                      </div>

                      {/* Response body */}
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{resp.body}</p>

                      {/* Attachments */}
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Attachments</p>
                        {(resp.attachments ?? []).length === 0 ? (
                          <p className="text-sm text-gray-400">--</p>
                        ) : (
                          <ul className="space-y-1">
                            {resp.attachments.map((att, i) => <li key={i}><AttachmentLink att={att} /></li>)}
                          </ul>
                        )}
                      </div>

                      {/* Mark Official */}
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Mark Official</p>
                        {canManage ? (
                          <input type="checkbox" checked={rfi.official_response_id === resp.id} onChange={async (e) => {
                            if (!e.target.checked) return;
                            const previousOfficialResponseId = rfi.official_response_id;
                            setRfi({ ...rfi, official_response_id: resp.id });
                            setSavingOfficialResponseId(resp.id);
                            const res = await fetch(`/api/projects/${projectId}/rfis/${rfiId}`, {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ official_response_id: resp.id }),
                            });
                            if (res.ok) {
                              setRfi(await res.json());
                            } else {
                              setRfi({ ...rfi, official_response_id: previousOfficialResponseId });
                            }
                            setSavingOfficialResponseId(null);
                          }} disabled={savingOfficialResponseId === resp.id} className="w-4 h-4 rounded border-gray-300 text-gray-900 cursor-pointer" />
                        ) : (
                          <span className="text-xs text-gray-400">{rfi.official_response_id === resp.id ? "Yes" : "—"}</span>
                        )}
                      </div>

                      {/* Delete */}
                      <div className="flex justify-center pt-0.5">
                        {canManage && (
                          <button onClick={async () => {
                            if (!window.confirm("Delete this response?")) return;
                            setDeletingResponseId(resp.id);
                            try {
                              const res = await fetch(`/api/projects/${projectId}/rfis/${rfiId}/responses/${resp.id}`, { method: "DELETE" });
                              if (res.ok) {
                                setResponses((prev) => prev.filter((r) => r.id !== resp.id));
                                if (rfi.official_response_id === resp.id) setRfi((prev) => prev ? { ...prev, official_response_id: null } : prev);
                              } else {
                                const err = await res.json().catch(() => ({}));
                                window.alert(err.error || "Failed to delete response.");
                              }
                            } catch {
                              window.alert("Network error. Failed to delete response.");
                            } finally {
                              setDeletingResponseId(null);
                            }
                          }} disabled={deletingResponseId === resp.id} className="text-gray-300 hover:text-red-500 transition-colors disabled:opacity-40" title="Delete response">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>

            {/* General Information */}
            <div className="bg-white border border-gray-200 rounded-lg px-6 py-4">
              <h2 className="text-sm font-semibold text-gray-900 mb-4 pb-3 border-b border-gray-100">General Information</h2>
              <dl className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
                <div>
                  <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">Due Date</dt>
                  <dd className="mt-0.5 text-gray-900">{formatDate(rfi.due_date)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">Status</dt>
                  <dd className="mt-0.5">
                    <span className={`pill ${rfi.status === "open" ? "pill-open" : rfi.status === "closed" ? "pill-post" : "pill-warn"} capitalize`}>
                      {rfi.status}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">RFI Manager</dt>
                  <dd className="mt-0.5 text-gray-900">{getContactNameById(directory, rfi.rfi_manager_id)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">Received From</dt>
                  <dd className="mt-0.5 text-gray-900">{getContactNameById(directory, rfi.received_from_id)}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">Assignees</dt>
                  <dd className="mt-0.5 text-gray-900">{(rfi.assignees ?? []).map((a) => a.name).join(", ") || "—"}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">Distribution List</dt>
                  <dd className="mt-0.5 text-gray-900">{(rfi.distribution_list ?? []).map((d) => d.name).join(", ") || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">Responsible Contractor</dt>
                  <dd className="mt-0.5 text-gray-900">{getContactNameById(directory, rfi.responsible_contractor_id)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">Specification</dt>
                  <dd className="mt-0.5 text-gray-900">{getSpecName(specifications, rfi.specification_id)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">Drawing Number</dt>
                  <dd className="mt-0.5 text-gray-900">{rfi.drawing_number || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">Date Initiated</dt>
                  <dd className="mt-0.5 text-gray-900">{formatDateTime(rfi.created_at)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">Ball In Court</dt>
                  <dd className="mt-0.5 text-gray-900">{getContactNameById(directory, rfi.ball_in_court_id)}</dd>
                </div>
              </dl>

              {rfi.status !== "closed" && (() => {
                const currentBallInCourtId = rfi.ball_in_court_id ?? rfi.rfi_manager_id;
                const ballIsWithAssignee = currentBallInCourtId !== null && currentBallInCourtId !== rfi.rfi_manager_id;
                const canReturnCourt = canCurrentUserReturnCourt;
                if (!canReturnCourt) return null;

                const targetName = ballIsWithAssignee
                  ? getContactNameById(directory, rfi.rfi_manager_id)
                  : ((rfi.assignees ?? [])[0]?.name ?? "Assignee");

                return (
                  <div className="flex justify-end mt-6 pt-4 border-t border-gray-100">
                    <button
                      onClick={handleReturnCourt}
                      disabled={returningCourt}
                      className="px-4 py-2 text-sm font-medium text-gray-900 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {returningCourt ? "Updating..." : `Return to ${targetName}'s Court`}
                    </button>
                  </div>
                );
              })()}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
