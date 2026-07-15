import Link from "next/link";
import Navbar from "../components/Navbar";
import { caseStudies } from "./data";
import ROICalculator from "./roi-calculator";

function ConstructionPlaceholder() {
  return (
    <div
      className="w-full h-48 flex items-center justify-center"
      style={{ background: "linear-gradient(135deg, #F5F0EC 0%, #EDE8E3 100%)" }}
    >
      <svg
        className="w-12 h-12"
        style={{ color: "#2563EB", opacity: 0.4 }}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z"
        />
      </svg>
    </div>
  );
}

export default function CaseStudiesPage() {
  return (
    <div className="min-h-screen" style={{ background: "#FAFAF9" }}>
      <Navbar />

      <main className="max-w-6xl mx-auto px-6 pt-24 pb-24">
        {/* Hero */}
        <div className="mb-20">
          <div className="inline-flex items-center gap-2 mb-8 animate-fade-up">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#2563EB" }} />
            <span className="text-xs font-medium tracking-widest text-gray-400 uppercase">Case Studies</span>
          </div>

          <h1
            className="text-5xl md:text-6xl leading-[1.08] tracking-tight mb-6 animate-fade-up delay-100"
            style={{ color: "#111110" }}
          >
            Real results from
            <br />
            <em className="not-italic" style={{ color: "#C0C0BC" }}>real job sites.</em>
          </h1>

          <p className="text-lg text-gray-500 max-w-xl leading-relaxed animate-fade-up delay-200">
            General contractors, developers, and specialty subcontractors are using SiteCommand to
            close projects faster, cut administrative overhead, and protect their margins.
          </p>
        </div>

        {/* Case study cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-24">
          {caseStudies.map((study) => (
            <div
              key={study.slug}
              className="rounded-2xl overflow-hidden flex flex-col bg-white transition-shadow hover:shadow-md"
              style={{ border: "1px solid rgba(0,0,0,0.07)", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
            >
              <ConstructionPlaceholder />

              <div className="p-6 flex flex-col flex-1">
                <div className="mb-3">
                  <span
                    className="inline-block text-xs font-medium rounded-full px-2.5 py-0.5"
                    style={{ background: "rgba(37,99,235,0.08)", color: "#2563EB", border: "1px solid rgba(37,99,235,0.15)" }}
                  >
                    {study.companyType}
                  </span>
                </div>

                <div className="mb-3">
                  <p
                    className="text-3xl tracking-tight"
                    style={{ color: "#111110" }}
                  >
                    {study.headlineStat}
                  </p>
                  <p className="text-sm text-gray-500">{study.headlineStatLabel}</p>
                </div>

                <p className="text-sm text-gray-500 leading-relaxed flex-1 mb-5">
                  {study.shortDescription}
                </p>

                <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                  <div>
                    <p className="text-xs font-semibold" style={{ color: "#111110" }}>{study.companyName}</p>
                    <p className="text-xs text-gray-400">{study.location}</p>
                  </div>
                  <Link
                    href={`/case-studies/${study.slug}`}
                    className="text-sm font-medium transition-colors hover:opacity-70 whitespace-nowrap"
                    style={{ color: "#111110" }}
                  >
                    Read case study →
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ROI Calculator */}
        <ROICalculator />

        {/* Bottom CTA — double-bezel */}
        <div className="mt-24">
          <div
            className="rounded-3xl p-px"
            style={{
              background: "linear-gradient(135deg, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0.03) 100%)",
              border: "1px solid rgba(0,0,0,0.055)",
            }}
          >
            <div
              className="rounded-3xl px-12 py-16 text-center"
              style={{
                background: "#111110",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
              }}
            >
              <h2
                className="text-3xl md:text-4xl text-white mb-4"
               
              >
                Ready to see results like these?
              </h2>
              <p className="text-gray-400 mb-10 max-w-md mx-auto">
                Join contractors who have replaced spreadsheets and email threads with a single platform
                built for how construction actually works.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  href="/signup"
                  className="px-6 py-3 text-sm font-medium text-gray-900 bg-white rounded-lg hover:opacity-90 transition-opacity"
                >
                  Start free trial
                </Link>
                <Link
                  href="/pricing"
                  className="px-6 py-3 text-sm font-medium text-white border border-white/20 rounded-lg hover:bg-white/10 transition-colors"
                >
                  View pricing
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-gray-100">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <span className="text-sm font-medium" style={{ color: "#111110" }}>SiteCommand</span>
          <p className="text-xs text-gray-400">© {new Date().getFullYear()} SiteCommand. All rights reserved.</p>
          <div className="flex gap-6">
            <Link href="/pricing" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">Pricing</Link>
            <Link href="/about" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">About</Link>
            <Link href="/login" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">Sign in</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
