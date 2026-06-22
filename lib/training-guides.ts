import mammoth from "mammoth";

/**
 * Helpers for the Training → Guides Word-document → HTML conversion.
 *
 * Browsers download a .docx rather than rendering it, so when a Word document is
 * uploaded we convert it to a self-contained, styled HTML document. That HTML is
 * stored next to the original and served so the guide opens (and renders) in a
 * new tab.
 *
 * Only Office Open XML (.docx) is convertible — the legacy binary .doc format is
 * not supported by mammoth and falls back to opening the original file.
 */

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export function isConvertibleWordDoc(
  fileType: string | null | undefined,
  filename: string | null | undefined,
): boolean {
  const t = (fileType || "").toLowerCase();
  const name = (filename || "").toLowerCase();
  return t === DOCX_MIME || name.endsWith(".docx");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Wrap a mammoth HTML fragment in a complete, lightly-styled HTML document so it
 * reads well when opened standalone in a browser tab.
 */
function wrapHtmlDocument(bodyHtml: string, title: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>
  :root { color-scheme: light; }
  body {
    margin: 0;
    background: #f9fafb;
    color: #111827;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    line-height: 1.6;
  }
  main {
    max-width: 800px;
    margin: 0 auto;
    padding: 48px 24px 96px;
  }
  h1, h2, h3, h4 { line-height: 1.25; margin-top: 1.6em; }
  h1 { font-size: 1.8rem; }
  h2 { font-size: 1.4rem; }
  h3 { font-size: 1.15rem; }
  p { margin: 0.75em 0; }
  img { max-width: 100%; height: auto; }
  table { border-collapse: collapse; width: 100%; margin: 1em 0; }
  th, td { border: 1px solid #e5e7eb; padding: 6px 10px; text-align: left; vertical-align: top; }
  ul, ol { padding-left: 1.5em; }
  a { color: #2563eb; }
</style>
</head>
<body>
<main>
${bodyHtml}
</main>
</body>
</html>`;
}

/**
 * Convert a .docx buffer to a complete styled HTML document. Returns null when
 * conversion produces no content. Throws on a hard mammoth failure (the caller
 * treats that as "no HTML rendition available").
 */
export async function convertDocxToHtmlDocument(
  buffer: Buffer,
  title: string,
): Promise<string | null> {
  const { value } = await mammoth.convertToHtml({ buffer });
  const fragment = (value || "").trim();
  if (!fragment) return null;
  return wrapHtmlDocument(fragment, title);
}
