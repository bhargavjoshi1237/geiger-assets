if (typeof window !== "undefined") {
  throw new Error("lib/storage/remote is server-only — call /api/storage/remote from the browser.");
}

import { PROXY_MAX_BYTES } from "@/lib/storage/service";
import { isBlockedHost, resolvesToPublicHost } from "@/lib/storage/ssrf";

export const REMOTE_MAX_BYTES = PROXY_MAX_BYTES;

const FETCH_TIMEOUT_MS = 20000;
const MAX_REDIRECTS = 5;

const EXTENSION_FOR_TYPE = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/svg+xml": "svg",
  "image/tiff": "tif",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/ogg": "ogg",
  "application/pdf": "pdf",
  "text/plain": "txt",
  "text/csv": "csv",
  "text/markdown": "md",
  "application/zip": "zip",
};

export function parseRemoteUrl(raw) {
  let url;
  try {
    url = new URL(String(raw || "").trim());
  } catch {
    return { error: "invalid_url" };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return { error: "invalid_url" };
  if (url.username || url.password) return { error: "blocked_url" };
  if (isBlockedHost(url.hostname)) return { error: "blocked_url" };
  return { url };
}

function filenameFromDisposition(header) {
  if (!header) return "";
  const star = header.match(/filename\*=(?:UTF-8'')?([^;]+)/i);
  if (star) {
    try {
      return decodeURIComponent(star[1].replace(/^"|"$/g, "").trim());
    } catch {
    }
  }
  const plain = header.match(/filename="?([^";]+)"?/i);
  return plain ? plain[1].trim() : "";
}

export function remoteFilename({ url, disposition, contentType }) {
  let name = filenameFromDisposition(disposition);
  if (!name) {
    try {
      name = decodeURIComponent(url.pathname.split("/").filter(Boolean).pop() || "");
    } catch {
      name = url.pathname.split("/").filter(Boolean).pop() || "";
    }
  }

  name = name.replace(/[\\/]/g, "").replace(/[\u0000-\u001f\u007f]/g, "").trim();
  if (!name) name = "remote-file";
  if (!/\.[a-z0-9]{1,8}$/i.test(name)) {
    const ct = String(contentType || "").toLowerCase().split(";")[0].trim();
    const ext = EXTENSION_FOR_TYPE[ct];
    if (ext) name = `${name}.${ext}`;
  }
  return name.slice(0, 180);
}

export async function fetchRemoteFile(raw, { maxBytes = REMOTE_MAX_BYTES } = {}) {
  const parsed = parseRemoteUrl(raw);
  if (parsed.error) return parsed;

  let target = parsed.url;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    let res = null;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
      if (!(await resolvesToPublicHost(target.hostname))) return { error: "blocked_url" };
      res = await fetch(target, {
        redirect: "manual",
        signal: controller.signal,
        headers: { accept: "*/*", "user-agent": "GeigerAssets/1.0 (+remote-import)" },
      });
      if (res.status < 300 || res.status >= 400) break;
      const location = res.headers.get("location");
      if (!location) return { error: "fetch_failed" };
      const next = parseRemoteUrl(new URL(location, target).toString());
      if (next.error) return next;
      target = next.url;
      res = null;
    }
    if (!res) return { error: "too_many_redirects" };
    if (!res.ok) return { error: res.status === 404 ? "not_found" : "fetch_failed" };

    const declared = Number(res.headers.get("content-length") || 0);
    if (declared && declared > maxBytes) return { error: "too_large" };

    const reader = res.body?.getReader();
    if (!reader) return { error: "fetch_failed" };
    const chunks = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        try {
          await reader.cancel();
        } catch {
        }
        return { error: "too_large" };
      }
      chunks.push(Buffer.from(value));
    }
    if (!size) return { error: "empty_file" };

    const contentType =
      res.headers.get("content-type")?.split(";")[0].trim() || "application/octet-stream";
    return {
      bytes: Buffer.concat(chunks),
      contentType,
      filename: remoteFilename({
        url: target,
        disposition: res.headers.get("content-disposition"),
        contentType,
      }),
      sourceUrl: target.toString(),
    };
  } catch (e) {
    if (e?.name === "AbortError") return { error: "timeout" };
    console.error("[storage.remote]", e?.message || e);
    return { error: "fetch_failed" };
  } finally {
    clearTimeout(timer);
  }
}
