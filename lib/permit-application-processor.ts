// Server-side Permit Application processor.
//
// AcroForm PDFs:
//   1. extractAcroFormPlacements — enumerate every form field's widget rect (pdf-lib)
//   2. Gemini — fill values keyed by field number, with the PDF as visual context
//   3. fillPermitApplication — write values into AcroForm, flatten (pdf-lib)
//
// Flat / scanned PDFs:
//   1. extractTextLayout — extract all text + coordinates (pdfjs-dist)
//   2. Gemini — return (fieldNum, value, drawMode) keyed off a numbered text list
//   3. fillPermitApplication — draw text/marks at computed positions (pdf-lib)
//
// Either path produces PermitField[] where every field has a position on the
// PDF, so the in-PDF editor can render an editable yellow box for each one.

import { GoogleGenAI, Type } from "@google/genai";
import {
  PDFDocument,
  PDFTextField,
  PDFCheckBox,
  PDFDropdown,
  PDFRadioGroup,
  PDFOptionList,
  PDFName,
  PDFArray,
  PDFDict,
  PDFNumber,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFForm,
} from "pdf-lib";

// ── Types ──────────────────────────────────────────────────────────────────

export type PermitFieldType = "text" | "multiline" | "checkbox" | "date";

// Normalized 0–1 rectangle, top-left origin (used by the in-PDF editor to
// position an editable box over an AcroForm widget).
export type FieldRect = { page: number; x: number; y: number; w: number; h: number };

export type PermitField = {
  key: string;
  label: string;
  value: string;
  acroField: string | null;
  type: PermitFieldType;
  pageIndex?: number;

  // Flat-PDF overlay: text-layout coordinates from the flat scan path. Values
  // are normalized 0–1 in pdf-lib space (bottom-left origin, y increases up).
  drawX?: number;
  drawY?: number;
  drawW?: number;
  drawMode?: "fill" | "fill_below" | "check";

  // AcroForm overlay: widget rectangle (normalized, top-left origin). Used by
  // the editor to render an editable box exactly over the form field.
  rect?: FieldRect;
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

const SCAN_SYSTEM_INSTRUCTION = `You are filling out an interactive construction permit application form.

You receive:
1. The permit application PDF (a blank or partially-blank form).
2. PROJECT DATA: a JSON object of known information about the project.
3. FORM FIELDS: a numbered list of the PDF's interactive AcroForm fields:
   Field N | name="<acroname>" | type=<text|checkbox|dropdown|optionlist>

Your task: for every field that should be filled OR checked from PROJECT DATA, return an entry. Look at the PDF visually to understand what each field is asking for (the field name alone is rarely enough).

Return ONLY a JSON array — no markdown fences, no commentary. Each element:
{
  "fieldNum": integer,   // the Field N number — return the exact number
  "label": string,       // a human-readable description of what this field asks for, as a person reads it on the form (e.g. "Applicant Name", "Project Address", "Phone Number")
  "value": string        // value from PROJECT DATA; for checkboxes use "Yes" when it should be checked, otherwise omit the entry
}

Rules:
- Only return entries you can justify from PROJECT DATA. Never invent data.
- Skip fields you cannot fill — do NOT return them with an empty value.
- For checkboxes, only include the entry when it should be checked.
- Format dates as MM/DD/YYYY.
- Each fieldNum may appear at most once.`;

const ACROFORM_RESPONSE_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      fieldNum: { type: Type.INTEGER },
      label:    { type: Type.STRING },
      value:    { type: Type.STRING },
    },
    required: ["fieldNum", "label", "value"],
    propertyOrdering: ["fieldNum", "label", "value"],
  },
};

