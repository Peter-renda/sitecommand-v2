// Client-side dashboard preferences (persisted to localStorage).
//
// The walkthrough on the portfolio dashboard reads + writes these values
// live as the user edits controls in the tooltip. Components that render
// dashboard sections honor them when displaying data.

export type OpenItemType =
  | "task"
  | "rfi"
  | "submittal"
  | "change_event"
  | "change_order"
  | "budget"
  | "commitment"
  | "prime_contract"
  | "transaction_order_assignment"
  | "training_guide_assignment";

export type DashboardPreferences = {
  attentionTypes: Record<OpenItemType, boolean>;
  showWhileAway: boolean;
  showPortfolioTotal: boolean;
};

export const OPEN_ITEM_TYPE_LABELS: Record<OpenItemType, string> = {
  task: "Tasks",
  rfi: "RFIs",
  submittal: "Submittals",
  change_event: "Change Events",
  change_order: "Change Orders",
  budget: "Budget items",
  commitment: "Commitments",
  prime_contract: "Prime Contracts",
  transaction_order_assignment: "Assigned Invoices",
  training_guide_assignment: "Assigned Guides",
};

export const OPEN_ITEM_TYPES: OpenItemType[] = [
  "task",
  "rfi",
  "submittal",
  "change_event",
  "change_order",
  "budget",
  "commitment",
  "prime_contract",
  "transaction_order_assignment",
  "training_guide_assignment",
];

export const DEFAULT_DASHBOARD_PREFS: DashboardPreferences = {
  attentionTypes: {
    task: true,
    rfi: true,
    submittal: true,
    change_event: true,
    change_order: true,
    budget: true,
    commitment: true,
    prime_contract: true,
    transaction_order_assignment: true,
    training_guide_assignment: true,
  },
  showWhileAway: true,
  showPortfolioTotal: true,
};

const STORAGE_KEY = "dashboard_preferences_v1";

export function loadDashboardPreferences(): DashboardPreferences {
  if (typeof window === "undefined") return DEFAULT_DASHBOARD_PREFS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_DASHBOARD_PREFS;
    const parsed = JSON.parse(raw) as Partial<DashboardPreferences>;
    return {
      attentionTypes: { ...DEFAULT_DASHBOARD_PREFS.attentionTypes, ...(parsed.attentionTypes ?? {}) },
      showWhileAway: parsed.showWhileAway ?? DEFAULT_DASHBOARD_PREFS.showWhileAway,
      showPortfolioTotal: parsed.showPortfolioTotal ?? DEFAULT_DASHBOARD_PREFS.showPortfolioTotal,
    };
  } catch {
    return DEFAULT_DASHBOARD_PREFS;
  }
}

export function saveDashboardPreferences(prefs: DashboardPreferences): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    window.dispatchEvent(new CustomEvent("dashboard-prefs-changed", { detail: prefs }));
  } catch {
    /* ignore */
  }
}
