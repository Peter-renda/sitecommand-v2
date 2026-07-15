import Link from "next/link";
import Navbar from "../../components/Navbar";

const tabs = [
  { label: "For General Contractors", href: "/cost-management/general-contractors", active: true },
  { label: "For Specialty Contractors", href: "#", active: false },
  { label: "For Owners", href: "#", active: false },
];

const pillars = [
  {
    title: "Control budget in real time",
    description:
      "Track original budget, approved changes, committed costs, and forecasted final cost in one live view your PM and executives can trust.",
  },
  {
    title: "Standardize commitment management",
    description:
      "Create commitments, change orders, and payment workflows with clear approval routing, reducing manual spreadsheet handoffs.",
  },
  {
    title: "Protect margin early",
    description:
      "Spot overages quickly with variance alerts and production insights so teams can make decisions before profit fades.",
  },
];

const metrics = [
  "Single source of truth across project finance",
  "Faster month-end and owner reporting",
  "Cleaner audit trail for commitments and changes",
  "More predictable project cash flow",
];

export default function CostManagementGeneralContractorsPage() {
  return (
    <div className="min-h-dvh" style={{ background: "#FAFAF9" }}>
      <Navbar />

      <main>
        <section className="pt-16 pb-12 px-6 sm:px-10">
          <div className="max-w-7xl mx-auto">
            <p className="text-xs font-semibold tracking-widest text-gray-400 uppercase mb-5">Cost Management</p>
            <h1
              className="text-[clamp(2.4rem,6vw,4.6rem)] leading-[0.96] text-gray-950"
             
            >
              Built for general contractors to stay on budget and protect margin.
            </h1>
            <p className="mt-6 text-lg text-gray-500 max-w-2xl leading-relaxed">
              SiteCommand connects budget, commitments, change orders, and forecasting in one cost workflow so your
              teams can make financial decisions with confidence.
            </p>

            <div className="mt-10 flex flex-wrap gap-3 border-b border-gray-200 pb-5">
              {tabs.map((tab) => (
                <a
                  key={tab.label}
                  href={tab.href}
                  aria-disabled={!tab.active}
                  className={`rounded-full px-5 py-2.5 text-sm font-medium transition-colors ${
                    tab.active
                      ? "text-white"
                      : "text-gray-500 border border-gray-200 bg-white hover:text-gray-700 hover:border-gray-300"
                  }`}
                  style={tab.active ? { background: "#111110" } : undefined}
                >
                  {tab.label}
                </a>
              ))}
            </div>
          </div>
        </section>

        <section className="px-6 sm:px-10 pb-20">
          <div className="max-w-7xl mx-auto grid lg:grid-cols-[1.2fr_0.8fr] gap-6">
            <div className="rounded-2xl border border-gray-200 bg-white p-8">
              <h2 className="text-3xl text-gray-950">
                Financial control from buyout to closeout.
              </h2>
              <p className="mt-4 text-gray-500 leading-relaxed">
                Align operations and accounting around the same live cost data. Eliminate disconnected trackers,
                improve confidence in forecasts, and keep stakeholders informed at every phase.
              </p>

              <div className="mt-8 space-y-6">
                {pillars.map((pillar) => (
                  <div key={pillar.title} className="rounded-xl border border-gray-100 p-5">
                    <h3 className="text-lg font-semibold text-gray-900">{pillar.title}</h3>
                    <p className="mt-2 text-sm text-gray-500 leading-relaxed">{pillar.description}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-8 h-fit">
              <p className="text-xs font-semibold tracking-widest text-gray-400 uppercase">For General Contractors</p>
              <h2 className="mt-3 text-2xl text-gray-950">
                Key outcomes your team can expect.
              </h2>

              <ul className="mt-6 space-y-4">
                {metrics.map((metric) => (
                  <li key={metric} className="flex items-start gap-3 text-sm text-gray-600">
                    <span className="mt-1 inline-flex h-2.5 w-2.5 rounded-full" style={{ background: "#2563EB" }} />
                    <span>{metric}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/demo"
                  className="inline-flex items-center rounded-xl px-5 py-2.5 text-sm font-semibold text-white"
                  style={{ background: "#111110" }}
                >
                  See a demo
                </Link>
                <Link
                  href="/pricing"
                  className="inline-flex items-center rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 hover:border-gray-300"
                >
                  View pricing
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
