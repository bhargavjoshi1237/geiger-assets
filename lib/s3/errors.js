if (typeof window !== "undefined") {
  throw new Error("lib/s3 is server-only — import lib/storage/client on the browser.");
}

export function normalizeS3Error(err) {
  const name = err?.name || err?.Code || err?.code || "";
  const http = err?.$metadata?.httpStatusCode;
  const message = err?.message || String(err ?? "unknown S3 error");

  if (
    name === "NotFound" ||
    name === "NoSuchKey" ||
    name === "NoSuchBucket" ||
    http === 404
  ) {
    return { code: "not_found", message, retryable: false };
  }
  if (name === "Forbidden" || name === "AccessDenied" || http === 403) {
    return { code: "forbidden", message, retryable: false };
  }
  if (name === "BucketAlreadyExists" || name === "BucketAlreadyOwnedByYou" || http === 409) {
    return { code: "conflict", message, retryable: false };
  }
  if (name === "EntityTooLarge" || name === "TooLarge" || http === 413) {
    return { code: "too_large", message, retryable: false };
  }
  if (
    name === "NetworkingError" ||
    name === "TimeoutError" ||
    name === "ECONNRESET" ||
    name === "ENOTFOUND" ||
    name === "EAI_AGAIN" ||
    err?.code === "ECONNRESET" ||
    err?.code === "ENOTFOUND" ||
    err?.code === "EAI_AGAIN" ||
    http === 503 ||
    http === 500
  ) {
    return { code: "network", message, retryable: true };
  }
  return { code: "unknown", message, retryable: false };
}

export function toStorageError(op, err) {
  const n = normalizeS3Error(err);
  console.error(`[s3.${op}]`, n.message);
  return n;
}

export const STORAGE_STATUS = ["none", "pending", "stored", "failed", "missing"];

export const UPLOAD_MODE = ["presigned", "proxy"];

export const ERROR_TO_HTTP = {
  not_found: 404,
  forbidden: 403,
  conflict: 409,
  too_large: 413,
  network: 503,
  unknown: 500,
};

export function errorToStatus(code) {
  return ERROR_TO_HTTP[code] ?? 500;
}
