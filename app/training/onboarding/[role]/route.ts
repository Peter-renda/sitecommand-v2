import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { SimRole } from "@/lib/simulation-constants";

type OnboardingDoc = {
  filename: string;
  title: string;
  subtitle: string;
  sections: [string, string][];
};

const ONBOARDING_DOCS: Record<SimRole, OnboardingDoc> = {
  superintendent: {
    filename: "superintendent-onboarding.pdf",
    title: "Superintendent Company Onboarding",
    subtitle: "Field leadership expectations for training simulations",
    sections: [
      ["Your mission", "Lead safe, productive field execution. Own daily coordination, site logistics, quality, inspections, manpower visibility, and short-interval planning."],
      ["Day-one expectations", "Review the drawings and specifications, verify site conditions, confirm trade readiness, document manpower and safety items, and escalate constraints before they affect the schedule."],
      ["Daily rhythm", "Publish accurate daily logs, hold foreman huddles, walk critical work areas, capture photos, track deliveries, and keep the Project Manager current on risks, changes, RFIs, and schedule impacts."],
      ["Quality and safety", "Stop unsafe work, document toolbox talks, confirm inspections before covering work, manage punch items early, and coach subcontractors toward first-time-right installation."],
      ["Communication standard", "Be factual, timely, and specific. Include location, drawing or specification reference, responsible party, needed decision date, and any cost or schedule exposure."],
    ],
  },
  project_manager: {
    filename: "project-manager-onboarding.pdf",
    title: "Project Manager Company Onboarding",
    subtitle: "Office leadership expectations for training simulations",
    sections: [
      ["Your mission", "Protect scope, schedule, budget, relationships, and documentation. Drive decisions through RFIs, submittals, procurement, contracts, change management, forecasting, and owner communication."],
      ["Day-one expectations", "Understand the contract, budget, schedule, drawings, specifications, project team, open risks, long-lead items, and communication protocols. Prioritize unresolved items that can affect field progress."],
      ["Core responsibilities", "Run issue resolution, maintain the RFI and submittal logs, track procurement, manage subcontractor commitments, prepare meeting minutes, evaluate change events, and keep cost forecasts current."],
      ["Change and cost control", "Do not let work proceed without clear direction when scope, cost, or schedule may change. Create timely PCOs, gather backup, notify stakeholders, and align accounting before billing or committing costs."],
      ["Communication standard", "Lead with the decision needed, deadline, impact, and recommended path. Keep messages professional, concise, documented, and tied to contract requirements."],
    ],
  },
  accounting: {
    filename: "project-accounting-onboarding.pdf",
    title: "Project Accounting Company Onboarding",
    subtitle: "Financial control expectations for training simulations",
    sections: [
      ["Your mission", "Keep project financial records accurate, auditable, timely, and aligned with the contract. Support the team with billing, pay applications, invoices, lien waivers, cost coding, and compliance."],
      ["Day-one expectations", "Review the contract value, schedule of values, cost code structure, commitments, billing cycle, retention terms, insurance and lien waiver requirements, and open financial risks."],
      ["Core responsibilities", "Validate invoices against commitments, confirm cost codes, prepare owner billing, track pay application status, collect lien waivers, reconcile budget updates, and flag missing approvals."],
      ["Controls and compliance", "Never process incomplete backup. Confirm approvals, matching totals, tax and retention treatment, compliance documents, and budget availability before posting or routing payments."],
      ["Communication standard", "Be precise with dollars, dates, vendors, cost codes, contract references, and required approvals. Escalate discrepancies early so the project team can resolve them before deadlines."],
    ],
  },
};

function isRole(value: string): value is SimRole {
  return value === "superintendent" || value === "project_manager" || value === "accounting";
}

function wrapText(text: string, font: { widthOfTextAtSize: (text: string, size: number) => number }, size: number, maxWidth: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) {
      line = next;
    } else {
      if (line) lines.push(line);
      line = word;
    }
  }

  if (line) lines.push(line);
  return lines;
}

async function renderOnboardingPdf(doc: OnboardingDoc) {
  const pdf = await PDFDocument.create();
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  let page = pdf.addPage([612, 792]);
  const { width, height } = page.getSize();
  let y = height - 58;

  page.drawText(doc.title, { x: 48, y, size: 22, font: bold, color: rgb(0.1, 0.1, 0.1) });
  y -= 24;
  page.drawText(doc.subtitle, { x: 48, y, size: 11, font: regular, color: rgb(0.35, 0.35, 0.35) });
  y -= 28;
  page.drawLine({ start: { x: 48, y }, end: { x: width - 48, y }, thickness: 1, color: rgb(0.9, 0.62, 0.15) });
  y -= 28;

  for (const [heading, body] of doc.sections) {
    if (y < 130) {
      page = pdf.addPage([612, 792]);
      y = height - 56;
    }
    page.drawText(heading, { x: 48, y, size: 14, font: bold, color: rgb(0.13, 0.13, 0.13) });
    y -= 18;
    for (const line of wrapText(body, regular, 11, width - 96)) {
      page.drawText(line, { x: 48, y, size: 11, font: regular, color: rgb(0.18, 0.18, 0.18) });
      y -= 15;
    }
    y -= 12;
  }

  page.drawText("Training note: mark this guide complete after opening and reviewing it from the Day 1 checklist.", {
    x: 48,
    y: 42,
    size: 9,
    font: regular,
    color: rgb(0.45, 0.45, 0.45),
  });

  return pdf.save();
}

export async function GET(_request: Request, { params }: { params: Promise<{ role: string }> }) {
  const { role } = await params;
  if (!isRole(role)) {
    return NextResponse.json({ error: "Onboarding guide not found" }, { status: 404 });
  }

  const doc = ONBOARDING_DOCS[role];
  const bytes = await renderOnboardingPdf(doc);

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${doc.filename}"`,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
