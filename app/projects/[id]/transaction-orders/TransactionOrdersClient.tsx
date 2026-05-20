"use client";

import { useEffect, useRef, useState } from "react";
import ProjectNav from "@/components/ProjectNav";

type TransactionOrder = {
  id: string;
  vendor: string | null;
  amount: number | null;
  scope: string | null;
  piCode: string | null;
  costCode: string | null;
  date: string | null;
  sourceFilename: string | null;
  filename: string;
  url: string | null;
  createdAt: string;
};

type AssignmentRecipient = {
  contactId: string | null;
  userId: string | null;
  email: string;
  name: string;
  role: string;
};

type Assignment = {
  id: string;
  invoiceFilename: string;
  url: string | null;
  notes: string | null;
  recipients: AssignmentRecipient[];
  status: string;
  createdAt: string;
  completedAt: string | null;
  assignedBy: string;
};

type ProjectLite = {
  id: string;
  name: string;
};

type DirectoryContact = {
  id: string;
  type: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  company: string | null;
  group_name: string | null;
};

type ProjectManagerLite = {
  contactId: string;
  name: string;
  email: string;
};

function contactDisplayName(c: DirectoryContact): string {
  if (c.type === "company") return c.company || c.email || "";
  if (c.type === "group" || c.type === "distribution_group") return c.group_name || "";
  const full = [c.first_name, c.last_name].filter(Boolean).join(" ").trim();
  return full || c.email || "";
}

type TemplateInfo = {
  id?: string;
  isDefault: boolean;
  filename: string;
  url: string | null;
  uploadedAt: string | null;
};

type ProcessedPreview = {
  pdfBlobUrl: string;
  pdfBlob: Blob;
  filename: string;
  vendor: string;
  amount: string;
  scope: string;
  piCode: string;
  costCode: string;
  date: string;
  sourceFilename: string;
};

function decodeHeader(h: string | null): string {
  if (!h) return "";
  try {
    return decodeURIComponent(h);
  } catch {
    return h;
  }
}

