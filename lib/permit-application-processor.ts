// Server-side Permit Application processor.
//
// Takes an uploaded blank permit application PDF, uses Gemini to detect
// every fillable field and propose a value for each from project data,
// and — once the user has reviewed/edited the values — fills the PDF.
// When the PDF has interactive AcroForm fields the values are written
// into them and the form is flattened; otherwise the reviewed answers
// are appended as a formatted summary page.

import { GoogleGenAI } from "@google/genai";
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

export type PermitField = {
  key: string;
  label: string;
  value: string;
  acroField: string | null;
  type: PermitFieldType;
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

// ── Field normalization ────────────────────────────────────────────────────

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

    out.push({ key, label, value, acroField, type });
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

  const uploaded = await ai.files.upload({
    file: new Blob([new Uint8Array(sourceBuffer)], { type: "application/pdf" }),
    config: { mimeType: "application/pdf", displayName: filename },
  });
  if (!uploaded.uri || !uploaded.mimeType) {
    throw new Error("Gemini upload returned no file reference.");
  }

  const acroList =
    acroFields.length > 0
      ? acroFields.map((a) => `- ${a.name} (${a.type})`).join("\n")
      : "(none — this PDF has no interactive form fields)";

  const promptText = `PROJECT DATA:
\`\`\`json
${JSON.stringify(context, null, 2)}
\`\`\`

ACROFORM FIELDS:
${acroList}

Scan this permit application PDF and return the JSON array of fields.`;

  const result = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      {
        role: "user",
        parts: [
          { text: promptText },
          { fileData: { mimeType: uploaded.mimeType, fileUri: uploaded.uri } },
        ],
      },
    ],
    config: { systemInstruction: SCAN_SYSTEM_INSTRUCTION },
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

  let form: PDFForm | null = null;
  const acroNames = new Set<string>();
  try {
    form = pdfDoc.getForm();
    for (const field of form.getFields()) acroNames.add(field.getName());
  } catch {
    form = null;
  }

  const applied = new Set<string>();
  if (form && acroNames.size > 0) {
    for (const field of fields) {
      if (!field.acroField || !field.value.trim() || !acroNames.has(field.acroField)) {
        continue;
      }
      if (applyAcroField(form, field.acroField, field.value)) {
        applied.add(field.key);
      }
    }
    // Flatten so values bake in. Some templates can't be flattened cleanly;
    // fall back to baking appearance streams only.
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

  // Anything with a value that did not land in an AcroForm field (including
  // every field when the PDF has no form at all) is written to a summary page.
  const leftovers = fields.filter((f) => f.value.trim() && !applied.has(f.key));
  if (leftovers.length > 0) {
    await appendSummaryPages(pdfDoc, title, leftovers);
  }

  return pdfDoc.save();
}
