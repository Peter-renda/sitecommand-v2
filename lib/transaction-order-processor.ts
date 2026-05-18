// Server-side Transaction Order processor.
//
// Mirrors the Python `hamel-transaction-order` skill: takes a source
// invoice/backup PDF, uses Gemini to extract the numbered fields, fills
// the Fillable_Transaction_Order_template.pdf, overlays signature /
// initials / APPROVED stamp, and merges every page into a single
// completed packet.

import fs from "node:fs/promises";
import path from "node:path";
import { GoogleGenAI } from "@google/genai";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type ExtractedFields = {
  vendor: string;
  amount: string;
  scope: string;
  pi_code: string;
  cost_code: string;
};

export type ProcessResult = {
  pdfBytes: Uint8Array;
  fields: ExtractedFields;
  date: string; // MM/DD/YYYY
};

const DEFAULT_TEMPLATE_PATH = path.join(
  process.cwd(),
  "public",
  "transaction-orders",
  "Fillable_Transaction_Order_template.pdf",
);
const SIGNATURE_PATH = path.join(process.cwd(), "public", "transaction-orders", "signature.png");
const INITIALS_PATH = path.join(process.cwd(), "public", "transaction-orders", "initials.png");

const EXTRACTION_PROMPT = `You are extracting numbered fields from a Hamel Builders Transaction Order source packet.
The source packet has handwritten or annotated numbers (1-8) marking values that need to be transferred to a Transaction Order form.

Return ONLY a JSON object — no markdown, no commentary — with exactly these fields:
{
  "vendor": string,        // Field 1: vendor / company name highlighted on page 1
  "amount": string,        // Field 2: net check / total amount as a plain number, e.g. "85.80"
  "scope": string,         // Field 5: short scope description plus invoice number, e.g. "RESTROOMS 12/18-1/15 - INVOICE-56417"
  "pi_code": string,       // Field 7: PI / GL code (2 digits, e.g. "01"). Inspect any hand-circled code on the write-up sheet.
  "cost_code": string      // Field 8: cost code (3 digits, e.g. "030"). Inspect any hand-circled code on the write-up sheet.
}

Rules:
- Use an empty string "" for any field you cannot determine with high confidence.
- Do not invent values. Do not include currency symbols or commas in "amount".
- Trim whitespace and normalize internal spacing.`;

export async function extractTransactionOrderFields(
  sourcePdf: Buffer,
  filename: string,
): Promise<ExtractedFields> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("AI service not configured");
  }

  const ai = new GoogleGenAI({ apiKey });

  const uploaded = await ai.files.upload({
    file: new Blob([new Uint8Array(sourcePdf)], { type: "application/pdf" }),
    config: { mimeType: "application/pdf", displayName: filename },
  });
  if (!uploaded.uri || !uploaded.mimeType) {
    throw new Error("Gemini upload returned no URI");
  }

  const result = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      {
        role: "user",
        parts: [
          { text: "Extract the eight numbered Transaction Order fields from this PDF." },
          { fileData: { mimeType: uploaded.mimeType, fileUri: uploaded.uri } },
        ],
      },
    ],
    config: { systemInstruction: EXTRACTION_PROMPT },
  });

  const raw = (result.text ?? "")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");

  let parsed: Partial<ExtractedFields> = {};
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Could not parse Gemini extraction response");
  }

  return {
    vendor: String(parsed.vendor ?? "").trim(),
    amount: String(parsed.amount ?? "").trim(),
    scope: String(parsed.scope ?? "").trim(),
    pi_code: String(parsed.pi_code ?? "").trim(),
    cost_code: String(parsed.cost_code ?? "").trim(),
  };
}

function todayParts() {
  // Match the skill's America/New_York timezone.
  const fmt = (opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", ...opts }).format(new Date());
  const mm = fmt({ month: "2-digit" });
  const dd = fmt({ day: "2-digit" });
  const yyyy = fmt({ year: "numeric" });
  const yy = fmt({ year: "2-digit" });
  const monthLong = fmt({ month: "long" });
  const day = fmt({ day: "numeric" });
  const stampTime = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date());
  return {
    today: `${mm}/${dd}/${yyyy}`,
    day,
    month: monthLong,
    year: yy,
    stampTime: `${stampTime} ET`,
  };
}

function trySetText(form: ReturnType<PDFDocument["getForm"]>, fieldName: string, value: string) {
  try {
    const field = form.getTextField(fieldName);
    field.setText(value);
  } catch {
    // Field is missing in this template — ignore.
  }
}

function tryCheck(form: ReturnType<PDFDocument["getForm"]>, fieldName: string) {
  try {
    form.getCheckBox(fieldName).check();
  } catch {
    // Not present — ignore.
  }
}

// Loads an image into a PDFDocument by sniffing magic bytes — the bundled
// "signature.png" / "initials.png" assets are actually JFIF JPEGs, so calling
// embedPng on them throws.
async function embedImageAuto(doc: PDFDocument, bytes: Uint8Array) {
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    return doc.embedJpg(bytes);
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return doc.embedPng(bytes);
  }
  // Fall back to PNG and let pdf-lib throw a useful error.
  return doc.embedPng(bytes);
}

