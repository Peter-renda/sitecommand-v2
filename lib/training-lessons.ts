/**
 * Training → Lessons: a hand-authored curriculum that teaches new project
 * managers (a) the core SiteCommand workflows (RFIs, Submittals, Buyout, …),
 * (b) the underlying construction concepts those workflows assume you
 * already know (RCP, MEP, CSI divisions, contract types, …), and (c) four
 * deeper tracks built from the PM learning curriculum: Building the Work
 * (means & methods in build sequence), Site & Civil (site planning, grading,
 * SWPPP, stormwater, ADA routes, landscape), MEP Systems (every system as
 * schedule logic — activity chains, hold points, the CO dependency web),
 * Contracts & Commercial (AIA documents, clauses, liens, claims), and
 * Professional Skills (financial literacy, estimating, leadership, codes,
 * ethics).
 *
 * This module is client-safe (no server-only imports) — it's the single
 * source of truth for both the Lessons page (app/training/lessons) and the
 * left-nav tree (TrainingNav.tsx). Content is static/curated, not
 * user-editable; per-user completion state is tracked separately in
 * training_lesson_progress (see app/api/training/lessons/progress).
 *
 * Content is split by track to keep files reviewable: this file holds the
 * original core lessons + types/helpers; the sibling training-lessons-*.ts
 * files hold the newer tracks and are aggregated into LESSONS below. Those
 * files import only types from here, so there is no runtime import cycle.
 */

import { PROCESS_LESSONS } from "./training-lessons-process";
import { TECHNICAL_LESSONS } from "./training-lessons-technical";
import { SITEWORK_LESSONS } from "./training-lessons-sitework";
import { MEP_LESSONS } from "./training-lessons-mep";
import { COMMERCIAL_LESSONS } from "./training-lessons-commercial";
import { FOUNDATIONS_LESSONS } from "./training-lessons-foundations";

export type LessonTrack =
  | "workflow"
  | "concept"
  | "technical"
  | "sitework"
  | "mep"
  | "commercial"
  | "foundations";

export type LessonBlock = {
  heading?: string;
  paragraphs?: string[];
  bullets?: string[];
  ordered?: string[];
};

export type LessonLink = { label: string; href: string };

export type Lesson = {
  id: string;
  track: LessonTrack;
  category: string;
  title: string;
  summary: string;
  minutes: number;
  keyTerms?: { term: string; definition: string }[];
  body: LessonBlock[];
  relatedLessonIds?: string[];
  links?: LessonLink[];
};

const PRACTICE_LINK: LessonLink = {
  label: "Practice this in your training sandbox",
  href: "/training/practice",
};

