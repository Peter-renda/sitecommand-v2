"use client";

import { useMemo, useState } from "react";
import {
  ARCH_STYLES,
  COMPASS_OPTIONS,
  DRIVEWAY_STYLES,
  DEFAULT_SITE_PLAN_INPUT,
  generateSitePlan,
  type ArchStyle,
  type Compass,
  type DrivewayStyle,
  type KeepTree,
  type KeepBuilding,
  type Poly,
  type RoomZone,
  type SitePlanInput,
} from "@/lib/site-plan";

let idCounter = 0;
const nextId = (p: string) => `${p}-${Date.now()}-${idCounter++}`;

const ZONE_FILL: Record<RoomZone["kind"], string> = {
  public: "#c7d2fe",
  service: "#fde68a",
  private: "#bbf7d0",
  circulation: "#e2e8f0",
  garage: "#cbd5e1",
};
const ZONE_STROKE: Record<RoomZone["kind"], string> = {
  public: "#6366f1",
  service: "#d97706",
  private: "#16a34a",
  circulation: "#94a3b8",
  garage: "#64748b",
};

export default function SitePlanClient({ projectId }: { projectId: string }) {
  const [input, setInput] = useState<SitePlanInput>(DEFAULT_SITE_PLAN_INPUT);
  const [seed, setSeed] = useState(7);

  const result = useMemo(() => generateSitePlan(input, seed), [input, seed]);

  function set<K extends keyof SitePlanInput>(key: K, value: SitePlanInput[K]) {
    setInput((prev) => ({ ...prev, [key]: value }));
  }
  function num<K extends keyof SitePlanInput>(key: K, value: string) {
    set(key, (Number(value) || 0) as SitePlanInput[K]);
  }

  function addTree() {
    const t: KeepTree = {
      id: nextId("tree"),
      x: Math.round(input.lotWidth / 2),
      y: Math.round(input.lotDepth * 0.6),
      dripRadius: 14,
      deciduous: true,
    };
    set("keepTrees", [...input.keepTrees, t]);
  }
  function updateTree(id: string, patch: Partial<KeepTree>) {
    set(
      "keepTrees",
      input.keepTrees.map((t) => (t.id === id ? { ...t, ...patch } : t))
    );
  }
  function removeTree(id: string) {
    set("keepTrees", input.keepTrees.filter((t) => t.id !== id));
  }

  function addBuilding() {
    const b: KeepBuilding = {
      id: nextId("bld"),
      x: Math.round(input.lotWidth * 0.7),
      y: Math.round(input.lotDepth * 0.75),
      w: 20,
      h: 20,
    };
    set("keepBuildings", [...input.keepBuildings, b]);
  }
  function updateBuilding(id: string, patch: Partial<KeepBuilding>) {
    set(
      "keepBuildings",
      input.keepBuildings.map((b) => (b.id === id ? { ...b, ...patch } : b))
    );
  }
  function removeBuilding(id: string) {
    set("keepBuildings", input.keepBuildings.filter((b) => b.id !== id));
  }

  return (
    <main className="min-h-screen bg-[#F7F8FA] px-6 py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl bg-gray-950 p-8 text-white shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-300">Development</p>
          <div className="mt-4 grid gap-6 lg:grid-cols-[1.6fr_1fr] lg:items-end">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">Site Plan</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-300">
                Describe the survey and the program, and the generative engine searches thousands of
                candidate layouts — respecting setbacks, structures you want to keep, zoning coverage,
                and sun orientation — then recommends a site plan <span className="font-semibold text-white">and a floor plan</span>.
                No picking from a list of options: the AI proposes the layout it scores highest.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
              <p className="text-xs uppercase tracking-widest text-gray-400">Recommendation</p>
              {result.ok ? (
                <>
                  <p className="mt-2 text-lg font-semibold">
                    {result.floorPlan.styleLabel} · {result.floorPlan.beds} bd / {result.floorPlan.fullBaths} ba
                  </p>
                  <p className="mt-1 text-sm text-gray-300">
                    {result.metrics.footprintSqft.toLocaleString()} sf footprint · {result.metrics.lotCoveragePct}% coverage · score {result.score}
                  </p>
                </>
              ) : (
                <p className="mt-2 text-sm text-amber-200">No feasible layout yet — adjust the inputs.</p>
              )}
            </div>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[380px_1fr]">
          {/* ---------------- Inputs ---------------- */}
          <div className="space-y-4">
            <Panel title="Lot & setbacks" subtitle="From the survey (feet).">
              <Grid2>
                <NumberField label="Lot width" value={input.lotWidth} onChange={(v) => num("lotWidth", v)} />
                <NumberField label="Lot depth" value={input.lotDepth} onChange={(v) => num("lotDepth", v)} />
                <NumberField label="Front setback" value={input.setbackFront} onChange={(v) => num("setbackFront", v)} />
                <NumberField label="Rear setback" value={input.setbackRear} onChange={(v) => num("setbackRear", v)} />
                <NumberField label="Side setback" value={input.setbackSide} onChange={(v) => num("setbackSide", v)} />
              </Grid2>
            </Panel>

            <Panel title="Program" subtitle="What you want to build.">
              <Grid2>
                <NumberField label="Gross square feet" value={input.desiredSqft} onChange={(v) => num("desiredSqft", v)} />
                <NumberField label="Number of floors" value={input.floors} onChange={(v) => num("floors", v)} min={1} />
              </Grid2>
              <label className="mt-3 flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={input.garage}
                  onChange={(e) => set("garage", e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                Attached garage
              </label>
              {input.garage && (
                <div className="mt-3">
                  <NumberField label="Garage bays" value={input.garageBays} onChange={(v) => num("garageBays", v)} min={1} />
                </div>
              )}
            </Panel>

            <Panel title="Style" subtitle="Symmetry drives the massing.">
              <SelectField
                label="Architectural style"
                value={input.style}
                onChange={(v) => set("style", v as ArchStyle)}
                options={ARCH_STYLES.map((s) => ({
                  value: s.value,
                  label: `${s.label} · ${s.symmetrical ? "symmetrical" : "asymmetrical"}`,
                }))}
              />
            </Panel>

            <Panel title="Access" subtitle="Driveway and front walk.">
              <SelectField
                label="Driveway"
                value={input.drivewayStyle}
                onChange={(v) => set("drivewayStyle", v as DrivewayStyle)}
                options={DRIVEWAY_STYLES}
                disabled={!input.garage}
              />
              <label className="mt-3 flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={input.includeWalkway}
                  onChange={(e) => set("includeWalkway", e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                Front walkway to the door
              </label>
            </Panel>

            <Panel title="Zoning & orientation" subtitle="Ordinance limits and sun.">
              <Grid2>
                <NumberField
                  label="Max lot coverage %"
                  value={Math.round(input.maxLotCoverage * 100)}
                  onChange={(v) => set("maxLotCoverage", (Number(v) || 0) / 100)}
                />
                <NumberField label="Max FAR (0 = none)" value={input.maxFar} step={0.1} onChange={(v) => num("maxFar", v)} />
                <NumberField label="Max height (ft)" value={input.maxHeightFt} onChange={(v) => num("maxHeightFt", v)} />
              </Grid2>
              <div className="mt-3">
                <SelectField
                  label="Direction the front / street faces"
                  value={input.frontFaces}
                  onChange={(v) => set("frontFaces", v as Compass)}
                  options={COMPASS_OPTIONS.map((c) => ({ value: c.value, label: c.label }))}
                />
              </div>
            </Panel>

            <Panel title="Keep from survey" subtitle="Trees (drip line) and structures to preserve.">
              <div className="space-y-2">
                {input.keepTrees.map((t) => (
                  <div key={t.id} className="rounded-lg border border-gray-200 p-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-600">Tree</span>
                      <button onClick={() => removeTree(t.id)} className="text-xs text-red-500 hover:underline">
                        Remove
                      </button>
                    </div>
                    <div className="mt-1 grid grid-cols-3 gap-1.5">
                      <MiniField label="x" value={t.x} onChange={(v) => updateTree(t.id, { x: Number(v) || 0 })} />
                      <MiniField label="y" value={t.y} onChange={(v) => updateTree(t.id, { y: Number(v) || 0 })} />
                      <MiniField label="drip r" value={t.dripRadius} onChange={(v) => updateTree(t.id, { dripRadius: Number(v) || 0 })} />
                    </div>
                    <label className="mt-1.5 flex items-center gap-1.5 text-xs text-gray-600">
                      <input
                        type="checkbox"
                        checked={t.deciduous}
                        onChange={(e) => updateTree(t.id, { deciduous: e.target.checked })}
                        className="h-3.5 w-3.5 rounded border-gray-300"
                      />
                      Deciduous (drops leaves → summer shade)
                    </label>
                  </div>
                ))}
                <button onClick={addTree} className="w-full rounded-lg border border-dashed border-gray-300 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">
                  + Add tree
                </button>

                {input.keepBuildings.map((b) => (
                  <div key={b.id} className="rounded-lg border border-gray-200 p-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-600">Structure</span>
                      <button onClick={() => removeBuilding(b.id)} className="text-xs text-red-500 hover:underline">
                        Remove
                      </button>
                    </div>
                    <div className="mt-1 grid grid-cols-4 gap-1.5">
                      <MiniField label="x" value={b.x} onChange={(v) => updateBuilding(b.id, { x: Number(v) || 0 })} />
                      <MiniField label="y" value={b.y} onChange={(v) => updateBuilding(b.id, { y: Number(v) || 0 })} />
                      <MiniField label="w" value={b.w} onChange={(v) => updateBuilding(b.id, { w: Number(v) || 0 })} />
                      <MiniField label="d" value={b.h} onChange={(v) => updateBuilding(b.id, { h: Number(v) || 0 })} />
                    </div>
                  </div>
                ))}
                <button onClick={addBuilding} className="w-full rounded-lg border border-dashed border-gray-300 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">
                  + Keep a structure
                </button>
              </div>
            </Panel>
          </div>

          {/* ---------------- Results ---------------- */}
          <div className="space-y-6">
            {result.ok ? (
              <>
                <div className="grid gap-6 xl:grid-cols-[1.15fr_1fr]">
                  <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-sm font-semibold text-gray-900">Recommended site plan</h2>
                        <p className="mt-1 text-xs text-gray-500">
                          Best of {result.validFound.toLocaleString()} valid layouts across {result.iterationsTried.toLocaleString()} candidates.
                        </p>
                      </div>
                      <button
                        onClick={() => setSeed((s) => s + 1)}
                        className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                      >
                        Regenerate
                      </button>
                    </div>
                    <SiteMap result={result} />
                    <Legend />
                  </div>

                  <div className="space-y-4">
                    <MetricsCard result={result} />
                    <ConsiderationsCard />
                  </div>
                </div>

                <FloorPlanCard result={result} />
              </>
            ) : (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
                <h2 className="text-sm font-semibold text-amber-900">No feasible layout</h2>
                <ul className="mt-3 space-y-2 text-sm text-amber-800">
                  {result.reasons.map((r, i) => (
                    <li key={i} className="flex gap-2">
                      <span>•</span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="text-xs text-gray-400">Project {projectId}</p>
          </div>
        </section>
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Site map SVG
// ---------------------------------------------------------------------------

function SiteMap({ result }: { result: Extract<ReturnType<typeof generateSitePlan>, { ok: true }> }) {
  const { input, envelope, layout, metrics } = result;
  const pad = 24;
  const maxW = 560;
  const scale = maxW / input.lotWidth;
  const W = input.lotWidth * scale + pad * 2;
  const H = input.lotDepth * scale + pad * 2;

  // Lot y=0 (street) at the bottom → flip y.
  const px = (x: number) => pad + x * scale;
  const py = (y: number) => pad + (input.lotDepth - y) * scale;
  const pts = (poly: Poly) => poly.map((v) => `${px(v.x).toFixed(1)},${py(v.y).toFixed(1)}`).join(" ");

  // North arrow direction (lot math angle → svg, y flipped).
  const northRad = (metrics.northAngleDeg * Math.PI) / 180;
  const nDx = Math.cos(northRad);
  const nDy = -Math.sin(northRad);
  const nCx = W - pad - 22;
  const nCy = pad + 22;
  const nLen = 16;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-4 w-full rounded-xl border border-gray-100 bg-[#fbfdf9]" role="img" aria-label="Recommended site plan">
      {/* Lot */}
      <rect x={px(0)} y={py(input.lotDepth)} width={input.lotWidth * scale} height={input.lotDepth * scale} fill="#f4f7f0" stroke="#111827" strokeWidth={1.5} />

      {/* Street */}
      <rect x={px(0)} y={py(0)} width={input.lotWidth * scale} height={pad * 0.7} fill="#e5e7eb" />
      <text x={px(input.lotWidth / 2)} y={py(0) + pad * 0.5} textAnchor="middle" className="fill-gray-500" fontSize={9}>
        STREET
      </text>

      {/* Setback envelope */}
      <rect
        x={px(envelope.minx)}
        y={py(envelope.maxy)}
        width={(envelope.maxx - envelope.minx) * scale}
        height={(envelope.maxy - envelope.miny) * scale}
        fill="none"
        stroke="#9ca3af"
        strokeWidth={1}
        strokeDasharray="5 4"
      />

      {/* Kept buildings */}
      {input.keepBuildings.map((b) => (
        <rect
          key={b.id}
          x={px(b.x - b.w / 2)}
          y={py(b.y + b.h / 2)}
          width={b.w * scale}
          height={b.h * scale}
          fill="#d1d5db"
          stroke="#6b7280"
          strokeWidth={1}
        />
      ))}

      {/* Trees (drip line + trunk) */}
      {input.keepTrees.map((t) => (
        <g key={t.id}>
          <circle cx={px(t.x)} cy={py(t.y)} r={t.dripRadius * scale} fill={t.deciduous ? "#bbf7d0" : "#86efac"} fillOpacity={0.55} stroke="#22c55e" strokeWidth={1} />
          <circle cx={px(t.x)} cy={py(t.y)} r={3} fill="#15803d" />
        </g>
      ))}

      {/* Driveway + walkway */}
      {layout.driveway.map((s, i) => (
        <polygon key={`d${i}`} points={pts(s)} fill="#9ca3af" fillOpacity={0.85} />
      ))}
      {layout.walkway.map((s, i) => (
        <polygon key={`w${i}`} points={pts(s)} fill="#cbd5e1" fillOpacity={0.9} />
      ))}

      {/* House */}
      {layout.houseParts.map((p, i) => {
        const isGarage = layout.garagePart && p === layout.garagePart;
        return (
          <polygon
            key={`h${i}`}
            points={pts(p)}
            fill={isGarage ? "#94a3b8" : "#1f2937"}
            fillOpacity={isGarage ? 0.85 : 0.92}
            stroke="#0f172a"
            strokeWidth={1}
          />
        );
      })}

      {/* Doors */}
      <circle cx={px(layout.frontDoor.x)} cy={py(layout.frontDoor.y)} r={3.5} fill="#f59e0b" stroke="#fff" strokeWidth={1} />
      {layout.garageDoor && (
        <circle cx={px(layout.garageDoor.x)} cy={py(layout.garageDoor.y)} r={3.5} fill="#38bdf8" stroke="#fff" strokeWidth={1} />
      )}

      {/* North arrow */}
      <g>
        <line x1={nCx} y1={nCy} x2={nCx + nDx * nLen} y2={nCy + nDy * nLen} stroke="#111827" strokeWidth={1.5} />
        <circle cx={nCx} cy={nCy} r={2} fill="#111827" />
        <text x={nCx + nDx * (nLen + 7)} y={nCy + nDy * (nLen + 7) + 3} textAnchor="middle" fontSize={9} className="fill-gray-700" fontWeight={700}>
          N
        </text>
      </g>
    </svg>
  );
}

function Legend() {
  const items: [string, string][] = [
    ["#1f2937", "House"],
    ["#94a3b8", "Garage"],
    ["#9ca3af", "Driveway"],
    ["#cbd5e1", "Walkway"],
    ["#bbf7d0", "Tree drip line"],
    ["#f59e0b", "Front door"],
  ];
  return (
    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
      {items.map(([c, label]) => (
        <span key={label} className="flex items-center gap-1.5 text-xs text-gray-600">
          <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: c }} />
          {label}
        </span>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Metrics + considerations
// ---------------------------------------------------------------------------

function MetricsCard({ result }: { result: Extract<ReturnType<typeof generateSitePlan>, { ok: true }> }) {
  const m = result.metrics;
  const farOver = m.maxFar > 0 && m.far > m.maxFar;
  const rows: [string, string, boolean?][] = [
    ["Lot coverage", `${m.lotCoveragePct}% / ${m.maxLotCoveragePct}% max`, m.lotCoveragePct > m.maxLotCoveragePct],
    ["Floor area ratio", m.maxFar > 0 ? `${m.far} / ${m.maxFar} max` : `${m.far}`, farOver],
    ["Rear yard", `${m.rearYardFt} ft`],
    ["Min side yard", `${m.minSideYardFt} ft`],
    ["Front yard", `${m.frontYardFt} ft`],
    ["Driveway run", `${m.drivewayLengthFt} ft`],
    ["Solar exposure", `Living faces ${m.solarLabel} · ${m.solarScore}/100`],
    ["Preserved", `${m.treesPreserved} tree(s), ${m.buildingsPreserved} structure(s)`],
    ["House rotation", `${result.layout.angleDeg}°`],
  ];
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-gray-900">Site metrics</h2>
      <dl className="mt-3 divide-y divide-gray-100">
        {rows.map(([label, value, warn]) => (
          <div key={label} className="flex items-center justify-between py-2 text-sm">
            <dt className="text-gray-500">{label}</dt>
            <dd className={`font-medium ${warn ? "text-red-600" : "text-gray-900"}`}>{value}</dd>
          </div>
        ))}
      </dl>
      {farOver && (
        <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
          Program FAR exceeds the cap — reduce square footage or raise the FAR limit.
        </p>
      )}
    </div>
  );
}

function ConsiderationsCard() {
  const accounted = [
    "Feasible building envelope from setbacks",
    "Tree drip-line & kept-structure clearances",
    "Impervious lot coverage (house + drive + walk)",
    "FAR & height ceilings",
    "Passive-solar orientation of living spaces",
    "Deciduous shade + garage as thermal buffer",
    "Side-yard privacy & generous rear yard",
    "Curb-cut driveway routing around obstacles",
  ];
  const validate = [
    "Grading, slope & floodplain from the survey",
    "Easements, utility & drainage runs",
    "Well/septic or tap locations (if applicable)",
    "Local design-review / HOA overlays",
  ];
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-gray-900">What the engine weighs</h2>
      <ul className="mt-3 space-y-1.5">
        {accounted.map((c) => (
          <li key={c} className="flex gap-2 text-xs text-gray-600">
            <span className="text-emerald-500">✓</span>
            <span>{c}</span>
          </li>
        ))}
      </ul>
      <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-gray-400">Validate against the survey</h3>
      <ul className="mt-2 space-y-1.5">
        {validate.map((c) => (
          <li key={c} className="flex gap-2 text-xs text-gray-500">
            <span>◦</span>
            <span>{c}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Recommended floor plan
// ---------------------------------------------------------------------------

function FloorPlanCard({ result }: { result: Extract<ReturnType<typeof generateSitePlan>, { ok: true }> }) {
  const fp = result.floorPlan;
  const stats: [string, string][] = [
    ["Gross", `${fp.grossSqft.toLocaleString()} sf`],
    ["Footprint", `${fp.footprintSqft.toLocaleString()} sf`],
    ["Footprint size", `${fp.footprintW}′ × ${fp.footprintD}′`],
    ["Floors", String(fp.floors)],
    ["Bedrooms", String(fp.beds)],
    ["Baths", `${fp.fullBaths} full · ${fp.halfBaths} half`],
    ["Garage", fp.garageBays ? `${fp.garageBays}-car` : "None"],
    ["Style", fp.styleLabel],
  ];
  return (
    <div className="rounded-2xl border border-indigo-100 bg-white shadow-sm">
      <div className="rounded-t-2xl border-b border-indigo-100 bg-indigo-50/60 px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-indigo-500">AI recommendation</p>
        <h2 className="mt-1 text-lg font-semibold text-gray-900">Recommended floor plan</h2>
        <p className="mt-1 text-sm text-gray-600">{fp.massing}</p>
      </div>

      <div className="grid gap-6 p-5 lg:grid-cols-[1fr_1.1fr]">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2">
            {stats.map(([label, value]) => (
              <div key={label} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                <p className="text-[11px] uppercase tracking-wide text-gray-400">{label}</p>
                <p className="mt-1 text-sm font-semibold text-gray-900">{value}</p>
              </div>
            ))}
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Why this plan</h3>
            <ul className="mt-2 space-y-1.5">
              {fp.rationale.map((r, i) => (
                <li key={i} className="flex gap-2 text-sm text-gray-600">
                  <span className="text-indigo-400">•</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="space-y-4">
          <FloorPlanSchematic result={result} />
          <div className="grid gap-3 sm:grid-cols-2">
            {fp.program.map((floor) => (
              <div key={floor.floor} className="rounded-xl border border-gray-100 p-3">
                <p className="text-xs font-semibold text-gray-900">{floor.floor}</p>
                <ul className="mt-1.5 space-y-1">
                  {floor.rooms.map((room) => (
                    <li key={room} className="text-xs text-gray-600">
                      {room}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function FloorPlanSchematic({ result }: { result: Extract<ReturnType<typeof generateSitePlan>, { ok: true }> }) {
  const fp = result.floorPlan;
  const pad = 10;
  const maxW = 380;
  const scale = maxW / Math.max(fp.zoneW, 1);
  const W = fp.zoneW * scale + pad * 2;
  const H = fp.zoneD * scale + pad * 2;
  // Front at bottom → flip y.
  const px = (x: number) => pad + x * scale;
  const py = (y: number) => pad + (fp.zoneD - y) * scale;

  return (
    <div>
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Ground-floor schematic</h3>
        <span className="text-[11px] text-gray-400">front at bottom</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 w-full rounded-xl border border-gray-100 bg-white" role="img" aria-label="Ground floor schematic">
        {fp.zones.map((z, i) => {
          const x = px(z.x);
          const y = py(z.y + z.h);
          const w = z.w * scale;
          const h = z.h * scale;
          const short = z.name.length > 16 && Math.min(w, h) < 70;
          return (
            <g key={i}>
              <rect x={x} y={y} width={w} height={h} fill={ZONE_FILL[z.kind]} stroke={ZONE_STROKE[z.kind]} strokeWidth={1} rx={2} />
              <text
                x={x + w / 2}
                y={y + h / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={Math.max(7, Math.min(10, w / 9))}
                className="fill-gray-700"
              >
                {short ? z.name.split(" ")[0] : z.name}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="mt-2 text-[11px] text-gray-400">Schematic zoning only — not a construction drawing.</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small form primitives
// ---------------------------------------------------------------------------

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
      {subtitle && <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>}
      <div className="mt-3">{children}</div>
    </div>
  );
}

function Grid2({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3">{children}</div>;
}

function NumberField({
  label,
  value,
  onChange,
  min,
  step,
}: {
  label: string;
  value: number;
  onChange: (v: string) => void;
  min?: number;
  step?: number;
}) {
  return (
    <label className="text-xs font-medium text-gray-500">
      {label}
      <input
        type="number"
        min={min}
        step={step}
        className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function MiniField({ label, value, onChange }: { label: string; value: number; onChange: (v: string) => void }) {
  return (
    <label className="text-[10px] font-medium text-gray-400">
      {label}
      <input
        type="number"
        className="mt-0.5 w-full rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-900"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
}) {
  return (
    <label className="text-xs font-medium text-gray-500">
      {label}
      <select
        disabled={disabled}
        className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 disabled:bg-gray-100 disabled:text-gray-400"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
