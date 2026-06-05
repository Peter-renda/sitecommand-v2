import Navbar from "../components/Navbar";
import Link from "next/link";

const values = [
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
    title: "Built in the field",
    body: "Our founders spent years running construction projects before writing a single line of code. We know what a busy jobsite actually looks like.",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    title: "Priced for real contractors",
    body: "Enterprise software vendors charge enterprise prices. We don't. Simple, transparent plans — no hidden fees, no seat minimums, no sales calls to get a number.",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
      </svg>
    ),
    title: "Simple by design",
    body: "The best idea is often the simplest one. We strip out everything that doesn't directly help a GC run a better project — so your team actually uses the software.",
  },
];

export default function AboutPage() {
  return (
    <div className="min-h-dvh" style={{ background: "#FAFAF9" }}>
      <Navbar />

      {/* Hero */}
      <section className="relative flex flex-col items-start justify-center min-h-[70vh] px-6 sm:px-10 max-w-7xl mx-auto">
        <div
          className="absolute inset-0 -z-10 pointer-events-none"
          aria-hidden="true"
          style={{
            background:
              "radial-gradient(ellipse 70% 60% at 60% 40%, rgba(212,80,10,0.06) 0%, transparent 70%)",
          }}
        />
        <div className="max-w-3xl pt-20 pb-20">
          <span className="inline-flex items-center gap-2 mb-8 animate-fade-up">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#2563EB" }} />
            <span className="text-xs font-medium tracking-widest text-gray-400 uppercase">About SiteCommand</span>
          </span>
          <h1
            className="font-display text-6xl sm:text-7xl leading-[1.05] animate-fade-up"
            style={{ letterSpacing: "-0.03em", color: "#111110", animationDelay: "100ms" }}
          >
            Software built by<br />
            <em className="not-italic" style={{ color: "#C0C0BC" }}>people who build.</em>
          </h1>
          <p className="mt-8 text-xl text-gray-500 max-w-xl leading-relaxed animate-fade-up" style={{ animationDelay: "200ms" }}>
            We started SiteCommand because we got tired of paying too much for
            software that was too complicated. There's a better way — and it
            starts with keeping things simple.
          </p>
        </div>
      </section>

      {/* Mission */}
      <section className="py-20 px-6 sm:px-10" style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-16 items-center">
          <div>
            <span className="inline-flex items-center gap-2 mb-4">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#2563EB" }} />
              <span className="text-xs font-medium tracking-widest text-gray-400 uppercase">Our mission</span>
            </span>
            <h2
              className="text-4xl font-bold leading-tight mb-6"
              style={{ letterSpacing: "-0.02em", color: "#111110" }}
            >
              Save general contractors<br />$1 billion — together.
            </h2>
            <p className="text-lg text-gray-500 leading-relaxed mb-4">
              Construction software has gotten expensive, bloated, and
              complicated. GCs are paying for features they'll never use and
              seats they don't need — just to manage a project that's already
              hard enough.
            </p>
            <p className="text-lg text-gray-500 leading-relaxed">
              We believe the best software is the software your whole crew
              actually uses. SiteCommand is built to be simple enough for the
              field, powerful enough for the office, and priced so it pays for
              itself on the first project.
            </p>
          </div>

          {/* Dark bezel card */}
          <div style={{
            background: "linear-gradient(145deg, rgba(30,30,28,0.95) 0%, rgba(17,17,16,0.95) 100%)",
            border: "1px solid rgba(255,255,255,0.08)",
            boxShadow: "0 2px 8px rgba(0,0,0,0.18), 0 1px 0 rgba(255,255,255,0.06) inset",
            padding: "1.5px",
            borderRadius: "16px",
          }}>
            <div style={{
              background: "#111110",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
              borderRadius: "14px",
              padding: "40px",
            }} className="flex flex-col gap-6">
              <div>
                <span
                  className="text-5xl font-bold text-white block mb-2"
                  style={{ letterSpacing: "-0.03em" }}
                >
                  $1B
                </span>
                <span className="text-gray-400 text-sm">our goal — saved by contractors switching to SiteCommand</span>
              </div>
              <div className="pt-6" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                <p className="text-gray-300 text-base leading-relaxed">
                  "Sometimes the best idea is the simplest one. We don't need
                  more features — we need software that gets out of the way and
                  lets contractors build."
                </p>
                <p className="mt-4 text-sm text-gray-500">— SiteCommand founding team</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-20 px-6 sm:px-10" style={{ borderTop: "1px solid rgba(0,0,0,0.06)", background: "#FAFAF9" }}>
        <div className="max-w-7xl mx-auto">
          <span className="inline-flex items-center gap-2 mb-4">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#2563EB" }} />
            <span className="text-xs font-medium tracking-widest text-gray-400 uppercase">What we believe</span>
          </span>
          <h2
            className="text-3xl font-bold mb-14"
            style={{ letterSpacing: "-0.02em", color: "#111110" }}
          >
            Three ideas that drive everything we build
          </h2>
          <div className="grid sm:grid-cols-3 gap-8">
            {values.map((v) => (
              <div
                key={v.title}
                style={{
                  background: "linear-gradient(145deg, rgba(255,255,255,0.95) 0%, rgba(235,235,233,0.5) 100%)",
                  border: "1px solid rgba(0,0,0,0.055)",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.04), 0 1px 0 rgba(255,255,255,0.7) inset",
                  padding: "1.5px",
                  borderRadius: "16px",
                }}
              >
                <div style={{
                  background: "#FFFFFF",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9)",
                  borderRadius: "14px",
                  padding: "24px",
                }} className="flex flex-col gap-4 h-full">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ background: "rgba(37,99,235,0.08)", color: "#2563EB" }}
                  >
                    {v.icon}
                  </div>
                  <h3 className="font-semibold text-gray-900">{v.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{v.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Story */}
      <section className="py-20 px-6 sm:px-10" style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>
        <div className="max-w-3xl mx-auto">
          <span className="inline-flex items-center gap-2 mb-4">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#2563EB" }} />
            <span className="text-xs font-medium tracking-widest text-gray-400 uppercase">Our story</span>
          </span>
          <h2
            className="text-3xl font-bold mb-8"
            style={{ letterSpacing: "-0.02em", color: "#111110" }}
          >
            We've been on your jobsite.
          </h2>
          <div className="space-y-5 text-lg text-gray-500 leading-relaxed">
            <p>
              SiteCommand started with a simple frustration: the existing tools
              were either too expensive, too complicated, or built for someone
              else's workflow. General contractors were duct-taping together
              spreadsheets, email threads, and overpriced enterprise platforms
              just to run a single project.
            </p>
            <p>
              We set out to build something different — software that works the
              way a construction project actually works. Fast to set up, easy
              to use in the field, and priced fairly for contractors of every
              size.
            </p>
            <p>
              Our goal is straightforward: help GCs save money without
              sacrificing the visibility, accountability, and documentation
              they need to build great projects and protect their business.
            </p>
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-24 px-6 sm:px-10" style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>
        <div className="max-w-7xl mx-auto">
          <div className="rounded-3xl" style={{
            background: "linear-gradient(145deg, rgba(255,255,255,0.95) 0%, rgba(235,235,233,0.5) 100%)",
            border: "1px solid rgba(0,0,0,0.055)",
            boxShadow: "0 4px 16px rgba(0,0,0,0.05), 0 1px 0 rgba(255,255,255,0.7) inset",
            padding: "2px",
          }}>
            <div className="rounded-[22px] px-10 py-20 text-center relative overflow-hidden" style={{
              background: "#FFFFFF",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9)",
            }}>
              <div className="absolute inset-0 pointer-events-none" aria-hidden="true" style={{
                background: "radial-gradient(ellipse 70% 60% at 50% 0%, rgba(212,80,10,0.04) 0%, transparent 70%)",
              }} />
              <div className="relative">
                <span className="inline-flex items-center gap-2 mb-6">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#2563EB" }} />
                  <span className="text-xs font-medium tracking-widest text-gray-400 uppercase">Get started today</span>
                </span>
                <h2 className="text-4xl sm:text-5xl font-display text-gray-950 leading-tight">Ready to simplify your next project?</h2>
                <p className="mt-5 text-lg text-gray-400 max-w-md mx-auto leading-relaxed">Join hundreds of contractors who've replaced scattered tools with one platform built for the field.</p>
                <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
                  <Link href="/pricing" className="group relative inline-flex items-center px-8 py-4 text-sm font-semibold text-white rounded-xl overflow-hidden transition-all active:scale-[0.98]" style={{ background: "#111110" }}>
                    <span className="relative z-10">Get started free</span>
                    <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-[0.08] transition-opacity" />
                  </Link>
                  <Link href="/demo" className="px-8 py-4 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl transition-all hover:border-gray-300 hover:bg-gray-50 active:scale-[0.98]">Watch a demo</Link>
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