const CORE_LESSONS: Lesson[] = [
  // ───────────────────────────── Workflows ─────────────────────────────
  {
    id: "wf-rfis",
    track: "workflow",
    category: "Requests for Information",
    title: "RFIs: Asking and Answering the Right Questions",
    summary:
      "What an RFI is for, who's involved, and how to keep the log from becoming a bottleneck.",
    minutes: 5,
    keyTerms: [
      { term: "RFI", definition: "Request for Information — a formal question to the design team about a gap, conflict, or ambiguity in the contract documents." },
      { term: "Ball in court", definition: "Whoever owes the next response. Every RFI should always have exactly one person holding the ball." },
      { term: "Official response", definition: "The response marked as the answer of record — the one that governs the work, even if other comments were added." },
    ],
    body: [
      {
        heading: "Why RFIs exist",
        paragraphs: [
          "No drawing set is perfect. Architects and engineers coordinate dozens of sheets across disciplines, and gaps, conflicts, and ambiguities always slip through. An RFI is the formal, documented way to ask the design team to resolve one of those gaps before it costs time or money in the field.",
          "RFIs matter because they create a paper trail. If a detail is missing and you guess wrong, an undocumented verbal answer won't protect you on a claim. A written RFI response will.",
        ],
      },
      {
        heading: "Who's involved",
        bullets: [
          "The GC/PM issues the RFI — usually the field (a super hits a real conflict) or a subcontractor flags it, and the PM formalizes and routes it.",
          "The architect or engineer of record answers, sometimes routing sub-questions to a specialty consultant (structural, MEP).",
          "The distribution list (owner, super, affected sub) stays informed even if they aren't the one answering.",
        ],
      },
      {
        heading: "The workflow, step by step",
        ordered: [
          "Identify the gap or conflict — drawing mismatch, missing detail, spec ambiguity, or a field condition that doesn't match the documents.",
          "Write a specific, answerable question. Attach a drawing reference, photo, or markup. Vague RFIs get vague (or delayed) answers.",
          "Assign a ball-in-court holder and, when the schedule is tight, a due date tied to when the answer is actually needed in the field.",
          "Track it on the open RFI log until it's answered — don't let RFIs go stale; they block downstream work.",
          "Once answered, distribute the resolution to the field and any affected sub, and close the RFI.",
        ],
      },
      {
        heading: "Common pitfalls",
        bullets: [
          "Waiting too long to issue the RFI. Answer time is real — issue as soon as the gap is identified, not when the crew is standing in front of it.",
          "Burying the actual question in a wall of text. One clear question per RFI is easier to answer fast.",
          "Letting the ball sit with no one chasing it. A weekly RFI log review keeps things moving.",
          "Confusing an RFI with a Submittal — an RFI asks a question about the design; a submittal proposes the actual product/shop drawing for approval (see the Submittals lesson).",
        ],
      },
      {
        heading: "In SiteCommand",
        paragraphs: [
          "The RFIs tool tracks the full log: subject, question, drawing reference, ball-in-court, distribution list, and every response — with the option to mark one response 'Official' so there's no ambiguity about which answer governs. The RFI creator keeps full management rights on their own RFIs even without Admin-level access, so a Company Member who opens an RFI can still edit or close the ones they created.",
        ],
      },
    ],
    relatedLessonIds: ["cn-rfi-vs-submittal", "cn-drawings"],
    links: [PRACTICE_LINK],
  },
  {
    id: "wf-submittals",
    track: "workflow",
    category: "Submittals",
    title: "Submittals: The Approval Workflow",
    summary:
      "How shop drawings, product data, and samples move from subcontractor to architect and back — before anything gets fabricated.",
    minutes: 6,
    keyTerms: [
      { term: "Submittal", definition: "A shop drawing, product data sheet, or sample the sub proposes to actually build with, submitted for the architect/engineer's review against the design intent." },
      { term: "Submittal log / register", definition: "The master list of every submittal required by the spec sections, tracking status and dates." },
      { term: "Approved as noted", definition: "A common review outcome: approved, but with markups the sub must incorporate before fabrication." },
    ],
    body: [
      {
        heading: "What a submittal actually is",
        paragraphs: [
          "The contract drawings describe design intent — they don't tell a steel fabricator the exact bolt pattern, or a millwork shop the exact veneer match. The submittal process is how the subcontractor shows the design team precisely what they intend to build or install, so the architect/engineer can catch a mismatch before it's poured, framed, or fabricated (when it's expensive to fix) instead of after (when it's very expensive to fix).",
        ],
      },
      {
        heading: "Building the submittal log",
        paragraphs: [
          "Before buyout is even finished, the PM (often with project admin support) builds a submittal register from the spec sections — every Division 03-16 section that calls for a submittal becomes a line item, organized by CSI division. This log is the single most important document for keeping fabrication on schedule, because it's the master checklist of everything that has to be approved before material can be ordered.",
        ],
      },
      {
        heading: "The workflow, step by step",
        ordered: [
          "The subcontractor prepares the shop drawing, product data, or sample and submits it to the GC.",
          "The GC reviews for completeness and stamps/forwards it to the architect (and, for MEP items, the relevant engineer).",
          "The architect/engineer reviews against the contract documents and returns one of: Approved, Approved as Noted, Revise & Resubmit, or Rejected.",
          "If revisions are required, the sub resubmits and the cycle repeats — this is why turnaround time (the agreed SLA) matters so much for schedule.",
          "Once approved, the sub can release the item to fabrication or order material.",
        ],
      },
      {
        heading: "Why turnaround time drives the whole schedule",
        paragraphs: [
          "A long-lead item (switchgear, elevators, custom windows) can have a 20+ week fabrication lead time on top of a multi-week submittal review cycle. If the submittal sits on someone's desk for three extra weeks, that delay shows up directly on the CPM schedule months later, when it's much harder to recover. This is why experienced PMs negotiate submittal turnaround SLAs with the design team up front and chase overdue reviews aggressively.",
        ],
      },
      {
        heading: "Common pitfalls",
        bullets: [
          "Submitting late — waiting until a trade is 'about to start' instead of submitting as soon as the sub is bought out.",
          "Treating the submittal log as a formality instead of a live schedule-risk tool — it should be reviewed weekly alongside the look-ahead.",
          "Missing a required submittal entirely because it wasn't captured from the specs at the start.",
        ],
      },
      {
        heading: "In SiteCommand",
        paragraphs: [
          "The Submittals tool (paired with the Specifications tool's parsed spec sections) tracks each item's type, status, cost code, and description, so the register and the spec book stay linked.",
        ],
      },
    ],
    relatedLessonIds: ["cn-rfi-vs-submittal", "cn-csi", "cn-longlead"],
    links: [PRACTICE_LINK],
  },
  {
    id: "wf-buyout",
    track: "workflow",
    category: "Buyout",
    title: "Buyout: From Bid to Executed Subcontract",
    summary:
      "Turning estimating's bid results into signed, scope-complete subcontracts — the foundation everything else builds on.",
    minutes: 6,
    keyTerms: [
      { term: "Buyout", definition: "The process of awarding and executing subcontracts/purchase orders for every scope of work, converting the estimate into real contracts." },
      { term: "Scope gap", definition: "Work that no bidder's proposal actually includes — it falls between two trades' scope letters and has to be caught before award." },
      { term: "Leveling", definition: "Comparing bids apples-to-apples by normalizing what each bidder included or excluded, so the low number isn't hiding a scope gap." },
    ],
    body: [
      {
        heading: "Where buyout starts",
        paragraphs: [
          "Buyout begins the moment the project is awarded, using the estimating team's bid results as the starting point. The goal is to convert every line of the estimate into an executed subcontract or purchase order — on budget, with complete scope, before the trade is needed in the field.",
        ],
      },
      {
        heading: "The workflow, step by step",
        ordered: [
          "Review bid results with preconstruction/estimating and build a short-list of qualified vendors per trade.",
          "Level the bids — normalize scope so you're comparing complete, equivalent proposals, not just bottom-line numbers.",
          "Hold scope review calls with the apparent low bidder on major trades to confirm nothing was excluded or double-counted.",
          "Build (or update) the buyout log: budget by cost code, award target, and target award date for every trade.",
          "Identify long-lead trades and issue early releases or LOIs (letters of intent) to lock pricing and start their submittal process before the full subcontract is signed.",
          "Negotiate and execute subcontracts/POs, confirming default retainage, inclusions/exclusions, and a complete Schedule of Values.",
          "Collect compliance documents — certificates of insurance, bonds, W-9s — before releasing the sub to mobilize.",
        ],
      },
      {
        heading: "Why scope gaps are the real risk",
        paragraphs: [
          "The most expensive buyout mistake isn't paying too much for a trade — it's missing scope entirely. If demolition and new work both assume the other trade handles debris removal, that gap either comes out of the GC's contingency or becomes a change order fight later. Careful bid leveling and scope review calls are how experienced buyout teams catch this before award, not after.",
        ],
      },
      {
        heading: "Common pitfalls",
        bullets: [
          "Awarding on price alone without confirming scope completeness.",
          "Delaying buyout on long-lead trades because 'the schedule has time' — the schedule risk is in the submittal + fabrication lead time, not the field install date.",
          "Executing a subcontract with an incomplete or vague Schedule of Values, which makes billing and change management painful for the rest of the job.",
          "Skipping the compliance check (insurance, bonds) and discovering a lapsed COI after the sub is already on site.",
        ],
      },
      {
        heading: "In SiteCommand",
        paragraphs: [
          "The Commitments tool is where buyout becomes real contracts: create the subcontract or purchase order, build the Schedule of Values (Amount Based or Unit/Quantity Based), set default retainage, and track status from Draft through Approved. A subcontract requires a Title, Contract Company, Default Retainage, Description, and at least one SOV line before it can be saved — the same fields that matter in real buyout.",
        ],
      },
    ],
    relatedLessonIds: ["cn-contracts", "cn-longlead", "cn-retainage"],
    links: [PRACTICE_LINK],
  },
  {
    id: "wf-change-events",
    track: "workflow",
    category: "Change Management",
    title: "Change Events, PCOs, and Change Orders",
    summary:
      "How a scope change is tracked from 'something's different' all the way through to an executed, priced change order.",
    minutes: 6,
    keyTerms: [
      { term: "Change Event", definition: "The umbrella record that captures a potential cost or scope impact before it's priced or approved on any specific contract." },
      { term: "PCO (Potential Change Order)", definition: "A priced but not-yet-approved change tied to a specific contract, one tier below the final Change Order." },
      { term: "CCO / PCCO", definition: "Commitment Change Order (modifies a subcontract/PO) and Prime Contract Change Order (modifies the owner contract) — the executed, approved records." },
    ],
    body: [
      {
        heading: "Why change is tracked in layers",
        paragraphs: [
          "A single field discovery — say, unsuitable soil found during excavation — might eventually touch the owner's contract, a subcontract, and the budget, all at different dollar amounts and approval speeds. Rather than jump straight to 'change order,' most PM platforms track it in layers: a Change Event captures the issue and its potential cost/schedule impact company-wide, and from there specific priced items get attached to whichever contracts they actually affect.",
        ],
      },
      {
        heading: "The tiers, from loosest to most binding",
        ordered: [
          "Change Event — the issue is logged, described, and roughly estimated. Nothing is contractually binding yet.",
          "PCO (Potential Change Order) — a specific contract's PCO captures a priced line item tied to that change, pending approval. Some setups use a further Change Order Request (COR) tier between PCO and CCO for extra review.",
          "CCO / PCCO — once approved, the change becomes an executed Commitment Change Order (modifies a sub/PO) or Prime Contract Change Order (modifies the owner contract), and the contract value updates.",
        ],
      },
      {
        heading: "Why this matters for budget",
        paragraphs: [
          "Modern budgeting workflows tie change events to Budget Changes with a 'Budget ROM' (Rough Order of Magnitude) so the budget impact is estimated automatically as soon as an event is logged — using scopes like In Scope, Out of Scope, or TBD, and a source like Latest Cost or Latest Price. This means an experienced PM can see the budget trending before a single change order is signed, instead of being surprised at month-end.",
        ],
      },
      {
        heading: "Common pitfalls",
        bullets: [
          "Letting field work start on a change before it's priced and approved — this is how contingency gets quietly drained without anyone deciding to spend it.",
          "Not linking the change event to the right contract tier, so the owner never sees a cost that should have been billed.",
          "Losing track of designated reviewer / approval order — an older approved change order sometimes has to be unapproved before a newer one can be edited, so approval sequence matters.",
        ],
      },
      {
        heading: "In SiteCommand",
        paragraphs: [
          "The Change Events tool is the umbrella record; from a selected line item you can bulk-add it to an unapproved Commitment or an unapproved Commitment CO (only unapproved targets are valid, and only when the commitment has no invoices yet). The Change Orders tool is the central, read-only index across both Prime Contract and Commitment change orders — actual creation and approval still happens from the parent contract.",
        ],
      },
    ],
    relatedLessonIds: ["wf-commitments", "cn-contracts"],
    links: [PRACTICE_LINK],
  },
  {
    id: "wf-commitments",
    track: "workflow",
    category: "Commitments",
    title: "Commitments: Purchase Orders & Subcontracts",
    summary:
      "The two contract types that carry your bought-out scope, and the Schedule of Values that tracks what's owed.",
    minutes: 5,
    keyTerms: [
      { term: "Commitment", definition: "The umbrella term for a Purchase Order or Subcontract — a contract that commits budget dollars to a vendor or trade partner." },
      { term: "SOV (Schedule of Values)", definition: "The line-item cost breakdown of a commitment, used both to define scope and as the basis for progress billing." },
      { term: "SSOV (Subcontractor SOV)", definition: "A more detailed cost breakdown the subcontractor provides against the general SOV, used to reconcile billing at a finer grain." },
    ],
    body: [
      {
        heading: "Purchase Order vs. Subcontract",
        paragraphs: [
          "A Purchase Order (PO) is typically used for material or equipment procurement — you're buying a product. A Subcontract is used when you're contracting labor and material together for a scope of work — you're buying an outcome. Both are 'commitments' in the sense that they commit budget dollars against a vendor, but subcontracts carry more contractual weight (inclusions, exclusions, retainage, bonding) because there's ongoing performance risk, not just a delivery date.",
        ],
      },
      {
        heading: "The Schedule of Values (SOV)",
        paragraphs: [
          "Every commitment's SOV breaks the contract value into line items — either Amount Based (a dollar amount per line) or Unit/Quantity Based (quantity × unit cost, with the amount auto-calculating). The SOV isn't just bookkeeping: it's the basis for progress billing every month, and it's what change orders and subcontractor SOVs attach to. A sloppy SOV at buyout means every invoice review for the rest of the job is harder.",
        ],
      },
      {
        heading: "Why the Subcontractor SOV exists",
        paragraphs: [
          "A general SOV might have a single $500,000 electrical line item. That's not detailed enough for the subcontractor to bill against accurately as they progress through rough-in, trim, and fixtures. The SSOV lets the sub break that single line into a finer cost breakdown, get it approved, and then bill against the detail — so 'percent complete' on an invoice reflects actual field progress, not a guess.",
        ],
      },
      {
        heading: "Common pitfalls",
        bullets: [
          "Building an SOV that's too coarse to bill against fairly, leading to disputes over percent-complete.",
          "Forgetting the SSOV only works with Amount Based accounting — it isn't supported on Unit/Quantity Based contracts.",
          "Letting a commitment's status linger in Draft long after it's actually executed, which can block edits that require Draft status (like line-item additions) later.",
        ],
      },
      {
        heading: "In SiteCommand",
        paragraphs: [
          "The Commitments tool (project → Contracts tab) is where POs and subcontracts live, with per-tool permission levels layered on top of a user's role (None / Read Only / Standard / Admin). Admin can add SOV lines, enable the Subcontractor SOV tab, and manage change orders; Read Only can view; the assigned Invoice Contact can edit the SSOV on their own contract.",
        ],
      },
    ],
    relatedLessonIds: ["wf-buyout", "wf-change-events", "cn-retainage"],
    links: [PRACTICE_LINK],
  },
  {
    id: "wf-sov-payapp",
    track: "workflow",
    category: "Cost & Billing",
    title: "Schedule of Values & Pay Applications",
    summary:
      "How monthly billing actually works, from percent-complete to retainage to the owner's check.",
    minutes: 5,
    keyTerms: [
      { term: "Pay application (pay app)", definition: "The monthly invoice submitted up the chain (sub → GC → owner) requesting payment for work completed to date." },
      { term: "Percent complete", definition: "The portion of each SOV line item's value that's been earned based on field progress — the core number driving what's billable." },
      { term: "Lien waiver", definition: "A document from a paid party stating they waive their right to file a lien for the amount paid, protecting the owner and GC." },
    ],
    body: [
      {
        heading: "The billing cascade",
        paragraphs: [
          "Payment flows uphill once a month: subcontractors submit pay apps to the GC based on their SOV, the GC reviews and compiles them into its own pay app to the owner (using the prime contract SOV), the owner's team reviews and approves, and money flows back down the same chain — minus retainage held at each level.",
        ],
      },
      {
        heading: "The workflow, step by step",
        ordered: [
          "Each SOV line item's percent-complete is updated based on actual field progress for the billing period.",
          "Billed-to-date and amount-remaining are recalculated automatically from that percent complete.",
          "The sub submits their pay app with supporting lien waivers from lower tiers (if applicable).",
          "The GC reviews for accuracy against actual field conditions — this is a real check, not a rubber stamp — and compiles the prime pay app.",
          "The owner (or their representative) reviews and approves, and payment is released, net of retainage.",
        ],
      },
      {
        heading: "Why the GC's review matters",
        paragraphs: [
          "Overbilling — a sub claiming 80% complete on work that's actually 60% complete — creates real risk: if that sub defaults later, the GC may have already paid for work that doesn't exist. A disciplined monthly walk of actual progress against the SOV, before signing off on a pay app, is one of the most important recurring PM responsibilities on a job.",
        ],
      },
      {
        heading: "Common pitfalls",
        bullets: [
          "Approving a pay app without collecting the prior period's lien waivers first.",
          "Letting retainage tracking drift from what the contract actually specifies (retainage percentages sometimes reduce partway through the job).",
          "Billing change order amounts before the change order is actually approved.",
        ],
      },
      {
        heading: "In SiteCommand",
        paragraphs: [
          "Billed to Date and Amount Remaining are tracked at the SOV line-item level on each commitment, and the Subcontractor SOV workflow (notify → detail lines → submit → admin approve/return) keeps the sub's detailed billing basis synced to the general SOV before invoicing begins.",
        ],
      },
    ],
    relatedLessonIds: ["wf-commitments", "cn-retainage"],
    links: [PRACTICE_LINK],
  },
  {
    id: "wf-daily-logs",
    track: "workflow",
    category: "Field Operations",
    title: "Daily Logs, Meetings, and the 3-Week Look-Ahead",
    summary:
      "The recurring documentation and coordination cadence that keeps a job moving and defensible.",
    minutes: 4,
    keyTerms: [
      { term: "Daily log", definition: "The superintendent's day-by-day record of manpower, weather, deliveries, delays, and incidents on site." },
      { term: "3-week look-ahead", definition: "A rolling schedule extract showing the next three weeks of activities, used to coordinate subs and flag near-term conflicts." },
      { term: "OAC meeting", definition: "Owner-Architect-Contractor meeting — the regular forum for reviewing schedule, RFIs, submittals, and open issues with the whole team." },
    ],
    body: [
      {
        heading: "Why the daily log matters more than it seems",
        paragraphs: [
          "A daily log looks like routine paperwork, but it's the project's contemporaneous record — the document you point to six months later when a schedule delay claim needs to be proven or disproven. Weather delays, late deliveries, and manpower shortages only carry weight in a dispute if they were documented the day they happened, not reconstructed from memory afterward.",
        ],
      },
      {
        heading: "The weekly cadence",
        bullets: [
          "Superintendent logs daily conditions; PM reviews them daily for anything that needs escalation.",
          "Weekly subcontractor coordination meeting with a rolling 3-week look-ahead — this is where sequencing conflicts between trades get caught before they become field problems.",
          "Weekly RFI and submittal log review to keep both moving instead of going stale.",
          "Bi-weekly or monthly OAC meeting to keep the owner and architect aligned on schedule and open items.",
        ],
      },
      {
        heading: "Why the look-ahead is a coordination tool, not just a schedule",
        paragraphs: [
          "The full CPM schedule might have hundreds of activities spanning a year or more — too much detail to act on day-to-day. The 3-week look-ahead pulls out just the near-term window so the superintendent and subs can actually plan manpower, deliveries, and space conflicts (two trades needing the same area on the same day) a few weeks out, which is the timeframe where real coordination decisions get made.",
        ],
      },
      {
        heading: "In SiteCommand",
        paragraphs: [
          "Daily Logs capture field conditions per day; the Meetings tool tracks agendas and minutes across the OAC and coordination cadence; the Tasks tool's AI-recommended 'To Do' section surfaces time-sensitive follow-ups (like an overdue submittal or an inspection to book ahead) grounded in these same records.",
        ],
      },
    ],
    relatedLessonIds: ["wf-submittals", "wf-rfis"],
    links: [PRACTICE_LINK],
  },
  {
    id: "wf-punch-closeout",
    track: "workflow",
    category: "Closeout",
    title: "Punch List & Project Closeout",
    summary:
      "The last mile: getting from substantially complete to a happy owner with a clean set of records.",
    minutes: 5,
    keyTerms: [
      { term: "Punch list", definition: "The list of minor deficiencies (wrong hardware finish, a scuffed wall) identified near the end of the job that must be corrected before final acceptance." },
      { term: "Substantial completion", definition: "The point where the owner can use the space for its intended purpose, even if minor punch items remain." },
      { term: "O&M manuals", definition: "Operations & Maintenance manuals — the manufacturer documentation the owner needs to run and maintain installed equipment." },
    ],
    body: [
      {
        heading: "Why closeout deserves as much rigor as buyout",
        paragraphs: [
          "It's tempting to treat closeout as an afterthought once the building looks done, but a disorganized closeout is what actually delays final payment, final lien waivers, and the warranty clock starting cleanly. The last 5% of a job (closeout) often takes a disproportionate amount of PM attention precisely because it involves dozens of small, easy-to-lose-track-of items across every trade.",
        ],
      },
      {
        heading: "The workflow, step by step",
        ordered: [
          "GC self-punch (pre-punch): walk every space internally and fix what you can before the architect/owner ever sees it.",
          "Architect/owner punch walk generates the official punch list.",
          "Track punch items to closure by trade, with back-checks to confirm the fix actually resolved the item (not just that someone marked it done).",
          "Collect closeout documents: O&M manuals, as-built drawings, warranties, attic stock (spare material for future repairs).",
          "Conduct owner training on building systems (HVAC controls, fire alarm panel, etc.).",
          "Issue substantial and final completion certificates.",
          "Process final pay applications, release retainage, and collect final lien waivers.",
          "Reconcile contingency and close out the project financials.",
        ],
      },
      {
        heading: "Common pitfalls",
        bullets: [
          "Letting the punch list balloon because self-punch was skipped, making the official punch walk far worse than it needed to be.",
          "Chasing O&M manuals and warranties after the sub has already demobilized and moved to the next job — much harder to get their attention.",
          "Forgetting to schedule the 11-month warranty walk, which is the owner's last chance to flag issues before the standard one-year warranty period closes.",
        ],
      },
      {
        heading: "In SiteCommand",
        paragraphs: [
          "Punch list items are tracked to closure with photo documentation and status, and the same Commitments/Change Orders records used throughout the job carry forward into final reconciliation — retainage release, final change orders, and closed-out cost reporting.",
        ],
      },
    ],
    relatedLessonIds: ["wf-sov-payapp"],
    links: [PRACTICE_LINK],
  },

  // ───────────────────────────── Concepts ─────────────────────────────
  {
    id: "cn-drawings",
    track: "concept",
    category: "Drawings & Specs",
    title: "Reading a Construction Drawing Set",
    summary:
      "The sheet series, scales, and symbols every PM needs to be fluent in before their first site walk.",
    minutes: 6,
    keyTerms: [
      { term: "Sheet series", definition: "The letter prefix on a drawing number that identifies its discipline — A for Architectural, S for Structural, M/E/P for Mechanical/Electrical/Plumbing, C for Civil." },
      { term: "Detail callout", definition: "A circled reference on a plan pointing to a larger-scale detail drawing elsewhere in the set showing exactly how something is built." },
      { term: "Revision cloud", definition: "A cloud-shaped marking around content that changed since the last issue, with a triangle noting the revision number." },
    ],
    body: [
      {
        heading: "The sheet series is your map",
        paragraphs: [
          "A full drawing set is organized by discipline, and the letter prefix tells you which one you're looking at: G (General — cover sheet, code info), C (Civil — site/grading/utilities), A (Architectural — plans, elevations, sections, details), S (Structural), M (Mechanical/HVAC), E (Electrical), P (Plumbing), FP (Fire Protection). Learning this series is the fastest way to find the sheet you actually need instead of flipping through the whole set.",
        ],
      },
      {
        heading: "The core drawing types",
        bullets: [
          "Plans — a top-down view of a floor, showing walls, rooms, and layout.",
          "Elevations — a straight-on view of a building face, showing height and exterior appearance.",
          "Sections — a vertical 'cut' through the building showing how floors, walls, and roof stack together.",
          "Details — a zoomed-in, larger-scale drawing of one specific condition (a window head, a foundation edge) referenced by a callout on the plan.",
          "Reflected Ceiling Plans (RCPs) — a special plan type covered in its own lesson, showing what's happening above your head instead of on the floor.",
        ],
      },
      {
        heading: "Reading revisions",
        paragraphs: [
          "Drawings change throughout design and construction, and every issue is tracked in a revision block (usually bottom-right of the sheet) listing revision number, date, and description. A revision cloud on the drawing itself marks exactly what changed since the last issue — always check you're looking at the current revision before making a field decision, since working off an outdated sheet is a common (and expensive) mistake.",
        ],
      },
      {
        heading: "In SiteCommand",
        paragraphs: [
          "The Drawings tool tracks every sheet's drawing number, title, and current revision, so the field always has a single source of truth for 'which version is current' — and Submittals, RFIs, and Specifications can all reference specific drawing numbers directly.",
        ],
      },
    ],
    relatedLessonIds: ["cn-rcp", "cn-csi", "wf-rfis"],
  },
  {
    id: "cn-rcp",
    track: "concept",
    category: "Drawings & Specs",
    title: "What Is an RCP (Reflected Ceiling Plan)?",
    summary:
      "The one drawing type that shows you what's happening above your head — light fixtures, diffusers, sprinklers, and ceiling grid.",
    minutes: 4,
    keyTerms: [
      { term: "RCP", definition: "Reflected Ceiling Plan — a plan view of the ceiling as if it were mirrored down onto the floor, so you're 'looking up' while reading it top-down like a normal plan." },
      { term: "ACT", definition: "Acoustical Ceiling Tile — the common drop-in tile-and-grid ceiling system shown on an RCP." },
      { term: "Diffuser / register", definition: "The grille where conditioned air enters (diffuser) or returns (register) a room, coordinated on the RCP with lighting and sprinklers." },
    ],
    body: [
      {
        heading: "Why it's called 'reflected'",
        paragraphs: [
          "A normal floor plan looks down at the floor. If you tried to draw the ceiling the same way, you'd be looking up — which is disorienting to draft and read. Instead, the RCP is drawn as if the ceiling were a mirror laid on the floor, reflecting the ceiling layout down into the same top-down view as every other plan. That's the entire meaning of 'reflected': it's a mirror-image convention, not a different physical thing.",
        ],
      },
      {
        heading: "What you'll actually find on one",
        bullets: [
          "Ceiling type and height per room (ACT grid, drywall, exposed structure) and the ceiling grid layout.",
          "Light fixture locations and types.",
          "HVAC diffusers and return air registers.",
          "Fire sprinkler head locations.",
          "Speakers, smoke detectors, access panels, and other ceiling-mounted devices.",
        ],
      },
      {
        heading: "Why the RCP is a coordination flashpoint",
        paragraphs: [
          "Every one of those items — lights, diffusers, sprinklers, speakers — belongs to a different trade, and they're all competing for the same limited ceiling space above a hung grid. This is exactly where MEP coordination clashes show up: a light fixture and a sprinkler head wanting the same spot, or a duct run too low for the ceiling height shown. Reviewing the RCP against the MEP plans early — often in a coordinated BIM model — is one of the highest-value document reviews a PM can do before rough-in starts.",
        ],
      },
      {
        heading: "Common pitfalls",
        bullets: [
          "Reading the RCP in isolation instead of cross-checking it against the MEP plans for the same area.",
          "Missing a ceiling height change between rooms, which affects duct and pipe routing above.",
          "Field crews installing off an outdated RCP revision after a late lighting or HVAC change.",
        ],
      },
    ],
    relatedLessonIds: ["cn-drawings", "cn-mep"],
  },
  {
    id: "cn-mep",
    track: "concept",
    category: "Building Systems",
    title: "MEP Systems: Mechanical, Electrical, Plumbing",
    summary:
      "The three building systems that touch nearly every other trade — and why they're always the tightest coordination problem on a job.",
    minutes: 6,
    keyTerms: [
      { term: "Mechanical (HVAC)", definition: "Heating, ventilation, and air conditioning — the equipment and ductwork that condition and move air through the building." },
      { term: "Rough-in", definition: "The phase where MEP systems are installed inside walls, ceilings, and floors before they're covered up by drywall or slab." },
      { term: "Trim-out", definition: "The finish phase where visible MEP components — fixtures, devices, registers — are installed after the space is finished." },
    ],
    body: [
      {
        heading: "The three systems, briefly",
        bullets: [
          "Mechanical (M) — HVAC: air handlers, rooftop units (RTUs), ductwork, diffusers, and the controls that regulate temperature and airflow.",
          "Electrical (E) — power distribution from the utility/switchgear down to panels, conduit, wiring, devices (outlets, switches), and lighting.",
          "Plumbing (P) — domestic water supply, sanitary/waste drainage, gas piping, and fixtures (sinks, toilets, water heaters).",
        ],
        paragraphs: [
          "Fire protection (sprinklers, standpipes) is often grouped with MEP informally, even though it's technically its own trade (FP) — the coordination challenge is the same.",
        ],
      },
      {
        heading: "Why MEP is where schedules go wrong",
        paragraphs: [
          "Structure and envelope trades mostly work in sequence, one after another. MEP trades all need the same wall cavities and ceiling space at roughly the same time, which is why 'MEP coordination' — resolving clashes between ductwork, pipe, conduit, and structure before anyone installs anything — is its own dedicated pre-construction effort, usually done in a coordinated 3D model. Skipping or rushing this step is one of the most common causes of costly field rework.",
        ],
      },
      {
        heading: "Rough-in vs. trim-out",
        paragraphs: [
          "MEP installs happen in two distinct passes. Rough-in comes first — pipe, duct, and wire go in before walls and ceilings close up, and it must be inspected before it's covered (an inspector literally has to see it before drywall goes up). Trim-out comes much later, near the end of the job, when the finished visible pieces — light fixtures, outlets, plumbing fixtures, registers — go in on top of the finished walls and ceilings. A PM tracking 'percent complete' on an MEP subcontract needs to know which pass is being billed.",
        ],
      },
      {
        heading: "Long-lead equipment to watch",
        bullets: [
          "Electrical switchgear and generators — often the longest lead time on the job, sometimes 40+ weeks.",
          "Rooftop units (RTUs) and chillers.",
          "Elevators — technically vertical transportation, but always coordinated tightly with MEP shaft rough-in.",
        ],
      },
      {
        heading: "In SiteCommand",
        paragraphs: [
          "MEP-heavy divisions generate a disproportionate share of RFIs and submittals — coordination clashes and long-lead equipment approvals — so the Submittal log and RFI log are where MEP risk shows up first, well before it's visible in the field.",
        ],
      },
    ],
    relatedLessonIds: ["cn-rcp", "cn-longlead", "wf-submittals"],
  },
  {
    id: "cn-csi",
    track: "concept",
    category: "Drawings & Specs",
    title: "CSI MasterFormat & Divisions of Work",
    summary:
      "The standard numbering system behind every spec book, budget code, and submittal log in U.S. construction.",
    minutes: 5,
    keyTerms: [
      { term: "MasterFormat", definition: "The Construction Specifications Institute's standard numbering/organizing system for construction specifications, organized into numbered Divisions." },
      { term: "Division", definition: "A major category of work (e.g. Division 03 = Concrete, Division 26 = Electrical) that groups related spec sections." },
      { term: "Cost code / budget code", definition: "The code used to track budget and cost, usually aligned to (or derived from) the CSI division structure so cost and specs speak the same language." },
    ],
    body: [
      {
        heading: "Why a shared numbering system matters",
        paragraphs: [
          "Before MasterFormat, every architect and GC organized specs their own way, which made it hard to compare projects or communicate consistently across a fragmented industry. CSI MasterFormat standardized this into numbered Divisions, so 'Division 09' means finishes on every project in the country, and a submittal register, budget, or spec book can all reference the same structure without translation.",
        ],
      },
      {
        heading: "The divisions you'll use constantly",
        bullets: [
          "Division 01 — General Requirements (project-wide administrative and procedural requirements).",
          "Division 03 — Concrete.",
          "Division 04-07 — Masonry, Metals, Wood, Thermal & Moisture Protection (the building envelope).",
          "Division 08-09 — Openings (doors/windows) and Finishes.",
          "Division 22-23 — Plumbing and HVAC (Mechanical).",
          "Division 26-28 — Electrical, Communications, Electronic Safety & Security.",
          "Division 31-33 — Earthwork, Exterior Improvements, Utilities (Civil/Site).",
        ],
      },
      {
        heading: "How it connects to cost and submittals",
        paragraphs: [
          "Budget codes almost always trace back to CSI divisions (sometimes with a company's own sub-segments layered on top via a Work Breakdown Structure), which is what lets a PM roll a submittal, an RFI, and a budget line up to the same scope of work. When you build a submittal register 'organized by CSI division,' you're really walking the spec book division by division and pulling out every section that requires one.",
        ],
      },
      {
        heading: "In SiteCommand",
        paragraphs: [
          "Budget codes are built from segmented Work Breakdown Structure (WBS) pieces that a company defines once and reuses across projects, and the Specifications tool parses an uploaded spec book into per-section rows so the division structure is searchable rather than buried in a PDF.",
        ],
      },
    ],
    relatedLessonIds: ["cn-drawings", "wf-submittals"],
  },
  {
    id: "cn-longlead",
    track: "concept",
    category: "Procurement",
    title: "Long-Lead Items & Procurement Planning",
    summary:
      "Why a $50,000 switchgear order can be more schedule-critical than a $2M concrete package.",
    minutes: 5,
    keyTerms: [
      { term: "Long-lead item", definition: "Equipment or material with a fabrication/delivery time long enough that it must be ordered well before it's actually needed in the field to avoid delaying the schedule." },
      { term: "Lead time", definition: "The total time from placing an order to having the item on site — submittal approval time plus fabrication/shipping time." },
      { term: "LOI (Letter of Intent)", definition: "An early, limited commitment to a vendor that locks pricing and authorizes design/submittal work to start before the full subcontract is signed." },
    ],
    body: [
      {
        heading: "Cost isn't what makes something long-lead",
        paragraphs: [
          "A common misconception is that the biggest-dollar trades are the biggest schedule risk. In reality, lead time — not price — is what determines schedule risk. Switchgear, generators, elevators, custom windows, and specialty RTUs can each take 20-50+ weeks from order to delivery, which means they often have to be ordered before the building they're going into even exists yet.",
        ],
      },
      {
        heading: "The planning workflow",
        ordered: [
          "During buyout, identify every item whose total lead time (submittal review + fabrication + shipping) threatens the schedule if ordered on a 'normal' timeline.",
          "Lock pricing early with an LOI or early-release purchase order, even before the full subcontract is negotiated.",
          "Fast-track that item's submittal — often submitted and reviewed before the rest of the trade's submittals.",
          "Track the procurement log separately from the general submittal log, with its own delivery milestones tied backward from the field install date.",
          "Inspect on receipt — a damaged long-lead item can be as bad as a late one, since there may not be time to re-order.",
        ],
      },
      {
        heading: "Why this deserves its own tracking log",
        paragraphs: [
          "A general submittal log tells you approval status. A procurement log answers a different question: 'will this physically be on site when the schedule needs it?' — tracking order date, submittal approval date, fabrication start, and delivery date against the CPM schedule's install milestone. Long-lead tracking is one of the most valuable weekly/bi-weekly reviews a PM runs, because it's the earliest possible warning sign of a schedule slip.",
        ],
      },
      {
        heading: "In SiteCommand",
        paragraphs: [
          "The Tasks tool's AI-recommended 'To Do' section is specifically grounded in schedule position and typical/known construction lead times, so it can flag procurement that needs to move now — long before the field is standing in front of an empty equipment room.",
        ],
      },
    ],
    relatedLessonIds: ["wf-buyout", "wf-submittals", "cn-mep"],
  },
  {
    id: "cn-contracts",
    track: "concept",
    category: "Contracts & Cost",
    title: "Contract Types: Lump Sum, GMP, and Cost-Plus",
    summary:
      "How the project is priced changes everything about how change, risk, and profit work.",
    minutes: 5,
    keyTerms: [
      { term: "Lump Sum (Stipulated Sum)", definition: "A fixed total price for the defined scope — the GC bears the risk of cost overruns and keeps the upside of savings." },
      { term: "GMP (Guaranteed Maximum Price)", definition: "A cost-plus-fee contract with a ceiling — the owner pays actual cost plus fee up to the GMP, and savings below it are often shared." },
      { term: "Cost-Plus", definition: "The owner pays actual project cost plus a fee (fixed or percentage), with no ceiling — the owner bears the cost risk." },
    ],
    body: [
      {
        heading: "Why contract type is the first thing to understand on a new job",
        paragraphs: [
          "Before you can manage a project's cost, you need to know who's actually holding the financial risk — because that determines how carefully change has to be tracked, who benefits from savings, and how transparent the books need to be with the owner.",
        ],
      },
      {
        heading: "The three you'll see most often",
        bullets: [
          "Lump Sum — one fixed price for a defined scope. The GC is on the hook if costs run over, but keeps any savings. Change to scope requires a formal change order to adjust the price.",
          "GMP — the owner pays actual verified cost plus a fee, but the GC guarantees it won't exceed a ceiling. Savings below the GMP are often split between owner and GC per a shared-savings clause; overruns above it are usually the GC's risk (subject to contract terms).",
          "Cost-Plus (open-book, no ceiling) — the owner pays actual cost plus a fee with no cap. Lower risk for the GC, but requires full transparency into actual costs since the owner is directly exposed to overruns.",
        ],
      },
      {
        heading: "Why this changes how you manage change events",
        paragraphs: [
          "On a Lump Sum job, every scope change needs a priced change order before work proceeds — the contract price doesn't move on its own. On a GMP job, changes inside the original scope but within contingency/allowances might not need a full change order at all — some can be handled as budget changes against the owner's invoice directly, without a Prime Contract Change Order (PCCO), especially for GMP/allowance-contingency scenarios. Knowing which situation you're in determines whether a discovery in the field needs a formal CO or can be absorbed and simply reported.",
        ],
      },
      {
        heading: "In SiteCommand",
        paragraphs: [
          "The Budget tool's Budget Changes workflow explicitly supports adding approved budget changes to the owner's latest invoice as a billing-review group, which is exactly this GMP pattern — reducing change-order overuse for changes that don't need one.",
        ],
      },
    ],
    relatedLessonIds: ["wf-change-events", "cn-retainage"],
  },
  {
    id: "cn-retainage",
    track: "concept",
    category: "Contracts & Cost",
    title: "Retainage & Lien Waivers",
    summary:
      "The two protections that make sure everyone actually gets paid — and how they slow down (deliberately) every invoice.",
    minutes: 4,
    keyTerms: [
      { term: "Retainage", definition: "A percentage of each pay application withheld until the work (or the whole project) reaches an agreed completion milestone, protecting the payer's leverage to ensure work is finished correctly." },
      { term: "Conditional lien waiver", definition: "A waiver that only takes effect once the payment actually clears — protects the payee if a check bounces." },
      { term: "Unconditional lien waiver", definition: "A waiver that takes effect immediately upon signing, regardless of whether payment has cleared — riskier for the payee, safer for the payer." },
    ],
    body: [
      {
        heading: "Why retainage exists",
        paragraphs: [
          "If a subcontractor were paid 100% for every month's work, they'd have very little financial incentive to come back and fix punch list items or finish the last details of a scope. Retainage — typically 5-10% — is held back from every payment specifically to preserve that leverage. It isn't a penalty; it's a structural incentive built into almost every construction contract.",
        ],
      },
      {
        heading: "How it flows through the payment chain",
        paragraphs: [
          "The owner typically retains a percentage from the GC's pay app, and the GC in turn retains the same (or a similar) percentage from each subcontractor's pay app. Retainage is usually released in stages — a partial reduction at substantial completion, with the remainder held until final completion and closeout documentation is fully collected. Some contracts step retainage down (e.g. from 10% to 5%) partway through the job once trust is established — a PM needs to track the contract's specific schedule, not assume a flat rate for the whole job.",
        ],
      },
      {
        heading: "Lien waivers: the other half of the protection",
        paragraphs: [
          "A mechanic's lien is a legal claim a contractor or supplier can file against a property if they aren't paid — and it can cloud the owner's title even if the GC (not the owner) is the one who failed to pay a sub. Lien waivers are how the payment chain protects against this: each paid party signs a waiver giving up their lien rights for the amount paid, and the GC collects these from every sub before releasing the next pay application up the chain.",
        ],
      },
      {
        heading: "Common pitfalls",
        bullets: [
          "Releasing payment before collecting the prior period's lien waivers — this is the single most common way a GC ends up double-exposed to a lien.",
          "Mixing up conditional and unconditional waivers — signing an unconditional waiver before payment has actually cleared gives up protection for nothing.",
          "Losing track of a contract's retainage step-down schedule and over- or under-withholding.",
        ],
      },
    ],
    relatedLessonIds: ["wf-sov-payapp", "wf-commitments"],
  },
  {
    id: "cn-rfi-vs-submittal",
    track: "concept",
    category: "Drawings & Specs",
    title: "RFI vs. Submittal: What's the Difference?",
    summary:
      "Two of the most common project documents, and why mixing them up slows everyone down.",
    minutes: 3,
    keyTerms: [
      { term: "RFI", definition: "A question asked when the contract documents are unclear, conflicting, or incomplete — asking the design team to clarify their intent." },
      { term: "Submittal", definition: "A proposal showing exactly what the subcontractor plans to build/install/supply, submitted for the design team's approval against that already-clear intent." },
    ],
    body: [
      {
        heading: "The one-sentence distinction",
        paragraphs: [
          "An RFI asks a question because the design intent is unclear. A submittal proposes an answer to a question the design already answered — 'here's exactly what we plan to build for the requirement you already specified; please confirm it matches.' If you're asking the architect to clarify what they meant, it's an RFI. If you're showing the architect what you intend to install, it's a submittal.",
        ],
      },
      {
        heading: "Side-by-side",
        bullets: [
          "Trigger — RFI: a gap, conflict, or ambiguity found in the documents. Submittal: a spec section that requires product data, shop drawings, or samples before fabrication.",
          "Who initiates — RFI: usually the field or a sub flags a question, routed through the GC. Submittal: the sub prepares it proactively as part of their scope.",
          "What's being reviewed — RFI: the design team's own intent (they're clarifying themselves). Submittal: the sub's proposed means of meeting that intent (the design team is checking someone else's work).",
          "Typical outcome — RFI: a written answer/clarification. Submittal: Approved, Approved as Noted, Revise & Resubmit, or Rejected.",
        ],
      },
      {
        heading: "Why the mix-up costs time",
        paragraphs: [
          "Routing a submittal through the RFI process (or vice versa) sends it to the wrong reviewer with the wrong expectations — an architect asked to 'clarify' a shop drawing that's actually asking for approval will bounce it back confused, costing a review cycle. Getting this distinction right at the point of creation is a small habit that keeps both logs moving at the pace they're supposed to.",
        ],
      },
    ],
    relatedLessonIds: ["wf-rfis", "wf-submittals"],
  },
];

