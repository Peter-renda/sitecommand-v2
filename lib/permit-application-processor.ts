// Server-side Permit Application processor — 3-stage pipeline.
//
// AcroForm PDFs (Stage 1→2→3):
//   1. extractAcroFields — enumerate form field names (pdf-lib)
//   2. Gemini — map project data → field values (JSON in / JSON out)
//   3. fillPermitApplication — write values into AcroForm, flatten (pdf-lib)
//
// Flat / scanned PDFs (Stage 1→2→3):
//   1. extractTextLayout — extract all text + coordinates (pdfjs-dist)
//   2. Gemini — semantic mapping using text layout (no PDF image sent)
//   3. fillPermitApplication — draw text/marks at computed positions (pdf-lib)

import { GoogleGenAI, Type } from "@google/genai";
import {
  PDFDocument,
  PDFTextField,
  PDFCheckBox,
  PDFDropdown,
  PDFRadioGroup,
  PDFOptionList,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFForm,
} from "pdf-lib";

// ── Types ──────────────────────────────────────────────────────────────────

export type PermitFieldType = "text" | "multiline" | "checkbox" | "date";

// Normalized 0–1 bounding box, top-left origin (legacy — kept for AcroForm path).
export type BoundingBox = { x1: number; y1: number; x2: number; y2: number };

export type PermitField = {
  key: string;
  label: string;
  value: string;
  acroField: string | null;
  type: PermitFieldType;
  pageIndex?: number;

  // Legacy bounding-box overlay (AcroForm fallback path).
  boundingBox?: BoundingBox;

  // Text-layout overlay (flat-PDF path). Coordinates are normalized 0–1 in
  // pdf-lib space (bottom-left origin, y increases upward).
  drawX?: number;
  drawY?: number;
  drawMode?: "fill" | "fill_below" | "check";
};

export type AcroFieldInfo = { name: string; type: string };

export interface TextLayoutItem {
  id: string;         // "p{page}_i{index}"
  pageIndex: number;  // 0-based
  text: string;
  x: number;          // left edge in pdf-lib coords (bottom-left origin)
  y: number;          // baseline in pdf-lib coords
  width: number;      // text width in points
}

export type PermitProjectContext = Record<string, unknown>;

const FIELD_TYPES: PermitFieldType[] = ["text", "multiline", "checkbox", "date"];
const MAX_FIELDS = 150;

// ── Gemini system instructions ─────────────────────────────────────────────

const SCAN_SYSTEM_INSTRUCTION = `You are an expert assistant that fills out construction permit application forms.

You receive:
1. A permit application PDF (a blank or partially-blank form).
2. A JSON object of known project data ("PROJECT DATA").
3. A list of the PDF's interactive AcroForm field names ("ACROFORM FIELDS"), which may be empty.

Your job:
- Identify EVERY field on the form that an applicant is expected to fill in.
- For each field, supply the best value you can justify from PROJECT DATA. If the data does not clearly support an answer, leave the value as an empty string.

Return ONLY a JSON array — no markdown fences, no commentary. Each element must be:
{
  "key": string,            // short snake_case identifier, e.g. "applicant_name"
  "label": string,          // human-readable label exactly as a person reads it on the form
  "value": string,          // best value from PROJECT DATA, or "" if unknown
  "acroField": string|null, // the matching name from ACROFORM FIELDS, or null
  "type": "text" | "multiline" | "checkbox" | "date"
}

Rules:
- Include every fillable field, even ones you cannot answer (use value "").
- When ACROFORM FIELDS is non-empty, map each form field to exactly one acroField name. Never reuse an acroField for two fields. If you cannot map one, use null.
- Never invent data. Only use values supported by PROJECT DATA.
- Format dates as MM/DD/YYYY.
- For checkboxes, "value" is "Yes" when the box should be checked, otherwise "".
- Use "multiline" for long free-text fields (scope, description), "text" for short ones.
- Keep the fields in the order they appear on the form. Return at most 120 fields.`;

