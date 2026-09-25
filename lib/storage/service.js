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
import { signGetUrl, invalidateAssetCache } from "@/lib/s3/objects";
import { assetKey, stagingKey, parseKey } from "@/lib/s3/keys";
import { hasProjectGrant } from "@/lib/storage/auth";
import { backendForRef, refFromAssetRow, writeBackend } from "@/lib/storage/backends/index.js";
import { backend as localS3Backend } from "@/lib/storage/backends/local-s3.js";
import { backend as poolBackend } from "@/lib/storage/backends/pool.js";
import { thumbnailAdminClient, removeThumbnailUrls } from "@/lib/storage/thumbnail-store";
import { Readable } from "node:stream";

export const PROXY_MAX_BYTES = 4 * 1024 * 1024;
export const SIGN_BATCH_LIMIT = 100;

export function isStorageConfigured() {
  return isS3Configured() || poolBackend.isConfigured();
}

export async function safeUpdateTag(tag) {
  try {
    const mod = await import("next/cache").catch(() => null);
    const fn = mod?.updateTag || mod?.updateCacheTag;
    if (typeof fn === "function") await fn(tag);
  } catch {
  }
}

function serverDb() {
  return createServerSupabase();
}

const NEVER_INLINE = new Set([
  "image/svg+xml",
  "image/svg",
  "text/html",
  "text/xml",
  "application/xhtml+xml",
  "application/xml",
]);

export function isNeverInline(contentType) {
  return NEVER_INLINE.has(String(contentType || "").toLowerCase().split(";")[0].trim());
}