/**
 * Full curriculum. Workflow/concept additions from the process file merge
 * into the two core tracks; the other four files each own a whole track.
 * Order matters: lessonsByTrack preserves array order, which drives the
 * left-nav grouping and prev/next navigation.
 */
export const LESSONS: Lesson[] = [
  ...CORE_LESSONS,
  ...PROCESS_LESSONS,
  ...TECHNICAL_LESSONS,
  ...SITEWORK_LESSONS,
  ...MEP_LESSONS,
  ...COMMERCIAL_LESSONS,
  ...FOUNDATIONS_LESSONS,
];

export function getLesson(id: string): Lesson | undefined {
  return LESSONS.find((l) => l.id === id);
}

export function lessonsByTrack(track: LessonTrack): Lesson[] {
  return LESSONS.filter((l) => l.track === track);
}

export function lessonCategories(track: LessonTrack): string[] {
  const seen: string[] = [];
  for (const l of lessonsByTrack(track)) {
    if (!seen.includes(l.category)) seen.push(l.category);
  }
  return seen;
}

export const TRACK_LABELS: Record<LessonTrack, string> = {
  workflow: "Workflows",
  concept: "Concepts",
  technical: "Building the Work",
  sitework: "Site & Civil",
  mep: "MEP Systems",
  commercial: "Contracts & Commercial",
  foundations: "Professional Skills",
};
