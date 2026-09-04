"use client";

import { uniqueId } from "@/lib/utils";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";
const PROXY_LIMIT = 4 * 1024 * 1024;

export const UPLOAD_PHASE_LABELS = {
  hashing: "Preparing file…",
  presign: "Requesting upload…",
  uploading: "Uploading…",
  committing: "Saving to library…",
  done: "Done",
};

export const UPLOAD_ERROR_MESSAGES = {
  bad_input: "Couldn't read that file.",
  cancelled: "Upload cancelled.",
  too_large: "That file exceeds the size limit.",
  unsupported_type: "That file type isn't supported.",
  storage_unconfigured: "Storage isn't configured on the server.",
  unauthorized: "You're signed out — sign in and try again.",
  forbidden: "You don't have permission to upload here.",
  not_found: "Upload target not found.",
  not_committed: "Upload finished but couldn't be saved.",
  no_url: "Couldn't start the upload.",
  upload_failed: "Upload failed — check your connection and retry.",
  proxy_failed: "Upload failed on the server path.",
  commit_failed: "Upload finished but couldn't be saved.",
  server: "Something went wrong — try again.",
};

function api(path) {
  return `${BASE}${path}`;
}

function httpToCode(status) {
  if (status === 413) return "too_large";
  if (status === 415) return "unsupported_type";
  if (status === 503) return "storage_unconfigured";
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status === 409) return "not_committed";
  return "server";
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

export async function uploadAsset(file, { projectId, assetId, folder, tags, onProgress, onPhase, onError, signal } = {}) {
  const phase = (p) => {
    try {
      onPhase?.(p);
    } catch {
    }
  };
  const fail = (code, message) => {
    try {
      onError?.(code);
    } catch {
    }
    console.error("[storage.upload]", message);
    return null;
  };
  const report = (p) => {
    if (typeof onProgress === "function") onProgress(p);
  };

  async function proxyUpload({ uploadJobId, filename, contentType, checksum }) {
    phase("uploading");
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
      if (!proxyRes.ok) return fail(httpToCode(proxyRes.status), `proxy upload failed (${proxyRes.status})`);
      report(92);
      return commit({ uploadJobId, key: null, filename, checksum, fromProxy: proxyRes });
    } catch (e) {
      if (e?.name === "AbortError" || signal?.aborted) return fail("cancelled", "cancelled");
      return fail("proxy_failed", e?.message || "proxy upload failed");
    }
  }

  async function commit({ uploadJobId, key, filename, checksum, fromProxy }) {
    phase("committing");
    if (fromProxy) {
      if (typeof onProgress === "function") onProgress(100);
      phase("done");
      const data = await fromProxy.json().catch(() => null);
      return data?.asset ?? null;
    }
    const commitRes = await fetch(api("/api/storage/commit"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uploadJobId, key, assetId, checksum, name: filename, folder, tags }),
      signal,
    });
    if (!commitRes.ok) return fail(httpToCode(commitRes.status), `commit failed (${commitRes.status})`);
    report(100);
    phase("done");
    const data = await commitRes.json().catch(() => null);
    return data?.asset ?? null;
  }

  try {
    if (!(file instanceof Blob) || !projectId) return fail("bad_input", "bad input");
    if (signal?.aborted) return fail("cancelled", "cancelled");

    const uploadJobId = uniqueId();
    const filename = file.name || "file";
    const contentType = file.type || "application/octet-stream";
    const sizeBytes = file.size;

    phase("hashing");
    report(2);
    const checksum = await sha256Hex(file);

    phase("presign");
    const urlRes = await fetch(api("/api/storage/upload-url"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, assetId, filename, contentType, sizeBytes, uploadJobId }),
      signal,
    });
    if (!urlRes.ok) return fail(httpToCode(urlRes.status), `upload-url failed (${urlRes.status})`);
    const { url, key, mode } = await urlRes.json();
    if (!key) return fail("no_url", "no key");

    if (mode === "proxy" || !url) {
      if (file.size > PROXY_LIMIT) return fail("too_large", "file exceeds the proxy size ceiling");
      return proxyUpload({ uploadJobId, filename, contentType, checksum });
    }

    report(8);
    phase("uploading");
    const direct = await putViaXhr(url, file, contentType, (p) => {
      report(8 + Math.round(p * 0.8));
    }, signal);

    if (!direct && file.size <= PROXY_LIMIT && !signal?.aborted) {
      return proxyUpload({ uploadJobId, filename, contentType, checksum });
    }
    if (!direct) {
      if (signal?.aborted) return fail("cancelled", "cancelled");
      return fail("upload_failed", "direct upload failed");
    }

    report(92);
    return commit({ uploadJobId, key, filename, checksum });
  } catch (e) {
    if (e?.name === "AbortError" || signal?.aborted) return fail("cancelled", "cancelled");
    console.error("[storage.upload]", e);
    try {
      onError?.("server");
    } catch {
    }
    return null;
  }
}
