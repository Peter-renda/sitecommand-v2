"use client";

import { useState } from "react";
import Navbar from "../components/Navbar";
import Link from "next/link";

const features = [
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
      </svg>
    ),
    title: "More Accurate Estimates",
    description:
      "Gain peace of mind going into projects by eliminating manual, error-prone calculations and spreadsheets. Embedded cost catalogs and historical data keep your numbers grounded in reality.",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 16.875h3.375m0 0h3.375m-3.375 0V13.5m0 3.375v3.375M6 10.5h2.25a2.25 2.25 0 002.25-2.25V6a2.25 2.25 0 00-2.25-2.25H6A2.25 2.25 0 003.75 6v2.25A2.25 2.25 0 006 10.5zm0 9.75h2.25A2.25 2.25 0 0010.5 18v-2.25a2.25 2.25 0 00-2.25-2.25H6a2.25 2.25 0 00-2.25 2.25V18A2.25 2.25 0 006 20.25zm9.75-9.75H18a2.25 2.25 0 002.25-2.25V6A2.25 2.25 0 0018 3.75h-2.25A2.25 2.25 0 0013.5 6v2.25a2.25 2.25 0 002.25 2.25z" />
      </svg>
    ),
    title: "All-in-One Workflow",
    description:
      "Extract quantities directly from drawings and data-rich BIM models, access embedded cost catalogs, and create estimates — then push them to a project budget in one connected solution.",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0" />
      </svg>
    ),
    title: "Win More Work Quickly",
    description:
      "Build accurate construction cost estimates and win more projects in less time. Choose from a variety of takeoff methods — 3D takeoff, automated area takeoff, linear takeoff, and more.",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
      </svg>
    ),
    title: "Handoff Projects Faster",
    description:
      "Seamlessly transition from estimating to course of construction without switching between multiple applications. Your estimate becomes your budget — no re-entry, no version drift.",
  },
];

const steps = [
  {
    number: "01",
    title: "Perform digital takeoff",
    description:
      "Import drawings or connect BIM models to extract quantities automatically. Measure linear, area, and 3D elements directly on screen — no printing, no manual counting.",
  },
  {
    number: "02",
    title: "Build your estimate",
    description:
      "Apply labor, material, and equipment costs from your embedded cost catalog. Layer in overhead and margin, run alternates, and produce a polished proposal ready to submit.",
  },
  {
    number: "03",
    title: "Convert to budget and build",
    description:
      "When you win the job, push your estimate to the project budget with one click. Cost codes, line items, and structure carry over automatically — ready for the first commitment.",
  },
];

const faqs = [
  {
    question: "Who uses preconstruction estimating software?",
    answer:
      "For estimators who struggle with maintaining accurate and efficient project cost estimation, SiteCommand Estimating is an all-in-one solution that streamlines the estimation process, minimizes errors, and connects preconstruction data seamlessly to the construction phase.",
  },
  {
    question: "What are the features and benefits of estimating software?",
    answer:
      "Key benefits include more accurate estimates (eliminating manual spreadsheet errors), an all-in-one workflow (takeoff, estimate, and budget in one solution), winning more work quickly (multiple takeoff methods including 3D, automated area, and linear), and faster project handoff (seamless transition from estimating to construction without switching applications).",
  },
  {
    question: "Can SiteCommand Estimating integrate with other tools?",
    answer:
      "Yes. SiteCommand's platform is designed to connect everyone in construction on one platform, including connections to BIM tools, accounting systems, and other construction software. Open API access is available for custom integrations.",
  },
  {
    question: "What are the steps in construction estimating?",
    answer:
      "Construction cost estimating typically follows eight key steps: reviewing the bid package, performing a site visit, conducting digital takeoff, applying unit costs from a cost catalog, pricing labor and equipment, adding subcontractor quotes, layering in overhead and general conditions, and finally accounting for profit margin and contingency.",
  },
  {
    question: "How does estimating connect to the project budget?",
    answer:
      "SiteCommand links estimating and budgeting. When you win a project, your estimate converts to a project budget in one step — cost codes, quantities, and line items carry over so you start construction with a clean, accurate baseline without any re-entry.",
  },
];

