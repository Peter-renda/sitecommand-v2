/**
 * Seed the 3 Arbors at South Crossing submittals (recreated from the
 * exported Procore PDFs):
 *
 *   1. 331000 - Exterior Water System → "Domestic Ductile Iron MJ Compact Fittings"
 *   2. 334100 - Storm Drainage        → "Storm & Sewer structures"
 *   3. (no spec)                       → "Fence for retaining wall"
 *
 * Each row writes:
 *   - the submittal core fields (status, dates, type, description, etc.)
 *   - the responsible contractor / received-from / approver / distribution
 *     pointers (resolved through directory_contacts)
 *   - the workflow_steps JSONB with each Procore approver row
 *     (sent/due/returned/response/attachments)
 *   - placeholder attachments (filenames only — no real upload here)
 *
 * HOW TO RUN:
 *   1. .env.local (or environment) must contain:
 *        NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
 *        SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
 *
 *   2. From the project root:
 *        npm run seed:arbors-submittals
 *
 * The script is idempotent: it matches existing submittals on
 * (project_id, title) and deletes them before re-inserting.
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

const DEFAULT_PROJECT_ID = "39f3f9ca-8899-4b8d-88cc-3df490a27d6c";

// ─────────────────────────────────────────────────────────────────────────────
// Contact roster (extends the RFI roster with Brandon Lamberth)
// ─────────────────────────────────────────────────────────────────────────────

type Person = { firstName: string; lastName: string };

type ContactSeed = Person & { company: string; permission: string };

const CONTACTS: ContactSeed[] = [
  { firstName: "Pete", lastName: "Renda", company: "Hamel Builders, Inc.", permission: "Company Employee" },
  { firstName: "James", lastName: "Schuster", company: "Hamel Builders, Inc.", permission: "Company Employee" },
  { firstName: "Tim", lastName: "Parry", company: "Hamel Builders, Inc.", permission: "Company Employee" },
  { firstName: "Adam", lastName: "Carroll", company: "Timmons Group", permission: "Architect/Engineer" },
  { firstName: "Tony", lastName: "Humphrey", company: "Greensboro Housing Authority", permission: "Owner/Client" },
  { firstName: "Kenneth", lastName: "Parks II", company: "Greensboro Housing Authority", permission: "Owner/Client" },
  { firstName: "Meredith", lastName: "Daye", company: "Greensboro Housing Authority", permission: "Owner/Client" },
  { firstName: "Drew", lastName: "Culler", company: "Smith & Jennings, Inc.", permission: "Subcontractor" },
  { firstName: "Charles", lastName: "Smith", company: "Smith & Jennings, Inc.", permission: "Subcontractor" },
  { firstName: "Malaki", lastName: "Moore", company: "C2 Contractors, LLC", permission: "Subcontractor" },
  { firstName: "Brandon", lastName: "Lamberth", company: "C2 Contractors, LLC", permission: "Subcontractor" },
];

type ContactRow = { id: string; first_name: string | null; last_name: string | null; email: string | null; company: string | null };

const CONTACT_KEY = (firstName: string, lastName: string) =>
  `${firstName.trim().toLowerCase()}|${lastName.trim().toLowerCase()}`;

const fullName = (p: Person) => `${p.firstName} ${p.lastName}`.trim();

// ─────────────────────────────────────────────────────────────────────────────
// Specifications referenced by the submittals
// ─────────────────────────────────────────────────────────────────────────────

type SpecSeed = { code: string; name: string };

const SPECS: SpecSeed[] = [
  { code: "331000", name: "Exterior Water System" },
  { code: "334100", name: "Storm Drainage" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Submittal seed data (mirrors the three Procore PDFs)
// ─────────────────────────────────────────────────────────────────────────────

type WorkflowStepSeed = {
  step: number;
  person: Person;
  role: "Submitter" | "Approver";
  required?: boolean;
  sent_date?: string | null;
  due_date?: string | null;
  returned_date?: string | null;
  response?: string | null;
  comments?: string | null;
  attachments?: string[];
};

type SubmittalSeed = {
  title: string;
  spec?: SpecSeed | null;
  status:
    | "open"
    | "closed"
    | "draft"
    | "approved"
    | "approved_as_noted"
    | "revise_and_resubmit"
    | "rejected"
    | "for_the_record"
    | "make_corrections"
    | "no_exceptions_taken";
  revision: string;
  submittal_type: string | null;
  responsibleCompany: string | null;
  receivedFrom: Person | null;
  receivedDate: string | null; // YYYY-MM-DD
  submitBy: string | null;
  issueDate: string | null;
  finalDueDate: string | null;
  approvers: Person[];
  ballInCourt: Person | null;
  distribution: Person[];
  distributedAt?: string | null;
  distributedBy?: Person | null;
  description?: string | null;
  attachments: string[];
  workflow: WorkflowStepSeed[];
  /** ISO timestamp used for created_at. */
  createdAt: string;
  /** ISO timestamp the submittal was closed (if status closed-like). */
  closedAt?: string | null;
  createdBy: Person;
};

