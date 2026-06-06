/**
 * GET /api/auth/outlook/callback
 *
 * Handles Microsoft's OAuth redirect after the user grants consent.
 * Exchanges the code for tokens, fetches the user's MS profile,
 * stores everything in user_email_connections, then redirects back
 * to the project Emails page (or dashboard if no projectId in state).
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";

const MS_TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
const GRAPH_ME = "https://graph.microsoft.com/v1.0/me";

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");
  const stateB64 = searchParams.get("state");
  const msError = searchParams.get("error");

  if (msError || !code || !stateB64) {
    return NextResponse.redirect(`${origin}/?error=outlook_denied`);
  }

  let projectId = "";
  try {
    const parsed = JSON.parse(Buffer.from(stateB64, "base64url").toString("utf-8"));
    projectId = parsed.projectId ?? "";
  } catch {
    return NextResponse.redirect(`${origin}/?error=outlook_invalid_state`);
  }

  const returnBase = projectId ? `${origin}/projects/${projectId}/emails` : `${origin}/dashboard`;

  const session = await getSession();
  if (!session) {
    return NextResponse.redirect(`${origin}/login`);
  }

  const redirectUri = `${origin}/api/auth/outlook/callback`;

  // Exchange authorization code for tokens
  const tokenRes = await fetch(MS_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: process.env.MICROSOFT_CLIENT_ID!,
      client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
      code,
      redirect_uri: redirectUri,
      scope: "Mail.Read Mail.ReadWrite offline_access User.Read",
    }).toString(),
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(`${returnBase}?error=outlook_token_failed`);
  }

  const tokens = (await tokenRes.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  if (!tokens.access_token || !tokens.refresh_token) {
    return NextResponse.redirect(`${returnBase}?error=outlook_token_failed`);
  }

  // Fetch MS user profile (non-fatal — we still store tokens if this fails)
  let msEmail = "";
  let msDisplayName = "";
  try {
    const meRes = await fetch(GRAPH_ME, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (meRes.ok) {
      const me = (await meRes.json()) as {
        mail?: string;
        userPrincipalName?: string;
        displayName?: string;
      };
      msEmail = me.mail ?? me.userPrincipalName ?? "";
      msDisplayName = me.displayName ?? "";
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
        provider: "outlook",
        ms_user_email: msEmail,
        ms_user_display_name: msDisplayName,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      },
    ],
    { onConflict: "user_id,provider" }
  );

  return NextResponse.redirect(`${returnBase}?connected=outlook`);
}
