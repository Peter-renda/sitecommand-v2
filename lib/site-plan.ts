// Site Plan AI — generative site-map + floor-plan recommendation engine.
//
// This ports the "generative design / constrained optimization" approach
// (originally sketched in Python + Shapely) to lightweight, dependency-free
// 2D vector math so it can run in the browser. Given a survey (lot + setbacks
// + structures to keep) and a program (square footage, floors, garage, style,
// driveway, walkway, zoning, orientation), it random-searches thousands of
// candidate placements, discards any that break a hard rule, scores the rest
// on soft goals (solar, yard, privacy, tree shade, driveway efficiency), and
// returns the single best layout together with a recommended floor plan.
//
// Coordinate system (feet):
//   x ∈ [0, lotWidth]   (0 = left property line, +x = toward the right line)
//   y ∈ [0, lotDepth]   (0 = street / front property line, +y = toward rear)
// The street frontage runs along y = 0; the front façade of the house faces −y.

export type ArchStyle =
  | "georgian"
  | "federal"
  | "greek_revival"
  | "french"
  | "dutch_colonial"
  | "tudor";

export const ARCH_STYLES: { value: ArchStyle; label: string; symmetrical: boolean }[] = [
  { value: "georgian", label: "Georgian", symmetrical: true },
  { value: "federal", label: "Federal", symmetrical: true },
  { value: "greek_revival", label: "Greek Revival", symmetrical: true },
  { value: "french", label: "French", symmetrical: true },
  { value: "dutch_colonial", label: "Dutch Colonial Revival", symmetrical: true },
  { value: "tudor", label: "Tudor", symmetrical: false },
];

export function isSymmetrical(style: ArchStyle): boolean {
  return style !== "tudor";
}

export type DrivewayStyle = "straight" | "scenic" | "u_drive";

export const DRIVEWAY_STYLES: { value: DrivewayStyle; label: string }[] = [
  { value: "straight", label: "Straight drive" },
  { value: "scenic", label: "Scenic curve" },
  { value: "u_drive", label: "U / circular drive" },
];

export type Compass = "N" | "NE" | "E" | "SE" | "S" | "SW" | "W" | "NW";

export const COMPASS_OPTIONS: { value: Compass; label: string; deg: number }[] = [
  { value: "N", label: "North", deg: 0 },
  { value: "NE", label: "Northeast", deg: 45 },
  { value: "E", label: "East", deg: 90 },
  { value: "SE", label: "Southeast", deg: 135 },
  { value: "S", label: "South", deg: 180 },
  { value: "SW", label: "Southwest", deg: 225 },
  { value: "W", label: "West", deg: 270 },
  { value: "NW", label: "Northwest", deg: 315 },
];

function compassDeg(c: Compass): number {
  return COMPASS_OPTIONS.find((o) => o.value === c)?.deg ?? 0;
}

function degToCompass(deg: number): Compass {
  const d = ((deg % 360) + 360) % 360;
  const idx = Math.round(d / 45) % 8;
  return (["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as Compass[])[idx];
}

export type KeepTree = {
  id: string;
  x: number;
  y: number;
  dripRadius: number;
  deciduous: boolean;
};

export type KeepBuilding = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type SitePlanInput = {
  lotWidth: number;
  lotDepth: number;
  setbackFront: number;
  setbackRear: number;
  setbackSide: number;
  desiredSqft: number;
  floors: number;
  garage: boolean;
  garageBays: number;
  style: ArchStyle;
  drivewayStyle: DrivewayStyle;
  includeWalkway: boolean;
  maxLotCoverage: number; // fraction 0..1 (impervious coverage cap)
  maxFar: number; // floor-area ratio cap; 0 = no limit
  maxHeightFt: number; // informational
  frontFaces: Compass; // compass direction the street / front façade faces
  keepTrees: KeepTree[];
  keepBuildings: KeepBuilding[];
};

export type Vec = { x: number; y: number };
export type Poly = Vec[];

// ---------------------------------------------------------------------------
// Geometry primitives (all convex-polygon based; concave shapes are modeled
// as a union of convex parts so SAT stays valid).
// ---------------------------------------------------------------------------

const EPS = 1e-9;

export function polyArea(p: Poly): number {
  let a = 0;
  for (let i = 0; i < p.length; i++) {
    const j = (i + 1) % p.length;
    a += p[i].x * p[j].y - p[j].x * p[i].y;
  }
  return Math.abs(a) / 2;
}

function boxPoly(minx: number, miny: number, maxx: number, maxy: number): Poly {
  return [
    { x: minx, y: miny },
    { x: maxx, y: miny },
    { x: maxx, y: maxy },
    { x: minx, y: maxy },
  ];
}

function transformPoint(v: Vec, angle: number, dx: number, dy: number): Vec {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: v.x * c - v.y * s + dx, y: v.x * s + v.y * c + dy };
}

function transformPoly(p: Poly, angle: number, dx: number, dy: number): Poly {
  return p.map((v) => transformPoint(v, angle, dx, dy));
}

function polyInsideBox(p: Poly, minx: number, miny: number, maxx: number, maxy: number): boolean {
  return p.every(
    (v) => v.x >= minx - EPS && v.x <= maxx + EPS && v.y >= miny - EPS && v.y <= maxy + EPS
  );
}

function pointInConvex(pt: Vec, poly: Poly): boolean {
  let pos = false;
  let neg = false;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const cross = (b.x - a.x) * (pt.y - a.y) - (b.y - a.y) * (pt.x - a.x);
    if (cross > EPS) pos = true;
    else if (cross < -EPS) neg = true;
    if (pos && neg) return false;
  }
  return true;
}

