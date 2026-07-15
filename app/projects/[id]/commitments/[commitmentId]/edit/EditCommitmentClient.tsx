"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import ProjectNav from "@/components/ProjectNav";
import ReportFieldsSection, { type ReportFieldValues } from "@/components/ReportFieldsSection";
import { COMMITMENT_REPORT_FIELDS } from "@/lib/report-fields";

// ── Types ─────────────────────────────────────────────────────────────────────

type DirectoryContact = {
  id: string;
  type: string;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  group_name: string | null;
  email: string | null;
};

type BudgetItem = {
  id: string;
  cost_code: string;
  description: string | null;
};

type ChangeEventSovOption = {
  id: string;
  label: string;
  budget_code: string;
  description: string;
  qty: string;
  uom: string;
  unit_cost: string;
  amount: string;
};

type ChangeEventOption = {
  id: string;
  label: string;
  lineItems: ChangeEventSovOption[];
};

type SovLine = {
  _key: string;
  dbId?: string; // set for existing items
  is_group_header: boolean;
  group_name: string;
  change_event_id: string;
  change_event_line_item_id: string;
  change_event_line_item: string;
  budget_code: string;
  description: string;
  qty: string;
  uom: string;
  unit_cost: string;
  amount: string;
  deleted?: boolean;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function contactName(c: DirectoryContact): string {
  if (c.type === "company") return c.company || "";
  if (c.type === "group") return c.group_name || "";
  return [c.first_name, c.last_name].filter(Boolean).join(" ");
}

function numVal(s: string): number {
  const n = parseFloat(s.replace(/[^0-9.-]/g, ""));
  return isNaN(n) ? 0 : n;
}

function fmt(n: number): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function uid(): string {
  return Math.random().toString(36).slice(2);
}

// ── Section / Field wrappers ──────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="py-8 border-b border-gray-200 last:border-b-0">
      <h2 className="text-base font-semibold text-gray-900 mb-6">{title}</h2>
      {children}
    </div>
  );
}

