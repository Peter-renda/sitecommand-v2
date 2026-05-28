"use client";

// Shared report-filter primitives used by the 360 report builder and the
// single-tool report builder. Mirrors Procore's "Add Filters…" control:
// pick a category → pick a sub-category (field) → choose a match mode →
// choose the value(s) to filter on.

import { useEffect, useMemo, useRef, useState } from "react";

export type FilterMode =
  | "matches"
  | "not_matches"
  | "contains"
  | "not_contains"
  | "starts_with"
  | "ends_with";

export const FILTER_MODES: { value: FilterMode; label: string }[] = [
  { value: "matches", label: "Matches" },
  { value: "not_matches", label: "Does not match" },
  { value: "contains", label: "Contains text" },
  { value: "not_contains", label: "Does not contain text" },
  { value: "starts_with", label: "Starts with" },
  { value: "ends_with", label: "Ends with" },
];

export const FILTER_MODE_LABELS: Record<FilterMode, string> = FILTER_MODES.reduce(
  (acc, m) => {
    acc[m.value] = m.label;
    return acc;
  },
  {} as Record<FilterMode, string>,
);

export type ReportFilter = {
  id: string;
  source: string; // entity slug / dataset id — scopes which rows the filter applies to
  categoryLabel: string;
  columnKey: string; // field key within the source
  fieldLabel: string;
  mode: FilterMode;
  values: string[];
};

export type FilterCategory = {
  label: string;
  source: string;
  fields: { key: string; label: string }[];
};

// ─── Matching logic ──────────────────────────────────────────────────────────

export function matchesFilterMode(raw: string, mode: FilterMode, values: string[]): boolean {
  const lower = raw.toLowerCase();
  switch (mode) {
    case "matches":
      return values.some((fv) => raw === fv);
    case "not_matches":
      return values.every((fv) => raw !== fv);
    case "contains":
      return values.some((fv) => lower.includes(fv.toLowerCase()));
    case "not_contains":
      return values.every((fv) => !lower.includes(fv.toLowerCase()));
    case "starts_with":
      return values.some((fv) => lower.startsWith(fv.toLowerCase()));
    case "ends_with":
      return values.some((fv) => lower.endsWith(fv.toLowerCase()));
    default:
      return true;
  }
}

// Apply only the filters scoped to a given source against that source's rows.
export function applyFiltersForSource(
  rows: Record<string, unknown>[],
  filters: ReportFilter[],
  source: string,
): Record<string, unknown>[] {
  const active = filters.filter((f) => f.source === source && f.columnKey && f.values.length > 0);
  if (active.length === 0) return rows;
  return rows.filter((row) =>
    active.every((f) => {
      const cell = row[f.columnKey];
      const raw = cell === null || cell === undefined ? "" : String(cell);
      return matchesFilterMode(raw, f.mode, f.values);
    }),
  );
}

// Generic predicate: does a row (looked up via a value getter) pass every
// active filter? Used where rows aren't a plain object map (e.g. mock data).
export function rowPassesFilters(
  filters: ReportFilter[],
  getValue: (columnKey: string) => string,
): boolean {
  const active = filters.filter((f) => f.columnKey && f.values.length > 0);
  return active.every((f) => matchesFilterMode(getValue(f.columnKey), f.mode, f.values));
}

export function distinctColumnValues(values: string[]): string[] {
  return Array.from(new Set(values)).sort((a, b) => {
    if (a === "" && b !== "") return -1;
    if (b === "" && a !== "") return 1;
    return a.localeCompare(b, undefined, { numeric: true });
  });
}

// ─── "Add Filters…" two-step dropdown ─────────────────────────────────────────

