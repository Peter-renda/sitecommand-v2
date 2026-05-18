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
}) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const safeViewerPage = drawing.viewer_page > 0 ? drawing.viewer_page : 1;
  const pdfUrl = `${supabaseUrl}/storage/v1/object/public/project-drawings/${drawing.storage_path}#page=${safeViewerPage}`;
  const name = drawingLabel(drawing);

  const [loading, setLoading] = useState(true);
  const [renderError, setRenderError] = useState<string | null>(null);

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
      try {
        await ensurePdfJs();
        const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
        const url = `${supabaseUrl}/storage/v1/object/public/project-drawings/${drawing.storage_path}`;
        const pdf = await getDocument(url).promise;
        if (cancelled) return;
        const page = await pdf.getPage(safeViewerPage);
        if (cancelled) return;
        const containerW = Math.max((containerRef.current?.clientWidth ?? 900) - 32, 200);
        const containerH = Math.max((containerRef.current?.clientHeight ?? 700) - 32, 200);
        const baseVp = page.getViewport({ scale: 1 });
        const scale = Math.min(containerW / baseVp.width, containerH / baseVp.height);
        const vp = page.getViewport({ scale });
        // Render to an offscreen canvas — never touched by React
        const offscreen = document.createElement("canvas");
        offscreen.width = vp.width;
        offscreen.height = vp.height;
        const ctx = offscreen.getContext("2d");
        if (!ctx || cancelled) return;
        await page.render({ canvasContext: ctx, viewport: vp }).promise;
        if (cancelled) return;
        pdfDimsRef.current = { w: vp.width, h: vp.height };
        setPdfDataUrl(offscreen.toDataURL());
        const annoCanvas = annotationCanvasRef.current;
        if (annoCanvas) {
          annoCanvas.width = vp.width;
          annoCanvas.height = vp.height;
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

      {/* PDF canvas + annotation overlay in a scrollable container */}
      <div ref={containerRef} className="relative flex-1 overflow-auto bg-gray-950 min-h-0">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-950 z-10">
            <svg className="w-8 h-8 text-gray-500 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        )}
        <div className="flex justify-center items-center p-4 min-h-full">
          <div ref={previewSurfaceRef} className="relative inline-block max-h-full">
            {pdfDataUrl && (
              <img src={pdfDataUrl} alt={name} className="block max-w-full max-h-full shadow-xl" draggable={false} />
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
    </div>
  );
}

// ── Review Extracted Metadata Modal ───────────────────────────────────────────

type ReviewRow = {
  drawing_id: string;
  page_number: number;
  title: string;
  drawing_no: string;
  category: string;
  revision: string;
  drawing_date: string;
  approved: boolean;
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

function ReviewExtractedModal({
  projectId,
  uploadId,
  drawings,
  onClose,
  onApplied,
}: {
  projectId: string;
  uploadId: string;
  drawings: DrawingPage[];
  onClose: () => void;
  onApplied: (updates: DrawingPage[]) => void;
}) {
  const [rows, setRows] = useState<ReviewRow[]>(() =>
    drawings.map((d) => ({
      drawing_id: d.id,
      page_number: d.page_number,
      title: d.title ?? "",
      drawing_no: d.drawing_no ?? "",
      category: d.category ?? "",
      revision: d.revision ?? "",
      drawing_date: d.drawing_date ?? "",
      approved: false,
      saving: false,
    })),
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [applyingAll, setApplyingAll] = useState(false);

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
              revision: m.revision || row.revision,
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

  function updateRow(drawingId: string, patch: Partial<ReviewRow>) {
    setRows((prev) => prev.map((r) => (r.drawing_id === drawingId ? { ...r, ...patch } : r)));
  }

  async function applyRow(row: ReviewRow): Promise<DrawingPage | null> {
    updateRow(row.drawing_id, { saving: true });
    try {
      const res = await fetch(
        `/api/projects/${projectId}/drawings/${row.drawing_id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            drawing_no: row.drawing_no || null,
            title: row.title || null,
            revision: row.revision || null,
            drawing_date: row.drawing_date || null,
            category: row.category || null,
          }),
        },
      );
      if (!res.ok) throw new Error("Save failed");
      const updated = await res.json();
      updateRow(row.drawing_id, { approved: true, saving: false });
      return updated as DrawingPage;
    } catch {
      updateRow(row.drawing_id, { saving: false });
      return null;
    }
  }

  async function handleApprove(row: ReviewRow) {
    const updated = await applyRow(row);
    if (updated) onApplied([updated]);
  }

  async function handleApproveAll() {
    setApplyingAll(true);
    const pending = rows.filter((r) => !r.approved);
    const applied: DrawingPage[] = [];
    for (const row of pending) {
      const updated = await applyRow(row);
      if (updated) applied.push(updated);
    }
    if (applied.length > 0) onApplied(applied);
    setApplyingAll(false);
  }

  const allApproved = rows.length > 0 && rows.every((r) => r.approved);
  const approvedCount = rows.filter((r) => r.approved).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Review extracted drawing info</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              We read the title block on each page. Edit any field, then approve to save.
            </p>
          </div>
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

        {loading && (
          <div className="px-6 py-12 flex flex-col items-center justify-center text-sm text-gray-500">
            <svg className="w-6 h-6 animate-spin text-blue-500 mb-3" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            Reading the title block on each page…
          </div>
        )}

        {error && !loading && (
          <div className="px-6 py-4 bg-amber-50 border-b border-amber-100 text-sm text-amber-800">
            {error}. You can still edit fields manually and approve.
          </div>
        )}

        {!loading && (
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wide sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left w-12">#</th>
                  <th className="px-3 py-2 text-left">Sheet No.</th>
                  <th className="px-3 py-2 text-left">Title</th>
                  <th className="px-3 py-2 text-left w-44">Category</th>
                  <th className="px-3 py-2 text-left w-24">Rev.</th>
                  <th className="px-3 py-2 text-left w-40">Date</th>
                  <th className="px-3 py-2 text-left w-32"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((row) => (
                  <tr key={row.drawing_id} className={row.approved ? "bg-emerald-50/50" : ""}>
                    <td className="px-3 py-2 text-gray-500">{row.page_number}</td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={row.drawing_no}
                        onChange={(e) => updateRow(row.drawing_id, { drawing_no: e.target.value, approved: false })}
                        className="w-full border border-gray-200 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="A-101"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={row.title}
                        onChange={(e) => updateRow(row.drawing_id, { title: e.target.value, approved: false })}
                        className="w-full border border-gray-200 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Floor Plan"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={row.category}
                        onChange={(e) => updateRow(row.drawing_id, { category: e.target.value, approved: false })}
                        className="w-full border border-gray-200 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      >
                        {CATEGORY_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={row.revision}
                        onChange={(e) => updateRow(row.drawing_id, { revision: e.target.value, approved: false })}
                        className="w-full border border-gray-200 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="2"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="date"
                        value={row.drawing_date}
                        onChange={(e) => updateRow(row.drawing_id, { drawing_date: e.target.value, approved: false })}
                        className="w-full border border-gray-200 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-3 py-2">
                      {row.approved ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 text-xs font-medium">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                          Approved
                        </span>
                      ) : (
                        <button
                          onClick={() => handleApprove(row)}
                          disabled={row.saving || applyingAll}
                          className="px-3 py-1 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
                        >
                          {row.saving ? "Saving…" : "Approve"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-between gap-3">
          <p className="text-xs text-gray-500">
            {approvedCount} of {rows.length} approved
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
            >
              {allApproved ? "Close" : "Skip"}
            </button>
            <button
              onClick={handleApproveAll}
              disabled={loading || applyingAll || allApproved}
              className="px-4 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {applyingAll ? "Approving…" : "Approve All"}
            </button>
          </div>
        </div>
      </div>
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
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
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

  // Thumbnail cache: drawingId → dataUrl
  const thumbnails = useRef<Map<string, string>>(new Map());
  const [thumbVersion, setThumbVersion] = useState(0); // force re-render when thumb ready

  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadsPanelRef = useRef<HTMLDivElement>(null);

  // ── Fetch ────────────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/projects/${projectId}/drawings`);
    if (res.ok) {
      const data = await res.json();
      setDrawings(data.drawings ?? []);
      setUploads(data.uploads ?? []);
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => { fetchData(); }, [fetchData]);

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

  async function handleUpload(file: File) {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      alert("Only PDF files are accepted.");
      return;
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
        body: JSON.stringify({ storagePath, filename: file.name }),
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
    } catch (err) {
      alert(err instanceof Error ? err.message : "Upload failed");
      setUploadStatus("");
    } finally {
      setUploading(false);
    }
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.[0]) {
      handleUpload(e.target.files[0]);
      e.target.value = "";
    }
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleUpload(file);
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
  }, [drawings, searchQuery, disciplineFilter, setFilter]);

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
      <div className="h-screen bg-gray-50 flex flex-col">
        <header className="bg-white border-b border-gray-100 px-6 h-14 flex items-center justify-between shrink-0">
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
            <p className="text-base font-semibold text-gray-700 mb-1">Drop a PDF drawing set here</p>
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
                onClick={() => fileInputRef.current?.click()}
                className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                Choose File
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={handleFileInput}
            />
          </div>
        </div>
      </div>
    );
  }

  // ── Main layout ──────────────────────────────────────────────────────────────

  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      {/* Review extracted metadata after upload */}
      {reviewModal && (
        <ReviewExtractedModal
          projectId={projectId}
          uploadId={reviewModal.uploadId}
          drawings={reviewModal.drawings}
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
        />
      )}

      {/* PDF Viewer Modal */}
      {viewingDrawing && (
        <DrawingPdfViewerModal
          key={viewingDrawing.id}
          drawing={viewingDrawing}
          allDrawings={filteredDrawings}
          onClose={() => setViewingDrawing(null)}
          onNavigate={setViewingDrawing}
          onEditDetails={() => { setSelected(viewingDrawing); setViewingDrawing(null); }}
          projectId={projectId}
          userRole={role}
          userName={username}
          userId={userId}
        />
      )}

      {/* Global header */}
      <header className="bg-white border-b border-gray-100 px-6 h-14 flex items-center justify-between shrink-0">
        <a href="/dashboard" className="text-sm font-semibold text-gray-900 hover:text-gray-600 transition-colors">
          SiteCommand
        </a>
        <div className="flex items-center gap-2">
          <div className="w-px h-5 bg-gray-200 mx-1" />
          <span className="text-sm text-gray-400">{username}</span>
          <button onClick={handleLogout} className="text-sm text-gray-400 hover:text-gray-900 transition-colors">Logout</button>
        </div>
      </header>
      <input ref={fileInputRef} type="file" accept=".pdf" className="hidden" onChange={handleFileInput} />

      <ProjectNav projectId={projectId} />

      {/* Page title */}
      <div className="bg-white border-b border-gray-100 px-6 py-4 shrink-0 flex items-end justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h1 className="font-display text-[32px] leading-[1.05] tracking-[-0.012em] text-[color:var(--ink)]">Drawings</h1>
          {drawings.length > 0 ? (
            <p className="sec-sub mt-1.5">
              <span className="serif-italic text-[color:var(--brand-700)]">Across this project</span>
              <span className="sep">·</span>
              <span className="num" style={{ color: "var(--brand-500)" }}>{drawings.length}</span> sheets
            </p>
          ) : (
            <p className="sec-sub mt-1.5">View, manage, and upload all of your drawings from the Drawings log.</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {uploading && (
            <span className="text-xs text-blue-600 flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              {uploadStatus}
            </span>
          )}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="px-4 py-1.5 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            Upload
          </button>
          <button className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-200 text-gray-600 rounded-md hover:bg-gray-50 transition-colors">
            Reports
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <button className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-200 text-gray-600 rounded-md hover:bg-gray-50 transition-colors">
            View Locations
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <button className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-200 text-gray-600 rounded-md hover:bg-gray-50 transition-colors">
            Export
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-100 px-6 shrink-0">
        <nav className="flex">
          {(["current", "sets", "recycle"] as const).map((tab) => {
            const labels = { current: "Current Drawings", sets: "Drawing Sets", recycle: "Recycle Bin" };
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  activeTab === tab
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {labels[tab]}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Filter bar */}
      <div className="bg-white border-b border-gray-100 px-6 py-3 flex items-center gap-3 shrink-0">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
          />
        </div>
        <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          Filters
        </button>
        <select
          value={disciplineFilter}
          onChange={(e) => setDisciplineFilter(e.target.value)}
          className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Discipline</option>
          {[...new Set(drawings.map((d) => inferDiscipline(d.drawing_no)))].sort().map((disc) => (
            <option key={disc} value={disc}>{disc}</option>
          ))}
        </select>
        <select
          value={setFilter}
          onChange={(e) => setSetFilter(e.target.value)}
          className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Set</option>
          {uploads.map((u) => (
            <option key={u.id} value={u.id}>{u.filename}</option>
          ))}
        </select>
        <div className="flex-1" />
        <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
          <button
            onClick={() => setActiveView("table")}
            title="List view"
            className={`p-2 transition-colors ${activeView === "table" ? "bg-blue-600 text-white" : "text-gray-500 hover:bg-gray-50"}`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
          </button>
          <button
            onClick={() => setActiveView("grid")}
            title="Grid view"
            className={`p-2 transition-colors ${activeView === "grid" ? "bg-blue-600 text-white" : "text-gray-500 hover:bg-gray-50"}`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Main content area */}
      <div
        className="flex flex-1 overflow-hidden"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <div className={`flex-1 flex flex-col overflow-hidden ${isDragging ? "ring-2 ring-blue-400 ring-inset" : ""}`}>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-48 text-gray-400 text-sm">Loading…</div>
            ) : filteredDrawings.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <svg className="w-12 h-12 text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-sm font-medium text-gray-500">No drawings match your search</p>
              </div>
            ) : activeView === "grid" ? (
              // ── Grid ──
              <div className="p-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredDrawings.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => setViewingDrawing(d)}
                    className="group relative aspect-[3/4] bg-gray-100 rounded-xl overflow-hidden border-2 border-transparent hover:border-blue-300 transition-all text-left focus:outline-none"
                  >
                    <Thumb drawing={d} />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent px-3 py-2">
                      {d.drawing_no && <p className="text-white text-xs font-bold truncate">{d.drawing_no}</p>}
                      <p className="text-white/80 text-xs truncate">{d.title ?? `Page ${d.page_number} of ${d.filename}`}</p>
                      {d.revision && (
                        <span className="inline-block mt-1 px-1.5 py-0.5 bg-white/20 rounded text-white text-[10px] font-medium">Rev {d.revision}</span>
                      )}
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelected(d); }}
                      title="Edit details"
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 bg-black/50 rounded text-white hover:bg-black/70 transition-all"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                  </button>
                ))}
              </div>
            ) : (
              // ── Table (discipline-grouped) ──
              <div className="bg-white">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="w-10 px-3 py-3" />
                      <th className="w-8 px-2 py-3">
                        <input type="checkbox" className="rounded border-gray-300" />
                      </th>
                      <th className="text-left px-3 py-3 text-xs font-semibold text-gray-600 w-36">Drawing No.</th>
                      <th className="text-left px-3 py-3 text-xs font-semibold text-gray-600">Drawing Title</th>
                      <th className="text-left px-3 py-3 text-xs font-semibold text-gray-600 w-36">Revision</th>
                      <th className="text-left px-3 py-3 text-xs font-semibold text-gray-600 w-36">Drawing Date</th>
                      <th className="text-left px-3 py-3 text-xs font-semibold text-gray-600 w-36">Received Date</th>
                      <th className="text-left px-3 py-3 text-xs font-semibold text-gray-600 w-44">Set</th>
                      <th className="text-left px-3 py-3 text-xs font-semibold text-gray-600 w-28">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {disciplineGroups.map(({ discipline, drawings: groupDrawings }) => (
                      <>
                        {/* Group header row */}
                        <tr key={`group-${discipline}`} className="bg-blue-50 border-b border-gray-200">
                          <td className="px-3 py-2.5 text-center">
                            <button
                              onClick={() => setCollapsedGroups((prev) => {
                                const next = new Set(prev);
                                if (next.has(discipline)) next.delete(discipline);
                                else next.add(discipline);
                                return next;
                              })}
                              className="text-gray-500 hover:text-gray-700"
                            >
                              {collapsedGroups.has(discipline) ? (
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                </svg>
                              ) : (
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                </svg>
                              )}
                            </button>
                          </td>
                          <td className="px-2 py-2.5">
                            <input type="checkbox" className="rounded border-gray-300" />
                          </td>
                          <td colSpan={7} className="px-3 py-2.5 text-sm font-semibold text-gray-700">
                            {discipline} ({groupDrawings.length})
                          </td>
                        </tr>
                        {/* Data rows */}
                        {!collapsedGroups.has(discipline) && groupDrawings.map((d) => (
                          <tr
                            key={d.id}
                            onClick={() => setViewingDrawing(d)}
                            className="border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer"
                          >
                            <td className="px-3 py-3" />
                            <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
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
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={(e) => { e.stopPropagation(); setSelected(d); }}
                                  title="Edit details"
                                  className="text-gray-400 hover:text-gray-600 shrink-0"
                                >
                                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                  </svg>
                                </button>
                                <span className="text-blue-600 font-medium text-xs">
                                  {d.drawing_no ?? `P.${d.page_number}`}
                                </span>
                              </div>
                            </td>
                            <td className="px-3 py-3 text-gray-700 text-xs">{d.title ?? <span className="text-gray-400">—</span>}</td>
                            <td className="px-3 py-3">
                              <div className="flex items-center gap-2">
                                <span className="text-gray-700 text-xs">{d.revision ?? "0"}</span>
                                <button onClick={(e) => e.stopPropagation()} className="px-2 py-0.5 text-xs border border-gray-300 rounded text-gray-600 hover:bg-gray-50">See All</button>
                              </div>
                            </td>
                            <td className="px-3 py-3 text-gray-600 text-xs">{d.drawing_date ? formatDate(d.drawing_date) : <span className="text-gray-400">—</span>}</td>
                            <td className="px-3 py-3 text-gray-600 text-xs">{d.received_date ? formatDate(d.received_date) : <span className="text-gray-400">—</span>}</td>
                            <td className="px-3 py-3 text-gray-600 text-xs truncate max-w-[150px]">
                              {d.filename}
                            </td>
                            <td className="px-3 py-3">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-200">
                                Published
                              </span>
                            </td>
                          </tr>
                        ))}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="w-80 shrink-0 bg-white border-l border-gray-100 flex flex-col overflow-hidden">
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
                  <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    {CATEGORY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
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

      {/* Drag overlay */}
      {isDragging && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-blue-500/10 border-4 border-dashed border-blue-400 pointer-events-none">
          <p className="text-blue-600 text-xl font-semibold">Drop PDF to upload</p>
        </div>
      )}
    </div>
  );
}
