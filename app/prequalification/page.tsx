"use client";

import { useState } from "react";
import Navbar from "../components/Navbar";
import Link from "next/link";

const features = [
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
      </svg>
    ),
    title: "Digital Applications",
    description:
      "Replace paper questionnaires with structured digital applications. Subcontractors fill out safety records, financial statements, insurance certificates, and references through a branded online portal — no email attachments.",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
    title: "Risk Scoring",
    description:
      "Automatically score each subcontractor application based on EMR, financial strength, bonding capacity, past performance, and safety history. Surface your highest-risk subs before they make it onto the bid list.",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    ),
    title: "Document Management",
    description:
      "Collect, store, and track insurance certificates, W-9s, licenses, and safety programs in one centralized vault. Get automatic alerts when documents are expiring so nothing slips through.",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
      </svg>
    ),
    title: "Renewal Management",
    description:
      "Track qualification expiry dates across your entire subcontractor database. Automated renewal requests go out before credentials lapse so your approved sub list is always current and compliant.",
  },
];

const steps = [
  {
    number: "01",
    title: "Invite subs to apply",
    description:
      "Send a prequalification invitation to any subcontractor. They receive a branded link to your online portal where they complete the application at their own pace — no account sign-up required.",
  },
  {
    number: "02",
    title: "Review and score",
    description:
      "Applications flow into your dashboard as they're submitted. Automated risk scoring highlights areas of concern. Your team reviews, requests missing documents, and approves or declines — all in one place.",
  },
  {
    number: "03",
    title: "Build a trusted sub list",
    description:
      "Approved subcontractors go directly onto your qualified bidder list. When a new project starts, invite from your pre-vetted roster — confident that every bidder meets your safety and financial requirements.",
  },
];

const stats = [
  { value: "3×", label: "faster qualification process vs. paper-based methods" },
  { value: "60%", label: "reduction in admin time managing sub credentials" },
  { value: "100%", label: "of qualified subs always current — no expired credentials on your bid list" },
];

const faqs = [
  {
    question: "Who uses prequalification software?",
    answer:
      "Any business that hires vendors to deliver goods or services can utilize and benefit from a prequalification software solution. General contractors, construction managers, and owners use it to vet subcontractors and suppliers before inviting them onto projects.",
  },
  {
    question: "How does managing prequalification data in one platform increase efficiency?",
    answer:
      "SiteCommand's prequalification tools give you a centrally connected hub to manage your entire qualification process — from creating and sending forms, to reviewing information, to approving or declining submissions. Maintaining a full record in one central location lets project teams quickly see which contractors are currently approved for a given scope of work, then seamlessly invite them to bid through the connected bidding tool.",
  },
  {
    question: "Can each company configure prequalification for their specific needs?",
    answer:
      "Yes. SiteCommand's prequalification tools offer flexible configurations where you can customize the information collected during the qualification process. The data you deem necessary is associated with each vendor's record in your directory, giving all relevant stakeholders a complete picture at a glance.",
  },
  {
    question: "What are the risks of a poor prequalification process?",
    answer:
      "Beyond efficiency loss, businesses without proper prequalification tools have increased exposure to significant liabilities. Failure to run a robust qualification process can result in hiring a contractor without the proper experience, financial capacity, or insurance to deliver the work — leading to project delays, cost overruns, safety incidents, and legal exposure.",
  },
  {
    question: "How does prequalification connect to bid management?",
    answer:
      "In SiteCommand, your approved prequalified subcontractors feed directly into the bid management module. When creating a bid package, you invite from your qualified sub list — ensuring that every bidder has already passed your vetting process before they receive scope documents.",
  },
];

