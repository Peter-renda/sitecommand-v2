/**
 * Seeds starter content for a "SiteCommand Training" sandbox launched as a
 * Project Manager. On launch we drop the trainee into a project that already
 * feels live:
 *
 *   1. Directory — the general contractor's internal team (preconstruction
 *      manager, estimator, president, VP, project executive, superintendent,
 *      assistant superintendent).
 *   2. Emails — a Day-1 project-handoff email from the preconstruction manager
 *      carrying the IFC drawing set, the project manual / specifications, and the
 *      key kickoff info (notice to proceed, substantial completion, owner,
 *      architect, contract value, etc.).
 *
 * Everything here is fake and static — no AI and no external mailbox — so a
 * launch stays instant and fully self-contained. The handoff email is written
 * straight into project_email_messages; the messages API serves stored copies
 * for training projects (see app/api/projects/[id]/emails/[threadId]/messages),
 * so it reads back without any Outlook/Gmail connection.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { htmlToText } from "@/lib/email-messages";
import { projectTypeLabel } from "@/lib/simulation-constants";

type SeedOpts = {
  projectId: string;
  ownerUserId: string;
  projectType: string;
  /** Project start date (YYYY-MM-DD) — used as Notice to Proceed in the email. */
  startDate: string;
  /** Owning company id (the PM's own company); null for users without one. */
  companyId: string | null;
};

/** Fictional general contractor used when the launcher has no company of their own. */
const DEFAULT_COMPANY = "Summit Builders";

/**
 * The GC's internal team, in the order the requirement lists the roles. The
 * preconstruction manager (first entry) is the sender of the handoff email.
 * These are reference contacts (no login), so `permission` is left unset.
 */
const TEAM: { first: string; last: string; title: string; phone: string }[] = [
  { first: "David", last: "Okafor", title: "Preconstruction Manager", phone: "(404) 555-0142" },
  { first: "Rachel", last: "Nguyen", title: "Estimator", phone: "(404) 555-0188" },
  { first: "Thomas", last: "Sullivan", title: "President", phone: "(404) 555-0101" },
  { first: "Patricia", last: "Reyes", title: "Vice President", phone: "(404) 555-0109" },
  { first: "Marcus", last: "Bennett", title: "Project Executive", phone: "(404) 555-0123" },
  { first: "Frank", last: "Russo", title: "Superintendent", phone: "(404) 555-0156" },
  { first: "Luis", last: "Ortega", title: "Assistant Superintendent", phone: "(404) 555-0171" },
];

/** Per-project-type flavor for the handoff email so it reads like a real job. */
const TYPE_BRIEF: Record<
  string,
  { value: number; size: string; scope: string; months: number }
> = {
  multifamily: { value: 48_500_000, size: "284 units across five stories", scope: "a wood-framed wrap with a precast parking podium, amenity deck, and ground-floor retail", months: 18 },
  education: { value: 32_000_000, size: "92,000 SF", scope: "a new K-8 academic building with a gymnasium, media center, and full site work", months: 14 },
  higher_ed: { value: 67_000_000, size: "140,000 SF", scope: "a STEM teaching and research building with wet/dry labs, lecture halls, and a central atrium", months: 22 },
  data_center: { value: 145_000_000, size: "a 24 MW critical facility", scope: "two data halls, an electrical yard, a generator plant, and a central utility building", months: 16 },
  healthcare: { value: 89_000_000, size: "168,000 SF", scope: "a patient tower addition with surgical suites, imaging, and a connector to the existing hospital", months: 24 },
  commercial_office: { value: 54_000_000, size: "11 stories / 210,000 SF", scope: "a Class A office core-and-shell with two levels of below-grade parking", months: 20 },
  retail: { value: 23_500_000, size: "96,000 SF", scope: "a mixed-use retail center with an anchor tenant, in-line shops, and pad sites", months: 12 },
  industrial: { value: 38_000_000, size: "320,000 SF", scope: "a tilt-up distribution warehouse with 40' clear height, a full dock package, and office build-out", months: 11 },
  hospitality: { value: 61_000_000, size: "186 keys", scope: "a full-service hotel with a ballroom, restaurant, pool deck, and structured parking", months: 19 },
  civil: { value: 27_000_000, size: "2.4 miles of corridor", scope: "roadway widening, storm drainage, water/sewer relocation, and signalization", months: 15 },
};

const DEFAULT_BRIEF = { value: 40_000_000, size: "", scope: "a new construction project", months: 16 };

