/**
 * Day-by-day task schedule for "SiteCommand Training" sandboxes.
 *
 * The training Day panel (app/projects/[id]/components/TrainingDayPanel.tsx)
 * surfaces the tasks scheduled for the trainee's current in-sim day. Days do not
 * have to be contiguous — the pre-construction phase runs day-by-day (Days 1-7),
 * then the construction phases are spaced out (Days 14, 28, 42, 56, 70), so the
 * "Complete day" button jumps from, say, Day 7 straight to Day 14.
 *
 * This module is client-safe (no server-only imports) so the panel can import it
 * directly. Keyed by SimRole; only the Project Manager schedule is wired up
 * today (the only seeded role).
 */

import type { SimRole } from "@/lib/simulation-constants";

export type TrainingTask = {
  /** What the PM needs to do. */
  task: string;
  /** High-level bucket (Buyout, RFI, Submittals, Cost, …) shown as a chip. */
  category: string;
  /** Who the PM works with on the task. */
  collaborators: string;
  /** The expected output / artifact. */
  deliverable: string;
};

export type TrainingDay = {
  /** In-sim day number (matches projects.training_day). */
  day: number;
  /** Phase this day belongs to. */
  phase: string;
  /** Original schedule timeframe (e.g. "Week 1", "Months 2-4"). */
  timeframe: string;
  tasks: TrainingTask[];
  /**
   * Lessons (Training → Lessons ids) recommended alongside this day's tasks.
   * The Day panel renders them as deep links (/training/lessons?lesson=<id>).
   */
  lessonIds?: string[];
};

/**
 * Project Manager schedule — end-to-end PM responsibilities across a typical
 * build (~18-20 month construction). Pre-construction & buyout is mapped one day
 * per week (Days 1-7); the remaining construction phases are spaced every two
 * in-sim weeks (Days 14, 28, 42, 56, 70). Timeframes are indicative.
 */
