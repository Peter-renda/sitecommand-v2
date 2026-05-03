"use client";

import { useState, useEffect, useRef, DragEvent, useCallback } from "react";
import ProjectNav from "@/components/ProjectNav";

// ── Types ─────────────────────────────────────────────────────────────────────

type Task = {
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

type ScheduleMeta = {
  id: string;
  filename: string;
  uploaded_by_name: string;
  uploaded_at: string;
};

type ChangeEntry = {
  taskId: number;
  taskName: string;
  field: "start" | "finish";
  oldValue: string;
  newValue: string;
  delta: number; // positive = pushed out, negative = pulled in
  timestamp: string; // ISO string
};

// ── Nav ───────────────────────────────────────────────────────────────────────


// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  if (!iso) return "—";
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round(
    (new Date(by, bm - 1, bd).getTime() - new Date(ay, am - 1, ad).getTime()) / msPerDay
  );
}

// ── Gantt Helpers ─────────────────────────────────────────────────────────────

const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"] as const;

function weekLabel(sundayDate: Date): string {
  const month = sundayDate.toLocaleDateString("en-US", { month: "short" });
  const day = sundayDate.getDate();
  const yr = String(sundayDate.getFullYear()).slice(2);
  return `${month} ${day}, '${yr}`;
}

// ── Table View ────────────────────────────────────────────────────────────────

type EditingCell = { uid: number; field: "start" | "finish" };

