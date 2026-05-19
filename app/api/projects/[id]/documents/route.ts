import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getSession } from "@/lib/auth";
import { SupabaseClient } from "@supabase/supabase-js";
import { sendDocumentTrackingEmail } from "@/lib/email";
import { buildFolderPath, getProjectEmailContext } from "@/lib/document-notify";

async function getChangedByName(supabase: SupabaseClient, userId: string): Promise<string> {
  const { data } = await supabase
    .from("users")
    .select("first_name, last_name, username")
    .eq("id", userId)
    .single();
  if (!data) return "Unknown";
  return [data.first_name, data.last_name].filter(Boolean).join(" ") || data.username || "Unknown";
}

async function logAndNotifyParentTrackers(
  supabase: SupabaseClient,
  newDocId: string,
  parentId: string | null,
  projectId: string,
  userId: string,
  changedByName: string,
  docName: string,
  docType: "file" | "folder",
  storagePath: string | null,
) {
  const action = docType === "folder" ? "New folder added" : "New file added";
  const details = `"${docName}" was added by ${changedByName}`;

  if (parentId) {
    await supabase.from("document_change_history").insert({
      document_id: parentId,
      project_id: projectId,
      changed_by: userId,
      changed_by_name: changedByName,
      action,
      details,
    });
  }

  await supabase.from("document_change_history").insert({
    document_id: newDocId,
    project_id: projectId,
    changed_by: userId,
    changed_by_name: changedByName,
    action: docType === "folder" ? "Folder created" : "File uploaded",
    details: `"${docName}" was ${docType === "folder" ? "created" : "uploaded"}`,
  });

  if (!parentId) return;

  const ancestorIds: string[] = [];
  let currentId: string | null = parentId;
  while (currentId) {
    ancestorIds.push(currentId);
    const { data: parentDoc } = await supabase
      .from("documents")
      .select("parent_id")
      .eq("id", currentId)
      .eq("project_id", projectId)
      .maybeSingle();

    currentId = parentDoc?.parent_id ?? null;
  }

  const { data: trackers } = await supabase
    .from("document_tracking")
    .select("user_email")
    .in("document_id", ancestorIds)
    .eq("project_id", projectId)
    .neq("user_id", userId);

  const uniqueEmails = [...new Set((trackers || []).map((t) => t.user_email).filter(Boolean))];
  if (uniqueEmails.length === 0) return;

  const [{ companyName, projectName, projectUrl }, filePath] = await Promise.all([
    getProjectEmailContext(supabase, projectId),
    buildFolderPath(supabase, projectId, parentId),
  ]);
  const fileUrl = storagePath
    ? supabase.storage.from("project-documents").getPublicUrl(storagePath).data.publicUrl
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
        fileName: docName,
        fileUrl,
        event: action,
        eventTime,
        viewOnlineUrl,
      });
    } catch {
      // Non-fatal
    }
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;
  const sp = new URL(req.url).searchParams;
  const parentId = sp.get("parent_id");
  const allFolders = sp.get("all_folders") === "true";
  const uploadUrlFilename = sp.get("upload_url_for");
  const supabase = getSupabase();

  if (uploadUrlFilename) {
    const safeFilename = uploadUrlFilename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `${projectId}/${crypto.randomUUID()}/${safeFilename}`;
    const { data, error } = await supabase.storage
      .from("project-documents")
      .createSignedUploadUrl(storagePath);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ signedUrl: data.signedUrl, storagePath });
  }

  if (allFolders) {
    const { data } = await supabase
      .from("documents")
      .select("id, name, parent_id")
      .eq("project_id", projectId)
      .eq("type", "folder")
      .or(`is_private.eq.false,created_by.eq.${session.id}`)
      .order("name");
    return NextResponse.json(data || []);
  }

  let query = supabase
    .from("documents")
    .select("*, creator:users!created_by(first_name, last_name)")
    .eq("project_id", projectId)
    .or(`is_private.eq.false,created_by.eq.${session.id}`)
    .order("type", { ascending: false })
    .order("name", { ascending: true });

  if (parentId) {
    query = query.eq("parent_id", parentId);
  } else {
    query = query.is("parent_id", null);
  }

  const { data } = await query;
  const items = (data || []).map((doc) => {
    const { creator, ...rest } = doc;
    const creatorName = creator
      ? [creator.first_name, creator.last_name].filter(Boolean).join(" ") || null
      : null;
    return {
      ...rest,
      created_by_name: creatorName,
      url: doc.storage_path
        ? supabase.storage.from("project-documents").getPublicUrl(doc.storage_path).data.publicUrl
        : null,
    };
  });

  return NextResponse.json(items);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;
  const supabase = getSupabase();
  const contentType = req.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const rawParentId = formData.get("parent_id") as string | null;
    const parentId = rawParentId && rawParentId !== "null" ? rawParentId : null;
    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

    const docId = crypto.randomUUID();
    const safeFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${projectId}/${docId}/${safeFilename}`;

    // Convert to ArrayBuffer to strip the original filename from the upload payload
    // (File objects carry their .name in Content-Disposition headers which breaks on & and spaces)
    const fileBuffer = await file.arrayBuffer();

    const { error: uploadError } = await supabase.storage
      .from("project-documents")
      .upload(path, fileBuffer, { contentType: file.type });

    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

    const { data, error: insertError } = await supabase
      .from("documents")
      .insert({
        id: docId,
        project_id: projectId,
        parent_id: parentId || null,
        name: file.name,
        type: "file",
        storage_path: path,
        mime_type: file.type,
        size: file.size,
        created_by: session.id,
      })
      .select()
      .single();

    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

    const changedByName = await getChangedByName(supabase, session.id);
    await logAndNotifyParentTrackers(supabase, docId, parentId, projectId, session.id, changedByName, file.name, "file", path);

    return NextResponse.json({
      ...data,
      url: supabase.storage.from("project-documents").getPublicUrl(path).data.publicUrl,
    });
  }

  const body = await req.json();
  const { name, parent_id, type, storage_path, mime_type, size } = body;
  if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });

  if (type === "file") {
    if (!storage_path) {
      return NextResponse.json({ error: "storage_path is required for file uploads" }, { status: 400 });
    }

    const docId = crypto.randomUUID();
    const { data, error: insertError } = await supabase
      .from("documents")
      .insert({
        id: docId,
        project_id: projectId,
        parent_id: parent_id || null,
        name,
        type: "file",
        storage_path,
        mime_type: mime_type || null,
        size: typeof size === "number" ? size : null,
        created_by: session.id,
      })
      .select()
      .single();

    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

    const changedByName = await getChangedByName(supabase, session.id);
    await logAndNotifyParentTrackers(supabase, docId, parent_id || null, projectId, session.id, changedByName, name, "file", storage_path);

    return NextResponse.json({
      ...data,
      url: supabase.storage.from("project-documents").getPublicUrl(storage_path).data.publicUrl,
    });
  }

  const { data } = await supabase
    .from("documents")
    .insert({
      project_id: projectId,
      parent_id: parent_id || null,
      name,
      type: "folder",
      created_by: session.id,
    })
    .select()
    .single();

  if (data) {
    const changedByName = await getChangedByName(supabase, session.id);
    await logAndNotifyParentTrackers(supabase, data.id, parent_id || null, projectId, session.id, changedByName, name, "folder", null);
  }

  return NextResponse.json({ ...data, url: null });
}
