import { NextResponse } from "next/server";
import { storageAuth, requireProjectAccess } from "@/lib/storage/auth";
import { softDeleteAssetFile, purgeAssetFile, getAssetRow, getAssetRowAny } from "@/lib/storage/service";

export const runtime = "nodejs";

export async function DELETE(request) {
  const auth = await storageAuth();
  if (auth.response) return auth.response;

  let assetId;
  let purge = false;
  try {
    const body = await request.json().catch(() => null);
    const params = new URL(request.url).searchParams;
    assetId = body?.assetId || params.get("assetId");
    purge = body?.purge === true || params.get("purge") === "1";
  } catch {
    assetId = new URL(request.url).searchParams.get("assetId");
  }
  if (!assetId) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  // Purge runs from trash, where the live-row lookup no longer matches.
  const row = purge ? await getAssetRowAny(String(assetId)) : await getAssetRow(String(assetId));
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const access = await requireProjectAccess({ projectId: row.project_id, action: "delete" });
  if (access.response) return access.response;

  const ok = purge ? await purgeAssetFile(String(assetId)) : await softDeleteAssetFile(String(assetId));
  if (!ok) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true, purged: purge || undefined });
}
