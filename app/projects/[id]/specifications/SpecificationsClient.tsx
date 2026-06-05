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
type ParsedSpecSection = {
  number: string;
  division: string;
  title: string;
  startPage: number;
  endPage: number;
  pageCount: number;
};


// ── PDF.js lazy loader ────────────────────────────────────────────────────────

let pdfJsLoaded = false;

async function ensurePdfJs() {
  if (pdfJsLoaded) return;
  // pdfjs-dist v5 uses Promise.withResolvers (ES2024) — polyfill for Chrome < 119
  if (typeof (Promise as { withResolvers?: unknown }).withResolvers !== "function") {
    (Promise as { withResolvers?: unknown }).withResolvers = function <T>() {
      let resolve!: (value: T | PromiseLike<T>) => void;
      let reject!: (reason?: unknown) => void;
      const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
      return { promise, resolve, reject };
    };
  }
  // pdfjs-dist v5 uses URL.parse (Chrome 120+) — polyfill for older browsers
  if (typeof URL.parse !== "function") {
    (URL as unknown as { parse: (url: string, base?: string) => URL | null }).parse = (url, base) => {
      try { return new URL(url, base); } catch { return null; }
    };
  }
  const { GlobalWorkerOptions } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  pdfJsLoaded = true;
}

type PageHead = { page: number; text: string };

