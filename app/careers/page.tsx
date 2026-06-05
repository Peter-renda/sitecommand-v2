"use client";

import Navbar from "../components/Navbar";

const roles = [
  {
    title: "Head of Growth",
    description:
      "Owns sales and marketing together. Finds customers, closes them, and builds the pipeline.",
  },
  {
    title: "Lead Engineer",
    description:
      "Your right hand on the product. Ships features, maintains the platform, and helps define the technical roadmap.",
  },
  {
    title: "Customer Success Lead",
    description:
      "Makes sure every customer gets value fast and stays long term.",
  },
  {
    title: "Construction Industry Advisor",
    description:
      "A seasoned GC or PM who lends credibility, opens doors, and keeps the product grounded in how the industry actually works.",
  },
  {
    title: "Operations & Finance Manager",
    description:
      "Handles the business side so nothing falls through the cracks as you scale.",
  },
];

export default function CareersPage() {
  return (
    <div className="min-h-screen" style={{ background: "#FAFAF9" }}>
      <Navbar />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 pt-20 pb-20">
        {/* Hero */}
        <div className="mb-12">
          <span className="inline-flex items-center gap-2 mb-6 animate-fade-up">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#2563EB" }} />
            <span className="text-xs font-medium tracking-widest text-gray-400 uppercase">Join the team</span>
          </span>
          <h1
            className="font-display text-5xl sm:text-6xl leading-[1.05] mb-5 animate-fade-up"
            style={{
              letterSpacing: "-0.03em",
              color: "#111110",
              animationDelay: "100ms",
            }}
          >
            Careers
          </h1>
          <p className="text-base text-gray-500 leading-relaxed max-w-xl animate-fade-up" style={{ animationDelay: "200ms" }}>
            We&apos;re building the construction management platform that contractors actually want
            to use. If that sounds like something you want to be part of, we&apos;d love to hear
            from you.
          </p>
        </div>

        {/* Role cards */}
        <div className="space-y-4">
          {roles.map((role) => (
            <div
              key={role.title}
              style={{
                background: "linear-gradient(145deg, rgba(255,255,255,0.95) 0%, rgba(235,235,233,0.5) 100%)",
                border: "1px solid rgba(0,0,0,0.055)",
                boxShadow: "0 2px 8px rgba(0,0,0,0.04), 0 1px 0 rgba(255,255,255,0.7) inset",
                padding: "1.5px",
                borderRadius: "16px",
              }}
            >
              <div
                style={{
                  background: "#FFFFFF",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9)",
                  borderRadius: "14px",
                  padding: "20px 24px",
                }}
                className="flex items-start justify-between gap-6"
              >
                <div>
                  <h2 className="text-sm font-semibold text-gray-900 mb-1">{role.title}</h2>
                  <p className="text-sm text-gray-500 leading-relaxed">{role.description}</p>
                </div>
                <a
                  href={`mailto:careers@sitecommand.com?subject=Application: ${encodeURIComponent(role.title)}`}
                  className="shrink-0 px-3 py-1.5 border border-gray-200 rounded-xl text-xs font-medium text-gray-600 hover:bg-white hover:border-gray-300 transition-all"
                >
                  Apply
                </a>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-10 text-sm text-gray-400">
          Don&apos;t see your role?{" "}
          <a
            href="mailto:careers@sitecommand.com"
            className="text-gray-600 hover:text-gray-900 underline underline-offset-2 transition-colors"
          >
            Reach out anyway.
          </a>
        </p>
      </main>

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
