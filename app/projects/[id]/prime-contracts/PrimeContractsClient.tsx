"use client";

import { Fragment, useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import ProjectNav from "@/components/ProjectNav";
import AppHeader from "@/app/components/AppHeader";
import { Settings, Plus, ChevronDown, ChevronRight, Search, SlidersHorizontal, Columns3, Upload, X, Loader2 } from "lucide-react";

type PrimeContract = {
  id: string;
  contract_number: number;
  title: string;
  owner_client: string;
  contractor: string;
  status: string;
  erp_status: string | null;
  executed: boolean;
  original_contract_amount: number;
  approved_change_orders: number;
  pending_change_orders: number;
  draft_change_orders: number;
  invoiced: number;
  payments_received: number;
  is_private: boolean;
  attachments_count?: number;
};

type PrimePco = {
  id: string;
  prime_contract_id: string | null;
  number: string | null;
  title: string | null;
  status: string | null;
  amount: number | null;
};

type ImportFields = {
  contract_number?: string | null;
  title?: string | null;
  owner_client?: string | null;
  contractor?: string | null;
  architect_engineer?: string | null;
  status?: string | null;
  executed?: boolean | null;
  default_retainage?: number | null;
  original_contract_amount?: number | null;
  description?: string | null;
  inclusions?: string | null;
  exclusions?: string | null;
  start_date?: string | null;
  estimated_completion_date?: string | null;
  actual_completion_date?: string | null;
  signed_contract_received_date?: string | null;
  contract_termination_date?: string | null;
};

type PrimeContractSettings = {
  number_of_change_order_tiers: number;
  allow_standard_users_create_pccos: boolean;
  allow_standard_users_create_pcos: boolean;
  enable_always_editable_sov: boolean;
  show_financial_markup_on_change_order_pdf: boolean;
  show_financial_markup_on_invoice_exports: boolean;
  default_prime_contract_user_id: string | null;
  default_prime_contract_change_order_user_id: string | null;
  default_prime_contract_potential_change_order_user_id: string | null;
};

type ProjectMember = {
  user_id: string;
  users: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    username: string | null;
    email: string | null;
  } | null;
};

function fmt(val: number | null | undefined) {
  if (val == null) return "$0.00";
  return val.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
}

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  const dt = new Date(d + "T00:00:00");
  return isNaN(dt.getTime()) ? d : dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    Draft: "border-gray-400 text-gray-600",
    "Out for Bid": "border-yellow-500 text-yellow-600",
    "Out for Signature": "border-blue-400 text-blue-600",
    Approved: "border-green-500 text-green-600",
    Complete: "border-blue-500 text-blue-600",
    Terminated: "border-red-400 text-red-600",
  };
  const cls = map[status] ?? "border-gray-400 text-gray-600";
  return (
    <span className={`px-2 py-0.5 rounded border text-[11px] font-medium bg-white ${cls}`}>
      {status}
    </span>
  );
}

const COLUMNS = [
  { key: "number",                   label: "Number",                          right: false },
  { key: "owner_client",             label: "Owner/Client",                    right: false },
  { key: "title",                    label: "Title",                           right: false },
  { key: "erp_status",               label: "ERP Status",                      right: false },
  { key: "status",                   label: "Status",                          right: false },
  { key: "executed",                 label: "Executed",                        right: false },
  { key: "original_contract_amount", label: "Original\nContract\nAmount",      right: true  },
  { key: "approved_change_orders",   label: "Approved\nChange Orders",         right: true  },
  { key: "revised_contract_amount",  label: "Revised\nContract\nAmount",       right: true  },
  { key: "pending_change_orders",    label: "Pending Change\nOrders",          right: true  },
  { key: "draft_change_orders",      label: "Draft Change\nOrders",            right: true  },
  { key: "invoiced",                 label: "Invoiced",                        right: true  },
  { key: "payments_received",        label: "Payments\nReceived",              right: true  },
  { key: "pct_paid",                 label: "%\nPaid",                         right: true  },
  { key: "remaining_balance",        label: "Remaining\nBalance\nOutstanding", right: true  },
  { key: "private",                  label: "Private",                         right: false },
  { key: "attachments",              label: "Attach-\nments",                  right: true  },
];

