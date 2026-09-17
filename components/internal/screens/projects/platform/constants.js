// Lookups, catalogs, filter options, and formatters for the platform screens.
// Config only — never row data. Integration connection state and data-job
// history come from lib/supabase/platform.js; webhook endpoints come from
// lib/supabase/settings.js (the browser boundary over /api/webhooks/endpoints,
// which reaches the server-only lib/media/webhooks.js).

// ---------------------------------------------------------------------------
// Integrations
// ---------------------------------------------------------------------------

export const INTEGRATION_CATEGORY_MAP = {
  creative: { label: "Creative tools", dotClass: "bg-violet-400" },
  storage: { label: "Cloud storage", dotClass: "bg-sky-400" },
  productivity: { label: "Productivity", dotClass: "bg-emerald-400" },
  project: { label: "Project management", dotClass: "bg-amber-400" },
  marketing: { label: "Marketing", dotClass: "bg-rose-400" },
  social: { label: "Social", dotClass: "bg-cyan-400" },
};

export const INTEGRATION_CATEGORY_FILTER_OPTIONS = [
  { value: "all", label: "All categories" },
  ...Object.entries(INTEGRATION_CATEGORY_MAP).map(([value, meta]) => ({
    value,
    label: meta.label,
  })),
];

export const INTEGRATION_STATUS_MAP = {
  connected: { label: "Connected", variant: "success", dotClass: "bg-emerald-400" },
  paused: { label: "Paused", variant: "neutral", dotClass: "bg-zinc-400" },
  error: { label: "Needs attention", variant: "danger", dotClass: "bg-red-400" },
  disconnected: { label: "Not connected", variant: "neutral", dotClass: "bg-zinc-500" },
};

export const INTEGRATION_STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "connected", label: "Connected" },
  { value: "paused", label: "Paused" },
  { value: "error", label: "Needs attention" },
  { value: "disconnected", label: "Not connected" },
];

export function integrationStatusOf(row) {
  if (!row) return "disconnected";
  if (row.status === "connected" || row.status === "paused" || row.status === "error") return row.status;
  return "disconnected";
}

