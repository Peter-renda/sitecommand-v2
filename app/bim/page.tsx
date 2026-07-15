"use client";

import { useState } from "react";
import Navbar from "../components/Navbar";
import Link from "next/link";

const features = [
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
      </svg>
    ),
    title: "3D Model Viewer",
    description:
      "View and navigate intelligent 3D building models directly in your browser — no installs, no plugins. Field teams and office staff access the same model from any device.",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
    ),
    title: "Clash Detection",
    description:
      "Identify and resolve design conflicts before they become field problems. Run automated clash checks across all model disciplines and track resolution status in one place.",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
      </svg>
    ),
    title: "Model Coordination",
    description:
      "Give every discipline — architecture, structural, MEP — a shared coordination environment. Track issues, assign owners, and keep all comments tied directly to model elements.",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
      </svg>
    ),
    title: "Field Connectivity",
    description:
      "Link BIM data to field tasks, punch lists, and photos. When a worker marks an issue in the field, it snaps directly to the model element — giving you a full picture of project health.",
  },
];

const stats = [
  { value: "30%", label: "of construction work is rework on average — BIM helps eliminate it" },
  { value: "6×", label: "ROI achieved by teams using collaborative BIM processes" },
  { value: "20%", label: "reduction in project costs reported by BIM-enabled teams" },
];

const faqs = [
  {
    question: "What is BIM?",
    answer:
      "Building Information Modeling (BIM) is a 3D model-based process that gives architecture, engineering, and construction professionals insights and tools to more efficiently plan, design, construct, and manage buildings and infrastructure. It combines technology, digital representations, and collaborative workflows into comprehensive building models that contain both geometric and non-geometric data.",
  },
  {
    question: "What is BIM used for?",
    answer:
      "BIM serves as a central platform for construction project management and collaboration. Teams use it to facilitate coordination between disciplines, manage project documentation, detect design conflicts before construction begins, perform accurate cost estimation, and handle project scheduling — all from a single source of truth.",
  },
  {
    question: "How does BIM reduce rework?",
    answer:
      "By virtually building the project before breaking ground, BIM lets teams identify clashes, coordination gaps, and design errors in the model rather than on the jobsite. Resolving these issues digitally is orders of magnitude cheaper than fixing them after concrete is poured or walls are framed.",
  },
  {
    question: "Who needs access to BIM models?",
    answer:
      "Everyone involved in delivering the project benefits from access — architects, engineers, GC project managers, subcontractor foremen, and owners. SiteCommand's browser-based viewer means field crews can pull up the model on a tablet without any special software.",
  },
  {
    question: "What file formats does SiteCommand BIM support?",
    answer:
      "SiteCommand supports the most common BIM formats including IFC, RVT (Revit), NWD/NWC (Navisworks), and DWG. Models can be uploaded directly or synced via our integrations with Autodesk and other design platforms.",
  },
];

