"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import ProjectNav from "@/components/ProjectNav";
import {
  ChevronRight,
  X,
  Trash2,
  Upload,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  List,
  ListOrdered,
  Indent,
  Outdent,
  Scissors,
  Copy,
  Clipboard,
  RotateCcw,
  RotateCw,
  Zap,
  AlertTriangle,
  GripVertical,
  ChevronDown,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

type LineItem = {
  id: string;
  budgetCode: string;
  description: string;
  vendor: string;
  contract: string;
  unitOfMeasure: string;
  revQty: string;
  revUnitCost: string;
  costQty: string;
  costUnitCost: string;
};

type CommitmentOption = {
  id: string;
  number: number;
  title: string;
  status: string | null;
  contract_company: string | null;
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2);
}

function parseMoney(val: string): number {
  const n = parseFloat(val.replace(/[^0-9.-]/g, ""));
  return isNaN(n) ? 0 : n;
}

function parseQty(val: string): number {
  const n = parseFloat(val);
  return isNaN(n) ? 0 : n;
}

function calcROM(qty: string, unit: string): number {
  return parseQty(qty) * parseMoney(unit);
}

function fmt(val: number) {
  return val.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
}

function emptyLine(): LineItem {
  return {
    id: uid(),
    budgetCode: "",
    description: "",
    vendor: "",
    contract: "",
    unitOfMeasure: "",
    revQty: "",
    revUnitCost: "",
    costQty: "",
    costUnitCost: "",
  };
}

// ── Field components ───────────────────────────────────────────────────────────