// Connectable-service catalog. Connection state persists per project in
// assets.integrations (lib/supabase/platform.js); `fields` are rendered
// straight into the connect dialog the way lib/storage/backends/fields.js
// renders BACKEND_FIELDS — `secret` fields are write-only (an empty value on
// update means unchanged). Connecting stores local config only; no real OAuth
// flow runs against any third party.
export const INTEGRATION_CATALOG = [
  {
    id: "figma",
    name: "Figma",
    category: "creative",
    description: "Import frames and components as image assets.",
    fields: [
      { name: "teamId", label: "Team ID", placeholder: "e.g. 123456789" },
      { name: "token", label: "Personal access token", placeholder: "figd_…", secret: true },
    ],
  },
  {
    id: "adobe",
    name: "Adobe Creative Cloud",
    category: "creative",
    description: "Pull Libraries and cloud documents into the library.",
    fields: [
      { name: "orgId", label: "Organization ID", placeholder: "e.g. 0A1B2C3D4E@AdobeOrg" },
      { name: "apiKey", label: "API key", placeholder: "API key", secret: true },
    ],
  },
  {
    id: "canva",
    name: "Canva",
    category: "creative",
    description: "Sync finished designs for approval and delivery.",
    fields: [
      { name: "teamId", label: "Team ID", placeholder: "e.g. my-team" },
      { name: "token", label: "API token", placeholder: "Canva Connect token", secret: true },
    ],
  },
  {
    id: "drive",
    name: "Google Drive",
    category: "storage",
    description: "Mirror a folder tree into the asset library.",
    fields: [
      { name: "folderId", label: "Folder ID", placeholder: "Drive folder ID" },
      { name: "serviceEmail", label: "Service account email", placeholder: "svc@project.iam.gserviceaccount.com" },
    ],
  },
  {
    id: "dropbox",
    name: "Dropbox",
    category: "storage",
    description: "Import shared-folder drops as new uploads.",
    fields: [
      { name: "folderPath", label: "Folder path", placeholder: "/Assets/Inbox" },
      { name: "token", label: "Access token", placeholder: "sl.…", secret: true },
    ],
  },
  {
    id: "slack",
    name: "Slack",
    category: "productivity",
    description: "Post upload, approval, and quota events to a channel.",
    fields: [
      { name: "webhookUrl", label: "Incoming webhook URL", placeholder: "https://hooks.slack.com/…" },
      { name: "channel", label: "Channel", placeholder: "#assets" },
    ],
  },
  {
    id: "notion",
    name: "Notion",
    category: "productivity",
    description: "Embed asset galleries in docs and briefs.",
    fields: [
      { name: "token", label: "Integration token", placeholder: "secret_…", secret: true },
      { name: "databaseId", label: "Database ID", placeholder: "Notion database ID" },
    ],
  },
  {
    id: "asana",
    name: "Asana",
    category: "project",
    description: "Attach assets to tasks and track creative requests.",
    fields: [
      { name: "workspaceId", label: "Workspace ID", placeholder: "Asana workspace ID" },
      { name: "token", label: "Personal access token", placeholder: "1/…", secret: true },
    ],
  },
  {
    id: "linear",
    name: "Linear",
    category: "project",
    description: "Link assets to issues for design review.",
    fields: [
      { name: "teamKey", label: "Team key", placeholder: "e.g. DES" },
      { name: "apiKey", label: "API key", placeholder: "lin_api_…", secret: true },
    ],
  },
  {
    id: "mailchimp",
    name: "Mailchimp",
    category: "marketing",
    description: "Push approved creatives into campaign templates.",
    fields: [
      { name: "serverPrefix", label: "Server prefix", placeholder: "e.g. us21" },
      { name: "apiKey", label: "API key", placeholder: "…-us21", secret: true },
    ],
  },
  {
    id: "hubspot",
    name: "HubSpot",
    category: "marketing",
    description: "Sync file-manager assets for landing pages.",
    fields: [
      { name: "portalId", label: "Portal ID", placeholder: "Hub ID" },
      { name: "token", label: "Private app token", placeholder: "pat-…", secret: true },
    ],
  },
  {
    id: "instagram",
    name: "Instagram",
    category: "social",
    description: "Publish approved images and reels to a business account.",
    fields: [
      { name: "accountId", label: "Business account ID", placeholder: "IG account ID" },
      { name: "token", label: "Access token", placeholder: "IG…", secret: true },
    ],
  },
];

// ---------------------------------------------------------------------------
// API explorer — every entry below is a route that exists in app/api/**.
// The explorer documents method, path, and an example request; nothing here
// invents a route.
// ---------------------------------------------------------------------------

export const API_GROUPS = [
  "Storage backends",
  "Storage pools",
  "Uploads",
  "Media & delivery",
  "Webhooks",
  "Operations",
];

export const API_GROUP_FILTER_OPTIONS = [
  { value: "all", label: "All groups" },
  ...API_GROUPS.map((label) => ({ value: label, label })),
];

export const API_METHOD_FILTER_OPTIONS = [
  { value: "all", label: "All methods" },
  { value: "GET", label: "GET" },
  { value: "POST", label: "POST" },
  { value: "PATCH", label: "PATCH" },
  { value: "PUT", label: "PUT" },
  { value: "DELETE", label: "DELETE" },
];

export const API_METHOD_MAP = {
  GET: { label: "GET", variant: "info", dotClass: "bg-sky-400" },
  POST: { label: "POST", variant: "success", dotClass: "bg-emerald-400" },
  PATCH: { label: "PATCH", variant: "warning", dotClass: "bg-amber-400" },
  PUT: { label: "PUT", variant: "warning", dotClass: "bg-amber-400" },
  DELETE: { label: "DELETE", variant: "danger", dotClass: "bg-red-400" },
};

