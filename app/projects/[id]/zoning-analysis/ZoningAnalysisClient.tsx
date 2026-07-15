"use client";

import { useMemo, useState } from "react";

type ParcelInput = {
  address: string;
  parcelId: string;
  zoning: string;
  currentUse: string;
  lotSqft: number;
  buildingSqft: number;
  landValue: number;
  improvementValue: number;
  yearBuilt: number;
  maxFar: number;
  maxUnitsPerAcre: number;
  constraintPenalty: number;
};

type AnalysisResult = ParcelInput & {
  acres: number;
  currentFar: number;
  potentialBuildingSqft: number;
  potentialUnits: number;
  valueRatio: number;
  score: number;
};

const SAMPLE_PARCELS: ParcelInput[] = [
  {
    address: "6425 Glenwood Ave, Raleigh, NC",
    parcelId: "RALEIGH-DEMO-001",
    zoning: "IX-3",
    currentUse: "Low-intensity flex / industrial",
    lotSqft: 74052,
    buildingSqft: 12200,
    landValue: 2350000,
    improvementValue: 575000,
    yearBuilt: 1968,
    maxFar: 1.5,
    maxUnitsPerAcre: 0,
    constraintPenalty: 6,
  },
  {
    address: "Downtown surface parking prototype",
    parcelId: "RALEIGH-DEMO-002",
    zoning: "DX-7",
    currentUse: "Surface parking",
    lotSqft: 32670,
    buildingSqft: 0,
    landValue: 4200000,
    improvementValue: 75000,
    yearBuilt: 1975,
    maxFar: 5.0,
    maxUnitsPerAcre: 120,
    constraintPenalty: 3,
  },
  {
    address: "New Bern Ave corridor retail prototype",
    parcelId: "RALEIGH-DEMO-003",
    zoning: "CX-5",
    currentUse: "One-story retail center",
    lotSqft: 91476,
    buildingSqft: 18000,
    landValue: 3100000,
    improvementValue: 840000,
    yearBuilt: 1962,
    maxFar: 3.0,
    maxUnitsPerAcre: 80,
    constraintPenalty: 12,
  },
];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function analyzeParcel(parcel: ParcelInput): AnalysisResult {
  const lotSqft = Math.max(parcel.lotSqft, 1);
  const acres = lotSqft / 43560;
  const currentFar = parcel.buildingSqft / lotSqft;
  const potentialBuildingSqft = lotSqft * Math.max(parcel.maxFar, 0);
  const potentialUnits = Math.floor(acres * Math.max(parcel.maxUnitsPerAcre, 0));
  const valueRatio = parcel.improvementValue > 0 ? parcel.landValue / parcel.improvementValue : parcel.landValue > 0 ? 10 : 0;

  const unusedFarShare = parcel.maxFar > 0 ? 1 - currentFar / parcel.maxFar : 0;
  const ageBonus = parcel.yearBuilt > 0 ? clamp((2026 - parcel.yearBuilt) / 70, 0, 1) * 15 : 0;
  const landValueScore = clamp(valueRatio / 5, 0, 1) * 25;
  const capacityScore = clamp(unusedFarShare, 0, 1) * 35;
  const lotScore = clamp(acres / 1.5, 0, 1) * 10;
  const densityBonus = parcel.maxUnitsPerAcre >= 12 ? 15 : parcel.maxFar >= 1 ? 8 : 0;
  const parkingVacancyBonus = /parking|vacant/i.test(parcel.currentUse) ? 8 : 0;

  const score = clamp(
    capacityScore + landValueScore + ageBonus + lotScore + densityBonus + parkingVacancyBonus - parcel.constraintPenalty,
    0,
    100
  );

  return {
    ...parcel,
    acres,
    currentFar,
    potentialBuildingSqft,
    potentialUnits,
    valueRatio,
    score: Math.round(score),
  };
}

function number(value: number) {
  return new Intl.NumberFormat("en-US").format(Math.round(value));
}


