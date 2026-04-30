export type PermissionLevel = "none" | "read_only" | "standard" | "admin";

export const PERMISSION_LEVELS: PermissionLevel[] = ["none", "read_only", "standard", "admin"];

export const PERMISSION_LEVEL_LABEL: Record<PermissionLevel, string> = {
  none: "None",
  read_only: "Read Only",
  standard: "Standard",
  admin: "Admin",
};

export type TemplateCategory = "company" | "invitee";

export type CompanyUserType = "super_admin" | "admin" | "member";
export type InviteeUserType = "subcontractor" | "architect_engineer" | "owner_client";
export type TemplateUserType = CompanyUserType | InviteeUserType;

export const COMPANY_USER_TYPES: { value: CompanyUserType; label: string }[] = [
  { value: "super_admin", label: "Super Admin" },
  { value: "admin", label: "Admin" },
  { value: "member", label: "User" },
];

export const INVITEE_USER_TYPES: { value: InviteeUserType; label: string }[] = [
  { value: "subcontractor", label: "Subcontractor" },
  { value: "architect_engineer", label: "Architect / Engineer" },
  { value: "owner_client", label: "Owner / Client" },
];

export function isTemplateCategory(v: unknown): v is TemplateCategory {
  return v === "company" || v === "invitee";
}

export function isTemplateUserType(category: TemplateCategory, v: unknown): v is TemplateUserType {
  if (category === "company") return v === "super_admin" || v === "admin" || v === "member";
  return v === "subcontractor" || v === "architect_engineer" || v === "owner_client";
}

export function isPermissionLevel(v: unknown): v is PermissionLevel {
  return v === "none" || v === "read_only" || v === "standard" || v === "admin";
}

/** Canonical, ordered list of tools that appear in the permission template matrix. */
export const TEMPLATE_TOOLS: string[] = [
  "Home",
  "Emails",
  "Prime Contracts",
  "Budget",
  "Commitments",
  "Change Orders",
  "Change Events",
  "RFIs",
  "Submittals",
  "Transmittals",
  "Punch List",
  "Meetings",
  "Schedule",
  "Daily Log",
  "360 Reporting",
  "Photos",
  "Drawings",
  "Specifications",
  "Documents",
  "Directory",
  "Cover Letters",
  "Tasks",
  "Admin",
  "Connection Manager",
  "Scheduling",
  "Webhooks API",
  "Agent Builder",
];

/** Built-in defaults for company user types when no override is stored yet. */
const COMPANY_DEFAULTS: Record<CompanyUserType, PermissionLevel> = {
  super_admin: "admin",
  admin: "admin",
  member: "standard",
};

/** Returns the built-in default level for a (category, type, tool). */
export function defaultLevelFor(
  category: TemplateCategory,
  userType: TemplateUserType,
  tool: string
): PermissionLevel {
  if (category === "company") {
    return COMPANY_DEFAULTS[userType as CompanyUserType] ?? "none";
  }
  const key =
    userType === "subcontractor"
      ? "Subcontractor"
      : userType === "architect_engineer"
        ? "Architect/Engineer"
        : "Owner/Client";
  const rows = PERMISSION_TEMPLATES[key as PermissionTemplateName] ?? [];
  return rows.find((r) => r.tool === tool)?.level ?? "none";
}

export type PermissionTemplateName =
  | "Subcontractor"
  | "Architect/Engineer"
  | "Owner/Client";

export type TemplateRow = {
  tool: string;
  level: PermissionLevel;
  granularPermissions?: string[];
};

export const PERMISSION_TEMPLATE_ORDER: PermissionTemplateName[] = [
  "Subcontractor",
  "Architect/Engineer",
  "Owner/Client",
];

