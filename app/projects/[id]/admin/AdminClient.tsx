"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import ProjectNav from "@/components/ProjectNav";
import AppHeader from "@/app/components/AppHeader";
import { Pill } from "@/components/design-system/Primitives";

type ProjectAdmin = {
  id: string;
  name: string;
  description: string | null;
  project_number: string | null;
  status: string | null;
  sector: string | null;
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
};

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

const ADMIN_SECTIONS = [
  { id: "general-information", label: "General Information" },
  { id: "project-location", label: "Project Location" },
  { id: "erp-integration", label: "ERP Integration" },
  { id: "advanced", label: "Advanced" },
  { id: "dates", label: "Dates" },
  { id: "additional-information", label: "Additional Information" },
] as const;

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
      <label className="mb-1.5 block text-sm font-semibold text-[#1f2937]">
        {label}
        {required ? <span className="ml-1 text-red-500">*</span> : null}
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
      className="h-11 w-full rounded-md border border-gray-300 bg-gray-50 px-3 text-sm text-gray-700 placeholder:text-gray-400 focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-400 read-only:cursor-default"
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
      className="h-11 w-full rounded-md border border-gray-300 bg-gray-50 px-3 text-sm text-gray-700 focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-400 disabled:cursor-not-allowed"
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
      className="h-11 w-full rounded-md border border-gray-300 bg-gray-50 px-3 text-sm text-gray-700 focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-400"
    />
  );
}

