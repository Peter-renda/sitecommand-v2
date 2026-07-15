/**
 * Day-scheduled inbound emails for "SiteCommand Training" sandboxes.
 *
 * As the trainee advances the in-sim day, new emails "arrive" in the project
 * inbox from the people a real PM hears from constantly:
 *
 *   - Ownership (the owner's development rep) — kickoff asks, scope-change
 *     inquiries, schedule pressure, early-access requests.
 *   - Vendors / suppliers — long-lead quotes, submittal deadlines, price
 *     increase notices, delivery slips.
 *   - The GC's own accounting department — vendor invoices to code + approve
 *     (rendered as an in-body invoice), billing-cycle reminders, missing lien
 *     waivers, retainage/closeout billing prep.
 *   - Lesson-driven scenario mail — the utility company (load letter, panel
 *     locations, the energization gate), the AHJ (permit conditions, the fire
 *     alarm acceptance test, ERRC), the civil engineer of record (LOD/tree
 *     save, bioretention protection, site closeout), the testing agency
 *     (failed compaction, low breaks, unsuitable soils), the architect
 *     (submittal returns, mock-ups), subs and the controls integrator. Each of
 *     these maps to Training → Lessons content (lesson ids noted per email)
 *     so the trainee gets to apply what the curriculum teaches.
 *
 * This module is pure content and client-safe: the Day panel imports
 * `inboxEmailsForDay` to show a "new mail" hint, and the server-side delivery
 * lives in lib/training-seed.ts (`deliverTrainingInboxThroughDay`), which
 * writes threads/messages into project_email_threads / project_email_messages
 * exactly like the seeded handoff + buyout emails.
 */

export type InboxSender = {
  key: string;
  first: string;
  last: string;
  title: string;
  /** Display company. Internal senders resolve to the GC company at delivery. */
  company: string;
  phone: string;
  /** Internal = works for the GC (accounting); email derived from the GC domain. */
  internal?: boolean;
  /**
   * false = don't seed a Directory contact for this sender (used when the
   * persona is already in the Directory another way — e.g. a TRAINING_SUBS
   * roster member, whose subEmailFor() address matches inboxSenderEmail()).
   */
  seedContact?: boolean;
};

export type InboxCtx = {
  pmFirst: string;
  pmName: string;
  projectLabel: string;
  companyName: string;
};

export type TrainingInboxEmail = {
  /** In-sim day the email arrives (delivered when training_day reaches it). */
  day: number;
  /** Stable id — the thread's graph_conversation_id is `training-inbox-{slug}`. */
  slug: string;
  senderKey: string;
  subject: string;
  html: (ctx: InboxCtx) => string;
};

export const INBOX_SENDERS: Record<string, InboxSender> = {
  owner_rep: {
    key: "owner_rep",
    first: "Elaine",
    last: "Whitfield",
    title: "Director of Development",
    company: "Meridian Development Partners",
    phone: "(404) 555-0410",
  },
  accounting: {
    key: "accounting",
    first: "Janet",
    last: "Kim",
    title: "Accounting Manager",
    company: "GC", // resolved to the trainee's company at delivery time
    phone: "(404) 555-0195",
    internal: true,
  },
  switchgear_vendor: {
    key: "switchgear_vendor",
    first: "Dana",
    last: "Whitcomb",
    title: "Regional Sales Manager",
    company: "Gulf States Switchgear",
    phone: "(678) 555-0322",
  },
  elevator_vendor: {
    key: "elevator_vendor",
    first: "Tom",
    last: "Garrity",
    title: "Project Sales Engineer",
    company: "Apex Elevator Systems",
    phone: "(678) 555-0348",
  },
  roofing_supplier: {
    key: "roofing_supplier",
    first: "Carla",
    last: "Mendes",
    title: "Account Manager",
    company: "Crestline Building Products",
    phone: "(770) 555-0361",
  },
  hvac_vendor: {
    key: "hvac_vendor",
    first: "Ray",
    last: "Delgado",
    title: "Equipment Sales Manager",
    company: "Pinnacle HVAC Equipment",
    phone: "(770) 555-0377",
  },
  // ── Lesson-driven scenario senders ──────────────────────────────────────
  utility_rep: {
    key: "utility_rep",
    first: "Marcus",
    last: "Reed",
    title: "Service Design Consultant",
    company: "Piedmont Power & Light",
    phone: "(770) 555-0455",
  },
  building_dept: {
    key: "building_dept",
    first: "Angela",
    last: "Torres",
    title: "Inspections Coordinator, Building Department",
    company: "City of Riverton",
    phone: "(770) 555-0470",
  },
  fire_marshal: {
    key: "fire_marshal",
    first: "Sandra",
    last: "Okoye",
    title: "Deputy Fire Marshal",
    company: "City of Riverton",
    phone: "(770) 555-0482",
  },
  civil_engineer: {
    key: "civil_engineer",
    first: "Priya",
    last: "Sharma",
    title: "Project Engineer, PE (Civil)",
    company: "Harlan Civil Group",
    phone: "(404) 555-0510",
  },
  testing_agency: {
    key: "testing_agency",
    first: "Owen",
    last: "Blake",
    title: "Field Operations Manager",
    company: "Meridian Testing Labs",
    phone: "(770) 555-0429",
  },
  architect: {
    key: "architect",
    first: "Laura",
    last: "Chen",
    title: "Project Architect",
    company: "Halford Studio Architects",
    phone: "(404) 555-0520",
  },
  controls_sub: {
    key: "controls_sub",
    first: "Alan",
    last: "Reyes",
    title: "Senior Systems Engineer",
    company: "Corebridge Controls",
    phone: "(678) 555-0533",
  },
  // Matches the TRAINING_SUBS fire protection roster member — same
  // first/last/company, so inboxSenderEmail() equals subEmailFor() and the
  // existing Directory contact (seeded with the sub roster) is reused.
  fire_sub: {
    key: "fire_sub",
    first: "Aisha",
    last: "Coleman",
    title: "Fire Protection — Subcontractor",
    company: "Sentinel Fire Systems",
    phone: "(404) 555-0291",
    seedContact: false,
  },
};

/** Fixed external email address for a sender, derived from their company. */
export function inboxSenderEmail(sender: InboxSender, gcDomain: string): string {
  const domain = sender.internal
    ? gcDomain
    : `${sender.company.toLowerCase().replace(/[^a-z0-9]/g, "") || "vendor"}.com`;
  const local = `${sender.first}.${sender.last}`.toLowerCase().replace(/[^a-z0-9.]/g, "");
  return `${local}@${domain}`;
}

export function inboxConversationId(slug: string): string {
  return `training-inbox-${slug}`;
}

