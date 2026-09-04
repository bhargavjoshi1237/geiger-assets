if (typeof window !== "undefined") {
  throw new Error("lib/storage/service is server-only — import lib/storage/client on the browser.");
}

import { createServerSupabase } from "@/lib/supabase/server";
import {
  isS3Configured,
  s3Config,
  isAllowedContentType,
  assetTypeForContentType,
} from "@/lib/s3/config";
import { headObject, putObject, signGetUrl, signPutUrl, invalidateAssetCache } from "@/lib/s3/objects";
import { assetKey, stagingKey, parseKey } from "@/lib/s3/keys";

export const PROXY_MAX_BYTES = 4 * 1024 * 1024;
export const SIGN_BATCH_LIMIT = 100;

export function isStorageConfigured() {
  return isS3Configured();
}

export async function safeUpdateTag(tag) {
  try {
    const mod = await import("next/cache").catch(() => null);
    const fn = mod?.updateTag || mod?.updateCacheTag;
    if (typeof fn === "function") await fn(tag);
  } catch {
    /* next cache tags unavailable — correctness never depends on them */
  }
}

function serverDb() {
  return createServerSupabase();
}

export function attachmentDispositionFor(contentType, filename) {
  const ct = String(contentType || "").toLowerCase().split(";")[0].trim();
  const media =
    ct.startsWith("image/") || ct.startsWith("video/") || ct.startsWith("audio/") || ct === "application/pdf";
  if (media) return undefined;
  const safe = String(filename || "file").replace(/"/g, "");
  return `attachment; filename="${safe}"`;
}

export async function getAssetRow(id) {
  if (!id) return null;
  try {
    const sb = await serverDb();
    const { data, error } = await sb.schema("assets").from("assets").select("*").eq("id", id).is("deleted_at", null).single();
    if (error) {
      console.error("[storage.getAsset]", error.message);
      return null;
    }
    return data;
  } catch (e) {
    console.error("[storage.getAsset]", e);
    return null;
  }
}

export async function getAssetWithStorage(id) {
  const row = await getAssetRow(id);
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    name: row.name ?? "",
    type: row.type ?? "image",
    format: row.format ?? "",
    sizeBytes: Number(row.size_bytes ?? 0),
    folder: row.folder ?? "root",
    status: row.status ?? "draft",
    storageKey: row.storage_key ?? null,
    storageBucket: row.storage_bucket ?? null,
    storageStatus: row.storage_status ?? "none",
    etag: row.etag ?? null,
    checksum: row.checksum ?? null,
    mimeType: row.mime_type ?? "",
    originalFilename: row.original_filename ?? "",
  };
}

async function upsertUploadJob({ uploadJobId, projectId, filename, fileType, sizeBytes, storageKey, mode, status }) {
  try {
    const sb = await serverDb();
    const payload = {
      id: uploadJobId,
      project_id: projectId,
      filename,
      file_type: fileType,
      size_bytes: sizeBytes,
      status,
      storage_key: storageKey,
      upload_mode: mode,
    };
    const { error } = await sb.schema("assets").from("upload_jobs").upsert(payload, { onConflict: "id" });
    if (error) console.error("[storage.uploadJob]", error.message);
  } catch (e) {
    console.error("[storage.uploadJob]", e);
  }
}

export async function markJob(id, patch) {
  if (!id) return;
  try {
    const sb = await serverDb();
    const row = {};
    if (patch.status !== undefined) row.status = patch.status;
    if (patch.progress !== undefined) row.progress = patch.progress;
    if (patch.error !== undefined) row.error = patch.error;
    if (patch.storageKey !== undefined) row.storage_key = patch.storageKey;
    if (patch.assetId !== undefined) row.asset_id = patch.assetId;
    const { error } = await sb.schema("assets").from("upload_jobs").update(row).eq("id", id);
    if (error) console.error("[storage.markJob]", error.message);
  } catch (e) {
    console.error("[storage.markJob]", e);
  }
}

async function nextVersionKey({ projectId, assetId, filename }) {
  const sb = await serverDb();
  const { data: asset } = await sb.schema("assets").from("assets")
    .select("id, project_id").eq("id", assetId).is("deleted_at", null).single();
  if (!asset) throw new Error("unknown asset");
  if (asset.project_id && asset.project_id !== projectId) throw new Error("project mismatch");
  const { data: latest } = await sb.schema("assets").from("asset_versions")
    .select("version_number").eq("asset_id", assetId).order("version_number", { ascending: false }).limit(1);
  const versionNumber = (latest?.[0]?.version_number ?? 0) + 1;
  return assetKey({ projectId, assetId, versionNumber, filename });
}