const PROJECT_MANAGER_SCHEDULE: TrainingDay[] = [
  {
    day: 1,
    phase: "Pre-Construction & Buyout",
    timeframe: "Week 1",
    lessonIds: ["cn-lifecycle", "cn-drawings", "wf-rfis", "wf-budget"],
    tasks: [
      {
        task: "Meet with preconstruction team to review bid results and develop short-list of vendors by trade",
        category: "Buyout",
        collaborators: "Precon, Estimating, Owner",
        deliverable: "Bid tab / vendor short-list",
      },
      {
        task: "Begin detailed review of construction documents (architectural, structural, MEP, civil) for gaps and conflicts",
        category: "Document Review",
        collaborators: "PM, Super, Architect",
        deliverable: "Marked-up CDs / gap log",
      },
      {
        task: "Establish RFI log and issue first round of RFIs on design gaps, conflicts, and missing info",
        category: "RFI",
        collaborators: "PM, Architect, Engineers",
        deliverable: "Open RFI log",
      },
      {
        task: "Set up project in PM platform: directory, cost codes / WBS, budget, schedule shell, permissions",
        category: "Setup",
        collaborators: "PM, Project Admin",
        deliverable: "Configured project",
      },
      {
        task: "Confirm GMP / contract value, scope gaps, allowances, and contingency with owner",
        category: "Cost",
        collaborators: "PM, Owner, Estimating",
        deliverable: "Reconciled GMP / budget",
      },
    ],
  },
  {
    day: 2,
    phase: "Pre-Construction & Buyout",
    timeframe: "Week 2",
    lessonIds: ["wf-buyout", "cn-longlead", "pf-estimating"],
    tasks: [
      {
        task: "Level (scope-check) bids by trade; prepare bid comparison sheets and identify scope gaps",
        category: "Buyout",
        collaborators: "PM, Estimating",
        deliverable: "Bid leveling sheets",
      },
      {
        task: "Hold scope review calls with apparent low bidders for major trades (concrete, framing, MEP, envelope)",
        category: "Buyout",
        collaborators: "PM, Subcontractors",
        deliverable: "Scope-confirmed quotes",
      },
      {
        task: "Build buyout log with award targets, budgets by cost code, and award dates",
        category: "Buyout",
        collaborators: "PM, Estimating",
        deliverable: "Buyout log",
      },
      {
        task: "Identify long-lead items (switchgear, elevators, windows, RTUs, generators) and lock procurement deadlines",
        category: "Procurement",
        collaborators: "PM, Super, Subs",
        deliverable: "Long-lead procurement log",
      },
      {
        task: "Issue LOIs / early release to long-lead trades to lock pricing and start submittals",
        category: "Buyout",
        collaborators: "PM, Owner, Subs",
        deliverable: "Executed LOIs",
      },
    ],
  },
  {
    day: 3,
    phase: "Pre-Construction & Buyout",
    timeframe: "Week 3",
    lessonIds: ["wf-commitments", "wf-submittals", "cn-specs", "com-documents"],
    tasks: [
      {
        task: "Award subcontracts for foundation, structure / framing, and underground utilities",
        category: "Buyout",
        collaborators: "PM, Subs, Owner",
        deliverable: "Executed subcontracts",
      },
      {
        task: "Build submittal log / register from spec sections, organized by CSI division",
        category: "Submittals",
        collaborators: "PM, Project Admin",
        deliverable: "Submittal register",
      },
      {
        task: "Hold submittal log review with architect and MEP engineer to confirm required items and turnaround SLAs",
        category: "Submittals",
        collaborators: "PM, Architect, MEP Eng.",
        deliverable: "Agreed submittal schedule",
      },
      {
        task: "Set up Schedule of Values (SOV) for prime contract; request sub SOVs",
        category: "Cost",
        collaborators: "PM, Owner, Subs",
        deliverable: "Approved prime SOV",
      },
      {
        task: "Collect and review COIs, bonds, and W-9s from awarded subs",
        category: "Compliance",
        collaborators: "PM, Risk / Insurance",
        deliverable: "Compliance log",
      },
      {
        task: "Process change order(s) for known scope changes / owner-directed adds (e.g., unforeseen conditions)",
        category: "Change Mgmt",
        collaborators: "PM, Owner, Subs",
        deliverable: "Executed CO(s)",
      },
    ],
  },
  {
    day: 4,
    phase: "Pre-Construction & Buyout",
    timeframe: "Week 4",
    lessonIds: ["wf-permits", "com-sub-admin", "cn-rfi-vs-submittal"],
    tasks: [
      {
        task: "Continue subcontract awards (sitework, concrete, plumbing, electrical, mechanical)",
        category: "Buyout",
        collaborators: "PM, Subs",
        deliverable: "Executed subcontracts",
      },
      {
        task: "Process and route first submittals for early trades (rebar, mix designs, anchor bolts, structural connections)",
        category: "Submittals",
        collaborators: "PM, Architect, SEOR",
        deliverable: "Reviewed submittals",
      },
      {
        task: "Finalize procurement schedule tied to construction sequence; issue POs for long-lead",
        category: "Procurement",
        collaborators: "PM, Super, Subs",
        deliverable: "Procurement schedule / POs",
      },
      {
        task: "Submit and track permits (building, grading, utility, demo) with the AHJ",
        category: "Permitting",
        collaborators: "PM, Owner, AHJ",
        deliverable: "Permit tracking log",
      },
    ],
  },
  {
    day: 5,
    phase: "Pre-Construction & Buyout",
    timeframe: "Week 5",
    lessonIds: ["sc-site-analysis", "sc-esc", "sc-utilities"],
    tasks: [
      {
        task: "Mobilize site: field office, fencing, erosion control / SWPPP, staging and laydown",
        category: "Field Ops",
        collaborators: "Super, Sitework Sub",
        deliverable: "Mobilized site",
      },
      {
        task: "Conduct preconstruction kickoff meeting with owner, architect, engineers, and key subs",
        category: "Meetings",
        collaborators: "PM, Owner, Design Team, Subs",
        deliverable: "Kickoff minutes",
      },
      {
        task: "Confirm utility coordination (power, water, sewer, gas, telecom) with providers",
        category: "Coordination",
        collaborators: "PM, Super, Utilities",
        deliverable: "Utility coordination plan",
      },
    ],
  },
  {
    day: 6,
    phase: "Pre-Construction & Buyout",
    timeframe: "Week 6",
    lessonIds: ["wf-scheduling", "wf-sov-payapp", "wf-quality", "com-liens-bonds"],
    tasks: [
      {
        task: "Develop and baseline the CPM schedule with the superintendent; distribute to subs",
        category: "Schedule",
        collaborators: "PM, Super, Subs",
        deliverable: "Baseline CPM schedule",
      },
      {
        task: "Submit and track first pay application (mobilization, general conditions, early work)",
        category: "Cost",
        collaborators: "PM, Owner, Accounting",
        deliverable: "Submitted pay app",
      },
      {
        task: "Process envelope submittals (windows, waterproofing, roofing, cladding) — long-lead",
        category: "Submittals",
        collaborators: "PM, Architect, Subs",
        deliverable: "Reviewed envelope submittals",
      },
      {
        task: "Hold first OAC meeting; review RFI / submittal logs, schedule, and procurement status",
        category: "Meetings",
        collaborators: "PM, Owner, Architect",
        deliverable: "OAC minutes",
      },
      {
        task: "Establish QA/QC plan, Inspection & Test Plan (ITP), and mockup requirements",
        category: "Quality",
        collaborators: "PM, Super, Architect",
        deliverable: "QA/QC plan / ITP",
      },
    ],
  },
  {
    day: 7,
    phase: "Pre-Construction & Buyout",
    timeframe: "Week 8",
    lessonIds: ["pf-leadership", "pf-communication", "wf-risk"],
    tasks: [
      {
        task: "Complete buyout — target 90-100% bought out before structure begins",
        category: "Buyout",
        collaborators: "PM, Estimating",
        deliverable: "Closed buyout log",
      },
      {
        task: "Establish weekly subcontractor coordination meeting and 3-week look-ahead cadence",
        category: "Meetings",
        collaborators: "PM, Super, Subs",
        deliverable: "Meeting cadence set",
      },
    ],
  },
  {
    day: 14,
    phase: "Foundations & Site Utilities",
    timeframe: "Months 2-4",
    lessonIds: ["sc-grading", "tech-sitework", "tech-foundations", "tech-concrete"],
    tasks: [
      {
        task: "Install underground utilities: storm, sanitary, water, and dry utilities",
        category: "Field Ops",
        collaborators: "Super, Sitework / MEP Subs",
        deliverable: "Utilities installed / inspected",
      },
      {
        task: "Foundation layout, excavation, footings, foundation walls, and waterproofing",
        category: "Field Ops",
        collaborators: "Super, Concrete Sub",
        deliverable: "Foundations complete",
      },
      {
        task: "Coordinate MEP under-slab rough-in and inspections prior to slab / podium pour",
        category: "Coordination",
        collaborators: "PM, Super, MEP Subs",
        deliverable: "Approved under-slab inspections",
      },
      {
        task: "Form, reinforce, embed, and pour slab-on-grade / podium deck",
        category: "Field Ops",
        collaborators: "Super, Concrete Sub",
        deliverable: "Slab / podium poured",
      },
      {
        task: "Manage concrete testing (slump, breaks) and structural special inspections",
        category: "Quality",
        collaborators: "PM, Testing Agency, SEOR",
        deliverable: "Test / inspection reports",
      },
      {
        task: "Close out remaining structural and MEP rough-in submittals; expedite long-lead approvals",
        category: "Submittals",
        collaborators: "PM, Architect, Engineers",
        deliverable: "Approved submittals",
      },
      {
        task: "Submit and approve required mockups (exterior wall assembly, unit, window)",
        category: "Quality",
        collaborators: "PM, Architect, Subs",
        deliverable: "Approved mockups",
      },
      {
        task: "Respond to field-condition RFIs and process change events for differing site conditions",
        category: "Change Mgmt",
        collaborators: "PM, Architect, Subs",
        deliverable: "Updated RFI / CE logs",
      },
      {
        task: "Submit monthly pay application; review sub pay apps and collect lien waivers",
        category: "Cost",
        collaborators: "PM, Owner, Accounting",
        deliverable: "Approved pay app",
      },
      {
        task: "Update CPM schedule monthly; develop recovery plan if behind",
        category: "Schedule",
        collaborators: "PM, Super",
        deliverable: "Updated schedule / narrative",
      },
      {
        task: "Coordinate elevator pit, crane / hoist plan, and tower crane logistics if applicable",
        category: "Coordination",
        collaborators: "PM, Super, Elevator / Crane Sub",
        deliverable: "Logistics plan",
      },
    ],
  },
  {
    day: 28,
    phase: "Vertical Structure / Framing",
    timeframe: "Months 4-9",
    lessonIds: ["tech-steel", "tech-framing", "wf-change-events", "com-clauses"],
    tasks: [
      {
        task: "Erect vertical structure / wood framing floor-by-floor per sequence",
        category: "Field Ops",
        collaborators: "Super, Framing Sub",
        deliverable: "Structure topped out",
      },
      {
        task: "Coordinate MEP rough-in sequencing with framing (top-down per floor)",
        category: "Coordination",
        collaborators: "PM, Super, MEP Subs",
        deliverable: "Coordinated rough-in",
      },
      {
        task: "Manage shear wall / hold-down / structural special inspections per floor",
        category: "Quality",
        collaborators: "PM, Inspector, SEOR",
        deliverable: "Inspection sign-offs",
      },
      {
        task: "Process and approve interior finish submittals (doors / frames / hardware, drywall, flooring, cabinets, countertops, appliances, fixtures)",
        category: "Submittals",
        collaborators: "PM, Architect, Subs",
        deliverable: "Approved finish submittals",
      },
      {
        task: "Coordinate window and exterior door delivery and installation; begin WRB / air barrier",
        category: "Coordination",
        collaborators: "PM, Super, Envelope Sub",
        deliverable: "Building dried-in (in progress)",
      },
      {
        task: "Coordinate fire / life-safety rough-in (sprinkler, standpipe, alarm) with structure",
        category: "Coordination",
        collaborators: "PM, Fire Subs, AHJ",
        deliverable: "Coordinated FLS rough-in",
      },
      {
        task: "Approve elevator submittals; prep shafts and confirm equipment procurement / delivery",
        category: "Procurement",
        collaborators: "PM, Elevator Sub",
        deliverable: "Approved elevator package",
      },
      {
        task: "Perform per-floor quality inspections (framing, MEP rough, insulation) before cover",
        category: "Quality",
        collaborators: "PM, Super, Inspector",
        deliverable: "Inspection checklists",
      },
      {
        task: "Manage RFIs and change orders on field coordination clashes and design clarifications",
        category: "Change Mgmt",
        collaborators: "PM, Architect, Subs",
        deliverable: "Updated logs / executed COs",
      },
      {
        task: "Roof structure and dry-in; coordinate roofing material delivery",
        category: "Field Ops",
        collaborators: "Super, Roofing Sub",
        deliverable: "Roof dried-in",
      },
    ],
  },
  {
    day: 42,
    phase: "Envelope / MEP Rough-In / Dry-In",
    timeframe: "Months 7-13",
    lessonIds: ["tech-envelope", "mep-activity-pattern", "mep-coordination-scheduling", "mep-electrical-distribution"],
    tasks: [
      {
        task: "Complete building dry-in: roofing, windows, exterior doors, flashing, and sealants",
        category: "Field Ops",
        collaborators: "Super, Envelope Subs",
        deliverable: "Building dried-in",
      },
      {
        task: "Install exterior cladding / siding / stucco / brick veneer",
        category: "Field Ops",
        collaborators: "Super, Cladding Sub",
        deliverable: "Exterior enclosed",
      },
      {
        task: "Complete MEP rough-in and coordinate inspections (plumbing, electrical, mechanical, low-voltage, fire)",
        category: "Coordination",
        collaborators: "PM, Super, MEP Subs, AHJ",
        deliverable: "Approved rough inspections",
      },
      {
        task: "Install and inspect insulation; coordinate energy / blower-door requirements",
        category: "Quality",
        collaborators: "PM, Insulation Sub, Inspector",
        deliverable: "Insulation inspection passed",
      },
      {
        task: "Hang, tape, and finish drywall floor-by-floor",
        category: "Field Ops",
        collaborators: "Super, Drywall Sub",
        deliverable: "Drywall complete",
      },
      {
        task: "Finalize finish material / color / sample selections with owner and architect",
        category: "Submittals",
        collaborators: "PM, Owner, Architect",
        deliverable: "Approved selections",
      },
      {
        task: "Manage long-lead equipment delivery (switchgear, generator, elevators, RTUs); inspect on receipt",
        category: "Procurement",
        collaborators: "PM, Super, MEP Subs",
        deliverable: "Equipment on site",
      },
      {
        task: "Onboard commissioning agent; develop and issue the commissioning (Cx) plan",
        category: "Commissioning",
        collaborators: "PM, Cx Agent, Owner",
        deliverable: "Cx plan",
      },
      {
        task: "Track allowances and finish-related change orders against budget",
        category: "Cost",
        collaborators: "PM, Owner, Accounting",
        deliverable: "Updated cost report",
      },
    ],
  },
  {
    day: 56,
    phase: "Interior Finishes",
    timeframe: "Months 11-18",
    lessonIds: ["tech-finishes", "sc-pedestrian-ada", "mep-bms", "mep-security-fire-alarm"],
    tasks: [
      {
        task: "Prime and paint walls, ceilings, and trim",
        category: "Field Ops",
        collaborators: "Super, Paint Sub",
        deliverable: "Paint complete",
      },
      {
        task: "Install flooring (tile, LVP, carpet), trim / millwork, doors and hardware",
        category: "Field Ops",
        collaborators: "Super, Finish Subs",
        deliverable: "Finishes installed",
      },
      {
        task: "Install cabinets, countertops, and appliances",
        category: "Field Ops",
        collaborators: "Super, Casework Sub",
        deliverable: "Casework complete",
      },
      {
        task: "MEP trim-out: fixtures, devices, panels, registers, lighting, plumbing fixtures",
        category: "Field Ops",
        collaborators: "Super, MEP Subs",
        deliverable: "Trim-out complete",
      },
      {
        task: "Set and start up HVAC equipment, water heaters, and pumps",
        category: "Field Ops",
        collaborators: "Super, Mechanical Sub",
        deliverable: "Equipment started",
      },
      {
        task: "Complete elevator installation; schedule state inspection and certification",
        category: "Coordination",
        collaborators: "PM, Elevator Sub, State",
        deliverable: "Elevator certified",
      },
      {
        task: "Build out amenity spaces: lobby, leasing office, fitness, clubroom, common corridors",
        category: "Field Ops",
        collaborators: "Super, Subs",
        deliverable: "Amenities complete",
      },
      {
        task: "Complete final fire / life-safety installation and testing (alarm, sprinkler, standpipe)",
        category: "Quality",
        collaborators: "PM, Fire Subs, AHJ",
        deliverable: "FLS tested / accepted",
      },
      {
        task: "Track unit-by-unit completion with a finish / pre-punch tracker",
        category: "Quality",
        collaborators: "PM, Super",
        deliverable: "Unit completion tracker",
      },
      {
        task: "Begin commissioning of MEP systems; resolve Cx issues log",
        category: "Commissioning",
        collaborators: "PM, Cx Agent, MEP Subs",
        deliverable: "Cx issues log",
      },
      {
        task: "Manage retention; submit monthly pay apps and update schedule / cost forecast",
        category: "Cost",
        collaborators: "PM, Owner, Accounting",
        deliverable: "Pay app / forecast",
      },
    ],
  },
  {
    day: 70,
    phase: "Site Completion, Commissioning & Closeout",
    timeframe: "Months 16-20",
    lessonIds: ["wf-punch-closeout", "mep-startup-cx", "tech-testing-cx", "sc-landscape"],
    tasks: [
      {
        task: "Complete sitework: paving, curbs, sidewalks, hardscape, striping, and signage",
        category: "Field Ops",
        collaborators: "Super, Sitework Sub",
        deliverable: "Site complete",
      },
      {
        task: "Install landscaping, irrigation, and site amenities (pool, courtyard, dog park)",
        category: "Field Ops",
        collaborators: "Super, Landscape Sub",
        deliverable: "Landscaping complete",
      },
      {
        task: "Complete building commissioning and functional performance testing",
        category: "Commissioning",
        collaborators: "PM, Cx Agent, MEP Subs",
        deliverable: "Cx report",
      },
      {
        task: "Perform GC self-punch (pre-punch) by unit and common area",
        category: "Quality",
        collaborators: "PM, Super",
        deliverable: "Pre-punch closed",
      },
      {
        task: "Conduct architect / owner punch walks; generate and track punch lists",
        category: "Quality",
        collaborators: "PM, Owner, Architect",
        deliverable: "Punch list",
      },
      {
        task: "Manage punch completion and back-checks to closure",
        category: "Quality",
        collaborators: "PM, Super, Subs",
        deliverable: "Punch closed",
      },
      {
        task: "Coordinate final AHJ inspections; secure Certificate of Occupancy (CO / TCO)",
        category: "Permitting",
        collaborators: "PM, AHJ, Owner",
        deliverable: "CO / TCO issued",
      },
      {
        task: "Collect closeout documents: O&M manuals, as-builts, warranties, and attic stock",
        category: "Closeout",
        collaborators: "PM, Subs, Architect",
        deliverable: "Closeout package",
      },
      {
        task: "Conduct owner training on building systems",
        category: "Closeout",
        collaborators: "PM, MEP Subs, Owner",
        deliverable: "Training complete",
      },
      {
        task: "Issue substantial and final completion certificates",
        category: "Closeout",
        collaborators: "PM, Owner, Architect",
        deliverable: "Completion certificates",
      },
      {
        task: "Process final pay applications, retention release, and final lien waivers",
        category: "Cost",
        collaborators: "PM, Owner, Accounting",
        deliverable: "Final payment / waivers",
      },
      {
        task: "Reconcile contingency, finalize cost report, and close project financials",
        category: "Cost",
        collaborators: "PM, Accounting, Owner",
        deliverable: "Final cost report",
      },
      {
        task: "Set up warranty program and schedule the 11-month warranty walk",
        category: "Closeout",
        collaborators: "PM, Owner, Subs",
        deliverable: "Warranty program",
      },
      {
        task: "Archive project records and conduct lessons-learned / post-mortem review",
        category: "Closeout",
        collaborators: "PM, Team",
        deliverable: "Lessons-learned doc",
      },
    ],
  },
];

