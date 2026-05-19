import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getSession } from "@/lib/auth";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("submittal_packages")
    .select("id, project_id, package_number, title, specification_id, description, attachments, created_by, created_at")
    .eq("project_id", projectId)
    .order("package_number", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const packageIds = (data ?? []).map((pkg) => pkg.id);
  if (packageIds.length === 0) return NextResponse.json([]);

  const { data: links } = await supabase
    .from("submittal_package_items")
    .select("package_id, submittal_id")
    .in("package_id", packageIds);

  const counts = new Map<string, number>();
  const submittalIds = new Set<string>();
  const submittalIdsByPackage = new Map<string, string[]>();
  for (const row of links ?? []) {
    counts.set(row.package_id, (counts.get(row.package_id) ?? 0) + 1);
    submittalIds.add(row.submittal_id);
    const list = submittalIdsByPackage.get(row.package_id) ?? [];
    list.push(row.submittal_id);
    submittalIdsByPackage.set(row.package_id, list);
  }

  let distributedMap = new Map<string, number>();
  if (submittalIds.size > 0) {
    const { data: subs } = await supabase
      .from("submittals")
      .select("id, distributed_at")
      .in("id", Array.from(submittalIds));
    const distributedById = new Map<string, boolean>();
    for (const s of subs ?? []) distributedById.set(s.id, Boolean(s.distributed_at));
    distributedMap = new Map<string, number>();
    for (const row of links ?? []) {
      if (!distributedById.get(row.submittal_id)) continue;
      distributedMap.set(row.package_id, (distributedMap.get(row.package_id) ?? 0) + 1);
    }
  }

  return NextResponse.json(
    (data ?? []).map((pkg) => ({
      ...pkg,
      submittal_count: counts.get(pkg.id) ?? 0,
      distributed_count: distributedMap.get(pkg.id) ?? 0,
      submittal_ids: submittalIdsByPackage.get(pkg.id) ?? [],
    }))
  );
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;
  const supabase = getSupabase();

  const { data: maxRow } = await supabase
    .from("submittal_packages")
    .select("package_number")
    .eq("project_id", projectId)
    .order("package_number", { ascending: false })
    .limit(1)
    .single();

  const nextNumber = (maxRow?.package_number ?? 0) + 1;

  const body = await req.json();
  const { title, specification_id, description, attachments, submittal_ids } = body;

  const { data: pkg, error } = await supabase
    .from("submittal_packages")
    .insert({
      project_id: projectId,
      package_number: nextNumber,
      title: (title ?? "").toString().trim() || "Untitled Package",
      specification_id: specification_id || null,
      description: description || null,
      attachments: attachments ?? [],
      created_by: session.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (Array.isArray(submittal_ids) && submittal_ids.length > 0) {
    const items = submittal_ids.map((sid: string) => ({
      package_id: pkg.id,
      submittal_id: sid,
    }));
    await supabase.from("submittal_package_items").insert(items);
  }

  return NextResponse.json(pkg);
}
