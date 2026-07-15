/**
 * GET /api/integrations/erp/status
 *
 * Reports which accounting ERP the caller's company has connected so the UI can
 * label the "Resync with ERP" action and disable it when nothing is connected.
 * Only one ERP is meant to be connected at a time; when both happen to be
 * connected `connected` is "multiple" so the UI can surface the conflict.
 *
 * Auth: any authenticated company member.
 */

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getQBOCompanyCredentials, isQBOConfigured } from "@/lib/quickbooks";
import {
  getSage300CreAppCredentials,
  getSage300CreCompanyCredentials,
  isSage300CreConnected,
} from "@/lib/sage300cre";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.company_id) {
    return NextResponse.json({ quickbooks: false, sage300cre: false, connected: null });
  }

  const [qboCo, sageApp, sageCo] = await Promise.all([
    getQBOCompanyCredentials(session.company_id),
    getSage300CreAppCredentials(session.company_id),
    getSage300CreCompanyCredentials(session.company_id),
  ]);

  const quickbooks = isQBOConfigured(qboCo);
  const sage300cre = isSage300CreConnected(sageApp, sageCo);

  const connected: "quickbooks" | "sage300cre" | "multiple" | null =
    quickbooks && sage300cre ? "multiple" : quickbooks ? "quickbooks" : sage300cre ? "sage300cre" : null;

  return NextResponse.json({ quickbooks, sage300cre, connected });
}
