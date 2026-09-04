# S3 Asset Storage Layer — Design

**Date:** 2026-09-05
**Status:** Awaiting review
**Scope:** Give Geiger Assets a real object-storage backend (Appwrite's
S3-compatible gateway) behind a small, portable, cache-aware module that any
screen — or any other app in the suite — can import without knowing S3 exists.

---

## 1. Goal

Today `assets.assets` describes files that do not exist. There is a
`thumbnail_url` column, an Upload Center screen backed by `assets.upload_jobs`,
and an external-portal flow backed by `assets.upload_portals` — but no bytes are
ever stored anywhere. This spec adds the storage half.

The deliverable is **one import surface**:

```js
// browser
import { uploadAsset, assetFileUrl, deleteAssetFile } from "@/lib/storage/client";

// server (route handlers, server components, server actions)
import { putAsset, signAssetUrl, headAsset } from "@/lib/storage/service";
```

Everything below that line — credentials, presigning, retries, key naming,
caching, DB reconciliation — is an implementation detail the caller never sees.

### Non-goals

- Image transformation / resizing pipelines (a `derivatives/` key namespace is
  reserved for it; nothing generates them in this pass).
- Multipart uploads for files > 5 GB. Single-part PUT only; the size ceiling is
  a configured constant.
- Migrating existing rows. No asset row has a file today, so there is nothing to
  backfill.
- Virus scanning, DRM, watermarking.

---

## 2. Decisions (from brainstorming)

| Question | Decision |
|---|---|
| Upload path | **Presigned PUT direct to S3, with a server-proxy fallback.** Both hide behind one `uploadAsset()` call. |
| Read path | **Short-lived presigned GET URLs**, memo-cached. Bucket stays private. |
| Caching | All four layers: signed-URL memo cache, HTTP `Cache-Control`/ETag, Next 16 `use cache` + `cacheTag`, and Postgres as the listing index (never `ListObjects` to render a screen). |
| Coupling | **Decoupled core + bound service.** `lib/s3/*` has zero DB knowledge and is copy-pasteable into any Geiger app; `lib/storage/service.js` composes it with the `assets` schema. |

---

## 3. Repo reality (what this design must fit)

- **Next 16 App Router**, `basePath: '/assets'` in production. All URLs the
  client builds must go through the `NEXT_PUBLIC_BASE_PATH` prefix already
  exported by `next.config.mjs`.
- **No `app/api` directory exists yet.** This spec creates the first route
  handlers in the project.
- Data layer convention (`SUPABASE_CONVENTIONS.md`): `"use client"` modules under
  `lib/supabase/<area>.js`, guarded by `isSupabaseConfigured()`, returning
  `null`/`false`/`[]`, never throwing, never toasting. **The S3 layer follows the
  same contract** so screens branch on results identically.
- Product schema is `assets`; the browser client is `assetsClient()` from
  `supabase/components/assets-client.js`. A cookie-aware server client already
  exists at `lib/supabase/server.js` (`createServerSupabase()`).
- RBAC keys are `assets.*` (`geiger-rbac.config.js`) — `assets.asset.edit` and
  `assets.asset.delete` already exist and are the right gates for write/delete.
- `server-only` is **not** installed. Server-side modules use an explicit runtime
  guard instead of adding a dependency.

---

## 4. Credentials & environment

Secrets never reach the browser. Nothing here is `NEXT_PUBLIC_`.

```bash
# .env.local  (server-only — the secret must never be NEXT_PUBLIC_)
S3_ENDPOINT=https://sgp.cloud.appwrite.io/v1/s3
S3_REGION=sgp
S3_ACCESS_KEY_ID=6a1dd526002a953d7271
S3_SECRET_ACCESS_KEY=<your-api-key>
S3_BUCKET=geiger-assets
S3_FORCE_PATH_STYLE=true          # required: the endpoint carries a /v1/s3 path prefix
S3_SIGNED_URL_TTL=3600            # seconds a presigned GET stays valid
S3_UPLOAD_URL_TTL=900             # seconds a presigned PUT stays valid
S3_MAX_UPLOAD_BYTES=524288000     # 500 MB hard ceiling
```

