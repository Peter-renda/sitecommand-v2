"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import ProjectNav from "@/components/ProjectNav";
import AppHeader from "@/app/components/AppHeader";
import { Plus, Mail, ChevronDown, ChevronRight, ArrowUp, ArrowDown, Maximize2, HelpCircle } from "lucide-react";

type SovItem = {
  id: string;
  budget_code: string;
  description: string;
  scheduled_value: number;
  work_completed_prev: number;
  work_completed_this_period: number;
  materials_stored: number;
  billed_to_date: number;
  retainage_pct: number;
  retainage_amount: number;
  sort_order: number;
};

type Contract = {
  id: string;
  contract_number: number;
  title: string;
  owner_client: string;
  contractor: string;
  architect_engineer: string;
  status: string;
  erp_status: string | null;
  executed: boolean;
  default_retainage: number;
  description: string;
  inclusions: string;
  exclusions: string;
  start_date: string | null;
  estimated_completion_date: string | null;
  actual_completion_date: string | null;
  signed_contract_received_date: string | null;
  contract_termination_date: string | null;
  is_private: boolean;
  sov_view_allowed: boolean;
  original_contract_amount: number;
  approved_change_orders: number;
  pending_change_orders: number;
  draft_change_orders: number;
  invoiced: number;
  payments_received: number;
  sov_items: SovItem[];
};

type ChangeOrder = {
  id: string;
  number: string;
  revision?: number;
  title: string;
  status: string;
  amount: number;
  date_initiated: string | null;
  due_date: string | null;
  designated_reviewer: string | null;
  executed?: boolean;
  change_reason?: string | null;
  prime_contract_change_order?: string | null;
};
type HistoryItem = {
  id: string;
  created_at: string;
  changed_by_name: string;
  action: string;
  from_value: string | null;
  to_value: string | null;
};

const STATUS_COLORS: Record<string, string> = {
  Draft: "border-gray-400 text-gray-600",
  "Out for Bid": "border-yellow-500 text-yellow-600",
  "Out for Signature": "border-blue-400 text-blue-600",
  Approved: "border-green-500 text-green-600",
  Complete: "border-blue-500 text-blue-600",
  Terminated: "border-red-400 text-red-600",
};

const CO_STATUS_COLORS: Record<string, string> = {
  Draft: "bg-gray-100 text-gray-600",
  "In Review": "bg-yellow-50 text-yellow-700",
  Approved: "bg-green-50 text-green-700",
  Rejected: "bg-red-50 text-red-600",
  Void: "bg-gray-100 text-gray-400",
};

function fmt(val: number | null | undefined) {
  if (val == null) return "$0.00";
  return val.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
}

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  const dt = new Date(d + "T00:00:00");
  return isNaN(dt.getTime()) ? d : dt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_COLORS[status] ?? "border-gray-400 text-gray-600";
  return (
    <span className={`px-2.5 py-0.5 rounded border text-xs font-medium bg-white ${cls}`}>
      {status}
    </span>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-0.5">{label}</p>
      <p className="text-sm text-gray-800">{value || <span className="text-gray-400">—</span>}</p>
    </div>
  );
}

