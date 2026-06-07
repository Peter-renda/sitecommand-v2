/**
 * GET /api/auth/gmail/callback
 *
 * Handles Google's OAuth redirect. Exchanges the code for tokens,
 * fetches the user's Gmail profile, persists everything in
 * user_email_connections with provider='gmail', then redirects back
 * to the project Emails page.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO = "https://www.googleapis.com/oauth2/v2/userinfo";

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");
  const stateB64 = searchParams.get("state");
  const googleError = searchParams.get("error");

  if (googleError || !code || !stateB64) {
    return NextResponse.redirect(`${origin}/?error=gmail_denied`);
  }

  let projectId = "";
  try {
    const parsed = JSON.parse(Buffer.from(stateB64, "base64url").toString("utf-8"));
    projectId = parsed.projectId ?? "";
  } catch {
    return NextResponse.redirect(`${origin}/?error=gmail_invalid_state`);
  }

  const returnBase = projectId
    ? `${origin}/projects/${projectId}/emails`
    : `${origin}/dashboard`;

  const session = await getSession();
  if (!session) return NextResponse.redirect(`${origin}/login`);

  const redirectUri = `${origin}/api/auth/gmail/callback`;

  // Exchange code for tokens
  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      code,
      redirect_uri: redirectUri,
    }).toString(),
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(`${returnBase}?error=gmail_token_failed`);
  }

  const tokens = (await tokenRes.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };

  if (!tokens.access_token) {
    return NextResponse.redirect(`${returnBase}?error=gmail_token_failed`);
  }

  // Fetch Google user profile
  let userEmail = "";
  let userDisplayName = "";
  try {
    const infoRes = await fetch(GOOGLE_USERINFO, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (infoRes.ok) {
      const info = (await infoRes.json()) as { email?: string; name?: string };
      userEmail = info.email ?? "";
      userDisplayName = info.name ?? "";
    }
  } catch {
    // non-fatal
  }

  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  const supabase = getSupabase();
  await supabase.from("user_email_connections").upsert(
    [
      {
        user_id: session.id,
        provider: "gmail",
        ms_user_email: userEmail,
        ms_user_display_name: userDisplayName,
        access_token: tokens.access_token,
        // Google only sends refresh_token on first consent — keep existing if absent
        refresh_token: tokens.refresh_token ?? "",
        token_expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      },
    ],
    { onConflict: "user_id,provider" }
  );

  return NextResponse.redirect(`${returnBase}?connected=gmail`);
}