export function attachmentDispositionFor(contentType, filename) {
  const ct = String(contentType || "").toLowerCase().split(";")[0].trim();
  const media =
    ct.startsWith("image/") || ct.startsWith("video/") || ct.startsWith("audio/") || ct === "application/pdf";
  if (media && !NEVER_INLINE.has(ct)) return undefined;
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

async function upsertUploadJob({ uploadJobId, projectId, filename, fileType, sizeBytes, storageKey, mode, status, poolUploadId, poolFileId }) {
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
    // Pool columns exist after the asset_pool_placement migration; retry
    // without them if the DB has not migrated yet so uploads never break.
    const withPool = { ...payload };
    if (poolUploadId !== undefined) withPool.pool_upload_id = poolUploadId;
    if (poolFileId !== undefined) withPool.pool_file_id = poolFileId;
    const wantsPool = withPool.pool_upload_id !== undefined || withPool.pool_file_id !== undefined;
    const { error } = await sb.schema("assets").from("upload_jobs").upsert(wantsPool ? withPool : payload, { onConflict: "id" });
    if (error && wantsPool && /pool_upload_id|pool_file_id/.test(error.message || "")) {
      const retry = await sb.schema("assets").from("upload_jobs").upsert(payload, { onConflict: "id" });
      if (retry.error) console.error("[storage.uploadJob]", retry.error.message);
    } else if (error) {
      console.error("[storage.uploadJob]", error.message);
    }
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
  if (asset.project_id !== projectId) throw new Error("project mismatch");
  const { data: latest } = await sb.schema("assets").from("asset_versions")
    .select("version_number").eq("asset_id", assetId).order("version_number", { ascending: false }).limit(1);
  const versionNumber = (latest?.[0]?.version_number ?? 0) + 1;
  return assetKey({ projectId, assetId, versionNumber, filename });
}

export async function issueUploadUrl({ projectId, assetId, filename, contentType, sizeBytes, uploadJobId }) {
  if (!isStorageConfigured()) return { error: "storage_unconfigured" };
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
  const fileType = assetTypeForContentType(contentType, filename) || "image";
  const backend = writeBackend();
  const issued = await backend.issueUpload({ key, contentType, sizeBytes: size });
  if (issued?.error) return { error: issued.error };

  const poolUploadId = issued?.uploadRef?.uploadId || null;
  const jobMode = issued.mode === "proxy" ? "proxy" : "presigned";
  await upsertUploadJob({
    uploadJobId, projectId, filename, fileType, sizeBytes: size,
    storageKey: key, mode: jobMode, status: "uploading",
    ...(poolUploadId ? { poolUploadId } : {}),
  });
  if (jobMode === "proxy" && backend.id === "s3") {
    return { url: null, key, mode: "proxy", ticket: {}, uploadRef: null, backend: "s3", expiresAt: null };
  }
  if (backend.id === "s3") {
    await markJob(uploadJobId, { progress: 5 });
    return {
      url: issued.ticket?.url || null, key, mode: "presigned",
      ticket: issued.ticket || {}, uploadRef: null, backend: "s3",
      expiresAt: new Date(Date.now() + cfg.uploadUrlTtl * 1000).toISOString(),
    };
  }
  await markJob(uploadJobId, { progress: 5 });
  return {
    url: issued.ticket?.url || null, key, mode: issued.mode,
    ticket: issued.ticket || {}, uploadRef: issued.uploadRef || null, backend: "pool",
    expiresAt: issued.expiresAt || null,
  };
}

const ASSET_TYPES = new Set(["image", "video", "audio", "document", "3d", "raw", "pdf", "archive"]);
const ASSET_STATUSES = new Set(["approved", "draft", "review", "processing", "archived"]);
const MAX_ASSET_NAME_LEN = 180;

function assetDisplayName(name, filename) {
  const typed = String(name ?? "").replace(/\s+/g, " ").trim();
  return (typed || filename || "file").slice(0, MAX_ASSET_NAME_LEN);
}

function toAssetInsert({ projectId, key, head, checksum, name, type, status, folder, tags, filename, contentType, storageBucket, poolFileId, poolUrl }) {
  return {
    project_id: projectId,
    name: assetDisplayName(name, filename),
    type: ASSET_TYPES.has(type) ? type : assetTypeForContentType(contentType, filename) || "image",
    format: String(filename?.split(".").pop() || "").toUpperCase().slice(0, 12),
    size_bytes: head.size,
    folder: folder || "root",
    status: ASSET_STATUSES.has(status) ? status : "draft",
    tags: Array.isArray(tags) ? tags : [],
    storage_key: key,
    storage_bucket: storageBucket || s3Config().bucket,
    storage_status: "stored",
    etag: head.etag,
    checksum: checksum || null,
    mime_type: head.contentType || contentType || "",
    original_filename: filename,
    ...(poolFileId !== undefined ? { pool_file_id: poolFileId } : {}),
    ...(poolUrl !== undefined ? { pool_url: poolUrl } : {}),
  };
}

export async function commitUpload({ uploadJobId, key, assetId, checksum, name, type, status, folder, tags, parts, response, providerKey }) {
  if (!key || !uploadJobId) return { error: "bad_request" };
  const parsed = parseKey(key);
  if (!parsed?.projectId) return { error: "bad_key" };

  // Branch at the top over the two backends; shared bookkeeping below stays
  // single. Pool ticket uploads finalize against the reservation; S3 uploads
  // (and pool proxy uploads, already committed via ?direct=1) verify via head.
  let head = null;
  let poolRef = null;
  let poolProvider = null;
  let jobPoolFileId = null;
  try {
    const sb = await serverDb();
    const { data: job } = await sb.schema("assets").from("upload_jobs")
      .select("id, pool_upload_id, pool_file_id").eq("id", uploadJobId).maybeSingle();
    if (job?.pool_upload_id) {
      const finalized = await poolBackend.finalizeUpload({
        uploadRef: { uploadId: job.pool_upload_id },
        parts, response, providerKey,
      });
      if (finalized?.error) {
        await markJob(uploadJobId, { status: "failed", error: finalized.error });
        return { error: finalized.error };
      }
      head = { size: finalized.size, etag: finalized.etag ?? null, contentType: finalized.contentType || "" };
      poolRef = finalized.ref;
      poolProvider = finalized.provider || null;
    } else if (job?.pool_file_id) {
      jobPoolFileId = job.pool_file_id;
      const found = await poolBackend.head({ backend: "pool", key, fileId: job.pool_file_id });
      if (!found) {
        await markJob(uploadJobId, { status: "failed", error: "Object not found in storage" });
        return { error: "not_committed" };
      }
      head = { size: found.size, etag: found.etag ?? null, contentType: found.contentType || "" };
      poolRef = { backend: "pool", key, fileId: job.pool_file_id, directUrl: found.directUrl || null };
      poolProvider = found.provider || null;
    } else {
      head = await localS3Backend.head({ backend: "s3", key });
      if (!head) {
        await markJob(uploadJobId, { status: "failed", error: "Object not found in storage" });
        return { error: "not_committed" };
      }
    }
  } catch (e) {
    console.error("[storage.commit.head]", e);
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

  const pooled = Boolean(poolRef);
  const storageBucket = pooled ? `pool:${poolProvider || "pool"}` : cfg.bucket;
  const poolFileId = pooled ? (poolRef.fileId || jobPoolFileId || null) : undefined;
  const poolUrl = pooled ? (poolRef.directUrl || null) : undefined;

  try {
    const sb = await serverDb();
    let assetRow = null;

    if (assetId) {
      const existing = await sb.schema("assets").from("assets").select("*").eq("id", assetId).is("deleted_at", null).single();
      if (existing.error || !existing.data) {
        await markJob(uploadJobId, { status: "failed", error: "Asset not found" });
        return { error: "not_found" };
      }
      if (existing.data.project_id !== projectId) {
        await markJob(uploadJobId, { status: "failed", error: "Project mismatch" });
        return { error: "forbidden" };
      }
      const { data, error } = await sb.schema("assets").from("assets").update({
        storage_key: key,
        storage_bucket: storageBucket,
        storage_status: "stored",
        etag: head.etag,
        ...(checksum ? { checksum } : {}),
        mime_type: head.contentType || "",
        size_bytes: head.size,
        original_filename: filename,
        ...(pooled ? { pool_file_id: poolFileId, pool_url: poolUrl } : {}),
      }).eq("id", assetId).select("*").single();
      if (error) {
        console.error("[storage.commit]", error.message);
        await markJob(uploadJobId, { status: "failed", error: error.message });
        return { error: "db_failed" };
      }
      assetRow = data;
    } else {
      const { data, error } = await sb.schema("assets").from("assets").insert(
        toAssetInsert({ projectId, key, head, checksum, name, type, status, folder, tags, filename, contentType: head.contentType, storageBucket, ...(pooled ? { poolFileId, poolUrl } : {}) })
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
      label: filename || `v${nextVersion}`,
      is_current: true,
      size_bytes: head.size,
      storage_key: key,
      etag: head.etag,
      ...(checksum ? { checksum } : {}),
      mime_type: head.contentType || "",
      ...(pooled ? { pool_file_id: poolFileId, pool_url: poolUrl } : {}),
    });
    if (versionError) {
      console.error("[storage.commit]", versionError.message);
      await markJob(uploadJobId, { status: "failed", error: versionError.message });
      return { error: "db_failed" };
    }

    if (pooled && poolFileId) {
      try {
        await sb.schema("assets").from("upload_jobs").update({ pool_file_id: poolFileId }).eq("id", uploadJobId);
      } catch {
        /* traceability only — the asset and version rows are authoritative */
      }
    }
    await markJob(uploadJobId, { status: "completed", progress: 100, assetId });
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

export async function proxyStore({ projectId, uploadJobId, filename, contentType, bytes, assetId, name, type, status, folder, tags, checksum, quality }) {
  if (!isStorageConfigured()) return { error: "storage_unconfigured" };
  let size = bytes?.length ?? bytes?.byteLength ?? 0;
  if (size <= 0) return { error: "bad_request" };
  if (size > PROXY_MAX_BYTES) return { error: "too_large" };
  const cfg = s3Config();
  if (size > cfg.maxUploadBytes) return { error: "too_large" };
  if (!isAllowedContentType(contentType, filename)) return { error: "unsupported_type" };

  let effectiveBytes = bytes;
  let effectiveFilename = filename;
  let effectiveContentType = contentType;
  const q = String(quality || "original");
  if (q === "web" || q === "compressed") {
    try {
      const { optimizeImageBuffer } = await import("@/lib/image/optimize.js");
      const optimized = await optimizeImageBuffer(Buffer.from(bytes), {
        quality: q,
        filename,
        contentType,
      });
      if (optimized) {
        effectiveBytes = optimized.bytes;
        effectiveFilename = optimized.filename;
        effectiveContentType = optimized.contentType;
        size = effectiveBytes.length;
      }
    } catch (e) {
      console.error("[storage.proxyStore.optimize]", e?.message || e);
    }
  }
  if (!isAllowedContentType(effectiveContentType, effectiveFilename)) return { error: "unsupported_type" };

  let key;
  try {
    key = assetId
      ? await nextVersionKey({ projectId, assetId, filename: effectiveFilename })
      : stagingKey({ projectId, uploadJobId, filename: effectiveFilename });
  } catch {
    return { error: "bad_request" };
  }
  const fileType = assetTypeForContentType(effectiveContentType, effectiveFilename) || "image";
  await upsertUploadJob({
    uploadJobId, projectId, filename: effectiveFilename, fileType, sizeBytes: size,
    storageKey: key, mode: "proxy", status: "uploading",
  });
  const backend = writeBackend();
  const stored = await backend.put({
    key, body: effectiveBytes, contentType: effectiveContentType,
    contentDisposition: attachmentDispositionFor(effectiveContentType, effectiveFilename),
  });
  if (!stored) {
    await markJob(uploadJobId, { status: "failed", error: "Proxy upload failed" });
    return { error: "put_failed" };
  }
  if (stored.ref?.backend === "pool" && stored.ref?.fileId) {
    try {
      const sb = await serverDb();
      await sb.schema("assets").from("upload_jobs").update({ pool_file_id: stored.ref.fileId }).eq("id", uploadJobId);
    } catch {
      /* commit re-resolves via stat fallback; traceability only */
    }
  }
  return commitUpload({ uploadJobId, key, assetId, checksum, name: name || effectiveFilename, type, status, folder, tags });
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

    if (!(await hasProjectGrant(sb, parsed.projectId, sessionUserId))) return null;
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
    if (!ok) {
      urls[key] = null;
      continue;
    }
    // Reads follow the row: pooled objects sign via the pool gateway even
    // when S3 presigned reads are on.
    try {
      const sb = await serverDb();
      const { data: row } = await sb.schema("assets").from("assets")
        .select("storage_key, pool_file_id, pool_url").eq("storage_key", key).is("deleted_at", null).limit(1).maybeSingle();
      const ref = row ? refFromAssetRow(row) : { backend: "s3", key };
      if (ref?.backend === "pool") {
        urls[key] = await poolBackend.signRead(ref);
        continue;
      }
    } catch {
      /* fall through to the S3 path */
    }
    if (cfg && !cfg.presignedReads) {
      const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
      urls[key] = `${base}/api/storage/file?key=${encodeURIComponent(key)}`;
      continue;
    }
    if (!cfg) {
      urls[key] = null;
      continue;
    }
    urls[key] = await signGetUrl(key);
  }
  return { urls, expiresAt: cfg ? new Date(Date.now() + cfg.signedUrlTtl * 1000).toISOString() : null };
}

function safeDownloadName(filename) {
  return String(filename || "file").replace(/"/g, "").slice(0, 180) || "file";
}

export async function proxyStreamResponse(key, { filename, download, request, ref } = {}) {
  const resolved = ref || { backend: "s3", key };
  const backend = backendForRef(resolved);
  const range = request?.headers?.get("range") || null;
  const got = await backend.getStream(resolved, { range });
  if (!got?.stream) return null;
  const etag = got.etag ? `"${got.etag}"` : null;
  if (etag && !range) {
    const inm = request?.headers?.get("if-none-match");
    if (inm && inm.split(",").map((s) => s.trim()).includes(etag)) {
      return new Response(null, { status: 304, headers: { ETag: etag } });
    }
  }
  const headers = {
    "Content-Type": got.contentType || "application/octet-stream",
    ...(got.size != null ? { "Content-Length": String(got.size) } : {}),
    ...(etag ? { ETag: etag } : {}),
    ...(got.status === 206 && got.contentRange ? { "Content-Range": got.contentRange } : {}),
    ...(got.status === 206 ? { "Accept-Ranges": "bytes" } : {}),
    "Cache-Control": "private, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
  };
  if (download || isNeverInline(got.contentType)) {
    headers["Content-Disposition"] = `attachment; filename="${safeDownloadName(filename)}"`;
  }
  let body = got.stream;
  if (typeof body.getReader !== "function") {
    try {
      body = Readable.toWeb(body);
    } catch {
      return null;
    }
  }
  return new Response(body, { status: got.status === 206 ? 206 : 200, headers });
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

// Any-state row lookup (trashed rows included) for the purge gate — purge
// runs from trash, where getAssetRow's deleted_at filter no longer matches.
export async function getAssetRowAny(id) {
  if (!id) return null;
  try {
    const sb = await serverDb();
    const { data, error } = await sb.schema("assets").from("assets").select("*").eq("id", id).maybeSingle();
    if (error) {
      console.error("[storage.getAssetAny]", error.message);
      return null;
    }
    return data;
  } catch (e) {
    console.error("[storage.getAssetAny]", e);
    return null;
  }
}

// Irreversible destroy: free every byte for the asset and all its versions,
// then hard-delete the row (versions cascade). Bytes are removed best-effort
// and the row purge is authoritative — a leaked object is today's status quo,
// a kept row with missing bytes would be corruption. Trash/restore keeps
// bytes deliberately via softDeleteAssetFile; only purge frees them.
export async function purgeAssetFile(assetId) {
  if (!assetId) return false;
  try {
    const sb = await serverDb();
    // Snapshot every locator first: the row delete cascades to
    // asset_versions, so version refs must be collected up front. Each
    // version committed its own pool node, so each carries its own fileId.
    const { data: row } = await sb.schema("assets").from("assets").select("*").eq("id", assetId).maybeSingle();
    if (!row) return false;
    const { data: versions } = await sb.schema("assets").from("asset_versions")
      .select("storage_key, pool_file_id, pool_url").eq("asset_id", assetId);

    const seen = new Set();
    const refs = [];
    for (const r of [row, ...(versions || [])]) {
      const ref = refFromAssetRow(r);
      if (!ref?.key) continue;
      const k = `${ref.backend}:${ref.fileId || ref.key}`;
      if (seen.has(k)) continue;
      seen.add(k);
      refs.push(ref);
    }
    for (const ref of refs) {
      try {
        await backendForRef(ref).remove(ref);
      } catch (e) {
        console.error("[storage.purge.remove]", ref.key, e?.message || e);
      }
    }
    // Derivative cache has no rows and nothing can restore it after a purge.
    try {
      await writeBackend().removeByPrefix(`derived/${assetId}`);
    } catch (e) {
      console.error("[storage.purge.derivatives]", e?.message || e);
    }
    // Remove older previews that were written to the pool.
    if (row.project_id) {
      try {
        await writeBackend().removeByPrefix(`p/${row.project_id}/thumb/${assetId}`);
      } catch (e) {
        console.error("[storage.purge.thumbnails]", e?.message || e);
      }
      try {
        await removeThumbnailUrls(
          thumbnailAdminClient().storage,
          [row.thumbnail_url, row.mini_thumbnail_url],
          `p/${row.project_id}/thumb/${assetId}/`,
        );
      } catch (e) {
        console.error("[storage.purge.supabaseThumbnails]", e?.message || e);
      }
    }

    const { error } = await sb.schema("assets").from("assets").delete().eq("id", assetId);
    if (error) {
      console.error("[storage.purge]", error.message);
      return false;
    }
    if (row.storage_key) invalidateAssetCache(row.storage_key);
    await safeUpdateTag(`asset:${assetId}`);
    if (row.project_id) await safeUpdateTag(`assets:${row.project_id}`);
    return true;
  } catch (e) {
    console.error("[storage.purge]", e);
    return false;
  }
}
