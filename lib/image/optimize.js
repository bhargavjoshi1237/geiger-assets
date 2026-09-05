if (typeof window !== "undefined") {
  throw new Error("lib/image/optimize is server-only — import lib/storage/optimize-client on the browser.");
}

// Server-side image optimizer for the proxy upload path.
//
// The presigned path never touches this (the browser already encoded to
// WebP client-side before PUT). The proxy path runs here so small uploads
// and non-JS clients still honor the Quality Preset — including true AVIF
// for `compressed`, which browsers can't reliably encode themselves.
//
// Contract: (Buffer, { quality, filename, contentType }) ->
// { bytes, contentType, filename } | null (null = passthrough).
// Never throws — returns null on any failure so the upload proceeds with
// the original bytes.

import { normalizeQuality, shouldOptimizeFile, optimizedFilename, optimizedContentType } from "@/lib/storage/presets";

const MAX_PROXY_OPTIMIZE_BYTES = 4 * 1024 * 1024;

async function loadSharp() {
  try {
    const mod = await import("sharp");
    return mod?.default || mod;
  } catch (e) {
    console.error("[image.optimize] sharp unavailable", e?.message || e);
    return null;
  }
}

export async function optimizeImageBuffer(buffer, { quality, filename, contentType } = {}) {
  const q = normalizeQuality(quality);
  try {
    if (q === "original") return null;
    if (!buffer || buffer.length === 0) return null;
    if (buffer.length > MAX_PROXY_OPTIMIZE_BYTES) return null;
    if (!shouldOptimizeFile({ contentType, filename }, q)) return null;

    const sharp = await loadSharp();
    if (!sharp) return null;

    if (q === "web") {
      const out = await sharp(buffer, { animated: false })
        .rotate()
        .resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 82, effort: 4 })
        .toBuffer();
      if (!out || out.length === 0 || out.length >= buffer.length) return null;
      return {
        bytes: out,
        contentType: "image/webp",
        filename: optimizedFilename(filename, "webp"),
      };
    }

    // compressed -> AVIF smallest, WebP fallback when libavif is missing.
    try {
      const out = await sharp(buffer, { animated: false })
        .rotate()
        .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
        .avif({ quality: 60, effort: 4 })
        .toBuffer();
      if (out && out.length > 0 && out.length < buffer.length) {
        return {
          bytes: out,
          contentType: optimizedContentType("avif"),
          filename: optimizedFilename(filename, "avif"),
        };
      }
    } catch (e) {
      console.error("[image.optimize] avif failed, falling back to webp", e?.message || e);
    }
    const fallback = await sharp(buffer, { animated: false })
      .rotate()
      .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 65, effort: 4 })
      .toBuffer();
    if (!fallback || fallback.length === 0 || fallback.length >= buffer.length) return null;
    return {
      bytes: fallback,
      contentType: "image/webp",
      filename: optimizedFilename(filename, "webp"),
    };
  } catch (e) {
    console.error("[image.optimize]", e?.message || e);
    return null;
  }
}
