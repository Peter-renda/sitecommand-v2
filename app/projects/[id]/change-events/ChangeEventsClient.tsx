"use client";

import { Fragment, useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import ProjectNav from "@/components/ProjectNav";
import AppHeader from "@/app/components/AppHeader";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Info,
  X,
  Search,
  Pencil,
  Check,
  Settings,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type LineItem = {
  id: string;
  change_event_id: string;
  budget_code: string | null;
  description: string | null;
  vendor: string | null;
  contract_number: string | null;
  unit_of_measure?: string | null;
  schedule_impact: string | null;
  // Revenue
  rev_unit_qty: number | null;
  rev_unit_cost: number | null;
  rev_rom: number | null;
  rev_prime_pco: number | null;
  rev_latest_price: number | null;
  // Cost
  cost_unit_qty: number | null;
  cost_unit_cost: number | null;
  cost_rom: number | null;
  cost_rfq: number | null;
  cost_commitment: number | null;
  cost_latest: number | null;
  cost_over_under: number | null;
  cost_budget_mod: number | null;
};

type ChangeEvent = {
  id: string;
  number: number;
  title: string;
  status: string;
  created_at: string;
  // Classification
  scope: string | null;
  type: string | null;
  change_reason: string | null;
  origin: string | null;
  // Rolled-up Revenue
  rev_unit_qty: number | null;
  rev_unit_cost: number | null;
  rev_rom: number | null;
  rev_prime_pco: number | null;
  rev_latest_price: number | null;
  // Rolled-up Cost
  cost_unit_qty: number | null;
  cost_unit_cost: number | null;
  cost_rom: number | null;
  cost_rfq: number | null;
  cost_commitment: number | null;
  cost_latest: number | null;
  cost_over_under: number | null;
  cost_budget_mod: number | null;
  line_items: LineItem[];
};

type Tab = "detail" | "summary" | "rfqs" | "recycle_bin";
type PrimePcoOption = {
  id: string;
  number: string;
  title: string;
  contract_name: string | null;
};
type CommitmentCcoOption = {
  id: string;
  number: string;
  title: string;
  contract_name: string | null;
  status: string | null;
};

type RomPopup = {
  lineItemId: string;
  eventId: string;
  budgetCode: string;
  description: string;
  vendor: string;
  contractNumber: string;
  unitOfMeasure: string;
  revUnitQty: string;
  revUnitCost: string;
  costUnitQty: string;
  costUnitCost: string;
  top: number;
  left: number;
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmt(val: number | null | undefined) {
  if (val === null || val === undefined) return "";
  return val.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
}

function fmtQty(val: number | null | undefined) {
  if (val === null || val === undefined) return "";
  return val.toLocaleString("en-US", { minimumFractionDigits: 2 });
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function ChangeEventsClient({
  projectId,
  canWrite,
  username,
}: {
  projectId: string;
  canWrite: boolean;
  username?: string;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("detail");
  const [events, setEvents] = useState<ChangeEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedLineItemIds, setSelectedLineItemIds] = useState<Set<string>>(new Set());
  const [showBanner, setShowBanner] = useState(true);
  const [filterOpen, setFilterOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const [hoveredAction, setHoveredAction] = useState<string | null>(null);
  const [hoveredSubItem, setHoveredSubItem] = useState<string | null>(null);
  const [matchingPcos, setMatchingPcos] = useState<PrimePcoOption[]>([]);
  const [allPcos, setAllPcos] = useState<PrimePcoOption[]>([]);
  const [allCommitmentCcos, setAllCommitmentCcos] = useState<CommitmentCcoOption[]>([]);
  const [allCommitments, setAllCommitments] = useState<{ id: string; number: number; title: string; type: string; status: string | null }[]>([]);
  const [pcoPickerOpen, setPcoPickerOpen] = useState(false);
  const [pcoPickerLoading, setPcoPickerLoading] = useState(false);
  const [pcoPickerContracts, setPcoPickerContracts] = useState<{ id: string; contract_number: number; title: string }[]>([]);
  const [search, setSearch] = useState("");
  const [showRows, setShowRows] = useState(25);
  const [page, setPage] = useState(1);
  const filterRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);
  const quickActionsRef = useRef<HTMLDivElement>(null);
  const [romPopup, setRomPopup] = useState<RomPopup | null>(null);
  const [romSaving, setRomSaving] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);
  const pageCheckboxRef = useRef<HTMLInputElement>(null);


  // Click-outside for dropdowns and popup
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setFilterOpen(false);
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setExportOpen(false);
      if (quickActionsRef.current && !quickActionsRef.current.contains(e.target as Node)) setQuickActionsOpen(false);
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) setRomPopup(null);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const fetchEvents = useCallback(() => {
    setLoading(true);
    const qs = activeTab === "recycle_bin" ? "?recycle_bin=true" : "";
    fetch(`/api/projects/${projectId}/change-events${qs}`)
      .then((r) => r.json())
      .then((data) => {
        const arr = Array.isArray(data) ? data : [];
        // Roll up line item values onto the event row so collapsed rows show aggregated totals
        const normalized = arr.map((ev: ChangeEvent) => ({
          ...ev,
          rev_unit_qty: ev.line_items?.reduce((s: number, li: LineItem) => s + (li.rev_unit_qty ?? 0), 0) ?? 0,
          rev_unit_cost: ev.line_items?.reduce((s: number, li: LineItem) => s + (li.rev_unit_cost ?? 0), 0) ?? 0,
          rev_rom: ev.line_items?.reduce((s: number, li: LineItem) => s + (li.rev_rom ?? 0), 0) ?? 0,
          rev_prime_pco: ev.line_items?.reduce((s: number, li: LineItem) => s + (li.rev_prime_pco ?? 0), 0) ?? 0,
          rev_latest_price: ev.line_items?.reduce((s: number, li: LineItem) => s + (li.rev_latest_price ?? 0), 0) ?? 0,
          cost_unit_qty: ev.line_items?.reduce((s: number, li: LineItem) => s + (li.cost_unit_qty ?? 0), 0) ?? 0,
          cost_unit_cost: ev.line_items?.reduce((s: number, li: LineItem) => s + (li.cost_unit_cost ?? 0), 0) ?? 0,
          cost_rom: ev.line_items?.reduce((s: number, li: LineItem) => s + (li.cost_rom ?? 0), 0) ?? 0,
          cost_rfq: ev.line_items?.reduce((s: number, li: LineItem) => s + (li.cost_rfq ?? 0), 0) ?? 0,
          cost_commitment: ev.line_items?.reduce((s: number, li: LineItem) => s + (li.cost_commitment ?? 0), 0) ?? 0,
          cost_latest: ev.line_items?.reduce((s: number, li: LineItem) => s + (li.cost_latest ?? 0), 0) ?? 0,
          cost_over_under: ev.line_items?.reduce((s: number, li: LineItem) => s + (li.cost_over_under ?? 0), 0) ?? 0,
          cost_budget_mod: ev.line_items?.reduce((s: number, li: LineItem) => s + (li.cost_budget_mod ?? 0), 0) ?? 0,
        }));
        setEvents(normalized);
        setLoading(false);
      })
      .catch(() => {
        setEvents([]);
        setLoading(false);
      });
  }, [projectId, activeTab]);

  useEffect(() => {
    fetchEvents();
    setPage(1);
  }, [fetchEvents]);

  const selectedLineItems = useMemo(
    () =>
      events.flatMap((ev) =>
        ev.line_items
          .filter((li) => selectedLineItemIds.has(li.id))
          .map((li) => ({ ...li, eventId: ev.id }))
      ),
    [events, selectedLineItemIds]
  );
  const selectedEventIds = useMemo(() => {
    const ids = new Set(selectedIds);
    selectedLineItems.forEach((li) => ids.add(li.eventId));
    return ids;
  }, [selectedIds, selectedLineItems]);
  const hasSelection = selectedEventIds.size > 0;

  // Fetch matching/unmatched unapproved prime PCOs and all commitments whenever the bulk actions dropdown opens
  useEffect(() => {
    if (!quickActionsOpen || !hasSelection) return;
    const ids = Array.from(selectedEventIds).join(",");
    fetch(`/api/projects/${projectId}/change-events/matching-prime-contracts?eventIds=${ids}`)
      .then((r) => r.json())
      .then((data) => {
        setMatchingPcos(data.matching ?? []);
        setAllPcos(data.all ?? []);
      })
      .catch(() => {
        setMatchingPcos([]);
        setAllPcos([]);
      });
    fetch(`/api/projects/${projectId}/commitments`)
      .then((r) => r.json())
      .then((data) => setAllCommitments(Array.isArray(data) ? data : []))
      .catch(() => setAllCommitments([]));
    fetch(`/api/projects/${projectId}/change-orders?type=commitment`)
      .then((r) => r.json())
      .then((data) => {
        if (!Array.isArray(data)) {
          setAllCommitmentCcos([]);
          return;
        }
        const unapproved = data.filter(
          (row) => String(row?.status ?? "").trim().toLowerCase() !== "approved"
        );
        setAllCommitmentCcos(unapproved);
      })
      .catch(() => setAllCommitmentCcos([]));
  }, [quickActionsOpen, hasSelection, selectedEventIds, projectId]);

  // Filtering
  const filtered = events.filter((ev) =>
    search
      ? ev.title.toLowerCase().includes(search.toLowerCase()) ||
        String(ev.number).includes(search)
      : true
  );

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / showRows));
  const pageStart = (page - 1) * showRows;
  const pageEnd = Math.min(pageStart + showRows, filtered.length);
  const pageEvents = filtered.slice(pageStart, pageEnd);

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleExpandAll() {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      const allExpandedOnPage = pageEvents.length > 0 && pageEvents.every((ev) => next.has(ev.id));
      if (allExpandedOnPage) {
        pageEvents.forEach((ev) => next.delete(ev.id));
      } else {
        pageEvents.forEach((ev) => next.add(ev.id));
      }
      return next;
    });
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleLineItem(id: string) {
    setSelectedLineItemIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleEventLineItems(ev: ChangeEvent) {
    const lineItemIds = ev.line_items.map((li) => li.id);
    if (lineItemIds.length === 0) {
      toggleSelect(ev.id);
      return;
    }

    setSelectedLineItemIds((prev) => {
      const next = new Set(prev);
      const allSelected = lineItemIds.every((id) => next.has(id));
      if (allSelected) {
        lineItemIds.forEach((id) => next.delete(id));
      } else {
        lineItemIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }

  function toggleSelectAllLineItems() {
    const pageLineItemIds = pageEvents.flatMap((ev) => ev.line_items.map((li) => li.id));
    if (pageLineItemIds.length === 0) return;

    setSelectedLineItemIds((prev) => {
      const next = new Set(prev);
      const allSelected = pageLineItemIds.every((id) => next.has(id));
      if (allSelected) {
        pageLineItemIds.forEach((id) => next.delete(id));
      } else {
        pageLineItemIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }

  const pageLineItemIds = pageEvents.flatMap((ev) => ev.line_items.map((li) => li.id));
  const allLineItemsSelected = pageLineItemIds.length > 0 && pageLineItemIds.every((id) => selectedLineItemIds.has(id));
  const someLineItemsSelected = pageLineItemIds.some((id) => selectedLineItemIds.has(id));
  const allExpandedOnPage = pageEvents.length > 0 && pageEvents.every((ev) => expandedIds.has(ev.id));
  const showExpandedDetailColumns = pageEvents.some((ev) => expandedIds.has(ev.id));
  const detailHeaderColSpan = showExpandedDetailColumns ? 8 : 3;
  const detailTableColSpan = showExpandedDetailColumns ? 21 : 16;

  useEffect(() => {
    if (pageCheckboxRef.current) {
      pageCheckboxRef.current.indeterminate = !allLineItemsSelected && someLineItemsSelected;
    }
  }, [allLineItemsSelected, someLineItemsSelected]);

  function openRomPopup(
    e: { currentTarget: HTMLElement },
    li: LineItem,
    eventId: string
  ) {
    const rect = e.currentTarget.getBoundingClientRect();
    setRomPopup({
      lineItemId: li.id,
      eventId,
      budgetCode: li.budget_code ?? "",
      description: li.description ?? "",
      vendor: li.vendor ?? "",
      contractNumber: li.contract_number ?? "",
      unitOfMeasure: "",
      revUnitQty: li.rev_unit_qty != null ? String(li.rev_unit_qty) : "",
      revUnitCost: li.rev_unit_cost != null ? String(li.rev_unit_cost) : "",
      costUnitQty: li.cost_unit_qty != null ? String(li.cost_unit_qty) : "",
      costUnitCost: li.cost_unit_cost != null ? String(li.cost_unit_cost) : "",
      top: rect.bottom + window.scrollY + 4,
      left: Math.min(rect.left + window.scrollX, window.innerWidth - 380),
    });
  }

  async function saveRomPopup() {
    if (!romPopup) return;
    setRomSaving(true);
    try {
      const revQty = parseFloat(romPopup.revUnitQty) || null;
      const revCost = parseFloat(romPopup.revUnitCost) || null;
      const costQty = parseFloat(romPopup.costUnitQty) || null;
      const costCost = parseFloat(romPopup.costUnitCost) || null;
      const revRom = revQty != null && revCost != null ? revQty * revCost : null;
      const costRom = costQty != null && costCost != null ? costQty * costCost : null;

      const res = await fetch(
        `/api/projects/${projectId}/change-events/${romPopup.eventId}/line-items/${romPopup.lineItemId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            budget_code: romPopup.budgetCode || null,
            description: romPopup.description || null,
            vendor: romPopup.vendor || null,
            contract_number: romPopup.contractNumber || null,
            rev_unit_qty: revQty,
            rev_unit_cost: revCost,
            rev_rom: revRom,
            cost_unit_qty: costQty,
            cost_unit_cost: costCost,
            cost_rom: costRom,
          }),
        }
      );

      if (res.ok) {
        // Update local state
        setEvents((prev) =>
          prev.map((ev) => {
            if (ev.id !== romPopup.eventId) return ev;
            const updatedItems = ev.line_items.map((li) => {
              if (li.id !== romPopup.lineItemId) return li;
              return {
                ...li,
                budget_code: romPopup.budgetCode || null,
                description: romPopup.description || null,
                vendor: romPopup.vendor || null,
                contract_number: romPopup.contractNumber || null,
                rev_unit_qty: revQty,
                rev_unit_cost: revCost,
                rev_rom: revRom,
                cost_unit_qty: costQty,
                cost_unit_cost: costCost,
                cost_rom: costRom,
              };
            });
            return {
              ...ev,
              line_items: updatedItems,
              rev_rom: updatedItems.reduce((s, li) => s + (li.rev_rom ?? 0), 0),
              cost_rom: updatedItems.reduce((s, li) => s + (li.cost_rom ?? 0), 0),
            };
          })
        );
        setRomPopup(null);
      }
    } finally {
      setRomSaving(false);
    }
  }

  // ── Column header cell ─────────────────────────────────────────────────────
  function TH({ children, right }: { children?: string | number; right?: boolean }) {
    return (
      <th
        className={`px-2 py-2 text-xs font-medium text-gray-500 whitespace-nowrap ${right ? "text-right" : "text-left"}`}
      >
        {children}
      </th>
    );
  }

  // ── Number cell ────────────────────────────────────────────────────────────
  function NumCell({ val, blue, qty }: { val: number | null | undefined; blue?: boolean; qty?: boolean }) {
    if (val === null || val === undefined || val === 0) {
      return <td className="px-2 py-2 text-right text-xs text-gray-400 whitespace-nowrap">{qty ? "0.00" : "$0.00"}</td>;
    }
    return (
      <td
        className={`px-2 py-2 text-right text-xs whitespace-nowrap ${blue ? "text-blue-600 font-medium" : "text-gray-700"}`}
      >
        {qty ? fmtQty(val) : fmt(val)}
      </td>
    );
  }

  // ── Empty num cell ─────────────────────────────────────────────────────────
  function EmptyCell() {
    return <td className="px-2 py-2 text-right text-xs text-gray-400" />;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <AppHeader username={username} />
      <ProjectNav projectId={projectId} />

      {/* ── Page Header ─────────────────────────────────────────────────────── */}
      <div className="px-6 pt-8 pb-4 bg-gray-50">
        <h1 className="font-display text-[28px] leading-tight text-[color:var(--ink)]">Change Events</h1>
      </div>

      <div className="flex items-center justify-between px-6 py-2 border-b border-gray-200 bg-white shrink-0">
        {/* Left: tabs */}
        <div className="flex items-center">
          {(["detail", "summary", "rfqs", "recycle_bin"] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? "border-gray-900 text-gray-900"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab === "recycle_bin"
                ? "Recycle Bin"
                : tab === "rfqs"
                ? "RFQs"
                : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Right: Export + Create */}
        <div className="flex items-center gap-2">
          <div ref={exportRef} className="relative">
            <button
              onClick={() => setExportOpen((v) => !v)}
              className="flex items-center gap-1 px-3 py-1.5 text-xs border border-gray-300 rounded text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Export <ChevronDown className="w-3 h-3" />
            </button>
            {exportOpen && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded shadow-lg z-20 w-40 py-1">
                {["Export as PDF", "Export as CSV", "Export as Excel"].map((opt) => (
                  <button
                    key={opt}
                    className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
                    onClick={() => setExportOpen(false)}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}
          </div>
          {canWrite && (
            <button
              onClick={() => router.push(`/projects/${projectId}/change-events/new`)}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-[color:var(--ink)] rounded-md hover:bg-black transition-colors"
            >
              <Plus className="w-4 h-4" /> Create
            </button>
          )}
          <button
            onClick={() => router.push(`/projects/${projectId}/change-events/workflows`)}
            className="flex items-center gap-1 px-3 py-1.5 text-xs border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors font-medium"
          >
            Workflow Guides
          </button>
        </div>
      </div>

      {/* ── Banner ──────────────────────────────────────────────────────────── */}
      {showBanner && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-blue-50 border-b border-blue-100 shrink-0">
          <Info className="w-4 h-4 text-blue-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-blue-800">Change Events + Budget Changes</p>
            <p className="text-xs text-blue-600">
              Configure Budget ROM (In Scope, Out of Scope, TBD Scope), auto-link budget changes to change
              events, and use Financial Impact workflows to track cost and revenue impact.
            </p>
          </div>
          <a
            href="https://v2.support.procore.com/process-guides/about-change-events/"
            target="_blank"
            rel="noreferrer"
            className="px-3 py-1 text-xs border border-blue-300 text-blue-700 rounded hover:bg-blue-100 transition-colors shrink-0"
          >
            Learn More
          </a>
          <button
            onClick={() => setShowBanner(false)}
            className="text-blue-400 hover:text-blue-600 transition-colors shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ── Filter bar ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-100 bg-white shrink-0">
        {/* Bulk Actions dropdown – write-access users only */}
        {canWrite && <div ref={quickActionsRef} className="relative">
          <button
            disabled={!hasSelection}
            onClick={() => {
              setQuickActionsOpen((v) => !v);
              setHoveredAction(null);
              setHoveredSubItem(null);
            }}
            className={`flex items-center gap-1 px-3 py-1 text-xs border rounded transition-colors ${
              hasSelection
                ? "border-gray-300 text-gray-700 hover:bg-gray-50 bg-white"
                : "border-gray-200 text-gray-400 bg-gray-50 cursor-not-allowed"
            }`}
          >
            Bulk Actions <ChevronDown className="w-3 h-3" />
          </button>

          {quickActionsOpen && hasSelection && (() => {
            const eventIds = Array.from(selectedEventIds).join(",");
            const selectedEvents = events.filter((ev) => selectedEventIds.has(ev.id));
            const associatedSelectedLineItems = selectedLineItems.filter((li) => (li.contract_number ?? "").trim().length > 0);
            const selectedHasCostAssociation =
              associatedSelectedLineItems.length > 0 ||
              selectedEvents.some((ev) => (ev.line_items ?? []).some((li) => Number(li.cost_commitment ?? 0) !== 0));
            const addToUnapprovedCommitmentDisabledMessage =
              "the selected line item has already be associated with a Commitment CO";
            const isUnapproved = (status: string | null | undefined) => String(status ?? "").trim().toLowerCase() !== "approved";
            const selectedSovLineItems =
              selectedLineItems.length > 0
                ? selectedLineItems
                : selectedEvents.flatMap((ev) => ev.line_items ?? []);

            async function addSelectedSovToPrimePco(changeOrderId: string) {
              const sourceEventIds = Array.from(selectedEventIds);
              const newSovLines = selectedSovLineItems.map((li) => ({
                budget_code: (li.budget_code ?? "").trim(),
                description: (li.description ?? "").trim(),
                amount: Number(li.rev_rom ?? 0),
              }));

              const pcoRes = await fetch(`/api/projects/${projectId}/change-orders/${changeOrderId}`);
              if (!pcoRes.ok) throw new Error("Failed to load selected PCO.");
              const existing = await pcoRes.json() as {
                source_change_event_ids?: string[] | null;
                budget_codes?: string[] | null;
                schedule_of_values?: { budget_code?: string | null; description?: string | null; amount?: number | string | null }[] | null;
              };

              const existingSov = Array.isArray(existing.schedule_of_values) ? existing.schedule_of_values : [];
              const mergedSovMap = new Map<string, { budget_code: string; description: string; amount: number }>();

              [...existingSov, ...newSovLines].forEach((line) => {
                const budgetCode = String(line?.budget_code ?? "").trim();
                const description = String(line?.description ?? "").trim();
                const amount = Number(line?.amount ?? 0);
                if (!budgetCode && !description && amount === 0) return;
                const key = `${budgetCode}__${description}__${amount.toFixed(2)}`;
                if (!mergedSovMap.has(key)) mergedSovMap.set(key, { budget_code: budgetCode, description, amount });
              });

              const mergedBudgetCodes = Array.from(
                new Set([
                  ...(Array.isArray(existing.budget_codes) ? existing.budget_codes : []),
                  ...newSovLines.map((line) => line.budget_code).filter(Boolean),
                ])
              );
              const mergedSourceEventIds = Array.from(
                new Set([
                  ...(Array.isArray(existing.source_change_event_ids) ? existing.source_change_event_ids : []),
                  ...sourceEventIds,
                ])
              );

              const patchRes = await fetch(`/api/projects/${projectId}/change-orders/${changeOrderId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  budget_codes: mergedBudgetCodes,
                  source_change_event_ids: mergedSourceEventIds,
                  schedule_of_values: Array.from(mergedSovMap.values()),
                }),
              });
              if (!patchRes.ok) throw new Error("Failed to add selected SOV to the PCO.");
            }

            async function addSelectedSovToCommitmentCco(changeOrderId: string) {
              const sourceEventIds = Array.from(selectedEventIds);
              const newSovLines = selectedSovLineItems.map((li) => ({
                budget_code: (li.budget_code ?? "").trim(),
                description: (li.description ?? "").trim(),
                amount: Number(li.cost_rom ?? 0),
              }));

              const ccoRes = await fetch(`/api/projects/${projectId}/change-orders/${changeOrderId}`);
              if (!ccoRes.ok) throw new Error("Failed to load selected commitment CO.");
              const existing = await ccoRes.json() as {
                source_change_event_ids?: string[] | null;
                budget_codes?: string[] | null;
                schedule_of_values?: { budget_code?: string | null; description?: string | null; amount?: number | string | null }[] | null;
              };

              const existingSov = Array.isArray(existing.schedule_of_values) ? existing.schedule_of_values : [];
              const mergedSovMap = new Map<string, { budget_code: string; description: string; amount: number }>();

              [...existingSov, ...newSovLines].forEach((line) => {
                const budgetCode = String(line?.budget_code ?? "").trim();
                const description = String(line?.description ?? "").trim();
                const amount = Number(line?.amount ?? 0);
                if (!budgetCode && !description && amount === 0) return;
                const key = `${budgetCode}__${description}__${amount.toFixed(2)}`;
                if (!mergedSovMap.has(key)) mergedSovMap.set(key, { budget_code: budgetCode, description, amount });
              });

              const mergedBudgetCodes = Array.from(
                new Set([
                  ...(Array.isArray(existing.budget_codes) ? existing.budget_codes : []),
                  ...newSovLines.map((line) => line.budget_code).filter(Boolean),
                ])
              );
              const mergedSourceEventIds = Array.from(
                new Set([
                  ...(Array.isArray(existing.source_change_event_ids) ? existing.source_change_event_ids : []),
                  ...sourceEventIds,
                ])
              );
              const totalAmount = Array.from(mergedSovMap.values()).reduce(
                (sum, line) => sum + Number(line.amount ?? 0),
                0
              );

              const patchRes = await fetch(`/api/projects/${projectId}/change-orders/${changeOrderId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  budget_codes: mergedBudgetCodes,
                  source_change_event_ids: mergedSourceEventIds,
                  schedule_of_values: Array.from(mergedSovMap.values()),
                  amount: totalAmount,
                }),
              });
              if (!patchRes.ok) throw new Error("Failed to add selected SOV to the commitment CO.");
            }

            // Reusable commitment submenu shared by "Add to Unapproved Commitment" and "Create Commitment CO"
            function CommitmentSubmenu({ navSuffix, unapprovedOnly = false }: { navSuffix: string; unapprovedOnly?: boolean }) {
              const scopedCommitments = unapprovedOnly ? allCommitments.filter((c) => isUnapproved(c.status)) : allCommitments;
              const subcontracts = scopedCommitments.filter((c) => c.type === "subcontract");
              const purchaseOrders = scopedCommitments.filter((c) => c.type === "purchase_order");

              return (
                <div
                  className="absolute left-full top-0 bg-white border border-gray-200 rounded shadow-lg z-40 w-56 py-1"
                  onMouseEnter={() => setHoveredAction(hoveredAction)}
                >
                  {/* Subcontracts row */}
                  <div
                    className="relative"
                    onMouseEnter={() => setHoveredSubItem("subcontracts")}
                    onMouseLeave={() => setHoveredSubItem(null)}
                  >
                    <button
                      className={`w-full flex items-center justify-between px-3 py-1.5 text-xs text-gray-700 transition-colors ${
                        hoveredSubItem === "subcontracts" ? "bg-gray-100" : "hover:bg-gray-50"
                      }`}
                    >
                      <span>Subcontracts ({subcontracts.length})</span>
                      {subcontracts.length > 0 && <ChevronRight className="w-3 h-3 text-gray-400 shrink-0" />}
                    </button>
                    {hoveredSubItem === "subcontracts" && subcontracts.length > 0 && (
                      <div
                        className="absolute left-full top-0 bg-white border border-gray-200 rounded shadow-lg z-50 w-64 py-1"
                        onMouseEnter={() => setHoveredSubItem("subcontracts")}
                      >
                        {subcontracts.map((c) => (
                          <button
                            key={c.id}
                            className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
                            onClick={() => {
                              setQuickActionsOpen(false);
                              if (navSuffix === "?action=co") {
                                router.push(`/projects/${projectId}/commitments/${c.id}/change-orders/new?eventIds=${eventIds}`);
                                return;
                              }
                              if (navSuffix === "") {
                                router.push(`/projects/${projectId}/commitments/${c.id}/edit?eventIds=${eventIds}`);
                                return;
                              }
                              router.push(`/projects/${projectId}/commitments/${c.id}${navSuffix}${navSuffix.includes("?") ? "&" : "?"}eventIds=${eventIds}`);
                            }}
                          >
                            {String(c.number).padStart(3, "0")}: {c.title}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Purchase Orders row */}
                  <div
                    className="relative"
                    onMouseEnter={() => setHoveredSubItem("purchase-orders")}
                    onMouseLeave={() => setHoveredSubItem(null)}
                  >
                    <button
                      className={`w-full flex items-center justify-between px-3 py-1.5 text-xs text-gray-700 transition-colors ${
                        hoveredSubItem === "purchase-orders" ? "bg-gray-100" : "hover:bg-gray-50"
                      }`}
                    >
                      <span>Purchase Orders ({purchaseOrders.length})</span>
                      {purchaseOrders.length > 0 && <ChevronRight className="w-3 h-3 text-gray-400 shrink-0" />}
                    </button>
                    {hoveredSubItem === "purchase-orders" && purchaseOrders.length > 0 && (
                      <div
                        className="absolute left-full top-0 bg-white border border-gray-200 rounded shadow-lg z-50 w-64 py-1"
                        onMouseEnter={() => setHoveredSubItem("purchase-orders")}
                      >
                        {purchaseOrders.map((c) => (
                          <button
                            key={c.id}
                            className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
                            onClick={() => {
                              setQuickActionsOpen(false);
                              if (navSuffix === "?action=co") {
                                router.push(`/projects/${projectId}/commitments/${c.id}/change-orders/new?eventIds=${eventIds}`);
                                return;
                              }
                              if (navSuffix === "") {
                                router.push(`/projects/${projectId}/commitments/${c.id}/edit?eventIds=${eventIds}`);
                                return;
                              }
                              router.push(`/projects/${projectId}/commitments/${c.id}${navSuffix}${navSuffix.includes("?") ? "&" : "?"}eventIds=${eventIds}`);
                            }}
                          >
                            {String(c.number).padStart(3, "0")}: {c.title}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            }

            type Action =
              | { label: string; type: "commitment-submenu"; navSuffix: string; unapprovedOnly?: boolean; disabled?: boolean }
              | { label: string; type: "commitment-co-submenu" }
              | { label: string; type: "prime-submenu" }
              | { label: string; type: "prime-action" }
              | { label: string; type: "new-commitment"; commitmentType: string }
              | { label: string; type: "rfq" };

            const actions: Action[] = [
              { label: "Add to Unapproved Commitment", type: "commitment-submenu", navSuffix: "", unapprovedOnly: true, disabled: selectedHasCostAssociation },
              { label: "Add to Unapproved Commitment CO", type: "commitment-co-submenu" },
              { label: "Add to Unapproved Prime PCO", type: "prime-submenu" },
              { label: "Create Commitment CO", type: "commitment-submenu", navSuffix: "?action=co" },
              { label: "Create Client Contract CO", type: "prime-action" },
              { label: "Create Purchase Order Contract", type: "new-commitment", commitmentType: "purchase_order" },
              { label: "Create Subcontract", type: "new-commitment", commitmentType: "subcontract" },
              { label: "Send RFQs", type: "rfq" },
            ];

            return (
              <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded shadow-lg z-30 w-64 py-1">
                {actions.map((action) => (
                  <div
                    key={action.label}
                    className="relative"
                    onMouseEnter={() => { setHoveredAction(action.label); setHoveredSubItem(null); }}
                    onMouseLeave={() => setHoveredAction(null)}
                  >
                    <button
                      disabled={Boolean(action.disabled)}
                      title={action.label === "Add to Unapproved Commitment" && action.disabled ? addToUnapprovedCommitmentDisabledMessage : undefined}
                      aria-label={action.label === "Add to Unapproved Commitment" && action.disabled ? addToUnapprovedCommitmentDisabledMessage : undefined}
                      className={`w-full flex items-center justify-between px-3 py-1.5 text-xs text-gray-700 transition-colors ${
                        action.disabled
                          ? "text-gray-400 bg-gray-50 cursor-not-allowed"
                          : hoveredAction === action.label
                            ? "bg-gray-100"
                            : "hover:bg-gray-50"
                      }`}
                      onClick={() => {
                        if (action.disabled) return;
                        if (action.type === "prime-action") {
                          setQuickActionsOpen(false);
                          setPcoPickerLoading(true);
                          setPcoPickerContracts([]);
                          setPcoPickerOpen(true);
                          fetch(`/api/projects/${projectId}/prime-contracts`)
                            .then((r) => r.json())
                            .then((data: { id: string; contract_number: number; title: string }[]) => {
                              setPcoPickerContracts(Array.isArray(data) ? data : []);
                            })
                            .catch(() => setPcoPickerContracts([]))
                            .finally(() => setPcoPickerLoading(false));
                        } else if (action.type === "new-commitment") {
                          setQuickActionsOpen(false);
                          router.push(`/projects/${projectId}/commitments/new?type=${action.commitmentType}&eventIds=${eventIds}`);
                        } else if (action.type === "rfq") {
                          setQuickActionsOpen(false);
                          router.push(`/projects/${projectId}/change-events/send-rfqs?eventIds=${eventIds}`);
                        }
                        // commitment-submenu and prime-submenu stay open (arrow-based)
                      }}
                    >
                      <span className="flex items-center gap-1">
                        <span>{action.label}</span>
                        {action.label === "Add to Unapproved Commitment" && action.disabled && (
                          <Info
                            className="w-3 h-3 text-gray-400"
                            title={addToUnapprovedCommitmentDisabledMessage}
                            aria-label={addToUnapprovedCommitmentDisabledMessage}
                          />
                        )}
                      </span>
                      {(action.type === "commitment-submenu" || action.type === "prime-submenu" || action.type === "commitment-co-submenu") && !action.disabled && (
                        <ChevronRight className="w-3 h-3 text-gray-400 shrink-0" />
                      )}
                    </button>

                    {/* Commitment submenu */}
                    {action.type === "commitment-submenu" && hoveredAction === action.label && !action.disabled && (
                      <CommitmentSubmenu navSuffix={action.navSuffix} unapprovedOnly={action.unapprovedOnly} />
                    )}

                    {/* Commitment CO submenu (all unapproved commitment COs) */}
                    {action.type === "commitment-co-submenu" && hoveredAction === action.label && (
                      <div
                        className="absolute left-full top-0 bg-white border border-gray-200 rounded shadow-lg z-40 w-80 py-1 max-h-72 overflow-y-auto"
                        onMouseEnter={() => setHoveredAction(action.label)}
                      >
                        {allCommitmentCcos.length === 0 ? (
                          <div className="px-3 py-2 text-xs text-gray-500">
                            No unapproved commitment change orders.
                          </div>
                        ) : (
                          allCommitmentCcos.map((c) => (
                            <button
                              key={c.id}
                              className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
                              onClick={async () => {
                                try {
                                  await addSelectedSovToCommitmentCco(c.id);
                                  setQuickActionsOpen(false);
                                  router.push(`/projects/${projectId}/change-orders/${c.id}`);
                                } catch (err) {
                                  console.error(err);
                                  window.alert("Unable to add selected SOV line items to this commitment CO. Please try again.");
                                }
                              }}
                            >
                              CCO #{c.number}: {c.title || c.contract_name || "Untitled"}
                            </button>
                          ))
                        )}
                      </div>
                    )}

                    {/* Prime PCO submenu (matching + all unapproved prime PCOs) */}
                    {action.type === "prime-submenu" && hoveredAction === action.label && (
                      <div
                        className="absolute left-full top-0 bg-white border border-gray-200 rounded shadow-lg z-40 w-56 py-1"
                        onMouseEnter={() => setHoveredAction(action.label)}
                      >
                        {/* PCOs with matching cost codes */}
                        <div
                          className="relative"
                          onMouseEnter={() => setHoveredSubItem("matching")}
                          onMouseLeave={() => setHoveredSubItem(null)}
                        >
                          <button
                            className={`w-full flex items-center justify-between px-3 py-1.5 text-xs text-gray-700 transition-colors ${
                              hoveredSubItem === "matching" ? "bg-gray-100" : "hover:bg-gray-50"
                            }`}
                          >
                            <span>PCOs with matching cost codes ({matchingPcos.length})</span>
                            {matchingPcos.length > 0 && <ChevronRight className="w-3 h-3 text-gray-400 shrink-0" />}
                          </button>
                          {hoveredSubItem === "matching" && matchingPcos.length > 0 && (
                            <div
                              className="absolute left-full top-0 bg-white border border-gray-200 rounded shadow-lg z-50 w-64 py-1"
                              onMouseEnter={() => setHoveredSubItem("matching")}
                            >
                              {matchingPcos.map((c) => (
                                <button
                                  key={c.id}
                                  className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
                                  onClick={async () => {
                                    try {
                                      await addSelectedSovToPrimePco(c.id);
                                      setQuickActionsOpen(false);
                                      router.push(`/projects/${projectId}/change-orders/${c.id}`);
                                    } catch (err) {
                                      console.error(err);
                                      window.alert("Unable to add selected SOV line items to this PCO. Please try again.");
                                    }
                                  }}
                                >
                                  PCO #{c.number}: {c.title || c.contract_name || "Untitled"}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* All (non-matching) unapproved prime PCOs */}
                        <div
                          className="relative"
                          onMouseEnter={() => setHoveredSubItem("all")}
                          onMouseLeave={() => setHoveredSubItem(null)}
                        >
                          <button
                            className={`w-full flex items-center justify-between px-3 py-1.5 text-xs text-gray-700 transition-colors ${
                              hoveredSubItem === "all" ? "bg-gray-100" : "hover:bg-gray-50"
                            }`}
                          >
                            <span>PCOs ({allPcos.length})</span>
                            {allPcos.length > 0 && <ChevronRight className="w-3 h-3 text-gray-400 shrink-0" />}
                          </button>
                          {hoveredSubItem === "all" && allPcos.length > 0 && (
                            <div
                              className="absolute left-full top-0 bg-white border border-gray-200 rounded shadow-lg z-50 w-64 py-1"
                              onMouseEnter={() => setHoveredSubItem("all")}
                            >
                              {allPcos.map((c) => (
                                <button
                                  key={c.id}
                                  className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
                                  onClick={async () => {
                                    try {
                                      await addSelectedSovToPrimePco(c.id);
                                      setQuickActionsOpen(false);
                                      router.push(`/projects/${projectId}/change-orders/${c.id}`);
                                    } catch (err) {
                                      console.error(err);
                                      window.alert("Unable to add selected SOV line items to this PCO. Please try again.");
                                    }
                                  }}
                                >
                                  PCO #{c.number}: {c.title || c.contract_name || "Untitled"}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            );
          })()}
        </div>}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search"
            className="border border-gray-300 rounded pl-7 pr-3 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-gray-300 w-44"
          />
        </div>

        {/* Add Filter */}
        <div ref={filterRef} className="relative">
          <button
            onClick={() => setFilterOpen((v) => !v)}
            className="flex items-center gap-1 px-3 py-1 text-xs border border-gray-300 rounded text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Add Filter <ChevronDown className="w-3 h-3" />
          </button>
          {filterOpen && (
            <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded shadow-lg z-20 w-48 py-1">
              {["Number", "Title", "Status", "Vendor", "Budget Code", "Date Created"].map((f) => (
                <button
                  key={f}
                  className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
                  onClick={() => setFilterOpen(false)}
                >
                  {f}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Rows/Pagination bar ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-1.5 bg-white shrink-0">
        <div className="flex items-center gap-1.5 text-xs text-gray-600">
          <span>Show Rows:</span>
          <select
            value={showRows}
            onChange={(e) => { setShowRows(Number(e.target.value)); setPage(1); }}
            className="border border-gray-300 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-gray-300"
          >
            {[10, 25, 50, 100].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          {filtered.length > 0 && (
            <span>
              {pageStart + 1}&ndash;{pageEnd} of {filtered.length}
            </span>
          )}
          <span>Page:</span>
          <select
            value={page}
            onChange={(e) => setPage(Number(e.target.value))}
            className="border border-gray-300 rounded px-1.5 py-0.5 text-xs focus:outline-none"
          >
            {Array.from({ length: totalPages }, (_, i) => (
              <option key={i + 1} value={i + 1}>{i + 1}</option>
            ))}
          </select>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="disabled:opacity-30 hover:text-gray-700 transition-colors"
          >
            ‹
          </button>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="disabled:opacity-30 hover:text-gray-700 transition-colors"
          >
            ›
          </button>
        </div>
      </div>

      {/* ── Table ────────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-x-auto">
        {loading ? (
          <div className="text-center py-20 text-gray-400 text-sm">Loading change events…</div>
        ) : activeTab === "summary" ? (
          /* ── Summary Tab ──────────────────────────────────────────────────── */
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-gray-200 bg-white">
                <th colSpan={2} className="w-24 px-2 py-2" />
                <TH>#</TH>
                <TH>Title</TH>
                <TH>Scope</TH>
                <TH>Type</TH>
                <TH>Reason</TH>
                <TH>Status</TH>
                <TH>Origin</TH>
                <TH right>ROM</TH>
                <th className="px-2 py-2 text-xs font-medium text-gray-500 whitespace-nowrap text-right">
                  <span className="inline-flex items-center gap-1">
                    Prime Totals
                    <Info className="w-3 h-3 text-gray-400" />
                  </span>
                </th>
                <TH right>Commitment Totals</TH>
                <TH right>RFQs</TH>
                <TH right>Commitment COs</TH>
                <TH right>Prime PCOs</TH>
              </tr>
            </thead>
            <tbody>
              {pageEvents.length === 0 ? (
                <tr>
                  <td colSpan={15} className="text-center py-20 text-gray-400">
                    No change events found.
                  </td>
                </tr>
              ) : (
                pageEvents.map((ev) => (
                  <tr
                    key={ev.id}
                    className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                  >
                    {/* Edit button – write access only */}
                    <td className="px-1 py-2 whitespace-nowrap">
                      {canWrite && (
                        <button
                          onClick={() => router.push(`/projects/${projectId}/change-events/${ev.id}/edit`)}
                          className="px-2 py-0.5 text-xs border border-gray-300 rounded text-gray-600 hover:bg-gray-50 transition-colors"
                        >
                          Edit
                        </button>
                      )}
                    </td>
                    {/* View button */}
                    <td className="px-1 py-2 whitespace-nowrap">
                      <button
                        onClick={() => router.push(`/projects/${projectId}/change-events/${ev.id}`)}
                        className="px-2 py-0.5 text-xs border border-gray-300 rounded text-gray-600 hover:bg-gray-50 transition-colors"
                      >
                        View
                      </button>
                    </td>
                    {/* # */}
                    <td className="px-2 py-2 text-xs text-gray-700 whitespace-nowrap">
                      {String(ev.number).padStart(3, "0")}
                    </td>
                    {/* Title */}
                    <td className="px-2 py-2 text-xs text-gray-900 min-w-[180px]">
                      {ev.title}
                    </td>
                    {/* Scope */}
                    <td className="px-2 py-2 text-xs text-gray-700 whitespace-nowrap">
                      {ev.scope ?? ""}
                    </td>
                    {/* Type */}
                    <td className="px-2 py-2 text-xs text-gray-700 whitespace-nowrap">
                      {ev.type ?? ""}
                    </td>
                    {/* Reason */}
                    <td className="px-2 py-2 text-xs text-gray-700 whitespace-nowrap">
                      {ev.change_reason ?? ""}
                    </td>
                    {/* Status */}
                    <td className="px-2 py-2 text-xs text-gray-700 whitespace-nowrap">
                      {ev.status}
                    </td>
                    {/* Origin */}
                    <td className="px-2 py-2 text-xs text-gray-700 whitespace-nowrap">
                      {ev.origin ?? ""}
                    </td>
                    {/* ROM */}
                    <NumCell val={ev.rev_rom} />
                    {/* Prime Totals */}
                    <NumCell val={ev.rev_rom} />
                    {/* Commitment Totals */}
                    <NumCell val={ev.cost_commitment} />
                    {/* RFQs */}
                    <NumCell val={ev.cost_rfq} />
                    {/* Commitment COs */}
                    <NumCell val={ev.cost_budget_mod} />
                    {/* Prime PCOs */}
                    <NumCell val={ev.rev_prime_pco} />
                  </tr>
                ))
              )}
            </tbody>
            {pageEvents.length > 0 && (() => {
              type SumKey = "rev_rom" | "cost_commitment" | "cost_rfq" | "cost_budget_mod" | "rev_prime_pco";
              // ROM and Prime Totals both use rev_rom; order matches the 6 financial columns
              const financialKeys: SumKey[] = [
                "rev_rom", "rev_rom", "cost_commitment", "cost_rfq", "cost_budget_mod", "rev_prime_pco",
              ];
              const sumOver = (evList: ChangeEvent[], key: SumKey) =>
                evList.reduce((s, ev) => s + (ev[key] ?? 0), 0);
              const pageTotals = financialKeys.map((k) => sumOver(pageEvents, k));
              const grandTotals = financialKeys.map((k) => sumOver(filtered, k));
              return (
                <tfoot>
                  <tr className="border-t-2 border-gray-300 bg-white font-semibold">
                    <td colSpan={9} className="px-2 py-2 text-xs text-right text-gray-600">
                      Totals
                    </td>
                    {pageTotals.map((t, i) => (
                      <td key={i} className="px-2 py-2 text-right text-xs text-gray-900 whitespace-nowrap">
                        {fmt(t)}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-t border-gray-200 bg-gray-50 font-semibold">
                    <td colSpan={9} className="px-2 py-2 text-xs text-right text-gray-600">
                      Report Grand Totals
                    </td>
                    {grandTotals.map((t, i) => (
                      <td key={i} className="px-2 py-2 text-right text-xs text-gray-900 whitespace-nowrap">
                        {fmt(t)}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              );
            })()}
          </table>
        ) : activeTab !== "detail" ? (
          <div className="text-center py-20 text-gray-400 text-sm">
            {activeTab === "recycle_bin" ? "Recycle Bin is empty." : "No data to display for this view."}
          </div>
        ) : (
          <table className="w-full text-xs border-collapse">
            <thead>
              {/* Column group headers */}
              <tr className="border-b border-gray-100 bg-white">
                {/* Expand + checkbox + title area */}
                <th colSpan={detailHeaderColSpan} className="px-2 py-1">
                  <button
                    onClick={toggleExpandAll}
                    disabled={pageEvents.length === 0}
                    className="inline-flex items-center text-gray-400 hover:text-gray-700 disabled:opacity-30 transition-colors"
                    title={allExpandedOnPage ? "Collapse all" : "Expand all"}
                    aria-label={allExpandedOnPage ? "Collapse all change events" : "Expand all change events"}
                  >
                    {allExpandedOnPage ? (
                      <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5" />
                    )}
                  </button>
                </th>
                {/* Revenue group */}
                <th colSpan={5} className="px-2 py-1 text-center text-xs font-semibold text-gray-600 border-b border-gray-200">
                  Revenue
                </th>
                {/* Cost group */}
                <th colSpan={8} className="px-2 py-1 text-center text-xs font-semibold text-gray-600 border-b border-gray-200">
                  Cost
                </th>
              </tr>
              {/* Column headers */}
              <tr className="border-b border-gray-200 bg-white">
                <th className="w-6 px-1 py-2">
                  <button
                    onClick={toggleExpandAll}
                    disabled={pageEvents.length === 0}
                    className="inline-flex items-center text-gray-400 hover:text-gray-700 disabled:opacity-30 transition-colors"
                    title={allExpandedOnPage ? "Collapse all" : "Expand all"}
                    aria-label={allExpandedOnPage ? "Collapse all change events" : "Expand all change events"}
                  >
                    {allExpandedOnPage ? (
                      <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5" />
                    )}
                  </button>
                </th>
                <th className="w-6 px-1 py-2">
                  <input
                    ref={pageCheckboxRef}
                    type="checkbox"
                    checked={allLineItemsSelected}
                    onChange={toggleSelectAllLineItems}
                    className="rounded border-gray-300"
                    aria-label="Select all SOV items on page"
                  />
                </th>
                <TH>Change Event</TH>
                {showExpandedDetailColumns && (
                  <>
                    <TH>Budget Code</TH>
                    <TH>Description</TH>
                    <TH>Vendor</TH>
                    <TH>Contract</TH>
                    <TH>UOM</TH>
                  </>
                )}
                {/* Revenue */}
                <TH right>Unit Qty</TH>
                <TH right>Unit Cost</TH>
                <TH right>ROM</TH>
                <TH right>Prime PCO</TH>
                <TH right>Latest Price</TH>
                {/* Cost */}
                <TH right>Unit Qty</TH>
                <TH right>Unit Cost</TH>
                <TH right>ROM</TH>
                <TH right>RFQ</TH>
                <TH right>Commitment</TH>
                <TH right>Latest Cost</TH>
                <TH right>Over / Under</TH>
                <TH right>Budget Modification</TH>
              </tr>
            </thead>
            <tbody>
              {pageEvents.length === 0 ? (
                <tr>
                  <td colSpan={detailTableColSpan} className="text-center py-20 text-gray-400">
                    No change events found.
                  </td>
                </tr>
              ) : (
                pageEvents.map((ev) => {
                  const expanded = expandedIds.has(ev.id);
                  const selected = selectedIds.has(ev.id);
                  return (
                    <Fragment key={ev.id}>
                      {/* ── Event row ─────────────────────────────────────── */}
                      <tr
                        className={`border-b border-gray-100 transition-colors ${
                          selected ? "bg-blue-50" : "hover:bg-gray-50"
                        }`}
                      >
                        {/* Expand toggle */}
                        <td className="w-6 px-1 py-2">
                          <button
                            onClick={() => toggleExpand(ev.id)}
                            className="text-gray-400 hover:text-gray-700 transition-colors"
                          >
                            {expanded ? (
                              <ChevronDown className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </td>
                        {/* Checkbox */}
                        <td className="w-6 px-1 py-2">
                          <input
                            type="checkbox"
                            checked={ev.line_items.length > 0
                              ? ev.line_items.every((li) => selectedLineItemIds.has(li.id))
                              : selected}
                            ref={(el) => {
                              if (!el || ev.line_items.length === 0) return;
                              const allItemsSelected = ev.line_items.every((li) => selectedLineItemIds.has(li.id));
                              const hasAnyItemsSelected = ev.line_items.some((li) => selectedLineItemIds.has(li.id));
                              el.indeterminate = !allItemsSelected && hasAnyItemsSelected;
                            }}
                            onChange={() => toggleEventLineItems(ev)}
                            onClick={(e) => e.stopPropagation()}
                            className="rounded border-gray-300"
                            aria-label={`Select all SOV items for change event ${String(ev.number).padStart(3, "0")}`}
                          />
                        </td>
                        {/* Title */}
                        <td className="px-2 py-2">
                          <button
                            onClick={() =>
                              router.push(`/projects/${projectId}/change-events/${ev.id}`)
                            }
                            className="text-blue-600 hover:underline text-left"
                          >
                            Change Event #{String(ev.number).padStart(3, "0")}: {ev.title}
                          </button>
                        </td>
                        {showExpandedDetailColumns && (
                          <>
                            <td className="px-2 py-2" />
                            <td className="px-2 py-2" />
                            <td className="px-2 py-2" />
                            <td className="px-2 py-2" />
                            <td className="px-2 py-2" />
                          </>
                        )}
                        {/* Revenue */}
                        <NumCell val={ev.rev_unit_qty} qty />
                        <NumCell val={ev.rev_unit_cost} />
                        <NumCell val={ev.rev_rom} />
                        <NumCell val={ev.rev_prime_pco} />
                        <NumCell val={ev.rev_latest_price} />
                        {/* Cost */}
                        <NumCell val={ev.cost_unit_qty} qty />
                        <NumCell val={ev.cost_unit_cost} />
                        <NumCell val={ev.cost_rom} />
                        <NumCell val={ev.cost_rfq} />
                        <NumCell val={ev.cost_commitment} />
                        <NumCell val={ev.cost_latest} blue />
                        <NumCell val={ev.cost_over_under} />
                        <NumCell val={ev.cost_budget_mod} />
                      </tr>

                      {/* ── Expanded line items ────────────────────────────── */}
                      {expanded &&
                        (ev.line_items.length === 0 ? (
                          <tr key={`${ev.id}-empty`} className="bg-gray-50 border-b border-gray-100">
                            <td colSpan={detailTableColSpan} className="px-8 py-3 text-xs text-gray-400 italic">
                              No line items on this change event.
                            </td>
                          </tr>
                        ) : (
                          ev.line_items.map((li) => (
                            <tr
                              key={li.id}
                              className="bg-gray-50 border-b border-gray-100 hover:bg-gray-100 transition-colors"
                            >
                              {/* Indent spacer */}
                              <td className="w-6 px-1 py-1.5" />
                              {/* Edit button – write access only */}
                              <td className="w-6 px-1 py-1.5">
                                <input
                                  type="checkbox"
                                  checked={selectedLineItemIds.has(li.id)}
                                  onChange={() => toggleLineItem(li.id)}
                                  className="rounded border-gray-300"
                                  aria-label="Select SOV item"
                                />
                              </td>
                              {showExpandedDetailColumns ? (
                                <>
                                  <td className="px-2 py-1.5">
                                    {canWrite && (
                                      <button
                                        className="flex items-center gap-0.5 px-1.5 py-0.5 text-xs border border-gray-300 rounded text-gray-600 hover:bg-white transition-colors"
                                        onClick={() =>
                                          router.push(
                                            `/projects/${projectId}/change-events/${ev.id}/edit`
                                          )
                                        }
                                      >
                                        <Pencil className="w-2.5 h-2.5" />
                                        Edit
                                      </button>
                                    )}
                                  </td>
                                  <td className="px-2 py-1.5 text-xs font-medium text-gray-700">{li.budget_code ?? "—"}</td>
                                  <td className="px-2 py-1.5 text-xs text-gray-600">{li.description ?? "—"}</td>
                                  <td className="px-2 py-1.5 text-xs text-gray-600">{li.vendor ?? "—"}</td>
                                  <td className="px-2 py-1.5 text-xs text-gray-600">{li.contract_number ?? "—"}</td>
                                  <td className="px-2 py-1.5 text-xs text-gray-600">{li.unit_of_measure ?? "—"}</td>
                                </>
                              ) : (
                                <td className="px-2 py-1.5">
                                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                                    {canWrite && (
                                      <button
                                        className="flex items-center gap-0.5 px-1.5 py-0.5 text-xs border border-gray-300 rounded text-gray-600 hover:bg-white transition-colors"
                                        onClick={() =>
                                          router.push(
                                            `/projects/${projectId}/change-events/${ev.id}/edit`
                                          )
                                        }
                                      >
                                        <Pencil className="w-2.5 h-2.5" />
                                        Edit
                                      </button>
                                    )}
                                    <span className="font-medium text-gray-700 text-xs">
                                      {li.budget_code ?? "—"}
                                    </span>
                                    {li.description && (
                                      <span className="text-gray-500 text-xs">{li.description}</span>
                                    )}
                                    {li.vendor && (
                                      <span className="text-gray-500 text-xs">{li.vendor}</span>
                                    )}
                                    {li.contract_number && (
                                      <span className="text-blue-500 text-xs">{li.contract_number}</span>
                                    )}
                                    {li.schedule_impact && (
                                      <span className="text-gray-400 text-xs italic">
                                        {li.schedule_impact}
                                      </span>
                                    )}
                                  </div>
                                </td>
                              )}
                              {/* Revenue */}
                              <NumCell val={li.rev_unit_qty} qty />
                              <NumCell val={li.rev_unit_cost} />
                              <td className="px-2 py-1.5 text-right text-xs whitespace-nowrap">
                                {canWrite ? (
                                  <button
                                    onClick={(e) => openRomPopup(e, li, ev.id)}
                                    className="text-blue-600 hover:underline font-medium cursor-pointer"
                                    title="Click to edit"
                                  >
                                    {li.rev_rom != null && li.rev_rom !== 0
                                      ? li.rev_rom.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 })
                                      : "$0.00"}
                                  </button>
                                ) : (
                                  <span className="font-medium text-gray-900">
                                    {li.rev_rom != null && li.rev_rom !== 0
                                      ? li.rev_rom.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 })
                                      : "$0.00"}
                                  </span>
                                )}
                              </td>
                              <NumCell val={li.rev_prime_pco} />
                              <NumCell val={li.rev_latest_price} />
                              {/* Cost */}
                              <NumCell val={li.cost_unit_qty} qty />
                              <NumCell val={li.cost_unit_cost} />
                              <NumCell val={li.cost_rom} />
                              <NumCell val={li.cost_rfq} />
                              <NumCell val={li.cost_commitment} />
                              <NumCell val={li.cost_latest} blue />
                              <NumCell val={li.cost_over_under} />
                              <NumCell val={li.cost_budget_mod} />
                            </tr>
                          ))
                        ))}
                    </Fragment>
                  );
                })
              )}
            </tbody>

            {/* ── Footer totals ─────────────────────────────────────────────── */}
            {pageEvents.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-gray-300 bg-white font-semibold">
                  <td colSpan={detailHeaderColSpan} className="px-2 py-2 text-xs text-right text-gray-600">
                    Totals
                  </td>
                  {(
                    [
                      "rev_unit_qty",
                      "rev_unit_cost",
                      "rev_rom",
                      "rev_prime_pco",
                      "rev_latest_price",
                      "cost_unit_qty",
                      "cost_unit_cost",
                      "cost_rom",
                      "cost_rfq",
                      "cost_commitment",
                      "cost_latest",
                      "cost_over_under",
                      "cost_budget_mod",
                    ] as const
                  ).map((key) => {
                    const total = pageEvents.reduce(
                      (sum, ev) => sum + (ev[key] ?? 0),
                      0
                    );
                    return (
                      <td key={key} className="px-2 py-2 text-right text-xs text-gray-900 whitespace-nowrap">
                        {key === "rev_unit_qty" || key === "cost_unit_qty" ? fmtQty(total) : fmt(total)}
                      </td>
                    );
                  })}
                </tr>
              </tfoot>
            )}
          </table>
        )}
      </div>

      {/* ── Bottom pagination ─────────────────────────────────────────────────── */}
      {filtered.length > 0 && (
        <div className="flex items-center justify-end gap-2 px-4 py-2 border-t border-gray-100 text-xs text-gray-500 shrink-0">
          <span>
            {pageStart + 1}&ndash;{pageEnd} of {filtered.length}
          </span>
          <span>Page:</span>
          <select
            value={page}
            onChange={(e) => setPage(Number(e.target.value))}
            className="border border-gray-300 rounded px-1.5 py-0.5 text-xs focus:outline-none"
          >
            {Array.from({ length: totalPages }, (_, i) => (
              <option key={i + 1} value={i + 1}>{i + 1}</option>
            ))}
          </select>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="disabled:opacity-30 hover:text-gray-700 transition-colors"
          >
            ‹
          </button>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="disabled:opacity-30 hover:text-gray-700 transition-colors"
          >
            ›
          </button>
        </div>
      )}

      {/* ── Create Prime PCO – Contract Picker Modal ──────────────────────────── */}
      {pcoPickerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={(e) => { if (e.target === e.currentTarget) setPcoPickerOpen(false); }}
        >
          <div className="bg-white rounded-lg shadow-xl w-[480px] max-h-[80vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h2 className="text-sm font-semibold text-gray-900">Select a Prime Contract</h2>
              <button
                onClick={() => setPcoPickerOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-3">
              {pcoPickerLoading ? (
                <p className="text-xs text-gray-500 py-4 text-center">Loading contracts…</p>
              ) : pcoPickerContracts.length === 0 ? (
                <p className="text-xs text-gray-500 py-4 text-center">No prime contracts found for this project.</p>
              ) : (
                <div className="divide-y divide-gray-100 border border-gray-200 rounded">
                  {pcoPickerContracts.map((c) => (
                    <button
                      key={c.id}
                      className="w-full text-left px-3 py-2.5 text-xs text-gray-800 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                      onClick={() => {
                        setPcoPickerOpen(false);
                        const eventIds = Array.from(selectedEventIds).join(",");
                        const lineItemIds = Array.from(selectedLineItemIds).join(",");
                        const query = new URLSearchParams();
                        if (eventIds) query.set("eventIds", eventIds);
                        if (lineItemIds) query.set("lineItemIds", lineItemIds);
                        router.push(`/projects/${projectId}/prime-contracts/${c.id}/change-orders/new?${query.toString()}`);
                      }}
                    >
                      {c.contract_number} – {c.title}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setPcoPickerOpen(false)}
                className="px-4 py-1.5 text-xs text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ROM Edit Popup ────────────────────────────────────────────────────── */}
      {romPopup && (
        <div
          ref={popupRef}
          className="fixed z-50 bg-white border border-gray-200 rounded-lg shadow-xl w-[360px] p-4"
          style={{ top: romPopup.top, left: romPopup.left }}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">Edit Line Item</h3>
            <button
              onClick={() => setRomPopup(null)}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Detail fields */}
          <div className="space-y-2 mb-4">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-gray-500 mb-0.5">Budget Code</label>
                <input
                  type="text"
                  value={romPopup.budgetCode}
                  onChange={(e) => setRomPopup((p) => p ? { ...p, budgetCode: e.target.value } : p)}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-0.5">Description</label>
                <input
                  type="text"
                  value={romPopup.description}
                  onChange={(e) => setRomPopup((p) => p ? { ...p, description: e.target.value } : p)}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-gray-500 mb-0.5">Vendor</label>
                <input
                  type="text"
                  value={romPopup.vendor}
                  onChange={(e) => setRomPopup((p) => p ? { ...p, vendor: e.target.value } : p)}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-0.5">Contract #</label>
                <input
                  type="text"
                  value={romPopup.contractNumber}
                  onChange={(e) => setRomPopup((p) => p ? { ...p, contractNumber: e.target.value } : p)}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
              </div>
            </div>
          </div>

          {/* Revenue section */}
          <div className="mb-3">
            <p className="text-xs font-semibold text-blue-600 mb-1.5">Revenue</p>
            <div className="grid grid-cols-3 gap-2 items-end">
              <div>
                <label className="block text-xs text-gray-500 mb-0.5">Unit Qty</label>
                <input
                  type="number"
                  value={romPopup.revUnitQty}
                  onChange={(e) => setRomPopup((p) => p ? { ...p, revUnitQty: e.target.value } : p)}
                  placeholder="0"
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-0.5">Unit Cost</label>
                <input
                  type="number"
                  value={romPopup.revUnitCost}
                  onChange={(e) => setRomPopup((p) => p ? { ...p, revUnitCost: e.target.value } : p)}
                  placeholder="0.00"
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-0.5">ROM</label>
                <div className="border border-gray-200 rounded px-2 py-1.5 text-xs bg-gray-50 text-gray-700 font-medium">
                  {((parseFloat(romPopup.revUnitQty) || 0) * (parseFloat(romPopup.revUnitCost) || 0)).toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>
          </div>

          {/* Cost section */}
          <div className="mb-4">
            <p className="text-xs font-semibold text-gray-600 mb-1.5">Cost</p>
            <div className="grid grid-cols-3 gap-2 items-end">
              <div>
                <label className="block text-xs text-gray-500 mb-0.5">Unit Qty</label>
                <input
                  type="number"
                  value={romPopup.costUnitQty}
                  onChange={(e) => setRomPopup((p) => p ? { ...p, costUnitQty: e.target.value } : p)}
                  placeholder="0"
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-0.5">Unit Cost</label>
                <input
                  type="number"
                  value={romPopup.costUnitCost}
                  onChange={(e) => setRomPopup((p) => p ? { ...p, costUnitCost: e.target.value } : p)}
                  placeholder="0.00"
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-0.5">ROM</label>
                <div className="border border-gray-200 rounded px-2 py-1.5 text-xs bg-gray-50 text-gray-700 font-medium">
                  {((parseFloat(romPopup.costUnitQty) || 0) * (parseFloat(romPopup.costUnitCost) || 0)).toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => setRomPopup(null)}
              className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={saveRomPopup}
              disabled={romSaving}
              className="flex items-center gap-1 px-3 py-1.5 text-xs bg-gray-900 text-white rounded hover:bg-gray-700 transition-colors disabled:opacity-50 font-medium"
            >
              <Check className="w-3 h-3" />
              {romSaving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