// Used for flat / scanned PDFs. Receives the text layout extracted from the
// PDF (no PDF image) so it only does semantic mapping — not coordinate guessing.
const SCAN_SYSTEM_INSTRUCTION_FLAT = `You are an expert assistant that fills out construction permit application forms.

You receive:
1. FORM LAYOUT: every visible text element extracted from the flat permit form, each with an ID, page number, y position (higher = higher on the page, origin at bottom-left), x position, approximate width, and the text string.
2. PROJECT DATA: values available to fill in.

Your task:
- Identify every fillable field (blank lines, text boxes, checkboxes, radio buttons).
- For each field, choose a value from PROJECT DATA and reference the exact text item to anchor the fill position.

Return a JSON array. Each element:
{
  "key": snake_case identifier,
  "label": human-readable label shown to the user,
  "value": value from PROJECT DATA, or "" if not applicable,
  "type": "text" | "date" | "checkbox",
  "anchorId": ID of the text item from FORM LAYOUT that anchors the draw position,
  "drawMode": "fill" | "fill_below" | "check"
}

drawMode:
- "fill"       — value is written immediately to the RIGHT of the anchor text (same baseline).
                 Use for inline fields where the blank line follows the label (e.g. "Email:", "Phone:").
- "fill_below" — value is written on the line(s) BELOW the anchor text.
                 Use for large text areas (e.g. "Provide a detailed project description:").
- "check"      — an X mark is drawn immediately to the LEFT of the anchor text.
                 Use for checkboxes and radio options that should be selected.
                 The anchor must be the OPTION text ("New Building", "Yes"), NOT the group label.

For "check": set value to "Yes" when this option should be marked, "" when not.
Only return a "check" entry for options that SHOULD be marked — omit unchecked options.

Rules:
- Only include fields where PROJECT DATA has a relevant value, or a checkbox must be checked.
- Never invent data. Only use values from PROJECT DATA.
- Format dates as MM/DD/YYYY.
- anchorId must be an ID that appears exactly in FORM LAYOUT.
- Return at most 80 fields/actions.`;

// Schema for flat-PDF scan: Gemini returns anchor IDs, not coordinates.
const FLAT_RESPONSE_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      key:      { type: Type.STRING },
      label:    { type: Type.STRING },
      value:    { type: Type.STRING },
      type:     { type: Type.STRING, enum: ["text", "date", "checkbox"] },
      anchorId: { type: Type.STRING },
      drawMode: { type: Type.STRING, enum: ["fill", "fill_below", "check"] },
    },
    required: ["key", "label", "value", "type", "anchorId", "drawMode"],
    propertyOrdering: ["key", "label", "value", "type", "anchorId", "drawMode"],
  },
};

// ── pdfjs text extraction ──────────────────────────────────────────────────

// Extract every text item from every page. Uses pdfjs-dist (dynamic import so
// webpack doesn't try to bundle the ESM-only legacy build).
export async function extractTextLayout(buffer: Buffer): Promise<TextLayoutItem[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfjs: any = await import(
    /* webpackIgnore: true */
    "pdfjs-dist/legacy/build/pdf.min.mjs" as string
  );
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(buffer), verbosity: 0 }).promise;

  const items: TextLayoutItem[] = [];
  for (let pg = 0; pg < pdf.numPages; pg++) {
    const page = await pdf.getPage(pg + 1);
    const content = await page.getTextContent();
    let idx = 0;
    for (const item of content.items) {
      if (!("str" in item) || !item.str.trim()) continue;
      items.push({
        id: `p${pg}_i${idx++}`,
        pageIndex: pg,
        text: item.str.trim(),
        x: item.transform[4],
        y: item.transform[5],
        width: Math.max(0, item.width),
      });
    }
  }
  return items;
}

// Build the compact text representation sent to Gemini. Filters out long
// instruction paragraphs (width > 200) so the prompt stays focused on labels
// and options only.
function formatTextLayout(items: TextLayoutItem[]): string {
  const LABEL_WIDTH_LIMIT = 200;
  const filtered = items.filter((i) => i.width <= LABEL_WIDTH_LIMIT && i.text.length >= 2);

  const byPage = new Map<number, TextLayoutItem[]>();
  for (const item of filtered) {
    const list = byPage.get(item.pageIndex) ?? [];
    list.push(item);
    byPage.set(item.pageIndex, list);
  }

  const lines: string[] = [];
  for (const [pg, pageItems] of [...byPage.entries()].sort((a, b) => a[0] - b[0])) {
    lines.push(`--- Page ${pg + 1} (y=0 is bottom, y=792 is top of letter page) ---`);
    for (const item of pageItems.sort((a, b) => b.y - a.y || a.x - b.x)) {
      lines.push(`  ${item.id}  y=${item.y.toFixed(0)}  x=${item.x.toFixed(0)}  w=${item.width.toFixed(0)}  "${item.text}"`);
    }
  }
  return lines.join("\n");
}

