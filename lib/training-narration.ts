/**
 * Coach narration scripts for "SiteCommand Training" sandboxes.
 *
 * The training Coach (app/projects/[id]/components/TrainingCoach.tsx) surfaces a
 * "message from your coach" the moment a sandbox opens and again at the start of
 * each in-sim day. This module is the single source of truth for what the coach
 * says: a full welcome monologue on day one, then a short phase-aware briefing
 * for every subsequent scheduled day.
 *
 * It is client-safe (no server-only imports) so both the Coach component (to show
 * the transcript) and the narration API route (to synthesize the audio with
 * ElevenLabs) build the exact same text from here.
 */

import type { SimRole } from "@/lib/simulation-constants";
import { getTrainingSchedule, resolveDayIndex } from "@/lib/training-schedule";

export type TrainingNarration = {
  /** Short heading shown on the coach popup / modal (e.g. "Week 2 — Buyout"). */
  title: string;
  /** The spoken script. Shown as the transcript and fed verbatim to TTS. */
  text: string;
};

/** First word of a full name, falling back to a friendly default. */
function firstNameOf(userName: string | null | undefined): string {
  const n = (userName ?? "").trim().split(/\s+/)[0];
  return n || "there";
}

/**
 * A display-friendly project name for narration. Generic sandbox names are
 * "Training: <Type>"; strip the prefix so the coach says "the Multifamily
 * Residential project", not "the Training: Multifamily Residential project".
 */
function cleanProjectName(projectName: string | null | undefined): string {
  const n = (projectName ?? "").trim();
  if (!n) return "this";
  return n.replace(/^training:\s*/i, "").trim() || "this";
}

/**
 * The day-one welcome — the coach orients the trainee to the simulation, the
 * "no safety net" reality, and the project network they'll hear from. Faithful
 * to the program script, with the trainee's name and project filled in.
 */
function welcomeScript(firstName: string, project: string): string {
  return [
    `Hi ${firstName}, thank you for taking the lead on the ${project} initiative.`,
    `Throughout this simulation, you'll be stepping directly into the shoes of the Project Manager. This program was engineered specifically for rising PMs to experience the high-stakes, fast-paced reality of managing a commercial project from groundbreaking to closeout.`,
    `Along the way, you'll be equipped with core project management lessons, technical insights, and standard operating procedures. Immediately following these lessons, you'll be prompted with real-world tasks, field conflicts, and documentation requests. Pay close attention to every piece of new information you receive — it will be directly pertinent to the critical decisions you have to make next.`,
    `Now, the reality of the field. To make this experience as realistic as possible, there is no safety net. In the field, mistakes don't always trigger an immediate warning. If you miss a critical submittal, overlook a long-lead item, or mismanage a coordination clash, the simulation will not stop you. Instead, those oversights will quietly compound, reflecting realistically in your project schedule and your bottom-line budget.`,
    `However, you won't be left completely in the dark. At major milestones, we'll hold formal Project Reviews. During these reviews, any missed items or budget variances will be laid out on the table so you can pivot, make adjustments, and find a way to get this project across the finish line.`,
    `A word on your project network. Construction is a team sport, and throughout this project you'll be receiving constant, realistic feedback from your team. Your Project Executive will keep a close eye on your financial health, owner relations, and contract compliance. Your Senior Superintendent will feed you real-time updates on site conditions, labor productivity, and subcontractor dynamics from the dirt. And your subcontractors and design team will push back on RFIs, change orders, and material delays.`,
    `Listen to your team, analyze your project data, and trust your training. Logistics, safety, and profitability are in your hands now. Let's get to work.`,
  ].join("\n\n");
}

/**
 * Hand-authored coach briefings for each scheduled Project Manager day after
 * day one. Keyed by the in-sim day number from lib/training-schedule.ts. Days
 * without an entry fall back to a schedule-derived briefing (see below).
 */
