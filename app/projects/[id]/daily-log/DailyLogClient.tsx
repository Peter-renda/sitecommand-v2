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
};

type DeliveryEntry = {
  id: string;
  time: string;
  delivery_from: string;
  tracking_number: string;
  contents: string;
  comments: string;
};

type VisitorEntry = {
  id: string;
  visitor: string;
  start_time: string;
  end_time: string;
  comments: string;
};

type SafetyViolationEntry = {
  id: string;
  time: string;
  subject: string;
  safety_notice: string;
  issued_to: string;
  compliance_due: string;
  comments: string;
};

type AccidentEntry = {
  id: string;
  time: string;
  party_involved: string;
  company_involved: string;
  comments: string;
};

type DelayEntry = {
  id: string;
  delay_type: string;
  start_time: string;
  end_time: string;
  duration_hours: string;
  location: string;
  comments: string;
};

type NoteEntry = {
  id: string;
  is_issue: boolean;
  location: string;
  comments: string;
};

type ManpowerEntry = {
  id: string;
  company: string;
  workers: string;
  hours: string;
  location: string;
  cost_code: string;
  comments: string;
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
      <div className="overflow-x-auto">
        <div className="min-w-full">{children}</div>
      </div>
    </div>
  );
}

// Shared input styles (compact, for inline form rows)
const inCls =
  "w-full px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-gray-900 disabled:bg-gray-50 disabled:text-gray-400 bg-white";
const selCls =
  "w-full px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-gray-900 bg-white";

// Label + input column used in both display rows and form rows
function Col({ label, minW, children }: { label: string; minW: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5" style={{ minWidth: minW }}>
      <span className="text-gray-400 font-medium uppercase tracking-wide text-[10px]">{label}</span>
      {children}
    </div>
  );
}