function project(poly: Poly, ax: Vec): [number, number] {
  let min = Infinity;
  let max = -Infinity;
  for (const v of poly) {
    const d = v.x * ax.x + v.y * ax.y;
    if (d < min) min = d;
    if (d > max) max = d;
  }
  return [min, max];
}

/** Separating-axis overlap test for two convex polygons (touching = false). */
function convexOverlap(a: Poly, b: Poly): boolean {
  const polys = [a, b];
  for (const poly of polys) {
    for (let i = 0; i < poly.length; i++) {
      const p1 = poly[i];
      const p2 = poly[(i + 1) % poly.length];
      const axis = { x: -(p2.y - p1.y), y: p2.x - p1.x };
      const [amin, amax] = project(a, axis);
      const [bmin, bmax] = project(b, axis);
      if (amax <= bmin + EPS || bmax <= amin + EPS) return false;
    }
  }
  return true;
}

function distPointSeg(p: Vec, a: Vec, b: Vec): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const apx = p.x - a.x;
  const apy = p.y - a.y;
  const len2 = abx * abx + aby * aby || EPS;
  let t = (apx * abx + apy * aby) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = a.x + abx * t;
  const cy = a.y + aby * t;
  return Math.hypot(p.x - cx, p.y - cy);
}

function circlePolyOverlap(center: Vec, r: number, poly: Poly): boolean {
  if (pointInConvex(center, poly)) return true;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    if (distPointSeg(center, a, b) <= r) return true;
  }
  return false;
}

/** Rectangle strip of half-width `hw` around segment a→b. */
function segStrip(a: Vec, b: Vec, hw: number): Poly {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || EPS;
  const nx = (-dy / len) * hw;
  const ny = (dx / len) * hw;
  return [
    { x: a.x + nx, y: a.y + ny },
    { x: b.x + nx, y: b.y + ny },
    { x: b.x - nx, y: b.y - ny },
    { x: a.x - nx, y: a.y - ny },
  ];
}

function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Compass bearing of a lot-space direction, given the compass bearing the
 * front façade faces. The outward front normal is (0,−1); +x is a right-hand
 * (non-mirrored) turn from it, so compass = frontBearing − 90 − φ.
 */
function lotDirToCompassDeg(vx: number, vy: number, frontBearing: number): number {
  const phi = (Math.atan2(vy, vx) * 180) / Math.PI;
  return (((frontBearing - 90 - phi) % 360) + 360) % 360;
}

function angularDistance(a: number, b: number): number {
  const d = Math.abs((((a - b) % 360) + 360) % 360);
  return d > 180 ? 360 - d : d;
}

// ---------------------------------------------------------------------------
// House massing by architectural style.
// ---------------------------------------------------------------------------

const GARAGE_SF_PER_BAY = 240; // ~12' × 20' per bay
const GARAGE_DEPTH_FT = 22;
const DRIVE_WIDTH = 12;
const WALK_WIDTH = 4;

type HouseModel = {
  parts: Poly[]; // convex pieces, local coords (centered near origin, front at −y)
  mainPart: Poly;
  garagePart: Poly | null;
  frontDoor: Vec;
  garageDoor: Vec | null;
  mainW: number;
  mainD: number;
  garageW: number;
  garageD: number;
};

/**
 * Build the house footprint in local coordinates for a given garage side.
 * `livingFootprint` is the ground-floor living area (excludes the garage,
 * which is added as an attached wing when present).
 */
