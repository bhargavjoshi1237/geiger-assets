if (typeof window !== "undefined") {
  throw new Error("lib/storage/backends is server-only.");
}

// Backend seam: two implementations behind one interface. Writes use the
// configured default; reads ALWAYS follow the row via refFromAssetRow().
// Keys stay geiger-assets' — `key` is present in both ref shapes so
// parseKey()/authorizeKey() keep working verbatim.

import { backend as localS3 } from "./local-s3.js";
import { backend as pool } from "./pool.js";

const BACKENDS = { s3: localS3, pool };

export function writeBackendName() {
  const raw = String(process.env.ASSETS_STORAGE_BACKEND || "s3").trim().toLowerCase();
  return raw === "pool" ? "pool" : "s3";
}

export function writeBackend() {
  return BACKENDS[writeBackendName()];
}

export function backendForRef(ref) {
  if (ref?.backend === "pool") return BACKENDS.pool;
  return BACKENDS.s3;
}

export function backendById(id) {
  return id === "pool" ? BACKENDS.pool : BACKENDS.s3;
}

// The safety net for the whole migration: a row written before the pool
// shipped has no pool_file_id, so it resolves to S3 forever unless
// deliberately migrated. Works for asset rows and asset_version rows — both
// carry storage_key / pool_file_id / pool_url.
export function refFromAssetRow(row) {
  if (!row) return null;
  const key = row.storage_key ?? null;
  if (!key) return null;
  if (row.pool_file_id) {
    return {
      backend: "pool",
      key,
      fileId: row.pool_file_id,
      directUrl: row.pool_url ?? null,
    };
  }
  return { backend: "s3", key };
}
