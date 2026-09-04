import { NextResponse } from "next/server";
import { storageAuth } from "@/lib/storage/auth";
import { authorizeKey, proxyStreamResponse, isStorageConfigured } from "@/lib/storage/service";

export const runtime = "nodejs";

// Same-origin read proxy: streams bytes for an authorized key. This is the
// read path for gateways without presigned GETs (Appwrite answers those with
// 501), and the target batchSign() points at when presigned reads are off.
export async function GET(request) {
  const auth = await storageAuth();
  if (auth.response) return auth.response;

  if (!isStorageConfigured()) {
    return NextResponse.json({ error: "storage_unconfigured" }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key");
  if (!key) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const parsed = await authorizeKey(key, auth.userId);
  if (!parsed) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const res = await proxyStreamResponse(key, {
    filename: key.split("/").pop(),
    download: searchParams.get("download") === "1",
    request,
  });
  if (!res) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return res;
}
