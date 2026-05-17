"use client";

import { useState, useEffect, useRef, useCallback, DragEvent } from "react";
import ProjectNav from "@/components/ProjectNav";

// ── Types ─────────────────────────────────────────────────────────────────────

type PhotoAlbum = {
  id: string;
  project_id: string;
  name: string;
  created_by: string | null;
  created_at: string;
};

type ProjectPhoto = {
  id: string;
  project_id: string;
  album_id: string | null;
  storage_path: string;
  url: string;
  filename: string;
  caption: string | null;
  uploaded_by_id: string | null;
  uploaded_by_name: string;
  uploaded_at: string;
  trades: string[] | null;
  location_id: string | null;
  taken_at: string | null;
  location?: { id: string; name: string; path: string } | null;
};

type ProjectLocation = {
  id: string;
  project_id: string;
  parent_id: string | null;
  name: string;
  path: string;
};

// ── Nav ───────────────────────────────────────────────────────────────────────


// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

function formatMetadataDate(iso: string) {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
  return `${date} at ${time}`;
}

// Best-effort EXIF DateTimeOriginal extraction from a JPEG File.
// Returns ISO string or null. Treats EXIF time as local time of the camera.
async function extractExifDateTaken(file: File): Promise<string | null> {
  if (!file.type.includes("jpeg") && !file.type.includes("jpg")) return null;
  try {
    const buf = await file.slice(0, 256 * 1024).arrayBuffer();
    const view = new DataView(buf);
    if (view.getUint16(0) !== 0xffd8) return null;
    let offset = 2;
    while (offset < view.byteLength) {
      if (view.getUint8(offset) !== 0xff) return null;
      const marker = view.getUint8(offset + 1);
      const size = view.getUint16(offset + 2);
      if (marker === 0xe1) {
        const header = String.fromCharCode(
          view.getUint8(offset + 4), view.getUint8(offset + 5),
          view.getUint8(offset + 6), view.getUint8(offset + 7),
        );
        if (header !== "Exif") return null;
        const tiff = offset + 10;
        const little = view.getUint16(tiff) === 0x4949;
        const get16 = (o: number) => view.getUint16(o, little);
        const get32 = (o: number) => view.getUint32(o, little);
        if (get16(tiff + 2) !== 0x002a) return null;
        const ifd0 = tiff + get32(tiff + 4);
        const numEntries = get16(ifd0);
        let exifIfdOffset = 0;
        for (let i = 0; i < numEntries; i++) {
          const entry = ifd0 + 2 + i * 12;
          if (get16(entry) === 0x8769) {
            exifIfdOffset = tiff + get32(entry + 8);
            break;
          }
        }
        if (!exifIfdOffset) return null;
        const exifEntries = get16(exifIfdOffset);
        for (let i = 0; i < exifEntries; i++) {
          const entry = exifIfdOffset + 2 + i * 12;
          const tag = get16(entry);
          if (tag === 0x9003 || tag === 0x9004 || tag === 0x0132) {
            const count = get32(entry + 4);
            const valueOffset = count > 4 ? tiff + get32(entry + 8) : entry + 8;
            let str = "";
            for (let j = 0; j < count - 1; j++) {
              str += String.fromCharCode(view.getUint8(valueOffset + j));
            }
            const m = str.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
            if (m) {
              const local = new Date(
                Number(m[1]), Number(m[2]) - 1, Number(m[3]),
                Number(m[4]), Number(m[5]), Number(m[6]),
              );
              return local.toISOString();
            }
          }
        }
        return null;
      }
      offset += 2 + size;
    }
  } catch {
    return null;
  }
  return null;
}

// ── Upload progress item ──────────────────────────────────────────────────────

type UploadItem = {
  id: string;
  filename: string;
  status: "uploading" | "done" | "error";
  error?: string;
};

// ── Main Component ────────────────────────────────────────────────────────────

