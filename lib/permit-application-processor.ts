// Server-side Permit Application processor.
//
// Takes an uploaded blank permit application PDF, uses Gemini to detect
// every fillable field and propose a value for each from project data,
// and — once the user has reviewed/edited the values — fills the PDF.
// When the PDF has interactive AcroForm fields the values are written
// into them and the form is flattened; otherwise the reviewed answers
// are appended as a formatted summary page.

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

export type PermitFieldType = "text" | "multiline" | "checkbox" | "date";

export type BoundingBox = { x1: number; y1: number; x2: number; y2: number };

export type PermitField = {
  key: string;
  label: string;
  value: string;
  acroField: string | null;
  type: PermitFieldType;
  // Flat-form overlay coordinates (top-left origin, normalized 0–1).
  pageIndex?: number;
  boundingBox?: BoundingBox;
};

export type AcroFieldInfo = { name: string; type: string };

export type PermitProjectContext = Record<string, unknown>;

const FIELD_TYPES: PermitFieldType[] = ["text", "multiline", "checkbox", "date"];
const MAX_FIELDS = 150;

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
- When ACROFORM FIELDS is non-empty, map each form field to exactly one acroField name by reading the form layout to understand what each technical name represents. Never reuse an acroField for two fields. If you genuinely cannot map one, use null.
- When ACROFORM FIELDS is empty, set acroField to null for every field.
- Never invent data. Only use values supported by PROJECT DATA.
- Format dates as MM/DD/YYYY.
- For checkboxes, "value" is "Yes" when the box should be checked, otherwise "".
- Use "multiline" for long free-text fields (scope, description), "text" for short ones.
- Keep the fields in the order they appear on the form. Return at most 120 fields.`;

// Used for flat/scanned PDFs — same rules plus bounding-box coordinates so
// values can be drawn directly on the original pages instead of a summary page.
const SCAN_SYSTEM_INSTRUCTION_FLAT = `You are an expert assistant that fills out construction permit application forms.

You receive:
1. A permit application PDF that has NO interactive form fields (a flat or scanned form).
2. A JSON object of known project data ("PROJECT DATA").

Your job:
- Identify EVERY field on the form that an applicant is expected to fill in.
- For each field, supply the best value you can justify from PROJECT DATA. If the data does not clearly support an answer, leave the value as an empty string.
- Locate the EXACT spot on the page where the answer must be written.

Return a JSON array of field objects. Each element:
{
  "key": short snake_case identifier, e.g. "applicant_name",
  "label": the field's printed label, exactly as a person reads it,
  "value": best value from PROJECT DATA, or "" if unknown,
  "type": "text" | "multiline" | "checkbox" | "date",
  "pageIndex": 0-based index of the page the field is on,
  "box": [ymin, xmin, ymax, xmax]
}

The "box" gives the location of the EMPTY SPACE where the answer goes — the
blank line, the write-in box, or the checkbox square — NOT the printed label.
Each number is an integer from 0 to 1000, normalized to the page that
"pageIndex" names:
- ymin = top edge, ymax = bottom edge (0 = top of page, 1000 = bottom).
- xmin = left edge, xmax = right edge (0 = left of page, 1000 = right).
Always return all four numbers in the order [ymin, xmin, ymax, xmax].

Guidance for "box":
- Blank underline ("Name: ______"): the box is the underline region itself,
  starting just to the right of the label.
- Write-in rectangle: the box is the full rectangle.
- Checkbox / circle: the box is the small square or circle that gets ticked.
- Multi-line area (scope, description): the box is the whole writing region.

