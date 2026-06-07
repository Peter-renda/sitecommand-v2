/**
 * GET /api/auth/gmail/connect
 *
 * Kicks off Google OAuth 2.0 authorization_code flow for Gmail access.
 * access_type=offline ensures we get a refresh token on first consent.
 * prompt=consent forces the consent screen every time so we always get
 * a fresh refresh token (Google only issues it on first grant otherwise).
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
].join(" ");

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams, origin } = new URL(req.url);
  const projectId = searchParams.get("projectId") ?? "";

  const redirectUri = `${origin}/api/auth/gmail/callback`;
  const state = Buffer.from(JSON.stringify({ projectId })).toString("base64url");

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent",
    state,
  });

  return NextResponse.redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`);
}
