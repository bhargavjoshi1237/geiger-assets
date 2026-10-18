if (typeof window !== "undefined") {
  throw new Error("lib/storage/download_response is server-only.");
}

// Turns an asset row into a "save this file" response. Shared by the gallery
// download route (open downloads) and the store download route (paid
// entitlements), which differ only in how they decide the visitor may have
// the file.
//
// `maxEdge` asks for a downscaled image rendition and `format` for a
// converted one; anything that isn't a raster image — or can't be
// transformed — falls back to the original.

import { NextResponse } from "next/server";
import { isStorageConfigured } from "@/lib/storage/service";
import { backendForRef, refFromAssetRow } from "@/lib/storage/backends/index.js";
import { mergeSteps, parseTransformPath, runTransform } from "@/lib/image/transform";

/** The columns a download needs from assets.assets. */
export const DOWNLOAD_COLUMNS =
  "id,name,type,original_filename,mime_type,thumbnail_url,storage_key,pool_file_id,pool_url";

const RESIZABLE = /^image\/(jpeg|png|webp|avif|tiff|gif|heic|heif)$/i;
const FORMAT_EXT = { jpg: "jpg", webp: "webp", png: "png" };

/** Keep a filename header-safe: ASCII fallback plus the RFC 5987 UTF-8 form. */
export function attachment(filename) {
  const name = String(filename || "download");
  const ascii = name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

async function streamToBuffer(body) {
  if (!body) return null;
  if (typeof body.arrayBuffer === "function") return Buffer.from(await body.arrayBuffer());
  if (typeof body.getReader === "function") {
    const reader = body.getReader();
    const chunks = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks);
  }
  if (typeof body[Symbol.asyncIterator] === "function") {
    const chunks = [];
    for await (const chunk of body) chunks.push(Buffer.from(chunk));
    return Buffer.concat(chunks);
  }
  return null;
}

function renamed(filename, ext) {
  const base = String(filename || "download").replace(/\.[a-z0-9]{1,5}$/i, "");
  return `${base}.${ext}`;
}

async function renditionResponse(ref, row, { maxEdge, format, filename }) {
  const got = await backendForRef(ref).getStream(ref);
  const buffer = await streamToBuffer(got?.stream);
  if (!buffer) return null;
  const target = FORMAT_EXT[format] || "jpg";
  const segment = maxEdge ? `w_${maxEdge},h_${maxEdge},c_fit,f_${target},q_90` : `f_${target},q_92`;
  const plan = mergeSteps(parseTransformPath([segment]));
  const out = await runTransform(buffer, plan, {});
  return new Response(out.bytes, {
    headers: {
      "Content-Type": out.contentType,
      "Content-Length": String(out.bytes.length),
      "Content-Disposition": attachment(renamed(filename, out.ext)),
      "Cache-Control": "private, no-store",
    },
  });
}

/**
 * The download response for `row`. Stored files redirect to a signed
 * attachment URL (or a resized copy when `maxEdge` is set); assets that only
 * exist as a remote URL are streamed through with an attachment header.
 */
export async function assetDownloadResponse(row, { maxEdge = null, format = "original" } = {}) {
  const filename = row.original_filename || row.name || "download";
  const ref = refFromAssetRow(row);

  if (ref && isStorageConfigured()) {
    const convert = FORMAT_EXT[format] && !(row.mime_type || "").includes(format === "jpg" ? "jpeg" : format);
    if ((maxEdge || convert) && RESIZABLE.test(row.mime_type || "")) {
      try {
        const resized = await renditionResponse(ref, row, { maxEdge, format, filename });
        if (resized) return resized;
      } catch (err) {
        console.error("[download.rendition]", err?.message);
      }
    }
    const url = await backendForRef(ref).signRead(ref, { download: true, filename });
    if (url) return NextResponse.redirect(url, { status: 307 });
  }

  if (!row.thumbnail_url) return NextResponse.json({ error: "not_found" }, { status: 404 });
  try {
    const upstream = await fetch(row.thumbnail_url);
    if (!upstream.ok || !upstream.body) throw new Error(`upstream ${upstream.status}`);
    return new Response(upstream.body, {
      headers: {
        "Content-Type":
          upstream.headers.get("content-type") || row.mime_type || "application/octet-stream",
        ...(upstream.headers.get("content-length")
          ? { "Content-Length": upstream.headers.get("content-length") }
          : {}),
        "Content-Disposition": attachment(filename),
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (err) {
    console.error("[download.stream]", err?.message);
    // Last resort: let the browser fetch the remote file itself.
    return NextResponse.redirect(row.thumbnail_url, { status: 307 });
  }
}