export default function EstimatingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="min-h-screen" style={{ background: "#FAFAF9" }}>
      <Navbar />

      {/* Hero */}
      <section className="relative overflow-hidden pt-20 pb-20 px-6 sm:px-10">
        <div className="absolute inset-0 -z-10 pointer-events-none" style={{ background: "radial-gradient(ellipse 60% 50% at 65% 25%, rgba(212,80,10,0.05) 0%, transparent 65%)" }} />
        <div className="max-w-7xl mx-auto">
          <div className="max-w-3xl">
            <div className="animate-fade-up inline-flex items-center gap-2 mb-8">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#2563EB" }} />
              <span className="text-xs font-medium tracking-widest text-gray-400 uppercase">Preconstruction</span>
            </div>
            <h1 className="font-display animate-fade-up delay-100" style={{ fontSize: "clamp(2.8rem,6.5vw,5rem)", lineHeight: "0.96" }}>
              Construction takeoff &amp;<br />
              <em className="not-italic" style={{ color: "#C0C0BC" }}>estimating software.</em>
            </h1>
            <p className="animate-fade-up delay-200 mt-7 text-lg text-gray-500 max-w-md leading-relaxed">
              Align on scope and cost from day one by streamlining takeoffs, estimates, and proposals in one connected solution. Reduce rework, protect your margins, and win more profitable work.
            </p>
            <div className="animate-fade-up delay-300 mt-10 flex flex-wrap items-center gap-3">
              <a href="/demo" className="group relative inline-flex items-center px-7 py-3.5 text-sm font-semibold text-white rounded-xl overflow-hidden active:scale-[0.98]" style={{ background: "#111110" }}>
                <span className="relative z-10">Explore the Demo</span>
                <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-[0.08] transition-opacity" />
              </a>
              <a href="/pricing" className="px-7 py-3.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-white transition-all">See pricing</a>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-6 sm:px-10" style={{ background: "#FAFAF9" }}>
        <div className="max-w-7xl mx-auto">
          <div className="mb-16">
            <h2 className="text-3xl font-display text-gray-950 mb-4">
              Reduce rework, protect your margins, and win more profitable work
            </h2>
            <p className="text-lg text-gray-500 max-w-2xl leading-relaxed">
              Replace disconnected spreadsheets and manual takeoffs with a unified estimating platform purpose-built for how construction teams work.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {features.map((f) => (
              <div key={f.title} className="rounded-2xl" style={{ background: "linear-gradient(145deg, rgba(255,255,255,0.95) 0%, rgba(235,235,233,0.5) 100%)", border: "1px solid rgba(0,0,0,0.055)", boxShadow: "0 2px 8px rgba(0,0,0,0.04), 0 1px 0 rgba(255,255,255,0.7) inset", padding: "1.5px" }}>
                <div className="h-full rounded-[14px] p-6 flex flex-col gap-4" style={{ background: "#FFFFFF", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9)" }}>
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(37,99,235,0.08)", color: "#2563EB" }}>
                    {f.icon}
                  </div>
                  <div>
                    <h3 className="text-base font-semibold mb-1.5" style={{ color: "#111110" }}>{f.title}</h3>
                    <p className="text-sm text-gray-500 leading-relaxed">{f.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 px-6 sm:px-10" style={{ borderTop: "1px solid rgba(0,0,0,0.06)", background: "#FFFFFF" }}>
        <div className="max-w-7xl mx-auto">
          <div className="mb-16">
            <h2 className="text-3xl font-display text-gray-950 mb-4">How it works</h2>
            <p className="text-lg text-gray-500 leading-relaxed">
              From the first drawing to the final proposal — a connected process that gets you to bid day faster.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {steps.map((step) => (
              <div key={step.number}>
                <div className="inline-flex items-center gap-2 mb-5">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#2563EB" }} />
                  <span className="text-xs font-medium tracking-widest uppercase" style={{ color: "#2563EB" }}>{step.number}</span>
                </div>
                <h3 className="text-lg font-semibold mb-2" style={{ color: "#111110" }}>{step.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-24 px-6 sm:px-10" style={{ background: "#FAFAF9" }}>
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-display text-gray-950 mb-12">
            Frequently asked questions
          </h2>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div key={i} className="rounded-2xl" style={{ background: "linear-gradient(145deg, rgba(255,255,255,0.95) 0%, rgba(235,235,233,0.5) 100%)", border: "1px solid rgba(0,0,0,0.055)", boxShadow: "0 2px 8px rgba(0,0,0,0.04), 0 1px 0 rgba(255,255,255,0.7) inset", padding: "1.5px" }}>
                <div className="rounded-[14px] overflow-hidden" style={{ background: "#FFFFFF", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9)" }}>
                  <button
                    className="w-full flex items-center justify-between px-6 py-5 text-left transition-colors hover:bg-gray-50/60"
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  >
                    <span className="font-medium text-sm" style={{ color: "#111110" }}>{faq.question}</span>
                    <svg
                      className={`w-4 h-4 text-gray-400 transition-transform shrink-0 ml-4 ${openFaq === i ? "rotate-180" : ""}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {openFaq === i && (
                    <div className="px-6 pb-5 text-sm text-gray-500 leading-relaxed" style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>{faq.answer}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-24 px-6 sm:px-10" style={{ background: "#FAFAF9" }}>
        <div className="max-w-3xl mx-auto">
          <div className="rounded-2xl" style={{ background: "linear-gradient(145deg, rgba(255,255,255,0.95) 0%, rgba(235,235,233,0.5) 100%)", border: "1px solid rgba(0,0,0,0.055)", boxShadow: "0 2px 8px rgba(0,0,0,0.04), 0 1px 0 rgba(255,255,255,0.7) inset", padding: "1.5px" }}>
            <div className="rounded-[14px] px-10 py-14 text-center" style={{ background: "#FFFFFF", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9)" }}>
              <h2 className="text-3xl font-bold mb-4" style={{ letterSpacing: "-0.02em", color: "#111110" }}>
                Ready to estimate smarter?
              </h2>
              <p className="text-gray-500 mb-10 text-lg leading-relaxed max-w-lg mx-auto">
                Join estimating teams that have cut bid prep time and built stronger margins with connected takeoff and estimating tools.
              </p>
              <div className="flex flex-wrap gap-3 justify-center">
                <a href="/demo" className="group relative inline-flex items-center px-7 py-3.5 text-sm font-semibold text-white rounded-xl overflow-hidden active:scale-[0.98]" style={{ background: "#111110" }}>
                  <span className="relative z-10">Explore the Demo</span>
                  <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-[0.08] transition-opacity" />
                </a>
                <a href="/pricing" className="px-7 py-3.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-all">See pricing</a>
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
