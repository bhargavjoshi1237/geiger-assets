import { NextResponse } from "next/server";
import { requireProjectAccess } from "@/lib/storage/auth";
import { isStorageConfigured, nextVersionKey, upsertUploadJob } from "@/lib/storage/service";
import { assetTypeForContentType, isAllowedContentType, s3Config } from "@/lib/s3/config";
import { stagingKey } from "@/lib/s3/keys";
import { createMultipart, planParts, MULTIPART_MAX_OBJECT_SIZE } from "@/lib/s3/multipart";
import { throttle } from "@/lib/storage/throttle";

export const runtime = "nodejs";

export async function POST(request) {
  if (!isStorageConfigured()) {
    return NextResponse.json({ error: "storage_unconfigured" }, { status: 503 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const { projectId, uploadJobId, filename, contentType, sizeBytes, assetId } = body ?? {};
  if (!projectId || !uploadJobId || !filename || !contentType || !sizeBytes) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const access = await requireProjectAccess({ projectId, action: "write" });
  if (access.response) return access.response;

  const limited = throttle("uploadUrl", access.userId);
  if (limited) return limited;

  const size = Number(sizeBytes);
  // MULTIPART_MAX_OBJECT_SIZE is the protocol ceiling (5 TiB); maxUploadBytes is
  // what this deployment actually allows. Checking only the former would let
  // multipart walk straight past the limit every other upload path enforces.
  const cfg = s3Config();
  if (!Number.isFinite(size) || size <= 0 || size > MULTIPART_MAX_OBJECT_SIZE || size > cfg.maxUploadBytes) {
    return NextResponse.json({ error: "too_large" }, { status: 413 });
  }
  const plan = planParts(size);
  if (!plan) return NextResponse.json({ error: "too_large" }, { status: 413 });
  if (!isAllowedContentType(contentType, filename)) {
    return NextResponse.json({ error: "unsupported_type" }, { status: 415 });
  }

  let key;
  try {
    if (assetId) {
      key = await nextVersionKey({ projectId, assetId, filename });
    } else {
      key = stagingKey({ projectId, uploadJobId, filename });
    }
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const created = await createMultipart(key, { contentType });
  if (!created) return NextResponse.json({ error: "create_failed" }, { status: 400 });

  const mode = cfg.presignedUploads ? "presigned" : "proxy";
  await upsertUploadJob({
    uploadJobId,
    projectId,
    filename,
    fileType: assetTypeForContentType(contentType, filename) || "image",
    sizeBytes: size,
    storageKey: key,
    mode,
    status: "uploading",
  });

  return NextResponse.json({
    uploadId: created.uploadId,
    key,
    partSize: plan.partSize,
    partCount: plan.partCount,
    mode,
  });
}
