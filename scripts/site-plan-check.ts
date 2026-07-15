/**
 * Offline check for the Site Plan generative engine (lib/site-plan.ts).
 *
 * Run: npx tsx scripts/site-plan-check.ts
 *
 * Verifies (no network / no keys):
 *   1. A default survey yields a valid layout (ok:true)
 *   2. Every house part sits fully inside the setback envelope
 *   3. The house and every paved path clear the kept tree's drip line
 *   4. Impervious lot coverage stays within the zoning cap
 *   5. Driveway + walkway are generated when requested
 *   6. A floor-plan recommendation comes back with sane numbers + zones
 *   7. An over-sized program fails gracefully with actionable reasons
 *   8. Tudor (asymmetrical) massing also solves
 *   9. Generation is deterministic for a fixed seed
 *
 * Exits non-zero on the first failed assertion.
 */
import assert from "node:assert/strict";
import type { Poly, Vec, SitePlanResult } from "../lib/site-plan";
import {
  generateSitePlan,
  DEFAULT_SITE_PLAN_INPUT,
  polyArea,
} from "../lib/site-plan";

let passed = 0;
function pass(msg: string) {
  passed++;
  console.log(`  ✓ ${msg}`);
}

function distPointSeg(p: Vec, a: Vec, b: Vec): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const len2 = abx * abx + aby * aby || 1e-9;
  let t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + abx * t), p.y - (a.y + aby * t));
}
function pointInPoly(pt: Vec, poly: Poly): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > pt.y !== b.y > pt.y && pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}
function circleClears(center: Vec, r: number, poly: Poly): boolean {
  if (pointInPoly(center, poly)) return false;
  for (let i = 0; i < poly.length; i++) {
    if (distPointSeg(center, poly[i], poly[(i + 1) % poly.length]) <= r - 1e-6) return false;
  }
  return true;
}

function requireOk(r: SitePlanResult): Extract<SitePlanResult, { ok: true }> {
  assert.equal(r.ok, true, "expected a valid layout");
  return r as Extract<SitePlanResult, { ok: true }>;
}

console.log("Site Plan engine check\n");

// 1 + 2 + 3 + 4 + 5 — default survey.
{
  const r = requireOk(generateSitePlan(DEFAULT_SITE_PLAN_INPUT, 7));
  pass("default survey produced a valid layout");

  const { minx, miny, maxx, maxy } = r.envelope;
  for (const part of r.layout.houseParts) {
    for (const v of part) {
      assert.ok(
        v.x >= minx - 1e-6 && v.x <= maxx + 1e-6 && v.y >= miny - 1e-6 && v.y <= maxy + 1e-6,
        `house vertex (${v.x.toFixed(1)}, ${v.y.toFixed(1)}) escaped the setback envelope`
      );
    }
  }
  pass("house sits entirely within the setback envelope");

  const tree = DEFAULT_SITE_PLAN_INPUT.keepTrees[0];
  const treePt = { x: tree.x, y: tree.y };
  for (const part of r.layout.houseParts) {
    assert.ok(circleClears(treePt, tree.dripRadius, part), "house intruded on the tree drip line");
  }
  for (const path of [...r.layout.driveway, ...r.layout.walkway]) {
    assert.ok(circleClears(treePt, tree.dripRadius, path), "a paved path crossed the tree drip line");
  }
  pass("house and paved paths clear the preserved tree's drip line");

  assert.ok(
    r.metrics.lotCoveragePct <= r.metrics.maxLotCoveragePct + 1e-6,
    `coverage ${r.metrics.lotCoveragePct}% exceeded cap ${r.metrics.maxLotCoveragePct}%`
  );
  pass(`impervious coverage ${r.metrics.lotCoveragePct}% within the ${r.metrics.maxLotCoveragePct}% cap`);

  assert.ok(r.layout.driveway.length > 0, "expected a driveway (garage present)");
  assert.ok(r.layout.walkway.length > 0, "expected a front walkway");
  assert.ok(r.metrics.drivewayLengthFt > 0, "driveway length should be positive");
  pass("driveway + front walkway were generated");

  // 6 — floor plan recommendation.
  const fp = r.floorPlan;
  assert.ok(fp.beds >= 2 && fp.beds <= 6, "bed count out of range");
  assert.ok(fp.program.length >= 1, "expected at least one floor of program");
  assert.ok(fp.zones.length >= 4, "expected schematic zones");
  const zonesArea = fp.zones
    .filter((z) => z.kind !== "garage")
    .reduce((s, z) => s + z.w * z.h, 0);
  assert.ok(zonesArea > 0, "schematic zones should cover area");
  assert.ok(polyArea(r.layout.mainPart) > 0, "main footprint should have area");
  pass(
    `floor plan: ${fp.beds} bd / ${fp.fullBaths} ba, ${fp.footprintSqft.toLocaleString()} sf footprint, ${fp.program.length} floor(s), ${fp.zones.length} zones`
  );
}

// 7 — infeasible program fails gracefully.
{
  const r = generateSitePlan(
    { ...DEFAULT_SITE_PLAN_INPUT, desiredSqft: 40000, floors: 1, lotWidth: 60, lotDepth: 80 },
    7
  );
  assert.equal(r.ok, false, "over-sized program should be infeasible");
  if (!r.ok) {
    assert.ok(r.reasons.length > 0, "infeasible result should explain why");
    pass(`over-sized program rejected: "${r.reasons[0].slice(0, 60)}..."`);
  }
}

// 8 — Tudor solves.
{
  const r = requireOk(
    generateSitePlan({ ...DEFAULT_SITE_PLAN_INPUT, style: "tudor", keepTrees: [] }, 3)
  );
  assert.equal(r.floorPlan.symmetrical, false, "Tudor should be asymmetrical");
  assert.ok(r.layout.houseParts.length >= 2, "Tudor should have an L-shaped (multi-part) footprint");
  pass("Tudor asymmetrical massing solved");
}

// 9 — deterministic for a fixed seed.
{
  const a = requireOk(generateSitePlan(DEFAULT_SITE_PLAN_INPUT, 42));
  const b = requireOk(generateSitePlan(DEFAULT_SITE_PLAN_INPUT, 42));
  assert.equal(a.score, b.score, "same seed should give the same score");
  assert.equal(a.layout.angleDeg, b.layout.angleDeg, "same seed should give the same rotation");
  pass("generation is deterministic for a fixed seed");
}

console.log(`\nAll ${passed} checks passed.`);