/**
 * Schedules by role. Only Project Manager is wired up today (the only seeded
 * sandbox role); the tasks are generic PM responsibilities that apply across
 * project types, so every PM sandbox uses this schedule.
 */
export const TRAINING_SCHEDULES: Partial<Record<SimRole, TrainingDay[]>> = {
  project_manager: PROJECT_MANAGER_SCHEDULE,
};

export function getTrainingSchedule(role: SimRole): TrainingDay[] {
  return TRAINING_SCHEDULES[role] ?? [];
}

// ---------------------------------------------------------------------------
// Recurring cadence — standing tasks that layer on top of the phased schedule
// throughout construction (not tied to a specific day).
// ---------------------------------------------------------------------------

export type RecurringTask = {
  task: string;
  category: string;
  collaborators: string;
};

export type RecurringFrequency = "Daily" | "Weekly" | "Bi-weekly" | "Monthly";

export type RecurringCadenceGroup = {
  frequency: RecurringFrequency;
  tasks: RecurringTask[];
};

const PROJECT_MANAGER_RECURRING_CADENCE: RecurringCadenceGroup[] = [
  {
    frequency: "Daily",
    tasks: [
      {
        task: "Review superintendent daily logs (manpower, weather, deliveries, delays, incidents)",
        category: "Field Ops",
        collaborators: "PM",
      },
      {
        task: "Walk the site for safety and quality spot-checks",
        category: "Safety",
        collaborators: "PM / Super",
      },
      {
        task: "Respond to time-sensitive RFIs and field questions",
        category: "RFI",
        collaborators: "PM",
      },
      {
        task: "Track deliveries and material status against the procurement log",
        category: "Procurement",
        collaborators: "PM",
      },
    ],
  },
  {
    frequency: "Weekly",
    tasks: [
      {
        task: "Subcontractor coordination meeting with 3-week look-ahead",
        category: "Meetings",
        collaborators: "PM / Super",
      },
      {
        task: "Update and distribute the RFI log",
        category: "RFI",
        collaborators: "PM",
      },
      {
        task: "Update and distribute the submittal log",
        category: "Submittals",
        collaborators: "PM",
      },
      {
        task: "Update the 3-week look-ahead schedule with the superintendent",
        category: "Schedule",
        collaborators: "PM / Super",
      },
      {
        task: "Conduct safety walk and review toolbox talks",
        category: "Safety",
        collaborators: "PM / Safety",
      },
      {
        task: "Review change event log and status of pending PCOs",
        category: "Change Mgmt",
        collaborators: "PM",
      },
      {
        task: "Maintain open-items / action-item log to closure",
        category: "Coordination",
        collaborators: "PM",
      },
    ],
  },
  {
    frequency: "Bi-weekly",
    tasks: [
      {
        task: "Owner-Architect-Contractor (OAC) meeting",
        category: "Meetings",
        collaborators: "PM / Owner",
      },
      {
        task: "Long-lead procurement and delivery status review",
        category: "Procurement",
        collaborators: "PM",
      },
      {
        task: "Quality inspection summary and nonconformance review",
        category: "Quality",
        collaborators: "PM",
      },
    ],
  },
  {
    frequency: "Monthly",
    tasks: [
      {
        task: "Prepare, submit, and walk owner through the pay application",
        category: "Cost",
        collaborators: "PM",
      },
      {
        task: "Review / approve subcontractor pay apps; collect conditional & unconditional lien waivers",
        category: "Cost",
        collaborators: "PM",
      },
      {
        task: "Update master CPM schedule and issue schedule narrative",
        category: "Schedule",
        collaborators: "PM",
      },
      {
        task: "Issue cost report: budget vs. actual and cost-to-complete forecast",
        category: "Cost",
        collaborators: "PM",
      },
      {
        task: "Reconcile change order log; update executed vs. pending COs",
        category: "Change Mgmt",
        collaborators: "PM",
      },
      {
        task: "Issue owner project status report",
        category: "Reporting",
        collaborators: "PM",
      },
      {
        task: "Conduct safety audit and review metrics (TRIR, near-misses)",
        category: "Safety",
        collaborators: "PM / Safety",
      },
      {
        task: "Review COI / bond expirations and compliance status",
        category: "Compliance",
        collaborators: "PM",
      },
    ],
  },
];

