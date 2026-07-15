/**
 * "Contracts & Commercial" track — delivery methods, the standard document
 * families, the clauses that govern daily PM decisions, subcontract
 * administration, payment security, and claims. Authored from Track 3
 * (Contracts & Commercial) of the PM learning curriculum. Pricing structures
 * (lump sum, GMP, T&M) live in the core Concepts track (cn-contracts).
 *
 * Client-safe; imports only types from training-lessons (no runtime cycle).
 */

import type { Lesson } from "./training-lessons";

export const COMMERCIAL_LESSONS: Lesson[] = [
  // ─────────────────────── Contract Structures ───────────────────────
  {
    id: "com-delivery",
    track: "commercial",
    category: "Contract Structures",
    title: "Project Delivery Methods",
    summary:
      "Design-bid-build, CM at Risk, design-build, and CM-agent — how the delivery method rewires the PM's relationships and risk.",
    minutes: 5,
    keyTerms: [
      { term: "CMAR", definition: "CM at Risk — the CM joins during design as advisor, then converts to at-risk builder, usually under a GMP." },
      { term: "Design-build", definition: "One entity holds both design and construction — the owner buys a result, and design liability moves inside your team." },
      { term: "Multi-prime", definition: "The owner contracts directly with major trades; a CM-agent coordinates but holds no trade contracts and little risk." },
    ],
    body: [
      {
        heading: "The four shapes",
        bullets: [
          "Design-bid-build: complete design, competitive bids, lowest responsible bidder. Clean accountability, but the GC had no design input — document gaps become RFIs and change orders, and the relationship starts adversarial by structure.",
          "CM at Risk: hired during design for preconstruction (estimates, constructability, phased buyout), then a GMP to build. The PM's precon fingerprints are on the documents — 'we didn't know' is a weaker argument.",
          "Design-build: owner contracts one entity for both. Fastest and most collaborative internally, but design risk lives in-house; the PM manages designers as team members, not counterparties.",
          "CM-agent / multi-prime: the CM advises for a fee while the owner holds the trade contracts — coordination without commercial leverage.",
        ],
      },
      {
        heading: "What changes for the PM",
        paragraphs: [
          "Delivery method decides three things about your daily life: who you can lean on (in DBB the architect is the owner's agent judging you; in DB they may work for you), where changes come from (DBB changes flow from document gaps; DB changes mostly from owner scope moves, because gaps are your own problem), and when cost certainty exists (bid day vs. GMP amendment vs. progressive). Read the delivery structure before reading the clauses — it tells you which relationships are contractual, which are collaborative, and where the risk actually sits.",
        ],
      },
      {
        heading: "Hybrids you'll meet",
        paragraphs: [
          "Real projects blend the pure forms: bridging design-build (owner's architect takes design partway, DB team finishes), progressive design-build (team selected on qualifications, price developed together), and IPD-style multiparty agreements with shared risk pools at the collaborative extreme. In every hybrid, ask the same two questions: who holds design liability, and at what moment does price become a commitment? The answers locate most of the risk.",
        ],
      },
    ],
    relatedLessonIds: ["cn-contracts", "com-documents", "cn-lifecycle"],
  },
  {
    id: "com-documents",
    track: "commercial",
    category: "Contract Structures",
    title: "The AIA Family & Standard Contract Documents",
    summary:
      "A101, A201, A401, G702/G703 — the standard forms, what each does, and why the general conditions govern more of your day than any drawing.",
    minutes: 5,
    keyTerms: [
      { term: "A201", definition: "AIA's General Conditions — the rulebook for RFIs, changes, payment, claims, and termination that rides behind the agreement." },
      { term: "G702/G703", definition: "The standard pay application: G702 is the summary/certification page, G703 the schedule-of-values continuation sheet." },
      { term: "Flow-down", definition: "The subcontract clause binding subs to the prime contract's terms — the mechanism that makes A201 everyone's rulebook." },
    ],
    body: [
      {
        heading: "The family tree",
        bullets: [
          "Agreements: A101 (lump sum), A102 (cost-plus with GMP), A104 (short form) — the thin document with the price, the time, and the parties.",
          "A201 General Conditions — incorporated by reference into the agreement and the subcontracts; the thick document with the rules.",
          "A401 — the standard GC-subcontractor agreement, flowing prime terms down.",
          "The G-series paperwork: G702/G703 pay apps, G701 change orders, G704 certificate of substantial completion — the forms your monthly cycle runs on.",
          "ConsensusDocs is the parallel family (200-series agreements, 750 subcontract), generally considered more contractor-balanced. Same anatomy, different defaults.",
        ],
      },
      {
        heading: "Why A201 runs your day",
        paragraphs: [
          "Nearly every workflow you execute is an A201 procedure with a deadline attached: claims and notice provisions, the architect's role in certifying payment and judging disputes first, change directive mechanics, substantial completion's definition, insurance and correction-period obligations. When something goes wrong, the answer is almost never in the drawings — it's in the general conditions, usually with a notice clock already running. A PM who has actually read A201 (once, with a highlighter) argues from the contract; everyone else argues from feelings.",
        ],
      },
      {
        heading: "Manuscript contracts: where the danger is",
        paragraphs: [
          "Sophisticated owners often use custom ('manuscript') contracts or heavily amended AIA forms — and the amendments are the point. The standard form's balance gets shifted one strikethrough at a time: pay-if-paid inserted, no-damage-for-delay added, notice windows shortened, LDs uncapped. Never assume an 'AIA contract' has AIA terms; read the amendments against the base form, and make sure the deviations flow down to your subs — a risk you accepted upstream but didn't pass downstream is a risk you own alone.",
        ],
      },
    ],
    relatedLessonIds: ["com-clauses", "cn-contracts", "wf-sov-payapp"],
  },

  // ─────────────────── Clauses & Administration ───────────────────
  {
    id: "com-clauses",
    track: "commercial",
    category: "Clauses & Administration",
    title: "Key Contract Clauses Every PM Must Know",
    summary:
      "Notice, changes, delay, differing site conditions, LDs, indemnity, termination — the dozen clauses that decide who pays when things go sideways.",
    minutes: 7,
    keyTerms: [
      { term: "Notice provision", definition: "The requirement to formally notify of a claim/change within a set window (often 7–21 days) — miss it and an otherwise valid claim can die on procedure." },
      { term: "CCD", definition: "Construction Change Directive — the owner's unilateral order to proceed with changed work before price is agreed; you perform under protest-and-track rules." },
      { term: "Liquidated damages", definition: "Pre-agreed daily damages for late completion — check the rate, the trigger (substantial completion), and whether a cap exists." },
    ],
    body: [
      {
        heading: "The clauses that generate claims",
        bullets: [
          "Notice: every entitlement clause has a notice clock. The discipline is simple — when in doubt, send written notice preserving rights; you can always withdraw a claim, never un-miss a deadline.",
          "Changes: pricing methodology, allowed overhead & profit percentages, and the CCD mechanism for proceeding without agreement — know them before pricing your first PCO.",
          "Differing site conditions: Type I (site differs from what the documents indicated) and Type II (unusual for the locality). Without this clause, subsurface risk is yours entirely — a big deal on any dirt job.",
          "Schedule: time-is-of-the-essence, LD rates and caps, and the no-damage-for-delay clause that limits you to time extensions (no money) for owner delays — enforceable in many states, with exceptions worth knowing.",
          "Force majeure / excusable delay: what counts (weather beyond normal, epidemics, supply shocks), and whether it earns time only or time and money.",
        ],
      },
      {
        heading: "The clauses that allocate wreckage",
        bullets: [
          "Payment: pay-when-paid (timing) vs. pay-if-paid (risk transfer — sub eats owner insolvency where enforceable). Which one is in your subcontracts should be a decision, not an accident.",
          "Indemnification: who defends whom, and whether it stretches beyond your negligence (broad-form indemnity is restricted in many states — anti-indemnity statutes exist for a reason).",
          "Warranty: the one-year correction period is an additional remedy, not a liability expiration date — latent defect exposure runs to the statute of repose.",
          "Termination: for cause (with cure periods that must be honored to the letter) vs. for convenience (owner exits, you're paid for work done plus limited costs — usually not lost profit).",
          "Dispute resolution: mediation-then-arbitration vs. litigation, venue, and prevailing-party fees — decided now, felt years later.",
        ],
      },
      {
        heading: "The PM's working method",
        paragraphs: [
          "Nobody memorizes a contract; effective PMs index one. Build a one-page contract summary at kickoff: every notice window, the LD rate and cap, retainage terms, payment timing, change-pricing percentages, and the claims procedure — then wire the deadlines into how the team works so notice never depends on memory. The summary costs an afternoon; the first preserved claim pays for it a hundred times over.",
        ],
      },
    ],
    relatedLessonIds: ["com-documents", "wf-change-events", "com-claims", "wf-risk"],
  },
  {
    id: "com-sub-admin",
    track: "commercial",
    category: "Clauses & Administration",
    title: "Subcontract Administration: Defaults, Backcharges & Disputes",
    summary:
      "Scope exhibits that prevent fights, the default-and-cure sequence when a sub fails, backcharge discipline, and joint checks.",
    minutes: 6,
    keyTerms: [
      { term: "Cure period", definition: "The contractual window (typically 48–72 hours after written notice) a defaulting sub gets to fix performance before you may supplement or terminate." },
      { term: "Supplementation", definition: "Bringing in another contractor to perform part of a failing sub's scope at the sub's cost — the intermediate step short of full termination." },
      { term: "Joint check", definition: "A check payable to the sub and its supplier together — protecting against liens from second-tier parties the sub isn't paying." },
    ],
    body: [
      {
        heading: "The scope exhibit is the whole game",
        paragraphs: [
          "Most subcontract disputes are scope disputes, and most scope disputes were preventable at buyout. A tight exhibit lists inclusions specifically (spec sections, drawings by number, quantities where they matter), states exclusions explicitly, and resolves the classic boundary fights in writing before award: who firestops each trade's penetrations, who provides blocking and embeds, who patches fireproofing, hoisting, cleanup, temporary protection. The descoping meeting — walking the sub through the exhibit line by line before signing — is the cheapest dispute resolution you will ever do.",
        ],
      },
      {
        heading: "When a sub is failing",
        ordered: [
          "Document performance contemporaneously — manpower counts, missed milestones, defective-work photos in the daily log — before the relationship turns; evidence gathered after looks like litigation prep.",
          "Communicate the gap and the required recovery in writing; many failures are cash-flow or management problems that surface early as thin crews.",
          "Issue formal notice of default citing the subcontract clause, starting the cure period. Follow the clause exactly — a botched default becomes the sub's wrongful-termination claim.",
          "If cure fails: supplement the scope at the sub's cost, or terminate for cause and complete with another — the bigger hammer with the bigger procedural risk.",
          "Notify the surety immediately if the sub is bonded; a performance bond claim has its own notice requirements and the surety gets its own chance to arrange completion.",
        ],
      },
      {
        heading: "Backcharges and money fights",
        bullets: [
          "Backcharge discipline: notify before doing the work (except emergencies), give the sub the chance to self-perform the fix, document cost with tickets and photos, and deduct via change order — not a surprise line on the pay app.",
          "Undocumented backcharges convert real damages into disputed claims; the paper trail is the difference.",
          "Payment disputes: withhold specifically and in writing (tied to identified defects or claims), never as vague leverage — statutory prompt-pay rules apply.",
          "Joint checks protect against downstream liens when a sub isn't paying its suppliers — a standard tool once payment-chain trouble shows, and often the early-warning sign itself.",
        ],
      },
    ],
    relatedLessonIds: ["wf-buyout", "wf-commitments", "com-liens-bonds", "wf-daily-logs"],
  },

  // ─────────────── Payment Security & Claims ───────────────
  {
    id: "com-liens-bonds",
    track: "commercial",
    category: "Payment Security & Claims",
    title: "Liens, Bonds & Payment Security",
    summary:
      "How mechanic's liens actually work, the four lien waiver types, payment bonds on public work, and the deadlines that quietly extinguish rights.",
    minutes: 6,
    keyTerms: [
      { term: "Mechanic's lien", definition: "A statutory security interest in the improved property for unpaid work — powerful, deadline-driven, and procedural to a fault." },
      { term: "Conditional waiver", definition: "A lien waiver effective only when the payment actually clears — the safe form to exchange at pay-app time." },
      { term: "Little Miller Act", definition: "State statutes (mirroring the federal Miller Act) requiring payment bonds on public projects, since you can't lien a courthouse." },
    ],
    body: [
      {
        heading: "How a lien actually works",
        paragraphs: [
          "A mechanic's lien turns unpaid construction work into a claim against the real estate itself — which is why owners and lenders fear it, and why the statutes make you earn it procedurally. The mechanics vary by state but the pattern holds: preliminary notice near the start of work (some states, like North Carolina's notice to the lien agent, require it very early), a claim-of-lien filing deadline measured from last work, then an enforcement lawsuit deadline after that. Each deadline missed extinguishes the right entirely. Subs and suppliers you've never met can lien the project through your sub — which is what waiver collection is actually defending against.",
        ],
      },
      {
        heading: "The four waivers and the monthly exchange",
        bullets: [
          "Conditional progress — effective when this month's check clears; what a sub should hand you with a pay app.",
          "Unconditional progress — effective immediately; only proper after the money is actually received.",
          "Conditional final and unconditional final — same logic at job's end; the unconditional final is the last document exchanged for the last dollar.",
          "The GC's monthly discipline: collect waivers from subs (and second-tier suppliers on big scopes) covering the prior payment before releasing the next one, and pass your own up to the owner. A missing waiver in the stack is exactly the gap a title company will find.",
          "Never sign an unconditional waiver for money you haven't received — it says paid, and courts tend to believe it.",
        ],
      },
      {
        heading: "Public work and the bond alternative",
        paragraphs: [
          "Public property can't be liened, so payment bonds stand in: the Miller Act federally, Little Miller Acts in the states. Claimants notice the surety within a statutory window (typically 90 days from last work for second-tier claimants) and sue within a year — different deadlines, same unforgiving procedure. On private work, ranked payment security runs: payment bond (if one exists) > lien rights > stop notices (where available, trapping funds still in the owner's hands) > contract claims. Know which of these protect you — and which your subs' suppliers will use against your project — before the first payment problem, not during it.",
        ],
      },
    ],
    relatedLessonIds: ["cn-retainage", "wf-sov-payapp", "com-sub-admin", "wf-risk"],
  },
  {
    id: "com-claims",
    track: "commercial",
    category: "Payment Security & Claims",
    title: "Claims & Disputes: Building the Record",
    summary:
      "Delay claim mechanics, acceleration and disruption, the contemporaneous documentation that wins, and when to settle versus escalate.",
    minutes: 6,
    keyTerms: [
      { term: "Excusable / compensable", definition: "The delay matrix: excusable delays earn time; compensable ones earn time and money; concurrent delays (both parties at fault) usually net to time only." },
      { term: "Constructive acceleration", definition: "Being forced to accelerate because a deserved time extension was denied — compensable, but only with the paper trail proving each element." },
      { term: "Reservation of rights", definition: "Language preserving claims you can't fully quantify yet — signed with pay apps and change orders so routine paperwork doesn't waive real claims." },
    ],
    body: [
      {
        heading: "The delay matrix",
        paragraphs: [
          "Every delay gets sorted by two questions: was it the contractor's fault, and did it hit the critical path? Owner-caused critical delays are compensable (time + money); third-cause events like abnormal weather are excusable (time only); contractor-caused delays are neither. Concurrent delay — both sides delaying the same window — typically nets to time without money, which is why each side works to prove the other's delay was the truly critical one. None of it is arguable without schedule evidence: the baseline, honest monthly updates, and fragnet-based time impact analyses tying each event to the critical path.",
        ],
      },
      {
        heading: "The other claim species",
        bullets: [
          "Directed acceleration — the owner orders recovery and pays for it; clean, if priced before the overtime starts.",
          "Constructive acceleration — you requested time for an excusable delay, were denied, and accelerated to avoid LDs. Compensable, but every element (entitlement, request, denial, actual acceleration, cost) must be documented in sequence.",
          "Loss of productivity / disruption — the work was made harder (stacked trades, out-of-sequence work, excessive changes) even if not later. Real money, hard proof; measured-mile comparisons (impacted vs. unimpacted periods of the same work) are the credible method.",
          "Pass-through sub claims — the sub's disruption claim rides through your prime contract paperwork; their record is only as good as what you made them keep.",
        ],
      },
      {
        heading: "Documentation wins, escalation is a choice",
        paragraphs: [
          "Claims are won by the boring records made when nobody was fighting: daily logs with manpower and delay notes, dated photos, notice letters sent inside their windows, schedule updates that told the truth at the time, and meeting minutes with action items and dates. Reconstructed records read like advocacy; contemporaneous ones read like facts. And escalation is economics, not honor — mediation settles most disputes at a fraction of arbitration's cost, relationships have value, and recovery percentages shrink as fees mount. Preserve every claim ruthlessly; prosecute the ones the math supports.",
        ],
      },
    ],
    relatedLessonIds: ["wf-daily-logs", "wf-scheduling", "com-clauses", "pf-communication"],
  },
];
