"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import ProjectNav from "@/components/ProjectNav";
import AppHeader from "@/app/components/AppHeader";
import { FileText, Plus, Pencil, Trash2, Sparkles, Download, ChevronDown, ChevronUp, Paperclip, ExternalLink, Loader2 } from "lucide-react";

// ─── PDF/DOCX text extraction (client-side) ──────────────────────────────────

let pdfJsLoaded = false;
async function ensurePdfJs() {
  if (pdfJsLoaded) return;
  if (typeof (Promise as { withResolvers?: unknown }).withResolvers !== "function") {
    (Promise as { withResolvers?: unknown }).withResolvers = function <T>() {
      let resolve!: (value: T | PromiseLike<T>) => void;
      let reject!: (reason?: unknown) => void;
      const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
      return { promise, resolve, reject };
    };
  }
  if (typeof URL.parse !== "function") {
    (URL as unknown as { parse: (url: string, base?: string) => URL | null }).parse = (url, base) => {
      try { return new URL(url, base); } catch { return null; }
    };
  }
  const { GlobalWorkerOptions } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  pdfJsLoaded = true;
}

async function extractPdfText(file: File): Promise<string> {
  await ensurePdfJs();
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data: bytes, useWorkerFetch: false, isEvalSupported: false, useSystemFonts: true }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map((item: unknown) => ((item as { str?: string }).str ?? ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (text) pages.push(text);
  }
  await pdf.destroy();
  return pages.join("\n\n");
}

async function extractDocxText(file: File): Promise<string> {
  const JSZipMod = await import("jszip");
  const JSZip = JSZipMod.default;
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const docXml = zip.file("word/document.xml");
  if (!docXml) throw new Error("Not a valid .docx file");
  const xml = await docXml.async("string");
  // Paragraphs are <w:p>...</w:p> with text in <w:t>...</w:t>; <w:br/> = line break.
  const paragraphs: string[] = [];
  const pRegex = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g;
  let match: RegExpExecArray | null;
  while ((match = pRegex.exec(xml)) !== null) {
    const inner = match[1]
      .replace(/<w:br\s*\/?\s*>/g, "\n")
      .replace(/<w:tab\s*\/?\s*>/g, "\t");
    const tRegex = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g;
    const parts: string[] = [];
    let m2: RegExpExecArray | null;
    while ((m2 = tRegex.exec(inner)) !== null) {
      parts.push(
        m2[1]
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .replace(/&apos;/g, "'")
      );
    }
    paragraphs.push(parts.join(""));
  }
  return paragraphs.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

async function extractAttachmentText(file: File): Promise<string> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".pdf") || file.type === "application/pdf") {
    return extractPdfText(file);
  }
  if (
    lower.endsWith(".docx") ||
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return extractDocxText(file);
  }
  if (lower.endsWith(".doc")) {
    throw new Error("Legacy .doc files are not supported — please save as .docx or PDF.");
  }
  throw new Error("Only PDF and Word (.docx) files are supported.");
}

// ─── CSI MasterFormat Divisions ───────────────────────────────────────────────
const CSI_DIVISIONS = [
  { code: "00", name: "Procurement and Contracting Requirements" },
  { code: "01", name: "General Requirements" },
  { code: "02", name: "Existing Conditions" },
  { code: "03", name: "Concrete" },
  { code: "04", name: "Masonry" },
  { code: "05", name: "Metals" },
  { code: "06", name: "Wood, Plastics, and Composites" },
  { code: "07", name: "Thermal and Moisture Protection" },
  { code: "08", name: "Openings" },
  { code: "09", name: "Finishes" },
  { code: "10", name: "Specialties" },
  { code: "11", name: "Equipment" },
  { code: "12", name: "Furnishings" },
  { code: "13", name: "Special Construction" },
  { code: "14", name: "Conveying Equipment" },
  { code: "21", name: "Fire Suppression" },
  { code: "22", name: "Plumbing" },
  { code: "23", name: "HVAC" },
  { code: "25", name: "Integrated Automation" },
  { code: "26", name: "Electrical" },
  { code: "27", name: "Communications" },
  { code: "28", name: "Electronic Safety and Security" },
  { code: "31", name: "Earthwork" },
  { code: "32", name: "Exterior Improvements" },
  { code: "33", name: "Utilities" },
  { code: "34", name: "Transportation" },
  { code: "35", name: "Waterway and Marine Construction" },
  { code: "40", name: "Process Integration" },
  { code: "41", name: "Material Processing and Handling Equipment" },
  { code: "42", name: "Process Heating, Cooling, and Drying Equipment" },
  { code: "43", name: "Process Gas and Liquid Handling" },
  { code: "44", name: "Pollution and Waste Control Equipment" },
  { code: "45", name: "Industry-Specific Manufacturing Equipment" },
  { code: "46", name: "Water and Wastewater Equipment" },
  { code: "48", name: "Electrical Power Generation" },
];

