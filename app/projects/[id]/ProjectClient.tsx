"use client";

import { useState, useEffect, useRef } from "react";
import ProjectNav from "@/components/ProjectNav";
import { Brand, Pill, WeatherGlyph } from "@/components/design-system/Primitives";

type Member = { id: string; username: string; email: string };

type DirectoryContact = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  job_title: string | null;
};

function contactName(c: DirectoryContact): string {
  const full = [c.first_name, c.last_name].filter(Boolean).join(" ");
  return full || c.email || "Unknown";
}

type ScheduleTask = {
  uid: number;
  name: string;
  outlineLevel: number;
  isSummary: boolean;
  isMilestone: boolean;
  start: string;
  finish: string;
  percentComplete: number;
};

type ActivityItem = {
  id: string;
  type: string;
  description: string;
  created_at: string;
  users: { username: string } | null;
};

type Project = {
  id: string;
  name: string;
  description: string | null;
  project_number: string | null;
  sector: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  county: string | null;
  value: number;
  status: string;
  created_at: string;
  photo_url: string | null;
  start_date: string | null;
  actual_start_date: string | null;
  completion_date: string | null;
  projected_finish_date: string | null;
  warranty_start_date: string | null;
  warranty_end_date: string | null;
  members: Member[];
};

type WeatherDay = {
  date: string;
  code: number;
  max: number;
  min: number;
  precip: number; // inches, rounded to nearest 0.1
};


