"use client";

import { useState, useRef } from "react";
import Link from "next/link";

type NavSubItem = { label: string; href: string };

type SolutionsProduct = { label: string; description: string; href: string };
type SolutionsCapabilityColumn = { heading: string; items: NavSubItem[] };

const solutionsProducts: SolutionsProduct[] = [
  { label: "Project Execution", description: "Build with confidence from start to finish", href: "/project-execution/general-contractors" },
  { label: "Cost Management", description: "Take control of your project financials", href: "/cost-management/general-contractors" },
  { label: "Resource Management", description: "Optimize every crew, hour, and piece of equipment", href: "/resource-management/general-contractors" },
];

const solutionsCapabilities: SolutionsCapabilityColumn[] = [
  {
    heading: "Preconstruction",
    items: [
      { label: "Bid Management", href: "/bid-management" },
      { label: "BIM", href: "/bim" },
      { label: "Estimating", href: "/estimating" },
      { label: "Prequalification", href: "/prequalification" },
    ],
  },
  {
    heading: "Construction",
    items: [
      { label: "Project Management", href: "/solutions/project-management" },
      { label: "Quality & Safety", href: "/solutions/quality-and-safety" },
      { label: "Schedule", href: "/solutions/schedule" },
      { label: "RFI", href: "/solutions/rfi" },
    ],
  },
  {
    heading: "Financials",
    items: [
      { label: "Budget Management", href: "#" },
      { label: "Invoice Management", href: "#" },
      { label: "Project Financials", href: "#" },
      { label: "Time Tracking", href: "#" },
    ],
  },
  {
    heading: "Platform",
    items: [
      { label: "Analytics", href: "#" },
      { label: "Document Management", href: "#" },
      { label: "Equipment", href: "#" },
      { label: "Workforce Management", href: "#" },
    ],
  },
];

const navItems: { label: string; items: NavSubItem[]; href?: string }[] = [
  {
    label: "Solutions",
    items: [], // handled separately via mega-menu
  },
  {
    label: "About Us",
    items: [
      { label: "Company", href: "/about" },
      { label: "Press", href: "#" },
    ],
  },
  {
    label: "Resources",
    items: [
      { label: "Documentation", href: "#" },
      { label: "Blog", href: "#" },
      { label: "Case Studies", href: "/case-studies" },
      { label: "Community", href: "#" },
    ],
  },
  {
    label: "Pricing",
    items: [],
    href: "/pricing",
  },
];

type NavbarProps = { hidePricing?: boolean };

