"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";

/**
 * Left-hand navigation tree for the Training section. The first (and currently
 * only live) section is "Practice" — the project simulation game. Additional
 * sections are stubbed as "coming soon" so the tree reads as a real learning
 * curriculum.
 */

type Leaf = { label: string; href?: string };
type Section = { label: string; items: Leaf[]; defaultOpen?: boolean };

const TREE: Section[] = [
  {
    label: "Practice",
    defaultOpen: true,
    items: [{ label: "Project Simulation", href: "/training/practice" }],
  },
  {
    label: "Guides",
    items: [{ label: "Coming soon" }],
  },
  {
    label: "Videos",
    items: [{ label: "Coming soon" }],
  },
];

export default function TrainingNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState<Record<string, boolean>>(
    Object.fromEntries(TREE.map((s) => [s.label, Boolean(s.defaultOpen)])),
  );

  return (
    <nav className="w-52 shrink-0">
      <p className="px-2 mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
        Training
      </p>
      <div className="space-y-0.5">
        {TREE.map((section) => {
          const isOpen = open[section.label];
          return (
            <div key={section.label}>
              <button
                onClick={() => setOpen((o) => ({ ...o, [section.label]: !o[section.label] }))}
                className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <svg
                  className={`w-3 h-3 text-gray-400 transition-transform ${isOpen ? "rotate-90" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
                {section.label}
              </button>
              {isOpen && (
                <div className="ml-3.5 pl-2.5 border-l border-gray-200 space-y-0.5 py-0.5">
                  {section.items.map((leaf) => {
                    if (!leaf.href) {
                      return (
                        <span
                          key={leaf.label}
                          className="block px-2 py-1.5 text-[13px] text-gray-300 italic cursor-default"
                        >
                          {leaf.label}
                        </span>
                      );
                    }
                    const active = pathname === leaf.href || pathname.startsWith(leaf.href + "/");
                    return (
                      <a
                        key={leaf.label}
                        href={leaf.href}
                        className={`block px-2 py-1.5 rounded-md text-[13px] transition-colors ${
                          active
                            ? "bg-gray-900 text-white font-medium"
                            : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                        }`}
                      >
                        {leaf.label}
                      </a>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
}
