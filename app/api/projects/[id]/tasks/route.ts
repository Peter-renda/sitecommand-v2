import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getSession } from "@/lib/auth";
import { sendTaskCreatedEmail } from "@/lib/email";

type ContactLite = { id?: string; email?: string | null };

export function canViewTask(
  task: {
    is_private?: boolean | null;
    created_by?: string | null;
    assignees?: ContactLite[] | null;
    distribution_list?: ContactLite[] | null;
  },
  session: { id: string; email: string; role?: string }
): boolean {
  if (!task.is_private) return true;
  if (session.role === "admin") return true;
  if (task.created_by && task.created_by === session.id) return true;
  const email = (session.email || "").toLowerCase();
  const inList = (list?: ContactLite[] | null) =>
    (list ?? []).some((c) => (c.email ?? "").toLowerCase() === email);
  return inList(task.assignees) || inList(task.distribution_list);
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("project_id", projectId)
    .order("task_number", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const filtered = (data || []).filter((t) => canViewTask(t, session));
  return NextResponse.json(filtered);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;
  const supabase = getSupabase();

  // Determine next task number (fallback if not provided)
  const { data: maxRow } = await supabase
    .from("tasks")
    .select("task_number")
    .eq("project_id", projectId)
    .order("task_number", { ascending: false })
    .limit(1)
    .single();

  const autoNextNumber = (maxRow?.task_number ?? 0) + 1;

  const { task_number, title, status, category, description, distribution_list, assignees, due_date, is_private } = await req.json();
  if (!title?.trim()) return NextResponse.json({ error: "Title is required" }, { status: 400 });

  const resolvedTaskNumber = (typeof task_number === "number" && task_number > 0) ? task_number : autoNextNumber;

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      project_id: projectId,
      task_number: resolvedTaskNumber,
      title,
      status: status || "open",
      category: category || null,
      description: description || null,
      distribution_list: distribution_list || [],
      assignees: assignees || [],
      due_date: due_date || null,
      is_private: Boolean(is_private),
      created_by: session.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Send email notifications to distribution list + assignees (deduplicated by email)
  const allRecipients = [...(distribution_list ?? []), ...(assignees ?? [])];
  const seen = new Set<string>();
  const recipients: { name: string; email: string }[] = allRecipients.filter(
    (d: { email?: string | null }) => {
      if (!d.email) return false;
      if (seen.has(d.email)) return false;
      seen.add(d.email);
      return true;
    }
  );

  if (recipients.length > 0) {
    const { data: project } = await supabase
      .from("projects")
      .select("name")
      .eq("id", projectId)
      .single();

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
    const taskUrl = `${appUrl}/projects/${projectId}/tasks/${data!.id}`;

    await Promise.allSettled(
      recipients.map((r) =>
        sendTaskCreatedEmail(r.email, project?.name ?? "", data!.task_number, title, taskUrl, description || null, due_date || null)
      )
    );
  }

  return NextResponse.json(data);
}