const RECURRING_CADENCES: Partial<Record<SimRole, RecurringCadenceGroup[]>> = {
  project_manager: PROJECT_MANAGER_RECURRING_CADENCE,
};

export function getRecurringCadence(role: SimRole): RecurringCadenceGroup[] {
  return RECURRING_CADENCES[role] ?? [];
}

/**
 * Maps a stored `training_day` value to the index of the active *phase* entry in
 * a schedule: the entry whose `.day` is the largest value ≤ trainingDay. A value
 * of 0 (freshly launched) or below the first scheduled day resolves to the first
 * entry. Returns -1 for an empty schedule.
 *
 * Note this "sticks" to the most recent scheduled entry, so it answers "what
 * phase/period am I in?" — not "is there a task batch on exactly this day?". For
 * the latter, use {@link getScheduledDay}.
 */
export function resolveDayIndex(schedule: TrainingDay[], trainingDay: number): number {
  if (schedule.length === 0) return -1;
  const target = trainingDay > 0 ? trainingDay : schedule[0].day;
  let idx = 0;
  for (let i = 0; i < schedule.length; i++) {
    if (schedule[i].day <= target) idx = i;
  }
  return idx;
}

/**
 * The scheduled entry whose task batch lands on exactly `day`, or null when no
 * tasks are scheduled for that day. The trainee advances one day at a time, so
 * most days fall between batches (return null) — those render as a quiet "no new
 * tasks today" day rather than re-showing the previous batch.
 */