export const API_ENDPOINTS = [
  {
    method: "GET",
    path: "/api/storage/backends?projectId=<id>&includeSuite=1",
    group: "Storage backends",
    summary: "List this project's storage backends, plus suite-wide rows for context.",
    example: "curl -G /api/storage/backends --data-urlencode projectId=<id> --data-urlencode includeSuite=1",
  },
  {
    method: "POST",
    path: "/api/storage/backends",
    group: "Storage backends",
    summary: "Add an S3 or REST backend (kind, label, config, maxUploadBytes).",
    example: 'curl -X POST /api/storage/backends -H "Content-Type: application/json" -d \'{"projectId":"<id>","kind":"s3","label":"Primary R2","config":{"endpoint":"https://s3.example.com","bucket":"assets"}}\'',
  },
  {
    method: "GET",
    path: "/api/storage/backends/[id]",
    group: "Storage backends",
    summary: "Fetch one backend plus its pinned-asset count for impact review.",
    example: "curl /api/storage/backends/<backendId>",
  },
  {
    method: "PATCH",
    path: "/api/storage/backends/[id]",
    group: "Storage backends",
    summary: "Update label, kind, enabled flag, config, or cap. Blank secrets are left alone.",
    example: 'curl -X PATCH /api/storage/backends/<backendId> -H "Content-Type: application/json" -d \'{"enabled":false}\'',
  },
  {
    method: "DELETE",
    path: "/api/storage/backends/[id]",
    group: "Storage backends",
    summary: "Soft-delete a project backend. Suite-wide rows are read-only.",
    example: "curl -X DELETE /api/storage/backends/<backendId>",
  },
  {
    method: "POST",
    path: "/api/storage/backends/[id]/health",
    group: "Storage backends",
    summary: "Probe a backend and record latency plus capabilities on the row.",
    example: "curl -X POST /api/storage/backends/<backendId>/health",
  },
  {
    method: "GET",
    path: "/api/storage/pools?projectId=<id>",
    group: "Storage pools",
    summary: "List the placement pools that choose between backends.",
    example: "curl -G /api/storage/pools --data-urlencode projectId=<id>",
  },
  {
    method: "POST",
    path: "/api/storage/pools",
    group: "Storage pools",
    summary: "Create a pool (failover, spread, or mirror strategy plus members).",
    example: 'curl -X POST /api/storage/pools -H "Content-Type: application/json" -d \'{"projectId":"<id>","name":"Primary","strategy":"failover","members":[{"backendId":"<backendId>"}]}\'',
  },
  {
    method: "GET",
    path: "/api/storage/pools/[id]",
    group: "Storage pools",
    summary: "Fetch one pool with its member backends.",
    example: "curl /api/storage/pools/<poolId>",
  },
  {
    method: "PATCH",
    path: "/api/storage/pools/[id]",
    group: "Storage pools",
    summary: "Patch a pool's name, strategy, or settings.",
    example: 'curl -X PATCH /api/storage/pools/<poolId> -H "Content-Type: application/json" -d \'{"strategy":"mirror"}\'',
  },
  {
    method: "PUT",
    path: "/api/storage/pools/[id]",
    group: "Storage pools",
    summary: "Replace a pool's member list in one write.",
    example: 'curl -X PUT /api/storage/pools/<poolId> -H "Content-Type: application/json" -d \'{"members":[{"backendId":"<a>"},{"backendId":"<b>"}]}\'',
  },
  {
    method: "DELETE",
    path: "/api/storage/pools/[id]",
    group: "Storage pools",
    summary: "Soft-delete a pool. Pinned assets fall back to the default backend.",
    example: "curl -X DELETE /api/storage/pools/<poolId>",
  },
  {
    method: "POST",
    path: "/api/storage/upload",
    group: "Uploads",
    summary: "Small-file upload proxy: multipart form with file, projectId, uploadJobId.",
    example: 'curl -X POST /api/storage/upload -F file=@hero.jpg -F projectId=<id> -F uploadJobId=<jobId> -F folder=marketing',
  },
  {
    method: "POST",
    path: "/api/storage/upload-url",
    group: "Uploads",
    summary: "Mint a direct-to-storage upload URL (projectId, filename, contentType, sizeBytes).",
    example: 'curl -X POST /api/storage/upload-url -H "Content-Type: application/json" -d \'{"projectId":"<id>","uploadJobId":"<jobId>","filename":"hero.jpg","contentType":"image/jpeg","sizeBytes":412009}\'',
  },
  {
    method: "POST",
    path: "/api/storage/commit",
    group: "Uploads",
    summary: "Commit a finished upload key into an asset row (uploadJobId, key).",
    example: 'curl -X POST /api/storage/commit -H "Content-Type: application/json" -d \'{"uploadJobId":"<jobId>","key":"<projectId>/…/hero.jpg"}\'',
  },
  {
    method: "POST",
    path: "/api/storage/sign",
    group: "Uploads",
    summary: "Batch-sign storage keys for reads (keys array, capped per call).",
    example: 'curl -X POST /api/storage/sign -H "Content-Type: application/json" -d \'{"keys":["<projectId>/…/hero.jpg"]}\'',
  },
  {
    method: "GET",
    path: "/api/storage/file?key=<key>",
    group: "Uploads",
    summary: "Same-origin read proxy that streams bytes for an authorized key.",
    example: "curl -G /api/storage/file --data-urlencode key=<projectId>/…/hero.jpg",
  },
  {
    method: "DELETE",
    path: "/api/storage/object?assetId=<id>",
    group: "Uploads",
    summary: "Soft-delete an asset's file (assetId in the body or query).",
    example: 'curl -X DELETE /api/storage/object -H "Content-Type: application/json" -d \'{"assetId":"<assetId>"}\'',
  },
  {
    method: "POST",
    path: "/api/storage/multipart/create",
    group: "Uploads",
    summary: "Start a large multipart upload and plan its part sizes.",
    example: 'curl -X POST /api/storage/multipart/create -H "Content-Type: application/json" -d \'{"projectId":"<id>","uploadJobId":"<jobId>","filename":"film.mp4","contentType":"video/mp4"}\'',
  },
  {
    method: "POST",
    path: "/api/storage/multipart/part",
    group: "Uploads",
    summary: "Upload one part of a multipart session (uploadId, key, partNumber).",
    example: 'curl -X POST /api/storage/multipart/part -F uploadId=<uploadId> -F key=<key> -F partNumber=1 -F file=@chunk-1.bin',
  },
  {
    method: "POST",
    path: "/api/storage/multipart/complete",
    group: "Uploads",
    summary: "Assemble uploaded parts into the final object.",
    example: 'curl -X POST /api/storage/multipart/complete -H "Content-Type: application/json" -d \'{"uploadId":"<uploadId>","key":"<key>","parts":[{"ETag":"…","PartNumber":1}]}\'',
  },
  {
    method: "POST",
    path: "/api/storage/multipart/abort",
    group: "Uploads",
    summary: "Abandon a multipart session and drop its staged parts.",
    example: 'curl -X POST /api/storage/multipart/abort -H "Content-Type: application/json" -d \'{"uploadId":"<uploadId>","key":"<key>"}\'',
  },
  {
    method: "GET",
    path: "/api/storage/multipart/status?uploadId=<id>&key=<key>",
    group: "Uploads",
    summary: "List the parts received so far so a client can resume.",
    example: "curl -G /api/storage/multipart/status --data-urlencode uploadId=<uploadId> --data-urlencode key=<key>",
  },
  {
    method: "GET",
    path: "/api/media/[assetId]/[variant]",
    group: "Media & delivery",
    summary: "Serve a named variant (thumb, preview, …) with format negotiation and CDN redirect.",
    example: "curl /api/media/<assetId>/preview -H 'Accept: image/avif'",
  },
  {
    method: "GET",
    path: "/api/media/[assetId]/t/[spec]",
    group: "Media & delivery",
    summary: "On-demand transform, e.g. w_384,h_256,c_fill. Only allowlisted specs resolve.",
    example: "curl /api/media/<assetId>/t/w_384,h_256,c_fill",
  },
  {
    method: "POST",
    path: "/api/media/share",
    group: "Media & delivery",
    summary: "Mint an expiring bearer token URL for an asset variant (assetId, variant, scope).",
    example: 'curl -X POST /api/media/share -H "Content-Type: application/json" -d \'{"assetId":"<assetId>","variant":"preview","scope":"view","ttlSeconds":86400}\'',
  },
  {
    method: "GET",
    path: "/api/assets/[id]/file",
    group: "Media & delivery",
    summary: "Download the original file bytes for one asset.",
    example: "curl /api/assets/<assetId>/file -o hero.jpg",
  },
  {
    method: "GET",
    path: "/api/webhooks/endpoints?projectId=<id>",
    group: "Webhooks",
    summary: "List this project's outbound webhook endpoints (secrets never included).",
    example: "curl -G /api/webhooks/endpoints --data-urlencode projectId=<id>",
  },
  {
    method: "POST",
    path: "/api/webhooks/endpoints",
    group: "Webhooks",
    summary: "Subscribe a URL to asset events. The secret returns once, at create time.",
    example: 'curl -X POST /api/webhooks/endpoints -H "Content-Type: application/json" -d \'{"projectId":"<id>","url":"https://example.com/hooks/assets","events":["asset.created","upload.completed"]}\'',
  },
  {
    method: "PATCH",
    path: "/api/webhooks/endpoints/[id]",
    group: "Webhooks",
    summary: "Change an endpoint's URL, subscribed events, or active flag.",
    example: 'curl -X PATCH /api/webhooks/endpoints/<endpointId> -H "Content-Type: application/json" -d \'{"active":false}\'',
  },
  {
    method: "DELETE",
    path: "/api/webhooks/endpoints/[id]",
    group: "Webhooks",
    summary: "Soft-delete an endpoint; its pending deliveries stop retrying.",
    example: "curl -X DELETE /api/webhooks/endpoints/<endpointId>",
  },
  {
    method: "GET",
    path: "/api/cron/reconcile",
    group: "Operations",
    summary: "Storage reconcile sweep (CRON_SECRET bearer). Repairs drift between rows and bytes.",
    example: "curl /api/cron/reconcile -H 'Authorization: Bearer <CRON_SECRET>'",
  },
];

