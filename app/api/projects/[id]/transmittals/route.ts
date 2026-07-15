import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getSession } from "@/lib/auth";
import { sendTransmittalCreatedEmail } from "@/lib/email";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("transmittals")
    .select("*")
    .eq("project_id", projectId)
    .order("transmittal_number", { ascending: true });

  const visible = (data || []).filter((t: { private?: boolean; created_by?: string | null }) => !t.private || t.created_by === session.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(visible);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;
  const supabase = getSupabase();

  const { data: maxRow } = await supabase
    .from("transmittals")
    .select("transmittal_number")
    .eq("project_id", projectId)
    .order("transmittal_number", { ascending: false })
    .limit(1)
    .single();

  const nextNumber = (maxRow?.transmittal_number ?? 0) + 1;

  const body = await req.json();
  const {
    subject,
    to_id,
    cc_contacts,
    sent_via,
    private: isPrivate,
    submitted_for,
    action_as_noted,
    due_by,
    sent_date,
    items,
    comments,
    send_email,
    attachments,
  } = body;

  const { data, error } = await supabase
    .from("transmittals")
    .insert({
      project_id: projectId,
      transmittal_number: nextNumber,
      subject: subject || null,
      to_id: to_id || null,
      cc_contacts: cc_contacts ?? [],
      sent_via: sent_via || null,
      private: isPrivate ?? false,
      submitted_for: submitted_for ?? [],
      action_as_noted: action_as_noted ?? [],
      due_by: due_by || null,
      sent_date: sent_date || null,
      items: items ?? [],
      comments: comments || null,
      attachments: attachments ?? [],
      created_by: session.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const shouldSendEmail = Boolean(send_email);
  if (shouldSendEmail) {
    const [{ data: project }, { data: toContact }, { data: ccContactRows }] = await Promise.all([
      supabase.from("projects").select("name").eq("id", projectId).single(),
      to_id
        ? supabase.from("directory_contacts").select("id, first_name, last_name, company, group_name, email").eq("id", to_id).single()
        : Promise.resolve({ data: null }),
      Array.isArray(cc_contacts) && cc_contacts.length > 0
        ? supabase
            .from("directory_contacts")
            .select("id, first_name, last_name, company, group_name, email")
            .in("id", cc_contacts.map((c: { id: string }) => c.id).filter(Boolean))
        : Promise.resolve({ data: [] }),
    ]);

    const recipients = new Map<string, { name: string; email: string }>();
    const addRecipient = (name: string, email: string | null | undefined) => {
      if (!email) return;
      const key = email.toLowerCase();
      if (recipients.has(key)) return;
      recipients.set(key, { name, email });
    };
    const contactName = (c: { first_name?: string | null; last_name?: string | null; company?: string | null; group_name?: string | null }) =>
      [c.first_name, c.last_name].filter(Boolean).join(" ") || c.company || c.group_name || "there";

    if (toContact?.email) addRecipient(contactName(toContact), toContact.email);
    for (const c of ccContactRows ?? []) addRecipient(contactName(c), c.email);
    for (const c of Array.isArray(cc_contacts) ? cc_contacts : []) {
      const name = typeof c?.name === "string" ? c.name : "there";
      const email = typeof c?.email === "string" ? c.email : null;
      addRecipient(name, email);
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
    const transmittalUrl = `${appUrl}/projects/${projectId}/transmittals/${data.id}`;

    const emailResults = await Promise.allSettled(
      Array.from(recipients.values()).map((recipient) =>
        sendTransmittalCreatedEmail({
          to: recipient.email,
          recipientName: recipient.name,
          projectName: project?.name ?? "Project",
          transmittalNumber: data.transmittal_number,
          transmittalSubject: data.subject,
          transmittalUrl,
          sentVia: data.sent_via,
          dueBy: data.due_by,
          sentDate: data.sent_date,
        }),
      ),
    );

    const failedEmails = emailResults.filter((r) => r.status === "rejected").length;
    if (failedEmails > 0) {
      return NextResponse.json({ ...data, email_warning: `${failedEmails} email(s) could not be sent.` });
    }
  }

  return NextResponse.json(data);
}
