"use client";

import { useState, useEffect, useRef, useCallback, useMemo, DragEvent } from "react";
import { Hand } from "lucide-react";
import ProjectNav from "@/components/ProjectNav";

// ── Types ─────────────────────────────────────────────────────────────────────

type DrawingUpload = {
  id: string;
  filename: string;
  page_count: number;
  storage_path: string;
  uploaded_by_name: string;
  uploaded_at: string;
  set_id?: string | null;
};

type DrawingPage = {
  id: string;
  upload_id: string;
  page_number: number;
  drawing_no: string | null;
  title: string | null;
  revision: string | null;
  drawing_date: string | null;
  received_date: string | null;
  category: string | null;
  updated_at: string;
  // resolved by API: per-page extracted PDF path (new) or shared upload path (legacy)
  storage_path: string;
  // which page of storage_path to show: 1 for extracted pages, page_number for legacy
  viewer_page: number;
  filename: string;
  uploaded_by_name: string;
  uploaded_at: string;
};

// ── Nav ───────────────────────────────────────────────────────────────────────


// ── Search types ──────────────────────────────────────────────────────────────

type SearchResult = {
  drawing: DrawingPage;
  matchCount: number;
};

type HighlightRect = { left: number; top: number; width: number; height: number };

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

function drawingLabel(d: DrawingPage) {
  if (d.drawing_no || d.title) {
    return `${d.drawing_no ?? ""}${d.drawing_no && d.title ? " — " : ""}${d.title ?? ""}`.trim();
  }
  return `Page ${d.page_number} of ${d.filename}`;
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let idx = haystack.indexOf(needle);
  while (idx !== -1) {
    count++;
    idx = haystack.indexOf(needle, idx + needle.length);
  }
  return count;
}

const DISCIPLINE_LABELS: Record<string, string> = {
  A: "Architectural", C: "Civil", E: "Electrical",
  M: "Mechanical", P: "Plumbing", S: "Structural",
  L: "Landscape", G: "General", T: "Telecommunications",
  FP: "Fire Protection",
};

function disciplineLabelFromCode(code: string | null | undefined): string | null {
  if (!code) return null;
  return DISCIPLINE_LABELS[code.toUpperCase()] ?? null;
}

function inferDiscipline(drawingNo: string | null, category?: string | null): string {
  const fromCategory = disciplineLabelFromCode(category);
  if (fromCategory) return fromCategory;
  // A non-empty category that isn't a known built-in code is a custom
  // discipline label, stored verbatim — show it as-is.
  if (category && category.trim()) return category.trim();
  if (!drawingNo) return "General";
  const m = drawingNo.match(/^([A-Za-z]+)[-\d]/);
  if (!m) return "General";
  return DISCIPLINE_LABELS[m[1].toUpperCase()] ?? "General";
}

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

// ── Title-block text extraction ───────────────────────────────────────────────

type ExtractedMeta = {
  drawing_no?: string;
  title?: string;
  revision?: string;
  drawing_date?: string;
};

type TItem = { str: string; x: number; y: number; w: number };