Notes:

- The AWS SDK insists on a region string; Appwrite ignores it. `sgp` is passed
  through verbatim.
- `S3_FORCE_PATH_STYLE=true` is **not optional**. Virtual-host addressing would
  produce `https://geiger-assets.sgp.cloud.appwrite.io/...`, which does not
  exist. Path style yields `https://sgp.cloud.appwrite.io/v1/s3/geiger-assets/<key>`.
- `.env.example` gets the same keys with empty values, committed. `.env.local`
  stays gitignored.
- `S3_ACCESS_KEY_ID` names in the shell snippet the user supplied (`AWS_*`) are
  deliberately **not** reused — `AWS_*` variables are picked up implicitly by the
  SDK's default credential chain, which makes it ambiguous whether config came
  from the file or the ambient environment. Explicit `S3_*` names make the
  wiring auditable.

### Bucket provisioning

One bucket, `geiger-assets`, created once out-of-band:

```bash
aws s3 mb "s3://geiger-assets" --endpoint-url "$S3_ENDPOINT"
```

It stays **private**. Every read is a presigned GET. A `scripts/s3-check.js`
one-shot (`npm run s3:check`) verifies credentials, bucket existence, and
round-trips a small object so misconfiguration surfaces at setup time rather
than on a user's first upload.

---

## 5. Architecture

```
                    browser                          server                    appwrite
  ┌──────────────────────────────┐   ┌───────────────────────────────────┐   ┌──────────┐
  │ screens / hooks              │   │ app/api/storage/*  (route handlers)│   │          │
  │   use-asset-upload.js        │──▶│   upload-url · commit · upload    │──▶│   S3     │
  │   lib/storage/client.js      │   │   sign · object                   │   │ gateway  │
  │   ("use client", fetch only) │   │            │                      │   │          │
  └──────────────────────────────┘   │            ▼                      │   └──────────┘
                 │                   │   lib/storage/service.js          │         ▲
                 │  presigned PUT    │   (S3 ⨯ assets schema)            │         │
                 └───────────────────┼───────────┬──────────┬────────────┼─────────┘
                                     │           ▼          ▼            │
                                     │      lib/s3/*   lib/supabase/*    │
                                     │   (portable core)  (DB rows)      │
                                     └───────────────────────────────────┘
```

Three layers, three responsibilities:

1. **`lib/s3/*` — portable object-storage core.** Knows about buckets, keys,
   signatures, and caching. Knows nothing about assets, projects, Supabase, or
   React. Droppable into geiger-flow or geiger-notes unchanged.
2. **`lib/storage/service.js` — the bound service.** Composes the core with the
   `assets` schema: writes `storage_key`/`etag`/`checksum`, opens and closes
   `upload_jobs`, appends `asset_versions`, enforces RBAC. Server-only.
3. **`lib/storage/client.js` + `lib/hooks/use-asset-upload.js` — the browser
   surface.** Pure `fetch` against the route handlers; holds no credentials and
   imports nothing from `lib/s3`.

---

## 6. The portable core (`lib/s3/*`)

Six small files, each with one job. Every one is server-only and begins with the
same guard:

```js
if (typeof window !== "undefined") {
  throw new Error("lib/s3 is server-only — import lib/storage/client on the browser.");
}
```

### 6.1 `lib/s3/config.js`

Reads and validates the environment exactly once.

```js
export function isS3Configured()   // all five required vars present
export function s3Config()         // frozen { endpoint, region, bucket, ttls, maxBytes, forcePathStyle }
```

`isS3Configured()` mirrors `isSupabaseConfigured()`: a missing env degrades to
"no storage" (`null`/`false`), it never crashes. Values are parsed once into a
frozen object so no call site re-parses `process.env`.

### 6.2 `lib/s3/client.js`

One `S3Client`, memoized on `globalThis` so Next's dev-mode module reloading
doesn't leak a new connection pool per HMR cycle.

```js
export function s3Client() // S3Client | null when unconfigured
```

