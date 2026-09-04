"use client";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";
const PROXY_LIMIT = 4 * 1024 * 1024;

function api(path) {
  return `${BASE}${path}`;
}

async function sha256Hex(file) {
  try {
    const buf = await file.arrayBuffer();
    const digest = await crypto.subtle.digest("SHA-256", buf);
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch (e) {
    console.error("[storage.sha256]", e);
    return null;
  }
}

function putViaXhr(url, file, contentType, onProgress, signal) {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url, true);
    xhr.setRequestHeader("Content-Type", contentType || "application/octet-stream");

    if (signal) {
      if (signal.aborted) return resolve(false);
      signal.addEventListener("abort", () => xhr.abort(), { once: true });
    }
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && typeof onProgress === "function") {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300);
    xhr.onerror = () => resolve(false);
    xhr.onabort = () => resolve(false);
    xhr.send(file);
  });
}

export function assetFileUrl(assetId, { download } = {}) {
  if (!assetId) return "";
  return api(`/api/assets/${assetId}/file${download ? "?download=1" : ""}`);
}

export async function signAssetUrls(keys) {
  try {
    if (!Array.isArray(keys) || keys.length === 0) return {};
    const res = await fetch(api("/api/storage/sign"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keys }),
    });
    if (!res.ok) {
      console.error("[storage.sign]", res.status);
      return null;
    }
    const data = await res.json();
    return data.urls || {};
  } catch (e) {
    console.error("[storage.sign]", e);
    return null;
  }
}

export async function deleteAssetFile(assetId) {
  try {
    if (!assetId) return false;
    const res = await fetch(api("/api/storage/object"), {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assetId }),
    });
    if (!res.ok) {
      console.error("[storage.delete]", res.status);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[storage.delete]", e);
    return false;
  }
}

export async function uploadAsset(file, { projectId, assetId, folder, tags, onProgress, signal } = {}) {
  const fail = (message) => {
    console.error("[storage.upload]", message);
    return null;
  };
  try {
    if (!(file instanceof Blob) || !projectId) return fail("bad input");
    if (signal?.aborted) return fail("cancelled");

    const uploadJobId = crypto.randomUUID();
    const filename = file.name || "file";
    const contentType = file.type || "application/octet-stream";
    const sizeBytes = file.size;

    if (typeof onProgress === "function") onProgress(2);
    const checksum = await sha256Hex(file);

    const urlRes = await fetch(api("/api/storage/upload-url"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, assetId, filename, contentType, sizeBytes, uploadJobId }),
      signal,
    });
    if (!urlRes.ok) {
      if (urlRes.status === 413) return fail("file exceeds the size ceiling");
      if (urlRes.status === 415) return fail("file type is not supported");
      return fail(`upload-url failed (${urlRes.status})`);
    }
    const { url, key } = await urlRes.json();
    if (!url || !key) return fail("no signed url");

    if (typeof onProgress === "function") onProgress(8);
    let direct = await putViaXhr(url, file, contentType, (p) => {
      if (typeof onProgress === "function") onProgress(8 + Math.round(p * 0.8));
    }, signal);

    if (!direct && file.size <= PROXY_LIMIT && !signal?.aborted) {
      const form = new FormData();
      form.append("file", file, filename);
      form.append("projectId", projectId);
      form.append("uploadJobId", uploadJobId);
      if (assetId) form.append("assetId", assetId);
      if (folder) form.append("folder", folder);
      if (checksum) form.append("checksum", checksum);
      if (tags) form.append("tags", JSON.stringify(tags));
      try {
        const proxyRes = await fetch(api("/api/storage/upload"), { method: "POST", body: form, signal });
        if (!proxyRes.ok) return fail(`proxy upload failed (${proxyRes.status})`);
        if (typeof onProgress === "function") onProgress(100);
        return await proxyRes.json().then((d) => d.asset ?? null);
      } catch (e) {
        if (e?.name === "AbortError") return fail("cancelled");
        return fail(e?.message || "proxy upload failed");
      }
    }
    if (!direct) {
      if (signal?.aborted) return fail("cancelled");
      return fail("direct upload failed");
    }

    if (typeof onProgress === "function") onProgress(92);
    const commitRes = await fetch(api("/api/storage/commit"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        uploadJobId, key, assetId, checksum,
        name: filename, folder, tags,
      }),
      signal,
    });
    if (!commitRes.ok) return fail(`commit failed (${commitRes.status})`);
    if (typeof onProgress === "function") onProgress(100);
    const data = await commitRes.json();
    return data.asset ?? null;
  } catch (e) {
    if (e?.name === "AbortError") {
      console.error("[storage.upload]", "cancelled");
      return null;
    }
    console.error("[storage.upload]", e);
    return null;
  }
}
