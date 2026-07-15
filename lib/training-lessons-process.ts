/**
 * PM Process additions to the core Workflows + Concepts tracks — budget,
 * scheduling, permits, quality, safety, and risk workflows, plus the
 * project-lifecycle and specification-reading concepts. Authored from
 * Track 1 (PM Process) and Track 1.1–1.3 of the PM learning curriculum.
 *
 * Client-safe; imports only types from training-lessons (no runtime cycle).
 */

import type { Lesson, LessonLink } from "./training-lessons";

const PRACTICE_LINK: LessonLink = {
  label: "Practice this in your training sandbox",
  href: "/training/practice",
};

export const PROCESS_LESSONS: Lesson[] = [
  // ─────────────────────── Workflow track additions ───────────────────────
  {
    id: "wf-budget",
    track: "workflow",
    category: "Budget & Cost",
    title: "Budget & Cost Management: Reading the Job's Financial Health",
    summary:
      "How a construction budget is structured, what the columns actually mean, and how to forecast final cost every month.",
    minutes: 7,
    keyTerms: [
      { term: "Cost code", definition: "The budget's addressing system — a WBS code (usually CSI-based) that every dollar of estimate, commitment, and actual cost gets tagged to." },
      { term: "Committed cost", definition: "Dollars you've contractually promised (subcontracts + POs), whether or not the work is done or billed yet." },
      { term: "Projected final cost", definition: "Your honest monthly estimate of what each line will cost at the end of the job: actuals + commitments + estimated cost to complete." },
    ],
    body: [
      {
        heading: "The budget's anatomy",
        paragraphs: [
          "A construction budget is a grid: rows are cost codes (02-310 Earthwork, 03-300 Concrete, …) and columns tell the story of each line over time. Original budget is what was estimated at award. Approved changes move money via change orders. Revised budget = original + approved changes — the current authorized number. Committed costs are your subcontracts and POs against the line; direct costs are actuals (invoices, payroll, deliveries); and projected final cost is what you believe the line will really finish at.",
        ],
      },
      {
        heading: "Where the money story hides",
        bullets: [
          "Buyout gains and losses — the gap between what a trade was estimated at and what you actually bought it for. Early buyout wins can evaporate later; log them, don't spend them twice.",
          "Contingency — draw it down deliberately and track every draw. A contingency with no log is a slush fund, and owners notice.",
          "Committed vs. revised — a line where commitments already exceed revised budget is over before a single invoice lands. That's the earliest warning you get.",
          "Unbought scope — until a trade is bought, the budget line is a guess. The buyout log and the budget must be read together.",
        ],
      },
      {
        heading: "The monthly forecast discipline",
        ordered: [
          "Walk every cost code monthly: actuals to date + open commitments + realistic cost to complete.",
          "Never hide bad news in the projection — a surprise in month 14 is a career problem; the same number flagged in month 6 is just management.",
          "Reconcile the forecast against pending change events: work performed on unapproved changes is exposure until it's papered.",
          "Report projected over/under to the PX/owner with the why, not just the number.",
        ],
      },
      {
        heading: "In SiteCommand",
        paragraphs: [
          "The Budget tool holds the cost-code grid: original amounts, budget changes, committed costs flowing in from the Commitments tool, and Job to Date Costs (pulled from the connected ERP via Resync). Change events carry pending cost through to the budget views before they become change orders, so exposure is visible — not just approved dollars.",
        ],
      },
    ],
    relatedLessonIds: ["wf-commitments", "wf-change-events", "pf-financial", "pf-estimating"],
    links: [PRACTICE_LINK],
  },
  {
    id: "wf-scheduling",
    track: "workflow",
    category: "Schedule",
    title: "Scheduling: CPM, Look-Aheads, and Milestones",
    summary:
      "Critical path fundamentals, the three-week look-ahead that actually runs the job, and the milestones that carry contractual weight.",
    minutes: 6,
    keyTerms: [
      { term: "Critical path", definition: "The longest chain of dependent activities through the schedule — any delay on it delays the end date day-for-day." },
      { term: "Float", definition: "How long a non-critical activity can slip before it affects the end date. Zero float = critical." },
      { term: "Fragnet", definition: "A small network of activities inserted into the schedule to model a change or delay for a time-impact analysis." },
    ],
    body: [
      {
        heading: "CPM in one sitting",
        paragraphs: [
          "A CPM schedule is activities (with durations) tied together by logic: finish-to-start (pour footings, then strip forms), start-to-start (start drywall two floors behind framing), finish-to-finish. Run the math forward and backward and you get the critical path — the chain with zero float. The PM's job isn't building the schedule (that's usually a scheduler or the super); it's knowing which activities are critical this month and defending them.",
        ],
      },
      {
        heading: "Baseline vs. current vs. as-built",
        bullets: [
          "The baseline is the approved plan of record — never overwrite it. Updates get compared against it.",
          "The current schedule reflects actual progress and re-forecast logic; update it monthly at minimum.",
          "The as-built record (actual start/finish dates) is what wins or loses delay claims years later.",
          "Milestones carry contract weight: NTP starts the clock, substantial completion stops liquidated damages and starts warranties, final completion releases retainage.",
        ],
      },
      {
        heading: "The three-week look-ahead",
        paragraphs: [
          "The master CPM is the map; the three-week look-ahead is the steering wheel. Every week, the PM and super pull the next three weeks of activities, break them into crew-level tasks, and check constraints: is the material on site, is the submittal approved, is the RFI answered, is the inspection scheduled, is the predecessor actually done? A look-ahead item with an unresolved constraint is a promise you already know you'll break.",
        ],
      },
      {
        heading: "When things slip",
        bullets: [
          "Weather days: know how your contract counts time (calendar vs. work days) and what qualifies as an excusable weather day — document them in the daily log as they happen.",
          "Recovery schedules show how you'll claw back lost time (resequencing, added crews, overtime) — owners will ask for one before granting more time.",
          "Time impact analysis with fragnets is how a change gets schedule days, not just dollars. Late notice kills schedule relief just like it kills cost relief.",
        ],
      },
    ],
    relatedLessonIds: ["cn-longlead", "wf-daily-logs", "wf-change-events"],
    links: [PRACTICE_LINK],
  },
  {
    id: "wf-permits",
    track: "workflow",
    category: "Permits & Inspections",
    title: "Permits, Inspections & the AHJ",
    summary:
      "Permit types, the inspection sequence from footing to Certificate of Occupancy, and how to work with the authority having jurisdiction.",
    minutes: 5,
    keyTerms: [
      { term: "AHJ", definition: "Authority Having Jurisdiction — the building department, fire marshal, or other agency with legal authority to approve the work." },
      { term: "Special inspections", definition: "IBC Chapter 17 third-party inspections (structural steel, concrete, soils, …) hired by the owner, separate from AHJ inspections." },
      { term: "TCO", definition: "Temporary Certificate of Occupancy — conditional permission to occupy before every item is complete, usually with a punch list and a deadline." },
    ],
    body: [
      {
        heading: "The permit landscape",
        bullets: [
          "Building permit — the main permit for the structure; usually pulled by the GC after plan review.",
          "Trade permits — electrical, mechanical, plumbing, fire alarm, sprinkler; usually pulled by the licensed trade contractor.",
          "Site-side permits — land disturbance/grading (often triggered before anything else), right-of-way, utility connections.",
          "Specialty permits — elevator, crane, hot work, demolition. The PM's job is a permit log: what's needed, who pulls it, status, expiration.",
        ],
      },
      {
        heading: "The inspection sequence",
        ordered: [
          "Footing/foundation inspections before concrete covers the rebar.",
          "Underslab plumbing/electrical before the slab pour.",
          "Framing and MEP rough-in inspections before insulation and drywall — the classic 'pre-cover' gates.",
          "Insulation, then drywall/fire-rating inspections.",
          "Trade finals (electrical, mechanical, plumbing, fire alarm acceptance test with the fire marshal).",
          "Building final → Certificate of Occupancy. Fail a mid-sequence inspection and everything behind it stacks up.",
        ],
      },
      {
        heading: "Working with the AHJ",
        paragraphs: [
          "Inspectors remember jobs that waste their trips. Call for inspections only when the work is genuinely ready, have the approved drawings on site, and have the responsible foreman walk with them. When an inspector flags something you believe is compliant, don't argue at the wall — ask for the code section, then resolve it through the plan reviewer or a documented RFI to the design team. A failed inspection is recoverable; a hostile relationship with the AHJ follows the project to the CO.",
        ],
      },
      {
        heading: "CO vs. TCO",
        paragraphs: [
          "Substantial completion in the contract and a Certificate of Occupancy from the AHJ are different finish lines — you can reach one without the other. A TCO gets the owner in early but comes with conditions and expiration dates; track TCO conditions like punch items with deadlines, because an expired TCO is an unoccupiable building.",
        ],
      },
    ],
    relatedLessonIds: ["wf-quality", "wf-punch-closeout", "pf-codes"],
    links: [PRACTICE_LINK],
  },
  {
    id: "wf-quality",
    track: "workflow",
    category: "Quality Control",
    title: "Quality Control: Catch It Before It's Covered",
    summary:
      "First-work inspections, mock-ups, pre-cover gates, and the testing log — quality is a schedule of moments, not a vibe.",
    minutes: 5,
    keyTerms: [
      { term: "First work in place", definition: "A formal review of the first completed unit of any repetitive scope (first bathroom, first window install) before the sub builds fifty more the same way." },
      { term: "Mock-up", definition: "A physical sample assembly (exterior wall, finish room) built for approval before production work; the approved mock-up becomes the quality benchmark." },
      { term: "NCR", definition: "Nonconformance report — documented work that doesn't meet the contract documents, tracked until corrected and verified." },
    ],
    body: [
      {
        heading: "Quality is cheapest early",
        paragraphs: [
          "Every quality problem has three prices: caught at the first unit (cheap), caught at pre-cover inspection (annoying), or found after drywall/backfill/occupancy (expensive and reputational). A QC program is just a system for buying problems at the first price. That's why the tools are all timing tools — first-work reviews, benchmark inspections, and pre-cover gates exist to put eyes on work at the moment correction is still cheap.",
        ],
      },
      {
        heading: "The working parts of a QC program",
        bullets: [
          "First-work-in-place inspections — walk the first of everything with the sub's foreman and the super; agree it's the standard or fix it before repetition multiplies it.",
          "Mock-ups — required by spec for envelope and key finishes. Get written approval, then physically protect the mock-up; it settles arguments for the rest of the job.",
          "Pre-cover inspections — before drywall, before backfill, before every pour: photos, checklists, and sign-offs on what's about to disappear.",
          "Testing & inspection logs — concrete cylinders and break results, compaction reports, weld/bolt inspections. Chase failed tests to closure; an open failed break on an elevated deck is not a filing problem, it's a structural one.",
          "Nonconformance tracking — log it, assign it, correct it, verify it. An untracked NCR is a future punch item at best and a latent defect at worst.",
        ],
      },
      {
        heading: "In SiteCommand",
        paragraphs: [
          "Pre-cover photos and inspection notes belong in Daily Logs and Photos, tied to the date and location. Failed inspections that need design input become RFIs; corrective scope with cost becomes a change event or backcharge. The punch list tool is for the end of the job — QC discipline is what keeps it short.",
        ],
      },
    ],
    relatedLessonIds: ["wf-daily-logs", "wf-permits", "wf-punch-closeout", "tech-testing-cx"],
    links: [PRACTICE_LINK],
  },
  {
    id: "wf-safety",
    track: "workflow",
    category: "Safety",
    title: "Safety Management: The PM's Role",
    summary:
      "The Focus Four, pre-task planning, incident response, and why the PM owns safety culture even with a safety director on staff.",
    minutes: 5,
    keyTerms: [
      { term: "Focus Four", definition: "OSHA's four leading killers in construction: falls, struck-by, caught-in/between, and electrocution." },
      { term: "JHA / AHA", definition: "Job/Activity Hazard Analysis — a task-level breakdown of hazards and controls, prepared before high-risk work starts." },
      { term: "Recordable", definition: "An injury or illness meeting OSHA recording criteria (beyond first aid) that must go on the OSHA 300 log." },
    ],
    body: [
      {
        heading: "Why the PM can't delegate this",
        paragraphs: [
          "The super and safety director run daily safety execution, but the PM controls the conditions that make sites dangerous: schedule compression, stacked trades, underfunded subs, and the pressure to keep moving after a near miss. A PM who accelerates the schedule without asking what it does to crew stacking has made a safety decision, whether they meant to or not.",
        ],
      },
      {
        heading: "The high-risk short list",
        bullets: [
          "Falls — leading killer. Anything above 6 feet needs a plan: guardrails, PFAS, hole covers. Watch the leading edges and the ladder shortcuts.",
          "Excavation & trenching — anything 5 feet or deeper needs protective systems and a competent person. Soil never gives a warning.",
          "Crane picks — critical lifts need lift plans; keep everyone out from under the load, always.",
          "Hot work, LOTO, confined space — permit-driven activities. If the permit isn't filled out, the work isn't authorized.",
          "Sub prequalification — EMR, OSHA history, and a real site-specific safety plan before mobilization, not after the first incident.",
        ],
      },
      {
        heading: "When something happens",
        ordered: [
          "Care for the person first; secure the scene second.",
          "Notify per your company's protocol — and know the OSHA clocks: fatalities within 8 hours, inpatient hospitalization/amputation/loss of eye within 24.",
          "Preserve evidence and document: photos, witness statements, the daily log entry, equipment condition.",
          "Investigate for root cause, not blame — 'the ladder' is never the root cause.",
          "Follow through on corrective actions and communicate them; an incident nobody learns from will repeat.",
        ],
      },
      {
        heading: "In SiteCommand",
        paragraphs: [
          "Daily logs are the safety record's backbone: manpower, weather, incidents, toolbox talks, and visitor logs, entered the day they happen. Contemporaneous entries defend the company in an OSHA action or a lawsuit; entries reconstructed weeks later do the opposite.",
        ],
      },
    ],
    relatedLessonIds: ["wf-daily-logs", "wf-risk", "pf-leadership"],
    links: [PRACTICE_LINK],
  },
  {
    id: "wf-risk",
    track: "workflow",
    category: "Risk & Insurance",
    title: "Risk, Insurance & Compliance",
    summary:
      "The insurance stack on a project, what a COI actually has to say, bonds, and the compliance gates before a sub sets foot on site.",
    minutes: 6,
    keyTerms: [
      { term: "COI", definition: "Certificate of Insurance — the sub's proof of coverage. It must name the right parties and endorsements, not just exist." },
      { term: "Additional insured", definition: "An endorsement putting the GC (and usually owner) under the sub's liability policy for the sub's work." },
      { term: "Builder's risk", definition: "Property insurance on the building while it's being built — fire, storm, theft of installed work — usually carried by owner or GC per contract." },
    ],
    body: [
      {
        heading: "The insurance stack",
        bullets: [
          "CGL (commercial general liability) — bodily injury and property damage arising from the work.",
          "Workers' comp — statutory; the certificate should show the waiver of subrogation when the subcontract requires it.",
          "Auto and umbrella/excess — the umbrella sits above CGL/auto limits.",
          "Builder's risk — the building itself during construction; know the deductible and who carries it before the first water event.",
          "Professional liability — design errors; matters on design-build and delegated-design scopes (steel connections, fire sprinklers, curtain wall).",
        ],
      },
      {
        heading: "Reading a COI like it matters",
        paragraphs: [
          "A COI in the file is not compliance. Check that limits meet the subcontract exhibit, the additional insured endorsement is attached (not just a checkbox), coverage is primary & non-contributory, the waiver of subrogation is there, and the policy dates cover the work period. Expired COIs are the classic audit finding — track expirations and block site access until renewed. The worst time to discover a coverage gap is after the loss.",
        ],
      },
      {
        heading: "Bonds and wrap-ups",
        bullets: [
          "Bid bonds guarantee the bidder will sign at their price; performance bonds guarantee completion; payment bonds guarantee subs/suppliers get paid (and replace lien rights on public work).",
          "A bond is not insurance — the surety pays, then comes after the contractor. Bonding capacity is a company's financial reputation in paper form.",
          "OCIP/CCIP wrap-ups: owner- or contractor-controlled programs insuring everyone on site under one policy. Enrollment paperwork and payroll reporting become PM-tracked compliance items, and bid deductions must match the coverage provided.",
        ],
      },
      {
        heading: "The compliance gate",
        paragraphs: [
          "No sub mobilizes until the boring paperwork is done: executed subcontract, compliant COI, safety prequalification, and any wrap-up enrollment. The day a sub starts work without them, the leverage to get them is gone. In SiteCommand, commitments shouldn't move from Draft toward work-in-place until the compliance items on that contract are collected.",
        ],
      },
    ],
    relatedLessonIds: ["wf-commitments", "com-clauses", "com-liens-bonds", "wf-safety"],
    links: [PRACTICE_LINK],
  },

  // ─────────────────────── Concept track additions ───────────────────────
  {
    id: "cn-lifecycle",
    track: "concept",
    category: "Project Basics",
    title: "The Project Lifecycle & Who Does What",
    summary:
      "Pursuit to warranty: the phases every project moves through, the cast of characters, and which documents outrank which.",
    minutes: 5,
    keyTerms: [
      { term: "NTP", definition: "Notice to Proceed — the owner's formal green light that starts contract time." },
      { term: "Order of precedence", definition: "The contract's rule for which document governs when documents conflict — typically contract > specs > drawings, with newer/more specific beating older/more general." },
      { term: "PX", definition: "Project Executive — the PM's boss; owns the client relationship and portfolio-level risk across several projects." },
    ],
    body: [
      {
        heading: "The phases",
        ordered: [
          "Pursuit — business development and the proposal/interview that wins the job.",
          "Preconstruction — estimating, design review, value engineering, permits, early procurement.",
          "Buyout — turning the estimate into executed subcontracts and POs, trade by trade.",
          "Construction — the long middle: RFIs, submittals, changes, billing, schedule, quality, safety.",
          "Closeout — punch, inspections, commissioning, O&Ms, as-builts, final billing and retainage.",
          "Warranty — the one-year (typically) correction period after substantial completion. Each phase's mistakes are paid for in the next one.",
        ],
      },
      {
        heading: "The cast",
        bullets: [
          "PX oversees; PM runs the project's money, paper, and relationships; APM/PE run the submittal and RFI engines and grow into PMs.",
          "Superintendent owns the field: sequence, manpower, safety, daily execution. The PM/super partnership is the most important relationship on the job.",
          "Project accountant runs pay apps, sub invoices, and job cost with the PM.",
          "Estimator hands off the budget and the bid-time assumptions — a handoff meeting worth taking seriously.",
          "Across the table: owner (and their rep), architect, engineers (S/M/E/P/civil/geotech), and the AHJ.",
        ],
      },
      {
        heading: "The document hierarchy",
        paragraphs: [
          "The contract documents form a stack: the agreement and general conditions at the top, then specifications, then drawings, then the addenda/ASIs/bulletins that modify them, with RFI answers layering on interpretation. When documents conflict, the contract's order-of-precedence clause decides — and when it's genuinely ambiguous, that's an RFI, not a guess. Knowing where an answer should live tells you where to look and what governs when two places disagree.",
        ],
      },
    ],
    relatedLessonIds: ["cn-drawings", "cn-specs", "cn-contracts", "com-delivery"],
  },
  {
    id: "cn-specs",
    track: "concept",
    category: "Drawings & Specs",
    title: "Reading Specifications: The Three-Part Format",
    summary:
      "How spec sections are built, where the submittal requirements hide, and why Division 01 governs more of your day than any drawing.",
    minutes: 5,
    keyTerms: [
      { term: "Three-part format", definition: "The standard spec section structure: Part 1 General (procedures), Part 2 Products (what's allowed), Part 3 Execution (how it's installed)." },
      { term: "Basis of design", definition: "The specific product the designer designed around; 'or equal' substitutions must be formally proposed and approved, not assumed." },
      { term: "Division 01", definition: "General Requirements — the procedural spec sections (submittal procedures, temporary facilities, closeout requirements) that apply to every trade." },
    ],
    body: [
      {
        heading: "How a spec section is built",
        paragraphs: [
          "Every technical section follows the same three-part skeleton. Part 1 General is procedural: scope, related sections, submittal requirements, quality assurance (mock-ups, certifications), delivery and storage, warranty terms. Part 2 Products names manufacturers, materials, and performance criteria. Part 3 Execution covers preparation, installation tolerances, field quality control, and protection. PMs live in Part 1 — that's where the paperwork obligations are — while the field lives in Part 3.",
        ],
      },
      {
        heading: "Building the submittal register from the specs",
        paragraphs: [
          "The submittal register isn't invented — it's extracted. Walk every spec section's Part 1 'Submittals' article and list what it demands: product data, shop drawings, samples, mock-ups, certifications, closeout documents. Do this once, thoroughly, at the start of the job, and the register becomes your procurement to-do list. Miss a required submittal and you'll discover it when the architect rejects installed work for lacking an approved submittal behind it.",
        ],
      },
      {
        heading: "Traps worth knowing",
        bullets: [
          "Division 00 (bidding and contract requirements) and Division 01 outrank trade preferences — closeout requirements, temporary utilities, and submittal procedures all live there.",
          "'Or equal' has a process: a formal substitution request with comparative data, in the window Division 01 allows — usually early. An unapproved substitute installed is rework waiting to be ordered.",
          "Specs and drawings disagree constantly (a spec'd product discontinued, a drawing note contradicting a section). That's an RFI with both references cited.",
          "Spec sections cross-reference each other ('related sections') — the firestopping or sealants your trade needs may be specified in someone else's section.",
        ],
      },
    ],
    relatedLessonIds: ["cn-csi", "wf-submittals", "cn-drawings"],
  },
];
