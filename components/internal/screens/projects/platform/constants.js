// Lookups, option lists and formatters for the Platform area. Config only —
// no row data lives here; webhooks, exports, keys, settings and usage come
// from lib/supabase/platform.js.

export { formatBytes, formatDate, formatDateTime } from "@/lib/format";

// Webhooks ------------------------------------------------------------------

export const WEBHOOK_EVENT_GROUPS = [
  {
    group: "Assets",
    items: [
      { key: "asset.created", label: "Asset created", description: "A new asset record lands in the library." },
      { key: "asset.updated", label: "Asset updated", description: "Metadata, status or folder changes on an asset." },
      { key: "asset.deleted", label: "Asset deleted", description: "An asset is soft-deleted or purged." },
    ],
  },
  {
    group: "Collections",
    items: [
      { key: "collection.created", label: "Collection created", description: "A new collection is curated." },
      { key: "collection.updated", label: "Collection updated", description: "Membership or metadata changes." },
    ],
  },
  {
    group: "Galleries",
    items: [
      { key: "gallery.published", label: "Gallery published", description: "A showcase gallery goes live." },
      { key: "gallery.order", label: "Gallery order", description: "A visitor completes checkout." },
    ],
  },
  {
    group: "Uploads",
    items: [
      { key: "upload.completed", label: "Upload completed", description: "A file finishes committing to storage." },
      { key: "upload.failed", label: "Upload failed", description: "An upload errors out." },
    ],
  },
];

export const WEBHOOK_EVENTS = WEBHOOK_EVENT_GROUPS.flatMap((g) =>
  g.items.map((e) => ({ ...e, group: g.group })),
);

export function webhookEventLabel(key) {
  return WEBHOOK_EVENTS.find((e) => e.key === key)?.label || key;
}

export function samplePayload(event, url) {
  return {
    event,
    targetUrl: url || "",
    triggeredAt: new Date().toISOString(),
    data: { id: "00000000-0000-4000-8000-000000000000", projectId: null },
  };
}

export const ENDPOINT_STATUS_MAP = {
  active: {
    variant: "success",
    label: "Active",
    className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    dotClass: "bg-emerald-400",
  },
  paused: {
    variant: "neutral",
    label: "Paused",
    className: "bg-zinc-500/15 text-muted-foreground border-zinc-500/30",
    dotClass: "bg-zinc-400",
  },
};

export const ENDPOINT_STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
];

export const DELIVERY_STATUS_MAP = {
  queued: {
    variant: "warning",
    label: "Queued",
    className: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    dotClass: "bg-amber-400",
  },
  delivered: {
    variant: "success",
    label: "Delivered",
    className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    dotClass: "bg-emerald-400",
  },
  failed: {
    variant: "destructive",
    label: "Failed",
    className: "bg-red-500/15 text-red-300 border-red-500/30",
    dotClass: "bg-red-400",
  },
};

export const DELIVERY_STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "queued", label: "Queued" },
  { value: "delivered", label: "Delivered" },
  { value: "failed", label: "Failed" },
];

// Integrations ---------------------------------------------------------------

export const INTEGRATION_CATEGORY_MAP = {
  creative: "Creative tools",
  storage: "Cloud storage",
  productivity: "Productivity",
  marketing: "Marketing",
  social: "Social",
};

export const INTEGRATION_GROUP_ORDER = ["creative", "storage", "productivity", "marketing", "social"];

export const INTEGRATION_CATEGORY_FILTER_OPTIONS = [
  { value: "all", label: "All Categories" },
  ...INTEGRATION_GROUP_ORDER.map((c) => ({ value: c, label: INTEGRATION_CATEGORY_MAP[c] })),
];

export const INTEGRATION_STATUS_MAP = {
  coming_soon: {
    variant: "neutral",
    label: "Coming soon",
    className: "bg-zinc-500/15 text-muted-foreground border-zinc-500/30",
    dotClass: "bg-zinc-400",
  },
  connected: {
    variant: "success",
    label: "Connected",
    className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    dotClass: "bg-emerald-400",
  },
};

