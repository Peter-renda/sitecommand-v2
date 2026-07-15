/**
 * "Professional Skills" track — the everything-else that separates a PM who
 * runs paperwork from one who runs projects: financial literacy, estimating,
 * leadership, writing, codes, and ethics. Authored from Track 4
 * (Professional Foundations) of the PM learning curriculum.
 *
 * Client-safe; imports only types from training-lessons (no runtime cycle).
 */

import type { Lesson } from "./training-lessons";

export const FOUNDATIONS_LESSONS: Lesson[] = [
  // ───────────────────────────── Money ─────────────────────────────
  {
    id: "pf-financial",
    track: "foundations",
    category: "Money",
    title: "Construction Financial Literacy: Margin, WIP & Cash Flow",
    summary:
      "Margin vs. markup, how job cost accounting works, what the WIP report tells the CFO about your project, and where fee actually erodes.",
    minutes: 6,
    keyTerms: [
      { term: "Margin vs. markup", definition: "Markup is profit over cost (10% markup on $100 cost = $110). Margin is profit over price ($10 on $110 ≈ 9.1% margin). Confusing them systematically underprices work." },
      { term: "WIP report", definition: "The work-in-progress schedule comparing percent complete (by cost) to percent billed — where overbilling, underbilling, and fading projections become visible to the CFO." },
      { term: "Cost type", definition: "The second axis of job cost after cost code: labor, material, subcontract, equipment, other — each with different risk behavior." },
    ],
    body: [
      {
        heading: "The math that costs money when confused",
        paragraphs: [
          "Markup and margin describe the same dollars from different directions, and mixing them up is the classic pricing error. To achieve a 10% margin you must mark cost up about 11.1% — divide cost by 0.90, don't multiply by 1.10. On a $10M job that confusion is roughly $100k of fee that was never in the price. Change order pricing is where it bites monthly: know which one your contract's 'allowable overhead and profit' language actually means.",
        ],
      },
      {
        heading: "How the company reads your job",
        bullets: [
          "Job cost runs on two axes — cost code (what scope) and cost type (what kind of dollar). Labor is where surprises live, because it's the cost you self-perform and estimate worst.",
          "The WIP compares earned (cost-based percent complete × contract) against billed: overbilled means you're holding the owner's cash (good, within reason — it's borrowed, not earned); underbilled means you're financing the owner (bad), or worse, hiding a fade.",
          "A projected-fee number that declines month after month is called fade, and CFOs pattern-match it instantly. One honest write-down beats four quarters of drip.",
          "General conditions (your time-driven site costs — staff, trailer, fencing) burn by the month: every schedule slip converts directly to GC cost, which is why time is money isn't a metaphor.",
        ],
      },
      {
        heading: "Cash flow and where fee leaks",
        paragraphs: [
          "Projects can be profitable on paper and cash-starved in fact: you pay labor weekly while owner payments arrive 30–60 days after billing, with retainage held on top. Front-loading the SOV (defensibly), billing stored materials, and chasing pay apps hard are cash-flow work, not accounting trivia. And fee erosion has a known taxonomy — unbilled change work, scope gaps between bid packages, GC burn from schedule slip, punch-phase labor, backcharges never collected, buyout 'savings' spent twice. Every one of them is a PM-controllable leak, which is exactly why the company watches your forecast.",
        ],
      },
    ],
    relatedLessonIds: ["wf-budget", "wf-sov-payapp", "pf-estimating", "cn-retainage"],
  },
  {
    id: "pf-estimating",
    track: "foundations",
    category: "Money",
    title: "Estimating Fundamentals & the Handoff",
    summary:
      "Takeoffs, unit pricing, conceptual estimates, plugging scope gaps — and why the estimate-to-budget handoff meeting is the PM's first real task.",
    minutes: 5,
    keyTerms: [
      { term: "Quantity takeoff", definition: "Measuring the work from the drawings — CY of concrete, SF of drywall, LF of pipe — the foundation under every price." },
      { term: "Assembly", definition: "A bundled unit price for a build-up (a SF of wall including studs, drywall, insulation, finish) — faster than pricing each component." },
      { term: "Scope gap", definition: "Work that fell between bid packages — every trade excluded it, everyone assumed someone else had it, and now it's the GC's fee that pays for it." },
    ],
    body: [
      {
        heading: "How the number was built",
        paragraphs: [
          "An estimate is layers: quantity takeoffs priced with unit costs and assemblies for self-performed and plug scopes, sub bids for the major trades, general conditions built from the schedule (months × monthly burn), then markup. Earlier-stage numbers are conceptual — cost per square foot and systems-level budgeting tuned by historical data. The PM doesn't need to be an estimator, but needs to read one's work: which numbers are hard bids, which are plugs, which quantities were takeoffs versus allowances — because the difference is where budget risk hides.",
        ],
      },
      {
        heading: "The handoff meeting",
        ordered: [
          "Sit with the estimator before they mentally move to the next pursuit — their assumptions are perishable.",
          "Walk the estimate against the buyout plan: what's bought, what's plugged, where the estimator was nervous.",
          "Extract the bid-day intelligence: which subs bid tight, who was high and why, whose scope letters had holes.",
          "Get the exclusions and clarifications list from the GC's own proposal — what you told the owner you didn't include is your first defense against scope creep.",
          "Log the known gaps and VE assumptions as budget risks, day one — they are the first entries in your cost forecast.",
        ],
      },
      {
        heading: "Scope gaps: the fee eater",
        paragraphs: [
          "The classic gaps repeat across projects: firestopping of each trade's penetrations, blocking and backing, temporary protection, hoisting for a trade without equipment, final cleaning, patching after everyone. Gap-hunting is a buyout skill — a scope matrix (rows = work items, columns = trades) makes the holes visible before award, when they cost a negotiation instead of after, when they cost fee. A PM who understands what was bid, and what wasn't, negotiates buyout from knowledge instead of hope.",
        ],
      },
    ],
    relatedLessonIds: ["wf-buyout", "wf-budget", "pf-financial"],
  },

  // ───────────────────────────── People ─────────────────────────────
  {
    id: "pf-leadership",
    track: "foundations",
    category: "People",
    title: "People & Leadership: Subs, Supers, and Managing Up",
    summary:
      "The relationship bank account with subs, the PM/super partnership, no-surprises management upward, and negotiation as a daily skill.",
    minutes: 6,
    keyTerms: [
      { term: "Relationship bank account", definition: "The running balance of fairness and follow-through with each sub — you make withdrawals (schedule pushes, favors) against deposits (paying on time, backing them when right)." },
      { term: "Managing up", definition: "Keeping your PX and owner informed so they're never surprised — bad news early with a plan beats good news late." },
      { term: "BATNA", definition: "Best alternative to a negotiated agreement — knowing yours (and estimating theirs) before any negotiation sets your real leverage." },
    ],
    body: [
      {
        heading: "Firm but fair with subcontractors",
        paragraphs: [
          "Subs talk to each other, and your reputation compounds across projects. The sustainable posture is firm on the contract and fair in the dealing: pay on time, process their change orders as fast as you want the owner to process yours, back them when they're right even against the owner, and hold the line on scope without humiliating anyone. The account matters because you will need withdrawals — the weekend pour, the crew held over Christmas, the favor that saves your milestone — and subs fund those for PMs who've made deposits.",
        ],
      },
      {
        heading: "The PM/super partnership",
        bullets: [
          "The most important relationship on the job: the PM owns money, paper, and the owner; the super owns sequence, manpower, and the field. Neither succeeds alone.",
          "Meet daily even briefly; disagree in private, present one plan in public — subs exploit daylight between PM and super within a week.",
          "Translate both directions: the super's field problems into cost/schedule/notice language; the contract's constraints into field-practical terms.",
          "Respect the craft: a PM who listens to a super's sequencing instincts, and a super who respects notice deadlines, make each other better at their jobs.",
        ],
      },
      {
        heading: "Managing up, negotiating always",
        paragraphs: [
          "The rule upward is no surprises: your PX should hear every material risk from you first, framed with a plan — 'here's the issue, here's the exposure, here are options, here's my recommendation.' PMs who bury bad news get micromanaged; PMs who surface it early get autonomy. And negotiation is your daily medium — buyout, change orders, back-charges, schedule trades. The fundamentals travel: prepare (know your BATNA and theirs), anchor on facts and documents rather than volume, trade things you value less for things you value more, and leave counterparties whole enough to perform — you still need them tomorrow.",
        ],
      },
    ],
    relatedLessonIds: ["pf-communication", "com-sub-admin", "wf-buyout"],
  },
  {
    id: "pf-communication",
    track: "foundations",
    category: "People",
    title: "Communication & Writing That Protects the Record",
    summary:
      "Email that stands up later, notice letters that preserve rights without burning bridges, minutes that hold, and delivering bad news early.",
    minutes: 5,
    keyTerms: [
      { term: "Confirming email", definition: "The 'per our conversation' follow-up that converts verbal directives into record — the single highest-value writing habit in construction." },
      { term: "Notice letter", definition: "Formal written notification preserving contractual rights within a deadline — firm, factual, clause-cited, and possible to send without hostility." },
      { term: "Executive summary", definition: "The three-sentence top of any report: status, issues, asks — written for the reader who won't scroll." },
    ],
    body: [
      {
        heading: "Write like it will be read aloud in a deposition",
        paragraphs: [
          "Construction email is business record, discoverable and permanent. That implies a few disciplines: state facts and dates rather than characterizations, keep anger out (the furious email always resurfaces at the worst time), one topic per thread so decisions are findable, and confirm every verbal directive in writing the same day — 'Per our conversation this morning, you directed us to proceed with X; we'll track cost under CE-014 and confirm schedule impact by Friday.' That one habit converts hallway talk into enforceable record more reliably than any other.",
        ],
      },
      {
        heading: "Notice without napalm",
        bullets: [
          "Send notice on time, every time — you can negotiate warmly after preserving rights coldly; you cannot resurrect a dead claim warmly or otherwise.",
          "Formula: reference the clause, state the triggering facts and dates, state impact known so far, reserve rights on what's unquantified, and commit to updates. No adjectives, no blame theater.",
          "Soften the channel, not the letter: a call first — 'contract requires me to formalize this; it's protection, not escalation' — keeps the relationship while the paper does its job.",
          "Meeting minutes are the same discipline: every open item with an owner and a due date, decisions recorded as decisions, and a stated correction window ('objections within 5 days') so silence ratifies the record.",
        ],
      },
      {
        heading: "Bad news early, with a plan",
        paragraphs: [
          "Bad news is the PM's real writing test. Deliver it as soon as it's real (not once it's unfixable), lead with the fact and the number, bring options with a recommendation, and never let the reader learn later that you knew sooner. The monthly owner report follows the same architecture: executive summary up top — schedule status, cost status, the two or three issues that matter, and what you need from the reader — then backup for those who scroll. Reports that bury the problem on page six don't hide it; they just prove you tried to.",
        ],
      },
    ],
    relatedLessonIds: ["pf-leadership", "com-claims", "wf-daily-logs"],
  },

  // ─────────────────────── Rules of the Game ───────────────────────
  {
    id: "pf-codes",
    track: "foundations",
    category: "Rules of the Game",
    title: "Codes & Standards: IBC, ADA, Energy, NFPA",
    summary:
      "How the IBC is organized, the accessibility details inspectors always catch, energy code basics, and the NFPA references behind fire systems.",
    minutes: 6,
    keyTerms: [
      { term: "Construction type (I–V)", definition: "The IBC's classification of a building's structure by fire resistance — Type I (protected noncombustible) through Type V (wood frame) — which, with occupancy, sets allowable heights and areas." },
      { term: "Occupancy classification", definition: "What the building is used for (Business, Residential, Assembly, …) — the other axis driving nearly every code requirement." },
      { term: "Local amendments", definition: "State and municipal modifications to the model codes — the reason 'the IBC says' is only the start of the answer." },
    ],
    body: [
      {
        heading: "The IBC's logic",
        paragraphs: [
          "The code isn't read cover to cover; it's navigated. Nearly everything keys off two classifications set early in design: occupancy (what happens inside) and construction type (what it's built of). Cross-reference them and the code yields allowable heights and areas, required fire ratings, egress requirements, and sprinkler triggers. A PM doesn't make those determinations — the architect's code summary sheet states them — but should understand them, because they explain otherwise-mysterious requirements: why this wall is rated, why that stair is pressurized, why the building 'wants' to be five stories and not six. Field changes that touch rated assemblies or egress are never just field changes.",
        ],
      },
      {
        heading: "ADA: the details inspectors always catch",
        bullets: [
          "Mounting heights — toilet accessories, grab bars, counters, operable parts within reach ranges: the tape-measure findings that fill accessibility punch lists.",
          "Clearances — toilet-room turning circles, door maneuvering clearances, knee space at sinks; framed an inch wrong, found at final.",
          "Slopes — the accessible route again: 2% cross slope, 5% running, ramp geometry and landings.",
          "Thresholds and hardware — half-inch max, lever action, closer force. The pattern: ADA fails in fractions of inches at the end of the job unless someone measures during rough-in, so measure during rough-in.",
        ],
      },
      {
        heading: "Energy and the NFPA family",
        paragraphs: [
          "Energy code (IECC / ASHRAE 90.1) drives envelope insulation and air-sealing details, glazing performance, lighting power and controls — with compliance proven by inspection and, increasingly, blower-door and commissioning requirements, so the air barrier detail you shortcut in month six becomes the test you fail in month eighteen. The NFPA references behind fire scope are worth recognizing on sight: NFPA 13 (sprinkler design), 72 (fire alarm), 101 (life safety). And everything above runs through local amendment — the state or city version of the model code is the one your inspector carries, so check local requirements before arguing from the model book.",
        ],
      },
    ],
    relatedLessonIds: ["wf-permits", "tech-fire", "sc-pedestrian-ada"],
  },
  {
    id: "pf-industry-ethics",
    track: "foundations",
    category: "Rules of the Game",
    title: "Industry Context & Ethics",
    summary:
      "How GCs actually make money, how PM work differs by sector, and the ethical lines — bid shopping, honest reporting, document integrity — that define a career.",
    minutes: 5,
    keyTerms: [
      { term: "Bid shopping", definition: "Using one sub's bid price to squeeze others after bid day — short-term savings, long-term poison: subs pad or skip your bids once they've been shopped." },
      { term: "Self-perform", definition: "Trade work a GC does with its own forces (often concrete or carpentry) — higher risk and reward than brokering everything to subs." },
      { term: "EMR", definition: "Experience modification rate — the insurance-market score of a contractor's safety history; it prices bids and prequalifies subs." },
    ],
    body: [
      {
        heading: "How the business works",
        paragraphs: [
          "GC fees are thin — often 2–5% on competitively bid work — so the money is made or lost in execution: buyout gains, general-conditions control, change order discipline, claims avoided, and cash-flow float. That's why the company sweats your monthly forecast; a single bad project can erase the margin of several good ones. The players around you each have their own economics too — developers chasing pro formas, architects burning fixed fees, subs floating payroll on your payment cycle — and reading those incentives explains most behavior that otherwise looks irrational.",
        ],
      },
      {
        heading: "Sector and setting change the job",
        bullets: [
          "Sectors differ in tempo and risk center: multifamily (repetition, framing/fire-assembly discipline), healthcare (infection control, phased work in occupied buildings, AHJ intensity), industrial/data centers (equipment-driven schedules, commissioning weight), institutional/public (procurement rules, payment bonds, prevailing wage).",
          "Union vs. open shop changes labor rules, jurisdiction lines between trades, and manpower planning.",
          "Public work adds Davis-Bacon/prevailing-wage compliance and certified payrolls — administrative scope with legal teeth.",
          "The alphabet around the industry — AGC, ABC, CMAA, DBIA; certifications like CCM, PMP, LEED AP, OSHA 30 — is worth recognizing, and occasionally pursuing.",
        ],
      },
      {
        heading: "The lines you don't cross",
        paragraphs: [
          "Construction runs on repeated relationships, which makes ethics practical, not decorative. Bid shopping and bid peddling poison the sub market you'll need for decades. Gifts and entertainment follow one test: would you be comfortable if the owner saw the receipt? Cost reporting is honest or it's fraud-adjacent — never hide bad news in a forecast, never bill for work not performed, never sign a waiver for money not received. And document integrity is absolute: never backdate, never alter a record after the fact, never 'refresh' a daily log for litigation. Your signature is the asset — the industry is small, memories are long, and a PM's reputation compounds in whichever direction it's pointed.",
        ],
      },
    ],
    relatedLessonIds: ["pf-financial", "pf-leadership", "wf-safety"],
  },
];
