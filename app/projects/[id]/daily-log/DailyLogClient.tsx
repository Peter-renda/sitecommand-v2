"use client";

import { useState, useEffect, useRef, type ChangeEvent } from "react";
import { useSearchParams } from "next/navigation";
import ProjectNav from "@/components/ProjectNav";
import { Skeleton } from "@/app/components/Skeleton";

// ── Helpers ─────────────────────────────────────────────────────────────────

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

function parseLocalDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function shiftDay(iso: string, n: number) {
  const d = parseLocalDate(iso);
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function isValidISODate(value: string | null): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function calcDurationHours(start: string, end: string): string {
  if (!start || !end) return "";
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const diffMin = eh * 60 + em - (sh * 60 + sm);
  if (diffMin <= 0) return "0";
  return (diffMin / 60).toFixed(2);
}

// ── Types ────────────────────────────────────────────────────────────────────

// Values for super-admin-defined custom columns, keyed by custom field key.
type CustomValues = Record<string, string>;

type InspectionEntry = {
  id: string;
  start_time: string;
  end_time: string;
  inspection_type: string;
  inspecting_entity: string;
  inspector_name: string;
  location: string;
  inspection_area: string;
  comments: string;
  custom?: CustomValues;
  attachments?: Attachment[];
};

type DeliveryEntry = {
  id: string;
  time: string;
  delivery_from: string;
  tracking_number: string;
  contents: string;
  comments: string;
  custom?: CustomValues;
  attachments?: Attachment[];
};

type VisitorEntry = {
  id: string;
  visitor: string;
  start_time: string;
  end_time: string;
  comments: string;
  custom?: CustomValues;
  attachments?: Attachment[];
};

type SafetyViolationEntry = {
  id: string;
  time: string;
  subject: string;
  safety_notice: string;
  issued_to: string;
  compliance_due: string;
  comments: string;
  custom?: CustomValues;
  attachments?: Attachment[];
};

type AccidentEntry = {
  id: string;
  time: string;
  party_involved: string;
  company_involved: string;
  comments: string;
  custom?: CustomValues;
  attachments?: Attachment[];
};

type DelayEntry = {
  id: string;
  delay_type: string;
  start_time: string;
  end_time: string;
  duration_hours: string;
  location: string;
  comments: string;
  custom?: CustomValues;
  attachments?: Attachment[];
};

type NoteEntry = {
  id: string;
  is_issue: boolean;
  location: string;
  comments: string;
  custom?: CustomValues;
  attachments?: Attachment[];
};

type ManpowerEntry = {
  id: string;
  company: string;
  workers: string;
  hours: string;
  location: string;
  cost_code: string;
  comments: string;
  custom?: CustomValues;
  attachments?: Attachment[];
};

type WeatherObservation = {
  id: string;
  time_observed: string;
  delay: boolean;
  sky: string;
  temperature: string;
  calamity: string;
  avg_precipitation: string;
  wind: string;
  ground_sea: string;
  comments: string;
  custom?: CustomValues;
  attachments?: Attachment[];
};

type PhotoEntry = {
  id: string;
  description: string;
  title?: string;
  album?: string;
  comments?: string;
  url?: string;
  filename?: string;
  uploaded_at?: string;
  uploaded_by_name?: string;
};

type Attachment = {
  url: string;
  filename: string;
};

type PhotoAlbum = {
  id: string;
  name: string;
};

type LogForm = {
  log_date: string;
  weather_conditions: string;
  weather_temp: string;
  weather_wind: string;
  weather_humidity: string;
  inspections: InspectionEntry[];
  deliveries: DeliveryEntry[];
  visitors: VisitorEntry[];
  safety_violations: SafetyViolationEntry[];
  accidents: AccidentEntry[];
  delays: DelayEntry[];
  manpower: ManpowerEntry[];
  note_entries: NoteEntry[];
  photos: PhotoEntry[];
  weather_observations: WeatherObservation[];
};

function emptyForm(date: string): LogForm {
  return {
    log_date: date,
    weather_conditions: "",
    weather_temp: "",
    weather_wind: "",
    weather_humidity: "",
    inspections: [],
    deliveries: [],
    visitors: [],
    safety_violations: [],
    accidents: [],
    delays: [],
    manpower: [],
    note_entries: [],
    photos: [],
    weather_observations: [],
  };
}

// ── Constants ────────────────────────────────────────────────────────────────

const WEATHER_CONDITIONS = [
  "Clear", "Partly Cloudy", "Cloudy", "Light Rain",
  "Heavy Rain", "Snow", "Fog", "Windy", "Other",
];

function weatherCodeToCondition(code: number): string {
  if (code <= 1) return "Clear";
  if (code === 2) return "Partly Cloudy";
  if (code === 3) return "Cloudy";
  if (code === 45 || code === 48) return "Fog";
  if (code >= 51 && code <= 67) return code >= 63 ? "Heavy Rain" : "Light Rain";
  if (code >= 71 && code <= 77) return "Snow";
  if (code === 80 || code === 81) return "Light Rain";
  if (code === 82) return "Heavy Rain";
  if (code === 85 || code === 86) return "Snow";
  if (code >= 95) return "Heavy Rain";
  return "Other";
}
const SKY_OPTIONS = ["", "Clear", "Partly Cloudy", "Cloudy", "Overcast", "Fog"];
const DELAY_TYPES = [
  "", "Weather", "Labor", "Material", "Equipment",
  "Design", "Owner", "Subcontractor", "Other",
];

// ── Column configuration (super admin) ───────────────────────────────────────

type FieldType = "text" | "number" | "time" | "date" | "checkbox";

type FieldDef = {
  key: string;
  label: string;
  type?: FieldType;
  isCustom?: boolean;
  // Derived column (e.g. Manpower Total Hrs) — rendered by the section itself.
  computed?: boolean;
  placeholder?: string;
  options?: string[]; // renders a <select>
  minW?: string;
  step?: string;
  min?: string;
  emphasis?: "strong" | "muted";
  // checkbox display: badge shown when true
  badgeText?: string;
  badgeClass?: string;
  suffix?: string;
  // display "—" instead of omitting the column when empty
  showDash?: boolean;
  readOnly?: boolean;
};

type CustomFieldDef = { key: string; label: string; type?: FieldType };
type DailyLogFieldConfig = Record<string, { hidden?: string[]; custom?: CustomFieldDef[]; order?: string[] }>;
type SectionCfg = { hidden: Set<string>; custom: CustomFieldDef[]; order: string[] };

const EMPTY_SECTION_CFG: SectionCfg = { hidden: new Set(), custom: [], order: [] };

const CUSTOM_FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "time", label: "Time" },
  { value: "date", label: "Date" },
  { value: "checkbox", label: "Checkbox" },
];

function resolveSectionCfg(config: DailyLogFieldConfig, key: string): SectionCfg {
  const c = config[key];
  if (!c) return EMPTY_SECTION_CFG;
  return { hidden: new Set(c.hidden ?? []), custom: c.custom ?? [], order: c.order ?? [] };
}

// Built-in columns per configurable section, used by the column-config modal,
// the section renderers, and the voice-entry review editor.
const SECTION_FIELD_DEFS: { key: string; label: string; fields: FieldDef[] }[] = [
  {
    key: "manpower", label: "Manpower", fields: [
      { key: "company", label: "Company", placeholder: "Trade / company", minW: "150px", emphasis: "strong", showDash: true },
      { key: "workers", label: "Workers", type: "number", min: "0", placeholder: "0", minW: "70px", showDash: true },
      { key: "hours", label: "Hrs/Worker", type: "number", min: "0", step: "0.5", placeholder: "0", minW: "80px", showDash: true },
      { key: "total_hours", label: "Total Hrs", computed: true, minW: "80px", showDash: true },
      { key: "location", label: "Location", placeholder: "Work area", minW: "120px", showDash: true },
      { key: "cost_code", label: "Cost Code", placeholder: "Optional", minW: "100px", showDash: true },
      { key: "comments", label: "Comments", placeholder: "Optional notes...", minW: "160px", emphasis: "muted", showDash: true },
    ],
  },
  {
    key: "inspections", label: "Inspections", fields: [
      { key: "inspection_type", label: "Type", placeholder: "e.g. Fire Safety", minW: "120px", emphasis: "strong" },
      { key: "start_time", label: "Start", type: "time", minW: "90px" },
      { key: "end_time", label: "End", type: "time", minW: "90px" },
      { key: "inspecting_entity", label: "Entity", placeholder: "City Inspector", minW: "120px" },
      { key: "inspector_name", label: "Inspector", placeholder: "Full name", minW: "120px" },
      { key: "location", label: "Location", placeholder: "e.g. Level 3", minW: "110px" },
      { key: "inspection_area", label: "Area", placeholder: "e.g. Electrical", minW: "110px" },
      { key: "comments", label: "Comments", placeholder: "Notes...", minW: "160px", emphasis: "muted" },
    ],
  },
  {
    key: "deliveries", label: "Deliveries", fields: [
      { key: "time", label: "Time", type: "time", minW: "90px" },
      { key: "delivery_from", label: "From", placeholder: "Supplier / vendor", minW: "130px", emphasis: "strong" },
      { key: "contents", label: "Contents", placeholder: "Material description", minW: "140px" },
      { key: "tracking_number", label: "Tracking #", placeholder: "Optional", minW: "120px" },
      { key: "comments", label: "Comments", placeholder: "Notes...", minW: "160px", emphasis: "muted" },
    ],
  },
  {
    key: "visitors", label: "Visitors", fields: [
      { key: "visitor", label: "Visitor", placeholder: "Name and company", minW: "160px", emphasis: "strong" },
      { key: "start_time", label: "Start", type: "time", minW: "90px" },
      { key: "end_time", label: "End", type: "time", minW: "90px" },
      { key: "comments", label: "Comments", placeholder: "Purpose of visit...", minW: "180px", emphasis: "muted" },
    ],
  },
  {
    key: "safety_violations", label: "Safety Violations", fields: [
      { key: "subject", label: "Subject", placeholder: "Brief description", minW: "140px", emphasis: "strong" },
      { key: "time", label: "Time", type: "time", minW: "90px" },
      { key: "issued_to", label: "Issued To", placeholder: "Person / company", minW: "120px" },
      { key: "safety_notice", label: "Notice #", placeholder: "Notice # or type", minW: "100px" },
      { key: "compliance_due", label: "Due", type: "date", minW: "110px" },
      { key: "comments", label: "Comments", placeholder: "Details...", minW: "160px", emphasis: "muted" },
    ],
  },
  {
    key: "accidents", label: "Accidents", fields: [
      { key: "time", label: "Time", type: "time", minW: "90px" },
      { key: "party_involved", label: "Party Involved", placeholder: "Person's name", minW: "140px", emphasis: "strong" },
      { key: "company_involved", label: "Company", placeholder: "Company name", minW: "130px" },
      { key: "comments", label: "Comments", placeholder: "Describe the incident...", minW: "180px", emphasis: "muted" },
    ],
  },
  {
    key: "delays", label: "Delays", fields: [
      { key: "delay_type", label: "Type", options: DELAY_TYPES, minW: "130px", emphasis: "strong" },
      { key: "start_time", label: "Start", type: "time", minW: "90px" },
      { key: "end_time", label: "End", type: "time", minW: "90px" },
      { key: "duration_hours", label: "Duration", placeholder: "Auto", readOnly: true, suffix: "h", minW: "90px" },
      { key: "location", label: "Location", placeholder: "Area affected", minW: "120px" },
      { key: "comments", label: "Comments", placeholder: "Cause and impact...", minW: "160px", emphasis: "muted" },
    ],
  },
  {
    key: "note_entries", label: "Notes", fields: [
      { key: "is_issue", label: "Issue?", type: "checkbox", badgeText: "Issue", badgeClass: "bg-red-50 text-red-700", showDash: true, minW: "60px" },
      { key: "location", label: "Location", placeholder: "Area or location", minW: "140px" },
      { key: "comments", label: "Note", placeholder: "Note details...", minW: "240px" },
    ],
  },
  {
    key: "weather_observations", label: "Observed Weather Conditions", fields: [
      { key: "time_observed", label: "Time", type: "time", minW: "90px", emphasis: "strong" },
      { key: "sky", label: "Sky", options: SKY_OPTIONS, minW: "110px" },
      { key: "temperature", label: "Temp", placeholder: "e.g. 68°F", minW: "90px" },
      { key: "wind", label: "Wind", placeholder: "e.g. 15 mph NE", minW: "110px" },
      { key: "avg_precipitation", label: "Precip", placeholder: "e.g. Light rain", minW: "110px" },
      { key: "ground_sea", label: "Ground", placeholder: "e.g. Wet", minW: "90px" },
      { key: "calamity", label: "Calamity", placeholder: "e.g. Flooding", minW: "110px" },
      { key: "delay", label: "Delay?", type: "checkbox", badgeText: "Weather", badgeClass: "bg-yellow-50 text-yellow-700", minW: "60px" },
      { key: "comments", label: "Comments", placeholder: "Additional notes...", minW: "160px", emphasis: "muted" },
    ],
  },
];

