"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const justSignedUp = searchParams.get("registered") === "1";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error);
      return;
    }

    window.location.href = data.redirect ?? "/dashboard";
  }

  return (
    <div className="min-h-dvh flex items-center justify-center px-6 py-12" style={{ background: "#FAFAF9" }}>
      <div className="w-full max-w-sm">
        {/* Brand link */}
        <a href="/" className="inline-block mb-10">
          <span className="font-display text-lg text-gray-900">SiteCommand</span>
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
            <h1 className="font-display text-2xl text-gray-950 mb-2">Sign in</h1>
            <p className="text-sm text-gray-400 mb-8">
              Don&apos;t have an account?{" "}
              <Link href="/signup" className="text-gray-900 font-medium hover:underline">
                Sign up →
              </Link>
            </p>

            {justSignedUp && (
              <div className="mb-6 bg-green-50 border border-green-100 rounded-xl px-4 py-3">
                <p className="text-sm text-green-700 font-medium">Account created!</p>
                <p className="text-xs text-green-600 mt-0.5">Sign in to finish setting up your account.</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 tracking-wide">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 border rounded-xl text-sm text-gray-900 bg-white transition-all focus:outline-none"
                  style={{
                    borderColor: "rgba(0,0,0,0.1)",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.9)",
                  }}
                  onFocus={e => e.currentTarget.style.borderColor = "#2563EB"}
                  onBlur={e => e.currentTarget.style.borderColor = "rgba(0,0,0,0.1)"}
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 tracking-wide">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 border rounded-xl text-sm text-gray-900 bg-white transition-all focus:outline-none"
                  style={{
                    borderColor: "rgba(0,0,0,0.1)",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.9)",
                  }}
                  onFocus={e => e.currentTarget.style.borderColor = "#2563EB"}
                  onBlur={e => e.currentTarget.style.borderColor = "rgba(0,0,0,0.1)"}
                  placeholder="••••••••"
                />
              </div>

              {error && <p className="text-sm text-red-500">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="group relative w-full py-3 px-4 rounded-xl text-sm font-semibold text-white overflow-hidden transition-all active:scale-[0.98] disabled:opacity-50"
                style={{ background: "#111110" }}
              >
                <span className="relative z-10">{loading ? "Signing in..." : "Sign in"}</span>
                <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-[0.08] transition-opacity" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
