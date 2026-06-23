"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Persistent banner across every tool page of a "SiteCommand Training" sandbox.
 * Besides branding the practice environment, it carries the Google-Docs-style
 * save UX: an auto-save heartbeat plus a manual "Save progress" button in the
 * top-right corner, with an "All changes saved" status indicator.
 *
 * The sandbox's tool records already persist per-action; this records a "last
 * saved" checkpoint (heartbeat every 60s, on tab-hide, on close, and on click)
 * so progress is reassuringly tracked and surfaced on the Practice list.
 */

const HEARTBEAT_MS = 60_000;

function relTime(ts: number, now: number): string {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 10) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr ago`;
  return new Date(ts).toLocaleDateString();
}

export default function TrainingBanner({
  projectId,
  initialSavedAt,
}: {
  projectId: string;
  initialSavedAt: string | null;
}) {
  const [savedAt, setSavedAt] = useState<number | null>(
    initialSavedAt ? new Date(initialSavedAt).getTime() : null,
  );
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [now, setNow] = useState(() => Date.now());
  const savingRef = useRef(false);

  // Mark this browser as "in training mode" while the user is in a sandbox, so the
  // dashboard and project list stay scoped to their training projects even after
  // they navigate away from the sandbox. Cleared from the dashboard's
  // "Exit training mode" control. 30-day, lax, non-httpOnly (read server-side by
  // /api/projects and client-side by the dashboard).
  useEffect(() => {
    document.cookie = "sc_training_mode=1; path=/; max-age=2592000; samesite=lax";
  }, []);

  const save = useCallback(async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setStatus("saving");
    try {
      const res = await fetch(`/api/training/projects/${projectId}/save`, { method: "POST" });
      if (!res.ok) throw new Error("save failed");
      const data = await res.json();
      setSavedAt(data.savedAt ? new Date(data.savedAt).getTime() : Date.now());
      setStatus("idle");
    } catch {
      setStatus("error");
    } finally {
      savingRef.current = false;
    }
  }, [projectId]);

  // Heartbeat auto-save + a ticking clock so the relative label stays fresh.
  useEffect(() => {
    const beat = setInterval(save, HEARTBEAT_MS);
    const tick = setInterval(() => setNow(Date.now()), 15_000);
    return () => {
      clearInterval(beat);
      clearInterval(tick);
    };
  }, [save]);

  // Checkpoint when the user leaves/hides/closes the tab (closest thing to
  // "saved on close"). sendBeacon survives unload and sends session cookies.
  useEffect(() => {
    const url = `/api/training/projects/${projectId}/save`;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") navigator.sendBeacon?.(url);
    };
    const onPageHide = () => navigator.sendBeacon?.(url);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [projectId]);

  const statusLabel =
    status === "saving"
      ? "Saving…"
      : status === "error"
        ? "Couldn't save — retry"
        : savedAt
          ? `All changes saved · ${relTime(savedAt, now)}`
          : "All changes saved";

  return (
    <div className="w-full bg-amber-500 text-white px-3 sm:px-4 py-1.5 flex items-center justify-between gap-3 flex-wrap text-xs sm:text-[13px]">
      <div className="flex items-center gap-2 font-medium min-w-0">
        <span aria-hidden>🎓</span>
        <span className="truncate">
          SiteCommand Training — sandbox project, for practice only.
        </span>
        <a href="/training/practice" className="underline whitespace-nowrap hover:text-amber-100">
          Exit
        </a>
      </div>

      <div className="flex items-center gap-2.5 shrink-0">
        <span
          className={`whitespace-nowrap ${status === "error" ? "text-red-50 font-medium" : "text-amber-50"}`}
          aria-live="polite"
        >
          {statusLabel}
        </span>
        <button
          onClick={save}
          disabled={status === "saving"}
          className="rounded-md bg-white/15 hover:bg-white/25 disabled:opacity-60 px-2.5 py-1 font-medium whitespace-nowrap transition-colors"
        >
          Save progress
        </button>
      </div>
    </div>
  );
}