function Label({ text, required }: { text: string; required?: boolean }) {
  return (
    <label className="block text-xs text-gray-500 mb-1">
      {text}
      {required && <span className="text-orange-500 ml-0.5">*</span>}
    </label>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function Field({ children }: { children?: any }) {
  return <div className="flex flex-col">{children}</div>;
}

const INPUT =
  "w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white";
const SELECT =
  "w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white appearance-none";

function ClearableSelect({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
}) {
  return (
    <div className="relative flex items-center">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={SELECT + " pr-10"}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-6 text-gray-400 hover:text-gray-600"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
      <ChevronDown className="absolute right-2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
    </div>
  );
}

function RichTextEditor({ editorRef }: { editorRef: { current: HTMLDivElement | null } }) {
  function exec(cmd: string, value?: string) {
    editorRef.current?.focus();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (document as any).execCommand(cmd, false, value ?? undefined);
  }

  const fontSizes = ["8pt", "10pt", "12pt", "14pt", "16pt", "18pt", "24pt", "36pt"];
  const [fontSize, setFontSize] = useState("12pt");

  function applyFontSize(size: string) {
    setFontSize(size);
    exec("fontSize", "7");
    const spans = editorRef.current?.querySelectorAll('font[size="7"]');
    spans?.forEach((span) => {
      (span as HTMLElement).removeAttribute("size");
      (span as HTMLElement).style.fontSize = size;
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ToolBtn = ({ onClick, title, children }: { onClick: () => void; title: string; children?: any }) => (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      className="p-1 rounded hover:bg-gray-100 text-gray-600 hover:text-gray-900 transition-colors"
    >
      {children}
    </button>
  );

  const Sep = () => <span className="w-px h-4 bg-gray-300 mx-0.5" />;

  return (
    <div className="border border-gray-300 rounded overflow-hidden">
      <div className="flex items-center flex-wrap gap-0.5 px-2 py-1.5 border-b border-gray-200 bg-gray-50">
        <ToolBtn onClick={() => exec("bold")} title="Bold"><Bold className="w-3.5 h-3.5" /></ToolBtn>
        <ToolBtn onClick={() => exec("italic")} title="Italic"><Italic className="w-3.5 h-3.5" /></ToolBtn>
        <ToolBtn onClick={() => exec("underline")} title="Underline"><Underline className="w-3.5 h-3.5" /></ToolBtn>
        <ToolBtn onClick={() => exec("strikeThrough")} title="Strikethrough"><Strikethrough className="w-3.5 h-3.5" /></ToolBtn>
        <Sep />
        <ToolBtn onClick={() => exec("justifyLeft")} title="Align Left"><AlignLeft className="w-3.5 h-3.5" /></ToolBtn>
        <ToolBtn onClick={() => exec("justifyCenter")} title="Align Center"><AlignCenter className="w-3.5 h-3.5" /></ToolBtn>
        <ToolBtn onClick={() => exec("justifyRight")} title="Align Right"><AlignRight className="w-3.5 h-3.5" /></ToolBtn>
        <Sep />
        <ToolBtn onClick={() => exec("insertUnorderedList")} title="Bullet List"><List className="w-3.5 h-3.5" /></ToolBtn>
        <ToolBtn onClick={() => exec("insertOrderedList")} title="Numbered List"><ListOrdered className="w-3.5 h-3.5" /></ToolBtn>
        <ToolBtn onClick={() => exec("outdent")} title="Outdent"><Outdent className="w-3.5 h-3.5" /></ToolBtn>
        <ToolBtn onClick={() => exec("indent")} title="Indent"><Indent className="w-3.5 h-3.5" /></ToolBtn>
        <Sep />
        <ToolBtn onClick={() => exec("cut")} title="Cut"><Scissors className="w-3.5 h-3.5" /></ToolBtn>
        <ToolBtn onClick={() => exec("copy")} title="Copy"><Copy className="w-3.5 h-3.5" /></ToolBtn>
        <ToolBtn onClick={() => exec("paste")} title="Paste"><Clipboard className="w-3.5 h-3.5" /></ToolBtn>
        <Sep />
        <div className="relative flex items-center">
          <select
            value={fontSize}
            onChange={(e) => applyFontSize(e.target.value)}
            className="border border-gray-300 rounded px-2 py-0.5 text-xs focus:outline-none bg-white pr-5 appearance-none"
          >
            {fontSizes.map((s) => (<option key={s}>{s}</option>))}
          </select>
          <ChevronDown className="absolute right-1 w-2.5 h-2.5 text-gray-400 pointer-events-none" />
        </div>
        <Sep />
        <ToolBtn onClick={() => exec("undo")} title="Undo"><RotateCcw className="w-3.5 h-3.5" /></ToolBtn>
        <ToolBtn onClick={() => exec("redo")} title="Redo"><RotateCw className="w-3.5 h-3.5" /></ToolBtn>
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        className="min-h-[80px] px-3 py-2 text-sm text-gray-800 focus:outline-none"
      />
    </div>
  );
}

function AttachmentsZone({
  files,
  onAdd,
  onRemove,
}: {
  files: File[];
  onAdd: (f: File[]) => void;
  onRemove: (i: number) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleDrop(e: DragEvent & { dataTransfer: DataTransfer }) {
    e.preventDefault();
    setDragging(false);
    const dropped = Array.from(e.dataTransfer.files) as File[];
    if (dropped.length) onAdd(dropped);
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={`border-2 border-dashed rounded p-6 text-center transition-colors ${
        dragging ? "border-blue-400 bg-blue-50" : "border-gray-300 bg-gray-50"
      }`}
    >
      {files.length > 0 && (
        <ul className="mb-3 text-left space-y-1">
          {files.map((f, i) => (
            <li key={i} className="flex items-center justify-between text-xs text-gray-700">
              <span className="truncate max-w-xs">{f.name}</span>
              <button type="button" onClick={() => onRemove(i)} className="ml-2 text-gray-400 hover:text-red-500 transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="px-4 py-1.5 text-xs border border-gray-300 rounded bg-white text-gray-700 hover:bg-gray-100 transition-colors"
      >
        <Upload className="w-3 h-3 inline mr-1" />
        Attach Files
      </button>
      <p className="mt-1 text-xs text-gray-400">or Drag &amp; Drop</p>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) onAdd(Array.from(e.target.files));
          e.target.value = "";
        }}
      />
    </div>
  );
}

function LineItemsTable({
  items,
  onChange,
  onRemove,
  onAdd,
  vendorOptions,
  contractOptions,
  onAddLinesForAllCommitments,
  onImportCsv,
}: {
  items: LineItem[];
  onChange: (id: string, field: keyof LineItem, value: string) => void;
  onRemove: (id: string) => void;
  onAdd: () => void;
  vendorOptions: string[];
  contractOptions: string[];
  onAddLinesForAllCommitments: () => void;
  onImportCsv: (file: File) => void;
}) {
  const totalRevROM = items.reduce((s, li) => s + calcROM(li.revQty, li.revUnitCost), 0);
  const totalCostROM = items.reduce((s, li) => s + calcROM(li.costQty, li.costUnitCost), 0);

  const cellInput = (id: string, field: keyof LineItem, placeholder: string) => (
    <input
      type="text"
      value={items.find((li) => li.id === id)?.[field] ?? ""}
      onChange={(e) => onChange(id, field, e.target.value)}
      placeholder={placeholder}
      className="w-full px-1.5 py-1 text-xs border-0 focus:outline-none focus:ring-1 focus:ring-blue-300 rounded bg-transparent placeholder-gray-300"
    />
  );

  const UOM_OPTIONS = ["", "Time", "Amount", "Length", "Area", "Volume", "Mass", "Other"];

  return (
    <div>
      <div className="overflow-x-auto border border-gray-200 rounded">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th colSpan={6} className="px-3 py-2 text-left text-xs font-semibold text-gray-600 border-r border-gray-200">Detail</th>
              <th colSpan={4} className="px-3 py-2 text-left text-xs font-semibold text-blue-600 border-r border-gray-200">Revenue</th>
              <th colSpan={4} className="px-3 py-2 text-left text-xs font-semibold text-gray-600 border-r border-gray-200">Cost</th>
              <th className="w-8 px-2 py-2" />
            </tr>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="w-6 px-2 py-2" />
              <th className="px-2 py-2 text-left font-medium text-gray-600 min-w-[160px]">Budget Code</th>
              <th className="px-2 py-2 text-left font-medium text-gray-600 min-w-[130px]">Description</th>
              <th className="px-2 py-2 text-left font-medium text-gray-600 min-w-[120px]">Vendor</th>
              <th className="px-2 py-2 text-left font-medium text-gray-600 min-w-[120px]">Contract</th>
              <th className="px-2 py-2 text-left font-medium text-gray-600 min-w-[90px] border-r border-gray-200">Unit of Measure</th>
              <th className="w-3 px-1 py-2" />
              <th className="px-2 py-2 text-left font-medium text-gray-600 min-w-[100px]">Quantity</th>
              <th className="px-2 py-2 text-left font-medium text-gray-600 min-w-[110px]">Unit Cost</th>
              <th className="px-2 py-2 text-right font-medium text-gray-600 min-w-[90px] border-r border-gray-200">Revenue ROM</th>
              <th className="w-3 px-1 py-2" />
              <th className="px-2 py-2 text-left font-medium text-gray-600 min-w-[80px]">Quantity</th>
              <th className="px-2 py-2 text-left font-medium text-gray-600 min-w-[110px]">Unit Cost</th>
              <th className="px-2 py-2 text-right font-medium text-gray-600 min-w-[80px] border-r border-gray-200">Cost ROM</th>
              <th className="w-8 px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {items.map((li) => {
              const revROM = calcROM(li.revQty, li.revUnitCost);
              const costROM = calcROM(li.costQty, li.costUnitCost);
              return (
                <tr key={li.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="w-6 px-1 py-1 text-center text-gray-300 cursor-grab">
                    <GripVertical className="w-3.5 h-3.5" />
                  </td>
                  <td className="px-1 py-1">
                    <input
                      type="text"
                      value={li.budgetCode}
                      onChange={(e) => onChange(li.id, "budgetCode", e.target.value)}
                      className="w-full px-1.5 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-300 bg-white"
                    />
                  </td>
                  <td className="px-1 py-1">{cellInput(li.id, "description", "--")}</td>
                  <td className="px-1 py-1">
                    <select
                      value={li.vendor}
                      onChange={(e) => onChange(li.id, "vendor", e.target.value)}
                      className="w-full px-1.5 py-1 text-xs border-0 focus:outline-none focus:ring-1 focus:ring-blue-300 rounded bg-transparent"
                    >
                      <option value="">--</option>
                      {vendorOptions.map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </td>
                  <td className="px-1 py-1">
                    <select
                      value={li.contract}
                      onChange={(e) => onChange(li.id, "contract", e.target.value)}
                      className="w-full px-1.5 py-1 text-xs border-0 focus:outline-none focus:ring-1 focus:ring-blue-300 rounded bg-transparent"
                    >
                      <option value="">--</option>
                      {contractOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </td>
                  <td className="px-1 py-1 border-r border-gray-200">
                    <select
                      value={li.unitOfMeasure}
                      onChange={(e) => onChange(li.id, "unitOfMeasure", e.target.value)}
                      className="w-full px-1.5 py-1 text-xs border-0 focus:outline-none focus:ring-1 focus:ring-blue-300 rounded bg-transparent"
                    >
                      {UOM_OPTIONS.map((u) => <option key={u} value={u}>{u || "--"}</option>)}
                    </select>
                  </td>
                  <td className="px-1 py-1 text-center">
                    <Zap className="w-3 h-3 text-gray-300" />
                  </td>
                  <td className="px-1 py-1">
                    <input
                      type="text"
                      value={li.revQty}
                      onChange={(e) => onChange(li.id, "revQty", e.target.value)}
                      placeholder="Enter number"
                      className="w-full px-1.5 py-1 text-xs border-0 focus:outline-none focus:ring-1 focus:ring-blue-300 rounded bg-transparent placeholder-gray-300"
                    />
                  </td>
                  <td className="px-1 py-1">
                    <input
                      type="text"
                      value={li.revUnitCost}
                      onChange={(e) => onChange(li.id, "revUnitCost", e.target.value)}
                      placeholder="Enter currency"
                      className="w-full px-1.5 py-1 text-xs border-0 focus:outline-none focus:ring-1 focus:ring-blue-300 rounded bg-transparent placeholder-gray-300"
                    />
                  </td>
                  <td className="px-2 py-1 text-right font-medium text-gray-700 border-r border-gray-200 whitespace-nowrap">
                    {fmt(revROM)}
                  </td>
                  <td className="px-1 py-1 text-center">
                    <AlertTriangle className="w-3 h-3 text-amber-400" />
                  </td>
                  <td className="px-1 py-1">
                    <input
                      type="text"
                      value={li.costQty}
                      onChange={(e) => onChange(li.id, "costQty", e.target.value)}
                      placeholder="Enter number"
                      className="w-full px-1.5 py-1 text-xs border-0 focus:outline-none focus:ring-1 focus:ring-blue-300 rounded bg-transparent placeholder-gray-300"
                    />
                  </td>
                  <td className="px-1 py-1">
                    <input
                      type="text"
                      value={li.costUnitCost}
                      onChange={(e) => onChange(li.id, "costUnitCost", e.target.value)}
                      placeholder="Enter currency"
                      className="w-full px-1.5 py-1 text-xs border-0 focus:outline-none focus:ring-1 focus:ring-blue-300 rounded bg-transparent placeholder-gray-300"
                    />
                  </td>
                  <td className="px-2 py-1 text-right font-medium text-gray-700 border-r border-gray-200 whitespace-nowrap">
                    {fmt(costROM)}
                  </td>
                  <td className="px-1 py-1 text-center">
                    <button
                      type="button"
                      onClick={() => onRemove(li.id)}
                      className="text-gray-300 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-gray-200 bg-gray-50">
              <td colSpan={6} className="px-3 py-2 border-r border-gray-200" />
              <td colSpan={3} />
              <td className="px-2 py-2 text-right text-xs font-semibold text-gray-700 border-r border-gray-200 whitespace-nowrap">
                {fmt(totalRevROM)}
              </td>
              <td colSpan={3} />
              <td className="px-2 py-2 text-right text-xs font-semibold text-gray-700 border-r border-gray-200 whitespace-nowrap">
                {fmt(totalCostROM)}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="flex items-center gap-2 mt-3">
        <button
          type="button"
          onClick={onAdd}
          className="px-3 py-1.5 text-xs border border-gray-300 rounded text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Add Line
        </button>
        <button
          type="button"
          onClick={onAddLinesForAllCommitments}
          className="px-3 py-1.5 text-xs border border-gray-300 rounded text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Add Lines for All Commitments
        </button>
        <label className="px-3 py-1.5 text-xs border border-gray-300 rounded text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer">
          Import Line Items from CSV
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onImportCsv(file);
              e.currentTarget.value = "";
            }}
          />
        </label>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function EditChangeEventClient({
  projectId,
  eventId,
}: {
  projectId: string;
  eventId: string;
}) {
  const router = useRouter();
  const editorRef = useRef<HTMLDivElement>(null);

  const [loadingEvent, setLoadingEvent] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [eventNumber, setEventNumber] = useState("");

  // General Information
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState("Open");
  const [origin, setOrigin] = useState("");
  const [type, setType] = useState("Allowance");
  const [changeReason, setChangeReason] = useState("");
  const [scope, setScope] = useState("TBD");
  const [expectingRevenue, setExpectingRevenue] = useState<"yes" | "no">("yes");
  const [revenueSource, setRevenueSource] = useState("Match Revenue to Latest Cost");
  const [primeContract, setPrimeContract] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);

  // Line Items
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [primeContractOptions, setPrimeContractOptions] = useState<string[]>([]);
  const [vendorOptions, setVendorOptions] = useState<string[]>([]);
  const [contractOptions, setContractOptions] = useState<string[]>([]);
  const [commitments, setCommitments] = useState<CommitmentOption[]>([]);

  // Load existing event data
  useEffect(() => {
    fetch(`/api/projects/${projectId}/change-events/${eventId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setLoadError(data.error);
          setLoadingEvent(false);
          return;
        }
        setEventNumber(String(data.number).padStart(3, "0"));
        setTitle(data.title ?? "");
        setStatus(data.status ?? "Open");
        setOrigin(data.origin ?? "");
        setType(data.type ?? "Allowance");
        setChangeReason(data.change_reason ?? "");
        setScope(data.scope ?? "TBD");
        setExpectingRevenue(data.expecting_revenue ? "yes" : "no");
        setRevenueSource(data.revenue_source ?? "Match Revenue to Latest Cost");
        setPrimeContract(data.prime_contract ?? "");

        if (editorRef.current && data.description) {
          editorRef.current.innerHTML = data.description;
        }

        const lis = (data.line_items ?? []).map((li: Record<string, unknown>) => ({
          id: uid(),
          budgetCode: String(li.budget_code ?? ""),
          description: String(li.description ?? ""),
          vendor: String(li.vendor ?? ""),
          contract: String(li.contract_number ?? ""),
          unitOfMeasure: String(li.unit_of_measure ?? ""),
          revQty: li.rev_unit_qty != null ? String(li.rev_unit_qty) : "",
          revUnitCost: li.rev_unit_cost != null ? String(li.rev_unit_cost) : "",
          costQty: li.cost_unit_qty != null ? String(li.cost_unit_qty) : "",
          costUnitCost: li.cost_unit_cost != null ? String(li.cost_unit_cost) : "",
        }));
        setLineItems(lis.length > 0 ? lis : [emptyLine()]);
        setLoadingEvent(false);
      })
      .catch(() => {
        setLoadError("Failed to load change event.");
        setLoadingEvent(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, eventId]);

  // Set description HTML after editor mounts (if data already loaded)
  const descriptionSetRef = useRef(false);
  useEffect(() => {
    if (!loadingEvent && !descriptionSetRef.current && editorRef.current) {
      descriptionSetRef.current = true;
    }
  }, [loadingEvent]);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/prime-contracts`)
      .then((r) => r.json())
      .then((data) => {
        const arr = Array.isArray(data) ? data : [];
        const approved = arr
          .filter((c: { status: string; title: string }) => c.status?.toLowerCase() === "approved" && c.title)
          .map((c: { title: string }) => c.title);
        setPrimeContractOptions(approved);
      })
      .catch(() => {});
  }, [projectId]);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/directory`)
      .then((r) => r.json())
      .then((data) => {
        const arr = Array.isArray(data) ? data : [];
        const companies = Array.from(new Set(
          arr.map((c: { company: string }) => c.company).filter((v: string) => !!v)
        )) as string[];
        setVendorOptions(companies.sort());
      })
      .catch(() => {});
  }, [projectId]);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/commitments`)
      .then((r) => r.json())
      .then((data) => {
        const arr = Array.isArray(data) ? data : [];
        const contracts = arr
          .filter((c: { number: number; title: string }) => c.number != null && c.title)
          .map((c: { number: number; title: string }) => `${c.number}: ${c.title}`);
        setContractOptions(contracts);
        setCommitments(arr);
      })
      .catch(() => {});
  }, [projectId]);

  function updateLine(id: string, field: keyof LineItem, value: string) {
    setLineItems((prev) =>
      prev.map((li) => (li.id === id ? { ...li, [field]: value } : li))
    );
  }

  function removeLine(id: string) {
    setLineItems((prev) => prev.filter((li) => li.id !== id));
  }

  function addLine() {
    setLineItems((prev) => [...prev, emptyLine()]);
  }

  async function addLinesForAllCommitments() {
    const approved = commitments.filter((c) => String(c.status ?? "").toLowerCase() === "approved");
    if (approved.length === 0) {
      window.alert("No approved commitments were found.");
      return;
    }
    const sovLists = await Promise.all(
      approved.map(async (commitment) => {
        const res = await fetch(`/api/projects/${projectId}/commitments/${commitment.id}/sov`);
        const data = await res.json();
        return { commitment, lines: Array.isArray(data) ? data : [] };
      })
    );

    const imported: LineItem[] = [];
    sovLists.forEach(({ commitment, lines }) => {
      lines.forEach((line: Record<string, unknown>) => {
        imported.push({
          id: uid(),
          budgetCode: String(line.budget_code ?? ""),
          description: String(line.description ?? ""),
          vendor: String(commitment.contract_company ?? ""),
          contract: `${commitment.number}: ${commitment.title}`,
          unitOfMeasure: String(line.uom ?? ""),
          revQty: "",
          revUnitCost: "",
          costQty: Number(line.qty ?? 0) ? String(line.qty) : "",
          costUnitCost: Number(line.unit_cost ?? 0) ? String(line.unit_cost) : "",
        });
      });
    });
    if (imported.length === 0) {
      window.alert("No commitment schedule of values line items were found.");
      return;
    }
    setLineItems((prev) => [...prev.filter((li) => li.budgetCode || li.description || li.vendor || li.contract || li.unitOfMeasure || li.revQty || li.revUnitCost || li.costQty || li.costUnitCost), ...imported]);
  }

  function importCsv(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const lines = text.split(/\r?\n/).map((v) => v.trim()).filter(Boolean);
      if (lines.length <= 1) return;
      const rows = lines.slice(1);
      const imported = rows.map((row) => {
        const [budgetCode = "", description = "", vendor = "", contract = "", unitOfMeasure = "", revQty = "", revUnitCost = "", costQty = "", costUnitCost = ""] = row.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
        return { id: uid(), budgetCode, description, vendor, contract, unitOfMeasure, revQty, revUnitCost, costQty, costUnitCost };
      });
      setLineItems((prev) => [...prev.filter((li) => li.budgetCode || li.description || li.vendor || li.contract || li.unitOfMeasure || li.revQty || li.revUnitCost || li.costQty || li.costUnitCost), ...imported]);
    };
    reader.readAsText(file);
  }

  const handleSave = useCallback(async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const description = editorRef.current?.innerHTML ?? "";
      const body = {
        title: title.trim(),
        status,
        origin: origin || null,
        type,
        change_reason: changeReason || null,
        scope,
        expecting_revenue: expectingRevenue === "yes",
        revenue_source: revenueSource,
        prime_contract: primeContract || null,
        description,
        line_items: lineItems.map((li) => ({
          budget_code: li.budgetCode || null,
          description: li.description || null,
          vendor: li.vendor || null,
          contract_number: li.contract || null,
          unit_of_measure: li.unitOfMeasure || null,
          rev_unit_qty: parseFloat(li.revQty) || null,
          rev_unit_cost: parseFloat(li.revUnitCost) || null,
          rev_rom: calcROM(li.revQty, li.revUnitCost) || null,
          cost_unit_qty: parseFloat(li.costQty) || null,
          cost_unit_cost: parseFloat(li.costUnitCost) || null,
          cost_rom: calcROM(li.costQty, li.costUnitCost) || null,
        })),
      };
      const res = await fetch(`/api/projects/${projectId}/change-events/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        router.push(`/projects/${projectId}/change-events/${eventId}`);
      }
    } finally {
      setSaving(false);
    }
  }, [title, status, origin, type, changeReason, scope, expectingRevenue, revenueSource, primeContract, lineItems, projectId, eventId, router]);

  const TYPE_OPTIONS = ["Allowance", "Contingency", "Owner Change", "TBD", "Transfer"];
  const ORIGIN_OPTIONS = ["Emails", "Meetings", "RFIs"];
  const SCOPE_OPTIONS = ["In Scope", "Out of Scope", "TBD"];
  const CHANGE_REASON_OPTIONS = ["Allowance", "Backcharge", "CCD", "Client Request", "Design Development", "Existing Condition"];
  const REVENUE_SOURCE_OPTIONS = [
    "Match Revenue to Latest Cost",
    "Enter Manually",
    "Quantity x Unit Cost",
  ];

  if (loadingEvent) {
    return (
      <div className="min-h-screen bg-[#FAFAF7] flex flex-col">
        <ProjectNav projectId={projectId} />
        <div className="flex-1 flex items-center justify-center text-sm text-gray-400">Loading…</div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-[#FAFAF7] flex flex-col">
        <ProjectNav projectId={projectId} />
        <div className="flex-1 flex items-center justify-center text-sm text-red-500">{loadError}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAF7] flex flex-col">
      <ProjectNav projectId={projectId} />

      {/* ── Breadcrumb + Title ────────────────────────────────────────────────── */}
      <div className="px-6 pt-5 pb-2 bg-gray-50">
        <nav className="flex items-center gap-1 text-xs text-gray-500 mb-2">
          <button
            onClick={() => router.push(`/projects/${projectId}/change-events`)}
            className="hover:text-gray-700 transition-colors"
          >
            Change Events
          </button>
          <ChevronRight className="w-3 h-3" />
          <button
            onClick={() => router.push(`/projects/${projectId}/change-events/${eventId}`)}
            className="hover:text-gray-700 transition-colors"
          >
            Change Event #{eventNumber}: {title}
          </button>
          <ChevronRight className="w-3 h-3" />
          <span className="text-gray-700">Edit</span>
        </nav>
        <h1 className="font-display text-[24px] leading-tight text-[color:var(--ink)]">Edit Change Event #{eventNumber}</h1>
      </div>

      {/* ── Scrollable content ────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-6 pb-24 space-y-5">

        {/* ── General Information ─────────────────────────────────────────────── */}
        <section className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-5">General Information</h2>

          {/* Row 1: Number | Title | Status | Origin */}
          <div className="grid grid-cols-4 gap-4 mb-4">
            <Field>
              <Label text="Number" />
              <input
                type="text"
                value={eventNumber}
                disabled
                className={INPUT + " bg-gray-50 text-gray-400 cursor-not-allowed"}
              />
            </Field>
            <Field>
              <Label text="Title" required />
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter Title"
                className={INPUT}
              />
            </Field>
            <Field>
              <Label text="Status" />
              <div className="relative flex items-center">
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className={SELECT + " pr-8"}
                >
                  {["Closed", "Open", "Pending", "Void"].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                <span className="absolute left-2 px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700 pointer-events-none">
                  {status}
                </span>
              </div>
            </Field>
            <Field>
              <Label text="Origin" />
              <div className="relative flex items-center">
                <select
                  value={origin}
                  onChange={(e) => setOrigin(e.target.value)}
                  className={SELECT + " pr-8"}
                >
                  <option value="">Select Origin</option>
                  {ORIGIN_OPTIONS.map((o) => <option key={o}>{o}</option>)}
                </select>
                <ChevronDown className="absolute right-2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              </div>
            </Field>
          </div>

          {/* Row 2: Type | Change Reason | Scope */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            <Field>
              <Label text="Type" />
              <div className="relative flex items-center">
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className={SELECT + " pr-8"}
                >
                  {TYPE_OPTIONS.map((t) => <option key={t}>{t}</option>)}
                </select>
                <ChevronDown className="absolute right-2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              </div>
            </Field>
            <Field>
              <Label text="Change Reason" />
              <ClearableSelect
                value={changeReason}
                onChange={setChangeReason}
                options={CHANGE_REASON_OPTIONS}
                placeholder="Select Reason"
              />
            </Field>
            <Field>
              <Label text="Scope" />
              <div className="relative flex items-center">
                <select
                  value={scope}
                  onChange={(e) => setScope(e.target.value)}
                  className={SELECT + " pr-8"}
                >
                  {SCOPE_OPTIONS.map((s) => <option key={s}>{s}</option>)}
                </select>
                <ChevronDown className="absolute right-2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              </div>
            </Field>
          </div>

          {/* Row 3: Expecting Revenue | Line Item Revenue Source | Prime Contract */}
          <div className="grid grid-cols-3 gap-4 mb-5">
            <Field>
              <Label text="Expecting Revenue" />
              <div className="flex items-center gap-5 mt-1">
                <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="expecting_revenue"
                    checked={expectingRevenue === "yes"}
                    onChange={() => setExpectingRevenue("yes")}
                    className="accent-blue-600 w-4 h-4"
                  />
                  Yes
                </label>
                <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="expecting_revenue"
                    checked={expectingRevenue === "no"}
                    onChange={() => setExpectingRevenue("no")}
                    className="accent-blue-600 w-4 h-4"
                  />
                  No
                </label>
              </div>
            </Field>
            <Field>
              <Label text="Line Item Revenue Source" />
              <div className="relative flex items-center">
                <select
                  value={revenueSource}
                  onChange={(e) => setRevenueSource(e.target.value)}
                  className={SELECT + " pr-8"}
                >
                  {REVENUE_SOURCE_OPTIONS.map((o) => <option key={o}>{o}</option>)}
                </select>
                <ChevronDown className="absolute right-2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              </div>
            </Field>
            <Field>
              <Label text="Prime Contract for Markup Estimates" />
              <ClearableSelect
                value={primeContract}
                onChange={setPrimeContract}
                options={primeContractOptions}
                placeholder="Select Contract"
              />
            </Field>
          </div>

          {/* Description */}
          <div className="mb-5">
            <Label text="Description" />
            <RichTextEditor editorRef={editorRef} />
          </div>

          {/* Attachments */}
          <div>
            <Label text="Attachments" />
            <AttachmentsZone
              files={attachments}
              onAdd={(f) => setAttachments((prev) => [...prev, ...f])}
              onRemove={(i) => setAttachments((prev) => prev.filter((_, idx) => idx !== i))}
            />
          </div>
        </section>

        {/* ── Line Items ──────────────────────────────────────────────────────── */}
        <section className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Line Items</h2>
          <LineItemsTable
            items={lineItems}
            onChange={updateLine}
            onRemove={removeLine}
            onAdd={addLine}
            vendorOptions={vendorOptions}
            contractOptions={contractOptions}
            onAddLinesForAllCommitments={addLinesForAllCommitments}
            onImportCsv={importCsv}
          />
        </section>
      </div>

      {/* ── Fixed bottom action bar ───────────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-200 px-6 py-3 flex items-center justify-between">
        <p className="text-xs text-gray-400">* Required fields</p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push(`/projects/${projectId}/change-events/${eventId}`)}
            className="px-5 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !title.trim()}
            className="px-6 py-2 text-sm bg-gray-900 text-white rounded hover:bg-gray-700 transition-colors disabled:opacity-50 font-medium"
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
