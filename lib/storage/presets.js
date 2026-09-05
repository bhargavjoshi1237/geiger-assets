// Shared quality-preset definitions for the upload pipeline.
//
// Isomorphic — no browser or server APIs here. Both the client-side
// canvas optimizer and the server-side sharp optimizer read these so the
// Upload Center's Quality Preset selector means the same thing on either
// upload path (presigned PUT direct to S3, or server proxy).
//
// Mapping:
// - original:    passthrough, bytes untouched.
// - web:         balanced — WebP (~q82), max dimension 2048px.
// - compressed:  smallest  — AVIF (~q60, WebP fallback), max dimension 1600px.

export const QUALITY_PRESETS = {
  original: {
    value: "original",
    format: null,
    quality: null,
    maxDimension: null,
  },
  web: {
    value: "web",
    format: "webp",
    quality: 82,
    maxDimension: 2048,
  },
  compressed: {
    value: "compressed",
    format: "avif",
    quality: 60,
    maxDimension: 1600,
    // Used when the encoder has no AVIF support (browser canvas, or a
    // sharp build without libavif).
    fallbackFormat: "webp",
    fallbackQuality: 65,
  },
};

export function normalizeQuality(value) {
  return Object.hasOwn(QUALITY_PRESETS, value) ? value : "original";
}

// Raster stills worth re-encoding. Vector (svg), animated (gif) and icons
// are left untouched — re-encoding them destroys animation/scalability or
// inflates size for negligible gain.
const SKIP_MIME = new Set(["image/svg+xml", "image/gif", "image/x-icon", "image/vnd.microsoft.icon"]);

export function shouldOptimizeFile({ contentType, filename } = {}, quality) {
  if (normalizeQuality(quality) === "original") return false;
  const ct = String(contentType || "").toLowerCase().split(";")[0].trim();
  if (SKIP_MIME.has(ct)) return false;
  if (ct.startsWith("image/")) return true;
  // Browsers report "" / octet-stream for some RAW files — never re-encode
  // those from the extension alone; the server allowlist stays authoritative.
  return false;
}

export function optimizedFilename(filename, format) {
  const base = String(filename || "file");
  const ext = format === "avif" ? ".avif" : ".webp";
  const dot = base.lastIndexOf(".");
  const stem = dot > 0 ? base.slice(0, dot) : base;
  return `${stem || "file"}${ext}`;
}

export function optimizedContentType(format) {
  return format === "avif" ? "image/avif" : "image/webp";
}