export default function BIMPage() {
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
              BIM for construction<br />
              <em className="not-italic" style={{ color: "#C0C0BC" }}>management.</em>
            </h1>
            <p className="animate-fade-up delay-200 mt-7 text-lg text-gray-500 max-w-md leading-relaxed">
              Revolutionize your projects with BIM that&apos;s simple, intuitive, and designed to unlock collaboration for everyone, everywhere — from the design table to the jobsite.
            </p>
            <div className="animate-fade-up delay-300 mt-10 flex flex-wrap items-center gap-3">
              <a href="/demo" className="group relative inline-flex items-center px-7 py-3.5 text-sm font-semibold text-white rounded-xl overflow-hidden active:scale-[0.98]" style={{ background: "#111110" }}>
                <span className="relative z-10">Explore the Demo</span>
                <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-[0.08] transition-opacity" />
              </a>
              <a href="/pricing" className="px-7 py-3.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-white transition-all" style={{ background: "rgba(255,255,255,0.6)" }}>See pricing</a>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Strip */}
      <section className="border-y py-12 px-6 sm:px-10" style={{ borderColor: "rgba(0,0,0,0.06)", background: "#FFFFFF" }}>
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          {stats.map((s) => (
            <div key={s.value}>
              <p className="text-4xl font-display text-gray-950 mb-1 tabular-nums">{s.value}</p>
              <p className="text-sm text-gray-400 leading-relaxed">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* What is BIM */}
      <section className="py-20 px-6 sm:px-10" style={{ borderTop: "1px solid rgba(0,0,0,0.06)", background: "#FAFAF9" }}>
        <div className="max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 mb-5">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#2563EB" }} />
            <span className="text-xs font-semibold tracking-widest text-gray-400 uppercase">Overview</span>
          </div>
          <h2 className="text-3xl font-display text-gray-950 mb-6">What is BIM?</h2>
          <p className="text-lg text-gray-500 leading-relaxed mb-6">
            Building Information Modeling (BIM) is a 3D model-based process that gives architecture, engineering, and construction professionals insights and tools to more efficiently plan, design, construct, and manage buildings and infrastructure.
          </p>
          <p className="text-lg text-gray-500 leading-relaxed">
            This intelligent approach combines technology, digital representations, and collaborative workflows to create comprehensive building models that contain both geometric and non-geometric data about the project — enabling every stakeholder to work from a single source of truth.
          </p>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-6 sm:px-10" style={{ borderTop: "1px solid rgba(0,0,0,0.06)", background: "#FAFAF9" }}>
        <div className="max-w-7xl mx-auto">
          <span className="text-xs font-semibold tracking-widest text-gray-400 uppercase">Features</span>
          <h2 className="mt-3 text-3xl font-display text-gray-950 mb-14">Build with confidence</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {features.map((f) => (
              <div key={f.title} className="rounded-2xl" style={{ background: "linear-gradient(145deg, rgba(255,255,255,0.95) 0%, rgba(235,235,233,0.5) 100%)", border: "1px solid rgba(0,0,0,0.055)", boxShadow: "0 2px 8px rgba(0,0,0,0.04), 0 1px 0 rgba(255,255,255,0.7) inset", padding: "1.5px" }}>
                <div className="h-full rounded-[14px] p-6 flex flex-col gap-4" style={{ background: "#FFFFFF", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9)" }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(37,99,235,0.08)" }}>
                    <div style={{ color: "#2563EB" }}>{f.icon}</div>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-1.5">{f.title}</h3>
                    <p className="text-sm text-gray-500 leading-relaxed">{f.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How BIM is transforming construction */}
      <section className="py-20 px-6 sm:px-10" style={{ borderTop: "1px solid rgba(0,0,0,0.06)", background: "#FFFFFF" }}>
        <div className="max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 mb-5">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#2563EB" }} />
            <span className="text-xs font-semibold tracking-widest text-gray-400 uppercase">Impact</span>
          </div>
          <h2 className="text-3xl font-display text-gray-950 mb-6">How BIM is transforming construction</h2>
          <p className="text-lg text-gray-500 leading-relaxed mb-6">
            BIM transforms construction by fundamentally changing how projects are planned, executed, and managed. The technology enables teams to virtually build and optimize structures before construction begins, significantly reducing the rework that accounts for roughly 30% of total project cost on traditional builds.
          </p>
          <p className="text-lg text-gray-500 leading-relaxed">
            Connected to SiteCommand&apos;s project management, documents, and financial tools, BIM data becomes actionable across every phase — from early design through final closeout. Owners get real-time visibility, GCs reduce surprises, and subcontractors arrive on site knowing exactly what to build.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 px-6 sm:px-10" style={{ borderTop: "1px solid rgba(0,0,0,0.06)", background: "#FAFAF9" }}>
        <div className="max-w-3xl mx-auto">
          <span className="text-xs font-semibold tracking-widest text-gray-400 uppercase">FAQ</span>
          <h2 className="mt-3 text-3xl font-display text-gray-950 mb-12">Frequently asked questions</h2>
          <div className="space-y-2">
            {faqs.map((faq, i) => (
              <div key={i} className="rounded-xl overflow-hidden" style={{ background: "linear-gradient(145deg, rgba(255,255,255,0.95) 0%, rgba(235,235,233,0.5) 100%)", border: "1px solid rgba(0,0,0,0.055)", boxShadow: "0 1px 4px rgba(0,0,0,0.03)" }}>
                <div className="rounded-xl overflow-hidden" style={{ background: "#FFFFFF", margin: "1.5px" }}>
                  <button
                    className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50/60 transition-colors"
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  >
                    <span className="font-medium text-gray-900 text-sm">{faq.question}</span>
                    <svg className={`w-4 h-4 text-gray-400 transition-transform shrink-0 ml-4 ${openFaq === i ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {openFaq === i && (
                    <div className="px-6 pb-4 text-sm text-gray-500 leading-relaxed" style={{ borderTop: "1px solid rgba(0,0,0,0.05)" }}>{faq.answer}</div>
                  )}
                </div>
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
                <h2 className="text-4xl sm:text-5xl font-display text-gray-950 leading-tight">Ready to build smarter?</h2>
                <p className="mt-5 text-lg text-gray-400 max-w-md mx-auto">
                  Give every member of your team — from the design studio to the field — access to the same intelligent model.
                </p>
                <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
                  <a href="/demo" className="group relative inline-flex items-center px-8 py-4 text-sm font-semibold text-white rounded-xl overflow-hidden active:scale-[0.98]" style={{ background: "#111110" }}>
                    <span className="relative z-10">Explore the Demo</span>
                    <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-[0.08] transition-opacity" />
                  </a>
                  <a href="/pricing" className="px-8 py-4 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 active:scale-[0.98]">See pricing</a>
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