export const PERMISSION_TEMPLATES: Record<PermissionTemplateName, TemplateRow[]> = {
  "Subcontractor": [
    { tool: "Home", level: "read_only" },
    { tool: "Emails", level: "standard" },
    { tool: "Prime Contracts", level: "none" },
    { tool: "Budget", level: "none" },
    {
      tool: "Commitments",
      level: "standard",
      granularPermissions: ["View and Select Budget Codes for Change Orders Outside the Contract's Scope"],
    },
    { tool: "Change Orders", level: "read_only" },
    { tool: "Change Events", level: "none" },
    { tool: "RFIs", level: "read_only" },
    { tool: "Submittals", level: "read_only" },
    { tool: "Transmittals", level: "none" },
    { tool: "Punch List", level: "standard" },
    { tool: "Meetings", level: "read_only" },
    { tool: "Schedule", level: "read_only" },
    { tool: "Daily Log", level: "none" },
    { tool: "360 Reporting", level: "none" },
    { tool: "Photos", level: "read_only" },
    { tool: "Drawings", level: "read_only" },
    { tool: "Specifications", level: "read_only" },
    { tool: "Documents", level: "standard" },
    { tool: "Directory", level: "none" },
    { tool: "Cover Letters", level: "none" },
    { tool: "Tasks", level: "none" },
    { tool: "Admin", level: "none" },
    { tool: "Connection Manager", level: "none" },
    { tool: "Scheduling", level: "none" },
    { tool: "Webhooks API", level: "none" },
    { tool: "Agent Builder", level: "none" },
  ],
  "Architect/Engineer": [
    { tool: "Home", level: "read_only" },
    { tool: "Emails", level: "standard" },
    {
      tool: "Prime Contracts",
      level: "read_only",
      granularPermissions: ["View payment application detail"],
    },
    { tool: "Budget", level: "none" },
    { tool: "Commitments", level: "none" },
    { tool: "Change Orders", level: "standard" },
    { tool: "Change Events", level: "none" },
    { tool: "RFIs", level: "standard" },
    {
      tool: "Submittals",
      level: "standard",
      granularPermissions: ["Create Submittal"],
    },
    { tool: "Transmittals", level: "standard" },
    { tool: "Punch List", level: "standard" },
    { tool: "Meetings", level: "admin" },
    { tool: "Schedule", level: "read_only" },
    { tool: "Daily Log", level: "none" },
    { tool: "360 Reporting", level: "none" },
    { tool: "Photos", level: "standard" },
    {
      tool: "Drawings",
      level: "standard",
      granularPermissions: ["Upload Drawings", "Upload and review Drawings"],
    },
    { tool: "Specifications", level: "read_only" },
    { tool: "Documents", level: "standard" },
    { tool: "Directory", level: "none" },
    { tool: "Cover Letters", level: "none" },
    { tool: "Tasks", level: "none" },
    { tool: "Admin", level: "none" },
    { tool: "Connection Manager", level: "none" },
    { tool: "Scheduling", level: "none" },
    { tool: "Webhooks API", level: "none" },
    { tool: "Agent Builder", level: "none" },
  ],
  "Owner/Client": [
    { tool: "Home", level: "read_only" },
    { tool: "Emails", level: "standard" },
    {
      tool: "Prime Contracts",
      level: "none",
      granularPermissions: ["View payment application detail"],
    },
    { tool: "Budget", level: "none" },
    { tool: "Commitments", level: "none" },
    { tool: "Change Orders", level: "standard" },
    { tool: "Change Events", level: "none" },
    { tool: "RFIs", level: "standard" },
    {
      tool: "Submittals",
      level: "standard",
      granularPermissions: ["Create Submittal"],
    },
    { tool: "Transmittals", level: "read_only" },
    { tool: "Punch List", level: "standard" },
    { tool: "Meetings", level: "read_only" },
    { tool: "Schedule", level: "read_only" },
    { tool: "Daily Log", level: "read_only" },
    { tool: "360 Reporting", level: "read_only" },
    { tool: "Photos", level: "standard" },
    { tool: "Drawings", level: "read_only" },
    { tool: "Specifications", level: "read_only" },
    { tool: "Documents", level: "standard" },
    { tool: "Directory", level: "none" },
    { tool: "Cover Letters", level: "none" },
    { tool: "Tasks", level: "none" },
    { tool: "Admin", level: "none" },
    { tool: "Connection Manager", level: "none" },
    { tool: "Scheduling", level: "none" },
    { tool: "Webhooks API", level: "none" },
    { tool: "Agent Builder", level: "none" },
  ],
};