function formatCurrency(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function formatCompactCurrency(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "$0";
  if (Math.abs(n) >= 1000) {
    return `$${(n / 1000).toLocaleString("en-US", { maximumFractionDigits: 1 })}K`;
  }
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function formatDate(s: string | null): string {
  if (!s) return "";
  // s is ISO YYYY-MM-DD or full timestamp.
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[2]}/${m[3]}/${m[1]}`;
  return s;
}

export default function TransactionOrdersClient({
  projectId,
  username,
  userId,
  canAssign,
}: {
  projectId: string;
  username?: string;
  userId?: string;
  canAssign?: boolean;
}) {
  const [orders, setOrders] = useState<TransactionOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [template, setTemplate] = useState<TemplateInfo | null>(null);

  const [showNewModal, setShowNewModal] = useState(false);
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [processError, setProcessError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ProcessedPreview | null>(null);
  const [saving, setSaving] = useState(false);

  const [templateBusy, setTemplateBusy] = useState(false);
  const templateInputRef = useRef<HTMLInputElement>(null);

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(true);

  const [showAssignModal, setShowAssignModal] = useState(false);

  useEffect(() => {
    void loadOrders();
    void loadTemplate();
    void loadAssignments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function loadAssignments() {
    setAssignmentsLoading(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/transaction-orders/assignments`,
      );
      if (res.ok) {
        const data = await res.json();
        setAssignments(Array.isArray(data.assignments) ? data.assignments : []);
      } else {
        setAssignments([]);
      }
    } finally {
      setAssignmentsLoading(false);
    }
  }

  async function loadOrders() {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/transaction-orders`);
      const data = await res.json();
      if (res.ok) setOrders(data.transactionOrders ?? []);
    } finally {
      setLoading(false);
    }
  }

  async function loadTemplate() {
    const res = await fetch(`/api/projects/${projectId}/transaction-orders/template`);
    const data = await res.json();
    if (res.ok) setTemplate(data.template ?? null);
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }

  function openNewModal() {
    setShowNewModal(true);
    setSourceFile(null);
    setProcessError(null);
    if (preview?.pdfBlobUrl) URL.revokeObjectURL(preview.pdfBlobUrl);
    setPreview(null);
  }

  function closeNewModal() {
    if (processing || saving) return;
    setShowNewModal(false);
    setSourceFile(null);
    setProcessError(null);
    if (preview?.pdfBlobUrl) URL.revokeObjectURL(preview.pdfBlobUrl);
    setPreview(null);
  }

  async function handleProcess() {
    if (!sourceFile) return;
    setProcessing(true);
    setProcessError(null);
    try {
      const formData = new FormData();
      formData.append("file", sourceFile);
      const res = await fetch(
        `/api/projects/${projectId}/transaction-orders/process`,
        { method: "POST", body: formData },
      );
      if (!res.ok) {
        let msg = "Failed to process Transaction Order";
        try {
          const data = await res.json();
          msg = data?.error ?? msg;
        } catch {
          /* ignore */
        }
        throw new Error(msg);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setPreview({
        pdfBlobUrl: url,
        pdfBlob: blob,
        filename: decodeHeader(res.headers.get("X-TO-Filename")) || "transaction-order.pdf",
        vendor: decodeHeader(res.headers.get("X-TO-Vendor")),
        amount: decodeHeader(res.headers.get("X-TO-Amount")),
        scope: decodeHeader(res.headers.get("X-TO-Scope")),
        piCode: decodeHeader(res.headers.get("X-TO-Pi-Code")),
        costCode: decodeHeader(res.headers.get("X-TO-Cost-Code")),
        date: decodeHeader(res.headers.get("X-TO-Date")),
        sourceFilename:
          decodeHeader(res.headers.get("X-TO-Source-Filename")) || sourceFile.name,
      });
    } catch (err) {
      setProcessError(err instanceof Error ? err.message : "Failed to process Transaction Order");
    } finally {
      setProcessing(false);
    }
  }

  async function handleSavePreview() {
    if (!preview) return;
    setSaving(true);
    setProcessError(null);
    try {
      const urlRes = await fetch(
        `/api/projects/${projectId}/transaction-orders/upload-url?filename=${encodeURIComponent(preview.filename)}`,
      );
      if (!urlRes.ok) {
        const data = await urlRes.json().catch(() => ({}));
        throw new Error(data?.error ?? "Could not request upload URL");
      }
      const { signedUrl, storagePath } = await urlRes.json();

      const putRes = await fetch(signedUrl, {
        method: "PUT",
        body: preview.pdfBlob,
        headers: { "Content-Type": "application/pdf" },
      });
      if (!putRes.ok) {
        const text = await putRes.text().catch(() => "");
        throw new Error(
          `Upload failed (${putRes.status})${text ? `: ${text.slice(0, 200)}` : ""}`,
        );
      }

      const registerRes = await fetch(
        `/api/projects/${projectId}/transaction-orders`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            vendor: preview.vendor,
            amount: preview.amount,
            scope: preview.scope,
            piCode: preview.piCode,
            costCode: preview.costCode,
            date: preview.date,
            sourceFilename: preview.sourceFilename,
            filename: preview.filename,
            storagePath,
          }),
        },
      );
      if (!registerRes.ok) {
        const data = await registerRes.json().catch(() => ({}));
        throw new Error(data?.error ?? `Register failed (${registerRes.status})`);
      }

      if (preview.pdfBlobUrl) URL.revokeObjectURL(preview.pdfBlobUrl);
      setPreview(null);
      setSourceFile(null);
      setShowNewModal(false);
      void loadOrders();
    } catch (err) {
      setProcessError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleCompleteAssignment(id: string) {
    const res = await fetch(
      `/api/projects/${projectId}/transaction-orders/assignments/${id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      },
    );
    if (res.ok) {
      void loadAssignments();
    } else {
      window.alert("Failed to mark assignment complete");
    }
  }

  async function handleDeleteAssignment(id: string) {
    if (!window.confirm("Delete this assignment? The invoice file will be removed.")) return;
    const res = await fetch(
      `/api/projects/${projectId}/transaction-orders/assignments/${id}`,
      { method: "DELETE" },
    );
    if (res.ok) {
      setAssignments((prev) => prev.filter((a) => a.id !== id));
    } else {
      window.alert("Failed to delete assignment");
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this Transaction Order? This cannot be undone.")) return;
    const res = await fetch(`/api/projects/${projectId}/transaction-orders/${id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setOrders((prev) => prev.filter((o) => o.id !== id));
    } else {
      window.alert("Failed to delete Transaction Order");
    }
  }

  async function handleTemplateUpload(file: File) {
    if (file.type && file.type !== "application/pdf") {
      window.alert("Template must be a PDF");
      return;
    }
    setTemplateBusy(true);
    try {
      const urlRes = await fetch(
        `/api/projects/${projectId}/transaction-orders/template/upload-url?filename=${encodeURIComponent(file.name)}`,
      );
      if (!urlRes.ok) throw new Error("Could not request template upload URL");
      const { signedUrl, storagePath } = await urlRes.json();

      const putRes = await fetch(signedUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": "application/pdf" },
      });
      if (!putRes.ok) throw new Error("Could not upload template");

      const regRes = await fetch(`/api/projects/${projectId}/transaction-orders/template`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storagePath, filename: file.name }),
      });
      if (!regRes.ok) {
        const data = await regRes.json().catch(() => ({}));
        throw new Error(data?.error ?? "Could not register template");
      }
      await loadTemplate();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Template upload failed");
    } finally {
      setTemplateBusy(false);
      if (templateInputRef.current) templateInputRef.current.value = "";
    }
  }

  async function handleResetTemplate() {
    if (!template || template.isDefault) return;
    if (!window.confirm("Reset to the default Transaction Order template?")) return;
    setTemplateBusy(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/transaction-orders/template`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to reset template");
      await loadTemplate();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Failed to reset template");
    } finally {
      setTemplateBusy(false);
    }
  }

  const totalOrderValue = orders.reduce(
    (sum, o) => sum + (Number.isFinite(o.amount) ? (o.amount as number) : 0),
    0,
  );
  const openAssignmentCount = assignments.filter((a) => a.status === "open").length;

  return (
    <div className="min-h-screen bg-[#FAFAF7]">
      <header className="bg-[#FAFAF7] border-b border-black/[0.06] px-6 h-14 flex items-center justify-between">
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
        <div className="flex items-end justify-between mb-6 gap-4 flex-wrap">
          <div className="min-w-0">
            <h1 className="font-display text-[32px] leading-[1.05] tracking-[-0.012em] text-[color:var(--ink)]">
              Transaction Orders
            </h1>
            <p className="sub mt-1.5">
              <em>Invoices reconciled into the project ledger</em>
              <span className="sep">·</span>
              <span className="num">{orders.length}</span> order
              {orders.length === 1 ? "" : "s"}
              {openAssignmentCount > 0 && (
                <>
                  <span className="sep">·</span>
                  <span className="num" style={{ color: "var(--brand-500)" }}>
                    {openAssignmentCount}
                  </span>{" "}
                  awaiting
                </>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {canAssign && (
              <button
                onClick={() => setShowAssignModal(true)}
                className="btn-secondary inline-flex items-center gap-1.5"
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
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                Assign Invoice
              </button>
            )}
            <button
              onClick={openNewModal}
              className="btn-primary inline-flex items-center gap-1.5"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              New Transaction Order
            </button>
          </div>
        </div>

        {/* Stat strip */}
        <div className="stats">
          <div className="stat">
            <div className="lbl">Transaction Orders</div>
            <div className="val">{orders.length}</div>
            <div className="delta">Completed packets on file</div>
          </div>
          <div className="stat">
            <div className="lbl">Total Value</div>
            <div className="val">{formatCompactCurrency(totalOrderValue)}</div>
            <div className="delta">Across all orders</div>
          </div>
          <div className={`stat${openAssignmentCount > 0 ? " warn" : ""}`}>
            <div className="lbl">Assigned Invoices</div>
            <div className="val">{openAssignmentCount}</div>
            <div className="delta">Open · awaiting conversion</div>
          </div>
          <div className="stat">
            <div className="lbl">Template</div>
            <div className="val">{template ? (template.isDefault ? "Default" : "Custom") : "—"}</div>
            <div className="delta">
              {template ? template.filename : "Loading template…"}
            </div>
          </div>
        </div>

        {/* Template panel */}
        <section className="mb-8 rounded-xl border border-black/[0.06] bg-white p-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <h2 className="h3-warm">Transaction Order Template</h2>
              <p className="text-xs text-[color:var(--gray-500)] mt-1">
                The fillable PDF this project uses when generating new Transaction Orders.
              </p>
              {template ? (
                <div className="mt-3 flex items-center gap-2 text-sm">
                  <svg className="w-4 h-4 text-[color:var(--brand-500)]" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {template.url ? (
                    <a
                      href={template.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[color:var(--ink)] font-medium hover:underline"
                    >
                      {template.filename}
                    </a>
                  ) : (
                    <span className="text-[color:var(--ink)] font-medium">{template.filename}</span>
                  )}
                  <span
                    className={`pill ${template.isDefault ? "pill-info" : "pill-open"}`}
                  >
                    {template.isDefault
                      ? "Default"
                      : template.uploadedAt
                        ? `Uploaded ${new Date(template.uploadedAt).toLocaleDateString()}`
                        : "Custom"}
                  </span>
                </div>
              ) : (
                <p className="text-sm text-gray-400 mt-3">Loading template…</p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <input
                ref={templateInputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleTemplateUpload(f);
                }}
              />
              <button
                onClick={() => templateInputRef.current?.click()}
                disabled={templateBusy}
                className="btn-secondary disabled:opacity-50"
              >
                {templateBusy ? "Working…" : "Replace template"}
              </button>
              {template && !template.isDefault && (
                <button
                  onClick={handleResetTemplate}
                  disabled={templateBusy}
                  className="btn-quiet disabled:opacity-50"
                >
                  Reset to default
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Assigned Invoices */}
        <section className="mb-8 rounded-xl border border-gray-100 bg-white overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Assigned Invoices</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Invoices routed to this project for someone here to turn into a Transaction Order.
              </p>
            </div>
          </div>
          {assignmentsLoading ? (
            <div className="px-5 py-8 text-sm text-gray-400">Loading…</div>
          ) : assignments.length === 0 ? (
            <div className="px-5 py-8 text-sm text-gray-400">
              No assigned invoices.
              {canAssign && (
                <>
                  {" "}Use <span className="font-medium text-gray-700">Assign Invoice</span> to route one to another project.
                </>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {assignments.map((a) => {
                const isMine = a.recipients.some(
                  (r) => r.userId === userId,
                );
                return (
                  <li key={a.id} className="px-5 py-4 flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`pill ${a.status === "open" ? "pill-warn" : "pill-success"} shrink-0`}
                        >
                          {a.status === "open" ? "Open" : "Completed"}
                        </span>
                        {a.url ? (
                          <a
                            href={a.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sm font-medium text-gray-900 hover:underline truncate"
                          >
                            {a.invoiceFilename}
                          </a>
                        ) : (
                          <span className="text-sm font-medium text-gray-900 truncate">
                            {a.invoiceFilename}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Assigned by {a.assignedBy || "—"} on {new Date(a.createdAt).toLocaleDateString()}
                        {" · "}
                        {a.recipients.length} recipient{a.recipients.length !== 1 ? "s" : ""}
                        {isMine && <span className="ml-2 text-gray-700 font-medium">· assigned to you</span>}
                      </p>
                      {a.notes && (
                        <p className="text-xs text-gray-600 mt-2 whitespace-pre-wrap">
                          {a.notes}
                        </p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">
                        To: {a.recipients.map((r) => r.name || r.email).join(", ")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {a.status === "open" && (
                        <button
                          onClick={() => void handleCompleteAssignment(a.id)}
                          className="px-3 py-1.5 text-xs font-medium text-white bg-gray-900 rounded-md hover:bg-gray-700"
                        >
                          Mark Complete
                        </button>
                      )}
                      {canAssign && (
                        <button
                          onClick={() => void handleDeleteAssignment(a.id)}
                          className="text-xs text-red-500 hover:text-red-700"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Completed TO table */}
        <section className="rounded-xl border border-gray-100 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-400">
                <tr>
                  <th className="text-left font-semibold px-4 py-3">Vendor</th>
                  <th className="text-left font-semibold px-4 py-3">Scope / Invoice</th>
                  <th className="text-right font-semibold px-4 py-3">Amount</th>
                  <th className="text-left font-semibold px-4 py-3">PI</th>
                  <th className="text-left font-semibold px-4 py-3">Cost Code</th>
                  <th className="text-left font-semibold px-4 py-3">Date</th>
                  <th className="text-left font-semibold px-4 py-3">Created</th>
                  <th className="text-right font-semibold px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-gray-400">
                      Loading…
                    </td>
                  </tr>
                ) : orders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-gray-400">
                      No Transaction Orders yet. Click <span className="font-medium text-gray-700">New Transaction Order</span> to upload an invoice PDF.
                    </td>
                  </tr>
                ) : (
                  orders.map((o) => (
                    <tr key={o.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-900">{o.vendor || <span className="text-gray-300">—</span>}</td>
                      <td className="px-4 py-3 text-gray-700">{o.scope || <span className="text-gray-300">—</span>}</td>
                      <td className="px-4 py-3 text-right text-gray-900 tabular-nums">{formatCurrency(o.amount)}</td>
                      <td className="px-4 py-3 text-gray-700">{o.piCode || <span className="text-gray-300">—</span>}</td>
                      <td className="px-4 py-3 text-gray-700">{o.costCode || <span className="text-gray-300">—</span>}</td>
                      <td className="px-4 py-3 text-gray-700">{formatDate(o.date)}</td>
                      <td className="px-4 py-3 text-gray-400">{new Date(o.createdAt).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-3">
                          {o.url ? (
                            <a
                              href={o.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-gray-700 hover:text-gray-900"
                            >
                              View PDF
                            </a>
                          ) : (
                            <span className="text-gray-300">No file</span>
                          )}
                          <button
                            onClick={() => handleDelete(o.id)}
                            className="text-red-500 hover:text-red-700"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {/* Assign Invoice modal */}
      {showAssignModal && canAssign && (
        <AssignInvoiceModal
          currentProjectId={projectId}
          onClose={() => setShowAssignModal(false)}
          onAssigned={() => {
            setShowAssignModal(false);
            void loadAssignments();
          }}
        />
      )}

      {/* New Transaction Order modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[92vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {preview ? "Review Transaction Order" : "New Transaction Order"}
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {preview
                    ? "Confirm the extracted fields, then save the completed packet."
                    : "Upload the invoice / backup PDF. We'll extract the fields and fill the Transaction Order template."}
                </p>
              </div>
              <button
                onClick={closeNewModal}
                disabled={processing || saving}
                className="text-gray-400 hover:text-gray-700 disabled:opacity-50"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="overflow-y-auto p-6 flex-1">
              {!preview ? (
                <div className="space-y-4">
                  <label className="block">
                    <span className="text-sm font-medium text-gray-700">Source PDF</span>
                    <input
                      type="file"
                      accept="application/pdf"
                      onChange={(e) => setSourceFile(e.target.files?.[0] ?? null)}
                      className="block mt-2 w-full text-sm text-gray-700 file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-gray-900 file:text-white hover:file:bg-gray-700"
                    />
                  </label>
                  {sourceFile && (
                    <p className="text-xs text-gray-500">
                      Selected: <span className="text-gray-700">{sourceFile.name}</span>{" "}
                      ({Math.round(sourceFile.size / 1024)} KB)
                    </p>
                  )}
                  {processError && (
                    <p className="text-sm text-red-600">{processError}</p>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <PreviewField
                      label="Vendor"
                      value={preview.vendor}
                      onChange={(v) => setPreview({ ...preview, vendor: v })}
                    />
                    <PreviewField
                      label="Amount"
                      value={preview.amount}
                      onChange={(v) => setPreview({ ...preview, amount: v })}
                    />
                    <PreviewField
                      label="Scope / Invoice"
                      value={preview.scope}
                      onChange={(v) => setPreview({ ...preview, scope: v })}
                      className="col-span-2"
                    />
                    <PreviewField
                      label="PI Code"
                      value={preview.piCode}
                      onChange={(v) => setPreview({ ...preview, piCode: v })}
                    />
                    <PreviewField
                      label="Cost Code"
                      value={preview.costCode}
                      onChange={(v) => setPreview({ ...preview, costCode: v })}
                    />
                    <PreviewField label="Date" value={preview.date} readOnly />
                    <PreviewField label="Source PDF" value={preview.sourceFilename} readOnly />
                  </div>
                  <p className="text-xs text-gray-400">
                    Field corrections here are only saved alongside the packet — they will not
                    re-fill the PDF. If the PDF itself needs corrections, edit the values and
                    re-process the source.
                  </p>
                  <div className="rounded-lg border border-gray-100 overflow-hidden">
                    <iframe
                      src={preview.pdfBlobUrl}
                      title="Completed Transaction Order preview"
                      className="w-full h-[60vh] bg-gray-100"
                    />
                  </div>
                  {processError && (
                    <p className="text-sm text-red-600">{processError}</p>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100 bg-gray-50">
              <button
                onClick={closeNewModal}
                disabled={processing || saving}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 disabled:opacity-50"
              >
                Cancel
              </button>
              {!preview ? (
                <button
                  onClick={handleProcess}
                  disabled={!sourceFile || processing}
                  className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-md hover:bg-gray-700 disabled:opacity-50"
                >
                  {processing ? "Processing…" : "Generate Transaction Order"}
                </button>
              ) : (
                <>
                  <a
                    href={preview.pdfBlobUrl}
                    download={preview.filename}
                    className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-md hover:bg-gray-100"
                  >
                    Download
                  </a>
                  <button
                    onClick={handleSavePreview}
                    disabled={saving}
                    className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-md hover:bg-gray-700 disabled:opacity-50"
                  >
                    {saving ? "Saving…" : "Save Transaction Order"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AssignInvoiceModal({
  currentProjectId,
  onClose,
  onAssigned,
}: {
  currentProjectId: string;
  onClose: () => void;
  onAssigned: () => void;
}) {
  const [projects, setProjects] = useState<ProjectLite[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [targetProjectId, setTargetProjectId] = useState<string>("");

  const [pmContacts, setPmContacts] = useState<ProjectManagerLite[]>([]);
  const [pmError, setPmError] = useState<string | null>(null);
  const [pmLoading, setPmLoading] = useState(false);

  const [directory, setDirectory] = useState<DirectoryContact[]>([]);
  const [directoryLoading, setDirectoryLoading] = useState(false);

  const [extraContactIds, setExtraContactIds] = useState<string[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setProjectsLoading(true);
      try {
        const res = await fetch("/api/projects");
        const data = await res.json();
        if (cancelled) return;
        const list: ProjectLite[] = Array.isArray(data)
          ? data.map((p: { id: string; name: string }) => ({ id: p.id, name: p.name }))
          : [];
        setProjects(list);
      } finally {
        if (!cancelled) setProjectsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!targetProjectId) {
      setPmContacts([]);
      setDirectory([]);
      setExtraContactIds([]);
      setPmError(null);
      return;
    }
    let cancelled = false;
    setPmLoading(true);
    setPmError(null);
    setDirectoryLoading(true);
    setExtraContactIds([]);
    (async () => {
      try {
        const [pmRes, dirRes] = await Promise.all([
          fetch(`/api/projects/${targetProjectId}/project-manager`),
          fetch(`/api/projects/${targetProjectId}/directory`),
        ]);
        if (cancelled) return;
        if (pmRes.ok) {
          const data = await pmRes.json();
          setPmContacts(Array.isArray(data.projectManagers) ? data.projectManagers : []);
        } else {
          const data = await pmRes.json().catch(() => ({}));
          setPmError(data?.error ?? "Could not load Project Manager");
          setPmContacts([]);
        }
        if (dirRes.ok) {
          const data: DirectoryContact[] = await dirRes.json();
          setDirectory(Array.isArray(data) ? data : []);
        } else {
          setDirectory([]);
        }
      } finally {
        if (!cancelled) {
          setPmLoading(false);
          setDirectoryLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [targetProjectId]);

  function toggleExtra(id: string) {
    setExtraContactIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  const pmContactIds = new Set(pmContacts.map((p) => p.contactId));
  const pickableContacts = directory.filter(
    (c) =>
      !pmContactIds.has(c.id) &&
      (c.email || "").trim() !== "" &&
      c.type !== "distribution_group",
  );

  async function handleSubmit() {
    setError(null);
    if (!targetProjectId) {
      setError("Pick a project");
      return;
    }
    if (!file) {
      setError("Upload the invoice PDF");
      return;
    }
    if (file.type && file.type !== "application/pdf") {
      setError("Invoice must be a PDF");
      return;
    }

    const recipients: { contactId: string; name: string; email: string; role: string }[] = [];
    for (const pm of pmContacts) {
      if (!pm.email) continue;
      recipients.push({ contactId: pm.contactId, name: pm.name, email: pm.email, role: "Project Manager" });
    }
    for (const id of extraContactIds) {
      const c = directory.find((d) => d.id === id);
      if (!c || !c.email) continue;
      recipients.push({
        contactId: c.id,
        name: contactDisplayName(c),
        email: c.email,
        role: "",
      });
    }
    if (recipients.length === 0) {
      setError("No recipients with an email on file — assign a Project Manager or add a recipient with an email");
      return;
    }

    setSubmitting(true);
    try {
      const urlRes = await fetch(
        `/api/projects/${targetProjectId}/transaction-orders/assignments/upload-url?filename=${encodeURIComponent(file.name)}`,
      );
      if (!urlRes.ok) {
        const data = await urlRes.json().catch(() => ({}));
        throw new Error(data?.error ?? "Could not request upload URL");
      }
      const { signedUrl, storagePath } = await urlRes.json();

      const putRes = await fetch(signedUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": "application/pdf" },
      });
      if (!putRes.ok) {
        const text = await putRes.text().catch(() => "");
        throw new Error(`Upload failed (${putRes.status})${text ? `: ${text.slice(0, 200)}` : ""}`);
      }

      const createRes = await fetch(
        `/api/projects/${targetProjectId}/transaction-orders/assignments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: file.name,
            storagePath,
            notes,
            recipients,
          }),
        },
      );
      if (!createRes.ok) {
        const data = await createRes.json().catch(() => ({}));
        throw new Error(data?.error ?? "Could not create assignment");
      }

      onAssigned();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to assign invoice");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[92vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Assign Invoice</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Route an invoice PDF to another project so its Project Manager can turn it into a Transaction Order.
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="text-gray-400 hover:text-gray-700 disabled:opacity-50"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto p-6 flex-1 space-y-5">
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Project</span>
            <select
              value={targetProjectId}
              onChange={(e) => setTargetProjectId(e.target.value)}
              disabled={projectsLoading || submitting}
              className="mt-1 block w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 bg-white"
            >
              <option value="">{projectsLoading ? "Loading projects…" : "Select a project"}</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.id === currentProjectId ? " (this project)" : ""}
                </option>
              ))}
            </select>
          </label>

          {targetProjectId && (
            <div>
              <span className="text-sm font-medium text-gray-700">Project Manager</span>
              {pmLoading ? (
                <p className="mt-1 text-sm text-gray-400">Loading…</p>
              ) : pmError ? (
                <p className="mt-1 text-sm text-red-600">{pmError}</p>
              ) : pmContacts.length === 0 ? (
                <p className="mt-1 text-sm text-gray-400">
                  No Project Manager assigned on this project. Add one from the project&apos;s Team panel, or pick recipients below.
                </p>
              ) : (
                <ul className="mt-1 space-y-1">
                  {pmContacts.map((pm) => (
                    <li key={pm.contactId} className="text-sm text-gray-900">
                      <span className="font-medium">{pm.name}</span>
                      {pm.email ? <span className="text-gray-500"> · {pm.email}</span> : <span className="text-red-500"> · no email on file</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {targetProjectId && (
            <div>
              <span className="text-sm font-medium text-gray-700">Additional recipients</span>
              <p className="text-xs text-gray-400 mt-0.5">
                Pick from the project directory. Only contacts with an email show up.
              </p>
              <div className="mt-2 max-h-44 overflow-y-auto rounded-md border border-gray-200 bg-white">
                {directoryLoading ? (
                  <div className="px-3 py-2 text-sm text-gray-400">Loading directory…</div>
                ) : pickableContacts.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-gray-400">
                    No additional directory contacts with an email.
                  </div>
                ) : (
                  <ul className="divide-y divide-gray-100">
                    {pickableContacts.map((c) => (
                      <li key={c.id} className="px-3 py-2 flex items-center gap-2">
                        <input
                          id={`pick-${c.id}`}
                          type="checkbox"
                          checked={extraContactIds.includes(c.id)}
                          onChange={() => toggleExtra(c.id)}
                          className="h-4 w-4"
                        />
                        <label htmlFor={`pick-${c.id}`} className="text-sm text-gray-900 cursor-pointer flex-1 min-w-0">
                          <span className="truncate">{contactDisplayName(c)}</span>
                          <span className="text-gray-500"> · {c.email}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          <label className="block">
            <span className="text-sm font-medium text-gray-700">Invoice PDF</span>
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block mt-2 w-full text-sm text-gray-700 file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-gray-900 file:text-white hover:file:bg-gray-700"
            />
            {file && (
              <p className="text-xs text-gray-500 mt-2">
                Selected: <span className="text-gray-700">{file.name}</span>{" "}
                ({Math.round(file.size / 1024)} KB)
              </p>
            )}
          </label>

          <label className="block">
            <span className="text-sm font-medium text-gray-700">Notes (optional)</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="mt-1 block w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
              placeholder="What should the PM know about this invoice?"
            />
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100 bg-gray-50">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !targetProjectId || !file}
            className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-md hover:bg-gray-700 disabled:opacity-50"
          >
            {submitting ? "Assigning…" : "Assign Invoice"}
          </button>
        </div>
      </div>
    </div>
  );
}

function PreviewField({
  label,
  value,
  onChange,
  readOnly,
  className,
}: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  readOnly?: boolean;
  className?: string;
}) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</span>
      <input
        type="text"
        value={value}
        readOnly={readOnly}
        onChange={(e) => onChange?.(e.target.value)}
        className={`mt-1 block w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10 ${
          readOnly ? "bg-gray-50" : "bg-white"
        }`}
      />
    </label>
  );
}