function ContractSummaryTile({
  original,
  approvedCO,
  pendingCO,
  draftCO,
  invoiced,
  paymentsReceived,
  revised,
  pendingRevised,
  remaining,
  pctPaid,
}: {
  original: number;
  approvedCO: number;
  pendingCO: number;
  draftCO: number;
  invoiced: number;
  paymentsReceived: number;
  revised: number;
  pendingRevised: number;
  remaining: number;
  pctPaid: string;
}) {
  const [open, setOpen] = useState(true);

  type SummaryItem = { label: string; value: number; pct?: true };

  const rows: SummaryItem[][] = [
    [
      { label: "Original Contract Amount", value: original },
      { label: "Pending Change Orders", value: pendingCO },
      { label: "Invoices", value: invoiced },
      { label: "Payments Received", value: paymentsReceived },
    ],
    [
      { label: "Approved Change Orders", value: approvedCO },
      { label: "Pending Revised Contract Amount", value: pendingRevised },
      { label: "Remaining Balance", value: remaining },
      { label: "Percent Paid", value: parseFloat(pctPaid), pct: true },
    ],
    [
      { label: "Revised Contract Amount", value: revised },
      { label: "Draft Change Orders", value: draftCO },
    ],
  ];

  return (
    <div id="contract-summary" className="scroll-mt-2 bg-white border-b border-gray-200 px-8 py-5">
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 mb-4">
        {open ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
        <h2 className="text-sm font-semibold text-gray-900">Contract Summary</h2>
      </button>
      {open && (
        <div className="space-y-5">
          {rows.map((row, ri) => (
            <div key={ri} className="grid grid-cols-2 sm:grid-cols-4 gap-x-8">
              {row.map((item) => (
                <div key={item.label}>
                  <p className="text-xs font-semibold text-gray-800 mb-0.5">{item.label}</p>
                  <p className="text-sm text-gray-700">
                    {item.pct
                      ? `${(item.value ?? 0).toFixed(1)}%`
                      : `$ ${(item.value ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                  </p>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

type Tab = "general" | "change_orders" | "emails" | "change_history" | "financial_markup" | "advanced_settings";
type ChangeOrderSortKey = "number" | "revision" | "title" | "status" | "amount" | "date_initiated" | "due_date";
type SortDirection = "asc" | "desc";

const GENERAL_SECTIONS = [
  { id: "general-info", label: "General Information" },
  { id: "contract-summary", label: "Contract Summary" },
  { id: "schedule-of-values", label: "Schedule of Values" },
  { id: "inclusions-exclusions", label: "Inclusions & Exclusions" },
  { id: "contract-dates", label: "Contract Dates" },
  { id: "contract-privacy", label: "Contract Privacy" },
];

export default function PrimeContractDetailClient({
  projectId,
  contractId,
  role,
  username,
}: {
  projectId: string;
  contractId: string;
  role: string;
  username?: string;
}) {
  const router = useRouter();
  const [contract, setContract] = useState<Contract | null>(null);
  const [changeOrders, setChangeOrders] = useState<ChangeOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("general");
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("general-info");
  const [changeOrderSort, setChangeOrderSort] = useState<{ key: ChangeOrderSortKey; direction: SortDirection }>({
    key: "number",
    direction: "desc",
  });
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [executedFilters, setExecutedFilters] = useState<string[]>([]);
  const [reasonFilters, setReasonFilters] = useState<string[]>([]);
  const [typeFilters, setTypeFilters] = useState<string[]>([]);
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [generalInfoOpen, setGeneralInfoOpen] = useState(true);
  const [inclusionsOpen, setInclusionsOpen] = useState(true);
  const [datesOpen, setDatesOpen] = useState(true);
  const [privacyOpen, setPrivacyOpen] = useState(true);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [qbSyncing, setQbSyncing] = useState(false);
  const [qbSyncMsg, setQbSyncMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const filterMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/prime-contracts/${contractId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { setError(data.error); } else { setContract(data); }
        setLoading(false);
      })
      .catch(() => { setError("Failed to load contract."); setLoading(false); });

    fetch(`/api/projects/${projectId}/change-orders?type=prime`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setChangeOrders(data.filter((co: ChangeOrder & { prime_contract_id?: string }) => co.prime_contract_id === contractId));
        }
      })
      .catch(() => {});
  }, [projectId, contractId]);

  useEffect(() => {
    if (tab !== "change_history" || historyLoaded || historyLoading) return;
    setHistoryLoading(true);
    fetch(`/api/projects/${projectId}/prime-contracts/${contractId}/history`)
      .then((r) => r.json())
      .then((data) => {
        setHistory(Array.isArray(data) ? data : []);
        setHistoryLoaded(true);
      })
      .catch(() => {})
      .finally(() => setHistoryLoading(false));
  }, [tab, historyLoaded, historyLoading, projectId, contractId]);

  async function handleSyncToQBO() {
    setQbSyncing(true);
    setQbSyncMsg(null);
    setContract((c) => (c ? { ...c, erp_status: "pending" } : c));
    try {
      const res = await fetch("/api/integrations/quickbooks/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordType: "prime_contracts", recordId: contractId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setContract((c) => (c ? { ...c, erp_status: "not_synced" } : c));
        setQbSyncMsg({ ok: false, text: data.error ?? "Sync failed" });
      } else {
        setContract((c) => (c ? { ...c, erp_status: "synced" } : c));
        setQbSyncMsg({ ok: true, text: "Synced to QuickBooks Online." });
      }
    } catch {
      setContract((c) => (c ? { ...c, erp_status: "not_synced" } : c));
      setQbSyncMsg({ ok: false, text: "Network error while syncing." });
    } finally {
      setQbSyncing(false);
    }
  }

  // Track active sidebar section based on scroll position
  useEffect(() => {
    if (tab !== "general") return;
    const container = contentRef.current;
    if (!container) return;

    const handleScroll = () => {
      const sectionEls = GENERAL_SECTIONS.map((s) => ({
        id: s.id,
        el: container.querySelector(`#${s.id}`),
      }));
      for (let i = sectionEls.length - 1; i >= 0; i--) {
        const { id, el } = sectionEls[i];
        if (el && (el as HTMLElement).offsetTop - container.scrollTop <= 60) {
          setActiveSection(id);
          return;
        }
      }
      setActiveSection("general-info");
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, [tab]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (!filterMenuRef.current?.contains(e.target as Node)) {
        setFilterMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function scrollToSection(id: string) {
    setActiveSection(id);
    const container = contentRef.current;
    if (!container) return;
    const el = container.querySelector(`#${id}`);
    if (el) {
      (el as HTMLElement).scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex flex-col">
        <AppHeader username={username} />
        <ProjectNav projectId={projectId} />
        <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">Loading…</div>
      </div>
    );
  }

  if (error || !contract) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex flex-col">
        <AppHeader username={username} />
        <ProjectNav projectId={projectId} />
        <div className="flex-1 flex items-center justify-center text-red-500 text-sm">{error ?? "Contract not found."}</div>
      </div>
    );
  }

  const revised = (contract.original_contract_amount ?? 0) + (contract.approved_change_orders ?? 0);
  const pendingRevised = (contract.original_contract_amount ?? 0) + (contract.pending_change_orders ?? 0);
  const pctPaid = revised > 0 ? (((contract.payments_received ?? 0) / revised) * 100).toFixed(1) : "0.0";
  const remaining = revised - (contract.payments_received ?? 0);

  const sovItems = contract.sov_items ?? [];
  const sovTotal = sovItems.reduce((s, x) => s + (x.scheduled_value ?? 0), 0);
  const sovBilled = sovItems.reduce((s, x) => s + (x.billed_to_date ?? 0), 0);
  const sovRetainage = sovItems.reduce((s, x) => s + (x.retainage_amount ?? 0), 0);
  const sovRemaining = sovTotal - sovBilled;

  function toggleChangeOrderSort(key: ChangeOrderSortKey) {
    setChangeOrderSort((curr) => {
      if (curr.key === key) return { key, direction: curr.direction === "asc" ? "desc" : "asc" };
      return { key, direction: "asc" };
    });
  }

  function compareText(a: string | null | undefined, b: string | null | undefined) {
    return String(a || "").localeCompare(String(b || ""), undefined, { sensitivity: "base", numeric: true });
  }

  function compareNumber(a: number | null | undefined, b: number | null | undefined) {
    return Number(a ?? 0) - Number(b ?? 0);
  }

  function compareDate(a: string | null | undefined, b: string | null | undefined) {
    const aTime = a ? new Date(`${a}T00:00:00`).getTime() : 0;
    const bTime = b ? new Date(`${b}T00:00:00`).getTime() : 0;
    return aTime - bTime;
  }

  const sortedChangeOrders = [...changeOrders].sort((a, b) => {
    const base =
      changeOrderSort.key === "number"
        ? compareText(a.number, b.number)
        : changeOrderSort.key === "revision"
          ? compareNumber(a.revision, b.revision)
          : changeOrderSort.key === "title"
            ? compareText(a.title, b.title)
            : changeOrderSort.key === "status"
              ? compareText(a.status, b.status)
              : changeOrderSort.key === "amount"
                ? compareNumber(a.amount, b.amount)
                : changeOrderSort.key === "date_initiated"
                  ? compareDate(a.date_initiated, b.date_initiated)
                  : compareDate(a.due_date, b.due_date);
    return changeOrderSort.direction === "asc" ? base : -base;
  });

  const statusOptions = Array.from(new Set(changeOrders.map((co) => String(co.status || "").trim()).filter(Boolean)));
  const changeReasonOptions = Array.from(new Set(changeOrders.map((co) => String(co.change_reason || "").trim()).filter(Boolean)));
  const changeTypeOptions = Array.from(new Set(changeOrders.map((co) => String(co.prime_contract_change_order || "").trim()).filter(Boolean)));

  const filteredAndSortedChangeOrders = sortedChangeOrders.filter((co) => {
    if (statusFilters.length > 0 && !statusFilters.includes(co.status)) return false;
    if (executedFilters.length > 0) {
      const executedLabel = co.executed ? "Yes" : "No";
      if (!executedFilters.includes(executedLabel)) return false;
    }
    if (reasonFilters.length > 0 && !reasonFilters.includes(String(co.change_reason || "").trim())) return false;
    if (typeFilters.length > 0 && !typeFilters.includes(String(co.prime_contract_change_order || "").trim())) return false;
    return true;
  });

  function toggleFilterValue(value: string, selected: string[], setSelected: React.Dispatch<React.SetStateAction<string[]>>) {
    setSelected((prev) => (prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]));
  }

  const activeFilterCount = statusFilters.length + executedFilters.length + reasonFilters.length + typeFilters.length;

  function sortHeaderButton(label: string, sortKey: ChangeOrderSortKey, align: "left" | "right" = "left") {
    const active = changeOrderSort.key === sortKey;
    const isAsc = changeOrderSort.direction === "asc";

    return (
      <button
        type="button"
        onClick={() => toggleChangeOrderSort(sortKey)}
        className={`inline-flex items-center gap-1.5 text-[11px] font-semibold text-gray-700 hover:text-gray-900 ${
          align === "right" ? "w-full justify-end" : ""
        }`}
        title={`Sort by ${label}`}
      >
        <span>{label}</span>
        {active ? (
          isAsc ? <ArrowUp className="w-3.5 h-3.5 text-blue-600" /> : <ArrowDown className="w-3.5 h-3.5 text-blue-600" />
        ) : (
          <ArrowDown className="w-3.5 h-3.5 text-gray-300" />
        )}
      </button>
    );
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: "general", label: "General" },
    { key: "change_orders", label: `Change Orders (${changeOrders.length})` },
    { key: "emails", label: "Emails" },
    { key: "change_history", label: "Change History" },
    { key: "financial_markup", label: "Financial Markup" },
    { key: "advanced_settings", label: "Advanced Settings" },
  ];

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col">
      <AppHeader username={username} />
      <ProjectNav projectId={projectId} />

      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push(`/projects/${projectId}/prime-contracts`)}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            Prime Contracts
          </button>
          <span className="text-gray-300">/</span>
          <span className="text-sm font-semibold text-gray-900">
            Prime Contract #{contract.contract_number}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setCreateMenuOpen((open) => !open)}
              className="flex items-center gap-1 px-3 py-1.5 text-xs bg-[color:var(--ink)] text-white rounded hover:bg-black transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Create
              <ChevronDown className="w-3 h-3" />
            </button>
            {createMenuOpen && (
              <div className="absolute right-0 top-[calc(100%+6px)] min-w-[210px] bg-white border border-gray-200 rounded-md shadow-md z-10 py-1">
                <button
                  onClick={() => {
                    setCreateMenuOpen(false);
                    router.push(`/projects/${projectId}/change-events/new`);
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
                >
                  Create Change Event
                </button>
                <button
                  onClick={() => {
                    setCreateMenuOpen(false);
                    router.push(`/projects/${projectId}/prime-contracts/${contractId}/change-orders/new`);
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
                >
                  Create Prime Contract CO
                </button>
              </div>
            )}
          </div>
          <button className="flex items-center justify-center px-2.5 py-1.5 text-xs border border-gray-300 rounded text-gray-700 hover:bg-gray-50 transition-colors">
            <Mail className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Contract title + status */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-[20px] leading-tight text-[color:var(--ink)]">{contract.title || `Prime Contract #${contract.contract_number}`}</h1>
          <StatusBadge status={contract.status} />
        </div>
      </div>

      {/* Tab bar */}
      <div className="bg-white border-b border-gray-200 px-6 flex items-center shrink-0">
        <div className="flex">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                tab === t.key
                  ? "border-orange-500 text-orange-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden flex">

        {/* ── General ── */}
        {tab === "general" && (
          <>
            {/* Left sidebar */}
            <div className="w-48 shrink-0 bg-white border-r border-gray-200 py-4 flex flex-col gap-0.5 overflow-y-auto">
              {GENERAL_SECTIONS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => scrollToSection(s.id)}
                  className={`w-full text-left px-4 py-1.5 text-xs transition-colors ${
                    activeSection === s.id
                      ? "text-gray-900 font-medium"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {/* Main content */}
            <div ref={contentRef} className="flex-1 overflow-y-auto">
              {/* Export / Edit Contract actions */}
              <div className="flex justify-end gap-2 px-8 pt-4 pb-2 bg-gray-50">
                <button
                  onClick={handleSyncToQBO}
                  disabled={qbSyncing}
                  title="Push this prime contract to QuickBooks Online"
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[#2CA01C] rounded hover:bg-[#237d16] transition-colors disabled:opacity-50"
                >
                  <svg className={`w-3 h-3 ${qbSyncing ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  {qbSyncing ? "Syncing…" : "Sync to QuickBooks"}
                </button>
                <button className="flex items-center gap-1 px-3 py-1.5 text-xs border border-gray-300 rounded bg-white text-gray-700 hover:bg-gray-50 transition-colors">
                  Export <ChevronDown className="w-3 h-3" />
                </button>
                <button
                  onClick={() => router.push(`/projects/${projectId}/prime-contracts/${contractId}/edit`)}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs border border-gray-300 rounded bg-white text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Edit Contract
                </button>
              </div>
              {qbSyncMsg && (
                <div className={`mx-8 mb-2 px-3 py-2 text-xs rounded flex items-center justify-between ${qbSyncMsg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                  <span>{qbSyncMsg.text}</span>
                  <button onClick={() => setQbSyncMsg(null)} className="opacity-60 hover:opacity-100 ml-3">✕</button>
                </div>
              )}

              {/* General Information */}
              <div id="general-info" className="scroll-mt-2 bg-white border-b border-gray-200 px-8 py-6">
                <div className="flex items-center justify-between mb-5">
                  <button onClick={() => setGeneralInfoOpen((v) => !v)} className="flex items-center gap-2">
                    {generalInfoOpen ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
                    <h2 className="text-sm font-semibold text-gray-900">General Information</h2>
                  </button>
                  <button
                    onClick={() => router.push(`/projects/${projectId}/prime-contracts/${contractId}/edit`)}
                    className="px-3 py-1 text-xs border border-gray-300 rounded text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    Edit
                  </button>
                </div>
                {generalInfoOpen && contract.id && (
                  <p className="text-xs text-gray-400 mb-5">
                    Created by — on {fmtDate(contract.start_date || null)}
                  </p>
                )}
                {generalInfoOpen && <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-8 gap-y-5 mb-6">
                  <Field label="Contract #" value={contract.contract_number} />
                  <Field label="Owner / Client" value={contract.owner_client} />
                  <Field label="Title" value={contract.title} />
                  <Field label="Status" value={<StatusBadge status={contract.status} />} />
                  <Field
                    label="Executed"
                    value={
                      contract.executed
                        ? <span className="inline-flex items-center gap-1 text-sm text-gray-700">✓</span>
                        : <span className="text-gray-400 text-sm">⊘</span>
                    }
                  />
                  <Field label="Default Retainage" value={contract.default_retainage != null ? `${contract.default_retainage}%` : null} />
                  <Field
                    label="Contractor"
                    value={
                      contract.contractor
                        ? <span className="text-orange-600 text-sm">{contract.contractor}</span>
                        : null
                    }
                  />
                  <Field label="Architect / Engineer" value={contract.architect_engineer} />
                </div>}
                {generalInfoOpen && contract.description && (
                  <div className="mb-4">
                    <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-1">Description</p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{contract.description}</p>
                  </div>
                )}
                {generalInfoOpen && <div>
                  <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-1">Attachments</p>
                  <p className="text-sm text-gray-400 italic">No attachments.</p>
                </div>}
              </div>

              {/* Contract Summary */}
              <ContractSummaryTile
                original={contract.original_contract_amount}
                approvedCO={contract.approved_change_orders}
                pendingCO={contract.pending_change_orders}
                draftCO={contract.draft_change_orders}
                invoiced={contract.invoiced}
                paymentsReceived={contract.payments_received}
                revised={revised}
                pendingRevised={pendingRevised}
                remaining={remaining}
                pctPaid={pctPaid}
              />

              {/* Schedule of Values */}
              <SovSection sovItems={sovItems} />

              {/* Inclusions & Exclusions */}
              <div id="inclusions-exclusions" className="scroll-mt-2 bg-white border-b border-gray-200 px-8 py-6">
                <button onClick={() => setInclusionsOpen((v) => !v)} className="flex items-center gap-2 mb-5">
                  {inclusionsOpen ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
                  <h2 className="text-sm font-semibold text-gray-900">Inclusions &amp; Exclusions</h2>
                </button>
                {inclusionsOpen && <div className="space-y-6">
                  <div>
                    <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-2">Inclusions</p>
                    {contract.inclusions
                      ? <p className="text-sm text-gray-700 whitespace-pre-wrap">{contract.inclusions}</p>
                      : <p className="text-sm text-gray-400 italic">No inclusions specified.</p>}
                  </div>
                  <div className="border-t border-gray-100 pt-6">
                    <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-2">Exclusions</p>
                    {contract.exclusions
                      ? <p className="text-sm text-gray-700 whitespace-pre-wrap">{contract.exclusions}</p>
                      : <p className="text-sm text-gray-400 italic">No exclusions specified.</p>}
                  </div>
                </div>}
              </div>

              {/* Contract Dates */}
              <div id="contract-dates" className="scroll-mt-2 bg-white border-b border-gray-200 px-8 py-6">
                <button onClick={() => setDatesOpen((v) => !v)} className="flex items-center gap-2 mb-5">
                  {datesOpen ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
                  <h2 className="text-sm font-semibold text-gray-900">Contract Dates</h2>
                </button>
                {datesOpen && <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-8 gap-y-5">
                  <Field label="Start Date" value={fmtDate(contract.start_date)} />
                  <Field label="Estimated Completion" value={fmtDate(contract.estimated_completion_date)} />
                  <Field label="Actual Completion" value={fmtDate(contract.actual_completion_date)} />
                  <Field label="Signed Contract Received" value={fmtDate(contract.signed_contract_received_date)} />
                  <Field label="Contract Termination" value={fmtDate(contract.contract_termination_date)} />
                </div>}
              </div>

              {/* Contract Privacy */}
              <div id="contract-privacy" className="scroll-mt-2 bg-white border-b border-gray-200 px-8 py-6">
                <button onClick={() => setPrivacyOpen((v) => !v)} className="flex items-center gap-2 mb-5">
                  {privacyOpen ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
                  <h2 className="text-sm font-semibold text-gray-900">Contract Privacy</h2>
                </button>
                {privacyOpen && <div className="grid grid-cols-2 gap-x-8 gap-y-5">
                  <Field label="Private" value={contract.is_private ? "Yes — visible to admins and select users only" : "No — visible to all project members"} />
                  <Field label="Allow Non-Admin SOV View" value={contract.sov_view_allowed ? "Yes" : "No"} />
                </div>}
              </div>
            </div>
          </>
        )}

        {/* ── Change Orders ── */}
        {tab === "change_orders" && (
          <div className="flex-1 overflow-y-auto bg-white">
            <div className="flex items-center justify-between px-8 py-4 border-b border-gray-200">
              <h2 className="text-sm font-semibold text-gray-900">Change Orders</h2>
              <button
                onClick={() => router.push(`/projects/${projectId}/prime-contracts/${contractId}/change-orders/new`)}
                className="flex items-center gap-1 px-3 py-1.5 text-xs bg-gray-900 text-white rounded hover:bg-gray-700 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                New Change Order
              </button>
            </div>
            <div className="px-8 py-3 border-b border-gray-100 flex flex-wrap items-center gap-2">
              <div className="relative" ref={filterMenuRef}>
                <button
                  type="button"
                  onClick={() => setFilterMenuOpen((open) => !open)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs border border-gray-300 rounded text-gray-700 hover:bg-gray-50"
                >
                  Filters {activeFilterCount > 0 ? `(${activeFilterCount})` : ""}
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${filterMenuOpen ? "rotate-180" : ""}`} />
                </button>
                {filterMenuOpen && (
                  <div className="absolute z-20 mt-1 w-72 rounded-md border border-gray-200 bg-white shadow-lg p-3 space-y-3">
                    <FilterSection
                      label="Status"
                      options={statusOptions}
                      selected={statusFilters}
                      onToggle={(value) => toggleFilterValue(value, statusFilters, setStatusFilters)}
                    />
                    <FilterSection
                      label="Executed"
                      options={["Yes", "No"]}
                      selected={executedFilters}
                      onToggle={(value) => toggleFilterValue(value, executedFilters, setExecutedFilters)}
                    />
                    <FilterSection
                      label="Change Reason"
                      options={changeReasonOptions}
                      selected={reasonFilters}
                      onToggle={(value) => toggleFilterValue(value, reasonFilters, setReasonFilters)}
                    />
                    <FilterSection
                      label="Change Type"
                      options={changeTypeOptions}
                      selected={typeFilters}
                      onToggle={(value) => toggleFilterValue(value, typeFilters, setTypeFilters)}
                    />
                  </div>
                )}
              </div>
              <button
                onClick={() => {
                  setStatusFilters([]);
                  setExecutedFilters([]);
                  setReasonFilters([]);
                  setTypeFilters([]);
                }}
                className="px-2 py-1 text-xs border border-gray-300 rounded text-gray-700 hover:bg-gray-50"
              >
                Clear All
              </button>
            </div>
            {changeOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-gray-400">
                <p className="text-sm font-medium text-gray-500 mb-1">No change orders</p>
                <p className="text-xs">Change orders created for this contract will appear here.</p>
              </div>
            ) : (
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-4 py-2.5 text-left">{sortHeaderButton("#", "number")}</th>
                    <th className="px-4 py-2.5 text-left">{sortHeaderButton("Revision", "revision")}</th>
                    <th className="px-4 py-2.5 text-left">{sortHeaderButton("Title", "title")}</th>
                    <th className="px-4 py-2.5 text-left">{sortHeaderButton("Status", "status")}</th>
                    <th className="px-4 py-2.5 text-right">{sortHeaderButton("Amount", "amount", "right")}</th>
                    <th className="px-4 py-2.5 text-left">{sortHeaderButton("Date Initiated", "date_initiated")}</th>
                    <th className="px-4 py-2.5 text-left">{sortHeaderButton("Due Date", "due_date")}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAndSortedChangeOrders.map((co) => {
                    const statusCls = CO_STATUS_COLORS[co.status] ?? "bg-gray-100 text-gray-600";
                    return (
                      <tr
                        key={co.id}
                        className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                        onClick={() => router.push(`/projects/${projectId}/change-orders/${co.id}`)}
                      >
                        <td className="px-4 py-2.5 text-gray-600 font-medium">{co.number}</td>
                        <td className="px-4 py-2.5 text-gray-600">{co.revision ?? 0}</td>
                        <td className="px-4 py-2.5 text-gray-800">{co.title || "—"}</td>
                        <td className="px-4 py-2.5">
                          <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${statusCls}`}>
                            {co.status}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right text-gray-700">{fmt(co.amount)}</td>
                        <td className="px-4 py-2.5 text-gray-600">{fmtDate(co.date_initiated)}</td>
                        <td className="px-4 py-2.5 text-gray-600">{fmtDate(co.due_date)}</td>
                      </tr>
                    );
                  })}
                  {filteredAndSortedChangeOrders.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-gray-400">
                        No change orders match the selected filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ── Emails ── */}
        {tab === "emails" && (
          <div className="flex-1 overflow-y-auto bg-white flex flex-col items-center justify-center py-24 text-gray-400">
            <Mail className="w-8 h-8 mb-3 text-gray-300" />
            <p className="text-sm font-medium text-gray-500 mb-1">No emails yet</p>
            <p className="text-xs">Emails sent or received for this contract will appear here.</p>
          </div>
        )}

        {/* ── Change History ── */}
        {tab === "change_history" && (
          <div className="flex-1 overflow-y-auto bg-white">
            {historyLoading && !historyLoaded ? (
              <p className="text-sm text-gray-400 px-8 py-8">Loading change history…</p>
            ) : history.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-gray-400">
                <p className="text-sm font-medium text-gray-500 mb-1">No history yet</p>
                <p className="text-xs">Changes made to this contract will be logged here.</p>
              </div>
            ) : (
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-4 py-2.5 text-left">Date</th>
                    <th className="px-4 py-2.5 text-left">Action By</th>
                    <th className="px-4 py-2.5 text-left">Changed</th>
                    <th className="px-4 py-2.5 text-left">From</th>
                    <th className="px-4 py-2.5 text-left">To</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((entry, idx) => (
                    <tr key={entry.id} className={idx < history.length - 1 ? "border-b border-gray-100" : ""}>
                      <td className="px-4 py-2.5 text-gray-600">{new Date(entry.created_at).toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-gray-700">{entry.changed_by_name || "—"}</td>
                      <td className="px-4 py-2.5 text-gray-700">{entry.action || "—"}</td>
                      <td className="px-4 py-2.5 text-gray-600">{entry.from_value || "--"}</td>
                      <td className="px-4 py-2.5 text-gray-700">{entry.to_value || "--"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ── Financial Markup ── */}
        {tab === "financial_markup" && (
          <div className="flex-1 overflow-y-auto bg-white">
            <div className="px-8 py-6 border-b border-gray-200">
              <h2 className="text-sm font-semibold text-gray-900 mb-1">Financial Markup</h2>
              <p className="text-xs text-gray-400">Configure markup rates applied to this contract&apos;s change orders and invoices.</p>
            </div>
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <p className="text-sm font-medium text-gray-500 mb-1">No markup configured</p>
              <p className="text-xs">Financial markup settings for this contract will appear here.</p>
            </div>
          </div>
        )}

        {/* ── Advanced Settings ── */}
        {tab === "advanced_settings" && (
          <div className="flex-1 overflow-y-auto bg-white">
            <div className="px-8 py-6 border-b border-gray-200">
              <h2 className="text-sm font-semibold text-gray-900 mb-1">Advanced Settings</h2>
              <p className="text-xs text-gray-400">Configure advanced options for this prime contract.</p>
            </div>
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <p className="text-sm font-medium text-gray-500 mb-1">No advanced settings available</p>
              <p className="text-xs">Advanced configuration options will appear here.</p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

function FilterSection({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  if (options.length === 0) return null;

  return (
    <div>
      <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{label}</p>
      <div className="max-h-32 overflow-y-auto border border-gray-100 rounded">
        {options.map((option) => (
          <label
            key={option}
            className="flex items-center gap-2 px-2 py-1.5 text-xs text-gray-700 hover:bg-gray-50 cursor-pointer"
          >
            <input
              type="checkbox"
              checked={selected.includes(option)}
              onChange={() => onToggle(option)}
              className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
            />
            <span>{option}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

const ADD_GROUP_OPTIONS = [
  { label: "Cost Type", isHeader: false },
  { label: "Cost Code", isHeader: true },
  { label: "Cost Code", isHeader: false },
  { label: "Cost Code Tier 1", isHeader: false },
  { label: "Cost Code Tier 2", isHeader: false },
];

function SovSection({ sovItems }: { sovItems: SovItem[] }) {
  const [open, setOpen] = useState(true);
  const [groupDropOpen, setGroupDropOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setGroupDropOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const total = sovItems.reduce((s, i) => s + (i.scheduled_value ?? 0), 0);

  function fmt(val: number) {
    return val.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
  }

  return (
    <div id="schedule-of-values" className="scroll-mt-2 bg-white border-b border-gray-200">
      {/* Section header */}
      <div className="px-8 py-4 flex items-center justify-between">
        <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-2">
          {open ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
          <h2 className="text-sm font-semibold text-gray-900">Schedule of Values</h2>
        </button>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-300 rounded text-gray-600 hover:bg-gray-50 transition-colors">
            <Maximize2 className="w-3.5 h-3.5" />
            Open Fullscreen
          </button>
          <button className="px-3 py-1.5 text-xs border border-gray-300 rounded text-gray-600 hover:bg-gray-50 transition-colors">
            Edit
          </button>
        </div>
      </div>

      {/* Add Group control */}
      {open && <div className="px-8 pb-3">
        <div ref={dropRef} className="relative inline-block">
          <button
            onClick={() => setGroupDropOpen((v) => !v)}
            className="px-3 py-1.5 text-xs border border-gray-300 rounded text-gray-600 hover:bg-gray-50 transition-colors"
          >
            {selectedGroup ? `Group: ${selectedGroup}` : "Add Group"}
          </button>
          {groupDropOpen && (
            <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded shadow-lg z-10 w-48 py-1">
              {ADD_GROUP_OPTIONS.map((opt, i) => (
                opt.isHeader ? (
                  <div key={i} className="px-3 pt-2 pb-0.5 text-xs font-semibold text-gray-700">
                    {opt.label}
                  </div>
                ) : (
                  <button
                    key={i}
                    onClick={() => { setSelectedGroup(opt.label); setGroupDropOpen(false); }}
                    className="w-full text-left px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
                  >
                    {opt.label}
                  </button>
                )
              ))}
              <div className="border-t border-gray-100 mt-1 px-3 py-1.5 flex justify-end">
                <button
                  onClick={() => { setSelectedGroup(null); setGroupDropOpen(false); }}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  Clear
                </button>
              </div>
            </div>
          )}
        </div>
      </div>}

      {/* Table */}
      {open && (sovItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-gray-400 border-t border-gray-100">
          <p className="text-sm font-medium text-gray-500 mb-1">No schedule of values items</p>
          <p className="text-xs">SOV items can be added when editing this contract.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-t border-gray-200">
                <th className="px-4 py-2.5 text-left font-medium text-gray-600 w-1/3">
                  <div className="flex items-center gap-1">
                    Budget Code
                    <HelpCircle className="w-3.5 h-3.5 text-gray-400" />
                  </div>
                </th>
                <th className="px-4 py-2.5 text-left font-medium text-gray-600 w-1/3">Description</th>
                <th className="px-4 py-2.5 text-left font-medium text-gray-600 w-1/3">Amount</th>
              </tr>
            </thead>
            <tbody>
              {sovItems.map((item) => (
                <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-600">{item.budget_code || "—"}</td>
                  <td className="px-4 py-2 text-gray-800">{item.description || "—"}</td>
                  <td className="px-4 py-2 text-gray-700">{fmt(item.scheduled_value)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-200">
                <td colSpan={2} className="px-4 py-2.5 text-xs font-semibold text-gray-600">Total</td>
                <td className="px-4 py-2.5 text-xs font-semibold text-gray-900">{fmt(total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      ))}
    </div>
  );
}
