// Lookups, option lists and formatters for the Delivery area. Config only —
// no row data lives here; rows come from lib/supabase/{delivery,
// dynamic_links, video_delivery, embeds, channels}.js.

export const DELIVERY_STATUS_MAP = {
  active: { label: "Active", variant: "success", dotClass: "bg-emerald-400" },
  disabled: { label: "Disabled", variant: "neutral", dotClass: "bg-zinc-400" },
};

export const ORIGIN_PROTECTION_MAP = {
  open: { label: "Open", variant: "neutral" },
  signed: { label: "Signed URLs", variant: "info" },
  token: { label: "Token auth", variant: "warning" },
};

export const ORIGIN_PROTECTION_OPTIONS = [
  { value: "open", label: "Open — anyone with the URL" },
  { value: "signed", label: "Signed — expiring signatures" },
  { value: "token", label: "Token — per-request tokens" },
];

export const DOMAIN_STATUS_MAP = {
  pending: { label: "Pending", variant: "neutral", dotClass: "bg-zinc-400" },
  verifying: { label: "Verifying", variant: "info", dotClass: "bg-blue-400" },
  active: { label: "Active", variant: "success", dotClass: "bg-emerald-400" },
  failed: { label: "Failed", variant: "destructive", dotClass: "bg-red-400" },
};

export const SSL_STATUS_MAP = {
  none: { label: "No certificate", className: "bg-zinc-500/15 text-muted-foreground border-zinc-500/30" },
  pending: { label: "Issuing", className: "bg-blue-500/15 text-blue-300 border-blue-500/30" },
  issued: { label: "Secured", className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  error: { label: "Error", className: "bg-red-500/15 text-red-300 border-red-500/30" },
};

export const DOMAIN_KIND_OPTIONS = [
  { value: "subdomain", label: "Geiger subdomain" },
  { value: "custom", label: "Custom domain" },
];

export const DOMAIN_STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "pending", label: "Pending" },
  { value: "verifying", label: "Verifying" },
  { value: "active", label: "Active" },
  { value: "failed", label: "Failed" },
];

export const DYNAMIC_STATUS_MAP = {
  active: { label: "Active", variant: "success", dotClass: "bg-emerald-400" },
  paused: { label: "Paused", variant: "warning", dotClass: "bg-amber-400" },
  expired: { label: "Expired", variant: "neutral", dotClass: "bg-zinc-400" },
  revoked: { label: "Revoked", variant: "destructive", dotClass: "bg-red-400" },
};

export const DYNAMIC_STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "expired", label: "Expired" },
  { value: "revoked", label: "Revoked" },
];

export const FIT_OPTIONS = [
  { value: "cover", label: "Cover" },
  { value: "contain", label: "Contain" },
  { value: "fill", label: "Fill" },
  { value: "inside", label: "Inside" },
  { value: "outside", label: "Outside" },
];

export const FORMAT_OPTIONS = [
  { value: "auto", label: "Auto (negotiate)" },
  { value: "avif", label: "AVIF" },
  { value: "webp", label: "WebP" },
  { value: "jpg", label: "JPEG" },
  { value: "png", label: "PNG" },
];

export const VIDEO_MODE_MAP = {
  progressive: { label: "Progressive", variant: "neutral" },
  hls: { label: "HLS", variant: "info" },
  dash: { label: "DASH", variant: "purple" },
};

export const VIDEO_STATUS_MAP = {
  draft: { label: "Draft", variant: "neutral", dotClass: "bg-zinc-400" },
  ready: { label: "Ready", variant: "success", dotClass: "bg-emerald-400" },
  processing: { label: "Processing", variant: "info", dotClass: "bg-blue-400" },
  failed: { label: "Failed", variant: "destructive", dotClass: "bg-red-400" },
};

export const VIDEO_STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "draft", label: "Draft" },
  { value: "ready", label: "Ready" },
  { value: "processing", label: "Processing" },
  { value: "failed", label: "Failed" },
];

/** Default ABR ladder offered when a video has no custom rungs yet. */
export const DEFAULT_LADDER = [
  { label: "1080p", width: 1920, height: 1080, bitrateKbps: 6000 },
  { label: "720p", width: 1280, height: 720, bitrateKbps: 3000 },
  { label: "480p", width: 854, height: 480, bitrateKbps: 1200 },
  { label: "360p", width: 640, height: 360, bitrateKbps: 700 },
];

export const EMBED_KIND_MAP = {
  iframe: { label: "iFrame", variant: "info" },
  img: { label: "Image", variant: "neutral" },
  video: { label: "Video", variant: "purple" },
  oembed: { label: "oEmbed", variant: "success" },
  url: { label: "URL", variant: "warning" },
};

export const EMBED_KIND_OPTIONS = [
  { value: "iframe", label: "iFrame" },
  { value: "img", label: "Image" },
  { value: "video", label: "Video" },
  { value: "oembed", label: "oEmbed" },
  { value: "url", label: "Stable URL" },
];

export const VERSION_MODE_MAP = {
  latest: { label: "Latest", variant: "success" },
  pinned: { label: "Pinned", variant: "warning" },
};

export const VERSION_MODE_OPTIONS = [
  { value: "latest", label: "Latest — follows new versions" },
  { value: "pinned", label: "Pinned — locked to this version" },
];

