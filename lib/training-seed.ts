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
import {
  TRAINING_SUBS,
  BUYOUT_THREAD_COUNT,
  subEmailFor,
  buildBuyoutOutreachHtml,
  buildSeededBidResponseHtml,
} from "@/lib/training-emails";
import {
  INBOX_SENDERS,
  TRAINING_INBOX_EMAILS,
  inboxSenderEmail,
  inboxConversationId,
  type InboxCtx,
} from "@/lib/training-inbox";

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
  { first: "Janet", last: "Kim", title: "Accounting Manager", phone: "(404) 555-0195" },
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

// Bid documents handed off with the email. The PDFs are served as static assets
// from public/training, so the links are stable (no signed-URL expiry) and work
// without any mailbox connection. Add parts by dropping the PDF in
// public/training and appending to the relevant list.
const DRAWINGS: { label: string; file: string }[] = [
  { label: "Bid Drawings — Part 1", file: "208570-bid-drawings-part-1.pdf" },
  { label: "Bid Drawings — Part 2 (1 of 2)", file: "208570-bid-drawings-part-2-1.pdf" },
  { label: "Bid Drawings — Part 2 (2 of 2)", file: "208570-bid-drawings-part-2-2.pdf" },
];
const ADDENDA: { label: string; file: string }[] = [
  { label: "Addendum No. 1", file: "208570-addendum-no-1.pdf" },
  { label: "Addendum No. 2 — Final", file: "208570-addendum-no-2-final.pdf" },
];

// Per-project-type specification / project-manual attachments. Unlike the
// generic bid drawings/addenda above (shared by every type), these are scoped
// to a project type, so a higher-ed spec only shows on the higher-ed handoff.
const SPECS_BY_TYPE: Record<string, { label: string; file: string }[]> = {
  higher_ed: [
    {
      label: "UW Kane Hall CAAMs — Bid Specifications",
      file: "26-0415_UW Kane Hall CAAMs_Bid Spec.pdf",
    },
  ],
};

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
  const linkItem = (a: { label: string; file: string }) =>
    `  <li><a href="${base}/training/${encodeURIComponent(a.file)}">${a.label}</a> (PDF)</li>`;
  const drawingsList = DRAWINGS.map(linkItem).join("\n");
  const addendaList = ADDENDA.map(linkItem).join("\n");
  const specs = SPECS_BY_TYPE[projectType] ?? [];
  const specsList = specs.map(linkItem).join("\n");

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
<p>The full bid drawing set is attached below. Please get it loaded into the Drawings tool and confirm we're building to the current revision. The set spans the project disciplines (civil/site, architectural, structural, mechanical/HVAC, electrical, plumbing, fire protection, landscape, and low-voltage/technology).</p>
<ul>
${drawingsList}
</ul>

