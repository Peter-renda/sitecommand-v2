import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getSession } from "@/lib/auth";
import { logRFIChange } from "@/lib/rfi-history";
import { sendRFIResponseEmail } from "@/lib/email";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; rfiId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId, rfiId } = await params;
  const supabase = getSupabase();

  const { data: rfi } = await supabase.from("rfis").select("id").eq("id", rfiId).eq("project_id", projectId).single();
  if (!rfi) return NextResponse.json({ error: "RFI not found" }, { status: 404 });

  const { data, error } = await supabase
    .from("rfi_responses")
    .select("id, body, created_by, created_at, attachments, users(username, first_name, last_name)")
    .eq("rfi_id", rfiId)
    .order("created_at", { ascending: false });

  // If attachments column doesn't exist yet (migration pending), fall back without it
  let rows = data;
  if (error) {
    const { data: fallback, error: fallbackError } = await supabase
      .from("rfi_responses")
      .select("id, body, created_by, created_at, users(username, first_name, last_name)")
      .eq("rfi_id", rfiId)
      .order("created_at", { ascending: false });
    if (fallbackError) return NextResponse.json({ error: fallbackError.message }, { status: 500 });
    rows = fallback;
  }

  const responses = (rows || []).map((r: {
    id: string;
    body: string;
    created_by: string | null;
    created_at: string;
    attachments?: { name: string; url: string }[] | null;
    users: { username: string; first_name: string | null; last_name: string | null } | null;
  }) => {
    const u = r.users;
    const created_by_name = u
      ? ([u.first_name, u.last_name].filter(Boolean).join(" ") || u.username)
      : null;
    return { id: r.id, body: r.body, created_by: r.created_by, created_at: r.created_at, created_by_name, attachments: r.attachments ?? [] };
  });

  return NextResponse.json(responses);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; rfiId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId, rfiId } = await params;
  const supabase = getSupabase();

  const { data: rfi } = await supabase.from("rfis").select("id").eq("id", rfiId).eq("project_id", projectId).single();
  if (!rfi) return NextResponse.json({ error: "RFI not found" }, { status: 404 });

  const { body } = await req.json();
  if (!body || typeof body !== "string") return NextResponse.json({ error: "Body is required" }, { status: 400 });

  const { data, error } = await supabase
    .from("rfi_responses")
    .insert({ rfi_id: rfiId, body: body.trim(), created_by: session.id })
    .select("id, body, created_by, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Compute the position of this newly-inserted response (chronological order)
  // so we can label the history entry "Added Response #N".
  const { count: responseCount } = await supabase
    .from("rfi_responses")
    .select("id", { count: "exact", head: true })
    .eq("rfi_id", rfiId);
  const responseNumber = responseCount ?? 0;
  await logRFIChange(
    supabase,
    session,
    rfiId,
    projectId,
    responseNumber > 0 ? `Added Response #${responseNumber}` : "Added Response",
    null,
    body.trim(),
  );

  // Send email notifications to distribution list, RFI manager, and assignees
  try {
    const [rfiRes, projectRes] = await Promise.all([
      supabase
        .from("rfis")
        .select("rfi_number, subject, distribution_list, assignees, rfi_manager_id")
        .eq("id", rfiId)
        .single(),
      supabase
        .from("projects")
        .select("name, company_id")
        .eq("id", projectId)
        .single(),
    ]);

    const rfiData = rfiRes.data;
    const projectName = projectRes.data?.name ?? "";
    let companyName = "SiteCommand";
    if (projectRes.data?.company_id) {
      const { data: company } = await supabase
        .from("companies")
        .select("name")
        .eq("id", projectRes.data.company_id)
        .maybeSingle();
      if (company?.name) companyName = company.name;
    }
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
    const rfiUrl = `${appUrl}/projects/${projectId}/rfis/${rfiId}`;
    const responderName = session.username;

    if (rfiData) {
      const distributionList: { name: string; email: string | null }[] = Array.isArray(rfiData.distribution_list) ? rfiData.distribution_list : [];
      const assignees: { name: string; email: string | null }[] = Array.isArray(rfiData.assignees) ? rfiData.assignees : [];

      // Collect all recipients: distribution list + assignees
      const allContacts = [...distributionList, ...assignees];

      // Also include RFI manager if available
      if (rfiData.rfi_manager_id) {
        const { data: manager } = await supabase
          .from("directory_contacts")
          .select("first_name, last_name, email")
          .eq("id", rfiData.rfi_manager_id)
          .single();
        if (manager?.email) {
          const managerName = [manager.first_name, manager.last_name].filter(Boolean).join(" ");
          allContacts.push({ name: managerName, email: manager.email });
        }
      }

      // Deduplicate by email
      const seen = new Set<string>();
      const recipients = allContacts.filter((c) => {
        if (!c.email) return false;
        if (seen.has(c.email)) return false;
        seen.add(c.email);
        return true;
      });

      await Promise.allSettled(
        recipients.map((r) =>
          sendRFIResponseEmail(
            r.email!,
            r.name,
            responderName,
            rfiData.rfi_number,
            rfiData.subject,
            projectName,
            rfiUrl,
            body.trim(),
            companyName,
            rfiUrl,
          )
        )
      );
    }
  } catch {
    // Email failure should not block the response
  }

  const created_by_name = [session.username].filter(Boolean).join("") || null;
  return NextResponse.json({ ...data, created_by_name, attachments: [] });
}
