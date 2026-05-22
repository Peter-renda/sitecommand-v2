"use client";

import { usePathname } from "next/navigation";

export default function SettingsNav({
  isSiteAdmin,
}: {
  isSiteAdmin: boolean;
}) {
  const pathname = usePathname();

  const navItem = (href: string, label: string) => {
    const active = pathname === href || pathname.startsWith(href + "/");
    return (
      <a
        key={href}
        href={href}
        className={`block px-3 py-2 rounded-md text-sm transition-colors ${
          active
            ? "bg-gray-100 text-gray-900 font-medium"
            : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
        }`}
      >
        {label}
      </a>
    );
  };

  return (
    <nav className="w-44 shrink-0 space-y-0.5">
      {navItem("/settings/account", "Account")}
      {navItem("/settings/dashboard", "Dashboard Settings")}
      {isSiteAdmin && navItem("/settings/platform", "Platform")}
    </nav>
  );
}
