# Gallery Publishing — Design

Date: 2026-09-20
Area: `components/internal/screens/projects/galleries`,
`lib/supabase/{galleries,gallery_audience}.js`,
`app/g/[slug]`,
`supabase/migrations/20260920200000_galleries.sql`

## Purpose

Publish a collection (or a curated set of assets) as a branded, themed, hosted
page that people outside the workspace can visit, browse, favorite, and request
downloads from — and measure what they did there.

This is sub-project **A** of the **Galleries** domain. The domain carries nine
nav entries in `components/internal/sidebar/projects/feature_registry.js:368`,
all `Planned`, all falling through to `FeatureScreen`. Those nine are three
subsystems stacked on each other:

| Piece | Screens | Depends on |
|---|---|---|
| **A. Gallery publishing** (this spec) | Gallery Builder, Showcase Galleries, Gallery Domains, + the public page | collections, assets, storage |
| **B. Catalog** | Products & Pricing, Digital Downloads, Storefront | A, licensing |
| **C. Transactions** | Cart & Checkout, Orders & Invoices, Customers | A + B |

B and C get their own spec → plan → build cycles. Nothing transactional is in
scope here.

## Why this area matters

`docs/dam-market-research/analysis_notes.md` records gallery commerce and
outbound licensing as **0 of 12** in the competitor feature matrix — the
deliberate differentiator, not table stakes. The feature list comes from the
"Gallery Commerce Benchmarks" section of
`docs/dam-market-research/COMPETITOR_FEATURE_CATALOG.md:1345` (PhotoDeck,
Pixieset, SmugMug, PhotoShelter, Gumroad).

## Decisions (confirmed with the user)

| Question | Decision |
|---|---|
| Scope | Sub-project A only; B and C deferred |
| Gallery vs `share_links` | A **new `galleries` table**. Share links stay transient delivery; galleries are persistent branded pages. Password/expiry are duplicated deliberately. |
| Builder vs Showcase split | **Builder = authoring** (list + create + tabbed editor). **Showcase = audience** (analytics, proofing inbox, download queue). No overlap. |
| Public page | **Real `/g/<slug>` route**, mirroring `app/s/[token]` |
| Gallery Domains | **Persisted records + simulated verification** — real table, honest comment, no DNS lookup or cert issuance |
| Gallery content | **Both** — collection-backed (live) or a curated `gallery_items` list with ordering, captions, per-item hide |
| Visitor identity | **Email capture + visitor row** — anon browser token, optionally upgraded with name/email when the gallery requires it |
| Download requests | **Request queue with approve/deny**; per-gallery mode open / request / off |
| Analytics | **Event rows, aggregated in the UI** — no denormalized counters |

## Data model — `supabase/migrations/20260920200000_galleries.sql`

Schema `assets`. One self-contained idempotent file with `@up` / `@down`
markers, matching `20260920100000_licensing.sql`. Every table: `uuid` pk,
`project_id uuid references public.projects(id) on delete cascade`,
`created_by uuid references auth.users(id)`, `created_at` / `updated_at` with
the `assets.touch_updated_at` trigger, `deleted_at` soft delete,
`metadata jsonb not null default '{}'`, RLS on with a demo-open policy.

| Table | Purpose / key columns |
|---|---|
| `galleries` | The published page. `slug` (unique per project, the public identity), `name`, `headline`, `description`, `source_kind` ∈ collection/curated, `collection_id`, `cover_asset_id`, `layout` ∈ grid/masonry/justified/slideshow/single, `theme jsonb`, `nav jsonb`, `visibility` ∈ public/unlisted/private, `password_hash`, `require_email`, `download_mode` ∈ open/request/off, `allow_favorites`, `seo jsonb`, `status` ∈ draft/published/unpublished, `published_at`, `expires_at` |
| `gallery_items` | Curated list. `gallery_id`, `asset_id`, `position`, `caption`, `is_hidden` |
| `gallery_domains` | `gallery_id` (null = project-wide), `hostname`, `kind` ∈ subdomain/custom, `verification_token`, `dns_record_type`, `dns_record_name`, `dns_record_value`, `status` ∈ pending/verifying/active/failed, `ssl_status` ∈ none/pending/issued/error, `verified_at`, `is_primary` |
| `gallery_visitors` | `gallery_id`, `token` (anon browser id), `name`, `email`, `first_seen_at`, `last_seen_at` |
| `gallery_favorites` | `gallery_id`, `visitor_id`, `asset_id` — unique together |
| `gallery_download_requests` | `gallery_id`, `visitor_id`, `scope` ∈ gallery/selection/asset, `asset_ids uuid[]`, `message`, `status` ∈ pending/approved/denied, `decided_by`, `decided_at`, `decision_note` |
| `gallery_events` | `gallery_id`, `visitor_id`, `asset_id`, `kind` ∈ view/item_view/favorite/unfavorite/download/request, `occurred_at` |