// ---------------------------------------------------------------------------
// SDKs
// ---------------------------------------------------------------------------

export const SDK_GUIDES = [
  {
    id: "rest",
    title: "REST via fetch",
    language: "JavaScript",
    description: "No package needed — the API is plain JSON over HTTPS. List backends for a project.",
    install: "No install — works with the global fetch in Node 18+ and every browser.",
    code: [
      "const res = await fetch(`/api/storage/backends?projectId=${PROJECT_ID}&includeSuite=1`);",
      "if (!res.ok) throw new Error(`backends failed: ${res.status}`);",
      "const { backends, suiteBackends } = await res.json();",
    ].join("\n"),
  },
  {
    id: "upload",
    title: "Small-file upload",
    language: "JavaScript",
    description: "Post multipart form data to the upload proxy, then read back the asset.",
    install: "No install — FormData is built into browsers and Node 18+.",
    code: [
      "const form = new FormData();",
      "form.append('file', file, file.name);",
      "form.append('projectId', PROJECT_ID);",
      "form.append('uploadJobId', crypto.randomUUID());",
      "form.append('folder', 'marketing');",
      "",
      "const res = await fetch('/api/storage/upload', { method: 'POST', body: form });",
      "if (res.status === 413) throw new Error('file is over the proxy limit — use multipart');",
      "const asset = await res.json();",
    ].join("\n"),
  },
  {
    id: "delivery",
    title: "Signed share links",
    language: "JavaScript",
    description: "Mint an expiring bearer URL for a variant, then embed it anywhere.",
    install: "No install — call POST /api/media/share and render the returned url.",
    code: [
      "const res = await fetch('/api/media/share', {",
      "  method: 'POST',",
      "  headers: { 'Content-Type': 'application/json' },",
      "  body: JSON.stringify({ assetId, variant: 'preview', scope: 'view', ttlSeconds: 86400 }),",
      "});",
      "const { url, expiresAt } = await res.json();",
      "// <img src={url} alt={name} loading=\"lazy\" />",
    ].join("\n"),
  },
  {
    id: "verify",
    title: "Verify webhook signatures",
    language: "Node.js",
    description: "Receivers recompute the Stripe-style HMAC over timestamp.body and compare in constant time.",
    install: "No install — uses node:crypto only.",
    code: [
      "import { createHmac, timingSafeEqual } from 'node:crypto';",
      "",
      "function verifyWebhook(rawBody, signature, secret) {",
      "  const [t, v1] = signature.split(',').map((p) => p.split('=')[1]);",
      "  const hex = createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex');",
      "  return timingSafeEqual(Buffer.from(v1), Buffer.from(hex));",
      "}",
    ].join("\n"),
  },
  {
    id: "transforms",
    title: "Responsive images",
    language: "HTML",
    description: "Point srcset at the transform route; only allowlisted specs resolve, so widths are fixed.",
    install: "No install — plain <img> markup against /api/media/<id>/t/<spec>.",
    code: [
      '<img',
      '  src="/api/media/<assetId>/t/w_768"',
      '  srcset="/api/media/<assetId>/t/w_384 384w, /api/media/<assetId>/t/w_768 768w"',
      '  sizes="(max-width: 768px) 100vw, 768px"',
      '  alt="Campaign hero" loading="lazy" />',
    ].join("\n"),
  },
];

