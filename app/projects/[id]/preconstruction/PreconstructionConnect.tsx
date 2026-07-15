"use client";

import { useState, useEffect, useCallback } from "react";
import { ExternalLink, CheckCircle2, Building2, Loader2, AlertCircle } from "lucide-react";
import ProjectNav from "@/components/ProjectNav";
import AppHeader from "@/app/components/AppHeader";

type Status = {
  configured: boolean;
  connected: boolean;
  canManage: boolean;
  user: { name: string | null; email: string | null } | null;
  connectedAt: string | null;
};

// Friendly copy for the ?bc_error codes the OAuth routes redirect back with.
const BC_ERROR_LABELS: Record<string, string> = {
  unauthorized: "Your session expired. Please sign in and try again.",
  forbidden: "Only a Company Super Admin can connect BuildingConnected.",
  no_company: "Your account isn't associated with a company.",
  not_configured:
    "Autodesk Platform Services app credentials aren't set up yet. A site administrator needs to add them first.",
  invalid_callback: "Autodesk returned an unexpected response. Please try again.",
  invalid_state: "The connection request expired or couldn't be verified. Please try again.",
  missing_app_creds: "Autodesk app credentials are missing. Contact your administrator.",
  token_exchange_failed: "Autodesk rejected the connection. Please try again.",
  denied: "The Autodesk authorization was cancelled.",
};

