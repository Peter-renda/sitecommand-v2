import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";

// Only users with role = 'site_admin' may read or write platform settings.
async function requireSiteAdmin() {
  const session = await getSession();
  if (!session) return null;
  if (session.role !== "site_admin") return null;
  return session;
}

const ALLOWED_KEYS = [
  "APS_CLIENT_ID",
  "APS_CLIENT_SECRET",
  "APS_BUCKET_KEY",
  "SAGE_SENDER_ID",
  "SAGE_SENDER_PASSWORD",
  "SAGE_COMPANY_ID",
  "SAGE_USER_ID",
  "SAGE_USER_PASSWORD",
  "QBO_CLIENT_ID",
  "QBO_CLIENT_SECRET",
  "XERO_CLIENT_ID",
  "XERO_CLIENT_SECRET",
  "SAGE300CRE_CLIENT_ID",
  "SAGE300CRE_CLIENT_SECRET",
  "ELEVENLABS_API_KEY",
] as const;

export async function GET() {
  const session = await requireSiteAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("platform_settings")
    .select("key, value, updated_at")
    .in("key", ALLOWED_KEYS);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Return a map of key → value (mask the secret)
  const settings: Record<string, string | null> = {};
  for (const key of ALLOWED_KEYS) {
    const row = data?.find((r) => r.key === key);
    settings[key] = row ? row.value : null;
  }

  return NextResponse.json(settings);
}

export async function PATCH(req: NextRequest) {
  const session = await requireSiteAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const supabase = getSupabase();

  const upserts: { key: string; value: string; updated_at: string }[] = [];
  const now = new Date().toISOString();

  for (const key of ALLOWED_KEYS) {
    if (typeof body[key] === "string") {
      const val = body[key].trim();
      if (val) {
        upserts.push({ key, value: val, updated_at: now });
      }
    }
  }

  if (upserts.length === 0) {
    return NextResponse.json({ error: "No valid settings provided" }, { status: 400 });
  }

  const { error } = await supabase
    .from("platform_settings")
    .upsert(upserts, { onConflict: "key" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