export const INTEGRATION_CATALOG = [
  {
    key: "photoshop",
    name: "Photoshop",
    tagline: "Push renditions straight to the library from the editor.",
    category: "creative",
    status: "coming_soon",
    capabilities: ["Export artboards as assets", "Sync versions back", "Read library metadata"],
  },
  {
    key: "figma",
    name: "Figma",
    tagline: "Hand off frames and components without leaving the canvas.",
    category: "creative",
    status: "coming_soon",
    capabilities: ["Export frames as assets", "Link live embeds", "Sync cover thumbnails"],
  },
  {
    key: "drive",
    name: "Google Drive",
    tagline: "Mirror folders between Drive and the DAM.",
    category: "storage",
    status: "coming_soon",
    capabilities: ["Import from Drive", "Two-way folder sync", "Shared-drive support"],
  },
  {
    key: "dropbox",
    name: "Dropbox",
    tagline: "Ingest team folders on a schedule.",
    category: "storage",
    status: "coming_soon",
    capabilities: ["Scheduled imports", "Delta sync", "Team-folder scopes"],
  },
  {
    key: "slack",
    name: "Slack",
    tagline: "Route approvals and upload notices to channels.",
    category: "productivity",
    status: "coming_soon",
    capabilities: ["Approval notifications", "Upload digests", "Search from chat"],
  },
  {
    key: "hubspot",
    name: "HubSpot",
    tagline: "Serve approved creative inside campaigns.",
    category: "marketing",
    status: "coming_soon",
    capabilities: ["File-manager sync", "Campaign asset picker", "Usage attribution"],
  },
  {
    key: "instagram",
    name: "Instagram",
    tagline: "Publish gallery selects to social.",
    category: "social",
    status: "coming_soon",
    capabilities: ["Scheduled publishing", "Caption templates", "Performance pullback"],
  },
];

// Data export -----------------------------------------------------------------

export const EXPORT_SCOPE_OPTIONS = [
  { value: "project", label: "Project", hint: "Everything in this project." },
  { value: "collection", label: "Collection", hint: "Members of one collection." },
  { value: "folder", label: "Folder", hint: "Assets in one folder." },
  { value: "filter", label: "Search filter", hint: "Whatever the search matches." },
];

export const EXPORT_FORMAT_OPTIONS = [
  { value: "csv", label: "CSV", hint: "Spreadsheet-friendly rows." },
  { value: "json", label: "JSON", hint: "Full fidelity records." },
  { value: "zip", label: "ZIP", hint: "Originals + metadata." },
];

export const EXPORT_FORMAT_MAP = {
  csv: { variant: "info", label: "CSV" },
  json: { variant: "neutral", label: "JSON" },
  zip: { variant: "warning", label: "ZIP" },
};

export const EXPORT_STATUS_MAP = {
  completed: {
    variant: "success",
    label: "Completed",
    className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    dotClass: "bg-emerald-400",
  },
  failed: {
    variant: "destructive",
    label: "Failed",
    className: "bg-red-500/15 text-red-300 border-red-500/30",
    dotClass: "bg-red-400",
  },
};

export const EXPORT_FIELD_OPTIONS = [
  { value: "name", label: "Name" },
  { value: "type", label: "Type" },
  { value: "format", label: "Format" },
  { value: "folder", label: "Folder" },
  { value: "status", label: "Status" },
  { value: "tags", label: "Tags" },
  { value: "description", label: "Description" },
  { value: "sizeBytes", label: "Size" },
  { value: "dimensions", label: "Dimensions" },
  { value: "createdAt", label: "Created" },
  { value: "updatedAt", label: "Modified" },
];

export const DEFAULT_EXPORT_FIELDS = EXPORT_FIELD_OPTIONS.map((f) => f.value);

export const EXPORT_ZIP_MAX_FILES = 1000;
export const EXPORT_ZIP_MAX_BYTES = 500 * 1024 * 1024;

// Public API -------------------------------------------------------------------
// Key, delivery-policy and usage lookups for the API screen. Row data lives in
// lib/supabase/platform.js.

export const API_SCOPES = [
  { value: "assets:read", label: "Assets · read", hint: "List, search and fetch assets." },
  { value: "assets:write", label: "Assets · write", hint: "Create, update and delete assets." },
  { value: "collections:read", label: "Collections · read", hint: "List and fetch collections." },
  { value: "collections:write", label: "Collections · write", hint: "Create, update and delete collections." },
  { value: "folders:read", label: "Folders · read", hint: "List and fetch folders." },
  { value: "folders:write", label: "Folders · write", hint: "Create, update and delete folders." },
  { value: "tags:read", label: "Tags · read", hint: "List the project's tag vocabulary." },
  { value: "upload:write", label: "Upload · write", hint: "Presign uploads and commit files." },
  { value: "delivery:read", label: "Delivery · read", hint: "Read delivery status and mint URLs." },
  { value: "delivery:write", label: "Delivery · write", hint: "Enable or disable delivery per asset." },
];

export const ALL_SCOPES = API_SCOPES.map((s) => s.value);

export const KEY_STATUS_META = {
  active: {
    variant: "success",
    label: "Active",
    className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    dotClass: "bg-emerald-400",
  },
  expired: {
    variant: "warning",
    label: "Expired",
    className: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    dotClass: "bg-amber-400",
  },
  revoked: {
    variant: "destructive",
    label: "Revoked",
    className: "bg-red-500/15 text-red-300 border-red-500/30",
    dotClass: "bg-red-400",
  },
};

export function keyStatus(key) {
  if (!key) return "revoked";
  if (key.revokedAt) return "revoked";
  if (key.expiresAt && new Date(key.expiresAt).getTime() <= Date.now()) return "expired";
  return "active";
}

