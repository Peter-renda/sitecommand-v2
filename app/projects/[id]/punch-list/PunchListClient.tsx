"use client";

import { useState, useEffect, useRef, ChangeEvent } from "react";
import ProjectNav from "@/components/ProjectNav";
import EmptyState from "@/app/components/EmptyState";
import { SkeletonTable } from "@/app/components/Skeleton";

type DirContact = { id: string; name: string; email: string | null };
type BudgetItem = { id: string; cost_code: string; description: string };
type DirectoryContact = {
  id: string;
  type: string;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  group_name: string | null;
  email: string | null;
};

type PunchListItem = {
  id: string;
  item_number: number;
  title: string;
  status: string;
  punch_item_manager_id: string | null;
  type: string | null;
  assignees: DirContact[];
  due_date: string | null;
  final_approver_id: string | null;
  distribution_list: DirContact[];
  location: string | null;
  priority: string | null;
  trade: string | null;
  reference: string | null;
  schedule_impact: string | null;
  cost_impact: string | null;
  cost_codes: string | null;
  private: boolean;
  description: string | null;
  attachments: { name: string; url: string }[];
  created_by: string | null;
  created_at: string;
};


const PRIORITIES = ["Low", "Medium", "High"];
const STATUSES = ["open", "in_progress", "closed"];
const STATUS_LABELS: Record<string, string> = { open: "Open", in_progress: "In Progress", closed: "Closed" };
const STATUS_COLORS: Record<string, string> = {
  open: "bg-blue-50 text-blue-700",
  in_progress: "bg-amber-50 text-amber-700",
  closed: "bg-gray-100 text-gray-600",
};
const PRIORITY_COLORS: Record<string, string> = {
  Low: "bg-gray-50 text-gray-600",
  Medium: "bg-yellow-50 text-yellow-700",
  High: "bg-red-50 text-red-700",
};
function contactDisplayName(c: DirectoryContact): string {
  if (c.type === "company") return c.company ?? "Unnamed Company";
  if (c.type === "distribution_group") return c.group_name ?? "Unnamed Group";
  return [c.first_name, c.last_name].filter(Boolean).join(" ") || "Unnamed";
}

function formatDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function getContactNameById(directory: DirectoryContact[], id: string | null): string {
  if (!id) return "—";
  const c = directory.find((x) => x.id === id);
  return c ? contactDisplayName(c) : "—";
}
function MultiContactPicker({
  directory, selected, onChange, placeholder = "Search directory...",
}: {
  directory: DirectoryContact[];
  selected: DirContact[];
  onChange: (v: DirContact[]) => void;
  placeholder?: string;
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);
  const selectedIds = new Set(selected.map((s) => s.id));
  const filtered = directory.filter(
    (c) => !selectedIds.has(c.id) &&
      (contactDisplayName(c).toLowerCase().includes(search.toLowerCase()) ||
        (c.email ?? "").toLowerCase().includes(search.toLowerCase()))
  );
  function add(c: DirectoryContact) {
    onChange([...selected, { id: c.id, name: contactDisplayName(c), email: c.email }]);
    setSearch("");
  }
  function remove(id: string) { onChange(selected.filter((s) => s.id !== id)); }
  return (
    <div ref={ref} className="relative">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selected.map((s) => (
            <span key={s.id} className="flex items-center gap-1 pl-2.5 pr-1.5 py-1 bg-gray-100 text-xs text-gray-700 rounded-full">
              {s.name}
              <button type="button" onClick={() => remove(s.id)} className="text-gray-400 hover:text-gray-700 ml-0.5">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </span>
          ))}
        </div>
      )}
      <input type="text" value={search} onChange={(e) => { setSearch(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} placeholder={placeholder} className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
      {open && filtered.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-100 rounded-md shadow-lg max-h-40 overflow-y-auto z-20">
          {filtered.map((c) => (
            <button key={c.id} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => add(c)} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2">
              <span className="font-medium text-gray-900">{contactDisplayName(c)}</span>
              {c.email && <span className="text-gray-400 text-xs">{c.email}</span>}
            </button>
          ))}
        </div>
      )}
      {open && search && filtered.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-100 rounded-md shadow-lg px-3 py-2 z-20"><p className="text-xs text-gray-400">No matching contacts</p></div>
      )}
    </div>
  );
}