Configured with `forcePathStyle`, the Appwrite endpoint, and a bounded retry
policy (`maxAttempts: 3`, adaptive backoff).

### 6.3 `lib/s3/keys.js`

**Keys are the contract.** They are immutable per version, which is what makes
`Cache-Control: immutable` safe and what makes rollback trivial.

```
p/<projectId>/a/<assetId>/v/<versionNumber>/<safeFilename>
p/<projectId>/a/<assetId>/derivatives/<variant>.<ext>     # reserved, unused
p/<projectId>/tmp/<uploadJobId>/<safeFilename>            # portal / pre-commit staging
```

```js
export function assetKey({ projectId, assetId, versionNumber, filename })
export function stagingKey({ projectId, uploadJobId, filename })
export function derivativeKey({ projectId, assetId, variant, ext })
export function parseKey(key)      // -> { projectId, assetId, versionNumber, filename } | null
export function safeFilename(name) // NFC, strip control/path chars, collapse spaces, cap 180 chars, preserve ext
```

Why this shape:

- The `projectId` prefix makes per-project deletion, quota accounting, and a
  future per-project bucket policy a prefix operation.
- The `versionNumber` segment means uploading v2 never overwrites v1 — version
  rollback is a metadata pointer change, not a data copy.
- `parseKey` lets any route re-derive ownership from a key alone, so an
  authorization check never has to trust a client-supplied `projectId`.
- `safeFilename` is the only place filename sanitation happens.

### 6.4 `lib/s3/cache.js`

A dependency-free TTL cache — a `Map` with per-entry expiry, an LRU cap, and
lazy eviction on read. Memoized on `globalThis` for the same HMR reason.

```js
export function cacheGet(key)
export function cacheSet(key, value, ttlMs)
export function cacheDelete(keyOrPrefix)  // prefix form invalidates a whole asset
export function cached(key, ttlMs, producer) // get-or-produce, single-flight
```

`cached()` **single-flights**: concurrent misses for the same key await one
in-flight promise rather than firing N identical signing calls. Rendering a grid
of 200 thumbnails on a cold cache produces 200 signatures, not 200 × N renders.

Namespaces: `sig:get:<key>` (signed GET URLs) and `head:<key>` (object metadata).

**Signed-URL TTL skew.** Entries are cached for `ttl - 300s`. A URL handed out
at the last moment of its cache lifetime still has five minutes of validity
left, so a slow page load never renders an already-expired image.

**Scope caveat, stated explicitly:** this cache is per-process and per-region. On
Vercel Fluid Compute, instance reuse makes it effective but not shared. It is a
cost optimization, never a correctness mechanism — nothing may depend on a hit.

### 6.5 `lib/s3/objects.js`

The verb surface. Every function returns `null`/`false`/`[]` on failure and
`console.error("[s3.<op>]", …)` — the same tri-state contract the Supabase data
layer uses, so screens branch identically.

```js
export async function putObject({ key, body, contentType, metadata, cacheControl })
export async function getObjectStream(key)     // { body, contentType, contentLength, etag } | null
export async function headObject(key)          // { size, etag, contentType, lastModified } | null  (cached)
export async function deleteObject(key)
export async function deleteObjectsByPrefix(prefix)  // asset/project teardown
export async function copyObject(fromKey, toKey)     // version promotion, duplicate-asset flow
export async function signGetUrl(key, { ttl, download, filename })  // cached + single-flighted
export async function signPutUrl(key, { ttl, contentType, maxBytes })
export async function listObjects(prefix, { limit, cursor })  // ops/reconciliation only — never for UI
```

Two deliberate constraints:

- **`signGetUrl` is the only way a URL is produced.** It caches, applies the skew,
  and supports `download: true` (adds `response-content-disposition: attachment`,
  which is a *separate cache key* from the inline variant).
- **`listObjects` is documented as ops-only.** Screens read Postgres. A comment
  in the file says so, because the failure mode — a library screen that LISTs a
  bucket — is slow, unpaginated, and unsortable, and it is exactly what someone
  will reach for.

### 6.6 `lib/s3/errors.js`

Normalizes SDK exceptions into a small closed set so callers never string-match
on AWS error names:

