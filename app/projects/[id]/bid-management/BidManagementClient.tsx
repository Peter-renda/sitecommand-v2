"use client";

import { useState, useEffect } from "react";
import ProjectNav from "@/components/ProjectNav";
import AppHeader from "@/app/components/AppHeader";

// ─── Types ────────────────────────────────────────────────────────────────────

type PackageStatus = "draft" | "open" | "leveling" | "awarded" | "cancelled";
type BidStatus = "invited" | "viewed" | "submitted" | "declined" | "awarded";

type BidPackage = {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  scope_of_work: string | null;
  due_date: string | null;
  status: PackageStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  bid_count: number;
};

type Bid = {
  id: string;
  bid_package_id: string;
  project_id: string;
  company_name: string;
  contact_name: string | null;
  contact_email: string | null;
  status: BidStatus;
  base_amount: number | null;
  notes: string | null;
  submitted_at: string | null;
  invited_at: string;
  created_at: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatCurrency(n: number | null): string {
  if (n == null) return "—";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

// ─── Status badge configs ─────────────────────────────────────────────────────

const PACKAGE_STATUS_STYLES: Record<PackageStatus, string> = {
  draft: "bg-gray-100 text-gray-600",
  open: "bg-blue-50 text-blue-700",
  leveling: "bg-amber-50 text-amber-700",
  awarded: "bg-green-50 text-green-700",
  cancelled: "bg-red-50 text-red-600",
};

const BID_STATUS_STYLES: Record<BidStatus, string> = {
  invited: "bg-gray-100 text-gray-600",
  viewed: "bg-blue-50 text-blue-700",
  submitted: "bg-green-50 text-green-700",
  declined: "bg-red-50 text-red-600",
  awarded: "bg-amber-50 text-amber-700",
};

const PACKAGE_STATUS_OPTIONS: PackageStatus[] = ["draft", "open", "leveling", "awarded", "cancelled"];

// ─── New Package Modal ────────────────────────────────────────────────────────

function NewPackageModal({
  onConfirm,
  onCancel,
  saving,
}: {
  onConfirm: (data: { name: string; description: string; scope_of_work: string; due_date: string }) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [scopeOfWork, setScopeOfWork] = useState("");
  const [dueDate, setDueDate] = useState("");

  function handleSubmit() {
    if (!name.trim()) return;
    onConfirm({ name, description, scope_of_work: scopeOfWork, due_date: dueDate });
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4 py-6 overflow-y-auto">
      <div className="bg-white rounded-xl w-full max-w-lg shadow-xl my-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">New Bid Package</h2>
          <button
            type="button"
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Package Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Concrete Work"
              className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description"
              className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Scope of Work</label>
            <textarea
              value={scopeOfWork}
              onChange={(e) => setScopeOfWork(e.target.value)}
              rows={4}
              placeholder="Detailed scope of work..."
              className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Due Date</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
            />
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!name.trim() || saving}
              className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-md hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              {saving ? "Creating..." : "Create Package"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Add Bidder Inline Row ────────────────────────────────────────────────────

function AddBidderRow({
  onAdd,
  onCancel,
}: {
  onAdd: (data: { company_name: string; contact_name: string; contact_email: string }) => void;
  onCancel: () => void;
}) {
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");

  return (
    <tr className="bg-blue-50/40">
      <td className="px-4 py-2">
        <input
          type="text"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          placeholder="Company name *"
          className="w-full px-2 py-1 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-gray-900"
          autoFocus
        />
      </td>
      <td className="px-4 py-2">
        <input
          type="text"
          value={contactName}
          onChange={(e) => setContactName(e.target.value)}
          placeholder="Contact name"
          className="w-full px-2 py-1 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-gray-900"
        />
      </td>
      <td className="px-4 py-2">
        <input
          type="email"
          value={contactEmail}
          onChange={(e) => setContactEmail(e.target.value)}
          placeholder="Email"
          className="w-full px-2 py-1 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-gray-900"
        />
      </td>
      <td className="px-4 py-2 text-center">—</td>
      <td className="px-4 py-2 text-center">—</td>
      <td className="px-4 py-2 text-center">—</td>
      <td className="px-4 py-2">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              if (!companyName.trim()) return;
              onAdd({ company_name: companyName, contact_name: contactName, contact_email: contactEmail });
            }}
            disabled={!companyName.trim()}
            className="px-2.5 py-1 text-xs font-medium text-white bg-gray-900 rounded hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            Add
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-2.5 py-1 text-xs font-medium text-gray-600 border border-gray-200 rounded hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </td>
    </tr>
  );
}

// ─── Main Client Component ────────────────────────────────────────────────────

export default function BidManagementClient({
  projectId,
  role,
  userId,
  username,
}: {
  projectId: string;
  role: string;
  userId: string;
  username?: string;
}) {
  const [packages, setPackages] = useState<BidPackage[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<BidPackage | null>(null);
  const [bids, setBids] = useState<Bid[]>([]);
  const [loadingPackages, setLoadingPackages] = useState(true);
  const [loadingBids, setLoadingBids] = useState(false);
  const [showNewPackage, setShowNewPackage] = useState(false);
  const [creatingPackage, setCreatingPackage] = useState(false);
  const [showAddBidder, setShowAddBidder] = useState(false);
  const [editingScopeOfWork, setEditingScopeOfWork] = useState(false);
  const [scopeOfWorkDraft, setScopeOfWorkDraft] = useState("");
  const [savingScope, setSavingScope] = useState(false);

  // ── Load packages on mount ──
  useEffect(() => {
    fetch(`/api/projects/${projectId}/bid-packages`)
      .then((r) => r.json())
      .then((data) => {
        setPackages(Array.isArray(data) ? data : []);
        setLoadingPackages(false);
      })
      .catch(() => setLoadingPackages(false));
  }, [projectId]);

  // ── Load bids when package is selected ──
  useEffect(() => {
    if (!selectedPackage) {
      setBids([]);
      return;
    }
    setLoadingBids(true);
    fetch(`/api/projects/${projectId}/bid-packages/${selectedPackage.id}/bids`)
      .then((r) => r.json())
      .then((data) => {
        setBids(Array.isArray(data) ? data : []);
        setLoadingBids(false);
      })
      .catch(() => setLoadingBids(false));
  }, [projectId, selectedPackage?.id]);

  // ── Create package ──
  async function handleCreatePackage(data: {
    name: string;
    description: string;
    scope_of_work: string;
    due_date: string;
  }) {
    setCreatingPackage(true);
    const res = await fetch(`/api/projects/${projectId}/bid-packages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const pkg: BidPackage = await res.json();
      setPackages((prev) => [pkg, ...prev]);
      setSelectedPackage(pkg);
    }
    setCreatingPackage(false);
    setShowNewPackage(false);
  }

  // ── Update package status ──
  async function handleStatusChange(status: PackageStatus) {
    if (!selectedPackage) return;
    const res = await fetch(
      `/api/projects/${projectId}/bid-packages/${selectedPackage.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      }
    );
    if (res.ok) {
      const updated: BidPackage = await res.json();
      setPackages((prev) => prev.map((p) => (p.id === updated.id ? { ...updated, bid_count: p.bid_count } : p)));
      setSelectedPackage((prev) => prev ? { ...updated, bid_count: prev.bid_count } : null);
    }
  }

  // ── Save scope of work ──
  async function handleSaveScopeOfWork() {
    if (!selectedPackage) return;
    setSavingScope(true);
    const res = await fetch(
      `/api/projects/${projectId}/bid-packages/${selectedPackage.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope_of_work: scopeOfWorkDraft }),
      }
    );
    if (res.ok) {
      const updated: BidPackage = await res.json();
      setPackages((prev) => prev.map((p) => (p.id === updated.id ? { ...updated, bid_count: p.bid_count } : p)));
      setSelectedPackage((prev) => prev ? { ...updated, bid_count: prev.bid_count } : null);
      setEditingScopeOfWork(false);
    }
    setSavingScope(false);
  }

  // ── Add bidder ──
  async function handleAddBidder(data: {
    company_name: string;
    contact_name: string;
    contact_email: string;
  }) {
    if (!selectedPackage) return;
    const res = await fetch(
      `/api/projects/${projectId}/bid-packages/${selectedPackage.id}/bids`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }
    );
    if (res.ok) {
      const bid: Bid = await res.json();
      setBids((prev) => [...prev, bid]);
      setPackages((prev) =>
        prev.map((p) => (p.id === selectedPackage.id ? { ...p, bid_count: p.bid_count + 1 } : p))
      );
      setSelectedPackage((prev) => prev ? { ...prev, bid_count: prev.bid_count + 1 } : null);
    }
    setShowAddBidder(false);
  }

  // ── Update bid ──
  async function handleUpdateBid(bidId: string, updates: Partial<Bid>) {
    if (!selectedPackage) return;
    const res = await fetch(
      `/api/projects/${projectId}/bid-packages/${selectedPackage.id}/bids/${bidId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      }
    );
    if (res.ok) {
      const updated: Bid = await res.json();
      setBids((prev) => prev.map((b) => (b.id === bidId ? updated : b)));
    }
  }

  // ── Award bid ──
  async function handleAwardBid(bidId: string) {
    if (!selectedPackage) return;
    // Mark bid as awarded
    await handleUpdateBid(bidId, { status: "awarded" });
    // Mark package as awarded
    await handleStatusChange("awarded");
  }

  // ── Remove bid ──
  async function handleRemoveBid(bidId: string) {
    if (!selectedPackage) return;
    const res = await fetch(
      `/api/projects/${projectId}/bid-packages/${selectedPackage.id}/bids/${bidId}`,
      { method: "DELETE" }
    );
    if (res.ok) {
      setBids((prev) => prev.filter((b) => b.id !== bidId));
      setPackages((prev) =>
        prev.map((p) =>
          p.id === selectedPackage.id ? { ...p, bid_count: Math.max(0, p.bid_count - 1) } : p
        )
      );
      setSelectedPackage((prev) =>
        prev ? { ...prev, bid_count: Math.max(0, prev.bid_count - 1) } : null
      );
    }
  }

  // ── Bid leveling ──
  const submittedBids = bids.filter((b) => b.base_amount != null && b.status !== "declined");
  const lowestAmount = submittedBids.length > 0
    ? Math.min(...submittedBids.map((b) => b.base_amount ?? Infinity))
    : null;

  // ── Select package helper ──
  function selectPackage(pkg: BidPackage) {
    setSelectedPackage(pkg);
    setEditingScopeOfWork(false);
    setShowAddBidder(false);
    setScopeOfWorkDraft(pkg.scope_of_work ?? "");
  }

  return (
    <div className="min-h-screen bg-[#FAFAF7]">
      <AppHeader username={username} />
      <ProjectNav projectId={projectId} />

      <div className="px-6 pt-8 pb-4 bg-[#FAFAF7]">
        <h1 className="font-display text-[28px] leading-tight text-[color:var(--ink)]">Bid Management</h1>
      </div>

      <div className="flex h-[calc(100vh-56px-56px-96px)] min-h-[480px]">
        {/* ── Left Sidebar: Package List ── */}
        <aside className="w-72 bg-white border-r border-gray-100 flex flex-col shrink-0">
          <div className="px-4 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Bid Packages</h2>
            <button
              onClick={() => setShowNewPackage(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-white bg-[color:var(--ink)] rounded-md hover:bg-black transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              New Package
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loadingPackages ? (
              <div className="space-y-2 p-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : packages.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-gray-400">No bid packages yet.</p>
                <p className="text-xs text-gray-300 mt-1">Click New Package to get started.</p>
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {packages.map((pkg) => (
                  <button
                    key={pkg.id}
                    onClick={() => selectPackage(pkg)}
                    className={`w-full text-left px-3 py-3 rounded-lg transition-colors ${
                      selectedPackage?.id === pkg.id
                        ? "bg-gray-900 text-white"
                        : "hover:bg-gray-50 text-gray-700"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className={`text-sm font-medium leading-snug ${selectedPackage?.id === pkg.id ? "text-white" : "text-gray-900"}`}>
                        {pkg.name}
                      </span>
                      <span
                        className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                          selectedPackage?.id === pkg.id
                            ? "bg-white/20 text-white"
                            : PACKAGE_STATUS_STYLES[pkg.status]
                        }`}
                      >
                        {pkg.status}
                      </span>
                    </div>
                    <div className={`flex items-center gap-3 mt-1.5 text-xs ${selectedPackage?.id === pkg.id ? "text-white/70" : "text-gray-400"}`}>
                      <span>{pkg.bid_count} bid{pkg.bid_count !== 1 ? "s" : ""}</span>
                      {pkg.due_date && (
                        <>
                          <span>·</span>
                          <span>Due {formatDate(pkg.due_date)}</span>
                        </>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </aside>

        {/* ── Right Panel: Package Detail ── */}
        <main className="flex-1 overflow-y-auto">
          {!selectedPackage ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <svg
                  className="w-12 h-12 text-gray-200 mx-auto mb-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.25}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <p className="text-sm text-gray-400">Select a bid package to view details</p>
              </div>
            </div>
          ) : (
            <div className="max-w-5xl mx-auto px-6 py-6 space-y-6">
              {/* Package Header */}
              <div className="bg-white rounded-xl border border-gray-100 px-6 py-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h2 className="font-display text-[20px] leading-tight text-[color:var(--ink)] truncate">{selectedPackage.name}</h2>
                    {selectedPackage.description && (
                      <p className="text-sm text-gray-500 mt-0.5">{selectedPackage.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {selectedPackage.due_date && (
                      <span className="text-xs text-gray-400">Due {formatDate(selectedPackage.due_date)}</span>
                    )}
                    <select
                      value={selectedPackage.status}
                      onChange={(e) => handleStatusChange(e.target.value as PackageStatus)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border-0 focus:outline-none focus:ring-2 focus:ring-gray-900 cursor-pointer capitalize ${PACKAGE_STATUS_STYLES[selectedPackage.status]}`}
                    >
                      {PACKAGE_STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s} className="bg-white text-gray-900">
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Scope of Work */}
              <div className="bg-white rounded-xl border border-gray-100 px-6 py-5">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-gray-900">Scope of Work</h2>
                  {!editingScopeOfWork && (
                    <button
                      onClick={() => {
                        setScopeOfWorkDraft(selectedPackage.scope_of_work ?? "");
                        setEditingScopeOfWork(true);
                      }}
                      className="text-xs text-gray-400 hover:text-gray-700 transition-colors"
                    >
                      Edit
                    </button>
                  )}
                </div>
                {editingScopeOfWork ? (
                  <div className="space-y-3">
                    <textarea
                      value={scopeOfWorkDraft}
                      onChange={(e) => setScopeOfWorkDraft(e.target.value)}
                      rows={5}
                      className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
                      placeholder="Describe the scope of work..."
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveScopeOfWork}
                        disabled={savingScope}
                        className="px-3 py-1.5 text-xs font-medium text-white bg-gray-900 rounded-md hover:bg-gray-700 transition-colors disabled:opacity-50"
                      >
                        {savingScope ? "Saving..." : "Save"}
                      </button>
                      <button
                        onClick={() => setEditingScopeOfWork(false)}
                        className="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">
                    {selectedPackage.scope_of_work || (
                      <span className="text-gray-300 italic">No scope of work defined.</span>
                    )}
                  </p>
                )}
              </div>

              {/* Bidders Table */}
              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-gray-900">Bidders</h2>
                  {!showAddBidder && (
                    <button
                      onClick={() => setShowAddBidder(true)}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-700 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                      </svg>
                      Add Bidder
                    </button>
                  )}
                </div>

                {loadingBids ? (
                  <div className="px-6 py-8 space-y-2">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
                    ))}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[700px]">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Company</th>
                          <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Contact</th>
                          <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Email</th>
                          <th className="text-center px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
                          <th className="text-right px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Bid Amount</th>
                          <th className="text-center px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Submitted</th>
                          <th className="text-right px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bids.map((bid) => (
                          <tr key={bid.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors">
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">{bid.company_name}</td>
                            <td className="px-4 py-3 text-sm text-gray-600">{bid.contact_name || "—"}</td>
                            <td className="px-4 py-3 text-sm text-gray-500">{bid.contact_email || "—"}</td>
                            <td className="px-4 py-3 text-center">
                              <select
                                value={bid.status}
                                onChange={(e) => handleUpdateBid(bid.id, { status: e.target.value as BidStatus })}
                                className={`px-2 py-0.5 rounded-full text-xs font-medium border-0 focus:outline-none cursor-pointer capitalize ${BID_STATUS_STYLES[bid.status]}`}
                              >
                                {(["invited", "viewed", "submitted", "declined", "awarded"] as BidStatus[]).map((s) => (
                                  <option key={s} value={s} className="bg-white text-gray-900">{s}</option>
                                ))}
                              </select>
                            </td>
                            <td className="px-4 py-3 text-sm text-right">
                              {bid.status === "submitted" || bid.base_amount != null ? (
                                <span className="text-gray-900 font-medium">{formatCurrency(bid.base_amount)}</span>
                              ) : (
                                <span className="text-gray-300">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-xs text-center text-gray-500">{formatDate(bid.submitted_at)}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-end gap-2">
                                {bid.status !== "awarded" && bid.status !== "declined" && (
                                  <button
                                    onClick={() => handleAwardBid(bid.id)}
                                    className="px-2.5 py-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded hover:bg-amber-100 transition-colors"
                                  >
                                    Mark Awarded
                                  </button>
                                )}
                                <button
                                  onClick={() => handleRemoveBid(bid.id)}
                                  className="p-1 text-gray-300 hover:text-red-500 transition-colors rounded"
                                  title="Remove bidder"
                                >
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}

                        {showAddBidder && (
                          <AddBidderRow
                            onAdd={handleAddBidder}
                            onCancel={() => setShowAddBidder(false)}
                          />
                        )}

                        {bids.length === 0 && !showAddBidder && (
                          <tr>
                            <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400">
                              No bidders added yet. Click Add Bidder to invite subcontractors.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Bid Leveling Section */}
              {submittedBids.length >= 2 && (
                <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-100">
                    <h2 className="text-sm font-semibold text-gray-900">Bid Leveling</h2>
                    <p className="text-xs text-gray-400 mt-0.5">Comparing {submittedBids.length} bids with amounts</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="text-left px-6 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider w-40">
                            Item
                          </th>
                          {submittedBids.map((bid) => (
                            <th
                              key={bid.id}
                              className="text-right px-6 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider"
                            >
                              <div className="text-gray-700 font-semibold normal-case text-sm">{bid.company_name}</div>
                              <div className="text-gray-400 font-normal text-xs mt-0.5 capitalize">{bid.status}</div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-gray-50">
                          <td className="px-6 py-4 text-sm font-medium text-gray-700">Base Bid</td>
                          {submittedBids.map((bid) => {
                            const isLowest = bid.base_amount === lowestAmount;
                            return (
                              <td
                                key={bid.id}
                                className={`px-6 py-4 text-right text-sm font-semibold ${
                                  isLowest ? "text-green-700 bg-green-50" : "text-gray-900"
                                }`}
                              >
                                {formatCurrency(bid.base_amount)}
                                {isLowest && (
                                  <span className="ml-1.5 text-xs font-medium text-green-600 bg-green-100 px-1.5 py-0.5 rounded-full">
                                    Lowest
                                  </span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* New Package Modal */}
      {showNewPackage && (
        <NewPackageModal
          onConfirm={handleCreatePackage}
          onCancel={() => setShowNewPackage(false)}
          saving={creatingPackage}
        />
      )}
    </div>
  );
}
