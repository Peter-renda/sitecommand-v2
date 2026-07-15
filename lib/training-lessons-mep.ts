/**
 * "MEP Systems" track — the deep-dive expansion of the MEP, fire protection,
 * and low-voltage overviews in Building the Work, built from the MEP Systems
 * topic map (per the MEP Guide for Planning Engineers). Its distinctive
 * angle: every system is taught as **schedule logic** — installation
 * activities with predecessor/successor relationships, first fix vs. second
 * fix, inspection hold points, and man-hour thinking — because that's the
 * lens a GC's PM actually needs. Content is calibrated to US practice
 * (NEC, NFPA 13/72, IECC commissioning, third-party TAB).
 *
 * Client-safe; imports only types from training-lessons (no runtime cycle).
 */

import type { Lesson, LessonLink } from "./training-lessons";

const PRACTICE_LINK: LessonLink = {
  label: "Practice this in your training sandbox",
  href: "/training/practice",
};

export const MEP_LESSONS: Lesson[] = [
  // ───────────────────────────── The Pattern ─────────────────────────────
  {
    id: "mep-activity-pattern",
    track: "mep",
    category: "The Pattern",
    title: "The Universal MEP Activity Pattern",
    summary:
      "Every MEP installation follows the same skeleton — approval, delivery, first fix, second fix, connect, test, commission. Learn it once and every system becomes a variation.",
    minutes: 6,
    keyTerms: [
      { term: "First fix / second fix", definition: "First fix (rough-in) is everything installed before walls and ceilings close; second fix is equipment, fixtures, and trim after finishes. An inspection gate sits between them." },
      { term: "BWIC", definition: "Builder's work in connection — the GC-scope work MEP depends on (openings, sleeves, pads, plinths, shafts) and the classic 'not my scope' gap where delays live." },
      { term: "Predecessor / successor", definition: "The CPM relationship every MEP task lives in — nothing in MEP is standalone; every activity waits on something and releases something." },
    ],
    body: [
      {
        heading: "The chain that never changes",
        ordered: [
          "Material approval — the submittal; nothing legitimate ships without it.",
          "Delivery & storage — received against the approved submittal, staged per the site logistics plan.",
          "First fix (rough-in) — the concealed work: pipe, duct, conduit, boxes, hangers.",
          "Second fix — equipment, fixtures, devices, and trim after finishes.",
          "Connections — power to equipment, controls to devices, the trade-to-trade terminations.",
          "Testing — pressure, insulation resistance, point-to-point: does it hold / is it wired right.",
          "Commissioning — does it perform as designed.",
          "Handover — O&Ms, training, warranties. Sprinklers, plumbing, duct, feeders, fire alarm — different materials, same skeleton. When a sub's schedule looks wrong, check it against this chain: something is usually missing or out of order.",
        ],
      },
      {
        heading: "The GC-owned dependencies",
        bullets: [
          "BWIC is the trap: sleeves and openings before pours, housekeeping pads before equipment, shafts framed (and acoustically lined where required) before risers — GC-scope predecessors that quietly gate MEP trades. Walk the BWIC list at buyout and assign every item.",
          "Storage and protection are schedule activities: fittings preserved, open pipe capped, installed equipment covered. Damaged-in-storage equipment re-enters the procurement queue at the back.",
          "Identification, labeling, and touch-up painting are real closeout activities with real hours — the sub that 'finishes' without them hasn't finished.",
        ],
      },
      {
        heading: "Crew and man-hour thinking",
        paragraphs: [
          "Every activity has a crew composition and a man-hour estimate behind it — a duct crew of four hanging so many pounds per day, a pipefitter pair welding so many joints. The PM doesn't build those estimates, but uses them two ways: in the look-ahead (does the sub's promised date pencil out against the crew actually on site?) and in pay-app review (does 80% billed match the installed quantity a walk would find?). Percent-complete claims are opinions; installed quantities are facts.",
        ],
      },
    ],
    relatedLessonIds: ["tech-mep-coordination", "mep-coordination-scheduling", "wf-submittals"],
    links: [PRACTICE_LINK],
  },

  // ───────────────────────────── Wet Systems ─────────────────────────────
  {
    id: "mep-fire-suppression",
    track: "mep",
    category: "Wet Systems",
    title: "Fire Suppression: Sprinklers, Pumps & Standpipes",
    summary:
      "The sprinkler activity chain, the fire pump room, clean-agent rooms, and the sequencing traps between heads and ceilings.",
    minutes: 6,
    keyTerms: [
      { term: "Wet pipe system", definition: "Sprinkler piping that's always full of water — the default system; dry, pre-action, and deluge exist for freezing areas, water-sensitive rooms, and special hazards." },
      { term: "FDC", definition: "Fire department connection (Siamese) — where the fire department pumps into the system; its location is an AHJ conversation, not a convenience." },
      { term: "Hydrostatic test", definition: "The pressure test of installed sprinkler piping (typically 200 psi for 2 hours per NFPA 13), witnessed and documented before cover." },
    ],
    body: [
      {
        heading: "The activity chain",
        ordered: [
          "Material verification against the approved (PE-stamped, delegated-design) shop drawings.",
          "Mains and branch pipework — hung after above-ceiling coordination is signed off, not before.",
          "Heads, control valves, check valves, OS&Y valves, and specialties set.",
          "Hydrostatic test and flushing — witnessed, documented, and gating the ceiling close-up.",
          "Trim at finishes: escutcheons, cabinet fronts, spare-head cabinet. The chain runs floor by floor, and its test dates belong on the look-ahead as inspection hold points.",
        ],
      },
      {
        heading: "The dense rooms and special systems",
        bullets: [
          "The fire pump room is the coordination-dense space: pump, jockey pump, controller, test header, sensing lines, plus the electrical feed and controller interface — draw it big, coordinate it early, and expect the flow test to be a witnessed event.",
          "Standpipes and hose valves route through stair coordination; cabinet recesses fight with rated wall assemblies — resolve in shop drawings, not in the stairwell.",
          "Clean-agent systems (FM-200 and kin) protect electrical/IT rooms: room integrity testing means the room's penetrations, dampers, and door hardware are part of the suppression scope's success — a three-trade interface in a small room.",
          "Fire water storage tanks (where street supply is inadequate) bring fill/suction connections, anti-vortex plates, and level controls — and a structural/site footprint decided early.",
        ],
      },
      {
        heading: "Sequencing traps",
        paragraphs: [
          "The classic failures are all timing: heads dropped before the ceiling grid alignment is final (every relocated light moves a head), painting after heads are installed (a painted head is a replaced head — they cannot be cleaned), and branch pipe hung before duct coordination is resolved (sprinkler yields to nothing once tested). The RCP battle — heads vs. lights vs. diffusers vs. speakers — is settled in coordination drawings; the field version of that meeting costs a mobilization per trade.",
        ],
      },
    ],
    relatedLessonIds: ["tech-fire", "mep-activity-pattern", "cn-rcp", "mep-security-fire-alarm"],
  },
  {
    id: "mep-plumbing",
    track: "mep",
    category: "Wet Systems",
    title: "Plumbing: Drainage, Water Systems & the Testing Gates",
    summary:
      "Underground rough-in on the critical path, gravity's non-negotiables, water heaters and boosters, and the three testing gates that hold the schedule.",
    minutes: 6,
    keyTerms: [
      { term: "Waste and vent", definition: "Drainage needs air behind the water — the vent system that keeps traps from siphoning; its routing is why plumbing walls are where they are." },
      { term: "Cleanout", definition: "The capped access point for clearing drain lines — code-spaced, and a punch-list magnet when buried behind finishes without access." },
      { term: "Water hammer arrestor", definition: "The small device absorbing pressure shock at quick-closing valves — cheap in rough-in, expensive when banging pipes get diagnosed after drywall." },
    ],
    body: [
      {
        heading: "Underground: the critical-path start",
        paragraphs: [
          "Underground sanitary and storm rough-in sits directly on the critical path — nothing pours until it's in, tested, and inspected. The sequence is exact: layout from gridlines, excavation, bedding, pipe at designed slope, inspection, then a ball test or water test, then backfill. Gravity is the constraint: slopes are fixed by code and invert elevations, so an underground run that's wrong is excavation, not adjustment. Survey the sleeves and stub-ups before the pour; a drain three inches off grid under a slab is a core drill and a story.",
        ],
      },
      {
        heading: "The systems above ground",
        bullets: [
          "Domestic cold, hot, and hot water return (recirculation keeps hot water at the fixture); separate systems for irrigation and, on some projects, grey water — each with its own meter and backflow story.",
          "Pipe materials by service — PVC/cast iron (drainage; cast iron where quiet matters), copper/PEX (domestic), HDPE (site) — and substitution requests are engineering reviews, not price checks: joining methods, supports, and code approval all move with the material.",
          "Water heaters: storage vs. tankless, mixing valves, seismic strapping, pans and drains; booster pumps and pressure zones appear as buildings get tall.",
          "Accessories that prevent callbacks: PRVs at high street pressure, backflow preventers (tested and tagged annually), hammer arrestors at flush valves and quick-closing appliances.",
          "Grease interceptors size from kitchen equipment — an interior interceptor is a structural and odor decision; coordinate with the kitchen consultant before the slab design closes.",
        ],
      },
      {
        heading: "Trim-out and the three gates",
        paragraphs: [
          "Fixtures land at second fix on carriers set during rough-in — and ADA mounting heights and clearances are set by the carrier, which means accessibility compliance is determined behind the wall, months before the inspector's tape measure. The schedule's three plumbing gates: underground test before backfill, rough-in pressure test before cover, and final fixture test at trim. Each is an inspection hold point; a gate skipped is a wall reopened.",
        ],
      },
    ],
    relatedLessonIds: ["mep-activity-pattern", "tech-foundations", "sc-pedestrian-ada", "wf-permits"],
  },

  // ───────────────────────────── HVAC ─────────────────────────────
  {
    id: "mep-hvac-air",
    track: "mep",
    category: "HVAC",
    title: "HVAC Airside: Ductwork, Dampers & Devices",
    summary:
      "Duct from fabrication to field, the damper family at rated walls, terminal units above the ceiling, filters, and kitchen exhaust.",
    minutes: 6,
    keyTerms: [
      { term: "Pressure class / sealing class", definition: "The SMACNA construction standard for a duct run — gauge, joints, and sealant matched to system pressure; leak testing verifies it." },
      { term: "Fire/smoke damper (FSD)", definition: "The damper that closes a duct penetration at a rated assembly — every one needs an access door, and every missed access door is a punch item." },
      { term: "Construction filters", definition: "Sacrificial filters used if permanent equipment must run during construction — never run permanent units on construction dust with final filters." },
    ],
    body: [
      {
        heading: "Duct: a fabrication flow, not a commodity",
        paragraphs: [
          "Ductwork runs shop-to-field: coordinated shop drawings feed the fab shop, fabricated sections arrive in sequence, and hangers/supports go in from the coordination drawings. Gauge and pressure class come from the specs; sealing class and leak tests verify tightness; insulation (external wrap) vs. lining (internal, acoustic) is a spec decision with schedule teeth — lined duct and acoustic lining of builder's-work shafts tie GC scope to mechanical requirements. Duct is usually the first trade drawn in coordination because it's the biggest thing above the ceiling and the hardest to reroute.",
        ],
      },
      {
        heading: "Dampers, devices, and the above-ceiling tenants",
        bullets: [
          "Volume control dampers (VCDs) where TAB will need them — inaccessible VCDs make balancing a demolition exercise.",
          "Fire, smoke, and combination FSDs at rated assemblies: located from the life-safety drawings, each with an access door requirement — the punch-list perennial. Track damper locations against the rated-wall plan; a damper shown at a wall the architectural set doesn't rate is an RFI.",
          "Terminal equipment — VAV boxes, fan coil units — claims above-ceiling real estate with service clearances; a VAV box you can't reach is a maintenance complaint for thirty years.",
          "Diffusers, registers, and grilles land at finish-stage trim on the RCP's geometry — another reason the ceiling coordination sign-off precedes everything airside.",
        ],
      },
      {
        heading: "Kitchens and filters",
        paragraphs: [
          "Kitchen ventilation is its own regime: hoods from the Division 11 kitchen contract, welded grease exhaust duct in rated enclosures, makeup air to replace what the hoods throw away — a three-scope interface (kitchen consultant, mechanical, GC shafts) that fails when nobody owns the boundary. And the filter rule is absolute: if permanent equipment must run for temporary conditioning, it runs on construction filters, swapped for final filters before TAB — running final filters (or no filters) on construction dust contaminates coils, voids warranties, and shows up in TAB as a system that can't make airflow.",
        ],
      },
    ],
    relatedLessonIds: ["mep-hvac-water", "tech-mep-coordination", "cn-rcp", "mep-startup-cx"],
  },
  {
    id: "mep-hvac-water",
    track: "mep",
    category: "HVAC",
    title: "HVAC Equipment & Hydronics: AHUs, Chillers & Condensate",
    summary:
      "Hydronic piping systems, the AHU crane day, the chiller as long-lead flagship, generators as a four-trade convergence, and the tiny pipe that floods ceilings.",
    minutes: 6,
    keyTerms: [
      { term: "Hydronics", definition: "The water side of HVAC — chilled water, heating hot water, condenser water — with pumps, expansion tanks, and air separators keeping it moving and full." },
      { term: "Housekeeping pad", definition: "The concrete pad under equipment — GC scope, sized and located from equipment submittals, and needed before the equipment that sits on it." },
      { term: "Condensate trap", definition: "The drain seal at cooling equipment; sloped wrong or trapped wrong, the humble condensate line becomes the building's most reliable source of ceiling stains." },
    ],
    body: [
      {
        heading: "The water side",
        paragraphs: [
          "Chilled water, heating hot water, and condenser water loops share an anatomy: pumps, piping with expansion compensation, insulation, air separation, and chemical treatment after flushing. Piping is welded or grooved, tested before insulation (an insulated leak is a hidden leak), and flushed clean before any water touches equipment — construction debris in a chiller's tubes is a warranty fight you lose. Condensate deserves respect beyond its size: gravity slope, correct trapping at the unit, and a route to an approved drain; the guide's warning is earned — no small pipe causes more disproportionate damage.",
        ],
      },
      {
        heading: "Equipment days are schedule events",
        bullets: [
          "AHU setting is often a crane day and a milestone: rigging path planned, housekeeping pad cured, and the convergence sequenced — power, controls, piping, and duct connections all landing on one machine from four trades.",
          "Chillers are the long-lead flagship: procurement released at buyout, rigging path (and sometimes a wall left open) planned from the submittal, refrigerant handling per EPA rules, factory witness testing on bigger machines.",
          "Generators are the same convergence with more trades: fuel storage and day tank (with its own permits), fuel piping, exhaust routing, structural pad, electrical interconnection, and fire coordination — mechanical, electrical, structural, and fire in one corner of the site.",
          "Under-floor and radiant systems, where they appear, are embedded in structure — zero tolerance for late changes; their layout freezes when the pour does.",
        ],
      },
      {
        heading: "What the PM tracks",
        paragraphs: [
          "Equipment scope is procurement scope: release dates walked backward from need-by dates, submittals expedited like the schedule depends on them (it does), pads and openings (BWIC) ready before delivery, and the multi-trade connection window coordinated so the machine doesn't sit dead for a month awaiting one trade. The equipment schedule on the drawings is effectively a procurement log waiting to be transcribed.",
        ],
      },
    ],
    relatedLessonIds: ["mep-hvac-air", "cn-longlead", "mep-electrical-distribution", "mep-startup-cx"],
  },
  {
    id: "mep-bms",
    track: "mep",
    category: "HVAC",
    title: "Building Automation: Controls, Points Lists & the End-of-Job Squeeze",
    summary:
      "What a BMS actually is, why the points list belongs in submittal review, the integration refereeing the GC owns, and protecting controls duration from compression.",
    minutes: 5,
    keyTerms: [
      { term: "DDC controller", definition: "The direct digital control panel — the field brain wiring sensors and actuators to the network; its panel locations and power come from coordination, not improvisation." },
      { term: "Points list", definition: "The schedule of every monitored and controlled point — effectively the BMS scope document; review it like a scope exhibit, because it is one." },
      { term: "Point-to-point checkout", definition: "Verifying every sensor and command wire end-to-end before functional testing — the tedious step that, skipped, turns commissioning into debugging." },
    ],
    body: [
      {
        heading: "Anatomy and the scope document",
        paragraphs: [
          "A BMS is sensors feeding controllers (DDC panels), networked to a head-end workstation with graphics — monitoring and controlling HVAC, and often lighting, metering, and alarm interfaces. The points list is where the scope actually lives: what's monitored versus controlled, on which equipment, with what alarm behavior. Review it during submittals against the sequences of operations — a point missing from the list is a function missing from the building, discovered at commissioning when adding it costs conduit, wire, and a mobilization.",
        ],
      },
      {
        heading: "The installation chain and the integration problem",
        bullets: [
          "Sequence: conduit and cable rough-in (riding electrical's pathways) → controller panels → device installation → point-to-point checkout → graphics → functional testing.",
          "BMS touches every mechanical system plus electrical, metering, and life safety — which makes the GC's PM the referee of sub-to-sub interfaces: who provides the valve, who wires the actuator, whose scope is the starter interlock, line side vs. load side.",
          "The fire-alarm boundary is the sharpest: HVAC shutdown and smoke control are commanded by fire alarm, executed through controls — get the interface matrix agreed in writing before either sub wires it.",
        ],
      },
      {
        heading: "Why controls get squeezed — and how to protect them",
        paragraphs: [
          "Controls finish last by nature: they need installed equipment, permanent power, and completed wiring before checkout can even start — so every upstream slip compresses the controls window while the CO date holds still. Compressed controls means skipped point-to-point, which means functional tests that fail for wiring reasons, which means commissioning burns days debugging instead of verifying. Protect the duration explicitly: track controls prerequisites (power, equipment startup, network) as schedule milestones, and treat a two-week slip in switchgear energization as a two-week threat to the CO — because through the controls chain, it is.",
        ],
      },
    ],
    relatedLessonIds: ["mep-startup-cx", "mep-electrical-distribution", "tech-testing-cx", "mep-security-fire-alarm"],
  },

  // ───────────────────────────── Power & Signal ─────────────────────────────
  {
    id: "mep-electrical-distribution",
    track: "mep",
    category: "Power & Signal",
    title: "Electrical Distribution: From Utility to Branch Circuit",
    summary:
      "Tracing the single-line, the switchgear crisis, cable and terminations, working clearances, and the temporary-to-permanent power gate everything waits on.",
    minutes: 7,
    keyTerms: [
      { term: "Single-line diagram", definition: "The one-page map of the power system: service → transformer → switchgear → panels → branch circuits. The PM's navigation chart for all things electrical." },
      { term: "NEC 110.26", definition: "The working-clearance rule in front of electrical equipment — the reason electrical rooms are the size they are, and the field change that's never allowed." },
      { term: "Megger test", definition: "Insulation resistance testing of installed feeders before energization — the proof the cable survived the pull." },
    ],
    body: [
      {
        heading: "Trace the single-line",
        paragraphs: [
          "Power arrives from the utility, steps down through a transformer (pad-mounted outside or a unit substation inside), lands in the main switchgear or switchboard, distributes through feeders to panelboards, and fans out as branch circuits. The single-line diagram shows that whole tree on a page — learn to trace it, because every electrical question (what does this panel feed, what dies when this breaker opens, where does emergency power pick up) is answered there. Medium-voltage distribution appears on campuses and large sites; where it does, nail down the utility-vs-contractor demarcation early, because it moves real scope.",
        ],
      },
      {
        heading: "The two dependencies that run the job",
        bullets: [
          "Switchgear is the long-lead crisis item: released at buyout, factory acceptance tested, and delivered to a room that must be ready — walls, pad, security, and dry conditions. An unapproved switchgear submittal aging in the log while the electrical-room milestone approaches is the classic self-inflicted delay; expedite it like the schedule depends on it.",
          "The utility is the longest external dependency: transformer pads and primary conduit built to their standards, easements executed, meter sets scheduled — all on the utility's calendar, which doesn't negotiate. Start the service application months early and document every commitment.",
          "Downstream of both: cable tray and conduit rough-in, feeder pulls and terminations, megger tests, panel trim with typed circuit directories, ATS units tying the generator in, and the electrical-to-mechanical interface — who provides starters, disconnects, and VFDs, line side vs. load side, settled at buyout not at startup.",
        ],
      },
      {
        heading: "Energization: the gate of gates",
        paragraphs: [
          "The temporary-to-permanent power transition is the schedule's master gate: elevators start, HVAC equipment starts, and controls checkout begins only on permanent power. Work backward from the CO through that chain and the energization date becomes the most consequential date on the project — protected by switchgear delivery, room readiness, utility scheduling, and the pre-energization testing regime (insulation resistance, breaker coordination study, arc-flash labels, third-party acceptance testing where specified). Lighting packages deserve their own line in the procurement log; they slip constantly and finish rooms can't close without them. Grounding and bonding, unglamorous as they are, get inspected — the grounding electrode system goes in with the foundations, months before anyone thinks about electricity.",
        ],
      },
    ],
    relatedLessonIds: ["cn-longlead", "mep-hvac-water", "mep-bms", "tech-vertical-lv"],
    links: [PRACTICE_LINK],
  },
  {
    id: "mep-low-voltage",
    track: "mep",
    category: "Power & Signal",
    title: "Low Voltage & Communications: Pathways, Rooms & Providers",
    summary:
      "Structured cabling from backbone to horizontal, the telecom-room readiness chain, AV and blocking, DAS/ERRC, and the carrier timeline you don't control.",
    minutes: 5,
    keyTerms: [
      { term: "Backbone vs. horizontal", definition: "Backbone cabling (usually fiber) links MDF to IDFs between floors; horizontal (copper) runs from the IDF to each outlet — different pathways, different schedules." },
      { term: "Pathway rough-in", definition: "The conduit, tray, sleeves, and firestopped penetrations installed early with the other trades — even though cable pulls come much later." },
      { term: "Room readiness", definition: "The dependency chain (permanent power, cooling, security, dust-free finishes) a telecom room must complete before equipment racks can land." },
    ],
    body: [
      {
        heading: "Pathways early, cable late",
        paragraphs: [
          "Low voltage splits into two schedules: pathways (tray, conduit, sleeves, firestopping at every penetration) go in during rough-in with everyone else, while cable pulls, terminations, and testing come near the end, once dust settles. The trap is treating the whole scope as 'late work' — miss the pathway window and the low-voltage sub is core-drilling rated floors in a finished building, with a firestop inspector following them around. Sleeves are cheap in rough-in and expensive forever after.",
        ],
      },
      {
        heading: "Rooms, racks, and interfaces",
        bullets: [
          "MDF/IDF rooms follow the readiness chain: permanent power, cooling, security, and clean finishes before racks, patch panels, and electronics land — the same room-readiness logic as switchgear, at smaller scale.",
          "AV systems interface with architecture: backing and blocking in walls for displays, power and data rough-in at exact mounting locations, conduit for future pulls — all decided from AV drawings before drywall.",
          "Owner-furnished technology (OFCI) is normal here: the GC provides pathways, power, and blocking to an owner vendor's drawings; the gaps between those scopes are the PM's to hunt at buyout.",
          "Access control and cameras ride the same pathways and land on the door-hardware interface (covered in the fire alarm & security lesson).",
        ],
      },
      {
        heading: "DAS/ERRC and the carriers",
        paragraphs: [
          "Emergency responder radio coverage is code-driven, testable only in the finished building, and never in anyone's base contract — the classic late surprise. Pre-test at dry-in, carry it as a known risk, and if a distributed antenna system is needed, treat it as an owner-directed change with a real schedule impact (covered in depth in the elevators & low voltage overview). Meanwhile, the service providers — internet, phone, cable — run on carrier timelines that answer to no construction schedule: engage them at buyout on service entrances, conduits, and demarcation points, and hold their commitments in writing, because 'the carrier hasn't shown up' is not an excuse an owner accepts for a building that can't open.",
        ],
      },
    ],
    relatedLessonIds: ["tech-vertical-lv", "mep-electrical-distribution", "tech-fire"],
  },
  {
    id: "mep-security-fire-alarm",
    track: "mep",
    category: "Power & Signal",
    title: "Fire Alarm & Security: The Interfaces That Gate the CO",
    summary:
      "The door hardware triangle, the fire alarm command matrix, and the 100% acceptance test that controls occupancy more than any other single event.",
    minutes: 6,
    keyTerms: [
      { term: "Door hardware triangle", definition: "Division 8 hardware + Division 26 power + Division 28 controls on the same opening — the most fragmented scope interface in the building." },
      { term: "Sequence of operations matrix", definition: "The table defining what every alarm input commands (dampers, doors, elevators, HVAC, access control) — the script the acceptance test runs against." },
      { term: "Acceptance test", definition: "The AHJ/fire marshal's witnessed, 100%-of-devices functional test of the fire alarm system — the hardest single gate before the Certificate of Occupancy." },
    ],
    body: [
      {
        heading: "The door hardware triangle",
        paragraphs: [
          "An access-controlled door involves three scopes: the physical hardware (Division 8 — locks, closers, exit devices), the power (Division 26 — transformers, power supplies, wire to the strike), and the controls (Division 28 — card reader, controller, release logic), plus the fire alarm's right to override everything for egress. No single sub owns the opening, which is why it's the most fragmented interface in the building. The fix is procedural: a hardware/access-control coordination meeting early (alongside the keying meeting), a door-by-door responsibility matrix, and one party named to own each opening's completion — otherwise every problem door becomes a three-way finger-point at punch.",
        ],
      },
      {
        heading: "Fire alarm: the system that commands other systems",
        bullets: [
          "Anatomy: initiating devices (smoke/heat detectors, pull stations), notification appliances (horns/strobes per NFPA 72 coverage), the control panel with its loop architecture, and central-station monitoring.",
          "The interfaces are the hard part: damper closure, magnetic door holders, elevator recall, HVAC shutdown, access-control release — a command matrix touching four other trades' equipment.",
          "Get the sequence-of-operations matrix agreed and signed off during submittals; it's both the wiring scope and the test script.",
          "Surveillance and intrusion systems ride alongside on shared pathways — coordinate camera locations with lighting and finishes before ceilings close.",
        ],
      },
      {
        heading: "The test that controls the CO",
        paragraphs: [
          "The fire alarm acceptance test is a 100% test: every device activated, every notification verified, every interface proven against the matrix, with the fire marshal watching. It gates the CO more than any other single event — and it sits at the end of a dependency chain (permanent power, completed devices, finished interfaces with elevators and HVAC), so it inherits every upstream slip. Run a full pre-test with the sub before calling the AHJ: a failed witnessed test costs a reschedule on the fire marshal's calendar, not yours, and the second appointment is never sooner than you need it.",
        ],
      },
    ],
    relatedLessonIds: ["tech-fire", "mep-bms", "tech-finishes", "wf-permits"],
  },

  // ─────────────────────── Running the MEP Job ───────────────────────
  {
    id: "mep-coordination-scheduling",
    track: "mep",
    category: "Running the MEP Job",
    title: "Building the MEP Schedule: Zones, Leapfrogging & Hold Points",
    summary:
      "Translating activity chains into CPM logic — floor-by-floor trade stacking, the accordion effect, riser and equipment-room coordination, and man-hour-based pay-app review.",
    minutes: 7,
    keyTerms: [
      { term: "Trade stacking rhythm", definition: "The repeating floor cycle: frame → MEP rough-in → inspect → cover → finish → trim, with each trade leapfrogging to the next zone." },
      { term: "Accordion effect", definition: "What happens when one trade falls behind in the leapfrog: every following trade compresses, stacks, and loses productivity in the same zones." },
      { term: "Inspection hold point", definition: "A cover-up inspection (underground, in-wall, above-ceiling) mapped into the schedule as a gate — work stops until it's passed and logged." },
    ],
    body: [
      {
        heading: "From activity chains to a schedule",
        paragraphs: [
          "The MEP schedule is the universal activity pattern multiplied by geography: each system's chain (rough-in → test → cover → trim) runs zone by zone and floor by floor, tied to the structure and framing ahead of it and the finishes behind it. Build it as the trade-stacking rhythm — frame, MEP rough, inspect, cover, finish, trim — with trades leapfrogging floors in sequence. The look-ahead then becomes a zone-status board: which floor is each trade on, what's blocking the next inspection, and does the crew on site match the man-hours the dates require.",
        ],
      },
      {
        heading: "Where MEP schedules break",
        bullets: [
          "The accordion effect: one trade slips a zone and every follower stacks up behind it — productivity collapses exactly when the schedule needs it most. Watch the leapfrog spacing, not just the end dates.",
          "Coordination sign-off precedes installation: duct draws first (biggest, least flexible), others fit around it, everyone signs, and field deviations route back through the coordinator — an uncoordinated 'head start' is rework with extra steps.",
          "Risers and shafts are vertical real estate: allocated once, firestopped at every floor, and dependent on GC-built shaft walls (BWIC again) — a shaft framed late stalls every riser trade at once.",
          "Equipment rooms are the densest square footage on the job — drawn at larger scale for a reason; coordinate them first, not last, and expect the fire pump room, mechanical room, and main electrical room to consume disproportionate management attention.",
          "Every cover-up inspection is a mapped hold point: underground before backfill, in-wall before drywall, above-ceiling before grid tiles. Closing a ceiling ahead of a logged inspection converts a checkpoint into demolition.",
        ],
      },
      {
        heading: "Man-hours as a lie detector",
        paragraphs: [
          "The planning-engineer discipline pays off at the pay app: percent-complete claims are checked against installed quantities, not narrative. If the mechanical sub bills 80% on ductwork and a floor walk supports 55% of the pounds hung, the pencil draw gets adjusted against the commitment SOV — politely, with the walk notes attached. The same math runs forward: quantities remaining ÷ realistic crew production = duration remaining, which is the honest answer to 'can they still make the date?' regardless of what the sub's bar chart says.",
        ],
      },
    ],
    relatedLessonIds: ["mep-activity-pattern", "wf-scheduling", "tech-mep-coordination", "wf-sov-payapp"],
    links: [PRACTICE_LINK],
  },
  {
    id: "mep-startup-cx",
    track: "mep",
    category: "Running the MEP Job",
    title: "Startup, Testing & Commissioning: The Dependency Web",
    summary:
      "Testing vs. startup vs. commissioning, the chain from permanent power to CO, flushing and chemical treatment, and the warranty clocks that start when equipment runs early.",
    minutes: 6,
    keyTerms: [
      { term: "Testing vs. startup vs. commissioning", definition: "Testing: does it hold pressure / is it wired right. Startup: does it run. Commissioning: does it perform as designed. Three different questions, in that order." },
      { term: "Pre-functional checklist", definition: "The installation-complete verification (per device/equipment) that must pass before a functional performance test is even attempted." },
      { term: "Beneficial use", definition: "Running permanent equipment for the project's benefit (temporary conditioning) before turnover — which can start warranty clocks early unless negotiated." },
    ],
    body: [
      {
        heading: "The dependency web, drawn backward from the CO",
        ordered: [
          "Permanent power energized — the master gate.",
          "Controls checkout — point-to-point on live power.",
          "Equipment startup — manufacturer or qualified-sub startup, documented per unit.",
          "TAB — air and water balanced against design (complete systems, clean final filters, working controls, or it stalls).",
          "Functional performance testing — the CxA's scripted tests, including failure modes.",
          "Fire alarm acceptance test — the AHJ's 100% witnessed event, needing the finished interfaces.",
          "CO. Each step needs the one before it; every upstream slip lands here, at the end, where there's no float left. Map this chain as real schedule logic, not a closeout checklist.",
        ],
      },
      {
        heading: "The wet-side rituals",
        bullets: [
          "Hydronic systems are flushed before equipment sees water, then chemically treated — skipping the flush puts construction debris in chiller tubes and coil passages, and the water-treatment report is a turnover document.",
          "Startup is per-unit paperwork: manufacturer checklists, factory startup where warranties require it, and startup reports collected as they happen (they're unobtainable a year later).",
          "Seasonal testing outlives substantial completion by design — cooling tested in summer, heating in winter — with deferred-test obligations documented so they don't evaporate at turnover.",
          "Owner training and O&M turnover for MEP are scheduled events with attendance sheets: systems this complex handed over without training generate warranty calls that are really operations questions.",
        ],
      },
      {
        heading: "The beneficial-use warranty trap",
        paragraphs: [
          "Running permanent HVAC for temporary conditioning (drying the building, protecting finishes) is often unavoidable — but it can start warranty clocks at first operation instead of at substantial completion, burn filter and maintenance obligations, and hand the owner used equipment on day one. Negotiate it deliberately: manufacturer's position on warranty start, construction filters and documented maintenance during temporary use, and a written owner agreement on when the warranty clock starts. The alternative is discovering at month eleven that the chiller's warranty expired at month ten.",
        ],
      },
    ],
    relatedLessonIds: ["tech-testing-cx", "mep-bms", "mep-electrical-distribution", "wf-punch-closeout"],
  },
];
