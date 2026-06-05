import Link from "next/link";
import Navbar from "../../components/Navbar";

const tabs = [
  { label: "For General Contractors", href: "/project-execution/general-contractors", active: true },
  { label: "For Specialty Contractors", href: "#", active: false },
  { label: "For Owners", href: "#", active: false },
];

const capabilities = [
  {
    title: "Coordinate the entire field team",
    description:
      "Bring supers, PMs, engineers, and trade partners into one execution workflow so everyone works from the same source of truth.",
  },
  {
    title: "Keep schedule and production in sync",
    description:
      "Track daily progress, look-ahead tasks, blockers, and handoffs in one place so you can identify slippage before it impacts milestones.",
  },
  {
    title: "Close loops faster",
    description:
      "Manage RFIs, submittals, punch, and closeout with full ownership and due dates, reducing back-and-forth emails across teams.",
  },
];

const outcomes = [
  "Fewer missed handoffs between office and field",
  "Faster issue resolution from RFIs and submittals",
  "Less rework caused by outdated information",
  "Cleaner closeout package with complete history",
];

export default function ProjectExecutionGeneralContractorsPage() {
  return (
    <div className="min-h-dvh" style={{ background: "#FAFAF9" }}>
      <Navbar />

      <main>
        <section className="pt-16 pb-12 px-6 sm:px-10">
          <div className="max-w-7xl mx-auto">
            <p className="text-xs font-semibold tracking-widest text-gray-400 uppercase mb-5">Project Execution</p>
            <h1
              className="text-[clamp(2.4rem,6vw,4.6rem)] leading-[0.96] text-gray-950"
             
            >
              Built for general contractors to execute with confidence.
            </h1>
            <p className="mt-6 text-lg text-gray-500 max-w-2xl leading-relaxed">
              SiteCommand helps your teams run cleaner jobs from kickoff to closeout with one platform for field
              collaboration, documentation, and accountability.
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
                One execution hub for every project phase.
              </h2>
              <p className="mt-4 text-gray-500 leading-relaxed">
                From mobilization through closeout, centralize project communication, progress tracking, and quality
                control so your team can focus on delivering work safely, on time, and on budget.
              </p>

              <div className="mt-8 space-y-6">
                {capabilities.map((capability) => (
                  <div key={capability.title} className="rounded-xl border border-gray-100 p-5">
                    <h3 className="text-lg font-semibold text-gray-900">{capability.title}</h3>
                    <p className="mt-2 text-sm text-gray-500 leading-relaxed">{capability.description}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-8 h-fit">
              <p className="text-xs font-semibold tracking-widest text-gray-400 uppercase">Expected outcomes</p>
              <h2 className="mt-3 text-2xl text-gray-950">
                Better execution across office and field.
              </h2>

              <ul className="mt-6 space-y-4">
                {outcomes.map((outcome) => (
                  <li key={outcome} className="flex items-start gap-3 text-sm text-gray-600">
                    <span className="mt-1 inline-flex h-2.5 w-2.5 rounded-full" style={{ background: "#2563EB" }} />
                    <span>{outcome}</span>
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
