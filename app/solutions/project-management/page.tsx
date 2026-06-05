import Navbar from "../../components/Navbar";
import Link from "next/link";

const features = [
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
    name: "RFI Management",
    description:
      "Create, assign, and track requests for information from open to closed. Every response is logged and tied to the right drawing or spec section — no more lost emails.",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    name: "Submittals",
    description:
      "Manage the full submittal workflow — from subcontractor submission to engineer approval — with automatic revision tracking and due-date alerts.",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    name: "Schedule Tracking",
    description:
      "Keep the whole team aligned on milestones. Compare planned vs. actual progress, flag delays early, and share live updates without a single spreadsheet.",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    name: "Daily Logs",
    description:
      "Record manpower, weather, equipment, and site conditions every day. Create an accurate, time-stamped record that protects you in disputes.",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    name: "Drawing Control",
    description:
      "Upload and version control your drawing sets. Everyone in the field sees the current sheet — superseded versions are archived, never deleted.",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
    name: "Punch Lists",
    description:
      "Build punch lists on-site from your phone. Assign items to subs, attach photos, and mark them complete — all before you leave the jobsite.",
  },
];

const stats = [
  { value: "43%", label: "reduction in RFI response time" },
  { value: "2×", label: "faster closeout documentation" },
  { value: "97%", label: "of teams say fewer missed deadlines" },
  { value: "400+", label: "contractors trust SiteCommand" },
];

const faqs = [
  {
    q: "Does SiteCommand work for small contractors?",
    a: "Yes. SiteCommand is built for contractors of every size. Our Starter plan covers small crews with a single active project. There's no minimum seat count.",
  },
  {
    q: "Can subcontractors and owners access the platform?",
    a: "Absolutely. External collaborators can be invited to a specific project to respond to RFIs and submittals, or given view-only access to relevant sections — without seeing any other project or company data.",
  },
  {
    q: "Is everything accessible in the field without Wi-Fi?",
    a: "SiteCommand is a cloud-first platform that works on any mobile browser. Offline support for daily logs and punch lists is on our near-term roadmap.",
  },
  {
    q: "How does drawing versioning work?",
    a: "When you upload a new drawing revision, the previous version is automatically archived. The field team always sees the current set by default, and you can access any prior revision at any time.",
  },
  {
    q: "Can I migrate my existing RFIs and submittals into SiteCommand?",
    a: "Yes. We offer a guided onboarding process and CSV / Excel import for existing logs. Enterprise customers get a dedicated onboarding specialist.",
  },
];

