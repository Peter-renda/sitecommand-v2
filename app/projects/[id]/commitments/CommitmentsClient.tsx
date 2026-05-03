"use client";

import { useState, useEffect, useRef } from "react";
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
  ssov_status: string;
  original_contract_amount: number;
  approved_change_orders: number;
  pending_change_orders: number;
  draft_amount: number;
  invoiced: number;
  payments_issued: number;
  sort_order: number;
  deleted_at: string | null;
  created_at: string;
};

type CommitmentFormData = {
  type: "subcontract" | "purchase_order";
  contract_company: string;
  title: string;
  erp_status: string;
  status: string;
  executed: boolean;
  ssov_status: string;
  original_contract_amount: string;
  approved_change_orders: string;
  pending_change_orders: string;
  draft_amount: string;
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

function numVal(s: string): number {
  const n = parseFloat(s.replace(/[^0-9.-]/g, ""));
  return isNaN(n) ? 0 : n;
}

const STATUS_COLORS: Record<string, string> = {
  approved: "bg-green-100 text-green-700",
  draft: "bg-gray-100 text-gray-500",
  void: "bg-red-50 text-red-500",
  terminated: "bg-orange-50 text-orange-600",
};

const ERP_STATUS_COLORS: Record<string, string> = {
  synced: "text-green-600",
  not_synced: "text-gray-400",
  pending: "text-amber-500",
};

function ErpStatusIcon({ status }: { status: string }) {
  const color = ERP_STATUS_COLORS[status] ?? "text-gray-400";
  const label =
    status === "synced" ? "Synced" : status === "pending" ? "Pending" : "Not Synced";
  return (
    <span className={`flex items-center gap-1 text-xs italic ${color}`}>
      <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
      {label}
    </span>
  );
}

// ── Export helpers ────────────────────────────────────────────────────────────

function exportCSV(items: Commitment[]) {
  const headers = [
    "Number",
    "Type",
    "Contract Company",
    "Title",
    "ERP Status",
    "Status",
    "Executed",
    "SSOV Status",
    "Original Contract Amount",
    "Approved Change Orders",
    "Revised Contract Amount",
    "Pending Change Orders",
    "Draft Amount",
    "Invoiced",
    "Payments Issued",
  ];

  const rows = items.map((item) => [
    item.number,
    item.type === "purchase_order" ? "Purchase Order" : "Subcontract",
    item.contract_company,
    item.title,
    item.erp_status,
    item.status,
    item.executed ? "Yes" : "No",
    item.ssov_status,
    item.original_contract_amount,
    item.approved_change_orders,
    item.original_contract_amount + item.approved_change_orders,
    item.pending_change_orders,
    item.draft_amount,
    item.invoiced,
    item.payments_issued,
  ]);

  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "commitments.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportPDF(items: Commitment[]) {
  const rows = items
    .map((item) => {
      const revised = item.original_contract_amount + item.approved_change_orders;
      return `<tr>
        <td>${item.number}</td>
        <td>${item.type === "purchase_order" ? "PO" : "SC"}</td>
        <td>${item.contract_company}</td>
        <td>${item.title}</td>
        <td>${item.erp_status}</td>
        <td>${item.status}</td>
        <td>${item.executed ? "Yes" : "No"}</td>
        <td>${fmt(item.original_contract_amount)}</td>
        <td>${fmt(item.approved_change_orders)}</td>
        <td>${fmt(revised)}</td>
        <td>${fmt(item.pending_change_orders)}</td>
        <td>${fmt(item.draft_amount)}</td>
        <td>${fmt(item.invoiced)}</td>
        <td>${fmt(item.payments_issued)}</td>
      </tr>`;
    })
    .join("");

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Commitments</title>
    <style>
      body { font-family: Arial, sans-serif; font-size: 9px; padding: 20px; }
      h1 { font-size: 14px; margin-bottom: 12px; }
      table { width: 100%; border-collapse: collapse; }
      th { background: #f3f4f6; text-align: left; padding: 5px 6px; font-size: 8px;
           text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280;
           border-bottom: 1px solid #e5e7eb; }
      td { padding: 5px 6px; border-bottom: 1px solid #f3f4f6; vertical-align: top; }
      tr:last-child td { border-bottom: none; }
      @media print { body { padding: 0; } }
    </style></head><body>
    <h1>Commitments</h1>
    <table>
      <thead>
        <tr>
          <th>#</th><th>Type</th><th>Company</th><th>Title</th><th>ERP</th>
          <th>Status</th><th>Executed</th><th>Original Amount</th>
          <th>Approved COs</th><th>Revised Amount</th>
          <th>Pending COs</th><th>Draft</th><th>Invoiced</th><th>Payments Issued</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    </body></html>`;

  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;left:-9999px;top:-9999px;width:0;height:0;border:0;";
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) { document.body.removeChild(iframe); return; }
  doc.open();
  doc.write(html);
  doc.close();
  setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => document.body.removeChild(iframe), 500);
  }, 300);
}

// ── Field helpers ─────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      {children}
    </div>
  );
}

function MoneyInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <input
      type="text"
      inputMode="decimal"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="0.00"
      className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
    />
  );
}

// ── Create / Edit Modal ───────────────────────────────────────────────────────

const emptyForm: CommitmentFormData = {
  type: "subcontract",
  contract_company: "",
  title: "",
  erp_status: "not_synced",
  status: "draft",
  executed: false,
  ssov_status: "",
  original_contract_amount: "",
  approved_change_orders: "",
  pending_change_orders: "",
  draft_amount: "",
};

function CommitmentModal({
  initial,
  defaultType,
  onConfirm,
  onCancel,
}: {
  initial?: Commitment;
  defaultType?: "subcontract" | "purchase_order";
  onConfirm: (data: CommitmentFormData) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<CommitmentFormData>(
    initial
      ? {
          type: initial.type,
          contract_company: initial.contract_company,
          title: initial.title,
          erp_status: initial.erp_status,
          status: initial.status,
          executed: initial.executed,
          ssov_status: initial.ssov_status,
          original_contract_amount:
            initial.original_contract_amount !== 0
              ? String(initial.original_contract_amount)
              : "",
          approved_change_orders:
            initial.approved_change_orders !== 0
              ? String(initial.approved_change_orders)
              : "",
          pending_change_orders:
            initial.pending_change_orders !== 0
              ? String(initial.pending_change_orders)
              : "",
          draft_amount:
            initial.draft_amount !== 0 ? String(initial.draft_amount) : "",
        }
      : { ...emptyForm, type: defaultType ?? "subcontract" }
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  function set<K extends keyof CommitmentFormData>(key: K, val: CommitmentFormData[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() && !form.contract_company.trim()) return;
    onConfirm(form);
  }

  const isEdit = !!initial;
  const typeLabel = form.type === "purchase_order" ? "Purchase Order" : "Subcontract";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">
            {isEdit ? `Edit ${typeLabel}` : `Create ${typeLabel}`}
          </h2>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-700 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-5">
          {/* Type toggle (only on create) */}
          {!isEdit && (
            <Field label="Type">
              <div className="flex gap-2">
                {(["subcontract", "purchase_order"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => set("type", t)}
                    className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                      form.type === t
                        ? "border-gray-900 bg-gray-900 text-white"
                        : "border-gray-200 text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {t === "purchase_order" ? "Purchase Order" : "Subcontract"}
                  </button>
                ))}
              </div>
            </Field>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Field label="Contract Company">
              <input
                type="text"
                value={form.contract_company}
                onChange={(e) => set("contract_company", e.target.value)}
                placeholder="e.g. Smith and Jennings, Inc."
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </Field>
            <Field label="Title">
              <input
                type="text"
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder="e.g. Sitework"
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                autoFocus
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Status">
              <select
                value={form.status}
                onChange={(e) => set("status", e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
              >
                <option value="draft">Draft</option>
                <option value="approved">Approved</option>
                <option value="void">Void</option>
                <option value="terminated">Terminated</option>
              </select>
            </Field>
            <Field label="ERP Status">
              <select
                value={form.erp_status}
                onChange={(e) => set("erp_status", e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
              >
                <option value="not_synced">Not Synced</option>
                <option value="synced">Synced</option>
                <option value="pending">Pending</option>
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="SSOV Status">
              <input
                type="text"
                value={form.ssov_status}
                onChange={(e) => set("ssov_status", e.target.value)}
                placeholder="e.g. Approved"
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </Field>
            <Field label="Executed">
              <div className="flex items-center h-[38px]">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.executed}
                    onChange={(e) => set("executed", e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                  />
                  <span className="text-sm text-gray-700">Contract has been executed</span>
                </label>
              </div>
            </Field>
          </div>

          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500 pt-1">
            Amounts
          </p>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Original Contract Amount">
              <MoneyInput
                value={form.original_contract_amount}
                onChange={(v) => set("original_contract_amount", v)}
              />
            </Field>
            <Field label="Approved Change Orders">
              <MoneyInput
                value={form.approved_change_orders}
                onChange={(v) => set("approved_change_orders", v)}
              />
            </Field>
            <Field label="Pending Change Orders">
              <MoneyInput
                value={form.pending_change_orders}
                onChange={(v) => set("pending_change_orders", v)}
              />
            </Field>
            <Field label="Draft Amount">
              <MoneyInput
                value={form.draft_amount}
                onChange={(v) => set("draft_amount", v)}
              />
            </Field>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-md bg-white hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-md hover:bg-gray-700 transition-colors"
            >
              {isEdit ? "Save Changes" : `Create ${typeLabel}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Restore Confirm Modal ─────────────────────────────────────────────────────

function RestoreModal({
  commitment,
  onConfirm,
  onCancel,
}: {
  commitment: Commitment;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        <h2 className="text-base font-semibold text-gray-900">Restore Commitment</h2>
        <p className="text-sm text-gray-500">
          Restore{" "}
          <span className="font-medium text-gray-900">
            {commitment.contract_company || commitment.title || `#${commitment.number}`}
          </span>{" "}
          back to the active Contracts list?
        </p>
        <div className="flex justify-end gap-3 pt-1">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-md bg-white hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-md hover:bg-gray-700 transition-colors"
          >
            Restore
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CommitmentsClient({
  projectId,
  role,
  username,
}: {
  projectId: string;
  role: string;
  username: string;
}) {
  const [items, setItems] = useState<Commitment[]>([]);
  const [deletedItems, setDeletedItems] = useState<Commitment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"contracts" | "recycle_bin">("contracts");

  // Search
  const [search, setSearch] = useState("");

  // Modal state
  const [editingItem, setEditingItem] = useState<Commitment | null>(null);
  const [restoringItem, setRestoringItem] = useState<Commitment | null>(null);

  // Dropdown refs
  const createRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);
  const tableSettingsRef = useRef<HTMLDivElement>(null);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Row action menu
  const [rowMenuId, setRowMenuId] = useState<string | null>(null);
  const rowMenuRef = useRef<HTMLDivElement>(null);

  // Sage sync
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<{ id: string; message: string } | null>(null);

  // Column & display management
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(new Set());
  const [sortConfig, setSortConfig] = useState<{ key: string; dir: "asc" | "desc" } | null>(null);
  const [rowHeight, setRowHeight] = useState<"small" | "medium" | "large">("medium");
  const [tableSettingsOpen, setTableSettingsOpen] = useState(false);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [filterType, setFilterType] = useState<"" | "subcontract" | "purchase_order">("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterExecuted, setFilterExecuted] = useState<"" | "yes" | "no">("");
  const [filterCompany, setFilterCompany] = useState("");

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (createRef.current && !createRef.current.contains(e.target as Node))
        setShowCreateMenu(false);
      if (exportRef.current && !exportRef.current.contains(e.target as Node))
        setShowExportMenu(false);
      if (tableSettingsRef.current && !tableSettingsRef.current.contains(e.target as Node))
        setTableSettingsOpen(false);
      if (rowMenuRef.current && !rowMenuRef.current.contains(e.target as Node))
        setRowMenuId(null);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    Promise.all([
      fetch(`/api/projects/${projectId}/commitments`).then((r) => r.json()),
      fetch(`/api/projects/${projectId}/commitments?deleted=true`).then((r) => r.json()),
    ]).then(([active, deleted]) => {
      setItems(Array.isArray(active) ? active : []);
      setDeletedItems(Array.isArray(deleted) ? deleted : []);
      setLoading(false);
    });
  }, [projectId]);

  async function handleEdit(data: CommitmentFormData) {
    if (!editingItem) return;
    const res = await fetch(
      `/api/projects/${projectId}/commitments/${editingItem.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contract_company: data.contract_company,
          title: data.title,
          erp_status: data.erp_status,
          status: data.status,
          executed: data.executed,
          ssov_status: data.ssov_status,
          original_contract_amount: numVal(data.original_contract_amount),
          approved_change_orders: numVal(data.approved_change_orders),
          pending_change_orders: numVal(data.pending_change_orders),
          draft_amount: numVal(data.draft_amount),
        }),
      }
    );
    if (res.ok) {
      const updated: Commitment = await res.json();
      setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
    }
    setEditingItem(null);
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/projects/${projectId}/commitments/${id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      const item = items.find((i) => i.id === id);
      if (item) {
        setItems((prev) => prev.filter((i) => i.id !== id));
        setDeletedItems((prev) => [
          { ...item, deleted_at: new Date().toISOString() },
          ...prev,
        ]);
      }
    }
    setRowMenuId(null);
  }

  async function handleRestore(item: Commitment) {
    const res = await fetch(
      `/api/projects/${projectId}/commitments/${item.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deleted_at: null }),
      }
    );
    if (res.ok) {
      const restored: Commitment = await res.json();
      setDeletedItems((prev) => prev.filter((i) => i.id !== item.id));
      setItems((prev) => [...prev, restored]);
    }
    setRestoringItem(null);
  }

  async function handleSyncToSage(item: Commitment) {
    setRowMenuId(null);
    setSyncError(null);
    setSyncingId(item.id);
    // Optimistically show pending
    setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, erp_status: "pending" } : i));

    const res = await fetch("/api/integrations/sage/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recordType: "commitments", recordId: item.id }),
    });
    const data = await res.json();
    setSyncingId(null);

    if (!res.ok) {
      setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, erp_status: "not_synced" } : i));
      setSyncError({ id: item.id, message: data.error ?? "Sync failed" });
    } else {
      setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, erp_status: "synced" } : i));
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }

  function matchesSearch(item: Commitment) {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      item.contract_company.toLowerCase().includes(q) ||
      item.title.toLowerCase().includes(q) ||
      String(item.number).includes(q)
    );
  }

  function applySort(arr: Commitment[]): Commitment[] {
    if (!sortConfig) return arr;
    const { key, dir } = sortConfig;
    return [...arr].sort((a, b) => {
      const aVal =
        key === "revised_contract_amount"
          ? a.original_contract_amount + a.approved_change_orders
          : (a as Record<string, unknown>)[key];
      const bVal =
        key === "revised_contract_amount"
          ? b.original_contract_amount + b.approved_change_orders
          : (b as Record<string, unknown>)[key];
      if (typeof aVal === "number" && typeof bVal === "number") {
        return dir === "asc" ? aVal - bVal : bVal - aVal;
      }
      return dir === "asc"
        ? String(aVal ?? "").localeCompare(String(bVal ?? ""))
        : String(bVal ?? "").localeCompare(String(aVal ?? ""));
    });
  }

  const visibleItems = applySort(
    activeTab === "contracts"
      ? items.filter((item) => {
          if (!matchesSearch(item)) return false;
          if (filterType && item.type !== filterType) return false;
          if (filterStatus && item.status !== filterStatus) return false;
          if (filterExecuted === "yes" && !item.executed) return false;
          if (filterExecuted === "no" && item.executed) return false;
          if (filterCompany && !item.contract_company.toLowerCase().includes(filterCompany.toLowerCase())) return false;
          return true;
        })
      : deletedItems.filter(matchesSearch)
  );

  type ColDef = { key: string; label: string; width: string; mandatory?: boolean };

  const ALL_COLS: ColDef[] = [
    { key: "number", label: "#", width: "w-24", mandatory: true },
    { key: "contract_company", label: "Contract Company", width: "min-w-[160px]", mandatory: true },
    { key: "title", label: "Title", width: "min-w-[140px]" },
    { key: "erp_status", label: "ERP Status", width: "min-w-[110px]" },
    { key: "status", label: "Status", width: "w-28" },
    { key: "executed", label: "Executed", width: "w-24" },
    { key: "ssov_status", label: "SSOV Status", width: "min-w-[120px]" },
    { key: "original_contract_amount", label: "Original Contract Amount", width: "min-w-[160px]" },
    { key: "approved_change_orders", label: "Approved Change Orders", width: "min-w-[155px]" },
    { key: "revised_contract_amount", label: "Revised Contract Amount", width: "min-w-[155px]" },
    { key: "pending_change_orders", label: "Pending Change Orders", width: "min-w-[150px]" },
    { key: "draft_amount", label: "Draft", width: "min-w-[100px]" },
    { key: "invoiced", label: "Invoiced", width: "min-w-[120px]" },
    { key: "payments_issued", label: "Payments Issued", width: "min-w-[130px]" },
  ];

  const COLS = ALL_COLS.filter((c) => c.mandatory || !hiddenCols.has(c.key));

  function renderCell(item: Commitment, key: string) {
    switch (key) {
      case "number":
        return (
          <a
            href={`/projects/${projectId}/commitments/${item.id}`}
            className="text-blue-600 font-medium hover:underline"
          >
            {item.number}
          </a>
        );
      case "contract_company":
        return (
          <span className="flex items-center gap-1 text-gray-900">
            {item.contract_company || <span className="text-gray-300">—</span>}
            {item.contract_company && (
              <svg
                className="w-3 h-3 text-gray-300 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
            )}
          </span>
        );
      case "title":
        return <span className="text-gray-700">{item.title || <span className="text-gray-300">—</span>}</span>;
      case "erp_status":
        return <ErpStatusIcon status={item.erp_status} />;
      case "status": {
        const cls = STATUS_COLORS[item.status] ?? "bg-gray-100 text-gray-500";
        const label =
          item.status === "approved"
            ? "Approved"
            : item.status === "void"
            ? "Void"
            : item.status === "terminated"
            ? "Terminated"
            : "Draft";
        return (
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cls}`}
          >
            {label}
          </span>
        );
      }
      case "executed":
        return (
          <span className="text-gray-700">{item.executed ? "Yes" : "No"}</span>
        );
      case "ssov_status":
        return (
          <span className="text-gray-500">{item.ssov_status || ""}</span>
        );
      case "original_contract_amount":
        return <span className="text-gray-900 tabular-nums">{fmt(item.original_contract_amount)}</span>;
      case "approved_change_orders":
        return <span className="text-gray-900 tabular-nums">{fmt(item.approved_change_orders)}</span>;
      case "revised_contract_amount": {
        const revised =
          item.original_contract_amount + item.approved_change_orders;
        return <span className="text-gray-900 tabular-nums">{fmt(revised)}</span>;
      }
      case "pending_change_orders":
        return <span className="text-gray-900 tabular-nums">{fmt(item.pending_change_orders)}</span>;
      case "draft_amount":
        return <span className="text-gray-900 tabular-nums">{fmt(item.draft_amount)}</span>;
      case "invoiced":
        return <span className="text-gray-900 tabular-nums">{fmt(item.invoiced)}</span>;
      case "payments_issued":
        return <span className="text-gray-900 tabular-nums">{fmt(item.payments_issued)}</span>;
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-6 h-14 flex items-center justify-between">
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

      <main className="px-6 py-8">
        {/* Title + actions */}
        <div className="flex items-end justify-between mb-6 gap-4 flex-wrap">
          <div className="min-w-0">
            <h1 className="font-display text-[32px] leading-[1.05] tracking-[-0.012em] text-[color:var(--ink)]">Commitments</h1>
            {items.length > 0 && (
              <p className="sec-sub mt-1.5">
                <span className="serif-italic text-[color:var(--brand-700)]">Across this project</span>
                <span className="sep">·</span>
                <span className="num" style={{ color: "var(--brand-500)" }}>{items.filter((i) => i.status === "approved").length}</span> approved
                <span className="sep">·</span>
                <span className="num">{items.filter((i) => i.status === "draft").length}</span> draft
                <span className="sep">·</span>
                <span className="num">{items.length}</span> total
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Export dropdown */}
            <div ref={exportRef} className="relative">
              <button
                onClick={() => setShowExportMenu((o) => !o)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-md bg-white hover:bg-gray-50 transition-colors"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
                Export
                <svg
                  className={`w-3.5 h-3.5 text-gray-400 transition-transform ${showExportMenu ? "rotate-180" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showExportMenu && (
                <div className="absolute right-0 mt-2 w-44 bg-white border border-gray-100 rounded-xl shadow-lg py-1 z-20">
                  <button
                    onClick={() => {
                      exportCSV(visibleItems);
                      setShowExportMenu(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
                  >
                    <svg
                      className="w-4 h-4 text-green-500"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Export as CSV
                  </button>
                  <button
                    onClick={() => {
                      exportPDF(visibleItems);
                      setShowExportMenu(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
                  >
                    <svg
                      className="w-4 h-4 text-red-400"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Export as PDF
                  </button>
                </div>
              )}
            </div>

            {/* Settings link */}
            <a
              href={`/projects/${projectId}/commitments/settings`}
              className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              Settings
            </a>

            {/* Create dropdown */}
            <div ref={createRef} className="relative">
              <button
                onClick={() => setShowCreateMenu((o) => !o)}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-md hover:bg-gray-700 transition-colors"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Create
                <svg
                  className={`w-3.5 h-3.5 transition-transform ${showCreateMenu ? "rotate-180" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showCreateMenu && (
                <div className="absolute right-0 mt-2 w-52 bg-white border border-gray-100 rounded-xl shadow-lg py-1 z-20">
                  <button
                    onClick={() => {
                      window.location.href = `/projects/${projectId}/commitments/new?type=subcontract`;
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
                  >
                    <svg
                      className="w-4 h-4 text-gray-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    Subcontract
                  </button>
                  <button
                    onClick={() => {
                      window.location.href = `/projects/${projectId}/commitments/new?type=purchase_order`;
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
                  >
                    <svg
                      className="w-4 h-4 text-gray-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                      />
                    </svg>
                    Purchase Order
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-5">
          <button
            onClick={() => setActiveTab("contracts")}
            className={`px-1 pb-3 mr-6 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "contracts"
                ? "border-gray-900 text-gray-900"
                : "border-transparent text-gray-400 hover:text-gray-700"
            }`}
          >
            Contracts
          </button>
          <button
            onClick={() => setActiveTab("recycle_bin")}
            className={`px-1 pb-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "recycle_bin"
                ? "border-gray-900 text-gray-900"
                : "border-transparent text-gray-400 hover:text-gray-700"
            }`}
          >
            Recycle Bin
            {deletedItems.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 text-xs rounded-full bg-gray-100 text-gray-500">
                {deletedItems.length}
              </span>
            )}
          </button>
        </div>

        {/* Search + filter bar */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="relative">
              <svg
                className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                type="text"
                placeholder="Search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900 w-48"
              />
            </div>
            <button
              onClick={() => setShowFilterPanel((o) => !o)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-md transition-colors ${
                showFilterPanel || filterType || filterStatus || filterExecuted || filterCompany
                  ? "border-orange-400 text-orange-600 bg-orange-50"
                  : "text-gray-600 border-gray-200 bg-white hover:bg-gray-50"
              }`}
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                />
              </svg>
              Filters
              {(filterType || filterStatus || filterExecuted || filterCompany) && (
                <span className="ml-0.5 w-4 h-4 rounded-full bg-gray-900 text-white text-[10px] flex items-center justify-center font-medium">
                  {[filterType, filterStatus, filterExecuted, filterCompany].filter(Boolean).length}
                </span>
              )}
            </button>
          </div>

          {/* Table Settings */}
          <div ref={tableSettingsRef} className="relative">
            <button
              onClick={() => setTableSettingsOpen((o) => !o)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-md bg-white hover:bg-gray-50 transition-colors"
            >
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
              Table Settings
            </button>
            {tableSettingsOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-100 rounded-xl shadow-lg z-20 p-4 space-y-4">
                {/* Row Height */}
                <div>
                  <div className="flex gap-2">
                    {(["small", "medium", "large"] as const).map((h) => (
                      <button
                        key={h}
                        onClick={() => setRowHeight(h)}
                        className={`flex-1 py-1 text-xs rounded border capitalize transition-colors ${
                          rowHeight === h
                            ? "border-gray-900 bg-gray-900 text-white"
                            : "border-gray-200 text-gray-600 hover:bg-gray-50"
                        }`}
                      >
                        {h}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Column Visibility */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">Columns</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setHiddenCols(new Set())}
                        className="text-[11px] text-gray-400 hover:text-gray-700"
                      >
                        Show All
                      </button>
                      <span className="text-gray-200">|</span>
                      <button
                        onClick={() => setHiddenCols(new Set(ALL_COLS.filter((c) => !c.mandatory).map((c) => c.key)))}
                        className="text-[11px] text-gray-400 hover:text-gray-700"
                      >
                        Reset
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    {ALL_COLS.map((col) => (
                      <label key={col.key} className={`flex items-center gap-2 cursor-pointer ${col.mandatory ? "opacity-50 cursor-not-allowed" : ""}`}>
                        <input
                          type="checkbox"
                          checked={!hiddenCols.has(col.key)}
                          disabled={col.mandatory}
                          onChange={(e) => {
                            setHiddenCols((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) next.delete(col.key);
                              else next.add(col.key);
                              return next;
                            });
                          }}
                          className="w-3.5 h-3.5 rounded border-gray-300 text-gray-900"
                        />
                        <span className="text-xs text-gray-700">{col.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Filter panel */}
        {showFilterPanel && (
          <div className="mb-4 p-3 bg-white border border-gray-200 rounded-lg flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Contract Company</label>
              <input
                type="text"
                value={filterCompany}
                onChange={(e) => setFilterCompany(e.target.value)}
                placeholder="Filter by company…"
                className="text-sm border border-gray-200 rounded px-2 py-1.5 w-44 focus:outline-none focus:ring-1 focus:ring-gray-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as typeof filterType)}
                className="text-sm border border-gray-200 rounded px-2 py-1.5 bg-white"
              >
                <option value="">All Types</option>
                <option value="subcontract">Subcontract</option>
                <option value="purchase_order">Purchase Order</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="text-sm border border-gray-200 rounded px-2 py-1.5 bg-white"
              >
                <option value="">All Statuses</option>
                <option value="draft">Draft</option>
                <option value="approved">Approved</option>
                <option value="processing">Processing</option>
                <option value="submitted">Submitted</option>
                <option value="out_for_bid">Out For Bid</option>
                <option value="out_for_signature">Out For Signature</option>
                <option value="complete">Complete</option>
                <option value="void">Void</option>
                <option value="terminated">Terminated</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Executed</label>
              <select
                value={filterExecuted}
                onChange={(e) => setFilterExecuted(e.target.value as typeof filterExecuted)}
                className="text-sm border border-gray-200 rounded px-2 py-1.5 bg-white"
              >
                <option value="">Any</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>
            {(filterType || filterStatus || filterExecuted || filterCompany) && (
              <button
                onClick={() => { setFilterType(""); setFilterStatus(""); setFilterExecuted(""); setFilterCompany(""); }}
                className="text-xs text-gray-400 hover:text-gray-700 pb-1.5"
              >
                Clear all
              </button>
            )}
          </div>
        )}

        {/* Table */}
        {loading ? (
          <p className="text-sm text-gray-400">Loading...</p>
        ) : (
          <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    {COLS.map((col) => {
                      const isSorted = sortConfig?.key === col.key;
                      return (
                        <th
                          key={col.key}
                          onClick={() =>
                            setSortConfig((prev) =>
                              prev?.key === col.key
                                ? prev.dir === "asc"
                                  ? { key: col.key, dir: "desc" }
                                  : null
                                : { key: col.key, dir: "asc" }
                            )
                          }
                          className={`text-left px-3 py-3 font-semibold text-gray-600 whitespace-nowrap cursor-pointer select-none hover:bg-gray-100 transition-colors ${col.width}`}
                        >
                          <span className="flex items-center gap-1">
                            {col.label}
                            <span className="text-gray-300">
                              {isSorted ? (
                                sortConfig?.dir === "asc" ? "↑" : "↓"
                              ) : (
                                <span className="opacity-0 group-hover:opacity-100">↕</span>
                              )}
                            </span>
                          </span>
                        </th>
                      );
                    })}
                    <th className="px-3 py-3 w-10" />
                  </tr>
                </thead>
                <tbody>
                  {visibleItems.length === 0 ? (
                    <tr>
                      <td
                        colSpan={COLS.length + 1}
                        className="px-3 py-16 text-center"
                      >
                        {activeTab === "recycle_bin" ? (
                          <p className="text-sm text-gray-400">
                            Recycle bin is empty
                          </p>
                        ) : (
                          <>
                            <p className="text-sm text-gray-400">
                              No commitments yet
                            </p>
                            <p className="text-xs text-gray-300 mt-1">
                              Click{" "}
                              <span className="font-medium">+ Create</span> to
                              add a Subcontract or Purchase Order
                            </p>
                          </>
                        )}
                      </td>
                    </tr>
                  ) : (
                    visibleItems.map((item) => (
                      <tr
                        key={item.id}
                        className="border-b border-gray-50 hover:bg-gray-50 transition-colors last:border-b-0 group"
                      >
                        {COLS.map((col) => (
                          <td
                            key={col.key}
                            className={`px-3 text-xs whitespace-nowrap ${rowHeight === "small" ? "py-1" : rowHeight === "large" ? "py-5" : "py-3"}`}
                          >
                            {renderCell(item, col.key)}
                          </td>
                        ))}
                        {/* Row action menu */}
                        <td className="px-3 py-3 relative">
                          <div
                            ref={
                              rowMenuId === item.id ? rowMenuRef : undefined
                            }
                          >
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setRowMenuId((prev) =>
                                  prev === item.id ? null : item.id
                                );
                              }}
                              className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-all"
                            >
                              <svg
                                className="w-4 h-4"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                              </svg>
                            </button>
                            {rowMenuId === item.id && (
                              <div className="absolute right-0 top-8 w-36 bg-white border border-gray-100 rounded-xl shadow-lg py-1 z-20">
                                {activeTab === "contracts" ? (
                                  <>
                                    <button
                                      onClick={() => {
                                        setEditingItem(item);
                                        setRowMenuId(null);
                                      }}
                                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      onClick={() => handleSyncToSage(item)}
                                      disabled={syncingId === item.id}
                                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2 disabled:opacity-50"
                                    >
                                      <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                      </svg>
                                      Sync to Sage
                                    </button>
                                    <button
                                      onClick={() => handleDelete(item.id)}
                                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                                    >
                                      Delete
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    onClick={() => {
                                      setRestoringItem(item);
                                      setRowMenuId(null);
                                    }}
                                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                                  >
                                    Restore
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {visibleItems.length > 0 && (() => {
                  const totalOriginal = visibleItems.reduce((s, i) => s + i.original_contract_amount, 0);
                  const totalApproved = visibleItems.reduce((s, i) => s + i.approved_change_orders, 0);
                  const totalRevised = totalOriginal + totalApproved;
                  const totalPending = visibleItems.reduce((s, i) => s + i.pending_change_orders, 0);
                  const totalDraft = visibleItems.reduce((s, i) => s + i.draft_amount, 0);
                  const totalInvoiced = visibleItems.reduce((s, i) => s + i.invoiced, 0);
                  const totalPayments = visibleItems.reduce((s, i) => s + i.payments_issued, 0);
                  const totals: Record<string, React.ReactNode> = {
                    number: <span className="font-semibold text-gray-700">Totals</span>,
                    contract_company: null,
                    title: null,
                    erp_status: null,
                    status: null,
                    executed: null,
                    ssov_status: null,
                    original_contract_amount: <span className="font-semibold tabular-nums">{fmt(totalOriginal)}</span>,
                    approved_change_orders: <span className="font-semibold tabular-nums">{fmt(totalApproved)}</span>,
                    revised_contract_amount: <span className="font-semibold tabular-nums">{fmt(totalRevised)}</span>,
                    pending_change_orders: <span className="font-semibold tabular-nums">{fmt(totalPending)}</span>,
                    draft_amount: <span className="font-semibold tabular-nums">{fmt(totalDraft)}</span>,
                    invoiced: <span className="font-semibold tabular-nums">{fmt(totalInvoiced)}</span>,
                    payments_issued: <span className="font-semibold tabular-nums">{fmt(totalPayments)}</span>,
                  };
                  return (
                    <tfoot>
                      <tr className="border-t-2 border-gray-200 bg-gray-50">
                        {COLS.map((col) => (
                          <td key={col.key} className="px-3 py-3 text-xs whitespace-nowrap">
                            {totals[col.key]}
                          </td>
                        ))}
                        <td className="px-3 py-3" />
                      </tr>
                    </tfoot>
                  );
                })()}
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Sage sync error toast */}
      {syncError && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-red-600 text-white text-sm px-4 py-3 rounded-lg shadow-lg max-w-sm">
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <span className="flex-1">Sage sync failed: {syncError.message}</span>
          <button onClick={() => setSyncError(null)} className="text-white/70 hover:text-white">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Modals */}
      {editingItem && (
        <CommitmentModal
          initial={editingItem}
          onConfirm={handleEdit}
          onCancel={() => setEditingItem(null)}
        />
      )}
      {restoringItem && (
        <RestoreModal
          commitment={restoringItem}
          onConfirm={() => handleRestore(restoringItem)}
          onCancel={() => setRestoringItem(null)}
        />
      )}
    </div>
  );
}
