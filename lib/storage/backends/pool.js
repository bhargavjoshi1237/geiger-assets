if (typeof window !== "undefined") {
  throw new Error("lib/storage/backends/pool is server-only.");
}

// The dash storage pool, behind the backend interface. Logical paths are
// geiger-assets keys with a leading slash; the pool's file id is the locator
// persisted per object (pool_file_id) and the gateway URL is the stable read
// link for anything a browser fetches directly.

function apiBase() {
  return String(process.env.GEIGER_STORAGE_API_URL || "").replace(/\/+$/, "");
}

function apiKey() {
  return String(process.env.GEIGER_STORAGE_API_KEY || "").trim();
}

function headers() {
  return { Authorization: `Bearer ${apiKey()}`, "Content-Type": "application/json" };
}

function toPoolPath(key) {
  const raw = String(key || "").trim();
  if (!raw) return "/";
  return raw.startsWith("/") ? raw : `/${raw}`;
}

async function readJsonSafe(res) {
  const text = await res.text().catch(() => "");
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

// The pool's codes surface as geiger-assets' existing vocabulary so callers
// and the UI need no changes. storage_full is new; the UI treats it like
// too_large.
function mapPoolError(status, payload) {
  const code = payload?.code;
  if (status === 401 || status === 403) {
    console.error("[storage.pool] pool auth failed — check GEIGER_STORAGE_API_KEY.");
    return { error: "storage_unconfigured" };
  }
  if (status === 507 || code === "pool_full" || code === "no_capability") {
    return { error: "storage_full" };
  }
  if (status === 413 || code === "object_too_large") return { error: "too_large" };
  if (status === 409 || code === "invalid_path") return { error: "bad_request" };
  return { error: payload?.error || "pool_failed" };
}

export const backend = {
  id: "pool",

  isConfigured() {
    return Boolean(apiBase() && apiKey());
  },

  async head(ref) {
    if (!ref || !this.isConfigured()) return null;
    const base = apiBase();
    const tryUrls = [];
    if (ref.fileId) tryUrls.push(`${base}/api/storage/stat?id=${encodeURIComponent(ref.fileId)}`);
    if (ref.key) tryUrls.push(`${base}/api/storage/stat?path=${encodeURIComponent(toPoolPath(ref.key))}`);

    for (const url of tryUrls) {
      try {
        const res = await fetch(url, { headers: { Authorization: `Bearer ${apiKey()}` } });
        if (res.status === 404) continue;
        if (!res.ok) continue;
        const file = await res.json();
        return {
          size: Number(file.size ?? 0),
          etag: file.etag ?? null,
          contentType: file.mimeType || "",
          lastModified: null,
          provider: file.placement?.provider || null,
          directUrl: file.directUrl || "",
          fileId: file.id || ref.fileId || null,
        };
      } catch (err) {
        console.error("[storage.pool.head]", err?.message || err);
      }
    }
    return null;
  },

  // Used by proxyStore and derivative writes: reserve -> transfer -> commit in
  // one call (<=4.5 MB through the dash function).
  async put({ key, body, contentType }) {
    if (!key || body == null || !this.isConfigured()) return null;
    try {
      const form = new FormData();
      form.append("path", toPoolPath(key));
      const bytes = Buffer.isBuffer(body) ? body : Buffer.from(body);
      form.append("file", new Blob([bytes], { type: contentType || "application/octet-stream" }), String(key).split("/").pop() || "file");

      const res = await fetch(`${apiBase()}/api/storage/upload?direct=1`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey()}` },
        body: form,
      });
      const payload = await readJsonSafe(res);
      if (!res.ok) return null;
      return {
        etag: payload.etag ?? null,
        ref: {
          backend: "pool",
          key,
          fileId: payload.id,
          directUrl: payload.directUrl || "",
        },
        provider: payload.placement?.provider || null,
      };
    } catch (err) {
      console.error("[storage.pool.put]", err?.message || err);
      return null;
    }
  },

  async getStream(ref, { range } = {}) {
    if (!ref || !this.isConfigured()) return null;
    const base = apiBase();
    const url = ref.fileId
      ? `${base}/api/storage/read?id=${encodeURIComponent(ref.fileId)}`
      : ref.key
        ? `${base}/api/storage/read?path=${encodeURIComponent(toPoolPath(ref.key))}`
        : null;
    if (!url) return null;

    try {
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${apiKey()}`,
          ...(range ? { Range: range } : {}),
        },
      });
      if (res.status !== 200 && res.status !== 206) return null;
      return {
        stream: res.body,
        size: res.headers.get("content-length") != null ? Number(res.headers.get("content-length")) : null,
        contentType: res.headers.get("content-type") || "application/octet-stream",
        etag: (res.headers.get("etag") || "").replace(/"/g, "") || null,
        status: res.status,
        contentRange: res.headers.get("content-range"),
      };
    } catch (err) {
      console.error("[storage.pool.getStream]", err?.message || err);
      return null;
    }
  },

  // Already stable and handles private objects — use it for anything a
  // browser fetches directly, and reserve /read for server-side byte access.
  async signRead(ref) {
    if (!ref?.fileId || !this.isConfigured()) return null;
    return `${apiBase()}/api/storage/f/${ref.fileId}`;
  },

  async issueUpload({ key, contentType, sizeBytes }) {
    if (!key || !this.isConfigured()) return { error: "storage_unconfigured" };
    try {
      const res = await fetch(`${apiBase()}/api/storage/upload`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          path: toPoolPath(key),
          size: Number(sizeBytes) || 0,
          mimeType: contentType || "application/octet-stream",
        }),
      });
      const payload = await readJsonSafe(res);
      if (!res.ok) return mapPoolError(res.status, payload);
      return {
        mode: payload.mode,
        ticket: payload.ticket,
        uploadRef: { uploadId: payload.uploadId },
        expiresAt: payload.expiresAt || null,
        provider: payload.provider || null,
      };
    } catch (err) {
      console.error("[storage.pool.issueUpload]", err?.message || err);
      return { error: "pool_failed" };
    }
  },

  async finalizeUpload({ uploadRef, parts, response, providerKey } = {}) {
    const uploadId = uploadRef?.uploadId;
    if (!uploadId || !this.isConfigured()) return { error: "bad_request" };
    try {
      const res = await fetch(`${apiBase()}/api/storage/commit`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          uploadId,
          parts: Array.isArray(parts) ? parts : [],
          response: response || null,
          providerKey: providerKey || null,
        }),
      });
      const payload = await readJsonSafe(res);
      if (!res.ok) return mapPoolError(res.status, payload);
      return {
        size: Number(payload.size ?? 0),
        etag: null,
        contentType: payload.mimeType || "",
        ref: {
          backend: "pool",
          key: String(payload.path || "").replace(/^\//, ""),
          fileId: payload.id,
          directUrl: payload.directUrl || "",
        },
        provider: payload.placement?.provider || null,
      };
    } catch (err) {
      console.error("[storage.pool.finalizeUpload]", err?.message || err);
      return { error: "pool_failed" };
    }
  },

  async remove(ref) {
    if (!ref || !this.isConfigured()) return false;
    const base = apiBase();
    const key = headers();
    if (ref.fileId) {
      try {
        const res = await fetch(`${base}/api/storage/f/${encodeURIComponent(ref.fileId)}`, {
          method: "DELETE",
          headers: key,
        });
        return res.ok;
      } catch (err) {
        console.error("[storage.pool.remove]", err?.message || err);
        return false;
      }
    }
    if (ref.key) {
      try {
        const stat = await fetch(`${base}/api/storage/stat?path=${encodeURIComponent(toPoolPath(ref.key))}`, {
          headers: { Authorization: `Bearer ${apiKey()}` },
        });
        if (!stat.ok) return false;
        const file = await stat.json();
        if (!file?.id) return false;
        const res = await fetch(`${base}/api/storage/f/${encodeURIComponent(file.id)}`, {
          method: "DELETE",
          headers: key,
        });
        return res.ok;
      } catch (err) {
        console.error("[storage.pool.remove]", err?.message || err);
        return false;
      }
    }
    return false;
  },

  async removeByPrefix(prefix) {
    if (!prefix || !this.isConfigured()) return null;
    let deleted = 0;
    let bytes = 0;
    for (;;) {
      let res;
      try {
        res = await fetch(`${apiBase()}/api/storage/tree`, {
          method: "DELETE",
          headers: headers(),
          body: JSON.stringify({ prefix: toPoolPath(prefix) }),
        });
      } catch (err) {
        console.error("[storage.pool.removeByPrefix]", err?.message || err);
        return null;
      }
      const payload = await readJsonSafe(res);
      if (!res.ok) {
        console.error("[storage.pool.removeByPrefix]", payload?.error || res.status);
        return null;
      }
      deleted += Number(payload.deleted ?? 0);
      bytes += Number(payload.bytes ?? 0);
      if (!payload.truncated) break;
    }
    return { deleted, bytes };
  },
};
