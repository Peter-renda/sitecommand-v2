"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import ProjectNav from "@/components/ProjectNav";
import AppHeader from "@/app/components/AppHeader";
import { ChevronDown, ChevronRight, EllipsisVertical, Paperclip, Pencil, Search, X } from "lucide-react";
import RelatedItemsTab from "./RelatedItemsTab";

type LineItem = {
  id: string;
  budget_code: string | null;
  description: string | null;
  vendor: string | null;
  contract_number: string | null;
  unit_of_measure: string | null;
  rev_unit_qty: number | null;
  rev_unit_cost: number | null;
  rev_rom: number | null;
  rev_prime_pco?: number | null;
  rev_latest_price?: number | null;
  cost_unit_qty: number | null;
  cost_unit_cost: number | null;
  cost_rom: number | null;
  cost_commitment?: number | null;
};

type ChangeEvent = {
  id: string;
  number: number;
  title: string;
  status: string;
  origin: string | null;
  type: string | null;
  change_reason: string | null;
  scope: string | null;
  expecting_revenue: boolean;
  revenue_source: string | null;
  prime_contract: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
  line_items: LineItem[];
  attached_instances_count?: number;
  delete_blocked?: boolean;
};
type PrimePcoOption = { id: string; number: string; title: string; contract_name: string | null };
type BudgetLine = {
  id: string;
  cost_code: string;
  description: string | null;
  budget_modifications: number;
  original_budget_amount: number;
  approved_cos: number;
  pending_budget_changes: number;
  committed_costs: number;
  job_to_date_costs: number;
  commitments_invoiced: number;
  pending_cost_changes: number;
};

type TabKey = "General" | "Related Items" | "Comments" | "Emails" | "Change History" | "Advanced Settings";

type CommentItem = {
  id: string;
  message: string;
  attachments: string[];
  createdAt: string;
};

type HistoryItem = {
  id: string;
  action: string;
  from_value: string | null;
  to_value: string | null;
  changed_by_name: string | null;
  changed_by_company: string | null;
  created_at: string;
};

function fmt(val: number | null | undefined) {
  if (val === null || val === undefined) return "—";
  return val.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short",
  });
}

function fmtQty(val: number | null | undefined) {
  if (val === null || val === undefined) return "—";
  return val.toLocaleString("en-US", { minimumFractionDigits: 2 });
}

function MetricField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-sm font-semibold text-gray-900">{value || "—"}</span>
    </div>
  );
}

function InfoField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-sm text-gray-900">{value || "—"}</p>
    </div>
  );
}

