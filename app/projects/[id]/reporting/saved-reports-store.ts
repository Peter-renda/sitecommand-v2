// Lightweight localStorage-backed store for saved reports created from the
// 360 builder. Both the Reports list and the new-report page read/write here
// so a saved report immediately shows up under "My Reports".

export type StoredReport = {
  id: string;
  name: string;
  reportType: string;
  templateValue?: string;
  description: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  sharedWith: string[];
  category?: string;
  selectedColumns?: {
    id: string;
    categoryLabel: string;
    source: string;
    fieldKey: string;
    fieldLabel: string;
    format?: "currency" | "date" | "text" | "number";
  }[];
  singleToolTabs?: {
    id: string;
    name: string;
    dataSetId: string | null;
    selectedColumns: string[];
    filters?: Record<string, unknown>[];
  }[];
  visualConfig?: Record<string, unknown>;
  calculatedColumns?: Record<string, unknown>[];
  filters?: Record<string, unknown>[];
  lastRunRecordCount?: number;
};

function storageKey(projectId: string) {
  return `sitecommand:360-reports:${projectId}`;
}

export function loadSavedReports(projectId: string): StoredReport[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey(projectId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as StoredReport[]) : [];
  } catch {
    return [];
  }
}

export function saveReport(projectId: string, report: StoredReport) {
  if (typeof window === "undefined") return;
  const existing = loadSavedReports(projectId);
  const next = [report, ...existing.filter((r) => r.id !== report.id)];
  window.localStorage.setItem(storageKey(projectId), JSON.stringify(next));
}

export function deleteSavedReport(projectId: string, id: string) {
  if (typeof window === "undefined") return;
  const next = loadSavedReports(projectId).filter((r) => r.id !== id);
  window.localStorage.setItem(storageKey(projectId), JSON.stringify(next));
}
