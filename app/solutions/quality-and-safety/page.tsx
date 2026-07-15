import Navbar from "../../components/Navbar";
import Link from "next/link";

const features = [
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
    name: "Inspections & Checklists",
    description:
      "Build custom inspection templates once and deploy them across every project. Field teams complete checklists on their phone — results are logged instantly with photos and GPS.",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
    name: "Incident Reporting",
    description:
      "Log near-misses, injuries, and property damage from the field the moment they happen. Auto-route reports to the right people and maintain a complete OSHA-ready record.",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      </svg>
    ),
    name: "Observations",
    description:
      "Capture positive and negative observations on-site with photos and notes. Assign corrective actions with due dates so nothing falls through the cracks.",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    name: "Toolbox Talks",
    description:
      "Schedule, deliver, and document safety meetings digitally. Collect attendee signatures on-site and store a time-stamped record for every talk — no paper forms required.",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
      </svg>
    ),
    name: "Non-Conformance Reports",
    description:
      "Flag quality defects the moment they're found. Attach drawings, photos, and spec references, then track each NCR from open to resolved with a full audit trail.",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    name: "Quality Reports & Analytics",
    description:
      "See inspection pass rates, open NCRs, and incident trends across all your projects in one dashboard. Spot patterns early and prove compliance to owners and insurers.",
  },
];

const stats = [
  { value: "62%", label: "fewer recordable incidents on average" },
  { value: "3×", label: "faster inspection turnaround" },
  { value: "89%", label: "of teams catch defects before closeout" },
  { value: "100%", label: "digital — no paper, no lost forms" },
];

const faqs = [
  {
    q: "Can I build my own inspection templates?",
    a: "Yes. SiteCommand's template builder lets you create custom checklists for any trade or inspection type. Start from a blank slate or clone an existing template and adapt it for your project.",
  },
  {
    q: "Are incident reports OSHA-compliant?",
    a: "Incident reports capture all fields required by OSHA 300/301 logs. You can export a ready-to-file report at any time. We recommend reviewing with your safety officer before submission.",
  },
  {
    q: "Can subcontractors complete inspections and observations?",
    a: "Yes. External collaborators invited to a project can be granted permission to complete checklists, submit observations, and attend toolbox talks — without accessing other projects or company data.",
  },
  {
    q: "How do non-conformance reports connect to drawings?",
    a: "When you create an NCR, you can pin it directly to a location on the current drawing set. The pin stays linked to the latest revision so the field always has the right context.",
  },
  {
    q: "Is there a history of all quality and safety activity?",
    a: "Every inspection, observation, incident, and NCR is time-stamped and attributed to a user. The full activity log is always available and can be exported for owner or insurer review.",
  },
];

export default function QualityAndSafetyPage() {
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
              <span className="text-xs font-medium tracking-widest text-gray-400 uppercase">Construction · Quality &amp; Safety</span>
            </div>
            <h1 className="font-display animate-fade-up delay-100" style={{ fontSize: "clamp(2.8rem,6.5vw,5rem)", lineHeight: "0.96" }}>
              Build safer.<br /><em className="not-italic" style={{ color: "#C0C0BC" }}>Deliver quality.</em>
            </h1>
            <p className="animate-fade-up delay-200 mt-7 text-lg text-gray-500 max-w-md leading-relaxed">
              Catch defects before they become rework and prevent incidents before
              they happen — with inspections, observations, and reporting built
              for the field.
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
              Understand, predict,<br />and correct — in real time.
            </h2>
            <p className="text-lg text-gray-500 leading-relaxed mb-4">
              Quality and safety issues rarely appear without warning. SiteCommand
              gives your team the tools to capture observations the moment they
              happen, route them to the right people, and close them out before
              they escalate into rework, delays, or injuries.
            </p>
            <p className="text-lg text-gray-500 leading-relaxed">
              From pre-pour inspections to final punch lists, every check is
              documented, time-stamped, and tied to the right drawing or spec
              — so you always have proof of what was verified and when.
            </p>
          </div>
          <div className="rounded-2xl" style={{ background: "linear-gradient(145deg, rgba(255,255,255,0.95) 0%, rgba(235,235,233,0.5) 100%)", border: "1px solid rgba(0,0,0,0.055)", boxShadow: "0 2px 8px rgba(0,0,0,0.04), 0 1px 0 rgba(255,255,255,0.7) inset", padding: "1.5px" }}>
            <div className="rounded-[14px] p-8 space-y-4" style={{ background: "#FFFFFF", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9)" }}>
              {[
                "Custom inspection templates for any trade or phase",
                "Field-ready on any mobile device or browser",
                "Role-based access for owners, subs & inspectors",
                "Automatic routing of corrective actions",
                "Full audit trail for every observation and incident",
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
            Everything you need to protect your people and your project
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
            From first inspection to final sign-off
          </h2>
          <div className="grid md:grid-cols-3 gap-10">
            {[
              {
                step: "01",
                title: "Set up your safety program",
                body: "Create inspection templates, configure incident categories, and assign roles. Bring subs and inspectors into the project with the right level of access.",
              },
              {
                step: "02",
                title: "Capture issues in the field",
                body: "Complete checklists, log observations, and report incidents from a phone — with photos, GPS, and drawing pins — the moment something is found.",
              },
              {
                step: "03",
                title: "Resolve and report with confidence",
                body: "Auto-route corrective actions, track NCRs to closure, and export a clean safety and quality record for owners, insurers, or regulators.",
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
            <p className="text-sm text-gray-500">Schedule a 20-minute walkthrough. No slides — just live software on a real project.</p>
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
                <h2 className="text-4xl sm:text-5xl font-display text-gray-950 leading-tight">Build safer projects, starting today</h2>
                <p className="mt-5 text-lg text-gray-400 max-w-md mx-auto">
                  Join hundreds of contractors who've moved from paper forms and
                  email chains to one platform built for the field.
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
