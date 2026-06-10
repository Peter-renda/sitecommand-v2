"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ProjectNav from "@/components/ProjectNav";
import ReportFieldsSection, { type ReportFieldValues } from "@/components/ReportFieldsSection";
import {
  REPORT_RECORD_ENTITIES,
  REPORT_RECORD_BY_SLUG,
} from "@/lib/report-record-fields";

type ReportRecord = {
  id: string;
  entity: string;
  report_fields: ReportFieldValues;
  created_at: string;
  updated_at: string;
};

export default function ReportRecordsClient({ projectId }: { projectId: string }) {
  const [activeSlug, setActiveSlug] = useState(REPORT_RECORD_ENTITIES[0]?.slug ?? "");
  const [records, setRecords] = useState<ReportRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Add/edit modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ReportFieldValues>({});
  const [saving, setSaving] = useState(false);

  const entity = REPORT_RECORD_BY_SLUG[activeSlug];

  // The first few text fields make a reasonable table preview per entity.
  const previewFields = useMemo(() => (entity?.fields ?? []).slice(0, 5), [entity]);

  async function loadRecords(slug: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/report-records?entity=${encodeURIComponent(slug)}`);
      setRecords(res.ok ? await res.json() : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (activeSlug) void loadRecords(activeSlug);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSlug]);

  function openAdd() {
    setEditingId(null);
    setDraft({});
    setModalOpen(true);
  }

  function openEdit(rec: ReportRecord) {
    setEditingId(rec.id);
    setDraft(rec.report_fields ?? {});
    setModalOpen(true);
  }

  async function saveDraft() {
    setSaving(true);
    try {
      if (editingId) {
        const res = await fetch(`/api/projects/${projectId}/report-records/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ report_fields: draft }),
        });
        if (res.ok) {
          const updated: ReportRecord = await res.json();
          setRecords((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
          setModalOpen(false);
        }
      } else {
        const res = await fetch(`/api/projects/${projectId}/report-records`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entity: activeSlug, report_fields: draft }),
        });
        if (res.ok) {
          const created: ReportRecord = await res.json();
          setRecords((prev) => [...prev, created]);
          setModalOpen(false);
        }
      }
    } finally {
      setSaving(false);
    }
  }

  async function deleteRecord(id: string) {
    if (!window.confirm("Delete this record?")) return;
    const res = await fetch(`/api/projects/${projectId}/report-records/${id}`, { method: "DELETE" });
    if (res.ok) setRecords((prev) => prev.filter((r) => r.id !== id));
  }

  const visibleRecords = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return records;
    return records.filter((r) =>
      Object.values(r.report_fields ?? {}).some((v) => String(v ?? "").toLowerCase().includes(q)),
    );
  }, [records, search]);

  function cell(rec: ReportRecord, key: string) {
    const v = rec.report_fields?.[key];
    if (v === null || v === undefined || v === "") return "—";
    if (typeof v === "boolean") return v ? "Yes" : "No";
    return String(v);
  }

  return (
    <div>
      <ProjectNav projectId={projectId} />
      <div className="px-6 py-4">
        <div className="text-xs text-gray-500 mb-2">
          <Link href={`/projects/${projectId}/reporting`} className="text-blue-600 hover:underline">
            Reports
          </Link>
          <span className="mx-1">/</span>
          <span className="text-gray-700">Report Records</span>
        </div>

        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Report Records</h1>
            <p className="text-sm text-gray-500 mt-1 max-w-2xl">
              Manually maintained data for 360-report categories that don&rsquo;t yet have a dedicated tool
              (invoices, payments, employees, labor, production quantities, ERP job costs, and more). Records
              entered here populate their matching columns in 360 Reports.
            </p>
          </div>
        </div>

        <div className="flex gap-6">
          {/* Entity nav */}
          <nav className="w-64 flex-shrink-0">
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              {REPORT_RECORD_ENTITIES.map((e) => (
                <button
                  key={e.slug}
                  onClick={() => setActiveSlug(e.slug)}
                  className={`w-full text-left px-3 py-2 text-sm border-l-2 ${
                    activeSlug === e.slug
                      ? "border-violet-600 bg-violet-50 text-violet-900 font-medium"
                      : "border-transparent text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {e.label}
                </button>
              ))}
            </div>
          </nav>

          {/* Records table */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-3 gap-3">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search records"
                className="w-64 px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
              <button
                onClick={openAdd}
                className="px-4 py-1.5 text-sm font-medium bg-violet-600 text-white rounded-md hover:bg-violet-700"
              >
                + Add {entity?.label}
              </button>
            </div>

            <div className="border border-gray-200 rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {previewFields.map((f) => (
                      <th key={f.key} className="px-3 py-2 text-left font-medium text-gray-600 border-b border-gray-200 whitespace-nowrap">
                        {f.label}
                      </th>
                    ))}
                    <th className="px-3 py-2 border-b border-gray-200 w-24"></th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={previewFields.length + 1} className="px-3 py-6 text-center text-gray-400">Loading…</td></tr>
                  ) : visibleRecords.length === 0 ? (
                    <tr><td colSpan={previewFields.length + 1} className="px-3 py-6 text-center text-gray-400">No records yet.</td></tr>
                  ) : (
                    visibleRecords.map((rec) => (
                      <tr key={rec.id} className="border-b border-gray-100 hover:bg-gray-50">
                        {previewFields.map((f) => (
                          <td key={f.key} className="px-3 py-2 text-gray-700 whitespace-nowrap">{cell(rec, f.key)}</td>
                        ))}
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          <button onClick={() => openEdit(rec)} className="text-xs text-blue-600 hover:underline mr-3">Edit</button>
                          <button onClick={() => deleteRecord(rec.id)} className="text-xs text-red-600 hover:underline">Delete</button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Add/Edit modal */}
      {modalOpen && entity && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4 py-6 overflow-y-auto" onMouseDown={() => setModalOpen(false)}>
          <div className="bg-white rounded-xl w-full max-w-3xl shadow-xl my-auto max-h-[88vh] overflow-y-auto" onMouseDown={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900">
                {editingId ? "Edit" : "Add"} {entity.label}
              </h2>
            </div>
            <div className="px-6 py-5">
              <ReportFieldsSection
                title={`${entity.label} Fields`}
                description="All fields are stored with this record and surfaced as columns in 360 Reports."
                fields={entity.fields}
                values={draft}
                onChange={(key, value) => setDraft((prev) => ({ ...prev, [key]: value }))}
                columns={3}
              />
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3">
              <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50">Cancel</button>
              <button onClick={saveDraft} disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-md hover:bg-gray-700 disabled:opacity-50">
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
