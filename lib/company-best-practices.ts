/**
 * Shared accessor for a company's documented Best Practice Templates
 * (Training → Company Guides), formatted as a context block for the AI features.
 *
 * The same standards the team reads on the Guides page are injected into Assist,
 * Looking Ahead, and To Do recommendations so those features treat them as
 * authoritative company policy — e.g. a rule like "all buyout within 90 days of
 * contract" lets the generators derive the dated item for the relevant contract.
 */

import { getSupabase } from "@/lib/supabase";

type Supa = ReturnType<typeof getSupabase>;

// Keep the injected block bounded so it never dominates the AI context window.
const MAX_BLOCK_CHARS = 20_000;
const MAX_ENTRY_CHARS = 4_000;

/**
 * Build the company best-practices context block, or "" when the company has
 * none. The heading frames the entries as authoritative standards the model
 * should apply (including deriving target dates from any stated deadlines).
 */
export async function getCompanyBestPracticesText(
  supabase: Supa,
  companyId: string | null | undefined,
): Promise<string> {
  if (!companyId) return "";

  let rows: Array<{ title: string | null; content: string | null }> = [];
  try {
    const { data, error } = await supabase
      .from("training_best_practices")
      .select("title, content, sort_order, created_at")
      .eq("company_id", companyId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) return "";
    rows = (data ?? []) as Array<{ title: string | null; content: string | null }>;
  } catch {
    return "";
  }

  const entries: string[] = [];
  for (const row of rows) {
    const title = (row.title ?? "").trim();
    const content = (row.content ?? "").trim();
    if (!title && !content) continue;
    const body = content.length > MAX_ENTRY_CHARS ? content.slice(0, MAX_ENTRY_CHARS) + "…" : content;
    entries.push(`### ${title || "Best practice"}\n${body || "(no detail)"}`);
  }
  if (!entries.length) return "";

  let block = `=== COMPANY BEST PRACTICES & STANDARDS ===
These are the company's documented standards and best practices for how work should be run. Treat them as authoritative company policy. When a standard states a deadline or lead time (e.g. "buyout within 90 days of contract", "electrical submittals within 30 days"), apply it to the relevant project records and derive the concrete target date from the applicable contract/record date.

${entries.join("\n\n")}`;

  if (block.length > MAX_BLOCK_CHARS) block = block.slice(0, MAX_BLOCK_CHARS) + "\n…(best practices truncated)";
  return block;
}

/**
 * Convenience variant for callers that only have a projectId: resolves the
 * owning company, then returns its best-practices block.
 */
export async function getProjectBestPracticesText(
  supabase: Supa,
  projectId: string,
): Promise<string> {
  try {
    const { data } = await supabase
      .from("projects")
      .select("company_id")
      .eq("id", projectId)
      .single();
    return getCompanyBestPracticesText(supabase, (data?.company_id as string | null) ?? null);
  } catch {
    return "";
  }
}