function AddFilterMenu({
  categories,
  onSelect,
}: {
  categories: FilterCategory[];
  onSelect: (category: FilterCategory, field: { key: string; label: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<FilterCategory | null>(null);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setActiveCategory(null);
        setSearch("");
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const filteredCategories = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter((c) => c.label.toLowerCase().includes(q));
  }, [search, categories]);

  const filteredFields = useMemo(() => {
    if (!activeCategory) return [];
    const q = search.trim().toLowerCase();
    if (!q) return activeCategory.fields;
    return activeCategory.fields.filter((f) => f.label.toLowerCase().includes(q));
  }, [search, activeCategory]);

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          setActiveCategory(null);
          setSearch("");
        }}
        className="w-full flex items-center justify-between px-3 py-2 border border-gray-200 rounded-md text-sm text-gray-500 bg-white hover:border-gray-300"
      >
        Add Filters...
        <span className="text-gray-400">▾</span>
      </button>
      {open && (
        <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-30 max-h-80 overflow-hidden flex flex-col">
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={activeCategory ? "Search Fields" : "Search Filters"}
                className="w-full pl-2 pr-7 py-1.5 border-2 border-blue-500 rounded text-sm focus:outline-none"
                autoFocus
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
            </div>
          </div>
          <div className="overflow-y-auto">
            {!activeCategory ? (
              filteredCategories.length === 0 ? (
                <p className="px-3 py-3 text-xs text-gray-400">No matches.</p>
              ) : (
                filteredCategories.map((cat) => (
                  <button
                    key={cat.source}
                    type="button"
                    onClick={() => {
                      setActiveCategory(cat);
                      setSearch("");
                    }}
                    className="w-full flex items-center justify-between px-3 py-2.5 text-sm text-gray-800 hover:bg-gray-50"
                  >
                    <span>{cat.label}</span>
                    <span className="text-gray-400">›</span>
                  </button>
                ))
              )
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setActiveCategory(null);
                    setSearch("");
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-500 hover:bg-gray-50 border-b border-gray-100"
                >
                  ‹ Back to filters
                </button>
                <p className="px-3 pt-2 pb-1 text-[11px] uppercase tracking-wide text-gray-400">
                  {activeCategory.label}
                </p>
                {filteredFields.length === 0 ? (
                  <p className="px-3 py-3 text-xs text-gray-400">No matching fields.</p>
                ) : (
                  filteredFields.map((field) => (
                    <button
                      key={field.key}
                      type="button"
                      onClick={() => {
                        onSelect(activeCategory, field);
                        setOpen(false);
                        setActiveCategory(null);
                        setSearch("");
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-gray-800 hover:bg-gray-50"
                    >
                      {field.label}
                    </button>
                  ))
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Value picker (tag input with suggestions) ────────────────────────────────

function FilterValuePicker({
  mode,
  values,
  suggestions,
  onChange,
}: {
  mode: FilterMode;
  values: string[];
  suggestions: string[];
  onChange: (values: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isFreeText =
    mode === "contains" || mode === "not_contains" || mode === "starts_with" || mode === "ends_with";

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const filteredSuggestions = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = suggestions.filter((s) => !values.includes(s));
    if (!q) return base;
    return base.filter((s) => (s === "" ? "(none)" : s.toLowerCase()).includes(q));
  }, [search, suggestions, values]);

  function toggleValue(v: string) {
    if (values.includes(v)) onChange(values.filter((x) => x !== v));
    else onChange([...values, v]);
  }

  function commitFreeText(text: string) {
    const t = text.trim();
    if (!t) return;
    if (values.includes(t)) return;
    onChange([...values, t]);
    setSearch("");
  }

  return (
    <div ref={containerRef} className="relative">
      <div
        onClick={() => setOpen(true)}
        className="w-full min-h-[36px] flex flex-wrap items-center gap-1 px-2 py-1.5 border border-gray-200 rounded-md text-sm bg-white cursor-text"
      >
        {values.map((v) => (
          <span
            key={v}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-600 text-white text-xs"
          >
            {v === "" ? "(None)" : v}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange(values.filter((x) => x !== v));
              }}
              className="hover:text-blue-100"
              aria-label="Remove value"
            >
              ×
            </button>
          </span>
        ))}
        {(open || values.length === 0) && (
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (isFreeText && e.key === "Enter") {
                e.preventDefault();
                commitFreeText(search);
              }
              if (e.key === "Backspace" && !search && values.length > 0) {
                onChange(values.slice(0, -1));
              }
            }}
            onFocus={() => setOpen(true)}
            placeholder={values.length === 0 ? (isFreeText ? "Type a value..." : "Select values...") : ""}
            className="flex-1 min-w-[80px] outline-none text-sm bg-transparent"
          />
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (values.length > 0) onChange([]);
            else setOpen((o) => !o);
          }}
          className="ml-auto text-gray-400 hover:text-gray-700"
          aria-label={values.length > 0 ? "Clear values" : "Toggle dropdown"}
        >
          {values.length > 0 ? "×" : "▾"}
        </button>
      </div>
      {open && (
        <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-30 max-h-64 overflow-y-auto">
          {isFreeText && search.trim() && !values.includes(search.trim()) && (
            <button
              type="button"
              onClick={() => commitFreeText(search)}
              className="w-full text-left px-3 py-2 text-sm text-blue-700 hover:bg-blue-50 border-b border-gray-100"
            >
              Use “{search.trim()}”
            </button>
          )}
          {filteredSuggestions.length === 0 ? (
            <p className="px-3 py-3 text-xs text-gray-400">
              {suggestions.length === 0 ? "Load data to see available values." : "No matching values."}
            </p>
          ) : (
            filteredSuggestions.map((s) => (
              <button
                key={s || "__empty__"}
                type="button"
                onClick={() => toggleValue(s)}
                className="w-full text-left px-3 py-2 text-sm text-gray-800 hover:bg-gray-50"
              >
                {s === "" ? "(None)" : s}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Filter row (mode select + value picker) ──────────────────────────────────

function FilterRow({
  filter,
  suggestions,
  onUpdate,
  onRemove,
}: {
  filter: ReportFilter;
  suggestions: string[];
  onUpdate: (patch: Partial<ReportFilter>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="border-t border-gray-100 pt-3 mt-3">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs text-gray-500">{filter.categoryLabel}</p>
        <button
          type="button"
          onClick={onRemove}
          className="text-gray-400 hover:text-red-600"
          aria-label="Remove filter"
        >
          ×
        </button>
      </div>
      <p className="text-sm font-semibold text-gray-900 mb-2">{filter.fieldLabel}</p>
      <select
        value={filter.mode}
        onChange={(e) => onUpdate({ mode: e.target.value as FilterMode })}
        className="w-full mb-2 px-2.5 py-1.5 border border-gray-200 rounded-md text-sm bg-white"
      >
        {FILTER_MODES.map((m) => (
          <option key={m.value} value={m.value}>
            {m.label}
          </option>
        ))}
      </select>
      <FilterValuePicker
        mode={filter.mode}
        values={filter.values}
        suggestions={suggestions}
        onChange={(values) => onUpdate({ values })}
      />
    </div>
  );
}

// ─── Composed panel ────────────────────────────────────────────────────────────

export function FiltersPanel({
  categories,
  filters,
  suggestionsFor,
  onChange,
  emptyHint,
}: {
  categories: FilterCategory[];
  filters: ReportFilter[];
  suggestionsFor: (filter: ReportFilter) => string[];
  onChange: (next: ReportFilter[]) => void;
  emptyHint?: string;
}) {
  function addFilter(category: FilterCategory, field: { key: string; label: string }) {
    // Don't add the same source/field twice.
    if (filters.some((f) => f.source === category.source && f.columnKey === field.key)) return;
    onChange([
      ...filters,
      {
        id: crypto.randomUUID(),
        source: category.source,
        categoryLabel: category.label,
        columnKey: field.key,
        fieldLabel: field.label,
        mode: "matches",
        values: [],
      },
    ]);
  }

  return (
    <div className="space-y-1">
      {categories.length === 0 ? (
        <p className="text-xs text-gray-400 py-2">
          {emptyHint ?? "Add columns to the report first, then filter on them here."}
        </p>
      ) : (
        <AddFilterMenu categories={categories} onSelect={addFilter} />
      )}
      {filters.map((f) => (
        <FilterRow
          key={f.id}
          filter={f}
          suggestions={suggestionsFor(f)}
          onUpdate={(patch) => onChange(filters.map((x) => (x.id === f.id ? { ...x, ...patch } : x)))}
          onRemove={() => onChange(filters.filter((x) => x.id !== f.id))}
        />
      ))}
    </div>
  );
}
