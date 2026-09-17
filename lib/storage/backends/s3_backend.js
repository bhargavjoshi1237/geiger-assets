if (typeof window !== "undefined") {
  throw new Error("lib/storage/backends is server-only.");
}

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  CopyObjectCommand,
  ListObjectsV2Command,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  ListPartsCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { cached, cacheDelete } from "@/lib/s3/cache";
import { normalizeS3Error } from "@/lib/s3/errors";
import { sealBackend } from "./contract.js";

// S3-compatible backend, parameterized by config.
//
// lib/s3/objects.js is the env-pinned singleton the original single-bucket
// build was written against; this is the same protocol reached through a
// per-backend client so several endpoints (Appwrite, R2, MinIO, AWS) can be
// live at once. Nothing here reads process.env -- the config always arrives
// from the caller, which is what makes a backend row in the database a
// first-class provider.

const clients = new Map();

function clientFor(cfg) {
  // Keyed on the credential tuple so rotating a key in the database produces a
  // new client instead of silently reusing one holding the old secret.
  const cacheKey = `${cfg.endpoint}|${cfg.region}|${cfg.accessKeyId}|${cfg.secretAccessKey}|${cfg.forcePathStyle}`;
  const hit = clients.get(cacheKey);
  if (hit) return hit;
  const client = new S3Client({
    endpoint: cfg.endpoint,
    region: cfg.region || "auto",
    forcePathStyle: cfg.forcePathStyle !== false,
    credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
    maxAttempts: 3,
    retryMode: "adaptive",
  });
  clients.set(cacheKey, client);
  return client;
}

export function resetS3BackendClients() {
  clients.clear();
}