// Used for flat / scanned PDFs. Gemini receives a numbered list of text items
// and returns (fieldNum, value, drawMode) — no coordinate guessing required.
const SCAN_SYSTEM_INSTRUCTION_FLAT = `You are filling out a flat construction permit application form.

You receive:
1. FORM FIELDS: a numbered list of text items extracted from the form. Each entry shows:
   Field N | page=P y=YYY x=XXX | "text"
2. PROJECT DATA: the values available to fill in.

Your task: for each field that should be filled OR checked, return an instruction.

Return ONLY a JSON array. Each element:
{
  "fieldNum": integer,      // the Field N number from FORM FIELDS — return the exact number
  "label": string,          // the exact text of that field (for display to the user)
  "value": string,          // value from PROJECT DATA; use "Yes" for checkboxes to check
  "drawMode": "fill" | "fill_below" | "check"
}

drawMode meanings:
- "fill"       — value written immediately to the RIGHT of this label on the same line.
                 Use when the label ends with ":" and expects an answer on the same line
                 (e.g. "Email:", "Phone:", "Application Date:", "Project Address:").
- "fill_below" — value written on the line(s) BELOW this label.
                 Use for large text areas or when the label introduces a block of content.
- "check"      — draw an X mark to the LEFT of this item's text.
                 Use ONLY for a checkbox/radio OPTION text that should be selected
                 (e.g. "Standard Review", "New Building", "Yes").
                 Do NOT use "check" on a group header label.

Rules:
- Only return entries where PROJECT DATA supplies a concrete value.
- "check" entries: only include options that SHOULD be marked; omit unchecked options.
- Format dates as MM/DD/YYYY.
- Never invent data not present in PROJECT DATA.
- Return at most 60 entries.`;

// Schema for flat-PDF scan: Gemini returns field numbers (integers), not anchor IDs.
// Field numbers are 1-indexed positions into the sorted candidate list we build locally,
// so there is no risk of the model hallucinating an invalid string ID.
const FLAT_RESPONSE_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      fieldNum: { type: Type.INTEGER },
      label:    { type: Type.STRING },
      value:    { type: Type.STRING },
      drawMode: { type: Type.STRING, enum: ["fill", "fill_below", "check"] },
    },
    required: ["fieldNum", "label", "value", "drawMode"],
    propertyOrdering: ["fieldNum", "label", "value", "drawMode"],
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

// Convert anchorId + drawMode → normalized draw position stored on PermitField.
// drawX / drawY are in pdf-lib space (bottom-left origin, 0–1 normalized).
// drawW is the normalized width of the area available to write into.
function resolveDrawPosition(
  anchorId: string,
  drawMode: "fill" | "fill_below" | "check",
  items: TextLayoutItem[],
  pageWidths: number[],
  pageHeights: number[],
): { drawX: number; drawY: number; drawW: number; pageIndex: number } | null {
  const item = items.find((i) => i.id === anchorId);
  if (!item) return null;

  const pageW = pageWidths[item.pageIndex] ?? 612;
  const pageH = pageHeights[item.pageIndex] ?? 792;
  const PADDING = 4;
  const CHECK_OFFSET = 12;
  const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

  let x: number;
  let y: number;
  let w: number;

  if (drawMode === "fill") {
    // Right of label, same baseline. Width stops before the next text item
    // on the same line so the value never overruns a neighbouring label.
    x = item.x + item.width + PADDING;
    y = item.y;
    let nextX = pageW * 0.97;
    for (const other of items) {
      if (other.pageIndex !== item.pageIndex || other.id === item.id) continue;
      if (Math.abs(other.y - item.y) > 5) continue;
      if (other.x > x + 2 && other.x < nextX) nextX = other.x;
    }
    w = Math.max(40, nextX - x - PADDING);
  } else if (drawMode === "fill_below") {
    // First line below the label.
    x = item.x;
    y = item.y - 12;
    w = Math.max(60, pageW * 0.92 - x);
  } else {
    // "check" — just to the left of the option text.
    x = item.x - CHECK_OFFSET;
    y = item.y;
    w = 14;
  }

  return {
    drawX: clamp01(x / pageW),
    drawY: clamp01(y / pageH),
    drawW: clamp01(w / pageW),
    pageIndex: item.pageIndex,
  };
}

// ── Field normalization ────────────────────────────────────────────────────

