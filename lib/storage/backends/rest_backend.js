if (typeof window !== "undefined") {
  throw new Error("lib/storage/backends is server-only.");
}

import { sealBackend } from "./contract.js";

// Generic REST storage backend, parameterized by config.
//
// Points at an operator-run HTTP file service (upload + basic object routes)
// instead of S3. The service is expected to expose one URL per operation;
// this driver only speaks plain HTTP verbs so any minimal file server can sit
// behind it. Nothing here reads process.env -- the config always arrives from
// the caller, which is what makes a backend row in the database a
// first-class provider.
//
// Deliberately no SSRF / private-IP blocking in this file. These endpoints
// are configured by an operator and pointing at an internal host (for
// example https://files.internal) is the entire point of this backend, so a
// private-IP guard would break the feature it claims to protect. Do not add
// one here -- access control belongs at the operator-config layer, not in
// the fetch path.

function stripTrailingSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}

function isHttpUrl(value) {
  try {
    const u = new URL(String(value));
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
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

// Percent-encode a key per path segment so `/` separators survive while
// names with spaces or special characters still form a valid URL.
function encodeKeySegments(key) {
  return String(key).split("/").map((seg) => encodeURIComponent(seg)).join("/");
}

// A key must never escape its route template (for example `a/../../secret`),
// so any `..` segment rejects the operation before a URL is built.
function isSafeKey(key) {
  if (typeof key !== "string" || !key) return false;
  const parts = key.split("/");
  for (const seg of parts) {
    if (seg === "..") return false;
    // An encoded traversal ("%2e%2e") encodes again to "%252e..." and stays
    // inert, but a server that decodes twice would still see "..", so reject
    // it up front as well.
    try {
      if (decodeURIComponent(seg) === "..") return false;
    } catch {
      // Not decodable -- nothing to check beyond the raw segment above.
    }
  }
  return true;
}

// Auth headers are built once at construction so per-request code never
// touches the raw credential again. Callers must never log the result --
// token and password values must not appear in console output.
function buildAuthHeaders(cfg) {
  const authType = cfg.authType || "none";
  if (authType === "bearer" && cfg.token) {
    return { Authorization: `Bearer ${cfg.token}` };
  }
  if (authType === "header" && cfg.headerName && cfg.authValue) {
    return { [String(cfg.headerName)]: String(cfg.authValue) };
  }
  if (authType === "basic" && cfg.username != null && cfg.password != null) {
    const pair = `${cfg.username}:${cfg.password}`;
    return { Authorization: `Basic ${Buffer.from(pair, "utf8").toString("base64")}` };
  }
  return {};
}

function isRedirect(res) {
  return res.status >= 300 && res.status < 400;
}

function filenameFor(key) {
  const last = String(key).split("/").pop();
  return last || "file";
}

// Best-effort release of a response body the caller will never read (the
// ranged-GET fallback in head). Frees the socket without throwing.
async function cancelBody(res) {
  try {
    await res?.body?.cancel();
  } catch {
    // A missing or already-closed body is fine -- there is nothing to free.
  }
}

function isoFromHttpDate(value) {
  if (!value) return null;
  const t = Date.parse(value);
  if (Number.isNaN(t)) return null;
  try {
    return new Date(t).toISOString();
  } catch {
    return null;
  }
}

// Normalizes a last-modified-ish value to an ISO string when it parses,
// otherwise keeps the raw string so operator-specific formats are not lost.
function normalizeLastModified(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    try {
      return new Date(value).toISOString();
    } catch {
      return null;
    }
  }
  const raw = String(value);
  const t = Date.parse(raw);
  if (!Number.isNaN(t)) {
    try {
      return new Date(t).toISOString();
    } catch {
      return raw;
    }
  }
  return raw;
}

function normalizeListEntry(entry) {
  if (!entry || typeof entry !== "object") return null;
  const key = entry.key ?? entry.name ?? entry.path;
  if (key == null || key === "") return null;
  const sizeRaw = entry.size ?? entry.bytes ?? entry.contentLength ?? 0;
  const sizeNum = Number(sizeRaw);
  return {
    key: String(key),
    size: Number.isFinite(sizeNum) ? sizeNum : 0,
    etag: unquote(entry.etag ?? entry.ETag ?? ""),
    lastModified: normalizeLastModified(entry.lastModified ?? entry.modified ?? entry.updatedAt),
  };
}

export function createRestBackend(input) {
  const cfg = input || {};
  if (!cfg.baseUrl || !isHttpUrl(cfg.baseUrl)) {
    console.error("[storage.backend.rest] invalid baseUrl", cfg.id || "");
    return null;
  }

  const id = String(cfg.id || "rest");
  const base = stripTrailingSlash(cfg.baseUrl);
  const timeoutMs = Number(cfg.timeoutMs) > 0 ? Number(cfg.timeoutMs) : 30000;
  const uploadMethod = String(cfg.uploadMethod || "PUT").toUpperCase() === "POST" ? "POST" : "PUT";
  const uploadField = String(cfg.uploadField || "file");
  const publicBase = cfg.publicBaseUrl ? stripTrailingSlash(cfg.publicBaseUrl) : "";

  const custom = cfg.routes && typeof cfg.routes === "object" ? cfg.routes : {};
  function pick(name, fallback) {
    const v = custom[name];
    if (typeof v === "string" && v) return v;
    return fallback;
  }
  // Key routes are templates with a {key} placeholder; the list route is a
  // plain collection URL and takes its scoping on the query string instead.
  const routes = {
    put: pick("put", `${base}/objects/{key}`),
    get: pick("get", `${base}/objects/{key}`),
    head: pick("head", `${base}/objects/{key}`),
    delete: pick("delete", `${base}/objects/{key}`),
    list: pick("list", `${base}/objects`),
  };

  function urlFor(template, key) {
    return template.split("{key}").join(encodeKeySegments(key));
  }

  function listUrl({ prefix, cursor, limit, delimiter } = {}) {
    const params = new URLSearchParams();
    // Prefix/cursor/limit ride on the query string; delimiter is forwarded
    // too so tree-style listings keep working when the server supports it.
    if (prefix != null && prefix !== "") params.set("prefix", String(prefix));
    else if (prefix === "") params.set("prefix", "");
    if (cursor != null && cursor !== "") params.set("cursor", String(cursor));
    if (Number(limit) > 0) params.set("limit", String(Number(limit)));
    if (delimiter != null && delimiter !== "") params.set("delimiter", String(delimiter));
    const qs = params.toString();
    if (!qs) return routes.list;
    return routes.list.includes("?") ? `${routes.list}&${qs}` : `${routes.list}?${qs}`;
  }

  // Built once -- per-request code spreads copies, never the secret itself.
  const authHeaders = buildAuthHeaders(cfg);
  const sharedExtra = cfg.extraHeaders && typeof cfg.extraHeaders === "object" && !Array.isArray(cfg.extraHeaders)
    ? { ...cfg.extraHeaders }
    : {};

  function fail(op, message) {
    // Never include headers, tokens, or passwords here -- only the status or
    // transport message plus the backend id for triage.
    console.error(`[storage.backend.rest.${op}]`, message, id);
    return null;
  }

  const backend = {
    id,
    kind: "rest",
    label: cfg.label || `REST (${base})`,
    capabilities: {
      presignedReads: Boolean(publicBase),
      presignedWrites: false,
      multipart: false,
      range: true,
      list: true,
      copy: false,
      removePrefix: false,
    },

    async put({ key, body, contentType, contentDisposition, metadata, cacheControl } = {}) {
      if (!key || body == null) return null;
      if (!isSafeKey(key)) return fail("put", "invalid key");
      try {
        const url = urlFor(routes.put, key);
        let res;
        if (uploadMethod === "POST") {
          // Multipart upload: the file rides under uploadField with the key
          // as a sibling field so key-style services can place it. Never set
          // Content-Type by hand here -- fetch owns the boundary.
          let filePart;
          if (body instanceof Blob) {
            filePart = body;
          } else if (typeof body === "string" || body instanceof ArrayBuffer || ArrayBuffer.isView(body)) {
            filePart = new Blob([body], { type: contentType || "application/octet-stream" });
          } else {
            // Streams and anything exotic are buffered once so they can ride
            // as a single multipart part.
            try {
              const buf = await new Response(body).arrayBuffer();
              filePart = new Blob([buf], { type: contentType || "application/octet-stream" });
            } catch {
              return fail("put", "unsupported body");
            }
          }
          const form = new FormData();
          form.append(uploadField, filePart, filenameFor(key));
          form.append("key", String(key));
          const headers = { ...authHeaders, ...sharedExtra };
          // An operator-provided Content-Type would clobber the multipart
          // boundary fetch generates, so it is dropped for this branch only.
          for (const name of Object.keys(headers)) {
            if (name.toLowerCase() === "content-type") delete headers[name];
          }
          if (contentDisposition) headers["Content-Disposition"] = contentDisposition;
          if (cacheControl) headers["Cache-Control"] = cacheControl;
          if (metadata && typeof metadata === "object") {
            for (const [k, v] of Object.entries(metadata)) {
              if (v == null) continue;
              headers[`X-Metadata-${k}`] = String(v);
            }
          }
          res = await fetch(url, {
            method: "POST",
            headers,
            body: form,
            signal: AbortSignal.timeout(timeoutMs),
            redirect: "manual",
          });
        } else {
          // Raw upload: the bytes are the request body with a Content-Type,
          // matching what a plain PUT object route expects.
          const headers = {
            ...authHeaders,
            ...sharedExtra,
            "Content-Type": contentType || "application/octet-stream",
          };
          if (contentDisposition) headers["Content-Disposition"] = contentDisposition;
          if (cacheControl) headers["Cache-Control"] = cacheControl;
          if (metadata && typeof metadata === "object") {
            for (const [k, v] of Object.entries(metadata)) {
              if (v == null) continue;
              headers[`X-Metadata-${k}`] = String(v);
            }
          }
          res = await fetch(url, {
            method: "PUT",
            headers,
            body,
            // Required by undici whenever the body is a stream rather than a
            // buffer, and ignored otherwise -- so a large upload that arrives
            // as a stream does not throw before it leaves the process.
            duplex: "half",
            signal: AbortSignal.timeout(timeoutMs),
            redirect: "manual",
          });
        }
        // A 3xx is surfaced (redirect: manual) and treated as a failure: a
        // redirect from an operator-configured storage host is not something
        // to follow blindly.
        if (isRedirect(res) || !res.ok) {
          await cancelBody(res);
          return fail("put", `http_${res.status}`);
        }
        // Prefer the etag header, falling back to a JSON body etag/ETag
        // field for services that answer the upload with metadata.
        let etag = unquote(res.headers.get("etag"));
        if (!etag) {
          try {
            const text = await res.text();
            if (text) {
              const data = JSON.parse(text);
              const v = data?.etag ?? data?.ETag;
              if (v) etag = unquote(String(v));
            }
          } catch {
            // A non-JSON or empty success body simply carries no etag.
          }
        }
        return { etag: etag || null };
      } catch (e) {
        return fail("put", e?.message || e);
      }
    },

    async get(key, { range } = {}) {
      if (!key) return null;
      if (!isSafeKey(key)) return fail("get", "invalid key");
      try {
        const headers = { ...authHeaders, ...sharedExtra };
        if (range) headers.Range = range;
        const res = await fetch(urlFor(routes.get, key), {
          headers,
          signal: AbortSignal.timeout(timeoutMs),
          redirect: "manual",
        });
        // A miss is a normal answer, not an error -- stay quiet like S3 does.
        if (res.status === 404) {
          await cancelBody(res);
          return null;
        }
        if (isRedirect(res) || !res.ok) {
          await cancelBody(res);
          return fail("get", `http_${res.status}`);
        }
        const contentRange = res.headers.get("content-range");
        const lengthRaw = res.headers.get("content-length");
        const lengthNum = lengthRaw == null ? null : Number(lengthRaw);
        return {
          // WHATWG ReadableStream -- callers pipe it straight into a Response.
          body: res.body ?? null,
          contentType: res.headers.get("content-type") ?? "application/octet-stream",
          contentLength: lengthNum != null && Number.isFinite(lengthNum) ? lengthNum : null,
          etag: unquote(res.headers.get("etag")),
          contentRange,
          totalLength: totalFromContentRange(contentRange),
        };
      } catch (e) {
        return fail("get", e?.message || e);
      }
    },

    async head(key) {
      if (!key) return null;
      if (!isSafeKey(key)) return fail("head", "invalid key");
      try {
        const headers = { ...authHeaders, ...sharedExtra };
        const res = await fetch(urlFor(routes.head, key), {
          method: "HEAD",
          headers,
          signal: AbortSignal.timeout(timeoutMs),
          redirect: "manual",
        });
        if (res.status === 404) {
          await cancelBody(res);
          return null;
        }
        if (res.status === 405) {
          // No HEAD support -- a one-byte ranged GET exposes the same facts
          // via content-range without downloading the object.
          await cancelBody(res);
          const ranged = await fetch(urlFor(routes.get, key), {
            headers: { ...authHeaders, ...sharedExtra, Range: "bytes=0-0" },
            signal: AbortSignal.timeout(timeoutMs),
            redirect: "manual",
          });
          try {
            if (ranged.status === 404) return null;
            if (isRedirect(ranged) || !ranged.ok) return fail("head", `http_${ranged.status}`);
            const contentRange = ranged.headers.get("content-range");
            const total = totalFromContentRange(contentRange);
            const lengthRaw = ranged.headers.get("content-length");
            const lengthNum = lengthRaw == null ? null : Number(lengthRaw);
            const size = total ?? (lengthNum != null && Number.isFinite(lengthNum) ? lengthNum : 0);
            return {
              size: Number.isFinite(size) ? size : 0,
              etag: unquote(ranged.headers.get("etag")),
              contentType: ranged.headers.get("content-type") ?? "",
              lastModified: isoFromHttpDate(ranged.headers.get("last-modified")),
            };
          } finally {
            await cancelBody(ranged);
          }
        }
        if (isRedirect(res) || !res.ok) {
          await cancelBody(res);
          return fail("head", `http_${res.status}`);
        }
        const lengthRaw = res.headers.get("content-length");
        const lengthNum = lengthRaw == null ? 0 : Number(lengthRaw);
        return {
          size: Number.isFinite(lengthNum) ? lengthNum : 0,
          etag: unquote(res.headers.get("etag")),
          contentType: res.headers.get("content-type") ?? "",
          lastModified: isoFromHttpDate(res.headers.get("last-modified")),
        };
      } catch (e) {
        return fail("head", e?.message || e);
      }
    },

    async remove(key) {
      if (!key) return false;
      if (!isSafeKey(key)) {
        console.error("[storage.backend.rest.remove]", "invalid key", id);
        return false;
      }
      try {
        const res = await fetch(urlFor(routes.delete, key), {
          method: "DELETE",
          headers: { ...authHeaders, ...sharedExtra },
          signal: AbortSignal.timeout(timeoutMs),
          redirect: "manual",
        });
        // 404 counts as success -- the object is gone either way.
        if (res.status === 404) {
          await cancelBody(res);
          return true;
        }
        if (isRedirect(res) || !res.ok) {
          await cancelBody(res);
          console.error("[storage.backend.rest.remove]", `http_${res.status}`, id);
          return false;
        }
        await cancelBody(res);
        return true;
      } catch (e) {
        console.error("[storage.backend.rest.remove]", e?.message || e, id);
        return false;
      }
    },

    async list(prefix, { limit, cursor, delimiter } = {}) {
      try {
        const res = await fetch(listUrl({ prefix: prefix || "", cursor, limit, delimiter }), {
          headers: { ...authHeaders, ...sharedExtra },
          signal: AbortSignal.timeout(timeoutMs),
          redirect: "manual",
        });
        if (isRedirect(res) || !res.ok) {
          await cancelBody(res);
          return fail("list", `http_${res.status}`);
        }
        let data;
        try {
          data = await res.json();
        } catch {
          return fail("list", "invalid json");
        }
        // The service may answer with an envelope or with a bare array of
        // objects; both describe the same listing.
        const rawObjects = Array.isArray(data) ? data : data?.objects;
        if (!Array.isArray(rawObjects)) return fail("list", "invalid listing");
        const objects = rawObjects.map(normalizeListEntry).filter(Boolean);
        if (Array.isArray(data)) {
          return { objects, prefixes: [], nextCursor: null };
        }
        const prefixes = Array.isArray(data.prefixes)
          ? data.prefixes.map((p) => String(p)).filter(Boolean)
          : [];
        return { objects, prefixes, nextCursor: data.nextCursor ?? null };
      } catch (e) {
        return fail("list", e?.message || e);
      }
    },

    // No presigning against a generic file service -- when a public base URL
    // is configured the object is already addressable, otherwise the proxy
    // path carries the bytes.
    async signGet(key, { download, filename } = {}) {
      void download;
      void filename;
      if (!key || !publicBase) return null;
      if (!isSafeKey(key)) return null;
      try {
        return `${publicBase}/${encodeKeySegments(key)}`;
      } catch (e) {
        return fail("signGet", e?.message || e);
      }
    },

    async signPut() {
      return null;
    },

    // A cheap, non-mutating probe: listing one key exercises credentials and
    // host reachability without writing anything.
    async health() {
      const started = Date.now();
      try {
        const res = await fetch(listUrl({ limit: 1 }), {
          headers: { ...authHeaders, ...sharedExtra },
          signal: AbortSignal.timeout(timeoutMs),
          redirect: "manual",
        });
        const latencyMs = Date.now() - started;
        if (isRedirect(res) || !res.ok) {
          await cancelBody(res);
          return { ok: false, detail: `http_${res.status}`, latencyMs };
        }
        await cancelBody(res);
        return { ok: true, detail: "reachable", latencyMs };
      } catch (e) {
        return { ok: false, detail: e?.message || "unreachable", latencyMs: Date.now() - started };
      }
    },
  };

  return sealBackend(backend);
}