export default function ChangeEventDetailClient({
  projectId,
  eventId,
  canWrite,
  username,
}: {
  projectId: string;
  eventId: string;
  canWrite: boolean;
  username?: string;
}) {
  const router = useRouter();
  const [event, setEvent] = useState<ChangeEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("General");
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [newComment, setNewComment] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [cloning, setCloning] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const actionsRef = useRef<HTMLDivElement>(null);
  const [selectedLineItemIds, setSelectedLineItemIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const [matchingPcos, setMatchingPcos] = useState<PrimePcoOption[]>([]);
  const [allPcos, setAllPcos] = useState<PrimePcoOption[]>([]);
  const [allCommitments, setAllCommitments] = useState<{ id: string; number: number; title: string; type: string; status: string | null }[]>([]);
  const [pcoPickerOpen, setPcoPickerOpen] = useState(false);
  const [pcoPickerLoading, setPcoPickerLoading] = useState(false);
  const [pcoPickerContracts, setPcoPickerContracts] = useState<{ id: string; contract_number: number; title: string }[]>([]);
  const [budgetModalOpen, setBudgetModalOpen] = useState(false);
  const [budgetModalLoading, setBudgetModalLoading] = useState(false);
  const [budgetSaving, setBudgetSaving] = useState(false);
  const [budgetItems, setBudgetItems] = useState<BudgetLine[]>([]);
  const [budgetFromId, setBudgetFromId] = useState("");
  const [budgetToId, setBudgetToId] = useState("");
  const [budgetAmount, setBudgetAmount] = useState("");
  const [budgetNotes, setBudgetNotes] = useState("");
  const [budgetError, setBudgetError] = useState<string | null>(null);
  const lineItems = event?.line_items ?? [];
  const filteredLineItems = lineItems.filter((li) =>
    search
      ? `${li.budget_code ?? ""} ${li.description ?? ""} ${li.vendor ?? ""} ${li.contract_number ?? ""}`
          .toLowerCase()
          .includes(search.toLowerCase())
      : true
  );
  const selectedLineItems = lineItems.filter((li) => selectedLineItemIds.has(li.id));
  const hasSelection = selectedLineItemIds.size > 0;

  useEffect(() => {
    fetch(`/api/projects/${projectId}/change-events/${eventId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setEvent(data);
          setError(null);
        }
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load change event.");
        setLoading(false);
      });
  }, [projectId, eventId]);

  useEffect(() => {
    if (activeTab !== "Change History" || historyLoaded) return;
    fetch(`/api/projects/${projectId}/change-events/${eventId}/history`)
      .then((r) => r.json())
      .then((data) => {
        setHistory(Array.isArray(data) ? data : []);
        setHistoryLoaded(true);
      })
      .catch(() => {
        setHistory([]);
        setHistoryLoaded(true);
      });
  }, [activeTab, historyLoaded, projectId, eventId]);

  useEffect(() => {
    function closeMenus(e: MouseEvent) {
      if (actionsRef.current && !actionsRef.current.contains(e.target as Node)) {
        setActionsOpen(false);
        setQuickActionsOpen(false);
      }
    }
    document.addEventListener("mousedown", closeMenus);
    return () => document.removeEventListener("mousedown", closeMenus);
  }, []);

  const totalRevRom = lineItems.reduce((s, li) => s + (li.rev_rom ?? 0), 0);
  const totalCostRom = lineItems.reduce((s, li) => s + (li.cost_rom ?? 0), 0);
  const tabs: TabKey[] = ["General", "Related Items", "Comments", "Emails", "Change History", "Advanced Settings"];
  const canSendComment = newComment.trim().length > 0 || pendingFiles.length > 0;

  useEffect(() => {
    if (!quickActionsOpen || !hasSelection) return;
    fetch(`/api/projects/${projectId}/change-events/matching-prime-contracts?eventIds=${eventId}`)
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
  }, [quickActionsOpen, hasSelection, projectId, eventId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAF7] flex flex-col">
        <AppHeader username={username} />
        <ProjectNav projectId={projectId} />
        <div className="flex-1 flex items-center justify-center text-sm text-gray-400">Loading…</div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="min-h-screen bg-[#FAFAF7] flex flex-col">
        <AppHeader username={username} />
        <ProjectNav projectId={projectId} />
        <div className="flex-1 flex items-center justify-center text-sm text-red-500">{error ?? "Change event not found."}</div>
      </div>
    );
  }

  function handleFilePick(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setPendingFiles((prev) => [...prev, ...Array.from(fileList)]);
  }

  function handleSendComment() {
    if (!canSendComment) return;

    setComments((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        message: newComment.trim(),
        attachments: pendingFiles.map((file) => file.name),
        createdAt: new Date().toISOString(),
      },
    ]);
    setNewComment("");
    setPendingFiles([]);
  }

  async function handleClone() {
    if (!event || cloning) return;
    setActionsOpen(false);
    setCloning(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/change-events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `${event.title} (Copy)`,
          status: event.status || "Open",
          origin: event.origin,
          type: event.type,
          change_reason: event.change_reason,
          scope: event.scope,
          expecting_revenue: event.expecting_revenue,
          revenue_source: event.revenue_source,
          prime_contract: event.prime_contract,
          description: event.description,
          line_items: event.line_items.map((li) => ({
            budget_code: li.budget_code,
            description: li.description,
            vendor: li.vendor,
            contract_number: li.contract_number,
            unit_of_measure: li.unit_of_measure,
            rev_unit_qty: li.rev_unit_qty,
            rev_unit_cost: li.rev_unit_cost,
            rev_rom: li.rev_rom,
            cost_unit_qty: li.cost_unit_qty,
            cost_unit_cost: li.cost_unit_cost,
            cost_rom: li.cost_rom,
          })),
        }),
      });
      if (!res.ok) throw new Error("Failed to clone change event");
      const data = await res.json();
      if (data?.id) {
        router.push(`/projects/${projectId}/change-events/${data.id}`);
        return;
      }
      router.push(`/projects/${projectId}/change-events`);
    } catch {
      window.alert("Unable to clone this change event.");
    } finally {
      setCloning(false);
    }
  }

  function handleEmail() {
    if (!event) return;
    setActionsOpen(false);
    const subject = encodeURIComponent(`Change Event #${String(event.number).padStart(3, "0")}: ${event.title}`);
    const body = encodeURIComponent(`Please review Change Event #${String(event.number).padStart(3, "0")} in SiteCommand.`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  }

  async function handleDelete() {
    if (deleting) return;
    if (event?.delete_blocked) return;
    const confirmed = window.confirm("Delete this change event? This action cannot be undone.");
    if (!confirmed) return;
    setActionsOpen(false);
    setDeleting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/change-events/${eventId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(typeof data?.error === "string" ? data.error : "Unable to delete change event.");
      }
      router.push(`/projects/${projectId}/change-events`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to delete change event.";
      window.alert(message);
      setDeleting(false);
    }
  }

  function toggleLineItem(id: string) {
    setSelectedLineItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    const ids = filteredLineItems.map((li) => li.id);
    setSelectedLineItemIds((prev) => {
      const next = new Set(prev);
      const allSelected = ids.length > 0 && ids.every((id) => next.has(id));
      if (allSelected) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
  }

  async function addSelectedSovToPrimePco(changeOrderId: string) {
    const selectedSovLineItems = selectedLineItems;
    const newSovLines = selectedSovLineItems.map((li) => ({
      budget_code: (li.budget_code ?? "").trim(),
      description: (li.description ?? "").trim(),
      amount: Number(li.cost_rom ?? li.rev_rom ?? 0),
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

    const patchRes = await fetch(`/api/projects/${projectId}/change-orders/${changeOrderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        budget_codes: Array.from(new Set([...(Array.isArray(existing.budget_codes) ? existing.budget_codes : []), ...newSovLines.map((line) => line.budget_code).filter(Boolean)])),
        source_change_event_ids: Array.from(new Set([...(Array.isArray(existing.source_change_event_ids) ? existing.source_change_event_ids : []), event.id])),
        schedule_of_values: Array.from(mergedSovMap.values()),
      }),
    });
    if (!patchRes.ok) throw new Error("Failed to add selected SOV to the PCO.");
  }

  const selectedBudgetLine = budgetItems.find((item) => item.id === budgetToId) ?? null;

  async function openBudgetModificationModal() {
    if (selectedLineItems.length !== 1) {
      window.alert("Select exactly one change event line item to create a budget modification.");
      return;
    }
    setQuickActionsOpen(false);
    setBudgetModalOpen(true);
    setBudgetModalLoading(true);
    setBudgetError(null);
    setBudgetAmount("");
    setBudgetNotes("");
    try {
      const res = await fetch(`/api/projects/${projectId}/budget`);
      const data = await res.json();
      const rows = Array.isArray(data) ? (data as BudgetLine[]) : [];
      setBudgetItems(rows);
      const selected = selectedLineItems[0];
      const defaultTo = rows.find((row) => (row.cost_code ?? "").trim() === (selected.budget_code ?? "").trim());
      setBudgetToId(defaultTo?.id ?? "");
      setBudgetFromId("");
      if (!defaultTo) {
        setBudgetError("No matching budget line item was found for this change event line item. Select a destination line item.");
      }
    } catch {
      setBudgetItems([]);
      setBudgetError("Unable to load budget line items.");
    } finally {
      setBudgetModalLoading(false);
    }
  }

  async function handleCreateBudgetModification() {
    if (budgetSaving) return;
    setBudgetError(null);
    const amount = Number(budgetAmount);
    if (!budgetFromId || !budgetToId) {
      setBudgetError("Choose both a source and destination line item.");
      return;
    }
    if (budgetFromId === budgetToId) {
      setBudgetError("Source and destination line items must be different.");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setBudgetError("Enter a transfer amount greater than zero.");
      return;
    }

    const fromItem = budgetItems.find((item) => item.id === budgetFromId);
    const toItem = budgetItems.find((item) => item.id === budgetToId);
    if (!fromItem || !toItem) {
      setBudgetError("Invalid source or destination line item.");
      return;
    }

    setBudgetSaving(true);
    try {
      const patchPayload = (item: BudgetLine, delta: number) => ({
        cost_code: item.cost_code,
        description: item.description,
        original_budget_amount: item.original_budget_amount,
        budget_modifications: Number(item.budget_modifications || 0) + delta,
        approved_cos: item.approved_cos,
        pending_budget_changes: item.pending_budget_changes,
        committed_costs: item.committed_costs,
        job_to_date_costs: item.job_to_date_costs,
        commitments_invoiced: item.commitments_invoiced,
        pending_cost_changes: item.pending_cost_changes,
      });

      const [fromRes, toRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/budget/${fromItem.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patchPayload(fromItem, -amount)),
        }),
        fetch(`/api/projects/${projectId}/budget/${toItem.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patchPayload(toItem, amount)),
        }),
      ]);
      if (!fromRes.ok || !toRes.ok) throw new Error("Unable to update budget line items.");

      const recordRes = await fetch(`/api/projects/${projectId}/budget/modifications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: [
            {
              fromId: fromItem.id,
              toId: toItem.id,
              fromCostCode: fromItem.cost_code,
              toCostCode: toItem.cost_code,
              amount,
              notes: budgetNotes.trim(),
            },
          ],
        }),
      });
      if (!recordRes.ok) throw new Error("Unable to save budget modification record.");

      const selectedLi = selectedLineItems[0];
      setEvent((prev) =>
        prev
          ? {
              ...prev,
              line_items: prev.line_items.map((li) =>
                li.id === selectedLi.id
                  ? { ...li, cost_budget_mod: Number(li.cost_budget_mod ?? 0) + amount }
                  : li
              ),
            }
          : prev
      );
      setBudgetModalOpen(false);
      setBudgetFromId("");
      setBudgetToId("");
      setBudgetAmount("");
      setBudgetNotes("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to create budget modification.";
      setBudgetError(message);
    } finally {
      setBudgetSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#FAFAF7] flex flex-col">
      <AppHeader username={username} />
      <ProjectNav projectId={projectId} />

      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <button onClick={() => router.push(`/projects/${projectId}/change-events`)} className="hover:text-blue-600">
            Change Events
          </button>
          <ChevronRight className="w-3 h-3" />
          <span>Change Event #{String(event.number).padStart(3, "0")}</span>
        </div>
      </div>

      <div className="px-4 pt-3 pb-0 border-b border-gray-200 bg-white">
        <div className="flex items-start justify-between gap-3">
          <h1 className="font-display text-[20px] leading-tight text-[color:var(--ink)]">
            Change Event #{String(event.number).padStart(3, "0")}: {event.title}
          </h1>
          <div className="flex items-center gap-2">
            {canWrite && (
              <button
                onClick={() => router.push(`/projects/${projectId}/change-events/${eventId}/edit`)}
                className="inline-flex items-center gap-1.5 rounded border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </button>
            )}
            <button className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50">
              Export <ChevronDown className="h-3.5 w-3.5" />
            </button>
            <div ref={actionsRef} className="relative">
              <button
                onClick={() => setActionsOpen((open) => !open)}
                className="inline-flex items-center rounded border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
                aria-label="More actions"
              >
                <EllipsisVertical className="h-3.5 w-3.5" />
              </button>
              {actionsOpen && (
                <div className="absolute right-0 z-20 mt-1.5 w-40 rounded-md border border-gray-200 bg-white shadow-lg">
                  <button
                    onClick={handleClone}
                    disabled={cloning || deleting}
                    className="block w-full px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-400"
                  >
                    {cloning ? "Cloning..." : "Clone"}
                  </button>
                  <button
                    onClick={handleEmail}
                    disabled={cloning || deleting}
                    className="block w-full px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-400"
                  >
                    Email
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={deleting || Boolean(event.delete_blocked)}
                    title={
                      event.delete_blocked
                        ? "Cannot delete while related items are attached."
                        : ""
                    }
                    className="block w-full px-3 py-2 text-left text-xs text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:text-gray-400 disabled:hover:bg-white"
                  >
                    {deleting ? "Deleting..." : "Delete"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-2 flex items-center overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                tab === activeTab ? "border-gray-900 text-gray-900" : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-gray-50 px-3 py-3 space-y-3">
        {activeTab === "General" && (
          <>
            <section className="rounded border border-gray-200 bg-white">
          <div className="px-4 py-3 border-b border-gray-200">
            <h2 className="text-sm font-semibold text-gray-900">General Information</h2>
          </div>

          <div className="px-4 py-4 space-y-7">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-7">
              <InfoField label="Number" value={String(event.number).padStart(3, "0")} />
              <InfoField label="Title" value={event.title} />
              <div className="space-y-0.5">
                <p className="text-xs text-gray-500">Status</p>
                <span className="inline-flex rounded-full bg-blue-100 px-2.5 py-0.5 text-xs text-blue-700">{event.status || "—"}</span>
              </div>
              <InfoField label="Origin" value={event.origin} />
              <InfoField label="Type" value={event.type} />
              <InfoField label="Change Reason" value={event.change_reason} />
              <InfoField label="Scope" value={event.scope} />
              <InfoField label="Prime Contract for Markup Estimates" value={event.prime_contract} />
              <InfoField label="Expecting Revenue" value={event.expecting_revenue ? "Yes" : "No"} />
              <InfoField label="Line Item Revenue Source" value={event.revenue_source} />
            </div>

            <div className="space-y-0.5">
              <p className="text-xs text-gray-500">Description</p>
              <p className="text-sm text-gray-900 whitespace-pre-wrap">{event.description || "—"}</p>
            </div>

            <div className="flex gap-10">
              <MetricField label="Total Revenue ROM" value={fmt(totalRevRom)} />
              <MetricField label="Total Cost ROM" value={fmt(totalCostRom)} />
            </div>
          </div>
        </section>

            <section className="rounded border border-gray-200 bg-white">
          <div className="px-4 py-3 border-b border-gray-200">
            <h2 className="text-sm font-semibold text-gray-900 mb-2">Line Items</h2>
            <div className="flex flex-wrap items-center gap-2">
              {canWrite && (
                <div className="relative">
                  <button
                    disabled={!hasSelection}
                    onClick={() => setQuickActionsOpen((v) => !v)}
                    className={`rounded border px-3 py-1 text-xs ${hasSelection ? "border-gray-300 text-gray-700 hover:bg-gray-50" : "border-gray-200 text-gray-400 bg-gray-50 cursor-not-allowed"}`}
                  >
                    Bulk Actions {selectedLineItemIds.size} selected <ChevronDown className="inline h-3 w-3" />
                  </button>
                  {quickActionsOpen && hasSelection && (
                    <div className="absolute left-0 z-20 mt-1 w-72 rounded border border-gray-200 bg-white p-2 shadow-lg text-xs space-y-2">
                      <p className="px-2 text-[11px] text-gray-500">
                        Add selected line items to related workflows, including Budget Modifications.
                      </p>
                      <button onClick={openBudgetModificationModal} className="block w-full text-left rounded px-2 py-1 hover:bg-gray-50">Create Budget Modification</button>
                      <button onClick={() => { setQuickActionsOpen(false); router.push(`/projects/${projectId}/commitments/new?type=purchase_order&eventIds=${event.id}`); }} className="block w-full text-left rounded px-2 py-1 hover:bg-gray-50">Create Purchase Order Contract</button>
                      <button onClick={() => { setQuickActionsOpen(false); router.push(`/projects/${projectId}/commitments/new?type=subcontract&eventIds=${event.id}`); }} className="block w-full text-left rounded px-2 py-1 hover:bg-gray-50">Create Subcontract</button>
                      <button onClick={() => { setQuickActionsOpen(false); router.push(`/projects/${projectId}/change-events/send-rfqs?eventIds=${event.id}`); }} className="block w-full text-left rounded px-2 py-1 hover:bg-gray-50">Send RFQs</button>
                      <button onClick={() => { setQuickActionsOpen(false); setPcoPickerLoading(true); setPcoPickerOpen(true); fetch(`/api/projects/${projectId}/prime-contracts`).then((r) => r.json()).then((data) => setPcoPickerContracts(Array.isArray(data) ? data : [])).catch(() => setPcoPickerContracts([])).finally(() => setPcoPickerLoading(false)); }} className="block w-full text-left rounded px-2 py-1 hover:bg-gray-50">Create Client Contract CO</button>
                      <div className="border-t border-gray-100 pt-2">
                        <p className="px-2 pb-1 text-[11px] text-gray-500">Add to Unapproved Commitment</p>
                        {allCommitments.filter((c) => String(c.status ?? "").trim().toLowerCase() !== "approved").slice(0, 6).map((c) => (
                          <button key={c.id} onClick={() => { setQuickActionsOpen(false); router.push(`/projects/${projectId}/commitments/${c.id}/edit?eventIds=${event.id}`); }} className="block w-full text-left rounded px-2 py-1 hover:bg-gray-50">{String(c.number).padStart(3, "0")}: {c.title}</button>
                        ))}
                        <p className="px-2 pt-1 text-[11px] text-gray-400">Approved commitments are excluded.</p>
                      </div>
                      <div className="border-t border-gray-100 pt-2">
                        <p className="px-2 pb-1 text-[11px] text-gray-500">Add to Unapproved Client Contract CO</p>
                        {[...matchingPcos, ...allPcos].slice(0, 8).map((c) => (
                          <button
                            key={c.id}
                            onClick={async () => {
                              try {
                                await addSelectedSovToPrimePco(c.id);
                                setQuickActionsOpen(false);
                                router.push(`/projects/${projectId}/change-orders/${c.id}`);
                              } catch {
                                window.alert("Unable to add selected SOV line items to this PCO. Please try again.");
                              }
                            }}
                            className="block w-full text-left rounded px-2 py-1 hover:bg-gray-50"
                          >
                            PCO #{c.number}: {c.title || c.contract_name || "Untitled"}
                          </button>
                        ))}
                        <p className="px-2 pt-1 text-[11px] text-gray-400">Approved prime PCOs are excluded.</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
              <div className="relative">
                <Search className="absolute left-2 top-1.5 h-3 w-3 text-gray-400" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} className="rounded border border-gray-300 pl-7 pr-3 py-1 text-xs w-56" placeholder="Search" />
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-gray-600">
              <button className="rounded border border-gray-300 px-3 py-1 text-xs">Show Rows 25 ▾</button>
              <span>{filteredLineItems.length > 0 ? `1-${filteredLineItems.length} of ${filteredLineItems.length}` : "0-0 of 0"}</span>
            </div>
          </div>

          {filteredLineItems.length === 0 ? (
            <p className="text-xs text-gray-400 italic px-4 py-3">No line items.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-100 border-y border-gray-300">
                    <th colSpan={6} className="px-3 py-2 text-left border-r border-gray-300"></th>
                    <th colSpan={4} className="px-3 py-2 text-center font-semibold text-gray-700 border-r border-gray-300">
                      Revenue
                    </th>
                    <th colSpan={3} className="px-3 py-2 text-center font-semibold text-gray-700">
                      Cost
                    </th>
                  </tr>
                  <tr className="bg-gray-100 border-b border-gray-300 text-gray-700 font-medium">
                    <th className="px-3 py-2 text-left whitespace-nowrap">
                      <input type="checkbox" checked={filteredLineItems.length > 0 && filteredLineItems.every((li) => selectedLineItemIds.has(li.id))} onChange={toggleSelectAll} />
                    </th>
                    <th className="px-3 py-2 text-left whitespace-nowrap">Budget Code</th>
                    <th className="px-3 py-2 text-left whitespace-nowrap">Description</th>
                    <th className="px-3 py-2 text-left whitespace-nowrap">Vendor</th>
                    <th className="px-3 py-2 text-left whitespace-nowrap">Contract</th>
                    <th className="px-3 py-2 text-left whitespace-nowrap border-r border-gray-300">UOM</th>
                    <th className="px-3 py-2 text-right whitespace-nowrap">Unit Qty</th>
                    <th className="px-3 py-2 text-right whitespace-nowrap">Unit Cost</th>
                    <th className="px-3 py-2 text-right whitespace-nowrap">ROM</th>
                    <th className="px-3 py-2 text-right whitespace-nowrap border-r border-gray-300">Latest Price</th>
                    <th className="px-3 py-2 text-right whitespace-nowrap">Unit Qty</th>
                    <th className="px-3 py-2 text-right whitespace-nowrap">Unit Cost</th>
                    <th className="px-3 py-2 text-right whitespace-nowrap">ROM</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLineItems.map((li) => (
                    <tr key={li.id} className="border-b border-gray-200 hover:bg-gray-50">
                      <td className="px-3 py-2"><input type="checkbox" checked={selectedLineItemIds.has(li.id)} onChange={() => toggleLineItem(li.id)} /></td>
                      <td className="px-3 py-2 font-medium text-gray-700">{li.budget_code ?? "—"}</td>
                      <td className="px-3 py-2 text-gray-600">{li.description ?? "—"}</td>
                      <td className="px-3 py-2 text-gray-600">{li.vendor ?? "—"}</td>
                      <td className="px-3 py-2 text-gray-600">{li.contract_number ?? "—"}</td>
                      <td className="px-3 py-2 text-gray-600 border-r border-gray-300">{li.unit_of_measure ?? "—"}</td>
                      <td className="px-3 py-2 text-right text-gray-700">{fmtQty(li.rev_unit_qty)}</td>
                      <td className="px-3 py-2 text-right text-gray-700">{fmt(li.rev_unit_cost)}</td>
                      <td className="px-3 py-2 text-right font-medium text-gray-900">{fmt(li.rev_rom)}</td>
                      <td className="px-3 py-2 text-right font-medium text-gray-900 border-r border-gray-300">{fmt(li.rev_rom)}</td>
                      <td className="px-3 py-2 text-right text-gray-700">{fmtQty(li.cost_unit_qty)}</td>
                      <td className="px-3 py-2 text-right text-gray-700">{fmt(li.cost_unit_cost)}</td>
                      <td className="px-3 py-2 text-right font-medium text-gray-900">{fmt(li.cost_rom)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-300 bg-white font-semibold">
                    <td colSpan={6} className="px-3 py-2 text-right text-gray-700 border-r border-gray-300">
                      Totals
                    </td>
                    <td className="px-3 py-2 text-right text-gray-900">{fmtQty(event.line_items.reduce((s, li) => s + (li.rev_unit_qty ?? 0), 0))}</td>
                    <td className="px-3 py-2 text-right text-gray-900">{fmt(event.line_items.reduce((s, li) => s + (li.rev_unit_cost ?? 0), 0))}</td>
                    <td className="px-3 py-2 text-right text-gray-900">{fmt(totalRevRom)}</td>
                    <td className="px-3 py-2 text-right text-gray-900 border-r border-gray-300">{fmt(totalRevRom)}</td>
                    <td className="px-3 py-2 text-right text-gray-900">{fmtQty(event.line_items.reduce((s, li) => s + (li.cost_unit_qty ?? 0), 0))}</td>
                    <td className="px-3 py-2 text-right text-gray-900">{fmt(event.line_items.reduce((s, li) => s + (li.cost_unit_cost ?? 0), 0))}</td>
                    <td className="px-3 py-2 text-right text-gray-900">{fmt(totalCostRom)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </section>
          </>
        )}

        {activeTab === "Comments" && (
          <section className="rounded border border-gray-200 bg-white">
            <div className="px-4 py-3 border-b border-gray-200">
              <h2 className="text-sm font-semibold text-gray-900">Comments</h2>
            </div>

            <div className="px-4 py-4 space-y-4">
              <div className="space-y-3 rounded border border-gray-200 bg-gray-50 p-3">
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Write a comment..."
                  className="min-h-24 w-full rounded border border-gray-300 bg-white p-3 text-sm text-gray-800 outline-none ring-blue-500 focus:ring-1"
                />

                {pendingFiles.length > 0 && (
                  <ul className="space-y-1">
                    {pendingFiles.map((file, idx) => (
                      <li key={`${file.name}-${idx}`} className="flex items-center justify-between rounded border border-gray-200 bg-white px-2 py-1 text-sm text-gray-700">
                        <span className="truncate">{file.name}</span>
                        <button
                          type="button"
                          onClick={() => setPendingFiles((prev) => prev.filter((_, fIdx) => fIdx !== idx))}
                          className="ml-2 text-xs text-gray-500 hover:text-red-600"
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="flex items-center justify-between">
                  <label className="inline-flex cursor-pointer items-center gap-1 rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100">
                    <Paperclip className="h-4 w-4" />
                    Attach files
                    <input
                      type="file"
                      className="hidden"
                      multiple
                      onChange={(e) => {
                        handleFilePick(e.target.files);
                        e.currentTarget.value = "";
                      }}
                    />
                  </label>

                  <button
                    type="button"
                    onClick={handleSendComment}
                    disabled={!canSendComment}
                    className={`rounded px-4 py-1.5 text-sm font-medium text-white ${
                      canSendComment ? "bg-blue-600 hover:bg-blue-700" : "cursor-not-allowed bg-gray-300"
                    }`}
                  >
                    Send
                  </button>
                </div>
              </div>

              {comments.length === 0 ? (
                <p className="text-sm italic text-gray-500">No comments yet.</p>
              ) : (
                <ul className="space-y-2">
                  {comments.map((comment) => (
                    <li key={comment.id} className="rounded border border-gray-200 bg-white p-3">
                      <p className="text-xs text-gray-500">{new Date(comment.createdAt).toLocaleString()}</p>
                      {comment.message && <p className="mt-1 whitespace-pre-wrap text-sm text-gray-800">{comment.message}</p>}
                      {comment.attachments.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {comment.attachments.map((fileName) => (
                            <span key={`${comment.id}-${fileName}`} className="inline-flex items-center gap-1 rounded border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-700">
                              <Paperclip className="h-3 w-3" />
                              {fileName}
                            </span>
                          ))}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        )}

        {activeTab === "Related Items" && (
          <RelatedItemsTab projectId={projectId} eventId={eventId} canWrite={canWrite} />
        )}

        {activeTab === "Change History" && (
          <section className="rounded border border-gray-200 bg-white overflow-hidden">
            <div className="border-b border-gray-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-gray-900">Change History</h2>
            </div>
            {!historyLoaded ? (
              <p className="px-4 py-6 text-sm text-gray-400">Loading...</p>
            ) : history.length === 0 ? (
              <p className="px-4 py-6 text-sm text-gray-400">No change history yet.</p>
            ) : (
              <div className="overflow-x-auto">
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
                        <td className="px-4 py-4 text-xs text-gray-500 align-top whitespace-nowrap">{formatDateTime(entry.created_at)}</td>
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
              </div>
            )}
          </section>
        )}

        {activeTab !== "General" && activeTab !== "Comments" && activeTab !== "Related Items" && activeTab !== "Change History" && (
          <section className="rounded border border-gray-200 bg-white px-4 py-6">
            <p className="text-sm text-gray-500">{activeTab} content coming soon.</p>
          </section>
        )}
      </div>
      {budgetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={(e) => { if (e.target === e.currentTarget) setBudgetModalOpen(false); }}>
          <div className="bg-white rounded-lg shadow-xl w-[560px] max-w-[95vw]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h2 className="text-sm font-semibold text-gray-900">Create Budget Modification</h2>
              <button onClick={() => setBudgetModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
            </div>
            <div className="px-5 py-4 space-y-3">
              {budgetModalLoading ? (
                <p className="text-sm text-gray-500">Loading budget line items…</p>
              ) : (
                <>
                  <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
                    {selectedLineItems[0]?.description || selectedLineItems[0]?.budget_code
                      ? `Change Event Line Item: ${selectedLineItems[0]?.budget_code ?? "—"} — ${selectedLineItems[0]?.description ?? "Untitled"}`
                      : "Select one change event line item to continue."}
                  </div>
                  <label className="block text-xs text-gray-600">
                    From (Source Cost Code)
                    <select
                      value={budgetFromId}
                      onChange={(e) => setBudgetFromId(e.target.value)}
                      className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                    >
                      <option value="">Select source line item…</option>
                      {budgetItems.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.cost_code} — {item.description || "No description"}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-xs text-gray-600">
                    To (Selected Change Event Cost Code)
                    <select
                      value={budgetToId}
                      onChange={(e) => setBudgetToId(e.target.value)}
                      className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                    >
                      <option value="">Select destination line item…</option>
                      {budgetItems.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.cost_code} — {item.description || "No description"}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-xs text-gray-600">
                    Transfer Amount
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={budgetAmount}
                      onChange={(e) => setBudgetAmount(e.target.value)}
                      className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                      placeholder="0.00"
                    />
                  </label>
                  <label className="block text-xs text-gray-600">
                    Notes
                    <textarea
                      value={budgetNotes}
                      onChange={(e) => setBudgetNotes(e.target.value)}
                      className="mt-1 min-h-20 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                      placeholder="Add notes for this transfer."
                    />
                  </label>
                  {selectedBudgetLine && (
                    <p className="text-[11px] text-gray-500">
                      Destination cost code: <span className="font-medium text-gray-700">{selectedBudgetLine.cost_code}</span>
                    </p>
                  )}
                  {budgetError && <p className="text-xs text-red-600">{budgetError}</p>}
                </>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-200">
              <button onClick={() => setBudgetModalOpen(false)} className="rounded border border-gray-300 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50">Cancel</button>
              <button
                onClick={handleCreateBudgetModification}
                disabled={budgetModalLoading || budgetSaving}
                className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
              >
                {budgetSaving ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
      {pcoPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={(e) => { if (e.target === e.currentTarget) setPcoPickerOpen(false); }}>
          <div className="bg-white rounded-lg shadow-xl w-[480px] max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h2 className="text-sm font-semibold text-gray-900">Select a Prime Contract</h2>
              <button onClick={() => setPcoPickerOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-3">
              {pcoPickerLoading ? (
                <p className="text-xs text-gray-500 py-4 text-center">Loading contracts…</p>
              ) : pcoPickerContracts.length === 0 ? (
                <p className="text-xs text-gray-500 py-4 text-center">No prime contracts found for this project.</p>
              ) : (
                <div className="divide-y divide-gray-100 border border-gray-200 rounded">
                  {pcoPickerContracts.map((c) => (
                    <button key={c.id} className="w-full text-left px-3 py-2.5 text-xs text-gray-800 hover:bg-blue-50 hover:text-blue-700 transition-colors" onClick={() => { setPcoPickerOpen(false); const lineItemIdsParam = Array.from(selectedLineItemIds).join(","); router.push(`/projects/${projectId}/prime-contracts/${c.id}/change-orders/new?eventIds=${event.id}${lineItemIdsParam ? `&lineItemIds=${lineItemIdsParam}` : ""}`); }}>
                      {c.contract_number} – {c.title}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
