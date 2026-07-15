import Navbar from "../../components/Navbar";
import Link from "next/link";

const features = [
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
      </svg>
    ),
    name: "Gantt Charts & Lookaheads",
    description:
      "Visualize your full project schedule in a drag-and-drop Gantt view. Generate two-week lookaheads for field crews so everyone knows exactly what's coming and when.",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
      </svg>
    ),
    name: "Import from P6 & MS Project",
    description:
      "Already have a schedule? Import directly from Primavera P6 or Microsoft Project. Your baseline comes in clean — no reformatting, no data loss.",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    name: "Milestone Tracking",
    description:
      "Define key milestones and track progress against them. Get automatic alerts when a milestone is at risk so you can act before the delay cascades downstream.",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    name: "Planned vs. Actual Progress",
    description:
      "Compare where you planned to be against where you actually are — at the task, phase, or project level. Spot slippage early and update the plan before it costs you.",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
      </svg>
    ),
    name: "Linked to RFIs & Submittals",
    description:
      "Connect schedule activities directly to open RFIs, submittals, and observations. When a document is holding up a task, it's visible — not buried in someone's inbox.",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    name: "Team Task Assignments",
    description:
      "Assign tasks to individuals or crews, set due dates, and let the field update progress from their phone. The schedule stays current without a single status meeting.",
  },
];

const stats = [
  { value: "38%", label: "fewer schedule overruns reported" },
  { value: "2×", label: "faster lookahead distribution" },
  { value: "91%", label: "of PMs say fewer missed milestones" },
  { value: "1 platform", label: "for schedule, RFIs, docs & more" },
];

const faqs = [
  {
    q: "Can I import my existing P6 or MS Project schedule?",
    a: "Yes. SiteCommand accepts direct imports from Primavera P6 (.xer) and Microsoft Project (.mpp / .xml). Your baseline activities, predecessors, and durations all come in with the import.",
  },
  {
    q: "Can subcontractors and field crews view the schedule?",
    a: "Absolutely. Anyone with project access can view the schedule and update task progress from a mobile browser. Subs see only what's relevant to their scope unless you grant broader access.",
  },
  {
    q: "How does SiteCommand handle schedule delays?",
    a: "When an activity slips past its planned date, SiteCommand flags it automatically and shows the downstream impact on dependent tasks. You can update the baseline and communicate the change to the team in one step.",
  },
  {
    q: "Can I link schedule delays to specific RFIs or submittals?",
    a: "Yes. Schedule activities can be linked to open RFIs, submittals, and observations. This makes it easy to show owners and insurers exactly why a task was delayed — with a full audit trail.",
  },
  {
    q: "Is there a portfolio view across multiple projects?",
    a: "SiteCommand's dashboard gives company admins a cross-project view of milestone status and schedule health. Per-project detail is always one click away.",
  },
];