Rules:
- Include every fillable field, even ones you cannot answer (use value "").
- Never invent data. Only use values supported by PROJECT DATA.
- Format dates as MM/DD/YYYY.
- For checkboxes, "value" is "Yes" when the box should be ticked, otherwise "".
- Use "multiline" for long free-text fields (scope, description), "text" for short ones.
- Keep the fields in the order they appear on the form. Return at most 120 fields.`;

// Structured-output schema for flat PDFs — forces Gemini to return a "box"
// for every field so values can be overlaid instead of dumped to a summary page.
const FLAT_RESPONSE_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      key: { type: Type.STRING },
      label: { type: Type.STRING },
      value: { type: Type.STRING },
      type: { type: Type.STRING, enum: ["text", "multiline", "checkbox", "date"] },
      pageIndex: { type: Type.INTEGER },
      box: { type: Type.ARRAY, items: { type: Type.NUMBER } },
    },
    required: ["key", "label", "value", "type", "pageIndex", "box"],
    propertyOrdering: ["key", "label", "value", "type", "pageIndex", "box"],
  },
};

// ── Field normalization ────────────────────────────────────────────────────

// Accepts Gemini's native box array [ymin, xmin, ymax, xmax] (0–1000 scale,
// the format the vision model is trained on) or a {x1,y1,x2,y2} object, and
// returns a normalized 0–1 top-left-origin BoundingBox.
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

  // Gemini returns 0–1000; tolerate a 0–1 response too.
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

    out.push({ key, label, value, acroField, type, pageIndex, boundingBox });
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
      if (field instanceof PDFTextField) type = "text";
      else if (field instanceof PDFCheckBox) type = "checkbox";
      else if (field instanceof PDFDropdown) type = "dropdown";
      else if (field instanceof PDFRadioGroup) type = "radio";
      else if (field instanceof PDFOptionList) type = "optionlist";
      out.push({ name: field.getName(), type });
    }
    return out;
  } catch {
    // No AcroForm, or the PDF could not be parsed for form fields.
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

  // Pass the PDF as inline base64 data to avoid the Files API upload round-trip.
  const pdfBase64 = sourceBuffer.toString("base64");

  const isFlat = acroFields.length === 0;

  const acroList = isFlat
    ? "(none — this PDF has no interactive form fields)"
    : acroFields.map((a) => `- ${a.name} (${a.type})`).join("\n");

  const promptText = isFlat
    ? `PROJECT DATA:\n\`\`\`json\n${JSON.stringify(context, null, 2)}\n\`\`\`\n\nScan this flat permit application PDF. Return the JSON array of fields. For EVERY field include "pageIndex" and a "box" of [ymin, xmin, ymax, xmax] (integers 0-1000) locating the blank space where the answer is written.`
    : `PROJECT DATA:\n\`\`\`json\n${JSON.stringify(context, null, 2)}\n\`\`\`\n\nACROFORM FIELDS:\n${acroList}\n\nScan this permit application PDF and return the JSON array of fields.`;

  const config: Record<string, unknown> = {
    systemInstruction: isFlat ? SCAN_SYSTEM_INSTRUCTION_FLAT : SCAN_SYSTEM_INSTRUCTION,
    responseMimeType: "application/json",
  };
  if (isFlat) {
    config.responseSchema = FLAT_RESPONSE_SCHEMA;
  }

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
    config,
  });

  const raw = (result.text ?? "")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Could not read the AI response while scanning the permit.");
  }

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

