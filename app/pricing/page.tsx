"use client";

import Navbar from "../components/Navbar";

const plans = [
  {
    name: "Starter",
    size: "1–10 employees",
    price: "$99",
    period: "/ month",
    description: "For small crews managing a single active project.",
    cta: "Get started",
    plan: "starter" as const,
    ctaHref: null,
    highlight: false,
    features: [
      "Up to 10 team members",
      "Daily logs & manpower tracking",
      "Document & drawing management",
      "RFIs, submittals & punch lists",
      "Photo albums",
      "Email support",
    ],
  },
  {
    name: "Professional",
    size: "11–99 employees",
    price: "$199",
    period: "/ month",
    description: "For growing contractors running multiple projects at once.",
    cta: "Get started",
    plan: "pro" as const,
    ctaHref: null,
    highlight: true,
    features: [
      "Up to 99 team members",
      "Everything in Starter",
      "Multiple active projects",
      "Advanced reporting",
      "Directory & subcontractor management",
      "Priority support",
    ],
  },
  {
    name: "Enterprise",
    size: "100+ employees",
    price: "Contact sales",
    period: "",
    description: "Custom pricing and configuration for large organizations.",
    cta: "Contact us",
    plan: null,
    ctaHref: "mailto:sales@sitecommand.com",
    highlight: false,
    features: [
      "Unlimited team members",
      "Everything in Professional",
      "Dedicated account manager",
      "Custom integrations",
      "SSO & advanced permissions",
      "SLA & enterprise support",
    ],
  },
];

export default function PricingPage() {
  function handleSelectPlan(plan: string) {
    window.location.href = `/signup?plan=${plan}`;
  }

  return (
    <div className="min-h-dvh" style={{ background: "#FAFAF9" }}>
      <a href="#main-content" className="skip-link">Skip to content</a>
      <Navbar />

      <main id="main-content" className="max-w-5xl mx-auto px-6 pt-20 pb-24">
        {/* Page title section */}
        <div className="mb-14 animate-fade-up">
          {/* Eyebrow tag */}
          <div className="inline-flex items-center gap-2 mb-4 delay-100">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#2563EB" }} />
            <span className="text-xs font-medium tracking-widest text-gray-400 uppercase">Pricing</span>
          </div>

          <h1
            className="font-display text-5xl text-gray-950 animate-fade-up delay-100"
          >
            Simple, transparent pricing
          </h1>
          <p className="mt-4 text-lg text-gray-500 animate-fade-up delay-200">
            Choose the plan that fits your team. No hidden fees, no surprises.
          </p>
        </div>

        {/* Pricing cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center animate-fade-up delay-300">
          {plans.map((plan) => {
            const outerStyle: React.CSSProperties = plan.highlight
              ? {
                  background:
                    "linear-gradient(145deg, rgba(255,255,255,0.95) 0%, rgba(235,235,233,0.5) 100%)",
                  border: "1px solid rgba(0,0,0,0.055)",
                  boxShadow:
                    "0 16px 40px rgba(0,0,0,0.1), 0 1px 0 rgba(255,255,255,0.7) inset",
                  padding: "1.5px",
                  transform: "scale(1.02)",
                }
              : {
                  background:
                    "linear-gradient(145deg, rgba(255,255,255,0.95) 0%, rgba(235,235,233,0.5) 100%)",
                  border: "1px solid rgba(0,0,0,0.055)",
                  boxShadow:
                    "0 2px 8px rgba(0,0,0,0.04), 0 1px 0 rgba(255,255,255,0.7) inset",
                  padding: "1.5px",
                };

            const innerStyle: React.CSSProperties = {
              background: plan.highlight ? "#FEFCFB" : "#FFFFFF",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9)",
            };

            return (
              <div key={plan.name} className="rounded-2xl" style={outerStyle}>
                <div
                  className="h-full rounded-[14px] p-8 flex flex-col"
                  style={innerStyle}
                >
                  {/* Most popular badge */}
                  {plan.highlight && (
                    <div className="mb-4">
                      <span className="px-2.5 py-1 text-xs font-semibold bg-[#2563EB] text-white rounded-full">
                        Most popular
                      </span>
                    </div>
                  )}

                  {/* Plan header */}
                  <div className="mb-8 min-h-[160px]">
                    <p className="text-xs font-medium tracking-wide mb-1 text-gray-400">
                      {plan.size}
                    </p>
                    <h2
                      className="text-2xl text-gray-950"
                     
                    >
                      {plan.name}
                    </h2>
                    <div className="mt-4 flex items-end gap-1">
                      <span
                        className="font-display text-4xl tabular-nums text-gray-950"
                      >
                        {plan.price}
                      </span>
                      {plan.period && (
                        <span className="text-sm mb-1 text-gray-500">
                          {plan.period}
                        </span>
                      )}
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-gray-500">
                      {plan.description}
                    </p>
                  </div>

                  {/* CTA button */}
                  {plan.ctaHref ? (
                    <a
                      href={plan.ctaHref}
                      className="block text-center py-2.5 px-4 rounded-xl text-sm font-semibold transition-all duration-150 mb-8 active:scale-[0.98] hover:opacity-90"
                      style={{
                        background: plan.highlight ? "#FFFFFF" : "#111110",
                        color: plan.highlight ? "#111110" : "#FFFFFF",
                        border: plan.highlight
                          ? "1px solid rgba(0,0,0,0.10)"
                          : "none",
                      }}
                    >
                      {plan.cta}
                    </a>
                  ) : (
                    <button
                      onClick={() => handleSelectPlan(plan.plan!)}
                      className="block w-full text-center py-2.5 px-4 rounded-xl text-sm font-semibold transition-all duration-150 mb-8 active:scale-[0.98] hover:opacity-90"
                      style={{
                        background: plan.highlight ? "#FFFFFF" : "#111110",
                        color: plan.highlight ? "#111110" : "#FFFFFF",
                        border: plan.highlight
                          ? "1px solid rgba(0,0,0,0.10)"
                          : "none",
                      }}
                    >
                      {plan.cta}
                    </button>
                  )}

                  {/* Feature list */}
                  <ul
                    className="space-y-3 pt-8 mt-auto"
                    style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}
                  >
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-sm">
                        <svg
                          className="w-4 h-4 shrink-0 mt-0.5"
                          style={{ color: "#2563EB" }}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2.5}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                        <span className="text-gray-600">{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>

        <p className="mt-8 text-center text-sm text-gray-400">
          All plans include a 14-day free trial. No credit card required.
        </p>
      </main>

      {/* Footer */}
      <footer
        className="py-10 px-6 sm:px-10"
        style={{ borderTop: "1px solid rgba(0,0,0,0.06)", background: "#FAFAF9" }}
      >
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <span
            className="text-sm font-semibold text-gray-900"
           
          >
            SiteCommand
          </span>
          <div className="flex flex-wrap gap-6 text-xs text-gray-400">
            <a href="/" className="hover:text-gray-700 transition-colors">Home</a>
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