// Fictional project stakeholders referenced in the handoff.
const OWNER = "Meridian Development Partners";
const ARCHITECT = "Halford Studio Architects";

// Bid addenda handed off with the email. The PDFs are served as static assets
// from public/training, so the links are stable (no signed-URL expiry) and work
// without any mailbox connection.
const ADDENDA: { label: string; file: string }[] = [
  { label: "Addendum No. 1", file: "208570-addendum-no-1.pdf" },
  { label: "Addendum No. 2 — Final", file: "208570-addendum-no-2-final.pdf" },
];

/** Canonical app origin for absolute links in the stored email body. */
function appBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_BASE_URL ??
    "http://localhost:3000"
  ).replace(/\/+$/, "");
}

function emailDomain(company: string): string {
  const slug = company.toLowerCase().replace(/[^a-z0-9]/g, "");
  return `${slug || "summitbuilders"}.com`;
}

function emailFor(first: string, last: string, domain: string): string {
  const local = `${first}.${last}`.toLowerCase().replace(/[^a-z0-9.]/g, "");
  return `${local}@${domain}`;
}

/** Add whole months to a YYYY-MM-DD date, returning YYYY-MM-DD (UTC-safe). */
function addMonths(isoDate: string, months: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().split("T")[0];
}

/** "June 23, 2026" from a YYYY-MM-DD date. */
function formatLong(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

function formatMoney(value: number): string {
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

function buildHandoffHtml(opts: {
  pmFirst: string;
  preconName: string;
  preconTitle: string;
  preconPhone: string;
  preconEmail: string;
  companyName: string;
  projectType: string;
  startDate: string;
}): string {
  const { pmFirst, preconName, preconTitle, preconPhone, preconEmail, companyName, projectType, startDate } = opts;
  const label = projectTypeLabel(projectType);
  const brief = TYPE_BRIEF[projectType] ?? DEFAULT_BRIEF;
  const ntp = formatLong(startDate);
  const subComplete = formatLong(addMonths(startDate, brief.months));
  const sizeLine = brief.size ? `${brief.size} — ` : "";
  const base = appBaseUrl();
  const addendaList = ADDENDA.map(
    (a) => `  <li><a href="${base}/training/${a.file}">${a.label}</a> (PDF)</li>`,
  ).join("\n");

  return `
<p>Hi ${pmFirst},</p>

<p>Now that we've wrapped up preconstruction, I'm officially handing the <strong>${label}</strong> project over to you to run. Below you'll find everything you need to get spun up: the IFC drawing set, the project manual / specifications, and the key contract and kickoff information. Congratulations on the assignment — reach out anytime as you get going.</p>

<h3>Project Snapshot</h3>
<ul>
  <li><strong>Scope:</strong> ${sizeLine}${brief.scope}.</li>
  <li><strong>Owner:</strong> ${OWNER}</li>
  <li><strong>Architect of Record:</strong> ${ARCHITECT}</li>
  <li><strong>Delivery Method:</strong> CM at Risk, GMP</li>
  <li><strong>Contract Value:</strong> ${formatMoney(brief.value)}</li>
  <li><strong>Notice to Proceed:</strong> ${ntp}</li>
  <li><strong>Substantial Completion:</strong> ${subComplete}</li>
</ul>

<h3>IFC Drawings (Issued for Construction)</h3>
<p>The full IFC set is released and attached for the following disciplines. Please get these loaded into the Drawings tool and confirm we're building to the current revision:</p>
<ul>
  <li>Civil &amp; Site (C-series)</li>
  <li>Architectural (A-series)</li>
  <li>Structural (S-series)</li>
  <li>Mechanical / HVAC (M-series)</li>
  <li>Electrical (E-series)</li>
  <li>Plumbing (P-series)</li>
  <li>Fire Protection (FP-series)</li>
  <li>Landscape (L-series)</li>
  <li>Low Voltage / Technology (T-series)</li>
</ul>

<h3>Specifications</h3>
<p>The complete project manual is attached — CSI Divisions 00 through 48, including the front-end (Division 00/01) general conditions and all technical sections. Load it into the Specifications tool so the team can reference it against submittals and RFIs.</p>

<h3>Attachments — Bid Addenda</h3>
<p>The following addenda were issued during procurement and are part of the contract documents. Review them and make sure we're building to the latest revisions:</p>
<ul>
${addendaList}
</ul>

<h3>Other Pertinent Info</h3>
<ul>
  <li><strong>Permits:</strong> The building permit is issued; site/civil permits are in hand. Keep the permit log current.</li>
  <li><strong>Long-lead items:</strong> Switchgear, generators, rooftop equipment, and elevators are the critical procurement items — get those submittals and POs moving first.</li>
  <li><strong>Estimate handoff:</strong> Rachel has the full estimate, bid tabs, and scope sheets ready to walk you through buyout.</li>
  <li><strong>Kickoff:</strong> Let's get an internal kickoff on the calendar this week, then schedule the OAC kickoff with the owner and architect.</li>
</ul>

<h3>What I'd Tackle First</h3>
<ul>
  <li>Review the IFC set and project manual end to end.</li>
  <li>Start buyout on the long-lead and early site/structure trades.</li>
  <li>Build the baseline schedule from the milestones above.</li>
  <li>Stand up the project directory and distribution lists.</li>
</ul>

<p>Welcome aboard — go get 'em.</p>

<p>
  ${preconName}<br/>
  ${preconTitle}, ${companyName}<br/>
  ${preconPhone}<br/>
  ${preconEmail}
</p>
`.trim();
}

/**
 * Seeds the Project-Manager training experience: the GC's internal directory and
 * the preconstruction handoff email. Best-effort — callers should not let a seed
 * failure block the launch.
 */
export async function seedTrainingProjectManager(
  supabase: SupabaseClient,
  opts: SeedOpts,
): Promise<void> {
  const { projectId, ownerUserId, projectType, startDate, companyId } = opts;

  // Resolve the GC company name (the PM's own company), falling back to a
  // fictional firm so the experience is self-contained.
  let companyName = DEFAULT_COMPANY;
  if (companyId) {
    const { data: company } = await supabase
      .from("companies")
      .select("name")
      .eq("id", companyId)
      .maybeSingle();
    if (company?.name) companyName = company.name;
  }
  const domain = emailDomain(companyName);

  // The PM (the launcher) is the recipient of the handoff email.
  const { data: owner } = await supabase
    .from("users")
    .select("first_name, last_name, email, username")
    .eq("id", ownerUserId)
    .maybeSingle();
  const pmName =
    [owner?.first_name, owner?.last_name].filter(Boolean).join(" ").trim() ||
    owner?.username ||
    "Project Manager";
  const pmEmail = owner?.email || emailFor("project", "manager", domain);
  const pmFirst = (owner?.first_name || pmName).split(/\s+/)[0] || "there";

  // 1) Directory — seed the GC's internal team.
  const teamContacts = TEAM.map((t) => ({
    project_id: projectId,
    type: "user" as const,
    first_name: t.first,
    last_name: t.last,
    email: emailFor(t.first, t.last, domain),
    phone: t.phone,
    company: companyName,
    job_title: t.title,
  }));
  await supabase.from("directory_contacts").insert(teamContacts);

  // 2) Emails — Day-1 handoff from the preconstruction manager.
  const precon = TEAM[0];
  const preconName = `${precon.first} ${precon.last}`;
  const preconEmail = emailFor(precon.first, precon.last, domain);
  const label = projectTypeLabel(projectType);
  const subject = `Project Handoff — ${label}: IFC Drawings, Specifications & Kickoff Info`;
  const bodyHtml = buildHandoffHtml({
    pmFirst,
    preconName,
    preconTitle: precon.title,
    preconPhone: precon.phone,
    preconEmail,
    companyName,
    projectType,
    startDate,
  });
  const bodyText = htmlToText(bodyHtml);
  const nowIso = new Date().toISOString();

  const { data: thread } = await supabase
    .from("project_email_threads")
    .insert({
      project_id: projectId,
      graph_conversation_id: "training-precon-handoff",
      subject,
      participants: [preconName, pmName],
      latest_message_preview: bodyText.slice(0, 280),
      latest_received_at: nowIso,
      message_count: 1,
      linked_by: ownerUserId,
      linked_at: nowIso,
    })
    .select("id")
    .single();

  if (thread?.id) {
    await supabase.from("project_email_messages").insert({
      thread_id: thread.id,
      project_id: projectId,
      provider_message_id: "training-precon-handoff-1",
      from_name: preconName,
      from_address: preconEmail,
      to_recipients: [{ name: pmName, address: pmEmail }],
      cc_recipients: [],
      subject,
      sent_at: nowIso,
      body_text: bodyText,
      body_html: bodyHtml,
      snippet: bodyText.slice(0, 200),
      synced_at: nowIso,
    });
  }
}
