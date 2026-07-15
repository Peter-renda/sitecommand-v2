import React from "react";

export function LogoMark({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 1.5 L21.5 7 V17 L12 22.5 L2.5 17 V7 Z" fill="#2C7B8C" />
      <path d="M12 1.5 L21.5 7 V17 L12 22.5 Z" fill="#1E3A5F" />
      <path d="M12 12 L21.5 7 V17 L12 22.5 Z" fill="#E86F2C" />
      <path d="M12 1.5 L21.5 7 L12 12 L2.5 7 Z" fill="#2C7B8C" opacity="0.9" />
    </svg>
  );
}

export function Brand({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center ${className}`}>
      <span className="text-sm font-semibold text-gray-900">SiteCommand</span>
    </div>
  );
}

export function Eyebrow({ children, quiet = false }: { children: React.ReactNode; quiet?: boolean }) {
  return <span className={`eyebrow ${quiet ? "eyebrow-quiet" : ""}`}>{children}</span>;
}

export function Pill({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return <span className={`pill ${className}`}>{children}</span>;
}

export function WeatherGlyph({ kind }: { kind: "sun" | "cloud" | "rain" | "snow" | "storm" | "fog" | "unknown" }) {
  if (kind === "sun") return <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><circle cx="12" cy="12" r="4" /><path strokeLinecap="round" d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" /></svg>;
  if (kind === "rain") return <svg className="w-4 h-4 text-sky-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999A5.002 5.002 0 006 5a5 5 0 00-4 9z" /><path strokeLinecap="round" d="M8 18l-1 2m5-2l-1 2m5-2l-1 2"/></svg>;
  if (kind === "snow") return <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999A5.002 5.002 0 006 5a5 5 0 00-4 9z" /><path strokeLinecap="round" d="M9 19h.01M12 20h.01M15 19h.01"/></svg>;
  if (kind === "storm") return <svg className="w-4 h-4 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999A5.002 5.002 0 006 5a5 5 0 00-4 9z" /><path strokeLinecap="round" strokeLinejoin="round" d="M13 14l-2 4h2l-2 4"/></svg>;
  if (kind === "fog") return <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" d="M4 10h16M2 14h20M5 18h14"/></svg>;
  if (kind === "cloud") return <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999A5.002 5.002 0 006 5a5 5 0 00-4 9z" /></svg>;
  return <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41"/></svg>;
}