export default function Navbar({ hidePricing = true }: NavbarProps) {
  const [open, setOpen] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const visibleNavItems = hidePricing
    ? navItems.filter((item) => item.label !== "Pricing")
    : navItems;

  const handleEnter = (label: string) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(label);
  };

  const handleLeave = () => {
    closeTimer.current = setTimeout(() => setOpen(null), 250);
  };

  return (
    <nav
      className="sticky top-0 z-50 border-b"
      style={{
        background: "rgba(250,250,249,0.85)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderColor: "rgba(0,0,0,0.05)",
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-10 flex items-center justify-between h-14">
        {/* Logo */}
        <a
          href="https://sitecommand.xyz"
          className="text-base font-semibold tracking-tight text-gray-900 hover:opacity-80 transition-opacity shrink-0"
          style={{ letterSpacing: "-0.01em" }}
        >
          SiteCommand
        </a>

        {/* Desktop nav items */}
        <div className="hidden md:flex items-center gap-1">
          {visibleNavItems.map((item) => (
            <div
              key={item.label}
              className="relative"
              onMouseEnter={() => handleEnter(item.label)}
              onMouseLeave={handleLeave}
            >
              <button
                className="flex items-center gap-1 px-4 py-2 text-sm text-gray-600 hover:text-gray-900 rounded-md hover:bg-gray-50 active:bg-gray-100 transition-all duration-150"
                onClick={() =>
                  item.items.length === 0 && item.label !== "Solutions"
                    ? (window.location.href = item.href ?? "#")
                    : setOpen(open === item.label ? null : item.label)
                }
              >
                {item.label}
                {(item.items.length > 0 || item.label === "Solutions") && (
                  <svg
                    className={`w-3.5 h-3.5 transition-transform ${open === item.label ? "rotate-180" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                )}
              </button>

              {/* Solutions mega-menu */}
              {item.label === "Solutions" && open === "Solutions" && (
                <div
                  className="fixed left-0 right-0 bg-white border-t border-gray-200 shadow-xl"
                  style={{ top: "56px" }}
                  onMouseEnter={() => handleEnter("Solutions")}
                  onMouseLeave={handleLeave}
                >
                  <div className="max-w-7xl mx-auto px-6 py-8">
                    {/* Products section */}
                    <p className="text-xs font-semibold tracking-wide text-gray-400 mb-5">Products</p>
                    <div className="grid grid-cols-3 gap-6 mb-10">
                      {solutionsProducts.map((product) => (
                        <a key={product.label} href={product.href} className="group flex flex-col gap-1 p-4 rounded-lg hover:bg-gray-50 transition-colors">
                          <span className="font-semibold text-gray-900 group-hover:text-gray-700">
                            {product.label} →
                          </span>
                          <span className="text-sm text-orange-500">{product.description}</span>
                        </a>
                      ))}
                    </div>

                    {/* Featured Capabilities section */}
                    <p className="text-xs font-semibold tracking-wide text-gray-400 mb-5">Featured capabilities</p>
                    <div className="grid grid-cols-4 gap-6 mb-6">
                      {solutionsCapabilities.map((col) => (
                        <div key={col.heading}>
                          <p className="font-semibold text-gray-900 mb-3">{col.heading}</p>
                          <ul className="space-y-2">
                            {col.items.map((item) => (
                              <li key={item.label}>
                                <a href={item.href} className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
                                  {item.label}
                                </a>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>

                    <a href="#" className="text-sm font-medium text-gray-900 hover:underline">
                      View more capabilities →
                    </a>
                  </div>
                </div>
              )}

              {/* Standard dropdown */}
              {item.label !== "Solutions" && item.items.length > 0 && open === item.label && (
                <div
                  className={`absolute top-full left-0 mt-1 bg-white border border-gray-100 rounded-lg shadow-lg py-1 ${item.sections ? "w-[580px]" : "w-44"}`}
                  onMouseEnter={() => handleEnter(item.label)}
                  onMouseLeave={handleLeave}
                >
                  {item.items.map((sub) => (
                    <a
                      key={sub.label}
                      href={sub.href}
                      className="block px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors"
                    >
                      {sub.label}
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {/* Login — plain text link */}
          <Link
            href="/login"
            className="hidden md:inline text-sm text-gray-500 hover:text-gray-900 transition-colors duration-150"
          >
            Login
          </Link>

          {/* Hamburger — mobile only */}
          <button
            className="md:hidden p-2 text-gray-600 hover:text-gray-900 rounded-md hover:bg-gray-50 transition-colors"
            onClick={() => setMobileOpen((o) => !o)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden border-t border-gray-100 bg-white px-4 py-3 space-y-1">
          {visibleNavItems.map((item) => (
            <div key={item.label}>
              {item.items.length === 0 && item.label !== "Solutions" ? (
                <a
                  href={item.href ?? "#"}
                  className="block px-3 py-2 text-sm text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                  onClick={() => setMobileOpen(false)}
                >
                  {item.label}
                </a>
              ) : (
                <div>
                  <button
                    className="w-full text-left px-3 py-2 text-sm font-medium text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                    onClick={() => setOpen(open === item.label ? null : item.label)}
                  >
                    {item.label}
                  </button>
                  {open === item.label && item.label === "Solutions" && (
                    <div className="pl-4 space-y-1 mb-1">
                      {solutionsCapabilities.flatMap((col) => col.items).map((sub) => (
                        <a
                          key={sub.label}
                          href={sub.href}
                          className="block px-3 py-1.5 text-sm text-gray-500 rounded-md hover:bg-gray-50 transition-colors"
                        >
                          {sub.label}
                        </a>
                      ))}
                    </div>
                  )}
                  {open === item.label && item.label !== "Solutions" && (
                    <div className="pl-4 space-y-1 mb-1">
                      {item.items.map((sub) => (
                        <a
                          key={sub.label}
                          href={sub.href}
                          className="block px-3 py-1.5 text-sm text-gray-500 rounded-md hover:bg-gray-50 transition-colors"
                        >
                          {sub.label}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          <div className="pt-2 mt-2 border-t border-gray-100 space-y-2">
            <Link
              href="/login"
              className="block px-3 py-2 text-sm text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
              onClick={() => setMobileOpen(false)}
            >
              Login
            </Link>
            <Link
              href="/signup"
              className="block px-3 py-2 text-sm font-semibold text-white rounded-md text-center"
              style={{ background: "#111110" }}
              onClick={() => setMobileOpen(false)}
            >
              Start Free Trial
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
