"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import ProjectNav from "@/components/ProjectNav";
import AppHeader from "@/app/components/AppHeader";
import { Pill } from "@/components/design-system/Primitives";
import BuildingCodeSection from "./BuildingCodeSection";
import ReportFieldsSection, { type ReportFieldValues } from "@/components/ReportFieldsSection";
import { PROJECT_REPORT_FIELDS } from "@/lib/report-fields";

type ProjectAdmin = {
  id: string;
  name: string;
  description: string | null;
  project_number: string | null;
  status: string | null;
  sector: string | null;
  work_scope: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  county: string | null;
  start_date: string | null;
  actual_start_date: string | null;
  completion_date: string | null;
  projected_finish_date: string | null;
  warranty_start_date: string | null;
  warranty_end_date: string | null;
  erp_sync: boolean | null;
  erp_job_cost_sync: boolean | null;
  prevent_overbilling: boolean | null;
  non_commitment_costs: boolean | null;
  test_project: boolean | null;
  labor_productivity: boolean | null;
  sage_300_id: string | null;
  qbo_customer_id: string | null;
  qbo_customer_name: string | null;
  report_fields: ReportFieldValues | null;
};

type CopyDirProject = { id: string; name: string; archived: boolean };

type ProjectMember = {
  membership_id: string;
  user_id: string;
  username: string;
  email: string;
  role: string;
};

type CompanyUser = {
  id: string;
  username: string;
  email: string;
};

const STAGES = ["Bidding", "Course of Construction", "Post-Construction", "Pre-Construction", "Warranty"];

// Keep in sync with the "Sector" dropdown on the new-project form (DashboardClient.tsx).
const SECTORS = [
  "Residential",
  "Commercial",
  "Industrial",
  "Institutional",
  "Heavy Civil / Infrastructure",
  "Energy & Utilities",
  "Telecom",
  "Renovation",
  "Mixed-Use",
  "Hospitality",
  "Healthcare",
  "Education",
  "Transportation",
  "Federal / Government",
  "Sports & Entertainment",
  "Agricultural",
  "Mining",
  "Oil & Gas",
  "Life Sciences / Pharmaceutical",
];

const WORK_SCOPES = ["Commercial", "Residential", "Industrial"];

const ADMIN_SECTIONS = [
  { id: "general-information", label: "General Information" },
  { id: "project-location", label: "Project Location" },
  { id: "building-code", label: "Building Code" },
  { id: "erp-integration", label: "ERP Integration" },
  { id: "advanced", label: "Advanced" },
  { id: "dates", label: "Dates" },
  { id: "additional-information", label: "Additional Information" },
] as const;

const INPUT_CLASS =
  "h-11 w-full rounded-md border border-black/10 bg-[color:var(--surface-sunken)] px-3 text-sm text-[color:var(--ink)] placeholder:text-gray-400 focus:border-[color:var(--ink)] focus:outline-none focus:ring-1 focus:ring-[color:var(--ink)] read-only:cursor-default disabled:cursor-not-allowed";

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mono-label mb-1.5 block">
        {label}
        {required ? <span className="ml-1 text-[color:var(--brand-500)]">*</span> : null}
      </label>
      {children}
    </div>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  readOnly,
}: {
  value: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  readOnly?: boolean;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      placeholder={placeholder}
      readOnly={readOnly}
      className={INPUT_CLASS}
    />
  );
}

function SelectInput({
  value,
  onChange,
  placeholder,
  options,
  disabled,
}: {
  value: string;
  onChange?: (v: string) => void;
  placeholder: string;
  options: string[];
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      disabled={disabled}
      className={INPUT_CLASS}
    >
      <option value="">{placeholder}</option>
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}

function DateInput({ value, onChange, readOnly }: { value: string; onChange?: (v: string) => void; readOnly?: boolean }) {
  return (
    <input
      type="date"
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      readOnly={readOnly}
      className={INPUT_CLASS}
    />
  );
}

function SectionCard({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="card card-pad scroll-mt-24">
      <h2 className="h3-warm mb-6">{title}</h2>
      {children}
    </section>
  );
}

function formatDate(d: string | null): string {
  if (!d) return "";
  return new Date(d + "T12:00:00").toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });
}