export default function ZoningAnalysisClient({ projectId }: { projectId: string }) {
  const [parcels, setParcels] = useState<ParcelInput[]>(SAMPLE_PARCELS);
  const [draft, setDraft] = useState<ParcelInput>({
    address: "",
    parcelId: "",
    zoning: "CX-3",
    currentUse: "One-story commercial",
    lotSqft: 43560,
    buildingSqft: 8000,
    landValue: 1200000,
    improvementValue: 350000,
    yearBuilt: 1970,
    maxFar: 2,
    maxUnitsPerAcre: 48,
    constraintPenalty: 5,
  });

  const results = useMemo(() => parcels.map(analyzeParcel).sort((a, b) => b.score - a.score), [parcels]);
  const top = results[0];

  function update<K extends keyof ParcelInput>(key: K, value: ParcelInput[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function addParcel() {
    if (!draft.address.trim()) return;
    setParcels((prev) => [...prev, { ...draft, parcelId: draft.parcelId || `CUSTOM-${prev.length + 1}` }]);
  }

  return (
    <main className="min-h-screen bg-[#F7F8FA] px-6 py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl bg-gray-950 p-8 text-white shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-300">Development</p>
          <div className="mt-4 grid gap-6 lg:grid-cols-[1.5fr_1fr] lg:items-end">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">Zoning Analysis</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-300">
                Rank underutilized properties for project {projectId} by comparing existing improvements against zoning capacity, land-to-improvement value, building age, lot size, density allowance, and development constraints.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
              <p className="text-xs uppercase tracking-widest text-gray-400">Current top opportunity</p>
              <p className="mt-2 text-lg font-semibold">{top?.address}</p>
              <p className="mt-1 text-sm text-gray-300">Redevelopment score: {top?.score}/100</p>
            </div>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[420px_1fr]">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-900">Analyze a parcel</h2>
            <p className="mt-1 text-xs text-gray-500">Enter parcel, assessor, and zoning assumptions to generate a redevelopment score.</p>
            <div className="mt-5 grid gap-3">
              <input className="rounded-lg border border-gray-200 px-3 py-2 text-sm" placeholder="Address" value={draft.address} onChange={(e) => update("address", e.target.value)} />
              <input className="rounded-lg border border-gray-200 px-3 py-2 text-sm" placeholder="Parcel ID" value={draft.parcelId} onChange={(e) => update("parcelId", e.target.value)} />
              <div className="grid grid-cols-2 gap-3">
                <input className="rounded-lg border border-gray-200 px-3 py-2 text-sm" placeholder="Zoning" value={draft.zoning} onChange={(e) => update("zoning", e.target.value)} />
                <input className="rounded-lg border border-gray-200 px-3 py-2 text-sm" placeholder="Current use" value={draft.currentUse} onChange={(e) => update("currentUse", e.target.value)} />
              </div>
              {([
                ["lotSqft", "Lot square feet"],
                ["buildingSqft", "Current building SF"],
                ["landValue", "Land value"],
                ["improvementValue", "Improvement value"],
                ["yearBuilt", "Year built"],
                ["maxFar", "Max FAR allowed"],
                ["maxUnitsPerAcre", "Max units / acre"],
                ["constraintPenalty", "Constraint penalty"],
              ] as const).map(([key, label]) => (
                <label key={key} className="text-xs font-medium text-gray-500">
                  {label}
                  <input
                    type="number"
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900"
                    value={draft[key]}
                    onChange={(e) => update(key, Number(e.target.value))}
                  />
                </label>
              ))}
              <button onClick={addParcel} className="mt-2 rounded-lg bg-gray-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800">
                Add parcel to ranking
              </button>
            </div>
          </div>

          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-4">
              <Metric label="Parcels ranked" value={String(results.length)} />
              <Metric label="Average score" value={String(Math.round(results.reduce((sum, r) => sum + r.score, 0) / results.length))} />
              <Metric label="Potential building SF" value={number(results.reduce((sum, r) => sum + r.potentialBuildingSqft, 0))} />
              <Metric label="Potential units" value={number(results.reduce((sum, r) => sum + r.potentialUnits, 0))} />
            </div>

            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-100 px-5 py-4">
                <h2 className="text-sm font-semibold text-gray-900">Ranked redevelopment opportunities</h2>
                <p className="mt-1 text-xs text-gray-500">Scores are directional and should be validated against GIS layers, UDO rules, floodplain, historic overlays, easements, and survey data.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-100 text-sm">
                  <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
                    <tr>
                      <th className="px-4 py-3 text-left">Score</th>
                      <th className="px-4 py-3 text-left">Address</th>
                      <th className="px-4 py-3 text-left">Zoning</th>
                      <th className="px-4 py-3 text-right">Current FAR</th>
                      <th className="px-4 py-3 text-right">Max FAR</th>
                      <th className="px-4 py-3 text-right">Potential SF</th>
                      <th className="px-4 py-3 text-right">Potential Units</th>
                      <th className="px-4 py-3 text-right">Land/Improve</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {results.map((parcel) => (
                      <tr key={parcel.parcelId} className="hover:bg-gray-50">
                        <td className="px-4 py-3"><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">{parcel.score}</span></td>
                        <td className="px-4 py-3"><p className="font-medium text-gray-900">{parcel.address}</p><p className="text-xs text-gray-500">{parcel.currentUse} • {parcel.parcelId}</p></td>
                        <td className="px-4 py-3 text-gray-700">{parcel.zoning}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{parcel.currentFar.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{parcel.maxFar.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{number(parcel.potentialBuildingSqft)}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{number(parcel.potentialUnits)}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{parcel.valueRatio.toFixed(1)}x</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <WorkflowCard title="1. Ingest parcel data" text="Load parcel boundaries, assessor values, building square footage, current use, and year built from GIS and tax datasets." />
          <WorkflowCard title="2. Apply zoning capacity" text="Compare existing FAR and unit count against zoning rules for maximum FAR, height, units per acre, and setbacks." />
          <WorkflowCard title="3. Rank opportunities" text="Surface parcels where current improvements are materially below legal development capacity and land value exceeds improvement value." />
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wider text-gray-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-gray-950">{value}</p>
    </div>
  );
}

function WorkflowCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-gray-600">{text}</p>
    </div>
  );
}
