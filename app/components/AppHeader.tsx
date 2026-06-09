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
        {username ? (
          <div className="relative group">
            <span className="text-sm text-gray-400 cursor-default pb-2 -mb-2" title="Support, Training, and more">
              {username}
            </span>
            <div className="absolute right-0 top-full hidden group-hover:block z-40">
              <div className="w-44 rounded-md border border-gray-200 bg-white py-1 shadow-lg">
                <a
                  href="/support"
                  className="block px-3 py-2 text-xs text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
                >
                  Support
                </a>
                <a
                  href="/training"
                  className="block px-3 py-2 text-xs text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
                >
                  Training
                </a>
                <a
                  href="/settings/account"
                  className="block px-3 py-2 text-xs text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
                >
                  Settings
                </a>
                {showLogout ? (
                  <button
                    onClick={logout}
                    className="block w-full text-left px-3 py-2 text-xs text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
                  >
                    Logout
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        ) : showLogout ? (
          <button onClick={logout} className="text-sm text-gray-400 hover:text-gray-900 transition-colors">
            Logout
          </button>
        ) : null}
      </div>
    </header>
  );
}
