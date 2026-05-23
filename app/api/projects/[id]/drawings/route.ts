import { NextRequest, NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";
import { getSession } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;
  const supabase = getSupabase();

  const [drawingsRes, uploadsRes] = await Promise.all([
    supabase
      .from("project_drawings")
      .select(`
        *,
        drawing_uploads!inner(storage_path, filename, uploaded_by_name, uploaded_at)
      `)
      .eq("project_id", projectId)
      .order("upload_id")
      .order("page_number"),
    supabase
      .from("drawing_uploads")
      .select("*")
      .eq("project_id", projectId)
      .order("uploaded_at", { ascending: false }),
  ]);

  if (drawingsRes.error) return NextResponse.json({ error: drawingsRes.error.message }, { status: 500 });
  if (uploadsRes.error) return NextResponse.json({ error: uploadsRes.error.message }, { status: 500 });

  const drawings = (drawingsRes.data ?? []).map((d: Record<string, unknown>) => {
    const upload = d.drawing_uploads as Record<string, unknown>;
    const { drawing_uploads: _, ...rest } = d;
    void _;
    // Per-page storage_path (new) takes priority; fall back to upload's shared PDF (legacy)
    const storagePath = (rest.storage_path as string | null) ?? (upload.storage_path as string);
    // viewer_page: extracted pages are single-page PDFs (always page 1);
    // legacy rows reference a multi-page PDF and need the real page number.
    const viewerPage = (rest.storage_path as string | null) ? 1 : (rest.page_number as number);
    return {
      ...rest,
      storage_path: storagePath,
      viewer_page: viewerPage,
      filename: upload.filename,
      uploaded_by_name: upload.uploaded_by_name,
      uploaded_at: upload.uploaded_at,
    };
  });

  return NextResponse.json({ drawings, uploads: uploadsRes.data ?? [] });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;
  const supabase = getSupabase();

  // Accept JSON: the client already uploaded the file directly to Supabase
  // using a signed URL (bypassing Vercel's 4.5 MB body limit). The Upload
  // Drawings modal also forwards the set selection and the upload-time
  // defaults (dates, default revision, scan hints) so they can be applied
  // on creation and read back during the AI title-block extraction.
  const body = await req.json() as {
    storagePath: string;
    filename: string;
    setId?: string | null;
    defaultDrawingDate?: string | null;
    defaultReceivedDate?: string | null;
    defaultRevision?: string | null;
    drawingNoRevMode?: string | null;
    getNumberFromFilename?: boolean;
    drawingLanguage?: string | null;
  };
  const { storagePath, filename } = body;

  if (!storagePath || !filename) {
    return NextResponse.json({ error: "storagePath and filename are required" }, { status: 400 });
  }
  if (!filename.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: "Only PDF files are accepted" }, { status: 400 });
  }

  const VALID_REV_MODES = new Set(["none", "first_decimal", "first_underscore", "last_underscore"]);
  const drawingNoRevMode = typeof body.drawingNoRevMode === "string" && VALID_REV_MODES.has(body.drawingNoRevMode)
    ? body.drawingNoRevMode
    : "none";
  const defaultDrawingDate = body.defaultDrawingDate || null;
  const defaultReceivedDate = body.defaultReceivedDate || null;
  const defaultRevision = body.defaultRevision || null;
  const drawingLanguage = body.drawingLanguage || "en";
  const getNumberFromFilename = !!body.getNumberFromFilename;
  const setId = body.setId || null;

  // Download the file from Supabase Storage (internal — no Vercel body limit)
  const { data: fileBlob, error: downloadError } = await supabase.storage
    .from("project-drawings")
    .download(storagePath);

  if (downloadError || !fileBlob) {
    return NextResponse.json({ error: downloadError?.message ?? "Download failed" }, { status: 500 });
  }

  const fileBuffer = Buffer.from(await fileBlob.arrayBuffer());

  // Load the PDF and count pages
  let srcPdf: PDFDocument;
  try {
    srcPdf = await PDFDocument.load(fileBuffer);
  } catch (err) {
    console.error("pdf-lib failed to load PDF:", err);
    return NextResponse.json({ error: "Could not parse PDF file." }, { status: 400 });
  }

  const pageCount = srcPdf.getPageCount();
  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const baseName = safeFilename.replace(/\.pdf$/i, "");
  // Derive timestamp from the storagePath the client already uploaded to
  const timestamp = storagePath.split("/")[1]?.split("-")[0] ?? String(Date.now());

  // Create one drawing_uploads row to represent the original file
  const { data: uploadRow, error: insertUploadError } = await supabase
    .from("drawing_uploads")
    .insert({
      project_id: projectId,
      storage_path: storagePath,
      filename,
      page_count: pageCount,
      uploaded_by_name: session.username,
      set_id: setId,
      default_drawing_date: defaultDrawingDate,
      default_received_date: defaultReceivedDate,
      default_revision: defaultRevision,
      drawing_no_rev_mode: drawingNoRevMode,
      get_number_from_filename: getNumberFromFilename,
      drawing_language: drawingLanguage,
    })
    .select()
    .single();

  if (insertUploadError) return NextResponse.json({ error: insertUploadError.message }, { status: 500 });

  // Extract each page into its own PDF, upload, and create a drawing row
  const drawingRows: Record<string, unknown>[] = [];

  for (let i = 0; i < pageCount; i++) {
    try {
      // Build a single-page PDF for page i
      const pagePdf = await PDFDocument.create();
      const [copiedPage] = await pagePdf.copyPages(srcPdf, [i]);
      pagePdf.addPage(copiedPage);
      const pageBytes = await pagePdf.save();

      // Upload to storage: e.g. projectId/1234567-Drawings-p1.pdf
      const pagePath = `${projectId}/${timestamp}-${baseName}-p${i + 1}.pdf`;
      const { error: storageError } = await supabase.storage
        .from("project-drawings")
        .upload(pagePath, pageBytes, { contentType: "application/pdf", upsert: false });

      if (storageError) {
        console.error(`Storage upload failed for page ${i + 1}:`, storageError.message);
        continue; // skip this page rather than failing the whole upload
      }

      // Insert project_drawings row with its own storage_path. Default
      // dates/revision from the upload settings are stamped now so the
      // sheet has a baseline even before the user reviews AI extraction.
      const { data: drawing, error: drawingError } = await supabase
        .from("project_drawings")
        .insert({
          project_id: projectId,
          upload_id: uploadRow.id,
          page_number: i + 1,
          storage_path: pagePath,
          drawing_date: defaultDrawingDate,
          received_date: defaultReceivedDate,
          revision: defaultRevision,
        })
        .select()
        .single();

      if (drawingError) {
        console.error(`DB insert failed for page ${i + 1}:`, drawingError.message);
        continue;
      }

      drawingRows.push({
        ...drawing,
        storage_path: pagePath,
        viewer_page: 1,
        filename,
        uploaded_by_name: session.username,
        uploaded_at: uploadRow.uploaded_at,
      });
    } catch (err) {
      console.error(`Failed to extract page ${i + 1}:`, err);
    }
  }

  // Update page_count to reflect how many were actually saved
  await supabase
    .from("drawing_uploads")
    .update({ page_count: drawingRows.length })
    .eq("id", uploadRow.id);

  return NextResponse.json({ upload: uploadRow, drawings: drawingRows });
}