// Validate the field payload coming back from the client on approve. Fields
// already carry resolved positions (rect for AcroForm, drawX/drawY/drawW for
// flat PDFs) — we just trust and clamp.
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

    const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
    const drawX = typeof raw.drawX === "number" ? clamp01(raw.drawX) : undefined;
    const drawY = typeof raw.drawY === "number" ? clamp01(raw.drawY) : undefined;
    const drawW = typeof raw.drawW === "number" ? clamp01(raw.drawW) : undefined;
    const rawMode = raw.drawMode;
    const drawMode =
      rawMode === "fill" || rawMode === "fill_below" || rawMode === "check"
        ? (rawMode as "fill" | "fill_below" | "check")
        : undefined;

    const rect = parseFieldRect(raw.rect);

    out.push({
      key, label, value, acroField, type, pageIndex,
      drawX, drawY, drawW, drawMode, rect,
    });
  }

  return out;
}

// Validate a normalized FieldRect coming back from the client on approve.
function parseFieldRect(raw: unknown): FieldRect | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const page = Number(o.page);
  const x = Number(o.x);
  const y = Number(o.y);
  const w = Number(o.w);
  const h = Number(o.h);
  if (![page, x, y, w, h].every((v) => Number.isFinite(v))) return undefined;
  if (page < 0 || w <= 0 || h <= 0) return undefined;
  const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
  return { page: Math.floor(page), x: clamp01(x), y: clamp01(y), w: clamp01(w), h: clamp01(h) };
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

// Deterministic placement for every AcroForm field: walk `form.getFields()`
// and use pdf-lib's own widget API to read each widget's rectangle and host
// page. This avoids the T/Parent name-resolution issues that left some fields
// without a position in the older approach. We emit at most one placement per
// field name (the first widget) so checkboxes/text fields that render in
// multiple places don't get filled twice, and we skip radio groups since
// each widget represents an option rather than the field itself.
export async function extractAcroFormPlacements(
  sourceBuffer: Buffer,
): Promise<Array<{ acroField: string; type: PermitFieldType | "dropdown" | "optionlist"; rect: FieldRect }>> {
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(sourceBuffer, { ignoreEncryption: true });
  } catch {
    return [];
  }

  const pages = doc.getPages();
  const widgetToField = new Map<
    PDFDict,
    { name: string; type: PermitFieldType | "dropdown" | "optionlist" }
  >();

  try {
    const form = doc.getForm();
    for (const field of form.getFields()) {
      let type: PermitFieldType | "dropdown" | "optionlist" = "text";
      if (field instanceof PDFCheckBox) type = "checkbox";
      else if (field instanceof PDFDropdown) type = "dropdown";
      else if (field instanceof PDFOptionList) type = "optionlist";
      else if (field instanceof PDFRadioGroup) continue; // skip for now
      else if (field instanceof PDFTextField) type = "text";
      const name = field.getName();
      try {
        for (const widget of field.acroField.getWidgets()) {
          widgetToField.set(widget.dict, { name, type });
        }
      } catch { /* skip malformed widget list */ }
    }
  } catch {
    return [];
  }

  const out: Array<{ acroField: string; type: PermitFieldType | "dropdown" | "optionlist"; rect: FieldRect }> = [];
  const seenNames = new Set<string>();

  pages.forEach((page, pageIndex) => {
    const pw = page.getWidth();
    const ph = page.getHeight();
    if (pw <= 0 || ph <= 0) return;
    const annots = page.node.Annots();
    if (!annots) return;
    for (const ref of annots.asArray()) {
      try {
        const annot = doc.context.lookup(ref);
        if (!(annot instanceof PDFDict)) continue;
        const fieldInfo = widgetToField.get(annot);
        if (!fieldInfo) continue;
        if (seenNames.has(fieldInfo.name)) continue;
        const rectObj = doc.context.lookupMaybe(annot.get(PDFName.of("Rect")), PDFArray);
        if (!rectObj || rectObj.size() < 4) continue;
        const nums = [0, 1, 2, 3].map((i) => {
          const el = rectObj.get(i);
          return el instanceof PDFNumber ? el.asNumber() : NaN;
        });
        if (nums.some((v) => !Number.isFinite(v))) continue;
        const x1 = Math.min(nums[0], nums[2]);
        const y1 = Math.min(nums[1], nums[3]);
        const x2 = Math.max(nums[0], nums[2]);
        const y2 = Math.max(nums[1], nums[3]);
        if (x2 - x1 <= 0 || y2 - y1 <= 0) continue;
        seenNames.add(fieldInfo.name);
        out.push({
          acroField: fieldInfo.name,
          type: fieldInfo.type,
          rect: {
            page: pageIndex,
            x: x1 / pw,
            y: (ph - y2) / ph,
            w: (x2 - x1) / pw,
            h: (y2 - y1) / ph,
          },
        });
      } catch {
        // skip malformed annotation
      }
    }
  });

  return out;
}