export const SDK_RELEASES = [
  { version: "0.4.0", date: "2026-09-18", notes: "Transform route (/t/<spec>) and multipart resume documented." },
  { version: "0.3.0", date: "2026-09-11", notes: "Signed share links with variant pinning and TTL scopes." },
  { version: "0.2.0", date: "2026-09-04", notes: "Storage pools (failover, spread, mirror) and health probes." },
  { version: "0.1.0", date: "2026-08-28", notes: "Backends, direct uploads, and webhook dispatch." },
];

export const SDK_STARTERS = [
  {
    name: "Marketing site gallery",
    stack: "Next.js · fetch",
    description: "Server-rendered gallery that resolves preview variants at build time.",
  },
  {
    name: "Drag-and-drop uploader",
    stack: "React · FormData",
    description: "Chunked multipart uploads with resume via the status endpoint.",
  },
  {
    name: "Order-to-asset pipeline",
    stack: "Node.js · webhooks",
    description: "Receives asset.created, verifies the signature, and warms the CDN.",
  },
];

// ---------------------------------------------------------------------------
// Webhooks — client-safe mirror of EVENTS in lib/media/webhooks.js (that
// module is server-only: it signs and delivers to attacker-controlled URLs,
// so screens must not import it).
// ---------------------------------------------------------------------------

