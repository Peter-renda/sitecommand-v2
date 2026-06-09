import { XMLParser } from "fast-xml-parser";

// A schedule task normalized from any supported export format.
export type ScheduleTask = {
  uid: number;
  id: number;
  name: string;
  outlineLevel: number;
  isSummary: boolean;
  isMilestone: boolean;
  start: string;
  finish: string;
  percentComplete: number;
  predecessorUids: number[];
};

const TEXT_NODE = "#text";

// ── Generic XML traversal (tool-agnostic, case-insensitive) ─────────────────────
// Strips namespace prefixes ("ms:Task" → "task") and attribute prefixes
// ("@_Name" → "name") so the same lookups work for MS Project (elements),
// Primavera P6 (elements), and Asta (often attributes).
function normalizeXmlKey(key: string): string {
  const noAttr = key.startsWith("@_") ? key.slice(2) : key;
  return noAttr.split(":").pop()?.toLowerCase() ?? noAttr.toLowerCase();
}

// fast-xml-parser represents an element that has both attributes and text as
// { "@_attr": ..., "#text": "value" }. Unwrap to the text value when present.
function scalar(v: unknown): unknown {
  if (
    v &&
    typeof v === "object" &&
    !Array.isArray(v) &&
    TEXT_NODE in (v as Record<string, unknown>)
  ) {
    return (v as Record<string, unknown>)[TEXT_NODE];
  }
  return v;
}

function getNode(obj: unknown, nodeName: string): unknown {
  if (!obj || typeof obj !== "object") return undefined;
  if (Array.isArray(obj)) {
    for (const item of obj) {
      const match = getNode(item, nodeName);
      if (match !== undefined) return match;
    }
    return undefined;
  }
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (normalizeXmlKey(key) === nodeName.toLowerCase()) return value;
  }
  return undefined;
}

function getValue(obj: unknown, keyName: string): unknown {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return undefined;
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (normalizeXmlKey(key) === keyName.toLowerCase()) return scalar(value);
  }
  return undefined;
}

function collectNodes(obj: unknown, nodeName: string, results: unknown[] = []): unknown[] {
  if (!obj || typeof obj !== "object") return results;
  if (Array.isArray(obj)) {
    for (const item of obj) collectNodes(item, nodeName, results);
    return results;
  }
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (normalizeXmlKey(key) === nodeName.toLowerCase()) {
      if (Array.isArray(value)) results.push(...value);
      else results.push(value);
    }
    collectNodes(value, nodeName, results);
  }
  return results;
}

