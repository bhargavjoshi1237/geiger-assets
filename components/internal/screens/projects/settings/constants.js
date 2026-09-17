// Lookups, option lists, and formatters for the project settings screens.
// Config only — never row data. Rows come from lib/supabase/settings.js, usage
// rolls up from lib/media/usage.js, roles from lib/supabase/rbac.js and the
// permission catalog in lib/rbac.js.

export const LOCALE_OPTIONS = [
  { value: "en", label: "English (en)" },
  { value: "de", label: "Deutsch (de)" },
  { value: "fr", label: "Français (fr)" },
  { value: "es", label: "Español (es)" },
  { value: "it", label: "Italiano (it)" },
  { value: "pt", label: "Português (pt)" },
  { value: "nl", label: "Nederlands (nl)" },
  { value: "ja", label: "日本語 (ja)" },
];

export const TIMEZONE_OPTIONS = [
  { value: "UTC", label: "UTC" },
  { value: "Europe/Berlin", label: "Europe/Berlin" },
  { value: "Europe/London", label: "Europe/London" },
  { value: "Europe/Paris", label: "Europe/Paris" },
  { value: "America/New_York", label: "America/New_York" },
  { value: "America/Chicago", label: "America/Chicago" },
  { value: "America/Los_Angeles", label: "America/Los_Angeles" },
  { value: "Asia/Dubai", label: "Asia/Dubai" },
  { value: "Asia/Singapore", label: "Asia/Singapore" },
  { value: "Asia/Tokyo", label: "Asia/Tokyo" },
  { value: "Australia/Sydney", label: "Australia/Sydney" },
];

export const VISIBILITY_MAP = {
  private: { label: "Private", variant: "neutral", dotClass: "bg-zinc-400" },
  shared: { label: "Shared", variant: "info", dotClass: "bg-sky-400" },
  public: { label: "Public", variant: "success", dotClass: "bg-emerald-400" },
};

export const VISIBILITY_OPTIONS = [
  { value: "private", label: "Private — members only" },
  { value: "shared", label: "Shared — anyone with the link" },
  { value: "public", label: "Public — discoverable" },
];

// Connected-service catalog. State persists as settings.services[id] plus the
// API base URLs on the settings row; the Test action pings the URL.
export const CONNECTED_SERVICES = [
  {
    id: "cdn",
    label: "CDN / edge delivery",
    description: "Serves approved renditions from the edge instead of origin.",
    defaultUrl: "https://cdn.example.com",
  },
  {
    id: "email",
    label: "Transactional email",
    description: "Delivers share links, request updates, and member invites.",
    defaultUrl: "https://api.example.com",
  },
  {
    id: "chat",
    label: "Chat notifications",
    description: "Posts upload, approval, and quota events to a channel.",
    defaultUrl: "https://hooks.example.com",
  },
  {
    id: "analytics",
    label: "Product analytics",
    description: "Receives anonymized delivery and engagement events.",
    defaultUrl: "https://analytics.example.com",
  },
];

// Mirrors EVENTS in lib/media/webhooks.js. That module is server-only (it
// signs and delivers to attacker-controlled URLs), so screens must not import
// it — this list is the client-safe copy.
export const WEBHOOK_EVENTS = [
  "asset.created",
  "asset.updated",
  "asset.deleted",
  "asset.version.created",
  "upload.completed",
  "upload.failed",
];

export const WEBHOOK_EVENT_OPTIONS = WEBHOOK_EVENTS.map((value) => ({ value, label: value }));

export const WEBHOOK_STATUS_MAP = {
  active: { label: "Active", variant: "success", dotClass: "bg-emerald-400" },
  paused: { label: "Paused", variant: "neutral", dotClass: "bg-zinc-400" },
};

// Installable capability catalog. State persists as settings.addons[id].
export const ADDON_CATALOG = [
  {
    id: "versioning",
    label: "Asset versioning",
    description: "Keep every revision of an asset and restore any of them.",
  },
  {
    id: "watermarking",
    label: "Watermarking",
    description: "Stamp previews and shared renditions automatically.",
  },
  {
    id: "aiTagging",
    label: "AI auto-tagging",
    description: "Suggest tags and descriptions when uploads finish.",
  },
  {
    id: "duplicateDetection",
    label: "Duplicate detection",
    description: "Flag near-duplicate uploads for review.",
  },
  {
    id: "publicGalleries",
    label: "Public galleries",
    description: "Publish curated collections to shareable gallery pages.",
  },
  {
    id: "externalUploads",
    label: "External upload portals",
    description: "Let contributors upload without a workspace seat.",
  },
];

export const FIELD_TYPE_MAP = {
  text: { label: "Short text", variant: "neutral", dotClass: "bg-zinc-400" },
  textarea: { label: "Long text", variant: "neutral", dotClass: "bg-zinc-400" },
  number: { label: "Number", variant: "info", dotClass: "bg-sky-400" },
  boolean: { label: "Yes / no", variant: "purple", dotClass: "bg-violet-400" },
  date: { label: "Date", variant: "warning", dotClass: "bg-amber-400" },
  select: { label: "Single select", variant: "success", dotClass: "bg-emerald-400" },
  multiselect: { label: "Multi select", variant: "success", dotClass: "bg-emerald-400" },
  url: { label: "URL", variant: "info", dotClass: "bg-sky-400" },
};

export const FIELD_TYPE_OPTIONS = Object.entries(FIELD_TYPE_MAP).map(([value, m]) => ({
  value,
  label: m.label,
}));

// Empty assetTypes means "all types". Values match the library TYPE_OPTIONS.
export const ASSET_TYPE_OPTIONS = [
  { value: "image", label: "Image" },
  { value: "video", label: "Video" },
  { value: "audio", label: "Audio" },
  { value: "document", label: "Document" },
  { value: "pdf", label: "PDF" },
  { value: "3d", label: "3D Model" },
  { value: "raw", label: "Raw" },
  { value: "archive", label: "Archive" },
];

export const FIELD_TYPES_WITH_OPTIONS = ["select", "multiselect"];

// The reconciler's destructive mode is env-gated (RECONCILE_APPLY on the cron
// route in app/api/cron/reconcile/route.js); this schedule only records intent.
export const RECONCILE_SCHEDULE_OPTIONS = [
  { value: "off", label: "Off — manual runs only" },
  { value: "nightly", label: "Nightly" },
  { value: "weekly", label: "Weekly" },
];

export const CONTRACT_TIER_OPTIONS = [
  { value: "starter", label: "Starter" },
  { value: "growth", label: "Growth" },
  { value: "scale", label: "Scale" },
  { value: "enterprise", label: "Enterprise" },
];

export const SSO_PROVIDER_OPTIONS = [
  { value: "saml", label: "SAML 2.0" },
  { value: "oidc", label: "OpenID Connect" },
];

export const SESSION_TIMEOUT_OPTIONS = [
  { value: "15", label: "15 minutes" },
  { value: "60", label: "1 hour" },
  { value: "240", label: "4 hours" },
  { value: "720", label: "12 hours" },
  { value: "1440", label: "24 hours" },
];

const BYTE_UNITS = ["B", "KB", "MB", "GB", "TB"];

export function formatBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n <= 0) return "—";
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
  return new Intl.NumberFormat("en-US").format(value);
}

export function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
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

export function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// One CIDR or IP per line. Stored as a plain string on the settings row.
export function parseIpAllowlist(text) {
  return String(text || "")
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function quotaPercent(used, cap) {
  const limit = Number(cap) || 0;
  if (limit <= 0) return 0;
  return Math.min(100, Math.round(((Number(used) || 0) / limit) * 100));
}
