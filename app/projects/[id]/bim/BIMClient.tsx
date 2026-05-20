"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import ProjectNav from "@/components/ProjectNav";
import AppHeader from "@/app/components/AppHeader";

type TranslationStatus = "pending" | "inprogress" | "success" | "failed" | "timeout";

interface BimModel {
  id: string;
  filename: string;
  aps_object_key: string;
  urn: string;
  translation_status: TranslationStatus;
  uploaded_by_name: string;
  uploaded_at: string;
}

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Autodesk: any;
  }
}

const STATUS_LABELS: Record<TranslationStatus, string> = {
  pending: "Queued",
  inprogress: "Processing",
  success: "Ready",
  failed: "Failed",
  timeout: "Timed Out",
};

const STATUS_COLORS: Record<TranslationStatus, string> = {
  pending: "bg-yellow-50 text-yellow-700 border-yellow-200",
  inprogress: "bg-blue-50 text-blue-700 border-blue-200",
  success: "bg-green-50 text-green-700 border-green-200",
  failed: "bg-red-50 text-red-700 border-red-200",
  timeout: "bg-gray-50 text-gray-600 border-gray-200",
};

export default function BIMClient({
  projectId,
  role,
  username,
}: {
  projectId: string;
  role: string;
  username: string;
}) {
  const [models, setModels] = useState<BimModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedModel, setSelectedModel] = useState<BimModel | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [viewerReady, setViewerReady] = useState(false);
  const [viewerError, setViewerError] = useState("");
  const [apsConfigured, setApsConfigured] = useState(true);

  const viewerContainerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const viewerInstanceRef = useRef<any>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load APS Viewer scripts once
  useEffect(() => {
    if (document.getElementById("aps-viewer-css")) return;

    const link = document.createElement("link");
    link.id = "aps-viewer-css";
    link.rel = "stylesheet";
    link.href =
      "https://developer.api.autodesk.com/modelderivative/v2/viewers/7.*/style.min.css";
    document.head.appendChild(link);

    const script = document.createElement("script");
    script.id = "aps-viewer-js";
    script.src =
      "https://developer.api.autodesk.com/modelderivative/v2/viewers/7.*/viewer3D.min.js";
    script.async = true;
    document.head.appendChild(script);
  }, []);

  // Fetch models on mount
  useEffect(() => {
    fetchModels();
  }, [projectId]);

  // Poll in-progress models
  useEffect(() => {
    const inProgress = models.some(
      (m) => m.translation_status === "pending" || m.translation_status === "inprogress"
    );

    if (inProgress) {
      pollingRef.current = setInterval(pollTranslationStatuses, 5000);
    } else {
      if (pollingRef.current) clearInterval(pollingRef.current);
    }

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [models]);

  // Initialize viewer when selectedModel changes
  useEffect(() => {
    if (!selectedModel || selectedModel.translation_status !== "success") return;

    setViewerReady(false);
    setViewerError("");

    // Wait for APS scripts to load
    const tryInit = () => {
      if (window.Autodesk?.Viewing) {
        initViewer(selectedModel.urn);
      } else {
        setTimeout(tryInit, 500);
      }
    };
    tryInit();

    return () => {
      if (viewerInstanceRef.current) {
        try {
          viewerInstanceRef.current.finish();
        } catch {
          // ignore
        }
        viewerInstanceRef.current = null;
      }
    };
  }, [selectedModel]);

  async function fetchModels() {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/bim`);
      const data = await res.json();
      setModels(data.models ?? []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function pollTranslationStatuses() {
    const toCheck = models.filter(
      (m) => m.translation_status === "pending" || m.translation_status === "inprogress"
    );

    for (const model of toCheck) {
      try {
        const res = await fetch(`/api/bim/status/${encodeURIComponent(model.urn)}`);
        const data = await res.json();

        if (data.status === "failed" && data.failureMessages?.length) {
          console.error(`[BIM] Translation failed for ${model.filename}:`, data.failureMessages);
        }

        if (data.status && data.status !== model.translation_status) {
          const newStatus = data.status as TranslationStatus;

          // Update in DB
          await fetch(`/api/projects/${projectId}/bim`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ modelId: model.id, translation_status: newStatus }),
          });

          setModels((prev) =>
            prev.map((m) => (m.id === model.id ? { ...m, translation_status: newStatus } : m))
          );

          // If the currently selected model just became ready, refresh viewer
          if (selectedModel?.id === model.id && newStatus === "success") {
            setSelectedModel((prev) => (prev ? { ...prev, translation_status: "success" } : prev));
          }
        }
      } catch {
        // ignore polling errors
      }
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadError("");

    try {
      const startRes = await fetch(`/api/projects/${projectId}/bim/upload-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start", filename: file.name, contentType: file.type }),
      });

      const startData = await startRes.json();
      if (!startRes.ok) {
        if (startRes.status === 503) setApsConfigured(false);
        setUploadError(startData.error ?? "Failed to prepare upload");
        return;
      }

      const s3Res = await fetch(startData.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });

      if (!s3Res.ok) {
        setUploadError("Failed to upload file data");
        return;
      }

      const uploadRes = await fetch(`/api/projects/${projectId}/bim/upload-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "complete",
          filename: file.name,
          objectKey: startData.objectKey,
          uploadKey: startData.uploadKey,
        }),
      });

      const uploadData = await uploadRes.json();

      if (!uploadRes.ok) {
        if (uploadRes.status === 503) setApsConfigured(false);
        setUploadError(uploadData.error ?? "Upload failed");
        return;
      }

      // Save record to DB
      const saveRes = await fetch(`/api/projects/${projectId}/bim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: uploadData.filename,
          aps_object_key: uploadData.aps_object_key,
          urn: uploadData.urn,
        }),
      });

      const saveData = await saveRes.json();
      if (!saveRes.ok) {
        setUploadError(saveData.error ?? "Failed to save model record");
        return;
      }

      if (!saveData.model) {
        setUploadError("Upload succeeded but model record was not returned. Check that the bim_models table migration has been applied.");
        return;
      }

      setModels((prev) => [saveData.model, ...prev]);
    } catch {
      setUploadError("An unexpected error occurred");
    } finally {
      setUploading(false);
      // Reset input so the same file can be re-uploaded if needed
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const initViewer = useCallback(async (urn: string) => {
    const tokenRes = await fetch("/api/bim/token");
    const tokenData = await tokenRes.json();

    if (!tokenRes.ok || !tokenData.access_token) {
      setViewerError(tokenData.error ?? "Failed to obtain viewer token");
      return;
    }

    const { Autodesk } = window;

    Autodesk.Viewing.Initializer(
      { env: "AutodeskProduction2", accessToken: tokenData.access_token },
      () => {
        if (!viewerContainerRef.current) return;

        // Clean up any previous viewer
        if (viewerInstanceRef.current) {
          try { viewerInstanceRef.current.finish(); } catch { /* ignore */ }
        }

        const viewer = new Autodesk.Viewing.GuiViewer3D(viewerContainerRef.current, {});
        const startCode = viewer.start();

        if (startCode > 0) {
          setViewerError("Failed to start viewer");
          return;
        }

        viewerInstanceRef.current = viewer;

        Autodesk.Viewing.Document.load(
          `urn:${urn}`,
          (doc: { getRoot: () => { getDefaultGeometry: () => unknown } }) => {
            const defaultGeom = doc.getRoot().getDefaultGeometry();
            viewer.loadDocumentNode(doc, defaultGeom).then(() => {
              setViewerReady(true);
            });
          },
          (errCode: number, errMsg: string) => {
            setViewerError(`Failed to load model (${errCode}: ${errMsg})`);
          }
        );
      }
    );
  }, []);

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  return (
    <div className="min-h-screen bg-[#FAFAF7] flex flex-col">
      <AppHeader username={username} />
      <ProjectNav projectId={projectId} />

      <div className="flex flex-1 overflow-hidden" style={{ height: "calc(100vh - 104px)" }}>
        {/* Sidebar */}
        <aside className="w-72 bg-white border-r border-gray-100 flex flex-col shrink-0">
          {/* Sidebar header */}
          <div className="px-4 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h1 className="font-display text-[18px] leading-tight text-[color:var(--ink)]">BIM Viewer</h1>
              <p className="text-xs text-gray-400 mt-0.5">
                {models.length} model{models.length !== 1 ? "s" : ""}
              </p>
            </div>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".dwg,.rvt,.ifc,.nwd,.nwc,.dxf,.dwf"
                className="hidden"
                onChange={handleFileUpload}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[color:var(--ink)] text-white text-xs font-medium rounded-md hover:bg-black transition-colors disabled:opacity-50"
              >
                {uploading ? (
                  <>
                    <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Uploading
                  </>
                ) : (
                  <>
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    Upload
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Error banner */}
          {uploadError && (
            <div className="mx-3 mt-3 px-3 py-2 bg-red-50 border border-red-200 rounded-md">
              <p className="text-xs text-red-700">{uploadError}</p>
              {!apsConfigured && (
                <p className="text-xs text-red-500 mt-1">
                  APS credentials are not set. A site admin can configure them at{" "}
                  <a href="/settings/integrations" className="underline font-medium">
                    Settings → Integrations
                  </a>
                  .
                </p>
              )}
            </div>
          )}

          {/* Model list */}
          <div className="flex-1 overflow-y-auto py-2">
            {loading ? (
              <div className="flex items-center justify-center h-32 text-gray-400">
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              </div>
            ) : models.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-center px-6">
                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center mb-3">
                  <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-gray-700 mb-1">No models yet</p>
                <p className="text-xs text-gray-400">Upload a .dwg or .rvt file to get started</p>
              </div>
            ) : (
              <div className="space-y-0.5 px-2">
                {models.map((model) => (
                  <button
                    key={model.id}
                    onClick={() =>
                      model.translation_status === "success"
                        ? setSelectedModel(model)
                        : undefined
                    }
                    className={`w-full text-left px-3 py-3 rounded-lg transition-colors ${
                      selectedModel?.id === model.id
                        ? "bg-gray-100"
                        : model.translation_status === "success"
                        ? "hover:bg-gray-50 cursor-pointer"
                        : "cursor-default opacity-70"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {/* File icon */}
                      <div className="mt-0.5 shrink-0 w-7 h-7 bg-gray-100 rounded flex items-center justify-center">
                        <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-900 truncate">{model.filename}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{formatDate(model.uploaded_at)}</p>
                        <span
                          className={`inline-block mt-1.5 px-1.5 py-0.5 text-[10px] font-medium rounded border ${STATUS_COLORS[model.translation_status]}`}
                        >
                          {STATUS_LABELS[model.translation_status]}
                          {model.translation_status === "inprogress" && (
                            <span className="ml-1 inline-block w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
                          )}
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Footer hint */}
          <div className="px-4 py-3 border-t border-gray-100">
            <p className="text-[10px] text-gray-300">
              Supports .dwg .rvt .ifc .nwd .nwc .dxf .dwf
            </p>
          </div>
        </aside>

        {/* Main viewer area */}
        <main className="flex-1 relative bg-gray-900 overflow-hidden">
          {!selectedModel ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
              <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
                </svg>
              </div>
              <p className="text-white/50 text-sm font-medium mb-1">
                {models.length === 0
                  ? "Upload a model to get started"
                  : "Select a model to view"}
              </p>
              <p className="text-white/25 text-xs">
                {models.length > 0 &&
                  models.every((m) => m.translation_status !== "success")
                  ? "Your models are still being processed — check back shortly"
                  : "Click a ready model in the sidebar to open it here"}
              </p>
            </div>
          ) : selectedModel.translation_status !== "success" ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
              <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-white/30 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              </div>
              <p className="text-white/50 text-sm font-medium mb-1">Processing model…</p>
              <p className="text-white/25 text-xs">
                Autodesk is translating your file. This usually takes 1–3 minutes.
              </p>
            </div>
          ) : viewerError ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
              <p className="text-red-400 text-sm font-medium mb-1">Viewer error</p>
              <p className="text-white/30 text-xs max-w-sm">{viewerError}</p>
            </div>
          ) : (
            <>
              {/* Loading overlay until viewer reports ready */}
              {!viewerReady && (
                <div className="absolute inset-0 flex items-center justify-center z-10 bg-gray-900">
                  <svg className="w-8 h-8 text-white/30 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                </div>
              )}
              <div
                ref={viewerContainerRef}
                className="w-full h-full"
                style={{ visibility: viewerReady ? "visible" : "hidden" }}
              />
            </>
          )}
        </main>
      </div>
    </div>
  );
}