export const FORMAT_OPTIONS = [
  { value: "auto", label: "Auto (negotiate)" },
  { value: "webp", label: "WebP" },
  { value: "avif", label: "AVIF" },
  { value: "jpg", label: "JPEG" },
  { value: "png", label: "PNG" },
];

export const EFFECT_OPTIONS = [
  { value: "blur", label: "Blur" },
  { value: "sharpen", label: "Sharpen" },
  { value: "grayscale", label: "Grayscale" },
  { value: "sepia", label: "Sepia" },
  { value: "negate", label: "Negate" },
  { value: "brightness", label: "Brightness" },
  { value: "contrast", label: "Contrast" },
  { value: "saturation", label: "Saturation" },
  { value: "tint", label: "Tint" },
];

export const API_TAB_OPTIONS = [
  { value: "keys", label: "Keys" },
  { value: "delivery", label: "Delivery settings" },
  { value: "usage", label: "Usage" },
  { value: "reference", label: "Reference" },
];

export const REFERENCE_ENDPOINTS = [
  {
    method: "GET",
    path: "/api/v1/assets?limit=25",
    title: "List assets",
    description: "Search and page through the library with a cursor.",
    curl: 'curl -H "Authorization: Bearer gk_live_…" /api/v1/assets?limit=25',
  },
  {
    method: "POST",
    path: "/api/v1/assets",
    title: "Create asset",
    description: "Create an asset record before committing a file.",
    curl: 'curl -X POST -H "Authorization: Bearer gk_live_…" -H "Content-Type: application/json" -d \'{"name":"hero.jpg","folder":"marketing"}\' /api/v1/assets',
  },
  {
    method: "GET",
    path: "/api/v1/assets/{id}",
    title: "Get asset",
    description: "Fetch one asset by id.",
    curl: 'curl -H "Authorization: Bearer gk_live_…" /api/v1/assets/{id}',
  },
  {
    method: "PATCH",
    path: "/api/v1/assets/{id}",
    title: "Update asset",
    description: "Patch name, folder, tags, status or description.",
    curl: 'curl -X PATCH -H "Authorization: Bearer gk_live_…" -H "Content-Type: application/json" -d \'{"status":"approved"}\' /api/v1/assets/{id}',
  },
  {
    method: "DELETE",
    path: "/api/v1/assets/{id}",
    title: "Delete asset",
    description: "Soft-delete an asset.",
    curl: 'curl -X DELETE -H "Authorization: Bearer gk_live_…" /api/v1/assets/{id}',
  },
  {
    method: "GET",
    path: "/api/v1/assets/{id}/download",
    title: "Download",
    description: "Redirect to a short-lived download URL.",
    curl: 'curl -H "Authorization: Bearer gk_live_…" /api/v1/assets/{id}/download',
  },
  {
    method: "POST",
    path: "/api/v1/upload",
    title: "Presign upload",
    description: "Get a direct-to-storage upload URL.",
    curl: 'curl -X POST -H "Authorization: Bearer gk_live_…" -H "Content-Type: application/json" -d \'{"filename":"hero.jpg","contentType":"image/jpeg","sizeBytes":123456}\' /api/v1/upload',
  },
  {
    method: "POST",
    path: "/api/v1/upload/commit",
    title: "Commit upload",
    description: "Attach a finished upload to an asset record.",
    curl: 'curl -X POST -H "Authorization: Bearer gk_live_…" -H "Content-Type: application/json" -d \'{"uploadJobId":"…","key":"…"}\' /api/v1/upload/commit',
  },
  {
    method: "GET",
    path: "/api/v1/collections",
    title: "List collections",
    description: "Page through collections with asset counts.",
    curl: 'curl -H "Authorization: Bearer gk_live_…" /api/v1/collections',
  },
  {
    method: "GET",
    path: "/api/v1/folders",
    title: "List folders",
    description: "Page through folders.",
    curl: 'curl -H "Authorization: Bearer gk_live_…" /api/v1/folders',
  },
  {
    method: "GET",
    path: "/api/v1/tags",
    title: "List tags",
    description: "The project's tag vocabulary with usage counts.",
    curl: 'curl -H "Authorization: Bearer gk_live_…" /api/v1/tags',
  },
  {
    method: "PATCH",
    path: "/api/v1/delivery/{id}",
    title: "Toggle delivery",
    description: "Enable or disable dynamic delivery for an asset.",
    curl: 'curl -X PATCH -H "Authorization: Bearer gk_live_…" -H "Content-Type: application/json" -d \'{"deliveryEnabled":true}\' /api/v1/delivery/{id}',
  },
  {
    method: "POST",
    path: "/api/v1/delivery/{id}",
    title: "Mint delivery URL",
    description: "Build a canonical (optionally signed) delivery URL.",
    curl: 'curl -X POST -H "Authorization: Bearer gk_live_…" -H "Content-Type: application/json" -d \'{"transforms":"w_800,c_fill,f_auto,q_auto"}\' /api/v1/delivery/{id}',
  },
];