export async function fillTransactionOrder(
  templateBytes: Uint8Array | Buffer,
  sourcePdf: Buffer,
  fields: ExtractedFields,
): Promise<ProcessResult> {
  const { today, day, month, year, stampTime } = todayParts();

  // ── Step 1: Fill the TO template form fields ─────────────────────────────
  const templateDoc = await PDFDocument.load(templateBytes);
  const form = templateDoc.getForm();

  trySetText(form, "Subcontractor Name", fields.vendor);
  trySetText(form, "Date", today);
  trySetText(form, "Total", fields.amount);
  trySetText(form, "Pl", fields.pi_code);
  trySetText(form, "Cost Code", fields.cost_code);
  trySetText(form, "Day", day);
  trySetText(form, "Month", month);
  trySetText(form, "Year", year);
  tryCheck(form, "Check Box1");

  // Flatten so the values bake in and won't disappear when merging.
  // Some templates have field widgets that pdf-lib can't flatten cleanly
  // (no appearance dictionary, unusual encodings). If flatten() throws,
  // fall back to baking the appearance streams only — copyPages() will
  // still carry the widgets across.
  try {
    form.flatten();
  } catch (err) {
    console.warn("TO template flatten failed, falling back to updateFieldAppearances:", err);
    try {
      form.updateFieldAppearances();
    } catch {
      /* ignore — values may render via the viewer's default appearance */
    }
  }

  // ── Step 2: Overlay scope text + signature on TO page 1 ──────────────────
  const helvetica = await templateDoc.embedFont(StandardFonts.Helvetica);

  const toPage1 = templateDoc.getPage(0);
  if (fields.scope) {
    toPage1.drawText(fields.scope, {
      x: 55,
      y: 445,
      size: 10,
      font: helvetica,
      color: rgb(0, 0, 0),
    });
  }

  try {
    const sigBytes = await fs.readFile(SIGNATURE_PATH);
    const sigImage = await embedImageAuto(templateDoc, sigBytes);
    const sigW = 165;
    const sigH = (sigImage.height / sigImage.width) * sigW;
    toPage1.drawImage(sigImage, { x: 348, y: 78, width: sigW, height: Math.min(sigH, 28) });
  } catch (err) {
    console.warn("Could not embed signature image:", err);
  }

  // ── Step 3: Annotate the source PDF (initials + date + APPROVED stamp) ──
  const sourceDoc = await PDFDocument.load(sourcePdf);
  const initialsBytes = await fs.readFile(INITIALS_PATH).catch(() => null);
  const initialsImage = initialsBytes ? await embedImageAuto(sourceDoc, initialsBytes) : null;
  const sourceHelvetica = await sourceDoc.embedFont(StandardFonts.Helvetica);
  const sourceBoldOblique = await sourceDoc.embedFont(StandardFonts.HelveticaBoldOblique);

  const sourcePages = sourceDoc.getPages();
  if (sourcePages.length > 0) {
    const p1 = sourcePages[0];
    if (initialsImage) {
      p1.drawImage(initialsImage, { x: 314, y: 283, width: 35, height: 16 });
    }
    p1.drawText(today, { x: 355, y: 287, size: 7, font: sourceHelvetica, color: rgb(0, 0, 0) });
  }
  if (sourcePages.length > 1) {
    const p2 = sourcePages[1];
    const bx = 160;
    const by = 160;
    const bw = 300;
    const bh = 52;
    p2.drawRectangle({
      x: bx,
      y: by,
      width: bw,
      height: bh,
      color: rgb(0xe8 / 255, 0xf5 / 255, 0xe9 / 255),
      borderColor: rgb(0x2e / 255, 0x7d / 255, 0x32 / 255),
      borderWidth: 1.5,
    });
    p2.drawText("APPROVED", {
      x: bx + 12,
      y: by + 28,
      size: 20,
      font: sourceBoldOblique,
      color: rgb(0x1a / 255, 0x7a / 255, 0x1a / 255),
    });
    p2.drawText(`By Peter Renda at ${stampTime}`, {
      x: bx + 12,
      y: by + 12,
      size: 9,
      font: sourceBoldOblique,
      color: rgb(0x1a / 255, 0x7a / 255, 0x1a / 255),
    });
  }

  // ── Step 4: Merge → TO p1, TO p2 (T&C), all annotated source pages ──────
  const out = await PDFDocument.create();

  const [toP1Copied] = await out.copyPages(templateDoc, [0]);
  out.addPage(toP1Copied);
  if (templateDoc.getPageCount() > 1) {
    const [toP2Copied] = await out.copyPages(templateDoc, [1]);
    out.addPage(toP2Copied);
  }

  const srcIndices = sourcePages.map((_, idx) => idx);
  const copiedSource = await out.copyPages(sourceDoc, srcIndices);
  for (const p of copiedSource) out.addPage(p);

  const pdfBytes = await out.save();

  return {
    pdfBytes,
    fields,
    date: today,
  };
}

export async function loadDefaultTemplate(): Promise<Buffer> {
  return fs.readFile(DEFAULT_TEMPLATE_PATH);
}
