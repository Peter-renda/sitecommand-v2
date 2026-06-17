"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ProjectNav from "@/components/ProjectNav";
import ReportFieldsSection, { type ReportFieldValues } from "@/components/ReportFieldsSection";
import { CHANGE_ORDER_REPORT_FIELDS } from "@/lib/report-fields";

const CHANGE_REASONS = [
  "Allowance",
  "Client Request",
  "Design Change",
  "Differing Site Condition",
  "Owner Request",
  "Unforeseen Condition",
  "Value Engineering",
  "Weather",
  "Other",
];

const STATUSES = [
  "Approved",
  "Draft",
  "No Charge",
  "Pending - In Review",
  "Pending - Not Pricing",
  "Pending - Not Proceeding",
  "Pending - Pricing",
  "Pending - Proceeding",
  "Pending - Revised",
  "Rejected",
  "Void",
];

type DirectoryContact = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

type ChangeOrder = {
  id: string;
  type: "prime" | "commitment";
  number: string;
  revision: number;
  title: string;
  status: string;
  contract_name: string;
  contract_company: string;
  change_reason: string;
  description: string;
  is_private: boolean;
  due_date: string | null;
  invoiced_date: string | null;
  paid_date: string | null;
  designated_reviewer: string | null;
  reviewer: string | null;
  review_date: string | null;
  request_received_from: string | null;
  amount: number;
  date_initiated: string | null;
  budget_codes: string[];
  commitment_id: string | null;
  prime_contract_id: string | null;
  erp_status?: string | null;
  executed?: boolean;
  signed_change_order_received_date?: string | null;
  schedule_impact?: number | null;
  location?: string | null;
  reference?: string | null;
  field_change?: boolean;
  paid_in_full?: boolean;
  has_attachments?: boolean;
  source_change_event_ids?: string[];
  new_substantial_completion_date?: string | null;
  project_executive_signer?: string | null;
  schedule_of_values?: Array<{
    budget_code?: string | null;
    description?: string | null;
    amount?: number | string | null;
  }> | null;
};

type ChangeEventLineItem = {
  id?: string;
  description?: string | null;
  cost_rom?: number | null;
};

type SourceEventWithLines = {
  id: string;
  number: number;
  title: string;
  line_items?: ChangeEventLineItem[];
};

type IncludedPotentialRow = {
  id: string;
  number: string;
  title: string;
  amount: number;
  scheduleImpact: string;
  status: string;
};

type RelatedItem = {
  id: string;
  item_type: string;
  item_label: string | null;
  item_date: string | null;
  notes: string | null;
  sort_order: number;
};

const RELATED_ITEM_TYPES = [
  "RFI",
  "Submittal",
  "Task",
  "Bid",
  "Meeting",
  "Drawing",
  "Specification Section",
  "Potential Change Order",
  "Change Order Request",
  "Correspondence",
  "Punch Item",
  "Observation",
  "Daily Log",
  "Attachment",
  "Other",
];

function contactName(email: string, contacts: DirectoryContact[]): string {
  const c = contacts.find((x) => x.email === email);
  if (!c) return email;
  return [c.first_name, c.last_name].filter(Boolean).join(" ") || email;
}

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return (
    d.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "2-digit" }) +
    " at " +
    d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }).toLowerCase()
  );
}

