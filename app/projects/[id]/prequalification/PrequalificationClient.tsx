"use client";

import ProjectNav from "@/components/ProjectNav";

export default function PrequalificationClient({
  projectId,
  role,
  username,
}: {
  projectId: string;
  role: string;
  username: string;
}) {
  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <header className="bg-[#F9FAFB] border-b border-black/[0.06] px-6 h-14 flex items-center justify-between">
        <a href="/dashboard" className="text-sm font-semibold text-gray-900 hover:text-gray-600 transition-colors">
          SiteCommand
        </a>
        <div className="flex items-center gap-5">
          <span className="text-sm text-gray-400">{username}</span>
          <button
            onClick={handleLogout}
            className="text-sm text-gray-400 hover:text-gray-900 transition-colors"
          >
            Logout
          </button>
        </div>
      </header>

      <ProjectNav projectId={projectId} />

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-end justify-between mb-8 gap-4 flex-wrap">
          <div>
            <h1 className="font-display text-[32px] leading-[1.05] tracking-[-0.012em] text-[color:var(--ink)]">
              Prequalification
            </h1>
            <p className="sub mt-1.5">
              <em>Vetting the trades before they bid</em>
              <span className="sep">·</span>
              <span className="num">0</span> qualified
              <span className="sep">·</span>
              <span className="num">0</span> pending
            </p>
          </div>
          <button type="button" className="btn-primary" disabled>
            New Prequalification
          </button>
        </div>

        <div className="card card-pad flex flex-col items-center text-center py-16">
          <span className="pill pill-warn mb-4">Coming soon</span>
          <h3 className="font-display text-[20px] leading-tight text-[color:var(--ink)] mb-1.5">
            Prequalification
          </h3>
          <p className="text-sm text-[color:var(--ink-soft)] max-w-xs leading-relaxed">
            Subcontractor and vendor prequalification management is on the way — track
            qualification status, insurance, and bonding before awarding work.
          </p>
        </div>
      </main>
    </div>
  );
}
