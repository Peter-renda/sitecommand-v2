/**
 * "Site & Civil" track — the deep-dive expansion of sitework, built from the
 * Site Planning & Design topic map (site analysis, grading, E&S/SWPPP,
 * stormwater/LID, utilities, streets & parking, ADA routes, landscape, and
 * the entitlement/design-side context). Written from the designer's side of
 * the table on purpose: a PM who understands why the civil and landscape
 * sets look the way they do can read intent, catch gaps, and write better
 * RFIs. Ordered as a PM learning sequence (read the site → own the
 * compliance → build the scope → context → the design team).
 *
 * Client-safe; imports only types from training-lessons (no runtime cycle).
 */

import type { Lesson, LessonLink } from "./training-lessons";

const PRACTICE_LINK: LessonLink = {
  label: "Practice this in your training sandbox",
  href: "/training/practice",
};

export const SITEWORK_LESSONS: Lesson[] = [
  // ─────────────────────────── Reading the Site ───────────────────────────
  {
    id: "sc-site-analysis",
    track: "sitework",
    category: "Reading the Site",
    title: "Site Analysis & Due Diligence: What the PM Inherits",
    summary:
      "How designers evaluated the parcel before a line was drawn — surveys, hydrology, past uses — and why that history shows up in your dirt.",
    minutes: 5,
    keyTerms: [
      { term: "Boundary & topographic survey", definition: "The legal and physical baseline drawing: property lines, easements, rights-of-way, benchmarks, contours, and existing features." },
      { term: "Easement", definition: "Someone else's legal right to use part of the site (utilities, access, drainage) — you generally can't build structures in one." },
      { term: "Floodplain / FEMA map", definition: "Mapped flood-risk zones that constrain where and how low the building can sit, and drive flood-proofing requirements." },
    ],
    body: [
      {
        heading: "The site was studied before you got it",
        paragraphs: [
          "Before design started, someone assembled the site's story from surveys, GIS, aerial photos, soil surveys, FEMA maps, and local records: where water flows, where the good soil is, what the zoning allows, what the neighbors expect. The building sits where it sits, the pond is where it is, and the entrance comes off that street for reasons — and knowing those reasons is how a PM distinguishes 'this looks odd, must be an error' (RFI) from 'this looks odd, and is load-bearing' (leave it alone, or ask why before proposing to move it).",
        ],
      },
      {
        heading: "Read the survey like a contract document",
        bullets: [
          "Benchmarks and control — the elevations everything is measured from; confirm your surveyor ties to the same datum before layout.",
          "Easements and rights-of-way — utility, access, and drainage easements are no-build (often no-stockpile) zones. Staging a crane or a spoil pile in one invites a fast, unfriendly letter.",
          "Existing contours vs. proposed — the difference is the earthwork scope, and the low point of existing grade tells you where water goes when your erosion controls fail.",
          "Adjacent conditions — existing buildings, trees, and property-line grades constrain your means and methods (shoring, crane swing, protection).",
        ],
      },
      {
        heading: "The past is in the ground",
        paragraphs: [
          "Historical use is the best predictor of underground surprises: old foundations, wells, buried tanks, uncontrolled fill from a previous demolition. The site analysis and geotech report usually flag known history — read both before mass grading, and treat their silence on an area as 'unknown,' not 'clean.' When the excavator hits something the documents didn't show, that's a differing site condition: stop, photograph, notify, and paper it while the hole is still open.",
        ],
      },
    ],
    relatedLessonIds: ["sc-grading", "sc-environmental", "tech-sitework"],
  },
  {
    id: "sc-grading",
    track: "sitework",
    category: "Reading the Site",
    title: "Grading Plans & Earthwork Engineering",
    summary:
      "Reading contours and spot grades, the balanced-site concept, slopes and retaining walls, and the grading start-up meeting that prevents rework.",
    minutes: 7,
    keyTerms: [
      { term: "Spot grade", definition: "A precise design elevation at a point (corner of pad, rim of structure, edge of pavement) — the numbers that override contour interpolation." },
      { term: "Balanced site", definition: "A grading design where cut volume ≈ fill volume, so no dirt is imported or exported. Designers chase it because trucking dirt is pure cost." },
      { term: "Limits of disturbance (LOD)", definition: "The line on the plans beyond which nothing is cleared, graded, driven on, or stockpiled — including tree save areas." },
    ],
    body: [
      {
        heading: "Reading the grading plan",
        bullets: [
          "Existing contours (usually dashed) vs. proposed (solid): where proposed sits below existing you're cutting; above, filling. Where they merge is the grading limit.",
          "Spot grades govern the critical points: finish floor elevations, structure rims and inverts, high points, pavement grades. When a spot grade and a contour disagree — or a spot grade conflicts with a storm structure's rim — that's a specific, sheet-referenced RFI.",
          "Drainage arrows show intent: positive drainage away from the building, swales collecting to inlets. If you can't trace every drop of water to an inlet or a discharge point, the plan has a gap.",
          "Slope callouts (3:1, 4:1) and wall locations: 3:1 is a common mowable maximum; steeper needs stabilization or a wall, and the geotech sets what the soil can actually hold.",
        ],
      },
      {
        heading: "Why the design looks like it does",
        paragraphs: [
          "The designer was solving a cost equation: balance the cut and fill (import/export is expensive), keep slopes gentle enough to stabilize, keep disturbance inside the LOD, and get positive drainage everywhere — all while hitting ADA grades at every entrance and route. On hillsides, add bench cuts and terracing. Retaining walls appear where grade change must happen in less horizontal room than a slope allows; note that segmental and other engineered walls over a few feet are delegated design needing a PE-stamped submittal — a long-lead item hiding in the landscape package.",
        ],
      },
      {
        heading: "The grading start-up meeting",
        ordered: [
          "Confirm survey control and datum with the surveyor and the sitework foreman.",
          "Walk the LOD and tree save fencing before the first pass of the dozer — a dozer takes minutes to do damage that costs a season to argue about.",
          "Reconcile the geotech report against the grading plan: undercut expectations, moisture conditioning, proof-roll requirements, who calls the density tests.",
          "Agree on the haul routes, stockpile locations (outside easements and LOD), and dust/tracking control.",
          "Establish the differing-site-condition protocol now: who stops, who's photographed and notified, within what notice window.",
        ],
      },
    ],
    relatedLessonIds: ["sc-site-analysis", "tech-sitework", "sc-esc", "wf-rfis"],
    links: [PRACTICE_LINK],
  },

  // ────────────────────────── Compliance You Own ──────────────────────────
  {
    id: "sc-esc",
    track: "sitework",
    category: "Compliance You Own",
    title: "Erosion & Sediment Control / SWPPP",
    summary:
      "The regulatory layer on every dirt job — devices, the SWPPP binder, rain-event inspections, and the fines that follow neglected silt fence.",
    minutes: 6,
    keyTerms: [
      { term: "NPDES permit", definition: "The federal/state stormwater discharge permit construction sites operate under — the legal basis for everything in the SWPPP." },
      { term: "Sediment basin / trap", definition: "A dug pond that slows runoff so sediment settles out before water leaves the site — often later converted to the permanent stormwater pond." },
      { term: "Stabilization", definition: "Covering disturbed soil (seed, mulch, matting) so it can't erode; deadlines run from when an area last saw grading activity." },
    ],
    body: [
      {
        heading: "This one is regulatory, not optional",
        paragraphs: [
          "Erosion and sediment control is the compliance obligation the PM owns daily. Land-disturbance permits and NPDES coverage come with enforceable conditions, inspection regimes, and per-day fines — and unlike most quality issues, the evidence (muddy water leaving your site) flows directly past the neighbors and into public waters. Regulators treat a neglected site as a choice, not an accident.",
        ],
      },
      {
        heading: "The toolkit and the sequence",
        bullets: [
          "Perimeter first: silt fence and the stabilized construction entrance go in before grading starts — the sequence is install → grade → stabilize → convert or remove.",
          "Inlet protection on every downstream inlet; check dams in swales; diversion swales steering clean water around disturbed areas.",
          "Sediment traps and basins sized to the drainage area — keep them cleaned out; a full basin is decoration.",
          "Stabilize as you go: finished slopes get seed and matting on the regulatory clock, not at the end of the job.",
          "Tracking and dust: sweep the street and water the haul roads — mud on the public road is the complaint that triggers the inspection.",
        ],
      },
      {
        heading: "The paperwork is half the compliance",
        paragraphs: [
          "The SWPPP binder lives on site: the plan, the permits, and — critically — the inspection log. Inspections run on a fixed frequency plus after every qualifying rain event, documenting device condition and corrective actions with completion dates. In an enforcement action, the log is the difference between 'a device failed and we fixed it' and 'nobody was watching.' Tie the rain-event inspection to the daily log so a storm automatically triggers the documentation.",
        ],
      },
    ],
    relatedLessonIds: ["wf-daily-logs", "sc-grading", "sc-stormwater"],
    links: [PRACTICE_LINK],
  },

  // ─────────────────────────── Water & Utilities ───────────────────────────
  {
    id: "sc-stormwater",
    track: "sitework",
    category: "Water & Utilities",
    title: "Stormwater Management & Low-Impact Design",
    summary:
      "Why the site has ponds, rain gardens, and underground vaults — detention vs. retention, the LID toolkit, and the construction mistakes that kill infiltration.",
    minutes: 6,
    keyTerms: [
      { term: "Detention vs. retention", definition: "Detention ponds hold runoff briefly and release it slowly; retention ponds hold a permanent pool. Both exist because development sheds more water, faster, than the land did before." },
      { term: "Bioretention / rain garden", definition: "A planted depression with engineered soil that filters and infiltrates runoff — a landscape feature that is actually infrastructure." },
      { term: "Rational Method (Q=CiA)", definition: "The conceptual runoff formula (coefficient × intensity × area) — enough to sanity-check why paving more site means bigger ponds." },
    ],
    body: [
      {
        heading: "Development changes the water",
        paragraphs: [
          "A meadow soaks up rain; a roof and parking lot shed it instantly. Regulations require post-development runoff to leave no faster (and increasingly, no dirtier) than pre-development — that's the entire reason the civil set is full of ponds, vaults, and outlet structures. Peak flow scales with how much surface is impervious (Q = CiA in concept), which is why adding parking during design bloats the pond, and why the pond is not the place to 'find' site area during VE.",
        ],
      },
      {
        heading: "The LID toolkit — landscape that's infrastructure",
        bullets: [
          "Bioswales and grass swales convey and filter; rain gardens/bioretention cells infiltrate through engineered soil mixes with specific media, underdrains, and plantings.",
          "Infiltration trenches, basins, and dry wells push water into the ground — they only work in soils that tested for it.",
          "Permeable/pervious paving infiltrates through the surface itself; it dies if sediment-laden construction runoff clogs it early.",
          "Green roofs and rainwater harvesting shrink what reaches the ground at all.",
          "These BMPs are regulated assets with as-built and inspection requirements — treat their construction details (media depth, underdrain elevations) as seriously as structural work.",
        ],
      },
      {
        heading: "How construction kills these systems",
        paragraphs: [
          "The failure mode is almost always the GC's traffic: infiltration areas compacted by equipment crossing them, bioretention cells used as sediment traps during grading, permeable paving laid before upstream areas were stabilized. Fence off infiltration footprints like tree save areas, keep sediment out until the drainage area is stabilized, and schedule BMP construction late. A failed infiltration test at closeout means excavating and rebuilding the cell — the textbook self-inflicted change order. Converting the construction sediment basin into the permanent pond, when designed that way, has its own checklist: muck out sediment, regrade, install the permanent outlet structure per detail.",
        ],
      },
    ],
    relatedLessonIds: ["sc-esc", "sc-utilities", "sc-landscape"],
  },
  {
    id: "sc-utilities",
    track: "sitework",
    category: "Water & Utilities",
    title: "Site Utilities: Gravity Rules Everything",
    summary:
      "Reading sewer profiles, inverts and slopes, water and fire lines, separation rules, pipe materials, and the 811/franchise-utility long game.",
    minutes: 6,
    keyTerms: [
      { term: "Invert", definition: "The inside-bottom elevation of a pipe at a structure — the number gravity systems live and die by." },
      { term: "Utility separation", definition: "Required clearances between water and sewer (horizontal and at crossings) protecting drinking water — they force much of the utility layout." },
      { term: "811 / utility locates", definition: "The call-before-you-dig marking of existing utilities; for critical crossings you pothole (physically expose) to verify, because marks are approximate." },
    ],
    body: [
      {
        heading: "Gravity systems fix the geometry",
        paragraphs: [
          "Sanitary and storm sewers flow downhill at designed slopes, so their inverts are fixed by math, not preference — which is why they go in first and deepest, and everything else routes around them. A sewer profile sheet shows the run laid out vertically: manhole rims, inverts in and out, slope between structures, and what it crosses. A PM who can read a profile can spot the classic conflicts on paper: a crossing with inches of clearance, a rim elevation that disagrees with the grading plan's spot grade, a run that arrives at the existing main higher than the main's invert.",
        ],
      },
      {
        heading: "Pressure systems and the rules between them",
        bullets: [
          "Domestic water and fire lines are pressurized — routing is flexible, but depth (frost cover), thrust blocking at bends, and backflow prevention at the building are not.",
          "Separation rules keep sewage away from drinking water: typically 10 feet horizontal, with vertical clearance and special pipe/casing requirements where they must cross.",
          "Pipe materials each have a lane — PVC (economical, gravity and low pressure), HDPE (fused joints, trenchless), ductile iron (strength, fire mains), RCP (big storm). Substitutions touch structural and regulatory approvals, not just cost.",
          "Testing before burial: pressure tests on water, air/mandrel tests on sewer, plus the utility authority's own inspections — the trench doesn't close until they pass.",
        ],
      },
      {
        heading: "Existing utilities and the franchise long game",
        paragraphs: [
          "Everything already in the ground is a risk you manage: 811 locates before digging, potholing to verify at every critical crossing, and a hit protocol everyone knows (gas hit = evacuate and call, not inspect). The franchise utilities — power, gas, telecom — run on their own timelines for new services: applications, easements, pad and conduit work you build to their standards, then energization on their calendar. Those lead times are measured in months and don't compress for your schedule; start them at buyout and track them like long-lead equipment.",
        ],
      },
    ],
    relatedLessonIds: ["sc-grading", "tech-mep-coordination", "cn-longlead"],
  },

  // ─────────────────────────── Hardscape & Access ───────────────────────────
  {
    id: "sc-streets-parking",
    track: "sitework",
    category: "Hardscape & Access",
    title: "Streets, Access & Parking",
    summary:
      "The circulation logic behind the civil set — turning radii, sight distance, DOT entrances, parking geometry, and how pavement sections are built.",
    minutes: 5,
    keyTerms: [
      { term: "Turning template", definition: "The swept path of a design vehicle (fire truck, WB-62 semi) overlaid on the layout — the reason drive aisles and cul-de-sacs are the size they are." },
      { term: "Sight distance", definition: "The clear view required at intersections and driveways so drivers can react — it dictates what can be built or planted near corners." },
      { term: "Pavement section", definition: "The layered recipe (subgrade, base course, asphalt or concrete thickness) matched to traffic loads — heavy-duty at truck routes, standard at cars." },
    ],
    body: [
      {
        heading: "The geometry isn't arbitrary",
        paragraphs: [
          "Street widths, curve radii, and intersection layouts trace back to design vehicles and safety math: fire apparatus must reach the building and turn around (driving cul-de-sac and hammerhead dimensions), delivery trucks must make the dock without crossing curbs, and sight-distance triangles at every driveway must stay clear of walls, signs, and mature landscaping. When a proposed field change touches the site layout — moving a dumpster enclosure, adding a fence — check it against truck paths and sight lines before pricing it, because the fire marshal and the DOT check afterward.",
        ],
      },
      {
        heading: "Parking and the DOT entrance",
        bullets: [
          "Parking geometry is standardized: stall widths and depths, aisle widths by angle, and ADA stalls (with access aisles, correct slopes, and the shortest accessible route to the entrance) counted per code.",
          "Parking counts come from zoning minimums negotiated at entitlement — restriping to 'find' spaces isn't a field decision.",
          "The driveway/entrance connecting to a public road runs on a DOT or municipal permit with its own inspections, bonds, and sometimes off-site improvements (turn lanes, signal work) — a separate approval track that can pace the whole project's opening.",
        ],
      },
      {
        heading: "Building the pavement",
        paragraphs: [
          "Pavement fails from below: subgrade prepped and proof-rolled, base course placed and compacted to spec, then flexible (asphalt, in lifts, at temperature) or rigid (concrete with joints per plan) surfacing per the section details — with heavy-duty sections wherever trucks actually track, including the routes your own construction traffic used. Protect the base from rutting before paving, schedule final lift and striping late so construction traffic doesn't destroy it, and remember curb ramps and crosswalk slopes are ADA-inspected features, not flatwork afterthoughts.",
        ],
      },
    ],
    relatedLessonIds: ["sc-pedestrian-ada", "sc-grading", "sc-entitlements"],
  },
  {
    id: "sc-pedestrian-ada",
    track: "sitework",
    category: "Hardscape & Access",
    title: "Pedestrian Design & the Accessible Route",
    summary:
      "Walkways, plazas, and site amenities — and the continuous accessible route that is the single most-failed inspection item in sitework.",
    minutes: 5,
    keyTerms: [
      { term: "Accessible route", definition: "The continuous, compliant path from parking, transit, and the public way to the accessible entrance — every inch of it must comply." },
      { term: "Cross slope", definition: "The slope perpendicular to travel — max 2% on accessible routes, and the tolerance concrete crews miss most often." },
      { term: "CPTED", definition: "Crime prevention through environmental design — sightlines, lighting, and territorial cues that make a site feel and be safer." },
    ],
    body: [
      {
        heading: "The most-failed item in sitework",
        paragraphs: [
          "The accessible route fails in fractions: a walk poured at 2.4% cross slope, a running slope that creeps past 5% (making it legally a ramp needing handrails), a ramp landing an inch short, a threshold a half-inch proud. Any one failure anywhere along the route fails the route. The prevention is measurement culture: form-check slopes before pours with a smart level, verify each placement after stripping, and survey the whole route before final inspection — because the fix is demolition, and it comes at the worst possible time, right before occupancy.",
        ],
      },
      {
        heading: "Walks, plazas, and amenities",
        bullets: [
          "Walkway basics: widths per plan, 2% max cross slope, expansion/control joints per detail; pavers and stone need proper bedding and edge restraint or they wander.",
          "Plazas are roofs over dirt: base prep, drainage, and movement joints determine whether they last — the finishes get the attention, the base determines the outcome.",
          "Playgrounds carry their own standards (CPSC/ASTM): fall zones, safety surfacing depths, and accessibility — installed and inspected by the book because the liability is real.",
          "Site furnishings, bike racks, and bollards have mounting and clearance requirements that interact with the accessible route — a bench in the wrong spot narrows a compliant walk into a violation.",
        ],
      },
      {
        heading: "Lighting and the safety layer",
        paragraphs: [
          "Site lighting balances security levels against light trespass onto neighbors — pole bases, conduit, and fixtures coordinate between sitework, electrical, and the photometric plan. CPTED thinking (clear sightlines, no hiding spots at entries, lighting continuous along pedestrian routes) is embedded in the design; hedges and walls that grow or get value-engineered into visual barriers undo it. Site walls and fences round out the scope — footings, drainage behind retaining site walls, and gate hardware that has to work with access control.",
        ],
      },
    ],
    relatedLessonIds: ["sc-streets-parking", "pf-codes", "sc-landscape"],
  },

  // ───────────────────────────── Green Scope ─────────────────────────────
  {
    id: "sc-landscape",
    track: "sitework",
    category: "Green Scope",
    title: "Landscape & Tree Preservation",
    summary:
      "Reading planting plans, why substitutions aren't swaps, planting depth as the #1 killer, protecting trees from construction, and the establishment period.",
    minutes: 6,
    keyTerms: [
      { term: "Critical root zone", definition: "The protected circle around a tree (roughly 1 foot of radius per inch of trunk diameter) where grading, trenching, and equipment traffic cause slow death." },
      { term: "Caliper", definition: "The trunk diameter spec for nursery trees — the plant schedule's size language, along with container/root-ball sizes." },
      { term: "Establishment period", definition: "The post-installation window (often through final acceptance or a full season) where the landscape contractor waters, maintains, and warranties plant survival." },
    ],
    body: [
      {
        heading: "The planting plan is a spec, not a suggestion",
        paragraphs: [
          "Plant schedules call out species, sizes, quantities, and spacing — chosen for hardiness zone, soil, water, mature size, and often ordinance-required buffers or native-species minimums. That's why substitution requests need designer review: the cheaper tree may grow into the power lines, die in that soil, or be an invasive the local code prohibits. Evaluate substitutions like product submittals — comparative data, not just availability — and watch nursery stock at delivery: undersized caliper and root-bound containers are the landscape version of nonconforming material.",
        ],
      },
      {
        heading: "Why plants die (preventably)",
        bullets: [
          "Planting depth is the #1 killer — root flare buried below grade suffocates a tree slowly, over a warranty-outlasting timeline. Flare visible at finished grade, every tree.",
          "Root ball handling: dropped or cracked balls, girdling straps left on, wire baskets untucked — installation-day sins with year-two symptoms.",
          "Watering-in and the establishment schedule: new plantings need consistent water; make the responsibility explicit between install and acceptance.",
          "Season matters: sod and seed have establishment windows; planting a July lawn or a frozen-ground tree buys a replacement cycle.",
          "Compacted subgrade around buildings grows nothing — soil prep and amendments per spec, especially where construction traffic lived for a year.",
        ],
      },
      {
        heading: "Trees you were supposed to keep",
        paragraphs: [
          "Tree preservation fails silently: fill piled over roots, a trench cut through a root zone, equipment parked in the shade of the tree it's killing — damage now, death in two summers, and a replacement bill (or ordinance fine) priced per caliper inch. Fence critical root zones before mobilization, keep the fencing (no storage, no washout, no parking inside), route trenches around zones or bore under them with root pruning by an arborist. Grade changes matter both directions — fill suffocates roots and cut severs them. The trees survive projects where the fence survives the project.",
        ],
      },
    ],
    relatedLessonIds: ["sc-grading", "sc-sensitive-areas", "wf-punch-closeout"],
  },
  {
    id: "sc-sensitive-areas",
    track: "sitework",
    category: "Green Scope",
    title: "Streams, Wetlands & Sensitive Areas",
    summary:
      "Buffers, jurisdictional wetlands, Section 404 permits, stream stabilization — the site features with federal permits and stop-work power behind them.",
    minutes: 5,
    keyTerms: [
      { term: "Jurisdictional wetland", definition: "A wetland under federal (Corps of Engineers) authority — determined by soils, hydrology, and vegetation, not by whether it looks wet today." },
      { term: "Section 404 permit", definition: "The Clean Water Act permit required to fill or disturb jurisdictional waters/wetlands — with mitigation obligations attached." },
      { term: "Riparian buffer", definition: "The protected vegetated zone along streams — typically no clearing, grading, or storage, marked and defended like the LOD." },
    ],
    body: [
      {
        heading: "Some lines have federal law behind them",
        paragraphs: [
          "Wetland limits and stream buffers on the plans are not landscape preferences — they're jurisdictional boundaries established by delineation and permit. Filling a wetland without (or beyond) a 404 permit, or clearing a required buffer, triggers enforcement that can stop the whole project and impose restoration plus mitigation at multiples of the area damaged. The PM's controls are physical and boring: flag and fence the boundaries before clearing, brief every operator, and keep equipment, spoil, fuel, and concrete washout well away.",
        ],
      },
      {
        heading: "When the work touches the water",
        bullets: [
          "Stream crossings and outfall construction come with permit conditions: work windows (fish spawning seasons), dewatering and pump-around plans, and immediate stabilization.",
          "Stream bank stabilization ranges from vegetative and bioengineered (live stakes, coir) to hard armor (riprap, gabions) — the permit usually prefers the soft end; build what's permitted, not what's fastest.",
          "Constructed wetlands and mitigation plantings are permit deliverables with monitoring periods — their survival is a compliance item, not just landscaping.",
          "Ecology explains the design: preserved corridors and connected green exist on purpose; 'unused' woods are often the mitigation.",
        ],
      },
      {
        heading: "Spills and the PPC plan",
        paragraphs: [
          "Sites near water typically carry a Preparedness, Prevention & Contingency plan covering fuel storage, equipment fueling zones, spill kits, and emergency notification. A hydraulic line bursting near a buffer is manageable with a kit and a trained crew in the first five minutes, and reportable environmental damage after that. Make the spill protocol part of orientation for every operator on a sensitive site — and document drills and kit checks in the daily log.",
        ],
      },
    ],
    relatedLessonIds: ["sc-esc", "sc-landscape", "sc-environmental"],
  },

  // ─────────────────────────── Context & Risk ───────────────────────────
  {
    id: "sc-environmental",
    track: "sitework",
    category: "Context & Risk",
    title: "Environmental Site Assessment & Brownfields",
    summary:
      "Phase I and II ESAs, contamination liability, and the field protocol when the excavator turns up something that smells wrong.",
    minutes: 5,
    keyTerms: [
      { term: "Phase I ESA", definition: "The records-and-walkthrough environmental assessment identifying 'recognized environmental conditions' — done before purchase, no sampling involved." },
      { term: "Phase II ESA", definition: "The follow-up with actual soil/groundwater sampling, triggered when Phase I finds something worth testing." },
      { term: "Institutional controls", definition: "Legal restrictions on a remediated site (no residential use, no groundwater wells, maintain the cap) that survive into construction and operations." },
    ],
    body: [
      {
        heading: "The risk layer under every site",
        paragraphs: [
          "Before the owner bought the parcel, an environmental consultant walked it and mined its records — old aerials, fire-insurance maps, regulatory databases — producing a Phase I ESA. Findings ('recognized environmental conditions': the former gas station, the dry cleaner, undocumented fill) trigger Phase II sampling. This diligence exists because contamination liability under CERCLA attaches to owners and operators broadly, and the legal defenses (innocent landowner, bona fide prospective purchaser) depend on having done the assessment properly. The GC inherits the conclusions: know what the ESAs found and where.",
        ],
      },
      {
        heading: "Building on a brownfield",
        bullets: [
          "Remediation is usually risk-based, not total: contamination capped under buildings and pavement rather than hauled away — which makes your excavation the event that can breach the remedy.",
          "Institutional controls and soil-management plans dictate where you can dig, how spoil is handled and tested, and what goes back in the hole. Read them before earthwork prices are locked.",
          "Contaminated spoil is waste with a manifest, not fill — disposal costs are an order of magnitude above clean haul-off, which is why 'suspect soil' quantities get unit prices in the sitework contract.",
          "Environmental insurance (pollution liability) may sit behind the project; know whose policy responds before you need it.",
        ],
      },
      {
        heading: "The field protocol",
        ordered: [
          "Triggers: staining, odors, sheen on groundwater, buried drums or tanks, unexpected debris fill, or ash — anything that doesn't match the geotech borings.",
          "Stop work in that area and keep equipment from spreading material.",
          "Photograph and document location, depth, and appearance in the daily log.",
          "Notify per the contract and the soil-management plan — owner, environmental consultant, and (for tanks or releases) the regulator on their clock.",
          "Resume only on written direction; the delay and handling become a documented differing-site-condition change.",
        ],
      },
    ],
    relatedLessonIds: ["sc-site-analysis", "sc-sensitive-areas", "wf-change-events"],
  },
  {
    id: "sc-entitlements",
    track: "sitework",
    category: "Context & Risk",
    title: "Land Use, Entitlements & Why the Site Plan Looks Like That",
    summary:
      "Zoning, easements, conditions of approval, and the public gauntlet the owner walked before the GC showed up — the constraints you can't RFI away.",
    minutes: 5,
    keyTerms: [
      { term: "Entitlements", definition: "The bundle of public approvals (rezoning, site plan approval, variances) that lets the project exist in its current form." },
      { term: "Conditions of approval", definition: "Project-specific obligations attached to the entitlement — buffers, road improvements, architectural commitments — enforceable like code." },
      { term: "Conservation easement / TDR", definition: "Land-preservation tools that permanently restrict parts of a site — lines on the survey with legal weight behind them." },
    ],
    body: [
      {
        heading: "The pre-preconstruction layer",
        paragraphs: [
          "Before design, the owner ran the entitlement gauntlet: zoning analysis, site plan review, maybe rezoning or variances, traffic studies, and public hearings where neighbors weighed in. What survived that process is the project — the setbacks, the buffer widths, the parking count, the building height, the tree save areas, sometimes the exterior materials — all of it negotiated and recorded in conditions of approval. This is why some 'obviously better' field ideas are non-starters: moving the dumpster enclosure closer to the property line isn't a detail change, it's a violation of a public commitment.",
        ],
      },
      {
        heading: "What the PM should actually read",
        bullets: [
          "The zoning approval and conditions of approval — a short document that explains half the site plan's oddities and lists obligations (off-site road work, sidewalk connections, buffer plantings) someone must schedule and pay for.",
          "The recorded plat and easements — what's dedicated to the public, what utility easements cross the site, and what can't be built (or stockpiled) where.",
          "Lot-layout logic: commercial sites optimize visibility, access, and pad sites; residential subdivisions trade conventional lots against cluster/conservation layouts — knowing the intent helps you evaluate change requests.",
          "Community sensitivity: projects that survived contested hearings have neighbors watching. Construction hours, truck routes, dust, and lighting complaints go straight to the officials who granted approval.",
        ],
      },
      {
        heading: "When the field wants to change the site",
        paragraphs: [
          "Changes touching anything entitled — grades in a buffer, an extra curb cut, relocated screening — may need administrative or even public re-approval, on government timelines. Route those through the owner and civil engineer early; a change order priced and built ahead of a required approval can become an unbuild order. The safe habit: treat the site plan's perimeter and public-facing commitments as owner-controlled scope, and everything inside the building pad as normal change territory.",
        ],
      },
    ],
    relatedLessonIds: ["sc-site-analysis", "sc-streets-parking", "wf-change-events"],
  },

  // ─────────────────────────── The Design Team ───────────────────────────
  {
    id: "sc-design-pm",
    track: "sitework",
    category: "The Design Team",
    title: "How the Design Side Works (and Why It Answers Slowly)",
    summary:
      "The A/E's project manager, professional liability, design QA, and fee reality — understanding the other side of the table to manage it better.",
    minutes: 5,
    keyTerms: [
      { term: "Professional liability", definition: "The designer's E&O exposure — the reason RFI answers are worded carefully and 'means and methods' stay firmly on the contractor's side of the line." },
      { term: "Standard of care", definition: "The legal bar for design: what a reasonably prudent professional would do — not perfection. Errors and omissions within it aren't automatically compensable." },
      { term: "Basic services", definition: "The scope the designer's fee covers; construction-phase support beyond it (extra site visits, redesigns) is someone's additional service." },
    ],
    body: [
      {
        heading: "The other PM",
        paragraphs: [
          "Across the table sits a design-side project manager juggling the same forces you are: scope creep, a fixed fee burning down, consultants (structural, MEP, civil) who each answer on their own clock, and a QA process that's supposed to catch coordination errors before issue. Understanding their seat changes your tactics — a well-referenced RFI that a consultant can answer in one pass respects their economics; ten vague RFIs that each require a coordination meeting burn their fee and your schedule together.",
        ],
      },
      {
        heading: "Why the answers read like that",
        bullets: [
          "Liability shapes language: designers answer to their standard of care and avoid absorbing means-and-methods risk — 'refer to structural' and 'contractor to verify' are risk allocations, not evasions.",
          "Errors and omissions happen systematically: compressed design schedules, late owner changes, and consultant handoff gaps — the same failure modes every set. Your document review at mobilization is the free QA pass that catches them while they're RFIs instead of change orders.",
          "Design firms get paid by phase, and construction administration is usually the thinnest slice. An unpaid or fee-exhausted designer answers slowly — if response times crater, the cause may be commercial, and the fix runs through the owner, not through angrier emails.",
          "Watch the design-side failure modes that become your problems: a consultant silently swapped mid-project, addenda that never got incorporated into the CD set, specs cloned from the last job with the wrong products left in.",
        ],
      },
      {
        heading: "Managing the relationship",
        paragraphs: [
          "The productive posture is structured empathy: batch questions where possible, propose solutions in RFIs (a yes/no is faster than a design task), keep a response-time log you can raise professionally at OAC before it becomes a claim, and route fee-driven problems to the owner who holds the design contract. The design team you'll need a favor from in month 14 — a fast answer, a flexible detail — is the one you didn't grind down in month 2.",
        ],
      },
    ],
    relatedLessonIds: ["wf-rfis", "cn-lifecycle", "pf-communication"],
  },
];
