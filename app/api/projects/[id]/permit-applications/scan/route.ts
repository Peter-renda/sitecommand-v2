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
export const maxDuration = 120;

type SessionLike = { id: string; username?: string; email?: string };

// Gathers the project data Gemini searches when proposing field values.
// In addition to project metadata + directory, we include recent RFIs,
// submittals, drawings, specifications, and daily log notes so Gemini can
// answer permit questions about scope of work, design references, etc.
async function buildProjectContext(
  projectId: string,
  session: SessionLike,
): Promise<PermitProjectContext> {
  const supabase = getSupabase();

  const [
    projectRes,
    contactsRes,
    rfisRes,
    submittalsRes,
    drawingsRes,
    specsRes,
    dailyLogsRes,
  ] = await Promise.all([
    supabase.from("projects").select("*").eq("id", projectId).maybeSingle(),
    supabase
      .from("directory_contacts")
      .select(
        "id, type, first_name, last_name, email, phone, business_phone, company, job_title, address, license_number, city, state, zip",
      )
      .eq("project_id", projectId)
      .limit(80),
    supabase
      .from("rfis")
      .select("rfi_number, subject, question, status, drawing_number")
      .eq("project_id", projectId)
      .or("is_deleted.is.null,is_deleted.eq.false")
      .order("rfi_number", { ascending: false })
      .limit(30),
    supabase
      .from("submittals")
      .select("submittal_number, title, status, description, submittal_type, cost_code")
      .eq("project_id", projectId)
      .or("is_deleted.is.null,is_deleted.eq.false")
      .order("submittal_number", { ascending: false })
      .limit(30),
    supabase
      .from("project_drawings")
      .select("drawing_no, title, revision, drawing_date")
      .eq("project_id", projectId)
      .order("drawing_no")
      .limit(60),
    supabase
      .from("project_specifications")
      .select("spec_number, title")
      .eq("project_id", projectId)
      .limit(60),
    supabase
      .from("daily_logs")
      .select("log_date, weather_conditions, notes, manpower")
      .eq("project_id", projectId)
      .order("log_date", { ascending: false })
      .limit(10),
  ]);

  const project = projectRes.data;

  let companyName = "";
  if (project?.company_id) {
    const { data: company } = await supabase
      .from("companies")
      .select("name")
      .eq("id", project.company_id)
      .maybeSingle();
    companyName = company?.name ?? "";
  }

  const roles = (project?.project_roles ?? {}) as Record<string, string[]>;
  const contactRoles: Record<string, string[]> = {};
  for (const [roleName, ids] of Object.entries(roles)) {
    if (!Array.isArray(ids)) continue;
    for (const cid of ids) {
      (contactRoles[cid] ??= []).push(roleName);
    }
  }

  const directory = (contactsRes.data ?? [])
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

  const rfis = (rfisRes.data ?? []).map((r) => ({
    number: r.rfi_number,
    subject: r.subject ?? "",
    question: r.question ?? "",
    status: r.status ?? "",
    drawingRef: r.drawing_number ?? "",
  }));

  const submittals = (submittalsRes.data ?? []).map((s) => ({
    number: s.submittal_number,
    title: s.title ?? "",
    type: s.submittal_type ?? "",
    status: s.status ?? "",
    costCode: s.cost_code ?? "",
    description: (s.description ?? "").slice(0, 400),
  }));

  const drawings = (drawingsRes.data ?? [])
    .filter((d) => d.drawing_no || d.title)
    .map((d) => ({
      drawingNo: d.drawing_no ?? "",
      title: d.title ?? "",
      revision: d.revision ?? "",
      drawingDate: d.drawing_date ?? "",
    }));

  const specifications = (specsRes.data ?? [])
    .filter((s) => s.spec_number || s.title)
    .map((s) => ({
      specNumber: s.spec_number ?? "",
      title: s.title ?? "",
    }));

  const dailyLogs = (dailyLogsRes.data ?? []).map((l) => {
    const manpower = Array.isArray(l.manpower) ? l.manpower : [];
    return {
      date: l.log_date ?? "",
      weather: l.weather_conditions ?? "",
      notes: (l.notes ?? "").slice(0, 600),
      crewCount: manpower.length,
    };
  });

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
    rfis,
    submittals,
    drawings,
    specifications,
    recentDailyLogs: dailyLogs,
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