function unquote(etag) {
  return (etag || "").replace(/"/g, "") || null;
}

// Total size rides on a ranged response as `bytes <start>-<end>/<total>`;
// anything else carries no usable total.
function totalFromContentRange(contentRange) {
  const m = typeof contentRange === "string" && /^bytes \d+-\d+\/(\d+)$/.exec(contentRange);
  return m ? Number(m[1]) : null;
}

function contentDispositionFor(download, filename) {
  if (!download) return undefined;
  const safe = String(filename || "download").replace(/["\\\r\n]/g, "_");
  const encoded = encodeURIComponent(safe);
  return `attachment; filename="${safe}"; filename*=UTF-8''${encoded}`;
}

export function createS3Backend(input) {
  const cfg = input || {};
  if (!cfg.endpoint || !cfg.bucket || !cfg.accessKeyId || !cfg.secretAccessKey) {
    console.error("[storage.backend.s3] incomplete config", cfg.id || "");
    return null;
  }

  const id = String(cfg.id || "s3");
  const Bucket = cfg.bucket;
  const signedUrlTtl = Number(cfg.signedUrlTtl) > 0 ? Number(cfg.signedUrlTtl) : 3600;
  const uploadUrlTtl = Number(cfg.uploadUrlTtl) > 0 ? Number(cfg.uploadUrlTtl) : 900;
  const client = () => clientFor(cfg);
  // CDN origin fronting this bucket, e.g. https://cdn.example.com. Opt-in per
  // backend: objects fetched from it are served by the CDN WITHOUT passing
  // through requireProjectAccess, so naming an origin here is an operator's
  // explicit statement that these objects may be publicly readable.
  const cdnBase = cfg.cdnBaseUrl ? String(cfg.cdnBaseUrl).trim().replace(/\/+$/, "") : "";

  function fail(op, err) {
    console.error(`[storage.backend.s3.${op}]`, normalizeS3Error(err).message, id);
    return null;
  }

  const backend = {
    id,
    kind: "s3",
    label: cfg.label || `S3 (${Bucket})`,
    bucket: Bucket,
    maxUploadBytes: Number(cfg.maxUploadBytes) > 0 ? Number(cfg.maxUploadBytes) : 0,
    capabilities: {
      // Presign support is a deployment fact, not a protocol fact: Appwrite's
      // S3 gateway answers presign with 501, so it is configured off there and
      // the proxy path carries the bytes instead.
      presignedReads: cfg.presignedReads !== false,
      presignedWrites: cfg.presignedUploads !== false,
      publicReads: Boolean(cdnBase),
      multipart: cfg.multipart !== false,
      range: true,
      list: true,
      copy: true,
      removePrefix: true,
    },

    // Origin-side URL for a key, or null when no CDN is configured. Callers
    // only use this for immutable derivative keys -- see lib/storage/cdn.js.
    publicUrl(key) {
      if (!key || !cdnBase) return null;
      return `${cdnBase}/${String(key).split("/").map(encodeURIComponent).join("/")}`;
    },

    async put({ key, body, contentType, contentDisposition, metadata, cacheControl }) {
      if (!key || body == null) return null;
      try {
        const res = await client().send(new PutObjectCommand({
          Bucket,
          Key: key,
          Body: body,
          ContentType: contentType || "application/octet-stream",
          ...(contentDisposition ? { ContentDisposition: contentDisposition } : {}),
          Metadata: metadata || undefined,
          CacheControl: cacheControl || "public, max-age=31536000, immutable",
        }));
        cacheDelete(`head:${id}:${key}`);
        return { etag: unquote(res.ETag) };
      } catch (err) {
        return fail("put", err);
      }
    },

    async get(key, { range } = {}) {
      if (!key) return null;
      try {
        const res = await client().send(new GetObjectCommand({
          Bucket, Key: key, ...(range ? { Range: range } : {}),
        }));
        return {
          body: res.Body ?? null,
          contentType: res.ContentType ?? "application/octet-stream",
          contentLength: res.ContentLength ?? null,
          etag: unquote(res.ETag),
          contentRange: res.ContentRange ?? null,
          totalLength: totalFromContentRange(res.ContentRange),
        };
      } catch (err) {
        return fail("get", err);
      }
    },

    async head(key) {
      if (!key) return null;
      // Namespaced by backend id: the same key can exist on several members of
      // a pool, and a shared cache entry would answer for the wrong one.
      return cached(`head:${id}:${key}`, 5 * 60 * 1000, async () => {
        try {
          const res = await client().send(new HeadObjectCommand({ Bucket, Key: key }));
          return {
            size: Number(res.ContentLength ?? 0),
            etag: unquote(res.ETag),
            contentType: res.ContentType ?? "",
            lastModified: res.LastModified ? new Date(res.LastModified).toISOString() : null,
          };
        } catch (err) {
          const n = normalizeS3Error(err);
          if (n.code !== "not_found") console.error("[storage.backend.s3.head]", n.message, id);
          return null;
        }
      });
    },

    async remove(key) {
      if (!key) return false;
      try {
        await client().send(new DeleteObjectCommand({ Bucket, Key: key }));
        cacheDelete(`head:${id}:${key}`);
        cacheDelete(`sig:get:${id}:${key}`);
        return true;
      } catch (err) {
        fail("remove", err);
        return false;
      }
    },

    async removePrefix(prefix) {
      if (!prefix) return 0;
      let removed = 0;
      let cursor;
      try {
        do {
          const listed = await client().send(new ListObjectsV2Command({
            Bucket, Prefix: prefix, ContinuationToken: cursor, MaxKeys: 1000,
          }));
          const keys = (listed.Contents || []).map((o) => ({ Key: o.Key })).filter((o) => o.Key);
          if (keys.length) {
            await client().send(new DeleteObjectsCommand({ Bucket, Delete: { Objects: keys, Quiet: true } }));
            for (const { Key } of keys) cacheDelete(`head:${id}:${Key}`);
            removed += keys.length;
          }
          cursor = listed.IsTruncated ? listed.NextContinuationToken : undefined;
        } while (cursor);
        return removed;
      } catch (err) {
        return fail("removePrefix", err);
      }
    },

    async list(prefix, { limit = 1000, cursor, delimiter } = {}) {
      try {
        const res = await client().send(new ListObjectsV2Command({
          Bucket,
          Prefix: prefix || "",
          MaxKeys: Math.min(Math.max(Number(limit) || 1000, 1), 1000),
          ContinuationToken: cursor || undefined,
          Delimiter: delimiter || undefined,
        }));
        return {
          objects: (res.Contents || []).map((o) => ({
            key: o.Key,
            size: Number(o.Size ?? 0),
            etag: unquote(o.ETag),
            lastModified: o.LastModified ? new Date(o.LastModified).toISOString() : null,
          })),
          prefixes: (res.CommonPrefixes || []).map((p) => p.Prefix).filter(Boolean),
          nextCursor: res.IsTruncated ? res.NextContinuationToken : null,
        };
      } catch (err) {
        return fail("list", err);
      }
    },

    async copy(fromKey, toKey) {
      if (!fromKey || !toKey) return false;
      try {
        await client().send(new CopyObjectCommand({
          Bucket, Key: toKey, CopySource: `${Bucket}/${fromKey}`,
        }));
        cacheDelete(`head:${id}:${toKey}`);
        return true;
      } catch (err) {
        fail("copy", err);
        return false;
      }
    },

    async signGet(key, { ttl, download, filename } = {}) {
      if (!key || backend.capabilities.presignedReads === false) return null;
      try {
        return await getSignedUrl(client(), new GetObjectCommand({
          Bucket,
          Key: key,
          ResponseContentDisposition: contentDispositionFor(download, filename),
        }), { expiresIn: Number(ttl) > 0 ? Number(ttl) : signedUrlTtl });
      } catch (err) {
        return fail("signGet", err);
      }
    },

    async signPut(key, { ttl, contentType } = {}) {
      if (!key || backend.capabilities.presignedWrites === false) return null;
      try {
        return await getSignedUrl(client(), new PutObjectCommand({
          Bucket, Key: key, ContentType: contentType || "application/octet-stream",
        }), { expiresIn: Number(ttl) > 0 ? Number(ttl) : uploadUrlTtl });
      } catch (err) {
        return fail("signPut", err);
      }
    },

    multipart: {
      async create(key, { contentType, cacheControl } = {}) {
        try {
          const res = await client().send(new CreateMultipartUploadCommand({
            Bucket,
            Key: key,
            ContentType: contentType || "application/octet-stream",
            CacheControl: cacheControl || "public, max-age=31536000, immutable",
          }));
          return res.UploadId ? { uploadId: res.UploadId, key } : null;
        } catch (err) {
          return fail("multipart.create", err);
        }
      },
      async uploadPart(key, uploadId, partNumber, body) {
        try {
          const res = await client().send(new UploadPartCommand({
            Bucket, Key: key, UploadId: uploadId, PartNumber: partNumber, Body: body,
          }));
          return { partNumber, etag: unquote(res.ETag) };
        } catch (err) {
          return fail("multipart.uploadPart", err);
        }
      },
      async signPart(key, uploadId, partNumber, { ttl } = {}) {
        if (backend.capabilities.presignedWrites === false) return null;
        try {
          return await getSignedUrl(client(), new UploadPartCommand({
            Bucket, Key: key, UploadId: uploadId, PartNumber: partNumber,
          }), { expiresIn: Number(ttl) > 0 ? Number(ttl) : uploadUrlTtl });
        } catch (err) {
          return fail("multipart.signPart", err);
        }
      },
      async complete(key, uploadId, parts) {
        try {
          const res = await client().send(new CompleteMultipartUploadCommand({
            Bucket,
            Key: key,
            UploadId: uploadId,
            MultipartUpload: {
              Parts: [...parts]
                .sort((a, b) => a.partNumber - b.partNumber)
                .map((p) => ({ PartNumber: p.partNumber, ETag: `"${unquote(p.etag)}"` })),
            },
          }));
          cacheDelete(`head:${id}:${key}`);
          return { key, etag: unquote(res.ETag) };
        } catch (err) {
          return fail("multipart.complete", err);
        }
      },
      async abort(key, uploadId) {
        try {
          await client().send(new AbortMultipartUploadCommand({ Bucket, Key: key, UploadId: uploadId }));
          return true;
        } catch (err) {
          fail("multipart.abort", err);
          return false;
        }
      },
      async listParts(key, uploadId) {
        try {
          const res = await client().send(new ListPartsCommand({ Bucket, Key: key, UploadId: uploadId }));
          return (res.Parts || []).map((p) => ({
            partNumber: p.PartNumber,
            etag: unquote(p.ETag),
            size: Number(p.Size ?? 0),
          }));
        } catch (err) {
          return fail("multipart.listParts", err);
        }
      },
    },

    // A cheap, non-mutating probe: listing one key exercises credentials,
    // endpoint reachability and bucket existence without writing anything.
    async health() {
      const started = Date.now();
      try {
        await client().send(new ListObjectsV2Command({ Bucket, MaxKeys: 1 }));
        return { ok: true, detail: "reachable", latencyMs: Date.now() - started };
      } catch (err) {
        const n = normalizeS3Error(err);
        return { ok: false, detail: n.message, latencyMs: Date.now() - started };
      }
    },
  };

  return sealBackend(backend);
}
