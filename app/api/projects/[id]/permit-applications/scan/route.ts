import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";
import { requireToolLevel } from "@/lib/tool-permissions";
import {
  extractAcroFields,
  scanPermitApplication,
  type PermitProjectContext,
} from "@/lib/permit-application-processor";

export const runtime = "nodejs";
export const maxDuration = 60;

type SessionLike = { id: string; username?: string; email?: string };

// Gathers the project data Gemini searches when proposing field values.
async function buildProjectContext(
  projectId: string,
  session: SessionLike,
): Promise<PermitProjectContext> {
  const supabase = getSupabase();

  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .maybeSingle();

  let companyName = "";
  if (project?.company_id) {
    const { data: company } = await supabase
      .from("companies")
      .select("name")
      .eq("id", project.company_id)
      .maybeSingle();
    companyName = company?.name ?? "";
  }

  const { data: contacts } = await supabase
    .from("directory_contacts")
    .select(
      "id, type, first_name, last_name, email, phone, business_phone, company, job_title, address, license_number, city, state, zip",
    )
    .eq("project_id", projectId)
    .limit(80);

  const roles = (project?.project_roles ?? {}) as Record<string, string[]>;
  const contactRoles: Record<string, string[]> = {};
  for (const [roleName, ids] of Object.entries(roles)) {
    if (!Array.isArray(ids)) continue;
    for (const cid of ids) {
      (contactRoles[cid] ??= []).push(roleName);
    }
  }

  const directory = (contacts ?? [])
    .map((c) => {
      const name =
        c.type === "company"
          ? c.company || ""
          : [c.first_name, c.last_name].filter(Boolean).join(" ").trim();
      return {
        name,
        email: c.email || "",
        phone: c.phone || c.business_phone || "",
        company: c.company || "",
        jobTitle: c.job_title || "",
        address: c.address || "",
        city: c.city || "",
        state: c.state || "",
        zip: c.zip || "",
        licenseNumber: c.license_number || "",
        projectRoles: contactRoles[c.id] ?? [],
      };
    })
    .filter((c) => c.name || c.email);

  return {
    project: {
      name: project?.name ?? "",
      description: project?.description ?? "",
      address: project?.address ?? "",
      city: project?.city ?? "",
      state: project?.state ?? "",
      zipCode: project?.zip_code ?? "",
      county: project?.county ?? "",
      projectNumber: project?.project_number ?? "",
      sector: project?.sector ?? "",
      estimatedValue: project?.value ?? null,
      startDate: project?.start_date ?? project?.actual_start_date ?? "",
      completionDate: project?.completion_date ?? project?.projected_finish_date ?? "",
    },
    company: { name: companyName },
    applicant: { name: session.username ?? "", email: session.email ?? "" },
    projectManagers: directory.filter((d) => d.projectRoles.includes("Project Manager")),
    directory,
  };
}

// Accepts a blank permit application PDF (multipart form field "file"),
// reads any AcroForm fields, gathers project data, and asks Gemini to
// detect the fillable fields and propose a value for each. Returns the
// field list for the user to review — nothing is persisted here.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;

  const denied = await requireToolLevel(session, projectId, "permit-applications", "standard");
  if (denied) return denied;

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (file.type && file.type !== "application/pdf") {
    return NextResponse.json({ error: "Only PDF files are supported" }, { status: 400 });
  }

  const sourceBuffer = Buffer.from(await file.arrayBuffer());
  const acroFields = await extractAcroFields(sourceBuffer);
  const context = await buildProjectContext(projectId, session);

  try {
    const fields = await scanPermitApplication(sourceBuffer, file.name, acroFields, context);
    return NextResponse.json({
      fields,
      hasAcroForm: acroFields.length > 0,
      sourceFilename: file.name,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to scan permit application";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
