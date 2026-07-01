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
];

/** Emails that arrive on exactly this in-sim day (for the Day panel's hint). */
export function inboxEmailsForDay(day: number): TrainingInboxEmail[] {
  return TRAINING_INBOX_EMAILS.filter((e) => e.day === day);
}