// Turn an AcroForm field name into a readable fallback label, e.g.
// "OwnerName" → "Owner Name", "owner_address" → "owner address".
function humanizeAcroFieldName(name: string): string {
  return name
    .replace(/^.*\./, "")
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
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

    // Build a numbered candidate list from text items (short labels + options only).
    // Gemini returns an integer fieldNum that indexes into this array, which is
    // impossible to hallucinate wrong — unlike opaque string IDs.
    const LABEL_WIDTH_LIMIT = 200;
    const candidates = textItems
      .filter((i) => i.width <= LABEL_WIDTH_LIMIT && i.text.length >= 2)
      .sort((a, b) => a.pageIndex - b.pageIndex || b.y - a.y || a.x - b.x);

    const fieldListLines = candidates.map(
      (item, idx) =>
        `Field ${idx + 1} | page=${item.pageIndex + 1} y=${item.y.toFixed(0)} x=${item.x.toFixed(0)} | "${item.text}"`,
    );

    // Stage 2: Gemini receives numbered field list + project data → returns fieldNum + value.
    const promptText = [
      "FORM FIELDS:",
      fieldListLines.join("\n"),
      "",
      "PROJECT DATA:",
      JSON.stringify(context, null, 2),
      "",
      "Return the JSON array of fill instructions.",
    ].join("\n");

    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: promptText }] }],
      config: {
        systemInstruction: SCAN_SYSTEM_INSTRUCTION_FLAT,
        responseMimeType: "application/json",
        responseSchema: FLAT_RESPONSE_SCHEMA,
        thinkingConfig: { thinkingBudget: 0 },
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

    // Stage 3 prep: resolve fieldNum → candidate → draw coordinates.
    const rawArr = Array.isArray(parsed) ? parsed : [];
    const fields: PermitField[] = [];
    const seenKeys = new Set<string>();

    for (const raw of rawArr) {
      if (!raw || typeof raw !== "object") continue;
      const r = raw as Record<string, unknown>;

      const fieldNum = typeof r.fieldNum === "number" ? Math.round(r.fieldNum) : NaN;
      const candidate = candidates[fieldNum - 1]; // 1-indexed → 0-indexed
      if (!candidate) continue;

      const label = String(r.label ?? candidate.text).trim().slice(0, 250);
      if (!label) continue;

      let baseKey = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
      if (!baseKey) baseKey = `field_${fields.length + 1}`;
      let key = baseKey;
      let n = 2;
      while (seenKeys.has(key)) { key = `${baseKey}_${n}`; n++; }
      seenKeys.add(key);

      const value = String(r.value ?? "").slice(0, 5000);
      if (!value.trim()) continue; // skip truly empty entries

      const rawMode = r.drawMode;
      const drawMode: "fill" | "fill_below" | "check" =
        rawMode === "fill_below" ? "fill_below"
        : rawMode === "check"    ? "check"
        : "fill";

      const type: PermitFieldType = drawMode === "check" ? "checkbox" : "text";

      const pos = resolveDrawPosition(candidate.id, drawMode, textItems, pageWidths, pageHeights);
      if (!pos) continue;

      fields.push({
        key,
        label,
        value,
        acroField: null,
        type,
        pageIndex: pos.pageIndex,
        drawX: pos.drawX,
        drawY: pos.drawY,
        drawW: pos.drawW,
        drawMode,
      });

      if (fields.length >= MAX_FIELDS) break;
    }

    if (fields.length === 0) {
      throw new Error("The AI did not detect any fillable fields in this PDF.");
    }

    return fields;
  }

  // ── AcroForm PDF: deterministic-placement path ───────────────────────────
  // We enumerate every AcroForm field + its widget rectangle ourselves, then
  // ask Gemini to fill values keyed by field number. This way every field
  // shown to the user is guaranteed to be positioned on the PDF.
  const placements = await extractAcroFormPlacements(sourceBuffer);
  if (placements.length === 0) {
    throw new Error("No interactive form fields could be positioned on this PDF.");
  }

  const fieldListLines = placements.map(
    (p, idx) => `Field ${idx + 1} | name="${p.acroField}" | type=${p.type}`,
  );

  const pdfBase64 = sourceBuffer.toString("base64");
  const promptText = [
    "PROJECT DATA:",
    "```json",
    JSON.stringify(context, null, 2),
    "```",
    "",
    "FORM FIELDS:",
    fieldListLines.join("\n"),
    "",
    "Return the JSON array of fill instructions.",
  ].join("\n");

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
      responseSchema: ACROFORM_RESPONSE_SCHEMA,
      thinkingConfig: { thinkingBudget: 0 },
    },
  });

  const raw = (result.text ?? "").trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");

  let parsed: unknown;
  try { parsed = JSON.parse(raw); }
  catch { throw new Error("Could not read the AI response while scanning the permit."); }

  // Index Gemini's responses by fieldNum (1-based).
  const fills = new Map<number, { label?: string; value: string }>();
  if (Array.isArray(parsed)) {
    for (const raw of parsed) {
      if (!raw || typeof raw !== "object") continue;
      const r = raw as Record<string, unknown>;
      const fieldNum = typeof r.fieldNum === "number" ? Math.round(r.fieldNum) : NaN;
      if (!Number.isFinite(fieldNum) || fieldNum < 1 || fieldNum > placements.length) continue;
      const value = String(r.value ?? "").slice(0, 5000);
      const label = typeof r.label === "string" ? r.label.trim().slice(0, 250) : undefined;
      fills.set(fieldNum, { label, value });
    }
  }

  // Emit one PermitField per placement, so every field has a position on the
  // PDF whether or not Gemini filled it. Users can edit any value directly.
  const fields: PermitField[] = [];
  const seenKeys = new Set<string>();
  placements.forEach((placement, idx) => {
    const fill = fills.get(idx + 1);
    const label = (fill?.label && fill.label.length > 0)
      ? fill.label
      : humanizeAcroFieldName(placement.acroField) || `Field ${idx + 1}`;
    let baseKey = placement.acroField.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
    if (!baseKey) baseKey = `field_${idx + 1}`;
    let key = baseKey;
    let n = 2;
    while (seenKeys.has(key)) { key = `${baseKey}_${n}`; n++; }
    seenKeys.add(key);

    const type: PermitFieldType = placement.type === "checkbox" ? "checkbox" : "text";

    fields.push({
      key,
      label,
      value: fill?.value ?? "",
      acroField: placement.acroField,
      type,
      pageIndex: placement.rect.page,
      rect: placement.rect,
    });
  });

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

      // Width of the writable area: prefer the resolved drawW, fall back to
      // the remaining page width.
      const drawWpx = field.drawW !== undefined ? field.drawW * W : undefined;

      if (field.drawMode === "check") {
        if (isTruthy(field.value)) {
          page.drawText("X", { x, y, size: FONT_SIZE, font, color: rgb(0, 0, 0) });
        }
      } else if (field.drawMode === "fill_below") {
        const sanitized = sanitizeForPdf(field.value).trim();
        if (!sanitized) continue;
        const maxW = drawWpx ?? W - x - 40;
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
        const maxW = drawWpx ?? W - x - 36;
        let text = sanitized;
        while (text.length > 1 && font.widthOfTextAtSize(text, FONT_SIZE) > maxW) {
          text = text.slice(0, -1);
        }
        if (text.trim()) page.drawText(text, { x, y, size: FONT_SIZE, font, color: rgb(0, 0, 0) });
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
