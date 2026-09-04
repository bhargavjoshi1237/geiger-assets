import { NextResponse } from "next/server";
import { storageAuth } from "@/lib/storage/auth";
import { commitUpload, isStorageConfigured } from "@/lib/storage/service";

export const runtime = "nodejs";

export async function POST(request) {
  const auth = await storageAuth();
  if (auth.response) return auth.response;

  if (!isStorageConfigured()) {
    return NextResponse.json({ error: "storage_unconfigured" }, { status: 503 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const { uploadJobId, key, assetId, checksum, name, type, folder, tags } = body ?? {};
  if (!uploadJobId || !key) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const result = await commitUpload({ uploadJobId, key, assetId, checksum, name, type, folder, tags });
  if (result.error === "not_committed") return NextResponse.json({ error: "not_committed" }, { status: 409 });
  if (result.error === "forbidden") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (result.error === "not_found") return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (result.error === "too_large") return NextResponse.json({ error: "too_large" }, { status: 413 });
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result);
}