// Convert anchorId + drawMode → normalized draw position stored on PermitField.
// drawX / drawY are in pdf-lib space (bottom-left origin, 0–1 normalized).
function resolveDrawPosition(
  anchorId: string,
  drawMode: "fill" | "fill_below" | "check",
  items: TextLayoutItem[],
  pageWidths: number[],
  pageHeights: number[],
): { drawX: number; drawY: number; pageIndex: number } | null {
  const item = items.find((i) => i.id === anchorId);
  if (!item) return null;

  const pageW = pageWidths[item.pageIndex] ?? 612;
  const pageH = pageHeights[item.pageIndex] ?? 792;
  const PADDING = 4;
  const CHECK_OFFSET = 12;

  let x: number;
  let y: number;

  if (drawMode === "fill") {
    // Right of label, same baseline.
    x = item.x + item.width + PADDING;
    y = item.y;
  } else if (drawMode === "fill_below") {
    // First line below the label.
    x = item.x;
    y = item.y - 12;
  } else {
    // "check" — just to the left of the option text.
    x = item.x - CHECK_OFFSET;
    y = item.y;
  }

  return {
    drawX: Math.max(0, Math.min(1, x / pageW)),
    drawY: Math.max(0, Math.min(1, y / pageH)),
    pageIndex: item.pageIndex,
  };
}

// ── Field normalization ────────────────────────────────────────────────────

// Accepts Gemini's native box array [ymin, xmin, ymax, xmax] (0–1000 scale)
// or {x1,y1,x2,y2} object; returns normalized 0–1 top-left-origin BoundingBox.
function parseBoundingBox(raw: unknown): BoundingBox | undefined {
  let ymin: number, xmin: number, ymax: number, xmax: number;

  if (Array.isArray(raw) && raw.length >= 4) {
    const n = raw.slice(0, 4).map(Number);
    if (!n.every((v) => Number.isFinite(v))) return undefined;
    [ymin, xmin, ymax, xmax] = n;
  } else if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    const vals = [o.y1, o.x1, o.y2, o.x2].map(Number);
    if (!vals.every((v) => Number.isFinite(v))) return undefined;
    [ymin, xmin, ymax, xmax] = vals;
  } else {
    return undefined;
  }

  const maxVal = Math.max(Math.abs(ymin), Math.abs(xmin), Math.abs(ymax), Math.abs(xmax));
  const divisor = maxVal > 1 ? 1000 : 1;
  const clamp = (v: number) => Math.max(0, Math.min(1, v / divisor));

  const x1 = clamp(Math.min(xmin, xmax));
  const y1 = clamp(Math.min(ymin, ymax));
  const x2 = clamp(Math.max(xmin, xmax));
  const y2 = clamp(Math.max(ymin, ymax));

  return x2 > x1 && y2 > y1 ? { x1, y1, x2, y2 } : undefined;
}