async function extractSpecificationPageHeads(file: File): Promise<{ totalPages: number; pageHeads: PageHead[] }> {
  await ensurePdfJs();
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data: bytes, useWorkerFetch: false, isEvalSupported: false, useSystemFonts: true }).promise;
  const pageHeads: PageHead[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const lines = content.items
      .map((item: unknown) => ((item as { str?: string }).str ?? "").trim())
      .filter(Boolean)
      .slice(0, 30);

    pageHeads.push({ page: i, text: lines.join(" ").slice(0, 500) });
  }

  const totalPages = pdf.numPages;
  await pdf.destroy();
  return { totalPages, pageHeads };
}

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
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [newDivisionNumber, setNewDivisionNumber] = useState("");
  const [newDivisionDescription, setNewDivisionDescription] = useState("");
  const [newSpecificationDivision, setNewSpecificationDivision] = useState("");
  const [newSpecificationNumber, setNewSpecificationNumber] = useState("");
  const [newSpecificationDescription, setNewSpecificationDescription] = useState("");
  const [selectedSpecIdForSubmittal, setSelectedSpecIdForSubmittal] = useState<string | null>(null);
  const [isCreatingSpecification, setIsCreatingSpecification] = useState(false);
  const [isCreatingDivision, setIsCreatingDivision] = useState(false);
  const [isParsingUpload, setIsParsingUpload] = useState(false);
  const [isApplyingParsedUpload, setIsApplyingParsedUpload] = useState(false);
  const [parsedSections, setParsedSections] = useState<ParsedSpecSection[]>([]);
  const [showParseReviewModal, setShowParseReviewModal] = useState(false);
  const [parsedTotalPages, setParsedTotalPages] = useState<number | null>(null);
  const [specBookFilename, setSpecBookFilename] = useState<string | null>(null);
  const [isOpeningSpecBook, setIsOpeningSpecBook] = useState(false);

  const exportMenuRef = useRef<HTMLDivElement | null>(null);
  const isGenerateSubmittalFlow = searchParams.get("generateSubmittal") === "1";
  const returnTo = searchParams.get("returnTo") || `/projects/${projectId}/submittals?openCreate=1`;

  useEffect(() => {
    let mounted = true;
    async function loadInitialData() {
      try {
        const [specsRes, divisionsRes] = await Promise.all([
          fetch(`/api/projects/${projectId}/specifications`),
          fetch(`/api/projects/${projectId}/spec-divisions`),
        ]);
        const specsData = await specsRes.json();
        const divisionsData = await divisionsRes.json();
        if (!mounted) return;
        setSpecifications(Array.isArray(specsData) ? specsData : []);
        if (Array.isArray(divisionsData)) {
          setDivisions(
            divisionsData.map((d: { number: string; description: string }) => ({
              number: d.number,
              description: d.description,
            }))
          );
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadInitialData();
    return () => {
      mounted = false;
    };
  }, [projectId]);

  useEffect(() => {
    let mounted = true;
    async function loadSpecBook() {
      try {
        const res = await fetch(`/api/projects/${projectId}/spec-book`);
        if (!res.ok) return;
        const data = await res.json();
        if (!mounted) return;
        if (data?.specBook?.filename) {
          setSpecBookFilename(data.specBook.filename);
        }
      } catch {
        // Non-fatal — the Open button will fall back to a "no spec book" alert.
      }
    }
    loadSpecBook();
    return () => {
      mounted = false;
    };
  }, [projectId]);

  useEffect(() => {
    setDivisions((current) => {
      const seenNumbers = new Set(current.map((division) => division.number));
      const inferredDivisions: Division[] = [];
      let hasUnclassified = false;
      specifications.forEach((spec) => {
        if (spec.deleted_at) return;
        const match = spec.code?.match(/^\s*(\d{2,3})/);
        if (!match) {
          hasUnclassified = true;
          return;
        }
        const number = match[1];
        if (seenNumbers.has(number)) return;
        seenNumbers.add(number);
        inferredDivisions.push({ number, description: `Division ${number}` });
      });
      if (hasUnclassified && !seenNumbers.has("100")) {
        inferredDivisions.push({ number: "100", description: "Unclassified" });
      }
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

  async function handleOpenSpecBook() {
    if (isOpeningSpecBook) return;
    setIsOpeningSpecBook(true);
    // Open the tab synchronously so the click is still attributed as user
    // intent — popup blockers reject window.open calls made after async work.
    const win = window.open("", "_blank");
    try {
      const res = await fetch(`/api/projects/${projectId}/spec-book`);
      const data = res.ok ? await res.json() : null;
      const url = data?.specBook?.url as string | undefined;
      if (!url) {
        if (win) win.close();
        setSpecBookFilename(null);
        window.alert("No specification book has been uploaded for this project yet. Click Upload to add one.");
        return;
      }
      setSpecBookFilename((data?.specBook?.filename as string | undefined) ?? null);
      if (win) {
        win.location.href = url;
      } else {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    } catch {
      if (win) win.close();
      window.alert("Could not open the specification book. Please try again.");
    } finally {
      setIsOpeningSpecBook(false);
    }
  }

  function handleExport(format: "pdf" | "csv") {
    setShowExportMenu(false);
    window.alert(`Export as ${format.toUpperCase()} is coming soon.`);
  }

  function handleAttachFiles(fileList: FileList | null) {
    if (!fileList?.length) return;
    setUploadFiles(Array.from(fileList));
  }

  async function handleProcessUpload() {
    const file = uploadFiles[0];
    if (!file) {
      window.alert("Please attach a PDF first.");
      return;
    }
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      window.alert("Only PDF files are accepted.");
      return;
    }
    setIsParsingUpload(true);
    try {
      // Parse text locally in the browser so the serverless API never has to
      // receive or re-download the PDF bytes. This avoids Vercel body limits and
      // Node/PDF.js runtime issues while still letting the API optionally refine
      // the detected sections with Gemini from a small JSON payload.
      const { totalPages, pageHeads } = await extractSpecificationPageHeads(file);

      const res = await fetch(`/api/projects/${projectId}/specifications/parse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, totalPages, pageHeads }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to parse specification PDF.");
      setParsedSections(Array.isArray(data?.sections) ? data.sections : []);
      setParsedTotalPages(totalPages);
      setShowUploadModal(false);
      setShowParseReviewModal(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to parse specification PDF.";
      window.alert(message);
    } finally {
      setIsParsingUpload(false);
    }
  }

  async function handleApproveParsedSections() {
    if (parsedSections.length === 0) return;
    setIsApplyingParsedUpload(true);
    try {
      const created: Specification[] = [];
      for (const section of parsedSections) {
        const code = section.number;
        const name = `${section.title} (Pages ${section.startPage}-${section.endPage})`;
        const res = await fetch(`/api/projects/${projectId}/specifications`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, code }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? `Failed creating section ${section.number}`);
        created.push(data as Specification);
      }
      setSpecifications((current) => [...created, ...current].sort((a, b) => a.name.localeCompare(b.name)));

      // Persist the PDF itself so "Open Specification Book" can stream it
      // back. Failures here are non-fatal — the parsed sections are already
      // saved, and the user can re-upload to retry persistence.
      const pdfFile = uploadFiles[0];
      if (pdfFile) {
        try {
          const urlRes = await fetch(
            `/api/projects/${projectId}/spec-book/upload-url?filename=${encodeURIComponent(pdfFile.name)}`
          );
          if (urlRes.ok) {
            const { signedUrl, storagePath } = await urlRes.json();
            const putRes = await fetch(signedUrl, {
              method: "PUT",
              body: pdfFile,
              headers: { "Content-Type": "application/pdf" },
            });
            if (putRes.ok) {
              const registerRes = await fetch(`/api/projects/${projectId}/spec-book`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  storagePath,
                  filename: pdfFile.name,
                  totalPages: parsedTotalPages,
                }),
              });
              if (registerRes.ok) {
                setSpecBookFilename(pdfFile.name);
              }
            }
          }
        } catch {
          // Silently ignore persistence failures so the sections still save.
        }
      }

      setShowParseReviewModal(false);
      setParsedSections([]);
      setParsedTotalPages(null);
      setUploadFiles([]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to upload parsed specifications.";
      window.alert(message);
    } finally {
      setIsApplyingParsedUpload(false);
    }
  }

  function closeCreateDivisionModal() {
    setShowCreateDivisionModal(false);
    setNewDivisionNumber("");
    setNewDivisionDescription("");
  }

  function openCreateSpecificationModal() {
    setNewSpecificationDivision((current) => current || divisions[0]?.number || "");
    setShowCreateSpecificationModal(true);
  }

  function closeCreateSpecificationModal() {
    setShowCreateSpecificationModal(false);
    setNewSpecificationDivision(divisions[0]?.number ?? "");
    setNewSpecificationNumber("");
    setNewSpecificationDescription("");
  }

  async function handleCreateDivision() {
    if (!newDivisionNumber.trim() || !newDivisionDescription.trim()) return;
    const nextDivision = { number: newDivisionNumber.trim(), description: newDivisionDescription.trim() };
    setIsCreatingDivision(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/spec-divisions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nextDivision),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Failed to create division");
      }
      const created = (await res.json()) as { number: string; description: string };
      setDivisions((current) => {
        const deduped = current.filter((division) => division.number !== created.number);
        return [...deduped, { number: created.number, description: created.description }].sort((a, b) =>
          a.number.localeCompare(b.number)
        );
      });
      closeCreateDivisionModal();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create division";
      window.alert(message);
    } finally {
      setIsCreatingDivision(false);
    }
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

  const activeSpecCount = useMemo(
    () => specifications.filter((spec) => !spec.deleted_at).length,
    [specifications]
  );
  const recycledSpecCount = useMemo(
    () => specifications.filter((spec) => Boolean(spec.deleted_at)).length,
    [specifications]
  );

  return (
    <div className="min-h-screen bg-[#F9FAFB] text-gray-900">
      <AppHeader username={username} />
      <ProjectNav projectId={projectId} />

      <div className="px-4 sm:px-6 pt-6 sm:pt-8 pb-4 bg-[#F9FAFB]">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-display text-[32px] leading-[1.05] tracking-[-0.012em] text-[color:var(--ink)]">
              Specifications
            </h1>
            {!loading && (
              <p className="sec-sub mt-1.5">
                <span className="serif-italic text-[color:var(--brand-700)]">The project record set</span>
                <span className="sep">·</span>
                <span className="num" style={{ color: "var(--brand-500)" }}>{activeSpecCount}</span> sections
                <span className="sep">·</span>
                <span className="num">{visibleDivisions.length}</span> divisions
                {recycledSpecCount > 0 && (
                  <>
                    <span className="sep">·</span>
                    <span className="num">{recycledSpecCount}</span> recycled
                  </>
                )}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 text-sm">
            <button
              type="button"
              onClick={() => setShowUploadModal(true)}
              className="btn-primary"
            >
              Upload
            </button>
            <button
              type="button"
              onClick={handleOpenSpecBook}
              disabled={isOpeningSpecBook}
              title={specBookFilename ?? undefined}
              className="btn-secondary disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isOpeningSpecBook ? "Opening…" : "Open Specification Book"}
            </button>

            <div className="relative" ref={exportMenuRef}>
              <button
                type="button"
                onClick={() => setShowExportMenu((s) => !s)}
                className="btn-secondary flex items-center gap-1.5"
              >
                Export
                <ChevronDown className="h-4 w-4" />
              </button>
              {showExportMenu && (
                <div className="absolute right-0 z-20 mt-1 w-40 overflow-hidden rounded-lg border hairline bg-white shadow-lg">
                  <button
                    type="button"
                    onClick={() => handleExport("pdf")}
                    className="block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-[color:var(--surface-sunken)]"
                  >
                    Export as PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExport("csv")}
                    className="block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-[color:var(--surface-sunken)]"
                  >
                    Export as CSV
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {!loading && (
          <div className="stats mt-5">
            <div className="stat">
              <div className="lbl">Specification Sections</div>
              <div className="val">{activeSpecCount}</div>
              <div className="delta">Active across the set</div>
            </div>
            <div className="stat">
              <div className="lbl">Divisions</div>
              <div className="val">{visibleDivisions.length}</div>
              <div className="delta">MasterFormat structure</div>
            </div>
            <div className={`stat${specBookFilename ? " calm" : " warn"}`}>
              <div className="lbl">Spec Book</div>
              <div className="val">{specBookFilename ? "On file" : "None"}</div>
              <div className="delta">{specBookFilename ? "PDF available to open" : "Upload to enable"}</div>
            </div>
            <div className="stat">
              <div className="lbl">Recycle Bin</div>
              <div className="val">{recycledSpecCount}</div>
              <div className="delta">Removed sections</div>
            </div>
          </div>
        )}

        <div className="mt-5">
          <div className="flex gap-6 text-sm">
            {topTabs.map((tab) => {
              const active = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`border-b-2 pb-2 pt-1 transition-colors ${active ? "border-[color:var(--brand-500)] font-semibold text-[color:var(--ink)]" : "border-transparent text-gray-500 hover:text-[color:var(--ink)]"}`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="border-y hairline bg-[color:var(--surface-sunken)] px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative min-w-[280px] flex-1 max-w-xl">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search sections by number or description"
              className="w-full rounded-md border hairline bg-white py-2 pl-9 pr-3 text-sm outline-none placeholder:text-gray-400 focus:ring-2 focus:ring-gray-900"
            />
          </div>
          <div className="flex items-center gap-3 text-sm font-semibold">
            <button
              type="button"
              onClick={() => setShowCreateDivisionModal(true)}
              className="btn-quiet flex items-center gap-1"
            >
              <Plus className="h-4 w-4" />
              Create Division
            </button>
            <button
              type="button"
              onClick={openCreateSpecificationModal}
              className="btn-quiet flex items-center gap-1"
            >
              <Plus className="h-4 w-4" />
              Create Specification
            </button>
          </div>
        </div>
      </div>

      <section className="px-4 py-5">
        {isGenerateSubmittalFlow && (
          <div className="mb-4 rounded-lg border-l-2 border-[color:var(--brand-500)] border-y border-r hairline bg-[color:var(--surface-sunken)] px-4 py-3">
            <p className="text-sm text-[color:var(--ink)]">Select a specification, then click <span className="font-semibold">Generate Submittal</span> to return to the submittal form.</p>
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={handleGenerateSubmittal}
                disabled={!selectedSpecIdForSubmittal}
                className="btn-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                Generate Submittal
              </button>
            </div>
          </div>
        )}
        {loading ? (
          <div className="rounded-lg border hairline bg-white p-6 text-sm text-gray-500">Loading specifications…</div>
        ) : (
          <div className="space-y-3">
            {displayedDivisions.map((division) => {
              const divisionSpecs = specificationsByDivision.get(division.number) ?? [];
              return (
                <div key={division.number} className="overflow-hidden rounded-lg border hairline bg-white">
                  <div className="flex items-baseline gap-2.5 border-b hairline bg-[color:var(--surface-sunken)] px-4 py-3">
                    <span className="idx-italic">{division.number}</span>
                    <span className="font-display text-[18px] leading-tight text-[color:var(--ink)]">
                      {division.description}
                    </span>
                    <span className="text-xs text-gray-400">
                      {divisionSpecs.length} section{divisionSpecs.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  {divisionSpecs.length === 0 ? (
                    <div className="px-4 py-5 text-sm text-gray-500">No specifications in this division yet.</div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b hairline">
                          <th className="w-20 px-4 py-3 text-left">
                            <input type="checkbox" className="h-4 w-4 rounded border-gray-300" aria-label="Select all specifications" />
                          </th>
                          <th className="px-4 py-3 text-left mono-label">Number</th>
                          <th className="px-4 py-3 text-left mono-label">Description</th>
                          <th className="px-4 py-3 text-left mono-label">Revision</th>
                          <th className="px-4 py-3 text-left mono-label">Date Issued</th>
                          <th className="px-4 py-3 text-left mono-label">Date Received</th>
                          <th className="px-4 py-3 text-left mono-label">Set</th>
                        </tr>
                      </thead>
                      <tbody>
                        {divisionSpecs.map((spec) => (
                          <tr key={spec.id} className="border-t border-black/[0.04] hover:bg-[color:var(--surface-sunken)] transition-colors">
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
                                <Info className="h-4 w-4 text-gray-400" />
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <button type="button" className="idx-italic text-left hover:opacity-70 transition-opacity">
                                {(spec.code || "—").replace(/\s+/g, "")}
                              </button>
                            </td>
                            <td className="px-4 py-3 text-[color:var(--ink)]">{spec.name}</td>
                            <td className="px-4 py-3 font-mono tabular-nums text-gray-600">0</td>
                            <td className="px-4 py-3">
                              <button type="button" className="btn-quiet">
                                See All
                              </button>
                            </td>
                            <td className="px-4 py-3 text-gray-400">—</td>
                            <td className="px-4 py-3 text-gray-600">Specifications</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              );
            })}
            {activeTab === "recycle-bin" && search.trim().length === 0 && displayedDivisions.length === 0 && (
              <div className="rounded-lg border border-dashed hairline bg-white p-6 text-center text-sm text-gray-500">
                No specifications in the recycle bin.
              </div>
            )}
            {search.trim().length > 0 && filteredSpecifications.length === 0 && (
              <div className="rounded-lg border border-dashed hairline bg-white p-6 text-center text-sm text-gray-500">
                No specifications match your search.
              </div>
            )}
          </div>
        )}
      </section>

      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-[560px] rounded-lg border hairline bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b hairline px-6 py-5">
              <h2 className="font-display text-[28px] leading-tight text-[color:var(--ink)]">Upload Specifications</h2>
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                className="rounded p-1 text-gray-400 hover:bg-[color:var(--surface-sunken)] hover:text-gray-700"
                aria-label="Close"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-5 px-6 py-5 text-sm">
              <label className="block rounded-lg border border-dashed hairline bg-[color:var(--surface-sunken)] px-4 py-8 text-center">
                <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => handleAttachFiles(e.target.files)}
                />
                <span className="btn-secondary inline-flex cursor-pointer items-center gap-2">
                  <Upload className="h-4 w-4" />
                  Attach Files
                </span>
                <p className="mt-3 text-gray-500">or Drag &amp; Drop</p>
                {uploadFiles.length > 0 && (
                  <p className="mt-3 text-xs text-[color:var(--brand-700)]">{uploadFiles.length} file(s) selected</p>
                )}
              </label>

              <div>
                <p className="mb-1 font-semibold text-[color:var(--ink)]">Specification Set <span className="text-[color:var(--brand-500)]">*</span></p>
                <p className="mb-2 text-gray-500">Select an existing set or create a new one.</p>
                <select className="w-full rounded-md border hairline bg-white px-3 py-2 text-gray-700 outline-none focus:ring-2 focus:ring-gray-900">
                  <option>Select or Create set</option>
                </select>
              </div>

              <div>
                <p className="mb-1 font-semibold text-[color:var(--ink)]">Format <span className="text-[color:var(--brand-500)]">*</span></p>
                <p className="mb-2 text-gray-500">Select a format based on the region your project is set to.</p>
                <select className="w-full rounded-md border hairline bg-white px-3 py-2 text-gray-700 outline-none focus:ring-2 focus:ring-gray-900">
                  <option>Select a format</option>
                  <option>MasterFormat, by CSI (USA/Canada)</option>
                  <option>NCS, by NATSPEC (Australia)</option>
                  <option>No Format/Other</option>
                </select>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <p className="mb-1 font-semibold text-[color:var(--ink)]">Default Issued Date</p>
                  <p className="mb-2 text-gray-500">Select the date revisions were issued.</p>
                  <input type="text" placeholder="mm / dd / yyyy" className="w-full rounded-md border hairline px-3 py-2 outline-none focus:ring-2 focus:ring-gray-900" />
                </div>
                <div>
                  <p className="mb-1 font-semibold text-[color:var(--ink)]">Default Received Date</p>
                  <p className="mb-2 text-gray-500">Select the date revisions were received.</p>
                  <input type="text" placeholder="mm / dd / yyyy" className="w-full rounded-md border hairline px-3 py-2 outline-none focus:ring-2 focus:ring-gray-900" />
                </div>
              </div>

              <button type="button" className="btn-quiet">▸ Advanced Options</button>
            </div>

            <div className="flex items-center justify-between border-t hairline px-6 py-4">
              <p className="text-xs italic text-gray-500">* Required fields</p>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="btn-quiet"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isParsingUpload || uploadFiles.length === 0}
                  onClick={handleProcessUpload}
                  className="btn-primary disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isParsingUpload ? "Processing..." : "Process"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showParseReviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-[860px] rounded-lg border hairline bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b hairline px-6 py-5">
              <h2 className="font-display text-[28px] leading-tight text-[color:var(--ink)]">Review Parsed Specifications</h2>
              <button type="button" onClick={() => setShowParseReviewModal(false)} className="rounded p-1 text-gray-400 hover:bg-[color:var(--surface-sunken)] hover:text-gray-700">
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="max-h-[60vh] overflow-auto px-6 py-4">
              <p className="mb-3 text-sm text-gray-600">
                Confirm the section numbers and page ranges before uploading to Specifications.
              </p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b hairline">
                    <th className="px-3 py-2 text-left mono-label">Division</th>
                    <th className="px-3 py-2 text-left mono-label">Section Number</th>
                    <th className="px-3 py-2 text-left mono-label">Detected Heading</th>
                    <th className="px-3 py-2 text-left mono-label">Page Range</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedSections.map((section, idx) => (
                    <tr key={`${section.number}-${idx}`} className="border-t border-black/[0.04]">
                      <td className="px-3 py-2 font-mono tabular-nums text-gray-600">{section.division}</td>
                      <td className="px-3 py-2"><span className="idx-italic">{section.number}</span></td>
                      <td className="px-3 py-2 text-[color:var(--ink)]">{section.title}</td>
                      <td className="px-3 py-2 font-mono tabular-nums text-gray-600">
                        {section.startPage} - {section.endPage} ({section.pageCount} page{section.pageCount === 1 ? "" : "s"})
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-end gap-3 border-t hairline px-6 py-4">
              <button type="button" onClick={() => setShowParseReviewModal(false)} className="btn-quiet">
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApproveParsedSections}
                disabled={isApplyingParsedUpload || parsedSections.length === 0}
                className="btn-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isApplyingParsedUpload ? "Uploading..." : "Approve & Upload"}
              </button>
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
                disabled={!canCreateDivision || isCreatingDivision}
                onClick={handleCreateDivision}
                className="rounded px-4 py-2 text-sm font-semibold text-white disabled:bg-[#f4c7af] enabled:bg-[#f39a6e] enabled:hover:bg-[#ea8858]"
              >
                {isCreatingDivision ? "Creating..." : "Create"}
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
                  {divisions.length === 0 ? (
                    <option value="">No divisions available</option>
                  ) : (
                    divisions.map((division) => (
                      <option key={division.number} value={division.number}>
                        {division.number} - {division.description}
                      </option>
                    ))
                  )}
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
