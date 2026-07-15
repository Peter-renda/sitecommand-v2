/**
 * Seed the 9 RFIs (plus 1 Draft) from the Arbors at South Crossing
 * RFI Log into Supabase. Recreates the question, every chronological
 * response, distribution list, assignees, ball-in-court, and a
 * synthesized change-history audit trail.
 *
 * HOW TO RUN:
 *   1. .env.local (or environment) must contain:
 *        NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
 *        SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
 *
 *   2. From the project root:
 *        npx ts-node --project tsconfig.json scripts/seed-arbors-rfis.ts
 *
 * The script is idempotent on (project_id, rfi_number) for RFI #1–#9:
 * it deletes any existing RFI at that number (cascade removes responses
 * + history) before re-inserting. The unnumbered Draft RFI is matched by
 * subject before delete/insert.
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { randomUUID } from "crypto";

dotenv.config({ path: ".env.local" });
dotenv.config();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ─────────────────────────────────────────────────────────────────────────────
// Contact roster (drawn from the RFI Log distribution lists)
// ─────────────────────────────────────────────────────────────────────────────

type ContactSeed = {
  firstName: string;
  lastName: string;
  company: string;
  permission: string;
};

const CONTACTS: ContactSeed[] = [
  { firstName: "Pete", lastName: "Renda", company: "Hamel Builders, Inc.", permission: "Company Employee" },
  { firstName: "James", lastName: "Schuster", company: "Hamel Builders, Inc.", permission: "Company Employee" },
  { firstName: "Tim", lastName: "Parry", company: "Hamel Builders, Inc.", permission: "Company Employee" },
  { firstName: "Scott", lastName: "Andrews", company: "Hamel Builders, Inc.", permission: "Company Employee" },
  { firstName: "Oscar", lastName: "Macció", company: "Hamel Builders, Inc.", permission: "Company Employee" },
  { firstName: "Adam", lastName: "Carroll", company: "Timmons Group", permission: "Architect/Engineer" },
  { firstName: "Tony", lastName: "Humphrey", company: "Greensboro Housing Authority", permission: "Owner/Client" },
  { firstName: "Kenneth", lastName: "Parks II", company: "Greensboro Housing Authority", permission: "Owner/Client" },
  { firstName: "Meredith", lastName: "Daye", company: "Greensboro Housing Authority", permission: "Owner/Client" },
  { firstName: "Drew", lastName: "Culler", company: "Smith & Jennings, Inc.", permission: "Subcontractor" },
  { firstName: "Charles", lastName: "Smith", company: "Smith & Jennings, Inc.", permission: "Subcontractor" },
  { firstName: "Chucho", lastName: "Rodriguez", company: "Smith & Jennings, Inc.", permission: "Subcontractor" },
  { firstName: "Beverly", lastName: "Spersrud", company: "Sitescapes LLC", permission: "Subcontractor" },
  { firstName: "John", lastName: "Pennock", company: "Sitescapes, LLC.", permission: "Subcontractor" },
  { firstName: "Christopher", lastName: "Bolen", company: "Michael Baker Engineering", permission: "Architect/Engineer" },
  { firstName: "Jeffrey", lastName: "Oates", company: "C2 Contractors, LLC", permission: "Subcontractor" },
  { firstName: "Malaki", lastName: "Moore", company: "C2 Contractors, LLC", permission: "Subcontractor" },
  { firstName: "Elena", lastName: "Calvert", company: "CPH Concrete", permission: "Subcontractor" },
];

type ContactRow = { id: string; first_name: string | null; last_name: string | null; email: string | null; company: string | null };

const CONTACT_KEY = (firstName: string, lastName: string) =>
  `${firstName.trim().toLowerCase()}|${lastName.trim().toLowerCase()}`;

// ─────────────────────────────────────────────────────────────────────────────
// RFI seed data
// ─────────────────────────────────────────────────────────────────────────────

type Person = { firstName: string; lastName: string };

type ResponseSeed = {
  author: Person;
  /** ISO with offset, e.g. "2026-05-14T16:11:00-04:00" */
  at: string;
  body: string;
};

type RfiSeed = {
  rfi_number: number | null;
  subject: string;
  status: "open" | "closed" | "draft";
  responsibleCompany: string | null;
  receivedFrom: Person | null;
  manager: Person;
  assignees: Person[];
  ballInCourt: Person | null;
  /** Date the original question was sent. ISO with offset. Also used as created_at + initiated date. */
  initiatedAt: string;
  dueDate: string | null;
  closedDate: string | null;
  /** Distribution list. */
  distribution: Person[];
  location?: string | null;
  scheduleImpact?: string | null;
  costImpact?: string | null;
  costCode?: string | null;
  subJob?: string | null;
  rfiStage?: string | null;
  private?: boolean;
  createdBy: Person;
  question: string;
  /** Sorted oldest → newest. */
  responses: ResponseSeed[];
  /** Original RFI attachments (display-only, no real file upload here). */
  attachments?: string[];
};

const PETE: Person = { firstName: "Pete", lastName: "Renda" };
const JAMES: Person = { firstName: "James", lastName: "Schuster" };
const TIM: Person = { firstName: "Tim", lastName: "Parry" };
const ADAM: Person = { firstName: "Adam", lastName: "Carroll" };
const KENNY: Person = { firstName: "Kenneth", lastName: "Parks II" };