export async function issueUploadUrl({ projectId, assetId, filename, contentType, sizeBytes, uploadJobId }) {
  if (!isS3Configured()) return { error: "storage_unconfigured" };
  const cfg = s3Config();
  const size = Number(sizeBytes) || 0;
  if (size <= 0 || size > cfg.maxUploadBytes) return { error: "too_large" };
  if (!isAllowedContentType(contentType, filename)) return { error: "unsupported_type" };
  if (!projectId || !filename || !uploadJobId) return { error: "bad_request" };

  let key;
  try {
    if (assetId) {
      key = await nextVersionKey({ projectId, assetId, filename });
    } else {
      key = stagingKey({ projectId, uploadJobId, filename });
    }
  } catch {
    return { error: "bad_request" };
  }
  const url = await signPutUrl(key, { ttl: cfg.uploadUrlTtl, contentType, maxBytes: size });
  if (!url) return { error: "sign_failed" };

  const fileType = assetTypeForContentType(contentType, filename) || "image";
  await upsertUploadJob({
    uploadJobId, projectId, filename, fileType, sizeBytes: size,
    storageKey: key, mode: "presigned", status: "uploading",
  });
  await markJob(uploadJobId, { progress: 5 });
  return {
    url, key, mode: "presigned",
    expiresAt: new Date(Date.now() + cfg.uploadUrlTtl * 1000).toISOString(),
  };
}

function toAssetInsert({ projectId, key, head, checksum, name, type, folder, tags, filename, contentType }) {
  return {
    project_id: projectId,
    name: name || filename,
    type: type || assetTypeForContentType(contentType, filename) || "image",
    format: String(filename?.split(".").pop() || "").toUpperCase().slice(0, 12),
    size_bytes: head.size,
    folder: folder || "root",
    status: "draft",
    tags: Array.isArray(tags) ? tags : [],
    storage_key: key,
    storage_bucket: s3Config().bucket,
    storage_status: "stored",
    etag: head.etag,
    checksum: checksum || null,
    mime_type: head.contentType || contentType || "",
    original_filename: filename,
  };
}

export async function commitUpload({ uploadJobId, key, assetId, checksum, name, type, folder, tags }) {
  if (!key || !uploadJobId) return { error: "bad_request" };
  const parsed = parseKey(key);
  if (!parsed?.projectId) return { error: "bad_key" };

  const head = await headObject(key);
  if (!head) {
    await markJob(uploadJobId, { status: "failed", error: "Object not found in storage" });
    return { error: "not_committed" };
  }

  const cfg = s3Config();
  if (head.size > cfg.maxUploadBytes) {
    await markJob(uploadJobId, { status: "failed", error: "Object exceeds size ceiling" });
    return { error: "too_large" };
  }

  const projectId = parsed.projectId;
  const filename = key.split("/").pop() || name || "file";
  if (parsed.assetId && assetId && parsed.assetId !== assetId) {
    await markJob(uploadJobId, { status: "failed", error: "Key does not belong to this asset" });
    return { error: "forbidden" };
  }

  try {
    const sb = await serverDb();
    let assetRow = null;

    if (assetId) {
      const existing = await sb.schema("assets").from("assets").select("*").eq("id", assetId).is("deleted_at", null).single();
      if (existing.error || !existing.data) {
        await markJob(uploadJobId, { status: "failed", error: "Asset not found" });
        return { error: "not_found" };
      }
      if (existing.data.project_id && existing.data.project_id !== projectId) {
        await markJob(uploadJobId, { status: "failed", error: "Project mismatch" });
        return { error: "forbidden" };
      }
      const { data, error } = await sb.schema("assets").from("assets").update({
        storage_key: key,
        storage_bucket: cfg.bucket,
        storage_status: "stored",
        etag: head.etag,
        ...(checksum ? { checksum } : {}),
        mime_type: head.contentType || "",
        size_bytes: head.size,
        original_filename: filename,
      }).eq("id", assetId).select("*").single();
      if (error) {
        console.error("[storage.commit]", error.message);
        await markJob(uploadJobId, { status: "failed", error: error.message });
        return { error: "db_failed" };
      }
      assetRow = data;
    } else {
      const { data, error } = await sb.schema("assets").from("assets").insert(
        toAssetInsert({ projectId, key, head, checksum, name, type, folder, tags, filename, contentType: head.contentType })
      ).select("*").single();
      if (error) {
        console.error("[storage.commit]", error.message);
        await markJob(uploadJobId, { status: "failed", error: error.message });
        return { error: "db_failed" };
      }
      assetRow = data;
      assetId = data.id;
    }

    const current = await sb.schema("assets").from("asset_versions")
      .select("version_number").eq("asset_id", assetId).order("version_number", { ascending: false }).limit(1);
    const keyedVersion = parsed.assetId === assetId && Number.isInteger(parsed.versionNumber) ? parsed.versionNumber : null;
    const nextVersion = keyedVersion ?? ((current.data?.[0]?.version_number ?? 0) + 1);
    await sb.schema("assets").from("asset_versions").update({ is_current: false }).eq("asset_id", assetId);
    const { error: versionError } = await sb.schema("assets").from("asset_versions").insert({
      asset_id: assetId,
      version_number: nextVersion,
      label: name || `v${nextVersion}`,
      is_current: true,
      size_bytes: head.size,
      storage_key: key,
      etag: head.etag,
      ...(checksum ? { checksum } : {}),
      mime_type: head.contentType || "",
    });
    if (versionError) {
      console.error("[storage.commit]", versionError.message);
      await markJob(uploadJobId, { status: "failed", error: versionError.message });
      return { error: "db_failed" };
    }

    await markJob(uploadJobId, { status: "complete", progress: 100, assetId });
    invalidateAssetCache(key);
    await safeUpdateTag(`asset:${assetId}`);
    if (projectId) await safeUpdateTag(`assets:${projectId}`);

    return {
      asset: {
        id: assetRow.id,
        projectId: assetRow.project_id ?? null,
        name: assetRow.name ?? "",
        type: assetRow.type ?? "image",
        sizeBytes: Number(assetRow.size_bytes ?? 0),
        folder: assetRow.folder ?? "root",
        status: assetRow.status ?? "draft",
        storageKey: assetRow.storage_key ?? key,
        storageStatus: assetRow.storage_status ?? "stored",
        etag: assetRow.etag ?? head.etag,
        checksum: assetRow.checksum ?? checksum ?? null,
        mimeType: assetRow.mime_type ?? "",
      },
    };
  } catch (e) {
    console.error("[storage.commit]", e);
    await markJob(uploadJobId, { status: "failed", error: "Commit failed" });
    return { error: "db_failed" };
  }
}

