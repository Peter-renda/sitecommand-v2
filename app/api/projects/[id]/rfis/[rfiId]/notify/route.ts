import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getSession } from "@/lib/auth";
import { sendRFICreatedEmail } from "@/lib/email";

type Recipient = { name: string; email: string; role: "manager" | "assignee" | "distribution" };

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; rfiId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId, rfiId } = await params;
  const supabase = getSupabase();

  const [rfiRes, projectRes] = await Promise.all([
    supabase
      .from("rfis")
      .select("rfi_number, subject, question, due_date, distribution_list, assignees, rfi_manager_id")
      .eq("id", rfiId)
      .eq("project_id", projectId)
      .single(),
    supabase.from("projects").select("name, company_id").eq("id", projectId).single(),
  ]);

  if (!rfiRes.data) return NextResponse.json({ error: "RFI not found" }, { status: 404 });

  const rfi = rfiRes.data;
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
  const viewOnlineUrl = rfiUrl;

  const distribution: { name: string; email: string | null }[] = Array.isArray(rfi.distribution_list) ? rfi.distribution_list : [];
  const assignees: { name: string; email: string | null }[] = Array.isArray(rfi.assignees) ? rfi.assignees : [];

  const pool: Recipient[] = [];
  for (const c of distribution) if (c?.email) pool.push({ name: c.name ?? "", email: c.email, role: "distribution" });
  for (const c of assignees) if (c?.email) pool.push({ name: c.name ?? "", email: c.email, role: "assignee" });

  if (rfi.rfi_manager_id) {
    const { data: manager } = await supabase
      .from("directory_contacts")
      .select("first_name, last_name, email")
      .eq("id", rfi.rfi_manager_id)
      .maybeSingle();
    if (manager?.email) {
      const managerName = [manager.first_name, manager.last_name].filter(Boolean).join(" ");
      pool.push({ name: managerName, email: manager.email, role: "manager" });
    }
  }

  // Deduplicate by email; prefer the most specific role (manager > assignee > distribution).
  const rolePriority: Record<Recipient["role"], number> = { manager: 0, assignee: 1, distribution: 2 };
  const byEmail = new Map<string, Recipient>();
  for (const r of pool) {
    const existing = byEmail.get(r.email.toLowerCase());
    if (!existing || rolePriority[r.role] < rolePriority[existing.role]) {
      byEmail.set(r.email.toLowerCase(), r);
    }
  }
  const recipients = Array.from(byEmail.values());

  if (recipients.length === 0) {
    return NextResponse.json({ ok: true, recipient_count: 0 });
  }

  const senderName = session.username;
  await Promise.allSettled(
    recipients.map((r) =>
      sendRFICreatedEmail(
        r.email,
        r.name,
        senderName,
        rfi.rfi_number,
        rfi.subject,
        rfi.question,
        rfi.due_date,
        projectName,
        rfiUrl,
        r.role,
        companyName,
        viewOnlineUrl,
      )
    )
  );

  return NextResponse.json({ ok: true, recipient_count: recipients.length });
}
