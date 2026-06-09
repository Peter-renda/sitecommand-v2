import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getSession } from "@/lib/auth";
import { SupabaseClient } from "@supabase/supabase-js";
import { sendDocumentTrackingEmail } from "@/lib/email";
import { buildFolderPath, getProjectEmailContext } from "@/lib/document-notify";

async function collectFilePaths(supabase: SupabaseClient, docId: string): Promise<string[]> {
  const paths: string[] = [];
  const { data: doc } = await supabase.from("documents").select("type, storage_path").eq("id", docId).single();
  if (doc?.type === "file" && doc.storage_path) paths.push(doc.storage_path);
  const { data: children } = await supabase.from("documents").select("id").eq("parent_id", docId);
  for (const child of children || []) paths.push(...(await collectFilePaths(supabase, child.id)));
  return paths;
}

async function getChangedByName(supabase: SupabaseClient, userId: string): Promise<string> {
  const { data } = await supabase
    .from("users")
    .select("first_name, last_name, username")
    .eq("id", userId)
    .single();
  if (!data) return "Unknown";
  return [data.first_name, data.last_name].filter(Boolean).join(" ") || data.username || "Unknown";
}

async function logChange(
  supabase: SupabaseClient,
  documentId: string,
  projectId: string,
  userId: string,
  changedByName: string,
  action: string,
  details?: string,
) {
  await supabase.from("document_change_history").insert({
    document_id: documentId,
    project_id: projectId,
    changed_by: userId,
    changed_by_name: changedByName,
    action,
    details: details ?? null,
  });
}

async function notifyTrackers(
  supabase: SupabaseClient,
  documentIds: string[],
  projectId: string,
  documentName: string,
  action: string,
  opts: { parentId: string | null; storagePath: string | null; comment?: string | null },
) {
  if (documentIds.length === 0) return;

  const { data: trackers } = await supabase
    .from("document_tracking")
    .select("user_email")
    .in("document_id", documentIds)
    .eq("project_id", projectId);

  const uniqueEmails = [...new Set((trackers || []).map((t) => t.user_email).filter(Boolean))];
  if (uniqueEmails.length === 0) return;

  const [{ companyName, projectName, projectUrl }, filePath] = await Promise.all([
    getProjectEmailContext(supabase, projectId),
    buildFolderPath(supabase, projectId, opts.parentId),
  ]);
  const fileUrl = opts.storagePath
    ? supabase.storage.from("project-documents").getPublicUrl(opts.storagePath).data.publicUrl
    : null;
  const viewOnlineUrl = `${projectUrl}/documents`;
  const eventTime = new Date();

  for (const email of uniqueEmails) {
    try {
      await sendDocumentTrackingEmail({
        to: email,
        companyName,
        projectName,
        filePath,
        fileName: documentName,
        fileUrl,
        event: action,
        eventTime,
        comment: opts.comment ?? null,
        viewOnlineUrl,
      });
    } catch {
      // Non-fatal: continue if email fails
    }
  }
}

async function getTrackingScopeIds(supabase: SupabaseClient, projectId: string, documentId: string): Promise<string[]> {
  const ids: string[] = [documentId];

  let currentId: string | null = documentId;
  while (currentId) {
    const { data: current } = await supabase
      .from("documents")
      .select("parent_id")
      .eq("id", currentId)
      .eq("project_id", projectId)
      .maybeSingle();

    const parentId = current?.parent_id ?? null;
    if (!parentId) break;
    ids.push(parentId);
    currentId = parentId;
  }

  return ids;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; docId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId, docId } = await params;
  const body = await req.json();
  const update: Record<string, unknown> = {};
  if (body.name !== undefined) update.name = body.name;
  if (body.parent_id !== undefined) update.parent_id = body.parent_id;
  if (body.is_private !== undefined) update.is_private = Boolean(body.is_private);
  if (body.report_fields !== undefined) update.report_fields = body.report_fields;

  const supabase = getSupabase();

  // Fetch old values for change logging
  const { data: oldDoc } = await supabase
    .from("documents")
    .select("name, parent_id, is_private, storage_path, type")
    .eq("id", docId)
    .single();

  const trackingScopeIds = await getTrackingScopeIds(supabase, projectId, docId);

  const { data, error } = await supabase
    .from("documents")
    .update(update)
    .eq("id", docId)
    .eq("project_id", projectId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const changedByName = await getChangedByName(supabase, session.id);

  const storagePath = oldDoc?.storage_path ?? null;

  if (oldDoc && body.name !== undefined && body.name !== oldDoc.name) {
    const details = `Renamed from "${oldDoc.name}" to "${body.name}"`;
    await logChange(supabase, docId, projectId, session.id, changedByName, "Renamed", details);
    await notifyTrackers(supabase, trackingScopeIds, projectId, body.name, "Renamed", {
      parentId: data.parent_id,
      storagePath,
      comment: details,
    });
  }

  if (oldDoc && body.parent_id !== undefined && body.parent_id !== oldDoc.parent_id) {
    const details = "Moved to a different folder";
    await logChange(supabase, docId, projectId, session.id, changedByName, "Moved", details);
    const movedScopeIds = new Set(trackingScopeIds);
    if (oldDoc.parent_id) movedScopeIds.add(oldDoc.parent_id);
    if (data.parent_id) movedScopeIds.add(data.parent_id);
    await notifyTrackers(supabase, [...movedScopeIds], projectId, data.name, "Moved", {
      parentId: data.parent_id,
      storagePath,
      comment: details,
    });
  }

  if (oldDoc && body.is_private !== undefined && Boolean(body.is_private) !== oldDoc.is_private) {
    const details = body.is_private ? "Folder set to private" : "Folder set to public";
    await logChange(supabase, docId, projectId, session.id, changedByName, "Permission changed", details);
    await notifyTrackers(supabase, trackingScopeIds, projectId, data.name, "Permission changed", {
      parentId: data.parent_id,
      storagePath,
      comment: details,
    });
  }

  return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; docId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId, docId } = await params;
  const supabase = getSupabase();

  const { data: doc } = await supabase
    .from("documents")
    .select("name, type, parent_id, storage_path")
    .eq("id", docId)
    .single();

  const trackingScopeIds = await getTrackingScopeIds(supabase, projectId, docId);

  const paths = await collectFilePaths(supabase, docId);
  if (paths.length > 0) await supabase.storage.from("project-documents").remove(paths);

  if (doc) {
    const changedByName = await getChangedByName(supabase, session.id);
    const details = `${doc.type === "folder" ? "Folder" : "File"} "${doc.name}" was deleted`;
    await logChange(supabase, docId, projectId, session.id, changedByName, "Deleted", details);
    await notifyTrackers(supabase, trackingScopeIds, projectId, doc.name, "Deleted", {
      parentId: doc.parent_id,
      storagePath: null,
      comment: details,
    });
  }

  await supabase.from("documents").delete().eq("id", docId).eq("project_id", projectId);

  return NextResponse.json({ ok: true });
}