export default function AdminClient({
  projectId,
  role,
  username,
}: {
  projectId: string;
  role: string;
  username: string;
}) {
  // Company Admins and Super Admins are both "admins" on the project, but only
  // Super Admins may change project settings. Regular Company Admins keep a
  // single capability on this page: adding and removing team members.
  const isAdmin = role === "admin" || role === "super_admin";
  const isSuperAdmin = role === "super_admin";

  const [data, setData] = useState<ProjectAdmin | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeSection, setActiveSection] = useState<(typeof ADMIN_SECTIONS)[number]["id"]>("general-information");

  const [stage, setStage] = useState("");
  const [name, setName] = useState("");
  const [projectNumber, setProjectNumber] = useState("");
  const [description, setDescription] = useState("");
  const [sector, setSector] = useState("");
  const [workScope, setWorkScope] = useState("");

  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [stateVal, setStateVal] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [county, setCounty] = useState("");

  const [startDate, setStartDate] = useState("");
  const [actualStartDate, setActualStartDate] = useState("");
  const [completionDate, setCompletionDate] = useState("");
  const [projectedFinishDate, setProjectedFinishDate] = useState("");
  const [warrantyStartDate, setWarrantyStartDate] = useState("");
  const [warrantyEndDate, setWarrantyEndDate] = useState("");

  const [erpSync, setErpSync] = useState(false);
  const [erpJobCostSync, setErpJobCostSync] = useState(false);
  const [preventOverbilling, setPreventOverbilling] = useState(false);
  const [nonCommitmentCosts, setNonCommitmentCosts] = useState(false);
  const [testProject, setTestProject] = useState(false);
  const [laborProductivity, setLaborProductivity] = useState(false);
  const [sage300Id, setSage300Id] = useState("");
  const [qboCustomerId, setQboCustomerId] = useState("");
  const [qboCustomerName, setQboCustomerName] = useState("");
  const [qboOptions, setQboOptions] = useState<{ id: string; label: string; kind: "project" | "subcustomer" | "customer"; parentName: string | null }[]>([]);
  const [qboOptionsLoading, setQboOptionsLoading] = useState(false);
  const [qboOptionsError, setQboOptionsError] = useState("");
  const [reportFields, setReportFields] = useState<ReportFieldValues>({});

  const [copyDirProjects, setCopyDirProjects] = useState<CopyDirProject[]>([]);
  const [copyDirSource, setCopyDirSource] = useState("");
  const [copyingDir, setCopyingDir] = useState(false);
  const [copyDirMsg, setCopyDirMsg] = useState("");

  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [companyUsers, setCompanyUsers] = useState<CompanyUser[]>([]);
  const [memberSearch, setMemberSearch] = useState("");
  const [memberDropdownOpen, setMemberDropdownOpen] = useState(false);
  const [memberActionError, setMemberActionError] = useState("");
  const memberDropdownRef = useRef<HTMLDivElement>(null);

  const loadMembers = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/members`);
    if (!res.ok) return;
    const membersData: Array<{ id: string; role: string; users: { id: string; username: string; email: string; company_id: string | null } | null }> = await res.json();
    setMembers(
      membersData
        .filter((m) => m.users)
        .map((m) => ({
          membership_id: m.id,
          user_id: m.users!.id,
          username: m.users!.username,
          email: m.users!.email,
          role: m.role,
        }))
    );
  }, [projectId]);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/admin`)
      .then((r) => r.json())
      .then((d: ProjectAdmin) => {
        setData(d);
        setStage(d.status ?? "");
        setName(d.name ?? "");
        setProjectNumber(d.project_number ?? "");
        setDescription(d.description ?? "");
        setSector(d.sector ?? "");
        setWorkScope(d.work_scope ?? "");
        setAddress(d.address ?? "");
        setCity(d.city ?? "");
        setStateVal(d.state ?? "");
        setZipCode(d.zip_code ?? "");
        setCounty(d.county ?? "");
        setStartDate(d.start_date ?? "");
        setActualStartDate(d.actual_start_date ?? "");
        setCompletionDate(d.completion_date ?? "");
        setProjectedFinishDate(d.projected_finish_date ?? "");
        setWarrantyStartDate(d.warranty_start_date ?? "");
        setWarrantyEndDate(d.warranty_end_date ?? "");
        setErpSync(d.erp_sync ?? false);
        setErpJobCostSync(d.erp_job_cost_sync ?? false);
        setPreventOverbilling(d.prevent_overbilling ?? false);
        setNonCommitmentCosts(d.non_commitment_costs ?? false);
        setTestProject(d.test_project ?? false);
        setLaborProductivity(d.labor_productivity ?? false);
        setSage300Id(d.sage_300_id ?? "");
        setQboCustomerId(d.qbo_customer_id ?? "");
        setQboCustomerName(d.qbo_customer_name ?? "");
        setReportFields(d.report_fields ?? {});
        setLoading(false);
      });
  }, [projectId]);

  // Lazy-load QBO Projects/Customers for the picker. Best-effort — when QBO
  // isn't connected the endpoint returns 422 and we just leave the dropdown
  // empty (the input still accepts a manual value).
  useEffect(() => {
    setQboOptionsLoading(true);
    setQboOptionsError("");
    fetch("/api/integrations/quickbooks/projects")
      .then(async (r) => ({ ok: r.ok, body: await r.json().catch(() => ({})) }))
      .then(({ ok, body }) => {
        if (!ok) setQboOptionsError(body?.error ?? "");
        else setQboOptions(body?.options ?? []);
      })
      .catch(() => setQboOptionsError("Network error while loading QuickBooks projects."))
      .finally(() => setQboOptionsLoading(false));
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadMembers();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadMembers]);

  useEffect(() => {
    fetch("/api/users")
      .then((r) => r.json())
      .then((d: CompanyUser[]) => setCompanyUsers(d))
      .catch(() => {});
  }, []);

  // Other company projects (active + archived) for the "Copy Directory From"
  // picker. Only Super Admins can use it, so only they fetch the list.
  useEffect(() => {
    if (!isSuperAdmin) return;
    fetch(`/api/projects/${projectId}/copy-directory`)
      .then((r) => (r.ok ? r.json() : { projects: [] }))
      .then((d: { projects?: CopyDirProject[] }) => setCopyDirProjects(d.projects ?? []))
      .catch(() => {});
  }, [projectId, isSuperAdmin]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (memberDropdownRef.current && !memberDropdownRef.current.contains(e.target as Node)) {
        setMemberDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;
        const id = visible.target.getAttribute("id") as (typeof ADMIN_SECTIONS)[number]["id"] | null;
        if (id) setActiveSection(id);
      },
      { rootMargin: "-30% 0px -55% 0px", threshold: [0.2, 0.4, 0.6] }
    );

    ADMIN_SECTIONS.forEach((section) => {
      const element = document.getElementById(section.id);
      if (element) observer.observe(element);
    });

    return () => observer.disconnect();
  }, [loading]);

  async function handleAddMember(userId: string) {
    setMemberActionError("");
    const res = await fetch(`/api/projects/${projectId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, role: "member" }),
    });
    if (res.ok) {
      setMemberSearch("");
      setMemberDropdownOpen(false);
      loadMembers();
    } else {
      const d = await res.json().catch(() => ({}));
      setMemberActionError(d.error || "Failed to add member");
    }
  }

  async function handleRemoveMember(userId: string) {
    setMemberActionError("");
    const res = await fetch(`/api/projects/${projectId}/members`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    if (res.ok) {
      loadMembers();
    } else {
      const d = await res.json().catch(() => ({}));
      setMemberActionError(d.error || "Failed to remove member");
    }
  }

  async function handleSave() {
    setSaving(true);
    const res = await fetch(`/api/projects/${projectId}/admin`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        description,
        project_number: projectNumber,
        status: stage,
        sector,
        work_scope: workScope,
        address,
        city,
        state: stateVal,
        zip_code: zipCode,
        county,
        start_date: startDate || null,
        actual_start_date: actualStartDate || null,
        completion_date: completionDate || null,
        projected_finish_date: projectedFinishDate || null,
        warranty_start_date: warrantyStartDate || null,
        warranty_end_date: warrantyEndDate || null,
        erp_sync: erpSync,
        erp_job_cost_sync: erpJobCostSync,
        prevent_overbilling: preventOverbilling,
        non_commitment_costs: nonCommitmentCosts,
        test_project: testProject,
        labor_productivity: laborProductivity,
        sage_300_id: sage300Id,
        qbo_customer_id: qboCustomerId,
        qbo_customer_name: qboCustomerName,
        report_fields: reportFields,
      }),
    });
    if (res.ok) {
      const updated = await res.json();
      setData(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
    setSaving(false);
  }

  async function handleCopyDirectory() {
    if (!copyDirSource) return;
    const src = copyDirProjects.find((p) => p.id === copyDirSource);
    const srcName = src?.name ?? "the selected project";
    if (
      !confirm(
        `Copy all directory contacts from "${srcName}" into this project? Existing contacts are kept; duplicates (matched by email) are skipped.`
      )
    ) {
      return;
    }
    setCopyingDir(true);
    setCopyDirMsg("");
    const res = await fetch(`/api/projects/${projectId}/copy-directory`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceProjectId: copyDirSource }),
    });
    const d = await res.json().catch(() => ({}));
    if (res.ok) {
      const n = d.copied ?? 0;
      setCopyDirMsg(
        n === 0
          ? "No new contacts to copy — everything already exists in this directory."
          : `Copied ${n} contact${n === 1 ? "" : "s"} from ${srcName}.`
      );
      setCopyDirSource("");
    } else {
      setCopyDirMsg(d.error || "Failed to copy directory.");
    }
    setCopyingDir(false);
  }

  function jumpToSection(id: (typeof ADMIN_SECTIONS)[number]["id"]) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setActiveSection(id);
  }

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <AppHeader username={username} />
      <ProjectNav projectId={projectId} />

      <main className="mx-auto max-w-7xl px-6 py-8">
        {loading ? (
          <p className="text-sm text-gray-500">Loading...</p>
        ) : (
          <>
            <div className="sec-row mb-6">
              <div>
                <h1 className="h2-warm">Project Admin</h1>
                <p className="sub mt-1.5">
                  <em>Settings for</em>{" "}
                  <span className="num">{data?.name || "Untitled Project"}</span>
                  <span className="sep">·</span>
                  <span className="num">{ADMIN_SECTIONS.length}</span> sections
                  <span className="sep">·</span>
                  <span className="num">{members.length}</span> members
                </p>
                {!isAdmin ? (
                  <p className="mt-1 text-xs text-gray-500">View only — contact a project administrator to make changes.</p>
                ) : !isSuperAdmin ? (
                  <p className="mt-1 text-xs text-gray-500">
                    You can add or remove team members below. Only Company Super Admins can change other project settings.
                  </p>
                ) : null}
              </div>
              {isSuperAdmin ? (
                <div className="flex flex-col items-end gap-2">
                  <Pill className="pill-open">Admin controls</Pill>
                  <button onClick={handleSave} disabled={saving} className="btn-primary">
                    {saved ? "Saved" : saving ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              ) : null}
            </div>

            <div className="grid grid-cols-12 gap-5">
              <aside className="col-span-12 lg:col-span-2">
                <div className="sticky top-24 border-l border-black/10 pl-3">
                  {ADMIN_SECTIONS.map((section) => (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() => jumpToSection(section.id)}
                      className={`mb-1 block w-full border-l-2 px-3 py-1.5 text-left text-sm transition-colors ${
                        activeSection === section.id
                          ? "border-[color:var(--brand-500)] bg-[color:var(--surface-sunken)] font-semibold text-[color:var(--ink)]"
                          : "border-transparent text-gray-600 hover:bg-[color:var(--surface-sunken)] hover:text-[color:var(--ink)]"
                      }`}
                    >
                      {section.label}
                    </button>
                  ))}
                </div>
              </aside>

              <section className="col-span-12 space-y-5 lg:col-span-8">
                <SectionCard id="general-information" title="General Information">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <Field label="Project Template">
                        <a className="serif-italic text-[color:var(--brand-700)] underline" href="#">
                          General Project Template
                        </a>
                      </Field>
                    </div>

                    <div className="col-span-2">
                      <Field label="Stage">
                        <SelectInput
                          value={stage}
                          onChange={isSuperAdmin ? setStage : undefined}
                          placeholder="Select stage"
                          options={STAGES}
                          disabled={!isSuperAdmin}
                        />
                      </Field>
                    </div>

                    <Field label="Project Name" required>
                      <TextInput value={name} onChange={isSuperAdmin ? setName : undefined} readOnly={!isSuperAdmin} placeholder="Project name" />
                    </Field>

                    <Field label="Project Number">
                      <TextInput
                        value={projectNumber}
                        onChange={isSuperAdmin ? setProjectNumber : undefined}
                        readOnly={!isSuperAdmin}
                        placeholder="Project number"
                      />
                    </Field>

                    <Field label="Work Scope">
                      <SelectInput
                        value={workScope}
                        onChange={isSuperAdmin ? setWorkScope : undefined}
                        placeholder="Select work scope"
                        options={workScope && !WORK_SCOPES.includes(workScope) ? [workScope, ...WORK_SCOPES] : WORK_SCOPES}
                        disabled={!isSuperAdmin}
                      />
                    </Field>

                    <Field label="Project Sector">
                      <SelectInput
                        value={sector}
                        onChange={isSuperAdmin ? setSector : undefined}
                        placeholder="Select a sector"
                        options={sector && !SECTORS.includes(sector) ? [sector, ...SECTORS] : SECTORS}
                        disabled={!isSuperAdmin}
                      />
                    </Field>

                    <div className="col-span-2">
                      <Field label="Delivery Method">
                        <SelectInput value="" placeholder="Select delivery method" options={["Design-Bid-Build", "Design-Build"]} disabled />
                      </Field>
                    </div>

                    <div className="col-span-2">
                      <Field label="Description">
                        <textarea
                          value={description}
                          onChange={(e) => isSuperAdmin && setDescription(e.target.value)}
                          rows={4}
                          readOnly={!isSuperAdmin}
                          placeholder="Enter description"
                          className="w-full rounded-md border border-black/10 bg-[color:var(--surface-sunken)] px-3 py-2 text-sm text-[color:var(--ink)] placeholder:text-gray-400 focus:border-[color:var(--ink)] focus:outline-none focus:ring-1 focus:ring-[color:var(--ink)]"
                        />
                      </Field>
                    </div>
                  </div>
                </SectionCard>

                <SectionCard id="project-location" title="Project Location">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <Field label="Country" required>
                        <TextInput value="United States" readOnly />
                      </Field>
                    </div>
                    <div className="col-span-2">
                      <Field label="Street Address">
                        <TextInput value={address} onChange={isSuperAdmin ? setAddress : undefined} readOnly={!isSuperAdmin} placeholder="Street address" />
                      </Field>
                    </div>
                    <Field label="City">
                      <TextInput value={city} onChange={isSuperAdmin ? setCity : undefined} readOnly={!isSuperAdmin} placeholder="City" />
                    </Field>
                    <Field label="State">
                      <TextInput value={stateVal} onChange={isSuperAdmin ? setStateVal : undefined} readOnly={!isSuperAdmin} placeholder="State" />
                    </Field>
                    <Field label="Zip Code">
                      <TextInput value={zipCode} onChange={isSuperAdmin ? setZipCode : undefined} readOnly={!isSuperAdmin} placeholder="Zip code" />
                    </Field>
                    <Field label="County">
                      <TextInput value={county} onChange={isSuperAdmin ? setCounty : undefined} readOnly={!isSuperAdmin} placeholder="County" />
                    </Field>
                    <div className="col-span-2">
                      <Field label="Timezone" required>
                        <TextInput value="Eastern Time (US & Canada)" readOnly />
                      </Field>
                    </div>
                    <Field label="Latitude">
                      <TextInput value="35.86141" readOnly />
                    </Field>
                    <Field label="Longitude">
                      <TextInput value="-78.573579" readOnly />
                    </Field>
                    <Field label="Phone">
                      <TextInput value="" readOnly placeholder="Enter phone number" />
                    </Field>
                    <Field label="Fax">
                      <TextInput value="" readOnly placeholder="Enter fax number" />
                    </Field>
                  </div>
                </SectionCard>

                <SectionCard id="building-code" title="Building Code">
                  <BuildingCodeSection projectId={projectId} isAdmin={isSuperAdmin} />
                </SectionCard>

                <SectionCard id="erp-integration" title="ERP Integration">
                  <div className="space-y-4">
                    <p className="text-xs text-gray-500">
                      Only Company Super Admins can change ERP integration settings.
                    </p>
                    <label className="flex items-center gap-3 text-sm text-[color:var(--ink)]">
                      <input
                        type="checkbox"
                        className="h-5 w-5 accent-[color:var(--ink)]"
                        checked={erpSync}
                        onChange={(e) => isSuperAdmin && setErpSync(e.target.checked)}
                        disabled={!isSuperAdmin}
                      />{" "}
                      ERP-sync this project
                    </label>
                    <label className="flex items-center gap-3 text-sm text-[color:var(--ink)]">
                      <input
                        type="checkbox"
                        className="h-5 w-5 accent-[color:var(--ink)]"
                        checked={erpJobCostSync}
                        onChange={(e) => isSuperAdmin && setErpJobCostSync(e.target.checked)}
                        disabled={!isSuperAdmin}
                      />{" "}
                      Enable ERP Job Cost Transaction Syncing
                    </label>
                    <div className="max-w-xl">
                      <Field label="Sage 300 ID:">
                        <TextInput
                          value={sage300Id}
                          onChange={isSuperAdmin ? setSage300Id : undefined}
                          readOnly={!isSuperAdmin}
                          placeholder="Enter Sage 300 ID"
                        />
                      </Field>
                    </div>
                    <div className="max-w-xl space-y-2 pt-2 border-t border-gray-100">
                      <Field label="QuickBooks Project / Customer:">
                        <select
                          value={qboCustomerId}
                          onChange={(e) => {
                            if (!isSuperAdmin) return;
                            const id = e.target.value;
                            setQboCustomerId(id);
                            const opt = qboOptions.find((o) => o.id === id);
                            setQboCustomerName(opt?.label ?? "");
                          }}
                          disabled={!isSuperAdmin}
                          className="h-11 w-full rounded-md border border-black/10 bg-[color:var(--surface-sunken)] px-3 text-sm text-[color:var(--ink)] focus:border-[color:var(--ink)] focus:outline-none focus:ring-1 focus:ring-[color:var(--ink)] disabled:cursor-not-allowed"
                        >
                          <option value="">
                            {qboOptionsLoading
                              ? "Loading QuickBooks projects…"
                              : qboOptionsError
                                ? "Auto-match by project name"
                                : qboOptions.length === 0
                                  ? "QuickBooks not connected — auto-match by name"
                                  : "Auto-match by project name (default)"}
                          </option>
                          {qboOptions.map((o) => {
                            const badge = o.kind === "project" ? "Project" : o.kind === "subcustomer" ? "Customer:Job" : "Customer";
                            return (
                              <option key={o.id} value={o.id}>
                                {`[${badge}] ${o.label}`}
                              </option>
                            );
                          })}
                        </select>
                      </Field>
                      <p className="text-xs text-gray-500">
                        Pin this SiteCommand project to a specific QuickBooks <strong>Project</strong> (recommended for
                        GC files in QBO Plus/Advanced) or a Customer:Job. <em>Resync with ERP</em> will pull job-to-date
                        costs from transactions assigned to this QBO record. Leave blank to fall back to auto-matching
                        by project name.
                      </p>
                      {qboCustomerName && qboCustomerId && (
                        <p className="text-xs text-gray-400">
                          Currently pinned to: <span className="font-mono">{qboCustomerName}</span>
                        </p>
                      )}
                      {qboOptionsError && (
                        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded px-2 py-1">
                          {qboOptionsError}
                        </p>
                      )}
                    </div>
                  </div>
                </SectionCard>

                <SectionCard id="advanced" title="Advanced">
                  <div className="grid grid-cols-2 gap-4">
                    <p className="col-span-2 text-xs text-gray-500">
                      Only Company Super Admins can change these settings.
                    </p>
                    <div className="col-span-2">
                      <Field label="Department">
                        <SelectInput value="" placeholder="Select department" options={["Operations", "Preconstruction"]} disabled />
                      </Field>
                    </div>
                    <div className="col-span-2">
                      <Field label="Copy Directory From">
                        <div className="flex gap-2">
                          <select
                            value={copyDirSource}
                            onChange={(e) => {
                              setCopyDirSource(e.target.value);
                              setCopyDirMsg("");
                            }}
                            disabled={!isSuperAdmin}
                            className={`${INPUT_CLASS} flex-1`}
                          >
                            <option value="">Select project</option>
                            {copyDirProjects.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                                {p.archived ? " (Archived)" : ""}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={handleCopyDirectory}
                            disabled={!isSuperAdmin || !copyDirSource || copyingDir}
                            className="btn-secondary whitespace-nowrap"
                          >
                            {copyingDir ? "Copying…" : "Copy Directory"}
                          </button>
                        </div>
                        {copyDirMsg ? <p className="mt-1.5 text-xs text-gray-500">{copyDirMsg}</p> : null}
                      </Field>
                    </div>

                    <label className="flex items-center gap-3 text-base text-gray-900">
                      <input
                        type="checkbox"
                        className="h-5 w-5"
                        checked={preventOverbilling}
                        onChange={(e) => isSuperAdmin && setPreventOverbilling(e.target.checked)}
                        disabled={!isSuperAdmin}
                      />{" "}
                      Prevent Overbilling on this Project
                    </label>
                    <label className="flex items-center gap-3 text-base text-gray-900">
                      <input
                        type="checkbox"
                        className="h-5 w-5"
                        checked={nonCommitmentCosts}
                        onChange={(e) => isSuperAdmin && setNonCommitmentCosts(e.target.checked)}
                        disabled={!isSuperAdmin}
                      />{" "}
                      Non-Commitment Costs
                    </label>

                    <label className="col-span-2 flex items-center gap-3 text-base text-gray-900">
                      <input
                        type="checkbox"
                        className="h-5 w-5"
                        checked={laborProductivity}
                        onChange={(e) => isSuperAdmin && setLaborProductivity(e.target.checked)}
                        disabled={!isSuperAdmin}
                      />{" "}
                      Labor Productivity for Budget, Change Events, and Change Orders
                    </label>

                    <label className="col-span-2 flex items-center gap-3 text-base text-gray-900">
                      <input
                        type="checkbox"
                        className="h-5 w-5"
                        checked={testProject}
                        onChange={(e) => isSuperAdmin && setTestProject(e.target.checked)}
                        disabled={!isSuperAdmin}
                      />{" "}
                      Test Project
                    </label>
                  </div>
                </SectionCard>

                <SectionCard id="dates" title="Dates">
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Start Date" required>
                      {isSuperAdmin ? <DateInput value={startDate} onChange={setStartDate} /> : <TextInput value={formatDate(data?.start_date ?? null)} readOnly />}
                    </Field>
                    <Field label="Actual Start Date">
                      {isSuperAdmin ? (
                        <DateInput value={actualStartDate} onChange={setActualStartDate} />
                      ) : (
                        <TextInput value={formatDate(data?.actual_start_date ?? null)} readOnly />
                      )}
                    </Field>
                    <Field label="Completion Date" required>
                      {isSuperAdmin ? (
                        <DateInput value={completionDate} onChange={setCompletionDate} />
                      ) : (
                        <TextInput value={formatDate(data?.completion_date ?? null)} readOnly />
                      )}
                    </Field>
                    <Field label="Projected Finish Date">
                      {isSuperAdmin ? (
                        <DateInput value={projectedFinishDate} onChange={setProjectedFinishDate} />
                      ) : (
                        <TextInput value={formatDate(data?.projected_finish_date ?? null)} readOnly />
                      )}
                    </Field>
                    <Field label="Warranty Start Date">
                      {isSuperAdmin ? (
                        <DateInput value={warrantyStartDate} onChange={setWarrantyStartDate} />
                      ) : (
                        <TextInput value={formatDate(data?.warranty_start_date ?? null)} readOnly />
                      )}
                    </Field>
                    <Field label="Warranty End Date">
                      {isSuperAdmin ? (
                        <DateInput value={warrantyEndDate} onChange={setWarrantyEndDate} />
                      ) : (
                        <TextInput value={formatDate(data?.warranty_end_date ?? null)} readOnly />
                      )}
                    </Field>
                  </div>
                </SectionCard>

                <SectionCard id="additional-information" title="Additional Information">
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Total Value" required>
                      <TextInput value="6,000,000" readOnly />
                    </Field>
                    <Field label="Language - Country">
                      <TextInput value="English (United States)" readOnly />
                    </Field>
                    <Field label="Code">
                      <TextInput value="" readOnly placeholder="Enter code" />
                    </Field>
                    <Field label="Bid Type">
                      <SelectInput value="" placeholder="Select bid type" options={["Lump Sum", "GMP"]} disabled />
                    </Field>
                    <Field label="Type">
                      <SelectInput value="" placeholder="Select type" options={["New Construction", "Renovation"]} disabled />
                    </Field>
                    <Field label="Parent Project">
                      <SelectInput value="" placeholder="Select parent project" options={["Corporate Program"]} disabled />
                    </Field>
                    <div className="col-span-2">
                      <fieldset disabled={!isSuperAdmin} className="m-0 min-w-0 border-0 p-0 disabled:opacity-60">
                        <ReportFieldsSection
                          title="Report Fields"
                          description="Extra project attributes surfaced as columns in 360 Reports. Saved with the project."
                          fields={PROJECT_REPORT_FIELDS}
                          values={reportFields}
                          onChange={(key, value) =>
                            isSuperAdmin && setReportFields((prev) => ({ ...prev, [key]: value }))
                          }
                          columns={3}
                        />
                      </fieldset>
                    </div>
                    <div className="col-span-2 border-t border-gray-200 pt-3">
                      <h3 className="mb-2 text-xl font-semibold text-gray-900">Project Members</h3>
                      {members.length === 0 ? (
                        <p className="text-sm text-gray-500">No members added yet.</p>
                      ) : (
                        <div className="space-y-1">
                          {members.map((m) => (
                            <div key={m.user_id} className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-gray-900">{m.username}</p>
                                <p className="truncate text-xs text-gray-500">{m.email}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-500 capitalize">{m.role.replace("_", " ")}</span>
                                {isAdmin ? (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveMember(m.user_id)}
                                    className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                                  >
                                    Remove
                                  </button>
                                ) : null}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {isAdmin ? (
                        <div ref={memberDropdownRef} className="relative mt-4">
                          <label className="mb-1.5 block text-sm font-semibold text-[#1f2937]">Add member</label>
                          <input
                            type="text"
                            value={memberSearch}
                            onChange={(e) => {
                              setMemberSearch(e.target.value);
                              setMemberDropdownOpen(true);
                            }}
                            onFocus={() => setMemberDropdownOpen(true)}
                            placeholder="Search by name or email..."
                            className="h-11 w-full rounded-md border border-gray-300 bg-gray-50 px-3 text-sm text-gray-700 placeholder:text-gray-400 focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-400"
                          />
                          {memberDropdownOpen && (() => {
                            const memberUserIds = new Set(members.map((m) => m.user_id));
                            const filtered = companyUsers.filter(
                              (u) =>
                                !memberUserIds.has(u.id) &&
                                (u.username.toLowerCase().includes(memberSearch.toLowerCase()) ||
                                  u.email.toLowerCase().includes(memberSearch.toLowerCase()))
                            );
                            if (filtered.length === 0) {
                              return memberSearch ? (
                                <div className="absolute left-0 right-0 top-full z-20 mt-1 rounded-md border border-gray-200 bg-white px-3 py-2 shadow-lg">
                                  <p className="text-xs text-gray-500">No matching members found</p>
                                </div>
                              ) : null;
                            }
                            return (
                              <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-48 overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg">
                                {filtered.map((u) => (
                                  <button
                                    key={u.id}
                                    type="button"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => handleAddMember(u.id)}
                                    className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-gray-50"
                                  >
                                    <span className="text-sm font-medium text-gray-900">{u.username}</span>
                                    <span className="text-xs text-gray-500">{u.email}</span>
                                  </button>
                                ))}
                              </div>
                            );
                          })()}
                          {memberActionError ? <p className="mt-2 text-xs text-red-600">{memberActionError}</p> : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </SectionCard>
              </section>

              <aside className="col-span-12 lg:col-span-2">
                <div className="sticky top-24 rounded-lg border border-gray-200 bg-white p-4">
                  <h3 className="mb-4 text-xs font-bold tracking-wide text-gray-700">PROJECT SETTINGS</h3>
                  <div className="space-y-1">
                    <button
                      type="button"
                      onClick={() => jumpToSection("general-information")}
                      className="w-full border-l-4 border-orange-500 bg-gray-100 px-3 py-2 text-left text-sm font-semibold text-gray-700"
                    >
                      General
                    </button>
                    <button
                      type="button"
                      onClick={() => jumpToSection("project-location")}
                      className="w-full px-3 py-2 text-left text-sm text-gray-600 hover:bg-gray-50"
                    >
                      Locations
                    </button>
                  </div>
                </div>
              </aside>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
