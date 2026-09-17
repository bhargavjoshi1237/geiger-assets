# Geiger Assets — Storage & Media Layer Handoff

You are picking up work in progress. Read this whole file before touching anything.

---

## 0. THE CODE IS NOT ON THIS BRANCH — READ THIS FIRST

You are probably sitting in `C:\Pro\geiger-assets` on `master`. **None of the work
described below is visible from here.** It lives on the branch `media-layer`, checked
out in a separate git worktree:

```
C:\Pro\geiger-assets-wt-base        branch: media-layer     <-- work here
C:\Pro\geiger-assets                branch: master          <-- you start here
```

`media-layer` is **26 commits / 48 files / ~6,980 insertions** ahead of `master`.
Nothing has been merged to `master`.

**Do this before anything else:**

```bash
cd /c/Pro/geiger-assets-wt-base
git status          # expect: clean, on media-layer
git log --oneline -5
```

If you work in `C:\Pro\geiger-assets` instead, you will rebuild things that already
exist and your imports will not resolve. The worktree already has `node_modules`
(a Windows directory junction), so `npx eslint` works there directly.

There are also stale per-task worktrees (`geiger-assets-wt-probe`, `-range`,
`-negotiate`, `-chunk`, `-deliver`, `-share`, `-hooks`, etc.). Their branches are
merged or copied into `media-layer`. **Ignore them.** Do not delete them without
asking — the user may still want the history.

---

## 1. Project conventions (these are enforced, not suggestions)

The repo root has `CLAUDE.md`, `AGENTS.md`, `MODULE_CONVENTIONS.md`,
`SUPABASE_CONVENTIONS.md`, and `crafting.md`. Read them. The load-bearing rules:

- **Next.js 16 App Router, JavaScript — no TypeScript.** Tailwind, shadcn/ui, Lucide.
- **Data layer is tri-state and never throws, never toasts.** Every function in
  `lib/supabase/*` and `lib/storage/*` returns `null` (not configured / read failed),
  `[]` (configured, no rows), or an object / `true` / `false`. It `console.error`s and
  returns — the *screen* owns all UX and toasts.
- **Per-product Postgres schema.** This product is `assets`. Reach it with
  `assetsClient()` / `schemaClient()`, never a bare `createClient()`. Only the shared
  `public.users` / `public.project` tables use the default schema.
- **Screens are data-layer-first.** Start `useState([])` + a loading flag, fetch on
  mount, derive with `useMemo`, mutate optimistically then persist. **Never** seed a
  screen from a static in-file array.
- **Semantic color tokens only** (`bg-surface-subtle`, `text-text-tertiary`,
  `border-border`…). Never hardcode hex.
- `LogoLoading` from `@geiger/ui` for full-page and section loaders (omit `name`, pass
  `size`); keep `Loader2` for button-sized spinners.
- **Do not run `npm run build`** unless the change is a significant UI modification and
  you are confident a build is needed to verify it.
- `npx eslint <files>` must exit 0 before you call anything done.

### `AGENTS.md` is untracked

`AGENTS.md` exists only in `C:\Pro\geiger-assets` and is **not in git**, so no worktree
has it. Its content is duplicated in `CLAUDE.md`, so nothing is lost — but do not cite
it in a spec you hand to a sub-agent working in a worktree, because they cannot read it.

---

## 2. What is already built — do not rebuild these

### Storage delivery (all working, committed)

| Module | What it does |
|---|---|
| `lib/media/derive.js` | sharp-based variant derivation. `VARIANTS` = `thumb` (256px), `preview` (1024px), `poster` (1920px). WebP default; AVIF opt-in. |
| `lib/media/variants.js` | The delivery seam. Manifest in `assets.metadata.derivatives` keyed `"<variant>.<ext>"`. `resolveVariant()`, `buildDerivatives()`, `persistDerivatives()`. |
| `lib/media/probe.js` | Magic-byte file probing + `typeMismatch()` — the upload trust boundary. |
| `lib/media/usage.js` | Delivery/storage metering + project rollups. Client is injectable via `{ client }`. |
| `lib/media/webhooks.js` | Endpoint CRUD + signed dispatch (Stripe-style `webhook-signature`), SSRF-hardened. |
| `lib/storage/throttle.js` | `throttle(bucket, identity)` → a 429 `NextResponse` or `null`. Buckets: `upload`, `uploadUrl`, `commit`, `sign`, `deliver`. **There is no `write` bucket** — config writes reuse `commit`. |
| `lib/storage/meter.js` | Fire-and-forget delivery metering for route handlers. |
| `app/api/media/[assetId]/[variant]/route.js` | Format-negotiated variant delivery, `Vary: Accept`, immutable cache. Falls back to the original when no derivative exists. |
| `app/api/media/share/route.js` + `app/t/[token]/route.js` | HMAC signed-token public share links. |
| `app/api/storage/multipart/{create,part,complete,abort,status}` | Multipart upload. |