export default function PrequalificationPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="min-h-screen" style={{ background: "#FAFAF9" }}>
      <Navbar />

      {/* Hero */}
      <section className="pt-24 pb-28 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 mb-8 animate-fade-up">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#2563EB" }} />
            <span className="text-xs font-medium tracking-widest text-gray-400 uppercase">Preconstruction</span>
          </div>

          <h1
            className="text-5xl md:text-6xl leading-[1.08] tracking-tight mb-6 animate-fade-up delay-100"
            style={{ color: "#111110" }}
          >
            Construction prequalification
            <br />
            <em className="not-italic" style={{ color: "#C0C0BC" }}>software that reduces risk.</em>
          </h1>

          <p className="text-lg text-gray-500 mb-10 leading-relaxed max-w-2xl animate-fade-up delay-200">
            Streamline the prequalification process with a single platform for assessing a company's risk, putting together a plan, and inviting them onto your projects.
          </p>

          <div className="flex flex-wrap gap-4 animate-fade-up delay-300">
            <Link
              href="/demo"
              className="px-6 py-3 text-sm font-medium text-white rounded-lg transition-opacity hover:opacity-80"
              style={{ background: "#111110" }}
            >
              Explore the Demo
            </Link>
            <a
              href="https://www.sitecommand.xyz/signup"
              className="px-6 py-3 text-sm font-medium rounded-lg border transition-colors hover:bg-white"
              style={{ color: "#111110", borderColor: "rgba(0,0,0,0.12)" }}
            >
              Get started
            </a>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="py-16 px-6 bg-white border-y border-gray-100">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-10 text-center">
          {stats.map((s) => (
            <div key={s.value}>
              <p
                className="text-5xl mb-2"
                style={{ color: "#111110" }}
              >
                {s.value}
              </p>
              <p className="text-sm text-gray-500 leading-relaxed">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="py-28 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="mb-14">
            <h2
              className="text-4xl mb-4"
              style={{ color: "#111110" }}
            >
              A smarter way to vet your subcontractors
            </h2>
            <p className="text-lg text-gray-500 max-w-2xl">
              From digital applications to automated renewals, SiteCommand gives you the tools to build and maintain a trusted subcontractor base — at scale.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {features.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl p-8 bg-white transition-shadow hover:shadow-md"
                style={{ border: "1px solid rgba(0,0,0,0.07)", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-5"
                  style={{ background: "rgba(37,99,235,0.08)", color: "#2563EB" }}
                >
                  {f.icon}
                </div>
                <h3 className="text-base font-semibold mb-2" style={{ color: "#111110" }}>{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-28 px-6 bg-white border-y border-gray-100">
        <div className="max-w-5xl mx-auto">
          <div className="mb-14">
            <h2
              className="text-4xl mb-4"
              style={{ color: "#111110" }}
            >
              How it works
            </h2>
            <p className="text-lg text-gray-500">
              A straightforward three-step process from invitation to a qualified bidder list.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {steps.map((step) => (
              <div key={step.number}>
                <div className="inline-flex items-center gap-2 mb-4">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#2563EB" }} />
                  <span className="text-xs font-medium tracking-widest text-gray-400 uppercase">{step.number}</span>
                </div>
                <h3 className="text-lg font-semibold mb-2" style={{ color: "#111110" }}>{step.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-28 px-6">
        <div className="max-w-3xl mx-auto">
          <h2
            className="text-4xl mb-12"
            style={{ color: "#111110" }}
          >
            Frequently asked questions
          </h2>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div
                key={i}
                className="rounded-xl overflow-hidden bg-white"
                style={{ border: "1px solid rgba(0,0,0,0.07)" }}
              >
                <button
                  className="w-full flex items-center justify-between px-6 py-5 text-left transition-colors hover:bg-gray-50"
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
                  <div className="px-6 pb-5 text-sm text-gray-500 leading-relaxed">{faq.answer}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA — double-bezel */}
      <section className="py-28 px-6">
        <div className="max-w-3xl mx-auto">
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
                Build a subcontractor base you can trust
              </h2>
              <p className="text-gray-400 mb-10 text-lg max-w-xl mx-auto">
                Stop awarding work to subs you haven't vetted. Start every project with a qualified, compliant team.
              </p>
              <div className="flex flex-wrap gap-4 justify-center">
                <Link
                  href="/demo"
                  className="px-6 py-3 text-sm font-medium text-gray-900 bg-white rounded-lg hover:opacity-90 transition-opacity"
                >
                  Explore the Demo
                </Link>
                <a
                  href="https://www.sitecommand.xyz/signup"
                  className="px-6 py-3 text-sm font-medium text-white border border-white/20 rounded-lg hover:bg-white/10 transition-colors"
                >
                  Get started
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

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
