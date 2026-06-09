/**
 * Client-safe constants and types for the Training → Practice simulation game.
 *
 * Kept separate from lib/simulation.ts (which pulls in Node-only modules like
 * `crypto` and the Gemini SDK) so React client components can import the role /
 * project-type / action-type menus without dragging server code into the bundle.
 */

export type SimRole = "superintendent" | "project_manager" | "accounting";
export type ScoringFrequency = "weekly" | "monthly" | "project_end";

export const ROLES: { value: SimRole; label: string; blurb: string }[] = [
  {
    value: "superintendent",
    label: "Superintendent",
    blurb: "Run the field — daily logs, manpower, safety, quality, and the schedule on the ground.",
  },
  {
    value: "project_manager",
    label: "Project Manager",
    blurb: "Run the office — RFIs, submittals, PCOs/change orders, owner & sub communication.",
  },
  {
    value: "accounting",
    label: "Project Accounting",
    blurb: "Run the money — pay applications, invoices, budgets, lien waivers, cost coding.",
  },
];

export const PROJECT_TYPES: { value: string; label: string }[] = [
  { value: "multifamily", label: "Multifamily Residential" },
  { value: "education", label: "Education / K-12" },
  { value: "higher_ed", label: "Higher Education" },
  { value: "data_center", label: "Data Center" },
  { value: "healthcare", label: "Healthcare / Hospital" },
  { value: "commercial_office", label: "Commercial Office" },
  { value: "retail", label: "Retail / Mixed-Use" },
  { value: "industrial", label: "Industrial / Warehouse" },
  { value: "hospitality", label: "Hospitality / Hotel" },
  { value: "civil", label: "Civil / Infrastructure" },
];

// Action types each role is expected to produce.
export const ROLE_ACTION_TYPES: Record<SimRole, { value: string; label: string }[]> = {
  superintendent: [
    { value: "daily_log", label: "Daily Log" },
    { value: "safety_report", label: "Safety Report / Toolbox Talk" },
    { value: "schedule_update", label: "Schedule Update" },
    { value: "manpower_log", label: "Manpower Log" },
    { value: "inspection_request", label: "Inspection Request" },
    { value: "quality_checklist", label: "Quality / Punch Checklist" },
    { value: "rfi", label: "RFI" },
    { value: "photo_doc", label: "Photo Documentation Note" },
    { value: "email", label: "Email / Coordination" },
  ],
  project_manager: [
    { value: "pco", label: "Potential Change Order (PCO)" },
    { value: "change_order", label: "Change Order" },
    { value: "rfi", label: "RFI" },
    { value: "submittal_review", label: "Submittal Review" },
    { value: "email", label: "Email / Correspondence" },
    { value: "meeting_minutes", label: "Meeting Minutes" },
    { value: "schedule_update", label: "Schedule Update" },
    { value: "owner_update", label: "Owner Update" },
    { value: "subcontract", label: "Subcontract / Buyout" },
  ],
  accounting: [
    { value: "pay_application", label: "Pay Application" },
    { value: "invoice", label: "Invoice Review" },
    { value: "budget_update", label: "Budget Update" },
    { value: "lien_waiver", label: "Lien Waiver" },
    { value: "cost_code_review", label: "Cost Code Review" },
    { value: "billing", label: "Owner Billing" },
    { value: "email", label: "Email / Correspondence" },
  ],
};

export const EVENT_SEVERITIES = ["info", "minor", "major", "critical"] as const;
export type EventSeverity = (typeof EVENT_SEVERITIES)[number];

export function roleLabel(role: string): string {
  return ROLES.find((r) => r.value === role)?.label ?? role;
}

export function projectTypeLabel(type: string): string {
  return PROJECT_TYPES.find((p) => p.value === type)?.label ?? type;
}

/** Human label for an action_type slug across every role's menu. */
export function actionTypeLabel(type: string): string {
  for (const list of Object.values(ROLE_ACTION_TYPES)) {
    const found = list.find((a) => a.value === type);
    if (found) return found.label;
  }
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
