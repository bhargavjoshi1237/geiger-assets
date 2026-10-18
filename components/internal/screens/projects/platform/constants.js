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
    className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
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
    className: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
    dotClass: "bg-amber-400",
  },
  delivered: {
    variant: "success",
    label: "Delivered",
    className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    dotClass: "bg-emerald-400",
  },
  failed: {
    variant: "danger",
    label: "Failed",
    className: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
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
  storage: "Cloud storage",
  creative: "Creative tools",
  productivity: "Productivity",
  marketing: "Marketing",
  social: "Social",
  developer: "Developer",
};

export const INTEGRATION_GROUP_ORDER = [
  "storage",
  "creative",
  "productivity",
  "marketing",
  "social",
  "developer",
];

export const INTEGRATION_CATEGORY_TABS = [
  { value: "all", label: "All" },
  ...INTEGRATION_GROUP_ORDER.map((c) => ({ value: c, label: INTEGRATION_CATEGORY_MAP[c] })),
];

export const INTEGRATION_STATUS_MAP = {
  connected: {
    variant: "success",
    label: "Connected",
    className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    dotClass: "bg-emerald-400",
  },
  available: {
    variant: "info",
    label: "Available",
    className: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
    dotClass: "bg-blue-400",
  },
  built_in: {
    variant: "info",
    label: "Built in",
    className: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
    dotClass: "bg-blue-400",
  },
  not_configured: {
    variant: "warning",
    label: "Needs setup",
    className: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
    dotClass: "bg-amber-400",
  },
  coming_soon: {
    variant: "neutral",
    label: "Coming soon",
    className: "bg-zinc-500/15 text-muted-foreground border-zinc-500/30",
    dotClass: "bg-zinc-400",
  },
};

