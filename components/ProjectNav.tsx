"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { TOOL_SECTIONS } from "@/lib/tool-sections";

// ProjectNav uses slug "" for Home; remap from the shared "home" slug
const NAV_TOOL_SECTIONS = TOOL_SECTIONS.map((section) => ({
  ...section,
  items: section.items.map((item) => ({
    ...item,
    slug: item.slug === "home" ? "" : item.slug,
  })),
}));

function isToolEnabled(slug: string, enabledFeatures: string[] | null | undefined): boolean {
  if (!slug) return true;
  // Core admin is always available from the project navigation.
  if (slug === "admin") return true;
  // Assist is a core tool, available on every project regardless of feature allowlist.
  if (slug === "assist") return true;
  // Accounting → Transaction Orders launched after existing company allowlists
  // were created, so it shows everywhere by default until allowlists are updated.
  if (slug === "transaction-orders") return true;
  // Project Tools → Permit Applications also launched after many existing
  // company allowlists were created, so default to visible unless explicitly
  // removed through project/user tool permissions.
  if (slug === "permit-applications") return true;
  if (!enabledFeatures) return true;
  if (enabledFeatures.includes(slug)) return true;
  // Backward compatibility: existing companies with feature allowlists often enabled
  // Transmittals before T&M Tickets existed. Treat T&M Tickets as enabled in that case.
  if (slug === "tm-tickets" && enabledFeatures.includes("transmittals")) return true;
  // Backward compatibility: Timesheets launched after legacy allowlists were created.
  // If workforce tools are enabled through either direct T&M Tickets access or
  // the legacy Transmittals fallback, surface Timesheets as well.
  if (slug === "timesheets" && (enabledFeatures.includes("tm-tickets") || enabledFeatures.includes("transmittals"))) {
    return true;
  }
  return false;
}

