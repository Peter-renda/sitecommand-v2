"use client";

import { useEffect, useRef, useState } from "react";

type AppHeaderProps = {
  username?: string | null;
  showLogout?: boolean;
};

async function logout() {
  await fetch("/api/auth/logout", { method: "POST" });
  window.location.href = "/";
}

export default function AppHeader({ username, showLogout = true }: AppHeaderProps) {
  // Toggled on click/tap so the menu works on touch devices (no hover).
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <header className="bg-[#F9FAFB] border-b border-black/[0.06] px-6 h-14 flex items-center justify-between">
      <a href="/dashboard" className="text-[15px] font-semibold text-[color:var(--ink)] hover:text-gray-600 transition-colors">
        SiteCommand
      </a>
      <div className="flex items-center gap-5">
        {username ? (
          <div className="relative" ref={ref}>
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-haspopup="menu"
              aria-expanded={open}
              className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-700 transition-colors max-w-[160px]"
              title="Support, Training, Settings, Logout"
            >
              <span className="truncate">{username}</span>
              <svg
                className={`w-3.5 h-3.5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {open && (
              <div className="absolute right-0 top-full mt-1 z-40">
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
            )}
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