<h3>Specifications</h3>
<p>The complete project manual is attached — CSI Divisions 00 through 48, including the front-end (Division 00/01) general conditions and all technical sections. Load it into the Specifications tool so the team can reference it against submittals and RFIs.</p>
${specs.length ? `<ul>\n${specsList}\n</ul>` : ""}

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

  // 1) Directory — seed the GC's internal team. Contacts are seeded WITHOUT
  // email addresses (names/phones/title/company only).
  const teamContacts = TEAM.map((t) => ({
    project_id: projectId,
    type: "user" as const,
    first_name: t.first,
    last_name: t.last,
    email: null,
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

  // 3) Subcontractors — seed the buyout roster into the Directory plus a few
  // buyout email threads. One sub (random) is left unanswered (the "slow" sub),
  // so the trainee has to chase them by phone or follow up by email.
  await seedBuyoutEmails(supabase, {
    projectId,
    ownerUserId,
    pmName,
    pmEmail,
    pmFirst,
    projectLabel: label,
  });

  // 4) External inbox senders — the owner's rep, vendors, and the
  // utility/AHJ/design-team scenario contacts who will email the trainee as
  // days advance (see lib/training-inbox.ts). Seeded into the Directory with
  // email + phone so the trainee can reach out to them. (Internal senders
  // like the accounting manager are part of TEAM above; seedContact:false
  // senders are already in the Directory via the sub roster.)
  const externalSenders = Object.values(INBOX_SENDERS).filter(
    (s) => !s.internal && s.seedContact !== false,
  );
  const externalContacts = externalSenders.map((s) => ({
    project_id: projectId,
    type: "user" as const,
    first_name: s.first,
    last_name: s.last,
    email: inboxSenderEmail(s, domain),
    phone: s.phone,
    company: s.company,
    job_title: s.title,
  }));
  await supabase.from("directory_contacts").insert(externalContacts);
}

/**
 * Delivers every scheduled inbound email (lib/training-inbox.ts) whose day is
 * ≤ the sandbox's current in-sim day and that hasn't been delivered yet.
 * Called from the day-advance PATCH so mail "arrives" as the trainee completes
 * days; the ≤ + catch-up shape makes it idempotent (dedupe by deterministic
 * graph_conversation_id) and self-healing if a delivery was ever missed.
 * Best-effort — callers should not let a failure block the day advance.
 */
export async function deliverTrainingInboxThroughDay(
  supabase: SupabaseClient,
  opts: { projectId: string; day: number },
): Promise<void> {
  const due = TRAINING_INBOX_EMAILS.filter((e) => e.day <= opts.day);
  if (due.length === 0) return;

  // Which inbox threads already exist for this project?
  const { data: existing } = await supabase
    .from("project_email_threads")
    .select("graph_conversation_id")
    .eq("project_id", opts.projectId)
    .like("graph_conversation_id", "training-inbox-%");
  const have = new Set(
    ((existing ?? []) as { graph_conversation_id: string }[]).map(
      (r) => r.graph_conversation_id,
    ),
  );
  const missing = due.filter((e) => !have.has(inboxConversationId(e.slug)));
  if (missing.length === 0) return;

  // Resolve the PM + GC company context (same shape as the launch seeding).
  const { data: project } = await supabase
    .from("projects")
    .select("training_owner_id, training_project_type, company_id")
    .eq("id", opts.projectId)
    .maybeSingle();
  if (!project?.training_owner_id) return;

  let companyName = DEFAULT_COMPANY;
  if (project.company_id) {
    const { data: company } = await supabase
      .from("companies")
      .select("name")
      .eq("id", project.company_id)
      .maybeSingle();
    if (company?.name) companyName = company.name;
  }
  const domain = emailDomain(companyName);

  const { data: owner } = await supabase
    .from("users")
    .select("first_name, last_name, email, username")
    .eq("id", project.training_owner_id)
    .maybeSingle();
  const pmName =
    [owner?.first_name, owner?.last_name].filter(Boolean).join(" ").trim() ||
    owner?.username ||
    "Project Manager";
  const pmEmail = owner?.email || emailFor("project", "manager", domain);
  const pmFirst = (owner?.first_name || pmName).split(/\s+/)[0] || "there";

  const ctx: InboxCtx = {
    pmFirst,
    pmName,
    projectLabel: projectTypeLabel(project.training_project_type ?? ""),
    companyName,
  };

  // Self-heal the Directory: sandboxes launched before a sender existed won't
  // have their contact, so insert any missing external senders for the mail
  // being delivered (phone lookup + reply-persona grounding both depend on it).
  const senderKeys = [...new Set(missing.map((e) => e.senderKey))];
  const needContacts = senderKeys
    .map((k) => INBOX_SENDERS[k])
    .filter((s): s is NonNullable<typeof s> => !!s && !s.internal && s.seedContact !== false);
  if (needContacts.length > 0) {
    const { data: contacts } = await supabase
      .from("directory_contacts")
      .select("email")
      .eq("project_id", opts.projectId)
      .in(
        "email",
        needContacts.map((s) => inboxSenderEmail(s, domain)),
      );
    const haveEmails = new Set(
      ((contacts ?? []) as { email: string | null }[]).map((c) =>
        (c.email ?? "").toLowerCase(),
      ),
    );
    const inserts = needContacts
      .filter((s) => !haveEmails.has(inboxSenderEmail(s, domain).toLowerCase()))
      .map((s) => ({
        project_id: opts.projectId,
        type: "user" as const,
        first_name: s.first,
        last_name: s.last,
        email: inboxSenderEmail(s, domain),
        phone: s.phone,
        company: s.company,
        job_title: s.title,
      }));
    if (inserts.length > 0) await supabase.from("directory_contacts").insert(inserts);
  }

  // Older scheduled days deliver first; stagger sent_at by a minute so the
  // thread list orders deterministically when several land in one catch-up.
  const sorted = [...missing].sort((a, b) => a.day - b.day);
  const baseMs = Date.now() - sorted.length * 60_000;

  for (let i = 0; i < sorted.length; i++) {
    const e = sorted[i];
    const sender = INBOX_SENDERS[e.senderKey];
    if (!sender) continue;
    const senderName = `${sender.first} ${sender.last}`;
    const senderAddr = inboxSenderEmail(sender, domain);
    const convId = inboxConversationId(e.slug);
    const bodyHtml = e.html(ctx);
    const bodyText = htmlToText(bodyHtml);
    const sentIso = new Date(baseMs + i * 60_000).toISOString();

    const { data: thread } = await supabase
      .from("project_email_threads")
      .insert({
        project_id: opts.projectId,
        graph_conversation_id: convId,
        subject: e.subject,
        participants: [senderName, pmName],
        latest_message_preview: bodyText.slice(0, 280),
        latest_received_at: sentIso,
        message_count: 1,
        linked_by: project.training_owner_id,
        linked_at: sentIso,
      })
      .select("id")
      .single();
    if (!thread?.id) continue;

    await supabase.from("project_email_messages").insert({
      thread_id: thread.id,
      project_id: opts.projectId,
      provider_message_id: `${convId}-1`,
      from_name: senderName,
      from_address: senderAddr,
      to_recipients: [{ name: pmName, address: pmEmail }],
      cc_recipients: [],
      subject: e.subject,
      sent_at: sentIso,
      body_text: bodyText,
      body_html: bodyHtml,
      snippet: bodyText.slice(0, 200),
      synced_at: sentIso,
    });
  }
}

function tradeSlug(trade: string): string {
  return trade
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** ISO timestamp `daysAgo` days before now. */
function daysAgoIso(daysAgo: number): string {
  return new Date(Date.now() - daysAgo * 86_400_000).toISOString();
}

/**
 * Seeds the subcontractor directory and a set of buyout email threads
 * (trainee → sub). The non-slow subs come with a prompt bid response; one
 * randomly-chosen sub is left unanswered so the trainee experiences a sub who's
 * slow to respond. Best-effort.
 */
async function seedBuyoutEmails(
  supabase: SupabaseClient,
  opts: {
    projectId: string;
    ownerUserId: string;
    pmName: string;
    pmEmail: string;
    pmFirst: string;
    projectLabel: string;
  },
): Promise<void> {
  const { projectId, ownerUserId, pmName, pmEmail, pmFirst, projectLabel } = opts;

  // Directory — every sub in the roster, with email + phone so the trainee can
  // either email or call them.
  const subContacts = TRAINING_SUBS.map((s) => ({
    project_id: projectId,
    type: "user" as const,
    first_name: s.first,
    last_name: s.last,
    email: subEmailFor(s),
    phone: s.phone,
    company: s.company,
    job_title: `${s.trade} — Subcontractor`,
  }));
  await supabase.from("directory_contacts").insert(subContacts);

  // Buyout threads for the early-buyout trades; one (random) is the slow sub.
  const buyoutSubs = TRAINING_SUBS.slice(0, BUYOUT_THREAD_COUNT);
  const slowIndex = Math.floor(Math.random() * buyoutSubs.length);

  for (let i = 0; i < buyoutSubs.length; i++) {
    const sub = buyoutSubs[i];
    const isSlow = i === slowIndex;
    const subName = `${sub.first} ${sub.last}`;
    const subAddr = subEmailFor(sub);
    const convId = `training-buyout-${tradeSlug(sub.trade)}`;
    const subject = `Buyout — ${sub.trade} Scope & Pricing`;

    // The trainee's outreach is a few days old. Responsive subs replied a couple
    // days later; the slow sub's (older) outreach is still unanswered.
    const outreachIso = daysAgoIso(isSlow ? 6 : 4);
    const responseIso = daysAgoIso(2);

    const outreachHtml = buildBuyoutOutreachHtml({ pmFirst, sub, projectLabel });
    const outreachText = htmlToText(outreachHtml);
    const responseHtml = buildSeededBidResponseHtml({ pmFirst, sub });
    const responseText = htmlToText(responseHtml);

    const latestText = isSlow ? outreachText : responseText;
    const latestIso = isSlow ? outreachIso : responseIso;

    const { data: t } = await supabase
      .from("project_email_threads")
      .insert({
        project_id: projectId,
        graph_conversation_id: convId,
        subject,
        participants: [pmName, subName],
        latest_message_preview: latestText.slice(0, 280),
        latest_received_at: latestIso,
        message_count: isSlow ? 1 : 2,
        linked_by: ownerUserId,
        linked_at: outreachIso,
      })
      .select("id")
      .single();

    if (!t?.id) continue;

    const messages: Record<string, unknown>[] = [
      {
        thread_id: t.id,
        project_id: projectId,
        provider_message_id: `${convId}-1`,
        from_name: pmName,
        from_address: pmEmail,
        to_recipients: [{ name: subName, address: subAddr }],
        cc_recipients: [],
        subject,
        sent_at: outreachIso,
        body_text: outreachText,
        body_html: outreachHtml,
        snippet: outreachText.slice(0, 200),
        synced_at: outreachIso,
      },
    ];
    if (!isSlow) {
      messages.push({
        thread_id: t.id,
        project_id: projectId,
        provider_message_id: `${convId}-2`,
        from_name: subName,
        from_address: subAddr,
        to_recipients: [{ name: pmName, address: pmEmail }],
        cc_recipients: [],
        subject: `Re: ${subject}`,
        sent_at: responseIso,
        body_text: responseText,
        body_html: responseHtml,
        snippet: responseText.slice(0, 200),
        synced_at: responseIso,
      });
    }
    await supabase.from("project_email_messages").insert(messages);
  }
}