const PETE: Person = { firstName: "Pete", lastName: "Renda" };
const JAMES: Person = { firstName: "James", lastName: "Schuster" };
const TIM: Person = { firstName: "Tim", lastName: "Parry" };
const ADAM: Person = { firstName: "Adam", lastName: "Carroll" };
const TONY: Person = { firstName: "Tony", lastName: "Humphrey" };
const KENNY: Person = { firstName: "Kenneth", lastName: "Parks II" };
const MEREDITH: Person = { firstName: "Meredith", lastName: "Daye" };
const DREW: Person = { firstName: "Drew", lastName: "Culler" };
const CHARLES: Person = { firstName: "Charles", lastName: "Smith" };
const MALAKI: Person = { firstName: "Malaki", lastName: "Moore" };
const BRANDON: Person = { firstName: "Brandon", lastName: "Lamberth" };

const SUBMITTALS: SubmittalSeed[] = [
  // ── Submittal #1: 331000-1.0 Domestic Ductile Iron MJ Compact Fittings ──
  {
    title: "Domestic Ductile Iron MJ Compact Fittings",
    spec: { code: "331000", name: "Exterior Water System" },
    status: "approved_as_noted",
    revision: "0",
    submittal_type: "Product Information",
    responsibleCompany: "Smith & Jennings, Inc.",
    receivedFrom: DREW,
    receivedDate: "2025-10-17",
    submitBy: "2025-10-21",
    issueDate: "2025-10-22",
    finalDueDate: "2025-10-24",
    approvers: [JAMES, ADAM],
    ballInCourt: null,
    distribution: [CHARLES, DREW, KENNY, MEREDITH, PETE, TIM, TONY],
    description: "Domestic Ductile Iron MJ Compact Fittings",
    attachments: ["Domestic Ductile Iron MJ Compact Fittings.pdf"],
    workflow: [
      {
        step: 1,
        person: JAMES,
        role: "Approver",
        required: true,
        sent_date: "2025-10-22",
        due_date: "2025-10-22",
        returned_date: "2025-10-22",
        response: "Approved",
        attachments: [
          "the_arbors_at_south_crossing-submittal#1-rev-0-domestic_ductile_iron_mj_compac-202510221539.pdf",
        ],
      },
      {
        step: 2,
        person: ADAM,
        role: "Approver",
        required: true,
        sent_date: "2025-10-22",
        due_date: "2025-10-24",
        returned_date: "2025-10-28",
        response: "Approved as Noted",
        attachments: [
          "the_arbors_at_south_crossing-submittal1-rev-0-2025.10.21_TG Reviewed.pdf",
        ],
      },
    ],
    createdAt: "2025-10-22T09:00:00-04:00",
    closedAt: "2025-10-28T12:00:00-04:00",
    createdBy: JAMES,
  },

  // ── Submittal #2: 334100-1.0 Storm & Sewer structures ───────────────────
  {
    title: "Storm & Sewer structures",
    spec: { code: "334100", name: "Storm Drainage" },
    status: "approved_as_noted",
    revision: "0",
    submittal_type: "Shop Drawing",
    responsibleCompany: "Smith & Jennings, Inc.",
    receivedFrom: DREW,
    receivedDate: "2025-06-02",
    submitBy: null,
    issueDate: "2025-06-03",
    finalDueDate: "2025-06-17",
    approvers: [ADAM],
    ballInCourt: null,
    distribution: [TIM, ADAM, DREW, KENNY, MEREDITH, JAMES, MALAKI],
    distributedAt: "2025-06-17T09:00:00-04:00",
    distributedBy: JAMES,
    description: "Approved as noted",
    attachments: [
      "Submittal Package 3 -Arbors at South Crossing Ph 1 storm and sewer structures_TG Reviewed.pdf",
    ],
    workflow: [
      {
        step: 1,
        person: ADAM,
        role: "Approver",
        required: true,
        sent_date: "2025-06-03",
        due_date: "2025-06-17",
        returned_date: "2025-06-16",
        response: "Approved as Noted",
        attachments: [
          "Submittal Package 3 -Arbors at South Crossing Ph 1 storm and sewer structures_TG Reviewed.pdf",
        ],
      },
    ],
    createdAt: "2025-06-03T09:00:00-04:00",
    closedAt: "2025-06-17T12:00:00-04:00",
    createdBy: JAMES,
  },

  // ── Submittal #3: 9.0 Fence for retaining wall ──────────────────────────
  {
    title: "Fence for retaining wall",
    spec: null,
    status: "approved",
    revision: "0",
    submittal_type: null,
    responsibleCompany: "C2 Contractors, LLC",
    receivedFrom: null,
    receivedDate: "2026-04-23",
    submitBy: null,
    issueDate: "2026-04-23",
    finalDueDate: "2026-04-30",
    approvers: [ADAM],
    ballInCourt: null,
    distribution: [JAMES, TIM, KENNY, MEREDITH, TONY, BRANDON],
    description: "Hi Adam, Please see fence submittal.",
    attachments: ["Maverick_Ultra_Fence_Spec_Sheet.pdf"],
    workflow: [
      {
        step: 1,
        person: ADAM,
        role: "Approver",
        required: true,
        sent_date: "2026-04-23",
        due_date: "2026-04-30",
        returned_date: "2026-05-01",
        response: "Approved",
        attachments: ["Maverick_Ultra_Fence_Spec_Sheet_TG Reviewed.pdf"],
      },
    ],
    createdAt: "2026-04-23T09:00:00-04:00",
    closedAt: "2026-05-01T12:00:00-04:00",
    createdBy: PETE,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function findProject(): Promise<{ id: string; name: string }> {
  const cliArg = process.argv[2];
  const projectId = cliArg || process.env.PROJECT_ID || DEFAULT_PROJECT_ID;
  const { data, error } = await supabase
    .from("projects")
    .select("id, name")
    .eq("id", projectId)
    .maybeSingle();
  if (error) throw new Error(`Project lookup failed: ${error.message}`);
  if (!data) throw new Error(`No project found with id ${projectId}.`);
  return data as { id: string; name: string };
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
    if (insertErr) throw new Error(`Create contact ${seed.firstName} ${seed.lastName} failed: ${insertErr.message}`);
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

function dirContactJson(map: Map<string, ContactRow>, person: Person) {
  const row = contactFor(map, person);
  return { id: row.id, name: fullName(person), email: row.email };
}

async function findOrCreateCompanyContact(projectId: string, companyName: string | null): Promise<string | null> {
  if (!companyName) return null;
  const { data } = await supabase
    .from("directory_contacts")
    .select("id, company, type")
    .eq("project_id", projectId)
    .eq("type", "company")
    .ilike("company", companyName);
  if (data && data[0]) return data[0].id as string;

  const { data: inserted, error } = await supabase
    .from("directory_contacts")
    .insert({ project_id: projectId, type: "company", company: companyName })
    .select("id")
    .single();
  if (error) {
    console.warn(`  ! Could not create company contact "${companyName}": ${error.message}`);
    return null;
  }
  console.log(`  + created company contact: ${companyName}`);
  return inserted.id as string;
}

async function ensureSpecifications(projectId: string): Promise<Map<string, string>> {
  const codeToId = new Map<string, string>();
  const { data: existing } = await supabase
    .from("project_specifications")
    .select("id, code, name")
    .eq("project_id", projectId);
  for (const row of existing ?? []) {
    if (row.code) codeToId.set(row.code, row.id as string);
  }

  for (const spec of SPECS) {
    if (codeToId.has(spec.code)) continue;
    const { data: inserted, error } = await supabase
      .from("project_specifications")
      .insert({ project_id: projectId, code: spec.code, name: spec.name })
      .select("id")
      .single();
    if (error) throw new Error(`Spec ${spec.code} insert failed: ${error.message}`);
    codeToId.set(spec.code, inserted.id as string);
    console.log(`  + created spec: ${spec.code} - ${spec.name}`);
  }

  return codeToId;
}

async function nextSubmittalNumber(projectId: string): Promise<number> {
  const { data } = await supabase
    .from("submittals")
    .select("submittal_number")
    .eq("project_id", projectId)
    .order("submittal_number", { ascending: false })
    .limit(1);
  return ((data?.[0]?.submittal_number as number | undefined) ?? 0) + 1;
}

async function deleteExistingByTitle(projectId: string, title: string) {
  const { data } = await supabase
    .from("submittals")
    .select("id")
    .eq("project_id", projectId)
    .eq("title", title);
  for (const row of data ?? []) {
    await supabase.from("submittals").delete().eq("id", row.id);
  }
}

async function buildUserLookup(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (const seed of CONTACTS) {
    const { data } = await supabase
      .from("users")
      .select("id, username")
      .eq("username", `${seed.firstName} ${seed.lastName}`)
      .maybeSingle();
    if (data?.id) map.set(CONTACT_KEY(seed.firstName, seed.lastName), data.id);
  }
  return map;
}

function buildWorkflowSteps(
  seed: SubmittalSeed,
  contacts: Map<string, ContactRow>,
): Array<Record<string, unknown>> {
  return seed.workflow.map((step) => ({
    step: step.step,
    person_id: contactFor(contacts, step.person).id,
    role: step.role,
    required: step.required ?? true,
    sent_date: step.sent_date ?? null,
    due_date: step.due_date ?? null,
    returned_date: step.returned_date ?? null,
    response: step.response ?? null,
    comments: step.comments ?? null,
    attachments: (step.attachments ?? []).map((name) => ({ name, url: "", placeholder: true })),
  }));
}

async function insertSubmittal(
  projectId: string,
  seed: SubmittalSeed,
  contacts: Map<string, ContactRow>,
  specs: Map<string, string>,
  responsibleContractorId: string | null,
  createdByUserId: string | null,
  distributedByUserId: string | null,
  number: number,
): Promise<string> {
  const id = randomUUID();
  const distribution = seed.distribution.map((p) => dirContactJson(contacts, p));
  const attachments = seed.attachments.map((name) => ({ name, url: "", placeholder: true }));
  const workflow_steps = buildWorkflowSteps(seed, contacts);
  const approverId = seed.approvers[0] ? contactFor(contacts, seed.approvers[0]).id : null;
  const ballInCourtId = seed.ballInCourt ? contactFor(contacts, seed.ballInCourt).id : null;

  const row = {
    id,
    project_id: projectId,
    submittal_number: number,
    revision: seed.revision,
    title: seed.title,
    specification_id: seed.spec ? specs.get(seed.spec.code) ?? null : null,
    submittal_type: seed.submittal_type,
    status: seed.status,
    responsible_contractor_id: responsibleContractorId,
    received_from_id: seed.receivedFrom ? contactFor(contacts, seed.receivedFrom).id : null,
    submittal_manager_id: contactFor(contacts, seed.createdBy).id,
    approver_name_id: approverId,
    submit_by: seed.submitBy,
    received_date: seed.receivedDate,
    issue_date: seed.issueDate,
    final_due_date: seed.finalDueDate,
    distribution_list: distribution,
    ball_in_court_id: ballInCourtId,
    private: false,
    description: seed.description ?? null,
    attachments,
    workflow_steps,
    related_items: [],
    created_by: createdByUserId,
    created_at: seed.createdAt,
    closed_at: seed.closedAt ?? null,
    distributed_at: seed.distributedAt ?? null,
    distributed_by: distributedByUserId,
  };

  const { error } = await supabase.from("submittals").insert(row);
  if (error) throw new Error(`Submittal "${seed.title}" insert failed: ${error.message}`);
  return id;
}

async function insertChangeHistory(
  submittalId: string,
  projectId: string,
  seed: SubmittalSeed,
  contacts: Map<string, ContactRow>,
  usersByContactKey: Map<string, string>,
) {
  type Row = {
    action: string;
    from_value: string | null;
    to_value: string | null;
    changed_by: string | null;
    changed_by_name: string;
    changed_by_company: string | null;
    created_at: string;
  };
  const rows: Row[] = [];

  const push = (when: string, action: string, from: string | null, to: string | null, actor?: Person) => {
    const actorPerson = actor ?? seed.createdBy;
    const actorKey = CONTACT_KEY(actorPerson.firstName, actorPerson.lastName);
    const actorContact = contacts.get(actorKey);
    rows.push({
      action,
      from_value: from,
      to_value: to,
      changed_by: usersByContactKey.get(actorKey) ?? null,
      changed_by_name: fullName(actorPerson),
      changed_by_company: actorContact?.company ?? null,
      created_at: when,
    });
  };

  push(seed.createdAt, "Created Submittal", null, seed.title);
  push(seed.createdAt, "Title", "", seed.title);
  push(seed.createdAt, "Status", "", seed.status);
  push(seed.createdAt, "Revision", "", seed.revision);
  if (seed.spec) push(seed.createdAt, "Specification", "", `${seed.spec.code} - ${seed.spec.name}`);
  if (seed.submittal_type) push(seed.createdAt, "Type", "", seed.submittal_type);
  if (seed.responsibleCompany) push(seed.createdAt, "Responsible Contractor", "", seed.responsibleCompany);
  if (seed.receivedFrom) push(seed.createdAt, "Received From", "", fullName(seed.receivedFrom));
  if (seed.receivedDate) push(seed.createdAt, "Received Date", "", seed.receivedDate);
  if (seed.issueDate) push(seed.createdAt, "Issue Date", "", seed.issueDate);
  if (seed.finalDueDate) push(seed.createdAt, "Final Due Date", "", seed.finalDueDate);
  if (seed.description) push(seed.createdAt, "Description", "", "Updated");
  for (const a of seed.attachments) push(seed.createdAt, "Attachment Added", "", a);
  for (const d of seed.distribution) push(seed.createdAt, "Added Distribution Member", "", fullName(d));
  for (const step of seed.workflow) {
    push(seed.createdAt, "Workflow Step Added", "", `${step.role}: ${fullName(step.person)}`);
  }

  // Step responses (in chronological order by returned_date)
  for (const step of [...seed.workflow].sort((a, b) =>
    (a.returned_date ?? "").localeCompare(b.returned_date ?? ""),
  )) {
    if (!step.returned_date || !step.response) continue;
    push(
      `${step.returned_date}T12:00:00-04:00`,
      `Workflow Response`,
      null,
      `${fullName(step.person)}: ${step.response}`,
      step.person,
    );
  }

  if (seed.distributedAt && seed.distributedBy) {
    push(seed.distributedAt, "Distributed", null, fullName(seed.distributedBy), seed.distributedBy);
  }
  if (seed.closedAt) {
    push(seed.closedAt, "Status", "open", "closed", seed.createdBy);
  }

  const inserts = rows.map((r) => ({
    submittal_id: submittalId,
    project_id: projectId,
    changed_by: r.changed_by,
    changed_by_name: r.changed_by_name,
    changed_by_company: r.changed_by_company,
    action: r.action,
    from_value: r.from_value,
    to_value: r.to_value,
    created_at: r.created_at,
  }));

  const { error } = await supabase.from("submittal_change_history").insert(inserts);
  if (error) throw new Error(`History insert failed: ${error.message}`);
}

async function main() {
  console.log("Seeding Arbors at South Crossing submittals...\n");

  const project = await findProject();
  console.log(`Project: ${project.name} (${project.id})\n`);

  console.log("Ensuring directory contacts...");
  const contacts = await ensureContacts(project.id);
  console.log(`  ${contacts.size} contacts ready.\n`);

  console.log("Ensuring specifications...");
  const specs = await ensureSpecifications(project.id);
  console.log(`  ${specs.size} specs ready.\n`);

  console.log("Resolving platform users for change-history attribution...");
  const usersByContactKey = await buildUserLookup();
  console.log(`  ${usersByContactKey.size} contacts matched to users.\n`);

  const responsibleCache = new Map<string, string | null>();
  let nextNumber = await nextSubmittalNumber(project.id);

  for (const seed of SUBMITTALS) {
    console.log(`Submittal: ${seed.title}`);
    await deleteExistingByTitle(project.id, seed.title);

    let responsibleId: string | null = null;
    if (seed.responsibleCompany) {
      if (!responsibleCache.has(seed.responsibleCompany)) {
        responsibleCache.set(
          seed.responsibleCompany,
          await findOrCreateCompanyContact(project.id, seed.responsibleCompany),
        );
      }
      responsibleId = responsibleCache.get(seed.responsibleCompany) ?? null;
    }

    const createdByKey = CONTACT_KEY(seed.createdBy.firstName, seed.createdBy.lastName);
    const createdByUserId = usersByContactKey.get(createdByKey) ?? null;
    const distributedByUserId = seed.distributedBy
      ? usersByContactKey.get(CONTACT_KEY(seed.distributedBy.firstName, seed.distributedBy.lastName)) ?? null
      : null;

    const submittalId = await insertSubmittal(
      project.id,
      seed,
      contacts,
      specs,
      responsibleId,
      createdByUserId,
      distributedByUserId,
      nextNumber,
    );
    await insertChangeHistory(submittalId, project.id, seed, contacts, usersByContactKey);

    console.log(`  → id=${submittalId}, submittal_number=${nextNumber}`);
    nextNumber += 1;
  }

  const { data: verifyRows } = await supabase
    .from("submittals")
    .select("id, submittal_number, title, status, project_id")
    .eq("project_id", project.id)
    .or("is_deleted.is.null,is_deleted.eq.false")
    .order("submittal_number", { ascending: true });
  console.log(`\nVerification: ${verifyRows?.length ?? 0} submittals visible for project ${project.id}:`);
  for (const r of verifyRows ?? []) {
    console.log(`  #${r.submittal_number} [${r.status}] ${r.title}`);
  }

  console.log("\nDone.");
}

main().catch((err) => {
  console.error("\nSeed failed:", err);
  process.exit(1);
});
