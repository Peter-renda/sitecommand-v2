/**
 * GET /api/auth/google/connect
 *
 * Kicks off the Google OAuth 2.0 authorization_code flow for Gmail.
 * Encodes the projectId in state so the callback can redirect the user
 * back to the right project Emails page.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { GMAIL_SCOPES } from "@/lib/gmail";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams, origin } = new URL(req.url);
  const projectId = searchParams.get("projectId") ?? "";

  const redirectUri = `${origin}/api/auth/google/callback`;
  const state = Buffer.from(JSON.stringify({ projectId })).toString("base64url");

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: GMAIL_SCOPES,
    state,
    // access_type=offline + prompt=consent guarantees a refresh_token is returned
    access_type: "offline",
    prompt: "consent select_account",
    include_granted_scopes: "true",
  });

  return NextResponse.redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`);
}
