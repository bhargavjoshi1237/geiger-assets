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

    fallbackFormat: "webp",
    fallbackQuality: 65,
  },
};

export function normalizeQuality(value) {
  return Object.hasOwn(QUALITY_PRESETS, value) ? value : "original";
}

const SKIP_MIME = new Set(["image/svg+xml", "image/gif", "image/x-icon", "image/vnd.microsoft.icon"]);

export function shouldOptimizeFile({ contentType, filename } = {}, quality) {
  if (normalizeQuality(quality) === "original") return false;
  const ct = String(contentType || "").toLowerCase().split(";")[0].trim();
  if (SKIP_MIME.has(ct)) return false;
  if (ct.startsWith("image/")) return true;

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
