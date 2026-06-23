import mammoth from "mammoth";

/**
 * Helpers for the Training → Guides Word-document → plain-text conversion.
 *
 * Browsers download a .docx rather than rendering it, so when a Word document is
 * uploaded we extract its plain text and store it next to the original. That
 * text is served as `text/plain` so the guide opens as plain, readable text in a
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

/**
 * Extract the plain text of a .docx buffer. Returns null when extraction yields
 * no content. Throws on a hard mammoth failure (the caller treats that as "no
 * text rendition available" and opens the original file instead).
 */
export async function convertDocxToText(buffer: Buffer): Promise<string | null> {
  const { value } = await mammoth.extractRawText({ buffer });
  const text = (value || "").replace(/\r\n/g, "\n").trim();
  return text ? text : null;
}
