"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import * as XLSX from "xlsx";
import ProjectNav from "@/components/ProjectNav";
import {
  Plus,
  Upload,
  ArrowRightCircle,
  Pencil,
  Trash2,
  Check,
  X,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

// ─── CSI Divisions ────────────────────────────────────────────────────────────
const CSI_DIVISIONS = [
  { code: "00", name: "Procurement and Contracting Requirements" },
  { code: "01", name: "General Requirements" },
  { code: "02", name: "Existing Conditions" },
  { code: "03", name: "Concrete" },
  { code: "04", name: "Masonry" },
  { code: "05", name: "Metals" },
  { code: "06", name: "Wood, Plastics, and Composites" },
  { code: "07", name: "Thermal and Moisture Protection" },
  { code: "08", name: "Openings" },
  { code: "09", name: "Finishes" },
  { code: "10", name: "Specialties" },
  { code: "11", name: "Equipment" },
  { code: "12", name: "Furnishings" },
  { code: "13", name: "Special Construction" },
  { code: "14", name: "Conveying Equipment" },
  { code: "21", name: "Fire Suppression" },
  { code: "22", name: "Plumbing" },
  { code: "23", name: "HVAC" },
  { code: "25", name: "Integrated Automation" },
  { code: "26", name: "Electrical" },
  { code: "27", name: "Communications" },
  { code: "28", name: "Electronic Safety and Security" },
  { code: "31", name: "Earthwork" },
  { code: "32", name: "Exterior Improvements" },
  { code: "33", name: "Utilities" },
];

// ─── Types ────────────────────────────────────────────────────────────────────
interface EstimateItem {
  id: string;
  project_id: string;
  division_code: string;
  division_name: string;
  cost_code: string | null;
  description: string;
  quantity: number;
  unit: string;
  unit_cost: number;
  total_cost: number;
  notes: string | null;
  sort_order: number;
  created_at: string;
}

interface AddItemForm {
  divisionCode: string;
  cost_code: string;
  description: string;
  quantity: string;
  unit: string;
  unit_cost: string;
  notes: string;
}

interface EditItemForm {
  cost_code: string;
  description: string;
  quantity: string;
  unit: string;
  unit_cost: string;
  notes: string;
}

interface ExcelRow {
  [key: string]: string | number | null | undefined;
}

interface MappingState {
  description: string;
  quantity: string;
  unit: string;
  unit_cost: string;
  cost_code: string;
  division_code: string;
  division_name: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmt(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function getDivisionName(code: string) {
  return CSI_DIVISIONS.find((d) => d.code === code)?.name || "General Requirements";
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function EstimatingClient({ projectId }: { projectId: string }) {
  const [items, setItems] = useState<EstimateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  // Add form state
  const [addingToDivision, setAddingToDivision] = useState<string | null>(null);
  const [addForm, setAddForm] = useState<AddItemForm>({
    divisionCode: "01",
    cost_code: "",
    description: "",
    quantity: "1",
    unit: "LS",
    unit_cost: "0",
    notes: "",
  });
  const [addSaving, setAddSaving] = useState(false);

  // New division picker for top-level "Add Line Item"
  const [showDivisionPicker, setShowDivisionPicker] = useState(false);
  const divPickerRef = useRef<HTMLDivElement>(null);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditItemForm>({
    cost_code: "",
    description: "",
    quantity: "1",
    unit: "LS",
    unit_cost: "0",
    notes: "",
  });
  const [editSaving, setEditSaving] = useState(false);

  // Collapsed divisions
  const [collapsedDivisions, setCollapsedDivisions] = useState<Set<string>>(new Set());

  // Excel import
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [excelRows, setExcelRows] = useState<ExcelRow[]>([]);
  const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [mapping, setMapping] = useState<MappingState>({
    description: "",
    quantity: "",
    unit: "",
    unit_cost: "",
    cost_code: "",
    division_code: "",
    division_name: "",
  });
  const [importLoading, setImportLoading] = useState(false);

  // Push to budget
  const [pushLoading, setPushLoading] = useState(false);
  const [showPushConfirm, setShowPushConfirm] = useState(false);

  // ── Data loading ────────────────────────────────────────────────────────────
  const loadItems = useCallback(async () => {
    setLoading(true);
    const r = await fetch(`/api/projects/${projectId}/estimate`);
    if (r.ok) {
      const data = await r.json();
      setItems(data);
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  // Close division picker on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (divPickerRef.current && !divPickerRef.current.contains(e.target as Node)) {
        setShowDivisionPicker(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Auto-clear toast
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3500);
      return () => clearTimeout(t);
    }
  }, [toast]);

  // ── Calculations ────────────────────────────────────────────────────────────
  const grandTotal = items.reduce((sum, item) => sum + (Number(item.total_cost) || 0), 0);

  // Group items by division
  const grouped = items.reduce<Record<string, EstimateItem[]>>((acc, item) => {
    const key = `${item.division_code}|${item.division_name}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  const divisionKeys = Object.keys(grouped).sort((a, b) => {
    const [codeA] = a.split("|");
    const [codeB] = b.split("|");
    return codeA.localeCompare(codeB);
  });

  // ── Add Item ────────────────────────────────────────────────────────────────
  function startAddInDivision(divisionCode: string) {
    const div = CSI_DIVISIONS.find((d) => d.code === divisionCode);
    setAddForm({
      divisionCode,
      cost_code: "",
      description: "",
      quantity: "1",
      unit: "LS",
      unit_cost: "0",
      notes: "",
    });
    setAddingToDivision(divisionCode);
    setShowDivisionPicker(false);
    // If division not in grouped yet, we show the form at bottom
  }

  async function handleAddSave() {
    if (!addForm.description.trim()) {
      setToast({ msg: "Description is required", type: "error" });
      return;
    }
    setAddSaving(true);
    const div = CSI_DIVISIONS.find((d) => d.code === addForm.divisionCode);
    const r = await fetch(`/api/projects/${projectId}/estimate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        division_code: addForm.divisionCode,
        division_name: div?.name || "General Requirements",
        cost_code: addForm.cost_code || null,
        description: addForm.description,
        quantity: parseFloat(addForm.quantity) || 1,
        unit: addForm.unit || "LS",
        unit_cost: parseFloat(addForm.unit_cost) || 0,
        notes: addForm.notes || null,
        sort_order: (grouped[`${addForm.divisionCode}|${div?.name}`] || []).length,
      }),
    });
    setAddSaving(false);
    if (r.ok) {
      setAddingToDivision(null);
      setToast({ msg: "Item added", type: "success" });
      loadItems();
    } else {
      const d = await r.json();
      setToast({ msg: d.error || "Failed to add item", type: "error" });
    }
  }

  // ── Edit Item ───────────────────────────────────────────────────────────────
  function startEdit(item: EstimateItem) {
    setEditingId(item.id);
    setEditForm({
      cost_code: item.cost_code || "",
      description: item.description,
      quantity: String(item.quantity),
      unit: item.unit,
      unit_cost: String(item.unit_cost),
      notes: item.notes || "",
    });
  }

  async function handleEditSave(item: EstimateItem) {
    if (!editForm.description.trim()) {
      setToast({ msg: "Description is required", type: "error" });
      return;
    }
    setEditSaving(true);
    const r = await fetch(`/api/projects/${projectId}/estimate/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cost_code: editForm.cost_code || null,
        description: editForm.description,
        quantity: parseFloat(editForm.quantity) || 1,
        unit: editForm.unit || "LS",
        unit_cost: parseFloat(editForm.unit_cost) || 0,
        notes: editForm.notes || null,
      }),
    });
    setEditSaving(false);
    if (r.ok) {
      setEditingId(null);
      loadItems();
    } else {
      const d = await r.json();
      setToast({ msg: d.error || "Failed to update", type: "error" });
    }
  }

  // ── Delete Item ─────────────────────────────────────────────────────────────
  async function handleDelete(item: EstimateItem) {
    if (!confirm(`Delete "${item.description}"?`)) return;
    const r = await fetch(`/api/projects/${projectId}/estimate/${item.id}`, { method: "DELETE" });
    if (r.ok) {
      setToast({ msg: "Item deleted", type: "success" });
      loadItems();
    } else {
      setToast({ msg: "Failed to delete", type: "error" });
    }
  }

  // ── Excel Import ────────────────────────────────────────────────────────────
  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    const reader = new FileReader();
    reader.onload = (evt) => {
      const arrayBuffer = evt.target?.result as ArrayBuffer;
      const wb = XLSX.read(new Uint8Array(arrayBuffer), { type: "array" });
      const sheetName = wb.SheetNames[0];
      const sheet = wb.Sheets[sheetName];
      const rawRows = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, { header: 1 });

      if (rawRows.length < 2) {
        setToast({ msg: "Excel file appears empty", type: "error" });
        return;
      }

      const headers = (rawRows[0] as (string | number)[]).map((h) => String(h ?? ""));
      const dataRows: ExcelRow[] = rawRows.slice(1).map((row) => {
        const obj: ExcelRow = {};
        headers.forEach((h, i) => {
          obj[h] = (row as (string | number | null | undefined)[])[i] ?? null;
        });
        return obj;
      });

      setExcelHeaders(headers);
      setExcelRows(dataRows);

      // Auto-detect mapping by common column names
      const autoMap = (candidates: string[]) => {
        for (const c of candidates) {
          const found = headers.find((h) => h.toLowerCase().includes(c.toLowerCase()));
          if (found) return found;
        }
        return "";
      };

      setMapping({
        description: autoMap(["description", "desc", "item", "scope"]),
        quantity: autoMap(["quantity", "qty", "count"]),
        unit: autoMap(["unit", "uom", "u/m"]),
        unit_cost: autoMap(["unit cost", "unit_cost", "cost", "rate", "price"]),
        cost_code: autoMap(["cost code", "cost_code", "code"]),
        division_code: autoMap(["division code", "division_code", "div code", "div"]),
        division_name: autoMap(["division name", "division_name", "division"]),
      });

      setShowMappingModal(true);
    };
    reader.readAsArrayBuffer(file);
  }

  async function handleImport() {
    if (!mapping.description) {
      setToast({ msg: "Please map the Description column", type: "error" });
      return;
    }
    setImportLoading(true);

    const items = excelRows
      .filter((row) => row[mapping.description]?.toString().trim())
      .map((row) => ({
        description: String(row[mapping.description] ?? ""),
        quantity: mapping.quantity ? Number(row[mapping.quantity]) || 1 : 1,
        unit: mapping.unit ? String(row[mapping.unit] ?? "LS") : "LS",
        unit_cost: mapping.unit_cost ? Number(row[mapping.unit_cost]) || 0 : 0,
        cost_code: mapping.cost_code ? String(row[mapping.cost_code] ?? "") : "",
        division_code: mapping.division_code ? String(row[mapping.division_code] ?? "01") : "01",
        division_name: mapping.division_name
          ? String(row[mapping.division_name] ?? "General Requirements")
          : "General Requirements",
      }));

    const r = await fetch(`/api/projects/${projectId}/estimate/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });
    setImportLoading(false);

    if (r.ok) {
      const d = await r.json();
      setShowMappingModal(false);
      setToast({ msg: `Imported ${d.count} items`, type: "success" });
      loadItems();
    } else {
      const d = await r.json();
      setToast({ msg: d.error || "Import failed", type: "error" });
    }
  }

  // ── Push to Budget ──────────────────────────────────────────────────────────
  async function handlePushToBudget() {
    setPushLoading(true);
    setShowPushConfirm(false);
    const r = await fetch(`/api/projects/${projectId}/estimate/push-to-budget`, {
      method: "POST",
    });
    setPushLoading(false);
    if (r.ok) {
      const d = await r.json();
      setToast({ msg: `Pushed ${d.count} items to Budget`, type: "success" });
    } else {
      const d = await r.json();
      setToast({ msg: d.error || "Push to Budget failed", type: "error" });
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      <ProjectNav projectId={projectId} />

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg text-sm font-medium shadow-lg transition-all ${
            toast.type === "success"
              ? "bg-green-600 text-white"
              : "bg-red-600 text-white"
          }`}
        >
          {toast.msg}
        </div>
      )}

      {/* Push to Budget Confirm Modal */}
      {showPushConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl w-full max-w-md shadow-xl p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-2">Push to Budget?</h3>
            <p className="text-sm text-gray-600 mb-5">
              This will replace all existing budget line items for this project with items from your
              current estimate. This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowPushConfirm(false)}
                className="px-4 py-2 text-sm text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handlePushToBudget}
                disabled={pushLoading}
                className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                {pushLoading ? "Pushing..." : "Push to Budget"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Column Mapping Modal */}
      {showMappingModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl w-full max-w-2xl shadow-xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-base font-semibold text-gray-900">Map Excel Columns</h3>
              <button
                onClick={() => setShowMappingModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="overflow-y-auto px-6 py-5 space-y-5">
              {/* Preview */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500 mb-2">
                  Preview (first 3 rows)
                </p>
                <div className="overflow-x-auto border border-gray-200 rounded-lg">
                  <table className="text-xs w-full">
                    <thead>
                      <tr className="bg-gray-50">
                        {excelHeaders.map((h) => (
                          <th
                            key={h}
                            className="px-3 py-2 text-left font-medium text-gray-500 border-r border-gray-200 last:border-r-0 whitespace-nowrap"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {excelRows.slice(0, 3).map((row, i) => (
                        <tr key={i} className="border-t border-gray-100">
                          {excelHeaders.map((h) => (
                            <td
                              key={h}
                              className="px-3 py-1.5 text-gray-700 border-r border-gray-100 last:border-r-0 whitespace-nowrap max-w-[160px] truncate"
                            >
                              {String(row[h] ?? "")}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Mapping dropdowns */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500 mb-3">
                  Column Mapping
                </p>
                <div className="grid grid-cols-2 gap-4">
                  {(
                    [
                      { key: "description", label: "Description", required: true },
                      { key: "quantity", label: "Quantity", required: false },
                      { key: "unit", label: "Unit", required: false },
                      { key: "unit_cost", label: "Unit Cost", required: false },
                      { key: "cost_code", label: "Cost Code", required: false },
                      { key: "division_code", label: "Division Code", required: false },
                      { key: "division_name", label: "Division Name", required: false },
                    ] as { key: keyof MappingState; label: string; required: boolean }[]
                  ).map(({ key, label, required }) => (
                    <div key={key}>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        {label}
                        {required && <span className="text-red-500 ml-0.5">*</span>}
                      </label>
                      <select
                        value={mapping[key]}
                        onChange={(e) => setMapping((m) => ({ ...m, [key]: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                      >
                        <option value="">-- not mapped --</option>
                        {excelHeaders.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button
                onClick={() => setShowMappingModal(false)}
                className="px-4 py-2 text-sm text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={importLoading || !mapping.description}
                className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                {importLoading
                  ? "Importing..."
                  : `Import ${excelRows.filter((r) => r[mapping.description]?.toString().trim()).length} rows`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Page content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="font-display text-[28px] leading-tight text-[color:var(--ink)]">Estimating</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Build and organize your project cost estimate by CSI division
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400 uppercase tracking-widest font-medium">
              Total Estimate
            </p>
            <p className="text-2xl font-bold text-gray-900">{fmt(grandTotal)}</p>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          {/* Add Line Item with division picker */}
          <div ref={divPickerRef} className="relative">
            <button
              onClick={() => setShowDivisionPicker((v) => !v)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Line Item
            </button>
            {showDivisionPicker && (
              <div className="absolute left-0 top-full mt-1 w-72 bg-white border border-gray-200 rounded-xl shadow-xl z-30 max-h-72 overflow-y-auto">
                <p className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-widest border-b border-gray-100">
                  Select Division
                </p>
                {CSI_DIVISIONS.map((div) => (
                  <button
                    key={div.code}
                    onClick={() => startAddInDivision(div.code)}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <span className="font-medium text-gray-900 mr-2">{div.code}</span>
                    {div.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Import from Excel */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Upload className="w-4 h-4" />
            Import from Excel
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleFileSelect}
          />

          {/* Push to Budget */}
          <button
            onClick={() => setShowPushConfirm(true)}
            disabled={pushLoading || items.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 ml-auto"
          >
            <ArrowRightCircle className="w-4 h-4" />
            {pushLoading ? "Pushing..." : "Push to Budget"}
          </button>
        </div>

        {/* Table */}
        {loading ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-400">
            Loading estimate...
          </div>
        ) : divisionKeys.length === 0 && addingToDivision === null ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <p className="text-gray-400 text-sm mb-4">No estimate items yet.</p>
            <button
              onClick={() => setShowDivisionPicker(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add your first line item
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {divisionKeys.map((key) => {
              const [divCode, divName] = key.split("|");
              const divItems = grouped[key];
              const divTotal = divItems.reduce(
                (sum, item) => sum + (Number(item.total_cost) || 0),
                0
              );
              const isCollapsed = collapsedDivisions.has(key);

              return (
                <div key={key} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  {/* Division header */}
                  <div
                    className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-200 cursor-pointer select-none"
                    onClick={() =>
                      setCollapsedDivisions((prev) => {
                        const next = new Set(prev);
                        if (next.has(key)) next.delete(key);
                        else next.add(key);
                        return next;
                      })
                    }
                  >
                    <div className="flex items-center gap-3">
                      {isCollapsed ? (
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      ) : (
                        <ChevronUp className="w-4 h-4 text-gray-400" />
                      )}
                      <span className="text-sm font-semibold text-gray-900">
                        {divCode} — {divName}
                      </span>
                      <span className="text-xs text-gray-400">{divItems.length} item{divItems.length !== 1 ? "s" : ""}</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-900">{fmt(divTotal)}</span>
                  </div>

                  {!isCollapsed && (
                    <>
                      {/* Column headers */}
                      <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_80px] px-5 py-2 border-b border-gray-100 bg-gray-50/50">
                        {["Cost Code", "Description", "Qty", "Unit", "Unit Cost", "Total", ""].map(
                          (h, i) => (
                            <div
                              key={i}
                              className={`text-xs font-medium text-gray-400 uppercase tracking-widest ${
                                i >= 2 && i <= 5 ? "text-right" : ""
                              } ${i === 0 ? "col-span-1" : ""}`}
                            >
                              {h}
                            </div>
                          )
                        )}
                      </div>

                      {/* Items */}
                      {divItems.map((item) => (
                        <div key={item.id}>
                          {editingId === item.id ? (
                            // Edit row
                            <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_80px] px-5 py-2.5 border-b border-gray-100 bg-orange-50 items-center gap-2">
                              <input
                                value={editForm.cost_code}
                                onChange={(e) =>
                                  setEditForm((f) => ({ ...f, cost_code: e.target.value }))
                                }
                                placeholder="Cost code"
                                className="px-2 py-1 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
                              />
                              <input
                                value={editForm.description}
                                onChange={(e) =>
                                  setEditForm((f) => ({ ...f, description: e.target.value }))
                                }
                                placeholder="Description"
                                className="px-2 py-1 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
                              />
                              <input
                                type="number"
                                value={editForm.quantity}
                                onChange={(e) =>
                                  setEditForm((f) => ({ ...f, quantity: e.target.value }))
                                }
                                className="px-2 py-1 border border-gray-200 rounded text-sm text-right focus:outline-none focus:ring-1 focus:ring-orange-400"
                              />
                              <input
                                value={editForm.unit}
                                onChange={(e) =>
                                  setEditForm((f) => ({ ...f, unit: e.target.value }))
                                }
                                className="px-2 py-1 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
                              />
                              <input
                                type="number"
                                value={editForm.unit_cost}
                                onChange={(e) =>
                                  setEditForm((f) => ({ ...f, unit_cost: e.target.value }))
                                }
                                className="px-2 py-1 border border-gray-200 rounded text-sm text-right focus:outline-none focus:ring-1 focus:ring-orange-400"
                              />
                              <div className="text-sm text-right text-gray-500">
                                {fmt(
                                  (parseFloat(editForm.quantity) || 0) *
                                    (parseFloat(editForm.unit_cost) || 0)
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 justify-end">
                                <button
                                  onClick={() => handleEditSave(item)}
                                  disabled={editSaving}
                                  className="p-1 text-green-600 hover:bg-green-50 rounded transition-colors disabled:opacity-50"
                                  title="Save"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => setEditingId(null)}
                                  className="p-1 text-gray-400 hover:bg-gray-100 rounded transition-colors"
                                  title="Cancel"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          ) : (
                            // View row
                            <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_80px] px-5 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors items-center group">
                              <div className="text-sm text-gray-500">{item.cost_code || "—"}</div>
                              <div className="text-sm text-gray-900 font-medium">
                                {item.description}
                              </div>
                              <div className="text-sm text-gray-700 text-right">
                                {Number(item.quantity).toLocaleString()}
                              </div>
                              <div className="text-sm text-gray-500">{item.unit}</div>
                              <div className="text-sm text-gray-700 text-right">
                                {fmt(Number(item.unit_cost))}
                              </div>
                              <div className="text-sm font-medium text-gray-900 text-right">
                                {fmt(Number(item.total_cost))}
                              </div>
                              <div className="flex items-center gap-1.5 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => startEdit(item)}
                                  className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                                  title="Edit"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDelete(item)}
                                  className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                  title="Delete"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}

                      {/* Add item row for this division */}
                      {addingToDivision === divCode ? (
                        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_80px] px-5 py-2.5 border-b border-gray-100 bg-blue-50 items-center gap-2">
                          <input
                            value={addForm.cost_code}
                            onChange={(e) =>
                              setAddForm((f) => ({ ...f, cost_code: e.target.value }))
                            }
                            placeholder="Cost code"
                            className="px-2 py-1 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-gray-900"
                          />
                          <input
                            autoFocus
                            value={addForm.description}
                            onChange={(e) =>
                              setAddForm((f) => ({ ...f, description: e.target.value }))
                            }
                            placeholder="Description *"
                            className="px-2 py-1 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-gray-900"
                          />
                          <input
                            type="number"
                            value={addForm.quantity}
                            onChange={(e) =>
                              setAddForm((f) => ({ ...f, quantity: e.target.value }))
                            }
                            className="px-2 py-1 border border-gray-200 rounded text-sm text-right focus:outline-none focus:ring-1 focus:ring-gray-900"
                          />
                          <input
                            value={addForm.unit}
                            onChange={(e) => setAddForm((f) => ({ ...f, unit: e.target.value }))}
                            className="px-2 py-1 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-gray-900"
                          />
                          <input
                            type="number"
                            value={addForm.unit_cost}
                            onChange={(e) =>
                              setAddForm((f) => ({ ...f, unit_cost: e.target.value }))
                            }
                            className="px-2 py-1 border border-gray-200 rounded text-sm text-right focus:outline-none focus:ring-1 focus:ring-gray-900"
                          />
                          <div className="text-sm text-right text-gray-500">
                            {fmt(
                              (parseFloat(addForm.quantity) || 0) *
                                (parseFloat(addForm.unit_cost) || 0)
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 justify-end">
                            <button
                              onClick={handleAddSave}
                              disabled={addSaving}
                              className="p-1 text-green-600 hover:bg-green-50 rounded transition-colors disabled:opacity-50"
                              title="Save"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setAddingToDivision(null)}
                              className="p-1 text-gray-400 hover:bg-gray-100 rounded transition-colors"
                              title="Cancel"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => startAddInDivision(divCode)}
                          className="w-full flex items-center gap-2 px-5 py-2.5 text-sm text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Add item to {divCode} — {divName}
                        </button>
                      )}
                    </>
                  )}
                </div>
              );
            })}

            {/* Add form for a new division not yet in table */}
            {addingToDivision !== null &&
              !divisionKeys.some((k) => k.startsWith(`${addingToDivision}|`)) && (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-200">
                    <span className="text-sm font-semibold text-gray-900">
                      {addingToDivision} — {getDivisionName(addingToDivision)}
                    </span>
                  </div>
                  <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_80px] px-5 py-2.5 bg-blue-50 items-center gap-2">
                    <input
                      value={addForm.cost_code}
                      onChange={(e) => setAddForm((f) => ({ ...f, cost_code: e.target.value }))}
                      placeholder="Cost code"
                      className="px-2 py-1 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-gray-900"
                    />
                    <input
                      autoFocus
                      value={addForm.description}
                      onChange={(e) => setAddForm((f) => ({ ...f, description: e.target.value }))}
                      placeholder="Description *"
                      className="px-2 py-1 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-gray-900"
                    />
                    <input
                      type="number"
                      value={addForm.quantity}
                      onChange={(e) => setAddForm((f) => ({ ...f, quantity: e.target.value }))}
                      className="px-2 py-1 border border-gray-200 rounded text-sm text-right focus:outline-none focus:ring-1 focus:ring-gray-900"
                    />
                    <input
                      value={addForm.unit}
                      onChange={(e) => setAddForm((f) => ({ ...f, unit: e.target.value }))}
                      className="px-2 py-1 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-gray-900"
                    />
                    <input
                      type="number"
                      value={addForm.unit_cost}
                      onChange={(e) => setAddForm((f) => ({ ...f, unit_cost: e.target.value }))}
                      className="px-2 py-1 border border-gray-200 rounded text-sm text-right focus:outline-none focus:ring-1 focus:ring-gray-900"
                    />
                    <div className="text-sm text-right text-gray-500">
                      {fmt(
                        (parseFloat(addForm.quantity) || 0) * (parseFloat(addForm.unit_cost) || 0)
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 justify-end">
                      <button
                        onClick={handleAddSave}
                        disabled={addSaving}
                        className="p-1 text-green-600 hover:bg-green-50 rounded transition-colors disabled:opacity-50"
                        title="Save"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setAddingToDivision(null)}
                        className="p-1 text-gray-400 hover:bg-gray-100 rounded transition-colors"
                        title="Cancel"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
          </div>
        )}
      </div>
    </div>
  );
}
