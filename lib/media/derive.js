if (typeof window !== "undefined") {
  throw new Error("lib/media/derive is server-only — derivatives decode raw upload bytes in Node.");
}

// Derivative pipeline for image grids: small raster stand-ins so listings
// never serve full-size originals through a Node route.
//
// Contract: deriveVariant never throws (null on any failure) so a derive bug
// can never break listing; deriveAll never throws ({} on total failure,
// partial results otherwise — a failed variant is omitted). Only raster
// stills and SVG go through sharp; video/audio/pdf/3d return null. Detection
// is magic bytes only — caller contentType/filename are accepted for API
// symmetry with probe/optimize but never trusted.
//
// Memory bound: inputs above MAX_DERIVE_INPUT_BYTES are refused before sharp
// ever sees them, so one huge upload cannot OOM the route. Variants run
// sequentially in deriveAll for the same reason (no parallel sharp decodes).

async function loadSharp() {
  try {
    const mod = await import("sharp");
    return mod?.default || mod;
  } catch (e) {
    console.error("[media.derive] sharp unavailable", e?.message || e);
    return null;
  }
}

// Only the head is ever sniffed: every covered signature lives in the first
// bytes, so large uploads are classified without scanning the full buffer.
const HEAD_BYTES = 64 * 1024;

// Refuse anything above this before decoding — bounds sharp's working set
// (a 25 MB JPEG already expands to hundreds of MB of RGBA). Larger originals
// keep serving as-is until a streaming derive path exists.
const MAX_DERIVE_INPUT_BYTES = 25 * 1024 * 1024;

// Output format, picked deliberately per variant below:
// WebP for all three — universal browser decode (unlike AVIF), always present
// via sharp's libwebp (AVIF needs libavif, often missing and slower to
// encode, unsuitable for upload-time fan-out), ~25-35% smaller than JPEG at
// matched quality, and alpha-preserving (JPEG would flatten transparent PNGs
// onto black/white). One format also keeps derivativeKey ext handling and CDN
// Accept negotiation trivial (always image/webp).
export const VARIANTS = Object.freeze({
  // Grid cells: 256 px covers 2x retina for a 128 px cell; q70 hides
  // artefacts at that size while staying kilobytes.
  thumb: Object.freeze({
    width: 256,
    height: 256,
    fit: "inside",
    format: "webp",
    quality: 70,
    contentType: "image/webp",
    ext: "webp",
  }),
  // Detail pane / list preview: 1024 px fits most viewports without shipping
  // the original; q78 holds up at full-bleed card sizes.
  preview: Object.freeze({
    width: 1024,
    height: 1024,
    fit: "inside",
    format: "webp",
    quality: 78,
    contentType: "image/webp",
    ext: "webp",
  }),
  // Lightbox / OG poster: 1920 px caps full-HD; q80 is the point of
  // diminishing returns for photographic stills at this size.
  poster: Object.freeze({
    width: 1920,
    height: 1920,
    fit: "inside",
    format: "webp",
    quality: 80,
    contentType: "image/webp",
    ext: "webp",
  }),
});

export function variantSpec(name) {
  try {
    if (typeof name !== "string") return null;
    const key = name.trim().toLowerCase();
    if (!Object.hasOwn(VARIANTS, key)) return null;
    return VARIANTS[key];
  } catch {
    return null;
  }
}