export default function SchedulePage() {
  return (
    <div className="min-h-dvh" style={{ background: "#FAFAF9" }}>
      <Navbar />

      {/* Hero */}
      <section className="relative overflow-hidden pt-20 pb-20 px-6 sm:px-10">
        <div className="absolute inset-0 -z-10 pointer-events-none" style={{ background: "radial-gradient(ellipse 60% 50% at 65% 25%, rgba(212,80,10,0.05) 0%, transparent 65%)" }} />
        <div className="max-w-7xl mx-auto">
          <div className="max-w-3xl">
            <div className="animate-fade-up inline-flex items-center gap-2 mb-8">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#2563EB" }} />
              <span className="text-xs font-medium tracking-widest text-gray-400 uppercase">Construction · Schedule</span>
            </div>
            <h1 className="font-display animate-fade-up delay-100" style={{ fontSize: "clamp(2.8rem,6.5vw,5rem)", lineHeight: "0.96" }}>
              Keep the field on<br /><em className="not-italic" style={{ color: "#C0C0BC" }}>the same plan.</em>
            </h1>
            <p className="animate-fade-up delay-200 mt-7 text-lg text-gray-500 max-w-md leading-relaxed">
              Build schedules that connect planning to execution — with real-time
              updates, lookaheads, and delay tracking that keeps every crew,
              trade, and stakeholder aligned.
            </p>
            <div className="animate-fade-up delay-300 mt-10 flex flex-wrap items-center gap-3">
              <Link href="/pricing" className="group relative inline-flex items-center px-7 py-3.5 text-sm font-semibold text-white rounded-xl overflow-hidden active:scale-[0.98]" style={{ background: "#111110" }}>
                <span className="relative z-10">Get started free</span>
                <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-[0.08] transition-opacity" />
              </Link>
              <Link href="/demo" className="inline-flex items-center gap-2 px-7 py-3.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:border-gray-300 hover:bg-white active:scale-[0.98]" style={{ background: "rgba(255,255,255,0.6)" }}>
                See a demo <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Strip */}
      <section className="border-y py-12 px-6 sm:px-10" style={{ borderColor: "rgba(0,0,0,0.06)", background: "#FFFFFF" }}>
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((s) => (
            <div key={s.label} className="flex flex-col gap-1">
              <span className="text-3xl font-display tabular-nums text-gray-950">{s.value}</span>
              <span className="text-sm text-gray-400">{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Intro 2-col */}
      <section className="py-20 px-6 sm:px-10" style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-16 items-center">
          <div>
            <h2 className="text-4xl font-display text-gray-950 leading-tight mb-6">
              Work confidently with<br />one version of the truth.
            </h2>
            <p className="text-lg text-gray-500 leading-relaxed mb-4">
              Version-controlled spreadsheets and emailed Gantt PDFs create
              confusion on every project. SiteCommand keeps a single live
              schedule that everyone — from the PM to the sub — is always
              looking at the same plan.
            </p>
            <p className="text-lg text-gray-500 leading-relaxed">
              Link delays back to open RFIs and submittals, compare planned
              vs. actual progress at any level, and push updated lookaheads
              to the field in seconds — no reprinting, no re-emailing.
            </p>
          </div>
          <div className="rounded-2xl" style={{ background: "linear-gradient(145deg, rgba(255,255,255,0.95) 0%, rgba(235,235,233,0.5) 100%)", border: "1px solid rgba(0,0,0,0.055)", boxShadow: "0 2px 8px rgba(0,0,0,0.04), 0 1px 0 rgba(255,255,255,0.7) inset", padding: "1.5px" }}>
            <div className="rounded-[14px] p-8 space-y-4" style={{ background: "#FFFFFF", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9)" }}>
              {[
                "Gantt, milestone, and calendar views",
                "Import from Primavera P6 and MS Project",
                "Field-ready on any mobile device or browser",
                "Delays linked to RFIs, submittals & observations",
                "Role-based access for owners, subs & inspectors",
              ].map((point) => (
                <div key={point} className="flex items-start gap-3">
                  <svg className="w-5 h-5 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: "#2563EB" }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm text-gray-700">{point}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-6 sm:px-10" style={{ borderTop: "1px solid rgba(0,0,0,0.06)", background: "#FAFAF9" }}>
        <div className="max-w-7xl mx-auto">
          <span className="text-xs font-semibold tracking-widest text-gray-400 uppercase">Core capabilities</span>
          <h2 className="mt-3 text-3xl sm:text-4xl font-display text-gray-950 mb-14">
            Everything you need to plan, track, and deliver on time
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {features.map((f) => (
              <div key={f.name} className="rounded-2xl" style={{ background: "linear-gradient(145deg, rgba(255,255,255,0.95) 0%, rgba(235,235,233,0.5) 100%)", border: "1px solid rgba(0,0,0,0.055)", boxShadow: "0 2px 8px rgba(0,0,0,0.04), 0 1px 0 rgba(255,255,255,0.7) inset", padding: "1.5px" }}>
                <div className="h-full rounded-[14px] p-6 flex flex-col gap-4" style={{ background: "#FFFFFF", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9)" }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(37,99,235,0.08)" }}>
                    <div style={{ color: "#2563EB" }}>{f.icon}</div>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-1.5">{f.name}</h3>
                    <p className="text-sm text-gray-500 leading-relaxed">{f.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-6 sm:px-10" style={{ borderTop: "1px solid rgba(0,0,0,0.06)", background: "#FFFFFF" }}>
        <div className="max-w-7xl mx-auto">
          <span className="text-xs font-semibold tracking-widest text-gray-400 uppercase">How it works</span>
          <h2 className="mt-3 text-3xl font-display text-gray-950 mb-14 max-w-lg">
            From baseline to closeout
          </h2>
          <div className="grid md:grid-cols-3 gap-10">
            {[
              {
                step: "01",
                title: "Build or import your schedule",
                body: "Start from scratch in SiteCommand or import your existing P6 or MS Project file. Assign activities, set predecessors, and publish the baseline to the whole team.",
              },
              {
                step: "02",
                title: "Update progress in the field",
                body: "Field crews log task completion from their phone. The schedule updates in real time — no manual syncing, no status meetings to collect numbers.",
              },
              {
                step: "03",
                title: "Track delays and recover fast",
                body: "See planned vs. actual at a glance, trace delays to their root cause, and push a revised lookahead to the field before the next shift starts.",
              },
            ].map((item) => (
              <div key={item.step} className="flex flex-col gap-4">
                <div className="inline-flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#2563EB" }} />
                  <span className="text-xs font-bold tracking-widest text-gray-400 uppercase">{item.step}</span>
                </div>
                <h3 className="text-base font-semibold text-gray-900">{item.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Mid-page CTA */}
      <section className="py-16 px-6 sm:px-10" style={{ background: "#F5F0EC", borderTop: "1px solid rgba(0,0,0,0.06)", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          <div className="max-w-xl">
            <h2 className="text-2xl font-display text-gray-950 mb-2">See SiteCommand on your next project</h2>
            <p className="text-sm text-gray-500">Schedule a 20-minute walkthrough with our team. No slides — just live software on a real project.</p>
          </div>
          <div className="flex gap-3 flex-wrap shrink-0">
            <Link href="/demo" className="group relative inline-flex items-center px-7 py-3.5 text-sm font-semibold text-white rounded-xl overflow-hidden active:scale-[0.98]" style={{ background: "#111110" }}>
              <span className="relative z-10">Explore the Demo</span>
              <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-[0.08] transition-opacity" />
            </Link>
            <Link href="/pricing" className="px-7 py-3.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-white transition-all">View pricing</Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 px-6 sm:px-10" style={{ borderTop: "1px solid rgba(0,0,0,0.06)", background: "#FFFFFF" }}>
        <div className="max-w-3xl mx-auto">
          <span className="text-xs font-semibold tracking-widest text-gray-400 uppercase">FAQ</span>
          <h2 className="mt-3 text-3xl font-display text-gray-950 mb-12">Common questions</h2>
          <div className="divide-y" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
            {faqs.map((faq) => (
              <div key={faq.q} className="py-6">
                <h3 className="font-semibold text-gray-900 mb-2">{faq.q}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-24 px-6 sm:px-10" style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>
        <div className="max-w-7xl mx-auto">
          <div className="rounded-3xl" style={{ background: "linear-gradient(145deg, rgba(255,255,255,0.95) 0%, rgba(235,235,233,0.5) 100%)", border: "1px solid rgba(0,0,0,0.055)", boxShadow: "0 4px 16px rgba(0,0,0,0.05), 0 1px 0 rgba(255,255,255,0.7) inset", padding: "2px" }}>
            <div className="rounded-[22px] px-10 py-20 text-center relative overflow-hidden" style={{ background: "#FFFFFF", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9)" }}>
              <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 70% 60% at 50% 0%, rgba(212,80,10,0.04) 0%, transparent 70%)" }} />
              <div className="relative">
                <span className="inline-flex items-center gap-2 mb-6">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#2563EB" }} />
                  <span className="text-xs font-medium tracking-widest text-gray-400 uppercase">Get started today</span>
                </span>
                <h2 className="text-4xl sm:text-5xl font-display text-gray-950 leading-tight">Deliver your next project on time</h2>
                <p className="mt-5 text-lg text-gray-400 max-w-md mx-auto">
                  Join hundreds of contractors who've replaced static spreadsheets
                  with a live schedule the whole team can trust.
                </p>
                <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
                  <Link href="/pricing" className="group relative inline-flex items-center px-8 py-4 text-sm font-semibold text-white rounded-xl overflow-hidden active:scale-[0.98]" style={{ background: "#111110" }}>
                    <span className="relative z-10">Get started free</span>
                    <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-[0.08] transition-opacity" />
                  </Link>
                  <Link href="/demo" className="px-8 py-4 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 active:scale-[0.98]">Explore the Demo</Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 px-6 sm:px-10" style={{ borderTop: "1px solid rgba(0,0,0,0.06)", background: "#FAFAF9" }}>
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <span className="text-sm font-semibold text-gray-900">SiteCommand</span>
          <div className="flex flex-wrap gap-6 text-xs text-gray-400">
            <a href="/pricing" className="hover:text-gray-700 transition-colors">Pricing</a>
            <a href="/demo" className="hover:text-gray-700 transition-colors">Demo</a>
            <a href="#" className="hover:text-gray-700 transition-colors">Privacy policy</a>
            <a href="#" className="hover:text-gray-700 transition-colors">Terms of service</a>
          </div>
          <p className="text-xs text-gray-400">&copy; {new Date().getFullYear()} SiteCommand</p>
        </div>
      </footer>
    </div>
  );
}
