if (typeof window !== "undefined") {
  throw new Error("lib/storage/backends is server-only.");
}

import { createS3Backend } from "./s3_backend.js";
import { createRestBackend } from "./rest_backend.js";
import { s3Config, isS3Configured } from "@/lib/s3/config";

// Driver construction: a stored backend record in, a live driver out.
//
// Each kind owns its own config vocabulary, so the registry deliberately does
// not normalise config keys -- it hands the bag straight to the factory, which
// is the only code that knows what the fields mean.

export const BACKEND_KINDS = Object.freeze(["s3", "rest"]);

const FACTORIES = Object.freeze({
  s3: createS3Backend,
  rest: createRestBackend,
});

export function isBackendKind(kind) {
  return BACKEND_KINDS.includes(kind);
}

// Drivers hold pooled HTTP connections, so rebuilding one per request would
// throw away keep-alive and re-do TLS on every upload. Cached on the record's
// updated_at, which means editing a backend in the UI invalidates its driver
// without any explicit cache-busting.
const drivers = new Map();

export function resetBackendRegistry() {
  drivers.clear();
}

export function backendFromRecord(record) {
  if (!record?.id || !isBackendKind(record.kind)) return null;
  if (record.enabled === false) return null;

  const stamp = `${record.id}:${record.updatedAt || ""}`;
  const hit = drivers.get(record.id);
  if (hit && hit.stamp === stamp) return hit.driver;

  const factory = FACTORIES[record.kind];
  const driver = factory({
    ...(record.config || {}),
    id: record.id,
    label: record.label || "",
    maxUploadBytes: Number(record.maxUploadBytes) || 0,
  });
  if (!driver) {
    console.error("[storage.registry] could not build driver", record.kind, record.id);
    drivers.delete(record.id);
    return null;
  }
  drivers.set(record.id, { stamp, driver });
  return driver;
}

// The backend every pre-existing asset resolves to.
//
// Rows written before pooling existed carry a null storage_backend, and the
// bytes they point at are in the env-configured bucket. Treating null as "the
// env backend" is what lets this feature ship without a data migration.
let envDriver = null;
let envStamp = "";

export function envBackend() {
  if (!isS3Configured()) return null;
  const cfg = s3Config();
  const stamp = `${cfg.endpoint}|${cfg.bucket}|${cfg.accessKeyId}`;
  if (envDriver && envStamp === stamp) return envDriver;
  envDriver = createS3Backend({ ...cfg, id: "env", label: `Default (${cfg.bucket})` });
  envStamp = stamp;
  return envDriver;
}

export function resetEnvBackend() {
  envDriver = null;
  envStamp = "";
}

// Field descriptors for the settings UI, so a "add a backend" form can be
// rendered from the catalog instead of hardcoding a form per kind. `secret`
// fields are write-only: the API answers with a `<name>Set` boolean instead of
// the value (see lib/storage/backends/secrets.js).
export const BACKEND_FIELDS = Object.freeze({
  s3: Object.freeze([
    { name: "endpoint", label: "Endpoint", required: true, placeholder: "https://s3.example.com" },
    { name: "region", label: "Region", required: false, placeholder: "auto" },
    { name: "bucket", label: "Bucket", required: true },
    { name: "accessKeyId", label: "Access key ID", required: true, secret: true },
    { name: "secretAccessKey", label: "Secret access key", required: true, secret: true },
    { name: "forcePathStyle", label: "Force path-style URLs", type: "boolean", default: true },
    { name: "presignedReads", label: "Supports presigned reads", type: "boolean", default: true },
    { name: "presignedUploads", label: "Supports presigned uploads", type: "boolean", default: true },
  ]),
  rest: Object.freeze([
    { name: "baseUrl", label: "Base URL", required: true, placeholder: "https://files.internal/api" },
    { name: "authType", label: "Auth", type: "select", options: ["none", "bearer", "header", "basic"], default: "none" },
    { name: "token", label: "Bearer token", secret: true },
    { name: "headerName", label: "Header name", placeholder: "X-Api-Key" },
    { name: "authValue", label: "Header value", secret: true },
    { name: "username", label: "Username" },
    { name: "password", label: "Password", secret: true },
    { name: "uploadMethod", label: "Upload method", type: "select", options: ["PUT", "POST"], default: "PUT" },
    { name: "publicBaseUrl", label: "Public read URL", placeholder: "https://cdn.example.com" },
  ]),
});
