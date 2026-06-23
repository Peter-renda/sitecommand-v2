/**
 * Persistent banner shown across every tool page of a "SiteCommand Training"
 * sandbox project, so it's always obvious this is a practice environment and not
 * a real project. Links back to the Training hub to exit.
 */
export default function TrainingBanner() {
  return (
    <div className="w-full bg-amber-500 text-white text-xs sm:text-[13px] font-medium px-4 py-1.5 flex items-center justify-center gap-2 text-center">
      <span aria-hidden>🎓</span>
      <span>
        SiteCommand Training — this is a sandbox project. Anything you do here is for practice only.
      </span>
      <a href="/training/practice" className="underline whitespace-nowrap hover:text-amber-100">
        Exit to Training
      </a>
    </div>
  );
}