```js
{ code: "not_found" | "forbidden" | "conflict" | "too_large" | "network" | "unknown",
  message, retryable }
```

Route handlers map `code` → HTTP status. This is the one place AWS vocabulary is
allowed to leak in.

---

## 7. Database changes

New migration: `supabase/migrations/<ts>_asset_storage.sql`, idempotent, run via
`npm run db:push` (geiger-orm).

```sql
-- assets.assets: point a row at its bytes
alter table assets.assets
  add column if not exists storage_key       text,
  add column if not exists storage_bucket    text,
  add column if not exists storage_status    text not null default 'none',
  add column if not exists etag              text,
  add column if not exists checksum          text,          -- sha256, hex
  add column if not exists mime_type         text not null default '',
  add column if not exists original_filename text not null default '';

alter table assets.assets
  add constraint assets_storage_status_chk
  check (storage_status in ('none','pending','stored','failed','missing'));

-- fast duplicate detection (feeds the existing Duplicates screen)
create index if not exists assets_checksum_idx
  on assets.assets (project_id, checksum) where checksum is not null;
create unique index if not exists assets_storage_key_idx
  on assets.assets (storage_key) where storage_key is not null;

-- assets.asset_versions: every version owns its own immutable object
alter table assets.asset_versions
  add column if not exists storage_key text,
  add column if not exists etag        text,
  add column if not exists checksum    text,
  add column if not exists mime_type   text not null default '';

-- assets.upload_jobs: correlate a job with the object it is writing
alter table assets.upload_jobs
  add column if not exists storage_key text,
  add column if not exists upload_mode text not null default 'presigned';

alter table assets.upload_jobs
  add constraint upload_jobs_mode_chk check (upload_mode in ('presigned','proxy'));
```

`storage_status` is the reconciliation handle:

| Value | Meaning |
|---|---|
| `none` | Metadata-only row (all rows today). |
| `pending` | A presigned URL was issued; bytes not confirmed. |
| `stored` | `HeadObject` confirmed the object. Normal state. |
| `failed` | Upload errored or the commit check failed. |
| `missing` | Was `stored`, but a later `HeadObject` found nothing. Set by reconciliation only. |

`checksum` is the client-computed SHA-256, which does double duty: it verifies
the upload and it gives the existing **Duplicates** screen a real signal instead
of a heuristic.

---

## 8. Route handlers

Six handlers: five under `app/api/storage/*`, plus one stable per-asset URL under
`app/api/assets/[id]/file`. All six run on the Node runtime
(`export const runtime = "nodejs"`) — the AWS SDK needs it — and all six begin
with the same three checks: session via
`createServerSupabase()`, RBAC via the `assets.*` keys, and project ownership
re-derived from the key with `parseKey()` rather than trusted from the body.

### `POST /api/storage/upload-url` — issue a presigned PUT

Body: `{ assetId?, projectId, filename, contentType, sizeBytes, uploadJobId }`

1. Reject `sizeBytes > S3_MAX_UPLOAD_BYTES` or a `contentType` outside the
   allowlist → `413` / `415`.
2. Build the key (`assetKey` when `assetId` is known, else `stagingKey`).
3. `signPutUrl(key, { ttl: S3_UPLOAD_URL_TTL, contentType, maxBytes })`.
4. Upsert `upload_jobs` → `status: 'uploading'`, `storage_key`, `upload_mode: 'presigned'`.

Returns `{ url, key, mode: "presigned", expiresAt }`.

The presigned PUT is **signed with the exact `Content-Type` and a content-length
range**. A client that lies about either gets a signature mismatch from the
gateway — the size ceiling is enforced by the signature, not by client goodwill.

### `POST /api/storage/commit` — confirm and persist

Body: `{ uploadJobId, key, assetId?, checksum, name, type, folder, tags }`

1. `headObject(key)` — the object must exist. If not → mark the job `failed`,
   return `409`. **This is the trust boundary**: the DB row is written from what
   S3 reports (`size`, `etag`, `contentType`), not from what the client claims.
