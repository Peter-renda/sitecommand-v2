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
}: {
  projectId: string;
  username?: string;
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

  useEffect(() => {
    void loadOrders();
    void loadTemplate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

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

  return (
    <div className="min-h-screen bg-gray-50">
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
        <div className="flex items-end justify-between mb-6 gap-4 flex-wrap">
          <div className="min-w-0">
            <h1 className="font-display text-[32px] leading-[1.05] tracking-[-0.012em] text-[color:var(--ink)]">
              Transaction Orders
            </h1>
            <p className="sec-sub mt-1.5">
              <span className="serif-italic text-[color:var(--brand-700)]">
                Accounting
              </span>
              <span className="sep">·</span>
              <span className="num">{orders.length}</span> completed
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={openNewModal}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-gray-900 rounded-md hover:bg-gray-700 transition-colors"
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

        {/* Template panel */}
        <section className="mb-8 rounded-xl border border-gray-100 bg-white p-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-gray-900">Transaction Order Template</h2>
              <p className="text-xs text-gray-500 mt-1">
                The fillable PDF this project uses when generating new Transaction Orders.
              </p>
              {template ? (
                <div className="mt-3 flex items-center gap-2 text-sm">
                  <svg className="w-4 h-4 text-red-500" viewBox="0 0 20 20" fill="currentColor">
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
                      className="text-gray-900 hover:underline"
                    >
                      {template.filename}
                    </a>
                  ) : (
                    <span className="text-gray-900">{template.filename}</span>
                  )}
                  <span className="text-xs text-gray-400">
                    {template.isDefault
                      ? "(default)"
                      : template.uploadedAt
                        ? `Uploaded ${new Date(template.uploadedAt).toLocaleDateString()}`
                        : ""}
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
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 border border-gray-200 rounded-md bg-white hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                {templateBusy ? "Working…" : "Replace template"}
              </button>
              {template && !template.isDefault && (
                <button
                  onClick={handleResetTemplate}
                  disabled={templateBusy}
                  className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-gray-500 hover:text-gray-900 disabled:opacity-50"
                >
                  Reset to default
                </button>
              )}
            </div>
          </div>
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