// All columns (built-in + custom) in their configured order. Unknown keys in
// the saved order are skipped; fields missing from it keep their default
// position appended at the end (covers newly added built-ins/customs).
function orderedFields(sectionKey: string, cfg: SectionCfg): FieldDef[] {
  const builtIn = SECTION_FIELD_DEFS.find((s) => s.key === sectionKey)?.fields ?? [];
  const custom: FieldDef[] = cfg.custom.map((c) => ({
    key: c.key, label: c.label, type: c.type ?? "text", isCustom: true,
  }));
  const all = [...builtIn, ...custom];
  const byKey = new Map(all.map((f) => [f.key, f]));
  const ordered: FieldDef[] = [];
  for (const k of cfg.order) {
    const f = byKey.get(k);
    if (f) { ordered.push(f); byKey.delete(k); }
  }
  for (const f of all) {
    if (byKey.has(f.key)) { ordered.push(f); byKey.delete(f.key); }
  }
  return ordered;
}

function visibleFields(sectionKey: string, cfg: SectionCfg): FieldDef[] {
  return orderedFields(sectionKey, cfg).filter((f) => f.isCustom || !cfg.hidden.has(f.key));
}

// ── Shared UI primitives ─────────────────────────────────────────────────────

function SectionCard({
  title, badge, children,
}: {
  title: string;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50/40">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
          {badge && <span className="text-xs text-gray-400">{badge}</span>}
        </div>
      </div>
      {children}
    </div>
  );
}

// Shared input styles (compact, for inline form rows)
const inCls =
  "w-full px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-gray-900 disabled:bg-gray-50 disabled:text-gray-400 bg-white";
const selCls =
  "w-full px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-gray-900 bg-white";

// Width reserved for the right-side action column (Create / Attach / Delete).
// Keeping it the same across every section is what makes the Create buttons line up.
const ACTION_COL_WIDTH = "150px";

// Label + input column used in both display rows and form rows
function Col({ label, minW, children }: { label: string; minW: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5" style={{ minWidth: minW }}>
      <span className="text-gray-400 font-medium uppercase tracking-wide text-[10px]">{label}</span>
      {children}
    </div>
  );
}