2. Insert or update `assets.assets` with `storage_key`, `storage_bucket`, `etag`,
   `checksum`, `mime_type`, `size_bytes`, `original_filename`,
   `storage_status: 'stored'`.
3. Append an `asset_versions` row (`version_number = max + 1`, `is_current = true`,
   previous current flipped to `false`).
4. Close the `upload_job` (`status: 'complete'`, `progress: 100`).
5. `updateTag("asset:" + assetId)` and `updateTag("assets:" + projectId)`.

Returns the normalized asset view model, so the screen can drop it straight into
its optimistic list.

### `POST /api/storage/upload` — proxy fallback

`multipart/form-data`. Streams the part to `putObject`, then runs the identical
commit logic. Used when presigned PUT is unavailable — the client falls back to
it automatically (§9). Documented ceiling: **4 MB**, under Vercel's request-body
limit, enforced server-side with a `413`.

### `POST /api/storage/sign` — batch signed GET URLs

Body: `{ keys: string[] }` (cap **100** per request).

Returns `{ urls: { [key]: string | null }, expiresAt }`. Every key is authorized
individually via `parseKey` → project membership; unauthorized or missing keys
come back `null` rather than failing the whole batch.

This is what a library grid calls once on mount instead of making N round-trips.
Response carries `Cache-Control: private, max-age=<ttl - 600>`.

### `GET /api/assets/[id]/file` — stable per-asset URL

Looks up the row, authorizes, signs, and `307`-redirects to the signed URL with
`Cache-Control: private, max-age=<ttl - 600>`. `?download=1` switches to the
attachment-disposition signature and increments `downloads`.

This exists so `<img src>` and `<a href>` work with a stable, shareable,
RBAC-checked URL and no client JavaScript. It costs one function invocation per
cold image; the batch-sign route is the optimization for grids. Both are
provided because they serve genuinely different call sites.

### `DELETE /api/storage/object`

Soft-deletes the row (`deleted_at`), leaves bytes in place. Actual object
deletion is deferred to the sweeper (§11) so an accidental delete stays
recoverable for the retention window.

---

## 9. Browser surface

### `lib/storage/client.js` (`"use client"`)

No credentials, no SDK — `fetch` only. Same tri-state return contract as the
Supabase data layer: `null`/`false` on failure, never throws, never toasts.

```js
export async function uploadAsset(file, { projectId, assetId, folder, tags, onProgress, signal })
export function assetFileUrl(assetId, { download } = {})   // sync -> /api/assets/<id>/file
export async function signAssetUrls(keys)                  // batch -> { key: url }
export async function deleteAssetFile(assetId)
```

`uploadAsset` is the whole upload state machine in one call:

1. `crypto.randomUUID()` for the job id (matches the optimistic-row convention).
2. Compute SHA-256 via `crypto.subtle.digest` while reading the file.
3. `POST /upload-url`.
4. `PUT` the file to the presigned URL via `XMLHttpRequest` — **not** `fetch`,
   because only XHR exposes `upload.onprogress`, and a real progress bar is the
   point of going direct.
5. **Fallback:** on a network error, CORS failure, or non-2xx from the presigned
   PUT, and when `file.size <= 4 MB`, retry once through
   `POST /api/storage/upload`. Larger files surface the error instead of silently
   failing against the proxy's body cap.
6. `POST /commit` → returns the persisted asset.

`onProgress(0..100)` fires throughout; `signal` supports cancellation, which
aborts the XHR and marks the job `cancelled`.

### `lib/hooks/use-asset-upload.js`

Thin React wrapper for screens:

```js
const { upload, uploads, cancel, retry } = useAssetUpload({ projectId });
```

Holds a `Map` of in-flight uploads keyed by job id, exposes
`{ id, filename, progress, status, error }` per entry, and caps concurrency at
**3** simultaneous uploads with the rest queued. Sonner toasts stay in the
screen, per convention — the hook returns state, not UX.

---

## 10. Caching — the four layers

Each layer solves a different problem; none is load-bearing for correctness.

