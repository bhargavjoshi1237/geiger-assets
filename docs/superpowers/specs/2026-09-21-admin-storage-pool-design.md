# Storage Pool — `/admin/storage`

**Date:** 2026-09-21
**Status:** Approved, implementing

A suite-wide storage pool for geiger-dash. Dash already plays "mother project"
for email (templates, sending, cross-app API keys); this does the same for
files. Other suite apps stop bundling their own storage stack and upload
through one API against a pool of heterogeneous providers.

---

## 1. Goals

- One **pool** aggregating many storage providers (S3-compatible, generic REST,
  Supabase Storage, Vercel Blob) into a single declared capacity.
- A **virtual file tree** per consumer that is completely decoupled from where
  the bytes physically sit. A user sees `/covers/2026/cat.png`; the bytes may be
  on Uploadcare, R2, or Supabase depending on how full the pool was that day.
- Uploads of **any size** without routing bytes through our functions
  (Vercel caps request bodies at ~4.5 MB).
- Every upload returns a **file map**: logical path, stable link, raw CDN link,
  and the physical placement.
- An admin surface with real **dashboard/stats**, provider management, a file
  browser, placement rules, API keys, and an activity log.

### Non-goals (v1)

- Per-organization pools or quotas. One suite-wide pool; objects are *tagged*
  with the consumer namespace for reporting.
- Automatic background rebalancing. Migration is a manual, per-file admin action.
- Image transformation / thumbnailing. Providers that offer it (Uploadcare) can
  be used directly via `directUrl`.
- Scheduled health checks. Probes are on-save and on-demand only.

---

## 2. Naming and placement

| Concern | Location |
|---|---|
| Postgres schema | **`filestore`** |
| Migration | `supabase/migrations/<ts>_filestore.sql` |
| Data layer | `lib/filestore/` |
| Drivers | `lib/filestore/drivers/` |
| Public API | `app/api/storage/` |
| Admin page | `app/admin/storage/page.js` |
| Admin UI | `components/admin/storage/` |

The schema is **`filestore`, not `storage`** — Supabase already owns a `storage`
schema (`storage.objects`, `storage.buckets`) in this same project.

Like the `email` schema, `filestore` must be added under
**Supabase → Settings → API → Exposed schemas** or PostgREST will not serve it.
This is a manual one-time dashboard step.

### Environment

```
STORAGE_SECRET_KEY   # 32-byte base64 key, AES-256-GCM for provider secrets
```

Existing `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` back the
service client, exactly as `lib/email/service.js` does.

---

## 3. Data model

Eight tables in `filestore`. Standard columns throughout: `id uuid primary key
default gen_random_uuid()`, `metadata jsonb not null default '{}'::jsonb`,
`created_at`, `updated_at`, and `deleted_at` for soft delete where rows are
user-visible.

### 3.1 `providers` — members of the pool

| Column | Notes |
|---|---|
| `name` | display name |
| `driver` | `s3` \| `rest` \| `supabase` \| `vercel_blob` |
| `status` | `unverified` \| `active` \| `readonly` \| `draining` \| `error` \| `disabled` |
| `priority` | int, ascending = filled first |
| `capacity_bytes` | admin-declared ceiling; `0` = unlimited |
| `used_bytes` | ledger, maintained by reserve/commit RPCs |
| `object_count` | ledger |
| `config` | jsonb, non-secret driver config |
| `secrets` | jsonb, AES-256-GCM envelope `{v, iv, tag, data}` |
| `capabilities` | jsonb `{cdn, publicRead, presign, multipart, maxObjectSize, mimeAllow[]}` |
| `public_url_template` | e.g. `https://ucarecdn.com/{key}/` |
| `last_probe_at`, `last_probe_ok`, `last_probe_error` | qualification state |

New providers start `unverified` and only reach `active` by passing a probe.

### 3.2 `namespaces` — one root per consumer

`key` (slug, unique), `name`, `project`, `quota_bytes`, `used_bytes`,
`object_count`. An API key is scoped to exactly one namespace.

### 3.3 `nodes` — the virtual tree

`namespace_id`, `parent_id` (self FK; null = root), `kind` (`folder` | `file`),
`name`, `path` (materialized, e.g. `/covers/2026/cat.png`), `size_bytes`,
`mime_type`, `checksum`, `status` (`pending` | `ready` | `failed`), `metadata`,
`created_by`, timestamps, `deleted_at`.

- Unique `(namespace_id, path)` where `deleted_at is null`.
- **Folders exist only here.** No provider is ever asked to create a directory.

### 3.4 `placements` — where the bytes actually are

`node_id`, `provider_id`, `provider_key` (Uploadcare uuid, S3 object key),
`provider_url` (raw public/CDN URL), `size_bytes`, `etag`,
`state` (`reserved` | `committed` | `orphaned` | `migrating`), `is_current`.

