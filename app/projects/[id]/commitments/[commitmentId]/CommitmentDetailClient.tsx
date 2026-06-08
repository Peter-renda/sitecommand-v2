"use client";

import { useState, useEffect } from "react";
import ProjectNav from "@/components/ProjectNav";

// ── Types ─────────────────────────────────────────────────────────────────────

type Commitment = {
  id: string;
  project_id: string;
  type: "subcontract" | "purchase_order";
  number: number;
  contract_company: string;
  title: string;
  erp_status: string;
  status: string;
  executed: boolean;
  default_retainage: number;
  assigned_to: string;
  bill_to: string;
  payment_terms: string;
  ship_to: string;
  ship_via: string;
  description: string;
  delivery_date: string | null;
  signed_po_received_date: string | null;
  is_private: boolean;
  sov_view_allowed: boolean;
  ssov_enabled: boolean;
  ssov_status: string;
  ssov_notified_at: string | null;
  ssov_submitted_at: string | null;
  original_contract_amount: number;
  approved_change_orders: number;
  pending_change_orders: number;
  draft_amount: number;
  subcontract_cover_letter: string;
  bond_amount: number;
  exhibit_a_scope: string;
  trades: string;
  subcontractor_contact: string;
  subcontract_type: string;
  show_cover_letter: boolean;
  show_executed_cover_letter: boolean;
  sov_accounting_method: string;
  created_at: string;
  // Subcontract-specific dates
  start_date: string | null;
  estimated_completion: string | null;
  actual_completion: string | null;
  signed_contract_received: string | null;
  // Subcontract scope
  inclusions: string;
  exclusions: string;
  // PO-specific dates
  contract_date: string | null;
  issued_on_date: string | null;
  // DocuSign / markup
  sign_docusign: boolean;
  financial_markup_enabled: boolean;
};

type SsovItem = {
  id: string;
  sov_item_id: string | null;
  budget_code: string;
  description: string;
  amount: number;
  sort_order: number;
};

type ChangeHistoryItem = {
  id: string;
  action: string;
  field_name: string | null;
  from_value: string | null;
  to_value: string | null;
  changed_by_name: string | null;
  created_at: string;
};

type DetailTab =
  | "general"
  | "change_orders"
  | "invoices"
  | "payments_issued"
  | "related_items"
  | "emails"
  | "change_history"
  | "financial_markup";

const SSOV_STATUS_LABELS: Record<string, string> = {
  "": "Not Started",
  draft: "Draft",
  under_review: "Under Review",
  revise_resubmit: "Revise & Resubmit",
  approved: "Approved",
};

const SSOV_STATUS_COLORS: Record<string, string> = {
  "": "bg-gray-100 text-gray-500",
  draft: "bg-gray-100 text-gray-600",
  under_review: "bg-amber-100 text-amber-700",
  revise_resubmit: "bg-orange-100 text-orange-700",
  approved: "bg-green-100 text-green-700",
};

type SovItem = {
  id: string;
  is_group_header: boolean;
  group_name: string;
  change_event_line_item: string;
  budget_code: string;
  description: string;
  qty: number;
  uom: string;
  unit_cost: number;
  amount: number;
  billed_to_date: number;
  sort_order: number;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  const abs = Math.abs(n);
  const formatted = abs.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return n < 0 ? `($${formatted})` : `$${formatted}`;
}

function formatDate(d: string | null): string {
  if (!d) return "—";
  const [year, month, day] = d.split("-");
  return `${month}/${day}/${year}`;
}

const STATUS_COLORS: Record<string, string> = {
  approved: "bg-green-100 text-green-700",
  draft: "bg-gray-100 text-gray-500",
  void: "bg-red-50 text-red-500",
  terminated: "bg-orange-50 text-orange-600",
};

const ERP_LABELS: Record<string, string> = {
  synced: "Synced",
  not_synced: "Not Synced",
  pending: "Pending",
};

const ERP_COLORS: Record<string, string> = {
  synced: "text-green-600",
  not_synced: "text-gray-400",
  pending: "text-amber-500",
};

// ── Export helpers ────────────────────────────────────────────────────────────