function SingleContactPicker({
  directory, selectedId, onChange, placeholder = "Select...",
}: {
  directory: DirectoryContact[];
  selectedId: string | null;
  onChange: (id: string | null) => void;
  placeholder?: string;
}) {
  return (
    <select value={selectedId ?? ""} onChange={(e) => onChange(e.target.value || null)} className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white">
      <option value="">{placeholder}</option>
      {directory.map((c) => <option key={c.id} value={c.id}>{contactDisplayName(c)}</option>)}
    </select>
  );
}

function CostCodePicker({
  options, selected, onChange,
}: {
  options: BudgetItem[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  const [selectedOption, setSelectedOption] = useState("");
  const availableOptions = options.filter((o) => !selected.includes(o.cost_code));

  function add(code: string) {
    if (!code || selected.includes(code)) return;
    onChange([...selected, code]);
    setSelectedOption("");
  }
  function remove(code: string) { onChange(selected.filter((s) => s !== code)); }
  return (
    <div>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selected.map((code) => (
            <span key={code} className="flex items-center gap-1 pl-2.5 pr-1.5 py-1 bg-gray-100 text-xs text-gray-700 rounded-full">
              {code}
              <button type="button" onClick={() => remove(code)} className="text-gray-400 hover:text-gray-700 ml-0.5">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </span>
          ))}
        </div>
      )}
      <select
        value={selectedOption}
        onChange={(e) => {
          setSelectedOption(e.target.value);
          add(e.target.value);
        }}
        className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
      >
        <option value="">{availableOptions.length ? "Select cost code..." : "No cost codes available"}</option>
        {availableOptions.map((o) => (
          <option key={o.id} value={o.cost_code}>
            {o.cost_code}{o.description ? ` — ${o.description}` : ""}
          </option>
        ))}
      </select>
    </div>
  );
}