export function normalizePermitFields(input: unknown): PermitField[] {
  let arr: unknown = input;
  if (
    !Array.isArray(arr) &&
    arr &&
    typeof arr === "object" &&
    Array.isArray((arr as { fields?: unknown }).fields)
  ) {
    arr = (arr as { fields: unknown[] }).fields;
  }
  if (!Array.isArray(arr)) return [];

  const seen = new Set<string>();
  const out: PermitField[] = [];

  for (let i = 0; i < arr.length && out.length < MAX_FIELDS; i++) {
    const raw = (arr[i] ?? {}) as Record<string, unknown>;
    const label = String(raw.label ?? raw.key ?? "").trim().slice(0, 250);
    if (!label) continue;

    let baseKey = String(raw.key ?? "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
    if (!baseKey) baseKey = `field_${i + 1}`;

    let key = baseKey;
    let n = 2;
    while (seen.has(key)) {
      key = `${baseKey}_${n}`;
      n++;
    }
    seen.add(key);

    const typeRaw = String(raw.type ?? "text") as PermitFieldType;
    const type: PermitFieldType = FIELD_TYPES.includes(typeRaw) ? typeRaw : "text";
    const acroField =
      typeof raw.acroField === "string" && raw.acroField.trim() ? raw.acroField : null;
    const value = String(raw.value ?? "").slice(0, 5000);

    const pageIndex =
      typeof raw.pageIndex === "number" && raw.pageIndex >= 0
        ? Math.floor(raw.pageIndex)
        : undefined;

    const boundingBox = parseBoundingBox(raw.box ?? raw.boundingBox);

    // Pass-through draw coordinates from flat-PDF path (already resolved).
    const drawX =
      typeof raw.drawX === "number" ? Math.max(0, Math.min(1, raw.drawX)) : undefined;
    const drawY =
      typeof raw.drawY === "number" ? Math.max(0, Math.min(1, raw.drawY)) : undefined;
    const rawMode = raw.drawMode;
    const drawMode =
      rawMode === "fill" || rawMode === "fill_below" || rawMode === "check"
        ? (rawMode as "fill" | "fill_below" | "check")
        : undefined;

    out.push({ key, label, value, acroField, type, pageIndex, boundingBox, drawX, drawY, drawMode });
  }

  return out;
}

// ── AcroForm inspection ────────────────────────────────────────────────────

export async function extractAcroFields(sourceBuffer: Buffer): Promise<AcroFieldInfo[]> {
  try {
    const doc = await PDFDocument.load(sourceBuffer, { ignoreEncryption: true });
    const form = doc.getForm();
    const out: AcroFieldInfo[] = [];
    for (const field of form.getFields()) {
      if (out.length >= 250) break;
      let type = "field";
      if (field instanceof PDFTextField)  type = "text";
      else if (field instanceof PDFCheckBox)  type = "checkbox";
      else if (field instanceof PDFDropdown)  type = "dropdown";
      else if (field instanceof PDFRadioGroup) type = "radio";
      else if (field instanceof PDFOptionList) type = "optionlist";
      out.push({ name: field.getName(), type });
    }
    return out;
  } catch {
    return [];
  }
}

// ── Gemini scan ────────────────────────────────────────────────────────────

export async function scanPermitApplication(
  sourceBuffer: Buffer,
  filename: string,
  acroFields: AcroFieldInfo[],
  context: PermitProjectContext,
): Promise<PermitField[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("AI service is not configured (missing GEMINI_API_KEY).");
  }

  const ai = new GoogleGenAI({ apiKey });
  const isFlat = acroFields.length === 0;

  // ── Flat PDF: text-layout path ───────────────────────────────────────────
  if (isFlat) {
    // Stage 1: extract text + positions (deterministic, no AI).
    const textItems = await extractTextLayout(sourceBuffer);
    if (textItems.length === 0) {
      throw new Error("Could not extract any text from the PDF. The document may be image-only.");
    }

    // Get page dimensions for coordinate normalisation.
    const pdfDoc = await PDFDocument.load(sourceBuffer, { ignoreEncryption: true });
    const pages = pdfDoc.getPages();
    const pageWidths  = pages.map((p) => p.getWidth());
    const pageHeights = pages.map((p) => p.getHeight());

    // Stage 2: Gemini does semantic mapping only (receives text layout, not PDF).
    const layoutText = formatTextLayout(textItems);
    const promptText = `FORM LAYOUT:\n${layoutText}\n\nPROJECT DATA:\n\`\`\`json\n${JSON.stringify(context, null, 2)}\n\`\`\`\n\nReturn the JSON array of fill actions.`;

    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: promptText }] }],
      config: {
        systemInstruction: SCAN_SYSTEM_INSTRUCTION_FLAT,
        responseMimeType: "application/json",
        responseSchema: FLAT_RESPONSE_SCHEMA,
      },
    });

    const rawText = (result.text ?? "").trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "");

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      throw new Error("Could not read the AI response while scanning the permit.");
    }

    // Stage 3 prep: resolve anchorId → draw coordinates, then normalise.
    const rawArr = Array.isArray(parsed) ? parsed : [];
    const fields: PermitField[] = [];
    const seenKeys = new Set<string>();

    for (const raw of rawArr) {
      if (!raw || typeof raw !== "object") continue;
      const r = raw as Record<string, unknown>;

      const label = String(r.label ?? r.key ?? "").trim().slice(0, 250);
      if (!label) continue;

      let baseKey = String(r.key ?? "").trim().toLowerCase()
        .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
      if (!baseKey) baseKey = `field_${fields.length + 1}`;
      let key = baseKey;
      let n = 2;
      while (seenKeys.has(key)) { key = `${baseKey}_${n}`; n++; }
      seenKeys.add(key);

      const typeRaw = String(r.type ?? "text");
      const type: PermitFieldType = FIELD_TYPES.includes(typeRaw as PermitFieldType)
        ? (typeRaw as PermitFieldType) : "text";
      const value = String(r.value ?? "").slice(0, 5000);
      const anchorId = String(r.anchorId ?? "");
      const rawMode = r.drawMode;
      const drawMode: "fill" | "fill_below" | "check" =
        rawMode === "fill_below" ? "fill_below"
        : rawMode === "check"    ? "check"
        : "fill";

      // Resolve anchor → draw coordinates.
      const pos = resolveDrawPosition(anchorId, drawMode, textItems, pageWidths, pageHeights);
      if (!pos) continue; // skip fields whose anchor ID wasn't found

      fields.push({
        key,
        label,
        value,
        acroField: null,
        type,
        pageIndex: pos.pageIndex,
        drawX: pos.drawX,
        drawY: pos.drawY,
        drawMode,
      });

      if (fields.length >= MAX_FIELDS) break;
    }

    if (fields.length === 0) {
      throw new Error("The AI did not detect any fillable fields in this PDF.");
    }

    return fields;
  }

  // ── AcroForm PDF: vision path ────────────────────────────────────────────
  const pdfBase64 = sourceBuffer.toString("base64");
  const acroList = acroFields.map((a) => `- ${a.name} (${a.type})`).join("\n");
  const promptText = `PROJECT DATA:\n\`\`\`json\n${JSON.stringify(context, null, 2)}\n\`\`\`\n\nACROFORM FIELDS:\n${acroList}\n\nScan this permit application PDF and return the JSON array of fields.`;

  const result = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      {
        role: "user",
        parts: [
          { text: promptText },
          { inlineData: { mimeType: "application/pdf", data: pdfBase64 } },
        ],
      },
    ],
    config: {
      systemInstruction: SCAN_SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
    },
  });

  const raw = (result.text ?? "").trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");

  let parsed: unknown;
  try { parsed = JSON.parse(raw); }
  catch { throw new Error("Could not read the AI response while scanning the permit."); }

  const acroSet = new Set(acroFields.map((a) => a.name));
  const fields = normalizePermitFields(parsed).map((f) => ({
    ...f,
    acroField: f.acroField && acroSet.has(f.acroField) ? f.acroField : null,
  }));

  if (fields.length === 0) {
    throw new Error("The AI did not detect any fillable fields in this PDF.");
  }

  return fields;
}

