// Server-side pdfjs-dist loader.
//
// pdfjs-dist v5 references DOMMatrix/ImageData/Path2D at module load. In a
// plain Node process it self-polyfills from @napi-rs/canvas via a dynamic
// createRequire, but that path doesn't survive Next.js's bundled server
// runtime — DOMMatrix ends up undefined and any getDocument() call throws
// "DOMMatrix is not defined". Polyfilling the globals before importing
// pdfjs avoids the crash.

type PdfjsModule = typeof import("pdfjs-dist/legacy/build/pdf.mjs");

let pdfjsPromise: Promise<PdfjsModule> | null = null;

export async function loadPdfjs(): Promise<PdfjsModule> {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const g = globalThis as unknown as {
        DOMMatrix?: unknown;
        ImageData?: unknown;
        Path2D?: unknown;
      };
      if (!g.DOMMatrix || !g.ImageData || !g.Path2D) {
        const canvas = (await import("@napi-rs/canvas")) as unknown as {
          DOMMatrix: unknown;
          ImageData: unknown;
          Path2D: unknown;
        };
        if (!g.DOMMatrix) g.DOMMatrix = canvas.DOMMatrix;
        if (!g.ImageData) g.ImageData = canvas.ImageData;
        if (!g.Path2D) g.Path2D = canvas.Path2D;
      }
      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
      pdfjs.GlobalWorkerOptions.workerSrc = "";
      return pdfjs;
    })();
  }
  return pdfjsPromise;
}
