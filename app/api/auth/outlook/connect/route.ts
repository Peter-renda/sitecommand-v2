/**
 * GET /api/auth/outlook/connect
 *
 * Kicks off the Microsoft OAuth 2.0 authorization_code flow.
 * Encodes the projectId in state so the callback can redirect the user
 * back to the right project Emails page.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

const MS_AUTH_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";
const SCOPES = "Mail.Read Mail.ReadWrite Mail.Send offline_access User.Read";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams, origin } = new URL(req.url);
  const projectId = searchParams.get("projectId") ?? "";

  const redirectUri = `${origin}/api/auth/outlook/callback`;
  const state = Buffer.from(JSON.stringify({ projectId })).toString("base64url");

  const params = new URLSearchParams({
    client_id: process.env.MICROSOFT_CLIENT_ID!,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: SCOPES,
    response_mode: "query",
    state,
    // prompt=select_account lets users pick which MS account to connect
    prompt: "select_account",
  });

  return NextResponse.redirect(`${MS_AUTH_URL}?${params.toString()}`);
}
