if (typeof window !== "undefined") {
  throw new Error("lib/s3 is server-only — import lib/storage/client on the browser.");
}

import {
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  CopyObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Client } from "./client.js";
import { s3Config, isS3Configured } from "./config.js";
import { cached, cacheDelete } from "./cache.js";
import { normalizeS3Error } from "./errors.js";

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

export async function putObject({ key, body, contentType, contentDisposition, metadata, cacheControl }) {
  const client = needClient();
  if (!client || !key || body == null) return null;
  try {
    const cmd = new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      Body: body,
      ContentType: contentType || "application/octet-stream",
      ...(contentDisposition ? { ContentDisposition: contentDisposition } : {}),
      Metadata: metadata || undefined,
      CacheControl: cacheControl || "public, max-age=31536000, immutable",
    });
    const res = await client.send(cmd);
    cacheDelete(`head:${key}`);
    return { etag: (res.ETag || "").replace(/"/g, "") || null };
  } catch (err) {
    fail("putObject", err);
    return null;
  }
}

export async function getObjectStream(key) {
  const client = needClient();
  if (!client || !key) return null;
  try {
    const res = await client.send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
    return {
      body: res.Body ?? null,
      contentType: res.ContentType ?? "application/octet-stream",
      contentLength: res.ContentLength ?? null,
      etag: (res.ETag || "").replace(/"/g, "") || null,
    };
  } catch (err) {
    fail("getObjectStream", err);
    return null;
  }
}

export async function headObject(key) {
  if (!key) return null;
  if (!isS3Configured()) return null;
  return cached(`head:${key}`, 5 * 60 * 1000, async () => {
    const client = needClient();
    if (!client) return null;
    try {
      const res = await client.send(new HeadObjectCommand({ Bucket: bucket(), Key: key }));
      return {
        size: Number(res.ContentLength ?? 0),
        etag: (res.ETag || "").replace(/"/g, "") || null,
        contentType: res.ContentType ?? "",
        lastModified: res.LastModified ? new Date(res.LastModified).toISOString() : null,
      };
    } catch (err) {
      const n = normalizeS3Error(err);
      if (n.code === "not_found") return null;
      if (n.code !== "not_found") console.error("[s3.headObject]", n.message);
    }
    try {
      return await statObject(key);
    } catch (err) {
      const n = normalizeS3Error(err);
      if (n.code !== "not_found") console.error("[s3.headObject]", n.message);
      return null;
    }
  });
}

export async function statObject(key) {
  const client = needClient();
  if (!client || !key) return null;
  const res = await client.send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
  try {
    if (res.Body && typeof res.Body.destroy === "function") res.Body.destroy();
  } catch {
  }
  return {
    size: Number(res.ContentLength ?? 0),
    etag: (res.ETag || "").replace(/"/g, "") || null,
    contentType: res.ContentType ?? "",
    lastModified: res.LastModified ? new Date(res.LastModified).toISOString() : null,
  };
}

export async function deleteObject(key) {
  const client = needClient();
  if (!client || !key) return false;
  try {
    await client.send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
    cacheDelete(`sig:get:${key}`);
    cacheDelete(`head:${key}`);
    return true;
  } catch (err) {
    fail("deleteObject", err);
    return false;
  }
}

export async function deleteObjectsByPrefix(prefix) {
  const client = needClient();
  if (!client || !prefix) return 0;
  let deleted = 0;
  let token;
  try {
    for (;;) {
      const listed = await client.send(
        new ListObjectsV2Command({ Bucket: bucket(), Prefix: prefix, ContinuationToken: token, MaxKeys: 1000 })
      );
      const keys = (listed.Contents || []).map((o) => o.Key).filter(Boolean);
      if (keys.length) {
        await client.send(
          new DeleteObjectsCommand({ Bucket: bucket(), Delete: { Objects: keys.map((Key) => ({ Key })) } })
        );
        deleted += keys.length;
        for (const k of keys) {
          cacheDelete(`sig:get:${k}`);
          cacheDelete(`head:${k}`);
        }
      }
      if (!listed.IsTruncated) break;
      token = listed.NextContinuationToken;
    }
    return deleted;
  } catch (err) {
    fail("deleteObjectsByPrefix", err);
    return deleted;
  }
}

export async function copyObject(fromKey, toKey) {
  const client = needClient();
  if (!client || !fromKey || !toKey) return false;
  try {
    await client.send(
      new CopyObjectCommand({
        Bucket: bucket(),
        Key: toKey,
        CopySource: `${bucket()}/${encodeURIComponent(fromKey).replace(/%2F/g, "/")}`,
        CacheControl: "public, max-age=31536000, immutable",
      })
    );
    cacheDelete(`head:${toKey}`);
    return true;
  } catch (err) {
    fail("copyObject", err);
    return false;
  }
}

function skewTtlMs(ttlSeconds) {
  return Math.max((Number(ttlSeconds) - 300) * 1000, 60 * 1000);
}

export async function signGetUrl(key, { ttl, download, filename } = {}) {
  if (!key || !isS3Configured()) return null;
  const cfg = s3Config();
  const ttlSec = Number(ttl) > 0 ? Number(ttl) : cfg.signedUrlTtl;
  const disposition = download
    ? `attachment; filename="${String(filename || key.split("/").pop() || "file").replace(/"/g, "")}"`
    : undefined;
  const cacheKey = `sig:get:${key}:${download ? "dl" : "inline"}`;
  return cached(cacheKey, skewTtlMs(ttlSec), async () => {
    const client = needClient();
    if (!client) return null;
    try {
      const cmd = new GetObjectCommand({
        Bucket: bucket(),
        Key: key,
        ...(disposition ? { ResponseContentDisposition: disposition } : {}),
      });
      return await getSignedUrl(client, cmd, { expiresIn: ttlSec });
    } catch (err) {
      fail("signGetUrl", err);
      return null;
    }
  });
}

export async function signPutUrl(key, { ttl, contentType, maxBytes } = {}) {
  if (!key || !isS3Configured()) return null;
  const cfg = s3Config();
  const ttlSec = Number(ttl) > 0 ? Number(ttl) : cfg.uploadUrlTtl;
  const client = needClient();
  if (!client) return null;
  try {
    const cmd = new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      ContentType: contentType || "application/octet-stream",
      ...(Number(maxBytes) > 0 ? { ContentLength: Number(maxBytes) } : {}),
      CacheControl: "public, max-age=31536000, immutable",
    });
    return await getSignedUrl(client, cmd, { expiresIn: ttlSec });
  } catch (err) {
    fail("signPutUrl", err);
    return null;
  }
}

// Ops/reconciliation only — never for UI. Screens read Postgres; this walks the
// bucket prefix page by page for the sweeper and the s3:check probe. Pass
// `delimiter: "/"` to enumerate immediate sub-prefixes (CommonPrefixes)
// instead of every object — how the reconciler finds tmp/ areas without
// listing the whole bucket.
export async function listObjects(prefix, { limit = 1000, cursor, delimiter } = {}) {
  const client = needClient();
  if (!client) return null;
  try {
    const res = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket(),
        Prefix: prefix || "",
        MaxKeys: Math.min(Math.max(Number(limit) || 1000, 1), 1000),
        ContinuationToken: cursor || undefined,
        Delimiter: delimiter || undefined,
      })
    );
    return {
      objects: (res.Contents || []).map((o) => ({
        key: o.Key,
        size: Number(o.Size ?? 0),
        etag: (o.ETag || "").replace(/"/g, "") || null,
        lastModified: o.LastModified ? new Date(o.LastModified).toISOString() : null,
      })),
      prefixes: (res.CommonPrefixes || []).map((p) => p.Prefix).filter(Boolean),
      nextCursor: res.IsTruncated ? res.NextContinuationToken : null,
    };
  } catch (err) {
    fail("listObjects", err);
    return null;
  }
}

export function invalidateAssetCache(key) {
  if (!key) return;
  cacheDelete(`sig:get:${key}`);
  cacheDelete(`head:${key}`);
}
