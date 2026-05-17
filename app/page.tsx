import Navbar from "./components/Navbar";
import Bezel from "./components/Bezel";
import Eyebrow from "./components/Eyebrow";

const features = [
  {
    name: "RFI Management",
    desc: "Track requests for information from submittal to resolution. No lost emails, no missed deadlines.",
    large: true,
    accentColor: "#D4500A",
  },
  {
    name: "Submittals",
    desc: "Manage approvals without chasing emails or lost documents.",
    large: false,
    accentColor: "#6366F1",
  },
  {
    name: "Daily Logs",
    desc: "Record manpower, weather, and site activity every day.",
    large: false,
    accentColor: "#0EA5E9",
  },
  {
    name: "Drawing Control",
    desc: "Keep the team on the current set — always. Version control for your construction drawings.",
    large: true,
    accentColor: "#111110",
  },
  {
    name: "Schedule Tracking",
    desc: "See where you are versus where you planned to be.",
    large: false,
    accentColor: "#10B981",
  },
  {
    name: "Budget & Costs",
    desc: "Monitor spend against budget before it becomes a problem.",
    large: false,
    accentColor: "#F59E0B",
  },
];

const stats = [
  { value: "200+", label: "Construction teams" },
  { value: "4.9", label: "Average rating" },
  { value: "40%", label: "Less time on admin" },
  { value: "1 place", label: "For everything" },
];