// ── PDF filling ────────────────────────────────────────────────────────────

function isTruthy(value: string): boolean {
  return ["yes", "y", "true", "1", "x", "checked", "on"].includes(value.trim().toLowerCase());
}

// pdf-lib StandardFonts use WinAnsi encoding. Normalize typographic characters
// and strip anything outside 0x20–0xFF.
function sanitizeForPdf(value: string): string {
  return (value ?? "")
    .replace(/[''‚‛]/g, "'")
    .replace(/[""„‟]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/[•·]/g, "-")
    .replace(/\t/g, "  ")
    // eslint-disable-next-line no-control-regex
    .replace(/[^\x0A\x0D\x20-\xFF]/g, "");
}

function applyAcroField(form: PDFForm, name: string, value: string): boolean {
  const text = sanitizeForPdf(value);
  try {
    const tf = form.getTextField(name);
    if (text.includes("\n")) { try { tf.enableMultiline(); } catch { /* ok */ } }
    tf.setText(text);
    return true;
  } catch { /* not a text field */ }
  try {
    const cb = form.getCheckBox(name);
    if (isTruthy(value)) cb.check(); else cb.uncheck();
    return true;
  } catch { /* not a checkbox */ }
  try { form.getDropdown(name).select(text); return true; } catch { /* not a dropdown */ }
  try { form.getRadioGroup(name).select(text); return true; } catch { /* not a radio */ }
  try { form.getOptionList(name).select(text); return true; } catch { /* not an option list */ }
  return false;
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const paragraphs = sanitizeForPdf(text).replace(/\r/g, "").split("\n");
  const lines: string[] = [];
  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) { lines.push(""); continue; }
    let current = "";
    for (const word of words) {
      const trial = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(trial, size) <= maxWidth) { current = trial; continue; }
      if (current) lines.push(current);
      if (font.widthOfTextAtSize(word, size) > maxWidth) {
        let chunk = "";
        for (const ch of word) {
          if (font.widthOfTextAtSize(chunk + ch, size) <= maxWidth) { chunk += ch; }
          else { if (chunk) lines.push(chunk); chunk = ch; }
        }
        current = chunk;
      } else { current = word; }
    }
    if (current) lines.push(current);
  }
  return lines.length > 0 ? lines : [""];
}