// Local-timezone YYYY-MM-DD (toISOString shifts to UTC and can be a day off)
function localISODate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function timeAgo(timestamp: string): string {
  const seconds = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function weatherInfo(code: number): { label: string; glyph: "sun" | "cloud" | "rain" | "snow" | "storm" | "fog" | "unknown" } {
  if (code === 0) return { label: "Clear", glyph: "sun" };
  if (code <= 3) return { label: "Partly cloudy", glyph: "cloud" };
  if (code <= 48) return { label: "Foggy", glyph: "fog" };
  if (code <= 55) return { label: "Drizzle", glyph: "rain" };
  if (code <= 65) return { label: "Rain", glyph: "rain" };
  if (code <= 75) return { label: "Snow", glyph: "snow" };
  if (code <= 82) return { label: "Showers", glyph: "rain" };
  if (code <= 99) return { label: "Thunderstorm", glyph: "storm" };
  return { label: "Unknown", glyph: "unknown" };
}

function buildRainAlert(days: WeatherDay[]): string | null {
  const rainy = days.filter((d) => d.precip >= 0.2);
  if (rainy.length === 0) return null;

  const fmt = (d: WeatherDay) =>
    new Date(d.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long" });

  // Check if all rainy days are consecutive
  let consecutive = true;
  for (let i = 1; i < rainy.length; i++) {
    const prev = new Date(rainy[i - 1].date).getTime();
    const curr = new Date(rainy[i].date).getTime();
    if (curr - prev !== 86400000) { consecutive = false; break; }
  }

  const total = rainy.reduce((sum, d) => sum + d.precip, 0);
  const totalStr = `${total.toFixed(1)}"`;

  if (rainy.length === 1) return `Rain expected on ${fmt(rainy[0])} (${totalStr})`;
  if (consecutive) return `Rain expected ${fmt(rainy[0])} through ${fmt(rainy[rainy.length - 1])} (${totalStr} total)`;
  const names = rainy.map(fmt);
  return `Rain expected on ${names.slice(0, -1).join(", ")} and ${names[names.length - 1]} (${totalStr} total)`;
}

function WeatherWidget({ zipCode, onDays }: { zipCode: string; onDays?: (days: WeatherDay[]) => void }) {
  const [days, setDays] = useState<WeatherDay[]>([]);
  const [location, setLocation] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!zipCode) { setLoading(false); return; }

    async function fetchWeather() {
      try {
        const geoRes = await fetch(`https://api.zippopotam.us/us/${zipCode}`);
        if (!geoRes.ok) { setError("Invalid ZIP code"); setLoading(false); return; }
        const geoData = await geoRes.json();
        const place = geoData.places[0];
        const lat = parseFloat(place.latitude);
        const lon = parseFloat(place.longitude);
        setLocation(`${place["place name"]}, ${place["state abbreviation"]}`);

        const wxRes = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum&temperature_unit=fahrenheit&timezone=auto&forecast_days=7`
        );
        const wxData = await wxRes.json();
        const { time, weathercode, temperature_2m_max, temperature_2m_min, precipitation_sum } = wxData.daily;
        const loaded: WeatherDay[] = time.map((date: string, i: number) => ({
          date,
          code: weathercode[i],
          max: Math.round(temperature_2m_max[i]),
          min: Math.round(temperature_2m_min[i]),
          // precipitation_sum is in mm; convert to inches and round to nearest 0.1
          precip: Math.round((precipitation_sum[i] * 0.03937) * 10) / 10,
        }));
        setDays(loaded);
        onDays?.(loaded);
      } catch {
        setError("Failed to load weather");
      } finally {
        setLoading(false);
      }
    }

    fetchWeather();
  }, [zipCode]);

  if (!zipCode) return <p className="text-xs text-gray-400">No ZIP code set for this project.</p>;
  if (loading) return <p className="text-xs text-gray-400">Loading weather...</p>;
  if (error) return <p className="text-xs text-red-400">{error}</p>;

  return (
    <div>
      {location && <p className="text-xs text-gray-400 mb-3">{location}</p>}
      <div className="space-y-1.5">
        {days.map((day) => {
          const { glyph } = weatherInfo(day.code);
          const dayName = new Date(day.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short" });
          return (
            <div key={day.date} className="flex items-center justify-between py-1.5 px-3 bg-gray-50 rounded-lg">
              <span className="text-xs font-medium text-gray-600 w-9">{dayName}</span>
              <WeatherGlyph kind={glyph} />
              <div className="flex items-center gap-2 text-xs">
                <span className="w-10 text-right text-blue-500 font-medium">
                  {day.precip > 0 ? `${day.precip.toFixed(1)}"` : ""}
                </span>
                <span className="font-medium text-gray-900 w-8 text-right">{day.max}°</span>
                <span className="text-gray-400 w-6 text-right">{day.min}°</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MemberPicker({
  users,
  selected,
  onAdd,
  onRemove,
}: {
  users: Member[];
  selected: Member[];
  onAdd: (u: Member) => void;
  onRemove: (id: string) => void;
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

  const filtered = users.filter(
    (u) =>
      !selected.find((s) => s.id === u.id) &&
      (u.username.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div ref={ref} className="relative">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selected.map((u) => (
            <span key={u.id} className="flex items-center gap-1 pl-2.5 pr-1.5 py-1 bg-gray-100 text-xs text-gray-700 rounded-full">
              {u.username}
              <button type="button" onClick={() => onRemove(u.id)} className="text-gray-400 hover:text-gray-700 ml-0.5">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        type="text"
        value={search}
        onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="Search by name or email..."
        className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
      />
      {open && filtered.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-100 rounded-md shadow-lg max-h-40 overflow-y-auto z-20">
          {filtered.map((u) => (
            <button
              key={u.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onAdd(u); setSearch(""); }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2.5"
            >
              <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-semibold text-gray-600 shrink-0">
                {u.username[0].toUpperCase()}
              </div>
              <span className="font-medium text-gray-900">{u.username}</span>
              <span className="text-gray-400 text-xs">{u.email}</span>
            </button>
          ))}
        </div>
      )}
      {open && search && filtered.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-100 rounded-md shadow-lg px-3 py-2 z-20">
          <p className="text-xs text-gray-400">No matching team members</p>
        </div>
      )}
    </div>
  );
}

function DirectoryPicker({
  contacts,
  selected,
  onAdd,
  onRemove,
}: {
  contacts: DirectoryContact[];
  selected: DirectoryContact[];
  onAdd: (c: DirectoryContact) => void;
  onRemove: (id: string) => void;
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

  const filtered = contacts.filter((c) => {
    if (selected.find((s) => s.id === c.id)) return false;
    const q = search.toLowerCase();
    return (
      (c.first_name ?? "").toLowerCase().includes(q) ||
      (c.last_name ?? "").toLowerCase().includes(q) ||
      (c.email ?? "").toLowerCase().includes(q) ||
      (c.company ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div ref={ref} className="relative">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selected.map((c) => (
            <span key={c.id} className="flex items-center gap-1 pl-2.5 pr-1.5 py-1 bg-blue-50 text-xs text-blue-800 rounded-full border border-blue-100">
              {contactName(c)}
              <button type="button" onClick={() => onRemove(c.id)} className="text-blue-400 hover:text-blue-700 ml-0.5">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        type="text"
        value={search}
        onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="Start typing to search people..."
        className="w-full px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
      />
      {open && search && filtered.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-100 rounded-md shadow-lg max-h-44 overflow-y-auto z-30">
          {filtered.map((c) => (
            <button
              key={c.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onAdd(c); setSearch(""); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2.5"
            >
              <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-semibold text-gray-600 shrink-0">
                {contactName(c)[0]?.toUpperCase() ?? "?"}
              </div>
              <div className="min-w-0">
                <p className="font-medium text-gray-900 truncate">{contactName(c)}</p>
                {c.job_title || c.company ? (
                  <p className="text-xs text-gray-400 truncate">{[c.job_title, c.company].filter(Boolean).join(" · ")}</p>
                ) : c.email ? (
                  <p className="text-xs text-gray-400 truncate">{c.email}</p>
                ) : null}
              </div>
            </button>
          ))}
        </div>
      )}
      {open && search && filtered.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-100 rounded-md shadow-lg px-3 py-2 z-30">
          <p className="text-xs text-gray-400">No matching contacts</p>
        </div>
      )}
    </div>
  );
}

const PROJECT_ROLES = [
  "Project Manager",
  "Executive",
  "Superintendent",
  "Project Engineer",
  "Owner",
  "Architect/Engineer",
  "Assistant Superintendent",
  "HUD",
  "CDA",
  "HABC",
  "Assistant Estimator",
  "Senior Estimator",
  "Owner Contact",
];

export default function ProjectClient({
  projectId,
  role,
  username,
  companyRole = "",
  userId,
}: {
  projectId: string;
  role: string;
  username: string;
  companyRole?: string;
  userId?: string;
}) {
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [primeContractValue, setPrimeContractValue] = useState(0);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [rainAlert, setRainAlert] = useState<string | null>(null);
  const [openTaskAlerts, setOpenTaskAlerts] = useState<{ id: string; title: string }[]>([]);
  const [scheduleTasks, setScheduleTasks] = useState<ScheduleTask[]>([]);
  const [workTab, setWorkTab] = useState<"ongoing" | "upcoming">("ongoing");
  const [collapsedWorkUids, setCollapsedWorkUids] = useState<Set<number>>(new Set());
  const [recentActivityExpanded, setRecentActivityExpanded] = useState(false);
  const [lastLoginAt] = useState<number | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const stored = localStorage.getItem(`project_last_login_at:${projectId}`);
      if (!stored) return null;
      const parsed = Number(stored);
      return Number.isFinite(parsed) ? parsed : null;
    } catch {
      return null;
    }
  });
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editPhotoRef = useRef<HTMLInputElement>(null);

  // Edit modal state
  const [showEdit, setShowEdit] = useState(false);
  const [allUsers, setAllUsers] = useState<Member[]>([]);
  const [editName, setEditName] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editStateVal, setEditStateVal] = useState("");
  const [editZipCode, setEditZipCode] = useState("");
  const [editCounty, setEditCounty] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editValue, setEditValue] = useState("");
  const [editStatus, setEditStatus] = useState("bidding");
  const [editProjectNumber, setEditProjectNumber] = useState("");
  const [editSector, setEditSector] = useState("");
  const [editStartDate, setEditStartDate] = useState("");
  const [editActualStartDate, setEditActualStartDate] = useState("");
  const [editCompletionDate, setEditCompletionDate] = useState("");
  const [editProjectedFinishDate, setEditProjectedFinishDate] = useState("");
  const [editWarrantyStartDate, setEditWarrantyStartDate] = useState("");
  const [editWarrantyEndDate, setEditWarrantyEndDate] = useState("");
  const [editMembers, setEditMembers] = useState<Member[]>([]);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [addressSuggestions, setAddressSuggestions] = useState<{ display: string; street: string; city: string; state: string; zip: string }[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const addressDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const addressBoxRef = useRef<HTMLDivElement>(null);

  // Info card three-dot menu
  const [showInfoMenu, setShowInfoMenu] = useState(false);
  const infoMenuRef = useRef<HTMLDivElement>(null);

  // Project Roles state
  const [showRolesEdit, setShowRolesEdit] = useState(false);
  const [teamMenuOpen, setTeamMenuOpen] = useState(false);
  const [projectRoleAssignments, setProjectRoleAssignments] = useState<Record<string, DirectoryContact[]>>({});
  const [rolesSaving, setRolesSaving] = useState(false);
  const [rolesError, setRolesError] = useState("");
  const [directoryContacts, setDirectoryContacts] = useState<DirectoryContact[]>([]);
  const [teamRoles, setTeamRoles] = useState<{ contact: DirectoryContact; roleName: string }[]>([]);
  const teamMenuRef = useRef<HTMLDivElement>(null);

  function fetchActivity() {
    fetch(`/api/projects/${projectId}/activity`)
      .then((r) => r.json())
      .then((d) => setActivity(Array.isArray(d) ? d : []));
  }

  useEffect(() => {
    try {
      localStorage.setItem(`project_last_login_at:${projectId}`, String(Date.now()));
    } catch {}
  }, [projectId]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (teamMenuRef.current && !teamMenuRef.current.contains(e.target as Node)) {
        setTeamMenuOpen(false);
      }
      if (infoMenuRef.current && !infoMenuRef.current.contains(e.target as Node)) {
        setShowInfoMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function openRolesEdit() {
    setTeamMenuOpen(false);
    const [dirRes, rolesRes] = await Promise.all([
      fetch(`/api/projects/${projectId}/directory`),
      fetch(`/api/projects/${projectId}/roles`),
    ]);
    const contacts: DirectoryContact[] = await dirRes.json();
    const rolesData = await rolesRes.json();
    setDirectoryContacts(Array.isArray(contacts) ? contacts : []);
    const resolved: Record<string, DirectoryContact[]> = {};
    for (const roleName of PROJECT_ROLES) {
      const ids: string[] = rolesData[roleName] || [];
      resolved[roleName] = ids
        .map((id: string) => contacts.find((c) => c.id === id))
        .filter(Boolean) as DirectoryContact[];
    }
    setProjectRoleAssignments(resolved);
    setRolesError("");
    setShowRolesEdit(true);
  }

  async function handleRolesSave() {
    setRolesSaving(true);
    setRolesError("");
    const payload: Record<string, string[]> = {};
    for (const [r, contacts] of Object.entries(projectRoleAssignments)) {
      payload[r] = contacts.map((c) => c.id);
    }
    const res = await fetch(`/api/projects/${projectId}/roles`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setRolesSaving(false);
    if (!res.ok) { setRolesError("Failed to save roles"); return; }
    // Rebuild team tile from saved assignments
    const flat: { contact: DirectoryContact; roleName: string }[] = [];
    for (const roleName of PROJECT_ROLES) {
      for (const c of projectRoleAssignments[roleName] || []) {
        flat.push({ contact: c, roleName });
      }
    }
    setTeamRoles(flat);
    setShowRolesEdit(false);
  }

  useEffect(() => {
    fetch(`/api/projects/${projectId}`)
      .then((res) => {
        if (!res.ok) { setNotFound(true); setLoading(false); return null; }
        return res.json();
      })
      .then((data) => {
        if (data) {
          if (data.photo_url) {
            data.photo_url = data.photo_url.split("?")[0] + `?t=${Date.now()}`;
          }
          setProject(data);
          setLoading(false);
        }
      });
    fetchActivity();
    fetch(`/api/projects/${projectId}/schedule`)
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d.tasks)) setScheduleTasks(d.tasks); });

    if (userId) {
      fetch(`/api/projects/${projectId}/tasks`)
        .then((r) => r.json())
        .then((tasks: { id: string; title: string; status: string; assignees?: { id: string }[] }[]) => {
          if (!Array.isArray(tasks)) return;
          const alerts = tasks.filter(
            (t) => t.status === "open" && Array.isArray(t.assignees) && t.assignees.some((a) => a.id === userId)
          ).map((t) => ({ id: t.id, title: t.title }));
          setOpenTaskAlerts(alerts);
        });
    }

    // Sum revised contract amounts from prime contracts
    fetch(`/api/projects/${projectId}/prime-contracts`)
      .then((r) => r.ok ? r.json() : [])
      .then((contracts: { original_contract_amount?: number; approved_change_orders?: number }[]) => {
        if (!Array.isArray(contracts)) return;
        const total = contracts.reduce((sum, c) => sum + (c.original_contract_amount ?? 0) + (c.approved_change_orders ?? 0), 0);
        setPrimeContractValue(total);
      });

    // Load team roles for the team tile
    Promise.all([
      fetch(`/api/projects/${projectId}/roles`).then((r) => r.json()),
      fetch(`/api/projects/${projectId}/directory`).then((r) => r.json()),
    ]).then(([rolesData, contacts]) => {
      if (!rolesData || !Array.isArray(contacts)) return;
      const flat: { contact: DirectoryContact; roleName: string }[] = [];
      for (const roleName of PROJECT_ROLES) {
        const ids: string[] = rolesData[roleName] || [];
        for (const id of ids) {
          const c = contacts.find((x: DirectoryContact) => x.id === id);
          if (c) flat.push({ contact: c, roleName });
        }
      }
      setTeamRoles(flat);
    });
  }, [projectId]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !project) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("photo", file);

    const res = await fetch(`/api/projects/${project.id}/photo`, { method: "POST", body: formData });
    const data = await res.json();
    setUploading(false);

    if (res.ok) {
      setProject((prev) => prev ? { ...prev, photo_url: data.photo_url + `?t=${Date.now()}` } : prev);
    }
  }

  function openEdit() {
    if (!project) return;
    setEditName(project.name);
    setEditAddress(project.address || "");
    setEditCity(project.city || "");
    setEditStateVal(project.state || "");
    setEditZipCode(project.zip_code || "");
    setEditCounty(project.county || "");
    setEditDescription(project.description || "");
    setEditValue(project.value?.toString() || "");
    setEditStatus(project.status || "bidding");
    setEditProjectNumber(project.project_number || "");
    setEditSector(project.sector || "");
    setEditStartDate(project.start_date || "");
    setEditActualStartDate(project.actual_start_date || "");
    setEditCompletionDate(project.completion_date || "");
    setEditProjectedFinishDate(project.projected_finish_date || "");
    setEditWarrantyStartDate(project.warranty_start_date || "");
    setEditWarrantyEndDate(project.warranty_end_date || "");
    setEditMembers(project.members || []);
    setEditError("");
    setAddressSuggestions([]);
    setShowInfoMenu(false);
    fetch("/api/users").then((r) => r.json()).then((d) => setAllUsers(Array.isArray(d) ? d : []));
    setShowEdit(true);
  }

  function handleAddressInput(val: string) {
    setEditAddress(val);
    setShowSuggestions(true);
    if (addressDebounceRef.current) clearTimeout(addressDebounceRef.current);
    if (val.length < 3) { setAddressSuggestions([]); return; }
    addressDebounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(val)}&format=json&addressdetails=1&limit=5&countrycodes=us`,
          { headers: { "Accept-Language": "en" } }
        );
        const data = await res.json();
        const suggestions = (data as Record<string, unknown>[]).map((item) => {
          const addr = item.address as Record<string, string>;
          const street = [addr.house_number, addr.road].filter(Boolean).join(" ");
          return {
            display: item.display_name as string,
            street,
            city: addr.city || addr.town || addr.village || addr.suburb || addr.county || "",
            state: addr.state || "",
            zip: addr.postcode || "",
          };
        });
        setAddressSuggestions(suggestions);
      } catch { setAddressSuggestions([]); }
    }, 400);
  }

  function selectAddressSuggestion(s: { street: string; city: string; state: string; zip: string }) {
    setEditAddress(s.street);
    setEditCity(s.city);
    setEditStateVal(s.state);
    setEditZipCode(s.zip.slice(0, 5));
    setAddressSuggestions([]);
    setShowSuggestions(false);
  }

  async function handleEditSave(e: React.FormEvent) {
    e.preventDefault();
    if (!project) return;
    setEditSaving(true);
    setEditError("");

    const res = await fetch(`/api/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editName,
        address: editAddress,
        city: editCity,
        state: editStateVal,
        zip_code: editZipCode,
        county: editCounty,
        description: editDescription,
        value: editValue,
        status: editStatus,
        project_number: editProjectNumber,
        sector: editSector,
        start_date: editStartDate || null,
        actual_start_date: editActualStartDate || null,
        completion_date: editCompletionDate || null,
        projected_finish_date: editProjectedFinishDate || null,
        warranty_start_date: editWarrantyStartDate || null,
        warranty_end_date: editWarrantyEndDate || null,
        memberIds: editMembers.map((m) => m.id),
      }),
    });

    const data = await res.json();
    setEditSaving(false);

    if (!res.ok) { setEditError(data.error); return; }

    setProject((prev) => prev ? {
      ...prev,
      ...data,
      members: editMembers,
    } : prev);
    fetchActivity();
    setShowEdit(false);
  }

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      {/* Header */}
      <header className="bg-[#F9FAFB] border-b border-black/[0.06] px-4 sm:px-6 h-14 flex items-center justify-between">
        <a href="/dashboard" className="hover:opacity-80 transition-opacity shrink-0">
          <Brand />
        </a>
        <div className="flex items-center gap-3 sm:gap-5 min-w-0">
          <span className="hidden sm:block text-sm text-gray-400 truncate max-w-[120px]">{username}</span>
          <button onClick={handleLogout} className="text-sm text-gray-400 hover:text-gray-900 transition-colors shrink-0">Logout</button>
        </div>
      </header>

      {project && <ProjectNav projectId={project.id} showBackToProject={false} />}

      {rainAlert && (
        <div className="flex justify-center px-4 sm:px-6 py-3">
          <Pill className="pill-danger">
            <span>{rainAlert}</span>
            <button
              onClick={() => setRainAlert(null)}
              className="ml-1 -mr-1 flex items-center justify-center hover:opacity-70 transition-opacity"
              aria-label="Dismiss rain alert"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </Pill>
        </div>
      )}

      {openTaskAlerts.map((task) => (
        <div key={task.id} className="bg-yellow-50 border-b border-yellow-200 px-4 sm:px-6 py-3 flex items-center gap-3">
          <svg className="w-4 h-4 text-yellow-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <p className="text-sm font-medium text-yellow-800">
            Open task assigned to you:{" "}
            <a href={`/projects/${projectId}/tasks/${task.id}`} className="underline hover:text-yellow-900">
              {task.title}
            </a>
          </p>
        </div>
      ))}

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {loading ? (
          <p className="text-sm text-gray-400">Loading...</p>
        ) : notFound ? (
          <p className="text-sm text-gray-500">Project not found.</p>
        ) : project ? (
          <>
            {(() => {
              const workTasks = scheduleTasks.filter((t) => !t.isSummary && !t.isMilestone && t.start && t.finish);
              const completedTasks = workTasks.filter((t) => t.percentComplete >= 100).length;

              // Duration-weighted schedule percent complete
              let weightedPct = 0;
              let totalDuration = 0;
              for (const t of workTasks) {
                const start = new Date(t.start.slice(0, 10) + "T12:00:00").getTime();
                const finish = new Date(t.finish.slice(0, 10) + "T12:00:00").getTime();
                const days = Math.max(1, Math.round((finish - start) / 86400000) + 1);
                weightedPct += days * t.percentComplete;
                totalDuration += days;
              }
              const schedulePct = totalDuration > 0 ? Math.round(weightedPct / totalDuration) : null;

              // Start date: project dates first, then the earliest scheduled task
              const earliestTaskStart = workTasks.reduce<string | null>(
                (min, t) => (!min || t.start < min ? t.start : min),
                null,
              );
              const startDateValue = project.actual_start_date || project.start_date || earliestTaskStart;

              const fmtDate = (d: string) =>
                new Date(d.slice(0, 10) + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

              const cityStateZip = [
                [project.city, project.state].filter(Boolean).join(", "),
                project.zip_code,
              ].filter(Boolean).join(" ");
              const fullAddress = [project.address, cityStateZip].filter(Boolean).join(", ");

              return (
                <div className="home-hero">
                  <div className="eyebrow">
                    {[
                      "Project",
                      project.project_number || null,
                      project.sector || null,
                    ].filter(Boolean).join(" · ")}
                  </div>
                  <h1>{project.name}</h1>
                  <div className="sub-line">
                    {fullAddress && <em>{fullAddress}</em>}
                    {fullAddress && primeContractValue > 0 && (
                      <span style={{ color: "rgba(255,217,176,0.5)" }}>·</span>
                    )}
                    {primeContractValue > 0 && (
                      <span style={{ fontFamily: "JetBrains Mono, monospace" }}>
                        ${primeContractValue.toLocaleString()} contract
                      </span>
                    )}
                    {(primeContractValue > 0 || fullAddress) && (
                      <span style={{ color: "rgba(255,217,176,0.5)" }}>·</span>
                    )}
                    <span style={{ fontFamily: "JetBrains Mono, monospace", textTransform: "capitalize" }}>
                      {project.status || "active"}
                    </span>
                    {startDateValue && (
                      <>
                        <span style={{ color: "rgba(255,217,176,0.5)" }}>·</span>
                        <span style={{ fontFamily: "JetBrains Mono, monospace" }}>
                          Start: {fmtDate(startDateValue)}
                        </span>
                      </>
                    )}
                  </div>
                  <div className="row cols-3">
                    <div>
                      <div className="lbl">My open tasks</div>
                      <div className="val">{openTaskAlerts.length}</div>
                    </div>
                    <div>
                      <div className="lbl">Schedule</div>
                      <div className="val">{schedulePct == null ? "—" : `${schedulePct}% complete`}</div>
                    </div>
                    <div>
                      <div className="lbl">Tasks complete</div>
                      <div className="val">{workTasks.length > 0 ? `${completedTasks} of ${workTasks.length}` : "—"}</div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Two-column layout */}
            <div className="grid-2">

              {/* Left: Activity + Work */}
              <div>
                <h3 className="h3-warm">Today&apos;s activity</h3>
                <div className="card card-pad">
                  {activity.length === 0 ? (
                    <p className="text-sm text-gray-400">No activity yet.</p>
                  ) : (
                    <>
                      <div className="space-y-4">
                        {(recentActivityExpanded ? activity : activity.slice(0, 5)).map((item) => (
                          <div key={item.id} className="flex items-start gap-3">
                            <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${lastLoginAt !== null && new Date(item.created_at).getTime() > lastLoginAt ? "bg-[color:var(--brand-500)] animate-pulse" : "bg-gray-300"}`} />
                            <div>
                              <p className="text-sm text-gray-700">{item.description}</p>
                              <p className="text-xs text-gray-400 mt-0.5">
                                {item.users?.username && `${item.users.username} · `}
                                {timeAgo(item.created_at)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                      {activity.length > 5 && (
                        <button
                          onClick={() => setRecentActivityExpanded((x) => !x)}
                          className="btn-secondary mt-4 w-full"
                        >
                          {recentActivityExpanded ? "Show less" : `Show ${activity.length - 5} more`}
                        </button>
                      )}
                    </>
                  )}
                </div>

                {/* Ongoing / Upcoming Work */}
                {(() => {
                  const todayStr = localISODate(new Date());
                  const twoWeeksOut = new Date();
                  twoWeeksOut.setDate(twoWeeksOut.getDate() + 14);
                  const twoWeeksStr = localISODate(twoWeeksOut);

                  const dateOnly = (s: string) => s.slice(0, 10);
                  const matchesTab = (t: ScheduleTask) =>
                    workTab === "ongoing"
                      ? dateOnly(t.start) <= todayStr && dateOnly(t.finish) >= todayStr
                      : dateOnly(t.start) > todayStr && dateOnly(t.start) <= twoWeeksStr;

                  // Build the visible tree: matching leaf tasks plus the summary
                  // tasks (hierarchy) they sit under, preserving schedule order.
                  type WorkRow = {
                    task: ScheduleTask;
                    depth: number;
                    isSummary: boolean;
                    ancestorUids: number[];
                  };
                  const rows: WorkRow[] = [];
                  const stack: ScheduleTask[] = []; // current summary ancestor chain
                  const emittedSummaries = new Set<number>();
                  let leafCount = 0;
                  for (const t of scheduleTasks) {
                    while (stack.length > 0 && stack[stack.length - 1].outlineLevel >= t.outlineLevel) {
                      stack.pop();
                    }
                    if (t.isSummary) {
                      stack.push(t);
                      continue;
                    }
                    if (t.isMilestone || !t.start || !t.finish || !matchesTab(t)) continue;
                    stack.forEach((s, i) => {
                      if (!emittedSummaries.has(s.uid)) {
                        emittedSummaries.add(s.uid);
                        rows.push({
                          task: s,
                          depth: i,
                          isSummary: true,
                          ancestorUids: stack.slice(0, i).map((a) => a.uid),
                        });
                      }
                    });
                    rows.push({
                      task: t,
                      depth: stack.length,
                      isSummary: false,
                      ancestorUids: stack.map((a) => a.uid),
                    });
                    leafCount++;
                  }

                  const summaryUids = rows.filter((r) => r.isSummary).map((r) => r.task.uid);
                  const allCollapsed = summaryUids.length > 0 && summaryUids.every((u) => collapsedWorkUids.has(u));
                  const visibleRows = rows.filter((r) => !r.ancestorUids.some((u) => collapsedWorkUids.has(u)));

                  function toggleCollapse(uidToToggle: number) {
                    setCollapsedWorkUids((prev) => {
                      const next = new Set(prev);
                      if (next.has(uidToToggle)) next.delete(uidToToggle);
                      else next.add(uidToToggle);
                      return next;
                    });
                  }

                  const fmtShort = (d: string) =>
                    new Date(dateOnly(d) + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });

                  return (
                    <>
                      <div className="gap" />
                      <div className="sec-row">
                        <h3 className="h3-warm">Work summary</h3>
                        <div className="flex items-center gap-2">
                          {summaryUids.length > 0 && (
                            <button
                              onClick={() =>
                                setCollapsedWorkUids(allCollapsed ? new Set() : new Set(summaryUids))
                              }
                              className="btn-quiet"
                            >
                              {allCollapsed ? "Expand all" : "Collapse all"}
                            </button>
                          )}
                          <div className="seg">
                            <button
                              onClick={() => { setWorkTab("ongoing"); setCollapsedWorkUids(new Set()); }}
                              className={workTab === "ongoing" ? "active" : ""}
                            >
                              Ongoing
                            </button>
                            <button
                              onClick={() => { setWorkTab("upcoming"); setCollapsedWorkUids(new Set()); }}
                              className={workTab === "upcoming" ? "active" : ""}
                            >
                              Upcoming
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="card card-pad">
                        {scheduleTasks.length === 0 ? (
                          <p className="text-sm text-gray-400">No schedule uploaded for this project.</p>
                        ) : leafCount === 0 ? (
                          <p className="text-sm text-gray-400">
                            {workTab === "ongoing" ? "No tasks in progress today." : "No tasks starting in the next two weeks."}
                          </p>
                        ) : (
                          <div className="space-y-0.5">
                            {visibleRows.map((row) =>
                              row.isSummary ? (
                                <button
                                  key={row.task.uid}
                                  onClick={() => toggleCollapse(row.task.uid)}
                                  className="w-full flex items-center gap-1.5 py-1.5 text-left hover:bg-gray-50 rounded-md"
                                  style={{ paddingLeft: `${row.depth * 16}px` }}
                                >
                                  <svg
                                    className={`w-3.5 h-3.5 text-gray-400 shrink-0 transition-transform ${collapsedWorkUids.has(row.task.uid) ? "" : "rotate-90"}`}
                                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                                  >
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                  </svg>
                                  <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide truncate">
                                    {row.task.name || "Untitled section"}
                                  </span>
                                </button>
                              ) : (
                                <div
                                  key={row.task.uid}
                                  className="flex items-start justify-between gap-4 py-2"
                                  style={{ paddingLeft: `${row.depth * 16 + 20}px` }}
                                >
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium text-gray-900 truncate">{row.task.name}</p>
                                    <p className="text-xs text-gray-400 mt-0.5 font-mono">
                                      {fmtShort(row.task.start)}
                                      {" — "}
                                      {fmtShort(row.task.finish)}
                                    </p>
                                  </div>
                                  <div className="shrink-0 text-right">
                                    <span className="text-xs font-semibold text-gray-700 tabular-nums">{row.task.percentComplete}%</span>
                                    <div className="w-16 h-1.5 bg-gray-200 rounded-full mt-1 overflow-hidden">
                                      <div className="h-full bg-[color:var(--brand-500)] rounded-full" style={{ width: `${row.task.percentComplete}%` }} />
                                    </div>
                                  </div>
                                </div>
                              )
                            )}
                          </div>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* Right: Photo, Info, Team, Weather */}
              <div>

                {/* Photo */}
                <h3 className="h3-warm">Project photo</h3>
                <div className="card overflow-hidden">
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                  {project.photo_url ? (
                    <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                      <img
                        src={project.photo_url}
                        alt="Project photo"
                        className="w-full h-48 object-cover"
                        onError={(e) => {
                          const target = e.currentTarget;
                          target.style.display = "none";
                          const parent = target.parentElement;
                          if (parent) {
                            const fallback = document.createElement("div");
                            fallback.className = "w-full h-48 bg-gray-100 flex items-center justify-center";
                            fallback.innerHTML = `<svg class="w-10 h-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M4.5 19.5h15a.75.75 0 00.75-.75V6.75A.75.75 0 0019.5 6h-15a.75.75 0 00-.75.75v12c0 .414.336.75.75.75z" /></svg>`;
                            parent.insertBefore(fallback, target);
                          }
                        }}
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="text-white text-xs font-medium">{uploading ? "Uploading…" : "Change Photo"}</span>
                      </div>
                    </div>
                  ) : (
                    <div
                      className="w-full h-48 bg-gray-100 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-gray-150 transition-colors group"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <svg className="w-10 h-10 text-gray-300 group-hover:text-gray-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M4.5 19.5h15a.75.75 0 00.75-.75V6.75A.75.75 0 0019.5 6h-15a.75.75 0 00-.75.75v12c0 .414.336.75.75.75z" />
                      </svg>
                      <span className="text-xs text-gray-400 group-hover:text-gray-500 transition-colors">
                        {uploading ? "Uploading…" : "Click to add photo"}
                      </span>
                    </div>
                  )}
                </div>

                {/* Project Info Card */}
                <div className="gap" />
                <div className="sec-row">
                  <h3 className="h3-warm">Project details</h3>
                  {(companyRole === "super_admin" || companyRole === "admin") && (
                    <div ref={infoMenuRef} className="relative">
                      <button
                        onClick={() => setShowInfoMenu((o) => !o)}
                        className="btn-quiet"
                        aria-label="Project options"
                      >
                        Edit
                      </button>
                      {showInfoMenu && (
                        <div className="absolute right-0 top-full mt-1 bg-white border border-gray-100 rounded-lg shadow-lg z-20 min-w-[100px]">
                          <button
                            onClick={openEdit}
                            className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg"
                          >
                            Edit
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="card card-pad space-y-3">

                  {/* Status + Value */}
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-gray-500 font-medium">Stage:</span>
                      <span className={`pill ${project.status === "course of construction" ? "pill-coc" : project.status === "bidding" ? "pill-bid" : project.status === "pre-construction" ? "pill-pre" : project.status === "warranty" ? "pill-war" : "pill-post"}`}>
                        {project.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-gray-500 font-medium">Value:</span>
                      <span className="text-sm font-semibold text-gray-900">${(project.value || 0).toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Project Number + Sector */}
                  {(project.project_number || project.sector) && (
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      {project.project_number && (
                        <p className="text-xs text-gray-500"><span className="font-medium text-gray-700">No.</span> {project.project_number}</p>
                      )}
                      {project.sector && (
                        <p className="text-xs text-gray-500"><span className="font-medium text-gray-700">Sector:</span> {project.sector}</p>
                      )}
                    </div>
                  )}

                  {/* Address */}
                  {(project.address || project.city || project.state) && (
                    <div className="flex items-start gap-2">
                      <svg className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <p className="text-sm text-gray-600">
                        {[
                          project.address,
                          [project.city, project.state].filter(Boolean).join(", "),
                          project.zip_code,
                          project.county ? `${project.county} County` : null,
                        ].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                  )}

                  {/* Dates */}
                  {(project.start_date || project.completion_date || project.projected_finish_date || project.warranty_start_date) && (
                    <div className="space-y-1 pt-1 border-t border-gray-50">
                      {project.start_date && (
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">Start</span>
                          <span className="text-gray-700 font-medium">{new Date(project.start_date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                        </div>
                      )}
                      {project.actual_start_date && (
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">Actual Start</span>
                          <span className="text-gray-700 font-medium">{new Date(project.actual_start_date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                        </div>
                      )}
                      {project.projected_finish_date && (
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">Projected Finish</span>
                          <span className="text-gray-700 font-medium">{new Date(project.projected_finish_date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                        </div>
                      )}
                      {project.completion_date && (
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">Completion</span>
                          <span className="text-gray-700 font-medium">{new Date(project.completion_date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                        </div>
                      )}
                      {project.warranty_start_date && (
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">Warranty Start</span>
                          <span className="text-gray-700 font-medium">{new Date(project.warranty_start_date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                        </div>
                      )}
                      {project.warranty_end_date && (
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">Warranty End</span>
                          <span className="text-gray-700 font-medium">{new Date(project.warranty_end_date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Description */}
                  {project.description && (
                    <p className="text-sm text-gray-500 leading-relaxed pt-1 border-t border-gray-50">
                      <span className="font-medium text-gray-700">Description: </span>
                      {project.description}
                    </p>
                  )}
                </div>

                {/* Upcoming milestones */}
                {(() => {
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const todayStr = today.toISOString().slice(0, 10);
                  const milestones = scheduleTasks
                    .filter((t) => t.isMilestone && t.finish && t.finish >= todayStr)
                    .sort((a, b) => a.finish.localeCompare(b.finish));
                  if (milestones.length === 0) return null;
                  return (
                    <>
                      <div className="gap" />
                      <h3 className="h3-warm">Upcoming milestones</h3>
                      <div className="card card-pad">
                        <div className="timeline">
                          {milestones.slice(0, 6).map((m, i) => (
                            <div key={m.uid} className={`tl-item${i === 0 ? " now" : ""}`}>
                              <span className="when">
                                {new Date(m.finish + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                              </span>
                              <span className="what">{m.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  );
                })()}

                {/* Project leads */}
                <div className="gap" />
                <div className="sec-row">
                  <h3 className="h3-warm">Project leads</h3>
                  {(companyRole === "super_admin" || companyRole === "admin") && (
                    <div ref={teamMenuRef} className="relative">
                      <button
                        onClick={() => setTeamMenuOpen((o) => !o)}
                        className="btn-quiet"
                        aria-label="Team options"
                      >
                        Edit
                      </button>
                      {teamMenuOpen && (
                        <div className="absolute right-0 top-full mt-1 bg-white border border-gray-100 rounded-lg shadow-lg z-20 min-w-[100px]">
                          <button
                            onClick={openRolesEdit}
                            className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg"
                          >
                            Edit
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="card card-pad">
                  {teamRoles.length === 0 ? (
                    <p className="text-sm text-gray-400">No team members assigned.</p>
                  ) : (
                    <div className="people">
                      {teamRoles.map(({ contact, roleName }, i) => (
                        <div key={`${contact.id}-${roleName}-${i}`} className="person">
                          <div className={`av av-${(i % 5) + 1}`}>
                            {contactName(contact)[0]?.toUpperCase() ?? "?"}
                          </div>
                          <div>
                            <div className="nm">{contactName(contact)}</div>
                            <div className="role">{roleName}</div>
                            {contact.phone ? (
                              <a href={`tel:${contact.phone}`} className="ph">{contact.phone}</a>
                            ) : (
                              <div className="ph ph-empty">No phone on file</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Weather */}
                <div className="gap" />
                <h3 className="h3-warm">7-day forecast</h3>
                <div className="card card-pad">
                  <WeatherWidget
                    zipCode={project.zip_code ?? ""}
                    onDays={(days) => setRainAlert(buildRainAlert(days))}
                  />
                </div>

              </div>
            </div>
          </>
        ) : null}
      </main>

      {/* Edit Modal */}
      {showEdit && project && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4 py-8">
          <div className="bg-white rounded-xl w-full max-w-lg shadow-xl flex flex-col max-h-full">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
              <h2 className="text-sm font-semibold text-gray-900">Edit Project</h2>
              <button onClick={() => setShowEdit(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleEditSave} className="px-6 py-5 space-y-4 overflow-y-auto">

              {/* Photo */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">Project Photo</label>
                <div className="rounded-lg overflow-hidden border border-gray-200">
                  {project.photo_url ? (
                    <img
                      src={project.photo_url}
                      alt="Project"
                      className="w-full h-36 object-cover"
                      onError={(e) => {
                        const target = e.currentTarget;
                        target.style.display = "none";
                        const parent = target.parentElement;
                        if (parent) {
                          const fallback = document.createElement("div");
                          fallback.className = "w-full h-36 bg-gray-100 flex items-center justify-center";
                          fallback.innerHTML = `<svg class="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M4.5 19.5h15a.75.75 0 00.75-.75V6.75A.75.75 0 0019.5 6h-15a.75.75 0 00-.75.75v12c0 .414.336.75.75.75z" /></svg>`;
                          parent.insertBefore(fallback, target);
                        }
                      }}
                    />
                  ) : (
                    <div className="w-full h-36 bg-gray-100 flex items-center justify-center">
                      <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M4.5 19.5h15a.75.75 0 00.75-.75V6.75A.75.75 0 0019.5 6h-15a.75.75 0 00-.75.75v12c0 .414.336.75.75.75z" />
                      </svg>
                    </div>
                  )}
                  <div className="px-3 py-2 border-t border-gray-100">
                    <input ref={editPhotoRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                    <button
                      type="button"
                      onClick={() => editPhotoRef.current?.click()}
                      disabled={uploading}
                      className="w-full py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50"
                    >
                      {uploading ? "Uploading..." : project.photo_url ? "Change Photo" : "Add Photo"}
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Project Name</label>
                <input
                  type="text" required value={editName} onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>

              <div ref={addressBoxRef} className="relative">
                <label className="block text-xs font-medium text-gray-700 mb-1">Address <span className="text-gray-400 font-normal">(optional)</span></label>
                <input
                  type="text"
                  value={editAddress}
                  onChange={(e) => handleAddressInput(e.target.value)}
                  onFocus={() => addressSuggestions.length > 0 && setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                  placeholder="Start typing an address..."
                  autoComplete="off"
                />
                {showSuggestions && addressSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-52 overflow-y-auto">
                    {addressSuggestions.map((s, i) => (
                      <button
                        key={i}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => selectAddressSuggestion(s)}
                        className="w-full text-left px-3 py-2.5 text-xs text-gray-700 hover:bg-gray-50 border-b border-gray-100 last:border-0 truncate"
                      >
                        {s.display}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">City <span className="text-gray-400 font-normal">(optional)</span></label>
                  <input
                    type="text" value={editCity} onChange={(e) => setEditCity(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                    placeholder="City"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">State <span className="text-gray-400 font-normal">(optional)</span></label>
                  <input
                    type="text" value={editStateVal} onChange={(e) => setEditStateVal(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                    placeholder="State"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">ZIP Code <span className="text-gray-400 font-normal">(optional)</span></label>
                  <input
                    type="text" value={editZipCode} onChange={(e) => setEditZipCode(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                    placeholder="e.g. 10001"
                    maxLength={5}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">County <span className="text-gray-400 font-normal">(optional)</span></label>
                  <input
                    type="text" value={editCounty} onChange={(e) => setEditCounty(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                    placeholder="e.g. Cook"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Project Number <span className="text-gray-400 font-normal">(optional)</span></label>
                  <input
                    type="text" value={editProjectNumber} onChange={(e) => setEditProjectNumber(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                    placeholder="e.g. 2024-001"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Sector <span className="text-gray-400 font-normal">(optional)</span></label>
                  <input
                    type="text" value={editSector} onChange={(e) => setEditSector(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                    placeholder="e.g. Commercial"
                  />
                </div>
              </div>


              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Start Date</label>
                  <input
                    type="date" value={editStartDate} onChange={(e) => setEditStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Actual Start Date</label>
                  <input
                    type="date" value={editActualStartDate} onChange={(e) => setEditActualStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Projected Finish</label>
                  <input
                    type="date" value={editProjectedFinishDate} onChange={(e) => setEditProjectedFinishDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Completion Date</label>
                  <input
                    type="date" value={editCompletionDate} onChange={(e) => setEditCompletionDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Warranty Start</label>
                  <input
                    type="date" value={editWarrantyStartDate} onChange={(e) => setEditWarrantyStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Warranty End</label>
                  <input
                    type="date" value={editWarrantyEndDate} onChange={(e) => setEditWarrantyEndDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Description <span className="text-gray-400 font-normal">(optional)</span></label>
                <textarea
                  rows={2} value={editDescription} onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
                  placeholder="Brief description..."
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Project Members <span className="text-gray-400 font-normal">(optional)</span></label>
                <MemberPicker
                  users={allUsers}
                  selected={editMembers}
                  onAdd={(u) => setEditMembers((prev) => [...prev, u])}
                  onRemove={(id) => setEditMembers((prev) => prev.filter((m) => m.id !== id))}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Value ($)</label>
                  <input
                    type="number" min="0" step="0.01" value={editValue} onChange={(e) => setEditValue(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={editStatus} onChange={(e) => setEditStatus(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
                  >
                    <option value="bidding">Bidding</option>
                    <option value="pre-construction">Pre-Construction</option>
                    <option value="course of construction">Course of Construction</option>
                    <option value="post-construction">Post-Construction</option>
                    <option value="warranty">Warranty</option>
                  </select>
                </div>
              </div>

              {editError && <p className="text-sm text-red-600">{editError}</p>}

              <div className="flex gap-3 pt-1 pb-1">
                <button type="button" onClick={() => setShowEdit(false)} className="flex-1 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={editSaving} className="flex-1 py-2 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-700 transition-colors disabled:opacity-50">
                  {editSaving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Project Roles Modal */}
      {showRolesEdit && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4 py-8">
          <div className="bg-white rounded-xl w-full max-w-2xl shadow-xl flex flex-col max-h-full">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
              <h2 className="text-sm font-semibold text-gray-900">Project Roles</h2>
              <button onClick={() => setShowRolesEdit(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="overflow-y-auto px-6 py-4 space-y-0 divide-y divide-gray-100">
              {/* Header row */}
              <div className="grid grid-cols-[160px_80px_1fr] gap-4 pb-2">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</span>
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</span>
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Members</span>
              </div>
              {PROJECT_ROLES.map((roleName) => (
                <div key={roleName} className="grid grid-cols-[160px_80px_1fr] gap-4 py-3 items-start">
                  <span className="text-sm text-gray-800 pt-1">{roleName}</span>
                  <span className="text-sm text-gray-400 pt-1">Person</span>
                  <DirectoryPicker
                    contacts={directoryContacts}
                    selected={projectRoleAssignments[roleName] || []}
                    onAdd={(c) =>
                      setProjectRoleAssignments((prev) => ({
                        ...prev,
                        [roleName]: [...(prev[roleName] || []), c],
                      }))
                    }
                    onRemove={(id) =>
                      setProjectRoleAssignments((prev) => ({
                        ...prev,
                        [roleName]: (prev[roleName] || []).filter((c) => c.id !== id),
                      }))
                    }
                  />
                </div>
              ))}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 shrink-0">
              {rolesError && <p className="text-sm text-red-600 mb-3">{rolesError}</p>}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowRolesEdit(false)}
                  className="flex-1 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleRolesSave}
                  disabled={rolesSaving}
                  className="flex-1 py-2 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-700 transition-colors disabled:opacity-50"
                >
                  {rolesSaving ? "Saving..." : "Save Roles"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