const RFIS: RfiSeed[] = [
  // ── RFI #9 ────────────────────────────────────────────────────────────────
  {
    rfi_number: 9,
    subject: "Freeman Mill Water Tap",
    status: "closed",
    responsibleCompany: null,
    receivedFrom: null,
    manager: PETE,
    assignees: [ADAM],
    ballInCourt: null,
    initiatedAt: "2026-04-27T07:42:00-04:00",
    dueDate: "2026-05-04",
    closedDate: "2026-05-15",
    distribution: [
      TIM,
      { firstName: "Tony", lastName: "Humphrey" },
      ADAM,
      { firstName: "Drew", lastName: "Culler" },
      { firstName: "Charles", lastName: "Smith" },
      KENNY,
      JAMES,
    ],
    createdBy: PETE,
    attachments: ["C-401_ DETAILED UTILITY PLAN (SHEET 1 OF 6) Rev.0 markup (2).pdf"],
    question:
      "Hi Adam,\n\nCan we tie into the 6\" water line instead of going out into Freeman Mill Rd?\n\nSmith & Jennings has been assessing the bore and believes tieing into te 6\" line would help save time and avoid running into any unstuitabes in the road.\n\nPlease let me know if you need more info on this.",
    responses: [
      {
        author: JAMES,
        at: "2026-05-01T14:35:00-04:00",
        body:
          "Adam please see attached marked up drawing that I did with the city inspector they just wanted to get your approval on that and they are fine with the markups here showing using the existing 6 inch water line putting a new gate valve in behind the curb and a 6 by 8 reducing T to an 8 inch line to 45 into our 8'' in Hudgins Drive The city does not want us in the road\n\nAttachment: new water tap on freeman millrdtt.pdf",
      },
      {
        author: ADAM,
        at: "2026-05-04T08:26:00-04:00",
        body:
          "We spoke with the Water Resources Department about this last week, and they are evaluating and speaking with other Departments to ensure everyone is on the same page. They were not aware of the field discussions, and this is not yet approved.",
      },
      {
        author: JAMES,
        at: "2026-05-06T14:57:00-04:00",
        body:
          "The city inspector came by yesterday wanting to know where we were on Your approval He discussed this with the Roads Department and the water department he said if you don't want to do that then we need to submit it for a change or get approval to do a red line drawn please let us know how you're going to proceed We are ready to do the work",
      },
      {
        author: ADAM,
        at: "2026-05-07T08:22:00-04:00",
        body:
          "We have to get approval from Water Resources Plan Review in order to green light this change. Can you please send me the names and numbers of who you've been speaking with?",
      },
      {
        author: PETE,
        at: "2026-05-14T12:55:00-04:00",
        body:
          "HI Adam,\n\nWe had a meeting with the city and they said that this was acceptable and will just need to be red lined in the as-built. Please confirm this is acceptable.\n\nThanks.",
      },
      {
        author: ADAM,
        at: "2026-05-14T16:11:00-04:00",
        body:
          "Per City of Greensboro, it is acceptable to tie into existing 6\" stub. A new drawing is not required, and the revisions will be picked up on the As-Built Drawings. Please keep good redlines of the new installation.\n\nThe City also mentioned that there was talk of an inline valve on the 8\" line, and the City does not want that. If the valve is needed for testing purposes, it will need to be removed for final acceptance.",
      },
    ],
  },

  // ── RFI #8 ────────────────────────────────────────────────────────────────
  {
    rfi_number: 8,
    subject: "Curb Elevations",
    status: "closed",
    responsibleCompany: null,
    receivedFrom: null,
    manager: PETE,
    assignees: [ADAM],
    ballInCourt: null,
    initiatedAt: "2026-03-09T14:55:00-04:00",
    dueDate: "2026-03-16",
    closedDate: "2026-05-14",
    distribution: [TIM, { firstName: "Tony", lastName: "Humphrey" }, KENNY, { firstName: "Meredith", lastName: "Daye" }, JAMES],
    createdBy: PETE,
    attachments: ["C-313_ NOTES & DETAILS Rev.0 markup.pdf"],
    question:
      "Hi Adam, Can you please provide curb elevations, curb type, and ADA depresssions for curb throughout site?",
    responses: [
      {
        author: ADAM,
        at: "2026-03-17T07:46:00-04:00",
        body:
          "Can you please provide areas where additional information is requested? The Grading Plan has a pretty detailed set of spot elevations.",
      },
      {
        author: PETE,
        at: "2026-03-24T11:18:00-04:00",
        body:
          "Adam, please see circled areas. Also, can you let us know which curb type goes in each location?\n\nAttachment: C-506_ DETAILED GRADING & DRAINAGE PLAN (SHEET 6 OF 6) Rev.0 markup.pdf",
      },
      {
        author: PETE,
        at: "2026-03-24T13:06:00-04:00",
        body: "We also need dimension and curb depressions for ADA parking.",
      },
      {
        author: ADAM,
        at: "2026-03-24T13:30:00-04:00",
        body:
          "• Dimensional information for the ADA parking areas are shown in detail on Sheet C-302.\n• Top of curb grades are based on a consistent cross slope from the centerline of the road - see road cross sections on Sheet C-500 & Road Profiles Sheets.\n• Curb along the roads are 2'-6\" Standard Curb & Gutter - see road cross sections on Sheet C-500\n• The circled areas in question are based on the elevations storm structures A51p, A51n, and A51l - see Sheet C-517",
      },
      {
        author: ADAM,
        at: "2026-03-24T13:45:00-04:00",
        body:
          "Please also see City of Greensboro Street Section Detail on Sheet C-311 for additional information. Per detail, top of curb is 2\" below crown of road.",
      },
    ],
  },

  // ── RFI #7 ────────────────────────────────────────────────────────────────
  {
    rfi_number: 7,
    subject: "Revised Storm Drain Elevations",
    status: "open",
    responsibleCompany: "Greensboro Housing Authority",
    receivedFrom: KENNY,
    manager: JAMES,
    assignees: [KENNY],
    ballInCourt: KENNY,
    initiatedAt: "2026-03-09T14:49:00-04:00",
    dueDate: "2026-03-16",
    closedDate: null,
    distribution: [TIM, { firstName: "Tony", lastName: "Humphrey" }, ADAM, KENNY, { firstName: "Meredith", lastName: "Daye" }, JAMES],
    createdBy: PETE,
    attachments: ["C-513_ STORM DRAINAGE PLAN (SHEET 2 OF 6) Rev.4 markup (2).pdf"],
    question:
      "GHA would like Hamel's formal assessment of the storm drain system on Huntley Court with the revised elevations. GHA would like Hamel to assess the following:\n\n• Drainage capacity of the existing storm drain line\n• Integrity and connections of the installed joints\n• Any potential impacts to adjacent utilities based on their current installed elevations\n\nPlease inclcude Hamel's proposed approach for proceeding with work in this area and include the required elevations from the distributed approved drawings from Timmons Group. If Hamel proposes to retain all currently installed storm structures and piping, then Timmons Group must review and approve the proposed plan. Upon approval, both parties—Timmons Group and Hamel Builders, Inc.—shall certify via executed company letterhead that the system will function in accordance with the original design intent and specifications.\n\nPlease ensure that:\n\n• All connections and installations comply with City of Greensboro and NCDOT standards\n• All connections are inspected and approved prior to backfilling to confirm proper installation",
    responses: [
      {
        author: ADAM,
        at: "2026-03-18T08:17:00-04:00",
        body: "Formal response was sent to GHA on 2/19.",
      },
      {
        author: JAMES,
        at: "2026-03-24T15:53:00-04:00",
        body: "Hamel will need the Formal response that was sent to GHA on 2/19 to be able to close this RFI",
      },
      {
        author: ADAM,
        at: "2026-03-24T16:38:00-04:00",
        body:
          "The formal response TG sent to GHA was a recommendation for GHA's consideration. It's our understanding that GHA will issue a formal response with their findings and decision.",
      },
      {
        author: JAMES,
        at: "2026-03-24T16:46:00-04:00",
        body: "Hamel will need the Formal response from GHA be able to close this RFI",
      },
      {
        author: PETE,
        at: "2026-05-14T12:58:00-04:00",
        body: "Hi Kenny, Any update on an offical response from GHA on this so we can close out this RFI? Thanks.",
      },
      {
        author: ADAM,
        at: "2026-05-14T15:13:00-04:00",
        body: "Portion of Storm Sewer in question is acceptable as installed.",
      },
    ],
  },

  // ── RFI #6 ────────────────────────────────────────────────────────────────
  {
    rfi_number: 6,
    subject: "Unsuitable Soils For 95' of Retaining Wall",
    status: "open",
    responsibleCompany: "Hamel Builders, Inc.",
    receivedFrom: JAMES,
    manager: JAMES,
    assignees: [ADAM],
    ballInCourt: JAMES,
    initiatedAt: "2025-11-19T13:25:00-05:00",
    dueDate: "2025-11-26",
    closedDate: null,
    distribution: [
      TIM,
      { firstName: "Tony", lastName: "Humphrey" },
      { firstName: "Drew", lastName: "Culler" },
      { firstName: "Charles", lastName: "Smith" },
      KENNY,
      { firstName: "Beverly", lastName: "Spersrud" },
      { firstName: "John", lastName: "Pennock" },
      { firstName: "Meredith", lastName: "Daye" },
      { firstName: "Christopher", lastName: "Bolen" },
      PETE,
      { firstName: "Jeffrey", lastName: "Oates" },
    ],
    createdBy: PETE,
    attachments: [
      "The Arbors at South Crossing letter of recommendation foter for retaining wall.pdf",
      "IMG_0463.jpg",
      "IMG_0458.jpg",
      "IMG_0464.jpg",
      "IMG_0465.jpg",
    ],
    question:
      "Please see attached letter of recommendation from Michael Baker for unsuitable soils where the footer for the retaining wall will go. Due to unsuitable soils we cannot achieve the bearing capacity required using the fill on site due to the fact that it does not meet the requirement for the gradation for the weight and bearing capacity for the retaining wall, per the approved drawings. Please advise how to proceed.",
    responses: [
      {
        author: ADAM,
        at: "2025-11-23T15:43:00-05:00",
        body: "Please proceed with Geotechnical recommendation.",
      },
      {
        author: PETE,
        at: "2026-01-05T15:09:00-05:00",
        body:
          "Adam, Please see the updated letter of recommendation from Michael Baker.\n\nAttachment: Letter of recommendations for wall backfill.pdf",
      },
      {
        author: ADAM,
        at: "2026-01-06T09:13:00-05:00",
        body: "Please proceed with Geotechnical recommendation.",
      },
      {
        author: JAMES,
        at: "2026-01-15T17:26:00-05:00",
        body:
          "Adam, Please see the updated letter of recommendation from Michael Baker. Letter #3\n\nAttachment: Michaelbaker Fill Recommendation.Wall pdf.pdf",
      },
      {
        author: ADAM,
        at: "2026-01-16T06:27:00-05:00",
        body: "We recommend following the Geotechnical recommendation.",
      },
    ],
  },

  // ── RFI #5 ────────────────────────────────────────────────────────────────
  {
    rfi_number: 5,
    subject: "Wet Pond Outlet Structure",
    status: "closed",
    responsibleCompany: "Hamel Builders, Inc.",
    receivedFrom: JAMES,
    manager: PETE,
    assignees: [ADAM],
    ballInCourt: null,
    initiatedAt: "2025-10-24T14:40:00-04:00",
    dueDate: "2025-10-29",
    closedDate: "2025-12-18",
    location: "Wet pond",
    scheduleImpact: "TBD",
    subJob: "Course of Construction",
    distribution: [
      TIM,
      { firstName: "Tony", lastName: "Humphrey" },
      KENNY,
      { firstName: "Meredith", lastName: "Daye" },
      JAMES,
      PETE,
      { firstName: "Jeffrey", lastName: "Oates" },
    ],
    createdBy: PETE,
    attachments: ["RFI #5.pdf"],
    question:
      "Plans do not show any rebar or wire mesh in the new footer that the new outlet structure sits on. Please advise on how to proceed. Hamel believes that we need #4 bars 2' on center boxed.\n\nPlans do not show bearing capacity or give a specification for the soil under the footer. Due to the fact that the structure weighs 17,000 pounds plus the weight of the footer, which we estimate to be 22,000 pounds, plus the weight of the water half way up the structure, which we estimate to be 13,000 pounds. Overall estimated weight of 52,000 pounds, Hamel and the Geotech suggest we do a 4,500 psi bearing capacity under the structure. Please advise if this is acceptable.",
    responses: [
      {
        author: ADAM,
        at: "2025-10-29T10:23:00-04:00",
        body:
          "Please proceed with #4 bars as suggested.\n\nWe will defer to the Geotech Engineer on acceptable bearing capacity.",
      },
      {
        author: JAMES,
        at: "2025-10-30T06:20:00-04:00",
        body:
          "There is no concrete strength for the footer called out on the plans the Geotech has recommended a 4500 mix would you like me to refer to the geotechnical engineer on concrete strength to ?",
      },
    ],
  },

  // ── RFI #4 ────────────────────────────────────────────────────────────────
  {
    rfi_number: 4,
    subject: "Exisiting RCP at Marsh St.",
    status: "closed",
    responsibleCompany: "Hamel Builders, Inc.",
    receivedFrom: PETE,
    manager: PETE,
    assignees: [ADAM],
    ballInCourt: null,
    initiatedAt: "2025-10-08T10:31:00-04:00",
    dueDate: "2025-10-15",
    closedDate: "2025-12-18",
    distribution: [
      TIM,
      { firstName: "Tony", lastName: "Humphrey" },
      { firstName: "Drew", lastName: "Culler" },
      { firstName: "Charles", lastName: "Smith" },
      KENNY,
      { firstName: "Chucho", lastName: "Rodriguez" },
      { firstName: "Meredith", lastName: "Daye" },
      JAMES,
    ],
    createdBy: PETE,
    attachments: [
      "C-513_ STORM DRAINAGE PLAN (SHEET 2 OF 6) Rev.0 markup.pdf",
      "marsh st pipe 2.jpg",
      "Marsh St pipe.jpg",
    ],
    question:
      "The existing conditions do not match the drawings. The existing RCP running from both existing structures (across Marsh St. and parallel to Marsh St.) are both 30\". The plans call to replace a 15\" storm line with 24\" RCP going across Marsh St. and to install 30\" RCP running parallel to Marsh St. Please advise how to proceed now that both existing pipes are 30\".",
    responses: [
      {
        author: ADAM,
        at: "2025-10-14T17:30:00-04:00",
        body:
          "We will investigate existing pipe sizes with the City and determine if existing can remain. The existing pipe sizes were based on the design survey. However, the design intent is for these existing inlets to be removed and replaced with new inlets as noted on the Demo Plan. The 4' dimension between the boxes is the proposed dimension between the boxes. the stormwater pre and post flows were modeled based on the new configuration and may not be able to be omitted.\n\nAttachment: Demo Callout Sheet C-202.png",
      },
      {
        author: ADAM,
        at: "2025-10-28T15:28:00-04:00",
        body:
          "Per previous discussions, the existing boxes and pipes within Marsh Street will need to be replaced per the drawings.",
      },
      {
        author: JAMES,
        at: "2025-10-30T06:23:00-04:00",
        body: "Can you please provide elevations for these boxes",
      },
    ],
  },

  // ── RFI #3 ────────────────────────────────────────────────────────────────
  {
    rfi_number: 3,
    subject: "Unsuitable soils",
    status: "closed",
    responsibleCompany: "Hamel Builders, Inc.",
    receivedFrom: TIM,
    manager: TIM,
    assignees: [ADAM],
    ballInCourt: null,
    initiatedAt: "2025-07-18T13:46:00-04:00",
    dueDate: "2025-07-25",
    closedDate: "2025-07-29",
    location: "Wet pond",
    scheduleImpact: "Yes (Unknown)",
    costImpact: "Yes (Unknown)",
    costCode: "02-310 - Earthwork & Grading",
    subJob: "Course of Construction",
    distribution: [{ firstName: "Tony", lastName: "Humphrey" }, ADAM, KENNY, { firstName: "Meredith", lastName: "Daye" }, JAMES],
    createdBy: TIM,
    attachments: [
      "HBI - Haul and cut 2.0 Logs.pdf",
      "Unsuitable Soil Notice.pdf",
      "MBI 208023_2025.06.10_The Arbors at South Crossing.pdf",
      "Arbors Infrastructure Contract Clarifications Page of Executed Doc 03.23.25.pdf",
      "MBI 208023_2025.06.10_The Arbors at South Crossing.pdf",
    ],
    question:
      "As you know unsuitable soils as determined by the geotechnical engineer, have been encountered in the roadways and the future wet pond locations. These soils per the attached reports are not suitable for structural fill and should be removed from the project. Currently there is no suitable structural fill available onsite due to the continued rainfall which prohibits the ability to dry any of the onsite material which is useable accept for the elevated moisture levels. The only other potential onsite source of dryer material is at the wet pond area but under 8 - 12 feet of unsuitable material. The request is for authorization to haul-off the unsuitable material at the wet pond to access the deep materials in the pond as well, to remove any other unsuitable materials encountered under a unit cost as outlined in my original letter. This has stopped all production on the project and delayed it as well.",
    responses: [
      {
        author: ADAM,
        at: "2025-07-21T07:41:00-04:00",
        body:
          "Please cease unauthorized haul off operations and continue with earthwork operations by stockpiling unsuitable material per the attached map. Map also shows locations suitable for drying operations. Please note that drying of soils that exceed optimum moisture content is a contractual obligation per Spec Section 312000 - Earthwork.\n\nAttachments: Stockpile Locations.pdf, Excerpts from Earthwork Spec.pdf",
      },
      {
        author: JAMES,
        at: "2025-07-21T13:41:00-04:00",
        body:
          "Please see Hamel's marked up drawing showing the new locations for drying and storing material due to the fact that there is a storm basin # 4 and a steep hill in the previously noted locations. let Hamel know if these new locations are acceptable and we will begin moving material when it dries out enough to work\n\nAttachment: RFI 3.C-300A_ PROJECT PHASING PLAN Rev.0 markup.pdf",
      },
      {
        author: ADAM,
        at: "2025-07-22T17:01:00-04:00",
        body:
          "New locations as proposed are acceptable. Please note that material is to be spread rather than left in \"mounds.\"",
      },
    ],
  },

  // ── RFI #2 ────────────────────────────────────────────────────────────────
  {
    rfi_number: 2,
    subject: "Existing conditions W Florida street 8\" water line",
    status: "closed",
    responsibleCompany: "Hamel Builders, Inc.",
    receivedFrom: JAMES,
    manager: JAMES,
    assignees: [ADAM, KENNY],
    ballInCourt: null,
    initiatedAt: "2025-06-17T11:56:00-04:00",
    dueDate: "2025-06-24",
    closedDate: "2025-09-23",
    scheduleImpact: "Yes (Unknown)",
    costImpact: "Yes (Unknown)",
    subJob: "Course of Construction",
    distribution: [
      TIM,
      { firstName: "Tony", lastName: "Humphrey" },
      ADAM,
      { firstName: "Drew", lastName: "Culler" },
      { firstName: "Meredith", lastName: "Daye" },
      JAMES,
      { firstName: "Malaki", lastName: "Moore" },
    ],
    createdBy: JAMES,
    attachments: [
      "C-405_ DETAILED UTILITY PLAN (SHEET 5 OF 6) Rev.0 markup.pdf",
      "C-404_ DETAILED UTILITY PLAN (SHEET 4 OF 6) Rev.0 markup.pdf",
      "pic 2.jpg",
      "pic 6.jpg",
      "pic 8.jpg",
      "pic 1.jpg",
      "pic 8.jpg",
      "pic 5.jpg",
      "pic 4.jpg",
      "pic 3.jpg",
      "pic 9.jpg",
    ],
    question:
      "Existing conditions do not match the plans. On pages C-404 & C-405 the plan shows ten to twelve feet between the sidewalk and the trees on W Florida street in that ten to twelve feet, the plans show the new 8\" water line being installed. Existing conditions are the trees range from 2' to 5' from the sidewalk. Hamel does not believe there is adequate space to install this water line between the sidewalk and trees without damaging and killing the trees and staying in Osha compliance with sloping of the trench. On the other side of the 5' sidewalk there is a gas line and a fiber optic line, ranging from 0' to 5 ' from the existing sidewalk there are also telephone poles and fiber optic boxes. Hamel recommendation would be to remove the trees since there is not adequate space between the trees and the gas and fiber lines Please advise how to proceed",
    responses: [
      {
        author: ADAM,
        at: "2025-06-17T13:11:00-04:00",
        body:
          "Please note that the dimensions indicated on the RFI are the dimensions from the proposed sidewalk, not the existing sidewalk. The existing sidewalk will be removed, and the proposed sidewalk will be installed approximately 6.5' closer to the street, which accounts for the noted discrepancy.",
      },
      {
        author: JAMES,
        at: "2025-06-23T14:01:00-04:00",
        body:
          "With the new waterline installed where it is shown on the plans Hamel builders will not be responsible for the health of the trees, if they die or die back due to the fact, we are digging within the drip line of the trees and in the root structure. With the new sidewalk starting 5 foot from the back of curb, we now have fiber optic boxes and a telephone pole in the new proposed sidewalk which will not meet ADA requirement's. Recommend putting the sidewalk back in the same location on W Florida Street between Luray Drive and Hudgins Drive to avoid having to relocate the fiber line and telephone pole",
      },
    ],
  },

  // ── RFI #1 ────────────────────────────────────────────────────────────────
  {
    rfi_number: 1,
    subject: "AT&T fiber box directly in the new entrance at Luray dr. to West Florida Street",
    status: "closed",
    responsibleCompany: "Hamel Builders, Inc.",
    receivedFrom: JAMES,
    manager: JAMES,
    assignees: [KENNY],
    ballInCourt: null,
    initiatedAt: "2025-06-13T15:38:00-04:00",
    dueDate: "2025-06-20",
    closedDate: "2026-05-15",
    scheduleImpact: "Yes (Unknown)",
    distribution: [
      TIM,
      { firstName: "Tony", lastName: "Humphrey" },
      KENNY,
      { firstName: "Meredith", lastName: "Daye" },
      { firstName: "Elena", lastName: "Calvert" },
      JAMES,
    ],
    createdBy: JAMES,
    attachments: [
      "C-201_ DEMOLITION & PHASE I EROSION CONTROL PLAN Rev.0 markup (1).pdf",
      "2.jpg",
      "3.jpg",
      "4.jpg",
      "6.jpg",
    ],
    question:
      "The plans one page C-201 show where the new entrance from Luray dr. to West Florida Street will be. Per that new location of this entrance there is a AT&T fiber box directly in this entrance it will need to be relocated out of the entrance and out of the way of the new water lines and valves please advise when this work will be complete so Hamel can complete the construction of this entrance",
    responses: [
      {
        author: KENNY,
        at: "2025-06-18T13:18:00-04:00",
        body:
          "We have coordinated at site visit with Verizon/MCI for next week to determine a new location for the MCI box to be relocated to. Once the representative has confirmed a day and time, this will be communicated to the team.",
      },
      {
        author: JAMES,
        at: "2025-06-23T17:51:00-04:00",
        body:
          "Please let me know what time and date when they're coming out this week. Their is a fiber box that will be in the way off of Hudging Drive that will need to be relocated to so we have one at each entrance off of Florida Street that needs to be relocated",
      },
      {
        author: JAMES,
        at: "2025-08-13T09:39:00-04:00",
        body: "Any up date on when the fiber box at Hudging Drive and Florida Street will be relocated ?",
      },
      {
        author: KENNY,
        at: "2025-09-03T17:52:00-04:00",
        body:
          "Verizon/MCI will be on site to assess the box's current location on 9/4 @ 11:30am. After this assessment, according to the representative, the box should be relocated within a week after the assessment.",
      },
      {
        author: JAMES,
        at: "2026-03-24T15:13:00-04:00",
        body:
          "two new issues with the fiber boxes and need one box raised in one box lowered to meet the top of the new Sidewalk per ADA. The city is requesting that we go around the other side of the telephone pole. Due to the fact there are waterline valves that they do not want in the Sidewalk therefore we are going to go between the telephone pole and the curb. We got a variance, but we need that box raised the next box. We need lowered closest one to Laray and Florida entrance and the first box they relocated for us near the intersection of a Florida and Hudgins Drive has settled substantially and is not level. Please let us know when you will have these boxes adjusted so we can complete our sidewalk.",
      },
    ],
  },

  // ── DRAFT (unnumbered) ───────────────────────────────────────────────────
  {
    rfi_number: null,
    subject: "Assessment of Huntley Court Storm Drainage",
    status: "draft",
    responsibleCompany: null,
    receivedFrom: null,
    manager: JAMES,
    assignees: [],
    ballInCourt: JAMES,
    initiatedAt: "2025-11-12T22:02:00-05:00",
    dueDate: null,
    closedDate: null,
    subJob: "Course of Construction",
    distribution: [
      TIM,
      { firstName: "Oscar", lastName: "Macció" },
      { firstName: "Tony", lastName: "Humphrey" },
      ADAM,
      KENNY,
      { firstName: "Meredith", lastName: "Daye" },
      { firstName: "Scott", lastName: "Andrews" },
      JAMES,
      PETE,
      { firstName: "Jeffrey", lastName: "Oates" },
    ],
    createdBy: KENNY,
    question:
      "Per our recent discussions during the most recent OEC meeting regarding the storm drainage system on Huntley Court, GHA understands that Hamel Builders, Inc. will assess the following:\n- The drainage capacity of the existing sewer line\n- The integrity and connections of the installed joints\n- Any potential impacts to adjacent utilities based on their current installed elevations\nThis assessment should include Hamel's proposed approach for proceeding with work in this area.\nGHA is formally requesting feedback on Hamel's intended work activities on Huntley Court. If Hamel proposes to retain all currently installed storm structures and piping, then Timmons Group must review and approve the proposed plan. Upon approval, both parties—Timmons Group and Hamel Builders, Inc.—shall certify via executed company letterhead that the system will function in accordance with the original design intent and specifications.\nAs work progresses, please ensure that:\n- All connections and installations comply with City of Greensboro and NCDOT standards\n- All connections are inspected and approved prior to backfilling to confirm proper installation\nWe appreciate your prompt attention to this matter and look forward to your response.",
    responses: [],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Seed
// ─────────────────────────────────────────────────────────────────────────────

// Default to the live Arbors at South Crossing project UUID. Override with
// PROJECT_ID=<uuid> npm run seed:arbors-rfis  or  npm run seed:arbors-rfis -- <uuid>
const DEFAULT_PROJECT_ID = "39f3f9ca-8899-4b8d-88cc-3df490a27d6c";

async function findProject(): Promise<{ id: string; name: string; company_id: string | null }> {
  const cliArg = process.argv[2];
  const projectId = cliArg || process.env.PROJECT_ID || DEFAULT_PROJECT_ID;

  const { data, error } = await supabase
    .from("projects")
    .select("id, name, company_id")
    .eq("id", projectId)
    .maybeSingle();
  if (error) throw new Error(`Project lookup failed: ${error.message}`);
  if (!data) {
    throw new Error(`No project found with id ${projectId}. Pass a different id via PROJECT_ID=<uuid> or as a CLI argument.`);
  }
  return data as { id: string; name: string; company_id: string | null };
}

async function ensureContacts(projectId: string): Promise<Map<string, ContactRow>> {
  const { data: existing, error } = await supabase
    .from("directory_contacts")
    .select("id, first_name, last_name, email, company, type")
    .eq("project_id", projectId);
  if (error) throw new Error(`Directory lookup failed: ${error.message}`);

  const byKey = new Map<string, ContactRow>();
  for (const row of existing ?? []) {
    if (row.type !== "user") continue;
    byKey.set(CONTACT_KEY(row.first_name ?? "", row.last_name ?? ""), row as ContactRow);
  }

  for (const seed of CONTACTS) {
    const key = CONTACT_KEY(seed.firstName, seed.lastName);
    if (byKey.has(key)) continue;
    const { data: inserted, error: insertErr } = await supabase
      .from("directory_contacts")
      .insert({
        project_id: projectId,
        type: "user",
        first_name: seed.firstName,
        last_name: seed.lastName,
        company: seed.company,
        permission: seed.permission,
      })
      .select("id, first_name, last_name, email, company")
      .single();
    if (insertErr) throw new Error(`Failed to create contact ${seed.firstName} ${seed.lastName}: ${insertErr.message}`);
    byKey.set(key, inserted as ContactRow);
    console.log(`  + created directory contact: ${seed.firstName} ${seed.lastName} (${seed.company})`);
  }

  return byKey;
}

function contactFor(map: Map<string, ContactRow>, person: Person): ContactRow {
  const row = map.get(CONTACT_KEY(person.firstName, person.lastName));
  if (!row) throw new Error(`Missing contact: ${person.firstName} ${person.lastName}`);
  return row;
}

function fullName(person: Person): string {
  return `${person.firstName} ${person.lastName}`.trim();
}

function dirContactJson(map: Map<string, ContactRow>, person: Person): { id: string; name: string; email: string | null } {
  const row = contactFor(map, person);
  return { id: row.id, name: fullName(person), email: row.email };
}

async function findResponsibleContractorId(projectId: string, companyName: string | null): Promise<string | null> {
  if (!companyName) return null;
  const { data } = await supabase
    .from("directory_contacts")
    .select("id, company, type")
    .eq("project_id", projectId)
    .eq("type", "company")
    .ilike("company", companyName);
  if (data && data[0]) return data[0].id as string;

  // No company-typed contact for this responsible org — fall back to creating one
  // so the RFI's "Responsible Contractor" pointer resolves.
  const { data: inserted, error } = await supabase
    .from("directory_contacts")
    .insert({
      project_id: projectId,
      type: "company",
      company: companyName,
    })
    .select("id")
    .single();
  if (error) {
    console.warn(`  ! Could not create company contact "${companyName}": ${error.message}`);
    return null;
  }
  console.log(`  + created company contact: ${companyName}`);
  return inserted.id as string;
}

async function deleteExistingRfi(projectId: string, rfi_number: number | null, subject: string) {
  if (rfi_number !== null) {
    const { data: existing } = await supabase
      .from("rfis")
      .select("id")
      .eq("project_id", projectId)
      .eq("rfi_number", rfi_number);
    for (const r of existing ?? []) {
      await supabase.from("rfis").delete().eq("id", r.id);
    }
    return;
  }
  // Draft (unnumbered) — match by subject.
  const { data: existing } = await supabase
    .from("rfis")
    .select("id")
    .eq("project_id", projectId)
    .eq("subject", subject)
    .is("rfi_number", null as unknown as number);
  for (const r of existing ?? []) {
    await supabase.from("rfis").delete().eq("id", r.id);
  }
}

async function nextDraftRfiNumber(projectId: string): Promise<number> {
  const { data } = await supabase
    .from("rfis")
    .select("rfi_number")
    .eq("project_id", projectId)
    .order("rfi_number", { ascending: false })
    .limit(1);
  const max = data?.[0]?.rfi_number ?? 0;
  return max + 1;
}

async function insertRfi(
  projectId: string,
  seed: RfiSeed,
  contacts: Map<string, ContactRow>,
  responsibleContractorId: string | null,
  createdByUserId: string | null,
): Promise<string> {
  const rfiId = randomUUID();
  const distribution = seed.distribution.map((p) => dirContactJson(contacts, p));
  const assignees = seed.assignees.map((p) => dirContactJson(contacts, p));

  // For a Draft without a numbered RFI, still assign a unique number — the
  // schema requires NOT NULL. (The list view will still render it under the
  // "Draft" status pill.)
  const rfi_number = seed.rfi_number ?? (await nextDraftRfiNumber(projectId));

  const attachmentsJson = (seed.attachments ?? []).map((name) => ({
    name,
    url: "",
    placeholder: true,
  }));

  const insertRow = {
    id: rfiId,
    project_id: projectId,
    rfi_number,
    subject: seed.subject,
    question: seed.question,
    due_date: seed.dueDate,
    status: seed.status,
    rfi_manager_id: contactFor(contacts, seed.manager).id,
    received_from_id: seed.receivedFrom ? contactFor(contacts, seed.receivedFrom).id : null,
    assignees,
    distribution_list: distribution,
    responsible_contractor_id: responsibleContractorId,
    assignee_id: seed.assignees[0] ? contactFor(contacts, seed.assignees[0]).id : null,
    ball_in_court_id: seed.ballInCourt ? contactFor(contacts, seed.ballInCourt).id : null,
    schedule_impact: seed.scheduleImpact ?? null,
    cost_impact: seed.costImpact ?? null,
    cost_code: seed.costCode ?? null,
    sub_job: seed.subJob ?? null,
    rfi_stage: seed.rfiStage ?? null,
    private: seed.private ?? false,
    attachments: attachmentsJson,
    created_by: createdByUserId,
    created_at: seed.initiatedAt,
  };

  const { error } = await supabase.from("rfis").insert(insertRow);
  if (error) throw new Error(`RFI #${seed.rfi_number ?? "(draft)"} insert failed: ${error.message}`);
  return rfiId;
}

async function insertResponses(
  rfiId: string,
  seed: RfiSeed,
  contacts: Map<string, ContactRow>,
  usersByContactKey: Map<string, string>,
): Promise<{ id: string; author: Person; at: string }[]> {
  const inserted: { id: string; author: Person; at: string }[] = [];
  for (const resp of seed.responses) {
    const id = randomUUID();
    const authorKey = CONTACT_KEY(resp.author.firstName, resp.author.lastName);
    const created_by = usersByContactKey.get(authorKey) ?? null;
    const { error } = await supabase.from("rfi_responses").insert({
      id,
      rfi_id: rfiId,
      body: resp.body,
      created_by,
      created_at: resp.at,
      attachments: [],
    });
    if (error) throw new Error(`Response insert failed: ${error.message}`);
    inserted.push({ id, author: resp.author, at: resp.at });
  }
  return inserted;
}

async function insertChangeHistory(
  rfiId: string,
  projectId: string,
  seed: RfiSeed,
  contacts: Map<string, ContactRow>,
  usersByContactKey: Map<string, string>,
  responses: { id: string; author: Person; at: string }[],
) {
  const rows: Array<{
    action: string;
    from_value: string | null;
    to_value: string | null;
    changed_by: string | null;
    changed_by_name: string;
    changed_by_company: string | null;
    created_at: string;
  }> = [];

  const creatorKey = CONTACT_KEY(seed.createdBy.firstName, seed.createdBy.lastName);
  const creatorContact = contacts.get(creatorKey);
  const creatorUserId = usersByContactKey.get(creatorKey) ?? null;
  const creatorName = fullName(seed.createdBy);
  const creatorCompany = creatorContact?.company ?? null;

  const push = (
    when: string,
    action: string,
    from_value: string | null,
    to_value: string | null,
    actor?: Person,
  ) => {
    const actorPerson = actor ?? seed.createdBy;
    const actorKey = CONTACT_KEY(actorPerson.firstName, actorPerson.lastName);
    const actorContact = contacts.get(actorKey);
    rows.push({
      action,
      from_value,
      to_value,
      changed_by: usersByContactKey.get(actorKey) ?? null,
      changed_by_name: fullName(actorPerson),
      changed_by_company: actorContact?.company ?? null,
      created_at: when,
    });
  };

  // Mirrors the history rows the POST /rfis route emits on creation.
  push(seed.initiatedAt, "Created RFI", null, `RFI #${seed.rfi_number ?? "(draft)"}`);
  push(seed.initiatedAt, "RFI Number", "", String(seed.rfi_number ?? ""));
  push(seed.initiatedAt, "Subject", "", seed.subject);
  push(seed.initiatedAt, "Question", "", "Updated");
  push(seed.initiatedAt, "Due Date", "", seed.dueDate ?? "");
  push(seed.initiatedAt, "Status", "", seed.status === "draft" ? "draft" : "open");
  push(seed.initiatedAt, "RFI Manager", "", fullName(seed.manager));
  if (seed.receivedFrom) push(seed.initiatedAt, "Received From", "", fullName(seed.receivedFrom));
  if (seed.responsibleCompany) push(seed.initiatedAt, "Responsible Contractor", "", seed.responsibleCompany);
  if (seed.scheduleImpact) push(seed.initiatedAt, "Schedule Impact", "", seed.scheduleImpact);
  if (seed.costImpact) push(seed.initiatedAt, "Cost Impact", "", seed.costImpact);
  if (seed.costCode) push(seed.initiatedAt, "Cost Code", "", seed.costCode);
  if (seed.subJob) push(seed.initiatedAt, "Sub Job", "", seed.subJob);
  push(seed.initiatedAt, "Private", "", seed.private ? "Yes" : "No");

  for (const a of seed.assignees) push(seed.initiatedAt, "Added Assignee", "", fullName(a));
  for (const d of seed.distribution) push(seed.initiatedAt, "Added Distribution Member", "", fullName(d));
  for (const name of seed.attachments ?? []) push(seed.initiatedAt, "Attachment Added", "", name);
  if (seed.ballInCourt) push(seed.initiatedAt, "Ball In Court", "", fullName(seed.ballInCourt));

  // Responses
  responses.forEach((r, idx) => {
    push(r.at, `Added Response #${idx + 1}`, null, "Updated", r.author);
  });

  // Status → closed (with actor = creator/manager as best guess)
  if (seed.status === "closed" && seed.closedDate) {
    // Use noon local time on the closed date; no timezone info in the PDF.
    push(`${seed.closedDate}T12:00:00-04:00`, "Status", "Open", "Closed", seed.manager);
  }

  // Bulk insert
  const inserts = rows.map((r) => ({
    rfi_id: rfiId,
    project_id: projectId,
    changed_by: r.changed_by,
    changed_by_name: r.changed_by_name,
    changed_by_company: r.changed_by_company,
    action: r.action,
    from_value: r.from_value,
    to_value: r.to_value,
    created_at: r.created_at,
  }));

  // Single insert with a large array
  const { error } = await supabase.from("rfi_change_history").insert(inserts);
  if (error) throw new Error(`History insert failed: ${error.message}`);

  // Suppress unused vars (defensive — creatorUserId/creatorName/creatorCompany are
  // intentionally derived as fallbacks but not always pushed).
  void creatorUserId;
  void creatorName;
  void creatorCompany;
}

async function buildUserLookup(): Promise<Map<string, string>> {
  // Best-effort: match contacts to platform users via email (preferred) or
  // exact concatenated name. Anything unmatched stays null on the inserted rows.
  const map = new Map<string, string>();
  for (const seed of CONTACTS) {
    const { data } = await supabase
      .from("users")
      .select("id, username, email")
      .eq("username", `${seed.firstName} ${seed.lastName}`)
      .maybeSingle();
    if (data?.id) map.set(CONTACT_KEY(seed.firstName, seed.lastName), data.id);
  }
  return map;
}

async function main() {
  console.log("Seeding Arbors at South Crossing RFIs...\n");

  const project = await findProject();
  console.log(`Project: ${project.name} (${project.id})\n`);

  console.log("Ensuring directory contacts...");
  const contacts = await ensureContacts(project.id);
  console.log(`  ${contacts.size} contacts ready.\n`);

  console.log("Resolving platform users for change-history attribution...");
  const usersByContactKey = await buildUserLookup();
  console.log(`  ${usersByContactKey.size} contacts matched to users.\n`);

  // Cache responsible-contractor company contact lookups so we don't re-query
  // for every RFI that points at the same company.
  const responsibleCache = new Map<string, string | null>();

  for (const seed of RFIS) {
    const label = seed.rfi_number !== null ? `RFI #${seed.rfi_number}` : `Draft RFI`;
    console.log(`${label}: ${seed.subject}`);
    await deleteExistingRfi(project.id, seed.rfi_number, seed.subject);

    let responsibleContractorId: string | null = null;
    if (seed.responsibleCompany) {
      if (!responsibleCache.has(seed.responsibleCompany)) {
        responsibleCache.set(
          seed.responsibleCompany,
          await findResponsibleContractorId(project.id, seed.responsibleCompany),
        );
      }
      responsibleContractorId = responsibleCache.get(seed.responsibleCompany) ?? null;
    }

    const creatorKey = CONTACT_KEY(seed.createdBy.firstName, seed.createdBy.lastName);
    const createdByUserId = usersByContactKey.get(creatorKey) ?? null;

    const rfiId = await insertRfi(project.id, seed, contacts, responsibleContractorId, createdByUserId);
    const inserted = await insertResponses(rfiId, seed, contacts, usersByContactKey);

    // Stamp official_response_id on closed RFIs to the last admin/timmons
    // response (best guess: the final response is usually the resolver).
    if (seed.status === "closed" && inserted.length > 0) {
      const last = inserted[inserted.length - 1];
      await supabase.from("rfis").update({ official_response_id: last.id }).eq("id", rfiId);
    }

    await insertChangeHistory(rfiId, project.id, seed, contacts, usersByContactKey, inserted);
    console.log(`  → id=${rfiId}, ${inserted.length} responses + change history written.`);
  }

  // ── Verification: re-fetch what's actually in the DB so we can confirm the
  //    rows landed under the expected project and would be returned by the
  //    same query the RFI list page runs.
  const { data: verifyRows, error: verifyErr } = await supabase
    .from("rfis")
    .select("id, rfi_number, subject, status, is_deleted, project_id")
    .eq("project_id", project.id)
    .or("is_deleted.is.null,is_deleted.eq.false")
    .order("rfi_number", { ascending: true });
  if (verifyErr) {
    console.warn(`\nVerification query failed: ${verifyErr.message}`);
  } else {
    console.log(`\nVerification: ${verifyRows?.length ?? 0} RFI rows visible to the list query for project ${project.id}:`);
    for (const r of verifyRows ?? []) {
      console.log(`  #${r.rfi_number} [${r.status}] ${r.subject}`);
    }
  }

  console.log("\nDone.");
}

main().catch((err) => {
  console.error("\nSeed failed:", err);
  process.exit(1);
});
