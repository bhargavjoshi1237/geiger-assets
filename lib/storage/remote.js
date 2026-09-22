if (typeof window !== "undefined") {
  throw new Error("lib/storage/remote is server-only — call /api/storage/remote from the browser.");
}

import dns from "node:dns/promises";
import net from "node:net";

import { PROXY_MAX_BYTES } from "@/lib/storage/service";

export const REMOTE_MAX_BYTES = PROXY_MAX_BYTES;

const FETCH_TIMEOUT_MS = 20000;
const MAX_REDIRECTS = 5;

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata.google.internal",
  "instance-data",
]);

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

function isPrivateIpv4(host) {
  const parts = host.split(".");
  if (parts.length !== 4) return false;
  const nums = parts.map((p) => Number(p));
  if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  const [a, b] = nums;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

function isPrivateIpv6(host) {
  const h = host.replace(/^\[|\]$/g, "").toLowerCase();
  if (h === "::" || h === "::1") return true;
  if (h.startsWith("fe80")) return true;
  if (/^f[cd]/.test(h)) return true;

  const mapped = h.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  return mapped ? isPrivateIpv4(mapped[1]) : false;
}

function isBlockedHost(hostname) {
  const host = String(hostname || "").toLowerCase();
  if (!host) return true;
  if (BLOCKED_HOSTNAMES.has(host)) return true;
  if (host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    return true;
  }

  if (/^(0x[0-9a-f]+|\d+)$/i.test(host)) return true;
  if (host.includes(":") || host.startsWith("[")) return isPrivateIpv6(host);
  if (net.isIP(host) === 4) return isPrivateIpv4(host);
  return false;
}

function isPrivateAddress(address) {
  const family = net.isIP(address);
  if (family === 4) return isPrivateIpv4(address);
  if (family === 6) return isPrivateIpv6(address);
  return true;
}

async function resolvesToPublicHost(hostname) {
  const host = String(hostname || "").replace(/^\[|\]$/g, "");
  if (!host) return false;
  if (net.isIP(host)) return !isPrivateAddress(host);
  try {
    const records = await dns.lookup(host, { all: true, verbatim: true });
    if (!records.length) return false;
    return records.every((r) => !isPrivateAddress(r.address));
  } catch {
    return false;
  }
}

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
