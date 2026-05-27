"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_DASHBOARD_PREFS,
  DashboardPreferences,
  OPEN_ITEM_TYPES,
  OPEN_ITEM_TYPE_LABELS,
  OpenItemType,
  loadDashboardPreferences,
  saveDashboardPreferences,
} from "@/lib/dashboard-preferences";

type Step = {
  targetId: string;
  title: string;
  desc: string;
  renderControls: (prefs: DashboardPreferences, update: (next: DashboardPreferences) => void) => React.ReactNode;
};

const STEPS: Step[] = [
  {
    targetId: "dash-attention-anchor",
    title: "What shows up in “items that need your attention”",
    desc: "Pick which record types should count as open items on your dashboard. Changes save as you toggle.",
    renderControls: (prefs, update) => (
      <div className="wt-ctl">
        <label className="wt-ctl-label">Include these in attention items</label>
        {OPEN_ITEM_TYPES.map((t) => {
          const on = prefs.attentionTypes[t];
          return (
            <div className="wt-toggle-row" key={t}>
              <div className="wt-toggle-meta">
                <span className="wt-toggle-title">{OPEN_ITEM_TYPE_LABELS[t]}</span>
              </div>
              <button
                type="button"
                aria-pressed={on}
                className={`wt-toggle ${on ? "is-on" : ""}`}
                onClick={() =>
                  update({
                    ...prefs,
                    attentionTypes: { ...prefs.attentionTypes, [t]: !on },
                  })
                }
              />
            </div>
          );
        })}
      </div>
    ),
  },
  {
    targetId: "dash-while-away-anchor",
    title: "“While you were away” section",
    desc: "Hide this section if you don’t want a feed of recent updates on your portfolio dashboard.",
    renderControls: (prefs, update) => (
      <div className="wt-ctl">
        <div className="wt-toggle-row">
          <div className="wt-toggle-meta">
            <span className="wt-toggle-title">Show “While you were away”</span>
            <span className="wt-toggle-sub">Recent activity since your last login</span>
          </div>
          <button
            type="button"
            aria-pressed={prefs.showWhileAway}
            className={`wt-toggle ${prefs.showWhileAway ? "is-on" : ""}`}
            onClick={() => update({ ...prefs, showWhileAway: !prefs.showWhileAway })}
          />
        </div>
      </div>
    ),
  },
  {
    targetId: "dash-portfolio-anchor",
    title: "Portfolio snapshot — total value",
    desc: "Hide the total portfolio value on the focus card if you don’t want it visible to people glancing at your screen.",
    renderControls: (prefs, update) => (
      <div className="wt-ctl">
        <div className="wt-toggle-row">
          <div className="wt-toggle-meta">
            <span className="wt-toggle-title">Show total portfolio value</span>
            <span className="wt-toggle-sub">Top-right of the focus card</span>
          </div>
          <button
            type="button"
            aria-pressed={prefs.showPortfolioTotal}
            className={`wt-toggle ${prefs.showPortfolioTotal ? "is-on" : ""}`}
            onClick={() => update({ ...prefs, showPortfolioTotal: !prefs.showPortfolioTotal })}
          />
        </div>
      </div>
    ),
  },
];

type Arrow = "left" | "right" | "top" | "bottom";

type Position = { top: number; left: number; arrow: Arrow; maxHeight: number };

const TIP_WIDTH = 340;
const GAP = 18;
const MARGIN = 16;

