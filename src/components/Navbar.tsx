import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

type SectionItem = { label: string; href: string };
type NavItemType = {
  label: string;
  href?: string;
  items?: string[];
  sections?: { label: string; items: SectionItem[] }[];
};

const navItems: NavItemType[] = [
  {
    label: "Solutions",
    sections: [
      {
        label: "Preconstruction",
        items: [
          { label: "Bid Management", href: "/bid-management" },
          { label: "BIM", href: "/bim" },
          { label: "Estimating", href: "/estimating" },
          { label: "Prequalification", href: "/prequalification" },
        ],
      },
      {
        label: "Construction",
        items: [
          { label: "Project Management", href: "#" },
          { label: "Quality & Safety", href: "#" },
          { label: "Schedule", href: "#" },
          { label: "RFI", href: "#" },
        ],
      },
      {
        label: "Financials",
        items: [
          { label: "Budget Management", href: "#" },
          { label: "Invoice Management", href: "#" },
          { label: "Project Financials", href: "#" },
          { label: "Time Tracking", href: "#" },
        ],
      },
      {
        label: "Platform",
        items: [
          { label: "Analytics", href: "#" },
          { label: "Document Management", href: "#" },
          { label: "Equipment", href: "#" },
          { label: "Workforce Management", href: "#" },
        ],
      },
    ],
  },
  { label: "About Us", items: ["Company", "Team", "Press"] },
  { label: "Resources", items: ["Documentation", "Blog", "Case Studies", "Community"] },
  { label: "Pricing", items: [], href: "/pricing" },
];

type NavbarProps = { hidePricing?: boolean };

export default function Navbar({ hidePricing = true }: NavbarProps) {
  const [open, setOpen] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const visibleNavItems = hidePricing
    ? navItems.filter((item) => item.label !== "Pricing")
    : navItems;
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
        <a href="https://sitecommand.xyz" className="text-lg font-semibold tracking-tight text-gray-900 hover:opacity-80 transition-opacity shrink-0">
          SiteCommand
        </a>
        <div className="hidden md:flex items-center gap-1">
          {visibleNavItems.map((item) => (
            <div
              key={item.label}
              className="relative"
              onMouseEnter={() => ((item.items?.length ?? 0) > 0 || (item.sections?.length ?? 0) > 0) && setOpen(item.label)}
              onMouseLeave={() => setOpen(null)}
            >
              <button
                className="flex items-center gap-1 px-4 py-2 text-sm text-gray-600 hover:text-gray-900 rounded-md hover:bg-gray-50 transition-colors"
                onClick={() => (item.items?.length ?? 0) === 0 && (item.sections?.length ?? 0) === 0 ? navigate(item.href || "#") : setOpen(open === item.label ? null : item.label)}
              >
                {item.label}
                {((item.items?.length ?? 0) > 0 || (item.sections?.length ?? 0) > 0) && (
                  <svg className={`w-3.5 h-3.5 transition-transform ${open === item.label ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                )}
              </button>
              {((item.items?.length ?? 0) > 0 || (item.sections?.length ?? 0) > 0) && open === item.label && (
                <div className={`absolute top-full left-0 mt-1 bg-white border border-gray-100 rounded-lg shadow-lg py-1 ${item.sections ? "w-[760px]" : "w-44"}`}>
                  {item.sections ? (
                    <div className="grid grid-cols-4 gap-0 p-4">
                      {item.sections.map((section) => (
                        <div key={section.label}>
                          <p className="px-2 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">{section.label}</p>
                          {section.items.map((sub) => (
                            <Link key={sub.label} to={sub.href} className="block px-2 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded transition-colors">{sub.label}</Link>
                          ))}
                        </div>
                      ))}
                    </div>
                  ) : (
                    item.items?.map((sub) => (
                      <a key={sub} href="#" className="block px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors">{sub}</a>
                    ))
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <Link to="/login" className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-md hover:bg-gray-700 transition-colors">Login</Link>
          <button className="md:hidden p-2 text-gray-600 hover:text-gray-900 rounded-md hover:bg-gray-50 transition-colors" onClick={() => setMobileOpen((o) => !o)}>
            {mobileOpen ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
            )}
          </button>
        </div>
      </div>
    </nav>
  );
}