export function getScheduledDay(schedule: TrainingDay[], day: number): TrainingDay | null {
  return schedule.find((d) => d.day === day) ?? null;
}

/** First scheduled day in a schedule (1 for the PM schedule), or 0 if empty. */
export function firstScheduledDay(schedule: TrainingDay[]): number {
  return schedule.length ? schedule[0].day : 0;
}

/**
 * Last scheduled day — the day the job wraps (closeout). The trainee can advance
 * up to, but not past, this day.
 */
export function lastScheduledDay(schedule: TrainingDay[]): number {
  return schedule.length ? schedule[schedule.length - 1].day : 0;
}

/**
 * Clamps an arbitrary stored `training_day` to a real day on the calendar: never
 * before the first scheduled day, never past the last. 0 (fresh launch) becomes
 * the first day.
 */
export function clampTrainingDay(schedule: TrainingDay[], day: number): number {
  if (schedule.length === 0) return 0;
  const first = firstScheduledDay(schedule);
  const last = lastScheduledDay(schedule);
  if (!day || day < first) return first;
  return Math.min(day, last);
}

/** The phase name in effect on a given day (sticks to the most recent entry). */
export function phaseForDay(schedule: TrainingDay[], day: number): string {
  const idx = resolveDayIndex(schedule, day);
  return idx >= 0 ? schedule[idx].phase : "";
}