export default function Home() {
  return (
    <div className="min-h-dvh" style={{ background: "#FAFAF9" }}>
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <Navbar hidePricing />

      <main id="main-content">
        {/* ── Hero ── */}
        <section className="relative overflow-hidden pt-20 pb-20 px-6 sm:px-10">
          {/* Ambient glow */}
          <div
            className="absolute inset-0 -z-10 pointer-events-none"
            aria-hidden="true"
            style={{
              background:
                "radial-gradient(ellipse 60% 50% at 75% 25%, rgba(212,80,10,0.06) 0%, transparent 65%), radial-gradient(ellipse 40% 35% at 15% 85%, rgba(212,80,10,0.04) 0%, transparent 60%)",
            }}
          />

          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_460px] xl:grid-cols-[1fr_500px] gap-12 xl:gap-20 items-center">

              {/* ── Left: Copy ── */}
              <div>
                {/* Eyebrow tag */}
                <div className="animate-fade-up mb-8">
                  <Eyebrow>Built for contractors</Eyebrow>
                </div>

                {/* Headline — DM Serif Display for editorial luxury */}
                <h1
                  className="font-display animate-fade-up delay-100 text-[clamp(2.8rem,6.5vw,5.2rem)] leading-[0.96] text-gray-950"
                >
                  Take command
                  <br />
                  <em
                    className="not-italic"
                    style={{ color: "#C0C0BC" }}
                  >
                    of your site.
                  </em>
                </h1>

                <p className="animate-fade-up delay-200 mt-7 text-lg text-gray-500 max-w-md leading-relaxed">
                  RFIs, submittals, daily logs, drawings, and schedules —
                  managed in one place. Built for contractors who need
                  clarity, not chaos.
                </p>

                {/* CTAs */}
                <div className="animate-fade-up delay-300 mt-10 flex flex-wrap items-center gap-3">
                  <a
                    href="/signup"
                    className="group relative inline-flex items-center px-7 py-3.5 text-sm font-semibold text-white rounded-xl overflow-hidden transition-all duration-200 active:scale-[0.98]"
                    style={{ background: "#111110" }}
                  >
                    <span className="relative z-10">Get Started</span>
                    <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-[0.08] transition-opacity duration-200" />
                  </a>
                  <a
                    href="/demo"
                    className="inline-flex items-center gap-2 px-7 py-3.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl transition-all duration-200 hover:border-gray-300 hover:bg-white hover:text-gray-900 active:scale-[0.98]"
                    style={{ background: "rgba(255,255,255,0.6)" }}
                  >
                    See a demo
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </a>
                </div>

                {/* Social proof */}
                <div className="animate-fade-up delay-400 mt-12 flex items-center gap-4 pt-10 border-t border-gray-100">
                  <div className="flex -space-x-1.5">
                    {(["#C2410C", "#B45309", "#047857", "#1D4ED8"] as const).map(
                      (color, i) => (
                        <div
                          key={i}
                          className="w-7 h-7 rounded-full border-2 border-white flex items-center justify-center text-white text-[9px] font-bold"
                          style={{ background: color }}
                        >
                          {["T", "J", "R", "M"][i]}
                        </div>
                      )
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-0.5 mb-1">
                      {[...Array(5)].map((_, i) => (
                        <svg
                          key={i}
                          className="w-3 h-3 text-orange-400"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ))}
                    </div>
                    <p className="text-xs text-gray-400">
                      4.9 · Trusted by 200+ construction teams
                    </p>
                  </div>
                </div>
              </div>

              {/* ── Right: Product preview — Double-Bezel card ── */}
              <div className="hidden lg:block animate-scale-in delay-200">
                <Bezel size="md" elevation="lifted">
                  <div>
                    {/* Mock app header */}
                    <div
                      className="px-5 py-3.5 border-b flex items-center justify-between"
                      style={{
                        borderColor: "rgba(0,0,0,0.05)",
                        background: "rgba(250,250,249,0.9)",
                      }}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ background: "#D4500A" }}
                        />
                        <span className="text-xs font-semibold text-gray-700 tracking-wide">
                          RFI Tracker
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span
                          className="px-2 py-0.5 text-[10px] font-medium rounded-full"
                          style={{
                            color: "#C2410C",
                            background: "#FFF7ED",
                            border: "1px solid #FED7AA",
                          }}
                        >
                          3 Open
                        </span>
                        <span
                          className="px-2 py-0.5 text-[10px] font-medium rounded-full"
                          style={{
                            color: "#047857",
                            background: "#ECFDF5",
                            border: "1px solid #A7F3D0",
                          }}
                        >
                          12 Closed
                        </span>
                      </div>
                    </div>

                    {/* Mock RFI rows */}
                    <div className="divide-y" style={{ borderColor: "rgba(0,0,0,0.04)" }}>
                      {[
                        {
                          id: "RFI-024",
                          title: "Structural beam specifications",
                          status: "Open",
                          statusStyle: {
                            color: "#C2410C",
                            background: "#FFF7ED",
                            border: "1px solid #FED7AA",
                          },
                        },
                        {
                          id: "RFI-023",
                          title: "Electrical panel location change",
                          status: "In Review",
                          statusStyle: {
                            color: "#1D4ED8",
                            background: "#EFF6FF",
                            border: "1px solid #BFDBFE",
                          },
                        },
                        {
                          id: "RFI-022",
                          title: "Waterproofing membrane detail",
                          status: "Closed",
                          statusStyle: {
                            color: "#6B7280",
                            background: "#F9FAFB",
                            border: "1px solid #E5E7EB",
                          },
                        },
                        {
                          id: "RFI-021",
                          title: "Door hardware schedule revision",
                          status: "Closed",
                          statusStyle: {
                            color: "#6B7280",
                            background: "#F9FAFB",
                            border: "1px solid #E5E7EB",
                          },
                        },
                      ].map((rfi) => (
                        <div
                          key={rfi.id}
                          className="px-5 py-3.5 flex items-center gap-3 transition-colors duration-100 hover:bg-gray-50/70"
                        >
                          <span className="text-[10px] font-mono text-gray-400 w-14 shrink-0 tabular-nums">
                            {rfi.id}
                          </span>
                          <span className="text-xs text-gray-700 flex-1 truncate">
                            {rfi.title}
                          </span>
                          <span
                            className="px-2 py-0.5 text-[10px] font-medium rounded-full shrink-0"
                            style={rfi.statusStyle}
                          >
                            {rfi.status}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Mock footer */}
                    <div
                      className="px-5 py-3 border-t flex items-center justify-between"
                      style={{
                        borderColor: "rgba(0,0,0,0.05)",
                        background: "rgba(250,250,249,0.7)",
                      }}
                    >
                      <span className="text-[10px] text-gray-400">
                        Westfield Commercial · Phase 2
                      </span>
                      <div className="flex items-center gap-2.5">
                        <div
                          className="h-1 w-20 rounded-full overflow-hidden"
                          style={{ background: "#F3F4F6" }}
                        >
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: "80%",
                              background: "#D4500A",
                            }}
                          />
                        </div>
                        <span className="text-[10px] text-gray-400">
                          80% resolved
                        </span>
                      </div>
                    </div>
                  </div>
                </Bezel>

                {/* Floating notification chip — Double-bezel small card */}
                <div className="mt-3 ml-4 inline-flex animate-fade-up delay-500">
                  <Bezel size="sm" elevation="soft">
                    <div
                      className="px-4 py-3 flex items-center gap-3"
                    >
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: "rgba(212,80,10,0.08)" }}
                      >
                        <svg
                          className="w-3.5 h-3.5"
                          style={{ color: "#D4500A" }}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold text-gray-800 leading-tight">
                          Submittal approved
                        </p>
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          3 minutes ago
                        </p>
                      </div>
                    </div>
                  </Bezel>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Stats strip ── */}
        <section
          className="border-y py-12 px-6 sm:px-10"
          style={{ borderColor: "rgba(0,0,0,0.06)", background: "#FFFFFF" }}
        >
          <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((s) => (
              <div key={s.label} className="flex flex-col gap-1">
                <span className="font-display text-3xl text-gray-950 tabular-nums">
                  {s.value}
                </span>
                <span className="text-sm text-gray-400">{s.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── Features Bento Grid ── */}
        <section id="features" className="py-24 px-6 sm:px-10" style={{ background: "#FAFAF9" }}>
          <div className="max-w-7xl mx-auto">
            {/* Section header */}
            <div className="mb-14 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <div>
                <span className="eyebrow mb-3">Platform</span>
                <h2 className="font-display text-4xl sm:text-5xl text-gray-950 mt-2">
                  Everything your
                  <br />
                  crew needs
                </h2>
              </div>
              <a
                href="#features"
                className="self-start sm:self-auto text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors duration-150 flex items-center gap-1.5 shrink-0"
              >
                See all features
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </a>
            </div>

            {/* Bento grid — asymmetric 4-col layout */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {features.map((f) => (
                <div
                  key={f.name}
                  className={f.large ? "col-span-2" : "col-span-1"}
                >
                  <Bezel size="md" elevation="flat" className="h-full" innerClassName="h-full">
                    <div className="h-full p-6 flex flex-col gap-4">
                      {/* Accent dot */}
                      <div
                        className="w-8 h-8 rounded-xl flex items-center justify-center"
                        style={{ background: `${f.accentColor}0f` }}
                      >
                        <div
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ background: f.accentColor }}
                        />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900 mb-1.5">
                          {f.name}
                        </h3>
                        <p className="text-sm text-gray-500 leading-relaxed">
                          {f.desc}
                        </p>
                      </div>
                    </div>
                  </Bezel>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Final CTA ── */}
        <section
          className="py-28 px-6 sm:px-10"
          style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}
        >
          <div className="max-w-7xl mx-auto">
            <Bezel size="xl" elevation="flat">
              <div className="px-10 py-20 text-center relative overflow-hidden">
                {/* Subtle ambient gradient */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  aria-hidden="true"
                  style={{
                    background:
                      "radial-gradient(ellipse 70% 60% at 50% 0%, rgba(212,80,10,0.04) 0%, transparent 70%)",
                  }}
                />

                <div className="relative">
                  <Eyebrow className="mb-6">Get started today</Eyebrow>

                  <h2
                    className="font-display text-4xl sm:text-5xl md:text-6xl text-gray-950 leading-tight"
                  >
                    Ready to take command?
                  </h2>

                  <p className="mt-5 text-lg text-gray-400 max-w-md mx-auto leading-relaxed">
                    Join 200+ construction teams already running smarter
                    projects.
                  </p>

                  <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
                    <a
                      href="/demo"
                      className="inline-flex items-center gap-2 px-8 py-4 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl transition-all duration-200 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-900 active:scale-[0.98]"
                    >
                      Explore the Demo
                    </a>
                  </div>
                </div>
              </div>
            </Bezel>
          </div>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer
        className="py-10 px-6 sm:px-10"
        style={{ borderTop: "1px solid rgba(0,0,0,0.06)", background: "#FAFAF9" }}
      >
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <span className="font-display text-sm text-gray-900">
            SiteCommand
          </span>
          <div className="flex flex-wrap gap-6 text-xs text-gray-400">
            <a href="/demo" className="hover:text-gray-700 transition-colors">
              Demo
            </a>
            <a href="#" className="hover:text-gray-700 transition-colors">
              Privacy policy
            </a>
            <a href="#" className="hover:text-gray-700 transition-colors">
              Terms of service
            </a>
          </div>
          <p className="text-xs text-gray-400">
            &copy; {new Date().getFullYear()} SiteCommand
          </p>
        </div>
      </footer>
    </div>
  );
}