function firstValue(obj: unknown, keys: string[]): unknown {
  for (const key of keys) {
    const value = getValue(obj, key);
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
}

// ── Value coercion (formats vary: 1/0, true/false, "45%", "Completed") ──────────
function toStr(raw: unknown): string {
  const v = scalar(raw);
  if (v === undefined || v === null) return "";
  return String(v).trim();
}

function toNum(raw: unknown): number | undefined {
  const v = scalar(raw);
  if (v === undefined || v === null || v === "") return undefined;
  if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
  const cleaned = String(v).replace(/[%,\s]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : undefined;
}

function toBool(raw: unknown): boolean {
  const v = scalar(raw);
  if (v === undefined || v === null || v === "") return false;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v === 1;
  const s = String(v).trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes" || s === "y";
}

function parseDate(raw: unknown): string {
  const s = toStr(raw);
  if (!s) return "";
  if (s.includes("T")) return s.split("T")[0]; // ISO datetime
  if (s.includes(" ")) return s.split(" ")[0]; // "2024-01-01 08:00:00"
  return s;
}

// ── Field candidates across MS Project (MSPDI), Primavera P6 (PMXML), Asta ──────
const UID_KEYS = ["UID", "ObjectId", "ActivityObjectId", "GUID", "Id", "ID"];
const ID_KEYS = ["ID", "TaskID", "Id", "ActivityId", "ObjectId", "UID"];
const NAME_KEYS = ["Name", "TaskName", "ActivityName", "Title"];
const OUTLINE_KEYS = ["OutlineLevel", "WBSLevel", "Level"];
const START_KEYS = [
  "Start", "StartDate", "PlannedStartDate", "ActualStartDate",
  "EarlyStartDate", "RemainingEarlyStartDate", "BaselineStartDate",
];
const FINISH_KEYS = [
  "Finish", "FinishDate", "PlannedFinishDate", "ActualFinishDate",
  "EarlyFinishDate", "RemainingEarlyFinishDate", "BaselineFinishDate",
];
const PCT_KEYS = [
  "PercentComplete", "PhysicalPercentComplete", "DurationPercentComplete",
  "UnitsPercentComplete", "PercentWorkComplete", "CompletePercent",
];
const SUMMARY_KEYS = ["Summary"];
const MILESTONE_KEYS = ["Milestone", "IsMilestone"];
const TYPE_KEYS = ["Type", "ActivityType", "TaskType"];
const STATUS_KEYS = ["Status", "ActivityStatus"];
const PRED_UID_KEYS = [
  "PredecessorUID", "PredecessorObjectId", "PredecessorActivityObjectId",
  "PredecessorActivityId", "PredecessorID",
];

// Take the largest populated percent field (handles teams that track physical
// or work % while duration % stays 0), then fall back to status text.
function detectPercent(t: unknown): number {
  let best = 0;
  let found = false;
  for (const key of PCT_KEYS) {
    const n = toNum(getValue(t, key));
    if (n !== undefined) {
      found = true;
      if (n > best) best = n;
    }
  }
  if (!found) {
    const status = toStr(firstValue(t, STATUS_KEYS)).toLowerCase();
    if (status.includes("complet")) return 100; // "Completed"
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round(best)));
}

// MS Project <Type> is a numeric task type (0/1/2) so it never matches these;
// Primavera encodes milestones/summaries in the type string instead.
function typeIsMilestone(typeStr: string): boolean {
  return /milestone/i.test(typeStr);
}
function typeIsSummary(typeStr: string): boolean {
  return /summary|wbs/i.test(typeStr);
}

function getPredecessors(t: unknown): number[] {
  const link =
    getNode(t, "PredecessorLink") ?? getNode(t, "Relationship") ?? getNode(t, "Predecessor");
  if (!link) return [];
  const links = Array.isArray(link) ? link : [link];
  return links
    .map((l) => toNum(firstValue(l, PRED_UID_KEYS)) ?? 0)
    .filter((n) => n > 0);
}

function collectTaskNodes(parsed: Record<string, unknown>): unknown[] {
  const projectRoot = getNode(parsed, "Project") ?? parsed;
  // MS Project / Asta MSPDI: <Project><Tasks><Task> — use the direct path so a
  // large file doesn't trigger a full recursive tree walk.
  const tasksContainer = getNode(projectRoot, "Tasks");
  if (tasksContainer) {
    const t = getNode(tasksContainer, "Task");
    if (t) return Array.isArray(t) ? t : [t];
  }
  // Fallbacks: any <Task>, then Primavera <Activity>.
  let nodes = collectNodes(parsed, "Task");
  if (nodes.length === 0) nodes = collectNodes(parsed, "Activity");
  return nodes;
}

// ── Public API ──────────────────────────────────────────────────────────────
export function parseScheduleTasks(xmlText: string): ScheduleTask[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    parseTagValue: false, // keep raw strings; we coerce explicitly per field
    parseAttributeValue: false,
    trimValues: true,
  });
  const parsed = parser.parse(xmlText);

  const rawTasks = collectTaskNodes(parsed);
  if (rawTasks.length === 0) return [];

  // First pass: explicit signals only.
  const mapped = rawTasks
    .filter((t) => {
      const uid = toNum(firstValue(t, UID_KEYS));
      if (uid === 0) return false; // skip the project summary row (UID/ID 0)
      if (toBool(getValue(t, "IsNull"))) return false; // MSP placeholder rows
      return true;
    })
    .map((t, idx): ScheduleTask => {
      const start = parseDate(firstValue(t, START_KEYS));
      const finish = parseDate(firstValue(t, FINISH_KEYS));
      const typeStr = toStr(firstValue(t, TYPE_KEYS));

      const explicitSummary = toBool(firstValue(t, SUMMARY_KEYS)) || typeIsSummary(typeStr);
      const explicitMilestone =
        toBool(firstValue(t, MILESTONE_KEYS)) || typeIsMilestone(typeStr);
      // A zero-duration activity (same start and finish day) is a milestone when
      // no explicit flag is set — matches how MS Project treats 0-day tasks.
      // Compare the date portion, not the raw timestamp: MS Project frequently
      // stamps a milestone with the same day but different times (08:00/17:00).
      // A multi-day task has different dates, so normal work isn't misflagged.
      const zeroDuration = !!start && start === finish;

      return {
        uid: toNum(firstValue(t, UID_KEYS)) ?? idx + 1,
        id: toNum(firstValue(t, ID_KEYS)) ?? idx + 1,
        name: toStr(firstValue(t, NAME_KEYS)),
        outlineLevel: toNum(firstValue(t, OUTLINE_KEYS)) ?? 0,
        isSummary: explicitSummary,
        isMilestone: explicitMilestone || (zeroDuration && !explicitSummary),
        start,
        finish,
        percentComplete: detectPercent(t),
        predecessorUids: getPredecessors(t),
      };
    })
    .filter((t) => t.name || t.start || t.finish || t.id || t.uid);

  // Second pass: derive summaries from the outline hierarchy when flags are
  // absent. A task is a summary if the next task is nested deeper — MS Project's
  // own definition. Only applied when outline levels are present and vary, so
  // Primavera activities (flat, WBS held separately) aren't misflagged.
  const levels = mapped.map((t) => t.outlineLevel);
  const hasOutline = levels.some((l) => l > 0) && new Set(levels).size > 1;
  if (hasOutline) {
    for (let i = 0; i < mapped.length; i++) {
      const next = mapped[i + 1];
      if (next && next.outlineLevel > mapped[i].outlineLevel) {
        mapped[i].isSummary = true;
        mapped[i].isMilestone = false; // a parent rollup is not a milestone
      }
    }
  }

  return mapped;
}