function buildHouseModel(
  style: ArchStyle,
  livingFootprint: number,
  garage: boolean,
  garageBays: number,
  side: "left" | "right"
): HouseModel {
  const sign = side === "right" ? 1 : -1;
  const garageArea = garage ? Math.max(1, garageBays) * GARAGE_SF_PER_BAY : 0;
  const garageD = garage ? GARAGE_DEPTH_FT : 0;
  const garageW = garage ? garageArea / garageD : 0;

  if (isSymmetrical(style)) {
    // Wide, shallow rectangular block (classic 5-bay colonial proportions).
    const ratio = 1.8;
    const w = Math.sqrt(livingFootprint * ratio);
    const d = livingFootprint / w;
    const mainPart = boxPoly(-w / 2, -d / 2, w / 2, d / 2);
    const frontDoor: Vec = { x: 0, y: -d / 2 };

    let garagePart: Poly | null = null;
    let garageDoor: Vec | null = null;
    if (garage) {
      // Attached wing, front-flush, on the chosen side.
      const innerX = sign * (w / 2);
      const outerX = sign * (w / 2 + garageW);
      const minx = Math.min(innerX, outerX);
      const maxx = Math.max(innerX, outerX);
      garagePart = boxPoly(minx, -d / 2, maxx, -d / 2 + garageD);
      garageDoor = { x: sign * (w / 2 + garageW / 2), y: -d / 2 };
    }
    return {
      parts: garagePart ? [mainPart, garagePart] : [mainPart],
      mainPart,
      garagePart,
      frontDoor,
      garageDoor,
      mainW: w,
      mainD: d,
      garageW,
      garageD,
    };
  }

  // Tudor: asymmetrical L (main block + projecting cross-gable wing).
  const mainArea = livingFootprint * 0.62;
  const wingArea = livingFootprint * 0.38;
  const mw = Math.sqrt(mainArea * 1.3);
  const md = mainArea / mw;
  const wingW = Math.sqrt(wingArea * 0.9);
  const wingD = wingArea / wingW;
  const mainPart = boxPoly(-mw / 2, -md / 2, mw / 2, md / 2);
  // Cross-gable wing projects forward on one side.
  const wingInner = sign * (mw / 2 - wingW);
  const wingOuter = sign * (mw / 2);
  const wingMinX = Math.min(wingInner, wingOuter);
  const wingMaxX = Math.max(wingInner, wingOuter);
  const wingPart = boxPoly(wingMinX, -md / 2 - wingD, wingMaxX, -md / 2 + EPS);
  const frontDoor: Vec = { x: -sign * mw * 0.12, y: -md / 2 };

  const parts: Poly[] = [mainPart, wingPart];
  let garagePart: Poly | null = null;
  let garageDoor: Vec | null = null;
  if (garage) {
    // Garage tucks on the opposite side of the projecting wing.
    const gSign = -sign;
    const innerX = gSign * (mw / 2);
    const outerX = gSign * (mw / 2 + garageW);
    const minx = Math.min(innerX, outerX);
    const maxx = Math.max(innerX, outerX);
    garagePart = boxPoly(minx, -md / 2, maxx, -md / 2 + garageD);
    garageDoor = { x: gSign * (mw / 2 + garageW / 2), y: -md / 2 };
    parts.push(garagePart);
  }
  return {
    parts,
    mainPart,
    garagePart,
    frontDoor,
    garageDoor,
    mainW: mw,
    mainD: md,
    garageW,
    garageD,
  };
}

// ---------------------------------------------------------------------------
// Floor-plan recommendation.
// ---------------------------------------------------------------------------

export type RoomZone = {
  name: string;
  x: number; // local footprint coords, front at y=0 (bottom), rear at y=depth
  y: number;
  w: number;
  h: number;
  kind: "public" | "service" | "private" | "garage" | "circulation";
};

export type FloorProgram = { floor: string; rooms: string[] };

export type FloorPlanRecommendation = {
  styleLabel: string;
  symmetrical: boolean;
  grossSqft: number;
  footprintSqft: number;
  footprintW: number;
  footprintD: number;
  floors: number;
  beds: number;
  fullBaths: number;
  halfBaths: number;
  garageBays: number;
  massing: string;
  program: FloorProgram[];
  zones: RoomZone[]; // schematic ground-floor zones
  zoneW: number;
  zoneD: number;
  rationale: string[];
};

