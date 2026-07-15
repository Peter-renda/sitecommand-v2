import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabase();

  // Get tasks assigned to or created by this user that are open/in_progress
  // assignees may be a UUID[] array — use .contains() to check membership
  let tasks: {
    id: string;
    title: string;
    status: string;
    due_date: string | null;
    project_id: string;
  }[] = [];

  try {
    // Try contains first (UUID array column)
    const { data, error } = await supabase
      .from("tasks")
      .select("id, title, status, due_date, project_id")
      .contains("assignees", [session.id])
      .in("status", ["open", "in_progress"])
      .limit(5);

    if (!error && data) {
      tasks = data;
    } else {
      // Fallback: try assigned_to as single UUID
      const { data: data2 } = await supabase
        .from("tasks")
        .select("id, title, status, due_date, project_id")
        .eq("assigned_to", session.id)
        .in("status", ["open", "in_progress"])
        .limit(5);
      tasks = data2 || [];
    }
  } catch {
    tasks = [];
  }

  // Also include tasks created_by the user that are still open
  try {
    const { data } = await supabase
      .from("tasks")
      .select("id, title, status, due_date, project_id")
      .eq("created_by", session.id)
      .in("status", ["open", "in_progress"])
      .limit(5);

    if (data) {
      // Merge, deduplicate by id
      const existingIds = new Set(tasks.map((t) => t.id));
      for (const row of data) {
        if (!existingIds.has(row.id)) {
          tasks.push(row);
        }
      }
    }
  } catch {}

  // Limit to 5 total
  tasks = tasks.slice(0, 5);

  type OpenItem = {
    id: string;
    title: string;
    type:
      | "task"
      | "rfi"
      | "submittal"
      | "change_event"
      | "change_order"
      | "budget"
      | "commitment"
      | "prime_contract"
      | "transaction_order_assignment"
      | "training_guide_assignment";
    status: string;
    due_date: string | null;
    project_id: string;
  };

  const openItems: OpenItem[] = [];
  const nowIsoDate = new Date().toISOString().slice(0, 10);

  const sessionEmail = String(session.email || "").trim().toLowerCase();

  // Open RFIs created by current user, or assigned to them.
  try {
    const { data: memberships } = await supabase
      .from("project_memberships")
      .select("project_id")
      .eq("user_id", session.id);

    const memberProjectIds = Array.from(new Set((memberships || []).map((m) => m.project_id).filter(Boolean)));

    const { data } = await supabase
      .from("rfis")
      .select("id, subject, status, due_date, project_id, created_by, assignees, assignee_id")
      .in("project_id", memberProjectIds.length > 0 ? memberProjectIds : ["00000000-0000-0000-0000-000000000000"])
      .neq("status", "closed")
      .limit(200);

    for (const row of data || []) {
      const assignees = Array.isArray(row.assignees) ? row.assignees : [];

      const assignedByEmail = !!sessionEmail && assignees.some(
        (assignee) =>
          assignee &&
          typeof assignee === "object" &&
          "email" in assignee &&
          typeof (assignee as { email?: unknown }).email === "string" &&
          (assignee as { email: string }).email.trim().toLowerCase() === sessionEmail
      );

      const assignedByUserId = assignees.some(
        (assignee) =>
          assignee &&
          typeof assignee === "object" &&
          "id" in assignee &&
          typeof (assignee as { id?: unknown }).id === "string" &&
          (assignee as { id: string }).id === session.id
      );

      const isRelevant = row.created_by === session.id || assignedByEmail || assignedByUserId || row.assignee_id === session.id;
      if (!isRelevant) continue;

      openItems.push({
        id: row.id,
        title: row.subject || "Untitled RFI",
        type: "rfi",
        status: row.status || "",
        due_date: row.due_date || null,
        project_id: row.project_id,
      });
    }
  } catch {}

  // Open Submittals created by current user
  try {
    const { data } = await supabase
      .from("submittals")
      .select("id, title, status, final_due_date, project_id")
      .eq("created_by", session.id)
      .neq("status", "closed")
      .limit(20);
    for (const row of data || []) {
      openItems.push({
        id: row.id,
        title: row.title || "Untitled Submittal",
        type: "submittal",
        status: row.status || "",
        due_date: row.final_due_date || null,
        project_id: row.project_id,
      });
    }
  } catch {}

  // Tasks assigned to user (the same set shown in hero)
  for (const row of tasks) {
    openItems.push({
      id: row.id,
      title: row.title || "Untitled Task",
      type: "task",
      status: row.status || "",
      due_date: row.due_date || null,
      project_id: row.project_id,
    });
  }

  // Change Events created by this user that are past due and not draft.
  try {
    const { data } = await supabase
      .from("change_events")
      .select("id, title, status, due_date, project_id")
      .eq("created_by", session.id)
      .lt("due_date", nowIsoDate)
      .limit(20);
    for (const row of data || []) {
      openItems.push({
        id: row.id,
        title: row.title || "Untitled Change Event",
        type: "change_event",
        status: row.status || "",
        due_date: row.due_date || null,
        project_id: row.project_id,
      });
    }
  } catch {}

  // Change Orders created by this user that are past due and not draft.
  try {
    const { data } = await supabase
      .from("change_orders")
      .select("id, title, status, due_date, project_id")
      .eq("created_by", session.id)
      .lt("due_date", nowIsoDate)
      .limit(20);
    for (const row of data || []) {
      openItems.push({
        id: row.id,
        title: row.title || "Untitled Change Order",
        type: "change_order",
        status: row.status || "",
        due_date: row.due_date || null,
        project_id: row.project_id,
      });
    }
  } catch {}

  // Budget snapshots created by this user that are past due and not draft
  // (query is schema-tolerant; skips if due_date/created_by columns are unavailable).
  try {
    const { data } = await supabase
      .from("budget_snapshots")
      .select("id, name, status, due_date, project_id")
      .eq("created_by", session.id)
      .lt("due_date", nowIsoDate)
      .limit(20);
    for (const row of data || []) {
      openItems.push({
        id: row.id,
        title: row.name || "Untitled Budget Snapshot",
        type: "budget",
        status: row.status || "",
        due_date: row.due_date || null,
        project_id: row.project_id,
      });
    }
  } catch {}

  // Commitments created by this user that are past due and not draft.
  try {
    const { data } = await supabase
      .from("commitments")
      .select("id, title, status, delivery_date, project_id")
      .eq("created_by", session.id)
      .lt("delivery_date", nowIsoDate)
      .limit(20);
    for (const row of data || []) {
      openItems.push({
        id: row.id,
        title: row.title || "Untitled Commitment",
        type: "commitment",
        status: row.status || "",
        due_date: row.delivery_date || null,
        project_id: row.project_id,
      });
    }
  } catch {}

  // Prime Contracts created by this user that are past due and not draft.
  try {
    const { data } = await supabase
      .from("prime_contracts")
      .select("id, title, status, estimated_completion_date, project_id")
      .eq("created_by", session.id)
      .lt("estimated_completion_date", nowIsoDate)
      .limit(20);
    for (const row of data || []) {
      openItems.push({
        id: row.id,
        title: row.title || "Untitled Prime Contract",
        type: "prime_contract",
        status: row.status || "",
        due_date: row.estimated_completion_date || null,
        project_id: row.project_id,
      });
    }
  } catch {}

  // Open Transaction Order assignments where the current user is a
  // recipient (matched by user_id or email).
  try {
    const { data } = await supabase
      .from("transaction_order_assignments")
      .select("id, invoice_filename, status, created_at, project_id, recipients")
      .eq("status", "open")
      .limit(200);

    for (const row of data || []) {
      const recipients = Array.isArray(row.recipients) ? row.recipients : [];
      const matched = recipients.some((r: { userId?: string | null; email?: string | null }) => {
        if (!r || typeof r !== "object") return false;
        if (r.userId && r.userId === session.id) return true;
        if (sessionEmail && typeof r.email === "string" && r.email.toLowerCase() === sessionEmail) {
          return true;
        }
        return false;
      });
      if (!matched) continue;
      openItems.push({
        id: row.id,
        title: row.invoice_filename || "Assigned invoice",
        type: "transaction_order_assignment",
        status: row.status || "open",
        due_date: null,
        project_id: row.project_id,
      });
    }
  } catch {}

  // Company training guides assigned to the current user that are still
  // outstanding. These are company-scoped (not tied to a project).
  try {
    const { data } = await supabase
      .from("training_guide_assignments")
      .select("id, due_date, status, training_guides(title)")
      .eq("user_id", session.id)
      .eq("status", "assigned")
      .limit(50);

    for (const row of data || []) {
      const tgRaw = (row as { training_guides?: unknown }).training_guides;
      const tg = Array.isArray(tgRaw) ? tgRaw[0] : tgRaw;
      const title =
        (tg && typeof tg === "object" && "title" in tg
          ? (tg as { title?: string | null }).title
          : null) || "Assigned guide";
      openItems.push({
        id: row.id,
        title,
        type: "training_guide_assignment",
        status: row.status || "assigned",
        due_date: row.due_date || null,
        project_id: "",
      });
    }
  } catch {}

  // Deduplicate and normalize status filtering for non-closed items.
  const isPastDueAndNotDraft = (item: OpenItem) => {
    const status = String(item.status || "").trim().toLowerCase();
    if (status === "draft") return false;
    if (!item.due_date) return false;
    return new Date(item.due_date).getTime() < new Date(nowIsoDate).getTime();
  };

  const dedupedOpenItems = Array.from(
    new Map(
      openItems
        .filter((item) => {
          // For contract/budget/change entities, keep only past-due + non-draft.
          if (item.type === "prime_contract" || item.type === "budget" || item.type === "commitment" || item.type === "change_order" || item.type === "change_event") {
            return isPastDueAndNotDraft(item);
          }
          // RFIs/Submittals/Tasks should still exclude closed rows.
          return String(item.status || "").trim().toLowerCase() !== "closed";
        })
        .map((item) => [`${item.type}:${item.id}`, item])
    ).values()
  );

  // Fetch project names for all returned entities. Filter out empty ids so
  // company-scoped items (e.g. training guide assignments, project_id "") don't
  // break the UUID `in` query.
  const projectIds = [...new Set([...tasks.map((t) => t.project_id), ...dedupedOpenItems.map((i) => i.project_id)])].filter(Boolean);
  const { data: projectsData } = projectIds.length
    ? await supabase.from("projects").select("id, name, is_training").in("id", projectIds)
    : { data: [] as { id: string; name: string; is_training: boolean }[] };

  const projectMap = new Map((projectsData || []).map((p: { id: string; name: string }) => [p.id, p.name]));
  // Training sandboxes are personal practice environments — keep their items out
  // of the real dashboard.
  const trainingProjectIds = new Set(
    (projectsData || [])
      .filter((p: { is_training?: boolean }) => p.is_training)
      .map((p: { id: string }) => p.id),
  );

  const result = tasks
    .filter((t) => !trainingProjectIds.has(t.project_id))
    .map((t) => ({
      ...t,
      project_name: projectMap.get(t.project_id) ?? "",
    }));

  const openItemsResult = dedupedOpenItems
    .filter((item) => !trainingProjectIds.has(item.project_id))
    .map((item) => ({
      ...item,
      project_name:
        item.type === "training_guide_assignment"
          ? "Company guides"
          : projectMap.get(item.project_id) ?? "",
    }))
    .sort((a, b) => {
      const aDue = a.due_date ? new Date(a.due_date).getTime() : Number.POSITIVE_INFINITY;
      const bDue = b.due_date ? new Date(b.due_date).getTime() : Number.POSITIVE_INFINITY;
      return aDue - bDue;
    })
    .slice(0, 50);

  return NextResponse.json({ tasks: result, open_items: openItemsResult });
}