// ── Expected (time-based) progress ──────────────────────────────────────────
// How far "now" sits between a task's start and finish: before start → 0,
// after finish → 100, in between → proportional. Start is taken at the
// beginning of its day and finish at the end of its day so a task finishing
// today reads 100% and a single-day/milestone reads 0 until its day passes.
export function expectedPercent(
  start: string,
  finish: string,
  now: number = Date.now()
): number {
  if (!start) return 0;
  const startMs = Date.parse(`${start}T00:00:00`);
  const finishMs = Date.parse(`${finish || start}T23:59:59`);
  if (!Number.isFinite(startMs) || !Number.isFinite(finishMs)) return 0;
  if (now >= finishMs) return 100;
  if (now <= startMs) return 0;
  const pct = ((now - startMs) / (finishMs - startMs)) * 100;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

// Many schedules (CPM baselines) ship with no actual progress entered — every
// task reads 0%. In that case, fill in expected progress from the timeline so
// the % Complete column and rollup tiles are meaningful. Schedules that DO
// carry actual progress (any task > 0%) are returned unchanged.
export function applyExpectedProgress(
  tasks: ScheduleTask[],
  now: number = Date.now()
): ScheduleTask[] {
  const hasActuals = tasks.some((t) => t.percentComplete > 0);
  if (hasActuals) return tasks;
  return tasks.map((t) => ({
    ...t,
    percentComplete: expectedPercent(t.start, t.finish, now),
  }));
}