export default function ChangeOrderDetailClient({
  projectId,
  changeOrderId,
  username,
  role,
}: {
  projectId: string;
  changeOrderId: string;
  username: string;
  role?: string;
}) {
  const router = useRouter();
  const [co, setCo] = useState<ChangeOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [directoryContacts, setDirectoryContacts] = useState<DirectoryContact[]>([]);
  const [isEditing, setIsEditing] = useState(true);

  // Editable fields
  const [revision, setRevision] = useState("");
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState("Draft");
  const [changeReason, setChangeReason] = useState("");
  const [isPrivate, setIsPrivate] = useState(true);
  const [dueDate, setDueDate] = useState("");
  const [invoicedDate, setInvoicedDate] = useState("");
  const [paidDate, setPaidDate] = useState("");
  const [designatedReviewer, setDesignatedReviewer] = useState("");
  const [requestReceivedFrom, setRequestReceivedFrom] = useState("");
  const [reviewer, setReviewer] = useState("");
  const [reviewDate, setReviewDate] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("0.00");
  const [executed, setExecuted] = useState(false);
  const [signedChangeOrderReceivedDate, setSignedChangeOrderReceivedDate] = useState("");
  const [scheduleImpact, setScheduleImpact] = useState("");
  const [locationText, setLocationText] = useState("");
  const [referenceText, setReferenceText] = useState("");
  const [fieldChange, setFieldChange] = useState(false);
  const [paidInFull, setPaidInFull] = useState(false);
  const [reportFields, setReportFields] = useState<ReportFieldValues>({});
  const [includedPotentialRows, setIncludedPotentialRows] = useState<IncludedPotentialRow[]>([]);
  const [activeTab, setActiveTab] = useState<"general" | "related_items" | "emails">("general");
  const [relatedItems, setRelatedItems] = useState<RelatedItem[]>([]);
  const [relatedItemsLoading, setRelatedItemsLoading] = useState(false);
  const [newItemType, setNewItemType] = useState("");
  const [newItemLabel, setNewItemLabel] = useState("");
  const [newItemNotes, setNewItemNotes] = useState("");
  const [addingItem, setAddingItem] = useState(false);
  const [erpConnected, setErpConnected] = useState<"quickbooks" | "sage300cre" | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/integrations/erp/status`)
      .then((r) => r.json())
      .then((data) => {
        if (data.connected === "quickbooks") setErpConnected("quickbooks");
        else if (data.connected === "sage300cre") setErpConnected("sage300cre");
      })
      .catch(() => {});
  }, []);

  async function handleSyncToErp() {
    if (!erpConnected) return;
    setSyncing(true);
    setSyncMessage(null);
    try {
      const endpoint =
        erpConnected === "quickbooks"
          ? "/api/integrations/quickbooks/sync"
          : "/api/integrations/sage300cre/sync";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordType: "change_order", recordId: changeOrderId }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setSyncMessage("Synced successfully.");
        // Refresh CO to pick up updated erp_status
        const coRes = await fetch(`/api/projects/${projectId}/change-orders/${changeOrderId}`);
        if (coRes.ok) setCo(await coRes.json());
      } else {
        setSyncMessage(data?.error || `Sync failed (${res.status})`);
      }
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    fetch(`/api/projects/${projectId}/directory`)
      .then((r) => r.json())
      .then((data) => setDirectoryContacts(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [projectId]);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/change-orders/${changeOrderId}`)
      .then((r) => r.json())
      .then((data: ChangeOrder) => {
        setCo(data);
        setRevision(String(data.revision ?? 0));
        setTitle(data.title ?? "");
        setStatus(data.status ?? "Draft");
        setChangeReason(data.change_reason ?? "");
        setIsPrivate(data.is_private ?? true);
        setDueDate(data.due_date ?? "");
        setInvoicedDate(data.invoiced_date ?? "");
        setPaidDate(data.paid_date ?? "");
        setDesignatedReviewer(data.designated_reviewer ?? "");
        setRequestReceivedFrom(data.request_received_from ?? "");
        setReviewer(data.reviewer ?? "");
        setReviewDate(data.review_date ?? "");
        setDescription(data.description ?? "");
        setAmount(String(data.amount ?? "0.00"));
        setExecuted(!!data.executed);
        setSignedChangeOrderReceivedDate(data.signed_change_order_received_date ?? "");
        setScheduleImpact(data.schedule_impact == null ? "" : String(data.schedule_impact));
        setLocationText(data.location ?? "");
        setReferenceText(data.reference ?? "");
        setFieldChange(!!data.field_change);
        setPaidInFull(!!data.paid_in_full);
        setReportFields((data as { report_fields?: ReportFieldValues }).report_fields ?? {});
        setIsEditing(data.type === "commitment" ? false : true);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [projectId, changeOrderId]);

  useEffect(() => {
    const savedSov = Array.isArray(co?.schedule_of_values) ? co.schedule_of_values : [];
    if (savedSov.length > 0) {
      const rows: IncludedPotentialRow[] = savedSov.map((line, idx) => {
        const description = String(line?.description || "").trim();
        const budgetCode = String(line?.budget_code || "").trim();
        return {
          id: `sov-${idx}`,
          number: co?.number || "—",
          title: description || budgetCode || "Line Item",
          amount: Number(line?.amount ?? 0),
          scheduleImpact: scheduleImpact ? `${scheduleImpact} days` : "—",
          status,
        };
      });
      setIncludedPotentialRows(rows);
      return;
    }

    const validEventIds = (co?.source_change_event_ids ?? []).filter((id): id is string => !!id);
    if (!validEventIds.length) {
      setIncludedPotentialRows([]);
      return;
    }

    Promise.all(
      validEventIds.map((eventId) =>
        fetch(`/api/projects/${projectId}/change-events/${eventId}`)
          .then((r) => r.json())
          .then((data: SourceEventWithLines & { error?: string }) => (data.error ? null : data))
          .catch(() => null)
      )
    )
      .then((results) => {
        const events = results.filter((e): e is SourceEventWithLines => e !== null && !!e.id);
        const rows: IncludedPotentialRow[] = [];
        events.forEach((event) => {
          const lines = Array.isArray(event.line_items) ? event.line_items : [];
          if (!lines.length) {
            rows.push({
              id: `${event.id}-empty`,
              number: String(event.number).padStart(3, "0"),
              title: `CE #${String(event.number).padStart(3, "0")} - ${event.title}`,
              amount: 0,
              scheduleImpact: scheduleImpact ? `${scheduleImpact} days` : "—",
              status,
            });
            return;
          }

          lines.forEach((line, idx) => {
            const lineDescription = String(line.description || "").trim();
            rows.push({
              id: `${event.id}-${line.id || idx}`,
              number: String(event.number).padStart(3, "0"),
              title: lineDescription || `CE #${String(event.number).padStart(3, "0")} - ${event.title}`,
              amount: Number(line.cost_rom ?? 0),
              scheduleImpact: scheduleImpact ? `${scheduleImpact} days` : "—",
              status,
            });
          });
        });
        setIncludedPotentialRows(rows);
      })
      .catch(() => setIncludedPotentialRows([]));
  }, [co?.number, co?.schedule_of_values, co?.source_change_event_ids, projectId, scheduleImpact, status]);

  useEffect(() => {
    if (activeTab !== "related_items") return;
    setRelatedItemsLoading(true);
    fetch(`/api/projects/${projectId}/change-orders/${changeOrderId}/related-items`)
      .then((r) => r.json())
      .then((data) => setRelatedItems(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setRelatedItemsLoading(false));
  }, [activeTab, projectId, changeOrderId]);

  // designated_reviewer stores the email; username is session.email
  const isReviewer =
    !!designatedReviewer && username.trim().toLowerCase() === designatedReviewer.trim().toLowerCase();
  const pendingReview = new Set([
    "Pending - In Review",
    "Pending - Revised",
  ]).has(status);

  const isAdmin = role === "admin" || role === "super_admin" || role === "site_admin";

  async function handleAddRelatedItem() {
    if (!newItemType) return;
    setAddingItem(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/change-orders/${changeOrderId}/related-items`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            item_type: newItemType,
            item_label: newItemLabel || null,
            notes: newItemNotes || null,
            sort_order: relatedItems.length,
          }),
        }
      );
      if (res.ok) {
        const item: RelatedItem = await res.json();
        setRelatedItems((prev) => [...prev, item]);
        setNewItemType("");
        setNewItemLabel("");
        setNewItemNotes("");
      }
    } finally {
      setAddingItem(false);
    }
  }

  async function handleDeleteRelatedItem(itemId: string) {
    await fetch(
      `/api/projects/${projectId}/change-orders/${changeOrderId}/related-items/${itemId}`,
      { method: "DELETE" }
    );
    setRelatedItems((prev) => prev.filter((i) => i.id !== itemId));
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      const res = await fetch(`/api/projects/${projectId}/change-orders/${changeOrderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          revision: parseInt(revision, 10) || 0,
          title,
          status,
          change_reason: changeReason,
          description,
          is_private: isPrivate,
          due_date: dueDate || null,
          invoiced_date: invoicedDate || null,
          paid_date: paidDate || null,
          designated_reviewer: designatedReviewer || null,
          reviewer: reviewer || "",
          review_date: reviewDate || null,
          request_received_from: requestReceivedFrom || "",
          amount: Number(amount || 0),
          executed,
          signed_change_order_received_date: signedChangeOrderReceivedDate || null,
          schedule_impact: scheduleImpact === "" ? null : Number(scheduleImpact),
          location: locationText,
          reference: referenceText,
          field_change: fieldChange,
          paid_in_full: paidInFull,
          report_fields: reportFields,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setSaveError(err?.error || `Server error (${res.status})`);
        return false;
      }
      const updated: ChangeOrder = await res.json();
      setCo(updated);
      setSaved(true);
      return true;
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Unexpected error");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleReview(newStatus: "Approved" | "Rejected") {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/change-orders/${changeOrderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: newStatus,
          reviewer: username,
          review_date: new Date().toISOString().slice(0, 10),
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setStatus(updated.status);
        setReviewer(updated.reviewer ?? username);
        setReviewDate(updated.review_date ?? new Date().toISOString().slice(0, 10));
      } else {
        const err = await res.json().catch(() => ({}));
        setSaveError(err?.error || `Server error (${res.status})`);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleRetrieveFromErp() {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/change-orders/${changeOrderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          erp_status: "not_synced",
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setSaveError(err?.error || `Server error (${res.status})`);
        return;
      }
      const updated: ChangeOrder = await res.json();
      setCo(updated);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col h-screen bg-white">
        <ProjectNav projectId={projectId} role={role} />
        <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
          Loading…
        </div>
      </div>
    );
  }

  if (!co) {
    return (
      <div className="flex flex-col h-screen bg-white">
        <ProjectNav projectId={projectId} role={role} />
        <div className="flex-1 flex items-center justify-center text-sm text-red-500">
          Change order not found.
        </div>
      </div>
    );
  }

  const isCommitment = co.type === "commitment";
  const isSyncedToErp = String(co.erp_status || "").trim().toLowerCase() === "synced";
  const isPendingErpAcceptance = String(co.erp_status || "").trim().toLowerCase() === "pending";
  const canEdit = !isCommitment || !isSyncedToErp;
  const inputsDisabled = isCommitment && !isEditing;
  const dateCreatedDisplay = co.date_initiated ? fmtDateTime(co.date_initiated) : "—";

  function exportCurrentChangeOrderPdf() {
    const heading = `${isCommitment ? "Commitment Change Order" : "Potential Change Order"} #${co.number}`;
    const win = window.open("", "_blank", "width=1000,height=800");
    if (!win) return;
    win.document.write(`
      <html><head><title>${heading}</title><style>
      body{font-family:Arial,sans-serif;padding:24px;color:#111}
      h1{font-size:20px;margin-bottom:12px}
      .grid{display:grid;grid-template-columns:220px 1fr;gap:6px 12px;font-size:12px}
      .label{color:#666}
      </style></head><body>
      <h1>${heading}</h1>
      <div class="grid">
        <div class="label">Status</div><div>${status}</div>
        <div class="label">Title</div><div>${title || "—"}</div>
        <div class="label">Amount</div><div>$${Number(amount || 0).toFixed(2)}</div>
        <div class="label">Contract</div><div>${co.contract_name || "—"}</div>
        <div class="label">Designated Reviewer</div><div>${designatedReviewer || "—"}</div>
        <div class="label">Review Date</div><div>${reviewDate || "—"}</div>
        <div class="label">Due Date</div><div>${dueDate || "—"}</div>
        <div class="label">Description</div><div>${(description || "—").replaceAll("\n", "<br/>")}</div>
      </div>
      </body></html>
    `);
    win.document.close();
    win.focus();
    win.print();
  }

  function resetFormFromCurrentCo() {
    setRevision(String(co.revision ?? 0));
    setTitle(co.title ?? "");
    setStatus(co.status ?? "Draft");
    setChangeReason(co.change_reason ?? "");
    setIsPrivate(co.is_private ?? true);
    setDueDate(co.due_date ?? "");
    setInvoicedDate(co.invoiced_date ?? "");
    setPaidDate(co.paid_date ?? "");
    setDesignatedReviewer(co.designated_reviewer ?? "");
    setRequestReceivedFrom(co.request_received_from ?? "");
    setReviewer(co.reviewer ?? "");
    setReviewDate(co.review_date ?? "");
    setDescription(co.description ?? "");
    setAmount(String(co.amount ?? "0.00"));
    setExecuted(!!co.executed);
    setSignedChangeOrderReceivedDate(co.signed_change_order_received_date ?? "");
    setScheduleImpact(co.schedule_impact == null ? "" : String(co.schedule_impact));
    setLocationText(co.location ?? "");
    setReferenceText(co.reference ?? "");
    setFieldChange(!!co.field_change);
    setPaidInFull(!!co.paid_in_full);
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-white">
      <ProjectNav projectId={projectId} role={role} />
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Breadcrumb */}
        <div className="px-6 pt-4 pb-1 text-xs text-gray-500 flex items-center gap-1.5 shrink-0">
          {isCommitment ? (
            <>
              <button
                onClick={() => router.push(`/projects/${projectId}/commitments`)}
                className="hover:text-blue-600 transition-colors"
              >
                Commitments
              </button>
              <span>›</span>
              {co.commitment_id && (
                <>
                  <button
                    onClick={() => router.push(`/projects/${projectId}/commitments/${co.commitment_id}`)}
                    className="hover:text-blue-600 transition-colors"
                  >
                    {co.contract_name}
                  </button>
                  <span>›</span>
                </>
              )}
            </>
          ) : (
            <>
              <button
                onClick={() => router.push(`/projects/${projectId}/prime-contracts`)}
                className="hover:text-blue-600 transition-colors"
              >
                Prime Contracts
              </button>
              <span>›</span>
            </>
          )}
          <button
            onClick={() => router.push(`/projects/${projectId}/change-orders`)}
            className="hover:text-blue-600 transition-colors"
          >
            Change Orders
          </button>
          <span>›</span>
          <span className="text-gray-700 font-medium">
            {isCommitment ? "Commitment Change Order" : "Potential Change Order"} #{co.number}
          </span>
        </div>

        {/* Page title */}
        <div className="px-6 py-3 shrink-0 flex items-center justify-between">
          <h1 className="font-display text-[24px] leading-tight text-[color:var(--ink)]">
            {isCommitment ? "Commitment Change Order" : "Potential Change Order"} #{co.number}
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={exportCurrentChangeOrderPdf}
              className="px-3 py-1.5 text-xs border border-gray-300 rounded text-gray-700 hover:bg-gray-50"
            >
              Export PDF
            </button>
            {erpConnected && status === "Approved" && (
              <button
                onClick={handleSyncToErp}
                disabled={syncing}
                className="px-3 py-1.5 text-xs border border-blue-300 rounded text-blue-700 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {syncing
                  ? "Syncing…"
                  : erpConnected === "quickbooks"
                  ? "Sync to QuickBooks"
                  : "Sync to Sage 300 CRE"}
              </button>
            )}
            {isCommitment && (
              <>
                {isPendingErpAcceptance && (
                  <button
                    onClick={handleRetrieveFromErp}
                    disabled={saving}
                    className="px-3 py-1.5 text-xs border border-gray-300 rounded text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Retrieve this CCO from ERP acceptance so you can edit it again."
                  >
                    Retrieve from ERP
                  </button>
                )}
                {!isEditing ? (
                  <button
                    onClick={() => setIsEditing(true)}
                    disabled={!canEdit}
                    className="px-3 py-1.5 text-xs border border-gray-300 rounded text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    title={canEdit ? "Edit" : "This commitment change order is synced to ERP and cannot be edited."}
                  >
                    Edit
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      resetFormFromCurrentCo();
                      setIsEditing(false);
                    }}
                    className="px-3 py-1.5 text-xs border border-gray-300 rounded text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                )}
              </>
            )}
            {/* Reviewer actions shown when current user is the designated reviewer and status is pending */}
            {isReviewer && pendingReview && (
              <>
              <span className="text-xs text-amber-600 font-medium">
                Awaiting your review as {contactName(designatedReviewer, directoryContacts)}
              </span>
              <button
                disabled={saving}
                onClick={() => handleReview("Approved")}
                className="px-3 py-1.5 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
              >
                Approve
              </button>
              <button
                disabled={saving}
                onClick={() => handleReview("Rejected")}
                className="px-3 py-1.5 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
              >
                Reject
              </button>
              </>
            )}
          </div>
        </div>

        {/* Tab bar */}
        <div className="px-6 border-b border-gray-200 shrink-0 flex gap-4">
          <button
            onClick={() => setActiveTab("general")}
            className={`py-2 px-1 text-sm font-medium border-b-2 -mb-px ${
              activeTab === "general"
                ? "text-gray-900 border-orange-500"
                : "text-gray-500 border-transparent hover:text-gray-700"
            }`}
          >
            General
          </button>
          <button
            onClick={() => setActiveTab("related_items")}
            className={`py-2 px-1 text-sm font-medium border-b-2 -mb-px ${
              activeTab === "related_items"
                ? "text-gray-900 border-orange-500"
                : "text-gray-500 border-transparent hover:text-gray-700"
            }`}
          >
            Related Items{relatedItems.length > 0 ? ` (${relatedItems.length})` : ""}
          </button>
          <button
            onClick={() => setActiveTab("emails")}
            className={`py-2 px-1 text-sm font-medium border-b-2 -mb-px ${
              activeTab === "emails"
                ? "text-gray-900 border-orange-500"
                : "text-gray-500 border-transparent hover:text-gray-700"
            }`}
          >
            Emails
          </button>
        </div>

        {/* Related Items tab */}
        {activeTab === "related_items" && (
          <div className="flex-1 overflow-y-auto px-6 py-6">
            <div className="max-w-5xl">
              <p className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-4">
                Related Items
              </p>
              <div className="border border-gray-200 rounded overflow-hidden mb-6">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 text-gray-700 border-b border-gray-200">
                    <tr>
                      <th className="px-3 py-2 text-left w-40">Type</th>
                      <th className="px-3 py-2 text-left">Description</th>
                      <th className="px-3 py-2 text-left w-28">Date</th>
                      <th className="px-3 py-2 text-left">Notes</th>
                      <th className="px-3 py-2 w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {relatedItemsLoading ? (
                      <tr>
                        <td colSpan={5} className="px-3 py-4 text-gray-400">Loading…</td>
                      </tr>
                    ) : relatedItems.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-3 py-4 text-gray-400">No related items.</td>
                      </tr>
                    ) : (
                      relatedItems.map((item) => (
                        <tr key={item.id} className="border-b last:border-b-0 border-gray-100">
                          <td className="px-3 py-2">{item.item_type || "—"}</td>
                          <td className="px-3 py-2">{item.item_label || "—"}</td>
                          <td className="px-3 py-2">{item.item_date || "—"}</td>
                          <td className="px-3 py-2">{item.notes || "—"}</td>
                          <td className="px-3 py-2">
                            {isAdmin && (
                              <button
                                onClick={() => handleDeleteRelatedItem(item.id)}
                                className="text-gray-400 hover:text-red-600 text-base leading-none"
                                title="Remove"
                              >
                                ×
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {isAdmin && (
                <div className="border border-gray-200 rounded p-4 bg-gray-50">
                  <h4 className="text-xs font-semibold text-gray-700 mb-3">Add Related Item</h4>
                  <div className="rounded border border-gray-200 bg-white p-3 space-y-3">
                    <label className="block text-xs font-medium text-gray-700">
                      Link Related Items
                      <select
                        value={newItemType}
                        onChange={(e) => {
                          setNewItemType(e.target.value);
                          setNewItemLabel("");
                        }}
                        className="mt-1 w-full border border-gray-300 rounded px-2 py-1.5 text-xs"
                      >
                        <option value="">Select type…</option>
                        {RELATED_ITEM_TYPES.map((t) => (
                          <option key={t}>{t}</option>
                        ))}
                      </select>
                    </label>
                    {newItemType && (
                      <label className="block text-xs font-medium text-gray-700">
                        {`Select the ${newItemType}`}
                        <input
                          value={newItemLabel}
                          onChange={(e) => setNewItemLabel(e.target.value)}
                          className="mt-1 w-full border border-gray-300 rounded px-2 py-1.5 text-xs"
                          placeholder="Enter related item name"
                        />
                      </label>
                    )}
                    {newItemLabel.trim() && (
                      <label className="block text-xs font-medium text-gray-700">
                        Add Comment
                        <textarea
                          value={newItemNotes}
                          onChange={(e) => setNewItemNotes(e.target.value)}
                          className="mt-1 w-full border border-gray-300 rounded px-2 py-1.5 text-xs min-h-16"
                          placeholder="Add comment..."
                        />
                      </label>
                    )}
                  </div>
                  <div className="mt-3 flex justify-end">
                    <button
                      onClick={handleAddRelatedItem}
                      disabled={addingItem || !newItemType || !newItemLabel.trim()}
                      className="px-3 py-1.5 text-xs bg-gray-900 text-white rounded hover:bg-gray-700 disabled:opacity-50"
                    >
                      {addingItem ? "Adding…" : "Add Item"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Emails tab */}
        {activeTab === "emails" && (
          <div className="flex-1 overflow-y-auto px-6 py-16 text-center">
            <p className="text-sm text-gray-400">Email activity feed is coming soon.</p>
          </div>
        )}

        {/* Scrollable form body */}
        {activeTab === "general" && <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="max-w-5xl">
            <p className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-4">
              General Information
            </p>

            <div className="border border-gray-200 rounded divide-y divide-gray-200">

              {/* Row: # / Date Created */}
              <FormRow
                left={
                  <Field label="#">
                    <span className="text-xs text-gray-700">{co.number}</span>
                  </Field>
                }
                right={
                  <Field label="Date Created:">
                    <span className="text-xs text-gray-700">{dateCreatedDisplay}</span>
                  </Field>
                }
              />

              {/* Row: Revision / Created By */}
              <FormRow
                left={
                  <Field label="Revision:">
                    <input
                      value={revision}
                      onChange={(e) => setRevision(e.target.value)}
                      disabled={inputsDisabled}
                      className="w-40 border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-gray-300"
                    />
                  </Field>
                }
                right={
                  <Field label="Contract Company:">
                    <span className="text-xs text-gray-700">{co.contract_company || "—"}</span>
                  </Field>
                }
              />

              {/* Row: Contract */}
              <FormRow
                left={null}
                right={
                  <Field label="Contract:">
                    {isCommitment && co.commitment_id ? (
                      <button
                        onClick={() =>
                          router.push(`/projects/${projectId}/commitments/${co.commitment_id}`)
                        }
                        className="text-xs text-blue-600 hover:underline text-left"
                      >
                        {co.contract_name}
                      </button>
                    ) : (
                      <span className="text-xs text-gray-700">{co.contract_name || "—"}</span>
                    )}
                  </Field>
                }
              />

              {/* Row: Title (full width) */}
              <div className="px-4 py-3">
                <div className="flex items-start gap-4">
                  <label className="text-xs text-gray-600 w-40 shrink-0 pt-1">Title:</label>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    disabled={inputsDisabled}
                    className="flex-1 border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-gray-300"
                  />
                </div>
              </div>

              {/* Row: Status / Private */}
              <FormRow
                left={
                  <Field label="Status:">
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      disabled={inputsDisabled}
                      className="w-44 border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-gray-300"
                    >
                      {STATUSES.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </Field>
                }
                right={
                  <Field label="Private:">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isPrivate}
                        onChange={(e) => setIsPrivate(e.target.checked)}
                        disabled={inputsDisabled}
                        className="rounded border-gray-300 accent-blue-600"
                      />
                      {isPrivate && (
                        <span className="text-xs text-gray-400 italic">
                          Visible to your organization only
                        </span>
                      )}
                    </div>
                  </Field>
                }
              />

              {/* Row: Change Reason */}
              <FormRow
                left={
                  <Field label="Change Reason:">
                    <select
                      value={changeReason}
                      onChange={(e) => setChangeReason(e.target.value)}
                      disabled={inputsDisabled}
                      className="w-44 border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-gray-300"
                    >
                      <option value="">Select…</option>
                      {CHANGE_REASONS.map((r) => (
                        <option key={r}>{r}</option>
                      ))}
                    </select>
                  </Field>
                }
                right={null}
              />

              {/* Row: Due Date / Invoiced Date */}
              <FormRow
                left={
                  <Field label="Due Date:">
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      disabled={inputsDisabled}
                      className="border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-gray-300"
                    />
                  </Field>
                }
                right={
                  <Field label="Invoiced Date:">
                    <input
                      type="date"
                      value={invoicedDate}
                      onChange={(e) => setInvoicedDate(e.target.value)}
                      disabled={inputsDisabled}
                      className="border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-gray-300"
                    />
                  </Field>
                }
              />

              {/* Row: (empty) / Paid Date */}
              <FormRow
                left={null}
                right={
                  <Field label="Paid Date:">
                    <input
                      type="date"
                      value={paidDate}
                      onChange={(e) => setPaidDate(e.target.value)}
                      disabled={inputsDisabled}
                      className="border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-gray-300"
                    />
                  </Field>
                }
              />

              {/* Row: Designated Reviewer / Request Received From */}
              <FormRow
                left={
                  <Field label="Designated Reviewer:">
                    <select
                      value={designatedReviewer}
                      onChange={(e) => setDesignatedReviewer(e.target.value)}
                      disabled={inputsDisabled}
                      className="w-52 border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-gray-300"
                    >
                      <option value="">Select…</option>
                      {directoryContacts.map((c) => {
                        const name = [c.first_name, c.last_name].filter(Boolean).join(" ") || c.email || "";
                        return c.email ? <option key={c.id} value={c.email}>{name}</option> : null;
                      })}
                    </select>
                  </Field>
                }
                right={
                  <Field label="Request Received From:">
                    <select
                      value={requestReceivedFrom}
                      onChange={(e) => setRequestReceivedFrom(e.target.value)}
                      disabled={inputsDisabled}
                      className="w-52 border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-gray-300"
                    >
                      <option value="">Select…</option>
                      {directoryContacts.map((c) => {
                        const name = [c.first_name, c.last_name].filter(Boolean).join(" ") || c.email || "";
                        return c.email ? <option key={c.id} value={c.email}>{name}</option> : null;
                      })}
                    </select>
                  </Field>
                }
              />

              {/* Row: Reviewer / Review Date */}
              <FormRow
                left={
                  <Field label="Reviewer:">
                    <span className="text-xs text-gray-700">{reviewer || "—"}</span>
                  </Field>
                }
                right={
                  <Field label="Review Date:">
                    <span className="text-xs text-gray-700">{reviewDate || "—"}</span>
                  </Field>
                }
              />

              {/* Row: Description (full width) */}
              <div className="px-4 py-3">
                <div className="flex items-start gap-4">
                  <label className="text-xs text-gray-600 w-40 shrink-0 pt-1">Description:</label>
                  <div className="flex-1 border border-gray-300 rounded overflow-hidden">
                    <div className="flex flex-wrap items-center gap-0.5 px-2 py-1 bg-gray-50 border-b border-gray-200">
                      {["B", "I", "U", "S"].map((cmd) => (
                        <button
                          key={cmd}
                          type="button"
                          disabled={inputsDisabled}
                          className="w-5 h-5 text-xs text-gray-600 hover:bg-gray-200 rounded flex items-center justify-center font-medium"
                          style={
                            cmd === "B"
                              ? { fontWeight: "bold" }
                              : cmd === "I"
                              ? { fontStyle: "italic" }
                              : cmd === "U"
                              ? { textDecoration: "underline" }
                              : { textDecoration: "line-through" }
                          }
                        >
                          {cmd}
                        </button>
                      ))}
                      <span className="w-px h-3.5 bg-gray-300 mx-0.5" />
                      {["≡", "≣", "⊨"].map((cmd, i) => (
                        <button
                          key={i}
                          type="button"
                          disabled={inputsDisabled}
                          className="w-5 h-5 text-xs text-gray-600 hover:bg-gray-200 rounded flex items-center justify-center"
                        >
                          {cmd}
                        </button>
                      ))}
                      <span className="w-px h-3.5 bg-gray-300 mx-0.5" />
                      {["•", "1.", "⊣", "⊢"].map((cmd, i) => (
                        <button
                          key={i}
                          type="button"
                          disabled={inputsDisabled}
                          className="w-5 h-5 text-xs text-gray-600 hover:bg-gray-200 rounded flex items-center justify-center"
                        >
                          {cmd}
                        </button>
                      ))}
                    </div>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={5}
                      disabled={inputsDisabled}
                      className="w-full px-3 py-2 text-xs text-gray-800 resize-none focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Row: Amount / Budget Codes */}
              <FormRow
                left={
                  <Field label="Amount:">
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-gray-500">$</span>
                      <input
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        disabled={inputsDisabled}
                        className="w-36 border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-gray-300"
                      />
                    </div>
                  </Field>
                }
                right={
                  <Field label="Budget Codes:">
                    <span className="text-xs text-gray-700">
                      {co.budget_codes?.length
                        ? co.budget_codes.join(", ")
                        : <span className="text-gray-400">None linked</span>}
                    </span>
                  </Field>
                }
              />

              {/* Row: Executed / Signed Change Order Received Date */}
              <FormRow
                left={
                  <Field label="Executed:">
                    <select
                      value={executed ? "yes" : "no"}
                      onChange={(e) => setExecuted(e.target.value === "yes")}
                      disabled={inputsDisabled}
                      className="w-28 border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-gray-300"
                    >
                      <option value="no">No</option>
                      <option value="yes">Yes</option>
                    </select>
                  </Field>
                }
                right={
                  <Field label="Signed Change Order Received Date:">
                    <input
                      type="date"
                      value={signedChangeOrderReceivedDate}
                      onChange={(e) => setSignedChangeOrderReceivedDate(e.target.value)}
                      disabled={inputsDisabled}
                      className="border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-gray-300"
                    />
                  </Field>
                }
              />

              {/* Row: Schedule Impact / Location */}
              <FormRow
                left={
                  <Field label="Schedule Impact:">
                    <input
                      type="number"
                      value={scheduleImpact}
                      onChange={(e) => setScheduleImpact(e.target.value)}
                      disabled={inputsDisabled}
                      className="w-28 border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-gray-300"
                    />
                  </Field>
                }
                right={
                  <Field label="Location:">
                    <input
                      value={locationText}
                      onChange={(e) => setLocationText(e.target.value)}
                      disabled={inputsDisabled}
                      className="w-72 border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-gray-300"
                    />
                  </Field>
                }
              />

              {/* Row: Reference */}
              <div className="px-4 py-3">
                <div className="flex items-start gap-4">
                  <label className="text-xs text-gray-600 w-40 shrink-0 pt-1">Reference:</label>
                  <input
                    value={referenceText}
                    onChange={(e) => setReferenceText(e.target.value)}
                    disabled={inputsDisabled}
                    className="flex-1 border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-gray-300"
                  />
                </div>
              </div>

              {/* Row: Field Change / Paid In Full */}
              <FormRow
                left={
                  <Field label="Field Change:">
                    <select
                      value={fieldChange ? "yes" : "no"}
                      onChange={(e) => setFieldChange(e.target.value === "yes")}
                      disabled={inputsDisabled}
                      className="w-28 border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-gray-300"
                    >
                      <option value="no">No</option>
                      <option value="yes">Yes</option>
                    </select>
                  </Field>
                }
                right={
                  <Field label="Paid In Full:">
                    <select
                      value={paidInFull ? "yes" : "no"}
                      onChange={(e) => setPaidInFull(e.target.value === "yes")}
                      disabled={inputsDisabled}
                      className="w-28 border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-gray-300"
                    >
                      <option value="no">No</option>
                      <option value="yes">Yes</option>
                    </select>
                  </Field>
                }
              />

              {/* Row: Attachments */}
              <div className="px-4 py-3">
                <div className="flex items-start gap-4">
                  <label className="text-xs text-gray-600 w-40 shrink-0 pt-1">Attachments:</label>
                  {co.has_attachments ? (
                    <span className="text-xs text-blue-600">Attachments available</span>
                  ) : (
                    <span className="text-xs text-gray-400">None</span>
                  )}
                </div>
              </div>
            </div>

            {!isCommitment && (
              <>
                <div className="mt-8 border-t border-orange-300 pt-6">
                  <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide mb-3">
                    Additional Fields
                  </h3>
                  <div className="border border-gray-200 rounded divide-y divide-gray-200">
                    <FormRow
                      left={
                        <Field label="New Date of Substantial Completion:">
                          <span className="text-xs text-gray-700">
                            {co.new_substantial_completion_date || "—"}
                          </span>
                        </Field>
                      }
                      right={
                        <Field label="Project Executive or Project Manager Signer:">
                          <span className="text-xs text-gray-700">
                            {co.project_executive_signer || "—"}
                          </span>
                        </Field>
                      }
                    />
                  </div>
                </div>

                <div className="mt-8 border-t border-orange-300 pt-6">
                  <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide mb-3">
                    Potential Change Orders Included In This Prime Contract Change Order ({includedPotentialRows.length})
                  </h3>
                  <div className="border border-gray-200 rounded overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 text-gray-700">
                        <tr className="border-b border-gray-200">
                          <th className="px-3 py-2 text-left w-24">#</th>
                          <th className="px-3 py-2 text-left">Title</th>
                          <th className="px-3 py-2 text-right w-28">Amount</th>
                          <th className="px-3 py-2 text-left w-32">Schedule Impact</th>
                          <th className="px-3 py-2 text-left w-28">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {includedPotentialRows.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-3 py-4 text-gray-400">
                              No source change event line items were linked.
                            </td>
                          </tr>
                        ) : (
                          includedPotentialRows.map((row) => (
                            <tr key={row.id} className="border-b last:border-b-0 border-gray-100">
                              <td className="px-3 py-2 text-blue-700">{row.number}</td>
                              <td className="px-3 py-2">{row.title}</td>
                              <td className="px-3 py-2 text-right">
                                {row.amount.toLocaleString("en-US", {
                                  style: "currency",
                                  currency: "USD",
                                })}
                              </td>
                              <td className="px-3 py-2">{row.scheduleImpact}</td>
                              <td className="px-3 py-2">{row.status || "—"}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            <div className="mt-6">
              <ReportFieldsSection
                title="Report Fields"
                description="Extra change order attributes surfaced as columns in 360 Reports."
                fields={CHANGE_ORDER_REPORT_FIELDS}
                values={reportFields}
                onChange={(key, value) => setReportFields((prev) => ({ ...prev, [key]: value }))}
                columns={3}
              />
            </div>
          </div>
        </div>}

        {/* Footer */}
        {saveError && (
          <div className="px-6 py-2 bg-red-50 border-t border-red-200 text-xs text-red-700 shrink-0">
            Error: {saveError}
          </div>
        )}
        {saved && (
          <div className="px-6 py-2 bg-green-50 border-t border-green-200 text-xs text-green-700 shrink-0">
            Changes saved.
          </div>
        )}
        {syncMessage && (
          <div className={`px-6 py-2 border-t text-xs shrink-0 ${syncMessage.startsWith("Synced") ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-700"}`}>
            {syncMessage}
          </div>
        )}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-white shrink-0">
          <button
            onClick={() => router.push(`/projects/${projectId}/change-orders`)}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
          >
            Back
          </button>
          <button
            disabled={saving || (isCommitment && (!isEditing || !canEdit))}
            onClick={async () => {
              const ok = await handleSave();
              if (ok && isCommitment) setIsEditing(false);
            }}
            className="px-4 py-2 text-sm bg-gray-900 text-white rounded hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

function FormRow({
  left,
  right,
}: {
  left: React.ReactNode | null;
  right: React.ReactNode | null;
}) {
  return (
    <div className="flex divide-x divide-gray-200">
      <div className="flex-1 px-4 py-3">{left}</div>
      <div className="flex-1 px-4 py-3">{right}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4">
      <label className="text-xs text-gray-600 w-40 shrink-0">{label}</label>
      <div>{children}</div>
    </div>
  );
}
