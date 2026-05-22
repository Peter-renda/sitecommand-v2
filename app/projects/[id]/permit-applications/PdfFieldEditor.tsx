"use client";
import { useEffect, useRef, useState } from "react";

export type PermitFieldType = "text" | "multiline" | "checkbox" | "date";

export type FieldRect = { page: number; x: number; y: number; w: number; h: number };

export type PermitField = {
  key: string;
  label: string;
  value: string;
  acroField: string | null;
  type: PermitFieldType;
  pageIndex?: number;
  drawX?: number;
  drawY?: number;
  drawW?: number;
  drawMode?: "fill" | "fill_below" | "check";
  rect?: FieldRect;
};

function isTruthy(value: string): boolean {
  return ["yes", "y", "true", "1", "x", "checked", "on"].includes(value.trim().toLowerCase());
}

// A field can be drawn on the page when it has either an AcroForm widget
// rectangle or resolved text-layout draw coordinates.
function hasPosition(f: PermitField): boolean {
  if (f.rect) return true;
  return f.drawX !== undefined && f.drawY !== undefined && f.pageIndex !== undefined;
}

function pageOf(f: PermitField): number {
  if (f.rect) return f.rect.page;
  return f.pageIndex ?? 0;
}

function kindOf(f: PermitField): "check" | "multiline" | "text" {
  if (f.drawMode === "check") return "check";
  if (f.rect && f.type === "checkbox") return "check";
  if (f.type === "multiline" || f.drawMode === "fill_below") return "multiline";
  return "text";
}

// ── pdfjs loader (mirrors the project-wide pattern in DrawingsClient) ────────

let pdfJsReady = false;
async function ensurePdfJs() {
  if (pdfJsReady) return;
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
  pdfJsReady = true;
}

type RenderedPage = { dataUrl: string; ptW: number; ptH: number };

// Geometry of one editable box, in displayed CSS pixels.
type Geometry = { left: number; top: number; width: number; height: number; fontSize: number };

function geometryFor(
  f: PermitField,
  pageWidthPx: number,
  pageHeightPx: number,
  fontPx: number,
): Geometry {
  if (f.rect) {
    return {
      left: f.rect.x * pageWidthPx,
      top: f.rect.y * pageHeightPx,
      width: Math.max(12, f.rect.w * pageWidthPx),
      height: Math.max(12, f.rect.h * pageHeightPx),
      fontSize: Math.max(7, Math.min(fontPx * 1.5, f.rect.h * pageHeightPx * 0.62)),
    };
  }

  const left = (f.drawX ?? 0) * pageWidthPx;
  const baselineTop = (1 - (f.drawY ?? 0)) * pageHeightPx;

  if (f.drawMode === "check") {
    const size = Math.max(11, fontPx * 1.5);
    return { left, top: baselineTop - fontPx * 1.15, width: size, height: size, fontSize: fontPx };
  }
  if (f.drawMode === "fill_below") {
    return {
      left,
      top: baselineTop - fontPx * 1.15,
      width: Math.max(60, (f.drawW ?? 0.85) * pageWidthPx),
      height: fontPx * 6,
      fontSize: fontPx,
    };
  }
  return {
    left,
    top: baselineTop - fontPx * 1.15,
    width: Math.max(40, (f.drawW ?? 0.25) * pageWidthPx),
    height: fontPx * 1.6,
    fontSize: fontPx,
  };
}