// Displays one saved column value inside an EntryRow, driven by FieldDef
// metadata. Custom-column values are read from entry.custom; checkbox columns
// render a badge. Returns null for empty values unless the def asks for "—".
function FieldDisplay({ f, entry }: {
  f: FieldDef;
  entry: Record<string, unknown> & { custom?: CustomValues };
}) {
  const raw = f.isCustom ? entry.custom?.[f.key] : entry[f.key];
  if (f.type === "checkbox") {
    const on = f.isCustom ? raw === "Yes" : !!raw;
    if (!on && !f.showDash) return null;
    return (
      <Col label={f.label} minW={f.minW ?? "60px"}>
        {on
          ? <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${f.badgeClass ?? "bg-gray-100 text-gray-700"}`}>{f.badgeText ?? "Yes"}</span>
          : <span className="text-gray-400">—</span>}
      </Col>
    );
  }
  const v = raw == null ? "" : String(raw);
  if (!v && !f.showDash) return null;
  const cls = f.emphasis === "strong" ? "text-gray-800 font-medium" : f.emphasis === "muted" ? "text-gray-500" : "text-gray-700";
  return (
    <Col label={f.label} minW={f.minW ?? "100px"}>
      <span className={cls}>{v ? `${v}${f.suffix ?? ""}` : "—"}</span>
    </Col>
  );
}

// One form input driven by FieldDef metadata (text/number/time/date/checkbox
// or a select when options are provided). Custom checkbox values are kept as
// "Yes"/"" strings so they fit the string-valued custom store.
function FieldInput({ f, value, onChange }: {
  f: FieldDef;
  value: string | boolean;
  onChange: (v: string | boolean) => void;
}) {
  if (f.type === "checkbox") {
    const checked = f.isCustom ? value === "Yes" : !!value;
    return (
      <Col label={f.label} minW={f.minW ?? "60px"}>
        <label className="flex items-center gap-1.5 cursor-pointer py-1">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => onChange(f.isCustom ? (e.target.checked ? "Yes" : "") : e.target.checked)}
            className="rounded border-gray-300 text-gray-900 focus:ring-gray-900"
          />
          <span className="text-xs text-gray-600">Yes</span>
        </label>
      </Col>
    );
  }
  if (f.options) {
    return (
      <Col label={f.label} minW={f.minW ?? "110px"}>
        <select value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} className={selCls}>
          {f.options.map((o) => <option key={o} value={o}>{o || "— Select —"}</option>)}
        </select>
      </Col>
    );
  }
  return (
    <Col label={f.label} minW={f.minW ?? "110px"}>
      <input
        type={f.type === "number" ? "number" : f.type === "time" ? "time" : f.type === "date" ? "date" : "text"}
        min={f.min}
        step={f.step}
        value={String(value ?? "")}
        readOnly={f.readOnly}
        disabled={f.readOnly}
        onChange={(e) => onChange(e.target.value)}
        placeholder={f.placeholder}
        className={inCls}
      />
    </Col>
  );
}

// Attachments rendered inline within an EntryRow as click-to-open hyperlinks
function AttachmentLinks({ items }: { items?: Attachment[] }) {
  if (!items || items.length === 0) return null;
  return (
    <Col label="Photos" minW="140px">
      <div className="flex flex-wrap gap-x-2 gap-y-0.5">
        {items.map((a, i) => (
          <a
            key={`${a.url}-${i}`}
            href={a.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 underline truncate max-w-[180px]"
            title={a.filename}
          >
            {a.filename || `Photo ${i + 1}`}
          </a>
        ))}
      </div>
    </Col>
  );
}

// Hook for managing the draft attachments on a section's form row.
// Uploads via the project Photos endpoint so images live in the Photos library.
function useDraftAttachments(projectId: string) {
  const [items, setItems] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  async function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const formData = new FormData();
      Array.from(files).forEach((f) => formData.append("file", f));
      const res = await fetch(`/api/projects/${projectId}/photos`, {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        const uploaded = await res.json();
        if (Array.isArray(uploaded)) {
          setItems((prev) => [
            ...prev,
            ...uploaded.map((p: { url: string; filename: string }) => ({
              url: p.url,
              filename: p.filename,
            })),
          ]);
        }
      }
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  function remove(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function reset() {
    setItems([]);
  }

  return { items, uploading, inputRef, handleFiles, remove, reset };
}

// A row that displays saved data (with delete button on hover)
function EntryRow({ children, onDelete }: {
  children: React.ReactNode; onDelete: () => void;
}) {
  return (
    <div className="border-b border-gray-50 hover:bg-gray-50/50 group flex items-stretch">
      <div className="flex-1 min-w-0 overflow-x-auto px-4 py-3">
        <div className="flex items-center gap-6 text-xs min-w-max">
          {children}
        </div>
      </div>
      <div
        className="shrink-0 flex items-center justify-end px-3 border-l border-gray-100 bg-white group-hover:bg-gray-50/50"
        style={{ width: ACTION_COL_WIDTH }}
      >
        <button
          onClick={onDelete}
          className="p-1 text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
          aria-label="Delete entry"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// An always-visible form row at the bottom of a section.
// The Create + Attach buttons sit in a fixed-width right column so they line up
// across every section, regardless of how wide the inputs are.
function FormRow({
  onSubmit, children, attachments, uploading, inputRef, onAttachFiles, onRemoveAttachment,
}: {
  onSubmit: () => void;
  children: React.ReactNode;
  attachments: Attachment[];
  uploading: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onAttachFiles: (e: ChangeEvent<HTMLInputElement>) => void;
  onRemoveAttachment: (index: number) => void;
}) {
  return (
    <div className="border-t border-gray-100 bg-gray-50/40">
      {attachments.length > 0 && (
        <div className="px-4 pt-3 pb-1 flex flex-wrap gap-x-3 gap-y-1 text-xs">
          <span className="text-gray-400 font-medium uppercase tracking-wide text-[10px] pt-0.5">Attached</span>
          {attachments.map((a, i) => (
            <span key={`${a.url}-${i}`} className="inline-flex items-center gap-1 text-blue-600">
              <a
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                className="underline truncate max-w-[180px]"
                title={a.filename}
              >
                {a.filename || `Photo ${i + 1}`}
              </a>
              <button
                type="button"
                onClick={() => onRemoveAttachment(i)}
                className="text-gray-400 hover:text-red-500"
                aria-label="Remove attachment"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex items-stretch">
        <div className="flex-1 min-w-0 overflow-x-auto px-4 py-3">
          <div className="inline-flex items-end gap-4 text-xs w-max min-w-full">
            {children}
          </div>
        </div>
        <div
          className="shrink-0 flex items-end justify-end gap-2 px-3 py-3 border-l border-gray-200 bg-gray-50/40"
          style={{ width: ACTION_COL_WIDTH }}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={onAttachFiles}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="p-1.5 text-gray-500 hover:text-[color:var(--ink)] border border-gray-200 bg-white rounded-md hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title={uploading ? "Uploading..." : "Attach image"}
            aria-label="Attach image"
          >
            {uploading ? (
              <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v4m0 8v4m8-8h-4M8 12H4m13.66-5.66l-2.83 2.83m-5.66 5.66l-2.83 2.83m11.32 0l-2.83-2.83M9.17 9.17L6.34 6.34" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
              </svg>
            )}
          </button>
          <button
            onClick={onSubmit}
            className="px-3 py-1.5 text-xs font-semibold text-white bg-[color:var(--ink)] rounded-md hover:bg-black transition-colors whitespace-nowrap"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}

// Draft state for a section's form row: built-in values live in a typed draft,
// custom-column values in a parallel string map. FieldInput reads/writes both
// through value()/set().
function useSectionDraft<T extends Record<string, unknown>>(makeEmpty: () => T) {
  const [draft, setDraft] = useState<T>(makeEmpty());
  const [customDraft, setCustomDraft] = useState<CustomValues>({});

  function value(f: FieldDef): string | boolean {
    if (f.isCustom) return customDraft[f.key] ?? "";
    const v = draft[f.key];
    return typeof v === "boolean" ? v : v == null ? "" : String(v);
  }

  function set(f: FieldDef, v: string | boolean) {
    if (f.isCustom) setCustomDraft((p) => ({ ...p, [f.key]: v as string }));
    else setDraft((d) => ({ ...d, [f.key]: v }));
  }

  function reset() {
    setDraft(makeEmpty());
    setCustomDraft({});
  }

  return { draft, customDraft, value, set, reset, setDraft };
}

// ── Inspections ──────────────────────────────────────────────────────────────

const emptyInspection = (): Omit<InspectionEntry, "id"> => ({
  start_time: "", end_time: "", inspection_type: "", inspecting_entity: "",
  inspector_name: "", location: "", inspection_area: "", comments: "",
});

function InspectionsSection({ projectId, entries, onAdd, onDelete, cfg = EMPTY_SECTION_CFG }: {
  projectId: string;
  entries: InspectionEntry[];
  onAdd: (e: InspectionEntry) => void;
  onDelete: (id: string) => void;
  cfg?: SectionCfg;
}) {
  const d = useSectionDraft(emptyInspection);
  const att = useDraftAttachments(projectId);
  const fields = visibleFields("inspections", cfg);

  function handleCreate() {
    onAdd({ id: uid(), ...d.draft, custom: d.customDraft, attachments: att.items });
    d.reset();
    att.reset();
  }

  return (
    <SectionCard title="Inspections">
      {entries.map((e) => (
        <EntryRow key={e.id} onDelete={() => onDelete(e.id)}>
          {fields.map((f) => <FieldDisplay key={f.key} f={f} entry={e} />)}
          <AttachmentLinks items={e.attachments} />
        </EntryRow>
      ))}
      <FormRow
        onSubmit={handleCreate}
        attachments={att.items}
        uploading={att.uploading}
        inputRef={att.inputRef}
        onAttachFiles={att.handleFiles}
        onRemoveAttachment={att.remove}
      >
        {fields.map((f) => (
          <FieldInput key={f.key} f={f} value={d.value(f)} onChange={(v) => d.set(f, v)} />
        ))}
      </FormRow>
    </SectionCard>
  );
}

// ── Deliveries ───────────────────────────────────────────────────────────────

const emptyDelivery = (): Omit<DeliveryEntry, "id"> => ({
  time: "", delivery_from: "", tracking_number: "", contents: "", comments: "",
});

function DeliveriesSection({ projectId, entries, onAdd, onDelete, cfg = EMPTY_SECTION_CFG }: {
  projectId: string;
  entries: DeliveryEntry[];
  onAdd: (e: DeliveryEntry) => void;
  onDelete: (id: string) => void;
  cfg?: SectionCfg;
}) {
  const d = useSectionDraft(emptyDelivery);
  const att = useDraftAttachments(projectId);
  const fields = visibleFields("deliveries", cfg);

  function handleCreate() {
    onAdd({ id: uid(), ...d.draft, custom: d.customDraft, attachments: att.items });
    d.reset();
    att.reset();
  }

  return (
    <SectionCard title="Deliveries">
      {entries.map((e) => (
        <EntryRow key={e.id} onDelete={() => onDelete(e.id)}>
          {fields.map((f) => <FieldDisplay key={f.key} f={f} entry={e} />)}
          <AttachmentLinks items={e.attachments} />
        </EntryRow>
      ))}
      <FormRow
        onSubmit={handleCreate}
        attachments={att.items}
        uploading={att.uploading}
        inputRef={att.inputRef}
        onAttachFiles={att.handleFiles}
        onRemoveAttachment={att.remove}
      >
        {fields.map((f) => (
          <FieldInput key={f.key} f={f} value={d.value(f)} onChange={(v) => d.set(f, v)} />
        ))}
      </FormRow>
    </SectionCard>
  );
}

// ── Visitors ─────────────────────────────────────────────────────────────────

const emptyVisitor = (): Omit<VisitorEntry, "id"> => ({
  visitor: "", start_time: "", end_time: "", comments: "",
});

function VisitorsSection({ projectId, entries, onAdd, onDelete, cfg = EMPTY_SECTION_CFG }: {
  projectId: string;
  entries: VisitorEntry[];
  onAdd: (e: VisitorEntry) => void;
  onDelete: (id: string) => void;
  cfg?: SectionCfg;
}) {
  const d = useSectionDraft(emptyVisitor);
  const att = useDraftAttachments(projectId);
  const fields = visibleFields("visitors", cfg);

  function handleCreate() {
    onAdd({ id: uid(), ...d.draft, custom: d.customDraft, attachments: att.items });
    d.reset();
    att.reset();
  }

  return (
    <SectionCard title="Visitors">
      {entries.map((e) => (
        <EntryRow key={e.id} onDelete={() => onDelete(e.id)}>
          {fields.map((f) => <FieldDisplay key={f.key} f={f} entry={e} />)}
          <AttachmentLinks items={e.attachments} />
        </EntryRow>
      ))}
      <FormRow
        onSubmit={handleCreate}
        attachments={att.items}
        uploading={att.uploading}
        inputRef={att.inputRef}
        onAttachFiles={att.handleFiles}
        onRemoveAttachment={att.remove}
      >
        {fields.map((f) => (
          <FieldInput key={f.key} f={f} value={d.value(f)} onChange={(v) => d.set(f, v)} />
        ))}
      </FormRow>
    </SectionCard>
  );
}

// ── Safety Violations ────────────────────────────────────────────────────────

const emptySafetyViolation = (): Omit<SafetyViolationEntry, "id"> => ({
  time: "", subject: "", safety_notice: "", issued_to: "", compliance_due: "", comments: "",
});

function SafetyViolationsSection({ projectId, entries, onAdd, onDelete, cfg = EMPTY_SECTION_CFG }: {
  projectId: string;
  entries: SafetyViolationEntry[];
  onAdd: (e: SafetyViolationEntry) => void;
  onDelete: (id: string) => void;
  cfg?: SectionCfg;
}) {
  const d = useSectionDraft(emptySafetyViolation);
  const att = useDraftAttachments(projectId);
  const fields = visibleFields("safety_violations", cfg);

  function handleCreate() {
    onAdd({ id: uid(), ...d.draft, custom: d.customDraft, attachments: att.items });
    d.reset();
    att.reset();
  }

  return (
    <SectionCard title="Safety Violations">
      {entries.map((e) => (
        <EntryRow key={e.id} onDelete={() => onDelete(e.id)}>
          {fields.map((f) => <FieldDisplay key={f.key} f={f} entry={e} />)}
          <AttachmentLinks items={e.attachments} />
        </EntryRow>
      ))}
      <FormRow
        onSubmit={handleCreate}
        attachments={att.items}
        uploading={att.uploading}
        inputRef={att.inputRef}
        onAttachFiles={att.handleFiles}
        onRemoveAttachment={att.remove}
      >
        {fields.map((f) => (
          <FieldInput key={f.key} f={f} value={d.value(f)} onChange={(v) => d.set(f, v)} />
        ))}
      </FormRow>
    </SectionCard>
  );
}

// ── Accidents ────────────────────────────────────────────────────────────────

const emptyAccident = (): Omit<AccidentEntry, "id"> => ({
  time: "", party_involved: "", company_involved: "", comments: "",
});

function AccidentsSection({ projectId, entries, onAdd, onDelete, cfg = EMPTY_SECTION_CFG }: {
  projectId: string;
  entries: AccidentEntry[];
  onAdd: (e: AccidentEntry) => void;
  onDelete: (id: string) => void;
  cfg?: SectionCfg;
}) {
  const d = useSectionDraft(emptyAccident);
  const att = useDraftAttachments(projectId);
  const fields = visibleFields("accidents", cfg);

  function handleCreate() {
    onAdd({ id: uid(), ...d.draft, custom: d.customDraft, attachments: att.items });
    d.reset();
    att.reset();
  }

  return (
    <SectionCard title="Accidents">
      {entries.map((e) => (
        <EntryRow key={e.id} onDelete={() => onDelete(e.id)}>
          {fields.map((f) => <FieldDisplay key={f.key} f={f} entry={e} />)}
          <AttachmentLinks items={e.attachments} />
        </EntryRow>
      ))}
      <FormRow
        onSubmit={handleCreate}
        attachments={att.items}
        uploading={att.uploading}
        inputRef={att.inputRef}
        onAttachFiles={att.handleFiles}
        onRemoveAttachment={att.remove}
      >
        {fields.map((f) => (
          <FieldInput key={f.key} f={f} value={d.value(f)} onChange={(v) => d.set(f, v)} />
        ))}
      </FormRow>
    </SectionCard>
  );
}

// ── Delays ───────────────────────────────────────────────────────────────────

const emptyDelay = (): Omit<DelayEntry, "id"> => ({
  delay_type: "", start_time: "", end_time: "", duration_hours: "", location: "", comments: "",
});

function DelaysSection({ projectId, entries, onAdd, onDelete, cfg = EMPTY_SECTION_CFG }: {
  projectId: string;
  entries: DelayEntry[];
  onAdd: (e: DelayEntry) => void;
  onDelete: (id: string) => void;
  cfg?: SectionCfg;
}) {
  const d = useSectionDraft(emptyDelay);
  const att = useDraftAttachments(projectId);
  const fields = visibleFields("delays", cfg);

  // Built-in start/end edits recalculate the auto duration
  function setValue(f: FieldDef, v: string | boolean) {
    if (!f.isCustom && (f.key === "start_time" || f.key === "end_time")) {
      d.setDraft((prev) => {
        const updated = { ...prev, [f.key]: v as string };
        updated.duration_hours = calcDurationHours(updated.start_time, updated.end_time);
        return updated;
      });
      return;
    }
    d.set(f, v);
  }

  function handleCreate() {
    onAdd({ id: uid(), ...d.draft, custom: d.customDraft, attachments: att.items });
    d.reset();
    att.reset();
  }

  const totalHours = entries.reduce((sum, e) => sum + (parseFloat(e.duration_hours) || 0), 0);

  return (
    <SectionCard title="Delays" badge={`${totalHours.toFixed(2)} Total Hours`}>
      {entries.map((e) => (
        <EntryRow key={e.id} onDelete={() => onDelete(e.id)}>
          {fields.map((f) => <FieldDisplay key={f.key} f={f} entry={e} />)}
          <AttachmentLinks items={e.attachments} />
        </EntryRow>
      ))}
      <FormRow
        onSubmit={handleCreate}
        attachments={att.items}
        uploading={att.uploading}
        inputRef={att.inputRef}
        onAttachFiles={att.handleFiles}
        onRemoveAttachment={att.remove}
      >
        {fields.map((f) => (
          <FieldInput key={f.key} f={f} value={d.value(f)} onChange={(v) => setValue(f, v)} />
        ))}
      </FormRow>
    </SectionCard>
  );
}

// ── Notes ────────────────────────────────────────────────────────────────────

const emptyNoteEntry = (): Omit<NoteEntry, "id"> => ({
  is_issue: false, location: "", comments: "",
});

function NoteEntriesSection({ projectId, entries, onAdd, onDelete, cfg = EMPTY_SECTION_CFG }: {
  projectId: string;
  entries: NoteEntry[];
  onAdd: (e: NoteEntry) => void;
  onDelete: (id: string) => void;
  cfg?: SectionCfg;
}) {
  const d = useSectionDraft(emptyNoteEntry);
  const att = useDraftAttachments(projectId);
  const fields = visibleFields("note_entries", cfg);

  function handleCreate() {
    onAdd({ id: uid(), ...d.draft, custom: d.customDraft, attachments: att.items });
    d.reset();
    att.reset();
  }

  return (
    <SectionCard title="Notes">
      {entries.map((e) => (
        <EntryRow key={e.id} onDelete={() => onDelete(e.id)}>
          {fields.map((f) => <FieldDisplay key={f.key} f={f} entry={e} />)}
          <AttachmentLinks items={e.attachments} />
        </EntryRow>
      ))}
      <FormRow
        onSubmit={handleCreate}
        attachments={att.items}
        uploading={att.uploading}
        inputRef={att.inputRef}
        onAttachFiles={att.handleFiles}
        onRemoveAttachment={att.remove}
      >
        {fields.map((f) => (
          <FieldInput key={f.key} f={f} value={d.value(f)} onChange={(v) => d.set(f, v)} />
        ))}
      </FormRow>
    </SectionCard>
  );
}

// ── Manpower ─────────────────────────────────────────────────────────────────

const emptyManpower = (): Omit<ManpowerEntry, "id"> => ({
  company: "", workers: "", hours: "", location: "", cost_code: "", comments: "",
});

function ManpowerSection({ projectId, entries, onAdd, onDelete, companySuggestions, cfg = EMPTY_SECTION_CFG }: {
  projectId: string;
  entries: ManpowerEntry[];
  onAdd: (e: ManpowerEntry) => void;
  onDelete: (id: string) => void;
  companySuggestions: string[];
  cfg?: SectionCfg;
}) {
  const d = useSectionDraft(emptyManpower);
  const att = useDraftAttachments(projectId);
  const fields = visibleFields("manpower", cfg);

  function handleCreate() {
    onAdd({ id: uid(), ...d.draft, custom: d.customDraft, attachments: att.items });
    d.reset();
    att.reset();
  }

  const totalWorkers = entries.reduce((sum, e) => sum + (parseInt(e.workers) || 0), 0);
  const totalHours = entries.reduce(
    (sum, e) => sum + (parseInt(e.workers) || 0) * (parseFloat(e.hours) || 0),
    0,
  );
  const draftTotalHours =
    d.draft.workers && d.draft.hours
      ? ((parseInt(d.draft.workers) || 0) * (parseFloat(d.draft.hours) || 0)).toFixed(1)
      : "";

  return (
    <SectionCard
      title="Manpower"
      badge={`${totalWorkers} Workers | ${totalHours.toFixed(1)} Total Hours`}
    >
      {entries.map((e) => (
        <EntryRow key={e.id} onDelete={() => onDelete(e.id)}>
          {fields.map((f) => {
            if (f.key === "total_hours") {
              return (
                <Col key={f.key} label="Total Hrs" minW="70px">
                  <span className="text-gray-700">{((parseInt(e.workers) || 0) * (parseFloat(e.hours) || 0)).toFixed(1)}h</span>
                </Col>
              );
            }
            return <FieldDisplay key={f.key} f={f} entry={e} />;
          })}
          <AttachmentLinks items={e.attachments} />
        </EntryRow>
      ))}
      <FormRow
        onSubmit={handleCreate}
        attachments={att.items}
        uploading={att.uploading}
        inputRef={att.inputRef}
        onAttachFiles={att.handleFiles}
        onRemoveAttachment={att.remove}
      >
        {fields.map((f) => {
          if (f.key === "company") {
            return (
              <Col key={f.key} label="Company" minW="150px">
                <input
                  list="manpower-companies"
                  value={d.draft.company}
                  onChange={(e) => d.set(f, e.target.value)}
                  placeholder="Trade / company"
                  className={inCls}
                />
                <datalist id="manpower-companies">
                  {companySuggestions.map((name) => <option key={name} value={name} />)}
                </datalist>
              </Col>
            );
          }
          if (f.key === "total_hours") {
            return (
              <Col key={f.key} label="Total Hrs" minW="80px">
                <input value={draftTotalHours} readOnly disabled placeholder="Auto" className={inCls} />
              </Col>
            );
          }
          return <FieldInput key={f.key} f={f} value={d.value(f)} onChange={(v) => d.set(f, v)} />;
        })}
      </FormRow>
    </SectionCard>
  );
}

// ── Observed Weather ─────────────────────────────────────────────────────────

const emptyWeatherObs = (): Omit<WeatherObservation, "id"> => ({
  time_observed: "", delay: false, sky: "", temperature: "",
  calamity: "", avg_precipitation: "", wind: "", ground_sea: "", comments: "",
});

function WeatherSection({
  projectId, form, patch, observations, onAddObs, onDeleteObs, cfg = EMPTY_SECTION_CFG,
}: {
  projectId: string;
  form: LogForm;
  patch: <K extends keyof LogForm>(key: K, value: LogForm[K]) => void;
  observations: WeatherObservation[];
  onAddObs: (o: WeatherObservation) => void;
  onDeleteObs: (id: string) => void;
  cfg?: SectionCfg;
}) {
  const d = useSectionDraft(emptyWeatherObs);
  const att = useDraftAttachments(projectId);
  const fields = visibleFields("weather_observations", cfg);

  function handleCreate() {
    onAddObs({ id: uid(), ...d.draft, custom: d.customDraft, attachments: att.items });
    d.reset();
    att.reset();
  }

  // Inline input style for general weather (full-width)
  const inputCls =
    "w-full px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:bg-gray-50 disabled:text-gray-400";

  return (
    <SectionCard title="Observed Weather">
      {/* General conditions */}
      <div className="p-4 border-b border-gray-100">
        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-500 mb-2">Conditions</label>
          <div className="flex flex-wrap gap-2">
            {WEATHER_CONDITIONS.map((c) => (
              <button
                key={c}
                onClick={() => patch("weather_conditions", form.weather_conditions === c ? "" : c)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                  form.weather_conditions === c
                    ? "bg-gray-900 text-white border-gray-900"
                    : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Temperature</label>
            <input value={form.weather_temp} onChange={(e) => patch("weather_temp", e.target.value)} placeholder="e.g. 72°F" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Wind</label>
            <input value={form.weather_wind} onChange={(e) => patch("weather_wind", e.target.value)} placeholder="e.g. 10 mph NW" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Humidity / Other</label>
            <input value={form.weather_humidity} onChange={(e) => patch("weather_humidity", e.target.value)} placeholder="e.g. 65%" className={inputCls} />
          </div>
        </div>
      </div>

      {/* Time-based observations */}
      <div>
        <div className="px-4 py-2.5 border-b border-gray-100">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Observed Weather Conditions
          </span>
        </div>

        {observations.map((o) => (
          <EntryRow key={o.id} onDelete={() => onDeleteObs(o.id)}>
            {fields.map((f) => <FieldDisplay key={f.key} f={f} entry={o} />)}
            <AttachmentLinks items={o.attachments} />
          </EntryRow>
        ))}

        <FormRow
          onSubmit={handleCreate}
          attachments={att.items}
          uploading={att.uploading}
          inputRef={att.inputRef}
          onAttachFiles={att.handleFiles}
          onRemoveAttachment={att.remove}
        >
          {fields.map((f) => (
            <FieldInput key={f.key} f={f} value={d.value(f)} onChange={(v) => d.set(f, v)} />
          ))}
        </FormRow>
      </div>
    </SectionCard>
  );
}

// ── Photos ───────────────────────────────────────────────────────────────────

function PhotosSection({ projectId, entries, onAdd, onUpdate, albumOptions }: {
  projectId: string;
  entries: PhotoEntry[];
  onAdd: (e: PhotoEntry) => void;
  onUpdate: (id: string, patch: Partial<PhotoEntry>) => void;
  albumOptions: string[];
}) {
  const PHOTOS_PER_PAGE = 25;
  const PHOTOS_PER_ROW = 10;
  const [uploading, setUploading] = useState(false);
  const [page, setPage] = useState(1);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const totalPages = Math.max(1, Math.ceil(entries.length / PHOTOS_PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * PHOTOS_PER_PAGE;
  const pageEnd = pageStart + PHOTOS_PER_PAGE;
  const visibleEntries = entries.slice(pageStart, pageEnd);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    if (previewIndex === null) return;
    if (entries.length === 0) {
      setPreviewIndex(null);
      return;
    }
    if (previewIndex > entries.length - 1) {
      setPreviewIndex(entries.length - 1);
    }
  }, [entries, previewIndex]);

  async function handleFilesSelected(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const formData = new FormData();
    Array.from(files).forEach((file) => formData.append("file", file));

    setUploading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/photos`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) return;
      const uploaded = await res.json();
      if (Array.isArray(uploaded)) {
        uploaded.forEach((photo) => {
          onAdd({
            id: uid(),
            description: photo.filename || "Photo",
            title: "",
            url: photo.url,
            filename: photo.filename,
            uploaded_at: photo.uploaded_at,
            uploaded_by_name: photo.uploaded_by_name,
          });
        });
      }
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  function formatPhotoRange() {
    if (entries.length === 0) return "0-0 of 0";
    return `${pageStart + 1}-${Math.min(pageEnd, entries.length)} of ${entries.length}`;
  }

  function showPrevPreview() {
    setPreviewIndex((prev) => {
      if (prev === null || entries.length === 0) return prev;
      return prev === 0 ? entries.length - 1 : prev - 1;
    });
  }

  function showNextPreview() {
    setPreviewIndex((prev) => {
      if (prev === null || entries.length === 0) return prev;
      return prev === entries.length - 1 ? 0 : prev + 1;
    });
  }

  const previewPhoto = previewIndex === null ? null : entries[previewIndex];
  const previewTitle = previewPhoto?.title?.trim() || previewPhoto?.description?.trim() || "";

  function formatUploadedAt(value?: string) {
    if (!value) return "—";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "—";
    return parsed.toLocaleString();
  }

  return (
    <SectionCard title="Photos">
      <div className="px-4 py-3 border-b border-gray-50 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-500">
            Upload photos from your device. On mobile, you can pick from gallery or take a picture.
          </p>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>{formatPhotoRange()}</span>
            <span>Page {currentPage} of {totalPages}</span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="inline-flex items-center justify-center w-7 h-7 rounded border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Previous photo page"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="inline-flex items-center justify-center w-7 h-7 rounded border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Next photo page"
            >
              ›
            </button>
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFilesSelected}
          className="hidden"
        />
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${PHOTOS_PER_ROW}, minmax(0, 1fr))` }}>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="aspect-square rounded border border-dashed border-gray-300 text-gray-500 hover:bg-gray-50 hover:text-[color:var(--ink)] hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center justify-center gap-1 transition-colors"
            title="Add photos"
            aria-label="Add photos"
          >
            <span className="text-2xl leading-none">+</span>
            <span className="text-[11px] font-medium">{uploading ? "Uploading..." : "Upload"}</span>
          </button>
          {visibleEntries.map((e, index) => (
            <div key={e.id} className="relative group">
              {e.url ? (
                <button
                  type="button"
                  onClick={() => setPreviewIndex(pageStart + index)}
                  className="block w-full"
                  aria-label={`Preview ${e.filename || e.description || "photo"}`}
                >
                  <img src={e.url} alt={e.filename || e.description || "Photo"} className="aspect-square w-full rounded border border-gray-200 object-cover" />
                </button>
              ) : (
                <div className="aspect-square w-full rounded border border-gray-200 bg-gray-50 p-1 text-[10px] text-gray-500 flex items-center justify-center text-center">
                  {e.description || "Photo"}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {previewPhoto?.url && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setPreviewIndex(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Photo preview"
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setPreviewIndex(null);
            }}
            className="absolute top-4 right-4 h-9 w-9 rounded-full bg-white/20 text-white hover:bg-white/30"
            aria-label="Close preview"
          >
            ✕
          </button>
          {entries.length > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                showPrevPreview();
              }}
              className="absolute left-4 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-white/20 text-white hover:bg-white/30"
              aria-label="Previous photo"
            >
              ‹
            </button>
          )}
          <div className="max-w-[1200px] max-h-[88vh] w-full h-full flex items-stretch gap-0" onClick={(e) => e.stopPropagation()}>
            <div className="flex-1 min-w-0 flex items-center justify-center bg-black/40 rounded-l-lg">
              <img
                src={previewPhoto.url}
                alt={previewTitle || "Photo preview"}
                className="max-h-[82vh] w-auto max-w-full object-contain"
              />
            </div>
            <aside className="w-[320px] shrink-0 bg-[#111318] text-white rounded-r-lg border-l border-white/10 p-4 overflow-y-auto">
              <h3 className="text-sm font-semibold text-gray-200">Information</h3>
              <p className="text-sm mt-3 font-medium">{previewTitle || "No Description"}</p>

              <div className="mt-4 border-t border-white/15 pt-4 space-y-4 text-xs">
                <div>
                  <label className="block text-gray-400 mb-1">Title</label>
                  <input
                    value={previewPhoto.title ?? previewPhoto.description ?? ""}
                    onChange={(e) => onUpdate(previewPhoto.id, { title: e.target.value, description: e.target.value })}
                    placeholder="Add title"
                    className="w-full rounded border border-white/20 bg-black/20 px-2 py-1.5 text-sm text-white placeholder:text-gray-500"
                  />
                </div>

                <div>
                  <p className="text-gray-400">Date Uploaded</p>
                  <p className="mt-1 text-sm">{formatUploadedAt(previewPhoto.uploaded_at)}</p>
                </div>

                <div>
                  <p className="text-gray-400">Uploaded By</p>
                  <p className="mt-1 text-sm">{previewPhoto.uploaded_by_name || "—"}</p>
                </div>

                <div>
                  <label className="block text-gray-400 mb-1">Album</label>
                  <select
                    value={previewPhoto.album ?? ""}
                    onChange={(e) => onUpdate(previewPhoto.id, { album: e.target.value })}
                    className="w-full rounded border border-white/20 bg-black/20 px-2 py-1.5 text-sm text-white placeholder:text-gray-500"
                  >
                    <option value="">Unclassified</option>
                    {albumOptions.map((albumName) => (
                      <option key={albumName} value={albumName}>{albumName}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-gray-400 mb-1">Comments</label>
                  <textarea
                    value={previewPhoto.comments ?? ""}
                    onChange={(e) => onUpdate(previewPhoto.id, { comments: e.target.value })}
                    placeholder="No comments"
                    rows={5}
                    className="w-full rounded border border-white/20 bg-black/20 px-2 py-1.5 text-sm text-white placeholder:text-gray-500 resize-y"
                  />
                </div>
              </div>

              <p className="mt-4 text-xs text-gray-400">
                {previewIndex! + 1} of {entries.length}
              </p>
            </aside>
          </div>
          {entries.length > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                showNextPreview();
              }}
              className="absolute right-4 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-white/20 text-white hover:bg-white/30"
              aria-label="Next photo"
            >
              ›
            </button>
          )}
        </div>
      )}
    </SectionCard>
  );
}

// ── Voice-to-entries ─────────────────────────────────────────────────────────

type ParsedVoiceEntries = {
  weather?: Partial<Pick<LogForm, "weather_conditions" | "weather_temp" | "weather_wind" | "weather_humidity"> & {
    conditions: string;
    temperature: string;
    wind: string;
    humidity: string;
  }>;
  manpower?: Omit<ManpowerEntry, "id">[];
  inspections?: Omit<InspectionEntry, "id">[];
  deliveries?: Omit<DeliveryEntry, "id">[];
  visitors?: Omit<VisitorEntry, "id">[];
  safety_violations?: Omit<SafetyViolationEntry, "id">[];
  accidents?: Omit<AccidentEntry, "id">[];
  delays?: Omit<DelayEntry, "id">[];
  note_entries?: Omit<NoteEntry, "id">[];
};

// Sections we can populate from parsed JSON, in display order. Field metadata
// (labels, input types) comes from SECTION_FIELD_DEFS so every parsed value is
// editable in the review step.
const VOICE_SECTIONS: {
  key: keyof ParsedVoiceEntries & string;
  formKey: keyof LogForm;
  label: string;
}[] = [
  { key: "manpower", formKey: "manpower", label: "Manpower" },
  { key: "inspections", formKey: "inspections", label: "Inspections" },
  { key: "deliveries", formKey: "deliveries", label: "Deliveries" },
  { key: "visitors", formKey: "visitors", label: "Visitors" },
  { key: "safety_violations", formKey: "safety_violations", label: "Safety Violations" },
  { key: "accidents", formKey: "accidents", label: "Accidents" },
  { key: "delays", formKey: "delays", label: "Delays" },
  { key: "note_entries", formKey: "note_entries", label: "Notes" },
];

const voiceFieldsFor = (key: string): FieldDef[] =>
  (SECTION_FIELD_DEFS.find((s) => s.key === key)?.fields ?? []).filter((f) => !f.computed);

function VoiceLogModal({
  projectId, companySuggestions, onClose, onApply,
}: {
  projectId: string;
  companySuggestions: string[];
  onClose: () => void;
  onApply: (parsed: ParsedVoiceEntries, applyWeather: boolean, selections: Record<string, Set<number>>) => void;
}) {
  const [phase, setPhase] = useState<"idle" | "recording" | "transcribing" | "parsing" | "review" | "error">("idle");
  const [error, setError] = useState<string>("");
  const [transcript, setTranscript] = useState<string>("");
  const [parsed, setParsed] = useState<ParsedVoiceEntries | null>(null);
  const [applyWeather, setApplyWeather] = useState(true);
  const [selections, setSelections] = useState<Record<string, Set<number>>>({});
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const elapsedTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        try { recorderRef.current.stop(); } catch {}
      }
      if (elapsedTimer.current) {
        clearInterval(elapsedTimer.current);
        elapsedTimer.current = null;
      }
    };
  }, []);

  async function startRecording() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        recorder.stream.getTracks().forEach((t) => t.stop());
        if (elapsedTimer.current) {
          clearInterval(elapsedTimer.current);
          elapsedTimer.current = null;
        }
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        if (blob.size === 0) {
          setPhase("error");
          setError("No audio captured.");
          return;
        }
        await transcribeAndParse(blob);
      };
      recorder.start();
      setElapsed(0);
      elapsedTimer.current = setInterval(() => setElapsed((s) => s + 1), 1000);
      setPhase("recording");
    } catch {
      setPhase("error");
      setError("Microphone access was denied.");
    }
  }

  function stopRecording() {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    setPhase("transcribing");
  }

  async function transcribeAndParse(blob: Blob) {
    try {
      setPhase("transcribing");
      const formData = new FormData();
      formData.append("audio", blob, "daily-log-audio.webm");
      const tRes = await fetch("/api/integrations/elevenlabs/transcribe", {
        method: "POST",
        body: formData,
      });
      const tData = await tRes.json();
      if (!tRes.ok) {
        setPhase("error");
        setError(tData.error || "Transcription failed.");
        return;
      }
      const text = (tData.text ?? "").trim();
      if (!text) {
        setPhase("error");
        setError("No transcript text returned.");
        return;
      }
      setTranscript(text);

      setPhase("parsing");
      const pRes = await fetch(`/api/projects/${projectId}/daily-log/parse-voice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: text, companySuggestions }),
      });
      const pData = await pRes.json();
      if (!pRes.ok) {
        setPhase("error");
        setError(pData.error || "Could not parse the recording.");
        return;
      }
      const parsedEntries = (pData.parsed ?? {}) as ParsedVoiceEntries;
      setParsed(parsedEntries);

      // Default: every parsed entry is checked.
      const defaults: Record<string, Set<number>> = {};
      for (const section of VOICE_SECTIONS) {
        const list = parsedEntries[section.key] as Record<string, unknown>[] | undefined;
        if (list && list.length > 0) {
          defaults[section.key] = new Set(list.map((_, i) => i));
        }
      }
      setSelections(defaults);

      const wx = parsedEntries.weather;
      const hasWeather = !!(wx && (wx.conditions || wx.temperature || wx.wind || wx.humidity));
      setApplyWeather(hasWeather);
      setPhase("review");
    } catch {
      setPhase("error");
      setError("Something went wrong while processing your recording.");
    }
  }

  function toggleSelection(sectionKey: string, index: number) {
    setSelections((prev) => {
      const next = { ...prev };
      const set = new Set(next[sectionKey] ?? []);
      if (set.has(index)) set.delete(index);
      else set.add(index);
      next[sectionKey] = set;
      return next;
    });
  }

  function updateEntryField(sectionKey: string, index: number, field: string, value: string | boolean) {
    setParsed((prev) => {
      if (!prev) return prev;
      const list = [...(((prev as Record<string, unknown>)[sectionKey] ?? []) as Record<string, unknown>[])];
      if (!list[index]) return prev;
      list[index] = { ...list[index], [field]: value };
      // The delay duration column is auto-calculated, so keep it in sync
      if (sectionKey === "delays" && (field === "start_time" || field === "end_time")) {
        const e = list[index];
        list[index] = {
          ...e,
          duration_hours: calcDurationHours(String(e.start_time ?? ""), String(e.end_time ?? "")),
        };
      }
      return { ...prev, [sectionKey]: list };
    });
  }

  function updateWeatherField(field: "conditions" | "temperature" | "wind" | "humidity", value: string) {
    setParsed((prev) => (prev ? { ...prev, weather: { ...(prev.weather ?? {}), [field]: value } } : prev));
  }

  function handleApply() {
    if (!parsed) return;
    onApply(parsed, applyWeather, selections);
    onClose();
  }

  const totalSelected = Object.values(selections).reduce((sum, s) => sum + s.size, 0)
    + (applyWeather && parsed?.weather && (parsed.weather.conditions || parsed.weather.temperature || parsed.weather.wind || parsed.weather.humidity) ? 1 : 0);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white rounded-xl max-w-3xl w-full max-h-[88vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Voice entry</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700"
            aria-label="Close"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {phase === "idle" && (
            <div className="text-center py-8">
              <button
                onClick={startRecording}
                className="inline-flex items-center gap-2 px-5 py-3 bg-[color:var(--ink)] text-white text-sm font-semibold rounded-md hover:bg-black"
              >
                <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                Start recording
              </button>
              <p className="text-xs text-gray-500 mt-3 max-w-md mx-auto">
                Tip: name companies, times, and locations the way you would in writing. Example: &ldquo;Triangle Concrete had six guys onsite from 7 to 3:30 in section C. Rebar delivery at 2pm from ABC Supply. Weather sunny, 75 degrees.&rdquo;
              </p>
            </div>
          )}

          {phase === "recording" && (
            <div className="text-center py-8">
              <div className="text-3xl font-display tabular-nums text-gray-900">
                {Math.floor(elapsed / 60).toString().padStart(2, "0")}:{(elapsed % 60).toString().padStart(2, "0")}
              </div>
              <p className="text-xs text-red-600 mt-1 flex items-center justify-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
                Recording…
              </p>
              <button
                onClick={stopRecording}
                className="mt-5 px-5 py-3 bg-gray-900 text-white text-sm font-semibold rounded-md hover:bg-black"
              >
                Stop and transcribe
              </button>
            </div>
          )}

          {(phase === "transcribing" || phase === "parsing") && (
            <div className="text-center py-10">
              <svg className="w-6 h-6 animate-spin mx-auto text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v4m0 8v4m8-8h-4M8 12H4m13.66-5.66l-2.83 2.83m-5.66 5.66l-2.83 2.83m11.32 0l-2.83-2.83M9.17 9.17L6.34 6.34" />
              </svg>
              <p className="text-sm text-gray-600 mt-3">
                {phase === "transcribing" ? "Transcribing…" : "Mapping speech to form fields…"}
              </p>
            </div>
          )}

          {phase === "error" && (
            <div className="text-center py-8">
              <p className="text-sm text-red-600">{error}</p>
              <button
                onClick={() => setPhase("idle")}
                className="mt-4 px-4 py-2 border border-gray-200 rounded-md text-sm text-gray-700 hover:bg-gray-50"
              >
                Try again
              </button>
            </div>
          )}

          {phase === "review" && parsed && (
            <>
              {transcript && (
                <div className="bg-gray-50 border border-gray-100 rounded-lg p-3">
                  <p className="mono-label mb-1">Transcript</p>
                  <p className="text-xs text-gray-700 whitespace-pre-wrap">{transcript}</p>
                </div>
              )}

              {parsed.weather && (parsed.weather.conditions || parsed.weather.temperature || parsed.weather.wind || parsed.weather.humidity) && (
                <div className="border border-gray-200 rounded-lg p-3">
                  <div className="flex items-start gap-2.5">
                    <input
                      type="checkbox"
                      checked={applyWeather}
                      onChange={(e) => setApplyWeather(e.target.checked)}
                      className="mt-0.5 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Weather</p>
                      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-2">
                        {([
                          ["conditions", "Conditions"],
                          ["temperature", "Temperature"],
                          ["wind", "Wind"],
                          ["humidity", "Humidity"],
                        ] as const).map(([k, label]) => (
                          <div key={k} className="flex flex-col gap-0.5" style={{ minWidth: "120px" }}>
                            <span className="text-gray-400 font-medium uppercase tracking-wide text-[10px]">{label}</span>
                            <input
                              value={(parsed.weather?.[k] as string) ?? ""}
                              onChange={(e) => updateWeatherField(k, e.target.value)}
                              className={inCls}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {VOICE_SECTIONS.map((section) => {
                const list = (parsed[section.key] ?? []) as Record<string, unknown>[];
                if (!list || list.length === 0) return null;
                const sel = selections[section.key] ?? new Set<number>();
                const fields = voiceFieldsFor(section.key);
                return (
                  <div key={section.key} className="border border-gray-200 rounded-lg">
                    <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide px-3 pt-3">
                      {section.label} <span className="text-gray-400 font-normal normal-case">({sel.size} of {list.length} selected)</span>
                    </p>
                    <div className="divide-y divide-gray-100">
                      {list.map((entry, i) => {
                        const checked = sel.has(i);
                        return (
                          <div key={i} className="flex items-start gap-2.5 px-3 py-2.5 hover:bg-gray-50">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleSelection(section.key, i)}
                              className="mt-1 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                            />
                            <div className="flex-1 flex flex-wrap gap-x-3 gap-y-2">
                              {fields.map((f) => (
                                <FieldInput
                                  key={f.key}
                                  f={f}
                                  value={f.type === "checkbox" ? !!entry[f.key] : String(entry[f.key] ?? "")}
                                  onChange={(v) => updateEntryField(section.key, i, f.key, v)}
                                />
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {!VOICE_SECTIONS.some((s) => ((parsed[s.key] ?? []) as unknown[]).length > 0) &&
                !(parsed.weather && (parsed.weather.conditions || parsed.weather.temperature || parsed.weather.wind || parsed.weather.humidity)) && (
                <p className="text-sm text-gray-500 text-center py-6">
                  The model couldn&apos;t pull any structured entries out of this recording. Try again with more concrete details.
                </p>
              )}
            </>
          )}
        </div>

        {phase === "review" && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-gray-50/40">
            <p className="text-xs text-gray-500">{totalSelected} item{totalSelected === 1 ? "" : "s"} will be added to the log.</p>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="px-3 py-1.5 text-sm text-gray-700 border border-gray-200 bg-white rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleApply}
                disabled={totalSelected === 0}
                className="px-4 py-1.5 text-sm font-semibold text-white bg-[color:var(--ink)] rounded-md hover:bg-black disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Apply to log
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Column configuration modal (super admin) ────────────────────────────────

function ConfigureColumnsModal({
  config, saving, onClose, onSave,
}: {
  config: DailyLogFieldConfig;
  saving: boolean;
  onClose: () => void;
  onSave: (next: DailyLogFieldConfig) => void;
}) {
  // Materialize a full column order for every section so rows can be dragged
  // even when the saved config has no order yet.
  const [draft, setDraft] = useState<DailyLogFieldConfig>(() => {
    const base = JSON.parse(JSON.stringify(config ?? {})) as DailyLogFieldConfig;
    for (const s of SECTION_FIELD_DEFS) {
      const sec = base[s.key] ?? {};
      const cfg: SectionCfg = { hidden: new Set(sec.hidden ?? []), custom: sec.custom ?? [], order: sec.order ?? [] };
      base[s.key] = { ...sec, order: orderedFields(s.key, cfg).map((f) => f.key) };
    }
    return base;
  });
  const [newLabels, setNewLabels] = useState<Record<string, string>>({});
  const [newTypes, setNewTypes] = useState<Record<string, FieldType>>({});
  const [drag, setDrag] = useState<{ section: string; key: string } | null>(null);

  function fieldFor(sectionKey: string, key: string): FieldDef | undefined {
    const builtIn = SECTION_FIELD_DEFS.find((s) => s.key === sectionKey)?.fields.find((f) => f.key === key);
    if (builtIn) return builtIn;
    const cf = (draft[sectionKey]?.custom ?? []).find((c) => c.key === key);
    return cf ? { key: cf.key, label: cf.label, type: cf.type ?? "text", isCustom: true } : undefined;
  }

  function isHidden(section: string, field: string) {
    return (draft[section]?.hidden ?? []).includes(field);
  }

  function toggleField(section: string, field: string) {
    setDraft((prev) => {
      const sec = prev[section] ?? {};
      const hidden = new Set(sec.hidden ?? []);
      if (hidden.has(field)) hidden.delete(field);
      else hidden.add(field);
      return { ...prev, [section]: { ...sec, hidden: Array.from(hidden) } };
    });
  }

  // Live reorder while dragging: when the dragged row enters another row,
  // move it to that row's position.
  function moveDraggedTo(section: string, targetKey: string) {
    if (!drag || drag.section !== section || drag.key === targetKey) return;
    setDraft((prev) => {
      const sec = prev[section] ?? {};
      const order = [...(sec.order ?? [])];
      const from = order.indexOf(drag.key);
      const to = order.indexOf(targetKey);
      if (from < 0 || to < 0) return prev;
      order.splice(from, 1);
      order.splice(to, 0, drag.key);
      return { ...prev, [section]: { ...sec, order } };
    });
  }

  function addCustomField(section: string) {
    const label = (newLabels[section] ?? "").trim();
    if (!label) return;
    const key = `c_${uid()}`;
    const type = newTypes[section] ?? "text";
    setDraft((prev) => {
      const sec = prev[section] ?? {};
      return {
        ...prev,
        [section]: {
          ...sec,
          custom: [...(sec.custom ?? []), { key, label, type }],
          order: [...(sec.order ?? []), key],
        },
      };
    });
    setNewLabels((p) => ({ ...p, [section]: "" }));
  }

  function removeCustomField(section: string, key: string) {
    setDraft((prev) => {
      const sec = prev[section] ?? {};
      return {
        ...prev,
        [section]: {
          ...sec,
          custom: (sec.custom ?? []).filter((c) => c.key !== key),
          order: (sec.order ?? []).filter((k) => k !== key),
        },
      };
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white rounded-xl max-w-2xl w-full max-h-[88vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Configure daily log columns</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Drag columns to reorder, toggle visibility, or add custom fields per section. Applies to this project for all users.
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700" aria-label="Close">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {SECTION_FIELD_DEFS.map((section) => {
            const order = draft[section.key]?.order ?? [];
            return (
              <div key={section.key} className="border border-gray-200 rounded-lg p-3">
                <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">{section.label}</p>
                <div className="space-y-1">
                  {order.map((key) => {
                    const f = fieldFor(section.key, key);
                    if (!f) return null;
                    const dragging = drag?.section === section.key && drag.key === key;
                    return (
                      <div
                        key={key}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.effectAllowed = "move";
                          setDrag({ section: section.key, key });
                        }}
                        onDragOver={(e) => e.preventDefault()}
                        onDragEnter={() => moveDraggedTo(section.key, key)}
                        onDragEnd={() => setDrag(null)}
                        onDrop={(e) => { e.preventDefault(); setDrag(null); }}
                        className={`flex items-center gap-2.5 px-2 py-1.5 border rounded-md bg-white cursor-grab active:cursor-grabbing ${
                          dragging ? "opacity-50 border-gray-400 shadow-sm" : "border-gray-200"
                        }`}
                      >
                        <svg className="w-3.5 h-3.5 text-gray-300 shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
                          <circle cx="7" cy="5" r="1.3" /><circle cx="13" cy="5" r="1.3" />
                          <circle cx="7" cy="10" r="1.3" /><circle cx="13" cy="10" r="1.3" />
                          <circle cx="7" cy="15" r="1.3" /><circle cx="13" cy="15" r="1.3" />
                        </svg>
                        <span className={`flex-1 text-xs ${f.isCustom || !isHidden(section.key, key) ? "text-gray-800" : "text-gray-400 line-through"}`}>
                          {f.label}
                        </span>
                        {f.isCustom ? (
                          <>
                            <span className="text-[10px] uppercase tracking-wide text-gray-400 border border-gray-200 rounded px-1.5 py-0.5">
                              {CUSTOM_FIELD_TYPES.find((t) => t.value === (f.type ?? "text"))?.label ?? "Text"}
                            </span>
                            <span className="text-[10px] uppercase tracking-wide text-[color:var(--brand-600,#2C7B8C)]">Custom</span>
                            <button
                              type="button"
                              onClick={() => removeCustomField(section.key, key)}
                              className="p-0.5 text-gray-400 hover:text-red-500"
                              aria-label={`Remove ${f.label}`}
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </>
                        ) : (
                          <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-gray-500">
                            <input
                              type="checkbox"
                              checked={!isHidden(section.key, key)}
                              onChange={() => toggleField(section.key, key)}
                              className="rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                            />
                            Visible
                          </label>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="mt-2.5 flex items-center gap-2">
                  <input
                    value={newLabels[section.key] ?? ""}
                    onChange={(e) => setNewLabels((p) => ({ ...p, [section.key]: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomField(section.key); } }}
                    placeholder="New custom field name..."
                    className={`${inCls} max-w-[220px]`}
                  />
                  <select
                    value={newTypes[section.key] ?? "text"}
                    onChange={(e) => setNewTypes((p) => ({ ...p, [section.key]: e.target.value as FieldType }))}
                    className={`${selCls} w-auto`}
                    aria-label="Custom field type"
                  >
                    {CUSTOM_FIELD_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => addCustomField(section.key)}
                    disabled={!(newLabels[section.key] ?? "").trim()}
                    className="px-2.5 py-1 text-xs font-semibold text-gray-700 border border-gray-200 bg-white rounded-md hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Add field
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-100 bg-gray-50/40">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-gray-700 border border-gray-200 bg-white rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(draft)}
            disabled={saving}
            className="px-4 py-1.5 text-sm font-semibold text-white bg-[color:var(--ink)] rounded-md hover:bg-black disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const DAILY_LOG_SECTIONS = [
  { id: "photos", label: "Photos" },
  { id: "manpower", label: "Manpower" },
  { id: "inspections", label: "Inspections" },
  { id: "deliveries", label: "Deliveries" },
  { id: "visitors", label: "Visitors" },
  { id: "safety-violations", label: "Safety Violations" },
  { id: "accidents", label: "Accidents" },
  { id: "delays", label: "Delays" },
  { id: "notes", label: "Notes" },
  { id: "observed-weather", label: "Observed Weather Conditions" },
] as const;

export default function DailyLogClient({
  projectId,
  role,
  username,
  companyRole = "",
}: {
  projectId: string;
  role: string;
  username: string;
  companyRole?: string;
}) {
  const searchParams = useSearchParams();
  const requestedDate = searchParams.get("date");
  const initialDate = isValidISODate(requestedDate) ? requestedDate : todayISO();

  const [date, setDate] = useState(initialDate);
  const [form, setForm] = useState<LogForm>(emptyForm(initialDate));
  const [logId, setLogId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [savedOnce, setSavedOnce] = useState(false);
  const [companySuggestions, setCompanySuggestions] = useState<string[]>([]);
  const [photoAlbums, setPhotoAlbums] = useState<PhotoAlbum[]>([]);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [fieldConfig, setFieldConfig] = useState<DailyLogFieldConfig>({});
  const [configOpen, setConfigOpen] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);
  const isSuperAdmin = companyRole === "super_admin";

  const formRef = useRef<LogForm>(emptyForm(initialDate));
  const logIdRef = useRef<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadLog(date);
  }, [date]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetch(`/api/projects/${projectId}/directory`)
      .then((r) => r.ok ? r.json() : [])
      .then((contacts: { type: string; company: string | null }[]) => {
        const names = Array.from(
          new Set(
            contacts
              .map((c) => c.company)
              .filter((name): name is string => !!name),
          ),
        ).sort((a, b) => a.localeCompare(b));
        setCompanySuggestions(names);
      })
      .catch(() => {});
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetch(`/api/projects/${projectId}/photo-albums`)
      .then((r) => (r.ok ? r.json() : []))
      .then((albums: PhotoAlbum[]) => {
        setPhotoAlbums(Array.isArray(albums) ? albums : []);
      })
      .catch(() => {});
  }, [projectId]);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/daily-log-config`)
      .then((r) => (r.ok ? r.json() : { config: {} }))
      .then((d: { config?: DailyLogFieldConfig }) => setFieldConfig(d?.config ?? {}))
      .catch(() => {});
  }, [projectId]);

  async function handleSaveConfig(next: DailyLogFieldConfig) {
    setConfigSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/daily-log-config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: next }),
      });
      if (res.ok) {
        const data = await res.json();
        setFieldConfig(data.config ?? next);
        setConfigOpen(false);
      }
    } finally {
      setConfigSaving(false);
    }
  }

  async function loadLog(d: string) {
    setLoading(true);
    setLogId(null);
    logIdRef.current = null;
    setDirty(false);
    setSavedOnce(false);
    try {
      const res = await fetch(`/api/projects/${projectId}/daily-log?date=${d}`);
      if (res.ok) {
        const data = await res.json();
        if (data) {
          const loaded: LogForm = {
            ...emptyForm(d),
            ...data,
            note_entries: data.note_entries ?? [],
            weather_observations: data.weather_observations ?? [],
          };
          setForm(loaded);
          formRef.current = loaded;
          setLogId(data.id);
          logIdRef.current = data.id;
          setSavedOnce(true);
          if (d === todayISO() && !loaded.weather_conditions && !loaded.weather_temp) {
            fetchAndPrefillWeather(d, data.id, loaded);
          }
        } else {
          const empty = emptyForm(d);
          setForm(empty);
          formRef.current = empty;
          if (d === todayISO()) {
            fetchAndPrefillWeather(d, null, empty);
          }
        }
      } else {
        const empty = emptyForm(d);
        setForm(empty);
        formRef.current = empty;
      }
    } finally {
      setLoading(false);
    }
  }

  async function fetchAndPrefillWeather(d: string, currentLogId: string | null, currentForm: LogForm) {
    try {
      const projRes = await fetch(`/api/projects/${projectId}`);
      if (!projRes.ok) return;
      const proj = await projRes.json();
      const location = [proj.city, proj.state].filter(Boolean).join(", ");
      if (!location) return;

      const geoRes = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(location)}&format=json&limit=1`,
        { headers: { "User-Agent": "SiteCommand/1.0" } },
      );
      if (!geoRes.ok) return;
      const geoData = await geoRes.json();
      if (!geoData.length) return;
      const { lat, lon } = geoData[0];

      const wxRes = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,wind_speed_10m,weather_code,relative_humidity_2m&temperature_unit=fahrenheit&wind_speed_unit=mph`,
      );
      if (!wxRes.ok) return;
      const wxData = await wxRes.json();
      const c = wxData.current;

      const next: LogForm = {
        ...currentForm,
        weather_conditions: weatherCodeToCondition(c.weather_code),
        weather_temp: `${Math.round(c.temperature_2m)}°F`,
        weather_wind: `${Math.round(c.wind_speed_10m)} mph`,
        weather_humidity: `${Math.round(c.relative_humidity_2m)}%`,
      };
      setForm(next);
      formRef.current = next;
      await saveFormData(next, currentLogId);
    } catch {
      // silently fail — weather prefill is best-effort
    }
  }

  function patch<K extends keyof LogForm>(key: K, value: LogForm[K]) {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      formRef.current = next;
      return next;
    });
    setDirty(true);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveFormData(formRef.current, logIdRef.current);
    }, 800);
  }

  async function saveFormData(formData: LogForm, currentLogId: string | null) {
    setSaving(true);
    try {
      const payload = { ...formData, log_date: date };
      const res = currentLogId
        ? await fetch(`/api/projects/${projectId}/daily-log`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: currentLogId, ...payload }),
          })
        : await fetch(`/api/projects/${projectId}/daily-log`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
      if (res.ok) {
        const data = await res.json();
        setLogId(data.id);
        logIdRef.current = data.id;
        setDirty(false);
        setSavedOnce(true);
      }
    } finally {
      setSaving(false);
    }
  }

  function addToList(key: keyof LogForm, entry: unknown) {
    setForm((prev) => {
      const newForm = { ...prev, [key]: [...(prev[key] as unknown[]), entry] };
      void saveFormData(newForm, logIdRef.current);
      return newForm;
    });
  }

  function removeFromList(key: keyof LogForm, id: string) {
    setForm((prev) => {
      const newForm = {
        ...prev,
        [key]: (prev[key] as { id: string }[]).filter((e) => e.id !== id),
      };
      void saveFormData(newForm, logIdRef.current);
      return newForm;
    });
  }

  function updateInList(key: keyof LogForm, id: string, patch: Record<string, unknown>) {
    setForm((prev) => {
      const newForm = {
        ...prev,
        [key]: (prev[key] as ({ id: string } & Record<string, unknown>)[]).map((entry) =>
          entry.id === id ? { ...entry, ...patch } : entry
        ),
      };
      void saveFormData(newForm, logIdRef.current);
      return newForm;
    });
  }

  async function handleSave() {
    await saveFormData(form, logId);
  }

  function applyVoiceEntries(
    parsed: ParsedVoiceEntries,
    applyWeather: boolean,
    selections: Record<string, Set<number>>,
  ) {
    let next = formRef.current;
    if (applyWeather && parsed.weather) {
      const w = parsed.weather;
      next = {
        ...next,
        weather_conditions: w.conditions || next.weather_conditions,
        weather_temp: w.temperature || next.weather_temp,
        weather_wind: w.wind || next.weather_wind,
        weather_humidity: w.humidity || next.weather_humidity,
      };
    }
    for (const section of VOICE_SECTIONS) {
      const list = parsed[section.key] as Record<string, unknown>[] | undefined;
      const picked = selections[section.key];
      if (!list || !picked || picked.size === 0) continue;
      const additions = list
        .map((entry, i) => (picked.has(i) ? { id: uid(), ...entry } : null))
        .filter((x): x is Record<string, unknown> & { id: string } => x !== null);
      if (additions.length === 0) continue;
      const current = (next[section.formKey] as unknown[]) ?? [];
      next = { ...next, [section.formKey]: [...current, ...additions] };
    }
    setForm(next);
    formRef.current = next;
    setDirty(true);
    void saveFormData(next, logIdRef.current);
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }

  const isToday = date === todayISO();

  // Live tallies for the editorial stat strip
  const crewTotal = form.manpower.reduce((sum, e) => sum + (parseInt(e.workers) || 0), 0);
  const tradeCount = new Set(
    form.manpower.map((e) => e.company.trim().toLowerCase()).filter(Boolean),
  ).size;
  const hoursTotal = form.manpower.reduce(
    (sum, e) => sum + (parseInt(e.workers) || 0) * (parseFloat(e.hours) || 0),
    0,
  );
  const deliveryCount = form.deliveries.length;
  const issueCount = form.note_entries.filter((n) => n.is_issue).length;
  const safetyCount = form.safety_violations.length;
  const accidentCount = form.accidents.length;
  const openConcerns = issueCount + safetyCount + accidentCount;
  const longDate = new Date(date + "T00:00:00").toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      {/* Header */}
      <header className="bg-[#F9FAFB] border-b border-black/[0.06] px-6 h-14 flex items-center justify-between">
        <a href="/dashboard" className="text-sm font-semibold text-gray-900 hover:text-gray-600 transition-colors">
          SiteCommand
        </a>
        <div className="flex items-center gap-5">
          <span className="text-sm text-gray-400">{username}</span>
          <button onClick={handleLogout} className="text-sm text-gray-400 hover:text-gray-900 transition-colors">
            Logout
          </button>
        </div>
      </header>

      <ProjectNav projectId={projectId} />

      <main className="max-w-[1500px] mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <div className="crumbs mb-4">
          <a href={`/projects/${projectId}`}>Project</a>
          <span className="sep">/</span>
          <span>Daily Log</span>
          <span className="stamp">
            {loading
              ? "Loading…"
              : logId
              ? dirty
                ? "Unsaved changes"
                : saving
                ? "Saving…"
                : "Saved"
              : "No log yet"}
          </span>
        </div>

        {/* Editorial page head */}
        <div className="sec-row mb-6">
          <div>
            <h1 className="h2-warm">Daily log</h1>
            <p className="sub mt-1.5">
              <em>{isToday ? "Today's field journal" : "Field journal entry"}</em>
              <span className="sep">·</span>
              <span className="num">{longDate}</span>
              {crewTotal > 0 && (
                <>
                  <span className="sep">·</span>
                  <span className="num" style={{ color: "#047857" }}>{crewTotal}</span> on site
                </>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!isToday && (
              <button onClick={() => setDate(todayISO())} className="btn-quiet">
                Jump to today
              </button>
            )}
            {isSuperAdmin && (
              <button
                onClick={() => setConfigOpen(true)}
                className="btn-secondary"
                title="Configure daily log columns and custom fields"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
                </svg>
                Configure columns
              </button>
            )}
            <button
              onClick={() => setVoiceOpen(true)}
              className="btn-secondary"
              title="Dictate entries with your voice"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 10v2a7 7 0 01-14 0v-2M12 19v4m-4 0h8" />
              </svg>
              Voice entry
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !dirty}
              className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? "Saving…" : savedOnce && !dirty ? "Saved" : "Save log"}
            </button>
          </div>
        </div>

        {/* Stat strip — live tallies for the day */}
        <div className="stats">
          <div className="stat calm">
            <div className="lbl">Crew on site</div>
            <div className="val">{crewTotal}</div>
            <div className="delta">
              {tradeCount} {tradeCount === 1 ? "trade" : "trades"} logged
            </div>
          </div>
          <div className="stat">
            <div className="lbl">Hours logged</div>
            <div className="val">{hoursTotal.toFixed(0)}</div>
            <div className="delta">Across {form.manpower.length} crew {form.manpower.length === 1 ? "entry" : "entries"}</div>
          </div>
          <div className={`stat${deliveryCount > 0 ? " warn" : ""}`}>
            <div className="lbl">Deliveries</div>
            <div className="val">{deliveryCount}</div>
            <div className="delta">{form.inspections.length} inspections recorded</div>
          </div>
          <div className={`stat${openConcerns > 0 ? " alert" : ""}`}>
            <div className="lbl">Open concerns</div>
            <div className="val">{openConcerns}</div>
            <div className="delta">
              {issueCount} {issueCount === 1 ? "issue" : "issues"} · {safetyCount} safety · {accidentCount} {accidentCount === 1 ? "accident" : "accidents"}
            </div>
          </div>
        </div>

        {/* Field-journal day head — serif numeral + weather strip */}
        <div className="log-entry mb-6">
          <div className="day-head">
            <span className="day">
              {new Date(date + "T00:00:00").getDate()}
            </span>
            <div>
              <div style={{ fontFamily: "DM Serif Display, serif", fontSize: 22 }}>
                {new Date(date + "T00:00:00").toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
              </div>
              <div className="sub-day">
                {form.weather_conditions || "Conditions not logged"}
                {" · Logged by "}
                {username}
              </div>
            </div>
            <span style={{ marginLeft: "auto" }} className="flex items-center gap-2">
              <button
                onClick={() => setDate(shiftDay(date, -1))}
                className="p-1.5 rounded-md border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 transition-colors"
                title="Previous day"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <input
                type="date"
                value={date}
                max={todayISO()}
                onChange={(e) => e.target.value && setDate(e.target.value)}
                className="font-mono text-xs text-gray-600 bg-white border border-gray-200 rounded-md px-2 py-1.5 outline-none cursor-pointer"
                style={{ colorScheme: "light" }}
              />
              <button
                onClick={() => setDate(shiftDay(date, 1))}
                disabled={isToday}
                className="p-1.5 rounded-md border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                title="Next day"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
              <span className={`chip ${isToday ? "chip-open" : "chip-closed"}`}>
                {isToday ? "Today" : "Past entry"}
              </span>
            </span>
          </div>

          {/* Weather strip */}
          <div className="weather">
            <div>
              <div className="lbl">Temp</div>
              <div className="val">{form.weather_temp || "—"}</div>
            </div>
            <div>
              <div className="lbl">Wind</div>
              <div className="val">{form.weather_wind || "—"}</div>
            </div>
            <div>
              <div className="lbl">Humidity</div>
              <div className="val">{form.weather_humidity || "—"}</div>
            </div>
            <div>
              <div className="lbl">Conditions</div>
              <div className="val" style={{ fontStyle: "italic", color: "#64748B", fontSize: 16 }}>
                {form.weather_conditions || "Not logged"}
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (
          <div className="lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-6">
            <aside className="hidden lg:block">
              <div className="sticky top-20 bg-white border hairline rounded-xl p-4">
                <p className="mono-label mb-3">Sections</p>
                <div className="space-y-0.5">
                  {DAILY_LOG_SECTIONS.map((section) => {
                    const count = (() => {
                      switch (section.id) {
                        case "photos": return form.photos.length;
                        case "manpower": return form.manpower.length;
                        case "inspections": return form.inspections.length;
                        case "deliveries": return form.deliveries.length;
                        case "visitors": return form.visitors.length;
                        case "safety-violations": return form.safety_violations.length;
                        case "accidents": return form.accidents.length;
                        case "delays": return form.delays.length;
                        case "notes": return form.note_entries.length;
                        case "observed-weather": return form.weather_observations.length + (form.weather_conditions ? 1 : 0);
                        default: return 0;
                      }
                    })();
                    const filled = count > 0;
                    return (
                      <a
                        key={section.id}
                        href={`#${section.id}`}
                        className="flex items-center gap-3 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-50 rounded-md px-2 py-1.5 transition-colors"
                      >
                        <span className={`step-dot ${filled ? "filled" : ""}`} aria-hidden />
                        <span className="flex-1 truncate">{section.label}</span>
                        {filled && (
                          <span className="mono-label tabular-nums">{count}</span>
                        )}
                      </a>
                    );
                  })}
                </div>
              </div>
            </aside>

            <div className="bg-white border border-gray-100 rounded-xl overflow-hidden divide-y divide-gray-100">
              <section id="photos" className="scroll-mt-24">
                <PhotosSection
                  projectId={projectId}
                  entries={form.photos}
                  onAdd={(e) => addToList("photos", e)}
                  onUpdate={(id, patch) => updateInList("photos", id, patch)}
                  albumOptions={photoAlbums.map((a) => a.name)}
                />
              </section>

              <section id="manpower" className="scroll-mt-24">
                <ManpowerSection
                  projectId={projectId}
                  entries={form.manpower}
                  onAdd={(e) => addToList("manpower", e)}
                  onDelete={(id) => removeFromList("manpower", id)}
                  companySuggestions={companySuggestions}
                  cfg={resolveSectionCfg(fieldConfig, "manpower")}
                />
              </section>

              <section id="inspections" className="scroll-mt-24">
                <InspectionsSection
                  projectId={projectId}
                  entries={form.inspections}
                  onAdd={(e) => addToList("inspections", e)}
                  onDelete={(id) => removeFromList("inspections", id)}
                  cfg={resolveSectionCfg(fieldConfig, "inspections")}
                />
              </section>

              <section id="deliveries" className="scroll-mt-24">
                <DeliveriesSection
                  projectId={projectId}
                  entries={form.deliveries}
                  onAdd={(e) => addToList("deliveries", e)}
                  onDelete={(id) => removeFromList("deliveries", id)}
                  cfg={resolveSectionCfg(fieldConfig, "deliveries")}
                />
              </section>

              <section id="visitors" className="scroll-mt-24">
                <VisitorsSection
                  projectId={projectId}
                  entries={form.visitors}
                  onAdd={(e) => addToList("visitors", e)}
                  onDelete={(id) => removeFromList("visitors", id)}
                  cfg={resolveSectionCfg(fieldConfig, "visitors")}
                />
              </section>

              <section id="safety-violations" className="scroll-mt-24">
                <SafetyViolationsSection
                  projectId={projectId}
                  entries={form.safety_violations}
                  onAdd={(e) => addToList("safety_violations", e)}
                  onDelete={(id) => removeFromList("safety_violations", id)}
                  cfg={resolveSectionCfg(fieldConfig, "safety_violations")}
                />
              </section>

              <section id="accidents" className="scroll-mt-24">
                <AccidentsSection
                  projectId={projectId}
                  entries={form.accidents}
                  onAdd={(e) => addToList("accidents", e)}
                  onDelete={(id) => removeFromList("accidents", id)}
                  cfg={resolveSectionCfg(fieldConfig, "accidents")}
                />
              </section>

              <section id="delays" className="scroll-mt-24">
                <DelaysSection
                  projectId={projectId}
                  entries={form.delays}
                  onAdd={(e) => addToList("delays", e)}
                  onDelete={(id) => removeFromList("delays", id)}
                  cfg={resolveSectionCfg(fieldConfig, "delays")}
                />
              </section>

              <section id="notes" className="scroll-mt-24">
                <NoteEntriesSection
                  projectId={projectId}
                  entries={form.note_entries}
                  onAdd={(e) => addToList("note_entries", e)}
                  onDelete={(id) => removeFromList("note_entries", id)}
                  cfg={resolveSectionCfg(fieldConfig, "note_entries")}
                />
              </section>

              <section id="observed-weather" className="scroll-mt-24">
                <WeatherSection
                  projectId={projectId}
                  form={form}
                  patch={patch}
                  observations={form.weather_observations}
                  onAddObs={(o) => addToList("weather_observations", o)}
                  onDeleteObs={(id) => removeFromList("weather_observations", id)}
                  cfg={resolveSectionCfg(fieldConfig, "weather_observations")}
                />
              </section>
            </div>
          </div>
        )}
      </main>

      {voiceOpen && (
        <VoiceLogModal
          projectId={projectId}
          companySuggestions={companySuggestions}
          onClose={() => setVoiceOpen(false)}
          onApply={applyVoiceEntries}
        />
      )}

      {configOpen && (
        <ConfigureColumnsModal
          config={fieldConfig}
          saving={configSaving}
          onClose={() => setConfigOpen(false)}
          onSave={handleSaveConfig}
        />
      )}
    </div>
  );
}
