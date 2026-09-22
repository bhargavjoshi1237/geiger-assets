# geiger-assets → Storage Pool Integration

**Date:** 2026-09-21
**Status:** Approved, ready to implement
**Repos touched:** `geiger-dash` (Phase A), `geiger-assets` (Phases B–D)
**Prerequisite spec:** `geiger-dash/docs/superpowers/specs/2026-09-21-admin-storage-pool-design.md`

Move geiger-assets' **placement decision** to the geiger-dash storage pool, so the
DAM stops being capped at one S3 bucket and gains multi-provider capacity,
spill-to-next, and CDN routing. geiger-assets keeps everything that makes it a
DAM: its asset/version model, key layout, image transforms, renditions, signed
delivery, delivery logging, ZIP export, and per-project authorization.

---

## 0. Read this first

**This is not a rewrite of `lib/storage`.** It inserts a backend seam underneath
it. If you find yourself editing `commitUpload`'s asset/version bookkeeping, the
delivery routes' transform logic, or `lib/s3/keys.js`, stop — you have gone too
far.

### The three rules

1. **Keys stay geiger-assets'.** `assetKey()` / `stagingKey()` /
   `derivativeKey()` keep producing exactly the strings they produce today. That
   string becomes the pool's **logical path**. `parseKey()` and `authorizeKey()`
   must keep working unchanged.
2. **Backend is resolved per object, never globally.** An asset stored on local
   S3 last week must still read from local S3 after this ships. The write-side
   default is configurable; the read side always follows what that row says.
   A big-bang cutover is explicitly forbidden.
3. **geiger-assets still authorizes.** Project access checks
   (`requireProjectAccess`, `authorizeKey`) run before any pool call, exactly as
   they do now. The pool API key is server-side only and is never sent to a
   browser.

---

## 1. Current state (verified, 2026-09-21)

### geiger-assets storage layer

