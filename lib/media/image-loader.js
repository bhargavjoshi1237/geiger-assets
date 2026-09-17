// Custom next/image loader, wired in next.config.mjs.
//
// `loaderFile` applies to EVERY next/image in the app — logos, static imports,
// @geiger/ui artwork, remote URLs — so the contract here is pass-through by
// default: anything that is not one of our own /api/media/<id>/<variant> paths
// comes back byte-identical and renders exactly as it would have.
//
// For an asset-media path the requested width is snapped up to the smallest
// variant that covers it, so a 128 px grid cell asks for `thumb` instead of a
// 25 MB original. The delivery route negotiates the encoding from Accept and
// falls back to streaming the original when no derivative exists, so any
// variant URL is safe for any row.

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

// Widths mirror VARIANTS in lib/media/derive.js (server-only, cannot import
// here — this module is bundled for the browser). Ascending.
const VARIANTS = [
  { name: "thumb", width: 256 },
  { name: "preview", width: 1024 },
  { name: "poster", width: 1920 },
];

// Exactly two path segments after /api/media, with the query/hash captured so a
// `?format=` override survives the rewrite.
const MEDIA_PATH = /^\/api\/media\/([^/?#]+)\/[^/?#]+((?:\?|#).*)?$/;

function variantForWidth(width) {
  const w = Number(width);
  if (!Number.isFinite(w) || w <= 0) return "preview";
  for (const v of VARIANTS) {
    if (v.width >= w) return v.name;
  }
  return "poster";
}

export default function assetImageLoader({ src, width, quality }) {
  // Per-variant quality is fixed server-side in lib/media/derive.js; there is
  // no knob for it on the delivery route.
  void quality;
  if (typeof src !== "string" || src === "") return src;
  // Absolute URLs (http:, data:, blob:, protocol-relative) and bare relative
  // paths are never ours — hand them straight back.
  if (src.startsWith("//") || /^[a-z][a-z0-9+.-]*:/i.test(src)) return src;
  if (!src.startsWith("/")) return src;

  // A stored thumbnailUrl already carries the basePath; a literal in source may
  // not. Strip it before matching and re-add it once, so neither double-prefixes.
  const path = BASE && src.startsWith(`${BASE}/`) ? src.slice(BASE.length) : src;
  const match = MEDIA_PATH.exec(path);
  if (!match) return src;

  return `${BASE}/api/media/${match[1]}/${variantForWidth(width)}${match[2] || ""}`;
}