function recommendFloorPlan(
  input: SitePlanInput,
  model: HouseModel,
  solarLabel: string
): FloorPlanRecommendation {
  const styleMeta = ARCH_STYLES.find((s) => s.value === input.style)!;
  const symmetrical = styleMeta.symmetrical;
  const footprintSqft = model.parts.reduce((s, p) => s + polyArea(p), 0);

  const beds = Math.max(2, Math.min(6, Math.round(input.desiredSqft / 800)));
  const fullBaths = Math.max(2, Math.min(5, Math.round(beds * 0.8) + 1));
  const halfBaths = 1;

  const w = model.mainW;
  const d = model.mainD;

  // Schematic ground-floor zones in a local frame (front at bottom, y grows to rear).
  const zones: RoomZone[] = [];
  let zoneW = w;
  let zoneD = d;

  if (symmetrical) {
    const hallW = w * 0.2;
    const hallX = (w - hallW) / 2;
    const frontD = d * 0.46;
    // Center hall (circulation spine)
    zones.push({ name: "Center hall / foyer", x: hallX, y: 0, w: hallW, h: d, kind: "circulation" });
    // Front flanking formal rooms
    zones.push({ name: "Living room", x: 0, y: 0, w: hallX, h: frontD, kind: "public" });
    zones.push({ name: "Dining room", x: hallX + hallW, y: 0, w: hallX, h: frontD, kind: "public" });
    // Rear rooms open to the yard
    zones.push({ name: "Kitchen", x: 0, y: frontD, w: hallX, h: d - frontD, kind: "service" });
    zones.push({
      name: "Family room",
      x: hallX + hallW,
      y: frontD,
      w: hallX,
      h: d - frontD,
      kind: "public",
    });
    zoneW = w;
    zoneD = d;
  } else {
    // Tudor L — entry + great room in the main block, kitchen in the wing.
    const entryW = w * 0.28;
    zones.push({ name: "Entry vestibule", x: 0, y: 0, w: entryW, h: d * 0.4, kind: "circulation" });
    zones.push({ name: "Great room", x: entryW, y: 0, w: w - entryW, h: d * 0.55, kind: "public" });
    zones.push({ name: "Kitchen + breakfast", x: 0, y: d * 0.55, w: w * 0.6, h: d * 0.45, kind: "service" });
    zones.push({ name: "Dining / study", x: w * 0.6, y: d * 0.4, w: w * 0.4, h: d * 0.6, kind: "public" });
    zoneW = w;
    zoneD = d;
  }

  if (input.garage && model.garagePart) {
    // Place the garage zone relative to the main block for the schematic.
    const gArea = polyArea(model.garagePart);
    const gW = model.garageW || gArea / GARAGE_DEPTH_FT;
    // Draw garage to whichever side has the door (sign of garageDoor.x).
    const right = (model.garageDoor?.x ?? 1) >= 0;
    if (right) {
      zones.push({ name: `${input.garageBays}-car garage`, x: w, y: 0, w: gW, h: model.garageD, kind: "garage" });
      zoneW = w + gW;
    } else {
      // shift all existing zones right by gW and place garage at x=0
      for (const z of zones) z.x += gW;
      zones.push({ name: `${input.garageBays}-car garage`, x: 0, y: 0, w: gW, h: model.garageD, kind: "garage" });
      zoneW = w + gW;
    }
  }

  // Room program by floor.
  const program: FloorProgram[] = [];
  const groundPublic = symmetrical
    ? ["Foyer / center hall", "Living room", "Dining room", "Kitchen + breakfast", "Family room", "Powder room", "Mudroom"]
    : ["Entry vestibule", "Great room", "Kitchen + breakfast", "Dining room", "Study / library", "Powder room", "Boot / mud room"];
  if (input.garage) groundPublic.push(`${input.garageBays}-car garage`);

  if (input.floors <= 1) {
    // Ranch — bedrooms on the ground floor.
    const rooms = [...groundPublic];
    rooms.push(`Primary suite (bed + bath + WIC)`);
    for (let i = 1; i < beds; i++) rooms.push(`Bedroom ${i + 1}`);
    for (let i = 0; i < fullBaths - 1; i++) rooms.push(`Full bath ${i + 1}`);
    rooms.push("Laundry");
    program.push({ floor: "Main floor", rooms });
  } else {
    program.push({ floor: "Ground floor", rooms: groundPublic });
    const bedFloors = input.floors - 1;
    let bedIdx = 0;
    for (let f = 0; f < bedFloors; f++) {
      const rooms: string[] = [];
      if (f === 0) rooms.push("Primary suite (bed + spa bath + walk-in closet)");
      const per = Math.ceil((beds - 1) / bedFloors);
      for (let i = 0; i < per && bedIdx < beds - 1; i++) {
        bedIdx++;
        rooms.push(`Bedroom ${bedIdx + 1}`);
      }
      const bathsHere = Math.max(1, Math.round((fullBaths - 1) / bedFloors));
      for (let i = 0; i < bathsHere; i++) rooms.push(`Full bath`);
      if (f === 0) rooms.push("Laundry");
      program.push({ floor: input.floors === 2 ? "Upper floor" : `Floor ${f + 2}`, rooms });
    }
  }

  const massing = symmetrical
    ? `Symmetrical ${styleMeta.label} block — a balanced façade on a strong central axis, formal rooms flanking a center hall, and the ${input.garage ? "garage held back as a subordinate wing" : "service rooms"} to keep the primary mass composed.`
    : `Asymmetrical ${styleMeta.label} composition — an L-shaped footprint with a projecting cross-gable that lets the plan wrap around site features, an off-center entry, and a steeply massed great room.`;

  const rationale: string[] = [
    `${Math.round(input.desiredSqft).toLocaleString()} sq ft over ${input.floors} floor${input.floors > 1 ? "s" : ""} → ~${Math.round(footprintSqft).toLocaleString()} sq ft ground-floor footprint.`,
    `${styleMeta.label} reads as ${symmetrical ? "symmetrical" : "asymmetrical"}, so the generator ${symmetrical ? "used a single rectangular primary mass" : "used an L-shaped composite mass"}.`,
    `Suggested program: ${beds} bedrooms · ${fullBaths} full + ${halfBaths} half baths${input.garage ? ` · ${input.garageBays}-car garage` : ""}.`,
    `Primary living + glazing placed to the ${solarLabel.toLowerCase()} for daylight; ${input.garage ? "garage set as a thermal buffer on the cooler/hotter exposure." : "service spaces set on the harsher exposure."}`,
  ];

  return {
    styleLabel: styleMeta.label,
    symmetrical,
    grossSqft: Math.round(input.desiredSqft),
    footprintSqft: Math.round(footprintSqft),
    footprintW: Math.round(zoneW),
    footprintD: Math.round(zoneD),
    floors: input.floors,
    beds,
    fullBaths,
    halfBaths,
    garageBays: input.garage ? input.garageBays : 0,
    massing,
    program,
    zones,
    zoneW,
    zoneD,
    rationale,
  };
}

