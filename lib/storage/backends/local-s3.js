if (typeof window !== "undefined") {
  throw new Error("lib/storage/backends/local-s3 is server-only.");
}

// Today's behaviour, extracted verbatim as the reference backend. No logic
// lives here beyond adapting lib/s3/objects to the backend interface —
// byte-for-byte equivalence with the pre-seam paths is the point.

import { GetObjectCommand } from "@aws-sdk/client-s3";
import { isS3Configured, s3Config } from "@/lib/s3/config";
import { s3Client } from "@/lib/s3/client";
import {
  headObject,
  putObject,
  getObjectStream,
  signGetUrl,
  signPutUrl,
  deleteObject,
  deleteObjectsByPrefix,
} from "@/lib/s3/objects";

export const backend = {
  id: "s3",

  isConfigured() {
    return isS3Configured();
  },

  async head(ref) {
    if (!ref?.key) return null;
    return headObject(ref.key);
  },

  async put({ key, body, contentType, contentDisposition }) {
    if (!key || body == null) return null;
    const stored = await putObject({ key, body, contentType, contentDisposition });
    if (!stored) return null;
    return { etag: stored.etag ?? null, ref: { backend: "s3", key } };
  },

  async getStream(ref, { range } = {}) {
    if (!ref?.key) return null;
    if (!range) {
      const got = await getObjectStream(ref.key);
      if (!got?.body) return null;
      return {
        stream: got.body,
        size: got.contentLength ?? null,
        contentType: got.contentType ?? "application/octet-stream",
        etag: got.etag ?? null,
        status: 200,
        contentRange: null,
      };
    }
    if (!isS3Configured()) return null;
    try {
      const cfg = s3Config();
      const res = await s3Client().send(
        new GetObjectCommand({ Bucket: cfg.bucket, Key: ref.key, Range: range })
      );
      return {
        stream: res.Body ?? null,
        size: res.ContentLength ?? null,
        contentType: res.ContentType ?? "application/octet-stream",
        etag: (res.ETag || "").replace(/"/g, "") || null,
        status: res.ContentRange ? 206 : 200,
        contentRange: res.ContentRange ?? null,
      };
    } catch {
      return null;
    }
  },

  async signRead(ref, { ttl, download, filename } = {}) {
    if (!ref?.key) return null;
    return signGetUrl(ref.key, { ttl, download, filename });
  },

  async issueUpload({ key, contentType, sizeBytes }) {
    if (!key) return { error: "bad_request" };
    const cfg = s3Config();
    if (!cfg.presignedUploads) {
      return { mode: "proxy", ticket: {}, uploadRef: null };
    }
    const url = await signPutUrl(key, {
      ttl: cfg.uploadUrlTtl,
      contentType,
      maxBytes: sizeBytes,
    });
    if (!url) return { error: "sign_failed" };
    return { mode: "presigned", ticket: { url }, uploadRef: null };
  },

  async finalizeUpload({ ref, key, uploadRef } = {}) {
    const k = key || ref?.key || uploadRef?.key;
    if (!k) return { error: "bad_request" };
    const head = await headObject(k);
    if (!head) return { error: "not_committed" };
    return {
      size: head.size,
      etag: head.etag ?? null,
      contentType: head.contentType || "",
      ref: { backend: "s3", key: k },
    };
  },

  async remove(ref) {
    if (!ref?.key) return false;
    return deleteObject(ref.key);
  },

  async removeByPrefix(prefix) {
    if (!prefix) return null;
    const deleted = await deleteObjectsByPrefix(prefix);
    return { deleted };
  },
};