Keeping this separate from `nodes` is the heart of the design: it is the "map
location" of a file, and it makes provider migration a data change
(write new placement → flip `is_current` → drop old) rather than a rename.

### 3.5 `rules` — placement overrides

`name`, `priority`, `enabled`, `match` jsonb
(`{mimePrefix, minSize, maxSize, namespaceKey, requiresCapability[]}`),
`target` jsonb (`{providerId}` or `{requireCapabilities: ["cdn"]}`).

### 3.6 `api_keys`

Mirrors `email.api_keys`: `name`, `project`, `prefix`, `key_hash` (SHA-256 of
the plaintext, which is shown exactly once), `namespace_id`, `scopes`
(`read`/`write`/`delete`), `active`, `last_used_at`. **No RLS policy** — secrets
stay service-role only.

### 3.7 `uploads` — in-flight tickets

`namespace_id`, `node_id`, `provider_id`, `placement_id`, `mode`,
`reserved_bytes`, `ticket` jsonb, `driver_state` jsonb (e.g. Uploadcare's
multipart uuid), `state` (`open` | `committed` | `aborted` | `expired`),
`expires_at`. Without this row a commit cannot be tied to a real reservation.

### 3.8 `events` — append-only log

`type` (`upload` | `delete` | `migrate` | `probe` | `reconcile` | `error`),
`node_id`, `provider_id`, `api_key_id`, `bytes`, `detail` jsonb, `created_at`.

### 3.9 RPCs

- `filestore.reserve_bytes(p_provider uuid, p_bytes bigint)` — atomically
  increments `used_bytes` **only if** headroom allows; returns bool. Prevents
  concurrent uploads oversubscribing a provider.
- `filestore.release_bytes(p_provider uuid, p_bytes bigint)` — on abort/expiry.
- `filestore.settle_bytes(p_provider uuid, p_reserved bigint, p_actual bigint)`
  — commit-time correction when the provider reports a different size.
- `filestore.reconcile_provider(p_provider uuid)` — re-sums committed placements
  into `used_bytes` / `object_count` and returns the drift.

---

## 4. Placement engine (`lib/filestore/placement.js`)

`resolveProvider({ size, mime, namespaceKey, require: ["cdn"] })`:

1. **Candidates** — `status = 'active'`, headroom ≥ `size` (or unlimited),
   `size ≤ capabilities.maxObjectSize`, mime permitted by `mimeAllow`, and
   possessing **every** capability in `require`. A request tagged
   `require: ["cdn"]` therefore never even sees a non-CDN provider.
2. **Rules** in `priority` order — the first match either pins one provider or
   narrows the candidate set by capability.
3. **Fill then spill** — sort survivors by `priority` ascending, take the first
   with room.
4. **No candidate** → `507 Insufficient Storage` naming the specific reason
   (out of space / no CDN-capable provider / file exceeds every provider's
   max object size). Never a silent failure.

**Reserve-then-commit.** Because bytes go straight to the provider, the server
debits `used_bytes` via `reserve_bytes` *before* issuing the ticket and settles
the true size on commit. Expired `uploads` rows are swept (release + orphan the
placement) by the reconciliation action.

---

## 5. Driver interface (`lib/filestore/drivers/`)

```js
{
  id, label,
  configFields,        // [{ key, label, type, required, placeholder }]
  secretFields,        // same shape; never round-tripped to the client
  defaultCapabilities,
  probe(ctx),                       // write → read back → delete a tiny file
  createTicket(ctx, { key, size, mime, filename }),
  commit(ctx, { ticket, driverState, parts }),   // → { key, url, size, etag }
  remove(ctx, { key }),
  publicUrl(ctx, { key }),
}
```

Four drivers ship: `s3`, `rest`, `supabase`, `vercel-blob`.

The **`rest` driver is entirely config-driven** — endpoint templates, static
form fields, a JSON path to extract the returned key (`file` for Uploadcare),
optional multipart init/complete endpoints, and a public-URL template. Adding
Uploadcare, or anything Uploadcare-shaped, is filling in the admin form; it
needs no code and no deploy.

New dependency: `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`.

### Ticket modes

| Mode | Used by | Ticket shape |
|---|---|---|
| `form-post` | Uploadcare `/base/`, generic REST | `url`, `fields{}`, `fileField`, `maxBytes` |
| `multipart` | Uploadcare >10 MB, S3 multipart | `parts[]` of presigned URLs, `partSize` |
| `presigned-put` | S3 / R2 / B2 / Wasabi | signed `url` + `headers` |
| `proxy` | Supabase Storage, Vercel Blob | `/api/storage/upload/<ticket>/bytes`, ≤4.5 MB |

`proxy` is the fallback whenever credentials cannot be exposed to the client and
the provider cannot presign.

### Reference: Uploadcare via the `rest` driver