export default function ProjectManagementPage() {
  return (
    <div className="min-h-dvh" style={{ background: "#FAFAF9" }}>
      <Navbar />

      {/* Hero */}
      <section className="relative overflow-hidden pt-20 pb-20 px-6 sm:px-10">
        <div className="absolute inset-0 -z-10 pointer-events-none" style={{
          background: "radial-gradient(ellipse 60% 50% at 65% 25%, rgba(212,80,10,0.05) 0%, transparent 65%)"
        }} />
        <div className="max-w-7xl mx-auto">
          <div className="max-w-3xl">
            <div className="animate-fade-up inline-flex items-center gap-2 mb-8">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#2563EB" }} />
              <span className="text-xs font-medium tracking-widest text-gray-400 uppercase">Construction · Project Management</span>
            </div>
            <h1 className="animate-fade-up delay-100 text-[clamp(2.8rem,6.5vw,5rem)] leading-[0.96]">
              Construction project<br />
              <em className="not-italic" style={{ color: "#C0C0BC" }}>management software.</em>
            </h1>
            <p className="animate-fade-up delay-200 mt-7 text-lg text-gray-500 max-w-md leading-relaxed">
              Keep every RFI, submittal, drawing, and schedule in one place so
              your team can stop searching and start building.
            </p>
            <div className="animate-fade-up delay-300 mt-10 flex flex-wrap items-center gap-3">
              <Link
                href="/pricing"
                className="group relative inline-flex items-center px-7 py-3.5 text-sm font-semibold text-white rounded-xl overflow-hidden active:scale-[0.98]"
                style={{ background: "#111110" }}
              >
                <span className="relative z-10">Get started free</span>
                <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-[0.08] transition-opacity" />
              </Link>
              <Link
                href="/demo"
                className="px-7 py-3.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-white transition-all"
              >
                See a demo
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y py-12 px-6 sm:px-10" style={{ borderColor: "rgba(0,0,0,0.06)", background: "#FFFFFF" }}>
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((s) => (
            <div key={s.label} className="flex flex-col gap-1">
              <span className="text-3xl font-bold tabular-nums">{s.value}</span>
              <span className="text-sm text-gray-400">{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Intro paragraph */}
      <section className="py-20 px-6 sm:px-10">
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-16 items-center">
          <div>
            <h2
              className="text-4xl font-display text-gray-950 leading-tight mb-6"
             
            >
              Everything connected.<br />Nothing lost.
            </h2>
            <p className="text-lg text-gray-500 leading-relaxed mb-4">
              Construction projects generate thousands of documents, decisions,
              and conversations. SiteCommand ties them all together — so when
              something changes, everyone knows.
            </p>
            <p className="text-lg text-gray-500 leading-relaxed">
              From the first RFI to final punch list, your team works from a
              single source of truth. No more chasing emails, hunting for
              drawing revisions, or wondering who approved what.
            </p>
          </div>
          <div className="rounded-2xl" style={{ background: "linear-gradient(145deg, rgba(255,255,255,0.95) 0%, rgba(235,235,233,0.5) 100%)", border: "1px solid rgba(0,0,0,0.055)", boxShadow: "0 2px 8px rgba(0,0,0,0.04), 0 1px 0 rgba(255,255,255,0.7) inset", padding: "1.5px" }}>
            <div className="rounded-[14px] p-8 space-y-4" style={{ background: "#FFFFFF", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9)" }}>
              {[
                "Real-time updates for the whole team",
                "Field-ready on any device or browser",
                "Role-based access for owners, subs & inspectors",
                "Full audit trail on every document",
                "Integrates with your existing estimating tools",
              ].map((point) => (
                <div key={point} className="flex items-start gap-3">
                  <svg
                    className="w-5 h-5 mt-0.5 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                    style={{ color: "#2563EB" }}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm text-gray-700">{point}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features grid */}
      <section className="py-20 px-6 sm:px-10" style={{ borderTop: "1px solid rgba(0,0,0,0.06)", background: "#FAFAF9" }}>
        <div className="max-w-7xl mx-auto">
          <span className="text-xs font-semibold tracking-widest text-gray-400 uppercase">Core capabilities</span>
          <h2 className="mt-3 text-3xl font-display text-gray-950 mb-14">
            All the tools your crew needs in one platform
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

      {/* How it works */}
      <section className="py-20 px-6 sm:px-10" style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>
        <div className="max-w-7xl mx-auto">
          <div className="inline-flex items-center gap-2 mb-4">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#2563EB" }} />
            <span className="text-xs font-semibold tracking-widest text-gray-400 uppercase">How it works</span>
          </div>
          <h2
            className="text-3xl font-display text-gray-950 mb-14 max-w-lg"
           
          >
            Visibility from preconstruction to closeout
          </h2>
          <div className="grid md:grid-cols-3 gap-10">
            {[
              {
                step: "01",
                title: "Set up your project",
                body: "Create a project, add your team, and upload your drawing set. Invite external collaborators to specific sections without exposing the rest.",
              },
              {
                step: "02",
                title: "Manage in real time",
                body: "Issue RFIs, track submittals, log daily activity, and update the schedule — all from a browser or mobile device, on or off-site.",
              },
              {
                step: "03",
                title: "Close out with confidence",
                body: "Generate a complete audit trail, export punch lists, and hand over a clean document package. Every action is time-stamped and attributed.",
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
            <a href="/demo" className="group relative inline-flex items-center px-7 py-3.5 text-sm font-semibold text-white rounded-xl overflow-hidden active:scale-[0.98]" style={{ background: "#111110" }}>
              <span className="relative z-10">Explore the Demo</span>
              <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-[0.08] transition-opacity" />
            </a>
            <a href="/pricing" className="px-7 py-3.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-white transition-all">View pricing</a>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 px-6 sm:px-10" style={{ background: "#FFFFFF", borderTop: "1px solid rgba(0,0,0,0.06)" }}>
        <div className="max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 mb-4">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#2563EB" }} />
            <span className="text-xs font-semibold tracking-widest text-gray-400 uppercase">FAQ</span>
          </div>
          <h2
            className="text-3xl font-display text-gray-950 mb-12"
           
          >
            Common questions
          </h2>
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
                <h2 className="text-4xl sm:text-5xl font-display text-gray-950 leading-tight">
                  Take command of your next project
                </h2>
                <p className="mt-5 text-lg text-gray-400 max-w-md mx-auto">
                  Join hundreds of contractors who&apos;ve replaced scattered tools with
                  one platform built for the field.
                </p>
                <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
                  <a href="/pricing" className="group relative inline-flex items-center px-8 py-4 text-sm font-semibold text-white rounded-xl overflow-hidden active:scale-[0.98]" style={{ background: "#111110" }}>
                    <span className="relative z-10">Get started free</span>
                    <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-[0.08] transition-opacity" />
                  </a>
                  <a href="/demo" className="px-8 py-4 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 active:scale-[0.98]">Explore the Demo</a>
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
