if (typeof window !== "undefined") {
  throw new Error("lib/storage/backends is server-only.");
}

// The storage backend contract.
//
// Every backend is a plain object exposing the operations below. The return
// shapes are deliberately identical to the ones lib/s3/objects.js already
// produced, because that is what the whole storage service was written
// against -- adopting the existing shape rather than inventing a new one is
// what lets S3 become "one backend among several" without touching callers.
//
// Like the Supabase data layer, backends never throw and never toast: they
// console.error and return null / false so a dead provider degrades to "that
// object isn't here" instead of taking the request down. Pooling depends on
// this -- pool.js reads a null as "try the next member".
//
//   put({ key, body, contentType, contentDisposition, metadata, cacheControl })
//       -> { etag } | null
//   get(key, { range })
//       -> { body, contentType, contentLength, etag, contentRange, totalLength } | null
//   head(key)
//       -> { size, etag, contentType, lastModified } | null
//   remove(key)                  -> boolean
//   removePrefix(prefix)         -> number | null      (optional)
//   list(prefix, { limit, cursor, delimiter })
//       -> { objects: [{ key, size, etag, lastModified }], prefixes, nextCursor } | null
//   copy(fromKey, toKey)         -> boolean            (optional)
//   signGet(key, { ttl, download, filename })  -> url | null
//   signPut(key, { ttl, contentType, maxBytes }) -> url | null
//   health()                     -> { ok, detail }
//
// signGet/signPut return null when the provider cannot presign. That is a
// normal answer, not a failure -- Appwrite's S3 gateway answers presign with
// 501, which is why the proxy path exists at all. Callers branch on
// capabilities.presignedReads / .presignedWrites rather than probing.

// Capability flags a backend advertises. Anything absent is false, so a
// minimal backend only has to declare what it can actually do.
export const CAPABILITIES = Object.freeze([
  "presignedReads",
  "presignedWrites",
  "multipart",
  "range",
  "list",
  "copy",
  "removePrefix",
]);

// Operations every backend must implement. The optional ones (copy,
// removePrefix, multipart) are gated by their capability flag instead.
const REQUIRED_OPS = Object.freeze([
  "put",
  "get",
  "head",
  "remove",
  "signGet",
  "signPut",
  "health",
]);

export function normalizeCapabilities(input) {
  const caps = {};
  for (const name of CAPABILITIES) caps[name] = Boolean(input?.[name]);
  return Object.freeze(caps);
}

// Validates a backend at construction time rather than at first use: a
// misconfigured provider should fail when it is registered, not halfway
// through someone's upload.
export function assertBackend(backend) {
  if (!backend || typeof backend !== "object") return "backend_not_an_object";
  if (!backend.id) return "backend_missing_id";
  if (!backend.kind) return "backend_missing_kind";
  for (const op of REQUIRED_OPS) {
    if (typeof backend[op] !== "function") return `backend_missing_op:${op}`;
  }
  if (backend.capabilities?.multipart && typeof backend.multipart !== "object") {
    return "backend_claims_multipart_without_impl";
  }
  return null;
}

// Wraps a driver's raw operations so a thrown error can never escape into a
// route handler. Drivers are expected to return null themselves, but a
// transport-level throw (DNS failure, aborted socket) would otherwise bypass
// their own try/catch and break the tri-state contract the callers rely on.
export function sealBackend(backend) {
  const problem = assertBackend(backend);
  if (problem) {
    console.error("[storage.backend]", problem, backend?.id || "");
    return null;
  }
  const sealed = { ...backend, capabilities: normalizeCapabilities(backend.capabilities) };
  for (const op of [...REQUIRED_OPS, "list", "copy", "removePrefix"]) {
    const fn = backend[op];
    if (typeof fn !== "function") continue;
    // Booleans fail closed to false; everything else fails closed to null,
    // matching what each operation's own error path already returns.
    const fallback = op === "remove" || op === "copy" ? false : null;
    sealed[op] = async (...args) => {
      try {
        return await fn.apply(backend, args);
      } catch (e) {
        console.error(`[storage.backend.${backend.kind}.${op}]`, e?.message || e);
        return fallback;
      }
    };
  }
  return Object.freeze(sealed);
}