function exportSovCSV(commitment: Commitment, sovItems: SovItem[]) {
  const isUQ = commitment.sov_accounting_method === "unit_quantity";
  const headers = isUQ
    ? ["#", "Budget Code", "Description", "Qty", "UOM", "Unit Cost", "Amount", "Billed to Date"]
    : ["#", "Budget Code", "Description", "Amount", "Billed to Date"];
  const rows = sovItems
    .filter((l) => !l.is_group_header)
    .map((l, i) =>
      isUQ
        ? [i + 1, l.budget_code, l.description, l.qty, l.uom, l.unit_cost, l.qty * l.unit_cost, l.billed_to_date]
        : [i + 1, l.budget_code, l.description, l.amount, l.billed_to_date]
    );
  const csv = [headers, ...rows]
    .map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `commitment-${commitment.number}-sov.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportCommitmentPDF(commitment: Commitment, sovItems: SovItem[], typeLabel: string) {
  const isUQ = commitment.sov_accounting_method === "unit_quantity";
  const sovRows = sovItems
    .filter((l) => !l.is_group_header)
    .map((l, i) => {
      const amt = isUQ ? l.qty * l.unit_cost : l.amount;
      return `<tr>
        <td>${i + 1}</td>
        <td>${l.budget_code || ""}</td>
        <td>${l.description || ""}</td>
        ${isUQ ? `<td>${l.qty}</td><td>${l.uom}</td><td>$${l.unit_cost.toFixed(2)}</td>` : ""}
        <td>${fmt(amt)}</td>
        <td>${fmt(l.billed_to_date)}</td>
      </tr>`;
    })
    .join("");

  const revised = commitment.original_contract_amount + commitment.approved_change_orders;

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${typeLabel} #${commitment.number}</title>
    <style>
      body{font-family:Arial,sans-serif;font-size:9px;padding:20px;color:#111}
      h1{font-size:14px;margin-bottom:4px}
      .meta{color:#555;font-size:8px;margin-bottom:16px}
      .amounts{display:flex;gap:24px;margin-bottom:16px}
      .amt-block{background:#f9fafb;border:1px solid #e5e7eb;border-radius:4px;padding:6px 10px}
      .amt-label{font-size:7px;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;margin-bottom:2px}
      .amt-value{font-size:11px;font-weight:600}
      table{width:100%;border-collapse:collapse;margin-top:8px}
      th{background:#f3f4f6;text-align:left;padding:4px 6px;font-size:7px;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;border-bottom:1px solid #e5e7eb}
      td{padding:4px 6px;border-bottom:1px solid #f3f4f6;vertical-align:top}
      @media print{body{padding:0}}
    </style></head><body>
    <h1>${typeLabel} #${commitment.number}${commitment.title ? " — " + commitment.title : ""}</h1>
    <div class="meta">${commitment.contract_company || ""} &bull; ${commitment.status}</div>
    <div class="amounts">
      <div class="amt-block"><div class="amt-label">Original Contract</div><div class="amt-value">${fmt(commitment.original_contract_amount)}</div></div>
      <div class="amt-block"><div class="amt-label">Approved COs</div><div class="amt-value">${fmt(commitment.approved_change_orders)}</div></div>
      <div class="amt-block"><div class="amt-label">Revised Contract</div><div class="amt-value">${fmt(revised)}</div></div>
    </div>
    ${sovRows ? `<h2 style="font-size:11px;margin-bottom:6px">Schedule of Values</h2>
    <table><thead><tr>
      <th>#</th><th>Budget Code</th><th>Description</th>
      ${isUQ ? "<th>Qty</th><th>UOM</th><th>Unit Cost</th>" : ""}
      <th>Amount</th><th>Billed to Date</th>
    </tr></thead><tbody>${sovRows}</tbody></table>` : ""}
    </body></html>`;

  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;left:-9999px;top:-9999px;width:0;height:0;border:0;";
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) { document.body.removeChild(iframe); return; }
  doc.open(); doc.write(html); doc.close();
  setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => document.body.removeChild(iframe), 500);
  }, 300);
}

// ── Sub-components ────────────────────────────────────────────────────────────

function DetailField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500 mb-0.5">{label}</p>
      <div className="text-sm text-gray-900">{children}</div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="py-8 border-b border-gray-200 last:border-b-0">
      <h2 className="text-base font-semibold text-gray-900 mb-6">{title}</h2>
      {children}
    </div>
  );
}