**1. Signed-URL memo cache** (`lib/s3/cache.js`). Signing is pure CPU + HMAC, but
at 200 thumbnails × every re-render it is measurable. Keyed
`sig:get:<key>:<disposition>`, TTL `S3_SIGNED_URL_TTL - 300s`, single-flighted.
Invalidated by prefix on delete or version change.

**2. HTTP cache headers.** Because keys are immutable per version, objects can be
uploaded with `Cache-Control: public, max-age=31536000, immutable` — the object
at a given key never changes, so a browser or CDN may hold it forever. The
*signed URL* still expires, which is what preserves access control; the cached
*bytes* stay valid. Route handlers return `private, max-age=<ttl - 600>` on
redirects and batch-sign responses, and honor `If-None-Match` against the S3
ETag on the proxy path (`304`, no body).

**3. Next 16 `use cache` + `cacheTag`.** Server-side metadata reads
(`getAssetWithStorage`, project asset counts, storage totals) are wrapped:

```js
async function getAssetWithStorage(id) {
  "use cache";
  cacheLife("minutes");
  cacheTag(`asset:${id}`);
  …
}
```

Writes call `updateTag("asset:<id>")` / `updateTag("assets:<projectId>")` so a
commit or delete invalidates precisely, with no blanket revalidation. This is
the only layer that survives across requests and instances.

**4. Postgres as the listing index.** `assets.assets` is the source of truth for
*what exists*; S3 holds only bytes. Every list, filter, search, sort, and count
is an indexed SQL query. **No screen ever calls `listObjects`.** `listObjects`
exists solely for the reconciliation job. The indexes added in §7 keep checksum
lookups (duplicates) and storage-key lookups (reconciliation) off sequential
scans.

---

## 11. Consistency, failure, and reconciliation

Two stores, no distributed transaction — so the design makes one side
authoritative and sweeps the difference.

**Failure modes and their handling:**

| Failure | Result | Handling |
|---|---|---|
| Presign issued, upload never happens | Orphan `upload_job` in `uploading` | Sweeper marks it `failed` after 24 h. No object exists; nothing to clean. |
| Upload succeeds, commit never runs | Orphan object, no row | Sweeper deletes objects under `tmp/` older than 24 h with no matching row. |
| Commit runs, object absent | — | `headObject` fails ⇒ `409`, job `failed`, no row written. The commit check makes this the *only* ordering that can produce a bad row. |
| Row `stored`, object later gone | Broken thumbnail | Reconciliation sets `storage_status: 'missing'`; the UI renders a placeholder rather than a broken image. |
| Row soft-deleted | Bytes retained | Sweeper hard-deletes objects for rows soft-deleted > 30 days ago. |

**Ordering rule:** bytes first, row second. A row is only written after
`headObject` confirms the object. An orphan object is cheap and reclaimable; an
asset row pointing at nothing is a user-visible bug.

**`scripts/s3-reconcile.js`** (`npm run s3:reconcile`) — an operator script, not
a cron. Two passes: rows whose objects are missing → `storage_status: 'missing'`;
objects under `tmp/` with no owning row and age > 24 h → deleted. `--dry-run` by
default; `--apply` to act.

---

## 12. Security

- **Secret never crosses the network boundary.** `S3_SECRET_ACCESS_KEY` is read
  only inside `lib/s3/config.js`, which throws if imported in a browser bundle.
  No `NEXT_PUBLIC_` storage variable exists.
- **Authorization is re-derived, never trusted.** Every route parses the
  `projectId` out of the key with `parseKey()` and checks membership against it.
  A client that submits someone else's key gets a `403`, because the key itself
  is what is authorized.
- **Signed PUTs are narrow.** Bound to one exact key, one content type, a
  content-length range, and a 15-minute window. They cannot be replayed against
  a different key.
- **Content-type allowlist** in `lib/s3/config.js`, mapped to the existing
  `assets_type_chk` values (`image`/`video`/`audio`/`document`/`3d`/`raw`/`pdf`/
  `archive`). Anything else is `415`.
- **Uploads are stored with `Content-Disposition: attachment`** for non-media
  types, so a user-uploaded `.html` or `.svg` cannot execute in the app's origin.
