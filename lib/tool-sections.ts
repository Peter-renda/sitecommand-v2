export const TOOL_SECTIONS = [
  {
    label: "Core Tools",
    items: [
      { name: "Home", slug: "home" },
      { name: "Reporting", slug: "reporting" },
      { name: "Documents", slug: "documents" },
      { name: "Directory", slug: "directory" },
      { name: "Tasks", slug: "tasks" },
      { name: "Emails", slug: "emails" },
      { name: "Quick Notes", slug: "quick-notes" },
      { name: "Assist", slug: "assist" },
      { name: "Admin", slug: "admin" },
    ],
  },
  {
    label: "Project Tools",
    items: [
      { name: "Insights", slug: "insights" },
      { name: "RFIs", slug: "rfis" },
      { name: "Submittals", slug: "submittals" },
      { name: "Transmittals", slug: "transmittals" },
      { name: "Punch List", slug: "punch-list" },
      { name: "Meetings", slug: "meetings" },
      { name: "Schedule", slug: "schedule" },
      { name: "Daily Log", slug: "daily-log" },
      { name: "Photos", slug: "photos" },
      { name: "Drawings", slug: "drawings" },
      { name: "BIM Viewer", slug: "bim" },
      { name: "Specifications", slug: "specifications" },
      { name: "Permit Applications", slug: "permit-applications" },
    ],
  },
  {
    label: "Workforce Management",
    items: [
      { name: "T&M Tickets", slug: "tm-tickets" },
      { name: "Timesheets", slug: "timesheets" },
    ],
  },
  {
    label: "Preconstruction",
    items: [
      { name: "Preconstruction", slug: "preconstruction" },
      { name: "Bid Management", slug: "bid-management" },
      { name: "Estimating", slug: "estimating" },
      { name: "Prequalification", slug: "prequalification" },
    ],
  },
  {
    label: "Financial Management",
    items: [
      { name: "Prime Contracts", slug: "prime-contracts" },
      { name: "Budget", slug: "budget" },
      { name: "Commitments", slug: "commitments" },
      { name: "Scope of Work", slug: "scope-of-work" },
      { name: "Change Orders", slug: "change-orders" },
      { name: "Change Events", slug: "change-events" },
    ],
  },
  {
    label: "Accounting",
    items: [
      { name: "Transaction Orders", slug: "transaction-orders" },
    ],
  },
];

export type ToolSection = (typeof TOOL_SECTIONS)[number];
export type ToolItem = ToolSection["items"][number];

/** All slugs across every section */
export const ALL_TOOL_SLUGS = TOOL_SECTIONS.flatMap((s) => s.items.map((i) => i.slug));