function SsovPanel({
  status,
  invoiceContact,
  notifiedAt,
  submittedAt,
  committedAmount,
  items,
  busy,
  errorMessage,
  onNotify,
  onSubmit,
  onRevise,
  onApprove,
  editHref,
}: {
  status: string;
  invoiceContact: string;
  notifiedAt: string | null;
  submittedAt: string | null;
  committedAmount: number;
  items: SsovItem[];
  busy: boolean;
  errorMessage: string;
  onNotify: () => void;
  onSubmit: () => void;
  onRevise: () => void;
  onApprove: () => void;
  editHref: string;
}) {
  const allocated = items.reduce((sum, i) => sum + Number(i.amount || 0), 0);
  const remaining = committedAmount - allocated;
  const canEdit = status === "draft" || status === "revise_resubmit";
  const canNotify = canEdit && !!invoiceContact;
  const canSubmit = canEdit && Math.round(remaining * 100) === 0 && items.length > 0;
  const canReview = status === "under_review";

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              SSOV_STATUS_COLORS[status] ?? "bg-gray-100 text-gray-500"
            }`}
          >
            {SSOV_STATUS_LABELS[status] ?? status}
          </span>
          {invoiceContact ? (
            <span className="text-xs text-gray-500">
              Invoice Contact: <span className="text-gray-700">{invoiceContact}</span>
            </span>
          ) : (
            <span className="text-xs text-red-500">No invoice contact assigned</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {canNotify && (
            <button
              onClick={onNotify}
              disabled={busy}
              className="px-3 py-1.5 text-xs font-medium text-gray-700 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-60"
            >
              Send SSOV Notification
            </button>
          )}
          {canEdit && (
            <a
              href={editHref}
              className="px-3 py-1.5 text-xs font-medium text-gray-700 border border-gray-300 rounded hover:bg-gray-50"
            >
              Edit Subcontractor SOV
            </a>
          )}
          {canEdit && (
            <button
              onClick={onSubmit}
              disabled={busy || !canSubmit}
              title={
                !canSubmit
                  ? "Submit is disabled until Remaining to Allocate is $0.00"
                  : undefined
              }
              className="px-3 py-1.5 text-xs font-medium text-white bg-gray-900 rounded hover:bg-gray-700 disabled:opacity-60"
            >
              Submit
            </button>
          )}
          {canReview && (
            <button
              onClick={onRevise}
              disabled={busy}
              className="px-3 py-1.5 text-xs font-medium text-gray-700 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-60"
            >
              Return to Revise & Resubmit
            </button>
          )}
          {canReview && (
            <button
              onClick={onApprove}
              disabled={busy}
              className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700 disabled:opacity-60"
            >
              Approve
            </button>
          )}
        </div>
      </div>

      {errorMessage && (
        <div className="mb-3 text-xs text-red-600 bg-red-50 border border-red-100 rounded px-3 py-2">
          {errorMessage}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <div className="bg-gray-50 border border-gray-100 rounded-lg p-4">
          <p className="text-xs font-medium text-gray-500 mb-1">Committed Amount</p>
          <p className="text-base font-semibold text-gray-900 tabular-nums">{fmt(committedAmount)}</p>
        </div>
        <div className="bg-gray-50 border border-gray-100 rounded-lg p-4">
          <p className="text-xs font-medium text-gray-500 mb-1">Allocated</p>
          <p className="text-base font-semibold text-gray-900 tabular-nums">{fmt(allocated)}</p>
        </div>
        <div
          className={`border rounded-lg p-4 ${
            Math.round(remaining * 100) === 0
              ? "bg-green-50 border-green-100"
              : "bg-amber-50 border-amber-100"
          }`}
        >
          <p className="text-xs font-medium text-gray-500 mb-1">Remaining to Allocate</p>
          <p className="text-base font-semibold text-gray-900 tabular-nums">{fmt(remaining)}</p>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-gray-400">No subcontractor detail lines yet.</p>
      ) : (
        <div className="border border-gray-200 rounded overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-3 py-2 text-left font-medium text-gray-500 w-10">#</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">Budget Code</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">Description</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={item.id} className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50">
                  <td className="px-3 py-2 text-gray-400">{idx + 1}</td>
                  <td className="px-3 py-2 text-gray-700">{item.budget_code || "—"}</td>
                  <td className="px-3 py-2 text-gray-700">{item.description || "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-900">{fmt(item.amount)}</td>
                </tr>
              ))}
              <tr className="bg-gray-50 border-t border-gray-200 font-semibold">
                <td colSpan={3} className="px-3 py-2 text-right text-gray-700">Allocated</td>
                <td className="px-3 py-2 text-right tabular-nums text-gray-900">{fmt(allocated)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {(notifiedAt || submittedAt) && (
        <p className="mt-3 text-[11px] text-gray-400">
          {notifiedAt && <>Notification sent {new Date(notifiedAt).toLocaleString()}. </>}
          {submittedAt && <>Last submitted {new Date(submittedAt).toLocaleString()}.</>}
        </p>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function CommitmentDetailClient({
  projectId,
  commitmentId,
  username,
}: {
  projectId: string;
  commitmentId: string;
  role: string;
  username: string;
}) {
  const [commitment, setCommitment] = useState<Commitment | null>(null);
  const [sovItems, setSovItems] = useState<SovItem[]>([]);
  const [ssovItems, setSsovItems] = useState<SsovItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [ssovBusy, setSsovBusy] = useState(false);
  const [ssovError, setSsovError] = useState<string>("");
  const [activeTab, setActiveTab] = useState<DetailTab>("general");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [qbSyncing, setQbSyncing] = useState(false);
  const [qbSyncMsg, setQbSyncMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [changeHistory, setChangeHistory] = useState<ChangeHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [relatedItems, setRelatedItems] = useState<Array<{ id: string; type: string; label: string; notes: string }>>([]);
  const [relatedType, setRelatedType] = useState("Change Event");
  const [relatedLabel, setRelatedLabel] = useState("");
  const [relatedNotes, setRelatedNotes] = useState("");

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/commitments/${commitmentId}`, { method: "DELETE" });
      if (res.ok) {
        window.location.href = `/projects/${projectId}/commitments`;
      } else {
        const { error } = await res.json().catch(() => ({ error: "Delete failed" }));
        alert(error || "Delete failed");
        setDeleting(false);
        setShowDeleteConfirm(false);
      }
    } catch {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  async function handleSyncToQBO() {
    setQbSyncing(true);
    setQbSyncMsg(null);
    setCommitment((c) => (c ? { ...c, erp_status: "pending" } : c));
    try {
      const res = await fetch("/api/integrations/quickbooks/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordType: "commitments", recordId: commitmentId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCommitment((c) => (c ? { ...c, erp_status: "not_synced" } : c));
        setQbSyncMsg({ ok: false, text: data.error ?? "Sync failed" });
      } else {
        setCommitment((c) => (c ? { ...c, erp_status: "synced" } : c));
        setQbSyncMsg({ ok: true, text: "Synced to QuickBooks Online." });
      }
    } catch {
      setCommitment((c) => (c ? { ...c, erp_status: "not_synced" } : c));
      setQbSyncMsg({ ok: false, text: "Network error while syncing." });
    } finally {
      setQbSyncing(false);
    }
  }

  async function reloadCommitment() {
    const [c, ssov] = await Promise.all([
      fetch(`/api/projects/${projectId}/commitments/${commitmentId}`).then((r) => r.json()),
      fetch(`/api/projects/${projectId}/commitments/${commitmentId}/ssov`).then((r) => r.json()),
    ]);
    setCommitment(c);
    setSsovItems(Array.isArray(ssov) ? ssov : []);
  }

  useEffect(() => {
    Promise.all([
      fetch(`/api/projects/${projectId}/commitments/${commitmentId}`).then((r) => r.json()),
      fetch(`/api/projects/${projectId}/commitments/${commitmentId}/sov`).then((r) => r.json()),
      fetch(`/api/projects/${projectId}/commitments/${commitmentId}/ssov`).then((r) => r.json()),
    ]).then(([c, sov, ssov]) => {
      setCommitment(c);
      setSovItems(Array.isArray(sov) ? sov : []);
      setSsovItems(Array.isArray(ssov) ? ssov : []);
      setLoading(false);
    });
  }, [projectId, commitmentId]);

  async function callSsovAction(action: "notify" | "submit" | "revise" | "approve") {
    setSsovBusy(true);
    setSsovError("");
    try {
      const res = await fetch(
        `/api/projects/${projectId}/commitments/${commitmentId}/ssov/${action}`,
        { method: "POST" }
      );
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: "Request failed" }));
        setSsovError(error || "Request failed");
        return;
      }
      await reloadCommitment();
    } finally {
      setSsovBusy(false);
    }
  }

  async function loadHistory() {
    if (historyLoaded || historyLoading) return;
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/commitments/${commitmentId}/history`);
      if (res.ok) {
        const data = await res.json();
        setChangeHistory(Array.isArray(data) ? data : []);
        setHistoryLoaded(true);
      }
    } finally {
      setHistoryLoading(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center">
        <p className="text-sm text-gray-400">Loading…</p>
      </div>
    );
  }

  if (!commitment) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center">
        <p className="text-sm text-gray-500">Commitment not found.</p>
      </div>
    );
  }

  const typeLabel = commitment.type === "purchase_order" ? "Purchase Order" : "Subcontract";
  const revised = commitment.original_contract_amount + commitment.approved_change_orders;

  const statusCls = STATUS_COLORS[commitment.status] ?? "bg-gray-100 text-gray-500";
  const statusLabel =
    commitment.status === "approved"
      ? "Approved"
      : commitment.status === "void"
      ? "Void"
      : commitment.status === "terminated"
      ? "Terminated"
      : "Draft";

  const erpColor = ERP_COLORS[commitment.erp_status] ?? "text-gray-400";
  const erpLabel = ERP_LABELS[commitment.erp_status] ?? commitment.erp_status;

  const sovMethod = commitment.sov_accounting_method;
  const sovTotal = sovItems
    .filter((l) => !l.is_group_header)
    .reduce((sum, l) => sum + (sovMethod === "unit_quantity" ? l.qty * l.unit_cost : l.amount), 0);

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      {/* Header */}
      <header className="bg-[#F9FAFB] border-b border-black/[0.06] px-6 h-14 flex items-center justify-between">
        <a
          href="/dashboard"
          className="text-sm font-semibold text-gray-900 hover:text-gray-600 transition-colors"
        >
          SiteCommand
        </a>
        <div className="flex items-center gap-5">
          <span className="text-sm text-gray-400">{username}</span>
          <button
            onClick={handleLogout}
            className="text-sm text-gray-400 hover:text-gray-900 transition-colors"
          >
            Logout
          </button>
        </div>
      </header>

      <ProjectNav projectId={projectId} />

      {/* Page header bar */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
        <div className="px-4 sm:px-8 py-3 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-3 min-w-0 flex-wrap">
            <a
              href={`/projects/${projectId}/commitments`}
              className="text-sm text-gray-400 hover:text-gray-700 transition-colors"
            >
              ← Commitments
            </a>
            <span className="text-gray-200">/</span>
            <h1 className="font-display text-[18px] leading-tight text-[color:var(--ink)]">
              #{commitment.number} — {commitment.title || typeLabel}
            </h1>
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
              {typeLabel}
            </span>
            {commitment.sign_docusign && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200">
                DocuSign®
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSyncToQBO}
              disabled={qbSyncing}
              title="Push this commitment to QuickBooks Online"
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-[#2CA01C] rounded hover:bg-[#237d16] transition-colors disabled:opacity-50"
            >
              <svg className={`w-4 h-4 ${qbSyncing ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {qbSyncing ? "Syncing…" : "Sync to QuickBooks"}
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              disabled={commitment?.status === "approved"}
              title={commitment?.status === "approved" ? "Cannot delete an Approved contract. Change status first." : "Delete this contract"}
              className="px-4 py-1.5 text-sm font-medium text-red-600 border border-red-200 rounded hover:bg-red-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Delete
            </button>

            {/* Export dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowExportMenu((o) => !o)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 border border-gray-200 rounded hover:bg-gray-50 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Export
                <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform ${showExportMenu ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showExportMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-100 rounded-xl shadow-lg py-1 z-20">
                  <button
                    onClick={() => { exportCommitmentPDF(commitment, sovItems, typeLabel); setShowExportMenu(false); }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                  >
                    <svg className="w-4 h-4 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                    </svg>
                    Export as PDF
                  </button>
                  <button
                    onClick={() => { exportSovCSV(commitment, sovItems); setShowExportMenu(false); }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                  >
                    <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                    </svg>
                    Export SOV as CSV
                  </button>
                </div>
              )}
            </div>

            <a
              href={`/projects/${projectId}/commitments/${commitmentId}/edit`}
              className="px-4 py-1.5 text-sm font-medium text-white bg-gray-900 rounded hover:bg-gray-700 transition-colors"
            >
              Edit
            </a>
          </div>
        </div>
        {qbSyncMsg && (
          <div className={`px-4 sm:px-8 py-2 text-xs flex items-center justify-between border-t border-gray-100 ${qbSyncMsg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
            <span>{qbSyncMsg.text}</span>
            <button onClick={() => setQbSyncMsg(null)} className="opacity-60 hover:opacity-100 ml-3">✕</button>
          </div>
        )}
        {/* Tab bar */}
        <div className="px-8 flex items-center border-t border-gray-100 overflow-x-auto">
          {(
            [
              { key: "general", label: "General" },
              { key: "change_orders", label: "Change Orders" },
              { key: "invoices", label: "Invoices" },
              { key: "payments_issued", label: "Payments Issued" },
              { key: "related_items", label: "Related Items" },
              { key: "emails", label: "Emails" },
              { key: "change_history", label: "Change History" },
            ] as { key: DetailTab; label: string }[]
          ).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => {
                setActiveTab(key);
                if (key === "change_history") loadHistory();
              }}
              className={`py-2 px-4 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                activeTab === key
                  ? "border-orange-500 text-orange-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {label}
            </button>
          ))}
          {commitment.financial_markup_enabled ? (
            <button
              onClick={() => setActiveTab("financial_markup")}
              className={`py-2 px-4 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                activeTab === "financial_markup"
                  ? "border-orange-500 text-orange-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              Financial Markup
            </button>
          ) : (
            <span
              className="py-2 px-4 text-sm text-gray-300 cursor-not-allowed whitespace-nowrap"
              title="Enable Financial Markup in settings to access this tab"
            >
              Financial Markup
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-8">

        {/* ── Financial Markup Tab ── */}
        {activeTab === "financial_markup" && (
          <Section title="Financial Markup">
            <div className="mb-4 flex items-start gap-2 bg-blue-50 border border-blue-200 rounded px-4 py-3 text-xs text-blue-800">
              <svg className="w-4 h-4 shrink-0 mt-0.5 text-blue-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
              </svg>
              <div>
                <p className="font-medium mb-1">Financial Markup on Change Orders</p>
                <ul className="space-y-0.5 text-blue-700">
                  <li>Financial markup is distributed proportionally on each line item in a change order&apos;s Schedule of Values.</li>
                  <li>After applying financial markup to a commitment change order, the change order <strong>cannot be added to a subcontractor invoice</strong>.</li>
                  <li>To add markup to a change order, open the change order and use the Financial Markup section.</li>
                </ul>
              </div>
            </div>
            <p className="text-sm text-gray-500">
              Financial markup is configured per change order. Open a change order on this commitment to add horizontal or vertical markup rules.
            </p>
            <div className="mt-4">
              <a
                href={`/projects/${projectId}/commitments/${commitmentId}/change-orders/new`}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded hover:bg-gray-700 transition-colors"
              >
                Create Change Order with Markup
              </a>
            </div>
          </Section>
        )}

        {/* ── Placeholder tabs ── */}
        {(activeTab === "change_orders" || activeTab === "invoices" || activeTab === "payments_issued" || activeTab === "emails") && (
          <div className="py-16 text-center">
            <p className="text-sm text-gray-400">
              {activeTab === "change_orders" && "Change Orders"}
              {activeTab === "invoices" && "Invoices"}
              {activeTab === "payments_issued" && "Payments Issued"}
              {activeTab === "related_items" && "Related Items"}
              {activeTab === "emails" && "Emails"}
              {" "}— coming soon
            </p>
            <p className="text-xs text-gray-300 mt-1">This section will appear here when available.</p>
          </div>
        )}

        {activeTab === "related_items" && (
          <Section title="Related Items">
            {relatedItems.length === 0 ? (
              <p className="text-sm text-gray-500 mb-4">No related items yet.</p>
            ) : (
              <ul className="mb-4 space-y-2">
                {relatedItems.map((item) => (
                  <li key={item.id} className="rounded border border-gray-100 px-3 py-2 text-sm">
                    <p className="text-gray-900">{item.label}</p>
                    <p className="text-xs text-gray-500">{item.type}</p>
                    {item.notes ? <p className="text-xs text-gray-500 mt-1">{item.notes}</p> : null}
                  </li>
                ))}
              </ul>
            )}
            <div className="rounded border border-gray-200 bg-gray-50 p-3 space-y-3">
              <label className="block text-xs font-medium text-gray-700">
                Link Related Items
                <select
                  value={relatedType}
                  onChange={(e) => {
                    setRelatedType(e.target.value);
                    setRelatedLabel("");
                  }}
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm bg-white"
                >
                  <option>Change Event</option>
                  <option>RFI</option>
                  <option>Submittal</option>
                  <option>Transmittal</option>
                  <option>Punch Item</option>
                </select>
              </label>
              <label className="block text-xs font-medium text-gray-700">
                {`Select the ${relatedType}`}
                <input
                  value={relatedLabel}
                  onChange={(e) => setRelatedLabel(e.target.value)}
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                  placeholder={`Select the ${relatedType}`}
                />
              </label>
              {relatedLabel.trim() && (
                <label className="block text-xs font-medium text-gray-700">
                  Add Comment
                  <textarea
                    value={relatedNotes}
                    onChange={(e) => setRelatedNotes(e.target.value)}
                    className="mt-1 w-full min-h-16 rounded border border-gray-300 px-2 py-1.5 text-sm"
                    placeholder="Add comment..."
                  />
                </label>
              )}
            </div>
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                disabled={!relatedLabel.trim()}
                onClick={() => {
                  if (!relatedLabel.trim()) return;
                  setRelatedItems((prev) => [...prev, { id: `${Date.now()}`, type: relatedType, label: relatedLabel.trim(), notes: relatedNotes.trim() }]);
                  setRelatedLabel("");
                  setRelatedNotes("");
                }}
                className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
              >
                Add Related Item
              </button>
            </div>
          </Section>
        )}

        {/* ── Change History Tab ── */}
        {activeTab === "change_history" && (
          <div className="py-8">
            <p className="text-xs text-gray-500 mb-4">
              A non-deletable audit log of all modifications made to this commitment. Visible to Admins only.
            </p>
            {historyLoading ? (
              <p className="text-sm text-gray-400">Loading…</p>
            ) : changeHistory.length === 0 ? (
              <p className="text-sm text-gray-400">No change history recorded yet.</p>
            ) : (
              <div className="border border-gray-200 rounded overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-3 py-2 text-left font-medium text-gray-500 min-w-[200px]">Action</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500 min-w-[120px]">From</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500 min-w-[120px]">To</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500 min-w-[120px]">Changed By</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500 min-w-[160px]">Date &amp; Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {changeHistory.map((entry) => (
                      <tr key={entry.id} className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-900">{entry.action}</td>
                        <td className="px-3 py-2 text-gray-500">
                          {entry.from_value != null ? (
                            <span className="font-mono">{entry.from_value || <span className="text-gray-300 italic">empty</span>}</span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-gray-900">
                          {entry.to_value != null ? (
                            <span className="font-mono">{entry.to_value || <span className="text-gray-300 italic">empty</span>}</span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-gray-700">{entry.changed_by_name || "—"}</td>
                        <td className="px-3 py-2 text-gray-500">
                          {new Date(entry.created_at).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === "general" && (<>

        {/* ── General Information ── */}
        <Section title="General Information">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-6">
            <DetailField label="Contract #">
              {commitment.number}
            </DetailField>
            <DetailField label="Contract Company">
              {commitment.contract_company || <span className="text-gray-400">—</span>}
            </DetailField>
            <DetailField label="Title">
              {commitment.title || <span className="text-gray-400">—</span>}
            </DetailField>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-6">
            <DetailField label="Status">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusCls}`}>
                {statusLabel}
              </span>
            </DetailField>
            <DetailField label="Executed">
              {commitment.executed ? "Yes" : "No"}
            </DetailField>
            <DetailField label="Default Retainage">
              {commitment.default_retainage}%
            </DetailField>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-6">
            <DetailField label="ERP Status">
              <span className={`text-sm italic ${erpColor}`}>{erpLabel}</span>
            </DetailField>
            <DetailField label="SSOV Status">
              {commitment.ssov_enabled ? (
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    SSOV_STATUS_COLORS[commitment.ssov_status || "draft"]
                  }`}
                >
                  {SSOV_STATUS_LABELS[commitment.ssov_status || "draft"]}
                </span>
              ) : (
                <span className="text-gray-400">Not enabled</span>
              )}
            </DetailField>
          </div>
          {commitment.type === "purchase_order" && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-6">
              <DetailField label="Bill To">
                {commitment.bill_to || <span className="text-gray-400">—</span>}
              </DetailField>
              <DetailField label="Assigned To">
                {commitment.assigned_to || <span className="text-gray-400">—</span>}
              </DetailField>
              <DetailField label="Payment Terms">
                {commitment.payment_terms || <span className="text-gray-400">—</span>}
              </DetailField>
              <DetailField label="Ship To">
                {commitment.ship_to || <span className="text-gray-400">—</span>}
              </DetailField>
              <DetailField label="Ship Via">
                {commitment.ship_via || <span className="text-gray-400">—</span>}
              </DetailField>
            </div>
          )}
          {commitment.description && (
            <div className="mt-2">
              <p className="text-xs font-medium text-gray-500 mb-1">Description</p>
              <div
                className="text-sm text-gray-900 border border-gray-100 rounded p-3 bg-gray-50 prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: commitment.description }}
              />
            </div>
          )}
        </Section>

        {/* ── Financial Summary ── */}
        <Section title="Financial Summary">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {[
              { label: "Original Contract Amount", value: commitment.original_contract_amount },
              { label: "Approved Change Orders", value: commitment.approved_change_orders },
              { label: "Revised Contract Amount", value: revised },
              { label: "Pending Change Orders", value: commitment.pending_change_orders },
              { label: "Draft Amount", value: commitment.draft_amount },
            ].map(({ label, value }) => (
              <div key={label} className="bg-gray-50 border border-gray-100 rounded-lg p-4">
                <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
                <p className="text-base font-semibold text-gray-900 tabular-nums">{fmt(value)}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* ── Schedule of Values ── */}
        <Section title="Schedule of Values">
          <p className="text-xs text-gray-500 mb-4">
            Accounting method:{" "}
            <strong>{sovMethod === "unit_quantity" ? "Unit / Quantity" : "Amount"}</strong>
          </p>
          {sovItems.length === 0 ? (
            <p className="text-sm text-gray-400">No schedule of values items.</p>
          ) : (
            <div className="border border-gray-200 rounded overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-3 py-2 text-left font-medium text-gray-500 w-10">#</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">Change Event Line Item</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">Budget Code</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">Description</th>
                      {sovMethod === "unit_quantity" ? (
                        <>
                          <th className="px-3 py-2 text-right font-medium text-gray-500">Qty</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-500">UOM</th>
                          <th className="px-3 py-2 text-right font-medium text-gray-500">Unit Cost</th>
                        </>
                      ) : null}
                      <th className="px-3 py-2 text-right font-medium text-gray-500">Amount</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-500">Billed to Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sovItems.map((item, idx) =>
                      item.is_group_header ? (
                        <tr key={item.id} className="bg-gray-50 border-b border-gray-100">
                          <td colSpan={sovMethod === "unit_quantity" ? 9 : 6} className="px-3 py-2 font-semibold text-gray-700">
                            {item.group_name || "Group"}
                          </td>
                        </tr>
                      ) : (
                        <tr key={item.id} className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50">
                          <td className="px-3 py-2 text-gray-400">{idx + 1}</td>
                          <td className="px-3 py-2 text-gray-700">{item.change_event_line_item || "—"}</td>
                          <td className="px-3 py-2 text-gray-700">{item.budget_code || "—"}</td>
                          <td className="px-3 py-2 text-gray-700">{item.description || "—"}</td>
                          {sovMethod === "unit_quantity" ? (
                            <>
                              <td className="px-3 py-2 text-right tabular-nums text-gray-700">{item.qty}</td>
                              <td className="px-3 py-2 text-gray-500">{item.uom || "—"}</td>
                              <td className="px-3 py-2 text-right tabular-nums text-gray-700">{fmt(item.unit_cost)}</td>
                            </>
                          ) : null}
                          <td className="px-3 py-2 text-right tabular-nums text-gray-900 font-medium">
                            {fmt(sovMethod === "unit_quantity" ? item.qty * item.unit_cost : item.amount)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-gray-700">{fmt(item.billed_to_date)}</td>
                        </tr>
                      )
                    )}
                    <tr className="bg-gray-50 border-t border-gray-200 font-semibold">
                      <td colSpan={sovMethod === "unit_quantity" ? 7 : 4} className="px-3 py-2 text-gray-700 text-right">
                        Total
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-gray-900">{fmt(sovTotal)}</td>
                      <td />
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </Section>

        {/* ── Subcontractor SOV ── */}
        {commitment.ssov_enabled && (
          <Section title="Subcontractor SOV">
            {commitment.sov_accounting_method !== "amount" ? (
              <p className="text-sm text-gray-500">
                The Subcontractor SOV tab is only supported by the Amount Based accounting method.
              </p>
            ) : (
              <SsovPanel
                status={commitment.ssov_status || "draft"}
                invoiceContact={commitment.subcontractor_contact}
                notifiedAt={commitment.ssov_notified_at}
                submittedAt={commitment.ssov_submitted_at}
                committedAmount={commitment.original_contract_amount}
                items={ssovItems}
                busy={ssovBusy}
                errorMessage={ssovError}
                onNotify={() => callSsovAction("notify")}
                onSubmit={() => callSsovAction("submit")}
                onRevise={() => callSsovAction("revise")}
                onApprove={() => callSsovAction("approve")}
                editHref={`/projects/${projectId}/commitments/${commitmentId}/ssov`}
              />
            )}
          </Section>
        )}

        {/* ── Contract Dates ── */}
        <Section title="Contract Dates">
          {commitment.type === "purchase_order" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8">
              <DetailField label="Contract Date">
                {formatDate(commitment.contract_date ?? null)}
              </DetailField>
              <DetailField label="Delivery Date">
                {formatDate(commitment.delivery_date)}
              </DetailField>
              <DetailField label="Signed Purchase Order Received">
                {formatDate(commitment.signed_po_received_date)}
              </DetailField>
              <DetailField label="Issued On">
                {formatDate(commitment.issued_on_date ?? null)}
              </DetailField>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8">
              <DetailField label="Start Date">
                {formatDate(commitment.start_date ?? null)}
              </DetailField>
              <DetailField label="Estimated Completion">
                {formatDate(commitment.estimated_completion ?? null)}
              </DetailField>
              <DetailField label="Actual Completion">
                {formatDate(commitment.actual_completion ?? null)}
              </DetailField>
              <DetailField label="Signed Contract Received">
                {formatDate(commitment.signed_contract_received ?? null)}
              </DetailField>
            </div>
          )}
        </Section>

        {/* ── Contract Privacy ── */}
        <Section title="Contract Privacy">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8">
            <DetailField label="Private">
              {commitment.is_private ? "Yes" : "No"}
            </DetailField>
            <DetailField label="Allow Non-Admin Users to View SOV Items">
              {commitment.sov_view_allowed ? "Yes" : "No"}
            </DetailField>
          </div>
        </Section>

        {/* ── Additional Information ── */}
        <Section title="Additional Information">
          {commitment.type === "subcontract" ? (
            <div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
                <DetailField label="Cover Letter">
                  {commitment.subcontract_cover_letter || <span className="text-gray-400">—</span>}
                </DetailField>
                <DetailField label="Bond Amount">
                  {commitment.bond_amount > 0 ? fmt(commitment.bond_amount) : <span className="text-gray-400">—</span>}
                </DetailField>
                <DetailField label="Trades">
                  {commitment.trades || <span className="text-gray-400">—</span>}
                </DetailField>
                <DetailField label="Invoice Contact">
                  {commitment.subcontractor_contact || <span className="text-gray-400">—</span>}
                </DetailField>
              </div>
              {commitment.exhibit_a_scope && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Exhibit A — Scope of Work</p>
                  <div
                    className="text-sm text-gray-900 border border-gray-100 rounded p-3 bg-gray-50 prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: commitment.exhibit_a_scope }}
                  />
                </div>
              )}
              {(commitment.inclusions || commitment.exclusions) && (
                <div className="mt-4 grid grid-cols-1 gap-4">
                  {commitment.inclusions && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1">Inclusions — Scope of Work</p>
                      <div
                        className="text-sm text-gray-900 border border-gray-100 rounded p-3 bg-gray-50 prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{ __html: commitment.inclusions }}
                      />
                    </div>
                  )}
                  {commitment.exclusions && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1">Exclusions</p>
                      <div
                        className="text-sm text-gray-900 border border-gray-100 rounded p-3 bg-gray-50 prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{ __html: commitment.exclusions }}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-4">
                <DetailField label="Contract Type">
                  {commitment.subcontract_type
                    ? commitment.subcontract_type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
                    : <span className="text-gray-400">—</span>}
                </DetailField>
                <DetailField label="Show Cover Letter">
                  {commitment.show_cover_letter ? "Yes" : "No"}
                </DetailField>
                <DetailField label="Show Executed Cover Letter">
                  {commitment.show_executed_cover_letter ? "Yes" : "No"}
                </DetailField>
                <DetailField label="Financial Markup Enabled">
                  {commitment.financial_markup_enabled ? (
                    <span className="text-green-600 font-medium">Enabled</span>
                  ) : (
                    <span className="text-gray-400">Disabled</span>
                  )}
                </DetailField>
              </div>
            </div>
          )}
        </Section>

        {/* close activeTab === "general" fragment */}
        </>)}

      </div>

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-2">Delete {typeLabel}?</h2>
            <p className="text-sm text-gray-600 mb-1">
              This will permanently move <strong>#{commitment.number} — {commitment.title || typeLabel}</strong> to the Recycle Bin.
            </p>
            <p className="text-xs text-red-600 mb-6">This action cannot be undone.</p>
            {commitment.erp_status === "synced" && (
              <div className="mb-4 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                This contract is synced with an ERP system. Please follow your ERP integration guide before deleting.
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded hover:bg-red-700 disabled:opacity-60"
              >
                {deleting ? "Deleting…" : "OK — Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