function CreatePunchListModal({
  nextNumber, directory, budgetItems, onConfirm, onCancel, mode = "create", initialItem,
}: {
  nextNumber: number;
  directory: DirectoryContact[];
  budgetItems: BudgetItem[];
  onConfirm: (data: Record<string, unknown>) => void;
  onCancel: () => void;
  mode?: "create" | "edit";
  initialItem?: PunchListItem | null;
}) {
  const [itemNumber, setItemNumber] = useState(String(initialItem?.item_number ?? nextNumber));
  const [title, setTitle] = useState(initialItem?.title ?? "");
  const [punchItemManagerId, setPunchItemManagerId] = useState<string | null>(initialItem?.punch_item_manager_id ?? null);
  const [type, setType] = useState(initialItem?.type ?? "");
  const [assignees, setAssignees] = useState<DirContact[]>(initialItem?.assignees ?? []);
  const [dueDate, setDueDate] = useState(initialItem?.due_date ?? "");
  const [finalApproverId, setFinalApproverId] = useState<string | null>(initialItem?.final_approver_id ?? null);
  const [distributionList, setDistributionList] = useState<DirContact[]>(initialItem?.distribution_list ?? []);
  const [location, setLocation] = useState(initialItem?.location ?? "");
  const [priority, setPriority] = useState(initialItem?.priority ?? "");
  const [trade, setTrade] = useState(initialItem?.trade ?? "");
  const [reference, setReference] = useState(initialItem?.reference ?? "");
  const [scheduleImpact, setScheduleImpact] = useState(initialItem?.schedule_impact ?? "");
  const [costImpact, setCostImpact] = useState(initialItem?.cost_impact ?? "");
  const [selectedCostCodes, setSelectedCostCodes] = useState<string[]>(
    initialItem?.cost_codes
      ? initialItem.cost_codes.split(",").map((code) => code.trim()).filter(Boolean)
      : []
  );
  const [isPrivate, setIsPrivate] = useState(initialItem?.private ?? false);
  const [description, setDescription] = useState(initialItem?.description ?? "");
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const usersOnly = directory.filter((c) => c.type === "user");

  function buildData() {
    return {
      item_number: itemNumber ? Number(itemNumber) : undefined,
      title, punch_item_manager_id: punchItemManagerId, type: type || null,
      assignees, due_date: dueDate || null, final_approver_id: finalApproverId,
      distribution_list: distributionList, location: location || null,
      priority: priority || null, trade: trade || null, reference: reference || null,
      schedule_impact: scheduleImpact || null, cost_impact: costImpact || null,
      cost_codes: selectedCostCodes.length > 0 ? selectedCostCodes.join(", ") : null,
      private: isPrivate, description: description || null, attachmentFile, attachments: [],
    };
  }

  function validateForm() {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return "Title is required.";
    if (!itemNumber || !Number.isInteger(Number(itemNumber)) || Number(itemNumber) <= 0) return "Number is required and must be a whole number.";
    if (!punchItemManagerId) return "Punch item manager is required.";
    if (!finalApproverId) return "Final approver is required.";
    return null;
  }

  function handleSubmit() {
    const error = validateForm();
    if (error) {
      setFormError(error);
      return;
    }
    setFormError(null);
    onConfirm(buildData());
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4 py-6 overflow-y-auto">
      <div className="bg-white rounded-xl w-full max-w-2xl shadow-xl my-auto max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h2 className="text-sm font-semibold text-gray-900">{mode === "edit" ? "Edit Punch List Item" : "New Punch List Item"}</h2>
          <button type="button" onClick={onCancel} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Title / Number */}
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-1">Title <span className="text-red-500">*</span></label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Item title" className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Number <span className="text-red-500">*</span></label>
              <input type="text" value={itemNumber} onChange={(e) => setItemNumber(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
            </div>
          </div>

          {/* Punch Item Manager / Final Approver */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Punch Item Manager <span className="text-red-500">*</span></label>
              <SingleContactPicker directory={usersOnly} selectedId={punchItemManagerId} onChange={setPunchItemManagerId} placeholder="Select..." />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Final Approver <span className="text-red-500">*</span></label>
              <SingleContactPicker directory={usersOnly} selectedId={finalApproverId} onChange={setFinalApproverId} placeholder="Select..." />
            </div>
          </div>

          {/* Type / Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
              <input type="text" value={type} onChange={(e) => setType(e.target.value)} placeholder="Item type" className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Priority</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white">
                <option value="">Select priority...</option>
                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          {/* Assignees */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Assignee(s)</label>
            <MultiContactPicker directory={usersOnly} selected={assignees} onChange={setAssignees} placeholder="Select assignees..." />
          </div>

          {/* Due Date / Trade */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Due Date</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Trade</label>
              <input type="text" value={trade} onChange={(e) => setTrade(e.target.value)} placeholder="Trade" className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
            </div>
          </div>

          {/* Location / Reference */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Location</label>
              <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location" className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Reference</label>
              <input type="text" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Reference" className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
            </div>
          </div>

          {/* Schedule Impact / Cost Impact */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Schedule Impact</label>
              <select value={scheduleImpact} onChange={(e) => setScheduleImpact(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white">
                <option value="">Select...</option>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
                <option value="TBD">TBD</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Cost Impact</label>
              <select value={costImpact} onChange={(e) => setCostImpact(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white">
                <option value="">Select...</option>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
                <option value="TBD">TBD</option>
              </select>
            </div>
          </div>

          {/* Cost Codes */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Cost Codes</label>
            <CostCodePicker options={budgetItems} selected={selectedCostCodes} onChange={setSelectedCostCodes} />
          </div>

          {/* Distribution List */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Distribution List</label>
            <MultiContactPicker directory={usersOnly} selected={distributionList} onChange={setDistributionList} placeholder="Search directory..." />
          </div>

          {/* Private */}
          <div className="flex items-center gap-3 py-2 px-3 bg-gray-50 rounded-md">
            <input type="checkbox" id="punch-private" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} className="rounded border-gray-300 text-gray-900" />
            <label htmlFor="punch-private" className="text-sm text-gray-700 cursor-pointer">Private</label>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder="Description..." className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none" />
          </div>

          {/* Attachments */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Attachments</label>
            <input ref={fileInputRef} type="file" className="hidden" onChange={(e: ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) setAttachmentFile(f); }} />
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) setAttachmentFile(f); }}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${dragOver ? "border-gray-400 bg-gray-50" : "border-gray-200 hover:border-gray-300"}`}
            >
              {attachmentFile ? (
                <p className="text-sm text-gray-700">{attachmentFile.name}</p>
              ) : (
                <p className="text-sm text-gray-500">Drag and drop a file or click to attach</p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-4 border-t border-gray-100">
            {formError && <p className="mr-auto text-sm text-red-600">{formError}</p>}
            <button type="button" onClick={onCancel} className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors">Cancel</button>
            <button type="button" onClick={handleSubmit} className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-md hover:bg-gray-700 transition-colors">
              {mode === "edit" ? "Save" : "Create"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function exportPunchListPDF(items: PunchListItem[], directory: DirectoryContact[]) {
  const rows = items.map((item) => [
    item.item_number,
    item.title,
    item.type ?? "—",
    STATUS_LABELS[item.status] ?? item.status,
    item.priority ?? "—",
    getContactNameById(directory, item.punch_item_manager_id),
    item.location ?? "—",
    item.trade ?? "—",
    formatDate(item.due_date),
  ]);
  const headers = ["#", "Title", "Type", "Status", "Priority", "Manager", "Location", "Trade", "Due Date"];
  const thRow = headers.map((h) => `<th>${h}</th>`).join("");
  const tableRows = rows.map((row) => `<tr>${row.map((cell) => `<td>${String(cell).replace(/</g, "&lt;")}</td>`).join("")}</tr>`).join("");
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Punch List</title>
    <style>body{font-family:Arial,sans-serif;font-size:11px;padding:20px;}h1{font-size:16px;margin-bottom:16px;}table{width:100%;border-collapse:collapse;}th{background:#f3f4f6;text-align:left;padding:8px 10px;font-size:10px;text-transform:uppercase;}td{padding:8px 10px;border-bottom:1px solid #e5e7eb;}@media print{body{padding:0;}}</style></head><body>
    <h1>Punch List</h1><table><thead><tr>${thRow}</tr></thead><tbody>${tableRows}</tbody></table>
    <script>window.onload=()=>{window.print();}<\/script></body></html>`;
  const win = window.open("", "_blank");
  if (win) { win.document.write(html); win.document.close(); }
}

export default function PunchListClient({ projectId, role, username, userId }: { projectId: string; role: string; username: string; userId: string }) {
  const [items, setItems] = useState<PunchListItem[]>([]);
  const [deletedItems, setDeletedItems] = useState<PunchListItem[]>([]);
  const [directory, setDirectory] = useState<DirectoryContact[]>([]);
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([]);
  const [activeTab, setActiveTab] = useState<"punch_lists" | "recycle_bin">("punch_lists");
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingItem, setEditingItem] = useState<PunchListItem | null>(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`/api/projects/${projectId}/punch-list`).then((r) => r.json()),
      fetch(`/api/projects/${projectId}/punch-list?recycle_bin=true`).then((r) => r.json()),
      fetch(`/api/projects/${projectId}/directory`).then((r) => r.json()),
      fetch(`/api/projects/${projectId}/budget`).then((r) => r.json()),
    ]).then(([itemsData, deletedItemsData, dirData, budgetData]) => {
      setItems(Array.isArray(itemsData) ? itemsData : []);
      setDeletedItems(Array.isArray(deletedItemsData) ? deletedItemsData : []);
      setDirectory(Array.isArray(dirData) ? dirData : []);
      if (Array.isArray(budgetData)) {
        const seen = new Set<string>();
        const normalized = budgetData
          .filter((row): row is BudgetItem => typeof row?.cost_code === "string" && row.cost_code.trim().length > 0)
          .map((row) => ({
            id: row.id,
            cost_code: row.cost_code.trim(),
            description: row.description ?? "",
          }))
          .filter((row) => {
            if (seen.has(row.cost_code)) return false;
            seen.add(row.cost_code);
            return true;
          });
        setBudgetItems(normalized);
      } else {
        setBudgetItems([]);
      }
      setLoading(false);
    });
  }, [projectId]);

  const nextNumber = items.length > 0 ? Math.max(...items.map((i) => i.item_number)) + 1 : 1;
  const displayedItems = activeTab === "punch_lists" ? items : deletedItems;

  async function handleCreate(data: Record<string, unknown>) {
    setShowCreate(false);
    setCreating(true);
    const { attachmentFile, ...rest } = data;
    const res = await fetch(`/api/projects/${projectId}/punch-list`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rest),
    });
    if (res.ok) {
      const newItem: PunchListItem = await res.json();
      if (attachmentFile instanceof File) {
        const formData = new FormData();
        formData.append("file", attachmentFile);
        const attRes = await fetch(`/api/projects/${projectId}/punch-list/${newItem.id}/attachment`, { method: "POST", body: formData });
        if (attRes.ok) {
          const updated = await attRes.json();
          newItem.attachments = updated.attachments ?? [];
        }
      }
      setItems((prev) => [...prev, newItem]);
    }
    setCreating(false);
  }

  async function handleUpdate(data: Record<string, unknown>) {
    if (!editingItem) return;
    setUpdating(true);
    const { attachmentFile, ...rest } = data;
    const res = await fetch(`/api/projects/${projectId}/punch-list/${editingItem.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rest),
    });
    if (res.ok) {
      const updated: PunchListItem = await res.json();
      if (attachmentFile instanceof File) {
        const formData = new FormData();
        formData.append("file", attachmentFile);
        const attRes = await fetch(`/api/projects/${projectId}/punch-list/${updated.id}/attachment`, { method: "POST", body: formData });
        if (attRes.ok) {
          const attData = await attRes.json();
          updated.attachments = attData.attachments ?? [];
        }
      }
      setItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setEditingItem(null);
    }
    setUpdating(false);
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-6 h-14 flex items-center justify-between">
        <a href="/dashboard" className="text-sm font-semibold text-gray-900 hover:text-gray-600 transition-colors">SiteCommand</a>
        <div className="flex items-center gap-5">
          <span className="text-sm text-gray-400">{username}</span>
          <button onClick={handleLogout} className="text-sm text-gray-400 hover:text-gray-900 transition-colors">Logout</button>
        </div>
      </header>

      <ProjectNav projectId={projectId} />

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display text-[28px] leading-tight text-[color:var(--ink)]">Punch List</h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => exportPunchListPDF(displayedItems, directory)} className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-md bg-white hover:bg-gray-50 transition-colors">
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              Export as PDF
            </button>
            {activeTab === "punch_lists" && (
              <button onClick={() => setShowCreate(true)} disabled={creating || updating} className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-md hover:bg-gray-700 transition-colors disabled:opacity-50">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                {creating ? "Creating..." : "Create item"}
              </button>
            )}
          </div>
        </div>

        <div className="mb-6 border-b border-gray-200">
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => setActiveTab("punch_lists")}
              className={`relative py-3 text-sm font-medium transition-colors ${
                activeTab === "punch_lists" ? "text-gray-900" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Punch Lists
              {activeTab === "punch_lists" && <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-gray-900 rounded-full" />}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("recycle_bin")}
              className={`relative py-3 text-sm font-medium transition-colors ${
                activeTab === "recycle_bin" ? "text-gray-900" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Recycle Bin
              {deletedItems.length > 0 && (
                <span className="ml-2 inline-flex items-center justify-center rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                  {deletedItems.length}
                </span>
              )}
              {activeTab === "recycle_bin" && <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-gray-900 rounded-full" />}
            </button>
          </div>
        </div>

        {loading ? (
          <SkeletonTable rows={5} cols={7} />
        ) : displayedItems.length === 0 ? (
          <div className="bg-white border border-dashed border-gray-200 rounded-xl">
            <EmptyState
              icon={
                <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.25}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              }
              title={activeTab === "punch_lists" ? "No punch list items yet" : "Recycle Bin is empty"}
              description={activeTab === "punch_lists" ? "Click Create item to add the first one." : "Deleted punch list items will appear here."}
            />
          </div>
        ) : (
          <div className="bg-white border border-gray-100 rounded-xl overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider w-10"></th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">#</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Title</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Priority</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Manager</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Location</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Trade</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Due Date</th>
                </tr>
              </thead>
              <tbody>
                {displayedItems.map((item) => (
                  <tr
                    key={item.id}
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest("button,a")) return;
                      if (activeTab === "recycle_bin") return;
                      window.location.href = `/projects/${projectId}/punch-list/${item.id}`;
                    }}
                    className={`border-b border-gray-50 hover:bg-gray-50 transition-colors last:border-b-0 ${
                      activeTab === "punch_lists" ? "cursor-pointer" : "cursor-default"
                    }`}
                  >
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      {activeTab === "punch_lists" ? (
                        <button
                          type="button"
                          onClick={() => setEditingItem(item)}
                          className="inline-flex p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                          aria-label={`Edit punch list item ${item.item_number}`}
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-gray-700">{item.item_number}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{item.title}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[item.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {STATUS_LABELS[item.status] ?? item.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {item.priority ? (
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_COLORS[item.priority] ?? "bg-gray-50 text-gray-600"}`}>{item.priority}</span>
                      ) : <span className="text-sm text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{getContactNameById(directory, item.punch_item_manager_id)}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{item.location ?? "—"}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{item.trade ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{formatDate(item.due_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {showCreate && (
        <CreatePunchListModal
          nextNumber={nextNumber}
          directory={directory}
          budgetItems={budgetItems}
          onConfirm={handleCreate}
          onCancel={() => setShowCreate(false)}
        />
      )}
      {editingItem && (
        <CreatePunchListModal
          nextNumber={editingItem.item_number}
          directory={directory}
          budgetItems={budgetItems}
          mode="edit"
          initialItem={editingItem}
          onConfirm={handleUpdate}
          onCancel={() => setEditingItem(null)}
        />
      )}
    </div>
  );
}