export async function proxyStore({ projectId, uploadJobId, filename, contentType, bytes, assetId, name, type, folder, tags, checksum }) {
  if (!isS3Configured()) return { error: "storage_unconfigured" };
  const size = bytes?.length ?? bytes?.byteLength ?? 0;
  if (size <= 0) return { error: "bad_request" };
  if (size > PROXY_MAX_BYTES) return { error: "too_large" };
  const cfg = s3Config();
  if (size > cfg.maxUploadBytes) return { error: "too_large" };
  if (!isAllowedContentType(contentType, filename)) return { error: "unsupported_type" };

  let key;
  try {
    key = stagingKey({ projectId, uploadJobId, filename });
  } catch {
    return { error: "bad_request" };
  }
  const fileType = assetTypeForContentType(contentType, filename) || "image";
  await upsertUploadJob({
    uploadJobId, projectId, filename, fileType, sizeBytes: size,
    storageKey: key, mode: "proxy", status: "uploading",
  });
  const stored = await putObject({
    key, body: bytes, contentType,
    contentDisposition: attachmentDispositionFor(contentType, filename),
  });
  if (!stored) {
    await markJob(uploadJobId, { status: "failed", error: "Proxy upload failed" });
    return { error: "put_failed" };
  }
  return commitUpload({ uploadJobId, key, assetId, checksum, name: name || filename, type, folder, tags });
}

export async function authorizeKey(key, sessionUserId) {
  const parsed = parseKey(key);
  if (!parsed?.projectId) return null;
  if (!sessionUserId) return null;
  try {
    const sb = await serverDb();
    if (parsed.assetId) {
      const { data } = await sb.schema("assets").from("assets")
        .select("id, project_id").eq("id", parsed.assetId).is("deleted_at", null).single();
      if (!data || (data.project_id && data.project_id !== parsed.projectId)) return null;
    } else if (parsed.staging && parsed.uploadJobId) {
      const { data } = await sb.schema("assets").from("upload_jobs")
        .select("id, project_id").eq("id", parsed.uploadJobId).single();
      if (data?.project_id && data.project_id !== parsed.projectId) return null;
    }
    return parsed;
  } catch (e) {
    console.error("[storage.authorize]", e);
    return null;
  }
}

export async function batchSign(keys, sessionUserId) {
  const cfg = isS3Configured() ? s3Config() : null;
  const urls = {};
  const list = Array.isArray(keys) ? keys.slice(0, SIGN_BATCH_LIMIT) : [];
  for (const key of list) {
    const ok = await authorizeKey(key, sessionUserId);
    if (!ok || !cfg) {
      urls[key] = null;
      continue;
    }
    urls[key] = await signGetUrl(key);
  }
  return { urls, expiresAt: cfg ? new Date(Date.now() + cfg.signedUrlTtl * 1000).toISOString() : null };
}

export async function softDeleteAssetFile(assetId) {
  if (!assetId) return false;
  try {
    const sb = await serverDb();
    const row = await getAssetRow(assetId);
    if (!row) return false;
    const { error } = await sb.schema("assets").from("assets")
      .update({ deleted_at: new Date().toISOString() }).eq("id", assetId);
    if (error) {
      console.error("[storage.delete]", error.message);
      return false;
    }
    if (row.storage_key) invalidateAssetCache(row.storage_key);
    await safeUpdateTag(`asset:${assetId}`);
    if (row.project_id) await safeUpdateTag(`assets:${row.project_id}`);
    return true;
  } catch (e) {
    console.error("[storage.delete]", e);
    return false;
  }
}