export const WEBHOOK_EVENTS = [
  "asset.created",
  "asset.updated",
  "asset.deleted",
  "asset.version.created",
  "upload.completed",
  "upload.failed",
];

export const WEBHOOK_EVENT_OPTIONS = WEBHOOK_EVENTS.map((value) => ({ value, label: value }));

export const WEBHOOK_EVENT_FILTER_OPTIONS = [
  { value: "all", label: "All events" },
  ...WEBHOOK_EVENT_OPTIONS,
];

export const WEBHOOK_STATUS_MAP = {
  active: { label: "Active", variant: "success", dotClass: "bg-emerald-400" },
  paused: { label: "Paused", variant: "neutral", dotClass: "bg-zinc-400" },
};

export const WEBHOOK_STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
];

export function webhookStatusOf(endpoint) {
  return endpoint?.active === false ? "paused" : "active";
}

// Retry policy mirrors the sweep in lib/media/webhooks.js: up to 8 attempts,
// 60s base backoff doubling per attempt, capped at 6h; statuses are the
// webhook_deliveries check constraint (pending, delivered, failed).
export const WEBHOOK_RETRY_POLICY = {
  maxAttempts: 8,
  baseBackoffSeconds: 60,
  maxBackoffHours: 6,
};

export const DELIVERY_STATUS_MAP = {
  pending: { label: "Pending retry", variant: "warning", dotClass: "bg-amber-400" },
  delivered: { label: "Delivered", variant: "success", dotClass: "bg-emerald-400" },
  failed: { label: "Failed", variant: "danger", dotClass: "bg-red-400" },
};