function SectionCard({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="mb-6 text-3xl font-semibold text-gray-900">{title}</h2>
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
  const isAdmin = role === "admin" || role === "super_admin";

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
        setLoading(false);
      });
  }, [projectId]);

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

  function jumpToSection(id: (typeof ADMIN_SECTIONS)[number]["id"]) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setActiveSection(id);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader username={username} />
      <ProjectNav projectId={projectId} />

      <main className="mx-auto max-w-7xl px-6 py-8">
        {loading ? (
          <p className="text-sm text-gray-500">Loading...</p>
        ) : (
          <>
            <div className="flex items-end justify-between mb-6 gap-4 flex-wrap">
              <div>
                <h1 className="font-display text-[28px] leading-tight text-[color:var(--ink)]">Project Admin</h1>
                <p className="mt-1 text-base text-gray-700">{data?.name || "Untitled Project"}</p>
                {!isAdmin ? (
                  <p className="mt-1 text-xs text-gray-500">View only — contact a project administrator to make changes.</p>
                ) : null}
              </div>
              {isAdmin ? (
                <div className="flex flex-col items-end gap-2">
                  <Pill className="pill-open">Admin controls</Pill>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="rounded-md bg-[color:var(--ink)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saved ? "Saved" : saving ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              ) : null}
            </div>

            <div className="grid grid-cols-12 gap-5">
              <aside className="col-span-12 lg:col-span-2">
                <div className="sticky top-24 border-l border-gray-300 pl-3">
                  {ADMIN_SECTIONS.map((section) => (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() => jumpToSection(section.id)}
                      className={`mb-1 block w-full border-l-2 px-3 py-1.5 text-left text-sm ${
                        activeSection === section.id
                          ? "border-gray-900 bg-gray-100 font-semibold text-gray-900"
                          : "border-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-900"
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
                        <a className="text-lg text-blue-600 underline" href="#">
                          General Project Template
                        </a>
                      </Field>
                    </div>

                    <div className="col-span-2">
                      <Field label="Stage">
                        <SelectInput
                          value={stage}
                          onChange={isAdmin ? setStage : undefined}
                          placeholder="Select stage"
                          options={STAGES}
                          disabled={!isAdmin}
                        />
                      </Field>
                    </div>

                    <Field label="Project Name" required>
                      <TextInput value={name} onChange={isAdmin ? setName : undefined} readOnly={!isAdmin} placeholder="Project name" />
                    </Field>

                    <Field label="Project Number">
                      <TextInput
                        value={projectNumber}
                        onChange={isAdmin ? setProjectNumber : undefined}
                        readOnly={!isAdmin}
                        placeholder="Project number"
                      />
                    </Field>

                    <Field label="Project ID">
                      <TextInput value={data?.id ?? ""} readOnly />
                    </Field>

                    <Field label="Work Scope">
                      <SelectInput value="" placeholder="Select work scope" options={["Commercial", "Residential", "Industrial"]} disabled />
                    </Field>

                    <Field label="Project Sector">
                      <TextInput value={sector} onChange={isAdmin ? setSector : undefined} readOnly={!isAdmin} placeholder="Sector" />
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
                          onChange={(e) => isAdmin && setDescription(e.target.value)}
                          rows={4}
                          readOnly={!isAdmin}
                          placeholder="Enter description"
                          className="w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-700 placeholder:text-gray-400 focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-400"
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
                        <TextInput value={address} onChange={isAdmin ? setAddress : undefined} readOnly={!isAdmin} placeholder="Street address" />
                      </Field>
                    </div>
                    <Field label="City">
                      <TextInput value={city} onChange={isAdmin ? setCity : undefined} readOnly={!isAdmin} placeholder="City" />
                    </Field>
                    <Field label="State">
                      <TextInput value={stateVal} onChange={isAdmin ? setStateVal : undefined} readOnly={!isAdmin} placeholder="State" />
                    </Field>
                    <Field label="Zip Code">
                      <TextInput value={zipCode} onChange={isAdmin ? setZipCode : undefined} readOnly={!isAdmin} placeholder="Zip code" />
                    </Field>
                    <Field label="County">
                      <TextInput value={county} onChange={isAdmin ? setCounty : undefined} readOnly={!isAdmin} placeholder="County" />
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

                <SectionCard id="erp-integration" title="ERP Integration">
                  <div className="space-y-4">
                    <label className="flex items-center gap-3 text-base text-gray-900">
                      <input type="checkbox" className="h-5 w-5" checked readOnly /> ERP-sync this project
                    </label>
                    <label className="flex items-center gap-3 text-base text-gray-900">
                      <input type="checkbox" className="h-5 w-5" readOnly /> Enable ERP Job Cost Transaction Syncing
                    </label>
                    <div className="max-w-xl">
                      <Field label="Sage 300 ID:">
                        <TextInput value={projectNumber} readOnly />
                      </Field>
                    </div>
                  </div>
                </SectionCard>

                <SectionCard id="advanced" title="Advanced">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <Field label="Department">
                        <SelectInput value="" placeholder="Select department" options={["Operations", "Preconstruction"]} disabled />
                      </Field>
                    </div>
                    <div className="col-span-2">
                      <Field label="Copy Directory From">
                        <SelectInput value="" placeholder="Select project" options={["Project Alpha", "Project Bravo"]} disabled />
                      </Field>
                    </div>

                    <label className="flex items-center gap-3 text-base text-gray-900">
                      <input type="checkbox" className="h-5 w-5" checked readOnly /> Prevent Overbilling on this Project
                    </label>
                    <label className="flex items-center gap-3 text-base text-gray-900">
                      <input type="checkbox" className="h-5 w-5" readOnly /> Non-Commitment Costs
                    </label>

                    <label className="col-span-2 flex items-center gap-3 text-base text-gray-900">
                      <input type="checkbox" className="h-5 w-5" readOnly /> Test Project
                    </label>
                  </div>
                </SectionCard>

                <SectionCard id="dates" title="Dates">
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Start Date" required>
                      {isAdmin ? <DateInput value={startDate} onChange={setStartDate} /> : <TextInput value={formatDate(data?.start_date ?? null)} readOnly />}
                    </Field>
                    <Field label="Actual Start Date">
                      {isAdmin ? (
                        <DateInput value={actualStartDate} onChange={setActualStartDate} />
                      ) : (
                        <TextInput value={formatDate(data?.actual_start_date ?? null)} readOnly />
                      )}
                    </Field>
                    <Field label="Completion Date" required>
                      {isAdmin ? (
                        <DateInput value={completionDate} onChange={setCompletionDate} />
                      ) : (
                        <TextInput value={formatDate(data?.completion_date ?? null)} readOnly />
                      )}
                    </Field>
                    <Field label="Projected Finish Date">
                      {isAdmin ? (
                        <DateInput value={projectedFinishDate} onChange={setProjectedFinishDate} />
                      ) : (
                        <TextInput value={formatDate(data?.projected_finish_date ?? null)} readOnly />
                      )}
                    </Field>
                    <Field label="Warranty Start Date">
                      {isAdmin ? (
                        <DateInput value={warrantyStartDate} onChange={setWarrantyStartDate} />
                      ) : (
                        <TextInput value={formatDate(data?.warranty_start_date ?? null)} readOnly />
                      )}
                    </Field>
                    <Field label="Warranty End Date">
                      {isAdmin ? (
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
