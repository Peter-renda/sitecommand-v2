"use client";

import { useState } from "react";
import Link from "next/link";

export default function DemoPage() {
  const [code, setCode] = useState("sitecommand-demo");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth/demo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Invalid access code");
      return;
    }

    window.location.href = data.redirect ?? "/dashboard";
  }

  return (
    <div className="min-h-dvh flex items-center justify-center px-6 py-12" style={{ background: "#FAFAF9" }}>
      <div className="w-full max-w-sm">
        {/* Brand link */}
        <a href="/" className="inline-block mb-10">
          <span className="text-lg font-semibold text-gray-900">SiteCommand</span>
        </a>

        {/* Outer bezel */}
        <div className="rounded-2xl" style={{
          background: "linear-gradient(145deg, rgba(255,255,255,0.95) 0%, rgba(235,235,233,0.5) 100%)",
          border: "1px solid rgba(0,0,0,0.06)",
          boxShadow: "0 8px 24px rgba(0,0,0,0.06), 0 1px 0 rgba(255,255,255,0.7) inset",
          padding: "1.5px",
        }}>
          {/* Inner core */}
          <div className="rounded-[14px] px-8 py-8" style={{
            background: "#FFFFFF",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9)",
          }}>
            <h1 className="text-2xl font-display text-gray-950 mb-2">Explore the Demo</h1>
            <p className="text-sm text-gray-400 mb-8">
              Get instant access to a fully loaded demo project — no sign-up required.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 tracking-wide">Demo Access Code</label>
                <input
                  type="text"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-full px-3.5 py-2.5 border rounded-xl text-sm text-gray-900 bg-white font-mono transition-all focus:outline-none"
                  style={{
                    borderColor: "rgba(0,0,0,0.1)",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.9)",
                  }}
                  onFocus={e => e.currentTarget.style.borderColor = "#2563EB"}
                  onBlur={e => e.currentTarget.style.borderColor = "rgba(0,0,0,0.1)"}
                  placeholder="sitecommand-demo"
                  autoComplete="off"
                />
              </div>

              {error && <p className="text-sm text-red-500">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="group relative w-full py-3 px-4 rounded-xl text-sm font-semibold text-white overflow-hidden transition-all active:scale-[0.98] disabled:opacity-50"
                style={{ background: "#111110" }}
              >
                <span className="relative z-10">{loading ? "Entering demo..." : "Enter Demo"}</span>
                <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-[0.08] transition-opacity" />
              </button>
            </form>

            <p className="mt-6 text-xs text-gray-400">
              Want your own account?{" "}
              <Link href="/pricing" className="text-gray-600 font-medium hover:underline">
                View plans
              </Link>{" "}
              or{" "}
              <Link href="/" className="text-gray-600 font-medium hover:underline">
                go back home
              </Link>
              .
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
