if (typeof window !== "undefined") {
  throw new Error("lib/s3 is server-only — import lib/storage/client on the browser.");
}

import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  ListPartsCommand,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Client } from "./client.js";
import { s3Config, isS3Configured } from "./config.js";
import { cacheDelete } from "./cache.js";
import { normalizeS3Error } from "./errors.js";

// S3 multipart limits: MIN is the smallest non-final part (5 MiB); MAX_PARTS
// caps an upload at 10,000 parts so partSize must grow for large files;
// MAX_PART_SIZE (5 GiB) and MAX_OBJECT_SIZE (5 TiB) bound one part and the
// whole object. PREFERRED (8 MiB) is the nominal part once multipart is
// worthwhile: a power of two just above MIN that keeps per-part memory and
// retry cost low for presigned browser PUTs while holding 1 GiB to ~128
// parts; 8 MiB x 10,000 ≈ 78 GiB covers video/RAW/PSD/archives without
// growth, and larger files scale up to stay within MAX_PARTS.
export const MULTIPART_MIN_PART_SIZE = 5 * 1024 * 1024;
export const MULTIPART_PREFERRED_PART_SIZE = 8 * 1024 * 1024;
export const MULTIPART_MAX_PARTS = 10000;
export const MULTIPART_MAX_PART_SIZE = 5 * 1024 * 1024 * 1024;
export const MULTIPART_MAX_OBJECT_SIZE = 5 * 1024 * 1024 * 1024 * 1024;
const MI_BYTES = 1024 * 1024;

function fail(op, err) {
  const n = normalizeS3Error(err);
  console.error(`[s3.${op}]`, n.message);
  return n;
}

function needClient() {
  if (!isS3Configured()) return null;
  return s3Client();
}

function bucket() {
  return s3Config().bucket;
}

function toPartNumber(value) {
  let pn;
  try {
    pn = Number(value);
  } catch {
    return null;
  }
  if (!Number.isInteger(pn) || pn < 1 || pn > MULTIPART_MAX_PARTS) return null;
  return pn;
}

