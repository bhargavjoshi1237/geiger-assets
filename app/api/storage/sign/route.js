import { NextResponse } from "next/server";
import { storageAuth } from "@/lib/storage/auth";
import { batchSign, SIGN_BATCH_LIMIT, isStorageConfigured } from "@/lib/storage/service";
import { s3Config } from "@/lib/s3/config";

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

  const keys = body?.keys;
  if (!Array.isArray(keys) || keys.length === 0) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const result = await batchSign(keys.slice(0, SIGN_BATCH_LIMIT), auth.userId);
  const ttl = s3Config().signedUrlTtl;
  return NextResponse.json(result, {
    headers: { "Cache-Control": `private, max-age=${Math.max(ttl - 600, 60)}` },
  });
}