function money(value: number): string {
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** An invoice rendered as an in-body HTML table (self-contained — no attachment). */
function invoiceHtml(inv: {
  vendor: string;
  vendorAddress: string;
  number: string;
  date: string;
  terms: string;
  lines: { desc: string; amount: number }[];
}): string {
  const total = inv.lines.reduce((s, l) => s + l.amount, 0);
  const rows = inv.lines
    .map(
      (l) => `    <tr>
      <td style="padding:6px 10px;border:1px solid #d1d5db;">${l.desc}</td>
      <td style="padding:6px 10px;border:1px solid #d1d5db;text-align:right;white-space:nowrap;">${money(l.amount)}</td>
    </tr>`,
    )
    .join("\n");
  return `
<table style="border-collapse:collapse;width:100%;max-width:560px;margin:12px 0;font-size:13px;">
  <tr>
    <td colspan="2" style="padding:8px 10px;border:1px solid #d1d5db;background:#f3f4f6;">
      <strong>INVOICE ${inv.number}</strong><br/>
      ${inv.vendor} — ${inv.vendorAddress}<br/>
      Invoice date: ${inv.date} · Terms: ${inv.terms}
    </td>
  </tr>
${rows}
  <tr>
    <td style="padding:6px 10px;border:1px solid #d1d5db;text-align:right;"><strong>Total Due</strong></td>
    <td style="padding:6px 10px;border:1px solid #d1d5db;text-align:right;white-space:nowrap;"><strong>${money(total)}</strong></td>
  </tr>
</table>`.trim();
}

/**
 * The full inbound schedule, ordered by day. Days line up with the PM training
 * calendar (lib/training-schedule.ts): buyout runs Days 1-7, then the
 * construction phases land on Days 14 / 28 / 42 / 56 / 70 — the trainee visits
 * every day in between one at a time, so mail on any day gets seen.
 */
export const TRAINING_INBOX_EMAILS: TrainingInboxEmail[] = [
  // ── Ownership ──────────────────────────────────────────────────────────
  {
    day: 2,
    slug: "owner-kickoff",
    senderKey: "owner_rep",
    subject: "Introductions + What We Need From Your Team",
    html: (ctx) =>
      `
<p>Hi ${ctx.pmFirst},</p>

<p>David let me know you'll be running the ${ctx.projectLabel} project for ${ctx.companyName} — welcome aboard. I'll be your day-to-day contact on the ownership side, and I sign off on pay applications and change orders before they go to our investment committee.</p>

<p>A few things we'll need from your team as you get set up:</p>
<ul>
  <li><strong>Baseline schedule</strong> — per the contract, within 30 days of NTP.</li>
  <li><strong>Schedule of Values</strong> — draft to me for review before your first pay application. Billing cutoff is the 25th of each month.</li>
  <li><strong>Insurance certificates</strong> — GC and all subs, before anyone mobilizes.</li>
  <li><strong>Monthly report</strong> — schedule status, cost summary, change order log, procurement status, and photos. First one due end of this month.</li>
</ul>

<p>Let's also get the OAC kickoff on the calendar in the next two weeks — I'll bring our asset management team, you bring your super and the design team.</p>

<p>Looking forward to it.</p>

<p>Elaine Whitfield<br/>Director of Development, Meridian Development Partners<br/>(404) 555-0410</p>
`.trim(),
  },
  {
    day: 15,
    slug: "owner-ev-charging",
    senderKey: "owner_rep",
    subject: "Potential Scope Add — EV Charging Stations (Need ROM Pricing)",
    html: (ctx) =>
      `
<p>${ctx.pmFirst},</p>

<p>Our leasing team is pushing to add <strong>EV charging stations</strong> — they're seeing it in every competitive property. Before we take it to committee, I need a rough order of magnitude from you:</p>

<ul>
  <li>Eight (8) Level 2 dual-port stations in the main parking area.</li>
  <li>Conduit and panel capacity for eight future stations.</li>
  <li>Any utility service or transformer impact — this is the part that worries me.</li>
</ul>

<p>Can you get me a <strong>ROM number and schedule impact within two weeks</strong>? Please log it as a potential change on your end so it's tracked — no commitment yet, but if the number works we'd want it priced formally right after.</p>

<p>One flag: if this touches your electrical service sizing, tell me <em>now</em> rather than after switchgear is released.</p>

<p>Elaine</p>
`.trim(),
  },
  {
    day: 29,
    slug: "owner-schedule-check",
    senderKey: "owner_rep",
    subject: "Board Meeting Next Week — Schedule + CO Log Needed",
    html: (ctx) =>
      `
<p>${ctx.pmFirst},</p>

<p>I present this project to our board next Thursday and I need current numbers, not last month's report:</p>

<ul>
  <li><strong>Updated schedule</strong> — is substantial completion holding? If there's slip risk, I need to hear it from you first, with a recovery plan, not discover it in the schedule narrative.</li>
  <li><strong>Change order log</strong> — executed and pending, with the contingency balance.</li>
  <li><strong>Procurement status</strong> — specifically switchgear and elevators. The board asks about long-lead every single time.</li>
</ul>

<p>Can you have that to me by <strong>Monday close of business</strong>?</p>

<p>Also — the EV charging ROM: committee liked the number. Expect a formal request to price it as a change order shortly.</p>

<p>Elaine</p>
`.trim(),
  },
  {
    day: 57,
    slug: "owner-early-access",
    senderKey: "owner_rep",
    subject: "Early Access Request — FF&E and Low-Voltage Vendors",
    html: (ctx) =>
      `
<p>${ctx.pmFirst},</p>

<p>As we get closer to turnover, our FF&E installer and our IT/low-voltage vendor are asking for <strong>early access</strong> to begin staging and rough-setting equipment ahead of substantial completion.</p>

<p>Before I promise them anything, I need from you:</p>
<ul>
  <li>Which areas can realistically be released early, and when.</li>
  <li>Your insurance and badging requirements for owner vendors on an active site.</li>
  <li>Any coordination constraints — I don't want their work interfering with your punch or commissioning.</li>
</ul>

<p>I know early access on an active site is a headache, but it buys us two weeks on our opening date. Let's discuss at the next OAC.</p>

<p>Elaine</p>
`.trim(),
  },

  // ── Vendors / suppliers ────────────────────────────────────────────────
  {
    day: 3,
    slug: "vendor-switchgear-quote",
    senderKey: "switchgear_vendor",
    subject: "Switchgear Proposal — 42-Week Lead Time, Pricing Holds 30 Days",
    html: (ctx) =>
      `
<p>Hi ${ctx.pmFirst},</p>

<p>Thanks for the inquiry on the ${ctx.projectLabel} project. Proposal below for the main electrical distribution package:</p>

<table style="border-collapse:collapse;width:100%;max-width:560px;margin:12px 0;font-size:13px;">
  <tr><td style="padding:6px 10px;border:1px solid #d1d5db;">Main switchboard, 3000A, 480/277V</td><td style="padding:6px 10px;border:1px solid #d1d5db;text-align:right;">$412,000.00</td></tr>
  <tr><td style="padding:6px 10px;border:1px solid #d1d5db;">Distribution panels + feeders package</td><td style="padding:6px 10px;border:1px solid #d1d5db;text-align:right;">$188,500.00</td></tr>
  <tr><td style="padding:6px 10px;border:1px solid #d1d5db;">Startup, testing & commissioning support</td><td style="padding:6px 10px;border:1px solid #d1d5db;text-align:right;">$24,800.00</td></tr>
  <tr><td style="padding:6px 10px;border:1px solid #d1d5db;text-align:right;"><strong>Total</strong></td><td style="padding:6px 10px;border:1px solid #d1d5db;text-align:right;"><strong>$625,300.00</strong></td></tr>
</table>

<p>Two things you need to know up front:</p>
<ul>
  <li><strong>Current factory lead time is 42 weeks</strong> from approved submittals — and it has been getting longer, not shorter.</li>
  <li><strong>This pricing holds for 30 days.</strong> Copper has been volatile and I can't protect the number past that.</li>
</ul>

<p>If this project needs gear on site next year, the math only works if we get a PO and start submittals in the next few weeks. Happy to jump on a call to walk through the schedule.</p>

<p>Dana Whitcomb<br/>Regional Sales Manager, Gulf States Switchgear<br/>(678) 555-0322</p>
`.trim(),
  },
  {
    day: 16,
    slug: "vendor-elevator-submittals",
    senderKey: "elevator_vendor",
    subject: "Elevator Submittal Package Transmitted — Fab Slot Deadline",
    html: (ctx) =>
      `
<p>${ctx.pmFirst},</p>

<p>Our full submittal package for the elevator scope went out to you today — shop drawings, cab finishes, fixture cut sheets, and hoistway layout drawings.</p>

<p>Here's the schedule reality: we're holding a <strong>fabrication slot that requires approved submittals in 3 weeks</strong>. If approvals come back later than that, we lose the slot and the next one is 8 weeks out — which puts your elevator delivery past where I suspect your schedule needs it.</p>

<p>My asks:</p>
<ul>
  <li>Get the package in front of your architect this week and flag the review deadline.</li>
  <li>If they'll have comments, a partial release on the hoistway/structural items keeps fabrication moving while cab finishes get sorted.</li>
  <li>Confirm your hoistway dimensions against our layout drawings — that's the #1 thing that bites projects at install.</li>
</ul>

<p>Call me with any questions — this one's worth staying ahead of.</p>

<p>Tom Garrity<br/>Project Sales Engineer, Apex Elevator Systems<br/>(678) 555-0348</p>
`.trim(),
  },
  {
    day: 30,
    slug: "vendor-roofing-price-increase",
    senderKey: "roofing_supplier",
    subject: "Price Increase Notice — Roofing Materials, Effective 1st of Next Month",
    html: (ctx) =>
      `
<p>Hi ${ctx.pmFirst},</p>

<p>Heads-up as a courtesy to our GC partners: our manufacturers have announced a <strong>6% price increase on membrane, insulation, and cover board, effective the 1st of next month</strong>.</p>

<p>What this means for your project:</p>
<ul>
  <li>Any order <strong>placed and released before the cutoff holds current pricing</strong>, even if it ships later.</li>
  <li>Orders after the cutoff will be quoted at the new list — on a typical roof package that's real money.</li>
  <li>If your roofing sub hasn't released material yet, now is the time to push them.</li>
</ul>

<p>I'd recommend checking where your roofing subcontract and material release stand. If the sub needs a storage arrangement to buy early, we can hold released material in our yard at no charge for up to 90 days.</p>

<p>Carla Mendes<br/>Account Manager, Crestline Building Products<br/>(770) 555-0361</p>
`.trim(),
  },
  {
    day: 43,
    slug: "vendor-rtu-delay",
    senderKey: "hvac_vendor",
    subject: "RTU Delivery Slip — 3 Weeks, Partial Ship Available",
    html: (ctx) =>
      `
<p>${ctx.pmFirst},</p>

<p>I hate sending this email, but you need it early rather than late: the factory just pushed your rooftop unit delivery by <strong>three weeks</strong>. A compressor supplier issue on their end — it's hitting every order in the queue, not just yours.</p>

<p>Options:</p>
<ul>
  <li><strong>Partial ship</strong> — units 1 through 4 can ship on the original date; the remaining units follow three weeks later. Two crane picks instead of one, but your mechanical sub can start setting and piping the first units on time.</li>
  <li><strong>Hold and ship complete</strong> — everything arrives together, three weeks late.</li>
</ul>

<p>If rooftop equipment is on your critical path for dry-in or startup, partial ship is almost certainly the right call — but I need your decision <strong>within a week</strong> to lock the first shipment.</p>

<p>Let me know how you want to play it, and I'm happy to get on a call with your mechanical sub to coordinate.</p>

<p>Ray Delgado<br/>Equipment Sales Manager, Pinnacle HVAC Equipment<br/>(770) 555-0377</p>
`.trim(),
  },

  // ── Accounting (internal) ──────────────────────────────────────────────
  {
    day: 4,
    slug: "acct-invoice-surveying",
    senderKey: "accounting",
    subject: "Invoice for Approval — GeoSouth Surveying INV-2214 ($8,450)",
    html: (ctx) =>
      `
<p>Hi ${ctx.pmFirst},</p>

<p>Welcome to the project! I'm your accounting contact — all vendor invoices route through me, and I'll need <strong>your approval and a cost code</strong> on each before anything gets paid.</p>

<p>First one for you — the site survey work from preconstruction:</p>

${invoiceHtml({
  vendor: "GeoSouth Surveying, Inc.",
  vendorAddress: "1180 Commerce Dr, Suite 210, Atlanta, GA",
  number: "INV-2214",
  date: "last week",
  terms: "Net 30",
  lines: [
    { desc: "Boundary & topographic survey — full site", amount: 6200 },
    { desc: "Construction staking — building corners & control points", amount: 1850 },
    { desc: "Reimbursables (plots, filing fees)", amount: 400 },
  ],
})}

<p>Please reply with your <strong>approval and the budget cost code</strong> to charge, and I'll process it in this week's run. Our check run is Thursdays; anything approved by Wednesday noon makes the cut.</p>

<p>Janet Kim<br/>Accounting Manager, ${ctx.companyName}<br/>(404) 555-0195</p>
`.trim(),
  },
  {
    day: 6,
    slug: "acct-billing-calendar",
    senderKey: "accounting",
    subject: "Billing Calendar — Owner Cutoff the 25th, SOV Needed First",
    html: (ctx) =>
      `
<p>${ctx.pmFirst},</p>

<p>Getting ahead of your first billing cycle. Key dates every month:</p>

<ul>
  <li><strong>20th</strong> — sub pay applications due to us (with their updated SOVs and prior-month lien waivers).</li>
  <li><strong>22nd</strong> — you review/approve sub billings against actual field progress.</li>
  <li><strong>25th</strong> — owner pay application cutoff (Meridian is firm on this).</li>
</ul>

<p>Before any of that can happen, I need:</p>
<ul>
  <li>The <strong>prime contract Schedule of Values</strong> set up in the system.</li>
  <li><strong>Sub SOVs</strong> collected from every awarded subcontractor — I can't process a sub invoice without an approved SOV behind it.</li>
  <li>Executed subcontracts and current COIs on file before anyone's first invoice.</li>
</ul>

<p>One habit that will save you pain: <strong>never approve a sub's pay app without the prior month's lien waivers in hand.</strong> I will bounce them back regardless, so catching it early saves everyone a cycle.</p>

<p>Janet</p>
`.trim(),
  },
  {
    day: 17,
    slug: "acct-invoice-testing",
    senderKey: "accounting",
    subject: "Invoice for Approval — Meridian Testing Labs INV-0387 ($12,300)",
    html: (ctx) =>
      `
<p>${ctx.pmFirst},</p>

<p>Next one for your review — materials testing and special inspections for the foundation work:</p>

${invoiceHtml({
  vendor: "Meridian Testing Labs",
  vendorAddress: "445 Industrial Blvd, Marietta, GA",
  number: "INV-0387",
  date: "this week",
  terms: "Net 30",
  lines: [
    { desc: "Concrete cylinder breaks — footings & foundation walls (38 sets)", amount: 5700 },
    { desc: "Soil compaction testing — building pad & utility trenches", amount: 3800 },
    { desc: "Special inspections — reinforcing steel placement (3 visits)", amount: 2400 },
    { desc: "Trip charges", amount: 400 },
  ],
})}

<p>Reply with <strong>approval + cost code</strong> when you've had a look. Also — their proposal was a not-to-exceed of $45,000 for the full project; this brings them to roughly $18k billed to date, so you're fine, just keep an eye on the burn rate as structure ramps up.</p>

<p>Janet</p>
`.trim(),
  },
  {
    day: 31,
    slug: "acct-missing-lien-waiver",
    senderKey: "accounting",
    subject: "Holding Payment — Missing Lien Waiver from Bedrock Concrete",
    html: (ctx) =>
      `
<p>${ctx.pmFirst},</p>

<p>Flag on this month's payment run: <strong>Bedrock Concrete's pay application is approved, but their prior-month conditional lien waiver never came in.</strong> Per policy (and our prime contract), I can't release their payment without it.</p>

<p>What I need from you:</p>
<ul>
  <li>Chase their office for the executed conditional waiver for last month's payment.</li>
  <li>If they used any sub-tier suppliers on the pour (rebar, pump), we need those lower-tier waivers too.</li>
</ul>

<p>Their payment is otherwise ready to go — the moment the waiver lands, I'll release same-day. But if this drags past Friday, they slip to next week's run, and I'd rather you hear about it from me than from an angry concrete sub.</p>

<p>Janet</p>
`.trim(),
  },
  {
    day: 44,
    slug: "acct-invoice-rental-dispute",
    senderKey: "accounting",
    subject: "Invoice — TriState Equipment INV-5521 ($19,847) — Rate Looks Wrong",
    html: (ctx) =>
      `
<p>${ctx.pmFirst},</p>

<p>Before you approve this one, look closely — <strong>I think we're being overbilled.</strong></p>

${invoiceHtml({
  vendor: "TriState Equipment Rentals",
  vendorAddress: "2200 Fulton Industrial Pkwy, Atlanta, GA",
  number: "INV-5521",
  date: "this week",
  terms: "Net 30",
  lines: [
    { desc: "Telehandler 10K — 4 weeks @ $4,200/wk", amount: 16800 },
    { desc: "Fuel & delivery charges", amount: 1230 },
    { desc: "Damage waiver (10%)", amount: 1817 },
  ],
})}

<p>Two problems I see:</p>
<ul>
  <li>The telehandler is billed at <strong>$4,200/week — our signed rental agreement says $3,600/week</strong>. Over four weeks that's $2,400 plus the inflated damage waiver on top.</li>
  <li>We signed a <strong>damage waiver opt-out</strong> (it's covered under our equipment floater), so that 10% line shouldn't be there at all.</li>
</ul>

<p>Please <strong>dispute this with their office rather than approving as-is</strong> — reference the rental agreement rate and the waiver opt-out, and ask for a corrected invoice. This is exactly the kind of thing that quietly eats a general conditions budget if nobody's checking.</p>

<p>Janet</p>
`.trim(),
  },
  {
    day: 58,
    slug: "acct-closeout-billing",
    senderKey: "accounting",
    subject: "Closeout Billing Prep — Retainage, Final Waivers, Final Pay Apps",
    html: (ctx) =>
      `
<p>${ctx.pmFirst},</p>

<p>We're close enough to the end that final billing needs to get on your radar now — closeout money is always slower than anyone expects. Here's what has to happen, in order:</p>

<ul>
  <li><strong>Final change orders executed</strong> — every pending CO needs to be signed or dead before final pay apps. I can't process "final" billing against a moving contract value.</li>
  <li><strong>Sub final pay applications</strong> — including their retainage. Each one requires a <strong>final unconditional lien waiver</strong> (and lower-tier waivers where applicable) before release.</li>
  <li><strong>Retainage release to subs</strong> — per contract, tied to substantial completion and punch completion for their scope. Don't promise a sub their retainage until their punch is actually closed.</li>
  <li><strong>Owner final pay app</strong> — our retainage from Meridian releases against substantial completion, the closeout package, and final waivers from us. The faster your O&Ms and as-builts land, the faster that check comes.</li>
</ul>

<p>Send me the list of subs whose scopes are fully complete and punch-clear, and I'll start staging their final paperwork. Nice work getting this one to the finish line.</p>

<p>Janet</p>
`.trim(),
  },

  // ── Lesson-driven scenario mail ────────────────────────────────────────
  // Each of these exercises specific Training → Lessons content (lesson ids
  // noted per email) so the trainee applies the curriculum, not just reads it.

  // Lessons: mep-electrical-distribution, cn-longlead — the utility as the
  // longest external dependency; the load letter and equipment locations ask.
  {
    day: 5,
    slug: "utility-service-application",
    senderKey: "utility_rep",
    subject: "New Service Application — Load Letter & Equipment Locations Needed",
    html: (ctx) =>
      `
<p>Good morning ${ctx.pmFirst},</p>

<p>I've been assigned as the service design consultant for the ${ctx.projectLabel} project. Before I can start the service design and get you into our engineering queue, I need the following from your team:</p>

<ul>
  <li><strong>Completed service application</strong> — form attached on our portal; the owner or GC can submit.</li>
  <li><strong>Load letter from your electrical engineer</strong> — total connected load and demand load in amps, service voltage (I'm assuming 480/277V, 3-phase — confirm), and any large motor or EV charging loads we should plan for.</li>
  <li><strong>Load center / panel locations and ampacities</strong> — where your main switchgear and distribution panels will sit, and the main service size, so we can work out the metering configuration.</li>
  <li><strong>Site plan showing the proposed transformer pad location</strong> and the primary conduit route from our nearest point of service. You build the pad and primary conduit to our standards; we set the transformer.</li>
  <li><strong>Easement execution</strong> — our legal team needs the recorded easement before we'll energize. This one takes owners longer than anyone expects; start it now.</li>
</ul>

<p>Timeline reality: once I have a complete package, service design takes <strong>6-8 weeks</strong>, and transformer procurement on our side is running <strong>several months</strong>. If your schedule needs permanent power next year, the clock starts when this package is complete — not when the building is ready.</p>

<p>Happy to do a site walk once your team has a proposed pad location.</p>

<p>Marcus Reed<br/>Service Design Consultant, Piedmont Power &amp; Light<br/>(770) 555-0455</p>
`.trim(),
  },

  // Lesson: sc-esc — SWPPP inspection log, corrective actions, tracking; the
  // compliance layer the PM owns daily, surfaced through owner pressure.
  {
    day: 9,
    slug: "owner-erosion-control",
    senderKey: "owner_rep",
    subject: "Erosion Control — Question From Our Lender's Site Visit",
    html: (ctx) =>
      `
<p>${ctx.pmFirst},</p>

<p>Our construction lender's inspector drove the site after the storms this weekend and sent me photos I didn't love: a run of <strong>silt fence laid over along the east property line</strong>, and what looks like <strong>mud tracked onto the public road</strong> at the entrance.</p>

<p>I need to be able to answer their questions, so please get back to me on:</p>
<ul>
  <li>Is the <strong>SWPPP inspection log current</strong> — including the required post-rain-event inspections from this weekend?</li>
  <li>Who is your designated erosion control inspector, and what <strong>corrective actions</strong> are open right now with what completion dates?</li>
  <li>When do the disturbed slopes on the east side get <strong>stabilized</strong>? The inspector specifically asked.</li>
</ul>

<p>You know I don't micromanage means and methods, but environmental compliance is a lender covenant on this deal — a notice of violation would be a genuine problem upstairs. Tell me it's handled and show me the paper.</p>

<p>Elaine</p>
`.trim(),
  },

  // Lessons: wf-permits, tech-testing-cx — permit conditions, the inspection
  // sequence, and the statement of special inspections as a CO prerequisite.
  {
    day: 11,
    slug: "city-permit-conditions",
    senderKey: "building_dept",
    subject: "Building Permit Issued — Conditions & Inspection Scheduling",
    html: (ctx) =>
      `
<p>Good afternoon,</p>

<p>Your building permit for the ${ctx.projectLabel} project has been issued. Please note the following conditions before you call for your first inspection:</p>

<ul>
  <li>The <strong>statement of special inspections</strong> is part of your permit. Your owner's testing agency must submit reports as work proceeds, and the <strong>final special inspections report is required before a Certificate of Occupancy</strong> will be issued.</li>
  <li>Inspections are requested through the city portal <strong>by 3:00 PM for next-business-day service</strong>. Footing inspections require the excavation open, reinforcing in place, and the approved plans on site.</li>
  <li>A full <strong>approved, stamped drawing set must be on site</strong> at every inspection. Inspectors will not inspect against unstamped or superseded sheets.</li>
  <li>Your <strong>land disturbance permit inspections are separate</strong> from building inspections and are handled by the stormwater division — different inspector, different scheduling line.</li>
  <li>Failed inspections require a re-inspection request and may carry a re-inspection fee after the second failure.</li>
</ul>

<p>Please make sure your superintendent has portal access set up before your footing work begins. Reply to this address with any scheduling questions.</p>

<p>Angela Torres<br/>Inspections Coordinator, Building Department — City of Riverton<br/>(770) 555-0470</p>
`.trim(),
  },

  // Lessons: sc-grading, sc-stormwater, sc-landscape — LOD/tree save fencing,
  // protecting bioretention from compaction, spot grade vs. rim conflicts.
  {
    day: 13,
    slug: "civil-grading-release",
    senderKey: "civil_engineer",
    subject: "Grading Release + Three Things to Protect Before the Dozer Starts",
    html: (ctx) =>
      `
<p>Hi ${ctx.pmFirst},</p>

<p>The revised grading plan is released for construction — the updated sheets are in the current set. Before mass grading starts, three things I'd ask your team to walk and physically verify, because they're the ones that go wrong on every project:</p>

<ul>
  <li><strong>Limits of disturbance and tree save fencing</strong> — the LOD line and both tree save areas need fencing up <em>before</em> clearing starts. The city arborist photographs these on their first drive-by, and replacement trees are priced per caliper inch.</li>
  <li><strong>Bioretention cell footprints</strong> — the two cells in the south parking area must be fenced off from equipment traffic for the whole job. If those subgrades get compacted by machines crossing them, the infiltration testing at closeout <strong>will fail</strong> and the cells get excavated and rebuilt at your cost. Treat them like tree save areas.</li>
  <li><strong>Structure ST-14</strong> — heads-up that I'm checking a discrepancy: the grading plan shows a spot grade at that inlet that doesn't match the rim elevation on the storm profile. I should have a plan revision or confirmation within the week — please have your sitework contractor <strong>hold off setting that structure</strong> until I confirm. If your team spots any other rim/grade conflicts during layout, send them my way as RFIs and I'll turn them around fast.</li>
</ul>

<p>I'd also recommend we get a grading start-up meeting on the calendar with your super and the sitework foreman — 45 minutes now saves everyone a rework fight later.</p>

<p>Priya Sharma, PE<br/>Project Engineer, Harlan Civil Group<br/>(404) 555-0510</p>
`.trim(),
  },

  // Lessons: tech-sitework, wf-quality — compaction verified lift by lift; a
  // failed lift buried under more lifts is expensive to find again.
  {
    day: 19,
    slug: "testing-failed-compaction",
    senderKey: "testing_agency",
    subject: "Failed Density Tests — Sanitary Trench Backfill, Area B",
    html: (ctx) =>
      `
<p>${ctx.pmFirst},</p>

<p>Flagging today's field results so this doesn't get buried under another lift of fill:</p>

<ul>
  <li>Two density tests on the <strong>sanitary trench backfill in Area B failed</strong> — 89% and 91% against a 95% standard proctor requirement. The material looked wet of optimum to our tech.</li>
  <li>More importantly: the crew had <strong>already placed the next lift over one of the failed areas</strong> before our results were in. That lift needs to come back out, the failed lift re-compacted (probably after drying), and both re-tested before anything goes back over it.</li>
</ul>

<p>Two asks for your super and the sitework foreman:</p>
<ul>
  <li>Hold the schedule on that trench run until we've retested — passing tests <strong>lift by lift</strong> is the requirement, and a failed lift under three more lifts becomes an excavation project.</li>
  <li>Call our office for testing <strong>before</strong> covering work, not after. Same-day service if you call by 2 PM.</li>
</ul>

<p>Full reports are in today's transmittal. Failed test locations are staked in the field.</p>

<p>Owen Blake<br/>Field Operations Manager, Meridian Testing Labs<br/>(770) 555-0429</p>
`.trim(),
  },

  // Lessons: sc-environmental, wf-change-events, com-clauses — the suspect-soil
  // field protocol and the differing-site-condition notice clock.
  {
    day: 21,
    slug: "testing-suspect-soils",
    senderKey: "testing_agency",
    subject: "Unsuitable Material at NE Building Pad — Recommend You Stop & Evaluate",
    html: (ctx) =>
      `
<p>${ctx.pmFirst},</p>

<p>Our field tech flagged something at the northeast corner of the building pad this morning that you need to know about today, not in the weekly report:</p>

<ul>
  <li>The cut exposed a pocket of <strong>undocumented fill — construction debris, brick, and what looks like decayed organic material</strong> — roughly 40' × 60' in plan, depth unknown. This does <strong>not</strong> appear in the geotechnical borings, which were clean in that area.</li>
  <li>There's also a <strong>faint petroleum-like odor</strong> in one portion of the exposure. Could be nothing, but I'm obligated to mention it.</li>
</ul>

<p>Our recommendations:</p>
<ul>
  <li><strong>Stop excavation in that zone</strong> and keep equipment from spreading material around the site.</li>
  <li>Photograph and document the exposure — location, extent, appearance — while it's open.</li>
  <li>Get your geotechnical engineer out for an evaluation; if the odor is real, the owner's environmental consultant should be involved before anyone hauls anything off site. Contaminated spoil is manifested waste, not fill.</li>
  <li>You know your contract better than I do, but conditions that differ from the geotech report usually carry a <strong>notice requirement with a short clock</strong> — worth papering today.</li>
</ul>

<p>Our tech is on site until 3 PM if your super wants to walk it together.</p>

<p>Owen Blake<br/>Field Operations Manager, Meridian Testing Labs<br/>(770) 555-0429</p>
`.trim(),
  },

  // Lesson: tech-concrete — chasing low breaks to closure; strength governs
  // stripping/loading decisions, not the calendar.
  {
    day: 26,
    slug: "testing-low-breaks",
    senderKey: "testing_agency",
    subject: "Low 7-Day Breaks — Foundation Wall Pour #6",
    html: (ctx) =>
      `
<p>${ctx.pmFirst},</p>

<p>Lab results from foundation wall pour #6 (last week, east wing): the <strong>7-day cylinder breaks came in at 62% of design strength</strong> — we'd normally expect around 70% at 7 days for this mix. Not a failure yet (the 28-day breaks govern), but low enough that I want it on your radar:</p>

<ul>
  <li>The 28-day cylinders are in the cure room; we'll break on schedule and can add an intermediate break at 14 days if you want an early read — just say the word.</li>
  <li>Until then, I'd recommend your team <strong>hold off on stripping wall forms early or backfilling against that pour</strong> — loading decisions should ride on strength results, not the calendar.</li>
  <li>Worth checking with the concrete sub whether anything was different on that pour — added water at the truck, a cold night without protection, a different batch plant. If the 28-day breaks come in low, the engineer of record will ask, and cores may follow.</li>
</ul>

<p>Report attached in today's transmittal. We'll flag the 28-day results the day they break.</p>

<p>Owen Blake<br/>Field Operations Manager, Meridian Testing Labs<br/>(770) 555-0429</p>
`.trim(),
  },

  // Lessons: wf-submittals, tech-envelope, wf-quality — partial release
  // mechanics, resubmittal scope, and the envelope mock-up gate.
  {
    day: 33,
    slug: "architect-submittal-mockup",
    senderKey: "architect",
    subject: "Elevator Package Returned (Partial Release) + Envelope Mock-Up Reminder",
    html: (ctx) =>
      `
<p>Hi ${ctx.pmFirst},</p>

<p>Two items from our review desk:</p>

<p><strong>1) Elevator submittal — returned today, split action.</strong> The hoistway layout, rail, and structural interface drawings are <strong>Approved as Noted</strong> — released so fabrication can hold its slot. The <strong>cab interior finishes are Revise &amp; Resubmit</strong>: the proposed panel laminate doesn't match the interior finish schedule (see markups), and the cab lighting cut sheet is missing the required photometrics. Please have Apex resubmit the finishes portion only — don't hold the structural release for it.</p>

<p><strong>2) Envelope mock-up.</strong> Reminder that spec section 072700 requires an <strong>approved exterior wall mock-up before any cladding is released for installation</strong> — WRB, window, flashings, and both cladding types, built as a freestanding panel. Based on your schedule, that mock-up needs to be built and reviewed within the next few weeks. Please coordinate a date; I'll walk it with our envelope consultant. The approved mock-up becomes the quality benchmark for the elevation work, so protect it once it's signed off.</p>

<p>Both formal responses are in the submittal log. Call me if the split action on the elevator package causes your vendor any confusion.</p>

<p>Laura Chen<br/>Project Architect, Halford Studio Architects<br/>(404) 555-0520</p>
`.trim(),
  },

  // Lesson: mep-electrical-distribution — the temp-to-perm energization gate
  // and everything conditioned on it, planned backward.
  {
    day: 36,
    slug: "utility-energization-checklist",
    senderKey: "utility_rep",
    subject: "Transformer Set & Energization — What We Need From Your Side",
    html: (ctx) =>
      `
<p>${ctx.pmFirst},</p>

<p>Good progress on our end — the service design is complete and your transformer is allocated. Now the sequencing part, because <strong>energization dates are lost on the customer side</strong> far more often than on ours. Our checklist before we set and energize:</p>

<ul>
  <li><strong>Pad and primary conduit</strong> — built to our standards and inspected by our field engineer (I'll schedule him when you're a week out).</li>
  <li><strong>Recorded easement</strong> — still showing as pending with your owner's attorney. This is currently your longest pole; nothing energizes without it.</li>
  <li><strong>City electrical inspection release</strong> — the city releases the meter to us directly; we can't take your electrician's word for it.</li>
  <li><strong>Meter base set and switchgear room complete</strong> — dry, lockable, and clear working space at the gear.</li>
  <li><strong>Crew scheduling</strong> — we book energization crews about <strong>3 weeks out</strong>, and storm response can bump construction work. Build slack around the date.</li>
</ul>

<p>Friendly planning note from someone who watches this movie every month: your elevator startup, HVAC startup, and controls checkout are all sitting behind this date. Work the list backward from when you need those running, and get me the easement status this week.</p>

<p>Marcus Reed<br/>Service Design Consultant, Piedmont Power &amp; Light<br/>(770) 555-0455</p>
`.trim(),
  },

  // Lessons: mep-fire-suppression, mep-coordination-scheduling — no installation
  // ahead of coordination sign-off; tested sprinkler pipe yields to nothing.
  {
    day: 40,
    slug: "sub-sprinkler-early-start",
    senderKey: "fire_sub",
    subject: "Request — Start Level 2 Branch Piping Ahead of Coordination Sign-Off",
    html: (ctx) =>
      `
<p>${ctx.pmFirst},</p>

<p>I'll be straight with you — I have a crew coming off another job Monday and I'd rather keep them on your project than lose them to another GC for a month. Here's my ask:</p>

<p>Let us start hanging <strong>Level 2 branch piping</strong> next week. I know the above-ceiling coordination for Level 2 isn't signed off yet — mechanical is still moving their medium-pressure duct around — but my foreman has looked at it and thinks we can work around wherever the duct lands. Mains stay off; branches only, and we'll be flexible.</p>

<p>I'd need your answer by Thursday to hold the crew. If we can't start, I have to send them elsewhere and Level 2 sprinkler slides at least three weeks, which I know backs into your inspection sequence.</p>

<p>Your call — you know how I feel about re-doing work, but a parked crew costs me money either way.</p>

<p>Aisha Coleman<br/>Sentinel Fire Systems<br/>(404) 555-0291</p>
`.trim(),
  },

  // Lessons: mep-coordination-scheduling, wf-sov-payapp — installed quantities
  // as the check on percent-complete claims; the pencil draw adjustment.
  {
    day: 46,
    slug: "acct-mech-overbilling",
    senderKey: "accounting",
    subject: "Northwind Mechanical Pay App — 80% on Ductwork, Field Walk Says Otherwise",
    html: (ctx) =>
      `
<p>${ctx.pmFirst},</p>

<p>Reviewing this month's sub pay applications ahead of the pencil draw, and one needs your eyes before I load it:</p>

<ul>
  <li><strong>Northwind Mechanical is billing ductwork at 80% complete</strong> ($412,000 of their $515,000 duct line).</li>
  <li>Your super's notes from Tuesday's walk say Levels 1-2 duct is hung and Level 3 is maybe half done — his words were <em>"call it 55% of the pounds, tops."</em></li>
  <li>They're also billing their controls allowance at 40%, and I don't believe the controls sub has pulled a single wire yet.</li>
</ul>

<p>Per our process, please <strong>adjust their percentages in the pencil draw against the commitment SOV</strong> and send it back to them with the walk notes attached — installed quantities, not narrative. If they want to dispute it, the walk happens together with your super and a copy of the coordination drawings.</p>

<p>Not the fun part of the job, but overbilled subs are underbilled risk for us — if they default at 80% billed and 55% built, we eat the difference.</p>

<p>Janet</p>
`.trim(),
  },

  // Lesson: mep-bms — points list review, controls prerequisites, and
  // protecting the controls duration from end-of-job compression.
  {
    day: 48,
    slug: "controls-points-list",
    senderKey: "controls_sub",
    subject: "Points List for Review + A Warning About Our Runway",
    html: (ctx) =>
      `
<p>Hi ${ctx.pmFirst},</p>

<p>Two things, one routine and one that keeps me up at night.</p>

<p><strong>Routine:</strong> our BMS points list submittal went in today — every monitored and controlled point, per equipment, mapped against the mechanical engineer's sequences of operations. Please push your team and the engineer to review it against the sequences <em>carefully</em>: a point missing from this list is a function missing from the building, and adding it after rough-in means conduit, wire, and a mobilization instead of a line on a spreadsheet.</p>

<p><strong>The warning:</strong> our finish work is the last domino in the building. Point-to-point checkout can't start until we have <strong>permanent power, started-up equipment, and completed wiring</strong> — and our durations only work if those land on the dates in the schedule. Every week the switchgear energization or AHU startup slips, our window compresses while the CO date stays put. I've watched projects skip our checkout to "save time" and then burn three weeks of commissioning debugging wiring that point-to-point would have caught in three days.</p>

<p>Ask: can you send me your current dates for <strong>permanent power, AHU startup, and TAB start</strong>? I'll level with you immediately if our duration doesn't fit between them and the CO.</p>

<p>Alan Reyes<br/>Senior Systems Engineer, Corebridge Controls<br/>(678) 555-0533</p>
`.trim(),
  },

  // Lessons: sc-streets-parking, sc-pedestrian-ada, sc-entitlements — parking
  // geometry, ADA counts, and entitlement commitments you can't restripe away.
  {
    day: 50,
    slug: "owner-parking-restripe",
    senderKey: "owner_rep",
    subject: "Leasing Ask — Can We Add ~10 Parking Spaces by Restriping?",
    html: (ctx) =>
      `
<p>${ctx.pmFirst},</p>

<p>Leasing is telling me we're going to be tight on parking at lease-up, and they've asked a question I want your honest read on before I spend money on our civil engineer:</p>

<ul>
  <li>Can we pick up <strong>roughly 10 more spaces by restriping</strong> the main lot — tighter stalls, maybe compact spaces along the north edge?</li>
  <li>Separately, our property manager wants the <strong>dumpster enclosure relocated</strong> closer to the building so staff aren't walking as far.</li>
</ul>

<p>My instinct says striping is cheap so this should be easy — but I've been surprised before, and I'd rather hear the catch from you now than from the city later. Is there anything in the parking geometry, the <strong>accessible stalls</strong>, or our site plan approval that makes either of these more than a paint-and-move job?</p>

<p>If it's genuinely easy, give me a number. If it's not, tell me why in terms I can repeat to leasing.</p>

<p>Elaine</p>
`.trim(),
  },

  // Lessons: mep-startup-cx, mep-hvac-air — beneficial use: warranty clocks,
  // construction filters, and the written agreement before early operation.
  {
    day: 53,
    slug: "owner-early-hvac",
    senderKey: "owner_rep",
    subject: "Can We Run the HVAC Early? Humidity Is Beating Up the Millwork Schedule",
    html: (ctx) =>
      `
<p>${ctx.pmFirst},</p>

<p>Your super mentioned the millwork and flooring installers are worried about humidity in the building, and honestly so am I — we can't afford acclimation delays on the finish schedule.</p>

<p>Simple question from my side: <strong>the rooftop units are sitting up there — can we just turn them on and condition the building?</strong></p>

<p>Before you say yes, I want your professional read on whether there's a catch. I've had a GC on another project do this without telling us and we ended up in an ugly warranty argument with the equipment manufacturer a year later. If there's a right way to run permanent equipment early — whatever protections or paperwork that involves — lay it out for me and let's do it the right way.</p>

<p>Need an answer this week; the millwork delivery is scheduled and I don't want it sitting in a humid building.</p>

<p>Elaine</p>
`.trim(),
  },

  // Lessons: mep-security-fire-alarm, mep-low-voltage — the acceptance test
  // gate, the pre-test discipline, and the ERRC/DAS late surprise.
  {
    day: 59,
    slug: "fire-marshal-acceptance",
    senderKey: "fire_marshal",
    subject: "Fire Alarm Acceptance Test — Scheduling Requirements (Read Before Booking)",
    html: (ctx) =>
      `
<p>Good morning,</p>

<p>Your fire alarm contractor contacted our office about scheduling the acceptance test for the ${ctx.projectLabel} project. Before anyone books a date, understand our requirements — failed acceptance tests are the single biggest cause of delayed occupancies in this jurisdiction:</p>

<ul>
  <li>We are currently booking acceptance tests <strong>3 weeks out</strong>. A failed test goes to the back of the queue, not the front.</li>
  <li>The test is <strong>100% of devices</strong> — every initiating device activated, every notification appliance verified, no sampling.</li>
  <li>The <strong>sequence of operations matrix</strong> must be submitted to this office for review <strong>before</strong> the test date.</li>
  <li>All interfaced systems must be complete and functional at test time: <strong>elevator recall, HVAC shutdown, door holders, and access control release</strong>. If the elevator isn't ready to demonstrate recall, do not book the date.</li>
  <li>We require your contractor's <strong>completed pre-test documentation</strong> — a full dry run of the matrix — submitted with the booking. I strongly recommend you attend that pre-test yourself.</li>
</ul>

<p>Separately: our records show no <strong>emergency responder radio coverage (ERRC) test</strong> on file for this building. Coverage must be verified before CO — if the building needs a DAS, you want to know that <em>now</em>, not at final. Have your low-voltage contractor run the grid test and submit results to this office.</p>

<p>Lt. Sandra Okoye<br/>Deputy Fire Marshal, City of Riverton<br/>(770) 555-0482</p>
`.trim(),
  },

  // Lesson: tech-vertical-lv — the state elevator inspection backlog and its
  // prerequisite chain (permanent power, fire alarm recall interface).
  {
    day: 62,
    slug: "vendor-elevator-inspection",
    senderKey: "elevator_vendor",
    subject: "State Elevator Inspection — Backlog Is 4 Weeks, Book It Now",
    html: (ctx) =>
      `
<p>${ctx.pmFirst},</p>

<p>Installation is tracking well, so now the part that catches every project off guard: <strong>the state elevator inspector's current backlog is about 4 weeks</strong>, and that's a different agency with a different calendar than your city inspections. If occupancy depends on the elevator (it does), we need to request the inspection date <em>now</em> and build to it.</p>

<p>What must be complete before the state inspector will certify:</p>
<ul>
  <li><strong>Permanent power</strong> — the inspection cannot run on temp power.</li>
  <li><strong>Machine room / controller space finished</strong> — dedicated, lockable, code-compliant lighting and ventilation.</li>
  <li><strong>Fire alarm recall interface tested</strong> — the inspector will demonstrate recall live with your alarm contractor present. Coordinate this with your fire alarm acceptance testing.</li>
  <li><strong>Pit clean and dry</strong>, ladder and pit light in, hoistway free of other trades' anything.</li>
  <li>Our completed pre-inspection checklist — my techs run it the week before.</li>
</ul>

<p>Give me the green light and I'll file the request this week. Miss this window and the next slot pushes past where I suspect your CO needs to be.</p>

<p>Tom Garrity<br/>Project Sales Engineer, Apex Elevator Systems<br/>(678) 555-0348</p>
`.trim(),
  },

  // Lessons: sc-stormwater, sc-esc, sc-landscape — sediment basin conversion,
  // NPDES notice of termination, landscape establishment at closeout.
  {
    day: 64,
    slug: "civil-closeout-site",
    senderKey: "civil_engineer",
    subject: "Site Closeout — Basin Conversion, As-Builts & Landscape Establishment",
    html: (ctx) =>
      `
<p>Hi ${ctx.pmFirst},</p>

<p>As the site work winds down, here's the civil closeout list — these items gate your stormwater permit closure and parts of the CO package, and they always take longer than anyone budgets:</p>

<ul>
  <li><strong>Sediment basin conversion</strong> — the construction basin converts to the permanent stormwater pond per the detail: muck out accumulated sediment, regrade to design contours, install the permanent outlet structure, and stabilize. The city will not accept the pond with construction sediment in it.</li>
  <li><strong>Bioretention cells</strong> — final media, plantings, and the infiltration verification test. This is where equipment traffic during construction comes home to roost; if the cells were protected, this is routine.</li>
  <li><strong>As-built survey</strong> — rim and invert elevations on every storm structure, pond volumes, and the BMPs, sealed by your surveyor. Required for the stormwater permit closeout and the city's GIS intake.</li>
  <li><strong>NPDES notice of termination</strong> — can only be filed once <strong>final stabilization</strong> is achieved (established vegetation, not just seeded dirt). Until it's filed, your SWPPP inspections continue — rain events included.</li>
  <li><strong>Landscape establishment</strong> — confirm with your landscape contractor who owns watering and maintenance through the establishment period, and get the tree save areas walked before their fencing comes down. Grade-change damage shows up at the end.</li>
</ul>

<p>Happy to walk the site with your super and build the punch for these — earlier is cheaper on every one of them.</p>

<p>Priya Sharma, PE<br/>Project Engineer, Harlan Civil Group<br/>(404) 555-0510</p>
`.trim(),
  },
];

/** Emails that arrive on exactly this in-sim day (for the Day panel's hint). */
export function inboxEmailsForDay(day: number): TrainingInboxEmail[] {
  return TRAINING_INBOX_EMAILS.filter((e) => e.day === day);
}
