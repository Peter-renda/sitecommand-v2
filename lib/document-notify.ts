import { SupabaseClient } from "@supabase/supabase-js";

export async function buildFolderPath(
  supabase: SupabaseClient,
  projectId: string,
  startId: string | null,
): Promise<string> {
  if (!startId) return "/";
  const segments: string[] = [];
  let currentId: string | null = startId;
  while (currentId) {
    const { data } = await supabase
      .from("documents")
      .select("name, parent_id")
      .eq("id", currentId)
      .eq("project_id", projectId)
      .maybeSingle();
    if (!data) break;
    segments.unshift(data.name);
    currentId = data.parent_id ?? null;
  }
  return segments.length === 0 ? "/" : segments.join("/") + "/";
}

export async function getProjectEmailContext(
  supabase: SupabaseClient,
  projectId: string,
): Promise<{ companyName: string; projectName: string; projectUrl: string }> {
  const { data: project } = await supabase
    .from("projects")
    .select("name, company_id")
    .eq("id", projectId)
    .maybeSingle();

  let companyName = "SiteCommand";
  if (project?.company_id) {
    const { data: company } = await supabase
      .from("companies")
      .select("name")
      .eq("id", project.company_id)
      .maybeSingle();
    if (company?.name) companyName = company.name;
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  return {
    companyName,
    projectName: project?.name ?? "",
    projectUrl: `${appUrl}/projects/${projectId}`,
  };
}