| File | Role |
|---|---|
| `lib/s3/config.js` | Env-driven single bucket: `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, plus `maxUploadBytes` (default 500 MB), `uploadUrlTtl`, `signedUrlTtl`, `presignedUploads`, `presignedReads`. Also `isAllowedContentType()`, `assetTypeForContentType()`. |
| `lib/s3/keys.js` | `assetKey` → `p/{projectId}/a/{assetId}/v/{n}/{filename}`; `stagingKey` → `p/{projectId}/tmp/{jobId}/{filename}`; `derivativeKey` → `p/{projectId}/a/{assetId}/derivatives/{variant}.{ext}`; `parseKey`, `safeFilename`. |
| `lib/s3/objects.js` | `putObject`, `getObjectStream`, `headObject`, `statObject`, `deleteObject`, `deleteObjectsByPrefix`, `copyObject`, `signGetUrl`, `signPutUrl`, `listObjects`, `invalidateAssetCache`. |
| `lib/storage/service.js` (493 lines) | `issueUploadUrl` (presigned or proxy), `proxyStore` (optimize → put → commit), `commitUpload` (head → asset row + `asset_versions`), `markJob`, `authorizeKey`, `PROXY_MAX_BYTES` = 4 MB. |
| `lib/storage/client.js` (317 lines) | Browser side: currently a plain `PUT` to a presigned URL, or a `POST` to the proxy route. |
| `app/api/storage/*` | `upload` (proxy), `upload-url` (presign), `commit`, `file`, `object`, `sign`, `remote`. |

### Every consumer of byte-level S3 access outside `lib/s3/`

This is the complete blast radius. There are five.

| Call site | Uses |
|---|---|
| `lib/storage/service.js` | `headObject`, `putObject`, `getObjectStream`, `signGetUrl`, `signPutUrl` |
| `app/api/assets/[id]/file/route.js` | `signGetUrl` |
| `app/api/v1/assets/[id]/download/route.js` | `signGetUrl` |
| `app/api/export/zip/route.js` | `headObject`, `getObjectStream` |
| `app/d/[projectId]/[assetId]/[...rest]/route.js` | `getObjectStream`, `headObject`, `putObject`, `signGetUrl` (delivery, derivatives, overlays) |

`lib/s3/index.js` re-exports the helpers; leave it alone.

### geiger-dash pool API (already built and migrated)

- `POST /api/storage/upload` → `{ uploadId, mode, ticket, commitUrl, expiresAt, file, provider }`.
  Body: `{ path, size, mimeType, require[], overwrite }`. `?direct=1` with
  `multipart/form-data` does reserve→transfer→commit in one call (≤4.5 MB).
- `POST /api/storage/commit` → the **file map**:
  `{ id, path, name, namespace, size, mimeType, status, url, directUrl, placement{provider,driver,key,cdn}, createdAt }`.
  Body: `{ uploadId, parts[], response, providerKey }`.
- `GET /api/storage/f/<id>` → 302 to the current placement (signed when private). Public.
- `DELETE /api/storage/f/<id>` → soft-delete + release bytes. Needs `delete` scope.
- `GET /api/storage/list?path=` → immediate children of one folder.
- `POST /api/storage/folder` → create a folder node.
- Auth: `Authorization: Bearer gs_live_…`, scoped to exactly one namespace.
- Ticket modes: `form-post`, `presigned-put`, `multipart`, `proxy`.
  Reference client runner: `geiger-dash/lib/filestore/client-upload.js`.

---

## 2. Phase A — extend the dash pool API

**Repo: `geiger-dash`.** These are genuine gaps; geiger-assets cannot be
integrated without them. Each follows the existing route conventions
(`runtime = "nodejs"`, `dynamic = "force-dynamic"`, `authorize(request, scope)`
from `lib/filestore/auth.js`, namespace-scoped).

### A1. `GET /api/storage/stat`

`app/api/storage/stat/route.js`. Scope: `read`.

Query: **either** `id=<node uuid>` **or** `path=</logical/path>` (resolved
within the caller's namespace).

```json
{ "id": "…", "path": "/p/…/v/1/cat.png", "size": 27796904,
  "mimeType": "image/png", "etag": "\"abc\"", "status": "ready",
  "url": "https://dash…/api/storage/f/<id>",
  "directUrl": "https://ucarecdn.com/<uuid>/",
  "placement": { "provider": "…", "driver": "rest", "key": "…", "cdn": true } }
```

404 when absent. This is what replaces `headObject(key)` — it is the single most
important addition, because `commitUpload` and the delivery routes both depend
on an authoritative size/mime lookup.

### A2. `GET /api/storage/read`

`app/api/storage/read/route.js`. Scope: `read`. Query: `id=` or `path=`.

Streams the object's **bytes** back through dash rather than redirecting.
**Must forward the `Range` request header** to the provider and pass through
`Content-Range`, `Content-Length`, `Content-Type`, `ETag`, `Accept-Ranges`, and
the upstream status (200 or 206).

This exists because ZIP export and server-side derivative generation need bytes
in the function, and because `<video>` scrubbing needs range requests. Callers
that only need a browsable link keep using `/api/storage/f/<id>`.

### A3. `DELETE /api/storage/tree`

`app/api/storage/tree/route.js`. Scope: `delete`. Body: `{ "prefix": "/p/<id>/a/<id>" }`.

Soft-deletes every node at or below the prefix, removes each object from its
provider, and releases the bytes. Reuse `listSubtree()` in
`lib/filestore/nodes.js` and `deleteFile()` in `lib/filestore/uploads.js`.
Returns `{ deleted: <count>, bytes: <released> }`. Cap at 1000 nodes per call and
return a `truncated: true` flag so the caller can loop.

This replaces `deleteObjectsByPrefix`, which geiger-assets uses to purge an asset
or a project.

### A4. `GET /api/storage/list` — add recursive mode

Extend the existing route with `?recursive=1&cursor=&limit=` returning every
descendant, paged. Keep the current single-folder behaviour as the default so
nothing that calls it today changes.

### A5. Acceptance for Phase A

- `npx eslint app/api/storage lib/filestore` clean.
- `npm run build` clean.
- Each new route returns 401 without a key, 403 with a key lacking the scope,
  and 404 for a path in another namespace.
- `curl -H "Range: bytes=0-99"` against `/api/storage/read` returns **206** with
  a correct `Content-Range`.

---

## 3. Phase B — the backend seam in geiger-assets

**Repo: `geiger-assets`.** Create `lib/storage/backends/`:

```
lib/storage/backends/index.js      resolver + shared types
lib/storage/backends/local-s3.js   today's behaviour, extracted verbatim
lib/storage/backends/pool.js       the dash pool
```

### B1. The backend interface

Every backend implements exactly this. Signatures mirror today's `lib/s3/objects`
so the extraction is mechanical.

```js
{
  id,                                   // "s3" | "pool"
  isConfigured(),                       // boolean
  head(ref),                            // -> { size, etag, contentType } | null
  put({ key, body, contentType, contentDisposition }),   // -> { etag, ref } | null
  getStream(ref, { range }),            // -> { stream, size, contentType, etag, status, contentRange } | null
  signRead(ref, { ttl, download, filename }),            // -> url string | null
  issueUpload({ key, contentType, sizeBytes }),          // -> { mode, ticket, uploadRef } | { error }
  finalizeUpload({ uploadRef, parts, response, providerKey }), // -> { size, etag, contentType, ref } | { error }
  remove(ref),                          // -> boolean
  removeByPrefix(prefix),               // -> { deleted } | null
}
```

**`ref`** is the backend-specific locator, persisted per object:

- local S3 → `{ backend: "s3", key }`
- pool → `{ backend: "pool", key, fileId, directUrl }`

`key` is present in **both** so `parseKey()`/`authorizeKey()` keep working
verbatim. That is the whole trick — do not drop it.

### B2. `local-s3.js`

A thin adapter over the existing `lib/s3/objects.js`. **Move no logic**; it is
the reference behaviour and must remain byte-for-byte equivalent. `issueUpload`
returns today's two shapes: `{ mode: "presigned", ticket: { url } }` or
`{ mode: "proxy" }`. `finalizeUpload` is `headObject(key)`.

### B3. `pool.js`

Server-only (`if (typeof window !== "undefined") throw`). Config from env:

```
GEIGER_STORAGE_API_URL=https://dash.geiger.../    # dash origin
GEIGER_STORAGE_API_KEY=gs_live_…                  # namespace-scoped, server-only
```

Mapping:

| Interface method | Pool call |
|---|---|
| `head(ref)` | `GET /api/storage/stat?id=<fileId>` (fall back to `?path=<key>`) |
| `put(...)` | `POST /api/storage/upload?direct=1` (multipart form) — used by `proxyStore` and derivative writes |
| `getStream(ref, {range})` | `GET /api/storage/read?id=…` with the `Range` header forwarded |
| `signRead(ref)` | return `${API_URL}/api/storage/f/${fileId}` — already stable and handles private objects |
| `issueUpload(...)` | `POST /api/storage/upload` with `{ path: key, size, mimeType }` → returns the pool ticket **verbatim** plus `uploadRef = { uploadId }` |
| `finalizeUpload(...)` | `POST /api/storage/commit` → map the file map to `{ size, etag: null, contentType: mimeType, ref: { backend:"pool", key, fileId: id, directUrl } }` |
| `remove(ref)` | `DELETE /api/storage/f/<fileId>` |
| `removeByPrefix(prefix)` | `DELETE /api/storage/tree` (loop while `truncated`) |

**Error mapping** — the pool's codes must surface as geiger-assets' existing
vocabulary so callers and the UI need no changes:

| Pool | geiger-assets |
|---|---|
| `507` `pool_full` / `no_capability` | `storage_full` (new; treat like `too_large` in the UI) |
| `413` `object_too_large` | `too_large` |
| `409` `invalid_path` | `bad_request` |
| `401`/`403` | `storage_unconfigured` + `console.error` (it is a misconfiguration, not a user error) |

### B4. The resolver — `backends/index.js`

```js
// Writes use the configured default; reads ALWAYS follow the row.
export function writeBackend() { /* ASSETS_STORAGE_BACKEND, default "s3" */ }
export function backendForRef(ref) { /* ref.backend, default "s3" */ }
export function refFromAssetRow(row) {
  // pool_file_id present -> { backend:"pool", key: row.storage_key,
  //                           fileId: row.pool_file_id, directUrl: row.pool_url }
  // otherwise             -> { backend:"s3", key: row.storage_key }
}
```

`refFromAssetRow` is the safety net for the whole migration: a row written
before this ships has no `pool_file_id`, so it resolves to S3 forever unless
deliberately migrated.

---

## 4. Phase C — wire the seam in

### C1. Migration (geiger-assets)

Scaffold with `npm run db:new -- asset_pool_placement --template raw`. Schema is
`assets`. All statements idempotent, with a mirrored `@down`.

```sql
alter table assets.assets        add column if not exists pool_file_id uuid;
alter table assets.assets        add column if not exists pool_url text;
alter table assets.asset_versions add column if not exists pool_file_id uuid;
alter table assets.asset_versions add column if not exists pool_url text;
alter table assets.upload_jobs   add column if not exists pool_upload_id uuid;
alter table assets.upload_jobs   add column if not exists pool_file_id uuid;

