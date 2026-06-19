/**
 * POST /api/integrations/buildingconnected/disconnect
 *
 * Clears the company's stored BuildingConnected (APS 3-legged) tokens and
 * connection metadata from company_integrations. The platform-level APS app
 * credentials are untouched, so the company can reconnect without re-entering
 * anything.
 *
 * Auth: company super_admin or site_admin.
 */

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { disconnectBuildingConnected } from "@/lib/buildingconnected";

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.company_role !== "super_admin" && session.role !== "site_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!session.company_id) {
    return NextResponse.json({ error: "No company associated with this account" }, { status: 422 });
  }

  await disconnectBuildingConnected(session.company_id);
  return NextResponse.json({ ok: true });
}