**AVIF is deliberately not the commit-time default.** Measured on this toolchain it
encodes 4–5× slower than WebP (poster: 1165 ms vs 276 ms). WebP is written at commit;
AVIF is derived on demand at delivery and cached. Do not "optimize" this without
re-measuring.

### Pluggable multi-backend storage + pooling (just landed, tested, committed)

Storage used to be hardwired to one env-configured S3 bucket. It is now a provider seam:

| Module | What it does |
|---|---|
| `lib/storage/backends/contract.js` | The driver interface. `sealBackend()` wraps every op so a transport-level throw cannot break the tri-state contract. |
| `lib/storage/backends/s3_backend.js` | S3 parameterized **by config, not env** — several endpoints (Appwrite, R2, MinIO, AWS) can be live at once. Full multipart. |
| `lib/storage/backends/rest_backend.js` | Generic REST provider for an in-house file service. PUT or POST-multipart upload, ranged GET, HEAD with a ranged-GET fallback on 405, listing with field aliases. |
| `lib/storage/backends/secrets.js` | AES-256-GCM envelope encryption for stored credentials. |
| `lib/storage/backends/store.js` | Data layer for `storage_backends` / `storage_pools` / `storage_pool_members`. |
| `lib/storage/backends/registry.js` | `backendFromRecord()`, `envBackend()`, and `BACKEND_FIELDS` — a field catalog for rendering an "add a backend" form. |
| `lib/storage/pool.js` | Placement: `failover` / `spread` / `mirror`. Plus `writeTarget()`, `driverFor()`, `readCandidates()`, `locateObject()`, `mirrorWrite()`, `invalidateKey()`. |
| `app/api/storage/backends/*`, `app/api/storage/pools/*` | CRUD + a health-probe route. |

**The compatibility rule that makes this safe:** a `null` `storage_backend` on a row
means "the env-configured default backend". Every row written before this feature keeps
resolving untouched, and a deployment that configures no pool behaves exactly as it did.
**Do not break this invariant.**

Verified by real tests (79 cases, all passing):
- 39 REST-driver cases against a live `node:http` server
- 26 contract + placement cases (including a 20,000-iteration weighted-distribution check)
- 14 credential-encryption cases

---

## 3. Remaining work

Ordered by value. Items 1–2 are small and user-visible; item 3 is the biggest gap.

### 3.1 — `asset_preview.jsx` still requests full-size originals

**File:** `components/internal/shared/asset_preview.jsx` (194 lines)

Line ~93 renders `src={thumb || fileUrl}`, where `fileUrl = assetFileUrl(asset.id)`
(`lib/storage/client.js:84`) — the **full original**. So:

- Assets with a populated `thumbnail_url` are fine.
- Assets **without** one (every row uploaded before derivation shipped) download the
  full original into a 16:9 preview box. A 25 MB TIFF to render a card.

**Fix:** point the `<img>` at the variant route, which already falls back to the
original server-side when no derivative exists:

```
/api/media/<assetId>/thumb      (256px)
/api/media/<assetId>/preview    (1024px)
```

Remember `NEXT_PUBLIC_BASE_PATH` (it is `/assets` in production, `''` in dev) — build
the URL the same way `assetFileUrl` does rather than hardcoding a leading `/`.

Keep the existing `onError` → `setFailed(true)` fallback chain intact; it is what
handles a deleted object. Note the two branches of that `onError` are currently
identical (`if (thumb) setFailed(true); else setFailed(true);`) — collapse it.

Check the other `<img>` sites in the same file (lines ~80, ~160) and grep for other
consumers of `assetFileUrl` that are rendering a thumbnail-sized image.

### 3.2 — `next/image` loader is not wired

**File:** `next.config.mjs` — currently has **no `images` config at all**:

