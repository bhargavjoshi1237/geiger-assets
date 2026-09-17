// Lookups, filter options, and formatters for the delivery screens.
// Config only — never row data (rows come from lib/supabase/delivery.js,
// lib/media/usage.js, and the storage backend API).
//
// Numeric ladders for the transform playground are NOT duplicated here: widths,
// fits, and qualities come from lib/media/transform.js (the same allowlist the
// route enforces). The two small lists below (named variants, deliverable
// formats) mirror lib/media/derive.js + variants.js — thumb 256 / preview 1024
// / poster 1920, WebP default with AVIF on demand — which are server-only
// modules a screen cannot import.

// Delivery-domain verification state.
export const DOMAIN_STATUS_MAP = {
  verified: { label: "Verified", variant: "success", dotClass: "bg-emerald-400" },
  pending: { label: "Pending DNS", variant: "warning", dotClass: "bg-amber-400" },
};

export function domainStatusOf(domain) {
  return domain?.verified ? "verified" : "pending";
}

export const DOMAIN_FILTER_OPTIONS = [
  { value: "all", label: "All domains" },
  { value: "verified", label: "Verified" },
  { value: "pending", label: "Pending DNS" },
];

export const EDGE_FILTER_OPTIONS = [
  { value: "all", label: "All backends" },
  { value: "edge", label: "Edge-enabled" },
  { value: "direct", label: "Direct only" },
];

// Channel destination kinds and their lifecycle states.
export const DESTINATION_KIND_MAP = {
  cms: { label: "CMS", hint: "Pages and content entries that reference assets by URL." },
  pim: { label: "PIM", hint: "Product records and their image galleries." },
  ecommerce: { label: "Ecommerce", hint: "Storefront listings, variants, and merchandising slots." },
  social: { label: "Social", hint: "Scheduled posts and campaign creatives." },
  automation: { label: "Automation", hint: "Marketing automation journeys and triggered sends." },
};

export const DESTINATION_KIND_OPTIONS = Object.entries(DESTINATION_KIND_MAP).map(
  ([value, kind]) => ({ value, label: kind.label }),
);

export const DESTINATION_KIND_FILTER_OPTIONS = [
  { value: "all", label: "All channels" },
  ...DESTINATION_KIND_OPTIONS,
];

export const DESTINATION_STATUS_MAP = {
  connected: { label: "Connected", variant: "success", dotClass: "bg-emerald-400" },
  paused: { label: "Paused", variant: "neutral", dotClass: "bg-zinc-400" },
  error: { label: "Needs attention", variant: "danger", dotClass: "bg-red-400" },
};

export const DESTINATION_STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "connected", label: "Connected" },
  { value: "paused", label: "Paused" },
  { value: "error", label: "Needs attention" },
];

// Publish-job lifecycle. Exports move forward through these states; `failed`
// is terminal until the export is duplicated into a new draft.
export const EXPORT_STATUS_MAP = {
  draft: { label: "Draft", variant: "neutral", dotClass: "bg-zinc-400" },
  scheduled: { label: "Scheduled", variant: "info", dotClass: "bg-sky-400" },
  publishing: { label: "Publishing", variant: "warning", dotClass: "bg-amber-400" },
  published: { label: "Published", variant: "success", dotClass: "bg-emerald-400" },
  failed: { label: "Failed", variant: "danger", dotClass: "bg-red-400" },
};

export const EXPORT_STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "scheduled", label: "Scheduled" },
  { value: "publishing", label: "Publishing" },
  { value: "published", label: "Published" },
  { value: "failed", label: "Failed" },
];

export const EXPORT_NEXT_STATUS = {
  draft: "scheduled",
  scheduled: "publishing",
  publishing: "published",
};

// Share-link scopes and variants. Variant values match the names the share
// route accepts ("original" plus the named derivatives).
export const SHARE_SCOPE_MAP = {
  view: { label: "View", variant: "info", dotClass: "bg-sky-400" },
  download: { label: "Download", variant: "purple", dotClass: "bg-violet-400" },
};

export const SHARE_VARIANT_OPTIONS = [
  { value: "original", label: "Original" },
  { value: "thumb", label: "Thumb · 256px" },
  { value: "preview", label: "Preview · 1024px" },
  { value: "poster", label: "Poster · 1920px" },
];

export const SHARE_TTL_OPTIONS = [
  { value: "3600", label: "1 hour" },
  { value: "86400", label: "24 hours" },
  { value: "604800", label: "7 days" },
  { value: "2592000", label: "30 days" },
];

export const EMBED_KIND_OPTIONS = [
  { value: "iframe", label: "iframe" },
  { value: "img", label: "img tag" },
  { value: "json", label: "JSON" },
];

// Named delivery variants for pickers. Sizes mirror lib/media/derive.js
// (server-only), which the task brief records as thumb 256 / preview 1024 /
// poster 1920 — WebP by default, AVIF negotiated on demand.
export const NAMED_VARIANT_OPTIONS = [
  { value: "thumb", label: "Thumb · 256px WebP" },
  { value: "preview", label: "Preview · 1024px WebP" },
  { value: "poster", label: "Poster · 1920px WebP" },
];

// Friendly labels for the transform crop vocabulary in
// lib/media/transform.js (c_fit / c_fill / c_pad / c_scale / c_min).
export const TRANSFORM_FIT_LABELS = {
  fit: "Fit — inside the box, keep aspect",
  fill: "Fill — cover the box, crop overflow",
  pad: "Pad — inside the box, padded to size",
  scale: "Scale — stretch to exact size",
  min: "Min — cover without cropping",
};

// Transcoding renditions are configuration only: this deployment has no ffmpeg,
// so these rows are always presented as not yet available, never as live.
export const VIDEO_RENDITION_ROWS = [
  { label: "1080p · HLS", detail: "Adaptive ladder top rung" },
  { label: "720p · HLS", detail: "Mid rung for constrained networks" },
  { label: "480p · HLS", detail: "Low rung for mobile" },
];

export const POSTER_VARIANT_OPTIONS = [
  { value: "poster", label: "Poster · 1920px" },
  { value: "preview", label: "Preview · 1024px" },
  { value: "thumb", label: "Thumb · 256px" },
  { value: "original", label: "Original file" },
];

export const CAPTION_LANGUAGE_OPTIONS = [
  { value: "en", label: "English (en)" },
  { value: "de", label: "German (de)" },
  { value: "fr", label: "French (fr)" },
  { value: "es", label: "Spanish (es)" },
];

export const SERIES_RANGE_OPTIONS = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
];

const BYTE_UNITS = ["B", "KB", "MB", "GB", "TB", "PB"];

export function formatBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n <= 0) return "0 B";
  let value = n;
  let unit = 0;
  while (value >= 1024 && unit < BYTE_UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 10 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${BYTE_UNITS[unit]}`;
}

export function formatCount(n) {
  const value = Number(n) || 0;
  try {
    return new Intl.NumberFormat("en-US", { notation: "compact" }).format(value);
  } catch {
    return String(Math.round(value));
  }
}

export function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export function formatDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatWhen(iso) {
  if (!iso) return "never";
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "never";
  const seconds = Math.round((Date.now() - then) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(iso);
}