- Direct, ≤100 MB: `POST https://upload.uploadcare.com/base/`, multipart form,
  fields `UPLOADCARE_PUB_KEY` + `UPLOADCARE_STORE`, response `{"file": "<uuid>"}`.
- Multipart, >10 MB: `POST /multipart/start/` with `filename`, `size`,
  `content_type` → `{ uuid, parts: [presigned S3 URLs] }`; client `PUT`s 5 MB
  chunks; `POST /multipart/complete/` with `uuid` → full metadata
  (`size`, `mime_type`, `original_filename`, …).
- Public URL template: `https://ucarecdn.com/{key}/`.

---

## 6. Public API (`app/api/storage/`)

All routes authenticate with a hashed API key via `Authorization: Bearer` or
`x-api-key`, reusing the `lib/email/auth.js` extraction pattern.

### `POST /api/storage/upload`

```json
{ "path": "/covers/2026/cat.png", "size": 27796904,
  "mimeType": "image/png", "require": ["cdn"], "overwrite": false }
```

Resolves the namespace from the key, runs the placement engine, reserves the
bytes, creates the node (`pending`) + placement (`reserved`) + upload row, and
returns the ticket. `?direct=1` with an inline body (≤4.5 MB) performs
reserve → transfer → commit in one request for small server-side uploads.

### `POST /api/storage/commit`

`{ ticketId, parts?, etag? }` → finalizes with the driver, settles the byte
ledger against the real size, flips placement to `committed` and node to
`ready`, logs the event, and returns the **file map**:

```json
{ "id": "9f3c…", "path": "/covers/2026/cat.png", "namespace": "geiger-flow",
  "size": 27796904, "mimeType": "image/png",
  "url": "https://dash.geiger.../api/storage/f/9f3c…",
  "directUrl": "https://ucarecdn.com/<uuid>/",
  "placement": { "provider": "Uploadcare EU", "driver": "rest",
                 "key": "<uuid>", "cdn": true } }
```

### Others

- `GET /api/storage/f/<id>` — gateway. 302 to the current placement's URL, or a
  freshly signed URL when the object is private. Stable across migrations.
- `GET /api/storage/list?path=` — folder listing for the calling namespace.
- `DELETE /api/storage/f/<id>` — soft-delete the node, remove from the provider,
  release bytes.
- `POST /api/storage/folder` — create a folder node.

---

## 7. Admin surface — `/admin/storage`

Server component fetches through `lib/filestore/queries.js` and hands data to a
client `StorageManager`, exactly as `/admin/emails` → `EmailManager`. Built from
`@geiger/ui` (`ScreenHeader`, `StatsBar`, `DataTable`, `StatusPill`,
`EmptyState`, `SectionCard`, `Field`, `Dialog`) with `LogoLoading` for
section-level loaders and semantic colour tokens only.

**Overview** — KPIs (pool capacity, used, free, object count, healthy
providers); a stacked bar of each provider's share and headroom; growth over
time; uploads by consumer; breakdown by mime type; largest files; provider
health tiles. Charts use `recharts` (already a dependency) through
`@geiger/ui`'s chart wrapper; the `dataviz` skill is consulted before any chart
code is written.

**Providers** — table with usage bar and status pill; add/edit dialog rendering
driver-specific fields from `configFields`/`secretFields`; a **Test** button
running the probe; priority ordering; capability toggles; capacity declaration.
Secrets render masked and are only ever replaced, never read back.

**Browser** — namespace picker → folder tree → file list. Each row shows the
logical path *and* a placement chip naming the provider holding the bytes.
Preview, copy gateway link, copy direct link, move to another provider, delete.

**Rules** — ordered match → target editor.

**Keys & Activity** — hashed API keys scoped to a namespace (shown in full once,
at creation) and the append-only event log.

---

## 8. Build order

1. Migration (schema, 8 tables, RPCs, RLS) + `crypto.js` secret envelope
2. Driver interface + `s3`, `rest`, `supabase`, `vercel-blob`
3. Placement engine + reserve/commit/settle + reconciliation
4. Public API routes (`upload`, `commit`, `f/[id]`, `list`, `folder`)
5. `queries.js` / `actions.js` + admin page shell + Providers tab
6. Overview dashboard + Browser tab
7. Rules, Keys, Activity + `npx eslint` pass

---

## 9. Risks

- **Schema exposure.** `filestore` must be added to Supabase's exposed schemas
  or every query 404s. Called out in the migration header.
- **Ledger drift.** Direct-to-provider uploads that never commit leave reserved
  bytes behind. Mitigated by ticket expiry plus `reconcile_provider`.
- **Secret handling.** Provider secrets are real credentials. AES-256-GCM at
  rest, service-role-only table, masked in the UI, never returned by a query.
- **CORS.** Direct browser uploads require the provider to allow the dash
  origin. Uploadcare does by default; S3/R2 buckets need a CORS rule. The
  provider probe reports this as a qualification warning.