async function appendSummaryPages(
  pdfDoc: PDFDocument,
  title: string,
  items: PermitField[],
): Promise<void> {
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const PAGE_W = 612, PAGE_H = 792, MARGIN = 56;
  const contentW = PAGE_W - MARGIN * 2;

  let page = pdfDoc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  page.drawText("Permit Application", { x: MARGIN, y, size: 18, font: bold });
  y -= 22;
  if (title.trim()) {
    page.drawText(sanitizeForPdf(title.trim()).slice(0, 120), { x: MARGIN, y, size: 12, font, color: rgb(0.25, 0.25, 0.25) });
    y -= 18;
  }
  page.drawText("Completed responses", { x: MARGIN, y, size: 9, font, color: rgb(0.5, 0.5, 0.5) });
  y -= 26;

  for (const item of items) {
    const labelLines = wrapText(item.label || "Field", bold, 10, contentW);
    const valueLines = wrapText(item.value || "-", font, 11, contentW);
    const blockHeight = labelLines.length * 13 + valueLines.length * 14 + 14;
    if (y - blockHeight < MARGIN) { page = pdfDoc.addPage([PAGE_W, PAGE_H]); y = PAGE_H - MARGIN; }
    for (const line of labelLines) {
      page.drawText(line, { x: MARGIN, y, size: 10, font: bold, color: rgb(0.35, 0.35, 0.35) });
      y -= 13;
    }
    y -= 2;
    for (const line of valueLines) {
      page.drawText(line, { x: MARGIN, y, size: 11, font, color: rgb(0, 0, 0) });
      y -= 14;
    }
    y -= 12;
  }
}