function authoredDayBriefing(day: number, firstName: string): string | null {
  switch (day) {
    case 2:
      return `Good to have you back, ${firstName}. You're still in buyout, and this is where margin is won or lost. Level your bids trade by trade and scope-check every number before you trust it — the low bid is rarely apples to apples. Most importantly, get your long-lead items identified now: switchgear, elevators, windows, rooftop units, generators. If you don't lock procurement on those this week, they'll set your finish date, not you. Issue your letters of intent to the long-lead trades so pricing holds and submittals can start.`;
    case 3:
      return `This week you start putting subcontracts on paper — foundations, structure, and underground utilities first, because they hit the field first. While you're awarding, build your submittal register straight off the spec sections and sit down with the architect and engineers to agree on turnaround times. Stand up your prime Schedule of Values and request sub SOVs. And don't let compliance slide: collect COIs, bonds, and W-9s before anyone mobilizes.`;
    case 4:
      return `Keep the awards moving, ${firstName} — sitework, concrete, plumbing, electrical, mechanical. Your first submittals are coming in for the early trades, so route rebar, mix designs, and anchor bolts fast; the foundation crew is waiting on them. Stay on top of the AHJ for your building, grading, and utility permits. A permit that isn't in hand is a start date you don't control.`;
    case 5:
      return `Boots on the ground this week. Mobilize the site — field office, fencing, erosion control, staging and laydown. Run your preconstruction kickoff with the owner, architect, engineers, and key subs so everyone's reading from the same set. And confirm utility coordination — power, water, sewer, gas, telecom — because a missed utility tie-in stalls everything downstream.`;
    case 6:
      return `Time to baseline the schedule. Sit with your superintendent, build the CPM, and distribute it to the subs — that schedule is your contract with the field. Get your first pay application in so cash flow starts on the right foot, push your envelope submittals since those are long-lead, and run your first owner-architect-contractor meeting. Lock in your QA/QC plan and mockup requirements now, before the work outruns them.`;
    case 7:
      return `Last week of preconstruction, ${firstName}. The goal is simple: be ninety to a hundred percent bought out before the structure goes vertical. Any scope you haven't awarded is exposure you carry. Set your standing cadence too — a weekly sub coordination meeting and a rolling three-week look-ahead. Get those rhythms in place and the build phase runs itself.`;
    case 14:
      return `You're out of the office and into the ground. This phase is foundations and site utilities — storm, sanitary, water, dry utilities, then footings, walls, and waterproofing. The decision that bites people here is the under-slab inspection: get MEP rough-in coordinated and signed off before anything gets buried, because you only pour over it once. Stay on your concrete testing and special inspections, and keep expediting those long-lead approvals.`;
    case 28:
      return `Now you go vertical. Structure and framing rise floor by floor, and the name of the game is sequencing — MEP rough-in has to chase the framing cleanly, top down per floor. Keep your shear-wall and structural inspections current so you're never covering work that hasn't been signed off. Push your interior finish submittals through now; they're long-lead, and a late selection here shows up as a stall months from now. Watch your coordination clashes and turn RFIs around fast.`;
    case 42:
      return `Envelope and rough-in. Getting the building dried in — roofing, windows, doors, flashing, sealants — protects everything you install after it, so treat dry-in as a milestone, not an afterthought. Complete and inspect MEP rough-in, then insulation, then drywall, in that order. This is also when you onboard your commissioning agent and issue the Cx plan. And keep one eye on allowances and finish change orders against the budget — that's where the bottom line drifts.`;
    case 56:
      return `Interior finishes — this is where the owner finally sees their building. Paint, flooring, trim, casework, then MEP trim-out and equipment start-up. Get the elevator finished and through its state inspection; it's almost always on the critical path to occupancy. Drive a unit-by-unit completion tracker so nothing hides, finish fire and life-safety testing with the AHJ, and keep commissioning moving. Manage retention tightly and keep your pay apps and forecast honest.`;
    case 70:
      return `Home stretch, ${firstName} — site completion, commissioning, and closeout. Wrap the sitework and landscaping, finish functional performance testing, and run your own self-punch before the owner and architect ever walk it. Coordinate final inspections and secure your Certificate of Occupancy — that's the finish line. Then close it out the right way: O&M manuals, as-builts, warranties, owner training, final pay applications, retention release, and a clean cost reconciliation. Finish strong.`;
    default:
      return null;
  }
}

/** Schedule-derived fallback for any PM day without an authored briefing. */
function fallbackDayBriefing(day: number, firstName: string): string {
  const schedule = getTrainingSchedule("project_manager");
  const idx = resolveDayIndex(schedule, day);
  if (idx < 0) {
    return `Welcome back, ${firstName}. Review where the project stands, work your open items, and keep the schedule and budget moving.`;
  }
  const entry = schedule[idx];
  const headlines = entry.tasks.slice(0, 2).map((t) => t.task.replace(/\.$/, ""));
  const focus = headlines.length
    ? ` Top of the list: ${headlines.join("; and ")}.`
    : "";
  return `Welcome to ${entry.timeframe}, ${firstName}. You're into ${entry.phase}.${focus} Keep your logs current, stay ahead of the long-lead items, and don't let a missed submittal or inspection compound on you.`;
}

/**
 * Builds the coach narration for a given role + in-sim day. Returns null for
 * roles without a narrated schedule (only Project Manager is wired up today,
 * matching the seeded schedule). The `day` may be a raw `training_day` value; it
 * is resolved to the active scheduled day before the script is chosen.
 */
export function buildTrainingNarration(
  role: SimRole,
  day: number,
  opts: { userName?: string | null; projectName?: string | null },
): TrainingNarration | null {
  if (role !== "project_manager") return null;

  const schedule = getTrainingSchedule(role);
  if (schedule.length === 0) return null;

  const idx = resolveDayIndex(schedule, day);
  const entry = idx >= 0 ? schedule[idx] : schedule[0];
  const scheduledDay = entry.day;

  const firstName = firstNameOf(opts.userName);
  const project = cleanProjectName(opts.projectName);

  // Day one is the full welcome; it doubles as the project's opening orientation.
  const isFirstDay = scheduledDay === schedule[0].day;
  const text = isFirstDay
    ? welcomeScript(firstName, project)
    : authoredDayBriefing(scheduledDay, firstName) ??
      fallbackDayBriefing(scheduledDay, firstName);

  const title = isFirstDay
    ? "Welcome to the project"
    : `${entry.timeframe} — ${entry.phase}`;

  return { title, text };
}
