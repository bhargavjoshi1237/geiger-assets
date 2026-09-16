import { NextResponse } from "next/server";
import { requireProjectAccess } from "@/lib/storage/auth";
import { isStorageConfigured } from "@/lib/storage/service";
import { parseKey } from "@/lib/s3/keys";
import { listParts } from "@/lib/s3/multipart";

export const runtime = "nodejs";

export async function GET(request) {
  if (!isStorageConfigured()) {
    return NextResponse.json({ error: "storage_unconfigured" }, { status: 503 });
  }

  const params = new URL(request.url).searchParams;
  const uploadId = params.get("uploadId");
  const key = params.get("key");
  if (!uploadId || !key) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  // Ownership is re-derived from the key, never trusted from the body: the
  // project segment decides whose membership (and whose edit right) applies.
  const parsed = parseKey(key);
  if (!parsed?.projectId) return NextResponse.json({ error: "bad_key" }, { status: 400 });
  const access = await requireProjectAccess({ projectId: parsed.projectId, action: "write" });
  if (access.response) return access.response;

  const parts = await listParts(key, uploadId);
  if (!parts) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ parts });
}