export default function ProjectNav({
  projectId,
  showBackToProject = true,
}: {
  projectId: string;
  showBackToProject?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const toolsRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const router = useRouter();

  const [portalSearch, setPortalSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [searchResults, setSearchResults] = useState<
    { id: string; title: string; subtitle: string; href: string; section: string }[]
  >([]);

  // null = not loaded yet, undefined = no restrictions (all enabled)
  const [enabledFeatures, setEnabledFeatures] = useState<string[] | null | undefined>(null);

  // Settings modal state
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"password" | "phone" | "favorites">("password");
  const [phone, setPhone] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [settingsError, setSettingsError] = useState("");
  const [settingsSuccess, setSettingsSuccess] = useState("");

  // Favorites state
  const [favorites, setFavorites] = useState<string[]>([]);
  const [favoritesLoaded, setFavoritesLoaded] = useState(false);
  const projectBasePath = `/projects/${projectId}`;

  const inProjectScope = pathname === projectBasePath || pathname?.startsWith(`${projectBasePath}/`);
  const isProjectHome = pathname === projectBasePath;
  const projectRelativePath = pathname?.startsWith(projectBasePath)
    ? pathname.slice(projectBasePath.length)
    : "";
  const projectSegments = projectRelativePath.split("/").filter(Boolean);
  const parentSegments = projectSegments.slice(0, -1);
  const parentHref = parentSegments.length
    ? `${projectBasePath}/${parentSegments.join("/")}`
    : projectBasePath;
  const showLayerUp = showBackToProject && inProjectScope && !isProjectHome;

  // Click outside for tools dropdown
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (toolsRef.current && !toolsRef.current.contains(e.target as Node)) setOpen(false);
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowSearchResults(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    const q = portalSearch.trim();
    if (q.length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    const SECTION_LABELS: Record<string, string> = {
      project: "Projects",
      rfi: "RFIs",
      submittal: "Submittals",
      document: "Documents",
      task: "Tasks",
      drawing: "Drawings",
    };

    let cancelled = false;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/search/global?q=${encodeURIComponent(q)}`);
        if (!res.ok) {
          if (!cancelled) setSearchResults([]);
          return;
        }
        const data: { id: string; type: string; title: string; subtitle: string; href: string }[] = await res.json();
        if (cancelled) return;
        setSearchResults(
          (Array.isArray(data) ? data : []).map((r) => ({
            id: r.id,
            title: r.title,
            subtitle: r.subtitle,
            href: r.href,
            section: SECTION_LABELS[r.type] ?? r.type,
          }))
        );
      } catch {
        if (!cancelled) setSearchResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [portalSearch]);

  // Fetch favorites on mount
  useEffect(() => {
    fetch("/api/user/favorites")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.favorites)) setFavorites(d.favorites);
        setFavoritesLoaded(true);
      })
      .catch(() => setFavoritesLoaded(true));
  }, []);

  // Fetch enabled features for this project's company
  useEffect(() => {
    fetch(`/api/projects/${projectId}/features`)
      .then((r) => r.json())
      .then((d) => {
        // null means no restrictions; array means explicit allowlist
        setEnabledFeatures(d.enabled_features ?? undefined);
      })
      .catch(() => setEnabledFeatures(undefined));
  }, [projectId]);

  // Redirect if the current page's tool has been disabled for this company
  useEffect(() => {
    if (enabledFeatures === null || enabledFeatures === undefined) return;
    // Extract the tool slug from the URL: /projects/[id]/[slug]
    const match = pathname.match(/\/projects\/[^/]+\/([^/]+)/);
    const currentSlug = match?.[1] ?? "";
    if (!currentSlug) return; // project home is always accessible
    // Gate feature-controlled slugs only (never gate built-in pages such as admin).
    const allFeatureSlugs = NAV_TOOL_SECTIONS.flatMap((s) => s.items.map((i) => i.slug)).filter(Boolean);
    const isUngatedBuiltIn = currentSlug === "admin";
    if (!isUngatedBuiltIn && allFeatureSlugs.includes(currentSlug) && !isToolEnabled(currentSlug, enabledFeatures)) {
      router.replace(`/projects/${projectId}`);
    }
  }, [enabledFeatures, pathname, projectId, router]);

  async function openSettings() {
    setSettingsError("");
    setSettingsSuccess("");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    const r = await fetch("/api/user/profile");
    const d = await r.json();
    setPhone(d.phone ?? "");
    setShowSettings(true);
  }

  async function handleSavePassword() {
    if (!newPassword) return;
    if (newPassword !== confirmPassword) {
      setSettingsError("Passwords do not match");
      return;
    }
    setSaving(true);
    setSettingsError("");
    setSettingsSuccess("");
    const r = await fetch("/api/user/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const d = await r.json();
    setSaving(false);
    if (!r.ok) setSettingsError(d.error || "Failed to update password");
    else {
      setSettingsSuccess("Password updated");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }
  }

  async function handleSavePhone() {
    setSaving(true);
    setSettingsError("");
    setSettingsSuccess("");
    const r = await fetch("/api/user/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    const d = await r.json();
    setSaving(false);
    if (!r.ok) setSettingsError(d.error || "Failed to update phone");
    else setSettingsSuccess("Phone number updated");
  }

  async function handleSaveFavorites() {
    setSaving(true);
    setSettingsError("");
    setSettingsSuccess("");
    const r = await fetch("/api/user/favorites", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ favorites }),
    });
    setSaving(false);
    if (!r.ok) setSettingsError("Failed to save favorites");
    else setSettingsSuccess("Favorites saved");
  }

  function toggleFavorite(slug: string) {
    setFavorites((prev) =>
      prev.includes(slug) ? prev.filter((f) => f !== slug) : [...prev, slug]
    );
  }

  // Filter sections by enabled features (null/undefined = no restrictions)
  const visibleSections = NAV_TOOL_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter(
      (item) => isToolEnabled(item.slug, enabledFeatures)
    ),
  })).filter((section) => section.items.length > 0);

  const allToolItems = visibleSections.flatMap((s) => s.items).filter((i) => i.slug);
  const favoritedItems = favoritesLoaded
    ? allToolItems.filter((i) => favorites.includes(i.slug))
    : [];

  return (
    <>
      <nav className="sticky top-0 z-40 bg-[#FAFAF7]/85 backdrop-blur-md border-b border-black/[0.06] w-full flex items-center overflow-visible relative">
        {/* Non-scrollable left: back links + tools dropdown */}
        <div className="flex items-center gap-4 pl-6 shrink-0">
          {/* Home */}
          <a
            href="/dashboard"
            className="flex items-center py-2.5 text-gray-400 hover:text-gray-700 transition-colors shrink-0"
            title="All Projects"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </a>

          {showLayerUp && (
            <>
              <div className="w-px h-4 bg-gray-200" />
              <a
                href={parentHref}
                className="flex items-center gap-1.5 py-2.5 text-sm text-gray-400 hover:text-gray-700 transition-colors shrink-0"
                title="Go up one level"
              >
                ←
              </a>
            </>
          )}

          <div className="w-px h-4 bg-gray-200" />

          {/* Tools dropdown */}
          <div ref={toolsRef} className="relative inline-block">
            <button
              onClick={() => setOpen((o) => !o)}
              className="flex items-center gap-1.5 py-2.5 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
            >
              Tools
              <svg
                className={`w-4 h-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {open && (
              <div className="absolute left-0 top-full mt-1 w-56 sm:w-[min(96vw,1120px)] bg-white border border-gray-100 rounded-xl shadow-xl z-[9999] p-5 max-h-[80vh] overflow-y-auto">
                <div className="grid grid-cols-1 gap-1 sm:grid-cols-5 sm:gap-6">
                  {visibleSections.map((section) => (
                    <div key={section.label}>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2 mt-3 sm:mt-0">
                        {section.label}
                      </p>
                      <div className="space-y-0.5">
                        {section.items.map((item) => (
                          <a
                            key={item.slug}
                            href={`/projects/${projectId}${item.slug ? `/${item.slug}` : ""}`}
                            onClick={() => setOpen(false)}
                            className="block px-2 py-1.5 text-sm text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                          >
                            {item.name}
                          </a>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Scrollable middle: favorites + search */}
        <div className="flex items-center gap-4 overflow-x-auto flex-1 min-w-0 px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {/* Favorite links */}
          {favoritedItems.length > 0 && (
            <>
              <div className="w-px h-4 bg-gray-200 shrink-0" />
              {favoritedItems.map((item) => (
                <a
                  key={item.slug}
                  href={`/projects/${projectId}/${item.slug}`}
                  className="py-2.5 text-sm text-gray-500 hover:text-gray-900 transition-colors shrink-0"
                >
                  {item.name}
                </a>
              ))}
            </>
          )}

          <div ref={searchRef} className="relative ml-auto shrink-0 w-64">
            <svg
              className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            <input
              value={portalSearch}
              onChange={(e) => {
                setPortalSearch(e.target.value);
                setShowSearchResults(true);
              }}
              onFocus={() => setShowSearchResults(true)}
              placeholder="Search portal..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
            {showSearchResults && portalSearch.trim().length >= 2 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-[9999] max-h-[26rem] overflow-y-auto">
                {searching && <p className="px-3 py-2 text-xs text-gray-400">Searching portal...</p>}
                {!searching && searchResults.length === 0 && (
                  <p className="px-3 py-2 text-xs text-gray-400">No results found.</p>
                )}
                {!searching && searchResults.length > 0 && (
                  <div className="py-1">
                    {searchResults.map((result) => (
                      <a
                        key={result.id}
                        href={result.href}
                        className="block px-3 py-2 hover:bg-gray-50"
                        onClick={() => setShowSearchResults(false)}
                      >
                        <p className="text-sm text-gray-900 font-medium truncate">{result.title}</p>
                        <p className="text-xs text-gray-500 truncate">{result.section} • {result.subtitle}</p>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Non-scrollable right: settings */}
        <div className="pl-2 pr-6 shrink-0">
          <button
            onClick={openSettings}
            className="py-2.5 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
            title="Settings"
          >
            Settings
          </button>
        </div>
      </nav>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl w-full max-w-md shadow-xl flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900">Account Settings</h2>
              <button
                onClick={() => setShowSettings(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-100 px-6">
              {(["password", "phone", "favorites"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => { setSettingsTab(tab); setSettingsError(""); setSettingsSuccess(""); }}
                  className={`py-3 px-1 mr-6 text-sm font-medium border-b-2 transition-colors ${
                    settingsTab === tab
                      ? "border-gray-900 text-gray-900"
                      : "border-transparent text-gray-400 hover:text-gray-700"
                  }`}
                >
                  {tab === "password" ? "Password" : tab === "phone" ? "Phone" : "Favorites"}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="px-6 py-5 overflow-y-auto">
              {settingsError && (
                <p className="text-xs text-red-500 mb-3">{settingsError}</p>
              )}
              {settingsSuccess && (
                <p className="text-xs text-green-600 mb-3">{settingsSuccess}</p>
              )}

              {settingsTab === "password" && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Current Password</label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                      placeholder="Enter current password"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">New Password</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                      placeholder="Enter new password"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Confirm New Password</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                      placeholder="Confirm new password"
                    />
                  </div>
                  <button
                    onClick={handleSavePassword}
                    disabled={saving}
                    className="w-full py-2 bg-gray-900 text-white rounded-md text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-50 mt-1"
                  >
                    {saving ? "Saving..." : "Update Password"}
                  </button>
                </div>
              )}

              {settingsTab === "phone" && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Phone Number</label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                      placeholder="(555) 000-0000"
                    />
                  </div>
                  <button
                    onClick={handleSavePhone}
                    disabled={saving}
                    className="w-full py-2 bg-gray-900 text-white rounded-md text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-50 mt-1"
                  >
                    {saving ? "Saving..." : "Save Phone Number"}
                  </button>
                </div>
              )}

              {settingsTab === "favorites" && (
                <div className="space-y-4">
                  <p className="text-xs text-gray-400">Select pages to pin in your project navigation bar.</p>
                  {visibleSections.map((section) => (
                    <div key={section.label}>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">
                        {section.label}
                      </p>
                      <div className="space-y-1">
                        {section.items
                          .filter((item) => item.slug)
                          .map((item) => (
                            <label
                              key={item.slug}
                              className="flex items-center gap-2.5 cursor-pointer py-1"
                            >
                              <input
                                type="checkbox"
                                checked={favorites.includes(item.slug)}
                                onChange={() => toggleFavorite(item.slug)}
                                className="w-3.5 h-3.5 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                              />
                              <span className="text-sm text-gray-700">{item.name}</span>
                            </label>
                          ))}
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={handleSaveFavorites}
                    disabled={saving}
                    className="w-full py-2 bg-gray-900 text-white rounded-md text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-50 mt-2"
                  >
                    {saving ? "Saving..." : "Save Favorites"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
