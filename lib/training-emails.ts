/**
 * Subcontractor roster + email bodies for "SiteCommand Training" sandboxes.
 *
 * Every Project Manager sandbox seeds a handful of buyout email threads with
 * subcontractors (trainee → sub). Most subs have already responded with their
 * number; exactly **one — picked at random per project — is the "slow" sub**:
 * their buyout thread is seeded with no response. The trainee has to chase them
 * (call the phone number in the Directory, or follow up by email). When the
 * trainee follows up, the sandbox reply route generates the sub's (late,
 * apologetic) response — see app/api/projects/[id]/emails/[threadId]/reply.
 *
 * This module is pure content (roster + HTML builders), so it can be imported
 * from both the seeder (lib/training-seed.ts) and the reply route.
 */

export type TrainingSub = {
  /** Trade / scope label. */
  trade: string;
  /** Subcontractor firm name. */
  company: string;
  /** Primary contact first/last. */
  first: string;
  last: string;
  /** Contact phone — the trainee can "call" the slow sub here. */
  phone: string;
  /** Indicative lump-sum bid used in the seeded response. */
  bid: number;
};

/**
 * Roster of subs seeded into a PM sandbox's Directory. The first
 * {@link BUYOUT_THREAD_COUNT} (the early-buyout trades) also get a seeded buyout
 * email thread; the rest are directory-only so the trainee can reach out later.
 */
export const TRAINING_SUBS: TrainingSub[] = [
  { trade: "Concrete / Foundations", company: "Bedrock Concrete", first: "Manny", last: "Alvarez", phone: "(404) 555-0260", bid: 4_250_000 },
  { trade: "Structural Steel / Framing", company: "Ironclad Steel Erectors", first: "Wes", last: "Donnelly", phone: "(404) 555-0274", bid: 6_800_000 },
  { trade: "Electrical", company: "Voltura Electric", first: "Derek", last: "Hollings", phone: "(404) 555-0212", bid: 5_400_000 },
  { trade: "Plumbing", company: "Cardinal Plumbing", first: "Sofia", last: "Marchetti", phone: "(404) 555-0233", bid: 3_100_000 },
  { trade: "HVAC / Mechanical", company: "Northwind Mechanical", first: "Greg", last: "Tanaka", phone: "(404) 555-0247", bid: 4_900_000 },
  { trade: "Fire Protection", company: "Sentinel Fire Systems", first: "Aisha", last: "Coleman", phone: "(404) 555-0291", bid: 1_650_000 },
  { trade: "Roofing", company: "Summit Ridge Roofing", first: "Paul", last: "Brennan", phone: "(404) 555-0288", bid: 2_300_000 },
  { trade: "Glazing / Curtain Wall", company: "ClearSpan Glazing", first: "Victor", last: "Pham", phone: "(404) 555-0305", bid: 3_750_000 },
];

/** How many of the roster's early-buyout trades get a seeded email thread. */
export const BUYOUT_THREAD_COUNT = 5;

/** Email address for a sub, derived from their firm name (stable + fake). */
export function subEmailFor(sub: TrainingSub): string {
  const slug = sub.company.toLowerCase().replace(/[^a-z0-9]/g, "");
  const local = `${sub.first}.${sub.last}`.toLowerCase().replace(/[^a-z0-9.]/g, "");
  return `${local}@${slug || "subcontractor"}.com`;
}

function money(value: number): string {
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

/** First token of a name, falling back to a friendly default. */
export function firstNameOf(name: string | null | undefined, fallback = "there"): string {
  const n = (name ?? "").trim().split(/\s+/)[0];
  return n || fallback;
}

/** The trainee's buyout outreach to a sub (message 1 of every seeded thread). */
export function buildBuyoutOutreachHtml(opts: {
  pmFirst: string;
  sub: TrainingSub;
  projectLabel: string;
}): string {
  const { pmFirst, sub, projectLabel } = opts;
  return `
<p>Hi ${sub.first},</p>

<p>As we kick off buyout on the ${projectLabel} project, I'd like to lock in your <strong>${sub.trade.toLowerCase()}</strong> scope and pricing. When you get a chance, can you confirm:</p>

<ul>
  <li>Your lump-sum number against the current bid set and Addenda 1–2</li>
  <li>Any exclusions or clarifications carried in your bid</li>
  <li>Lead times on any long-lead material or equipment</li>
  <li>Earliest you can start once we issue Notice to Proceed</li>
</ul>

<p>I'm trying to have awards out by the end of next week, so a quick turnaround would help. Appreciate it.</p>

<p>Thanks,<br/>${pmFirst}</p>
`.trim();
}

/** A sub's prompt, helpful bid confirmation (seeded for the non-slow subs). */
export function buildSeededBidResponseHtml(opts: { pmFirst: string; sub: TrainingSub }): string {
  const { pmFirst, sub } = opts;
  return `
<p>Hi ${pmFirst},</p>

<p>Thanks for reaching out — good to be working with you on this one. We've reviewed the full bid set and Addenda 1 and 2, and our number holds at <strong>${money(sub.bid)}</strong> for the ${sub.trade.toLowerCase()} scope.</p>

<p>Scope is per plans and specs with the exclusions we carried at bid (nothing unusual). We can have our SOV breakdown over to you whenever you're ready, and we're good to start within two to three weeks of NTP. Lead times are in good shape on our end.</p>

<p>Let me know what else you need for the award.</p>

<p>Best,<br/>${sub.first}<br/>${sub.company}</p>
`.trim();
}

/**
 * The counterparty's reply generated when the trainee follows up in a sandbox
 * thread. The first time a counterparty replies (i.e. the slow sub finally
 * answering after being chased) the tone is apologetic about the delay; any
 * later reply is a brief acknowledgement.
 */
export function buildCounterpartyReply(opts: {
  firstResponse: boolean;
  counterpartyName: string;
  pmFirst: string;
}): { html: string; text: string } {
  const { firstResponse, counterpartyName, pmFirst } = opts;
  const signFirst = firstNameOf(counterpartyName, "");
  const sign = signFirst || counterpartyName || "";
  const signLine = sign ? `<br/>${sign}` : "";

  const html = firstResponse
    ? `
<p>Hi ${pmFirst},</p>

<p>Apologies for the delay getting back to you — it's been hectic on our end and your note got buried. Thanks for following up.</p>

<p>To answer your questions: our number holds per the current bid set and addenda, and we're good on scope with the exclusions we carried at bid. I'll get you the full SOV breakdown and firm lead times by early next week. If you need anything sooner, just call me and we'll knock it out over the phone.</p>

<p>Thanks for your patience.${signLine}</p>
`.trim()
    : `
<p>Hi ${pmFirst},</p>

<p>Got it — thanks for the note. I'll take a look and get right back to you.${signLine}</p>
`.trim();

  const text = firstResponse
    ? `Hi ${pmFirst},\n\nApologies for the delay getting back to you — it's been hectic on our end and your note got buried. Thanks for following up.\n\nTo answer your questions: our number holds per the current bid set and addenda, and we're good on scope with the exclusions we carried at bid. I'll get you the full SOV breakdown and firm lead times by early next week. If you need anything sooner, just call me and we'll knock it out over the phone.\n\nThanks for your patience.${sign ? `\n${sign}` : ""}`
    : `Hi ${pmFirst},\n\nGot it — thanks for the note. I'll take a look and get right back to you.${sign ? `\n${sign}` : ""}`;

  return { html, text };
}