function computePosition(target: DOMRect, tipHeight: number): Position {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const roomRight = vw - target.right - GAP - MARGIN;
  const roomLeft = target.left - GAP - MARGIN;
  const roomBelow = vh - target.bottom - GAP - MARGIN;
  const roomAbove = target.top - GAP - MARGIN;

  let arrow: Arrow = "left";
  let left = 0;
  let top = 0;
  let maxHeight = vh - 2 * MARGIN;

  if (roomRight >= TIP_WIDTH) {
    arrow = "left";
    left = target.right + GAP;
    top = Math.max(MARGIN, target.top - 6);
  } else if (roomLeft >= TIP_WIDTH) {
    arrow = "right";
    left = target.left - GAP - TIP_WIDTH;
    top = Math.max(MARGIN, target.top - 6);
  } else if (roomBelow >= roomAbove) {
    arrow = "top";
    left = Math.max(MARGIN, Math.min(target.left, vw - TIP_WIDTH - MARGIN));
    top = target.bottom + GAP;
    maxHeight = roomBelow;
  } else {
    arrow = "bottom";
    left = Math.max(MARGIN, Math.min(target.left, vw - TIP_WIDTH - MARGIN));
    maxHeight = roomAbove;
    const h = Math.min(tipHeight, maxHeight);
    top = target.top - GAP - h;
  }

  top = Math.max(MARGIN, Math.min(top, vh - MARGIN - 60));
  left = Math.max(MARGIN, Math.min(left, vw - TIP_WIDTH - MARGIN));

  return { top, left, arrow, maxHeight: Math.max(220, maxHeight) };
}