export const DELIVERY_STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All deliveries" },
  { value: "pending", label: "Pending retry" },
  { value: "delivered", label: "Delivered" },
  { value: "failed", label: "Failed" },
];

// ---------------------------------------------------------------------------
// Data import / export
// ---------------------------------------------------------------------------

export const JOB_KIND_MAP = {
  import: { label: "Import", variant: "info", dotClass: "bg-sky-400" },
  export: { label: "Export", variant: "purple", dotClass: "bg-violet-400" },
};

export const JOB_KIND_FILTER_OPTIONS = [
  { value: "all", label: "All kinds" },
  { value: "import", label: "Imports" },
  { value: "export", label: "Exports" },
];

export const JOB_STATUS_MAP = {
  pending: { label: "Pending", variant: "neutral", dotClass: "bg-zinc-400" },
  running: { label: "Running", variant: "warning", dotClass: "bg-amber-400" },
  completed: { label: "Completed", variant: "success", dotClass: "bg-emerald-400" },
  failed: { label: "Failed", variant: "danger", dotClass: "bg-red-400" },
};

export const JOB_STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "running", label: "Running" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
];

export const JOB_FORMAT_OPTIONS = [
  { value: "csv", label: "CSV" },
  { value: "json", label: "JSON" },
];

// Target fields for the import mapping step. Values are the camelCase keys
// that lib/supabase/assets.js createAsset accepts (its toRow maps them to
// real columns); anything unmapped is ignored rather than stored.
export const ASSET_IMPORT_FIELDS = [
  { value: "name", label: "Name", hint: "Required — rows without a name are skipped." },
  { value: "type", label: "Type", hint: "image, video, audio, document, …" },
  { value: "folder", label: "Folder", hint: "Defaults to root." },
  { value: "status", label: "Status", hint: "draft, ready, archived, …" },
  { value: "description", label: "Description", hint: "Long text." },
  { value: "tags", label: "Tags", hint: "Comma- or pipe-separated list." },
  { value: "format", label: "Format", hint: "jpg, mp4, pdf, …" },
  { value: "mimeType", label: "MIME type", hint: "image/jpeg, video/mp4, …" },
  { value: "originalFilename", label: "Original filename", hint: "Source file name." },
];

export const ASSET_IMPORT_FIELD_OPTIONS = [
  { value: "ignore", label: "Don't import" },
  ...ASSET_IMPORT_FIELDS.map((field) => ({ value: field.value, label: field.label })),
];

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

export function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-US", {
    year: "numeric",
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

export function formatCount(value) {
  return new Intl.NumberFormat("en-US").format(Number(value) || 0);
}
