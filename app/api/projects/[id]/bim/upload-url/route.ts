import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { checkProjectAccess } from "@/lib/permissions";
import { getApsCredentials, getPlatformSetting } from "@/lib/platform-settings";

const APS_BASE = "https://developer.api.autodesk.com";

async function getApsToken(clientId: string, clientSecret: string, scope: string): Promise<string> {
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await fetch(`${APS_BASE}/authentication/v2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({ grant_type: "client_credentials", scope }),
  });

  if (!res.ok) throw new Error(`Failed to obtain APS token: ${await res.text()}`);
  const data = await res.json();
  return data.access_token;
}

async function ensureBucket(token: string, bucketKey: string): Promise<void> {
  const check = await fetch(`${APS_BASE}/oss/v2/buckets/${bucketKey}/details`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (check.status === 200) return;

  const create = await fetch(`${APS_BASE}/oss/v2/buckets`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ bucketKey, policyKey: "persistent" }),
  });

  if (!create.ok && create.status !== 409) {
    throw new Error(`Failed to create APS bucket: ${await create.text()}`);
  }
}

async function triggerTranslation(token: string, urn: string): Promise<void> {
  const res = await fetch(`${APS_BASE}/modelderivative/v2/designdata/job`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "x-ads-force": "true",
    },
    body: JSON.stringify({
      input: { urn },
      output: { formats: [{ type: "svf2", views: ["2d", "3d"] }] },
    }),
  });

  if (!res.ok) throw new Error(`Failed to trigger translation: ${await res.text()}`);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { clientId: apsClientId, clientSecret: apsClientSecret } = await getApsCredentials();
  if (!apsClientId || !apsClientSecret) {
    return NextResponse.json(
      { error: "APS credentials not configured. Set APS_CLIENT_ID and APS_CLIENT_SECRET." },
      { status: 503 }
    );
  }

  const { id: projectId } = await params;
  try {
    await checkProjectAccess(session.id, projectId);
  } catch {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const action = body.action as "start" | "complete";
    const apsBucketKey = await getPlatformSetting("APS_BUCKET_KEY");
    const bucketKey = apsBucketKey ?? `sitecommand-bim-${apsClientId.toLowerCase().slice(0, 20)}`;
    const token = await getApsToken(apsClientId, apsClientSecret, "data:read data:write data:create bucket:read bucket:create");

    await ensureBucket(token, bucketKey);

    if (action === "start") {
      const filename = String(body.filename ?? "");
      const contentType = String(body.contentType ?? "application/octet-stream");
      if (!filename) return NextResponse.json({ error: "Filename is required" }, { status: 400 });

      const allowedExtensions = [".dwg", ".rvt", ".ifc", ".nwd", ".nwc", ".dxf", ".dwf"];
      const ext = filename.toLowerCase().slice(filename.lastIndexOf("."));
      if (!allowedExtensions.includes(ext)) {
        return NextResponse.json(
          { error: `Unsupported file type. Allowed: ${allowedExtensions.join(", ")}` },
          { status: 400 }
        );
      }

      const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
      const objectKey = `${projectId}/${Date.now()}-${safeFilename}`;
      const encodedKey = encodeURIComponent(objectKey);

      const signRes = await fetch(
        `${APS_BASE}/oss/v2/buckets/${bucketKey}/objects/${encodedKey}/signeds3upload?minutesExpiration=60`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!signRes.ok) {
        return NextResponse.json(
          { error: `Failed to get signed upload URL: ${await signRes.text()}` },
          { status: 500 }
        );
      }

      const { uploadKey, urls } = await signRes.json();
      return NextResponse.json({ uploadUrl: urls[0], uploadKey, objectKey, bucketKey, contentType });
    }

    if (action === "complete") {
      const objectKey = String(body.objectKey ?? "");
      const uploadKey = String(body.uploadKey ?? "");
      const filename = String(body.filename ?? "");
      if (!objectKey || !uploadKey || !filename) {
        return NextResponse.json({ error: "Missing required upload completion fields" }, { status: 400 });
      }

      const encodedKey = encodeURIComponent(objectKey);
      const completeRes = await fetch(
        `${APS_BASE}/oss/v2/buckets/${bucketKey}/objects/${encodedKey}/signeds3upload`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ uploadKey }),
        }
      );

      if (!completeRes.ok) {
        return NextResponse.json(
          { error: `Failed to complete APS upload: ${await completeRes.text()}` },
          { status: 500 }
        );
      }

      const completeData = await completeRes.json();
      const rawUrn: string =
        completeData.objectId ?? `urn:adsk.objects:os.object:${bucketKey}/${objectKey}`;
      const urn = Buffer.from(rawUrn).toString("base64url");

      await triggerTranslation(token, urn);

      return NextResponse.json({ urn, aps_object_key: objectKey, filename });
    }

    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