// A row that displays saved data (with delete button on hover)
function EntryRow({ children, onDelete }: {
  children: React.ReactNode; onDelete: () => void;
}) {
  return (
    <div className="px-4 py-3 border-b border-gray-50 hover:bg-gray-50/50 group">
      <div className="flex items-center gap-6 text-xs min-w-max">
        {children}
        <button
          onClick={onDelete}
          className="sticky right-0 ml-auto shrink-0 p-1 text-gray-200 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 bg-white/95"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// An always-visible form row at the bottom of a section
function FormRow({ onSubmit, children }: {
  onSubmit: () => void; children: React.ReactNode;
}) {
  return (
    <div className="px-4 py-3 border-t border-gray-100 bg-gray-50/40">
      <div className="inline-flex items-end gap-4 text-xs w-max min-w-full">
        {children}
        <div className="sticky right-0 ml-auto shrink-0 pb-0.5 pl-3 bg-gray-50/95 border-l border-gray-200">
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

// ── Inspections ──────────────────────────────────────────────────────────────

const emptyInspection = (): Omit<InspectionEntry, "id"> => ({
  start_time: "", end_time: "", inspection_type: "", inspecting_entity: "",
  inspector_name: "", location: "", inspection_area: "", comments: "",
});

function InspectionsSection({ entries, onAdd, onDelete }: {
  entries: InspectionEntry[];
  onAdd: (e: InspectionEntry) => void;
  onDelete: (id: string) => void;
}) {
  const [draft, setDraft] = useState(emptyInspection());
  const set = (f: keyof typeof draft, v: string) => setDraft((d) => ({ ...d, [f]: v }));

  function handleCreate() {
    onAdd({ id: uid(), ...draft });
    setDraft(emptyInspection());
  }

  return (
    <SectionCard title="Inspections">
      {entries.map((e) => (
        <EntryRow key={e.id} onDelete={() => onDelete(e.id)}>
          {e.inspection_type && <Col label="Type" minW="120px"><span className="text-gray-800 font-medium">{e.inspection_type}</span></Col>}
          {e.start_time && <Col label="Start" minW="60px"><span className="text-gray-700">{e.start_time}</span></Col>}
          {e.end_time && <Col label="End" minW="60px"><span className="text-gray-700">{e.end_time}</span></Col>}
          {e.inspecting_entity && <Col label="Entity" minW="110px"><span className="text-gray-700">{e.inspecting_entity}</span></Col>}
          {e.inspector_name && <Col label="Inspector" minW="110px"><span className="text-gray-700">{e.inspector_name}</span></Col>}
          {e.location && <Col label="Location" minW="100px"><span className="text-gray-700">{e.location}</span></Col>}
          {e.inspection_area && <Col label="Area" minW="100px"><span className="text-gray-700">{e.inspection_area}</span></Col>}
          {e.comments && <Col label="Comments" minW="140px"><span className="text-gray-500">{e.comments}</span></Col>}
        </EntryRow>
      ))}
      <FormRow onSubmit={handleCreate}>
        <Col label="Type" minW="120px"><input value={draft.inspection_type} onChange={(e) => set("inspection_type", e.target.value)} placeholder="e.g. Fire Safety" className={inCls} /></Col>
        <Col label="Start" minW="90px"><input type="time" value={draft.start_time} onChange={(e) => set("start_time", e.target.value)} className={inCls} /></Col>
        <Col label="End" minW="90px"><input type="time" value={draft.end_time} onChange={(e) => set("end_time", e.target.value)} className={inCls} /></Col>
        <Col label="Entity" minW="120px"><input value={draft.inspecting_entity} onChange={(e) => set("inspecting_entity", e.target.value)} placeholder="City Inspector" className={inCls} /></Col>
        <Col label="Inspector" minW="120px"><input value={draft.inspector_name} onChange={(e) => set("inspector_name", e.target.value)} placeholder="Full name" className={inCls} /></Col>
        <Col label="Location" minW="110px"><input value={draft.location} onChange={(e) => set("location", e.target.value)} placeholder="e.g. Level 3" className={inCls} /></Col>
        <Col label="Area" minW="110px"><input value={draft.inspection_area} onChange={(e) => set("inspection_area", e.target.value)} placeholder="e.g. Electrical" className={inCls} /></Col>
        <Col label="Comments" minW="160px"><input value={draft.comments} onChange={(e) => set("comments", e.target.value)} placeholder="Notes..." className={inCls} /></Col>
      </FormRow>
    </SectionCard>
  );
}

// ── Deliveries ───────────────────────────────────────────────────────────────

const emptyDelivery = (): Omit<DeliveryEntry, "id"> => ({
  time: "", delivery_from: "", tracking_number: "", contents: "", comments: "",
});

function DeliveriesSection({ entries, onAdd, onDelete }: {
  entries: DeliveryEntry[];
  onAdd: (e: DeliveryEntry) => void;
  onDelete: (id: string) => void;
}) {
  const [draft, setDraft] = useState(emptyDelivery());
  const set = (f: keyof typeof draft, v: string) => setDraft((d) => ({ ...d, [f]: v }));

  function handleCreate() {
    onAdd({ id: uid(), ...draft });
    setDraft(emptyDelivery());
  }

  return (
    <SectionCard title="Deliveries">
      {entries.map((e) => (
        <EntryRow key={e.id} onDelete={() => onDelete(e.id)}>
          {e.time && <Col label="Time" minW="60px"><span className="text-gray-700">{e.time}</span></Col>}
          {e.delivery_from && <Col label="From" minW="110px"><span className="text-gray-800 font-medium">{e.delivery_from}</span></Col>}
          {e.contents && <Col label="Contents" minW="120px"><span className="text-gray-700">{e.contents}</span></Col>}
          {e.tracking_number && <Col label="Tracking #" minW="100px"><span className="text-gray-700">{e.tracking_number}</span></Col>}
          {e.comments && <Col label="Comments" minW="140px"><span className="text-gray-500">{e.comments}</span></Col>}
        </EntryRow>
      ))}
      <FormRow onSubmit={handleCreate}>
        <Col label="Time" minW="90px"><input type="time" value={draft.time} onChange={(e) => set("time", e.target.value)} className={inCls} /></Col>
        <Col label="From" minW="130px"><input value={draft.delivery_from} onChange={(e) => set("delivery_from", e.target.value)} placeholder="Supplier / vendor" className={inCls} /></Col>
        <Col label="Contents" minW="140px"><input value={draft.contents} onChange={(e) => set("contents", e.target.value)} placeholder="Material description" className={inCls} /></Col>
        <Col label="Tracking #" minW="120px"><input value={draft.tracking_number} onChange={(e) => set("tracking_number", e.target.value)} placeholder="Optional" className={inCls} /></Col>
        <Col label="Comments" minW="160px"><input value={draft.comments} onChange={(e) => set("comments", e.target.value)} placeholder="Notes..." className={inCls} /></Col>
      </FormRow>
    </SectionCard>
  );
}

// ── Visitors ─────────────────────────────────────────────────────────────────

const emptyVisitor = (): Omit<VisitorEntry, "id"> => ({
  visitor: "", start_time: "", end_time: "", comments: "",
});

function VisitorsSection({ entries, onAdd, onDelete }: {
  entries: VisitorEntry[];
  onAdd: (e: VisitorEntry) => void;
  onDelete: (id: string) => void;
}) {
  const [draft, setDraft] = useState(emptyVisitor());
  const set = (f: keyof typeof draft, v: string) => setDraft((d) => ({ ...d, [f]: v }));

  function handleCreate() {
    onAdd({ id: uid(), ...draft });
    setDraft(emptyVisitor());
  }

  return (
    <SectionCard title="Visitors">
      {entries.map((e) => (
        <EntryRow key={e.id} onDelete={() => onDelete(e.id)}>
          {e.visitor && <Col label="Visitor" minW="140px"><span className="text-gray-800 font-medium">{e.visitor}</span></Col>}
          {e.start_time && <Col label="Start" minW="60px"><span className="text-gray-700">{e.start_time}</span></Col>}
          {e.end_time && <Col label="End" minW="60px"><span className="text-gray-700">{e.end_time}</span></Col>}
          {e.comments && <Col label="Comments" minW="140px"><span className="text-gray-500">{e.comments}</span></Col>}
        </EntryRow>
      ))}
      <FormRow onSubmit={handleCreate}>
        <Col label="Visitor" minW="160px"><input value={draft.visitor} onChange={(e) => set("visitor", e.target.value)} placeholder="Name and company" className={inCls} /></Col>
        <Col label="Start" minW="90px"><input type="time" value={draft.start_time} onChange={(e) => set("start_time", e.target.value)} className={inCls} /></Col>
        <Col label="End" minW="90px"><input type="time" value={draft.end_time} onChange={(e) => set("end_time", e.target.value)} className={inCls} /></Col>
        <Col label="Comments" minW="180px"><input value={draft.comments} onChange={(e) => set("comments", e.target.value)} placeholder="Purpose of visit..." className={inCls} /></Col>
      </FormRow>
    </SectionCard>
  );
}

// ── Safety Violations ────────────────────────────────────────────────────────

const emptySafetyViolation = (): Omit<SafetyViolationEntry, "id"> => ({
  time: "", subject: "", safety_notice: "", issued_to: "", compliance_due: "", comments: "",
});

function SafetyViolationsSection({ entries, onAdd, onDelete }: {
  entries: SafetyViolationEntry[];
  onAdd: (e: SafetyViolationEntry) => void;
  onDelete: (id: string) => void;
}) {
  const [draft, setDraft] = useState(emptySafetyViolation());
  const set = (f: keyof typeof draft, v: string) => setDraft((d) => ({ ...d, [f]: v }));

  function handleCreate() {
    onAdd({ id: uid(), ...draft });
    setDraft(emptySafetyViolation());
  }

  return (
    <SectionCard title="Safety Violations">
      {entries.map((e) => (
        <EntryRow key={e.id} onDelete={() => onDelete(e.id)}>
          {e.subject && <Col label="Subject" minW="140px"><span className="text-gray-800 font-medium">{e.subject}</span></Col>}
          {e.time && <Col label="Time" minW="60px"><span className="text-gray-700">{e.time}</span></Col>}
          {e.issued_to && <Col label="Issued To" minW="110px"><span className="text-gray-700">{e.issued_to}</span></Col>}
          {e.safety_notice && <Col label="Notice" minW="90px"><span className="text-gray-700">{e.safety_notice}</span></Col>}
          {e.compliance_due && <Col label="Due" minW="90px"><span className="text-gray-700">{e.compliance_due}</span></Col>}
          {e.comments && <Col label="Comments" minW="140px"><span className="text-gray-500">{e.comments}</span></Col>}
        </EntryRow>
      ))}
      <FormRow onSubmit={handleCreate}>
        <Col label="Subject" minW="140px"><input value={draft.subject} onChange={(e) => set("subject", e.target.value)} placeholder="Brief description" className={inCls} /></Col>
        <Col label="Time" minW="90px"><input type="time" value={draft.time} onChange={(e) => set("time", e.target.value)} className={inCls} /></Col>
        <Col label="Issued To" minW="120px"><input value={draft.issued_to} onChange={(e) => set("issued_to", e.target.value)} placeholder="Person / company" className={inCls} /></Col>
        <Col label="Notice #" minW="100px"><input value={draft.safety_notice} onChange={(e) => set("safety_notice", e.target.value)} placeholder="Notice # or type" className={inCls} /></Col>
        <Col label="Due" minW="110px"><input type="date" value={draft.compliance_due} onChange={(e) => set("compliance_due", e.target.value)} className={inCls} /></Col>
        <Col label="Comments" minW="160px"><input value={draft.comments} onChange={(e) => set("comments", e.target.value)} placeholder="Details..." className={inCls} /></Col>
      </FormRow>
    </SectionCard>
  );
}

// ── Accidents ────────────────────────────────────────────────────────────────

const emptyAccident = (): Omit<AccidentEntry, "id"> => ({
  time: "", party_involved: "", company_involved: "", comments: "",
});

function AccidentsSection({ entries, onAdd, onDelete }: {
  entries: AccidentEntry[];
  onAdd: (e: AccidentEntry) => void;
  onDelete: (id: string) => void;
}) {
  const [draft, setDraft] = useState(emptyAccident());
  const set = (f: keyof typeof draft, v: string) => setDraft((d) => ({ ...d, [f]: v }));

  function handleCreate() {
    onAdd({ id: uid(), ...draft });
    setDraft(emptyAccident());
  }

  return (
    <SectionCard title="Accidents">
      {entries.map((e) => (
        <EntryRow key={e.id} onDelete={() => onDelete(e.id)}>
          {e.time && <Col label="Time" minW="60px"><span className="text-gray-700">{e.time}</span></Col>}
          {e.party_involved && <Col label="Party Involved" minW="110px"><span className="text-gray-800 font-medium">{e.party_involved}</span></Col>}
          {e.company_involved && <Col label="Company" minW="110px"><span className="text-gray-700">{e.company_involved}</span></Col>}
          {e.comments && <Col label="Comments" minW="140px"><span className="text-gray-500">{e.comments}</span></Col>}
        </EntryRow>
      ))}
      <FormRow onSubmit={handleCreate}>
        <Col label="Time" minW="90px"><input type="time" value={draft.time} onChange={(e) => set("time", e.target.value)} className={inCls} /></Col>
        <Col label="Party Involved" minW="140px"><input value={draft.party_involved} onChange={(e) => set("party_involved", e.target.value)} placeholder="Person's name" className={inCls} /></Col>
        <Col label="Company" minW="130px"><input value={draft.company_involved} onChange={(e) => set("company_involved", e.target.value)} placeholder="Company name" className={inCls} /></Col>
        <Col label="Comments" minW="180px"><input value={draft.comments} onChange={(e) => set("comments", e.target.value)} placeholder="Describe the incident..." className={inCls} /></Col>
      </FormRow>
    </SectionCard>
  );
}

// ── Delays ───────────────────────────────────────────────────────────────────

const emptyDelay = (): Omit<DelayEntry, "id"> => ({
  delay_type: "", start_time: "", end_time: "", duration_hours: "", location: "", comments: "",
});

function DelaysSection({ entries, onAdd, onDelete }: {
  entries: DelayEntry[];
  onAdd: (e: DelayEntry) => void;
  onDelete: (id: string) => void;
}) {
  const [draft, setDraft] = useState(emptyDelay());

  function setField(f: keyof typeof draft, v: string) {
    setDraft((d) => {
      const updated = { ...d, [f]: v };
      if (f === "start_time" || f === "end_time") {
        updated.duration_hours = calcDurationHours(
          f === "start_time" ? v : d.start_time,
          f === "end_time" ? v : d.end_time,
        );
      }
      return updated;
    });
  }

  function handleCreate() {
    onAdd({ id: uid(), ...draft });
    setDraft(emptyDelay());
  }

  const totalHours = entries.reduce((sum, e) => sum + (parseFloat(e.duration_hours) || 0), 0);

  return (
    <SectionCard title="Delays" badge={`${totalHours.toFixed(2)} Total Hours`}>
      {entries.map((e) => (
        <EntryRow key={e.id} onDelete={() => onDelete(e.id)}>
          {e.delay_type && <Col label="Type" minW="110px"><span className="text-gray-800 font-medium">{e.delay_type}</span></Col>}
          {e.start_time && <Col label="Start" minW="60px"><span className="text-gray-700">{e.start_time}</span></Col>}
          {e.end_time && <Col label="End" minW="60px"><span className="text-gray-700">{e.end_time}</span></Col>}
          {e.duration_hours && <Col label="Duration" minW="70px"><span className="text-gray-700">{e.duration_hours}h</span></Col>}
          {e.location && <Col label="Location" minW="100px"><span className="text-gray-700">{e.location}</span></Col>}
          {e.comments && <Col label="Comments" minW="140px"><span className="text-gray-500">{e.comments}</span></Col>}
        </EntryRow>
      ))}
      <FormRow onSubmit={handleCreate}>
        <Col label="Type" minW="130px">
          <select value={draft.delay_type} onChange={(e) => setField("delay_type", e.target.value)} className={selCls}>
            {DELAY_TYPES.map((t) => <option key={t} value={t}>{t || "— Select —"}</option>)}
          </select>
        </Col>
        <Col label="Start" minW="90px"><input type="time" value={draft.start_time} onChange={(e) => setField("start_time", e.target.value)} className={inCls} /></Col>
        <Col label="End" minW="90px"><input type="time" value={draft.end_time} onChange={(e) => setField("end_time", e.target.value)} className={inCls} /></Col>
        <Col label="Duration" minW="90px"><input value={draft.duration_hours} readOnly disabled placeholder="Auto" className={inCls} /></Col>
        <Col label="Location" minW="120px"><input value={draft.location} onChange={(e) => setField("location", e.target.value)} placeholder="Area affected" className={inCls} /></Col>
        <Col label="Comments" minW="160px"><input value={draft.comments} onChange={(e) => setField("comments", e.target.value)} placeholder="Cause and impact..." className={inCls} /></Col>
      </FormRow>
    </SectionCard>
  );
}

// ── Notes ────────────────────────────────────────────────────────────────────

const emptyNoteEntry = (): Omit<NoteEntry, "id"> => ({
  is_issue: false, location: "", comments: "",
});

function NoteEntriesSection({ entries, onAdd, onDelete }: {
  entries: NoteEntry[];
  onAdd: (e: NoteEntry) => void;
  onDelete: (id: string) => void;
}) {
  const [draft, setDraft] = useState(emptyNoteEntry());

  function handleCreate() {
    onAdd({ id: uid(), ...draft });
    setDraft(emptyNoteEntry());
  }

  return (
    <SectionCard title="Notes">
      {entries.map((e) => (
        <EntryRow key={e.id} onDelete={() => onDelete(e.id)}>
          <Col label="Flag" minW="50px">
            {e.is_issue
              ? <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-red-50 text-red-700">Issue</span>
              : <span className="text-gray-400">—</span>
            }
          </Col>
          {e.location && <Col label="Location" minW="110px"><span className="text-gray-700">{e.location}</span></Col>}
          {e.comments && <Col label="Note" minW="200px"><span className="text-gray-600">{e.comments}</span></Col>}
        </EntryRow>
      ))}
      <FormRow onSubmit={handleCreate}>
        <Col label="Issue?" minW="60px">
          <label className="flex items-center gap-1.5 cursor-pointer py-1">
            <input
              type="checkbox"
              checked={draft.is_issue}
              onChange={(e) => setDraft((d) => ({ ...d, is_issue: e.target.checked }))}
              className="rounded border-gray-300 text-gray-900 focus:ring-gray-900"
            />
            <span className="text-xs text-gray-600">Yes</span>
          </label>
        </Col>
        <Col label="Location" minW="140px"><input value={draft.location} onChange={(e) => setDraft((d) => ({ ...d, location: e.target.value }))} placeholder="Area or location" className={inCls} /></Col>
        <Col label="Note" minW="240px"><input value={draft.comments} onChange={(e) => setDraft((d) => ({ ...d, comments: e.target.value }))} placeholder="Note details..." className={inCls} /></Col>
      </FormRow>
    </SectionCard>
  );
}

// ── Manpower ─────────────────────────────────────────────────────────────────

const emptyManpower = (): Omit<ManpowerEntry, "id"> => ({
  company: "", workers: "", hours: "", location: "", cost_code: "", comments: "",
});

function ManpowerSection({ entries, onAdd, onDelete, companySuggestions }: {
  entries: ManpowerEntry[];
  onAdd: (e: ManpowerEntry) => void;
  onDelete: (id: string) => void;
  companySuggestions: string[];
}) {
  const [draft, setDraft] = useState(emptyManpower());
  const set = (f: keyof typeof draft, v: string) => setDraft((d) => ({ ...d, [f]: v }));

  function handleCreate() {
    onAdd({ id: uid(), ...draft });
    setDraft(emptyManpower());
  }

  const totalWorkers = entries.reduce((sum, e) => sum + (parseInt(e.workers) || 0), 0);
  const totalHours = entries.reduce(
    (sum, e) => sum + (parseInt(e.workers) || 0) * (parseFloat(e.hours) || 0),
    0,
  );
  const draftTotalHours =
    draft.workers && draft.hours
      ? ((parseInt(draft.workers) || 0) * (parseFloat(draft.hours) || 0)).toFixed(1)
      : "";

  return (
    <SectionCard
      title="Manpower"
      badge={`${totalWorkers} Workers | ${totalHours.toFixed(1)} Total Hours`}
    >
      {entries.map((e) => (
        <EntryRow key={e.id} onDelete={() => onDelete(e.id)}>
          <Col label="Company" minW="120px"><span className="text-gray-800 font-medium">{e.company || "—"}</span></Col>
          <Col label="Workers" minW="60px"><span className="text-gray-700">{e.workers || "—"}</span></Col>
          <Col label="Hrs/Worker" minW="70px"><span className="text-gray-700">{e.hours || "—"}</span></Col>
          <Col label="Total Hrs" minW="70px"><span className="text-gray-700">{((parseInt(e.workers) || 0) * (parseFloat(e.hours) || 0)).toFixed(1)}h</span></Col>
          <Col label="Location" minW="100px"><span className="text-gray-700">{e.location || "—"}</span></Col>
          <Col label="Cost Code" minW="80px"><span className="text-gray-700">{e.cost_code || "—"}</span></Col>
          <Col label="Comments" minW="140px"><span className="text-gray-500">{e.comments || "—"}</span></Col>
        </EntryRow>
      ))}
      <FormRow onSubmit={handleCreate}>
        <Col label="Company" minW="150px">
          <input
            list="manpower-companies"
            value={draft.company}
            onChange={(e) => set("company", e.target.value)}
            placeholder="Trade / company"
            className={inCls}
          />
          <datalist id="manpower-companies">
            {companySuggestions.map((name) => <option key={name} value={name} />)}
          </datalist>
        </Col>
        <Col label="Workers" minW="70px"><input type="number" min="0" value={draft.workers} onChange={(e) => set("workers", e.target.value)} placeholder="0" className={inCls} /></Col>
        <Col label="Hrs/Worker" minW="80px"><input type="number" min="0" step="0.5" value={draft.hours} onChange={(e) => set("hours", e.target.value)} placeholder="0" className={inCls} /></Col>
        <Col label="Total Hrs" minW="80px"><input value={draftTotalHours} readOnly disabled placeholder="Auto" className={inCls} /></Col>
        <Col label="Location" minW="120px"><input value={draft.location} onChange={(e) => set("location", e.target.value)} placeholder="Work area" className={inCls} /></Col>
        <Col label="Cost Code" minW="100px"><input value={draft.cost_code} onChange={(e) => set("cost_code", e.target.value)} placeholder="Optional" className={inCls} /></Col>
        <Col label="Comments" minW="160px"><input value={draft.comments} onChange={(e) => set("comments", e.target.value)} placeholder="Optional notes..." className={inCls} /></Col>
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
  form, patch, observations, onAddObs, onDeleteObs,
}: {
  form: LogForm;
  patch: <K extends keyof LogForm>(key: K, value: LogForm[K]) => void;
  observations: WeatherObservation[];
  onAddObs: (o: WeatherObservation) => void;
  onDeleteObs: (id: string) => void;
}) {
  const [draft, setDraft] = useState(emptyWeatherObs());
  const set = (f: keyof typeof draft, v: string) => setDraft((d) => ({ ...d, [f]: v }));

  function handleCreate() {
    onAddObs({ id: uid(), ...draft });
    setDraft(emptyWeatherObs());
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
        <div className="grid grid-cols-3 gap-3">
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
            {o.time_observed && <Col label="Time" minW="60px"><span className="text-gray-800 font-medium">{o.time_observed}</span></Col>}
            {o.sky && <Col label="Sky" minW="80px"><span className="text-gray-700">{o.sky}</span></Col>}
            {o.temperature && <Col label="Temp" minW="70px"><span className="text-gray-700">{o.temperature}</span></Col>}
            {o.wind && <Col label="Wind" minW="80px"><span className="text-gray-700">{o.wind}</span></Col>}
            {o.avg_precipitation && <Col label="Precip" minW="80px"><span className="text-gray-700">{o.avg_precipitation}</span></Col>}
            {o.ground_sea && <Col label="Ground" minW="70px"><span className="text-gray-700">{o.ground_sea}</span></Col>}
            {o.calamity && <Col label="Calamity" minW="90px"><span className="text-gray-700">{o.calamity}</span></Col>}
            {o.delay && (
              <Col label="Delay" minW="70px">
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-yellow-50 text-yellow-700">Weather</span>
              </Col>
            )}
            {o.comments && <Col label="Comments" minW="140px"><span className="text-gray-500">{o.comments}</span></Col>}
          </EntryRow>
        ))}

        <FormRow onSubmit={handleCreate}>
          <Col label="Time" minW="90px"><input type="time" value={draft.time_observed} onChange={(e) => set("time_observed", e.target.value)} className={inCls} /></Col>
          <Col label="Sky" minW="110px">
            <select value={draft.sky} onChange={(e) => set("sky", e.target.value)} className={selCls}>
              {SKY_OPTIONS.map((s) => <option key={s} value={s}>{s || "— Select —"}</option>)}
            </select>
          </Col>
          <Col label="Temp" minW="90px"><input value={draft.temperature} onChange={(e) => set("temperature", e.target.value)} placeholder="e.g. 68°F" className={inCls} /></Col>
          <Col label="Wind" minW="110px"><input value={draft.wind} onChange={(e) => set("wind", e.target.value)} placeholder="e.g. 15 mph NE" className={inCls} /></Col>
          <Col label="Precip" minW="110px"><input value={draft.avg_precipitation} onChange={(e) => set("avg_precipitation", e.target.value)} placeholder="e.g. Light rain" className={inCls} /></Col>
          <Col label="Ground" minW="90px"><input value={draft.ground_sea} onChange={(e) => set("ground_sea", e.target.value)} placeholder="e.g. Wet" className={inCls} /></Col>
          <Col label="Calamity" minW="110px"><input value={draft.calamity} onChange={(e) => set("calamity", e.target.value)} placeholder="e.g. Flooding" className={inCls} /></Col>
          <Col label="Delay?" minW="60px">
            <label className="flex items-center gap-1.5 cursor-pointer py-1">
              <input
                type="checkbox"
                checked={draft.delay}
                onChange={(e) => setDraft((d) => ({ ...d, delay: e.target.checked }))}
                className="rounded border-gray-300 text-gray-900 focus:ring-gray-900"
              />
              <span className="text-xs text-gray-600">Yes</span>
            </label>
          </Col>
          <Col label="Comments" minW="160px"><input value={draft.comments} onChange={(e) => set("comments", e.target.value)} placeholder="Additional notes..." className={inCls} /></Col>
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
}: {
  projectId: string;
  role: string;
  username: string;
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

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }

  const isToday = date === todayISO();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-6 h-14 flex items-center justify-between">
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
        <div className="mb-5">
          <h1 className="font-display text-[32px] leading-[1.05] tracking-[-0.012em] text-[color:var(--ink)]">Daily Log</h1>
          <p className="sec-sub mt-1.5">
            <span className="serif-italic text-[color:var(--brand-700)]">{isToday ? "Today's entry" : "Viewing past entry"}</span>
            <span className="sep">·</span>
            <span className="num">{new Date(date + "T00:00:00").toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}</span>
          </p>
        </div>
        {/* Weather hero band — warm gradient + DM Serif temp */}
        <div className="bezel mb-6">
          <div className="bezel-inner weather-hero">
            <div className="relative z-[1] grid grid-cols-1 md:grid-cols-[1.4fr_1fr] gap-6 px-6 sm:px-8 py-6 sm:py-7">
              {/* Left: page heading + date nav */}
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <button
                    onClick={() => setDate(shiftDay(date, -1))}
                    className="p-2 rounded-md border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 transition-colors"
                    title="Previous day"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <div className="flex items-baseline gap-3">
                    <input
                      type="date"
                      value={date}
                      max={todayISO()}
                      onChange={(e) => e.target.value && setDate(e.target.value)}
                      className="font-display text-[28px] leading-none text-[color:var(--ink)] bg-transparent border-none outline-none cursor-pointer"
                      style={{ colorScheme: "light" }}
                    />
                    {isToday && <span className="pill pill-info">Today</span>}
                  </div>
                  <button
                    onClick={() => setDate(shiftDay(date, 1))}
                    disabled={isToday}
                    className="p-2 rounded-md border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Next day"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
                <p className="text-xs text-gray-500">
                  {loading
                    ? "Loading..."
                    : logId
                    ? dirty
                      ? "Unsaved changes"
                      : `Log saved · ${savedOnce ? "stored" : ""}`
                    : "No log for this date yet"}
                </p>

                <div className="flex items-center gap-2 mt-5">
                  {!isToday && (
                    <button
                      onClick={() => setDate(todayISO())}
                      className="px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-md bg-white hover:bg-gray-50 transition-colors"
                    >
                      Jump to today
                    </button>
                  )}
                  <button
                    onClick={handleSave}
                    disabled={saving || !dirty}
                    className="px-4 py-2 text-sm font-semibold text-white bg-[color:var(--ink)] rounded-md hover:bg-black transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {saving ? "Saving..." : savedOnce && !dirty ? "Saved" : "Save log"}
                  </button>
                </div>
              </div>

              {/* Right: weather snapshot */}
              <div className="md:border-l md:hairline md:pl-8">
                <div className="flex items-baseline gap-3 mb-3">
                  <span className="font-display text-[44px] leading-none text-[color:var(--ink)] tabular-nums">
                    {form.weather_temp ? `${form.weather_temp}°` : "—"}
                  </span>
                  <span className="text-sm text-gray-600">
                    {form.weather_conditions || "No conditions logged"}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600">
                  {form.weather_wind && (
                    <div className="flex items-center gap-2">
                      <span className="mono-label">WIND</span>
                      <span>{form.weather_wind}</span>
                    </div>
                  )}
                  {form.weather_humidity && (
                    <div className="flex items-center gap-2">
                      <span className="mono-label">HUMIDITY</span>
                      <span>{form.weather_humidity}</span>
                    </div>
                  )}
                  {!form.weather_wind && !form.weather_humidity && (
                    <p className="text-xs text-gray-400 italic col-span-2">
                      Record wind, humidity and more below.
                    </p>
                  )}
                </div>
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
                  entries={form.manpower}
                  onAdd={(e) => addToList("manpower", e)}
                  onDelete={(id) => removeFromList("manpower", id)}
                  companySuggestions={companySuggestions}
                />
              </section>

              <section id="inspections" className="scroll-mt-24">
                <InspectionsSection
                  entries={form.inspections}
                  onAdd={(e) => addToList("inspections", e)}
                  onDelete={(id) => removeFromList("inspections", id)}
                />
              </section>

              <section id="deliveries" className="scroll-mt-24">
                <DeliveriesSection
                  entries={form.deliveries}
                  onAdd={(e) => addToList("deliveries", e)}
                  onDelete={(id) => removeFromList("deliveries", id)}
                />
              </section>

              <section id="visitors" className="scroll-mt-24">
                <VisitorsSection
                  entries={form.visitors}
                  onAdd={(e) => addToList("visitors", e)}
                  onDelete={(id) => removeFromList("visitors", id)}
                />
              </section>

              <section id="safety-violations" className="scroll-mt-24">
                <SafetyViolationsSection
                  entries={form.safety_violations}
                  onAdd={(e) => addToList("safety_violations", e)}
                  onDelete={(id) => removeFromList("safety_violations", id)}
                />
              </section>

              <section id="accidents" className="scroll-mt-24">
                <AccidentsSection
                  entries={form.accidents}
                  onAdd={(e) => addToList("accidents", e)}
                  onDelete={(id) => removeFromList("accidents", id)}
                />
              </section>

              <section id="delays" className="scroll-mt-24">
                <DelaysSection
                  entries={form.delays}
                  onAdd={(e) => addToList("delays", e)}
                  onDelete={(id) => removeFromList("delays", id)}
                />
              </section>

              <section id="notes" className="scroll-mt-24">
                <NoteEntriesSection
                  entries={form.note_entries}
                  onAdd={(e) => addToList("note_entries", e)}
                  onDelete={(id) => removeFromList("note_entries", id)}
                />
              </section>

              <section id="observed-weather" className="scroll-mt-24">
                <WeatherSection
                  form={form}
                  patch={patch}
                  observations={form.weather_observations}
                  onAddObs={(o) => addToList("weather_observations", o)}
                  onDeleteObs={(id) => removeFromList("weather_observations", id)}
                />
              </section>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