export default function PdfFieldEditor({
  file,
  fields,
  onChange,
  disabled,
}: {
  file: File;
  fields: PermitField[];
  onChange: (index: number, value: string) => void;
  disabled?: boolean;
}) {
  const [pages, setPages] = useState<RenderedPage[] | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pageWidthPx, setPageWidthPx] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Render every page of the uploaded PDF to an image.
  useEffect(() => {
    let cancelled = false;
    setPages(null);
    setPdfError(null);
    (async () => {
      try {
        await ensurePdfJs();
        const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
        const data = await file.arrayBuffer();
        const pdf = await getDocument({ data }).promise;
        const rendered: RenderedPage[] = [];
        const RENDER_SCALE = 2;
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const base = page.getViewport({ scale: 1 });
          const viewport = page.getViewport({ scale: RENDER_SCALE });
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext("2d");
          if (!ctx) continue;
          await page.render({ canvasContext: ctx, viewport }).promise;
          rendered.push({
            dataUrl: canvas.toDataURL("image/jpeg", 0.9),
            ptW: base.width,
            ptH: base.height,
          });
        }
        if (!cancelled) setPages(rendered);
      } catch (err) {
        if (!cancelled) {
          setPdfError(err instanceof Error ? err.message : "Could not render the PDF preview.");
        }
      }
    })();
    return () => { cancelled = true; };
  }, [file]);

  // Track the displayed page width so overlays can be positioned in pixels.
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const update = () => setPageWidthPx(el.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [pages]);

  const indexed = fields.map((f, index) => ({ f, index }));
  const unplaced = indexed.filter(({ f }) => !hasPosition(f));

  return (
    <div>
      {pdfError && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {pdfError}
        </p>
      )}

      {!pages && !pdfError && (
        <p className="text-sm text-black/60">Rendering the form preview…</p>
      )}

      {pages && (
        <div ref={wrapperRef} className="space-y-5">
          {pages.map((page, pageIdx) => {
            const heightPx = pageWidthPx > 0 ? (pageWidthPx * page.ptH) / page.ptW : 0;
            const ptToPx = pageWidthPx > 0 ? pageWidthPx / page.ptW : 0;
            const fontPx = 9.5 * ptToPx;
            const onPage = indexed.filter(
              ({ f }) => hasPosition(f) && pageOf(f) === pageIdx,
            );
            return (
              <div
                key={pageIdx}
                className="relative border border-black/15 shadow-sm bg-white"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={page.dataUrl}
                  alt={`Permit page ${pageIdx + 1}`}
                  className="block w-full select-none"
                  draggable={false}
                />
                {pageWidthPx > 0 &&
                  onPage.map(({ f, index }) => {
                    const geo = geometryFor(f, pageWidthPx, heightPx, fontPx);
                    const kind = kindOf(f);
                    const baseStyle: React.CSSProperties = {
                      position: "absolute",
                      left: `${geo.left}px`,
                      top: `${geo.top}px`,
                      fontSize: `${geo.fontSize}px`,
                    };

                    if (kind === "check") {
                      const checked = isTruthy(f.value);
                      return (
                        <button
                          key={f.key}
                          type="button"
                          title={f.label}
                          disabled={disabled}
                          onClick={() => onChange(index, checked ? "" : "Yes")}
                          style={{
                            ...baseStyle,
                            width: `${geo.width}px`,
                            height: `${geo.height}px`,
                            lineHeight: `${geo.height}px`,
                          }}
                          className={`flex items-center justify-center rounded-[2px] border font-bold ${
                            checked
                              ? "bg-yellow-300/80 border-yellow-600 text-black"
                              : "bg-yellow-200/45 border-yellow-500/70 text-transparent hover:bg-yellow-200/70"
                          }`}
                        >
                          ✕
                        </button>
                      );
                    }

                    if (kind === "multiline") {
                      return (
                        <textarea
                          key={f.key}
                          title={f.label}
                          value={f.value}
                          disabled={disabled}
                          onChange={(e) => onChange(index, e.target.value)}
                          style={{
                            ...baseStyle,
                            width: `${geo.width}px`,
                            height: `${geo.height}px`,
                            lineHeight: 1.25,
                            padding: "1px 2px",
                          }}
                          className="resize-none rounded-[2px] border border-yellow-500/70 bg-yellow-200/55 text-black outline-none focus:bg-yellow-100 focus:border-yellow-600 focus:ring-1 focus:ring-yellow-500"
                        />
                      );
                    }

                    return (
                      <input
                        key={f.key}
                        title={f.label}
                        value={f.value}
                        disabled={disabled}
                        onChange={(e) => onChange(index, e.target.value)}
                        style={{
                          ...baseStyle,
                          width: `${geo.width}px`,
                          height: `${geo.height}px`,
                          lineHeight: `${geo.height}px`,
                          padding: "0 2px",
                        }}
                        className="rounded-[2px] border border-yellow-500/70 bg-yellow-200/55 text-black outline-none focus:bg-yellow-100 focus:border-yellow-600 focus:ring-1 focus:ring-yellow-500"
                      />
                    );
                  })}
              </div>
            );
          })}
        </div>
      )}

      {unplaced.length > 0 && (
        <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-800">
            Other fields
          </p>
          <p className="text-xs text-amber-700 mt-0.5">
            These could not be positioned on the preview above. They will still be included in the
            completed PDF — written into the matching form field where one exists, otherwise on a
            summary page.
          </p>
          <div className="mt-3 space-y-3">
            {unplaced.map(({ f, index }) => (
              <label key={f.key} className="block text-sm">
                <span className="block text-black/70 mb-1">{f.label}</span>
                <input
                  value={f.value}
                  disabled={disabled}
                  onChange={(e) => onChange(index, e.target.value)}
                  className="w-full rounded-md border border-black/15 px-3 py-2"
                />
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