- **RBAC gates:** `assets.asset.edit` for upload/commit, `assets.asset.delete`
  for delete. Note these are advisory in the existing codebase — the route
  handlers make them enforced for storage, which is a genuine improvement over
  the UI-only gating elsewhere.
- **Bucket stays private.** No public-read policy at any point.

---

## 13. Files

**New — portable core (server-only):**

| File | Purpose |
|---|---|
| `lib/s3/config.js` | Env parse + `isS3Configured()` |
| `lib/s3/client.js` | Memoized `S3Client` |
| `lib/s3/keys.js` | Key build/parse/sanitize |
| `lib/s3/cache.js` | TTL + single-flight cache |
| `lib/s3/objects.js` | put/get/head/delete/copy/sign/list |
| `lib/s3/errors.js` | Normalized error codes |
| `lib/s3/index.js` | Barrel export |

**New — bound service & browser surface:**

| File | Purpose |
|---|---|
| `lib/storage/service.js` | S3 ⨯ `assets` schema composition (server) |
| `lib/storage/client.js` | `"use client"` fetch wrapper |
| `lib/hooks/use-asset-upload.js` | Upload state, progress, queue |

**New — routes:** `app/api/storage/upload-url/route.js`,
`app/api/storage/commit/route.js`, `app/api/storage/upload/route.js`,
`app/api/storage/sign/route.js`, `app/api/storage/object/route.js`,
`app/api/assets/[id]/file/route.js`

**New — ops:** `supabase/migrations/<ts>_asset_storage.sql`,
`scripts/s3-check.js`, `scripts/s3-reconcile.js`, `.env.example`

**Modified:** `lib/supabase/assets.js` (normalize/toRow gain the storage
fields), `lib/supabase/uploads.js` (`storageKey`, `uploadMode`), `package.json`
(`s3:check`, `s3:reconcile` scripts), `.env.local`

**Already installed:** `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`.

---

## 14. Build order

1. **Core + verification.** `lib/s3/*`, `.env.local`, `scripts/s3-check.js`.
   Prove credentials, path-style addressing, and a presigned round-trip work
   against Appwrite **before** anything depends on them. This is the step that
   de-risks the rest — Appwrite's S3 gateway is not AWS, and presign behavior is
   the specific unknown.
2. **Migration.** Storage columns + indexes; `npm run db:push`.
3. **Service + routes.** `lib/storage/service.js`, then the six handlers.
4. **Browser surface.** `lib/storage/client.js`, `use-asset-upload.js`.
5. **Screen wiring.** Upload Center → real uploads; Library thumbnails → batch
   sign; asset detail → download + version upload.
6. **Ops.** `s3-reconcile.js`, `.env.example`, README section.

Steps 1–2 are independently verifiable and gate everything after them.

## 15. Verification

- `npm run s3:check` round-trips an object (put → head → sign → GET → delete).
- Upload a >4 MB file: confirms presigned direct upload and a real progress bar.
- Kill the presigned path (bad endpoint) with a 1 MB file: confirms proxy fallback.
- Commit with a bogus key: expect `409`, job `failed`, **no** asset row.
- Request another project's key from `/api/storage/sign`: expect `null` for that key.
- Let a signed URL expire, reload: expect a fresh URL, not a 403 image.
- `npx eslint` clean on every changed file.

---

## 16. Risks

| Risk | Mitigation |
|---|---|
| **Appwrite may not honor presigned PUTs**, or may not send permissive CORS | Step 1 tests this first; the proxy fallback already exists as the designed answer. If presign is unusable, the fallback becomes the primary path and the only cost is the 4 MB ceiling. |
| Appwrite S3 API coverage gaps (`CopyObject`, prefix `ListObjectsV2`) | Only `copyObject` (version promotion) and reconciliation depend on them. `s3-check.js` probes both; a missing `CopyObject` degrades to download-and-re-put. |
| Signed-URL churn on large grids | Batch sign (100/request) + memo cache + `max-age` on the response. |
| Per-process cache is not shared | Documented as an optimization only; `use cache` + `cacheTag` covers cross-request needs. |
