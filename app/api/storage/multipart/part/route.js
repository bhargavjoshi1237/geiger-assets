import { NextResponse } from "next/server";
import { requireProjectAccess } from "@/lib/storage/auth";
import { isStorageConfigured } from "@/lib/storage/service";
import { s3Config } from "@/lib/s3/config";
import { parseKey } from "@/lib/s3/keys";
import { MULTIPART_MAX_PARTS, signPartUrl, uploadPart } from "@/lib/s3/multipart";

export const runtime = "nodejs";

// PROXY_MAX_BYTES caps whole-file form uploads; parts proxy one chunk at a
// time through server memory, so this ceiling bounds per-request RAM instead.
// Sized above the planner's 8 MiB nominal part — S3 itself rejects a non-final
// part under 5 MiB at complete time, so no floor check here.
const PART_PROXY_MAX_BYTES = 64 * 1024 * 1024;

export async function POST(request) {
  if (!isStorageConfigured()) {
    return NextResponse.json({ error: "storage_unconfigured" }, { status: 503 });
  }

  const params = new URL(request.url).searchParams;
  const uploadId = params.get("uploadId");
  const key = params.get("key");
  const partNumber = Number(params.get("partNumber"));
  if (!uploadId || !key || !Number.isInteger(partNumber) || partNumber < 1 || partNumber > MULTIPART_MAX_PARTS) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  // Ownership is re-derived from the key, never trusted from the body: the
  // project segment decides whose membership (and whose edit right) applies.
  const parsed = parseKey(key);
  if (!parsed?.projectId) return NextResponse.json({ error: "bad_key" }, { status: 400 });
  const access = await requireProjectAccess({ projectId: parsed.projectId, action: "write" });
  if (access.response) return access.response;

  if (s3Config().presignedUploads) {
    const url = await signPartUrl(key, uploadId, partNumber);
    if (!url) return NextResponse.json({ error: "sign_failed" }, { status: 400 });
    return NextResponse.json({ url, partNumber });
  }

  let bytes;
  try {
    bytes = await request.arrayBuffer();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  if (!bytes || bytes.byteLength === 0) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  if (bytes.byteLength > PART_PROXY_MAX_BYTES) {
    return NextResponse.json({ error: "too_large" }, { status: 413 });
  }

  const stored = await uploadPart(key, uploadId, partNumber, Buffer.from(bytes));
  if (!stored) return NextResponse.json({ error: "part_failed" }, { status: 400 });
  return NextResponse.json({ partNumber: stored.partNumber, etag: stored.etag });
}