const LABEL_PATTERNS: Record<keyof ExtractedMeta, RegExp> = {
  drawing_no:   /^(dwg\.?\s*no\.?|drawing\s*no\.?|drawing\s*number|sheet\s*no\.?|drg\.?\s*no\.?|sheet\s*number)$/i,
  title:        /^(title|drawing\s*title|sheet\s*title|project\s*title|description)$/i,
  revision:     /^(rev\.?|revision|rev\.?\s*no\.?|rev\s*#)$/i,
  drawing_date: /^(date|dwg\.?\s*date|drawing\s*date|issue\s*date|dated?)$/i,
};

function parseIsoDate(str: string): string {
  // MM/DD/YYYY or MM-DD-YYYY
  const mdy = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (mdy) return `${mdy[3]}-${mdy[1].padStart(2, "0")}-${mdy[2].padStart(2, "0")}`;
  // YYYY-MM-DD already
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  // Try JS Date (handles "Jan 15 2024" etc.)
  const d = new Date(str);
  if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
  return "";
}

async function extractMetaFromPage(storagePath: string, pageNumber: number): Promise<ExtractedMeta> {
  await ensurePdfJs();
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return {};

  const url = `${supabaseUrl}/storage/v1/object/public/project-drawings/${storagePath}`;
  const pdf = await getDocument(url).promise;
  const page = await pdf.getPage(pageNumber);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const textContent = await (page as any).getTextContent();

  const items: TItem[] = (textContent.items as Array<{ str: string; transform: number[]; width: number }>)
    .filter((i) => i.str?.trim())
    .map((i) => ({
      str: i.str.trim(),
      x: i.transform[4],
      y: i.transform[5],
      w: i.width ?? 0,
    }));

  const result: ExtractedMeta = {};

  for (const item of items) {
    for (const field of Object.keys(LABEL_PATTERNS) as Array<keyof ExtractedMeta>) {
      if (result[field]) continue;
      if (!LABEL_PATTERNS[field].test(item.str)) continue;

      // 1. Same row, immediately to the right
      const sameRow = items
        .filter((i) => Math.abs(i.y - item.y) < 4 && i.x > item.x + item.w - 1 && i.str.length > 0)
        .sort((a, b) => a.x - b.x);

      const rowCandidate = sameRow.find(
        (i) => !Object.values(LABEL_PATTERNS).some((p) => p.test(i.str))
      );
      if (rowCandidate) {
        result[field] = field === "drawing_date" ? (parseIsoDate(rowCandidate.str) || rowCandidate.str) : rowCandidate.str;
        continue;
      }

      // 2. Directly below the label (PDF y goes up, so below = smaller y)
      const below = items
        .filter(
          (i) =>
            i.y < item.y &&
            i.y > item.y - 30 &&
            i.x >= item.x - 10 &&
            i.x <= item.x + Math.max(item.w, 60) + 10 &&
            i.str.length > 0
        )
        .sort((a, b) => b.y - a.y);

      const belowCandidate = below.find(
        (i) => !Object.values(LABEL_PATTERNS).some((p) => p.test(i.str))
      );
      if (belowCandidate) {
        result[field] = field === "drawing_date" ? (parseIsoDate(belowCandidate.str) || belowCandidate.str) : belowCandidate.str;
      }
    }
  }

  return result;
}

async function renderPageFromDoc(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pdf: any,
  pageNumber: number
): Promise<string> {
  const page = await pdf.getPage(pageNumber);
  const vp = page.getViewport({ scale: 0.4 });
  const canvas = document.createElement("canvas");
  canvas.width = vp.width;
  canvas.height = vp.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  await page.render({ canvasContext: ctx, viewport: vp }).promise;
  return canvas.toDataURL();
}

// ── Annotation types ──────────────────────────────────────────────────────────

type AnnotationTool = "pen" | "rect" | "circle" | "line" | "text" | "eraser" | "select";

type AnnotationStroke = {
  id: string;
  tool: "pen" | "rect" | "circle" | "line" | "text";
  color: string;
  lineWidth: number;
  points?: { x: number; y: number }[];
  x?: number; y?: number; w?: number; h?: number;
  x1?: number; y1?: number; x2?: number; y2?: number;
  text?: string; tx?: number; ty?: number;
};

type AnnotationSet = {
  created_by: string;
  created_by_name: string | null;
  role: string | null;
  annotation_data: AnnotationStroke[];
};

const ANNOTATION_COLORS = [
  { label: "Red",    value: "#ef4444" },
  { label: "Blue",   value: "#3b82f6" },
  { label: "Green",  value: "#22c55e" },
  { label: "Yellow", value: "#eab308" },
  { label: "Black",  value: "#111827" },
];

const ROLE_COLORS: Record<string, string> = {
  admin: "#3b82f6",
  member: "#22c55e",
  external_viewer: "#f97316",
};

function roleColor(role: string | null): string {
  return ROLE_COLORS[role ?? ""] ?? "#9ca3af";
}

function genId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function getHandlePositions(stroke: AnnotationStroke): Record<string, { x: number; y: number }> {
  if (stroke.tool === "rect" || stroke.tool === "circle") {
    const x = stroke.x ?? 0, y = stroke.y ?? 0, w = stroke.w ?? 0, h = stroke.h ?? 0;
    return {
      nw: { x, y },
      ne: { x: x + w, y },
      sw: { x, y: y + h },
      se: { x: x + w, y: y + h },
    };
  }
  if (stroke.tool === "line") {
    return {
      p1: { x: stroke.x1 ?? 0, y: stroke.y1 ?? 0 },
      p2: { x: stroke.x2 ?? 0, y: stroke.y2 ?? 0 },
    };
  }
  return {};
}

function findHandleNear(stroke: AnnotationStroke, rx: number, ry: number): string | null {
  const THRESHOLD = 0.025;
  for (const [name, pos] of Object.entries(getHandlePositions(stroke))) {
    if (Math.abs(pos.x - rx) < THRESHOLD && Math.abs(pos.y - ry) < THRESHOLD) return name;
  }
  return null;
}

function findStrokeNear(strokes: AnnotationStroke[], rx: number, ry: number): string | null {
  const THRESHOLD = 0.04;
  for (const stroke of [...strokes].reverse()) {
    if (stroke.tool === "text") {
      if (Math.abs((stroke.tx ?? 0) - rx) < THRESHOLD && Math.abs((stroke.ty ?? 0) - ry) < THRESHOLD * 2) return stroke.id;
    } else if (stroke.tool === "rect" || stroke.tool === "circle") {
      const x0 = Math.min(stroke.x ?? 0, (stroke.x ?? 0) + (stroke.w ?? 0)) - THRESHOLD;
      const x1 = Math.max(stroke.x ?? 0, (stroke.x ?? 0) + (stroke.w ?? 0)) + THRESHOLD;
      const y0 = Math.min(stroke.y ?? 0, (stroke.y ?? 0) + (stroke.h ?? 0)) - THRESHOLD;
      const y1 = Math.max(stroke.y ?? 0, (stroke.y ?? 0) + (stroke.h ?? 0)) + THRESHOLD;
      if (rx >= x0 && rx <= x1 && ry >= y0 && ry <= y1) return stroke.id;
    } else if (stroke.tool === "line") {
      const x1 = stroke.x1 ?? 0, y1 = stroke.y1 ?? 0;
      const x2 = stroke.x2 ?? 0, y2 = stroke.y2 ?? 0;
      const dx = x2 - x1, dy = y2 - y1;
      const lenSq = dx * dx + dy * dy;
      const t = lenSq > 0 ? Math.max(0, Math.min(1, ((rx - x1) * dx + (ry - y1) * dy) / lenSq)) : 0;
      const nearX = x1 + t * dx, nearY = y1 + t * dy;
      if (Math.abs(nearX - rx) < THRESHOLD && Math.abs(nearY - ry) < THRESHOLD) return stroke.id;
    } else if (stroke.tool === "pen" && stroke.points?.length) {
      const hit = stroke.points.some(
        (p) => Math.abs(p.x - rx) < THRESHOLD && Math.abs(p.y - ry) < THRESHOLD
      );
      if (hit) return stroke.id;
    }
  }
  return null;
}

// ── Drawing PDF Viewer Modal ──────────────────────────────────────────────────

function DrawingPdfViewerModal({
  drawing,
  allDrawings,
  onClose,
  onNavigate,
  onEditDetails,
  projectId,
  userRole,
  userName,
  userId,
  search,
}: {
  drawing: DrawingPage;
  allDrawings: DrawingPage[];
  onClose: () => void;
  onNavigate: (d: DrawingPage) => void;
  onEditDetails: () => void;
  projectId: string;
  userRole: string;
  userName: string;
  userId: string;
  search: {
    query: string;
    results: SearchResult[];
    building: boolean;
    panelOpen: boolean;
    onTogglePanel: () => void;
    onRun: (q: string) => void;
    thumbnails: Map<string, string>;
    thumbVersion: number;
  };
}) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const safeViewerPage = drawing.viewer_page > 0 ? drawing.viewer_page : 1;
  const pdfUrl = `${supabaseUrl}/storage/v1/object/public/project-drawings/${drawing.storage_path}#page=${safeViewerPage}`;
  const name = drawingLabel(drawing);

  const [loading, setLoading] = useState(true);
  const [renderError, setRenderError] = useState<string | null>(null);

  // ── Zoom state ────────────────────────────────────────────────────────────
  // 1 = fit-to-container (the size computed during render). Display size
  // scales by this multiplier; the supersampled raster keeps things crisp.
  const ZOOM_MIN = 0.25;
  const ZOOM_MAX = 8;
  const ZOOM_STEP = 1.25;
  const [zoom, setZoom] = useState(1);
  const clampZoom = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
  const zoomIn = () => setZoom((z) => clampZoom(z * ZOOM_STEP));
  const zoomOut = () => setZoom((z) => clampZoom(z / ZOOM_STEP));
  const zoomReset = () => setZoom(1);
  // Reset zoom whenever the rendered page changes
  useEffect(() => { setZoom(1); }, [drawing.id, safeViewerPage]);

  // ── PDF text-search highlight state ───────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pageRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fitViewportRef = useRef<any>(null);
  const [highlights, setHighlights] = useState<HighlightRect[]>([]);
  const [panelQuery, setPanelQuery] = useState(search.query);
  const firstHighlightRef = useRef<HTMLDivElement>(null);
  const autoScrolledRef = useRef<string>("");

  // ── Annotation state ──────────────────────────────────────────────────────
  const [annotationMode, setAnnotationMode] = useState(false);
  const [annotationsVisible, setAnnotationsVisible] = useState(true);
  const [annotationsLoaded, setAnnotationsLoaded] = useState(false);
  const [activeTool, setActiveTool] = useState<AnnotationTool>("pen");
  const [activeColor, setActiveColor] = useState("#ef4444");
  const [strokes, setStrokes] = useState<AnnotationStroke[]>([]);
  const [allAnnotations, setAllAnnotations] = useState<AnnotationSet[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const isDrawingRef = useRef(false);
  const currentStrokeRef = useRef<AnnotationStroke | null>(null);
  const annotationCanvasRef = useRef<HTMLCanvasElement>(null);
  const pdfDimsRef = useRef<{ w: number; h: number } | null>(null);
  const [pdfDataUrl, setPdfDataUrl] = useState<string | null>(null);
  // Displayed CSS size of the rendered page (smaller than the raster's
  // intrinsic pixels — we supersample so zoom-in stays crisp).
  const [pdfDisplaySize, setPdfDisplaySize] = useState<{ w: number; h: number } | null>(null);
  const [selectedStrokeId, setSelectedStrokeId] = useState<string | null>(null);
  const selectedStrokeIdRef = useRef<string | null>(null);
  const dragOffsetRef = useRef<{ dx: number; dy: number } | null>(null);
  const dragHandleRef = useRef<string | null>(null);

  const strokesRef = useRef<AnnotationStroke[]>([]);
  const allAnnotationsRef = useRef<AnnotationSet[]>([]);
  const activeColorRef = useRef(activeColor);
  useEffect(() => { activeColorRef.current = activeColor; }, [activeColor]);

  // Keyboard: Esc to close, ArrowLeft/ArrowRight to navigate
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { onClose(); return; }
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const idx = allDrawings.findIndex((d) => d.id === drawing.id);
      if (e.key === "ArrowLeft" && idx > 0) onNavigate(allDrawings[idx - 1]);
      if (e.key === "ArrowRight" && idx < allDrawings.length - 1) onNavigate(allDrawings[idx + 1]);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, onNavigate, drawing.id, allDrawings]);

  // Load annotations on mount
  useEffect(() => {
    if (annotationsLoaded) return;
    async function fetchAnnotations() {
      try {
        const res = await fetch(`/api/projects/${projectId}/drawings/${drawing.id}/annotations`);
        if (!res.ok) return;
        const data: AnnotationSet[] = await res.json();
        allAnnotationsRef.current = data;
        setAllAnnotations(data);
        // Match by UUID first so username changes don't orphan records; fall back to
        // name match for legacy rows written with created_by = NULL.
        const myRecord =
          data.find((a) => a.created_by === userId) ??
          data.find((a) => a.created_by === null && a.created_by_name === userName) ??
          data.find((a) => a.created_by_name === userName);
        if (myRecord && Array.isArray(myRecord.annotation_data)) {
          strokesRef.current = myRecord.annotation_data;
          setStrokes(myRecord.annotation_data);
        }
      } catch (err) {
        console.error("[DrawingAnnotations] Load error:", err);
      } finally {
        setAnnotationsLoaded(true);
        requestAnimationFrame(() => redrawCanvas());
      }
    }
    fetchAnnotations();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [annotationsLoaded, drawing.id, projectId, userName, userId]);

  const containerRef = useRef<HTMLDivElement>(null);
  const previewSurfaceRef = useRef<HTMLDivElement>(null);

  // ── Wheel + pinch gesture zoom ────────────────────────────────────────────
  // Ctrl/⌘+wheel zooms on desktop (trackpad pinch also arrives as a wheel
  // event with ctrlKey=true); two-finger pinch zooms on touch devices.
  // Plain wheel keeps panning, so users can still scroll a zoomed drawing.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function applyZoomFactor(factor: number, clientX: number, clientY: number) {
      const surface = previewSurfaceRef.current;
      const containerEl = containerRef.current;
      if (!surface || !containerEl) {
        setZoom((z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z * factor)));
        return;
      }
      const sRect = surface.getBoundingClientRect();
      const contentX = clientX - sRect.left;
      const contentY = clientY - sRect.top;
      setZoom((prev) => {
        const next = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, prev * factor));
        if (Math.abs(next - prev) < 1e-9) return prev;
        const ratio = next / prev;
        // After the new zoom is laid out, re-measure and shift scroll so the
        // anchor point stays under the cursor / pinch midpoint.
        requestAnimationFrame(() => {
          const surface2 = previewSurfaceRef.current;
          const container2 = containerRef.current;
          if (!surface2 || !container2) return;
          const newSRect = surface2.getBoundingClientRect();
          const dx = newSRect.left + contentX * ratio - clientX;
          const dy = newSRect.top + contentY * ratio - clientY;
          container2.scrollLeft += dx;
          container2.scrollTop += dy;
        });
        return next;
      });
    }

    function handleWheel(e: WheelEvent) {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const factor = Math.exp(-e.deltaY * 0.01);
      applyZoomFactor(factor, e.clientX, e.clientY);
    }

    let pinchPrevDist: number | null = null;
    function handleTouchStart(e: TouchEvent) {
      if (e.touches.length === 2) {
        const t1 = e.touches[0]!;
        const t2 = e.touches[1]!;
        pinchPrevDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      } else {
        pinchPrevDist = null;
      }
    }
    function handleTouchMove(e: TouchEvent) {
      if (e.touches.length !== 2 || pinchPrevDist == null) return;
      e.preventDefault();
      const t1 = e.touches[0]!;
      const t2 = e.touches[1]!;
      const newDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      if (pinchPrevDist > 0 && newDist > 0) {
        const factor = newDist / pinchPrevDist;
        const cx = (t1.clientX + t2.clientX) / 2;
        const cy = (t1.clientY + t2.clientY) / 2;
        applyZoomFactor(factor, cx, cy);
      }
      pinchPrevDist = newDist;
    }
    function handleTouchEnd(e: TouchEvent) {
      if (e.touches.length < 2) pinchPrevDist = null;
    }

    container.addEventListener("wheel", handleWheel, { passive: false });
    container.addEventListener("touchstart", handleTouchStart, { passive: true });
    container.addEventListener("touchmove", handleTouchMove, { passive: false });
    container.addEventListener("touchend", handleTouchEnd, { passive: true });
    container.addEventListener("touchcancel", handleTouchEnd, { passive: true });
    return () => {
      container.removeEventListener("wheel", handleWheel);
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", handleTouchEnd);
      container.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, []);

  // When annotation canvas is toggled on, restore its dimensions and redraw
  useEffect(() => {
    if (!annotationsVisible) return;
    const dims = pdfDimsRef.current;
    const annoCanvas = annotationCanvasRef.current;
    if (dims && annoCanvas) {
      annoCanvas.width = dims.w;
      annoCanvas.height = dims.h;
    }
    requestAnimationFrame(() => redrawCanvas());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [annotationsVisible]);

  // Keep annotation canvas in sync with whatever surface is currently visible
  // (rendered PDF image or browser iframe fallback).
  useEffect(() => {
    if (!annotationsVisible) return;
    const surface = previewSurfaceRef.current;
    if (!surface) return;

    const syncCanvasSize = () => {
      const annoCanvas = annotationCanvasRef.current;
      if (!annoCanvas) return;
      const nextW = Math.max(Math.round(surface.clientWidth), 1);
      const nextH = Math.max(Math.round(surface.clientHeight), 1);
      if (annoCanvas.width !== nextW || annoCanvas.height !== nextH) {
        annoCanvas.width = nextW;
        annoCanvas.height = nextH;
      }
      requestAnimationFrame(() => redrawCanvas());
    };

    syncCanvasSize();
    const observer = new ResizeObserver(syncCanvasSize);
    observer.observe(surface);
    return () => observer.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [annotationsVisible, pdfDataUrl, loading, renderError]);

  // Render PDF via PDF.js into an offscreen canvas → data URL → stable <img>
  useEffect(() => {
    let cancelled = false;
    async function renderPdf() {
      setLoading(true);
      setRenderError(null);
      setPdfDataUrl(null);
      setPdfDisplaySize(null);
      try {
        await ensurePdfJs();
        const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
        const url = `${supabaseUrl}/storage/v1/object/public/project-drawings/${drawing.storage_path}`;
        const pdf = await getDocument(url).promise;
        if (cancelled) return;
        const page = await pdf.getPage(safeViewerPage);
        if (cancelled) return;
        pageRef.current = page;
        const containerW = Math.max((containerRef.current?.clientWidth ?? 900) - 32, 200);
        const containerH = Math.max((containerRef.current?.clientHeight ?? 700) - 32, 200);
        const baseVp = page.getViewport({ scale: 1 });
        const fitScale = Math.min(containerW / baseVp.width, containerH / baseVp.height);
        // Supersample so the raster still has pixel detail when the user
        // zooms in (browser zoom or pinch). Cap render dimensions to keep
        // memory + toDataURL latency reasonable on huge sheets.
        const dpr = typeof window !== "undefined" ? (window.devicePixelRatio || 1) : 1;
        const desiredSupersample = Math.max(dpr, 1) * 3;
        const MAX_RENDER_PX = 4096;
        const maxScaleByPixels = Math.min(
          MAX_RENDER_PX / baseVp.width,
          MAX_RENDER_PX / baseVp.height,
        );
        const renderScale = Math.min(fitScale * desiredSupersample, maxScaleByPixels);
        const fitVp = page.getViewport({ scale: fitScale });
        fitViewportRef.current = fitVp;
        const vp = page.getViewport({ scale: renderScale });
        // Render to an offscreen canvas — never touched by React
        const offscreen = document.createElement("canvas");
        offscreen.width = vp.width;
        offscreen.height = vp.height;
        const ctx = offscreen.getContext("2d");
        if (!ctx || cancelled) return;
        await page.render({ canvasContext: ctx, viewport: vp }).promise;
        if (cancelled) return;
        pdfDimsRef.current = { w: fitVp.width, h: fitVp.height };
        setPdfDisplaySize({ w: fitVp.width, h: fitVp.height });
        setPdfDataUrl(offscreen.toDataURL());
        const annoCanvas = annotationCanvasRef.current;
        if (annoCanvas) {
          annoCanvas.width = fitVp.width;
          annoCanvas.height = fitVp.height;
          redrawCanvas();
        }
      } catch (err) {
        console.error("[Drawing] PDF render error:", err);
        setRenderError("Could not render PDF preview. Showing browser fallback.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    renderPdf();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawing.id, drawing.storage_path, safeViewerPage, supabaseUrl]);

  // Compute highlight boxes for the active search query on the rendered page
  useEffect(() => {
    let cancelled = false;
    async function computeHighlights() {
      const page = pageRef.current;
      const vp = fitViewportRef.current;
      const q = search.query.trim().toLowerCase();
      if (!page || !vp || !q) { setHighlights([]); return; }
      try {
        const tc = await page.getTextContent();
        if (cancelled) return;
        // Concatenate item text (separated by a space, matching the search
        // index) so a match spanning adjacent text items is still found.
        const segs: { str: string; start: number; transform: number[]; width: number; height: number }[] = [];
        let full = "";
        for (const it of tc.items) {
          if (typeof it.str !== "string") continue;
          segs.push({ str: it.str, start: full.length, transform: it.transform, width: it.width ?? 0, height: it.height ?? 0 });
          full += it.str + " ";
        }
        const lowerFull = full.toLowerCase();
        const rects: HighlightRect[] = [];
        let matchIdx = lowerFull.indexOf(q);
        while (matchIdx !== -1 && rects.length < 1000) {
          const matchEnd = matchIdx + q.length;
          for (const seg of segs) {
            const len = seg.str.length;
            if (len === 0) continue;
            const itemStart = seg.start;
            const itemEnd = seg.start + len;
            const overlapStart = Math.max(matchIdx, itemStart);
            const overlapEnd = Math.min(matchEnd, itemEnd);
            if (overlapStart >= overlapEnd) continue;
            const w = seg.width;
            if (w <= 0) continue;
            const e = seg.transform[4];
            const f = seg.transform[5];
            const h = seg.height > 0 ? seg.height : Math.abs(seg.transform[3]) || 8;
            const startFrac = (overlapStart - itemStart) / len;
            const endFrac = (overlapEnd - itemStart) / len;
            const p0 = vp.convertToViewportPoint(e + w * startFrac, f + h);
            const p1 = vp.convertToViewportPoint(e + w * endFrac, f);
            rects.push({
              left: Math.min(p0[0], p1[0]) / vp.width,
              top: Math.min(p0[1], p1[1]) / vp.height,
              width: Math.abs(p1[0] - p0[0]) / vp.width,
              height: Math.abs(p1[1] - p0[1]) / vp.height,
            });
          }
          matchIdx = lowerFull.indexOf(q, matchEnd);
        }
        if (!cancelled) setHighlights(rects);
      } catch {
        if (!cancelled) setHighlights([]);
      }
    }
    computeHighlights();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfDataUrl, search.query]);

  // Scroll the first match into view once per drawing/query
  useEffect(() => {
    if (highlights.length === 0) return;
    const key = `${drawing.id}|${search.query}`;
    if (autoScrolledRef.current === key) return;
    autoScrolledRef.current = key;
    const raf = requestAnimationFrame(() => {
      firstHighlightRef.current?.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
    });
    return () => cancelAnimationFrame(raf);
  }, [highlights, drawing.id, search.query]);

  // Keep the panel input in sync with the active query
  useEffect(() => { setPanelQuery(search.query); }, [search.query]);

  function toRel(canvas: HTMLCanvasElement, clientX: number, clientY: number) {
    const rect = canvas.getBoundingClientRect();
    return { x: (clientX - rect.left) / rect.width, y: (clientY - rect.top) / rect.height };
  }

  function toAbs(canvas: HTMLCanvasElement, rx: number, ry: number) {
    return { x: rx * canvas.width, y: ry * canvas.height };
  }

  function redrawCanvas(previewStroke?: AnnotationStroke | null) {
    const canvas = annotationCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const set of allAnnotationsRef.current) {
      if (set.created_by_name === userName) continue;
      renderStrokeSet(ctx, canvas.width, canvas.height, set.annotation_data, roleColor(set.role), false);
    }
    renderStrokeSet(ctx, canvas.width, canvas.height, strokesRef.current, activeColorRef.current, true);
    if (previewStroke) {
      renderStrokeSet(ctx, canvas.width, canvas.height, [previewStroke], activeColorRef.current, true);
    }
    const selId = selectedStrokeIdRef.current;
    if (selId) {
      const selStroke = strokesRef.current.find((s) => s.id === selId);
      if (selStroke) drawSelectionBorder(ctx, canvas.width, canvas.height, selStroke);
    }
  }

  function drawSelectionBorder(ctx: CanvasRenderingContext2D, cw: number, ch: number, stroke: AnnotationStroke) {
    const PAD = 6;
    ctx.save();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    if (stroke.tool === "text" && stroke.tx !== undefined && stroke.ty !== undefined) {
      const p = toAbs(annotationCanvasRef.current!, stroke.tx, stroke.ty);
      const fontSize = 14 * (stroke.lineWidth ?? 1);
      const estW = (stroke.text?.length ?? 4) * fontSize * 0.6 + PAD * 2;
      ctx.strokeRect(p.x - PAD, p.y - fontSize - PAD, estW, fontSize + PAD * 2);
    } else if ((stroke.tool === "rect" || stroke.tool === "circle") && stroke.x !== undefined) {
      const p = toAbs(annotationCanvasRef.current!, stroke.x, stroke.y!);
      const w = (stroke.w ?? 0) * cw;
      const h = (stroke.h ?? 0) * ch;
      ctx.strokeRect(p.x - PAD * Math.sign(w || 1), p.y - PAD * Math.sign(h || 1), w + PAD * 2 * Math.sign(w || 1), h + PAD * 2 * Math.sign(h || 1));
    } else if (stroke.tool === "line" && stroke.x1 !== undefined) {
      const a = toAbs(annotationCanvasRef.current!, stroke.x1!, stroke.y1!);
      const b = toAbs(annotationCanvasRef.current!, stroke.x2!, stroke.y2!);
      ctx.strokeRect(Math.min(a.x, b.x) - PAD, Math.min(a.y, b.y) - PAD, Math.abs(b.x - a.x) + PAD * 2, Math.abs(b.y - a.y) + PAD * 2);
    } else if (stroke.tool === "pen" && stroke.points?.length) {
      const xs = stroke.points.map((p) => p.x * cw);
      const ys = stroke.points.map((p) => p.y * ch);
      ctx.strokeRect(Math.min(...xs) - PAD, Math.min(...ys) - PAD, Math.max(...xs) - Math.min(...xs) + PAD * 2, Math.max(...ys) - Math.min(...ys) + PAD * 2);
    }
    // Draw resize handles at corners/endpoints
    const handles = getHandlePositions(stroke);
    if (Object.keys(handles).length > 0) {
      const HANDLE = 7;
      ctx.setLineDash([]);
      ctx.lineWidth = 1;
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "#555555";
      for (const pos of Object.values(handles)) {
        const ax = pos.x * cw, ay = pos.y * ch;
        ctx.fillRect(ax - HANDLE / 2, ay - HANDLE / 2, HANDLE, HANDLE);
        ctx.strokeRect(ax - HANDLE / 2, ay - HANDLE / 2, HANDLE, HANDLE);
      }
    }
    ctx.restore();
  }

  function renderStrokeSet(ctx: CanvasRenderingContext2D, cw: number, ch: number, strokeList: AnnotationStroke[], fallbackColor: string, useStrokeColor: boolean) {
    for (const stroke of strokeList) {
      const color = useStrokeColor ? stroke.color : fallbackColor;
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = stroke.lineWidth ?? 2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      if (stroke.tool === "pen" && stroke.points && stroke.points.length > 1) {
        ctx.beginPath();
        const first = toAbs(annotationCanvasRef.current!, stroke.points[0].x, stroke.points[0].y);
        ctx.moveTo(first.x, first.y);
        for (let i = 1; i < stroke.points.length; i++) {
          const pt = toAbs(annotationCanvasRef.current!, stroke.points[i].x, stroke.points[i].y);
          ctx.lineTo(pt.x, pt.y);
        }
        ctx.stroke();
      } else if (stroke.tool === "rect" && stroke.x !== undefined) {
        const p = toAbs(annotationCanvasRef.current!, stroke.x!, stroke.y!);
        ctx.beginPath();
        ctx.strokeRect(p.x, p.y, stroke.w! * cw, stroke.h! * ch);
      } else if (stroke.tool === "circle" && stroke.x !== undefined) {
        const p = toAbs(annotationCanvasRef.current!, stroke.x!, stroke.y!);
        const rx = (stroke.w! * cw) / 2;
        const ry = (stroke.h! * ch) / 2;
        ctx.beginPath();
        ctx.ellipse(p.x + rx, p.y + ry, Math.abs(rx), Math.abs(ry), 0, 0, Math.PI * 2);
        ctx.stroke();
      } else if (stroke.tool === "line" && stroke.x1 !== undefined) {
        const a = toAbs(annotationCanvasRef.current!, stroke.x1!, stroke.y1!);
        const b = toAbs(annotationCanvasRef.current!, stroke.x2!, stroke.y2!);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      } else if (stroke.tool === "text" && stroke.text && stroke.tx !== undefined) {
        const p = toAbs(annotationCanvasRef.current!, stroke.tx!, stroke.ty!);
        ctx.font = `${14 * (stroke.lineWidth ?? 1)}px sans-serif`;
        ctx.fillText(stroke.text, p.x, p.y);
      }
    }
  }

  function startDraw(e: React.MouseEvent<HTMLCanvasElement>) {
    if (userRole === "external_viewer") return;
    const canvas = annotationCanvasRef.current!;
    const rel = toRel(canvas, e.clientX, e.clientY);
    if (activeTool === "select") {
      // Check if clicking a resize handle on the currently selected stroke
      const currentSelId = selectedStrokeIdRef.current;
      if (currentSelId) {
        const selStroke = strokesRef.current.find((s) => s.id === currentSelId);
        if (selStroke) {
          const handle = findHandleNear(selStroke, rel.x, rel.y);
          if (handle) {
            dragHandleRef.current = handle;
            dragOffsetRef.current = null;
            isDrawingRef.current = true;
            redrawCanvas();
            return;
          }
        }
      }
      const foundId = findStrokeNear(strokesRef.current, rel.x, rel.y);
      if (foundId) {
        setSelectedStrokeId(foundId);
        selectedStrokeIdRef.current = foundId;
        dragHandleRef.current = null;
        const stroke = strokesRef.current.find((s) => s.id === foundId);
        if (stroke) {
          let anchorX = 0, anchorY = 0;
          if (stroke.tool === "text") { anchorX = stroke.tx ?? 0; anchorY = stroke.ty ?? 0; }
          else if (stroke.tool === "rect" || stroke.tool === "circle") { anchorX = stroke.x ?? 0; anchorY = stroke.y ?? 0; }
          else if (stroke.tool === "line") { anchorX = stroke.x1 ?? 0; anchorY = stroke.y1 ?? 0; }
          else if (stroke.tool === "pen" && stroke.points?.length) { anchorX = stroke.points[0].x; anchorY = stroke.points[0].y; }
          dragOffsetRef.current = { dx: rel.x - anchorX, dy: rel.y - anchorY };
        }
        isDrawingRef.current = true;
        redrawCanvas();
      } else {
        setSelectedStrokeId(null);
        selectedStrokeIdRef.current = null;
        dragOffsetRef.current = null;
        dragHandleRef.current = null;
        redrawCanvas();
      }
      return;
    }
    if (activeTool === "eraser") { eraseAt(rel.x, rel.y); isDrawingRef.current = true; return; }
    if (activeTool === "text") {
      const text = window.prompt("Enter annotation text:");
      if (!text) return;
      const newStroke: AnnotationStroke = { id: genId(), tool: "text", color: activeColor, lineWidth: 2, text, tx: rel.x, ty: rel.y };
      strokesRef.current = [...strokesRef.current, newStroke];
      setStrokes(strokesRef.current);
      redrawCanvas();
      return;
    }
    isDrawingRef.current = true;
    if (activeTool === "pen") {
      currentStrokeRef.current = { id: genId(), tool: "pen", color: activeColor, lineWidth: 2, points: [{ x: rel.x, y: rel.y }] };
    } else if (activeTool === "rect" || activeTool === "circle") {
      currentStrokeRef.current = { id: genId(), tool: activeTool, color: activeColor, lineWidth: 2, x: rel.x, y: rel.y, w: 0, h: 0 };
    } else if (activeTool === "line") {
      currentStrokeRef.current = { id: genId(), tool: "line", color: activeColor, lineWidth: 2, x1: rel.x, y1: rel.y, x2: rel.x, y2: rel.y };
    }
  }

  function draw(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!isDrawingRef.current) return;
    const canvas = annotationCanvasRef.current!;
    const rel = toRel(canvas, e.clientX, e.clientY);
    const movingId = selectedStrokeIdRef.current;
    if (activeTool === "select" && movingId) {
      if (dragHandleRef.current) {
        const handle = dragHandleRef.current;
        strokesRef.current = strokesRef.current.map((s) => {
          if (s.id !== movingId) return s;
          if (s.tool === "rect" || s.tool === "circle") {
            const right = (s.x ?? 0) + (s.w ?? 0), bottom = (s.y ?? 0) + (s.h ?? 0);
            if (handle === "nw") return { ...s, x: rel.x, y: rel.y, w: right - rel.x, h: bottom - rel.y };
            if (handle === "ne") return { ...s, y: rel.y, w: rel.x - (s.x ?? 0), h: bottom - rel.y };
            if (handle === "sw") return { ...s, x: rel.x, w: right - rel.x, h: rel.y - (s.y ?? 0) };
            if (handle === "se") return { ...s, w: rel.x - (s.x ?? 0), h: rel.y - (s.y ?? 0) };
          }
          if (s.tool === "line") {
            if (handle === "p1") return { ...s, x1: rel.x, y1: rel.y };
            if (handle === "p2") return { ...s, x2: rel.x, y2: rel.y };
          }
          return s;
        });
        redrawCanvas();
        return;
      }
      if (dragOffsetRef.current) {
        const { dx, dy } = dragOffsetRef.current;
        const nx = rel.x - dx, ny = rel.y - dy;
        strokesRef.current = strokesRef.current.map((s) => {
          if (s.id !== movingId) return s;
          if (s.tool === "text") return { ...s, tx: nx, ty: ny };
          if (s.tool === "rect" || s.tool === "circle") return { ...s, x: nx, y: ny };
          if (s.tool === "line") { const odx = (s.x2 ?? 0) - (s.x1 ?? 0), ody = (s.y2 ?? 0) - (s.y1 ?? 0); return { ...s, x1: nx, y1: ny, x2: nx + odx, y2: ny + ody }; }
          if (s.tool === "pen" && s.points?.length) { const ox = s.points[0].x, oy = s.points[0].y; return { ...s, points: s.points.map((p) => ({ x: p.x + (nx - ox), y: p.y + (ny - oy) })) }; }
          return s;
        });
        redrawCanvas();
        return;
      }
    }
    if (!currentStrokeRef.current) return;
    if (activeTool === "eraser") { eraseAt(rel.x, rel.y); return; }
    const stroke = currentStrokeRef.current;
    if (stroke.tool === "pen") { stroke.points = [...(stroke.points ?? []), { x: rel.x, y: rel.y }]; }
    else if (stroke.tool === "rect" || stroke.tool === "circle") { stroke.w = rel.x - (stroke.x ?? 0); stroke.h = rel.y - (stroke.y ?? 0); }
    else if (stroke.tool === "line") { stroke.x2 = rel.x; stroke.y2 = rel.y; }
    redrawCanvas(currentStrokeRef.current);
  }

  function endDraw() {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    if (activeTool === "select") { dragOffsetRef.current = null; dragHandleRef.current = null; setStrokes([...strokesRef.current]); redrawCanvas(); return; }
    if (activeTool === "eraser") return;
    if (currentStrokeRef.current) {
      const finished = { ...currentStrokeRef.current };
      currentStrokeRef.current = null;
      strokesRef.current = [...strokesRef.current, finished];
      redrawCanvas();
      setStrokes(strokesRef.current);
    }
  }

  function eraseAt(rx: number, ry: number) {
    const THRESHOLD = 0.02;
    strokesRef.current = strokesRef.current.filter((stroke) => {
      if (stroke.tool === "pen" && stroke.points) return !stroke.points.some((p) => Math.abs(p.x - rx) < THRESHOLD && Math.abs(p.y - ry) < THRESHOLD);
      if (stroke.tool === "rect" || stroke.tool === "circle") { const cx = (stroke.x ?? 0) + (stroke.w ?? 0) / 2, cy = (stroke.y ?? 0) + (stroke.h ?? 0) / 2; return Math.abs(cx - rx) > THRESHOLD * 2 || Math.abs(cy - ry) > THRESHOLD * 2; }
      if (stroke.tool === "line") { const cx = ((stroke.x1 ?? 0) + (stroke.x2 ?? 0)) / 2, cy = ((stroke.y1 ?? 0) + (stroke.y2 ?? 0)) / 2; return Math.abs(cx - rx) > THRESHOLD * 2 || Math.abs(cy - ry) > THRESHOLD * 2; }
      if (stroke.tool === "text") return Math.abs((stroke.tx ?? 0) - rx) > THRESHOLD * 2 || Math.abs((stroke.ty ?? 0) - ry) > THRESHOLD * 2;
      return true;
    });
    redrawCanvas();
    setStrokes(strokesRef.current);
  }

  async function saveAnnotations() {
    setSaving(true);
    setSaveError(null);
    const toSave = strokesRef.current;
    try {
      const res = await fetch(`/api/projects/${projectId}/drawings/${drawing.id}/annotations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ annotation_data: toSave }),
      });
      if (res.ok) {
        setSaveMsg("Saved ✓");
        setTimeout(() => setSaveMsg(null), 3000);
        const isMine = (a: AnnotationSet) =>
          a.created_by === userId || (a.created_by === null && a.created_by_name === userName);
        const updated = allAnnotationsRef.current.some(isMine)
          ? allAnnotationsRef.current.map((a) => isMine(a) ? { ...a, created_by: userId, created_by_name: userName, annotation_data: toSave } : a)
          : [...allAnnotationsRef.current, { created_by: userId, created_by_name: userName, role: userRole, annotation_data: toSave }];
        allAnnotationsRef.current = updated;
        setAllAnnotations(updated);
      } else {
        const errBody = await res.json().catch(() => ({}));
        const msg = errBody?.error ? String(errBody.error) : `HTTP ${res.status}`;
        setSaveError(msg);
        setSaveMsg("Failed");
        setTimeout(() => setSaveMsg(null), 3000);
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Network error");
      setSaveMsg("Failed");
      setTimeout(() => setSaveMsg(null), 3000);
    } finally {
      setSaving(false);
    }
  }

  const canAnnotate = userRole !== "external_viewer";

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gray-950">
      {saveError && (
        <div className="flex items-center justify-between px-4 py-2 bg-red-700 text-white text-sm shrink-0">
          <span><strong>Save failed:</strong> {saveError}</span>
          <button onClick={() => setSaveError(null)} className="ml-4 text-white/80 hover:text-white font-bold">✕</button>
        </div>
      )}
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-900 shrink-0 gap-4 flex-wrap">
        {/* Drawing name + navigation */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {(() => {
            const idx = allDrawings.findIndex((d) => d.id === drawing.id);
            return (
              <>
                <button
                  onClick={() => idx > 0 && onNavigate(allDrawings[idx - 1])}
                  disabled={idx <= 0}
                  title="Previous drawing (←)"
                  className="p-1 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors shrink-0"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  onClick={() => idx < allDrawings.length - 1 && onNavigate(allDrawings[idx + 1])}
                  disabled={idx >= allDrawings.length - 1}
                  title="Next drawing (→)"
                  className="p-1 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors shrink-0"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
                <span className="text-xs text-gray-500 shrink-0">{idx + 1} / {allDrawings.length}</span>
                <div className="w-px h-4 bg-gray-700 shrink-0" />
              </>
            );
          })()}
          <svg className="w-4 h-4 text-blue-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span className="text-sm font-medium text-white truncate">{name}</span>
        </div>

        {/* Annotation controls */}
        {annotationMode && (
          <div className="flex items-center gap-1 flex-wrap shrink-0">
            {canAnnotate ? (
              <>
                {(["select", "pen", "rect", "circle", "line", "text", "eraser"] as AnnotationTool[]).map((tool) => {
                  const titles: Record<AnnotationTool, string> = { select: "Select Tool", pen: "Pen", rect: "Rectangle", circle: "Circle", line: "Line", text: "Text", eraser: "Eraser" };
                  const labelContent: Record<AnnotationTool, React.ReactNode> = { select: <Hand className="w-4 h-4" />, pen: <span>✏️</span>, rect: <span>□</span>, circle: <span>○</span>, line: <span>/</span>, text: <span>T</span>, eraser: <span>⌫</span> };
                  return (
                    <button key={tool} onClick={() => setActiveTool(tool)} title={titles[tool]}
                      className={`px-2 py-1 text-sm rounded transition-colors flex items-center justify-center ${activeTool === tool ? "bg-gray-600 text-white" : "text-gray-400 hover:text-white hover:bg-gray-700"}`}>
                      {labelContent[tool]}
                    </button>
                  );
                })}
                <div className="w-px h-5 bg-gray-700 mx-1" />
                {ANNOTATION_COLORS.map((c) => (
                  <button key={c.value} title={c.label} onClick={() => setActiveColor(c.value)}
                    className={`w-5 h-5 rounded-full border-2 transition-colors ${activeColor === c.value ? "border-white scale-110" : "border-transparent"}`}
                    style={{ backgroundColor: c.value }} />
                ))}
                <div className="w-px h-5 bg-gray-700 mx-1" />
                <button onClick={saveAnnotations} disabled={saving}
                  className={`px-2.5 py-1 text-xs font-medium rounded transition-colors disabled:opacity-50 ${saveMsg === "Failed" ? "bg-red-600 hover:bg-red-700 text-white" : saveMsg ? "bg-green-600 text-white" : "bg-blue-600 hover:bg-blue-700 text-white"}`}>
                  {saving ? "Saving…" : saveMsg ?? "Save"}
                </button>
                <button onClick={() => { if (window.confirm("Clear all your annotations? This cannot be undone.")) { strokesRef.current = []; setStrokes([]); redrawCanvas(); } }}
                  className="px-2.5 py-1 text-xs font-medium text-gray-400 border border-gray-600 rounded hover:bg-gray-700 transition-colors">
                  Clear Mine
                </button>
              </>
            ) : (
              <span className="text-xs text-gray-400 px-2 py-1 border border-gray-700 rounded">View Only</span>
            )}
          </div>
        )}

        {/* Right actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={search.onTogglePanel} title="Search drawing text"
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors ${search.panelOpen ? "bg-blue-500 border-blue-400 text-white" : "text-gray-300 border-gray-600 hover:bg-gray-700"}`}>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
            </svg>
            Search
          </button>
          <button onClick={onEditDetails} title="Edit drawing details"
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-300 border border-gray-600 rounded-md hover:bg-gray-700 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit Details
          </button>
          <button onClick={() => setAnnotationsVisible((v) => !v)} title={annotationsVisible ? "Hide annotations" : "Show annotations"}
            className="p-1.5 text-gray-400 hover:text-white rounded transition-colors">
            {annotationsVisible ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
            )}
          </button>
          <button onClick={() => setAnnotationMode((m) => !m)} title="Toggle Annotations"
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors ${annotationMode ? "bg-yellow-500 border-yellow-400 text-gray-900" : "text-gray-300 border-gray-600 hover:bg-gray-700"}`}>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            Annotate
          </button>
          <a href={pdfUrl} target="_blank" rel="noopener noreferrer" download={name}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-300 border border-gray-600 rounded-md hover:bg-gray-700 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download
          </a>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-white rounded transition-colors" title="Close (Esc)">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Body: PDF viewer + optional search results panel */}
      <div className="flex flex-1 min-h-0">
      {/* PDF canvas + annotation overlay in a scrollable container */}
      <div className="relative flex-1 min-h-0">
      <div ref={containerRef} className="absolute inset-0 overflow-auto bg-gray-950">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-950 z-10">
            <svg className="w-8 h-8 text-gray-500 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        )}
        <div className="flex justify-center items-center p-4 min-h-full min-w-min">
          <div ref={previewSurfaceRef} className="relative inline-block">
            {pdfDataUrl && (
              <img
                src={pdfDataUrl}
                alt={name}
                className="block shadow-xl"
                draggable={false}
                style={
                  pdfDisplaySize
                    ? { width: pdfDisplaySize.w * zoom, height: pdfDisplaySize.h * zoom, maxWidth: "none" }
                    : { maxWidth: "none" }
                }
              />
            )}
            {!pdfDataUrl && !loading && (
              <div className="w-[min(92vw,1100px)] h-[80vh] bg-white rounded overflow-hidden shadow-xl border border-gray-300">
                <iframe
                  src={pdfUrl}
                  title={name}
                  className="w-full h-full"
                />
              </div>
            )}
            {renderError && (
              <div className="absolute top-2 left-2 right-2 z-20 rounded bg-yellow-100 text-yellow-900 border border-yellow-300 px-3 py-2 text-xs">
                {renderError}
              </div>
            )}
            {pdfDataUrl && search.query && highlights.length > 0 && (
              <div className="absolute inset-0" style={{ zIndex: 5, pointerEvents: "none" }}>
                {highlights.map((h, i) => (
                  <div
                    key={i}
                    ref={i === 0 ? firstHighlightRef : undefined}
                    style={{
                      position: "absolute",
                      left: `${h.left * 100}%`,
                      top: `${h.top * 100}%`,
                      width: `${h.width * 100}%`,
                      height: `${h.height * 100}%`,
                      background: "rgba(250, 204, 21, 0.4)",
                      boxShadow: "0 0 0 1.5px rgba(202, 138, 4, 0.85)",
                      borderRadius: "1px",
                    }}
                  />
                ))}
              </div>
            )}
            {annotationsVisible && (
              <canvas
                ref={annotationCanvasRef}
                className="absolute inset-0"
                style={{
                  cursor: annotationMode ? (activeTool === "eraser" ? "cell" : activeTool === "select" ? (selectedStrokeId ? "grabbing" : "grab") : canAnnotate ? "crosshair" : "default") : "default",
                  width: "100%",
                  height: "100%",
                  zIndex: 10,
                  pointerEvents: annotationMode && canAnnotate ? "auto" : "none",
                }}
                onMouseDown={annotationMode ? startDraw : undefined}
                onMouseMove={annotationMode ? draw : undefined}
                onMouseUp={annotationMode ? endDraw : undefined}
                onMouseLeave={annotationMode ? endDraw : undefined}
              />
            )}
          </div>
        </div>
      </div>
        {/* Zoom controls — pinned to the bottom-left of the viewer area */}
        {pdfDataUrl && (
          <div className="absolute bottom-4 left-4 z-30 inline-flex items-center gap-1 rounded-md border border-gray-700 bg-gray-900/90 px-1.5 py-1 shadow-lg backdrop-blur">
            <button
              onClick={zoomOut}
              disabled={zoom <= ZOOM_MIN + 1e-6}
              title="Zoom out"
              className="flex items-center justify-center w-7 h-7 rounded text-gray-200 hover:bg-gray-700 disabled:opacity-40 disabled:hover:bg-transparent"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
              </svg>
            </button>
            <button
              onClick={zoomReset}
              title="Reset zoom"
              className="px-2 h-7 text-xs font-medium text-gray-200 rounded hover:bg-gray-700 tabular-nums min-w-[3.25rem]"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              onClick={zoomIn}
              disabled={zoom >= ZOOM_MAX - 1e-6}
              title="Zoom in"
              className="flex items-center justify-center w-7 h-7 rounded text-gray-200 hover:bg-gray-700 disabled:opacity-40 disabled:hover:bg-transparent"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
        )}
        </div>
        {search.panelOpen && (
          <aside className="w-80 shrink-0 flex flex-col bg-gray-900 border-l border-gray-800">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 shrink-0">
              <h3 className="text-sm font-semibold text-white">Search</h3>
              <button onClick={search.onTogglePanel} title="Close search"
                className="p-1 text-gray-400 hover:text-white rounded transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-3 py-3 border-b border-gray-800 shrink-0">
              <form onSubmit={(e) => { e.preventDefault(); search.onRun(panelQuery); }}>
                <div className="relative">
                  <input
                    type="text"
                    value={panelQuery}
                    onChange={(e) => setPanelQuery(e.target.value)}
                    placeholder="Search all drawings…"
                    className="w-full bg-gray-800 text-white text-sm rounded-md pl-3 pr-14 py-2 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-500"
                  />
                  <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center">
                    {panelQuery && (
                      <button type="button" onClick={() => setPanelQuery("")} title="Clear"
                        className="p-1 text-gray-500 hover:text-white transition-colors">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                    <button type="submit" title="Search"
                      className="p-1 text-blue-400 hover:text-blue-300 transition-colors">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
                      </svg>
                    </button>
                  </div>
                </div>
              </form>
            </div>
            <div className="flex-1 overflow-auto">
              {search.building ? (
                <div className="flex flex-col items-center justify-center gap-2 py-12 text-gray-400 text-sm">
                  <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Indexing drawings…
                </div>
              ) : !search.query ? (
                <div className="px-4 py-12 text-center text-gray-500 text-sm leading-relaxed">
                  Type a word or phrase to search the text inside every drawing in this project.
                </div>
              ) : search.results.length === 0 ? (
                <div className="px-4 py-12 text-center text-gray-400 text-sm">
                  No drawings contain “{search.query}”.
                </div>
              ) : (
                <>
                  <div className="px-4 py-2 text-xs text-gray-400 border-b border-gray-800">
                    {search.results.length} drawing{search.results.length !== 1 ? "s" : ""} ·{" "}
                    {search.results.reduce((sum, r) => sum + r.matchCount, 0)} matches
                  </div>
                  {search.results.map((r) => {
                    const active = r.drawing.id === drawing.id;
                    const thumb = search.thumbnails.get(r.drawing.id);
                    void search.thumbVersion;
                    return (
                      <button
                        key={r.drawing.id}
                        onClick={() => onNavigate(r.drawing)}
                        className={`block w-full text-left px-3 py-3 border-b border-gray-800 transition-colors ${active ? "bg-blue-600/20 border-l-2 border-l-blue-500" : "hover:bg-gray-800 border-l-2 border-l-transparent"}`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <span className={`text-xs font-medium leading-snug ${active ? "text-white" : "text-gray-200"}`}>
                            {drawingLabel(r.drawing)}
                          </span>
                          <span className="shrink-0 text-[10px] font-semibold text-yellow-900 bg-yellow-400 rounded px-1.5 py-0.5">
                            {r.matchCount} Found
                          </span>
                        </div>
                        {thumb ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={thumb} alt={drawingLabel(r.drawing)} className="w-full max-h-40 object-contain bg-white rounded" />
                        ) : (
                          <div className="w-full h-28 flex items-center justify-center bg-gray-800 rounded text-gray-600">
                            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

// ── Upload Drawings Modal ─────────────────────────────────────────────────────

type DrawingSet = {
  id: string;
  name: string;
  default_drawing_date: string | null;
  default_received_date: string | null;
  default_revision: string | null;
  drawing_no_rev_mode: string | null;
  get_number_from_filename: boolean | null;
  drawing_language: string | null;
  created_at?: string | null;
};

type DrawingNoRevMode = "none" | "first_decimal" | "first_underscore" | "last_underscore";

const REV_MODE_OPTIONS: Array<{ value: DrawingNoRevMode; label: string }> = [
  { value: "none", label: "No Rev in Drawing Number" },
  { value: "first_decimal", label: "Rev is after First Decimal" },
  { value: "first_underscore", label: "Rev is after First Underscore" },
  { value: "last_underscore", label: "Rev is after Last Underscore" },
];

const LANGUAGE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "pt", label: "Portuguese" },
  { value: "it", label: "Italian" },
  { value: "ja", label: "Japanese" },
  { value: "zh", label: "Chinese" },
];

export type UploadDrawingsSubmission = {
  files: File[];
  setId: string;
  setName: string;
  defaultDrawingDate: string;
  defaultReceivedDate: string;
  defaultRevision: string;
  drawingNoRevMode: DrawingNoRevMode;
  getNumberFromFilename: boolean;
  drawingLanguage: string;
};

function UploadDrawingsModal({
  projectId,
  initialFiles,
  onClose,
  onSubmit,
}: {
  projectId: string;
  initialFiles?: File[];
  onClose: () => void;
  onSubmit: (data: UploadDrawingsSubmission) => Promise<void> | void;
}) {
  const NEW_SET_VALUE = "__new__";

  const [sets, setSets] = useState<DrawingSet[]>([]);
  const [setsLoading, setSetsLoading] = useState(true);
  const [files, setFiles] = useState<File[]>(() => initialFiles ?? []);
  const [setId, setSetId] = useState<string>("");
  const [newSetName, setNewSetName] = useState("");
  const [defaultDrawingDate, setDefaultDrawingDate] = useState("");
  const [defaultReceivedDate, setDefaultReceivedDate] = useState("");
  const [defaultRevision, setDefaultRevision] = useState("");
  const [drawingNoRevMode, setDrawingNoRevMode] = useState<DrawingNoRevMode>("none");
  const [getNumberFromFilename, setGetNumberFromFilename] = useState(false);
  const [drawingLanguage, setDrawingLanguage] = useState("en");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/projects/${projectId}/drawings/sets`);
        if (res.ok && !cancelled) {
          const data = await res.json();
          setSets(data.sets ?? []);
        }
      } finally {
        if (!cancelled) setSetsLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [projectId]);

  // Pre-fill defaults from the chosen existing set so the form mirrors
  // how the set was originally created.
  useEffect(() => {
    if (!setId || setId === NEW_SET_VALUE) return;
    const set = sets.find((s) => s.id === setId);
    if (!set) return;
    setDefaultDrawingDate(set.default_drawing_date ?? "");
    setDefaultReceivedDate(set.default_received_date ?? "");
    setDefaultRevision(set.default_revision ?? "");
    if (set.drawing_no_rev_mode) {
      const mode = REV_MODE_OPTIONS.find((m) => m.value === set.drawing_no_rev_mode);
      if (mode) setDrawingNoRevMode(mode.value);
    }
    setGetNumberFromFilename(!!set.get_number_from_filename);
    if (set.drawing_language) setDrawingLanguage(set.drawing_language);
  }, [setId, sets]);

  function addFiles(incoming: FileList | File[]) {
    const next: File[] = [];
    const list = Array.from(incoming);
    for (const f of list) {
      if (!f.name.toLowerCase().endsWith(".pdf")) continue;
      if (files.some((existing) => existing.name === f.name && existing.size === f.size)) continue;
      next.push(f);
    }
    if (next.length === 0) return;
    setFiles((prev) => [...prev, ...next]);
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function handleDropFiles(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  }

  function handleDragOverFiles(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeaveFiles(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
  }

  const isCreatingNewSet = setId === NEW_SET_VALUE;
  const requiredSetReady = isCreatingNewSet
    ? newSetName.trim().length > 0
    : setId.length > 0;
  const canSubmit = files.length > 0 && requiredSetReady && !submitting;

  async function handleProcess() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);

    try {
      let resolvedSetId = setId;
      let resolvedSetName = sets.find((s) => s.id === setId)?.name ?? "";

      if (isCreatingNewSet) {
        const createRes = await fetch(`/api/projects/${projectId}/drawings/sets`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: newSetName.trim(),
            default_drawing_date: defaultDrawingDate || null,
            default_received_date: defaultReceivedDate || null,
            default_revision: defaultRevision || null,
            drawing_no_rev_mode: drawingNoRevMode,
            get_number_from_filename: getNumberFromFilename,
            drawing_language: drawingLanguage,
          }),
        });
        if (!createRes.ok) {
          const errBody = await createRes.json().catch(() => ({}));
          throw new Error(errBody.error ?? "Could not create drawing set");
        }
        const created = await createRes.json();
        resolvedSetId = created.id;
        resolvedSetName = created.name;
      }

      await onSubmit({
        files,
        setId: resolvedSetId,
        setName: resolvedSetName,
        defaultDrawingDate,
        defaultReceivedDate,
        defaultRevision,
        drawingNoRevMode,
        getNumberFromFilename,
        drawingLanguage,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Upload Drawings</h2>
          <div className="flex items-center gap-2">
            <span
              title="Each page becomes a drawing you can tag with sheet number, title, revision, etc."
              className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 text-gray-500 text-xs font-medium cursor-help"
            >
              ?
            </span>
            <button
              onClick={onClose}
              className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Attach files */}
          <div
            onDrop={handleDropFiles}
            onDragOver={handleDragOverFiles}
            onDragLeave={handleDragLeaveFiles}
            className={`rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors ${
              isDragging ? "border-blue-400 bg-blue-50" : "border-gray-200 bg-gray-50"
            }`}
          >
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-1.5 bg-gray-700 text-white text-sm font-medium rounded-md hover:bg-gray-800 transition-colors"
              type="button"
            >
              Attach Files
            </button>
            <p className="text-xs text-gray-500 mt-2">or Drag &amp; Drop</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) addFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </div>

          {files.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {files.map((file, i) => (
                <span
                  key={`${file.name}-${i}`}
                  className="inline-flex items-center gap-1.5 max-w-full pl-3 pr-1.5 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium"
                >
                  <span className="truncate max-w-[260px]" title={file.name}>{file.name}</span>
                  <button
                    onClick={() => removeFile(i)}
                    className="flex items-center justify-center w-5 h-5 rounded-full hover:bg-blue-200 transition-colors"
                    title="Remove file"
                    type="button"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Drawing Set */}
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-1">
              Drawing Set<span className="text-red-500 ml-0.5">*</span>
            </label>
            <p className="text-xs text-gray-500 mb-2">
              Group and label drawings into a collection as they are issued to keep them organized.
            </p>
            <select
              value={setId}
              onChange={(e) => setSetId(e.target.value)}
              disabled={setsLoading}
              className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">{setsLoading ? "Loading…" : "Select or Create set"}</option>
              {sets.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
              <option value={NEW_SET_VALUE}>+ Create new set…</option>
            </select>
            {isCreatingNewSet && (
              <input
                type="text"
                value={newSetName}
                onChange={(e) => setNewSetName(e.target.value)}
                placeholder="New set name"
                className="mt-2 w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            )}
          </div>

          {/* Default dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-1">Default Drawing Date</label>
              <p className="text-xs text-gray-500 mb-2">Enter the date the drawing was authored.</p>
              <input
                type="date"
                value={defaultDrawingDate}
                onChange={(e) => setDefaultDrawingDate(e.target.value)}
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-1">Default Received Date</label>
              <p className="text-xs text-gray-500 mb-2">Enter the date the drawings were received from the design team.</p>
              <input
                type="date"
                value={defaultReceivedDate}
                onChange={(e) => setDefaultReceivedDate(e.target.value)}
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Advanced */}
          <div>
            <button
              type="button"
              onClick={() => setAdvancedOpen((o) => !o)}
              className="flex items-center gap-2 text-sm font-semibold text-gray-800"
            >
              <span
                className={`flex items-center justify-center w-7 h-7 border border-gray-300 rounded-md transition-transform ${advancedOpen ? "rotate-90" : ""}`}
              >
                <svg className="w-3.5 h-3.5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </span>
              Advanced Options
              <span
                title="These settings guide how the AI scans each sheet's title block."
                className="flex items-center justify-center w-5 h-5 rounded-full bg-gray-100 text-gray-500 text-xs font-medium cursor-help"
              >
                ?
              </span>
            </button>

            {advancedOpen && (
              <div className="mt-4 space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-1">Default Revision</label>
                  <p className="text-xs text-gray-500 mb-2">
                    Enter your drawing set&apos;s default revision number or letter, if applicable.
                  </p>
                  <input
                    type="text"
                    value={defaultRevision}
                    onChange={(e) => setDefaultRevision(e.target.value)}
                    className="w-24 border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-1">Drawing No. Contains Rev</label>
                  <p className="text-xs text-gray-500 mb-2">
                    Select the option that applies to your drawing revision number.
                  </p>
                  <select
                    value={drawingNoRevMode}
                    onChange={(e) => setDrawingNoRevMode(e.target.value as DrawingNoRevMode)}
                    className="w-full max-w-xs border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    {REV_MODE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-1">Drawing Number</label>
                  <p className="text-xs text-gray-500 mb-2">
                    Have the AI pull the number and title of an individual drawing based off the filename.
                  </p>
                  <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={getNumberFromFilename}
                      onChange={(e) => setGetNumberFromFilename(e.target.checked)}
                      className="rounded border-gray-300 focus:ring-blue-500"
                    />
                    Get From Filename
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-1">Drawing Language</label>
                  <p className="text-xs text-gray-500 mb-2">Select the language your drawings are in.</p>
                  <select
                    value={drawingLanguage}
                    onChange={(e) => setDrawingLanguage(e.target.value)}
                    className="w-40 border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    {LANGUAGE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-between gap-3">
          <p className="text-xs text-gray-500"><span className="text-red-500">*</span> Required fields</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-md transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleProcess}
              disabled={!canSubmit}
              className={`px-5 py-1.5 text-sm font-medium rounded-md transition-colors ${
                canSubmit
                  ? "bg-blue-600 text-white hover:bg-blue-700"
                  : "bg-rose-200 text-rose-400 cursor-not-allowed"
              }`}
            >
              {submitting ? "Processing…" : "Process"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Review Extracted Metadata Modal ───────────────────────────────────────────

type ReviewRow = {
  drawing_id: string;
  page_number: number;
  filename: string;
  uploaded_at: string;
  storage_path: string;
  viewer_page: number;
  title: string;
  drawing_no: string;
  category: string;
  revision: string;
  drawing_date: string;
  received_date: string;
  confirmed: boolean;
  viewed: boolean;
  saving: boolean;
};

const CATEGORY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "—" },
  { value: "A", label: "A — Architectural" },
  { value: "C", label: "C — Civil" },
  { value: "E", label: "E — Electrical" },
  { value: "M", label: "M — Mechanical" },
  { value: "P", label: "P — Plumbing" },
  { value: "S", label: "S — Structural" },
  { value: "L", label: "L — Landscape" },
  { value: "G", label: "G — General" },
  { value: "T", label: "T — Telecommunications" },
  { value: "FP", label: "FP — Fire Protection" },
];

// A selectable discipline: `value` is what gets stored in
// project_drawings.category (a short code for built-ins, the label itself for
// custom disciplines); `label` is the human-readable name shown to the user.
type DisciplineOption = { value: string; label: string };

// Built-in disciplines, derived from the fixed category codes above.
const BUILTIN_DISCIPLINE_OPTIONS: DisciplineOption[] = CATEGORY_OPTIONS
  .filter((o) => o.value)
  .map((o) => ({ value: o.value, label: DISCIPLINE_LABELS[o.value] ?? o.label }));

// A type-ahead combobox for the Discipline field. The user can type to filter
// existing disciplines and pick one, or type a brand-new name and create it.
function DisciplineCombobox({
  value,
  options,
  onChange,
  onCreate,
  placeholder,
  className,
}: {
  value: string;
  options: DisciplineOption[];
  onChange: (value: string) => void;
  onCreate: (label: string) => Promise<string | null>;
  placeholder?: string;
  className?: string;
}) {
  const resolvedLabel = useMemo(() => {
    const opt = options.find((o) => o.value === value);
    return opt ? opt.label : value;
  }, [options, value]);

  const [text, setText] = useState(resolvedLabel);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Keep the field in sync when the committed value (e.g. switching rows) changes.
  useEffect(() => { setText(resolvedLabel); }, [resolvedLabel]);

  // Close (and revert any uncommitted text) when clicking outside.
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setText(resolvedLabel);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [resolvedLabel]);

  const q = text.trim().toLowerCase();
  const filtered = q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  const exactMatch = options.find((o) => o.label.toLowerCase() === q);
  const showCreate = q.length > 0 && !exactMatch;

  function commit(opt: DisciplineOption) {
    onChange(opt.value);
    setText(opt.label);
    setOpen(false);
  }

  async function handleCreate() {
    const label = text.trim();
    if (!label || creating) return;
    setCreating(true);
    const newValue = await onCreate(label);
    setCreating(false);
    if (newValue !== null) {
      onChange(newValue);
      setText(label);
      setOpen(false);
    }
  }

  return (
    <div ref={wrapRef} className="relative">
      <input
        type="text"
        value={text}
        onChange={(e) => { setText(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (exactMatch) commit(exactMatch);
            else if (showCreate) handleCreate();
          } else if (e.key === "Escape") {
            setOpen(false);
            setText(resolvedLabel);
          }
        }}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
      />
      {open && (filtered.length > 0 || showCreate) && (
        <ul className="absolute z-20 mt-1 w-full max-h-56 overflow-auto bg-white border border-gray-200 rounded-md shadow-lg text-sm">
          {filtered.map((o) => (
            <li key={o.value}>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); commit(o); }}
                className={`w-full text-left px-3 py-1.5 hover:bg-gray-50 ${
                  o.value === value ? "font-semibold text-gray-900" : "text-gray-700"
                }`}
              >
                {o.label}
              </button>
            </li>
          ))}
          {showCreate && (
            <li className={filtered.length > 0 ? "border-t border-gray-100" : ""}>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); handleCreate(); }}
                disabled={creating}
                className="w-full text-left px-3 py-1.5 hover:bg-gray-50 disabled:opacity-50"
                style={{ color: "var(--brand-600)" }}
              >
                {creating ? "Creating…" : `Create "${text.trim()}"`}
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

function ReviewPreviewCanvas({
  storagePath,
  pageNumber,
  rotation,
}: {
  storagePath: string;
  pageNumber: number;
  rotation: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    (async () => {
      try {
        await ensurePdfJs();
        const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        if (!supabaseUrl) throw new Error("Supabase URL missing");
        const url = `${supabaseUrl}/storage/v1/object/public/project-drawings/${storagePath}`;
        const pdf = await getDocument(url).promise;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const page: any = await pdf.getPage(pageNumber);
        const base = page.getViewport({ scale: 1 });
        const target = 2200;
        const scale = Math.min(2, target / Math.max(base.width, base.height));
        const vp = page.getViewport({ scale, rotation });
        if (cancelled) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = vp.width;
        canvas.height = vp.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        await page.render({ canvasContext: ctx, viewport: vp }).promise;
        if (!cancelled) setStatus("ready");
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();
    return () => { cancelled = true; };
  }, [storagePath, pageNumber, rotation]);

  return (
    <div className="flex-1 overflow-auto flex items-center justify-center p-6 relative">
      {status === "loading" && (
        <div className="absolute flex items-center gap-2 text-sm text-gray-500">
          <svg className="w-5 h-5 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
          Rendering page…
        </div>
      )}
      {status === "error" && (
        <div className="text-sm text-gray-500">Could not render this page.</div>
      )}
      <canvas
        ref={canvasRef}
        style={{ maxWidth: "100%", maxHeight: "100%", display: status === "ready" ? "block" : "none" }}
        className="bg-white shadow-lg"
      />
    </div>
  );
}

function ReviewExtractedModal({
  projectId,
  uploadId,
  drawings,
  disciplineOptions,
  onCreateDiscipline,
  onClose,
  onApplied,
  onDeleted,
}: {
  projectId: string;
  uploadId: string;
  drawings: DrawingPage[];
  disciplineOptions: DisciplineOption[];
  onCreateDiscipline: (label: string) => Promise<string | null>;
  onClose: () => void;
  onApplied: (updates: DrawingPage[]) => void;
  onDeleted: (drawingId: string) => void;
}) {
  const [rows, setRows] = useState<ReviewRow[]>(() =>
    drawings.map((d) => {
      const uploadedDate = d.uploaded_at ? d.uploaded_at.slice(0, 10) : "";
      return {
        drawing_id: d.id,
        page_number: d.page_number,
        filename: d.filename,
        uploaded_at: d.uploaded_at,
        storage_path: d.storage_path,
        viewer_page: d.viewer_page,
        title: d.title ?? "",
        drawing_no: d.drawing_no ?? "",
        category: d.category ?? "",
        revision: d.revision || "0",
        drawing_date: d.drawing_date ?? "",
        received_date: d.received_date ?? uploadedDate,
        confirmed: false,
        viewed: false,
        saving: false,
      };
    }),
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [applyingAll, setApplyingAll] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(
    drawings.length > 0 ? drawings[0].id : null,
  );
  const [rotation, setRotation] = useState(0);

  // Reset rotation when selection changes
  useEffect(() => { setRotation(0); }, [selectedId]);

  // Mark the selected row as viewed (once per row)
  useEffect(() => {
    if (!selectedId) return;
    setRows((prev) => {
      if (!prev.some((r) => r.drawing_id === selectedId && !r.viewed)) return prev;
      return prev.map((r) => (r.drawing_id === selectedId && !r.viewed ? { ...r, viewed: true } : r));
    });
  }, [selectedId]);

  // Run AI extraction once on mount
  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/projects/${projectId}/drawings/uploads/${uploadId}/extract-metadata`,
          { method: "POST" },
        );
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error ?? "Extraction failed");
        }
        const data = await res.json();
        if (cancelled) return;
        type ExtractedField = { title: string; sheet_number: string; category: string; revision: string; date: string };
        const byId = new Map<string, ExtractedField>();
        for (const r of (data.results ?? []) as Array<{
          drawing_id: string; title: string; sheet_number: string; category: string; revision: string; date: string;
        }>) {
          byId.set(r.drawing_id, {
            title: r.title ?? "",
            sheet_number: r.sheet_number ?? "",
            category: (r.category ?? "").toUpperCase(),
            revision: r.revision ?? "",
            date: r.date ?? "",
          });
        }
        setRows((prev) =>
          prev.map((row) => {
            const m = byId.get(row.drawing_id);
            if (!m) return row;
            return {
              ...row,
              title: m.title || row.title,
              drawing_no: m.sheet_number || row.drawing_no,
              category: m.category || row.category,
              revision: m.revision || row.revision || "0",
              drawing_date: m.date || row.drawing_date,
            };
          }),
        );
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Extraction failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => { cancelled = true; };
  }, [projectId, uploadId]);

  const selected = rows.find((r) => r.drawing_id === selectedId) ?? null;
  const confirmedCount = rows.filter((r) => r.confirmed).length;
  const allConfirmed = rows.length > 0 && confirmedCount === rows.length;

  function updateSelected(patch: Partial<ReviewRow>) {
    if (!selectedId) return;
    setRows((prev) =>
      prev.map((r) => (r.drawing_id === selectedId ? { ...r, ...patch } : r)),
    );
  }

  function isValid(r: ReviewRow) {
    return !!r.drawing_no.trim() && !!r.category;
  }

  async function applyRow(row: ReviewRow): Promise<DrawingPage | null> {
    setRows((prev) =>
      prev.map((r) => (r.drawing_id === row.drawing_id ? { ...r, saving: true } : r)),
    );
    try {
      const res = await fetch(
        `/api/projects/${projectId}/drawings/${row.drawing_id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            drawing_no: row.drawing_no.trim() || null,
            title: row.title.trim() || null,
            revision: row.revision.trim() || "0",
            drawing_date: row.drawing_date || null,
            received_date: row.received_date || null,
            category: row.category || null,
          }),
        },
      );
      if (!res.ok) throw new Error("Save failed");
      const updated = (await res.json()) as DrawingPage;
      setRows((prev) =>
        prev.map((r) => (r.drawing_id === row.drawing_id ? { ...r, confirmed: true, saving: false } : r)),
      );
      return updated;
    } catch {
      setRows((prev) =>
        prev.map((r) => (r.drawing_id === row.drawing_id ? { ...r, saving: false } : r)),
      );
      return null;
    }
  }

  async function handleConfirm() {
    if (!selected || !isValid(selected) || selected.confirmed) return;
    const updated = await applyRow(selected);
    if (updated) {
      onApplied([updated]);
      // Advance to the next unconfirmed row (wrap to start if needed)
      const idx = rows.findIndex((r) => r.drawing_id === selected.drawing_id);
      const next =
        rows.slice(idx + 1).find((r) => !r.confirmed) ??
        rows.slice(0, idx).find((r) => !r.confirmed);
      if (next) setSelectedId(next.drawing_id);
    }
  }

  async function handleConfirmAll() {
    setApplyingAll(true);
    const applied: DrawingPage[] = [];
    const invalidIds: string[] = [];
    const failedIds: string[] = [];
    for (const row of rows) {
      if (row.confirmed) continue;
      if (!isValid(row)) { invalidIds.push(row.drawing_id); continue; }
      const updated = await applyRow(row);
      if (updated) applied.push(updated);
      else failedIds.push(row.drawing_id);
    }
    if (applied.length > 0) onApplied(applied);
    setApplyingAll(false);
    if (invalidIds.length === 0 && failedIds.length === 0) {
      onClose();
    } else {
      setSelectedId(invalidIds[0] ?? failedIds[0] ?? selectedId);
    }
  }

  async function handleDelete() {
    if (!selected) return;
    const label = selected.drawing_no.trim() || `page ${selected.page_number}`;
    if (!window.confirm(`Delete ${label}? This cannot be undone.`)) return;
    const res = await fetch(`/api/projects/${projectId}/drawings/${selected.drawing_id}`, { method: "DELETE" });
    if (!res.ok) return;
    const deletedId = selected.drawing_id;
    const idx = rows.findIndex((r) => r.drawing_id === deletedId);
    const remaining = rows.filter((r) => r.drawing_id !== deletedId);
    setRows(remaining);
    onDeleted(deletedId);
    if (remaining.length === 0) {
      onClose();
    } else {
      const next = remaining[Math.min(idx, remaining.length - 1)];
      setSelectedId(next.drawing_id);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex bg-white">
      {/* Left panel: drawing list */}
      <aside className="w-72 shrink-0 border-r border-black/[0.06] flex flex-col bg-white">
        <div className="px-4 py-3 border-b border-black/[0.06] flex items-center justify-between gap-2">
          <span className="text-xs font-semibold" style={{ color: "var(--brand-600)" }}>
            {confirmedCount} of {rows.length} confirmed
          </span>
          <button
            onClick={handleConfirmAll}
            disabled={applyingAll || loading || allConfirmed || rows.length === 0}
            className="text-xs font-semibold text-gray-700 hover:text-gray-900 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {applyingAll ? "Confirming…" : "Confirm All"}
          </button>
        </div>
        <ul className="flex-1 overflow-y-auto">
          {rows.map((row) => {
            const isSelected = row.drawing_id === selectedId;
            const numLabel = row.drawing_no.trim() || `Page ${row.page_number}`;
            const titleLabel = row.title.trim() || "—";
            return (
              <li key={row.drawing_id}>
                <button
                  onClick={() => setSelectedId(row.drawing_id)}
                  className={`w-full text-left px-4 py-3 border-b border-black/[0.04] flex items-start justify-between gap-2 transition-colors ${
                    isSelected ? "bg-[#FBF0E6]" : "bg-white hover:bg-gray-50"
                  }`}
                  style={
                    isSelected
                      ? { borderLeft: "3px solid var(--brand-500)", paddingLeft: "13px" }
                      : undefined
                  }
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-gray-900 truncate">{numLabel}</div>
                    <div className="text-[11px] uppercase tracking-wide text-gray-500 truncate mt-0.5">
                      {titleLabel}
                    </div>
                  </div>
                  <div className="shrink-0 pt-0.5">
                    {row.confirmed ? (
                      <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : row.viewed ? (
                      <span className="text-[10px] uppercase tracking-wide text-gray-400">Viewed</span>
                    ) : null}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      {/* Center panel: PDF preview */}
      <section className="flex-1 min-w-0 flex flex-col bg-gray-100 relative">
        {selected ? (
          <>
            <ReviewPreviewCanvas
              key={selected.drawing_id}
              storagePath={selected.storage_path}
              pageNumber={selected.viewer_page > 0 ? selected.viewer_page : selected.page_number}
              rotation={rotation}
            />
            <div className="absolute bottom-4 left-4">
              <button
                onClick={() => setRotation((r) => (r + 90) % 360)}
                className="btn-secondary"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v6h6M20 20v-6h-6M5 10a8 8 0 0114-3M19 14a8 8 0 01-14 3" />
                </svg>
                Rotate Drawing
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-sm text-gray-500">
            Select a drawing on the left to start.
          </div>
        )}
      </section>

      {/* Right panel: General information */}
      <aside className="w-[440px] shrink-0 border-l border-black/[0.06] flex flex-col bg-white">
        <div className="px-5 py-4 border-b border-black/[0.06] flex items-start justify-between gap-2">
          <h2 className="text-base font-semibold text-gray-900">General information</h2>
          <button
            onClick={onClose}
            className="p-1 -mt-0.5 -mr-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            aria-label="Close"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {loading && (
          <div className="px-5 py-2 text-xs text-gray-500 border-b border-black/[0.04] flex items-center gap-2">
            <svg className="w-3.5 h-3.5 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            Reading the title block on each page…
          </div>
        )}
        {error && !loading && (
          <div className="px-5 py-2 text-xs bg-amber-50 border-b border-amber-100 text-amber-800">
            {error}. You can still edit fields manually and confirm.
          </div>
        )}

        {selected ? (
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Drawing Number<span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                value={selected.drawing_no}
                onChange={(e) => updateSelected({ drawing_no: e.target.value })}
                placeholder="A-101"
                className="w-full text-sm border border-gray-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-500)]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Discipline<span className="text-rose-600">*</span>
              </label>
              <DisciplineCombobox
                value={selected.category}
                options={disciplineOptions}
                onChange={(v) => updateSelected({ category: v })}
                onCreate={onCreateDiscipline}
                placeholder="Select or type a discipline…"
                className="w-full text-sm border border-gray-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-500)] bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Drawing Title</label>
              <input
                type="text"
                value={selected.title}
                onChange={(e) => updateSelected({ title: e.target.value })}
                placeholder="Floor Plan"
                className="w-full text-sm border border-gray-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-500)]"
              />
            </div>

            <div className="pt-2">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Versions</h3>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 text-[10px] font-medium text-gray-500 uppercase tracking-wide">
                    <tr>
                      <th className="px-2 py-1.5 text-left">Revision<span className="text-rose-600">*</span></th>
                      <th className="px-2 py-1.5 text-left">Drawing Date</th>
                      <th className="px-2 py-1.5 text-left">Received Date</th>
                      <th className="px-2 py-1.5 text-left">Drawing Set</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="px-2 py-1.5 align-middle">
                        <input
                          type="text"
                          value={selected.revision}
                          onChange={(e) => updateSelected({ revision: e.target.value })}
                          className="w-full border border-gray-200 rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-500)]"
                        />
                      </td>
                      <td className="px-2 py-1.5 align-middle">
                        <input
                          type="date"
                          value={selected.drawing_date}
                          onChange={(e) => updateSelected({ drawing_date: e.target.value })}
                          className="w-full border border-gray-200 rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-500)]"
                        />
                      </td>
                      <td className="px-2 py-1.5 align-middle">
                        <input
                          type="date"
                          value={selected.received_date}
                          onChange={(e) => updateSelected({ received_date: e.target.value })}
                          className="w-full border border-gray-200 rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-500)]"
                        />
                      </td>
                      <td
                        className="px-2 py-1.5 align-middle text-gray-700 truncate max-w-[100px]"
                        title={selected.filename}
                      >
                        {selected.filename}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <p className="text-[11px] italic text-rose-600 pt-1">* Required fields</p>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-sm text-gray-500 px-4">
            No drawing selected.
          </div>
        )}

        <div className="px-5 py-3 border-t border-black/[0.06] flex items-center justify-end gap-2">
          <button
            onClick={handleDelete}
            disabled={!selected || !!selected?.saving || applyingAll}
            className="px-4 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Delete
          </button>
          <button
            onClick={handleConfirm}
            disabled={
              !selected ||
              !isValid(selected) ||
              selected.saving ||
              applyingAll ||
              selected.confirmed
            }
            className="px-4 py-1.5 text-sm font-semibold text-white rounded-md disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            style={{ backgroundColor: "var(--brand-500)" }}
          >
            {selected?.saving
              ? "Saving…"
              : selected?.confirmed
              ? "Confirmed"
              : "Confirm"}
          </button>
        </div>
      </aside>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function DrawingsClient({
  projectId,
  role,
  username,
  userId,
}: {
  projectId: string;
  role: string;
  username: string;
  userId: string;
}) {
  const [drawings, setDrawings] = useState<DrawingPage[]>([]);
  const [uploads, setUploads] = useState<DrawingUpload[]>([]);
  const [selected, setSelected] = useState<DrawingPage | null>(null);
  const [viewingDrawing, setViewingDrawing] = useState<DrawingPage | null>(null);
  const [activeView, setActiveView] = useState<"grid" | "table">("table");
  const [activeTab, setActiveTab] = useState<"current" | "sets" | "recycle">("current");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [disciplineFilter, setDisciplineFilter] = useState("");
  const [setFilter, setSetFilter] = useState("");
  const [customDisciplines, setCustomDisciplines] = useState<{ label: string }[]>([]);
  const [sets, setSets] = useState<DrawingSet[]>([]);
  const [viewingSetId, setViewingSetId] = useState<string | null>(null);
  const [setsSearch, setSetsSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewerSearch, setViewerSearch] = useState<{ query: string; results: SearchResult[] } | null>(null);
  const [viewerSearchPanelOpen, setViewerSearchPanelOpen] = useState(false);
  const [searchIndexBuilding, setSearchIndexBuilding] = useState(false);
  const pageTextIndex = useRef<Map<string, string>>(new Map());
  const [showUploadsPanel, setShowUploadsPanel] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Edit panel fields
  const [editNo, setEditNo] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editRevision, setEditRevision] = useState("");
  const [editDrawingDate, setEditDrawingDate] = useState("");
  const [editReceivedDate, setEditReceivedDate] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [extracting, setExtracting] = useState(false);

  // Review modal state — opens after upload so user can approve auto-extracted metadata
  const [reviewModal, setReviewModal] = useState<{ uploadId: string; drawings: DrawingPage[] } | null>(null);

  // Upload Drawings modal — the new Procore-style entry point for uploading.
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [prefillFiles, setPrefillFiles] = useState<File[]>([]);

  // Thumbnail cache: drawingId → dataUrl
  const thumbnails = useRef<Map<string, string>>(new Map());
  const [thumbVersion, setThumbVersion] = useState(0); // force re-render when thumb ready

  const [showReportsMenu, setShowReportsMenu] = useState(false);

  const uploadsPanelRef = useRef<HTMLDivElement>(null);
  const reportsMenuRef = useRef<HTMLDivElement>(null);

  // ── Fetch ────────────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [res, setsRes] = await Promise.all([
      fetch(`/api/projects/${projectId}/drawings`),
      fetch(`/api/projects/${projectId}/drawings/sets`),
    ]);
    if (res.ok) {
      const data = await res.json();
      setDrawings(data.drawings ?? []);
      setUploads(data.uploads ?? []);
    }
    if (setsRes.ok) {
      const setsData = await setsRes.json();
      setSets(setsData.sets ?? []);
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Disciplines ────────────────────────────────────────────────────────────
  const fetchDisciplines = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/drawings/disciplines`);
    if (res.ok) {
      const data = await res.json();
      setCustomDisciplines((data.disciplines ?? []).map((d: { label: string }) => ({ label: d.label })));
    }
  }, [projectId]);

  useEffect(() => { fetchDisciplines(); }, [fetchDisciplines]);

  // Built-in disciplines plus any custom ones the user created (deduped by label).
  const disciplineOptions = useMemo<DisciplineOption[]>(() => {
    const seen = new Set(BUILTIN_DISCIPLINE_OPTIONS.map((o) => o.label.toLowerCase()));
    const custom = customDisciplines
      .filter((d) => d.label && !seen.has(d.label.toLowerCase()))
      .map((d) => ({ value: d.label, label: d.label }));
    return [...BUILTIN_DISCIPLINE_OPTIONS, ...custom];
  }, [customDisciplines]);

  // Create a new custom discipline. Returns the value to store in `category`
  // (the label for customs) or the matched built-in code, or null on failure.
  const createDiscipline = useCallback(async (label: string): Promise<string | null> => {
    const trimmed = label.trim();
    if (!trimmed) return null;
    // If the typed text matches a built-in label, reuse its code instead.
    const builtin = BUILTIN_DISCIPLINE_OPTIONS.find((o) => o.label.toLowerCase() === trimmed.toLowerCase());
    if (builtin) return builtin.value;
    try {
      const res = await fetch(`/api/projects/${projectId}/drawings/disciplines`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: trimmed }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      const newLabel: string = data.discipline?.label ?? trimmed;
      setCustomDisciplines((prev) =>
        prev.some((d) => d.label.toLowerCase() === newLabel.toLowerCase())
          ? prev
          : [...prev, { label: newLabel }],
      );
      return newLabel;
    } catch {
      return null;
    }
  }, [projectId]);

  // ── Drawing Sets ───────────────────────────────────────────────────────────
  // upload_id → set_id, so each drawing page can be traced back to its set.
  const uploadSetMap = useMemo(() => {
    const m = new Map<string, string | null>();
    for (const u of uploads) m.set(u.id, u.set_id ?? null);
    return m;
  }, [uploads]);

  const viewingSet = useMemo(
    () => (viewingSetId ? sets.find((s) => s.id === viewingSetId) ?? null : null),
    [sets, viewingSetId],
  );

  // Each set with its page counts. A page counts as "Published" once it has a
  // drawing number (i.e. it's been identified / reviewed); the rest are
  // "Unpublished" drafts still awaiting a sheet number.
  const setsWithCounts = useMemo(() => {
    return sets
      .map((s) => {
        const pages = drawings.filter((d) => uploadSetMap.get(d.upload_id) === s.id);
        const published = pages.filter((d) => (d.drawing_no ?? "").trim()).length;
        return {
          set: s,
          date: s.default_drawing_date || (s.created_at ? s.created_at.slice(0, 10) : ""),
          total: pages.length,
          published,
          unpublished: pages.length - published,
        };
      })
      .filter((row) => {
        const q = setsSearch.trim().toLowerCase();
        return !q || row.set.name.toLowerCase().includes(q);
      })
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  }, [sets, drawings, uploadSetMap, setsSearch]);

  // Sync edit panel when selection changes
  useEffect(() => {
    if (selected) {
      setEditNo(selected.drawing_no ?? "");
      setEditTitle(selected.title ?? "");
      setEditRevision(selected.revision ?? "");
      setEditDrawingDate(selected.drawing_date ?? "");
      setEditReceivedDate(selected.received_date ?? "");
      setEditCategory(selected.category ?? "");
      setDeleteConfirm(false);
    }
  }, [selected]);

  // Dismiss uploads panel on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (uploadsPanelRef.current && !uploadsPanelRef.current.contains(e.target as Node)) {
        setShowUploadsPanel(false);
      }
      if (reportsMenuRef.current && !reportsMenuRef.current.contains(e.target as Node)) {
        setShowReportsMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // ── Thumbnail rendering ──────────────────────────────────────────────────────

  useEffect(() => {
    if (drawings.length === 0) return;

    async function renderAll() {
      await ensurePdfJs();
      const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (!supabaseUrl) return;

      // Group pages by storage_path so we load each PDF document only once
      const byPath = new Map<string, DrawingPage[]>();
      for (const d of drawings) {
        if (thumbnails.current.has(d.id)) continue;
        const group = byPath.get(d.storage_path) ?? [];
        group.push(d);
        byPath.set(d.storage_path, group);
      }

      for (const [storagePath, pages] of byPath) {
        const url = `${supabaseUrl}/storage/v1/object/public/project-drawings/${storagePath}`;
        try {
          const pdf = await getDocument(url).promise;
          for (const d of pages) {
            try {
              // Per-page extracted PDFs are single-page (viewer_page === 1);
              // legacy rows share a multi-page PDF and need their real page_number.
              const pageInDoc = d.viewer_page > 0 ? d.viewer_page : d.page_number;
              const dataUrl = await renderPageFromDoc(pdf, pageInDoc);
              thumbnails.current.set(d.id, dataUrl);
              setThumbVersion((v) => v + 1);
            } catch (pageErr) {
              console.warn(`Failed to render page ${d.page_number}:`, pageErr);
            }
          }
        } catch (docErr) {
          console.error(`Failed to load PDF for rendering (${storagePath}):`, docErr);
        }
      }
    }

    renderAll();
  }, [drawings]);

  // ── Upload ───────────────────────────────────────────────────────────────────

  type HandleUploadOptions = {
    setId?: string;
    defaultDrawingDate?: string;
    defaultReceivedDate?: string;
    defaultRevision?: string;
    drawingNoRevMode?: DrawingNoRevMode;
    getNumberFromFilename?: boolean;
    drawingLanguage?: string;
  };

  async function handleUpload(file: File, opts: HandleUploadOptions = {}): Promise<DrawingUpload | null> {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      alert("Only PDF files are accepted.");
      return null;
    }

    setUploading(true);
    try {
      // Step 1: get a signed upload URL (no file data sent to Vercel)
      setUploadStatus("Preparing…");
      const urlRes = await fetch(
        `/api/projects/${projectId}/drawings/upload-url?filename=${encodeURIComponent(file.name)}`
      );
      if (!urlRes.ok) {
        const err = await urlRes.json().catch(() => ({}));
        throw new Error(err.error ?? "Could not get upload URL");
      }
      const { signedUrl, storagePath } = await urlRes.json();

      // Step 2: upload directly to Supabase Storage (bypasses Vercel's 4.5 MB limit)
      setUploadStatus("Uploading…");
      const putRes = await fetch(signedUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": "application/pdf" },
      });
      if (!putRes.ok) throw new Error(`Storage upload failed (${putRes.status})`);

      // Step 3: tell the API to split the pages and create drawing rows
      setUploadStatus("Processing pages…");
      const processRes = await fetch(`/api/projects/${projectId}/drawings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storagePath,
          filename: file.name,
          setId: opts.setId ?? null,
          defaultDrawingDate: opts.defaultDrawingDate ?? null,
          defaultReceivedDate: opts.defaultReceivedDate ?? null,
          defaultRevision: opts.defaultRevision ?? null,
          drawingNoRevMode: opts.drawingNoRevMode ?? "none",
          getNumberFromFilename: opts.getNumberFromFilename ?? false,
          drawingLanguage: opts.drawingLanguage ?? "en",
        }),
      });

      if (!processRes.ok) {
        const err = await processRes.json().catch(() => ({}));
        throw new Error(err.error ?? "Processing failed");
      }

      const data = await processRes.json();
      const pageCount: number = (data.drawings ?? []).length;
      setUploadStatus(`Added ${pageCount} page${pageCount !== 1 ? "s" : ""}`);
      setTimeout(() => setUploadStatus(""), 3000);
      const newDrawings = (data.drawings ?? []) as DrawingPage[];
      setDrawings((prev) => [...newDrawings, ...prev]);
      setUploads((prev) => [data.upload, ...prev]);
      if (data.upload?.id && newDrawings.length > 0) {
        setReviewModal({ uploadId: data.upload.id as string, drawings: newDrawings });
      }
      return data.upload as DrawingUpload;
    } catch (err) {
      alert(err instanceof Error ? err.message : "Upload failed");
      setUploadStatus("");
      return null;
    } finally {
      setUploading(false);
    }
  }

  async function handleUploadModalSubmit(data: UploadDrawingsSubmission) {
    setShowUploadModal(false);
    for (const file of data.files) {
      await handleUpload(file, {
        setId: data.setId,
        defaultDrawingDate: data.defaultDrawingDate,
        defaultReceivedDate: data.defaultReceivedDate,
        defaultRevision: data.defaultRevision,
        drawingNoRevMode: data.drawingNoRevMode,
        getNumberFromFilename: data.getNumberFromFilename,
        drawingLanguage: data.drawingLanguage,
      });
    }
    // Refresh the sets list so a newly created set shows up in the Drawing Sets tab.
    const setsRes = await fetch(`/api/projects/${projectId}/drawings/sets`);
    if (setsRes.ok) {
      const setsData = await setsRes.json();
      setSets(setsData.sets ?? []);
    }
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    // Drag-and-drop onto the page surfaces the Upload Drawings modal
    // with the dropped file(s) attached, so the user still picks a set
    // and reviews defaults before processing.
    const dropped = Array.from(e.dataTransfer.files ?? []).filter((f) => f.name.toLowerCase().endsWith(".pdf"));
    if (dropped.length === 0) return;
    setPrefillFiles(dropped);
    setShowUploadModal(true);
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave() {
    setIsDragging(false);
  }

  // ── Save metadata ────────────────────────────────────────────────────────────

  async function saveDetail() {
    if (!selected) return;
    setSaving(true);
    const res = await fetch(`/api/projects/${projectId}/drawings/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        drawing_no: editNo || null,
        title: editTitle || null,
        revision: editRevision || null,
        drawing_date: editDrawingDate || null,
        received_date: editReceivedDate || null,
        category: editCategory || null,
      }),
    });
    if (res.ok) {
      const updated = await res.json();
      const merged = { ...selected, ...updated };
      setDrawings((prev) => prev.map((d) => d.id === merged.id ? merged : d));
      setSelected(merged);
    }
    setSaving(false);
  }

  // ── Auto-fill from PDF text layer ────────────────────────────────────────────

  async function autoFill() {
    if (!selected) return;
    setExtracting(true);
    try {
      const meta = await extractMetaFromPage(selected.storage_path, selected.page_number);
      if (meta.drawing_no) setEditNo(meta.drawing_no);
      if (meta.title) setEditTitle(meta.title);
      if (meta.revision) setEditRevision(meta.revision);
      if (meta.drawing_date) setEditDrawingDate(meta.drawing_date);
    } catch {
      // silently fail — user can fill manually
    }
    setExtracting(false);
  }

  // ── Delete drawing ───────────────────────────────────────────────────────────

  async function deleteDrawing() {
    if (!selected) return;
    await fetch(`/api/projects/${projectId}/drawings/${selected.id}`, { method: "DELETE" });
    setDrawings((prev) => prev.filter((d) => d.id !== selected.id));
    thumbnails.current.delete(selected.id);
    // If no drawings remain for that upload, remove it from uploads list
    const remaining = drawings.filter((d) => d.id !== selected.id && d.upload_id === selected.upload_id);
    if (remaining.length === 0) {
      setUploads((prev) => prev.filter((u) => u.id !== selected.upload_id));
    }
    setSelected(null);
  }

  // ── Delete upload ────────────────────────────────────────────────────────────

  async function deleteUpload(uploadId: string) {
    const res = await fetch(`/api/projects/${projectId}/drawings/uploads/${uploadId}`, { method: "DELETE" });
    if (res.ok) {
      // Remove all drawings for this upload and the upload itself
      const removedIds = drawings.filter((d) => d.upload_id === uploadId).map((d) => d.id);
      removedIds.forEach((id) => thumbnails.current.delete(id));
      setDrawings((prev) => prev.filter((d) => d.upload_id !== uploadId));
      setUploads((prev) => prev.filter((u) => u.id !== uploadId));
      if (selected?.upload_id === uploadId) setSelected(null);
    }
  }

  // ── Logout ───────────────────────────────────────────────────────────────────

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }

  // ── PDF full-text search ─────────────────────────────────────────────────────

  // Builds (lazily, on first search) a map of drawingId → lowercased page text
  // by extracting the text layer of every drawing PDF with pdfjs.
  const ensureSearchIndex = useCallback(async () => {
    await ensurePdfJs();
    const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) return;

    // Group not-yet-indexed pages by PDF so each document loads only once
    const byPath = new Map<string, DrawingPage[]>();
    for (const d of drawings) {
      if (pageTextIndex.current.has(d.id)) continue;
      const group = byPath.get(d.storage_path) ?? [];
      group.push(d);
      byPath.set(d.storage_path, group);
    }

    for (const [storagePath, pages] of byPath) {
      const url = `${supabaseUrl}/storage/v1/object/public/project-drawings/${storagePath}`;
      try {
        const pdf = await getDocument(url).promise;
        for (const d of pages) {
          try {
            const pageInDoc = d.viewer_page > 0 ? d.viewer_page : d.page_number;
            const page = await pdf.getPage(pageInDoc);
            const tc = await page.getTextContent();
            const text = tc.items
              .map((it) => ("str" in it && typeof it.str === "string" ? it.str : ""))
              .join(" ");
            pageTextIndex.current.set(d.id, text.toLowerCase());
          } catch {
            pageTextIndex.current.set(d.id, "");
          }
        }
      } catch {
        for (const d of pages) pageTextIndex.current.set(d.id, "");
      }
    }
  }, [drawings]);

  const runPdfSearch = useCallback(async (rawQuery: string) => {
    const query = rawQuery.trim();
    if (!query) return;
    setSearchIndexBuilding(true);
    try {
      await ensureSearchIndex();
    } finally {
      setSearchIndexBuilding(false);
    }
    const q = query.toLowerCase();
    const results: SearchResult[] = [];
    for (const d of drawings) {
      const text = pageTextIndex.current.get(d.id);
      if (!text) continue;
      const matchCount = countOccurrences(text, q);
      if (matchCount > 0) results.push({ drawing: d, matchCount });
    }
    setViewerSearch({ query, results });
    setViewerSearchPanelOpen(true);
    if (results.length > 0) {
      setViewingDrawing(results[0].drawing);
    } else if (!viewingDrawing) {
      // Nothing open and nothing matched — surface a lightweight notice
      alert(`No drawings contain “${query}”.`);
      setViewerSearch(null);
      setViewerSearchPanelOpen(false);
    }
  }, [drawings, ensureSearchIndex, viewingDrawing]);

  // ── Filter ───────────────────────────────────────────────────────────────────

  const filteredDrawings = drawings.filter((d) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (
        !(d.drawing_no ?? "").toLowerCase().includes(q) &&
        !(d.title ?? "").toLowerCase().includes(q) &&
        !(d.revision ?? "").toLowerCase().includes(q) &&
        !d.filename.toLowerCase().includes(q)
      ) return false;
    }
    if (disciplineFilter && inferDiscipline(d.drawing_no, d.category) !== disciplineFilter) return false;
    if (setFilter && d.upload_id !== setFilter) return false;
    if (viewingSetId && uploadSetMap.get(d.upload_id) !== viewingSetId) return false;
    return true;
  });

  const disciplineGroups = useMemo(() => {
    const map = new Map<string, DrawingPage[]>();
    for (const d of filteredDrawings) {
      const disc = inferDiscipline(d.drawing_no, d.category);
      const group = map.get(disc) ?? [];
      group.push(d);
      map.set(disc, group);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([discipline, drawings]) => ({ discipline, drawings }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawings, searchQuery, disciplineFilter, setFilter, viewingSetId, uploadSetMap]);

  // ── Thumbnail helper ─────────────────────────────────────────────────────────

  function Thumb({ drawing, size = "full" }: { drawing: DrawingPage; size?: "full" | "panel" }) {
    // thumbVersion dependency ensures re-render when thumbnail arrives
    void thumbVersion;
    const dataUrl = thumbnails.current.get(drawing.id);
    const cls = size === "panel"
      ? "w-full aspect-[3/4] object-contain bg-gray-100 rounded-lg"
      : "w-full h-full object-contain";

    if (dataUrl) {
      // eslint-disable-next-line @next/next/no-img-element
      return <img src={dataUrl} alt={drawingLabel(drawing)} className={cls} />;
    }
    return (
      <div className={`flex items-center justify-center text-gray-300 bg-gray-100 ${size === "panel" ? "w-full aspect-[3/4] rounded-lg" : "w-full h-full"}`}>
        <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>
    );
  }

  // ── Empty state drop-zone ────────────────────────────────────────────────────

  if (!loading && drawings.length === 0) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex flex-col">
        <header className="bg-[#F9FAFB] border-b border-black/[0.06] px-6 h-14 flex items-center justify-between shrink-0">
          <a href="/dashboard" className="text-sm font-semibold text-gray-900 hover:text-gray-600 transition-colors">
            SiteCommand
          </a>
          <div className="flex items-center gap-5">
            <span className="text-sm text-gray-400">{username}</span>
            <button onClick={handleLogout} className="text-sm text-gray-400 hover:text-gray-900 transition-colors">Logout</button>
          </div>
        </header>
        <ProjectNav projectId={projectId} />
        <div
          className={`flex-1 flex items-center justify-center ${isDragging ? "bg-blue-50" : ""}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <div
            className={`border-2 border-dashed rounded-2xl p-12 text-center max-w-md w-full transition-colors ${isDragging ? "border-blue-400 bg-blue-50" : "border-gray-300 bg-white"}`}
          >
            <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-base font-semibold text-gray-700 mb-1">Upload Drawings</p>
            <p className="text-sm text-gray-400 mb-6">Each page becomes a drawing you can tag with No., Title, Rev…</p>
            {uploading ? (
              <div className="flex items-center justify-center gap-2 text-sm text-blue-600">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                {uploadStatus}
              </div>
            ) : (
              <button
                onClick={() => { setPrefillFiles([]); setShowUploadModal(true); }}
                className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                Upload Drawings
              </button>
            )}
          </div>
        </div>
        {showUploadModal && (
          <UploadDrawingsModal
            projectId={projectId}
            initialFiles={prefillFiles}
            onClose={() => { setShowUploadModal(false); setPrefillFiles([]); }}
            onSubmit={handleUploadModalSubmit}
          />
        )}
      </div>
    );
  }

  // ── Main layout ──────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col">
      {/* Review extracted metadata after upload */}
      {reviewModal && (
        <ReviewExtractedModal
          projectId={projectId}
          uploadId={reviewModal.uploadId}
          drawings={reviewModal.drawings}
          disciplineOptions={disciplineOptions}
          onCreateDiscipline={createDiscipline}
          onClose={() => setReviewModal(null)}
          onApplied={(updates) => {
            setDrawings((prev) => {
              const byId = new Map(updates.map((u) => [u.id, u]));
              return prev.map((d) => {
                const u = byId.get(d.id);
                return u ? { ...d, ...u } : d;
              });
            });
          }}
          onDeleted={(drawingId) => {
            const uploadId = reviewModal.uploadId;
            setDrawings((prev) => {
              const remaining = prev.filter((d) => d.id !== drawingId);
              const stillInUpload = remaining.some((d) => d.upload_id === uploadId);
              if (!stillInUpload) {
                setUploads((prevUploads) => prevUploads.filter((u) => u.id !== uploadId));
              }
              return remaining;
            });
            thumbnails.current.delete(drawingId);
            if (selected?.id === drawingId) setSelected(null);
          }}
        />
      )}

      {/* PDF Viewer Modal */}
      {viewingDrawing && (
        <DrawingPdfViewerModal
          key={viewingDrawing.id}
          drawing={viewingDrawing}
          allDrawings={
            viewerSearch && viewerSearch.results.length > 0
              ? viewerSearch.results.map((r) => r.drawing)
              : filteredDrawings
          }
          onClose={() => {
            setViewingDrawing(null);
            setViewerSearch(null);
            setViewerSearchPanelOpen(false);
          }}
          onNavigate={setViewingDrawing}
          onEditDetails={() => {
            setSelected(viewingDrawing);
            setViewingDrawing(null);
            setViewerSearch(null);
            setViewerSearchPanelOpen(false);
          }}
          projectId={projectId}
          userRole={role}
          userName={username}
          userId={userId}
          search={{
            query: viewerSearch?.query ?? "",
            results: viewerSearch?.results ?? [],
            building: searchIndexBuilding,
            panelOpen: viewerSearchPanelOpen,
            onTogglePanel: () => setViewerSearchPanelOpen((o) => !o),
            onRun: runPdfSearch,
            thumbnails: thumbnails.current,
            thumbVersion,
          }}
        />
      )}

      {/* Global header */}
      <header className="bg-[#F9FAFB] border-b border-black/[0.06] px-6 h-14 flex items-center justify-between shrink-0">
        <a href="/dashboard" className="text-sm font-semibold text-gray-900 hover:text-gray-600 transition-colors">
          SiteCommand
        </a>
        <div className="flex items-center gap-2">
          <div className="w-px h-5 bg-gray-200 mx-1" />
          <span className="text-sm text-gray-400">{username}</span>
          <button onClick={handleLogout} className="text-sm text-gray-400 hover:text-gray-900 transition-colors">Logout</button>
        </div>
      </header>
      {showUploadModal && (
        <UploadDrawingsModal
          projectId={projectId}
          initialFiles={prefillFiles}
          onClose={() => { setShowUploadModal(false); setPrefillFiles([]); }}
          onSubmit={handleUploadModalSubmit}
        />
      )}

      <ProjectNav projectId={projectId} />

      {/* Page title */}
      <div className="bg-white border-b border-black/[0.06] px-6 pt-7 pb-5 shrink-0">
        <div className="sec-row">
          <div className="min-w-0">
            <h1 className="h2-warm">Drawings</h1>
            {drawings.length > 0 ? (
              <p className="sub mt-1.5">
                <em>Across this project</em>
                <span className="sep">·</span>
                <span className="num" style={{ color: "var(--brand-500)" }}>{drawings.length}</span> sheets
                <span className="sep">·</span>
                <span className="num">{disciplineGroups.length}</span> disciplines
                <span className="sep">·</span>
                <span className="num">{uploads.length}</span> sets
              </p>
            ) : (
              <p className="sub mt-1.5">
                <em>View, manage, and upload</em> all of your drawings from the Drawings log.
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {uploading && (
              <span className="text-xs flex items-center gap-1.5" style={{ color: "var(--brand-600)" }}>
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                {uploadStatus}
              </span>
            )}
            <div ref={reportsMenuRef} className="relative">
              <button
                onClick={() => setShowReportsMenu((o) => !o)}
                className="btn-secondary flex items-center gap-1.5"
              >
                Reports
                <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform ${showReportsMenu ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showReportsMenu && (
                <div className="absolute right-0 mt-2 w-52 bg-white border border-gray-100 rounded-xl shadow-lg py-1 z-20">
                  {["All Sets and Revisions", "Sketches", "Measurements"].map((option) => (
                    <button
                      key={option}
                      onClick={() => setShowReportsMenu(false)}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      {option}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button className="btn-secondary">View Locations</button>
            <button className="btn-secondary">Export</button>
            <button
              onClick={() => { setPrefillFiles([]); setShowUploadModal(true); }}
              disabled={uploading}
              className="btn-primary disabled:opacity-50"
            >
              Upload
            </button>
          </div>
        </div>

        {/* Stat strip */}
        {drawings.length > 0 && (
          <div className="stats" style={{ marginTop: 18 }}>
            <div className="stat">
              <div className="lbl">Sheets</div>
              <div className="val">{drawings.length}</div>
              <div className="delta">Across {disciplineGroups.length} disciplines</div>
            </div>
            <div className="stat">
              <div className="lbl">Disciplines</div>
              <div className="val">{disciplineGroups.length}</div>
              <div className="delta">{disciplineGroups.map((g) => g.discipline).slice(0, 3).join(" · ") || "—"}</div>
            </div>
            <div className="stat">
              <div className="lbl">Drawing sets</div>
              <div className="val">{uploads.length}</div>
              <div className="delta">{uploads.length === 1 ? "1 upload" : `${uploads.length} uploads`}</div>
            </div>
            <div className="stat calm">
              <div className="lbl">Last uploaded</div>
              <div className="val">{uploads[0] ? formatDate(uploads[0].uploaded_at).replace(/, \d{4}$/, "") : "—"}</div>
              <div className="delta">{uploads[0]?.filename ?? "No sets yet"}</div>
            </div>
          </div>
        )}
      </div>

      {/* Tabs / breadcrumb */}
      {viewingSet ? (
        <div className="bg-white border-b border-black/[0.06] px-6 py-3 shrink-0 flex items-center gap-2 text-sm">
          <button
            onClick={() => { setViewingSetId(null); setActiveTab("sets"); }}
            className="text-gray-500 hover:text-gray-800 transition-colors"
          >
            Drawing Sets
          </button>
          <span className="text-gray-400">›</span>
          <span className="font-semibold text-gray-900 truncate">
            {viewingSet.name}
            {viewingSet.default_drawing_date ? ` (${formatDate(viewingSet.default_drawing_date)})` : ""}
          </span>
        </div>
      ) : (
        <div className="bg-white border-b border-black/[0.06] px-6 shrink-0">
          <nav className="flex">
            {(["current", "sets", "recycle"] as const).map((tab) => {
              const labels = { current: "Current Drawings", sets: "Drawing Sets", recycle: "Recycle Bin" };
              return (
                <button
                  key={tab}
                  onClick={() => { setActiveTab(tab); setViewingSetId(null); }}
                  className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                    activeTab === tab
                      ? "border-[color:var(--brand-500)] text-[color:var(--ink)]"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {labels[tab]}
                </button>
              );
            })}
          </nav>
        </div>
      )}

      {/* Filter bar */}
      {activeTab === "sets" && !viewingSet ? (
        <div className="bg-white border-b border-black/[0.06] px-6 py-3 shrink-0">
          <div className="filters">
            <div className="search">
              <svg className="w-4 h-4 shrink-0" style={{ color: "var(--brand-500)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search drawing sets"
                value={setsSearch}
                onChange={(e) => setSetsSearch(e.target.value)}
              />
            </div>
          </div>
        </div>
      ) : (
      <div className="bg-white border-b border-black/[0.06] px-6 py-3 shrink-0">
        <div className="filters">
          <div className="search">
            <button
              type="button"
              onClick={() => runPdfSearch(searchQuery)}
              disabled={searchIndexBuilding || !searchQuery.trim()}
              title="Search the text inside every drawing PDF"
              className="shrink-0 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: "none", border: 0, padding: 0, cursor: "pointer" }}
            >
              {searchIndexBuilding ? (
                <svg className="w-4 h-4 animate-spin" style={{ color: "var(--brand-500)" }} fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" style={{ color: "var(--brand-500)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
                </svg>
              )}
            </button>
            <input
              type="text"
              placeholder="Search drawings — press Enter to search inside PDFs"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  runPdfSearch(searchQuery);
                }
              }}
            />
          </div>
          <button className="btn-secondary">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            Filters
          </button>
          <select
            value={disciplineFilter}
            onChange={(e) => setDisciplineFilter(e.target.value)}
            className="px-3 py-1.5 text-sm border border-black/10 rounded-md bg-white text-gray-600 focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-500)]"
          >
            <option value="">Discipline</option>
            {[...new Set(drawings.map((d) => inferDiscipline(d.drawing_no, d.category)))].sort().map((disc) => (
              <option key={disc} value={disc}>{disc}</option>
            ))}
          </select>
          <select
            value={setFilter}
            onChange={(e) => setSetFilter(e.target.value)}
            className="px-3 py-1.5 text-sm border border-black/10 rounded-md bg-white text-gray-600 focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-500)]"
          >
            <option value="">Set</option>
            {uploads.map((u) => (
              <option key={u.id} value={u.id}>{u.filename}</option>
            ))}
          </select>
          <div className="flex-1" />
          <div className="seg">
            <button
              onClick={() => setActiveView("table")}
              title="List view"
              className={activeView === "table" ? "active" : ""}
            >
              List
            </button>
            <button
              onClick={() => setActiveView("grid")}
              title="Grid view"
              className={activeView === "grid" ? "active" : ""}
            >
              Sheets
            </button>
          </div>
        </div>
      </div>
      )}

      {/* Drawing Sets list */}
      {activeTab === "sets" && !viewingSet ? (
        <div className="flex-1 px-6 py-6">
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-[11px] font-semibold uppercase tracking-wide text-gray-500 border-b border-black/[0.06]">
                <tr>
                  <th className="w-10 px-4 py-3"></th>
                  <th className="w-20 px-2 py-3"></th>
                  <th className="px-3 py-3 text-left">Name</th>
                  <th className="px-3 py-3 text-left">Date</th>
                  <th className="px-3 py-3 text-left">Published</th>
                  <th className="px-3 py-3 text-left">Unpublished</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.04]">
                {setsWithCounts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                      {loading
                        ? "Loading drawing sets…"
                        : sets.length === 0
                        ? "No drawing sets yet. Upload drawings to create your first set."
                        : "No drawing sets match your search."}
                    </td>
                  </tr>
                ) : (
                  setsWithCounts.map(({ set, date, published, unpublished }) => (
                    <tr key={set.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 align-middle">
                        <input type="checkbox" className="rounded border-gray-300" />
                      </td>
                      <td className="px-2 py-3 align-middle">
                        <button
                          onClick={() => { setActiveTab("sets"); setViewingSetId(set.id); }}
                          className="px-3 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
                        >
                          View
                        </button>
                      </td>
                      <td className="px-3 py-3 align-middle font-medium text-gray-900">{set.name}</td>
                      <td className="px-3 py-3 align-middle text-gray-600">{date ? formatDate(date) : "—"}</td>
                      <td className="px-3 py-3 align-middle text-gray-600">{published}</td>
                      <td className="px-3 py-3 align-middle text-gray-600">{unpublished}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
      <div
        className="flex flex-1"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <div className={`flex-1 flex flex-col ${isDragging ? "ring-2 ring-[color:var(--brand-500)] ring-inset" : ""}`}>
          <div className="px-6 py-6">
            {loading ? (
              <div className="rfi-list">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} className="drow" style={{ pointerEvents: "none" }}>
                    <div className="sn" style={{ opacity: 0.25 }}>···</div>
                    <div className="ttl"><span className="inline-block h-3 w-48 rounded bg-black/[0.06]" /></div>
                    <div className="rev"><span className="inline-block h-3 w-10 rounded bg-black/[0.06]" /></div>
                    <div className="when"><span className="inline-block h-3 w-16 rounded bg-black/[0.06]" /></div>
                    <div className="disc"><span className="inline-block h-3 w-20 rounded bg-black/[0.06]" /></div>
                    <div className="rfi-arrow" />
                  </div>
                ))}
              </div>
            ) : filteredDrawings.length === 0 ? (
              <div className="card card-pad flex flex-col items-center justify-center text-center" style={{ padding: "56px 24px" }}>
                <svg className="w-12 h-12 mb-3" style={{ color: "var(--brand-500)", opacity: 0.4 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="font-display text-lg text-[color:var(--ink)]">No drawings match your search</p>
                <p className="text-sm text-gray-500 mt-1">Adjust the search or filters to see more sheets.</p>
              </div>
            ) : activeView === "grid" ? (
              // ── Grid — sheet thumbnails ──
              <div className="grid-4">
                {filteredDrawings.map((d) => {
                  const disc = inferDiscipline(d.drawing_no, d.category);
                  return (
                    <div key={d.id} className="group relative">
                      <button
                        onClick={() => setViewingDrawing(d)}
                        className="sheet block w-full text-left focus:outline-none"
                        style={{ overflow: "hidden" }}
                      >
                        <Thumb drawing={d} />
                        <div className="sheet-tag">
                          <span className="num">{d.drawing_no ?? `P.${d.page_number}`}</span>
                          <span style={{ fontStyle: "italic", fontFamily: "var(--font-display), serif", color: "var(--brand-700)" }}>{disc}</span>
                        </div>
                      </button>
                      <div style={{ fontSize: 12, fontWeight: 500, marginTop: 8, color: "var(--ink)" }} className="truncate">
                        {d.title ?? `Page ${d.page_number} of ${d.filename}`}
                      </div>
                      <div className="font-mono" style={{ fontSize: 10, color: "#9CA3AF", marginTop: 2 }}>
                        {d.revision ? `Rev ${d.revision}` : "Rev 0"}
                        {d.drawing_date ? ` · ${formatDate(d.drawing_date)}` : ""}
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelected(d); }}
                        title="Edit details"
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 rounded bg-white border border-black/10 text-gray-500 hover:text-gray-800 transition-all"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              // ── List — editorial drow rows, discipline-grouped ──
              <div className="rfi-list">
                <div className="drow head" style={{ gridTemplateColumns: "110px 1fr 70px 110px 100px 60px" }}>
                  <div>Sheet</div><div>Title</div><div>Rev</div><div>Updated</div><div>Discipline</div><div></div>
                </div>
                {disciplineGroups.map(({ discipline, drawings: groupDrawings }) => {
                  const collapsed = collapsedGroups.has(discipline);
                  return (
                    <div key={`group-${discipline}`}>
                      <button
                        onClick={() => setCollapsedGroups((prev) => {
                          const next = new Set(prev);
                          if (next.has(discipline)) next.delete(discipline);
                          else next.add(discipline);
                          return next;
                        })}
                        className="w-full flex items-center gap-2 px-5 py-2.5 text-left bg-[#F4F2EC] border-b border-black/[0.06]"
                      >
                        <svg className={`w-3.5 h-3.5 text-gray-500 transition-transform ${collapsed ? "" : "rotate-90"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                        <span className="font-display text-[15px] italic text-[color:var(--ink)]">{discipline}</span>
                        <span className="font-mono text-xs text-gray-400">{groupDrawings.length}</span>
                      </button>
                      {!collapsed && groupDrawings.map((d) => (
                        <div
                          key={d.id}
                          onClick={() => setViewingDrawing(d)}
                          className="drow cursor-pointer"
                        >
                          <div className="sn">{d.drawing_no ?? `P.${d.page_number}`}</div>
                          <div className="ttl">
                            {d.title ?? <span className="text-gray-400">{`Page ${d.page_number} of ${d.filename}`}</span>}
                            <span className="font-mono ml-2 text-[10px] text-gray-400 truncate">{d.filename}</span>
                          </div>
                          <div className="rev">Rev {d.revision ?? "0"}</div>
                          <div className="when">{d.drawing_date ? formatDate(d.drawing_date) : (d.received_date ? formatDate(d.received_date) : "—")}</div>
                          <div className="disc">{discipline}</div>
                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={selectedIds.has(d.id)}
                              onChange={(e) => setSelectedIds((prev) => {
                                const next = new Set(prev);
                                if (e.target.checked) next.add(d.id); else next.delete(d.id);
                                return next;
                              })}
                              className="rounded border-gray-300"
                            />
                            <button
                              onClick={() => setSelected(d)}
                              title="Edit details"
                              className="text-gray-400 hover:text-gray-700 p-0.5"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="w-80 shrink-0 bg-white border-l border-gray-100 flex flex-col sticky top-0 h-screen">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-800 truncate pr-2">
                {selected.drawing_no ?? `Page ${selected.page_number}`}
              </h3>
              <button
                onClick={() => setSelected(null)}
                className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors shrink-0"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="w-full">
                <Thumb drawing={selected} size="panel" />
              </div>

              <div className="text-xs text-gray-500 space-y-0.5">
                <p className="font-medium text-gray-700 truncate">{selected.filename} — page {selected.page_number}</p>
                <p>Uploaded by {selected.uploaded_by_name} · {formatDate(selected.uploaded_at)}</p>
              </div>

              <div className="border-t border-gray-100 pt-3">
                <button
                  onClick={autoFill}
                  disabled={extracting}
                  className="w-full flex items-center justify-center gap-2 py-1.5 border border-gray-200 text-sm font-medium text-gray-600 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 mb-3"
                  title="Read text from the PDF title block and fill fields automatically"
                >
                  {extracting ? (
                    <>
                      <svg className="w-4 h-4 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                      </svg>
                      Reading title block…
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                      Auto-fill from PDF
                    </>
                  )}
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Drawing No.</label>
                  <input type="text" value={editNo} onChange={(e) => setEditNo(e.target.value)} placeholder="e.g. A-101"
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Title</label>
                  <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="e.g. Floor Plan"
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Discipline</label>
                  <DisciplineCombobox
                    value={editCategory}
                    options={disciplineOptions}
                    onChange={setEditCategory}
                    onCreate={createDiscipline}
                    placeholder="Select or type a discipline…"
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Revision</label>
                  <input type="text" value={editRevision} onChange={(e) => setEditRevision(e.target.value)} placeholder="e.g. 2"
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Drawing Date</label>
                  <input type="date" value={editDrawingDate} onChange={(e) => setEditDrawingDate(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Received Date</label>
                  <input type="date" value={editReceivedDate} onChange={(e) => setEditReceivedDate(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              <div className="space-y-2 pt-1">
                <button
                  onClick={saveDetail}
                  disabled={saving}
                  className="w-full py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save"}
                </button>

                {deleteConfirm ? (
                  <div className="flex gap-2">
                    <button onClick={deleteDrawing} className="flex-1 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors">
                      Confirm Delete
                    </button>
                    <button onClick={() => setDeleteConfirm(false)} className="flex-1 py-2 border border-gray-200 text-sm font-medium text-gray-600 rounded-lg hover:bg-gray-50 transition-colors">
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setDeleteConfirm(true)} className="w-full py-2 border border-red-200 text-red-600 text-sm font-medium rounded-lg hover:bg-red-50 transition-colors">
                    Delete Drawing
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      )}

      {/* Drag overlay */}
      {isDragging && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-blue-500/10 border-4 border-dashed border-blue-400 pointer-events-none">
          <p className="text-blue-600 text-xl font-semibold">Drop PDF to upload</p>
        </div>
      )}
    </div>
  );
}