export async function fillPermitApplication(
  sourceBuffer: Buffer,
  fields: PermitField[],
  title: string,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(sourceBuffer, { ignoreEncryption: true });
  const originalPages = pdfDoc.getPages(); // capture before appendSummaryPages adds pages

  let form: PDFForm | null = null;
  const acroNames = new Set<string>();
  try {
    form = pdfDoc.getForm();
    for (const field of form.getFields()) acroNames.add(field.getName());
  } catch { form = null; }

  const applied = new Set<string>();

  // Phase 1 — fill interactive AcroForm fields and flatten.
  if (form && acroNames.size > 0) {
    for (const field of fields) {
      if (!field.acroField || !field.value.trim() || !acroNames.has(field.acroField)) continue;
      if (applyAcroField(form, field.acroField, field.value)) applied.add(field.key);
    }
    try { form.flatten(); }
    catch { try { form.updateFieldAppearances(); } catch { /* ok */ } }
  }

  const overlaid = new Set<string>();

  // Phase 2a — text-layout overlay (flat PDFs, preferred path).
  // drawX / drawY are in pdf-lib space (bottom-left origin, normalized 0–1).
  const FONT_SIZE = 9.5;
  const withDraw = fields.filter(
    (f) => !applied.has(f.key) && f.value.trim() && f.drawX !== undefined && f.drawY !== undefined && f.pageIndex !== undefined,
  );

  if (withDraw.length > 0) {
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    for (const field of withDraw) {
      const page = originalPages[field.pageIndex!];
      if (!page) continue;

      const { width: W, height: H } = page.getSize();
      const x = field.drawX! * W;
      const y = field.drawY! * H;

      if (field.drawMode === "check") {
        if (isTruthy(field.value)) {
          page.drawText("X", { x, y, size: FONT_SIZE, font, color: rgb(0, 0, 0) });
        }
      } else if (field.drawMode === "fill_below") {
        const sanitized = sanitizeForPdf(field.value).trim();
        if (!sanitized) continue;
        const maxW = W - x - 40;
        const lines = wrapText(sanitized, font, FONT_SIZE, maxW > 10 ? maxW : 200);
        let lineY = y;
        for (const line of lines) {
          if (line.trim()) page.drawText(line, { x, y: lineY, size: FONT_SIZE, font, color: rgb(0, 0, 0) });
          lineY -= FONT_SIZE * 1.4;
          if (lineY < 36) break;
        }
      } else {
        // "fill" — single line to the right of the label
        const sanitized = sanitizeForPdf(field.value).replace(/\n/g, " ").trim();
        if (!sanitized) continue;
        const maxW = W - x - 36;
        let text = sanitized;
        while (text.length > 1 && font.widthOfTextAtSize(text, FONT_SIZE) > maxW) {
          text = text.slice(0, -1);
        }
        if (text.trim()) page.drawText(text, { x, y, size: FONT_SIZE, font, color: rgb(0, 0, 0) });
      }

      overlaid.add(field.key);
    }
  }

  // Phase 2b — legacy bounding-box overlay (fallback for Gemini-vision fields).
  const withBox = fields.filter(
    (f) => !applied.has(f.key) && !overlaid.has(f.key) && f.value.trim() && f.boundingBox && f.pageIndex !== undefined,
  );

  if (withBox.length > 0) {
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    for (const field of withBox) {
      const page = originalPages[field.pageIndex!];
      if (!page) continue;
      const { width: W, height: H } = page.getSize();
      const { x1, y1, x2, y2 } = field.boundingBox!;
      const bW = (x2 - x1) * W;
      const bH = (y2 - y1) * H;
      const bLeft = x1 * W;
      const bBottom = H - y2 * H;

      if (field.type === "checkbox") {
        if (isTruthy(field.value)) {
          const sz = Math.min(13, Math.max(8, bH * 0.9));
          page.drawText("X", { x: bLeft + bW / 2 - sz * 0.3, y: bBottom + bH / 2 - sz * 0.35, size: sz, font, color: rgb(0, 0, 0) });
        }
      } else {
        const sanitized = sanitizeForPdf(field.value).replace(/\r/g, "").trim();
        if (!sanitized) continue;
        const sz = field.type === "multiline" ? Math.min(10, Math.max(8, bH * 0.3)) : Math.min(10.5, Math.max(8, bH * 0.7));
        if (field.type === "multiline") {
          const lineH = sz * 1.3;
          const lines = wrapText(sanitized, font, sz, bW - 4);
          let lineY = bBottom + bH - sz - 2;
          for (const line of lines) {
            if (lineY < bBottom) break;
            if (line.trim()) page.drawText(line, { x: bLeft + 2, y: lineY, size: sz, font, color: rgb(0, 0, 0) });
            lineY -= lineH;
          }
        } else {
          let text = sanitized.split("\n")[0].trim();
          while (text.length > 1 && font.widthOfTextAtSize(text, sz) > bW - 4) text = text.slice(0, -1);
          if (text.trim()) page.drawText(text, { x: bLeft + 2, y: bBottom + bH * 0.18, size: sz, font, color: rgb(0, 0, 0) });
        }
      }
      overlaid.add(field.key);
    }
  }

  // Phase 3 — summary page fallback for anything still not placed.
  const leftovers = fields.filter(
    (f) => f.value.trim() && !applied.has(f.key) && !overlaid.has(f.key),
  );
  if (leftovers.length > 0) {
    await appendSummaryPages(pdfDoc, title, leftovers);
  }

  return pdfDoc.save();
}