function Field({
  label,
  required,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls =
  "w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-gray-900 bg-white";
const selectCls =
  "w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-gray-900 bg-white";

// ── Rich Text Editor ──────────────────────────────────────────────────────────

type RteCommand =
  | "bold" | "italic" | "underline" | "strikeThrough"
  | "justifyLeft" | "justifyCenter" | "justifyRight"
  | "insertUnorderedList" | "insertOrderedList"
  | "outdent" | "indent" | "undo" | "redo";

function RichTextEditor({
  value,
  onChange,
  minHeight = "80px",
}: {
  value: string;
  onChange: (v: string) => void;
  minHeight?: string;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const isFocused = useRef(false);

  useEffect(() => {
    if (editorRef.current && !isFocused.current) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  function exec(cmd: RteCommand) {
    editorRef.current?.focus();
    document.execCommand(cmd, false);
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  }

  const btnCls = "p-1 rounded hover:bg-gray-100 text-gray-600 hover:text-gray-900 transition-colors";

  return (
    <div className="border border-gray-300 rounded overflow-hidden">
      <div className="flex items-center flex-wrap gap-0.5 px-2 py-1.5 border-b border-gray-200 bg-gray-50">
        <button type="button" onClick={() => exec("bold")} className={btnCls} title="Bold"><b className="text-xs px-0.5">B</b></button>
        <button type="button" onClick={() => exec("italic")} className={btnCls} title="Italic"><i className="text-xs px-0.5">I</i></button>
        <button type="button" onClick={() => exec("underline")} className={btnCls} title="Underline"><u className="text-xs px-0.5">U</u></button>
        <div className="w-px h-4 bg-gray-200 mx-0.5" />
        <button type="button" onClick={() => exec("insertUnorderedList")} className={btnCls} title="Bullet list">
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M4 10.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5zm0-6c-.83 0-1.5.67-1.5 1.5S3.17 7.5 4 7.5 5.5 6.83 5.5 6 4.83 4.5 4 4.5zm0 12c-.83 0-1.5.68-1.5 1.5s.68 1.5 1.5 1.5 1.5-.68 1.5-1.5-.67-1.5-1.5-1.5zM7 19h14v-2H7v2zm0-6h14v-2H7v2zm0-8v2h14V5H7z" /></svg>
        </button>
        <button type="button" onClick={() => exec("insertOrderedList")} className={btnCls} title="Numbered list">
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M2 17h2v.5H3v1h1v.5H2v1h3v-4H2v1zm1-9h1V4H2v1h1v3zm-1 3h1.8L2 13.1v.9h3v-1H3.2L5 10.9V10H2v1zm5-6v2h14V5H7zm0 14h14v-2H7v2zm0-6h14v-2H7v2z" /></svg>
        </button>
        <div className="w-px h-4 bg-gray-200 mx-0.5" />
        <button type="button" onClick={() => exec("undo")} className={btnCls} title="Undo">
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z" /></svg>
        </button>
        <button type="button" onClick={() => exec("redo")} className={btnCls} title="Redo">
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M18.4 10.6C16.55 8.99 14.15 8 11.5 8c-4.65 0-8.58 3.03-9.96 7.22L3.9 16c1.05-3.19 4.05-5.5 7.6-5.5 1.95 0 3.73.72 5.12 1.88L13 16h9V7l-3.6 3.6z" /></svg>
        </button>
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={() => { if (editorRef.current) onChange(editorRef.current.innerHTML); }}
        onFocus={() => { isFocused.current = true; }}
        onBlur={() => { isFocused.current = false; }}
        className="px-3 py-2 text-sm text-gray-900 focus:outline-none"
        style={{ minHeight }}
      />
    </div>
  );
}

// ── SOV Table ─────────────────────────────────────────────────────────────────

function SovTable({
  lines,
  method,
  budgetItems,
  changeEvents,
  onMethodChange,
  onAdd,
  onAddGroup,
  onUpdate,
  onRemove,
}: {
  lines: SovLine[];
  method: "unit_quantity" | "amount";
  budgetItems: BudgetItem[];
  changeEvents: ChangeEventOption[];
  onMethodChange: (m: "unit_quantity" | "amount") => void;
  onAdd: () => void;
  onAddGroup: () => void;
  onUpdate: (key: string, field: keyof SovLine, value: string | boolean) => void;
  onRemove: (key: string) => void;
}) {
  const visible = lines.filter((l) => !l.deleted);

  function calcAmount(line: SovLine): number {
    if (method === "unit_quantity") return numVal(line.qty) * numVal(line.unit_cost);
    return numVal(line.amount);
  }

  const totalAmount = visible.filter((l) => !l.is_group_header).reduce((sum, l) => sum + calcAmount(l), 0);
  const cellCls = "px-2 py-1.5 border-b border-gray-100 text-xs";
  const thCls = "px-2 py-2 text-left text-xs font-medium text-gray-500 bg-white border-b border-gray-200 whitespace-nowrap";

  return (
    <div>
      <div className="flex items-center justify-between mb-4 bg-blue-50 border border-blue-200 rounded px-4 py-2">
        <span className="text-xs text-blue-700">
          Accounting method: <strong>{method === "unit_quantity" ? "unit/quantity-based" : "amount-based"}</strong>
        </span>
        <button
          type="button"
          onClick={() => {
            const hasItems = visible.filter((l) => !l.is_group_header).length > 0;
            if (hasItems) {
              if (!confirm("The accounting method can only be changed BEFORE adding line items. Changing it now will clear all existing SOV lines. Continue?")) return;
            }
            onMethodChange(method === "unit_quantity" ? "amount" : "unit_quantity");
          }}
          className="text-xs px-3 py-1 border border-gray-300 rounded bg-white hover:bg-gray-50 transition-colors"
        >
          Change to {method === "unit_quantity" ? "Amount" : "Unit/Quantity"}
        </button>
      </div>

      <div className="mb-3">
        <button type="button" onClick={onAddGroup} className="text-sm px-3 py-1.5 border border-gray-300 rounded bg-white hover:bg-gray-50 transition-colors">
          Add Group
        </button>
      </div>

      <div className="border border-gray-200 rounded overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr>
                <th className={thCls} style={{ width: 40 }}>#</th>
                <th className={thCls}>Change Event Line Item</th>
                <th className={thCls}>Budget Code</th>
                <th className={thCls}>Description</th>
                {method === "unit_quantity" ? (
                  <>
                    <th className={thCls}>Qty</th>
                    <th className={thCls}>UOM</th>
                    <th className={thCls}>Unit Cost</th>
                  </>
                ) : null}
                <th className={thCls}>Amount</th>
                <th className={thCls} style={{ width: 32 }} />
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={method === "unit_quantity" ? 9 : 6} className="py-12 text-center">
                    <p className="text-sm text-gray-400 mb-3">No line items yet</p>
                    <button type="button" onClick={onAdd} className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded hover:bg-gray-700 transition-colors">
                      Add Line
                    </button>
                  </td>
                </tr>
              ) : (
                visible.map((line) => {
                  if (line.is_group_header) {
                    return (
                      <tr key={line._key} className="bg-gray-50">
                        <td className={cellCls} />
                        <td colSpan={method === "unit_quantity" ? 7 : 4} className={cellCls}>
                          <input
                            type="text"
                            value={line.group_name}
                            onChange={(e) => onUpdate(line._key, "group_name", e.target.value)}
                            placeholder="Group name…"
                            className="w-full bg-transparent font-medium text-gray-700 focus:outline-none"
                          />
                        </td>
                        <td className={cellCls}>
                          <button type="button" onClick={() => onRemove(line._key)} className="text-gray-300 hover:text-red-500 transition-colors">✕</button>
                        </td>
                      </tr>
                    );
                  }

                  const lineNum = visible.filter((l) => !l.is_group_header).indexOf(line) + 1;
                  const computed = calcAmount(line);

                  return (
                    <tr key={line._key} className="hover:bg-gray-50 group">
                      <td className={cellCls + " text-gray-400"}>{lineNum}</td>
                      <td className={cellCls}>
                        <div className="min-w-[240px] space-y-1">
                          <select
                            value={line.change_event_id}
                            onChange={(e) => {
                              onUpdate(line._key, "change_event_id", e.target.value);
                              onUpdate(line._key, "change_event_line_item_id", "");
                              onUpdate(line._key, "change_event_line_item", "");
                            }}
                            className="w-full border border-gray-200 rounded px-1.5 py-1 bg-white focus:outline-none"
                          >
                            <option value="">Select change event…</option>
                            {changeEvents.map((event) => (
                              <option key={event.id} value={event.id}>
                                {event.label}
                              </option>
                            ))}
                          </select>
                          <select
                            value={line.change_event_line_item_id}
                            onChange={(e) => {
                              const selectedEvent = changeEvents.find((event) => event.id === line.change_event_id);
                              const selectedLineItem = selectedEvent?.lineItems.find((item) => item.id === e.target.value);
                              onUpdate(line._key, "change_event_line_item_id", e.target.value);
                              if (!selectedLineItem) return;
                              onUpdate(line._key, "change_event_line_item", selectedLineItem.label);
                              onUpdate(line._key, "budget_code", selectedLineItem.budget_code);
                              onUpdate(line._key, "description", selectedLineItem.description);
                              onUpdate(line._key, "qty", selectedLineItem.qty);
                              onUpdate(line._key, "uom", selectedLineItem.uom);
                              onUpdate(line._key, "unit_cost", selectedLineItem.unit_cost);
                              onUpdate(line._key, "amount", selectedLineItem.amount);
                            }}
                            className="w-full border border-gray-200 rounded px-1.5 py-1 bg-white focus:outline-none"
                            disabled={!line.change_event_id}
                          >
                            <option value="">Select SOV line item…</option>
                            {(changeEvents.find((event) => event.id === line.change_event_id)?.lineItems ?? []).map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </td>
                      <td className={cellCls}>
                        <select
                          value={line.budget_code}
                          onChange={(e) => onUpdate(line._key, "budget_code", e.target.value)}
                          className="w-full min-w-[150px] focus:outline-none bg-transparent"
                        >
                          <option value="">Select code…</option>
                          {budgetItems.map((item) => (
                            <option key={item.id} value={item.cost_code}>
                              {item.cost_code}
                              {item.description ? ` — ${item.description}` : ""}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className={cellCls}>
                        <input type="text" value={line.description} onChange={(e) => onUpdate(line._key, "description", e.target.value)} className="w-full min-w-[120px] focus:outline-none bg-transparent" />
                      </td>
                      {method === "unit_quantity" ? (
                        <>
                          <td className={cellCls}>
                            <input type="text" inputMode="decimal" value={line.qty} onChange={(e) => onUpdate(line._key, "qty", e.target.value)} className="w-16 focus:outline-none bg-transparent tabular-nums" />
                          </td>
                          <td className={cellCls}>
                            <input type="text" value={line.uom} onChange={(e) => onUpdate(line._key, "uom", e.target.value)} className="w-16 focus:outline-none bg-transparent" />
                          </td>
                          <td className={cellCls}>
                            <input type="text" inputMode="decimal" value={line.unit_cost} onChange={(e) => onUpdate(line._key, "unit_cost", e.target.value)} className="w-20 focus:outline-none bg-transparent tabular-nums" />
                          </td>
                        </>
                      ) : (
                        <td className={cellCls}>
                          <input type="text" inputMode="decimal" value={line.amount} onChange={(e) => onUpdate(line._key, "amount", e.target.value)} className="w-24 focus:outline-none bg-transparent tabular-nums" />
                        </td>
                      )}
                      <td className={cellCls + " tabular-nums text-gray-900"}>${fmt(computed)}</td>
                      <td className={cellCls}>
                        <button type="button" onClick={() => onRemove(line._key)} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all">✕</button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-t border-gray-200">
          <button type="button" onClick={onAdd} className="px-3 py-1.5 text-xs font-medium text-white bg-gray-900 rounded hover:bg-gray-700 transition-colors">
            Add Line
          </button>
          <div className="flex items-center gap-4 text-xs font-medium text-gray-700">
            <span>Total:</span>
            <span className="tabular-nums">${fmt(totalAmount)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Email Contract Modal ──────────────────────────────────────────────────────

function EmailContractModal({
  directory,
  commitmentNumber,
  commitmentType,
  onClose,
  onSend,
}: {
  directory: DirectoryContact[];
  commitmentNumber: string;
  commitmentType: "subcontract" | "purchase_order";
  onClose: () => void;
  onSend: (payload: { to: string[]; cc: string[]; subject: string; message: string; isPrivate: boolean }) => Promise<void>;
}) {
  const typeLabel = commitmentType === "purchase_order" ? "Purchase Order" : "Subcontract";
  const [toInputs, setToInputs] = useState<string[]>([""]);
  const [ccInputs, setCcInputs] = useState<string[]>([""]);
  const [subject, setSubject] = useState(`${typeLabel} #${commitmentNumber}`);
  const [message, setMessage] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const emailOptions = directory
    .filter((c) => c.email)
    .map((c) => ({ label: `${contactName(c)} <${c.email}>`, value: c.email! }));

  async function handleSend() {
    const to = toInputs.filter(Boolean);
    if (to.length === 0) { setError("At least one recipient is required."); return; }
    setSending(true);
    setError("");
    try {
      await onSend({ to, cc: ccInputs.filter(Boolean), subject, message, isPrivate });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send");
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Email {typeLabel}</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">To <span className="text-red-500">*</span></label>
            {toInputs.map((val, idx) => (
              <div key={idx} className="flex gap-2 mb-1">
                <select
                  value={val}
                  onChange={(e) => setToInputs((prev) => prev.map((v, i) => i === idx ? e.target.value : v))}
                  className={selectCls}
                >
                  <option value="">Select recipient from directory…</option>
                  {emailOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                {toInputs.length > 1 && (
                  <button type="button" onClick={() => setToInputs((prev) => prev.filter((_, i) => i !== idx))} className="text-gray-400 hover:text-red-500 px-1">✕</button>
                )}
              </div>
            ))}
            <button type="button" onClick={() => setToInputs((prev) => [...prev, ""])} className="text-xs text-blue-600 hover:underline mt-1">+ Add recipient</button>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Cc</label>
            {ccInputs.map((val, idx) => (
              <div key={idx} className="flex gap-2 mb-1">
                <select
                  value={val}
                  onChange={(e) => setCcInputs((prev) => prev.map((v, i) => i === idx ? e.target.value : v))}
                  className={selectCls}
                >
                  <option value="">Select recipient from directory…</option>
                  {emailOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                {ccInputs.length > 1 && (
                  <button type="button" onClick={() => setCcInputs((prev) => prev.filter((_, i) => i !== idx))} className="text-gray-400 hover:text-red-500 px-1">✕</button>
                )}
              </div>
            ))}
            <button type="button" onClick={() => setCcInputs((prev) => [...prev, ""])} className="text-xs text-blue-600 hover:underline mt-1">+ Add Cc</button>
          </div>

          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} className="w-4 h-4 rounded border-gray-300" />
              <span className="text-xs font-medium text-gray-700">Private — restrict viewing to admins and email recipients only</span>
            </label>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Subject</label>
            <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} className={inputCls} />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              placeholder="Add instructions or context for recipients…"
              className={inputCls + " resize-y"}
            />
          </div>

          <p className="text-xs text-gray-500">
            Recipients will receive an email with a link to view the contract online (if they have access) or download it as a PDF.
            Recipients must be in the Project Directory.
          </p>

          {error && <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded px-3 py-2">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} disabled={sending} className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-60">
            Cancel
          </button>
          <button onClick={handleSend} disabled={sending} className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded hover:bg-gray-700 disabled:opacity-60">
            {sending ? "Sending…" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function EditCommitmentClient({
  projectId,
  commitmentId,
  role,
  username,
}: {
  projectId: string;
  commitmentId: string;
  role: string;
  username: string;
}) {
  const searchParams = useSearchParams();
  const eventIdsParam = searchParams.get("eventIds") ?? "";
  const preloadedEventIdsRef = useRef<string>("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [commitmentType, setCommitmentType] = useState<"subcontract" | "purchase_order">("subcontract");

  const [directory, setDirectory] = useState<DirectoryContact[]>([]);
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([]);
  const [changeEvents, setChangeEvents] = useState<ChangeEventOption[]>([]);

  // General Information
  const [contractNumber, setContractNumber] = useState("");
  const [contractCompany, setContractCompany] = useState("");
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState("draft");
  const [executed, setExecuted] = useState(false);
  const [defaultRetainage, setDefaultRetainage] = useState("10");
  const [description, setDescription] = useState("");

  // Contract Dates – Subcontract
  const [startDate, setStartDate] = useState("");
  const [estimatedCompletion, setEstimatedCompletion] = useState("");
  const [actualCompletion, setActualCompletion] = useState("");
  const [signedContractReceived, setSignedContractReceived] = useState("");
  // Contract Dates – Purchase Order
  const [contractDate, setContractDate] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [signedPoDate, setSignedPoDate] = useState("");
  const [issuedOnDate, setIssuedOnDate] = useState("");

  // Scope of Work (Subcontract)
  const [inclusions, setInclusions] = useState("");
  const [exclusions, setExclusions] = useState("");

  // DocuSign
  const [signDocusign, setSignDocusign] = useState(false);

  // Financial Markup (per-commitment enable)
  const [financialMarkupEnabled, setFinancialMarkupEnabled] = useState(false);
  const [projectFinancialMarkupEnabled, setProjectFinancialMarkupEnabled] = useState(false);

  // Email Contract modal
  const [emailModalOpen, setEmailModalOpen] = useState(false);

  // Contract Privacy
  const [isPrivate, setIsPrivate] = useState(true);
  const [sovViewAllowed, setSovViewAllowed] = useState(false);
  const [accessDropdownOpen, setAccessDropdownOpen] = useState(false);
  const accessDropdownRef = useRef<HTMLDivElement>(null);

  // Subcontract Additional Fields
  const [subcontractCoverLetter, setSubcontractCoverLetter] = useState("");
  const [bondAmount, setBondAmount] = useState("");
  const [exhibitAScope, setExhibitAScope] = useState("");
  const [trades, setTrades] = useState("");
  const [subcontractorContact, setSubcontractorContact] = useState("");

  // Purchase Order Additional Fields
  const [subcontractType, setSubcontractType] = useState("");
  const [showCoverLetter, setShowCoverLetter] = useState(false);
  const [showExecutedCoverLetter, setShowExecutedCoverLetter] = useState(false);

  // SOV
  const [sovMethod, setSovMethod] = useState<"unit_quantity" | "amount">("unit_quantity");
  const [reportFields, setReportFields] = useState<ReportFieldValues>({});
  const [sovLines, setSovLines] = useState<SovLine[]>([]);
  // Track original dbIds so we can delete removed existing items
  const removedDbIds = useRef<string[]>([]);

  // Subcontractor SOV
  const [ssovEnabled, setSsovEnabled] = useState(false);

  // Commitment project-level settings
  const [alwaysEditableSov, setAlwaysEditableSov] = useState(false);

  // Import SOV from CSV
  const [sovImportOpen, setSovImportOpen] = useState(false);
  const [sovImportDelimiter, setSovImportDelimiter] = useState<"," | ";">(",");
  const [sovImportFile, setSovImportFile] = useState<File | null>(null);
  const [sovImportMode, setSovImportMode] = useState<"add" | "replace">("add");
  const [sovImportError, setSovImportError] = useState<string>("");
  const [sovImportSuccess, setSovImportSuccess] = useState<string>("");

  useEffect(() => {
    Promise.all([
      fetch(`/api/projects/${projectId}/directory`).then((r) => r.json()),
      fetch(`/api/projects/${projectId}/commitments/${commitmentId}`).then((r) => r.json()),
      fetch(`/api/projects/${projectId}/commitments/${commitmentId}/sov`).then((r) => r.json()),
    ]).then(([dir, c, sov]) => {
      setDirectory(Array.isArray(dir) ? dir : []);

      // Populate form from existing commitment
      setCommitmentType(c.type ?? "subcontract");
      setContractNumber(String(c.number ?? ""));
      setContractCompany(c.contract_company ?? "");
      setTitle(c.title ?? "");
      setStatus(c.status ?? "draft");
      setExecuted(c.executed ?? false);
      setDefaultRetainage(String(c.default_retainage ?? 10));
      setDescription(c.description ?? "");
      setStartDate(c.start_date ?? "");
      setEstimatedCompletion(c.estimated_completion ?? "");
      setActualCompletion(c.actual_completion ?? "");
      setSignedContractReceived(c.signed_contract_received ?? "");
      setContractDate(c.contract_date ?? "");
      setDeliveryDate(c.delivery_date ?? "");
      setSignedPoDate(c.signed_po_received_date ?? "");
      setIssuedOnDate(c.issued_on_date ?? "");
      setInclusions(c.inclusions ?? "");
      setExclusions(c.exclusions ?? "");
      setSignDocusign(c.sign_docusign ?? false);
      setFinancialMarkupEnabled(c.financial_markup_enabled ?? false);
      setIsPrivate(c.is_private ?? true);
      setSovViewAllowed(c.sov_view_allowed ?? false);
      setSubcontractCoverLetter(c.subcontract_cover_letter ?? "");
      setBondAmount(c.bond_amount ? String(c.bond_amount) : "");
      setExhibitAScope(c.exhibit_a_scope ?? "");
      setTrades(c.trades ?? "");
      setSubcontractorContact(c.subcontractor_contact ?? "");
      setSubcontractType(c.subcontract_type ?? "");
      setShowCoverLetter(c.show_cover_letter ?? false);
      setShowExecutedCoverLetter(c.show_executed_cover_letter ?? false);
      setSovMethod(c.sov_accounting_method ?? "unit_quantity");
      setSsovEnabled(c.ssov_enabled ?? false);
      setReportFields(c.report_fields ?? {});

      // Map SOV items
      if (Array.isArray(sov)) {
        setSovLines(
          sov.map((item: {
            id: string;
            is_group_header: boolean;
            group_name: string;
            change_event_line_item: string;
            budget_code: string;
            description: string;
            qty: number;
            uom: string;
            unit_cost: number;
            amount: number;
          }) => ({
            _key: uid(),
            dbId: item.id,
            is_group_header: item.is_group_header,
            group_name: item.group_name,
            change_event_id: "",
            change_event_line_item_id: "",
            change_event_line_item: item.change_event_line_item,
            budget_code: item.budget_code,
            description: item.description,
            qty: String(item.qty ?? ""),
            uom: item.uom,
            unit_cost: String(item.unit_cost ?? ""),
            amount: String(item.amount ?? ""),
          }))
        );
      }

      setLoading(false);
    });
  }, [projectId, commitmentId]);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/commitment-settings`)
      .then((r) => r.json())
      .then((data) => {
        setAlwaysEditableSov(!!data?.enable_always_editable_sov);
        setProjectFinancialMarkupEnabled(!!data?.enable_financial_markup);
      })
      .catch(() => {});
  }, [projectId]);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/budget`)
      .then((r) => r.json())
      .then((data) => {
        setBudgetItems(Array.isArray(data) ? data : []);
      })
      .catch(() => {});
  }, [projectId]);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/change-events`)
      .then((r) => r.json())
      .then((data) => {
        if (!Array.isArray(data)) {
          setChangeEvents([]);
          return;
        }
        const mapped: ChangeEventOption[] = data.map((event: Record<string, unknown>) => {
          const eventId = String(event.id ?? "");
          const eventNumber = event.number != null ? `#${event.number}` : "#";
          const eventTitle = String(event.title ?? "Untitled Change Event");
          const rawLineItems = Array.isArray(event.line_items) ? event.line_items : [];
          const lineItems: ChangeEventSovOption[] = rawLineItems.map((item: Record<string, unknown>) => {
            const qtyNum = Number(item.rev_unit_qty ?? 0);
            const unitCostNum = Number(item.rev_unit_cost ?? 0);
            const amountNum = Number(item.rev_rom ?? qtyNum * unitCostNum);
            return {
              id: String(item.id ?? ""),
              label: `${item.budget_code ?? "No Budget Code"} - ${item.description ?? "No Description"}`,
              budget_code: String(item.budget_code ?? ""),
              description: String(item.description ?? ""),
              qty: item.rev_unit_qty == null ? "" : String(item.rev_unit_qty),
              uom: String(item.unit_of_measure ?? ""),
              unit_cost: item.rev_unit_cost == null ? "" : String(item.rev_unit_cost),
              amount: item.rev_rom == null ? String(amountNum) : String(item.rev_rom),
            };
          });
          return {
            id: eventId,
            label: `${eventNumber} - ${eventTitle}`,
            lineItems,
          };
        });
        setChangeEvents(mapped);
      })
      .catch(() => setChangeEvents([]));
  }, [projectId]);

  useEffect(() => {
    if (!eventIdsParam || loading || changeEvents.length === 0) return;
    if (preloadedEventIdsRef.current === eventIdsParam) return;

    const selectedEventIds = new Set(
      eventIdsParam
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean)
    );
    if (selectedEventIds.size === 0) return;

    const incomingLines = changeEvents
      .filter((event) => selectedEventIds.has(event.id))
      .flatMap((event) =>
        event.lineItems.map((item) => ({
          _key: uid(),
          is_group_header: false,
          group_name: "",
          change_event_id: event.id,
          change_event_line_item_id: item.id,
          change_event_line_item: item.label,
          budget_code: item.budget_code,
          description: item.description,
          qty: item.qty,
          uom: item.uom,
          unit_cost: item.unit_cost,
          amount: item.amount,
        }))
      );

    if (incomingLines.length === 0) {
      preloadedEventIdsRef.current = eventIdsParam;
      return;
    }

    queueMicrotask(() => {
      setSovLines((prev) => {
        const existingLineItemIds = new Set(
          prev
            .filter((line) => !line.is_group_header)
            .map((line) => line.change_event_line_item_id)
            .filter(Boolean)
        );
        const dedupedIncoming = incomingLines.filter((line) => !existingLineItemIds.has(line.change_event_line_item_id));
        return dedupedIncoming.length > 0 ? [...prev, ...dedupedIncoming] : prev;
      });
    });
    preloadedEventIdsRef.current = eventIdsParam;
  }, [eventIdsParam, loading, changeEvents]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (accessDropdownRef.current && !accessDropdownRef.current.contains(e.target as Node)) {
        setAccessDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const companies = directory.filter((c) => c.type === "company");

  function addSovLine() {
    setSovLines((prev) => [...prev, {
      _key: uid(),
      is_group_header: false,
      group_name: "",
      change_event_id: "",
      change_event_line_item_id: "",
      change_event_line_item: "",
      budget_code: "",
      description: "",
      qty: "",
      uom: "",
      unit_cost: "",
      amount: "",
    }]);
  }

  function addSovGroup() {
    setSovLines((prev) => [...prev, {
      _key: uid(),
      is_group_header: true,
      group_name: "",
      change_event_id: "",
      change_event_line_item_id: "",
      change_event_line_item: "",
      budget_code: "",
      description: "",
      qty: "",
      uom: "",
      unit_cost: "",
      amount: "",
    }]);
  }

  function updateSovLine(key: string, field: keyof SovLine, value: string | boolean) {
    setSovLines((prev) => prev.map((l) => (l._key === key ? { ...l, [field]: value } : l)));
  }

  function removeSovLine(key: string) {
    setSovLines((prev) => {
      const line = prev.find((l) => l._key === key);
      if (line?.dbId) removedDbIds.current.push(line.dbId);
      return prev.filter((l) => l._key !== key);
    });
  }

  function downloadSovTemplate(mode: "blank" | "existing") {
    const isUQ = sovMethod === "unit_quantity";
    const header = isUQ
      ? ["Budget Code", "Cost Type", "Description", "Quantity", "UOM", "Unit Price", "Amount"]
      : ["Budget Code", "Cost Type", "Description", "Amount"];
    const rows: string[][] = [header];
    if (mode === "existing") {
      for (const line of sovLines.filter((l) => !l.deleted && !l.is_group_header)) {
        rows.push(
          isUQ
            ? [line.budget_code, "", line.description, line.qty, line.uom, line.unit_cost, String(numVal(line.qty) * numVal(line.unit_cost))]
            : [line.budget_code, "", line.description, line.amount || "0"]
        );
      }
    } else {
      rows.push(
        isUQ
          ? ["01-100", "Other", "Mobilization", "1", "LS", "5000.00", "5000.00"]
          : ["01-100", "Other", "Mobilization", "5000.00"]
      );
    }
    const csv = rows
      .map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(sovImportDelimiter))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `commitment_sov_import_${isUQ ? "unit_qty" : "amount"}_template.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function parseSovImportCSV(text: string, delimiter: string): SovLine[] | string {
    const isUQ = sovMethod === "unit_quantity";
    const rows = text.trim().split(/\r?\n/).map((r) => {
      const cells: string[] = [];
      let cur = "";
      let inQ = false;
      for (let i = 0; i < r.length; i++) {
        const ch = r[i];
        if (ch === '"' && !inQ) { inQ = true; continue; }
        if (ch === '"' && inQ && r[i + 1] === '"') { cur += '"'; i++; continue; }
        if (ch === '"' && inQ) { inQ = false; continue; }
        if (ch === delimiter && !inQ) { cells.push(cur); cur = ""; continue; }
        cur += ch;
      }
      cells.push(cur);
      return cells;
    });

    if (rows.length < 2) return "CSV must contain a header row and at least one data row.";

    const header = rows[0].map((h) => h.toLowerCase().trim());
    const codeIdx = header.findIndex((h) => h.includes("budget code") || h.includes("cost code"));
    const descIdx = header.findIndex((h) => h.includes("description"));
    const amtIdx = header.findIndex((h) => h === "amount" || h.includes("amount"));
    const qtyIdx = header.findIndex((h) => h === "quantity" || h === "qty");
    const uomIdx = header.findIndex((h) => h.includes("uom") || h.includes("unit of measure"));
    const unitPriceIdx = header.findIndex((h) => h.includes("unit price") || h.includes("unit cost"));

    if (codeIdx === -1) return "Required column 'Budget Code' not found.";
    if (isUQ) {
      if (qtyIdx === -1) return "Required column 'Quantity' not found for Unit/Quantity Based accounting.";
      if (uomIdx === -1) return "Required column 'UOM' not found for Unit/Quantity Based accounting.";
      if (unitPriceIdx === -1) return "Required column 'Unit Price' not found for Unit/Quantity Based accounting.";
    } else {
      if (amtIdx === -1) return "Required column 'Amount' not found for Amount Based accounting.";
    }

    const newLines: SovLine[] = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row.every((c) => !c.trim())) continue;

      const code = codeIdx >= 0 ? (row[codeIdx] ?? "").trim() : "";
      if (!code) return `Row ${i + 1}: 'Budget Code' is required.`;
      const desc = descIdx >= 0 ? (row[descIdx] ?? "").trim() : "";

      let qty = "";
      let uom = "";
      let unitCost = "";
      let amount = "";

      if (isUQ) {
        const q = parseFloat((row[qtyIdx] ?? "").replace(/[^0-9.-]/g, ""));
        const u = (row[uomIdx] ?? "").trim();
        const up = parseFloat((row[unitPriceIdx] ?? "").replace(/[^0-9.-]/g, ""));
        if (isNaN(q)) return `Row ${i + 1}: 'Quantity' must be a number.`;
        if (!u) return `Row ${i + 1}: 'UOM' is required.`;
        if (isNaN(up)) return `Row ${i + 1}: 'Unit Price' must be a number.`;
        qty = String(q);
        uom = u;
        unitCost = String(up);
      } else {
        const a = parseFloat((row[amtIdx] ?? "").replace(/[^0-9.-]/g, ""));
        if (isNaN(a)) return `Row ${i + 1}: 'Amount' must be a number (use 15000, not $15,000).`;
        amount = String(a);
      }

      newLines.push({
        _key: uid(),
        is_group_header: false,
        group_name: "",
        change_event_id: "",
        change_event_line_item_id: "",
        change_event_line_item: "",
        budget_code: code,
        description: desc,
        qty,
        uom,
        unit_cost: unitCost,
        amount,
      });
    }
    return newLines;
  }

  async function handleSovImport() {
    setSovImportError("");
    setSovImportSuccess("");
    if (!sovImportFile) { setSovImportError("Please select a CSV file."); return; }
    const text = await sovImportFile.text();
    const result = parseSovImportCSV(text, sovImportDelimiter);
    if (typeof result === "string") { setSovImportError(result); return; }

    if (sovImportMode === "replace") {
      // Mark existing (saved) lines for deletion on save
      for (const line of sovLines) {
        if (line.dbId) removedDbIds.current.push(line.dbId);
      }
      setSovLines(result);
    } else {
      setSovLines((prev) => [...prev.filter((l) => !l.deleted), ...result]);
    }
    setSovImportSuccess(`Imported ${result.length} line${result.length !== 1 ? "s" : ""}.`);
    setSovImportOpen(false);
    setSovImportFile(null);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const activeLines = sovLines.filter((l) => !l.deleted);
      const sovTotal = activeLines
        .filter((l) => !l.is_group_header)
        .reduce((sum, l) => {
          return sum + (sovMethod === "unit_quantity" ? numVal(l.qty) * numVal(l.unit_cost) : numVal(l.amount));
        }, 0);

      // PATCH the commitment
      const res = await fetch(`/api/projects/${projectId}/commitments/${commitmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contract_company: contractCompany,
          title,
          status,
          executed,
          default_retainage: numVal(defaultRetainage),
          description,
          sign_docusign: signDocusign,
          financial_markup_enabled: financialMarkupEnabled,
          // Subcontract dates
          start_date: commitmentType === "subcontract" ? (startDate || null) : undefined,
          estimated_completion: commitmentType === "subcontract" ? (estimatedCompletion || null) : undefined,
          actual_completion: commitmentType === "subcontract" ? (actualCompletion || null) : undefined,
          signed_contract_received: commitmentType === "subcontract" ? (signedContractReceived || null) : undefined,
          // PO dates
          contract_date: commitmentType === "purchase_order" ? (contractDate || null) : undefined,
          delivery_date: commitmentType === "purchase_order" ? (deliveryDate || null) : undefined,
          signed_po_received_date: commitmentType === "purchase_order" ? (signedPoDate || null) : undefined,
          issued_on_date: commitmentType === "purchase_order" ? (issuedOnDate || null) : undefined,
          // Scope
          inclusions: commitmentType === "subcontract" ? inclusions : undefined,
          exclusions: commitmentType === "subcontract" ? exclusions : undefined,
          is_private: isPrivate,
          sov_view_allowed: sovViewAllowed,
          subcontract_cover_letter: subcontractCoverLetter,
          bond_amount: numVal(bondAmount),
          exhibit_a_scope: exhibitAScope,
          trades,
          subcontractor_contact: subcontractorContact,
          subcontract_type: subcontractType,
          show_cover_letter: showCoverLetter,
          show_executed_cover_letter: showExecutedCoverLetter,
          sov_accounting_method: sovMethod,
          ssov_enabled: sovMethod === "amount" ? ssovEnabled : false,
          original_contract_amount: sovTotal,
          report_fields: reportFields,
        }),
      });

      if (!res.ok) { setSaving(false); return; }

      // Delete removed SOV items
      await Promise.all(
        removedDbIds.current.map((id) =>
          fetch(`/api/projects/${projectId}/commitments/${commitmentId}/sov/${id}`, { method: "DELETE" })
        )
      );
      removedDbIds.current = [];

      // Save SOV lines: PATCH existing, POST new
      await Promise.all(
        activeLines.map((line, idx) => {
          const body = JSON.stringify({
            is_group_header: line.is_group_header,
            group_name: line.group_name,
            change_event_line_item: line.change_event_line_item,
            budget_code: line.budget_code,
            description: line.description,
            qty: numVal(line.qty),
            uom: line.uom,
            unit_cost: numVal(line.unit_cost),
            amount: sovMethod === "unit_quantity" ? numVal(line.qty) * numVal(line.unit_cost) : numVal(line.amount),
            sort_order: idx,
          });

          if (line.dbId) {
            return fetch(`/api/projects/${projectId}/commitments/${commitmentId}/sov/${line.dbId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body,
            });
          } else {
            return fetch(`/api/projects/${projectId}/commitments/${commitmentId}/sov`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body,
            });
          }
        })
      );

      window.location.href = `/projects/${projectId}/commitments/${commitmentId}`;
    } catch {
      setSaving(false);
    }
  }

  async function handleEmailContract(payload: {
    to: string[];
    cc: string[];
    subject: string;
    message: string;
    isPrivate: boolean;
  }) {
    const res = await fetch(`/api/projects/${projectId}/commitments/${commitmentId}/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: "Failed to send" }));
      throw new Error(error || "Failed to send");
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }

  const typeLabel = commitmentType === "purchase_order" ? "Purchase Order" : "Subcontract";

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center">
        <p className="text-sm text-gray-400">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      {/* Header */}
      <header className="bg-[#F9FAFB] border-b border-black/[0.06] px-6 h-14 flex items-center justify-between">
        <a href="/dashboard" className="text-[15px] font-semibold text-[color:var(--ink)] hover:text-gray-600 transition-colors">SiteCommand</a>
        <div className="flex items-center gap-5">
          <span className="text-sm text-gray-400">{username}</span>
          <button onClick={handleLogout} className="text-sm text-gray-400 hover:text-gray-900 transition-colors">Logout</button>
        </div>
      </header>

      <ProjectNav projectId={projectId} />

      {/* Page header bar */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-8 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <a href={`/projects/${projectId}/commitments/${commitmentId}`} className="text-sm text-gray-400 hover:text-gray-700 transition-colors">
            ← #{contractNumber}
          </a>
          <span className="text-gray-200">/</span>
          <h1 className="font-display text-[18px] leading-tight text-[color:var(--ink)]">Edit {typeLabel}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setEmailModalOpen(true)}
            className="px-4 py-1.5 text-sm text-gray-700 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
          >
            Email Contract
          </button>
          <a
            href={`/projects/${projectId}/commitments/${commitmentId}`}
            className="px-4 py-1.5 text-sm text-gray-700 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
          >
            Cancel
          </a>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-1.5 text-sm font-medium text-white bg-gray-900 rounded hover:bg-gray-700 transition-colors disabled:opacity-60"
          >
            {saving ? "Saving…" : `Save ${typeLabel}`}
          </button>
          {signDocusign && (
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-1.5 text-sm font-medium text-blue-700 border border-blue-300 bg-blue-50 rounded hover:bg-blue-100 transition-colors disabled:opacity-60"
            >
              {saving ? "Saving…" : "Complete with DocuSign®"}
            </button>
          )}
        </div>
      </div>

      {/* Form body */}
      <div className="max-w-5xl mx-auto px-8">

        {/* ── General Information ── */}
        <Section title="General Information">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <Field label="Contract #">
              <input
                type="text"
                value={contractNumber}
                disabled
                className={inputCls + " bg-gray-50 text-gray-400 cursor-not-allowed"}
              />
            </Field>
            <Field label="Contract Company">
              <select value={contractCompany} onChange={(e) => setContractCompany(e.target.value)} className={selectCls}>
                <option value="">Select company</option>
                {companies.map((c) => (
                  <option key={c.id} value={contactName(c)}>{contactName(c)}</option>
                ))}
              </select>
            </Field>
            <Field label="Title">
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Enter title" className={inputCls} />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <Field label="Status" required>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectCls}>
                <option value="draft">Draft</option>
                <option value="approved">Approved</option>
                <option value="void">Void</option>
                <option value="terminated">Terminated</option>
              </select>
            </Field>
            <Field label="Executed">
              <div className="flex items-center h-9 mt-0.5">
                <input type="checkbox" checked={executed} onChange={(e) => setExecuted(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900" />
              </div>
            </Field>
            <Field label="Default Retainage">
              <div className="flex items-center">
                <input type="text" inputMode="decimal" value={defaultRetainage} onChange={(e) => setDefaultRetainage(e.target.value)} className={inputCls + " rounded-r-none"} />
                <span className="px-3 py-2 border border-l-0 border-gray-300 rounded-r text-sm text-gray-500 bg-gray-50">%</span>
              </div>
            </Field>
          </div>

          <Field label="Description" className="mb-4">
            <RichTextEditor value={description} onChange={setDescription} minHeight="100px" />
          </Field>

          <Field label="DocuSign®" className="mb-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={signDocusign}
                onChange={(e) => setSignDocusign(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">
                Enable DocuSign® signature collection
                <span className="block text-xs text-gray-500 mt-0.5">
                  When enabled, &ldquo;Complete with DocuSign®&rdquo; appears as a save option.
                </span>
              </span>
            </label>
          </Field>

          {projectFinancialMarkupEnabled ? (
            <Field label="Financial Markup" className="mb-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={financialMarkupEnabled}
                  onChange={(e) => setFinancialMarkupEnabled(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-gray-900"
                />
                <span className="text-sm text-gray-700">
                  Enable Financial Markups on this commitment
                  <span className="block text-xs text-gray-500 mt-0.5">
                    Required before adding markup rules to change orders on this contract.
                    Once markup is applied to a change order, it cannot be added to a subcontractor invoice.
                  </span>
                </span>
              </label>
            </Field>
          ) : (
            <p className="text-xs text-gray-400 mb-4">
              Financial Markup is disabled at the project level. Enable it in{" "}
              <a href={`/projects/${projectId}/commitments/settings`} className="underline hover:text-gray-600">
                Commitments Settings
              </a>{" "}
              to use it on this commitment.
            </p>
          )}
        </Section>

        {/* ── Schedule of Values ── */}
        <Section title="Schedule of Values">
          {status !== "draft" && !alwaysEditableSov && (
            <div className="mb-4 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
              Schedule of Values can only be edited when the commitment is in Draft, unless
              &ldquo;Enable Always Editable Schedule of Values&rdquo; is turned on in Commitments settings.
              Any SOV changes below will be rejected on save.
            </div>
          )}
          <SovTable
            lines={sovLines}
            method={sovMethod}
            budgetItems={budgetItems}
            changeEvents={changeEvents}
            onMethodChange={setSovMethod}
            onAdd={addSovLine}
            onAddGroup={addSovGroup}
            onUpdate={updateSovLine}
            onRemove={removeSovLine}
          />

          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setSovImportError("");
                setSovImportSuccess("");
                setSovImportOpen(true);
              }}
              disabled={status !== "draft" && !alwaysEditableSov}
              className="text-xs px-3 py-1.5 border border-gray-300 rounded bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              title={
                status !== "draft" && !alwaysEditableSov
                  ? "Import is only available while the commitment is in Draft, unless Enable Always Editable Schedule of Values is on."
                  : undefined
              }
            >
              Import SOV from CSV
            </button>
            {sovImportSuccess && (
              <span className="text-xs text-green-600">{sovImportSuccess}</span>
            )}
          </div>
        </Section>

        {/* ── Subcontractor SOV ── */}
        <Section title="Subcontractor SOV">
          {sovMethod !== "amount" ? (
            <p className="text-xs text-gray-500">
              The Subcontractor SOV tab is only supported by the Amount Based accounting method.
              Switch the SOV above to Amount to enable it.
            </p>
          ) : (
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={ssovEnabled}
                onChange={(e) => setSsovEnabled(e.target.checked)}
                className="w-4 h-4 mt-0.5 rounded border-gray-300 text-gray-900"
              />
              <span className="text-sm text-gray-700">
                Enable Subcontractor SOV
                <span className="block text-xs text-gray-500 mt-0.5">
                  Lets the invoice contact provide a detailed cost breakdown for each SOV line item.
                  Editable while the SSOV is in Draft or Revise &amp; Resubmit.
                </span>
              </span>
            </label>
          )}
        </Section>

        {/* ── Contract Dates ── */}
        <Section title="Contract Dates">
          {commitmentType === "subcontract" ? (
            <div className="grid grid-cols-2 gap-8">
              <Field label="Start Date">
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
              </Field>
              <Field label="Estimated Completion">
                <input type="date" value={estimatedCompletion} onChange={(e) => setEstimatedCompletion(e.target.value)} className={inputCls} />
              </Field>
              <Field label="Actual Completion">
                <input type="date" value={actualCompletion} onChange={(e) => setActualCompletion(e.target.value)} className={inputCls} />
              </Field>
              <Field label="Signed Contract Received">
                <input type="date" value={signedContractReceived} onChange={(e) => setSignedContractReceived(e.target.value)} className={inputCls} />
              </Field>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-8">
              <Field label="Contract Date">
                <input type="date" value={contractDate} onChange={(e) => setContractDate(e.target.value)} className={inputCls} />
              </Field>
              <Field label="Delivery Date">
                <input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} className={inputCls} />
              </Field>
              <Field label="Signed Purchase Order Received Date">
                <input type="date" value={signedPoDate} onChange={(e) => setSignedPoDate(e.target.value)} className={inputCls} />
              </Field>
              <Field label="Issued On">
                <input type="date" value={issuedOnDate} onChange={(e) => setIssuedOnDate(e.target.value)} className={inputCls} />
              </Field>
            </div>
          )}
        </Section>

        {/* ── Contract Privacy ── */}
        <Section title="Contract Privacy">
          <p className="text-xs text-blue-600 mb-4">
            Using the privacy setting allows only project admins and select non-admin users access.
          </p>
          <Field label="Private" className="mb-4">
            <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
          </Field>
          <div className="grid grid-cols-2 gap-4 items-start mb-4">
            <div ref={accessDropdownRef} />
            <div className="pt-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={sovViewAllowed} onChange={(e) => setSovViewAllowed(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-gray-900" />
                <span className="text-sm text-gray-700">Allow non-admin users to view SOV items.</span>
              </label>
            </div>
          </div>
        </Section>

        {/* ── Additional Information ── */}
        <Section title="Additional Information">
          {commitmentType === "subcontract" && (
            <div className="mb-8">
              <h3 className="text-sm font-semibold text-gray-800 mb-4">Subcontract Additional Fields</h3>
              <Field label="Subcontract Cover Letter" className="mb-4">
                <select value={subcontractCoverLetter} onChange={(e) => setSubcontractCoverLetter(e.target.value)} className={selectCls}>
                  <option value="" />
                  <option value="standard">Standard Cover Letter</option>
                  <option value="custom">Custom Cover Letter</option>
                  <option value="none">No Cover Letter</option>
                </select>
              </Field>
              <Field label="Bond Amount" className="mb-4">
                <input type="text" inputMode="decimal" value={bondAmount} onChange={(e) => setBondAmount(e.target.value)} className={inputCls} />
              </Field>
              <Field label="Exhibit A Scope of Work" className="mb-4">
                <RichTextEditor value={exhibitAScope} onChange={setExhibitAScope} minHeight="120px" />
              </Field>
              <Field label="Trades" className="mb-4">
                <input type="text" value={trades} onChange={(e) => setTrades(e.target.value)} className={inputCls} />
              </Field>
              <Field label="Invoice Contact">
                <select value={subcontractorContact} onChange={(e) => setSubcontractorContact(e.target.value)} className={selectCls}>
                  <option value="" />
                  {directory.map((c) => (
                    <option key={c.id} value={contactName(c)}>{contactName(c)}</option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-gray-500">
                  The invoice contact receives SSOV notifications and can edit the Subcontractor SOV.
                </p>
              </Field>
            </div>
          )}

          {commitmentType === "subcontract" && (
            <div className="mb-8">
              <h3 className="text-sm font-semibold text-gray-800 mb-4">Scope of Work</h3>
              <Field label="Inclusions" className="mb-4">
                <RichTextEditor value={inclusions} onChange={setInclusions} minHeight="120px" />
              </Field>
              <Field label="Exclusions" className="mb-4">
                <RichTextEditor value={exclusions} onChange={setExclusions} minHeight="120px" />
              </Field>
            </div>
          )}

          <div>
            <h3 className="text-sm font-semibold text-gray-800 mb-4">Purchase Order Additional Fields</h3>
            <Field label="Subcontract Type" className="mb-4">
              <select value={subcontractType} onChange={(e) => setSubcontractType(e.target.value)} className={selectCls}>
                <option value="" />
                <option value="lump_sum">Lump Sum</option>
                <option value="unit_price">Unit Price</option>
                <option value="cost_plus">Cost Plus</option>
                <option value="time_and_material">Time and Material</option>
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-8">
              <Field label="Show Cover Letter">
                <input type="checkbox" checked={showCoverLetter} onChange={(e) => setShowCoverLetter(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-gray-900" />
              </Field>
              <Field label="Show Executed Cover Letter">
                <input type="checkbox" checked={showExecutedCoverLetter} onChange={(e) => setShowExecutedCoverLetter(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-gray-900" />
              </Field>
            </div>
          </div>
        </Section>

        <Section title="Report Fields">
          <ReportFieldsSection
            title="Report Fields"
            description="Extra commitment attributes surfaced as columns in 360 Reports. Saved with this commitment."
            fields={COMMITMENT_REPORT_FIELDS}
            values={reportFields}
            onChange={(key, value) => setReportFields((prev) => ({ ...prev, [key]: value }))}
            columns={3}
          />
        </Section>

      </div>

      {/* Email Contract modal */}
      {emailModalOpen && (
        <EmailContractModal
          directory={directory}
          commitmentNumber={contractNumber}
          commitmentType={commitmentType}
          onClose={() => setEmailModalOpen(false)}
          onSend={handleEmailContract}
        />
      )}

      {/* Import SOV from CSV modal */}
      {sovImportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setSovImportOpen(false)}>
          <div
            className="bg-white rounded-lg shadow-lg w-full max-w-lg mx-4 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-gray-900">Import SOV from CSV</h3>
              <button onClick={() => setSovImportOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>

            <p className="text-xs text-gray-500 mb-3">
              Accounting method: <strong>{sovMethod === "unit_quantity" ? "Unit/Quantity Based" : "Amount Based"}</strong>.
              {" "}Required columns:{" "}
              {sovMethod === "unit_quantity"
                ? "Budget Code, Quantity, UOM, Unit Price (Cost Type, Description optional; Amount is calculated)."
                : "Budget Code, Amount (Cost Type, Description optional). Use 15000, not $15,000."}
            </p>

            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-700 mb-1">Delimiter</label>
              <div className="flex gap-3 text-xs">
                <label className="inline-flex items-center gap-1">
                  <input
                    type="radio"
                    name="sov-delim"
                    checked={sovImportDelimiter === ","}
                    onChange={() => setSovImportDelimiter(",")}
                  />
                  Comma (,)
                </label>
                <label className="inline-flex items-center gap-1">
                  <input
                    type="radio"
                    name="sov-delim"
                    checked={sovImportDelimiter === ";"}
                    onChange={() => setSovImportDelimiter(";")}
                  />
                  Semicolon (;)
                </label>
              </div>
            </div>

            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-700 mb-1">Import mode</label>
              <div className="flex gap-3 text-xs">
                <label className="inline-flex items-center gap-1">
                  <input
                    type="radio"
                    name="sov-mode"
                    checked={sovImportMode === "add"}
                    onChange={() => setSovImportMode("add")}
                  />
                  Add additional items
                </label>
                <label className="inline-flex items-center gap-1">
                  <input
                    type="radio"
                    name="sov-mode"
                    checked={sovImportMode === "replace"}
                    onChange={() => setSovImportMode("replace")}
                  />
                  Replace all existing items
                </label>
              </div>
            </div>

            <div className="mb-3 flex gap-2">
              <button
                type="button"
                onClick={() => downloadSovTemplate("blank")}
                className="text-xs px-2.5 py-1 border border-gray-300 rounded hover:bg-gray-50"
              >
                Download blank template
              </button>
              <button
                type="button"
                onClick={() => downloadSovTemplate("existing")}
                className="text-xs px-2.5 py-1 border border-gray-300 rounded hover:bg-gray-50"
                disabled={sovLines.filter((l) => !l.deleted && !l.is_group_header).length === 0}
              >
                Download with existing items
              </button>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-700 mb-1">CSV file</label>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => setSovImportFile(e.target.files?.[0] ?? null)}
                className="text-xs"
              />
            </div>

            {sovImportError && (
              <div className="mb-3 text-xs text-red-600 bg-red-50 border border-red-100 rounded px-3 py-2">
                {sovImportError}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSovImportOpen(false)}
                className="px-3 py-1.5 text-xs text-gray-700 border border-gray-300 rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSovImport}
                className="px-3 py-1.5 text-xs font-medium text-white bg-gray-900 rounded hover:bg-gray-700"
              >
                Import
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