## Data layer

Two modules on the existing `lib/supabase/row_helpers.js` primitives, same
contract as `lib/supabase/licensing.js` — guarded by `isSupabaseConfigured()`,
`normalize*` / `toRow` at the snake↔camel boundary, returning `null` / `[]` /
`false`, `console.error` on failure, never throwing and never toasting.

- `lib/supabase/galleries.js` — galleries, gallery items, gallery domains.
- `lib/supabase/gallery_audience.js` — visitors, favorites, download requests,
  events, plus the rollups the Showcase screen reads.

## Screens — `components/internal/screens/projects/galleries/`

- `constants.js` — `*_MAP` lookups (status, visibility, layout, domain status,
  request status), `*_FILTER_OPTIONS`, layout/theme option lists, formatters.
- `galleries_kit.jsx` — shared preview tile, theme swatch, gallery-specific pills.
- `gallery_builder_screen.jsx` — `MainScreenWrapper` → `ScreenHeader` + Create →
  `StatsBar` → `Toolbar` (status / layout / visibility filters + search) →
  `DataTable`. Row click sets `?gallery=<id>` via `useWorkspaceUrl()` and
  early-returns the detail editor.
- `gallery_detail.jsx` — tabbed editor: **Content** (collection picker, or
  curated reorder / caption / hide), **Layout & Theme**, **Navigation**,
  **Access** (visibility, password, email gate, download mode, expiry),
  **SEO & Social**, **Publish** (slug, public link, publish/unpublish,
  duplicate).
- `showcase_galleries_screen.jsx` — the audience side of published galleries:
  KPI bar, visits trend chart, top assets, proofing inbox (favorites grouped by
  visitor), download-request queue with approve/deny row actions.
- `gallery_domains_screen.jsx` — domain list, add dialog, DNS-record
  instructions panel, simulated Verify action, status + SSL pills.

## Public route

`app/g/[slug]/page.js` → `components/internal/screens/projects/galleries/public/gallery_view.jsx`,
mirroring `app/s/[token]/page.js`.

Resolves the slug server-side, records a `view` event, mints or reads the
visitor token, renders per layout + theme, and honors favorites and
`download_mode`.

Password and expiry **are enforced server-side**: the compare happens in a route
handler that sets a cookie, so the password never reaches the client. This is
deliberately stronger than `/s/[token]`, which documents itself as an
unenforced read-only stub.

## Wiring

- `components/internal/screens/registry.jsx` — add `"Gallery Builder"`,
  `"Showcase Galleries"`, `"Gallery Domains"`.
- `components/internal/sidebar/projects/feature_registry.js` — flip those three
  from `Planned` to `In progress`.
- `components/internal/screens/projects/collaboration/constants.js:174` — flip
  the `gallery` approval subject to `table: "galleries", available: true`.

## Defaults taken (not separately confirmed)

- **Layouts:** grid, masonry, justified rows, slideshow, single column.
- **Theme controls:** accent, light/dark ground, type pairing, thumbnail gap,
  corner radius, caption position.
- **Visibility:** public / unlisted / private — deliberately *not* the
  collections `private/team/public` set, since "team" is meaningless on a page
  whose whole purpose is to be seen from outside the workspace.
- **Slug:** auto-derived from the name, editable, uniqueness-checked on save.

## Out of scope

Products, pricing, cart, checkout, orders, customers (sub-projects B and C),
watermarking, print fulfilment, real DNS lookups, and SSL issuance.

## Verification

`npx eslint` on every changed file, then `next build` — this is a significant
UI addition plus a new public route, so a build is warranted. There is no test
runner in this repo; no test claims will be made.