export default function PrimeContractsClient({
  projectId,
  role,
  username,
}: {
  projectId: string;
  role: string;
  username: string;
}) {
  const router = useRouter();
  const [contracts, setContracts] = useState<PrimeContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedOwnerClient, setSelectedOwnerClient] = useState("");
  const [selectedErpStatus, setSelectedErpStatus] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [selectedExecuted, setSelectedExecuted] = useState("");

  // Sage sync
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [expandedContractIds, setExpandedContractIds] = useState<Set<string>>(new Set());
  const [primePcosByContract, setPrimePcosByContract] = useState<Record<string, PrimePco[]>>({});
  const [loadingContractPcos, setLoadingContractPcos] = useState<Set<string>>(new Set());

  async function toggleContractExpansion(e: React.MouseEvent, contractId: string) {
    e.stopPropagation();
    const isExpanded = expandedContractIds.has(contractId);
    setExpandedContractIds((prev) => {
      const next = new Set(prev);
      if (isExpanded) next.delete(contractId);
      else next.add(contractId);
      return next;
    });

    if (isExpanded || primePcosByContract[contractId] || loadingContractPcos.has(contractId)) return;

    setLoadingContractPcos((prev) => new Set(prev).add(contractId));
    try {
      const res = await fetch(`/api/projects/${projectId}/change-orders?type=prime`);
      const data = await res.json();
      const pcos = (Array.isArray(data) ? data : []) as PrimePco[];
      const scoped = pcos.filter((pco) => pco.prime_contract_id === contractId);
      setPrimePcosByContract((prev) => ({ ...prev, [contractId]: scoped }));
    } catch {
      setPrimePcosByContract((prev) => ({ ...prev, [contractId]: [] }));
    } finally {
      setLoadingContractPcos((prev) => {
        const next = new Set(prev);
        next.delete(contractId);
        return next;
      });
    }
  }

  async function handleSyncToSage(e: React.MouseEvent, contract: PrimeContract) {
    e.stopPropagation();
    setSyncError(null);
    setSyncingId(contract.id);
    setContracts((prev) => prev.map((c) => c.id === contract.id ? { ...c, erp_status: "pending" } : c));

    const res = await fetch("/api/integrations/sage/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recordType: "prime_contracts", recordId: contract.id }),
    });
    const data = await res.json();
    setSyncingId(null);

    if (!res.ok) {
      setContracts((prev) => prev.map((c) => c.id === contract.id ? { ...c, erp_status: "not_synced" } : c));
      setSyncError(data.error ?? "Sync failed");
    } else {
      setContracts((prev) => prev.map((c) => c.id === contract.id ? { ...c, erp_status: "synced" } : c));
    }
  }

  // Export dropdown
  const exportRef = useRef<HTMLDivElement>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (exportRef.current && !exportRef.current.contains(e.target as Node))
        setShowExportMenu(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Import state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importState, setImportState] = useState<"idle" | "parsing" | "review" | "creating">("idle");
  const [importFields, setImportFields] = useState<ImportFields | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<PrimeContractSettings | null>(null);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsSuccess, setSettingsSuccess] = useState<string | null>(null);

  function loadContracts() {
    fetch(`/api/projects/${projectId}/prime-contracts`)
      .then((r) => r.json())
      .then((data) => {
        setContracts(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }

  useEffect(() => {
    loadContracts();
  }, [projectId]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    setImportError(null);
    setImportState("parsing");

    const form = new FormData();
    form.append("file", file);

    try {
      const res = await fetch(`/api/projects/${projectId}/prime-contracts/import`, {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to parse PDF");
      setImportFields(data.fields ?? {});
      setImportState("review");
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Failed to parse PDF");
      setImportState("idle");
    }
  }

  async function handleCreateFromImport() {
    if (!importFields) return;
    setImportState("creating");

    try {
      const res = await fetch(`/api/projects/${projectId}/prime-contracts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(importFields),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create contract");
      setImportState("idle");
      setImportFields(null);
      setLoading(true);
      loadContracts();
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Failed to create contract");
      setImportState("review");
    }
  }

  function closeImportModal() {
    setImportState("idle");
    setImportFields(null);
    setImportError(null);
  }

  async function openSettingsModal() {
    setShowSettings(true);
    setSettingsLoading(true);
    setSettingsError(null);
    setSettingsSuccess(null);
    try {
      const [settingsRes, membersRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/prime-contracts/settings`),
        fetch(`/api/projects/${projectId}/members`),
      ]);
      const settingsData = await settingsRes.json();
      const membersData = await membersRes.json();
      if (!settingsRes.ok) throw new Error(settingsData.error ?? "Failed to load settings");
      setSettings(settingsData);
      setMembers(Array.isArray(membersData) ? membersData : []);
    } catch (err) {
      setSettingsError(err instanceof Error ? err.message : "Failed to load settings");
    } finally {
      setSettingsLoading(false);
    }
  }

  async function saveSettings() {
    if (!settings) return;
    setSettingsSaving(true);
    setSettingsError(null);
    setSettingsSuccess(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/prime-contracts/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save settings");
      setSettingsSuccess("Settings updated.");
    } catch (err) {
      setSettingsError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSettingsSaving(false);
    }
  }

  function formatMemberName(member: ProjectMember) {
    const u = member.users;
    if (!u) return "Unknown user";
    const fullName = `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim();
    return fullName || u.username || u.email || "Unnamed user";
  }

  const ownerClientOptions = Array.from(new Set(contracts.map((c) => c.owner_client).filter(Boolean))).sort();
  const erpStatusOptions = Array.from(new Set(contracts.map((c) => c.erp_status).filter((s): s is string => Boolean(s)))).sort();
  const statusOptions = Array.from(new Set(contracts.map((c) => c.status).filter(Boolean))).sort();

  const filtered = contracts.filter((c) => {
    const q = search.toLowerCase();
    const matchesSearch = (
      !q ||
      String(c.contract_number ?? "").toLowerCase().includes(q) ||
      (c.title ?? "").toLowerCase().includes(q) ||
      (c.owner_client ?? "").toLowerCase().includes(q)
    );

    const matchesOwnerClient = !selectedOwnerClient || c.owner_client === selectedOwnerClient;
    const matchesErpStatus = !selectedErpStatus || (c.erp_status ?? "") === selectedErpStatus;
    const matchesStatus = !selectedStatus || c.status === selectedStatus;
    const matchesExecuted = !selectedExecuted || String(c.executed) === selectedExecuted;

    return matchesSearch && matchesOwnerClient && matchesErpStatus && matchesStatus && matchesExecuted;
  });

  function clearAllFilters() {
    setSelectedOwnerClient("");
    setSelectedErpStatus("");
    setSelectedStatus("");
    setSelectedExecuted("");
  }

  function exportCSV(items: PrimeContract[]) {
    const headers = [
      "Number",
      "Owner/Client",
      "Title",
      "ERP Status",
      "Status",
      "Executed",
      "Original Contract Amount",
      "Approved Change Orders",
      "Revised Contract Amount",
      "Pending Change Orders",
      "Draft Change Orders",
      "Invoiced",
      "Payments Received",
      "% Paid",
      "Remaining Balance",
    ];

    const rows = items.map((c) => {
      const original = c.original_contract_amount ?? 0;
      const approved = c.approved_change_orders ?? 0;
      const revised = original + approved;
      const payments = c.payments_received ?? 0;
      const pctPaid = revised > 0 ? ((payments / revised) * 100).toFixed(2) : "0.00";
      const remaining = revised - payments;
      return [
        c.contract_number,
        c.owner_client,
        c.title,
        c.erp_status ?? "",
        c.status,
        c.executed ? "Yes" : "No",
        original,
        approved,
        revised,
        c.pending_change_orders ?? 0,
        c.draft_change_orders ?? 0,
        c.invoiced ?? 0,
        payments,
        pctPaid + "%",
        remaining,
      ];
    });

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "prime-contracts.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function exportPDF(items: PrimeContract[]) {
    const rows = items
      .map((c) => {
        const original = c.original_contract_amount ?? 0;
        const approved = c.approved_change_orders ?? 0;
        const revised = original + approved;
        const payments = c.payments_received ?? 0;
        const pctPaid = revised > 0 ? ((payments / revised) * 100).toFixed(2) : "0.00";
        const remaining = revised - payments;
        return `<tr>
          <td>${c.contract_number}</td>
          <td>${c.owner_client ?? ""}</td>
          <td>${c.title ?? ""}</td>
          <td>${c.erp_status ?? ""}</td>
          <td>${c.status}</td>
          <td>${c.executed ? "Yes" : "No"}</td>
          <td>${fmt(original)}</td>
          <td>${fmt(approved)}</td>
          <td>${fmt(revised)}</td>
          <td>${fmt(c.pending_change_orders ?? 0)}</td>
          <td>${fmt(c.draft_change_orders ?? 0)}</td>
          <td>${fmt(c.invoiced ?? 0)}</td>
          <td>${fmt(payments)}</td>
          <td>${pctPaid}%</td>
          <td>${fmt(remaining)}</td>
        </tr>`;
      })
      .join("");

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Prime Contracts</title>
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
      <h1>Prime Contracts</h1>
      <table>
        <thead>
          <tr>
            <th>#</th><th>Owner/Client</th><th>Title</th><th>ERP</th><th>Status</th>
            <th>Executed</th><th>Original Amount</th><th>Approved COs</th>
            <th>Revised Amount</th><th>Pending COs</th><th>Draft COs</th>
            <th>Invoiced</th><th>Payments Received</th><th>% Paid</th><th>Remaining Balance</th>
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


  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <AppHeader username={username} />
      <ProjectNav projectId={projectId} />

      {/* Header */}
      <div className="flex items-end justify-between px-6 pt-8 pb-4 bg-gray-50 gap-4 flex-wrap">
        <div>
          <p className="eyebrow mb-2">Project · Cost</p>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-[28px] leading-tight text-[color:var(--ink)]">Prime Contracts</h1>
            <button
              onClick={openSettingsModal}
              className="text-gray-400 hover:text-gray-700 transition-colors"
              title="Prime Contract Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div ref={exportRef} className="relative">
            <button
              onClick={() => setShowExportMenu((o) => !o)}
              className="flex items-center gap-1 px-3 py-1.5 text-xs border border-gray-300 rounded text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Export <ChevronDown className={`w-3 h-3 transition-transform ${showExportMenu ? "rotate-180" : ""}`} />
            </button>
            {showExportMenu && (
              <div className="absolute right-0 mt-1 w-44 bg-white border border-gray-100 rounded-xl shadow-lg py-1 z-20">
                <button
                  onClick={() => { exportCSV(filtered); setShowExportMenu(false); }}
                  className="w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                  </svg>
                  Export as CSV
                </button>
                <button
                  onClick={() => { exportPDF(filtered); setShowExportMenu(false); }}
                  className="w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                  </svg>
                  Export as PDF
                </button>
              </div>
            )}
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1 px-3 py-1.5 text-xs border border-gray-300 rounded text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Upload className="w-3 h-3" />
            Import
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            className="hidden"
            onChange={handleFileChange}
          />
          <button
            onClick={() => router.push(`/projects/${projectId}/prime-contracts/new`)}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-[color:var(--ink)] rounded-md hover:bg-black transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-white shrink-0">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              placeholder="Search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-7 pr-3 py-1 text-xs border border-gray-300 rounded w-44 focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>
          <button
            onClick={() => setShowFilters(true)}
            className="flex items-center gap-1.5 px-3 py-1 text-xs border border-gray-300 rounded text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <SlidersHorizontal className="w-3 h-3" />
            Filters
          </button>
        </div>
        <div className="flex items-center gap-2">
          <select className="px-3 py-1 text-xs border border-gray-300 rounded text-gray-500 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 w-48">
            <option value="">Select a column to group</option>
            <option value="status">Status</option>
            <option value="owner_client">Owner/Client</option>
          </select>
          <button className="flex items-center gap-1.5 px-3 py-1 text-xs border border-gray-300 rounded text-gray-700 hover:bg-gray-50 transition-colors">
            <Columns3 className="w-3 h-3" />
            Configure
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="fixed inset-0 z-40">
          <button
            aria-label="Close filters"
            className="absolute inset-0 bg-black/10"
            onClick={() => setShowFilters(false)}
          />
          <div className="absolute left-0 top-0 h-full w-full max-w-sm bg-white border-r border-gray-200 shadow-xl">
            <div className="flex items-center justify-between px-4 py-4 border-b border-gray-200">
              <h2 className="text-3xl font-semibold text-gray-900">Filters</h2>
              <div className="flex items-center gap-4">
                <button
                  onClick={clearAllFilters}
                  className="text-lg font-semibold text-gray-900 hover:text-gray-700 transition-colors"
                >
                  Clear All Filters
                </button>
                <button onClick={() => setShowFilters(false)} className="text-gray-700 hover:text-gray-900">
                  <X className="w-7 h-7" />
                </button>
              </div>
            </div>

            <div className="p-4 space-y-5">
              <FilterSelect
                label="Owner/Client"
                value={selectedOwnerClient}
                onChange={setSelectedOwnerClient}
                options={ownerClientOptions}
              />
              <FilterSelect
                label="ERP Status"
                value={selectedErpStatus}
                onChange={setSelectedErpStatus}
                options={erpStatusOptions}
              />
              <FilterSelect
                label="Status"
                value={selectedStatus}
                onChange={setSelectedStatus}
                options={statusOptions}
              />
              <FilterSelect
                label="Executed"
                value={selectedExecuted}
                onChange={setSelectedExecuted}
                options={[
                  { label: "Yes", value: "true" },
                  { label: "No", value: "false" },
                ]}
              />
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-x-auto">
        {loading ? (
          <div className="text-center py-20 text-gray-400 text-sm">Loading contracts...</div>
        ) : (
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-gray-200 bg-white">
                <th className="w-6 px-2 py-2" />
                {COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    className={`px-2 py-2 font-medium text-gray-500 whitespace-pre-line leading-tight ${col.right ? "text-right" : "text-left"}`}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={COLUMNS.length + 1} className="text-center py-16 text-gray-400 text-sm">
                    No prime contracts found.
                  </td>
                </tr>
              ) : (
                <>
                  {filtered.map((contract) => {
                    const original = contract.original_contract_amount ?? 0;
                    const approved = contract.approved_change_orders ?? 0;
                    const revised = original + approved;
                    const pending = contract.pending_change_orders ?? 0;
                    const draft = contract.draft_change_orders ?? 0;
                    const invoiced = contract.invoiced ?? 0;
                    const payments = contract.payments_received ?? 0;
                    const pctPaid = revised > 0 ? ((payments / revised) * 100).toFixed(2) : "0.00";
                    const remaining = revised - payments;

                    const isExpanded = expandedContractIds.has(contract.id);
                    const pcos = primePcosByContract[contract.id] ?? [];
                    const isPcoLoading = loadingContractPcos.has(contract.id);

                    return (
                      <Fragment key={contract.id}>
                        <tr
                          className="border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer"
                          onClick={() => router.push(`/projects/${projectId}/prime-contracts/${contract.id}`)}
                        >
                          <td className="px-2 py-1.5 text-gray-400" onClick={(e) => toggleContractExpansion(e, contract.id)}>
                            <ChevronRight className={`w-3 h-3 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                          </td>
                        <td className="px-2 py-1.5 text-blue-600 hover:underline">
                          {contract.contract_number}
                        </td>
                        <td className="px-2 py-1.5 text-blue-600 hover:underline max-w-[9rem] truncate">
                          {contract.owner_client}
                        </td>
                        <td className="px-2 py-1.5 text-gray-700 max-w-[10rem] truncate">
                          {contract.title}
                        </td>
                        <td className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-2">
                            {contract.erp_status === "synced" ? (
                              <span className="flex items-center gap-1 text-xs italic text-green-600">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                Synced
                              </span>
                            ) : contract.erp_status === "pending" || syncingId === contract.id ? (
                              <span className="flex items-center gap-1 text-xs italic text-amber-500">
                                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                Pending
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-xs italic text-gray-400">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                Not Synced
                              </span>
                            )}
                            {contract.erp_status !== "synced" && syncingId !== contract.id && (
                              <button
                                onClick={(e) => handleSyncToSage(e, contract)}
                                className="text-[10px] text-gray-400 hover:text-gray-700 underline underline-offset-2 transition-colors"
                              >
                                Sync
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-2 py-1.5">
                          <StatusBadge status={contract.status} />
                        </td>
                        <td className="px-2 py-1.5 text-gray-700">{contract.executed ? "Yes" : "No"}</td>
                        <td className="px-2 py-1.5 text-right text-gray-700">{fmt(original)}</td>
                        <td className="px-2 py-1.5 text-right text-gray-700">{fmt(approved)}</td>
                        <td className="px-2 py-1.5 text-right text-gray-700">{fmt(revised)}</td>
                        <td className="px-2 py-1.5 text-right text-gray-700">{fmt(pending)}</td>
                        <td className="px-2 py-1.5 text-right text-gray-700">{fmt(draft)}</td>
                        <td className="px-2 py-1.5 text-right text-gray-700">{fmt(invoiced)}</td>
                        <td className="px-2 py-1.5 text-right text-gray-700">{fmt(payments)}</td>
                        <td className="px-2 py-1.5 text-right text-gray-700">{pctPaid}%</td>
                        <td className="px-2 py-1.5 text-right text-gray-700">{fmt(remaining)}</td>
                        <td className="px-2 py-1.5 text-gray-700">{contract.is_private ? "Yes" : "No"}</td>
                        <td className="px-2 py-1.5 text-right text-gray-700">{contract.attachments_count ?? 0}</td>
                        </tr>
                        {isExpanded && (
                          <tr className="border-b border-gray-100 bg-gray-50">
                            <td />
                            <td colSpan={COLUMNS.length} className="px-3 py-2">
                              {isPcoLoading ? (
                                <p className="text-xs text-gray-500">Loading associated prime contract PCOs…</p>
                              ) : pcos.length === 0 ? (
                                <p className="text-xs text-gray-500">No associated prime contract PCOs found.</p>
                              ) : (
                                <div className="space-y-1">
                                  {pcos.map((pco) => (
                                    <button
                                      key={pco.id}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        router.push(`/projects/${projectId}/change-orders/${pco.id}`);
                                      }}
                                      className="w-full text-left text-xs px-2 py-1 rounded border border-gray-200 bg-white hover:bg-gray-100 transition-colors"
                                    >
                                      PCO #{pco.number || "—"}: {pco.title || "Untitled"} · {pco.status || "Draft"} · {fmt(pco.amount)}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                  {(() => {
                    const totOriginal  = filtered.reduce((s, c) => s + (c.original_contract_amount ?? 0), 0);
                    const totApproved  = filtered.reduce((s, c) => s + (c.approved_change_orders ?? 0), 0);
                    const totRevised   = totOriginal + totApproved;
                    const totPending   = filtered.reduce((s, c) => s + (c.pending_change_orders ?? 0), 0);
                    const totDraft     = filtered.reduce((s, c) => s + (c.draft_change_orders ?? 0), 0);
                    const totInvoiced  = filtered.reduce((s, c) => s + (c.invoiced ?? 0), 0);
                    const totPayments  = filtered.reduce((s, c) => s + (c.payments_received ?? 0), 0);
                    const totPctPaid   = totRevised > 0 ? ((totPayments / totRevised) * 100).toFixed(2) : "0.00";
                    const totRemaining = totRevised - totPayments;
                    const totAttachments = filtered.reduce((s, c) => s + (c.attachments_count ?? 0), 0);
                    return (
                      <tr className="border-t-2 border-gray-300 bg-gray-50 font-semibold">
                        <td className="px-2 py-1.5" />
                        <td colSpan={6} className="px-2 py-1.5 text-gray-700">Totals</td>
                        <td className="px-2 py-1.5 text-right text-gray-900">{fmt(totOriginal)}</td>
                        <td className="px-2 py-1.5 text-right text-gray-900">{fmt(totApproved)}</td>
                        <td className="px-2 py-1.5 text-right text-gray-900">{fmt(totRevised)}</td>
                        <td className="px-2 py-1.5 text-right text-gray-900">{fmt(totPending)}</td>
                        <td className="px-2 py-1.5 text-right text-gray-900">{fmt(totDraft)}</td>
                        <td className="px-2 py-1.5 text-right text-gray-900">{fmt(totInvoiced)}</td>
                        <td className="px-2 py-1.5 text-right text-gray-900">{fmt(totPayments)}</td>
                        <td className="px-2 py-1.5 text-right text-gray-900">{totPctPaid}%</td>
                        <td className="px-2 py-1.5 text-right text-gray-900">{fmt(totRemaining)}</td>
                        <td className="px-2 py-1.5" />
                        <td className="px-2 py-1.5 text-right text-gray-900">{totAttachments}</td>
                      </tr>
                    );
                  })()}
                </>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Sage sync error toast */}
      {syncError && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-red-600 text-white text-sm px-4 py-3 rounded-lg shadow-lg max-w-sm">
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <span className="flex-1">Sage sync failed: {syncError}</span>
          <button onClick={() => setSyncError(null)} className="text-white/70 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Parsing overlay */}
      {importState === "parsing" && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl px-8 py-6 flex flex-col items-center gap-3">
            <Loader2 className="w-6 h-6 text-orange-500 animate-spin" />
            <p className="text-sm font-medium text-gray-700">Parsing PDF…</p>
            <p className="text-xs text-gray-400">Extracting contract fields with AI</p>
          </div>
        </div>
      )}

      {/* Review modal */}
      {(importState === "review" || importState === "creating") && importFields && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-200">
              <h2 className="text-sm font-semibold text-gray-900">Review Imported Contract</h2>
              <button onClick={closeImportModal} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Fields */}
            <div className="overflow-y-auto px-5 py-4 flex-1">
              {importError && (
                <div className="mb-4 px-3 py-2 bg-red-50 border border-red-200 rounded text-xs text-red-600">
                  {importError}
                </div>
              )}
              <p className="text-xs text-gray-500 mb-4">
                Review the fields extracted from the PDF. Click <strong>Create Contract</strong> to add it to the table.
              </p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-xs">
                <Field label="Contract #" value={importFields.contract_number} />
                <Field label="Title" value={importFields.title} />
                <Field label="Owner / Client" value={importFields.owner_client} />
                <Field label="Contractor" value={importFields.contractor} />
                <Field label="Architect / Engineer" value={importFields.architect_engineer} />
                <Field label="Status" value={importFields.status} />
                <Field label="Executed" value={importFields.executed == null ? null : importFields.executed ? "Yes" : "No"} />
                <Field label="Default Retainage" value={importFields.default_retainage == null ? null : `${importFields.default_retainage}%`} />
                <Field label="Original Contract Amount" value={importFields.original_contract_amount == null ? null : fmt(importFields.original_contract_amount)} />
                <Field label="Start Date" value={fmtDate(importFields.start_date)} />
                <Field label="Est. Completion" value={fmtDate(importFields.estimated_completion_date)} />
                <Field label="Actual Completion" value={fmtDate(importFields.actual_completion_date)} />
                <Field label="Signed Contract Received" value={fmtDate(importFields.signed_contract_received_date)} />
                <Field label="Termination Date" value={fmtDate(importFields.contract_termination_date)} />
              </div>
              {importFields.description && (
                <div className="mt-3">
                  <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-1">Description</p>
                  <p className="text-xs text-gray-700 whitespace-pre-wrap">{importFields.description}</p>
                </div>
              )}
              {importFields.inclusions && (
                <div className="mt-3">
                  <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-1">Inclusions</p>
                  <p className="text-xs text-gray-700 whitespace-pre-wrap">{importFields.inclusions}</p>
                </div>
              )}
              {importFields.exclusions && (
                <div className="mt-3">
                  <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-1">Exclusions</p>
                  <p className="text-xs text-gray-700 whitespace-pre-wrap">{importFields.exclusions}</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-200">
              <button
                onClick={closeImportModal}
                disabled={importState === "creating"}
                className="px-3 py-1.5 text-xs border border-gray-300 rounded text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateFromImport}
                disabled={importState === "creating"}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-gray-900 hover:bg-gray-700 text-white rounded font-medium transition-colors disabled:opacity-50"
              >
                {importState === "creating" && <Loader2 className="w-3 h-3 animate-spin" />}
                Create Contract
              </button>
            </div>
          </div>
        </div>
      )}

      {showSettings && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-[#f5f5f5] rounded-lg shadow-xl w-full max-w-6xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-300">
              <h2 className="text-3xl font-light text-gray-700">Prime Contract Settings</h2>
              <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {settingsLoading || !settings ? (
              <div className="p-8 text-sm text-gray-500">Loading settings...</div>
            ) : (
              <div className="p-4 text-sm text-gray-800">
                {settingsError && <div className="mb-3 px-3 py-2 border border-red-200 bg-red-50 text-red-700 rounded">{settingsError}</div>}
                {settingsSuccess && <div className="mb-3 px-3 py-2 border border-green-200 bg-green-50 text-green-700 rounded">{settingsSuccess}</div>}

                <section className="border-b border-orange-300 pb-4 mb-6">
                  <h3 className="text-xl font-medium mb-2">CONTRACT CONFIGURATION</h3>
                  <div className="grid grid-cols-[1fr_240px] gap-y-2 items-center text-[13px]">
                    <label>Number of Prime Contract Change Order Tiers:</label>
                    <select
                      className="border border-gray-300 bg-white px-2 py-1"
                      value={settings.number_of_change_order_tiers}
                      onChange={(e) => setSettings((prev) => prev ? ({ ...prev, number_of_change_order_tiers: Number(e.target.value) }) : prev)}
                    >
                      {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>

                    <label>Allow Standard Level Users to Create PCCOs:</label>
                    <input type="checkbox" checked={settings.allow_standard_users_create_pccos} onChange={(e) => setSettings((prev) => prev ? ({ ...prev, allow_standard_users_create_pccos: e.target.checked }) : prev)} />

                    <label>Allow Standard Level Users to Create PCOs:</label>
                    <input type="checkbox" checked={settings.allow_standard_users_create_pcos} onChange={(e) => setSettings((prev) => prev ? ({ ...prev, allow_standard_users_create_pcos: e.target.checked }) : prev)} />

                    <label>Enable Always Editable Schedule of Values:</label>
                    <input type="checkbox" checked={settings.enable_always_editable_sov} onChange={(e) => setSettings((prev) => prev ? ({ ...prev, enable_always_editable_sov: e.target.checked }) : prev)} />

                    <label>Show Financial Markup Application Criteria on Change Order PDF exports:</label>
                    <input type="checkbox" checked={settings.show_financial_markup_on_change_order_pdf} onChange={(e) => setSettings((prev) => prev ? ({ ...prev, show_financial_markup_on_change_order_pdf: e.target.checked }) : prev)} />
                  </div>
                </section>

                <section className="border-b border-orange-300 pb-4 mb-6">
                  <h3 className="text-xl font-medium mb-2">CONTRACT DATES</h3>
                  <div className="bg-blue-50 border-l-4 border-blue-500 px-3 py-2 text-[13px]">
                    The Prime Contracts Tool&apos;s Contract Dates Have Been Moved. Configure these in Company Admin.
                  </div>
                </section>

                <section className="border-b border-orange-300 pb-4 mb-6">
                  <h3 className="text-xl font-medium mb-2">CONTRACT INVOICE SETTINGS</h3>
                  <div className="grid grid-cols-[1fr_240px] gap-y-2 items-center text-[13px]">
                    <label>Show Financial Markup on Invoice PDF and CSV:</label>
                    <input type="checkbox" checked={settings.show_financial_markup_on_invoice_exports} onChange={(e) => setSettings((prev) => prev ? ({ ...prev, show_financial_markup_on_invoice_exports: e.target.checked }) : prev)} />
                  </div>
                </section>

                <section className="pb-4">
                  <h3 className="text-xl font-medium mb-2">DEFAULT DISTRIBUTIONS</h3>
                  <div className="grid grid-cols-[1fr_320px] gap-y-2 items-center text-[13px]">
                    <label>Prime Contract:</label>
                    <select
                      className="border border-gray-300 bg-white px-2 py-1"
                      value={settings.default_prime_contract_user_id ?? ""}
                      onChange={(e) => setSettings((prev) => prev ? ({ ...prev, default_prime_contract_user_id: e.target.value || null }) : prev)}
                    >
                      <option value="">Select A Person...</option>
                      {members.map((m) => <option key={m.user_id} value={m.user_id}>{formatMemberName(m)}</option>)}
                    </select>

                    <label>Prime Contract Change Order:</label>
                    <select
                      className="border border-gray-300 bg-white px-2 py-1"
                      value={settings.default_prime_contract_change_order_user_id ?? ""}
                      onChange={(e) => setSettings((prev) => prev ? ({ ...prev, default_prime_contract_change_order_user_id: e.target.value || null }) : prev)}
                    >
                      <option value="">Select A Person...</option>
                      {members.map((m) => <option key={`co-${m.user_id}`} value={m.user_id}>{formatMemberName(m)}</option>)}
                    </select>

                    <label>Prime Contract Potential Change Order:</label>
                    <select
                      className="border border-gray-300 bg-white px-2 py-1"
                      value={settings.default_prime_contract_potential_change_order_user_id ?? ""}
                      onChange={(e) => setSettings((prev) => prev ? ({ ...prev, default_prime_contract_potential_change_order_user_id: e.target.value || null }) : prev)}
                    >
                      <option value="">Select A Person...</option>
                      {members.map((m) => <option key={`pco-${m.user_id}`} value={m.user_id}>{formatMemberName(m)}</option>)}
                    </select>
                  </div>
                </section>

                <div className="mt-4 flex justify-end">
                  <button
                    onClick={saveSettings}
                    disabled={settingsSaving}
                    className="px-6 py-2 bg-gray-700 text-white rounded disabled:opacity-60"
                  >
                    {settingsSaving ? "Updating..." : "Update"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<string | { label: string; value: string }>;
}) {
  return (
    <div>
      <label className="block text-2xl font-semibold text-gray-900 mb-2">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-3 text-xl border border-gray-300 rounded-md text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
      >
        <option value="">Select Values</option>
        {options.map((option) => {
          const normalized = typeof option === "string" ? { value: option, label: option } : option;
          return (
            <option key={normalized.value} value={normalized.value}>
              {normalized.label}
            </option>
          );
        })}
      </select>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-gray-800 mt-0.5">{value ?? <span className="text-gray-400">—</span>}</p>
    </div>
  );
}