function TableView({
  tasks,
  onUpdateTask,
}: {
  tasks: Task[];
  onUpdateTask: (uid: number, field: "start" | "finish", value: string) => void;
}) {
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);

  if (tasks.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-gray-400">
        No tasks found in schedule.
      </div>
    );
  }

  // Build a UID → task ID map so predecessor column shows task IDs (not UIDs)
  const uidToId = new Map<number, number>(tasks.map((t) => [t.uid, t.id]));

  function commitEdit(uid: number, field: "start" | "finish", value: string) {
    if (value) onUpdateTask(uid, field, value);
    setEditingCell(null);
  }

  function DateCell({ task, field }: { task: Task; field: "start" | "finish" }) {
    const isEditing = editingCell?.uid === task.uid && editingCell?.field === field;
    const value = task[field];

    if (isEditing) {
      return (
        <input
          type="date"
          autoFocus
          defaultValue={value}
          className="border border-blue-400 rounded px-1.5 py-0.5 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
          onBlur={(e) => commitEdit(task.uid, field, e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitEdit(task.uid, field, e.currentTarget.value);
            if (e.key === "Escape") setEditingCell(null);
          }}
        />
      );
    }

    return (
      <span
        className="cursor-default hover:bg-blue-50 hover:text-blue-700 rounded px-1 -mx-1 transition-colors"
        title="Double-click to edit"
        onDoubleClick={() => setEditingCell({ uid: task.uid, field })}
      >
        {value || "—"}
      </span>
    );
  }

  return (
    <div className="overflow-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200 sticky top-0">
            <th className="text-left px-4 py-2.5 font-medium text-gray-600 w-14">ID</th>
            <th className="text-left px-4 py-2.5 font-medium text-gray-600">Task Name</th>
            <th className="text-left px-4 py-2.5 font-medium text-gray-600 whitespace-nowrap">Start</th>
            <th className="text-left px-4 py-2.5 font-medium text-gray-600 whitespace-nowrap">Finish</th>
            <th className="text-left px-4 py-2.5 font-medium text-gray-600 whitespace-nowrap">Duration (days)</th>
            <th className="text-left px-4 py-2.5 font-medium text-gray-600 whitespace-nowrap">Predecessors</th>
            <th className="text-left px-4 py-2.5 font-medium text-gray-600 whitespace-nowrap">% Complete</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => {
            const duration = task.start && task.finish ? daysBetween(task.start, task.finish) : 0;
            const predecessorIds = task.predecessorUids
              .map((uid) => uidToId.get(uid) ?? uid)
              .join(", ");
            return (
              <tr
                key={task.uid}
                className={`border-b border-gray-100 ${task.isSummary ? "bg-gray-50" : "hover:bg-gray-50"}`}
              >
                <td className="px-4 py-2 text-gray-400">{task.id}</td>
                <td className="px-4 py-2">
                  <span
                    style={{ paddingLeft: `${task.outlineLevel * 16}px` }}
                    className={`inline-block ${task.isSummary ? "font-semibold text-gray-800" : "text-gray-700"} ${task.isMilestone ? "italic" : ""}`}
                  >
                    {task.isMilestone && <span className="mr-1 text-amber-500">◆</span>}
                    {task.name}
                  </span>
                </td>
                <td className="px-4 py-2 text-gray-500 whitespace-nowrap">
                  <DateCell task={task} field="start" />
                </td>
                <td className="px-4 py-2 text-gray-500 whitespace-nowrap">
                  <DateCell task={task} field="finish" />
                </td>
                <td className="px-4 py-2 text-gray-500">{task.isMilestone ? "—" : duration}</td>
                <td className="px-4 py-2 text-gray-500">{predecessorIds || "—"}</td>
                <td className="px-4 py-2">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      task.percentComplete === 100
                        ? "bg-green-100 text-green-700"
                        : task.percentComplete > 0
                        ? "bg-blue-100 text-blue-700"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {task.percentComplete}%
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Gantt View ────────────────────────────────────────────────────────────────

function GanttView({ tasks }: { tasks: Task[] }) {
  const validTasks = tasks.filter((t) => t.start && t.finish);
  if (validTasks.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-gray-400">
        No tasks with date information to display.
      </div>
    );
  }

  const allStarts = validTasks.map((t) => new Date(t.start).getTime());
  const allFinishes = validTasks.map((t) => new Date(t.finish).getTime());
  const projectStartDate = new Date(Math.min(...allStarts));
  const projectEndDate = new Date(Math.max(...allFinishes));

  // Snap range to week boundaries: start on Sunday, end on Saturday
  const rangeStart = new Date(projectStartDate);
  rangeStart.setDate(rangeStart.getDate() - rangeStart.getDay());
  rangeStart.setHours(0, 0, 0, 0);

  const rangeEnd = new Date(projectEndDate);
  rangeEnd.setDate(rangeEnd.getDate() + (6 - rangeEnd.getDay()));
  rangeEnd.setHours(0, 0, 0, 0);

  const msPerDay = 1000 * 60 * 60 * 24;
  const totalDays = Math.round((rangeEnd.getTime() - rangeStart.getTime()) / msPerDay) + 1;
  const numWeeks = Math.ceil(totalDays / 7);

  const DAY_W = 20; // px per day column
  const WEEK_ROW_H = 24;
  const DAY_ROW_H = 20;
  const HEADER_H = WEEK_ROW_H + DAY_ROW_H;
  const ROW_HEIGHT = 36;
  const LEFT_PANE_W = 280;
  const totalW = totalDays * DAY_W;
  const BAR_HEIGHT = 22;
  const BAR_TOP = (ROW_HEIGHT - BAR_HEIGHT) / 2;

  const taskByUid = new Map<number, Task>(tasks.map((t) => [t.uid, t]));
  const taskRowByUid = new Map<number, number>(tasks.map((t, idx) => [t.uid, idx]));
  const edgePaths = tasks.flatMap((task, taskIndex) => {
    if (!task.start || !task.finish) return [];
    const toXDays = (new Date(task.start).getTime() - rangeStart.getTime()) / msPerDay;
    const toX = Math.max(0, toXDays * DAY_W);
    const toY = taskIndex * ROW_HEIGHT + ROW_HEIGHT / 2;

    return task.predecessorUids.flatMap((predUid) => {
      const pred = taskByUid.get(predUid);
      if (!pred || !pred.start || !pred.finish) return [];

      const predIndex = taskRowByUid.get(predUid) ?? -1;
      if (predIndex < 0) return [];

      const predEndDays = (new Date(pred.finish).getTime() - rangeStart.getTime()) / msPerDay;
      const fromX = Math.max(0, predEndDays * DAY_W);
      const fromY = predIndex * ROW_HEIGHT + ROW_HEIGHT / 2;
      const elbowX = Math.max(fromX + 10, toX - 10);

      return [{ key: `${predUid}-${task.uid}`, fromX, fromY, elbowX, toX, toY }];
    });
  });

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left pane — task names */}
      <div
        style={{ width: `${LEFT_PANE_W}px`, minWidth: `${LEFT_PANE_W}px` }}
        className="bg-white border-r border-gray-200 flex flex-col overflow-hidden shrink-0"
      >
        <div
          style={{ height: `${HEADER_H}px` }}
          className="border-b border-gray-200 bg-gray-50 shrink-0 px-3 flex items-end pb-1"
        >
          <span className="text-xs font-medium text-gray-500">Task Name</span>
        </div>
        <div className="overflow-y-auto flex-1">
          {tasks.map((task) => (
            <div
              key={task.uid}
              style={{ height: `${ROW_HEIGHT}px` }}
              className={`flex items-center border-b border-gray-100 px-3 ${task.isSummary ? "bg-gray-50" : ""}`}
            >
              <span
                style={{ paddingLeft: `${task.outlineLevel * 12}px` }}
                className={`truncate text-xs ${task.isSummary ? "font-semibold text-gray-800" : "text-gray-700"} ${task.isMilestone ? "italic" : ""}`}
                title={task.name}
              >
                {task.isMilestone && <span className="mr-1 text-amber-500">◆</span>}
                {task.name}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Right pane — timeline */}
      <div className="flex-1 overflow-x-auto overflow-y-auto flex flex-col">
        {/* Two-row header: week labels + day letters */}
        <div style={{ minWidth: `${totalW}px` }} className="shrink-0 sticky top-0 z-10 bg-gray-50 border-b border-gray-200">
          {/* Row 1 — week start dates */}
          <div style={{ height: `${WEEK_ROW_H}px` }} className="flex border-b border-gray-100">
            {Array.from({ length: numWeeks }, (_, w) => {
              const sunday = new Date(rangeStart.getTime() + w * 7 * msPerDay);
              return (
                <div
                  key={w}
                  style={{ width: `${7 * DAY_W}px`, minWidth: `${7 * DAY_W}px` }}
                  className="border-r border-gray-200 flex items-center px-1.5 overflow-hidden"
                >
                  <span className="text-xs font-medium text-gray-600 whitespace-nowrap">
                    {weekLabel(sunday)}
                  </span>
                </div>
              );
            })}
          </div>
          {/* Row 2 — day letters */}
          <div style={{ height: `${DAY_ROW_H}px` }} className="flex">
            {Array.from({ length: totalDays }, (_, i) => {
              const dow = (rangeStart.getDay() + i) % 7;
              const isWeekend = dow === 0 || dow === 6;
              const isWeekBoundary = dow === 0 && i > 0;
              return (
                <div
                  key={i}
                  style={{ width: `${DAY_W}px`, minWidth: `${DAY_W}px` }}
                  className={`flex items-center justify-center text-xs border-r ${
                    isWeekBoundary ? "border-gray-200" : "border-gray-100"
                  } ${isWeekend ? "text-gray-400 bg-gray-100/60" : "text-gray-500"}`}
                >
                  {DAY_LETTERS[dow]}
                </div>
              );
            })}
          </div>
        </div>

        {/* Task rows */}
        <div style={{ minWidth: `${totalW}px` }} className="relative">
          {/* Dependency lines (from XML predecessors) */}
          <svg
            style={{ width: `${totalW}px`, height: `${tasks.length * ROW_HEIGHT}px` }}
            className="absolute top-0 left-0 pointer-events-none z-10"
          >
            <defs>
              <marker id="dep-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill="#6b7280" />
              </marker>
            </defs>
            {edgePaths.map((edge) => (
              <path
                key={edge.key}
                d={`M ${edge.fromX} ${edge.fromY} L ${edge.elbowX} ${edge.fromY} L ${edge.elbowX} ${edge.toY} L ${edge.toX} ${edge.toY}`}
                fill="none"
                stroke="#6b7280"
                strokeWidth="1.2"
                markerEnd="url(#dep-arrow)"
              />
            ))}
          </svg>

          {tasks.map((task) => {
            const hasDate = task.start && task.finish;
            const taskStartMs = hasDate ? new Date(task.start).getTime() : 0;
            const taskFinishMs = hasDate ? new Date(task.finish).getTime() : 0;
            const rangeStartMs = rangeStart.getTime();

            const leftDays = hasDate ? Math.max(0, (taskStartMs - rangeStartMs) / msPerDay) : 0;
            const widthDays = hasDate ? Math.max(0, (taskFinishMs - taskStartMs) / msPerDay) : 0;

            const leftPct = (leftDays / totalDays) * 100;
            const widthPct = Math.max(widthDays > 0 ? (widthDays / totalDays) * 100 : 0.3, 0.3);

            return (
              <div
                key={task.uid}
                style={{ height: `${ROW_HEIGHT}px` }}
                className={`relative border-b border-gray-100 flex items-center ${task.isSummary ? "bg-gray-50" : ""}`}
              >
                {/* Weekly gridlines */}
                {Array.from({ length: numWeeks }, (_, w) => (
                  <div
                    key={w}
                    style={{
                      position: "absolute",
                      left: `${(w * 7 / totalDays) * 100}%`,
                      width: `${(7 / totalDays) * 100}%`,
                      top: 0,
                      bottom: 0,
                      borderRight: "1px solid #f0f0f0",
                    }}
                  />
                ))}

                {hasDate && (
                  task.isMilestone ? (
                    <div
                      style={{
                        position: "absolute",
                        left: `calc(${leftPct}% - 6px)`,
                        width: "12px",
                        height: "12px",
                        background: "#f59e0b",
                        transform: "rotate(45deg)",
                      }}
                      title={`${task.name}\n${task.start}`}
                    />
                  ) : (
                    <div
                      style={{
                        position: "absolute",
                        left: `${leftPct}%`,
                        width: `${widthPct}%`,
                        top: `${BAR_TOP}px`,
                        height: task.isSummary ? `${BAR_HEIGHT}px` : `${Math.round(BAR_HEIGHT * 0.75)}px`,
                        background: task.isSummary ? "#4b5563" : "#3b82f6",
                        borderRadius: "3px",
                        overflow: "hidden",
                      }}
                      title={`${task.name}\n${task.start} → ${task.finish}\n${task.percentComplete}% complete`}
                    >
                      {task.percentComplete > 0 && (
                        <div
                          style={{
                            width: `${task.percentComplete}%`,
                            height: "100%",
                            background: task.isSummary ? "#374151" : "#1d4ed8",
                          }}
                        />
                      )}
                    </div>
                  )
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Calendar View ─────────────────────────────────────────────────────────────

function CalendarView({ tasks }: { tasks: Task[] }) {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1)
  );

  const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
  const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);

  const gridStart = new Date(monthStart);
  gridStart.setDate(monthStart.getDate() - monthStart.getDay());
  const gridEnd = new Date(monthEnd);
  gridEnd.setDate(monthEnd.getDate() + (6 - monthEnd.getDay()));

  const days: Date[] = [];
  for (const d = new Date(gridStart); d <= gridEnd; d.setDate(d.getDate() + 1)) {
    days.push(new Date(d));
  }

  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  const scheduledTasks = tasks.filter((task) => task.start && task.finish);

  function tasksForDay(day: Date) {
    const dayKey = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
    return scheduledTasks.filter((task) => {
      const start = new Date(`${task.start}T00:00:00`);
      const finish = new Date(`${task.finish}T00:00:00`);
      return dayKey >= start.getTime() && dayKey <= finish.getTime();
    });
  }

  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="h-full overflow-auto bg-gray-50 p-4">
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <button
            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-md text-gray-600 hover:bg-gray-50"
          >
            Previous
          </button>
          <h3 className="text-base font-semibold text-gray-900">
            {monthStart.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </h3>
          <button
            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-md text-gray-600 hover:bg-gray-50"
          >
            Next
          </button>
        </div>

        <div className="grid grid-cols-7 border-b border-gray-100">
          {weekDays.map((label) => (
            <div key={label} className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide border-r last:border-r-0 border-gray-100">
              {label}
            </div>
          ))}
        </div>

        <div className="divide-y divide-gray-100">
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} className="grid grid-cols-7">
              {week.map((day) => {
                const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
                const dayTasks = tasksForDay(day);
                return (
                  <div
                    key={day.toISOString()}
                    className={`min-h-[110px] p-2 border-r last:border-r-0 border-gray-100 ${
                      isCurrentMonth ? "bg-white" : "bg-gray-50"
                    }`}
                  >
                    <div className={`text-xs mb-2 ${isCurrentMonth ? "text-gray-700" : "text-gray-400"}`}>
                      {day.getDate()}
                    </div>
                    <div className="space-y-1">
                      {dayTasks.slice(0, 2).map((task) => (
                        <div
                          key={`${task.uid}-${day.toISOString()}`}
                          className={`h-2 rounded-full ${task.isSummary ? "bg-slate-500" : "bg-blue-500"}`}
                          title={`${task.name}: ${task.start} → ${task.finish}`}
                        />
                      ))}
                      {dayTasks.length > 2 && (
                        <div className="text-[10px] text-gray-400">+{dayTasks.length - 2} more</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Upload Zone ───────────────────────────────────────────────────────────────

function UploadZone({
  projectId,
  uploading,
  onUploaded,
}: {
  projectId: string;
  uploading: boolean;
  onUploaded: () => void;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  async function upload(file: File) {
    if (!file.name.toLowerCase().endsWith(".xml")) {
      setError("Only .xml files are accepted.");
      return;
    }
    setError(null);
    setIsUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`/api/projects/${projectId}/schedule`, { method: "POST", body: fd });
    setIsUploading(false);
    if (res.ok) {
      onUploaded();
    } else {
      const data = await res.json();
      setError(data.error ?? "Upload failed.");
    }
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) upload(file);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) upload(file);
    e.target.value = "";
  }

  return (
    <div className="flex-1 flex items-center justify-center p-12">
      <div
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        className={`w-full max-w-lg border-2 border-dashed rounded-2xl p-12 flex flex-col items-center gap-4 text-center transition-colors ${
          isDragging ? "border-blue-400 bg-blue-50" : "border-gray-300 bg-white"
        }`}
      >
        {isUploading || uploading ? (
          <>
            <svg className="w-8 h-8 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            <p className="text-sm text-gray-500">Uploading schedule…</p>
          </>
        ) : (
          <>
            <svg className="w-10 h-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-gray-700">Drop your MS Project XML file here</p>
              <p className="text-xs text-gray-400 mt-1">or</p>
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              Choose File
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xml,text/xml,application/xml"
              className="hidden"
              onChange={handleFileInput}
            />
            <p className="text-xs text-gray-400 leading-relaxed">
              In MS Project: <span className="font-medium">File → Save As → XML Format (*.xml)</span>
            </p>
            {error && <p className="text-xs text-red-600">{error}</p>}
          </>
        )}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ScheduleClient({
  projectId,
  role,
  username,
}: {
  projectId: string;
  role: string;
  username: string;
}) {
  const [schedule, setSchedule] = useState<ScheduleMeta | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeTab, setActiveTab] = useState<"table" | "gantt" | "calendar">("table");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [replaceError, setReplaceError] = useState<string | null>(null);
  const fileReplaceRef = useRef<HTMLInputElement>(null);
  const [changeHistory, setChangeHistory] = useState<ChangeEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const fetchSchedule = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/projects/${projectId}/schedule`);
    if (res.ok) {
      const data = await res.json();
      setSchedule(data.schedule ?? null);
      setTasks(data.tasks ?? []);
      setChangeHistory(data.changeHistory ?? []);
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => { fetchSchedule(); }, [fetchSchedule]);

  function handleUpdateTask(uid: number, field: "start" | "finish", value: string) {
    const task = tasks.find((t) => t.uid === uid);
    if (task) {
      const oldValue = task[field];
      if (oldValue && value && oldValue !== value) {
        const delta = daysBetween(oldValue, value);
        const entry: ChangeEntry = {
          taskId: task.id,
          taskName: task.name,
          field,
          oldValue,
          newValue: value,
          delta,
          timestamp: new Date().toISOString(),
        };
        setChangeHistory((prev) => [entry, ...prev]);
        // Auto-save the date change and history entry to the server
        fetch(`/api/projects/${projectId}/schedule`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uid, field, value, changeEntry: entry }),
        });
      }
    }
    setTasks((prev) => prev.map((t) => t.uid === uid ? { ...t, [field]: value } : t));
  }

  async function handleReplaceFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    if (!file.name.toLowerCase().endsWith(".xml")) {
      setReplaceError("Only .xml files are accepted.");
      return;
    }
    setReplaceError(null);
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`/api/projects/${projectId}/schedule`, { method: "POST", body: fd });
    setUploading(false);
    if (res.ok) {
      fetchSchedule();
    } else {
      const data = await res.json().catch(() => ({}));
      setReplaceError(data.error ?? "Upload failed. Please try again.");
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-6 h-14 flex items-center justify-between shrink-0">
        <a href="/dashboard" className="text-sm font-semibold text-gray-900 hover:text-gray-600 transition-colors">
          SiteCommand
        </a>
        <div className="flex items-center gap-5">
          <span className="text-sm text-gray-400">{username}</span>
          <button onClick={handleLogout} className="text-sm text-gray-400 hover:text-gray-900 transition-colors">
            Logout
          </button>
        </div>
      </header>

      <ProjectNav projectId={projectId} />

      {/* Page heading */}
      <div className="bg-white border-b border-gray-100 px-6 py-4 shrink-0">
        <h1 className="font-display text-[32px] leading-[1.05] tracking-[-0.012em] text-[color:var(--ink)]">Schedule</h1>
        {schedule && tasks.length > 0 && (
          <p className="sec-sub mt-1.5">
            <span className="serif-italic text-[color:var(--brand-700)]">Across this project</span>
            <span className="sep">·</span>
            <span className="num" style={{ color: "var(--brand-500)" }}>{tasks.length}</span> tasks
          </p>
        )}
      </div>

      {/* Body */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <svg className="w-6 h-6 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
        </div>
      ) : !schedule ? (
        <UploadZone
          projectId={projectId}
          uploading={uploading}
          onUploaded={fetchSchedule}
        />
      ) : (
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Schedule header bar */}
          <div className="bg-white border-b border-gray-100 px-6 py-3 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="font-medium text-gray-800">{schedule.filename}</span>
              <span className="text-gray-300">·</span>
              <span>Uploaded by {schedule.uploaded_by_name}</span>
              <span className="text-gray-300">·</span>
              <span>{formatDate(schedule.uploaded_at)}</span>
              <span className="text-gray-300">·</span>
              <span className="text-gray-400">{tasks.length} tasks</span>
            </div>
            <div className="flex flex-col items-end gap-1">
              <button
                onClick={() => { setReplaceError(null); fileReplaceRef.current?.click(); }}
                disabled={uploading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                {uploading ? "Replacing…" : "Replace Schedule"}
              </button>
              {replaceError && <p className="text-xs text-red-600">{replaceError}</p>}
            </div>
            <input
              ref={fileReplaceRef}
              type="file"
              accept=".xml,text/xml,application/xml"
              className="hidden"
              onChange={handleReplaceFile}
            />
          </div>

          {/* Tab bar */}
          <div className="bg-white border-b border-gray-100 px-6 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-1">
              {(["table", "gantt", "calendar"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab
                      ? "border-blue-600 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {tab === "table" ? "Table" : tab === "gantt" ? "Gantt Chart" : "Calendar"}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowHistory((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                showHistory
                  ? "bg-gray-100 text-gray-800"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Change History
              {changeHistory.length > 0 && (
                <span className="ml-0.5 bg-blue-100 text-blue-700 text-xs font-semibold px-1.5 py-0.5 rounded-full leading-none">
                  {changeHistory.length}
                </span>
              )}
            </button>
          </div>

          {/* Change history panel */}
          {showHistory && (
            <div className="bg-white border-b border-gray-200 shrink-0">
              <div className="px-6 py-2 flex items-center justify-between border-b border-gray-100">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Change History</span>
                {changeHistory.length > 0 && (
                  <button
                    onClick={() => {
                      setChangeHistory([]);
                      fetch(`/api/projects/${projectId}/schedule`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ clearHistory: true }),
                      });
                    }}
                    className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    Clear all
                  </button>
                )}
              </div>
              <div className="max-h-44 overflow-y-auto divide-y divide-gray-50">
                {changeHistory.length === 0 ? (
                  <p className="px-6 py-4 text-sm text-gray-400 italic">No changes recorded yet. Edit start or finish dates in the Table view to track changes.</p>
                ) : (
                  changeHistory.map((entry, i) => {
                    const direction =
                      entry.delta > 0
                        ? `pushed ${entry.delta} day${entry.delta === 1 ? "" : "s"} out`
                        : entry.delta < 0
                        ? `pulled ${Math.abs(entry.delta)} day${Math.abs(entry.delta) === 1 ? "" : "s"} in`
                        : "date changed (same day count)";
                    return (
                      <div key={i} className="px-6 py-2.5 flex items-baseline justify-between gap-4">
                        <span className="text-sm text-gray-700">
                          <span className="font-medium text-gray-900">Task {entry.taskId}</span>
                          <span className="text-gray-400 mx-1">–</span>
                          <span className="text-gray-600">{entry.taskName}</span>
                          <span className="text-gray-400 mx-1">–</span>
                          <span>{entry.field} date </span>
                          <span className={entry.delta > 0 ? "text-amber-600 font-medium" : entry.delta < 0 ? "text-green-600 font-medium" : "text-gray-500"}>
                            {direction}
                          </span>
                          <span className="text-gray-400 ml-1.5">({formatDate(entry.oldValue)} → {formatDate(entry.newValue)})</span>
                        </span>
                        <span className="text-xs text-gray-400 shrink-0">
                          {new Date(entry.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" })}{" "}
                          {new Date(entry.timestamp).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Content */}
          <div className="flex-1 overflow-hidden">
            {activeTab === "table" ? (
              <div className="h-full overflow-auto">
                <TableView tasks={tasks} onUpdateTask={handleUpdateTask} />
              </div>
            ) : activeTab === "gantt" ? (
              <div className="h-full flex flex-col">
                <GanttView tasks={tasks} />
              </div>
            ) : (
              <div className="h-full flex flex-col">
                <CalendarView tasks={tasks} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