export default function PreconstructionConnect({
  projectId,
  username,
}: {
  projectId: string;
  username?: string | null;
}) {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const [banner, setBanner] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/integrations/buildingconnected/status");
      if (res.ok) setStatus(await res.json());
    } catch {
      /* leave status null → shows a generic unavailable state */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Surface the ?bc_connected / ?bc_error params from the OAuth round-trip,
  // then strip them so a refresh doesn't replay the banner.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connectedFlag = params.get("bc_connected");
    const errorCode = params.get("bc_error");
    if (connectedFlag) {
      setBanner({ kind: "success", text: "Autodesk BuildingConnected is now connected." });
    } else if (errorCode) {
      const base = BC_ERROR_LABELS[errorCode] || "Could not connect BuildingConnected.";
      const reason = params.get("reason");
      setBanner({ kind: "error", text: reason ? `${base} (${reason})` : base });
    }
    if (connectedFlag || errorCode) {
      const url = new URL(window.location.href);
      ["bc_connected", "bc_error", "reason"].forEach((k) => url.searchParams.delete(k));
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  const returnTo = `/projects/${projectId}/preconstruction`;
  const connectHref = `/api/integrations/buildingconnected/connect?returnTo=${encodeURIComponent(returnTo)}`;

  async function handleDisconnect() {
    if (!window.confirm("Disconnect Autodesk BuildingConnected for your company?")) return;
    setDisconnecting(true);
    try {
      const res = await fetch("/api/integrations/buildingconnected/disconnect", { method: "POST" });
      if (res.ok) {
        setBanner({ kind: "success", text: "Autodesk BuildingConnected disconnected." });
        await load();
      } else {
        const j = await res.json().catch(() => ({}));
        setBanner({ kind: "error", text: j.error || "Could not disconnect. Please try again." });
      }
    } catch {
      setBanner({ kind: "error", text: "Could not disconnect. Please try again." });
    } finally {
      setDisconnecting(false);
    }
  }

  const connected = status?.connected ?? false;
  const configured = status?.configured ?? false;
  const canManage = status?.canManage ?? false;

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col">
      <AppHeader username={username} />
      <ProjectNav projectId={projectId} />

      <div className="flex-1 overflow-auto">
        <div className="max-w-3xl mx-auto px-6 py-8">
          <h1 className="text-[22px] font-semibold tracking-[-0.01em] text-gray-900">Preconstruction</h1>
          <p className="text-sm text-gray-500 mt-1">
            Connect bidding and preconstruction systems so opportunities and bids flow into this project.
          </p>

          {banner && (
            <div
              className={`mt-5 flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${
                banner.kind === "success"
                  ? "bg-green-50 border-green-100 text-green-800"
                  : "bg-red-50 border-red-100 text-red-700"
              }`}
            >
              {banner.kind === "success" ? (
                <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              )}
              <span>{banner.text}</span>
              <button
                type="button"
                onClick={() => setBanner(null)}
                className="ml-auto text-xs underline opacity-70 hover:opacity-100"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* BuildingConnected card */}
          <div className="mt-5 bg-white border border-gray-200 rounded-lg p-5">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-md bg-gray-900 flex items-center justify-center shrink-0">
                  <Building2 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">Autodesk BuildingConnected</h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Bid management and preconstruction. Connects via Autodesk Platform Services (the same
                    APS app used by the BIM viewer).
                  </p>
                </div>
              </div>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ml-4 ${
                  connected ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"
                }`}
              >
                {loading ? "…" : connected ? "Connected" : "Not connected"}
              </span>
            </div>

            <div className="mt-4 border-t border-gray-100 pt-4">
              {loading ? (
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Loader2 className="w-4 h-4 animate-spin" /> Checking connection…
                </div>
              ) : connected ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                    <span>
                      Connected
                      {status?.user?.name ? (
                        <> as <span className="font-medium">{status.user.name}</span></>
                      ) : null}
                      {status?.user?.email ? (
                        <span className="text-gray-400"> ({status.user.email})</span>
                      ) : null}
                      {status?.connectedAt ? (
                        <span className="text-gray-400">
                          {" "}
                          · since {new Date(status.connectedAt).toLocaleDateString()}
                        </span>
                      ) : null}
                    </span>
                  </div>
                  {canManage ? (
                    <div className="flex items-center gap-2">
                      <a
                        href={connectHref}
                        className="inline-flex items-center gap-2 px-4 py-2 text-white text-sm font-medium rounded-md bg-gray-900 hover:bg-black transition-colors"
                      >
                        <ExternalLink className="w-4 h-4" />
                        Reconnect
                      </a>
                      <button
                        type="button"
                        onClick={handleDisconnect}
                        disabled={disconnecting}
                        className="px-4 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-md hover:bg-red-50 transition-colors disabled:opacity-50"
                      >
                        {disconnecting ? "Disconnecting…" : "Disconnect"}
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400">
                      Managed by your Company Super Admin.
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-gray-500">
                    {!configured
                      ? "Autodesk Platform Services app credentials aren't configured yet. A site administrator needs to add APS_CLIENT_ID and APS_CLIENT_SECRET (Settings → platform settings) before BuildingConnected can be connected."
                      : canManage
                        ? "Authorize SiteCommand to read your company's BuildingConnected bids and opportunities."
                        : "Only a Company Super Admin can connect BuildingConnected. Ask your admin to enable it."}
                  </p>
                  <a
                    href={connectHref}
                    aria-disabled={!configured || !canManage}
                    onClick={(e) => {
                      if (!configured || !canManage) e.preventDefault();
                    }}
                    className={`inline-flex items-center gap-2 px-4 py-2 text-white text-sm font-medium rounded-md transition-colors ${
                      configured && canManage
                        ? "bg-gray-900 hover:bg-black"
                        : "bg-gray-300 cursor-not-allowed"
                    }`}
                  >
                    <ExternalLink className="w-4 h-4" />
                    Connect BuildingConnected
                  </a>
                </div>
              )}
            </div>
          </div>

          <p className="mt-4 text-xs text-gray-400">
            BuildingConnected is part of Autodesk Platform Services. Register the callback URL{" "}
            <code className="font-mono bg-gray-100 px-1 rounded">
              {(typeof window !== "undefined" ? window.location.origin : "")}
              /api/integrations/buildingconnected/callback
            </code>{" "}
            on your APS app, and ensure the BuildingConnected API is enabled for it.
          </p>
        </div>
      </div>
    </div>
  );
}