create index if not exists assets_pool_file_idx
  on assets.assets (pool_file_id) where pool_file_id is not null;
```

`upload_jobs.pool_upload_id` is load-bearing: the browser uploads between
`issueUploadUrl` and `commitUpload`, so the pool ticket id must survive on the
job row or the commit cannot be tied back to its reservation.

`storage_bucket` keeps recording provenance — write `pool:<provider name>` for
pooled objects so it stays human-readable in the DB.

### C2. `lib/storage/service.js`

Surgical edits only.

- `isStorageConfigured()` → true if **either** backend is configured.
- `issueUploadUrl(...)`: after computing `key` (unchanged), call
  `writeBackend().issueUpload(...)`. Persist `pool_upload_id` on the job via
  `upsertUploadJob`. Return the backend's mode/ticket to the caller. Keep the
  existing size/content-type guards ahead of it.
- `commitUpload(...)`: replace the bare `headObject(key)` with
  `backend.finalizeUpload({ uploadRef: { uploadId: job.pool_upload_id }, … })`
  for pool jobs, `head(ref)` for S3 jobs. **Everything downstream — the asset
  row, `asset_versions`, `markJob`, `invalidateAssetCache`, `safeUpdateTag` — is
  untouched**, except that the pooled path also writes `pool_file_id` / `pool_url`
  onto both the asset row and the version row.
- `proxyStore(...)`: image optimization stays exactly where it is (it runs before
  the store). Swap `putObject` for `backend.put`.
- `authorizeKey`, `getAssetRow`, `getAssetWithStorage`, `markJob`,
  `nextVersionKey`: **unchanged**.

### C3. The four other call sites

Each resolves a `ref` from the asset row and calls the backend instead of
`lib/s3/objects` directly:

- `app/api/assets/[id]/file/route.js` → `backend.signRead(ref, { download, filename })`
- `app/api/v1/assets/[id]/download/route.js` → same
- `app/api/export/zip/route.js` → `backend.head(ref)` / `backend.getStream(ref)`
- `app/d/[projectId]/[assetId]/[...rest]/route.js` → `getStream` / `head` /
  `put` / `signRead`. This is the delicate one: it generates and caches
  derivatives and composites overlays. Derivative writes must use
  `writeBackend()` and store their own ref; the original is read via
  `backendForRef`.

### C4. Browser ticket runner

`lib/storage/client.js` currently PUTs to a presigned URL. Pool tickets have four
modes. Add `lib/storage/ticket.js` — port
`geiger-dash/lib/filestore/client-upload.js` (it is dependency-free) — and have
`client.js` dispatch on `mode`, keeping its existing presigned and proxy paths
for the S3 backend.

Do **not** create a shared npm package for this right now; a 90-line copy is the
right call while both trees are moving.

### C5. Env

```
ASSETS_STORAGE_BACKEND=s3          # s3 (default) | pool — write side only
GEIGER_STORAGE_API_URL=
GEIGER_STORAGE_API_KEY=
```

Add all three to `.env.example` with comments. `GEIGER_STORAGE_API_KEY` is
server-only and must never be prefixed `NEXT_PUBLIC_`.

---

## 5. Phase D — rollout

1. Ship with `ASSETS_STORAGE_BACKEND=s3`. Nothing changes; the seam is inert.
   **This is the state the PR should be merged in.**
2. In dash: create the `geiger-assets` namespace, mint a key with
   `read,write,delete`, add at least one provider and qualify it with a probe.
3. Flip a staging environment to `pool`. Upload, read, scrub a video, download,
   ZIP-export, delete.
4. Flip production. Old assets keep reading from S3 via `refFromAssetRow`; new
   ones land in the pool.
5. Backfilling existing objects into the pool is **out of scope** — a separate
   spec, if it is ever wanted.

---

## 6. Non-goals

- Rewriting the asset/version/folder model, or using the pool's `nodes` tree as
  geiger-assets' hierarchy. It keeps its own.
- Moving image transforms, renditions, delivery logging or ZIP export into dash.
- Backfilling or migrating existing S3 objects.
- Removing `lib/s3/*`. It stays as the `local-s3` backend.
- Per-project namespaces in the pool. One namespace, `geiger-assets`; project
  isolation stays geiger-assets' job and is already enforced.

---

## 7. Acceptance criteria

Both backends must pass identically with `ASSETS_STORAGE_BACKEND` flipped:

- [ ] Upload a 2 MB image via the proxy path → asset row + `asset_versions` row
      created, correct `size_bytes`/`mime_type`, thumbnail renders.
- [ ] Upload a 200 MB video via the ticket path → completes, `upload_jobs` hits
      `completed` at progress 100.
- [ ] Scrub that video in the player → the delivery route returns **206** with a
      valid `Content-Range`.
- [ ] Request a derivative (resize) → generated, cached, second request is a hit.
- [ ] ZIP-export a folder → archive opens, every entry has correct bytes.
- [ ] Download via `/api/assets/<id>/file` and `/api/v1/assets/<id>/download`.
- [ ] Delete an asset → object gone from the provider; in pool mode the dash
      Overview's used-bytes drops by that file's size.
- [ ] A pre-existing S3 asset still reads correctly **while** the write backend
      is `pool` (this is rule 2 — test it explicitly).
- [ ] Pool returns 507 → UI shows a storage-full error, no half-created asset row.
- [ ] `npx eslint` clean in both repos; `npm run build` clean in both.

---

## 8. Risks

- **Uncommitted work.** `geiger-assets` had ~183 modified files at the time of
  writing. **Commit or stash that tree before starting.** Do not begin this on a
  dirty tree.
- **Range support.** `/api/storage/read` must forward `Range` or video playback
  breaks. S3 and the Uploadcare CDN both honour it; a custom REST provider may
  not — verify per provider.
- **Latency.** Pooled reads add a dash hop. Use `signRead` (the 302 gateway) for
  anything a browser fetches directly, and reserve `/api/storage/read` for
  server-side byte access. Getting this backwards will make the DAM feel slow.
- **CORS.** Ticket uploads go browser → provider. S3/R2 buckets need a CORS rule
  allowing PUT from the geiger-assets origin; the dash provider probe reports
  this as a warning.
- **Double accounting.** Only pooled objects appear in the pool ledger. Do not
  register the same S3 bucket as a dash provider *and* keep using it as
  geiger-assets' local backend, or its bytes will be counted twice.
- **Two commit paths.** Until the flip, `commitUpload` serves both backends. Keep
  the branch at the top and shared bookkeeping below it — do not fork the
  function.