export default function PhotosClient({
  projectId,
  role,
  username,
}: {
  projectId: string;
  role: string;
  username: string;
}) {
  const [photos, setPhotos] = useState<ProjectPhoto[]>([]);
  const [albums, setAlbums] = useState<PhotoAlbum[]>([]);
  const [locations, setLocations] = useState<ProjectLocation[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<ProjectPhoto | null>(null);
  const [activeTab, setActiveTab] = useState<"photos" | "albums">("photos");
  const [activeAlbumFilter, setActiveAlbumFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [uploadItems, setUploadItems] = useState<UploadItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(true);

  // Album creation
  const [newAlbumName, setNewAlbumName] = useState("");
  const [creatingAlbum, setCreatingAlbum] = useState(false);
  const [showNewAlbumInput, setShowNewAlbumInput] = useState(false);

  // Detail panel state
  const [editCaption, setEditCaption] = useState("");
  const [editAlbumId, setEditAlbumId] = useState<string>("");
  const [editLocationId, setEditLocationId] = useState<string>("");
  const [editTrades, setEditTrades] = useState<string[]>([]);
  const [tradeInput, setTradeInput] = useState("");
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const [showNewLocationInput, setShowNewLocationInput] = useState(false);
  const [newLocationName, setNewLocationName] = useState("");
  const [creatingLocation, setCreatingLocation] = useState(false);
  const [metadataOpen, setMetadataOpen] = useState(true);
  const [savingDetail, setSavingDetail] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const locationDropdownRef = useRef<HTMLDivElement>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Data fetch ──────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [photosRes, albumsRes, locationsRes] = await Promise.all([
      fetch(`/api/projects/${projectId}/photos`),
      fetch(`/api/projects/${projectId}/photo-albums`),
      fetch(`/api/projects/${projectId}/locations`),
    ]);
    const [photosData, albumsData, locationsData] = await Promise.all([
      photosRes.json(),
      albumsRes.json(),
      locationsRes.json(),
    ]);
    setPhotos(Array.isArray(photosData) ? photosData : []);
    setAlbums(Array.isArray(albumsData) ? albumsData : []);
    setLocations(Array.isArray(locationsData) ? locationsData : []);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Sync detail panel when selectedPhoto changes
  useEffect(() => {
    if (selectedPhoto) {
      setEditCaption(selectedPhoto.caption ?? "");
      setEditAlbumId(selectedPhoto.album_id ?? "");
      setEditLocationId(selectedPhoto.location_id ?? "");
      setEditTrades(selectedPhoto.trades ?? []);
      setTradeInput("");
      setShowLocationDropdown(false);
      setShowNewLocationInput(false);
      setNewLocationName("");
      setDeleteConfirm(false);
    }
  }, [selectedPhoto]);

  // Close location dropdown when clicking outside
  useEffect(() => {
    if (!showLocationDropdown) return;
    function handleClick(e: MouseEvent) {
      if (locationDropdownRef.current && !locationDropdownRef.current.contains(e.target as Node)) {
        setShowLocationDropdown(false);
        setShowNewLocationInput(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showLocationDropdown]);

  // ── Upload ──────────────────────────────────────────────────────────────────

  async function uploadFiles(files: FileList | File[]) {
    const fileArr = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (!fileArr.length) return;

    const items: UploadItem[] = fileArr.map((f) => ({
      id: Math.random().toString(36).slice(2),
      filename: f.name,
      status: "uploading",
    }));
    setUploadItems((prev) => [...prev, ...items]);

    await Promise.all(
      fileArr.map(async (f, i) => {
        const item = items[i];
        const formData = new FormData();
        formData.append("file", f);
        const takenAt = await extractExifDateTaken(f);
        if (takenAt) formData.append("taken_at", takenAt);

        try {
          const res = await fetch(`/api/projects/${projectId}/photos`, {
            method: "POST",
            body: formData,
          });

          if (res.ok) {
            const created: ProjectPhoto[] = await res.json();
            setPhotos((prev) => [created[0], ...prev]);
            setUploadItems((prev) =>
              prev.map((u) => u.id === item.id ? { ...u, status: "done" } : u)
            );
            setTimeout(() => {
              setUploadItems((prev) => prev.filter((u) => u.id !== item.id));
            }, 3000);
          } else {
            const err = await res.json();
            setUploadItems((prev) =>
              prev.map((u) =>
                u.id === item.id ? { ...u, status: "error", error: err.error } : u
              )
            );
          }
        } catch {
          setUploadItems((prev) =>
            prev.map((u) =>
              u.id === item.id ? { ...u, status: "error", error: "Upload failed" } : u
            )
          );
        }
      })
    );
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.length) {
      uploadFiles(e.target.files);
      e.target.value = "";
    }
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.length) uploadFiles(e.dataTransfer.files);
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave() {
    setIsDragging(false);
  }

  // ── Album actions ───────────────────────────────────────────────────────────

  async function createAlbum() {
    if (!newAlbumName.trim()) return;
    setCreatingAlbum(true);
    const res = await fetch(`/api/projects/${projectId}/photo-albums`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newAlbumName.trim() }),
    });
    if (res.ok) {
      const album = await res.json();
      setAlbums((prev) => [...prev, album]);
      setNewAlbumName("");
      setShowNewAlbumInput(false);
    }
    setCreatingAlbum(false);
  }

  async function deleteAlbum(albumId: string) {
    await fetch(`/api/projects/${projectId}/photo-albums/${albumId}`, { method: "DELETE" });
    setAlbums((prev) => prev.filter((a) => a.id !== albumId));
    if (activeAlbumFilter === albumId) setActiveAlbumFilter(null);
    // Photos that belonged to this album have album_id set to null by DB
    setPhotos((prev) => prev.map((p) => p.album_id === albumId ? { ...p, album_id: null } : p));
  }

  // ── Photo detail actions ────────────────────────────────────────────────────

  async function saveDetail() {
    if (!selectedPhoto) return;
    const trades = tradeInput.trim()
      ? Array.from(new Set([...editTrades, tradeInput.trim()]))
      : editTrades;
    setSavingDetail(true);
    const res = await fetch(`/api/projects/${projectId}/photos/${selectedPhoto.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        caption: editCaption || null,
        album_id: editAlbumId || null,
        location_id: editLocationId || null,
        trades,
      }),
    });
    if (res.ok) {
      const updated: ProjectPhoto = await res.json();
      setPhotos((prev) => prev.map((p) => p.id === updated.id ? updated : p));
      setSelectedPhoto(updated);
      setTradeInput("");
    }
    setSavingDetail(false);
  }

  async function createLocation() {
    const name = newLocationName.trim();
    if (!name) return;
    setCreatingLocation(true);
    const res = await fetch(`/api/projects/${projectId}/locations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      const location: ProjectLocation = await res.json();
      setLocations((prev) => [...prev, location].sort((a, b) => a.path.localeCompare(b.path)));
      setEditLocationId(location.id);
      setNewLocationName("");
      setShowNewLocationInput(false);
      setShowLocationDropdown(false);
    }
    setCreatingLocation(false);
  }

  function addTrade(trade: string) {
    const trimmed = trade.trim();
    if (!trimmed) return;
    setEditTrades((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]));
    setTradeInput("");
  }

  function removeTrade(trade: string) {
    setEditTrades((prev) => prev.filter((t) => t !== trade));
  }

  async function deletePhoto() {
    if (!selectedPhoto) return;
    await fetch(`/api/projects/${projectId}/photos/${selectedPhoto.id}`, { method: "DELETE" });
    setPhotos((prev) => prev.filter((p) => p.id !== selectedPhoto.id));
    setSelectedPhoto(null);
  }

  // ── Filter & search ─────────────────────────────────────────────────────────

  const albumMap = Object.fromEntries(albums.map((a) => [a.id, a.name]));

  const filteredPhotos = photos.filter((p) => {
    if (activeAlbumFilter && p.album_id !== activeAlbumFilter) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (p.caption ?? "").toLowerCase().includes(q) ||
      p.uploaded_by_name.toLowerCase().includes(q) ||
      p.filename.toLowerCase().includes(q) ||
      formatDate(p.uploaded_at).toLowerCase().includes(q) ||
      (p.album_id ? albumMap[p.album_id] ?? "" : "").toLowerCase().includes(q)
    );
  });

  // Albums with cover photo and count
  const albumsWithMeta = albums.map((album) => {
    const albumPhotos = photos.filter((p) => p.album_id === album.id);
    return { ...album, count: albumPhotos.length, cover: albumPhotos[0] ?? null };
  });

  // ── Photo navigation ─────────────────────────────────────────────────────────

  const navigatePhoto = useCallback((dir: 1 | -1) => {
    if (!selectedPhoto) return;
    const idx = filteredPhotos.findIndex((p) => p.id === selectedPhoto.id);
    if (idx === -1) return;
    const next = filteredPhotos[idx + dir];
    if (next) setSelectedPhoto(next);
  }, [selectedPhoto, filteredPhotos]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!selectedPhoto) return;
      if (e.key === "Escape") { setSelectedPhoto(null); return; }
      if (e.key === "ArrowRight") navigatePhoto(1);
      if (e.key === "ArrowLeft") navigatePhoto(-1);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [selectedPhoto, navigatePhoto]);

  // ── Logout ──────────────────────────────────────────────────────────────────

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-6 h-14 flex items-center justify-between shrink-0">
        <a href="/dashboard" className="text-sm font-semibold text-gray-900 hover:text-gray-600 transition-colors">
          SiteCommand
        </a>
        <div className="flex items-center gap-5">
          <span className="text-sm text-gray-400">{username}</span>
          <button onClick={handleLogout} className="text-sm text-gray-400 hover:text-gray-900 transition-colors">
            Logout
          </button>
        </div>
      </header>

      <ProjectNav projectId={projectId} />

      {/* Upload progress toast */}
      {uploadItems.length > 0 && (
        <div className="fixed bottom-6 right-6 z-50 space-y-2">
          {uploadItems.map((item) => (
            <div
              key={item.id}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-sm ${
                item.status === "done"
                  ? "bg-green-50 border border-green-200 text-green-800"
                  : item.status === "error"
                  ? "bg-red-50 border border-red-200 text-red-800"
                  : "bg-white border border-gray-200 text-gray-700"
              }`}
            >
              {item.status === "uploading" && (
                <svg className="w-4 h-4 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
              )}
              {item.status === "done" && (
                <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
              {item.status === "error" && (
                <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
              <span className="max-w-xs truncate">{item.filename}</span>
              {item.status === "error" && item.error && (
                <span className="text-xs text-red-600">— {item.error}</span>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Main content */}
        <div
          className={`flex-1 flex flex-col overflow-hidden ${isDragging ? "ring-2 ring-blue-400 ring-inset" : ""}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          {/* Page heading */}
          <div className="bg-white border-b border-gray-100 px-6 py-4 shrink-0">
            <h1 className="font-display text-[32px] leading-[1.05] tracking-[-0.012em] text-[color:var(--ink)]">Photos</h1>
            {photos.length > 0 && (
              <p className="sec-sub mt-1.5">
                <span className="serif-italic text-[color:var(--brand-700)]">Across this project</span>
                <span className="sep">·</span>
                <span className="num" style={{ color: "var(--brand-500)" }}>{photos.length}</span> photos
                <span className="sep">·</span>
                <span className="num">{albums.length}</span> albums
              </p>
            )}
          </div>
          {/* Toolbar */}
          <div className="bg-white border-b border-gray-100 px-6 py-3 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              {/* Tabs */}
              <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => { setActiveTab("photos"); setActiveAlbumFilter(null); }}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    activeTab === "photos" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  All Photos
                </button>
                <button
                  onClick={() => setActiveTab("albums")}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    activeTab === "albums" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  Albums
                </button>
              </div>
              {/* Active album filter badge */}
              {activeAlbumFilter && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 border border-blue-200 rounded-full text-xs font-medium text-blue-700">
                  {albumMap[activeAlbumFilter]}
                  <button
                    onClick={() => setActiveAlbumFilter(null)}
                    className="hover:text-blue-900"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search photos…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-52"
                />
              </div>
              {/* Upload button */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Upload Photos
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*"
                className="hidden"
                onChange={handleFileInput}
              />
            </div>
          </div>

          {/* Content area */}
          <div className="flex-1 overflow-y-auto p-6">
            {loading ? (
              <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
                Loading…
              </div>
            ) : selectedPhoto && activeTab !== "albums" ? (
              // ── Enlarged photo viewer ──
              <div className="flex items-center justify-center h-full min-h-[60vh] bg-gray-900 rounded-xl relative select-none">
                {/* Prev arrow */}
                {filteredPhotos.findIndex((p) => p.id === selectedPhoto.id) > 0 && (
                  <button
                    onClick={() => navigatePhoto(-1)}
                    className="absolute left-4 z-10 p-2 rounded-full bg-black/40 text-white hover:bg-black/70 transition-colors"
                    title="Previous (←)"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                )}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selectedPhoto.url}
                  alt={selectedPhoto.filename}
                  className="max-h-[75vh] max-w-full object-contain rounded-lg"
                />
                {/* Next arrow */}
                {filteredPhotos.findIndex((p) => p.id === selectedPhoto.id) < filteredPhotos.length - 1 && (
                  <button
                    onClick={() => navigatePhoto(1)}
                    className="absolute right-4 z-10 p-2 rounded-full bg-black/40 text-white hover:bg-black/70 transition-colors"
                    title="Next (→)"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                )}
                {/* Counter */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1 bg-black/50 rounded-full text-white text-xs">
                  {filteredPhotos.findIndex((p) => p.id === selectedPhoto.id) + 1} / {filteredPhotos.length}
                </div>
              </div>
            ) : activeTab === "albums" && !activeAlbumFilter ? (
              // ── Albums grid ──
              <div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {albumsWithMeta.map((album) => (
                    <div
                      key={album.id}
                      className="group relative bg-white border border-gray-100 rounded-xl overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => { setActiveAlbumFilter(album.id); setActiveTab("photos"); }}
                    >
                      {/* Cover */}
                      <div className="aspect-square bg-gray-100 relative overflow-hidden">
                        {album.cover ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={album.cover.url}
                            alt={album.cover.filename}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <svg className="w-10 h-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                        )}
                      </div>
                      <div className="px-3 py-2 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-800 truncate">{album.name}</p>
                          <p className="text-xs text-gray-400">{album.count} photo{album.count !== 1 ? "s" : ""}</p>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteAlbum(album.id); }}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-all"
                          title="Delete album"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* New album card */}
                  {showNewAlbumInput ? (
                    <div className="bg-white border border-dashed border-gray-300 rounded-xl p-4 flex flex-col gap-2">
                      <input
                        type="text"
                        placeholder="Album name"
                        value={newAlbumName}
                        onChange={(e) => setNewAlbumName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") createAlbum(); if (e.key === "Escape") setShowNewAlbumInput(false); }}
                        autoFocus
                        className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={createAlbum}
                          disabled={creatingAlbum}
                          className="flex-1 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                        >
                          Create
                        </button>
                        <button
                          onClick={() => { setShowNewAlbumInput(false); setNewAlbumName(""); }}
                          className="flex-1 py-1.5 border border-gray-200 text-xs font-medium rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowNewAlbumInput(true)}
                      className="aspect-square bg-white border border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center gap-2 text-gray-400 hover:text-gray-600 hover:border-gray-400 transition-colors"
                    >
                      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                      </svg>
                      <span className="text-sm font-medium">New Album</span>
                    </button>
                  )}
                </div>
              </div>
            ) : filteredPhotos.length === 0 ? (
              // ── Empty state ──
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <svg className="w-12 h-12 text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-sm font-medium text-gray-500">
                  {searchQuery ? "No photos match your search" : "No photos yet"}
                </p>
                {!searchQuery && (
                  <p className="text-xs text-gray-400 mt-1">
                    Upload photos or drag and drop them here
                  </p>
                )}
              </div>
            ) : (
              // ── Photo grid ──
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {filteredPhotos.map((photo) => (
                  <button
                    key={photo.id}
                    onClick={() => setSelectedPhoto(photo)}
                    className={`group relative aspect-square bg-gray-100 rounded-lg overflow-hidden focus:outline-none ring-2 transition-all ${
                      selectedPhoto?.id === photo.id
                        ? "ring-blue-500"
                        : "ring-transparent hover:ring-blue-300"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.url}
                      alt={photo.filename}
                      className="w-full h-full object-cover"
                    />
                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                    {/* Caption badge */}
                    {photo.caption && (
                      <div className="absolute bottom-0 inset-x-0 px-2 py-1 bg-gradient-to-t from-black/60 to-transparent">
                        <p className="text-white text-xs truncate">{photo.caption}</p>
                      </div>
                    )}
                    {/* Album badge */}
                    {photo.album_id && albumMap[photo.album_id] && (
                      <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-black/50 rounded text-white text-xs">
                        {albumMap[photo.album_id]}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Drag-and-drop overlay hint */}
            {isDragging && (
              <div className="fixed inset-0 z-40 flex items-center justify-center bg-blue-500/10 border-4 border-dashed border-blue-400 pointer-events-none">
                <p className="text-blue-600 text-xl font-semibold">Drop photos to upload</p>
              </div>
            )}
          </div>
        </div>

        {/* Detail panel */}
        {selectedPhoto && (
          <div className="w-80 shrink-0 bg-white border-l border-gray-100 flex flex-col overflow-hidden">
            {/* Panel header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-800 truncate pr-2">{selectedPhoto.filename}</h3>
              <button
                onClick={() => setSelectedPhoto(null)}
                className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors shrink-0"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Detail fields */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Caption */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Caption</label>
                <textarea
                  value={editCaption}
                  onChange={(e) => setEditCaption(e.target.value)}
                  rows={3}
                  placeholder="Add a caption…"
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Album */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Album</label>
                <select
                  value={editAlbumId}
                  onChange={(e) => setEditAlbumId(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">No Album</option>
                  {albums.map((album) => (
                    <option key={album.id} value={album.id}>{album.name}</option>
                  ))}
                </select>
              </div>

              {/* Trades */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Trades</label>
                <div className="min-h-[38px] w-full border border-gray-200 rounded-lg px-2 py-1.5 flex flex-wrap gap-1 items-center focus-within:ring-2 focus-within:ring-blue-500">
                  {editTrades.map((trade) => (
                    <span
                      key={trade}
                      className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 border border-blue-200 rounded-full text-xs text-blue-700"
                    >
                      {trade}
                      <button
                        type="button"
                        onClick={() => removeTrade(trade)}
                        className="hover:text-blue-900"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </span>
                  ))}
                  <input
                    type="text"
                    value={tradeInput}
                    onChange={(e) => setTradeInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === ",") {
                        e.preventDefault();
                        addTrade(tradeInput);
                      } else if (e.key === "Backspace" && !tradeInput && editTrades.length) {
                        removeTrade(editTrades[editTrades.length - 1]);
                      }
                    }}
                    onBlur={() => tradeInput && addTrade(tradeInput)}
                    placeholder={editTrades.length ? "" : "Select Trades"}
                    className="flex-1 min-w-[80px] text-sm bg-transparent focus:outline-none px-1 py-0.5"
                  />
                </div>
              </div>

              {/* Location */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Location</label>
                <div className="relative" ref={locationDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setShowLocationDropdown((v) => !v)}
                    className="w-full text-left text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white flex items-center justify-between"
                  >
                    <span className={editLocationId ? "text-gray-900" : "text-gray-400"}>
                      {editLocationId
                        ? locations.find((l) => l.id === editLocationId)?.path ?? "Select Location"
                        : "Select Location"}
                    </span>
                    <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {showLocationDropdown && (
                    <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-72 overflow-y-auto">
                      {editLocationId && (
                        <button
                          type="button"
                          onClick={() => { setEditLocationId(""); setShowLocationDropdown(false); }}
                          className="w-full text-left px-3 py-2 text-sm text-gray-500 hover:bg-gray-50 border-b border-gray-100"
                        >
                          Clear selection
                        </button>
                      )}
                      {locations.length === 0 && (
                        <div className="px-3 py-2 text-xs text-gray-400">No locations yet</div>
                      )}
                      {locations.map((loc) => (
                        <button
                          key={loc.id}
                          type="button"
                          onClick={() => { setEditLocationId(loc.id); setShowLocationDropdown(false); }}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 ${
                            editLocationId === loc.id ? "bg-blue-50 text-blue-700 font-medium" : "text-gray-700"
                          }`}
                        >
                          {loc.path}
                        </button>
                      ))}
                      <div className="border-t border-gray-100">
                        {showNewLocationInput ? (
                          <div className="p-2 flex gap-2">
                            <input
                              type="text"
                              value={newLocationName}
                              onChange={(e) => setNewLocationName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") { e.preventDefault(); createLocation(); }
                                if (e.key === "Escape") { setShowNewLocationInput(false); setNewLocationName(""); }
                              }}
                              autoFocus
                              placeholder="Location name"
                              className="flex-1 text-sm border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <button
                              type="button"
                              onClick={createLocation}
                              disabled={creatingLocation || !newLocationName.trim()}
                              className="px-2 py-1 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 disabled:opacity-50"
                            >
                              Add
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setShowNewLocationInput(true)}
                            className="w-full text-left px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 flex items-center gap-2"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                            </svg>
                            Create a new location
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Photo Metadata */}
              <div className="pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setMetadataOpen((v) => !v)}
                  className="flex items-center gap-1.5 text-sm font-semibold text-gray-800 hover:text-gray-900"
                >
                  <svg
                    className={`w-3 h-3 transition-transform ${metadataOpen ? "rotate-0" : "-rotate-90"}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                  Photo Metadata
                </button>
                {metadataOpen && (
                  <div className="mt-3 space-y-3">
                    <div>
                      <p className="text-xs text-gray-400">Taken On</p>
                      <p className="text-sm text-gray-800">
                        {formatMetadataDate(selectedPhoto.taken_at ?? selectedPhoto.uploaded_at)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Uploaded On</p>
                      <p className="text-sm text-gray-800">{formatMetadataDate(selectedPhoto.uploaded_at)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Uploaded By</p>
                      <p className="text-sm text-gray-800">{selectedPhoto.uploaded_by_name}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">File Name</p>
                      <p className="text-sm text-gray-800 break-all">{selectedPhoto.filename}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="space-y-2 pt-2">
                <button
                  onClick={saveDetail}
                  disabled={savingDetail}
                  className="w-full py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {savingDetail ? "Saving…" : "Save"}
                </button>

                <a
                  href={selectedPhoto.url}
                  download={selectedPhoto.filename}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full py-2 border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors text-center"
                >
                  Download
                </a>

                {deleteConfirm ? (
                  <div className="flex gap-2">
                    <button
                      onClick={deletePhoto}
                      className="flex-1 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
                    >
                      Confirm Delete
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(false)}
                      className="flex-1 py-2 border border-gray-200 text-sm font-medium text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setDeleteConfirm(true)}
                    className="w-full py-2 border border-red-200 text-red-600 text-sm font-medium rounded-lg hover:bg-red-50 transition-colors"
                  >
                    Delete Photo
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