```js
const nextConfig = {
  transpilePackages: ["@geiger/ui"],
  basePath: isProd ? '/assets' : '',
  env: { NEXT_PUBLIC_BASE_PATH: isProd ? '/assets' : '' },
};
```

Every image in the app is a raw `<img>` with an eslint-disable comment above it
(`@next/next/no-img-element`), so nothing gets width/format negotiation from Next.

Add a custom loader that maps `next/image`'s `(src, width, quality)` onto the variant
route — pick the smallest variant whose width ≥ requested width (`thumb` 256 /
`preview` 1024 / `poster` 1920). Then migrate `asset_preview.jsx` and the grid cards
to `next/image` and drop the eslint-disable lines.

Scope check before you start: confirm with the user whether they want the full
`next/image` migration or just 3.1. 3.1 alone fixes the bandwidth problem; 3.2 is a
larger refactor across several screens.

### 3.3 — No UI for storage backends and pools (biggest gap)

The whole pluggable-storage feature is currently **API-only**. There is no screen to add
a backend, build a pool, or run a health check. `BACKEND_FIELDS` in
`lib/storage/backends/registry.js` exists precisely so a form can be rendered from a
catalog instead of hardcoded per kind.

**Before building, read `MODULE_CONVENTIONS.md` §"New-screen checklist" — it requires you
to ask the user about the module's shape first (fields, statuses, filters, KPIs, row
actions, whether it is permission-gated).** Do that; do not guess.

Rough shape: a settings screen listing backends (label, kind, health pill, enabled
toggle), a create/edit dialog driven by `BACKEND_FIELDS`, a "Test connection" action
hitting `POST /api/storage/backends/[id]/health`, and a pool editor for ordering members
(priority / weight / read-only) and picking a strategy.

Reference implementation for look and feel: the events area
(`components/internal/screens/events/all_events.jsx`) and the shared kit
(`components/internal/shared/screen_kit.jsx`).

API surface available to you:

```
GET/POST        /api/storage/backends
GET/PATCH/DELETE /api/storage/backends/[id]
POST            /api/storage/backends/[id]/health   -> { ok, detail, latencyMs, capabilities }
GET/POST        /api/storage/pools
GET/PATCH/DELETE/PUT /api/storage/pools/[id]        -- PUT replaces { members: [...] }
```

Secrets never come back from a read — a configured secret surfaces as a
`<name>Set: true` boolean. Render that as "configured" with a "replace" affordance;
**sending an empty string for a secret field means "leave unchanged"**, which the store
relies on so an edit does not blank a credential.

### 3.4 — Scheduled reconciler

`scripts/s3-reconcile.js` exists and works as a **manual** script (`--apply` to mutate,
dry-run by default). It reconciles orphaned `tmp/` objects (>24 h) and soft-deleted rows
past a 30-day retention.

Two things are missing:
1. It still talks to `lib/s3/index.js` (the env singleton) and therefore only sees the
   default bucket. It needs to iterate backends via `lib/storage/backends/store.js` to
   reconcile a pool.
2. Nothing schedules it. Decide with the user: a Vercel cron route, or leave it manual.

### 3.5 — URL-based transforms

Not started. The idea is a `w_400,h_300,c_fill`-style segment on the media route so a
caller can request an arbitrary size rather than one of three named variants. Design it
against `lib/media/variants.js` — it already owns the manifest, cache key, and
on-demand derivation path. Cap the accepted dimensions to an allowlist so the route
cannot be used to burn CPU deriving thousands of one-off sizes.

### 3.6 — Blocked / out of scope

- **CDN fronting** — blocked on the user's R2-vs-Appwrite decision.
- **Video transcoding / HLS** — no ffmpeg available in this environment.
- **AI tagging, smart crop, background removal** — needs an external provider; P3.

---

## 4. Traps discovered the hard way

Each of these cost real debugging time. Do not rediscover them.

1. **`no-undef` is OFF in this eslint config.** A function referencing an unbound
   identifier lints perfectly clean. This has already shipped a bug once (five functions
   in `lib/media/webhooks.js` with an unbound `client`). After any find-and-replace
   across a module, run:
   ```bash
   npx eslint lib app --rule '{"no-undef":"error"}'
   ```

2. **The browser Supabase client has no session inside a route handler.** Data-layer
   modules take an injectable `{ client }` for exactly this reason. From a route:
   ```js
   const sb = await createServerSupabase();
   await someStoreFn(args, { client: sb.schema("assets") });
   ```
   Forgetting this fails at runtime, not at lint.