// ---------------------------------------------------------------------------
// Main generator.
// ---------------------------------------------------------------------------

export type SitePlanMetrics = {
  footprintSqft: number;
  imperviousSqft: number;
  lotCoveragePct: number;
  maxLotCoveragePct: number;
  far: number;
  maxFar: number;
  rearYardFt: number;
  minSideYardFt: number;
  frontYardFt: number;
  drivewayLengthFt: number;
  solarLabel: string;
  solarScore: number; // 0..100
  treesPreserved: number;
  buildingsPreserved: number;
  northAngleDeg: number; // lot-space math angle (deg) that points to compass North
  sunSideCompass: Compass;
};

export type SitePlanLayout = {
  houseParts: Poly[];
  mainPart: Poly;
  garagePart: Poly | null;
  driveway: Poly[];
  drivewayCenter: Vec[];
  walkway: Poly[];
  walkwayCenter: Vec[];
  frontDoor: Vec;
  garageDoor: Vec | null;
  angleDeg: number;
  garageSide: "left" | "right";
};

export type SitePlanResult =
  | {
      ok: true;
      input: SitePlanInput;
      envelope: { minx: number; miny: number; maxx: number; maxy: number };
      layout: SitePlanLayout;
      metrics: SitePlanMetrics;
      floorPlan: FloorPlanRecommendation;
      score: number;
      iterationsTried: number;
      validFound: number;
    }
  | {
      ok: false;
      input: SitePlanInput;
      reasons: string[];
    };

function buildDriveway(
  garageDoor: Vec,
  style: DrivewayStyle,
  lotWidth: number
): { strips: Poly[]; center: Vec[]; length: number } {
  const gx = garageDoor.x;
  const gy = garageDoor.y;
  let center: Vec[];
  if (style === "u_drive") {
    center = [
      { x: lotWidth * 0.2, y: 0 },
      { x: gx, y: gy },
      { x: lotWidth * 0.8, y: 0 },
    ];
  } else if (style === "scenic") {
    const midX = gx < lotWidth / 2 ? gx + Math.min(28, lotWidth * 0.2) : gx - Math.min(28, lotWidth * 0.2);
    center = [
      { x: gx, y: 0 },
      { x: midX, y: gy * 0.5 },
      { x: gx, y: gy },
    ];
  } else {
    center = [
      { x: gx, y: 0 },
      { x: gx, y: gy },
    ];
  }
  const strips: Poly[] = [];
  let length = 0;
  for (let i = 0; i < center.length - 1; i++) {
    strips.push(segStrip(center[i], center[i + 1], DRIVE_WIDTH / 2));
    length += Math.hypot(center[i + 1].x - center[i].x, center[i + 1].y - center[i].y);
  }
  return { strips, center, length };
}