export const EMBED_STATUS_MAP = {
  active: { label: "Active", variant: "success", dotClass: "bg-emerald-400" },
  paused: { label: "Paused", variant: "warning", dotClass: "bg-amber-400" },
  revoked: { label: "Revoked", variant: "destructive", dotClass: "bg-red-400" },
};

export const CHANNEL_KIND_MAP = {
  cms: { label: "CMS", variant: "info" },
  pim: { label: "PIM", variant: "purple" },
  ecommerce: { label: "Ecommerce", variant: "success" },
  social: { label: "Social", variant: "warning" },
  marketing: { label: "Marketing", variant: "neutral" },
};

export const CHANNEL_KIND_OPTIONS = [
  { value: "cms", label: "CMS" },
  { value: "pim", label: "PIM" },
  { value: "ecommerce", label: "Ecommerce" },
  { value: "social", label: "Social" },
  { value: "marketing", label: "Marketing automation" },
];

export const CHANNEL_STATUS_MAP = {
  draft: { label: "Draft", variant: "neutral", dotClass: "bg-zinc-400" },
  active: { label: "Active", variant: "success", dotClass: "bg-emerald-400" },
  paused: { label: "Paused", variant: "warning", dotClass: "bg-amber-400" },
  disabled: { label: "Disabled", variant: "destructive", dotClass: "bg-red-400" },
};

export const CHANNEL_STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "disabled", label: "Disabled" },
];

export const RUN_STATUS_MAP = {
  running: { label: "Running", variant: "info", dotClass: "bg-blue-400" },
  succeeded: { label: "Succeeded", variant: "success", dotClass: "bg-emerald-400" },
  failed: { label: "Failed", variant: "destructive", dotClass: "bg-red-400" },
};

export const CACHE_STATUS_MAP = {
  hit: { label: "Hit", variant: "success", dotClass: "bg-emerald-400" },
  miss: { label: "Miss", variant: "warning", dotClass: "bg-amber-400" },
  revalidated: { label: "Revalidated", variant: "info", dotClass: "bg-blue-400" },
};

export const EVENT_KIND_MAP = {
  file: { label: "File", variant: "neutral" },
  dynamic: { label: "Dynamic", variant: "info" },
  video: { label: "Video", variant: "purple" },
  embed: { label: "Embed", variant: "success" },
};

export const DELIVERY_KEY_SCOPES = [
  { value: "assets:read", label: "Read assets" },
  { value: "delivery:read", label: "Read delivery" },
  { value: "embeds:read", label: "Resolve embeds" },
];

/** Public URL for a dynamic-image token. Relative so it works on any host. */
export function dynamicUrl(token, transform = {}) {
  const params = new URLSearchParams();
  for (const key of ["w", "h", "fit", "format", "quality", "dpr"]) {
    if (transform[key] !== "" && transform[key] != null) params.set(key, String(transform[key]));
  }
  const query = params.toString();
  return `/dyn/${token || ""}${query ? `?${query}` : ""}`;
}

/** Rendered snippet for a registered embed. */
export function embedSnippet(embed, { subjectUrl = "" } = {}) {
  const params = embed?.params || {};
  const width = params.width || 800;
  const height = params.height || 450;
  const url = subjectUrl || `/e/${embed?.id || ""}`;
  switch (embed?.kind) {
    case "img":
      return `<img src="${url}" width="${width}" alt="${embed?.name || ""}" loading="lazy" />`;
    case "video":
      return `<video src="${url}" width="${width}" height="${height}" controls preload="metadata"></video>`;
    case "oembed":
      return `<link rel="alternate" type="application/json+oembed" href="${url}" />`;
    case "url":
      return url;
    default:
      return `<iframe src="${url}" width="${width}" height="${height}" frameborder="0" allowfullscreen loading="lazy"></iframe>`;
  }
}

/** Player snippet for a configured video asset. */
export function videoEmbedSnippet(assetId, delivery) {
  const mode = delivery?.streamingMode || "progressive";
  const src = `/v/${assetId || ""}/${mode === "progressive" ? "master.mp4" : mode === "hls" ? "playlist.m3u8" : "manifest.mpd"}`;
  const player = delivery?.player || {};
  const attrs = [
    player.controls === false ? "" : "controls",
    player.autoplay ? "autoplay" : "",
    player.muted ? "muted" : "",
    player.loop ? "loop" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return `<video src="${src}" ${attrs} preload="${player.preload || "metadata"}"></video>`;
}

/** 0–1 hit ratio from delivery_daily rows (or event rows with cacheStatus). */
export function hitRatio(rows, { hitsKey = "hits", totalKey = null } = {}) {
  const hits = rows.reduce((s, r) => s + Number(r[hitsKey] ?? (r.cacheStatus === "hit" ? 1 : 0)), 0);
  const total = totalKey
    ? rows.reduce((s, r) => s + Number(r[totalKey] ?? 0), 0)
    : rows.reduce((s, r) => s + Number(r.requests ?? 1), 0);
  if (!total) return 0;
  return hits / total;
}

export function formatPercent(ratio) {
  return `${(Number(ratio || 0) * 100).toFixed(1)}%`;
}

export { formatBytes, formatDate, formatDateTime } from "@/lib/format";
