"use client";

import { useState } from "react";
import Navbar from "../components/Navbar";
import Link from "next/link";

const features = [
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    ),
    title: "Bid Packages",
    description:
      "Create structured bid packages with auto-populated project information. Organize scope documents, drawings, and specs so subcontractors have everything they need to submit an accurate bid.",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
    title: "Bid Leveling",
    description:
      "Compare bids side by side with structured leveling tools. Normalize scope differences, adjust line items, and make data-driven award decisions — without leaving the platform.",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
      </svg>
    ),
    title: "Subcontractor Portal",
    description:
      "Give subs a dedicated space to view scope, download drawings, ask clarifying questions, and submit their bids — no email threads, no version confusion, no missed invitations.",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
      </svg>
    ),
    title: "Budget Integration",
    description:
      "Convert the winning bid into a subcontract with one click and automatically update your project budget. Eliminate double-entry and keep your financials in sync from day one.",
  },
];

const steps = [
  {
    number: "01",
    title: "Build your bid package",
    description:
      "Create a structured bid package with scope documents, drawings, and specs. Project info auto-populates to save time.",
  },
  {
    number: "02",
    title: "Invite subcontractors",
    description:
      "Send invitations to your prequalified subcontractor list with one click. Track who's opened, declined, or submitted in real time.",
  },
  {
    number: "03",
    title: "Level, award, and sync",
    description:
      "Compare incoming bids side by side. Level scope differences, award the winning bidder, and sync the commitment to your budget automatically.",
  },
];

const faqs = [
  {
    question: "Who uses bid management software?",
    answer:
      "General contractors and construction managers use bid management software to solicit, collect, and evaluate subcontractor bids. Estimators, project managers, and procurement teams are the primary users.",
  },
  {
    question: "What is bid leveling?",
    answer:
      "Bid leveling is the process of normalizing subcontractor bids to make them comparable on an apples-to-apples basis. It involves adjusting for scope differences, exclusions, and assumptions so you can make a fair award decision.",
  },
  {
    question: "How does bid management connect to budgeting?",
    answer:
      "SiteCommand connects the bid management and budget modules. When you award a bid, the system can automatically create a commitment and update your project budget — no double-entry required.",
  },
  {
    question: "What is the bid lifecycle?",
    answer:
      "The bid lifecycle typically includes: identifying scope, creating a bid package, soliciting bids, answering RFQs, receiving submissions, leveling bids, awarding the contract, and converting the award into a subcontract or purchase order.",
  },
  {
    question: "Can bid management integrate with other tools?",
    answer:
      "Yes. SiteCommand's open API allows you to connect with estimating tools, accounting systems, and e-signature platforms so your bid data flows seamlessly across your tech stack.",
  },
];

export default function BidManagementPage() {
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
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#D4500A" }} />
              <span className="text-xs font-medium tracking-widest text-gray-400 uppercase">Preconstruction</span>
            </div>
            <h1 className="font-display animate-fade-up delay-100" style={{ fontSize: "clamp(2.8rem,6.5vw,5rem)", lineHeight: "0.96" }}>
              Construction bid<br />
              <em className="not-italic" style={{ color: "#C0C0BC" }}>management software.</em>
            </h1>
            <p className="animate-fade-up delay-200 mt-7 text-lg text-gray-500 max-w-md leading-relaxed">
              Move from bidding to building faster. Invite every stakeholder — from estimators and project teams to your subcontractor partners — to collaborate in a single platform.
            </p>
            <div className="animate-fade-up delay-300 mt-10 flex flex-wrap items-center gap-3">
              <a href="/demo" className="group relative inline-flex items-center px-7 py-3.5 text-sm font-semibold text-white rounded-xl overflow-hidden active:scale-[0.98]" style={{ background: "#111110" }}>
                <span className="relative z-10">Explore the Demo</span>
                <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-[0.08] transition-opacity" />
              </a>
              <a href="https://www.sitecommand.xyz/signup" className="px-7 py-3.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-white transition-all" style={{ background: "rgba(255,255,255,0.6)" }}>Get started</a>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6 sm:px-10" style={{ borderTop: "1px solid rgba(0,0,0,0.06)", background: "#FAFAF9" }}>
        <div className="max-w-7xl mx-auto">
          <span className="text-xs font-semibold tracking-widest text-gray-400 uppercase">Features</span>
          <h2 className="mt-3 text-3xl font-display text-gray-950 mb-14">Everything you need to run a better bid process</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {features.map((f) => (
              <div key={f.title} className="rounded-2xl" style={{ background: "linear-gradient(145deg, rgba(255,255,255,0.95) 0%, rgba(235,235,233,0.5) 100%)", border: "1px solid rgba(0,0,0,0.055)", boxShadow: "0 2px 8px rgba(0,0,0,0.04), 0 1px 0 rgba(255,255,255,0.7) inset", padding: "1.5px" }}>
                <div className="h-full rounded-[14px] p-6 flex flex-col gap-4" style={{ background: "#FFFFFF", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9)" }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(212,80,10,0.08)" }}>
                    <div style={{ color: "#D4500A" }}>{f.icon}</div>
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

      {/* How it works */}
      <section className="py-20 px-6 sm:px-10" style={{ borderTop: "1px solid rgba(0,0,0,0.06)", background: "#FFFFFF" }}>
        <div className="max-w-7xl mx-auto">
          <span className="text-xs font-semibold tracking-widest text-gray-400 uppercase">Process</span>
          <h2 className="mt-3 text-3xl font-display text-gray-950 mb-14">How it works</h2>
          <p className="text-base text-gray-500 mb-14 max-w-lg -mt-10">
            A streamlined three-step process from scope definition to contract award.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {steps.map((step) => (
              <div key={step.number}>
                <div className="inline-flex items-center gap-2 mb-5">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#D4500A" }} />
                  <span className="text-xs font-semibold tracking-widest text-gray-400 uppercase">{step.number}</span>
                </div>
                <h3 className="text-base font-semibold text-gray-900 mb-2">{step.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{step.description}</p>
              </div>
            ))}
          </div>
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
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#D4500A" }} />
                  <span className="text-xs font-medium tracking-widest text-gray-400 uppercase">Get started today</span>
                </span>
                <h2 className="text-4xl sm:text-5xl font-display text-gray-950 leading-tight">Ready to modernize your bid process?</h2>
                <p className="mt-5 text-lg text-gray-400 max-w-md mx-auto">
                  Join construction teams that have cut bid cycle time and built stronger subcontractor relationships.
                </p>
                <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
                  <a href="/demo" className="group relative inline-flex items-center px-8 py-4 text-sm font-semibold text-white rounded-xl overflow-hidden active:scale-[0.98]" style={{ background: "#111110" }}>
                    <span className="relative z-10">Explore the Demo</span>
                    <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-[0.08] transition-opacity" />
                  </a>
                  <a href="https://www.sitecommand.xyz/signup" className="px-8 py-4 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 active:scale-[0.98]">Get started</a>
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
