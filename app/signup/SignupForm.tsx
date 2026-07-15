"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function SignupFormInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const plan = searchParams.get("plan");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);

    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstName, lastName, company, email, password, plan }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error);
      return;
    }

    if (data.checkoutUrl) {
      window.location.href = data.checkoutUrl;
      return;
    }

    router.push("/company");
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
            <h1 className="font-display text-2xl text-gray-950 mb-2">Create an account</h1>
            <p className="text-sm text-gray-400 mb-8">
              Already have an account?{" "}
              <Link href="/login" className="text-gray-900 font-medium hover:underline">
                Sign in →
              </Link>
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 tracking-wide">First name</label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full px-3.5 py-2.5 border rounded-xl text-sm text-gray-900 bg-white transition-all focus:outline-none"
                    style={{
                      borderColor: "rgba(0,0,0,0.1)",
                      boxShadow: "0 1px 2px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.9)",
                    }}
                    onFocus={e => e.currentTarget.style.borderColor = "#2563EB"}
                    onBlur={e => e.currentTarget.style.borderColor = "rgba(0,0,0,0.1)"}
                    placeholder="Marcus"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 tracking-wide">Last name</label>
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full px-3.5 py-2.5 border rounded-xl text-sm text-gray-900 bg-white transition-all focus:outline-none"
                    style={{
                      borderColor: "rgba(0,0,0,0.1)",
                      boxShadow: "0 1px 2px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.9)",
                    }}
                    onFocus={e => e.currentTarget.style.borderColor = "#2563EB"}
                    onBlur={e => e.currentTarget.style.borderColor = "rgba(0,0,0,0.1)"}
                    placeholder="Rivera"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 tracking-wide">Company name</label>
                <input
                  type="text"
                  required
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="w-full px-3.5 py-2.5 border rounded-xl text-sm text-gray-900 bg-white transition-all focus:outline-none"
                  style={{
                    borderColor: "rgba(0,0,0,0.1)",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.9)",
                  }}
                  onFocus={e => e.currentTarget.style.borderColor = "#2563EB"}
                  onBlur={e => e.currentTarget.style.borderColor = "rgba(0,0,0,0.1)"}
                  placeholder="Hendricks Construction"
                />
              </div>

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
                  placeholder="you@company.com"
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
                  placeholder="Min. 8 characters"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 tracking-wide">Confirm password</label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 border rounded-xl text-sm text-gray-900 bg-white transition-all focus:outline-none"
                  style={{
                    borderColor: "rgba(0,0,0,0.1)",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.9)",
                  }}
                  onFocus={e => e.currentTarget.style.borderColor = "#2563EB"}
                  onBlur={e => e.currentTarget.style.borderColor = "rgba(0,0,0,0.1)"}
                  placeholder="Repeat password"
                />
              </div>

              {error && <p className="text-sm text-red-500">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="group relative w-full py-3 px-4 rounded-xl text-sm font-semibold text-white overflow-hidden transition-all active:scale-[0.98] disabled:opacity-50"
                style={{ background: "#111110" }}
              >
                <span className="relative z-10">{loading ? "Creating account..." : "Create account"}</span>
                <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-[0.08] transition-opacity" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SignupForm() {
  return (
    <Suspense>
      <SignupFormInner />
    </Suspense>
  );
}
