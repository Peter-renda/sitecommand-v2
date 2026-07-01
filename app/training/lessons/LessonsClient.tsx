"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  LESSONS,
  TRACK_LABELS,
  lessonsByTrack,
  lessonCategories,
  getLesson,
  type Lesson,
  type LessonTrack,
} from "@/lib/training-lessons";

/**
 * Training → Lessons: a curated curriculum teaching new PMs both the
 * SiteCommand workflows (RFIs, Submittals, Buyout, …) and the construction
 * concepts those workflows assume (RCP, MEP, CSI divisions, …).
 *
 * Layout mirrors a docs browser: a left list (grouped by track → category)
 * with per-lesson completion checkmarks and a progress bar, and a right pane
 * showing the selected lesson's full content with a Mark Complete toggle and
 * prev/next navigation within the active track.
 */

export default function LessonsClient() {
  const [track, setTrack] = useState<LessonTrack>("workflow");
  const [selectedId, setSelectedId] = useState<string>(lessonsByTrack("workflow")[0]?.id ?? "");
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/training/lessons/progress");
      if (res.ok) {
        const d = await res.json();
        setCompletedIds(new Set<string>(d.completedIds ?? []));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const lesson: Lesson | undefined = getLesson(selectedId);
  const trackLessons = useMemo(() => lessonsByTrack(track), [track]);
  const categories = useMemo(() => lessonCategories(track), [track]);

  const overallCompleted = LESSONS.filter((l) => completedIds.has(l.id)).length;

  function selectTrack(t: LessonTrack) {
    setTrack(t);
    const first = lessonsByTrack(t)[0];
    if (first) setSelectedId(first.id);
  }

  function selectLesson(id: string) {
    setSelectedId(id);
    const l = getLesson(id);
    if (l && l.track !== track) setTrack(l.track);
  }

  async function toggleComplete() {
    if (!lesson || busy) return;
    setBusy(true);
    const willComplete = !completedIds.has(lesson.id);
    // Optimistic update.
    setCompletedIds((prev) => {
      const next = new Set(prev);
      if (willComplete) next.add(lesson.id);
      else next.delete(lesson.id);
      return next;
    });
    try {
      const res = await fetch("/api/training/lessons/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId: lesson.id, completed: willComplete }),
      });
      if (res.ok) {
        const d = await res.json();
        setCompletedIds(new Set<string>(d.completedIds ?? []));
      }
    } finally {
      setBusy(false);
    }
  }

  const idx = trackLessons.findIndex((l) => l.id === selectedId);
  const prevLesson = idx > 0 ? trackLessons[idx - 1] : null;
  const nextLesson = idx >= 0 && idx < trackLessons.length - 1 ? trackLessons[idx + 1] : null;

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900">Lessons</h1>
      <p className="mt-1 text-sm text-gray-500 max-w-2xl">
        Learn the SiteCommand workflows and the construction concepts behind them — built for
        project managers new to the role.
      </p>

      <div className="mt-2 flex items-center gap-2">
        <div className="h-1.5 w-40 rounded-full bg-gray-100 overflow-hidden">
          <div
            className="h-full bg-gray-900 transition-all"
            style={{ width: `${LESSONS.length ? (overallCompleted / LESSONS.length) * 100 : 0}%` }}
          />
        </div>
        <span className="text-xs text-gray-400">
          {overallCompleted}/{LESSONS.length} lessons complete
        </span>
      </div>

      <div className="mt-5 flex flex-col lg:flex-row gap-5">
        {/* Left: track tabs + grouped lesson list */}
        <div className="lg:w-72 shrink-0">
          <div className="flex rounded-lg border border-gray-200 bg-white p-0.5 text-sm">
            {(Object.keys(TRACK_LABELS) as LessonTrack[]).map((t) => (
              <button
                key={t}
                onClick={() => selectTrack(t)}
                className={`flex-1 rounded-md px-3 py-1.5 font-medium transition-colors ${
                  track === t ? "bg-gray-900 text-white" : "text-gray-500 hover:text-gray-900"
                }`}
              >
                {TRACK_LABELS[t]}
              </button>
            ))}
          </div>

          <div className="card mt-3 max-h-[calc(100vh-260px)] overflow-y-auto">
            {categories.map((cat) => (
              <div key={cat} className="py-2 first:pt-3 last:pb-3">
                <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                  {cat}
                </p>
                {trackLessons
                  .filter((l) => l.category === cat)
                  .map((l) => {
                    const active = l.id === selectedId;
                    const done = completedIds.has(l.id);
                    return (
                      <button
                        key={l.id}
                        onClick={() => selectLesson(l.id)}
                        className={`w-full flex items-start gap-2 px-3 py-2 text-left text-[13px] transition-colors ${
                          active ? "bg-gray-100" : "hover:bg-gray-50"
                        }`}
                      >
                        <span
                          className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[10px] ${
                            done
                              ? "border-green-600 bg-green-600 text-white"
                              : "border-gray-300 text-transparent"
                          }`}
                        >
                          ✓
                        </span>
                        <span className={active ? "font-medium text-gray-900" : "text-gray-700"}>
                          {l.title}
                        </span>
                      </button>
                    );
                  })}
              </div>
            ))}
          </div>
        </div>

        {/* Right: selected lesson content */}
        <div className="flex-1 min-w-0">
          {!lesson ? (
            <div className="card card-pad text-sm text-gray-400">Select a lesson to begin.</div>
          ) : (
            <div className="card card-pad">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                    {lesson.category} · {lesson.minutes} min read
                  </p>
                  <h2 className="mt-1 text-xl font-semibold text-gray-900">{lesson.title}</h2>
                  <p className="mt-1 text-sm text-gray-500">{lesson.summary}</p>
                </div>
                <button
                  onClick={toggleComplete}
                  disabled={loading || busy}
                  className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                    completedIds.has(lesson.id)
                      ? "bg-green-50 text-green-700 border border-green-200 hover:bg-green-100"
                      : "bg-gray-900 text-white hover:bg-gray-700"
                  }`}
                >
                  {completedIds.has(lesson.id) ? "✓ Completed" : "Mark complete"}
                </button>
              </div>

              {lesson.keyTerms && lesson.keyTerms.length > 0 && (
                <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-3.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">
                    Key terms
                  </p>
                  <dl className="mt-2 space-y-1.5">
                    {lesson.keyTerms.map((kt) => (
                      <div key={kt.term} className="text-[13px] leading-5">
                        <dt className="inline font-semibold text-amber-900">{kt.term}</dt>
                        <dd className="inline text-amber-900/80"> — {kt.definition}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}

              <div className="mt-5 space-y-5">
                {lesson.body.map((block, i) => (
                  <div key={i}>
                    {block.heading && (
                      <h3 className="text-[15px] font-semibold text-gray-900">{block.heading}</h3>
                    )}
                    {block.paragraphs?.map((p, pi) => (
                      <p key={pi} className="mt-2 text-sm leading-6 text-gray-600">
                        {p}
                      </p>
                    ))}
                    {block.bullets && (
                      <ul className="mt-2 space-y-1.5 list-disc pl-5 text-sm leading-6 text-gray-600">
                        {block.bullets.map((b, bi) => (
                          <li key={bi}>{b}</li>
                        ))}
                      </ul>
                    )}
                    {block.ordered && (
                      <ol className="mt-2 space-y-1.5 list-decimal pl-5 text-sm leading-6 text-gray-600">
                        {block.ordered.map((o, oi) => (
                          <li key={oi}>{o}</li>
                        ))}
                      </ol>
                    )}
                  </div>
                ))}
              </div>

              {lesson.relatedLessonIds && lesson.relatedLessonIds.length > 0 && (
                <div className="mt-6 border-t border-gray-100 pt-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                    Related lessons
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {lesson.relatedLessonIds.map((rid) => {
                      const rl = getLesson(rid);
                      if (!rl) return null;
                      return (
                        <button
                          key={rid}
                          onClick={() => selectLesson(rid)}
                          className="rounded-full border border-gray-200 px-3 py-1 text-xs text-gray-600 hover:border-gray-400 hover:text-gray-900 transition-colors"
                        >
                          {rl.title}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {lesson.links && lesson.links.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-3">
                  {lesson.links.map((link) => (
                    <a
                      key={link.href}
                      href={link.href}
                      className="text-sm font-medium text-gray-900 hover:underline"
                    >
                      {link.label} →
                    </a>
                  ))}
                </div>
              )}

              <div className="mt-6 flex items-center justify-between border-t border-gray-100 pt-4">
                <button
                  onClick={() => prevLesson && selectLesson(prevLesson.id)}
                  disabled={!prevLesson}
                  className="text-sm text-gray-500 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  ← {prevLesson ? prevLesson.title : "Start of track"}
                </button>
                <button
                  onClick={() => nextLesson && selectLesson(nextLesson.id)}
                  disabled={!nextLesson}
                  className="text-sm text-gray-500 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {nextLesson ? nextLesson.title : "End of track"} →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
