"use client";

import { useState, useEffect, useRef } from "react";
import EmptyState from "@/app/components/EmptyState";
import { SkeletonCard } from "@/app/components/Skeleton";

type Member = { id: string; username: string; email: string };

type ActivityItem = {
  id: string;
  type: "rfi" | "submittal" | "document" | "daily_log" | "task" | "drawing";
  title: string;
  project_id: string;
  project_name: string;
  created_at: string;
  href: string;
};

type MyTask = {
  id: string;
  title: string;
  status: string;
  due_date: string | null;
  project_id: string;
  project_name: string;
};

type MyOpenItem = {
  id: string;
  title: string;
  type: "task" | "rfi" | "submittal" | "change_event" | "change_order" | "budget" | "commitment" | "prime_contract" | "transaction_order_assignment";
  status: string;
  due_date: string | null;
  project_id: string;
  project_name: string;
  href?: string;
};

const ALL_TYPES = ["rfi", "submittal", "document", "daily_log", "task", "drawing"];

const TYPE_LABELS: Record<string, string> = {
  rfi: "RFIs",
  submittal: "Submittals",
  document: "Documents",
  daily_log: "Daily Logs",
  task: "Tasks",
  drawing: "Drawings",
};

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function ActivityIcon({ type }: { type: ActivityItem["type"] }) {
  const iconMap: Record<string, React.ReactNode> = {
    rfi: (
      <svg className="w-4 h-4 text-[#D4500A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    submittal: (
      <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
    document: (
      <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    ),
    daily_log: (
      <svg className="w-4 h-4 text-sky-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    task: (
      <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    drawing: (
      <svg className="w-4 h-4 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
  };
  return (
    <div className="w-7 h-7 rounded-md bg-gray-50 border border-gray-100 grid place-items-center shrink-0">
      {iconMap[type] ?? iconMap.document}
    </div>
  );
}

type Project = {
  id: string;
  name: string;
  description: string;
  address: string;
  value: number;
  status: string;
  created_at: string;
  start_date?: string | null;
  actual_start_date?: string | null;
  completion_date?: string | null;
  projected_finish_date?: string | null;
  has_schedule?: boolean;
  project_number?: string | null;
  sector?: string | null;
  members?: Member[];
};

const ADMIN_EMAIL = "ptrenda1@gmail.com";

const STATUS_PILL: Record<string, string> = {
  "bidding": "pill-bid",
  "pre-construction": "pill-pre",
  "course of construction": "pill-coc",
  "post-construction": "pill-post",
  "warranty": "pill-war",
};

const STATUS_LABEL: Record<string, string> = {
  "bidding": "Bidding",
  "pre-construction": "Pre-Construction",
  "course of construction": "In Construction",
  "post-construction": "Post-Construction",
  "warranty": "Warranty",
};

function scheduleProgressForProject(project: Project): number | null {
  if (!project.has_schedule) return null;

  const startRaw = project.actual_start_date || project.start_date;
  const finishRaw = project.completion_date || project.projected_finish_date;
  if (!startRaw || !finishRaw) return null;

  const start = new Date(startRaw);
  const finish = new Date(finishRaw);
  if (Number.isNaN(start.getTime()) || Number.isNaN(finish.getTime()) || finish <= start) return null;

  const today = new Date();
  const dayMs = 86_400_000;
  const totalDays = Math.max(1, Math.ceil((finish.getTime() - start.getTime()) / dayMs));
  const elapsedDays = Math.max(0, Math.min(totalDays, Math.floor((today.getTime() - start.getTime()) / dayMs)));
  return elapsedDays / totalDays;
}

function scheduleProgressFromTasks(tasks: ScheduleTask[]): number | null {
  if (!Array.isArray(tasks) || tasks.length === 0) return null;

  const datedTasks = tasks.filter((task) => !task.isSummary && task.start && task.finish);
  if (datedTasks.length === 0) return null;

  let minStart = Number.POSITIVE_INFINITY;
  let maxFinish = Number.NEGATIVE_INFINITY;

  for (const task of datedTasks) {
    const startTs = new Date(task.start as string).getTime();
    const finishTs = new Date(task.finish as string).getTime();
    if (!Number.isNaN(startTs)) minStart = Math.min(minStart, startTs);
    if (!Number.isNaN(finishTs)) maxFinish = Math.max(maxFinish, finishTs);
  }

  if (!Number.isFinite(minStart) || !Number.isFinite(maxFinish) || maxFinish <= minStart) return null;

  const today = Date.now();
  const dayMs = 86_400_000;
  const totalDays = Math.max(1, Math.ceil((maxFinish - minStart) / dayMs));
  const elapsedDays = Math.max(0, Math.min(totalDays, Math.floor((today - minStart) / dayMs)));
  return elapsedDays / totalDays;
}

function formatCurrencyDisplay(n: number): string {
  if (!n) return "$0";
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1).replace(/\.0$/, "")}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

function openItemHref(item: MyOpenItem): string {
  if (item.href) return item.href;

  const projectBase = `/projects/${item.project_id}`;
  switch (item.type) {
    case "task":
      return `${projectBase}/tasks/${item.id}`;
    case "rfi":
      return `${projectBase}/rfis/${item.id}`;
    case "submittal":
      return `${projectBase}/submittals/${item.id}`;
    case "change_event":
      return `${projectBase}/change-events/${item.id}`;
    case "change_order":
      return `${projectBase}/change-orders/${item.id}`;
    case "commitment":
      return `${projectBase}/commitments/${item.id}`;
    case "prime_contract":
      return `${projectBase}/prime-contracts/${item.id}`;
    case "transaction_order_assignment":
      return `${projectBase}/transaction-orders`;
    default:
      return projectBase;
  }
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
            <span
              key={u.id}
              className="flex items-center gap-1 pl-2.5 pr-1.5 py-1 bg-gray-100 text-xs text-gray-700 rounded-full"
            >
              {u.username}
              <button
                type="button"
                onClick={() => onRemove(u.id)}
                className="text-gray-400 hover:text-gray-700 ml-0.5"
              >
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

type CompanyOption = { id: string; name: string; role: string; isCurrent: boolean };

export default function DashboardClient({ username, email, role, companyRole, userType, companyId }: { username: string; email: string; role: string; companyRole: string | null; userType: string; companyId: string | null }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [companyUsers, setCompanyUsers] = useState<Member[]>([]);
  const [scheduleProgressByProject, setScheduleProgressByProject] = useState<Record<string, number | null>>({});

  // Recent Activity state
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(4);
  const [activityFilter, setActivityFilter] = useState<string[]>(() => {
    if (typeof window === "undefined") return ALL_TYPES;
    try {
      const saved = localStorage.getItem("activity_filter");
      return saved ? JSON.parse(saved) : ALL_TYPES;
    } catch { return ALL_TYPES; }
  });
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const filterMenuRef = useRef<HTMLDivElement>(null);
  const [lastLoginAt] = useState<number | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const stored = localStorage.getItem("dashboard_last_login_at");
      if (!stored) return null;
      const parsed = Number(stored);
      return Number.isFinite(parsed) ? parsed : null;
    } catch {
      return null;
    }
  });

  // My Tasks state
  const [myTasks, setMyTasks] = useState<MyTask[]>([]);
  const [myOpenItems, setMyOpenItems] = useState<MyOpenItem[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const myOpenItemsRef = useRef<HTMLElement>(null);

  // Form state
  const [name, setName] = useState("");
  const [projectNumber, setProjectNumber] = useState("");
  const [sector, setSector] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [stateVal, setStateVal] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [county, setCounty] = useState("");
  const [description, setDescription] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [value, setValue] = useState("");
  const [status, setStatus] = useState("bidding");
  const [startDate, setStartDate] = useState("");
  const [actualStartDate, setActualStartDate] = useState("");
  const [completionDate, setCompletionDate] = useState("");
  const [projectedFinishDate, setProjectedFinishDate] = useState("");
  const [warrantyStartDate, setWarrantyStartDate] = useState("");
  const [warrantyEndDate, setWarrantyEndDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // Company switcher state
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [companyMenuOpen, setCompanyMenuOpen] = useState(false);
  const companyMenuRef = useRef<HTMLDivElement>(null);
  const dashboardSearchRef = useRef<HTMLDivElement>(null);
  const [dashboardSearch, setDashboardSearch] = useState("");
  const [showDashboardSearch, setShowDashboardSearch] = useState(false);
  const [dashboardSearchResults, setDashboardSearchResults] = useState<
    { id: string; title: string; subtitle: string; href: string }[]
  >([]);
  const [dashboardSearchLoading, setDashboardSearchLoading] = useState(false);

  // Settings modal state
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"password" | "phone">("password");
  const [phone, setPhone] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState("");
  const [settingsSuccess, setSettingsSuccess] = useState("");

  async function loadProjects() {
    const res = await fetch("/api/projects");
    const data = await res.json();
    setProjects(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  async function loadUsers() {
    const res = await fetch("/api/users");
    const data = await res.json();
    setCompanyUsers(Array.isArray(data) ? data : []);
  }

  async function loadActivities() {
    setActivityLoading(true);
    try {
      const res = await fetch("/api/dashboard/activity");
      if (res.ok) {
        const data = await res.json();
        setActivities(Array.isArray(data) ? data : []);
      }
    } catch {}
    setActivityLoading(false);
  }

  async function loadMyTasks() {
    try {
      const res = await fetch("/api/dashboard/my-tasks");
      if (res.ok) {
        const data = await res.json();
        setMyTasks(Array.isArray(data.tasks) ? data.tasks : []);
        setMyOpenItems(Array.isArray(data.open_items) ? data.open_items : []);
      }
    } catch {}
  }

  async function loadCompanies() {
    try {
      const res = await fetch("/api/user/companies");
      if (res.ok) {
        const data = await res.json();
        setCompanies(Array.isArray(data) ? data : []);
      }
    } catch {}
  }

  async function switchCompany(id: string) {
    setCompanyMenuOpen(false);
    const res = await fetch("/api/auth/switch-company", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ company_id: id }),
    });
    if (res.ok) window.location.reload();
  }

  useEffect(() => {
    try {
      localStorage.setItem("dashboard_last_login_at", String(Date.now()));
    } catch {}
  }, []);

  useEffect(() => {
    loadProjects();
    loadActivities();
    loadMyTasks();
    loadCompanies();
    loadUsers();
    // Read last-visited project from localStorage to scope task alerts
    try {
      const stored = localStorage.getItem("current_project_id");
      if (stored) setCurrentProjectId(stored);
    } catch {}
  }, []);

  useEffect(() => {
    const scheduledProjects = projects.filter((project) => project.has_schedule);
    if (scheduledProjects.length === 0) {
      return;
    }

    let cancelled = false;

    (async () => {
      const entries = await Promise.all(
        scheduledProjects.map(async (project) => {
          try {
            const res = await fetch(`/api/projects/${project.id}/schedule`);
            if (!res.ok) return [project.id, scheduleProgressForProject(project)] as const;
            const data = await res.json();
            const taskProgress = scheduleProgressFromTasks(Array.isArray(data?.tasks) ? data.tasks : []);
            return [project.id, taskProgress ?? scheduleProgressForProject(project)] as const;
          } catch {
            return [project.id, scheduleProgressForProject(project)] as const;
          }
        })
      );

      if (!cancelled) {
        setScheduleProgressByProject(Object.fromEntries(entries));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [projects]);

  // Close filter menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (filterMenuRef.current && !filterMenuRef.current.contains(e.target as Node)) {
        setFilterMenuOpen(false);
      }
      if (companyMenuRef.current && !companyMenuRef.current.contains(e.target as Node)) {
        setCompanyMenuOpen(false);
      }
      if (dashboardSearchRef.current && !dashboardSearchRef.current.contains(e.target as Node)) {
        setShowDashboardSearch(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const searchQuery = dashboardSearch.trim();

  // Debounced server-side search across the entire portfolio of accessible projects.
  useEffect(() => {
    if (searchQuery.length < 1) {
      setDashboardSearchResults([]);
      setDashboardSearchLoading(false);
      return;
    }
    let cancelled = false;
    setDashboardSearchLoading(true);
    const handle = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search/global?q=${encodeURIComponent(searchQuery)}`);
        if (!res.ok) {
          if (!cancelled) setDashboardSearchResults([]);
          return;
        }
        const data = await res.json();
        if (!cancelled) {
          setDashboardSearchResults(Array.isArray(data) ? data : []);
        }
      } catch {
        if (!cancelled) setDashboardSearchResults([]);
      } finally {
        if (!cancelled) setDashboardSearchLoading(false);
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [searchQuery]);

  function toggleActivityType(type: string) {
    setVisibleCount(4);
    setActivityFilter((prev) => {
      const next = prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type];
      try { localStorage.setItem("activity_filter", JSON.stringify(next)); } catch {}
      return next;
    });
  }

  function closeModal() {
    setShowModal(false);
    setName(""); setProjectNumber(""); setSector("");
    setAddress(""); setCity(""); setStateVal(""); setZipCode(""); setCounty("");
    setDescription(""); setMembers([]); setValue(""); setStatus("bidding");
    setStartDate(""); setActualStartDate(""); setCompletionDate("");
    setProjectedFinishDate(""); setWarrantyStartDate(""); setWarrantyEndDate("");
    setFormError("");
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }

  async function handleSavePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) { setSettingsError("New passwords do not match"); return; }
    if (newPassword.length < 6) { setSettingsError("Password must be at least 6 characters"); return; }
    setSettingsSaving(true); setSettingsError(""); setSettingsSuccess("");
    const res = await fetch("/api/user/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = await res.json();
    setSettingsSaving(false);
    if (!res.ok) { setSettingsError(data.error); return; }
    setSettingsSuccess("Password updated successfully");
    setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
  }

  async function handleSavePhone(e: React.FormEvent) {
    e.preventDefault();
    setSettingsSaving(true); setSettingsError(""); setSettingsSuccess("");
    const res = await fetch("/api/user/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    const data = await res.json();
    setSettingsSaving(false);
    if (!res.ok) { setSettingsError(data.error); return; }
    setSettingsSuccess("Phone number updated successfully");
  }

  async function handleCreateProject(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError("");

    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name, project_number: projectNumber, sector,
        address, city, state: stateVal, zip_code: zipCode, county,
        description, value, status,
        start_date: startDate || null,
        actual_start_date: actualStartDate || null,
        completion_date: completionDate || null,
        projected_finish_date: projectedFinishDate || null,
        warranty_start_date: warrantyStartDate || null,
        warranty_end_date: warrantyEndDate || null,
        memberIds: members.map((m) => m.id),
      }),
    });

    const data = await res.json();
    setSaving(false);

    if (!res.ok) { setFormError(data.error); return; }

    setProjects((prev) => [{ ...data, members }, ...prev]);
    closeModal();
  }

  const canManageProjects = companyRole === "super_admin" || companyRole === "admin";
  const totalValue = projects.reduce((sum, p) => sum + (p.value || 0), 0);
  const activeCount = projects.filter((p) => p.status === "course of construction").length;
  const completedCount = projects.filter((p) => p.status === "post-construction" || p.status === "warranty").length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-4 sm:px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-sm font-semibold text-gray-900">SiteCommand</span>
          {companies.length > 0 && (
            <div ref={companyMenuRef} className="relative">
              <button
                onClick={() => setCompanyMenuOpen((o) => !o)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-gray-200 text-xs font-medium text-gray-700 hover:border-gray-400 hover:text-gray-900 transition-colors"
              >
                <span className="max-w-[140px] truncate">
                  {companies.find((c) => c.isCurrent)?.name ?? "Select company"}
                </span>
                <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {companyMenuOpen && (
                <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-gray-100 rounded-lg shadow-lg z-50 py-1">
                  <div className="px-3 pt-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                    Company
                  </div>
                  {companies.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => switchCompany(c.id)}
                      className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between hover:bg-gray-50 transition-colors ${c.isCurrent ? "text-gray-900 font-medium" : "text-gray-600"}`}
                    >
                      <span className="truncate">{c.name}</span>
                      {c.isCurrent && (
                        <svg className="w-3.5 h-3.5 text-gray-900 shrink-0 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-3 sm:gap-5 min-w-0">
          <div ref={dashboardSearchRef} className="relative hidden md:block w-[26rem] max-w-[36vw]">
            <svg
              className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            <input
              value={dashboardSearch}
              onChange={(e) => {
                setDashboardSearch(e.target.value);
                setShowDashboardSearch(true);
              }}
              onFocus={() => setShowDashboardSearch(true)}
              placeholder="Search..."
              className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
            {showDashboardSearch && dashboardSearch.trim().length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-[9999] max-h-80 overflow-y-auto">
                {dashboardSearchLoading && dashboardSearchResults.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-gray-400">Searching…</p>
                ) : dashboardSearchResults.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-gray-400">No results found.</p>
                ) : (
                  <div className="py-1">
                    {dashboardSearchResults.map((result) => (
                      <a
                        key={result.id}
                        href={result.href}
                        className="block px-3 py-2 hover:bg-gray-50"
                        onClick={() => setShowDashboardSearch(false)}
                      >
                        <p className="text-sm text-gray-900 truncate">{result.title}</p>
                        <p className="text-xs text-gray-500 truncate">{result.subtitle}</p>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          {(companyRole === "super_admin" || companyRole === "admin") && (
            <a href="/company" className="text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors shrink-0">
              Admin
            </a>
          )}
          <div className="relative group shrink-0">
            <span
              className="hidden sm:block text-sm text-gray-400 truncate max-w-[120px] cursor-default pb-2 -mb-2"
              title="Settings and Logout"
            >
              {username}
            </span>
            <div className="absolute right-0 top-full hidden group-hover:block z-40">
              <div className="w-44 rounded-md border border-gray-200 bg-white py-1 shadow-lg">
                <a
                  href="/settings/account"
                  className="block px-3 py-2 text-xs text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
                >
                  Settings
                </a>
                <button
                  onClick={handleLogout}
                  className="block w-full text-left px-3 py-2 text-xs text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {/* Focus Card — hero with ambient glow, attention items + portfolio snapshot */}
        {(() => {
          const scopedTasks = myTasks.filter((t) => !currentProjectId || t.project_id === currentProjectId);
          const attentionCount = myOpenItems.length;
          const greetingFirstName = (username || "there").split(/[\s.@]/)[0];
          const greeting = `Good ${(() => { const h = new Date().getHours(); return h < 12 ? "morning" : h < 18 ? "afternoon" : "evening"; })()}, ${greetingFirstName}.`;
          const updatesWhileAwayCount =
            lastLoginAt === null
              ? 0
              : activities.filter((item) => new Date(item.created_at).getTime() > lastLoginAt).length;
          return (
            <div className="bezel ambient-hero mb-10">
              <div className="bezel-inner">
                <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr]">
                  {/* Left: attention */}
                  <div className="px-6 sm:px-8 py-7 sm:py-9">
                    <h1 className="font-display text-[32px] sm:text-[40px] leading-[1.05] text-[color:var(--ink)] mb-1">
                      {attentionCount > 0 ? (
                        <>
                          <span className="tabular-nums">{attentionCount}</span>{" "}
                          {attentionCount === 1 ? "item" : "items"}{" "}
                          <span className="serif-italic text-gray-500">need your attention</span>
                        </>
                      ) : (
                        <>
                          {greeting}{" "}
                          <span className="serif-italic text-gray-500">nothing overdue</span>
                        </>
                      )}
                    </h1>
                    <p className="text-sm text-gray-500 max-w-md">
                      {attentionCount > 0
                        ? "Open items assigned to you or created by you across all active projects."
                        : "Signals from your projects will surface here as work progresses."}
                    </p>
                    <p className="text-sm text-gray-500 mb-6 max-w-xl mt-1">
                      {updatesWhileAwayCount > 0
                        ? `${updatesWhileAwayCount} update${updatesWhileAwayCount === 1 ? "" : "s"} while you were gone — including new daily logs, photos, documents, drawings, and recurring workflow reports.`
                        : "No new updates while you were gone yet — new daily logs, photos, documents, drawings, and recurring workflow reports will appear here."}
                    </p>

                    {scopedTasks.length > 0 && (
                      <ul className="divide-y divide-gray-50 border hairline rounded-lg bg-white">
                        {scopedTasks.slice(0, 4).map((task) => (
                          <li key={task.id}>
                            <a
                              href={`/projects/${task.project_id}`}
                              className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                            >
                              <span className={`pill ${task.due_date && new Date(task.due_date) < new Date() ? "pill-danger" : "pill-warn"} shrink-0`}>
                                Task
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm text-gray-900 truncate">{task.title}</p>
                                <p className="text-xs text-gray-400 truncate">{task.project_name}</p>
                              </div>
                              {task.due_date && (
                                <span className="text-xs text-gray-500 shrink-0 mono-label">
                                  {(() => {
                                    const d = new Date(task.due_date);
                                    const now = new Date();
                                    const days = Math.floor((d.getTime() - now.getTime()) / 86_400_000);
                                    if (days < 0) return `${Math.abs(days)}d overdue`;
                                    if (days === 0) return "Due today";
                                    return `Due ${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
                                  })()}
                                </span>
                              )}
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}

                  </div>

                  {/* Right: portfolio snapshot */}
                  <div className="border-t lg:border-t-0 lg:border-l hairline px-6 sm:px-8 py-7 sm:py-9 bg-gradient-to-br from-white to-[color:var(--surface-sunken)]">
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-1">Total value</p>
                    <p className="font-display text-[36px] leading-none text-[color:var(--ink)] tabular-nums mb-6">
                      {formatCurrencyDisplay(totalValue)}
                    </p>

                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <p className="mono-label mb-1">PROJECTS</p>
                        <p className="font-display text-xl text-[color:var(--ink)] tabular-nums">{projects.length}</p>
                      </div>
                      <div>
                        <p className="mono-label mb-1">ACTIVE</p>
                        <p className="font-display text-xl text-[color:var(--ink)] tabular-nums">{activeCount}</p>
                      </div>
                      <div>
                        <p className="mono-label mb-1">COMPLETE</p>
                        <p className="font-display text-xl text-[color:var(--ink)] tabular-nums">{completedCount}</p>
                      </div>
                    </div>

                    <div className="mt-6 pt-5 border-t hairline">
                      <button
                        type="button"
                        className="mono-label mb-2 hover:text-gray-700 transition-colors underline-offset-2 hover:underline"
                        onClick={() => myOpenItemsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
                      >
                        MY OPEN ITEMS
                      </button>
                      <div className="flex items-baseline gap-2">
                        <p className="font-display text-2xl text-[color:var(--ink)] tabular-nums">{attentionCount}</p>
                        <p className="text-xs text-gray-400">
                          {attentionCount === 1 ? "item awaiting action" : "items awaiting action"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Projects section header */}
        <div className="flex items-end justify-between mb-5">
          <div>
            <h2 className="font-display text-[28px] leading-[1.05] text-[color:var(--ink)]">Projects</h2>
            <p className="sec-sub">
              <span className="num">{activeCount}</span> active
              <span className="sep">·</span>
              <span className="num">{projects.filter((p) => p.status === "bidding").length}</span> bidding
              <span className="sep">·</span>
              <span className="num">{formatCurrencyDisplay(totalValue)}</span> in flight
            </p>
          </div>
          {canManageProjects && (
            <button
              onClick={() => { loadUsers(); setShowModal(true); }}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-[color:var(--ink)] text-white text-[12px] font-semibold rounded-md hover:bg-gray-800 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              New Project
            </button>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="bg-white border border-dashed border-gray-200 rounded-xl">
            <EmptyState
              icon={
                <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.25}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              }
              title="No projects yet"
              description={
                canManageProjects
                  ? "Create your first project to get started."
                  : "You haven't been added to any projects yet."
              }
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => {
              const pillClass = STATUS_PILL[project.status] ?? "pill-post";
              const statusLabel = STATUS_LABEL[project.status] ?? project.status;
              const scheduleProgress = project.has_schedule
                ? (scheduleProgressByProject[project.id] ?? scheduleProgressForProject(project))
                : null;
              const isActive = project.status === "course of construction";
              const progressLabel = scheduleProgress == null ? "Not available" : `${Math.round(scheduleProgress * 100)}%`;
              return (
                <a
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className="lift block bg-white border hairline rounded-xl px-5 pt-4 pb-0 overflow-hidden"
                >
                  {/* Top row: number · sector + pill */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 min-w-0">
                      {project.project_number && (
                        <span className="mono-label">{project.project_number}</span>
                      )}
                      {project.project_number && project.sector && (
                        <span className="text-gray-300">·</span>
                      )}
                      {project.sector && (
                        <span className="text-[11px] uppercase tracking-wider text-gray-500 font-medium truncate">
                          {project.sector}
                        </span>
                      )}
                    </div>
                    <span className={`pill ${pillClass} shrink-0`}>{statusLabel}</span>
                  </div>

                  {/* Project name */}
                  <h3 className="text-[15px] font-semibold text-gray-900 leading-snug mb-1">
                    {project.name}
                  </h3>

                  {/* Address */}
                  {project.address && (
                    <p className="text-xs text-gray-400 mb-4 truncate">{project.address}</p>
                  )}

                  {/* Value (DM Serif) */}
                  <p className="font-display text-[28px] leading-none text-[color:var(--ink)] tabular-nums mb-4">
                    {formatCurrencyDisplay(project.value || 0)}
                  </p>

                  {/* Progress spark-track */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="mono-label">PROGRESS</span>
                      <span className="mono-label">{progressLabel}</span>
                    </div>
                    <div className="spark-track">
                      <div
                        className={`spark-fill ${isActive ? "brand" : ""}`}
                        style={{ width: scheduleProgress == null ? "0%" : `${Math.max(3, scheduleProgress * 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Members */}
                  {project.members && project.members.length > 0 && (
                    <div className="flex items-center gap-2 mb-4">
                      <div className="flex -space-x-1.5">
                        {project.members.slice(0, 4).map((m) => (
                          <div
                            key={m.id}
                            title={m.username}
                            className="w-6 h-6 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-[10px] font-semibold text-gray-600"
                          >
                            {m.username[0].toUpperCase()}
                          </div>
                        ))}
                      </div>
                      {project.members.length > 4 && (
                        <span className="text-xs text-gray-400">+{project.members.length - 4}</span>
                      )}
                    </div>
                  )}

                  {/* Site-pulse footer */}
                  <div className="-mx-5 px-5 py-2.5 border-t hairline bg-[color:var(--surface-sunken)] flex items-center justify-between">
                    <span className="mono-label">
                      {isActive ? "ON SITE" : project.status === "warranty" ? "WARRANTY" : project.status === "bidding" ? "BIDDING" : project.status === "pre-construction" ? "PRE-CON" : "WRAPPED"}
                    </span>
                    <span className="text-[11px] text-gray-400">
                      {new Date(project.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                  </div>
                </a>
              );
            })}
          </div>
        )}

        {/* Recent Activity */}
        <div className="mt-12">
          <div className="flex items-end justify-between mb-5">
            <div>
              <h2 className="font-display text-[28px] leading-[1.05] text-[color:var(--ink)]">Recent activity</h2>
              <p className="sec-sub">Last 24h across all projects</p>
            </div>
            {/* 3-dot filter button */}
            <div ref={filterMenuRef} className="relative">
              <button
                onClick={() => setFilterMenuOpen((v) => !v)}
                className="p-1.5 text-gray-400 hover:text-gray-700 transition-colors rounded-md hover:bg-gray-100"
                title="Filter activity types"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <circle cx="4" cy="10" r="1.5" />
                  <circle cx="10" cy="10" r="1.5" />
                  <circle cx="16" cy="10" r="1.5" />
                </svg>
              </button>
              {filterMenuOpen && (
                <div className="absolute right-0 mt-1 w-44 bg-white border border-gray-100 rounded-lg shadow-lg z-20 py-1">
                  {ALL_TYPES.map((type) => (
                    <label
                      key={type}
                      className="flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={activityFilter.includes(type)}
                        onChange={() => toggleActivityType(type)}
                        className="rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                      />
                      <span className="text-sm text-gray-700">{TYPE_LABELS[type]}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          {activityLoading ? (
            <div className="bg-white border hairline rounded-xl divide-y divide-gray-50">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3.5 animate-pulse">
                  <div className="w-7 h-7 bg-gray-100 rounded-md shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 bg-gray-200 rounded w-2/3" />
                    <div className="h-2.5 bg-gray-100 rounded w-1/3" />
                  </div>
                  <div className="h-2.5 bg-gray-100 rounded w-12 shrink-0" />
                </div>
              ))}
            </div>
          ) : activities.filter((a) => activityFilter.includes(a.type)).length === 0 ? (
            <div className="bg-white border border-dashed border-gray-200 rounded-xl px-6 py-8 text-center">
              <p className="text-sm text-gray-400">No recent activity to show.</p>
            </div>
          ) : (() => {
            const filtered = activities.filter((a) => activityFilter.includes(a.type));
            const visible = filtered.slice(0, visibleCount);
            const hasMore = filtered.length > visibleCount;
            return (
              <div className="bg-white border hairline rounded-xl divide-y divide-gray-50">
                {visible.map((item) => (
                  <a
                    key={`${item.type}-${item.id}`}
                    href={item.href}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors"
                  >
                    <ActivityIcon type={item.type} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-gray-900 truncate flex items-center gap-2">
                        <span className="truncate">{item.title}</span>
                        {lastLoginAt !== null && new Date(item.created_at).getTime() > lastLoginAt && (
                          <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse shrink-0" aria-label="New activity since last login" />
                        )}
                      </p>
                      <p className="text-[11px] text-gray-500 truncate">
                        <span className="font-medium text-gray-600">{TYPE_LABELS[item.type]}</span>
                        {" · "}
                        {item.project_name}
                      </p>
                    </div>
                    <span className="text-[11px] text-gray-400 shrink-0 tabular-nums">{timeAgo(item.created_at)}</span>
                  </a>
                ))}
                {hasMore && (
                  <button
                    onClick={() => setVisibleCount((c) => c + 10)}
                    className="w-full px-4 py-3 text-xs text-gray-500 hover:text-gray-800 hover:bg-gray-50 transition-colors text-center"
                  >
                    Load more ({filtered.length - visibleCount} remaining)
                  </button>
                )}
              </div>
            );
          })()}
        </div>

        {/* My Open Items */}
        <section ref={myOpenItemsRef} className="mt-12">
          <div className="flex items-end justify-between mb-5">
            <div>
              <h2 className="font-display text-[28px] leading-[1.05] text-[color:var(--ink)]">My open items</h2>
              <p className="sec-sub">
                <span className="num">{myOpenItems.length}</span> item{myOpenItems.length !== 1 ? "s" : ""} awaiting action
              </p>
            </div>
          </div>

          {myOpenItems.length > 0 && (
            <ul className="divide-y divide-gray-50 border hairline rounded-xl bg-white">
              {myOpenItems.map((item) => (
                <li key={`${item.type}-${item.id}`}>
                  <a
                    href={openItemHref(item)}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                  >
                    <span className={`pill ${item.due_date && new Date(item.due_date) < new Date() ? "pill-danger" : "pill-warn"} shrink-0`}>
                      {item.type === "transaction_order_assignment"
                        ? "assigned invoice"
                        : item.type.replace(/_/g, " ")}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-gray-900 truncate">{item.title}</p>
                      <p className="text-xs text-gray-400 truncate">
                        {item.project_name || "Project"} · {item.status || "Open"}
                      </p>
                    </div>
                    {item.due_date && (
                      <span className="text-xs text-gray-500 shrink-0 mono-label">
                        {(() => {
                          const d = new Date(item.due_date);
                          const now = new Date();
                          const days = Math.floor((d.getTime() - now.getTime()) / 86_400_000);
                          if (days < 0) return `${Math.abs(days)}d overdue`;
                          if (days === 0) return "Due today";
                          return `Due ${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
                        })()}
                      </span>
                    )}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      {/* New Project Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4 py-8">
          <div className="bg-white rounded-xl w-full max-w-lg shadow-xl flex flex-col max-h-full">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
              <h2 className="text-sm font-semibold text-gray-900">New Project</h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleCreateProject} className="px-6 py-5 space-y-6 overflow-y-auto">

              {/* General Information */}
              <div className="space-y-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">General Information</p>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Project Name</label>
                  <input
                    type="text" required value={name} onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                    placeholder="e.g. 123 Main St Renovation"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Project Number <span className="text-gray-400 font-normal">(optional)</span></label>
                    <input
                      type="text" value={projectNumber} onChange={(e) => setProjectNumber(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                      placeholder="e.g. 2024-001"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                    <select
                      value={status} onChange={(e) => setStatus(e.target.value)}
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

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Sector <span className="text-gray-400 font-normal">(optional)</span></label>
                    <input
                      type="text" value={sector} onChange={(e) => setSector(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                      placeholder="e.g. Commercial"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Value ($)</label>
                    <input
                      type="number" min="0" step="0.01" value={value} onChange={(e) => setValue(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                      placeholder="0"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Description <span className="text-gray-400 font-normal">(optional)</span></label>
                  <textarea
                    rows={2} value={description} onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
                    placeholder="Brief description..."
                  />
                </div>
              </div>

              {/* Location */}
              <div className="space-y-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Location</p>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Address <span className="text-gray-400 font-normal">(optional)</span></label>
                  <input
                    type="text" value={address} onChange={(e) => setAddress(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                    placeholder="Street address"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">City <span className="text-gray-400 font-normal">(optional)</span></label>
                    <input
                      type="text" value={city} onChange={(e) => setCity(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                      placeholder="City"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">State <span className="text-gray-400 font-normal">(optional)</span></label>
                    <input
                      type="text" value={stateVal} onChange={(e) => setStateVal(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                      placeholder="State"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">ZIP Code <span className="text-gray-400 font-normal">(optional)</span></label>
                    <input
                      type="text" value={zipCode} onChange={(e) => setZipCode(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                      placeholder="e.g. 10001"
                      maxLength={5}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">County <span className="text-gray-400 font-normal">(optional)</span></label>
                    <input
                      type="text" value={county} onChange={(e) => setCounty(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                      placeholder="County"
                    />
                  </div>
                </div>
              </div>

              {/* Dates */}
              <div className="space-y-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Dates</p>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Start Date <span className="text-gray-400 font-normal">(optional)</span></label>
                    <input
                      type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Actual Start Date <span className="text-gray-400 font-normal">(optional)</span></label>
                    <input
                      type="date" value={actualStartDate} onChange={(e) => setActualStartDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Completion Date <span className="text-gray-400 font-normal">(optional)</span></label>
                    <input
                      type="date" value={completionDate} onChange={(e) => setCompletionDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Projected Finish <span className="text-gray-400 font-normal">(optional)</span></label>
                    <input
                      type="date" value={projectedFinishDate} onChange={(e) => setProjectedFinishDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Warranty Start <span className="text-gray-400 font-normal">(optional)</span></label>
                    <input
                      type="date" value={warrantyStartDate} onChange={(e) => setWarrantyStartDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Warranty End <span className="text-gray-400 font-normal">(optional)</span></label>
                    <input
                      type="date" value={warrantyEndDate} onChange={(e) => setWarrantyEndDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                    />
                  </div>
                </div>
              </div>

              {/* Team */}
              <div className="space-y-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Team</p>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Project Members <span className="text-gray-400 font-normal">(optional)</span></label>
                  <MemberPicker
                    users={companyUsers}
                    selected={members}
                    onAdd={(u) => setMembers((prev) => [...prev, u])}
                    onRemove={(id) => setMembers((prev) => prev.filter((m) => m.id !== id))}
                  />
                </div>
              </div>

              {formError && <p className="text-sm text-red-600">{formError}</p>}

              <div className="flex gap-3 pt-1 pb-1">
                <button type="button" onClick={closeModal} className="flex-1 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="flex-1 py-2 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-700 transition-colors disabled:opacity-50">
                  {saving ? "Creating..." : "Create Project"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4 py-8">
          <div className="bg-white rounded-xl w-full max-w-md shadow-xl flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
              <h2 className="text-sm font-semibold text-gray-900">Account Settings</h2>
              <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Info row */}
            <div className="px-6 py-3 bg-gray-50 border-b border-gray-100">
              <p className="text-xs text-gray-500"><span className="font-medium text-gray-700">Username:</span> {username}</p>
              <p className="text-xs text-gray-500 mt-0.5"><span className="font-medium text-gray-700">Email:</span> {email}</p>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-100 px-6">
              <button
                onClick={() => { setSettingsTab("password"); setSettingsError(""); setSettingsSuccess(""); }}
                className={`py-3 text-xs font-medium mr-5 border-b-2 transition-colors ${settingsTab === "password" ? "border-gray-900 text-gray-900" : "border-transparent text-gray-400 hover:text-gray-700"}`}
              >
                Change Password
              </button>
              <button
                onClick={() => { setSettingsTab("phone"); setSettingsError(""); setSettingsSuccess(""); }}
                className={`py-3 text-xs font-medium border-b-2 transition-colors ${settingsTab === "phone" ? "border-gray-900 text-gray-900" : "border-transparent text-gray-400 hover:text-gray-700"}`}
              >
                Phone Number
              </button>
            </div>

            <div className="px-6 py-5">
              {settingsTab === "password" && (
                <form onSubmit={handleSavePassword} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Current Password</label>
                    <input
                      type="password" required value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                      placeholder="Enter current password"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">New Password</label>
                    <input
                      type="password" required value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                      placeholder="At least 6 characters"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Confirm New Password</label>
                    <input
                      type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                      placeholder="Repeat new password"
                    />
                  </div>
                  {settingsError && <p className="text-xs text-red-600">{settingsError}</p>}
                  {settingsSuccess && <p className="text-xs text-green-600">{settingsSuccess}</p>}
                  <button type="submit" disabled={settingsSaving} className="w-full py-2 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-700 transition-colors disabled:opacity-50">
                    {settingsSaving ? "Saving..." : "Update Password"}
                  </button>
                </form>
              )}

              {settingsTab === "phone" && (
                <form onSubmit={handleSavePhone} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Phone Number</label>
                    <input
                      type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                      placeholder="e.g. (555) 123-4567"
                    />
                  </div>
                  {settingsError && <p className="text-xs text-red-600">{settingsError}</p>}
                  {settingsSuccess && <p className="text-xs text-green-600">{settingsSuccess}</p>}
                  <button type="submit" disabled={settingsSaving} className="w-full py-2 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-700 transition-colors disabled:opacity-50">
                    {settingsSaving ? "Saving..." : "Save Phone Number"}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
