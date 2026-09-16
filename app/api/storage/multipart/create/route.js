import { NextResponse } from "next/server";
import { requireProjectAccess } from "@/lib/storage/auth";
import { isStorageConfigured } from "@/lib/storage/service";
import { assetTypeForContentType, isAllowedContentType, s3Config } from "@/lib/s3/config";
import { assetKey, stagingKey } from "@/lib/s3/keys";
import { createMultipart, planParts, MULTIPART_MAX_OBJECT_SIZE } from "@/lib/s3/multipart";
import { createServerSupabase } from "@/lib/supabase/server";

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

  const size = Number(sizeBytes);
  if (!Number.isFinite(size) || size <= 0 || size > MULTIPART_MAX_OBJECT_SIZE) {
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
      const sb = await createServerSupabase();
      const { data: asset } = await sb.schema("assets").from("assets")
        .select("id, project_id").eq("id", assetId).is("deleted_at", null).single();
      if (!asset) throw new Error("unknown asset");
      if (asset.project_id && asset.project_id !== projectId) throw new Error("project mismatch");
      const { data: latest } = await sb.schema("assets").from("asset_versions")
        .select("version_number").eq("asset_id", assetId).order("version_number", { ascending: false }).limit(1);
      key = assetKey({ projectId, assetId, versionNumber: (latest?.[0]?.version_number ?? 0) + 1, filename });
    } else {
      key = stagingKey({ projectId, uploadJobId, filename });
    }
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const created = await createMultipart(key, { contentType });
  if (!created) return NextResponse.json({ error: "create_failed" }, { status: 400 });

  const mode = s3Config().presignedUploads ? "presigned" : "proxy";
  try {
    const sb = await createServerSupabase();
    const { error } = await sb.schema("assets").from("upload_jobs").upsert({
      id: uploadJobId,
      project_id: projectId,
      filename,
      file_type: assetTypeForContentType(contentType, filename) || "image",
      size_bytes: size,
      status: "uploading",
      storage_key: key,
      upload_mode: mode,
    }, { onConflict: "id" });
    if (error) console.error("[storage.multipart.create]", error.message);
  } catch (e) {
    console.error("[storage.multipart.create]", e);
  }

  return NextResponse.json({
    uploadId: created.uploadId,
    key,
    partSize: plan.partSize,
    partCount: plan.partCount,
    mode,
  });
}