// ─── Types ────────────────────────────────────────────────────────────────────
interface ScopeItem {
  id: string;
  project_id: string;
  division_code: string;
  division_name: string;
  section_code: string | null;
  section_name: string | null;
  scope_text: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface AddFormState {
  divisionCode: string;
  sectionCode: string;
  sectionName: string;
  scopeText: string;
  aiLoading: boolean;
  saving: boolean;
  error: string;
}

interface EditFormState {
  itemId: string;
  sectionCode: string;
  sectionName: string;
  scopeText: string;
  aiLoading: boolean;
  saving: boolean;
  error: string;
}

interface ScopeAttachment {
  id: string;
  divisionCode: string;
  filename: string;
  fileType: string | null;
  fileSize: number | null;
  extractedText: string;
  uploadedAt: string;
  url: string | null;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function ScopeOfWorkClient({ projectId, username }: { projectId: string; username?: string }) {
  const activeDivisionsStorageKey = `scope-of-work:active-divisions:${projectId}`;
  const [items, setItems] = useState<ScopeItem[]>([]);
  const [loading, setLoading] = useState(true);
  // Whether the initial activeDivisions state came from a saved user preference
  // (vs the default). When true, we suppress the "auto-activate divisions that
  // have items/attachments" behavior so the user's checkbox choices stick.
  const hadStoredActiveDivisions = useRef(false);
  const [activeDivisions, setActiveDivisions] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set(["01"]);
    try {
      const raw = window.localStorage.getItem(activeDivisionsStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          hadStoredActiveDivisions.current = true;
          return new Set(parsed.filter((v): v is string => typeof v === "string"));
        }
      }
    } catch {
      // ignore corrupted value
    }
    return new Set(["01"]);
  });

  // Persist active divisions whenever they change.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        activeDivisionsStorageKey,
        JSON.stringify(Array.from(activeDivisions))
      );
    } catch {
      // storage may be full or disabled — ignore
    }
  }, [activeDivisions, activeDivisionsStorageKey]);
  const [addForm, setAddForm] = useState<AddFormState | null>(null);
  const [editForm, setEditForm] = useState<EditFormState | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [exportLoading, setExportLoading] = useState(false);
  const [projectName, setProjectName] = useState("Project");
  const [attachments, setAttachments] = useState<ScopeAttachment[]>([]);
  const [uploadingDivision, setUploadingDivision] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<{ division: string; message: string } | null>(null);
  const [expandedAttachment, setExpandedAttachment] = useState<string | null>(null);
  const [deletingAttachment, setDeletingAttachment] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  // Fetch scope items
  const fetchItems = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/scope`);
      if (!res.ok) return;
      const data: ScopeItem[] = await res.json();
      setItems(data);

      // Auto-activate divisions that have items only on first visit (no saved
      // checkbox state yet) so a user's explicit unchecks aren't reverted.
      if (data.length > 0 && !hadStoredActiveDivisions.current) {
        setActiveDivisions((prev) => {
          const next = new Set(prev);
          data.forEach((item) => next.add(item.division_code));
          return next;
        });
      }
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  // Fetch project name
  useEffect(() => {
    fetch(`/api/projects/${projectId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d?.name) setProjectName(d.name);
      })
      .catch(() => {});
  }, [projectId]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Fetch attachments
  const fetchAttachments = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/scope/attachments`);
      if (!res.ok) return;
      const data = await res.json();
      const list: ScopeAttachment[] = data?.attachments || [];
      setAttachments(list);
      // Auto-activate any division that has attachments only on first visit
      // (no saved checkbox state yet) so a user's explicit unchecks aren't
      // reverted by data fetched on every mount.
      if (list.length > 0 && !hadStoredActiveDivisions.current) {
        setActiveDivisions((prev) => {
          const next = new Set(prev);
          list.forEach((a) => next.add(a.divisionCode));
          return next;
        });
      }
    } catch {
      // ignore
    }
  }, [projectId]);

  useEffect(() => {
    fetchAttachments();
  }, [fetchAttachments]);

  async function handleAttachmentUpload(divisionCode: string, file: File) {
    setUploadError(null);
    setUploadingDivision(divisionCode);
    try {
      const extractedText = await extractAttachmentText(file);

      const urlRes = await fetch(
        `/api/projects/${projectId}/scope/attachments/upload-url?filename=${encodeURIComponent(file.name)}&divisionCode=${encodeURIComponent(divisionCode)}`
      );
      if (!urlRes.ok) {
        const err = await urlRes.json().catch(() => ({}));
        throw new Error(err.error || "Could not create upload URL");
      }
      const { signedUrl, storagePath } = await urlRes.json();

      const putRes = await fetch(signedUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type || "application/octet-stream" },
      });
      if (!putRes.ok) throw new Error("Upload failed");

      const registerRes = await fetch(`/api/projects/${projectId}/scope/attachments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          divisionCode,
          filename: file.name,
          storagePath,
          fileType: file.type || null,
          fileSize: file.size,
          extractedText,
        }),
      });
      if (!registerRes.ok) {
        const err = await registerRes.json().catch(() => ({}));
        throw new Error(err.error || "Failed to save attachment");
      }
      const { attachment } = await registerRes.json();
      setAttachments((prev) => [attachment, ...prev]);
      setExpandedAttachment(attachment.id);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to attach file";
      setUploadError({ division: divisionCode, message });
    } finally {
      setUploadingDivision(null);
    }
  }

  async function handleAttachmentDelete(attachmentId: string) {
    setDeletingAttachment(attachmentId);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/scope/attachments/${attachmentId}`,
        { method: "DELETE" }
      );
      if (!res.ok) return;
      setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
      if (expandedAttachment === attachmentId) setExpandedAttachment(null);
    } finally {
      setDeletingAttachment(null);
    }
  }

  function attachmentsForDivision(code: string) {
    return attachments.filter((a) => a.divisionCode === code);
  }

  // Toggle division active state
  function toggleDivision(code: string) {
    setActiveDivisions((prev) => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });
  }

  // Scroll to division section
  function scrollToDiv(code: string) {
    if (!activeDivisions.has(code)) {
      setActiveDivisions((prev) => new Set([...prev, code]));
      setTimeout(() => {
        sectionRefs.current[code]?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
    } else {
      sectionRefs.current[code]?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  // Open add form for a division
  function openAddForm(divisionCode: string) {
    setEditForm(null);
    setAddForm({
      divisionCode,
      sectionCode: "",
      sectionName: "",
      scopeText: "",
      aiLoading: false,
      saving: false,
      error: "",
    });
  }

  // AI draft for add form
  async function handleAIDraft(
    divisionCode: string,
    divisionName: string,
    sectionName: string
  ) {
    if (!addForm) return;
    setAddForm((f) => f ? { ...f, aiLoading: true, error: "" } : f);
    try {
      const res = await fetch(`/api/projects/${projectId}/scope/ai-draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ divisionCode, divisionName, sectionName, projectName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "AI draft failed");
      setAddForm((f) => f ? { ...f, scopeText: data.text, aiLoading: false } : f);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "AI draft failed";
      setAddForm((f) => f ? { ...f, error: msg, aiLoading: false } : f);
    }
  }

  // AI draft for edit form
  async function handleEditAIDraft(
    divisionCode: string,
    divisionName: string,
    sectionName: string
  ) {
    if (!editForm) return;
    setEditForm((f) => f ? { ...f, aiLoading: true, error: "" } : f);
    try {
      const res = await fetch(`/api/projects/${projectId}/scope/ai-draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ divisionCode, divisionName, sectionName, projectName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "AI draft failed");
      setEditForm((f) => f ? { ...f, scopeText: data.text, aiLoading: false } : f);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "AI draft failed";
      setEditForm((f) => f ? { ...f, error: msg, aiLoading: false } : f);
    }
  }

  // Save new item
  async function handleSave() {
    if (!addForm) return;
    if (!addForm.scopeText.trim()) {
      setAddForm((f) => f ? { ...f, error: "Scope text is required" } : f);
      return;
    }
    const division = CSI_DIVISIONS.find((d) => d.code === addForm.divisionCode);
    if (!division) return;

    setAddForm((f) => f ? { ...f, saving: true, error: "" } : f);
    try {
      const res = await fetch(`/api/projects/${projectId}/scope`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          division_code: addForm.divisionCode,
          division_name: division.name,
          section_code: addForm.sectionCode || null,
          section_name: addForm.sectionName || null,
          scope_text: addForm.scopeText,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      setItems((prev) => [...prev, data]);
      setAddForm(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save";
      setAddForm((f) => f ? { ...f, error: msg, saving: false } : f);
    }
  }

  // Open edit form
  function openEditForm(item: ScopeItem) {
    setAddForm(null);
    setDeleteConfirm(null);
    setEditForm({
      itemId: item.id,
      sectionCode: item.section_code || "",
      sectionName: item.section_name || "",
      scopeText: item.scope_text,
      aiLoading: false,
      saving: false,
      error: "",
    });
  }

  // Save edited item
  async function handleEditSave(item: ScopeItem) {
    if (!editForm) return;
    if (!editForm.scopeText.trim()) {
      setEditForm((f) => f ? { ...f, error: "Scope text is required" } : f);
      return;
    }
    setEditForm((f) => f ? { ...f, saving: true, error: "" } : f);
    try {
      const res = await fetch(`/api/projects/${projectId}/scope/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section_code: editForm.sectionCode || null,
          section_name: editForm.sectionName || null,
          scope_text: editForm.scopeText,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      setItems((prev) => prev.map((i) => (i.id === item.id ? data : i)));
      setEditForm(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save";
      setEditForm((f) => f ? { ...f, error: msg, saving: false } : f);
    }
  }

  // Delete item
  async function handleDelete(itemId: string) {
    try {
      const res = await fetch(`/api/projects/${projectId}/scope/${itemId}`, {
        method: "DELETE",
      });
      if (!res.ok) return;
      setItems((prev) => prev.filter((i) => i.id !== itemId));
      setDeleteConfirm(null);
    } catch {
      // ignore
    }
  }

  // Export PDF
  async function handleExportPDF() {
    setExportLoading(true);
    try {
      const { default: jsPDF } = await import("jspdf");
      const autoTable = (await import("jspdf-autotable")).default;

      const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 40;

      // Title
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("Scope of Work", margin, 56);

      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100);
      doc.text(projectName, margin, 74);
      doc.setTextColor(0);

      let y = 94;

      const activeDivList = CSI_DIVISIONS.filter((d) => activeDivisions.has(d.code));

      for (const division of activeDivList) {
        const divItems = items.filter((i) => i.division_code === division.code);
        if (divItems.length === 0) continue;

        // Division header
        if (y > 700) {
          doc.addPage();
          y = 40;
        }

        doc.setFillColor(245, 245, 245);
        doc.rect(margin, y, pageWidth - margin * 2, 20, "F");
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(30);
        doc.text(`Division ${division.code} – ${division.name}`, margin + 6, y + 13);
        doc.setTextColor(0);
        y += 28;

        for (const item of divItems) {
          if (y > 680) {
            doc.addPage();
            y = 40;
          }

          // Section label
          if (item.section_code || item.section_name) {
            doc.setFontSize(9);
            doc.setFont("helvetica", "bold");
            const sectionLabel = [item.section_code, item.section_name].filter(Boolean).join(" – ");
            doc.text(sectionLabel, margin, y);
            y += 14;
          }

          // Scope text wrapped
          doc.setFontSize(9);
          doc.setFont("helvetica", "normal");
          const lines = doc.splitTextToSize(item.scope_text, pageWidth - margin * 2);
          for (const line of lines) {
            if (y > 700) {
              doc.addPage();
              y = 40;
            }
            doc.text(line, margin, y);
            y += 13;
          }
          y += 10;
        }
        y += 6;
      }

      // Suppress unused import warning — autoTable is used via side effect
      void autoTable;

      const filename = `${projectName.replace(/[^a-z0-9]/gi, "_")}_Scope_of_Work.pdf`;
      doc.save(filename);
    } catch (err) {
      console.error("PDF export error:", err);
    } finally {
      setExportLoading(false);
    }
  }

  // Items grouped by division
  function itemsForDivision(code: string) {
    return items.filter((i) => i.division_code === code);
  }

  // Headline metrics for the stat strip
  const activeDivisionCount = CSI_DIVISIONS.filter((d) => activeDivisions.has(d.code)).length;
  const divisionsWithScope = new Set(items.map((i) => i.division_code)).size;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAF7]">
        <AppHeader username={username} />
        <ProjectNav projectId={projectId} />
        <div className="flex items-center justify-center h-64">
          <div className="w-6 h-6 border-2 border-[color:var(--brand-100)] border-t-[color:var(--brand-500)] rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAF7]">
      <AppHeader username={username} />
      <ProjectNav projectId={projectId} />

      {/* Page header */}
      <div className="flex items-end justify-between px-6 pt-8 pb-4 bg-[#FAFAF7] gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-[32px] leading-[1.05] tracking-[-0.012em] text-[color:var(--ink)]">Scope of work</h1>
          <p className="sec-sub mt-1.5">
            <span className="serif-italic text-[color:var(--brand-700)]">{projectName}</span>
            <span className="sep">·</span>
            <span className="num" style={{ color: "var(--brand-500)" }}>{activeDivisionCount}</span> active{activeDivisionCount === 1 ? " division" : " divisions"}
            <span className="sep">·</span>
            <span className="num">{items.length}</span> scope{items.length === 1 ? " item" : " items"}
            <span className="sep">·</span>
            <span className="num">{attachments.length}</span> attached{attachments.length === 1 ? " file" : " files"}
          </p>
        </div>
        <button
          onClick={handleExportPDF}
          disabled={exportLoading || items.length === 0}
          className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Download className="w-4 h-4" />
          {exportLoading ? "Exporting..." : "Export PDF"}
        </button>
      </div>

      {/* Stat strip */}
      <div className="px-6 pb-4 bg-[#FAFAF7]">
        <div className="stats">
          <div className={`stat${activeDivisionCount > 0 ? " alert" : ""}`}>
            <div className="lbl">Active Divisions</div>
            <div className="val">{activeDivisionCount}</div>
            <div className="delta">of {CSI_DIVISIONS.length} CSI divisions</div>
          </div>
          <div className="stat">
            <div className="lbl">Scope Items</div>
            <div className="val">{items.length}</div>
            <div className="delta">across {divisionsWithScope} division{divisionsWithScope === 1 ? "" : "s"}</div>
          </div>
          <div className="stat">
            <div className="lbl">Attachments</div>
            <div className="val">{attachments.length}</div>
            <div className="delta">specs &amp; reference files</div>
          </div>
          <div className={`stat${items.length === 0 ? " warn" : " calm"}`}>
            <div className="lbl">Documented</div>
            <div className="val">{divisionsWithScope}</div>
            <div className="delta">{items.length === 0 ? "no scope written yet" : "divisions with scope"}</div>
          </div>
        </div>
      </div>

      <div className="flex h-[calc(100vh-56px-56px-104px)] min-h-[480px]">
        {/* ── Sidebar ────────────────────────────────────────────────────── */}
        <aside className="w-64 shrink-0 bg-white border-r border-black/[0.08] overflow-y-auto">
          <div className="px-4 py-3 border-b border-black/[0.06]">
            <p className="mono-label">CSI Divisions</p>
          </div>
          <div className="py-2">
            {CSI_DIVISIONS.map((div) => {
              const isActive = activeDivisions.has(div.code);
              const count = itemsForDivision(div.code).length;
              return (
                <div
                  key={div.code}
                  className="flex items-center gap-2 px-3 py-1.5 group hover:bg-[color:var(--surface-sunken)] transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={() => toggleDivision(div.code)}
                    className="w-3.5 h-3.5 rounded border-gray-300 accent-[#D4500A] shrink-0 cursor-pointer"
                  />
                  <button
                    onClick={() => scrollToDiv(div.code)}
                    className={`flex-1 text-left text-xs leading-snug transition-colors ${
                      isActive
                        ? "text-[color:var(--ink)] font-medium"
                        : "text-gray-400 hover:text-gray-600"
                    }`}
                  >
                    <span className="font-mono text-[color:var(--brand-500)] mr-1">{div.code}</span>
                    {div.name}
                  </button>
                  {count > 0 && (
                    <span className="text-[10px] tabular-nums text-gray-500 bg-[color:var(--surface-sunken)] rounded-full px-1.5 py-0.5 shrink-0">
                      {count}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </aside>

        {/* ── Main Panel ─────────────────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {CSI_DIVISIONS.filter((d) => activeDivisions.has(d.code)).map((division) => {
            const divItems = itemsForDivision(division.code);
            const isAddingHere = addForm?.divisionCode === division.code;
            const divAttachments = attachmentsForDivision(division.code);
            const isUploadingHere = uploadingDivision === division.code;
            const divUploadError =
              uploadError?.division === division.code ? uploadError.message : null;

            return (
              <section
                key={division.code}
                ref={(el) => { sectionRefs.current[division.code] = el; }}
              >
                {/* Division header */}
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-gray-900">
                    <span className="font-mono text-orange-500 mr-2">
                      Division {division.code}
                    </span>
                    {division.name}
                  </h2>
                  <div className="flex items-center gap-4">
                    <input
                      ref={(el) => { fileInputRefs.current[division.code] = el; }}
                      type="file"
                      accept=".pdf,application/pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleAttachmentUpload(division.code, file);
                        e.target.value = "";
                      }}
                    />
                    <button
                      onClick={() => fileInputRefs.current[division.code]?.click()}
                      disabled={isUploadingHere}
                      className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 font-medium transition-colors disabled:opacity-50"
                    >
                      {isUploadingHere ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Paperclip className="w-3.5 h-3.5" />
                          Attach File
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => {
                        if (isAddingHere) {
                          setAddForm(null);
                        } else {
                          openAddForm(division.code);
                        }
                      }}
                      className="flex items-center gap-1.5 text-xs text-orange-500 hover:text-orange-600 font-medium transition-colors"
                    >
                      {isAddingHere ? (
                        <>
                          <ChevronUp className="w-3.5 h-3.5" />
                          Cancel
                        </>
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5" />
                          Add Item
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {divUploadError && (
                  <p className="text-xs text-red-500 mb-3">{divUploadError}</p>
                )}

                {/* Attachments */}
                {divAttachments.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {divAttachments.map((att) => {
                      const isExpanded = expandedAttachment === att.id;
                      const isDeleting = deletingAttachment === att.id;
                      return (
                        <div
                          key={att.id}
                          className="bg-white border border-gray-200 rounded-lg"
                        >
                          <div className="flex items-center gap-2 px-4 py-2.5">
                            <FileText className="w-4 h-4 text-orange-500 shrink-0" />
                            {att.url ? (
                              <a
                                href={att.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-1 text-sm text-gray-800 hover:text-orange-600 truncate flex items-center gap-1.5"
                              >
                                {att.filename}
                                <ExternalLink className="w-3 h-3 text-gray-400" />
                              </a>
                            ) : (
                              <span className="flex-1 text-sm text-gray-800 truncate">
                                {att.filename}
                              </span>
                            )}
                            <button
                              onClick={() =>
                                setExpandedAttachment(isExpanded ? null : att.id)
                              }
                              disabled={!att.extractedText}
                              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 transition-colors disabled:opacity-40"
                            >
                              {isExpanded ? (
                                <>
                                  <ChevronUp className="w-3.5 h-3.5" />
                                  Collapse
                                </>
                              ) : (
                                <>
                                  <ChevronDown className="w-3.5 h-3.5" />
                                  Expand
                                </>
                              )}
                            </button>
                            <button
                              onClick={() => handleAttachmentDelete(att.id)}
                              disabled={isDeleting}
                              className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-colors disabled:opacity-40"
                              title="Remove attachment"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          {isExpanded && (
                            <div className="border-t border-gray-100 px-4 py-3 max-h-80 overflow-y-auto bg-gray-50 rounded-b-lg">
                              {att.extractedText ? (
                                <pre className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap font-sans">
                                  {att.extractedText}
                                </pre>
                              ) : (
                                <p className="text-xs italic text-gray-400">
                                  No text could be extracted from this file.
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Existing items */}
                {divItems.length === 0 && !isAddingHere && divAttachments.length === 0 && (
                  <p className="text-xs text-gray-400 italic bg-white border border-dashed border-gray-200 rounded-lg px-4 py-3">
                    No scope items yet. Click &quot;Add Item&quot; or &quot;Attach File&quot; to get started.
                  </p>
                )}

                <div className="space-y-3">
                  {divItems.map((item) => {
                    const isEditing = editForm?.itemId === item.id;
                    const isDeleting = deleteConfirm === item.id;

                    if (isEditing && editForm) {
                      return (
                        <EditCard
                          key={item.id}
                          item={item}
                          editForm={editForm}
                          division={division}
                          projectId={projectId}
                          onEditFormChange={setEditForm}
                          onSave={() => handleEditSave(item)}
                          onCancel={() => setEditForm(null)}
                          onAIDraft={() =>
                            handleEditAIDraft(
                              division.code,
                              division.name,
                              editForm.sectionName
                            )
                          }
                        />
                      );
                    }

                    return (
                      <div
                        key={item.id}
                        className="bg-white border border-gray-200 rounded-lg px-4 py-3"
                      >
                        {(item.section_code || item.section_name) && (
                          <p className="text-xs font-semibold text-gray-500 mb-1">
                            {[item.section_code, item.section_name]
                              .filter(Boolean)
                              .join(" – ")}
                          </p>
                        )}
                        <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
                          {item.scope_text}
                        </p>

                        {isDeleting ? (
                          <div className="mt-3 flex items-center gap-3 text-xs">
                            <span className="text-gray-500">Delete this item?</span>
                            <button
                              onClick={() => handleDelete(item.id)}
                              className="text-red-500 font-medium hover:text-red-700"
                            >
                              Yes, delete
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(null)}
                              className="text-gray-400 hover:text-gray-600"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="mt-3 flex items-center gap-3">
                            <button
                              onClick={() => openEditForm(item)}
                              className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 transition-colors"
                            >
                              <Pencil className="w-3 h-3" />
                              Edit
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(item.id)}
                              className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-colors"
                            >
                              <Trash2 className="w-3 h-3" />
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Add form */}
                {isAddingHere && addForm && (
                  <AddCard
                    addForm={addForm}
                    onFormChange={setAddForm}
                    onSave={handleSave}
                    onCancel={() => setAddForm(null)}
                    onAIDraft={() =>
                      handleAIDraft(
                        division.code,
                        division.name,
                        addForm.sectionName
                      )
                    }
                  />
                )}
              </section>
            );
          })}

          {activeDivisions.size === 0 && (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <FileText className="w-10 h-10 text-gray-300 mb-3" />
              <p className="text-sm font-medium text-gray-500">No divisions selected</p>
              <p className="text-xs text-gray-400 mt-1">
                Use the sidebar to activate CSI divisions for this scope.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

// ─── Add Card ────────────────────────────────────────────────────────────────
function AddCard({
  addForm,
  onFormChange,
  onSave,
  onCancel,
  onAIDraft,
}: {
  addForm: AddFormState;
  onFormChange: React.Dispatch<React.SetStateAction<AddFormState | null>>;
  onSave: () => void;
  onCancel: () => void;
  onAIDraft: () => void;
}) {
  return (
    <div className="bg-white border border-orange-200 rounded-lg px-4 py-4 mt-3 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Section Code
          </label>
          <input
            type="text"
            value={addForm.sectionCode}
            onChange={(e) =>
              onFormChange((f) => f ? { ...f, sectionCode: e.target.value } : f)
            }
            placeholder="e.g. 03 30 00"
            className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Section Name
          </label>
          <input
            type="text"
            value={addForm.sectionName}
            onChange={(e) =>
              onFormChange((f) => f ? { ...f, sectionName: e.target.value } : f)
            }
            placeholder="e.g. Cast-in-Place Concrete"
            className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-xs font-medium text-gray-500">Scope Text</label>
          <button
            onClick={onAIDraft}
            disabled={addForm.aiLoading}
            className="flex items-center gap-1.5 text-xs text-orange-500 hover:text-orange-600 font-medium disabled:opacity-50 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {addForm.aiLoading ? "Generating..." : "AI Draft"}
          </button>
        </div>
        <textarea
          rows={5}
          value={addForm.scopeText}
          onChange={(e) =>
            onFormChange((f) => f ? { ...f, scopeText: e.target.value } : f)
          }
          placeholder="Describe the scope of work for this section..."
          className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-y"
        />
      </div>

      {addForm.error && (
        <p className="text-xs text-red-500">{addForm.error}</p>
      )}

      <div className="flex items-center gap-2">
        <button
          onClick={onSave}
          disabled={addForm.saving}
          className="px-4 py-1.5 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-700 transition-colors disabled:opacity-50"
        >
          {addForm.saving ? "Saving..." : "Save"}
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Edit Card ───────────────────────────────────────────────────────────────
function EditCard({
  item,
  editForm,
  division,
  projectId: _projectId,
  onEditFormChange,
  onSave,
  onCancel,
  onAIDraft,
}: {
  item: ScopeItem;
  editForm: EditFormState;
  division: { code: string; name: string };
  projectId: string;
  onEditFormChange: React.Dispatch<React.SetStateAction<EditFormState | null>>;
  onSave: () => void;
  onCancel: () => void;
  onAIDraft: () => void;
}) {
  void item;
  void division;
  void _projectId;

  return (
    <div className="bg-white border border-orange-200 rounded-lg px-4 py-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Section Code
          </label>
          <input
            type="text"
            value={editForm.sectionCode}
            onChange={(e) =>
              onEditFormChange((f) => f ? { ...f, sectionCode: e.target.value } : f)
            }
            placeholder="e.g. 03 30 00"
            className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Section Name
          </label>
          <input
            type="text"
            value={editForm.sectionName}
            onChange={(e) =>
              onEditFormChange((f) => f ? { ...f, sectionName: e.target.value } : f)
            }
            placeholder="e.g. Cast-in-Place Concrete"
            className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-xs font-medium text-gray-500">Scope Text</label>
          <button
            onClick={onAIDraft}
            disabled={editForm.aiLoading}
            className="flex items-center gap-1.5 text-xs text-orange-500 hover:text-orange-600 font-medium disabled:opacity-50 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {editForm.aiLoading ? "Generating..." : "AI Draft"}
          </button>
        </div>
        <textarea
          rows={5}
          value={editForm.scopeText}
          onChange={(e) =>
            onEditFormChange((f) => f ? { ...f, scopeText: e.target.value } : f)
          }
          className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-y"
        />
      </div>

      {editForm.error && (
        <p className="text-xs text-red-500">{editForm.error}</p>
      )}

      <div className="flex items-center gap-2">
        <button
          onClick={onSave}
          disabled={editForm.saving}
          className="px-4 py-1.5 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-700 transition-colors disabled:opacity-50"
        >
          {editForm.saving ? "Saving..." : "Save Changes"}
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