// `kind` says how real an entry is: "oauth" connects for real today, "builtin"
// is a native surface of this app (opens its tab), "planned" is scoped only.
// `color` + `letter` draw the brand tile, like the External Uploads sources.
export const INTEGRATION_CATALOG = [
  {
    key: "google-drive",
    name: "Google Drive",
    tagline: "Pick files in Drive and import them straight into the library.",
    category: "storage",
    kind: "oauth",
    color: "#4285F4",
    letter: "G",
    capabilities: [
      "Import files with Google's own picker",
      "Docs, Sheets and Slides arrive as PDFs",
      "Imports run as tracked upload jobs",
    ],
    access: "Only the files you pick (drive.file scope) — never your whole Drive.",
  },
  {
    key: "dropbox",
    name: "Dropbox",
    tagline: "Ingest team folders on a schedule.",
    category: "storage",
    kind: "planned",
    color: "#0061FF",
    letter: "Db",
    capabilities: ["Scheduled imports", "Delta sync", "Team-folder scopes"],
  },
  {
    key: "onedrive",
    name: "OneDrive",
    tagline: "Bring in files from OneDrive and SharePoint libraries.",
    category: "storage",
    kind: "planned",
    color: "#0078D4",
    letter: "Od",
    capabilities: ["SharePoint site libraries", "Folder imports", "Version-aware re-sync"],
  },
  {
    key: "box",
    name: "Box",
    tagline: "Mirror governed Box folders into the DAM.",
    category: "storage",
    kind: "planned",
    color: "#0061D5",
    letter: "Bx",
    capabilities: ["Folder mirroring", "Metadata template mapping", "Retention-aware imports"],
  },
  {
    key: "photoshop",
    name: "Photoshop",
    tagline: "Push renditions straight to the library from the editor.",
    category: "creative",
    kind: "planned",
    color: "#31A8FF",
    letter: "Ps",
    capabilities: ["Export artboards as assets", "Sync versions back", "Read library metadata"],
  },
  {
    key: "figma",
    name: "Figma",
    tagline: "Hand off frames and components without leaving the canvas.",
    category: "creative",
    kind: "planned",
    color: "#A259FF",
    letter: "F",
    capabilities: ["Export frames as assets", "Link live embeds", "Sync cover thumbnails"],
  },
  {
    key: "canva",
    name: "Canva",
    tagline: "Design with approved brand assets, publish back finished work.",
    category: "creative",
    kind: "planned",
    color: "#00C4CC",
    letter: "C",
    capabilities: ["Brand-asset panel in Canva", "Save designs as assets", "Usage tracking"],
  },
  {
    key: "slack",
    name: "Slack",
    tagline: "Route approvals and upload notices to channels.",
    category: "productivity",
    kind: "planned",
    color: "#4A154B",
    letter: "S",
    capabilities: ["Approval notifications", "Upload digests", "Search from chat"],
  },
  {
    key: "notion",
    name: "Notion",
    tagline: "Embed live assets in docs that update when the file does.",
    category: "productivity",
    kind: "planned",
    color: "#37352F",
    letter: "N",
    capabilities: ["Live asset embeds", "Link previews", "Collection galleries in pages"],
  },
  {
    key: "hubspot",
    name: "HubSpot",
    tagline: "Serve approved creative inside campaigns.",
    category: "marketing",
    kind: "planned",
    color: "#FF7A59",
    letter: "H",
    capabilities: ["File-manager sync", "Campaign asset picker", "Usage attribution"],
  },
  {
    key: "shopify",
    name: "Shopify",
    tagline: "Keep product imagery in step with the catalog.",
    category: "marketing",
    kind: "planned",
    color: "#95BF47",
    letter: "Sh",
    capabilities: ["Product media sync", "Variant image mapping", "Delivery through the CDN"],
  },
  {
    key: "instagram",
    name: "Instagram",
    tagline: "Publish gallery selects to social.",
    category: "social",
    kind: "planned",
    color: "#E1306C",
    letter: "Ig",
    capabilities: ["Scheduled publishing", "Caption templates", "Performance pullback"],
  },
  {
    key: "linkedin",
    name: "LinkedIn",
    tagline: "Share approved creative to company pages.",
    category: "social",
    kind: "planned",
    color: "#0A66C2",
    letter: "in",
    capabilities: ["Company-page posts", "Document carousels", "Engagement pullback"],
  },
  {
    key: "webhooks",
    name: "Webhooks",
    tagline: "Signed HTTP callbacks when assets, collections or galleries change.",
    category: "developer",
    kind: "builtin",
    tab: "Webhooks",
    color: "#10B981",
    letter: "{ }",
    capabilities: ["Per-event subscriptions", "Signed payloads", "Delivery log and retries"],
  },
  {
    key: "api",
    name: "REST API",
    tagline: "Read and write the library with scoped API keys.",
    category: "developer",
    kind: "builtin",
    tab: "API Keys",
    color: "#6366F1",
    letter: "API",
    capabilities: ["Scoped API keys", "Assets, folders and collections", "Rotate and revoke keys"],
  },
  {
    key: "zapier",
    name: "Zapier",
    tagline: "Wire the DAM into thousands of apps without code.",
    category: "developer",
    kind: "planned",
    color: "#FF4F00",
    letter: "Z",
    capabilities: ["Triggers on new assets", "Create assets from any app", "Multi-step zaps"],
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
    className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    dotClass: "bg-emerald-400",
  },
  failed: {
    variant: "danger",
    label: "Failed",
    className: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
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
export const READ_SCOPES = ALL_SCOPES.filter((s) => s.endsWith(":read"));

// API_SCOPES folded into one row per resource ({ read, write } scope or null),
// for the key dialog's permission matrix.
export const API_SCOPE_RESOURCES = API_SCOPES.reduce((rows, scope) => {
  const [resource, access] = scope.value.split(":");
  let row = rows.find((r) => r.resource === resource);
  if (!row) {
    row = { resource, label: scope.label.split(" · ")[0], read: null, write: null };
    rows.push(row);
  }
  row[access] = scope;
  return rows;
}, []);

export function scopeLabel(value) {
  return API_SCOPES.find((s) => s.value === value)?.label || value;
}

export const KEY_STATUS_META = {
  active: {
    variant: "success",
    label: "Active",
    className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    dotClass: "bg-emerald-400",
  },
  expired: {
    variant: "warning",
    label: "Expired",
    className: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
    dotClass: "bg-amber-400",
  },
  revoked: {
    variant: "danger",
    label: "Revoked",
    className: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
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

// API reference ----------------------------------------------------------------
// One entry per public endpoint. `query`, `body` and `flags` feed buildCurl(),
// which prefixes the real API origin so a copied command runs as-is.

export const REFERENCE_GROUPS = [
  { value: "assets", label: "Assets", description: "Search, read and manage library records." },
  { value: "upload", label: "Uploads", description: "Send files straight to storage, then attach them." },
  { value: "collections", label: "Collections", description: "Curated sets of assets." },
  { value: "folders", label: "Folders", description: "The library's folder tree." },
  { value: "tags", label: "Tags", description: "The project's tag vocabulary." },
  { value: "delivery", label: "Delivery", description: "Public, transformable delivery URLs." },
];

export const REFERENCE_GROUP_TABS = [
  { value: "all", label: "All" },
  ...REFERENCE_GROUPS.map((g) => ({ value: g.value, label: g.label })),
];

export const METHOD_BADGE_CLASS = {
  GET: "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  POST: "border-sky-500/20 bg-sky-500/10 text-sky-600 dark:text-sky-400",
  PATCH: "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  PUT: "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  DELETE: "border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400",
};

export const REFERENCE_ENDPOINTS = [
  {
    group: "assets",
    method: "GET",
    path: "/api/v1/assets",
    query: "?limit=25",
    scope: "assets:read",
    title: "List assets",
    description: "Search and page through the library with a cursor.",
  },
  {
    group: "assets",
    method: "POST",
    path: "/api/v1/assets",
    scope: "assets:write",
    title: "Create asset",
    description: "Create an asset record before committing a file.",
    body: '{"name":"hero.jpg","folder":"marketing"}',
  },
  {
    group: "assets",
    method: "GET",
    path: "/api/v1/assets/{id}",
    scope: "assets:read",
    title: "Get asset",
    description: "Fetch one asset by id.",
  },
  {
    group: "assets",
    method: "PATCH",
    path: "/api/v1/assets/{id}",
    scope: "assets:write",
    title: "Update asset",
    description: "Patch name, folder, tags, status or description.",
    body: '{"status":"approved"}',
  },
  {
    group: "assets",
    method: "DELETE",
    path: "/api/v1/assets/{id}",
    scope: "assets:write",
    title: "Delete asset",
    description: "Soft-delete an asset.",
  },
  {
    group: "assets",
    method: "GET",
    path: "/api/v1/assets/{id}/download",
    scope: "assets:read",
    title: "Download original",
    description: "Redirects to a short-lived download URL.",
    flags: "-L -O",
  },
  {
    group: "upload",
    method: "POST",
    path: "/api/v1/upload",
    scope: "upload:write",
    title: "Presign upload",
    description: "Get a direct-to-storage upload URL.",
    body: '{"filename":"hero.jpg","contentType":"image/jpeg","sizeBytes":123456}',
  },
  {
    group: "upload",
    method: "POST",
    path: "/api/v1/upload/commit",
    scope: "upload:write",
    title: "Commit upload",
    description: "Attach a finished upload to an asset record.",
    body: '{"uploadJobId":"…","key":"…"}',
  },
  {
    group: "collections",
    method: "GET",
    path: "/api/v1/collections",
    scope: "collections:read",
    title: "List collections",
    description: "Page through collections with asset counts.",
  },
  {
    group: "folders",
    method: "GET",
    path: "/api/v1/folders",
    scope: "folders:read",
    title: "List folders",
    description: "Page through folders.",
  },
  {
    group: "tags",
    method: "GET",
    path: "/api/v1/tags",
    scope: "tags:read",
    title: "List tags",
    description: "The project's tag vocabulary with usage counts.",
  },
  {
    group: "delivery",
    method: "PATCH",
    path: "/api/v1/delivery/{id}",
    scope: "delivery:write",
    title: "Toggle delivery",
    description: "Enable or disable dynamic delivery for an asset.",
    body: '{"deliveryEnabled":true}',
  },
  {
    group: "delivery",
    method: "POST",
    path: "/api/v1/delivery/{id}",
    scope: "delivery:read",
    title: "Mint delivery URL",
    description: "Build a canonical (optionally signed) delivery URL.",
    body: '{"transforms":"w_800,c_fill,f_auto,q_auto"}',
  },
];

export const API_KEY_PLACEHOLDER = "gk_live_…";

export function buildCurl(endpoint, origin = "") {
  const lines = [`curl${endpoint.flags ? ` ${endpoint.flags}` : ""}${endpoint.method === "GET" ? "" : ` -X ${endpoint.method}`}`];
  lines.push(`-H "Authorization: Bearer ${API_KEY_PLACEHOLDER}"`);
  if (endpoint.body) {
    lines.push('-H "Content-Type: application/json"');
    lines.push(`-d '${endpoint.body}'`);
  }
  lines.push(`"${origin}${endpoint.path}${endpoint.query || ""}"`);
  return lines.join(" \\\n  ");
}