function toInputBuffer(buffer) {
  try {
    if (Buffer.isBuffer(buffer)) return buffer;
    if (buffer instanceof Uint8Array) {
      return Buffer.from(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    }
    return null;
  } catch {
    return null;
  }
}

// Minimal magic-byte classifier. Returns "raster" (sharp stills, animated
// included — caller flattens via animated:false), "svg" (vector, rasterised
// below), "skip" (known non-image: video/audio/pdf/3d/archive/executable),
// or null (unknown — treated as skip, never guessed).
function classifyHead(head) {
  try {
    if (!head || head.length < 2) return null;
    if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return "raster";
    if (
      head.length >= 8 &&
      head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47 &&
      head[4] === 0x0d && head[5] === 0x0a && head[6] === 0x1a && head[7] === 0x0a
    ) {
      return "raster";
    }
    if (head.length >= 6) {
      const gif = head.toString("latin1", 0, 6);
      if (gif === "GIF87a" || gif === "GIF89a") return "raster";
    }
    if (head[0] === 0x42 && head[1] === 0x4d) return "raster";
    if (
      head.length >= 4 && head[0] === 0x00 && head[1] === 0x00 &&
      (head[2] === 0x01 || head[2] === 0x02) && head[3] === 0x00
    ) {
      return "raster";
    }
    // TIFF incl. RAW containers — plain TIFF decodes, RAW fails in sharp and
    // degrades to null below (never guessed, never thrown).
    const tiffLe = head.length >= 4 && head[0] === 0x49 && head[1] === 0x49 && head[2] === 0x2a && head[3] === 0x00;
    const tiffBe = head.length >= 4 && head[0] === 0x4d && head[1] === 0x4d && head[2] === 0x00 && head[3] === 0x2a;
    if (tiffLe || tiffBe) return "raster";
    // RIFF: WEBP stills/animations are raster; AVI/WAVE are containers.
    if (head.length >= 12 && head[0] === 0x52 && head[1] === 0x49 && head[2] === 0x46 && head[3] === 0x46) {
      const fourcc = head.toString("latin1", 8, 12);
      if (fourcc === "WEBP") return "raster";
      return "skip";
    }
    // ISO-BMFF: image brands are raster attempts; everything else (mp4/mov/
    // m4a/3gp/crx) is video/audio/RAW — skip.
    if (head.length >= 12 && head[4] === 0x66 && head[5] === 0x74 && head[6] === 0x79 && head[7] === 0x70) {
      const major = head.toString("latin1", 8, 12).trim().toLowerCase();
      const compat = head.toString("latin1", 16, Math.min(head.length, 256)).toLowerCase();
      if (major === "avif" || major === "avis") return "raster";
      if (
        major === "heic" || major === "heix" || major === "hevc" ||
        major === "hevx" || major === "heim" || major === "heis" ||
        major === "hevm" || major === "hevs"
      ) {
        return "raster";
      }
      if (major === "mif1" || major === "msf1" || major === "heif") {
        if (compat.includes("avif") || compat.includes("avis")) return "raster";
        return "raster";
      }
      return "skip";
    }
    if (head.length >= 4 && head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3) return "skip";
    if (head.length >= 5 && head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46) return "skip";
    if (
      head.length >= 4 && head[0] === 0x50 && head[1] === 0x4b &&
      ((head[2] === 0x03 && head[3] === 0x04) ||
        (head[2] === 0x05 && head[3] === 0x06) ||
        (head[2] === 0x07 && head[3] === 0x08))
    ) {
      return "skip";
    }
    if (
      (head.length >= 7 && head[0] === 0x52 && head[1] === 0x61 && head[2] === 0x72 &&
        head[3] === 0x21 && head[4] === 0x1a && head[5] === 0x07) ||
      (head.length >= 6 && head[0] === 0x37 && head[1] === 0x7a && head[2] === 0xbc &&
        head[3] === 0xaf && head[4] === 0x27 && head[5] === 0x1c) ||
      (head[0] === 0x1f && head[1] === 0x8b)
    ) {
      return "skip";
    }
    if (head.length >= 262 && head.toString("latin1", 257, 262) === "ustar") return "skip";
    if (head.length >= 3 && head[0] === 0x49 && head[1] === 0x44 && head[2] === 0x33) return "skip";
    if (head.length >= 2 && head[0] === 0xff && (head[1] & 0xe0) === 0xe0) {
      // Bare MPEG frame sync (JPEG already returned above) — audio, skip.
      const v = (head[1] >> 3) & 0x03;
      const layer = (head[1] >> 1) & 0x03;
      if (v !== 0 && layer !== 0) return "skip";
    }
    if (head.length >= 4 && head[0] === 0x66 && head[1] === 0x6c && head[2] === 0x61 && head[3] === 0x43) return "skip";
    if (head.length >= 4 && head[0] === 0x4f && head[1] === 0x67 && head[2] === 0x67 && head[3] === 0x53) return "skip";
    if (head.length >= 4 && head[0] === 0x67 && head[1] === 0x6c && head[2] === 0x54 && head[3] === 0x46) return "skip";
    if (head[0] === 0x4d && head[1] === 0x5a) return "skip";
    // SVG is text — sniff the decoded head, skipping BOMs and leading
    // comments the way probe does.
    try {
      let s = head.toString("utf8").replace(/^\uFEFF/, "");
      for (let guard = 0; guard < 6; guard++) {
        const t = s.trimStart();
        if (!t.startsWith("<!--")) {
          s = t;
          break;
        }
        const end = t.indexOf("-->");
        if (end === -1) break;
        s = t.slice(end + 3);
      }
      const start = s.slice(0, 4096).toLowerCase();
      if (start.startsWith("<svg")) return "svg";
      if (start.startsWith("<?xml") && start.includes("<svg")) return "svg";
      if (start.startsWith("<!doctype svg")) return "svg";
    } catch {
      // Text decode failure is not an image — fall through to null.
    }
    return null;
  } catch {
    return null;
  }
}

export async function deriveVariant(buffer, variant, { contentType, filename } = {}) {
  // Hints are intentionally unread: trusting them would misclassify spoofed
  // uploads — detection is magic bytes only (mirrors probeFile).
  void contentType;
  void filename;
  try {
    const spec = variantSpec(variant);
    if (!spec) return null;
    const input = toInputBuffer(buffer);
    if (!input || input.length === 0) return null;
    if (input.length > MAX_DERIVE_INPUT_BYTES) return null;

    const head = input.subarray(0, HEAD_BYTES);
    const cls = classifyHead(head);
    if (cls !== "raster" && cls !== "svg") {
      // TODO(video): hook a poster-frame extractor here for video/pdf/3d
      // originals (no ffmpeg today — never shell out, return null instead).
      return null;
    }

    const sharp = await loadSharp();
    if (!sharp) return null;

    // animated:false flattens GIF/WebP animations to a still first frame so
    // grids never re-encode (and never serve) multi-megabyte animations.
    // rotate() honours EXIF orientation; withoutEnlargement never upscales
    // small originals (a 100 px icon stays 100 px, just re-encoded).
    // SVG takes the same path: sharp rasterises the vector to the variant's
    // box and the bytes returned are always WebP — never the SVG original.
    const { data, info } = await sharp(input, { animated: false })
      .rotate()
      .resize({ width: spec.width, height: spec.height, fit: "inside", withoutEnlargement: true })
      .webp({ quality: spec.quality, effort: 4 })
      .toBuffer({ resolveWithObject: true });
    if (!data || data.length === 0) return null;
    const width = Number.isInteger(info?.width) && info.width > 0 ? info.width : null;
    const height = Number.isInteger(info?.height) && info.height > 0 ? info.height : null;
    if (width === null || height === null) return null;
    return {
      bytes: data,
      contentType: "image/webp",
      ext: "webp",
      width,
      height,
    };
  } catch (e) {
    console.error("[media.derive]", e?.message || e);
    return null;
  }
}

export async function deriveAll(buffer, { contentType, filename, variants } = {}) {
  try {
    let names;
    try {
      if (Array.isArray(variants) && variants.length > 0) {
        const seen = new Set();
        names = [];
        for (const v of variants) {
          if (typeof v !== "string") continue;
          const key = v.trim().toLowerCase();
          if (!Object.hasOwn(VARIANTS, key) || seen.has(key)) continue;
          seen.add(key);
          names.push(key);
          if (names.length >= 10) break;
        }
        if (names.length === 0) return {};
      } else {
        names = Object.keys(VARIANTS);
      }
    } catch {
      names = Object.keys(VARIANTS);
    }
    const out = {};
    // Sequential, not Promise.all: each sharp decode holds the full bitmap,
    // so fan-out would multiply peak memory per upload.
    for (const name of names) {
      try {
        const d = await deriveVariant(buffer, name, { contentType, filename });
        if (d) out[name] = d;
      } catch {
        // A failed variant is omitted — partial results are fine.
      }
    }
    return out;
  } catch {
    return {};
  }
}
