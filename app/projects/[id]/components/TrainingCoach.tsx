"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { SimRole } from "@/lib/simulation-constants";
import { getTrainingSchedule, resolveDayIndex } from "@/lib/training-schedule";

/**
 * The "coach" narrator for a "SiteCommand Training" sandbox. On launch — and
 * again at the start of every in-sim day — it pops up a card inviting the
 * trainee to hear a message from their coach. Clicking play fetches an
 * ElevenLabs-narrated MP3 of that day's briefing (synthesized + cached
 * server-side) and plays it alongside the transcript.
 *
 * The active day is read from the same localStorage bridge the Day panel writes
 * (`sc-training-active-day-{projectId}`), so advancing a day surfaces the next
 * coach message live. "Heard" days are remembered per project so the popup
 * doesn't nag once acknowledged; a small launcher pill lets the trainee replay
 * the current day's message anytime.
 */

// Shared with TrainingDayPanel so in-document localStorage writes notify us
// (the native "storage" event only fires in *other* tabs).
const CHANGE_EVENT = "sc-training-day-change";

function readString(key: string): string {
  try {
    return window.localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function writeString(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* ignore unavailable storage */
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function useLocalStorageString(key: string): [string, (next: string) => void] {
  const subscribe = useCallback((onChange: () => void) => {
    window.addEventListener(CHANGE_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(CHANGE_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);
  const getSnapshot = useCallback(() => readString(key), [key]);
  const value = useSyncExternalStore(subscribe, getSnapshot, () => "");
  const setValue = useCallback((next: string) => writeString(key, next), [key]);
  return [value, setValue];
}

type NarrationData = {
  title: string;
  text: string;
  url?: string;
  audio: boolean;
};

export default function TrainingCoach({
  projectId,
  role,
  initialDay,
}: {
  projectId: string;
  role: SimRole;
  initialDay: number;
}) {
  const schedule = useMemo(() => getTrainingSchedule(role), [role]);

  // Active scheduled day — synced live from the Day panel, falling back to the
  // server-provided initial day.
  const [activeDayRaw] = useLocalStorageString(`sc-training-active-day-${projectId}`);
  const activeIndex = useMemo(() => {
    const stored = Number(activeDayRaw);
    const raw = activeDayRaw && Number.isFinite(stored) ? stored : initialDay;
    return resolveDayIndex(schedule, raw);
  }, [activeDayRaw, initialDay, schedule]);
  const activeEntry = activeIndex >= 0 ? schedule[activeIndex] : null;
  const activeDay = activeEntry?.day ?? 0;
  const isFirstDay = !!activeEntry && activeEntry.day === schedule[0]?.day;

  // Days whose coach message the trainee has acknowledged.
  const [heardRaw, setHeardRaw] = useLocalStorageString(`sc-training-coach-heard-${projectId}`);
  const heardDays = useMemo<Set<number>>(() => {
    try {
      const arr = heardRaw ? (JSON.parse(heardRaw) as number[]) : [];
      return new Set(Array.isArray(arr) ? arr : []);
    } catch {
      return new Set();
    }
  }, [heardRaw]);
  const heard = heardDays.has(activeDay);
  const markHeard = useCallback(
    (day: number) => {
      const next = new Set(heardDays);
      next.add(day);
      setHeardRaw(JSON.stringify([...next]));
    },
    [heardDays, setHeardRaw],
  );

  const [open, setOpen] = useState(false);
  const [started, setStarted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<NarrationData | null>(null);
  const [playing, setPlaying] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const cacheRef = useRef<Map<number, NarrationData>>(new Map());
  const shownForDay = useRef<number | null>(null);

  // Auto-open the popup when there's an unheard message for the active day —
  // on launch and each time the trainee advances into a new day.
  useEffect(() => {
    if (!activeEntry) return;
    if (!heard && shownForDay.current !== activeDay) {
      shownForDay.current = activeDay;
      setOpen(true);
      setStarted(false);
      setData(null);
      setError(null);
    }
  }, [activeDay, activeEntry, heard]);

  const fetchNarration = useCallback(
    async (day: number): Promise<NarrationData | null> => {
      const cached = cacheRef.current.get(day);
      if (cached) {
        setData(cached);
        return cached;
      }
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/projects/${projectId}/training/narration`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ day }),
        });
        if (!res.ok) throw new Error("Failed to load narration");
        const json = await res.json();
        const nd: NarrationData = {
          title: json.title ?? "",
          text: json.text ?? "",
          url: typeof json.url === "string" ? json.url : undefined,
          audio: !!json.audio,
        };
        cacheRef.current.set(day, nd);
        setData(nd);
        return nd;
      } catch {
        setError("Couldn't load your coach message. Please try again.");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [projectId],
  );

  const handleStart = useCallback(async () => {
    setStarted(true);
    const nd = await fetchNarration(activeDay);
    if (nd?.audio && nd.url && audioRef.current) {
      audioRef.current.src = nd.url;
      audioRef.current.play().catch(() => setPlaying(false));
    }
  }, [activeDay, fetchNarration]);

  const togglePlay = useCallback(() => {
    const el = audioRef.current;
    if (!el || !data?.url) return;
    if (playing) {
      el.pause();
    } else {
      if (!el.src) el.src = data.url;
      el.play().catch(() => setPlaying(false));
    }
  }, [playing, data]);

  const replay = useCallback(() => {
    const el = audioRef.current;
    if (!el || !data?.url) return;
    if (!el.src) el.src = data.url;
    el.currentTime = 0;
    el.play().catch(() => setPlaying(false));
  }, [data]);

  const dismiss = useCallback(() => {
    audioRef.current?.pause();
    markHeard(activeDay);
    setOpen(false);
    setStarted(false);
  }, [activeDay, markHeard]);

  const collapse = useCallback(() => {
    audioRef.current?.pause();
    setOpen(false);
  }, []);

  const reopen = useCallback(() => {
    setOpen(true);
    setStarted(false);
    setError(null);
  }, []);

  // No schedule for this role → nothing to narrate.
  if (!activeEntry) return null;

  const headerTitle = isFirstDay ? "Welcome to the project" : `${activeEntry.timeframe} — ${activeEntry.phase}`;

  // A single, stable <audio> element lives above both views so playback survives
  // expanding/collapsing the card.
  const audioEl = (
    <audio
      ref={audioRef}
      onPlay={() => setPlaying(true)}
      onPause={() => setPlaying(false)}
      onEnded={() => setPlaying(false)}
      className="hidden"
    />
  );

  // Collapsed launcher pill — always available to replay the current message.
  if (!open) {
    return (
      <>
        {audioEl}
        <button
          type="button"
          onClick={reopen}
          title="Replay your coach's message"
          className="fixed bottom-4 left-4 z-40 flex items-center gap-2 rounded-full bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white shadow-lg transition-colors hover:bg-indigo-700"
        >
          <span aria-hidden>🎧</span>
          <span className="hidden sm:inline">Message from coach</span>
        </button>
      </>
    );
  }

  return (
    <div className="fixed bottom-4 left-4 z-50 w-[22rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-indigo-200 bg-white shadow-2xl animate-scale-in">
      {audioEl}

      {/* Header */}
      <div className="flex items-start justify-between gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-3 text-white">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/20 text-lg">
            🎧
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wide text-indigo-100">
              Your Coach
            </p>
            <p className="truncate text-sm font-semibold">{headerTitle}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={collapse}
          aria-label="Minimize coach"
          className="rounded p-0.5 text-indigo-100 transition-colors hover:bg-white/15 hover:text-white"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Body */}
      <div className="p-4">
        {!started ? (
          <div className="text-center">
            <p className="text-base font-semibold text-gray-900">
              {isFirstDay
                ? "Get started with a message from your coach"
                : "A new day — a message from your coach"}
            </p>
            <p className="mt-1.5 text-sm text-gray-500">
              Take a minute to hear what matters this stretch of the job before you dive in.
            </p>
            <button
              type="button"
              onClick={handleStart}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
              Play message
            </button>
            <button
              type="button"
              onClick={dismiss}
              className="mt-2 block w-full text-xs text-gray-400 transition-colors hover:text-gray-600"
            >
              Dismiss
            </button>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-500">
            <svg className="h-4 w-4 animate-spin text-indigo-500" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Preparing your coach…
          </div>
        ) : error ? (
          <div className="py-6 text-center">
            <p className="text-sm text-red-600">{error}</p>
            <button
              type="button"
              onClick={handleStart}
              className="mt-3 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Try again
            </button>
          </div>
        ) : data ? (
          <div>
            {data.audio && data.url ? (
              <div className="mb-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={togglePlay}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white transition-colors hover:bg-indigo-700"
                  aria-label={playing ? "Pause" : "Play"}
                >
                  {playing ? (
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  )}
                </button>
                <button
                  type="button"
                  onClick={replay}
                  className="flex items-center gap-1.5 text-xs font-medium text-gray-500 transition-colors hover:text-gray-700"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Replay
                </button>
                <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-medium text-indigo-500">
                  {playing && (
                    <span className="flex items-end gap-0.5" aria-hidden>
                      <span className="h-2 w-0.5 animate-pulse bg-indigo-400" />
                      <span className="h-3 w-0.5 animate-pulse bg-indigo-500 [animation-delay:120ms]" />
                      <span className="h-1.5 w-0.5 animate-pulse bg-indigo-400 [animation-delay:240ms]" />
                    </span>
                  )}
                  {playing ? "Playing" : "Paused"}
                </span>
              </div>
            ) : (
              <p className="mb-2 rounded-md bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-700">
                Audio narration isn’t enabled — here’s your coach’s message:
              </p>
            )}

            <div className="max-h-56 overflow-y-auto whitespace-pre-line text-sm leading-relaxed text-gray-700">
              {data.text}
            </div>

            <button
              type="button"
              onClick={dismiss}
              className="mt-4 w-full rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-800"
            >
              Got it — let’s get to work
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
