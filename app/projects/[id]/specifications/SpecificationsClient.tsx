"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, Upload, ChevronDown, X, Plus, Settings, Info } from "lucide-react";
import ProjectNav from "@/components/ProjectNav";
import AppHeader from "@/app/components/AppHeader";

type Specification = {
  id: string;
  name: string;
  code: string | null;
  deleted_at?: string | null;
};

type Division = {
  number: string;
  description: string;
};

type TopTab = "specifications" | "all-revisions" | "recycle-bin";

export default function SpecificationsClient({ projectId, username }: { projectId: string; username?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [specifications, setSpecifications] = useState<Specification[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<TopTab>("specifications");
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showCreateDivisionModal, setShowCreateDivisionModal] = useState(false);
  const [showCreateSpecificationModal, setShowCreateSpecificationModal] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([{ number: "100", description: "Unclassified" }]);
  const [newDivisionNumber, setNewDivisionNumber] = useState("");
  const [newDivisionDescription, setNewDivisionDescription] = useState("");
  const [newSpecificationDivision, setNewSpecificationDivision] = useState("100");
  const [newSpecificationNumber, setNewSpecificationNumber] = useState("");
  const [newSpecificationDescription, setNewSpecificationDescription] = useState("");
  const [selectedSpecIdForSubmittal, setSelectedSpecIdForSubmittal] = useState<string | null>(null);
  const [isCreatingSpecification, setIsCreatingSpecification] = useState(false);

  const exportMenuRef = useRef<HTMLDivElement | null>(null);
  const isGenerateSubmittalFlow = searchParams.get("generateSubmittal") === "1";
  const returnTo = searchParams.get("returnTo") || `/projects/${projectId}/submittals?openCreate=1`;

  useEffect(() => {
    let mounted = true;
    async function loadSpecifications() {
      try {
        const res = await fetch(`/api/projects/${projectId}/specifications`);
        const data = await res.json();
        if (!mounted) return;
        setSpecifications(Array.isArray(data) ? data : []);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadSpecifications();
    return () => {
      mounted = false;
    };
  }, [projectId]);

  useEffect(() => {
    setDivisions((current) => {
      const seenNumbers = new Set(current.map((division) => division.number));
      const inferredDivisions: Division[] = [];
      specifications.forEach((spec) => {
        const match = spec.code?.match(/^\s*(\d{2,3})/);
        if (!match) return;
        const number = match[1];
        if (seenNumbers.has(number)) return;
        seenNumbers.add(number);
        inferredDivisions.push({ number, description: `Division ${number}` });
      });
      if (inferredDivisions.length === 0) return current;
      return [...current, ...inferredDivisions].sort((a, b) => a.number.localeCompare(b.number));
    });
  }, [specifications]);

  useEffect(() => {
    function onDocumentClick(e: MouseEvent) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    }
    document.addEventListener("mousedown", onDocumentClick);
    return () => document.removeEventListener("mousedown", onDocumentClick);
  }, []);

  const visibleSpecifications = useMemo(() => {
    if (activeTab === "recycle-bin") {
      return specifications.filter((spec) => Boolean(spec.deleted_at));
    }
    return specifications.filter((spec) => !spec.deleted_at);
  }, [activeTab, specifications]);

  const filteredSpecifications = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return visibleSpecifications;
    return visibleSpecifications.filter((spec) => {
      return spec.name.toLowerCase().includes(query) || (spec.code ?? "").toLowerCase().includes(query);
    });
  }, [search, visibleSpecifications]);

  const visibleDivisions = useMemo(
    () => [...divisions].sort((a, b) => a.number.localeCompare(b.number)),
    [divisions]
  );

  const displayedDivisions = useMemo(() => {
    if (activeTab !== "recycle-bin") return visibleDivisions;

    const recycleDivisionNumbers = new Set(
      filteredSpecifications.map((spec) => spec.code?.match(/^\s*(\d{2,3})/)?.[1] ?? "100")
    );

    return visibleDivisions.filter((division) => recycleDivisionNumbers.has(division.number));
  }, [activeTab, filteredSpecifications, visibleDivisions]);

  const specificationsByDivision = useMemo(() => {
    const grouped = new Map<string, Specification[]>();
    visibleDivisions.forEach((division) => grouped.set(division.number, []));

    filteredSpecifications.forEach((spec) => {
      const match = spec.code?.match(/^\s*(\d{2,3})/);
      const divisionNumber = match?.[1] ?? "100";
      const existing = grouped.get(divisionNumber) ?? [];
      grouped.set(divisionNumber, [...existing, spec]);
    });

    return grouped;
  }, [filteredSpecifications, visibleDivisions]);

  useEffect(() => {
    if (!isGenerateSubmittalFlow) return;
    if (selectedSpecIdForSubmittal) return;
    if (specifications.length === 0) return;
    setSelectedSpecIdForSubmittal(specifications[0].id);
  }, [isGenerateSubmittalFlow, selectedSpecIdForSubmittal, specifications]);

  function handleOpenSpecBook() {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.title = "Open Specification Book";
    win.document.body.style.margin = "0";
    win.document.body.style.height = "100vh";
    win.document.body.style.background = "#000";
  }

  function handleExport(format: "pdf" | "csv") {
    setShowExportMenu(false);
    window.alert(`Export as ${format.toUpperCase()} is coming soon.`);
  }

  function handleAttachFiles(fileList: FileList | null) {
    if (!fileList?.length) return;
    setUploadFiles(Array.from(fileList));
  }

  function closeCreateDivisionModal() {
    setShowCreateDivisionModal(false);
    setNewDivisionNumber("");
    setNewDivisionDescription("");
  }

  function closeCreateSpecificationModal() {
    setShowCreateSpecificationModal(false);
    setNewSpecificationDivision(divisions[0]?.number ?? "100");
    setNewSpecificationNumber("");
    setNewSpecificationDescription("");
  }

  function handleCreateDivision() {
    if (!newDivisionNumber.trim() || !newDivisionDescription.trim()) return;
    const nextDivision = { number: newDivisionNumber.trim(), description: newDivisionDescription.trim() };
    setDivisions((current) => {
      const deduped = current.filter((division) => division.number !== nextDivision.number);
      return [...deduped, nextDivision].sort((a, b) => a.number.localeCompare(b.number));
    });
    closeCreateDivisionModal();
  }

  async function handleCreateSpecification() {
    if (!newSpecificationDivision.trim() || !newSpecificationNumber.trim()) return;
    const division = divisions.find((item) => item.number === newSpecificationDivision);
    const specName = newSpecificationDescription.trim() || "Untitled Specification";
    const specCode = `${newSpecificationDivision} ${newSpecificationNumber.trim()}`;
    const suffix = division?.description ? ` - ${division.description}` : "";
    setIsCreatingSpecification(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/specifications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: specName,
          code: `${specCode}${suffix}`,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Failed to create specification");
      }

      const createdSpec = (await res.json()) as Specification;
      setSpecifications((current) =>
        [createdSpec, ...current].sort((a, b) => a.name.localeCompare(b.name))
      );
      if (isGenerateSubmittalFlow) {
        setSelectedSpecIdForSubmittal(createdSpec.id);
      }
      closeCreateSpecificationModal();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create specification";
      window.alert(message);
    } finally {
      setIsCreatingSpecification(false);
    }
  }

  function handleGenerateSubmittal() {
    if (!selectedSpecIdForSubmittal) return;
    const separator = returnTo.includes("?") ? "&" : "?";
    router.push(`${returnTo}${separator}specificationId=${encodeURIComponent(selectedSpecIdForSubmittal)}`);
  }

  const canCreateDivision = Boolean(newDivisionNumber.trim() && newDivisionDescription.trim());
  const canCreateSpecification = Boolean(newSpecificationDivision.trim() && newSpecificationNumber.trim());

  const topTabs: Array<{ key: TopTab; label: string }> = [
    { key: "specifications", label: "Specifications" },
    { key: "all-revisions", label: "All Revisions" },
    { key: "recycle-bin", label: "Recycle Bin" },
  ];

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <AppHeader username={username} />
      <ProjectNav projectId={projectId} />

      <div className="px-6 pt-8 pb-4 bg-gray-50">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-display text-[28px] leading-tight text-[color:var(--ink)]">Specifications</h1>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <button
              type="button"
              onClick={() => setShowUploadModal(true)}
              className="rounded-md bg-[color:var(--ink)] px-4 py-2 text-sm font-semibold text-white hover:bg-black transition-colors"
            >
              Upload
            </button>
            <button
              type="button"
              onClick={handleOpenSpecBook}
              className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Open Specification Book
            </button>

            <div className="relative" ref={exportMenuRef}>
              <button
                type="button"
                onClick={() => setShowExportMenu((s) => !s)}
                className="flex items-center gap-2 rounded border border-gray-300 bg-white px-3 py-2 font-medium text-gray-700 hover:bg-gray-50"
              >
                Export
                <ChevronDown className="h-4 w-4" />
              </button>
              {showExportMenu && (
                <div className="absolute right-0 z-20 mt-1 w-40 overflow-hidden rounded border border-gray-200 bg-white shadow-lg">
                  <button
                    type="button"
                    onClick={() => handleExport("pdf")}
                    className="block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Export as PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExport("csv")}
                    className="block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Export as CSV
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="px-4">
          <div className="flex gap-6 text-sm">
            {topTabs.map((tab) => {
              const active = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`border-b-2 pb-2 pt-1 ${active ? "border-gray-900 font-semibold text-gray-900" : "border-transparent text-gray-600 hover:text-gray-900"}`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="border-y border-gray-200 bg-gray-100 px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative min-w-[280px] flex-1 max-w-xl">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search"
              className="w-full rounded border border-gray-400 bg-white py-2 pl-9 pr-3 text-sm outline-none ring-0 placeholder:text-gray-500 focus:border-gray-600"
            />
          </div>
          <div className="flex items-center gap-5 text-sm font-medium text-gray-800">
            <button
              type="button"
              onClick={() => setShowCreateDivisionModal(true)}
              className="flex items-center gap-1 hover:text-black"
            >
              <Plus className="h-4 w-4" />
              Create Division
            </button>
            <button
              type="button"
              onClick={() => setShowCreateSpecificationModal(true)}
              className="flex items-center gap-1 hover:text-black"
            >
              <Plus className="h-4 w-4" />
              Create Specification
            </button>
          </div>
        </div>
      </div>

      <section className="px-4 py-5">
        {isGenerateSubmittalFlow && (
          <div className="mb-4 rounded border border-orange-200 bg-orange-50 px-4 py-3">
            <p className="text-sm font-medium text-gray-800">Select a specification, then click <span className="font-semibold">Generate Submittal</span> to return to the submittal form.</p>
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={handleGenerateSubmittal}
                disabled={!selectedSpecIdForSubmittal}
                className="rounded-md bg-[color:var(--ink)] px-4 py-2 text-sm font-semibold text-white hover:bg-black transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              >
                Generate Submittal
              </button>
            </div>
          </div>
        )}
        {loading ? (
          <div className="rounded border border-gray-200 bg-white p-6 text-sm text-gray-500">Loading specifications…</div>
        ) : (
          <div className="space-y-3">
            {displayedDivisions.map((division) => {
              const divisionSpecs = specificationsByDivision.get(division.number) ?? [];
              return (
                <div key={division.number} className="overflow-hidden rounded border border-gray-200 bg-white">
                  <div className="border-b border-gray-200 bg-[#dde2ec] px-4 py-3 text-xl font-semibold text-gray-900">
                    {division.number} - {division.description} ({divisionSpecs.length})
                  </div>
                  {divisionSpecs.length === 0 ? (
                    <div className="px-4 py-5 text-sm text-gray-500">No specifications in this division yet.</div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                        <tr>
                          <th className="w-20 px-4 py-3">
                            <input type="checkbox" className="h-4 w-4 rounded border-gray-300" aria-label="Select all specifications" />
                          </th>
                          <th className="px-4 py-3">Number</th>
                          <th className="px-4 py-3">Description</th>
                          <th className="px-4 py-3">Revision</th>
                          <th className="px-4 py-3">Date Issued</th>
                          <th className="px-4 py-3">Date Received</th>
                          <th className="px-4 py-3">Set</th>
                        </tr>
                      </thead>
                      <tbody>
                        {divisionSpecs.map((spec) => (
                          <tr key={spec.id} className="border-t border-gray-100 hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                {isGenerateSubmittalFlow ? (
                                  <input
                                    type="radio"
                                    name="selected-specification"
                                    checked={selectedSpecIdForSubmittal === spec.id}
                                    onChange={() => setSelectedSpecIdForSubmittal(spec.id)}
                                    className="h-4 w-4"
                                  />
                                ) : (
                                  <input type="checkbox" className="h-4 w-4 rounded border-gray-300" aria-label={`Select ${spec.name}`} />
                                )}
                                <Info className="h-4 w-4 text-gray-500" />
                              </div>
                            </td>
                            <td className="px-4 py-3 font-medium text-gray-800">
                              <button type="button" className="text-left text-[#1f3a66] underline underline-offset-2">
                                {(spec.code || "—").replace(/\s+/g, "")}
                              </button>
                            </td>
                            <td className="px-4 py-3 text-gray-700">{spec.name}</td>
                            <td className="px-4 py-3 font-semibold text-gray-800">0</td>
                            <td className="px-4 py-3">
                              <button type="button" className="rounded bg-gray-200 px-3 py-1 font-semibold text-gray-700 hover:bg-gray-300">
                                See All
                              </button>
                            </td>
                            <td className="px-4 py-3 text-gray-500">—</td>
                            <td className="px-4 py-3 text-gray-700">Specifications</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              );
            })}
            {activeTab === "recycle-bin" && search.trim().length === 0 && displayedDivisions.length === 0 && (
              <div className="rounded border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500">
                No specifications in the recycle bin.
              </div>
            )}
            {search.trim().length > 0 && filteredSpecifications.length === 0 && (
              <div className="rounded border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500">
                No specifications match your search.
              </div>
            )}
          </div>
        )}
      </section>

      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-[560px] rounded bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5">
              <h2 className="text-[34px] font-semibold leading-none text-gray-900">Upload Specifications</h2>
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                aria-label="Close"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-5 px-6 py-5 text-sm">
              <label className="block rounded border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center">
                <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => handleAttachFiles(e.target.files)}
                />
                <span className="inline-flex items-center gap-2 rounded bg-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700">
                  <Upload className="h-4 w-4" />
                  Attach Files
                </span>
                <p className="mt-3 text-gray-600">or Drag &amp; Drop</p>
                {uploadFiles.length > 0 && (
                  <p className="mt-3 text-xs text-gray-500">{uploadFiles.length} file(s) selected</p>
                )}
              </label>

              <div>
                <p className="mb-1 font-semibold text-gray-800">Specification Set <span className="text-red-500">*</span></p>
                <p className="mb-2 text-gray-500">Select an existing set or create a new one.</p>
                <select className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-gray-700 outline-none focus:border-gray-500">
                  <option>Select or Create set</option>
                </select>
              </div>

              <div>
                <p className="mb-1 font-semibold text-gray-800">Format <span className="text-red-500">*</span></p>
                <p className="mb-2 text-gray-500">Select a format based on the region your project is set to.</p>
                <select className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-gray-700 outline-none focus:border-gray-500">
                  <option>Select a format</option>
                  <option>MasterFormat, by CSI (USA/Canada)</option>
                  <option>NCS, by NATSPEC (Australia)</option>
                  <option>No Format/Other</option>
                </select>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <p className="mb-1 font-semibold text-gray-800">Default Issued Date</p>
                  <p className="mb-2 text-gray-500">Select the date revisions were issued.</p>
                  <input type="text" placeholder="mm / dd / yyyy" className="w-full rounded border border-gray-300 px-3 py-2" />
                </div>
                <div>
                  <p className="mb-1 font-semibold text-gray-800">Default Received Date</p>
                  <p className="mb-2 text-gray-500">Select the date revisions were received.</p>
                  <input type="text" placeholder="mm / dd / yyyy" className="w-full rounded border border-gray-300 px-3 py-2" />
                </div>
              </div>

              <button type="button" className="text-sm font-semibold text-gray-700">▸ Advanced Options</button>
            </div>

            <div className="flex items-center justify-between border-t border-gray-100 px-6 py-4">
              <p className="text-xs italic text-gray-500">* Required fields</p>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-3 py-2 text-sm font-semibold text-gray-700 hover:text-gray-900"
                >
                  Cancel
                </button>
                <button type="button" className="rounded bg-orange-200 px-4 py-2 text-sm font-semibold text-white">Process</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showCreateDivisionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-[520px] overflow-hidden rounded bg-[#e5e5e5] shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-300 px-5 py-5">
              <h2 className="text-[32px] font-semibold leading-none text-gray-900">Create Division</h2>
              <button type="button" onClick={closeCreateDivisionModal} className="text-gray-700 hover:text-gray-900">
                <X className="h-7 w-7" />
              </button>
            </div>
            <div className="space-y-4 border-b border-gray-300 px-5 py-5">
              <div>
                <label className="mb-1 block text-sm font-semibold text-gray-700">
                  Number <span className="text-red-500">*</span>
                </label>
                <input
                  value={newDivisionNumber}
                  onChange={(e) => setNewDivisionNumber(e.target.value)}
                  placeholder="Enter Number"
                  className="w-full rounded border border-gray-300 bg-[#efefef] px-3 py-2 text-sm outline-none focus:border-gray-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-gray-700">
                  Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={newDivisionDescription}
                  onChange={(e) => setNewDivisionDescription(e.target.value)}
                  placeholder="Enter Description"
                  className="min-h-[80px] w-full rounded border border-gray-300 bg-[#efefef] px-3 py-2 text-sm outline-none focus:border-gray-500"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-4 px-5 py-4">
              <button
                type="button"
                onClick={closeCreateDivisionModal}
                className="px-2 py-1 text-sm font-semibold text-gray-700 hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!canCreateDivision}
                onClick={handleCreateDivision}
                className="rounded px-4 py-2 text-sm font-semibold text-white disabled:bg-[#f4c7af] enabled:bg-[#f39a6e] enabled:hover:bg-[#ea8858]"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreateSpecificationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-[760px] overflow-hidden rounded bg-[#e5e5e5] shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-300 px-5 py-5">
              <h2 className="text-[34px] font-semibold leading-none text-gray-900">Create Specification</h2>
              <button type="button" onClick={closeCreateSpecificationModal} className="text-gray-700 hover:text-gray-900">
                <X className="h-7 w-7" />
              </button>
            </div>
            <div className="space-y-4 border-b border-gray-300 px-5 py-5">
              <div>
                <label className="mb-1 block text-sm font-semibold text-gray-700">
                  Division <span className="text-red-500">*</span>
                </label>
                <select
                  value={newSpecificationDivision}
                  onChange={(e) => setNewSpecificationDivision(e.target.value)}
                  className="w-full rounded border border-gray-400 bg-[#efefef] px-3 py-2 text-sm outline-none focus:border-gray-500"
                >
                  {divisions.map((division) => (
                    <option key={division.number} value={division.number}>
                      {division.number} - {division.description}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-gray-700">
                  Number <span className="text-red-500">*</span>
                </label>
                <input
                  value={newSpecificationNumber}
                  onChange={(e) => setNewSpecificationNumber(e.target.value)}
                  placeholder="Enter Number"
                  className="w-full rounded border border-gray-300 bg-[#efefef] px-3 py-2 text-sm outline-none focus:border-gray-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-gray-700">Description</label>
                <textarea
                  value={newSpecificationDescription}
                  onChange={(e) => setNewSpecificationDescription(e.target.value)}
                  placeholder="Enter Description"
                  className="min-h-24 w-full rounded border border-gray-300 bg-[#efefef] px-3 py-2 text-sm outline-none focus:border-gray-500"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-4 px-5 py-4">
              <button
                type="button"
                onClick={closeCreateSpecificationModal}
                className="px-2 py-1 text-sm font-semibold text-gray-700 hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!canCreateSpecification || isCreatingSpecification}
                onClick={handleCreateSpecification}
                className="rounded px-4 py-2 text-sm font-semibold text-white disabled:bg-[#f4c7af] enabled:bg-[#f39a6e] enabled:hover:bg-[#ea8858]"
              >
                {isCreatingSpecification ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