function stripsArea(center: Vec[], width: number): number {
  let a = 0;
  for (let i = 0; i < center.length - 1; i++) {
    a += Math.hypot(center[i + 1].x - center[i].x, center[i + 1].y - center[i].y) * width;
  }
  return a;
}

export function generateSitePlan(input: SitePlanInput, seed = 1): SitePlanResult {
  const reasons: string[] = [];
  const {
    lotWidth,
    lotDepth,
    setbackFront,
    setbackRear,
    setbackSide,
    desiredSqft,
    floors,
    garage,
    garageBays,
    style,
    drivewayStyle,
    includeWalkway,
    maxLotCoverage,
    maxFar,
    frontFaces,
  } = input;

  if (lotWidth <= 0 || lotDepth <= 0) {
    return { ok: false, input, reasons: ["Lot dimensions must be positive."] };
  }

  const lotArea = lotWidth * lotDepth;
  const envMinX = setbackSide;
  const envMinY = setbackFront;
  const envMaxX = lotWidth - setbackSide;
  const envMaxY = lotDepth - setbackRear;
  const buildableW = envMaxX - envMinX;
  const buildableD = envMaxY - envMinY;

  if (buildableW <= 0 || buildableD <= 0) {
    return {
      ok: false,
      input,
      reasons: ["Setbacks consume the entire lot — no buildable envelope remains."],
    };
  }

  const livingFootprint = desiredSqft / Math.max(1, floors);
  const garageArea = garage ? Math.max(1, garageBays) * GARAGE_SF_PER_BAY : 0;
  const requiredFootprint = livingFootprint + garageArea;

  // Feasibility pre-checks (cheap, actionable).
  if (requiredFootprint > buildableW * buildableD) {
    reasons.push(
      `Required footprint (~${Math.round(requiredFootprint).toLocaleString()} sq ft) is larger than the buildable envelope (${Math.round(buildableW)}×${Math.round(buildableD)} ft).`
    );
  }
  if (requiredFootprint / lotArea > maxLotCoverage) {
    reasons.push(
      `The building footprint alone (${Math.round((requiredFootprint / lotArea) * 100)}%) exceeds the max lot coverage (${Math.round(maxLotCoverage * 100)}%).`
    );
  }
  if (reasons.length) return { ok: false, input, reasons };

  const frontBearing = compassDeg(frontFaces);
  const rearBearing = (frontBearing + 180) % 360;
  // Solar quality: living/glazing assumed at the rear; reward rear-facing-south.
  const rearSouthDelta = angularDistance(rearBearing, 180);
  const solarScore = Math.round(Math.max(0, 100 - (rearSouthDelta / 180) * 100));
  const solarLabel =
    rearSouthDelta <= 25 ? "South" : rearSouthDelta <= 70 ? degToCompass(rearBearing) : degToCompass(rearBearing);
  const sunSideCompass = degToCompass(rearBearing);
  const northAngleDeg = frontBearing - 90; // lot-space math angle pointing to compass North

  const obstaclesTrees = input.keepTrees.filter((t) => t.dripRadius > 0);
  const obstaclesBuildings = input.keepBuildings.map((b) =>
    boxPoly(b.x - b.w / 2, b.y - b.h / 2, b.x + b.w / 2, b.y + b.h / 2)
  );

  const rand = mulberry32(seed);
  const iterations = 6000;
  const maxRotRad = (8 * Math.PI) / 180;

  let best: {
    model: HouseModel;
    angle: number;
    cx: number;
    cy: number;
    side: "left" | "right";
    parts: Poly[];
    mainPart: Poly;
    garagePart: Poly | null;
    frontDoor: Vec;
    garageDoor: Vec | null;
    driveStrips: Poly[];
    driveCenter: Vec[];
    driveLen: number;
    walkStrips: Poly[];
    walkCenter: Vec[];
    coverage: number;
    imperviousArea: number;
    score: number;
  } | null = null;
  let validFound = 0;

  // Pre-build both garage-side models once.
  const modelLeft = buildHouseModel(style, livingFootprint, garage, garageBays, "left");
  const modelRight = buildHouseModel(style, livingFootprint, garage, garageBays, "right");

  for (let i = 0; i < iterations; i++) {
    const side: "left" | "right" = rand() < 0.5 ? "left" : "right";
    const model = side === "left" ? modelLeft : modelRight;
    const angle = (rand() * 2 - 1) * maxRotRad;
    const cx = envMinX + rand() * (envMaxX - envMinX);
    const cy = envMinY + rand() * (envMaxY - envMinY);

    const parts = model.parts.map((p) => transformPoly(p, angle, cx, cy));

    // Hard: entirely inside setback envelope.
    if (!parts.every((p) => polyInsideBox(p, envMinX, envMinY, envMaxX, envMaxY))) continue;

    // Hard: clear kept trees & buildings.
    let collide = false;
    for (const p of parts) {
      for (const t of obstaclesTrees) {
        if (circlePolyOverlap({ x: t.x, y: t.y }, t.dripRadius, p)) {
          collide = true;
          break;
        }
      }
      if (collide) break;
      for (const b of obstaclesBuildings) {
        if (convexOverlap(p, b)) {
          collide = true;
          break;
        }
      }
      if (collide) break;
    }
    if (collide) continue;

    const frontDoor = transformPoint(model.frontDoor, angle, cx, cy);
    const garageDoor = model.garageDoor ? transformPoint(model.garageDoor, angle, cx, cy) : null;

    // Infrastructure.
    let driveStrips: Poly[] = [];
    let driveCenter: Vec[] = [];
    let driveLen = 0;
    if (garage && garageDoor) {
      const dw = buildDriveway(garageDoor, drivewayStyle, lotWidth);
      driveStrips = dw.strips;
      driveCenter = dw.center;
      driveLen = dw.length;
    }
    let walkStrips: Poly[] = [];
    let walkCenter: Vec[] = [];
    if (includeWalkway) {
      walkCenter = [
        { x: frontDoor.x, y: 0 },
        { x: frontDoor.x, y: frontDoor.y },
      ];
      walkStrips = [segStrip(walkCenter[0], walkCenter[1], WALK_WIDTH / 2)];
    }

    // Hard: paths must not cut through kept trees / buildings.
    const paths = [...driveStrips, ...walkStrips];
    let pathCollide = false;
    for (const path of paths) {
      for (const t of obstaclesTrees) {
        if (circlePolyOverlap({ x: t.x, y: t.y }, t.dripRadius, path)) {
          pathCollide = true;
          break;
        }
      }
      if (pathCollide) break;
      for (const b of obstaclesBuildings) {
        if (convexOverlap(path, b)) {
          pathCollide = true;
          break;
        }
      }
      if (pathCollide) break;
    }
    if (pathCollide) continue;

    // Hard: lot coverage (impervious).
    const footprintArea = parts.reduce((s, p) => s + polyArea(p), 0);
    const driveArea = stripsArea(driveCenter, DRIVE_WIDTH);
    const walkArea = stripsArea(walkCenter, WALK_WIDTH);
    const imperviousArea = footprintArea + driveArea + walkArea;
    const coverage = imperviousArea / lotArea;
    if (coverage > maxLotCoverage) continue;

    validFound++;

    // ----- Soft scoring -----
    let score = 0;

    // Generous rear yard: reward the house sitting toward the front.
    const houseRearY = Math.max(...parts.flatMap((p) => p.map((v) => v.y)));
    const rearYard = envMaxY - houseRearY;
    score += Math.min(rearYard, 60) * 0.8;

    // Balanced, generous side yards (privacy).
    const houseMinX = Math.min(...parts.flatMap((p) => p.map((v) => v.x)));
    const houseMaxX = Math.max(...parts.flatMap((p) => p.map((v) => v.x)));
    const leftYard = houseMinX - envMinX;
    const rightYard = envMaxX - houseMaxX;
    const minSide = Math.min(leftYard, rightYard);
    score += Math.min(minSide, 25) * 0.6; // reward breathing room
    score -= Math.abs(leftYard - rightYard) * 0.15; // reward balance

    // Solar (fixed by street bearing; same for every placement but keeps the
    // objective honest and lets us compare across styles/rotations).
    score += solarScore * 0.3;

    // Deciduous tree shade to the S/W of the house center = summer shade.
    const hcx = parts.flatMap((p) => p.map((v) => v.x)).reduce((a, b) => a + b, 0) / (parts.length * 4);
    const hcy = parts.flatMap((p) => p.map((v) => v.y)).reduce((a, b) => a + b, 0) / (parts.length * 4);
    for (const t of obstaclesTrees) {
      if (!t.deciduous) continue;
      const bear = lotDirToCompassDeg(t.x - hcx, t.y - hcy, frontBearing);
      // S(180) through W(270) arc is ideal for afternoon summer shade.
      if (bear >= 135 && bear <= 292.5) score += 12;
    }

    // Garage as thermal buffer on the N/W exposure.
    if (garageDoor) {
      const gbear = lotDirToCompassDeg(garageDoor.x - hcx, garageDoor.y - hcy, frontBearing);
      const isNorthWest = gbear >= 247.5 || gbear <= 67.5; // W..N..NE arc
      if (isNorthWest) score += 8;
    }

    // Driveway efficiency: shorter/straighter is cheaper & less impervious.
    score -= driveArea * 0.02;

    if (!best || score > best.score) {
      best = {
        model,
        angle,
        cx,
        cy,
        side,
        parts,
        mainPart: transformPoly(model.mainPart, angle, cx, cy),
        garagePart: model.garagePart ? transformPoly(model.garagePart, angle, cx, cy) : null,
        frontDoor,
        garageDoor,
        driveStrips,
        driveCenter,
        driveLen,
        walkStrips,
        walkCenter,
        coverage,
        imperviousArea,
        score,
      };
    }
  }

  if (!best) {
    return {
      ok: false,
      input,
      reasons: [
        "No valid layout satisfied every hard constraint (setbacks, tree/building clearances, driveway routing, and lot coverage).",
        "Try a smaller footprint, fewer floors, a simpler driveway, a higher lot-coverage cap, or relaxing the structures you're keeping.",
      ],
    };
  }

  const houseRearY = Math.max(...best.parts.flatMap((p) => p.map((v) => v.y)));
  const houseFrontY = Math.min(...best.parts.flatMap((p) => p.map((v) => v.y)));
  const houseMinX = Math.min(...best.parts.flatMap((p) => p.map((v) => v.x)));
  const houseMaxX = Math.max(...best.parts.flatMap((p) => p.map((v) => v.x)));
  const footprintSqft = best.parts.reduce((s, p) => s + polyArea(p), 0);

  const metrics: SitePlanMetrics = {
    footprintSqft: Math.round(footprintSqft),
    imperviousSqft: Math.round(best.imperviousArea),
    lotCoveragePct: +(best.coverage * 100).toFixed(1),
    maxLotCoveragePct: Math.round(maxLotCoverage * 100),
    far: +(desiredSqft / lotArea).toFixed(2),
    maxFar,
    rearYardFt: Math.round(envMaxY - houseRearY + setbackRear),
    minSideYardFt: Math.round(Math.min(houseMinX - envMinX, envMaxX - houseMaxX) + setbackSide),
    frontYardFt: Math.round(houseFrontY),
    drivewayLengthFt: Math.round(best.driveLen),
    solarLabel,
    solarScore,
    treesPreserved: obstaclesTrees.length,
    buildingsPreserved: obstaclesBuildings.length,
    northAngleDeg,
    sunSideCompass,
  };

  const floorPlan = recommendFloorPlan(input, best.model, solarLabel);

  return {
    ok: true,
    input,
    envelope: { minx: envMinX, miny: envMinY, maxx: envMaxX, maxy: envMaxY },
    layout: {
      houseParts: best.parts,
      mainPart: best.mainPart,
      garagePart: best.garagePart,
      driveway: best.driveStrips,
      drivewayCenter: best.driveCenter,
      walkway: best.walkStrips,
      walkwayCenter: best.walkCenter,
      frontDoor: best.frontDoor,
      garageDoor: best.garageDoor,
      angleDeg: +((best.angle * 180) / Math.PI).toFixed(1),
      garageSide: best.side,
    },
    metrics,
    floorPlan,
    score: Math.round(best.score),
    iterationsTried: iterations,
    validFound,
  };
}

export const DEFAULT_SITE_PLAN_INPUT: SitePlanInput = {
  lotWidth: 100,
  lotDepth: 150,
  setbackFront: 30,
  setbackRear: 25,
  setbackSide: 10,
  desiredSqft: 3600,
  floors: 2,
  garage: true,
  garageBays: 2,
  style: "georgian",
  drivewayStyle: "straight",
  includeWalkway: true,
  maxLotCoverage: 0.35,
  maxFar: 0,
  maxHeightFt: 35,
  frontFaces: "N",
  keepTrees: [{ id: "t1", x: 30, y: 95, dripRadius: 14, deciduous: true }],
  keepBuildings: [],
};