// pdf-lib's StandardFonts use WinAnsi encoding; characters outside it make
// drawText throw. Normalize common typographic characters and drop the rest.
function sanitizeForPdf(value: string): string {
  return (value ?? "")
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„‟]/g, '"')
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
    if (text.includes("\n")) {
      try {
        tf.enableMultiline();
      } catch {
        /* field may not support it */
      }
    }
    tf.setText(text);
    return true;
  } catch {
    /* not a text field */
  }
  try {
    const cb = form.getCheckBox(name);
    if (isTruthy(value)) cb.check();
    else cb.uncheck();
    return true;
  } catch {
    /* not a checkbox */
  }
  try {
    form.getDropdown(name).select(text);
    return true;
  } catch {
    /* not a dropdown, or value not an option */
  }
  try {
    form.getRadioGroup(name).select(text);
    return true;
  } catch {
    /* not a radio group, or value not an option */
  }
  try {
    form.getOptionList(name).select(text);
    return true;
  } catch {
    /* not an option list */
  }
  return false;
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const paragraphs = sanitizeForPdf(text).replace(/\r/g, "").split("\n");
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }
    let current = "";
    for (const word of words) {
      const trial = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(trial, size) <= maxWidth) {
        current = trial;
        continue;
      }
      if (current) lines.push(current);
      if (font.widthOfTextAtSize(word, size) > maxWidth) {
        // Hard-break a single word that is wider than the line.
        let chunk = "";
        for (const ch of word) {
          if (font.widthOfTextAtSize(chunk + ch, size) <= maxWidth) {
            chunk += ch;
          } else {
            if (chunk) lines.push(chunk);
            chunk = ch;
          }
        }
        current = chunk;
      } else {
        current = word;
      }
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

  const PAGE_W = 612;
  const PAGE_H = 792;
  const MARGIN = 56;
  const contentW = PAGE_W - MARGIN * 2;

  let page = pdfDoc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  page.drawText("Permit Application", { x: MARGIN, y, size: 18, font: bold });
  y -= 22;
  if (title.trim()) {
    page.drawText(sanitizeForPdf(title.trim()).slice(0, 120), {
      x: MARGIN,
      y,
      size: 12,
      font,
      color: rgb(0.25, 0.25, 0.25),
    });
    y -= 18;
  }
  page.drawText("Completed responses", {
    x: MARGIN,
    y,
    size: 9,
    font,
    color: rgb(0.5, 0.5, 0.5),
  });
  y -= 26;

  for (const item of items) {
    const labelLines = wrapText(item.label || "Field", bold, 10, contentW);
    const valueLines = wrapText(item.value || "-", font, 11, contentW);
    const blockHeight = labelLines.length * 13 + valueLines.length * 14 + 14;

    if (y - blockHeight < MARGIN) {
      page = pdfDoc.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
    }

    for (const line of labelLines) {
      page.drawText(line, {
        x: MARGIN,
        y,
        size: 10,
        font: bold,
        color: rgb(0.35, 0.35, 0.35),
      });
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
  // Capture original pages before appendSummaryPages adds new ones.
  const originalPages = pdfDoc.getPages();

  let form: PDFForm | null = null;
  const acroNames = new Set<string>();
  try {
    form = pdfDoc.getForm();
    for (const field of form.getFields()) acroNames.add(field.getName());
  } catch {
    form = null;
  }

  const applied = new Set<string>();

  // Phase 1 — fill interactive AcroForm fields and flatten.
  if (form && acroNames.size > 0) {
    for (const field of fields) {
      if (!field.acroField || !field.value.trim() || !acroNames.has(field.acroField)) {
        continue;
      }
      if (applyAcroField(form, field.acroField, field.value)) {
        applied.add(field.key);
      }
    }
    try {
      form.flatten();
    } catch {
      try {
        form.updateFieldAppearances();
      } catch {
        /* values may still render via the viewer's default appearance */
      }
    }
  }

  // Phase 2 — draw text/marks directly on original pages using bounding-box
  // coordinates returned by Gemini for flat (non-AcroForm) PDFs.
  const overlaid = new Set<string>();
  const withCoords = fields.filter(
    (f) =>
      !applied.has(f.key) &&
      f.value.trim() &&
      f.boundingBox !== undefined &&
      f.pageIndex !== undefined,
  );

  if (withCoords.length > 0) {
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    for (const field of withCoords) {
      const page = originalPages[field.pageIndex!];
      if (!page) continue;

      const { width: pageWidth, height: pageHeight } = page.getSize();
      const { x1, y1, x2, y2 } = field.boundingBox!;

      const boxWidthPts = (x2 - x1) * pageWidth;
      const boxHeightPts = (y2 - y1) * pageHeight;
      // Gemini coords: top-left origin, y increases down.
      // pdf-lib coords: bottom-left origin, y increases up.
      // y2 is the bottom of the box in image space → PDF bottom = pageHeight - y2*pageHeight.
      const pdfBoxBottom = pageHeight - y2 * pageHeight;
      const pdfBoxLeft = x1 * pageWidth;

      if (field.type === "checkbox") {
        if (isTruthy(field.value)) {
          const fontSize = Math.min(13, Math.max(8, boxHeightPts * 0.9));
          // Center the X inside the checkbox square.
          const cx = pdfBoxLeft + boxWidthPts / 2 - (fontSize * 0.3);
          const cy = pdfBoxBottom + boxHeightPts / 2 - (fontSize * 0.35);
          page.drawText("X", { x: cx, y: cy, size: fontSize, font, color: rgb(0, 0, 0) });
        }
      } else {
        const sanitized = sanitizeForPdf(field.value).replace(/\r/g, "").trim();
        if (!sanitized) continue;

        // Keep overlaid text at a legible size — a blank underline often has a
        // very short box, so don't let height alone shrink the text too far.
        const fontSize =
          field.type === "multiline"
            ? Math.min(10, Math.max(8, boxHeightPts * 0.3))
            : Math.min(10.5, Math.max(8, boxHeightPts * 0.7));
        const drawX = pdfBoxLeft + 2;
        // Position text baseline slightly above the bottom of the box.
        const drawY = pdfBoxBottom + boxHeightPts * 0.18;
        const maxW = boxWidthPts - 4;

        if (field.type === "multiline") {
          // Wrap text within the box; stop adding lines when they'd overflow.
          const lineH = fontSize * 1.3;
          const lines = wrapText(sanitized, font, fontSize, maxW);
          let lineY = pdfBoxBottom + boxHeightPts - fontSize - 2;
          for (const line of lines) {
            if (lineY < pdfBoxBottom) break;
            if (line.trim()) {
              page.drawText(line, { x: drawX, y: lineY, size: fontSize, font, color: rgb(0, 0, 0) });
            }
            lineY -= lineH;
          }
        } else {
          // Single-line: truncate text to fit the box width.
          let text = sanitized.split("\n")[0].trim();
          while (text.length > 1 && font.widthOfTextAtSize(text, fontSize) > maxW) {
            text = text.slice(0, -1);
          }
          if (text.trim()) {
            page.drawText(text, { x: drawX, y: drawY, size: fontSize, font, color: rgb(0, 0, 0) });
          }
        }
      }

      overlaid.add(field.key);
    }
  }

  // Phase 3 — anything not yet handled (no acroField, no coordinates, or
  // coordinates that pointed to a non-existent page) goes on a summary page.
  const leftovers = fields.filter(
    (f) => f.value.trim() && !applied.has(f.key) && !overlaid.has(f.key),
  );
  if (leftovers.length > 0) {
    await appendSummaryPages(pdfDoc, title, leftovers);
  }

  return pdfDoc.save();
}