// Accept the lowercase shape this module returns ({ etag, partNumber }) and
// the SDK shape ({ ETag, PartNumber }); reject anything else without calling
// S3 so a bad list can never corrupt the object. Returns SDK-shaped parts
// sorted by number, or null when malformed.
function normalizeCompleteParts(parts) {
  if (!Array.isArray(parts) || parts.length === 0 || parts.length > MULTIPART_MAX_PARTS) return null;
  const seen = new Set();
  const out = [];
  for (const p of parts) {
    const pn = toPartNumber(p?.partNumber ?? p?.PartNumber);
    const raw = p?.etag ?? p?.ETag;
    if (pn == null || typeof raw !== "string") return null;
    const etag = raw.replace(/"/g, "");
    if (!etag || seen.has(pn)) return null;
    seen.add(pn);
    out.push({ ETag: etag, PartNumber: pn });
  }
  out.sort((a, b) => a.PartNumber - b.PartNumber);
  return out;
}

export async function createMultipart(key, { contentType, cacheControl } = {}) {
  const client = needClient();
  if (!client || !key) return null;
  try {
    const res = await client.send(
      new CreateMultipartUploadCommand({
        Bucket: bucket(),
        Key: key,
        ContentType: contentType || "application/octet-stream",
        CacheControl: cacheControl || "public, max-age=31536000, immutable",
      })
    );
    if (!res.UploadId) return null;
    return { uploadId: res.UploadId };
  } catch (err) {
    fail("createMultipart", err);
    return null;
  }
}

export async function uploadPart(key, uploadId, partNumber, body) {
  const client = needClient();
  if (!client || !key || !uploadId || body == null) return null;
  const pn = toPartNumber(partNumber);
  if (pn == null) return null;
  try {
    const res = await client.send(
      new UploadPartCommand({
        Bucket: bucket(),
        Key: key,
        UploadId: uploadId,
        PartNumber: pn,
        Body: body,
      })
    );
    return { etag: (res.ETag || "").replace(/"/g, "") || null, partNumber: pn };
  } catch (err) {
    fail("uploadPart", err);
    return null;
  }
}

export async function signPartUrl(key, uploadId, partNumber, { ttl } = {}) {
  if (!key || !uploadId || !isS3Configured()) return null;
  const pn = toPartNumber(partNumber);
  if (pn == null) return null;
  const cfg = s3Config();
  const ttlNum = typeof ttl === "number" || typeof ttl === "string" ? Number(ttl) : NaN;
  const ttlSec = ttlNum > 0 ? ttlNum : cfg.uploadUrlTtl;
  const client = needClient();
  if (!client) return null;
  try {
    const cmd = new UploadPartCommand({
      Bucket: bucket(),
      Key: key,
      UploadId: uploadId,
      PartNumber: pn,
    });
    return await getSignedUrl(client, cmd, { expiresIn: ttlSec });
  } catch (err) {
    fail("signPartUrl", err);
    return null;
  }
}

export async function completeMultipart(key, uploadId, parts) {
  const client = needClient();
  if (!client || !key || !uploadId) return null;
  const sorted = normalizeCompleteParts(parts);
  if (!sorted) return null;
  try {
    const res = await client.send(
      new CompleteMultipartUploadCommand({
        Bucket: bucket(),
        Key: key,
        UploadId: uploadId,
        MultipartUpload: { Parts: sorted },
      })
    );
    cacheDelete(`head:${key}`);
    return { etag: (res.ETag || "").replace(/"/g, "") || null };
  } catch (err) {
    fail("completeMultipart", err);
    return null;
  }
}

export async function abortMultipart(key, uploadId) {
  const client = needClient();
  if (!client || !key || !uploadId) return false;
  try {
    await client.send(new AbortMultipartUploadCommand({ Bucket: bucket(), Key: key, UploadId: uploadId }));
    return true;
  } catch (err) {
    const n = normalizeS3Error(err);
    if (n.code === "not_found") return true;
    console.error("[s3.abortMultipart]", n.message);
    return false;
  }
}

export async function listParts(key, uploadId) {
  const client = needClient();
  if (!client || !key || !uploadId) return null;
  try {
    const out = [];
    let marker;
    for (;;) {
      const res = await client.send(
        new ListPartsCommand({
          Bucket: bucket(),
          Key: key,
          UploadId: uploadId,
          PartNumberMarker: marker || undefined,
          MaxParts: 1000,
        })
      );
      for (const p of res.Parts || []) {
        out.push({
          etag: (p.ETag || "").replace(/"/g, "") || null,
          partNumber: Number(p.PartNumber),
          size: Number(p.Size ?? 0),
          lastModified: p.LastModified ? new Date(p.LastModified).toISOString() : null,
        });
      }
      if (!res.IsTruncated) break;
      marker = res.NextPartNumberMarker;
      if (marker == null) break;
    }
    out.sort((a, b) => a.partNumber - b.partNumber);
    return out;
  } catch (err) {
    fail("listParts", err);
    return null;
  }
}

// Pure offline planner: no S3 call, so no config guard. Returns null for
// non-positive, non-finite, or over-limit sizes instead of throwing.
export function planParts(totalBytes) {
  try {
    const total = Number(totalBytes);
    if (!Number.isFinite(total) || total <= 0) return null;
    const size = Math.floor(total);
    if (size <= 0) return null;
    if (size > MULTIPART_MAX_OBJECT_SIZE) return null;
    if (size <= MULTIPART_PREFERRED_PART_SIZE) return { partSize: size, partCount: 1 };
    let partSize = Math.max(MULTIPART_PREFERRED_PART_SIZE, Math.ceil(size / MULTIPART_MAX_PARTS));
    partSize = Math.ceil(partSize / MI_BYTES) * MI_BYTES;
    if (partSize > MULTIPART_MAX_PART_SIZE || partSize <= 0) return null;
    const partCount = Math.ceil(size / partSize);
    if (!Number.isSafeInteger(partCount) || partCount < 2 || partCount > MULTIPART_MAX_PARTS) return null;
    return { partSize, partCount };
  } catch {
    return null;
  }
}
