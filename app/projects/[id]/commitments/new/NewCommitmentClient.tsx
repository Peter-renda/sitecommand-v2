"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import ProjectNav from "@/components/ProjectNav";

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
  _key: string; // client-side key
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
  amount: string; // used for amount-based method
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

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
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
  | "bold"
  | "italic"
  | "underline"
  | "strikeThrough"
  | "justifyLeft"
  | "justifyCenter"
  | "justifyRight"
  | "insertUnorderedList"
  | "insertOrderedList"
  | "outdent"
  | "indent"
  | "undo"
  | "redo"
  | "createLink";

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

  // Only set innerHTML on mount / external value changes (not on local edits)
  useEffect(() => {
    if (editorRef.current && !isFocused.current) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  function exec(cmd: RteCommand, val?: string) {
    editorRef.current?.focus();
    document.execCommand(cmd, false, val);
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  }

  function handleInput() {
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  }

  const btnCls =
    "p-1 rounded hover:bg-gray-100 text-gray-600 hover:text-gray-900 transition-colors";
  const divider = <div className="w-px h-4 bg-gray-200 mx-0.5" />;

  return (
    <div className="border border-gray-300 rounded overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center flex-wrap gap-0.5 px-2 py-1.5 border-b border-gray-200 bg-gray-50">
        <button type="button" onClick={() => exec("bold")} className={btnCls} title="Bold">
          <svg className="w-3.5 h-3.5 font-bold" fill="currentColor" viewBox="0 0 24 24">
            <path d="M15.6 10.79c.97-.67 1.65-1.77 1.65-2.79 0-2.26-1.75-4-4-4H7v14h7.04c2.09 0 3.71-1.7 3.71-3.79 0-1.52-.86-2.82-2.15-3.42zM10 6.5h3c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-3v-3zm3.5 9H10v-3h3.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5z" />
          </svg>
        </button>
        <button type="button" onClick={() => exec("italic")} className={btnCls} title="Italic">
          <svg className="w-3.5 h-3.5 italic" fill="currentColor" viewBox="0 0 24 24">
            <path d="M10 4v3h2.21l-3.42 8H6v3h8v-3h-2.21l3.42-8H18V4h-8z" />
          </svg>
        </button>
        <button type="button" onClick={() => exec("underline")} className={btnCls} title="Underline">
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 17c3.31 0 6-2.69 6-6V3h-2.5v8c0 1.93-1.57 3.5-3.5 3.5S8.5 12.93 8.5 11V3H6v8c0 3.31 2.69 6 6 6zm-7 2v2h14v-2H5z" />
          </svg>
        </button>
        <button type="button" onClick={() => exec("strikeThrough")} className={btnCls} title="Strikethrough">
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M10 19h4v-3h-4v3zM5 4v3h5v3h4V7h5V4H5zM3 14h18v-2H3v2z" />
          </svg>
        </button>
        {divider}
        <button type="button" onClick={() => exec("justifyLeft")} className={btnCls} title="Align left">
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M15 15H3v2h12v-2zm0-8H3v2h12V7zM3 13h18v-2H3v2zm0 8h18v-2H3v2zM3 3v2h18V3H3z" />
          </svg>
        </button>
        <button type="button" onClick={() => exec("justifyCenter")} className={btnCls} title="Align center">
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M7 15v2h10v-2H7zm-4 6h18v-2H3v2zm0-8h18v-2H3v2zm4-6v2h10V7H7zM3 3v2h18V3H3z" />
          </svg>
        </button>
        <button type="button" onClick={() => exec("justifyRight")} className={btnCls} title="Align right">
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M3 21h18v-2H3v2zm6-4h12v-2H9v2zm-6-4h18v-2H3v2zm6-4h12V7H9v2zM3 3v2h18V3H3z" />
          </svg>
        </button>
        {divider}
        <button type="button" onClick={() => exec("insertUnorderedList")} className={btnCls} title="Bullet list">
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M4 10.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5zm0-6c-.83 0-1.5.67-1.5 1.5S3.17 7.5 4 7.5 5.5 6.83 5.5 6 4.83 4.5 4 4.5zm0 12c-.83 0-1.5.68-1.5 1.5s.68 1.5 1.5 1.5 1.5-.68 1.5-1.5-.67-1.5-1.5-1.5zM7 19h14v-2H7v2zm0-6h14v-2H7v2zm0-8v2h14V5H7z" />
          </svg>
        </button>
        <button type="button" onClick={() => exec("insertOrderedList")} className={btnCls} title="Numbered list">
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M2 17h2v.5H3v1h1v.5H2v1h3v-4H2v1zm1-9h1V4H2v1h1v3zm-1 3h1.8L2 13.1v.9h3v-1H3.2L5 10.9V10H2v1zm5-6v2h14V5H7zm0 14h14v-2H7v2zm0-6h14v-2H7v2z" />
          </svg>
        </button>
        {divider}
        <button type="button" onClick={() => exec("outdent")} className={btnCls} title="Outdent">
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M11 17h10v-2H11v2zm-8-5l4 4V8l-4 4zm0 9h18v-2H3v2zM3 3v2h18V3H3zm8 6h10V7H11v2zm0 4h10v-2H11v2z" />
          </svg>
        </button>
        <button type="button" onClick={() => exec("indent")} className={btnCls} title="Indent">
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M3 21h18v-2H3v2zM3 8v8l4-4-4-4zm8 9h10v-2H11v2zM3 3v2h18V3H3zm8 6h10V7H11v2zm0 4h10v-2H11v2z" />
          </svg>
        </button>
        {divider}
        <span className="text-xs text-gray-400 px-1 border border-gray-200 rounded py-0.5 select-none">
          12pt
        </span>
        {divider}
        <button type="button" onClick={() => exec("undo")} className={btnCls} title="Undo">
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z" />
          </svg>
        </button>
        <button type="button" onClick={() => exec("redo")} className={btnCls} title="Redo">
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M18.4 10.6C16.55 8.99 14.15 8 11.5 8c-4.65 0-8.58 3.03-9.96 7.22L3.9 16c1.05-3.19 4.05-5.5 7.6-5.5 1.95 0 3.73.72 5.12 1.88L13 16h9V7l-3.6 3.6z" />
          </svg>
        </button>
      </div>
      {/* Editable area */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onFocus={() => { isFocused.current = true; }}
        onBlur={() => { isFocused.current = false; }}
        className="px-3 py-2 text-sm text-gray-900 focus:outline-none"
        style={{ minHeight }}
      />
    </div>
  );
}

// ── File Attachment Drop Zone ─────────────────────────────────────────────────

function AttachmentZone({
  files,
  onAdd,
  onRemove,
}: {
  files: File[];
  onAdd: (f: File[]) => void;
  onRemove: (name: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const dropped = Array.from(e.dataTransfer.files);
    if (dropped.length) onAdd(dropped);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    if (selected.length) onAdd(selected);
    e.target.value = "";
  }

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded p-6 text-center transition-colors ${
          dragging ? "border-orange-400 bg-orange-50" : "border-gray-200 bg-gray-50"
        }`}
      >
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="px-4 py-1.5 text-sm border border-gray-300 rounded bg-white hover:bg-gray-50 transition-colors"
        >
          Attach Files
        </button>
        <p className="text-xs text-gray-400 mt-2">or Drag &amp; Drop</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleChange}
        />
      </div>
      {files.length > 0 && (
        <ul className="mt-2 space-y-1">
          {files.map((f) => (
            <li
              key={f.name}
              className="flex items-center justify-between text-xs text-gray-600 bg-gray-50 px-3 py-1.5 rounded"
            >
              <span className="truncate">{f.name}</span>
              <button
                type="button"
                onClick={() => onRemove(f.name)}
                className="ml-2 text-gray-400 hover:text-red-500 transition-colors"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
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
  function calcAmount(line: SovLine): number {
    if (method === "unit_quantity") {
      return numVal(line.qty) * numVal(line.unit_cost);
    }
    return numVal(line.amount);
  }

  const totalAmount = lines
    .filter((l) => !l.is_group_header)
    .reduce((sum, l) => sum + calcAmount(l), 0);

  const cellCls = "px-2 py-1.5 border-b border-gray-100 text-xs";
  const thCls =
    "px-2 py-2 text-left text-xs font-medium text-gray-500 bg-white border-b border-gray-200 whitespace-nowrap";

  return (
    <div>
      {/* Info banner */}
      <div className="flex items-center justify-between mb-4 bg-blue-50 border border-blue-200 rounded px-4 py-2">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-blue-500 shrink-0" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
          </svg>
          <span className="text-xs text-blue-700">
            This contract&apos;s default accounting method is{" "}
            <strong>{method === "unit_quantity" ? "unit/quantity-based" : "amount-based"}</strong>
          </span>
        </div>
        <button
          type="button"
          onClick={() =>
            onMethodChange(method === "unit_quantity" ? "amount" : "unit_quantity")
          }
          className="text-xs px-3 py-1 border border-gray-300 rounded bg-white hover:bg-gray-50 transition-colors"
        >
          Change to {method === "unit_quantity" ? "Amount" : "Unit/Quantity"}
        </button>
      </div>

      {/* Add Group button */}
      <div className="mb-3">
        <button
          type="button"
          onClick={onAddGroup}
          className="text-sm px-3 py-1.5 border border-gray-300 rounded bg-white hover:bg-gray-50 transition-colors"
        >
          Add Group
        </button>
      </div>

      {/* Table */}
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
                    <th className={thCls} style={{ color: "#2563eb" }}>UOM</th>
                    <th className={thCls}>Unit Cost</th>
                  </>
                ) : null}
                <th className={thCls}>Amount</th>
                <th className={thCls}>Billed to Date</th>
                <th className={thCls}>Amount Remaining</th>
                <th className={thCls} style={{ width: 32 }} />
              </tr>
            </thead>
            <tbody>
              {lines.length === 0 ? (
                <tr>
                  <td
                    colSpan={method === "unit_quantity" ? 10 : 7}
                    className="py-16 text-center"
                  >
                    <div className="flex flex-col items-center gap-3">
                      {/* Construction tool icon */}
                      <div className="w-16 h-16 rounded-full border-2 border-orange-200 flex items-center justify-center bg-orange-50">
                        <svg className="w-8 h-8 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
                        </svg>
                      </div>
                      <p className="text-sm font-medium text-gray-700">
                        You Have No Line Items Yet
                      </p>
                      <button
                        type="button"
                        onClick={onAdd}
                        className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded hover:bg-gray-700 transition-colors"
                      >
                        Add Line
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                lines.map((line, idx) => {
                  if (line.is_group_header) {
                    return (
                      <tr key={line._key} className="bg-gray-50">
                        <td className={cellCls} />
                        <td
                          colSpan={method === "unit_quantity" ? 8 : 5}
                          className={cellCls}
                        >
                          <input
                            type="text"
                            value={line.group_name}
                            onChange={(e) =>
                              onUpdate(line._key, "group_name", e.target.value)
                            }
                            placeholder="Group name…"
                            className="w-full bg-transparent font-medium text-gray-700 focus:outline-none"
                          />
                        </td>
                        <td className={cellCls}>
                          <button
                            type="button"
                            onClick={() => onRemove(line._key)}
                            className="text-gray-300 hover:text-red-500 transition-colors"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    );
                  }

                  const lineNum =
                    lines
                      .filter((l) => !l.is_group_header)
                      .indexOf(line) + 1;
                  const computed = calcAmount(line);
                  const billed = numVal(line.qty); // billed_to_date placeholder
                  const remaining = computed - billed;

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
                              const selectedEvent = changeEvents.find(
                                (event) => event.id === line.change_event_id
                              );
                              const selectedLineItem = selectedEvent?.lineItems.find(
                                (item) => item.id === e.target.value
                              );
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
                          onChange={(e) =>
                            onUpdate(line._key, "budget_code", e.target.value)
                          }
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
                        <input
                          type="text"
                          value={line.description}
                          onChange={(e) =>
                            onUpdate(line._key, "description", e.target.value)
                          }
                          className="w-full min-w-[120px] focus:outline-none bg-transparent"
                        />
                      </td>
                      {method === "unit_quantity" ? (
                        <>
                          <td className={cellCls}>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={line.qty}
                              onChange={(e) =>
                                onUpdate(line._key, "qty", e.target.value)
                              }
                              className="w-16 focus:outline-none bg-transparent tabular-nums"
                            />
                          </td>
                          <td className={cellCls}>
                            <input
                              type="text"
                              value={line.uom}
                              onChange={(e) =>
                                onUpdate(line._key, "uom", e.target.value)
                              }
                              className="w-16 focus:outline-none bg-transparent text-blue-600"
                            />
                          </td>
                          <td className={cellCls}>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={line.unit_cost}
                              onChange={(e) =>
                                onUpdate(line._key, "unit_cost", e.target.value)
                              }
                              className="w-20 focus:outline-none bg-transparent tabular-nums"
                            />
                          </td>
                        </>
                      ) : (
                        <td className={cellCls}>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={line.amount}
                            onChange={(e) =>
                              onUpdate(line._key, "amount", e.target.value)
                            }
                            className="w-24 focus:outline-none bg-transparent tabular-nums"
                          />
                        </td>
                      )}
                      <td className={cellCls + " tabular-nums text-gray-900"}>
                        ${fmt(computed)}
                      </td>
                      <td className={cellCls + " tabular-nums text-gray-400"}>
                        $0.00
                      </td>
                      <td className={cellCls + " tabular-nums text-gray-900"}>
                        ${fmt(computed)}
                      </td>
                      <td className={cellCls}>
                        <button
                          type="button"
                          onClick={() => onRemove(line._key)}
                          className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table footer */}
        <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-t border-gray-200">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onAdd}
              className="px-3 py-1.5 text-xs font-medium text-white bg-gray-900 rounded hover:bg-gray-700 transition-colors"
            >
              Add Line
            </button>
            <button
              type="button"
              className="px-3 py-1.5 text-xs font-medium text-gray-700 border border-gray-300 rounded bg-white hover:bg-gray-50 transition-colors"
            >
              Import SOV from CSV
            </button>
          </div>
          <div className="flex items-center gap-6 text-xs font-medium text-gray-700">
            <span>Total:</span>
            <span className="tabular-nums">${fmt(totalAmount)}</span>
            <span className="tabular-nums">$0.00</span>
            <span className="tabular-nums">${fmt(totalAmount)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function NewCommitmentClient({
  projectId,
  commitmentType,
  role,
  username,
}: {
  projectId: string;
  commitmentType: "subcontract" | "purchase_order";
  role: string;
  username: string;
}) {
  // Directory contacts
  const [directory, setDirectory] = useState<DirectoryContact[]>([]);
  const [nextNumber, setNextNumber] = useState<string>("");

  // Form state - General Information
  const [contractCompany, setContractCompany] = useState("");
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState("draft");
  const [executed, setExecuted] = useState(false);
  const [defaultRetainage, setDefaultRetainage] = useState("10");
  const [assignedTo, setAssignedTo] = useState("");
  const [billTo, setBillTo] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [shipTo, setShipTo] = useState("");
  const [shipVia, setShipVia] = useState("");
  const [description, setDescription] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([]);
  const [changeEvents, setChangeEvents] = useState<ChangeEventOption[]>([]);

  // Contract Dates
  const [deliveryDate, setDeliveryDate] = useState("");
  const [signedPoDate, setSignedPoDate] = useState("");

  // Contract Privacy
  const [isPrivate, setIsPrivate] = useState(true);
  const [sovViewAllowed, setSovViewAllowed] = useState(false);
  const [accessUserIds, setAccessUserIds] = useState<string[]>([]);
  const [accessDropdownOpen, setAccessDropdownOpen] = useState(false);
  const accessDropdownRef = useRef<HTMLDivElement>(null);

  // Subcontract Additional Fields
  const [subcontractCoverLetter, setSubcontractCoverLetter] = useState("");
  const [bondAmount, setBondAmount] = useState("");
  const [exhibitAScope, setExhibitAScope] = useState("");
  const [trades, setTrades] = useState("");
  const [exhibitDFiles, setExhibitDFiles] = useState<File[]>([]);
  const [exhibitIFiles, setExhibitIFiles] = useState<File[]>([]);
  const [subcontractorContact, setSubcontractorContact] = useState("");

  // Purchase Order Additional Fields
  const [subcontractType, setSubcontractType] = useState("");
  const [showCoverLetter, setShowCoverLetter] = useState(false);
  const [showExecutedCoverLetter, setShowExecutedCoverLetter] = useState(false);

  // PO-specific dates
  const [contractDate, setContractDate] = useState("");
  const [issuedOnDate, setIssuedOnDate] = useState("");

  // Subcontract-specific dates
  const [startDate, setStartDate] = useState("");
  const [estimatedCompletion, setEstimatedCompletion] = useState("");
  const [actualCompletion, setActualCompletion] = useState("");
  const [signedContractReceived, setSignedContractReceived] = useState("");

  // Subcontract scope of work
  const [inclusions, setInclusions] = useState("");
  const [exclusions, setExclusions] = useState("");

  // DocuSign
  const [signDocuSign, setSignDocuSign] = useState(false);

  // Financial markup
  const [financialMarkupEnabled, setFinancialMarkupEnabled] = useState(false);

  // SSOV (enabled by project default if set)
  const [ssovEnabled, setSsovEnabled] = useState(false);

  // SOV
  const [sovMethod, setSovMethod] = useState<"unit_quantity" | "amount">(
    "unit_quantity"
  );
  const [sovLines, setSovLines] = useState<SovLine[]>([]);

  const [saving, setSaving] = useState(false);

  // Fetch project-level commitment settings to apply defaults
  useEffect(() => {
    fetch(`/api/projects/${projectId}/commitment-settings`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.enable_ssov_by_default) setSsovEnabled(true);
      })
      .catch(() => {});
  }, [projectId]);

  useEffect(() => {
    Promise.all([
      fetch(`/api/projects/${projectId}/directory`).then((r) => r.json()),
      fetch(`/api/projects/${projectId}/commitments`).then((r) => r.json()),
    ]).then(([dir, existing]) => {
      setDirectory(Array.isArray(dir) ? dir : []);
      const nums = Array.isArray(existing)
        ? existing.map((c: { number: number }) => c.number)
        : [];
      setNextNumber(String(nums.length > 0 ? Math.max(...nums) + 1 : 1));
    });
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
    function handleClickOutside(e: MouseEvent) {
      if (accessDropdownRef.current && !accessDropdownRef.current.contains(e.target as Node)) {
        setAccessDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const companies = directory.filter((c) => c.type === "company");
  const users = directory.filter((c) => c.type === "user");

  // SOV helpers
  function addSovLine() {
    setSovLines((prev) => [
      ...prev,
      {
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
      },
    ]);
  }

  function addSovGroup() {
    setSovLines((prev) => [
      ...prev,
      {
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
      },
    ]);
  }

  function updateSovLine(
    key: string,
    field: keyof SovLine,
    value: string | boolean
  ) {
    setSovLines((prev) =>
      prev.map((l) => (l._key === key ? { ...l, [field]: value } : l))
    );
  }

  function removeSovLine(key: string) {
    setSovLines((prev) => prev.filter((l) => l._key !== key));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const sovTotal = sovLines
        .filter((l) => !l.is_group_header)
        .reduce((sum, l) => {
          const amt =
            sovMethod === "unit_quantity"
              ? numVal(l.qty) * numVal(l.unit_cost)
              : numVal(l.amount);
          return sum + amt;
        }, 0);

      const res = await fetch(`/api/projects/${projectId}/commitments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: commitmentType,
          number: nextNumber !== "" ? Number(nextNumber) : undefined,
          original_contract_amount: sovTotal,
          contract_company: contractCompany,
          title,
          status,
          executed,
          default_retainage: numVal(defaultRetainage),
          assigned_to: assignedTo,
          bill_to: billTo,
          payment_terms: paymentTerms,
          ship_to: shipTo,
          ship_via: shipVia,
          description,
          delivery_date: deliveryDate || null,
          signed_po_received_date: signedPoDate || null,
          is_private: isPrivate,
          sov_view_allowed: sovViewAllowed,
          access_user_ids: accessUserIds,
          subcontract_cover_letter: subcontractCoverLetter,
          bond_amount: numVal(bondAmount),
          exhibit_a_scope: exhibitAScope,
          trades,
          subcontractor_contact: subcontractorContact,
          subcontract_type: subcontractType,
          show_cover_letter: showCoverLetter,
          show_executed_cover_letter: showExecutedCoverLetter,
          sov_accounting_method: sovMethod,
          // Subcontract-specific dates
          start_date: startDate || null,
          estimated_completion: estimatedCompletion || null,
          actual_completion: actualCompletion || null,
          signed_contract_received: signedContractReceived || null,
          // Subcontract scope
          inclusions,
          exclusions,
          // PO-specific dates
          contract_date: contractDate || null,
          issued_on_date: issuedOnDate || null,
          // DocuSign / markup / SSOV
          sign_docusign: signDocuSign,
          financial_markup_enabled: financialMarkupEnabled,
          ssov_enabled: sovMethod === "amount" ? ssovEnabled : false,
        }),
      });

      if (!res.ok) {
        setSaving(false);
        return;
      }

      const commitment = await res.json();

      // Save SOV lines
      if (sovLines.length > 0) {
        await Promise.all(
          sovLines.map((line, idx) =>
            fetch(
              `/api/projects/${projectId}/commitments/${commitment.id}/sov`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  is_group_header: line.is_group_header,
                  group_name: line.group_name,
                  change_event_line_item: line.change_event_line_item,
                  budget_code: line.budget_code,
                  description: line.description,
                  qty: numVal(line.qty),
                  uom: line.uom,
                  unit_cost: numVal(line.unit_cost),
                  amount:
                    sovMethod === "unit_quantity"
                      ? numVal(line.qty) * numVal(line.unit_cost)
                      : numVal(line.amount),
                  sort_order: idx,
                }),
              }
            )
          )
        );
      }

      window.location.href = `/projects/${projectId}/commitments`;
    } catch {
      setSaving(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }

  const typeLabel =
    commitmentType === "purchase_order" ? "Purchase Order" : "Subcontract";

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      {/* Header */}
      <header className="bg-[#F9FAFB] border-b border-black/[0.06] px-6 h-14 flex items-center justify-between">
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

      {/* Page header bar */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-8 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <a
            href={`/projects/${projectId}/commitments`}
            className="text-sm text-gray-400 hover:text-gray-700 transition-colors"
          >
            ← Commitments
          </a>
          <span className="text-gray-200">/</span>
          <h1 className="font-display text-[18px] leading-tight text-[color:var(--ink)]">
            Create {typeLabel}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`/projects/${projectId}/commitments`}
            className="px-4 py-1.5 text-sm text-gray-700 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
          >
            Cancel
          </a>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-1.5 text-sm font-medium text-white bg-gray-900 rounded hover:bg-gray-700 transition-colors disabled:opacity-60"
          >
            {saving ? "Saving…" : `Create ${typeLabel}`}
          </button>
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
                value={nextNumber}
                onChange={(e) => setNextNumber(e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Contract Company">
              <select
                value={contractCompany}
                onChange={(e) => setContractCompany(e.target.value)}
                className={selectCls}
              >
                <option value="">Select company</option>
                {companies.map((c) => (
                  <option key={c.id} value={contactName(c)}>
                    {contactName(c)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Title">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter title"
                className={inputCls}
              />
            </Field>
          </div>

          {/* Sign with DocuSign */}
          <div className="mb-4 flex items-center gap-3 p-3 border border-gray-200 rounded bg-gray-50">
            <input
              type="checkbox"
              id="sign-docusign"
              checked={signDocuSign}
              onChange={(e) => setSignDocuSign(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-gray-900"
            />
            <label htmlFor="sign-docusign" className="text-sm text-gray-700 cursor-pointer">
              Sign with DocuSign® — enable signature collection via Procore + DocuSign integration
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <Field label="Status" required>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className={selectCls}
              >
                <option value="draft">Draft</option>
                <option value="approved">Approved</option>
                <option value="void">Void</option>
                <option value="terminated">Terminated</option>
              </select>
            </Field>
            <Field label="Executed">
              <div className="flex items-center h-9 mt-0.5">
                <input
                  type="checkbox"
                  checked={executed}
                  onChange={(e) => setExecuted(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                />
                <span className="ml-2 text-xs text-gray-500">Legally binding agreement signed by authorized parties</span>
              </div>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <Field label="Default Retainage">
              <div className="flex items-center">
                <input
                  type="text"
                  inputMode="decimal"
                  value={defaultRetainage}
                  onChange={(e) => setDefaultRetainage(e.target.value)}
                  className={inputCls + " rounded-r-none"}
                />
                <span className="px-3 py-2 border border-l-0 border-gray-300 rounded-r text-sm text-gray-500 bg-gray-50">
                  %
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-1">Affects first invoice only; subsequent invoices require manual adjustment.</p>
            </Field>
          </div>

          {/* PO-specific fields */}
          {commitmentType === "purchase_order" && (
            <div className="grid grid-cols-2 gap-4 mb-4">
              <Field label="Bill To">
                <input
                  type="text"
                  value={billTo}
                  onChange={(e) => setBillTo(e.target.value)}
                  placeholder="Business contact / payment address"
                  className={inputCls}
                />
              </Field>
              <Field label="Assigned To">
                <select
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                  className={selectCls}
                >
                  <option value="">Select person…</option>
                  {users.map((c) => (
                    <option key={c.id} value={contactName(c)}>
                      {contactName(c)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Payment Terms">
                <input
                  type="text"
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  placeholder="e.g. Net 30"
                  className={inputCls}
                />
              </Field>
              <Field label="Ship To">
                <input
                  type="text"
                  value={shipTo}
                  onChange={(e) => setShipTo(e.target.value)}
                  placeholder="Delivery destination"
                  className={inputCls}
                />
              </Field>
              <Field label="Ship Via">
                <input
                  type="text"
                  value={shipVia}
                  onChange={(e) => setShipVia(e.target.value)}
                  placeholder="Shipping method / carrier"
                  className={inputCls}
                />
              </Field>
            </div>
          )}

          <Field label="Description" className="mb-4">
            <RichTextEditor
              value={description}
              onChange={setDescription}
              minHeight="100px"
            />
          </Field>

          {/* Subcontract Inclusions / Exclusions */}
          {commitmentType === "subcontract" && (
            <>
              <Field label="Inclusions — Scope of Work" className="mb-4">
                <RichTextEditor
                  value={inclusions}
                  onChange={setInclusions}
                  minHeight="80px"
                />
              </Field>
              <Field label="Exclusions — What is NOT included" className="mb-4">
                <RichTextEditor
                  value={exclusions}
                  onChange={setExclusions}
                  minHeight="80px"
                />
              </Field>
            </>
          )}

          <Field label="Attachments">
            <AttachmentZone
              files={attachments}
              onAdd={(f) => setAttachments((prev) => [...prev, ...f])}
              onRemove={(name) =>
                setAttachments((prev) => prev.filter((f) => f.name !== name))
              }
            />
          </Field>
        </Section>

        {/* ── Schedule of Values ── */}
        <Section title="Schedule of Values">
          <div className="mb-4 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded px-4 py-2 text-xs text-amber-800">
            <svg className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
            </svg>
            <span>
              <strong>Accounting method cannot be changed after the contract is created.</strong> It applies to all change orders and invoices for this contract. Choose before adding line items.
            </span>
          </div>
          <SovTable
            lines={sovLines}
            method={sovMethod}
            budgetItems={budgetItems}
            changeEvents={commitmentType === "subcontract" ? changeEvents : []}
            onMethodChange={setSovMethod}
            onAdd={addSovLine}
            onAddGroup={addSovGroup}
            onUpdate={updateSovLine}
            onRemove={removeSovLine}
          />
        </Section>

        {/* ── Subcontractor SOV ── */}
        <Section title="Subcontractor SOV">
          {sovMethod !== "amount" ? (
            <p className="text-xs text-gray-500">
              The Subcontractor SOV tab is only supported with the Amount Based accounting method.
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
                  Line items from the SSOV carry over to invoices. Not compatible with Unit/Quantity Based accounting.
                </span>
              </span>
            </label>
          )}
        </Section>

        {/* ── Contract Dates ── */}
        <Section title="Contract Dates">
          {commitmentType === "purchase_order" ? (
            <div className="grid grid-cols-2 gap-8">
              <Field label="Contract Date">
                <input
                  type="date"
                  value={contractDate}
                  onChange={(e) => setContractDate(e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Delivery Date">
                <input
                  type="date"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Signed Purchase Order Received Date">
                <input
                  type="date"
                  value={signedPoDate}
                  onChange={(e) => setSignedPoDate(e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Issued On">
                <input
                  type="date"
                  value={issuedOnDate}
                  onChange={(e) => setIssuedOnDate(e.target.value)}
                  className={inputCls}
                />
              </Field>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-8">
              <Field label="Start Date">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Estimated Completion">
                <input
                  type="date"
                  value={estimatedCompletion}
                  onChange={(e) => setEstimatedCompletion(e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Actual Completion">
                <input
                  type="date"
                  value={actualCompletion}
                  onChange={(e) => setActualCompletion(e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Signed Contract Received">
                <input
                  type="date"
                  value={signedContractReceived}
                  onChange={(e) => setSignedContractReceived(e.target.value)}
                  className={inputCls}
                />
              </Field>
            </div>
          )}
        </Section>

        {/* ── Contract Privacy ── */}
        <Section title="Contract Privacy">
          <p className="text-xs text-blue-600 mb-4">
            Using the privacy setting allows only project admins and the select
            non-admin users access.
          </p>
          <Field label="Private" className="mb-4">
            <input
              type="checkbox"
              checked={isPrivate}
              onChange={(e) => setIsPrivate(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
          </Field>
          <div className="grid grid-cols-2 gap-4 items-start mb-4">
            <Field label="Access for Non-Admin Users">
              <div className="relative" ref={accessDropdownRef}>
                <button
                  type="button"
                  disabled={!isPrivate}
                  onClick={() => setAccessDropdownOpen((o) => !o)}
                  className={`w-full text-left px-3 py-2 border border-gray-300 rounded text-sm bg-white flex items-center justify-between ${!isPrivate ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:border-gray-400"}`}
                >
                  <span className="text-gray-700 truncate">
                    {accessUserIds.length === 0
                      ? "Select people…"
                      : `${accessUserIds.length} person${accessUserIds.length > 1 ? "s" : ""} selected`}
                  </span>
                  <svg className="w-4 h-4 text-gray-400 shrink-0 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {accessDropdownOpen && isPrivate && (
                  <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded shadow-lg max-h-56 overflow-y-auto">
                    {directory.filter((c) => c.type !== "group").length === 0 ? (
                      <p className="px-3 py-2 text-sm text-gray-400">No contacts in directory</p>
                    ) : (
                      directory.filter((c) => c.type !== "group").map((c) => (
                        <label
                          key={c.id}
                          className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm text-gray-700"
                        >
                          <input
                            type="checkbox"
                            checked={accessUserIds.includes(c.id)}
                            onChange={() =>
                              setAccessUserIds((prev) =>
                                prev.includes(c.id)
                                  ? prev.filter((id) => id !== c.id)
                                  : [...prev, c.id]
                              )
                            }
                            className="w-4 h-4 rounded border-gray-300 text-gray-900"
                          />
                          {contactName(c)}
                        </label>
                      ))
                    )}
                  </div>
                )}
                {accessUserIds.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {accessUserIds.map((uid) => {
                      const contact = directory.find((c) => c.id === uid);
                      if (!contact) return null;
                      return (
                        <span key={uid} className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded">
                          {contactName(contact)}
                          <button
                            type="button"
                            onClick={() => setAccessUserIds((prev) => prev.filter((id) => id !== uid))}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            ×
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            </Field>
            <div className="pt-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sovViewAllowed}
                  onChange={(e) => setSovViewAllowed(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-gray-900"
                />
                <span className="text-sm text-gray-700">
                  Allow these non-admin users to view the SOV items.
                </span>
              </label>
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-700 mb-1">
              Invoice Contacts
            </p>
            <p className="text-xs text-blue-500 flex items-center gap-1">
              <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
              </svg>
              {contractCompany
                ? contractCompany
                : "Please select a Contract Company first"}
            </p>
          </div>
        </Section>

        {/* ── Additional Information ── */}
        <Section title="Additional Information">
          {commitmentType === "subcontract" ? (
            <div>
              <Field label="Cover Letter" className="mb-4">
                <select
                  value={subcontractCoverLetter}
                  onChange={(e) => setSubcontractCoverLetter(e.target.value)}
                  className={selectCls}
                >
                  <option value="">Select cover letter…</option>
                  <option value="standard">Standard Cover Letter</option>
                  <option value="custom">Custom Cover Letter</option>
                  <option value="none">No Cover Letter</option>
                </select>
              </Field>
              <Field label="Bond Amount" className="mb-4">
                <div className="flex items-center">
                  <span className="px-3 py-2 border border-r-0 border-gray-300 rounded-l text-sm text-gray-500 bg-gray-50">$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={bondAmount}
                    onChange={(e) => setBondAmount(e.target.value)}
                    className={inputCls + " rounded-l-none"}
                  />
                </div>
              </Field>
              <Field label="Trades" className="mb-4">
                <input
                  type="text"
                  value={trades}
                  onChange={(e) => setTrades(e.target.value)}
                  placeholder="e.g. Electrical, Plumbing"
                  className={inputCls}
                />
              </Field>
              <Field label="Subcontractor Contact (Invoice Contact)" className="mb-4">
                <select
                  value={subcontractorContact}
                  onChange={(e) => setSubcontractorContact(e.target.value)}
                  className={selectCls}
                >
                  <option value="">Select contact…</option>
                  {directory.map((c) => (
                    <option key={c.id} value={contactName(c)}>
                      {contactName(c)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Exhibit A — Scope of Work" className="mb-4">
                <RichTextEditor
                  value={exhibitAScope}
                  onChange={setExhibitAScope}
                  minHeight="120px"
                />
              </Field>
              <Field label="Exhibit D Attachments" className="mb-4">
                <AttachmentZone
                  files={exhibitDFiles}
                  onAdd={(f) => setExhibitDFiles((prev) => [...prev, ...f])}
                  onRemove={(name) =>
                    setExhibitDFiles((prev) => prev.filter((f) => f.name !== name))
                  }
                />
              </Field>
              <Field label="Exhibit I Attachments">
                <AttachmentZone
                  files={exhibitIFiles}
                  onAdd={(f) => setExhibitIFiles((prev) => [...prev, ...f])}
                  onRemove={(name) =>
                    setExhibitIFiles((prev) => prev.filter((f) => f.name !== name))
                  }
                />
              </Field>
            </div>
          ) : (
            <div>
              <Field label="Contract Type" className="mb-4">
                <select
                  value={subcontractType}
                  onChange={(e) => setSubcontractType(e.target.value)}
                  className={selectCls}
                >
                  <option value="">Select type…</option>
                  <option value="lump_sum">Lump Sum</option>
                  <option value="unit_price">Unit Price</option>
                  <option value="cost_plus">Cost Plus</option>
                  <option value="time_and_material">Time and Material</option>
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-8 mb-4">
                <Field label="Show Cover Letter">
                  <input
                    type="checkbox"
                    checked={showCoverLetter}
                    onChange={(e) => setShowCoverLetter(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-gray-900"
                  />
                </Field>
                <Field label="Show Executed Cover Letter">
                  <input
                    type="checkbox"
                    checked={showExecutedCoverLetter}
                    onChange={(e) => setShowExecutedCoverLetter(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-gray-900"
                  />
                </Field>
              </div>
              <div className="pt-4 border-t border-gray-100">
                <p className="text-xs font-medium text-gray-700 mb-2">Financial Markup</p>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={financialMarkupEnabled}
                    onChange={(e) => setFinancialMarkupEnabled(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-gray-900"
                  />
                  <span className="text-sm text-gray-700">Enable Financial Markup on this commitment</span>
                </label>
                <p className="text-xs text-gray-400 mt-1">Required before adding markup to change orders on this contract.</p>
              </div>
            </div>
          )}
        </Section>

      </div>
    </div>
  );
}
