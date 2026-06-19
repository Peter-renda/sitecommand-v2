/**
 * GET /api/integrations/buildingconnected/status
 *
 * Reports the BuildingConnected connection state for the caller's company so the
 * Preconstruction page can render the connect / connected card. Reads stored
 * values only (fast — no token refresh or remote call).
 *
 * - `configured`: platform-level APS app credentials are present.
 * - `connected`:  the company has stored BuildingConnected tokens.
 * - `canManage`:  the caller may connect/disconnect (super_admin / site_admin).
 *
 * Auth: any authenticated user (the connect/disconnect actions are themselves
 * gated to super_admin/site_admin).
 */

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  getBuildingConnectedAppCredentials,
  isBuildingConnectedAppConfigured,
  getBuildingConnectedConnection,
  isBuildingConnectedConnected,
} from "@/lib/buildingconnected";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canManage =
    session.company_role === "super_admin" || session.role === "site_admin";

  if (!session.company_id) {
    return NextResponse.json({
      configured: false,
      connected: false,
      canManage,
      user: null,
      connectedAt: null,
    });
  }

  const [appCreds, conn] = await Promise.all([
    getBuildingConnectedAppCredentials(),
    getBuildingConnectedConnection(session.company_id),
  ]);

  const connected = isBuildingConnectedConnected(conn);

  return NextResponse.json({
    configured: isBuildingConnectedAppConfigured(appCreds),
    connected,
    canManage,
    user: connected ? { name: conn.userName, email: conn.userEmail } : null,
    connectedAt: conn.connectedAt,
  });
}
