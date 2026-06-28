# Asset Library + Edit Asset — Design

**Date:** 2026-06-28
**Status:** Approved (pending written-spec review)

## Goal

Restructure the Assets area so that:

1. The **Asset Library** screen cleanly lists assets as a single table (modeled on
   geiger-events' *All Events* page).
2. Selecting an asset opens a dedicated **Edit Asset** screen (modeled on the
   geiger-events event editor).
3. The **Asset Relationships** and **Version Control** features move *off* the
   sidebar and *into* the Edit Asset screen's right-hand rail.
4. Those two entries are removed from the Assets sidebar dropdown.

Backing data moves from the in-file `sample_data.js` array to a real Supabase data
layer in the product's own `assets` schema.

## Decisions (from brainstorming)

- **Data source:** real Supabase data layer (`assets` schema), not mock data.
- **Sidebar trim:** remove **only** `Asset Relationships` and `Version Control`
  from the Assets domain. All other Assets features stay.
- **Library style:** a single **pure table list** (DataTable). Drop the grid/list
  toggle, the folder-breadcrumb tree, and the `Sheet` detail panel.
- **Edit right rail:** two stacked `SectionCard`s — **Asset Relationships** then
  **Version Control**. Nothing else in the rail.
- **Migration application:** build the full `db:push` runner
  (`scripts/run-sqls.js` + `pg` dependency + `npm run db:push`), matching the
  conventions doc. The committed `supabase/sqls/assets.sql` is the source of truth.

## Repo reality (what actually exists)

- Shared kit (`components/internal/shared/screen_kit.jsx`) already exports
  `ScreenHeader`, `StatsBar`/`StatGrid`/`StatTile`, `SectionCard`, `Toolbar`,
  `SearchInput`, `StatusPill`, `EmptyState`, `DataTable`, `Field`,
  `SettingsList`/`SettingRow`, `MainScreenWrapper`/`SecondaryScreenWrapper`.
- There is **no** shared `FilterDropdown` in the kit; `library_screen.jsx` defines
  a local one. We keep that local component (or lift it into the area).
- `lib/supabase/client.js` is a **bare** browser client — no `.schema()` wrapper,
  no activity-tracking fetch. We add the schema-scoped wrapper ourselves.
- No `supabase/sqls/`, no `scripts/run-sqls.js`, no `db:push`, no `pg` dep, no
  `supabase/components/` — all created by this work.
- Routing: `AssetsPlayground` holds `currentTab`; `"Asset Library"` →
  `LibraryScreen`, every other feature title → generic `FeatureScreen`. Removing a
  feature from `feature_registry.js` removes it from the nav **and** from
  `featureItemsByTitle`, so it stops resolving to `FeatureScreen`.
- Product schema for Geiger Assets is **`assets`** (per SUPABASE_CONVENTIONS).

## Data model (`assets` schema)

### `assets.assets`
| column | type | notes |
|---|---|---|
| id | uuid pk | `gen_random_uuid()`; create honors caller id |
| name | text | filename, e.g. `hero-banner.psd` |
| type | text | image/video/audio/document/3d/raw/pdf/archive |
| format | text | PSD, SVG, MP4… |
| size_bytes | bigint | |
| dimensions | text null | e.g. `4096 × 2160` |
| folder | text | flat label (no tree nav); shown in edit metadata |
| status | text | approved/draft/review/processing/archived |
| tags | text[] default '{}' | |
| description | text default '' | |
| downloads | int default 0 | |
| color | text | accent used by the thumbnail |
| thumbnail_url | text default '' | |
| created_by | uuid → public.users(id) | stamped from `getUser()` |
| created_at / updated_at | timestamptz default now() | `updated_at` trigger |
| deleted_at | timestamptz null | soft delete; lists filter `is null` |
| metadata | jsonb default '{}' | expansion bag |

### `assets.asset_relationships`
| column | type | notes |
|---|---|---|
| id | uuid pk | |
| asset_id | uuid → assets.assets(id) | the owning asset (its edit page lists this) |
| related_asset_id | uuid → assets.assets(id) null | nullable for external refs |
| relation_type | text | parent/child/derived/variant/source/campaign/product |
| label | text default '' | display name when related asset isn't a row |
| created_by | uuid → public.users(id) | |
| created_at | timestamptz default now() | |
| metadata | jsonb default '{}' | |

### `assets.asset_versions`
| column | type | notes |
|---|---|---|
| id | uuid pk | |
| asset_id | uuid → assets.assets(id) | |
| version_number | int | |
| label | text default '' | e.g. "Approved current" |
| is_current | boolean default false | exactly one current per asset |
| size_bytes | bigint null | |
| note | text default '' | |
| created_by | uuid → public.users(id) | |
| created_at | timestamptz default now() | |
| metadata | jsonb default '{}' | |

RLS enabled on all three; demo policy `for all to anon, authenticated using (true)`.
Seed rows migrated from `sample_data.js` with stable hard-coded UUIDs (a handful of
assets, each with 1–3 relationships and 1–8 versions).

## Files

### New
- `supabase/sqls/assets.sql` — idempotent schema + 3 tables + trigger + RLS + seed.
- `scripts/run-sqls.js` — `pg` client over `STRING_URI`, runs `supabase/sqls/*.sql`
  in filename order; `--clean` drops only this app's own tables.
- `supabase/components/assets-client.js` — `isSupabaseConfigured()` +
  `assetsClient()` (`createClient().schema("assets")`).
- `lib/supabase/assets.js` — data layer (see below).
- `components/internal/screens/projects/library/constants.js` — `STATUS_META`,
  `FILE_TYPE_COLORS`, `TYPE_ICONS`, filter option arrays, `formatDate`,
  `formatBytes`.
- `components/internal/screens/projects/library/asset_detail.jsx` —
  `AssetEditScreen`.

### Modified
- `components/internal/screens/projects/library/library_screen.jsx` — rewrite to
  the pure-table list; fetch from data layer; open `AssetEditScreen` on row click.
- `components/internal/sidebar/projects/feature_registry.js` — remove the two
  `feature(...)` entries from the Assets domain.
- `package.json` — add `pg` (and `dotenv`) dependency + `"db:push"` script.

### Removed / repurposed
- `components/internal/screens/projects/library/sample_data.js` — its lookups move
  to `constants.js`; its `ASSETS`/`FOLDERS` become SQL seed rows. File deleted once
  nothing imports it.

## Data layer (`lib/supabase/assets.js`)

`"use client"`; `TABLE = "assets"`, etc. All calls guarded by
`isSupabaseConfigured()` and `try/catch`; pure (validate, `console.error`, return
`null`/`false`/`[]`, never throw/toast).

- `normalizeAsset(row)` / `toRow(input)` (snake↔camel; emit a column only when its
  key is present; `""` dates → null; numerics coerced; spread `metadata` last).
- `listAssets()` → `[]`/`null`; filters `deleted_at is null`, orders by
  `updated_at desc`.
- `getAsset(id)`, `createAsset(input)` (honors caller `id`), `updateAsset(id, patch)`,
  `softDeleteAsset(id)`.
- `listRelationships(assetId)`, `createRelationship(input)`,
  `deleteRelationship(id)`, with `normalizeRelationship`.
- `listVersions(assetId)` (ordered desc), `restoreVersion(assetId, versionId)`
  (flip `is_current`), `createVersion(input)`, with `normalizeVersion`.

## Screen: Asset Library (rewrite)

```
MainScreenWrapper
  ScreenHeader  title="Library"  actions=[Upload]
  StatsBar      derived KPIs (total, storage, processing, approved)
  Toolbar
    left:  SearchInput + FilterDropdown(type) + FilterDropdown(status) + clear
    right: FilterDropdown(sort)
  DataTable
    columns: [check?, name+thumb, type badge, size, status pill, modified,
              downloads, row-actions menu]
    onRowClick -> open asset id
    empty: EmptyState (filtered vs first-run)
```

- State: `assets[]` + `loading`; `useEffect(listAssets)`. `filtered` derived with
  `useMemo` over (search, type, status, sort).
- Selected asset id held in component state and mirrored to `?asset=<id>`; when set,
  early-return `<AssetEditScreen assetId={id} onBack={…} onChange={…} />`.
- Row actions (stopPropagation): Edit, Download, Share, Duplicate, Delete.
  Duplicate/Delete are optimistic + persisted + `toast`, reconcile on falsy return.

## Screen: Edit Asset (new)

```
MainScreenWrapper
  header row: [← Back]  name + StatusPill        actions=[Download, Save]
  grid lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.7fr)]
    LEFT
      SectionCard "Preview"  (large thumbnail)
      SectionCard "Details"  Field-wrapped inline editors:
        name (Input), description (Textarea), status (Select), type (Select),
        folder (Input/Select), tags (chips)
    RIGHT (rail)
      SectionCard "Relationships"
        list rows: related asset name + relation_type badge + remove;
        "Add relationship" control
      SectionCard "Version Control"
        version rows: vN + label + size + "current" badge; "Restore" on non-current;
        newest first
```

- Fetch `getAsset`, `listRelationships`, `listVersions` on mount (loading state).
- Inline edits update local state immediately and persist via `updateAsset`
  (optimistic; `toast.error` + reconcile on failure). Changes propagate to the list
  via an `onChange(updatedAsset)` callback so the table stays in sync.
- Relationship add/remove and version restore are optimistic + persisted.

## Sidebar trim

In `feature_registry.js`, delete the `feature("Asset Relationships", …)` and
`feature("Version Control", …)` lines from the `Assets` domain's `features` array.
No other change needed — `featureNav`, `featureItems`, and `featureItemsByTitle`
all derive from `featureDomains`, so the nav entries and the `FeatureScreen` routing
both drop automatically.

## Out of scope

- Real file upload/storage (the Upload action stays a stub dialog for now).
- Folder tree navigation (replaced by flat list + filters).
- Duplicate Review, Archive & Trash, and other Assets features (unchanged).
- Auth-scoped RLS (keeps the demo open policy until suite auth lands).

## Verification

- `npx eslint` clean on all changed files.
- `npm run db:push` applies `assets.sql` without error (idempotent re-run safe).
- Library lists seeded assets; row click opens the editor; editing a field and
  returning reflects the change in the table; Relationships + Version Control render
  in the rail and are no longer in the sidebar.
