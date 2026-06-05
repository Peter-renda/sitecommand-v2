"use client";

type AppHeaderProps = {
  username?: string | null;
  showLogout?: boolean;
};

async function logout() {
  await fetch("/api/auth/logout", { method: "POST" });
  window.location.href = "/";
}

export default function AppHeader({ username, showLogout = true }: AppHeaderProps) {
  return (
    <header className="bg-[#F9FAFB] border-b border-black/[0.06] px-6 h-14 flex items-center justify-between">
      <a href="/dashboard" className="text-[15px] font-semibold text-[color:var(--ink)] hover:text-gray-600 transition-colors">
        SiteCommand
      </a>
      <div className="flex items-center gap-5">
        {username ? <span className="text-sm text-gray-400">{username}</span> : null}
        {showLogout ? (
          <button onClick={logout} className="text-sm text-gray-400 hover:text-gray-900 transition-colors">
            Logout
          </button>
        ) : null}
      </div>
    </header>
  );
}