export default function DashboardWalkthrough({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [prefs, setPrefs] = useState<DashboardPreferences>(DEFAULT_DASHBOARD_PREFS);
  const [stepIndex, setStepIndex] = useState(0);
  const [spotlight, setSpotlight] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const [tipPos, setTipPos] = useState<Position | null>(null);
  const tipRef = useRef<HTMLDivElement>(null);

  // Hydrate prefs from storage when the tour opens.
  useEffect(() => {
    if (!open) return;
    setPrefs(loadDashboardPreferences());
    setStepIndex(0);
  }, [open]);

  const updatePrefs = (next: DashboardPreferences) => {
    setPrefs(next);
    saveDashboardPreferences(next);
  };

  const step = STEPS[stepIndex];

  // Reposition spotlight + tooltip whenever the step changes, on resize, or on scroll.
  const measure = () => {
    if (!step) return;
    const target = document.getElementById(step.targetId);
    if (!target) {
      setSpotlight(null);
      setTipPos(null);
      return;
    }
    const r = target.getBoundingClientRect();
    const pad = 8;
    setSpotlight({
      top: r.top - pad,
      left: r.left - pad,
      width: r.width + pad * 2,
      height: r.height + pad * 2,
    });
    const tipHeight = tipRef.current?.offsetHeight ?? 360;
    setTipPos(computePosition(r, tipHeight));
  };

  useLayoutEffect(() => {
    if (!open) return;
    // Scroll the target into view first, then measure.
    const target = document.getElementById(step.targetId);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    // Measure twice: once now, once after smooth scroll settles.
    measure();
    const t = setTimeout(measure, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, stepIndex]);

  useEffect(() => {
    if (!open) return;
    const handler = () => measure();
    window.addEventListener("resize", handler);
    window.addEventListener("scroll", handler, true);
    return () => {
      window.removeEventListener("resize", handler);
      window.removeEventListener("scroll", handler, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, stepIndex]);

  const totalSteps = STEPS.length;
  const isLast = stepIndex === totalSteps - 1;
  const isFirst = stepIndex === 0;

  const handleNext = () => {
    if (isLast) {
      onClose();
      return;
    }
    setStepIndex((i) => Math.min(i + 1, totalSteps - 1));
  };
  const handleBack = () => setStepIndex((i) => Math.max(i - 1, 0));

  const progressPct = useMemo(() => Math.round(((stepIndex + 1) / totalSteps) * 100), [stepIndex, totalSteps]);

  if (!open) return null;

  return (
    <>
      <style jsx global>{`
        .wt-scrim {
          position: fixed; inset: 0; background: rgba(17, 17, 16, 0.32);
          z-index: 60; pointer-events: auto;
        }
        .wt-spotlight {
          position: fixed; border-radius: 14px; z-index: 61;
          pointer-events: none;
          box-shadow:
            0 0 0 4px rgba(212, 80, 10, 0.18),
            0 0 0 2px #D4500A,
            0 0 0 9999px rgba(17, 17, 16, 0.32);
          transition: top .35s cubic-bezier(.22,1,.36,1), left .35s cubic-bezier(.22,1,.36,1),
                      width .35s cubic-bezier(.22,1,.36,1), height .35s cubic-bezier(.22,1,.36,1);
        }
        .wt-tip {
          position: fixed; z-index: 62; width: 340px;
          background: #fff; border: 1.5px solid #1E1E1A; border-radius: 12px;
          box-shadow: 5px 5px 0 #1E1E1A;
          display: flex; flex-direction: column;
          transition: top .35s cubic-bezier(.22,1,.36,1), left .35s cubic-bezier(.22,1,.36,1);
        }
        .wt-tip::before {
          content: ""; position: absolute; width: 14px; height: 14px; background: #fff;
          border-left: 1.5px solid #1E1E1A; border-top: 1.5px solid #1E1E1A;
        }
        .wt-tip.arrow-left::before  { left: -8px; top: 28px; transform: rotate(-45deg); }
        .wt-tip.arrow-right::before { right: -8px; top: 28px;
          border-left: none; border-top: none;
          border-right: 1.5px solid #1E1E1A; border-bottom: 1.5px solid #1E1E1A;
          transform: rotate(-45deg);
        }
        .wt-tip.arrow-top::before {
          left: 40px; top: -8px; transform: rotate(45deg);
        }
        .wt-tip.arrow-bottom::before {
          left: 40px; bottom: -8px; top: auto;
          border-left: none; border-top: none;
          border-right: 1.5px solid #1E1E1A; border-bottom: 1.5px solid #1E1E1A;
          transform: rotate(45deg);
        }
        .wt-head { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px 8px; }
        .wt-step { font-family: ui-monospace, "JetBrains Mono", monospace; font-size: 11px; color: #D4500A; font-weight: 500; letter-spacing: 0.08em; }
        .wt-close { background: none; border: none; cursor: pointer; font-size: 20px; color: #9CA3AF; line-height: 1; padding: 0 4px; }
        .wt-close:hover { color: #111110; }
        .wt-title { font-size: 17px; font-weight: 700; margin: 0; padding: 0 18px; color: #111110; }
        .wt-desc { font-size: 13px; color: #4B5563; line-height: 1.55; margin: 6px 0 14px; padding: 0 18px; }
        .wt-live-tag {
          display: inline-flex; align-items: center; gap: 4px;
          font-family: ui-monospace, "JetBrains Mono", monospace; font-size: 9px;
          color: #C2410C; background: #FFEDD5; padding: 2px 6px; border-radius: 4px;
          letter-spacing: 0.06em; margin-left: 8px; vertical-align: 1px;
        }
        .wt-live-tag::before {
          content: ""; width: 5px; height: 5px; background: #C2410C; border-radius: 50%;
          box-shadow: 0 0 0 2px rgba(194,65,12,0.2);
        }
        .wt-controls {
          padding: 6px 18px 4px; border-top: 1px dashed #F0F0EB; background: #FCFCFA;
          overflow-y: auto; flex: 1 1 auto; min-height: 0;
        }
        .wt-controls::-webkit-scrollbar { width: 6px; }
        .wt-controls::-webkit-scrollbar-thumb { background: #E5E7EB; border-radius: 3px; }
        .wt-ctl + .wt-ctl { margin-top: 12px; }
        .wt-ctl-label { font-size: 12px; font-weight: 600; color: #111110; margin: 0 0 6px; display: block; }
        .wt-toggle-row {
          display: flex; align-items: center; justify-content: space-between;
          padding: 7px 0; border-bottom: 1px solid #F0F0EB;
        }
        .wt-toggle-row:last-child { border-bottom: none; }
        .wt-toggle-meta { display: flex; flex-direction: column; gap: 1px; }
        .wt-toggle-title { font-size: 12.5px; font-weight: 500; color: #111110; }
        .wt-toggle-sub { font-size: 11px; color: #9CA3AF; }
        .wt-toggle {
          width: 34px; height: 20px; border-radius: 9999px; background: #E5E7EB;
          position: relative; cursor: pointer; transition: background .15s;
          flex-shrink: 0; border: none; padding: 0;
        }
        .wt-toggle::after {
          content: ""; position: absolute; top: 2px; left: 2px;
          width: 16px; height: 16px; border-radius: 50%; background: #fff;
          box-shadow: 0 1px 3px rgba(0,0,0,0.2); transition: left .15s;
        }
        .wt-toggle.is-on { background: #D4500A; }
        .wt-toggle.is-on::after { left: 16px; }
        .wt-progress-wrap { padding: 12px 18px 0; display: flex; align-items: center; gap: 10px; }
        .wt-progress { flex: 1; height: 4px; background: #F3F4F6; border-radius: 9999px; overflow: hidden; }
        .wt-progress span { display: block; height: 100%; background: #D4500A; transition: width .35s cubic-bezier(.22,1,.36,1); }
        .wt-progress-text { font-family: ui-monospace, "JetBrains Mono", monospace; font-size: 10px; color: #9CA3AF; font-weight: 500; }
        .wt-actions { padding: 12px 18px 16px; display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .wt-btn {
          font-family: inherit; font-size: 12px; font-weight: 600;
          padding: 8px 14px; border-radius: 7px;
          border: 1px solid transparent; cursor: pointer;
          display: inline-flex; align-items: center; gap: 6px;
        }
        .wt-btn-ghost { background: transparent; color: #6B7280; padding: 8px 10px; }
        .wt-btn-ghost:hover { color: #111110; }
        .wt-btn-outline { background: #fff; border-color: #E5E7EB; color: #111110; }
        .wt-btn-outline:hover { border-color: #111110; }
        .wt-btn-outline:disabled { color: #C9C9C4; border-color: #EEEEE8; cursor: not-allowed; }
        .wt-btn-primary { background: #111110; color: #fff; }
        .wt-btn-primary:hover { background: #1f1f1d; }
      `}</style>

      {/* Scrim — clicking it does nothing (the user must use the controls). */}
      <div className="wt-scrim" aria-hidden />

      {spotlight && (
        <div
          className="wt-spotlight"
          style={{ top: spotlight.top, left: spotlight.left, width: spotlight.width, height: spotlight.height }}
        />
      )}

      <div
        ref={tipRef}
        role="dialog"
        aria-modal
        aria-labelledby="wt-tip-title"
        className={`wt-tip arrow-${tipPos?.arrow ?? "left"}`}
        style={{
          top: tipPos?.top ?? 80,
          left: tipPos?.left ?? 80,
          maxHeight: tipPos?.maxHeight ?? "70vh",
        }}
      >
        <div className="wt-head">
          <span className="wt-step">
            STEP {stepIndex + 1} OF {totalSteps}
          </span>
          <button className="wt-close" onClick={onClose} aria-label="Exit walkthrough">
            ×
          </button>
        </div>
        <h4 id="wt-tip-title" className="wt-title">
          {step.title}
        </h4>
        <p className="wt-desc">
          {step.desc}
          <span className="wt-live-tag">LIVE</span>
        </p>
        <div className="wt-controls">{step.renderControls(prefs, updatePrefs)}</div>
        <div className="wt-progress-wrap">
          <span className="wt-progress-text">
            {stepIndex + 1}/{totalSteps}
          </span>
          <div className="wt-progress">
            <span style={{ width: `${progressPct}%` }} />
          </div>
        </div>
        <div className="wt-actions">
          <button className="wt-btn wt-btn-ghost" onClick={handleNext} type="button">
            Skip this
          </button>
          <div style={{ display: "flex", gap: 6 }}>
            <button className="wt-btn wt-btn-outline" onClick={handleBack} disabled={isFirst} type="button">
              ← Back
            </button>
            <button className="wt-btn wt-btn-primary" onClick={handleNext} type="button">
              {isLast ? "Finish ✓" : "Next →"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
