/**
 * "Building the Work" track — means, methods, materials, and sequence,
 * organized in build order (sitework → foundations → structure → envelope →
 * MEP → interiors → commissioning). Authored from Track 2 (Construction
 * Technical Topics) of the PM learning curriculum. The Site & Civil track
 * (training-lessons-sitework.ts) is the deep-dive expansion of the first
 * lesson here.
 *
 * Client-safe; imports only types from training-lessons (no runtime cycle).
 */

import type { Lesson } from "./training-lessons";

export const TECHNICAL_LESSONS: Lesson[] = [
  // ───────────────────────────── Sitework ─────────────────────────────
  {
    id: "tech-sitework",
    track: "technical",
    category: "Sitework",
    title: "Sitework & Earthwork: From Survey to Building Pad",
    summary:
      "Layout and control, cut/fill, compaction and proctors, erosion control, and site utilities — the scope where the biggest early dollars move.",
    minutes: 6,
    keyTerms: [
      { term: "Proctor test", definition: "The lab test establishing a soil's maximum density; field compaction is measured as a percentage of it (e.g. 95% standard proctor)." },
      { term: "Cut and fill", definition: "Excavating high areas (cut) and building up low areas (fill) to reach design grades; the balance determines whether trucks import or export dirt." },
      { term: "SWPPP", definition: "Stormwater Pollution Prevention Plan — the regulatory erosion-control plan the site must follow from first disturbance to final stabilization." },
    ],
    body: [
      {
        heading: "Control comes first",
        paragraphs: [
          "Everything on site is measured from survey control: benchmarks for elevation and control points/gridlines for position. The surveyor sets them; everyone protects them. Modern layout runs on robotic total stations and GPS rovers, but the principle is unchanged — if control is wrong or disturbed, everything built from it is wrong, and the error is discovered by the trade that fits worst.",
        ],
      },
      {
        heading: "Moving the dirt",
        bullets: [
          "Civil drawings show existing grades vs. proposed grades — the difference, over the whole site, is the cut/fill quantity, and hauling dirt on or off site is priced by the truckload.",
          "The geotechnical report is the ground truth: soil types, bearing capacity, groundwater, and what must be undercut or moisture-conditioned. Read it before the sitework sub does something the report warned about.",
          "Compaction is verified, not assumed — density tests against the proctor, lift by lift. A failed lift buried under three more lifts is very expensive to find again.",
          "Unsuitable soils (organics, wet clay, old fill) found during grading are the classic differing site condition: stop, document, notify, and price it as a change — don't quietly haul and hope.",
        ],
      },
      {
        heading: "Utilities and the wet side",
        paragraphs: [
          "Site utilities — storm, sanitary, water, and the dry utilities (power, gas, telecom) — go in by depth: deepest first, usually sanitary and storm since they're gravity systems with fixed slopes. Bedding, pipe material, and compaction of the trench backfill are all spec'd and inspected; pressure/mandrel/air testing happens before anything is covered. Meanwhile erosion control (silt fence, inlet protection, stabilized construction entrance) is a daily compliance obligation with fines behind it, not a one-time install.",
        ],
      },
    ],
    relatedLessonIds: ["sc-grading", "sc-esc", "sc-utilities", "tech-foundations"],
  },

  // ─────────────────────── Foundations & Concrete ───────────────────────
  {
    id: "tech-foundations",
    track: "technical",
    category: "Foundations & Concrete",
    title: "Foundations & Below-Grade Work",
    summary:
      "Shallow vs. deep foundations, slab-on-grade done right, waterproofing vs. dampproofing, and the underslab rough-in sequence.",
    minutes: 5,
    keyTerms: [
      { term: "Spread footing", definition: "A widened concrete pad that spreads a column or wall load over enough soil area to stay within bearing capacity." },
      { term: "Drilled pier / caisson", definition: "A deep foundation: a drilled shaft filled with concrete, carrying load down to competent soil or rock when surface soils can't." },
      { term: "Vapor barrier", definition: "The plastic sheet under a slab-on-grade blocking ground moisture — punctures and bad laps show up later as flooring failures." },
    ],
    body: [
      {
        heading: "Shallow or deep",
        paragraphs: [
          "If competent soil is near the surface, the building sits on shallow foundations: spread footings under columns, continuous footings under walls, grade beams spanning between. If it isn't — soft soils, high loads — loads go down on deep foundations: driven piles, drilled piers, auger-cast or helical piles. The geotech report and structural drawings make the call; the PM's job is knowing which system they're buying, because deep foundations carry mobilization costs, specialty subs, and inspection regimes that shallow ones don't.",
        ],
      },
      {
        heading: "The slab-on-grade checklist",
        bullets: [
          "Sub-base prepped and proof-rolled — the slab is only as good as what's under it.",
          "Vapor barrier intact, taped at laps and penetrations.",
          "Underslab plumbing and electrical roughed in, tested, inspected, and surveyed before the pour — coring a green slab to move a drain is a bad week.",
          "Control joints cut at the spacing and timing the spec demands; concrete will crack, and joints decide where.",
          "Curing actually performed — moist cure or curing compound. Skipped curing surfaces as dusting, curling, and flooring adhesion failures months later.",
        ],
      },
      {
        heading: "Keeping water out, holding dirt back",
        paragraphs: [
          "Below-grade walls get waterproofing (a continuous membrane that resists hydrostatic pressure) or dampproofing (a coating that only resists moisture vapor) — the drawings say which, and the difference matters wherever groundwater exists. Foundation drainage (drain board, perforated pipe to daylight or a sump) is part of the same system. Backfill against walls waits until the structure can take the load — walls have been pushed in by a loader in a hurry — and gets compacted in lifts just like everywhere else.",
        ],
      },
    ],
    relatedLessonIds: ["tech-sitework", "tech-concrete", "sc-grading"],
  },
  {
    id: "tech-concrete",
    track: "technical",
    category: "Foundations & Concrete",
    title: "Concrete: Mix, Place, Cure, Test",
    summary:
      "Mix design basics, rebar, formwork responsibility, placement and curing, the testing regime — and why you never drill a PT slab.",
    minutes: 6,
    keyTerms: [
      { term: "Water-cement ratio", definition: "The main driver of concrete strength — more water is easier to place but weaker. Field-added water is how good mixes fail." },
      { term: "Lap splice", definition: "The overlap where two rebar pieces transfer load; lengths come from the structural drawings, not the ironworker's judgment." },
      { term: "Post-tensioned (PT) slab", definition: "A slab strengthened by stressed steel tendons — thin and efficient, and lethal to drill or core blindly." },
    ],
    body: [
      {
        heading: "The mix and the steel",
        bullets: [
          "Mix designs are submittals: strength (PSI), water-cement ratio, admixtures (air entrainment for freeze-thaw, retarders/accelerators for weather). Approved mix designs matched to each placement location.",
          "Rebar comes with placement drawings from the detailer — sizes, spacing, laps, and clearances held by chairs. The inspection before the pour verifies steel matches the drawings; after the pour it's archaeology.",
          "Formwork and shoring design is the contractor's engineering responsibility (a fact many PMs learn late). Stripping and reshoring times come from strength results, not the calendar.",
        ],
      },
      {
        heading: "Pour day",
        paragraphs: [
          "Placement is logistics: pump or crane-and-bucket, truck spacing so the pour never outruns finishing or stalls into cold joints, consolidation by vibration, and a weather plan — hot weather steals workability, cold weather needs protection to keep the concrete from freezing before it gains strength. Testing rides along: slump for consistency, cylinders cast for 7- and 28-day breaks, air content where entrainment is spec'd. A pour that starts badly rarely improves; the go/no-go the night before is a real decision.",
        ],
      },
      {
        heading: "After the pour, and the PT warning",
        bullets: [
          "Curing is where strength is won or lost — days of moisture control, not hours.",
          "Track breaks to closure: a low 7-day break is a heads-up; a low 28-day break on structure is an engineering conversation (cores, capacity review).",
          "Floor flatness/levelness (FF/FL) specs govern where flooring or racking is sensitive — measured, not eyeballed.",
          "Post-tensioned slabs: tendons are stressed to enormous loads. Nobody drills, cores, or shoots anchors into a PT slab without locating tendons (x-ray/GPR) and following the layout drawings. Cut a live tendon and it can exit the slab edge like a spear — this is the one concrete rule every PM memorizes.",
        ],
      },
    ],
    relatedLessonIds: ["tech-foundations", "tech-steel", "tech-testing-cx", "wf-quality"],
  },

  // ───────────────────────────── Structure ─────────────────────────────
  {
    id: "tech-steel",
    track: "technical",
    category: "Structure",
    title: "Structural Steel & Metals",
    summary:
      "The fab-to-erection pipeline, why steel submittals lead the schedule, connections, decking, fireproofing, and the misc-metals coordination trap.",
    minutes: 5,
    keyTerms: [
      { term: "Steel detailing", definition: "Converting design drawings into piece-by-piece shop/erection drawings — the long, iterative submittal that gates fabrication." },
      { term: "Moment connection", definition: "A rigid connection transferring bending forces, not just vertical load — more welding, more inspection, more cost than a simple shear tab." },
      { term: "SFRM", definition: "Spray-applied fire-resistive material — the fluffy fireproofing on steel that everyone's hangers and sleeves must not knock off." },
    ],
    body: [
      {
        heading: "Why steel leads the schedule",
        paragraphs: [
          "Steel's sequence — detailing, review, fabrication, delivery, erection — starts months before iron arrives, which is why the steel submittal is typically the first big package released. Detailing surfaces every dimensional question in the structure, so steel shop drawings generate RFIs in bunches; slow answers here push fabrication, and fabrication slots lost at the mill don't come back. A PM tracking one submittal chain hardest should usually pick this one.",
        ],
      },
      {
        heading: "In the field",
        bullets: [
          "Erection order: columns and beams, plumb-up and alignment, then final bolting/welding, then metal deck and shear studs so the slab can follow.",
          "Connections are bolted (inspected for tension by method — turn-of-nut, TC bolts) or welded (visual plus NDT like UT on full-pen welds); special inspections cover both.",
          "Anchor bolts are set by the concrete contractor from steel's drawings — the classic interface error. Survey them before the columns ship.",
          "Joists and girders on long spans have their own supplier engineering and bridging requirements — bridging installed before anyone walks the joists.",
        ],
      },
      {
        heading: "The two traps",
        paragraphs: [
          "Miscellaneous metals — stairs, railings, embeds, loose lintels — is the coordination trap: small dollars, many interfaces, and embeds that must be cast into concrete long before the metal they support arrives. Buy misc metals early and mine the embed drawings. Fireproofing is the other: SFRM thickness by assembly rating, verified by inspection, and destroyed daily by trades hanging pipe and duct. Patch requirements are real; an inspector scraping bare steel above a finished ceiling reopens everything below it.",
        ],
      },
    ],
    relatedLessonIds: ["wf-submittals", "cn-longlead", "tech-concrete", "tech-fire"],
  },
  {
    id: "tech-framing",
    track: "technical",
    category: "Structure",
    title: "Masonry, Wood & Light-Gauge Framing",
    summary:
      "CMU and brick veneer fundamentals, wood and engineered lumber, light-gauge framing, and the fire-rated assemblies that govern them all.",
    minutes: 6,
    keyTerms: [
      { term: "Bond beam", definition: "A grouted, reinforced course in a CMU wall that ties it together horizontally — part of the wall's structure, not decoration." },
      { term: "UL assembly", definition: "A tested, listed wall/floor build-up that achieves a fire rating only when built exactly as listed — every layer, fastener, and detail." },
      { term: "Podium construction", definition: "Wood-framed stories (Type III/V) built over a concrete deck (Type I) — common in multifamily, with strict fire separation at the podium." },
    ],
    body: [
      {
        heading: "Masonry essentials",
        bullets: [
          "CMU walls are a system: block, reinforcing in grouted cells, bond beams, and lintels over openings — grout lifts and cleanouts are inspected, and cold-weather masonry has real temperature rules.",
          "Brick veneer is a drainage system pretending to be a wall: ties to the backup, a clean cavity, flashing with end dams at every interruption, and weeps that actually drain. Mortar bridging the cavity is the classic hidden defect.",
          "Expansion/control joints in masonry are not optional aesthetics — brick grows and CMU shrinks, and missing joints become cracks.",
        ],
      },
      {
        heading: "Wood and engineered lumber",
        bullets: [
          "Platform framing with the lateral system riding on shear walls, hold-downs, and specific nailing — the details inspectors check nail-by-nail.",
          "Engineered lumber (LVLs, I-joists, glulams, trusses) comes with supplier engineering; field-cutting or drilling it outside the allowed zones voids the member, not just the warranty.",
          "Fire-treated lumber where code requires it (parapets, blocking in rated walls) — regular lumber installed there is a tear-out.",
          "Multifamily specifics: draft stopping, fire blocking, party wall continuity — the assemblies that stop a unit fire from becoming a building fire, hidden behind drywall and only cheap to fix before it hangs.",
        ],
      },
      {
        heading: "Light-gauge and the rated-assembly discipline",
        paragraphs: [
          "Light-gauge metal framing spans from non-structural partitions to load-bearing mid-rise structure — gauge, spacing, and bracing per the wall type schedule. That schedule maps every partition to an assembly, and rated assemblies are all-or-nothing: the UL listing is achieved by the exact build-up — layers, fastener spacing, head-of-wall detail, penetrations firestopped per listed systems. A wall that's 'basically' the listed assembly is a wall with no rating, and the drywall inspection is where that gets caught or covered.",
        ],
      },
    ],
    relatedLessonIds: ["tech-fire", "tech-envelope", "cn-drawings"],
  },

  // ───────────────────────────── Envelope ─────────────────────────────
  {
    id: "tech-envelope",
    track: "technical",
    category: "Envelope",
    title: "The Building Envelope: Keeping Water Out",
    summary:
      "Roofing, air/water barriers, flashing logic, windows and curtain wall, cladding, and why continuity — not products — is what fails.",
    minutes: 6,
    keyTerms: [
      { term: "WRB", definition: "Weather-resistive barrier — the drainage plane behind cladding that sheds water which gets past the face. Windows and flashings must integrate into it shingle-style." },
      { term: "NDL warranty", definition: "No-dollar-limit roofing warranty from the manufacturer — requires their inspections and approved details, which is why roofing details aren't field-improvised." },
      { term: "Kick-out flashing", definition: "The small flashing where a roof edge meets a wall, diverting water out of the wall — tiny part, catastrophic when missing." },
    ],
    body: [
      {
        heading: "Think in continuous layers",
        paragraphs: [
          "The envelope is four control layers — water, air, vapor, thermal — and each must be continuous around the whole building, through every transition: roof-to-wall, wall-to-window, wall-to-foundation, every penetration. Products rarely fail; transitions fail. When reviewing envelope details or watching installation, the question is always the same: trace the layer with a finger — where does water that gets here go, and does the air barrier connect through this joint? 'Water always wins' is not a slogan; it's a maintenance history.",
        ],
      },
      {
        heading: "The major systems",
        bullets: [
          "Roofing: single-ply (TPO/EPDM/PVC), mod-bit, or metal; tapered insulation and crickets move water to drains; parapets and penetrations are where leaks live. Manufacturer inspections protect the NDL warranty.",
          "Below-grade and plaza/balcony waterproofing: buried and unforgiving — flood test before overburden covers it.",
          "Windows and storefront: installation sequence and WRB integration matter more than the frame brand; field water testing (per ASTM) on the first installs catches systemic errors while they're fixable.",
          "Curtain wall: stick-built (assembled in place) vs. unitized (shop-built panels) — unitized is faster and better quality but a long-lead, early-design commitment.",
          "Cladding (fiber cement, metal panel, EIFS, ACM) hangs on the drainage plane; sealant joints are designed (width, backer rod, movement) not caulked by feel.",
        ],
      },
      {
        heading: "The PM's envelope playbook",
        bullets: [
          "Mock-up first — the envelope mock-up with every trade's layer in it settles sequencing arguments before the building repeats them 400 times.",
          "Pre-cover photos of every flashing and barrier transition before cladding hides them.",
          "One trade's WRB, another's windows, a third's sealants: the leak lives at their boundary, so define who laps onto whom in the scopes.",
          "Water testing early, not at closeout — a leak found in month 4 is a detail fix; found at occupancy it's an investigation.",
        ],
      },
    ],
    relatedLessonIds: ["tech-framing", "wf-quality", "cn-longlead", "tech-testing-cx"],
  },

  // ───────────────────────────── MEP Systems ─────────────────────────────
  {
    id: "tech-mep-coordination",
    track: "technical",
    category: "MEP Systems",
    title: "MEP Rough-In & Coordination",
    summary:
      "HVAC, electrical, and plumbing in sequence — the rough-in gates, the ceiling-space war, utility company lead times, and test & balance.",
    minutes: 7,
    keyTerms: [
      { term: "Rough-in", definition: "Installing the concealed portions of MEP (duct, pipe, conduit, boxes) before walls and ceilings close — each stage gated by inspection." },
      { term: "TAB", definition: "Test & Balance — adjusting the finished HVAC system to deliver design airflows/waterflows; happens near the end and exposes everything built wrong earlier." },
      { term: "ATS", definition: "Automatic transfer switch — flips life-safety loads to generator power; part of the emergency power chain the AHJ witnesses before CO." },
    ],
    body: [
      {
        heading: "The sequence has gates",
        paragraphs: [
          "MEP moves in waves tied to the structure: underground rough-in before slabs, overhead and in-wall rough-in after framing, then insulation/cover inspections, then trim-out (fixtures, devices, grilles) with finishes, then startup, testing, and balancing at the end. Every wave ends in a pressure test or an inspection before cover — duct pressure tests, hydro tests on piping, ball tests on sanitary. The PM's leverage is protecting those gates: nothing closes up untested, because everything found after cover costs ten times more.",
        ],
      },
      {
        heading: "Know the systems at PM depth",
        bullets: [
          "HVAC: RTUs and splits on smaller work; VAV, VRF, or chilled water/boiler plants on bigger. Controls/BMS is its own late-running scope that every other system depends on for acceptance.",
          "Electrical: service entrance → switchgear → distribution panels → branch circuits. Switchgear and generators are the project's longest leads — released at buyout, not when the building needs them.",
          "Emergency power: generator, ATS, egress lighting — a life-safety chain with an AHJ-witnessed test at the end.",
          "Plumbing: domestic water, sanitary/vent, storm, gas — gravity systems fix their slopes early and everything else coordinates around them. Backflow preventers and meter sets bring the utility and the water authority into your schedule.",
          "Utility company coordination (transformer pads, primary conduits, meter sets, energization) runs on the utility's timeline, not yours — start it months early and put every commitment in writing.",
        ],
      },
      {
        heading: "The ceiling-space war",
        paragraphs: [
          "Above every corridor ceiling, gravity-sloped sanitary, big duct mains, cable tray, sprinkler mains, and structure compete for the same few inches. Coordination (BIM clash detection or old-fashioned overlay drawings) settles it before installation: gravity pipe wins (it can't move), then duct (it's biggest), then everything else. A project that skips coordination settles the war in the field — by whoever installs first — and the PM pays for it in RFIs, rework, and ceilings that won't reach design height.",
        ],
      },
    ],
    relatedLessonIds: ["cn-mep", "cn-longlead", "tech-fire", "tech-testing-cx"],
  },
  {
    id: "tech-fire",
    track: "technical",
    category: "MEP Systems",
    title: "Fire Protection & Life Safety",
    summary:
      "Sprinklers, alarm, firestopping, rated assemblies, and egress — the systems the AHJ tests hardest, right before you need the CO most.",
    minutes: 5,
    keyTerms: [
      { term: "Pre-action system", definition: "A sprinkler system holding air until the alarm confirms fire — used where accidental water discharge is intolerable (data rooms, archives)." },
      { term: "Firestopping", definition: "Listed systems sealing penetrations and joints in rated assemblies — each one matched to the specific penetrant and assembly, and documented." },
      { term: "Acceptance test", definition: "The AHJ/fire marshal's witnessed functional test of the alarm and suppression systems — a hard gate before Certificate of Occupancy." },
    ],
    body: [
      {
        heading: "Suppression and alarm",
        bullets: [
          "Sprinklers: wet systems (pipes full of water) are the default; dry systems protect freezing areas; pre-action protects water-sensitive rooms. Design density comes from hazard classification — and sprinkler design is usually delegated engineering, so shop drawings carry a PE stamp and real review time.",
          "Fire pumps and standpipes serve tall or big buildings; the pump test is its own witnessed event.",
          "Fire alarm: devices, notification, the panel, and monitoring — installed by one sub, but interfacing with doors, elevators, dampers, and HVAC shutdown from several others. The alarm matrix (what triggers what) is a coordination document worth reading.",
          "The fire marshal's acceptance test is a hard CO gate: every device exercised, every interface proven. Schedule it with slack, because failing it reschedules everything behind it.",
        ],
      },
      {
        heading: "Passive systems: the documentation burden",
        paragraphs: [
          "Rated walls and floors only work if every hole through them is sealed with a listed firestop system matched to the penetrant — a 2\" steel pipe and a 2\" plastic pipe through the same wall need different systems. Multiply by thousands of penetrations, add rated doors and dampers, and passive fire protection becomes primarily a tracking problem: photo-documented, labeled, and inspected before cover. Third-party firestop inspection is increasingly required; either way, the binder of listed systems is a closeout deliverable.",
        ],
      },
      {
        heading: "Egress awareness",
        paragraphs: [
          "Exits, travel distances, corridor ratings, door swing and hardware (panic devices, closers, latching) are code-driven and inspected. The PM-relevant part: egress requirements apply during construction too — a stairwell blocked by material storage or a disabled exit sign is an immediate compliance problem, and the temporary egress plan for a phased or occupied building is real work, not paperwork.",
        ],
      },
    ],
    relatedLessonIds: ["tech-framing", "tech-mep-coordination", "wf-permits"],
  },

  // ───────────────────────────── Interiors ─────────────────────────────
  {
    id: "tech-finishes",
    track: "technical",
    category: "Interiors",
    title: "Interior Finishes: Sequence and Protection",
    summary:
      "Drywall levels, ceilings, flooring moisture testing, millwork, doors and hardware — the phase where quality is most visible and damage is easiest.",
    minutes: 6,
    keyTerms: [
      { term: "Finish level (1–5)", definition: "The drywall finishing standard — Level 4 for typical paint, Level 5 (skim coat) where critical lighting rakes the wall. Priced differently, argued constantly." },
      { term: "Slab moisture testing", definition: "RH probe or calcium chloride tests confirming a slab is dry enough for flooring — skipping it is how new floors bubble." },
      { term: "Keying meeting", definition: "The owner sit-down that decides the keying/master-key hierarchy — held early because cylinders and cores are long-lead decisions." },
    ],
    body: [
      {
        heading: "The finish sequence",
        paragraphs: [
          "Finishes reward sequence discipline: drywall and first paint, ceilings gridded (with everything above inspected first), hard flooring, millwork and doors, trim-out and final paint, then carpet and the delicate stuff last. Every trade re-entering a finished room risks damage to someone else's work, so the sequence is really a protection strategy — and the super's room-by-room matrix of what's done, what's protected, and who's allowed in is what keeps the punch list from writing itself.",
        ],
      },
      {
        heading: "Where finish problems come from",
        bullets: [
          "Drywall: fire taping in concealed rated areas vs. finish taping in view; Level 5 where wall-wash lighting demands it. Check finish levels before paint, under raking light — after paint it's a dispute.",
          "Flooring: moisture testing on every slab receiving resilient flooring (RH probes per ASTM F2170). Adhesive failures from wet slabs are five-figure problems with a two-hundred-dollar prevention.",
          "Tile: waterproofing at wet areas, movement joints per TCNA, and setting materials matched to the substrate — big tile on an unflat slab telegraphs everything.",
          "Millwork/casework: shop drawings against field dimensions, and field dimensions taken after the walls exist, not from the plans.",
          "Doors/frames/hardware: the hardware schedule is its own coordination discipline — electrified hardware needs power and low-voltage rough-in decided months before doors hang; the keying meeting happens early.",
        ],
      },
      {
        heading: "Protection is a line item",
        paragraphs: [
          "Finished work gets damaged by the trades that follow it — always has. Ram board on floors, corner guards, protecting the approved mock-up room, and charging damage back to the trade that caused it (with photos from the daily log) are how the last month of the job stays a punch list instead of a rebuild. Protection costs real money; budget it rather than discovering it.",
        ],
      },
    ],
    relatedLessonIds: ["wf-quality", "wf-punch-closeout", "tech-framing"],
  },
  {
    id: "tech-vertical-lv",
    track: "technical",
    category: "Interiors",
    title: "Elevators & Low Voltage: The Late-Project Traps",
    summary:
      "Why elevators are bought first and finished last, the state inspection gauntlet, structured cabling, and the DAS/ERRC surprise.",
    minutes: 5,
    keyTerms: [
      { term: "MRL elevator", definition: "Machine-room-less traction elevator — the common mid-rise choice; the machine lives in the hoistway, trading a machine room for tighter shaft tolerances." },
      { term: "MDF / IDF", definition: "Main and intermediate distribution frames — the data rooms where structured cabling lands; they need power, cooling, and finishes earlier than anyone plans." },
      { term: "ERRC / DAS", definition: "Emergency responder radio coverage, often via a distributed antenna system — testable only in the finished building, and a CO gate in many jurisdictions." },
    ],
    body: [
      {
        heading: "The elevator timeline problem",
        paragraphs: [
          "Elevators combine the longest procurement in the building with the last acceptance test before occupancy. Release the elevator package at buyout — hydraulic vs. traction/MRL is already decided in the drawings — then hit the interface obligations on time: a plumb hoistway within tolerance, the pit with its ladder and sump, hoistway dividers, permanent power, and machine-room or controller-space conditions. The elevator contractor's schedule is unforgiving because their techs are scheduled months out; miss your readiness dates and you go to the back of their line, with the state inspection (a separate agency with its own backlog) still waiting after that.",
        ],
      },
      {
        heading: "Low voltage grows every year",
        bullets: [
          "Structured cabling: pathways (tray, sleeves, J-hooks) are coordinated with MEP early; the MDF/IDF rooms need power, cooling, and dust-free finishes before racks land.",
          "Access control and security: door hardware interfaces again — electric strikes, mag locks, request-to-exit — decided with the hardware schedule, not after doors hang.",
          "AV and owner technology are often owner-furnished (OFCI): the GC provides rough-in, power, and blocking per an owner vendor's drawings, and gaps between those scopes are the PM's to find.",
          "Fire alarm interfaces run through low voltage too — elevator recall, door release, HVAC shutdown all get proven in the acceptance test.",
        ],
      },
      {
        heading: "The DAS/ERRC surprise",
        paragraphs: [
          "Many jurisdictions require proven emergency-responder radio coverage before CO — and coverage can only be tested in the real, finished building, because concrete, metal deck, and low-E glass are what block the signal. The trap: the test happens late, and if coverage fails, a DAS must be designed, permitted, installed, and retested on the critical path to occupancy. The move is to test early (a pre-test at dry-in), carry the DAS as a known risk with an allowance, and never discover the requirement from the fire marshal at final.",
        ],
      },
    ],
    relatedLessonIds: ["cn-longlead", "tech-fire", "wf-permits"],
  },

  // ─────────────────────── Testing & Commissioning ───────────────────────
  {
    id: "tech-testing-cx",
    track: "technical",
    category: "Testing & Commissioning",
    title: "Testing, Inspections & Commissioning",
    summary:
      "Who inspects what — AHJ vs. special inspections vs. third-party testing — and how commissioning proves the building actually works.",
    minutes: 5,
    keyTerms: [
      { term: "CxA", definition: "Commissioning agent/authority — the owner's verifier that systems are designed, installed, and perform per the owner's project requirements." },
      { term: "Functional performance test", definition: "A scripted commissioning test exercising a system through its sequences (occupied/unoccupied, failure modes) — beyond 'it turns on'." },
      { term: "Statement of special inspections", definition: "The permit document listing every IBC Chapter 17 inspection required; final sign-off is a CO prerequisite." },
    ],
    body: [
      {
        heading: "Three inspection regimes, three bosses",
        bullets: [
          "AHJ inspections — the building department's code checkpoints (footing, framing, finals). They gate cover-up and occupancy.",
          "Special inspections (IBC Chapter 17) — third-party verification of structural work (concrete, steel, soils, masonry), hired by the owner, reporting to the building official. The statement of special inspections defines the list; the final report is a CO prerequisite.",
          "Contract testing — the testing agency (concrete cylinders, compaction, weld NDT) plus manufacturer inspections protecting warranties (roofing NDL). Keep one log across all three regimes: what's required, what's passed, what's open. Failed items chased to documented closure.",
        ],
      },
      {
        heading: "Commissioning is a process, not an event",
        paragraphs: [
          "Commissioning starts long before startup: the CxA reviews design against the owner's project requirements, comments on submittals, then drives the field sequence — installation checklists, startup, functional performance tests, and seasonal/deferred testing after occupancy. For the PM, Cx is a schedule discipline: functional tests need finished systems, permanent power, and completed controls programming, which makes controls the classic Cx bottleneck. A test that fails is normal; a test that couldn't run because prerequisites weren't done is a PM miss.",
        ],
      },
      {
        heading: "The finish-line convergence",
        paragraphs: [
          "The last month braids everything together: TAB feeding Cx, fire alarm acceptance gating the elevator inspection, special-inspection final reports and Cx documentation feeding the CO package, and owner training riding on commissioned systems. Map these dependencies backward from the CO date early — the order is not discretionary, and each agency involved has its own calendar.",
        ],
      },
    ],
    relatedLessonIds: ["wf-quality", "wf-permits", "wf-punch-closeout", "tech-mep-coordination"],
  },
];
