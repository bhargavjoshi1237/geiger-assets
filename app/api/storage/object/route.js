import { NextResponse } from "next/server";
import { storageAuth } from "@/lib/storage/auth";
import { softDeleteAssetFile } from "@/lib/storage/service";

export const runtime = "nodejs";

export async function DELETE(request) {
  const auth = await storageAuth();
  if (auth.response) return auth.response;

  let assetId;
  try {
    const body = await request.json().catch(() => null);
    assetId = body?.assetId || new URL(request.url).searchParams.get("assetId");
  } catch {
    assetId = new URL(request.url).searchParams.get("assetId");
  }
  if (!assetId) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const ok = await softDeleteAssetFile(String(assetId));
  if (!ok) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
