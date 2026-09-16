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
import { headObject, putObject, getObjectStream, signGetUrl, signPutUrl, invalidateAssetCache } from "@/lib/s3/objects";
import { assetKey, stagingKey, parseKey } from "@/lib/s3/keys";
import { hasProjectGrant } from "@/lib/storage/auth";
import { probeFile, typeMismatch } from "@/lib/media/probe";
import { buildDerivatives, persistDerivatives } from "@/lib/media/variants";
import { adjustProjectRollup } from "@/lib/media/usage";
import { dispatchEvent } from "@/lib/media/webhooks";
import { Readable } from "node:stream";

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

// lib/media/usage defaults to the browser client, which has no session inside a
// route handler. Metering written from the server hands in its own schema-scoped
// client instead.
async function usageClient() {
  try {
    return (await serverDb()).schema("assets");
  } catch {
    return null;
  }
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

// Nearest existing asset in the project carrying identical bytes. Scoped to the
// project because the checksum index is (project_id, checksum) — a cross-project
// scan would miss the index and leak the existence of other teams' files.
export async function findDuplicateByChecksum(sb, projectId, checksum) {
  if (!projectId || !checksum) return null;
  try {
    const { data, error } = await sb.schema("assets").from("assets")
      .select("id, name, original_filename, size_bytes")
      .eq("project_id", projectId).eq("checksum", checksum)
      .is("deleted_at", null).limit(1);
    if (error) {
      console.error("[storage.duplicate]", error.message);
      return null;
    }
    const row = data?.[0];
    if (!row) return null;
    return {
      assetId: row.id,
      name: row.name ?? "",
      originalFilename: row.original_filename ?? "",
      sizeBytes: Number(row.size_bytes ?? 0),
    };
  } catch (e) {
    console.error("[storage.duplicate]", e);
    return null;
  }
}

export async function upsertUploadJob({ uploadJobId, projectId, filename, fileType, sizeBytes, storageKey, mode, status }) {
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

export async function nextVersionKey({ projectId, assetId, filename }) {
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
  const fileType = assetTypeForContentType(contentType, filename) || "image";
  if (!cfg.presignedUploads) {
    await upsertUploadJob({
      uploadJobId, projectId, filename, fileType, sizeBytes: size,
      storageKey: key, mode: "proxy", status: "uploading",
    });
    return { url: null, key, mode: "proxy", expiresAt: null };
  }

  const url = await signPutUrl(key, { ttl: cfg.uploadUrlTtl, contentType, maxBytes: size });
  if (!url) return { error: "sign_failed" };

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

// Webhook fan-out is deliberately not awaited by the commit path, but an
// un-awaited async call still has to own its rejections or it becomes an
// unhandled rejection that can take the process down.
function notifySubscribers(projectId, event, payload) {
  if (!projectId) return;
  (async () => {
    try {
      const sb = await serverDb();
      await dispatchEvent(projectId, event, payload, { client: sb.schema("assets") });
    } catch (e) {
      console.error("[storage.notify]", e?.message || e);
    }
  })();
}

// Grid thumbnails are served through the variant route rather than a storage
// key, so the URL survives re-encoding and format negotiation without the row
// being rewritten.
function variantUrlFor(assetId, variant) {
  const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
  return `${base}/api/media/${assetId}/${variant}`;
}

// Fan out the WebP derivative set while the bytes are still in hand. Only the
// proxy path has them; a presigned upload never passes through this process, so
// its derivatives are produced on first request instead. Returns the slot names
// written, or null when nothing was produced.
async function deriveOnCommit({ projectId, assetId, key, bytes, probe, head, filename }) {
  if (!projectId || !assetId || !bytes) return null;
  // Non-images derive nothing; skip the work rather than letting deriveAll
  // classify the bytes a second time.
  if (probe && probe.kind !== "image") return null;
  try {
    const entries = await buildDerivatives({
      projectId,
      assetId,
      buffer: Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes),
      contentType: head?.contentType || "",
      filename,
    });
    const slots = Object.keys(entries);
    if (slots.length === 0) return null;
    await persistDerivatives(assetId, entries, {
      thumbnailUrl: entries["thumb.webp"] ? variantUrlFor(assetId, "thumb") : null,
    });
    return slots;
  } catch (e) {
    console.error("[storage.commit.derive]", e?.message || e, key);
    return null;
  }
}

// Dimensions come from the probe, which read the actual pixels — the client's
// claim was never trustworthy and older rows simply had no source for this.
async function persistProbeDimensions(sb, assetId, probe) {
  if (!assetId || !probe?.width || !probe?.height) return;
  try {
    await sb.schema("assets").from("assets")
      .update({ dimensions: `${probe.width}x${probe.height}` })
      .eq("id", assetId);
  } catch (e) {
    console.error("[storage.commit.dimensions]", e?.message || e);
  }
}

export async function commitUpload({ uploadJobId, key, assetId, checksum, name, type, folder, tags, bytes, probe }) {
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
    let duplicateOf = null;
    // Captured before the insert branch reassigns assetId, so the event name
    // still reflects which path this commit actually took.
    const isNewAsset = !assetId;

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
      // assets_checksum_idx has existed since the storage layer shipped but was
      // never queried, leaving the Duplicates screen with no hash source. Report
      // the match rather than merging silently — holding two deliberate copies
      // of one file is legitimate, so the user decides, not the commit path.
      duplicateOf = await findDuplicateByChecksum(sb, projectId, checksum);
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

    // A retried commit (client retry, duplicate delivery) must not stack a
    // second version row onto the same object. One storage key is one version,
    // so the key itself is the idempotency token.
    const priorVersion = await sb.schema("assets").from("asset_versions")
      .select("id").eq("asset_id", assetId).eq("storage_key", key).limit(1);
    if (!priorVersion.data?.length) {
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
    }

    // Derivatives and metering are both best-effort: the bytes are committed and
    // the asset row is live by this point, so a failure here must degrade the
    // result, never fail the upload. Missing derivatives are produced on demand
    // by the delivery path; a missed rollup delta is repaired by
    // recomputeProjectUsage.
    await persistProbeDimensions(sb, assetId, probe);
    const derived = await deriveOnCommit({ projectId, assetId, key, bytes, probe, head, filename });
    if (projectId) {
      const client = await usageClient();
      if (client) {
        await adjustProjectRollup(
          projectId,
          { storedBytesDelta: head.size, storedObjectsDelta: 1 },
          { client },
        );
      }
    }

    // Subscribers hear about this after the row is durable, never before. Not
    // awaited for the receivers' sake — dispatchEvent already bounds itself and
    // swallows its own failures, so a dead endpoint cannot stall a commit.
    notifySubscribers(projectId, isNewAsset ? "asset.created" : "asset.version.created", {
      assetId,
      projectId,
      name: assetRow.name ?? "",
      sizeBytes: Number(assetRow.size_bytes ?? 0),
      mimeType: assetRow.mime_type ?? "",
      storageKey: key,
    });

    await markJob(uploadJobId, { status: "completed", progress: 100, assetId });
    invalidateAssetCache(key);
    await safeUpdateTag(`asset:${assetId}`);
    if (projectId) await safeUpdateTag(`assets:${projectId}`);

    return {
      ...(derived ? { derivatives: derived } : {}),
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
      ...(duplicateOf ? { duplicateOf } : {}),
    };
  } catch (e) {
    console.error("[storage.commit]", e);
    await markJob(uploadJobId, { status: "failed", error: "Commit failed" });
    return { error: "db_failed" };
  }
}

export async function proxyStore({ projectId, uploadJobId, filename, contentType, bytes, assetId, name, type, folder, tags, checksum, quality }) {
  if (!isS3Configured()) return { error: "storage_unconfigured" };
  let size = bytes?.length ?? bytes?.byteLength ?? 0;
  if (size <= 0) return { error: "bad_request" };
  if (size > PROXY_MAX_BYTES) return { error: "too_large" };
  const cfg = s3Config();
  if (size > cfg.maxUploadBytes) return { error: "too_large" };
  if (!isAllowedContentType(contentType, filename)) return { error: "unsupported_type" };

  // The trust boundary. Until here the only thing vouching for these bytes is
  // the client's own Content-Type, so isAllowedContentType() was checking a
  // claim, not the file: a .exe announced as image/png passed every gate above.
  // Probing reads the actual signature. typeMismatch is deliberately
  // conservative — unrecognised bytes are not a mismatch, only a recognised
  // signature contradicting a concrete claim is — so this rejects spoofs
  // without breaking the long tail of formats the prober does not know.
  const probe = await probeFile(bytes, { filename, contentType });
  const mismatch = typeMismatch(probe, { contentType, filename });
  if (mismatch) {
    console.error("[storage.proxyStore.spoof]", mismatch);
    return { error: "type_mismatch", detail: mismatch };
  }

  // Server-side Quality Preset: re-encode raster stills to WebP (web) or
  // AVIF with WebP fallback (compressed) before staging. Non-images and
  // `original` pass through untouched. Failures fall back to original bytes.
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
    // A known asset gets its immutable version key up front, so proxy bytes
    // never sit under tmp/ permanently. New assets stage first; the commit
    // persists the staged key the trust boundary verified.
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
  const stored = await putObject({
    key, body: effectiveBytes, contentType: effectiveContentType,
    contentDisposition: attachmentDispositionFor(effectiveContentType, effectiveFilename),
  });
  if (!stored) {
    await markJob(uploadJobId, { status: "failed", error: "Proxy upload failed" });
    return { error: "put_failed" };
  }
  // The probe above ran on what the client sent — that is the trust boundary and
  // it has to stay there. But the quality presets resize (1600/2048 px), so the
  // original's dimensions describe bytes nobody will ever fetch. Re-probe the
  // encoded result so the recorded dimensions match the stored object.
  const storedProbe = effectiveBytes === bytes
    ? probe
    : await probeFile(effectiveBytes, { filename: effectiveFilename, contentType: effectiveContentType });

  // The bytes and the probe are already in memory — handing them to the commit
  // saves it re-downloading the object it just wrote in order to derive.
  return commitUpload({
    uploadJobId, key, assetId, checksum,
    name: name || effectiveFilename, type, folder, tags,
    bytes: effectiveBytes, probe: storedProbe,
  });
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
    // Membership is the actual authorization: the key being self-consistent
    // is necessary but never sufficient on its own.
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

  // Up to SIGN_BATCH_LIMIT keys per call, each needing an authorization read and
  // (when presigned) a signature. Sequentially that is 200 awaited round-trips
  // for one grid; these are independent, so fan them out.
  const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
  const proxyMode = Boolean(cfg && !cfg.presignedReads);
  const resolved = await Promise.all(
    list.map(async (key) => {
      const ok = await authorizeKey(key, sessionUserId);
      if (!ok || !cfg) return [key, null];
      if (proxyMode) return [key, `${base}/api/storage/file?key=${encodeURIComponent(key)}`];
      return [key, await signGetUrl(key)];
    })
  );
  for (const [key, url] of resolved) urls[key] = url;
  if (proxyMode) return { urls, expiresAt: null };
  return { urls, expiresAt: cfg ? new Date(Date.now() + cfg.signedUrlTtl * 1000).toISOString() : null };
}

function safeDownloadName(filename) {
  return String(filename || "file").replace(/"/g, "").slice(0, 180) || "file";
}

// Single-range parser for the proxy path: { start, end } when the header
// selects bytes of a total-length object, { unsatisfiable: true } when it is
// well-formed but selects nothing (→ 416), null when malformed or
// multi-range (→ ignore, serve 200 — a full response always satisfies GET).
function parseRange(header, total) {
  if (typeof header !== "string") return null;
  if (!Number.isSafeInteger(total) || total < 0) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m || (m[1] === "" && m[2] === "")) return null;
  if (m[1] === "") {
    const suffix = Number(m[2]);
    if (!Number.isSafeInteger(suffix) || suffix <= 0 || total === 0) return { unsatisfiable: true };
    return { start: Math.max(total - suffix, 0), end: total - 1 };
  }
  const start = Number(m[1]);
  if (!Number.isSafeInteger(start)) return null;
  if (start >= total) return { unsatisfiable: true };
  const end = m[2] === "" ? total - 1 : Math.min(Number(m[2]), total - 1);
  if (!Number.isSafeInteger(end) || end < start) return { unsatisfiable: true };
  return { start, end };
}

// If-Range carries an ETag or a date; the stream path only knows the ETag, so
// a date never matches and falls back to 200 — still correct, just unoptimized.
function ifRangeMatches(ifRange, etag) {
  if (!ifRange || !etag) return false;
  const norm = (s) => String(s).trim().replace(/^W\//, "").replace(/^"|"$/g, "");
  return norm(ifRange) === norm(etag);
}

export async function proxyStreamResponse(key, { filename, download, request } = {}) {
  const rangeHeader = request?.headers?.get("range");
  let range = null;
  let total = null;
  if (rangeHeader) {
    // Resolve the range against HEAD so 416 carries the real total and the
    // 206 Content-Range never depends on gateway echo quirks. A missing
    // object falls through to the full GET below, which still 404s via null.
    const head = await headObject(key);
    if (head) {
      total = Number(head.size);
      const parsed = parseRange(rangeHeader, total);
      if (parsed && !parsed.unsatisfiable) {
        const ifRange = request?.headers?.get("if-range");
        if (!ifRange || ifRangeMatches(ifRange, head.etag)) range = parsed;
      } else if (parsed?.unsatisfiable) {
        return new Response(null, {
          status: 416,
          headers: { "Content-Range": `bytes */${total}`, "Accept-Ranges": "bytes" },
        });
      }
    }
  }
  const got = await getObjectStream(key, { range: range ? rangeHeader : null });
  if (!got?.body) return null;
  const etag = got.etag ? `"${got.etag}"` : null;
  if (etag) {
    const inm = request?.headers?.get("if-none-match");
    if (inm && inm.split(",").map((s) => s.trim()).includes(etag)) {
      return new Response(null, { status: 304, headers: { ETag: etag } });
    }
  }
  const headers = {
    "Content-Type": got.contentType || "application/octet-stream",
    ...(got.contentLength != null ? { "Content-Length": String(got.contentLength) } : {}),
    ...(etag ? { ETag: etag } : {}),
    "Cache-Control": "private, max-age=31536000, immutable",
    "Accept-Ranges": "bytes",
  };
  if (download) {
    headers["Content-Disposition"] = `attachment; filename="${safeDownloadName(filename)}"`;
  }
  let body = got.body;
  if (typeof body.getReader !== "function") {
    try {
      body = Readable.toWeb(body);
    } catch {
      return null;
    }
  }
  if (range) {
    headers["Content-Range"] = got.contentRange ?? `bytes ${range.start}-${range.end}/${total}`;
    if (headers["Content-Length"] == null) headers["Content-Length"] = String(range.end - range.start + 1);
    return new Response(body, { status: 206, headers });
  }
  return new Response(body, { headers });
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