3. **Appwrite's S3 gateway answers presigned URLs with 501.** Hence
   `S3_PRESIGNED_UPLOADS=false` / `S3_PRESIGNED_READS=false` and the proxy path with a
   4 MB `PROXY_MAX_BYTES` ceiling. Presigning is now a **per-backend capability**
   (`driver.capabilities.presignedReads`), not a deployment-wide flag — a pool can mix a
   bucket that presigns with a REST pod that cannot. Never assume presign works.

4. **Do not add SSRF / private-IP blocking to `rest_backend.js`.** Pointing at an
   internal host is the entire purpose of that driver. There is a comment saying so.
   (SSRF blocking in `lib/media/webhooks.js` is correct and must stay — that URL is
   user-supplied, not operator-supplied.)

5. **Backends with a null `project_id` are suite-wide and read-only through the API.**
   `requireProjectAccess` (`lib/storage/auth.js`) allows reads without a project but
   forbids writes. This is intentional — a suite-wide backend affects every product in
   the shared Supabase project. Seed those directly in SQL.

6. **`STORAGE_SECRET_KEY` must be set** or `store.js` refuses to persist a credential
   rather than silently downgrading to plaintext. If backend creation returns `null` with
   a "half-protected config" log line, that env var is missing.

7. **Dimensions must be probed from the *stored* bytes, not the uploaded bytes.** The
   quality presets resize to 1600/2048 px, so probing the original records dimensions
   describing bytes nobody will ever fetch. The security probe stays on the original
   (that is the trust boundary); a second probe runs on the encoded result.

8. **Placement is decided once, at write time, and recorded.** Reads resolve through the
   `storage_backend` column, never by re-running placement. Re-deciding at read time
   would point at a bucket the bytes were never in.

---

## 5. DO NOT DO THESE — they are the user's, not yours

1. **Do not run `npm run db:push`** or any DDL against the live database. The Supabase
   project is **shared across the entire Geiger suite**; a `--clean` would drop other
   products' tables. Four migrations are written and review-verified but deliberately
   **never executed**:
   ```
   supabase/migrations/20260916000000_usage.sql
   supabase/migrations/20260917000000_derivatives.sql
   supabase/migrations/20260917000000_webhooks.sql
   supabase/migrations/20260918000000_storage_pools.sql
   ```
   Until these run, the features that depend on them will fail at runtime against a real
   DB. Ask the user to run them; do not run them yourself.

2. **Do not rotate the leaked Appwrite S3 key.** The user has explicitly kept this —
   it is theirs to do in the Appwrite console.

3. **Do not copy `.env.local` into any worktree.**

4. **Do not merge `media-layer` to `master`** without asking.

5. **Do not decide R2 vs Appwrite.** That is an open user decision that blocks CDN work.

---

## 6. Verifying you have not broken anything

```bash
cd /c/Pro/geiger-assets-wt-base

# must both exit 0
npx eslint lib app scripts
npx eslint lib/storage app/api/storage --rule '{"no-undef":"error"}'
```

The three test scripts written this session live in the session scratchpad
(`C:\Users\space\AppData\Local\Temp\claude\`): `rest-smoke.mjs` (39 cases),
`pool-smoke.mjs` (26 cases), plus an inline secrets test (14 cases). They are throwaway
harnesses, not a committed suite — **there is no test framework in this repo.** If you
want them permanently, ask the user first; adding a test runner is a real decision, not
a side effect.

Note `lib/storage/pool.js` and `lib/storage/backends/registry.js` use `@/` alias imports,
which bare `node` cannot resolve. `contract.js`, `rest_backend.js`, and `secrets.js` have
no `@/` imports and can be imported directly by a `file:///` URL in a scratch `.mjs`.
For alias-using modules, extract the pure functions from the source text with a regex +
`new Function` (that is what `pool-smoke.mjs` does).

---

## 7. Suggested first move

Confirm scope with the user before building. The three live options are:

- **3.1** — small, high value, fixes a real bandwidth problem today.
- **3.3** — the largest gap; makes the pluggable-storage feature actually usable by a
  human instead of by curl. Requires the `MODULE_CONVENTIONS.md` question round first.
- **3.4 / 3.5** — infrastructure, lower urgency.

Ask which they want. Do not start 3.2 or 3.3 without checking — both are multi-file
refactors, and 3.3 has unstated product decisions baked into it.
